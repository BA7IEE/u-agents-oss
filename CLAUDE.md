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
| 6 | validateSetupTestInput 扩展 | `packages/server-core/src/domain/connection-setup-logic.ts` | 注释 `validateSetupTestInput 扩展，支持 pi_compat` | 块 | 02 §4.2 |
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
| 26a | onboarding 防护性禁用 — LocalModelStep | `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx` | 注释 `intentionally not reached by the M1 onboarding state machine` | 单行 | 03 §1.10（裁剪后防护）|
| 26b | onboarding 防护性禁用 — ProviderSelectStep | `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | 同上注释 | 单行 | 同上 |
| 27 | first-install onboarding 路由到 placeholder slug | `apps/electron/src/renderer/App.tsx` | 注释 `first-install onboarding edits the placeholder` + `first-install onboarding always targets the placeholder` | 单行（2 处）| 02 §6.2.3 |
| 28 | About panel Apache §4(c) attribution | `apps/electron/src/main/index.ts` | 注释 `Apache §4(c) attribution — About panel shows U Studio copyright only` | 块 | LEGAL.md §2 + commit 323293b |
| 29 | EditPopover example brand cleanup | `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 注释 `brand cleanup — mirrors editPopover.example.addSource i18n value` | 单行 | 01 §2.29 |
| 30 | OAuth callback HTML 品牌化 | `packages/shared/src/auth/callback-page.ts` | HTML 注释 `<!-- U-API: brand title for OAuth callback page` | HTML 注释 | 01 §2.16 |

**M2 期间新增改造点（2026-05-05 收尾后补入）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 31a | TLS 严格化 — handlers/workspace | `apps/electron/src/main/handlers/workspace.ts` | 注释 `TLS strict mode (REVIEW-5 P0 fix` | 单行 | `M2-TLS-FIX-SPEC.md` + LEGAL §5.4 |
| 31b | TLS 严格化 — preload/bootstrap | `apps/electron/src/preload/bootstrap.ts` | 同上注释（2 处）| 单行 | 同上 |
| 32a | atomicWriteFileSync — storage | `packages/shared/src/config/storage.ts` | 注释 `atomic writes for user-data persistence` | 单行 | `M2-ATOMIC-WRITES-SPEC.md` |
| 32b | atomicWriteFileSync — preferences | `packages/shared/src/config/preferences.ts` | 同上注释 | 单行 | 同上 |
| 32c | atomicWriteFileSync — topic-registry | `packages/messaging-gateway/src/topic-registry.ts` | 同上注释 | 单行 | 同上 |
| 32d | atomicWriteFileSync — window-state | `apps/electron/src/main/window-state.ts` | 同上注释 | 单行 | 同上 |
| 33a | dir 0o700 — watcher | `packages/shared/src/config/watcher.ts` | 注释 `dir mode 0o700 for multi-user machine privacy` | 单行 | `M2-SECURITY-CLEANUP-SPEC.md` |
| 33b | dir 0o700 — storage（与 32a 同文件）| `packages/shared/src/config/storage.ts` | 同上注释 | 单行 | 同上 |
| 33c | dir 0o700 — window-state（与 32d 同文件）| `apps/electron/src/main/window-state.ts` | 同上注释 | 单行 | 同上 |
| 34 | LLM API key 长度限制 | `packages/shared/src/credentials/manager.ts` | 注释 `LLM API key length bounds` + 常量 `MIN_LLM_API_KEY_LENGTH` / `MAX_LLM_API_KEY_LENGTH` | 单行 | `M2-SECURITY-CLEANUP-SPEC.md` |
| 35 | apps/cli rename | `apps/cli/src/index.ts` | 注释 `tmpDir prefix renamed (M2 cli rename)` + `skill description rebrand` | 单行（2 处）| `M2-CLI-RENAME-SPEC.md` |
| 36 | REVIEW-4 P0 多连接 keyless 回归测试 | `packages/shared/src/auth/__tests__/state.test.ts` | describe block `hasCredentials keyless special case (multi-connection)` | 单行 | REVIEW-4 + REVIEW-5 §1 P1 |

**v0.9.1 sync 期间新增改造点（2026-05-06 commit `bd2a005d` sync merge 时落地）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| ~~37~~ | ~~v0.9.1 routing.ts 漏分类 9 channel 修复~~ | ~~`packages/shared/src/protocol/routing.ts`~~ | **已过期（v0.9.3 sync 删除）**：上游 v0.9.3 自己补了 9 channel 进 `REMOTE_ELIGIBLE_CHANNELS`（与我们 patch 等价），SYNC-v0.9.3 merge 时全盘接受 theirs + 删 marker | —— | SYNC-v0.9.3-20260512 自动过期 |
| 38 | 上游 v0.9.1 ESLint 违规 disable（color-mix annotation） | `packages/ui/src/components/annotations/block-markers.ts` | 注释 `dynamic color-mix annotation; cannot be expressed as a static utility class` | 单行 | SYNC-v0.9.1-20260506 §6.2（C12 上游 lint 违规） |
| 39 | 上游 v0.9.1 ESLint 违规 disable（test 直读 isAuthenticated） | `packages/shared/src/resources/__tests__/resource-bundle.test.ts` | 注释 `test asserts the field directly to verify reset semantics, not gating logic` | 单行 | SYNC-v0.9.1-20260506 §6.2（C12 上游 lint 违规） |

**v17 review 后修复（v0.9.1 sync 后实测发现的 3 项漏盘改造点）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 40 | messaging access-control rejection 文案品牌（v0.9.1 引入）| `packages/messaging-gateway/src/access-control.ts` | 注释 `brand replacement — v0.9.1 上游引入 messaging access-control` | 单行 | REVIEW-17 F2（v0.9.1 sync 漏品牌替换）|
| 41 | messaging pairing-code rejection 文案品牌（v0.9.1 引入）| `packages/messaging-gateway/src/commands.ts` | 注释 `brand — v0.9.1 上游引入 pairing code rejection 文案` | 单行 | 同上 |
| 42 | apps/cli printHelp craft-cli → u-agents-cli（M2 cli rename 漏盘补丁）| `apps/cli/src/index.ts` | 注释 `M2 cli rename — bin name 改为 u-agents-cli (commit 1a49d128), 此 printHelp 文案漏改` | 单行 | REVIEW-17 F3（M2-CLI-RENAME 验收清单未含 printHelp）|

**M3 SSRF 防护落地（v21 后 P1，详见 [`M3-REFRESH-API-SSRF-SPEC.md`](.planning/M3-REFRESH-API-SSRF-SPEC.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 43 | `assertPublicHttpsUrl` helper（IPv4/IPv6 私网 + 云元数据域名）| `packages/shared/src/utils/url-safety.ts` | 块 `M3 SSRF 防护 — assertPublicHttpsUrl helper` | 块 | M3-REFRESH-API-SSRF-SPEC §2.1 |
| 44a | `refreshApiRenew` 接入 SSRF guard | `packages/shared/src/sources/credential-manager.ts` | 函数 `refreshApiRenew` 内 `M3 SSRF 防护 — 阻止 credential-bearing fetch` | 单行 | M3-REFRESH-API-SSRF-SPEC §2.2 |
| 44b | `refreshApiRenew` SSRF 回归测试（5 个）| `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | 注释 `M3 SSRF 防护 — 拒绝 credential-bearing fetch 到云元数据/私网` | 单行 | C5 自洽（新改造点必加单测） |
| 44c | `refreshApiRenew` redirect bypass 防护（v24 F1.F3 P0）| `packages/shared/src/sources/credential-manager.ts` | 注释 `M3 SSRF 防护 — redirect bypass 修补` + `主动拒绝 30x redirect` | 单行（2 处）| REVIEW-24 §1.1 |
| 44d | `refreshApiRenew` redirect bypass 单测（2 个）| `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | 注释 `M3 SSRF redirect bypass 防护（v24 F1.F3 P0 真修）` | 单行 | C5 自洽 |
| 45a | `createApiTool` 接入 SSRF guard + redirect:'manual'（v23 §5.2 follow-up + v24 F1.F3 真修）| `packages/shared/src/sources/api-tools.ts` | 注释 `M3 SSRF 防护 — ...`（4 处：import + redirect:'manual' 配置 + safety check + 30x reject）| 单行（4 处）| REVIEW-23 §2.2 + REVIEW-24 §1.1 |
| 45b | `createApiTool` SSRF 运行时测试（10 个，v24 F1.F5 重写从 grep-only → runtime mock fetch）| `packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts` | describe `api-tools SSRF guard` | 单行 | C5 自洽 + REVIEW-24 §1.2 |
| 45c | `pi-agent-server` 系统 prompt 注释 brand（v0.9.2 sync 漏盘补丁）| `packages/pi-agent-server/src/index.ts:~1285` | 注释 `brand — v0.9.2 sync 漏盘 "Craft-built" → "U Agents-built"` | 单行 | REVIEW-24 §1.3 / G1.F2.1 |
| 45d | spawn-helpers regex U Agents.app 显式回归测试（v24 G1.F3.2）| `packages/shared/src/agent/__tests__/claude-agent-spawn-cwd.test.ts` | 注释 `brand — v24 G1.F3.2 P2 真修：补 U Agents.app 显式回归` | 单行 | REVIEW-24 §3.2 |
| 46 | `browserToolEnabled` 默认改 `false`（v24 G1.F4.1 决策）| `packages/shared/src/config/storage.ts` 内 `defaults.browserToolEnabled: false` | 注释 `browser tool 默认关闭` | 单行 | REVIEW-24 §1（Bucket C）+ 04-feature-cuts §九类 |
| 46t | `browserToolEnabled` 默认 false 防回归测试 | `packages/shared/src/__tests__/m2-security-regression.test.ts` | describe `browserToolEnabled 默认 false` | 单行 | C5 自洽 |

**v27 Bucket B SSRF 横向扩展 + 漏盘补丁（2026-05-08，详见 [`M3-SSRF-CONSOLIDATION-SPEC.md`](.planning/M3-SSRF-CONSOLIDATION-SPEC.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 47a | `web_fetch` redirect:'manual' + 30x reject（v27 P0-1 真修，redirect bypass 漏洞）| `packages/pi-agent-server/src/tools/web-fetch.ts:~366,377` | 注释 `M3 SSRF 防护 — redirect bypass 修补` + `主动拒绝 30x redirect` | 单行（2 处）| M3-SSRF-CONSOLIDATION-SPEC §2.1 + REVIEW-27 P0-1 |
| 47b | `web_fetch` SSRF 运行时测试（7 个，含 marker 防回归 1 处）| `packages/pi-agent-server/src/tools/web-fetch-ssrf.test.ts` | describe `web-fetch SSRF guard` | 单行 | C5 自洽 |
| 48a-d | `source-test.ts` 4 处 fetch SSRF guard（auth path + basic path × 3）| `packages/session-tools-core/src/handlers/source-test.ts` | 注释 `M3 SSRF 防护` × 7（import + safety check + auth redirect:'manual' + 30x reject + basic 3× redirect:'manual' + 30x reject）| 单行（8 处）| M3-SSRF-CONSOLIDATION-SPEC §2.2 + REVIEW-27 P1 |
| 49 | `auto-update.ts` 注释 URL 与 publish.url 一致（v27 P0-5 漏盘补丁）| `apps/electron/src/main/auto-update.ts:7` | 注释 `comment URL must match electron-builder.yml publish.url exactly` | 单行 | REVIEW-27 P0-5 |

**v0.9.3 sync 期间新增改造点（2026-05-12，详见 [`.planning/sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md`](.planning/sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 50 | 上游 v0.9.3 ESLint 违规 disable（FabNewChat base shadow）| `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx` | 注释 `继承上游 v0.9.3 FAB 视觉设计；改 shadow class 会破坏设计` | 单行（含 `eslint-disable-next-line craft-styles/no-nonstandard-shadows`）| SYNC-v0.9.3-20260512（C12 上游 lint 违规）|
| 51 | 上游 v0.9.3 ESLint 违规 disable（FabNewChat hover shadow）| 同上 | 注释 `同上 — 继承上游 hover 视觉效果，豁免 lint` | 单行（含 `eslint-disable-next-line craft-styles/no-nonstandard-shadows`）| 同 #50 |

**v0.9.4 sync 期间新增改造点（2026-05-20，详见 [`.planning/sync-reports/SYNC-v0.9.4-20260520.md`](.planning/sync-reports/SYNC-v0.9.4-20260520.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 52 | C13 patch — RPC handler HANDLED_CHANNELS 加 RTK 4 channel（上游 v0.9.4 漏分类）| `packages/server-core/src/handlers/rpc/settings.ts` | 注释 `classify v0.9.4 RTK channels missed by upstream's HANDLED_CHANNELS` | 单行 | SYNC-v0.9.4-20260520 §1.3（C13 pattern；与 v0.9.1 上游 routing.ts 漏分类同模式，曾有 `#37` marker 但 v0.9.3 sync 时上游自修后被删——本次 #52 是同模式新触发）|

**Build 脚本 marker（M2 后期补充，不计入主基线）**：

主基线 grep 命令仅扫 `packages` + `apps` 下的 `.ts/.tsx`，build 脚本（`.sh` / `.ps1`）不在覆盖范围内——但仍需登记，方便上游同步时辨识改造点。

> ⚠️ **命名 disambiguation**：本节的 `B1/B2` = **Build 脚本 marker**（改造点登记表）。
> [`07-upstream-sync.md` §2.7b](.planning/07-upstream-sync.md) 里另有一组 `B1/B2/B5` = **SOP-REHEARSAL Branding 类反向核对**（审计分类，非改造点登记）—— 同名异义，不要混淆。

| # | 改造类别 | 文件 | 定位 | 标记 | 引入 commit |
|---|---|---|---|---|---|
| B1 | adhoc 签名 escape hatch | `apps/electron/scripts/build-dmg.sh` | 注释 `allow caller to override (e.g. CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac)` | `# U-API:` 单行 | `6ba75da4` (M2) |
| B2 | Windows EXE 缺 pi-agent-server 修复（事故 #3）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 missed subprocess server build that build-dmg.sh L208 triggers` | `# U-API:` 单行 | M2 收尾（详见 [`12-subprocess-build-pipeline.md`](.planning/12-subprocess-build-pipeline.md) §0.3） |
| B3 | Windows EXE 缺 WhatsApp worker 修复（事故 #4）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 misses electron-build-main.ts:335 buildWhatsAppWorker() step` | `# U-API:` 单行 | v0.9.1 sync 后 Windows 实测 verify 触发（详见 [`12-subprocess-build-pipeline.md`](.planning/12-subprocess-build-pipeline.md) §0.4） |
| B5 | M3-Sentry packaging signal — macOS | `apps/electron/scripts/build-dmg.sh` | 注释 `M3-Sentry — 信号 packaging 模式给 electron-build-main.ts:assertSentryDsnForPackaging` | `# U-API:` 单行 | M3-SENTRY-DSN-ASSERTION（详见 [`.planning/M3-SENTRY-DSN-ASSERTION-SPEC.md`](.planning/M3-SENTRY-DSN-ASSERTION-SPEC.md) §2.2）|
| B6 | M3-Sentry packaging signal — Linux | `apps/electron/scripts/build-linux.sh` | 注释 `M3-Sentry — 信号 packaging 模式` | `# U-API:` 单行 | 同上 §2.3 |
| B7 | M3-Sentry packaging signal + DSN warn — Windows | `apps/electron/scripts/build-win.ps1` | 注释 `M3-Sentry — 信号 packaging 模式（与 build-dmg.sh 等价）` | `# U-API:` 单行 | 同上 §2.3（Windows 路径绕过 electron-build-main.ts，需独立 warn）|
| B4 | Windows EXE 缺 dist/interceptor.cjs 修复（事故 #5，事故 #3/#4 同根第 3 个）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 misses electron-build-main.ts:332 buildInterceptor() step` | `# U-API:` 单行 | v16 review B 路静态分析触发（详见 [`12-subprocess-build-pipeline.md`](.planning/12-subprocess-build-pipeline.md) §0.5） |

**Build 脚本 marker 单独 grep 命令**：

```bash
grep -rEn "U-API" apps/electron/scripts/ scripts/ 2>/dev/null | grep -v node_modules | wc -l
# 期望：≥13（B1-B7 + electron-build-main.ts 函数注释 + main() 注释 +
# scripts/check-i18n-coverage.ts + scripts/check-raw-sends.sh +
# scripts/typecheck-staged.sh + scripts/lint-i18n-staged.sh）
```

**同步上游验证基线**（**v0.9.4 sync 后 2026-05-20 刷新**）：

| 指标 | 基线（2026-05-20 v0.9.4 sync 后）| 下次同步允许浮动 |
|---|---|---|
| U-API 标记总数（含全部注释格式）| **96** | ±2 |
| `/* U-API START */` 块数 | **9** | 必须等于 END |
| `/* U-API END */` 块数 | **9** | 必须等于 START |

> 浮动 ±2 是为了容纳"上游改了某改造点附近代码，我们顺手补/合并标记"的合理变化。**超出 ±2 必须停下逐项核对**——多半是 git 自动合并吞掉了改造，或者引入了未文档化的新改造（应补进 §3.7 表）。
>
> **历次基线演进**：
> - REVIEW-2（2026-05-04 上午）：44 处（旧 grep 命令漏 3 处 HTML/JSX 注释）
> - REVIEW-3（同日修正）：47 处（grep 命令改全格式，覆盖率 100%）
> - REVIEW-6（hotfix v0.9.0+u-agents.1 后）：48 处（state.test.ts 新增 1 处回归测试 `// U-API:` 引用）
> - M2 TLS 修复（2026-05-05 commit `c516e4d2`）：51 处（workspace.ts:27 + bootstrap.ts:124, 148 各加 1 处 TLS strict mode 注释 marker）
> - M2 atomicWriteFileSync 用户数据持久化（2026-05-05 commit `25d38ab9`）：55 处（4 文件各加 1 处 atomic writes 注释 marker：storage.ts / preferences.ts / topic-registry.ts / window-state.ts）
> - M2 dir 0o700 + Token 长度限制（2026-05-05 commit `2972d8f4`）：59 处（3 处 dir mode 0o700 marker：watcher.ts / storage.ts / window-state.ts + 1 处 manager.ts MIN/MAX 长度常量 marker）
> - M2 apps/cli rename（2026-05-05 commit `1a49d128`）：61 处（apps/cli/src/index.ts 加 2 处 marker：tmpDir 前缀 + skill description）
> - v0.9.1 sync（2026-05-06 commit `bd2a005d`）：64 处（routing.ts 加 1 处 + block-markers.ts 加 1 处 + resource-bundle.test.ts 加 1 处；上游 v0.9.1 引入的 1 个 routing bug + 3 处 ESLint 违规我们 patch 后加 marker）
> - v17 漏盘补丁（2026-05-07）：67 处（access-control.ts + commands.ts messaging brand + cli/src/index.ts printHelp，3 处都是 v0.9.1 sync 时漏盘 / M2 cli rename 时漏盘）；同次 commit 顺手修 F1 自动更新 publish.url 缺 `/latest` 后缀（electron-builder.yml）+ F6 07-upstream-sync 基线 61→64 漂移
> - **M3 SSRF 防护（2026-05-07）：71 处**（url-safety.ts 加 `assertPublicHttpsUrl` 块 1 处 + credential-manager.ts:982 单行 1 处 + credential-manager-renew.test.ts 单行 1 处；详见 [`.planning/M3-REFRESH-API-SSRF-SPEC.md`](.planning/M3-REFRESH-API-SSRF-SPEC.md)，对应 §3.7 #43/#44a/#44b）
> - **M3 死路径清理（2026-05-07）：71 处不变**（main/index.ts 删 6 行 CRAFT_* env + 1 行注释；utils/files.ts 5 处 craft-clipboard → u-agents-clipboard；删除 + 品牌替换不计 marker。详见 [`.planning/M3-DEAD-PATH-CLEANUP-SPEC.md`](.planning/M3-DEAD-PATH-CLEANUP-SPEC.md) 修订记录——CRAFT_DEBUG 14+ 处真消费方决策保留）
> - **M3-Sentry DSN assertion（2026-05-07）：71 处不变**（scripts/electron-build-main.ts 加 assertSentryDsnForPackaging 函数 + main() 调用，但在 repo root 不计入主基线 grep；Build 脚本子表 4 → 9：B5/B6/B7 + electron-build-main.ts 函数注释 + main() 注释）。M2 过渡期 warn 不 fail；M3-4 GlitchTip 上线日把 console.warn 改 process.exit(1)。详见 [`.planning/M3-SENTRY-DSN-ASSERTION-SPEC.md`](.planning/M3-SENTRY-DSN-ASSERTION-SPEC.md)
> - **M2.5 #5 CI dead refs 修（2026-05-07）：71 处不变**（scripts/check-i18n-coverage.ts + check-raw-sends.sh + typecheck-staged.sh + lint-i18n-staged.sh 4 个 stub 实现；v0.9.1 上游 package.json 引用入口但漏文件 — C13 模式继承）。**`bun run validate:ci` 现全绿**，v0.9.1 sync 后第一次。Build 脚本子表 grep 命令含范围扩到 scripts/，期望 ≥13
> - **M2.5 #3 husky 装回（2026-05-07）：71 处不变**（.husky/pre-commit 跑 lint:i18n:staged；.husky/_/ gitignored 由 bun install 自动重建）。每次 git commit 自动跑 i18n staged 检查；无 staged 相关文件时直接 skip 不卡 commit。
> - **M2.5 #4 macOS x64 装包实测：deferred**（用户暂无 x64 机器；R2 上 v0.9.1 macOS x64 包已上线但未经用户实测验证）。M2 评级保持 A−（不到 A），等下次有机会实测后升 A。其它 follow-up（M3-1 OAuth relay / M3-4 GlitchTip / M3-2/3 文档站）等用户活跃数据驱动。
> - **v23 P1 follow-up（2026-05-07）：73 处**（api-tools.ts 加 import 1 处 + createApiTool fetch 前 1 处 SSRF marker；新增 §3.7 #45a/#45b。同 commit：webui/login.html placeholder + 3 个 release-notes brand 替换不计 marker——属 01-branding-spec §1 全表）。详见 [`.planning/sync-reports/REVIEW-23-DEEP-MULTI-AGENT-2026-05-07.md`](.planning/sync-reports/REVIEW-23-DEEP-MULTI-AGENT-2026-05-07.md) §2.2。
> - **v0.9.2 sync（2026-05-07 commit `a76e502d`）：73 处不变**（上游 +38 文件 / +1369 −304 主要是 spawn-helpers + system-prompt-override + OAuth refresh 重整；merge 干净未碰任何 §3.7 改造点；C11 触发 1 处 NPM scope rename `sendmessage-oauth-refresh.test.ts` 已修 + 6 处 brand 化 + 0 单测新增——基线维持。详见 [`.planning/sync-reports/SYNC-v0.9.2-20260507.md`](.planning/sync-reports/SYNC-v0.9.2-20260507.md)）。
> - **v24 SSRF redirect bypass 真修 + brand 漏盘补丁（2026-05-07）：80 处**（+7 marker：api-tools.ts 加 redirect:'manual' + 30x reject 共 4 处 / credential-manager.ts 同样 +2 处 / pi-agent-server/index.ts:1285 brand 漏盘补 +1 处；新增 §3.7 #44c/#44d/#45c/#45d；#45a 升级到 4 处 marker；同 commit 重写 4 SSRF 单测从 grep-only → runtime mock fetch（v24 F1.F5）+ refreshApiRenew 加 redirect bypass 单测 + spawn-cwd 加 U Agents.app 显式回归测试。详见 [`.planning/sync-reports/REVIEW-24-POST-SYNC-2026-05-07.md`](.planning/sync-reports/REVIEW-24-POST-SYNC-2026-05-07.md)）。
> - **v24 Bucket C browser tool 裁剪决策（2026-05-07）：82 处**（+2 marker：storage.ts browserToolEnabled 默认改 false 加 1 处 marker + m2-security-regression.test.ts 防回归测试加 1 处 marker；同 commit 改 config-defaults.json 默认值；新增 §3.7 #46/#46t；详见 [`.planning/04-feature-cuts.md`](.planning/04-feature-cuts.md) §九类）。
> - **v27 Bucket B SSRF 横向扩展（2026-05-08）：94 处**（+12 marker：auto-update.ts 注释品牌 1 处 + web-fetch.ts redirect:'manual' + 30x reject 2 处 + web-fetch-ssrf.test.ts marker 防回归 1 处 + source-test.ts SSRF 8 处（import + safety check + auth path redirect:'manual' + 30x reject + basic path 3× redirect:'manual' + 30x reject）；新增 §3.7 #47a/#47b/#48a-d/#49；同 commit zh-Hans browser tool i18n 文案重写不计 marker（属 i18n 改动）+ Bucket A 7 文档已分别 commit。详见 [`.planning/M3-SSRF-CONSOLIDATION-SPEC.md`](.planning/M3-SSRF-CONSOLIDATION-SPEC.md) + [`.planning/sync-reports/REVIEW-27-FULL-2026-05-08.md`](.planning/sync-reports/REVIEW-27-FULL-2026-05-08.md)）。**B4 toast / B5 chat gate defer 给后续 commit，需 IPC 与 chat hook 集成**。
> - **v0.9.3 sync（2026-05-12 合并 upstream `c310624f`）：95 处**（净变化 +1：删 #37（上游 v0.9.3 自己修了 v0.9.1 routing 漏分类，自动过期）−1，加 #50/#51（FabNewChat 两处 shadow ESLint 违规 disable）+2。上游 134 文件 / 31 新增 + 103 修改；25 个 unmerged 冲突（14 package.json + routing.ts + AiSettingsPage.tsx + 2 html + README + bug_report.yml + D 组 4 文件 AppMenu/TopBar/SessionMenu/SessionMenuParts）；架构层面接受上游 TopBar → AppMenu wrapper → DesktopAppMenu/MobileAppMenu 重构（替代我们 fork 把 menu rendering 搬到 TopBar 的方向）；C11 触发 6 文件 9 处 NPM scope rename（mobile UI 新建 5 文件 + messaging test 1）；C12 触发 2 处 ESLint 违规 disable（FabNewChat shadow，对应 #50/#51）；C13 未触发（上游反而修了 v0.9.1 routing 自身 bug）；上游新文件 brand patch 3 个（DesktopAppMenu/MobileAppMenu CraftAgentsSymbol → UAgentsSymbol + menu-schema.ts quitUAgents key + u-agents docs URL + HELP_LINKS 加 Automations 入口）。验证：typecheck 全绿 / lint:i18n:parity OK（6 locales × 1448 keys）/ lint:electron 仅剩 FabNewChat 2 处 disable 之外的 110 个 pre-existing warnings / bun test 4 fail 全部来自 stale `apps/electron/release/*.app` bundle 副本（与 sync 无关）。详见 [`.planning/sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md`](.planning/sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md)）。
> - **v0.9.4 sync（2026-05-20 合并 upstream `4144f795` → commit `0a49a089`）：96 处**（净变化 +1：加 #52 C13 patch HANDLED_CHANNELS 加 RTK 4 channel）。上游 73 文件 / +698 −202 行（fork 历史上影响面最小的一次）；主题 = RTK Bash token 压缩 opt-in + Pi SDK 0.72.1→0.73.1 + Codex/Copilot 死代码清理（与 04-feature-cuts 同向）；冲突总数 19 处：2 处真代码冲突（SkillsListPanel uagents:// deep link + claude/event-adapter.ts brand 注释 vs 上游 docblock 重写）、15 处 package.json（NPM scope @u-agents/ vs 上游 SDK 版本号）、eslint.config.mjs（顺势删 codex-agent / copilot-agent / @github/copilot-sdk 3 条死规则）、bun.lock（不可手工合并，改用 `git checkout 29bbfdc7 -- bun.lock && bun install` 增量同步避免 Sentry dup install）；C11 触发 1 文件 4 处（settings.ts RTK RPC handler dynamic import）；C13 触发：HANDLED_CHANNELS 漏 RTK 4 channel patch（#52，与 v0.9.1 routing.ts #37 同模式）；顺手 follow-up 删 root package.json `@github/copilot-sdk` dep（REVIEW-3 backlog）；release-notes/0.9.4.md 中文翻译 + brand 五件套（Craft/craft.do/lukilabs/Codex/Copilot）0 命中。验证：typecheck 0 errors / i18n parity OK（6 locales × 1455 keys，+7 RTK key）/ lint:electron 110 warnings 0 errors / bun test 19 latent fail（全 v0.9.3 baseline 已存在，与 sync 无关）。PREVIEW 5 轮 review 后预测评级 A−，实际 B+（因 2 真代码冲突 + C13 patch + bun.lock 副作用，比预测多 3 处隐患）。详见 [`.planning/sync-reports/SYNC-v0.9.4-20260520.md`](.planning/sync-reports/SYNC-v0.9.4-20260520.md) + 5 轮预测 [`UPSTREAM-PREVIEW-v0.9.4-2026-05-20.md`](.planning/sync-reports/UPSTREAM-PREVIEW-v0.9.4-2026-05-20.md)。

**每次同步必跑 grep（覆盖全部注释格式）**：

```bash
# 全部 U-API 标记（含 // 单行 / /* 块 / <!-- HTML / {/* JSX 行内）
# SOP-REHEARSAL 2026-05-05 改进：用 --exclude-dir 替代 grep -v 过滤，
# 抗 build-dmg.sh 中间态把 SDK 包复制到 apps/electron/node_modules/ 让数字暂时虚高的情况
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：95（基线，允许 93-97）

# 块标记 START/END 配对（数量必须相等）
grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 9
```

**基线刷新规则**：每次同步成功后，在本表填新数字 + 当次同步日期。

> 此规则同时满足 `LEGAL.md` §2 Apache §4(b) "modification notices" 合规要求——标记本身就是修改声明的一种形式。

**⚠️ 改造点常见踩坑模式**（每月同步必跑核对，详见 [`07-upstream-sync.md` §2.7c](.planning/07-upstream-sync.md)）：

| # | 模式 | 一句话 |
|---|---|---|
| C1 | 硬编码 slug 而非 helper | 凭证判定别用 `=== U_API_SLUG`，用 `isUApiSlug()` |
| C2 | batch sed 漏 object key 引号 | `{ u-agents: }` 是 syntax error，必须 `{ 'u-agents': }` |
| C3 | sed 改 input 漏 assertion | 测试改输入也要改断言（同文件 'craft' + 'u-agents' 混用是嫌疑）|
| C4 | dead import | 修 callsite 后 grep `<symbol>` 计数 = 1 = dead import 待删 |
| C5 | 新改造点忘记加单测 | 新增 §3.7 表项必须同时加 `__tests__/*.test.ts` |
| C6 | system prompt craft 字面量未门控 | 用户可见路径 0 craft；FEATURE_FLAGS 门控的可保留 |
| C7 | §3.7 反向覆盖空白 | grep 实际标记的文件清单要全在表里 |
| C8 | 基线 grep 命令漏注释格式 | 用本节"全格式"grep，不用旧 `// U-API:` 简写 |
| C9 | 测试 syntax 让 baseline fail 数字假 | bun test 不带 --bail 跑，看真实 fail 数对照 M1-FIRST-RELEASE 已知技术债 |
| C10 | 上游新增 connection 字段透传漏 | `enforceUApiBaseUrl` 重写连接时浅合并保字段（v0.9.1 起：midStreamBehavior；未来字段同样处理）|
| C11 | 上游新文件用旧 NPM scope | sync 后 grep `@craft-agent/` 必须 = 0；命中跑 batch sed rename（v0.9.1 sync 触发 12 文件 20 处） |
| C12 | 上游 release 自身 lint 违规 | sync 后跑 lint 套件，errors case-by-case 处理：语义等价改源码 / `// eslint-disable-next-line` + `// U-API:` 注释加进 §3.7 |
| C13 | 上游 release 自身 test fail | 区分 (a) 我们 patch 真能修（如 routing.ts 漏分类）→ commit fix；(b) 上游 bug 我们继承 → 记 sync 报告 follow-up，不阻塞 merge |
| C14 | build-win.ps1 与 root chain 结构性差距 | sync 后核 dist 产物缺什么；每发现一个漏的 helper 就给 build-win.ps1 加一段调对应 root script（事故 #3 + #4 + #5 同根三胞胎，main bundle 5 步流水线 step 1+2+3+4 已修；M3 终极方案：build-win.ps1 改调 `bun run electron:build`）|

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
