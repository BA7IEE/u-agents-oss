# 00 — 代码地图（packages / apps 导航）

> 给 AI 写规格、对照代码时当"目录页"用：先扫本文件定位到包，再去开具体文件，少烧上下文。
> ⚠️ 本仓库 AI 只读这些源码、只写 `.planning/*.md` 规格，**不改任何源码**（见 [`../CLAUDE.md`](../CLAUDE.md) §0）。
> 🔴 = [`../CLAUDE.md`](../CLAUDE.md) §3.3 高冲突区，写相关规格前必读 `08-conflict-zones.md` + 对应规格。

## 一图看懂

```
桌面 App (apps/electron) ─┐
无头服务 (packages/server)─┼─► server-core (RPC) ─► shared (业务逻辑核心) ─► 双后端
CLI (apps/cli) ───────────┘                                                  ├─ ClaudeAgent (Anthropic SDK；也走所有 OpenAI 兼容/第三方端点)
                                                                             └─ PiAgent (Pi SDK；Google / Codex / Copilot)
```

双后端是核心设计：`packages/shared/src/agent/backend/factory.ts#createBackend()` 决定用哪个；两者都继承 `BaseAgent`（`packages/shared/src/agent/base-agent.ts`）。

## 技术栈（速记）

Bun（强制，`bun.lock`）· TypeScript ESM · Electron 39 + React 18 · shadcn/Radix + Tailwind v4 · Jotai · Zod 4 · esbuild(main) + Vite 6(renderer) · MCP SDK · 少量 Python（`apps/electron/resources/scripts` 文档工具）。

## packages/

| 包 | 职责 | 关键文件 / 子目录 | 相关规格 |
|---|---|---|---|
| `core` | 仅共享类型（无逻辑）| `src/types/`：`session.ts` `workspace.ts` `message.ts` `server.ts` | 自带 `CLAUDE.md`（上游上下文）|
| `shared` ⭐ | 业务逻辑主体（最大，~418 文件）| `agent/`（后端 + `base-agent.ts` + `core/`）、`config/`（`storage.ts` 🔴 网关锁、`llm-connections.ts` 🔴、`provider-metadata.ts` 🔴、`paths.ts`、`u-api-defaults.ts`）、`auth/`、`credentials/`（AES-256-GCM）、`sources/`、`sessions/`、`skills/`、`mcp/`、`automations/`、`protocol/`、`scheduler/`、`i18n/`、`branding.ts` 🔴、`utils/url-safety.ts`（SSRF）| 02 / 01 / 10 / 14 |
| `server-core` | 无头服务复用基建（RPC handlers + 领域逻辑）| `src/domain/connection-setup-logic.ts`（U-API 模板）、`src/handlers/rpc/` | 02 / 03 / 14 |
| `server` | 独立无头 Bun server 二进制 | `src/`（2 文件，入口）| 05 |
| `session-mcp-server` | 把会话级工具经 stdio 暴露成 MCP | — | — |
| `session-tools-core` | 会话工具库（SubmitPlan、config_validate、source-test）| `src/handlers/source-test.ts`（SSRF）| 14 |
| `pi-agent-server` | 进程外 Pi agent（JSONL/stdio）；含 `web-fetch` 工具 | `src/index.ts`、`src/tools/web-fetch.ts`（SSRF）| 04 / 14 |
| `messaging-gateway` | Telegram/WhatsApp 消息桥 | `src/access-control.ts`、`src/commands.ts`、`src/topic-registry.ts` | 01 / 14 |
| `messaging-whatsapp-worker` | WhatsApp 子进程 worker | — | 12 |
| `ui` | 共享 React 组件（会话查看、Markdown 渲染）| `src/components/`（含 `annotations/block-markers.ts`）| — |

## apps/

| App | 职责 | 关键文件 / 子目录 | 相关规格 |
|---|---|---|---|
| `electron` ⭐ | 主桌面 GUI（最大，~2623 文件）| `src/main/`（`index.ts`、`auto-update.ts`、`handlers/`、`window-state.ts`）、`src/preload/`、`src/renderer/`（`App.tsx`、`components/onboarding/` 🔴、`components/apisetup/` 🔴、`pages/settings/AiSettingsPage.tsx`、`components/app-shell/`）、`eslint-rules/`（自定义 lint 插件）、`scripts/`（build-dmg.sh / build-win.ps1 / build-linux.sh）、`electron-builder.yml` 🔴、`resources/scripts/`（Python 文档工具）| 03 / 01 / 05 / 12 |
| `cli` | 终端 WebSocket 客户端 | `src/index.ts` | `docs/cli.md`、M2-CLI-RENAME |
| `viewer` | 分享/查看会话转写的网页 | `src/`（7 文件）| — |
| `webui` | 无头服务自带的浏览器 UI | `src/`、`login.html` | 01 |
| `online-docs` | Mintlify 文档站源（**不在 Bun workspace**）| `bun run docs:dev` | M3 文档站 |

## 高冲突区（🔴，写规格前必停 + 必读）

来自 [`../CLAUDE.md`](../CLAUDE.md) §3.3 / [`08-conflict-zones.md`](08-conflict-zones.md)：

1. `apps/electron/electron-builder.yml`
2. `packages/shared/src/branding.ts`
3. `packages/shared/src/config/llm-connections.ts`
4. `packages/shared/src/config/provider-metadata.ts`
5. `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`
6. `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx`
7. `apps/electron/src/renderer/components/apisetup/`（整个目录）

## 核心领域概念

| 概念 | 一句话 | 定义位置 |
|---|---|---|
| Workspace | 装 sessions/sources/skills 的顶层容器，存于 `~/.u-agents/workspaces/{id}/` | `core/src/types/workspace.ts` |
| Session | 一次会话，带工作流状态，JSONL 持久化 | `core/src/types/session.ts`、`shared/src/sessions/jsonl.ts` |
| Agent / Backend | LLM 提供方抽象；`BaseAgent` + `ClaudeAgent`/`PiAgent` | `shared/src/agent/base-agent.ts`、`agent/backend/factory.ts` |
| Source | 外部数据连接，类型 `mcp \| api \| local` | `shared/src/sources/types.ts` |
| Skill | 每 workspace 的专用 agent 指令集 | `shared/src/skills/types.ts` |
| Permission Mode | 三档门控：`safe`/`ask`/`allow-all` | `shared/src/agent/mode-manager.ts` |
| Automation | 事件触发（LabelAdd / SchedulerTick / PreToolUse 等）拉起会话 | `shared/src/automations/automation-system.ts` |
| LLM Connection | 已存的 provider/凭证配置；本 fork 锁死到 U-API 网关 | `shared/src/config/llm-connections.ts`、`config/storage.ts` |

## 命令速查（只读，AI 可跑；写命令禁止）

| 范围 | typecheck | test | lint |
|---|---|---|---|
| 全仓 | `bun run typecheck:all` | CI 用 `bun run validate:ci`（=typecheck:all + test:shared:all + test:doc-tools + i18n 三查）| `bun run lint` |
| `packages/shared` | `cd packages/shared && bun run tsc --noEmit` | `cd packages/shared && bun test` | `cd packages/shared && npx eslint .` |
| `apps/electron` | `cd apps/electron && bun run typecheck` | `cd apps/electron && bun test` | `cd apps/electron && bun run lint` |

> ⚠️ `apps/electron/release/**` 里有被复制进去的 stale `*.isolated.ts`，会让 `bun test` 出现假失败——已在 `.claude/settings.json` 的 `permissions.deny` 里排除，别去读它。
> 完整 per-package 命令表见各包 `package.json` 与 CI（`.github/workflows/validate.yml`）。
