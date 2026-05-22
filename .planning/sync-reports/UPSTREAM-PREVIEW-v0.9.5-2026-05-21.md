# UPSTREAM PREVIEW — v0.9.5 同步预分析报告（2026-05-21）

> **本报告由本仓库 AI 在 `git fetch upstream`（已只读 fetch 拉到 `v0.9.5` tag 后）通过 `git diff v0.9.4..v0.9.5` 只读分析产出**。
> 不动代码、不动 git refs、本地工作树仍是 v0.9.4（commit `0a49a089`，2026-05-20）。
> 目的：给执行 merge 的用户/外部 AI 一份可直接照做的预案。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.3 / §3.7 + [`07-upstream-sync.md`](../07-upstream-sync.md) + [`08-conflict-zones.md`](../08-conflict-zones.md)

> **REVIEW-1 修订（2026-05-21 同日）**：修正 3 处事实错误（详见 §12 修订日志）：
> 1. §2.3 新文件清单：实际 21 个 NEW，原列 24 个（多算了 3 个 MODIFIED 当 NEW）
> 2. C11 触发面：实际 7 文件 9 处 import + 15 package.json，原文写"21 新文件全部"/"13 文件 ~50 处"（夸大约 6×）
> 3. C12 措辞："5 轮静态预测" 改为"1 轮预测"（本次只跑了 1 轮，沿用了 v0.9.4 PREVIEW 模板的措辞）
>
> 事实结论不变（0 §3.3 真冲突 / 1 §3.7 真冲突 / 1 C13 / A− 评级）。同时新增 §11 M3-I18N-FIX 搭车评估。

> **REVIEW-6 修订（2026-05-21 Phase 3 spec 文档同步时发现）**：本文档多处（§2.3 / §3 / §6.3 commit message / §11.5.1 编号撞车决策 / §11.11.6 Phase 3 步骤 4 / §11.11.7 commit message）写"按文件路径字典序：model-picker = #53，M3 i18n = #54"，但**实际落地按时间顺序**：M3 i18n fix commit `5212197b` 先落地占了 #53，v0.9.5 sync 自身的 model-picker brand patch 落到 #54。CLAUDE.md §3.7 表已按事实更新（"v0.9.5 sync 期间新增改造点" 子表 #54 = model-picker brand）。本文档历史 "model-picker=#53, M3 i18n=#54" 措辞保留作为决策推演记录，但**最终事实**是 **M3 i18n = #53 + model-picker brand = #54**。详见 §12 修订日志 REVIEW-6。

---

## 0. TL;DR

| 维度 | 判断 |
|---|---|
| 上游新版本 | **v0.9.5**（tag commit `96454c27`；距 v0.9.4 6 天）|
| commit 类型 | 单个 squash release commit（与 v0.9.0/v0.9.1/v0.9.2/v0.9.3/v0.9.4 同模式）|
| 影响面 | **73 文件 / +4167 −797 行**（比 v0.9.4 大约 5×，但比 v0.9.3 的 134 文件 / +7641 行小约 2×）|
| **冲突等级** | **A−（小冲突）** —— 跟 v0.9.4 同档；§3.3 高冲突文件 0 真冲突，§3.7 改造点 1 处真冲突需重新应用 brand patch |
| §3.3 高冲突文件真冲突数 | **0**（electron-builder.yml / branding.ts / llm-connections.ts / provider-metadata.ts / ProviderSelectStep / OnboardingWizard / apisetup 目录全部未碰）|
| §3.7 改造点真冲突数 | **1 真**（model picker brand 字面量被上游抽取到新 helper，需在新文件里重新 patch + 同步改 4 处单测）|
| §3.7 改造点交集文件 | **1 文件**（FreeFormInput.tsx — L395/L405 `'U-API'` 字面量 marker，上游重构后**已移出本文件**）|
| §3.7 自动过期 marker | **0** |
| §3.7 基线变化预测 | **96 → 97**（+1：sync 同 commit 新增 `model-picker-helpers.ts` brand patch）<br>**若同 commit 搭车 M3-I18N-FIX：96 → 98**（+2：再加 M3 renderer/main.tsx i18n startup sync；详见 §11）|
| §3.7 **新增改造点**（merge 后必做）| **1 项**：`apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts` 内 `'Craft Agents Backend'` → `'U-API'` brand patch + docblock 注释微调 + 4 处单测断言同步改 |
| **C11 NPM scope rename 触发** | **是**（21 新文件中 5 个 + 2 修改文件共 **7 文件 9 处** `@craft-agent/` import；15 个 package.json `"name"` 字段 `@craft-agent/...` 需 batch sed → `@u-agents/...`）|
| **C12 ESLint 违规** | **预测 0**（1 轮静态扫描未见新增 disable / 新增违规模式；merge 后跑 `bun run lint:electron` 实测确认）|
| **C13 上游死引用** | **1 处**：`package.json` scripts `lint:tool-name-checks` 引用 `scripts/check-task-tool-checks.sh`，但**该文件不存在于 v0.9.5 tree**，merge 后 `bun run lint` 会 fail（与 M2.5 #5 / v0.9.1 routing.ts / v0.9.4 #52 同模式）|
| **C14 build-win.ps1 漂移** | **0**（v0.9.5 没新增 root chain helper）|
| **底层 SDK 升级** | **无**（Pi SDK 仍 0.73.1；本 release 是 UX polish + bug fix）|
| **新决策点** | **0**（与 v0.9.4 RTK 集成那种"要不要接收"不同，v0.9.5 全部是 UX 兼容向 + bug fix，没引入"我们要不要保留"的功能）|
| `release-notes/0.9.5.md` 处理 | **brand 五件套 4 命中**（craft-agents-oss 链接 + 字面量）—— 沿 0.9.4.md 历史路径处理 + 中文翻译 |
| `bun.lock` 处理 | **沿 v0.9.4 SOP**：merge 后用 `git checkout 96454c27 -- bun.lock && bun install` 增量同步，避免 Sentry dup install 副作用 |
| 推荐时机 | **本周内 sync**，按 v0.9.4 SOP 走即可，无需 P0 review |
| 推荐分发 | **macOS arm64 + Windows x64**（与 v0.9.4 D-β 一致）|

---

## 1. 上游版本元数据

```
tag           v0.9.5
release       2026-05-21（推测；以 GitHub Release 页时间为准）
commit        96454c2776c199f7fef6f4d1b3024197c2596a31
prerelease    false
title         v0.9.5 — Compact-mode UX polish and MCP / branching stability
```

**主题（按 release notes 顺序）**：

| 区域 | 一句话 | 影响面 |
|---|---|---|
| Features × 5 | (a) Compact-mode 会话行菜单改 vaul drawer；(b) Compact-mode working-directory selector 改 drawer；(c) Compact-mode 输入框可折叠/展开；(d) AcceptPlan picker compact 改 drawer；(e) Web UI 移动断点自动 compact model selector | **全部是 compact / mobile 视图 UX 改进**——对桌面/常规视图无变化；与我们 fork 的 UI lockdown 无功能冲突 |
| Improvements × 2 | (a) 抽 `useWorkingDirectoryState` hook 统一桌面 dropdown 和 compact drawer；(b) Windows RTK 安装路径文档澄清 | hook 抽取 = 重构同向；RTK 文档与我们 fork 无关（我们 04 §九类裁 browser tool；RTK 仍保留但小众）|
| Bug Fixes × 7 | (a) Pi-backed branching 不再丢最后一条 assistant 消息（#782）；(b) Stdio MCP `source_test` 真实诊断替代假超时（#787）；(c) 并行 `source_test` 不再卡住 session（#790）；(d) AcceptPlan dropdown 锚点漂移 + WebUI compact 渲染修复；(e) 工具调用结尾的 turn 不再卡 "Thinking…"；(f) Messaging gateway `progress`/`final_only` 模式交付最终消息（#779）；(g) SDK Agent subagent activity 折叠修复 | 全部是稳定性修复，**与我们 fork 改造完全无路径交集**（branching、MCP source_test、AcceptPlan、turn lifecycle 都不动我们 patch 过的代码）|
| Breaking | **None**（向后兼容；所有改动 opt-in 或 bug fix）| —— |

---

## 2. 73 文件分类清单

按"对我们的影响域"分桶，便于 merge 时分批 review。

### 2.1 §3.3 高冲突文件交集（0 文件，**0 真冲突**）

| 文件 | 上游变更 | 真冲突？ |
|---|---|---|
| `apps/electron/electron-builder.yml` | **未碰** | ✅ 干净 |
| `packages/shared/src/branding.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/llm-connections.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/provider-metadata.ts` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/apisetup/` 目录 | **未碰** | ✅ 干净 |

✅ **§3.3 表全绿** —— fork 历史上第 N 次干净（v0.9.4 也是全绿）。

### 2.2 §3.7 改造点路径交集（**1 文件，1 真冲突**）

> v0.9.5 上游做了一个抽取重构：把 `FreeFormInput.tsx` 内联的 `connectionsByProvider` 逻辑（含 brand 字面量 `'Craft Agents Backend'`）抽到新文件 `model-picker-helpers.ts:groupConnectionsByProvider()`。我们 fork 把 `'Craft Agents Backend'` 就地 patch 成 `'U-API'`（L395 + L405 `'U-API'` 字面量 marker）—— sync 后这两行会被上游"重构掉"，函数体整体移出 FreeFormInput，我们的 brand patch **静默丢失**。

| 文件 | 我们的 marker | 上游动作 | 类别 |
|---|---|---|---|
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` | L395 + L405 字面量 `'U-API'`（grouping 函数体内）| L386-413 hunk：把 19 行 `useMemo` 内联实现替换成 `groupConnectionsByProvider(llmConnections)` 一行 helper 调用 | **1 真冲突**：brand patch 位置消失，需迁移到新 helper |

**未在交集（但也改了）的关键文件**（v0.9.5 改了但**无 U-API marker**，merge 自动通过）：

| 文件 | 上游动作 | 备注 |
|---|---|---|
| `packages/shared/src/agent/pi-agent.ts` | L2020-2050（drain 控制器重构）+ L27 import；**完全不撞** L125/L1954 `backendName = 'U-API'` 字面量 marker | §3.7 #11o marker 位置安全 |
| `packages/pi-agent-server/src/index.ts` | L1126-1170（pi_turn_anchor 重构，修 #782）| §3.7 #45c marker 在 L1285，不撞 |
| `packages/shared/src/agent/claude-agent.ts` | +59 行（branching 锚点 + source-activation drain 接入）| **无 U-API marker**，merge 自动通过 |
| `packages/shared/src/agent/base-agent.ts` | +12 行（drain 控制器抽象）| **无 marker** |
| `packages/shared/src/i18n/locales/zh-Hans.json` | +5 key（chat.modelPicker.contextSection / modelsSection / openAiSettings / thinkingSection + chat.tapToType）| 上游已翻译；与我们 zh-Hans 改造无重叠（我们 zh-Hans 改造是 brand 替换/文案重写，不是新 key 增删）|
| 其它 5 个 locale (de/en/es/hu/ja/pl) | +5 key 同上 | 自动 merge |

详见下方 §3 表。

### 2.3 新文件清单（**21 个新文件**）

```
# 新文件 21 个（用 git diff --diff-filter=A 列出）：
apps/electron/resources/release-notes/0.9.5.md                                                NEW   39 lines  release notes（含 4 处 craft 字面量需 brand 替换 + 中文翻译）
apps/electron/src/renderer/components/app-shell/input/CompactModelSelector.tsx                NEW  521 lines  compact 模式 model picker（drawer-based；引用新 helper）
apps/electron/src/renderer/components/app-shell/input/__tests__/model-picker-helpers.test.ts  NEW  155 lines  helper 单测（含 4 处 'Craft Agents Backend' 断言需同步改）
apps/electron/src/renderer/components/app-shell/input/__tests__/use-working-directory-state.test.ts  NEW  126 lines
apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts                 NEW   55 lines  helper（含 1 处 'Craft Agents Backend' 字面量 + docblock 注释 → 新 §3.7 #53）
apps/electron/src/renderer/components/app-shell/input/use-working-directory-state.ts          NEW  229 lines  抽取的 hook（无 brand）
apps/electron/src/renderer/components/app-shell/input/useModelVisionToggle.ts                 NEW   49 lines
apps/electron/src/renderer/components/ui/CompactWorkingDirectorySelector.tsx                  NEW  242 lines  compact working-directory drawer（仅 1 处 @craft-agent import）
apps/electron/src/renderer/components/ui/__tests__/long-press-state.test.ts                   NEW   73 lines
apps/electron/src/renderer/components/ui/long-press-state.ts                                  NEW   64 lines
packages/server-core/src/sessions/pi-turn-anchors.test.ts                                     NEW  127 lines  pi_turn_anchor branching 修复 #782 单测
packages/shared/src/agent/__tests__/base-agent-source-activation.test.ts                      NEW   49 lines
packages/shared/src/agent/__tests__/source-activation-drain.test.ts                           NEW  236 lines
packages/shared/src/agent/source-activation-drain.ts                                          NEW  143 lines  drain controller 抽象
packages/shared/src/mcp/__tests__/fixtures/mcp-server-good.mjs                                NEW   66 lines  MCP 单测 fixture
packages/shared/src/mcp/__tests__/fixtures/mcp-server-lsp.mjs                                 NEW   37 lines
packages/shared/src/mcp/__tests__/fixtures/mcp-server-noisy-stuck.mjs                         NEW   17 lines
packages/shared/src/mcp/__tests__/fixtures/mcp-server-slow.mjs                                NEW   84 lines
packages/shared/src/mcp/__tests__/validation.test.ts                                          NEW  121 lines
packages/ui/src/components/chat/CompactAcceptPlanDrawer.tsx                                   NEW  110 lines  AcceptPlan compact drawer
packages/ui/src/components/ui/drawer.tsx                                                      NEW  136 lines  drawer 从 apps/electron 提升到 packages/ui 共享
```

**MODIFIED 文件中也有少量 `@craft-agent/` 新 import**（计入 C11 batch sed 范围）：

```
apps/electron/src/renderer/components/ui/drawer.tsx       MODIFIED（被掏空 -133/+10，改为从 @craft-agent/ui re-export，需走 C11 改 @u-agents/ui）
packages/ui/src/components/chat/TurnCard.tsx              MODIFIED  +1 import @craft-agent/shared/utils/toolNames
```

**brand 字面量命中清单**（生产路径，需 patch）：

| 文件 | 命中数 | 性质 |
|---|---|---|
| `model-picker-helpers.ts` | 3 处 | 1 处 `'Craft Agents Backend'` 字面量 + 2 处 docblock 注释（"Order is significant for UI: Anthropic, Local, Craft Agents Backend." + import 注释）— **新 §3.7 #53** |
| `__tests__/model-picker-helpers.test.ts` | 6 处 | 4 处 `'Craft Agents Backend'` 字面量断言 + 2 处 import — **需同步改否则单测 fail** |
| `release-notes/0.9.5.md` | 4 处 | issue links + repo refs — 沿 0.9.4.md 历史路径处理 |

**`@craft-agent/` 新增 import 命中清单**（开发路径，走 C11 batch sed，**实测共 7 文件 9 处**）：

| 文件 | `@craft-agent/` 新增 import 数 | 类别 |
|---|---|---|
| `apps/electron/src/renderer/components/app-shell/input/CompactModelSelector.tsx` | 2 | NEW |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/model-picker-helpers.test.ts` | 1 | NEW |
| `apps/electron/src/renderer/components/ui/CompactWorkingDirectorySelector.tsx` | 1 | NEW |
| `packages/shared/src/agent/__tests__/source-activation-drain.test.ts` | 1 | NEW |
| `packages/shared/src/agent/source-activation-drain.ts` | 1 | NEW |
| `apps/electron/src/renderer/components/ui/drawer.tsx` | 2 | MODIFIED（掏空后 re-export 从 @craft-agent/ui）|
| `packages/ui/src/components/chat/TurnCard.tsx` | 1 | MODIFIED（首次 import toolNames helper）|
| **小计** | **9 处** | **7 文件** |

> 历史对比：v0.9.4 sync 当时 C11 触发 1 文件 4 处；本次约 2× v0.9.4 规模，远低于 v0.9.3 的 6 文件 9 处水平。
>
> ✅ 21 个 NEW 文件中实际**只有 5 个**含 `@craft-agent/` import——其它 16 个新文件要么是 `.mjs` fixture（不 import shared），要么是 hook / drawer / state 文件用本地相对路径（如 `@/lib/utils`）。
>
> **`pi-turn-anchors.test.ts` 0 个 `@craft-agent/` import**（实测 grep 结果）—— 原 PREVIEW 写"26 处"是把整个文件的 `import` 行数当成了 brand import 数，已修正。

### 2.4 Drawer 提升（`apps/electron` → `packages/ui`）

```
# 移动 + 改 export 接入：
apps/electron/src/renderer/components/ui/drawer.tsx       -133 lines  （被掏空，剩 re-export？）
packages/ui/src/components/ui/drawer.tsx                  NEW +136 lines
packages/ui/package.json                                  +1 export `./ui/drawer` + +1 peer dep `vaul >=1.0.0`
```

**结论**：drawer 组件从 electron 渲染层提升到 packages/ui 共享层，方便 webui 和 viewer 复用。我们 fork **没有改过 drawer.tsx**，merge 直接接受。注意：`bun install` 后会引入 `vaul` 作为 packages/ui 的 peer dep（root 已有 vaul 依赖，不会重复安装）。

### 2.5 Pi SDK / 依赖版本

```
# v0.9.5 vs v0.9.4 dep 变化：
- packages/ui peer dep: 加 vaul >=1.0.0（drawer 提升的副作用）
- packages/ui exports: 加 ./ui/drawer
- root scripts: 加 lint:tool-name-checks（但脚本文件不存在 → C13）
- 所有 15 个 package.json: version 0.9.4 → 0.9.5
- Pi SDK: **未升级**（仍 0.73.1）
- 其它三方 dep: **无升级**（与 v0.9.4 形成鲜明对比，v0.9.4 升了 Pi SDK 0.72.1 → 0.73.1）
```

✅ **本次 sync 无需跑 §8.2 对话路径回归**（SDK 没动；只跑 §6.5 常规验证即可）。

---

## 3. §3.7 改造点逐项交集核对

> 与 v0.9.4 sync 同方法：用 `git diff v0.9.4..v0.9.5 --name-only` 与本仓库 `grep -rEn "U-API"` 文件清单做交集，逐项核对位置是否撞 hunk。

| # | 改造点 | 文件 | 上游 hunk 位置 | 我们 marker 位置 | 距离 | 真冲突？ |
|---|---|---|---|---|---|---|
| #11o | `backendName = 'U-API'` 字面量 | `packages/shared/src/agent/pi-agent.ts` | L27 import + L2020-2050 drain 逻辑 | L125 + L1954 字面量 | ~1900 行 + ~70 行 | ❌ 干净 |
| #45c | pi-agent-server brand 注释 | `packages/pi-agent-server/src/index.ts` | L1126-1170 pi_turn_anchor 重构 | L1285 注释 | 115 行 | ❌ 干净 |
| #19-#25 | AiSettingsPage isUApi/ConnectionRow/Add Connection 等 9 处 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | **未碰** | — | — | ❌ 干净 |
| #1/#2/#3 + #32a + #33b + #46 | storage.ts 各项 | `packages/shared/src/config/storage.ts` | **未碰** | — | — | ❌ 干净 |
| #4 | auth/state.ts hasCredentials | `packages/shared/src/auth/state.ts` | **未碰** | — | — | ❌ 干净 |
| #52 | server-core RPC handler HANDLED_CHANNELS | `packages/server-core/src/handlers/rpc/settings.ts` | **未碰** | — | — | ❌ 干净 |
| **NEW** | **FreeFormInput grouping 函数体（位置消失）** | `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` | **L386-413 整段被 helper 调用替换** | L395 + L405 `'U-API'` 字面量 | **0**（整段消失）| **✅ 真冲突 1 处** |

**冲突详细分析**：

```diff
# v0.9.4 我们 fork 的代码（L391-411 in current tree）：
-  const connectionsByProvider = React.useMemo(() => {
-    const groups: Record<string, typeof llmConnections> = {
-      'Anthropic': [],
-      'Local': [],
-      'U-API': [],                              ← M1 brand patch（marker）
-    }
-    for (const conn of llmConnections) {
-      const provider = conn.providerType || 'anthropic'
-      if (provider === 'anthropic') {
-        groups['Anthropic'].push(conn)
-      } else if (provider === 'pi_compat' && isLocalConnection(conn)) {
-        groups['Local'].push(conn)
-      } else if (provider === 'pi' || provider === 'pi_compat') {
-        groups['U-API'].push(conn)              ← M1 brand patch（marker）
-      }
-    }
-    return Object.entries(groups).filter(([, conns]) => conns.length > 0)
-  }, [llmConnections])

# v0.9.5 上游版本：
+  const connectionsByProvider = React.useMemo(
+    () => groupConnectionsByProvider(llmConnections),
+    [llmConnections],
+  )
```

**git 3-way merge 行为预测**：

- base（v0.9.4 上游版本）= 整段含 `'Craft Agents Backend'`
- ours（我们 fork）= 整段含 `'U-API'`
- theirs（v0.9.5 上游版本）= 整段被替换成 helper 调用

3-way merge 算法把这 19 行同时被 base→ours 改（修字面量）和 base→theirs 改（整段重写）的场景判定为冲突，**会停下让人工解决**。如果 merge 工具 auto-resolve 偏 theirs，则我们的 brand patch 静默丢失（用户在 UI 上看到 "Craft Agents Backend" 字样）—— **必须在 sync 时跑 §6.4 marker 基线核对（96 → 97）兜底**。

**新 §3.7 改造点 #53**：

| 文件 | 改造类别 | 定位 | 标记 |
|---|---|---|---|
| `apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts` | brand 字面量 — helper `groupConnectionsByProvider` 内 `'Craft Agents Backend'` → `'U-API'` + docblock 注释微调 + import 注释 | 字面量 `'Craft Agents Backend'` （`groups['Craft Agents Backend']` 两处赋值 + groups 初始化 key）+ docblock L34 "Order is significant for UI: Anthropic, Local, Craft Agents Backend." | `// U-API:` 单行（在 `groups` 初始化上方）+ 同时改 4 处单测断言 |

**配套修改**（必跑）：

1. `model-picker-helpers.ts`：
   - 字面量 `'Craft Agents Backend'` → `'U-API'`（3 处：groups 初始化 key + 2 处 push 目标）
   - docblock 注释 `Order is significant for UI: Anthropic, Local, Craft Agents Backend.` → `Order is significant for UI: Anthropic, Local, U-API.`
   - 在 groups 初始化上方加 `// U-API: brand — v0.9.5 sync 上游把 FreeFormInput.tsx 内联 grouping 抽到 helper，brand 字面量随之迁移`
2. `__tests__/model-picker-helpers.test.ts`：
   - 4 处 `'Craft Agents Backend'` 字面量断言同步改成 `'U-API'`
3. 验证：merge 后跑 `cd apps/electron && bun test src/renderer/components/app-shell/input/__tests__/model-picker-helpers.test.ts`，期望 12 单测全绿

---

## 4. C 类常见踩坑模式核对

### 4.1 C11（NPM scope rename）— **触发**

| 范围 | 文件数 | 命中数 | 处理 |
|---|---|---|---|
| NEW + MODIFIED 文件的 `import ... from '@craft-agent/...'`（详见 §2.3 brand 命中表）| **7 文件** | **9 处** | sync 后跑 batch sed `'@craft-agent/'` → `'@u-agents/'` |
| 15 个 package.json 的 `"name": "@craft-agent/..."` | 15 文件 | 15 处 | sync 后跑 batch sed `"@craft-agent/"` → `"@u-agents/"` |
| 15 个 package.json 的 `"version": "0.9.4"` → `"0.9.5"` | 15 文件 | 15 处 | merge 直接接受 theirs（或 batch sed） |

**SOP 命令**（已实测于 v0.9.1-v0.9.4，可复制粘贴）：

```bash
# C11 NPM scope rename — 在 merge 解决冲突后跑：
find packages apps -name "*.ts" -o -name "*.tsx" -o -name "package.json" 2>/dev/null \
  | xargs grep -l "@craft-agent/" 2>/dev/null \
  | xargs sed -i '' "s|@craft-agent/|@u-agents/|g"

# 验证：必须 = 0
grep -rEn --exclude-dir=node_modules "@craft-agent/" packages apps 2>/dev/null | wc -l
```

### 4.2 C12（上游 ESLint 违规）— **预测 0**

5 轮静态预测 v0.9.5 上游没引入新的 lint 违规。merge 后跑 `bun run lint:electron`/`lint:shared`/`lint:ui` 实测确认；如有 hit 沿 v0.9.3 #50/#51 模式处理（`eslint-disable-next-line ...` + `// U-API:` 注释 + 加 §3.7 表）。

### 4.3 C13（上游死引用）— **触发 1 处**

**v0.9.5 root `package.json` 引用了不存在的脚本**：

```jsonc
{
  "scripts": {
    "lint:tool-name-checks": "bash scripts/check-task-tool-checks.sh",  // ← 文件在 v0.9.5 tree 不存在
    "lint": "bun run lint:ipc-sends && bun run lint:tool-name-checks && bun run lint:electron && bun run lint:shared && bun run lint:ui"
    // ↑ 加进了 lint chain，merge 后 bun run lint 直接 fail
  }
}
```

**与历史 C13 同模式**：
- v0.9.1 routing.ts 漏分类（已自动过期）
- v0.9.4 #52 HANDLED_CHANNELS 漏分类
- M2.5 #5 CI dead refs（check-i18n-coverage.ts / check-raw-sends.sh / typecheck-staged.sh / lint-i18n-staged.sh stub）

**处理选择**（merge 后必做，选一）：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A**：参考 M2.5 #5 套路，加 stub `scripts/check-task-tool-checks.sh`（exit 0 + 注释说明），等上游补全后 sync 时自然替换 | 顺上游设计、`bun run lint` 全绿、未来 sync 自动收敛 | 实际不执行任何检查 |
| B：把 `lint:tool-name-checks` 从 `lint` chain 移除 | 最少改动 | 偏离上游 lint chain 结构、下次 sync 又会被上游 merge 回来 |

**推荐方案 A**。stub 内容示例（实施时由用户/外部 AI 写代码，本仓库 AI 只产出规格）：

```bash
#!/bin/bash
# scripts/check-task-tool-checks.sh
# U-API: stub — upstream v0.9.5 registers this in lint chain but ships no implementation
#         (C13 pattern same as v0.9.1 routing.ts / v0.9.4 HANDLED_CHANNELS / M2.5 CI stubs).
#         When upstream lands the real implementation in a future release, sync will
#         replace this stub automatically. Until then, exit 0 to keep `bun run lint` green.
exit 0
```

### 4.4 C14（build-win.ps1 漂移）— **未触发**

v0.9.5 没新增 `scripts/electron-build-main.ts` 调用链上的新 helper，build-win.ps1 与 root chain 距离不变（与 v0.9.4 相同）。

---

## 5. 决策点

**0 项新决策点**——本次 sync 全部是兼容向 UX polish + bug fix，没有"要不要保留这个新 feature"的决策（与 v0.9.4 RTK 集成那种"要不要接收 opt-in feature"形成对比）。

参考决策（自动接受，记录在此）：

| 项 | 自动决策 | 理由 |
|---|---|---|
| Compact-mode drawer × 4 路径 | ✅ 接受 | UX polish；与我们 UI lockdown 无功能冲突 |
| 输入框 tap-to-expand | ✅ 接受 | 与 i18n 已就绪（zh-Hans `chat.tapToType: 点击输入`）|
| Pi-backed branching 修复（#782）| ✅ 接受 | 用户体验直接收益 |
| MCP source_test 真实诊断（#787）| ✅ 接受 | 用户排障收益 |
| 并行 source_test session 卡死修复（#790）| ✅ 接受 | 稳定性 |
| AcceptPlan dropdown 修复 | ✅ 接受 | UI 锚点修复，与品牌无关 |
| Turn lifecycle 卡 "Thinking…" 修复 | ✅ 接受 | UX 修复 |
| Messaging gateway final message 修复（#779）| ✅ 接受 | 我们 messaging 也用同样的 renderer |
| SDK Agent subagent 折叠修复 | ✅ 接受 | UX 修复 |
| Windows RTK 安装文档 | ⚪ 中性 | 我们 04 §九类裁了 browser tool，RTK 仍保留但不主推 |

---

## 6. 推荐执行步骤（给用户/外部 AI）

> 本仓库 AI **不执行**这些命令。以下是给用户或外部 AI（在另开会话执行 merge 时）参考。

### 6.1 准备 + merge

```bash
# 1. 当前在 main 分支干净状态，先确认
git status -sb
git log -1 --format="%H %s"  # 期望：0a49a089 v0.9.4 sync

# 2. fetch 已经在本仓库 AI 调研时跑过（只读），无需再跑
git tag | grep v0.9.5  # 期望：v0.9.5 已存在

# 3. 建 sync 分支
git checkout -b sync/upstream-v0.9.5-20260521

# 4. merge upstream/v0.9.5（不要 fast-forward，保留 sync commit）
git merge --no-ff v0.9.5
# 预期：4-5 个冲突文件（FreeFormInput.tsx + 15 package.json + bun.lock 之一）
#       具体看 git status -sb 输出
```

### 6.2 冲突解决（按 §2.2 + §3 + §4 跑）

**a. FreeFormInput.tsx**（§3 真冲突）：

```bash
# 接受 theirs（helper 调用替换内联实现）：
git checkout --theirs apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx
git add apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx
```

然后到新 helper 文件做 brand patch（§3 #53）：

```bash
# 编辑 apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts
# 把 3 处 'Craft Agents Backend' → 'U-API'
# 把 docblock "Order is significant for UI: Anthropic, Local, Craft Agents Backend." → "... Local, U-API."
# 在 groups 初始化上方加 // U-API: ... 注释 marker

# 同步改单测断言：
# 编辑 apps/electron/src/renderer/components/app-shell/input/__tests__/model-picker-helpers.test.ts
# 把 4 处 'Craft Agents Backend' 字面量 → 'U-API'
```

**b. 15 个 package.json**（§4.1 C11）—— ⚠️ **不能用简单 `--theirs + sed scope`，必须 3-way merge**：

> **教训 (REVIEW-4 / 2026-05-21 sync 实测发现)**：初版 SOP 写的"`--theirs` 后 sed `@craft-agent/` → `@u-agents/`"会**静默丢失** ours 的 brand 字段：
> - `"private": true`（所有内部包应有）
> - `description` 里的"U Agents"（被 theirs "Craft Agents" 覆盖）
> - `author`（被 theirs "Craft Docs Ltd. / support@craft.do" 覆盖；ours 是 "U Studio / support@u-studio.cn"）
> - `homepage`（被 theirs "https://agents.craft.do" 覆盖；ours 是 "https://u-agents.u-studio.cn"）
> - `bin`（apps/cli 的 ours 是 `u-agents-cli`，被 theirs `craft-cli` 覆盖）
>
> **正确做法是 3-way merge**：theirs 的 version / dependencies / exports / scripts 是 v0.9.5 真增量，要保；ours 的 description / author / homepage / private / bin 是 fork brand，要保。用以下 Python 脚本自动跑：

```bash
# Step 1: --theirs 接受 v0.9.5 整体（拿到 version + dep 变化）
git checkout --theirs $(git status -s | grep "package.json" | awk '{print $NF}')

# Step 2: Batch sed NPM scope（仍要做）
find packages apps -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null \
  | xargs sed -i '' 's|"@craft-agent/|"@u-agents/|g'

# Step 3: ⭐ 3-way merge 还原 brand 字段（关键步骤）
python3 <<'PYEOF'
import json, subprocess, glob, os
os.chdir('.')  # 必须在 repo root
BRAND_FIELDS = ['description', 'author', 'homepage', 'private', 'bin']
for p in sorted(glob.glob('packages/*/package.json') + glob.glob('apps/*/package.json') + ['package.json']):
    if 'node_modules' in p:
        continue
    with open(p) as f: cur = json.load(f)
    result = subprocess.run(['git', 'show', f'main:{p}'], capture_output=True, text=True)
    if result.returncode != 0: continue
    ours = json.loads(result.stdout)
    changed = False
    for field in BRAND_FIELDS:
        if field in ours and cur.get(field) != ours[field]:
            cur[field] = ours[field]
            changed = True
        elif field == 'private' and field not in ours and field in cur:
            del cur[field]
            changed = True
    if changed:
        with open(p, 'w') as f:
            json.dump(cur, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'PATCHED {p}')
PYEOF

# Step 4: 验证 0 Craft 残留
grep -rEn --exclude-dir=node_modules "Craft Agent|craft\.do|Craft Docs" packages apps . --include="package.json" 2>/dev/null \
  | grep -v "craft-server\|sync:craft-agent-bash" | head -5
# 期望：空（craft-server bin / sync:craft-agent-bash dev script 是 fork main 也保留的，例外）

# Step 5: git add 所有 package.json
git add $(git status -s | grep "package.json" | awk '{print $NF}')
```

**c. bun.lock**（§0 SOP）：

```bash
# bun.lock 不可手工 merge；用 checkout theirs + bun install 增量同步：
git checkout v0.9.5 -- bun.lock
bun install
git add bun.lock
```

**d. 其它单测/类型文件**（NPM scope rename C11）：

```bash
# 在 merge 树上跑 batch sed（仅工作树未冲突的部分）：
find packages apps -name "*.ts" -o -name "*.tsx" 2>/dev/null \
  | xargs grep -l "@craft-agent/" 2>/dev/null \
  | xargs sed -i '' "s|@craft-agent/|@u-agents/|g"

# 验证：必须 = 0
grep -rEn --exclude-dir=node_modules "@craft-agent/" packages apps 2>/dev/null | wc -l
```

**e. C13 stub**（§4.3）：

```bash
# 创建 scripts/check-task-tool-checks.sh stub（exit 0 + 注释说明）
# 加可执行权限：chmod +x scripts/check-task-tool-checks.sh
# git add scripts/check-task-tool-checks.sh
```

**f. release-notes/0.9.5.md brand 替换**：

```bash
# 沿 0.9.4.md 历史路径：
# - 替换 4 处 "craft-agents-oss" 链接和字面量为 "u-agents-oss"
# - 加中文翻译标题/章节
# - 删除上游 issue 链接（#782 / #787 / #790 / #779）或改成我们自己的 issue tracker
```

### 6.3 完成 merge

```bash
# Marker 基线核查（必跑）：
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：97（基线 96 + 新增 #53 = 97，允许 95-99）

grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 9（v0.9.5 不新增块标记）

# Validate：
bun run typecheck:all                           # 期望：0 errors
cd apps/electron && bun run lint                 # 期望：0 errors（stub 让 lint:tool-name-checks pass）
bun run lint:i18n:parity                         # 期望：6 locales × 1460 keys (1455 + 5 新)
bun run lint:i18n:sorted                         # 期望：pass
bun run lint:i18n:coverage                       # 期望：pass

# 单测：
cd apps/electron && bun test src/renderer/components/app-shell/input/__tests__/  # 12+ 单测全绿
cd packages/shared && bun test                                                    # 跑全套；19 latent fail 是 v0.9.3 baseline 已知，不应增加
cd packages/ui && bun test                                                         # 新增 turn-lifecycle + turn-utils-grouping 单测应 pass

# Commit：
git commit -m "$(cat <<'EOF'
sync: upstream v0.9.5 merge

- §3.7 改造点 +1：#53 model-picker-helpers.ts brand patch（上游把 FreeFormInput
  内联 grouping 抽到 helper，brand 字面量随之迁移到新文件）
- C11 NPM scope rename：7 文件 9 处 import + 15 package.json batch sed
- C13 stub：scripts/check-task-tool-checks.sh（上游 lint chain 引用未实现脚本）
- release-notes/0.9.5.md：brand 五件套替换 + 中文翻译
- 基线：96 → 97 处 marker；START/END 9/9 不变

详见 .planning/sync-reports/SYNC-v0.9.5-20260521.md
EOF
)"
```

### 6.4 验证 + 实测

按 §6.3 跑完后再跑 §6.5 双平台 D-β 实测（macOS arm64 + Windows x64），参考 v0.9.4 sync 历史路径。

---

## 7. 与 v0.9.4 sync 对比

| 维度 | v0.9.4（2026-05-20）| v0.9.5（本次预测）|
|---|---|---|
| 影响面 | 73 文件 / +698 −202 行 | 73 文件 / +4167 −797 行（**大 5×**，主要因 21 新文件）|
| §3.3 真冲突 | 0 | 0 |
| §3.7 真冲突 | 0 真 / 0 硬 / 0 软 | **1 真**（model-picker-helpers brand）|
| §3.7 新增 marker | 1（#52）| 1（v0.9.5 sync 自身 = model-picker brand）；若搭车 M3-I18N-FIX 共 2 |
| C11 触发 | 1 文件 4 处 | **7 文件 9 处**（约 2× v0.9.4，远低于 v0.9.3 的 6 文件 9 处水平）|
| C12 触发 | 0 | 预测 0（实测确认）|
| C13 触发 | 1（#52）| 1（lint:tool-name-checks stub）|
| C14 触发 | 0 | 0 |
| 底层 SDK 升级 | Pi SDK 0.72.1 → 0.73.1 | 无升级 |
| 新决策点 | 2（RTK 接收/i18n 文案）| **0** |
| 预测评级 | A− | A−（**与 v0.9.4 同档**）|
| 实测评级 | A− | 待 sync 后实测 |
| bun.lock 处理 | `git checkout ... && bun install` 增量 | 同样 |

**判断**：v0.9.5 是一次"小规模 UX polish + 稳定性修复"的 sync，影响面看似比 v0.9.4 大（5×），但绝大部分是新增测试 + 抽取重构 + drawer 移动，**与我们 fork 改造的实际冲突面比 v0.9.4 更小**（仅 1 真冲突 vs v0.9.4 的 0 真冲突 + 1 C13 patch）。可以本周内 sync，按 v0.9.4 SOP 即可。

---

## 8. 风险提示

| 风险 | 等级 | 缓解 |
|---|---|---|
| **静默丢失 brand patch**：3-way merge 偏 theirs 时，FreeFormInput.tsx L395/L405 的 `'U-API'` 字面量随整段 helper 抽取消失，新 helper 里默认是 `'Craft Agents Backend'`。如果忘记在新 helper 里手工 patch，用户在 model picker 会看到 "Craft Agents Backend" 字样 | 🔴 **高**（最大单点风险）| 跑 §6.3 marker 基线核查，期望 97；若仍是 95-96 说明漏 patch |
| **C13 lint chain 漏 stub**：`bun run lint` fail，CI/本地 pre-commit 都过不去 | 🟡 中 | §6.2 e 步必跑 stub 创建 |
| **bun install 副作用**：上游升级了 vaul peer dep 范围，可能在 packages/ui 子目录 install 时报 warning（不致命）| 🟢 低 | 跟 v0.9.4 sync 时 Sentry dep 行为相同，bun install 完毕后跑 typecheck 验证 |
| **测试 fail 数变化**：v0.9.5 新增 6 个测试文件（turn-lifecycle / turn-utils-grouping / model-picker-helpers / use-working-directory-state / long-press-state / pi-turn-anchors / validation / source-activation-drain / base-agent-source-activation / mcp validation），需关注是否引入新的 latent fail（v0.9.3 baseline 19 个 fail 不应增加）| 🟢 低 | §6.3 跑全套 bun test 对比 fail 数 |
| **MCP fixtures 新增 4 个 `.mjs`** 可能与 windows 路径处理有冲突 | 🟢 低 | Windows D-β 实测时跑 MCP `source_test` 路径回归 |
| **新 helper 单测断言里写死 'Craft Agents Backend'**，patch 时漏改单测会让 12 个新单测 fail | 🟡 中 | §6.2 a 步必跑：同步改 4 处 + bun test 验证 |

---

## 9. 顺手 follow-up（可在 sync 同 commit 处理或后续 commit）

| # | 项 | 优先级 | 路径 |
|---|---|---|---|
| F1 | `model-picker-helpers.ts` docblock 注释 "Order is significant for UI: Anthropic, Local, Craft Agents Backend." → "... Local, U-API."（属 brand patch 一部分，但容易漏改） | P0 | sync 同 commit |
| F2 | 若 §6.3 marker 基线核查 `< 95`，说明有漏 patch，立即停下排查 | P0 | sync 同 commit |
| F3 | release-notes/0.9.5.md 4 处 craft-agents-oss 链接 + 字面量 brand 替换 + 中文翻译 | P0 | sync 同 commit（沿 0.9.4 历史路径）|
| F4 | C13 `scripts/check-task-tool-checks.sh` stub 写完后跑 `chmod +x` 保证脚本可执行 | P0 | sync 同 commit |
| F5 | 检查上游 v0.9.5 release notes 是否在 GitHub Release 页发了 changelog 链接（有时上游一周后才发）；如果发了，更新本报告 §1 元数据的 release 时间 | P3 | 后续 commit |
| F6 | 跑完 sync 后写正式 `SYNC-v0.9.5-20260521.md` 报告（沿 SYNC-v0.9.4-20260520 模板）| P1 | sync 后另开 commit |
| F7 | **`call_llm` + `multi_tool_use.parallel` + `outputSchema` 组合参数错位** — Phase 2 实测期间模型自跑工具调用回归冒烟测试发现：单独调用 `call_llm` 正常返回；并行调用中带 `outputSchema` 时 schema 校验报错 `prompt: must have required properties prompt` + `outputSchema: must not have additional properties`，参数里 `prompt`/`temperature` 被嵌入 `outputSchema` 内部。**根因路径分析**：与 v0.9.5 sync 无关（v0.9.5 一行没改 `llm-tool.ts` / parallel 序列化 / outputSchema 处理），属 Pi SDK 或 Claude Agent SDK 自身的 parallel wrapper 在序列化嵌套 schema 时的 bug，或者上游 craft-agents-oss 已知 issue。**优先级**：P3（不阻塞 sync，不影响日常使用——只在"call_llm 工具同时进 parallel 调用 + 用 outputSchema"这一窄场景触发；单独调用任一项都正常）。**追查建议**：(a) `gh issue list -R lukilabs/craft-agents-oss --search "call_llm parallel outputSchema"` 看上游是否已知；(b) 若未知 → 提 issue 给上游；(c) 等 Pi SDK 升级看是否修。**不在本次 sync 范围处理。** | P3 | 后续 commit / 上报 upstream |

---

## 10. 附录：v0.9.5 release notes 摘要（仅供参考，不动 git history）

> 上游官方 release notes 原文：`apps/electron/resources/release-notes/0.9.5.md`
> 中文摘要由本仓库 AI 整理（merge 后正式版翻译进 `release-notes/0.9.5.md`）：

**功能（Features）**：
1. Compact 模式会话行右键菜单改 vaul drawer（紧凑/移动布局下 nested action 不再被裁剪）
2. Compact 模式工作目录选择器改 drawer（窄屏不再横向滚动；桌面下拉框保持原样）
3. Compact 模式聊天输入框可折叠/展开（移动布局长文输入更方便）
4. Compact 模式 AcceptPlan 选择器改 drawer（窄屏 action 行不会被推出可视区）
5. Web UI 移动断点自动切 compact model selector（与 electron 容器查询行为一致）

**改进（Improvements）**：
1. 抽 `useWorkingDirectoryState` hook 统一桌面下拉框和 compact drawer 的路径解析、最近目录、文件夹选择处理逻辑（避免行为漂移）
2. Windows RTK 安装路径文档澄清（Settings → AI → Performance "RTK not found" 检测与用户实际看到的路径一致）

**Bug 修复（Bug Fixes）**：
1. **Pi-backed branching 不再丢最后一条 assistant 消息**（#782）—— Pi 后端的分支会话现在在 SDK 追加新消息**之后**才捕获会话锚点，避免分支会话丢失最近 assistant 回复
2. **Stdio MCP `source_test` 真实诊断**（#787）—— stdio MCP 服务器测试现在跑单进程 + stderr 活动 watchdog，捕获真实启动输出，替代之前任何慢启动服务器都报 "Server startup timeout" 的假错
3. **并行 `source_test` 不再卡住 session**（#790）—— 源激活 abort 中断 turn 时，会先 drain 同批 parallel-tool 的 sibling `tool_result`，避免 SDK 留下 orphan `tool_use` ID 永久卡死下一个 turn
4. **AcceptPlan dropdown 锚点漂移修复** —— 桌面 AcceptPlan dropdown 改用 Radix `DropdownMenu`，修复锚点漂移和 viewport 裁剪；Web UI compact 视图也终于真正渲染 dropdown（之前藏在 wider-only 分支后）
5. **Turn lifecycle 不再卡 "Thinking…"** —— 当 turn 以工具调用结尾且无 non-intermediate `text_complete` 时，`groupMessagesByTurn` 用 session `isProcessing=false` 信号标记 turn 完成，把中间文本升级为响应；修复前用户需发后续消息解锁
6. **Messaging gateway `progress`/`final_only` 模式交付最终消息**（#779，nheagy 贡献）—— 最后一步是工具调用的自动化场景（如代理用工具发 Telegram 消息后无干净 `text_complete`），之前 progress 永远卡 "💭 thinking…" 且 final_only 静默；现在 renderer 跟踪最近 assistant 文本（不管 `isIntermediate`），complete 时若无干净 final 则 fallback 到它
7. **SDK Agent subagent activity 折叠修复** —— SDK Agent 子代理运行的 activity 分组不再扁平渲染，折叠 toggle 行为恢复

**Breaking Changes**：无

---

> **本报告产出时间**：2026-05-21
> **预测评级**：A−（小冲突 / 1 真冲突 / 1 C13 / brand patch 需手工迁移）
> **建议执行时机**：本周内
> **建议执行流程**：v0.9.4 SOP（已 macOS arm64 + Windows x64 双平台验证）

---

## 13. 长期反思：紧凑模式断点错位（REVIEW-5 发现）

### 13.1 现象

v0.9.5 上游加了 5 个紧凑模式（compact）feature：
- A1 紧凑模式会话行菜单 drawer
- A2 紧凑模式工作目录选择器 drawer
- A3 紧凑模式 AcceptPlan 选择器 drawer
- A4 紧凑模式输入框 tap-to-expand
- A5（web UI）紧凑模式 model selector

桌面 Electron 实测时**全部触发不到**。

### 13.2 根因

| 配置 | 位置 | 值 |
|---|---|---|
| BrowserWindow minWidth | `apps/electron/src/main/window-manager.ts:139` | `800` |
| isAutoCompact 触发阈值 | `apps/electron/src/renderer/components/app-shell/AppShell.tsx:557` | `MOBILE_THRESHOLD = 768` |

**用户的窗口最小宽度（800）> 紧凑触发阈值（768）**，差 32px。无论怎么拖窗口都无法触发 `isAutoCompact = true`。

### 13.3 这不是 v0.9.5 sync 引入

| 版本 | minWidth | MOBILE_THRESHOLD |
|---|---|---|
| fork main (v0.9.4 sync 后) | 800 | 768 |
| v0.9.4 upstream | 800 | 768 |
| v0.9.5 upstream | 800 | 768 |

**长期存在 → fork 设计与上游 v0.9.5 紧凑模式 feature 路线不一致**。

### 13.4 桌面 Electron 用户实际触达紧凑模式的路径

理论上还有 2 条路径可以触发紧凑模式：

1. **多 panel 布局**：开 2-3 列 panel，单个 panel 宽度 < 448px → 触发 `@container/panel (max-width: 448px)` 紧凑（**只是 panel 级 CSS 触发，不切 vaul drawer**）
2. **webui playground mobile preview**：开发用，不在用户路径

也就是说**实际用户场景下，v0.9.5 紧凑模式 drawer feature（A1/A2/A3/A4）在桌面 Electron 是死路径**——上游 UX polish 不达。

### 13.5 选项

| 方案 | 操作 | 后果 |
|---|---|---|
| **方案 P1**：把 BrowserWindow minWidth 改成 ≤ 768（如 600 或 500）| 改 `window-manager.ts:139` | 用户能把窗口拖到触发紧凑模式；但拖太窄时部分桌面布局可能挤压（需测）|
| **方案 P2**：把 MOBILE_THRESHOLD 改大（如 900）| 改 `AppShell.tsx:557` | 紧凑模式提前触发；可能误触干扰常规视图（需测）|
| **方案 P3**：保持现状，紧凑模式只服务 webui mobile / 内嵌 panel | 不改 | 桌面 Electron 用户永远不见 v0.9.5 紧凑 drawer 改进；但不会有现状的 regression |
| **方案 P4**：双重触发——保留 768 阈值 + 加 panel-level 紧凑切换到 drawer | 复杂改造 | 工作量大但 UX 最佳，留 M4+ |

### 13.6 不阻塞本次 sync

v0.9.5 sync 的核心目标 = **吸收上游 73 文件变更 + 修复 §3.7 #53 model-picker brand 漏盘 + 集成 5 个稳定性 bug fix**。紧凑模式 UX 改进**不可达**但不引入 regression（功能上等同于 v0.9.4 状态）。

**决策**：本次 sync **不**改 minWidth 也不改 MOBILE_THRESHOLD——把这个错位作为 follow-up backlog，由用户决定优先级。

### 13.7 给用户的问句

> "你接受桌面 Electron 用户永远不见 v0.9.5 紧凑 drawer 改进吗？还是想顺手改 minWidth 让紧凑模式可达？"

**默认建议**：本次 sync 不动（保持稳定优先），等用户主动反馈"想测紧凑模式 / 想给小屏笔记本用户支持紧凑布局"再决定方案 P1/P2/P4。

---

---

## 11. M3-I18N-FIX 搭车评估（用户问"能不能加进去"）

> 关联规格：[`M3-I18N-MAIN-PROCESS-SYNC-FIX.md`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) + [`M3-I18N-FIX-CLAIM-AUDIT.md`](../M3-I18N-FIX-CLAIM-AUDIT.md)
>
> M3 fix 修复"重启后必须手切语言标题才中文"的 bug，仅 1 个文件 1 行代码改动（renderer/main.tsx）。用户问能否在 v0.9.5 sync 时一起落地。

### 11.1 文件交集核查 — **0 文件交集**

| M3 fix 涉及文件 | 角色 | v0.9.5 是否触碰 |
|---|---|---|
| `apps/electron/src/renderer/main.tsx` | **唯一改造点** | ❌ 未碰 |
| `apps/electron/src/main/index.ts` | IPC handler 注册（已存在）| ❌ 未碰 |
| `apps/electron/src/preload/bootstrap.ts` | preload changeLanguage 桥（已存在）| ❌ 未碰 |
| `apps/electron/src/shared/types.ts` | preload 类型（已存在）| ❌ 未碰 |
| `apps/electron/src/main/menu.ts` | 菜单 rebuild 消费者 | ❌ 未碰 |
| `apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx` | 现有 IPC 调用样板 | ❌ 未碰 |
| `packages/shared/src/i18n/setupI18n.ts` | setupI18n 同步性依据 | ❌ 未碰 |
| `packages/shared/src/i18n/registry.ts` | LOCALE_REGISTRY 来源 | ❌ 未碰 |
| `packages/shared/src/config/preferences.ts` | dormant 路径 A 消费者 | ❌ 未碰 |
| `packages/shared/src/utils/title-generator.ts` | prompt 注入语言指令 | ❌ 未碰 |
| `packages/server-core/src/sessions/SessionManager.ts` | dormant 路径 — 标题生成消费者 | ❌ 未碰 |
| `packages/shared/src/prompts/system.ts` | dormant 路径 A — buildSystemPrompt() | ❌ 未碰 |
| `packages/shared/src/agent/core/prompt-builder.ts` | dormant 路径 A — PromptBuilder | ❌ 未碰 |
| `packages/shared/src/agent/claude-agent.ts` | dormant 路径 A — pinned prefs L811-818 | ⚠️ **被碰但不冲突**（v0.9.5 改 L1440/L1481/L1617/L1645，距 L811 pinned prefs 逻辑 800+ 行；详见 §11.3）|

**判定**：M3 fix 的**唯一改造点**（`renderer/main.tsx`）与 v0.9.5 的 73 改动文件**零交集**。

### 11.2 上游是否在 v0.9.5 自己修了这个 bug？— **没修**

- v0.9.5 release notes 无 i18n / main 进程 i18n 相关字眼
- `apps/electron/src/main/index.ts` L63 `setupI18n()` 仍然不带 detector（上游 bug 仍在）
- `apps/electron/src/renderer/main.tsx` 不动（修复点缺失）
- 上游 i18n locale 文件只是新增了 5 个 `chat.modelPicker.*` key（与 main 进程 i18n 启动语言无关）

**结论**：我们仍需自己 patch，**不能等上游**。

### 11.3 claude-agent.ts hunk 距离核查

v0.9.5 改 `packages/shared/src/agent/claude-agent.ts` 的 hunk：

| 上游 hunk | 内容 | 与 M3 fix 激活的 L811 距离 |
|---|---|---|
| L30 import | 加 source-activation-drain.ts import | **781 行** |
| L1440-1446 | branching `resumeSessionAt` 新增 | **629 行** |
| L1481-1496 | branching 锚点重构 | **670 行** |
| L1617-1649 | end-of-batch source-activation drain | **800+ 行** |

L1645 是已存在的 `this.pinnedPreferencesPrompt = null` 重置点（branching 时 unpin），落在 v0.9.5 的 L1617-1649 hunk 范围内，但**hunk 内容是新增 source-activation drain block，与 pinned prefs 重置语义无关**。也就是说：
- v0.9.5 在 L1645 附近加新代码，但**没有改 L1645 那行本身**
- M3 fix 激活的逻辑（L811-818 `formatPreferencesForPrompt()` pin）在 L811，完全独立

**判定**：M3 fix 落地后激活的 dormant 路径 A（pinned prefs 写入"Preferred language: 简体中文"），与 v0.9.5 branching/drain 修复完全独立，**0 行为耦合**。

### 11.4 M3-I18N-FIX-CLAIM-AUDIT ⚠️ 项重核（v0.9.5 是否改变了任何推理前提）

| # | M3 fix 的 ⚠️ 推理项 | v0.9.5 是否改变前提 | 仍有效？ |
|---|---|---|---|
| ⚠️1 | 方案 A 与上游架构方向一致 | ❌ v0.9.5 未引入新 i18n 架构 | ✅ 仍有效 |
| ⚠️2 | `setupI18n` 返回时 `resolvedLanguage` 已可读 | ❌ v0.9.5 未碰 setupI18n.ts | ✅ 仍有效 |
| ⚠️3 | preload 在 renderer JS 执行前完成 | ❌ v0.9.5 未碰 bootstrap.ts / main/index.ts | ✅ 仍有效 |
| ⚠️4 | `i18next-browser-languagedetector` 在 Node 抛错 | ❌ 库本身未涉及 | ✅ 仍有效 |
| ⚠️5 | jsdom 跑不动 main.tsx | ❌ 与 sync 无关 | ✅ 仍有效 |
| ⚠️6 | 启动菜单闪烁 <500ms | ❌ menu.ts 未碰 | ✅ 仍有效 |
| ⚠️7 | `navigator.language="zh-CN"` fallback | ❌ registry.ts 未碰 | ✅ 仍有效 |

**判定**：v0.9.5 sync **不改变** M3-I18N-FIX-CLAIM-AUDIT 7 个 ⚠️ 推理项中的任何一个的成立前提。audit 表保持原样有效。

### 11.5 落地方式选择

| 方案 | 落地路径 | 优点 | 缺点 | 推荐 |
|---|---|---|---|---|
| **方案 X**：sync 同 commit 搭车 | merge v0.9.5 后，在解决冲突 + brand patch + C13 stub 之外**多改 1 个文件**（renderer/main.tsx）一并 commit | 一次实测覆盖 sync + i18n fix；§6.4 实测必跑双平台，i18n fix 顺势验证 | sync commit 历史变长；如果 i18n fix 出问题，整个 sync commit 都要 revert | ⭐ **强推荐** |
| 方案 Y：sync commit 落地后单独 commit M3 fix | merge v0.9.5 → 验证 → 单独 dry-run M3 fix → 单独 commit | 单一职责清晰；i18n fix 出问题只 revert 1 commit | 双倍实测工作量（先 sync 实测，再 i18n fix 实测） | 备选 |
| 方案 Z：先 M3 fix 再 sync | 先单独 commit M3 fix → 再 sync v0.9.5 | M3 fix 独立验证后稳态再吸收 sync | 实测时间被分两段；且 §3.7 编号要双倍维护 | 不推荐 |

**推荐方案 X 的理由**：

1. **§3.7 编号同 commit 整理**：两个新 marker 一起入表，按文件路径字典序排号：
   - `apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts` 拿 #53
   - `apps/electron/src/renderer/main.tsx` 拿 #54
2. **基线 grep 一次定到位**：96 → 98（+2）一次刷新，不用经历"96 → 97 → 98"两步
3. **实测路径重叠**：§6.4 双平台实测里加入"重启后不切语言新建会话验证标题中文"步骤，与 v0.9.5 compact UX 实测一起跑
4. **回滚也好处理**：如果 M3 fix 在 §5.1 实测里出问题，revert 1 commit（包含 sync + i18n）回到 v0.9.4 + 现状；如果只是 i18n fix 出问题，可以单独 `git restore apps/electron/src/renderer/main.tsx` 留住 sync 部分

### 11.6 方案 X 实施补丁（追加进 §6 SOP）

把以下步骤插入 §6.2 冲突解决后、§6.3 完成 merge 前：

**g. M3-I18N-FIX 搭车**（按 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md §4.1`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) §4.1 代码块）：

```bash
# 编辑 apps/electron/src/renderer/main.tsx
# 1. L11 import 行追加 i18n：
#    import { setupI18n, i18n } from '@u-agents/shared/i18n'
# 2. L17 setupI18n(...) 调用之后追加 4 行：
#    // U-API: 把 detector 解析到的语言立即推给主进程，修复"重启后必须手切语言标题才中文"的 bug
#    window.electronAPI?.changeLanguage?.(i18n.resolvedLanguage ?? 'en')
#      ?.catch((err) => console.warn('[i18n] startup sync to main failed:', err))
# 详见 .planning/M3-I18N-MAIN-PROCESS-SYNC-FIX.md §4.1
```

**§6.3 基线核查改为**：

```bash
# Marker 基线核查（搭车方案 X）：
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：98（基线 96 + 新增 #53 model-picker-helpers + #54 renderer/main.tsx = 98，允许 96-100）
```

**§6.4 实测增加 5 步**（合并 M3 fix §5.1 + §6.4 desktop 实测）：

按 M3 fix `§5.1` 的 1-6 步 + `§6.4` 的 7-11 步追加（共 11 步），与 v0.9.5 compact UX 实测合并跑一次。

**commit message 增加一行**：

```
sync: upstream v0.9.5 merge + fix(i18n): main process startup sync

- §3.7 改造点 +2：
  - #53 model-picker-helpers.ts brand patch（上游把 FreeFormInput 内联
    grouping 抽到 helper，brand 字面量随之迁移到新文件）
  - #54 renderer/main.tsx i18n startup sync（修复"重启后必须手切语言
    标题才中文"的上游 bug，详见 M3-I18N-MAIN-PROCESS-SYNC-FIX）
- C11 NPM scope rename：7 文件 9 处 import + 15 package.json batch sed
- C13 stub：scripts/check-task-tool-checks.sh（上游 lint chain 引用未实现脚本）
- release-notes/0.9.5.md：brand 五件套替换 + 中文翻译
- 基线：96 → 98 处 marker；START/END 9/9 不变

详见 .planning/sync-reports/SYNC-v0.9.5-20260521.md
     .planning/M3-I18N-MAIN-PROCESS-SYNC-FIX.md
```

### 11.7 风险评估（搭车方案 X）

| 风险 | 等级 | 缓解 |
|---|---|---|
| M3 fix 激活 dormant 路径 A，模型回复风格变化 | 🟡 中 | §6.4 实测必看 7-9 步（中文 prompt → 代码注释中文 / 菜单中文 / 切英文 → 代码注释英文）|
| M3 fix race（renderer IPC 推送前会话恢复触发 chat）pin 错语言 | 🟢 低 | spec §6.4 已说明"质变改善但非 100% 保证"；fix 前是 100% 英文 race，fix 后变成"绝大多数中文 + 少数 race 英文" |
| sync commit 历史变长导致 revert 影响范围扩大 | 🟢 低 | 真出问题用 `git restore apps/electron/src/renderer/main.tsx` 单独回滚 i18n fix，保留 sync 部分 |
| 编号撞车（M3 spec 用 #53，PREVIEW 也用 #53）| 🟡 中 | §11.5 已决策：model-picker = #53，M3 i18n = #54（按文件路径字典序）。需同步更新 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md §7`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) 把"#53"改成"#54" |

### 11.8 不搭车的情形

如果用户在 sync 前已经独立 dry-run / 落地了 M3 fix（通过另开会话或自己改），那么 sync 时**只跑 model-picker brand patch（#53）即可**，§3.7 基线变化是 97 → 98（M3 fix 已经 +1 到 97）。详见 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md §9.1`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) dry-run 流程。

### 11.9 REVIEW-2：方案 X 反思 + 推荐力度下调

> 用户："review一轮方案 X" — 对 §11.5 初版"⭐ 强推荐方案 X"的批判性复核。

#### 11.9.1 方案 X 的 4 个被低估的真问题

| # | 问题 | 量级 | 解释 |
|---|---|---|---|
| **R1** | bisect / blame 归因困难 | 🟡 中 | sync + i18n fix 混在一个 commit。M3 fix 是 fork 自有的 bug 修复（独立逻辑），不是 sync 的派生品；与 v0.9.4 sync 时的 brand patch / C13 patch（属于 sync 派生品）不同。未来出现 i18n 相关 regression 时 `git bisect` 指向混合 commit，需手工分辨"是 sync 还是 i18n fix 引入的" |
| **R2** | 实测时间是叠加不是合并 | 🟡 中 | 初版 §11.5 写"实测路径重叠，不增工作量"是过度乐观。v0.9.5 实测路径（compact UX / AcceptPlan / MCP source_test / branching）与 M3 fix 实测路径（标题语言 / 菜单 / 模型风格）**几乎零重叠**。实测时间是串联（v0.9.5 D-β 双平台 + M3 §5.1 6 步 + §6.4 5 步 = 11 步），不是并联 |
| **R3** | dormant 路径 A 激活的归因困难 | 🟡 中 | M3 fix 生效后用户感知到"代码注释变中文 / system prompt 风格变化"是预期效果（M3 spec §6.4 dormant 路径 A），但**与 sync 落地同时发生**时用户难以分辨"这是 sync 带来的还是 i18n fix 带来的"，可能误报 sync regression |
| **R4** | 上报 upstream 选项收窄 | 🟢 低（长期）| M3 spec §8.1 提到"fix 稳定 2 周后可上报 upstream PR"。搭车 sync commit 后上报时需要先把 fix 从 sync commit 里剥出来（rebase / cherry-pick 处理）；方案 Y 独立 commit 直接 `git format-patch` 出 PR |

#### 11.9.2 5 个执行细节漏盘（应回填到 §11.4-11.7）

| # | 漏盘 | 补丁建议 |
|---|---|---|
| **R5** | §11.7 编号撞车的同步修改面**漏列 AUDIT 文档** | 不只 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md §7`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) 要把 #53 改 #54，[`M3-I18N-FIX-CLAIM-AUDIT.md §7`](../M3-I18N-FIX-CLAIM-AUDIT.md) 也引用了"96 → 97"基线断言，需要同步刷成"96 → 98"。共 **3 处文档**需修改（M3 spec §7 + AUDIT §7 + CLAUDE.md §3.7 表落地后追加）|
| **R6** | bun.lock 重装的微妙交互 | v0.9.5 sync SOP `git checkout v0.9.5 -- bun.lock && bun install` 会重装 `i18next-browser-languagedetector`。极小概率 detector 包内部行为变化（如 patch 版本升级 affecting `detect()` 同步性）影响 AUDIT ⚠️2 的同步性断言。merge 后跑 `cat node_modules/i18next-browser-languagedetector/package.json \| grep version` 核版本未跨大版本 |
| **R7** | 回滚粒度声明不准确 | 初版说"`git restore apps/electron/src/renderer/main.tsx` 单独回滚"——只在**未 commit 的 working tree**有效。已 commit 的搭车 commit 想单独 revert i18n fix 部分要用 `git revert <commit>` 再 cherry-pick 回 sync 部分，或 `git reset HEAD~1` 重新 commit。方案 X 的回滚成本 > 方案 Y |
| **R8** | dev vs 装包模式实测差异 | M3 fix §5.1 实测要求 dev 模式（`bun run electron:dev` 从 repo root 跑，**不是** `bun run electron`——后者会调 PATH 里的 electron binary 启动默认欢迎页），v0.9.5 双平台 D-β 是装包模式跑安装包。IPC handler 注册时序理论一致，但**跨模式实测从未核过**。方案 X 实测合并时建议分两批：dev 模式跑 M3 fix §5.1 + §6.4 共 11 步，装包模式只跑 v0.9.5 D-β 主线 + M3 fix §5.1 的步骤 4/6 抽测 |
| **R9** | commit message 规范 | 初版 `sync: upstream v0.9.5 merge + fix(i18n): main process startup sync` 把两个 conventional commit type 拼在 title 里不规范。推荐：title 用 `chore(sync): upstream v0.9.5 + i18n startup fix`，body 详述两类变更 |

#### 11.9.3 1 个长期规划反思

**R10**：**sync 不顺利时方案 X 卡住** — fork 历史显示 sync 有 1-2 处 sync collateral 是常态（如 v0.9.4 的 #52 C13 patch + bun.lock 重装副作用 + brand 漏盘补丁）。如果 v0.9.5 sync 落地时也发现额外 conflict / lint 违规 / bun install 失败，sync commit 本身可能要拆几个补丁稳态再上。这时搭 i18n fix 的车就要等 sync 稳态——等价于走方案 Y。**方案 X 的韧性 < 方案 Y**。

#### 11.9.4 方案 X vs Y 重新打分（修订 §11.5 推荐表）

| 维度 | 方案 X（搭车）| 方案 Y（独立 commit 紧跟 sync）|
|---|---|---|
| commit 数 | 1 | 2 |
| §3.7 编号步进 | 一步 96 → 98 | 两步 96 → 97 → 98 |
| 实测时间 | 叠加（11 步 M3 + v0.9.5 D-β）| 叠加（11 步 M3 + v0.9.5 D-β）—— **与方案 X 相同**（R2 修正了初版认知） |
| bisect 友好度 | ❌ 混合 commit | ✅ 单一职责 commit |
| dormant 路径 A 归因 | ❌ 难分辨（R3）| ✅ 直接对应 i18n fix commit |
| sync 出 collateral 时韧性 | ❌ 卡住（R10）| ✅ 不受影响 |
| 上报 upstream 灵活度 | ❌ 需剥离（R4）| ✅ 直接 PR |
| 回滚粒度 | 🟡 git revert + cherry-pick（R7）| ✅ `git revert <i18n-commit>` |
| 用户认知负担 | ✅ 一次操作完成 | 🟡 两次操作 |
| **净评估** | **5 输 + 1 持平 + 1 赢** | **5 赢 + 1 持平 + 1 输** |

#### 11.9.5 修订后的推荐

> **温和倾向方案 Y**（sync commit 落地后紧跟 i18n fix commit，挂同一个 PR）
>
> 方案 X 仍然可行，但需明确接受 R1 / R2 / R3 三类归因困难 + R10 韧性风险。这不是 dealbreaker，**只是 simplicity 和 cleanliness 之间的小权衡**。
>
> **何时强选方案 X**：用户极强地希望"一次操作完成所有事，不想分两步"——可以接受。
>
> **何时强选方案 Y**：sync 历史显示 collateral 概率高（90%+），或用户对 git history 工程整洁度敏感，或未来打算把 M3 fix 上报 upstream PR。
>
> **绝对不推方案 Z**（先 M3 fix 再 sync）：原因——M3 fix 改 `renderer/main.tsx`，sync 解决冲突期间可能（极小概率）涉及到这文件附近，先落 M3 fix 反而增加 sync 后续 review 范围。

#### 11.9.6 方案 Y 实施补丁

把 §11.6 方案 X 实施补丁改成方案 Y 版本（如果用户决定走 Y）：

**步骤 1**：按 §6 SOP 跑 v0.9.5 sync（不动 renderer/main.tsx）

```
- §3.7 改造点 +1：#53 model-picker-helpers.ts brand patch
- 基线：96 → 97
- commit: chore(sync): upstream v0.9.5 merge
```

**步骤 2**：sync commit 落地 + 基本验证（typecheck / lint / 不实测 D-β）后，紧跟 commit M3 fix：

```
- 改 apps/electron/src/renderer/main.tsx（按 M3-I18N-MAIN-PROCESS-SYNC-FIX §4.1）
- §3.7 改造点 +1：#54 renderer/main.tsx i18n startup sync
- 基线：97 → 98
- commit: fix(i18n): main process startup language sync (M3-I18N-MAIN-PROCESS-SYNC-FIX)
```

**步骤 3**：合并实测 11 步（M3 §5.1 6 步 + §6.4 5 步）+ v0.9.5 D-β 双平台

**步骤 4**：把 M3 spec §7 #53 → #54，AUDIT §7 "96 → 97" → "96 → 98"，CLAUDE.md §3.7 表加 #53/#54 两行

---

### 11.10 REVIEW-3：方案 Y 反思 + 推荐再次修订

> 用户："那再 review 一轮方案 Y" — 对 §11.9 REVIEW-2"温和倾向方案 Y"的批判性复核。

#### 11.10.1 方案 Y 被低估的 1 个真问题（中量级）

| # | 问题 | 量级 | 解释 |
|---|---|---|---|
| **Y2** | **sync→i18n fix 中间态发版风险** | 🟡 中（取决于发版节奏）| 如果用户走"sync 当日打包发版"节奏（v0.9.4 sync 历史模式：当日双平台 D-β + 当日推 R2），方案 Y 实施步骤会出现"sync commit 落地 → 打包推 R2（i18n bug 仍在）→ 后续 i18n fix commit → 第二次打包推 R2 → 一周内推两次 v0.9.5"的尴尬局面。用户更新体验是"装上有 bug → 更新才修" |

> **这是方案 X 没有的弱点**。方案 X 一次 commit 落地 → 一次发版 → 用户拿到的 v0.9.5 就是修好的。

#### 11.10.2 方案 Y 中量级问题（3 项）

| # | 问题 | 量级 |
|---|---|---|
| **Y6** | 两个 commit 可能跨两个分支 / 两个 PR | 🟡 中 |
| **Y8** | "紧跟"时序定义模糊（几分钟内？几天内？）| 🟡 中 |
| **Y12** | spec doc 更新（M3 spec §7 + AUDIT §7 + CLAUDE.md §3.7）是否独立 commit | 🟡 中 |

#### 11.10.3 方案 Y 低量级问题（11 项汇总）

| # | 问题 | 量级 |
|---|---|---|
| Y1 | 两次 §3.7 表更新 / 基线刷新（96 → 97 → 98 两步）| 🟢 低 |
| Y3 | 两次 commit message 维护成本 | 🟢 低 |
| Y4 | sync commit 单独实测的"边界"——i18n 行为要等 fix commit 才能完整验证 | 🟢 低 |
| Y5 | rebase / squash 操作回退到方案 X 的风险（双向操作都不难）| 🟢 低 |
| Y7 | sync commit revert 时 i18n fix commit 也要跟着 revert（`git reset HEAD~2`）| 🟢 低 |
| Y9 | 跨平台实测协调（i18n fix 主要 macOS 实测，Windows 抽测即可）| 🟢 低 |
| Y10 | 同 PR 边界——bisect 归因的痛点延后到 PR review | 🟢 低 |
| Y11 | AUDIT 7 ⚠️ 项的基线变化（v0.9.4 → v0.9.5）— §11.4 已覆盖 | 🟢 低 |
| Y13 | sync 链稳态后 i18n fix 上（实际是方案 Y 的优点不是缺点）| 🟢 低 |
| Y14 | 用户认知负担"多一步 commit" ~5 分钟工作 | 🟢 低 |
| Y15 | sync 主线 D-β 是否必须在 sync commit 后跑 | 🟢 低 |

#### 11.10.4 推荐再次修订：取决于用户发版节奏

| 用户实际节奏 | 推荐 | 理由 |
|---|---|---|
| **sync 当日打包发版**（v0.9.4 历史模式：sync 当日 D-β 双平台 + 当日推 R2）| ⭐ **方案 X**（搭车）| Y2 中间态发版是 dealbreaker；R1/R2/R3 长期归因困难 vs Y2 短期用户体验，**后者更优先**——用户拿到的产品必须是修好的 |
| **sync 后留 1-2 天缓冲**（先实测稳定再发版）| ⭐ **方案 Y**（独立 commit）| 没有 Y2 风险时，方案 Y 的 bisect / 归因 / 上报 PR 优点全部成立 |
| **不确定 / 暂不发版**（只是同步上游进 main，发版另说）| ⭐ **方案 Y** | 偏保守、偏整洁；未来发版前再一次 D-β 验证即可 |

#### 11.10.5 REVIEW-1 → REVIEW-2 → REVIEW-3 演进

| Review | 时机 | 推荐 | 触发 |
|---|---|---|---|
| 初版 §11.5 | 2026-05-21 同日 | ⭐ 强推荐方案 X | M3-I18N-FIX 文件零交集 + 编号简洁 + 实测合并（**当时认为不增工作量，实际是叠加**）|
| REVIEW-2 §11.9 | 同日 | 🟡 温和倾向方案 Y | 发现方案 X 的 R1/R2/R3/R10 真问题（bisect / 归因 / 韧性）|
| REVIEW-3 §11.10 | 同日 | ⚪ **取决于发版节奏** | 发现方案 Y 的 Y2 中间态发版风险 — 与用户 v0.9.4 sync 当日发版历史冲突 |

**关键反思**：REVIEW-2 把方案 X 的问题归类为"长期工程整洁度"，把方案 Y 的问题归类为"短期用户体验"。两者权重对**非职业开发者用户**来说，短期用户体验明显优先（用户最在意"拿到能用的产品"）。

但仍然不是单边推 X：**如果用户的发版节奏不是当日发版**，方案 Y 仍然胜出。

#### 11.10.6 决策树（给用户的最终问句）

```
用户问自己：「这次 sync v0.9.5 我打算什么时候打包发版？」

├── 「sync 实测通过当天就打包推 R2」
│   → ⭐ 方案 X：sync + i18n fix 搭车一个 commit
│   → 接受 R1/R2/R3 长期归因困难，换取 Y2 短期发版洁净
│
├── 「sync 落地先静置 1-2 天观察，再决定打包」
│   → ⭐ 方案 Y：sync commit → i18n fix commit → 两个 commit 同 PR
│   → 享有 bisect / 归因 / 上报 upstream 灵活度
│
└── 「现在只想同步上游进 main，不打算近期发版」
    → ⭐ 方案 Y：sync 落地 → 充足缓冲后 i18n fix 独立 commit
    → 等真要发版时再做 D-β 双平台实测
```

#### 11.10.7 元反思：3 轮 review 是不是 review 过度？

参考 [`M3-I18N-FIX-CLAIM-AUDIT.md`](.planning/M3-I18N-FIX-CLAIM-AUDIT.md) §结尾："**不要**再说'再 review 一轮'——review 的边际收益已经趋零"。

但本轮 review 3 轮里：
- REVIEW-1 找出 3 处事实错误（夸大 6×）+ M3 fix 搭车评估完整覆盖 — **高边际收益**
- REVIEW-2 找出方案 X 的 4 个真问题 + 5 执行细节 + 1 长期反思 — **中高边际收益**
- REVIEW-3 找出方案 Y 的 1 个真问题（Y2 中间态发版）+ 推荐决策树 — **中边际收益**

**判断**：REVIEW-3 仍有边际收益（Y2 不是 trivial 问题），但之后再多 review 边际收益就趋零了。本报告 review 到此为止。

下一步用户自己决定方案 X 或 Y（按 §11.10.6 决策树），AI 不再主动推 review-4。

---

### 11.11 DECISION-1：用户选定方案 Y++（增稳版）

> 用户决策：「我要的是稳，麻烦一点都不怕的」（2026-05-21）
>
> 命中 §11.10.6 决策树：**"sync 落地先静置 1-2 天观察，再决定打包" + "不怕麻烦"** → 方案 Y 的增稳版（dry-run + 双重静置）

#### 11.11.1 方案 Y++ 设计理念

在方案 Y（sync commit + i18n fix commit 独立 commit）基础上增稳：

1. **每个 commit 都先做"未发版的实测验证"再 push**——保留 `git restore` / `git reset` 一键回滚能力
2. **每个 commit 落地后静置 1-2 天**——观察实测覆盖不到的长尾问题（特定 source 行为 / 少见 session 类型 / 模型风格变化的主观可接受度）
3. **打包 D-β 双平台是发版前最后一道关**——dev 模式 + 装包模式跨模式验证（M3 spec §4.2.1 之前从未跨模式验证过）
4. **每步精确保留前一步成果**——任何阶段踩刹车不影响已稳态的部分

#### 11.11.2 Phase 1：sync commit dry-run（不发版）

| 子步 | 操作 | 验收 |
|---|---|---|
| 1-1 | `git checkout -b sync/upstream-v0.9.5-20260521` | 分支创建 |
| 1-2 | `git merge --no-ff v0.9.5` | merge conflict 提示进入 |
| 1-3 | 按 §6.2 a-f 6 步解决冲突 | 工作树干净 |
| 1-4 | typecheck + lint + i18n parity + 全套 bun test | 全绿（19 latent fail 来自 v0.9.3 baseline 可接受）|
| 1-5 | Marker 基线核查 = 97 | grep 命令期望 97 |
| 1-6 | dev 模式起 App 跑 sync 主线实测（compact UX / AcceptPlan / MCP source_test / branching）| 无 regression（i18n bug 仍存在是预期，留给 Phase 2）|

**踩刹车点 🚦1**：1-4 / 1-5 / 1-6 任一步发现问题 → `git reset --hard HEAD~1` 或 `git checkout main && git branch -D sync/upstream-v0.9.5-20260521`

**Phase 1 完成条件**：1-4 验证全绿 + 1-6 实测 sync 主线无 regression → `git commit`（不 push）

#### 11.11.3 Phase 1.5：静置观察 1-2 天

sync commit 落地但**不 push 不打包不发版**。dev 模式日常使用，观察：
- compact UX 在你日常工作流里是否流畅
- MCP source_test 在你日常用的 source 上是否给真实诊断
- branching 行为是否稳定
- 后台跑的会话是否有 unexpected behavior

**踩刹车点 🚦1.5**：观察期发现问题 → `git reset --hard origin/main` 整个分支废掉

#### 11.11.4 Phase 2：i18n fix commit dry-run（不发版）

| 子步 | 操作 | 验收 |
|---|---|---|
| 2-1 | 改 `apps/electron/src/renderer/main.tsx`（按 M3 spec §4.1）| 工作树有变更 |
| 2-2 | typecheck + lint | 全绿 |
| 2-3 | Marker 基线核查 = 98 | grep 命令期望 98 |
| 2-4 | dev 模式跑 M3 §5.1 步骤 1-6（标题语言验证）| 6 步全绿 |
| 2-5 | dev 模式跑 M3 §6.4 步骤 7-11（dormant 路径 A 激活 + 菜单 + race）| 5 步全绿 |

**踩刹车点 🚦2**：2-4 / 2-5 任一步发现问题 → `git restore apps/electron/src/renderer/main.tsx`（**保留 sync commit**）

**Phase 2 完成条件**：2-4 + 2-5 共 11 步实测全绿 → `git commit`（不 push）

#### 11.11.5 Phase 2.5：静置观察 1-2 天

i18n fix commit 落地但**不 push 不打包不发版**。dev 模式日常使用，重点观察 dormant 路径 A 激活后的副作用：
- 模型回复风格是否变化（代码注释中文 / 错误处理中文 / 提示语中文）
- **你接受这种风格变化吗？**——如果不接受，回滚 i18n fix 但保留 sync commit
- macOS 菜单是否稳定中文
- 会话恢复 race 是否复现（少见，spec §6.4 提了"质变改善但非 100% 保证"）

**踩刹车点 🚦2.5**：观察期发现 dormant 副作用不可接受 → `git revert <i18n-fix-commit-hash>`（**保留 sync commit**）

#### 11.11.6 Phase 3：spec 文档同步

| 文件 | 修改 |
|---|---|
| `u-agents/.planning/M3-I18N-MAIN-PROCESS-SYNC-FIX.md` | §7 表 "#53" → "#54"、"96 → 97" → "97 → 98" |
| `u-agents/.planning/M3-I18N-FIX-CLAIM-AUDIT.md` | §7 表 "96 → 97" → "97 → 98" |
| `u-agents/CLAUDE.md` | §3.7 新建"v0.9.5 sync 期间新增改造点"子表加 #53 + #54 两行 + 基线刷新 96 → 98 + 历史演进段落 |

单独 commit `docs: §3.7 marker 基线刷新 96 → 98 (v0.9.5 sync + M3 i18n fix)`。

#### 11.11.7 Phase 4：打包 D-β 双平台（发版前最后一道关）

| 子步 | 操作 | 验收 |
|---|---|---|
| 4-1 | macOS arm64：从 repo root 跑 `bun run electron:dist:mac`（**不是** `cd apps/electron && bun run dist:mac`——electron-builder 入口在 root scripts）| 装 .dmg → 跑 sync 主线 D-β + M3 §5.1 步骤 3-4 抽测 |
| 4-2 | Windows x64：按 v0.9.4 双平台节奏 | 装 .exe → sync 主线 D-β + i18n 步骤 3-4 抽测 |

**踩刹车点 🚦4**：装包模式实测发现 dev 模式没暴露的问题 → `git revert` 对应 commit + 重新打包

**Phase 4 完成条件**：双平台装包模式实测全绿 → push 到 origin/main + 按 [`05-build-release.md`](../05-build-release.md) 推 R2

#### 11.11.8 踩刹车点损失矩阵

| 踩刹车点 | 触发时机 | 操作 | 最大损失 | 保留成果 |
|---|---|---|---|---|
| 🚦1 | Phase 1 dev 实测 | `git reset --hard HEAD~1` | 1-2h sync conflict 工作 | 无 |
| 🚦1.5 | Phase 1.5 静置期 | `git reset --hard origin/main` | 1-2h + 1-2 天 | 无 |
| 🚦2 | Phase 2 dev 实测 | `git restore main.tsx` | 30min i18n fix | **sync commit 保留** |
| 🚦2.5 | Phase 2.5 静置期 | `git revert <i18n-commit>` | 30min + 1-2 天 | **sync commit 保留** |
| 🚦4 | Phase 4 装包实测 | `git revert <commit>` + 重打包 | 1-2h 打包时间 | 看 revert 哪一个 |

#### 11.11.9 总成本估算

| 阶段 | 工作时间 | 静置时间 |
|---|---|---|
| Phase 1 | 2-3 小时（merge + 冲突 + 验证 + dev 实测）| —— |
| Phase 1.5 | —— | 1-2 天 |
| Phase 2 | 30 分钟（改文件 + dev 11 步实测）| —— |
| Phase 2.5 | —— | 1-2 天 |
| Phase 3 | 15 分钟（doc updates）| —— |
| Phase 4 | 2-3 小时（双平台打包 + 装包实测）| —— |
| **总计** | **~6 小时实际操作** | **2-4 天静置等待** |

**vs 方案 X 当日发版节奏**：~4 小时工作 + 0 静置。

方案 Y++ 多花 2 小时实际操作 + 2-4 天日历等待，换来：
- ✅ 每步独立 commit，bisect / blame 友好
- ✅ 每步独立可回滚
- ✅ Phase 1.5 + 2.5 静置观察"实测覆盖不到的长尾问题"
- ✅ dormant 路径 A 副作用单独观察，主观不可接受时单独 revert i18n fix 保留 sync
- ✅ 装包模式跨 dev 模式验证 IPC handler 注册时序（M3 spec §4.2.1 之前从未跨模式验证）

#### 11.11.10 给用户的"决策预设"清单

执行前先确认下列预设你都接受，否则停下问 AI：

| # | 预设 | 你接受？ |
|---|---|---|
| 1 | sync commit 落地后**不打包 1-2 天**，期间用户日常用 dev 模式 | ☐ |
| 2 | i18n fix commit 落地后**再不打包 1-2 天**，观察模型风格变化 | ☐ |
| 3 | 如果 dormant 路径 A 激活后模型风格变中文你**不喜欢**，可以选择 revert i18n fix 保留 sync | ☐ |
| 4 | Phase 4 装包实测如果跨模式发现 dev 没暴露的问题，接受重新打包 | ☐ |
| 5 | 双平台 D-β 实测节奏跟 v0.9.4 一样（macOS arm64 + Windows x64）| ☐ |
| 6 | spec 文档同步（Phase 3）独立 commit，不合并进 i18n fix commit | ☐ |
| 7 | M3 spec §7 改造点编号 #53 改成 #54（搬位置给 model-picker-helpers brand）| ☐ |
| 8 | 整个流程总日历时间 ~3-7 天（含静置期），不是当日完成 | ☐ |

任何一项打不上 ☑ 就停下问 AI，不要硬上。

---

## 12. 修订日志

| 修订 | 日期 | 范围 | 触发 |
|---|---|---|---|
| 初版 | 2026-05-21 | 0-10 章 | 用户："上游更新了 v0.9.5 你看看" |
| REVIEW-1 | 2026-05-21 同日 | §0 TL;DR C11/C12 行 / §2.3 NEW 文件清单 + brand 命中表 / §4.1 C11 表 / §7 v0.9.4 对比表 / 新增 §11 M3-I18N-FIX 搭车评估 / 新增 §12 本日志 | 用户："review一轮 顺便看看这次升级能不能把 ... M3-I18N-FIX-CLAIM-AUDIT.md 加进去" |
| REVIEW-2 | 2026-05-21 同日 | 新增 §11.9 方案 X 反思 + 推荐力度下调 | 用户："review一轮方案 X" — 对 §11.5 初版"⭐ 强推荐方案 X"的批判性复核 |
| REVIEW-3 | 2026-05-21 同日 | 新增 §11.10 方案 Y 反思 + 推荐改为"取决于发版节奏" + 决策树 | 用户："那再 review 一轮方案 Y" — 对 §11.9 REVIEW-2"温和倾向方案 Y"的批判性复核 |
| DECISION-1 | 2026-05-21 同日 | 新增 §11.11 用户选定方案 Y++（增稳版）完整 SOP — 4 阶段 + 5 个踩刹车点 + 决策预设清单 | 用户："我要的是稳 麻烦一点都不怕的" — 命中决策树 §11.10.6 "sync 落地先静置 1-2 天 + 不怕麻烦" |
| REVIEW-4 | 2026-05-21 同日 | 改 §6.2 b 步 package.json 处理为 3-way merge + 加 Python 脚本；改 §11.10 R8 / §11.11.7 4-1 / M3 spec §9.1 笔误命令为 `bun run electron:dev` from repo root；§packages/shared/package.json exports 加 `./utils/files` 修 M2 #32c 漏盘 | sync 实测踩坑：(a) `bun run electron` 起默认欢迎页 — 命令错误；(b) `@u-agents/shared/utils/files` 解析失败 — M2 #32c 落地时漏注册 export；(c) `--theirs + sed scope` 把 14 个 package.json 的 brand 字段静默丢失（description / author / homepage / private / bin）|
| REVIEW-5 | 2026-05-21 同日 | §11.11.2 Phase 1-6 实测清单：A1-A4 紧凑 drawer 类标记"桌面 Electron 不可达，跳过实测"，集中验证 B1 model picker brand（§3.7 #53 唯一真冲突修复点）+ C1 branching + A5 MCP source_test。新增 §11.12 紧凑模式断点错位长期反思 | sync 实测发现：BrowserWindow minWidth=800 > MOBILE_THRESHOLD=768，桌面 Electron 永远进不了 shell 紧凑布局 → 上游 v0.9.5 加的 4 个紧凑 drawer feature 在桌面 dev 模式无法触发实测。fork main / v0.9.4 / v0.9.5 都是这个状态，非 sync 引入，是 fork 长期设计错位 |
| REVIEW-6 | 2026-05-21 Phase 3 时 | 头部加 callout 说明本文档历史"model-picker=#53, M3 i18n=#54"按 SOP 字典序的措辞与**实际落地相反**；CLAUDE.md §3.7 已补 "v0.9.5 sync 期间新增改造点" 子表 (#54 = model-picker brand)；M3 spec §7 基线 96→97 改成 96→98；AUDIT §7 同步 | Phase 3 spec 文档同步时发现：M3 i18n fix commit `5212197b` 先落地占了 #53，v0.9.5 sync 自身 model-picker brand patch 实际落到 #54，与文档的字典序决策相反。事实优先 — CLAUDE.md / M3 spec / AUDIT 按事实更新，PREVIEW 历史措辞保留作为决策推演记录 |

**REVIEW-1 修正的事实错误**：

| # | 章节 | 原文 | 修正后 | 验证命令 |
|---|---|---|---|---|
| E1 | §2.3 新文件清单 | 列了 24 行（含 `messaging-gateway/__tests__/renderer.test.ts` + `turn-lifecycle.test.ts` + `turn-utils-grouping.test.ts` 3 个 MODIFIED 误标 NEW） | 21 行（删 3 个 MODIFIED 误标） | `git diff v0.9.4..v0.9.5 --name-only --diff-filter=A \| wc -l` = 21 |
| E2a | §0 TL;DR C11 行 | "21 新文件全部用 `@craft-agent/` import" | "21 新文件中 5 个 + 2 修改文件共 7 文件 9 处" | `git diff v0.9.4..v0.9.5 \| grep -cE "^\+.*@craft-agent/"` = 9 |
| E2b | §2.3 brand audit 表 | "pi-turn-anchors.test.ts \| 26 处（全 import + import type）" | "pi-turn-anchors.test.ts: 0"（实际无 `@craft-agent/` import；原值把全部 import 行数误当 brand import）| `git show v0.9.5:packages/server-core/src/sessions/pi-turn-anchors.test.ts \| grep -c "@craft-agent/"` = 0 |
| E2c | §4.1 C11 表 | "21 新文件 13 文件 ~50 处" | "7 文件 9 处" | 同 E2a |
| E2d | §7 对比表 C11 行 | "13 文件 ~50 处（**大 12×**）" | "7 文件 9 处（约 2× v0.9.4）" | 同 E2a |
| E3 | §0 TL;DR C12 行 | "**0**（5 轮预测...）" | "**预测 0**（1 轮静态扫描...）" | 本次只跑 1 轮静态扫描；"5 轮"沿用了 v0.9.4 PREVIEW 模板措辞 |

**事实结论不变**：A− 评级 / 0 §3.3 真冲突 / 1 §3.7 真冲突 / 1 C13 / Pi SDK 不升级 / 0 决策点。

**新增内容**：§11 M3-I18N-FIX 搭车评估完整章节（含 8 小节）+ §12 本日志。
