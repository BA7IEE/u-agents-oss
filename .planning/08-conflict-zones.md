# 08 — 高冲突文件清单

> 上游同步时**最容易出问题**的文件。修改这些文件前，AI 必须停下问用户。
> 本文与 `07-upstream-sync.md` 配套：07 写流程，本文写"为什么这些文件危险 + 怎么处理"。

---

## 分类

冲突文件分三个等级：

| 等级 | 含义 | 出现冲突时 |
|---|---|---|
| 🔴 **核心锁定**（7 类）| 我们的差异化逻辑直接写在这些文件里 | **优先保留我们的版本**，再手动挑上游变更 |
| 🟡 **品牌密集**（10+ 个）| 文件本身没差异化逻辑，但每行都有"Craft" 字面量需要替换 | **用上游的版本**，然后跑 `01-branding-spec.md` 替换 |
| 🟢 **依赖密集**（3 个）| `bun.lock` / `package.json`（依赖变更） | 自动合并，遇冲突重跑 `bun install` |

---

## 🔴 核心锁定（7 类）

### 1. `apps/electron/electron-builder.yml`

**为什么冲突**：上游每次改动构建配置（新平台、新 publish 方式、新 extraResources）都会动这个文件。我们改了 `appId` / `productName` / `copyright` / `publish.url` / `artifactName` / `dmg.title` / `linux.maintainer` 7 个关键字段。

**我们的差异点**（详见 `01-branding-spec.md` §2.1）：
- 第 1 行 `appId: cn.u-studio.u-agents`
- 第 2 行 `productName: U Agents`
- 第 3 行 `copyright: Copyright © 2026 U Studio`
- 第 83 行 `publish.url: https://update.u-agents.u-studio.cn/latest`
- 第 133/141/166/219 行 `artifactName: U-Agents-...`
- 第 147 行 `dmg.title: U Agents`
- 第 214 行 `linux.maintainer: U Studio <support@u-studio.cn>`

**冲突处理**：
1. 接受上游对**其他**字段的修改（`extraResources`、`files`、`mac.target` 等）
2. 用 `git checkout --ours apps/electron/electron-builder.yml` 拒绝上游对**我们 7 个字段**的修改（如果上游也碰了这些字段）
3. 用 `diff` 工具人工 review 整个文件，确保 7 个字段仍是 U Agents 值
4. 跑 `01-branding-spec.md` §8 命令 4 验证 `com.lukilabs` 不残留

### 2. `packages/shared/src/branding.ts`

**为什么冲突**：上游可能改 `CRAFT_LOGO` ASCII art、改 `VIEWER_URL` 域名、加新常量。

**我们的差异点**：
- `VIEWER_URL = 'https://u-agents.u-studio.cn'`
- `CRAFT_LOGO` 替换为 U Agents ASCII art（保留旧名作 alias）

**冲突处理**：
1. 优先保留我们的 `VIEWER_URL`
2. 上游新增的常量直接接受
3. ASCII art 比对：如果上游优化了排版（如对齐方式），把优化应用到我们的 U Agents art
4. 验收：grep 应仅找到 `u-studio.cn`，不应有 `craft.do`

### 3. `packages/shared/src/config/llm-connections.ts`

**为什么冲突**：上游不断在加新 `LlmProviderType`、改字段、新 `customEndpoint.api` 协议。这是 LLM 抽象的核心。

**我们的差异点**：理论上**零**——我们没改这个文件本身，只是在**调用点**强制传 `pi_compat`。但上游一旦引入新 providerType，我们必须评估：
- 是否要让 U-API 用户选这个新协议？（一般不要）
- 是否需要在 `enforceUApiBaseUrl` 中显式过滤掉？（要）

**冲突处理**：
1. 完全接受上游修改
2. **每次同步后都必须 review 这个文件的 diff**，看是否有：
   - 新 `LlmProviderType` 值 → 评估 + 在 `04-feature-cuts.md` §1.2 表中追加
   - 新 `customEndpoint.api` 协议 → 评估是否要新增 U-API 协议选项
   - `LlmConnection` interface 字段变更 → 评估 `u-api-defaults.ts` 是否需要更新

### 4. `packages/shared/src/config/provider-metadata.ts`

**为什么冲突**：上游不断加新 provider entry。我们加了一个 `'u-api'` entry。

**我们的差异点**：
- 新增一个 entry：`'u-api': { name: 'U-API', statusPageUrl, dashboardUrl }`
- 修改 `getProviderMetadata` 函数：当 `providerType === 'pi_compat' && slug === 'u-api-default'` 时返回 `'u-api'` entry

**冲突处理**：
1. 接受上游对其他 entry 的修改
2. **保留**我们的 `'u-api'` entry 和 `getProviderMetadata` 修改
3. 如果上游也改了 `getProviderMetadata` 的签名/行为，需要把我们的逻辑迁移到新签名上

### 5. `apps/electron/src/renderer/components/onboarding/`（整个目录）

**为什么冲突**：onboarding 是用户首次体验入口，上游频繁迭代——加 OAuth provider、加 Welcome 教程、改步骤顺序。

**我们的差异点**：
- `useOnboarding.ts` —— 主状态机跳过 `'provider-select'` 和 `'local-model'`，直接 `welcome/git-bash → credentials`
- `OnboardingWizard.tsx` —— 只保留渲染兜底，旧步骤分支不应被 M1 路由命中
- `APISetupStep.tsx` —— 新增 `'u_api'` ApiSetupMethod / legacy selector 类型来源
- `CredentialsStep.tsx` —— 新增 `'u_api'` 渲染分支，复用 `ApiKeyInput mode="u_api"`
- `apisetup/ApiKeyInput.tsx` —— 新增 `mode === 'u_api'` 简化分支

**冲突处理**：
1. **逐文件**审查 diff
2. 优先保留我们 `'u_api'` 路径的代码
3. 接受上游对**其他** ApiSetupMethod 路径的修改
4. 如果上游引入新的 `OnboardingStep`（如 `'feature-tour'`），评估是否要让 U Agents 用户也走这个步骤
5. 跑 `03-ui-lockdown-spec.md` §5 验收清单

### 6. `packages/shared/src/auth/state.ts`（**新增高冲突文件**）

**为什么冲突**：U-API onboarding 启动逻辑依赖此文件的 keyless 判断。上游 `state.ts:290-310` 的 keyless 路径是为 Ollama 等本地端点设计的，**对 U-API 有破坏性副作用**。

**我们的差异点**：
- `state.ts:296-299` 的 keyless 判断需要加 U-API slug 特判：
  ```typescript
  if (!apiKey && connection.baseUrl) {
    const isUApi = defaultConnectionSlug === 'u-api-default';
    hasCredentials = !isUApi;  // U-API 必须有 Token
  }
  ```
- 详见 `02-llm-gateway-spec.md` §4.1

**冲突处理**：
1. 每次同步上游必须 review `state.ts:290-310` 这段 diff
2. 上游若把 keyless 路径改了实现方式（如改成基于 providerType 而非 baseUrl 判断），同步迁移我们的特判
3. 验收：跑 `09-test-checklist.md` §3.5 验证"骨架不应让 isFullyConfigured=true"

### 7. `packages/server-core/src/domain/connection-setup-logic.ts`（**新增高冲突文件**）

**为什么冲突**：M1 改造涉及此文件的 4 处：
1. `BUILT_IN_CONNECTION_TEMPLATES` 加 'u-api-default' entry（详见 `03-ui-lockdown-spec.md` §1.10.1）
2. `validateSetupTestInput` 函数签名扩展为接受 `customEndpoint`，并修改判断逻辑（详见 `02-llm-gateway-spec.md` §4.2）
3. `resolveCustomEndpointSetup` 已经派生 piAuthProvider，本身不改但要 review
4. `PI_AUTH_PROVIDER_DISPLAY_NAMES` 是 provider 全表（详见 `04-feature-cuts.md` §1.2 实时扫描原则）

**冲突处理**：
- 同步时按 4 处分别 diff review
- 我们的 'u-api-default' 模板和扩展后的 validateSetupTestInput 必须保留
- 上游若加新 `BUILT_IN_CONNECTION_TEMPLATES` entry 默认裁剪（不暴露 UI）

---

## 🟡 品牌密集（10+ 个）

这些文件每次同步几乎都会有冲突，但冲突逻辑简单：**接受上游内容 → 跑品牌替换 → 完成**。

| 文件 | 含 craft 字面量数 | 处理 |
|---|---|---|
| `packages/shared/src/i18n/locales/en.json` | ~10 处 | 接受上游 → grep + 替换 "Craft" → "U Agents" |
| `packages/shared/src/i18n/locales/zh-Hans.json` | ~10 处 | 同上，配合 `10-i18n-zh.md` 中文用语调整 |
| 其他 i18n locale 文件（es/de/ja/pl/hu/ko/ru等） | 各 ~10 处 | 同上（如果决定支持这些语言） |
| `apps/electron/src/renderer/components/AppMenu.tsx` | 1 处 craft.do/docs 链接 | 替换链接 |
| `apps/electron/src/renderer/components/app-shell/TopBar.tsx` | 2 处 | 同上 |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 2 处 | 同上 |
| `apps/electron/src/main/menu.ts` | 1 处 | 同上 |
| `apps/electron/src/main/auto-update.ts` | 注释中 1 处 craft.do | 替换注释 |
| `packages/shared/src/version/manifest.ts` | VERSIONS_URL | 替换 URL |
| `packages/shared/src/docs/doc-links.ts` | DOC_BASE_URL | 替换 URL |
| `packages/shared/src/sources/builtin-sources.ts` | 内置 Source URL | 隐藏/禁用 entry（首选 feature flag；末选移除）—— 详见 `04-feature-cuts.md` §4.1 |
| `packages/shared/src/agent/claude-agent.ts:852` | 1 处 | 同上 |
| `packages/session-mcp-server/src/index.ts` | docs upstream proxy 整段 | 禁用 `DOCS_MCP_URL`、`connectDocsUpstream()`、`docsTools` 合并、`isDocsUpstreamTool` 分流与 `callDocsUpstream` 代理；不只是删除常量 |
| `packages/shared/src/utils/toolNames.ts` / `docs/source-guides.ts` / `sources/storage.ts` | craft-agents-docs 工具/引导/注入 | 与 `04-feature-cuts.md` §4.1 同步完全裁剪 |
| `packages/shared/src/validation/url-validator.ts` | mcp.craft.do 专用校验路径 | 禁用/裁剪 mcp.craft.do 专用路径；不得删除 `url-safety.ts` / callback / deeplink 中的通用 URL 安全校验 |
| `packages/shared/src/prompts/system.ts:570` | Co-Authored-By | 替换邮箱 |
| `apps/viewer/src/components/Header.tsx` | href | 替换 URL |
| 所有 `package.json`（15 个） | `"name": "@craft-agent/..."` 等 | 整批 sed 替换为 `@u-agents/...` |
| 根 README / SECURITY / CODE_OF_CONDUCT / CONTRIBUTING | 上游安装、支持、贡献、商标段 | README 可重写为 U Agents；SECURITY/CODE_OF_CONDUCT 支持邮箱必须改为自有渠道；不要误动 `LICENSE` / `NOTICE` / `TRADEMARK.md` 本体 |
| `docs/cli.md` / `apps/electron/README.md` / `packages/*/README.md` / `packages/*/CLAUDE.md` | `craft-cli`、`@craft-agent/*`、`~/.craft-agent`、多 provider 示例、包级上游指令 | 若 M1 不发布则标注“不发布范围”；若进入官网/npm/GitHub 对外页面，必须改为 U Agents / U-API 或隐藏 |

**统一处理流程**：
1. 接受上游所有内容
2. 跑 `01-branding-spec.md` §8 的 4 个 grep 命令
3. 命中的位置按 `01-branding-spec.md` §2-§7 逐项替换

---

## 🟢 依赖密集（3 个）

### 1. `bun.lock`

**冲突常见原因**：上游加 / 升级依赖。

**处理**：直接用上游版本 → 跑 `bun install` 重新生成。

### 2. `package.json`（根）

**我们的差异点**：
- `"name": "u-agents"`（非 "craft-agent"）
- `"version"` **跟随上游 release tag**（**决策变更**：详见 `01-branding-spec.md §4.1`；M1 首版 `0.9.0`，hotfix 用 `0.9.0+u-agents.N` 附加 build metadata；不独立编号）
- 有可能新加我们自己的 dependencies

**处理**：手动合并，保留 `name` 不变；**`version` 字段直接接受上游值**（每次同步上游版本号自动跟随）；接受上游 dependencies 增删。

### 3. `apps/electron/package.json` 等子 package.json

**我们的差异点**：
- `"name": "@u-agents/..."`（非 `@craft-agent/...`）
- `"homepage"` / `"email"` 字段已替换

**处理**：保留 name + homepage + email；接受其他修改。

---

## 处理冲突的通用决策树

```
冲突文件出现
   ↓
是 .md 文档（包括 README）？──── 是 ──→ 完全接受上游，再决定是否要重写为 U Agents 风格
   ↓ 否
是 LICENSE / NOTICE / TRADEMARK.md？── 是 ──→ 完全接受上游（不改这些文件）
   ↓ 否
是核心锁定（🔴 7 类之一）？──── 是 ──→ 按本文 §1-§7 逐项处理
   ↓ 否
是品牌密集（🟡）？──── 是 ──→ 接受上游 → 跑替换
   ↓ 否
是依赖密集（🟢）？──── 是 ──→ 自动合并 + 重跑 bun install
   ↓ 否
其他文件 ──→ 默认接受上游
```

---

## "应当冲突而没冲突"的危险信号

某些情况下 git 自动合并会"无冲突"地破坏我们的锁定。**每次同步后必须人工核查**这些场景：

| 场景 | 危险点 | 检查方法 |
|---|---|---|
| 上游加新 `LlmProviderType`（如 `'aws-bedrock-direct'`） | `enforceUApiBaseUrl` 不会过滤新值 | grep `LlmProviderType` 看是否有新成员 |
| 上游加新 onboarding 步骤（如 `'feature-tour'`） | 新步骤可能含品牌词或新 provider 入口 | grep `OnboardingStep` |
| 上游加新菜单项（如新 Help 链接） | 可能含 craft.do | 跑 `01-branding-spec.md` §8 命令 2 |
| 上游加新内置 Source | 可能默认指向 craft.do | grep `builtin-sources` 中 url 字段 |
| 上游改 session MCP docs upstream proxy | UI 看不到但工具仍可调用 craft docs MCP | grep `connectDocsUpstream\|docsTools\|SearchCraftAgents\|craft-agents-docs` |
| 上游加新 i18n key 含 "Craft" | 用户可见品牌泄露 | grep en.json 中 "Craft" |
| 上游改 `getProviderMetadata` 签名 | 我们的 'u-api' entry 可能取不到 | typecheck + 跑 `02-llm-gateway-spec.md` §10 验收 |
| 上游改 `customEndpoint.api` 类型 | 用户已存连接可能失效 | 启动后看 storage 迁移日志 |

每次同步**必须**跑 `01-branding-spec.md` §8 + `02-llm-gateway-spec.md` §10 + `03-ui-lockdown-spec.md` §5 三套验收命令。

---

## 同步频率建议

| 上游变化类型 | 我们的应对 |
|---|---|
| Patch（0.9.x → 0.9.y）| 跳过 1 ~ 2 次没关系 |
| Minor（0.9 → 0.10）| **必须**同步并测试 |
| Major（0.x → 1.0）| 谨慎评估，可能需要大重构 |
| 安全更新 | **立即**同步 |

详见 `07-upstream-sync.md`。
