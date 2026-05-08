# M3-OAUTH-RELAY-SPEC — 自建 OAuth relay（消除 craft.do 残留）

> **优先级**：P0（M3-1，启动 M3 前必须先决策完，详见 [REVIEW-21-FULL-2026-05-07.md §2.4 #1](sync-reports/REVIEW-21-FULL-2026-05-07.md)）
> **目标**：把 OAuth callback 域名从 `agents.craft.do` 切换到自有域，消除 [LEGAL.md §5.1](../LEGAL.md) 已知瑕疵
> **预估**：spec 决策 0.5 天 + 自建 relay 部署 1 天 + 代码改造 + 单测 1 天 + 端到端 OAuth 验证 0.5 天 = **3 天**

---

## 0. 背景与决策点

`craft-agents-oss` 上游用 `https://agents.craft.do/auth/{provider}/callback` 作为统一 OAuth relay 的回调地址：第三方 OAuth provider（Slack/Gmail/Outlook/Generic OAuth）只能注册"固定 https URL"作为 redirect_uri，无法注册 `http://localhost:{port}` —— 上游给所有 fork 用户提供了一个 cloud relay，把 callback 转发到本机回环 port。

我们 fork 后这是 LEGAL.md §5.1 的已知瑕疵：第三方 OAuth 首次授权时，浏览器地址栏会短暂出现 `agents.craft.do`。

**决策点（启动 M3 前必须落地）**：

| 决策项 | 选项 A | 选项 B | 推荐 |
|---|---|---|---|
| 回调域名 | `auth.u-studio.cn`（独立子域）| `u-agents.u-studio.cn/auth/callback`（与下载页同域） | A — relay 跟下载页解耦更安全（下载页静态 CDN，relay 是动态）|
| 部署方式 | Cloudflare Worker（无服务器）| 自建 Node.js + Caddy（VPS） | A — 无运维负担、全球 edge、与下载页同栈 |
| Client Secret 管理 | 全部 fork 共享一对 OAuth credentials | 每个 fork 自带一对 | B — 闭源分发更纯净，避免被识别为 craft fork |
| 各 provider OAuth app | 重用上游 `agents.craft.do` 注册的 app | 自己注册 4 个 OAuth app（Slack/Google/Microsoft/Generic）| B — 必须，A 选项需要 craft 团队配合不可行 |

**结论**：
- 域名：`auth.u-studio.cn`
- 部署：Cloudflare Worker（与现 `agents.u-studio.cn` 下载页 + `update.u-agents.u-studio.cn` 自动更新源同栈）
- 各 OAuth app 自注册（Slack/Google/Microsoft 需要 verified 流程；Generic OAuth 由用户自填 client_id/secret）

> **v0.9.1 上游变更影响**（commit `70828cbc` + `34521a7d`）：Google Web app 类型变化要求新版 redirect_uri 处理。改造时不能直接照搬上游 `slack-oauth.ts` 的 `redirectUri` 派生，需要根据 OAuth provider 类型分别处理 callback fan-out 逻辑。

---

## 1. 改造范围（grep 命中清单）

### 1.1 单点常量（核心）

| 文件 | 当前 | 改造后 |
|---|---|---|
| `packages/shared/src/auth/oauth-relay.ts:3` | `'https://agents.craft.do/auth/callback'` | `OAUTH_RELAY_CALLBACK_URL` 改读环境变量 + 生产默认 `'https://auth.u-studio.cn/auth/callback'`，dev 允许 `http://localhost:{port}`（仅 dev runtime） |

### 1.2 Slack OAuth 专用回调

| 文件 | 行 | 当前 | 改造后 |
|---|---|---|---|
| `packages/shared/src/auth/slack-oauth.ts` | 269 | `?? `https://agents.craft.do/auth/slack/callback?port=${options.callbackPort}`;` | `?? \`${SLACK_OAUTH_RELAY_BASE}/auth/slack/callback?port=${options.callbackPort}\`` |
| `packages/shared/src/auth/slack-oauth.ts` | 359 | 注释 `https://agents.craft.do/auth/slack/callback → http://localhost:{port}/callback` | 改为 `https://auth.u-studio.cn/auth/slack/callback → http://localhost:{port}/callback` |
| `packages/shared/src/auth/slack-oauth.ts` | 360 | `const redirectUri = \`https://agents.craft.do/auth/slack/callback?port=${port}\`;` | `const redirectUri = \`${SLACK_OAUTH_RELAY_BASE}/auth/slack/callback?port=${port}\`;` |

`SLACK_OAUTH_RELAY_BASE` 从 `oauth-relay.ts` 派生（同源策略——所有 OAuth provider 共用一个 relay 域名）。

### 1.3 LEGAL.md 17 处 craft.do 文档残留

| 文件 | 处 |
|---|---|
| [LEGAL.md](../LEGAL.md) §5.1 | 全段重写：从"已知瑕疵：浏览器看到 craft.do"改为"已通过 M3-1 自建 relay 消除" |

---

## 2. Cloudflare Worker relay 实现纲要

### 2.1 路由表

| Path | Provider | 行为 |
|---|---|---|
| `/auth/callback` | 通用 OAuth（GitHub/GitLab 等） | 读 `state` 参数 → 解出 `port` → 302 到 `http://localhost:{port}/callback?<原 query>` |
| `/auth/slack/callback` | Slack | 读 `port` query param → 302 到 `http://localhost:{port}/callback?code=<code>` |
| `/auth/google/callback` | Google | 同 Slack 模式 |
| `/auth/microsoft/callback` | Microsoft | 同 Slack 模式 |

### 2.2 Worker 关键代码骨架（写在 spec 里供外部 AI 实现，**不在本仓库实现**）

```javascript
// auth.u-studio.cn/_worker.js (Cloudflare Worker)
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 解析 state 中的 port（generic OAuth）
    if (path === '/auth/callback') {
      const state = url.searchParams.get('state');
      const port = parseStatePort(state);  // base64-decoded JSON envelope
      if (!port || port < 1024 || port > 65535) return new Response('invalid state', { status: 400 });
      return Response.redirect(`http://localhost:${port}/callback${url.search}`, 302);
    }

    // Slack/Google/Microsoft fan-out（port 在 query）
    const portMatch = path.match(/^\/auth\/(slack|google|microsoft)\/callback$/);
    if (portMatch) {
      const port = parseInt(url.searchParams.get('port'), 10);
      if (!port || port < 1024 || port > 65535) return new Response('invalid port', { status: 400 });
      return Response.redirect(`http://localhost:${port}/callback${url.search.replace(/[?&]port=\d+/, '')}`, 302);
    }

    return new Response('not found', { status: 404 });
  }
};
```

### 2.3 OAuth app 注册（外部 AI 跑前置准备）

| Provider | URL | 需要的 redirect_uri |
|---|---|---|
| Slack | https://api.slack.com/apps | `https://auth.u-studio.cn/auth/slack/callback` |
| Google | https://console.cloud.google.com/apis/credentials | `https://auth.u-studio.cn/auth/google/callback` |
| Microsoft | https://portal.azure.com → App registrations | `https://auth.u-studio.cn/auth/microsoft/callback` |
| 通用 OAuth | （用户自填）| `https://auth.u-studio.cn/auth/callback` |

> **闭源分发提醒**：Client Secret 通过 esbuild `--define` 注入 build artifact（同 `SENTRY_ELECTRON_INGEST_URL` pattern；详见 [`apps/electron/scripts/electron-build-main.ts`](../apps/electron/scripts/electron-build-main.ts)）。CI secrets 名建议：`U_AGENTS_OAUTH_SLACK_CLIENT_SECRET` / `U_AGENTS_OAUTH_GOOGLE_CLIENT_SECRET` 等。

---

## 3. 改造 step-by-step（外部 AI 执行，本仓库 AI 不执行）

### 步骤 1：自建 Cloudflare Worker（前置，1 天）

1. 在 `u-studio.cn` Cloudflare DNS 加 A/CNAME 记录 `auth` → Worker 路由
2. 部署 §2.2 Worker 代码
3. 端到端 curl 验证：`curl -I 'https://auth.u-studio.cn/auth/callback?state=eyJwb3J0IjoxMjM0NX0='` 应返回 302 + Location: `http://localhost:12345/callback?...`
4. 4 个 OAuth app 注册 + 把 redirect_uri 都填上 `auth.u-studio.cn`

### 步骤 2：代码改造（外部 AI，0.5 天）

#### 2.1 改 `packages/shared/src/auth/oauth-relay.ts:3`

```typescript
// U-API: M3-1 自建 OAuth relay — 消除 craft.do 残留（详见 .planning/M3-OAUTH-RELAY-SPEC.md §1.1）
// dev 允许 localhost；prod 锁死 auth.u-studio.cn
const RELAY_OVERRIDE = typeof process !== 'undefined'
  ? process.env?.U_AGENTS_OAUTH_RELAY_BASE
  : undefined;

export const OAUTH_RELAY_CALLBACK_URL =
  RELAY_OVERRIDE ?? 'https://auth.u-studio.cn/auth/callback';

export const SLACK_OAUTH_RELAY_BASE =
  RELAY_OVERRIDE?.replace(/\/auth\/callback$/, '')
  ?? 'https://auth.u-studio.cn';
```

#### 2.2 改 `slack-oauth.ts` 三处（L269/L359/L360）

```typescript
// L1（imports 区）
import { SLACK_OAUTH_RELAY_BASE } from './oauth-relay';

// L269
?? `${SLACK_OAUTH_RELAY_BASE}/auth/slack/callback?port=${options.callbackPort}`;

// L359 注释
// The relay redirects: https://auth.u-studio.cn/auth/slack/callback → http://localhost:{port}/callback

// L360
const redirectUri = `${SLACK_OAUTH_RELAY_BASE}/auth/slack/callback?port=${port}`;
```

#### 2.3 §3.7 改造点 marker（必加，[CLAUDE.md §3.7](../CLAUDE.md)）

| # | 文件 | 注释（grep 关键字）| 标记 |
|---|---|---|---|
| 43 | `packages/shared/src/auth/oauth-relay.ts:3` | `M3-1 自建 OAuth relay — 消除 craft.do 残留` | 块（含 RELAY_OVERRIDE + SLACK_OAUTH_RELAY_BASE）|
| 44 | `packages/shared/src/auth/slack-oauth.ts:269` | `M3-1 OAuth relay 域名切换` | 单行 |
| 45 | `packages/shared/src/auth/slack-oauth.ts:360` | 同上 | 单行 |

> ⚠️ **本 spec 编写于 v22 时点（基线 67），未实施**。当前实际基线 **82**（v24 全 Bucket A+B+C 后），4 处 craft.do 残留仍在；M3-1 启动时再次更新本节实际数字。
>
> 改造完成后 [CLAUDE.md §3.7](../CLAUDE.md) 主表新增 #43-#45 行（spec 原计划"基线 67 → 70"作历史记录；实际实施时按当时基线推算）。

### 步骤 3：单测（外部 AI，0.5 天）

#### 3.1 新增 `packages/shared/src/auth/__tests__/oauth-relay.test.ts`

```typescript
import { describe, expect, test, beforeEach } from 'bun:test';

describe('OAUTH_RELAY_CALLBACK_URL', () => {
  beforeEach(() => {
    delete process.env.U_AGENTS_OAUTH_RELAY_BASE;
  });

  test('default points to auth.u-studio.cn', async () => {
    const { OAUTH_RELAY_CALLBACK_URL } = await import('../oauth-relay');
    expect(OAUTH_RELAY_CALLBACK_URL).toBe('https://auth.u-studio.cn/auth/callback');
  });

  test('does not contain craft.do', async () => {
    const { OAUTH_RELAY_CALLBACK_URL, SLACK_OAUTH_RELAY_BASE } = await import('../oauth-relay');
    expect(OAUTH_RELAY_CALLBACK_URL).not.toContain('craft.do');
    expect(SLACK_OAUTH_RELAY_BASE).not.toContain('craft.do');
  });

  test('U_AGENTS_OAUTH_RELAY_BASE override accepted', async () => {
    process.env.U_AGENTS_OAUTH_RELAY_BASE = 'http://localhost:8787/auth/callback';
    delete require.cache[require.resolve('../oauth-relay')];
    const { OAUTH_RELAY_CALLBACK_URL } = await import('../oauth-relay');
    expect(OAUTH_RELAY_CALLBACK_URL).toBe('http://localhost:8787/auth/callback');
  });
});
```

> **C5 自洽**（[CLAUDE.md §3.7 C5](../CLAUDE.md)：新改造点必须同时加单测）。

### 步骤 4：grep 全仓 craft.do（外部 AI 跑）

```bash
# 必须 = 0（除非 LEGAL.md 历史段落引用为"已消除"）
grep -rn "agents.craft.do\|craft.do/auth" packages apps \
  --include="*.ts" --include="*.tsx" 2>/dev/null
```

### 步骤 5：端到端 OAuth 验证（用户实测，0.5 天）

详见 [`09-test-checklist.md` §6.2](09-test-checklist.md)，测试时浏览器地址栏应见 `auth.u-studio.cn` 而非 `agents.craft.do`。

---

## 4. 与 M3-2/3/4 的协调

- **M3-DEAD-PATH-CLEANUP-SPEC.md**：M3-1 OAuth relay 改造**同 commit** 清理 `CRAFT_*` env、`craft-clipboard` 文件名、`Craft CLI` system prompt 三处死路径。这是 [REVIEW-21-FULL-2026-05-07.md §2.4 #2](sync-reports/REVIEW-21-FULL-2026-05-07.md) 强制要求。
- **M3-4 Sentry**：oauth-relay.ts override 机制可复用（`U_AGENTS_OAUTH_RELAY_BASE` env 同 `SENTRY_ELECTRON_INGEST_URL` 模式）。

---

## 5. 验收清单

- [ ] Cloudflare Worker 部署 + 4 个 OAuth app 全部 verified
- [ ] `oauth-relay.ts` + `slack-oauth.ts` 改造 + 单测通过
- [ ] grep `agents.craft.do` 全仓 = 0（LEGAL.md 历史叙述除外）
- [ ] 端到端 4 个 provider OAuth 授权流程实测通过（浏览器地址栏看到 `auth.u-studio.cn`）
- [ ] [CLAUDE.md §3.7](../CLAUDE.md) 加 #43-#45（基线 67 → 70）
- [ ] [LEGAL.md §5.1](../LEGAL.md) 已知瑕疵段落改写为"M3-1 后已消除"
- [ ] [`11-roadmap.md`](11-roadmap.md) §M3-1 标记完成

---

## 6. 关联规格

- [REVIEW-21-FULL-2026-05-07.md §2.1 + §2.4](sync-reports/REVIEW-21-FULL-2026-05-07.md)（finding 来源）
- [LEGAL.md §5.1](../LEGAL.md)（消除目标）
- [M3-DEAD-PATH-CLEANUP-SPEC.md](M3-DEAD-PATH-CLEANUP-SPEC.md)（同 commit 清理）
- [CLAUDE.md §3.7](../CLAUDE.md)（marker 增量）
- [`07-upstream-sync.md` §2.7c](07-upstream-sync.md) C1（slug helper 模式）类比可借鉴
