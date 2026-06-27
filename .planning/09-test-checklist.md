# 09 — 发版前回归测试清单

> 给"用户"自己测的清单——不是给 AI 的（AI 在本仓库内只负责文档，详见 `CLAUDE.md` §0）。
> 每次发版前**亲自照做一遍**。

---

## 0. 测试环境准备

需要 **两台**（或两个用户账户）：

| 角色 | 用途 |
|---|---|
| **干净机器**（或新建 macOS 用户账号）| 测全新安装 |
| **已装机**（装着 N-1 版本的）| 测自动更新 |

如果只有一台机器，可以：
- 在 macOS 上 "系统偏好设置 → 用户与群组" 新建一个测试用户
- 或用 Docker / OrbStack 跑测试 VM

每次测试前**清空**应用数据。

⚠️ **重要**：上游 craft-agents-oss 把配置目录放在 `~/.craft-agent`（来自 `paths.ts:19`），**不是** macOS 标准的 `~/Library/Application Support/`。我们在 M1 任务 #23 里把这个常量改成了 `~/.u-agents`（详见 `01-branding-spec.md` §2.15）。

下面命令分两套——M1 改造**前**测试用一套（清 craft-agent），改造**后**用另一套（清 u-agents）。

#### 改造完成前（开发期、未跑过 paths.ts 改造任务）

```bash
# macOS
rm -rf ~/.craft-agent
rm -rf ~/Library/Caches/Craft\ Agents-updater
rm -rf ~/Library/Logs/Craft\ Agents
rm -rf ~/Library/Preferences/com.lukilabs.craft-agent.plist
defaults delete com.lukilabs.craft-agent 2>/dev/null

# Windows
# %USERPROFILE%/.craft-agent
# %LOCALAPPDATA%/Craft Agents-updater

# Linux
# ~/.craft-agent
# ~/.cache/Craft Agents-updater
```

#### 改造完成后（M1 任务 #23 完成、跑过 paths.ts 重命名后）

```bash
# macOS
rm -rf ~/.u-agents
rm -rf ~/Library/Caches/U\ Agents-updater
rm -rf ~/Library/Logs/U\ Agents
rm -rf ~/Library/Preferences/cn.u-studio.u-agents.plist
defaults delete cn.u-studio.u-agents 2>/dev/null

# Windows
# %USERPROFILE%/.u-agents
# %LOCALAPPDATA%/U Agents-updater

# Linux
# ~/.u-agents
# ~/.cache/U Agents-updater
```

> 注意 macOS 的 `~/Library/Caches/<productName>-updater` 由 electron-updater 决定（productName-based），所以改造后是 `U Agents-updater`（带空格）；而主配置目录由我们 fork 的 `paths.ts` 决定，是 `~/.u-agents`（连字符）。两个不一致是上游设计，沿用即可。

---

## 1. 安装与签名（macOS 重点）

### 1.1 通用项（所有阶段）

- [ ] 双击 `U-Agents-arm64.dmg` 能正常打开
- [ ] DMG 标题栏显示 "U Agents"（**不是** "Craft Agents"）
- [ ] DMG 背景图是我们的，不是 Craft 的
- [ ] 拖动到 Applications 后，应用图标是 U Agents 的（不是 Craft 的）
- [ ] 应用窗口标题栏显示 "U Agents"
- [ ] Dock 中的图标是 U Agents 的

### 1.2 M1 阶段（adhoc 签名，**预期被 Gatekeeper 拦截一次**）

- [ ] 首次双击启动，**应当**看到"无法验证开发者"警告（这是预期行为）
- [ ] 按官网/帮助文档的"首次启动指引"操作：
  - macOS 13+：系统设置 → 隐私与安全性 → "仍要打开"
  - macOS 12-：右键 → "打开"
- [ ] 操作后能正常进入 Welcome 页
- [ ] 第二次双击启动**不再**被拦截（直到下次自动更新）
- [ ] 自动更新装新版本后，再次启动**预期会被拦一次**（这是 adhoc 签名的固有问题，M2 公证后消除）

**严格配置 fallback 场景**（少数 macOS 13+ 严格安全配置 / 企业 Mac 会遇到 hardenedRuntime + adhoc 兼容问题）：
- [ ] "右键打开 / 系统设置允许" **均失败**时，验证 fallback 命令能解决：
  ```bash
  xattr -dr com.apple.quarantine /Applications/U\ Agents.app
  # 上面提示 Operation not permitted 时：
  sudo xattr -dr com.apple.quarantine /Applications/U\ Agents.app
  ```
- [ ] 跑完 fallback 命令后双击能正常启动
- [ ] 详细文案在 `05-build-release.md` §3.2.3 和官网下载页同步展示

### 1.3 M2 阶段（正式签名 + 公证）

- [ ] 首次双击启动，**不应**出现 Gatekeeper 警告
- [ ] 自动更新装新版本后，**也不应**被拦截
- [ ] 终端跑 `spctl -a -t exec -vv /Applications/U\ Agents.app` 输出含 "accepted" 与 "source=Notarized Developer ID"

> 任何一项失败 → 检查 `electron-builder.yml` + `apps/electron/resources/icon.*` + 打包流程（`05-build-release.md` §3）。

---

## 2. Onboarding 流程（关键锁定测试）

- [ ] 启动后看到 Welcome 页
- [ ] (Windows 才有) Git Bash 警告页
- [ ] **不出现** "Choose your provider" 多卡片选择页
- [ ] **不出现** Anthropic / OpenAI / Bedrock / Vertex / Copilot / Codex / Ollama / Mistral / DeepSeek / Groq / xAI 等品牌字样
- [ ] 直接进入 Token 输入页
- [ ] 输入框旁有 "获取 Token" 链接，点击后浏览器打开 `https://token.u-studio.cn/keys`
- [ ] 输入框旁有 "充值" 链接，点击后浏览器打开 `https://token.u-studio.cn/console/topup`
- [ ] 协议二选一可见：OpenAI Chat Completions / Anthropic Messages
- [ ] 默认选项是 Anthropic Messages
- [ ] 输入空 Token 提交 → 显示校验失败提示
- [ ] 输入错误 Token 提交 → 显示 "Token 已失效" + "打开 Token 控制台"按钮
- [ ] **模型 ID 输入框可见**，预填 `gpt-5.5` 占位（可手动改成其他 model ID）
- [ ] 模型 ID **必填**——清空后提交按钮置灰/被前端拦截
- [ ] 输入正确 Token + 协议 + 至少 1 个模型 ID → 显示成功 → 进入 Completion 页
- [ ] Completion 页文案不含 "Craft" 字样
- [ ] 点 "完成" 进入主界面，主界面**不**显示"请先添加模型"空态（因为 onboarding 已添加 ≥1 个）

**反向验证**（确认上游 IPC 的硬约束起作用）：
- [ ] 跑测试时如果绕过前端拦截发空 models 数组到 IPC，应收到 error: `"Default model is required for compatible endpoints."`

详见 `03-ui-lockdown-spec.md` §5.1。

---

## 3. LLM 连接锁定（双重验证）

### 3.1 UI 锁定

- [ ] 设置 → AI Connections（或类似入口）只显示 1 个连接：U-API
- [ ] **找不到** "Add new connection" / "Add Provider" 按钮
- [ ] 点开 U-API 连接编辑器：
  - [ ] **不显示** baseUrl 输入框
  - [ ] **不显示** providerType 切换
  - [ ] 显示 API Key 输入框（已填）
  - [ ] 显示协议二选一（已选）
  - [ ] **不显示** 顶部 Banner 三链接（M1 改造时移除，详见 [`CLAUDE.md` §3.7 #13](../CLAUDE.md)）
  - [ ] **找不到** "删除连接" 按钮

### 3.2 配置篡改防护

操作（在终端跑，不在应用内）：

```bash
# 关闭应用
# 编辑配置文件
CONFIG="$HOME/.u-agents/config.json"  # M1 改造完成后的位置（详见 01-branding-spec.md §2.15）
# 把 baseUrl 改成 https://api.openai.com
# 加一个 slug 为 'anthropic-direct' 的连接
```

- [ ] 重启应用
- [ ] baseUrl 自动恢复为 `https://token.u-studio.cn/v1`
- [ ] 'anthropic-direct' 连接被自动删除

详见 `02-llm-gateway-spec.md` §10。

### 3.3 logout/reset 配置清理验证（Round 38 补遗）

> 验证 `packages/server-core/src/handlers/rpc/auth.ts` 已从 `CONFIG_DIR` 派生 config 路径，而不是继续删除旧 `~/.craft-agent/config.json`。

- [ ] 正常完成 onboarding 后，确认 `~/.u-agents/config.json` 存在
- [ ] 在应用内执行退出登录 / 重置到默认配置（以当前 UI 实际入口为准）
- [ ] 确认 `~/.u-agents/config.json` 被清理或重置为预期状态
- [ ] 确认不会只清理旧路径 `~/.craft-agent/config.json` 而留下真实 `~/.u-agents/config.json`
- [ ] 重启应用后必须重新进入 onboarding（不能带着旧 Token/连接直接进主界面）

### 3.4 配置目录统一验证（Round 39 补遗）

> 验证 #23 不只是改 `config.json`，而是把 workspace、credentials、bridge MCP cache 等运行时路径也统一到 `~/.u-agents`。

- [ ] onboarding 输入 Token 后，确认凭据文件写在 `~/.u-agents/credentials.enc`，不再新建 `~/.craft-agent/credentials.enc`
- [ ] 新建 workspace 后，默认 workspace root 在 `~/.u-agents/workspaces/`，不再新建 `~/.craft-agent/workspaces/`
- [ ] 添加/使用需要 credential cache 的 Source 后，确认 `.credential-cache.json` 位于 `~/.u-agents/workspaces/<workspaceId>/sources/<sourceSlug>/` 下
- [ ] 测试过程中执行 `find ~/.craft-agent -maxdepth 3 -type f`：除非是手动残留旧数据，否则 M1 新装流程不应生成新文件

---

## 3.5 后端 setup 流程验证（**必须**——验 #17b 改造产物）

> 验证 `BUILT_IN_CONNECTION_TEMPLATES` + `apiSetupMethodToConnectionSetup` 改造**真的接入**了。
> 没这一节，外部 AI 改了代码但没真接入时 onboarding 提交会报 `Unknown built-in connection slug: u-api-default`。

### 3.5.0 ⚠️ 启动时不应跳过 onboarding（**P0 验收：state.ts U-API 特判生效**）

- [ ] 在干净环境装 M1 包（`~/.u-agents/` 不存在）
- [ ] 启动应用 → **必须**进入 onboarding 流程，**不应**直接进入主界面
- [ ] 验证：即使 `enforceUApiBaseUrl` 注入了骨架（`u-api-default` + 固定 `baseUrl`；骨架可为 `models: []` / 无 `defaultModel`），由于 `credentials.enc` 中**没**该 slug 的 API key，`getAuthState` 必须返回 `hasCredentials = false`，`isFullyConfigured = false`
- [ ] 反向验证：手动到 `~/.u-agents/config.json` 删掉所有连接 + 删掉 `credentials.enc`，重启 → 仍进 onboarding（不会因为骨架被注入而跳过）

### 3.5.1 onboarding 首次提交端到端

- [ ] 在干净环境装 M1 包，启动 → onboarding 输入 Token + 选协议 + 输入 model ID `gpt-5.5`
- [ ] 点击提交 → **不**报 `Unknown built-in connection slug` 错误
- [ ] **不**报 `Default model is required for compatible endpoints.` 错误
- [ ] **不**报 `Custom endpoint in Craft Agents Backend mode requires selecting a provider preset...` 错误（这是 `validateSetupTestInput` 旧逻辑会抛的；M1 必须扩展该函数让它接受 customEndpoint，详见 `02-llm-gateway-spec.md` §4.2）
- [ ] 进入 Completion 页 → 进入主界面
- [ ] 检查 `~/.u-agents/config.json`：
  - [ ] `llmConnections[0].slug === 'u-api-default'`
  - [ ] `llmConnections[0].providerType === 'pi_compat'`
  - [ ] `llmConnections[0].baseUrl === 'https://token.u-studio.cn/v1'`
  - [ ] `llmConnections[0].customEndpoint.api` 是用户选的协议
  - [ ] `llmConnections[0].piAuthProvider` 自动派生（`anthropic` 或 `openai`，根据 customEndpoint.api）
  - [ ] `llmConnections[0].models[0]` 是用户填的 model ID。**注意类型兼容**：上游 `validateModelList()` 接受 `string` 或 `{ id: string, ... }` 两种形态（详见 `packages/server-core/src/domain/connection-setup-logic.ts:257` + `packages/shared/src/config/validators.ts:89`）。M1 onboarding 只传 `string[]`，但**未来设置页可能扩成对象**——验收时按以下规则：
    - 若 `models[0]` 是 string → 直接等于用户填的 model ID
    - 若 `models[0]` 是对象 → 检查 `models[0].id` 等于用户填的 model ID
  - [ ] `llmConnections[0].defaultModel` 等于该 model ID（无论 models[0] 是哪种形态，defaultModel 都是平铺的 string）

### 3.5.2 设置页编辑触发降级测试

**用户级测试**（手动操作，必跑）：
- [ ] 在设置页**只**改 Token（不动协议）→ 点保存
- [ ] 检查 `~/.u-agents/config.json`：
  - [ ] `llmConnections[0].providerType` 仍是 `'pi_compat'`，**不**降级为 `'pi'`
  - [ ] `llmConnections[0].customEndpoint.api` 仍是用户原选的协议
- [ ] 在设置页**只**切换协议（不动 Token）→ 点保存
- [ ] 检查 `config.json`：`baseUrl` 仍是 `https://token.u-studio.cn/v1`（**没**被清空）

**代码 review 检查**（在改造完成后由 reviewer 跑）：
- [ ] grep 所有调用 `electronAPI.setupLlmConnection` / IPC `'settings:setupLlmConnection'` 的位置
- [ ] 验证：所有 U-API 路径在传 `setup.baseUrl` 时**始终**同时传 `setup.customEndpoint`
- [ ] 验证：`useOnboarding.ts:apiSetupMethodToConnectionSetup('u_api')` 的 case 包含 `customEndpoint` 字段（非 `undefined`）
- [ ] 验证：设置页 Save 流程的 `buildSetupPayload` 函数实现与 `03-ui-lockdown-spec.md` §2.2 伪代码一致

> "构造内部 IPC 请求"测试不在 09 范围内——09 是"用户/外部 AI 手动验收清单"。绕过 UI 直接发 IPC 的测试属于自动化测试范围（M2/M3 后再加）。
>
> 详见 `03-ui-lockdown-spec.md` §1.10 + §1.10.2.bis 设计约束。

---

## 4. 模型管理

### 4.1 正常路径（onboarding 后已强制有 1 个模型）

- [ ] **正常 onboarding 完成后**：模型列表已有至少 1 个模型（默认 `gpt-5.5` 或用户在 onboarding 改的 model ID）
- [ ] 默认模型 = onboarding 阶段填写的那个 model ID
- [ ] 进入主界面**不**显示"请先添加模型"空态
- [ ] 设置页"管理模型"区可见已添加的模型条目，能编辑显示名、能删除

### 4.2 设置页添加更多模型

- [ ] 设置页点"添加模型"按钮 → 弹窗
- [ ] 弹窗内有 model ID 输入框（必填）
- [ ] 弹窗内有显示名输入框（可选）
- [ ] 弹窗底部 3 个链接（pricing / console / topup）点击都能正确跳转
- [ ] 添加一个有效 model ID（如你 Token 套餐内的 `claude-sonnet-4-5` 或 `gpt-4o-mini`）→ 列表多一项
- [ ] 切换默认模型为新加的那个 → 设置页保存生效

### 4.3 边缘场景（用户手动删光所有模型）

- [ ] 设置页删光所有模型 → 模型列表变空
- [ ] 主界面**显示**"请先添加模型"空态卡片（这是 onboarding 后唯一会触发空态的路径）
- [ ] 点击空态卡片"添加模型"按钮 → 跳到设置页 + 自动展开"添加模型"弹窗
- [ ] 添加任意有效 model ID → 空态消失，可以正常发对话
- [ ] 添加一个不存在的 model ID（如 `nonexistent-model`）→ 保存可以，但发对话时返回 404 错误
- [ ] 删除模型按钮能用
- [ ] 至少添加 2 个模型，验证默认模型切换功能

---

## 5. 第一条对话

> ⚠️ **必须在 packaged app（装好的 `.app` / `.exe`，不是 dev / `bun run start`）里测** —— 事故 #1/#6（`piServerPath not configured`）**只在打包后暴露**：dev 模式 `resolveServerPath` 从 `packages/*/dist` 解析所以永远找得到，packaged 模式才从 `resources/` 找。每个平台打包后**至少真发一条消息**触发 pi subprocess spawn，**只测启动 = 测不出**（事故 #6 就是 macOS 长期只测启动漏过的）。
>
> **打包后 grep 防回归**（每平台必跑）：
> ```bash
> # macOS — 必须命中
> find "/Applications/U Agents.app" -path "*resources/pi-agent-server/index.js"
> find "/Applications/U Agents.app" -path "*resources/session-mcp-server/index.js"
> # Windows — dir /s /b "resources\pi-agent-server\index.js"（在解包目录）
> ```
> 命中 0 = 打包漏 subprocess server（事故 #1/#3/#6），**别发版**。根因排查见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0。

- [ ] **(packaged) 发首条消息不报 `piServerPath not configured`** —— 事故 #1/#6 防回归，三平台各测一次
- [ ] 创建新会话
- [ ] 用 anthropic-messages 协议 + Claude 模型发送 "hello"
- [ ] 收到响应（流式）
- [ ] 用 openai-completions 协议 + GPT 模型发送 "hello"（需要切协议或新建会话）
- [ ] 收到响应
- [ ] 切换权限模式（Explore / Ask to Edit / Auto）能用
- [ ] 上传一张图片（Claude 模型）→ 模型能识别
- [ ] 用工具调用（如 file 操作）能正常 tool_use 流转

---

## 6. Sources

### 6.1 MCP / API / 本地

- [ ] 添加一个本地 MCP（如 npx 启动的）→ 连接成功
- [ ] 在会话中 `@` mention 这个 source → 能看到工具
- [ ] 让 AI 调用一个工具 → 正常返回

### 6.2 OAuth Sources（已知瑕疵测试）

- [ ] 添加 Slack / Gmail / Outlook 类型的 Source
- [ ] 浏览器打开授权页时，**确认地址栏出现 `agents.craft.do`** —— 这是已知瑕疵（详见 `LEGAL.md` §5.1），不是 bug
- [ ] 完成授权后回到应用，连接成功
- [ ] 在会话中能正常使用该 Source 的工具

> M3 阶段自建 OAuth relay 后，这一项地址栏应改为 `u-agents.u-studio.cn`。

### 6.3 内置 Source 检查

- [ ] Sources 列表中**找不到** "Craft Documents MCP" 或类似 Craft 自家 Source
- [ ] 没有任何 Source 默认 URL 含 `craft.do` 字样
- [ ] 新建会话问 AI "What MCP servers do you have access to?"，回答中不出现 `craft-agents-docs` / `SearchCraftAgents`
- [ ] session MCP server 的工具列表不包含 docs upstream 工具；`connectDocsUpstream()` / `docsTools` / `callDocsUpstream(...)` 路径未进入运行时

---

## 7. Skills（技能）

- [ ] 创建一个新 Skill
- [ ] 给 Skill 写指令并保存
- [ ] 在会话中 `@` mention 这个 Skill → AI 能识别
- [ ] AI 按 Skill 指令执行任务

---

## 8. 自动化

- [ ] 创建一个简单 Automation（如基于会话状态变更）
- [ ] 触发条件 → Automation 创建新会话或执行动作
- [ ] 删除 Automation 能成功

---

## 9. 文件附件

- [ ] 拖放图片（PNG / JPG）→ 显示预览 → 发送给 AI
- [ ] 拖放 PDF → 自动转换为可读内容 → 发送
- [ ] 拖放 Word/Excel → 同上
- [ ] AI 能引用附件内容回答

---

## 10. 主题与 UI

- [ ] Light / Dark 主题切换能用
- [ ] Workspace 级主题覆盖能用
- [ ] 多文件 Diff 窗口能打开（需要 Auto 模式 + 文件操作触发）

---

## 11. 会话分享（**M1 隐藏功能**）

- [ ] 创建会话 → 工具栏 / 菜单中**找不到**"分享"按钮
- [ ] 命令面板 / 快捷键搜索"share"无结果
- [ ] 自动生成的会话内容、commit 提示词等也不出现 `https://agents.craft.do/s/...` 链接

> M1 阶段我们裁剪掉所有会话分享 UI 入口（详见 `04-feature-cuts.md` §7）。M3 自建 viewer 后再放开。

---

## 12. 菜单与帮助链接

- [ ] 顶部菜单 → Help / Docs → 浏览器打开 `https://u-agents.u-studio.cn/docs/...`（**不是** craft.do）
- [ ] 顶部菜单 → About（M1 阶段使用 macOS 原生 about 面板）→ 显示：
  - [ ] 应用名 "U Agents" / "优智体"（中文环境）
  - [ ] 当前版本号
  - [ ] **明文** `Based on Craft Agents (Apache 2.0)`（合规署名）
  - [ ] **明文** `https://github.com/lukilabs/craft-agents-oss`（用户可手动复制）
  - [ ] **明文** `Apache License 2.0 — see LICENSE in install directory`
- [ ] TopBar 显示 "U Agents"，**不显示** "Craft Agents"

> M1 不要求"链接可点击"——macOS 原生面板不支持。M2 自定义 About 对话框时再做可点击 + 内嵌 license 查看。详见 `LEGAL.md` §2 + `03-ui-lockdown-spec.md` §3.1。

---

## 13. 系统集成

- [ ] 应用名在 macOS 菜单栏显示 "U Agents"（cmd+tab、Activity Monitor 都看得到）
- [ ] 应用 Bundle ID 是 `cn.u-studio.u-agents`：
  ```bash
  defaults read /Applications/U\ Agents.app/Contents/Info.plist CFBundleIdentifier
  # 应输出 cn.u-studio.u-agents
  ```
- [ ] 通知中心显示发自 "U Agents"
- [ ] Dock 上右键应用 → 显示 "U Agents"

### 13.1 Deeplink / open-url 验证（Round 38 补遗）

- [ ] `uagents://` 链接能被系统注册并打开 U Agents
- [ ] `craftagents://` 不再作为 U Agents 的公开协议入口
- [ ] 在曾安装上游 Craft 包的测试机上验证旧 handler：点击 `craftagents://` 不应弹出/打开 U Agents；如系统仍残留旧注册，必须记录卸载/清理说明
- [ ] 应用内通过 `openUrl` 打开的内部 action 链接使用 `uagents://action/...`
- [ ] 日志、错误提示、allowlist 提示中不出现 `craftagents://` 或 `craftagents URLs are allowed`
- [ ] 对应自动化测试 `packages/server-core/src/handlers/rpc/system.open-url.test.ts` 的 fixture 已从 `craftagents://` 同步为 `uagents://`

### 13.2 DevTools / 内部事件协议验证（Round 39 补遗）

- [ ] 打开 DevTools，运行 `grep`/全局搜索确认 renderer 中不存在 `craft:` 事件名：`focus-input` / `restore-input` / `compaction-complete` / `insert-text` / `paste-files` / `submit-input` / `approve-plan` / `approve-plan-with-compact` 都已改为 `u-agents:*`
- [ ] 手动验证输入框 focus 恢复、附件粘贴、Save & Send、Accept Plan、Accept & Compact、compact 后继续执行都正常，防止事件单边改名导致断链
- [ ] in-app browser 访问任意网页后 inspect，页面 DOM 中不出现 `__craft_agent_screenshot_overlay__`
- [ ] DevTools/console 日志中不出现 `__craft_theme_color__:`；主题色提取仍正常（浏览器 pane 主题色/边框不退化）

### 13.3 打包资源 / 网络 UA 品牌残留验证（Round 40/41/42 补遗）

- [ ] `apps/electron/src/renderer/index.html` 的 `<title>` 已是 `U Agents`，DevTools / 辅助技术不再显示 `Craft Agents`
- [ ] `apps/electron/resources/permissions/default.json` 不再向用户展示 `craft-agent` 默认权限规则；若保留内部 command 名，必须确认 UI 不显示旧品牌 comment
- [ ] `apps/electron/resources/tool-icons/tool-icons.json` 不再显示 `displayName: "Craft Agent"`；若保留 entry，displayName 至少应为 `U Agents CLI`
- [ ] `apps/electron/resources/config-defaults.json` 的 description 已是 U Agents；`apps/electron/resources/themes/default.json` 与 `haze.json` 的 author 已改为 `U Studio` 或 `U Agents`
- [ ] `apps/electron/resources/AGENTS.md` 中同步目录说明已改为 `~/.u-agents/...`，不再指导 AI/执行者使用旧 `~/.craft-agent/...`
- [ ] renderer localStorage 前缀已按 §2.39 决策处理：新用户写入 `u-agents-*`；如保留兼容读取旧 `craft-*`，必须有迁移/清理说明
- [ ] 自动化事件日志新写入的 `source` 不再是 `craft-agent/automations`；如需读旧事件，消费者必须兼容旧值
- [ ] Release Notes / What's New 不再展示上游旧品牌：`apps/electron/resources/release-notes/*.md` 中不得出现用户可见的 `Craft Agent` / `Craft Agents Backend` / `Craft-Agents-*` / `.craft-agent` / `agents.craft.do` / `docs.craft.do` / `craftagents://`（除非该历史 note 被产品层隐藏）
- [ ] **Release Notes 完整中文化**（v0.9.2 sync 漏盘后机制化为发版必检）：每个 sync 含的新 release-notes 文件（如 `0.9.2.md`）必须**完整翻译为中文**而不仅仅是 brand 替换。验收 grep 应**全 0 命中**：`grep -niE "craft|github\.com|\(#[0-9]+\)|\\\`[a-f0-9]{7,10}\\\`" apps/electron/resources/release-notes/{新版本}.md`。详细 SOP 见 [`07-upstream-sync.md` §2.5b](../07-upstream-sync.md)；翻译质量参考 0.9.0/0.9.1 短句口语化风格，避免机翻味（"盖写"、"在保留 X 的前提下"等英文直译句式）
- [ ] `packages/shared/src/release-notes/index.ts` 不再独立写 `join(homedir(), '.craft-agent')`，Release Notes 同步目录必须是 `~/.u-agents/release-notes/`
- [ ] 触发 Claude OAuth token exchange / refresh token / Source icon 下载后，抓包或日志确认 User-Agent 不再是 `CraftAgents/...` / `Craft-Agent/1.0`
- [ ] 发版前 grep：`grep -rnE "CraftAgents/|Craft-Agent/1\\.0|Craft Agent|Craft Agents Backend|Craft-Agents-|craft-agent/automations|PREFIX = 'craft-'|agents\\.craft\\.do|docs\\.craft\\.do|craftagents://" packages/shared/src/auth packages/shared/src/utils packages/shared/src/automations packages/shared/src/release-notes apps/electron/resources/{permissions,tool-icons,themes,release-notes} apps/electron/resources/config-defaults.json apps/electron/src/renderer/index.html apps/electron/src/renderer/lib/local-storage.ts apps/electron/src/renderer/lib/provider-icons.ts apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx packages/server-core/src/domain/connection-setup-logic.ts packages/server-core/src/handlers/rpc/llm-connections.ts`，只允许 §2.2/§2.39 明确保留的内部 command 名或兼容迁移说明
- [ ] 打包后额外 grep `apps/electron/dist/resources`，确认 copy-assets/build scripts 没把旧 release notes、旧 icons 或旧 JSON 残留重新带进安装包
- [ ] 内置 docs 路径示例已同步：`apps/electron/resources/docs/statuses.md` 和 `browser-tools.md` 不再出现 `~/.craft-agent/...`
- [ ] `apps/electron/resources/docs/sources.md` 不再指示 AI 调用 `mcp__craft-agents-docs__SearchCraftAgents`，也不再包含 `https://connect.craft.do/...` 示例 baseUrl 或 `~/.craft-agent/provider-domains.json` 路径
- [ ] shared 层测试 fixture 已同步：`packages/shared/src/auth/__tests__/*.test.ts`、`packages/shared/src/sources/__tests__/token-refresh-manager.test.ts`、`packages/shared/src/utils/__tests__/url-safety.test.ts` 中不再使用 `mcp.craft.do` / `craftagents://` 作为用户可见 fixture；应改为中性 mock 域或 `uagents://`
- [ ] README / CLI / 包级文档示例检查：`README.md`、`docs/cli.md`、`apps/electron/README.md`、`packages/*/README.md`、`packages/*/CLAUDE.md` 中的用户可复制命令不再包含 `craftagents://`、`Craft Agents`、`Craft-Agents-*`、`.craft-agent`、`@craft-agent/`；若 CLI/server/WebUI 属于 M1 不发布范围，必须在发版说明中明确
- [ ] Server build template 边界：M1 不发布 standalone server；下载页、release notes、安装脚本上传流程均不引用 server 包。若任何 server/Docker/systemd/docker-compose 模板进入发布产物，必须确认不含 `craft-server`、`craft-data`、`/root/.craft-agent`、`CRAFT_*`

- [ ] 发版脚本未使用 `--script` 上传旧安装脚本；若必须上传安装脚本，先确认 `scripts/install-app.sh` / `scripts/install-app.ps1` 已完整白标且不含 `agents.craft.do` / `.craft-agent` / `Craft-Agents-*`
- [ ] `grep -rn "craft-agents-docs\|SearchCraftAgents\|mcp__craft-agents-docs__\|connectDocsUpstream\|docsTools\|callDocsUpstream" packages apps --include='*.ts' --include='*.tsx' --include='*.md'` 为 0（M1 完全裁剪该 MCP 后；覆盖 session MCP docs upstream proxy、toolNames、source-guides、sources/storage、SessionManager 和 mode/pre-tool/source/prerequisite 豁免分支）

### 13.3.1 FEATURE_FLAGS 默认值锁定（v21 P2 补遗）

> 验证 `packages/shared/src/feature-flags.ts` 中的 `FEATURE_FLAGS.craftAgentsCli` 默认值在 M1/M2 发版包内确实为 `false`——否则 `prompts/system.ts:533` 等 craft 字面量分支会被注入用户可见 system prompt（`CLAUDE.md` §3.7 C6 模式）。

- [ ] 启动 M1/M2 包，**不**设置 `U_AGENTS_FEATURE_CRAFT_AGENTS_CLI` 环境变量
- [ ] DevTools / agent 真实 system prompt 中**不出现** `craft-agent`、`craft-cli`、`Craft CLI` 字面量（grep `prompts/system.ts:533` 附近 `${FEATURE_FLAGS.craftAgentsCli ? ...}` 三元的 truthy 分支）
- [ ] `permissions-config.ts:379` 的 `^craft-agent\\s` Bash 模式不被启用（craft-agent CLI 命令默认不进许可白名单）
- [ ] 反向验证：手动 `U_AGENTS_FEATURE_CRAFT_AGENTS_CLI=1 bun run start`（仅本机测试，不进发版）→ system prompt 才出现 craft 字段；确认 flag 真生效
- [ ] 发版打包时 grep 构建产物 `apps/electron/release/.../app/dist/main.cjs`：含 `craftAgentsCli` 标识符（说明 flag 编进去了）+ 但默认 `false` 值不触发字面量注入

> 详见 `04-feature-cuts.md` "代码可保留，UI 必须隐藏" 原则 + `CLAUDE.md` §3.7 C6（system prompt craft 字面量未门控）。

### 13.4 Sentry / 遥测隐私验证（Round 42 补遗）

- [ ] M1 包构建环境不设置 `SENTRY_ELECTRON_INGEST_URL`；启动后不产生任何 Sentry 网络请求
- [ ] `.env.example` 不提供第三方 Sentry DSN 示例，或明确标注“默认禁用，M3 自建后再配置”
- [ ] `.env.example` 不再包含 `Craft MCP Server URL`、`CRAFT_MCP_URL`、`CRAFT_MCP_TOKEN`；CI / server 模板若仍有 `CRAFT_*`，必须属于 M1 不发布范围并在发版说明中标注
- [ ] DSN 禁用时，前端错误边界不显示 `The error has been reported.` 这类已上报文案
- [ ] 若 M3 启用错误上报：不得上传原始 `sessionId`、稳定 machine hash、agent error 原文、Token、用户输入、模型输出或本地绝对路径
- [ ] renderer `captureConsoleIntegration` 启用前必须通过脱敏测试，确认 `console.error` message / exception / extra 都被 scrub

### 13.5 M2 安全 fix 4/4 验证（v23 P0 补遗，对应 §3.7 #31a-#34）

> 验证 M2 安全主线 4 项（TLS 严格 / atomicWriteFileSync / dir 0o700 / Token 长度限制）已生效且未被回归。**每次发版必跑**。

**TLS 严格化（§3.7 #31a/#31b）**：
- [ ] `grep -n "tlsRejectUnauthorized" apps/electron/src/main/handlers/workspace.ts apps/electron/src/preload/bootstrap.ts` 不应有 `false` 默认值
- [ ] `bun test packages/shared 2>&1 | grep -E "TLS strict|m2-security"` 全绿（应命中 `m2-security-regression.test.ts: 'TLS strict marker 三处全在'`）
- [ ] 反向：故意改 `workspace.ts` 加 `tlsRejectUnauthorized: false` → 跑 m2-security-regression.test.ts 应 **fail**

**atomicWriteFileSync（§3.7 #32a-#32d）**：
- [ ] `grep -rn "atomicWriteFileSync" packages/shared/src/config/storage.ts packages/shared/src/config/preferences.ts packages/messaging-gateway/src/topic-registry.ts apps/electron/src/main/window-state.ts | wc -l` ≥ 4
- [ ] `bun test packages/shared/src/utils/__tests__/atomic-write.test.ts 2>&1 | tail -3` 全绿（11 tests）
- [ ] 模拟断电：启动应用 → 在 `~/.u-agents/config.json` 写入瞬间 `kill -9` → 重启后配置文件**完整可读**（atomic rename 保证）

**dir 0o700（§3.7 #33a-#33c）**：
- [ ] `grep -n "0o700" packages/shared/src/config/watcher.ts packages/shared/src/config/storage.ts apps/electron/src/main/window-state.ts | wc -l` ≥ 3
- [ ] macOS/Linux：启动应用 → `stat -f "%Mp%Lp" ~/.u-agents` 应为 `700`（drwx------）
- [ ] Windows：N/A（NTFS ACL 模型不同，此项跳过）

**LLM API key 长度限制（§3.7 #34）**：
- [ ] `grep -n "MIN_LLM_API_KEY_LENGTH\|MAX_LLM_API_KEY_LENGTH" packages/shared/src/credentials/manager.ts` 应命中常量定义
- [ ] `bun test packages/shared/src/credentials/__tests__/api-key-length.test.ts 2>&1 | tail -3` 全绿（8 tests）
- [ ] UI 验证：onboarding 输入超长 token（> 4096 字符）应被拒绝并提示

### 13.6 M3 安全 fix 验证（v23 P0 补遗，对应 §3.7 #43-#44 + Build 子表 B5-B7）

> 验证 M3 入口前 4 项 spec 落地后的安全/可观测能力。

**SSRF 防护（§3.7 #43/#44a/#44b）**：
- [ ] `grep -n "assertPublicHttpsUrl" packages/shared/src/utils/url-safety.ts` 应命中函数定义（块标记 `/* U-API START: M3 SSRF 防护 */`）
- [ ] `grep -n "assertPublicHttpsUrl\|safety.ok" packages/shared/src/sources/credential-manager.ts` 应命中 `refreshApiRenew` 接入点
- [ ] `bun test packages/shared/src/utils/__tests__/url-safety.test.ts 2>&1 | grep "assertPublicHttpsUrl"` 全绿
- [ ] `bun test packages/shared/src/sources/__tests__/credential-manager-renew.test.ts 2>&1 | grep "SSRF guard"` 全绿
- [ ] 反向：手动构造 `refreshApi.refreshUrl = 'http://169.254.169.254/'` → 调 refresh 应被拦截，不发 fetch

**M3-Sentry build-time DSN assertion（§3.7 Build 子表 B5/B6/B7）**：
- [ ] `grep -n "U_AGENTS_PACKAGING" apps/electron/scripts/build-dmg.sh apps/electron/scripts/build-linux.sh apps/electron/scripts/build-win.ps1 | wc -l` ≥ 3（三平台都 export）
- [ ] `grep -n "assertSentryDsnForPackaging" scripts/electron-build-main.ts` 应命中
- [ ] M2 过渡期：build 时不设 `SENTRY_ELECTRON_INGEST_URL` → 控制台 `console.warn` 提示但**不**阻塞 build
- [ ] M3-4 GlitchTip 上线后：assertion 切 `process.exit(1)` → build 时缺 DSN 必须 fail

**M3 死路径清理（§3.7 §3.4 决策清单）**：
- [ ] 必须 0 残留：`grep -rEn "CRAFT_COMMANDS_ENTRY|CRAFT_CLI_ENTRY|CRAFT_AGENT_VERSION|CRAFT_SCRIPTS|CRAFT_COMMANDS_DOC_PATH|CRAFT_CLI_DOC_PATH|craft-clipboard" packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l` 应等于 **0**
- [ ] CRAFT_DEBUG 等 14+ 真消费方按 M3-DEAD-PATH-CLEANUP-SPEC §1.4 决策**保留**：grep `CRAFT_DEBUG` 命中数应在 14+
- [ ] `agents.craft.do` 残留检查：grep 应得 **4**（仅 oauth-relay.ts L3 + slack-oauth.ts L269/L359/L360 — 已知瑕疵 M3-1 未做）；**5+ 必须停下查多出来的**

### 13.7 v22 后 CI / 开发钩子验证（v23 P0 补遗）

> 验证 M2.5 #3 husky pre-commit 装回 + M2.5 #5 CI 4 死引用修。**每次 sync 后 + 每次发版前必跑**。

**`bun run validate:ci` 全链路全绿**：
- [ ] `cd /Users/dengwang/Documents/coding/u-agents-oss/u-agents && bun run validate:ci 2>&1 | tail -10` exit 0
  - 应包含：typecheck:all 干净 / test:shared:all (3 子测试 file) / test:doc-tools (Python smoke 19 pass) / lint:i18n:parity OK (6 locales, 1447 keys) / lint:i18n:sorted OK / lint:i18n:coverage OK
- [ ] 反向：随便破坏一个 i18n key（如把 `zh-Hans.json` 删一行）→ `validate:ci` 应 fail

**husky pre-commit hook 装回**：
- [ ] `ls -la .husky/pre-commit` 文件存在且 executable
- [ ] `cat .husky/pre-commit` 包含 `bun run lint:i18n:staged`
- [ ] 模拟测试：`echo " " >> packages/shared/src/i18n/locales/en.json && git add . && git commit -m "test"` → hook 应触发 `lint:i18n:staged`
  - 若该改动破坏 sort/parity → hook 应 abort commit
  - 若该改动只是空白 / 与 i18n 无关 → hook 直接 skip 不卡
- [ ] `.husky/_/` 目录由 `bun install` 自动重建，gitignored（不入版本控制）

**§3.7 marker 基线 grep 必跑**（每次 sync 后 + 每次 follow-up commit 后）：
- [ ] 主基线 = **§14 §0 当前基线 ± 2**（唯一权威；写作时 82，2026-05 v0.9.6 后已升到 98；详见 [`14-uapi-marker-registry.md`](14-uapi-marker-registry.md) §0）
- [ ] `/* U-API START */` = **9** 且与 `/* U-API END */` 配对
- [ ] Build 脚本子表 ≥ **13**（floor；2026-05-29 v0.9.6 后实测 21）
- [ ] 超出 ±2 必须停下逐项核对——多半是 git 自动合并吞掉了改造，或引入未文档化的新改造（应补进 §3.7 表）

### 13.8 sync 报告必备贴片（v24 H1.F4 教训：SOP 写了 ≠ 实战跑了）

> v24 复盘发现 v0.9.2 sync 报告自吹"验证了 SOP 实战可用性"但 §13.5/§13.6 5 项实战 0 跑。**今后 sync 报告必须贴 grep 实测输出，否则视为未跑**。

每次 sync 完毕，sync 报告（`SYNC-vX.Y.Z-YYYYMMDD.md`）的"§5 验证结果"章节**必须贴下面 7 块 grep 实测输出**（不是 yes/no 勾选，是命令 + 输出文本）：

```bash
## §5 验证结果（v24 后强制贴片）

### §5.1 主基线 grep（期望 = §14 §0 当前基线/9/9 — 写作时 82，现 98；详见 14-uapi-marker-registry.md §0 + §5 历次演进）
$ grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
[实际数字]

### §5.2 §13.5 M2 安全 fix 4/4（必跑 4 条 grep + 必跑测试套件）
$ grep -n "tlsRejectUnauthorized" apps/electron/src/main/handlers/workspace.ts apps/electron/src/preload/bootstrap.ts
$ grep -rn "atomicWriteFileSync" packages/shared/src/config/storage.ts ... | wc -l
$ grep -n "0o700" packages/shared/src/config/watcher.ts ... | wc -l
$ grep -n "MIN_LLM_API_KEY_LENGTH\|MAX_LLM_API_KEY_LENGTH" packages/shared/src/credentials/manager.ts
$ bun test packages/shared/src/__tests__/m2-security-regression.test.ts 2>&1 | tail -5

### §5.3 §13.6 M3 安全 fix（SSRF + DSN + 死路径）
$ grep -n "assertPublicHttpsUrl" packages/shared/src/utils/url-safety.ts
$ grep -n "assertPublicHttpsUrl\|safety.ok" packages/shared/src/sources/credential-manager.ts packages/shared/src/sources/api-tools.ts
$ bun test packages/shared/src/sources/__tests__/credential-manager-renew.test.ts packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts 2>&1 | tail -5
$ grep -n "U_AGENTS_PACKAGING" apps/electron/scripts/build-dmg.sh apps/electron/scripts/build-linux.sh apps/electron/scripts/build-win.ps1 | wc -l
$ grep -rEn "CRAFT_COMMANDS_ENTRY|CRAFT_CLI_ENTRY|CRAFT_AGENT_VERSION|CRAFT_SCRIPTS|CRAFT_COMMANDS_DOC_PATH|CRAFT_CLI_DOC_PATH|craft-clipboard" packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l

### §5.4 §13.7 v22 后 CI / hook（validate:ci + husky 触发统计）
$ bun run validate:ci 2>&1 | tail -10
$ ls -la .husky/pre-commit
$ git log --since="last sync" --oneline | wc -l   # husky 实际触发次数（每个 commit 都过 hook）

### §5.5 用户可见 brand grep（无新泄漏）
$ grep -rEn "Craft Agents?" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html" --include="*.md" \
    | grep -v node_modules | grep -v __tests__ | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v ".planning"

### §5.6 craft.do 守恒（应仍 4 处已知瑕疵）
$ grep -rEn "agents\.craft\.do" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

### §5.7 测试 baseline 漂移（v22 → v0.9.2 → 当下）
$ bun test packages/shared 2>&1 | tail -5  # 记 pass/fail/skip 数字 vs 上次 sync
```

**任何 sync 报告缺 §5.1-§5.7 任一贴片 = review 评级降一级**。这是把 SOP 工程化为"必跑且必贴"的硬约束。

---

## 14. 自动更新（核心，必须每次都测）

### 14.1 干净机器测下载

- [ ] `packages/shared/src/version/manifest.ts` 的 `VERSIONS_URL` 已指向 `https://update.u-agents.u-studio.cn`，不是 `https://agents.craft.do/electron`
- [ ] 更新服务器除 `latest/latest-mac.yml` 外，也提供 version manifest JSON（至少 `/latest` 与 `/{version}/manifest.json`，字段以 `manifest.ts` 代码为准），其中下载 URL / 文件名不含 `agents.craft.do` 或 `Craft-Agents-*`
- [ ] 装 N-1 版本的应用
- [ ] 启动后 30-60 秒内出现"发现新版本 v1.x.y"提示
- [ ] 点击"下载"按钮 → 进度条显示
- [ ] 下载完成后提示"重启更新"
- [ ] 点击重启 → 应用重启 → 版本号已更新

### 14.2 错误处理

- [ ] 临时把网络掐了，启动应用 → 不会因为更新检查失败而崩溃
- [ ] 让用户拒绝某个版本（"稍后提醒")，下次启动是否再次提示

### 14.3 Log 检查

- [ ] `~/Library/Logs/U Agents/main.log` 含自动更新流程日志
- [ ] 日志中提到的更新源 URL 是 `https://update.u-agents.u-studio.cn/...`（**不是** craft.do）

---

## 15. 国际化

- [ ] 启动语言匹配系统语言（中文系统 → 应用是中文）
- [ ] 设置 → 语言切换为 "简体中文"
- [ ] 关键 UI 文本中文化：菜单、按钮、对话框
- [ ] **不出现** 残留的 "Craft Agents" / "Craft" 字样
- [ ] 错误提示是中文

---

## 16. 性能 & 资源使用

### 16.1 M1 基础阈值

- [ ] 启动时间 < 5 秒（macOS）
- [ ] 空闲时 CPU < 5%
- [ ] 内存占用 < 500MB（不开会话时）
- [ ] 跑长对话（含工具调用）后，关闭会话内存能释放

### 16.2 M1 性能基准记录（**M2 切公证版本时对比用**）

⚠️ **M1 出包后必须**记录以下基准值，存档到 `.planning/perf-baseline-M1.md`：

- [ ] 启动时间：从双击 .app 到主界面渲染完成的秒数（重复 3 次取中位数）
- [ ] config.json migration 耗时：通过 main.log 中的 timestamp 差值估计 `migrateLegacyLlmConnectionsConfig` 进入到 `enforceUApiBaseUrl` 完成的时长
- [ ] 启动期内存峰值：通过 macOS Activity Monitor 观察 main process RSS 峰值
- [ ] 首次发对话延迟：从用户按 Enter 到第一个 token 渲染的秒数

**为什么需要基准**：M1 加了 `enforceUApiBaseUrl`（理论上微秒级，因为只过 1-2 个 connection），但 M2 切到公证版本时若用户报"启动变慢"，没有 M1 基准就无法判断是改造引入还是公证引入。

**记录位置**：M1 出包后第一时间在干净环境跑 3 次，记到 `.planning/perf-baseline-M1.md`（执行 AI 协助记录）。

---

## 17. 卸载

- [ ] macOS：拖到废纸篓后，再清空配置目录无残留
- [ ] Windows：控制面板卸载干净（M2）
- [ ] Linux：rm AppImage 干净（M2）

---

## 18. 上线前最终核查

发版前最后**5 分钟**做：

- [ ] 当前版本号正确（根 `package.json` + `apps/electron/package.json` + DMG/EXE 文件名 + About 对话框四处一致）
- [ ] `bun run | grep electron:dist:adhoc:mac` 能看到 M1 adhoc 打包脚本；本次出包不是误用旧 `build-dmg.sh --upload` / `build-linux.sh --upload` 上传链路
- [ ] `curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml` 能拿到正确版本号，且其中引用的 `.zip` / `.blockmap` 文件名均为 `U-Agents-*`
- [ ] 分别 `curl -I` latest YAML 中列出的 `.zip` / `.blockmap` URL，均返回 200；文件名大小写与 YAML 完全一致
- [ ] `curl https://update.u-agents.u-studio.cn/latest` 返回 JSON current pointer（例如 `{ "version": "v1.x.y" }`），不是 `latest/` 目录页，也不是 `latest/latest.json`
- [ ] `curl https://update.u-agents.u-studio.cn/v1.x.y/manifest.json` 返回 `VersionManifest` 完整结构：`version` / `build_time` / `build_timestamp` / `binaries`；`binaries[*].url`、`filename` 不含 `agents.craft.do` 或 `Craft-Agents-*`
- [ ] 发版前最终 grep：`grep -rnE "craft-agents-docs|SearchCraftAgents|mcp__craft-agents-docs__|connectDocsUpstream|docsTools|callDocsUpstream|Craft Agents Backend|Craft-Agents-|agents\\.craft\\.do|docs\\.craft\\.do|craftagents://|\\.craft-agent" packages apps .env.example README.md docs/cli.md`；命中必须逐条属于 LICENSE/NOTICE/TRADEMARK 或已记录的不发布范围/已知 OAuth relay 瑕疵
- [ ] `u-agents.u-studio.cn` 主页下载链接指向新版本，且下载文件名为 `U-Agents-*`
- [ ] 已备份上一版本的所有产物（防止需要回滚时找不到）

---

## 测试结果模板

每次发版后留一份记录在 `.planning/test-runs/v1.x.y.md`（**这一步可让本仓库 AI 协助**）：

```markdown
# v1.x.y 测试记录 — YYYY-MM-DD

## 测试环境
- macOS: arm64 (Sonoma 14.5) ← D1（2026-06-10）：v0.10.3 同步版起 x64 停产，不再测 Intel；详见 05-build-release.md §3
- Windows: 11 24H2（M2）
- Linux: Ubuntu 22.04（M2）

## 通过项
- §1-§17 全部通过

## 异常
- §X.Y: <描述异常>

## 已知问题（不阻塞发版）
- ...

## 决策
[ ] 发布 / [ ] 暂缓
```
