# M3-SSRF-CONSOLIDATION — SSRF 防护从"点"到"面"

> **状态**：起草（2026-05-08，v27 review O1+N1 系列触发）
> **范围**：把"refreshApiRenew + createApiTool"两点 SSRF 防护扩展为整个仓库的 SSRF 一致面
> **优先级**：P0（web-fetch.ts）+ P1（其它 5 处）
> **关联文档**：
> - [`M3-REFRESH-API-SSRF-SPEC.md`](./M3-REFRESH-API-SSRF-SPEC.md)（前序 SSRF 防护——refreshApiRenew + createApiTool 两点）
> - [`CLAUDE.md`](../CLAUDE.md) §3.7 #43-#45（已落地的 SSRF marker）
> - `.planning/sync-reports/REVIEW-27-FULL-2026-05-08.md`（触发本 spec 的 review 报告）

---

## 0. 背景：为什么把 "点" 升级为 "面"

v23/v24 落地的 SSRF 防护（`assertPublicHttpsUrl` + `redirect:'manual'` + 30x reject）只覆盖了两个点：

1. `packages/shared/src/sources/credential-manager.ts` 的 `refreshApiRenew`
2. `packages/shared/src/sources/api-tools.ts` 的 `createApiTool`

**v27 review O1 用户视角 + N1 反向追踪发现**：仓库里有更多 fetch callsite **同样存在 SSRF 风险**——有些是 credential-bearing（带 Authorization），有些是用户输入 URL 直接 fetch（更危险）。如果只保护两点，攻击者会绕去 web-fetch.ts、source-test.ts、webhook 等其它没修的入口。

**SSRF 防护的"面"语义**：
- 任何接受**用户输入或上游配置**作为 URL 的 fetch，都必须走 SSRF guard
- guard = `validateUrl`（DNS 解析 → 私网检查）+ `redirect:'manual'`（拦 30x）
- credential-bearing 的 fetch 必须**额外**走 `assertPublicHttpsUrl`（强 https + 拒云元数据域名）

---

## 1. 受影响 callsite 全景表（v27 N1 追踪结果）

| # | 文件 | 函数/位置 | 用户输入来源 | credential? | 当前状态 | 优先级 |
|---|---|---|---|---|---|---|
| **已保护**（v23/v24 落地） |
| - | `packages/shared/src/sources/credential-manager.ts` | `refreshApiRenew` | 上游 source 配置 `endpoint` | ✅ Authorization | ✅ assertPublicHttpsUrl + redirect:'manual' + 30x reject | — |
| - | `packages/shared/src/sources/api-tools.ts` | `createApiTool` | 上游 source 配置 `endpoint` | ✅ 可能 | ✅ 同上 | — |
| **本 spec 待修** |
| 1 | `packages/pi-agent-server/src/tools/web-fetch.ts` | `web_fetch` tool execute | ✅ AI 直接传 URL | ❌ 无 | ⚠️ 有 validateUrl + redirect:'follow'（**redirect bypass 漏洞**）| **P0** |
| 2 | `packages/session-tools-core/src/handlers/source-test.ts` | source 测试 endpoint | ✅ 用户测试 source 配置时输 URL | ✅ Authorization | ❌ 无任何 SSRF 防护 | P1 |
| 3 | `packages/shared/src/automations/webhook-utils.ts` | webhook delivery | 上游 webhook 配置 | ✅ 可能 (custom headers) | ❌ 无 | P1 |
| 4 | `packages/shared/src/auth/oauth.ts` 等 OAuth 实现 | token 交换 | 上游 OAuth provider 配置 | ✅ client secret | ⚠️ provider URL 上游硬编码（短期低风险）| P2 |
| 5 | `packages/messaging-gateway/src/adapters/telegram/index.ts` | bot API 调用 | 上游配置 baseUrl（默认 api.telegram.org）| ✅ bot token | ⚠️ 用户可改 baseUrl（潜在配置攻击）| P1 |
| 6 | `packages/shared/src/utils/logo.ts` / `icon.ts` | 远程 fetch 图标/logo | 上游 source 配置 url | ❌ | ⚠️ 公开 fetch，redirect bypass 可探测内网 | P2 |
| **不需要修**（已确认安全） |
| - | `packages/shared/src/auth/claude-token.ts` 等 | 上游 hardcoded URL | ❌ | ❌ | ✅ URL 编译期常量，无注入面 | — |
| - | `packages/server-core/src/webui/http-server.ts` | webui 内部 fetch | ❌ 仅 internal | ❌ | ✅ 内部 IPC | — |

> **C1 对应模式**：硬编码 URL 不需要 SSRF guard，但每次同步上游必须 grep 确认这些"硬编码"没被改成"配置化"——一旦上游让用户配 URL，立即升级到本表。

---

## 2. 实施计划

### 2.1 P0：web-fetch.ts（必修，现有 redirect bypass 漏洞）

**文件**：`packages/pi-agent-server/src/tools/web-fetch.ts:360-368`

**当前代码**：
```typescript
response = await fetch(url, {
  headers: { ... },
  redirect: 'follow',                  // ← 漏洞：跟随 30x 后绕过 validateUrl
  signal: AbortSignal.timeout(30_000),
});
```

**修复（与 v24 redirect bypass 真修同模板）**：
```typescript
response = await fetch(url, {
  headers: { ... },
  // U-API: M3 SSRF 防护 — redirect bypass 修补（不跟随 30x，主动检查）
  redirect: 'manual',
  signal: AbortSignal.timeout(30_000),
});

// U-API: M3 SSRF 防护 — 主动拒绝 30x redirect
if (response.status >= 300 && response.status < 400) {
  return result(
    `Refused to fetch ${url}: HTTP ${response.status} redirect blocked (SSRF protection)`,
    true,
  );
}
```

**为什么不沿用 `assertPublicHttpsUrl`**：
- web-fetch 是**公开 web 抓取工具**，需要支持 `http://` URL（让用户抓 HTTP-only 老网站）
- `assertPublicHttpsUrl` 强制 https，会破坏 web-fetch 的语义
- web-fetch 用的是 `validateUrl`（已有，宽松）+ `redirect:'manual'`（本次新增）的组合

**单测**：新建 `packages/pi-agent-server/src/tools/__tests__/web-fetch-ssrf.test.ts` —— 6 个用例：
1. 正常 https URL → 200 → ok
2. 私网 IP `http://192.168.1.1/` → validateUrl 拦截
3. 云元数据 `http://169.254.169.254/` → validateUrl 拦截
4. 公网 URL 但 30x 重定向到云元数据 → 30x reject 拦截 ✓ **新增 v27 真修**
5. 公网 URL 但 30x 重定向到私网 → 30x reject 拦截 ✓ **新增 v27 真修**
6. file://schema → validateUrl 拦截（unsupported protocol）

**marker 注册**：§3.7 表新增：

| # | 改造类别 | 文件 | 定位 | 标记 | 关联规格 |
|---|---|---|---|---|---|
| 47a | web-fetch.ts redirect:'manual' + 30x reject | `packages/pi-agent-server/src/tools/web-fetch.ts:~365` | 注释 `M3 SSRF 防护 — redirect bypass 修补` + `主动拒绝 30x redirect` | 单行（2 处）| M3-SSRF-CONSOLIDATION §2.1 |
| 47b | web-fetch.ts SSRF 单测 | `packages/pi-agent-server/src/tools/__tests__/web-fetch-ssrf.test.ts` | describe `web-fetch SSRF` | 单行 | C5 自洽 |

### 2.2 P1：source-test.ts（4 处 SSRF guard）

**文件**：`packages/session-tools-core/src/handlers/source-test.ts`

**4 个 fetch callsite**（具体行号实施时 grep）：
- API source test（带 user-provided baseUrl + Authorization）
- Webhook source test
- Custom HTTP source test
- 任何 user-config 的 endpoint test

**修复模板**（每处都接 `assertPublicHttpsUrl` + `redirect:'manual'` + 30x reject）：

```typescript
// 文件顶部 import
import { assertPublicHttpsUrl } from '../../shared/utils/url-safety';

// 每处 fetch 前
try {
  assertPublicHttpsUrl(testUrl);  // U-API: M3 SSRF 防护 — credential-bearing
} catch (err) {
  return { ok: false, error: `Refused: ${err.message}` };
}

const response = await fetch(testUrl, {
  ...
  redirect: 'manual',  // U-API: M3 SSRF 防护
});

if (response.status >= 300 && response.status < 400) {
  return { ok: false, error: `Blocked 30x redirect (SSRF protection)` };  // U-API: M3 SSRF 防护
}
```

**单测**：source-test SSRF 回归测试

**marker**：

| # | 改造类别 | 文件 | 定位 | 标记 | 关联规格 |
|---|---|---|---|---|---|
| 48a-d | source-test.ts 4 处 SSRF guard | `packages/session-tools-core/src/handlers/source-test.ts` | 注释 `M3 SSRF 防护` × 4 处 fetch + redirect:'manual' × 4 + 30x reject × 4 | 单行（约 12 处）| M3-SSRF-CONSOLIDATION §2.2 |

### 2.3 P1：webhook-utils.ts

**文件**：`packages/shared/src/automations/webhook-utils.ts`

webhook delivery 是上游配置触发——但配置可能来自用户输入，且发出请求时可能带自定义 header（含 secret）→ credential-bearing。

**修复**：与 §2.2 同模板。

### 2.4 P1：messaging-gateway/telegram

**文件**：`packages/messaging-gateway/src/adapters/telegram/index.ts`

telegram bot baseUrl 默认 `https://api.telegram.org`，但用户可改（自建 telegram bot api 服务器场景）。改后无 SSRF guard → 攻击者改成 `http://169.254.169.254/...` 配 bot token 一起发，可探测云元数据。

**修复**：与 §2.2 同模板，但要保留"用户可配 baseUrl"的能力——只挡私网 + 云元数据，不强制 telegram 官方域。

### 2.5 P2：oauth.ts 系列

**文件**：`packages/shared/src/auth/oauth.ts` + `slack-oauth.ts` / `google-oauth.ts` 等

OAuth provider URL 当前上游全部 hardcode（如 `https://accounts.google.com/o/oauth2/...`）。短期看注入面为零，**P2 推迟**——但每次同步上游必须 grep 确认 provider URL 仍是编译期常量，**一旦改为运行时配置，立即升级 P0**。

### 2.6 P2：logo.ts / icon.ts

公开 fetch 图标，无 credential，单纯 redirect bypass 可被探测内网（返回 image bytes 即说明 endpoint 存在）。低优先级，但加 `redirect:'manual'` 是零成本 hardening。

---

## 3. 实施顺序

按照"风险 × 实施成本"排：

1. **P0 web-fetch.ts**（**v27 之后立即**，单文件 2 行 + 单测 6 个）
2. P1 source-test.ts 4 处（同 review 周期内，复用 v24 模板）
3. P1 webhook-utils + telegram-adapter（半个月内）
4. P2 oauth + logo/icon（M3 后期，与其它 hardening 一起做）

每步完成后：
- 加 §3.7 marker
- 加单测
- baseline 数字相应递增（**预估 +6**：47a/47b + 48a-d 单行 + 单测 marker —— 实施时按真实 marker 数刷新）

---

## 4. 与 M3-REFRESH-API-SSRF-SPEC 的关系

本 spec 是 [`M3-REFRESH-API-SSRF-SPEC.md`](./M3-REFRESH-API-SSRF-SPEC.md) 的**横向扩展**：
- 前者：refreshApiRenew + createApiTool 两点
- 本 spec：把同一防护模式覆盖到所有 fetch callsite

实施 AI 落地本 spec 时，**复用** `assertPublicHttpsUrl`（已在 `packages/shared/src/utils/url-safety.ts`）—— 不要重复实现。

---

## 5. 验收

跑完所有 P0+P1 后：

1. **runtime 测试**：跑 `bun test packages/**/*-ssrf.test.ts` —— 所有 SSRF 测试通过
2. **静态扫描**：grep 确认所有"危险" fetch 都有 `redirect:'manual'`：

```bash
# 找所有 user-config 来源的 fetch
grep -rEn "fetch\((endpoint|url|baseUrl|target)" packages --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=__tests__ \
  | grep -v "redirect: 'manual'" | grep -v "assertPublicHttpsUrl"
# 期望：只剩 P2 推迟的项（logo.ts / icon.ts / oauth provider URL hardcoded）
```

3. **marker 校验**：跑 §3.7 baseline grep，应等于 88 ± 2（82 + 6）

4. **回归**：跑 `bun run validate:ci`、`bun test`，全绿

---

## 6. 与 v23/v24 review 的差距

v23 review 把 `createApiTool` 提为"v23 §5.2 follow-up P1"——v24 实施时只修了那一处，没追问"还有哪些 fetch 同形态"。**v27 N1 反向追踪发现 6 处同形态漏洞**——证明"修一个点"不等于"修一面"，下次同步前必须把"用户输入/上游配置 → fetch" 这条数据流当面追。

实施 AI 在 review 阶段必跑的 prompt：
> 全仓 grep `fetch\(`，对每处 callsite 回答：URL 是用户输入还是 hardcoded？带 credential 吗？有 SSRF guard 吗？汇总一张表。

把这张表加进 sync 报告，作为下次 review 的输入基线。
