# CLAUDE.md — U Agents (优智体) AI 工作守则

> **本文件优先级最高**。如果其它文档与本文冲突，以本文为准。
> 本文档读完后，必须再读 `PRODUCT.md` 和 `LEGAL.md`，再开始任何动作。

---

## 0. 零号铁律：永不动代码，只搞文档

**本仓库 `u-agents/` 内的 AI 永远只产出 Markdown 文档（`.md`），永远不修改源码或运行会改变代码状态的命令。**

| 允许 | 禁止 |
|---|---|
| Read / Grep / Glob 任何文件（含源码） | Edit / Write 任何 `.ts` / `.tsx` / `.json` / `.yml` / `.yaml` / `.html` / `.css` / `.svg` / `.icns` / `.ico` / `.png` 等源码与配置 |
| Edit / Write `.md`（仅 `u-agents/*.md` 与 `u-agents/.planning/*.md`）| Edit / Write 上游 `packages/` `apps/` `scripts/` 内任何非 `.md` 文件 |
| Bash 只读命令：`ls` / `cat` / `grep` / `find` / `wc` / `git log` / `git status` / `git show` / `git diff` / `git remote -v` | Bash 写入命令：`mv` / `rm` / `cp` / `sed -i` / `git checkout <file>` / `git merge` / `git rebase` / `git pull` / `bun install` / `npm install` |
| 起 `electron` / `bun run` **只读**或**沙箱**调研用法 | 在用户工作区执行任何安装、构建、发版命令 |

**例外**：仅当用户**当次明确指令**（不是引用过往 CLAUDE.md 规则）要求 AI 改代码或跑写入命令时，方可破例。一次破例只覆盖一次任务，不延续。

**为什么**：用户是非职业程序员，依赖 AI 长期维护这个项目。代码改造由用户自己（或他另开的执行会话/外部 AI）按照本仓库 `.planning/` 的规格文档执行。本仓库的 AI 角色只有一个——**写规格、改规格、对照代码核查规格**。这样上游同步、回滚、跨 AI 工具都不会丢失约束。

---

## 1. 项目身份

**U Agents（优智体）** 是基于 Apache 2.0 开源项目 [`craft-agents-oss`](https://github.com/lukilabs/craft-agents-oss) 二次开发的中文桌面 Agent 应用，由独立开发者运营，闭源商业分发。

- **品牌**：U Agents（英文）/ 优智体（中文）
- **发行方**：tungwerl@gmail.com（独立开发者）
- **目标用户**：国内非技术或半技术用户，通过统一 Token 中转站使用 Claude/GPT 等大模型
- **AI 入口**：固定且唯一，地址 `https://token.u-studio.cn/v1`（OpenAI Chat Completions 协议，由 newapi 搭建）

---

## 2. 仓库布局

```
/Users/dengwang/Documents/u-agents-oss/
└── u-agents/                        ← 本仓库（fork 工作区）
    ├── CLAUDE.md                    ← 本文件
    ├── PRODUCT.md                   ← 产品定位与功能边界
    ├── LEGAL.md                     ← 法律合规清单
    ├── .planning/
    │   ├── 01-branding-spec.md      ← 品牌替换全表
    │   ├── 02-llm-gateway-spec.md   ← 中转站接入规格 ⭐
    │   ├── 03-ui-lockdown-spec.md   ← UI 锁定清单
    │   ├── 04-feature-cuts.md       ← 功能裁剪清单
    │   ├── 05-build-release.md      ← 打包发布流程
    │   ├── 06-update-server.md      ← 自建更新服务器
    │   ├── 07-upstream-sync.md      ← 上游同步流程
    │   ├── 08-conflict-zones.md     ← 高冲突文件清单
    │   ├── 09-test-checklist.md     ← 发版回归清单
    │   ├── 10-i18n-zh.md            ← 中文化策略
    │   └── 11-roadmap.md            ← 阶段路线图
    ├── (上游全部源码 ...)
    └── ...
```

Git remote 配置：
- `upstream` → `https://github.com/lukilabs/craft-agents-oss.git`（同步源，**只读**）
- `origin` → 用户自己的私有 fork（待用户提供后设置）

---

## 3. 硬规则（违反即停下问用户）

### 3.1 LLM 入口锁定
**任何情况下，最终用户的 LLM 请求只能通过 `https://token.u-studio.cn/v1`。**
- **baseUrl 固定不可改**（用户不可见、配置文件被篡改时启动强制重置）
- **协议可选**：用户在 "OpenAI Chat Completions" 与 "Anthropic Messages" 之间二选一（newapi 同时支持，对应不同模型最佳实践）
- **模型可选**：管理员预设候选模型清单 + 用户从清单中挑选，或允许填写自定义 model ID
- 不允许在 UI 中暴露 `baseUrl` 输入框
- 不允许出现"Anthropic 直连""Bedrock""Vertex""GitHub Copilot""ChatGPT Plus""Ollama 本地"等 provider 选项
- 修改任何与 LLM 连接相关的代码前，**必读 `.planning/02-llm-gateway-spec.md`**

### 3.2 品牌替换不可遗漏
修改任何下列资源前，**必读 `.planning/01-branding-spec.md`** 并按其执行：
- `apps/electron/electron-builder.yml`（appId / productName / publish.url / artifactName / dmg.title / linux.maintainer）
- `apps/electron/resources/icon.*` 与 `apps/electron/resources/craft-logos/`
- `packages/shared/src/branding.ts`
- 所有 `package.json` 中的 `"name": "@craft-agent/..."` 和 `"homepage"`
- `i18n/locales/` 下的 "Craft Agents" / "Craft" 字面量（中文化阶段处理）
- `apps/electron/src/main/auto-update.ts` 中的更新源
- `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx`

### 3.3 高冲突文件改前必停
下列文件每次被修改前，AI 必须**先停下、向用户确认**，原因是它们直接决定与上游同步时的合并冲突量：
1. `apps/electron/electron-builder.yml`
2. `packages/shared/src/branding.ts`
3. `packages/shared/src/config/llm-connections.ts`
4. `packages/shared/src/config/provider-metadata.ts`
5. `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`
6. `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx`
7. `apps/electron/src/renderer/components/apisetup/`（整个目录）

详见 `.planning/08-conflict-zones.md`。

### 3.4 永不删除/篡改
- `LICENSE` —— Apache 2.0 全文，永远保留
- `NOTICE` —— Craft Docs Ltd. 版权声明，永远保留（这是 Apache 2.0 强制要求）
- `TRADEMARK.md` —— 上游商标政策，可保留作为合规凭证

### 3.4.1 包管理器锁定（强制）
- **只能用 `bun`**，不能换 `npm` / `yarn` / `pnpm`
- 上游 monorepo 用 `bun.lock`（不是 `package-lock.json`）
- 换包管理会破坏 lockfile + 部分 npm scripts 直接调 `bun run tsc` 形式
- 详见 `.planning/11-roadmap.md` 入口条件"Bun（强制）"

### 3.5 不暴露上游品牌
- `Craft` / `Craft Agents` / `craft.do` / `lukilabs` 不能出现在用户可见界面（菜单、对话框、错误提示、邮件签名、提交信息、自动生成的会话 commit 模板）
- **已知瑕疵**（已被用户接受）：第三方 OAuth Source（Slack/Gmail/Outlook）首次授权时，浏览器地址栏会短暂出现 `agents.craft.do`。这是上游 OAuth relay 的硬依赖，路线图 M3 自建 relay 后解决。详见 `LEGAL.md`。

### 3.6 双品牌区分（U Agents vs U-API）
- **U Agents（优智体）** = 桌面应用品牌（产品名、Bundle 标识、窗口标题、安装包名）
- **U-API** = LLM 中转站品牌（在所有 LLM 连接相关 UI、错误提示、控制台跳转里使用）
- 两个品牌不要混用：连接卡片显示 "U-API"，应用关于页显示 "U Agents"

### 3.7 代码改造点统一加 `// U-API:` 标记前缀（**新增，每次同步上游必跑 grep 验证**）

**为什么需要标记**：M1 我们改造了几十处代码（详见 `.planning/01-branding-spec.md` §2 + `.planning/03-ui-lockdown-spec.md` §1.10）。同步上游时这些改造点容易被 git 自动合并"无声破坏"——加统一标记后可以 grep 快速扫描所有改造点。

**标记规范**：
- 单行改造：`// U-API: <改造原因/简述>`
- 多行块：用 `/* U-API START */` 和 `/* U-API END */` 包围
- 必须含"U-API"字样（grep 用，且与上游历史 craft 标记隔离）

**示例**：

```typescript
// state.ts:296-299（详见 02 §4.1）
if (!apiKey && connection.baseUrl) {
  // U-API: 上游 keyless 路径仅给 Ollama 用；U-API 必须有 Token，加特判
  const isUApi = defaultConnectionSlug === 'u-api-default';
  hasCredentials = !isUApi;
}
```

```typescript
/* U-API START: 03 §1.10.1 BUILT_IN_CONNECTION_TEMPLATES 新增 entry */
'u-api-default': {
  name: 'U-API',
  providerType: 'pi_compat',
  authType: 'api_key_with_endpoint',
},
/* U-API END */
```

**M1 必加 `// U-API:` 标记的改造点**（与 `01 §2.0 子节分级总览表`对应）：

> **定位策略说明（REVIEW-2 P1 改进，2026-05-04）**：
> 本表用**函数/变量名**而非硬行号定位——上游同步时行号会漂，符号名稳定。每行用 `grep -n "<符号>" <文件>` 即可定位。
> 标记类型：`单行` = `// U-API: ...`；`块` = `/* U-API START ... */ ... /* U-API END */`。

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 1 | baseUrl 锁定 + 多连接重写 | `packages/shared/src/config/storage.ts` | 函数 `enforceUApiBaseUrl` 整体 | 块 | 02 §4.3 + §6.2.1 |
| 2 | model 列表保护 loop | `packages/shared/src/config/storage.ts` | 注释 `user-managed model lists must not be overwritten` | 单行 | 02 §6.2.2 |
| 3 | startup lock | `packages/shared/src/config/storage.ts` | 注释 `continuous startup lock, not a one-shot migration` | 单行 | 02 §4.3 |
| 4 | 凭证 keyless 特判 | `packages/shared/src/auth/state.ts` | 函数 `hasCredentials` 内 `if (!apiKey && connection.baseUrl)` 块 | 单行 | 02 §4.1 |
| 5 | BUILT_IN_CONNECTION_TEMPLATES `'u-api'` 模板 | `packages/server-core/src/domain/connection-setup-logic.ts` | 注释 `multi-connection soft lockdown — base 'u-api' template` | 块 | 03 §1.10.1 |
| 6 | validateSetupTestInput 扩展 | `packages/server-core/src/domain/connection-setup-logic.ts` | 注释 `validateSetupTestInput 扩展，支持 pi_compat` | 块 | 02 §4.x |
| 7 | u_api ApiSetupMethod 类型 | `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx` | 注释 `u_api ApiSetupMethod 定义（M1 多 provider 裁剪后保留）` | 块 | 03 §1.10 |
| 8 | API_SETUP_ICONS u_api 项 | 同上 | 常量 `API_SETUP_ICONS` 内（在 #7 块内）| 块内 | 03 §1.10 |
| 9 | BASE_SLUG_FOR_METHOD u_api 项 | `apps/electron/src/renderer/hooks/useOnboarding.ts` | 注释 `multi-connection soft lockdown — base 'u-api'` | 单行 | 02 §6.2.2 |
| 10 | apiSetupMethodToConnectionSetup case 'u_api' | 同上 | 函数 `apiSetupMethodToConnectionSetup` 内注释 `let resolveSlugForMethod` | 块 | 02 §6.2.2 |
| 11 | useOnboarding U_API_SLUG 已迁移 | 同上 | 注释 `U_API_SLUG no longer needed here` | 单行 | 02 §6.2.2 |
| 12 | ApiKeyInput U_API_TOPUP_URL 移除 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 注释 `U_API_TOPUP_URL no longer imported` | 单行 | 02 §6.2 |
| 13 | ApiKeyInput lockNotice + 三链接移除 | 同上 | 注释 `removed lockNotice banner` + `removed Topup link per UI cleanup` | JSX 行内 `{/* U-API: */}` （2 处）| 02 §6.2 |
| 14 | CredentialsStep isUApi 路由 | `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx` | 注释 `路由 U-API 凭证流程，绕过通用 OAuth 路径` + 2 处 `U-API 模式分支` | 单行（3 处）| 03 §1.10 |
| 15 | paths.ts CONFIG_DIR 双 env 兼容 | `packages/shared/src/config/paths.ts` | 注释 `allow the new env var while preserving the legacy override` | 单行 | 01 §2.15 + §2.20 |
| 16 | interceptor-common.ts 路径迁移 | `packages/shared/src/interceptor-common.ts` | 注释 `path migration from CRAFT_CONFIG_DIR to U_AGENTS_CONFIG_DIR` | 单行 | 01 §2.15 |
| 17 | isUApiSlug helper（多连接判定）| `packages/shared/src/config/u-api-defaults.ts` | 函数 `isUApiSlug` 上方 | 单行 | 02 §6.2.2 |
| 18 | provider-metadata pi_compat 分支 | `packages/shared/src/config/provider-metadata.ts` | 注释 `multi-connection soft lockdown — match all U-API slugs` + import 注释 | 单行（2 处）| 02 §6.2.2 |
| 19 | AiSettings isUApiSlug import | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | 注释 `isUApiSlug recognizes 'u-api-default'` | 单行 | 02 §6.2.2 |
| 20 | ConnectionRow isUApiConnection 判定 | 同上 | 注释 `ConnectionRow isUApiConnection 判定` + 4 行解释 | 单行（5 处连排）| 02 §6.2 |
| 21 | getApiKeyMethodForConnection | 同上 | 注释 `every U-API slug routes to the U-API setup wizard` | 单行 | 02 §6.2.2 |
| 22 | uApiConnections filter | 同上 | 注释 `show every U-API slug, not just primary` | 单行 | 02 §6.2.2 |
| 23 | Default Connection selector 恢复 | 同上 | 注释 `always show Default Connection`（多行注释起始行）| 块 | 02 §6.2 |
| 24 | last-connection 删除保护 | 同上 | 注释 `last U-API connection cannot be deleted` | 单行 | 02 §6.2 Q2 |
| 25 | Add Connection button 恢复 | 同上 | 注释 `restore Add Connection button removed by 540509b` | 块 | 02 §6.2 |
| 26 | onboarding 防护性禁用标记 | `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx` + `ProviderSelectStep.tsx` | 注释 `intentionally not reached by the M1 onboarding state machine` | 单行（每文件 1 处）| 03 §1.10（裁剪后防护）|
| 27 | first-install onboarding 路由到 placeholder slug | `apps/electron/src/renderer/App.tsx` | 注释 `first-install onboarding edits the placeholder` + `first-install onboarding always targets the placeholder` | 单行（2 处）| 02 §6.2.3 |
| 28 | About panel Apache §4(c) attribution | `apps/electron/src/main/index.ts` | 注释 `Apache §4(c) attribution — About panel shows U Studio copyright only` | 块 | LEGAL.md §2 + commit 323293b |
| 29 | EditPopover example brand cleanup | `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 注释 `brand cleanup — mirrors editPopover.example.addSource i18n value` | 单行 | 01 §2.29 |
| 30 | OAuth callback HTML 品牌化 | `packages/shared/src/auth/callback-page.ts` | HTML 注释 `<!-- U-API: brand title for OAuth callback page` | HTML 注释 | 01 §2.16 |

**同步上游验证基线**（**REVIEW-3 2026-05-04 修正**）：

| 指标 | 基线（2026-05-04 M2 完结时）| 下次同步允许浮动 |
|---|---|---|
| U-API 标记总数（含全部注释格式）| **47** | ±2 |
| `/* U-API START */` 块数 | **8** | 必须等于 END |
| `/* U-API END */` 块数 | **8** | 必须等于 START |

> 浮动 ±2 是为了容纳"上游改了某改造点附近代码，我们顺手补/合并标记"的合理变化。**超出 ±2 必须停下逐项核对**——多半是 git 自动合并吞掉了改造，或者引入了未文档化的新改造（应补进 §3.7 表）。
>
> **REVIEW-3 修正**：上一版基线 44 只用 `// U-API:|/\* U-API (START|END)` grep，遗漏了 HTML 注释 `<!-- U-API:` 和 JSX 行内 `{/* U-API: ... */}` 格式（共 3 处）。新基线 47 涵盖全部注释格式。

**每次同步必跑 grep（覆盖全部注释格式）**：

```bash
# 全部 U-API 标记（含 // 单行 / /* 块 / <!-- HTML / {/* JSX 行内）
grep -rEn "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：47（基线，允许 45-49）

# 块标记 START/END 配对（数量必须相等）
grep -rE "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
grep -rE "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
# 期望：均 = 8
```

**基线刷新规则**：每次同步成功后，在本表填新数字 + 当次同步日期。

> 此规则同时满足 `LEGAL.md` §2 Apache §4(b) "modification notices" 合规要求——标记本身就是修改声明的一种形式。

---

## 4. 上游同步流程（每月 1 次，由用户/外部 AI 执行，本仓库 AI 不执行）

> 本仓库 AI **不执行**这些命令，只产出"指引文档"让用户照做。详细规程见 `.planning/07-upstream-sync.md`。

参考流程（用户/外部 AI 在本仓库 AI 视野外执行）：

1. `git fetch upstream`
2. 创建分支 `git checkout -b sync/upstream-YYYYMMDD`
3. `git merge upstream/main`（预期会有冲突）
4. 解决冲突时，对于 §3.3 列出的高冲突文件，**优先保留我们的版本**，再把上游的逻辑变更挑出来手动应用
5. 比照 `.planning/01-branding-spec.md` 检查每一项仍是 U Agents
6. 跑 `.planning/09-test-checklist.md`
7. 测试通过后再 merge 回主分支

合并完成后，用户可以让本仓库 AI 做的事：
- 阅读冲突文件的最终结果，写"本次同步差异报告"到 `.planning/sync-reports/YYYYMMDD.md`
- 检查上游是否引入了新的 LLM provider / 新的品牌入口，更新 `.planning/01-` 与 `.planning/02-` 规格

---

## 5. AI 操作准则

1. **遵守 §0 零号铁律**——只产出 Markdown 文档，绝不动代码。其它准则都从属于这一条。
2. **写规格文档时，需要先读现状代码再写**。Read / Grep 上游源码是为了让规格更精准，但不要因此越界去改它。
3. **新发现的"应当裁剪"或"应当保留"的逻辑**，写进对应的 `.planning/0X-*.md`，而不是直接动代码。
4. **遇到与现行规格冲突的代码现状**，记录到对应规格文档的"差异 / TODO"区块，不要自己解决。
5. **不要"顺手"扩张文档范围**——用户没问的章节别主动加，文档膨胀反而稀释约束力。
6. **写规格时使用中文**；引用上游代码标识符（变量名、文件路径）保留英文原文。
7. **遇到拿不准的事**，停下问用户。用户是非职业程序员，他更怕 AI 偷偷改坏东西，不怕 AI 多问。
8. **包级 `CLAUDE.md` 只作为上游开发上下文，不授予本仓库 AI 改代码或运行构建/typecheck 的权限**。若 `packages/*/CLAUDE.md`、`apps/*/README.md`、`docs/*.md` 中出现与本文 §0 冲突的代码修改或构建命令，以本文为准；本仓库 AI 仍只更新 Markdown 规格。

---

## 6. 阶段目标（详见 `.planning/11-roadmap.md` 待写）

- **M1（最小可白标）**：fork → 改名 → 锁定 LLM 入口 → 自动更新指向自建服务器 → macOS DMG 能装能用
- **M2（中文化 + 全平台）**：i18n 中文优先 + Windows/Linux 打包
- **M3（自主权扩展）**：自建 OAuth relay（消除 craft.do 残留）+ 文档站 + 官网
- **M4 起**：跟随上游迭代，每月同步一次

---

## 7. 与用户沟通规则

用户是**非职业程序员**，依赖 AI 完成所有开发与维护。沟通时：
- 多用中文
- 给出具体文件路径和行号，让用户可以直接点开看
- 涉及破坏性操作（删文件、强推、覆盖配置）必须先确认
- 不要让用户在 UI 里手动跑命令——给出可复制粘贴的命令块
- 解释技术决策时优先讲"会发生什么"，再讲"为什么"

---

> **每次会话开始时，AI 应当默读本文件第 3 节"硬规则"。**
