# UPSTREAM PREVIEW — v0.9.3 同步预分析报告（2026-05-12）

> **本报告由本仓库 AI 在 `git fetch upstream` 之后、`git merge upstream/main` 之前产出**。
> 只读分析、不动代码、不动 git refs。目的：给执行 merge 的用户/外部 AI 一份可直接照做的预案。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.3 / §3.7 + [`07-upstream-sync.md`](../07-upstream-sync.md) + [`08-conflict-zones.md`](../08-conflict-zones.md)

---

## 0. TL;DR

| 维度 | 判断 |
|---|---|
| 上游新版本 | **v0.9.3**（commit `c310624f`，2026-05-11 release）|
| commit 类型 | 单个 squash release commit（与 v0.9.0/v0.9.1/v0.9.2 同模式）|
| 影响面 | 134 文件（31 新增 + 103 修改 + 0 删除 + 0 重命名），+7641 / −1248 行 |
| **冲突等级** | **B（小到中）** |
| §3.3 高冲突文件真冲突数 | **0** |
| §3.7 改造点真冲突数 | **1 真 + 1 硬冲突自动过期 + 2 软冲突 spot check**：真冲突 = AiSettingsPage.tsx；硬冲突过期 = routing.ts #37；软冲突 = provider-icons.ts + FreeFormInput.tsx |
| §3.7 自动过期 marker | **1**（routing.ts #37 上游已修，可删，基线 94 → 93）|
| C11 NPM scope rename 触发文件 | **6 文件 9 处**（mobile UI 新建 5 个 + messaging test 1 个）|
| C12/C13/C14 触发 | **0 / 0 / 0** |
| 推荐时机 | **当周内 sync**，按 v0.9.1/v0.9.2 SOP 走即可，无需 P0 review |
| 推荐分发 | **macOS arm64 + Windows x64**（与 v0.9.2 D-β 一致；macOS x64 / Linux 仍 defer）|

---

## 1. 上游版本元数据

```
commit  c310624fda0530722f5d4c6d1f8f2b7ba172090e
author  github-actions[bot] (squash release)
date    2026-05-11 13:23:44 +0000
title   v0.9.3
```

**主题（按 release notes 顺序）**：

| 区域 | 一句话 | 影响面 |
|---|---|---|
| Features × 2 | (a) **Mobile/compact mode** — 整套 renderer 在 < 768px 自动切到 iOS 风格单栏导航（AppMenu 拆 Mobile/Desktop + vaul Drawer + FAB new chat）<br>(b) **Manifest provider preset** — OpenAI-compat 新增 [manifest.build](https://manifest.build) preset，外部贡献者 [@guillaumegay13](https://github.com/guillaumegay13) | UI 大 / 配置小 |
| Improvements × 4 | (a) GHCR 镜像 namespace `lukilabs` → `craft-ai-agents`<br>(b) 新增 `lint:i18n:strings` 全仓 hardcoded 字串扫描脚本<br>(c) `SettingsIcons.tsx` 精简 180 行<br>(d) **routing.ts 修了 v0.9.1 引入的 9-channel 漏分类** ← 即我们 §3.7 #37 patch | 工具链 + UI 小 + **撞我们 #37** |
| Bug Fixes × 9 | session poisoning oversized tool result / Telegram polling 自动重连 / WhatsApp voice 转发 / **source_test forward OAuth bearer token to MCP probe** / Telegram permission button 幂等 / Model picker single-model 显 switcher / Windows build sparse-checkout cone mode + illegal filename / compact 收尾多 commit / docs 路径修正 | 含 **撞我们 §3.7 #48a-d 文件位置（不重叠行）** |
| Breaking | **None**（向后兼容；新 Docker image namespace 是唯一需感知的变化）| —— |

---

## 2. 134 文件分类清单

按"对我们的影响域"分桶，便于 merge 时分批 review。

### 2.1 §3.3 高冲突文件交集（共 5 文件，0 真冲突）

| 文件 | 上游变更 | 真冲突？ |
|---|---|---|
| `electron-builder.yml` | **未碰** | ✅ 干净 |
| `packages/shared/src/branding.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/llm-connections.ts` | **未碰**（Manifest 走 ApiKeyInput.tsx，不入 BUILT_IN_CONNECTION_TEMPLATES）| ✅ 干净 |
| `packages/shared/src/config/provider-metadata.ts` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | +7 −？纯响应式 breakpoint（`sm:` 前缀）| ❌ 无冲突 |
| `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx` | +9 −？仅 layout（`min-h-screen`→`h-dvh`、加 `overflow-y-auto`、padding `sm:p-8`）| ❌ 无冲突 |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | +33 −？加 Manifest preset 到 ANTHROPIC_PRESETS + 新 OPENAI_COMPAT_CUSTOM_URL_PRESETS 常量 + 改 loadPiModels/handlePresetClick/handleSubmit | ⚠️ git auto-merge 应能处理（与我们 #12 #13 不同位置）|
| `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts` | **新增文件** +57 | ✨ 新增，无冲突 |
| `apps/electron/src/renderer/components/apisetup/submit-helpers.ts` | **新增文件** +34（纯 helper，无 craft 字面量）| ✨ 新增，无冲突 |

### 2.2 §3.7 改造点路径交集（共 8 文件，1 真冲突 + 1 硬冲突自动过期 + 2 软冲突 spot check）

| 文件 | 我们的 marker | 上游动作 | 类别 |
|---|---|---|---|
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | §3.7 #11o `'U-API Compatible'` 替换 | 加 manifest 分支判定 | **真冲突**（§3.2）|
| `packages/shared/src/protocol/routing.ts` | §3.7 #37 加 9 channel | 上游也加 9 channel（位置不同、命名顺序略不同）| **硬冲突自动过期**（§3.1）|
| `apps/electron/src/renderer/lib/provider-icons.ts` | §3.7 #11o `pi`/`pi_compat: 'U-API'`（const 对象 L58-59）| 加 Manifest 分支到 `getProviderDisplayName` 函数体 L73 | **软冲突 spot check**（§3.7a 新增） |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` | §3.7 #11o `'U-API'` 标签（L370/380）| 加 import + `pickerMode` 逻辑（修 issue #727）| **软冲突 spot check**（§3.7b 新增） |
| `packages/session-tools-core/src/handlers/source-test.ts` | §3.7 #48a-d L23-692 SSRF | 改 testMcpConnection L775-823 OAuth token | **预计干净 merge**（§3.3） |
| `packages/shared/src/config/storage.ts` | §3.7 #46 `browserToolEnabled` 默认 false | 仅改 attachment audio type（L989/1015）| **干净**（§3.4） |
| `apps/electron/src/renderer/App.tsx` | §3.7 #27 first-install onboarding 路由 | 改 1 处 padding 样式 | **干净**（§3.5） |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | §3.7 #12/#13/#14 三处单行 + JSX 注释 | 加 Manifest preset entry + OPENAI_COMPAT 常量 + 改 3 函数 | **软冲突 spot check**（§3.7c 新增） |

详见下方 §3 表。

### 2.3 Mobile/Compact UI 重构（新增/修改 ~30 文件，对我们透明）

```
apps/electron/src/renderer/components/app-shell/* （15 文件，新建 7 + 改 8）
apps/electron/src/renderer/components/app-menu/* （6 文件全新建）
apps/electron/src/renderer/playground/demos/mobile-webui/* （7 新增）
apps/electron/src/renderer/contexts/NavigationContext.tsx + 测试
apps/electron/src/shared/menu-schema.ts + route-parser.ts + types.ts
apps/electron/src/renderer/index.html + index.css
apps/electron/src/renderer/lib/nav-helpers.ts + platform.ts
apps/electron/src/renderer/utils/session.ts
```

**不撞我们任何改造点**——纯新建组件 + 现有组件 layout 重构，不涉及 LLM 入口/品牌/凭证。但 **M2 i18n 阶段**会触发新一轮字串提取（mobile menu 标题/触摸 picker label 等）。

### 2.4 messaging 子系统（11 文件）

```
packages/messaging-gateway/* （gateway.ts +173 −？/ adapter telegram +116 / adapter whatsapp 新建测试 +120 / 新增 gateway-button-access.test.ts +38 / gateway-button-perm.test.ts +364 / renderer 测试 +35）
packages/messaging-whatsapp-worker/* （新建 media.ts + upsert.ts + 2 测试 / worker.ts +79 / protocol.ts +15）
```

**对我们影响**：
- 上游修了 Telegram 409 polling auto-reconnect bug；WhatsApp 真发音频附件
- **不撞我们任何 marker**（我们没在 messaging 加 §3.7 改造）
- v17 漏盘补丁的 §3.7 #40 #41（messaging access-control + pairing-code rejection 品牌文案）**位置不变**，merge 后再 grep 验证一次

### 2.5 错误处理与上下文（3 文件）

```
packages/shared/src/agent/claude-sdk-error-mapper.ts +130 −？
packages/shared/src/agent/__tests__/claude-sdk-error-mapper.test.ts +164 −？
packages/shared/src/agent/claude-context.ts +1
packages/shared/src/agent/claude-agent.ts +6
```

**release notes 描述里提到** "append a pointer to `~/Library/Logs/@craft-agent/electron/main.log`"——但 **grep 188 行 mapper 完整 diff 0 命中** `craft|main.log|Library/Logs`。

**review 后确认**：
- `claude-sdk-error-mapper.ts` 本身**未引入字面量**——release notes 描述可能略夸（实际是 dynamic path 或字面量在别处）
- 但 `packages/shared/src/prompts/print-system-prompt.ts` 上游**确实含**字面量 `'~/Library/Logs/@craft-agent/electron/main.log'`（demo string，非 runtime path）
- 我们 origin/main 该文件已被 M1 commit `393409ce`（NPM scope rename）改过，**当前不含 `@craft-agent`** —— 但 v0.9.2 → v0.9.3 上游**未碰**该文件（`git diff 8981384b..upstream/main -- print-system-prompt.ts` 返回空），所以 merge 时 base == theirs，**自动保 ours**，无需手动处理

**处理动作**：merge 后跑 §6.6 残留 craft 字面量 grep 仍是有用的预防 net，但**不预期会有命中**。

### 2.6 i18n 9 个 locales 各 +1 字串

```
packages/shared/src/i18n/locales/{de,en,es,hu,ja,pl,zh-Hans}.json  +1 each
```

**所有 locale 加同一 key**：`menu.toggleDevTools`。zh-Hans 已经是"切换开发者工具"，**M2 i18n 阶段不需要再翻译**。

### 2.7 CI / 工具链（3 文件）

| 文件 | 变更 | 对我们影响 |
|---|---|---|
| `.github/workflows/validate.yml` | 新增 step "Reject Windows-illegal filenames"（grep `[<>:"\|?*]` 即 fail）| 无影响（我们仓库无非法字符）|
| `.github/ISSUE_TEMPLATE/bug_report.yml` | 微调 | 无（我们不用 GitHub Issues 收 bug）|
| `README.md` | 微调（namespace 提示）| 我们已自定义 README，merge 优先保 **ours** |

### 2.8 其它（剩余 ~60 文件，纯重构/测试增量/版本号）

- 14 个 `package.json` 仅版本号 `0.9.2` → `0.9.3`（**全部接受 theirs**）
- 工具/UI 内部重构（`SettingsIcons.tsx` −180 行精简 / `entity-panel.tsx` 等）
- 各种 `*.test.ts` 新增/扩展（**全部接受 theirs**，跑 `bun test` 验证）

---

## 3. §3.7 改造点冲突逐项处理

按"路径交集"+"行号交集"双维度判定。

### 3.1 #37 routing.ts — **硬冲突自动过期**（上游已修，git 必标硬冲突）

```diff
+ RPC_CHANNELS.messaging.PENDING_CHANGED,
...
+ // messaging access control — UI ↔ Server, per-platform owners + per-binding allow-list
+ RPC_CHANNELS.messaging.GET_PLATFORM_OWNERS,
+ RPC_CHANNELS.messaging.SET_PLATFORM_OWNERS,
+ ... (共 9 个 channel)
```

| 项 | 值 |
|---|---|
| 我们的 marker | `// U-API: classify v0.9.1 access-control channels missed by upstream's routing.ts`（origin/main L438）|
| 我们 marker 上下文 | L438 注释 + L439-446 9 个 channel |
| 上游动作 | 在**同一个位置**也补了 9 channel + 不同的分组注释（先 PENDING_CHANGED 单独，再 8 个 access control 分组）|
| 冲突等级 | **硬冲突**（不是软冲突——同 hunk 同位置加内容，git 3-way merge 必标 `<<<<<<<` markers）|
| 处理 | 全盘**接受 theirs**：删我们的 `// U-API:` 注释行，删我们的 9 channel block，让上游版本生效（上游版本 + 我们版本通道列表内容**完全一致**，只是分组顺序略不同）|
| §3.7 表更新 | **删 #37 行** |
| 基线刷新 | **94 → 93**（删 1 处 marker）|

> 这是好事——证明我们 v17 漏盘补丁的 patch 上游也走通了，且**与上游修复逻辑一致**（差异 0）。

### 3.1a #11o provider-icons.ts — **软冲突 spot check**（不是真冲突）

```diff
+ if (url.includes('manifest.build')) return 'Manifest'
```

| 项 | 值 |
|---|---|
| 我们改造点 | L58-59 const 对象 `providerDisplayNames`：`pi: 'U-API', pi_compat: 'U-API'`（§3.7 #11o Round 45，**不加注释 marker**）|
| 上游动作 | L73 在函数 `getProviderDisplayName` 体内加 `if (url.includes('manifest.build')) return 'Manifest'` + L171-174 加 Manifest favicon fallback |
| 行号重叠 | **无**（我们 L58-59 const，上游 L73 + L171-174）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后检查 L58-59 仍是 `pi/pi_compat: 'U-API'`，且 L73 / L171 上游 Manifest 分支已合入 |

### 3.1b #11o FreeFormInput.tsx — **软冲突 spot check**（不是真冲突）

| 项 | 值 |
|---|---|
| 我们改造点 | L383/393 `groups['U-API']` 分组（§3.7 #11o Round 45 部分，**不加注释 marker**）|
| 上游动作 | L75 + L77 加 `import { CompactSourceSelector }` + `import { derivePickerMode }`；L335-344 新增 `pickerMode` 计算（修 issue #727）|
| 行号重叠 | **无**（我们 L383+，上游 L75-77 + L335-344）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后 grep `'U-API'` 在该文件仍命中 2 处 |

### 3.1c §3.3 apisetup/ApiKeyInput.tsx — **软冲突 spot check**

| 项 | 值 |
|---|---|
| 我们改造点 | §3.7 #12 `U_API_TOPUP_URL no longer imported` 注释 + #13 `lockNotice` 删除注释 + 2 处 JSX `{/* U-API: */}` 行内 |
| 上游动作 | ANTHROPIC_PRESETS 数组 L112 加 manifest entry + 新增 `OPENAI_COMPAT_CUSTOM_URL_PRESETS` 常量 + 改 `loadPiModels` / `handlePresetClick` / `handleSubmit` 三函数（提取 helper `resolveCustomEndpointPayload` 到 submit-helpers.ts）|
| 行号重叠 | **无**（我们注释在 import 区 + JSX；上游改在 const + 函数体）|
| 预期 merge | **git 3-way auto-merge 干净通过**，但 import 区是 hotspot |
| 验证 | merge 后 `grep -c "U-API:" apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` = **4**（保持不变：#12 一行注释 + #13 一行注释 + 2 处 JSX `{/* U-API: */}`）|

### 3.2 #11o AiSettingsPage.tsx — **真冲突**（手动合并）

```diff
- case 'pi_compat': parts.push('Craft Agents Backend Compatible'); break
+ case 'pi_compat':
+   parts.push(connection.baseUrl?.toLowerCase().includes('manifest.build')
+     ? 'Manifest'
+     : 'Craft Agents Backend Compatible')
+   break
...
- conn.providerType === 'pi_compat' ? 'Craft Agents Backend Compatible' :
+ conn.providerType === 'pi_compat' ? (conn.baseUrl?.toLowerCase().includes('manifest.build') ? 'Manifest' : 'Craft Agents Backend Compatible') :
```

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 #11o（连同 #20-25 一系列 AiSettingsPage 改造）|
| 我们已经把 | `'Craft Agents Backend Compatible'` → `'U-API Compatible'` |
| 上游加了 | manifest 分支判定 |
| 冲突位置 | 行 233-237 + 行 974（v0.9.2 base 行号；merge 时上下文匹配会自动对齐）|
| **解决方案** | 保留 manifest 分支的**结构**，把 fallback `'Craft Agents Backend Compatible'` 改成 `'U-API Compatible'`：<br><br>```tsx``<br>case 'pi_compat':<br>  parts.push(connection.baseUrl?.toLowerCase().includes('manifest.build')<br>    ? 'Manifest'<br>    : 'U-API Compatible')<br>  break<br>``` |
| 为什么不直接保我们的 ours（删 manifest 分支）| `enforceUApiBaseUrl` 会强制重写 baseUrl 到 U-API，manifest 分支实际是死代码——但**保留减少未来同步成本**（上游再加 case 时不会再撞）|
| §3.7 表更新 | **不变**（marker 还在原位）|

### 3.3 #48a-d source-test.ts — **预计干净 merge**（行号不重叠）

我们的 marker 位置：
```
L23   import { assertPublicHttpsUrl }
L469  basic test 的 fetch 前 SSRF 守卫
L591/604  credential-bearing fetch 的 redirect:'manual' + 30x reject
L667/675/684/692  basic path 3× fetch 的 redirect:'manual' + 30x reject
```

上游改动位置：
```
L775-823  testMcpConnection 函数内（OAuth/bearer token forward to MCP probe）
```

| 项 | 值 |
|---|---|
| 行号重叠 | **无**（我们改 L23-692，上游改 L775-823）|
| 函数重叠 | **无**（我们的 fetch 守卫都在 HTTP source test path；上游改的是 MCP source test path）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 完后立即跑 `grep -c "M3 SSRF" packages/session-tools-core/src/handlers/source-test.ts`，期望 **8**（不变）|

### 3.4 #46 storage.ts browserToolEnabled — **干净**

```diff
- type: 'image' | 'pdf' | 'text' | 'office' | 'unknown';
+ type: 'image' | 'pdf' | 'text' | 'office' | 'audio' | 'unknown';
...
- const ATTACHMENT_CONTENT_TYPES = new Set(['image', 'pdf', 'text', 'office', 'unknown']);
+ const ATTACHMENT_CONTENT_TYPES = new Set(['image', 'pdf', 'text', 'office', 'audio', 'unknown']);
```

仅改 `DraftAttachmentContent` type + `ATTACHMENT_CONTENT_TYPES` set。`browserToolEnabled` 默认值未碰。✅ 干净。

### 3.5 #27 App.tsx — **干净**

仅改 1 处：`pt-[48px]` → `style={{ paddingTop: 'var(--topbar-height)' }}`（响应式 topbar 高度），不撞 first-install onboarding 路由逻辑。

### 3.6 其它 88 处 marker — **路径无交集，全干净**

跑下述 grep 即可三方验证：

```bash
# 所有 §3.7 marker 文件
git grep -lE "U-API:" packages apps | sort -u > /tmp/our-marker-files.txt
# v0.9.3 改的文件
git diff --name-only 8981384b..upstream/main | sort -u > /tmp/v093-changed-files.txt
# 交集 = 需手动 review 的
comm -12 /tmp/our-marker-files.txt /tmp/v093-changed-files.txt
# 期望输出：上述 §3.1 - §3.5 已覆盖的几个文件
```

---

## 4. C 系列风险扫描（C10-C14）

| # | 模式 | 状态 | 详情 |
|---|---|---|---|
| **C10** | 上游 connection 加新字段需透传 | ✅ 未触发 | llm-connections.ts/provider-metadata.ts 全干净；`enforceUApiBaseUrl` 浅合并保字段策略仍生效 |
| **C11** | 上游新文件用 `@craft-agent/` scope | ⚠️ **触发** | diff 中**新增** `@craft-agent/*` import **9 处**（剔除 1 处 release notes markdown 描述后真实代码 9 处）。**6 个文件**：`CompactSessionListFilter.tsx`(2)、`CompactSessionMenu.tsx`(1)、`useSessionMenuActions.ts`(1)、`playground/.../ChatDisplayMobilePreview.tsx`(1)、`playground/.../mock-mobile-data.ts`(1)、`messaging-gateway/__tests__/gateway-button-perm.test.ts`(1)。详见 §6.4 sed |
| **C12** | 上游 release 自身 lint 违规 | ✅ 未触发 | release notes 反而**新增** `lint:i18n:strings` 全仓扫描脚本（更严）。merge 后跑 `bun run lint:i18n:parity && bun run lint:electron` 验证 |
| **C13** | 上游 release 自身 test fail | ✅ 未触发 | 反而**修了** v0.9.1 的 routing exhaustiveness test（即我们 §3.7 #37）。merge 后跑 `bun test` 应当全绿（含我们 v27 SSRF 8 测试 + 防回归测试 #46t） |
| **C14** | build-win.ps1 与 root chain 差距 | ✅ 未触发 | `apps/electron/scripts/build-win.ps1` 未在 diff stat；事故 #3/#4/#5 修复仍生效 |

---

## 5. 新决策点（3 项，开 merge 前应当与用户对齐）

### 5.1 Manifest provider preset 在 onboarding dropdown 中暴露策略

**现状（上游）**：
- ApiKeyInput.tsx 的 `ANTHROPIC_PRESETS` 数组（line 112）新增一项：
  ```ts
  { key: 'manifest', label: 'Manifest', url: 'https://app.manifest.build/v1', placeholder: 'mnfst_...' }
  ```
- 同时新增 `OPENAI_COMPAT_CUSTOM_URL_PRESETS = new Set(['manifest'])` —— 让 Manifest preset 走 OpenAI-compat 路径（pinned to `openai-completions` API）

**我们的现状**：
- §3.7 #13 已删除 `lockNotice` + 三链接，但 **preset dropdown 本身没裁剪**（M1 决策：少改一处少一个同步成本）
- `enforceUApiBaseUrl` 在 storage 写入时会强制重写 baseUrl 到 `https://token.u-studio.cn/v1`

**决策建议**：**不裁剪 Manifest preset，全盘接收**

**理由**：
- (a) 用户即使选 Manifest，提交时 baseUrl 仍被 `enforceUApiBaseUrl` 重写——**功能上无害**
- (b) 当前 ApiKeyInput.tsx 已经显示了 ANTHROPIC_PRESETS 全部 preset（含 Vercel/Groq/Minimax/Kimi/Custom 等），多一个 Manifest 不破坏认知
- (c) 裁剪 = 多一个改造点 + 多一处未来同步冲突，违反 M1 "尽量少动" 原则
- (d) 真正的保险栓在 storage 层不在 UI 层（深度防御）

**风险**：用户看见 Manifest preset 可能困惑"我能用 Manifest 吗"——可以在 M2 i18n 阶段加一行说明（譬如 zh-Hans 的 preset tooltip 注明"所有 preset 实际走 U-API"）。当前 M1+M2 不优先。

**若用户决定要裁剪**：在 ApiKeyInput.tsx 加一个 `BLOCKED_PRESETS = new Set(['manifest'])`，filter 掉。新增 §3.7 改造点。

### 5.2 GHCR namespace 迁移 `lukilabs` → `craft-ai-agents`

**对我们影响**：
- 上游改了 GHCR / workflow 引用，但**我们不发布 Docker image**，也不用上游 workflow 推产物
- workflow 改动会自动跟随 merge（validate.yml 加 illegal-filename step + 改 image ref）

**决策建议**：**全盘接收 workflow 改动，不做 brand 替换**（M1 阶段我们不在 lukilabs 也不在 craft-ai-agents 的 GHCR 推镜像）

### 5.3 mobile/compact UI 是否在 U-API 桌面端启用

**上游行为**：renderer 检测 shell 宽度 < 768px 自动切 mobile UI（包括桌面 app 窗口拉窄时也触发）

**对我们影响**：
- M2 阶段：触发条件 = 用户主动把窗口拉到 < 768px。这是上游强烈推荐的"WebUI delivery" pre-work
- M1 阶段：用户实测窗口默认 ≥ 1200px，不会触发，**对当前用户群无影响**

**决策建议**：**全盘接收**，M2 i18n 阶段顺便把 mobile menu 新增字串纳入翻译范围。

---

## 6. merge 执行命令模板

> 以下命令**由用户/外部 AI 执行**，本仓库 AI 不跑。

### 6.0 准备分支

```bash
# 当前应该在 main 分支且 working tree clean
git status
git log --oneline -1 main
# 期望：HEAD 在 f8339872 (revert: 撤销 web/download-page/) 或更新

# 创建 sync 分支
git checkout -b sync/upstream-20260512-v093
```

### 6.1 跑 merge

```bash
git merge upstream/main
```

**预期结果**：
- ✅ 大部分文件自动合并通过
- ⚠️ **2 个真/硬冲突**（必须手动处理 git conflict markers）：
  - `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`（§3.2 详述 — manifest 分支 + `'U-API Compatible'`）
  - `packages/shared/src/protocol/routing.ts`（§3.1 详述 — 删 #37 marker + 9 channel block，全盘接受 theirs）
- ⚠️ **4 个软冲突 spot check**（git auto-merge 可能干净通过，但需逐项验证 marker 未被吞）：
  - `apps/electron/src/renderer/lib/provider-icons.ts`（§3.1a 详述）
  - `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`（§3.1b 详述）
  - `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`（§3.1c 详述）
  - `packages/session-tools-core/src/handlers/source-test.ts`（§3.3 详述）

### 6.2 处理 AiSettingsPage.tsx 真冲突

打开冲突标记，按 §3.2 方案手动合并。两处都需要把 fallback `'Craft Agents Backend Compatible'` 改成 `'U-API Compatible'`：

```tsx
// 第 1 处（ConnectionRow 内 line ~233）
case 'pi_compat':
  parts.push(connection.baseUrl?.toLowerCase().includes('manifest.build')
    ? 'Manifest'
    : 'U-API Compatible')   // ← 这里把 'Craft Agents Backend Compatible' 改成 'U-API Compatible'
  break

// 第 2 处（default connection selector 内 line ~974）
conn.providerType === 'pi_compat' ? (conn.baseUrl?.toLowerCase().includes('manifest.build') ? 'Manifest' : 'U-API Compatible') :
```

### 6.3 处理 routing.ts #37 自动过期

打开 `packages/shared/src/protocol/routing.ts`，找到我们加的：
```ts
// U-API: classify v0.9.1 access-control channels missed by upstream's routing.ts
```
**删除这行注释 + 全盘接受上游版本的 9 channel 追加**。

更新 [`CLAUDE.md`](../../CLAUDE.md) §3.7 表：删除 **#37 行**。

更新基线：94 → 93（如果 #45c P0 也已被 v0.9.3 影响则另算，但实测 §3.6 grep 不会触发）

### 6.4 跑 C11 批量 sed（NPM scope rename）

```bash
# 先 grep 看实际触发量（merge 后跑，预期 ~9 处 / 6 文件）
git grep -lE "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" | sort -u
# 预期命中文件清单：
#   apps/electron/src/renderer/components/app-shell/CompactSessionListFilter.tsx
#   apps/electron/src/renderer/components/app-shell/CompactSessionMenu.tsx
#   apps/electron/src/renderer/hooks/useSessionMenuActions.ts
#   apps/electron/src/renderer/playground/demos/mobile-webui/ChatDisplayMobilePreview.tsx
#   apps/electron/src/renderer/playground/demos/mobile-webui/mock-mobile-data.ts
#   packages/messaging-gateway/src/__tests__/gateway-button-perm.test.ts

# 批量 rename（与 v0.9.2 sync 同 SOP）
git ls-files 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' | \
  xargs grep -l '@craft-agent/' 2>/dev/null | \
  while read f; do
    sed -i.bak "s|@craft-agent/|@u-agents/|g" "$f"
    rm "${f}.bak"
  done

# 验证 = 0
git grep -E "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" | wc -l
```

### 6.5 跑验证三件套

```bash
# typecheck
bun run typecheck:all
# 期望：全绿

# 改造点基线 grep（详见 §3.7 节命令）
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：93（94 − 1，#37 被删）

grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 9

# 单元测试
bun test
# 期望：全绿（含 v27 SSRF 7 测试 + #46t 防回归测试）
```

### 6.6 验证残留 craft 字面量（新发现）

```bash
# 检查 release notes 描述的 log 路径字面量是否真在代码
grep -rEn "@craft-agent/electron/main\\.log" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null
# 预期：0 命中（如有命中，加 §3.7 改造点 + brand 替换）

# 全局 craft 字面量扫（应只剩 v17 漏盘补丁后接受的 i18n / FEATURE_FLAGS 门控字面量）
grep -rEn --exclude-dir=node_modules --include="*.ts" --include="*.tsx" -i "craft.agent\|craftagent\|craft-agent" packages apps | grep -v "U-API:" | wc -l
# 与 v0.9.2 sync 后的基线对比，应当≈相同
```

---

## 7. merge 前 / 中 / 后 checklist

### 7.1 merge 前（user/外部 AI 跑）

- [ ] `git status` clean
- [ ] `git log --oneline upstream/main -1` = `c310624f v0.9.3`
- [ ] 当前在 `main` 分支
- [ ] 已读本报告 §3 - §5 全部决策点
- [ ] 与用户确认 §5.1（Manifest preset 不裁剪）+ §5.2（GHCR 接收）+ §5.3（mobile UI 接收）
- [ ] 已 `git checkout -b sync/upstream-20260512-v093`

### 7.2 merge 中

- [ ] `git merge upstream/main` 跑通（大部分文件自动合并）
- [ ] AiSettingsPage.tsx 真冲突按 §6.2 手动合并（2 处 `'U-API Compatible'`）
- [ ] routing.ts #37 注释删除 + 接受上游 9 channel（§6.3）
- [ ] ApiKeyInput.tsx 软冲突 spot check（确认我们的 #13 lockNotice 删除注释、#12 U_API_TOPUP_URL 删除注释、`// U-API:` JSX 行内 2 处都还在）
- [ ] source-test.ts 软冲突 spot check（`grep -c "M3 SSRF" packages/session-tools-core/src/handlers/source-test.ts` = **8**）
- [ ] `git add` 冲突解决后的文件 + `git commit -m "sync: merge upstream/main as of 20260512 (v0.9.3)"`

### 7.3 merge 后

- [ ] C11 批量 sed rename（§6.4）
- [ ] 验证三件套（§6.5）：typecheck / 基线 grep / bun test
- [ ] 残留 craft 字面量 grep（§6.6）
- [ ] **更新 [`CLAUDE.md`](../../CLAUDE.md) §3.7**：
  - 删除 #37 行
  - 历次演进表加一行：`v0.9.3 sync（2026-05-12 commit <hash>）：93 处（−1 marker：routing.ts #37 上游已修，删 patch）`
  - 浮动基线 ±2 不变
- [ ] **更新 [`07-upstream-sync.md`](../07-upstream-sync.md)**：基线刷新
- [ ] 写一份 `.planning/sync-reports/SYNC-v0.9.3-20260512.md` 记录实际 merge 流程（与本预测报告对比）
- [ ] **commit**：`docs: SYNC v0.9.3 报告 + §3.7 历次演进表加 v0.9.3 行`

---

## 8. 实测验收清单（用户跑）

按 [`09-test-checklist.md`](../09-test-checklist.md) 全量跑，重点关注：

### 8.1 onboarding 流程（首装 U-API）
- [ ] 启动 app
- [ ] onboarding 走通：输 Token → 选 Anthropic Messages（或 OpenAI Chat Completions）→ 进首屏
- [ ] **新增检查**：ANTHROPIC_PRESETS dropdown 显示 Manifest preset（不裁剪）但**选择后 baseUrl 仍被重写到 token.u-studio.cn**
- [ ] AiSettingsPage 上"Default Connection"显示为 `U-API Compatible`（非 `'Craft Agents Backend Compatible'` 也非 `'Manifest'`）

### 8.2 对话路径
- [ ] 发第一条消息走通
- [ ] 触发上下文溢出（譬如 Read 一个大 base64 PDF）—— 看新的 "Context Window Exceeded" 错误页（含 `/compact` 建议），不再是 v0.9.2 的"remove attachments"误导文案
- [ ] 桌面通知字面量仍为 `U Agents has a new message for you`（§3.7 #11l）

### 8.3 Mobile UI（新增）
- [ ] 把窗口拉到 < 768px 宽 —— 自动切 mobile 布局（AppMenu 抽屉 / FAB new chat）
- [ ] 拉回 ≥ 768px —— 自动回桌面布局
- [ ] mobile 模式下 onboarding 仍能走通

### 8.4 §3.5 不暴露上游品牌
- [ ] 关于页 / About panel 仅显示 U Agents / U Studio（§3.7 #28）
- [ ] 错误对话框无 craft 字面量
- [ ] 系统 prompt 仍是 U Agents（§3.7 #11h）

### 8.5 D-β 分发实测
- [ ] macOS arm64：`bun run electron:dist:adhoc:mac` 出 DMG → 实测装包对话走通
- [ ] Windows x64：用户机/VM 跑 `apps/electron/scripts/build-win.ps1` → 出 EXE → 实测装包对话走通
- [ ] R2 上传按 [`06-update-server.md`](../06-update-server.md) §4.2 SOP（含本次新加的 4 项防错）

---

## 9. 风险评估与后续动作

### 9.1 风险等级：**低**

| 风险源 | 等级 | 缓解 |
|---|---|---|
| §3.3 真冲突 | 无 | 0 真冲突 |
| §3.7 真冲突 + 硬冲突 | 低 | 1 处 AiSettingsPage 手动合并 + 1 处 routing.ts 全盘 theirs，方案明确 |
| §3.7 软冲突 spot check | 极低 | 3 处（provider-icons / FreeFormInput / ApiKeyInput）git 应自动通过，spot check 命令在 §3.1a-c |
| C11 sed rename | 低 | SOP 已成熟（v0.9.1 + v0.9.2 经验），6 文件清单已枚举 |
| Mobile UI 引入回归 | 低 | 仅在 < 768px 触发，桌面默认无感 |
| Manifest preset 用户困惑 | 低 | M1 接受现状，M2 i18n 阶段加 tooltip 说明 |

### 9.2 触发的 backlog

无新增 backlog——v0.9.3 不引入 M3 SSRF / OAuth / TLS 范围扩张。

### 9.3 跨 sync 对比

| 维度 | v0.9.1 sync | v0.9.2 sync | **v0.9.3 sync（预测）** |
|---|---|---|---|
| 文件数 | ~70 | ~38 | **134** |
| §3.3 真冲突 | 2 | 0 | **0** |
| §3.7 真冲突 | 1（v17 漏盘）| 0 | **1**（AiSettings manifest 分支）|
| §3.7 硬冲突自动过期 | 0 | 0 | **1**（routing.ts #37）|
| §3.7 软冲突 spot check | 1 | 0 | **3**（provider-icons / FreeFormInput / ApiKeyInput）|
| C11 触发 | 12 文件 20 处 | 1 文件 2 处 | **6 文件 9 处** |
| C12 lint 违规 | 3 处 | 0 | **0** |
| C13 test fail | 1（routing）| 0 | **0**（反而修了 v0.9.1 那个）|
| 新 spec | M3-SSRF-CONSOLIDATION | 0 | **0** |
| 评级 | A− | A−（macOS x64 deferred）| **预测 A**（无新 P0，分发 D-β 复用）|

v0.9.3 是 **fork 历史上最干净的 sync**——既不需要新 spec 也不需要新分发实验。

---

## 10. 完成后报告归档

merge 完成后，本预测报告应当：
- **保留** 在 `.planning/sync-reports/` 作为预测 vs 实际对比的参考
- 同时写一份 `.planning/sync-reports/SYNC-v0.9.3-20260512.md` 记录实际流程
- 实际报告里至少含：实际触发的 C11 文件清单 + 实际 §3.7 marker 数 + 实测装包结果 + 与本预测报告的差异点

---

## 附录 A — 关键数据来源命令清单

```bash
# 上游 ref 状态
git remote -v
git log --oneline 8981384b..upstream/main
git log -1 upstream/main --pretty=fuller

# 影响面
git diff --stat 8981384b..upstream/main
git diff --name-status 8981384b..upstream/main

# §3.3 高冲突文件交集
git diff --stat 8981384b..upstream/main -- \
  apps/electron/electron-builder.yml \
  packages/shared/src/branding.ts \
  packages/shared/src/config/llm-connections.ts \
  packages/shared/src/config/provider-metadata.ts \
  apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx \
  apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx \
  apps/electron/src/renderer/components/apisetup/

# §3.7 关键 marker 文件交集
git diff --stat 8981384b..upstream/main -- \
  packages/session-tools-core/src/handlers/source-test.ts \
  packages/shared/src/sources/credential-manager.ts \
  packages/shared/src/sources/api-tools.ts \
  packages/pi-agent-server/src/tools/web-fetch.ts \
  apps/electron/src/main/auto-update.ts

# Manifest preset 位置
git grep -E "Manifest|manifest\\.build|OPENAI_COMPAT_CUSTOM_URL_PRESETS" upstream/main -- 'packages/' 'apps/electron/src/renderer/'

# C11 触发量
git diff 8981384b..upstream/main | grep -E "^\\+.*@craft-agent/" | wc -l

# C11 按文件聚合（哪些文件需要 sed rename）
git diff 8981384b..upstream/main | \
  awk '/^diff --git/{file=$3} /^\+.*@craft-agent\//{print file}' | sort -u

# §3.7 marker 文件 × v0.9.3 改文件 交集
git grep -lE "U-API" packages apps --include="*.ts" --include="*.tsx" | sort -u > /tmp/our-marker-files.txt
git diff --name-only 8981384b..upstream/main | sort -u > /tmp/v093-changed-files.txt
comm -12 /tmp/our-marker-files.txt /tmp/v093-changed-files.txt
```

---

## 附录 B — Review 修订记录（2026-05-12）

> 本报告初版（11:47 写入）后做了一轮整体 review，发现 5 个事实漏点 + 2 个不准确表述。本节记录修订前后差异，便于复盘。

### B.1 事实漏点（5 处，已 Edit 修正）

| # | 位置 | 初版（错）| 修订后（对）|
|---|---|---|---|
| 1 | §0 TL;DR / §4 C11 表 / §9.3 跨 sync 对比 | C11 触发"~3 文件 9 处" | **6 文件 9 处**（按文件聚合 grep 验证：CompactSessionListFilter / CompactSessionMenu / useSessionMenuActions / 2 个 mobile-webui playground / gateway-button-perm test）|
| 2 | §3.1 routing.ts | "软冲突" | **硬冲突**（marker + 9 channel 在同一 hunk，上游也在同 hunk 加内容；git 3-way merge 必标 conflict marker，需手动全盘 theirs）|
| 3 | §2.2 §3.7 改造点路径交集 | "共 6 文件，1 真冲突 + 1 自动过期" | **共 8 文件，1 真 + 1 硬冲突过期 + 3 软冲突 spot check + 3 干净**（漏盘了 provider-icons.ts + FreeFormInput.tsx + ApiKeyInput.tsx 的 #11o Round 45 字面量改造与上游交集）|
| 4 | §3 章节缺 §3.1a/3.1b/3.1c | 缺 provider-icons.ts + FreeFormInput.tsx + ApiKeyInput.tsx 的逐项处理 | 已补 3 个新子章节，每个含改造点位置 / 上游动作 / 行号重叠 / 预期 merge / 验证命令 |
| 5 | §6.1 预期结果清单 | "3 个软冲突" | **2 真/硬冲突 + 4 软冲突 spot check** |

### B.2 不准确表述（2 处，已澄清）

| # | 位置 | 初版（误导）| 修订后 |
|---|---|---|---|
| 6 | §2.5 错误处理与上下文 | "release notes 描述 log path 字面量可能在别处文件，merge 后 grep 验证；如有命中加进 §3.7 + 品牌替换" | 验证后确认：字面量在 `print-system-prompt.ts`，但我们 M1 commit `393409ce` 已改，v0.9.3 上游未碰该文件，merge 自动保 ours。**无需手动处理**，仅保留 §6.6 grep 作预防 net |
| 7 | §9.1 风险评估 | 列了"release notes 描述 log path 字面量"作为低风险项 | 删除该项（已确认无残留风险）|

### B.3 review 用到的关键命令

```bash
# C11 按文件聚合
git diff 8981384b..upstream/main | awk '/^diff --git/{file=$3} /^\+.*@craft-agent\//{print file}' | sort -u

# routing.ts marker 上下文
grep -n -B2 -A8 "classify v0.9.1 access-control" packages/shared/src/protocol/routing.ts

# §3.7 marker 文件 × v0.9.3 改文件 交集
git grep -lE "U-API" packages apps --include="*.ts" --include="*.tsx" | sort -u > /tmp/m.txt
git diff --name-only 8981384b..upstream/main | sort -u > /tmp/v.txt
comm -12 /tmp/m.txt /tmp/v.txt
# 实测交集：8 个文件（与 §2.2 表对应）

# print-system-prompt.ts review
grep -nE "U-API|@craft-agent|Craft Agents|craftagent" packages/shared/src/prompts/print-system-prompt.ts
# 命中数：0（我们已改，merge 自动保 ours）

# provider-icons.ts / FreeFormInput.tsx 是否有 marker 注释
grep -nE "// U-API:|/\* U-API" apps/electron/src/renderer/lib/provider-icons.ts
grep -nE "// U-API:|/\* U-API" apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx
# 命中数：均 0（说明 #11o Round 45 是字面量改造，不计入基线 grep 94）
```

### B.4 review 经验沉淀（写进 §07-upstream-sync.md SOP）

- **C5（CLAUDE.md C5）"新改造点忘记加单测"扩张到"新改造点同时确认是否进基线 grep"**：本次发现 #11o Round 45 的 provider-icons.ts / FreeFormInput.tsx 是**字面量改造不加 marker**——这个 hidden 属性必须在预测报告里显式标"软冲突 spot check"
- **review 必查命令"`git grep -lE U-API × v0.9.X --name-only` 交集"**：本次正是这条命令暴露了 4 个 §3.7 文件被漏报。下次 sync 预测必须把这条命令的输出贴进报告
- **release notes 描述 ≠ 代码现状**：release notes 提到"添加 X 字面量"不代表代码里真的硬编码该字面量——可能是 dynamic 计算 / 描述夸大。预测报告必须以**实际 diff grep**为准
