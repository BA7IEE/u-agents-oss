# PRODUCT.md — U Agents 产品定位

> 用于约束 AI 在开发过程中**不要超出**产品边界。
> 任何"AI 觉得好"但本文未列入的功能，不要主动加。

---

## 一句话定位

**U Agents 是一款面向中国用户的桌面端 AI Agent 应用，所有大模型流量统一走开发者运营的 Token 中转站。**

用户买的是：
1. 一个开箱即用的 Agent 桌面客户端（多会话、多技能、Sources、自动化）
2. 一个稳定中文化界面、有售后的国内服务
3. 一个统一计费、不用自己折腾各家 API Key 的中转通道

---

## 目标用户画像

| 维度 | 描述 |
|---|---|
| 技术水平 | 非技术 ~ 半技术（产品经理、设计师、轻度开发、内容创作者） |
| 痛点 | 国内访问 Anthropic/OpenAI 不便、Claude Code 等 CLI 工具学习成本高、想要 GUI |
| 付费意愿 | 愿为"省心"和"稳定"付费，反感复杂的 API Key 配置 |
| 不是谁 | 不是要折腾自建中转的极客（他们自己 fork 上游就够了） |

---

## 第一版（M1）必须有的功能

来自上游的功能默认**保留**，下面只列我们**确认要保留**的：

- ✅ 多会话管理 + 状态流（Inbox/Archive/Todo/In Progress/Done）
- ✅ 三档权限模式（Explore / Ask to Edit / Auto）
- ✅ Sources：MCP servers / REST APIs / 本地文件系统
- ✅ Sources：第三方 OAuth 类（Slack / Gmail / Outlook / Microsoft）—— **保留但有白标瑕疵**，详见 `LEGAL.md`
- ✅ Skills（技能/能力，per-workspace）
- ✅ Workspace 主题、Multi-File Diff
- ✅ 文件附件（图片、PDF、Office）
- ✅ 自动化 Automations
- ❌ ~~会话分享（Viewer Web 页面）~~ —— **M1 隐藏**：自建 viewer 涉及服务端/存储/域名，扩大范围；M3 自建后再开放。详见 `04-feature-cuts.md` §7 + `11-roadmap.md` §M1

---

## 第一版（M1）必须**砍掉**或**隐藏**的

详细清单在 `.planning/04-feature-cuts.md`，这里是大原则：

- ❌ 所有"添加 LLM 连接"的入口（onboarding 选 provider、设置里"Add Connection"按钮）—— 改为单一 "U-API" 连接（详见 `.planning/02-llm-gateway-spec.md`）
- ❌ Anthropic 直连 / Bedrock / Vertex / GitHub Copilot / ChatGPT Plus(Codex) / Ollama 本地 / OpenRouter / Groq / Mistral / DeepSeek / xAI 等 provider 入口（代码可保留，UI 全部隐藏）
- ❌ 上游的"一键安装脚本"（`scripts/install-app.sh` / `install-app.ps1`）首发不放出，避免暴露 craft.do
- ❌ 自动更新指向 `agents.craft.do` —— 必须替换为自建更新服务器
- ❌ "Help / Docs"菜单链接 craft.do —— 替换为自建文档站，没建好前先指向官网或临时禁用

---

## 不做的事（避免范围蔓延）

| 不做的事 | 为什么 |
|---|---|
| ❌ 自己训练或微调模型 | 我们是中转方，不是模型方 |
| ❌ Web 端注册/登录/账号体系（M1） | M1 阶段桌面端用 token 直接接入中转站，不做用户系统 |
| ❌ 团队/企业版功能 | 先把个人版做稳 |
| ❌ 移动端 | 上游不支持，不要新加 |
| ❌ 自研 MCP 协议或 Source 协议 | 跟上游走 |
| ❌ 自研 Agent SDK | 用上游集成的 Claude Agent SDK + Pi SDK |

---

## 商业模式（影响产品决策的部分）

- 用户在 `token.u-studio.cn` 后台买 token / 充值
- 桌面客户端启动时让用户填 token（U Studio 平台 token，不是 Anthropic Key）
- 所有 LLM 调用计费在 newapi 后台完成
- **桌面客户端本身不做计费、不做支付**——这是中转站的职责

这个分工决定了：
- 桌面端不需要内置购买流程
- 桌面端"剩余余额""消费记录"这类信息可以**可选地**通过 newapi API 拉取展示（M2 再考虑）

---

## 命名与术语（中文版）

| 英文（上游）| 中文（U Agents） | 备注 |
|---|---|---|
| **Craft Agents**（上游名）| —— | 仅在合规署名场景出现（如 LICENSE / NOTICE / About 中"Based on Craft Agents"），**不得**作为产品别名展示 |
| **U Agents**（产品名）| 优智体 | 桌面应用品牌；用户可见界面中**统一**替换上游 "Craft Agents" 字面量 |
| U-API | U-API | 中转站品牌名（保留英文，与 token.u-studio.cn 后台一致） |
| Workspace | 工作空间 | 暂定 |
| Session | 会话 | |
| Source | 资源 / 数据源 | 待定 |
| Skill | 技能 | |
| Permission Mode | 权限模式 | |
| MCP Server | MCP 服务器 | 保留英文缩写 |
| Automation | 自动化 | |
| Token（中转站）| Token | 保留英文，与 newapi 后台一致 |
| LLM Connection | AI 连接 | 用户视角 |

最终术语表见 `.planning/10-i18n-zh.md`。

---

## 决策原则

遇到上游与本文冲突时：

1. 涉及**法律 / 商标 / 品牌**：以 `LEGAL.md` 为准
2. 涉及 **LLM 入口锁定**：以 `.planning/02-llm-gateway-spec.md` 为准
3. 涉及**功能取舍**：以本文 + `.planning/04-feature-cuts.md` 为准
4. 其他技术细节：跟随上游
