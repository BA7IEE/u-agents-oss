# v0.15.5 候选改造点核对

> 2026-10-22；仅独立候选，未合回主线、未发布。数字正本见 [§14 当前基线](14-uapi-marker-registry.md#0-当前基线速查)。

## 统计与处置

- 按 Git 管理的 `apps/`、`packages/` 主源码 `.ts/.tsx` 计数；新增文件加入索引后复核。构建暂存、release、node_modules 不参与。
- 原标记出现项 216 个，原文本保留 206 个，旧出现项移除/迁移 10 个，新增/改写 17 个。START/END 成对；无未登记的静默减少。
- 原 FAB 两处豁免随样式删除；设置页默认连接块改写，Add Connection 旧包围块退役但按钮与 Token 流程保留；最后连接保护改写；手动下载注释改写；Pi mini 过滤迁入共同过滤处；cache marker 改写；TurnCard 旧辅助函数 marker 退役，实际生图主回复 marker 保留。
- 206 个原文本保留只证明定位仍在；语义另按下面 44 个上游交集文件和定向运行测试核对。GUI 视觉与点击验收仍待解锁。

## 44 个上游交集文件

| 文件 | 最终处置与证据 |
|---|---|
| `apps/cli/src/index.ts` | CLI 名称、临时目录与帮助文案保留 U Agents；CLI typecheck 通过。 |
| `apps/electron/src/main/browser-pane-manager.ts` | 远程 evaluate 和浏览器默认策略保留；browser-pane/CDP 单测覆盖。 |
| `apps/electron/src/main/index.ts` | 保留双配置根、资源提示、About 归属与 feature policy；在原生包启动和隔离演练中执行。 |
| `apps/electron/src/preload/bootstrap.ts` | 保留 TLS 严格化；接受上游 preload/IPC 结构，打包后检查实际 bootstrap。 |
| `apps/electron/src/renderer/App.tsx` | 首次配置仍进入 U-API placeholder Token 流程；接受新会话界面结构。 |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 只填 Token、固定网关与编辑空值语义保留；组件/helper 单测通过。 |
| `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts` | 保留 Token-only 合同；不是恢复通用 provider 表单。 |
| `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx` | 接受上游新样式；两个旧 shadow lint 豁免退役，未添加新的豁免。 |
| `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx` | u_api setup method 与唯一产品入口保留；上游新 provider 未开放。 |
| `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx` | U-API 路由继续绕过通用 OAuth；只读发现与探活由受控 RPC 完成。 |
| `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx` | 保留不可达防护；未开放本地模型入口。 |
| `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | 保留不可达防护；未开放多 provider 选择。 |
| `apps/electron/src/renderer/components/pages/PageView.tsx` | 脚本/refresh/公开发布仍服从 feature policy；新 Claude artifact 按钮关闭。 |
| `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 示例品牌保留；新 UI 结构不恢复上游品牌。 |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | 多连接筛选、默认连接、Token-only 编辑和最后连接删除保护移入新卡片；Decision 隐藏。 |
| `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx` | 保留同版本修复的手动下载入口；更新目录仍为 fork 地址。 |
| `packages/core/src/types/index.ts` | 生图 strict envelope/parser export 保留，由 host 与 UI 共同使用。 |
| `packages/pi-agent-server/src/index.ts` | 保留品牌、关闭保温及既有子进程约束；实际打包 Pi 模拟模型往返通过。 |
| `packages/pi-agent-server/src/session-settings.ts` | 保留 main 16,000ms/ephemeral 4,000ms 预算，main 与 ephemeral cache warming 均关闭；session-settings 单测通过。 |
| `packages/pi-agent-server/src/tools/web-fetch.ts` | 私网/云元数据与 redirect SSRF 门禁保留；适配 SDK 顶层 isError 的断言，网络拒绝断言未删。 |
| `packages/server-core/src/domain/connection-setup-logic.ts` | U-API 模板、Token 必填与固定目的地保留；接受上游合法自定义 header map，保留服务账号与控制字符拒绝。 |
| `packages/server-core/src/handlers/rpc/files.ts` | 保留附件本地路径保护；包内 HEIC→JPEG、预览/缩略图、Office Markdown 通过。 |
| `packages/server-core/src/handlers/rpc/settings.ts` | Decision/功能设置写入仍受策略约束；semantic policy 回归通过。 |
| `packages/server-core/src/services/index.ts` | 付费生图 host service 继续导出；nonce、取消、脱敏与落盘生命周期回归通过。 |
| `packages/server-core/src/sessions/RemoteBrowserPaneManager.ts` | U Agents 错误文案与远程浏览器约束保留。 |
| `packages/server-core/src/sessions/SessionManager.ts` | owner 与 paid-image 生命周期、错误/费用语义保留；接受上游费用增量、后台任务和分支回滚修复。 |
| `packages/session-tools-core/src/context.ts` | host callback/agent kind 保留；接受上游 source/project 上下文和 MCP resource/prompt 能力。 |
| `packages/session-tools-core/src/handlers/index.ts` | 生图 handler export 保留，与 source/project 新 handler 共存。 |
| `packages/session-tools-core/src/index.ts` | canonical tool definition、schema、paid-image export 保留。 |
| `packages/session-tools-core/src/tool-defs-filtering.test.ts` | 保留 full/mini/其他 surface 拒绝矩阵；与 Coding/source/project 过滤组合验证。 |
| `packages/session-tools-core/src/tool-defs.ts` | 统一过滤 paid image 与 Coding 最小工具集；mini/Coding 无 generate_image，Decision 关闭。 |
| `packages/shared/src/agent/backend/pi/session-tool-defs.ts` | profile/source/project 与 agentKind 一起传给 canonical schema；Pi 与 Claude 实际列表一致。 |
| `packages/shared/src/agent/backend/types.ts` | 保留 paid owner/runtime callback 类型；接受上游 profile 与 backend 结构。 |
| `packages/shared/src/agent/claude-agent.ts` | factory 同时传 owner、agentKind、workspace、profile/source/project；MCP wrapper 每次创建。 |
| `packages/shared/src/agent/core/__tests__/guarded-mode.test.ts` | 按 fork 禁用政策保留拒绝/ask normalization 回归；不恢复上游 enabled 决策模式。 |
| `packages/shared/src/agent/index.ts` | paid registry 与后端 export 保留；新上游 export 共存。 |
| `packages/shared/src/agent/pi-agent.ts` | 保留 paid owner、mini 执行门禁和品牌；新增 profile/source/project 传递。 |
| `packages/shared/src/agent/session-scoped-tools.ts` | 缓存身份覆盖全部捕获上下文；session cleanup 清理所有变体，global invalidation 与 replacement owner 有直接 factory 回归。 |
| `packages/shared/src/config/llm-connections.ts` | U-API 专用模型目录规则与上游 maxTokens 字段共存。 |
| `packages/shared/src/config/preferences.ts` | 用户数据原子写入保留；接受上游偏好类型变化。 |
| `packages/shared/src/config/storage.ts` | 固定网关/多连接/原子写入/权限/默认功能策略保留；cap 在启动存储重载后继续生效。 |
| `packages/shared/src/sources/credential-manager.ts` | SSRF/手动 redirect 与凭据脱敏保持；接受 OAuth refresh 去重/认证修复。 |
| `packages/ui/src/components/chat/TurnCard.tsx` | 生图 strict parser 主回复展示保留，迁入上游新 WorkLog/turn 结构；旧辅助函数 marker 退役。 |
| `packages/ui/src/components/markdown/MarkdownImageBlock.tsx` | host 私有路径图片动作隐藏保留；真实生图 fidelity/账单仍未验收。 |

## 移除或迁移的旧出现项

| 文件 | 原标记 |
|---|---|
| `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx` | // U-API: 继承上游 v0.9.3 FAB 视觉设计；改 shadow class 会破坏设计 — 豁免 lint |
| `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx` | // U-API: 同上 — 继承上游 hover 视觉效果，豁免 lint |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | {/* U-API START: multi-connection soft lockdown — always show Default Connection |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | {/* U-API END */} |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | // U-API: multi-connection soft lockdown — last U-API connection cannot be deleted (02 §6.2 Q2) |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | {/* U-API START: multi-connection soft lockdown — restore Add Connection button removed by 540509b. |
| `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx` | {/* U-API: keep manual download visible even when same-version auto-update cannot advance. */} |
| `packages/shared/src/agent/pi-agent.ts` | // U-API: mini agents never receive the paid image tool definition (16 §0). |
| `packages/shared/src/agent/session-scoped-tools.ts` | // U-API: cache identity includes agent kind + owner so full/mini and replacement agents cannot share wrappers (16B §5). |
| `packages/ui/src/components/chat/TurnCard.tsx` | // U-API: generated image ToolResults render as first-class turn output via the shared strict parser (16 §8.3). |

## 新增或改写的出现项

| 文件 | 新标记 |
|---|---|
| `apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx` | {/* U-API: public session sharing remains hidden in the new upstream header. */} |
| `apps/electron/src/renderer/components/app-shell/input/CodingWorkspacePanel.tsx` | // U-API: user-created coding branches carry the fork's namespace. |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | {/* U-API START: keep all authorized connections selectable, including the first connection. */} |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | // U-API: the last U-API connection cannot be deleted (02 §6.2 Q2). |
| `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx` | {/* U-API: keep manual download available for same-version repair. */} |
| `packages/pi-agent-server/src/packaged-images.isolated.ts` | // U-API: exercise the actual bundled Pi server outside the repository, including Photon WASM. |
| `packages/pi-agent-server/src/session-settings.ts` | // U-API: the test candidate never sends background cache-warming model requests. |
| `packages/server-core/src/domain/u-api-connection-state.ts` | // U-API: invalidate asynchronous discovery when setup starts; never retain token text here. |
| `packages/server-core/src/handlers/rpc/llm-connections.ts` | // U-API: revalidate on save; stale test results cannot restore a cap for another Token/protocol. |
| `packages/server-core/src/handlers/rpc/llm-connections.ts` | // U-API: generic metadata saves also ignore renderer caps and serialize with Token changes. |
| `packages/server-core/src/handlers/rpc/pages.ts` | // U-API: reject every public-publishing route before credentials, SDK imports or network. |
| `packages/server-core/src/handlers/rpc/u-api-cap-lifecycle.isolated.ts` | // U-API: real RPC -> vault/config -> reload -> Pi model definition, with synthetic credentials. |
| `packages/server-core/src/model-fetchers/index.ts` | // U-API: discard obsolete results; preserve metadata from the latest saved connection only. |
| `packages/server-core/src/runtime/inherited-app-env.ts` | // U-API: honor the fork's runtime hints first; retain legacy Craft compatibility. |
| `packages/server/src/index.ts` | // U-API: sanitize inherited paths before evaluating any runtime/asset override. |
| `packages/shared/src/agent/backend/pi/session-tool-defs.ts` | // U-API: use the same full/mini, coding and feature filters as Claude. |
| `packages/shared/src/agent/session-scoped-tools.ts` | // U-API: tools capture their paid owner and context; cache every visibility/ownership input. |

## 候选完整定位清单

行号只用于本次核对，后续优先用符号/注释文字定位。

| # | 文件:行 | 标记 |
|---|---|---|
| 1 | `apps/cli/src/index.ts:1077` | // U-API: tmpDir prefix renamed (M2 cli rename, 2026-05-05) |
| 2 | `apps/cli/src/index.ts:1398` | // U-API: skill description rebrand (M2 cli rename, 2026-05-05) |
| 3 | `apps/cli/src/index.ts:1923` | // U-API: M2 cli rename — bin name 改为 u-agents-cli（commit `1a49d128`）， |
| 4 | `apps/electron/src/main/browser-pane-manager.ts:30` | // U-API: getBrowserToolEnabled 为 D5-b dispatcher 总闸引入（M3 remote browser lockdown §3.1） |
| 5 | `apps/electron/src/main/browser-pane-manager.ts:2694` | // U-API: remote browser pane 总闸 — browser tool 关闭时拒绝所有远程 capability 调用 |
| 6 | `apps/electron/src/main/handlers/workspace.ts:29` | // U-API: TLS strict mode (REVIEW-5 P0 fix, 2026-05-05) — was tlsRejectUnauthorized: false |
| 7 | `apps/electron/src/main/index.ts:367` | /* U-API START: Apache §4(c) attribution — About panel shows U Studio copyright only. |
| 8 | `apps/electron/src/main/index.ts:377` | /* U-API END */ |
| 9 | `apps/electron/src/main/logger.ts:85` | // U-API: logs follow the same isolated config root as credentials and workspaces. |
| 10 | `apps/electron/src/main/logger.ts:215` | // U-API: logs follow the same isolated config root as credentials and workspaces. |
| 11 | `apps/electron/src/main/window-state.ts:2` | // U-API: atomic writes for user-data persistence (REVIEW-5 P1, 2026-05-05) — 防断电/crash partial write |
| 12 | `apps/electron/src/main/window-state.ts:42` | // U-API: dir mode 0o700 for multi-user machine privacy (M2 cleanup, 2026-05-05) |
| 13 | `apps/electron/src/preload/bootstrap.ts:136` | // U-API: TLS strict mode (REVIEW-5 P0 fix, 2026-05-05) — was tlsRejectUnauthorized: false |
| 14 | `apps/electron/src/preload/bootstrap.ts:160` | // U-API: TLS strict mode (REVIEW-5 P0 fix, 2026-05-05) — was tlsRejectUnauthorized: false |
| 15 | `apps/electron/src/renderer/App.tsx:24` | // U-API: multi-connection soft lockdown — first-install onboarding edits the placeholder 'u-api-default' (02 §6.2.3) |
| 16 | `apps/electron/src/renderer/App.tsx:720` | // U-API: first-install onboarding always targets the placeholder 'u-api-default' that |
| 17 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx:36` | // U-API: U_API_TOPUP_URL no longer imported — Topup link removed from UI 2026-05-04 (02 §6.2) |
| 18 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx:162` | // U-API: D4 (2026-06-10, 02 §3.3) — Anthropic 侧预设不展示 claude-opus-4-8/claude-fable-5（上游 |
| 19 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx:467` | {/* U-API: removed lockNotice banner + 三链接 (Manage Token / 充值 / 查看可用模型与定价) |
| 20 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx:499` | {/* U-API: removed Topup link per UI cleanup 2026-05-04 — see 02-llm-gateway-spec.md §6.2 */} |
| 21 | `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts:17` | // U-API: regression coverage ensures onboarding never reintroduces a hardcoded model or protocol |
| 22 | `apps/electron/src/renderer/components/apisetup/submit-helpers.ts:6` | // U-API: onboarding submits only the token; model, protocol and fallback order are resolved by the main process |
| 23 | `apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx:274` | {/* U-API: public session sharing remains hidden in the new upstream header. */} |
| 24 | `apps/electron/src/renderer/components/app-shell/input/CodingWorkspacePanel.tsx:39` | // U-API: user-created coding branches carry the fork's namespace. |
| 25 | `apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts:36` | // U-API: brand — v0.9.5 上游把 FreeFormInput.tsx 内联 grouping 抽到本 helper， |
| 26 | `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx:28` | /* U-API START: u_api ApiSetupMethod 定义（M1 多 provider 裁剪后保留） */ |
| 27 | `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx:36` | /* U-API END */ |
| 28 | `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx:67` | // U-API: 路由 U-API 凭证流程，绕过通用 OAuth 路径 |
| 29 | `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx:266` | // U-API: U-API 模式分支 |
| 30 | `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx:306` | // U-API: U-API 模式分支 |
| 31 | `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx:15` | // U-API: this step is intentionally not reached by the M1 onboarding state machine. |
| 32 | `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx:12` | // U-API: this step is intentionally not reached by the M1 onboarding state machine. |
| 33 | `apps/electron/src/renderer/components/pages/PageView.tsx:427` | {/* U-API: preserved legacy schedules are visible but never registered for execution. */} |
| 34 | `apps/electron/src/renderer/components/ui/EditPopover.tsx:316` | // U-API: brand cleanup — mirrors editPopover.example.addSource i18n value (01 §2.29) |
| 35 | `apps/electron/src/renderer/hooks/useOnboarding.ts:22` | // U-API: multi-connection soft lockdown — U_API_SLUG no longer needed here, slug now resolved per call (02 §6.2.2) |
| 36 | `apps/electron/src/renderer/hooks/useOnboarding.ts:102` | // U-API: multi-connection soft lockdown — base 'u-api' makes resolveSlugForMethod yield |
| 37 | `apps/electron/src/renderer/hooks/useOnboarding.ts:166` | /* U-API START: multi-connection soft lockdown — let resolveSlugForMethod |
| 38 | `apps/electron/src/renderer/hooks/useOnboarding.ts:179` | /* U-API END */ |
| 39 | `apps/electron/src/renderer/hooks/useOnboarding.ts:442` | // U-API: token-only edit with an empty value has no mutable fields; keep the stored credential and resolved catalog unchanged |
| 40 | `apps/electron/src/renderer/hooks/useUpdateChecker.ts:46` | // U-API: automatic update failures always retain an HTTPS manual-download escape hatch. |
| 41 | `apps/electron/src/renderer/lib/manual-update.test.ts:1` | // U-API: regression for the visible/manual HTTPS update fallback and failure action. |
| 42 | `apps/electron/src/renderer/lib/manual-update.ts:1` | // U-API: manual update fallback must stay on the HTTPS U Studio download page. |
| 43 | `apps/electron/src/renderer/main.tsx:36` | // U-API: .catch 兜底替代上游 void — main 侧 i18n:changeLanguage handler 内 rebuildMenu 可能抛， |
| 44 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:66` | // U-API: multi-connection soft lockdown — isUApiSlug recognizes 'u-api-default' / 'u-api' / 'u-api-N' (02 §6.2.2) |
| 45 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:242` | // U-API: ConnectionRow isUApiConnection 判定，决定是否显示 U-API 专用 UI |
| 46 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:243` | // U-API: multi-connection soft lockdown — Rename / Set Default / Delete are all allowed for |
| 47 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:244` | // U-API: every U-API connection now. Delete still respects isLastConnection (caller passes |
| 48 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:245` | // U-API: uApiConnections.length === 1) so the lockdown invariant "at least one connection" holds. |
| 49 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:246` | // U-API: The previous single-connection lockdown hid these via !isUApiConnection guards; removed. (02 §6.2) |
| 50 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:656` | // U-API: multi-connection soft lockdown — every U-API slug routes to the U-API setup wizard (02 §6.2.2) |
| 51 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:886` | // U-API: multi-connection soft lockdown — show every U-API slug, not just primary (02 §6.2.2) |
| 52 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:1097` | // U-API: token-only auto-discovery edits start empty so a masked placeholder is never sent as a real credential |
| 53 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:1608` | {/* U-API START: keep all authorized connections selectable, including the first connection. */} |
| 54 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:1620` | {/* U-API END */} |
| 55 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:1684` | // U-API: the last U-API connection cannot be deleted (02 §6.2 Q2). |
| 56 | `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:330` | {/* U-API: keep manual download available for same-version repair. */} |
| 57 | `packages/core/src/types/index.ts:60` | // U-API: 生图结果合同由 host 与 UI 共同消费，避免双 parser 漂移（16 §8）。 |
| 58 | `packages/core/src/types/uapi-image-result.ts:1` | // U-API: 生图 ToolResult 的跨 host/UI 共享严格合同（16-image-generation-tool-spec.md §8）。 |
| 59 | `packages/messaging-gateway/src/access-control.ts:235` | // U-API: brand — v0.9.1 上游引入此文案，rejection reply 直发给用户 |
| 60 | `packages/messaging-gateway/src/commands.ts:455` | // U-API: brand — v0.9.1 上游引入 pairing code rejection 文案，直发给用户 |
| 61 | `packages/messaging-gateway/src/topic-registry.ts:24` | // U-API: atomic writes for user-data persistence (REVIEW-5 P1, 2026-05-05) — 防断电/crash partial write |
| 62 | `packages/pi-agent-server/src/index.ts:1441` | // U-API: preserve the branded host system prompt across SDK turns. |
| 63 | `packages/pi-agent-server/src/packaged-images.isolated.ts:1` | // U-API: exercise the actual bundled Pi server outside the repository, including Photon WASM. |
| 64 | `packages/pi-agent-server/src/session-settings.ts:52` | // U-API: pin the SDK retry ceiling to the documented exponential-backoff budget. |
| 65 | `packages/pi-agent-server/src/session-settings.ts:107` | // U-API: the test candidate never sends background cache-warming model requests. |
| 66 | `packages/pi-agent-server/src/tools/web-fetch-ssrf.test.ts:7` | * 3. 源码层 marker 防回归：// U-API: M3 SSRF 防护 注释存在 |
| 67 | `packages/pi-agent-server/src/tools/web-fetch-ssrf.test.ts:117` | // U-API: M3 SSRF marker 至少 2 处（redirect:'manual' 注释 + 30x reject 注释） |
| 68 | `packages/pi-agent-server/src/tools/web-fetch.ts:368` | // U-API: M3 SSRF 防护 — redirect bypass 修补（不跟随 30x，主动检查；详见 M3-SSRF-CONSOLIDATION-SPEC §2.1） |
| 69 | `packages/pi-agent-server/src/tools/web-fetch.ts:379` | // U-API: M3 SSRF 防护 — 主动拒绝 30x redirect（攻击者用公网 URL → 私网/云元数据的 redirect 跳板攻击） |
| 70 | `packages/server-core/src/domain/connection-setup-logic.ts:72` | /* U-API START: validateSetupTestInput 扩展，支持 pi_compat (U-API) */ |
| 71 | `packages/server-core/src/domain/connection-setup-logic.ts:79` | /* U-API END */ |
| 72 | `packages/server-core/src/domain/connection-setup-logic.ts:218` | /* U-API START: multi-connection soft lockdown — base 'u-api' template for new connections |
| 73 | `packages/server-core/src/domain/connection-setup-logic.ts:230` | /* U-API END */ |
| 74 | `packages/server-core/src/domain/u-api-connection-state.ts:3` | // U-API: invalidate asynchronous discovery when setup starts; never retain token text here. |
| 75 | `packages/server-core/src/domain/u-api-model-discovery.test.ts:26` | // U-API: automatic discovery regression coverage for dynamic defaults, filtering and fallback ordering |
| 76 | `packages/server-core/src/domain/u-api-model-discovery.ts:131` | // U-API: token-scoped automatic model discovery, capability filtering and version-aware recommendation fallback |
| 77 | `packages/server-core/src/domain/u-api-model-discovery.ts:340` | // U-API: refresh only catalog membership/routing; preserve explicit image capability choices. |
| 78 | `packages/server-core/src/handlers/rpc/files.ts:413` | // U-API: dependency security — use the bundled Python/uv converter instead of vulnerable markitdown-js. |
| 79 | `packages/server-core/src/handlers/rpc/llm-connections-uapi-policy.isolated.ts:1` | // U-API: real RPC dispatch, isolated module mocks, no credentials or external requests. |
| 80 | `packages/server-core/src/handlers/rpc/llm-connections.ts:130` | // U-API: revalidate on save; stale test results cannot restore a cap for another Token/protocol. |
| 81 | `packages/server-core/src/handlers/rpc/llm-connections.ts:342` | // U-API: destination validation precedes stored-key lookup; caller input cannot reroute a token. |
| 82 | `packages/server-core/src/handlers/rpc/llm-connections.ts:365` | // U-API: discover the token-scoped catalog, then probe recommended models without exposing model/protocol choices in onboarding |
| 83 | `packages/server-core/src/handlers/rpc/llm-connections.ts:537` | // U-API: generic metadata saves also ignore renderer caps and serialize with Token changes. |
| 84 | `packages/server-core/src/handlers/rpc/pages.ts:445` | // U-API: reject every public-publishing route before credentials, SDK imports or network. |
| 85 | `packages/server-core/src/handlers/rpc/settings.ts:36` | // U-API: classify v0.9.4 RTK channels missed by upstream's HANDLED_CHANNELS (C13 pattern, mirrors routing.ts #37 fix from v0.9.1) |
| 86 | `packages/server-core/src/handlers/rpc/transfer.test.ts:165` | // U-API: deterministic clock; verify renewal without racing a loaded test runner. |
| 87 | `packages/server-core/src/handlers/rpc/u-api-cap-lifecycle.isolated.ts:1` | // U-API: real RPC -> vault/config -> reload -> Pi model definition, with synthetic credentials. |
| 88 | `packages/server-core/src/model-fetchers/index.ts:81` | // U-API: unlike arbitrary compat endpoints, U-API owns a token-scoped model catalog that can be refreshed safely |
| 89 | `packages/server-core/src/model-fetchers/index.ts:94` | // U-API: discard obsolete results; preserve metadata from the latest saved connection only. |
| 90 | `packages/server-core/src/model-fetchers/u-api-refresh-preservation.test.ts:1` | // U-API: refresh preserves explicit false and the established recommendation rule. |
| 91 | `packages/server-core/src/model-fetchers/u-api-refresh-storage.isolated.ts:1` | // U-API: exercise the actual refresh -> atomic config write -> reload path with a fake token. |
| 92 | `packages/server-core/src/pages/__tests__/script-executor-bridge.test.ts:39` | // U-API: direct bridge callers cannot bypass the broker's product policy. |
| 93 | `packages/server-core/src/pages/pages-feature-policy.test.ts:1` | // U-API: fixed policies reject alternate entry points before credentials, network or child processes. |
| 94 | `packages/server-core/src/runtime/inherited-app-env.ts:50` | // U-API: honor the fork's runtime hints first; retain legacy Craft compatibility. |
| 95 | `packages/server-core/src/services/index.ts:3` | // U-API: host-only Images transport and safety boundary (16 §10.3). |
| 96 | `packages/server-core/src/services/u-api-image-generation.test.ts:1` | // U-API: Images host service 的exact目录、单claim、multipart与零网络失败回归（16 §11.1）。 |
| 97 | `packages/server-core/src/services/u-api-image-generation.ts:1` | // U-API: NewAPI Images host service；固定出口、单次claim、真实图片校验与安全落盘（16 §5-§7）。 |
| 98 | `packages/server-core/src/services/uapi-image-result-contract.test.ts:1` | // U-API: 生图 ToolResult 共享 parser 防漂移回归（16-image-generation-tool-spec.md §11）。 |
| 99 | `packages/server-core/src/sessions/RemoteBrowserPaneManager.ts:76` | // U-API: brand — v0.10.0 remote browser 错误文案 Craft Agent → U Agents |
| 100 | `packages/server-core/src/sessions/SessionManager.ts:717` | // U-API: host-owned paid image invocation state；不持久化、不进入renderer DTO（16B §1-§5）。 |
| 101 | `packages/server-core/src/sessions/SessionManager.ts:1521` | // U-API: an unsupported condition must never turn into an unconditional run. |
| 102 | `packages/server-core/src/sessions/SessionManager.ts:6941` | // U-API: queued user messages own a new paid context; steers revoke the current one. |
| 103 | `packages/server-core/src/sessions/SessionManager.ts:7294` | // U-API: paid capability follows the original invocation through the new ephemeral context channel. |
| 104 | `packages/server-core/src/sessions/SessionManager.ts:9705` | // U-API: hidden source retry retains the original paid identity, never a new authorization. |
| 105 | `packages/server-core/src/sessions/paid-image-lifecycle.test.ts:1` | // U-API: host paid lease的本地自修正预算、owner gate与claimed取消语义（16B §3-§5）。 |
| 106 | `packages/server-core/src/sessions/paid-image-redaction.test.ts:1` | // U-API: paid tool内部字段在任何format / journal持久化前剥离（16B §2.2）。 |
| 107 | `packages/server-core/src/sessions/refresh-connection-runtime.test.ts:207` | // U-API: give the real refresh routine an actual connection; an absent slug cannot test capabilities. |
| 108 | `packages/server-core/src/sessions/upgrade-isolation.test.ts:1` | // U-API: synthetic fixtures only; production-root sentinels must remain untouched. |
| 109 | `packages/server/src/__tests__/smoke.test.ts:39` | // U-API: headless smoke must not share credentials or the server lock with the desktop profile. |
| 110 | `packages/server/src/index.ts:94` | // U-API: sanitize inherited paths before evaluating any runtime/asset override. |
| 111 | `packages/session-mcp-server/src/index.ts:262` | // U-API: Codex must not list paid image generation (16 §0). |
| 112 | `packages/session-mcp-server/src/index.ts:442` | // U-API: the CallTool registry is filtered independently from ListTools to reject stale direct calls (16 §10.2). |
| 113 | `packages/session-tools-core/src/context.ts:35` | // U-API: 生图工具只向 host 传递 canonical args；路径、Token、model 不可由模型提供（16 §3）。 |
| 114 | `packages/session-tools-core/src/generate-image-contract.test.ts:1` | // U-API: generate_image schema、角色与付费前不变量回归（16 §11.1）。 |
| 115 | `packages/session-tools-core/src/generate-image-contract.ts:1` | // U-API: generate_image 的唯一 schema 与联网前不变量校验（16 §3.1）。 |
| 116 | `packages/session-tools-core/src/handlers/create-task.test.ts:1` | // U-API: retain strict indexed-access checks in upstream tool assertions. |
| 117 | `packages/session-tools-core/src/handlers/decide.test.ts:37` | // U-API: the product denies all decision invocations before validation or callbacks. |
| 118 | `packages/session-tools-core/src/handlers/generate-image.ts:1` | // U-API: canonical generate_image 薄 handler，网络与文件能力由 server host 注入（16 §10.1）。 |
| 119 | `packages/session-tools-core/src/handlers/index.ts:80` | // U-API: paid image tool handler (host capability required). |
| 120 | `packages/session-tools-core/src/handlers/pages.test.ts:1` | // U-API: retain strict indexed-access checks in upstream tool assertions. |
| 121 | `packages/session-tools-core/src/handlers/send-agent-message.test.ts:43` | // U-API: v0.11.0 upstream test must satisfy this fork's noUncheckedIndexedAccess baseline. |
| 122 | `packages/session-tools-core/src/handlers/source-test.ts:23` | // U-API: M3 SSRF 防护 — credential-bearing source test 必须挡私网/云元数据/http（详见 M3-SSRF-CONSOLIDATION-SPEC §2.2） |
| 123 | `packages/session-tools-core/src/handlers/source-test.ts:477` | // U-API: M3 SSRF 防护 — 阻止 source test 调用打到私网/云元数据/非 https URL |
| 124 | `packages/session-tools-core/src/handlers/source-test.ts:601` | // U-API: M3 SSRF 防护 — credential-bearing fetch 不跟随 30x（防 redirect bypass） |
| 125 | `packages/session-tools-core/src/handlers/source-test.ts:611` | // U-API: M3 SSRF 防护 — 主动拒绝 30x redirect |
| 126 | `packages/session-tools-core/src/handlers/source-test.ts:694` | // U-API: M3 SSRF 防护 — 不跟随 30x（防 redirect bypass） |
| 127 | `packages/session-tools-core/src/handlers/source-test.ts:702` | // U-API: M3 SSRF 防护 |
| 128 | `packages/session-tools-core/src/handlers/source-test.ts:711` | // U-API: M3 SSRF 防护 |
| 129 | `packages/session-tools-core/src/handlers/source-test.ts:719` | // U-API: M3 SSRF 防护 — 主动拒绝 30x redirect（basic test 无 creds，但仍防内网探测） |
| 130 | `packages/session-tools-core/src/index.ts:10` | // U-API: expose the canonical paid image contract to host adapters (16 §10.1). |
| 131 | `packages/session-tools-core/src/tool-defs-filtering.test.ts:58` | // U-API: generate_image 只在 full Claude/Pi 可见，Codex/mini fail closed（16 §0）。 |
| 132 | `packages/session-tools-core/src/tool-defs.ts:818` | // U-API: paid image tool is full Claude/Pi only; handler performs a second host-origin gate (16 §0). |
| 133 | `packages/shared/src/__tests__/m2-security-regression.test.ts:98` | // U-API: browser tool 默认关闭防回归（v24 G1.F4.1 决策；详见 .planning/04-feature-cuts.md §九类） |
| 134 | `packages/shared/src/__tests__/m2-security-regression.test.ts:121` | // U-API: 远程 evaluate 默认关闭防回归（M3 remote browser lockdown D1；详见 .planning/M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md §2.3） |
| 135 | `packages/shared/src/__tests__/m2-security-regression.test.ts:141` | // U-API: remote browser dispatcher 总闸防回归（M3 remote browser lockdown D5-b；详见 §3.4） |
| 136 | `packages/shared/src/__tests__/m3-dsn-assertion-regression.test.ts:93` | // U-API: Windows packaging must stay on Bun's runner; npm 11 turns matching security overrides into EOVERRIDE. |
| 137 | `packages/shared/src/agent/__tests__/claude-agent-spawn-cwd.test.ts:199` | // U-API: brand — v24 G1.F3.2 P2 真修：补 U Agents.app 显式回归（防 regex 假设破裂） |
| 138 | `packages/shared/src/agent/__tests__/paid-image-tool-registry.test.ts:1` | // U-API: paid image callback owner replace / compare-delete 回归（16B §7.5）。 |
| 139 | `packages/shared/src/agent/__tests__/paid-image-tool-registry.test.ts:26` | // U-API: identical session ids and owner tokens do not authorize a different workspace. |
| 140 | `packages/shared/src/agent/backend/claude/persistent-input.test.ts:5` | // U-API: background agents must be explicit opt-in to avoid surprise token usage. |
| 141 | `packages/shared/src/agent/backend/claude/persistent-input.ts:36` | // U-API: metered-token safety — default OFF; prefer U Agents env name while retaining legacy compatibility. |
| 142 | `packages/shared/src/agent/backend/pi/session-tool-defs.ts:18` | // U-API: Pi registration is filtered by full/mini agent kind before merge registration (16 §10.2). |
| 143 | `packages/shared/src/agent/backend/pi/session-tool-defs.ts:30` | // U-API: use the same full/mini, coding and feature filters as Claude. |
| 144 | `packages/shared/src/agent/backend/types.ts:154` | // U-API: opaque paid callback identity; credentials and invocation state remain in server-core (16B §5). |
| 145 | `packages/shared/src/agent/claude-agent.ts:1196` | // U-API: full/mini visibility and paid callback owner are part of the tool cache identity (16 §10.2). |
| 146 | `packages/shared/src/agent/claude-context.ts:74` | // U-API: canonical handler receives only the host callback, never token/path/model access (16 §10.2). |
| 147 | `packages/shared/src/agent/core/__tests__/guarded-mode.test.ts:98` | // U-API: a stored Guarded mode must use normal Ask checks; no decision callback runs. |
| 148 | `packages/shared/src/agent/index.ts:39` | // U-API: host-owned paid image callback lifecycle (16B §5). |
| 149 | `packages/shared/src/agent/mode-manager.ts:1871` | // U-API: direct callers also normalize legacy Guarded mode before permission checks. |
| 150 | `packages/shared/src/agent/paid-image-tool-registry.ts:1` | // U-API: paid image callback 按 canonical session path + owner 隔离，旧agent不能删新callback（16B §5）。 |
| 151 | `packages/shared/src/agent/pi-agent.ts:138` | // U-API: brand — v0.10.0 remote browser 错误文案 Craft Agent → U Agents |
| 152 | `packages/shared/src/agent/pi-agent.ts:1667` | // U-API: execution gate is authoritative even if the Pi subprocess retained a stale merge registration (16 §10.2). |
| 153 | `packages/shared/src/agent/session-scoped-tools.ts:235` | // U-API: tools capture their paid owner and context; cache every visibility/ownership input. |
| 154 | `packages/shared/src/auth/__tests__/state.test.ts:416` | //     // U-API: the fixed remote base URL still requires a user token. |
| 155 | `packages/shared/src/auth/callback-page.ts:46` | &lt;!-- U-API: brand title for OAuth callback page (01 §2.16) --> |
| 156 | `packages/shared/src/auth/state.ts:305` | // U-API: the fixed remote base URL still requires a user token. |
| 157 | `packages/shared/src/automations/automation-system.ts:245` | // U-API: unsupported conditions gate every action kind without mutating stored configuration. |
| 158 | `packages/shared/src/automations/retry-scheduler.ts:161` | // U-API: persisted webhook retries must not bypass unsupported semantic conditions. |
| 159 | `packages/shared/src/automations/script-executor.ts:89` | // U-API: reject stale/queued Pages refreshes at the last execution boundary. |
| 160 | `packages/shared/src/automations/u-agents-semantic-policy.test.ts:1` | // U-API: unsupported conditions never become unconditional execution; stored evidence survives. |
| 161 | `packages/shared/src/automations/validation.ts:256` | // U-API: editing/import validation explains unsupported semantics; runtime loading keeps original records. |
| 162 | `packages/shared/src/config/__tests__/mini-model-selection.test.ts:5` | // U-API: regression coverage for MiniMax brand names and exact utility-model tokens |
| 163 | `packages/shared/src/config/__tests__/storage-startup-migration.test.ts:35` | // U-API: 兼容两种调用约定——上游 v0.10.4 新增迁移测试按数组传 llmConnections，我方既有 U-API lockdown 测试传 config 对象 |
| 164 | `packages/shared/src/config/llm-connections.ts:364` | // U-API: match utility keywords as full id/name tokens so the MiniMax brand is not mistaken for a "mini" model |
| 165 | `packages/shared/src/config/paths.ts:10` | // U-API: one config root, with nonempty U Agents override before the legacy override. |
| 166 | `packages/shared/src/config/paths.ts:32` | // U-API: one config root, with nonempty U Agents override before the legacy override. |
| 167 | `packages/shared/src/config/preferences.ts:6` | // U-API: atomic writes for user-data persistence (REVIEW-5 P1, 2026-05-05) — 防断电/crash partial write |
| 168 | `packages/shared/src/config/provider-metadata.ts:6` | // U-API: import multi-connection slug helper (02 §6.2.2) |
| 169 | `packages/shared/src/config/provider-metadata.ts:91` | // U-API: multi-connection soft lockdown — match all U-API slugs (02 §6.2.2) |
| 170 | `packages/shared/src/config/storage.ts:27` | // U-API: atomic writes for user-data persistence (REVIEW-5 P1, 2026-05-05) — 防断电/crash partial write |
| 171 | `packages/shared/src/config/storage.ts:149` | // U-API: browser tool 默认关闭（v24 G1.F4.1 决策；详见 04-feature-cuts.md §九类） |
| 172 | `packages/shared/src/config/storage.ts:152` | // U-API: 远程 evaluate 默认关闭（M3 remote browser lockdown；详见 .planning/M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md §2.2） |
| 173 | `packages/shared/src/config/storage.ts:275` | // U-API: dir mode 0o700 for multi-user machine privacy (M2 cleanup, 2026-05-05) |
| 174 | `packages/shared/src/config/storage.ts:692` | // U-API: preserve stored unsupported settings without allowing an enable/write bypass. |
| 175 | `packages/shared/src/config/storage.ts:1828` | // U-API: token-scoped model catalogs must not be overwritten by hardcoded provider defaults (multi-connection — 02 §6.2.2). |
| 176 | `packages/shared/src/config/storage.ts:2045` | // U-API: D2 (v0.10.3 sync, 02 §6.2.2) — U-API 连接的模型清单是 newapi 动态路由名（ |
| 177 | `packages/shared/src/config/storage.ts:2252` | /* U-API START: D2 (v0.10.3 sync, 02 §6.2.2) — fork 内全部连接皆 U-API（lockdown 保证）， |
| 178 | `packages/shared/src/config/storage.ts:2257` | /* U-API END */ |
| 179 | `packages/shared/src/config/storage.ts:2399` | /* U-API START: multi-connection soft lockdown — 02-llm-gateway-spec.md §6.2.1 |
| 180 | `packages/shared/src/config/storage.ts:2429` | // U-API: the token-scoped catalog owns model/default selection; migrate legacy manual U-API rows to automatic sync |
| 181 | `packages/shared/src/config/storage.ts:2458` | /* U-API END */ |
| 182 | `packages/shared/src/config/storage.ts:2594` | // U-API: this is a continuous startup lock, not a one-shot migration. |
| 183 | `packages/shared/src/config/storage.ts:2595` | // U-API: D2 (v0.10.3 sync) — enforceUApiBaseUrl 必须先于 Phase 1k：它把 U-API 连接归一成 |
| 184 | `packages/shared/src/config/storage.ts:2733` | // U-API: D2 — enforce 先于 normalize（同启动序列的顺序约定，02 §6.2.2） |
| 185 | `packages/shared/src/config/u-agents-feature-policy.ts:1` | // U-API: fixed product boundaries; no environment variable can enable a second model outlet or publishing. |
| 186 | `packages/shared/src/config/u-api-defaults.ts:10` | // U-API: 多连接软锁定 — 识别一个 connection 是否属于 U-API（详见 02-llm-gateway-spec.md §6.2.2）。 |
| 187 | `packages/shared/src/config/watcher.ts:377` | // U-API: dir mode 0o700 for multi-user machine privacy (M2 cleanup, 2026-05-05) |
| 188 | `packages/shared/src/credentials/__tests__/secure-storage-config-dir.test.ts:62` | // U-API: regression for packaged test profiles overwriting ~/.u-agents/credentials.enc. |
| 189 | `packages/shared/src/credentials/backends/secure-storage.ts:45` | // U-API: credentials must follow CONFIG_DIR so test/multi-instance overrides cannot overwrite the real profile. |
| 190 | `packages/shared/src/credentials/manager.ts:14` | // U-API: LLM API key length bounds (M2 cleanup, 2026-05-05) — defend against accidental large-text paste |
| 191 | `packages/shared/src/decisions/health.test.ts:5` | // U-API: probes cannot reopen the disabled independent model route. |
| 192 | `packages/shared/src/decisions/health.ts:43` | // U-API: both direct and configured health probes are disabled before any fetch. |
| 193 | `packages/shared/src/decisions/health.ts:95` | // U-API: both direct and configured health probes are disabled before any fetch. |
| 194 | `packages/shared/src/decisions/resolve.ts:64` | // U-API: this gate precedes skipGates and credential resolution. |
| 195 | `packages/shared/src/feature-flags.ts:75` | // U-API: public publishing cannot be enabled through environment overrides. |
| 196 | `packages/shared/src/interceptor-common.ts:12` | // U-API: path migration from CRAFT_CONFIG_DIR to U_AGENTS_CONFIG_DIR (line 14, 30, 39) |
| 197 | `packages/shared/src/pages/refresh.ts:38` | // U-API: old configs stay on disk but never register a Pages refresh job. |
| 198 | `packages/shared/src/pages/share-bundle.test.ts:143` | // U-API: legacy on-disk grant, not a newly authorized script. |
| 199 | `packages/shared/src/pages/share-bundle.test.ts:156` | // U-API: legacy on-disk grant, not a newly authorized script. |
| 200 | `packages/shared/src/pages/storage.test.ts:170` | // U-API: seed an already-stored upstream record; public creation rejects refresh. |
| 201 | `packages/shared/src/resources/__tests__/resource-bundle.test.ts:141` | // U-API: test asserts the field directly to verify reset semantics, not gating logic |
| 202 | `packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts:204` | // U-API: test the new common path used by Pages, rather than counting old wrapper comments. |
| 203 | `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts:234` | // U-API: M3 SSRF 防护 — 拒绝 credential-bearing fetch 到云元数据/私网（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md） |
| 204 | `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts:362` | // U-API: M3 SSRF redirect bypass 防护（v24 F1.F3 P0 真修） |
| 205 | `packages/shared/src/sources/__tests__/token-refresh-manager.test.ts:507` | // U-API: 直接断言字段验证 reset 语义（非 gating 逻辑），同 §3.7 #39 模式 |
| 206 | `packages/shared/src/sources/__tests__/token-refresh-manager.test.ts:540` | // U-API: 直接断言字段验证 reset 语义（非 gating 逻辑），同 §3.7 #39 模式 |
| 207 | `packages/shared/src/sources/api-tools.ts:17` | // U-API: shared API requests retain address and redirect protection. |
| 208 | `packages/shared/src/sources/api-tools.ts:219` | // U-API: validate the final URL for both chat tools and Pages before sending credentials. |
| 209 | `packages/shared/src/sources/credential-manager.ts:991` | // U-API: M3 SSRF 防护 — 阻止 credential-bearing fetch 到云元数据/私网（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md） |
| 210 | `packages/shared/src/sources/credential-manager.ts:1016` | // U-API: M3 SSRF 防护 — redirect bypass 修补（v24 F1.F3 P0；与 api-tools.ts 同模式） |
| 211 | `packages/shared/src/sources/credential-manager.ts:1026` | // U-API: M3 SSRF 防护 — 主动拒绝 30x redirect（v24 F1.F3 P0；与 api-tools.ts 同模式） |
| 212 | `packages/shared/src/sources/token-refresh-manager.ts:170` | // U-API: 这是写状态（非 gating 读）；no-inline-source-auth-check 只该禁读检查，in-memory mirror 写合法 |
| 213 | `packages/shared/src/sources/token-refresh-manager.ts:182` | // U-API: 同上，写 in-memory mirror（非 gating 读）；规则只该禁读检查 |
| 214 | `packages/shared/src/utils/url-safety.ts:75` | /* U-API START: M3 SSRF 防护 — assertPublicHttpsUrl helper（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md） |
| 215 | `packages/shared/src/utils/url-safety.ts:134` | /* U-API END */ |
| 216 | `packages/shared/src/workspaces/storage.ts:38` | // U-API: isolated config roots must not auto-copy workspaces from the production profile. |
| 217 | `packages/ui/src/components/annotations/block-markers.ts:30` | // U-API: dynamic color-mix annotation; cannot be expressed as a static utility class |
| 218 | `packages/ui/src/components/chat/TurnCard.tsx:1851` | {/* U-API: completed generated images are first-class turn output, not hidden in tool details. */} |
| 219 | `packages/ui/src/components/markdown/MarkdownImageBlock.tsx:40` | // U-API: generated images reuse the established data-URL preview while hiding host path actions (16 §8.3). |
| 220 | `packages/ui/src/components/overlay/ImagePreviewOverlay.tsx:16` | // U-API: paid generated files may be previewed but their server paths are not user actions (16 §8.3). |
| 221 | `packages/ui/src/components/overlay/PreviewOverlay.tsx:27` | // U-API: allow callers to suppress Open/Reveal affordances for host-private generated files (16 §8.3). |
| 222 | `packages/ui/src/lib/__tests__/uapi-image-activity.test.ts:1` | // U-API: UI只从strict envelope + session root重建生成图路径（16 §8.3）。 |
| 223 | `packages/ui/src/lib/tool-parsers.ts:12` | // U-API: UI复用core strict parser，绝不信任ToolResult内的任意路径（16 §8.3）。 |
