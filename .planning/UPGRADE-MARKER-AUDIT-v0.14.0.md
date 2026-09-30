# v0.14.0 改造点变化核对

当前候选为 216 处，START/END 为 10/10，尚未发布。统计 apps/packages TS/TSX 注释；排除 dist/release/node_modules。

| 文件 | 原计数 | 当前计数 |
|---|---:|---:|
| `apps/electron/src/renderer/components/pages/PageView.tsx` | 0 | 1 |
| `packages/pi-agent-server/src/session-settings.ts` | 0 | 1 |
| `packages/server-core/src/domain/u-api-model-discovery.ts` | 1 | 2 |
| `packages/server-core/src/handlers/rpc/llm-connections-uapi-policy.isolated.ts` | 0 | 1 |
| `packages/server-core/src/handlers/rpc/llm-connections.ts` | 1 | 2 |
| `packages/server-core/src/handlers/rpc/transfer.test.ts` | 0 | 1 |
| `packages/server-core/src/model-fetchers/u-api-refresh-preservation.test.ts` | 0 | 1 |
| `packages/server-core/src/model-fetchers/u-api-refresh-storage.isolated.ts` | 0 | 1 |
| `packages/server-core/src/pages/__tests__/script-executor-bridge.test.ts` | 0 | 1 |
| `packages/server-core/src/pages/pages-feature-policy.test.ts` | 0 | 1 |
| `packages/server-core/src/sessions/SessionManager.ts` | 1 | 5 |
| `packages/server-core/src/sessions/refresh-connection-runtime.test.ts` | 0 | 1 |
| `packages/server-core/src/sessions/upgrade-isolation.test.ts` | 0 | 1 |
| `packages/session-tools-core/src/handlers/create-task.test.ts` | 0 | 1 |
| `packages/session-tools-core/src/handlers/decide.test.ts` | 0 | 1 |
| `packages/session-tools-core/src/handlers/pages.test.ts` | 0 | 1 |
| `packages/shared/src/agent/__tests__/paid-image-tool-registry.test.ts` | 1 | 2 |
| `packages/shared/src/agent/core/__tests__/guarded-mode.test.ts` | 0 | 1 |
| `packages/shared/src/agent/mode-manager.ts` | 0 | 1 |
| `packages/shared/src/automations/automation-system.ts` | 0 | 1 |
| `packages/shared/src/automations/retry-scheduler.ts` | 0 | 1 |
| `packages/shared/src/automations/script-executor.ts` | 0 | 1 |
| `packages/shared/src/automations/u-agents-semantic-policy.test.ts` | 0 | 1 |
| `packages/shared/src/automations/validation.ts` | 0 | 1 |
| `packages/shared/src/config/paths.ts` | 1 | 2 |
| `packages/shared/src/config/storage.ts` | 14 | 15 |
| `packages/shared/src/config/u-agents-feature-policy.ts` | 0 | 1 |
| `packages/shared/src/decisions/health.test.ts` | 0 | 1 |
| `packages/shared/src/decisions/health.ts` | 0 | 2 |
| `packages/shared/src/decisions/resolve.ts` | 0 | 1 |
| `packages/shared/src/feature-flags.ts` | 0 | 1 |
| `packages/shared/src/pages/refresh.ts` | 0 | 1 |
| `packages/shared/src/pages/share-bundle.test.ts` | 0 | 2 |
| `packages/shared/src/pages/storage.test.ts` | 0 | 1 |
| `packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts` | 0 | 1 |
| `packages/shared/src/sources/api-tools.ts` | 4 | 2 |
| `packages/shared/src/workspaces/storage.ts` | 0 | 1 |

## 被替换的原标记

- `apps/electron/src/main/logger.ts`：`// U-API: 数据目录品牌统一为 ~/.u-agents/（不在 Electron logs 目录内，故单独写死）`
- `apps/electron/src/main/logger.ts`：`// U-API: 数据目录品牌统一为 ~/.u-agents/（与 messagingGatewayLogPath 一致，避免双目录）`
- `packages/pi-agent-server/src/index.ts`：`// U-API: brand — v0.9.2 sync 漏盘 "Craft-built" → "U Agents-built"（v24 F1 / G1.F2.1）`
- `packages/shared/src/config/paths.ts`：`// U-API: allow the new env var while preserving the legacy override for dev workflows.`
- `packages/shared/src/sources/api-tools.ts`：`// U-API: M3 SSRF 防护 — 阻止 credential-bearing fetch 到云元数据/私网（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md §5.2 follow-up）`
- `packages/shared/src/sources/api-tools.ts`：`// U-API: M3 SSRF 防护 — redirect bypass 修补（v24 F1.F3 P0）`
- `packages/shared/src/sources/api-tools.ts`：`// U-API: M3 SSRF 防护 — 拒绝云元数据/私网/非 https URL（防恶意 source 配 baseUrl 诱导 AI 带 Authorization 打云元数据）`
- `packages/shared/src/sources/api-tools.ts`：`// U-API: M3 SSRF 防护 — 主动拒绝 30x redirect（v24 F1.F3 P0；与 redirect:'manual' 配套）`


## 原标记处置说明

- logger 两处：硬编码目录改为统一 CONFIG_DIR，保留两个说明标记。
- Pi host prompt：保留品牌化系统提示，使用新 SDK 的提示传递方式，说明同步更新。
- paths：保留 U_AGENTS_CONFIG_DIR 优先与 CRAFT_CONFIG_DIR 兼容回退；空白变量被忽略。
- api-tools 四处：抽入上游公共 executeApiRequest 后合为两处统一保护。聊天工具与 Pages 共用相同 HTTPS/私网拒绝和 redirect:manual 路径；新增真实执行测试，删除单纯统计四条注释的测试。
- 其余原标记文本均保留；START/END 仍为 10/10。
- 注意：O 的实际 tracked TS/TSX 注释计数为 177，旧登记表写 178。按同一正则重算记录这个历史差异，不把旧文档数当作源码证据。最终重算为 216（净增 39），详见登记表。

## 新增改造点索引

| 编号 | 代码符号/边界 | 关联验证 |
|---|---|---|
| 85 | U_AGENTS_FEATURE_POLICY、Decision resolve/probe、Guarded Ask 归一 | pages-feature-policy、health、guarded-permission-mode、pi-agent-guarded-mode |
| 86 | TEST_LLM_CONNECTION_SETUP 固定路由前置校验 | llm-connections-uapi-policy.isolated |
| 87 | preserveUApiImageCapabilities / ModelRefreshService | u-api-refresh-preservation、u-api-refresh-storage.isolated、refresh-connection-runtime |
| 88 | Pages grant/action/refresh/executeScriptAction 关闭边界 | pages-feature-policy、action-bridge、script-executor-bridge |
| 89 | semanticCondition 事件/宿主/持久重试关闭 | u-agents-semantic-policy |
| 90 | 配置根与副本越界预检 | upgrade-isolation、secure-storage-config-dir |
| 91 | Paid turnContext/retry 身份迁移 | 既有 paid lifecycle + paid-image-tool-registry |
| 92 | Pi retry maxAgentDelayMs 明确预算 | session-settings |
