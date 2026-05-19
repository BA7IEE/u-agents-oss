# UPSTREAM PREVIEW — v0.9.4 同步预分析报告（2026-05-20）

> **本报告由本仓库 AI 在 `git fetch upstream` **之前** 通过 `gh api` 只读获取上游 compare 数据产出**。
> 不动代码、不动 git refs、本地 `upstream/main` 仍是 v0.9.3。
> 目的：给执行 merge 的用户/外部 AI 一份可直接照做的预案。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.3 / §3.7 + [`07-upstream-sync.md`](../07-upstream-sync.md) + [`08-conflict-zones.md`](../08-conflict-zones.md)

---

## 0. TL;DR

| 维度 | 判断 |
|---|---|
| 上游新版本 | **v0.9.4**（2026-05-15 release，距 v0.9.3 4 天）|
| commit 类型 | 单个 squash release commit（与 v0.9.0/v0.9.1/v0.9.2/v0.9.3 同模式）|
| 影响面 | **73 文件 / +698 −202 行**（相比 v0.9.3 的 134 文件 / +7641 行小约 10×）|
| **冲突等级** | **A−（极小）** —— **fork 历史上最干净的一次 sync** —— **REVIEW-5 修正**：原 "A"，加 1 个 eslint.config.mjs 隐式冲突 + 1 个 bun.lock 预期冲突后微调为 "A−" |
| §3.3 高冲突文件真冲突数 | **0** |
| §3.7 改造点真冲突数 | **0 真 / 0 硬冲突 / 0 软冲突** |
| **REVIEW-5 隐式冲突**（不在 §3.7 改造点表里但需要手工处理）| **2 处**：(a) `eslint.config.mjs` ESLint 死规则手工删（§3.9 / §6.3a，3-way merge 留 ours 现象）；(b) `bun.lock` 重新生成（§6.1a，lockfile 手工 merge 不可行）|
| §3.7 改造点交集文件 | **3 注释 marker 文件 + 1 字面量 marker 文件 = 4 文件**（AiSettingsPage / state.ts / storage.ts / pi-agent.ts），位置全部不重叠 |
| §3.7 自动过期 marker | **0** |
| §3.7 基线变化预测 | **95 → 95**（无增减；除非 M2 i18n 验收触发新增 marker）|
| §3.7 **新增改造点**（merge 后必做）| **1 项**：`apps/electron/resources/release-notes/0.9.4.md` brand 替换 + 中文翻译（上游新文件含 "Craft Agent" 字面量 1 处；沿 0.9.3.md 历史路径处理；§3.8 详述）|
| C11 NPM scope rename 触发文件 | **1 文件 4 处**（settings.ts RTK RPC dynamic import）|
| C12 / C13 / C14 触发 | **0 / 0 / 0** |
| **底层 SDK 升级**（**REVIEW-3 修正**）| **Pi SDK 跨小版本升级 0.72.1 → 0.73.1**（**不是** 0.73.0 → 0.73.1）；3 个 dep 一齐升：pi-coding-agent + pi-agent-core + pi-ai；merge 后必须跑全套 §6.5 验证 + §8.2 对话路径回归 |
| **顺手 follow-up**（REVIEW-3 发现）| **删 root package.json `@github/copilot-sdk` dep**（上游漏删 + 我们 04-feature-cuts 漏删；详见 §9.2）|
| 新决策点 | **2 项**（§5.1 RTK 接收策略 / §5.2 RTK i18n zh-Hans 文案验收）|
| 推荐时机 | **本周内 sync**，按 v0.9.3 SOP 走即可，无需 P0 review |
| 推荐分发 | **macOS arm64 + Windows x64**（与 v0.9.3 D-β 一致）|

---

## 1. 上游版本元数据

```
tag         v0.9.4
release     2026-05-15 17:07:16 UTC
prerelease  false
title       v0.9.4 — RTK token optimization, compact-session fixes, Codex transport stability
```

**主题（按 release notes 顺序）**：

| 区域 | 一句话 | 影响面 |
|---|---|---|
| Features × 1 | **RTK Bash token compression** — Settings → AI → Performance 加入 opt-in RTK 集成。开关默认 off；用户需自行装 `rtk` ≥0.23.0 binary。LLM 仍看见原 Bash 命令、权限系统仍门控原命令，但 SDK 实际执行重写为 `rtk <cmd>` 走 RTK 的压缩输出 | **新 feature，无品牌入口风险**（§5.1 详述）|
| Improvements × 2 | (a) **Backend packaging cleanup** — 删 Pi consolidation 后残留的 Codex/Copilot 死打包条目、import guards、runtime fields、docblocks。**与我们 04-feature-cuts 八类裁剪同向**<br>(b) **OSS README Trendshift badge** — 仅 README，我们已自定义无冲突 | 后端清理 + README 微调 |
| Bug Fixes × 4 | (a) Pi SDK ↑ 0.73.1（含上游 Codex transport 修复：1011/1006 keepalive timeout、WS→SSE fallback、cert verification）<br>(b) Compact session menu 用 vaul drawer + iOS 风格 drill-in 替代 Radix nested dropdown（紧凑布局下 nested action 不再被裁切）<br>(c) Rapid session-label toggles race-safe（extract `useSessionMenuActions` + optimistic state compound rapid taps）<br>(d) Skills "Show in Finder" 走真实 `skill.path` 而非合成 `SKILL.md` 路径，加 platform-aware toast | 含 ChatGPT Plus / Codex OAuth bug fix（**与我们无关**——我们锁了 baseUrl 不走这路径）|
| Breaking | **None**（向后兼容；所有改动 opt-in 或 bug fix）| —— |

---

## 2. 73 文件分类清单

按"对我们的影响域"分桶，便于 merge 时分批 review。

### 2.1 §3.3 高冲突文件交集（共 7 文件，0 真冲突）

| 文件 | 上游变更 | 真冲突？ |
|---|---|---|
| `apps/electron/electron-builder.yml` | +1 −23（纯**删** `vendor/codex/` + `vendor/copilot/` 配置块；不碰 top-level keys appId/productName/publish.url/artifactName/dmg.title/linux.maintainer）| ❌ 无冲突，**架构同向**（我们 04-feature-cuts 已删 Codex/Copilot 后端）|
| `packages/shared/src/branding.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/llm-connections.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/provider-metadata.ts` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx` | **未碰** | ✅ 干净 |
| `apps/electron/src/renderer/components/apisetup/` 目录 | **未碰** | ✅ 干净 |

⚠️ **`win.artifactName: "Craft-Agents-${arch}.${ext}"` 上游 patch 第一行作为 unchanged context 出现** —— 我们 fork 已经把这行改成 `"U-Agents-${arch}.${ext}"`。git 3-way merge 对 unchanged context 行只用于对齐 hunk，不会冲突；但 §3.3 SOP 要求 merge 后 spot check 该文件，确认我们的 brand patch 还在。

⚠️ **`apps/electron/eslint.config.mjs` 是 REVIEW-5 新发现的隐式冲突点**（不在 §3.3 表里但需要 spot check）：上游 v0.9.4 删 4 行 ESLint restricted-import 规则（包括 `@craft-agent/shared/agent/codex-agent` 等），但我们 fork 已把 `@craft-agent` 改成 `@u-agents`（M1 NPM scope rename）。**base→ours 改 scope + base→theirs 删行** 的 3-way merge 场景，git 通常 auto-merge 保 ours → 我们 fork 会**留下 `@u-agents/shared/agent/codex-agent` / `@u-agents/shared/agent/copilot-agent` 两条 ESLint 死规则**（引用的目标在我们 fork 已被裁剪）。详见 §3.9。

### 2.2 §3.7 改造点路径交集（**注释 marker 3 文件 + 字面量 marker 1 文件 = 4 文件，0 冲突**）

> **REVIEW-2 修正**：初版报告说"5 文件"且未把 pi-agent.ts 列入交集——实际跑 `comm -12` 精确交集后，注释 marker（`// U-API:` / `/* U-API */`）文件 = 3 个，字面量 marker（`'U-API'`）文件 = 1 个（pi-agent.ts L122 + L1943 backendName brand 替换）。routing.ts / channels.ts 无任何 U-API marker，不在改造点交集；电子构建器 vs RTK 等其他 v0.9.4 文件也不撞 marker。

| 文件 | 我们的 marker | 上游动作 | 类别 |
|---|---|---|---|
| `packages/shared/src/auth/state.ts` | §3.7 #4 `hasCredentials` keyless 特判（L305-306 注释 marker）| L308 注释微调（OpenAI OAuth → "OpenAI / ChatGPT OAuth"）| **干净**（行号不重叠）|
| `packages/shared/src/config/storage.ts` | §3.7 #1/#2/#3 + #32a + #33b + #46（多个**注释 marker** 散布在 enforceUApiBaseUrl / startup lock / atomicWriteFileSync / dir 0o700 / browserToolEnabled 等）| 仅在 L77-79 加 `rtkEnabled?: boolean` 字段 + L500-525 新增 `getRtkEnabled` / `setRtkEnabled` 两个函数 | **干净**（新增位置不撞）|
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | §3.7 #11o / #19-#25（一系列 isUApiSlug / Connection Row / Default Connection selector / Add Connection 改造，**注释 marker**）| +112 行**全部在 RTK feature scope**（formatTokenCount helper / 4 个 state / init load / 4 个 callback / SettingsToggle UI block）| **干净**（位置不重叠）|
| `packages/shared/src/agent/pi-agent.ts` | §3.7 #11o `backendName = 'U-API'` **字面量 marker**（L122 class member + L1943 同字面量；不加 `// U-API:` 注释 marker）| L52 / L94-96 / L150 / L1149-1158（RTK context build） / L1173 / L1246（RTK 参数传入）/ L1870 / L2241（注释清理）| **干净**（字面量在 L122/L1943；RTK 集成在 L1149+，位置不重叠）|

**未在交集（但也改了）的关键文件**（v0.9.4 改了但**无 U-API marker**，merge 自动通过）：

| 文件 | 上游动作 | 备注 |
|---|---|---|
| `packages/shared/src/protocol/routing.ts` | v0.9.3 sync 已删 #37 marker（自动过期）；本次 L156+ 在 `LOCAL_ONLY_CHANNELS` 加 4 个 RTK channel | C13 未触发（上游正确分类）|
| `packages/shared/src/protocol/channels.ts` | 加 `rtk: {GET_ENABLED,SET_ENABLED,GET_STATUS,GET_GAIN}` subobject | 无 marker |
| `apps/electron/electron-builder.yml` | 删 vendor/codex + vendor/copilot 打包条目（−23 行）| §3.3 高冲突文件 #1，但**不撞**我们 top-level brand patch（appId/productName/publish.url/artifactName/dmg.title/linux.maintainer）|

详见下方 §3 表。

### 2.3 Codex/Copilot 死代码清理（**9 文件 ~−95 行**，含纯注释清理）

```
packages/shared/src/agent/backend/internal/runtime-resolver.ts  +0 −22  删 resolveCopilotCliPath + copilotCliPath 字段
packages/shared/src/agent/backend/base-event-adapter.ts         +4 −4   注释清理（删 Codex/Copilot 引用）
packages/shared/src/agent/backend/types.ts                      +0 −2   删 backendKind 'codex'/'copilot' 值
packages/shared/src/agent/backend/factory.ts                    +5 −5   注释清理（**REVIEW-4 修正**：不是"纯重排"——L122-127/190-192/243-246 三块 docblock 注释把 Codex/Copilot 示例改成 Pi）
packages/shared/src/agent/backend/event-queue.ts                +2 −2   纯重排
packages/shared/src/agent/base-agent.ts                         +5 −7   注释清理（删 CodexAgent / CopilotAgent / Ephemeral thread 提及）
packages/shared/src/agent/pi-agent.ts                           注释清理部分（L52 / L150 / L1870 / L2241，与 §2.4 RTK 集成共存于同 patch）
apps/electron/electron-builder.yml                              +1 −23  删 vendor/codex/copilot 打包条目（§3.3 高冲突文件，详见 §2.1）
apps/electron/eslint.config.mjs                                 +0 −16  删 Codex/Copilot ESLint restricted-import 规则（−16 lint warning 来源）
```

**与我们 04-feature-cuts 八类裁剪同向** —— 上游也在收尾"两后端架构（Claude + Pi）"。我们之前担心的"上游可能引入新 backend 字段"在这次完全反向：上游进一步**精简**，对我们裁剪策略是**正面信号**。

### 2.4 RTK 集成（**2 新文件 + ~13 现有文件改**）

```
# 新文件（2 个）
packages/shared/src/agent/core/rtk-detector.ts           NEW +148  rtk binary 检测 + version check（≥0.23.0）+ gain stats 解析
packages/shared/src/agent/core/rtk-rewrite.ts            NEW  +86  rewriteBashWithRtk：spawn `rtk rewrite <cmd>` 200ms timeout，禁 telemetry

# Agent backend 集成（4 个）
packages/shared/src/agent/core/pre-tool-use.ts           +32  L853-872 PreToolUse pipeline 5g 步集成 RTK 重写
packages/shared/src/agent/claude-agent.ts                +12  L70-72 import + L1098+ build RtkContext 传入 runPreToolUseChecks
packages/shared/src/agent/pi-agent.ts                    +15  L94-96 import + L1149-1158 build RtkContext + L1173/L1246 传 rtkContext（**和 Pi 模式 PreToolUse 两处调用都接入**）
packages/shared/src/agent/core/index.ts                  +5   re-export RTK detector 公开 API

# RPC + IPC + types（5 个）
packages/server-core/src/handlers/rpc/settings.ts        +28  4 个 RTK RPC handler（GET_ENABLED / SET_ENABLED / GET_STATUS / GET_GAIN），**4 处 `@craft-agent/` dynamic import 触发 C11**
apps/electron/src/shared/types.ts                        +6   electronAPI 类型签名加 4 个 RTK 方法（**不加 openUrl —— 已是已存在的 IPC**）
apps/electron/src/transport/channel-map.ts               +6   IPC channel 映射加 4 个 RTK channel
apps/electron/src/shared/__tests__/ipc-channels.test.ts  +4   测试加 4 个 channel
packages/shared/src/protocol/channels.ts                 +6   RPC_CHANNELS.rtk subobject
packages/shared/src/protocol/routing.ts                  +6   LOCAL_ONLY_CHANNELS 加 4 个 RTK channel

# 设置存储 + UI（2 个）
packages/shared/src/config/storage.ts                    +24  rtkEnabled 字段 + getter/setter（默认 false）
apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx  +112  UI block + state + callbacks（含 `handleGetRtk` 用**已存在的** `window.electronAPI?.openUrl(...)`）
```

**关键 RTK 风险评估**：

| 维度 | 评估 | 凭据 |
|---|---|---|
| 是否暴露上游品牌 | ❌ 不暴露 | grep `Craft Agent\|craft\.do` 在 rtk-* 新文件 = 0 命中；外链是 `https://github.com/rtk-ai/rtk` 第三方项目 |
| 是否绕过 `enforceUApiBaseUrl` | ❌ 不绕过 | RTK 只重写 Bash 工具调用，不碰 LLM 请求；LLM 请求仍走 `https://token.u-studio.cn/v1` |
| 是否引入新 LLM provider | ❌ 不引入 | RTK 是本地 Bash 命令重写 CLI，与 LLM 无关 |
| 是否引入隐私问题 | ❌ 不引入 | rtk-rewrite.ts L48 + rtk-detector.ts L82 均**显式设置 `RTK_TELEMETRY_DISABLED: '1'`** spawn env，禁用 RTK 自带 telemetry |
| 是否默认启用 | ❌ 默认 off | storage.ts L77 `rtkEnabled?: boolean` + `config?.rtkEnabled === true` 严格判断；仅当用户在 Settings 主动开 toggle 才启用 |
| 是否自动安装 rtk binary | ❌ 不自动装 | 仅 `which rtk` 检测；用户需自行装。Settings UI 见状态 = installed 才显 toggle |

**结论**：**全盘接收，不需要在 UI 裁剪 RTK**。详见 §5.1。

### 2.5 Skills "Show in Finder" 修复（3 文件 ~+50 −15 行）

```
apps/electron/src/renderer/components/app-shell/SkillMenu.tsx        +1 −1   onShowInFinder 类型 Promise 化
apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx  +11 −3
apps/electron/src/renderer/pages/SkillInfoPage.tsx                   +19 −12
```

修复上游 issue [#756](https://github.com/lukilabs/craft-agents-oss/issues/756) —— skill 详情/列表/菜单的"Show in Finder"现在走真实 `skill.path` 而非合成 `SKILL.md` 路径，并加 platform-aware Finder/Explorer toast。

**对我们影响**：纯 bug fix，**不撞我们任何 marker**。merge 后实测确认 zh-Hans 下 toast 翻译是否到位（如未到位则 M2 i18n 阶段补一个 key）。

### 2.6 SDK 升级（14 个 package.json + bun.lock）

| 文件 | 变更 |
|---|---|
| `apps/cli/package.json` | +1 −1（版本号 0.9.3 → 0.9.4） |
| `apps/electron/package.json` | +1 −1 |
| `apps/viewer/package.json` | +1 −1 |
| `apps/webui/package.json` | +1 −1 |
| `package.json`（root） | +3 −3（含 **2 个 Pi SDK dep**：`@mariozechner/pi-ai` + `@mariozechner/pi-coding-agent`）|
| `packages/pi-agent-server/package.json` | +4 −4（**3 个 Pi SDK dep**：pi-ai + pi-coding-agent + pi-agent-core 一齐升）|
| `packages/core/package.json` 等其余 8 个 | 各 +1 −1 / +2 −2 |
| `bun.lock` | +32 −36 |

**预期变更（REVIEW-3 修正）**：3 个 Pi SDK dep `0.72.1` → **`0.73.1`**（**跨小版本升级**，不是 0.73.0 → 0.73.1）：
- `@mariozechner/pi-coding-agent` 0.72.1 → 0.73.1
- `@mariozechner/pi-agent-core` 0.72.1 → 0.73.1（仅 pi-agent-server 直接依赖）
- `@mariozechner/pi-ai` 0.72.1 → 0.73.1

含 Codex transport keepalive/SSE fallback/cert 修复 + 其他 minor 改动（详见 [`@mariozechner/pi-ai` 0.73.x release notes](https://github.com/mariozechner/pi-ai)）。

⚠️ **跨小版本（0.72 → 0.73）升级，但很可能 backwards compatible**（REVIEW-4 措辞修正）：

按 v0.9.4 release notes 的描述 ——"WebSocket setup can fall back to SSE before streaming starts, and cached WebSocket sessions are closed properly during session shutdown" —— 这是 **transport layer bug fix**，对调用者 API surface 应当透明。0.72→0.73 跨小版本变更面比 patch 升级广，但**很可能不引入 breaking change**。

merge 后必须跑 §6.5 全套验证，特别关注：
- LLM 请求走通（U-API Token 路径 + Anthropic Messages / OpenAI Chat Completions 协议都试一次）
- Pi backend 子进程能正常 spawn + 退出
- Bash tool 大输出（如 `find /` 或 `bun test` 跑 10s+）不卡死
- 长会话稳定性（v0.9.4 本身就是修这个）—— 跑 30 分钟以上的会话不出现 1011/1006/cert 错误

⚠️ **C11 触发预警**：这些 package.json 的 `@craft-agent/*` workspace 引用**已经被我们 M1 commit 改成 `@u-agents/*`**——上游 patch 改的只是版本号字符串，**git auto-merge 应当干净通过**（上下文匹配会自动对齐我们的 scope rename）。

⚠️ **root package.json 残留 `@github/copilot-sdk` dep（REVIEW-3 P0 发现）**：v0.9.4 上游"Codex/Copilot 死代码清理"**漏了**——`grep "@github/copilot-sdk" package.json` 仍命中 1 处（unchanged context line `"@github/copilot-sdk": "^0.1.23"`）。我们 fork **也没删过**（M1 04-feature-cuts 八类裁剪只删 UI + runtime + provider 列表，未触 root package.json dep 清单）。**与本次 sync 无冲突**（merge 不碰这行），但是个**顺手 follow-up 机会** —— 详见 §9.2 backlog。

### 2.7 i18n（7 locales × 7 keys）

```
packages/shared/src/i18n/locales/{de,en,es,hu,ja,pl,zh-Hans}.json  各 +7
```

**新增 7 个 RTK i18n key**（按 alpha 顺序插入 `settings.ai.r*` 区段）：
- `settings.ai.rtk.title`
- `settings.ai.rtk.description`
- `settings.ai.rtk.gainSummary`（含 `{{saved}} {{count}} {{pct}}` 插值）
- `settings.ai.rtk.gainRefresh`
- `settings.ai.rtk.notInstalledDesc`
- `settings.ai.rtk.getRtk`
- `settings.ai.rtk.recheck`

**zh-Hans 已含上游翻译**（无需我们 M2 i18n 二次翻译）：

```json
"settings.ai.rtk.description": "通过 rtk 路由,在常见开发命令上减少 60–90% 的 token 消耗。",
"settings.ai.rtk.gainRefresh": "刷新统计",
"settings.ai.rtk.gainSummary": "{{count}} 条命令节省 {{saved}} tokens · 平均效率 {{pct}}%",
"settings.ai.rtk.getRtk": "获取 RTK",
"settings.ai.rtk.notInstalledDesc": "安装 rtk 二进制文件,然后点击重新检查。",
"settings.ai.rtk.recheck": "重新检查",
"settings.ai.rtk.title": "Token 优化"
```

⚠️ **M2 i18n 验收风险（§5.2）**：上游 zh-Hans 用半角逗号 `,` + 英文小写 `tokens`，与我们 v0.9.3 中文化风格（统一全角"，" + 全角空格）**不一致**。M2 阶段需要 review 是否照搬 / 是否触发 `lint:i18n:strings` 风格规则。

### 2.8 其它（剩余 ~24 文件，纯重构/测试/版本号）

- **22 个测试文件各 +1 −1：注释清理**（**REVIEW-3 修正**：抽样 `event-queue.test.ts` 显示真改的是把"Used by CodexAgent and CopilotAgent"→"Used by PiAgent where events arrive asynchronously from the subprocess"——属上游"Backend packaging cleanup ... docblocks"主题，**不影响测试逻辑**，全部接受 theirs）
- 大量 `agent/backend/` 内部小重构（claude/event-adapter / pi/event-adapter / factory / event-queue）—— 也是 docblock 清理 + 纯重排

**全部接受 theirs**，跑 `bun test` 验证即可。

### 2.9 ⚠️ release-notes/0.9.4.md brand 替换必做（**REVIEW-2 P0 漏点**）

**上游新文件**：`apps/electron/resources/release-notes/0.9.4.md`（+25 行，英文）

**为什么这是 §3.7 改造点级别的必做项**：
- 该文件**会被 electron-builder 打包进 app**（`apps/electron/resources/release-notes/`）—— 用户启动 app 后"What's new"对话框会显示
- 上游内容**含 "Craft Agent" 字面量 1 处**（第 5 行 features 描述："Craft Agent still shows and permission-checks the original Bash command..."）
- 历史一致性：`0.9.2.md` / `0.9.3.md` 均**已 brand 替换 + 中文翻译**（grep "Craft" = 0 命中，标题已是"v0.9.3 — 移动/紧凑 UI 重构、..."）
- 不处理 = §3.5 "不暴露上游品牌"被违反

**处理方式**（沿 0.9.3.md 历史路径）：
1. merge upstream 后该文件以英文 + "Craft Agent" 字面量进入工作区
2. 立即按 v0.9.3 sync 时的方式做翻译 + brand 替换（学 0.9.3.md 风格）
3. 关键替换：
   - `Craft Agent still shows and permission-checks the original Bash command, but when RTK is installed...` → `U Agents 仍显示原 Bash 命令并按权限规则校验；当 RTK 已安装...`
   - 其他英文章节同样按 0.9.3.md 风格翻成中文
4. 单独 commit：`docs+i18n: 0.9.4.md 中文翻译 + brand 替换`

**类比工作量**：~1-2 小时（与 v0.9.3 翻译时长一致；详见 [`07-upstream-sync.md`](../07-upstream-sync.md) §2.7d）

**详见 §3.8 / §6.3**。

---

## 3. §3.7 改造点冲突逐项处理

按"路径交集"+"行号交集"双维度判定。

**预测：0 真冲突 / 0 硬冲突 / 0 软冲突**。以下逐项验证。

### 3.1 #4 auth/state.ts — **干净**（行号不重叠）

```diff
-    // OpenAI OAuth credentials are handled separately by CodexAgent
+    // OpenAI / ChatGPT OAuth credentials are handled inside PiAgent's auth path
```

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 #4 L305-306（`hasCredentials` keyless 特判：`if (!apiKey && connection.baseUrl)` + `hasCredentials = !isUApiSlug(...)`）|
| 上游动作 | L308 注释微调 |
| 行号重叠 | **无**（L305-306 vs L308）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | `grep -n "U-API:" packages/shared/src/auth/state.ts` 仍命中 1 处（L305）|

### 3.2 #1/#2/#3/#32a/#33b/#46 storage.ts — **干净**（新增位置不撞）

```diff
+  // Token optimization
+  rtkEnabled?: boolean;  // Route Bash commands through rtk ...
...
+export function getRtkEnabled(): boolean { ... }
+export function setRtkEnabled(enabled: boolean): void { ... }
```

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 多处：#1 `enforceUApiBaseUrl`（块）/ #2 model 列表保护 / #3 startup lock / #32a atomicWriteFileSync / #33b dir 0o700 / #46 `browserToolEnabled: false` |
| 上游动作 | L77-79 新增 `rtkEnabled?` 字段 + L500-525 新增 2 个 getter/setter 函数 |
| 行号重叠 | **无**（我们 marker 分布在 enforceUApiBaseUrl/startup lock/atomicWriteFileSync 等位置；上游新增的 RTK getter/setter 在 1M context getter 之后，且 StoredConfig 接口新字段在 enable1MContext 之后）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后 `grep -c "U-API:" packages/shared/src/config/storage.ts` 数量不变（保持 v0.9.3 sync 后的基线）|

### 3.3 routing.ts — **干净**（C13 未触发；v0.9.3 已删 #37）

```diff
+  // rtk — token-optimization opt-in
+  RPC_CHANNELS.rtk.GET_ENABLED,
+  RPC_CHANNELS.rtk.SET_ENABLED,
+  RPC_CHANNELS.rtk.GET_STATUS,
+  RPC_CHANNELS.rtk.GET_GAIN,
```

| 项 | 值 |
|---|---|
| 我们的 marker | **无**（v0.9.3 sync 删 #37 marker 后该文件无 U-API marker）|
| 上游动作 | L156+ 把 4 个 RTK channel 加进 `LOCAL_ONLY_CHANNELS` —— **分类正确**（RTK 是本地设置，应进 LOCAL_ONLY）|
| C13 预判 | **未触发**（不像 v0.9.1 上游漏分类那次）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后 `bun test packages/shared/src/protocol/__tests__/` 全绿 |

### 3.4 #11o / #19-#25 AiSettingsPage.tsx — **干净**（位置不重叠）

```diff
+function formatTokenCount(n: number): string { ... }       // L56-66  新增 helper
...
+const [rtkEnabled, setRtkEnabled] = useState(false)         // L624-630 新增 state
+const [rtkStatus, setRtkStatus] = useState<...>(null)
+const [rtkRechecking, setRtkRechecking] = useState(false)
+const [rtkGain, setRtkGain] = useState<...>(null)
...
+const handleRtkToggle = useCallback(...)                    // L962+ 新增 callback
+const handleRecheckRtk = useCallback(...)
+const handleGetRtk = useCallback(() => {
+  window.electronAPI?.openUrl('https://github.com/rtk-ai/rtk')
+})
+const refreshRtkGain = useCallback(...)
...
+{rtkStatus?.installed ? (                                   // L1129-1185 新增 UI block
+  <SettingsToggle label={t("settings.ai.rtk.title")} ... />
+) : (
+  <SettingsRow label={t("settings.ai.rtk.title")} ... />
+)}
```

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 #11o `'U-API Compatible'` 替换 + §3.7 #19-#25 一系列 isUApiSlug / Connection Row / Default Connection selector / Add Connection 改造 |
| 上游动作 | +112 行集中在 RTK feature scope（helper / state / init / callback / UI block）|
| 行号重叠 | **无**（我们改造点在 connection 管理逻辑域；上游新增全在 caching/performance 域，二者在 settings 页面是相邻但**独立**的 SettingsCard）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后 `grep -c "U-API" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` 数量不变 + 跑 onboarding 实测 "Default Connection" 显示仍为 `U-API Compatible` |

### 3.5 #45c pi-agent-server brand 注释 — **干净**（上游未碰）

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 #45c L1285 系统 prompt brand 注释（v0.9.2 sync 漏盘补丁）|
| 上游动作 | **未碰** `packages/pi-agent-server/src/index.ts` |
| 预期 merge | **干净** |

### 3.6 #11o pi-agent.ts `backendName = 'U-API'` 字面量 marker — **干净**（**REVIEW-2 新增**）

```diff
# L94-96 新增 RTK import
+import { getRtkPath } from './core/rtk-detector.ts';
+import { getRtkEnabled } from '../config/storage.ts';
+import type { RtkContext } from './core/rtk-rewrite.ts';

# L1149-1158 build RtkContext
+const rtkContext: RtkContext | undefined = getRtkEnabled()
+  ? { enabled: true, path: getRtkPath(), exclude: [] }
+  : undefined;

# L1173 / L1246 传 rtkContext 给 runPreToolUseChecks
+rtkContext,
```

| 项 | 值 |
|---|---|
| 我们的 marker | §3.7 #11o `backendName = 'U-API'` **字面量 marker** L122（class member 默认值）+ L1943（同字面量重复使用）|
| 上游动作 | RTK 集成添加在 L94-96 import + L1149-1158 RtkContext build + L1173/L1246 参数传入（**两处 runPreToolUseChecks 调用都接入**，是 PreToolUse 主路径 + 重试路径）|
| 行号重叠 | **无**（我们字面量在 L122 / L1943；上游 RTK 在 L94-96 / L1149-1158 / L1173 / L1246）|
| 函数重叠 | **无**（我们字面量在 class member + chat completion 调用点；上游在 PreToolUse 函数体内）|
| 预期 merge | **git 3-way auto-merge 干净通过** |
| 验证 | merge 后 `grep -n "'U-API'" packages/shared/src/agent/pi-agent.ts` 仍 2 处（L122 + L1943）|

### 3.7 其它 51 个 marker 文件 — **路径无交集，全干净**

跑下述 grep 验证（**REVIEW-2 修正：git grep `--include` 选项顺序错，改用 `--` 分隔 + 通配符 path**）：

```bash
# 所有 §3.7 marker 文件（含字面量 + 注释 marker）
git grep -lE "U-API" -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' \
  | sort -u > /tmp/our-marker-files.txt
# 当前 working tree：55 文件（含 42 注释 marker 文件 + 13 字面量-only 文件）

# v0.9.4 改的文件（merge 前预跑）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[].filename' | sort -u > /tmp/v094-changed-files.txt

# 交集 = 需手动 review 的（**REVIEW-2 实测 4 文件**）
comm -12 /tmp/our-marker-files.txt /tmp/v094-changed-files.txt
# 期望输出：
#   apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx
#   packages/shared/src/agent/pi-agent.ts
#   packages/shared/src/auth/state.ts
#   packages/shared/src/config/storage.ts
```

### 3.9 ⚠️ eslint.config.mjs Codex/Copilot 死规则手工删（**REVIEW-5 新发现**）

```diff
# 上游 v0.9.4 patch（针对 base = v0.9.3 上游版本）
@@ -173,22 +173,10 @@ export default [
             name: '@craft-agent/shared/agent/claude-agent',
             ...
           },
-          {
-            name: '@craft-agent/shared/agent/codex-agent',
-            message: 'Provider backends must stay behind @craft-agent/shared/agent/backend.',
-          },
-          {
-            name: '@craft-agent/shared/agent/copilot-agent',
-            message: 'Provider backends must stay behind @craft-agent/shared/agent/backend.',
-          },
           {
             name: '@craft-agent/shared/agent/pi-agent',
             ...
           },
-          {
-            name: '@github/copilot-sdk',
-            message: 'Use provider-agnostic model discovery/validation APIs ...',
-          },
```

| 项 | 值 |
|---|---|
| 上游动作 | 删 4 条 ESLint restricted-import 规则（Codex / Copilot agent + @github/copilot-sdk）|
| 我们 fork 现状 | M1 NPM scope rename 把 `@craft-agent` 全改 `@u-agents`，**所以本地这 4 行实际是 `@u-agents/shared/agent/codex-agent` 等** |
| 3-way merge 行为 | base→ours **改 scope**（`@craft-agent` → `@u-agents`）+ base→theirs **删行** —— git 通常 auto-merge **保 ours**（不应用 theirs 的删除）|
| 后果 | merge 后 eslint.config.mjs 会**留下 4 条 ESLint 死规则**：`@u-agents/shared/agent/codex-agent` / `@u-agents/shared/agent/copilot-agent` 等，引用目标在我们 fork 已被 04-feature-cuts 裁剪 |
| 处理动作 | merge 后**顺势手工删这 4 条 ESLint 死规则**（与上游 v0.9.4 同向） |
| 验证 | merge + 手工删后 `grep "codex-agent\|copilot-agent" apps/electron/eslint.config.mjs` 应 = 0 |
| §3.7 表影响 | **无新增 marker**（删除死代码不计入改造点）|

### 3.8 ⚠️ release-notes/0.9.4.md brand+i18n（**新增 §3.7 改造点级别必做项**）

| 项 | 值 |
|---|---|
| 触发原因 | 上游新文件 `apps/electron/resources/release-notes/0.9.4.md` 含 "Craft Agent" 字面量 1 处 |
| 影响层级 | §3.5 不暴露上游品牌（用户 "What's new" 对话框直接读这文件）|
| 历史一致性 | `release-notes/0.9.2.md` / `0.9.3.md` 都已做 brand 替换 + 中文翻译；0.9.4.md 必须同 SOP |
| 处理动作 | merge 后立即跑（详见 §6.3）：1) 整文件中文翻译 + 2) 替换 "Craft Agent" → "U Agents" + 3) 删上游 commit hash 引用（如 `(`754d254c`)`）+ 4) 单独 commit |
| 类比工作量 | 1-2 小时（与 v0.9.3 翻译时长一致）|
| §3.7 表更新建议 | 加新行：`v0.9.4 sync 期间新增 — release-notes/0.9.4.md brand+i18n（沿 0.9.3.md 历史，不计 marker 因属 01-branding-spec §1 全表）` |

> **为什么不计入 95 marker 基线**：与 v0.9.1 sync 时"webui/login.html placeholder + 3 个 release-notes brand 替换不计 marker"同 SOP——属 [`01-branding-spec.md`](../01-branding-spec.md) §1 全表，是**资源文件 brand 替换**而非**代码 marker**。

---

## 4. C 系列风险扫描（C10-C14）

| # | 模式 | 状态 | 详情 |
|---|---|---|---|
| **C10** | 上游 connection 加新字段需透传 | ✅ 未触发 | llm-connections.ts / provider-metadata.ts 全干净；`enforceUApiBaseUrl` 浅合并保字段策略仍生效（无 Connection 新字段需测）|
| **C11** | 上游新文件用 `@craft-agent/` scope | ⚠️ **触发** | diff 中 +line `@craft-agent/` 命中 **4 处**，全部在 **`packages/server-core/src/handlers/rpc/settings.ts`** 一个文件（4 个 RTK RPC handler 的 dynamic import）。详见 §6.4 sed |
| **C12** | 上游 release 自身 lint 违规 | ✅ 未触发预判 | 上游本次反而**精简** `apps/electron/eslint.config.mjs`（−16 行：删 Codex/Copilot ESLint restricted-import 规则）；不引入新 lint 违规 |
| **C13** | 上游 release 自身 test fail | ✅ 未触发预判 | 上游正确把 4 个 RTK channel 分到 `LOCAL_ONLY_CHANNELS`（routing.ts exhaustiveness test 应该自动通过）|
| **C14** | build-win.ps1 与 root chain 差距 | ✅ 未触发 | `apps/electron/scripts/build-win.ps1` 未在 v0.9.4 diff stat；事故 #3/#4/#5 修复仍生效 |

---

## 5. 新决策点（2 项，开 merge 前应当与用户对齐）

### 5.1 RTK 集成接收策略

**现状（上游）**：
- 新 feature：Settings → AI → Performance 加 "Token Optimization" 区块
- 默认 off；用户需自行 `brew install rtk` 或 [GitHub releases](https://github.com/rtk-ai/rtk) 下载 ≥0.23.0
- 装好后 UI 显 toggle + 节省统计；未装显 "Get RTK" + "Re-check" 按钮
- LLM 仍看见原 Bash 命令、权限系统仍门控原命令，**仅 SDK 实际执行被改写成 `rtk <cmd>`**

**对我们的风险评估**（详见 §2.4 风险表）：

| 维度 | 风险 |
|---|---|
| §3.1 LLM 入口锁定 | ✅ 不绕过（RTK 改 Bash tool execution，不动 LLM 请求路径）|
| §3.5 不暴露上游品牌 | ✅ 不暴露（外链 rtk-ai/rtk 是第三方项目，无 craft 字面量）|
| 隐私 | ✅ 已禁用 telemetry（`RTK_TELEMETRY_DISABLED=1` spawn env，2 处源码都有）|
| 默认开关 | ✅ opt-in（默认 off）|

**决策建议**：**全盘接收，不裁剪 UI**

**理由**：
1. opt-in feature，对当前用户群（不装 rtk 的）**完全透明**
2. 已禁用 RTK telemetry，隐私底线达标
3. 不绕过 `enforceUApiBaseUrl`，深度防御策略仍生效
4. 裁剪 = 多一个 §3.7 改造点 + 多一处未来同步成本，违反 M1 "尽量少动" 原则
5. 高级用户可受益于 60-90% 节省（按 release notes）—— 国内中转站按 token 计费，对用户**实际省钱**

**若用户决定要裁剪 UI 显示**（不推荐）：在 AiSettingsPage.tsx 加一个 `RTK_VISIBLE = false` 常量，把 SettingsToggle/SettingsRow block 包在 `{RTK_VISIBLE && (...)}` 里。新增 §3.7 改造点。

### 5.2 RTK i18n zh-Hans 文案验收（M2 i18n 阶段）

**上游 zh-Hans 翻译**（详见 §2.7）：
```json
"settings.ai.rtk.description": "通过 rtk 路由,在常见开发命令上减少 60–90% 的 token 消耗。"
```

**与我们风格不一致点**：
1. 用半角逗号 `,` 而非全角"，"
2. 英文 `tokens` 小写而非大写 `Token`
3. 数字与中文之间无空格（`60–90%` 紧贴）

**决策建议**：**M1 sync 阶段接受 theirs**（保 sync 流程简洁）；M2 i18n 风格 review 阶段统一调整

**理由**：
- v0.9.4 sync 主体目标是合代码，i18n 风格调整属于二级工作
- 我们 zh-Hans 在 v0.9.3 已经有翻译风格 review 机制，M2 一次性 sweep 比每次 sync 单独调更高效
- 若强行在 sync commit 里调整，会让"sync vs brand patch"边界模糊，未来追溯困难

**若用户决定立刻调整**：在 sync commit 后单独跑一个 i18n style polish commit：
```diff
- "通过 rtk 路由,在常见开发命令上减少 60–90% 的 token 消耗。"
+ "通过 rtk 路由，在常见开发命令上减少 60-90% 的 Token 消耗。"
```

---

## 6. merge 执行命令模板

> 以下命令**由用户/外部 AI 执行**，本仓库 AI 不跑。

### 6.0 准备分支

```bash
# 当前应该在 main 分支且 working tree clean
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git status
git log --oneline -1 main
# 期望：HEAD 在 29bbfdc7 (docs: SYNC v0.9.3 实测报告) 或更新

# 抓上游最新 + 验证版本
git fetch upstream
git log --oneline upstream/main -1
# 期望：HEAD 在 <新 commit> v0.9.4

# 创建 sync 分支
# REVIEW-5 提示：$DATE 是 shell 局部变量，开新 terminal 会失效（v0.9.3 SOP 教训）
# 推荐做法：要么从开始到结束全程同一个 terminal session，要么用 inline date 命令（见 §6.7）
DATE=$(date +%Y%m%d)
git checkout -b sync/upstream-$DATE-v094
```

### 6.1 跑 merge

```bash
git merge upstream/main
```

**预期结果**：
- ✅ 大部分文件自动合并通过
- ⚠️ **0 真冲突 + 0 硬冲突**（**预测**——实际若 git 报冲突，请回看 §3.1-3.9 验证哪里行号判断错了，更新本报告）
- ⚠️ **bun.lock 冲突几乎必然**（**REVIEW-5 新发现**）：lockfile 在我们 fork 已被 M1 改过 `@craft-agent → @u-agents`，上游 v0.9.4 改 SDK 版本号 → **手工 merge 不可行**。**推荐 SOP：直接 `git checkout --theirs bun.lock && rm bun.lock && bun install`**（让 bun 重新生成与 package.json 一致的 lockfile）；不要手工合并 lockfile
- ⚠️ **spot check 项**：merge 后立即跑 §6.5 验证三件套，特别确认：
  - `apps/electron/electron-builder.yml` 的 `win.artifactName` 仍是 `U-Agents-${arch}.${ext}`（不是上游 unchanged context 里的 `Craft-Agents-`）
  - `packages/shared/src/auth/state.ts` L305-306 我们的 §3.7 #4 marker 还在
  - `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` 我们的 #11o `'U-API Compatible'` 还在
  - `packages/shared/src/agent/pi-agent.ts` L122 + L1943 我们的 `'U-API'` 字面量还在（**REVIEW-2 新增 spot check**）
  - `apps/electron/eslint.config.mjs` 是否留下 `@u-agents/shared/agent/codex-agent` / `copilot-agent` ESLint 死规则（**REVIEW-5 新增**，按 §3.9 处理）
- ⚠️ **release-notes/0.9.4.md** 作为上游新文件进入工作区，**含 "Craft Agent" + "Codex" + "lukilabs" 字面量** —— **必须按 §6.3 处理**（不能直接 commit！）

### 6.1a 处理 bun.lock 冲突（**REVIEW-5 新增 P1**）

merge 后 `git status` 看 bun.lock 状态：

```bash
git status bun.lock
# 期望：either 'both modified' (conflict) 或 'modified by us'（无冲突但内容混合）

# 不论哪种情况，都直接重新生成 lockfile（手工合并 lockfile 几乎不可行）
git checkout --theirs bun.lock || true   # 接受上游版本作为起点
rm bun.lock                                # 清空
bun install                                # 让 bun 按 package.json 重新解析
git diff bun.lock | head -50              # 看新生成的 lockfile 是否合理
git add bun.lock                          # 加入 sync commit
```

**为什么不手工合并 bun.lock**：
- lockfile 内部 hash + 依赖 graph 顺序敏感，手工 merge 几乎必然破坏完整性
- 我们 M1 已把所有 workspace dep 从 `@craft-agent/*` 改成 `@u-agents/*`，上游 v0.9.4 改 SDK 版本号——两个改动**互不重叠**，bun install 会自然产出正确 lockfile
- `bun install` 是幂等的（package.json 不变就不改 lockfile 主体内容）

### 6.2 处理 C11 NPM scope rename（4 处）

```bash
# 先 grep 看实际触发量（merge 后跑，预期 4 处 / 1 文件）
# REVIEW-2 修正：git grep --include 选项必须放在 -- 后面或用通配符 path
git grep -lE "@craft-agent/" -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' | sort -u
# 预期命中 1 文件：
#   packages/server-core/src/handlers/rpc/settings.ts

# 该文件 4 处 @craft-agent 都在 RTK RPC handler 的 dynamic import 里
sed -i.bak "s|@craft-agent/|@u-agents/|g" packages/server-core/src/handlers/rpc/settings.ts
rm packages/server-core/src/handlers/rpc/settings.ts.bak

# 验证 = 0
git grep -E "@craft-agent/" -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' | wc -l
```

### 6.3 ⚠️ release-notes/0.9.4.md brand 替换 + 中文翻译（**REVIEW-2 P0 必做**，REVIEW-4 精化）

merge 后立即跑——这是 §3.8 章节展开的命令版：

```bash
# 1) 确认文件存在 + 是上游英文版
ls -la apps/electron/resources/release-notes/0.9.4.md
head -5 apps/electron/resources/release-notes/0.9.4.md
# 期望：第 1 行类似 "# v0.9.4 — RTK token optimization, ..."（英文）

# 2) 参照 0.9.3.md 的中文翻译风格
head -10 apps/electron/resources/release-notes/0.9.3.md
# 学习其格式：标题中文化、章节名 "新增功能 / 改进 / 缺陷修复"、品牌全部 U Agents/U-API、删上游 commit hash

# 3) 把 0.9.4.md 整体重写成中文版（手工 1-2 小时）
# 上游品牌字面量清单（REVIEW-2 + REVIEW-4 + REVIEW-5 实测扫出）：
#   a) "Craft Agent still shows..." → "U Agents 仍显示..."（**REVIEW-2 #1**）
#   b) commit hash 引用（如 (`754d254c`, `a96b8706`, `57452664`)）→ 全删
#   c) GitHub issue 链接 `[#747](https://github.com/lukilabs/craft-agents-oss/issues/747)`（**REVIEW-4 新发现**：v0.9.4 首次在 release notes 用 issue 链接模式，0.9.3.md 没有）：
#      - 推荐方案 A：整段 "Fixes [#747](...)" 直接删除（用户不关心上游 issue 跟踪）
#      - 替代方案 B：保留 issue 号去掉 URL → "（修复上游问题 #747）"
#      - 不推荐：改成自己 fork 的 issue URL（私有 fork 用户访问不到）
#   d) 标题："v0.9.4 — ..." → "v0.9.4 — RTK Token 优化、紧凑会话修复、长连接稳定性"
#      （**REVIEW-5 改进**：不直译"Codex transport stability"——我们用户接触不到 Codex 后端，
#       但底层 transport 修复对 U-API 长会话有正面影响，按"用户视角"措辞）
#   e) "Codex" / "Copilot" 字面量重写（**REVIEW-5 新发现**：上游用户可见，我们用户不可见）：
#      - "Codex long-running session instability" → "长会话连接不稳定（1011/1006/cert 错误）"
#      - "Backend packaging cleanup ... Copilot/Codex binary packaging" → "后端打包清理（Pi 整合后死代码精简）"
#      - "ChatGPT Plus / Codex OAuth sessions" → "ChatGPT Plus 长会话"（保留 ChatGPT Plus，因为 SDK 升级实际对所有 Pi 后端请求有正面影响）

# 4) 验证 brand 替换干净（**REVIEW-4 加 lukilabs / REVIEW-5 加 Codex/Copilot 验证**）
grep -Ein "Craft|craft\.do|lukilabs|Codex|Copilot" apps/electron/resources/release-notes/0.9.4.md
# 期望：0 命中（含 Codex/Copilot 字面量都需重写，因我们 04-feature-cuts 已裁这些后端）
# 例外：保留 "ChatGPT Plus" 字面量是 OK 的（OpenAI 产品名，用户可能听过，且我们仍可走 ChatGPT Plus OAuth 路径）

# 5) 单独 commit（保 sync vs brand patch 边界清晰）
git add apps/electron/resources/release-notes/0.9.4.md
git commit -m "docs+i18n: 0.9.4.md 中文翻译 + brand 替换"
```

### 6.3a 顺势删 eslint.config.mjs ESLint 死规则（**REVIEW-5 新增 P0**）

按 §3.9 详述——上游 v0.9.4 删 Codex/Copilot ESLint restricted-import 规则，但因 M1 NPM scope rename git 可能 auto-merge 保 ours 留下死规则：

```bash
# 看是否真有死规则残留（merge 后跑）
grep -nE "@u-agents/shared/agent/(codex-agent|copilot-agent)" apps/electron/eslint.config.mjs
grep -nE "@github/copilot-sdk" apps/electron/eslint.config.mjs

# 如果有命中，手工删（与上游 v0.9.4 同向）
# 用 Edit 工具或手工编辑器删 4 条 ESLint 规则
# 删完后验证 = 0
grep -cE "codex-agent|copilot-agent|@github/copilot-sdk" apps/electron/eslint.config.mjs
# 期望：0

# 确认 lint 仍 pass
bun run lint:electron
# 期望：与 v0.9.3 sync 后基线一致

# 此修改属顺势裁剪，可与 §6.3 release-notes brand commit 合并，或单独 commit:
git add apps/electron/eslint.config.mjs
git commit -m "chore: 顺势删 ESLint Codex/Copilot 死规则（v0.9.4 上游同向）"
```

### 6.4 (可选) 立即跑 i18n zh-Hans 风格 polish

仅当 §5.2 用户决定立刻调整时跑。否则跳过到 §6.5。

### 6.5 验证三件套

```bash
# typecheck
bun run typecheck:all
# 期望：全绿

# 改造点基线 grep（§3.7 标准命令）
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：95（基线，与 v0.9.3 sync 后一致）

grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 9

# 单元测试
bun test
# 期望：全绿（含 v27 SSRF 7 测试 + #46t 防回归测试 + 新的 v0.9.4 RTK 测试 if any）

# i18n parity（7 locales × 同 key 数）
bun run lint:i18n:parity
# 期望：全绿（上游 7 locales 各 +7 key 一致）

# Electron lint
bun run lint:electron
# 期望：与 v0.9.3 sync 后一致（无 v0.9.4 新增 violation）
```

### 6.6 残留 craft 字面量扫（新发现）

```bash
# 检查上游 RTK 文件是否漏盘品牌字面量
grep -rEn "Craft Agent|craft\.do" packages/shared/src/agent/core/rtk-*.ts 2>/dev/null
# 预期：0 命中（核 §6.3 brand 替换前 release-notes/0.9.4.md 会命中"Craft Agent"——之后应当 0）

# 全局 craft 字面量扫
grep -rEn --exclude-dir=node_modules --include="*.ts" --include="*.tsx" -i "craft\.agent|craftagent|craft-agent" packages apps | grep -v "U-API:" | wc -l
# 与 v0.9.3 sync 后基线对比，应当≈相同（除 4 处 settings.ts 已被 §6.2 sed 修）

# release-notes 品牌验证（REVIEW-2 P0 新增项）
grep -rEn "Craft|craft\.do" apps/electron/resources/release-notes/0.9.4.md
# 期望：0 命中（§6.3 brand 替换完成后）
```

### 6.7 commit + tag

```bash
# Sync merge commit（不含 0.9.4.md 翻译——§6.3 已单独 commit；
# 不含 eslint.config.mjs ESLint 死规则删除——§6.3a 已单独 commit）
git add -A
git commit -m "sync: merge upstream/main as of $(date +%Y%m%d) (v0.9.4)"

# Tag —— REVIEW-5 强烈推荐用 inline 替代 $DATE（防开新 terminal 后 $DATE 失效推空 tag "sync-"）
git tag sync-$(date +%Y%m%d)
# 替代：若一直在同 terminal 跑 §6.0 - §6.7 也可用 git tag sync-$DATE
```

**$DATE 陷阱回顾**（v0.9.3 sync SOP 教训）：
- $DATE 是 shell **局部变量**——开新 terminal / 新 SSH session 后 $DATE 为空字符串
- 此时 `git tag sync-$DATE` 会推空 tag `sync-` 触发 git 错误，或更糟的是创建无意义 tag
- 推荐做法：要么从 §6.0 到 §6.7 全程同一 terminal session，要么所有用到 `$DATE` 的地方都改成 `$(date +%Y%m%d)` inline

---

## 7. merge 前 / 中 / 后 checklist

### 7.1 merge 前（user/外部 AI 跑）

- [ ] `git status` clean
- [ ] `git fetch upstream` 成功
- [ ] `git log --oneline upstream/main -1` = v0.9.4 commit
- [ ] 当前在 `main` 分支
- [ ] 已读本报告 §3 - §5 全部决策点
- [ ] 与用户确认 §5.1（RTK 全盘接收）+ §5.2（i18n M1 接受 / M2 polish）
- [ ] 已 `git checkout -b sync/upstream-YYYYMMDD-v094`

### 7.2 merge 中

- [ ] `git merge upstream/main` 跑通（**预期 0 真冲突**——bun.lock 可能标 conflict，按 §6.1a 处理）
- [ ] 若有冲突：回看 §3 哪个改造点判断错了，更新本报告 + 处理
- [ ] **bun.lock 重建**（§6.1a，REVIEW-5 新增 P1）
- [ ] electron-builder.yml spot check（win.artifactName 仍 `U-Agents-`）
- [ ] auth/state.ts spot check（L305-306 #4 marker 仍在）
- [ ] AiSettingsPage.tsx spot check（`U-API Compatible` 文案仍在）
- [ ] storage.ts spot check（无我们 marker 被吞）
- [ ] pi-agent.ts spot check（L122 + L1943 `'U-API'` 字面量仍在；**REVIEW-2 新增**）
- [ ] **eslint.config.mjs spot check**（如有 `@u-agents/.../codex-agent` / `copilot-agent` / `@github/copilot-sdk` 死规则，按 §3.9 + §6.3a 手工删；**REVIEW-5 新增 P0**）

### 7.3 merge 后

- [ ] C11 sed rename（§6.2，1 文件 4 处）
- [ ] **release-notes/0.9.4.md brand 替换 + 中文翻译**（§6.3，沿 0.9.3.md 历史路径；**REVIEW-2 P0 必做**，1-2 小时手工 + 单独 commit）
- [ ] 验证三件套（§6.5）：typecheck / 基线 grep / bun test / i18n parity / lint:electron
- [ ] 残留 craft 字面量 grep（§6.6）—— 包含 release-notes/0.9.4.md 验证 0 命中
- [ ] **更新 [`CLAUDE.md`](../../CLAUDE.md) §3.7**：
  - 改造点表**无增减**（代码 marker 维度，预测）
  - 历次演进表加一行：`v0.9.4 sync（2026-05-DD commit <hash>）：95 处不变（无新增代码改造 marker；上游 RTK 集成 +112 AiSettings / +148 rtk-detector / +86 rtk-rewrite 全在 RTK feature scope，不撞我们任何 marker；C11 触发 1 文件 4 处 settings.ts RTK RPC dynamic import 已修；release-notes/0.9.4.md 单独做 brand+i18n，不计 marker，沿 0.9.3.md 历史）`
- [ ] **更新 [`07-upstream-sync.md`](../07-upstream-sync.md)**：基线刷新（如有需要）
- [ ] 写一份 `.planning/sync-reports/SYNC-v0.9.4-YYYYMMDD.md` 记录实际 merge 流程（与本预测报告对比）
- [ ] **commit**：`docs: SYNC v0.9.4 报告 + §3.7 历次演进表加 v0.9.4 行`

---

## 8. 实测验收清单（用户跑）

按 [`09-test-checklist.md`](../09-test-checklist.md) 全量跑，重点关注：

### 8.1 onboarding 流程（首装 U-API）
- [ ] 启动 app
- [ ] onboarding 走通：输 Token → 选 Anthropic Messages（或 OpenAI Chat Completions）→ 进首屏
- [ ] AiSettingsPage 上"Default Connection"显示为 `U-API Compatible`（不是 `'Craft Agents Backend Compatible'`）

### 8.2 对话路径
- [ ] 发第一条消息走通
- [ ] 桌面通知字面量仍为 `U Agents has a new message for you`（§3.7 #11l）

### 8.3 RTK feature 验收（新增）
- [ ] **未装 rtk 时**：Settings → AI → Performance 显 "Token Optimization" 区块 + "Get RTK" + "Re-check" 两个按钮 + 描述文案中文化
- [ ] 点 "Get RTK" 打开浏览器到 `https://github.com/rtk-ai/rtk`（外链是开源项目，不撞品牌）
- [ ] 点 "Re-check" 触发重新检测（loading 状态）
- [ ] **装 rtk 后**（可选 advanced test）：toggle 显出来，开启后 spawn rtk rewrite 走通，gain 统计能拉到

### 8.4 Skills "Show in Finder"（修复回归测试）
- [ ] 进任何一个 skill 详情页 → 点 "Show in Finder" → 真打开 `skill.path` 目录
- [ ] 同样在 SkillsListPanel 右键菜单/SkillMenu 试一次
- [ ] 失败场景测试（移除 skill 目录后点）→ 显 toast 不再静默 fail

### 8.5 Compact 模式（修复回归测试）
- [ ] 把窗口拉到 < 768px 宽 —— 切 mobile/compact 布局
- [ ] 在 mobile 模式下，点 chat 标题菜单 —— Status/Labels/Share/Messaging 显 vaul drawer 而非 nested dropdown
- [ ] **rapid taps**：连续快速点 label 添加/移除 —— 无 race condition（不出现"切回切去"）
- [ ] 切 session 时如果 drawer 还开着 —— 自动 close 不残留

### 8.6 §3.5 不暴露上游品牌
- [ ] 关于页 / About panel 仅显示 U Agents / U Studio（§3.7 #28）
- [ ] 错误对话框无 craft 字面量
- [ ] 系统 prompt 仍是 U Agents（§3.7 #11h）

### 8.7 D-β 分发实测
- [ ] macOS arm64：`bun run electron:dist:adhoc:mac` 出 DMG → 实测装包对话走通
- [ ] Windows x64：用户机/VM 跑 `apps/electron/scripts/build-win.ps1` → 出 EXE → 实测装包对话走通
- [ ] R2 上传按 [`06-update-server.md`](../06-update-server.md) §4.2 SOP

---

## 9. 风险评估与后续动作

### 9.1 风险等级：**极低**

| 风险源 | 等级 | 缓解 |
|---|---|---|
| §3.3 真冲突 | **无** | 0 真冲突 |
| §3.7 真冲突 | **无** | 0 真冲突（这是 fork 历史首次）|
| §3.7 软冲突 | **无** | 0 软冲突 |
| C11 sed rename | **极低** | 1 文件 4 处，命令已枚举 |
| Mobile UI 引入回归 | **低** | 仅紧凑布局菜单/标签修复，桌面默认无感 |
| RTK 用户困惑 | **极低** | opt-in 默认 off；未装 rtk 时仅显 install 提示（不破坏认知）|
| ChatGPT Plus / Codex OAuth fix | **无** | 我们锁了 baseUrl 不走这路径，对我们透明 |

### 9.2 触发的 backlog

**v0.9.4 自身不引入新 backlog**——不涉及 M3 SSRF / OAuth / TLS 范围扩张，且与我们 04-feature-cuts 八类裁剪同向。

**但 REVIEW-3 暴露 1 个顺手 follow-up 机会**：

| backlog 项 | 触发原因 | 紧急度 |
|---|---|---|
| **删 root package.json `@github/copilot-sdk` dep** | REVIEW-3 P0 发现：上游 v0.9.4 "Codex/Copilot 死代码清理"漏删此 dep；我们 fork 也从未删过（M1 04-feature-cuts 只清 UI + runtime path，未触 root deps）。bun install 仍会拉这个 12MB 包到 node_modules 浪费 | **低**（不影响功能，仅多占 disk + bun.lock 噪声）|
| **PRODUCT.md 加 RTK opt-in feature 一行** | REVIEW-4 验证项 #17：RTK 是 v0.9.4 新引入的 opt-in token 压缩功能，PRODUCT.md 功能清单需加一行说明（用户自行装 `rtk` CLI ≥0.23.0，默认 off，Settings → AI → Performance 启用，60-90% Bash 输出 token 节省）| **低**（不阻塞 sync；M2 文档维护一起做）|
| **LEGAL.md 加 RTK 隐私姿态说明（可选）** | REVIEW-4 验证项 #17：RTK 严格说不是我们的依赖（用户自行装），但**默认禁用 RTK telemetry**（`RTK_TELEMETRY_DISABLED=1` spawn env）这个安全姿态值得在 LEGAL.md 写一句，给国内合规用户参考 | **极低**（仅文档完整性）|

**处理建议**：v0.9.4 sync **完成后**单独跑：

```bash
# 删 root dep
# （由用户/外部 AI 跑，本仓库 AI 只产出此命令）
bun remove @github/copilot-sdk
git diff package.json bun.lock        # 应看到 @github/copilot-sdk 行被删 + bun.lock 减少 ~100 行
bun run typecheck:all                  # 期望全绿（如有引用会立即暴露）
bun test                                # 期望全绿
git commit -m "chore: 删 unused @github/copilot-sdk dep (与 04-feature-cuts 一致)"
```

**风险**：若有任何代码仍 `import '@github/copilot-sdk'`，typecheck 会立即 fail。grep 验证：
```bash
grep -rEn "@github/copilot-sdk" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null
# 期望：0 命中（如有命中先删 import 再删 dep）
```

### 9.3 跨 sync 对比

| 维度 | v0.9.1 sync | v0.9.2 sync | v0.9.3 sync | **v0.9.4 sync（预测）** |
|---|---|---|---|---|
| 文件数 | ~70 | ~38 | 134 | **73** |
| diff 规模 | 较大 | 较小 | +7641 / −1248 | **+698 / −202**（**最小**）|
| §3.3 真冲突 | 2 | 0 | 0 | **0** |
| §3.7 真冲突 | 1（v17 漏盘）| 0 | 1（AiSettings manifest）| **0**（**fork 首次**）|
| §3.7 硬冲突自动过期 | 0 | 0 | 1（routing.ts #37）| **0** |
| §3.7 软冲突 spot check | 1 | 0 | 3 | **0** |
| C11 触发 | 12 文件 20 处 | 1 文件 2 处 | 6 文件 9 处 | **1 文件 4 处** |
| C12 lint 违规 | 3 处 | 0 | 0 | **0** |
| C13 test fail | 1（routing）| 0 | 0（反而修了 v0.9.1）| **0** |
| release-notes brand 替换 | 3 文件（漏盘补丁）| 1 文件（0.9.2.md）| 1 文件（0.9.3.md）| **1 文件（0.9.4.md）— §6.3 单独 commit** |
| 新 spec | M3-SSRF-CONSOLIDATION | 0 | 0 | **0** |
| 评级 | A− | A−（macOS x64 deferred）| A | **预测 A**（最干净 — 0 代码冲突，但仍需 1-2h brand 翻译）|

**v0.9.4 是 fork 历史上最干净的 sync** —— 上游"两后端架构（Claude + Pi）"收敛 + 我们的 04-feature-cuts 八类裁剪**同向收敛**，未来同步成本会持续下降。

---

## 10. 完成后报告归档

merge 完成后，本预测报告应当：
- **保留** 在 `.planning/sync-reports/` 作为预测 vs 实际对比的参考
- 同时写一份 `.planning/sync-reports/SYNC-v0.9.4-YYYYMMDD.md` 记录实际流程
- 实际报告里至少含：
  - 实际触发的 C11 文件清单（预测 1 文件 / 实际？）
  - 实际 §3.7 marker 数（预测 95 / 实际？）
  - 实测装包结果（macOS arm64 + Windows x64）
  - 与本预测报告的差异点

---

## 附录 A — 关键数据来源命令清单

> 所有命令均为只读，本仓库 AI 跑过（详见报告生成过程）。

```bash
# 上游 release 元数据
gh api repos/lukilabs/craft-agents-oss/releases/tags/v0.9.4 --jq '{tag_name, name, published_at, prerelease, body}'

# v0.9.3 → v0.9.4 compare 汇总
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '{total_commits, ahead_by, behind_by, files_count: (.files | length),
         additions: ([.files[].additions] | add), deletions: ([.files[].deletions] | add)}'

# 文件清单
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "\(.filename) \(.status) +\(.additions) -\(.deletions)"'

# C11 真触发数（仅 +line）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | .patch' | grep -c '^+.*@craft-agent/'

# C11 按文件聚合
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "=== \(.filename) ===\n\(.patch)"' \
  | awk '/^=== /{file=$0} /^\+[^+].*@craft-agent\//{print file" :: "$0}'

# 特定文件 patch（spot check 用）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | select(.filename == "<path>") | .patch'

# §3.7 marker 文件 × v0.9.4 改文件 交集
# REVIEW-2 修正：git grep --include 选项放在非选项参数之后会报错，
# 必须用 -- 分隔 + 通配符 path 语法
git grep -lE "U-API" -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' | sort -u > /tmp/m.txt
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 --jq '.files[].filename' | sort -u > /tmp/v.txt
comm -12 /tmp/m.txt /tmp/v.txt
# 实测交集：4 个文件
#   apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx  (注释 marker)
#   packages/shared/src/agent/pi-agent.ts                          (字面量 marker：'U-API' L122/L1943)
#   packages/shared/src/auth/state.ts                              (注释 marker)
#   packages/shared/src/config/storage.ts                          (注释 marker)

# 仅注释 marker 文件交集（更窄）
git grep -lE "(//|/\*|\{/\*|<!--)[[:space:]]*U-API" -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx' \
  | sort -u > /tmp/m-comment.txt
comm -12 /tmp/m-comment.txt /tmp/v.txt
# 实测：3 个文件（AiSettingsPage.tsx / state.ts / storage.ts）—— pi-agent.ts 是字面量 marker，不在此交集

# 验证基线 95 marker 行（含全部注释格式）
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 当前 working tree：95（v0.9.3 sync 后基线）
```

---

## 附录 B — REVIEW-2 修订记录（2026-05-20）

> 本报告初版（同日早些时候写入）后做了一轮整体 review，发现 **2 个 P0 事实漏点 + 3 个 P1 数据精度问题 + 2 个工具命令错误**。本节记录修订前后差异，便于复盘 + 未来 sync 时同向避坑。

### B.1 P0 事实漏点（2 处，已 Edit 修正）

| # | 位置 | 初版（错）| 修订后（对）|
|---|---|---|---|
| 1 | §2.8 其它清单 | `release-notes/0.9.4.md` 新增 +25"**对我们透明**" | **完全错** — 该文件被打包进 app "What's new"对话框，含 "Craft Agent" 字面量 1 处，违反 §3.5 不暴露上游品牌。新增 §2.9 + §3.8 子章节专门处理，merge 后必须沿 0.9.3.md 历史路径做 brand 替换 + 中文翻译 + 单独 commit |
| 2 | §2.2 交集表 / §3 各子章节 | "5 文件交集 + 0 冲突"（含 routing.ts / channels.ts 这两个**无 U-API marker** 的文件）| **实测 4 文件**（3 个注释 marker 文件 + 1 个字面量 marker 文件 pi-agent.ts L122/L1943）；routing.ts / channels.ts 移到"未在交集但也改了"表（自动通过 merge）|

### B.2 P1 数据精度问题（3 处，已 Edit 修正）

| # | 位置 | 初版 | 修订后 |
|---|---|---|---|
| 3 | §2.3 Codex/Copilot 死代码清理 | 列了 5 文件 | 实际 9 文件：补漏 `base-agent.ts +5 −7`（注释清理）+ `pi-agent.ts` 部分注释清理（与 RTK 集成共存于同 patch）|
| 4 | §2.4 RTK 集成 | 列了 claude-agent.ts +12 行 | 补漏 **pi-agent.ts +15 行**（L94-96 import + L1149-1158 build RtkContext + L1173/L1246 传 rtkContext —— **PreToolUse 主路径 + 重试路径**），且明确 `handleGetRtk` 用的 `openUrl` 是**已存在的 IPC**（types.ts +6 只加 4 个 RTK 方法，不含 openUrl）|
| 5 | §0 TL;DR | 缺"§3.7 改造点交集文件"汇总 + 缺"新增改造点"行 | 加 2 行：交集 4 文件 / release-notes/0.9.4.md 是新增必做项 |

### B.3 工具命令错误（2 处，已 Edit 修正）

| # | 位置 | 初版（命令跑会报错）| 修订后 |
|---|---|---|---|
| 6 | §6.2 / §6.6 grep 命令 | `git grep -lE "..." packages apps --include="*.ts" --include="*.tsx"` | `git grep -lE "..." -- 'packages/*.ts' 'packages/*.tsx' 'apps/*.ts' 'apps/*.tsx'` —— git grep 要求 `--include` 必须放在选项区，与非选项参数（path）混用会报 `fatal: option '--include=*.ts' must come before non-option arguments` |
| 7 | §6.6 craft 字面量扫 grep | `"Craft Agent\|craft\\.do"`（带反斜杠转义）| 改成 `"Craft Agent\|craft\.do"`（标准 BRE）|

### B.4 review 用到的关键命令

```bash
# 列 v0.9.4 patch 里所有 +line @craft-agent 触发位置
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "=== \(.filename) ===\n\(.patch)"' \
  | awk '/^=== /{file=$0} /^\+[^+].*@craft-agent\//{print file" :: "$0}'

# 列 v0.9.4 patch 里所有 +line craft 字面量（**P0 漏点 #1 暴露关键**）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "=== \(.filename) ===\n\(.patch)"' \
  | awk '/^=== /{file=$0} /^\+[^+]/ && /[Cc]raft|craft\.do/ {print file" :: "$0}'
# 命中 release-notes/0.9.4.md 3 处（含 "Craft Agent" 字面量 + 2 处 issue URL 上游仓库引用）

# pi-agent.ts 当前 U-API 位置（**P0 漏点 #2 暴露关键**）
grep -n "U-API\|isUApi" packages/shared/src/agent/pi-agent.ts
# 命中：L29 import isUApiSlug / L122 backendName / L1943 同字面量

# 历史 release-notes 是否做过 brand 替换
grep -c "Craft\|craft" apps/electron/resources/release-notes/0.9.{2,3}.md
# 期望：均 0（证实历史 SOP）
```

### B.5 review 经验沉淀（写进 §07-upstream-sync.md SOP）

- **资源文件 brand 替换是 sync 必做项**：sync 报告里不能只盯 `.ts/.tsx`，必须**显式扫 `apps/electron/resources/release-notes/X.Y.Z.md`** 是否上游新文件 + 含 craft 字面量。这是 §3.5 "不暴露上游品牌"的低频但**高曝光面**漏盘点（每个用户启动 app 看 "What's new" 都会读这文件）
- **comm -12 交集要分两层做**：(a) 含字面量 marker 的所有 marker 文件 grep（55 个）vs (b) 仅注释 marker 文件 grep（42 个）—— 二者的差集（含 pi-agent.ts 这类）也是真实改造点，但常被遗漏
- **`git grep --include=...` 必须在选项区**：与 `path` 参数混用会报错；正确语法是 `git grep -lE "<pattern>" -- '<glob1>' '<glob2>'` 或 `git grep -lE "<pattern>" -- 'path/*.ts'`
- **release notes 描述 ≠ 代码现状（**v0.9.3 教训复用**）**：v0.9.4 release notes 说 "Craft Agent still shows..."，我们一定要扫**真实 release-notes/0.9.4.md 文件**而不是只读 GitHub release 页 markdown

---

## 附录 B 续 — REVIEW-3 修订记录（同日，REVIEW-2 之后）

> REVIEW-2 修完后用户要求"再 review 一轮"。这一轮抓到了 **2 个 P0 数据漏点 + 1 个 P1 数据精度 + 1 个 backlog follow-up 机会**。本节记录修订前后差异。

### B6. P0 数据漏点（2 处，已 Edit 修正）

| # | 位置 | 初版（错）| REVIEW-3 修订后（对）|
|---|---|---|---|
| 8 | §2.6 SDK 升级 | "`@mariozechner/pi-ai` SDK **0.73.0 → 0.73.1**" | **实际是 0.72.1 → 0.73.1**（跨小版本升级，比 patch 版本升级风险大）；且**3 个 Pi dep 一起升**（pi-coding-agent + pi-agent-core + pi-ai），不只 pi-ai 一个 |
| 9 | §2.6 SDK 升级 / §9.2 backlog | 未提"root package.json 残留 `@github/copilot-sdk` dep" | 本地 `grep "@github/copilot-sdk" package.json` 仍命中 1 处 unchanged context line；上游 v0.9.4 "Codex/Copilot 死代码清理"漏删此 dep，我们 fork 也从未删过。新增 §9.2 backlog 表 + `bun remove @github/copilot-sdk` follow-up 命令 |

### B7. P1 数据精度（1 处，已 Edit 修正）

| # | 位置 | 初版（不准）| REVIEW-3 修订后 |
|---|---|---|---|
| 10 | §2.8 22 测试文件 | "导入路径调整,无新断言" | **抽样验证（event-queue.test.ts）显示真改的是 docblock 注释清理**——把"Used by CodexAgent and CopilotAgent"改成"Used by PiAgent ... subprocess"，属上游"Backend packaging cleanup ... docblocks"主题。不影响测试逻辑 |

### B8. REVIEW-3 用到的关键命令

```bash
# pi-agent-server SDK dep 版本（暴露 P0 漏点 #8）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | select(.filename == "packages/pi-agent-server/package.json") | .patch'
# 实测：3 个 @mariozechner/pi-* dep 0.72.1 → 0.73.1

# 检查残留 @github/copilot-sdk dep（暴露 P0 漏点 #9）
grep -E "\"@github/copilot-sdk\"|\"name\"" package.json | head -10
# 实测命中：本地 root package.json 仍含 "@github/copilot-sdk": "^0.1.23"

# routing.ts exhaustiveness test 存在性确认
find packages/shared/src/protocol -name "*.test.ts"
# 实测：packages/shared/src/protocol/__tests__/routing.test.ts 存在

# 抽样测试文件 +1 −1 真改什么（暴露 P1 #10）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | select(.filename | endswith("/event-queue.test.ts")) | .patch'
# 实测：docblock 注释清理（删 CodexAgent/CopilotAgent 提及）
```

### B9. REVIEW-3 经验沉淀

- **跨小版本 SDK 升级（0.72 → 0.73）风险高于 patch 升级**：sync 报告须**精确到 from-version**，不能笼统说"0.73.x → 0.73.1"。Pi SDK 这次 0.72.1 → 0.73.1 跨了一个 minor，变更面比 patch 升级广（**REVIEW-4 修正**：实际很可能 backwards compatible，措辞改"变更面更广"而非"breaking 风险显著高"）
- **package.json 升级要数全部受影响 dep**：不是只看 root package.json 或单一 pi-ai 的版本号；应跑 `gh api ... --jq '.files[] | select(.filename | endswith("package.json")) | .patch' | grep "@mariozechner"` 统计所有 Pi dep 升级
- **抽样测试文件验证 +1 −1 真改的是什么**：22 个测试都改 "+1 −1" 是 squash release 模式的副作用——可能是 import path / 也可能是 docblock —— 不可凭文件数推测内容
- **`@github/copilot-sdk` 残留 dep 是 04-feature-cuts 长期 backlog**：每次 sync 时顺手扫一下 `grep "@github/copilot-sdk" package.json` 提醒用户

---

## 附录 B 续 (2) — REVIEW-4 修订记录（同日，REVIEW-3 之后）

> REVIEW-3 修完后用户要求"继续第四轮 review"。这一轮深入挖**还没系统性核对的边缘风险**——上游品牌字面量 (lukilabs)、exhaustiveness test 真实逻辑、small patch 实际内容、SDK breaking risk 措辞、release-notes issue 链接历史处理。抓到 **1 个 P0 + 1 个 P1 + 4 个验证项**。

### B10. P0 漏点（1 处，已 Edit 修正）

| # | 位置 | REVIEW-3 后（错/缺）| REVIEW-4 修订 |
|---|---|---|---|
| 11 | §6.3 / §6.6 brand 替换 grep | 只扫 `Craft\|craft\.do` | **加 `lukilabs` 进 grep pattern**——release-notes/0.9.4.md 含 lukilabs 字面量 2 处（issue 链接 URL `github.com/lukilabs/craft-agents-oss/issues/X`）。lukilabs 是上游 GitHub org 名，属 §3.5 不暴露上游品牌范围。grep 命令改成 `grep -Ein "Craft\|craft\.do\|lukilabs"`，§6.3 SOP 加入对 lukilabs 处理的 3 种方案（推荐方案 A 删整段 Fixes 引用）|

### B11. P1 数据精度（1 处，已 Edit 修正）

| # | 位置 | REVIEW-3 后 | REVIEW-4 修订 |
|---|---|---|---|
| 12 | §2.3 factory.ts 分类 | "纯重排/简化" | **不是"纯重排"** —— 实际是 docblock 注释清理（L122-127 demo 改 Codex→Pi / L190-192 删 Codex vendor root / L243-246 'openai'→'pi'）。归入 §2.3 同 Codex/Copilot 清理主题更准确 |
| 13 | §2.6 / 附录 B9 SDK 升级措辞 | "跨小版本（0.72 → 0.73）升级 **breaking 风险显著高**" | **过严** —— v0.9.4 release notes 显示 Pi SDK 改的是 WebSocket→SSE fallback + cached session shutdown，属 **transport layer fix**，对调用者 API surface 应透明。措辞改"变更面更广，但很可能 backwards compatible 的 bug fix —— 仍需全套验证" |

### B12. 验证项（4 处，未发现问题）

| # | 验证内容 | 实测结果 | 报告判断 |
|---|---|---|---|
| 14 | **routing.ts exhaustiveness test 真实逻辑** —— 4 个 RTK channel 仅加 LOCAL_ONLY 够吗？| 读 [`routing.test.ts:8-20`](../../packages/shared/src/protocol/__tests__/routing.test.ts)：测试期望每个 channel 在 `LOCAL_ONLY ∪ REMOTE_ELIGIBLE`（**不要求镜像**，仅要求互斥且覆盖）；上游加 LOCAL_ONLY 就满足 | ✅ **C13 真未触发** |
| 15 | **0.9.3.md 是否有 `Fixes [#X](...)` 历史范例** | `grep "Fixes \[#" 0.9.3.md` 命中 0 | ❌ **0.9.4 首次引入此模式**，§6.3 SOP 必须给明确处理建议（REVIEW-4 加 3 种方案）|
| 16 | **electron-builder.yml win.artifactName** spot check 真实需要 | patch 显示 unchanged context 含 `Craft-Agents-${arch}.${ext}` 我们 fork 已改 `U-Agents-${arch}.${ext}` | ✅ **git 3-way merge 自动保 ours**，spot check 仍要做 |
| 17 | **PRODUCT.md / LEGAL.md** 是否需因 RTK 引入而更新 | RTK 是用户自行装的本地 CLI（不内嵌打包），从严格意义上**不是我们的依赖**；但 PRODUCT.md 功能清单应加一行说明 opt-in feature | 📋 加 §9.2 backlog（**不阻塞 sync**）|

### B13. REVIEW-4 用到的关键命令

```bash
# 扫上游 +line 含 lukilabs 字面量（暴露 P0 #11）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "=== \(.filename) ===\n\(.patch)"' \
  | awk '/^=== /{file=$0} /^\+[^+]/ && /lukilabs/ {print file" :: "$0}'
# 实测：2 处 lukilabs 在 release-notes/0.9.4.md issue URL

# routing.test.ts 真实逻辑（暴露验证项 #14）
cat packages/shared/src/protocol/__tests__/routing.test.ts | head -50

# factory.ts 真实 diff（暴露 P1 #12）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | select(.filename == "packages/shared/src/agent/backend/factory.ts") | .patch'

# 0.9.3.md 是否有 issue 链接历史范例（暴露验证项 #15）
grep -E "Fixes \[#|issues/" apps/electron/resources/release-notes/0.9.3.md
# 实测：命中 0，0.9.4 是首次引入此模式
```

### B14. REVIEW-4 经验沉淀

- **品牌字面量扫不能只盯 "Craft" 关键词**：上游 GitHub URL 引用会带 `lukilabs/craft-agents-oss` org+repo 双层品牌。release notes 翻译时必须扫 **三件套**：`Craft|craft\.do|lukilabs`
- **释义 release notes 写法第一次出现时要写 SOP**：v0.9.4 首次在 release notes 用 `Fixes [#X](...)` 模式（之前 v0.9.0-v0.9.3 都没用）。新模式必须在 sync preview 报告里给出**多个翻译方案** + 推荐方案，而不是模糊说"删 issue 链接"
- **exhaustiveness test 实读源码不要靠注释**：测试注释 `// An exhaustiveness test ensures new channels fail CI until classified` 可能过简——必须读 test 体确认是 "exactly once" 还是 "at least once"（这次是 exactly once）
- **SDK 版本变更措辞要谨慎**：跨小版本不等于 breaking，跨大版本不等于 catastrophe。措辞应基于 release notes 的 **change scope**（transport layer / API surface / data model）而非 semver 字面

---

## 附录 B 续 (3) — REVIEW-5 修订记录（同日，REVIEW-4 之后）

> REVIEW-4 修完后用户要求"第五轮在看看"。这一轮聚焦 **没系统核对的细节漏点**：报告内部一致性 + 3-way merge 真实行为 + SOP 工具陷阱。抓到 **1 个 P0 真实潜在冲突 + 2 个 P1 SOP 缺陷 + 1 个 P2 SOP 陷阱**。

### B15. P0 真实潜在冲突（1 处，已 Edit 修正）

| # | 位置 | REVIEW-4 后（漏）| REVIEW-5 修订 |
|---|---|---|---|
| 18 | §2.1 / §3 / §6 全部章节 | 未识别 `apps/electron/eslint.config.mjs` 为隐式冲突点 | **REVIEW-5 P0**：上游 v0.9.4 删 4 行 ESLint restricted-import 规则（`@craft-agent/shared/agent/codex-agent` 等），但 M1 NPM scope rename 已把这些行改成 `@u-agents/...`。**base→ours 改 + base→theirs 删** 的 3-way merge 场景，git 通常 auto-merge **保 ours**（留下 4 条死规则）。新增 §3.9 + §6.3a 章节专门处理 + §2.1 表加预警 |

### B16. P1 SOP 缺陷（2 处，已 Edit 修正）

| # | 位置 | REVIEW-4 后 | REVIEW-5 修订 |
|---|---|---|---|
| 19 | §2.6 / §6.x bun.lock 处理 | 模糊说 "bun.lock +32 −36 全部接受 theirs" | **REVIEW-5 P1**：lockfile 在我们 fork 已被 M1 改过 `@craft-agent → @u-agents`，上游 v0.9.4 改 SDK 版本号——**手工 merge 不可行**。新增 §6.1a 明确 SOP：`git checkout --theirs bun.lock && rm bun.lock && bun install` 让 bun 按 package.json 重新生成 |
| 20 | §6.3 release-notes brand 替换 | grep 只扫 `Craft\|craft\.do\|lukilabs` | **REVIEW-5 P1**：上游 release-notes/0.9.4.md 含 **~6 处 "Codex" + 2 处 "Copilot"** 字面量。这些不是上游 fork 品牌，但与我们 04-feature-cuts 裁剪策略不一致（用户看不到 Codex/Copilot 后端但 release notes 说"升级了 Codex transport"）。grep 加 `Codex\|Copilot`，§6.3 SOP 加 e) 子项给具体重写示例（保留 "ChatGPT Plus" 字面量是 OK 的）|

### B17. P2 SOP 陷阱（1 处，已 Edit 修正）

| # | 位置 | REVIEW-4 后 | REVIEW-5 修订 |
|---|---|---|---|
| 21 | §6.0 / §6.7 `$DATE` shell 变量 | 直接用 `$DATE` 无预警 | **REVIEW-5 P2**：v0.9.3 sync SOP 已踩过此坑（`$DATE` 在新 terminal session 失效会推空 tag `sync-`）。§6.0 加 inline 替代提示 + §6.7 改用 `git tag sync-$(date +%Y%m%d)` inline 命令 + 加"$DATE 陷阱回顾"小节复盘原因 |

### B18. 验证项（1 处，无问题）

| # | 验证内容 | 实测结果 | 报告判断 |
|---|---|---|---|
| 22 | **§3.7 #30 HTML 注释 marker (`<!-- U-API:`)** 是否在 §6.5 基线 grep 覆盖范围 | `packages/shared/src/auth/callback-page.ts:46` 是 .ts 文件里嵌入的 HTML 字符串，`grep --include="*.ts"` 已覆盖 | ✅ **覆盖到位**，95 基线含此 marker |

### B19. REVIEW-5 用到的关键命令

```bash
# 扫上游 +line 所有小写品牌字面量（暴露 P1 #20）
gh api repos/lukilabs/craft-agents-oss/compare/v0.9.3...v0.9.4 \
  --jq '.files[] | "=== \(.filename) ===\n\(.patch)"' \
  | awk '/^=== /{file=$0} /^\+[^+]/ && /[Cc]odex|[Cc]opilot|pi-ai|mariozechner/ {print file" :: "$0}'
# 实测 30+ 处含 Codex/Copilot/mariozechner/pi-ai 的 +line

# 看本地 eslint.config.mjs 是否已 NPM scope rename（暴露 P0 #18）
grep -nE "@u-agents/shared/agent/(claude|codex|copilot|pi)-agent" apps/electron/eslint.config.mjs

# 看本地 fork 是否真把 base 的 @craft-agent 改成 @u-agents
grep -nE "@craft-agent" apps/electron/eslint.config.mjs
# 实测 = 0（确认 M1 NPM scope rename 已完成）
```

### B20. REVIEW-5 经验沉淀

- **`base→ours 改 + base→theirs 删` 3-way merge 是隐式冲突的高发场景**：git 默认保 ours（不应用 theirs 的删除），导致死代码留在 fork。每次 sync 都需要扫一遍上游"删行"对应的本地"改行"——这种场景在 NPM scope rename + 上游裁剪并发时**几乎必然出现**
- **bun.lock 不可手工 merge**：lockfile 是生成文件，每次 sync 都要 `rm && bun install` 重新生成。手工合并 lockfile 几乎必然破坏完整性
- **release-notes 品牌替换不止上游 fork 品牌**：除了 craft/lukilabs，**与裁剪策略不一致的 OpenAI/Codex/Copilot 等第三方产品名也要按"用户视角"重写**——用户看不到这些后端，release notes 提"升级 Codex"会引起困惑
- **`$DATE` shell 变量陷阱要在 SOP 顶部明确警告**：v0.9.3 sync 已经踩过这坑，v0.9.4 SOP 还是默认 `$DATE` 写法——SOP 必须显式给 inline 替代或加警告框

---

## 附录 C — 本报告生成方法

**与 v0.9.3 PREVIEW 报告（生成于 fetch 之后）不同**，本报告**完全在 `git fetch upstream` 之前**生成，所有上游数据通过 `gh api` 只读获取：

| 数据维度 | 数据源 |
|---|---|
| release 元数据（tag/date/body）| `gh api repos/.../releases/tags/v0.9.4` |
| 文件清单 + diff stat | `gh api repos/.../compare/v0.9.3...v0.9.4` |
| 单文件 patch | 上述 compare API 的 `files[].patch` |
| 本地 marker 位置 | `grep` 本地 working tree（v0.9.3 sync 后状态）|

**优势**：
- 用户在 fetch 之前就能拿到完整预案
- 不污染本地 git 状态
- 严格符合 [`CLAUDE.md`](../../CLAUDE.md) §0 + §4（本仓库 AI 不跑 git fetch）

**局限**：
- 行号是上游 v0.9.4 视角；merge 时 git 3-way 会以 base = v0.9.3 视角对齐——但因为 v0.9.3 是我们已 sync 的版本，二者行号差异应当极小
- compare API 返回的 patch 仅展示 hunk context，超长文件可能截断（本次最大文件 AiSettingsPage.tsx +112 行未触发截断）
