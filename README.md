# U Agents（优智体）

U Agents 是一款面向中国非技术及半技术用户的桌面 AI Agent 应用。项目基于 Apache 2.0 许可的 [Craft Agents OSS](https://github.com/craft-ai-agents/craft-agents-oss) 二次开发，由独立开发者以闭源方式商业分发。

当前源码版本为 `0.10.5`。应用使用 Electron、React、Bun monorepo，并同时保留 Claude Agent SDK 与 Pi SDK 后端；面向最终用户的模型调用统一通过 U-API。

## 产品边界

- 桌面应用品牌：**U Agents / 优智体**。
- LLM 网关品牌：**U-API**。
- 固定网关：`https://token.u-studio.cn/v1`。
- 用户只能配置 U-API Token、协议和模型，不能修改 `baseUrl`，也不会看到 Anthropic 直连、ChatGPT Plus、Bedrock、Vertex、Ollama 等 provider 入口。
- 支持 OpenAI Chat Completions 与 Anthropic Messages 两种兼容协议。
- 支持多个 U-API Token 连接，但每个连接都由启动迁移持续锁定到同一网关。
- M1/M2 不开放会话分享；自建 Viewer 完成后再评估。

完整产品决策见 [PRODUCT.md](PRODUCT.md)，U-API 合同见 [.planning/02-llm-gateway-spec.md](.planning/02-llm-gateway-spec.md)。

## 已保留能力

- 多 Workspace、多会话与状态流。
- Explore、Ask to Edit、Auto 三档权限模式。
- Skills、MCP/API/本地 Sources。
- 图片、PDF、Office 文件附件与内容转换。
- Automations、Telegram、WhatsApp 等消息和自动化能力。
- 多文件 Diff、主题、内置浏览器和远程 Workspace 基础能力。

OAuth Sources 当前仍依赖上游 relay，属于已记录的过渡期白标边界，详见 [LEGAL.md](LEGAL.md)。

## 仓库结构

```text
apps/electron/            桌面应用
packages/shared/          配置、认证、Agent 与会话公共逻辑
packages/server-core/     RPC handlers 与 SessionManager
packages/pi-agent-server/ Pi Agent 子进程
packages/session-tools-core/ 会话工具
.planning/                产品规格、同步基线与发版记录
```

更完整的代码导航见 [.planning/00-codebase-map.md](.planning/00-codebase-map.md)。

## 本地开发与验证

本仓库只使用 Bun，不要生成 `package-lock.json`、`pnpm-lock.yaml` 或 `yarn.lock`。

```bash
bun install --frozen-lockfile
bun run validate:ci
bun run electron:start
```

打包、上传和自动更新必须按 [.planning/05-build-release.md](.planning/05-build-release.md) 与 [.planning/06-update-server.md](.planning/06-update-server.md) 执行，不能直接沿用上游发布脚本或上游更新地址。

## 当前阶段

- M1：已完成，macOS arm64 安装与 U-API 对话链路已验证。
- M2：Windows x64 已验证；macOS 正式签名/公证、Linux、三平台自动更新和性能基线仍待闭环。
- M3：自建 OAuth relay、文档站和 Viewer 等自主基础设施。
- M4+：按月评估上游 release，版本号跟随上游 tag。

当前路线图见 [.planning/11-roadmap.md](.planning/11-roadmap.md)，上游同步规程见 [.planning/07-upstream-sync.md](.planning/07-upstream-sync.md)。

## 贡献边界

这是 U Agents 的私有商业 fork，不作为公共开源社区项目运营，不接受面向公众的 Pull Request 或 GitHub Issue。上游通用问题应提交到 [craft-agents-oss](https://github.com/craft-ai-agents/craft-agents-oss)。

## 许可与署名

- 上游代码按 Apache License 2.0 使用，完整条款见 [LICENSE](LICENSE)。
- 上游版权与本项目派生声明见 [NOTICE](NOTICE)。
- Craft 商标政策见 [TRADEMARK.md](TRADEMARK.md)。
- U Agents 的合规边界见 [LEGAL.md](LEGAL.md)。

“Craft”与“Craft Agents”属于 Craft Docs Ltd. 的商标；“U Agents / 优智体”属于 U Studio。U Agents 不是 Craft 官方产品，也不暗示 Craft Docs Ltd. 对本产品的认可或背书。
