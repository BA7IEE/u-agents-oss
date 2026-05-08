# 04 — 功能裁剪清单

> 上游有但 U Agents 用户**不该看见**的功能。AI 修改任何 onboarding/设置/菜单时必读。
> 与 `03-ui-lockdown-spec.md` 配套阅读：本文管"裁什么"，03 管"具体怎么改 UI"。

---

## 裁剪原则

1. **代码可保留，UI 必须隐藏**——尽量少删上游代码（保上游同步），改用 feature flag / 注释入口的方式让用户看不见
2. **删除入口，不删后端**——例如 OAuth Source 的"添加流程"删掉，但已存在的连接仍能工作（保留逃生口）
3. **每个裁剪必须能用 grep 验证**——参考 `09-test-checklist.md` 的 UI 锁定项
4. **裁剪是单向的**——不主动加回。即使上游改进了"添加 Bedrock"流程，我们也不放出来

---

## 第一类：LLM Provider 入口（必裁）

U Agents 不允许任何"添加新 LLM Provider"的用户路径，只保留 U-API 一个。

### 1.1 Onboarding "选择 Provider" 步骤

**位置**：`apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`

**当前选项**（5 个，全部裁掉/合并）：

| Provider | 上游 ID | 处理 |
|---|---|---|
| Claude Pro/Max | `claude` | ❌ 隐藏入口（不路由 / 不渲染）|
| ChatGPT Plus (Codex OAuth) | `chatgpt` | ❌ 隐藏入口 |
| GitHub Copilot OAuth | `copilot` | ❌ 隐藏入口 |
| Anthropic / Bedrock / OpenRouter / Google API key | `api_key` | ❌ 隐藏入口 |
| 本地模型 (Ollama) | `local` | ❌ 隐藏入口 |

> 处理方式与本文 §1.2/§2/§4 一致：**保留代码不删，仅 UI 隐藏**。详见 `04-feature-cuts.md` 顶部"裁剪原则"第 1 条。

**M1 决策（首选直接跳过）**：

| 方案 | M1 决策 |
|---|---|
| **首选 ✅**：状态机从 `welcome` 直接跳到 `credentials`，**不渲染** ProviderSelectStep | 这是 M1 默认实现 |
| 次选（仅当首选有实现障碍）：保留单卡片视觉步骤，仅显示 "U-API" 一项 | 单卡片**不得**出现任何第三方 provider 字样 |

> 选首选可避免改动 `ProviderSelectStep.tsx` 组件本身（详见 `03-ui-lockdown-spec.md` §1.3 "组件可以不动，永远不被路由到"），从而**不增加上游同步冲突**。

**实现细节** → `03-ui-lockdown-spec.md` §1.2-§1.3（`useOnboarding.ts` 主状态机改造 + `OnboardingWizard.tsx` 渲染兜底 + ProviderSelectStep 加注释保留代码）。

### 1.2 Onboarding "API Key Setup" 步骤

**位置**：`apps/electron/src/renderer/components/onboarding/APISetupStep.tsx`（287 行）+ `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`（**814 行**——是上游"多 provider 支持"复杂度的最大集中点）

**已知 provider**（来自 `packages/shared/src/config/models-pi.ts` + `packages/server-core/src/domain/connection-setup-logic.ts:173-190` 的 `PI_AUTH_PROVIDER_DISPLAY_NAMES`）：

> ⚠️ **执行前必以代码实时扫描结果为准**——上游会持续新增 provider。下面表格是写文档时的快照，不是权威源。

实时扫描命令：
```bash
# 抓取所有已知 piAuthProvider key
grep -oE "'[a-z][a-z-]+'" packages/server-core/src/domain/connection-setup-logic.ts \
  | sort -u | grep -v -E "^'(open|close|true|false|none)'"
```

**已知列表如下，数量以上游实时扫描结果为准**（上游会持续新增 provider；下表是写文档时的快照，不是权威源）。**全部裁剪**：

| Provider | piAuthProvider 值 | 处理 |
|---|---|---|
| Anthropic 直连 | `anthropic` | ❌ 隐藏入口 |
| OpenAI | `openai` | ❌ |
| OpenAI Codex (ChatGPT Plus) | `openai-codex` | ❌ |
| Google AI Studio | `google` | ❌ |
| OpenRouter | `openrouter` | ❌ |
| Azure OpenAI | `azure-openai-responses` | ❌ |
| Amazon Bedrock | `amazon-bedrock` | ❌ |
| Groq | `groq` | ❌ |
| Mistral | `mistral` | ❌ |
| xAI (Grok) | `xai` | ❌ |
| DeepSeek | `deepseek` | ❌ |
| GitHub Copilot OAuth | `github-copilot` | ❌ |
| Google Vertex | `google-vertex` | ❌ |
| Google Gemini CLI | `google-gemini-cli` | ❌ |
| Google Antigravity | `google-antigravity` | ❌ |
| Cerebras | `cerebras` | ❌ |
| z.ai | `zai` | ❌ |
| Hugging Face | `huggingface` | ❌ |
| Minimax | `minimax` | ❌ |
| Minimax CN | `minimax-cn` | ❌ |
| Kimi (Coding) | `kimi-coding` | ❌ |
| Vercel AI Gateway | `vercel-ai-gateway` | ❌ |

**裁剪原则不变**：UI 一律不暴露，代码可保留以减少同步冲突。每次同步上游必须用上面的 grep 命令扫一遍——若有新 provider，**默认裁剪 + 在本表追加**。

**保留**：`pi_compat`（custom endpoint）一种，且锁定为 `u-api-default` 一个连接。

**实现路径**：把 `ApiKeyInput.tsx` 改造为只渲染我们的 U-API 输入（Token + 协议二选一），其他 provider 的 UI 分支用 `if (false)` 注释或抽到 dead code 路径。

> ⚠️ **不要直接删除其他 provider 的代码分支**——上游改进 `ApiKeyInput.tsx` 时差异会非常大；保留分支并加 `// U-API: hidden` 标记，同步时只需 review 标记区即可。

### 1.3 设置页 "Add Connection"

**位置**：设置 → AI Connections（具体文件待 03 定位）

**M1 v0.9.1 软锁定（多连接版本，自 commit `8ebe8c0` 之后修订）**：
- **保留**"Add new connection"按钮——点击后弹出与 onboarding 一致的 U-API 表单（Token + 协议 + 模型 ID），**不弹 provider 选择菜单**。新连接 slug 由 `resolveSlugForMethod` 生成 `u-api-2`/`u-api-3`...
- 已有连接列表显示**所有 U-API 连接**（`isUApiSlug(slug)` 判定，详见 `02-llm-gateway-spec.md` §6.2.2）；启动时 `enforceUApiBaseUrl` 强制重置每个连接的 baseUrl/providerType/authType
- "Default connection" 选择器**保留**——用户在所有 U-API 连接里选默认
- 删除连接按钮：多连接时可点击；最后一个 U-API 连接 disabled
- 编辑现有连接时：隐藏 baseUrl 输入框、隐藏 providerType 切换；只保留 Connection name / 协议二选一 / 模型管理 / Token

> **为什么允许多连接但仍称"软锁定"**：所有连接的 baseUrl/providerType/authType 都强制锁死指向 `token.u-studio.cn/v1` + `pi_compat`，CLAUDE.md §3.1 LLM 入口锁定不变。允许多连接是为了支持"用户为不同模型买不同 Key"的真实用例（部分国产模型在 newapi 上需要单独 Key），与"接入第三方渠道"无关。

### 1.4 Local Model 步骤

**位置**：`apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx`

**裁剪**：整个步骤永远跳过/不渲染。代码保留，路由不到。

### 1.5 OAuth Connect 组件

**位置**：`apps/electron/src/renderer/components/apisetup/OAuthConnect.tsx`

**裁剪**：从 onboarding/设置入口移除。代码保留（M3 自建 relay 后可能复用）。

---

## 第二类：自动安装/分发脚本（必裁）

### 2.1 一键安装脚本

**位置**：
- `scripts/install-app.sh`
- `scripts/install-app.ps1`

**问题**：这两个脚本里硬编码了 `https://agents.craft.do/install-app.sh`，会把用户引到 Craft 官方分发渠道。

**裁剪决策（首选：不发布）**：
- M1 阶段**不**通过这两个脚本分发——用户从 `u-agents.u-studio.cn` 官网直接下载安装包
- 在官网、README、发版产物中**不引用**这两个脚本
- 发版时**不要使用** `build-dmg.sh` / `build-linux.sh` 的 `--script` 上传参数；该参数会把 `scripts/install-app.sh` 上传到更新/下载渠道，等同于发布旧安装脚本
- **不主动删除**——保留代码可减小上游同步冲突
- 如执行 AI 判断"必须删除以避免品牌泄露"（如 README 写法不便、CI 自动暴露等），**单独开任务确认后再删**，不要在常规改造里顺手 `rm`

### 2.2 安装服务器脚本与 Server 模式

**位置**：
- `scripts/install-server.sh`
- `Dockerfile.server`
- `package.json` 中的 `server:start` / `server:build` / `server:prod` 等脚本

**裁剪决策（首选：不发布）**：
- M1 阶段**整个 server 模式都不发布**
- 不构建 Docker 镜像、不公开 install-server 脚本
- 上述文件**全部保留不动**——它们对 Electron 桌面端没有运行时影响，删除会显著增加上游同步冲突
- M2 评估是否要做 Web 部署版时再决定取舍
- 如执行 AI 判断必须删除（如 CI 默认会构建 server 镜像并发布等），**单独开任务确认后再删**

> 原则：删除是**单向破坏性动作**。M1 阶段没有"必须删"的硬理由——只要"不发布、不引用、不暴露"就达成了产品目标。

---

## 第三类：菜单/帮助链接（必裁）

### 3.1 菜单中的 craft.do 链接（4 处）

| 文件 | 行 | 当前链接 | 处理 |
|---|---|---|---|
| `apps/electron/src/renderer/components/AppMenu.tsx` | 272 | `agents.craft.do/docs` | M1：替换为 `u-agents.u-studio.cn/docs`（即使返回 404）|
| `apps/electron/src/renderer/components/app-shell/TopBar.tsx` | 329 | 同上 | 同上 |
| `apps/electron/src/renderer/components/app-shell/TopBar.tsx` | 477 | 同上 | 同上 |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 560 | `agents.craft.do/docs/go-further/sharing` | M1：替换为 `u-agents.u-studio.cn/docs/sharing` |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 574 | 同上 | 同上 |
| `apps/electron/src/main/menu.ts` | 237 | `agents.craft.do/docs` | M1：同 3.1 |

> M1 阶段允许文档站返回 404，但**链接必须是我们的域名**——否则用户点击会暴露上游品牌。

### 3.2 关于页 / Welcome / Help 中的 "Craft" 文案

**位置**：散落在 `apps/electron/src/renderer/components/app-shell/`、`apps/electron/src/renderer/components/onboarding/WelcomeStep.tsx` 等。

**裁剪**：通过 `01-branding-spec.md` §5（i18n 替换）+ §6（注释保留事实陈述）处理，不在本文细列。

---

## 第四类：上游"Craft 自家"的内置 Source（必裁）

### 4.1 Craft MCP 内置 Source

**位置**：`packages/shared/src/sources/builtin-sources.ts:47`、`packages/shared/src/agent/claude-agent.ts:852`、`packages/session-mcp-server/src/index.ts`、`packages/shared/src/utils/toolNames.ts`、`packages/shared/src/docs/source-guides.ts`、`packages/shared/src/sources/storage.ts`、以及 mode/source/pre-tool/prerequisite 相关白名单。

**说明**：上游内置了一个 "Craft Documents MCP"（指向 `agents.craft.do/docs/mcp`）作为快速 Source 入口，对接 Craft 自家的笔记产品。它不只是一个 URL 常量：session MCP server 会连接上游 docs MCP、把 docs tools 合并进工具列表，并在 call tool 时代理到上游。

**裁剪决策（Round 43 后统一口径：M1 完全裁剪，不替换为自建 MCP）**：

| 文件 | 操作 | 备注 |
|---|---|---|
| `builtin-sources.ts` | 当前 `getBuiltinSources()` 返回空、`isBuiltinSource()` 返回 false，运行时已不作为默认 Source 注入；但 deprecated `getDocsSource()` placeholder 仍含 `craft-agents-docs` / Craft Documents MCP 字面量，需删除或中性化。 | 不替换为 `u-agents` docs MCP |
| `claude-agent.ts:852` | 从 servers 字典、system prompt 引导、工具说明中移除 `'craft-agents-docs'`。 | 避免 AI 继续调用 Craft 文档 MCP |
| `session-mcp-server/src/index.ts` | 禁用 `DOCS_MCP_URL`、`connectDocsUpstream()`、`docsTools` 合并、`isDocsUpstreamTool(name)` 分流、`callDocsUpstream(...)` 代理整条路径；不得保留可启动的 Craft docs server。 | 保留常量本身只允许作为死代码/同步锚点，不得进入运行路径 |
| `packages/shared/src/utils/toolNames.ts` | 删除或中性化 `SearchCraftAgents` 工具显示名映射。 | 防止工具列表/权限 UI 仍显示 Craft docs 工具 |
| `packages/shared/src/docs/source-guides.ts` | 删除 `mcp__craft-agents-docs__SearchCraftAgents(...)` 示例和 craft-agents-docs 使用引导。 | 防止 AI prompt 继续建议调用 Craft 文档 MCP |
| `packages/shared/src/sources/storage.ts` | 清理 `getSourcesBySlugs()` / `loadAllSources()` 中关于 builtin `craft-agents-docs` 的注释和死分支；当前因 `isBuiltinSource()` 恒为 false 不会运行，但不得留下可被上游同步误复活的旧路径。 | 防止未来上游改回 builtin source 时无声复活 Craft docs |
| `mode-manager.ts` / `source-manager.ts` / `pre-tool-use.ts` / `prerequisite-manager.ts` / `SessionManager.ts` | 移除 `craft-agents-docs` 的隐藏白名单、工具显示名映射、豁免和 prerequisite 分支。 | 防止“UI 看不到但工具仍可调用” |

> M1 不自建 docs MCP，因此不要把 URL 改成 `u-agents.u-studio.cn/docs/mcp`。若 M3 需要文档 MCP，届时单独写新规格。

### 4.2 mcp.craft.do URL 校验器

**位置**：`packages/shared/src/validation/url-validator.ts`（27-42 行）

**说明**：上游对 `mcp.craft.do/links/...` 格式做了硬编码合法性校验，用于自家 MCP 链接的反钓鱼防护。代码对照后确认：这个文件当前更偏向 Craft MCP 链接专用校验，不是全局 URL safety 防线；通用 URL 安全逻辑还分布在 `packages/shared/src/utils/url-safety.ts`、OAuth callback、deeplink/open-url handler 等路径。

**裁剪决策**：
- **首选**：禁用 craft-mcp 专用校验路径（直接 return null 或 `if (false)` 包住），不删函数本身
- **必须保留**：`url-safety.ts` / callback / deeplink/open-url handler 中的通用 URL 校验逻辑（如 `https://` 协议检查、subdomain attack 防护等）
- **末选**：删除 craft-mcp 专用函数及其调用点；仅当确认该函数不承载通用安全校验时才可做，且删除前必须单独确认

### 4.3 Source guides 中的 Craft 引导

**位置**：`packages/shared/src/docs/source-guides.ts:176`

**说明**：第 176 行有一个 `craft: 'craft.do'` 的引导 entry，告诉 AI"用户问到 Craft 笔记时，去 craft.do 找 API 文档"。

**裁剪决策**：
- **首选**：从字典中移除 `craft` key（这是数据项，移除一个 key 比删整个文件低风险）
- **不需要**：保留 craft 引导对 U Agents 用户没意义，也不会被 AI 触发，可放心移除

---

## 第五类：上游业务相关字符串（建议裁）

### 5.1 System prompt 中的 Co-Authored-By

**位置**：`packages/shared/src/prompts/system.ts:570`

**当前**：
```
Co-Authored-By: Craft Agent <agents-noreply@craft.do>
```

**裁剪**：替换为 `Co-Authored-By: U Agents <agents@u-studio.cn>`（详见 `01-branding-spec.md` §2.12）。这是 AI 生成 git commit 时附带的署名。

### 5.2 i18n 中的 "Craft" 字面量

详见 `10-i18n-zh.md`，本文不重复。

---

## 第六类：保留但需要标注的"已知瑕疵"

### 6.1 OAuth relay 仍走 craft.do

**位置**：
- `packages/shared/src/auth/oauth-relay.ts`
- `packages/shared/src/auth/slack-oauth.ts`

**M1 决策**：**保留不动**（用户已接受瑕疵，详见 `LEGAL.md` §5.1）。
**M3 决策**：自建 relay 后替换。

**做的事**：在帮助文档（`u-agents.u-studio.cn/docs/...`）里说明"首次添加 Slack/Gmail 等需要 OAuth 的 Source 时，浏览器会短暂跳转中转域名，正常现象"。

### 6.2 SDK 头部中的 User-Agent

**位置**：Claude Agent SDK 内部，可能含 "claude-agent-sdk" 等字样。

**M1 决策**：不动——这是 SDK 标识，不是 Craft 品牌。

---

## 第七类：会话分享 UI（M1 必裁，M3 自建后放开）

### 7.1 决策背景

PRODUCT.md M1 必须有原本列了"会话分享"，但实际启用需要：
- 自建 viewer 服务（域名、HTTPS、静态 hosting）
- 自建会话 JSON 存储后端（R2/S3）
- 隐私/合规审视（用户分享的会话可能含敏感对话）

M1 阶段不做这套基础设施，因此**必须把 UI 入口隐藏**——否则用户点了分享按钮、链接走 `agents.craft.do/s/...`，直接破白标。

### 7.2 裁剪范围

需要由执行 AI 在改造时定位并隐藏（grep 关键字：`share`、`Share`、`分享`、`createShare`、`shareSession`）：

| 入口 | 隐藏方式 |
|---|---|
| ChatPage 工具栏 / 会话顶部的"分享"按钮 | CSS `display:none` 或条件渲染 `false` |
| 会话列表右键菜单中的"分享" | 同上 |
| 命令面板（Cmd+K 等）中的 "Share session" 命令 | 从命令注册表移除 |
| 设置页/快捷键页中关于分享的描述 | 隐藏 |
| Onboarding / Welcome 文案中提到"分享给同事"等 | 改为不提分享 |

> ⚠️ **不要删除分享相关代码**——只隐藏 UI 入口。M3 自建 viewer 后会重新启用，删除会增加 M3 反向恢复成本和上游同步冲突。

### 7.3 与 craft.do 分享 URL 的连带关系

`packages/shared/src/branding.ts` 的 `VIEWER_URL` 已经在 `01-branding-spec.md` §2.3 改成 `https://u-agents.u-studio.cn`。M1 阶段即使隐藏了 UI 入口，VIEWER_URL 也保持改为我们的域名——防止上游加新代码路径时误用 craft.do。

### 7.4 验收

详见 `09-test-checklist.md` §11。

---

## 第八类：开发期工具（不需要裁，但要确认不打入产物）

| 工具 | 处理 |
|---|---|
| `apps/electron/src/renderer/playground/` | 开发期 UI 沙箱，生产构建不打入（已在 `electron-builder.yml` 排除）|
| `scripts/browser-tool.ts` | 开发工具，不影响产物 |
| ~~`scripts/fresh-start.ts`~~ | **当前 OSS 工作区不存在该文件**（上游 OSS 版剥离）；但 `package.json` `scripts.fresh-start` + i18n 文案 `menu.resetToDefaultsDetail` 仍引用它。处理：把 i18n 文案改写（详见 `10-i18n-zh.md` §6.1），不要把它当作可用工具 |
| `apps/online-docs/` | 上游文档站源码，已在 workspace 中排除 |

---

## 第九类：Browser Tool（默认关闭，但保留 toggle）

> v24 review G1.F4.1 决策（2026-05-07）：v0.9.2 上游引入 `getBrowserToolEnabled()` 完整 gate（system prompt + prerequisite + rule），但 default = `true`。U Agents 选择**默认关闭**——既不删 UI 也不删代码，仅改默认值。

### 9.1 决策背景

`browser_tool` 让 AI 可以打开内置浏览器、控制网页：
- click / type / fill / scroll / screenshot
- `javascript_exec` 可执行任意 JS
- 配合 LLM 可做"AI 帮我搜资料 / 订外卖"等场景

**对 U Agents 的安全考量**：
- LLM 控制浏览器是非常大的攻击面（恶意页面可作为 prompt injection 入口）
- PRODUCT.md 目标用户"非技术 / 半技术"——他们大概率不会用，但容易被攻击
- 与 [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md) "默认安全"原则一致

**对 U Agents 的产品考量**：
- browser tool 是上游差异化能力，不应粗暴删除（M3 自建 sandbox 后可重启）
- Settings → Tools 仍保留 toggle，高级用户可主动开启
- 与 §3.4 "代码保留 + UI 保留 + default 关闭"原则一致

### 9.2 落地

| 文件 | 改动 |
|---|---|
| [`apps/electron/resources/config-defaults.json:13`](../apps/electron/resources/config-defaults.json) | `"browserToolEnabled": true` → `false` |
| [`packages/shared/src/config/storage.ts:131`](../packages/shared/src/config/storage.ts) | hardcoded fallback `browserToolEnabled: true` → `false`（加 `// U-API:` marker）|

**保留不动**：
- [`AppSettingsPage.tsx:233-243`](../apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx) Settings → Tools section 的 `builtInBrowser` toggle（用户可主动启用）
- 所有 browser_tool 相关代码（`browser-cdp.ts` / `browser-pane-manager.ts` / `session-scoped-tools.ts`）— 用户开启后正常工作
- system prompt browser tools section 已被 `getBrowserToolEnabled()` 完整 gate（v0.9.2 上游 fix）— 默认 false 时不进 prompt

#### 9.2.1 i18n 文案重写（**v27 review O1 P0**）

**问题**：v0.9.2 上游 i18n 描述文案为「**禁用** if 使用外部浏览器工具」——这是上游默认 `true` 的语境下写的（"已开启状态下你想关掉吗？"）。U Agents 改默认为 `false` 后，这句话变成**逆逻辑**：用户看到 toggle 是关的，描述却说"禁用 if..."——**用户搞不清楚这个 toggle 当前是开还是关、要不要点**。

**P0 要求 — 重写 zh-Hans 文案 + 加风险提示**：

| i18n key | 当前（上游 v0.9.2 直译）| **U Agents 重写后** |
|---|---|---|
| `settings.tools.builtInBrowser` | `内置浏览器` | `内置浏览器（实验功能）` |
| `settings.tools.builtInBrowserDesc` | `如果使用外部浏览器工具 (如 Playwright、Puppeteer 或浏览器 MCP 服务器) 则禁用。` | `**默认关闭。**开启后 AI 可以打开内置浏览器、点击网页、填表单、执行 JavaScript。⚠️ 这是一个高权限工具——恶意网页可能通过 prompt injection 操纵 AI 做你不想做的事。仅在你明确知道在做什么、且信任当前会话上下文时启用。` |

**修改文件**：[`packages/shared/src/i18n/locales/zh-Hans.json:1028-1029`](../packages/shared/src/i18n/locales/zh-Hans.json)

**为什么不改 en.json**：
- 上游同步会持续更新 en.json，我们改 en 等于每次同步都要 conflict resolve
- 中文用户是 U Agents 主要受众（PRODUCT.md），en 用户多半是开发者，能看懂上游原始文案
- 风险提示在 zh-Hans 里足够保护非技术中文用户

**与 §3.7 marker 的关系**：i18n value 改动**不加 marker**——i18n 改动通过 `01-branding-spec.md` § i18n 全表登记，不计入 §3.7 baseline。但每次同步上游必须确认 zh-Hans.json 我们的重写未被覆盖（grep `内置浏览器（实验功能）`，应找到 1 处）。

**验收**（加进 09-test-checklist §13.x）：
1. 中文 UI 进 Settings → Tools → 看 builtInBrowser toggle
2. 应显示「内置浏览器（实验功能）」+ 描述含 ⚠️ 警告 + "默认关闭" 字样
3. 描述应**正向描述**（"开启后 AI 可以..."）而非"禁用 if..."逆逻辑

### 9.3 验收

- [ ] 首次启动 U Agents（无 `~/.u-agents/config.json`）→ `getBrowserToolEnabled()` 返回 `false`
- [ ] 默认 system prompt 不含 `## Browser Tools` 章节
- [ ] 默认 prerequisite-manager 的 browser tool rule 是 no-op
- [ ] 用户在 Settings → Tools 切换 toggle 为 ON → 写入 `config.browserToolEnabled = true` → 下次启动 system prompt 含 browser tools section
- [ ] 单元测试 `m2-security-regression.test.ts` 或类似回归测试 assert 默认值 = false

### 9.4 与上游同步影响

- 上游每次同步若改 `config-defaults.json` 或 `storage.ts:131` 默认值——必须保留我们的 `false`
- 加 `// U-API:` marker 防 git auto-merge 吞掉决策（§3.7 #46 登记）
- C10 模式不适用（browser tool 不是 connection 字段）

---

## 验收：裁剪是否到位

详细 grep 验证清单见 `01-branding-spec.md` §8。本文裁剪是否到位的判定：

- [ ] 启动应用 → onboarding 不出现 Anthropic/OpenAI/Bedrock/Vertex/Copilot/Codex/Ollama 等字样
- [ ] 设置页 AI Connections 区首装机后只有 1 个 U-API 连接；用户可通过"Add new connection"添加更多 U-API 连接（每个连接 baseUrl/providerType 都锁死，详见 `02-llm-gateway-spec.md` §6.2.1）
- [ ] **能看到** "Add new connection" 按钮，且点击后弹出 U-API 表单（不弹 provider 选择菜单）
- [ ] Sources 列表里搜不到 "Craft Documents MCP" 类内置项
- [ ] Help 菜单中所有链接打开后不出现 craft.do 域名（M1 允许返回 404，但 URL 必须是 u-studio.cn）
- [ ] **最终发布产物**（DMG / EXE / AppImage）、官网下载页、README、更新服务器索引中**不包含、不引用** `install-app.sh` / `install-app.ps1` / `install-server.sh` / `Dockerfile.server`；**源码仓库中保留这些文件可接受**（详见 `04-feature-cuts.md` §2.1-§2.2）
- [ ] git commit 模板中 Co-Authored-By 不含 craft.do
