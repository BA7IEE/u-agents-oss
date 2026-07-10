# UPSTREAM PREVIEW — v0.11.0（2026-07-10）

> 任务边界：只做同步预分析与接收决策，不执行 `git fetch`、`git merge`、`checkout` 或冲突处理。

## 1. 结论

**决策：有条件接收 v0.11.0，但当前不执行合并。**

Projects、Kanban、Tasks、Pi SDK 0.80.3、自动化测试修复和完整 i18n 值得接收；后台代理跨 turn 常驻不能原样默认开启，新增 macOS Local Network 文案也不能原样使用 Craft 品牌。正式同步前必须先把本报告 §4 的产品决策变成合并约束。

## 2. 上游规模

| 项 | 值 |
|---|---:|
| 上游 tag | `v0.11.0` |
| 上游 HEAD | `f4e172bf372f4ccc7389a189be1e0b0541f96282` |
| 相对基线 | `v0.10.5...v0.11.0` |
| squash commits | 1 |
| 文件 | 207 |
| 新增 | 15,506 行 |
| 删除 | 555 行 |
| `apps/` | 108 文件 |
| `packages/` | 97 文件 |

这是一次明显高于 v0.10.4/v0.10.5 的功能型同步，不能按“机械版本升级”处理。

## 3. 主要变化

### 3.1 建议接收

- Projects：会话、资产、工作目录和 `MEMORY.md` 项目上下文。
- Kanban / Tasks / Conductor：独立任务、DAG 子任务、验收与 repair loop；上游标记为 Beta。
- Pi SDK `0.79.9 → 0.80.3`：移除 OpenAI 协议长响应的 20 秒 SSE 超时。
- UI i18n：补齐 crash screen、浏览器工具栏、Projects/Kanban/Tasks 等文案。
- Automation Test：不再等待完整 turn 导致 30 秒假超时。
- Sidebar 长 label 截断。

### 3.2 必须改写后接收

- `apps/electron/electron-builder.yml` 新增 `NSLocalNetworkUsageDescription`，原文包含 `Craft Agents`。合并时改为 U Agents 文案；该文件属于高冲突区，执行前按 `CLAUDE.md §3.3` 再向用户确认。
- `apps/electron/resources/release-notes/0.11.0.md` 必须整篇中文化、去 commit hash、清理旧 org/issue 链接和 Craft 品牌。
- `packages/shared/src/agent/pi-agent.ts` 新项目上下文调用仍传入 `'Craft Agents Backend'`；必须保留当前 fork 的 `U-API` backendName，同时接收 `projectContext` 参数。
- 新环境变量 `CRAFT_KEEP_BG_AGENTS_ALIVE` 必须改成 U Agents 命名，或至少提供 `U_AGENTS_*` 主名并兼容旧名。

## 4. 产品决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D1 | 接收 Projects / Kanban / Tasks，并保留 Beta 标识 | `PRODUCT.md` 规定上游通用能力默认保留；项目化任务对目标用户有直接价值 |
| D2 | 后台代理跨 turn 常驻默认 **OFF**，用户显式开启后才运行 | U Agents 按 Token 计费，目标用户难以判断后台持续消耗；上游默认 ON 不符合“省心、可控”定位 |
| D3 | 接收 Pi SDK 0.80.3 与 `/compat`、lazy Bedrock import 改造 | 直接改善 U-API OpenAI 协议长响应，同时是 v0.11 的类型/构建合同 |
| D4 | 接收 Local Network entitlement，但文案改成 U Agents | LAN MCP/API 仍有价值；不能带入 Craft 品牌 |
| D5 | 保留本轮依赖删除、安全下限与根 `overrides` | 上游 v0.11 package.json 仍使用旧 Electron、Vite、Undici、ws、shell-quote，并会重新带入已删除的 `markitdown-js` / Copilot SDK 等链路 |
| D6 | 不恢复任何新 provider UI | v0.11 没有新增 provider 入口；若合并时发现新增入口，按 `04-feature-cuts.md` 继续隐藏 |

## 5. U-API 改造点交叉

上游 207 个变更文件与当前 marker-bearing 文件交叉 8 个：

1. `apps/electron/src/renderer/App.tsx`
2. `apps/electron/src/renderer/main.tsx`
3. `packages/pi-agent-server/src/index.ts`
4. `packages/server-core/src/handlers/rpc/llm-connections.ts`
5. `packages/server-core/src/handlers/rpc/settings.ts`
6. `packages/shared/src/agent/pi-agent.ts`
7. `packages/shared/src/config/models-pi.ts`
8. `packages/shared/src/prompts/__tests__/system.test.ts`

重点判断：

- `main.tsx` 新 crash i18n 与当前启动语言同步 marker 邻近，预计真实冲突概率高。
- `settings.ts` 新增 RTK `HANDLED_CHANNELS`，会碰到我方既有 C13 marker，必须保留双方数组成员。
- `pi-agent.ts` 同时改 system prompt 参数和 backendName，是本次最重要的语义冲突。
- `llm-connections.ts` / `models-pi.ts` 的 `/compat` import 应接收，但不能破坏 U-API 连接过滤、模型清单豁免和协议映射。
- `App.tsx` 的后台任务 UI 与我方 `u-agents:*` 事件命名空间应做双向 listener/dispatch 核对。

当前 marker 基线经排除 `apps/electron/release/` 后实测为 **120 / 10 / 10**。新增的 `files.ts` 安全改造不在上游 v0.11.0 的 207 个变更文件内，因此 §5 交叉文件仍为 8 个。

## 6. 品牌与 i18n

- 上游 diff 没有新增 `craft.do` 域名。
- 明确新增的用户可见 Craft 品牌位于 `NSLocalNetworkUsageDescription` 和 0.11.0 release notes。
- 7 个 locale 文件各新增约 203 个 Projects/Kanban/Tasks 相关 key；合并后必须运行 parity、sorted、coverage，并人工核对 `zh-Hans` 值质量。
- 上游 package metadata 会把 `@u-agents/*` 恢复成 `@craft-agent/*`；C11 检查必须保持 0 命中。

## 7. 预计冲突面

必然或高概率冲突：

- 根 `package.json`、多个 workspace `package.json` 与 `bun.lock`：上游升版本/Pi SDK，本 fork 刚完成安全下限和 `overrides`。
- `apps/electron/electron-builder.yml`：上游加 entitlement，本 fork 保持品牌/发布配置。
- §5 的 8 个 marker 文件。
- 7 个 locale 文件与 release notes：即使 Git 不报冲突，也必须做值同步和品牌反向核对。

`bun.lock` 策略：不能直接拿上游 lock 覆盖本轮安全治理。应以上游 v0.11 lock 为结构基底，重新应用 `@u-agents` workspace 名、本轮直接依赖下限和根 `overrides`，再运行 `bun install` 与完整验证。

## 8. 合并后强制验证

1. 完成 package 冲突决策后运行 `bun install` 重建 `bun.lock`，再运行 `bun install --frozen-lockfile` 验证可复现。
2. `bun run validate:ci`
3. `bun audit --production`，不得高于本轮 40 项基线；新增 critical 必须停下。
4. §14 marker：120 / 10 / 10，若因新改造点变化需登记后刷新。
5. `@craft-agent/` scope 为 0；新增用户可见 Craft 品牌为 0。
6. macOS arm64 packaged app 启动 + U-API OpenAI/Anthropic 各一条真实对话。
7. Projects/Kanban 创建、项目上下文注入、Task/Conductor 基础路径。
8. 后台代理默认不跨 turn；显式开启后才保持运行。

## 9. 最终建议

可以创建独立 `sync/upstream-v0.11.0-20260710` 分支进入正式同步，但必须按 D1–D6 有条件接收。本报告不授权本仓库 AI 执行 merge；正式同步由用户或外部执行会话完成。
