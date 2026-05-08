# 02 — LLM 网关接入规格

> **本文件是产品核心差异化规格**。每次会话修改 LLM 相关代码前必读。
> 与 `CLAUDE.md` §3.1 配套阅读。

---

## 1. 中转站基本信息

| 项 | 值 |
|---|---|
| **运营方** | U Studio（开发者自营） |
| **基础 URL** | `https://token.u-studio.cn/v1` |
| **底层实现** | [newapi](https://github.com/Calcium-Ion/new-api) 开源项目 |
| **支持的协议** | OpenAI Chat Completions（`/v1/chat/completions`）+ Anthropic Messages（`/v1/messages`）|
| **认证方式** | Bearer Token（用户在 U-API 控制台开通） |
| **Token 控制台**（创建/管理 API Key） | `https://token.u-studio.cn/console/token` |
| **充值页**（购买额度） | `https://token.u-studio.cn/console/topup` |
| **模型清单/定价页**（查可用模型与价格） | `https://token.u-studio.cn/pricing` |

### 用户视角

- 用户在 `token.u-studio.cn` 后台注册、充值、获取 Token
- 桌面客户端启动时填入这个 Token（**不是** Anthropic / OpenAI 的 Key）
- 客户端**不允许**填写其他 baseUrl

---

## 2. 在上游抽象中的映射

上游 `LlmConnection` 的字段（见 `packages/shared/src/config/llm-connections.ts`）：

```typescript
{
  slug: 'u-api-default',                         // 固定标识
  name: 'U-API',                                 // UI 显示名
  providerType: 'pi_compat',                     // 固定，自定义端点
  baseUrl: 'https://token.u-studio.cn/v1',       // 固定，不可改
  authType: 'api_key_with_endpoint',             // 上游已有的认证类型
  customEndpoint: {
    api: 'openai-completions' | 'anthropic-messages',  // ← 用户可选
    supportsImages: true,                        // 默认支持，模型不支持时用户自己关
  },
  models: ['gpt-5.5'],                           // M1 占位；onboarding 期间用户可改
  defaultModel: 'gpt-5.5',                       // pi_compat 必须有值（详见 §3.3 设计约束）
  modelSelectionMode: 'userDefined3Tier',
  createdAt: ...,
  // piAuthProvider: 由上游 setupLlmConnection 流程根据 customEndpoint.api 自动注入
  // ('anthropic-messages' → 'anthropic'; 'openai-completions' → 'openai')
  // 见 packages/server-core/src/domain/connection-setup-logic.ts:121
  // 持久化 config.json 中此字段会有值；用户切换协议时此字段也会跟着变
}
```

---

## 3. 用户可选项（必须暴露给用户的设置）

### 3.1 Token / API Key
- 字段：`apiKey`（保存在系统凭证管理器，加密存储）
- UI：标准 API Key 输入框，输入框旁附两个并列链接：
  - "获取 Token" → `U_API_CONSOLE_URL` (`https://token.u-studio.cn/console/token`)
  - "充值" → `U_API_TOPUP_URL` (`https://token.u-studio.cn/console/topup`)
- 校验：沿用上游现有 setup/test 链路（renderer 调 `window.electronAPI.testLlmConnectionSetup(...)`，后端走 `testBackendConnection(...)`）；M1 不新增前端直连 `GET /v1/models` 认证路径

### 3.2 协议（关键决策项）
- 字段：`customEndpoint.api`
- UI：单选按钮组或下拉框
- 选项：
  - **`openai-completions`** ——"OpenAI 兼容协议（推荐用于 GPT 系列模型）"
  - **`anthropic-messages`** ——"Anthropic 协议（推荐用于 Claude 系列模型，保留 thinking、prompt cache 等特性）"
- **默认值（M1 固定）**：`anthropic-messages`
  - 理由：M1 阶段默认模型清单为空，无法在 onboarding 时根据"用户选择的默认模型"派生协议；固定 anthropic-messages 与 02 §5 `buildDefaultConnection()` 和 09 §2 验收一致
  - 用户首次添加模型并发现协议不匹配（如选了 GPT 模型但协议是 anthropic-messages）时，可在设置页**手动**切换协议
  - **不**做"添加模型时根据 model ID 自动改协议"的隐式行为——这种隐式行为会在用户跨模型切换时让协议莫名变动，是体验隐患

### 3.3 模型清单（**onboarding 阶段强制至少 1 个 + 全程不允许空——P0**）

⚠️ **设计约束（来自上游代码事实）**：上游 `setupLlmConnection` IPC handler 在 `pi_compat` 模式下**必须**有 `defaultModel`，否则返回 `error: "Default model is required for compatible endpoints."` —— 见 `packages/server-core/src/handlers/rpc/llm-connections.ts:213-215`。

因此 onboarding 期间用户**必须**至少添加 1 个模型，且 `defaultModel` 必须有值，否则 setup 失败、整个 onboarding 卡死。

#### 3.3.1 P0：发送消息前的模型清单前置校验（**v27 review O1 升级，待实施触发条件**）

> **实施触发条件**（满足任一即升级为"立即做"）：
> 1. **真实用户反馈**：3 个以上用户报告"发消息直接 fail，错误是英文 'Default model is required'"
> 2. **支持成本**：你/客服收到此类问题超过 1 次/周
> 3. **下次 sync 顺手做**：上游若改 chat 入口，借力做
>
> **触发前的兜底**：onboarding 阶段的校验依然在；用户**主动**删光模型才会触发——非默认路径；后端报错信息至少能引导（虽是英文）。
> **预估实施成本**：~2-3 小时（chat hook + 阻塞对话框 + 7 locale × 5 keys）。
> **触发记录**：v27 review O1 提出（[`REVIEW-27-FULL-2026-05-08.md`](sync-reports/REVIEW-27-FULL-2026-05-08.md) P0-3）；闭环延后（[`REVIEW-27-EXECUTION-COMPLETE-2026-05-08.md`](sync-reports/REVIEW-27-EXECUTION-COMPLETE-2026-05-08.md) §2）。

**问题背景**：onboarding 校验只挡住了"首次配置"路径，但用户进入主界面后可以：
1. 进设置页 → "AI Connections" → 编辑 U-API 连接 → 删光所有模型
2. 直接编辑 `~/.u-agents/config.json` 把 `models` 数组清空
3. 然后回到主聊天界面发对话

当前行为（**未实现前置校验**）：用户发对话 → 后端 IPC handler 返回 `Default model is required` → UI 显示英文错误，用户看不懂、也不知道去哪修。

**P0 要求 — 发送前必须前置校验**（实现位置：renderer 层 `useChat` / `sendMessage` hook 入口，**在调用 IPC 前**）：

```typescript
// 伪代码 — 发消息前的前置 gate
function canSendMessage(state: ChatState): { ok: boolean; reason?: BlockReason } {
  const conn = state.activeLlmConnection;
  if (!conn) return { ok: false, reason: 'no_connection' };

  const models = conn.models ?? [];
  if (models.length === 0) {
    return { ok: false, reason: 'no_models' };
  }
  if (!conn.defaultModel) {
    return { ok: false, reason: 'no_default_model' };
  }

  return { ok: true };
}

// 在 sendMessage 入口
const gate = canSendMessage(state);
if (!gate.ok) {
  showBlockingDialog({
    titleKey: 'chat.cannot_send.title',
    messageKey: `chat.cannot_send.${gate.reason}`,
    primaryAction: {
      labelKey: 'chat.cannot_send.go_to_settings',
      onClick: () => navigate('/settings/ai-connections'),
    },
  });
  return; // 不调 IPC
}
```

**i18n keys（待 03-ui-lockdown-spec § i18n 表新增）**：
- `chat.cannot_send.title` → `无法发送消息`
- `chat.cannot_send.no_models` → `当前 U-API 连接没有可用模型，请到「AI 连接」设置中添加至少 1 个模型 ID`
- `chat.cannot_send.no_default_model` → `当前 U-API 连接没有设置默认模型，请到「AI 连接」设置中选择一个默认模型`
- `chat.cannot_send.no_connection` → `没有可用的 LLM 连接，请重启应用让 U-API 默认连接自动恢复`
- `chat.cannot_send.go_to_settings` → `去设置页修改`

**为什么是 P0 而不是 P1**：
1. **用户感知**：英文 `Default model is required` 对中文用户是黑话——前置校验把错误时机从"发完看 ERROR"提前到"按发送按钮立即给中文引导"
2. **首次启动覆盖盲区**：onboarding 校验只挡 setup 路径；但用户在 onboarding 完成后可以进设置页删光、或直接改 config.json，绕过 onboarding 的所有 guard
3. **支撑 §4.4 toast 自愈**：即使 enforceUApiBaseUrl 注入了空骨架（无 models），用户立即发消息会被本 P0 gate 挡住，引导他完成"补 model" 流程

**与现有 onboarding `models.length >= 1` 校验的关系**：本节是"运行时持续校验"，onboarding 校验是"首次设置时一次性校验"——**两个都要**，前置校验不能替代 onboarding 校验（onboarding 阶段还没进 chat 界面，没法触发 sendMessage）。

**验收（加进 09-test-checklist §13.x）**：
1. 完成 onboarding 后进入主界面 → 进设置页 → 删光所有模型 → 回主界面发消息 → 应弹出阻塞对话框「当前 U-API 连接没有可用模型，请到「AI 连接」设置中添加至少 1 个模型 ID」+ "去设置页修改"按钮
2. 点 "去设置页修改" → 自动跳转到 `/settings/ai-connections`
3. 添加 1 个模型 → 回主界面 → 可以正常发消息

#### 3.3.2 字段说明（原 3.3 内容继承）

**字段**：`models: Array<string | ModelDefinition>`（上游 schema 兼容两种形态，详见 `packages/shared/src/config/validators.ts:89`）

> **M1 onboarding 只提交 `string[]`** —— ApiKeyInput 的 onSubmit 传 `models: [<model ID 字符串>]`。
> **M2+ 设置页**未来可扩展为 `ModelDefinition[]`（含 displayName / contextWindow 等元数据）。
> **执行 AI 在 M1 阶段不要过度实现对象模型**——只用 string 数组。

**初始预填值（M1）**：
- 输入框预填 `gpt-5.5` 作为占位模型 ID（用户在 newapi 后台已预设）
- 用户可以接受预填值直接进入下一步，也可以改成自己想要的模型 ID（如 `claude-sonnet-4-5`、`gpt-4o-mini` 等）

**UI（onboarding 阶段）**：
- 协议二选一**之后**显示"模型 ID"输入框，预填 `gpt-5.5`
- 输入框旁三个并列链接（同 §3.1）：
  - "查看可用模型与定价" → `U_API_PRICING_URL`
  - "管理我的 Token" → `U_API_CONSOLE_URL`
  - "充值" → `U_API_TOPUP_URL`
- 提交按钮触发校验：`models.length >= 1 && defaultModel != null`，否则禁用提交
- 不在 onboarding 内做"添加多个模型"——M1 只让用户输入 1 个；进主界面后可在设置页 §2.3 添加更多

**用户视角**：
- 90% 用户按推荐占位 `gpt-5.5` 直接通过 onboarding，对话能跑通
- 10% 用户自己改 model ID（如熟悉 Claude 的用户填 `claude-sonnet-4-5`）

> ⚠️ **协议-模型匹配建议**（M1 不强制校验，让用户自己负责）：
> - 协议 `anthropic-messages` 推荐配 `claude-*` 系列模型
> - 协议 `openai-completions` 推荐配 `gpt-*` / `o*` / `kimi-*` 等
> - 不匹配时 newapi 通常仍能路由（中转层做协议转换），但表现可能不如原生协议——这是 newapi 的能力问题，非我们 onboarding 设计问题

### 3.4 默认模型
- 字段：`defaultModel`
- 初始值：等于 onboarding 阶段用户填写/接受的那个 model ID（M1 默认 `gpt-5.5`）
- 用户后续在设置页可改默认（详见 §6.2 + `03-ui-lockdown-spec.md` §2.3）

### 3.5 Token 校验与模型拉取边界

M1 的 Token 校验必须复用现有 setup/test IPC 链路：`CredentialsStep` / `ApiKeyInput` 提交前触发 `window.electronAPI.testLlmConnectionSetup(...)`，后端 `llm-connections.ts` 构造临时连接并调用 `testBackendConnection(...)`。这样可以复用上游错误处理、credential 形态和 `customEndpoint` 路由，不新增一套前端 HTTP 认证逻辑。

`GET https://token.u-studio.cn/v1/models` 只作为**自动模型拉取**能力：
- M1 可不做；用户手填 model ID 是必备兜底
- 若 M1/M2 做自动拉取，必须走同一 Token/baseUrl/customEndpoint 输入上下文，失败时回退手填
- 不要把“能拉到模型列表”写成 onboarding 唯一认证依据，否则会与当前上游 setup/test 流程分叉，错误提示和后端连接测试结果可能不一致

---

## 4. 用户**不可见、不可改**的项

| 字段 | 值 | 锁定方式 |
|---|---|---|
| `slug` | `u-api-default` | 代码硬编码 |
| `name` | `U-API` | 代码硬编码（i18n 中可中文化为"U-API"或保留英文） |
| `providerType` | `pi_compat` | 代码硬编码 |
| `baseUrl` | `https://token.u-studio.cn/v1` | 代码硬编码 + 启动时强制重置 |
| `authType` | `api_key_with_endpoint` | 代码硬编码 |

### 启动时强制重置逻辑

**注入位置**：`packages/shared/src/config/storage.ts` 的 **`migrateLegacyLlmConnectionsConfig()`** 函数（约第 2115 行，`export function`）。在该函数所有上游 migration 调用（`migrateOpus45ToOpus46` / `migrateSonnet45ToSonnet46` / `restoreOpus46ToAnthropicConnections` / `migrateLegacyProviderTypes` 等）之后追加一步 `enforceUApiBaseUrl(config)`，并把它的返回值（如有变更）纳入 `needsSave` 判断：

```typescript
// 大约在 storage.ts:2240 附近，最后一个 if (migrateXxx(config)) { needsSave = true; } 之后
if (enforceUApiBaseUrl(config)) {
  needsSave = true;
}

if (needsSave) {
  saveConfig(config);
}
```

**为什么不放在 `loadStoredConfig()`**：上游的 `loadStoredConfig()` 只做基本读取，**不**调用 migration。Migration pipeline 集中在 `migrateLegacyLlmConnectionsConfig()`（启动时由 `SessionManager.ts:1585` 调用一次）。

**为什么放在 migration 末尾**：
- 上游 migration 可能把旧字段名升级（如 `type` → `providerType`、`bedrock` → `pi+amazon-bedrock`），我们必须在它们跑完之后再做强制重置，避免被上游迁移"重新激活"非 U-API 连接
- 每次同步上游时如果上游加了新的 migration，我们的 `enforceUApiBaseUrl` 自动还是最后执行——保持稳定

**完整启动时序**（`SessionManager.initialize()` 中）：

```
1. migrateLegacyLlmConnectionsConfig()                    ← 上游 migration pipeline 入口
   ├─ 上游 migration 链（migrateOpus45 / migrateSonnet45 / migrateLegacyProviderTypes 等）
   └─ enforceUApiBaseUrl(config)  ★ 我们注入此处（migration 链末尾）
        ├─ filter llmConnections 仅留 'u-api-default'
        ├─ 字段重置 (baseUrl / providerType)
        └─ 空时注入 buildDefaultConnection() 骨架
2. migrateOrphanedDefaultConnections()                    ← 上游清理孤儿引用
   ├─ ensureDefaultLlmConnection(config) 修全局 default = 'u-api-default'
   └─ 遍历 workspaces：清理指向不存在 slug 的 workspace.defaultLlmConnection
3. migrateLegacyCredentials()                             ← 上游 credential migration
4. reinitializeAuth()                                     ← 上游设置 env vars (pi_compat 早返回)
5. 启动 ConfigWatcher / AutomationSystem 等
```

**关键自动协作**：上游 step 2 的 `migrateOrphanedDefaultConnections` 会自动清理 `workspace.defaultLlmConnection` 指向旧 slug 的引用——我们**不需要**单独处理 per-workspace LLM 默认覆盖。最终结果：
- 全局 `config.defaultLlmConnection` = `'u-api-default'`
- workspace 级别 `defaultLlmConnection` 若指向旧 slug → 被清理为 undefined → fallback 到 global default ✓

⚠️ **`enforceUApiBaseUrl` 是"每次启动都跑"，不是上游 marker 一次性 migration**

**上游 marker 模式**（参考 `storage.ts:1810` `restoreOpus46ToAnthropicConnections`）：
```typescript
const MARKER = 'opus-4-6-restored';
const alreadyRan = config.migrationsApplied?.includes(MARKER) ?? false;
if (alreadyRan) return false;          // 只跑一次
// ... do migration ...
config.migrationsApplied = [...prev, MARKER];  // 标记已跑过
```

**我们的 `enforceUApiBaseUrl` 不能用 marker**：
- 上游 marker 模式是为"一次性升级旧字段"设计的——跑过就完事
- 我们的 `enforceUApiBaseUrl` 是**持续锁定**——用户每次篡改 config.json 都要被重置回来
- 如果错误地加 marker，第一次跑完后用户可以放心地手动改 baseUrl，下次启动**不再重置**——锁定彻底失效

**实现规则**：
- ❌ **不要**给 `enforceUApiBaseUrl` 加 `MARKER` / `migrationsApplied` 检查
- ✅ 每次 `migrateLegacyLlmConnectionsConfig()` 调用时**都要无条件跑** `enforceUApiBaseUrl`
- ✅ `enforceUApiBaseUrl` 内部要 idempotent（多次跑结果相同）—— 已实现，且无副作用

**外部 AI 同步上游时的常见错误**：
> 看到上游所有 migration 都用 marker 模式，可能"顺手"给 `enforceUApiBaseUrl` 也加 marker 以"保持代码风格一致"。**这是灾难性错误**——会让我们的 baseUrl 锁定从"持续防护"退化为"一次性"，用户篡改 config.json 后再无法被重置。

```typescript
// 伪代码：在 loadStoredConfig() 流水线最末尾追加
function enforceUApiBaseUrl(config: StoredConfig): StoredConfig {
  const FIXED_BASE_URL = 'https://token.u-studio.cn/v1';
  const FIXED_SLUG = 'u-api-default';

  // 1. 删掉所有非 u-api-default 的连接
  const filtered = (config.llmConnections ?? [])
    .filter(c => c.slug === FIXED_SLUG);

  // 2. 强制重置 baseUrl（防止用户编辑 config.json）
  for (const conn of filtered) {
    if (conn.baseUrl !== FIXED_BASE_URL) {
      conn.baseUrl = FIXED_BASE_URL;
    }
    if (conn.providerType !== 'pi_compat') {
      conn.providerType = 'pi_compat';
    }
  }

  // 3. 如果一个都没有，注入默认空配置（无 token 未认证状态的"骨架"）
  if (filtered.length === 0) {
    filtered.push(buildDefaultConnection());  // 见 §5
  }

  return { ...config, llmConnections: filtered };
}
```

⚠️ **第 3 步的 `buildDefaultConnection()` 注入是"启动时无连接"的骨架 fallback——绝不等于"onboarding 提交时允许空 models"**：
- 这个骨架配置仅在用户**首次启动 + 还没完成 onboarding** 时短暂存在；onboarding 完成后会被 setupLlmConnection 覆盖为有 models 的真实配置
- onboarding setup 流程**仍必须**传 `models` + `defaultModel`（详见 §3.3 + `03-ui-lockdown-spec.md` §1.10.3）
- 上游 IPC handler `pi_compat` 强校验 `defaultModel` 非空——绕过这个骨架不能绕过 IPC 校验

### 4.1 ⚠️ 关键陷阱：上游 keyless 判定会让 U-API 骨架"误判已认证"（**P0 必修**）

**代码事实**：`packages/shared/src/auth/state.ts:294-299`：
```typescript
if (connection.authType === 'api_key' || connection.authType === 'api_key_with_endpoint' || connection.authType === 'bearer_token') {
  apiKey = await manager.getLlmApiKey(defaultConnectionSlug);
  // Keyless providers (Ollama) are valid when a custom base URL is configured
  if (!apiKey && connection.baseUrl) {
    hasCredentials = true;   // ← 灾难
  }
}
```

**问题**：上游为 Ollama 等本地 keyless 模型设计的"有 baseUrl 即视为已认证"逻辑，会把我们的 U-API 骨架也判为 `hasCredentials = true`：

- 我们注入的骨架：`authType: 'api_key_with_endpoint'` + `baseUrl: 'https://token.u-studio.cn/v1'` + 没存 Token
- 走 keyless 分支 → `hasCredentials = true`
- → `getSetupNeeds()` 返回 `isFullyConfigured: true`
- → **首次启动直接跳过 onboarding 进主界面**
- 用户没填 Token，发对话立即报 401

**修复（必修，写进 11-roadmap M1 任务清单）**：

修改 `packages/shared/src/auth/state.ts:296-299` 的 keyless 判断，把 U-API slug 排除在外：

```typescript
if (!apiKey && connection.baseUrl) {
  // Keyless 路径仅给 Ollama 等本地端点用；U-API 必须有 Token
  const isUApi = defaultConnectionSlug === 'u-api-default';
  hasCredentials = !isUApi;
}
```

**为什么不改骨架本身**：
- 骨架的 `baseUrl` 必须是 `token.u-studio.cn/v1`——不设的话 baseUrl 锁定逻辑（§4 §5）失效
- 改 `authType` 会让上游同步冲突点暴露
- 在 `state.ts` 加一行 slug 特判最干净，且与上游 keyless 路径隔离

**与上游同步关注**：每次同步上游若 `state.ts:290-310` 这段 keyless 判断有改动，必须同步审查 U-API 特判是否仍生效。登记到 `08-conflict-zones.md` §6（核心锁定）。

### 4.2 ⚠️ 关键陷阱：上游 `validateSetupTestInput` 拒绝 U-API 测试请求（**P0 必修**）

**代码事实**：

`packages/server-core/src/domain/connection-setup-logic.ts:54-67`：
```typescript
export function validateSetupTestInput(params: {
  provider: 'anthropic' | 'pi'
  baseUrl?: string
  piAuthProvider?: string                       // ← 没接 customEndpoint
}): { valid: true } | { valid: false; error: string } {
  const hasCustomEndpoint = !!params.baseUrl?.trim()
  if (params.provider === 'pi' && hasCustomEndpoint && !params.piAuthProvider) {
    return {
      valid: false,
      error: 'Custom endpoint in Craft Agents Backend mode requires selecting a provider preset...'
    }
  }
  return { valid: true }
}
```

`packages/server-core/src/handlers/rpc/llm-connections.ts:303` 调用：
```typescript
const setupValidation = validateSetupTestInput({ provider, baseUrl, piAuthProvider })  // ← 没传 customEndpoint
```

**问题**：U-API onboarding 测试连接时（详见 `useOnboarding.ts:450-458`）：
- `provider: 'pi'`（因为有 customEndpoint）
- `baseUrl: 'https://token.u-studio.cn/v1'`（非空，`hasCustomEndpoint = true`）
- **不传 `piAuthProvider`**（按 02 §5 设计由后端自动派生）
- → `provider === 'pi' && hasCustomEndpoint && !piAuthProvider` = **true**
- → 返回 `valid: false, error: '...requires selecting a provider preset...'`

**后果**：U-API onboarding 测试连接被前置校验直接拒绝，永远走不到真正的连接测试逻辑（`resolveSetupTestConnectionHint` 已经能根据 customEndpoint 派生，但**前置校验拦在它前面**）。**onboarding 完全跑不通**。

**修复（必修，写进 11-roadmap M1 任务清单）**：

修改 `packages/server-core/src/domain/connection-setup-logic.ts` 中的 `validateSetupTestInput`：

```typescript
import type { CustomEndpointConfig } from '@u-agents/shared/config/llm-connections'

export function validateSetupTestInput(params: {
  provider: 'anthropic' | 'pi'
  baseUrl?: string
  piAuthProvider?: string
  customEndpoint?: CustomEndpointConfig    // ← 新增
}): { valid: true } | { valid: false; error: string } {
  const hasCustomEndpoint = !!params.baseUrl?.trim()
  // 旧分支（保留）：provider='pi' + baseUrl + 既无 piAuthProvider 也无 customEndpoint → 用户配置不完整
  if (
    params.provider === 'pi' &&
    hasCustomEndpoint &&
    !params.piAuthProvider &&
    !params.customEndpoint                // ← 新条件：customEndpoint 存在时不拒绝
  ) {
    return {
      valid: false,
      error: 'Custom endpoint requires either a provider preset or a customEndpoint protocol config.'
    }
  }
  return { valid: true }
}
```

修改 `packages/server-core/src/handlers/rpc/llm-connections.ts:303` 调用点把 `customEndpoint` 也传进去：

```typescript
const setupValidation = validateSetupTestInput({ provider, baseUrl, piAuthProvider, customEndpoint })
```

**修复后 U-API 路径**：`provider='pi' + baseUrl + customEndpoint + 不传 piAuthProvider` → 因为 customEndpoint 存在，跳过校验拒绝 → 进入 `resolveSetupTestConnectionHint` → 根据 `customEndpoint.api` 自动派生 piAuthProvider → 真正测试连接 ✓

**与上游同步关注**：每次同步上游若 `validateSetupTestInput` 有改动（如新增校验逻辑），必须同步审查 customEndpoint 路径是否仍能通过。登记到 `08-conflict-zones.md` §7。

### 4.3 已追踪安全的上游路径（**反向副作用全景表，供同步审查参考**）

下表列出第 16 轮反向追踪已确认对 U-API（pi_compat + slug=`u-api-default`）**当前安全**的上游路径。**每次同步上游必须 review 这些路径是否仍安全**——若上游改了任一处的判断逻辑，可能让"现在安全的"变成 P0 阻塞。

| 路径 | 上游文件:行 | 当前安全机制 | 同步时审查点 |
|---|---|---|---|
| TEST handler 凭证判定 | `server-core/handlers/rpc/llm-connections.ts:479-508` | 用 `validateStoredBackendConnection` → `hasLlmCredentials`（严格判定，不走 keyless） | 上游若改用 keyless 判定会破坏（同 §4.1）|
| `validateStoredBackendConnection` | `shared/agent/backend/factory.ts:448-490` | `hasLlmCredentials` 严格判定 | 上游若引入 keyless 副作用需重新评估 |
| ModelRefreshService `_doRefresh` | `server-core/model-fetchers/index.ts:71-74` | `if (isCompatProvider) return` 跳过 pi_compat | 上游若改成对 pi_compat 也拉模型，会让用户手填模型被覆盖 |
| TokenRefreshManager / isRefreshableSource | `shared/sources/types.ts:234` | 是 Sources 模块，**不**作用于 LLM connections | 上游若让 LLM connections 也用此 manager，需评估 OAuth refresh 对 U-API 的影响 |
| `migrateOpus45ToOpus46` 等 model migrations | `shared/config/storage.ts:1742-1865` | 都有 `if (providerType !== 'anthropic') continue` | 上游新增 migration 必须保持此 convention（见 `07-upstream-sync.md` §2.5 步骤 4）|
| `resolveAuthEnvVars` | `shared/config/llm-connections.ts:847-877` | line 857 `if (!isAnthropicProvider) return early`——pi_compat 不注入 ANTHROPIC_* env vars | 上游若改成对 pi_compat 也注入，需评估冲突 |
| `isLocalConnection` | `shared/config/llm-connections.ts:409-418` | `token.u-studio.cn` 不是 loopback，返回 false | 不会触发 |
| pi-agent.ts customEndpoint 路由 | `shared/agent/pi-agent.ts:472` | `customEndpoint` 完整传递给 Pi SDK 子进程 | 上游若改了 Pi SDK 调用 contract，需重新核对字段链 |
| factory.ts `resolveCustomEndpointSetup` | `shared/agent/backend/factory.ts:392-398` | 根据 `customEndpoint.api` 自动派生 `piAuthProvider` ('anthropic' / 'openai') | 上游若改派生规则（如加新协议），需评估 U-API 协议是否仍被正确路由 |
| OpenAI Chat Completions strip stream | `shared/unified-network-interceptor.ts` | 上游已修过 tool_calls 重复合并问题（详见 `packages/shared/CLAUDE.md`） | 上游若回退此修复，DeepSeek/Kimi 等转 OpenAI 协议的中转会出现 tool_call 错乱 |
| 网络代理支持 | `shared/config/proxy-env.ts:13-22` | 上游支持 `HTTP_PROXY` / `HTTPS_PROXY` / `no_proxy` 注入，企业代理网络下 U-API 仍可达 | 上游若改代理处理逻辑（如改用其他 env 变量），需重新评估对 token.u-studio.cn 的访问 |
| 离线诊断 | `shared/agent/diagnostics.ts:196, 370` | 上游已识别 `ECONNREFUSED` / `ENOTFOUND` / `fetch failed` → 触发离线提示 | 上游若改诊断逻辑，需评估错误展示是否对 U-API 用户友好 |
| Token redact | `shared/unified-network-interceptor.ts:1871-1890` | 上游 `headersToCurlFlags()` 已 redact `authorization` / `x-api-key` / `cookie` | 上游若加新 sensitive header（如 `x-bearer-token`），同步追加到 redact 列表 |
| Auto-update 签名 | `apps/electron/src/main/auto-update.ts` | M1 adhoc 包默认软校验；M2 公证后启用 publisherName 严格校验 | 详见 `06-update-server.md` §7.5 |
| 单实例锁 | `apps/electron/src/main/index.ts:282-283` | `app.requestSingleInstanceLock()` 保证 macOS/Windows/Linux 同一时刻只有一个 U Agents 进程，避免多窗口并发写 config.json | 上游若移除单实例锁需评估并发安全 |
| `config.json` 写入 | `shared/config/storage.ts:271 saveConfig` | 上游用 `writeFileSync` 直接覆盖（**非**原子写——先写 .tmp 再 rename 才是原子）；当前**单实例锁**保护让并发安全 | 单实例锁失效时，主进程异常 + 用户硬关导致的写截断风险 |
| 上游 release-only squash 模式 | `git log` 只有 `v0.9.0` 一个 commit | 上游 OSS 是 release-only 仓库（私有仓库 squash 后推送）—— 同步只能"按 release tag 整批" | 详见 `07-upstream-sync.md` §1.0 + §3 紧急安全同步流程 |
| 上游测试覆盖 | 295 个 `*.test.ts` | M1 改造影响至少 10 个测试文件 + 所有因 M1 改造失败的测试 fixture—— `bun run test:shared:all` 必须更新通过 | 同步上游时若新增 storage / setup-logic / deeplink / auth / url-safety 测试，需评估是否需要兼容 |
| `saveConfig` 写盘 | `shared/config/storage.ts:271` | **无自身 try/catch**——但 IPC handlers 上层都包了 try/catch，运行期失败转成 user-friendly error；启动期 migration 写盘失败（磁盘满）会让 main 进程启动失败 | 上游若把 saveConfig 改成原子写（先 .tmp 再 rename），review 与我们的 enforceUApiBaseUrl 顺序兼容性 |
| `LlmConnectionSchema` `.passthrough()` | `shared/config/validators.ts:95` | zod schema 接受额外字段；上游加新可选字段不会破坏校验；`enforceUApiBaseUrl` in-place mutation 保留这些额外字段 | 若上游加**必填**新字段（z.string() 而非 .optional()），`buildDefaultConnection` 返回的固定字段集会缺失——同步时核对 |
| 子进程 IPC 边界 | `pi-agent-server` / `session-mcp-server` 入口 | 子进程**不**直接 `loadStoredConfig` 或 `getLlmConnection`——通过 main process IPC 拿数据；我们的 `enforceUApiBaseUrl` 在 main 跑后子进程拿到的就是已锁定的 connection | 上游若让子进程直接读 config（绕过 main 锁定），需评估副作用 |
| tsconfig 严格模式 | `tsconfig.json` (`strict: true` + `noUncheckedIndexedAccess` + `noFallthroughCasesInSwitch`) | 上游对类型穷尽性 + null 检查严格——执行 AI 改造时 union 扩展（如 ApiSetupMethod 加 'u_api'）必须改完所有 `Record<U, T>` 调用点（详见 `03-ui-lockdown-spec.md` §1.4 ⑤ 处必改） | 上游若放宽 strict 设置，我们的改造仍稳定；若进一步收紧（如 `exactOptionalPropertyTypes`），可能要求字段可选类型显式写 |
| `trustedDependencies` | `package.json:8-17` | 上游 trustedDependencies 列表稳定（8 项：`@sentry/cli` / `@vscode/ripgrep` / `electron` / `electron-winstaller` / `esbuild` / `koffi` / `protobufjs` / `sharp`）；我们改造**不引入**新 deps | 上游若加新 trustedDependency，评估是否需要 `bun install` 时审查脚本权限 |
| `asar: false`（已知瑕疵）| `apps/electron/electron-builder.yml:86` | packaged 后用户可直接看 `.app/Contents/Resources/app/` 源码；锁定**不防**技术高超用户 | 详见 `LEGAL.md` §5.4——M1 接受此限制 |
| useOnboarding hook 依赖闭包 | `apps/electron/src/renderer/hooks/useOnboarding.ts` | 14 个 `useCallback`；我们的 `case 'u_api':` 加在 `apiSetupMethodToConnectionSetup`（普通函数）内，不读 hook scope 外部 state——无 stale closure 风险 ✓ | 上游若把 `apiSetupMethodToConnectionSetup` 改成 hook 内闭包，需重新评估依赖 |
| Claude SDK 加载行为 | 8 处 `import { query } from '@anthropic-ai/claude-agent-sdk'` | M1 用户走 pi_compat → Pi SDK 子进程，**不调用** `query()` → Claude binary 不 spawn；但 ~210MB binary 仍 bundle 进 .app（`extraResources`）—— 包大小问题 | 上游若改 import 路径或 lazy load 策略，需重新核对 |
| Source map 配置 | `apps/electron/vite.config.ts:41` `sourcemap: true` | 开发期可见 .ts 原位置；packed 后 .map 文件在 `.app/Contents/Resources/app/` 内（与 `asar: false` 一致暴露源码）| 上游若关闭 sourcemap，开发者本机调试体验下降 |
| Vite Sentry plugin（已注释）| `vite.config.ts:9-31` | 上游 Sentry plugin 已注释（不上传 sourcemap 到 Sentry）；与我们 M1 禁用 Sentry 一致 ✓ | M3 自建 Sentry 时**不要**取消 Vite Sentry plugin 注释（会泄露代码到 Sentry 服务器）|
| ConfigWatcher 监控行为 | `shared/config/watcher.ts:840` `handleConfigChange()` | 监控 CONFIG_DIR；config.json 变化触发回调时**仅**调 `loadStoredConfig()`（不调 migrate*）—— `enforceUApiBaseUrl` 启动期写盘**不会**自触发死循环 ✓ | 上游若改 watcher 回调让其重跑 migration，会让我们陷入循环；同步审查必查 |
| `enforceUApiBaseUrl` idempotency | 我们的实现（详见 02 §4 伪代码）| filter + 字段重置都是 noop-when-equal；多次跑结果相同；持续防御用户篡改是**设计意图**而非 bug | 上游 schema 加新必填字段后若 buildDefaultConnection 缺字段，schema validation 失败——同步时核对（见上面 LlmConnectionSchema 行）|
| `RPC_CHANNELS` 字符串稳定性 | `shared/protocol/channels.ts:6+` | 上游用字符串字面量定义 channel 名；我们引用 `RPC_CHANNELS.settings.SETUP_LLM_CONNECTION` 等；TypeScript 静态检查保证上游改字符串名时我们 fail-fast 编译失败 | 上游若**新增** entry 不影响我们；**改名/删除**已有 entry 才有破坏 |
| monorepo workspace 依赖 | 各 `package.json` `"@u-agents/X": "workspace:*"` | bun workspace symlink 内部解析；sed 改 NPM scope 一次性同步所有 `name` + `import`——无顺序依赖 | 上游若分裂 monorepo（如把 server-core 拆出去独立发布），需重新评估 import 路径 |
| `U_API_BASE_URL` 编译期固化 | 我们的 `u-api-defaults.ts:U_API_BASE_URL = 'https://token.u-studio.cn/v1'` | 字面量字符串，build 时 esbuild 直接固化到 bundle —— **用户改 env 无效**，是 M1 锁定意图 ✓ | 未来 M3 企业版若需 IT 配置自有中转站，可改为 `define: { U_API_BASE_URL: process.env.U_API_BASE_URL }` 通过 build 时 env 注入 |
| esbuild tree-shake 行为 | `scripts/electron-build-main.ts:149+` esbuild `--format=cjs/esm`（默认开启 tree-shake）| 我们保留的 dead code（ProviderSelectStep 5 卡片 / 13 个旧 piAuthProvider 分支等）因 React import 链未断**不会**被消除——bundle 比纯净 fork 大约 5-10% | 已知 trade-off（保上游同步 vs 包大小）；M3 阶段如包大小受关注，可改 import 链让旧分支 lazy load |
| Workspace 级别 LLM 覆盖 | `shared/workspaces/types.ts:44` `Workspace.defaultLlmConnection?: string` | 上游支持 per-workspace LLM 默认覆盖；`migrateOrphanedDefaultConnections`（在 `enforceUApiBaseUrl` 之后跑）自动清理孤儿引用——我们**无需**单独处理 ✓ | 上游若改 workspace storage 路径或 migration 顺序，需重新评估 |
| messaging-gateway 模块 | `packages/messaging-gateway/src/` | **完全不引用** LlmConnection——Telegram / Slack / WhatsApp 消息网关与 LLM 锁定**完全隔离** ✓ | 上游若让 messaging-gateway 引用 LlmConnection（如让自动化触发对话），需重新评估 |
| Skills 模块 | `packages/shared/src/skills/` | **不引用** craft.do（grep 0 命中）；用户 skills 数据流与品牌锁定隔离 ✓ | 上游若加内置 Skills 模板含 craft.do URL，需删 / 替换 |
| MODEL_REGISTRY | `shared/config/models.ts:17+` | Bedrock / Vertex 模型 ID 映射（如 `us.anthropic.claude-opus-4-7-v1` → `claude-opus-4-7`）；M1 pi_compat 路径**不调用**这些 mapping，typecheck 不受影响 ✓ | 上游若新增非 Anthropic 模型 mapping（如 GPT），需评估对 newapi 路由有无影响 |
| Sources 模块 | `packages/shared/src/sources/` | **完全不引用** LlmConnection（grep 0 命中）—— 用户添加的 MCP / API / 本地 Sources 与 LLM 锁定**完全隔离** ✓ | 上游若让 Sources 引用 LlmConnection（如 Source level LLM 配置），需重新评估 |
| 多窗口 LLM 配置同步 | `SessionManager.ts:1471 broadcastLlmConnectionsChanged()` | LLM 连接变化通过 RPC 广播给所有 BrowserWindow——多窗口自动同步配置变化 ✓ | 上游若改 broadcast 通道或 payload，需评估前端 UI 同步行为 |
| `craftAgentsCli` feature flag | `shared/feature-flags.ts:79` `craftAgentsCli` | 默认 `false`（环境变量 `CRAFT_FEATURE_CRAFT_AGENTS_CLI=1` 显式开启）；上游 craft-agent CLI 集成功能，对 U-API 锁定**无影响** ✓；bash pattern `^craft-agent\s` 在 `cli-domains.ts:154-157` 仅 flag 开启时生效 | 上游若把默认值改为 `true`，会让 craft-agent CLI 功能默认可见——需重新评估 |
| 谓词函数对 union 扩展健壮性 | `shared/config/llm-connections.ts:392/402/425` `isCompatProvider/isAnthropicProvider/isPiProvider` | 字面量比较 `=== 'anthropic'` 等；M1 不扩展 LlmProviderType union（保持 3 值）→ 谓词稳定 ✓；U-API 走 `isPiProvider` 分支查 `'mini'/'flash'` 关键字 model 作 mini model | 用户 model 组合最好含 1 个名带 'mini'/'flash' 的——否则后台任务（如总结/命名）fallback 用 default model，token 消耗略高 |
| LlmConnectionSetup 字段 | `shared/protocol/dto.ts:345-360` 全部 optional + 字面量 | backward-compatible 扩展；上游加新可选字段不破坏 ✓；`modelSelectionMode` 字面量 union（2 值）扩展时 TypeScript 严格模式下需穷举 | 上游扩 `modelSelectionMode` 加新值（如 `'manual'`）时，03 §1.10.2 case 'u_api' 需调整 ?? fallback 默认值 |
| vendor binary 完整性 | `vendor/bun/` `vendor/codex/` `vendor/copilot/` 由 `scripts/build/common.ts` 下载 | 非源码内容；下载到 vendor/ 由 build 时拉取，packed 后进 .app 但 binary 内部含上游 user agent 字符串 | M2/M3 阶段如需自定义 user agent，可在 build 时注入 `BUNDLE_BUN_UA="U Agents/${VERSION}"` 或类似 |
| `bin/craft-agent` + `tool-icons/craft-agent.svg` | `apps/electron/resources/` | M1 craftAgentsCli flag 默认 false，脚本/图标不激活；packed 后用户解 .app 能看到 craft-agent 字面量（详见 LEGAL §5.4 已知瑕疵）| 详见 `01-branding-spec.md` §2.2 决策"M1 保留不改" |
| **system prompt AI 身份** | `shared/prompts/system.ts` 28 处 craft | 5 处必改的 AI 身份 / Source mention / Co-Authored-By（详见 01 §2.12）；上游同步时新增 craft 字面量需 review | M1 改造后用户问 AI"你是谁"应回 "U Agents"，否则品牌污染 |
| **OAuth callback HTML** | `shared/auth/callback-page.ts:46, 178` | 用户 OAuth 完成后浏览器**直接看到** "Craft" 字样；本地 callback HTML 是我们 fork 代码（详见 01 §2.16）| 上游若改 callback HTML 模板需 review |
| **内置 docs/ 品牌** | `apps/electron/resources/docs/` 10 个文件 91 处 craft（craft-cli.md 137 保留）| AI 主动 read 这些 doc 作为知识源，引用时带出 craft 字样；M1 批量 sed 替换（详见 01 §2.17）| 上游若新增 docs，需评估是否含 craft |
| i18n placeholder token | `i18n/locales/*.json` | grep 0 命中 sk-ant / AIza 等示例 token——上游已用通用 placeholder ✓ | 上游若加 provider-specific placeholder，可能需脱敏 |
| **DEEPLINK_SCHEME + app.setName** | `apps/electron/src/main/index.ts:187, 213` + `browser-pane-manager.ts:46` 双声明 + renderer 11 处字面量 + tests 5 处 + webui 1 处 | 用户操作系统全局协议表注册 `craftagents://` → 浏览器/Finder 弹"Craft Agents"对话框（详见 01 §2.18）；20+ 处必改 + 双独立常量数据分裂风险 | 上游若再加 deeplink scheme 用法或新独立常量声明，需确保统一命名 |
| **'craft-agents-docs' MCP** | `claude-agent.ts:849-854` 永久注入 + `builtin-sources.ts` deprecated placeholder + `session-mcp-server/src/index.ts` docs upstream proxy + `toolNames.ts` / `source-guides.ts` / `sources/storage.ts` 死分支/注释 | AI 工具集或 session MCP proxy 仍可能含这个 MCP server → AI 响应主动提及 "craft-agents-docs" / 引用 craft.do 文档；`sources/storage.ts` 当前因 `isBuiltinSource()` 恒 false 不实际注入，但旧分支需清理防止同步后复活（详见 01 §2.13b / §2.19）；M1 完全裁剪，不替换 | 上游若添加新 always-available MCP server、docs proxy，或恢复 builtin source，需评估品牌污染 |
| AAA preload contextBridge 暴露面 | `apps/electron/src/preload/bootstrap.ts:438` + `browser-toolbar.ts:28` 两个 expose 入口 | grep 0 命中 craft 字面量直接暴露到 renderer global ✓（仅 import path `@craft-agent/...` 是 NPM scope，#1 任务全替换）| 上游若新增 expose 字段含 craft 字面量，需评估 |
| AAA crashReporter（系统级 crash dump 路径）| `apps/electron/src/main/` 全无 `crashReporter.start()` 调用 ✓；electron-builder.yml 也无 crash 相关配置 | 即使不开 crashReporter，OS 默认 crash dump 路径含 `app.setName()` 值（macOS `~/Library/Logs/DiagnosticReports/<AppName>_*.crash`）→ §2.18 改 app.setName 后系统路径自动正确 ✓ | 上游若启用 `crashReporter.start({uploadToServer: true})`，需立刻 review submit URL |
| AAA PDF 导出 / printer-worker | grep `printToPDF\|webContents\.print\|exportPdf\|printer-worker` 命中 0 ✓ | 上游无 PDF 导出功能（如有页眉页脚品牌字串） | 上游若加导出，需 review 模板 |
| AAA package.json homepage 字段 | `apps/electron/package.json:11` + `packages/server/package.json:21` `"homepage": "https://agents.craft.do"` | M1 #1 NPM scope 任务覆盖全部 package.json，homepage 字段需在 #1 同步改为 `https://u-agents.u-studio.cn`（执行 AI 易漏：scope 改名 grep 时未含 `homepage`）| 上游若加新 package.json，需检查 homepage |
| **`CRAFT_*` 环境变量族** | `session-tools-core/runtime/resolve-script-runtime.ts` 6 个 + `main/index.ts` 2 个 + `feature-flags.ts` 1 个 = 9 个 env vars | 6 个新发现（CRAFT_IS_PACKAGED / CRAFT_RESOURCES_BASE / CRAFT_APP_ROOT / CRAFT_UV / CRAFT_NODE / CRAFT_BUN）+ 3 个已知；error message 字面量"Configure CRAFT_UV/NODE/BUN"用户**直接看到**（详见 01 §2.20）；改 `U_AGENTS_*` | 上游若新增 `CRAFT_*` env var 必 review |
| **`package.json` 文件族字段** | 14 个 package.json 的 `name`/`description`/`homepage`/`author` | 根 `name: "craft-agent"` + 13 子 `description` 含 craft + 根 npm script L64 内 `@craft-agent/electron/main.log` pattern；package metadata 的 author/email 改为 U Studio，自上游署名放 NOTICE/About（详见 01 §2.21 + LEGAL §2）| 上游若加新 package.json 需检查 |
| AAA logger / debug prefix | `createLogger()` 各模块用名 `'tool-matching' / 'permissions' / 'cron-matcher' / 'automation-system' / ...` 全 0 craft 字面量 ✓；`debug('[ConfigWatcher] ...')` 等模块前缀也 0 craft 命中 | 上游若新增 logger 名含 craft 需 review；CONFIG_DIR 改名后 `'[ConfigWatcher] Watching global configs:', CONFIG_DIR` 输出自动跟随 ✓ | 持续 review |
| **prompt / agent 文件 craft 字面量** | `agent/errors.ts:185, 458` + `diagnostics.ts:139` + `pi-agent.ts:121, 1848` + `system.test.ts:15, 88` 共 7 处 P0 用户可见 + 11 处 P2 注释 | 错误对话框 / 诊断面板 / 测试 fixture 直接显示 craft 字样（详见 01 §2.22）；与 §2.12 system.ts + §2.19 craft-agents-docs MCP 联动 | 上游若新增用户可见错误文案含 craft 需 review |
| **正则 hardcoded `\.craft-agent\/` 路径** | `agent/core/config-validator.ts` 9 个正则 + `agent/core/path-processor.ts` 4 个正则 + `isCraftAgentConfig()` 函数名 | §2.15 paths.ts 改名 #23 任务**漏覆盖**——必须与 #11i 同 commit 完成，否则 config 写新路径但校验跑旧正则 → app 拒绝读取（详见 01 §2.23）| 上游若新增 hardcoded 路径正则需 review |
| AAA Electron webPreferences 安全姿态 | `browser-pane-manager.ts` 5 处 + `window-manager.ts` 1 处 webPreferences 块；全部 `contextIsolation:true + nodeIntegration:false` ✓；4 处 `sandbox:true` + 2 处 `sandbox:false`（toolbar + 主窗口，需要 IPC 合理）；`setWindowOpenHandler` + `will-navigate` + `setPermissionRequestHandler` 全实现 | 继承上游 Electron 安全姿态，M1 不更严不更松 ✓；商业分发产品安全审计可引用此条 | 上游若改 webPreferences 配置（如某处突然 `sandbox:false`），需评估 |
| AAA BrowserView 远程 URL 加载 | `browser-pane-manager.ts:702` `loadURL(normalizedUrl)` 用户访问远程 URL；`browser-empty-state.html` grep craft 0 命中 ✓ | in-app browser 是上游 Sources / OAuth 核心功能，与 U-API LLM 锁定**完全隔离** ✓ | 上游若让 BrowserView 加载 craft.do URL（如 OAuth bridge），需评估 |
| AAA auto-updater 签名校验 | `auto-update.ts` 0 命中 `disableSignatureVerification` / `verifyUpdateCodeSignature` —— **未禁用**也未显式启用强制校验；走 electron-updater 默认 hash 校验 | M1 adhoc → adhoc 升级链路 OK（hash 一致）；M2 公证版后切换升级路径，老 adhoc 用户首次升级要重装（已知瑕疵，05 §3.2.3 已写）| 上游若加 `disableSignatureVerification:true` 是安全降级，需评估 |
| AAA OS Keychain / safeStorage / 加密策略 | grep `keytar` / `safeStorage` / `setPassword` 0 命中 ✓ —— 上游**不用** macOS Keychain / safeStorage encrypt；**实际用自建 AES-256-GCM 加密文件**（详见 §9.2）| `<CONFIG_DIR>/credentials.enc`，密钥派生自 OS 硬件 UUID（IOPlatformUUID / MachineGuid / machine-id），**与 app.setName 解耦** ✓；§2.18 改 app name 不影响凭证读取；magic header `CRAFT01\0` 故意保留（改 magic 破坏既有文件解密）| 上游若改加密策略（如改 magic / 改派生算法 / 引入 `safeStorage`）会破坏 fork 凭证迁移，需立即评估 |
| **Vite `optimizeDeps.exclude`** | `apps/electron/vite.config.ts:64` + `apps/webui/vite.config.ts:81` `exclude: ['@craft-agent/ui']` | #1 NPM scope 任务**易漏**——vite.config.ts 的 `exclude` 数组字面量不是 import path，常规 codemod 不处理；改名失败症状是 dev 时 "multiple React copies" 不易察觉（详见 01 §2.24）| 上游若改 vite optimizeDeps 配置，需评估 |
| CCCC Notification API | `apps/electron/src/main/notifications.ts:54-90` `showNotification(title, body, ...)` —— title 由调用方传，**不 hardcode 品牌**；macOS 通知 app name 由 `app.setName()` 自动跟随 ✓；**Windows `setAppUserModelId` 未设置**——M2 Windows 打包需补 `app.setAppUserModelId('cn.u-studio.u-agents')`，否则 Windows toast 通知显示 "Electron" fallback 而不是 "U Agents" | macOS M1 安全 ✓；M2 Windows 打包待办 |
| DDDD i18n 业务术语污染 | `i18n/locales/en.json` grep `Mintlify` / `Craft Docs` / `craft\.do/docs/` 0 命中 ✓ —— 除 craft 品牌词（已在 §1 33 处改造覆盖），无其他业务术语污染 | 上游若加 craft.do URL 或 Craft Docs 引用 i18n value，需评估 |
| EEEE electron-builder.yml 完整字段 | 9 处 craft：appId / productName / **copyright** / publish.url / mac.artifactName / dmg.title / dmg.artifactName / win.artifactName / linux.maintainer / linux.artifactName | Round 33 EEEE 补遗：原 #2 任务清单写"6 字段"，**漏 copyright**（macOS Info.plist NSHumanReadableCopyright + Windows EXE 版本信息）；已在 §2.1 补 + #2 描述补 7 字段 | 上游加 electron-builder.yml 新字段需检查 |
| FFFF Legal 文件清单 | `LICENSE` (Apache 2.0) + `NOTICE` (Craft Docs Ltd. 版权声明) + `TRADEMARK.md` 共 3 个文件 ✓ | 与 CLAUDE.md §3.4 + LEGAL.md §2 一致；M1 不引入新 OSS 依赖 → 不需要扩展 third-party-licenses 文件 | 上游若引入新 OSS 依赖（如改 license 类型）需立即评估 |
| GGGG 死代码资源文件名 | `apps/electron/resources/craft-logos/` 含 4 个 PNG，`grep -rn "craft-logos\|craft_logo\|craft_app_icon"` **0 命中** —— 上游历史 leftover；其他 4 个 craft 资源（bin/craft-agent + .cmd + tool-icons/craft-agent.svg + docs/craft-cli.md）由 craftAgentsCli flag 默认 false 不激活 | M1 推荐删除 craft-logos/（已在 §2.2 决策）；其他 4 个 craftAgentsCli 资源保留（已在 LEGAL §5.4 已知瑕疵）| 上游若给 craft-logos 加引用，需评估 |
| HHHH Sentry 守卫 + setTag 元数据 | `Sentry.init({enabled: !!process.env.SENTRY_ELECTRON_INGEST_URL})` ✓ —— enabled=false 时所有 capture*/setTag/setUser 都是 noop，不发请求；M1 不设环境变量 → 100% 不上报 | M3 自建 Sentry 启用前必须 review `index.ts:1034-1038` 的 5 个 setTag（providerType / authType / hasCustomEndpoint / model / workspaceCount）— 不是 Token 但泄露连接拓扑（详见 §9.2 已补）| 上游若加新 setTag 需 review |
| IIII shell.openExternal / spawn / exec | grep `shell.openExternal\|spawn\|exec` 与 craft 交叉只命中 1 处（`menu.ts:237` 已在 §3.3 6 处清单覆盖）✓ —— 无新 craft 命令引用 | 上游若加 spawn 新 craft 子进程需评估 |
| **JJJJ build-dmg.sh** | `apps/electron/scripts/build-dmg.sh:83/248/249` 3 处 craft：echo + 注释 + **`DMG_NAME` 变量值**（与 #2 artifactName 耦合）| #2 改 artifactName 不改脚本 → #28 跑 `electron:dist:adhoc:mac` 报 "Expected DMG not found"（详见 01 §2.25）；#11k 任务 + #28 commit 6 验收 | M2 出 Linux 时 build-linux.sh 8 处同步处理 |
| **KKKK 死组件 + 死资源** | `CraftAppIcon.tsx`（22 行）+ `craft_logo_c.svg`，**grep 0 caller** | M1 推荐删除（与 §2.2 craft-logos/ 决策一致）；上游若同步引入新引用立即编译错误（详见 01 §2.26）| 上游若给 CraftAppIcon 加用法需评估 |
| **LLLL 通知 fallback body** | `useNotifications.ts:232` `'Craft Agent has a new message for you'` —— **用户桌面通知直接看到** | M1 字面量替换 `'U Agents has a new message for you'`；M2 走 i18n（`notifications.fallbackBody`）（详见 01 §2.27）；同时关联 §2.18 Windows setAppUserModelId M2 待办 | 上游若加新 hardcoded 通知英文文案需 review |
| **MMMM CraftAgentsSymbol 启动画面/顶栏图标** | `SplashScreen.tsx:2,39` + `AppMenu.tsx:18,208` + `aria-label="Craft menu"` (L207) | **应用启动第一眼可见 + 屏幕阅读器无障碍**（详见 01 §2.28）；M1 改名 `UAgentsSymbol` + SVG path 替换 + 5 处调用同步 + aria-label 改 | 上游若新增图标组件含 craft 命名需评估 |
| **MMMM EditPopover AI prompt context** | `EditPopover.tsx` 14 处 craft：13 处 `~/.craft-agent/...` 路径 + L369 `mcp__craft-agents-docs__SearchCraftAgents` MCP 引用 + L315 `'Connect to my Craft space'` example | **AI 真的去 read 这些路径 / 调用 MCP**——§2.15 paths 改名 + §2.19 MCP 裁剪不同步会让 AI 行为崩坏（详见 01 §2.29）；必须与 #23 + #11i + #11e 同 commit | 上游若新增 AI prompt context 含 hardcoded 路径需 review |
| **MMMM craft:* 自定义事件命名空间** | `label-value-popover.tsx:93` dispatch + `ChatPage.tsx:252-253` listen 共 3 处 `craft:focus-input` / `craft:restore-input` | M1 改名 `u-agents:*`（DevTools 看不到 craft 字样）；3 处同 commit 风险极低（详见 01 §2.30）| 上游若新增 `craft:*` 事件需 review |
| **NNNN AiSettingsPage Pi label** | `AiSettingsPage.tsx:229/232/506/921/922` 5 处 `'Craft Agents Backend' / 'Craft Agents Backend Compatible'` | **U-API 走 pi_compat → 用户在 AI Settings 卡片直接看到** "Craft Agents Backend Compatible"（详见 01 §2.31）；与 §2.22 diagnostics.ts 同步 | 上游若加新 provider label 需 review |
| **PPPP connection-setup-logic 用户错误对话框** | `connection-setup-logic.ts:30, 63` 错误文案 + L162 BUILT_IN_CONNECTION_TEMPLATES 'pi-api-key' 模板 name | L30/63 用户错误对话框直接看到（详见 01 §2.31）；L162 模板 name 保留（合规署名 + 不破坏上游测试 fixture）| 上游若新增 BUILT_IN_CONNECTION_TEMPLATES 需 review |
| **QQQQ unified-network-interceptor + models-pi + UA** | `unified-network-interceptor.ts:2062, 2073` 网络拦截错误 + `models-pi.ts:35` Pi model description + `pi-agent-server/web-fetch.ts:362` UA `'CraftAgent/1.0'` | 4 处用户/外部可见 craft 字面量（详见 01 §2.32）；UA 影响第三方网站日志归类 | 上游若改 UA 字符串或网络拦截 message 需 review |
| **TTTT-A messaging Telegram bot** | `messaging-gateway/commands.ts:302` Telegram bot pair 命令回复 "in the Craft Agent app" | **用户在 Telegram 收到 bot 文案直接看到**（详见 01 §2.33）| 上游加新 bot 文案需 review |
| **TTTT-B WhatsApp Linked Devices 设备名** | `messaging-whatsapp-worker/worker.ts:259` `Browsers.macOS('Craft Agent')` | **用户在 WhatsApp Linked Devices 看到** "Craft Agent" 设备名；改名后老用户 link 仍显示旧名（unlink + relink 重置）| 上游若改 baileys.Browsers 调用方式需 review |
| **TTTT-C messaging Telegram 临时文件名** | `messaging-gateway/telegram/index.ts:588` `craft-agent-messaging-` | Telegram 接收方看到 attachment 文件名 | 上游若改临时文件命名规则需 review |
| **SSSS-A packages/ui CraftAgentLogo** | `SessionViewer.tsx:52, 54, 228` CraftAgentLogo 组件（viewer 用紫色 "C" logo）| M1 改名 `UAgentsLogo` + SVG 替换（packages/ui 是 shared lib，typecheck 必过）（详见 01 §2.34）| 上游加新 viewer 组件含 craft 命名需评估 |
| **SSSS-B Shiki theme `craft-dark/craft-light` 决策保留** | `packages/ui/src/components/code-viewer/registerShikiThemes.ts` + 关联调用方 | M1 保留不改（影响低 + 改名风险中等）；M2 重构 packages/ui 时统一改；记入 LEGAL §5（详见 01 §2.35）| 上游若新增 Shiki theme 需 review 命名 |
| **RRRR-A 边缘 apps cli/webui/viewer M1 不改决策** | apps/cli (~24 处) + apps/webui (1 处已知) + apps/viewer (1 处已知) | M1 不发布这 3 个 app；NPM scope 改名（#1）覆盖 import；保留不改增加上游同步友好；M3 启用时再改（详见 01 §2.36）| 上游若给这 3 个 app 加生产引用（让它们被 packed）需立即评估 |
| **VVVV-A 第 3 个独立 CONFIG_DIR** | `apps/electron/src/main/window-state.ts:32` `const CONFIG_DIR = join(homedir(), '.craft-agent')` | 前 28 轮已知 paths.ts:19 + permissions-config.ts:49，**Round 37 发现第 3 处独立硬编码**（详见 01 §2.15 + #23 任务）；不改窗口状态文件分裂用户体验异常 | 上游若再加 CONFIG_DIR 独立派生需立即统一 |
| **UUUU-A 独立 audit log 路径** | `packages/server-core/src/services/privileged-execution-broker.ts:25` `AUDIT_LOG_PATH = join(homedir(), '.craft-agent', 'logs', 'privileged-actions.jsonl')` | **第 4 个独立路径硬编码**（详见 01 §2.15）；不改安全审计员查不到日志 | 上游若加新审计相关路径需立即统一 |
| **WWWW-A craft:* event 范围扩张** | `App.tsx:858` dispatch `craft:restore-input` + `App.tsx:932` dispatch `craft:compaction-complete` | **§2.30 漏覆盖** 2 处 dispatch + 1 个新事件类型（`craft:compaction-complete`，前 28 轮未知）；改名时必须 grep 全 src 确认 listener 配对（详见 01 §2.30 扩张）| 上游加新 craft:* 事件需 review |
| **VVVV-B + WWWW-B DOM 元素 ID + window 单例** | `browser-cdp.ts:490, 494, 567` `__craft_agent_screenshot_overlay__` × 3 + `ThemeContext.tsx:351` `'craft-theme-overrides'` style ID + `registerShikiThemes.ts:3` `__craftShikiThemesRegistered__` 单例 key | **第三方网页 inspect 看到 craft 字样的 element id**（影响品牌专业度）；`'craft-theme-overrides'` DevTools 可见；`__craftShikiThemesRegistered__` 单例 key M1 保留（§2.35 决策）（详见 01 §2.37）| 上游加新 DOM ID / window 全局属性需 review 命名 |
| **UUUU-B server 启动日志 + core/types 注释** | `headless-start.ts:332` `'Craft Agent server listening'` + `packages/core/src/types/*.ts` 4 处注释 | M1 改 server 日志 + 注释顺改（详见 01 §2.38）| 上游若加新 server 启动日志需 review |
| **WWWW-D playground M1 决策保留** | `apps/electron/src/renderer/playground/` ~20 处 craft 字面量（recent-working-dirs / planner / browser-ui / markdown 示例数据）| dev 工具，用户生产模式看不到；`<CraftAgentsSymbol/>` 调用方由 §2.28 改名自动覆盖；M2 重构 playground 时统一改（详见 01 §2.38）| 上游若让 playground 进生产 build 需立即评估 |
| **Round 46-A1 tsconfig.json paths** | 8 个 tsconfig.json 共 24 处 `@craft-agent/*` paths 映射 | **#1 NPM scope 任务漏覆盖**——常规 codemod 改 import 不改 paths；不同 commit 完成会让 typecheck 报 `Cannot find module '@u-agents/...'`（详见 01 §2.41 + #1 任务扩张）| 上游若加新 tsconfig.json 需检查 paths |
| **Round 46-A2 ESLint plugin namespace 决策保留** | 3 个 eslint.config.mjs 共 6 个 inline plugin namespace (`craft-agent` / `craft-platform` / `craft-paths` / `craft-links` / `craft-sources` / `craft-styles` / `craft-shared`) + 12+ rule reference | dev tooling 命名，**用户看不到**；改名要同步所有 rule reference 增加上游同步成本无收益（与 §2.35 Shiki theme + Round 46 Dockerfile.server 决策一致）| 上游若把 plugin 拆成外部 npm package 需立即评估 |
| **Round 46-D1 .gitignore + .github/ISSUE_TEMPLATE/** | `.gitignore:58-59` 仅 ignore `.craft-agent/` + `.github/ISSUE_TEMPLATE/{feature_request,bug_report}.yml` 4 处 craft | M1 必改：① 加 `.u-agents/` 到 .gitignore（保留 `.craft-agent/` 也无害）② 删除 `.github/ISSUE_TEMPLATE/`（私有 fork 不接 GitHub Issues）（详见 01 §2.42 + #11v 任务）| 上游若给 .gitignore 加新 `.craft-*` 路径需评估 |
| **Round 46-D3 Dockerfile.server M1 决策保留** | `Dockerfile.server` ~15 处 craft（image tag / `craftagents` user / `~/.craft-agent` volume / `org.opencontainers.image.source` LABEL / `COPY packages/craft-agents-commands/...` 引用 OSS 已剥离的 packages）| M1 不发布 server / Docker（与 §2.36 cli/webui/viewer + 04 §2.1-§2.2 install scripts 决策一致）；Dockerfile build 必失败但 M1 不 build → 安全 ✓；M2/M3 自建 server 时改；记入 LEGAL §5 已知瑕疵 | 上游若让 Dockerfile.server 进 CI build 需立即评估 |
| **Round 47 文档自相矛盾审计** | 14 份文档跨章节交叉引用一致性 | 7 个矛盾（详见 01 §2.43）：A1 §2.0 行 59 数字过期 / A3 §2.19 表落后 #11e 范围 / A4 §2.31 数字过期 / A5 §2.21 内部数字矛盾 / A6 §2.36 webui 决策与 #11d 漂移 / A7 §2.14 编号错乱；A1+A4+A5 本轮已修正；A3+A6 待 Round 48；A7 留 M2 文档大版本 | 每月同步上游后跑一遍 `Round X 审计` 找出新数字过期 |
| **Round 48 A3+A6+A8+A9 处理** | 01 §2.19 + §2.36 + #11e | A3：§2.19 表扩 9 行（含 toolNames / source-guides / sources/storage / mode-manager / core/source-manager / core/prerequisite-manager / core/pre-tool-use 修正路径 + **2 处新发现** `system.ts:650` + `sources/types.ts:518`）；A6：§2.36 标题修正；**A8 P0 新发现**：#11e 任务原列 4 个文件路径全错（`server-core/sessions/...` → 实际 `shared/agent/...`）；**A9 P0 新发现**：`shared/prompts/system.ts:650` 同时是 §2.12 system.ts 第 6 处必改 + §2.19 craft-agents-docs MCP 第 12 处引用（双重漏覆盖）| §2.19 / §2.12 / #11e 已修正；§2.12 主表加 L650 待下次维护 |
| **Round 49 反向 grep B-1··B-5** | 01 §1 品牌四件套 vs 全仓 14 份文档 | B1 UA token `UAgents/1.0` 4 处一致 ✓；**B2 P1 - 2 处违反单域多路径**：§2.19 写 `docs.u-agents.u-studio.cn/mcp` + §2.24 写 `share.u-agents.u-studio.cn`，应是主域 `/docs/mcp` + `/s/{shareId}`；B3 邮箱一致 ✓；B4 Token URL 一致 ✓；B5 typo 0 命中 ✓ | B2 本轮已修正；A 角度（自相矛盾）+ B 角度（反向 grep）2 轮共审计出 9+5=14 个矛盾，**反向核对应建立月度节奏** |
| **Round 51 整体 review** | 用户外部跑几轮后做整体核对 | 跑 07 §2.7b SOP 完整流程（A1-A4 + B1-B5）：**仅 1 个真新发现**（A10 M1-READINESS §1 文档数 14→15 已即时修正）+ **3 个误报需 SOP 改进**（B6 审计表自引用 / B7 U Agents 减少不代表错 / B8 hallucination 检查应排除"新建"文件）+ **跨文档引用 ✓ 验证**（A11 §13.4/§5.4/§6.3/§1.4/§1.5 都对）| **文档已稳定**：M1 文档收敛达到"反向核对几乎挖不到新矛盾"门槛；下次审计建议 1 个月后或上游同步时跑 |
| **C1 版本号策略变更**（用户决策） | 01 §4.1 + 08 §3.1 | 原决策"重置为 1.0.0 独立编号"→ 改为"**跟随上游 release tag**"（M1 v0.9.0 / hotfix 用 `0.9.0+u-agents.N` build metadata）；与 M1-READINESS §B1 等文档已用的 v0.9.0 现状一致零成本；同步上游时 version 字段直接接受上游值不再人工合并 | 01 §4.1 + 08 §3.1 已修正；§2.43 加 C1 行 |
| **C2 automations.md `CRAFT_*` 协议变量保留**（Round 52 决策） | 01 §2.17 + automations.md 顶部说明 | M1 主体收尾后 #11c 5/5 文件清完 4 个，automations.md 仍 46 处——但**全是 webhook 协议变量名**（`$CRAFT_EVENT` / `$CRAFT_WH_SLACK_URL` 等），不是品牌词；M1 保留与上游协议一致，M2/M3 评估双名兼容方案 | 01 §2.17 已加决策段；执行 AI 在 automations.md 顶部加说明段（待） |

> ⚠️ 这张表**不是**"M1 不需要做的事"——是"M1 不需要主动改、但必须每次同步审查"的事。`07-upstream-sync.md` §2.5 步骤 4-8 已包含这些审查命令的 grep 模板。

**注意**：协议字段 `customEndpoint.api` 和 `models` 不重置，让用户保留自己的选择。

### 4.4 用户感知 SOP — `enforceUApiBaseUrl` 触发时必须 toast 提示（**P0 待实施，等触发条件**）

> **实施触发条件**（满足任一即升级为"立即做"）：
> 1. **真实用户反馈**：3 个以上用户报告"我改了 baseUrl 配置怎么没生效" / "config.json 自动改了"
> 2. **合规审查**：法务/安全审查要求"用户篡改防护必须有用户感知证据"
> 3. **下次 sync 顺手做**：上游若引入 toast/通知系统升级，借力顺道做掉
>
> **触发前的兜底**：main 进程已 log（mainLog.warn），运维可查；用户感知缺失但不无证据。
> **预估实施成本**：~2-3 小时（IPC 通道 + 7 locale × 4 keys + toast 组件）。
> **触发记录**：v27 review O1 提出（[`REVIEW-27-FULL-2026-05-08.md`](sync-reports/REVIEW-27-FULL-2026-05-08.md) P0-6）；闭环延后（[`REVIEW-27-EXECUTION-COMPLETE-2026-05-08.md`](sync-reports/REVIEW-27-EXECUTION-COMPLETE-2026-05-08.md) §2）。

**问题背景（v27 review O1 用户视角发现）**：

当前 `enforceUApiBaseUrl` 是"静默"重置——用户手动篡改 `~/.u-agents/config.json` 把 baseUrl 改成 `https://api.openai.com`，**重启后**配置被悄悄重置回 `https://token.u-studio.cn/v1`，但 UI 不给任何反馈。这有两个用户感知问题：

1. **用户不知道改动被还原**：以为 baseUrl 已生效，发对话 401 后困惑（"我明明改了 config.json 啊"）
2. **没有合规 paper trail**：合规审查中"用户尝试篡改 → 系统拦截"是关键证据，静默还原等于无证据

**SOP 要求**：

`enforceUApiBaseUrl` 检测到任一以下情况之一时，**必须**通过 IPC（main → renderer）发一个 toast 通知：

| 触发场景 | toast 文案（中文） | 严重程度 |
|---|---|---|
| 检测到非 `u-api-default` 的 LLM 连接被加进 config.json | `检测到非授权的 LLM 连接已被自动移除（U-API 中转站锁定）` | warning |
| `baseUrl` 字段被改 → 被重置 | `检测到 baseUrl 被篡改，已自动恢复为官方中转站地址` | warning |
| `providerType` 被改 → 被重置 | `检测到 providerType 被篡改，已自动恢复` | warning |
| 全部连接被删 → 注入空骨架 | （不 toast——这是首次启动正常流程，详见 §4 第 3 步说明） | — |

**实现指引**（参考 — 实施 AI 真改时按当时上游 IPC 模式调整）：

```typescript
// packages/shared/src/config/storage.ts: enforceUApiBaseUrl 内
function enforceUApiBaseUrl(config: StoredConfig): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const beforeCount = config.llmConnections?.length ?? 0;

  // ... existing filter / reset logic ...

  if (filtered.length < beforeCount) {
    reasons.push('unauthorized_connection_removed');
  }
  if (baseUrlReset) {
    reasons.push('base_url_reset');
  }
  if (providerTypeReset) {
    reasons.push('provider_type_reset');
  }

  return { changed: reasons.length > 0, reasons };
}

// 调用方（migrateLegacyLlmConnectionsConfig 内部，启动后期）
const { changed, reasons } = enforceUApiBaseUrl(config);
if (changed) {
  needsSave = true;
  // 通过现有 main → renderer toast IPC 通道（如 mainWindow.webContents.send('toast', {...})）
  // 把 reasons 传给 renderer，renderer i18n 翻译为对应中文文案
  enqueueStartupToast({
    severity: 'warning',
    i18nKey: 'llm.enforce_reset',
    metadata: { reasons },
  });
}
```

**为什么不直接 alert 阻塞**：
- 启动期 main 进程还没准备好 modal——会卡死流程
- toast 是"事后告知"模式，符合"系统已自愈"的语义
- 用户若没看 toast，不影响应用使用——只是少一次知情

**i18n key（待 03-ui-lockdown-spec § i18n 表新增）**：
- `llm.enforce_reset.unauthorized_connection_removed` → `检测到非授权的 LLM 连接已被自动移除（U-API 中转站锁定）`
- `llm.enforce_reset.base_url_reset` → `检测到 baseUrl 被篡改，已自动恢复为官方中转站地址`
- `llm.enforce_reset.provider_type_reset` → `检测到 providerType 被篡改，已自动恢复`

**验收（加进 09-test-checklist §13.x）**：
1. 关闭应用 → 编辑 `~/.u-agents/config.json` 把 `llmConnections[0].baseUrl` 改成 `https://api.openai.com` → 启动应用
2. 应看到 warning toast「检测到 baseUrl 被篡改，已自动恢复为官方中转站地址」
3. config.json 实际内容已被改回 `https://token.u-studio.cn/v1`

**与 §3.1 LLM 入口锁定的关系**：本 SOP 是 §3.1 锁定的"用户感知层"——锁定不仅"代码层硬重置"，UI 层也要让用户知道发生了什么。

---

## 5. 默认连接构造器

```typescript
// 新建文件：packages/shared/src/config/u-api-defaults.ts
export const U_API_BASE_URL = 'https://token.u-studio.cn/v1';
export const U_API_SLUG = 'u-api-default';
export const U_API_NAME = 'U-API';
export const U_API_CONSOLE_URL = 'https://token.u-studio.cn/console/token';  // 创建/管理 API Key
export const U_API_TOPUP_URL   = 'https://token.u-studio.cn/console/topup';  // 充值
export const U_API_PRICING_URL = 'https://token.u-studio.cn/pricing';         // 模型清单/定价

export function buildDefaultConnection(): LlmConnection {
  return {
    slug: U_API_SLUG,
    name: U_API_NAME,
    providerType: 'pi_compat',
    baseUrl: U_API_BASE_URL,
    authType: 'api_key_with_endpoint',
    customEndpoint: {
      api: 'anthropic-messages',  // 默认 Claude 协议
      supportsImages: true,
    },
    models: [],                  // 启动期未认证骨架允许为空；onboarding 提交时必须覆盖（详见 §3.3）
    // LlmConnection.defaultModel 是可选字段；启动期未认证骨架直接省略，避免被 UI 误判为已配置模型
    modelSelectionMode: 'userDefined3Tier',
    createdAt: Date.now(),
  };
}
```

> `buildDefaultConnection()` 只用于 `enforceUApiBaseUrl` 在“无连接、未完成 onboarding”时注入未认证骨架；它不代表已完成配置。
> M1 onboarding 表单仍预填 `gpt-5.5`，提交时必须把用户接受/修改后的 model ID 写入 `models` + `defaultModel`（详见 §3.3）。
> 进入主界面后可在设置页 §2.3 添加更多模型并切换默认。

---

## 6. UI 改造点（高层指引）

详细 UI 锁定清单见 `.planning/03-ui-lockdown-spec.md`，本节只列与 LLM 相关的：

### 6.1 Onboarding 流程
- `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`
  - **M1 首选**：状态机不再路由到此步骤，组件保留代码不动（详见 `04-feature-cuts.md` §1.1 + `03-ui-lockdown-spec.md` §1.3）
- `apps/electron/src/renderer/hooks/useOnboarding.ts`
  - 主状态机从 `welcome` / Windows `git-bash` 后直接进入 `credentials`，并默认选择 `apiSetupMethod = 'u_api'`
- `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx`
  - 作为 `ApiSetupMethod` 类型源 / legacy selector 同步新增 `'u_api'`，但 M1 主流程不渲染旧 method 选择页
- `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx` + `apisetup/ApiKeyInput.tsx`
  - U-API 模式只显示：Token 输入框 + 协议二选一（默认 anthropic-messages）+ **模型 ID 输入框**（必填，预填 `gpt-5.5` 占位，可改）
  - **不再使用**"去添加模型"延后引导——M1 强制 onboarding 内必须填模型 ID（详见 §3.3 + `03-ui-lockdown-spec.md` §1.6）
  - 提交按钮禁用规则：Token 空 / 模型 ID 空时灰显

### 6.2 设置页
- **主文件**：`apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`（1078 行，详见 `03-ui-lockdown-spec.md` §2.1）
- 其他 `apps/electron/src/renderer/components/settings/` 下的子组件（SettingsRow、SettingsCard 等）以实时 grep 为准——它们是通用基础组件，不是 AI 连接专属页面
- **改造内容（M1 v0.9.1 软锁定 — 多连接版本，自 commit `8ebe8c0` 之后修订）**：
  - "AI Connections" 设置页：**保留"Add new connection"按钮**。点击后弹出与 onboarding 一致的 U-API 表单（Token + 协议二选一 + 模型 ID）—— **不弹 provider 选择菜单**。新连接 slug 由 `useOnboarding.ts:resolveSlugForMethod` 生成 `u-api-2` / `u-api-3`...（首装连接保持 `u-api-default`）
  - "Default connection" 选择器：**保留**——用户在所有 U-API 连接里选默认。写入 `config.defaultLlmConnection`
  - 编辑现有连接时：隐藏 baseUrl 输入框、隐藏 providerType 切换、显示协议二选一、**新增 Connection name 可改**（用户给每个 Key 起识别名，如 "国产模型 Key"）
  - **辅助链接（仅 Token 输入框下方一组，2026-05-04 UI 简化后的最终形态）**：
    - "获取 Token" (`uapi.linkGetToken`) → `U_API_CONSOLE_URL`
    - "查看可用模型与定价" (`uapi.linkPricing`) → `U_API_PRICING_URL`
    - **❌ 不再有的元素（已删除，不要再加回 — 保留此处记录避免上游同步时回归）**：
      - "Token 由 U-API 中转分发，地址固定不可改" 提示 banner（旧 i18n key `uapi.lockNotice`）
      - "管理 Token" 链接（旧 i18n key `uapi.linkConsole`）
      - "充值" 链接（旧 i18n key `uapi.linkTopup`）
      - 上述 3 个 i18n key 已从所有 7 个 locale 删除；同步上游若引入新 lockNotice / 充值入口，必须保持删除状态
  - "管理模型"区块：列表 + 添加按钮 + 上述两个链接
  - **删除连接按钮**：**多连接时可见可点击**；当前连接是最后一个 U-API 连接时 disabled（保护"至少留一个连接"约束 — 与 §3.1 LLM 入口锁定一致，避免用户删光后无可用连接）

#### 6.2.1 多连接的合规约束（不能松动）

无论用户加多少个 U-API 连接，每个连接都必须满足下列约束 —— 由 [`storage.ts:enforceUApiBaseUrl()`](../packages/shared/src/config/storage.ts) 在每次启动时强制重置（详见 §4.1）：

| 字段 | 锁死值 | 校验位置 |
|---|---|---|
| `providerType` | `'pi_compat'` | `enforceUApiBaseUrl` |
| `baseUrl` | `U_API_BASE_URL` (即 `https://token.u-studio.cn/v1`) | `enforceUApiBaseUrl` |
| `authType` | `'api_key_with_endpoint'` | `enforceUApiBaseUrl` |
| slug 命名 | `'u-api-default'`（首装）或 `'u-api-N'`（N≥2，由 `resolveSlugForMethod` 生成）| `useOnboarding.ts:apiSetupMethodToConnectionSetup` |
| `slug` 识别 | helper `isUApiSlug(slug)` 在 `u-api-defaults.ts`：匹配 `'u-api-default'` 或 `/^u-api-\d+$/` | 全部判定点（见 §6.2.2）|

**用户可自由配置的字段**：`apiKey`、`name`（连接名）、`customEndpoint.api`（协议二选一）、`customEndpoint.supportsImages`、`models[]`、`defaultModel`、`piAuthProvider`（按 api 自动派生）。

> **`supportsImages` 字段语义（v21 P2 精确化）**：U-API 体系内有两层 `supportsImages`：
> - **连接级**：`customEndpoint.supportsImages`（boolean，默认 `true`）—— endpoint 整体的 image 支持默认值，决定 UI 是否暴露图片上传按钮入口；
> - **per-model**：`models[i].supportsImages`（boolean，可选）—— **每个模型独立 override**，存在则覆盖连接级默认。
>
> 代码契约（详见 `packages/shared/CLAUDE.md` "Custom endpoint model capabilities" 段）：
> 1. **`supportsImages: false` 在 model 级别必须保留为有效 override**——即使连接级默认 `true`，某个模型设 `supportsImages: false` 也必须真生效（图片附件不会发给该模型）；
> 2. **运行时 capability 刷新**：`llmConnections.SAVE` handler 通过 `SessionManager.refreshConnectionRuntime` 主动推送给 active Pi custom-endpoint 会话；惰性路径 `getOrCreateAgent` 作 backstop；
> 3. **send-time gating**：session 层在发送时再次 gate 图片附件，subprocess 刷新失败时也不会把图片发给已禁用 image 的模型。
>
> **结论**：用户在 UI 配置 `customEndpoint.supportsImages` 是改连接级默认；如要让单个模型禁用 image，应改 `models[i].supportsImages = false`（而不是关连接级默认导致所有模型都禁用）。

#### 6.2.2 `isUApiSlug` 改造点（必加 `// U-API:` 标记 — CLAUDE.md §3.7）

| 文件 | 旧条件 | 新条件 |
|---|---|---|
| `storage.ts:1635` 用户 model 列表保护 loop | `if (connection.slug === U_API_SLUG) continue;` | `if (isUApiSlug(connection.slug)) continue;` |
| `storage.ts:enforceUApiBaseUrl` 主体 | filter 单一 slug → 抛弃其他连接 | 遍历所有连接强制约束；只在 0 个 U-API 连接时 push 默认；`defaultLlmConnection` 只在指向无效 slug 时 fallback |
| `provider-metadata.ts:88` | `if (slug === 'u-api-default')` | `if (isUApiSlug(slug))` |
| `AiSettingsPage.tsx:572-573 uApiConnections` | `c => c.slug === U_API_SLUG` | `c => isUApiSlug(c.slug)` |
| `AiSettingsPage.tsx:559` `getApiKeyMethodForConnection` | `if (conn.slug === U_API_SLUG) return 'u_api'` | `if (isUApiSlug(conn.slug)) return 'u_api'` |
| `AiSettingsPage.tsx:191` `isUApiConnection` | `connection.slug === U_API_SLUG` | `isUApiSlug(connection.slug)` |
| `useOnboarding.ts:101` BASE_SLUG_FOR_METHOD `u_api` | `U_API_SLUG`（即 `'u-api-default'`）| `'u-api'`（让 `resolveSlugForMethod` 生成 `u-api`、`u-api-2`、`u-api-3`...；首装时 `u-api` 作为 base 与既有的 `u-api-default` 不冲突；migration 兼容见 §6.2.3）|
| `useOnboarding.ts:161` case `'u_api'` 硬写 slug | `slug: U_API_SLUG` | `slug: resolveSlugForMethod('u_api', editingSlug, existingSlugs)` |

> ⚠️ 上列每处改动都必须加 `// U-API:` 单行注释或 `/* U-API START/END */` 块（详见 CLAUDE.md §3.7）。

#### 6.2.3 Migration 兼容

- 既有用户（v0.9.0 装机）的 `config.json` 里只有一个 `slug='u-api-default'` 的连接 —— 升级后 `isUApiSlug('u-api-default') === true`，所有判定点继续匹配，**无需 migration**。
- BASE_SLUG_FOR_METHOD 改成 `'u-api'`（不带 `-default` 后缀）：第一次新增连接时，`resolveSlugForMethod('u_api', null, {'u-api-default'})` 返回 `'u-api'`（因为 `u-api-default` 不等于 `u-api`，base 没被占用）。第二次新增返回 `'u-api-2'`，依此类推。
- `isUApiSlug` regex 必须同时匹配 `'u-api-default'`、`'u-api'`、`'u-api-2'`、`'u-api-3'`...：`slug === 'u-api-default' || /^u-api(-\d+)?$/.test(slug)`

#### 6.2.4 `midStreamBehavior` 字段策略（v0.9.1+ 上游引入）

**背景**：upstream v0.9.1（commit `b31904c6`，2026-05-06）引入 `connection.midStreamBehavior` 字段，控制用户在 agent mid-stream 时发后续消息的行为：`'steer'`（注入到当前 turn）或 `'queue'`（等当前 turn 结束再发）。详见 [`07-upstream-sync.md`](07-upstream-sync.md) C10。

**U-API 模板策略：不写入字段，依赖上游兜底**：
- `BUILT_IN_CONNECTION_TEMPLATES['u-api']` 保持 §3.7 #5 原样，**不增加 `midStreamBehavior` 字段**
- 上游 [`packages/server-core/src/domain/connection-setup-logic.ts`](../packages/server-core/src/domain/connection-setup-logic.ts) `createBuiltInConnection()` 通过 `defaultMidStreamBehavior(providerType)` 自动按 providerType 兜底：`anthropic → 'queue'`，`pi/pi_compat → 'steer'`
- 我们 `providerType: 'pi_compat'` → 自动落 `'steer'`（与上游 craft-agents-oss 默认行为一致）
- `resolveMidStreamBehavior()` 对老 `config.json` 缺字段做 fallback，**既有用户配置零迁移压力**

**为什么不在模板硬写**：
- 上游设计就是"模板不存这个字段"，硬写会跟上游 fallback 逻辑分叉，下次同步时 git auto-merge 易引入死代码
- 跟 §3.6 双品牌区分原则一致：U-API 仅锁 baseUrl + providerType + authType，不主动定义其他行为字段

**enforceUApiBaseUrl 必须保留新字段（C10 同步规则）**：
- §3.7 #1 `enforceUApiBaseUrl` 重写连接的逻辑必须**保留** `midStreamBehavior`（如果用户已经设置过）
- 参考上游 [`storage.ts:2585`](../packages/shared/src/config/storage.ts) `updateLlmConnection` 的字段覆盖列表
- 下次同步若上游再增 connection 字段（M3 期可能加 `temperature` / `topP` 等），同样处理：`enforceUApiBaseUrl` 透传，不要因为模板里没定义就丢字段。详见 [`07-upstream-sync.md`](07-upstream-sync.md) §2.7c C10

### 6.3 Provider 元信息
- `packages/shared/src/config/provider-metadata.ts`
  - **新增**一个 entry：

```typescript
'u-api': {
  name: 'U-API',
  statusPageUrl: 'https://u-agents.u-studio.cn/status',  // 待开发者建立，建议挂主域 /status 路径
  dashboardUrl: 'https://token.u-studio.cn/console/token',  // 用户管理 Token / 充值的入口
}
```

  - 当前 `getProviderMetadata` 签名只按 provider 维度取 metadata，不能直接判断 `slug`；M1 需要二选一：扩展签名让调用方传入 `slug`，或新增 `getProviderMetadataForConnection(connection)` 包装函数，在 `connection.slug === 'u-api-default'` 时返回上面这个 entry
  - 错误提示中"打开 dashboard"按钮一律跳转到 `dashboardUrl`（即 console/token）
  - **模型清单/定价 URL** 不放在上游 `ProviderMetadata` interface 里（避免和上游字段冲突），改为在 `u-api-defaults.ts` 中独立导出 `U_API_PRICING_URL`，由我们的 UI 调用点直接引用

---

## 7. 错误处理

### 7.1 Token 无效 / 过期
- newapi 通常返回 `401`
- UI 显示提示："Token 已失效，请到 U-API 控制台检查或重新生成"
- 按钮："打开 Token 控制台" → `U_API_CONSOLE_URL` (`https://token.u-studio.cn/console/token`)

### 7.2 中转站不可达
- 网络错误 / 5xx
- UI 显示："连接 U-API 服务失败" + "查看服务状态"链接 → `https://u-agents.u-studio.cn/status`

### 7.3 模型不存在 / 不可用
- newapi 返回 `404` 或类似
- UI 显示："所选模型在当前 Token 套餐中不可用，请查看可用模型清单或更换"
- 按钮："查看可用模型与定价" → `U_API_PRICING_URL` (`https://token.u-studio.cn/pricing`)

### 7.4 余额不足
- newapi 返回特定错误（具体 code 待开发者确认）
- UI 显示："余额不足，请充值"
- 按钮："前往充值" → `U_API_TOPUP_URL` (`https://token.u-studio.cn/console/topup`)

---

## 8. 与上游协议变更的兼容性

上游可能在未来：
- 新增 `providerType`（如 `'aws-bedrock-direct'`）
- 改造 `customEndpoint` 字段结构
- 调整 `LlmConnection` 字段

每次同步上游时（详见 `.planning/07-upstream-sync.md`），必须：

1. 检查 `packages/shared/src/config/llm-connections.ts` 是否有 `LlmConnection` interface 字段变更
2. 检查 `customEndpoint` 是否有新协议（如 `'gemini'`、`'cohere'`），评估是否要让 U Agents 用户选
3. 检查 `enforceUApiBaseUrl` 在新版迁移流水线中是否仍生效
4. 如果上游引入了新的 provider 选择 UI，**默认裁剪**（不让用户看见）

---

## 9. Token 安全规则

### 9.1 公开信息 vs 敏感信息

| 项 | 性质 | 处理 |
|---|---|---|
| `U_API_BASE_URL` (`token.u-studio.cn/v1`) | 公开 | 客户端硬编码 OK，反编译即可见，**不是秘密** |
| `U_API_CONSOLE_URL` / `U_API_TOPUP_URL` / `U_API_PRICING_URL` | 公开 | 同上 |
| 用户的 Token（API Key）| **敏感** | 必须走系统凭证管理器加密存储；**严禁** log / 截图 / 上报 |

### 9.2 Token 处理硬规则

1. **存储**：通过上游 `packages/shared/src/credentials/` 凭证管理器加密存储，不写明文 `config.json`。
   - 上游**不**用 OS Keychain，而是用**自建 AES-256-GCM 加密文件**（位置：`<CONFIG_DIR>/credentials.enc`，M1 改名后是 `~/.u-agents/credentials.enc`）
   - 加密密钥从 OS 硬件 UUID 派生（macOS: `IOPlatformUUID` / Windows: `MachineGuid` / Linux: `/var/lib/dbus/machine-id`）
   - 文件用 PBKDF2 + AES-GCM，文件 magic header 为 `"CRAFT01\0"`（**故意保留不改**——改了会破坏既有文件解密；用户用 `hexdump` 才能看到）
   - **副作用**：用户**不能**通过拷贝 `credentials.enc` 把 Token 迁到另一台机器（密钥绑定本机硬件 UUID），必须通过 Onboarding 重新输入
2. **日志**：任何 log（main.log、Sentry、控制台输出）中**禁止**完整打印 Token
   - 调试时若需识别 Token，最多打印前 4 + 后 4 字符（如 `sk-a***xyz0`）
   - **Round 33 HHHH 补**：`apps/electron/src/main/index.ts:1034-1038` 通过 `Sentry.setTag()` 标记用户的 LLM 元数据（authType / providerType / hasCustomEndpoint / model / workspaceCount）。M1 阶段 enabled=false 时 setTag 是 noop ✓；**M3 自建 Sentry 启用前必须 review 这 5 个 setTag 调用**——`hasCustomEndpoint` 等 tag 会泄露用户配置元数据（不是 Token，但是连接拓扑），自建 Sentry 时按需脱敏（如把 `model` 字符串 hash 后上报）
3. **错误提示**：UI 错误 toast / dialog 中不要回显 Token
4. **HTTP 请求头**：除了发往 `token.u-studio.cn` 的请求 `Authorization` header 外，任何请求体 / 元数据中不能携带 Token
5. **崩溃报告**：
   - M1 阶段：Sentry 禁用（`SENTRY_ELECTRON_INGEST_URL` 不设置 → 上游 `enabled: !!process.env.X` 守卫自动让 Sentry 完全不工作，详见 `LEGAL.md` §5.3）
   - M3 自建 Sentry 时：**保留**上游 `apps/electron/src/main/index.ts:20` 的 `beforeSend(event)` 钩子（上游已实现 PII scrubbing，移除 authorization headers 与 credential-like values），并扩展确保 Token 不上报

### 9.3 与上游的交叉点

上游 `packages/shared/src/unified-network-interceptor.ts` 已有 SSE 流处理逻辑。在它打日志/打 metric 时，确认不会把 `Authorization` 头泄露出来。

**已确认上游 redact 列表**（`unified-network-interceptor.ts:1871-1890`，`headersToCurlFlags()` 函数中的 `sensitiveKeys`）：
- `authorization`
- `x-api-key`
- `cookie`

curl 调试输出 / debug log / 错误堆栈中含上述 header 时会自动替换为 `<REDACTED>`。

每次同步上游后**必须**：

1. 人工 review `unified-network-interceptor.ts` 的 diff，看是否引入了新的 log 路径
2. 若新增了 `DEBUG=*` 类详细日志开关，确认 `Authorization` / `x-api-key` / `cookie` 仍在 redact 列表中
3. 若上游加入了新的 sensitive header（如 `x-bearer-token`、`x-account-id`），把它追加到 `sensitiveKeys`，并在本节列表更新

---

## 10. 验收标准（M1 完成判定）

- [ ] 全新启动应用，onboarding 让用户输入：Token + 选协议 + **填写至少 1 个 model ID**（预填 `gpt-5.5` 占位，可改）
- [ ] 进入应用后，"AI Connections" 设置页只显示一个连接：U-API
- [ ] 编辑连接时看不到 baseUrl 输入框
- [ ] 用户手动编辑 `~/.u-agents/config.json` 把 baseUrl 改成 `https://api.openai.com`，重启后 baseUrl 自动恢复为 `https://token.u-studio.cn/v1`（配置文件位置由 `paths.ts:CONFIG_DIR` 决定，详见 `01-branding-spec.md` §2.15）
- [ ] 用户手动添加一个 `slug: 'anthropic-direct'` 的连接到 config.json，重启后这个连接被自动删除
- [ ] **onboarding 不允许 `models` 为空**（前端拦截提交按钮 + IPC handler 强校验，详见 §3.3）
- [ ] 用户进设置页**手动删光**所有模型后，主界面显示"请先添加模型"引导（边缘场景）
- [ ] 协议切换：Claude 模型走 anthropic-messages 时能正常对话；GPT 模型走 openai-completions 时能正常对话
- [ ] Token 错误时 UI 提示中文 + 含跳转 `https://token.u-studio.cn/console/token` 的按钮
- [ ] `provider-metadata.ts` 中的 `u-api` entry 在错误流程中被正确取到（不会显示 "Anthropic" / "OpenAI" 等上游品牌名）
