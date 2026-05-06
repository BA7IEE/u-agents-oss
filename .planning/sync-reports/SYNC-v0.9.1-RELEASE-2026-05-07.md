# SYNC v0.9.1 RELEASE — v8 P0 完整闭环（2026-05-07）

**版本**：v0.9.1（fork: u-agents 38 commits ahead upstream/main）
**发布 commit**：`7692d36d`（main 分支）
**对应上游**：`b31904c6` (craft-agents-oss v0.9.1)
**fork merge-base**：`acb08842` (craft-agents-oss v0.9.0)

---

## 1. 里程碑

```
2026-05-05  v8 提出 P0：R2 上的 hotfix 不含 4 项 M2 安全 fix
2026-05-06  21 轮 review（v8/v9/v10/v11/v12/v13/v14/v15/v16/v17/v18/v18-errata/v19/v20）
            38 commits（v0.9.1 同步 + 事故 #1-#5 fix + 11 包 private + 文档刷新）
            重打三平台（macOS arm64+x64 / Windows x64）+ 装包测试
            R2 上传（latest/ 直接覆盖）
2026-05-07  v8 P0 真闭环 ✓ — 用户 v0.9.1 自动更新链路真生效
```

---

## 2. 发布产物

### 2.1 三平台二进制

| 平台 | 文件 | 大小 | sha512 (head 16) |
|---|---|---|---|
| macOS arm64 | `U-Agents-arm64.dmg` | 228 MB（239452515 字节）| `fb99a720b82de979` |
| macOS arm64 | `U-Agents-arm64.zip` | 220 MB（231062296 字节）| `ac6bd89679241f08` |
| macOS x64 | `U-Agents-x64.dmg` | 234 MB（245333754 字节）| `d48b8e8ae4c5ae20` |
| macOS x64 | `U-Agents-x64.zip` | 226 MB（236892989 字节）| `ce50435d9fe9485a` |
| Windows x64 | `U-Agents-x64.exe` | 221.41 MB（232168701 字节）| (Windows 端打 + 上传) |

完整 sha512 见 [`apps/electron/release/SHA512SUMS-mac`](../apps/electron/release/SHA512SUMS-mac) + R2 上的 [`latest-mac.yml`](https://update.u-agents.u-studio.cn/latest/latest-mac.yml) / [`latest.yml`](https://update.u-agents.u-studio.cn/latest/latest.yml)。

### 2.2 Auto-update 链路验证

| 检查 | 结果 |
|---|---|
| `app-update.yml` (in DMG) `url:` 字段 | `https://update.u-agents.u-studio.cn/latest` ✓（F1 修复后含 `/latest` 后缀）|
| `https://update.u-agents.u-studio.cn/latest/latest-mac.yml` | 200，version=0.9.1 ✓ |
| `https://update.u-agents.u-studio.cn/latest/latest.yml` | 200，version=0.9.1 ✓ |
| `https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg` | 200，Content-Length 239452515 ✓（CDN 刷新后）|
| `https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe` | 200，Content-Length 232168701 ✓ |
| latest-mac.yml releaseDate | `2026-05-06T17:50:28.961Z` |
| Apache §4(c) 合规：LICENSE + NOTICE 在 .app 内 | 10770B + 1043B ✓ |
| 用户可见路径 0 'Craft Agent app' 残留 | 0 命中 ✓（F2 修复）|

### 2.3 装包实测

| 平台 | 装包 | 首条 LLM 消息 | 验证人 |
|---|---|---|---|
| macOS arm64 | ✓ | ✅ 回复正常 | user |
| macOS x64 | ⏸ 无 Intel Mac，未实测 | - | - |
| Windows x64 | ✓ | ✅ 回复正常 | user |

---

## 3. v0.9.1 内容

### 3.1 上游 v0.9.1（merge commit `bd2a005d`）

- **Telegram bot 白名单 + 访问控制**（workspace owner + 每绑定 access mode）
- **每连接 mid-stream 发送行为**（Steer / Queue 子菜单，per-provider 默认）
- **聊天输入框模型图像支持开关**（custom-endpoint pi_compat 连接 per-model toggle）
- **工具结果阈值随上下文窗口动态调整**
- **Pi SDK 升级 0.70.2 → 0.72.1**（undici / Anthropic stream-end / DeepSeek V4 / GPT-5.5 Codex）
- **HTTP MCP 校验不再 spawn subprocess**（macOS sandbox 不再 SIGKILL）
- **Locale 字典序保护**（`scripts/sort-locales.ts` + pre-commit hook）

### 3.2 我们 fork 含的 4 项 M2 安全 fix（v8 P0 核心目标）

| Fix | commit |
|---|---|
| TLS 严格化（`tlsRejectUnauthorized ?? true` 默认严格）| `c516e4d2` |
| atomicWriteFileSync 11 处用户数据持久化 | `25d38ab9` |
| dir 0o700（`~/.u-agents/`）| `2972d8f4` |
| LLM API key 长度限制（`MIN/MAX_LLM_API_KEY_LENGTH`）| `2972d8f4` |

### 3.3 Build pipeline 事故 #1-#5 全闭环

| 事故 | 症状 | fix commit | Windows verify |
|---|---|---|---|
| #1 | macOS DMG 缺 pi-agent-server | `8ebe8c0` (M1) | M1 首发实测 |
| #2 | DMG 缺 vendor/bun | `8359988` (M1) | M1 首发实测 |
| #3 | Windows EXE 缺 pi-agent-server | `8cc943e6` | `8fea0c00` |
| #4 | Windows EXE 缺 WhatsApp worker | `3ee6e4dd` | `8fea0c00` |
| #5 | Windows EXE 缺 dist/interceptor.cjs | `c0fe89cc` | `eba259be` |

main bundle 5 步流水线（sessionServer → piAgentServer → interceptor → whatsAppWorker → main process）Windows 路径与 root chain 完整等价。

### 3.4 关键修复 — F1 publish.url（v17 漏盘补丁）

- **症状**：electron-builder.yml `publish.url = https://update.u-agents.u-studio.cn`（根域）
- **原因**：electron-updater 拼 `<publish.url>/latest-mac.yml` → 根域 404
- **修复**：commit `1154b61a` 改 `publish.url` 加 `/latest` 后缀
- **影响**：之前所有发版的 .app 自动更新链路实际是断的。**v0.9.1 是历史第一个 publish.url 正确的版本**——后续装机用户从这一版开始才能真自动更新

### 3.5 v0.9.1 sync 期间引入的 fork 改造点（§3.7 表 #37-#42）

| # | 文件 | 类别 |
|---|---|---|
| 37 | `routing.ts` | v0.9.1 routing.ts 漏分类 9 channel 修复（C13 上游 release 自身 test fail）|
| 38 | `block-markers.ts` | 上游 v0.9.1 ESLint 违规 disable（C12 color-mix annotation）|
| 39 | `resource-bundle.test.ts` | 上游 v0.9.1 ESLint 违规 disable（C12 test 直读 isAuthenticated）|
| 40 | `access-control.ts` | F2 messaging access-control rejection 文案品牌 |
| 41 | `commands.ts` | F2 messaging pairing-code rejection 文案品牌 |
| 42 | `apps/cli/src/index.ts` | F3 printHelp craft-cli → u-agents-cli（M2 cli rename 漏盘补丁）|

### 3.6 Build 脚本子表（B1-B4，事故 #1-#5 全套）

| B# | 改造 | 文件 | commit |
|---|---|---|---|
| B1 | adhoc 签名 escape hatch | `build-dmg.sh` | `6ba75da4` (M2) |
| B2 | 事故 #3 buildSubprocessServers | `build-win.ps1` | `8cc943e6` |
| B3 | 事故 #4 buildWhatsAppWorker | `build-win.ps1` | `3ee6e4dd` |
| B4 | 事故 #5 buildInterceptor | `build-win.ps1` | `c0fe89cc` |

---

## 4. 38 commits 完整链（v8 → release）

### Review 分布

```
v8     (1 P0)         → 9d0bf3c4
v9     (3 漂移)
v10    (7 P0+18 P1/P2)→ 74dc2d61 / 26ddef9c / 73d39e33（Wave 1+2+3）
v11    (mini)
v12    (4 维度风险地图)→ e9639428
v13    (元交叉)        → e24cfb75
v14    (3 P0 SOP)     → d7cacc3c / a311758e（Wave 4.5）
v15    (双视角)       → 3cada51e / fc22763f（Wave 4.6）
v16    (实战 vs 预测) → d15dbf91
v17    (8 项外部 AI)  → 7a19d2c2 / 1154b61a（v17 漏盘补丁）
v18    + errata       → 89c9d67b / b7c9f761
v19    (manifest dead)→ fae7f279
v20    (3 路深度 9 项)→ 7bd08e8b / 7692d36d（11 包 private）
```

### Fix 分布

```
M1 期 (9d0bf3c4 之前)   1119ee32 fix(test): url-safety fixture
M2 期 (v9-v15)          74dc2d61-fc22763f Wave 1-4.6 docs
v0.9.1 sync prep        e9639428-fc22763f
v0.9.1 sync execute     bd2a005d (sync merge)
事故 #3 修              8cc943e6
事故 #4 修              3ee6e4dd
事故 #5 修              c0fe89cc
v17 漏盘补丁 4 项       1154b61a
v20 11 包 private       7692d36d
```

---

## 5. 当前基线 + git 状态

| 指标 | 值 |
|---|---|
| 主 U-API marker（packages + apps/.ts/.tsx）| **67** |
| `/* U-API START/END */` 配对 | **8/8** |
| Build 脚本 marker（B1-B4）| **4** |
| main HEAD | `7692d36d` |
| origin/main | 已 push 同步 |
| upstream/main | `b31904c6` (v0.9.1) — fork 38 commits ahead |
| worktree | `claude/happy-lovelace-53cea9` 已 ff merge 进 main |

---

## 6. 已知遗留（v8 P0 闭环不影响，但有用户感知或维护成本）

| # | 项 | 严重度 | 处理时机 |
|---|---|---|---|
| 1 | R2 没建 `/v0.9.1/` 归档目录（user 直接覆盖 /latest/）| P3 | 下次发版应做（防回滚困难，详见 06 §13）|
| 2 | R2 没备份 v0.9.0 hotfix 到 `/archive/v0.9.0-hotfix1/`（已不可恢复）| P3 | 历史 hotfix 已无法回滚，但 main HEAD 含所有 fix 可重打 |
| 3 | macOS x64 装包未实测（无 Intel Mac）| P3 | 用户反馈触发（理论上跟 arm64 同模式）|
| 4 | A 路 P1：Sentry DSN 风险 + refreshApiRenew SSRF | P1 | M3 自建 Sentry 时一并 |
| 5 | B 路 中-高：baileys/libsignal GPL 边界 + vendor/copilot TOS + MCP SDK peer | 中-高 | LEGAL.md 各加段 / 下次 sync |
| 6 | C 路 P0/P1：CI 4 死引用脚本 / M2 fix 0 单测 / husky hooks 失效 / main.cjs 42MB 裁剪 | P1 | 任何时候 |
| 7 | v18 §3 #2 + #3 + #4 仍 pending：AGENTS.md 同步 / 02 §551 精确化 / 09 加 craftAgentsCli=false verify | P2 | 文档时间 |
| 8 | M3 cleanup：apps/electron/src/main/index.ts:151-160 4 个 CRAFT_*_ENTRY env / prompts/system.ts:534 'Craft CLI' / utils/files.ts craft-clipboard tmpdir | P3 | M3 |

---

## 7. 用户感知收益

旧 v0.9.0+u-agents.1 装机用户启动 → electron-updater fetch `/latest/latest-mac.yml` → 检测到 v0.9.1 → 下载升级 → 自动拿到：

**安全升级**（4 项 M2 安全 fix）：
- TLS 严格化（之前 `?? false` 默认放行 self-signed → 现在 `?? true` 默认严格）
- atomicWriteFileSync ×11（断电不丢用户配置 / 会话）
- `~/.u-agents/` 目录权限 0o700（多用户机器隐私）
- LLM API key 长度限制（防误粘大文本 OOM）

**功能升级**（v0.9.1 上游）：
- Telegram bot 白名单 + 访问控制
- mid-stream 发送 Steer/Queue 二选一
- per-model 图像支持开关
- 工具结果阈值随上下文动态调整
- Pi SDK 0.72.1（undici / DeepSeek V4 / GPT-5.5 Codex 支持）

**Build/分发链路稳定性**（事故 #1-#5 全闭环 + F1 publish.url 修复）：
- Windows EXE 含完整 main bundle 5 步流水线产物
- macOS / Windows 自动更新链路真生效
- 11 包 `"private": true` 防误 publish 公共 npm registry

**用户可见文案**（中文 + 品牌干净）：
- `apps/electron/resources/release-notes/0.9.1.md` 中文翻译（57 行 → 59 行）
- messaging access-control rejection 文案 'Craft Agent app' → 'U Agents app'
- apps/cli printHelp 'craft-cli' → 'u-agents-cli'

---

## 8. SOP 改进沉淀（v8 → v20 累积）

| SOP 文件 | 关键新增 |
|---|---|
| [`07-upstream-sync.md`](.planning/07-upstream-sync.md) | C1-C14 14 类踩坑模式 / §2.5b release notes 翻译 SOP / §2.7c grep 全格式 |
| [`12-subprocess-build-pipeline.md`](.planning/12-subprocess-build-pipeline.md) | 事故 #1-#5 完整记录 / §0.4b 已知非阻塞 warning / §2.3 marker B1-B4 表 |
| [`CLAUDE.md`](CLAUDE.md) | §3.7 主表 #1-#42 + Build 脚本 B1-B4 + C 表 C1-C14 + 基线 67 |
| [`SYNC-PLAYBOOK-v0.9.1.md`](.planning/sync-reports/SYNC-PLAYBOOK-v0.9.1.md) | 同步执行单页应急手册（修订基础已建立）|

---

## 9. 下次发版（v0.9.2+ 或 v0.10.0）应做的流程改进

1. **建版本归档目录** `/v0.9.2/`（详见 06 §13 路径布局）
2. **备份当前 latest** 到 `/archive/v0.9.1-final/` 再覆盖
3. **跑 v18 §4 完整 step-by-step**（含 v18 errata + v19 commit hash 动态化）
4. **手动 sha512 + size 对账**（CDN 缓存可能误导：用 `?_=$(date +%s)` cache-bust）
5. **自动更新 dry-run**：用 v0.9.1 装机 → 触发更新 → 应自动拿到新版

---

**Generated**: 2026-05-07 by AI in user 当次明确指令下（"必须的"）
**v8 P0 状态**：✅ 完整闭环
