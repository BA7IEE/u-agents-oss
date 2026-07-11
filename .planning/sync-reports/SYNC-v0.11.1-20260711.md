# v0.11.1 上游同步报告 — 2026-07-11

> 分支：`codex/sync-upstream-v0.11.1-20260711`
> 同步提交：`5536427b70e0462068c293350b6337fa26cc3a69`
> 上游标签：`v0.11.1`（`4289b16097322e9911d3078d8a64bd8c830717c3`）
> 合并基线：`v0.11.0`（`f4e172bf372f4ccc7389a189be1e0b0541f96282`）
> 状态：同步、冲突处理、代码验证、macOS arm64 打包与真实 U-API 对话已完成；Windows 源码交接包已生成，等待用户在 Windows x64 实机测试。尚未合回 `main`、未推送。

## 1. 结论

v0.11.1 已按预分析 D1–D6 完成接收：

- Pi SDK 从 `0.80.3` 升至 `0.80.6`。
- 接收 GPT-5.6 Luna、Terra、Sol 的原生 provider 推荐顺序。
- `ThinkingLevel.max` 原生透传给 Pi，由 Pi 按模型能力自动限幅。
- 15 个 package 版本统一升到 `0.11.1`，保留全部 `@u-agents/*` scope、品牌描述、`private`、安全依赖下限与根 `overrides`。
- `release-notes/0.11.1.md` 已完整中文化，去除本 fork 不开放的 OpenAI API key、ChatGPT、Azure 连接入口宣传。
- WhatsApp 仍按产品决定记为 N/A，没有恢复或扩大验收范围。

U-API Token-only 路径保持不变：用户只填写 Token，模型目录由 [`discoverUApiModels`](../../packages/server-core/src/domain/u-api-model-discovery.ts) 动态获取；[`selectWorkingUApiModel`](../../packages/server-core/src/domain/u-api-model-discovery.ts) 依推荐顺序真实探活，模型或协议不可用时继续降级。`gpt-5.6-sol` 没有被写成 U-API 的无条件默认值。

综合评级：**A−。macOS 候选包通过；正式发版仍以 Windows 实机通过、签名与更新链路核对为前提。**

## 2. 合并影响

| 项 | 结果 |
|---|---:|
| 上游规模 | 1 squash commit，23 文件，`+82 / -63` |
| 实际冲突 | 16 文件 |
| package 冲突 | 15 个 `package.json` |
| lockfile 冲突 | `bun.lock` 1 个 |
| 源码冲突 | 0 |
| marker-bearing 交叉 | 1 文件 |

冲突处理：15 个 package 全部以我方文件为基底，版本升至 `0.11.1`，Pi 三包升至 `0.80.6`；`bun.lock` 以我方安全锁文件为基底运行 `bun install` 增量调和。最终 lock 中 `@u-agents/*` 80 处、`@craft-agent/*` 0 处。

唯一 marker-bearing 交叉文件为 [`packages/shared/src/config/llm-connections.ts`](../../packages/shared/src/config/llm-connections.ts)。上游只修改 `PI_PREFERRED_DEFAULTS`，我方 #75 MiniMax 完整 token 匹配逻辑未受影响。

## 3. 验证结果

| 验证项 | 结果 |
|---|---|
| `bun install --frozen-lockfile` | 通过；1749 installs / 1651 packages，无变化 |
| `bun run validate:ci` | 通过 |
| GPT-5.6 / thinking / U-API targeted tests | 18 pass / 0 fail |
| package 版本 | 15 个均为 `0.11.1` |
| Pi 依赖 | `pi-ai` / `pi-agent-core` / `pi-coding-agent` 均为 `0.80.6` |
| marker | 134 / START 10 / END 10 |
| NPM scope | 源码与 `bun.lock` 中 `@craft-agent/` 均为 0 |
| release notes | 全中文；外链、commit hash、`craft` 0 命中 |
| `bun audit --production` | 40：1 critical / 20 high / 18 moderate / 1 low，与 v0.11.0 基线一致 |

U-API targeted tests确认：Sol 排在 5.5 前、推荐模型降级、同模型协议降级、Token 错误不被错误降级掩盖、自动刷新遵守显式覆盖、`max` 原生透传均通过。

## 4. macOS arm64 打包与实测

### 4.1 构建

完整 `build-dmg.sh` 首次执行完成源码、renderer 与 subprocess 构建后，读取本机 `.env` 中的 `APPLE_SIGNING_IDENTITY=com.justiceleague.batman`，该身份不能用于代码签名，electron-builder 在 `koffi.node` 签名阶段退出。代码与 bundle 未报错。

随后复用同一批已构建资源，以 `CSC_IDENTITY_AUTO_DISCOVERY=false` 走项目既有 adhoc 路径重新执行 electron-builder，构建成功。该签名环境问题不影响源码；正式发布前仍需使用有效 Developer ID 完成签名与公证。

| 产物 | 结果 |
|---|---|
| App | `apps/electron/release/mac-arm64/U Agents.app` |
| DMG | `apps/electron/release/U-Agents-arm64.dmg`，262 MB |
| ZIP | `apps/electron/release/U-Agents-arm64.zip`，253 MB |
| 版本 | `CFBundleShortVersionString=0.11.1`，`CFBundleVersion=0.11.1` |
| 签名 | adhoc + hardened runtime，`codesign --verify --deep --strict` 通过 |
| DMG SHA-256 | `a5fe86d6204b9c5e3dc24a3ef9ef77aa5ab30ead0eee0cd46b833181a50f670d` |
| ZIP SHA-256 | `2c30d0154854bd24122ed1206327f8100cdb87cff3fc2d24135bdaaf8cad8e67` |

包内 LICENSE、NOTICE、Pi agent server、session MCP server、Bun runtime 与中文版 `0.11.1.md` 均存在。

### 4.2 packaged app 真实对话

- 从 `release/mac-arm64/U Agents.app` 冷启动成功。
- 主界面中文化和 U Agents 品牌正常。
- 新建会话自动显示 `gpt-5.6-sol`；该结果来自当前 Token 的动态目录与探活，不是静态默认。
- 发送 `U-API v0.11.1 macOS OK` 后收到正常回复。
- Pi session 记录确认 `provider=custom-endpoint`、`api=openai-completions`、`model=gpt-5.6-sol`、`stopReason=stop`。
- 没有 `piServerPath not configured`、module-not-found、spawn failure 或 fatal 日志。

macOS packaged app 核心门槛通过。

## 5. Windows 交接

已在仓库上一级目录生成：

- `U-Agents-v0.11.1-Windows-handoff-5536427b.zip`
- `U-Agents-v0.11.1-Windows-handoff-5536427b.zip.sha256`
- `U-Agents-v0.11.1-Windows打包测试流程.md`

源码归档来自提交 `5536427b`，共 2237 个 Git 文件，不含 `.git`、`node_modules`、`release`、`.env`、`.agents`、`.codex` 或本机配置。

源码包 SHA-256：`427b2d1d4f12ef1a127b655e0d9f09a7bd2da5c255a13600fed9e2af9c52fb01`。

Windows 实测仍需用户完成：x64 NSIS 构建、包内 subprocess 核对、安装启动、Token-only 自动模型发现、真实 U-API 首条对话、卸载与可选正式签名。

## 6. 后续

1. 用户把 §5 三个文件复制到 Windows，按流程完成手动打包测试。
2. Windows 通过后交回安装器 SHA-256、构建日志、签名结果和异常截图。
3. Windows 结果通过后再决定合回 `main`、推送、签名、公证和正式发版；本报告不把待测项写成已通过。
