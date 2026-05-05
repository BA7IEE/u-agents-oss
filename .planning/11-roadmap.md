# 11 — 阶段路线图

> 本图给后续文档提供时间锚点。其他 `.planning/0X-*.md` 中所有"M1/M2/M3 决策"指向本图。
> 修改本图前应当先和用户对齐。

---

## 阶段总览

| 阶段 | 目标 | 完成判据（出口）| 估期 |
|---|---|---|---|
| **M1** | 最小可白标桌面端 | 自购 macOS 上能装能用，对话能走通 U-API | 第 1 优先 |
| **M2** | 多平台稳定 + 可分发 | Windows/Linux 安装包齐全，自动更新走通，国内 5 个种子用户使用无大 bug | M1 完成后 |
| **M3** | 自主权扩展 | 自建 OAuth relay，消除 craft.do 残留瑕疵 | M2 完成后 |
| **M4+** | 长期维护 | 每月按 SOP 同步上游，跟随版本节奏迭代 | 持续 |

---

## M1 — 最小可白标桌面端

**入口条件**：
- ✅ 5 份核心规格文档（CLAUDE / PRODUCT / LEGAL / 01 / 02）已就绪
- ✅ 9 份延伸规格文档（03 ~ 10）就绪
- ⏳ `update.u-agents.u-studio.cn` 子域已建（哪怕只返回占位 404 也行，避免 DNS 解析失败）
- ⏳ U-API 中转站已开通（`token.u-studio.cn` 已就位 ✅）
- ❌ Apple Developer 账号 / 公证 —— **M1 不需要**（M1 走 adhoc 签名）

**本地环境约束**：
- **Bun（强制，不可换 npm/yarn/pnpm）**：
  - 建议与上游锁定版本保持一致或更高（上游 `scripts/build/common.ts` 中 `BUN_VERSION = 'bun-v1.3.9'`，这是**构建产物中要 bundle 的 bun 版本**——不是说本地 bun 必须严格 ≥ 1.3.9 才能跑 typecheck，但低于此版本时若构建/typecheck 异常，第一优先级是对齐到 1.3.9）
  - **绝不要**用 `npm install` / `yarn install` / `pnpm install` 替代 `bun install`：上游 monorepo 用 `bun.lock`（不是 `package-lock.json`），换包管理会破坏 lockfile + 部分 npm scripts 用 `bun run tsc` 形式找不到 binary
  - 包管理唯一允许命令：`bun install` / `bun run <script>` / `bun test`
  - M1 执行前先 `bun --version` 记录版本，遇到诡异错误时回这里对齐
- Node.js ≥ 18（Electron 39 要求）
- macOS arm64 或 x64（M1 仅出 macOS DMG）
- 磁盘空间 ≥ 10GB（monorepo + node_modules + electron 打包产物）

**⚠️ OSS 已剥离脚本清单（执行 AI 必读，避免跑命令立即撞墙）**：

上游 OSS 版本剥离了 8 个 scripts/* 文件，但 `package.json` 仍保留对它们的引用。**M1 阶段绝不要**跑下面这些 npm script：

| ❌ 不要跑的 npm script | 调用的缺失文件 | 影响 |
|---|---|---|
| `bun run lint` | `scripts/check-raw-sends.sh`（`lint:ipc-sends` 链）| 立即 exit 127 → 整个 lint 失败 |
| `bun run lint:ipc-sends` | 同上 | 同上 |
| `bun run lint:i18n:staged` | `scripts/lint-i18n-staged.sh` | 同上 |
| `bun run typecheck:staged` | `scripts/typecheck-staged.sh` | 同上 |
| `bun run build` | `scripts/build.ts` | 同上 |
| `bun run release` | `scripts/release.ts` | 同上 |
| `bun run check-version` | `scripts/check-version.ts` | 同上 |
| `bun run oss:sync` | `scripts/oss-sync.ts` | 同上 |
| `bun run fresh-start` / `fresh-start:token` | `scripts/fresh-start.ts` | 同上（详见 `04-feature-cuts.md` §8 中 i18n 文案修复 #26b）|

**M1 阶段允许跑的 npm scripts**（已在 M1 出口条件中明确）：
- ✅ `bun install`
- ✅ `bun run typecheck:all`（不调 typecheck:staged）
- ✅ `bun run lint:i18n:parity`（不调 lint:ipc-sends）
- ✅ `bun run lint:electron` / `lint:shared` / `lint:ui`（单独跑某个 lint 子任务可以，但**不**通过组合的 `bun run lint`）
- ✅ `bun run electron:clean`
- ✅ `bun run electron:build`
- ✅ `bun run electron:dist:adhoc:mac`（M1 任务 #27 新加的脚本，**SDK 缺失，对 U-API 路径透明**——见 `05-build-release.md` §3.2.0）
- ✅ `cd apps/electron && bun run dist:mac` / `dist:mac:x64` / `dist:win`（**M2 推荐——含 SDK 复制**）

**为什么不修复缺失脚本**：M1 阶段不接管这些工具链；保持上游 package.json 不动，减少同步冲突。M2/M3 阶段如真需要 lint:ipc-sends 等检查，再自建对应脚本。

**核心交付物**：
- macOS arm64 + x64 DMG 安装包
- 安装后流程能跑完：启动 → onboarding 输 Token → 选协议 → 添加模型 → 发第一条对话

**M1 任务清单**（由用户/外部 AI 在另会话执行，本仓库 AI 只产出规格指引）：

| # | 任务 | 对应规格 |
|---|---|---|
| 1 | 全仓重命名：`@craft-agent/` → `@u-agents/`（含全部 `import` 语句 + **8 个 tsconfig.json 共 24 处 `compilerOptions.paths` 映射 - Round 46 补遗** + 14 个 package.json 的 scoped name；**同 commit 完成** + 之后 `bun install` 重生 bun.lock；不改 paths 映射 → typecheck 报 `Cannot find module '@u-agents/...'`）| `01-branding-spec.md` §4 + §2.41 |
| 2 | `electron-builder.yml` 改 **7 字段**：appId / productName / **copyright**（Round 33 EEEE 补遗）/ artifactName / publish.url / dmg.title / linux.maintainer | `01-branding-spec.md` §2.1 |
| 3 | ✅ 替换 `apps/electron/resources/icon.{icns,ico,png,svg}` + `Assets.car`（Liquid Glass）+ 删除 `craft-logos/` 与 `icon.icon/` 源目录 | `01-branding-spec.md` §2.2 — 2026-05-04 完成 |
| 4 | 改 `packages/shared/src/branding.ts` VIEWER_URL | `01-branding-spec.md` §2.3 |
| 5 | 改 `packages/shared/src/version/manifest.ts` VERSIONS_URL | `01-branding-spec.md` §2.6 |
| 6 | 改 `packages/shared/src/docs/doc-links.ts` DOC_BASE_URL | `01-branding-spec.md` §2.8 |
| 7 | 改菜单/topbar/chat 中 **6 处** craft.do/docs 链接（含 main/menu.ts:237 + AppMenu/TopBar/ChatPage 5 处 renderer，详见 §3.3 修正）| `01-branding-spec.md` §3.3 |
| 8 | 改 `apps/viewer/src/components/Header.tsx` href | `01-branding-spec.md` §3.1 |
| 9 | _（合并入 #22）_ ~~删除 `scripts/install-app.{sh,ps1}`~~ | 见 #22 "不发布、保留文件不删" |
| 10 | **禁用** `url-validator.ts` 中 mcp.craft.do 专用校验路径（**保留**通用 URL 校验逻辑；如需重构剥离单独开任务确认）| `04-feature-cuts.md` §4.2 + `01-branding-spec.md` §2.13 |
| 11 | **system prompt 改造**：5 处 craft 字面量改 U Agents（含 AI 自我认知 "You are Craft Agent" / XML marker / Source mention / Co-Authored-By）| `01-branding-spec.md` §2.12 |
| 11b | **OAuth callback HTML 品牌化**：callback-page.ts 2 处（标题 + 返回链接）改 U Agents | `01-branding-spec.md` §2.16 |
| 11c | **内置 docs/ 批量品牌替换 + 打包资源 JSON 清理**：10 个 docs 文件（automations/sources/labels/skills/themes/permissions/statuses/tool-icons/data-tables/browser-tools）共 90+ 处 craft → U Agents（craft-cli.md 保留不改）；**Round 40/43 补遗**：`resources/permissions/default.json` 的 3 组 `craft-agent` CLI 默认规则删除/改中性说明，`resources/tool-icons/tool-icons.json` 的 `displayName: "Craft Agent"` 删除或改 `U Agents CLI`；`sources.md` 内 `mcp__craft-agents-docs__SearchCraftAgents` / `https://connect.craft.do` / `~/.craft-agent` 示例必须删除或改写 | `01-branding-spec.md` §2.17 |
| 11d | **DEEPLINK_SCHEME + app.setName + renderer HTML title 改造**：`'craftagents'` → `'uagents'`（main 2 处常量 + 4 处常量名引用 + renderer 11 处字面量 + deep-link.ts JSDoc 7+ 处 + 5 处 Electron 测试 fixture + webui 1 处提示 + **server-core RPC open-url 解析/allowlist/logger + `system.open-url.test.ts` fixture**）；`'Craft Agents'` → `'U Agents'` (`app.setName` + `apps/electron/src/renderer/index.html:7 <title>` + env vars `CRAFT_DEEPLINK_SCHEME`/`CRAFT_APP_NAME` → `U_AGENTS_*`)。**dev 多实例命令同步改**（备注到 README）| `01-branding-spec.md` §2.18 |
| 11e | **'craft-agents-docs' MCP 完全裁剪**（**Round 48 A3 路径修正 + 2 处新发现补遗**）：`claude-agent.ts:849-854` 删除 entry + `builtin-sources.ts` deprecated placeholder 字面量全清 + `session-mcp-server/src/index.ts` 禁用 `DOCS_MCP_URL`/`connectDocsUpstream()`/`docsTools`/`isDocsUpstreamTool(name)`/`callDocsUpstream(...)` 整条路径 + `SessionManager.ts:566-567` 工具显示名映射 + `EditPopover.tsx:369` AI prompt 引用 + `utils/toolNames.ts:26` `'SearchCraftAgents'` + `docs/source-guides.ts:5,192,194,203,217` 5 处 JSDoc/示例 + `sources/storage.ts:379,387-388,404,541` 5 处 builtin 死分支 + **Round 48 路径修正**（外部 #11e 原写"server-core/sessions"路径全错，正确路径在 `packages/shared/src/agent/`）：`shared/agent/mode-manager.ts:2008` + `shared/agent/core/source-manager.ts:21` + `shared/agent/core/prerequisite-manager.ts:49` + `shared/agent/core/pre-tool-use.ts:661` 共 4 处豁免/白名单 Set + **Round 48 新发现 2 处**：`shared/prompts/system.ts:650` 系统 prompt 引用此 MCP（**§2.12 漏覆盖**！）+ `shared/sources/types.ts:518` JSDoc 注释。**M1 不替换为自建 MCP**（M3 自建文档站后再启用）| `01-branding-spec.md` §2.13b + §2.19 |
| 11f | **`CRAFT_*` 环境变量族改造**：9 个名 → `U_AGENTS_*`（含 6 个**新发现**的 runtime env vars: CRAFT_IS_PACKAGED / CRAFT_RESOURCES_BASE / CRAFT_APP_ROOT / CRAFT_UV / CRAFT_NODE / CRAFT_BUN）+ resolve-script-runtime.ts ~30 处源码 + ~24 处测试 fixture + 5 处用户错误提示字面量同步改。**Round 44**：`.env.example` 的 `CRAFT_MCP_URL/TOKEN` 与第三方 Sentry DSN 示例必须清理；CI/server/Docker 中的 `CRAFT_*` 若 M1 不发布可保留但必须标注 | `01-branding-spec.md` §2.20 |
| 11g | **`package.json` 文件族字段改造**：14 个 package.json 的 `name`/`description` 字段（**根 name `craft-agent` → `u-agents`** + 13 子 description 含 craft 改 + 根 L64 npm script 含 `@craft-agent/electron/main.log` 同步改）；`author`/`email` 属发布 metadata，必须按 `LEGAL.md` §2 Round 45 改为 U Agents / U Studio 自有信息；上游署名放在 NOTICE/About，不靠 package author 保留 | `01-branding-spec.md` §2.21 + `LEGAL.md` §2 |
| 11h | **prompt/agent 文件族 7 处用户可见 craft 改造**：① errors.ts:185, 458 错误对话框文案 ② diagnostics.ts:139 `pi_compat` provider label `'Craft Agents Backend'` → `'U-API'` ③ pi-agent.ts:121, 1848 `backendName` 字段 ④ system.test.ts:15, 88 测试 fixture（与 §2.12 系统 prompt 同步）。**P2 注释 11 处可推迟到 M2** | `01-branding-spec.md` §2.22 |
| 11i | **正则路径 hardcoded `\.craft-agent\/` 13 处 + 函数名 `isCraftAgentConfig` 改造**（**与 #23 paths.ts 同 commit 完成，否则 config 校验失败**）：config-validator.ts 9 个正则 + path-processor.ts 4 个正则 + 1 函数名（含所有调用方）。**测试 config-validator.test.ts fixture 同步改**（已在 #24d 第 7 项补加）| `01-branding-spec.md` §2.23 |
| 11j | **Vite 配置 `optimizeDeps.exclude` 改造**：`apps/electron/vite.config.ts:64` + `apps/webui/vite.config.ts:81` 的 `exclude: ['@craft-agent/ui']` → `['@u-agents/ui']`（**Vite 配置易漏点**，常规 codemod 不处理字面量数组）；`apps/electron/vite.config.ts:56` 注释同步改；viewer dev proxy 保留不改（M1 viewer 不发布）| `01-branding-spec.md` §2.24 |
| 11k | **`build-dmg.sh` 3 处必改**（**与 #28 macOS 打包耦合**）：L83 echo "Building Craft Agents DMG" + L248 注释 + **L249 `DMG_NAME="Craft-Agents-${ARCH}.dmg"`** → `U-Agents-${ARCH}.dmg`；不改 #28 跑 `electron:dist:adhoc:mac` 报 "Expected DMG not found"。**build-linux.sh 8 处 M2 出 Linux 时同步处理** | `01-branding-spec.md` §2.25 |
| 11l | **renderer 端 craft 死代码 + 通知文案 P0 改造**：① 删除 `CraftAppIcon.tsx`（22 行死组件，0 caller）+ `craft_logo_c.svg`（死资源） ② `useNotifications.ts:232` 通知 fallback body `'Craft Agent has a new message for you'` → `'U Agents has a new message for you'`（用户桌面通知直接看到的字面量；M2 走 i18n） | `01-branding-spec.md` §2.26 + §2.27 |
| 11m | **CraftAgentsSymbol 启动画面 + 顶栏图标改造**（**P0 用户首屏可见**）：① 改名 `CraftAgentsSymbol.tsx` → `UAgentsSymbol.tsx` ② SVG path 替换为 U Agents 像素艺术（保留 viewBox 维持布局）③ `SplashScreen.tsx` + `AppMenu.tsx` 共 5 处 import / 调用同步改 + L207 `aria-label="Craft menu"` → `"U Agents menu"`（屏幕阅读器）| `01-branding-spec.md` §2.28 |
| 11n | **EditPopover.tsx AI prompt context 14 处必改**（**P0 §2.15 + §2.19 双重漏覆盖；必须与 #23 + #11i + #11e 同 commit**）：① 13 处 `~/.craft-agent/...` 路径批量改 `~/.u-agents/` ② L315 `'Connect to my Craft space'` → 中性文案 ③ **L369 `mcp__craft-agents-docs__SearchCraftAgents` 整段删除**（与 §2.19 craft-agents-docs MCP 裁剪一致），改为 read 本地 docs 路径 | `01-branding-spec.md` §2.29 |
| 11o | **'Craft Agents Backend' 用户可见 label 12+ 处改造**（§2.22 范围扩张）：① AiSettingsPage.tsx 5 处 (`L229/232/506/921/922`) `'Craft Agents Backend' / 'Craft Agents Backend Compatible'` → `'U-API'` / `'U-API Compatible'` ② **Round 45** 补 `provider-icons.ts:58-59`、`FreeFormInput.tsx:370/380`、`ApiKeyInput.tsx:126` 共享/输入区 label ③ connection-setup-logic.ts 2 处错误对话框文案 (`L30/63`) → 'U-API ... mode' ④ **llm-connections.ts:135/138 runtime 写入的 `updates.name = \`Craft Agents Backend (...)\`` → `U-API (...)`**。**L162 BUILT_IN_CONNECTION_TEMPLATES 'pi-api-key' name 保留不改**（上游 fixture，不被 M1 U-API 用户触发）| `01-branding-spec.md` §2.31 |
| 11p | **`craft:*` 自定义事件命名空间改名**（**P1 跨组件协议**）：以 `grep -rn "craft:" apps/electron/src --include='*.ts' --include='*.tsx'` 全量结果为准一次性改完，当前已知至少 8 个事件类型 / 30+ 处：`focus-input` / `restore-input` / `compaction-complete` / `insert-text` / `paste-files` / `submit-input` / `approve-plan` / `approve-plan-with-compact`，所有 dispatch/listen/remove/comment 同 commit 改为 `u-agents:*` | `01-branding-spec.md` §2.30 |
| 11q | **`craft-agents-docs` MCP 裁剪范围扩张**（§2.19 补遗）：除已知的 `claude-agent.ts:849-854` + `builtin-sources.ts` + `session-mcp-server/index.ts:275`，还需删除 **`SessionManager.ts:566-567`** 的 `'craft-agents-docs': { 'SearchCraftAgents': 'Search Docs' }` MCP 工具显示名映射（重复注册）| `01-branding-spec.md` §2.19 |
| 11r | **网络层用户/外部可见 craft 字面量改造**（**P0 网络层暴露**）：① `unified-network-interceptor.ts:2062, 2073` 错误对话框 / response statusText "blocked by Craft Agents" → "blocked by U Agents" ② `models-pi.ts:35` Pi model description "model via Craft Agents Backend" → "model via U-API"（与 §2.31 同步）③ `pi-agent-server/web-fetch.ts:362` HTTP UA "CraftAgent/1.0" → "UAgents/1.0" ④ **Round 40 补遗**：`claude-oauth.ts:174` + `claude-token.ts:32` 的 `CraftAgents/${APP_VERSION}` → `UAgents/${APP_VERSION}`，`utils/icon.ts:143` 的 `Craft-Agent/1.0` → `UAgents/1.0`（让 Anthropic/中转站/icon host 日志归到我们）| `01-branding-spec.md` §2.32 |
| 11s | **Messaging Gateway 3 处用户可见**（**P0 Telegram bot + WhatsApp + 临时文件**）：① `commands.ts:302` Telegram bot pair 命令回复 "in the Craft Agent app" → "in the U Agents app" ② `whatsapp-worker/worker.ts:259` WhatsApp Linked Devices 设备名 `Browsers.macOS('Craft Agent')` → `'U Agents'` ③ `telegram/index.ts:588` 临时文件名 `craft-agent-messaging-` → `u-agents-messaging-`（Telegram 接收方看到 attachment 文件名）| `01-branding-spec.md` §2.33 |
| 11t | **packages/ui CraftAgentLogo viewer 组件改造**：①  `SessionViewer.tsx:54` 函数 `CraftAgentLogo` → `UAgentsLogo` + L52 注释 + L228 调用方 ② SVG path 替换为 U Agents 字符（保留 viewBox）。**craft-dark/craft-light Shiki theme 名 + registerCraftShikiThemes M1 保留不改**（详见 §2.35 决策，记入 LEGAL §5）| `01-branding-spec.md` §2.34 + §2.35 |
| 11u | **DOM 元素 ID + internal signal + bundled defaults + 持久化 key + server 日志 + 临时目录名改造**（**P1/P2 DevTools / 第三方网页 / 排障可见**）：① `browser-cdp.ts:490, 494, 567` `'__craft_agent_screenshot_overlay__'` × 3 → `'__u_agents_screenshot_overlay__'`（**第三方网页 inspect 看到**）② `ThemeContext.tsx:351` `'craft-theme-overrides'` → `'u-agents-theme-overrides'` ③ **browser-pane-manager.ts:41/2404/2981/2982 `__craft_theme_color__:` → `__u_agents_theme_color__:`** ④ `transfer.ts:121` `craft-transfer-*` → `u-agents-transfer-*`（`apps/cli/src/index.ts:1054 craft-validate-*` M1 可保留，M2 评估）⑤ `headless-start.ts:332` server 启动日志 `'Craft Agent server listening'` → `'U Agents server listening'` ⑥ **Round 41 补遗**：`resources/config-defaults.json:3`、`resources/themes/{default,haze}.json:4`、`resources/AGENTS.md` 路径说明、`renderer/lib/local-storage.ts:6` localStorage prefix、`automations/event-logger.ts:74` event source 同步改/迁移 ⑦ `core/types/*.ts` 5 处 craft 注释顺改。**`__craftShikiThemesRegistered__` 单例 key M1 保留**（§2.35 决策，M2 重构）| `01-branding-spec.md` §2.30 (扩) + §2.37 + §2.38 + §2.39 |
| 11v | **dotfiles + GitHub Issues 模板改造**（**Round 46 D1 + B1**）：① `.gitignore:58-59` 加一行 `.u-agents/`（保留 `.craft-agent/` 也无害，避免上游残留目录被 git 追踪）② `rm -rf .github/ISSUE_TEMPLATE/`（M1 私有 fork 不接 GitHub Issues，用户支持走 `support@u-studio.cn`）。**ESLint 自定义 plugin namespace + Dockerfile.server M1 保留不改**（详见 §2.42 决策）| `01-branding-spec.md` §2.42 |
| 12 | NOTICE 末尾追加派生作品声明 | `LEGAL.md` §2 + `01-branding-spec.md` §7 |
| 13 | 新建 `packages/shared/src/config/u-api-defaults.ts` | `02-llm-gateway-spec.md` §5 |
| 14 | 在 `packages/shared/src/config/storage.ts` 迁移流水线追加 `enforceUApiBaseUrl` | `02-llm-gateway-spec.md` §4 |
| 15 | `packages/shared/src/config/provider-metadata.ts` 新增 `'u-api'` entry | `02-llm-gateway-spec.md` §6.3 |
| 16 | 改造 `useOnboarding.ts` 主状态机：从 `welcome` / Windows `git-bash` 直接进入 `credentials`，**不渲染** ProviderSelectStep / local-model；`OnboardingWizard.tsx` 只保留渲染兜底 | `04-feature-cuts.md` §1.1 + `03-ui-lockdown-spec.md` §1.2-§1.3 |
| 17 | 改造 U-API onboarding 输入链路：`APISetupStep.tsx` 仅补 `ApiSetupMethod` 类型/legacy selector 的 `u_api` 分支；主输入路径走 `CredentialsStep` + `ApiKeyInput mode="u_api"`，包含 Token、协议二选一（默认 anthropic-messages）和 **模型 ID 输入（预填 `gpt-5.5`，必填）** | `03-ui-lockdown-spec.md` §1.4-§1.8 |
| 17b | **后端改造（关键，4 处必改）**：① `connection-setup-logic.ts:133` 的 `BUILT_IN_CONNECTION_TEMPLATES` 加 `'u-api-default'` 项；② `useOnboarding.ts:137` 的 `apiSetupMethodToConnectionSetup` 加 `'u_api'` case；③ **扩展** `connection-setup-logic.ts:54-67` 的 `validateSetupTestInput` 接受 `customEndpoint` 参数 + handler:303 调用同步传；④ **修改** `state.ts:296-299` 的 keyless 路径加 `'u-api-default'` slug 特判（`isUApi → hasCredentials = false`） | `02-llm-gateway-spec.md` §4.1 + §4.2 + `03-ui-lockdown-spec.md` §1.10 |
| 18 | 改造 `apisetup/ApiKeyInput.tsx`（814 行，加 `mode === 'u_api'` 简化分支，注意 `onSubmit` 入参是 `ApiKeySubmitData` 形态）| `03-ui-lockdown-spec.md` §1.8 |
| 19 | 改造设置页"AI Connections"区：移除 Add 按钮、隐藏 baseUrl | `03-ui-lockdown-spec.md` §2 |
| 20 | 修改 `auto-update.ts` 注释中的 craft.do 提及（仅注释字符串替换，不动函数）| `01-branding-spec.md` §2.7 |
| 21 | **完全裁剪**内置 "Craft Documents MCP" Source 与 docs upstream proxy：删除/禁用 `builtin-sources.ts` deprecated placeholder、`claude-agent.ts` entry、`session-mcp-server/src/index.ts` 的 `connectDocsUpstream()` / `docsTools` / `callDocsUpstream(...)` 路径、`toolNames.ts` / `source-guides.ts`、`sources/storage.ts` 死分支/注释，以及 mode/source/pre-tool/prerequisite/SessionManager 白名单或显示名映射；M1 不替换为自建 MCP | `04-feature-cuts.md` §4.1 + §4.3 + `01-branding-spec.md` §2.13b/§2.19 |
| 22 | 确认 `scripts/install-app.{sh,ps1}` / `scripts/install-server.sh` / `Dockerfile.server` **不被发布/引用**（保留文件不删除，避免上游同步冲突）；Round 43 补充：发版命令禁止使用 `build-dmg.sh` / `build-linux.sh` 的 `--script` 上传入口，除非安装脚本已完整白标 | `04-feature-cuts.md` §2.1-§2.2 + `01-branding-spec.md` §3.4 |
| 23 | **配置目录改名**：`paths.ts` 主声明 + **前置改造** `packages/shared/src/config/index.ts` 加 `export { CONFIG_DIR } from './paths.ts'`（让跨 package 导入可行）+ `01-branding-spec.md` §2.15 表中**所有运行时硬编码 + 注释残留**统一从 `CONFIG_DIR` 派生。**9 处独立 CONFIG_DIR/配置路径派生必须全部改**（不改会数据分裂）：① paths.ts:19 主声明 ② permissions-config.ts:49 ③ **window-state.ts:32（Round 37 VVVV）** ④ **privileged-execution-broker.ts:25 audit log（Round 37 UUUU）** ⑤ **auth.ts:62 logout/reset 删除 configPath（Round 38 YYYY）** ⑥ **workspaces/storage.ts:35-36 默认 workspace root（Round 39）** ⑦ **secure-storage.ts:44-45 credentials.enc 路径（Round 39；只改目录，保留 `MAGIC_BYTES = CRAFT01\0`）** ⑧ **apps/electron/resources/bridge-mcp-server/index.js:17922 packaged bridge MCP credential-cache 路径（Round 39，`.js` 打包资源也必须扫）** ⑨ **release-notes/index.ts:16 What's New 同步路径（Round 42）**。`theme.ts` / `watcher.ts` / `storage.ts` / `permissions-config.ts` 等注释需手动改。**Round 31 关联约束**：必须**与 #11i 同 commit** 完成——#11i 改 `\.craft-agent\/` 正则 13 处；不同 commit 会出现"config 已写新路径但校验仍跑旧正则"的中间态 | `01-branding-spec.md` §2.15 + §2.23 |
| 24 | ✅ About 对话框设 `Copyright © 2026 U Studio Ltd.`（main 进程 `setAboutPanelOptions`，commit d6d3aaa → 2026-05-04 修订删除 "Based on Craft Agents" 文案）；上游署名走 NOTICE 文件，由 `electron-builder.yml` mac/win/linux extraResources 打进 `.app/Contents/Resources/{LICENSE,NOTICE}` 满足 §4(c) | `LEGAL.md` §2 + `03-ui-lockdown-spec.md` §3.1 — 2026-05-04 完成 |
| 24c | **Apache §4(b) 合规**：6 个核心改造文件顶部加 modification header（electron-builder.yml / branding.ts / paths.ts / state.ts / connection-setup-logic.ts / storage.ts）| `LEGAL.md` §2 "Apache §4(b)" |
| 24d | **同步更新被 M1 改造破坏的至少 10 个上游测试文件**（已知清单 + 所有因 M1 改造失败的测试）：① `storage-update-llm-connection.test.ts` / ② `storage-startup-migration.test.ts` / ③ `storage-migrations.test.ts` / ④ `domain/connection-setup-logic.test.ts` / ⑤ `electron/__tests__/connection-setup-logic.test.ts` + **⑥ `prompts/__tests__/system.test.ts`**（含 `CO_AUTHOR_TRAILER` 和 `'Craft Agents Backend'` fixture，依 §2.12 + §2.22 改）+ **⑦ `agent/core/__tests__/config-validator.test.ts`**（含 `\.craft-agent\/` 路径 fixture，依 §2.23 改）+ **⑧ `packages/server-core/src/handlers/rpc/system.open-url.test.ts`**（Round 38：`craftagents://` fixture + allowlist 错误提示依 §2.18 改）+ **Round 45 补充**：`packages/shared/src/auth/__tests__/{oauth.test.ts,types.test.ts,exports-and-session-context.test.ts}`、`packages/shared/src/sources/__tests__/token-refresh-manager.test.ts`、`packages/shared/src/utils/__tests__/url-safety.test.ts` 中的 `mcp.craft.do` / `craftagents://` fixture 必须同步改为中性 mock 域或 `uagents://`。测试 fixture **必须用 `slug: 'u-api-default'` + `providerType: 'pi_compat'` + `customEndpoint.api: 'anthropic-messages'`** 写新用例覆盖（enforceUApiBaseUrl / BUILT_IN_CONNECTION_TEMPLATES / validateSetupTestInput 扩展），上游测试 fixture 用的旧 slug（'pi-api-key' / 'anthropic-api'）保留作为"我们裁掉但代码仍存在"分支测试 | `09-test-checklist.md` §3.5 |
| 24b | **隐藏会话分享 UI 入口**（M1 不做 viewer，按钮/菜单/命令面板入口全隐藏）| `04-feature-cuts.md` §7 + `09-test-checklist.md` §11 |
| 25 | i18n 品牌词清洗（**全部 7 个 locale**：en/zh-Hans/de/es/ja/hu/pl，每个约 29 处；非中英文用 en 值占位）| `10-i18n-zh.md` §1 + §2 + §6.1 |
| 26 | i18n 新增 U-API 相关 keys（约 30 个，**7 个 locale 同步加**，否则 `bun run lint:i18n:parity` 失败）| `10-i18n-zh.md` §3 + §4 |
| 26b | 修 `menu.resetToDefaultsDetail` i18n 文案：上游引用 `bun run fresh-start` 但 `scripts/fresh-start.ts` 在 OSS 版被剥离；改为"完全卸载应用 + 删除 `~/.u-agents/` 目录后重装" | `10-i18n-zh.md` §6.1 |
| 27 | 在 `package.json` 新增 `electron:dist:adhoc:mac` 脚本（M1 adhoc 打包用）| `05-build-release.md` §3.2.1 |
| 28 | macOS adhoc 打包（**M1 不公证**）| `05-build-release.md` §3.2 |
| 29 | 部署最小更新服务器（Cloudflare R2 + 自定义域名）；除 `latest-mac.yml` 外，还必须支持 `version/manifest.ts` 的 `/latest` 与 `/{version}/manifest.json` 独立版本 manifest 链路。当前上游打包脚本不会自动产出完整 `VersionManifest`，在新增正式脚本前按 `06-update-server.md` §4.0 人工生成并用 `rclone copyto` 上传 `/latest` 对象 | `06-update-server.md` §4.0-§4.1 |
| 30 | 在网站下载页 + 应用文档展示"首次启动指引" | `05-build-release.md` §3.2.3 |
| 31 | 自测一遍 `09-test-checklist.md` 全部 18 节 | `09-test-checklist.md` |

**关键依赖关系**（执行 AI 必读，避免顺序错误导致 typecheck 中断）：

```
       ┌───────────────────────────────────────────────────────────┐
       │ 第 1 阶段：基础重命名（建议最先做，影响整个 monorepo）           │
       └───────────────────────────────────────────────────────────┘
       ① #1 NPM scope @craft-agent → @u-agents（所有 import 跟着改 + #11j Vite optimizeDeps.exclude 同步，否则 dev "multiple React copies"）
                                                  │
                                                  ▼
       ┌───────────────────────────────────────────────────────────┐
       │ 第 2 阶段：单点替换（互不依赖，可并行）                        │
       └───────────────────────────────────────────────────────────┘
        ② #2 #3 #4 #5 #6 #7 #8 #20 #11 #11b #11c #11d #11f #11g #11h #11l #11m #11o #11p #11r #11s #11t #11u #12 (各种品牌/URL/署名/deeplink/env vars/package.json/agent 文案/死代码/通知/启动画面/UI label/事件/网络层/messaging/viewer 组件/DOM ID/server log)
        ③ #10 url-validator（独立改造）
        ④ #21 #11e #11q 内置 Craft MCP + craft-agents-docs MCP 完全裁剪（含 session MCP docs upstream proxy、toolNames/source-guides、sources/storage 死分支/注释、SessionManager 重复注册与 mode/pre-tool/source/prerequisite 豁免分支）
        ⑤ #22 install scripts 不发布（仅文档/CI 检查）
        ⑥ #25 #26 i18n（独立翻译）
                                                  │
                                                  ▼
       ┌───────────────────────────────────────────────────────────┐
       │ 第 3 阶段：U-API 锁定核心（有强依赖，按顺序做）                  │
       └───────────────────────────────────────────────────────────┘
       ⑦ #13 u-api-defaults.ts 新建（导出 U_API_* 常量）
              │
              ├──→ #14 enforceUApiBaseUrl（用 U_API_BASE_URL / U_API_SLUG）
              │           ▲
              │           └── 也依赖 #23 paths.ts（CONFIG_DIR 重命名）
              │
              └──→ #15 provider-metadata 加 'u-api' entry
                                                  │
                                                  ▼
       ┌───────────────────────────────────────────────────────────┐
       │ 第 4 阶段：Onboarding + 后端 setup 改造（强依赖链）               │
       └───────────────────────────────────────────────────────────┘
       ⑧ #16 useOnboarding.ts 主状态机：跳过 ProviderSelectStep / local-model，welcome/git-bash 后进入 credentials
              │
              ▼
       ⑨ #17 APISetupStep.tsx 只补 'u_api' ApiSetupMethod 类型/legacy selector；主输入走 CredentialsStep + ApiKeyInput
              │
              ▼
       ⑩ #17b 后端 setup（BUILT_IN_CONNECTION_TEMPLATES + apiSetupMethodToConnectionSetup + validateSetupTestInput + state.ts keyless 特判）
              │
              ▼
       ⑪ #18 ApiKeyInput.tsx：mode='u_api' 简化分支（onSubmit 形态依赖 §17b）
              │
              ▼
       ⑫ #19 设置页 AiSettingsPage（依赖 #13 / #15）
                                                  │
                                                  ▼
       ┌───────────────────────────────────────────────────────────┐
       │ 第 5 阶段：合规 + 配置目录（独立但应在打包前完成）                │
       └───────────────────────────────────────────────────────────┘
       ⑬ #23 paths.ts 改名（影响 #14 启动迁移）+ **#11i 正则 13 处同 commit**（详见 §2.23）+ **#11n EditPopover AI prompt 14 处同 commit**（详见 §2.29——AI 用 prompt 中的路径 read 文件，paths 改名不同步会导致 AI 行为崩坏）
       ⑭ #24 About 对话框 setAboutPanelOptions
       ⑮ #24b 隐藏分享 UI 入口
                                                  │
                                                  ▼
       ┌───────────────────────────────────────────────────────────┐
       │ 第 6 阶段：打包发版                                            │
       └───────────────────────────────────────────────────────────┘
       ⑯ #27 package.json 加 adhoc 脚本 + **#11k build-dmg.sh**（与 #2 artifactName 耦合，必须在 #28 之前）
              │
              ▼
       ⑰ #28 macOS adhoc 打包
              │
              ▼
       ⑱ #29 部署更新服务器
              │
              ▼
       ⑲ #30 网站下载页 + 首次启动指引
              │
              ▼
       ⑳ #31 跑 09-test-checklist 全程
```

**Commit 粒度建议**（执行 AI 必读，便于回滚）：

不要"36 项任务一次性 commit"——若中途发现某项改造方向错（如 typecheck 失败找不到原因），revert 整个 commit 损失太大。**建议按 6 阶段做 commit**：

| Commit | 包含任务 | 验收命令 |
|---|---|---|
| `commit 1: refactor: rename @craft-agent → @u-agents NPM scope` | #1 (含 8 个 tsconfig paths 24 处映射 - Round 46) + **#11j Vite exclude** + bun install | `bun run typecheck:all` 通过；`bun run electron:dev` 浏览器 console 不应出现 "multiple React copies"；额外验证 `grep -rn "@craft-agent" packages apps --include="tsconfig*.json"` 应为 0 |
| `commit 2: chore: branding replacements + i18n cleanup` | #2-#12 (含 #11/#11b/#11c/#11d/#11f/#11g/#11h/#11l/#11m/#11o/#11p/#11r/#11s/#11t/#11u), #25-#26b | `01-branding-spec.md` §8 grep 全过；额外验证 §2.17 `grep -rnE "Craft Agent\|craft-agent" apps/electron/resources/permissions/default.json apps/electron/resources/tool-icons/tool-icons.json` 应按 §2.2/§2.17 决策仅剩允许的内部 command 名；§2.18 `grep -rn "craftagents" apps/electron/src apps/webui/src packages/server-core/src/handlers/rpc` 应为 0，且旧系统 handler 不应让 `craftagents://` 打开 U Agents；§2.20 `rg -n "CRAFT_MCP_|CRAFT_SERVER_|CRAFT_WEBUI_|CRAFT_RPC_|CRAFT_ANTHROPIC_API_KEY|your-public-key@o0\.ingest\.sentry\.io" .env.example .github Dockerfile.server scripts/install-server.sh apps/webui/src/login.html` 中 `.env.example` 不应命中，server/CI 命中必须属于 M1 不发布范围；§2.20 `grep -rnE "CRAFT_(UV\|NODE\|BUN\|IS_PACKAGED\|RESOURCES_BASE\|APP_ROOT\|DEEPLINK_SCHEME\|APP_NAME\|FEATURE_)" packages apps` 应为 0；§2.21 `grep -nE "(name\|description\|author\|homepage).*[Cc]raft" package.json apps/*/package.json packages/*/package.json` 应为 0（上游署名只留 NOTICE/About，不留 package metadata）；§2.22 `grep -rnE "Craft Agents Backend\|required for Craft Agent" packages/shared/src/agent` 应为 0；§2.26 `grep -rn "CraftAppIcon\|craft_logo_c\.svg" packages apps` 应为 0；§2.27 `grep -nE "Craft Agent has a new message" apps/electron/src/renderer/hooks/` 应为 0；§2.28 `grep -rn "CraftAgentsSymbol\|Craft (logo\|menu\|symbol)" apps/electron/src/renderer/components` 应为 0；§2.30 `grep -rn "craft:" apps/electron/src --include='*.ts' --include='*.tsx'` 应为 0（含 dispatch/listen/remove/comment，playground 若保留必须显式排除）；§2.31 `grep -rnE "Craft Agents Backend" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx apps/electron/src/renderer/lib/provider-icons.ts apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx packages/server-core/src/domain/connection-setup-logic.ts packages/server-core/src/handlers/rpc/llm-connections.ts` 应仅剩 connection-setup-logic.ts:162 模板 name 1 处；§2.32 `grep -rnE "Craft Agents blocked\|by Craft Agents\|CraftAgents/\|Craft-Agent/1\\.0\|CraftAgent/1\\.0\|model via Craft Agents Backend" packages/shared packages/pi-agent-server` 应为 0；§2.33 `grep -rnE "in the Craft Agent app\|Browsers\\.macOS\\('Craft Agent'\\)\|craft-agent-messaging-" packages/messaging-gateway packages/messaging-whatsapp-worker` 应为 0；§2.34 `grep -rn "CraftAgentLogo" packages/ui/src` 应为 0；§2.37 `grep -rnE "__craft_agent_screenshot_overlay__\|'craft-theme-overrides'\|__craft_theme_color__" apps/electron/src` 应为 0；§2.38 `grep -nE "craft-transfer-" packages/server-core/src/handlers/rpc/transfer.ts` 应为 0；§2.39 `grep -nE "Craft Agent server listening" packages/server-core` 应为 0 |
| `commit 3: feat: u-api lockdown core (paths/storage/provider-metadata/connection-setup)` | #13-#15, #17b, #23, **#11i**, **#11n** | `bun run test:shared:all` 通过；额外 `grep -rn "\\\\\.craft-agent" packages/shared/src/agent/core` 应为 0；`grep -rn "isCraftAgentConfig" packages apps` 应为 0；`grep -nE "\\\\.craft-agent\|craft-agents-docs__SearchCraftAgents" apps/electron/src/renderer/components/ui/EditPopover.tsx` 应为 0 |
| `commit 4: feat: onboarding/settings UI lockdown` | #16-#19, #24 | `09-test-checklist.md` §2 + §3 全过；重点验证 `useOnboarding.ts` 默认入口和 welcome/git-bash/back 分支不会回到 `provider-select` / `local-model` |
| `commit 5: feat: feature cuts (sources/share/install scripts/MCP)` | #20-#22, #24b, #11e, **#11q** | grep 验证完整；额外 `grep -rn "craft-agents-docs\|SearchCraftAgents\|mcp__craft-agents-docs__\|connectDocsUpstream\|docsTools\|callDocsUpstream" packages apps` 应为 0（含 session MCP proxy、toolNames/source-guides/sources/storage、SessionManager.ts:566-567 与 Round 43 的 mode/pre-tool/source/prerequisite 豁免分支）；发版命令不使用 `--script` 上传 install-app 脚本 |
| `commit 6: chore: M1 packaging + adhoc + Apache §4(b) headers` | #24c, #24d, #27-#31, **#11k**, **#11v** | M1 出口条件全过；额外 `grep -nE "[Cc]raft" apps/electron/scripts/build-dmg.sh` 应为 0；`packages/shared/src/version/manifest.ts` 的 `VERSIONS_URL` 指向 `https://update.u-agents.u-studio.cn`，更新服务器提供 `/latest` 与 `/{version}/manifest.json` 且内容不含 `agents.craft.do` / `Craft-Agents-*` |

**优势**：
- `git revert <commit>` 单独回滚某阶段，保留其他阶段成果
- 每个 commit 后跑对应验收命令，及早发现问题
- 与 `08-conflict-zones.md` 的"按文件分类处理"对齐——每阶段集中改一类文件

**核心硬约束**：
1. **#1 NPM scope 替换最先做**——其他文件都靠这个 import 路径解析；做完后必须 `bun install`
2. **#13 u-api-defaults.ts 必须在 #14 / #15 之前**——后两者要 import 它的常量
3. **#23 paths.ts 必须在 #14 之前或同时做**——`enforceUApiBaseUrl` 用到 `CONFIG_DIR`
4. **#17b 后端 setup 必须在 #18 ApiKeyInput onSubmit 之前完成**——否则 onboarding 提交报 `Unknown built-in connection slug`
5. **#27 adhoc 脚本必须在 #28 打包之前**——`bun run electron:dist:adhoc:mac` 否则不存在
6. **#29 更新服务器必须在 #28 之后**——上传需要打包产物；同时必须在第一次发安装包前**已就绪**（`update.u-agents.u-studio.cn` DNS 生效）

**出口条件**（M1 完成判定）：
- [ ] 全新装机能完成 onboarding，能发第一条对话
- [ ] 按 `09-test-checklist.md` §1.2 走通 adhoc 包"首次启动需用户手动绕过 Gatekeeper"流程
- [ ] About 对话框含 "Based on Craft Agents" 署名（`LEGAL.md` §2）
- [ ] `01-branding-spec.md` §8 的 4 个 grep 命令全部通过（仅允许已知瑕疵的 OAuth relay 残留）
- [ ] `02-llm-gateway-spec.md` §10 的验收全部通过
- [ ] **`bun run lint:i18n:parity` 通过**（7 个 locale 与 en.json key 数一致）
- [ ] **`bun run typecheck:all` 通过**（所有 import 路径正确解析，NPM scope 改名后无残留）
- [ ] **`bun run test:shared:all` 通过**（#24d 覆盖至少 10 个测试文件 + 所有因 M1 改造失败的测试 fixture）
- [ ] **`bun run validate:dev` 整体通过**（typecheck + 上面所有 test 一次跑完）
- [ ] **`09-test-checklist.md` §3.5 后端 setup 流程端到端验证通过**（防止 #17b 改了但没接入）
- [ ] **M1 性能基准已记录**到 `.planning/perf-baseline-M1.md`（详见 `09-test-checklist.md` §16.2）
- [ ] 自动更新指向 `update.u-agents.u-studio.cn`，能拉到自建的 latest.yml
- [ ] 网站下载页显著位置展示"首次启动指引"（教用户右键打开 / 系统设置允许）
- [ ] Sentry DSN 未被注入（`SENTRY_ELECTRON_INGEST_URL` 不设置）

**已知 M1 不做的事**（推迟到后续阶段）：
- ❌ macOS 正式签名 + Apple 公证（M2，需要 Apple Developer 账号 $99/年）
- ❌ Windows / Linux 打包（M2）
- ❌ 自动更新增量包（M2）
- ❌ 自建 OAuth relay（M3）
- ❌ 自建文档站、官网（M3）
- ❌ 自建 Sentry / 错误上报（M3 或更晚）
- ❌ 自建会话分享 viewer（M3）。**M1 阶段隐藏所有分享 UI 入口**（按钮、菜单项、命令面板命令），**禁止**使用 craft 的 share URL。详见 `04-feature-cuts.md` §7。
- ❌ 中文化深度优化（M2，zh-Hans.json 1376 keys 全覆盖；M2 commit 75bcda8 已补齐 17 处遗漏翻译，品牌词污染清零，详见 `M2-I18N-SCAN.md`）
- ❌ CLI 改造（M2 或不做）
- ❌ Web UI / Viewer 改造（M2）

---

## M2 — 多平台稳定 + 可分发

**入口条件**：M1 出口全通过 + 已有真实用户日常使用 14 天无炸机

**核心交付物**：
- **macOS 切到正式签名 + 公证**（消除"首次启动需手动绕过 Gatekeeper"的痛点）
- Windows x64 NSIS 安装包
- Linux x64 AppImage
- 自动更新增量分发（macOS / Windows / Linux 全平台）
- i18n 深度中文化 / 术语优化 / key 重命名评估（M1 已完成基础品牌词清洗与 U-API keys；M2 不再把“品牌词清洗”作为新增交付物）
- Web UI / Viewer 白标（**仅做静态品牌替换 + 部署准备**，**不开放**会话分享 UI 入口；分享 viewer 完整对接到 M3 自建后再启用，与 §M1/§M3 决策一致）。Round 41 明确启用前必清：WebUI `index.html` / `login.html` / `manifest.json` / favicon/PWA icons；Viewer `index.html` meta/title、Header href/title/logo、analytics 脚本策略、Google Fonts 远程字体自托管/移除
- 第一份用户协议 + 隐私政策（中文，部署在 `u-agents.u-studio.cn`）

**M2 任务大类**：

| 类别 | 内容 | 对应规格 |
|---|---|---|
| **macOS 公证** | 注册 Apple Developer ($99/年)、生成 Developer ID 证书、启用 notarize 配置、首次出公证版本 | `05-build-release.md` §0.2（M2 路径）+ §3.3 |
| 打包 | Windows 签名 / Linux AppImage 测试；Round 42 明确补扫 `scripts/build/linux.ts`、`apps/electron/scripts/build-win.ps1`、`scripts/build/common.ts` 中的 `Craft-Agents-*` / 构建日志 / artifact name | `05-build-release.md` §4、§5 |
| 更新 | 三平台 latest yml 校验、增量更新测试 | `06-update-server.md` |
| 中文化 | 深度中文化、术语润色、key 命名/复用评估；M1 已做基础品牌词清洗与 U-API 相关 keys | `10-i18n-zh.md` |
| Web 端 | `apps/webui` 与 `apps/viewer` 品牌替换、构建产物部署；Viewer 禁用或自托管 Plausible/Google Fonts | `01-branding-spec.md` §2.36 + §3 + 新增 `12-web-deploy.md`（M2 时再写） |
| 法务 | 用户协议、隐私政策、ICP 备案、生成式 AI 算法备案（如需）| `LEGAL.md` §6 |
| **安全** | ✅ **Remote workspace TLS 校验修复**（commit `c516e4d2`，2026-05-05）；⏸ config.json 切 `atomicWriteFileSync` 防断电丢数据；⏸ `~/.u-agents/` 改 0o700 多用户机器隐私 | `LEGAL.md` §5.4 + `M2-TLS-FIX-SPEC.md` |

**出口条件**：
- [ ] **macOS 切到正式签名 + 公证**（按 `09-test-checklist.md` §1.3 验收）
- [ ] **macOS 用户从 M1 adhoc 版本自动更新到 M2 公证版本之后，启动不再被 Gatekeeper 拦截**
- [ ] 三平台安装包均通过 `09-test-checklist.md`
- [ ] Windows/Linux 构建脚本和 `scripts/build/common.ts` 生成的 artifact name 不再使用 `Craft-Agents-*`
- [ ] 三平台自动更新均能从 N→N+1
- [ ] zh-Hans.json 中无 "Craft" 字面量
- [ ] 用户协议 + 隐私政策上线
- [ ] 至少 1 次成功的上游同步（按 `07-upstream-sync.md`）

---

## M3 — 自主权扩展

**入口条件**：M2 出口全通过 + 至少 50 个付费/活跃用户

**核心交付物**：
- 自建 OAuth relay 服务（消除 `agents.craft.do` 残留瑕疵）
- 自建文档站（`u-agents.u-studio.cn/docs/*`；M1/M2 的 docs URL 可先是占位页或 404，但完整文档站到 M3 才交付）
- 自建会话分享 viewer（`u-agents.u-studio.cn/s/*`）
- 自建 Sentry（或 Plausible / Umami 等隐私友好的错误上报）

**M3 任务大类**：

| 类别 | 内容 | 涉及文件（待 M3 时回到 `01-branding-spec.md` 跟进）|
|---|---|---|
| OAuth relay | 部署一个 Cloudflare Worker / Node 服务 | `packages/shared/src/auth/oauth-relay.ts`、`slack-oauth.ts` |
| 文档站 | 用 Mintlify / VitePress / Docusaurus 都行 | 需 fork `apps/online-docs` 或新建仓库 |
| 分享 viewer | `apps/viewer` 自部署 | 需配 R2/S3 后端存会话 JSON |
| 错误上报 | 自建 Sentry self-hosted 或 GlitchTip；启用前处理 machine hash、sessionId、agent error 原文、console capture、`.env.example` 示例和“reported”文案 | `01-branding-spec.md` §2.40 + `apps/electron` 中 Sentry init |
| Server 分发 | 如要发布 standalone server，统一 `scripts/build-server.ts` 产物命名、systemd service、Docker volume、bin 入口；Round 45 补充：build-server 生成的 docker-compose 模板也必须改 `services: craft-server`、`craft-data:/root/.craft-agent`、`volumes: craft-data` | `scripts/build-server.ts` 中 `craft-server` / `craft-data` / `/root/.craft-agent` / tarball 命名 |

**出口条件**：
- [ ] 添加 Slack/Gmail 类 OAuth Source 时浏览器地址栏不再出现 `craft.do`
- [ ] 应用内"Help / Docs"打开自建文档
- [ ] 会话分享链接形如 `https://u-agents.u-studio.cn/s/xxx`
- [ ] `LEGAL.md` §5 的所有"已知瑕疵"清空

---

## M4+ — 长期维护

进入这个阶段后，节奏稳定为：

| 周期 | 动作 | SOP |
|---|---|---|
| 每 2 周 | 看上游 commits / release notes | `07-upstream-sync.md` §1 |
| 每月 1 次 | 执行上游同步流水线 | `07-upstream-sync.md` §2-§5 |
| 每次同步后 | 跑 `01-branding-spec.md` §8 grep 验收 | `07-upstream-sync.md` §6 |
| 每次发版 | 跑 `09-test-checklist.md` | `09-test-checklist.md` |
| 每次发版 | 按 `05-build-release.md` 出三平台包 | `05-build-release.md` |

M4+ 阶段如果上游引入：
- **新 LLM provider** → 评估是否要让 U-API 用户选；多半要裁剪。回到 `02-llm-gateway-spec.md` §8、`04-feature-cuts.md` 更新。
- **新 onboarding 步骤** → 评估是否需要锁定。回到 `03-ui-lockdown-spec.md` 更新。
- **新菜单/链接** → 检查是否含 `craft.do`。回到 `01-branding-spec.md` 更新。
- **新 OAuth Source 类型** → 检查回调 URL 是否仍走 `agents.craft.do`。回到 `LEGAL.md` §5 更新。

**关键原则**：每次同步只解决"维持白标 + 维持锁定"，不主动重构。
