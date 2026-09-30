# v0.14.0 升级文件清单与交叉证据

> 2026-10-01；本表由固定 SHA 的上游 tar 快照在内存中比较生成，只写 Markdown。未解压源码、未 fetch、未合并。主方案见 [升级落地方案](UPGRADE-PLAN-v0.14.0-20261001.md)。

- 上游基线：`4289b16097322e9911d3078d8a64bd8c830717c3`。
- 上游目标：`73bd9c2a3573158bea880984eb8d5fdb41e0cac2`。
- 本地基线：`c6cf072d5bd03fa645430d901ff5bd112b708c2f`。
- 内容变化文件：561；与本地已提交差异交叉：201；带 U-API 注释交叉文件：apps/packages 内 45 个，另有根 scripts 下 `electron-build-main.ts` 1 个，共 46 个。前者对应 §14 主基线统计范围。
- “同段交叉”是 difflib 按共同基线识别的相交或边界相接编辑区间（基线行号），只用于排序，共 102 个文件命中。它不是 git merge 的冲突预测，不包含运行时语义冲突。文件重命名按新增/删除表示；不统计文件模式。

## 1. 模块规模

| 模块 | 变化文件 | 与我方交叉 |
|---|---:|---:|
| `.dockerignore` | 1 | 0 |
| `.env.example` | 1 | 1 |
| `.gitignore` | 1 | 1 |
| `Dockerfile.server` | 1 | 1 |
| `README.md` | 1 | 1 |
| `apps/cli` | 3 | 2 |
| `apps/electron` | 123 | 54 |
| `apps/viewer` | 3 | 3 |
| `apps/webui` | 6 | 3 |
| `bun.lock` | 1 | 1 |
| `i18n` | 7 | 7 |
| `package.json` | 1 | 1 |
| `packages/core` | 7 | 5 |
| `packages/messaging-gateway` | 3 | 2 |
| `packages/messaging-whatsapp-worker` | 4 | 2 |
| `packages/pi-agent-server` | 32 | 3 |
| `packages/server` | 2 | 2 |
| `packages/server-core` | 78 | 21 |
| `packages/session-mcp-server` | 2 | 2 |
| `packages/session-tools-core` | 24 | 9 |
| `packages/shared` | 229 | 67 |
| `packages/ui` | 6 | 4 |
| `release-notes` | 16 | 1 |
| `scripts` | 8 | 7 |
| `tsconfig.base.json` | 1 | 1 |

## 2. i18n 数据对照

以扁平化叶子 key 计算；新增/删除/改值均相对上游 v0.11.1，本地独有 key 相对 v0.14.0。这里只检查数据集合，不代替运行 coverage/sorted 或人工译文审校。

| Locale | 基线 key | 本地 key | 目标 key | 上游新增 | 上游删除 | 上游改值 | 本地独有 |
|---|---:|---:|---:|---:|---:|---:|---:|
| en | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| zh-Hans | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| de | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| es | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| hu | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| ja | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |
| pl | 1639 | 1686 | 1866 | 227 | 0 | 5 | 50 |

中文新增 key 前缀分布：`automations` 1；`chat` 22；`mode` 4；`pages` 82；`rtkUpdate` 11；`settings` 85；`sidebar` 2；`skillInfo` 1；`table` 1；`tasks` 1；`toast` 17。

本地独有 key（7 种语言合并时须保留并逐一核查）：

```text
about.basedOn
about.basedOnDesc
about.viewLicenses
about.viewSource
menu.aboutUAgents
menu.hideUAgents
menu.quitUAgents
settings.about.manualDownload
turnCard.imageGeneration.activity
turnCard.imageGeneration.chargePossibly
turnCard.imageGeneration.complete
turnCard.imageGeneration.error.connectionUnavailable
turnCard.imageGeneration.error.contentRejected
turnCard.imageGeneration.error.inputInvalid
turnCard.imageGeneration.error.notExecutable
turnCard.imageGeneration.error.quotaExceeded
turnCard.imageGeneration.error.requestUncertain
turnCard.imageGeneration.error.resultInvalid
turnCard.imageGeneration.error.serviceUnconfigured
turnCard.imageGeneration.failed
turnCard.imageGeneration.title
turnCard.imageGeneration.warning.aspectRatioChanged
turnCard.imageGeneration.warning.qualityDowngraded
turnCard.imageGeneration.warning.qualityUnverified
uapi.addModel
uapi.checkStatus
uapi.connectionDescription
uapi.connectionName
uapi.error.insufficientBalance
uapi.error.modelUnavailable
uapi.error.networkTimeout
uapi.error.tokenInvalid
uapi.error.unreachable
uapi.linkGetToken
uapi.linkPricing
uapi.modelDisplayNameLabel
uapi.modelDisplayNamePlaceholder
uapi.modelIdLabel
uapi.modelIdPlaceholder
uapi.noModelsCta
uapi.noModelsTitle
uapi.openConsole
uapi.openPricing
uapi.openTopup
uapi.protocolAnthropic
uapi.protocolLabel
uapi.protocolOpenAi
uapi.tokenHelpText
uapi.tokenLabel
uapi.tokenPlaceholder
```

## 3. 全量文件级清单

“双方改动”对比的是上游基线→目标与上游基线→本地 HEAD，不含未跟踪文件。标记列为当前本地文件的注释标记行数。

| 路径 | 上游状态 | 双方改动 | 本地标记 | 同段交叉：基线行号 |
|---|---|---|---:|---|
| `.dockerignore` | 修改 | 否 | 0 | — |
| `.env.example` | 修改 | 是 | 0 | — |
| `.gitignore` | 修改 | 是 | 0 | — |
| `Dockerfile.server` | 修改 | 是 | 0 | — |
| `README.md` | 修改 | 是 | 0 | 36–36, 53–53, 71–71, 76–76, 432–435, 553–553 |
| `apps/cli/package.json` | 修改 | 是 | 0 | 3–3 |
| `apps/cli/src/index.ts` | 修改 | 是 | 3 | 1945–1945 |
| `apps/cli/src/retry-stream.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/README.md` | 修改 | 是 | 0 | — |
| `apps/electron/electron-builder.yml` | 修改 | 是 | 0 | 79–79 |
| `apps/electron/package.json` | 修改 | 是 | 0 | 3–3, 11–11 |
| `apps/electron/resources/AGENTS.md` | 修改 | 是 | 0 | — |
| `apps/electron/resources/bridge-mcp-server/index.js` | 删除 | 是 | 0 | — |
| `apps/electron/resources/docs/automations.md` | 修改 | 是 | 0 | — |
| `apps/electron/resources/docs/craft-cli.md` | 修改 | 是 | 0 | — |
| `apps/electron/resources/docs/decisions.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/docs/labels.md` | 修改 | 是 | 0 | — |
| `apps/electron/resources/docs/pages.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/docs/permissions.md` | 修改 | 是 | 0 | — |
| `apps/electron/resources/docs/sources.md` | 修改 | 是 | 0 | 13–13, 15–19, 211–212 |
| `apps/electron/resources/release-notes/0.11.2.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.11.3.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.11.4.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.12.0.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.12.1.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.0.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.1.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.2.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.3.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.4.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.5.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.13.6.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/0.14.0.md` | 新增 | 否 | 0 | — |
| `apps/electron/resources/release-notes/next.md` | 修改 | 否 | 0 | — |
| `apps/electron/src/main/__tests__/browser-pane-manager.test.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/main/__tests__/page-thumbnail-host.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/main/auto-update.ts` | 修改 | 是 | 0 | 5–5 |
| `apps/electron/src/main/browser-pane-manager.ts` | 修改 | 是 | 2 | — |
| `apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts` | 修改 | 是 | 0 | 116–116, 128–128 |
| `apps/electron/src/main/handlers/__tests__/registration.test.ts` | 修改 | 是 | 0 | 129–129 |
| `apps/electron/src/main/handlers/workspace.ts` | 修改 | 是 | 1 | 28–28 |
| `apps/electron/src/main/index.ts` | 修改 | 是 | 2 | 72–72, 88–88, 119–119, 669–669 |
| `apps/electron/src/main/logger.ts` | 修改 | 是 | 2 | 84–84, 213–213 |
| `apps/electron/src/main/menu.ts` | 修改 | 是 | 0 | 237–237 |
| `apps/electron/src/main/page-thumbnail-host.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/main/page-thumbnailer.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/main/window-state.ts` | 修改 | 是 | 2 | 5–5, 32–32 |
| `apps/electron/src/preload/bootstrap.ts` | 修改 | 是 | 2 | — |
| `apps/electron/src/renderer/App.tsx` | 修改 | 是 | 2 | — |
| `apps/electron/src/renderer/atoms/background-finished.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/atoms/pages.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/atoms/permission-modes.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/atoms/sessions.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/RtkUpdateDialog.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 修改 | 是 | 4 | 145–148, 806–806 |
| `apps/electron/src/renderer/components/app-shell/ActiveOptionBadges.tsx` | 修改 | 是 | 0 | 7–7 |
| `apps/electron/src/renderer/components/app-shell/ActiveTasksBar.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/AppShell.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/BatchSessionMenu.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/CompactSessionMenu.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/ProjectMultiSelectFilter.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/SendToWorkspaceDialog.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/SessionItem.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/SessionMenu.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/TaskActionMenu.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/TopBar.tsx` | 修改 | 是 | 0 | 287–287 |
| `apps/electron/src/renderer/components/app-shell/__tests__/background-task-chip-state.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/__tests__/transfer-targets.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/background-task-chip-state.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/inherited-filter-params.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/inherited-filter-params.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/CompactModelSelector.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/CompactPermissionModeSelector.tsx` | 修改 | 是 | 0 | 18–18 |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` | 修改 | 是 | 0 | 37–37, 73–73, 693–693, 695–697, 723–752, 754–754, 757–824 |
| `apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/context-display.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/input-event-guards.test.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/pending-plan-dispatch.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/composer-height.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/context-display.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/input-event-guards.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/pending-plan-dispatch.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/kanban/KanbanProjectFilter.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/kanban/TaskEditor.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/kanban/task-spec-form.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/app-shell/transfer-targets.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/automations/AutomationEventTimeline.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/automations/types.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/components/info/AutoRulesDataTable.tsx` | 修改 | 是 | 0 | 27–27 |
| `apps/electron/src/renderer/components/pages/DeletePageDialog.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageFrame.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageGrantRequestDialog.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageGrantsDialog.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageSourceAuthBanner.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageTile.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PageView.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/PagesHome.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/SharePageDialog.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/grant-visuals.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/pages/page-visuals.tsx` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/components/settings/SettingsToggle.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 修改 | 是 | 1 | 369–369 |
| `apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/ui/rich-text-input.tsx` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/components/ui/slash-command-menu.tsx` | 修改 | 是 | 0 | 7–7 |
| `apps/electron/src/renderer/contexts/NavigationContext.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/event-processor/handlers/__tests__/handle-user-message.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/handlers/__tests__/retry-lifecycle.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/handlers/__tests__/session-context-usage.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/handlers/session.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/handlers/text.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/helpers.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/processor.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/event-processor/types.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/hooks/useAutomations.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/hooks/useAvailablePermissionModes.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/hooks/useInView.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/hooks/useInputAvailableHeight.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/hooks/useOnboarding.ts` | 修改 | 是 | 5 | — |
| `apps/electron/src/renderer/hooks/usePages.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/hooks/useSessionOptions.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/lib/__tests__/input-viewport.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/lib/__tests__/scroll-focused-caret.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/lib/input-viewport.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/lib/nav-helpers.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/renderer/lib/provider-icons.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/lib/scroll-focused-caret.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/renderer/main.tsx` | 修改 | 是 | 1 | 12–12 |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 修改 | 是 | 0 | 580–580, 594–594 |
| `apps/electron/src/renderer/pages/SkillInfoPage.tsx` | 修改 | 是 | 0 | — |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | 修改 | 是 | 14 | 26–26 |
| `apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx` | 修改 | 是 | 0 | 29–29 |
| `apps/electron/src/renderer/playground/mock-utils.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/shared/__tests__/ipc-channels.test.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/shared/__tests__/page-bridge.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/shared/__tests__/route-parser-pages.test.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/shared/menu-schema.ts` | 修改 | 是 | 0 | 302–302 |
| `apps/electron/src/shared/page-bridge.ts` | 新增 | 否 | 0 | — |
| `apps/electron/src/shared/route-parser.ts` | 修改 | 否 | 0 | — |
| `apps/electron/src/shared/routes.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/shared/types.ts` | 修改 | 是 | 0 | — |
| `apps/electron/src/transport/channel-map.ts` | 修改 | 否 | 0 | — |
| `apps/viewer/package.json` | 修改 | 是 | 0 | 3–3 |
| `apps/viewer/src/components/Header.tsx` | 修改 | 是 | 0 | 43–43 |
| `apps/viewer/vite.config.ts` | 修改 | 是 | 0 | 35–35 |
| `apps/webui/package.json` | 修改 | 是 | 0 | 3–3 |
| `apps/webui/src/__tests__/viewport.test.ts` | 新增 | 否 | 0 | — |
| `apps/webui/src/index.css` | 修改 | 否 | 0 | — |
| `apps/webui/src/index.html` | 修改 | 是 | 0 | 5–5 |
| `apps/webui/src/main.tsx` | 修改 | 是 | 0 | — |
| `apps/webui/src/viewport.ts` | 新增 | 否 | 0 | — |
| `bun.lock` | 修改 | 是 | 0 | 12–13, 119–119, 135–135, 183–205, 208–208, 236–236, 251–251, 258–280, 285–285, 301–301, 312–312, 332–332 |
| `package.json` | 修改 | 是 | 0 | 146–147 |
| `packages/core/CLAUDE.md` | 修改 | 是 | 0 | — |
| `packages/core/README.md` | 修改 | 是 | 0 | — |
| `packages/core/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/core/src/types/context-usage.ts` | 新增 | 否 | 0 | — |
| `packages/core/src/types/index.ts` | 修改 | 是 | 1 | 68–68 |
| `packages/core/src/types/message.ts` | 修改 | 是 | 0 | — |
| `packages/core/src/types/page.ts` | 新增 | 否 | 0 | — |
| `packages/messaging-gateway/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/messaging-gateway/src/__tests__/renderer.test.ts` | 修改 | 否 | 0 | — |
| `packages/messaging-gateway/src/renderer.ts` | 修改 | 是 | 0 | — |
| `packages/messaging-whatsapp-worker/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/messaging-whatsapp-worker/src/__tests__/upsert.test.ts` | 修改 | 否 | 0 | — |
| `packages/messaging-whatsapp-worker/src/upsert.ts` | 修改 | 否 | 0 | — |
| `packages/messaging-whatsapp-worker/src/worker.ts` | 修改 | 是 | 0 | — |
| `packages/pi-agent-server/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/pi-agent-server/src/adapt-credential.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/adapt-credential.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/bundle-smoke.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/compaction-wait.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/compaction-wait.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/context-usage.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/context-usage.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/custom-endpoint-models.test.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/custom-endpoint-models.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/ephemeral-query-lifecycle.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/ephemeral-query-lifecycle.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/index.ts` | 修改 | 是 | 1 | 1317–1319 |
| `packages/pi-agent-server/src/large-result-gate.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/large-result-gate.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/mini-model-query.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/mini-model-query.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/model-resolution.test.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/model-resolution.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/session-settings.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/session-settings.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/steering-sdk.test.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/system-prompt-override.test.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/system-prompt-override.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/test-fixtures/block-network.ts` | 新增 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/create-search-tool.test.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/create-search-tool.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/providers/chatgpt.test.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/providers/chatgpt.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/search/resolve-provider.ts` | 修改 | 否 | 0 | — |
| `packages/pi-agent-server/src/tools/web-fetch.ts` | 修改 | 是 | 2 | — |
| `packages/server-core/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/server-core/src/bootstrap/headless-start.ts` | 修改 | 是 | 0 | 3–3 |
| `packages/server-core/src/bootstrap/lock-identity.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/bootstrap/lock-identity.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/adaptive-thinking.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/adaptive-thinking.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/automation-condition.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/automation-condition.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/decision-outcomes.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/decision-point.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/guarded-mode.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/guarded-mode.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/large-results.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/large-results.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/mid-turn-messages.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/mid-turn-messages.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/permission-risks.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/permission-risks.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/semantic-labels.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/semantic-labels.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/smart-titles.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/smart-titles.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/suggestions.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/suggestions.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/task-repairs.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/task-repairs.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/task-verdict.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/task-verdict.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/tool-callbacks.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/tool-callbacks.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/turn-outcome.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/decisions/turn-outcome.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/domain/connection-setup-logic.test.ts` | 修改 | 否 | 0 | — |
| `packages/server-core/src/domain/connection-setup-logic.ts` | 修改 | 是 | 4 | — |
| `packages/server-core/src/handlers/rpc/auth.ts` | 修改 | 是 | 0 | 3–3, 62–62 |
| `packages/server-core/src/handlers/rpc/automations.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/handlers/rpc/decisions.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/handlers/rpc/index.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/handlers/rpc/llm-connections.ts` | 修改 | 是 | 1 | 11–11, 317–318 |
| `packages/server-core/src/handlers/rpc/oauth.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/handlers/rpc/onboarding.ts` | 修改 | 是 | 0 | 8–8 |
| `packages/server-core/src/handlers/rpc/pages.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/handlers/rpc/projects.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/handlers/rpc/sessions.ts` | 修改 | 是 | 0 | 8–8 |
| `packages/server-core/src/handlers/rpc/sources.ts` | 修改 | 是 | 0 | 79–79 |
| `packages/server-core/src/handlers/rpc/tasks.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/handlers/rpc/workspace.ts` | 修改 | 是 | 0 | 3–3, 63–63 |
| `packages/server-core/src/handlers/session-manager-interface.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/pages/__tests__/mcp-executor.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/__tests__/script-executor-bridge.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/mcp-executor.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/script-executor-bridge.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/source-gate.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/tool-callbacks.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/pages/tool-callbacks.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/services/privileged-execution-broker.ts` | 修改 | 是 | 0 | 4–4, 25–25 |
| `packages/server-core/src/sessions/SessionManager.ts` | 修改 | 是 | 1 | 11–11, 24–24, 40–40, 75–75, 93–93, 95–95, 98–98, 100–100, 511–536, 596–596, 615–617, 920–920 |
| `packages/server-core/src/sessions/archive-guards.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/archive-guards.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/attended-session.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/automation-loop-and-retry.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/automation-prompts.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/background-task-surface.test.ts` | 修改 | 否 | 0 | — |
| `packages/server-core/src/sessions/decision-lifecycle.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/midstream-queue.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/pi-retry-streaming.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/source-activated-auto-retry.test.ts` | 修改 | 否 | 0 | — |
| `packages/server-core/src/sessions/title-generation.isolated.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sessions/turn-context.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/sources/build-servers.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/tasks/TaskRunner.test.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/tasks/TaskRunner.ts` | 修改 | 是 | 0 | 41–41 |
| `packages/server-core/src/tasks/create-task.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/tasks/create-task.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/tasks/index.ts` | 修改 | 是 | 0 | — |
| `packages/server-core/src/tasks/verdict-decision.test.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/tasks/verdict-decision.ts` | 新增 | 否 | 0 | — |
| `packages/server-core/src/webui/__tests__/oauth-callback.test.ts` | 修改 | 是 | 0 | 38–38 |
| `packages/server/package.json` | 修改 | 是 | 0 | 3–3, 21–21 |
| `packages/server/src/index.ts` | 修改 | 是 | 0 | 38–38, 214–214 |
| `packages/session-mcp-server/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/session-mcp-server/src/index.ts` | 修改 | 是 | 2 | 26–27, 272–339, 524–527, 529–529, 532–532, 551–555 |
| `packages/session-tools-core/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/session-tools-core/src/api-auth.test.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/api-auth.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/context.ts` | 修改 | 是 | 1 | — |
| `packages/session-tools-core/src/handlers/archive-session.test.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/archive-session.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/config-validate.ts` | 修改 | 是 | 0 | 38–38 |
| `packages/session-tools-core/src/handlers/create-task.test.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/create-task.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/decide.test.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/decide.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/index.ts` | 修改 | 是 | 1 | — |
| `packages/session-tools-core/src/handlers/list-background-tasks.ts` | 修改 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/pages.test.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/pages.ts` | 新增 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/script-sandbox.test.ts` | 修改 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/source-test.test.ts` | 修改 | 否 | 0 | — |
| `packages/session-tools-core/src/handlers/source-test.ts` | 修改 | 是 | 8 | 23–23 |
| `packages/session-tools-core/src/handlers/transform-data.test.ts` | 修改 | 否 | 0 | — |
| `packages/session-tools-core/src/index.ts` | 修改 | 是 | 1 | — |
| `packages/session-tools-core/src/runtime/resolve-script-runtime.ts` | 修改 | 是 | 0 | 67–67 |
| `packages/session-tools-core/src/tool-defs-filtering.test.ts` | 修改 | 是 | 1 | — |
| `packages/session-tools-core/src/tool-defs.ts` | 修改 | 是 | 1 | 44–44, 586–586, 599–599, 712–712, 714–714 |
| `packages/session-tools-core/src/types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/CLAUDE.md` | 修改 | 是 | 0 | 33–33, 35–35, 42–42, 44–44, 45–46 |
| `packages/shared/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/shared/src/__tests__/interceptor-common.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/__tests__/unified-network-interceptor.curl.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/__tests__/unified-network-interceptor.sse.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/base-agent-turn-context.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/base-agent.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/clamp-permission-mode.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-agent-handoff.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-background-message-routing.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-compaction-events.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-event-adapter-tasks.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-event-adapter.test.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-keepalive-stop.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-large-mcp-results.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-live-thinking.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-sdk-error-mapper.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-steering.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-subprocess-env.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/claude-thinking-config.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/context-usage.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/guarded-permission-mode.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/mcp-tool-names.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/mode-manager-allowed-write-paths.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-agent-error-handling.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-agent-guarded-mode.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-compaction.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-context-usage.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-event-adapter.test.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-query-llm.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/pi-retry-sdk-integration.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/__tests__/tool-matching.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/claude/event-adapter.ts` | 修改 | 是 | 0 | 16–16 |
| `packages/shared/src/agent/backend/claude/pending-steers.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/backend/claude/task-notification.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/backend/internal/driver-types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/internal/drivers/anthropic.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/internal/drivers/anthropic.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/internal/drivers/pi.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/internal/runtime-resolver.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/pi/constants.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/backend/pi/event-adapter.ts` | 修改 | 是 | 0 | 12–12, 132–132, 221–221 |
| `packages/shared/src/agent/backend/pi/protocol.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/backend/pi/session-tool-defs.ts` | 修改 | 是 | 1 | 14–14, 23–23 |
| `packages/shared/src/agent/backend/types.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/agent/base-agent.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/bash-validator.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/claude-agent.ts` | 修改 | 是 | 1 | 1083–1088 |
| `packages/shared/src/agent/claude-sdk-error-mapper.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/context-usage.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/guarded-mode.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/permission-manager.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/permission-remember.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/pre-tool-use-checks.isolated.ts` | 修改 | 是 | 0 | 169–169, 304–314, 933–933 |
| `packages/shared/src/agent/core/__tests__/prerequisite-manager.isolated.ts` | 修改 | 是 | 0 | 30–30, 83–88 |
| `packages/shared/src/agent/core/__tests__/prompt-builder.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/rtk-rewrite.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/__tests__/source-manager.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/guarded-mode.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/permission-manager.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/permission-remember.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/core/pre-tool-use.ts` | 修改 | 是 | 0 | 666–666 |
| `packages/shared/src/agent/core/prerequisite-manager.ts` | 修改 | 是 | 0 | 49–49, 52–52 |
| `packages/shared/src/agent/core/prompt-builder.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/rtk-detector.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/rtk-rewrite.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/core/source-manager.ts` | 修改 | 是 | 0 | 21–21 |
| `packages/shared/src/agent/errors.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/index.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/agent/mcp-tool-names.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/mode-manager.ts` | 修改 | 是 | 0 | 2007–2011 |
| `packages/shared/src/agent/mode-types.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/options.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/permissions-config.ts` | 修改 | 是 | 0 | 45–46, 49–50 |
| `packages/shared/src/agent/pi-agent.ts` | 修改 | 是 | 3 | 2038–2039 |
| `packages/shared/src/agent/plan-types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/session-scoped-tool-callback-registry.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/session-scoped-tools.ts` | 修改 | 是 | 1 | 264–264 |
| `packages/shared/src/agent/session-self-management-bindings.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/agent/source-policy.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/agent/spawn-session-tool.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/thinking-levels.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/agent/tool-matching.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/auth/__tests__/github-copilot.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/generic-oauth.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/github-copilot.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/auth/google-oauth.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/oauth-flow-store.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/oauth-flow-types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/oauth-relay.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/auth/oauth.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/auth/slack-oauth.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/automation-system.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/handlers/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/handlers/prompt-handler.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/handlers/prompt-handler.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/handlers/script-handler.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/automations/index.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/automations/name-utils.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/schemas.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/script-executor.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/automations/script-executor.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/automations/semantic-condition.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/automations/types.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/automations/utils.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/validation.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/automations/webhook-utils.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/branding.ts` | 修改 | 是 | 0 | 18–18 |
| `packages/shared/src/config/__tests__/default-thinking-level.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/config/__tests__/llm-connections.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/config/__tests__/paths.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/config/__tests__/storage-startup-migration.test.ts` | 修改 | 是 | 1 | 11–15, 128–128, 203–204, 288–288, 311–311, 312–318, 375–375, 382–382, 404–404, 432–432, 455–457, 460–460 |
| `packages/shared/src/config/index.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/config/llm-connections.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/config/models-pi.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/config/models.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/config/paths.ts` | 修改 | 是 | 1 | 4–7, 12–12, 17–19 |
| `packages/shared/src/config/preferences.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/config/storage.ts` | 修改 | 是 | 14 | 2065–2065 |
| `packages/shared/src/config/validators.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/config/watcher.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/credentials/backends/secure-storage.ts` | 修改 | 是 | 1 | 42–42, 44–45 |
| `packages/shared/src/credentials/manager.ts` | 修改 | 是 | 1 | — |
| `packages/shared/src/credentials/types.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/decisions/client.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/client.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/health.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/health.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/index.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/providers.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/records.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/records.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/resolve.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/settings.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/settings.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/status.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/types.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/usage.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/decisions/usage.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/docs/doc-links.ts` | 修改 | 是 | 0 | 6–6 |
| `packages/shared/src/docs/index.ts` | 修改 | 是 | 0 | 17–17 |
| `packages/shared/src/docs/source-guides.ts` | 修改 | 是 | 0 | 5–5, 7–7, 187–187, 192–194, 197–197, 203–203, 211–211, 217–217, 225–225 |
| `packages/shared/src/feature-flags.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/de.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/en.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/es.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/hu.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/ja.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/pl.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/i18n/locales/zh-Hans.json` | 修改 | 是 | 0 | — |
| `packages/shared/src/interceptor-common.ts` | 修改 | 是 | 1 | 14–14, 30–30, 39–39, 174–174 |
| `packages/shared/src/labels/__tests__/crud.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/auto/evaluator.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/labels/auto/evaluator.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/auto/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/auto/semantic-rules-config.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/labels/auto/types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/auto/validation.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/crud.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/labels/types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/mcp/__tests__/mcp-pool.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/mcp/__tests__/proxy-tool-name.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/mcp/api-source-pool-client.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/mcp/client.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/mcp/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/mcp/mcp-pool.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/mcp/proxy-tool-name.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/action-bridge.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/action-bridge.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/data-store-constants.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/data-store.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/data-store.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/data-write.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/data-write.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/index.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/publisher.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/refresh.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/share-bundle.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/share-bundle.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/storage.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/storage.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/types.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/validation.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/pages/validation.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/projects/storage.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/prompts/__tests__/developer-context.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/prompts/__tests__/system.test.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/prompts/developer-context.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/prompts/print-system-prompt.ts` | 修改 | 是 | 0 | 60–66, 211–217 |
| `packages/shared/src/prompts/prompt-sanitize.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/prompts/system.ts` | 修改 | 是 | 0 | 813–813 |
| `packages/shared/src/protocol/channels.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/protocol/dto.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/protocol/events.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/protocol/routing.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/release-notes/index.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/release-notes/index.ts` | 修改 | 是 | 0 | 16–16 |
| `packages/shared/src/resources/resource-bundle.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/sessions/__tests__/pending-plan-execution.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/sessions/storage.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/sessions/types.ts` | 修改 | 是 | 0 | 14–14 |
| `packages/shared/src/sources/__tests__/api-tools-log-redaction.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/sources/__tests__/header-credential-shape.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/sources/__tests__/slack-oauth-relay.isolated.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/sources/api-tools.ts` | 修改 | 是 | 4 | 14–15, 252–304 |
| `packages/shared/src/sources/builtin-sources.ts` | 删除 | 是 | 0 | — |
| `packages/shared/src/sources/credential-manager.ts` | 修改 | 是 | 3 | 27–27 |
| `packages/shared/src/sources/index.ts` | 修改 | 是 | 0 | 93–99 |
| `packages/shared/src/sources/storage.ts` | 修改 | 是 | 0 | 23–23, 415–416, 422–429, 440–442, 578–578 |
| `packages/shared/src/sources/types.ts` | 修改 | 是 | 0 | 518–523 |
| `packages/shared/src/tasks/index.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/tasks/slug.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/tasks/slug.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/tasks/storage.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/unified-network-interceptor.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/utils/__tests__/large-result-summary-gate.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/__tests__/path-relativize.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/__tests__/redaction.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/debug.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/utils/files.ts` | 修改 | 是 | 0 | — |
| `packages/shared/src/utils/index.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/utils/large-response.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/utils/logo.ts` | 修改 | 是 | 0 | 15–16 |
| `packages/shared/src/utils/redaction.test.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/redaction.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/slug.ts` | 新增 | 否 | 0 | — |
| `packages/shared/src/utils/toolNames.ts` | 修改 | 是 | 0 | 25–27 |
| `packages/shared/src/version/manifest.ts` | 修改 | 是 | 0 | 3–3 |
| `packages/shared/src/views/types.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/views/validation.ts` | 修改 | 否 | 0 | — |
| `packages/shared/src/workspaces/storage.ts` | 修改 | 是 | 0 | 35–35 |
| `packages/shared/src/workspaces/types.ts` | 修改 | 是 | 0 | — |
| `packages/shared/tests/mode-manager.test.ts` | 修改 | 是 | 0 | — |
| `packages/shared/tests/models-pi.test.ts` | 修改 | 否 | 0 | — |
| `packages/shared/tests/models.test.ts` | 修改 | 否 | 0 | — |
| `packages/ui/package.json` | 修改 | 是 | 0 | 3–3 |
| `packages/ui/src/components/chat/TurnCard.tsx` | 修改 | 是 | 2 | 536–536 |
| `packages/ui/src/components/markdown/__tests__/markdown-link-routing.test.ts` | 修改 | 是 | 0 | — |
| `packages/ui/src/components/markdown/link-target.ts` | 修改 | 否 | 0 | — |
| `packages/ui/src/components/markdown/linkify.ts` | 修改 | 否 | 0 | — |
| `packages/ui/src/lib/tool-parsers.ts` | 修改 | 是 | 1 | — |
| `scripts/build-server.ts` | 修改 | 是 | 0 | — |
| `scripts/build/common.ts` | 修改 | 是 | 0 | — |
| `scripts/check-i18n-coverage.ts` | 新增 | 是 | 0 | — |
| `scripts/decisions-report.ts` | 新增 | 否 | 0 | — |
| `scripts/electron-build-main.ts` | 修改 | 是 | 2 | — |
| `scripts/electron-dev.ts` | 修改 | 是 | 0 | — |
| `scripts/install-app.ps1` | 修改 | 是 | 0 | 2–2, 7–7 |
| `scripts/install-app.sh` | 修改 | 是 | 0 | 5–5, 354–354 |
| `tsconfig.base.json` | 新增 | 是 | 0 | — |
