# UPSTREAM PREVIEW — v0.9.6 同步预分析报告（2026-05-26）

> **本报告由本仓库 AI 在不动本地 git refs / 不动工作树的前提下，通过 GitHub Compare API 拉 `v0.9.5...v0.9.6` 只读分析产出**。
> 本地仍是 v0.9.5（commit `983c2691 docs: SYNC-v0.9.5-20260521 实测报告 ...`，2026-05-22）；marker 基线 98 / START 9 / END 9 已确认。
> 目的：给执行 merge 的用户/外部 AI 一份可直接照做的预案。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.3 / §3.7 + [`07-upstream-sync.md`](../07-upstream-sync.md) + [`08-conflict-zones.md`](../08-conflict-zones.md)

---

## 0. TL;DR

| 维度 | 判断 |
|---|---|
| 上游新版本 | **v0.9.6**（tag commit `d0e674f5`；距 v0.9.5 5 天）|
| commit 类型 | 单个 squash release commit（与 v0.9.0-v0.9.5 同模式）|
| 影响面 | **66 文件 / +2199 −184 行**（比 v0.9.5 的 73 文件 / +4167 −797 小一档；接近 v0.9.4 的 73 文件 / +698 −202 量级）|
| **冲突等级** | **A−（小冲突）** —— 跟 v0.9.5 同档；§3.3 高冲突文件 0 真冲突，§3.7 改造点 1 git 冲突 + 2 brand-patch git 冲突 + 1 语义冲突（高危，需 V11 SSRF 测试兜底） |
| **fork 自有改造文件 vs v0.9.6 交集** | **仅 1 文件（root package.json）**——`git log f863f915..HEAD --name-only`（自 v0.9.5 sync 后 fork 改过的非 doc 文件）共 4 个：`apps/electron/scripts/build-win.ps1` / `apps/electron/src/renderer/main.tsx` / `bun.lock` / `package.json`。v0.9.6 改的 66 文件中**只有 root `package.json` 重合**（走 3-way merge Python 脚本）。`build-win.ps1` B2 修复 + `renderer/main.tsx` M3 i18n fix #53 marker **均稳定不受 v0.9.6 影响**。 |
| §3.3 高冲突文件真冲突数 | **0**（electron-builder.yml / branding.ts / llm-connections.ts / provider-metadata.ts / ProviderSelectStep / OnboardingWizard / apisetup 目录全部未碰）|
| §3.7 改造点真冲突数 | **3 git 冲突 + 1 语义冲突（高危）+ 0 待验证**：<br>(a) **git 冲突 §3.7 路径**：`api-tools.ts` createApiTool resolveCredential block 重写撞到我们 M3 SSRF 改造区附近（marker 不在 hunk 内但相邻 ≤4 行）<br>(b) **git 冲突 brand patch 路径**：`apps/electron/src/main/handlers/system.ts:212` + `packages/server-core/src/handlers/rpc/system.ts:286` —— 我们 fork 把 `parsed.protocol === 'craftagents:'` patch 成 `'uagents:'`，v0.9.6 同位置改成 `classification.kind === 'internal-deeplink'`（base→ours 字面量改动 vs base→theirs 重构成 kind 判断，3-way merge 必标 conflict）<br>(c) **语义冲突（高危，git 不报警）**：`credential-manager-renew.test.ts` 上游把 mock pattern 从 `mock.module()` 改成 `spyOn()`，我们 SSRF describes（L236/L347）在文件中段不在 hunk 内 → **git auto-merge 不会标记冲突，工作树看起来干净，但运行时 7 个 SSRF 测试全 fail（5 SSRF guard + 2 redirect bypass）**<br>(d) ~~`url-safety.ts` 待验证~~ — REVIEW-3 实测 upstream patch 未触碰 L24 `INTERNAL_DEEPLINK_SCHEME` 行 → **❌ 干净** |
| §3.7 改造点交集文件 | **9 文件** — auto-update.ts / main/index.ts / App.tsx / pi-agent.ts / credentials/manager.ts / credential-manager-renew.test.ts / api-tools.ts / sources/credential-manager.ts / url-safety.ts |
| §3.7 自动过期 marker | **0** |
| §3.7 基线变化预测 | **98 → 98**（无新增改造点；M3 SSRF 区 hunk 是上游 mid-session credential refresh，与我们 SSRF guard 同向但更深层，merge 时保留我们的 SSRF 防护 + 接受上游 credential getter 抽象）|
| §3.7 **新增改造点** | **0**（v0.9.6 的 brand 字面量都集中在 `release-notes/0.9.6.md` + 文件 comments，沿历史路径处理，不入主基线表）|
| **C11 NPM scope rename** | **是**（3 文件 4 处 `@craft-agent/` import：main/handlers/system.ts × 1 + main/window-manager.ts × 2 + server-core/handlers/rpc/system.ts × 1；main/index.ts 的 `setBeforeUpdateQuitHook` 是扩展本地 `'./auto-update'` import，**不算 C11**；15 个 package.json `"name"`/`"version"` 字段）|
| **C12 ESLint 违规** | **预测 0**（1 轮静态扫描未见新增 disable / 新增违规模式；merge 后跑 `bun run lint:electron`/`lint:shared`/`lint:ui` 实测确认）|
| **C13 上游死引用** | **0 新增**（v0.9.5 我们已 stub 的 `scripts/check-task-tool-checks.sh` 等 7 个文件 v0.9.6 仍未实现；现有 stub 继续工作）|
| **C14 build-win.ps1 漂移** | **0**（v0.9.6 没改任何 build script / electron-build-main.ts 调用链）|
| **底层 SDK 升级** | **无**（Pi SDK 0.73.1 / Claude SDK 0.2.123 / Sentry / electron-updater 全部不动）|
| **新决策点** | **1 项**：v0.9.6 新增 `markdown-preview` 代码块（`html/pdf/image-preview` 四件套补全），我们 fork 接受/不接受？默认 ✅ 接受——与品牌无关、与 LLM 入口无关、是纯增量 UX 能力 |
| `release-notes/0.9.6.md` 处理 | **brand 五件套 6 行 ~7 处命中**（1 处 `"Craft Agents"` 字面量 + 1 处 `~/.craft-agent/` 路径 + 4-5 处 `lukilabs/craft-agents-oss` URL）—— 沿 0.9.5.md 历史路径处理 + 中文翻译 |
| **i18n 新增 key** | **2 keys**：`preview.expandPreview` + `preview.markdownPreview`；**上游 zh-Hans 已翻译**（"展开预览" / "Markdown 预览"），fork 不需要二次翻译 |
| `bun.lock` 处理 | **沿 v0.9.5 SOP**：merge 后用 `git checkout v0.9.6 -- bun.lock && bun install` 增量同步 |
| 推荐时机 | **本周内 sync**，按 v0.9.5 方案 Y++ SOP 走即可，无需 P0 review |
| 推荐分发 | **macOS arm64 + Windows x64**（与 v0.9.5 D-β 一致）|

---

## 1. 上游版本元数据

```
tag           v0.9.6
release       2026-05-25T00:47:48Z
commit        d0e674f576d2c3a5e103f7b0b528ba2dcd171795
prerelease    false
title         v0.9.6 — Auto-update window restoration, mid-session credential
              refresh, and #807/#798/#804 fixes
```

**主题（按 release notes 顺序）**：

| 区域 | 一句话 | 影响面 |
|---|---|---|
| Features × 2 | (a) 多窗口标题策略：1 窗口显示 App 名（`app.getName()` → "U Agents"），≥2 窗口每个窗口显示对应 workspace 名；(b) 新增 `markdown-preview` 代码块类型，与 `html-preview`/`pdf-preview`/`image-preview` 同模式 | 多窗口标题用 `app.getName()` 我们品牌**自动透传**；markdown-preview 是新增能力，与 fork 无功能冲突 |
| Improvements × 3 | (a) Online docs 加多窗口标题 + 自动更新窗口恢复说明；(b) Online docs intro 文案打磨；(c) Messaging gateway docs 反映 0.9.5 fallback 修复 | online-docs 是 Mintlify 独立站，我们 fork 不消费；messaging gateway docs 与我们 messaging 实现路径一致 |
| Bug Fixes × 8 | (a) 多窗口状态在自动更新后存活（Squirrel.Mac BrowserWindow 销毁时序 bug）；(b) API source 凭证支持会话内刷新（bearer/header/query/basic 全部走 credential getter，不再快照成静态字符串）；(c) authType 切到 `'none'` 时清理 `source_apikey` 槽位（防止旧凭证以 Cookie 形式泄漏）；(d) 危险 URL scheme 拦截给出原因 + DOM `href` 净化（#807）；(e) `cache_control` 1h TTL 顺序 bug + 误判 "tool not supported"；(f) 移动端 WebUI 长模型名挤掉发送按钮（#798）；(g) Headless 服务器自动重试 `source_activated`（#804，渲染层 `auto_retry` case 移除，搬到 SessionManager）；(h) PR 378 review 加固 | (a)/(d)/(e)/(f) 与品牌/LLM 入口无关，纯接受；(b) **mid-session credential refresh 与我们 M3 SSRF 改造区相邻**，需仔细 merge；(c)/(g)/(h) 都是稳定性提升，纯接受 |
| Breaking | **None**（向后兼容；所有改动 opt-in 或 bug fix）| —— |

---

## 2. 66 文件分类清单

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

✅ **§3.3 表全绿** —— fork 历史上连续 N 次干净（v0.9.4 / v0.9.5 / v0.9.6）。

### 2.2 §3.7 改造点路径交集（**9 文件**）

详见 §3 逐项核对表。简表：

| 文件 | hunk vs marker 距离 | 真冲突？ |
|---|---|---|
| `apps/electron/src/main/auto-update.ts` | 8+ 行 | ❌ 干净（marker 在 docblock 上方，hunk 在 import + body）|
| `apps/electron/src/main/index.ts` | 250+ 行 | ❌ 干净 + C11 import 1 处 |
| `apps/electron/src/renderer/App.tsx` | 196+ 行 | ❌ 干净（auto_retry case 删除，与我们 markers 不交叉）|
| `packages/shared/src/agent/pi-agent.ts` | 738+ 行 | ❌ 干净（单行 `originalMessage` 改 getter，与 backendName marker 远离）|
| `packages/shared/src/credentials/manager.ts` | 23+ 行 | ❌ 干净（marker 在常量声明，hunk 在 ensureInitializedSync + deleteSync 方法添加）|
| `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | 130+ 行 | **⚠️ 语义冲突（高危）**：上游 hunk 在 L1-30 + L85-105；我们 SSRF describes 在 L236/L347 远离 hunk → **git auto-merge 不报警，工作树看起来 clean**。但 theirs 删了顶部 `mock.module('../../credentials/index.ts', ...)`，我们 SSRF describes 仍依赖该 mock 路径生效——merge 后跑 `bun test` 会出现 7 个 SSRF 测试 fail（5 SSRF guard + 2 redirect bypass）。**git 不会标记任何 conflict marker，需要主动手工改造 SSRF describes 的 beforeEach 用 spyOn 模式** |
| `packages/shared/src/sources/api-tools.ts` | **4-30 行（相邻）** | **✅ 1 真冲突**：L40-65 修改 `isTokenGetter` 类型签名（撞我们 L60）+ L249-260 重写 resolveCredential block（撞我们 L233-238 normalize 调用 + L245 marker 相邻 4 行）|
| `packages/shared/src/sources/credential-manager.ts` | 768+ 行 | ❌ 干净（marker 在 refreshApiRenew，hunk 在 loadCredential + deleteSync 方法）|
| `packages/shared/src/utils/url-safety.ts` | **0 行（marker 不在 hunk 内）** | **❌ 干净（REVIEW-3 重新认定）**：DANGEROUS_SCHEMES Set→Map + classifyExternalUrl 签名重写在 L1-65 范围，但**实测 upstream patch 不触碰 L24 `INTERNAL_DEEPLINK_SCHEME` 那一行**（diff 上下文显示该行被作为 unchanged context 出现，theirs 未改）→ base==theirs == `'craftagents:'`，ours == `'uagents:'`，git 3-way merge 自动取 ours，无冲突标记。assertPublicHttpsUrl 块在 isSafeExternalUrl 之后也不在 hunk 内 → 完全干净。<br>**仅作为防御性核查**（merge 后 grep `'uagents:'` 仍应出现 1 处） |

**REVIEW-4 补盘 — brand-patch 路径外的 §3.7 隐性冲突**（不计 U-API marker 但属 §1 brand 全表的 patch）：

| 文件 | 我们的 patch | 上游 hunk | 冲突 |
|---|---|---|---|
| `apps/electron/src/main/handlers/system.ts:212` | `if (parsed.protocol === 'uagents:')` | 改成 `if (classification.kind === 'internal-deeplink')` | **✅ git 冲突 1 处**：base→ours 改字面量 vs base→theirs 重构成 kind 判断 |
| `packages/server-core/src/handlers/rpc/system.ts:286` | `if (parsed.protocol === 'uagents:')` | 改成 `if (classification.kind === 'internal-deeplink')` | **✅ git 冲突 1 处**：同上模式 |

**解决方式（两处都是）**：接受 theirs（用 `classification.kind === 'internal-deeplink'`）——因为 `INTERNAL_DEEPLINK_SCHEME = 'uagents:'` 在 url-safety.ts L24（我们 fork 已 patch），`classifyExternalUrl` 内部用该常量做 protocol 判定，所以 theirs 的 `classification.kind === 'internal-deeplink'` 等价于"`parsed.protocol === 'uagents:'`"。**不需要再 patch `'uagents:'` 字面量**——v0.9.6 把硬编码字面量抽到 url-safety.ts 共享常量，正好与我们的 brand patch 同模式。

**未涉及冲突的 fork `uagents:` 字面量**（base==theirs unchanged，git auto-take ours）：

| 文件 | 行 | 状态 |
|---|---|---|
| `packages/shared/src/utils/url-safety.ts:24` | `const INTERNAL_DEEPLINK_SCHEME = 'uagents:'` | ✅ 干净 |
| `apps/electron/src/main/deep-link.ts:99` | `if (parsed.protocol !== 'uagents:')` | ✅ 干净（v0.9.6 未改 deep-link.ts）|
| `packages/server-core/src/handlers/rpc/system.ts:71` | `if (parsed.protocol !== 'uagents:') return null` | ✅ 干净（同文件，但不同 hunk）|

### 2.3 新文件清单（**9 个新文件**）

```
apps/electron/resources/docs/markdown-preview.md                                              NEW  160 lines  markdown-preview 工具说明（0 brand 命中，merge 直接接受）
apps/electron/resources/release-notes/0.9.6.md                                                NEW   37 lines  release notes（~10 处 craft 字面量需 brand 替换 + 中文翻译）
packages/server-core/src/sessions/source-activated-auto-retry.test.ts                         NEW  261 lines  source_activated 自动重试 server-side 实现的单测（#804）
packages/shared/src/sources/__tests__/api-tools-credential-freshness.test.ts                  NEW  128 lines  mid-session credential refresh 单测
packages/shared/src/sources/__tests__/save-source-config-orphan-credential.test.ts            NEW  141 lines  authType:'none' 旧凭证清理单测
packages/ui/src/components/markdown/MarkdownDocBlock.tsx                                      NEW  189 lines  markdown-preview 渲染组件
packages/ui/src/components/markdown/__tests__/markdown-preview-helpers.test.ts                NEW  127 lines  markdown-preview helper 单测
packages/ui/src/components/markdown/markdown-preview-helpers.ts                               NEW   74 lines  markdown-preview helper
packages/ui/src/components/markdown/url-transform.ts                                          NEW   15 lines  url-transform 抽取（#807 fix 用）
```

**新文件中 `@craft-agent/` import 命中**：

| 文件 | `@craft-agent/` 新增 import 数 |
|---|---|
| 全部 9 个 NEW 文件 | **0**（实测 grep）|

✅ **NEW 文件零 C11 触发** —— 比 v0.9.5（21 NEW / 5 触发）更干净。

### 2.4 MODIFIED 文件中的 `@craft-agent/` 新增 import（**3 文件 4 处**）

```
apps/electron/src/main/handlers/system.ts          +1 import: classifyExternalUrl + formatBlockedUrlError
apps/electron/src/main/window-manager.ts           +1 import: getWorkspaceByNameOrId（多窗口标题策略）
apps/electron/src/main/window-manager.ts           +1 import: classifyExternalUrl + formatBlockedUrlError（#807 fix）
packages/server-core/src/handlers/rpc/system.ts    +1 import: classifyExternalUrl + formatBlockedUrlError（#807 fix）
```

合计 **3 文件 4 处** `@craft-agent/` import 添加 + 已有同模式 batch sed 命令处理。

> **附录 — 不计入 C11 的"看似 C11"案例**：`apps/electron/src/main/index.ts` 在 v0.9.6 加了一个 `setBeforeUpdateQuitHook` 到既有的 `from './auto-update'` import line（**本地路径，不是 `@craft-agent/`**），不触发 C11。但此文件已有 `@craft-agent/shared/utils` / `@craft-agent/shared/config` / `@craft-agent/server-core/transport` / `@craft-agent/server-core/services` 4 处 import — 在我们 fork 里已是 `@u-agents/...`，所以 merge 时 git 自动 take theirs 加上 `setBeforeUpdateQuitHook`，不会引入 `@craft-agent/` 残留（前提：fork 里这 4 处 import 路径 ours 已正确）。

### 2.5 Pi SDK / Claude SDK / 依赖版本

```
# v0.9.6 vs v0.9.5 dep 变化：
- Pi SDK (pi-coding-agent / pi-agent-core / pi-ai):  0.73.1 → 0.73.1（不动）
- Claude Agent SDK:                                  0.2.123 → 0.2.123（不动）
- Sentry (electron / react / vite-plugin):           不动
- electron-updater / electron-builder:               不动
- 15 个 package.json:                                version 0.9.5 → 0.9.6
- 其它三方 dep:                                       不动
```

✅ **本次 sync 无需跑 §8.2 对话路径回归**（SDK 不动；只跑 §6.5 常规验证即可）。

---

## 3. §3.7 改造点逐项交集核对

> 用 `gh api repos/lukilabs/craft-agents-oss/compare/v0.9.5...v0.9.6` 拿到 v0.9.6 改动文件清单，与本仓库 `grep -rEn "U-API" packages apps --include="*.ts" --include="*.tsx"` 文件清单做交集（9 文件），逐项核对位置是否撞 hunk。

| # | 改造点 | 文件 | 上游 hunk 位置 | 我们 marker 位置 | 距离 | 真冲突？ |
|---|---|---|---|---|---|---|
| #49 | auto-update 注释 URL 一致性 | `apps/electron/src/main/auto-update.ts` | L15-22 import + L67-80 hook 函数 + L384-410 installUpdate body | L7 docblock 注释 | 8 行（L7→L15）| ❌ 干净（注释 marker 不会被代码 hunk 撞）|
| #28 | About panel Apache attribution | `apps/electron/src/main/index.ts` | L105 import 行（扩展 `from './auto-update'` 加 `setBeforeUpdateQuitHook`，**本地路径不是 C11**）+ L1043-1063 whenReady + L1098-1155 captureAndSaveWindowState | L353 attribution 块 | 248 行（L105→L353）| ❌ 干净；merge 时 git 直接接受 theirs 的 import 扩展（ours 该行未碰）|
| #27 | first-install onboarding placeholder | `apps/electron/src/renderer/App.tsx` | L833-841 删 auto_retry case + L1615-1625 toast.error message 改进 | L25 + L637-640 first-install | 196 行（L637→L833）| ❌ 干净 |
| #11o | `backendName = 'U-API'` 字面量 | `packages/shared/src/agent/pi-agent.ts` | L1217 单行 `originalMessage` 改 `getCurrentTurnUserMessage()` getter | L126 + L1955 字面量 | 738 行（L1217→L1955）+ 1091 行（L1217→L126）| ❌ 干净 |
| #34 | LLM API key 长度限制 | `packages/shared/src/credentials/manager.ts` | L47-85 新增 `ensureInitializedSync` 私有方法 + L139-163 新增 `deleteSync` 方法 | L14 MIN/MAX 常量 + 注释 | 23 行（L14→L37 最近 hunk）| ❌ 干净 |
| #44b/#44d | refreshApiRenew SSRF 单测 | `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | L5-22 mock pattern 重写（mock.module → spyOn）+ L85-105 beforeEach/afterEach refactor | L235 + L347 SSRF describes（共 7 个测试：5 SSRF guard + 2 redirect bypass）| 130 行（L105→L235）| **⚠️ 1 语义冲突（高危，git 不报警）**：上游把 module-level `mock.module('../../credentials/index.ts', ...)` 拆掉，改成 `spyOn(credManager, 'load')` + `spyOn(credManager, 'save')` per-describe；我们 SSRF describes（L236/L347）的 beforeEach 仍用旧 `setCalls = []` + `mockGet.mockImplementationOnce(...)` → **git auto-merge 干净不报警**，但运行时 7 个测试全 fail。**必须主动手工改造 SSRF describes 的 beforeEach 改成同模式 spyOn**（REVIEW-3 关键发现，REVIEW-6 修正分类标签）|
| #43/#45a/#45b | M3 SSRF `assertPublicHttpsUrl` + createApiTool 接入 | `packages/shared/src/sources/api-tools.ts` | L40-65 `isTokenGetter` 类型签名扩展（允许 `Promise<ApiCredential \| null>`）+ L249-260 `createApiTool` resolveCredential block 重写（加 `rawCredential ?? ''` normalize）| L16 import marker + L60 `isTokenGetter` 函数 + L233-238 resolveCredential（撞）+ L245 redirect:'manual' marker（相邻 4 行）+ L266 assertPublicHttpsUrl call + L281 30x reject | **0 行（L60 hunk 内）+ 0 行（L233 hunk 内）+ 4 行（L245→L249 hunk 末）** | **✅ 1 真冲突**：上游重写 `isTokenGetter` 返回类型 + 重写 `createApiTool` 内 credential 解析（加 null-coalescing `?? ''`）；我们的 4 处 SSRF marker（L16/L245/L266/L281）**位置紧邻但不在 hunk 内**——但 hunk 内的 L60 函数签名 + L233 resolveCredential 调用 ours/theirs 必须**手工三方合并**：保留上游的 `ApiCredentialSource` 类型扩展 + `rawCredential ?? ''` normalize + 保留我们的 SSRF guard / redirect:'manual' / 30x reject |
| #44a/#44c | refreshApiRenew SSRF guard + redirect bypass | `packages/shared/src/sources/credential-manager.ts` | L154-167 authType='none' guard 添加（loadCredential 内）+ L215-234 `deleteSync` 方法添加 | L983 SSRF marker + L1008/L1018 redirect:'manual' + 30x reject | 768 行（L215→L983）| ❌ 干净 |
| #43 | `assertPublicHttpsUrl` helper 块 | `packages/shared/src/utils/url-safety.ts` | L1-65 DANGEROUS_SCHEMES Set→Map 重写 + classifyExternalUrl 签名加 scheme + 新增 formatBlockedUrlError 导出 | L55-83+ assertPublicHttpsUrl 块（在 isSafeExternalUrl 之后）+ L24 `INTERNAL_DEEPLINK_SCHEME = 'uagents:'` brand patch | **L24 在 hunk 内 + L55 紧贴 hunk 末** | **🟡 1 待验证**：assertPublicHttpsUrl 块在 `isSafeExternalUrl` 函数之后（原 v0.9.5 L52 之后），upstream hunk 末尾在 L63 加了 `formatBlockedUrlError`——我们 block 起始 L55 会被推到 L65+；**核心 risk**：L24 `INTERNAL_DEEPLINK_SCHEME = 'uagents:'` 在 upstream hunk 中作为 context 出现（upstream L38 是 `'craftagents:'`），3-way merge 应认出 base==theirs 都是 `'craftagents:'`，ours 是 `'uagents:'`，**自动取 ours**；但 DANGEROUS_SCHEMES 大段重写时 diff3 算法可能"误判"扩大冲突范围 → merge 后必须 `grep "uagents:" url-safety.ts` 验证仍是 1 处命中（L24）|

**冲突详细分析 — api-tools.ts**：

```diff
# v0.9.5 我们 fork 的代码（L60 + L233-238 + L245 marker）：
-function isTokenGetter(cred: ApiCredentialSource): cred is () => Promise<string> {
-  return typeof cred === 'function';
-}
...
-        const resolvedCredential: ApiCredential = isTokenGetter(credential)
-          ? await credential()
-          : credential;
+        // U-API: M3 SSRF 防护 — redirect bypass 修补（v24 F1.F3 P0）

# v0.9.6 上游版本：
+function isTokenGetter(
+  cred: ApiCredentialSource
+): cred is () => Promise<string> | Promise<ApiCredential | null> {
+  return typeof cred === 'function';
+}
...
+        // Resolve credential — if a getter, call it to get a fresh credential.
+        // A null result (vault has nothing for this source) is normalized to
+        // an empty string; buildHeaders / buildUrl already treat that as
+        // "no auth", letting the upstream API surface its own 401.
+        const rawCredential = isTokenGetter(credential)
+          ? await credential()
+          : credential;
+        const resolvedCredential: ApiCredential = rawCredential ?? '';
```

**3-way merge 行为预测**：

- base（v0.9.5 上游）= 老 `isTokenGetter` 签名 + 老 resolveCredential block
- ours（我们 fork）= 老 `isTokenGetter` 签名 + 老 resolveCredential block + 4 处 M3 SSRF marker（L16 import / L245 redirect:'manual' / L266 SSRF guard call / L281 30x reject）
- theirs（v0.9.6 上游）= 新 `isTokenGetter` 签名（扩展 union return type）+ 新 resolveCredential block（加 null-coalescing）

冲突解决方法：
1. **接受 theirs 的 `isTokenGetter` 签名扩展**（无 SSRF 改造，纯类型增强）
2. **接受 theirs 的 resolveCredential block**（加 `rawCredential ?? ''` normalize）
3. **保留 ours 的 4 处 SSRF marker**（L16/L245/L266/L281 紧邻但不在 hunk 内）

→ git auto-merge 会标记 L60 + L233-238 区域为冲突，需手工合并；marker 本身的代码上下行不动。

**冲突详细分析 — credential-manager-renew.test.ts**：

```diff
# v0.9.5 我们 fork 的代码（L1-30 + L235 SSRF describe）：
-import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
...
-mock.module('../storage.ts', () => ({
-  markSourceAuthenticated: mock(() => true),
-  loadSourceConfig: mock(() => null),
-  saveSourceConfig: mock(() => {}),
-}));
-const mockGet = mock(() => Promise.resolve(null as unknown));
-mock.module('../../credentials/index.ts', () => ({
-  getCredentialManager: () => ({
-    set: (...args: unknown[]) => { setCalls.push(args); return Promise.resolve(); },
-    get: mockGet,
-    delete: mock(() => Promise.resolve()),
-  }),
-}));

# v0.9.6 上游版本：
+import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
...
+// Track save() calls without globally mocking credentials/storage modules.
+// Bun module mocks leak across files in the same test process; method spies keep
+// this test discoverable alongside storage.ts regression tests.
+let setCalls: unknown[][] = [];
+let mockGet = mock(() => Promise.resolve(null as unknown));
+let loadSpy: { mockRestore: () => void } | null = null;
+let saveSpy: { mockRestore: () => void } | null = null;
...
# 在 describe('refreshApiRenew via refresh()') 的 beforeEach 加：
+    mockGet = mock(() => Promise.resolve(null as unknown));
+    loadSpy = spyOn(credManager, 'load').mockImplementation(async () => await mockGet() as never);
+    saveSpy = spyOn(credManager, 'save').mockImplementation(async (source, credential) => {
+      setCalls.push([credManager.getCredentialId(source), credential]);
+    });
# afterEach 加 mockRestore
```

**冲突解决方法**：

1. **接受 theirs 的 import + 模块顶层 spy 变量声明**
2. **接受 theirs 的 `describe('refreshApiRenew via refresh()')` beforeEach/afterEach spyOn 模式**
3. **同步把我们的 `describe('refreshApiRenew SSRF guard')` (L236) 和 `describe('refreshApiRenew SSRF redirect bypass')` (L347) 的 beforeEach 也改成 spyOn 模式**——把 `setCalls = []` 改成 `loadSpy = spyOn(...).mockImplementation(...)` + `saveSpy = spyOn(...).mockImplementation(...)`，afterEach 加 `mockRestore`
4. 单测断言 `fetchCalls` 不变（我们的 SSRF 测试核心是验证 `fetchCalls.length === 0`，与 mock pattern 无关）

→ git auto-merge 会标记 L1-30 为冲突，我们的 SSRF describes（L236/L347）merge 后**通过率取决于 ours describe 的 beforeEach 是否被同步改造**。**必须手工 patch SSRF describes 的 mock 接入**。

**冲突详细分析 — url-safety.ts**：

base（v0.9.5）：
```ts
const INTERNAL_DEEPLINK_SCHEME = 'craftagents:'  // L23
```

ours（我们 fork）：
```ts
const INTERNAL_DEEPLINK_SCHEME = 'uagents:'  // L24（M1 brand patch）
```

theirs（v0.9.6）：context 行不动（upstream patch 上下文显示 `const INTERNAL_DEEPLINK_SCHEME = 'craftagents:'`），但 hunk 范围 L1-65 整体涉及 DANGEROUS_SCHEMES Set→Map + classifyExternalUrl 签名加 scheme 字段 + 新增 formatBlockedUrlError 导出。

**3-way merge 预测**：

- diff3 算法判定 base→theirs 改了 DANGEROUS_SCHEMES + classifyExternalUrl + 加 formatBlockedUrlError，**没改 INTERNAL_DEEPLINK_SCHEME 那一行**
- base→ours 改了 INTERNAL_DEEPLINK_SCHEME 那一行
- 不冲突 → 自动取 ours 的 `'uagents:'`

但 diff3 在 hunk 范围大时容易"扩大冲突区域"，把整段 L1-65 标记冲突。这时人工解决：保留 theirs 的 DANGEROUS_SCHEMES Map 改造 + classifyExternalUrl 签名 + formatBlockedUrlError，**只在 INTERNAL_DEEPLINK_SCHEME 那一行取 ours**。

**必跑核查**（merge 后）：

```bash
grep -n "INTERNAL_DEEPLINK_SCHEME" packages/shared/src/utils/url-safety.ts
# 期望：1 处命中，值是 'uagents:'，不是 'craftagents:'
```

---

## 4. C 类常见踩坑模式核对

### 4.1 C11（NPM scope rename）— **触发**

| 范围 | 文件数 | 命中数 | 处理 |
|---|---|---|---|
| MODIFIED 文件的新 `import ... from '@craft-agent/...'`（详见 §2.4）| **3 文件** | **4 处** | sync 后跑 batch sed `'@craft-agent/'` → `'@u-agents/'` |
| 15 个 package.json 的 `"name": "@craft-agent/..."` | 15 文件 | 15 处 | sync 后跑 batch sed `"@craft-agent/"` → `"@u-agents/"` |
| 15 个 package.json 的 `"version": "0.9.5"` → `"0.9.6"` | 15 文件 | 15 处 | 走 3-way merge Python 脚本（[v0.9.5 PREVIEW §6.2 b](./UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md) 已实测）|

**SOP 命令**（沿用 v0.9.5）：

```bash
# C11 NPM scope rename — 在 merge 解决冲突后跑：
find packages apps -name "*.ts" -o -name "*.tsx" -o -name "package.json" 2>/dev/null \
  | xargs grep -l "@craft-agent/" 2>/dev/null \
  | xargs sed -i '' "s|@craft-agent/|@u-agents/|g"

# 验证：必须 = 0
grep -rEn --exclude-dir=node_modules "@craft-agent/" packages apps 2>/dev/null | wc -l
```

### 4.2 C12（上游 ESLint 违规）— **预测 0**

1 轮静态预测 v0.9.6 上游没引入新的 lint 违规。merge 后跑 `bun run lint:electron`/`lint:shared`/`lint:ui` 实测确认；如有 hit 沿 v0.9.3 #50/#51 模式处理（`eslint-disable-next-line ...` + `// U-API:` 注释 + 加 §3.7 表）。

### 4.3 C13（上游死引用）— **未新增触发**

v0.9.6 root `package.json` scripts 没新增 lint chain 入口；我们 v0.9.5 已 stub 的 7 个文件 v0.9.6 仍未实现（grep `scripts/` 目录确认）：

```
✓ check-task-tool-checks.sh        — v0.9.6 仍 404（我们已 stub）
✓ check-raw-sends.sh                — v0.9.6 仍 404（我们已 stub）
✓ typecheck-staged.sh               — v0.9.6 仍 404（我们已 stub）
✓ lint-i18n-staged.sh               — v0.9.6 仍 404（我们已 stub）
✓ lint-i18n-strings.sh              — v0.9.6 仍 404（我们已 stub）
✓ check-i18n-coverage.ts            — v0.9.6 仍 404（我们已 stub）
✓ check-version.ts                  — v0.9.6 仍 404（我们已 stub）
```

✅ 现有 stub 继续工作，无新增 C13 触发。

### 4.4 C14（build-win.ps1 漂移）— **未触发**

v0.9.6 没新增 `scripts/electron-build-main.ts` 调用链上的新 helper（grep diff list 确认 0 `scripts/` 文件改动），build-win.ps1 与 root chain 距离不变。

---

## 5. 决策点

**1 项新决策点**：

| 项 | 决策 | 理由 |
|---|---|---|
| `markdown-preview` 新代码块（与 `html/pdf/image-preview` 同模式）| ✅ **接受** | 纯增量 UX 能力；与品牌/LLM 入口/用户可见品牌字符串无冲突；新增 `MarkdownDocBlock.tsx` / `markdown-preview-helpers.ts` / `url-transform.ts` 三文件 0 brand 命中；docs 文档 `markdown-preview.md` 0 brand 命中；上游已在 docs index 注册（system.ts +1 行 `markdownPreview: DOC_REFS.markdownPreview`）|

参考决策（自动接受，记录在此）：

| 项 | 自动决策 | 理由 |
|---|---|---|
| 多窗口标题策略 | ✅ 接受 | `app.getName()` 走 electron-builder.yml 已是 "U Agents"，**品牌自动透传**；只是源码 comments 残留 2 处 `"Craft Agents"` 字面量（cleanup） |
| 自动更新窗口状态保留 | ✅ 接受 | Squirrel.Mac BrowserWindow 销毁时序 bug 修复，用户体验直接收益 |
| mid-session credential refresh | ✅ 接受（与我们 M3 SSRF 同向）| 上游 ApiCredentialSource 类型扩展 + credential getter 抽象比我们 SSRF guard 更深层；M3 SSRF guard 仍保留 |
| authType='none' 凭证清理 | ✅ 接受 | 安全收益（防止旧凭证以 Cookie 形式泄漏）|
| URL scheme 拦截给出原因 + DOM href 净化（#807）| ✅ 接受 | 与我们 M3 SSRF 同向；DANGEROUS_SCHEMES Set→Map 重写不动我们 SSRF marker |
| cache_control 1h TTL ordering 修复 | ✅ 接受 | Anthropic API 兼容性 bug 修复 |
| 移动端 WebUI 长模型名挤掉发送按钮（#798）| ✅ 接受 | UI 修复，与品牌无关 |
| Headless `source_activated` auto-retry（#804）| ✅ 接受 | 渲染层 `auto_retry` case 删除，搬到 SessionManager；服务器端逻辑提升 |
| PR 378 review 加固 | ✅ 接受 | 上游 review 修补，加固既有修复 |

---

## 6. 推荐执行步骤（给用户/外部 AI）

> 本仓库 AI **不执行**这些命令。以下是给用户或外部 AI（在另开会话执行 merge 时）参考。
> 沿用 v0.9.5 方案 Y++ 增稳版（[v0.9.5 PREVIEW §11.11](./UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md)）；本次只列差异 + 必须步骤。

### 6.1 准备 + merge

```bash
# 1. 当前在 main 分支干净状态，先确认
git status -sb
git log -1 --format="%H %s"  # 期望：983c2691 docs: SYNC-v0.9.5-20260521 ...

# 2. fetch upstream（本仓库 AI 不执行，用户/外部 AI 跑）
git fetch upstream
git tag | grep v0.9.6  # 期望：v0.9.6 已存在

# 3. 建 sync 分支
git checkout -b sync/upstream-v0.9.6-20260526

# 4. merge upstream/v0.9.6（不要 fast-forward，保留 sync commit）
git merge --no-ff v0.9.6
# 预期实际 conflict marker 文件：19 个
#   必出（19 个）：
#     - 15 个 package.json（git diff3 几乎一定标记冲突——brand 字段 ours/theirs 不同）
#     - bun.lock（不可手工 merge，走 §6.2 b checkout v0.9.6 -- bun.lock）
#     - packages/shared/src/sources/api-tools.ts（§3 真冲突，§3.7 路径）
#     - apps/electron/src/main/handlers/system.ts（§3 真冲突，brand-patch 路径，L212 'uagents:' vs 'internal-deeplink'）
#     - packages/server-core/src/handlers/rpc/system.ts（§3 真冲突，brand-patch 路径，L286 同模式）
#   不出但需主动改造（1 个，git 不报警 → 必须靠 SSRF 测试 commit gate 兜底）：
#     - ⚠️ packages/shared/src/sources/__tests__/credential-manager-renew.test.ts
#       （§3 语义冲突——SSRF describes mock 不迁移则 V11 测试 fail 9 个）
#   不出（git auto-merge 干净，仅靠 §6.2 e 全树 batch sed 清 @craft-agent/）：
#     - packages/shared/src/utils/url-safety.ts（INTERNAL_DEEPLINK_SCHEME 不在 upstream hunk 范围）
#     - apps/electron/src/main/index.ts（扩展本地 './auto-update' import）
#     - apps/electron/src/main/window-manager.ts（+2 @craft-agent/ import）
#     - apps/electron/src/renderer/App.tsx（auto_retry case 删除，ours 未改这区域）
#     - apps/electron/src/renderer/event-processor/{processor,types}.ts（auto_retry Effect 删除，配套修改）
```

### 6.2 冲突解决（按 §2.2 + §3 + §4 跑）

**a. 15 个 package.json**（§4.1 C11）—— 走 v0.9.5 SOP 的 3-way merge Python 脚本（保 v0.9.6 version + dep + exports + scripts；保 fork description + author + homepage + private + bin）：

```bash
# Step 1: --theirs 接受 v0.9.6 整体
git checkout --theirs $(git status -s | grep "package.json" | awk '{print $NF}')

# Step 2: Batch sed NPM scope
find packages apps -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null \
  | xargs sed -i '' 's|"@craft-agent/|"@u-agents/|g'

# Step 3: 3-way merge 还原 brand 字段（Python 脚本同 v0.9.5 §6.2 b）
# REVIEW-5 改进：BASE_BRANCH 改成动态读 origin/HEAD（防 fork 用了非 main 主分支名）
python3 <<'PYEOF'
import json, subprocess, glob, os
os.chdir('.')
# REVIEW-5: 若主分支非 main（master / trunk），先 export BASE_BRANCH 环境变量覆盖
BASE_BRANCH = os.environ.get('BASE_BRANCH', 'main')
BRAND_FIELDS = ['description', 'author', 'homepage', 'private', 'bin']
for p in sorted(glob.glob('packages/*/package.json') + glob.glob('apps/*/package.json') + ['package.json']):
    if 'node_modules' in p:
        continue
    with open(p) as f: cur = json.load(f)
    result = subprocess.run(['git', 'show', f'{BASE_BRANCH}:{p}'], capture_output=True, text=True)
    if result.returncode != 0:
        print(f'SKIP {p}: git show {BASE_BRANCH}:{p} failed (returncode {result.returncode})')
        continue
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
# 期望：空

# Step 5: git add 所有 package.json
git add $(git status -s | grep "package.json" | awk '{print $NF}')
```

**b. `bun.lock`**（§0 SOP）：

```bash
git checkout v0.9.6 -- bun.lock
bun install
git add bun.lock
```

**c. C11 import 扩展（3 文件 4 处 @craft-agent/）+ main/index.ts 本地 import 扩展**：

这 4 个文件的共同特点：ours 未碰这些 import 行，theirs 加新 import line → git 3-way merge 不会冲突，直接 auto-merge 把 `@craft-agent/` 引入工作树 → 走 §6.2 e 全树 batch sed 一次清理。

```bash
# main/index.ts：本地 import 扩展，不是 C11
#   v0.9.5 ours: import { checkForUpdatesOnLaunch, setAutoUpdateEventSink, isUpdating } from './auto-update'
#   v0.9.6 theirs: import { checkForUpdatesOnLaunch, setAutoUpdateEventSink, isUpdating, setBeforeUpdateQuitHook } from './auto-update'
# → git auto-take theirs，不留 conflict marker

# main/handlers/system.ts (+1) + main/window-manager.ts (+2) + server-core/handlers/rpc/system.ts (+1)：
#   v0.9.6 加 @craft-agent/ import → 走 §6.2 e 全树 batch sed 一次解决

# 全树 batch sed（已在 §4.1 命令）：
find packages apps -name "*.ts" -o -name "*.tsx" 2>/dev/null \
  | xargs grep -l "@craft-agent/" 2>/dev/null \
  | xargs sed -i '' "s|@craft-agent/|@u-agents/|g"

# 验证：必须 = 0
grep -rEn --exclude-dir=node_modules "@craft-agent/" packages apps 2>/dev/null | wc -l
```

**d. `api-tools.ts`**（§3 真冲突 — git 标记 marker，§3.7 路径）：

手工 merge 步骤（参考 §3 冲突详细分析 — api-tools.ts）：

```bash
# 1. 接受 theirs 的 ApiCredentialSource 类型扩展（L40-65 区域）：
#    type ApiCredentialSource =
#      | ApiCredential
#      | (() => Promise<string>)
#      | (() => Promise<ApiCredential | null>);
#
# 2. 接受 theirs 的 isTokenGetter 类型签名（允许 union 返回）
#
# 3. 接受 theirs 的 resolveCredential block（加 rawCredential ?? '' normalize）
#
# 4. 保留 ours 的 4 处 SSRF marker：
#    - L16 import url-safety helper（应仍在 import block 顶部）
#    - L245 redirect:'manual' marker（应仍在 fetch options 内）
#    - L266 assertPublicHttpsUrl call（应仍在 fetch 调用前）
#    - L281 30x reject（应仍在 fetch 调用后）
```

**e. `credential-manager-renew.test.ts`**（⚠️ §3 语义冲突 — git 不报警，必须主动改造）：

手工 merge 步骤（参考 §3 冲突详细分析 — credential-manager-renew.test.ts）：

```bash
# 1. 接受 theirs 的：
#    - import 加 spyOn
#    - 模块顶层删 mock.module('../storage.ts', ...) + mock.module('../../credentials/index.ts', ...)
#    - 模块顶层加 loadSpy/saveSpy 变量声明
#    - describe('refreshApiRenew via refresh()') beforeEach 加 spyOn 配置
#    - afterEach 加 mockRestore
#
# 2. 同步改造我们的 SSRF describes（L236 + L347）：
#    把
#      beforeEach(() => {
#        setCalls = [];
#        fetchCalls = [];
#        credManager = new SourceCredentialManager();
#      });
#      afterEach(() => {
#        mockGet.mockReset();
#      });
#
#    改成：
#      beforeEach(() => {
#        setCalls = [];
#        fetchCalls = [];
#        credManager = new SourceCredentialManager();
#        mockGet = mock(() => Promise.resolve(null as unknown));
#        loadSpy = spyOn(credManager, 'load').mockImplementation(async () => await mockGet() as never);
#        saveSpy = spyOn(credManager, 'save').mockImplementation(async (source, credential) => {
#          setCalls.push([credManager.getCredentialId(source), credential]);
#        });
#      });
#      afterEach(() => {
#        loadSpy?.mockRestore();
#        saveSpy?.mockRestore();
#        loadSpy = null;
#        saveSpy = null;
#        mockGet.mockReset();
#      });
#
# 3. 测试用例本体（test('rejects renew endpoint pointing at AWS/GCP IMDS', ...)）不动
#    断言 expect(fetchCalls).toHaveLength(0) 仍然成立——SSRF guard 在 refreshApiRenew 内部
#    fetch 调用之前 throw，与 mock 接入方式无关
```

**e2. handlers/system.ts + server-core/handlers/rpc/system.ts**（REVIEW-4 新发现 — brand-patch 路径 git 冲突）：

```bash
# 两个文件冲突模式相同：
#   ours: if (parsed.protocol === 'uagents:')
#   theirs: if (classification.kind === 'internal-deeplink')
# 接受 theirs（功能等价 — classifyExternalUrl 内部用 INTERNAL_DEEPLINK_SCHEME = 'uagents:'）

git checkout --theirs apps/electron/src/main/handlers/system.ts
git checkout --theirs packages/server-core/src/handlers/rpc/system.ts

# 然后跑全树 batch sed 把 v0.9.6 新引入的 @craft-agent/ import 清掉（§6.2 c 已包括这两个文件）

# 验证：两文件应只剩 base==theirs 不变的 'uagents:' 字面量（comment / log message），
# 关键判断行已变成 classification.kind === 'internal-deeplink'
grep -n "uagents:\|internal-deeplink" apps/electron/src/main/handlers/system.ts | head -5
grep -n "uagents:\|internal-deeplink" packages/server-core/src/handlers/rpc/system.ts | head -5
# 期望：每个文件 1+ 处 'uagents:' (comment/log) + 1 处 'internal-deeplink' (判断行)

git add apps/electron/src/main/handlers/system.ts packages/server-core/src/handlers/rpc/system.ts
```

**f. `url-safety.ts`**（§3 待验证，REVIEW-3 已降为 ❌ 干净）：

```bash
# 1. 接受 theirs 的整段 L1-65 重写（DANGEROUS_SCHEMES Set→Map + classifyExternalUrl 加 scheme +
#    新增 formatBlockedUrlError）
#
# 2. 保留 ours 的 INTERNAL_DEEPLINK_SCHEME = 'uagents:'（base==theirs == 'craftagents:'，
#    ours = 'uagents:'，3-way merge 应自动取 ours；若被 diff3 扩大冲突，手工保 ours）
#
# 3. 保留 ours 的 assertPublicHttpsUrl 块（应仍在 isSafeExternalUrl 之后；可能被 upstream
#    新加的 formatBlockedUrlError 推后几行）
#
# 4. 必跑核查：
grep -n "INTERNAL_DEEPLINK_SCHEME" packages/shared/src/utils/url-safety.ts
# 期望：1 处命中，值是 'uagents:'，不是 'craftagents:'

grep -c "U-API START\|U-API END\|assertPublicHttpsUrl" packages/shared/src/utils/url-safety.ts
# 期望：≥ 3（START + END + helper function definition）
```

**g. `release-notes/0.9.6.md` brand 替换**：

```bash
# 沿 0.9.5.md / 0.9.4.md 历史路径：
# - 替换 ~10 处 "craft-agents-oss" / "lukilabs/craft-agents-oss" 链接和字面量
# - 替换 1 处 "Craft Agents" 字面量为 "U Agents"
# - 替换 1 处 "~/.craft-agent/window-state.json" 为 "~/.u-agents/window-state.json"
# - 加中文翻译标题/章节
# - 决定是否保留上游 issue 链接（#807 / #798 / #804）或改成我们自己的 issue tracker（默认保留——便于追溯上游修复源头）
```

**h. 可选 — comment cleanup**：

```bash
# window-manager.ts L79 + L146 comment 内有 "Craft Agents" 字面量（不影响功能，只是注释）：
# - L79: "1 window → app name (\"Craft Agents\") on the lone window"
# - L146: "The renderer's index.html ships with `<title>Craft Agents</title>`"
# 可选 brand patch（建议保留，反映上游真实意图；功能上 app.getName() 已经返回 "U Agents"）
```

### 6.3 完成 merge

```bash
# Marker 基线核查（必跑）：
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：98（不变，v0.9.6 不引入新改造点；允许 96-100）

grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 9（v0.9.6 不新增块标记）

# 0 @craft-agent/ 残留：
grep -rEn --exclude-dir=node_modules "@craft-agent/" packages apps 2>/dev/null | wc -l
# 期望：0

# 0 Craft 残留（用户可见路径）：
grep -rEn --exclude-dir=node_modules --include="*.ts" --include="*.tsx" "Craft Agents\|craft\.do\|lukilabs" packages apps 2>/dev/null \
  | grep -v "^\s*//\|^\s*\*\|U-API:\|release-notes" | head -10
# 期望：≤ 2 处（window-manager.ts L79/L146 comment 内 "Craft Agents"，可选 cleanup）

# url-safety.ts brand 核查（§3 待验证项）：
grep -n "INTERNAL_DEEPLINK_SCHEME" packages/shared/src/utils/url-safety.ts
# 期望：1 处命中，值是 'uagents:'

# Validate：
bun run typecheck:all                           # 期望：0 errors
cd apps/electron && bun run lint                 # 期望：0 errors（stub 让 lint:tool-name-checks pass）
bun run lint:i18n:parity                         # 期望：6 locales × 1462 keys（v0.9.5 baseline 1460 + v0.9.6 新增 2 key：preview.expandPreview + preview.markdownPreview；zh-Hans 上游已翻译）
bun run lint:i18n:sorted                         # 期望：pass
bun run lint:i18n:coverage                       # 期望：pass

# 单测：
cd packages/shared && bun test                                                    # 跑全套；预期 1 baseline fail（send_developer_feedback 已知）+ v0.9.6 新单测 12+ pass
cd packages/server-core && bun test src/sessions/source-activated-auto-retry.test.ts  # 新增 21 单测应 pass
cd packages/ui && bun test src/components/markdown/__tests__/markdown-preview-helpers.test.ts  # 新增 markdown-preview helper 单测应 pass

# ⚠️ REVIEW-3 关键 gate：commit 前**必跑** SSRF 测试全套（防止 credential-manager-renew.test.ts 语义破坏）
cd packages/shared && bun test src/sources/__tests__/api-tools-ssrf.test.ts            # 期望 10 pass
cd packages/shared && bun test src/sources/__tests__/credential-manager-renew.test.ts  # 期望 21+ pass (含 7 SSRF guard + 7 redirect bypass)
cd packages/pi-agent-server && bun test src/tools/web-fetch-ssrf.test.ts                # 期望 7 pass
# 任一 fail = §6.2 e SSRF describes 改造未做或做错，立刻回头修，不能 commit

# Commit：
git commit -m "$(cat <<'EOF'
chore(sync): upstream v0.9.6 merge

- §3.7 改造点 3 git 冲突 + 1 语义冲突：
  - api-tools.ts: ApiCredentialSource 类型扩展 + resolveCredential normalize（保留 4 处 M3 SSRF marker）
  - handlers/system.ts:212: 'uagents:' literal vs 'internal-deeplink' kind — 接受 theirs
  - server-core/handlers/rpc/system.ts:286: 同上同模式 — 接受 theirs
  - credential-manager-renew.test.ts: mock.module → spyOn 迁移（同步改造 7 个 SSRF describes 测试，
    git 不报警但语义破坏，commit 前必跑 SSRF 测试套件全绿才能 commit）
- url-safety.ts: REVIEW-3 实测 INTERNAL_DEEPLINK_SCHEME 不在 upstream hunk 内，0 冲突
- C11 NPM scope rename：3 文件 4 处 import + 15 package.json batch sed
- C13 stub: 无新增（沿用 v0.9.5 已 stub 的 7 个）
- release-notes/0.9.6.md：brand 五件套替换 + 中文翻译
- 基线：98 → 98 处 marker；START/END 9/9 不变

详见 .planning/sync-reports/SYNC-v0.9.6-20260526.md
EOF
)"
```

### 6.4 验证 + 实测

按 §6.3 跑完后再跑 §6.5 双平台 D-β 实测（macOS arm64 + Windows x64），参考 v0.9.5 sync 历史路径。

**重点回归验证**（v0.9.6 引入的新能力）：

| # | 验证项 | 验证方法 |
|---|---|---|
| V1 | 多窗口标题切换 | 1 window → 标题 "U Agents"；开第 2 个 workspace window → 两个窗口标题各自显示 workspace 名 |
| V2 | 自动更新窗口状态保留 | 跑自动更新流程（v0.9.5 → v0.9.6），重启后验证多窗口布局保留（非 fresh start `{ windows: [] }`）|
| V3 | API source 凭证会话内刷新 | 配置一个 bearer token API source；用过期 token 触发 401 → 通过 `source_credential_prompt` 刷新 token → 下次工具调用应用新 token（不需要会话重启）|
| V4 | authType 切到 'none' 旧凭证清理 | 配置一个 header auth API source（如 Cookie header）→ 改成 authType:'none' + defaultHeaders.Cookie 设置另一个值 → 验证发出的 fetch 用新 defaultHeaders.Cookie，不是旧凭证 |
| V5 | URL 拦截错误信息 | 点 markdown 内的 `file:///etc/passwd` 链接 → toast 显示 `URL blocked (file:). file: URLs are blocked because shell.openExternal can launch local executables on Windows…` |
| V6 | DOM href 净化 | 在 markdown 渲染区右键 `file:` 链接 → `href` 应是 `undefined` 不是 `file:///...`（防 middle-click / cmd-click 绕过）|
| V7 | markdown-preview 块渲染 | 写 `\`\`\`markdown-preview { "src": "/tmp/test.md" } \`\`\`` → 渲染成内联 markdown 内容（不是 raw code）|
| V8 | source_activated server-side auto-retry | 触发 source activation → 服务器自动重发 `[<slug> activated]` 消息（不再依赖渲染层 auto_retry case）|
| V9 | Anthropic cache_control 1h TTL | 开启 extendedPromptCache 的 Anthropic 连接 → 跑一轮工具调用 → 应不再触发 `ttl='1h' cache_control block must not come after a ttl='5m' cache_control block` 错误 |
| V10 | 移动 WebUI 长模型名 | 在 375px 视口下设置长名自定义模型 → 发送按钮仍可见在右侧 |
| V11 | M3 SSRF 防护回归（必跑）| 跑：<br>1. `cd packages/shared && bun test src/sources/__tests__/api-tools-ssrf.test.ts`（**期望 10 pass**）<br>2. `cd packages/shared && bun test src/sources/__tests__/credential-manager-renew.test.ts`（**期望 7 SSRF describe + 7 redirect bypass + 其它 base tests，共 21+ pass**）<br>3. `cd packages/pi-agent-server && bun test src/tools/web-fetch-ssrf.test.ts`（**期望 7 pass**）<br>合计 **24 SSRF 测试**（M3-SSRF-CONSOLIDATION 全套）全绿确认 mock pattern 迁移未破坏 SSRF guard |

### 6.5 Phase 1.5 / 2.5 静置观察清单（沿 v0.9.5 方案 Y++）

**Phase 1.5 静置观察（sync commit 落地后 1-2 天，dev 模式日常使用）**：

| # | 观察点 | 异常处理 |
|---|---|---|
| O1 | 多窗口标题切换是否丝滑（开关 workspace window 时标题立即更新，不闪烁 "Craft Agents" 字面量）| 异常 → 检查 `app.getName()` 是否被 monkey-patch；electron-builder.yml `productName` 是否漂移 |
| O2 | API source 凭证刷新是否真的会话内生效（用一个 token 过期的 source 跑工具，401 后通过 `source_credential_prompt` 刷新 → 下次工具调用应用新 token）| 异常 → 回 §6.2 d 检查 api-tools.ts merge 时 credential getter 链是否完整 |
| O3 | `source_credential_prompt` 刷新后是否仍能正确路由到 SSRF guard（不让 attacker 用 prompt 注入 IMDS URL）| 异常 → 回 §6.2 d 检查 SSRF guard call 是否在 credential getter 之后 |
| O4 | 自动更新流程是否真的保留多窗口状态（v0.9.5 → v0.9.6 → 自动重启后窗口布局一致）| 异常 → 检查 `setBeforeUpdateQuitHook` 是否被 `installUpdate` 调用；查 `~/.u-agents/window-state.json` 自动更新前后内容 |
| O5 | 危险 URL 链接拦截 toast 是否给出清晰原因（点 markdown 内的 `file:///etc/passwd` → 看到 reason 字段）| 异常 → 检查 url-safety.ts DANGEROUS_SCHEMES Map 是否完整 |
| O6 | `markdown-preview` 块是否能正常渲染工作区内 .md 文件，对外部路径正确拒绝 | 异常 → 检查 `validateFilePath` 是否仍调用；MarkdownDocBlock 的 onReadFile 链路 |
| O7 | 后台跑的会话（含 messaging gateway / docker server-side）source_activated 自动重试是否生效（#804 server-side 实现）| 异常 → 检查 SessionManager 的 autoRetryTimer / autoRetryPending slot 实现 |
| O8 | 紧凑模式 / 移动 WebUI 在 375 px 视口下发送按钮可见（#798 fix）| 异常 → 检查 CompactModelSelector 的 min-w-[64px] + shrink 类是否未被覆盖 |

**Phase 2.5 静置观察**（**v0.9.6 不引入 i18n fix，所以与 v0.9.5 不同——Phase 2.5 可省略**）：

| 状态 | 行动 |
|---|---|
| 沿 v0.9.5 方案 Y++ 流程 | v0.9.6 没有"M3 i18n fix 搭车" 那种独立 commit；本次 sync 完整内容都在 Phase 1 commit |
| Phase 2 实际不存在 | 直接 Phase 1 → Phase 3（spec 文档同步）→ Phase 4（双平台打包）|
| 总日历时间 | **2-5 天**（含 Phase 1.5 静置 1-2 天 + Phase 4 实测 2-3 小时；比 v0.9.5 的 3-7 天少一段）|

---

## 7. 与 v0.9.5 sync 对比

| 维度 | v0.9.5（2026-05-21）| v0.9.6（本次预测）|
|---|---|---|
| 影响面 | 73 文件 / +4167 −797 行 | **66 文件 / +2199 −184 行**（约半量）|
| NEW 文件数 | 21 | **9**（约 0.4×）|
| §3.3 真冲突 | 0 | 0 |
| §3.7 真冲突 | 1 真（model-picker-helpers brand）| **3 git 冲突 + 1 语义冲突 + 0 待验证**（REVIEW-3/4 修订）：api-tools.ts SSRF 区 + handlers/system.ts:212 + server-core/handlers/rpc/system.ts:286 + credential-manager-renew.test.ts 语义破坏 |
| §3.7 新增 marker | 1（#54 model-picker brand） + 1（#53 M3 i18n fix 搭车）| **0**（v0.9.6 不引入新改造点）|
| C11 触发 | 7 文件 9 处 import + 15 package.json | **3 文件 4 处 import + 15 package.json**（更少；REVIEW-1 修订）|
| C12 触发 | 0 | 预测 0（实测确认）|
| C13 触发 | 1（新增 `lint:tool-name-checks` 死引用）| **0**（沿用 v0.9.5 已 stub 的 7 个）|
| C14 触发 | 0 | 0 |
| 底层 SDK 升级 | 无 | 无（Pi/Claude/Sentry/electron-updater 全部不动）|
| 新决策点 | 0 | **1**（markdown-preview 接受） |
| `bun.lock` 处理 | `git checkout ... && bun install` 增量 | 同样 |
| 预测评级 | A− | **A−**（与 v0.9.5 同档）|
| 实测评级 | A− | 待 sync 后实测 |
| 推荐方案 | Y++（增稳） | **Y++（增稳）**——但 Phase 2 不存在（无 i18n fix 搭车），简化为 Phase 1 → 1.5 → 3 → 4 |
| 总日历时间预期 | 3-7 天（含静置）| **2-5 天**（少一段 Phase 2.5 静置）|

**判断**：v0.9.6 比 v0.9.5 更小（≈50%），冲突分布更分散（3 git 冲突散在 api-tools + handlers/system + server-core/handlers/rpc/system + 1 语义冲突在 credential-manager-renew.test.ts），无新增改造点。从"sync 工程难度"看比 v0.9.5 略难（有"git 不报警 + 语义破坏" 的暗坑要靠测试 commit gate 兜底，外加 brand-patch 路径上的 2 处 git 冲突要识别）。按 v0.9.5 方案 Y++ 走即可——SOP 已加 REVIEW-3 SSRF 测试 commit gate + REVIEW-4 grep 核查 internal-deeplink 字面量兜底。

---

## 8. 风险提示

| 风险 | 等级 | 缓解 |
|---|---|---|
| **⚠️ credential-manager-renew.test.ts git auto-merge 看似干净 + 语义破坏（REVIEW-3 关键发现）**：git 不会标记 conflict marker，工作树看起来 clean、`git status` 不报警，typecheck 也过——但因为 theirs 删了顶部 `mock.module('../../credentials/index.ts', ...)` 而我们 SSRF describes（L236+L347，共 **7 个测试** = 5 SSRF guard + 2 redirect bypass）仍依赖该 mock 路径，merge 后 V11 运行时 7 个 SSRF 测试会 fail。**只有跑测试才能发现**。这是这次 sync 最容易踩的隐藏陷阱 | 🔴 **高（最大单点风险）** | §6.2 e 必须主动改造 SSRF describes（**不能跳过**）：把 `setCalls = []` 模式改成 spyOn 模式 + afterEach `mockRestore`；§6.3 commit 前必跑 V11 SSRF 单测 24 个全绿；fail 立即 revert merge 重做 §6.2 e |
| **api-tools.ts merge 时静默丢 SSRF marker**：`isTokenGetter` 重写 + `resolveCredential` block 重写都紧邻 SSRF marker，若手工合并不慎可能丢一处 | 🟡 中 | §6.3 marker 基线核查（98 → 98）兜底；§6.4 V11 跑全套 SSRF 回归单测兜底（**24 测试** = api-tools 10 + credential-renew 7 + web-fetch 7，0 fail 才算 pass）|
| **credential-manager-renew.test.ts SSRF describes 漏改 spyOn**：mock pattern 迁移时只改了 v0.9.6 自带的 `describe('refreshApiRenew via refresh()')` beforeEach，没改我们的 SSRF describes（L236/L347），导致 SSRF 测试运行时拿不到 mock 而 fail | 🟡 中 | §6.2 e 步骤明确列出"必须同步改造 SSRF describes 的 mock 接入"；§6.4 V11 跑 SSRF 单测确认 |
| ~~**url-safety.ts INTERNAL_DEEPLINK_SCHEME brand patch 被 diff3 扩大冲突吞掉**~~（REVIEW-3 降级）| 🟢 低 | REVIEW-3 实测 upstream patch 不触碰 L24 行，3-way merge 自动取 ours；§6.3 grep 核查 `INTERNAL_DEEPLINK_SCHEME` 仍作为防御性兜底（1 处命中且值是 `'uagents:'`）|
| **handlers/system.ts:212 + server-core/handlers/rpc/system.ts:286 protocol literal 冲突**（REVIEW-4 新发现）：fork 把 `parsed.protocol === 'craftagents:'` patch 成 `'uagents:'`，v0.9.6 同位置改成 `classification.kind === 'internal-deeplink'`——3-way merge 必标 git conflict。若误盲操作 `--theirs`+`sed` 还原，可能让判断逻辑回到 hardcoded literal | 🟡 中 | §6.2 e2 步骤明确"接受 theirs（用 classification.kind）"——因为 classifyExternalUrl 内部使用 INTERNAL_DEEPLINK_SCHEME = 'uagents:' 常量，等价于原字面量判定 |
| **bun install 副作用**：v0.9.6 dep list 无变化，理论上 bun.lock 重装无副作用 | 🟢 低 | 跟 v0.9.5 sync 时一致；跑 typecheck 验证 |
| **`bun test` fail 数变化**：v0.9.6 新增 6 个测试文件（source-activated-auto-retry / api-tools-credential-freshness / save-source-config-orphan-credential / markdown-link-routing / markdown-preview-helpers / url-safety），需关注是否引入新 latent fail（v0.9.5 baseline 1 fail：send_developer_feedback safe mode）| 🟢 低 | §6.3 跑全套 bun test 对比 fail 数 |
| **多窗口标题 `app.getName()` 不返回 "U Agents"**：极端情况 electron-builder.yml 的 `productName` 漂移到其它值 | 🟢 低 | 跑 V1 实测；漂移时 grep electron-builder.yml 确认 `productName: U Agents` |
| **mid-session credential refresh + M3 SSRF 时序竞态**：上游新加 credential getter 在 fetch 前调用读 vault；我们 ours 的 `assertPublicHttpsUrl` 也在 fetch 前调用。merge 后顺序：`credentialGetter() → assertPublicHttpsUrl() → fetch()`——理论上**无竞态**（credential 读取与 URL 校验解耦）| 🟢 低 | merge 后 V11 SSRF 单测全绿 + V3 mid-session credential refresh 实测覆盖这条调用链；若哪条 case 失败说明上游引入了我们 SSRF guard 没料到的新调用路径，回 §6.2 d 重做 |
| **markdown-preview `src` 字段读任意文件**：理论上 LLM 可生成 `{ "src": "/etc/passwd" }` 这种 block；上游 `MarkdownDocBlock` 通过 platform `onReadFile` callback 读文件，转 `RPC_CHANNELS.file.READ`，**该 IPC handler 已用 `validateFilePath(path, getWorkspaceAllowedDirs(workspaceId))` 做工作区路径校验**——不能读工作区外的文件 | 🟢 低 | 已被上游路径校验覆盖，非新增漏洞；V7 实测时附带尝试 `{ "src": "/etc/passwd" }` 确认 toast "path not allowed" 错误（**不是渲染 /etc/passwd 内容**）|
| **event-processor/types.ts `auto_retry` Effect union 删除**：fork 没改这文件，但若 fork 任意位置仍有 `case 'auto_retry':` switch 分支或 `effect.type === 'auto_retry'` 类型断言，typecheck 会 fail | 🟢 低 | §6.3 跑 `bun run typecheck:all` 自动暴露；预测无 fail（fork 没改这区域）；若 fail 沿 dead union 移除路径删对应代码 |

---

## 9. 顺手 follow-up（可在 sync 同 commit 处理或后续 commit）

| # | 项 | 优先级 | 路径 |
|---|---|---|---|
| F1 | `release-notes/0.9.6.md` ~10 处 brand 替换 + 中文翻译 | P0 | sync 同 commit（沿 0.9.5/0.9.4 历史路径）|
| F2 | 若 §6.3 marker 基线核查 `≠ 98`，立即停下排查 | P0 | sync 同 commit |
| F3 | url-safety.ts grep 核查 `INTERNAL_DEEPLINK_SCHEME` = `'uagents:'`，若漂回 `'craftagents:'` 立即手工 patch | P0 | sync 同 commit |
| F4 | SSRF 单测全套（17+）跑过 | P0 | sync 同 commit |
| F5 | window-manager.ts L79 + L146 comment 内 `"Craft Agents"` 字面量 cleanup（注释 brand）| P3 | 可选；非用户可见 |
| F6 | 跑完 sync 后写正式 `SYNC-v0.9.6-20260526.md` 报告（沿 SYNC-v0.9.5-20260521 模板）| P1 | sync 后另开 commit |
| F7 | 跟踪 v0.9.5 F7（`call_llm + multi_tool_use.parallel + outputSchema` 组合参数错位）是否在 v0.9.6 修复 | P3 | v0.9.6 release notes 未提及，预测仍存在；merge 后跑 reproducer 确认 |
| F8 | ~~评估 v0.9.6 新增的 markdown-preview 是否需要在 i18n locale 加新 key~~ — **已过期**（上游 v0.9.6 自带 2 个 preview.* key，zh-Hans 已翻译"展开预览"/"Markdown 预览"，sync 同 commit 直接接受即可）| —— | —— |
| F9 | `craft-agents-oss#XXX` issue refs 残留 5 处 code comments cleanup（FreeFormInput.tsx / event-processor/processor.ts / SessionManager.ts / shared/agent/backend/types.ts + source-activated-auto-retry.test.ts NEW 文件）| P3 | sync 后另开 commit；非用户可见路径，sync collateral 类问题，可选清理。注意 NEW 文件 source-activated-auto-retry.test.ts 整体接收即可，注释里的 `craft-agents-oss#804` 留作上游 issue 追溯线索 |
| F10 | event-processor/types.ts Effect union 删除 `auto_retry` type — 我们 fork 若有依赖此 type 的代码（不太可能，因为 fork 没 patch 这区域）需同步调整 | P2 | sync 后跑 typecheck:all 自动暴露；若有 fail 沿 dead union 移除路径处理 |
| F11 | M3 SSRF spec 文档追加 v0.9.6 备注：[`M3-SSRF-CONSOLIDATION-SPEC.md`](.planning/M3-SSRF-CONSOLIDATION-SPEC.md) + [`M3-REFRESH-API-SSRF-SPEC.md`](.planning/M3-REFRESH-API-SSRF-SPEC.md) 都应当在 sync 后追加一段说明"v0.9.6 上游已引入 credential getter 模式（mid-session refresh），与我们 SSRF guard 共栈但解耦——调用顺序 `credentialGetter() → assertPublicHttpsUrl() → fetch()` 已验证无竞态"。当前两个 spec 都没提及 v0.9.6 | P2 | sync 后 spec 文档维护任务 |
| F12 | [`07-upstream-sync.md`](.planning/07-upstream-sync.md) §2.7c 暗坑模式表加 C15: "git auto-merge 干净 + 语义破坏（测试 mock 路径远离 hunk）"——把 REVIEW-3 发现作为后续 sync 的预案模式 | P2 | sync 后 SOP 沉淀任务 |

---

## 10. 附录：v0.9.6 release notes 摘要（仅供参考）

> 上游官方 release notes 原文：`apps/electron/resources/release-notes/0.9.6.md`（merge 后落到 fork tree）
> 中文摘要由本仓库 AI 整理（merge 后正式版翻译进 `release-notes/0.9.6.md`）：

**功能（Features）**：
1. **多窗口标题策略**：1 个窗口时标题保持 App 名（"U Agents"，由 `app.getName()` 自动透传）；≥2 个窗口时每个窗口标题改成对应 workspace 名，方便在 Cmd-Tab / Mission Control / Windows 任务栏中区分。Renderer 静态 `<title>` 标签的同步被禁用（page-title-updated event preventDefault）防止覆盖主进程 setTitle 调用
2. **`markdown-preview` 代码块**：和 `html-preview` / `pdf-preview` / `image-preview` 同模式，引用绝对路径的 `.md` 文件就内联渲染。带 `disablePreviewBlocks` 守卫防止 `markdown-preview`-inside-`markdown-preview` 递归（其它嵌套 preview 块不受影响）。注册在 `minimal`（assistant chat）和 `full` 两个 mode，支持 `items` 数组多项。部分修复 #807

**改进（Improvements）**：
1. Online docs 加多窗口标题 + 自动更新窗口恢复说明（`apps/online-docs/go-further/workspaces.mdx`；这是 Mintlify 独立站，与我们 fork 不交互）
2. Online docs intro 文案打磨（Mintlify dashboard 编辑）
3. Messaging gateway 文档反映 0.9.5 fallback 修复（`progress` 和 `final_only` 两种 mode 现在都在工具调用结尾无干净 `text_complete` 时 fallback 到最近的 assistant 文本；真正空 run 仍保持静默）

**Bug 修复（Bug Fixes）**：
1. **多窗口状态自动更新后保留**：electron-updater（Squirrel.Mac）在 `quitAndInstall` 和 `before-quit` 之间销毁所有 BrowserWindow，原 before-quit 保存路径用空 snapshot 覆盖 `~/.craft-agent/window-state.json`（fork 路径：`~/.u-agents/window-state.json`）。`installUpdate` 现在通过 `setBeforeUpdateQuitHook` 在窗口还活着时先 snapshot 一次；before-quit 路径加 empty-snapshot 守卫防止后续覆盖
2. **API source 凭证会话内刷新**：bearer/header/query/basic auth 的 API source 在工具创建时把凭证快照成静态字符串，导致 `source_credential_prompt` 刷新 token 后旧 token 还在用（401 直到完整重启 session）。non-OAuth API source 现在路由通过 credential getter，每次调用读 vault；OAuth 和 renew-endpoint source 不变（原本就有 `TokenRefreshManager`）
3. **authType 切到 'none' 旧凭证清理**：`SourceCredentialManager.getCredentialId()` 把 `'none'` / `'header'` / `'query'` 三种 authType 都映射到 `source_apikey` 槽位。从带凭证 authType 切到 `'none'` 时，旧凭证仍在 slot 里、可能被 rebuild 当成 Cookie header 发出去（而不是新 `defaultHeaders.Cookie`）。`saveSourceConfig` 现在 best-effort 删 `source_apikey` slot（API source + authType:'none' 时）；删除不抛错也不阻塞 config write
4. **危险 URL scheme 拦截给原因 + DOM href 净化**（#807）：react-markdown 的 `defaultUrlTransform` 把 `file:` / `javascript:` URL 净化成空，anchor 处理器 fallback 到 anchor text，`new URL(text)` 拒绝它 → 通用 "Invalid URL" toast 没原因。`DANGEROUS_SCHEMES` 现在是 `Map<scheme, reason>`，reason 流过 `OPEN_URL` 处理器（server-core 和 Electron GUI）。错误信息现在写 `URL blocked (file:). file: URLs are blocked because shell.openExternal can launch local executables on Windows…`。DOM `href` 属性也通过 `defaultUrlTransform` 净化，dangerous scheme 时设 `undefined`，关闭 middle-click / cmd-click 走 Electron `setWindowOpenHandler` 和 `will-navigate` 的逃逸路径
5. **`cache_control` 1h TTL ordering bug + 误判 "tool not supported"**：(1) `upgradePromptCacheTtl` 走 system + messages + top-level `cache_control` 但跳过 `body.tools`。Anthropic 按 `tools → system → messages` 顺序处理 block，拒绝 `ttl='1h'` 出现在 `ttl='5m'` 之后的请求——任何 tool 上残留的 5m 都会触发 `system.0.cache_control.ttl: a ttl='1h' cache_control block must not come after a ttl='5m' cache_control block`。tools 现在在 upgrade 和 disable-strip 两个路径都先走。(2) `parseError` 把同一个 400 误判成 "Model Does Not Support Tools"，因为启发式命中了 API hint string 里的 `tools` 字。过宽 pattern 删除，加 final `invalid_request_error / 400` 分支路由通用 Anthropic 400 到 `invalid_request` 而不是 `unknown_error`
6. **移动 WebUI 长模型名挤掉发送按钮**（#798）：compact bottom-bar layout 把左侧每个 item 设 `shrink-0`、外层 row 没 overflow 守卫，375px 视口下长自定义模型名会溢出 row 把发送按钮挤出可视区。`CompactModelSelector` trigger 现在 shrinkable + `min-w-[64px]` tap target floor；compact bottom-bar 子元素包进自己的 `min-w-0 shrink overflow-hidden` 组，让 model label 先截断、发送按钮保持锚定在右
7. **Headless 服务器自动重试 `source_activated`**（#804，Guillaume Gay 合著）：`[<slug> activated]` 重发逻辑搬进 `SessionManager.processEvent`，headless 部署（WebUI、docker server）也能像 Electron renderer 一样链式 source 激活。Renderer 的 `auto_retry` effect 删除。2s 内容匹配 dedup 窗口（key 在 `{content, deadlineMs, committed}` slot 上挂在 `ManagedSession`）防止混版本 rollout（旧 renderer + 新 server）双发——第一个匹配的 `sendMessage`（server timer 或 legacy RPC）赢、占 slot，后续 2s 内匹配的丢弃。Retry timer + pending slot 在 session 删除两处（main deleteSession path + branch-creation rollback path）取消
8. **PR 378 review 加固**：上面几个 PR 的 review 修补；同时删除一个泄露 source-test module mock（隐藏了 credential cleanup regression）

**Breaking Changes**：无

---

## 11. 修订日志

| 修订 | 日期 | 范围 | 触发 |
|---|---|---|---|
| 初版 | 2026-05-26 | 0-10 章 | 用户："看下有新版本了。v0.9.6" → "规划升级" |
| REVIEW-1 | 2026-05-26 同日 | §0 TL;DR C11/i18n 行 / §2.4 C11 文件清单 / §3 #28 row / §4.1 C11 表 / §6.1 预测冲突清单 / §6.2 c 文案 / §6.3 i18n parity baseline / §9 F8/F9/F10 补盘 / 本日志 | 用户："整体 review 一轮"。8 处事实/计数修订（详见下表） |
| REVIEW-2 | 2026-05-26 同日 | §3 #28 行号 L107→L105、距离 246→248 / §6.4 V11 测试数 17+ → **24** + 拆分三个文件单独命令 / §8 加 3 项漏盘风险（mid-session credential refresh + SSRF 时序 / markdown-preview path safety / event-processor types auto_retry union） / §6.5 加 Phase 1.5 观察清单 8 项 + Phase 2.5 不存在说明 / §7 对比表 Phase 简化 + 日历时间 3-7→2-5 天 / 本日志 | 用户："要在 review 一轮"。6 项深一层修订 |
| REVIEW-3 | 2026-05-26 同日 | §0 TL;DR 冲突等级分类重写（"2 真 + 1 验证" → "1 git 冲突 + 1 语义冲突 + 0 待验证"） / §0 TL;DR 加 fork-since-v0.9.5 文件交集行（仅 root package.json）/ §3 url-safety.ts row 从 🟡 待验证降到 ❌ 干净（hunk 实测不触碰 L24）/ §3 credential-manager-renew.test.ts row 改为 ⚠️ 语义冲突（git 不报警）/ §6.1 预期冲突列表 18→17 + url-safety.ts 移到"不出"组 / §6.3 加 SSRF 测试 gate（commit 前必跑全套 24 测试）/ §8 加 🔴 高风险条 "git auto-merge 看似干净 + 语义破坏" / §8 url-safety.ts 风险降到 🟢 低 / 本日志 | 用户："REVIEW-3"。**1 项关键风险被前两轮漏掉**：credential-manager-renew.test.ts merge 后 git 不报警但 SSRF 测试全 fail（这是这次 sync 最容易踩的隐藏陷阱） |
| REVIEW-4 | 2026-05-26 同日 | §0 TL;DR 冲突等级 "1 git + 1 语义" → **"3 git + 1 语义"** / §3 加 "brand-patch 路径外的 §3.7 隐性冲突" 子表（handlers/system.ts:212 + server-core/handlers/rpc/system.ts:286）/ §6.1 预期冲突 17→**19** + 列 5 个 git auto-merge 干净的文件 / §6.2 加 e2 步骤处理两处 brand-patch git 冲突 / §8 加 🟡 中风险条 "deeplink protocol literal vs classification refactor" / 本日志 | 用户："行在 review 一轮"。**2 处之前漏盘的 git 冲突**：handlers/system.ts L212 + server-core/handlers/rpc/system.ts L286 的 `'uagents:'` 字面量 vs upstream `classification.kind` 重构（base→ours 改字面量，base→theirs 重构成 kind 判断，3-way merge 必标 conflict）。同时确认 `auto_retry` Effect 删除完全没问题（fork 3 处引用全在 v0.9.6 同步删除的文件里）|
| REVIEW-5 | 2026-05-26 同日 | §8 SSRF 测试数 "9 个 fail" → **"7 个 fail"**（5 SSRF guard + 2 redirect bypass，实测 7 不是 9）/ §7 对比表"2 真 + 1 待验证"→**"3 git + 1 语义 + 0 待验证"**、"4 文件 4 处"→**"3 文件 4 处"**（同步 REVIEW-1/3/4 修订）/ §7 末段"冲突类型更集中"→**"冲突分布更分散"**（事实修订）/ §6.3 commit message 全面更新（反映 REVIEW-1/3/4 实际冲突清单）/ §6.2 b Python 脚本加 BASE_BRANCH 环境变量 + 失败诊断输出（防 fork 用了非 main 主分支）/ 本日志 | 用户："REVIEW-5"。前 4 轮独立修订没全程一致化导致 §7 对比表 / §6.3 commit message 都落后 2-4 轮，§8 SSRF 测试数 9→7 是事实校准；Python 脚本 BASE_BRANCH 硬编码 'main' 是 inherit-from-v0.9.5 的边缘案例 |
| REVIEW-6 | 2026-05-26 同日 | §0 TL;DR L20 (c) "9 个 fail" → **"7 个 fail"**（REVIEW-5 漏改一处）/ §2.2 简表 credential-manager-renew row "9 个" → **"7 个"**（REVIEW-5 漏改第 2 处）/ §3 #44b/#44d row 分类标签"✅ 1 真冲突" → **"⚠️ 1 语义冲突（高危，git 不报警）"**（REVIEW-3 漏改）/ §6.2 d 标题加 "git 标记 marker，§3.7 路径" 限定 / §6.2 e 标题"§3 真冲突" → **"⚠️ §3 语义冲突 — git 不报警，必须主动改造"** / §9 加 F11/F12（M3 SSRF spec 追加 v0.9.6 备注 + 07-upstream-sync C15 暗坑模式沉淀）/ 本日志 | 用户："继续 REVIEW-6"。**4 处 REVIEW-3/5 漏改残留**：§0 TL;DR / §2.2 简表 / §3 详表 / §6.2 e 标题分类——都是"9→7"和"真冲突→语义冲突"的连锁同步问题。同时加 2 个 sync 后 spec 文档维护任务（F11 SSRF spec 反映 v0.9.6 / F12 07-upstream-sync 加 C15 暗坑模式）|

**REVIEW-1 修正的事实错误**：

| # | 章节 | 原文 | 修正后 | 验证命令 |
|---|---|---|---|---|
| E1 | §0 TL;DR C11 行 / §2.4 / §3 #28 / §4.1 | "4 文件 4 处" | "3 文件 4 处"（main/index.ts 是本地 `./auto-update` import 扩展，不是 `@craft-agent/`，不算 C11）| `gh api ... compare --jq .files[].patch \| grep '^+.*@craft-agent/'` 实测 4 处分布在 3 个文件 |
| E2 | §0 TL;DR release-notes 行 | "brand 五件套 ~10 命中" | "brand 五件套 6 行 ~7 处命中" | `curl release-notes/0.9.6.md \| grep -ciE 'craft\|lukilabs'` = 6 |
| E3 | §0 TL;DR | 缺少 i18n 状态 | 加 i18n 行：上游已翻译 zh-Hans 的"展开预览"/"Markdown 预览"，fork 不需要二次翻译 | `gh api ... locales/zh-Hans.json` 实测已翻译 |
| E4 | §6.1 预期冲突 | "6-7 个冲突文件" | "~18 个" 完整列表（15 package.json + bun.lock + 2 §3.7 真冲突 + 1 §3.7 待验证 + 4 个自动 merge 的 import 文件清单单独列） | merge 算法分析 |
| E5 | §6.2 c | 文案误把 main/index.ts 当 C11 | 改成"main/index.ts 本地 import 扩展（不是 C11）+ 3 文件 4 处 @craft-agent/" | 同 E1 |
| E6 | §6.3 i18n parity | "1460 keys" | "1462 keys"（v0.9.5 baseline + v0.9.6 新增 2 key）| 加 v0.9.5 sync 报告 baseline + i18n 实测 |
| E7 | §9 F8 | 列为 P2 i18n parity 待办 | 标已过期（zh-Hans 已翻译）| 同 E3 |
| E8 | §9 F9/F10 | 漏盘 | 加 F9（5 处 craft-agents-oss# code comment cleanup） + F10（event-processor/types.ts auto_retry union 删除可能影响 fork dep）| `gh api ... \| .has_issue_ref` 实测 5 文件命中 |

**REVIEW-6 后事实校准（4 处连锁同步漏改 + 2 个 sync 后 spec 维护任务）**：

REVIEW-3 在 §8 把 credential-manager-renew.test.ts 改为"语义冲突（git 不报警）"，REVIEW-5 把"9 个 fail"改成"7 个"——但前者只改了 §8 风险表（漏改 §0 TL;DR + §2.2 简表 + §3 详表 + §6.2 e 标题），后者只改了 §8 + §0 一处（漏改 §0 另一处 + §2.2 简表 + §3 详表）。REVIEW-6 把这两轮的连锁同步全跑了一遍：

| # | 章节 | 原文 | 修正后 |
|---|---|---|---|
| RW1 | §0 TL;DR L20 (c) | "运行时 9 个 SSRF 测试全 fail" | "运行时 **7 个 SSRF 测试全 fail（5 SSRF guard + 2 redirect bypass）**" |
| RW2 | §2.2 简表 credential-manager-renew row | "merge 后跑 `bun test` 会出现 9 个 SSRF 测试 fail" | "merge 后跑 `bun test` 会出现 **7 个 SSRF 测试 fail（5 SSRF guard + 2 redirect bypass）**" |
| RW3 | §3 #44b/#44d row 分类标签 | "✅ 1 真冲突" | "**⚠️ 1 语义冲突（高危，git 不报警）**" |
| RW4 | §6.2 d 标题 | "§3 真冲突" | "§3 真冲突 — **git 标记 marker，§3.7 路径**"（精确化）|
| RW5 | §6.2 e 标题 | "§3 真冲突" | "**⚠️ §3 语义冲突 — git 不报警，必须主动改造**" |
| RW6 | §9 follow-up | F1-F10 | 加 **F11 + F12**：M3 SSRF spec 追加 v0.9.6 备注 + 07-upstream-sync 加 C15 暗坑模式沉淀 |

**REVIEW-6 跨文档一致性确认**：

| 检查项 | 结果 |
|---|---|
| PREVIEW marker 基线预测 98 → 98 vs CLAUDE.md §3.7 当前 98 | ✅ 一致 |
| PREVIEW §6.1 列 19 必出冲突 vs §3 详表枚举（15 package.json + bun.lock + api-tools.ts + handlers/system.ts + server-core/handlers/rpc/system.ts）| ✅ 19 ✓ |
| PREVIEW §11 REVIEW-1..5 修订日志条目时序逻辑 | ✅ 一致 |
| `M3-SSRF-CONSOLIDATION-SPEC.md` / `M3-REFRESH-API-SSRF-SPEC.md` 是否提及 v0.9.6 | ⚠️ 当前未提，已加 F11 作为 sync 后维护任务 |
| `07-upstream-sync.md` §2.7c C 类暗坑模式是否含 C15（git 不报警 + 语义破坏）| ⚠️ 当前未含，已加 F12 作为 sync 后 SOP 沉淀任务 |

---

**REVIEW-5 后事实校准（文档自洽性 + 数字精度）**：

5 处之前各轮 review 没全程一致化的细节修订：

| # | 章节 | 原文 | 修正后 | 验证 |
|---|---|---|---|---|
| RV1 | §8 SSRF 测试 fail 数 | "9 个 SSRF 测试 fail" | "7 个 SSRF 测试 fail"（5 SSRF guard + 2 redirect bypass 实测 = 7）| `awk 'NR>=236' credential-manager-renew.test.ts \| grep -cE "^[[:space:]]+(test\|it)\("` = 7 |
| RV2 | §7 对比表 §3.7 真冲突 | "2 真 + 1 待验证（url-safety.ts）" | "3 git + 1 语义 + 0 待验证" | REVIEW-3 + REVIEW-4 修订 |
| RV3 | §7 对比表 C11 触发 | "4 文件 4 处" | "3 文件 4 处" | REVIEW-1 修订 |
| RV4 | §7 末段"冲突类型更集中" | 描述 v0.9.5/v0.9.6 同质 | "冲突分布更分散（git 不报警的暗坑 + brand-patch 路径多 2 处）" | 实际分类后体现 |
| RV5 | §6.3 commit message 模板 | "2 处真冲突" + "4 文件 4 处" | "3 git + 1 语义" + "3 文件 4 处" + 新增 handlers/system.ts + server-core/handlers/rpc/system.ts 条目 | 同步 REVIEW-3/4 |
| RV6 | §6.2 b Python 脚本 | 硬编码 `'git show main:{p}'` | 加 `BASE_BRANCH` 环境变量 + 失败诊断输出 | 防 fork 主分支非 main（v0.9.5 inherited 的边缘案例）|

**REVIEW-5 排除（再次确认前轮 review 没漏掉的）**：

| 检查项 | 结果 |
|---|---|
| i18n 1460 baseline | ✅ en.json + zh-Hans.json 实测各 1460 keys；merge 后 +2 = 1462 |
| classifyExternalUrl 'dangerous' shape 变化 | ✅ 只加 optional `scheme?` 字段，原 `reason` 字段保留；fork `packages/ui/src/lib/open-external-url.ts:31` 访问 `.reason` 仍工作 |
| SessionManager BranchRollbackManagedSession | ✅ subset interface 不依赖新字段（REVIEW-4 已确认）|
| 全树 SSRF 测试总数 | ✅ 24 = 10 (api-tools-ssrf) + 7 (credential-manager-renew SSRF describes) + 7 (web-fetch-ssrf) |

---

**REVIEW-4 关键发现（漏盘的 git 冲突）**：

REVIEW-1/2/3 都把冲突等级判断收敛到"1 git + 1 语义"，但 REVIEW-4 通过 `grep -rn "'uagents:'\|\"uagents:\""` 全树扫描发现 fork 共 5 处 `'uagents:'` 字面量 patch，其中 **2 处与 v0.9.6 upstream hunk 撞**：

- `apps/electron/src/main/handlers/system.ts:212` — `if (parsed.protocol === 'uagents:')` vs theirs `if (classification.kind === 'internal-deeplink')`
- `packages/server-core/src/handlers/rpc/system.ts:286` — 同上同模式

3-way merge 行为：base→ours 改了字面量，base→theirs 重构成 kind 判断 → **必触发 git conflict marker**。解决方法：接受 theirs（因为 classifyExternalUrl 内部用 INTERNAL_DEEPLINK_SCHEME = 'uagents:' 常量，等价于原字面量判定）。

这两处冲突在 REVIEW-1/2/3 都被识别为 "C11 import 添加"（看似只是新 import），其实导入了 classifyExternalUrl 之外还改了判断逻辑——前轮 review 只盯住 import 行，没看到下面的判断 block。

**`auto_retry` Effect 删除连锁检查 ✅**：fork 3 处引用（App.tsx:843 case / processor.ts:209 emit / types.ts:526 union member）全部在 v0.9.6 同步删除的文件里，theirs 的 3 个协调修改正好删完。fork 没有其他位置（grep 全树确认）引用该 Effect type。

**其他可能的暗坑检查结果（REVIEW-4 全部排除）**：

| 检查项 | 结果 |
|---|---|
| sources/storage.ts +37 行（orphan credential cleanup）| ✅ 干净——fork 无 §3.7 marker 在 sources/storage.ts（§3.7 #32a 在 `config/storage.ts`，不同文件）|
| secure-storage.ts +15 行 deleteSync | ✅ 干净——fork 无 marker |
| agent/errors.ts +12 行（broad pattern 删除）| ✅ 干净——fork 无 marker，新 invalid_request branch 加成 |
| agent/backend/types.ts +3 行 | ✅ 仅 comment 改动（描述 source_activated → server-side resend 新流程）|
| markdown/index.ts export 增加 | ✅ 干净——base==theirs `@craft-agent/ui` comment 行 vs ours `@u-agents/ui`，git 自动取 ours |
| SessionManager.ts +147 行 ManagedSession 字段 | ✅ 干净——`session-branch-cleanup.ts` 的 `BranchRollbackManagedSession` 是 subset interface，不依赖新字段 |
| RPC channels 新增 | ✅ 0 新增（diff 不触碰 ipc-channels / RPC_CHANNELS / transport/）|

---

**REVIEW-3 关键发现（最重要）**：

`credential-manager-renew.test.ts` 是这次 sync 最容易踩的**隐藏陷阱**：upstream 把顶部 `mock.module('../../credentials/index.ts', ...)` 删了，改成 spyOn 模式；我们 SSRF describes（L236/L347）在文件中段，**远离 upstream 的 L1-30 + L85-105 hunk**——git 3-way merge 会把这文件自动 merge 干净（`git status` 不会显示冲突，typecheck 也不报警），但**运行 V11 SSRF 测试时 9 个测试全 fail**（因为我们 SSRF describes 仍在用 `setCalls = []` + `mockGet.mockImplementationOnce(...)` 旧 mock 路径，而该路径已被 theirs 删除）。

这是 REVIEW-1 和 REVIEW-2 都漏掉的——前两轮都把它标为"git 标记冲突 → 手工合并"，实际是"git 不标记冲突 → 主动改造 + 运行测试才能发现"。新的 §6.3 commit gate 把"跑 SSRF 测试全套"作为 commit 前必经核查，挡住这条暗坑。

**REVIEW-3 修正的事实错误**：

| # | 章节 | 原文 | 修正后 | 验证命令 |
|---|---|---|---|---|
| RR1 | §0 TL;DR 冲突等级 | "2 真冲突 + 1 待验证" | "1 git 冲突 + 1 语义冲突（高危）+ 0 待验证" | 实际 diff 分析：api-tools.ts = git diff 冲突；credential-manager-renew.test.ts = git auto-merge clean + 语义破坏（hunk 在 L1-30/L85-105 远离 SSRF describes L236/L347）；url-safety.ts = upstream patch 不触碰 L24 行（实测 diff context 显示）|
| RR2 | §0 TL;DR 缺 fork 文件交集行 | —— | 加一行：`git log f863f915..HEAD --name-only` 实测 fork 自 v0.9.5 sync 后只改 4 非 doc 文件（build-win.ps1 / renderer/main.tsx / bun.lock / root package.json），与 v0.9.6 改的 66 文件仅 root package.json 重合 | `git log f863f915..HEAD --name-only --pretty=format: \| sort -u` |
| RR3 | §3 url-safety.ts row | 🟡 1 待验证 | ❌ 干净 | upstream patch context 显示 L24 INTERNAL_DEEPLINK_SCHEME 行在 unchanged context，不在 hunk 范围内 → 3-way merge 自动取 ours |
| RR4 | §3 credential-manager-renew.test.ts row | "✅ 1 真冲突" | "⚠️ 语义冲突（高危，git 不报警）" | hunk 位置 L1-30 + L85-105 远离 SSRF describes L236/L347 → git auto-merge 干净；但 mock.module 被删 → 运行时 SSRF mocks 失效 |
| RR5 | §6.1 预期冲突 | "17 个必出 + 1 个可能" | "17 个必出 + 0 个可能" | 同 RR3 |
| RR6 | §6.3 commit step | 仅跑常规 typecheck/lint/单测 | 加 SSRF 测试 gate（commit 前必跑 24 个，0 fail 才能 commit）| 防 RR1 中的语义冲突隐患 |
| RR7 | §8 风险表顶部 | 第一行是 api-tools.ts 🟡 中 | 顶部加 🔴 高风险条 "git auto-merge 看似干净 + 语义破坏（最大单点风险）"，api-tools.ts 降到第二条 | 严重性排序优先 |
| RR8 | §8 url-safety.ts 风险 | 🟡 中 | 🟢 低（标删除线 + REVIEW-3 降级备注）| 同 RR3 |

**REVIEW-2 修正的事实错误**：

| # | 章节 | 原文 | 修正后 | 验证命令 |
|---|---|---|---|---|
| R1 | §3 #28 row | 行号 L107 / 距离 246 行 | L105 / 248 行（v0.9.5 base L102 + fork shift 3）| `grep -n "from './auto-update'" apps/electron/src/main/index.ts` 实测 L105 |
| R2 | §6.4 V11 | "17+ SSRF 单测" | **24 SSRF 测试**（api-tools-ssrf 10 + credential-manager-renew SSRF describes 7 + web-fetch-ssrf 7）| `grep -cE "^[[:space:]]+(it\|test)\(" <each-ssrf-test-file>` 实测 |
| R3 | §8 风险表 | 缺 mid-session credential refresh + SSRF 时序确认 | 加风险行：调用顺序 `credentialGetter() → assertPublicHttpsUrl() → fetch()` 无竞态 | 静态推理 + V3+V11 实测覆盖 |
| R4 | §8 风险表 | 缺 markdown-preview path safety | 加风险行：`MarkdownDocBlock` 通过 `validateFilePath` + `getWorkspaceAllowedDirs` 已被上游路径校验覆盖，非新增漏洞 | grep `validateFilePath` 实测 server-core/handlers/rpc/files.ts:37 调用证实 |
| R5 | §8 风险表 | 缺 event-processor types auto_retry union 删除影响 | 加风险行：fork 没改这区域，typecheck 自动暴露；预测无 fail | upstream patch list 显示 types.ts L523 删 `\| { type: 'auto_retry'; ... }` |
| R6 | §6.4 末尾 | 缺 Phase 1.5 观察清单 | 加 §6.5 8 项观察点 + Phase 2.5 不存在说明（v0.9.6 无 i18n fix 搭车）| mirror v0.9.5 PREVIEW §11.11.3 模板 |

**REVIEW-4 后事实结论修订**：A− 评级保持 / 0 §3.3 真冲突 / **3 git 冲突（api-tools.ts + handlers/system.ts:212 + server-core/handlers/rpc/system.ts:286）+ 1 语义冲突（高危）+ 0 待验证** / 0 C13 新增 / 0 §3.7 新 marker / Pi SDK 不升级（全包确认 0.73.1 + electron-updater ^6.8.0）/ 1 决策点（接受 markdown-preview）/ **fork 自有改造与 v0.9.6 仅 1 文件交集**（root package.json）。

**总日历时间从 3-7 天微调到 2-5 天**——v0.9.6 不引入 i18n fix 搭车，Phase 2.5 静置可省略。

---

> **本报告产出时间**：2026-05-26（初版 + REVIEW-1 + REVIEW-2 + REVIEW-3 + REVIEW-4 + REVIEW-5 + REVIEW-6 同日）
> **预测评级**：A−（3 git 冲突 + 1 语义冲突（高危，commit-gate 兜底）+ 0 待验证 / 0 C13 新增 / 0 §3.7 新 marker）
> **建议执行时机**：本周内
> **建议执行流程**：v0.9.5 方案 Y++ 简化版（Phase 1 → 1.5 → 3 → 4，跳过 Phase 2/2.5；已 macOS arm64 + Windows x64 双平台验证）
> **REVIEW-3 强制 gate**：commit 前必跑 24 个 SSRF 测试全套，0 fail 才能 commit
> **REVIEW-4 强制核查**：merge 后 `grep -n "internal-deeplink" packages/server-core/src/handlers/rpc/system.ts apps/electron/src/main/handlers/system.ts` 应各 1 处命中（接受 theirs 后的判断行）
