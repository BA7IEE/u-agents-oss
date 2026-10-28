# v0.15.6 升级文件清单

> 核查日期：2026-10-28。修订 r2，已按[第一轮评审](UPGRADE-PLAN-REVIEW-v0.15.6-20261028.md)补充 R1–R3 联动项。配套：[详细升级方案 r2](UPGRADE-PLAN-v0.15.6-20261028.md)。
> 本表是只读差异清单，不代表已经合并、执行或验收。

## §1 统计口径

- B：上游 v0.15.5，`cede6ea49e0c4a42933ed0f1bc129db698fc581f`。
- O：本地主线与实时 origin/main，`475fc0c72bf41454359134d371e3b6b49b914fac`。
- T：上游 v0.15.6，`8df01c5d0ac73c35add5954e6f190ce038d35845`。
- 上游范围 B→T：**93 个路径，16 新增、77 修改、0 删除，+4837 / −602 行**。
- “本地也改”表示该路径也出现在 `git diff --name-only B O` 中；共 **57 个**，包括包名、品牌等机械修改，不等于实际文本冲突。
- “U-API 标记”表示当前 tracked TS/TSX 中按 §14 全格式 grep 命中的文件与上游清单交集；共 **9 个**。全仓当前基线为 **239 / START 9 / END 9**。
- Compare API 返回 93 个文件且每个都有 patch，未达到 300 文件截断上限。无删除路径；不额外推断重命名。
- 本次枚举全部路径，对关键调用链和 patch 做定向源码阅读；没有宣称逐行审计全部 4,837 行新增代码。
- 实际合并冲突数、最终改造点增减、测试与包内行为：**待执行**。

## §2 全部上游文件

文件名链接固定到 T，避免后续 main 变化影响复核。

| # | 文件（目标版本） | 变化 | 本地也改 | U-API 标记 | 行数 |
|---|---|---|---|---|---|
| 1 | [apps/cli/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/cli/package.json) | 修改 | 是 | — | +1 / −1 |
| 2 | [apps/electron/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/package.json) | 修改 | 是 | — | +1 / −1 |
| 3 | [apps/electron/resources/docs/sources.md](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/resources/docs/sources.md) | 修改 | 是 | — | +2 / −0 |
| 4 | [apps/electron/resources/release-notes/0.15.6.md](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/resources/release-notes/0.15.6.md) | 新增 | 否 | — | +17 / −0 |
| 5 | [apps/electron/resources/release-notes/next.md](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/resources/release-notes/next.md) | 修改 | 否 | — | +2 / −0 |
| 6 | [apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx) | 修改 | 是 | 是 | +39 / −3 |
| 7 | [apps/electron/src/renderer/components/app-shell/chat-header/__tests__/pr-watch-state.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/__tests__/pr-watch-state.test.ts) | 修改 | 否 | — | +18 / −0 |
| 8 | [apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/ChatHeaderPrChip.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/ChatHeaderPrChip.tsx) | 修改 | 否 | — | +118 / −65 |
| 9 | [apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrDetailsCard.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrDetailsCard.tsx) | 修改 | 是 | — | +229 / −8 |
| 10 | [apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrTabStrip.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrTabStrip.tsx) | 新增 | 否 | — | +147 / −0 |
| 11 | [apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/pr-watch-state.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/pr-watch-state.ts) | 修改 | 是 | — | +36 / −114 |
| 12 | [apps/electron/src/renderer/hooks/__tests__/useHoverPopover.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/hooks/__tests__/useHoverPopover.test.ts) | 修改 | 否 | — | +22 / −0 |
| 13 | [apps/electron/src/renderer/hooks/useHoverPopover.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/hooks/useHoverPopover.ts) | 修改 | 否 | — | +13 / −0 |
| 14 | [apps/electron/src/renderer/hooks/usePrWatch.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/hooks/usePrWatch.ts) | 修改 | 是 | — | +126 / −30 |
| 15 | [apps/electron/src/renderer/pages/ChatPage.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/pages/ChatPage.tsx) | 修改 | 是 | — | +6 / −0 |
| 16 | [apps/electron/src/renderer/playground/registry/chat-header.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/playground/registry/chat-header.tsx) | 修改 | 是 | — | +11 / −0 |
| 17 | [apps/electron/src/renderer/playground/registry/chat-panel.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/playground/registry/chat-panel.tsx) | 修改 | 是 | — | +6 / −0 |
| 18 | [apps/electron/src/renderer/playground/registry/samples/pr-watch.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/renderer/playground/registry/samples/pr-watch.ts) | 修改 | 是 | — | +164 / −11 |
| 19 | [apps/electron/src/shared/__tests__/ipc-channels.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/shared/__tests__/ipc-channels.test.ts) | 修改 | 否 | — | +4 / −0 |
| 20 | [apps/electron/src/shared/types.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/shared/types.ts) | 修改 | 是 | — | +12 / −3 |
| 21 | [apps/electron/src/transport/channel-map.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/electron/src/transport/channel-map.ts) | 修改 | 否 | — | +4 / −0 |
| 22 | [apps/viewer/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/viewer/package.json) | 修改 | 是 | — | +1 / −1 |
| 23 | [apps/webui/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/apps/webui/package.json) | 修改 | 是 | — | +1 / −1 |
| 24 | [bun.lock](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/bun.lock) | 修改 | 是 | — | +15 / −17 |
| 25 | [package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/package.json) | 修改 | 是 | — | +1 / −1 |
| 26 | [packages/core/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/core/package.json) | 修改 | 是 | — | +1 / −1 |
| 27 | [packages/messaging-gateway/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/messaging-gateway/package.json) | 修改 | 是 | — | +1 / −1 |
| 28 | [packages/messaging-whatsapp-worker/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/messaging-whatsapp-worker/package.json) | 修改 | 是 | — | +1 / −1 |
| 29 | [packages/pi-agent-server/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/pi-agent-server/package.json) | 修改 | 是 | — | +1 / −1 |
| 30 | [packages/server-core/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/package.json) | 修改 | 是 | — | +1 / −1 |
| 31 | [packages/server-core/src/handlers/rpc/coding-repos.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/handlers/rpc/coding-repos.ts) | 修改 | 是 | — | +7 / −3 |
| 32 | [packages/server-core/src/handlers/rpc/pr-watch.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/handlers/rpc/pr-watch.ts) | 修改 | 是 | — | +82 / −11 |
| 33 | [packages/server-core/src/handlers/session-manager-interface.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/handlers/session-manager-interface.ts) | 修改 | 是 | — | +18 / −0 |
| 34 | [packages/server-core/src/pr-watch/auto-fix.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/pr-watch/auto-fix.test.ts) | 新增 | 否 | — | +200 / −0 |
| 35 | [packages/server-core/src/pr-watch/auto-fix.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/pr-watch/auto-fix.ts) | 新增 | 否 | — | +188 / −0 |
| 36 | [packages/server-core/src/pr-watch/operations.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/pr-watch/operations.test.ts) | 新增 | 否 | — | +181 / −0 |
| 37 | [packages/server-core/src/pr-watch/operations.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/pr-watch/operations.ts) | 新增 | 否 | — | +237 / −0 |
| 38 | [packages/server-core/src/pr-watch/tool-callbacks.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/pr-watch/tool-callbacks.ts) | 新增 | 否 | — | +53 / −0 |
| 39 | [packages/server-core/src/services/coding-repos/coding-repos.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/coding-repos/coding-repos.test.ts) | 修改 | 否 | — | +75 / −3 |
| 40 | [packages/server-core/src/services/coding-repos/discover.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/coding-repos/discover.ts) | 修改 | 是 | — | +134 / −40 |
| 41 | [packages/server-core/src/services/pr-watch/github-client.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/github-client.test.ts) | 修改 | 否 | — | +14 / −1 |
| 42 | [packages/server-core/src/services/pr-watch/github-client.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/github-client.ts) | 修改 | 否 | — | +19 / −1 |
| 43 | [packages/server-core/src/services/pr-watch/github-queries.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/github-queries.ts) | 修改 | 否 | — | +103 / −6 |
| 44 | [packages/server-core/src/services/pr-watch/map-github.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/map-github.test.ts) | 修改 | 否 | — | +90 / −2 |
| 45 | [packages/server-core/src/services/pr-watch/map-github.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/map-github.ts) | 修改 | 是 | — | +96 / −1 |
| 46 | [packages/server-core/src/services/pr-watch/pr-ref.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/pr-ref.test.ts) | 新增 | 否 | — | +35 / −0 |
| 47 | [packages/server-core/src/services/pr-watch/pr-ref.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/pr-ref.ts) | 新增 | 否 | — | +42 / −0 |
| 48 | [packages/server-core/src/services/pr-watch/registry.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/registry.test.ts) | 修改 | 是 | — | +213 / −25 |
| 49 | [packages/server-core/src/services/pr-watch/registry.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/services/pr-watch/registry.ts) | 修改 | 是 | — | +498 / −117 |
| 50 | [packages/server-core/src/sessions/SessionManager.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/sessions/SessionManager.ts) | 修改 | 是 | 是 | +179 / −8 |
| 51 | [packages/server-core/src/sessions/handoff-summary.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server-core/src/sessions/handoff-summary.test.ts) | 新增 | 否 | — | +110 / −0 |
| 52 | [packages/server/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/server/package.json) | 修改 | 是 | — | +1 / −1 |
| 53 | [packages/session-tools-core/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/package.json) | 修改 | 是 | — | +1 / −1 |
| 54 | [packages/session-tools-core/src/context.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/context.ts) | 修改 | 是 | 是 | +107 / −0 |
| 55 | [packages/session-tools-core/src/handlers/pr-tools.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/handlers/pr-tools.test.ts) | 新增 | 否 | — | +85 / −0 |
| 56 | [packages/session-tools-core/src/handlers/pr-tools.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/handlers/pr-tools.ts) | 新增 | 否 | — | +100 / −0 |
| 57 | [packages/session-tools-core/src/index.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/index.ts) | 修改 | 是 | 是 | +9 / −0 |
| 58 | [packages/session-tools-core/src/tool-defs-filtering.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/tool-defs-filtering.test.ts) | 修改 | 是 | 是 | +11 / −4 |
| 59 | [packages/session-tools-core/src/tool-defs.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/tool-defs.ts) | 修改 | 是 | 是 | +62 / −2 |
| 60 | [packages/shared/CLAUDE.md](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/CLAUDE.md) | 修改 | 是 | — | +5 / −4 |
| 61 | [packages/shared/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/package.json) | 修改 | 是 | — | +2 / −1 |
| 62 | [packages/shared/src/agent/__tests__/conversation-summary.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/__tests__/conversation-summary.test.ts) | 修改 | 否 | — | +1 / −1 |
| 63 | [packages/shared/src/agent/__tests__/pin-created-pr.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/__tests__/pin-created-pr.test.ts) | 新增 | 否 | — | +82 / −0 |
| 64 | [packages/shared/src/agent/backend/__tests__/factory.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/backend/__tests__/factory.test.ts) | 修改 | 否 | — | +24 / −0 |
| 65 | [packages/shared/src/agent/base-agent.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/base-agent.ts) | 修改 | 是 | — | +34 / −0 |
| 66 | [packages/shared/src/agent/claude-agent.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/claude-agent.ts) | 修改 | 是 | 是 | +38 / −92 |
| 67 | [packages/shared/src/agent/conversation-summary.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/conversation-summary.ts) | 修改 | 否 | — | +3 / −1 |
| 68 | [packages/shared/src/agent/pi-agent.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/pi-agent.ts) | 修改 | 是 | 是 | +7 / −0 |
| 69 | [packages/shared/src/agent/session-scoped-tool-callback-registry.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/session-scoped-tool-callback-registry.ts) | 修改 | 是 | — | +5 / −0 |
| 70 | [packages/shared/src/agent/session-self-management-bindings.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/session-self-management-bindings.ts) | 修改 | 是 | — | +8 / −0 |
| 71 | [packages/shared/src/config/validators.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/config/validators.ts) | 修改 | 是 | — | +1 / −0 |
| 72 | [packages/shared/src/i18n/locales/de.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/de.json) | 修改 | 是 | — | +23 / −1 |
| 73 | [packages/shared/src/i18n/locales/en.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/en.json) | 修改 | 是 | — | +23 / −1 |
| 74 | [packages/shared/src/i18n/locales/es.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/es.json) | 修改 | 是 | — | +23 / −1 |
| 75 | [packages/shared/src/i18n/locales/hu.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/hu.json) | 修改 | 是 | — | +23 / −1 |
| 76 | [packages/shared/src/i18n/locales/ja.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/ja.json) | 修改 | 是 | — | +23 / −1 |
| 77 | [packages/shared/src/i18n/locales/pl.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/pl.json) | 修改 | 是 | — | +23 / −1 |
| 78 | [packages/shared/src/i18n/locales/zh-Hans.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/i18n/locales/zh-Hans.json) | 修改 | 是 | — | +23 / −1 |
| 79 | [packages/shared/src/pr-watch/index.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/pr-watch/index.ts) | 新增 | 否 | — | +5 / −0 |
| 80 | [packages/shared/src/pr-watch/rules.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/pr-watch/rules.test.ts) | 新增 | 否 | — | +120 / −0 |
| 81 | [packages/shared/src/pr-watch/rules.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/pr-watch/rules.ts) | 新增 | 否 | — | +224 / −0 |
| 82 | [packages/shared/src/protocol/channels.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/channels.ts) | 修改 | 否 | — | +10 / −1 |
| 83 | [packages/shared/src/protocol/dto.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/dto.ts) | 修改 | 是 | — | +5 / −0 |
| 84 | [packages/shared/src/protocol/events.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/events.ts) | 修改 | 否 | — | +2 / −2 |
| 85 | [packages/shared/src/protocol/git-repos.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/git-repos.ts) | 修改 | 否 | — | +1 / −1 |
| 86 | [packages/shared/src/protocol/pr-watch.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/pr-watch.ts) | 修改 | 否 | — | +91 / −0 |
| 87 | [packages/shared/src/protocol/routing.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/protocol/routing.ts) | 修改 | 否 | — | +4 / −0 |
| 88 | [packages/shared/src/sessions/types.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/sessions/types.ts) | 修改 | 是 | — | +17 / −0 |
| 89 | [packages/shared/src/sources/__tests__/oauth-relay.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/sources/__tests__/oauth-relay.test.ts) | 修改 | 是 | — | +13 / −0 |
| 90 | [packages/shared/src/sources/credential-manager.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/sources/credential-manager.ts) | 修改 | 是 | 是 | +5 / −2 |
| 91 | [packages/shared/src/sources/types.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/sources/types.ts) | 修改 | 是 | — | +6 / −0 |
| 92 | [packages/ui/package.json](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/ui/package.json) | 修改 | 是 | — | +1 / −1 |
| 93 | [packages/ui/src/styles/base.css](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/ui/src/styles/base.css) | 修改 | 是 | — | +11 / −2 |

## §3 不在上游差异里、执行时仍需处理的文件

| 文件或范围 | 原因 |
|---|---|
| `.github/workflows/macos-candidate.yml`、`windows-candidate.yml` | 候选分支、artifact、BUILD 仍硬编码 0.15.5；需与本轮实际版本一致 |
| `.github/workflows/validate.yml` | 在任何 Bun/preload 前补齐与候选一致的测试配置隔离 |
| `.github/scripts/verify-packaged-runtime.ts` | 复用现有包内检查，核实覆盖新包；没有新需求就不改实现 |
| `packages/shared/src/agent/session-scoped-tools.ts` | 工具缓存捕获 owner、workspace、role、profile；合并新 PR 工具后必须验证 |
| `packages/shared/src/agent/backend/pi/session-tool-defs.ts` | 复用统一过滤，实际 Pi 工具注册链必须验证 |
| `packages/shared/src/agent/backend/types.ts`、`packages/pi-agent-server/src/index.ts` | R4 host 实时项目 getter 与 session/sources 作用域替换；兼容旧 merge，空集合可移除 |
| `packages/shared/src/agent/mode-manager.ts`、`__tests__/session-tool-safe-mode-permissions.test.ts` | R2 必须适配：权限按 canonical 元数据分类，不套用 default 展示过滤；同时验证 Claude/Pi 前置权限入口 |
| `packages/shared/src/agent/backend/pi/event-adapter.ts`、`backend/base-event-adapter.ts` | R3 事件形状复核：结果没有 input；实际修复优先在已列入上游差异的 PiAgent 内关联 start/end，不要求同时修改两个 adapter |
| PiAgent 对应集成测试 | R1 真实路由/执行 gate 与 R3 实际 start/end 事件链；必要时新增测试文件，实施记录列明实际路径 |
| `packages/shared/src/config/u-agents-feature-policy.ts` | 分享、Decision、Pages 等产品关闭项必须继续成立 |
| `packages/shared/src/config/storage.ts`、`packages/server-core/src/domain/u-api-model-discovery.ts`、`packages/server-core/src/handlers/rpc/llm-connections.ts` | 固定入口、模型发现、编辑/刷新、maxTokens 等 U-API 合同作为回归检查点 |
| `packages/pi-agent-server/src/session-settings.ts` | 保留 main/ephemeral 的重试等待上限与 cacheWarming=off |
| `apps/electron/electron-builder.yml`、`apps/electron/scripts/build-dmg.sh`、`build-win.ps1`、`scripts/build/common.ts` | 当前平台、品牌、包内资源与更新元数据检查；无需求不修改 |
| `.planning/14-uapi-marker-registry.md` | 实施结束后才刷新基线，不能提前登记未落地计数 |

“仍需处理”包括只读检查和回归验证，不表示表中每个文件都必须修改。r2 的联动项不改变 §1 的上游 93 文件、57 交叉路径和 9 个标记文件统计；候选最终修改范围在实施后单独登记。

## §4 静态已发现、必须跟踪的项目

| 编号 | 证据 | 实施/验收要求 |
|---|---|---|
| A1 | 新 `auto-fix.ts:evaluate` 在 await 前取 session/monitors，返回后唤醒；新 `wakeIdleSessionWithNotice` 仅检查存在/忙碌 | 按方案 §4.3 补最终状态与旧异步结果失效检查，运行关闭/归档/Explore/目录变化等时序用例 |
| R1 | Pi 注册传 profile，`executeSessionTool` 生成执行 registry 时漏传；新版 default 会过滤四个 PR 工具 | 按方案 §4.2.1 统一有效条件，保留执行 gate；G4 经真实路由到 mock GitHub，检查普通/mini/失效注册拒绝 |
| R2 | `shouldAllowToolInMode` 使用受 default 展示过滤影响的 safe allowed helper，pr_status 会被误拒绝 | 按方案 §4.4.1 改为 canonical 元数据分类；G4 验证 Coding/Explore 查询放行、三个写操作拒绝及旧只读/关闭政策回归 |
| R3 | Pi tool_result 没有 input，新 hook 读取 command 得到 undefined；上游 Pi 单测绕过事件层 | 按方案 §4.2.2 在 PiAgent 内存中按 toolUseId/生命周期关联 start/end；G5 验证真实事件链、交错调用、失败/重复/中止及旧结果不误绑 |
| R4 | 活跃 agent 持有旧项目快照，session 工具只启动时注册，子进程 register_tools 仅合并 | 按方案 §4.2.3 注入实时 getter、prompt 前同步及按 scope 替换；G4 验证存活会话增减项目/来源及空集合清理 |
| L1 | en/zh-Hans 都新增 22 key、改 1 值；zh 的新增值中 14 项和英文完全一致 | 中文化完整句子、动作与标签，保留变量；方法名按中文产品语境处理 |
| B1 | shared 新 `./pr-watch` export；16 个新文件有新的跨包引用 | 接入 `@u-agents` scope并保留本地导出，做实际构建 |
| C1 | 两平台候选 workflow 的分支、artifact 和 BUILD 版本仍为 0.15.5 | 改成目标候选并确保同 SHA；不带入旧真实生图状态 |
| D1 | §14 表头还写未合主线，当前 main 已含对应基线 | 执行记录以实际 SHA/计数为准；收口时更新权威基线，不抹去历史阶段 |
| V1 | root package scripts 引用不存在的 scripts/check-version.ts、scripts/release.ts | 本轮不使用这些入口；按真实包清单核版本，避免额外修复范围 |

## §5 复核来源

- [固定版本完整差异](https://github.com/craft-ai-agents/craft-agents-oss/compare/cede6ea49e0c4a42933ed0f1bc129db698fc581f...8df01c5d0ac73c35add5954e6f190ce038d35845)
- [v0.15.6 发布说明](https://github.com/craft-ai-agents/craft-agents-oss/releases/tag/v0.15.6)
- [目标 tag API](https://api.github.com/repos/craft-ai-agents/craft-agents-oss/git/ref/tags/v0.15.6)
- [本地主线对应提交](https://github.com/BA7IEE/u-agents-oss/commit/475fc0c72bf41454359134d371e3b6b49b914fac)
- [改造点登记与命令](14-uapi-marker-registry.md)、[前版 GUI 修订](UPGRADE-GUI-FIX-v0.15.5-20261023.md)、[前版双平台包](UPGRADE-GITHUB-BUILD-v0.15.5-20261023.md)、[前版真实 U-API](UPGRADE-REAL-UAPI-v0.15.5-20261023.md)


## §6 执行落点

全部 93 路径的实际处置和额外文件见[执行记录](UPGRADE-EXECUTION-v0.15.6-20261028.md)。本表保留规划时点的 B→T 差异口径，不将 fork 适配误算为上游变化。
