# 全仓 Review v4 — 实际代码审查（2026-05-04）

**Review 焦点**：前 3 轮都是文档对齐，本轮审查**代码本身**——逻辑正确性、隐藏 bug、未文档化的 craft 残留

**总评级**：**A-（发现 1 个 P0 真 bug 待修，其余均已规划）**

---

## ⚠️ P0 真 Bug — state.ts:306 凭证 keyless 特判硬编码

### 现状

[`packages/shared/src/auth/state.ts:296-307`](packages/shared/src/auth/state.ts:306)

```typescript
if (connection && defaultConnectionSlug) {
  hasCredentials = await manager.hasLlmCredentials(...)

  if (connection.authType === 'api_key' || ...) {
    apiKey = await manager.getLlmApiKey(defaultConnectionSlug);
    if (!apiKey && connection.baseUrl) {
      // U-API: the fixed remote base URL still requires a user token.
      hasCredentials = defaultConnectionSlug !== U_API_SLUG;  // ← BUG
    }
  }
}
```

`U_API_SLUG = 'u-api-default'`（硬编码常量）。

### Bug 复现路径

1. 用户走 onboarding 创建 default U-API connection（slug = `u-api-default`，输 Token）→ 正常使用
2. 在设置页**添加第二个 U-API connection**（slug = `u-api-2`，**没输 Token**）
3. 把 `u-api-2` **设为 default connection**
4. 重启应用
5. `defaultConnectionSlug = 'u-api-2'`，`apiKey = null`（未输 Token），`baseUrl = token.u-studio.cn`（被 enforceUApiBaseUrl 锁定）
6. 第 306 行：`hasCredentials = 'u-api-2' !== 'u-api-default' = true`
7. **应用判定"已认证"，进入主界面**
8. 用户实际无 Token，发请求会被 401 拒绝

### 修复方案

```typescript
// 修复后（line 306）
hasCredentials = !isUApiSlug(defaultConnectionSlug);
```

`isUApiSlug` 已在 `packages/shared/src/config/u-api-defaults.ts:12` export，识别 `u-api-default` / `u-api` / `u-api-N` 全部 U-API slug 格式。

需同步 import：

```typescript
// state.ts:29
import { U_API_SLUG, isUApiSlug } from '../config/u-api-defaults.ts';
```

### 影响范围

| 维度 | 评估 |
|---|---|
| 触发条件 | 多连接 + 非 default 连接被设为 default + 该连接没 Token |
| 用户感知 | 进入主界面后才发现发不出消息（403/401 错误） |
| 是否阻塞首发 | **否**（首发 1 个 default 连接正常工作；多连接是高级用法）|
| 修复优先级 | **应在下个 hotfix 修**（`v0.9.0+u-agents.1`）|

---

## ✅ 5 个核心 U-API 文件代码质量

| 文件 | 评级 | 关键发现 |
|---|---|---|
| `storage.ts` enforceUApiBaseUrl | **A** | 持续启动锁正确；多连接 `isUApiSlug()` 已用；测试覆盖 4 个集成 case |
| `state.ts` hasCredentials | **B-**（修 P0 后 A）| 上述 P0 bug |
| `paths.ts` CONFIG_DIR | **A** | 双 env 兼容 + 跨平台路径正确 |
| `u-api-defaults.ts` | **A** | 边界情况处理齐全（null/undefined/空串）|
| `provider-metadata.ts` pi_compat | **A** | 用 `isUApiSlug()` 路由优先正确 |

storage.ts 还有 2 个 P2 改进（不阻塞）：
- L2129-2130 静默丢弃非 U-API connection，无 warning 日志
- L2164 冗余三元（永不执行的 fallback 分支）

---

## ✅ 发版资源完整性

`electron-builder.yml` + `package.json`（root + apps/electron）+ `资源文件` + `打包脚本` 全部 **A 级**：

- ✅ appId / productName / artifactName / publish.url / dmg.title 全部正确
- ✅ extraResources 含 LICENSE + NOTICE（Apache §4(c) 闭环）
- ✅ icon.icns / icon.ico / icon.png / Assets.car 都是 U Agents logo
- ✅ 0 处 craft-logos/ 残留
- ✅ build-dmg.sh / build-win.ps1 / scripts/build/*.ts 均无 craft artifact name
- ✅ DMG 内 `Contents/Resources/{LICENSE,NOTICE}` 已验证

仅 1 项 P2 优化建议：`package.json` 中 6 处 `CRAFT_*` 开发 env vars（CRAFT_DEBUG / CRAFT_DEV_RUNTIME / CRAFT_WEBUI_DIR / CRAFT_WEBUI_PORT）建议改为 `U_AGENTS_*`，与 deeplink scheme 标准化。**不阻塞**——开发者本地用，用户看不见。

---

## ✅ MCP 裁剪 + deeplink + 网络层

11-roadmap.md #11e（craft-agents-docs MCP 裁剪）+ #11d（deeplink scheme）+ #11r（网络层 craft 残留）全部确认完成：

- ✅ 10 个改造点全部清理（claude-agent.ts entry / SessionManager.ts / EditPopover / source-guides / storage / 4 处 Set / system.ts:650 / types.ts）
- ✅ `craftagents://` deeplink → `uagents://` 0 处字面量残留
- ✅ User-Agent `CraftAgents/` → `UAgents/` 全部清理（claude-oauth / claude-token / icon.ts）
- ✅ "blocked by Craft Agents" → "blocked by U Agents"（unified-network-interceptor）

---

## ⚠️ 已知保留项（已规划，不算 bug）

### M2 范围 — CLI 子系统

11-roadmap.md L257 明确记录"❌ CLI 改造（M2 或不做）"。涉及：

| 文件 | 涉及内容 |
|---|---|
| `apps/electron/resources/docs/craft-cli.md` | AI prompt 注入文档（**不是用户 UI 文档**，是给 AI bash tool 用的命令清单）|
| `packages/shared/src/config/cli-domains.ts` | 11 处 `'craft-agent'` 命令示例（quickExamples + help 字段）|
| `apps/electron/src/main/index.ts:150-161` | 7 处 CRAFT_* env vars（CRAFT_COMMANDS_DOC_PATH / CRAFT_CLI_DOC_PATH / CRAFT_AGENT_VERSION 等）|
| `packages/craft-cli/` | 整个包名 + 二进制名 `craft-agent` |

**真实风险**：用户在 chat 里 AI 调 bash 工具时**会**看到 `craft-agent label list` 等命令字面量。这是品牌泄漏点，但 11-roadmap M2 已知。

### M3 范围 — OAuth relay

`oauth-relay.ts:3` + `slack-oauth.ts:269,360` 仍指向 `agents.craft.do`。LEGAL.md §5.1 已记录为已知瑕疵，M3 自建 relay 后清除。

---

## 总评

| 维度 | 评级 | 状态 |
|---|---|---|
| 核心 U-API 改造代码 | A-（修 P0 后 A）| 1 个 P0 真 bug |
| 发版资源 | A | 完整可发 |
| MCP/deeplink/网络层 | A | 全部清理 |
| CLI 子系统（已知保留）| - | M2 范围 |
| OAuth relay（已知保留）| - | M3 范围 |

**总评：A-（发现 1 个 P0 待修，其余健康）**

---

## 下一步建议

### 🔴 P0 必修（hotfix v0.9.0+u-agents.1）

1. **修 state.ts:306**：把 `defaultConnectionSlug !== U_API_SLUG` 改为 `!isUApiSlug(defaultConnectionSlug)`，并加 import

### 🟡 P2 优化（非阻塞）

2. `storage.ts` enforceUApiBaseUrl 加 warning 日志（丢弃非 U-API connection 时）
3. `package.json` 6 处 CRAFT_* 开发 env vars → U_AGENTS_*

### 🔵 已规划保留（M2/M3）

4. CLI 子系统改造（11-roadmap M2 决议保留）
5. OAuth relay 自建（11-roadmap M3）
