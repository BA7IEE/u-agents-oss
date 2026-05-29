# UPSTREAM PREVIEW — v0.10.0 同步预分析报告（2026-05-29）

> ⚠️ **REVIEW-1 修订（同日，对抗性自查回代码验证）**：纠正 3 处——
> 1. **安全论述（重要）**：实证 `browser-pane-manager.ts` 的 `__browser:invoke` dispatcher **无 `browserToolEnabled` 总闸**（全文件 grep `getBrowserToolEnabled` 零命中；唯一本地闸是 `getAllowRemoteEvaluate`，且只 gate `evaluate`）。故 **remote workspace 可达时 #46 拦不住** remote `navigate/click/screenshot/getClipboard/getNetworkLogs` 等——原「#46 在 v0.10.0 下仍然有效」结论**仅对本地 agent 成立**。§3.3/§3.4 已重写，新增决策点 **D5**。
> 2. **测试合并策略（重要）**：交集内 8 个 test 文件 fork 有大量 brand patch（`registration.test.ts` 18 / `registration-profiles.test.ts` 17 / `system.open-url.test.ts` 9 / `browser-pane-manager.test.ts` 8 …）；上游 0 碰 brand 行 → git 可自动合并，但**严禁 take-theirs**（会丢 60+ 处 brand → 回退 + 测试 fail）。原 §5「take-theirs 即可」已改。
> 3. **新文件数 7 → 9**（§2.3 笔误，实测 `name-status` 中 `A` 计数 = 9）。
>
> **本报告由本仓库 AI 在不动本地 git refs / 不动工作树的前提下产出**（仅 `git fetch upstream` 纯下载 + 只读 `git diff` / `git show` / `git grep` 分析，未 merge、未改任何源码）。
> 本地 main 当前在 `87ffbeb7`（今天刚 merge 完 `sync/upstream-v0.9.6`），上游 base = `v0.9.6`（`d0e674f5`）。
> marker 基线已确认：**U-API 标记 98 / START 9 / END 9**（CLAUDE.md §3.7）；当前 HEAD `#46 browserToolEnabled = false` 已实测确认（`config-defaults.json:13` + `storage.ts:135`）。
> 目的：给执行 merge 的用户/外部 AI 一份可直接照做的预案。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.1/§3.3/§3.7 + [`04-feature-cuts.md`](../04-feature-cuts.md) + [`07-upstream-sync.md`](../07-upstream-sync.md) + [`08-conflict-zones.md`](../08-conflict-zones.md) + [`M3-SSRF-CONSOLIDATION-SPEC.md`](../M3-SSRF-CONSOLIDATION-SPEC.md)

---

## 0. TL;DR

| 维度 | 判断 |
|---|---|
| 上游新版本 | **v0.10.0**（tag commit `215910da`；minor 版本号首次跳变 0.9→0.10，但仍是单 squash release commit）|
| 影响面 | **61 文件 / +2588 −162 行**（比 v0.9.6 的 66 文件 / +2199 −184 略大；同量级）|
| 主题 | **远程 `browser_tool` 桥接 + 浏览器标签按 workspace 隔离 + #824 basic-auth 修复**——一整个 remote browser pane 子系统 |
| **冲突等级** | **A−（小冲突）** —— 与 v0.9.4/v0.9.5/v0.9.6 同档。理由见下：§3.3 零命中 / LLM 入口零触碰 / §3.7 marker 全安全 / 无 SDK bump / Breaking None / 测试无语义冲突。真冲突都机械可解 |
| **§3.3 高冲突文件真冲突** | **0**（electron-builder.yml / branding.ts / llm-connections.ts / provider-metadata.ts / ProviderSelectStep / OnboardingWizard / apisetup 目录**全部未碰**）|
| **§3.1/§3.2 LLM 入口** | **0 触碰** —— provider-metadata / llm-connections / connection-setup-logic / onboarding / apisetup / CredentialsStep / u-api-defaults **全未动**。本次 sync 与 LLM 入口锁定完全无关 |
| **§3.7 改造点真 git 冲突** | **2 必然 + 1 可能**：<br>(a) **必然** `config-defaults.json` — 我们 `browserToolEnabled: true→false`(#46)，上游给该行加尾逗号并新增 `allowRemoteEvaluate: true` → 同一行两边都动<br>(b) **必然** `preload/bootstrap.ts` import 块 — fork 把 import scope 改成 `@u-agents/`，上游同 import 块新增 `CLIENT_BROWSER_INVOKE` + `BrowserCapabilityRequest`(用旧 scope) → import 列表两边都改<br>(c) **可能（小）** `storage.ts` `FALLBACK_CONFIG_DEFAULTS` — 我们改 `browserToolEnabled` 行(#46)，上游在其相邻下一行插 `allowRemoteEvaluate: true`，git 多半能自动合并，但需核对 |
| **§3.7 marker 是否被无声破坏** | **否，全部安全**：#1/#2/#3/#32a/#33b enforceUApiBaseUrl·model 保护·startup lock·atomicWrite·dir 0o700（storage.ts 区域上游未碰）/ #48 SSRF（source-test.ts，上游改 `case 'basic'` 在我们两个 marker 区块之间，不重叠）/ #31b TLS（bootstrap.ts，上游只新增 handler）/ #28 About（main/index.ts，上游只加 `registerCapabilityIpc()`）/ #45c brand（pi-agent.ts，上游新增函数远离）|
| **必须 brand patch** | **2 处用户/agent 可见文案** + release-notes：<br>`pi-agent.ts` `mapBrowserToolErrorCode()` 和 `browser-pane-manager.ts` 各有一处 `"...the Craft Agent desktop app..."` → 改 **"U Agents"** |
| **C11 NPM scope rename** | **是** — 新增行引入旧 scope `@craft-agent/server-core` ×6 + `@craft-agent/shared` ×6 = **12 处 import** + **15 个 package.json**（version 字段 0.9.6→0.10.0）|
| **C13 上游死引用 / 新 channel 漏分类** | **预测 0**：remote browser 走 transport **capability** 机制（`handleCapability`/`invokeClient`），不是 messaging routing channel；`LOCAL_CLIENT_CAPABILITIES` 上游自己已加 `CLIENT_BROWSER_INVOKE`，无需我们 patch。`__browser:invoke` 是 Electron 内部 IPC，不走 `REMOTE_ELIGIBLE_CHANNELS`/`HANDLED_CHANNELS` 白名单 |
| **C14 build-win.ps1 漂移** | **0**（v0.10.0 未改任何 build script / electron-build-main.ts 调用链 / subprocess 结构）|
| **底层 SDK 升级** | **无**（15 package.json 仅 version bump；Pi SDK / Claude SDK / electron-updater / Sentry 依赖全不动）|
| 测试语义冲突（v0.9.6 教训复查）| **0** — `source-test.test.ts` **不在 fork∩v0.10.0 交集**（fork 没改过它），上游是**纯文件末尾追加**新 describe（#824 basic-auth），干净接受 |
| **新决策点** | **2 项（安全相关，需用户拍板）**：**D1** 上游新增 `allowRemoteEvaluate: true`（**仅** gate 远程 `evaluate`），是否裁 `false`？**D5（REVIEW-1 新增）** dispatcher 无 `browserToolEnabled` 总闸——remote workspace 可达时 `navigate/click/screenshot/clipboard` 等远程方法**裸奔**（#46 拦不住），是否移除 `CLIENT_BROWSER_INVOKE` capability 广告 / 给 dispatcher 加总闸？详见 §3.3/§3.4 |
| **D2 核查结论（REVIEW-1）** | **remote workspace = 可达（已坐实）**：添加 workspace 主界面有"Connect Remote"卡、server URL 自由输入、fork 有意 brand 保留、04-feature-cuts 0 裁剪（见 §3.5 证据链）。→ remote browser pane 是**真实威胁面**，D1/D5 建议 sync 时一并处理 |
| §3.7 基线变化预测 | **98 → 100**（+2：pi-agent.ts + browser-pane-manager.ts 两处 brand patch 加 `// U-API:` marker，沿 #45c 模式）；**若 allowRemoteEvaluate 决策裁成 false 并加 marker + 防回归测试**，再 +1~2，届时须在 §3.7 表登记新改造点并刷新基线 |
| `release-notes/0.10.0.md` 处理 | **新文件**，含多处 `Craft Agent(s)` 字面量 + `lukilabs/craft-agents-oss` issue URL（#824）→ 沿 0.9.x 历史路径中文翻译 + brand 替换 |
| i18n 新增 key | **预测 0~少量**（release-notes 未提新 key；browser tab 隔离是 renderer atom 逻辑；`ToolbarStatusSlot.tsx`/`BrowserTabStrip.tsx` 有改动，sync 后跑 `lint:i18n:parity` 确认）|
| 推荐时机 | **可本周内 sync**，按现行 SOP 走，无需 P0 review。但因引入完整新子系统，**建议 sync 后对 browser tool 路径做一次针对性 verify**（即使我们默认关闭它）|
| 推荐分发 | **macOS arm64 + Windows x64**（与 v0.9.4/v0.9.6 D-β 一致）|

---

## 1. 上游版本元数据

```
tag            v0.10.0
commit         215910da
base           v0.9.6 (d0e674f5)
影响面          61 files changed, 2588 insertions(+), 162 deletions(-)
commit 形态     单个 squash release commit（v0.9.x 同模式）
Breaking        None（workspaceId DTO 字段 optional，向后兼容）
SDK 变化        无
title          v0.10.0 — Remote browser_tool bridging, per-workspace
               browser tab isolation, and #824 basic-auth fix
```

**主题（按 release notes 顺序）**：

| 区域 | 一句话 | 对 fork 的影响 |
|---|---|---|
| **Feature 1**（`1d926c33`）| **远程 `browser_tool` 桥接到用户本地 Electron 浏览器**：远程 workspace（headless/docker/WebUI）的 agent 可端到端驱动用户本地 `BrowserPaneManager`。新增 `client:browser:invoke` WS capability、`__browser:invoke` IPC dispatcher（含 per-method owner-key 授权）、`RemoteBrowserPaneManager`、`SessionManager.getBrowserPaneManagerForSession`。`uploadFile` 被禁；`evaluate` 由 `allowRemoteEvaluate` 门控；Pi 现在 mirror `getBrowserToolEnabled` gate。27 新测试 | **头号关注**：撞 #46 browserToolEnabled 裁剪 + 引入新远程控制面 + 新 `allowRemoteEvaluate` 决策点 + 2 处 brand 文案。详见 §3 |
| **Feature 2**（`af817192`）| **浏览器标签按 workspace 隔离**：`BrowserInstance` / `BrowserInstanceInfo` DTO 加 nullable `workspaceId`，`STATE_CHANGED` 按 workspace 路由，renderer 用新 atom family 过滤。17 新测试 | 纯 UX 隔离逻辑，与品牌/LLM 入口无关；DTO 字段 optional 向后兼容。`dto.ts` / `BrowserTabStrip.tsx` / `ToolbarStatusSlot.tsx` 改动随之接受 |
| **Improvement ×2** | (a) `markdown-preview` block 补进 online-docs（Mintlify 独立站，我们 fork 不消费）；(b) `SessionManager` 加 3 行 `sessionLog.info` 便于诊断 remote browser 桥接 | 纯接受 |
| **Bug Fix ×6** | 全部围绕 browser workspace isolation：renderer 双 workspace id 过滤（`bf8429fa`）、`STATE_CHANGED` 回退 broadcast-to-all（`f831bb42`）、**remote 生命周期不复用窗口防 cross-workspace hijack**（`ce3340a1`）、unbound 窗口复用限本 workspace（`ceb24603`）、TopBar 手开窗口继承 workspace（`7dfcaeac`）、`BrowserInstance` IPC 返回前投影 snapshot（`8e2534b5`）| 上游**自己在加固 remote browser 的隔离与防劫持** —— 对我们是好事。纯接受 |
| **Bug Fix #824**（`96dd7c0d`）| `source_test` 对 basic-auth 凭证做 base64 编码（之前把原始 vault JSON 塞进 `Authorization` 头导致 401）| 命中 §3.7 #48 所在文件 `source-test.ts`，但只改 `case 'basic'` header 构造，**不碰 SSRF marker**。详见 §3.7 表 |

---

## 2. 61 文件分类清单

### 2.1 §3.3 高冲突文件交集（**0 文件，0 真冲突**）

| 文件 | v0.10.0 变更 | 真冲突？ |
|---|---|---|
| `apps/electron/electron-builder.yml` | **未碰** | ✅ 干净 |
| `packages/shared/src/branding.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/llm-connections.ts` | **未碰** | ✅ 干净 |
| `packages/shared/src/config/provider-metadata.ts` | **未碰** | ✅ 干净 |
| `.../onboarding/ProviderSelectStep.tsx` | **未碰** | ✅ 干净 |
| `.../onboarding/OnboardingWizard.tsx` | **未碰** | ✅ 干净 |
| `.../components/apisetup/` 目录 | **未碰** | ✅ 干净 |

✅ **§3.3 表全绿** —— fork 历史连续多次干净（v0.9.4 / v0.9.5 / v0.9.6 / **v0.10.0**）。

### 2.2 §3.7 改造点路径交集（逐项核对）

| # | 改造点 | 文件 | v0.10.0 hunk 位置 | 与 marker 关系 | 结论 |
|---|---|---|---|---|---|
| #46 | browserToolEnabled=false | `config-defaults.json` | features 块给 `browserToolEnabled` 行加尾逗号 + 新增 `allowRemoteEvaluate: true` | **同一行两边都改** | **⚠️ 必然 git 冲突**；解法见 §3.2 |
| #46 | browserToolEnabled=false | `storage.ts` `FALLBACK_CONFIG_DEFAULTS` | 在 `browserToolEnabled: true,` 下一行插 `allowRemoteEvaluate: true,` | 相邻行（我们改上一行 value，上游加下一行）| **可能小冲突 / 多半自动合并**；核对即可 |
| #1/#2/#3/#32a/#33b | enforceUApiBaseUrl / model 保护 / startup lock / atomicWrite / dir 0o700 | `storage.ts` 其余区域 | 上游仅在 interface 加 `allowRemoteEvaluate?` 字段 + 新增 `getAllowRemoteEvaluate()`/`setAllowRemoteEvaluate()` 函数 | **完全不重叠** | ✅ 安全 |
| #48a-d | SSRF guard（import + safety check + redirect:'manual' + 30x reject）| `source-test.ts` | 上游只改 `testApiConnectionWithAuth` 的 `case 'basic':`（~L520-544，header 构造）| 我们 marker 在 L23/24（import）、L469/470（safety check）、L591+（fetch）—— 上游改动夹在中间不重叠 | ✅ 安全（核对行号不重叠）|
| #31b | TLS strict mode | `preload/bootstrap.ts` | 上游 import 块加 `CLIENT_BROWSER_INVOKE`/`BrowserCapabilityRequest` + 新增 `handleCapability(CLIENT_BROWSER_INVOKE)` handler | TLS marker 不在 import 块 / 新增 handler 区 | ✅ marker 安全；但 **import 块本身两边都改 → C11 冲突**（见 §2.4）|
| #28 | About panel Apache attribution | `main/index.ts` | 上游在 `app.whenReady()` 加 `browserPaneManager.registerCapabilityIpc()` + `bindRpcServer` 回调 | About panel marker 在 app menu 区，远离 | ✅ 安全 |
| #45c | brand "U Agents-built" 注释 | `pi-agent.ts` | 上游新增 `mapBrowserToolErrorCode()`（L115）+ import（L93）+ browser gate（L548）+ catch 改写（L1539）| #45c marker 在 ~L1285 system prompt 注释，远离 | ✅ marker 安全；但 **新增函数含 brand 文案需 patch**（见 §3.4 / §4）|

### 2.3 新文件清单（**9 个新文件，全部 0 brand 命中、需 C11 核查**）

```
apps/electron/resources/release-notes/0.10.0.md                              release notes（brand 替换 + 中文翻译）
apps/electron/src/main/handlers/__tests__/browser-broadcast.test.ts          browser STATE_CHANGED 路由测试
packages/server-core/src/sessions/RemoteBrowserPaneManager.ts                远程 IBPM 实现（含 @craft-agent import，C11）
packages/server-core/src/sessions/__tests__/RemoteBrowserPaneManager.test.ts 同上单测
packages/server-core/src/sessions/__tests__/host-client-fallback.test.ts     host-client fallback 测试
packages/server-core/src/transport/__tests__/error-codes.test.ts             error-code 保留测试
packages/server-core/src/transport/browser-capability.ts                     wire protocol（仅 export 类型，无 @craft import）
packages/shared/src/agent/__tests__/browser-tools-remote.test.ts             remote browser tool 测试
packages/shared/src/agent/__tests__/pi-browser-tool-toggle.test.ts           Pi browser gate 测试
```

> 注：上表 9 项含 2 个 `__tests__` 目录新增；新文件中 `browser-capability.ts` 仅导出类型，无外部 scope import。`RemoteBrowserPaneManager.ts` 等含 `@craft-agent/` import，纳入 §2.4 C11 清单。

### 2.4 C11 NPM scope 命中清单（**12 import + 15 package.json**）

**新增行引入的旧 scope import**（sync 后须 batch rename `@craft-agent/` → `@u-agents/`）：

| scope | 次数 | 主要落点 |
|---|---|---|
| `@craft-agent/server-core` | 6 | `bootstrap.ts`（transport 类型/常量）、`browser-pane-manager.ts`、`RemoteBrowserPaneManager.ts`、transport 互引 |
| `@craft-agent/shared` | 6 | `getAllowRemoteEvaluate`、`CodedError`、`BrowserInstanceInfo` 等 |

代表性命中行（实测 grep 新增行）：
```
+import { DEFAULT_THEME, loadAppTheme, getAllowRemoteEvaluate } from '@craft-agent/shared/config'
+import { CodedError } from '@craft-agent/shared/protocol'
+import { CLIENT_BROWSER_INVOKE } from '@craft-agent/server-core/transport'
+import type { ConfirmDialogSpec, FileDialogSpec, BrowserCapabilityRequest } from '@craft-agent/server-core/transport'
+import type { EventSink, RpcServer } from '@craft-agent/server-core/transport'
+import type { BrowserInstanceInfo } from '@craft-agent/shared/protocol'
```

**15 个 package.json**（仅 `"version": "0.9.6" → "0.10.0"`；用 3-way merge 脚本保 `@u-agents/` name + fork 元数据 description/author/homepage/private/bin，接受上游 version/dep/exports）：

```
package.json (root)              apps/cli   apps/electron   apps/viewer   apps/webui
packages/core   packages/messaging-gateway   packages/messaging-whatsapp-worker
packages/pi-agent-server   packages/server-core   packages/server
packages/session-mcp-server   packages/session-tools-core   packages/shared   packages/ui
```

> ⚠️ sync 后必跑：`grep -rn "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" | wc -l` 应为 **0**。

---

## 3. 头号风险：remote browser pane 子系统 + #46 交集

### 3.1 机制（一句话）

v0.10.0 让**运行在远程 workspace 的 agent**，通过 transport 的 `CLIENT_BROWSER_INVOKE` capability，反向驱动**用户本地 Electron 浏览器**：

```
远程 agent → RemoteBrowserPaneManager → server.invokeClient(clientId, 'client:browser:invoke', req)
   → WS → 本地 bootstrap.ts handleCapability → IPC '__browser:invoke'
   → Electron main BrowserPaneManager（真实浏览器）
```

`BrowserCapabilityMethod` 暴露**完整控制权**：`navigate` / `clickAtCoordinates` / `evaluate`(任意 JS) / `screenshot` / `getClipboard` / `uploadFile` / `getNetworkLogs` 等。上游已内建若干约束：
- `uploadFile` 在桥接上被禁（`BROWSER_REMOTE_UPLOAD_NOT_SUPPORTED`）
- `evaluate` 被本地 `allowRemoteEvaluate` 设置门控（默认 **true**）
- per-method owner-key 授权 + remote 调用不复用手动窗口（防 cross-workspace hijack，见 §1 bug fix `ce3340a1`）

### 3.2 #46 交集与 `config-defaults.json` 冲突（必解）

**会发生什么**：`config-defaults.json` 的 `features` 块，上游把
```diff
-    "browserToolEnabled": true
+    "browserToolEnabled": true,
+    "allowRemoteEvaluate": true
```
而我们 fork 此处是 `"browserToolEnabled": false`（#46）。git 3-way merge 会在这一行报冲突。

**怎么解**：
```json
"browserToolEnabled": false,
"allowRemoteEvaluate": <见 §3.3 决策>
```
即**保留我们的 `false`** + 接受新键（值待决策）。`storage.ts` 的 `FALLBACK_CONFIG_DEFAULTS` 同样处理（保 `browserToolEnabled: false` + 接受 `allowRemoteEvaluate`）。

### 3.3 安全分析与决策点 D1：`allowRemoteEvaluate`（需用户拍板）

**两个本地 enforcement 事实（实证）**：

1. `allowRemoteEvaluate` enforcement 落在 `browser-pane-manager.ts:2675`，**只门控 `evaluate`**（远程跑任意 JS）：
   ```ts
   if (!getAllowRemoteEvaluate()) {
     throw new CodedError('BROWSER_REMOTE_EVALUATE_BLOCKED', ...)
   }
   ```
2. `__browser:invoke` dispatcher（`registerCapabilityIpc` → `dispatchCapability`）**没有 `browserToolEnabled` 总闸**——实测 `browser-pane-manager.ts` 全文件 grep `getBrowserToolEnabled` **零命中**。dispatcher 的防护只有 `requireOwnedInstance`（owner-key 授权，防跨 session/workspace 劫持）+ 上述 `evaluate` 单点闸。

**因此 #46（`browserToolEnabled` 默认 false）的有效范围必须分场景看**：

| 场景 | #46 拦得住 remote browser 驱动？ |
|---|---|
| **本地 agent**（用户在本地 app 内跑 agent）| ✅ **有效**——`browser_tool` 工具不向本地 agent 广告（Claude 后端原有 + Pi 后端本次 mirror `getBrowserToolEnabled`），agent 拿不到工具 → 不发起调用 |
| **remote workspace**（用户连远程 server，agent 在远程进程）| ❌ **拦不住非-`evaluate` 方法**——远程 agent 的 `browser_tool` 广告由**远程 server 配置**决定（非本地 #46）；本地 client **无条件广告** `CLIENT_BROWSER_INVOKE`，dispatcher 无 `browserToolEnabled` 闸，于是 `navigate/click/screenshot/getClipboard/getNetworkLogs/typeText` 等可被远程驱动，**仅 `evaluate` 被 `allowRemoteEvaluate` 拦** |

> 这纠正了本报告初稿「#46 在 v0.10.0 下仍然有效」的笼统结论——它**只对本地 agent 成立**。remote workspace 场景的真实闸门是 `allowRemoteEvaluate`（一项）+ owner-key 授权，而非 #46。

**决策点 D1 — `allowRemoteEvaluate` 默认值**：

| 选项 | 含义 | 建议 |
|---|---|---|
| **A. 裁 `false`** | 远程方默认不能对本地浏览器跑任意 JS。改 `config-defaults.json` + `storage.ts` FALLBACK 值，加 `// U-API:` marker + 防回归测试（沿 #46/#46t 模式）| ✅ **推荐**（纵深防御，符合 fork 收紧定位）|
| B. 接受上游 `true` | 跟随上游 | 放弃 `evaluate` 的第二层防御 |

> ⚠️ **D1 只堵 `evaluate` 一项**。若 remote workspace 可达且要**彻底**关闭远程驱动本地浏览器，须看 §3.4 的 **D5**（移除 capability 广告 / dispatcher 加总闸）。**D1/D5 都以 §3.5 的 D2（remote workspace 是否可达）为总开关**——若不可达，全部 moot。

### 3.4 capability 广告与 dispatcher 总闸缺口 → 决策点 D5（REVIEW-1 修订）

`LOCAL_CLIENT_CAPABILITIES` 是**静态数组**，**无条件**广告 `CLIENT_BROWSER_INVOKE`——即使本地 `browserToolEnabled=false`，client 握手仍广告该 capability，且 `__browser:invoke` dispatcher 无 `browserToolEnabled` 总闸（§3.3 实证）。

- **本地 agent 场景**：利用链入口（agent 调 `browser_tool` 工具）已被 `getBrowserToolEnabled()` gate 封住，capability 广告无独立调用方 → 当前无可利用面。
- **remote workspace 场景**：利用链入口在**远程 server**，本地 gate 够不着；capability 广告 + 无总闸 = 远程可驱动本地浏览器（除 `evaluate` 外无本地闸）。

**决策点 D5 — 若 remote workspace 可达且要彻底关闭**（二选一，均属代码改造，本仓库只出规格）：

| 方案 | 做法 | 取舍 |
|---|---|---|
| D5-a | 从 `LOCAL_CLIENT_CAPABILITIES` **移除** `CLIENT_BROWSER_INVOKE` | 最干净：本地 client 不再广告该能力，远程探测即知不支持；将来想用需回退 |
| D5-b | dispatcher 入口加 `if (!getBrowserToolEnabled()) throw CAPABILITY_UNAVAILABLE` 总闸 | 与 #46 联动：browser tool 开则远程可用、关则全禁；保留灵活性 |

> 若 §3.5 的 D2 判定 remote workspace **不可达**，则 D5 不必做（接受上游原样 merge，缺口不可达）。**D5 是 REVIEW-1 新发现，初稿 §3.4「无需 patch」结论已废**。

### 3.5 决策点 D2 与核查结论（REVIEW-1 已坐实：**remote workspace 可达**）

整个 remote browser pane 的**威胁前提**是"用户连接到一个远程 agent server"。REVIEW-1 已只读核查代码现状 + `04-feature-cuts.md`，结论：

**✅ remote workspace 连接在 U Agents 里完全可达，且未被裁剪**：

| 证据 | 落点 |
|---|---|
| 添加 workspace 主界面有"Connect Remote"卡片（Cloud 图标）| `AddWorkspaceStep_Choice.tsx`（3 张卡：CreateNew / OpenFolder / **ConnectRemote**；顶部注释还停留在旧的"Two options"，实渲染 3 个）|
| 完整 UI 流程可达 | `WorkspaceCreationScreen.tsx` L101 渲染 Choice → L104 `onConnectRemote={() => setStep('remote')}` → L128 渲染 `AddWorkspaceStep_ConnectRemote` |
| **server URL 用户自由输入**（无锁定）| `AddWorkspaceStep_ConnectRemote.tsx` `serverUrl` state + `<Input>`；`storage.ts:685 setWorkspaceRemoteServer` 直接存，无 url 校验。`enforceUApiBaseUrl` 只锁 **LLM baseUrl**，不约束 remote server url |
| fork **有意保留**（非疏漏）| ConnectRemote 文案被 fork brand 成 "Connect to a remote **U-API** for this workspace."（已做品牌替换 = 刻意保留）|
| `04-feature-cuts.md` | 对 remote/headless **0 条裁剪记录** |

**因此威胁面真实存在**：用户可在"添加 workspace → Connect Remote"填**任意** server URL + token 连到任意远程 agent server；该 server 上的 agent 即可经 `CLIENT_BROWSER_INVOKE` 驱动用户本地浏览器——navigate 任意 URL / 截图 / 读 clipboard / 读 network logs / 点击 / 输入，**仅 `evaluate` 被 `allowRemoteEvaluate`（默认 true）拦，其余裸奔；#46 拦不住**（§3.3/§3.4）。

**缓解因素**（降低紧迫度，但不消除）：① 用户须主动填 url+token 才连（非被动暴露）；② fork #31b TLS strict mode 防 MITM；③ dispatcher 有 owner-key 授权防跨 session 劫持；④ `uploadFile` 已被禁。

**→ D2 = 可达。故 D1（§3.3 裁 `allowRemoteEvaluate=false`）+ D5（§3.4，更关键）从"可选"升级为「建议 sync 时一并处理」**。两者都属代码改造，本仓库只出规格、由用户/外部 AI 执行。

---

## 4. 必须 brand patch 清单

| # | 文件 | 文案 | 改成 | marker |
|---|---|---|---|---|
| 1 | `packages/shared/src/agent/pi-agent.ts` `mapBrowserToolErrorCode()` | `'...Ask the user to open this workspace from the Craft Agent desktop app.'` | `Craft Agent` → **`U Agents`** | 加 `// U-API:` 单行（沿 #45c 模式）|
| 2 | `apps/electron/src/main/browser-pane-manager.ts` | `'Open this workspace from the Craft Agent desktop app and try again.'` | `Craft Agent` → **`U Agents`** | 加 `// U-API:` 单行 |
| — | `apps/electron/resources/release-notes/0.10.0.md` | 多处 `Craft Agent(s)` + `lukilabs/craft-agents-oss` #824 URL | 中文翻译 + brand 替换 | 不计 marker（沿 0.9.x release-notes 历史路径）|
| — | 注释类 `Craft Agents window` 等（`browser-pane.ts` / `BrowserTabStrip.tsx` 等）| 代码注释（非用户可见）| 可保留英文或随手 brand 化 | 不计 marker；非 CLAUDE.md §3.5（不暴露上游品牌）强制范围 |

> §3.7 基线预测：**98 → 100**（patch 1 + patch 2 各加 1 marker）。若 §3.3 选 A（allowRemoteEvaluate 裁 false + marker + 测试），再 +1~2，须在 [`CLAUDE.md`](../../CLAUDE.md) §3.7 表新增"v0.10.0 sync 改造点"子表并刷新基线。

---

## 5. C1–C14 踩坑模式预判

| # | 模式 | v0.10.0 触发？ | 说明 |
|---|---|---|---|
| C1 | 硬编码 slug 而非 helper | ❌ 不触发 | 本次不碰凭证判定 |
| C2 | sed 漏 object key 引号 | ❌ | 无 batch sed object |
| C3 | sed 改 input 漏 assertion | ❌ | brand patch 是文案，不改测试输入 |
| C5 | 新改造点忘加单测 | ⚠️ **若选 §3.3 A** | allowRemoteEvaluate=false 需补防回归测试（沿 #46t）|
| C10 | 上游新增 connection 字段透传漏 | ❌ | 本次未动 connection 体系（`enforceUApiBaseUrl` 浅合并保字段无新增对象）|
| C11 | 上游新文件用旧 scope | ✅ **触发** | 12 import + 15 package.json，见 §2.4。sync 后 grep `@craft-agent/` 必须 = 0 |
| C12 | 上游 release 自身 lint 违规 | ⚠️ 预测 0（待实测）| merge 后跑 `lint:electron`/`lint:shared`/`lint:ui`；有 error 按惯例 case-by-case |
| C13 | 上游死引用 / 新 channel 漏分类 | ❌ 预测 0 | capability 机制非 routing channel；`__browser:invoke` 是 Electron 内部 IPC；`LOCAL_CLIENT_CAPABILITIES` 上游自加齐 |
| C14 | build-win.ps1 结构差距 | ❌ | 未改 build 脚本 / subprocess 流水线 |

**测试语义冲突复查（v0.9.6 `credential-manager-renew.test.ts` 教训）**：

- 本次唯一被改的"§3.7 相关源文件的测试"是 `source-test.test.ts`。
- 它**不在 fork∩v0.10.0 交集**（fork 从未改过它），上游是 `@@ -697,3 +697,87 @@` **纯文件末尾追加** `source_test basic-auth header (regression for #824)` describe（用 `globalThis.fetch` mock，自包含）。
- **结论：无 v0.9.6 那种"git 不报冲突但运行时 fail"的语义冲突**，直接接受。
**⚠️ 交集 test 文件 brand 保护（REVIEW-1 修正，原「take-theirs 即可」是危险错误）**：

- 交集内 **8 个被改 test 文件 fork 都有大量 brand patch**（实测 fork brand 命中：`registration.test.ts` **18** / `registration-profiles.test.ts` **17** / `system.open-url.test.ts` **9** / `browser-pane-manager.test.ts` **8** / `session-watcher` 4 / `settings-default-thinking` 3 / `sessions-watchers` 2 / `transfer` 1）。
- **上游对这 8 个文件 0 碰 brand 行**（纯加新测试，如 `browser-pane-manager.test.ts` 的 `workspaceId stamping` describe）→ git 3-way **应能自动合并**（保 fork brand + 接受上游新测试）。
- **但严禁 take-theirs**：手滑 take-theirs 会丢 60+ 处 `craftagents://→uagents://` / `__craft_theme_color__→__u_agents_theme_color__` brand patch → 品牌回退 + 这些断言 fail。
- **merge 后必做**：grep 这 8 文件的 `uagents` 计数不降 + 跑 `bun test`。

---

## 6. 合并策略 SOP（针对 v0.10.0）

> 沿现行 [`07-upstream-sync.md`](../07-upstream-sync.md) SOP，下面只列 v0.10.0 **特有**的解冲突动作。

1. **建分支 + merge**：`git checkout -b sync/upstream-v0.10.0-20260529 && git merge v0.10.0`（预期冲突如下）。
2. **`config-defaults.json`**（必然冲突）：保 `"browserToolEnabled": false` + 接受 `"allowRemoteEvaluate"`（值按 §3.3 决策；默认先接受 `true`，可后续收紧）。
3. **`preload/bootstrap.ts`**（必然冲突，import 块）：合并 import 列表 —— 保留 fork 的 `@u-agents/` scope + 纳入上游新增的 `CLIENT_BROWSER_INVOKE` / `BrowserCapabilityRequest`；接受新增的 `handleCapability(CLIENT_BROWSER_INVOKE)` handler；**确认 #31b TLS marker 原样保留**。
4. **`storage.ts`**（可能小冲突）：保 `browserToolEnabled: false` + 接受 `allowRemoteEvaluate` 字段/FALLBACK/新函数；**确认 #1/#2/#3/#32a/#33b marker 原样**。
5. **15 package.json**：3-way merge 脚本（保 `@u-agents/` name + fork 元数据，接受 version 0.10.0）。
6. **C11 rename**：`@craft-agent/` → `@u-agents/`（12 import），跑 grep 校验 = 0。
7. **brand patch ×2**（§4）：`pi-agent.ts` + `browser-pane-manager.ts` 的 `Craft Agent` → `U Agents`，各加 `// U-API:` marker。
8. **`source-test.ts`**：接受上游 `case 'basic'`（fork L532，夹在 marker 之间）JSON 解析；**确认 #48 SSRF marker 全部保留**（实测 L23/24 import + L469/470 safety check + L591/592、L604、L667/668、L675/676、L684/685、L692 多处 `redirect:'manual'`/30x reject，均不与上游 `case 'basic'` 重叠）。
9. **`source-test.test.ts`**：直接接受（纯追加，fork 未碰）。
9b. **交集 8 个 test 文件**（`registration*.test.ts` / `browser-pane-manager.test.ts` / `system.open-url.test.ts` / `session*.test.ts` / `settings-default-thinking.test.ts` / `transfer.test.ts`）：git 自动合并（上游 0 碰 brand 行），**严禁 take-theirs**；merge 后 grep 各文件 `uagents` 计数不降 + 跑 test（详见 §5）。
10. **release-notes/0.10.0.md**：中文翻译 + brand 五件套替换。
11. **`bun.lock`**：沿历史 SOP —— `git checkout v0.10.0 -- bun.lock && bun install` 增量同步（**用户执行**，本仓库 AI 不跑写入命令）。
12. **§3.7 表 + 基线刷新**：登记 brand patch（+ 视 §3.3 决策登记 allowRemoteEvaluate 改造点），基线 98 → 100(~102)。

---

## 7. 决策点汇总（需用户/执行者确认）

| # | 决策 | 默认/推荐 | 阻塞 merge？ |
|---|---|---|---|
| **D2** | **remote / headless workspace 是否可达（§3.5）——总开关** | **REVIEW-1 已核查 = 可达**（未裁剪、UI 入口在、URL 自由输入）→ 坐实 D1/D5 必要性 | 否（但坐实了 D1/D5 的必要性）|
| D1 | `allowRemoteEvaluate` 默认值（§3.3）| **推荐 A：裁 `false`**（纵深防御）；注意**只堵 `evaluate` 一项** | 否 |
| **D5** | dispatcher 无 `browserToolEnabled` 总闸（§3.4）：remote 可达时 `navigate/click/screenshot/clipboard` 等裸奔 | 若 D2 可达 → **推荐 D5-a 移除 `CLIENT_BROWSER_INVOKE` 广告**；不可达 → 不必做 | 否 |
| D3 | 是否接受整个 remote browser pane 子系统 | **接受**（减小同步面；与品牌/LLM 入口无关；上游自带 hijack 防护）| 否 |
| D4 | 注释类 `Craft Agents` 是否随手 brand 化 | 可选（非用户可见，非强制）| 否 |

---

## 8. 预测评级与建议

- **冲突等级**：**A−（小冲突，merge 工作量维度）**。
  - 利好：CLAUDE.md §3.3 高冲突文件零命中 / **LLM 入口体系零触碰** / 现有 §3.7 marker 全安全 / **无 SDK bump** / **Breaking None** / 无测试语义冲突 / 上游自带 remote browser hijack 加固。
  - 工作量：2 必然 + 1 可能 git 冲突（均机械可解）+ 12 C11 import + 15 package.json + 2 brand patch + 8 test 文件 brand 保护（自动合并但**禁 take-theirs**）。与 v0.9.6 同档。
- **安全维度（独立于 merge 难度，REVIEW-1 坐实）**：remote browser pane 是新远程控制子系统；**D2 已核查 = remote workspace 可达**（§3.5 证据链），故默认配置下远程 server 可驱动本地浏览器的非-`evaluate` 方法（navigate / 截图 / 读 clipboard 等），#46 拦不住。这不增加 merge 难度，但**建议 sync 时一并落地 D1（裁 `allowRemoteEvaluate`）+ D5（dispatcher 加 `browserToolEnabled` 总闸 / 移除 capability 广告）**——完整改造规格见 [`M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md`](../M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md)，并在 sync 后对 remote browser 路径做针对性 verify。
- **与 v0.9.6 的差异**：本次是 **minor 版本号跳变**且**引入一个完整新子系统**（remote browser pane）。虽然冲突面不大，但**新代码量 + 新远程控制语义**值得比 v0.9.6 高一档的 sync 后验证。
- **推荐时机**：本周内可 sync。
- **推荐分发**：macOS arm64 + Windows x64（D-β）。
- **sync 后必做验证**：
  1. `grep @craft-agent/` = 0；marker 基线对齐预测（**100**，或含 D1/D5 改造后再 +N）；START/END 仍配对；**8 个交集 test 文件 `uagents` brand 计数不降**。
  2. `bun run typecheck` 全绿；`lint:i18n:parity`（确认无新增未翻译 key）；`lint:electron`/`shared`/`ui`（C12 实测）。
  3. `bun test` 对照基线 fail 数（v0.9.x 既有 latent fail 清单）；确认 #48 SSRF 测试、#46t browserToolEnabled 防回归测试仍绿。
  4. **针对性 verify**：开关 browser tool，确认默认关闭时 `browser_tool` 不广告；（若 remote workspace 可达）确认 remote `evaluate` 行为符合 D1 决策。

---

## 9. 附：本预分析所用只读命令（可复核）

```bash
git fetch upstream --tags                                  # 纯下载 v0.10.0
git diff v0.9.6 v0.10.0 --stat | tail -1                   # 61 files / +2588 −162
git diff v0.9.6 v0.10.0 --name-status                      # 全文件清单
git diff v0.9.6 v0.10.0 -- <file>                          # 逐文件 diff（storage/pi-agent/source-test/bootstrap/main 等）
git show v0.10.0:packages/server-core/src/transport/browser-capability.ts   # 新文件全文
git show v0.10.0:apps/electron/resources/release-notes/0.10.0.md            # release notes
git grep -nE "getAllowRemoteEvaluate|BROWSER_REMOTE_EVALUATE_BLOCKED|allowRemoteEvaluate" v0.10.0 -- packages apps
# fork∩v0.10.0 交集：
comm -12 <(git diff v0.9.6 HEAD --name-only | grep -vE "^\.planning/|\.md$|^CLAUDE\.md" | sort -u) \
         <(git diff v0.9.6 v0.10.0 --name-only | sort -u)
```

---

> **本报告不修改任何源码或 git refs**（CLAUDE.md §0）。merge 由用户/外部 AI 执行；执行后可让本仓库 AI 产出 `SYNC-v0.10.0-YYYYMMDD.md` 实测报告并刷新 §3.7 基线。
