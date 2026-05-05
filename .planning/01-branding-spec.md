# 01 — 品牌替换全表

> 每次和上游同步后，按本表跑一遍即可恢复白标状态。
> AI 修改任何品牌相关代码前必读。

---

## 1. 品牌四件套（最终值）

| 标识 | 值 |
|---|---|
| **英文产品名** | `U Agents` |
| **中文产品名** | `优智体` |
| **LLM 中转品牌名（UI 显示）** | `U-API` |
| **Bundle ID** | `cn.u-studio.u-agents` |
| **NPM scope** | `@u-agents/...`（替代 `@craft-agent/...`） |
| **版权年份** | `Copyright © 2026 U Studio` |
| **主域**（官网 + 分享 + 文档）| `https://u-agents.u-studio.cn` |
|   ┝ 官网首页 | `https://u-agents.u-studio.cn` |
|   ┝ 会话分享 | `https://u-agents.u-studio.cn/s/{shareId}` ⚠️ **M3 才放开**（M1 隐藏所有分享 UI 入口，详见 `04-feature-cuts.md` §7）|
|   └ 文档 | `https://u-agents.u-studio.cn/docs/{path}` |
| **Electron 自动更新** | `https://update.u-agents.u-studio.cn`（subdomain）|
| **Token 中转站根域** | `https://token.u-studio.cn`（已存在）|
| **Token 控制台**（用户充值/查 token） | `https://token.u-studio.cn/console/token` |
| **OAuth Relay**（M3 自建后） | `https://u-agents.u-studio.cn/auth/callback`（路径形式，主域复用） |
| **支持邮箱** | `support@u-studio.cn` |
| **Co-Authored-By 邮箱** | `agents@u-studio.cn` |

> ⚠️ 域名规划只用 2 个 host：
> - `u-agents.u-studio.cn` —— 单域名多路径承载官网、分享、文档、（M3）OAuth 回调
> - `update.u-agents.u-studio.cn` —— 独立 subdomain 仅给 electron-updater 用，避免和官网静态资源缓存冲突
> M1 阶段除 `token.u-studio.cn` 已存在外，至少 `update.u-agents.u-studio.cn` 必须先建（否则首版本发布即破白标，详见 `LEGAL.md` §5.2）。`u-agents.u-studio.cn` 主域 M1 阶段可先放占位页。

---

## 2. 一级硬编码改造（含 M1 必改 / M3 推迟 / 注释级三类）

### 2.0 子节分级总览（执行前必读）

| § | 文件 | 等级 | M1 是否动 | 备注 |
|---|---|---|---|---|
| 2.1 | `electron-builder.yml` | 🔴 P0 | ✅ 必改 | productName / appId / publish.url 等 7 字段 |
| 2.2 | `apps/electron/resources/` 图标 | 🔴 P0 | ✅ 必改 | DMG/Dock 用户首先看到 |
| 2.3 | `branding.ts` | 🔴 P0 | ✅ 必改 | VIEWER_URL + CRAFT_LOGO（影响 OAuth 回调页可见 logo）|
| 2.4 | `auth/oauth-relay.ts` | 🟢 已知瑕疵 | ❌ M1 暂不改 | M3 自建 OAuth relay 后改（详见 LEGAL §5.1）|
| 2.5 | `auth/slack-oauth.ts` | 🟢 已知瑕疵 | ❌ M1 暂不改 | 同上 |
| 2.6 | `version/manifest.ts` | 🔴 P0 | ✅ 必改 | VERSIONS_URL 决定自动更新查询位置 |
| 2.7 | `auto-update.ts` 注释 | 🟢 P2 | ✅ 仅改注释 | 不影响运行，但要清品牌泄露 |
| 2.8 | `docs/doc-links.ts` | 🟡 P1 | ✅ 必改 | DOC_BASE_URL；M1 文档站 404 也无所谓但 URL 必须我们的 |
| 2.9 | `docs/source-guides.ts:176` | 🟢 P2 | ✅ 移除 craft key | 字典数据项 |
| 2.10 | `sources/builtin-sources.ts:47` | 🔴 P0 | ✅ 隐藏/禁用 | 内置 Source URL；上游同步详见 §4.1 |
| 2.11 | `agent/claude-agent.ts:852` | 🔴 P0 | ✅ 隐藏/禁用 | 内置 MCP server entry |
| 2.12 | `prompts/system.ts:570` | 🟡 P1 | ✅ 必改 | git commit Co-Authored-By 签名 |
| 2.13 | `validation/url-validator.ts` | 🟡 P1 | ✅ 禁用专用路径 | AI prompt 型 craft MCP URL 专用校验；通用 URL safety 在其他文件，详见 §4.2 |
| 2.13b | `utils/toolNames.ts` / `docs/source-guides.ts` / `sources/storage.ts` | 🔴 P0 | ✅ 必改 | craft-agents-docs 工具名、AI 引导和 builtin source 注入路径 |
| 2.14a | `apps/electron/scripts/afterPack.cjs` | 🟡 **P0/P1 之间** | ✅ 必改 | silent failure，不阻塞但影响 macOS 26+ icon |
| 2.14b | `scripts/build/darwin.ts` | 🚦 M1 非阻塞 / M2 阻塞 | ❌ M1 不动 | server build 路径，M2 才触发 |
| 2.14 | `session-mcp-server/src/index.ts` | 🔴 P0 | ✅ 完全禁用运行路径 | docs upstream proxy 整条路径（`DOCS_MCP_URL` / `connectDocsUpstream()` / `docsTools` / `callDocsUpstream(...)`）|
| 2.15 | `paths.ts` 主声明 + **20+ 处硬编码**（动态扩张中，详见 §2.15 全表 - Round 47 A1 修正）| 🔴 P0 | ✅ 必改 | 配置目录改名（用户可见）|

> **行动指引**：执行 AI 应当先做 🔴 P0，再做 🟡 P1，最后做 🟢 P2/已知瑕疵的处理（多数是"不改"或"仅改注释"）。🚦 M2 阻塞项**M1 阶段绝不要碰**——会扩大改动范围且增加上游同步冲突。

---

### 2.1 `apps/electron/electron-builder.yml`

| 行 | 字段 | 当前值 | 改为 |
|---|---|---|---|
| 1 | `appId` | `com.lukilabs.craft-agent` | `cn.u-studio.u-agents` |
| 2 | `productName` | `Craft Agents` | `U Agents` |
| 3 | `copyright` | `Copyright © 2026 Craft Docs Ltd.` | `Copyright © 2026 U Studio. Original work © Craft Docs Ltd.` （**Apache §4(c) 合规**：派生作品保留原 author 署名 + 加 U Studio）|
| 83 | `publish.url` | `https://agents.craft.do/electron/latest` | `https://update.u-agents.u-studio.cn/latest` |
| 133, 141, 166, 219 | `artifactName` | `Craft-Agents-${arch}.${ext}` | `U-Agents-${arch}.${ext}` |
| 147 | `dmg.title` | `"Craft Agents"` | `"U Agents"` |
| 214 | `linux.maintainer` | `"Craft Docs Ltd. <support@craft.do>"` | `"U Studio <support@u-studio.cn>"` |

### 2.2 `apps/electron/resources/`（图标 + 静态资源 + craft-agent CLI）

> ✅ **2026-05-04 完成状态**（M1 v0.9.x icon swap）：图标资源已全部替换为 U Agents 紫色 `#7C3AED` glyph，源文件 `/Users/dengwang/Pictures/u-agents-logo/` 由用户提供（含 .icns / .ico / .png / .svg / iconset / 1024 高清源 / 2048 设计源 / Liquid Glass `Assets.car` 编译产物）。Liquid Glass 选 **方案 (b)**：用 user 提供的 `Assets.car`（148 KB，已编译 macOS 26+ 多分辨率）。详见 commit message。

| 文件 | 处理 | 状态 |
|---|---|---|
| `icon.icns`（macOS）| 替换为 U Agents 的 icns | ✅ 已替换（223 KB，2026-05-04）|
| `icon.ico`（Windows）| 替换为 U Agents 的 ico | ✅ 已替换（109 KB，2026-05-04）|
| `icon.png`（Linux）| 替换为 U Agents 的 png | ✅ 已替换（512×512，2026-05-04）|
| `icon.svg` | 替换为 U Agents 的 svg | ✅ 已替换（24×24 viewBox，紫色 `#7C3AED`，含 90° 旋转，2026-05-04）|
| `Assets.car` | 替换为 U Agents Liquid Glass 编译产物 | ✅ 已替换（148 KB，2026-05-04，user 提供）|
| `icon.icon/` 源目录 | Apple Icon Composer 源；既然 user 给了编译后 `Assets.car`，源目录用不到了 | ✅ 已删除（2026-05-04）|
| `craft-logos/` 整个目录（含 4 个 PNG: `craft_logo_white.png` / `craft_logo_black.png` / `craft_app_icon.png` / `craft_app_icon_dark.png`）| 0 处运行时引用，上游 leftover | ✅ 已删除（2026-05-04，方案 ③）|
| `afterPack.cjs` | 行 29 `'Craft Agents.app'` → `'U Agents.app'`（roadmap #2.14a silent bug）| ✅ 已修复（commit `35444566` chore: branding replacements and i18n cleanup）|
| `generate-icons.sh` | 改写为基于新 SVG 生成各平台图标 |
| `bin/craft-agent` + `craft-agent.cmd` | **M1 保留不改**（craftAgentsCli feature flag 默认 false，脚本不被激活；改名增加同步成本，无收益）|
| `tool-icons/craft-agent.svg` | **M1 保留不改**（craft-agent CLI 工具 icon，仅在 craftAgentsCli flag 开启时显示）|
| `tool-icons/tool-icons.json` | **Round 40 补遗**：默认 entry `{ "id": "craft-agent", "displayName": "Craft Agent", "icon": "craft-agent.svg", "commands": ["craft-agent"] }` 可能被 Tool Icons 设置页/AI docs 暴露。M1 必须二选一：① 若 craftAgentsCli 功能仍隐藏，删除该 entry（推荐，避免 UI 出现 Craft Agent）；② 若保留 entry，则 `displayName` 改 `U Agents CLI`，但 `commands: ["craft-agent"]` 需与 `bin/craft-agent` 保留决策一致并明确是内部命令名 |
| `docs/craft-cli.md` | **M1 保留不改**（craft-agent CLI 内置文档，与 craftAgentsCli flag 联动）|

> ⚠️ **bin/craft-agent 脚本内容**：含 `CRAFT_BUN` / `CRAFT_COMMANDS_ENTRY` / `CRAFT_CLI_ENTRY` / `CRAFT_CLI_JSON_ONLY` 4 个 CRAFT_* 环境变量——这些是上游 craft-agent CLI 启动包装，与 §2.15 决策"保留 CRAFT_* 开发期变量不改"一致。

> 用户**解 .app 看 Resources/bin/** 能看到 `craft-agent` 命令名——属于"asar: false"已知瑕疵范畴（详见 `LEGAL.md` §5.4），M1 接受。

> 准备一个 1024×1024 的 U Agents 主 logo SVG，再用 `generate-icons.sh` 一次性生成全套。

### 2.3 `packages/shared/src/branding.ts`

```typescript
// 当前
export const VIEWER_URL = 'https://agents.craft.do';

// 改为（分享走主域 /s/xxx 路径）
export const VIEWER_URL = 'https://u-agents.u-studio.cn';

// ⚠️ M1 阶段说明：
// 我们仍把 VIEWER_URL **防御性**改为我们的主域，但所有会话分享 UI 入口
// 在 M1 阶段被隐藏（详见 `04-feature-cuts.md` §7）。
// `https://u-agents.u-studio.cn/s/{shareId}` 路径要等到 M3 自建 viewer
// 后才对用户开放。
// 改 VIEWER_URL 的目的是防御性 —— 万一上游加新代码路径误用 VIEWER_URL，
// 也不会暴露 craft.do 字样。

// CRAFT_LOGO 的 ASCII art 直接换成 U AGENTS 字样的 ASCII art（或先简单替换为 U_AGENTS_LOGO）
export const U_AGENTS_LOGO = [
  '...',  // 待设计
] as const;
export const CRAFT_LOGO = U_AGENTS_LOGO;  // 暂时保留旧名作为别名，避免大量调用点修改
```

### 2.4 `packages/shared/src/auth/oauth-relay.ts`

```typescript
// 当前
export const OAUTH_RELAY_CALLBACK_URL = 'https://agents.craft.do/auth/callback';
```

**M1 决策**：暂不改。详见 `LEGAL.md` §5.1 已知瑕疵。
**M3 决策**：改为 `https://u-agents.u-studio.cn/auth/callback`（路径形式复用主域）。

### 2.5 `packages/shared/src/auth/slack-oauth.ts`

第 269、359、360 行的 `https://agents.craft.do/auth/slack/callback?port=...`

**M1 决策**：同上，暂不改。
**M3 决策**：替换为 `https://u-agents.u-studio.cn/auth/slack/callback?port=...`

### 2.6 `packages/shared/src/version/manifest.ts`

```typescript
// 当前
const VERSIONS_URL = 'https://agents.craft.do/electron';
// 改为
const VERSIONS_URL = 'https://update.u-agents.u-studio.cn';
```

> **Round 44 补遗**：这里不是 `electron-updater` 的 `publish.url`，而是独立版本 manifest 查询入口（会继续请求 `/latest`、`/{version}/manifest.json` 等 JSON）。因此必须与 `electron-builder.yml publish.url`、`06-update-server.md` 的静态目录一起改；只改 `publish.url` 仍会让运行时打到 `agents.craft.do/electron`。

### 2.7 `apps/electron/src/main/auto-update.ts`

第 5 行注释中的 `https://agents.craft.do/electron/latest` → 改为我们的更新源 URL。
auto-update 实际地址由 `electron-builder.yml` 的 `publish.url` 注入，但**注释和日志**也要改，避免泄露。

### 2.8 `packages/shared/src/docs/doc-links.ts`

```typescript
// 当前
const DOC_BASE_URL = 'https://agents.craft.do/docs'
// 改为
const DOC_BASE_URL = 'https://u-agents.u-studio.cn/docs'
```

### 2.9 `packages/shared/src/docs/source-guides.ts:176`

```typescript
// 当前
craft: 'craft.do',
```
**操作**（与 `04-feature-cuts.md` §4.3 同口径）：从字典中**移除 `craft` key**——这是单一数据项，移除一个 key 比删整个文件低风险，且对 U Agents 用户没有意义。

### 2.10 `packages/shared/src/sources/builtin-sources.ts`

**当前代码事实**：`getBuiltinSources()` 已返回空数组，`isBuiltinSource()` 已恒为 `false`；`getDocsSource()` 只是 deprecated placeholder，正常运行不会把 `craft-agents-docs` 塞回 Sources 列表。

**M1 仍需清理**：placeholder 里的 `id: 'builtin-craft-agents-docs'` / `name: 'Craft Agents Docs'` / `slug: 'craft-agents-docs'` / `url: 'https://agents.craft.do/docs/mcp'` 仍是品牌和上游 URL 残留。M1 完全裁剪：不替换为自建 URL、不保留 slug/name/tool 白名单；若保留函数作兼容死代码，必须中性化字段并确保 `isBuiltinSource()` 继续返回 `false`。

### 2.11 `packages/shared/src/agent/claude-agent.ts:852`

同属 `craft-agents-docs` MCP 裁剪范围：M1 不把它替换成 `u-agents` docs MCP，而是从 agent servers 字典、system prompt 引导和工具说明中完全移除该内置 server。详见 `04-feature-cuts.md` §4.1。

### 2.12 `packages/shared/src/prompts/system.ts` —— **system prompt 28 处 craft 字面量**（**P0 AI 身份污染**）

⚠️ **不只是 :570 Co-Authored-By 一处**——system prompt 含 28 处 craft 字面量，让 AI **自称 "Craft Agent"**：用户问 "你是谁" → AI 回答 "I'm Craft Agent"。

**必改的关键位置**：

| 行号 | 当前 | 改为 |
|---|---|---|
| L313 | `You are a focused assistant for quick configuration edits in **Craft Agent**.` | `... in **U Agents**.` |
| L430-439 | XML marker `<craft_agent_environment ...>` | `<u_agents_environment ...>`（M1 用户群不从 Claude Code 导入，改名安全；M2/M3 如要兼容旧 sessions，加 fallback 识别）|
| L467 | `You are **Craft Agent** - an AI assistant ...` | `You are **U Agents** - an AI assistant ...` |
| L470 | `... integrate Linear, GitHub, **Craft**, custom APIs ...` | `... integrate Linear, GitHub, custom APIs ...`（删除 "Craft"——它是 craft.do 自家产品名，与我们无关）|
| L570 | `Co-Authored-By: Craft Agent <agents-noreply@craft.do>` | `Co-Authored-By: U Agents <agents@u-studio.cn>` |

**保留不改**（内部命名空间，不影响用户）：
- `function getCraftAssistantPrompt()` / `getCraftAgentEnvironmentMarker()` —— 函数名（同步友好）
- `CRAFT_AGENT_*` 类内部变量名

**批量替换命令**（**先 review 再跑**，因为 AI 身份语句精度高）：

```bash
# 先全量列出需 review 的 craft 字面量
grep -nE "Craft|craft" packages/shared/src/prompts/system.ts | grep -v "function get\|^ \* "

# 然后按上表逐项手动改（不要 sed 全替换，会把函数名等误改）
```

**为什么 §1.4 + §1.5 + §2.0 都没列这点**：前 27 轮所有 review **完全漏过** system prompt 内文本——这是用户最高频感知的"AI 自我认知"，必须修。

### 2.13 `packages/shared/src/validation/url-validator.ts`

第 27-37 行包含对 `mcp.craft.do/links/...` 的硬编码校验和示例。

**代码事实修正**：这个文件当前更偏向“AI prompt / Craft MCP 链接格式专用校验”，不是全局 URL safety 防线；通用 URL 安全（协议、subdomain attack、credentials in URL 等）主要在 `packages/shared/src/utils/url-safety.ts` 等其他路径。执行 AI 不能因为本文提到“URL 校验”就误删通用 safety 代码。

**操作**（与 `04-feature-cuts.md` §4.2 同口径）：
- **首选**：禁用 `mcp.craft.do` 专用校验路径（直接 `return null` 或 `if (false)` 包住），不删函数本身
- **必须保留**：`url-safety.ts` / auth callback / deeplink handler 中的通用 URL 安全逻辑；那些不是 Craft MCP 专用逻辑
- **末选**：如确认此函数没有任何通用安全职责，才删除 craft-mcp 专用函数及其调用点；删除前**单独开任务确认**
- 文档/JSDoc 注释中所有 `mcp.craft.do` 示例改为通用示例（如 `mcp.example.com`）

### 2.13b `craft-agents-docs` 运行路径补齐（M1 完全裁剪）

除 §2.10 `builtin-sources.ts` 与 §2.11 `claude-agent.ts` 外，实际运行路径还包括：

| 文件 | 必处理内容 |
|---|---|
| `packages/shared/src/utils/toolNames.ts` | 删除或中性化 `SearchCraftAgents` → `Search Documentation` 的工具显示名映射；M1 不应暴露 Craft docs 工具 |
| `packages/shared/src/docs/source-guides.ts` | 删除 `mcp__craft-agents-docs__SearchCraftAgents(...)` 示例和“Use the craft-agents-docs MCP server...” 引导 |
| `packages/shared/src/sources/storage.ts` | 当前 `isBuiltinSource()` 恒为 false，所以不会实际注入；但 `getSourcesBySlugs()` / `loadAllSources()` 的注释和 `if (slug === 'craft-agents-docs') getDocsSource(...)` 死分支仍含旧品牌，需删除或中性化，避免上游同步时误复活 |
| `packages/session-mcp-server/src/index.ts` | 不只是删 `DOCS_MCP_URL` 常量，而是禁用 `connectDocsUpstream()`、`docsTools` 合并进 `ListTools`、`isDocsUpstreamTool(name)` 分流和 `callDocsUpstream(...)` 代理整条路径 |
| `SessionManager.ts` / mode-manager / source-manager / pre-tool-use / prerequisite-manager | 删除 `craft-agents-docs` 的显示名映射、隐藏白名单、豁免和 prerequisite 分支 |

验收：`grep -rn "craft-agents-docs\|SearchCraftAgents\|mcp__craft-agents-docs__\|connectDocsUpstream\|docsTools\|callDocsUpstream" packages apps` 应为 0；若保留 dead code 作同步锚点，必须有 `/* U-API START */` 标记说明且不得进入工具列表、Source 列表、session MCP proxy 或 AI prompt。

### 2.14a `apps/electron/scripts/afterPack.cjs` 硬编码 `'Craft Agents.app'`

> 🚦 **等级标记**：**P0/P1 之间**（silent failure，不阻塞 M1 流程，但影响 macOS 26+ 用户的 dock icon 体验）
> 🔴 仍**必须修**——理由：silent failure 比报错更危险，因为用户/外部 AI 不会注意到 icon 没生效。改一处、零成本，不修没理由。

**位置**：`apps/electron/scripts/afterPack.cjs:29`
```javascript
const resourcesDir = path.join(appPath, 'Craft Agents.app', 'Contents', 'Resources');
```

**问题**：
- 这是 electron-builder 的 `afterPack` hook，在 macOS 打包时会自动跑
- 改 `electron-builder.yml` `productName: U Agents` 后，实际产物是 `'U Agents.app'`，但 hook 找的是 `'Craft Agents.app'`——**找不到目录**
- afterPack 的代码只 `console.log` warning 后 `return`，**不**抛错——所以打包"成功"但 Liquid Glass icon 没拷进去
- M1 影响：macOS 26+ 用户的 dock icon 会回退到 fallback `.icns`

**操作**：
- 把 `'Craft Agents.app'` 字面量改为从 `electron-builder.yml` 读取的 productName，或硬编码改为 `'U Agents.app'`
- **首选**（更稳）：改为从 `context.packager.appInfo.productFilename` 读取，避免再硬编码：
  ```javascript
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const resourcesDir = path.join(appPath, appName, 'Contents', 'Resources');
  ```
  这样上游同步如果再改名也不会破。

### 2.14b `scripts/build/darwin.ts` 硬编码 `'Craft Agents.app'` / `'Craft-Agents-*.dmg'`

> 🚦 **等级标记**：**M1 非阻塞**（`electron:dist:adhoc:mac` 不走这条路径）/ **M2 阻塞**（server build / 完整 build orchestration 触发）
> 🚫 **M1 阶段不要为它扩大改动范围**——M1 只用 adhoc 脚本，不需要碰 server build。把它登记到 M2 任务清单即可。

**位置**：`scripts/build/darwin.ts:66, 72, 73`
```typescript
const appPath = join(electronDir, 'release', macDir, 'Craft Agents.app');
// ...
const dmgName = `Craft-Agents-${arch}.dmg`;
const zipName = `Craft-Agents-${arch}.zip`;
```

**问题**：
- 这是 server build 路径（`bun run server:build:darwin-arm64`）
- M1 用 `electron:dist:adhoc:mac` **不会触发** ✓
- M2 / M3 阶段如果跑 server build 或扩展打包路径，**会因找不到产物文件而 throw**

**操作**：
- M1 阶段**不修**（不触发，避免引入额外冲突点）
- 在 `08-conflict-zones.md` §🟡 表中标记此文件为"含上游硬编码 productName，M2 触发时统一改"
- M2 阶段切换到完整 build 路径前，把 3 处硬编码改为：
  ```typescript
  const appPath = join(electronDir, 'release', macDir, 'U Agents.app');
  const dmgName = `U-Agents-${arch}.dmg`;
  const zipName = `U-Agents-${arch}.zip`;
  ```

### 2.14 `packages/session-mcp-server/src/index.ts` docs upstream proxy

**实际风险**：这里不是单个 URL 常量问题，而是一整条上游 docs MCP proxy 运行路径：`DOCS_MCP_URL`、`connectDocsUpstream()`、`docsTools` 合并进 `ListTools`、`isDocsUpstreamTool(name)` 分流、`callDocsUpstream(...)` 代理。只改 URL 或只删常量会留下“UI 看不到但 session MCP server 仍可调用 Craft docs 工具”的隐蔽泄露。

**操作**（与 `04-feature-cuts.md` §4.1 同口径）：
- **M1 必选**：禁用整条 docs upstream proxy 运行路径，不连接 `agents.craft.do/docs/mcp`，不把 docs tools 合并进工具列表，不代理 docs tool call
- **不做**：M1 不替换为自建 docs MCP；M3 自建文档站后再重新设计
- **同步友好**：如保留常量或函数作 dead code 锚点，必须标注 `/* U-API START */`，且不得进入运行路径

### 2.15 配置目录改名 `~/.craft-agent` → `~/.u-agents`（**新增**）

上游把所有用户配置/会话/工作空间持久化到 **`~/.craft-agent/`**——而不是 macOS 标准的 `~/Library/Application Support/`。这意味着白标必须改这个目录名，否则用户 `ls -la ~` 能直接看到 `.craft-agent`。

**主声明**（`packages/shared/src/config/paths.ts:19`）：

```typescript
// 当前
export const CONFIG_DIR = process.env.CRAFT_CONFIG_DIR || join(homedir(), '.craft-agent');
// 改为
export const CONFIG_DIR = process.env.U_AGENTS_CONFIG_DIR || join(homedir(), '.u-agents');
```

**同步要改的处**（一次性硬编码漏网，包含运行时和注释两类）：

| 位置 | 当前 | 改为 |
|---|---|---|
| **🔴 运行时** `packages/shared/src/interceptor-common.ts:30` | `export const CONFIG_FILE = join(homedir(), '.craft-agent', 'config.json');` | `import { CONFIG_DIR } from './config/paths.ts'; export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');` |
| **🔴 运行时** `packages/shared/src/interceptor-common.ts:39` | `export const LOG_DIR = join(homedir(), '.craft-agent', 'logs');` | `export const LOG_DIR = join(CONFIG_DIR, 'logs');` |
| **🔴 运行时** `packages/shared/src/interceptor-common.ts:174` | `return join(homedir(), '.craft-agent', 'api-error.json');` | `return join(CONFIG_DIR, 'api-error.json');` |
| **🔴 运行时** `apps/electron/src/main/logger.ts:84` | `export const messagingGatewayLogPath = join(homedir(), '.craft-agent', 'logs', 'messaging-gateway.log')` | `import { CONFIG_DIR } from '@u-agents/shared/config/paths'; export const messagingGatewayLogPath = join(CONFIG_DIR, 'logs', 'messaging-gateway.log')` |
| **🔴 运行时** `packages/server/src/index.ts:213` | `join(homedir(), '.craft-agent', 'workspaces', wsId, 'messaging')` | `join(CONFIG_DIR, 'workspaces', wsId, 'messaging')`（导入 CONFIG_DIR）|
| **🔴 运行时** `packages/shared/src/agent/permissions-config.ts:49` | `const configDir = process.env.CRAFT_CONFIG_DIR \|\| join(homedir(), '.craft-agent');` | `import { CONFIG_DIR } from '../config/paths.ts'; const configDir = CONFIG_DIR;` —— **这是与 paths.ts 独立的第二个 CONFIG_DIR 派生**，不改会让 `~/.u-agents/` vs `~/.craft-agent/permissions/` 数据分裂 |
| 🟡 注释 `packages/shared/src/config/theme.ts:8-9` | 2 处 `~/.craft-agent/theme.json` / `~/.craft-agent/themes/*.json` | 改为 `~/.u-agents/...` |
| 🟡 注释 `packages/shared/src/config/watcher.ts:8-12, 134, 984, 1013` | 6 处 `~/.craft-agent/...` 路径示例 | 改为 `~/.u-agents/...` |
| 🟡 注释 `packages/shared/src/config/storage.ts:160, 212` | 2 处 `~/.craft-agent/config-defaults.json` / `~/.craft-agent/docs/` | 改为 `~/.u-agents/...` |
| 🟡 注释 `packages/shared/src/agent/permissions-config.ts:8-9, 45, 185, 579, 584` | 5 处 `~/.craft-agent/workspaces/...` / `~/.craft-agent/permissions/...` | 改为 `~/.u-agents/...` |
| **🔴 运行时** `scripts/electron-dev.ts:91, 93, 287` | `process.env.CRAFT_CONFIG_DIR` / `.craft-agent-${instanceNum}` | `process.env.U_AGENTS_CONFIG_DIR` / `.u-agents-${instanceNum}` |
| 🟡 正则 `packages/ui/src/components/chat/UserMessageBubble.tsx:173, 176` | 正则与注释中的 `.craft-agent` | 改为 `.u-agents` |
| 🟡 注释 `packages/session-tools-core/src/context.ts:159, 296` | 注释路径示例 | 改为 `.u-agents` |
| 🟡 注释 `packages/session-tools-core/src/templates/loader.ts:97` | 注释路径示例 | 改为 `.u-agents` |
| 🟡 文案 `packages/session-tools-core/src/handlers/mermaid-validate.ts:56` | 错误提示文案"Check the syntax against ~/.craft-agent/docs/mermaid.md" | 改为 `~/.u-agents/...` |
| 🟡 注释 `packages/shared/src/config/storage.ts` 中 `initializeDocs` 注释 | "creates ~/.craft-agent/docs/" | 改为 `~/.u-agents/docs/` |
| 🟡 文档 `README.md`（M2 重写时一并替换）| 多处 | 同上 |
| **🔴 Round 35 NNNN 补遗 - renderer 路径** `apps/electron/src/renderer/components/workspace/AddWorkspaceStep_CreateNew.tsx:26, 47` | 注释 + 运行时 `${homeDir}/.craft-agent/workspaces` | 注释改注释；L47 改为从 CONFIG_DIR 派生（renderer 通过 IPC 拿 homeDir，路径 join 字面量改 `.u-agents`）|
| **🔴 Round 35 NNNN 补遗** `apps/electron/src/renderer/components/workspace/AddWorkspaceStep_ConnectRemote.tsx:53, 150, 207` | L53 注释 "remote Craft Agent Server"；L150 运行时 `${homeDir}/.craft-agent/workspaces`；L207 用户可见文案 "Connect to a remote Craft Agent Server for this workspace." | L53 注释改 "remote U Agents Server"；L150 同 AddWorkspaceStep_CreateNew 处理；**L207 用户可见文案改 "Connect to a remote U Agents Server for this workspace."** |
| **🔴 Round 35 NNNN 补遗** `apps/electron/src/renderer/pages/PreferencesPage.tsx:4, 190` + `pages/settings/PreferencesPage.tsx:4` | 注释 + 运行时 `~/.craft-agent/preferences.json` | 改 `~/.u-agents/preferences.json` |
| **🔴 Round 35 NNNN 补遗** `apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:191` | 运行时 `${homeDir}/.craft-agent/tool-icons/tool-icons.json` | 改 `.u-agents` |
| **🔴 Round 35 NNNN 补遗** `apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:5, 8, 40, 144` | 4 处注释 `~/.craft-agent/permissions/default.json` | 改 `~/.u-agents/permissions/default.json` |
| **🔴 Round 35 PPPP 补遗** `packages/server-core/src/handlers/rpc/workspace.ts:63` | 运行时 `join(homedir(), '.craft-agent', 'workspaces')` | 改为从 CONFIG_DIR 派生：`join(CONFIG_DIR, 'workspaces')` |
| 🟡 注释 `packages/server-core/src/sessions/SessionManager.ts:510, 644, 1500, 3270, 5171, 6248, 6345, 6368, 6676` | 9 处注释含 craft / CraftAgent / `~/.craft-agent` | 注释改 `.u-agents` / `U Agents` |
| **🔴 Round 37 VVVV 补遗 - 第 3 个独立 CONFIG_DIR** `apps/electron/src/main/window-state.ts:32` | `const CONFIG_DIR = join(homedir(), '.craft-agent')` —— **window state 文件目录的独立派生**！前 28 轮已知 paths.ts:19 主声明 + permissions-config.ts:49 第 2 处，此为**第 3 处独立硬编码** | 改为从 `paths.ts` 导入：`import { CONFIG_DIR } from '@u-agents/shared/config/paths'`；**不改会导致窗口状态文件 (`window-state.json`) 写到老路径 `~/.craft-agent/`，新启动时读取 default 状态重置位置/大小** —— 用户体验明显异常 |
| **🔴 Round 37 UUUU 补遗 - 独立审计日志路径** `packages/server-core/src/services/privileged-execution-broker.ts:25` | `const AUDIT_LOG_PATH = join(homedir(), '.craft-agent', 'logs', 'privileged-actions.jsonl')` —— **审计日志独立路径**，不走 logger.ts | 改为从 `CONFIG_DIR` 派生：`import { CONFIG_DIR } from '@u-agents/shared/config/paths'; const AUDIT_LOG_PATH = join(CONFIG_DIR, 'logs', 'privileged-actions.jsonl')`；不改导致审计日志写到老路径，**安全审计员查不到** |
| **🔴 Round 38 YYYY 补遗 - logout/reset 删除旧配置路径** `packages/server-core/src/handlers/rpc/auth.ts:62` | `const configPath = join(homedir(), '.craft-agent', 'config.json')` —— logout/reset 仍删除旧路径配置 | 改为从 `CONFIG_DIR` 派生：`const configPath = join(CONFIG_DIR, 'config.json')`；不改会导致 M1 改成 `~/.u-agents` 后，用户点击退出/重置只清理旧 `~/.craft-agent/config.json`，真实配置仍残留 |
| **🔴 Round 39 补遗 - workspace storage 第 4 个独立 CONFIG_DIR** `packages/shared/src/workspaces/storage.ts:35-36` | `const CONFIG_DIR = join(homedir(), '.craft-agent'); const DEFAULT_WORKSPACES_DIR = join(CONFIG_DIR, 'workspaces');` | 改为复用 `packages/shared/src/config/paths.ts` 的 `CONFIG_DIR`；不改会导致 `getDefaultWorkspacesDir()` / `ensureDefaultWorkspacesDir()` / `getWorkspacePath()` 继续创建 `~/.craft-agent/workspaces`，与 renderer/server-core 的新路径分裂 |
| **🔴 Round 39 补遗 - credentials.enc 存储路径** `packages/shared/src/credentials/backends/secure-storage.ts:44-45` | `const CREDENTIALS_DIR = join(homedir(), '.craft-agent'); const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.enc');` | 只改文件目录为 `CONFIG_DIR` / `~/.u-agents/credentials.enc`；**保留** L48 `MAGIC_BYTES = Buffer.from('CRAFT01\0')`（见下方“故意保留”），不改会导致 Token 凭据仍写旧目录，onboarding/auth 状态与 config 目录分裂 |
| **🔴 Round 39 补遗 - packaged bridge MCP resource 硬编码路径** `apps/electron/resources/bridge-mcp-server/index.js:17922` | `return join(homedir(), ".craft-agent", "workspaces", workspaceId, "sources", sourceSlug, ".credential-cache.json");` | 打包资源里的运行时代码也必须同步到 `~/.u-agents/workspaces/...` 或从桥接服务可用的统一配置目录派生；不改会绕过 TS 源码改造，导致 Source credential cache 写旧路径 |
| **🔴 Round 42 补遗 - release notes 第 9 个独立 CONFIG_DIR** `packages/shared/src/release-notes/index.ts:16` | `const CONFIG_DIR = join(homedir(), '.craft-agent');` | 改为复用 `packages/shared/src/config/paths.ts` 的 `CONFIG_DIR`；不改会导致 What's New / Release Notes 继续同步到 `~/.craft-agent/release-notes/`，即使主配置目录已迁到 `~/.u-agents` 也会新建旧目录 |

**🔴 强制规则**：**任何运行时代码**需要读 config / log / error file / 工作区路径，**必须**从 `CONFIG_DIR` 常量派生（`packages/shared/src/config/paths.ts:19` 导出），**禁止**再手写 `join(homedir(), '.craft-agent', ...)` 或 `join(homedir(), '.u-agents', ...)`。

⚠️ **CONFIG_DIR 跨 package 导入的前置改造**（M1 必做）：

`packages/shared/src/config/index.ts` 当前 **没** `export * from './paths.ts'`——这意味着：

| 导入场景 | 当前可行性 | 改造后可行性 |
|---|---|---|
| **同 package 内**（如 `interceptor-common.ts`）| ✅ 可用相对路径 `import { CONFIG_DIR } from './config/paths.ts'` | 同上 |
| **跨 package**（如 `apps/electron/.../logger.ts` / `packages/server/src/index.ts`）| ❌ `import { CONFIG_DIR } from '@u-agents/shared/config'` 会失败（没 re-export） | ✅ 改造后可用 |

**前置改造**（必须先做，否则 logger.ts:84 + server/index.ts:213 改造无法编译）：

在 `packages/shared/src/config/index.ts` **追加**一行：

```typescript
// U-API: 让 CONFIG_DIR / paths 跨 package 可导入（M1 用于 logger.ts / server/index.ts 等）
export * from './paths.ts';
```

或更精确（推荐，避免无关 export）：

```typescript
// U-API: 让 CONFIG_DIR 跨 package 可导入
export { CONFIG_DIR } from './paths.ts';
```

**核实**：改造后 `import { CONFIG_DIR } from '@u-agents/shared/config'` 能跨 package 解析。

每次同步上游必须 grep 验证：

```bash
# 应仅返回 paths.ts:19 一处定义；其他所有运行时代码都从 CONFIG_DIR 派生
# 注意必须包含 .js：apps/electron/resources/bridge-mcp-server/index.js 是打包资源运行时代码
grep -rnE "homedir\(\)\s*,\s*['\"]\.u?-?(craft|agents)" packages apps scripts \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  | grep -v node_modules | grep -v __tests__
```

**测试代码**（`__tests__/*.ts` 中的 `.craft-agent` 路径示例）：普通无关 fixture 可保留；但凡断言 M1 改造逻辑、路径迁移、deeplink、OAuth callback、URL safety、shared auth/source 行为的 fixture 必须同步改为 `~/.u-agents` / `uagents://` / 中性 mock 域，详见 §2.23 与 `11-roadmap.md` #24d。

**用户数据迁移**：U Agents 用户群假定**从未**装过上游 craft-agents-oss，因此**不需要**写从 `~/.craft-agent/` → `~/.u-agents/` 的迁移逻辑。如果某个早期种子用户恰好两个都装过（极少），手动 `mv` 即可。

**故意保留不改的品牌点**：

| 位置 | 内容 | 为什么不改 |
|---|---|---|
| `packages/shared/src/credentials/backends/secure-storage.ts:48` | `MAGIC_BYTES = Buffer.from('CRAFT01\0')` | 这是 `credentials.enc` 文件的 magic header，改了会让既有文件无法解密（用户必须重新登录）；用户无法看到此二进制内容（`hexdump` 才看得到），不构成品牌泄露 |
| `CRAFT_*` 环境变量分层处理 | runtime 用户可见/env 模板/server/CLI 分开 | M1 必改 runtime 用户路径相关变量（如 `CRAFT_CONFIG_DIR`、`CRAFT_APP_NAME`、`CRAFT_DEEPLINK_SCHEME`、`CRAFT_IS_PACKAGED`、`CRAFT_RESOURCES_BASE`、`CRAFT_APP_ROOT`、`CRAFT_UV/NODE/BUN`）与 `.env.example` 中 `CRAFT_MCP_*` / 第三方 Sentry 示例；server/WebUI/CLI wrapper 内部或 M1 不发布范围的 `CRAFT_*` 可暂保留，但必须在发版说明标注“不发布范围”。不要再笼统写“全部不改”或“全部 9 个”。 |
| `craft-shared` ESLint plugin 命名空间（`packages/shared/eslint.config.mjs:37` 等 3 处）| 配置内部命名空间，**不**是 NPM 包名（不影响导入解析）| 用户不会看到 lint 输出；改成 `u-shared` 收益极低，且每次同步上游需手动维护——**M1 不改**，M2/M3 评估 |
| `MODEL_REGISTRY` / `RECOVERY_DEFAULTS` 等内部数据常量 | 上游 LLM 数据字典 | 与 `enforceUApiBaseUrl` 完全隔离，用户看不到 |

**与上游同步时**：本节列的所有位置都是 🔴 高冲突文件（`08-conflict-zones.md` §1）的延伸。每次同步后必须用 `grep -rn "\.craft-agent" packages apps scripts --include='*.ts' --include='*.tsx'` 验证无残留。

⚠️ **上游 ESLint 自定义规则同步审查**（M2+ 阶段每次同步必跑）：

```bash
# 查看上游 packages/shared/eslint-rules/ 是否新增规则
ls packages/shared/eslint-rules/

# 当前已知 2 条（M1 改造已满足，无需调整）：
# - no-direct-open-import: 禁止 import 'open'，必须用 utils/open-url.ts
# - no-inline-source-auth-check: 禁止内联 source.config.isAuthenticated 检查

# 若新增规则，必须 review 我们的改造代码是否触发；触发时需调整改造方式（不要 disable 规则）
```

### 2.16 `packages/shared/src/auth/callback-page.ts` —— **OAuth 回调页 HTML**（**P0 用户可见**）

**代码事实**：
- L46 `<title>Craft - ${title}</title>` —— 用户 OAuth 完成后浏览器**标题栏**
- L178 `<a href="${deeplinkUrl}" class="return-link">**Craft Agents**</a>` —— "返回 App" 链接文字

**用户场景**：用户 onboarding 添加 Slack/Gmail/Microsoft Source（已知瑕疵，详见 LEGAL §5.1）→ 浏览器跳转 craft.do/auth/callback → 完成授权 → **localhost 本地 callback 服务返回 HTML**（这是我们 fork 代码生成的）→ 用户**直接看到** "Craft" 字样。

**改造**：

```typescript
// L46
<title>U Agents - ${title}</title>

// L178
<a href="${deeplinkUrl}" class="return-link">U Agents</a>
```

> ⚠️ 本节与 §2.3 `branding.ts` 的 `CRAFT_LOGO_HTML` 改造**联动**——callback-page.ts 引用 CRAFT_LOGO_HTML 渲染 ASCII art logo。改 LOGO 时同步影响 callback 页面。

### 2.17 `apps/electron/resources/docs/` + permissions/tool-icons JSON —— **内置 docs 11 个文件 230+ 处 craft + 打包资源 JSON 残留**（**P1 AI 引用源 / UI 资源**）

> **Round 52 决策（C2）— `automations.md` 仍剩 46 处 `CRAFT_*` 协议变量名 M1 保留不改**：
> M1 主体改造完成后 grep 发现 `automations.md` 仍有 46 处 `$CRAFT_EVENT` / `$CRAFT_LABEL` / `$CRAFT_SESSION_ID` / `$CRAFT_WORKSPACE_ID` / `$CRAFT_WH_*` 等变量名残留。**这不是品牌词，是 webhook automation 系统注入到用户 shell command 的协议变量名**——属于"上游运行时协议"而非"品牌字面量"。
>
> **M1 决策保留理由**：① 改名要同步 docs + automation 系统源码（注入逻辑）+ 用户老 config migration 三方动手；② M1 用户群是新装机本来无影响，但 M2/M3 用户升级会破坏已配置 webhook automation；③ 与上游协议保持一致便于跟随上游 release tag（C1 决策一致）。
>
> **M1 必加文档说明**：在 `automations.md` 顶部加一节"为什么变量名仍是 `CRAFT_*`：上游协议沿用，不影响功能"。
>
> **M2/M3 评估**：如做白标深化，可考虑双名兼容（系统同时注入 `CRAFT_EVENT` 和 `U_AGENTS_EVENT`，docs 用 `U_AGENTS_*`），用户老 webhook 不破坏。
>
> **记入 LEGAL §5 已知瑕疵**：M1 解 .app 翻 docs 看到 `CRAFT_*` 变量名，与 `craft-cli.md 135 处保留`、`craftAgentsCli flag` 决策一致。

**问题**：AI 工作时主动 read 这些 doc 作为知识源（如做 automation 时读 `automations.md`、做 source 时读 `sources.md`）。AI 引用 doc 内容回复用户时会带出 craft 字样。

**Round 40 补遗（打包资源 JSON，不是 Markdown docs）**：

| 文件:行 | 内容 | 风险 | M1 处理 |
|---|---|---|---|
| `apps/electron/resources/permissions/default.json:105-114` | `"pattern": "^craft-agent\\s+label..."` / `"comment": "craft-agent label read-only operations"` 等 3 组 label/source/skill 规则 | 默认权限页或权限 JSON 被用户/AI 查看时出现 `craft-agent`；如果 M1 不发布 craft-agent CLI，这些默认 allow 规则还会显得像隐藏上游命令 | 若 craftAgentsCli 继续隐藏，删除这 3 组 `craft-agent` CLI 规则；若保留内部 CLI，则至少 comment 改为中性说明，并在权限 UI 中不展示旧品牌 |
| `apps/electron/resources/tool-icons/tool-icons.json:4` | `{ "id": "craft-agent", "displayName": "Craft Agent", "icon": "craft-agent.svg", "commands": ["craft-agent"] }` | Tool Icons 设置页 / AI docs 可能展示 `Craft Agent` | 与 §2.2 同步：推荐删除 entry；若保留则 displayName 改 `U Agents CLI`，commands 可按 §2.2 保留内部命令名 |

**11 个含 craft 的 doc 及处数（Round 43 补全 browser-tools.md）**：

| 文件 | craft 处数 | 处理优先级 |
|---|---|---|
| `craft-cli.md` | 137 | M1 保留不改（craftAgentsCli flag 默认 false）|
| `automations.md` | 27 | 🔴 高 |
| `sources.md` | 20 | 🔴 高 |
| `labels.md` | 11 | 🟡 中 |
| `skills.md` | 11 | 🟡 中 |
| `themes.md` | 10 | 🟡 中 |
| `permissions.md` | 7 | 🟢 低 |
| `statuses.md` | 2 | 🟢 低 |
| `tool-icons.md` | 2 | 🟢 低 |
| `data-tables.md` | 1 | 🟢 低 |
| `browser-tools.md` | 2 | 🟢 低，但会被 AI 工具说明引用，路径示例必须随 §2.15 改为 `~/.u-agents/docs/browser-tools.md` |

**M1 改造方案**（批量 sed + 抽查）：

```bash
# Step 1: 批量替换 craft-cli.md 之外的 10 个文件
for f in apps/electron/resources/docs/{statuses,sources,permissions,tool-icons,automations,labels,data-tables,themes,skills,browser-tools}.md; do
  perl -pi -e 's|Craft Agents|U Agents|g; s|Craft Agent|U Agents|g; s|\bCraft\b|U Agents|g' "$f"
done

# Step 2: 抽查 high-priority 文件（automations / sources）的语义合理性
grep -nE "Craft|craft" apps/electron/resources/docs/{automations,sources}.md
# 应仅剩 craft.do 引用（合规署名），其他全替换为 U Agents

# Step 3: craft-cli.md 保留不动（craftAgentsCli flag 默认 false）
```

> ⚠️ **跑完批量替换后必须 git diff 抽查** automations.md / sources.md 的关键段落——AI 引用这些 doc 时会读到改后的内容，语义不通顺会让 AI 输出怪。
>
> **Round 43 重点抽查 sources.md**：必须删除/改写 `mcp__craft-agents-docs__SearchCraftAgents` 示例、`craft-agents-docs` 指令、`https://connect.craft.do/...` 示例 baseUrl、`~/.craft-agent/provider-domains.json` 与 `mkdir -p ~/.craft-agent/...`；否则 AI 会继续教用户调用 Craft 文档 MCP 或连接 Craft 官方域。

> craft-cli.md 保留不改是为**和 §2.2 决策一致**（craftAgentsCli flag 默认 false 时 craft-cli 整套功能不激活）。

### 2.18 `apps/electron/src/main/index.ts` —— **DEEPLINK_SCHEME = 'craftagents' + app.setName('Craft Agents')**（**P0 系统全局污染**）

**问题（OOO 真发现，前 28 轮全漏）**：

1. **DEEPLINK_SCHEME** 注册到用户操作系统全局协议表（macOS Launch Services / Windows Registry / Linux .desktop MimeType）：
   - `apps/electron/src/main/index.ts:187` — `const DEEPLINK_SCHEME = process.env.CRAFT_DEEPLINK_SCHEME || 'craftagents'`
   - `apps/electron/src/main/index.ts:215, 219` — `app.setAsDefaultProtocolClient(DEEPLINK_SCHEME, ...)`
   - 用户每次点击 `craftagents://...` 链接 → 浏览器/系统弹"使用 Craft Agents 打开?"对话框 → **品牌污染**
2. **app.setName** 直接写死 `'Craft Agents'`：
   - `apps/electron/src/main/index.ts:213` — `app.setName(process.env.CRAFT_APP_NAME || 'Craft Agents')`
   - 影响 macOS 菜单栏 app 名 / userData 默认目录 / Sentry 上报 app 名 / `app.getName()` 全局返回值
   - **关联 §2.15 paths.ts**：`app.getName()` 影响 userData 默认路径，但 paths.ts CONFIG_DIR 是独立用 `os.homedir()` 算的，所以**不直接污染** CONFIG_DIR；但**自动更新 cache 路径**（`auto-update.ts:43`）和 **macOS 系统 crash dump 路径**（`~/Library/Logs/DiagnosticReports/<AppName>_*.crash`）都依赖这个

**M1 必改的全部位置（20+ 处）**：

| 类别 | 文件:行 | 改动 |
|---|---|---|
| **常量声明** | `apps/electron/src/main/index.ts:187` | `'craftagents'` → `'uagents'`；`CRAFT_DEEPLINK_SCHEME` env var → `U_AGENTS_DEEPLINK_SCHEME` |
| | `apps/electron/src/main/index.ts:213` | `'Craft Agents'` → `'U Agents'`；`CRAFT_APP_NAME` env var → `U_AGENTS_APP_NAME` |
| | `apps/electron/src/main/browser-pane-manager.ts:46` | **第二个独立常量** `CRAFT_DEEPLINK_SCHEME_PREFIX` → `U_AGENTS_DEEPLINK_SCHEME_PREFIX`；`'craftagents'` → `'uagents'`；env var 同步 |
| **常量名变更连锁** | `apps/electron/src/main/browser-pane-manager.ts:638, 2051, 3014, 3030` | 4 处 `CRAFT_DEEPLINK_SCHEME_PREFIX` 引用同步改 |
| **renderer 硬编码 11 处** | `apps/electron/src/renderer/playground/registry/browser-ui.tsx:226` | `craftagents://${...}` → `uagents://${...}` |
| | `apps/electron/src/renderer/components/ui/EditPopover.tsx:994` | 同上 |
| | `apps/electron/src/renderer/components/ui/HeaderMenu.tsx:37` | 同上 |
| | `apps/electron/src/renderer/components/app-shell/SourcesListPanel.tsx:135` | 同上 |
| | `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx:90` | 同上 |
| | `apps/electron/src/renderer/components/app-shell/SidebarMenu.tsx:95` | 同上 |
| | `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx:1579` | 注释里的字面量 `craftagents://`（用户看错误时可能看到）|
| | `apps/electron/src/renderer/pages/SourceInfoPage.tsx:354` | 同上 |
| | `apps/electron/src/renderer/pages/SkillInfoPage.tsx:115` | 同上 |
| | `apps/electron/src/renderer/pages/ChatPage.tsx:471` | 同上 |
| | `apps/electron/src/renderer/pages/settings/SettingsNavigator.tsx:64` | 同上 |
| **JSDoc / 注释** | `apps/electron/src/main/index.ts:185-186` | 注释 "e.g., craftagents://" + "CRAFT_DEEPLINK_SCHEME env var (craftagents1, craftagents2)" |
| | `apps/electron/src/main/index.ts:212` | 注释 "CRAFT_APP_NAME env var (e.g., 'Craft Agents [1]')" |
| | `apps/electron/src/main/index.ts:213` | 注释 "Register as default protocol client for craftagents:// URLs" |
| | `apps/electron/src/main/deep-link.ts:4-32` | JSDoc 7+ 处 `craftagents://` 示例（`allSessions` / `flagged` / `state` / `sources` / `settings` / `action` / `workspace`）|
| **测试 fixture** | `apps/electron/src/main/__tests__/deep-link-routing.test.ts:39, 67, 94` | 3 处 `craftagents://workspace/...` |
| | `apps/electron/src/main/__tests__/browser-pane-manager.test.ts:288, 295` | 2 处 `craftagents://settings` |
| **WebUI 用户提示** | `apps/webui/src/adapter/web-api.ts:95` | `console.warn('[openUrl] craftagents:// deep links require the desktop app')` → `'uagents://'` |
| **renderer HTML title** | `apps/electron/src/renderer/index.html:7` | `<title>Craft Agents</title>` → `<title>U Agents</title>`。这是 Electron renderer HTML title，窗口异常/DevTools/辅助技术可能看到，不能只改 React 组件 |
| **server-core RPC open-url** | `packages/server-core/src/handlers/rpc/system.ts:70-71` | `parseInternalCraftAgentsDeepLink()` 中 `parsed.protocol !== 'craftagents:'` → `parsed.protocol !== 'uagents:'`；函数名同步改为 `parseInternalUAgentsDeepLink` |
| | `packages/server-core/src/handlers/rpc/system.ts` 其他 open-url 分支 | 注释、allowlist 错误提示、logger 中的 `craftagents://` / `craftagents:` 全部同步改 `uagents://` / `uagents:` |
| **server-core open-url 测试** | `packages/server-core/src/handlers/rpc/system.open-url.test.ts` | 所有 `craftagents://action/...` fixture 改 `uagents://action/...`；allowlist 错误提示里的 `craftagents URLs are allowed` 改 `uagents URLs are allowed` |

**批量验证 grep**：

```bash
# 改造前应找到 18+ 处
grep -rn "craftagents\|CRAFT_DEEPLINK_SCHEME\|CRAFT_APP_NAME\|'Craft Agents'" apps/electron apps/webui --include='*.ts' --include='*.tsx' | wc -l

# 改造后应只剩 0 处（除注释里的"原本是" 历史说明）
grep -rn "craftagents\|CRAFT_DEEPLINK_SCHEME\|CRAFT_APP_NAME" apps/electron apps/webui --include='*.ts' --include='*.tsx'
```

**强烈建议（可选）**：在 renderer 新建 `apps/electron/src/renderer/utils/deeplink.ts` 导出 `buildDeepLink(path: string): string` helper，11 处 `uagents://${...}` 字面量改为 `buildDeepLink(...)`，避免未来上游若改 scheme 又散落各处。M1 时间紧可不做（直接字面量替换），M2 重构时统一。

> ⚠️ **关联 §2.15 paths.ts**：M1 #23 任务改 `paths.ts` CONFIG_DIR 时**不要**误把 `app.getName()` 的依赖一起改——CONFIG_DIR 用 `os.homedir()` 算，与 `app.getName()` 解耦；但 §2.18 改 `app.setName()` 后，`auto-update.ts:43` 的更新缓存路径会自动从 `Craft Agents` 切到 `U Agents`，**用户从 craft 老版升级时会丢失更新缓存**——M1 用户群是新装机，不影响；M2 公证版升级时记入 release-notes。

> ⚠️ **多实例 dev 模式**：上游用 `CRAFT_DEEPLINK_SCHEME=craftagents1 / 2` 跑多个实例对比测试。改名后等价命令是 `U_AGENTS_DEEPLINK_SCHEME=uagents1 / 2 + U_AGENTS_APP_NAME='U Agents [1]' / [2]`——**写在 11-roadmap M1 任务备注**避免 dev 时撞墙。
>
> **Round 44 补遗：旧系统协议注册残留**：新包注册 `uagents://` 后，不会自动清理用户系统里旧的 `craftagents://` handler（macOS Launch Services / Windows Registry / Linux desktop handler）。M1 是新装用户可接受；若从旧 Craft 包迁移或内部测试机装过上游包，发版验收必须确认 `craftagents://` 不再弹出 U Agents，必要时在卸载/迁移文档里指导清理旧 handler。

### 2.19 `packages/shared/src/agent/claude-agent.ts:846-855` —— **'craft-agents-docs' MCP 工具污染 AI 响应**（**P0 AI tool 行为污染**）

**问题（PPP 真发现）**：

`claude-agent.ts:850-854` 创建 agent session 时，**永远注入** `'craft-agents-docs'` MCP 服务器到 Claude 工具集：

```typescript
const fullMcpServers: Options['mcpServers'] = {
  session: getSessionScopedTools(...),
  // Craft Agents documentation - always available for searching setup guides
  // This is a public Mintlify MCP server, no auth needed
  'craft-agents-docs': {
    type: 'http',
    url: 'https://agents.craft.do/docs/mcp',
  },
  ...sourceProxies,
};
```

**用户层影响**：
1. Claude 在响应里会主动说 "I can search the **craft-agents-docs** MCP for ..." → 品牌污染
2. tool 调用结果含 `https://agents.craft.do/docs/...` URL → 用户对话里看到
3. AI 引用 craft 文档（不是我们的产品文档）回答用户 → **教用户错误用法**（craft 文档与 U Agents 用户体验不一致）
4. tool name 在 Claude SDK 内部记成 `mcp__craft-agents-docs__*` → 调试日志、错误堆栈、telemetry 全部带 craft

**M1 改造方案**（**强烈建议方案 A 完全裁剪**）：

| 方案 | 操作 | 取舍 |
|---|---|---|
| **A. 完全裁剪（M1 推荐）** | 删除 `'craft-agents-docs': {...}` entry | 用户问 AI"如何配置 source"时，AI 不再有内置文档可查；但内置 `apps/electron/resources/docs/*.md`（§2.17）仍可被 AI read 作为 fallback 知识源 |
| B. 替换为我们自建 MCP | `'u-agents-docs': { url: 'https://u-agents.u-studio.cn/docs/mcp' }` （**Round 49 B-2 修正**：原写 `docs.u-agents.u-studio.cn` 违反 §1 单域多路径规划，改用主域 `/docs/mcp` 路径）| M3 自建文档站后才可行；M1 不做 |

**M1 必改的全部位置（Round 43 扩为 9 处，8 个文件）**：

| 文件:行 | 内容 | 改动 |
|---|---|---|
| `packages/shared/src/agent/claude-agent.ts:849-854` | MCP server entry + 注释 | **删除整段** entry + 注释 |
| `packages/shared/src/sources/builtin-sources.ts:8, 18, 30, 32, 39, 41, 69` | deprecated comment + placeholder entry | 整个文件改注释（删除 "Craft Agents docs" 描述）+ placeholder entry 的 `id: 'builtin-craft-agents-docs'` / `name: 'Craft Agents Docs'` / `slug: 'craft-agents-docs'` 全删 |
| `packages/session-mcp-server/src/index.ts` | docs upstream proxy：`DOCS_MCP_URL`、`connectDocsUpstream()`、`docsTools` 合并进 `ListTools`、`isDocsUpstreamTool(name)` 分流、`callDocsUpstream(...)` 代理 | **禁用整条运行路径**；不得只删除/替换 `DOCS_MCP_URL` 常量后保留可调用的上游 docs proxy |
| **`packages/server-core/src/sessions/SessionManager.ts:566-567`** （Round 35 PPPP 补遗）| `'craft-agents-docs': { 'SearchCraftAgents': 'Search Docs' }` —— **第二处 craft-agents-docs MCP 注册！** | **删除整段** entry——SessionManager 也注册一遍工具名到显示名映射（"SearchCraftAgents" → "Search Docs"），裁剪 craft-agents-docs MCP 后此映射也无引用方 |
| `apps/electron/src/renderer/components/ui/EditPopover.tsx:369` | `'First, look up the guide: mcp__craft-agents-docs__SearchCraftAgents({ query: "filesystem" }). '` | **AI prompt context 中调用此 MCP**——必须删除整段引用，改为 read 本地 docs 路径（详见 §2.29 P0 改造）|
| **`packages/shared/src/utils/toolNames.ts:26`** （Round 48 A3 补遗 - 工具名映射）| `'SearchCraftAgents': 'Search Documentation'` —— 工具显示名映射 | 删除该 entry 或改为通用名（与 SessionManager:566 一致）|
| **`packages/shared/src/docs/source-guides.ts:5, 192, 194, 203, 217`** （Round 48 A3 补遗 - 5 处 JSDoc/示例）| `* Use the craft-agents-docs MCP server to search for setup guides.` × 3 + `mcp__craft-agents-docs__SearchCraftAgents({...})` 示例 + 顶部注释 | 注释/JSDoc 改为引导 read 本地 `~/.u-agents/docs/sources.md`（与 §2.29 EditPopover 决策一致）|
| **`packages/shared/src/sources/storage.ts:379, 387-388, 404, 541`** （Round 48 A3 补遗 - 5 处 builtin source 死分支）| 注释 + 运行时分支 `if (slug === 'craft-agents-docs')` 注入 builtin source | **死代码清理**：bundled guides 已移除（L541 注释明说），builtin source 注入分支可删；改 `~/.craft-agent` 路径注释 |
| **`packages/shared/src/agent/mode-manager.ts:2008`** （Round 48 A3 补遗 - 工具名前缀检查）| `if (toolName.startsWith('mcp__craft-agents-docs__')) { ... }` | 删除整个 if 分支或将 MCP 名替换；与 §2.19 裁剪一致——此分支无引用方后死代码 |
| **`packages/shared/src/agent/core/source-manager.ts:21`** + **`packages/shared/src/agent/core/prerequisite-manager.ts:49`** + **`packages/shared/src/agent/core/pre-tool-use.ts:661`** （Round 48 A3 补遗 - 3 处豁免/白名单 Set）| `Set(['session', 'craft-agents-docs'])` × 3 | 删除 `'craft-agents-docs'` 名单项；保留 `'session'`（session-scoped tools 仍存在）|
| **`packages/shared/src/prompts/system.ts:650`** （Round 48 **新发现** - §2.12 漏覆盖）| `2. Search \`craft-agents-docs\` for service-specific guides` —— **system prompt 第 6 处 craft 字面量！** §2.12 列了 5 处必改（L313/L430/L467/L470/L570），漏 L650 | **改造方案**：删除整行（与 §2.19 craft-agents-docs MCP 裁剪一致），改为 "2. Read local docs in `~/.u-agents/docs/` for service-specific guides"——同 §2.29 EditPopover 决策 |
| **`packages/shared/src/sources/types.ts:518`** （Round 48 **新发现** - JSDoc 注释）| JSDoc `* Whether this is a built-in source (e.g., craft-agents-docs).` | 注释改 "(e.g., session-scoped tools)" 或删除示例 |
| `packages/shared/src/agent/mode-manager.ts:2008` | `toolName.startsWith('mcp__craft-agents-docs__')` | 删除 craft docs 专用工具豁免/过滤分支；裁剪 MCP 后该分支不应继续暗示工具存在 |
| `packages/shared/src/agent/core/source-manager.ts:21` | `GUIDE_EXEMPT_SLUGS = new Set(['session', 'craft-agents-docs'])` | 从豁免 slug 中移除 `craft-agents-docs` |
| `packages/shared/src/agent/core/pre-tool-use.ts:661` | `BUILT_IN_MCP_SERVERS = new Set(['session', 'craft-agents-docs'])` | 从内置 MCP 白名单中移除 `craft-agents-docs` |
| `packages/shared/src/agent/core/prerequisite-manager.ts:49` | `EXEMPT_SLUGS = new Set(['session', 'craft-agents-docs'])` | 从 prerequisite 豁免中移除 `craft-agents-docs` |

**注意 builtin-sources.ts 现状**：上游已 deprecate（`getDocsSource()` 返回 placeholder + `enabled: false`），但 deprecated entry 字面量里 `'Craft Agents Docs'` / `'craft-agents-docs'` slug 仍在——M1 一并清理（即使 deprecated 不影响功能，避免上游同步时被 grep 命中）。

**验证 grep**：

```bash
# 改造前
grep -rn "craft-agents-docs\|Craft Agents Docs\|builtin-craft-agents-docs\|mcp__craft-agents-docs__\|/docs/mcp\|connectDocsUpstream\|docsTools\|callDocsUpstream" packages apps --include='*.ts' --include='*.tsx' --include='*.md' | wc -l

# 改造后应为 0
```

> ⚠️ **下游影响**：删除 `craft-agents-docs` MCP 后，`session-mcp-server/src/index.ts:275` 的 `DOCS_MCP_URL` 常量可能变成"声明未使用"——typecheck 不报错但 lint 会警告。如果 `DOCS_MCP_URL` 仅被裁掉的功能引用，**整个声明删掉**；如果还有其他地方引用，仅替换 URL（M1 走方案 A 时 URL 没值，可改成空字符串 + 类型加 `| null`，但更干净是整段删）。

> ⚠️ **AI 行为回归测试**（**M1 必跑**）：改造后启动 app → 新建对话 → 问 "What MCP servers do you have access to?" → AI 回答里**不能**再出现 "craft-agents-docs"。同理问 "How do I create an automation?" → AI 应**主动 read** `apps/electron/resources/docs/automations.md`（§2.17 已替换为 "U Agents"），而**不是**调用 `craft-agents-docs` tool。

### 2.20 `CRAFT_*` 环境变量族 —— **9 个名 + 用户手册式错误提示**（**P0 用户高级用法 + 文档可搜索性**）

**问题（SSS 真发现，前 28 轮只发现 3 个，漏 6 个）**：

上游用 `CRAFT_*` 前缀作为应用环境变量约定。M3 自建文档站后用户搜"如何配置 Python uv 路径"会找到 "export U_AGENTS_UV"——但代码里读的还是 `process.env.CRAFT_UV` → **文档与代码脱节**。

**全部 9 个 `CRAFT_*` 环境变量清单**：

| 环境变量 | 文件:行 | 用途 | 用户可见性 |
|---|---|---|---|
| `CRAFT_DEEPLINK_SCHEME` | `main/index.ts:187` + `main/browser-pane-manager.ts:46` | dev 多实例区分 deeplink scheme | 高（dev 命令）|
| `CRAFT_APP_NAME` | `main/index.ts:213` | dev 多实例 app 名 | 高（dev 命令）|
| `CRAFT_FEATURE_CRAFT_AGENTS_CLI` | `shared/feature-flags.ts:79` | feature flag 开 craft-agent CLI | 中（开发者隐藏功能）|
| **`CRAFT_IS_PACKAGED`** | `session-tools-core/runtime/resolve-script-runtime.ts:67` | 区分 dev / packaged 运行时 | 低（构建时设置）|
| **`CRAFT_RESOURCES_BASE`** | `resolve-script-runtime.ts:75` | resources/ 目录显式覆盖 | 中（packaged 调试）|
| **`CRAFT_APP_ROOT`** | `resolve-script-runtime.ts:88` | app root 路径显式覆盖 | 中（packaged 调试）|
| **`CRAFT_UV`** | `resolve-script-runtime.ts:165, 200` (error msg) | Python uv 二进制路径 | **高**（错误提示直接说 "Configure CRAFT_UV"）|
| **`CRAFT_NODE`** | `resolve-script-runtime.ts:205, 227` (error msg) | Node 二进制路径 | **高**（错误提示）|
| **`CRAFT_BUN`** | `resolve-script-runtime.ts:231, 253` (error msg) | Bun 二进制路径 | **高**（错误提示）|
| **`CRAFT_MCP_URL` / `CRAFT_MCP_TOKEN`** | `.env.example:4-9` | Craft MCP Server 示例配置 | **高**（模板会被执行 AI/用户照抄）|
| **`CRAFT_SERVER_TOKEN` / `CRAFT_WEBUI_DIR` / `CRAFT_RPC_TLS_CERT` / `CRAFT_RPC_TLS_KEY` 等 server 变量** | `Dockerfile.server`、`scripts/install-server.sh`、`apps/webui/src/login.html` | server/WebUI 部署与登录说明 | **中**（M1 不发布 server，但 M2/M3 启用前必须统一）|

**M1 改造方案**：runtime 读取的 `CRAFT_*` 全部 `U_AGENTS_*`（与 §2.18 决策一致）；M1 不发布的 server/WebUI 变量可暂不改代码，但 `.env.example` 这类模板文件必须避免诱导用户继续创建 Craft 命名配置。

**改造点全清单（~30 处）**：

| 文件 | 改动 | 备注 |
|---|---|---|
| `apps/electron/src/main/index.ts:187, 213` | `CRAFT_DEEPLINK_SCHEME` / `CRAFT_APP_NAME` | 已在 §2.18 |
| `apps/electron/src/main/browser-pane-manager.ts:46` | `CRAFT_DEEPLINK_SCHEME` 第二处 | 已在 §2.18 |
| `packages/shared/src/feature-flags.ts:79` | `CRAFT_FEATURE_CRAFT_AGENTS_CLI` → `U_AGENTS_FEATURE_CRAFT_AGENTS_CLI` | flag 名内 `CRAFT_AGENTS_CLI` 保留（描述被裁功能名） |
| `packages/session-tools-core/src/runtime/resolve-script-runtime.ts:15, 67, 75, 88, 135, 143, 154, 165-168, 200, 205-208, 227, 231-234, 253` | 6 个 env vars + JSDoc + 3 处 error message | **error message 是用户能搜到的字面量** |
| `packages/session-tools-core/src/runtime/resolve-script-runtime.test.ts:8-89+` | ~24 处 fixture（每个 env var × 4 测试用例）| 测试 fixture 必须同步改 |
| `.env.example:4-9` | `Craft MCP Server URL` / `CRAFT_MCP_URL` / `CRAFT_MCP_TOKEN` | 改为 `U_AGENTS_MCP_URL` / `U_AGENTS_MCP_TOKEN`，或删除示例；不要让模板继续教用户配置 Craft 命名变量 |
| `.env.example:29-31` | `SENTRY_ELECTRON_INGEST_URL=https://your-public-key@o0.ingest.sentry.io/0` | M1 改为空/注释禁用；不得提供第三方 Sentry SaaS DSN 示例（详见 §2.40 + `09-test-checklist.md` §13.4）|
| `.github/workflows/validate-server.yml:32` | `${{ secrets.CRAFT_ANTHROPIC_API_KEY }}` | 如保留 CI，改为 `U_AGENTS_ANTHROPIC_API_KEY`；避免组织 secrets 沿用 Craft 命名 |
| `Dockerfile.server` / `scripts/install-server.sh` | `CRAFT_SERVER_TOKEN`、`CRAFT_WEBUI_DIR`、`CRAFT_RPC_TLS_CERT/KEY`、`~/.craft-agent`、`craft-agent-server` | M1 不发布 server 时可不改源码，但 M2/M3 启用前必须统一为 U Agents 命名；一键部署输出尤其不能显示 Craft |

**关键 error message 改写**（用户在错误对话框看到这些字面量）：

| Before | After |
|---|---|
| `Configure CRAFT_UV or install uv on PATH.` | `Configure U_AGENTS_UV or install uv on PATH.` |
| `configure CRAFT_NODE or install node on PATH.` | `configure U_AGENTS_NODE or install node on PATH.` |
| `configure CRAFT_BUN or install bun on PATH.` | `configure U_AGENTS_BUN or install bun on PATH.` |
| `Configure an absolute CRAFT_* path or ship a bundled runtime.` | `Configure an absolute U_AGENTS_* path or ship a bundled runtime.` |
| `Configure a valid absolute CRAFT_* path or ship a bundled runtime.` | `Configure a valid absolute U_AGENTS_* path or ship a bundled runtime.` |

**验证 grep**：

```bash
# 改造前应找到 ~30 处
grep -rnE "CRAFT_(IS_PACKAGED|RESOURCES_BASE|APP_ROOT|UV|NODE|BUN|DEEPLINK_SCHEME|APP_NAME|FEATURE_)" packages apps --include='*.ts' --include='*.tsx' | wc -l

# 改造后应只剩 0 处
grep -rnE "CRAFT_(IS_PACKAGED|RESOURCES_BASE|APP_ROOT|UV|NODE|BUN|DEEPLINK_SCHEME|APP_NAME|FEATURE_)" packages apps --include='*.ts' --include='*.tsx'
```

> ⚠️ **build 脚本同步影响**：上游 `scripts/build/common.ts` 等被 OSS 剥离的脚本曾设置 `CRAFT_IS_PACKAGED=1` 给 packaged 进程。M1 不接管 scripts/，但 #28 macOS adhoc 打包时若用 electron-builder `extraResources` / `extraMetadata` 注入环境变量，需用新名 `U_AGENTS_IS_PACKAGED=1`。**05-build-release.md** 应同步备注。

> ⚠️ **CI / 用户工作流**：M1 用户群是新装机无历史依赖，改名安全；M2/M3 用户中如有人 export 过 `CRAFT_UV` 自定义 Python uv 路径，升级后必须改环境变量名——release-notes 必须备注。

### 2.21 `package.json` 文件族 —— **14 个 package.json 含 60 处 craft**（**P0 NPM scope 任务漏覆盖**）

**问题（TTT 真发现）**：

11 #1 NPM scope 任务说"`@craft-agent/` → `@u-agents/`"——这只覆盖 `name` 字段中的 scope 部分 + 所有 import path，**不覆盖**：
- 根 package.json `"name": "craft-agent"`（**非 scoped**，独立 monorepo 名）
- `description` 字段（14 个 package.json 全部含 "Craft" / "Craft Agent" / "Craft Agents"）
- `homepage` 字段（已在 02 §4.3 行）
- 根 package.json `"electron:dev:logs"` 脚本内含字面量 `@craft-agent/electron/main.log`（pgrep pattern，依赖 #1 已改名）

**M1 必改的全部位置（14 个 package.json）**：

| 文件 | 行 | 字段 | 改动 |
|---|---|---|---|
| `package.json` | 2 | `"name": "craft-agent"` | `"u-agents"` |
| `package.json` | 5 | `"description": "Claude Code-like agent for Craft documents"` | `"Claude Code-like agent for U Agents desktop"` |
| `package.json` | 64 | `"electron:dev:logs"` 脚本 pgrep pattern `@craft-agent/electron/main.log` | `@u-agents/electron/main.log`（与 #1 NPM scope 同步）|
| `apps/cli/package.json` | 5 | `"description": "Terminal client for Craft Agent server"` | `"Terminal client for U Agents server"` |
| `apps/electron/package.json` | 4 | `"description": "Electron desktop app for Craft Agents"` | `"Electron desktop app for U Agents"` |
| `apps/electron/package.json` | 8 | `"author.name": "Craft Docs Ltd."` | 改为 U Studio / tungwerl@gmail.com 自有发布信息；上游署名放 NOTICE / About，不放 package metadata |
| `apps/electron/package.json` | 11 | `"homepage": "https://agents.craft.do"` | `"https://u-agents.u-studio.cn"`（已在 02 §4.3 全景表）|
| `apps/viewer/package.json` | 5 | `"description": ".... Craft Agents sessions ..."` | M1 viewer 不发布，**保留不改**或 placeholder |
| `apps/webui/package.json` | — | description（如有 craft）| 类似处理 |
| `packages/core/package.json` | 5 | `"description": "Core types, storage, and agent logic for Craft Agents"` | `"... for U Agents"` |
| `packages/messaging-gateway/package.json` | 5 | `"description": "Messaging gateway for Craft Agent — Telegram & WhatsApp"` | `"Messaging gateway for U Agents — Telegram & WhatsApp"` |
| `packages/messaging-whatsapp-worker/package.json` | 5 | `"description": "WhatsApp worker subprocess for Craft Agent (Baileys-based, unofficial API)"` | `"... for U Agents (Baileys-based, unofficial API)"` |
| `packages/pi-agent-server/package.json` | 5 | description | `"Out-of-process Pi agent server ..."` 不含 craft，跳过 |
| `packages/server-core/package.json` | 5 | `"description": "Reusable headless server infrastructure for Craft Agent"` | `"... for U Agents"` |
| `packages/server/package.json` | 4, 17, 21 | description / author.name (`Craft Docs Ltd.`) / homepage | description 改；author/email 改为 U Studio 自有发布信息；homepage 改（同 02 §4.3）|
| `packages/session-mcp-server/package.json` | 5 | `"description": "MCP server that provides session-scoped tools ... to Codex via stdio transport"` | 不含 craft，跳过 |
| `packages/session-tools-core/package.json` | 5 | `"description": "Shared utilities for session-scoped tools (Claude and Codex)"` | 不含 craft，跳过 |
| `packages/shared/package.json` | 5 | `"description": "Shared business logic for Craft Agents - agent, auth, config, credentials, MCP integration"` | `"... for U Agents"` |
| `packages/ui/package.json` | 5 | `"description": "Shared React UI components for Craft Agents - session viewer, chat display, markdown rendering"` | `"... for U Agents"` |

**author.name 改为 U Studio 的法律依据**：

`apps/electron/package.json` + `packages/server/package.json` 的 `author` / `email` / `homepage` 属于 U Agents 发行包 metadata，面向用户、npm/安装包工具和排障日志展示，必须改为 U Studio / U Agents 自有信息（详见 `LEGAL.md` §2 Round 45）。Apache 2.0 §4(c) 要求保留 NOTICE 中的 attribution notice，不要求把派生发行包的 package author 继续写成上游公司；上游署名统一放在 `NOTICE` 追加段与 About 对话框中。

**验证 grep**：

```bash
# 改造前应找到约 60 处（不含 @craft-agent NPM scope，那是 #1 任务；Round 47 A5 修正：与标题一致）
grep -nE "(name|description|homepage)\".*\"[^\"]*[Cc]raft[^\"]*\"" package.json apps/*/package.json packages/*/package.json | wc -l

# 改造后 package metadata 中不应剩余 Craft / craft.do / Craft Docs Ltd.
# 上游署名只允许留在 LICENSE / NOTICE / TRADEMARK.md / About 合规文案中
# NPM scope @craft-agent/... 由 #1 任务负责，不归 #11g
```

> ⚠️ **#1 任务边界澄清**：原 #1 任务"NPM scope 重命名"专注 import path 解析，**不**含 description/homepage/name 字段；新任务 #11g（**§2.21**）专门处理 package.json 字段。两个任务可在同一 commit 完成（commit 1 或 commit 2）但**不要混淆覆盖范围**。

> ⚠️ **执行 AI 易漏点**：根 package.json 的 `name` 字段是 `"craft-agent"`（**非 scoped**，单独的 monorepo 名）——`bun install` 会用此名作为 lock 标识，改名后 `bun.lock` 顶部 `name` 字段也会同步更新（由 bun 自动），**不需要手动改 bun.lock**。

---

## 3. 二级硬编码（生产代码内的 craft.do）

### 3.1 `apps/viewer/src/components/Header.tsx:43`
`href="https://agents.craft.do"` → `https://u-agents.u-studio.cn`

### 3.2 `apps/viewer/vite.config.ts:35`
开发代理 `target: 'https://agents.craft.do'` → 替换为本地 server 或我们自己的地址（开发期，不影响生产）。

### 3.3 桌面端菜单中的"Help / Docs" 链接（**6 处**，前 28 轮误记 4 处）
- `apps/electron/src/renderer/components/AppMenu.tsx:272`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx:329, 477` （**2 处**）
- `apps/electron/src/renderer/pages/ChatPage.tsx:560, 574` （**2 处**，docs/go-further/sharing 子路径）
- `apps/electron/src/main/menu.ts:237`

全部 `https://agents.craft.do/docs` 或 `https://agents.craft.do/docs/go-further/sharing` → `https://u-agents.u-studio.cn/docs[/...]`

**验证 grep**：

```bash
# 改造前应找到 6 处
grep -rn "agents\.craft\.do/docs" apps/electron --include='*.ts' --include='*.tsx' | wc -l
```

### 3.4 install 脚本

- `scripts/install-app.sh`（含 craft.do URL 在 5 行起 + 354 行）
- `scripts/install-app.ps1`（含 craft.do URL 在 2、7 行）

**操作（与 `04-feature-cuts.md` §2.1 一致）**：M1 阶段**不发布、不引用**这两个脚本（产品官网用直接下载安装包的方式）。**保留文件不动**——删除属于单向破坏性动作，会增加上游同步冲突；只要不发布就达成产品目标。M2/M3 评估后如确需删除，单独开任务确认。

**Round 43 补遗：发布脚本的二次入口也必须禁用**：`apps/electron/scripts/build-dmg.sh:47-53,289-295` 与 `apps/electron/scripts/build-linux.sh:36-42,289-295` 有 `--script` 参数会上传 `scripts/install-app.sh`。M1/M2 发版命令**禁止使用 `--script`**，除非 install-app 脚本已经完整白标并确认更新源、下载目录、artifact 名、bundle id、进程名都指向 U Agents。

---

### 2.22 `packages/shared/src/agent/` —— **prompt / agent 文件族 18 处 craft**（**P0 用户可见 + 测试 fixture**）

**问题（YYY 真发现，前 28 轮全漏）**：

除已查的 `system.ts`（详见 §2.12）和 `claude-agent.ts:846-855`（§2.19），还有 **9 个文件 18 处 craft 字面量**：

**P0 必改（7 处用户可见 + 测试 fixture）**：

| 文件:行 | 改动 | 用户可见性 |
|---|---|---|
| `packages/shared/src/agent/errors.ts:185` | `'... required for Craft Agent. Please choose a model with tool support (e.g., Claude, GPT-4, Gemini).'` → `'... required for U Agents. ...'` | **错误对话框直接显示** |
| `packages/shared/src/agent/errors.ts:458` | `'... required for Craft Agent. Please choose a different model with tool support in Settings.'` → `'... required for U Agents. ...'` | **错误对话框直接显示** |
| `packages/shared/src/agent/diagnostics.ts:139` | `case 'pi_compat': return 'Craft Agents Backend';` → `'U-API';` | **诊断输出**用户在 connection 健康面板看到（与 §6.3 provider-metadata 决策一致）|
| `packages/shared/src/agent/pi-agent.ts:121` | `protected backendName = 'Craft Agents Backend';` → `'U-API';` | 传给 Pi SDK，可能在 SDK 日志/事件元数据中显示 |
| `packages/shared/src/agent/pi-agent.ts:1848` | `'Craft Agents Backend', // backendName` → `'U-API', // backendName` | 同上 |
| `packages/shared/src/prompts/__tests__/system.test.ts:15` | `CO_AUTHOR_TRAILER = 'Co-Authored-By: Craft Agent <agents-noreply@craft.do>'` → `'Co-Authored-By: U Agents <agents@u-studio.cn>'` | 测试 fixture（与 §2.12 system.ts:570 同步）|
| `packages/shared/src/prompts/__tests__/system.test.ts:88` | `'Craft Agents Backend'` 测试参数 → `'U-API'`（与 diagnostics.ts:139 / pi-agent.ts:121,1848 同步）| 测试 fixture |

**P2 注释（M1 可不改，M2 同步上游时一并）**：

| 文件:行 | 内容 | 类型 |
|---|---|---|
| `packages/shared/src/prompts/print-system-prompt.ts:3, 61, 201, 205` | "Craft Agent system prompt" / "Craft Agent Environment Marker" | dev script 注释 + 输出文本 |
| `packages/shared/src/agent/pi-agent.ts:44, 998` | "System prompt for Craft Agent context" / "Craft AgentEvents" | 注释 |
| `packages/shared/src/agent/backend/pi/event-adapter.ts:5, 32, 111` | "Craft Agent's AgentEvent format" / "Craft AgentEvents" | 注释 |
| `packages/shared/src/agent/backend/claude/event-adapter.ts:4` | "Craft Agent's AgentEvent format" | 注释 |
| `packages/shared/src/agent/__tests__/pi-event-adapter.test.ts:4` | "Craft AgentEvent conversion" | 测试注释 |

> ⚠️ **#24d 测试任务漏覆盖修正**：原 #24d 列出 7 个测试文件需配套改造（storage / domain / electron 测试），**未含** `prompts/__tests__/system.test.ts`。**system.test.ts 是第 8 个必改测试文件**——改 §2.12 system.ts 后这两个 fixture assertion (CO_AUTHOR_TRAILER 含 craft + 88 行 backendName 含 craft) 必失败。M1 #24d 任务清单同步加。

**验证 grep**：

```bash
# 改造前应找到 7 处 P0
grep -nE "Craft Agent|Craft Agents Backend" packages/shared/src/agent/errors.ts packages/shared/src/agent/diagnostics.ts packages/shared/src/agent/pi-agent.ts packages/shared/src/prompts/__tests__/system.test.ts

# 改造后剩余应为 0
```

> ⚠️ **diagnostics.ts:139 与 §6.3 provider-metadata 联动**：M1 #15 任务给 provider-metadata 加 'u-api' entry，但 `pi_compat` provider 的 displayLabel 仍走 diagnostics.ts:139——即用户的 LLM connection providerType 是 `pi_compat`（M1 走 newapi 兼容）→ diagnostics 返回 "Craft Agents Backend"。**改 diagnostics.ts:139 → "U-API" 必须与 §6.3 同步**，否则诊断面板与设置页连接卡显示不一致。

### 2.23 `packages/shared/src/agent/core/` —— **正则表达式 hardcoded `\.craft-agent\/` 路径 13 处 + 函数名**（**P0 §2.15 paths.ts 改名漏覆盖**）

**问题（ZZZ 真发现，前 28 轮全漏）**：

§2.15 任务 #23 改 `paths.ts` CONFIG_DIR 为 `~/.u-agents/`——但有 2 个文件**正则表达式 hardcoded** `\.craft-agent\/` 路径，**改 paths.ts 后这些正则匹配失败** → config 文件路径校验失败。

**全部改造点（13 个正则 + 1 个函数名）**：

| 文件:行 | 内容 | 改动 |
|---|---|---|
| `packages/shared/src/agent/core/config-validator.ts:34` | `/\.craft-agent\/config\.json$/` | `/\.u-agents\/config\.json$/` |
| `packages/shared/src/agent/core/config-validator.ts:36` | `/\.craft-agent\/preferences\.json$/` | `/\.u-agents\/preferences\.json$/` |
| `packages/shared/src/agent/core/config-validator.ts:38` | `/\.craft-agent\/workspaces\/[^/]+\/sources\/[^/]+\/config\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:40` | `/\.craft-agent\/workspaces\/[^/]+\/permissions\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:41` | `/\.craft-agent\/permissions\/[^/]+\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:43` | `/\.craft-agent\/workspaces\/[^/]+\/theme\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:45` | `/\.craft-agent\/workspaces\/[^/]+\/statuses\/config\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:47` | `/\.craft-agent\/workspaces\/[^/]+\/labels\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:49` | `/\.craft-agent\/tool-icons\/tool-icons\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/path-processor.ts:34` | `/\.craft-agent\/.*\/(config\|permissions\|theme\|guide\|labels\|statuses)\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/path-processor.ts:35` | `/\.craft-agent\/config\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/path-processor.ts:36` | `/\.craft-agent\/preferences\.json$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/path-processor.ts:37` | `/\.craft-agent\/.*\/SKILL\.md$/` | `/\.u-agents\/...$/` |
| `packages/shared/src/agent/core/config-validator.ts:106` | `isCraftAgentConfig(filePath: string): boolean` | `isUAgentsConfig(filePath: string): boolean` —— **公开方法，全仓所有调用方同步改** |

**isCraftAgentConfig 调用方查找**：

```bash
grep -rn "isCraftAgentConfig" packages apps --include='*.ts' --include='*.tsx'
```

**关键：与 #23 任务联动**：

§2.15 #23 任务说"`paths.ts` 改名 + 12+ 处运行时硬编码 + 15 处注释残留"——**漏掉 §2.23 的 13 个正则 + 1 函数名**。如果只改 paths.ts 不改 §2.23，就算用户配置文件已写到 `~/.u-agents/`，**config-validator 校验仍按 `\.craft-agent\/` 失败** → app 拒绝读取/写入 config。

**M1 改造时序**：
- #23 任务（§2.15 paths.ts 改名）和 #11i 任务（§2.23 正则改名）**必须在同一 commit 或同一会话**完成
- 否则中间态：config 写到新路径但校验旧正则 → app 行为错乱

**验证 grep**：

```bash
# 改造前应找到 13 处正则 + 至少 1 处函数名
grep -rnE "\\\\\.craft-agent" packages/shared/src/agent/core --include='*.ts' | wc -l  # 13
grep -rn "isCraftAgentConfig" packages apps --include='*.ts' --include='*.tsx' | wc -l  # 1+ (函数定义 + 所有调用方)

# 改造后应只剩 0
```

> ⚠️ **关联 §2.15**：§2.15 表中"15 处注释残留"未含 §2.23 的 13 个正则——这是**生产代码逻辑**不是注释，严重度更高。M1 任务 #23 描述需补充。

> ⚠️ **测试影响**：config-validator.ts 必有对应的 `config-validator.test.ts`（package shared 内）——改正则后测试 fixture 也要从 `.craft-agent/` 改 `.u-agents/`。**任务 #24d 测试清单需补**（除 system.test.ts 第 8 个外，还有 config-validator.test.ts 第 9 个）。

### 2.24 Vite 配置 `optimizeDeps.exclude` —— **3 处 `@craft-agent/ui` + 1 处 viewer dev proxy**（**P0 #1 NPM scope 任务易漏**）

**问题（BBBB 真发现）**：

#1 NPM scope 任务说"全部 `@craft-agent/` → `@u-agents/`"——但 Vite 配置文件里 `optimizeDeps.exclude` 数组的字面量字符串 **不是 import 语句**，常规 codemod / sed 替换可能漏覆盖。改名后若 Vite 仍 exclude `@craft-agent/ui`（不存在的包名），实际 Vite 会**重新打包** `@u-agents/ui` → 触发 "multiple React copies" 错误（注释明说是为防止此错误才加 exclude）。

**全部 4 处 craft 改造点**：

| 文件:行 | 内容 | 改动 |
|---|---|---|
| `apps/electron/vite.config.ts:56` | 注释 `// Bun hoists deps to root. This prevents "multiple React copies" error from @craft-agent/ui` | 注释字面量 `@craft-agent/ui` → `@u-agents/ui` |
| `apps/electron/vite.config.ts:64` | `exclude: ['@craft-agent/ui']` | `exclude: ['@u-agents/ui']` —— **生产配置必改** |
| `apps/webui/vite.config.ts:81` | `exclude: ['@craft-agent/ui']` | 同上必改 |
| `apps/viewer/vite.config.ts:35` | `target: 'https://agents.craft.do'` (dev proxy) | M1 viewer 不发布，**保留不改**或留 placeholder（dev 模式才生效）|

**为什么 Vite 配置易漏**：

1. `vite.config.ts` 不在大多数 grep 范围内（业务代码 grep 一般限定 `packages/`）
2. `optimizeDeps.exclude` 是字面量字符串数组，不会被 import path codemod 处理
3. 改名失败的症状是 dev 时偶发 "multiple React copies" 错误，不是 build error，**不易察觉**

**M1 验证**：

```bash
# 改造前应找到 4 处
grep -nE "[Cc]raft" apps/electron/vite.config.ts apps/webui/vite.config.ts apps/viewer/vite.config.ts

# 改造后剩余应只有 viewer dev proxy 1 处（M1 viewer 不发布）
```

> ⚠️ **dev 时验证 React 单实例**：改完 #11j 后跑 `bun run electron:dev`，浏览器 devtools console **不应**出现 "Warning: ... You might have more than one copy of React in the same app." —— 出现说明 Vite exclude 改错（仍 exclude 老 scope），React 被双打包。

> ⚠️ **viewer dev proxy 决策**：M1 不发布 viewer，dev proxy `https://agents.craft.do` 仅在跑 `bun run dev:viewer` 时生效（不会进 packaged build）。M1 不改；M3 自建 viewer 时改为 `https://u-agents.u-studio.cn`（主域，分享 URL 为 `https://u-agents.u-studio.cn/s/{shareId}`，**Round 49 B-2 修正**：原写 `share.u-agents.u-studio.cn` 违反 §1 单域多路径规划）。

### 2.25 `apps/electron/scripts/build-dmg.sh` —— **macOS DMG 打包脚本 3 处 craft**（**P0 改 artifactName 后脚本 mv 失败**）

**问题（JJJJ 真发现，前 28 轮全漏）**：

`#2 任务` 改 `electron-builder.yml` 的 `artifactName` 为 `U-Agents-${arch}.dmg`，但 `build-dmg.sh:248-249` 用 hardcoded 字面量 `Craft-Agents-${ARCH}.dmg` 验证 electron-builder 输出。**两处不同步 → 脚本 `[ ! -f "$DMG_PATH" ]` 永远 true → exit 1**。

**全部 3 处必改**：

| 文件:行 | 内容 | 改动 |
|---|---|---|
| `apps/electron/scripts/build-dmg.sh:83` | `echo "=== Building Craft Agents DMG (${ARCH}) using electron-builder ==="` | `echo "=== Building U Agents DMG ..."` |
| `apps/electron/scripts/build-dmg.sh:248` | 注释 `# electron-builder.yml uses artifactName to output: Craft-Agents-${arch}.dmg` | `# ... output: U-Agents-${arch}.dmg` |
| `apps/electron/scripts/build-dmg.sh:249` | `DMG_NAME="Craft-Agents-${ARCH}.dmg"` | `DMG_NAME="U-Agents-${ARCH}.dmg"` —— **生产代码必改否则 mv/验证失败** |

**关联 #28 macOS adhoc 打包任务**：
- M1 #28 跑 `bun run electron:dist:adhoc:mac` 走 build-dmg.sh
- #2 改 electron-builder.yml artifactName 后 → **必须同步改 build-dmg.sh**
- 否则 #28 任务执行报 `ERROR: Expected DMG not found at .../release/Craft-Agents-arm64.dmg`

**验证 grep**：

```bash
# 改造前应找到 3 处
grep -nE "[Cc]raft" apps/electron/scripts/build-dmg.sh

# 改造后应为 0
```

> ⚠️ **build-linux.sh 同样问题，M2 处理**：`build-linux.sh:68, 204-216` 含 8 处 `Craft-Agents-*.AppImage` 字面量；M1 不发 Linux AppImage，**保留不改**；M2 出 Linux 时同步改（与 #28 macOS 一致的耦合关系）。

### 2.26 `apps/electron/src/renderer/components/icons/CraftAppIcon.tsx` —— **死组件 + 死资源**（**P1 grep 0 调用方**）

**问题（KKKK 真发现）**：

`CraftAppIcon` 组件 + `craft_logo_c.svg` 资源**完全无外部 caller**：

```bash
grep -rn "CraftAppIcon" apps/electron/src
# 结果只有 CraftAppIcon.tsx 自身的定义（3 处：interface 定义 + JSDoc 注释 + export function）
# 无任何 import { CraftAppIcon } from ...
```

**两个文件状态**：
- `apps/electron/src/renderer/components/icons/CraftAppIcon.tsx`（22 行组件 —— 显示 craft.do logo "C" 图标，alt="Craft"）
- `apps/electron/src/renderer/assets/craft_logo_c.svg`（彩色 "C" SVG，由 craftLogo import 引用）

**M1 处理**（与 §2.2 craft-logos/ 决策一致）：

| 选项 | 操作 | 取舍 |
|---|---|---|
| **③ 删除（推荐）** | `rm CraftAppIcon.tsx + craft_logo_c.svg` | 最干净；上游若同步引入新引用会立即编译错误暴露 |
| ② 改名 + 替换 | `UAgentsAppIcon.tsx + u_agents_logo.svg` + 替换 SVG 内容为 U Agents logo | 保留组件做未来用；但 0 caller 增加无收益 |
| ① 保留不动 | 同上游 | 与上游同步友好但用户解 .app 看到 craft 字样 |

**验证 grep**（删除后）：

```bash
grep -rn "CraftAppIcon\|craft_logo_c\.svg" packages apps
# 应为 0
```

### 2.27 `apps/electron/src/renderer/hooks/useNotifications.ts:232` —— **通知 fallback body 用户可见**（**P0 hardcoded 英文文案**）

**问题（LLLL 真发现）**：

```typescript
// useNotifications.ts:232
let body = messagePreview || 'Craft Agent has a new message for you'
```

**用户场景**：
- session 收到新消息但 `messagePreview` 为空（binary message / system event 等）
- 用户桌面通知 body 显示 `'Craft Agent has a new message for you'` —— **用户直接看到 craft 字样**

**M1 改造方案**：

| 方案 | 操作 | 取舍 |
|---|---|---|
| **A. 字面量替换（M1 推荐）** | `'Craft Agent has a new message for you'` → `'U Agents has a new message for you'` | 快；但仍是硬编码英文，非中文用户也看到英文 |
| B. 走 i18n | 新增 `notifications.fallbackBody` key（**7 个 locale 同步**）| 与 #25/#26 i18n 任务联动；但增加复杂度 |

**M1 推荐方案 A**：先字面量替换，M2 中文化阶段统一走 i18n（加入 10-i18n-zh.md §3 待办清单）。

**验证 grep**：

```bash
# 改造后应为 0
grep -nE "Craft Agent has a new message" apps/electron/src/renderer/hooks/
```

> ⚠️ **同时关联 §2.18 Windows setAppUserModelId**：M2 Windows 打包时若不调 `app.setAppUserModelId('cn.u-studio.u-agents')`，Windows toast 通知顶部显示 "Electron"（fallback）而不是 "U Agents"。组合 §2.27 改 body + setAppUserModelId 改 title 才能让 Windows 通知完全无 craft / Electron 字样。

### 2.28 `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx` —— **启动画面 + 顶栏图标组件**（**P0 用户首屏可见**）

**问题（MMMM 真发现，前 28 轮全漏）**：

`CraftAgentsSymbol` 是渲染**像素艺术 "E" 符号** 的 SVG 组件（24 行 inline SVG path），用于：

| 调用方 | 位置 | 用户场景 |
|---|---|---|
| `apps/electron/src/renderer/components/SplashScreen.tsx:2, 39` | 启动画面 | **应用启动第一眼看到的图标** |
| `apps/electron/src/renderer/components/AppMenu.tsx:18, 208` | 顶栏左上角 logo dropdown | **每次打开菜单都看到** |

**M1 必改的全部位置（5 处）**：

| 文件:行 | 改动 |
|---|---|
| `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx`（整文件 24 行）| 改名 → `UAgentsSymbol.tsx`；JSDoc 注释 "Craft Agents 'E' symbol" → "U Agents symbol"；SVG path 替换为 U Agents 自己的像素艺术（保留 viewBox 不变以维持现有布局尺寸）|
| `apps/electron/src/renderer/components/SplashScreen.tsx:2` | `import { CraftAgentsSymbol } from './icons/CraftAgentsSymbol'` → `import { UAgentsSymbol } from './icons/UAgentsSymbol'` |
| `apps/electron/src/renderer/components/SplashScreen.tsx:10` | 注释 "Shows Craft symbol" → "Shows U Agents symbol" |
| `apps/electron/src/renderer/components/SplashScreen.tsx:39` | `<CraftAgentsSymbol .../>` → `<UAgentsSymbol .../>` |
| `apps/electron/src/renderer/components/AppMenu.tsx:18, 208` | 同样 import + 调用同步改 |
| `apps/electron/src/renderer/components/AppMenu.tsx:152, 203` | 注释 "Craft logo" → "U Agents logo" |
| `apps/electron/src/renderer/components/AppMenu.tsx:207` | `aria-label="Craft menu"` → `aria-label="U Agents menu"` —— **屏幕阅读器无障碍** |

**SVG 替换建议**（让用户准备）：

- viewBox 保持 `viewBox="452 368 115 129"`（115×129 比例）
- 替换为 U Agents 字母符号像素艺术（如 "U" 形像素图）或简化 logo
- `fill="currentColor"` 保留（让组件继承父组件 className 颜色，深色/浅色主题自适应）

**验证 grep**：

```bash
# 改造前应找到 5 处
grep -rnE "CraftAgentsSymbol|Craft (logo|menu|symbol)" apps/electron/src/renderer/components

# 改造后应为 0
```

> ⚠️ **关联 §2.2 craft-logos/ + Round 33 GGGG**：`craft-logos/` 目录的 4 个 PNG 是上游 leftover（grep 0 引用），与 `CraftAgentsSymbol` 是**不同的资源**——CraftAgentsSymbol 是 inline SVG（**真实使用**），craft-logos/ 是死代码（**0 使用**）。M1 §2.28 改 CraftAgentsSymbol、§2.2 删 craft-logos/。

### 2.29 `apps/electron/src/renderer/components/ui/EditPopover.tsx` —— **AI prompt context 14 处 craft 路径 + MCP 引用**（**P0 §2.15 + §2.19 双重漏覆盖**）

**问题（MMMM 真发现，最严重 P0）**：

EditPopover.tsx 在用户编辑 source/skill/automation 等配置时，**生成 AI prompt context** 让 AI 帮忙修改/补全。这些字符串中**14 处** hardcoded：
- `~/.craft-agent/` 路径（§2.15 paths.ts 改名漏覆盖）
- `mcp__craft-agents-docs__SearchCraftAgents` 工具调用引用（§2.19 craft-agents-docs MCP 裁剪冲突）

**改造影响**：
1. 用户编辑 → AI 读 prompt context → 看到 `~/.craft-agent/docs/sources.md` → **真的去 read 这个路径** → §2.15 改名后 read 失败
2. AI 看到 `mcp__craft-agents-docs__SearchCraftAgents({...})` → **调用此工具** → §2.19 裁剪后报 "unknown tool" 错误
3. AI 行为崩坏 → 用户编辑功能失败

**全部 14 处必改**：

| 行 | 内容 | 类型 |
|---|---|---|
| L148 | `'... default permissions (~/.craft-agent/permissions/default.json). '` | 路径 |
| L288 | `'... preferences (~/.craft-agent/preferences.json). '` | 路径 |
| L312 | `'Follow the patterns in ~/.craft-agent/docs/sources.md. '` | 路径 |
| L315 | `example: 'Connect to my Craft space'` | **用户可见 example** |
| L333 | `'Follow the patterns in ~/.craft-agent/docs/sources.md. '` | 路径 |
| L353 | `'Follow the patterns in ~/.craft-agent/docs/sources.md. '` | 路径 |
| L369 | `'First, look up the guide: mcp__craft-agents-docs__SearchCraftAgents({ query: "filesystem" }). '` | **MCP 引用，§2.19 裁剪后调用失败** |
| L374 | `'Follow the patterns in ~/.craft-agent/docs/sources.md. '` | 路径 |
| L393 | `'Follow the patterns in ~/.craft-agent/docs/skills.md. '` | 路径 |
| L437 | `'Read ~/.craft-agent/docs/labels.md for full format reference. '` | 路径 |
| L459 | 同上 | 路径 |
| L481 | 同上 | 路径 |
| L524 | `'... tool-icons.json in ~/.craft-agent/tool-icons/. ...'` | 路径 |
| L528 | `'Read ~/.craft-agent/docs/tool-icons.md for full format reference. '` | 路径 |
| L548 | `'Read ~/.craft-agent/docs/automations.md for full format reference. '` | 路径 |

**M1 改造方案**：

1. **路径改造**（13 处）：批量 sed `~/.craft-agent/` → `~/.u-agents/`
2. **L315 example**：`'Connect to my Craft space'` → `'Connect to my Notion workspace'` 或类似中性文案（M1 不做 craft.do 集成，example 不应误导用户）
3. **L369 MCP 引用**：与 §2.19 craft-agents-docs MCP 裁剪一致——**整段删除** `'First, look up the guide: mcp__craft-agents-docs__SearchCraftAgents({ query: "filesystem" }). '`，改为 `'Read the local docs in ~/.u-agents/docs/sources.md for filesystem source patterns. '`

**验证 grep**：

```bash
# 改造前应找到 14+ 处
# Round 44 后不再排除 craftagents://；§2.18 要求 deeplink 字面量也同步改为 uagents://
grep -nE "[Cc]raft|craftagents" apps/electron/src/renderer/components/ui/EditPopover.tsx

# 改造后应为 0
```

> ⚠️ **关键依赖**：§2.29 必须**与 §2.15 + §2.19 同 commit 完成**——三者都必须落地，否则 AI 编辑流程会出现 prompt 与实际行为不一致的状态：
> - 只改 §2.15 paths.ts 不改 §2.29 → AI 用旧路径 read 失败
> - 只改 §2.19 craft-agents-docs MCP 不改 §2.29 L369 → AI 调用不存在的 MCP tool 报错
> - 只改 §2.29 路径不改 §2.15 → AI 用新路径 read 但实际路径还是老路径（写入新读取旧）

### 2.30 `craft:*` 自定义事件命名空间 —— **window CustomEvent 命名空间**（**P1 跨组件协议）

**问题（MMMM 真发现）**：

renderer 用 `window.dispatchEvent(new CustomEvent('craft:*', ...))` 作跨组件通信协议：

| 文件:行 | 内容 |
|---|---|
| `apps/electron/src/renderer/components/ui/label-value-popover.tsx:93` | `new CustomEvent('craft:focus-input', {...})` —— 触发输入框 focus |
| `apps/electron/src/renderer/pages/ChatPage.tsx:252` | `window.addEventListener('craft:restore-input', handler)` —— 监听恢复输入 |
| `apps/electron/src/renderer/pages/ChatPage.tsx:253` | `removeEventListener('craft:restore-input', ...)` |
| **`apps/electron/src/renderer/App.tsx:858`** （Round 37 WWWW 补遗）| `new CustomEvent('craft:restore-input', {...})` —— **dispatch 端**！前 28 轮列了 ChatPage 监听端，**漏 App.tsx dispatch 端** |
| **`apps/electron/src/renderer/App.tsx:932`** （Round 37 WWWW 补遗）| `new CustomEvent('craft:compaction-complete', {...})` —— **第 2 个 craft:* 事件名**！前 28 轮只发现 `craft:focus-input` / `craft:restore-input`，此为**第 3 个事件类型** |

**M1 改造方案**：

| 选项 | 操作 | 取舍 |
|---|---|---|
| **A. 改名（推荐）** | `craft:*` → `u-agents:*` | 用户在 DevTools 看不到 craft 字样；dispatch / listen / remove listener 必须同 commit 成对改 |
| B. 保留 | 同上游 | 与上游同步友好；但 DevTools 调试时看到 craft 字样 |

**M1 推荐方案 A**——**以全量 grep 为准一次性改完**。Round 39 证明固定计数很容易漏：实际已知至少 **8 个事件类型 / 30+ 处 dispatch/listen/remove/comment**。改名风险低，但必须同 commit 成对改，否则输入、附件粘贴、计划审批、compact 后续执行会断链。

**当前已知事件类型（Round 39 全量 grep）**：
- `craft:focus-input` —— `label-value-popover.tsx` / `SessionInfoPopover.tsx` / `ActiveOptionBadges.tsx` / `focus-input-events.ts` dispatch + `FreeFormInput.tsx` listen/remove
- `craft:restore-input` —— **App.tsx:858 dispatch** + ChatPage.tsx:252-253 listen/remove
- `craft:compaction-complete` —— **App.tsx:932 dispatch** + `FreeFormInput.tsx:719, 735, 803, 805` listen/remove
- `craft:insert-text` —— `FreeFormInput.tsx:624-625` listen/remove（当前未发现 dispatch，但事件名也必须迁移，避免未来旧协议继续扩散）
- `craft:paste-files` —— `AppShell.tsx:1215` dispatch + `FreeFormInput.tsx:899-900` listen/remove；`playground/registry/chat.tsx:696` 属 dev playground，可随组件引用顺改或 M2 决策保留
- `craft:submit-input` —— `ChatDisplay.tsx:1284` dispatch + `FreeFormInput.tsx:1283-1284` listen/remove
- `craft:approve-plan` —— `ChatDisplay.tsx:1787` dispatch + `FreeFormInput.tsx:674-675` listen/remove
- `craft:approve-plan-with-compact` —— `ChatDisplay.tsx:1800` dispatch + `FreeFormInput.tsx:738-739` listen/remove

**验证 grep**：

```bash
# 改造前应找到 30+ 处（含注释；注释也要顺改，避免未来复制旧协议）
grep -rn "craft:" apps/electron/src --include='*.ts' --include='*.tsx'

# 改造后应为 0（如 playground 决策保留，必须在 §2.38 明确列入保留清单并从 M1 验收 grep 排除）
```

> ⚠️ **固定清单会过期**：本节的事件列表只是当前 Round 39 已知值。执行时必须以 `grep -rn "craft:" apps/electron/src --include='*.ts' --include='*.tsx'` 的实时结果为准，同 commit 修改所有 dispatch / listener / remove listener / 注释，否则单边改名会造成事件断链。

### 2.31 `'Craft Agents Backend'` 用户可见 label —— **AiSettingsPage 5 + connection-setup-logic 3 + provider-icons 2 + FreeFormInput 2 + ApiKeyInput 1 = 13 处**（**P0 §2.22 范围扩张 + Round 45 补遗**，Round 47 A4 修正数字）

**问题（NNNN + PPPP 真发现，§2.22 漏覆盖）**：

§2.22 列了 7 处 P0 用户可见 craft 字面量（errors.ts × 2 + diagnostics.ts × 1 + pi-agent.ts × 2 + system.test.ts × 2）。**真实情况扩展**：renderer + server-core 还有多处用户可见或共享映射残留：

**renderer (NNNN)**：

| 文件:行 | 内容 | 用户可见 |
|---|---|---|
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:229` | `parts.push(piLabel ?? 'Craft Agents Backend')` | AI Settings 页面 connection 卡 label |
| `AiSettingsPage.tsx:232` | `case 'pi_compat': parts.push('Craft Agents Backend Compatible'); break` | **U-API 走 pi_compat → 用户在 AI Settings 卡片看到"Craft Agents Backend Compatible"** |
| `AiSettingsPage.tsx:506` | `conn.providerType === 'pi' ? 'Craft Agents Backend' : ...` | connection 详情区 |
| `AiSettingsPage.tsx:921, 922` | 同样的 provider label 显示逻辑 | 设置页其他位置 |
| **`apps/electron/src/renderer/lib/provider-icons.ts:58-59`** （Round 45 补遗） | `pi: 'Craft Agents Backend'` / `pi_compat: 'Craft Agents Backend'` | 共享 provider label 映射，设置页/连接列表/模型 UI 复用时会外溢 |
| **`apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx:370,380`** （Round 45 补遗） | `'Craft Agents Backend': []` / `groups['Craft Agents Backend'].push(conn)` | 输入框模型/连接分组名，用户在选择模型/连接时直接看到 |
| **`apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx:126`** （Round 45 补遗） | `Craft Agents Backend (Direct)` | 非 U-API 分支若漏守卫，onboarding/API 设置会显示旧品牌；即使分支隐藏，也应纳入 grep 验收 |

**server-core (PPPP)**：

| 文件:行 | 内容 | 用户可见 |
|---|---|---|
| `packages/server-core/src/domain/connection-setup-logic.ts:30` | error message `'Provider mismatch during setup. Select a provider preset in Craft Agents Backend API Key mode, or use Anthropic API Key mode for arbitrary compatible endpoints.'` | **用户错误对话框直接看到** |
| `connection-setup-logic.ts:63` | `error: 'Custom endpoint in Craft Agents Backend mode requires selecting a provider preset. ...'` | 同上 |
| `connection-setup-logic.ts:162` | `BUILT_IN_CONNECTION_TEMPLATES['pi-api-key']: { name: 'Craft Agents Backend (API Key)', ... }` | 上游内置连接模板的 name 字段；**M1 用户走 'u-api-default' 模板（已在 #17b 加），但上游模板仍存在**——M1 是否裁掉？ |
| `packages/server-core/src/handlers/rpc/llm-connections.ts:135/138` | `updates.name = \`Craft Agents Backend (${providerName})\`` | **Round 38 补遗：运行时写入 config 的 connection name**。用户选择 custom endpoint/provider preset 时会把 `Craft Agents Backend (...)` 写进 `config.json`，随后设置页/日志都可能展示 |

**M1 改造方案**：

| 文件 | 改动 |
|---|---|
| `AiSettingsPage.tsx:229, 506, 921` | `'Craft Agents Backend'` → `'U-API'`（pi 走 newapi 兼容时与 §2.22 diagnostics.ts:139 同步）|
| `AiSettingsPage.tsx:232, 922` | `'Craft Agents Backend Compatible'` → `'U-API Compatible'` 或 `'U-API'`（pi_compat 是 U-API 走的路径，统一显示）|
| `provider-icons.ts:58-59` | `pi` / `pi_compat` 的共享 label 改为 `'U-API'`，避免其他 UI 复用时漏改 |
| `FreeFormInput.tsx:370,380` | 连接/模型分组名 `'Craft Agents Backend'` → `'U-API'` |
| `ApiKeyInput.tsx:126` | `Craft Agents Backend (Direct)` → `U-API (Direct)` 或随非 U-API 分支隐藏一起 dead-code 标注 |
| `connection-setup-logic.ts:30, 63` | error message 改 `'Craft Agents Backend ... mode'` → `'U-API ... mode'`（与 UI 一致）|
| `llm-connections.ts:135/138` | `updates.name = \`Craft Agents Backend (${providerName})\`` → `updates.name = \`U-API (${providerName})\``，避免 runtime 写入的 connection name 残留上游品牌 |
| `connection-setup-logic.ts:162` | **保留 `'Craft Agents Backend (API Key)'`**——上游内置 'pi-api-key' 模板不被 U-API 用户触发（M1 #17b 加 'u-api-default' 后 U-API 用户走新模板），但模板本身是 `craftAgentsBackend` provider 的 fallback；改名会破坏上游测试 fixture（`pi-api-key` slug）|

**关键决策**：connection-setup-logic.ts:162 模板 name **保留不改**——理由：
- 用户在 UI 上看不到（M1 onboarding 不走老模板）
- 改名会破坏上游测试（`'pi-api-key'` slug 是上游测试 fixture 用的）
- 与上游同步友好

**验证 grep**：

```bash
# 改造前 P0 必改应找到 12+ 处（不含 connection-setup-logic.ts:162）
grep -rnE "Craft Agents Backend" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx apps/electron/src/renderer/lib/provider-icons.ts apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx packages/server-core/src/domain/connection-setup-logic.ts packages/server-core/src/handlers/rpc/llm-connections.ts

# 改造后剩余 1 处（connection-setup-logic.ts:162 内置模板 name 保留作上游 fixture）
```

> ⚠️ **i18n 待办（M2）**：所有 5 处 `AiSettingsPage` 的 label 是硬编码英文，M2 中文化阶段统一走 `i18n.t('aiSettings.providerLabel.uapi')` 等 key（M1 字面量替换够用，因 M1 用户主要看英文 UI）。

### 2.32 网络拦截层 + Pi 模型 description + HTTP User-Agent —— **7 处用户/外部可见 craft 字面量**（**P0 网络层暴露**）

**问题（QQQQ + TTTT-C + Round 40 真发现）**：

7 处分布在 `packages/shared/` + `packages/pi-agent-server/`，都是网络层用户/外部可见：

| 文件:行 | 内容 | 暴露面 |
|---|---|---|
| `packages/shared/src/unified-network-interceptor.ts:2062` | error message `'Craft Agents blocked an outgoing request that the API would reject: ${err.detail}. ...'` | **API 错误对话框 / dev console 用户可见** |
| `packages/shared/src/unified-network-interceptor.ts:2073` | `statusText: 'Bad Request (blocked by Craft Agents)'` | HTTP response 拦截后的 status text，dev tools Network tab 可见 |
| `packages/shared/src/config/models-pi.ts:35` | `description: \`${m.provider} model via Craft Agents Backend\`` | **AI Settings 模型选择 dropdown 用户直接看到** |
| `packages/pi-agent-server/src/tools/web-fetch.ts:362` | `'User-Agent': 'Mozilla/5.0 (compatible; CraftAgent/1.0)'` | **第三方网站日志看到 CraftAgent UA** —— 用户/网站运营都能看到 |
| `packages/shared/src/auth/claude-oauth.ts:174` | `'User-Agent': `CraftAgents/${APP_VERSION}`` | Claude OAuth token exchange 请求头，Anthropic/中转服务日志可见 |
| `packages/shared/src/auth/claude-token.ts:32` | `'User-Agent': `CraftAgents/${APP_VERSION}`` | Claude refresh token 请求头，外部 auth 服务日志可见 |
| `packages/shared/src/utils/icon.ts:143` | `'User-Agent': 'Craft-Agent/1.0'` | 下载 Source / Tool icon 时，任意第三方 icon host 日志可见 |

**M1 改造方案**：

| 文件:行 | 改动 |
|---|---|
| `unified-network-interceptor.ts:2062` | `'Craft Agents blocked an outgoing request ...'` → `'U Agents blocked an outgoing request ...'` |
| `unified-network-interceptor.ts:2073` | `statusText: 'Bad Request (blocked by Craft Agents)'` → `'Bad Request (blocked by U Agents)'` |
| `models-pi.ts:35` | `\`${m.provider} model via Craft Agents Backend\`` → `\`${m.provider} model via U-API\``（与 §2.31 AiSettingsPage label 一致）|
| `web-fetch.ts:362` | `'User-Agent': 'Mozilla/5.0 (compatible; CraftAgent/1.0)'` → `'User-Agent': 'Mozilla/5.0 (compatible; UAgents/1.0)'` |
| `claude-oauth.ts:174` | `'User-Agent': `CraftAgents/${APP_VERSION}`` → `'User-Agent': `UAgents/${APP_VERSION}`` |
| `claude-token.ts:32` | `'User-Agent': `CraftAgents/${APP_VERSION}`` → `'User-Agent': `UAgents/${APP_VERSION}`` |
| `utils/icon.ts:143` | `'User-Agent': 'Craft-Agent/1.0'` → `'User-Agent': 'UAgents/1.0'` |

**验证 grep**：

```bash
# 改造前应找到 7 处
grep -rnE "Craft Agents blocked\|by Craft Agents\|CraftAgents/\|Craft-Agent/1\\.0\|CraftAgent/1\\.0\|model via Craft Agents Backend" packages/shared packages/pi-agent-server

# 改造后应为 0
```

> ⚠️ **User-Agent 关联**：`web-fetch.ts:362` 是 `WebFetch` 工具用的 UA。第三方网站访问日志会记录到 `compatible; CraftAgent/1.0`。M1 改 UA 名 = 让网站运营把流量归类到我们；保留 = 流量被错归到上游 craft 仓库（**不利于品牌建立**）。

> ⚠️ **i18n 待办（M2）**：unified-network-interceptor 错误消息硬编码英文；M2 中文化时改走 i18n + zh-Hans 翻译。

### 2.33 Messaging Gateway —— **3 处用户可见品牌字面量**（**P0 Telegram bot + WhatsApp 设备名 + 临时文件名**）

**问题（TTTT 真发现）**：

`packages/messaging-gateway/` + `packages/messaging-whatsapp-worker/` 有 3 处用户**直接可见**品牌字面量：

| 文件:行 | 内容 | 暴露面 |
|---|---|---|
| `packages/messaging-gateway/src/commands.ts:302` | Telegram bot 回复 `'Usage: /pair <6-digit code>\n\nGenerate a code from the session menu or the Telegram supergroup setup in the Craft Agent app.'` | **用户在 Telegram 收到的 bot 回复** |
| `packages/messaging-whatsapp-worker/src/worker.ts:259` | `browser: baileys.Browsers.macOS('Craft Agent')` | **用户在 WhatsApp Linked Devices 列表看到 'Craft Agent' 设备名** |
| `packages/messaging-gateway/src/adapters/telegram/index.ts:588` | 临时文件名 `\`craft-agent-messaging-${randomBytes(8).toString('hex')}${ext}\`` | **接收方在 Telegram 看到 attachment 文件名 craft-agent-messaging-xxxxx.jpg** |

**M1 改造方案**：

| 文件:行 | 改动 |
|---|---|
| `commands.ts:302` | `'... in the Craft Agent app.'` → `'... in the U Agents app.'` |
| `worker.ts:259` | `baileys.Browsers.macOS('Craft Agent')` → `baileys.Browsers.macOS('U Agents')` |
| `telegram/index.ts:588` | `\`craft-agent-messaging-${...}${ext}\`` → `\`u-agents-messaging-${...}${ext}\`` |

**验证 grep**：

```bash
# 改造前应找到 3 处
grep -rnE "in the Craft Agent app\|Browsers\.macOS\('Craft Agent'\)\|craft-agent-messaging-" packages/messaging-gateway packages/messaging-whatsapp-worker

# 改造后应为 0
```

> ⚠️ **WhatsApp 设备名持久化**：用户首次 link WhatsApp 时设备名持久化在 WhatsApp server。改 'Craft Agent' → 'U Agents' 后**老用户 link 仍显示旧名**（除非 unlink + relink）。M1 用户群是新装机，不影响；老用户升级要 release-notes 备注。

> ⚠️ **关联 §2.21 package.json**：messaging-gateway / messaging-whatsapp-worker 这 2 个 package 的 description 字段已在 §2.21 11 #11g 改造（"Messaging gateway for U Agents"）。

### 2.34 `packages/ui/src/components/chat/SessionViewer.tsx` —— **CraftAgentLogo viewer 组件**（**P1 viewer 不发布但 packages/ui 是 shared lib**）

**问题（SSSS 真发现）**：

`packages/ui/src/components/chat/SessionViewer.tsx:52, 54, 228`：

```tsx
// L52 注释
// CraftAgentLogo - The Craft Agent "C" logo for branding

// L54 组件定义
function CraftAgentLogo({ className }: { className?: string }) {
  return (<svg viewBox="0 0 32 32" .../>)  // craft 紫色 "C" logo SVG
}

// L228 调用方
<CraftAgentLogo className="w-8 h-8 text-[#9570BE]/40" />
```

**M1 处理决策**：

| 选项 | 操作 | 取舍 |
|---|---|---|
| **A. 改名 + SVG 替换（推荐）** | `CraftAgentLogo` → `UAgentsLogo` + SVG path 替换为 U Agents 字符 | viewer M1 不发布但 packages/ui 是 shared lib，typecheck 必须通过；与 §2.28 CraftAgentsSymbol 决策一致 |
| B. 保留 | 同上游 | M1 不发布 viewer 时**用户看不到**，但 grep `Craft` 命中数增加；上游同步不冲突 |

**M1 推荐方案 A**：与 §2.28 一致原则——只要是组件名 + SVG 内容都改造，避免 typecheck 时 grep 大量误命中。

### 2.35 packages/ui Shiki theme `craft-dark/craft-light` —— **决策保留不改**（**M2 评估**）

**问题（SSSS 决策）**：

`packages/ui/src/components/code-viewer/registerShikiThemes.ts` 含：
- `GLOBAL_THEME_KEY = '__craftShikiThemesRegistered__'` —— global window 单例 key
- `registerCraftShikiThemes()` —— 公开导出函数名
- `'craft-dark' / 'craft-light'` —— Shiki theme 名（注册到 Shiki engine）
- 关联 `MarkdownDiffBlock.tsx` / `UnifiedDiffViewer.tsx` 多处引用

**为什么 M1 保留**：
1. **影响低**：theme 名 `craft-dark/craft-light` 只在 Shiki engine 内部使用，没有 UI 让用户选 theme 名；用户看到的是渲染后的代码高亮效果
2. **改名风险**：`__craftShikiThemesRegistered__` 是全局单例 key，若上游同步引入新代码也用此 key，改名后**双重注册** Shiki theme（性能问题）
3. **公开 API**：`registerCraftShikiThemes` 是 packages/ui 公开 API，改名所有调用方需同步（影响 renderer 多处）

**M1 决策**：保留不改；M2 重构 packages/ui 时统一改 `craft-*` → `u-agents-*`（含 codemod）。

**记入 LEGAL §5 已知瑕疵**：用户解 packed app + dev tools inspect 可能看到 Shiki theme 名 `craft-dark`，与 §2.18 craftagents:// scheme / §2.20 CRAFT_* env vars 改造后**剩余的最深层 craft 命名残留**之一。

### 2.36 边缘 apps（cli/webui/viewer）M1 处理决策（**Round 47 A6 修正：标题原说"M1 不改"但实际有部分必改**）

**问题（RRRR 决策 + Round 41 补全清单）**：

3 个边缘 app M1 都不发布：
- **`apps/cli/`** — `craftAgentsCli` flag 默认 false（与 LEGAL §5.4 一致），不激活
- **`apps/webui/`** — M3 自建 OAuth relay 时启用，M1 不发
- **`apps/viewer/`** — M3 自建会话 viewer 时启用，M1 不发

**craft 字面量量级**（grep 全清单）：

| App | craft 字面量数 | 主要内容 |
|---|---|---|
| `apps/cli/src/index.ts` | ~15 处 | `craft-cli` CLI usage banner / examples / `craft-public` MCP source 引用 / `[source:craft-public]` test query |
| `apps/cli/src/server-spawner.ts` + 其他 | ~3 处 | 注释 |
| `apps/cli/src/{commands,run}.test.ts` | ~6 处 | 测试 fixture `craft-kb` / `craft-public` source slug |
| `apps/webui/src/index.html:6` | 1 处 | `<title>Craft Agents</title>` —— WebUI 浏览器标题 |
| `apps/webui/src/login.html:6, 228, 237` | 3 处 | `<title>Craft Agents — Login</title>` / `<h1>Craft Agents</h1>` / `placeholder="Enter CRAFT_SERVER_TOKEN"` |
| `apps/webui/src/public/manifest.json:2-3` | 2 处 | PWA `name` / `short_name` 仍是 `Craft Agents` |
| `apps/webui/src/public/*icon*` | 多个二进制资源 | favicon / apple-touch-icon / PWA icon 仍疑似上游 Craft 图标，启用 WebUI 前必须替换 |
| `apps/webui/src/adapter/web-api.ts:95` | 1 处 | `craftagents://` deep link warning（已在 §2.18 #11d 覆盖）|
| `apps/viewer/index.html:6-7` | 2 处 | meta description + title 仍是 `Craft Agents Session Viewer` |
| `apps/viewer/src/components/Header.tsx:43-47` | 3 处 | header 链到 `https://agents.craft.do` + `title="Craft Agent"` + Craft logo（§3.1 已覆盖 href，但 title/logo 也要同改）|
| `apps/viewer/vite.config.ts:35` | 1 处 | dev proxy `https://agents.craft.do`（已在 §2.24 决策保留）|

**M1 决策**：**边缘 app 的用户界面内容保留不清洗，但构建/共享库/全局协议相关改造仍按 M1 任务执行**——边界如下：
1. M1 不发布 `apps/cli` / `apps/webui` / `apps/viewer` 的用户入口（`scripts/install-app.sh` / `scripts/install-app.ps1` 已知 LEGAL §5.4 保留不引用）
2. 但 NPM scope、共享组件 import、`craftagents://` 全局协议、typecheck 必需的 config/exclude 仍要随 M1 改造同步处理（如 §2.18、§2.34、§2.36 表中已标出的 webui/vite/shared UI 项）
3. 不清洗的是“不会进入 M1 发布物或用户路径”的页面文案、demo fixture、PWA icon、CLI banner；这些启用前再统一白标

**M2/M3 启用前硬要求**：
- WebUI 启用前：`index.html` / `login.html` / `manifest.json` / favicon / apple-touch-icon / `icon-192.png` / `icon-512.png` 全部替换为 U Agents；`CRAFT_SERVER_TOKEN` placeholder 若 server env 仍保留旧名，页面文案也必须改成中性 `server token`，避免用户看到上游命名
- Viewer 启用前：`index.html` meta/title、`Header.tsx` href/title/logo、`packages/ui` viewer logo（§2.34）与分享 URL 全部替换；Plausible analytics（`apps/viewer/index.html:9-12`）必须评估是否使用 U Studio 自有统计或禁用；Google Fonts 远程字体（`apps/viewer/index.html:15-19`）必须改为自托管或本地字体，避免访问者向 Google 暴露 IP/UA/referrer 且影响国内可用性
- craftAgentsCli flag 永远不开启 → cli 永远不需改；若将来开启，先单独写 CLI 白标规格

**记入 LEGAL §5.4**：M1 已知保留 craft 字面量包括 cli + webui + viewer 三个 app（与 craftAgentsCli flag / OAuth relay / share viewer 决策一致）。

### 2.37 DOM 元素 ID + internal signal + window 属性 + Shiki theme key —— **DOM/页面协议层 craft 命名**（**P1 DevTools / 第三方网页可见**）

**问题（VVVV-B + WWWW-B 真发现）**：

这些运行时 DOM 元素 ID / internal signal / window global property / theme key 含 craft：

| 文件:行 | 内容 | 暴露面 |
|---|---|---|
| `apps/electron/src/main/browser-cdp.ts:490, 494, 567` | `document.getElementById('__craft_agent_screenshot_overlay__')` × 2 + `root.id = '__craft_agent_screenshot_overlay__'` | **第三方网页 DevTools 看到 craft 字样的 element id**（用户 inspect 自己访问的网页时看到）|
| `apps/electron/src/renderer/context/ThemeContext.tsx:351` | `const styleId = 'craft-theme-overrides'` —— 注入 `<style id="craft-theme-overrides">` 到 document head | **DevTools Elements panel 看到** |
| **Round 39 补遗** `apps/electron/src/main/browser-pane-manager.ts:41, 2404, 2981-2982` | `THEME_COLOR_SIGNAL_PREFIX = '__craft_theme_color__:'`，通过 console message 解析网页主题色 | **主进程与页面脚本的内部协议**，第三方页面 console / DevTools 可能看到 `__craft_theme_color__:` 前缀；必须 dispatch/parse 同步改 |
| `packages/ui/src/components/code-viewer/registerShikiThemes.ts:3` | `GLOBAL_THEME_KEY = '__craftShikiThemesRegistered__'` —— `(window as any).__craftShikiThemesRegistered__` 单例 key | **DevTools Console `window` 全局属性可见** |

**M1 改造方案**：

| 文件:行 | 改动 | 备注 |
|---|---|---|
| `browser-cdp.ts:490, 494, 567` | `'__craft_agent_screenshot_overlay__'` → `'__u_agents_screenshot_overlay__'` | **3 处必同步**：getElementById × 2 + root.id；不同步会让 overlay 不被找到 → 双 overlay 注入 |
| `ThemeContext.tsx:351` | `'craft-theme-overrides'` → `'u-agents-theme-overrides'` | DOM `<style>` 元素 ID |
| `browser-pane-manager.ts:41, 2404, 2981-2982` | `'__craft_theme_color__:'` → `'__u_agents_theme_color__:'` | **同一常量派生的注入脚本 + parser 必须同步**；不同步会导致主题色提取失效 |
| `registerShikiThemes.ts:3` | `'__craftShikiThemesRegistered__'` → 与 §2.35 决策一致**保留不改**（M2 重构 packages/ui 时统一改）| 改名风险中等（公开 packages/ui 调用方）|

**验证 grep**：

```bash
# 改造前应找到 8+ 处（overlay 3 + theme style 1 + theme signal 4；§2.35 Shiki key 暂保留）
grep -rnE "__craft_agent_screenshot_overlay__|'craft-theme-overrides'|__craft_theme_color__" apps/electron/src

# 改造后应为 0

# Round 41：localStorage 前缀单独验收（若 M1 改为 u-agents-，应只剩迁移 fallback 注释/兼容读取）
grep -rn "PREFIX = 'craft-'\|craft-" apps/electron/src/renderer/lib/local-storage.ts
```

> ⚠️ **关键 - browser-cdp 调试痕迹**：用户用 in-app browser 访问任意网页 → 用户右键 inspect → DevTools Elements 看到 `<div id="__craft_agent_screenshot_overlay__">` —— **暴露 fork 来源**。改名后用户看到 `__u_agents_screenshot_overlay__`，与产品名一致。

### 2.38 server-core transfer 临时目录名 —— **`craft-transfer-*` 运行时文件名残留**（**P2 外部低可见**）

**问题（Round 38 YYYY 补遗）**：

`packages/server-core/src/handlers/rpc/transfer.ts:121`：

```typescript
const dir = join(tmpdir(), `craft-transfer-${transferId}`)
```

这是运行时临时目录名，通常只在系统临时目录、错误日志或调试输出中可见；不是主 UI 文案，但属于可被用户/客服排障时看到的品牌残留。

**M1 改造方案**：

| 文件:行 | 当前 | 改为 |
|---|---|---|
| `packages/server-core/src/handlers/rpc/transfer.ts:121` | ``craft-transfer-${transferId}`` | ``u-agents-transfer-${transferId}`` 或 ``uagents-transfer-${transferId}``（推荐前者，和产品名一致）|
| `apps/cli/src/index.ts:1054` | ``mkdtemp(`${tmpdir()}/craft-validate-`)`` | M1 CLI 不发布，可保留；若 `validate:dev` / CI 输出被用户看到，M2 改 ``u-agents-validate-``。本项先列为已知低风险残留，不阻塞 M1 |

**验证 grep**：

```bash
# 改造前 M1 必改应找到 1 处
grep -rn "craft-transfer-" packages/server-core/src/handlers/rpc/transfer.ts

# 改造后应为 0

# 低风险 CLI 残留单独跟踪（M1 可保留）
grep -rn "craft-validate-" apps/cli/src/index.ts
```

### 2.39 server 启动日志 + bundled defaults + 持久化 key + playground/ 决策

**问题（UUUU + WWWW-D + Round 41/42 真发现）**：

这些是前几轮容易漏掉的“非主 UI 文案”残留：一部分 M1 必改，一部分必须明确保留/迁移策略。

| 类别 | 位置 | M1 决策 |
|---|---|---|
| **server 启动日志** | `packages/server-core/src/bootstrap/headless-start.ts:332` `'Craft Agent server listening on ${...}'` | **M1 修改** —— 改 `'U Agents server listening on ${...}'`；server 进程启动日志，dev 跑 server 时看到 |
| **bundled config defaults 描述** | `apps/electron/resources/config-defaults.json:3` `"Default configuration values for Craft Agents"` | **M1 修改** —— 这是随 Electron 包同步到用户配置目录的 JSON，用户/AI/排障都可能读到；改 `U Agents` |
| **bundled theme author** | `apps/electron/resources/themes/default.json:4` + `themes/haze.json:4` `"author": "Craft Agent"` | **M1 修改** —— 主题设置页/用户配置中可能展示 author；改 `U Agents` 或 `U Studio`（推荐 `U Studio`，表示发行方）|
| **bundled resources AGENTS.md** | `apps/electron/resources/AGENTS.md:3,16-21,38` 多处 `~/.craft-agent/...` + `craft-logos/` | **M1 注释/文档顺改** —— AGENTS.md 解释资源会同步到用户目录；§2.15 改 `CONFIG_DIR` 后必须同步写 `~/.u-agents/...`，否则后续 AI/执行者会按旧路径理解 |
| **bundled docs statuses 路径示例** | `apps/electron/resources/docs/statuses.md:7-8` `~/.craft-agent/workspaces/{id}/statuses/...` | **M1 修改** —— 这是内置 docs，会同步给用户/AI 读取；必须随 §2.15 改为 `~/.u-agents/workspaces/...`，并纳入 docs 资源 grep |
| **renderer localStorage prefix** | `apps/electron/src/renderer/lib/local-storage.ts:6` `const PREFIX = 'craft-'` | **M1 建议改并迁移** —— DevTools Application/Local Storage 可见；若直接改会丢 UI 状态。M1 新用户可改为 `u-agents-`；若已有种子用户，读旧 key fallback 后写新 key |
| **automation event source** | `packages/shared/src/automations/event-logger.ts:74` `source: 'craft-agent/automations'` | **M1 修改或双识别** —— `events.jsonl` 是持久事件日志/审计流；新写入应改 `u-agents/automations`，读取/过滤如有旧值需兼容 |
| **release notes 同步路径** | `packages/shared/src/release-notes/index.ts:4,16,34` 注释与运行时 `~/.craft-agent/release-notes/` | **M1 修改** —— 运行时路径必须复用 §2.15 的 `CONFIG_DIR`；注释同步改 `~/.u-agents/release-notes/`，否则 What's New 会继续创建旧目录 |
| **bundled release notes 内容** | `apps/electron/resources/release-notes/*.md` 多处 `Craft Agent` / `Craft Agents Backend` / `Craft-Agents-*` / `.craft-agent` / `agents.craft.do` / `docs.craft.do` / `craftagents://action/...` | **M1 修改或隐藏旧版本 notes** —— Release Notes/What's New 属于用户可见内容；若继续展示上游历史 notes，必须把产品名、安装包名、配置目录、docs URL 和 deeplink 全部改为 U Agents/U-API/`~/.u-agents`/自建 docs/`uagents://`，或仅保留 U Agents 自己版本的 notes |
| **WebUI cookie name** | `packages/server-core/src/webui/auth.ts:56` `SESSION_COOKIE_NAME = 'craft_session'` | **M2/M3 保留兼容项** —— WebUI M1 不发；启用前若改 `u_agents_session`，logout 必须同时清旧新 cookie，避免登录态残留 |
| **packages/core/types 注释** | `packages/core/src/index.ts:4` + `types/session.ts:5` + `types/workspace.ts:12` + `types/message.ts:525, 539` 共 5 处注释 | **M1 注释顺改** —— 与 § 2.22 P2 注释决策一致 |
| **playground/ 整目录** | `apps/electron/src/renderer/playground/` 共 ~20 处 craft（含示例 working dirs `/Users/demo/projects/craft-agent` / 模拟会话数据 'Craft App' / 'Craft Agent' / `craftagents://` deeplink demo / 用 `<CraftAgentsSymbol/>` / 注册名 `"name": "craft-agent"` 等）| **M1 保留不改** —— playground 是 dev 工具（开发者按特定快捷键打开），用户生产模式看不到；M2 重构 playground 时统一改 |
| **包级 README / CLI 文档示例**（Round 45 补遗） | `packages/core/README.md` 的 `@craft-agent/core` / `bun add @craft-agent/core` / import 示例、`packages/server-core/README.md` 标题、`docs/cli.md` 的 `git clone ...craft-agents...` / `cd craft-agents` | **M2 文档重写前先纳入白标清单** —— 这些是可复制命令/导入示例，会被 GitHub、npm 或 AI 摘要读取；NPM scope 改名不能只改 package.json，也要改 README/CLI docs |
| **server 生成模板**（Round 45 补遗） | `scripts/build-server.ts:742-763` 生成 `services: craft-server`、`craft-data:/root/.craft-agent`、`volumes: craft-data` | **M3/standalone server 启用前必改** —— 运行 build-server 后会生成可部署 docker-compose/systemd 模板；旧 service/volume/config 目录会进入用户服务器。M1 不发布 server 时可保留，但必须在 Server 分发任务中显式跟踪 |

**playground 决策细则**：

playground/ 含的所有 craft 字面量分两类：
- **示例数据**（recent-working-dirs / planner / browser-ui / markdown）：M1 保留——这些是模拟用户场景的 demo 数据，改了反而失真（演示场景仍然是 craft 自家产品的真实路径）
- **共享组件引用**（`<CraftAgentsSymbol/>` 在 PlaygroundApp.tsx:199）：与 §2.28 同步改名（`<UAgentsSymbol/>`），但 §2.28 改名 **自动覆盖** playground 调用——无独立任务

**记入 LEGAL §5**：M1 已知保留含 craft 字面量包括 playground/ demo 数据（与 cli/webui/viewer 决策一致），M2 评估清理。

### 2.40 Sentry / 第三方遥测 / 外部协议头（Round 42 隐私补遗）

**M1 决策**：不启用任何错误上报；`SENTRY_ELECTRON_INGEST_URL` 不设置。上游 `Sentry.init({ enabled: !!process.env.SENTRY_ELECTRON_INGEST_URL })` 在无 DSN 时不会发送事件。

**M2/M3 启用前必须先做隐私规格**：

| 位置 | 当前风险 | 启用前要求 |
|---|---|---|
| `apps/electron/src/main/index.ts:65-68` | 用 `hostname() + homedir()` hash 成稳定 `machineId` 并 `Sentry.setUser({ id })` | 必须写入隐私政策；如非必要，改为每安装随机 ID 或关闭 user id |
| `apps/electron/src/main/index.ts:621-627` | runtime hook 把 `sessionId` 作为 tag 发到 Sentry | 不允许上传原始 sessionId；改 hash/短期随机值，或完全移除 |
| `apps/electron/src/main/index.ts:1034-1038` | `authType` / `providerType` / `hasCustomEndpoint` / `model` / `workspaceCount` 作为 tags/context | 只允许低敏聚合字段；`model` 是否属于用户业务信息需单独评估 |
| `apps/electron/src/renderer/main.tsx:37-41` | `captureConsoleIntegration({ levels: ['error'] })` 会把 `console.error` 升级成事件 | 启用前必须确认 scrub 覆盖 message / exception / extra，不能上传 Token、路径、用户输入、模型输出 |
| `apps/electron/src/renderer/main.tsx:77-83` | ErrorBoundary 文案 `The error has been reported.` | M1 禁用 DSN 时文案必须改成“错误已记录/可复制”；只有真正启用上报并告知用户时才可说 reported |
| `apps/electron/src/renderer/components/app-shell/input/InputErrorBoundary.tsx:36-41` | `extra.sessionId` + componentStack 外发 | 不上传原始 sessionId；componentStack 可留但需脱敏 props |
| `apps/electron/src/renderer/event-processor/useEventProcessor.ts:24-41` | `new Error(errorEvent.error)` 可能包含模型/SDK 返回、命令输出、路径、用户输入 | 不允许原文外发；只发错误类型/短码，原文仅本地日志 |
| `apps/electron/src/main/index.ts:1185-1192` | `uncaughtException` / `unhandledRejection` 全局捕获可能带敏感上下文 | 启用前必须有 beforeSend 全链路脱敏测试 |
| `.env.example:29-31` | 示例 `SENTRY_ELECTRON_INGEST_URL=https://your-public-key@o0.ingest.sentry.io/0` 可能诱导接入第三方 Sentry | M1 改为空值/注释说明“默认禁用”；M3 自建后再给自有 DSN 示例 |
| `packages/shared/src/agent/backend/internal/drivers/pi.ts:19-22` | Copilot 兼容路径使用 `GitHubCopilotChat/...` 等 User-Agent/header | 这是兼容第三方 API 的协议头，不属于 U-API 主路径；若 M1 UI 已隐藏 Copilot，可保留。若未来开放，需评估透明度/合规说明 |

### 2.41 `tsconfig.json` paths 映射（**Round 46 P0 #1 NPM scope 任务漏覆盖**）

**问题（Round 46-A1 真发现）**：

#1 NPM scope 任务"全仓 `@craft-agent/` → `@u-agents/`"主要靠 codemod 改 `import` 语句，但**8 个 tsconfig.json 的 `compilerOptions.paths` 映射不在 import 语句里**——常规 codemod 会跳过。改名失败的症状：

- import 语句已改 `import { X } from '@u-agents/shared'`
- 但 tsconfig.json paths 仍是 `"@craft-agent/shared": [...]`
- → TypeScript 找不到 `@u-agents/shared` 的 paths 映射 → typecheck 失败 `Cannot find module '@u-agents/shared'`

**全部 8 个 tsconfig.json 必改**：

| 文件 | paths 数 | 内容 |
|---|---|---|
| `apps/electron/tsconfig.json:26-27` | 2 处 | `@craft-agent/shared` + `@craft-agent/shared/*` |
| `apps/cli/tsconfig.json:22-25` | 4 处 | `@craft-agent/shared` + `@craft-agent/shared/*` + `@craft-agent/server-core` + `@craft-agent/server-core/*` |
| `apps/webui/tsconfig.json:20-21` | 2 处 | `@craft-agent/shared` + `@craft-agent/shared/*` |
| `packages/server/tsconfig.json:22-26` | 6 处 | `@craft-agent/shared` × 2 + `@craft-agent/server-core` × 2 + `@craft-agent/core` × 2 |
| `packages/server-core/tsconfig.json:22-23` | 2 处 | `@craft-agent/shared` + `@craft-agent/shared/*` |
| `packages/shared/tsconfig.json:26-29` | 4 处 | `@craft-agent/core` × 2 + `@craft-agent/shared` × 2 |
| `packages/core/tsconfig.json:26-27` | 2 处 | `@craft-agent/core` + `@craft-agent/core/*` |
| `packages/ui/tsconfig.json:12-13` | 2 处 | `@craft-agent/core` + `@craft-agent/core/*` |

**总计 24 处** `@craft-agent/...` paths 映射，全改 `@u-agents/...`。

**关联 #1 任务**：
- **必须与 #1 同 commit 完成**（commit 1 验收 `bun run typecheck:all` 通过）
- 改顺序无所谓（codemod 先 / paths 先），同 commit 落地即可
- 验收：`grep -rn "@craft-agent" packages apps --include="tsconfig*.json"` 应为 0

> ⚠️ **bun.lock 自动重生**：根 package.json `"name"` + 所有 scoped name 改后，跑 `bun install` 会自动更新 `bun.lock` 顶部 metadata（无需手动改 lock 文件）。

### 2.42 配置文件 + CI + dotfiles + Docker craft 决策清单（**Round 46 综合**）

**Round 46 跨 4 个角度（A/B/C/D）扫出的所有非源码 craft 字面量**：

| # | 位置 | 类型 | M1 决策 |
|---|---|---|---|
| 1 | `.gitignore:58-59` `# Craft Agent local data` + `.craft-agent/` | dotfile | **🔴 P0 修改**：加一行 `.u-agents/`（保留 `.craft-agent/` 也无害，避免上游残留目录被 git 追踪）|
| 2 | `.env.example:4-5, 7-8` `CRAFT_MCP_URL` + `CRAFT_MCP_TOKEN` 注释 + 变量名 | dotfile | **已在 Round 44 #11f 覆盖** ✓ |
| 3 | `apps/electron/eslint.config.mjs:50-99` 6 个 inline ESLint 自定义 plugin namespace (`craft-agent` / `craft-platform` / `craft-paths` / `craft-links` / `craft-sources` / `craft-styles`) | dev tooling | **🟢 决策保留**：plugin 是 inline 定义在单文件内，**用户看不到**；改名要同步改所有 rule reference（约 20 处），增加上游同步成本无收益（与 §2.35 Shiki theme 决策一致）|
| 4 | `packages/ui/eslint.config.mjs:36-89` `craft-styles/no-*` 4 个 rule | 同上 | 同上保留 |
| 5 | `packages/shared/eslint.config.mjs:37-48` `craft-shared/no-*` 2 个 rule | 同上 | 同上保留 |
| 6 | `.github/workflows/validate.yml + validate-server.yml` | CI workflow | **🟢 安全确认**：grep 0 craft 命中 ✓ |
| 7 | `.github/ISSUE_TEMPLATE/feature_request.yml:8` "Have an idea for Craft Agents?" + `bug_report.yml:2,13,116` 4 处 craft（含 issue title / version label / 链接到 lukilabs/craft-agents-oss）| GitHub UI | **🟡 P1 删除整个目录**：M1 私有 fork 不接 GitHub Issues（用户支持走 `support@u-studio.cn`）；`rm -rf .github/ISSUE_TEMPLATE/` |
| 8 | `.husky/` git hooks | git tooling | **🟢 安全确认**：目录不存在（OSS 剥离）✓ |
| 9 | `Dockerfile.server` ~15 处 craft（image tag / `craftagents` user / `~/.craft-agent` volume / LABEL `org.opencontainers.image.source` / `COPY packages/craft-agents-commands/...` 引用不存在的 packages）| Docker | **🟢 决策保留**：M1 不发布 server / Docker（与 §2.36 cli/webui/viewer 决策一致）；Dockerfile 引用不存在的 packages → **build 必失败但 M1 不 build** → 安全 ✓；M2/M3 自建 server 时改；记入 LEGAL §5 已知瑕疵 |
| 10 | `.dockerignore` | dotfile | **🟢 安全确认**：grep 0 craft ✓ |
| 11 | `bun.lock` 大量 NPM scope `@craft-agent/...` 引用 | lock file | **🟢 自动重生**：根 package.json name 改后 `bun install` 自动重生 lock 文件，**不需要手动改** |
| 12 | 根 `tsconfig.json` | tsconfig | **🟢 安全确认**：根 tsconfig 仅 `"@/*": ["src/*"]` 通用 alias，**无 NPM scope 引用** ✓ |

**M1 必改清单总结**：
- ① `.gitignore` 加 `.u-agents/` 一行
- ⑦ 删除 `.github/ISSUE_TEMPLATE/` 整目录

其他 10 项全部**安全确认**或**决策保留**。

**验证 grep**：

```bash
# .gitignore 改后
grep -nE "u-agents" .gitignore  # 应找到 1+ 行

# .github/ISSUE_TEMPLATE 删后
[ ! -d .github/ISSUE_TEMPLATE ] && echo "OK"
```

> ⚠️ **`.github/` 目录其他文件保留**：`.github/workflows/` 是 CI 配置（M1 跑 typecheck 用）需要保留；`.github/CODEOWNERS` / `.github/dependabot.yml` 等若存在也保留。**只删 `ISSUE_TEMPLATE/` 子目录**。

> ⚠️ **ESLint 命名空间 grep 误命中**：未来若用户跑 `grep -rn "craft" .` 全仓扫品牌污染，会大量命中 eslint.config.mjs 的 `craft-*` plugin 名 + tsconfig.json 的 `@craft-agent/*` paths（虽然 §2.41 改了 tsconfig）+ Dockerfile.server 等保留项。**08 §grep 验证清单**应明示这些"决策保留"的预期命中数，避免错误警报。

### 2.43 文档自相矛盾审计清单（**Round 47 反向核对产出**）

**目的**：跑完 Round 28-46 共 18 轮"完整目录扫"，文档已扩到 6011 行 / 57 任务。本节做 14 份文档间的**交叉一致性审计**，找出数字过期 / 范围不同步 / 决策版本漂移 / 章节编号错乱。

**审计方法论**：
- 各章节标题/§2.0 总览中声明的"X 处" vs 表内实际行数
- 各章节决策"M1 不改" vs 任务清单是否实际改了
- §X 引用 §Y 是否仍指向有效内容
- §2.0 总览的子节编号 vs 文档实际章节顺序

**发现的 7 个矛盾**：

| # | 类型 | 位置 | 矛盾内容 | 严重度 | 修正动作 |
|---|---|---|---|---|---|
| **A1** | 数字过期 | 01 §2.0 行 59 vs §2.15 表 | §2.0 说"`paths.ts` 主声明 + **9 处**硬编码"；§2.15 表实际 **20 项**（含 Round 35/37/38/39/42 共补 11 项独立 CONFIG_DIR / 路径硬编码 / 注释）| 🟡 P1 数字过期 | **本轮即时修正 §2.0 行 59** "9 处" → "**20+ 处**（动态扩张中，详见 §2.15 全表）" |
| **A2** | 数字一致 | 01 §2.18 vs #11d | 都说 "renderer 11 处"；表内实际 11 行 ✓ | 🟢 一致 | 无需修正 |
| **A3** | 范围不同步 | 01 §2.19 表 vs 11 #11e 任务 | §2.19 表列 4 处文件；#11e 任务原列 11 处但**4 处路径全错**（外部 Round 43 写 `server-core/sessions/...` 但实际在 `shared/agent/...`）| 🔴 P0 表落后 + 任务路径错 | **Round 48 已处理** ✅：§2.19 表扩 9 行（含 toolNames / source-guides / sources/storage / mode-manager / source-manager / prerequisite-manager / pre-tool-use 修正路径 + **2 处新发现** `system.ts:650` + `sources/types.ts:518`）；#11e 任务路径修正 |
| **A4** | 数字过期 | 01 §2.31 标题 vs 表内 Round 45 补遗 | §2.31 标题 "AiSettingsPage 5 + connection-setup-logic 3 = **8 处**"；表内 Round 45 已加 provider-icons.ts (2) + FreeFormInput.tsx (2) + ApiKeyInput.tsx (1) = 5 处；**实际总数 13 处** | 🟡 P1 数字过期 | **本轮即时修正 §2.31 标题** "8 处" → "**13 处**（含 Round 45 补 provider-icons / FreeFormInput / ApiKeyInput 共 5 处）" |
| **A5** | 数字内部矛盾 | 01 §2.21 标题 vs 验证 grep 注释 | §2.21 标题："14 个 package.json 含 **60 处** craft"；§2.21 验证 grep 注释："改造前应找到约 **50 处**" | 🟡 P1 数字内部不一致 | **本轮即时修正 §2.21 验证 grep 注释** "约 50 处" → "**约 60 处**（与标题一致）" |
| **A6** | 决策漂移 | 01 §2.36 vs 11 #11d | §2.36 标题原说"M1 不改决策"过度简化；表内已隐含决策细化（webui/web-api.ts:95 标 "已在 §2.18 #11d 覆盖"）但标题/列描述仍误导 | 🟡 P1 标题误导 | **Round 48 已处理** ✅：§2.36 标题改为"M1 处理决策（部分必改）"；表内细节已在 Round 41 由外部 AI 改完整 |
| **A7** | 章节编号错乱 | 01 §2.0 总览 行 55-58 | §2.0 编号顺序：`2.13 → 2.13b → 2.14a → 2.14b → 2.14 → 2.15`；**§2.14 排在 §2.14a/§2.14b 之后**（实际章节位置也如此，行 290 §2.14 在行 262 §2.14b 之后）| 🟡 P1 编号错乱 | **修正建议**：§2.14 重命名为 §2.14c 或全部 §2.14* 重排；**M1 不重排**（影响所有交叉引用），仅本节标记记录；**M2 文档大版本时统一重命名** |
| **A8** | 任务路径错误（**Round 48 调查发现**）| 11 #11e 任务列的 4 个文件路径 | 外部 Round 43 写 `packages/server-core/src/sessions/{mode-manager,source-manager,prerequisite-manager,pre-tool-use}.ts` —— **4 个路径全错**！实际正确路径在 `packages/shared/src/agent/{mode-manager,core/source-manager,core/prerequisite-manager,core/pre-tool-use}.ts`（已 fuzzy find + grep 验证）| 🔴 P0 任务清单 hallucination | **Round 48 已处理** ✅：#11e 任务描述加 "Round 48 路径修正" 备注；§2.19 表用正确路径扩张 |
| **A9** | system.ts 范围漏覆盖（**Round 48 调查发现**）| 01 §2.12 + §2.19 都漏 | `packages/shared/src/prompts/system.ts:650` 含 `Search \`craft-agents-docs\` for service-specific guides` —— **system prompt 第 6 处 craft 字面量** + **第 12 处 craft-agents-docs MCP 引用**；§2.12 列了 5 处必改（L313/L430/L467/L470/L570）漏 L650；§2.19 也漏 | 🔴 P0 双重漏覆盖 | **Round 48 已处理** ✅：§2.19 表加 system.ts:650 行；**§2.12 也应同步加 L650**（待下次 §2.12 维护时补；本轮记录）|
| **B1** | UA token 一致性（**Round 49 反向 grep**）| 全仓 `UAgents/${VERSION}` HTTP UA token | 4 处 UA 字符串全部统一为 `UAgents/1.0` 或 `UAgents/${APP_VERSION}` ✓（与品牌名 `U Agents` 紧凑形式一致；DMG artifactName 用 `U-Agents` 连字符形式是 RFC 7231 token 限制 + 文件名易读的 2 种合法变体）| 🟢 一致 | 无需修正；**建议** §1 品牌四件套加注 "UA token 用 `UAgents`（无空格 PascalCase），DMG/产物文件名用 `U-Agents-${arch}`" |
| **B2** | URL 违反 §1 单域多路径规划（**Round 49 反向 grep**）| 01 §2.19 行 575 + §2.24 行 890 | §1 行 29-32 规定"只用 2 个 host：`u-agents.u-studio.cn`（主域多路径）+ `update.u-agents.u-studio.cn`（更新独立）"；但 2 处违反：① §2.19 写 `'https://docs.u-agents.u-studio.cn/mcp'`（应是主域 `/docs/mcp`）② §2.24 写 `https://share.u-agents.u-studio.cn`（应是主域 `/s/{shareId}`）| 🟡 P1 域名规划违规 | **Round 49 已处理** ✅：2 处全部修正为单域多路径形式 |
| **B3** | 邮箱一致性（**Round 49 反向 grep**）| `support@u-studio.cn` (6) + `agents@u-studio.cn` (4) + `*@craft.do` (8 处合规凭证) | 全部一致 ✓；上游 `*@craft.do` 邮箱保留作 LEGAL/SECURITY/CODE_OF_CONDUCT/NOTICE 合规凭证（与 LEGAL §2 Round 45 一致）| 🟢 一致 | 无需修正 |
| **B4** | Token URL 一致性（**Round 49 反向 grep**）| `token.u-studio.cn/v` (16) + `/console/token` (8) + `/console/topup` (5) + `/pricing` (3) | 全部走单域 `token.u-studio.cn` 多路径 ✓ | 🟢 一致 | 无需修正 |
| **B5** | typo 扫描（**Round 49 反向 grep**）| 全仓查 `u-studi[^o]` / `agnets` / `agnest` / `uagentss` / `u-aagents` | 0 命中 ✓ | 🟢 无 typo | 无需修正 |
| **A10** | M1-READINESS 文档数过期（**Round 51 整体 review 发现**）| M1-READINESS §1 说"14 份（11 份 .planning + 根 3 份）"；实际 .planning/ **12 份**（多了 M1-READINESS 自己），总数 **15 份** | 🟡 P1 数字过期 | **Round 51 已处理** ✅：M1-READINESS §1 修正为 15 份 |
| **A11** | 跨文档引用核对正确（**Round 51 整体 review 验证**）| §13.4 / §5.4 / §6.3 / §1.4 / §1.5 等跨文档 §X 引用全部 ✓ 在对应文档存在（09 §13.4 Sentry / LEGAL §5.4 ASAR / 02 §6.3 Provider 元信息 / 03 §1.4 APISetupStep / 03 §1.5 CredentialsStep）| 🟢 一致 | 无需修正；**经验**：A 类反向核对 grep 必须区分单文档 §X vs 跨文档 §X |
| **B6** | URL 误报澄清（**Round 51 整体 review**）| Round 49 修正过的 `docs.u-agents.u-studio.cn` / `share.u-agents.u-studio.cn` 仍出现在 §2.43 审计表的"修正描述"中（如"原写 X 违反 §1，改用主域 Y"），不是新违规 | 🟢 误报 | 无需修正；**审计 SOP 改进**：B2 grep 应排除审计表内的"修正历史"描述 |
| **B7** | 品牌变体 `U Agents` 减少 21 处（**Round 51 整体 review**）| Round 49 时 199 处 → Round 51 时 178 处；外部 AI 跑了几轮删除/重写部分章节 | 🟢 无矛盾 | 减少不代表错误，可能是删冗余；如担心遗漏，下次 A 审计可对比"应该出现 U Agents 的位置 vs 实际是否还在" |
| **C1** | 版本号策略变更（**Round 51 后用户决策变更**）| 原 §4.1 + 08 §3.1 决策"重置为 1.0.0 独立编号"；用户改为"跟随上游 release tag"（M1 已实际走 v0.9.0，详见 M1-READINESS §B1 + 12-*）| 🟢 决策变更 | **本轮已处理** ✅：01 §4.1 + 08 §3.1 两处同步改为"跟随上游 v0.9.0；hotfix 用 0.9.0+u-agents.N build metadata；不独立编号"；M1 首发 v0.9.0 与现状一致零成本 |
| **C2** | `automations.md` 46 处 `CRAFT_*` webhook 协议变量保留（**Round 52 决策**）| #11c 跑完后发现 5/5 文件中 4/5 已清零（sources/labels/permissions/skills），但 automations.md 仍 46 处——**全是 webhook 协议变量名 `$CRAFT_EVENT` / `$CRAFT_WH_*`，不是品牌词** | 🟢 决策保留 | **本轮已处理** ✅：§2.17 加 M1 保留决策；执行 AI 在 automations.md 顶部加"协议变量沿用上游"说明段；M2/M3 评估双名兼容方案 |
| **B8** | 任务路径 hallucination 检查（**Round 51 整体 review**）| 跑 `grep \`packages/...\\.ts\` 11-roadmap.md` + `ls` 验证：1 处 missing (`packages/shared/src/config/u-api-defaults.ts`) | 🟢 误报 | u-api-defaults.ts 是 #13 任务"新建文件"目标，**当前不存在是正常的**；**审计 SOP 改进**：A2 hallucination 检查应排除任务清单中标记为"新建"的文件 |

**Round 47 本轮即时修正**（A1 / A4 / A5）：见下方点状修正章节。

**Round 48 已处理**（A3 / A6）：见上表处理结果；保留本记录作为审计追踪。

**M2 文档大版本待办**（A7）：
- §2.14 / §2.14a / §2.14b 重排（影响所有交叉引用，M1 不动）

**长期建议**（文档收敛阶段必做）：

1. **每个新发现章节加"最后修订轮次"标记**：让数字一致性可追溯（如 "§2.31 (Round 31 NEW + Round 35 扩 + Round 45 补遗)"）
2. **§2.0 总览表每轮扫一遍**：作为各章节子项数字的"权威源"，扫描后对齐
3. **章节编号锁定**：M2 文档大版本前不再加新章节（只在已有章节内追加表行）；Round 47 后不应再有 §2.44+ 新章节，新发现归入已有 §2.X 内补遗
4. **A+B 反向核对机制化为月度 SOP**（**Round 50**）：详见 `07-upstream-sync.md §2.7b`，已加入月度同步流程必跑步骤；A 类（文档自相矛盾）+ B 类（反向 grep）每月固定跑 1 次，避免数字过期 / 任务路径 hallucination / 域名规划悄悄违规累积

---

## 4. 三级：package.json 与 NPM scope（机械性替换）

### 4.1 根 `package.json`

```json
{
  "name": "craft-agent",  // → "u-agents"
  "version": "0.9.0",     // 保持不动，跟随上游 release tag（详见决策说明）
  ...
}
```

**版本号策略：跟随上游**（**Round 51+ 决策变更**）：

| 项 | 决策 |
|---|---|
| **M1 首版** | 保持上游 `v0.9.0` 不重置（事实上 M1 试装已经走过 v0.9.0，详见 `M1-READINESS.md §B1` + `12-subprocess-build-pipeline.md`）|
| **M2/M3+ 跟随** | 上游打 v0.10.0 → 我们也是 v0.10.0；上游 v1.0.0 → 我们也 v1.0.0；**不独立编号** |
| **patch 版本（紧急 hotfix）** | 允许在上游版本号后追加 build metadata：如 `0.9.0+u-agents.1`、`0.9.0+u-agents.2`（SemVer build metadata 部分不影响版本比较）|
| **取舍** | ✅ 与上游同步路径清晰，用户可直接对照上游 release notes ✅ electron-updater `latest.yml` 版本比较逻辑不会与上游冲突 ❌ 用户看到非"1.0.0"起步的版本号，需 release notes 解释"沿用上游版本号" |

> ⚠️ **本决策替代之前的"重置为 1.0.0"决策**：原决策（独立编号）是 M1 收敛前的提案；外部 AI 跑了几轮后实际已经走 v0.9.0，且 `M1-READINESS §B1` / `12-*` 等文档已大量引用 "M1 v0.9.0"——保持现状成本最低。

### 4.2 子包 NPM scope（15 个 package.json）

| 当前 name | 改为 |
|---|---|
| `@craft-agent/ui` | `@u-agents/ui` |
| `@craft-agent/core` | `@u-agents/core` |
| `@craft-agent/messaging-whatsapp-worker` | `@u-agents/messaging-whatsapp-worker` |
| `@craft-agent/session-tools-core` | `@u-agents/session-tools-core` |
| `@craft-agent/server` | `@u-agents/server` |
| `@craft-agent/shared` | `@u-agents/shared` |
| `@craft-agent/pi-agent-server` | `@u-agents/pi-agent-server` |
| `@craft-agent/server-core` | `@u-agents/server-core` |
| `@craft-agent/messaging-gateway` | `@u-agents/messaging-gateway` |
| `@craft-agent/session-mcp-server` | `@u-agents/session-mcp-server` |
| `@craft-agent/cli` | `@u-agents/cli` |
| `@craft-agent/viewer` | `@u-agents/viewer` |
| `@craft-agent/webui` | `@u-agents/webui` |
| `@craft-agent/electron` | `@u-agents/electron` |

### 4.3 `package.json` 中的 homepage / email / support

- `apps/electron/package.json:9-11`：
  - `"email": "support@craft.do"` → `"support@u-studio.cn"`
  - `"homepage": "https://agents.craft.do"` → `"https://u-agents.u-studio.cn"`
- `packages/server/package.json:18-21`：同上替换

### 4.4 全仓库的 import 替换

把所有 TS/TSX 文件里的 `from "@craft-agent/...` 替换为 `from "@u-agents/..."`。

```bash
# 执行前先 git status 确认无未提交修改

# === 跨平台版本（推荐：用 perl 避免 sed BSD/GNU 差异）===
grep -rl "@craft-agent/" --include="*.ts" --include="*.tsx" --include="*.json" . \
  | xargs perl -pi -e 's|@craft-agent/|@u-agents/|g'

# === 仅 macOS（BSD sed）===
# grep -rl "@craft-agent/" --include="*.ts" --include="*.tsx" --include="*.json" . \
#   | xargs sed -i '' 's|@craft-agent/|@u-agents/|g'

# === 仅 Linux（GNU sed）===
# grep -rl "@craft-agent/" --include="*.ts" --include="*.tsx" --include="*.json" . \
#   | xargs sed -i 's|@craft-agent/|@u-agents/|g'
```

⚠️ **关于 sed 跨平台**：
- macOS BSD sed 要求 `-i ''`（必须有空字符串）
- Linux GNU sed 要求 `-i`（不能有空字符串）
- 同一条命令在两个平台**互不兼容**——CI 跑会立即失败
- **首选 `perl -pi -e`**，所有平台行为一致
- `--include` 参数避免误改 `.md` / `.lock` / `.yml`，但**仍会进入 node_modules**（虽然 monorepo 用 symlink，影响有限）

替换后**必须**：
1. 重新跑 `bun install`（重建 lockfile，否则 96 处 `@craft-agent` 残留在 `bun.lock` 中）
2. 跑 `bun run typecheck:all` 确认所有 import 路径仍解析
3. **顺手处理** `apps/online-docs/`：它被 workspaces 排除（`!apps/online-docs`），但里面也可能有 `@craft-agent` 引用——本表的命令会改它，但 bun install 不安装它。M1 阶段**不发布** online-docs，影响有限。M3 自建文档站时再决定要不要保留这个目录。

⚠️ **`tsconfig.json` 中的 `paths` alias 已被自动覆盖**：

`packages/shared/tsconfig.json` / `packages/server-core/tsconfig.json` 等含 TypeScript paths：
```json
"paths": {
  "@craft-agent/core": ["../core/src/index.ts"],
  "@craft-agent/core/*": ["../core/src/*"],
  "@craft-agent/shared": ["./src/index.ts"],
  "@craft-agent/shared/*": ["./src/*"]
}
```

由于上面的 sed 命令 `--include="*.json"` 会扫描 `tsconfig.json`，**paths 的 keys 会被自动替换**为 `@u-agents/core` 等。**values**（如 `../core/src/index.ts`）不含 `@craft-agent/` 字串，不会受影响。

**验证**：替换后 `grep "@craft-agent" packages/*/tsconfig.json` 应返回 0 行。

---

## 5. 四级：i18n 与显示字符串

### 5.1 i18n locale 文件

`packages/shared/src/i18n/locales/{lang}.json` 中 "Craft Agents" / "Craft" 字面量替换。

**策略**：
- `en.json` 中所有 `"Craft Agents"` → `"U Agents"`
- `en.json` 中所有 `"Craft"`（独立词）→ `"U Agents"`
- `zh-Hans.json` 同上 + 加入"优智体"作为可选中文显示
- 其他语言（es, ja, de, hu, pl）按英文同等替换

**重点 keys**（来自上游 `packages/shared/CLAUDE.md` 的 i18n 章节）：
- `onboarding.welcome.title` 等含品牌词
- `menu.about` 中的"About Craft Agents"
- 任何含 "Craft" 的描述性文案

详细替换由 `.planning/10-i18n-zh.md` 接手。

### 5.2 React 组件中的硬编码字面量（约 390 处）

来源扫描：`grep -rEn "Craft Agents?" --include="*.ts" --include="*.tsx"`

**策略**：
- 优先：把硬编码字符串替换为 i18n key（用 `t("...")`）
- 退而求其次：直接替换字符串字面量

**关键组件**（必改）：
- `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx` 重命名为 `UAgentsSymbol.tsx`
- 所有 import 引用同步更新
- React 组件 displayName / class name 中的 "Craft" / "CraftAgent" 替换

---

## 6. 五级：注释、JSDoc、文档（可选保留）

| 文件类 | 是否替换 |
|---|---|
| `// Comment` 中提到 "Craft Agents" 的部分 | **保留**（事实陈述："基于 Craft Agents 派生"是合规的） |
| JSDoc `@author` / `@module` | 替换为 U Agents |
| `README.md`（顶层）| **完全重写**为 U Agents 版本（M2 阶段） |
| `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` | 内部使用可保留，公开发布前重写 |
| `TRADEMARK.md` | **保留**（合规凭证） |
| `LICENSE` | **永不修改** |
| `NOTICE` | 在底部追加我们的派生作品声明（详见 `LEGAL.md`） |

---

## 7. NOTICE 文件追加（合规必做）

在 `NOTICE` 末尾追加（不修改原内容）：

```
---

This product is "U Agents" (优智体), a derivative work based on
Craft Agents (https://github.com/lukilabs/craft-agents-oss),
licensed under the Apache License, Version 2.0.

Modifications and additional code in this distribution are
Copyright © 2026 U Studio (tungwerl@gmail.com).
```

---

## 8. 验收清单（白标完成判定）

执行如下命令应**全部返回 0 行**或仅返回**注释/合规文件**：

```bash
# 命令 1：用户可见的 Craft 字面量（应只返回 i18n 注释、TRADEMARK.md、NOTICE 等合规文件）
grep -rEn "Craft Agents?" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" \
  --include="*.html" \
  | grep -v node_modules \
  | grep -v __tests__ \
  | grep -v "TRADEMARK.md" \
  | grep -v "NOTICE"

# 命令 2：生产代码的 craft.do 域名（M1 阶段允许 oauth-relay.ts / slack-oauth.ts 暂不改）
grep -rEn "craft\.do" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" \
  --include="*.sh" --include="*.ps1" \
  | grep -v node_modules \
  | grep -v __tests__ \
  | grep -v "url-validator.ts" \
  | grep -v "oauth-relay.ts" \
  | grep -v "slack-oauth.ts"
# ↑ M1 应只剩下方括号里这三个文件的引用（已知瑕疵）

# 命令 3：包名残留
grep -rE '"@craft-agent/' --include="*.json" --include="*.ts" --include="*.tsx" \
  | grep -v node_modules
# ↑ 应返回 0 行

# 命令 4：Bundle ID 残留
grep -rE 'com\.lukilabs' . | grep -v node_modules
# ↑ 应返回 0 行
```

---

## 9. 与上游同步时的执行顺序

每次合并上游变更后（详见 `.planning/07-upstream-sync.md`）：

1. 先合并冲突
2. 跑命令 1-4 看哪些 craft 字符串被引入了
3. 按本表对应章节处理
4. 跑 typecheck 确认无破坏
5. 跑 `.planning/09-test-checklist.md`
6. 通过后合并到主分支
