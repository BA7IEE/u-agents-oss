# UPSTREAM PREVIEW — v0.11.1（2026-07-11）

> 任务边界：按仓库 [`upstream-sync`](../../.agents/skills/upstream-sync/SKILL.md) 规则完成上游核查、接收决策与执行手册，不在本会话运行 `git fetch`、`git merge`、`git checkout`、依赖安装或源码修改。
>
> 当前状态：**待执行**。本地 `main` / `origin/main` 均为 `0f8ed9ac`；本地 `upstream/main` 仍停在 v0.11.0，远端 `upstream/main` 与 `v0.11.1` 均指向 `4289b16097322e9911d3078d8a64bd8c830717c3`。

## 1. 结论

**决策：接收 v0.11.1，但必须保留 U-API Token-only 自动模型发现，并改写 release notes。**

这是一次小型模型与 SDK 更新：上游新增 GPT-5.6 Luna / Terra / Sol，支持原生 `max` 思考级别，并把 Pi SDK 从 `0.80.3` 升到 `0.80.6`。相对 v0.11.0 只有 1 个 squash commit、23 个文件、`+82 / -63`，没有新增产品模块或 provider UI。

本次不改变以下既有产品决定：

- 用户只填写 U-API Token，不输入模型或协议。
- 模型目录来自 Token-scoped `/v1/models`，不能用静态模型表替代。
- 默认模型由 [`discoverUApiModels`](../../../packages/server-core/src/domain/u-api-model-discovery.ts) 的动态推荐顺序与 [`selectWorkingUApiModel`](../../../packages/server-core/src/domain/u-api-model-discovery.ts) 的真实探活共同决定；推荐模型不可用时继续按候选模型与协议顺序降级。
- 上游 [`PI_PREFERRED_DEFAULTS`](../../../packages/shared/src/config/llm-connections.ts) 新增 `gpt-5.6-sol` / `terra` / `luna` 可以接收，但它只服务原生 `openai` / `openai-codex` Pi provider，不能成为 U-API 的硬编码默认值。
- WhatsApp 没有功能变化；虽然 package 版本随发布统一提升，但不恢复、不新增验收范围。

## 2. 上游变化

| 项 | 值 |
|---|---:|
| 上游 tag | `v0.11.1` |
| 上游 HEAD | `4289b16097322e9911d3078d8a64bd8c830717c3` |
| 相对基线 | `v0.11.0...v0.11.1` |
| squash commits | 1 |
| 文件 | 23 |
| 新增 / 删除 | `+82 / -63` |

实质改动分为四组：

1. `packages/shared/src/config/llm-connections.ts`：原生 OpenAI / Codex 推荐顺序新增 GPT-5.6 Sol、Terra、Luna。
2. `packages/shared/src/agent/backend/pi/constants.ts`、`thinking-levels.ts` 及测试：`ThinkingLevel.max` 不再统一压到 `xhigh`，而是交给支持它的模型原生处理；旧模型仍由 Pi SDK 做能力上限适配。
3. 根与 Pi 相关 package：`@earendil-works/pi-*` 从 `0.80.3` 升到 `0.80.6`，支持 request-wide input-token pricing tiers。
4. 15 个 `package.json` 统一升到 `0.11.1`，并新增 `apps/electron/resources/release-notes/0.11.1.md`。

## 3. 接收与保留决策

| 编号 | 决策 | 落点 |
|---|---|---|
| D1 | 接收 Pi SDK `0.80.6` 与配套测试修改 | `package.json`、`packages/{pi-agent-server,server-core,shared}/package.json`、`bun.lock`、`craft-metadata-schema.test.ts` |
| D2 | 接收原生 `max` 思考级别透传 | `packages/shared/src/agent/backend/pi/constants.ts`、`constants.test.ts`、`thinking-levels.ts` |
| D3 | 接收 GPT-5.6 原生 provider 推荐顺序 | `packages/shared/src/config/llm-connections.ts` 的 `PI_PREFERRED_DEFAULTS` |
| D4 | U-API 默认模型继续动态发现和探活，禁止改成 `gpt-5.6-sol` 或任何静态值 | `packages/server-core/src/domain/u-api-model-discovery.ts`、`packages/server-core/src/handlers/rpc/llm-connections.ts` |
| D5 | 15 个 package 版本升到 `0.11.1`，同时保留全部 `@u-agents/*` 名称、描述、`private` 与安全依赖约束 | 各 `package.json` |
| D6 | `0.11.1.md` 整篇改为中文，去上游连接类型宣传与英文品牌 | `apps/electron/resources/release-notes/0.11.1.md` |

## 4. 预计冲突与处理

### 4.1 package 与 lockfile

预计 15 个 `package.json` 会因上游改相邻的 `version`、本 fork 改 `name` / `description` / workspace scope 而产生文本冲突；`bun.lock` 也可能因 `@craft-agent/* → @u-agents/*` 与 Pi 依赖升级交叉而冲突。

统一解法：

- 保留我方 `name`、`description`、`private`、`@u-agents/*` workspace 引用、安全版本下限与根 `overrides`。
- 把 15 个 package 的顶层 `version` 统一设为 `0.11.1`。
- 只把 `@earendil-works/pi-ai`、`pi-agent-core`、`pi-coding-agent` 升到 `0.80.6`；Claude Agent SDK 保持当前 `0.3.197`，本次上游没有修改它。
- `bun.lock` 不删除重建。以上一版安全锁文件为基底增量运行 `bun install`，然后确认 workspace scope 仍全是 `@u-agents/*`，Pi 三包均为 `0.80.6`，Sentry 仍保持当前单版本安全基线。
- 上游 `bun.lock` 内 workspace 元数据仍显示 `0.11.0`，而 package manifest 已升 `0.11.1`；执行 `bun install` 后应以当前 manifest 重新调和，不能照抄上游 lock 的 workspace version。

### 4.2 U-API marker 交叉

23 个上游改动文件中只有 [`packages/shared/src/config/llm-connections.ts`](../../../packages/shared/src/config/llm-connections.ts) 带现有 U-API marker（#75，MiniMax 与 `mini` token 匹配修复）。上游改动位于后方的 `PI_PREFERRED_DEFAULTS`，预期可自动合并；合并后仍要确认：

- #75 marker 和完整 token 匹配逻辑存在。
- [`u-api-model-discovery.ts`](../../../packages/server-core/src/domain/u-api-model-discovery.ts) 未被替换或旁路。
- `gpt-5.6-sol` 可在 Token 返回时排到 `gpt-5.5` 前，但没有写成 U-API 无条件默认值。
- 首选模型或首选协议探活失败后，会继续尝试下一项。

当前权威 marker 基线为 **134 / START 10 / END 10**；本轮预计不新增 marker，合并后仍应为 134 / 10 / 10（总数允许 132–136，START / END 必须严格相等）。

### 4.3 品牌与 release notes

上游新增的 `0.11.1.md` 是英文，并出现 OpenAI API key、ChatGPT account、Azure OpenAI 等本 fork 不对用户开放的连接入口。合并时建议改为：

```markdown
## 新功能

- 新增 GPT-5.6 Luna、Terra、Sol 模型支持。
- 支持模型原生的“最大”思考级别；不支持的模型会自动使用可用上限。

## 改进

- 优化 GPT-5.6 系列的推荐顺序。
- Pi SDK 升级至 0.80.6，改进 GPT-5.4、GPT-5.5 和 GPT-5.6 长上下文费用统计的准确性。

## 说明

- U Agents 仍根据 Token 自动发现并验证可用模型，不固定指定某个默认模型；首选模型不可用时会自动降级。
```

翻译后对新文件运行外链、commit hash、`craft` 字样三组检查，必须全部为 0。

## 5. 执行步骤

由用户或不受本仓库 docs-only 规则限制的执行会话运行：

```bash
cd /Users/dengwang/Documents/coding/u-agents-oss/u-agents
git status --short
git switch main
git pull --ff-only origin main
git fetch upstream
git switch -c codex/sync-upstream-v0.11.1-20260711
git merge --no-commit --no-ff upstream/main
```

注意：当前未跟踪的 `.agents/`、`.codex/` 属用户工作区内容，不得 `git clean` 或删除。冲突处理完成后：

```bash
bun install
bun install --frozen-lockfile
bun run server:build:subprocess
bun run validate:ci
bun run typecheck:all
```

提交前再运行：

```bash
grep -rE --exclude-dir=node_modules --exclude-dir=release "U-API" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules --exclude-dir=release "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules --exclude-dir=release "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rEn "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | grep -v node_modules
grep -niE 'craft|github\.com|\(#[0-9]+\)|`[a-f0-9]{7,10}`' apps/electron/resources/release-notes/0.11.1.md
```

完成代码验证后，先提交同步分支；不要直接在冲突态合回 `main`。

## 6. 强制验收

| 验收项 | 期望 |
|---|---|
| `bun install --frozen-lockfile` | 退出码 0 |
| `bun run validate:ci` | 全绿 |
| `bun run typecheck:all` | 全绿 |
| GPT-5.6 / thinking-level 相关测试 | 全绿 |
| U-API 自动发现单测 | `u-api-model-discovery.test.ts` 全绿，覆盖 Sol 优先、模型降级、协议降级 |
| marker | 134 / START 10 / END 10 |
| NPM scope | `@craft-agent/` 0 命中 |
| release notes | 全中文；外链、commit hash、`craft` 0 命中 |
| Pi subprocess | 使用 `0.80.6` 重新构建，包内 bundle 不是旧的 `0.80.3` |
| macOS arm64 packaged app | 启动正常；真实 U-API 对话至少 1 条；实际选择 Token 可用的最高推荐模型或正确降级 |
| Windows packaged app | 用户侧打包安装后真实 U-API 对话至少 1 条；确认 Pi subprocess 可启动 |

Pi SDK 与 subprocess bundle 同时变化，C14 要求本轮不能只测开发模式或只测应用启动。macOS 打包通过后需重新生成 v0.11.1 Windows 源码包和打包说明；旧 v0.11.0 归档不再作为候选发版包。

## 7. 完成条件

只有在以下条件全部满足后，才能把本报告状态改为“已执行”并新增正式 `SYNC-v0.11.1-20260711.md`：

1. 独立同步分支完成 merge 与冲突处理。
2. D1–D6 全部落实，U-API Token-only 路径未回退。
3. §6 自动验证与 macOS 打包真实对话通过。
4. 用户完成 Windows 包安装与真实对话测试。
5. 用户确认后再合回 `main`、推送并进入正式发版。
