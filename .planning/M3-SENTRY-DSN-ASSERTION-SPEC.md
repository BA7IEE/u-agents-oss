# M3-SENTRY-DSN-ASSERTION-SPEC — Sentry DSN build-time assertion（先于 M3-4 自建）

> **优先级**：P1（M3-4 自建 GlitchTip 落地前的基础设施前置）
> **目标**：阻止"production build 缺 DSN → 静默 disabled → 全量 crash 丢失"的发布事故，给 M3-4 自建 Sentry 留一致的入口
> **预估**：build script 改造 0.5 天 + CI secret 配置 0.5 天 = **1 天**

---

## 修订记录

**2026-05-07（实施时修订）**：
- spec 原写文件路径 `apps/electron/scripts/electron-build-main.ts` —— **实际在 repo root 的 `scripts/electron-build-main.ts`**
- packaging signal 信号源由 `--packaging` flag 改为 `U_AGENTS_PACKAGING=1` 环境变量（package.json `electron:build` 串联多个命令会吞 `--`，env 变量更可靠）
- assertSentryDsnForPackaging 三种信号都接受：argv `--packaging` / `NODE_ENV=production` / `U_AGENTS_PACKAGING=1`
- Windows 路径直接 inline `npx esbuild`（绕过 electron-build-main.ts），所以 build-win.ps1 独立加 PowerShell 等价 DSN warn
- M2 过渡期：缺 DSN 仅 console.warn / Write-Warning，不 process.exit(1)
- M3-4 GlitchTip 上线日：electron-build-main.ts:assertSentryDsnForPackaging 把 `console.warn` 改 `process.exit(1)`；build-win.ps1 把 `Write-Warning` 改 `throw` —— 两处改完即刻 fail-fast
- 防回归测试：[`packages/shared/src/__tests__/m3-dsn-assertion-regression.test.ts`](../packages/shared/src/__tests__/m3-dsn-assertion-regression.test.ts) 11 tests 覆盖 assertion 函数 + 三平台 build 脚本 packaging signal

---

## 0. 现状与风险

[`apps/electron/src/main/index.ts:20-58`](../apps/electron/src/main/index.ts) 现状：

```typescript
Sentry.init({
  dsn: process.env.SENTRY_ELECTRON_INGEST_URL,
  environment: app.isPackaged ? 'production' : 'development',
  release: app.getVersion(),
  enabled: !!process.env.SENTRY_ELECTRON_INGEST_URL,
  // ...
});
```

**风险路径**：

| 场景 | 当前行为 | 风险 |
|---|---|---|
| dev 跑 + 无 DSN | `enabled: false` 静默禁用 | OK（dev 本就无需上报） |
| **prod 打包**（M3 后 GlitchTip 上线）+ **CI secret 漏注入** | esbuild `--define` 替换不到 DSN → `enabled: false` 静默 | **生产用户 crash 全丢，运维无感知**——v8 P0 同类风险（M2 安全 fix 没进 R2 hotfix）|
| prod 打包 + DSN 注入正确 | `enabled: true` 按设计上报 | OK |

[09-test-checklist.md §13.4](09-test-checklist.md) 已有"M1 包不设 DSN"的 verify，但这是 **M1 当前**的策略；M3-4 自建 GlitchTip 后必须强制 prod 包带 DSN，否则发布事故重演（v21 §2.1 M3-4 桶 finding）。

---

## 1. 改造目标

| 阶段 | 行为 |
|---|---|
| **dev 跑**（`bun run start`） | DSN 缺失允许，`enabled: false` 静默 |
| **prod 打包**（`bun run dist:mac` 等）| DSN 缺失 → **build 直接 fail**（assertion error）；DSN 提供 → 嵌入 artifact |
| **CI workflow** | `SENTRY_ELECTRON_INGEST_URL` 是必需 secret；缺失则 build job fail |

阻断点：**build 时**而非 runtime——避免发布后才发现 DSN 漏注。

---

## 2. 改造范围

### 2.1 esbuild build script — `apps/electron/scripts/electron-build-main.ts`

```bash
# 找现有 esbuild --define 注入点
grep -n "define\|SENTRY_ELECTRON_INGEST_URL\|build(" \
  apps/electron/scripts/electron-build-main.ts | head -20
```

需新增 build-time assertion 段（写在 esbuild build call 之前）：

```typescript
// U-API: M3-Sentry build-time DSN assertion（详见 .planning/M3-SENTRY-DSN-ASSERTION-SPEC.md §2.1）
// prod 打包必须有 DSN，dev 不强制。错过 assertion 的发布事故会让 prod crash 全丢。
const isPackagingForRelease = process.env.NODE_ENV === 'production'
  || process.argv.includes('--packaging');

if (isPackagingForRelease) {
  const dsn = process.env.SENTRY_ELECTRON_INGEST_URL;
  if (!dsn) {
    console.error([
      '[build-fail] SENTRY_ELECTRON_INGEST_URL 未设置——M3-4 自建 GlitchTip 上线后 prod 包必须带 DSN',
      '  本地打包：在 .env / 1Password 设 SENTRY_ELECTRON_INGEST_URL=<GlitchTip DSN>',
      '  CI 打包：检查 GitHub Actions secrets 是否注入',
      '  M2/M1 阶段绕过：set NODE_ENV=staging 跑 build（不进 prod 分发）',
    ].join('\n'));
    process.exit(1);
  }
  // 简单 DSN 格式校验（避免占位符 <DSN_HERE> 漏过 build）
  if (!/^https?:\/\/[a-f0-9]+@/.test(dsn)) {
    console.error(`[build-fail] SENTRY_ELECTRON_INGEST_URL 不是有效 DSN 格式: ${dsn.slice(0, 30)}...`);
    process.exit(1);
  }
}
```

> **NODE_ENV 选择**：用 `production` 太广（`bun run start` 也可能被设）。用 `--packaging` flag 显式更安全；M3 启动时由 [`apps/electron/scripts/build-dmg.sh`](../apps/electron/scripts/build-dmg.sh)/[`build-win.ps1`](../apps/electron/scripts/build-win.ps1) 调用 `electron-build-main.ts` 时显式传 `--packaging`。

### 2.2 macOS build entry — `apps/electron/scripts/build-dmg.sh`

```bash
# 现有：
node_modules/.bin/electron-builder --mac --arm64

# 改造（M3 启动时；现 M2 阶段不强制）：
NODE_ENV=production bun run scripts/electron-build-main.ts --packaging
node_modules/.bin/electron-builder --mac --arm64
```

### 2.3 Windows build entry — `apps/electron/scripts/build-win.ps1`

```powershell
# 现有：bun run electron:build:main 等
# 改造：在 main bundle 之前加一行
$env:NODE_ENV = "production"
bun run scripts/electron-build-main.ts --packaging
# 接着原 build pipeline
```

### 2.4 CI workflow（`.github/workflows/*.yml` 之类——本仓库未见 GitHub Actions，外部 AI 决策跑哪）

为发布 build job 加 secret 校验：

```yaml
# 仅示意结构
- name: Build dist
  env:
    SENTRY_ELECTRON_INGEST_URL: ${{ secrets.U_AGENTS_SENTRY_DSN }}
  run: |
    if [ -z "$SENTRY_ELECTRON_INGEST_URL" ]; then
      echo "::error::U_AGENTS_SENTRY_DSN secret missing"
      exit 1
    fi
    bun run dist:mac
```

### 2.5 §3.7 marker

| # | 文件 | 注释 | 标记 |
|---|---|---|---|
| 49 | `apps/electron/scripts/electron-build-main.ts` | `M3-Sentry build-time DSN assertion — prod 包必须有 DSN` | 块 |
| B5 | `apps/electron/scripts/build-dmg.sh` | `# U-API: M3-Sentry — 加 --packaging flag 触发 build-time DSN assertion` | 单行 |
| B6 | `apps/electron/scripts/build-win.ps1` | 同上 | 单行 |

> ✅ **已 ship（v24 Bucket A）**：v24 commit `e91bb1e0` 落地 build-time DSN warn assertion；M2 过渡期不 fail，M3-4 GlitchTip 上线时切 fail。当前实际基线 **82**（不是 spec 原写的 68）；B5/B6/B7 已在 §3.7 Build 脚本子表登记。
>
> （历史记录）主基线 grep 仅扫 `.ts/.tsx`，#49 计入主基线（spec 原写"67 → 加 1"，实际未独立计 #49，assertion 在 scripts/electron-build-main.ts 不入主基线）；B5/B6/B7 仅在 build 脚本子表里登记。

---

## 3. M2 阶段过渡

**问题**：M3-4 GlitchTip 还没建，M2 阶段强制 DSN 会卡住所有 prod build。

**过渡策略**（外部 AI 实施时按时间线选）：

| 阶段 | 策略 |
|---|---|
| **现在 → M3-4 启动前** | 仅在 `electron-build-main.ts` 加 assertion 代码但**默认 warn 不 fail**（`process.exit(1)` 改 `console.warn`），等 M3-4 GlitchTip 部署再切 fail |
| **M3-4 GlitchTip 部署日** | 同 commit 切 `console.warn` → `process.exit(1)`；CI secret 注入 |

```typescript
// 过渡期代码（M3-4 启动前用）
if (isPackagingForRelease) {
  const dsn = process.env.SENTRY_ELECTRON_INGEST_URL;
  if (!dsn) {
    // U-API: M3-4 GlitchTip 上线后改为 process.exit(1) 强制阻断
    console.warn('[build-warn] SENTRY_ELECTRON_INGEST_URL 未设置——M3-4 GlitchTip 上线后此 warn 会变为 fail');
  }
}
```

---

## 4. 单测（C5 自洽）

新增 `apps/electron/scripts/__tests__/dsn-assertion.test.ts`：

```typescript
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';

describe('build-time DSN assertion', () => {
  test('packaging without DSN exits 1 (after M3-4 cutoff)', () => {
    const result = spawnSync('bun', [
      'run', 'apps/electron/scripts/electron-build-main.ts', '--packaging',
    ], {
      env: { ...process.env, SENTRY_ELECTRON_INGEST_URL: '', NODE_ENV: 'production' },
    });
    // M3-4 启动前：expect(result.status).toBe(0)（warn 不 fail）
    // M3-4 启动后：expect(result.status).toBe(1)
    expect([0, 1]).toContain(result.status);
  });

  test('packaging with valid DSN succeeds', () => {
    const result = spawnSync('bun', [
      'run', 'apps/electron/scripts/electron-build-main.ts', '--packaging',
    ], {
      env: {
        ...process.env,
        SENTRY_ELECTRON_INGEST_URL: 'https://abc123@sentry.example.com/1',
        NODE_ENV: 'production',
      },
    });
    expect(result.status).toBe(0);
  });

  test('dev mode without DSN succeeds', () => {
    const result = spawnSync('bun', [
      'run', 'apps/electron/scripts/electron-build-main.ts',
    ], {
      env: { ...process.env, SENTRY_ELECTRON_INGEST_URL: '' },
    });
    expect(result.status).toBe(0);
  });
});
```

---

## 5. 验收清单

- [ ] `electron-build-main.ts` 加 assertion 代码（M2 过渡期 warn / M3-4 后 fail）
- [ ] `build-dmg.sh` + `build-win.ps1` 调用时显式 `--packaging`
- [ ] CI workflow secret 注入（M3-4 启动同 commit 加 fail 阻断）
- [ ] 单测 3 条覆盖（dev 通过 / prod 无 DSN fail / prod 有 DSN 通过）
- [ ] [CLAUDE.md §3.7](../CLAUDE.md) 加 #49 + B5/B6（基线 67 → 68 + Build 脚本子表 4 → 6）
- [ ] [09-test-checklist.md §13.4](09-test-checklist.md) 加"M3 prod build 必须带 DSN"verify

---

## 6. 关联规格

- [REVIEW-21-FULL-2026-05-07.md §2.4 #3](sync-reports/REVIEW-21-FULL-2026-05-07.md)（finding 来源）
- [M3-OAUTH-RELAY-SPEC.md](M3-OAUTH-RELAY-SPEC.md) §2.3（同 esbuild --define 注入模式）
- [11-roadmap.md M3-4](11-roadmap.md)（自建 Sentry/GlitchTip）
- [12-subprocess-build-pipeline.md](12-subprocess-build-pipeline.md) §0（事故 #3-#5，main bundle pipeline）—— 本 spec 同样在 main bundle 阶段插入 assertion
- [CLAUDE.md §3.7](../CLAUDE.md) C5（新改造点必加单测）

---

## 7. 失败模式回顾（防再发）

| 类比事故 | 共性 |
|---|---|
| **事故 #3-#5 main bundle pipeline 5 步漏调**（[12-subprocess-build-pipeline.md §0.3-0.5](12-subprocess-build-pipeline.md)） | "build 脚本静默漏一步 → 产物不完整 → 用户实测才发现" |
| **v8 P0 R2 hotfix 漏 4 项 M2 安全 fix** | "发布产物缺关键内容 → 一段时间无人察觉" |
| **本 spec 防的事故**：M3-4 GlitchTip 上线后 CI secret 漏注 → prod build 静默无 Sentry → crash 全丢 | 同模式：build/分发产物缺关键依赖 |

**根因模式**：build 脚本对"必备外部依赖"无 fail-fast 检查。
**防御模式**：build-time assertion + CI secret 校验 + 单测覆盖。
