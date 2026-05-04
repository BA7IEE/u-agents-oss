# 03 — UI 锁定规格

> 把 `04-feature-cuts.md` 的"裁什么"翻译成具体的"UI 怎么改"。
> 给执行 AI / 用户提供逐组件改造指引。

---

## 锁定的核心目标

应用启动后，普通用户能看到的与"AI 提供商"相关的入口**只有一个**：U-API。所有"添加新连接""选择其他 provider""填 baseUrl"的路径都不暴露。

详细配置规格见 `02-llm-gateway-spec.md`，本文管"在哪些组件里、怎么改"。

---

## 改造范围一览

| 文件 | 行数 | 改造类型 | 难度 |
|---|---|---|---|
| `renderer/hooks/useOnboarding.ts` | 200+ | 主状态机：跳过 provider-select/local-model | 中 |
| `onboarding/OnboardingWizard.tsx` | 209 | 渲染兜底：保留旧分支但不命中 | 低 |
| `onboarding/ProviderSelectStep.tsx` | 130 | 5 卡片 → 状态机跳过（组件不动）| 低 |
| `onboarding/APISetupStep.tsx` | 287 | `ApiSetupMethod` 类型源 / legacy selector 同步补 `u_api` | 中 |
| `onboarding/CredentialsStep.tsx` | 304 | API Key 输入分支简化 | 中 |
| `onboarding/LocalModelStep.tsx` | 150 | 整步骤永不渲染 | 低 |
| `apisetup/ApiKeyInput.tsx` | **814** | 抹掉所有非 U-API 分支 | **高** |
| `apisetup/OAuthConnect.tsx` | 103 | onboarding 入口移除 | 低 |
| 设置页 LLM Connections 区 | 待定位 | Add 按钮移除、编辑器锁定 | 中 |
| 菜单 Help 链接（4 处） | 见 `04-feature-cuts.md` §3.1 | URL 替换 | 低 |

---

## 1. Onboarding 流程改造

### 1.1 期望流程

```
welcome → [git-bash (仅 Windows)] → credentials (Token 输入页) → complete
```

**术语对齐**：
- **用户视角**叫"Token 输入页"
- **代码实现**入口是 `OnboardingStep === 'credentials'`，渲染的子组件是 `CredentialsStep`，内部通过 `apiSetupMethod === 'u_api'` 派发到 `ApiKeyInput(mode='u_api')`
- 文档其他地方提到"API Setup 页面 / api-setup / API Key Setup 步骤"时，均指同一个步骤——以本节定义为准

去掉 `provider-select` 步、去掉 `local-model` 步、去掉 `credentials` 子流程的 OAuth 路径（保留 API Key 路径）。

### 1.2 `useOnboarding.ts` 主状态机改造（**真实主入口**）

**实际代码事实**：onboarding 的下一步决策主要不在 `OnboardingWizard.tsx`，而在 `apps/electron/src/renderer/hooks/useOnboarding.ts`：
- `initialStep` 默认值当前是 `'provider-select'`
- `handleContinue` / Git Bash 分支 / `back` 分支会多次跳回 `'provider-select'`
- App 调用 `useOnboarding()` 时未传 `initialStep`，所以只改 `OnboardingWizard.tsx` 不会跳过 provider 选择页

**当前 OnboardingStep 类型**：
```typescript
'welcome' | 'git-bash' | 'provider-select' | 'local-model' | 'credentials' | 'complete'
```

**改造后目标路径**：
```typescript
'welcome' | 'git-bash' | 'credentials' | 'complete'
```

**实现方式**（保上游同步，**不删枚举**）：
- 保留 `'provider-select'` 和 `'local-model'` 在类型定义中
- 修改 `useOnboarding.ts` 的默认初始步骤与所有 next/back 分支，让状态机不再主动产出这两个值
- `welcome` 的继续逻辑应直接选择 `apiSetupMethod = 'u_api'`，设置 `baseSlug = 'u-api-default'`，然后进入 `'credentials'`
- Windows 需要 Git Bash 检查时，路径保持 `welcome → git-bash → credentials`，不得回到 `'provider-select'`

**`OnboardingWizard.tsx` 的角色**：只做渲染兜底，`renderStep` 的 `case 'provider-select'` / `case 'local-model'` 分支保留（防御性），但正常不会被命中。

**`onSelectProvider` / `onSubmitLocalModel` 等回调**：保留 prop，调用点变为 dead code。

### 1.3 `ProviderSelectStep.tsx`

**当前**：5 个 ProviderOption 卡片（claude / chatgpt / copilot / api_key / local）。

**改造**：组件可以不动（永远不被路由到）。如果担心上游同步引入新的 ProviderChoice 让我们漏掉，可以在文件顶部加一个明确注释：

```tsx
// U-API: This step is intentionally NOT rendered in U Agents.
// useOnboarding routes directly from 'welcome' to 'credentials'.
// Keep this file in sync with upstream for merge convenience.
```

### 1.4 `APISetupStep.tsx` / `ApiSetupMethod` 类型源改造（**三处必改 + 状态机注入**）

**当前**：`APISetupStep.tsx` 让用户选 ApiSetupMethod（共 5 种：claude_oauth / anthropic_api_key / pi_chatgpt_oauth / pi_copilot_oauth / pi_api_key）。

**代码事实**：当前主 onboarding Token 输入路径是 `useOnboarding.ts` → `CredentialsStep` → `ApiKeyInput`；`APISetupStep.tsx` 更像 `ApiSetupMethod` union、icon、method→connection type 的类型/legacy selector 来源。执行时仍必须补 `u_api`，但不要误以为“渲染 APISetupStep 页面”就是 M1 主方案。

**改造清单（执行 AI 必须改完所有 5 处）**：

| 改造位置 | 改造内容 |
|---|---|
| ① `APISetupStep.tsx` 文件顶部 `ApiSetupMethod` union 类型 | 扩展为 `... \| 'u_api'`（追加而不是替换，保留旧值便于上游同步）|
| ② 同文件 `apiSetupMethodToConnectionTypes()` 函数 | 追加 `case 'u_api': return { providerType: 'pi_compat', authType: 'api_key_with_endpoint' };` |
| ③ 同文件 `API_SETUP_ICONS: Record<ApiSetupMethod, React.ReactNode>` | 给新 key `'u_api'` 配 icon（用现有的 U-API logo 或临时占位）—— 不加这一项 TypeScript 会因 Record 索引签名不全而报错 |
| ④ `useOnboarding.ts:94` `BASE_SLUG_FOR_METHOD: Record<ApiSetupMethod, string>` | **追加**：`u_api: 'u-api-default'`——这是与 `BUILT_IN_CONNECTION_TEMPLATES` slug 一致的映射（详见 §1.10.1）。**漏这一项 typecheck 立即失败** |
| ⑤ `useOnboarding.ts` 状态机 | `welcome`/`git-bash` 后续步骤直接进入 `'credentials'`，并确保当前 method 为 `'u_api'`（详见 §1.2 状态机改造）|

> ⚠️ **漏改 ③ API_SETUP_ICONS 或 ④ BASE_SLUG_FOR_METHOD** 是最容易遗漏的——这两个 `Record<ApiSetupMethod, T>` 是 TypeScript 穷举类型，新增 union 成员后 typecheck 会立即失败。两者位于不同文件（APISetupStep / useOnboarding），执行 AI 容易只改一个、遗漏另一个。

> ⚠️ **关于 BASE_SLUG_FOR_METHOD 语义**：它把 ApiSetupMethod 映射到 `BUILT_IN_CONNECTION_TEMPLATES` 的 slug——上游 5 个 method 各自映射到 `anthropic-api` / `claude-max` / `chatgpt-plus` / `github-copilot` / `pi-api-key`。我们加的 `'u_api': 'u-api-default'` 必须**与 §1.10.1 BUILT_IN_CONNECTION_TEMPLATES 的新 entry slug 一致**——任一处错都会让 onboarding 找不到模板。

### 1.5 `CredentialsStep.tsx` 改造（**新增 isUApi 路由，不只是文字描述**）

**当前**：根据 `apiSetupMethod` 渲染不同的输入分支：
```typescript
const isApiKey = isAnthropicApiKey || isPiApiKey
// ...
```

**改造清单**：

| 改造位置 | 改造内容 |
|---|---|
| ① 顶部新增 `isUApi` 判断 | `const isUApi = apiSetupMethod === 'u_api'` |
| ② 渲染分支 | `isUApi` 时**优先**渲染 `<ApiKeyInput mode="u_api" ... />`（详见 §1.6 + §1.8）|
| ③ `editInitialValues.baseUrl` | U-API 模式下隐藏（值固定，详见 §1.10.2 baseUrl + customEndpoint 绑定原则） |
| ④ 其他分支（`isApiKey` / OAuth / Copilot）| 保留代码不动（防御性，永不路由到，但保留方便上游同步）|

> ⚠️ **常见错误**：只改 ApiKeyInput.tsx 的 `mode === 'u_api'` 分支，但**忘了**在 CredentialsStep 加 `isUApi` 路由 → ApiKeyInput 的 U-API 分支永远不会被渲染 → onboarding 进 credentials 步骤后白屏或回退到旧分支。三处（§1.4 ApiSetupMethod / §1.5 CredentialsStep / §1.8 ApiKeyInput）必须**同时改完**才能跑通。

### 1.6 U-API 专属表单方案（**M1 不新建组件，复用 ApiKeyInput**）

**M1 决策**：不新建 `UApiCredentialsForm.tsx`。统一用 `CredentialsStep` 新增 `isUApi` 路由，然后渲染 `<ApiKeyInput mode="u_api" ... />`（详见 §1.5 + §1.8）。

**为什么不新建组件**：本文 §1.8 已要求在 `ApiKeyInput.tsx` 内加 `mode === 'u_api'` 简化分支；如果再新建 `UApiCredentialsForm.tsx`，会出现两套 Token/协议/模型提交逻辑，执行 AI 容易漏同步 `ApiKeySubmitData` 字段，反而增加上游同步冲突。

**U-API 模式必须呈现的字段**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| Token | 字符串 | 是 | 标准 API Key 输入框，支持显示/隐藏 |
| 协议 | 单选 | 是 | OpenAI Chat Completions / Anthropic Messages |
| **模型 ID** | 字符串 | **是** | M1 强制至少 1 个；预填 `gpt-5.5` 占位 |

**辅助链接**（见 `02-llm-gateway-spec.md` §3.1）：
- "获取 Token" → `U_API_CONSOLE_URL`
- "充值" → `U_API_TOPUP_URL`
- "查看可用模型与定价" → `U_API_PRICING_URL`

**默认值**：
- Token：空（用户必填）
- 协议：`'anthropic-messages'`（M1 固定，详见 `02-llm-gateway-spec.md` §3.2）
- 模型 ID：`'gpt-5.5'`（占位，用户可改）

**校验**：
- 提交时沿用现有 setup/test 链路：renderer 调 `window.electronAPI.testLlmConnectionSetup(...)`，后端走 `testBackendConnection(...)`；不要在 M1 另开一条前端直连 `GET /v1/models` 认证路径
- **同时**校验模型 ID 非空（前端拦截）
- `GET /v1/models` 仅作为 §2.4/M2 自动模型拉取的可选体验优化，不作为 M1 onboarding 必需认证机制
- 失败显示对应错误提示（见 `02-llm-gateway-spec.md` §7）

**为什么 onboarding 强制要模型 ID**：
- 上游 `setupLlmConnection` IPC handler 在 `pi_compat` 模式下**强校验** `defaultModel` 必须有值（`packages/server-core/src/handlers/rpc/llm-connections.ts:213-215`）
- 不传模型 → 整个 setup 失败、onboarding 卡死
- 详见 `02-llm-gateway-spec.md` §3.3 设计约束

**onSubmit 数据**（来自 §1.8 ApiKeyInput 改造）：
```typescript
const data: ApiKeySubmitData = {
  apiKey: <用户输入>,
  baseUrl: U_API_BASE_URL,
  customEndpoint: { api: <用户选>, supportsImages: true },
  models: [<用户填的 model ID>],          // M1 至少 1 个
  connectionDefaultModel: <用户填的 model ID>,  // 同上
}
```

**进主界面后**：用户可以在设置页（§2.3）添加更多模型、切换默认。

### 1.7 `LocalModelStep.tsx`

**改造**：永不路由到，文件保留不动。同 `ProviderSelectStep.tsx` 加注释。

### 1.8 `apisetup/ApiKeyInput.tsx`（814 行）

**当前**：上游用一个庞大的组件覆盖所有 provider 的 API Key + 自定义端点输入。包含：
- 4 套 Preset（`ANTHROPIC_PRESETS` / `OPENAI_PRESETS` / `PI_PRESETS` / `GOOGLE_PRESETS`）
- 大量 provider 特定的字段渲染逻辑
- baseUrl + customEndpoint.api 的协议选择

**改造策略**（**不重写**，保上游同步）：
- 加一个组件级 prop：`mode?: 'u_api' | 'upstream'`（默认 `'upstream'` 兼容）
- 当 `mode === 'u_api'` 时，组件只渲染：
  - Token 输入框
  - 协议二选一（已有的 `customEndpoint.api` 切换逻辑）
  - 模型管理入口（详见 §2.3）
  - 隐藏：preset 选择、baseUrl 输入框、provider 切换 tab
- 其他分支代码完全保留——上游修订时只需 review `mode === 'u_api'` 分支

**`onSubmit` 回调**：注意 onSubmit 的入参是 `ApiKeySubmitData`（来自 `ApiKeyInput.tsx:39`），**不**含 `providerType` / `authType`——这两个由后端 `setupLlmConnection` 根据 slug 从 `BUILT_IN_CONNECTION_TEMPLATES` 推导。

U-API 模式下应当传（**含模型字段，与 §1.6 复用 ApiKeyInput 的表单方案一致**）：
```typescript
const data: ApiKeySubmitData = {
  apiKey: <用户输入的 Token>,
  baseUrl: U_API_BASE_URL,                     // 'https://token.u-studio.cn/v1'
  customEndpoint: {
    api: <用户选>,                              // 'openai-completions' | 'anthropic-messages'
    supportsImages: true,
  },
  models: [<用户填的 model ID>],               // **必传**，至少 1 个；M1 默认 'gpt-5.5'
  connectionDefaultModel: <用户填的 model ID>, // **必传**；上游 IPC 在 pi_compat 模式强校验非空
  modelSelectionMode: 'userDefined3Tier',
  // 不传 piAuthProvider —— 由后端 resolveCustomEndpointSetup() 自动派生
  // 不传 providerType / authType —— 由后端从 slug='u-api-default' 模板推导
}
onSubmit(data)
```

⚠️ **types.ts 兼容性核查**：`ApiKeySubmitData` interface 在 `apisetup/ApiKeyInput.tsx:39` 定义，已含 `models?` / `connectionDefaultModel?` / `modelSelectionMode?` 字段（详见上游接口签名）——所以上面 5 个字段都可以直接传，**不**需要扩展类型。如果上游同步后类型有变更，本节伪代码必须同步审查。

**漏传 models / connectionDefaultModel 的后果**：
- `setupLlmConnection` IPC handler 在 `packages/server-core/src/handlers/rpc/llm-connections.ts:213` 强校验 `pi_compat` 必须有 `defaultModel`
- 漏传 → IPC 返回 `error: "Default model is required for compatible endpoints."` → onboarding 卡死

后续上层（CredentialsStep → useOnboarding → IPC `settings:setupLlmConnection` → server-core handler）会把它转换为完整 `LlmConnection` 持久化。

### 1.9 `apisetup/OAuthConnect.tsx`

**改造**：onboarding/CredentialsStep 不再调用此组件。代码保留（M3 自建 OAuth relay 后可能复用）。

### 1.10 后端 setup 流程改造（**关键，遗漏会导致 onboarding 提交报错**）

UI 层的 `onSubmit(data)` 不直接写 `LlmConnection`——它经过两层翻译才落到 `config.json`：

```
UI: ApiKeySubmitData
    ↓ useOnboarding.ts:apiSetupMethodToConnectionSetup()
DTO: LlmConnectionSetup (含 slug、credential、baseUrl、customEndpoint 等)
    ↓ IPC 'settings:setupLlmConnection'
Server: connection-setup-logic.ts
    ├─ createBuiltInConnection(slug, baseUrl)
    │    └─ 从 BUILT_IN_CONNECTION_TEMPLATES 取模板
    └─ resolveCustomEndpointSetup({ baseUrl, credential, customEndpointApi })
         └─ 自动派生 piAuthProvider
    ↓
持久化 LlmConnection 到 config.json + credential 到 credentials.enc
```

#### 1.10.1 在 `BUILT_IN_CONNECTION_TEMPLATES` 加 'u-api-default' 项

**位置**：`packages/server-core/src/domain/connection-setup-logic.ts:133`

**当前结构**（5 个上游内置 slug）：
```typescript
export const BUILT_IN_CONNECTION_TEMPLATES = {
  'anthropic-api': { ... },
  'claude-max': { ... },
  'chatgpt-plus': { ... },
  'github-copilot': { ... },
  'pi-api-key': { ... },
}
```

**追加我们的项**：
```typescript
'u-api-default': {
  name: 'U-API',
  providerType: 'pi_compat',           // 固定（不依赖 hasCustomEndpoint）
  authType: 'api_key_with_endpoint',
  // piAuthProvider 不放在模板里 —— 在 resolveCustomEndpointSetup 阶段根据 customEndpoint.api 自动派生
},
```

#### 1.10.2 在 `apiSetupMethodToConnectionSetup` 加 'u_api' case

**位置**：`apps/electron/src/renderer/hooks/useOnboarding.ts:137`（约第 158 行的 switch 语句）

**追加分支**：
```typescript
case 'u_api':
  // ⚠️ 三个字段是绑定的 —— baseUrl + customEndpoint 必须同时传
  // 如果只传 baseUrl 不传 customEndpoint，IPC handler 会触发降级逻辑
  // (server-core/src/handlers/rpc/llm-connections.ts:124-128)：
  // 把 providerType 从 'pi_compat' 降级为 'pi'，破坏我们的锁定。
  // 即使用户在编辑场景下"只想改 Token 不动协议"，仍要从当前连接读出
  // customEndpoint 一并回传 —— 这是硬约束，不能省略。
  return {
    slug: 'u-api-default',                       // 固定 slug，匹配 BUILT_IN_CONNECTION_TEMPLATES
    credential: options.credential,              // 用户输入的 Token
    baseUrl: U_API_BASE_URL,                     // **必须同时传**
    customEndpoint: options.customEndpoint
      ?? { api: 'anthropic-messages', supportsImages: true },  // **必须同时传**，无值则用 M1 默认
    models: options.models,
    defaultModel: options.connectionDefaultModel,
    modelSelectionMode: options.modelSelectionMode ?? 'userDefined3Tier',  // 必传：pi_compat 不像 pi 那样自动推断 mode
  }
```

> **为什么 `modelSelectionMode` 也必须传**：上游 IPC handler 会把 setup 中的 `modelSelectionMode` 写入持久化连接（`server-core/src/handlers/rpc/llm-connections.ts:96-104`）。`pi_compat` 模式**不会**像 `pi` 那样根据 setup.models 自动推断（line 195-200 的 inferredMode 只对 pi 起作用）——漏传会让"用户自定义模型列表应被保留"的语义不完整，未来上游加新策略时可能受影响。

> ⚠️ **遗漏这两处任何一处**，onboarding 提交时会报：
> - `Unknown built-in connection slug: u-api-default. Custom connections should be created through settings.`（缺 §1.10.1）
> - 或 `Cannot read properties of undefined (reading 'slug')`（缺 §1.10.2）

#### 1.10.2.bis baseUrl + customEndpoint 绑定原则（**关键安全约束**）

**任何**调用 `setupLlmConnection` IPC 的代码路径——不论是 onboarding 首次创建还是设置页编辑——只要 `setup.baseUrl !== undefined`，就**必须**同时传 `setup.customEndpoint`。

**为什么**：上游 `setupLlmConnection` 在 `baseUrl` 已传但 `customEndpoint` 未传时会执行降级（详见上面注释）。这是上游用来给"用户从 pi_compat 切回 pi 标准"用的合法路径，但对我们 U-API 来说是破坏性的。

**实现要点**：
- 设置页 §2.2 的"修改 Token"表单提交时，**重新读取**当前连接的 `customEndpoint` 一并发送
- 设置页 §2.2 的"切换协议"操作也要带上 `baseUrl` 一并发送
- 凡是构造 `LlmConnectionSetup` 的地方都遵循此规则

#### 1.10.3 创建 U-API 连接时**必须**带模型（**已与 02 §3.3 同步**）

**硬约束（来自 02 §3.3 强校验）**：
- `pi_compat` 模式下后端 IPC handler **不允许** `defaultModel` 为空
- 因此 onboarding 提交时 `LlmConnectionSetup.models` 必须有至少 1 项 + `defaultModel` 必须非空
- u_api case（详见 §1.10.2）必须把 onboarding 用户输入的 model ID 转成 `models[]` + `defaultModel` 一起提交

**`createBuiltInConnection()` 默认模型行为说明**：
- `createBuiltInConnection()` 创建 'u-api-default' 时会调用 `getDefaultModelsForConnection('pi_compat', undefined)`
- 对于 `pi_compat` 默认返回 `[]`（空数组）—— **这是上游用来给"匿名骨架配置"的 fallback**，**不**是 onboarding 提交允许空模型的依据
- onboarding 提交流程必须由 setup payload 传入 `models` 来覆盖这个空数组

**`models: []` 只允许出现的边缘场景**：
- 启动时 `enforceUApiBaseUrl` 注入的"未认证骨架"（详见 02 §4，用户没填 Token 时的占位）
- 用户在设置页**手动删光**所有模型后的状态（详见 03 §2.3 首页空态）
- 这两种场景下 chat 流程会被 UI 层拦截（"请先添加模型"引导），不会触发 IPC chat 调用

---

## 2. 设置页改造

### 2.1 LLM Connections 列表

**实际位置**：`apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`（**1078 行**）

> ⚠️ 不是 `components/settings/`——后者只是通用基础组件（SettingsRow、SettingsCard 等）。AI 连接的真实页面是 `pages/settings/AiSettingsPage.tsx`。

**目的（M1 v0.9.1 软锁定 — 多连接版本）**：用户进设置 → AI 打开此页面，看到所有 U-API 连接（≥1 个）的列表；可添加新连接、选默认连接、编辑/删除非最后的连接。所有连接的 `baseUrl`/`providerType`/`authType` 都被锁死（`enforceUApiBaseUrl`），LLM 入口仍指向 `token.u-studio.cn/v1`，与 CLAUDE.md §3.1 一致。

**核心改动**：

| 元素 | 当前 | 改造 |
|---|---|---|
| 列表 | 显示所有 `llmConnections[]` | 过滤为 `isUApiSlug(slug)`（匹配 `'u-api-default'` 或 `/^u-api(-\d+)?$/`，详见 [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md) §6.2.2）。`enforceUApiBaseUrl` 同时在 storage 层兜底强制 |
| "Add new connection" 按钮 | 可点击 | **保留可见可点击**——点击后弹出与 onboarding 一致的 U-API 表单（Token + 协议 + 模型 ID），不弹 provider 选择菜单。新连接 slug 由 `resolveSlugForMethod` 生成 `u-api-2`/`u-api-3`... |
| "Default connection" 选择器 | 多选 | **保留**——用户从所有 U-API 连接里选哪个作为默认，写入 `config.defaultLlmConnection` |
| 删除连接按钮 | 可点击 | 多连接时可见可点击；当前连接是最后一个 U-API 连接时 disabled（保护"至少留一个连接"约束）|

### 2.2 LLM Connection 编辑器

**目的**：用户点击 U-API 连接打开编辑界面时，看到的是简化版。

**字段可见性**：

| 字段 | 当前 | U-API 模式 |
|---|---|---|
| Connection name | 可改 | 隐藏（固定 "U-API"）|
| Provider type | 下拉切换 | **隐藏** |
| Base URL | 可填 | **隐藏** |
| Auth type | 下拉 | 隐藏（固定 `api_key_with_endpoint`）|
| API Key | 可填 | **可改** |
| Custom Endpoint API（协议）| 下拉 | **可改**（OpenAI / Anthropic 二选一）|
| Models 管理 | 复杂的 tier 选择 | 简化为列表 + 添加按钮（见 §2.3）|
| Default model | 下拉 | **可改** |
| 删除连接按钮 | 可点击 | 隐藏（删了就没法用了）|

**辅助链接（2026-05-04 UI 简化后的最终形态）**：
- 不再有顶部 Banner "Token 由 U-API 中转分发，地址固定不可改"——已删除
- 不再有"管理 Token"按钮——已删除
- 不再有"充值"按钮——已删除
- **保留** Token 输入框下方两个并列链接：
  - "获取 Token" → `U_API_CONSOLE_URL`
  - "查看可用模型与定价" → `U_API_PRICING_URL`

> ⚠️ **回归预警**：i18n key `uapi.lockNotice` / `uapi.linkConsole` / `uapi.linkTopup` 已从所有 7 个 locale 删除；常量 `U_API_TOPUP_URL` 仍在 `u-api-defaults.ts` 保留以便上游同步友好（M3 自营充值入口可能复用），但**渲染层必须只读两个链接**。详见 [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md) §6.2。

⚠️ **保存（Save）逻辑硬约束**（来自 §1.10.2.bis）：
- 不论用户**只改 Token** / 还是**只切协议** / 还是两者都改，提交时**必须**同时携带 `baseUrl` + `customEndpoint`

⚠️ **额外约束：避免直接调 saveLlmConnection IPC 绕过 setupLlmConnection 锁定**

**上游现状**（已核实，详见第 16 轮反向追踪）：
- `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:715` 重命名连接 → 直接调 `saveLlmConnection({...connection, name})`
- 同文件 `:857` 改默认模型 → 直接调 `saveLlmConnection(connectionData)`
- 这两个调用点**全量传整个 LlmConnection 对象**到 SAVE IPC handler
- SAVE handler（`server-core/handlers/rpc/llm-connections.ts:422-454`）**不做** baseUrl / customEndpoint / providerType 校验，直接 `updateLlmConnection(slug, updates)` 写入

**当前风险评估**：
- 上游现有 2 处 SAVE 调用点改的字段（`name` / `defaultModel`）都**不**触及锁定字段，无害 ✓
- 但**未来风险**：上游加新设置项（如"修改 connection icon"）可能引入新的 SAVE 调用点，全量传 LlmConnection 时可能让 UI bug 改坏 baseUrl / providerType / customEndpoint

**M1 改造规则**：
- 设置页**所有**改动走 `setupLlmConnection` IPC（用 `LlmConnectionSetup` payload，触发 setup 校验路径），**不要**直接调 `saveLlmConnection`
- 已有的 2 处上游 SAVE 调用点（rename / change default model）M1 阶段**保留不动**，因为它们改的字段无害
- 启动迁移 `enforceUApiBaseUrl` 仍是兜底——即使 SAVE 让 baseUrl 被改坏，下次启动会被重置

**与上游同步关注**：每次同步必须 grep `electronAPI.saveLlmConnection|llmConnections\.SAVE` 在 renderer 中的所有调用点，看是否引入新调用——若有，评估是否能改成 setupLlmConnection 走法，或确保新调用点不动锁定字段。登记到 `08-conflict-zones.md` §5（onboarding 目录）的"应当冲突而没冲突"清单。
- 实现伪代码：
  ```typescript
  function buildSetupPayload(form, currentConnection): LlmConnectionSetup {
    return {
      slug: 'u-api-default',
      credential: form.tokenChanged ? form.token : undefined,
      baseUrl: U_API_BASE_URL,  // 始终传
      customEndpoint: {
        api: form.protocol ?? currentConnection.customEndpoint?.api ?? 'anthropic-messages',
        supportsImages: true,
      },  // 始终传
      models: form.modelsChanged ? form.models : undefined,
      defaultModel: form.defaultModelChanged ? form.defaultModel : undefined,
      // 模型有变更时同步带上 modelSelectionMode，避免上游对 pi_compat 留下旧策略推断（pi_compat 不像 pi 那样自动推断）
      modelSelectionMode: (form.modelsChanged || form.defaultModelChanged)
        ? 'userDefined3Tier'
        : currentConnection.modelSelectionMode,
    }
  }
  ```
- 不遵守此规则 → IPC handler 触发降级（pi_compat → pi）→ 锁定被绕过

### 2.3 模型管理 UI

**当前**：上游有 SearchableModelInput 组件 + tier-models 概念（Best/Balanced/Fast 三档）。

**改造**：

| 区块 | 内容 |
|---|---|
| 已添加模型列表 | 卡片式：模型 ID + 显示名 + 删除按钮 |
| "添加模型" 按钮 | 弹窗（见下） |
| 默认模型 | 从已添加列表中下拉选择 |
| ~~"Refresh Models" / "刷新模型"按钮~~ | 当前 `AiSettingsPage.tsx` 未发现独立刷新模型按钮；若上游新增，则 **U-API 模式下隐藏**（详见下方说明）|

**为什么隐藏 Refresh Models 按钮**：

上游 `ModelRefreshService._doRefresh()`（`packages/server-core/src/model-fetchers/index.ts:71-74`）对 pi_compat 模式直接：

```typescript
if (isCompatProvider(connection.providerType)) {
  return  // pi_compat 不走自动拉取，用户手动配置
}
```

→ 用户在设置页点 Refresh Models 按钮，REFRESH_MODELS IPC handler 调 `getModelRefreshService().refreshNow(slug)` → `_doRefresh` 立即 return → **什么都不发生**。

**U-API 模式下应当**：
- **隐藏**这个按钮（CSS `display:none` 或条件渲染 `false`）—— 推荐
- 或：保留按钮但改为"打开 U-API pricing 页"（`U_API_PRICING_URL`）的 deep link，让用户去中转后台看可用模型

**实现要点**：当前 `AiSettingsPage.tsx` 中 `RefreshCcw` 主要用于 OAuth re-auth，不等于模型刷新；执行 AI 应 grep `REFRESH_MODELS` / `refreshLlmConnection` / `ModelRefreshService` 的真实调用点。若上游新增模型刷新按钮，再加 `connection.slug !== 'u-api-default'` 守卫。

**"添加模型"弹窗**：
- 输入 model ID（必填）
- 输入显示名（可选，默认 = model ID）
- 选择 tier（Best / Balanced / Fast / Reasoning，可选，仅用于 UI 排序）
- 弹窗底部三个并列链接：
  - "查看可用模型与定价" → `U_API_PRICING_URL`
  - "管理我的 Token" → `U_API_CONSOLE_URL`
  - "充值" → `U_API_TOPUP_URL`

**首页空态**（M1 阶段几乎不会触发）：
- 由于 onboarding 强制要求 ≥1 模型（详见 §1.6 + `02-llm-gateway-spec.md` §3.3），正常用户进入首页时 `models.length >= 1`
- 仅在用户**手动删除**所有模型（设置页操作）后才会触发空态
- 触发时显示空态卡片："请先添加一个模型才能开始对话"
- 主按钮："添加模型" → 跳转设置页 LLM Connection 编辑器，自动展开"添加模型"弹窗

### 2.4 自动模型拉取（可选体验优化）

**目的**：用户添加模型时，可选调用 `GET https://token.u-studio.cn/v1/models` 拉取当前 Token 可用列表，让用户从下拉里勾选而非手填；这不是 M1 onboarding 的认证路径，Token 校验仍走 setup/test IPC 链路。

**降级**：拉取失败 / Token 未填 / Token 无效 → 回退到手填模式。

**实现要点**：
- 调用点：弹窗打开时
- 缓存：5 分钟内不重复请求
- M1 必须实现"手填模式"作为兜底；自动拉取作为加分项可推迟到 M2

---

## 3. 菜单与链接改造

详见 `04-feature-cuts.md` §3.1，本文不重复。要点：所有 `agents.craft.do/docs` 替换为 `u-agents.u-studio.cn/docs`，即使后者 M1 阶段返回 404 也优先替换。

### 3.1 关于（About）对话框

**实际位置**：上游用 **macOS 原生 About 面板**（不是自定义 React 组件），由 `apps/electron/src/main/menu.ts:84` 触发：

```typescript
// 当前
{ role: 'about' as const, label: i18n.t('menu.aboutCraftAgents') },
```

`role: 'about'` 是 Electron 内置 menu role，会调用 macOS 系统的 NSApplication About panel。要在面板中**追加自定义内容**（如合规署名），必须在 main 进程通过 `app.setAboutPanelOptions()` 注入。

#### 改造步骤（用户/外部 AI 执行）

1. **改 i18n key**：把 `menu.aboutCraftAgents` 翻译值由 "About Craft Agents" 改为 "About U Agents"（详见 `10-i18n-zh.md` §2.1）

2. **在 main 进程注入 About 面板内容**：在 `apps/electron/src/main/index.ts`（应用启动早期，`app.whenReady()` 之前或之内）调用：

```typescript
import { app } from 'electron'

app.setAboutPanelOptions({
  applicationName: 'U Agents',
  applicationVersion: app.getVersion(),
  copyright: 'Copyright © 2026 U Studio\n\nBased on Craft Agents (Apache 2.0)\nhttps://github.com/lukilabs/craft-agents-oss',
  version: app.getVersion(),  // build number, 可选
  // credits 字段支持 multi-line plain text
  credits: 'U Agents (优智体) — built on Craft Agents under Apache License 2.0.',
})
```

> ⚠️ **macOS 限制**：`setAboutPanelOptions` 不支持点击链接。"View third-party licenses"等复杂功能要用**自定义对话框**（即新建一个 React 组件 + IPC channel），不能用原生面板。
> M1 用原生面板 + 在 `copyright` 里贴明文 URL（用户可手动复制）即可。M2 再做自定义 About 对话框（新增菜单项 "About U Agents..." 调 IPC 打开 BrowserWindow）。

3. **Windows / Linux 同样路径**：Windows 默认无 About 面板（点 `role: 'about'` 无反应），需要自定义；Linux 取决于桌面环境。M1 阶段如果只发 macOS，仅需做 §3.1 即可。Win/Linux 的 About 自定义实现推迟到 M2。

### 3.2 状态栏 / TopBar 中的产品名

**位置**：`apps/electron/src/renderer/components/app-shell/TopBar.tsx`

**改造**：所有"Craft Agents"字面量 → "U Agents" / "优智体"（中文环境）。

### 3.3 错误提示中的产品/服务名

**全局规则**：
- "Craft Agents" / "Craft Agent" → "U Agents"
- "Craft" 单独出现作为产品代称 → "U Agents"
- 涉及 LLM 服务时 → "U-API"（见 `02-llm-gateway-spec.md` §7）

实施依赖 `10-i18n-zh.md` 的 i18n key 替换。

---

## 4. Web 端（M2）

`apps/webui` 与 `apps/viewer` 的 UI 锁定 M1 阶段不做（用户不通过 Web 访问）。M2 启动时回到本文新增 §5、§6 章节。

---

## 5. 验收清单（M1 UI 锁定）

执行人：用户或外部 AI 在改造完成后检查。

### 5.1 Onboarding 全程

- [ ] 启动应用 → Welcome 步骤正常
- [ ] (Windows) git-bash 警告步骤正常
- [ ] **不出现** "Choose your provider" / "Select API method" 等多 provider 选择界面
- [ ] **不出现** Anthropic/OpenAI/Bedrock/Vertex/Copilot/Codex/Ollama/Mistral/DeepSeek/Groq/xAI/Google AI Studio 等品牌字样
- [ ] 直接进入 Token 输入界面
- [ ] 协议二选一可见、默认 Anthropic Messages
- [ ] **模型 ID 输入框可见，预填 `gpt-5.5` 占位**（用户可改成自己的 model ID）
- [ ] 模型 ID 字段必填——清空后提交按钮置灰
- [ ] 输入合法 Token + 选协议 + 填模型 ID → 校验成功 → 进入 Completion → 进入主界面
- [ ] 主界面**不**显示"请先添加模型"空态（onboarding 已强制添加 ≥1 个）

### 5.2 设置页（M1 v0.9.1 软锁定 — 多连接版本）

- [ ] AI Connections 列表显示所有 U-API 连接（≥1 个；首装机后只有 `u-api-default` 一个）
- [ ] **能看到** "Add new connection" 按钮，**点击后弹出 U-API 表单**（Token + 协议 + 模型 ID），**不弹 provider 选择菜单**
- [ ] 新建第二个连接成功后，列表多一行；slug 应为 `u-api-2`（grep `~/Library/Application\ Support/U\ Agents/config.json` 确认）
- [ ] **能看到** "Default connection" 选择器；切换默认 → `config.defaultLlmConnection` 写入新 slug；重启后保持
- [ ] 删除非默认的 U-API 连接 → 列表少一行；最后一个 U-API 连接的删除按钮 disabled
- [ ] 点击编辑任一 U-API 连接 → 不显示 baseUrl 输入框、不显示 providerType 切换；可改 Connection name / Token / 协议 / 模型
- [ ] 编辑器顶部 Banner 显示 3 个跳转按钮
- [ ] 模型管理区有"添加模型"按钮 + 已添加模型列表
- [ ] **回归验收**：手动改 config.json 把某个连接的 `baseUrl` 改成别的 URL → 重启应用 → 该连接的 `baseUrl` 被重置回 `https://token.u-studio.cn/v1`（`enforceUApiBaseUrl` 软锁定生效）

### 5.3 菜单与链接

- [ ] 所有 Help / Docs 菜单链接打开后 URL 是 `u-agents.u-studio.cn` 域名（M1 允许 404）
- [ ] About 对话框显示 "U Agents" + "Based on Craft Agents" 署名
- [ ] TopBar 显示 "U Agents" 而非 "Craft Agents"

### 5.4 边界用例

- [ ] 用户编辑 `~/.u-agents/config.json`，把 baseUrl 改成 `api.openai.com`，重启后被强制重置（详见 `02-llm-gateway-spec.md` §10）
- [ ] 用户添加 model ID 是空字符串 → 阻止保存
- [ ] Token 失效 → 错误 Toast 显示"Token 已失效" + "打开 Token 控制台"按钮
- [ ] 余额不足 → 错误 Toast 显示"余额不足" + "前往充值"按钮
