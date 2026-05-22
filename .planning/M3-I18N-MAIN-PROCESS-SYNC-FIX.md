# M3-I18N-MAIN-PROCESS-SYNC-FIX — 主进程 i18n 启动同步修复

> **优先级**：P1（用户体验 bug，影响所有新会话首次标题生成）
> **目标**：消除"必须手动切一次语言，标题才跟随用户偏好"的隐性步骤；让每次 App 启动后，标题生成立刻使用用户选定的语言
> **预估**：实施 0.25 天（**1 行代码** + 1 处 `// U-API:` 标记 + §5.1+§6.4 desktop 实测 10 步）。**不写单测**（见 §5.2 决策）
> **关联**：[`10-i18n-zh.md`](10-i18n-zh.md)（i18n 总策略）+ [`CLAUDE.md §3.7`](../CLAUDE.md)（U-API 标记表新增 1 项）

---

## 0. TL;DR

`apps/electron/src/renderer/main.tsx` 在 `setupI18n([LanguageDetector, initReactI18next])` 之后**立即**通过 IPC 把当前 `i18n.resolvedLanguage` 推给主进程一次。

**核心改造 1 行代码**，但 review 发现这一行会**激活 3 条 dormant 下游路径**（preferences system prompt 注入、原生菜单语言、webui 用户的 prompt——见 §6.4），实测时**不能只看标题**，必须观察 chat 输出风格、菜单语言变化。

修复属于 "preferences/menu 模块本来设计意图但因 main 进程 i18n 没同步而 dormant"——**是修 bug 不是引入 regression**，但行为变更必须明示。

---

## 1. 问题现象

**重现步骤**（已由用户在 v0.9.4 desktop build 实测确认）：

1. 启动 App
2. **不要进入设置改语言**——直接新建会话发送一条中文消息
3. 观察会话标题：**始终为英文**（如 "User Discussing Project"）
4. 进入 Settings → Appearance → Language → 切换到任意语言（再切回原值也行），强制触发 `i18n.changeLanguage`
5. 新建会话发送中文消息
6. 标题变为中文 ✅

**用户报告原话（2026-05-20）**："手动切一次语言，然后生成的标题正常了。"

---

## 2. 根因（已坐实的事实）

| 进程 | i18n 初始化 | 调用点 | 启动后 `i18n.resolvedLanguage` |
|---|---|---|---|
| **Renderer（UI）** | `setupI18n([LanguageDetector, initReactI18next])` | [`apps/electron/src/renderer/main.tsx:17`](../apps/electron/src/renderer/main.tsx) | 从 `localStorage["i18nextLng"]` 读取，正确 |
| **Main（Electron 主进程）** | `setupI18n()` —— **无 detector** | [`apps/electron/src/main/index.ts:63`](../apps/electron/src/main/index.ts) | 永远 = `fallbackLng` = `"en"`（Node.js 侧无 localStorage） |

**同步机制存在但触发条件不足**：

[`apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:287-288`](../apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx)
```ts
i18n.changeLanguage(value)                       // 更新 renderer 端
window.electronAPI?.changeLanguage?.(value)       // IPC 推到 main
```

[`apps/electron/src/main/index.ts:873-877`](../apps/electron/src/main/index.ts)
```ts
ipcMain.handle('i18n:changeLanguage', async (_event, lang: string) => {
  i18n.changeLanguage(lang)
  const { rebuildMenu } = await import('./menu')
  await rebuildMenu()
})
```

这条同步链**仅在用户主动操作下拉框时跑一次**。renderer 启动期不会主动推送一次"当前语言"给 main，所以 App 重启后 main 进程 i18n 回到 `"en"`，直到用户手动改一次。

**标题生成读的是 main 进程 i18n**：

- 自动生成：[`packages/server-core/src/sessions/SessionManager.ts:6451`](../packages/server-core/src/sessions/SessionManager.ts)
  ```ts
  const genLangCode = (i18n.resolvedLanguage ?? 'en') as LanguageCode
  ```
- 手动重生：[`packages/server-core/src/sessions/SessionManager.ts:4679`](../packages/server-core/src/sessions/SessionManager.ts)
  ```ts
  const titleLangCode = (i18n.resolvedLanguage ?? 'en') as LanguageCode
  ```

`server-core` 由 main 进程直接 import（[`apps/electron/src/main/index.ts:73`](../apps/electron/src/main/index.ts)），共享同一个 i18n 单例。

**i18next 模块单例性已坐实**：

```
node_modules/i18next/                         ✓ 存在（hoisted 到顶层）
packages/shared/node_modules/i18next/         ✗ 不存在（被 hoist）
packages/server-core/node_modules/i18next/    ✗ 不存在（被 hoist）
```

bun workspaces（`package.json` 配置 `"workspaces": ["packages/*", "apps/*"]`）把 i18next 安装到顶层 `node_modules`，main 进程中所有 `import { i18n } from '@u-agents/shared/i18n'` 拿到的是**同一份 i18next default export 实例**。renderer 是独立 JS context（不同进程），自然是另一份。

**最终注入到 prompt**（[`packages/shared/src/utils/title-generator.ts:49-55`](../packages/shared/src/utils/title-generator.ts)）：

```ts
function buildLanguageInstruction(language?: string): string {
  const safe = sanitizeLanguage(language);
  if (safe) return `Reply in ${safe}.`;        // ← language="English" 时模型严格英文
  return 'Reply in the same language as the user\'s messages.';
}
```

当 main 进程 i18n = `"en"` → `LOCALE_REGISTRY["en"].nativeName = "English"` → prompt 注入 `Reply in English.` → 模型强制说英文，即便用户消息全是中文。

---

## 3. 修复方案选择

| 方案 | 改动量 | 风险 | 推荐 |
|---|---|---|---|
| **A. Renderer 启动推送** | 1 行 | 极低 | ⭐ 选 A |
| B. Main 启动读持久化文件 | 中 | 中（**且与上游已废弃的 `prefs.language` 字段方向冲突**——见下方关键证据） | — |
| C. 标题生成请求时由 renderer 携带 locale | 中-大 | 中（跨多个调用点，破坏 server-core 自治） | — |

**关键证据：上游已主动废弃 prefs.language 字段**

[`preferences.ts:91`](../packages/shared/src/config/preferences.ts) 注释明确写：
> Derive language from the app's i18n setting (Appearance > Language).
> **This replaces the old `prefs.language` field which is now ignored.**

意思是：**上游曾经有 `prefs.language` 字段（main 可读），后来废弃改为读 `i18n.resolvedLanguage`**。这是上游有意的架构决策——"language 偏好归 i18n，不归 preferences"。

**方案 B 是把这个架构决策回滚**——往后退一步，让 preferences 文件重新承载 language。这与上游主动选择的方向相反，未来同步上游会持续产生冲突。

**方案 A 是顺着上游架构走**——既然 i18n 是 source of truth，那解决问题的方式是让 main 进程的 i18n 跟 renderer 的 i18n 同步，不是把状态拷贝到另一份文件。

**选 A 的理由**：

1. 复用已存在的 IPC 通道（`i18n:changeLanguage`），不引入新协议
2. 不破坏 server-core 现有从 `i18n` 单例读语言的简洁性
3. 修复后 main 端的 i18n 同样能用于其它依赖项（菜单 rebuild、main process 自有的 `i18n.t()` 调用、未来其它需要 locale 的后端功能）
4. 一行代码，sync 时几乎不产生冲突

---

## 4. 具体改造（方案 A）

### 4.1 单一改动点

**文件**：`apps/electron/src/renderer/main.tsx`

**当前（L11-17）**：
```ts
import { setupI18n } from '@u-agents/shared/i18n'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import './index.css'

// Initialize i18n before any React rendering
setupI18n([LanguageDetector, initReactI18next])
```

**改造后**（**两处改动**：① L11 import 行追加 `i18n` ② L17 之后追加同步块）：

> ⚠️ 给外部 AI：下方代码块是改造后文件 L11-L20 的**完整状态**，不是"只追加的内容"。请用整段替换原 L11-L17，**确保**原来的 `import { setupI18n }` 不再单独出现，避免重复 import。

```ts
import { setupI18n, i18n } from '@u-agents/shared/i18n'  // ← 多 import 一个 i18n
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import './index.css'

// Initialize i18n before any React rendering
setupI18n([LanguageDetector, initReactI18next])

// U-API: 把 detector 解析到的语言立即推给主进程，修复"重启后必须手切语言标题才中文"的 bug。
// setupI18n 用 initImmediate:false（同步 init），此时 resolvedLanguage 已可用。
// 主进程 handler 内部会调 rebuildMenu()，理论上可能抛——用 .catch 兜底而非 void。
// 详见 .planning/M3-I18N-MAIN-PROCESS-SYNC-FIX.md
window.electronAPI?.changeLanguage?.(i18n.resolvedLanguage ?? 'en')
  ?.catch((err) => console.warn('[i18n] startup sync to main failed:', err))
```

### 4.2 关键约束

- **`.catch()` 兜底，不用 `void`**：主进程 handler [`main/index.ts:875`](../apps/electron/src/main/index.ts) 内部 `await rebuildMenu()` 会动态 `import('./auto-update')`，理论存在抛错路径；用 `.catch` 比 `void` 更稳，且把日志落到 renderer console 不污染 main 日志
- **`?.` 链路**：兼容 preload 未注入的场景（理论上不会出现，但与现有 `AppearanceSettingsPage.tsx:288` 风格一致）
- **同步可用性**：[`packages/shared/src/i18n/setupI18n.ts:38`](../packages/shared/src/i18n/setupI18n.ts) 使用 `initImmediate: false`，调用返回时 detector 已完成查询，`resolvedLanguage` 已可读
- **不动 main/index.ts**：现有 `ipcMain.handle('i18n:changeLanguage', …)` 已完美处理，不需要新增 handler

### 4.2.1 IPC handler 注册时机 — 已坐实早于 BrowserWindow 创建

review-3 实地核查 [`apps/electron/src/main/index.ts`](../apps/electron/src/main/index.ts) 启动顺序，确认 race 不会触发：

```
app.whenReady().then(async () => {
  L436   windowManager = new WindowManager()              // 只构造 manager，不开窗
  L439   createApplicationMenu(windowManager)             // 初次菜单（main i18n = en）
  L605   const instance = await bootstrapServer(...)      // 等 server 就绪
  L746-867  ipcMain.handle(...) × N                       // 一堆业务 handler 注册
  L873   ipcMain.handle('i18n:changeLanguage', ...)       // ← 我们用的 handler
  L981   windowManager.setRpcEventSink(...)
  L997   await createInitialWindows()                     // ← 这里才真正创建 BrowserWindow → renderer JS
})
```

**结论**：handler 注册（L873）必定在 BrowserWindow 创建（L997）之前 → renderer 启动推送 IPC 时 handler **一定已注册** → 不会出现 "No handler registered for 'i18n:changeLanguage'" 错误 → `.catch` 兜底只用于 `rebuildMenu` 等下游抛错，不用于 handler 缺失。

**潜在隐患**（不在本 fix 范围）：如果未来上游重排序，把 `ipcMain.handle('i18n:changeLanguage')` 移到 `createInitialWindows()` 之后，本 fix 会失效。`.catch` 兜底确保不崩溃但语言不同步——届时同步必须 review 顺序。

### 4.3 不要做的事

- ❌ 不要顺手改 `apps/electron/src/main/index.ts:63` 的 `setupI18n()` 加 detector——`i18next-browser-languagedetector` 在 Node 环境会报 `window is not defined`
- ❌ 不要在 main 进程读 renderer 的 localStorage——这是跨进程隔离，无合法路径
- ❌ 不要改 `setupI18n` 默认 `fallbackLng`——其它非 desktop 入口（apps/viewer、test）依赖现状

---

## 5. 验证清单

### 5.1 实测（必须做，desktop A-α）

| 步骤 | 期望 |
|---|---|
| 1. 关闭 App | — |
| 2. 检查 `localStorage["i18nextLng"]`（DevTools）= `zh-Hans` | — |
| 3. 重启 App | UI 中文 ✓ |
| 4. **不进入设置**，直接新建会话发"今天天气怎么样" | 标题中文（如"天气咨询""今天天气询问"等 2-5 字中文）✓ |
| 5. 重启 App，切换 localStorage = `en`，再启动 | 标题英文 ✓ |
| 6. 启动后切语言 zh → en → zh，新建会话发中文 | 标题中文 ✓（回归现有 IPC 路径） |

### 5.2 单元测试 — **不写**（依赖 §5.1 实测兜底）

**原本设想**新增 `apps/electron/src/renderer/__tests__/i18n-startup-sync.test.ts` 覆盖此路径，但 review 后**主动放弃**：

| 问题 | 说明 |
|---|---|
| jsdom 跑不动 main.tsx | 动态 `import('../main')` 会触发整个 React render + Sentry init + JotaiProvider 等顶层逻辑，jsdom 环境会大量崩 |
| mock 复杂度爆炸 | 要 mock `window.electronAPI` + localStorage + Sentry + ReactDOM.createRoot——成本远超被测代码的 1 行 |
| 测试技术债 | 强行写出来很可能成为"上游同步时第一个被删的脆弱测试"，与 §3.7 C5 "新改造点必加单测" 表面合规但实际无价值 |

**替代方案**：

1. §5.1 desktop 实测 6 步（已覆盖核心场景）
2. 如果后续 i18n 同步出 regression，再用更轻量的方式补测（例如把"推送函数"抽成独立 helper 再单测——但当前 1 行代码不值得抽）

> 这与 [`CLAUDE.md §3.7 C5`](../CLAUDE.md) "新改造点必加单测" 是**有意识的偏离**，理由记录在此供 review 追溯。如果将来抽 helper，再补单测。

### 5.3 typecheck + lint

```bash
cd packages/shared && bun run tsc --noEmit
cd apps/electron && bun run tsc --noEmit
bun run lint:electron        # 不应新增 warnings
bun run validate:ci          # 全套 i18n 检查仍通过
```

### 5.4 grep 反向核对

```bash
# 应找到 1 处新增的 // U-API: marker（在 renderer/main.tsx）
grep -n "U-API" apps/electron/src/renderer/main.tsx
# 期望：1 行

# 标题生成 i18n 读点位仍是 2 处，无意外增加/减少
grep -n "i18n.resolvedLanguage" packages/server-core/src/sessions/SessionManager.ts
# 期望：2 行（4679 + 6451 附近，行号可能因后续改动漂移）
```

---

## 6. 边界情况与已知限制

### 6.1 多窗口启动（合并 review-2 + review-3）

Electron 多 BrowserWindow（同一 partition）共享 localStorage，每个 renderer 启动都会推一次 IPC——

- 推同一个值时：幂等无害 ✓
- A 窗 zh-Hans / B 窗 en（理论上不会出现，因为 localStorage 同 origin 共享）：以**最后一次 IPC 完成**为准，main i18n 锁定最后那个值

**实际触发概率极低**——除非用户在多窗口启动期间手动篡改 localStorage。不在本 fix 防御范围内。

### 6.2 WebUI（远程访问）场景

[`apps/webui/src/main.tsx:15`](../apps/webui/src/main.tsx) 也用 `[LanguageDetector, initReactI18next]`，但 webui 通过 RTK / WebSocket 连后端，**没有** `window.electronAPI` 通道，无法推送到 main 进程的 i18n。

**影响**：如果同一台机器同时有 desktop user（中文）和 webui user（英文）在用，main 进程 i18n 只能反映 desktop 那份。webui 用户新建会话的标题会跟 desktop 用户的语言走，**不是** webui 用户自己的。

**结论**：超出本 fix 范围。webui multi-user locale 支持需要后端按 session/请求维度记录语言偏好，不再依赖 main 进程 i18n 单例——属于更大的架构改造，放到 M4+ 跟随上游处理（上游同样未解决）。本 fix 不引入新问题，只解决 desktop 场景。

### 6.3 Playground / viewer 不受影响

- [`apps/electron/src/renderer/playground.tsx:22`](../apps/electron/src/renderer/playground.tsx) 用 `setupI18n([initReactI18next])`，**无 LanguageDetector**，开发用，不打入用户分发包
- [`apps/viewer/src/main.tsx:9`](../apps/viewer/src/main.tsx) 同上

两者不调用标题生成，不受本 fix 影响。

> ⚠️ **不要把本 fix 的同步行复制到 playground.tsx / viewer/main.tsx**——它们没 LanguageDetector，`resolvedLanguage` 永远是 fallback `"en"`，复制后会**反向把主进程语言强制改为 en**，制造新 bug。

### 6.4 fix 后被激活的下游路径（**实测重点**）

本 fix 把"main 进程 i18n 永远 = en"修成"跟随用户偏好"。除了标题生成（本 fix 的初衷），main 进程 i18n 还有 **3 类下游消费者**之前实际从未在中文模式下跑过——fix 后会一次性激活：

| # | 文件:行 | 消费内容 | 行为变化 | 风险评估 |
|---|---|---|---|---|
| **A** | [`preferences.ts:92`](../packages/shared/src/config/preferences.ts) `formatPreferencesForPrompt()` | 注入到 **每条 chat 的 system prompt**（调用栈见下） | 之前所有 chat 的 prompt 都是 `Preferred language: English`；fix 后中文用户变成 `Preferred language: 简体中文` | **影响最大**——会改变模型回复风格、代码注释语言、错误处理风格 |
| **B** | [`preferences.ts:97`](../packages/shared/src/config/preferences.ts) 早 return 条件 | 空 prefs + `langCode === 'en'` → 返回空字符串 | 中文用户即使其它 prefs 全空，fix 后也会**首次开始**注入只有 `Preferred language: 简体中文` 一行的 prefs 块 | 模型上下文多 ~3 行；英文用户**无变化**（早 return 仍触发） |
| **C** | [`menu.ts`](../apps/electron/src/main/menu.ts) 30+ 处 `i18n.t(...)` | macOS 原生菜单（File / Edit / View / Window / Help 等） | 之前中文用户启动后菜单是英文；fix 后启动短暂英文 → IPC 同步后变中文 | 低；启动时菜单"先英文后中文"短暂闪烁，**实际时长取决于 BrowserWindow 加载 + IPC 往返**（通常 <500ms，用户多半察觉不到）；zh-Hans.json 已含全部 `menu.*` key |

**A 项的实际调用栈**（比第一轮 review 给的"一处"更复杂——共 3 个 entry point）：

```
formatPreferencesForPrompt()  ← packages/shared/src/config/preferences.ts:87
├── prompts/system.ts:362       — buildSystemPrompt() 兜底注入
├── agent/core/prompt-builder.ts:193  — PromptBuilder.formatPreferences()，pinned 进 this.pinnedPreferencesPrompt
└── agent/claude-agent.ts:811   — ClaudeAgent.chat() 首次调用时 pin 进 this.pinnedPreferencesPrompt
```

**关键时序限制（pinning 机制）**：

[`claude-agent.ts:811-818`](../packages/shared/src/agent/claude-agent.ts) 注释明确写：
> Pin system prompt components on first chat() call for consistency after compaction

意思是：**每个 session 的 preferences 只在第一次 `chat()` 时读一次**，之后整个 session 用 pinned 值（直到 compaction）。

- **fix 之前**：所有 session pinned 的都是 `Preferred language: English`（main i18n 永远 en）
- **fix 之后**：
  - 用户正常操作（renderer 加载完 UI 后才点新建会话）→ IPC 同步先完成 → pinned 中文 ✓
  - **极端 race**：如果会话恢复/自动化任务在 renderer JS 加载完成前触发 `chat()`，pinned 可能还是 English（renderer IPC 没赶上）
  - 这个 race **fix 前就以 100% 概率发生**（永远 en），fix 后变成"绝大多数中文，少数 race 仍英文"——**质变改善但非 100% 保证**

**判定**：3 项**全部是 preferences/menu 模块本来的设计意图**（注释明确写了"derive from i18n setting"），bug 让它们从未真正生效。本 fix 是**修复 dormant 路径**，不是引入 regression。

**但是行为变更**——必须在 §5.1 实测时**重点观察 chat 输出风格变化**，而非只看标题：

| 实测追加项（在 §5.1 之后再做） | 期望 |
|---|---|
| 7. 启动后不进设置，**新建会话**用中文问"写一段 Python 代码读 CSV" | 代码注释、解释段落、变量命名风格偏中文 ✓ |
| 8. 启动后观察 macOS 顶部菜单 | 启动短暂英文 → 自动变中文（通常 <500ms 不易察觉）✓ |
| 9. 切换 localStorage 为 `en` 再启动，重复 7-8 | 代码注释英文、菜单稳定英文 ✓ |
| 10. 检查菜单文本是否撑爆（macOS 顶栏宽度通常足够） | 不溢出 ✓ |
| 11. **会话恢复路径**：上次未结束的会话被恢复后立刻发消息 | system prompt 中"Preferred language"应为用户偏好语言（race 已避免）✓ |

### 6.5 WebUI multi-user 副作用进一步细化

[`apps/webui/src/main.tsx:15`](../apps/webui/src/main.tsx) 没有 IPC 通道，无法影响 main 进程 i18n。但 webui 用户**会消费**本 fix 设置的语言：

| 场景 | 结果 |
|---|---|
| Desktop 用户中文 + 同机 webui 用户英文 | webui 用户的会话 system prompt 仍然是 `Preferred language: 简体中文`（跟 desktop 偏好），webui 用户的标题也是中文 |
| 纯 webui 用户（没 desktop 运行） | main 进程 i18n 仍是启动 fallback `en`（因为没 desktop renderer 推送），webui 用户的标题/prompt 走英文 |

**结论**：webui 用户的体验**仍由 desktop 用户偏好主导**。本 fix 不解决 webui multi-user locale，但**也不加剧问题**——webui 在 fix 前后都是被 desktop 偏好"代言"。彻底修复留给 M4+（参考 §10 方案 C）。

### 6.6 旧会话的 pinned prefs **不会被 fix 追溯**

[`claude-agent.ts:811`](../packages/shared/src/agent/claude-agent.ts) 的 pinning 是 per-session 持久化的：

- fix 之前已存在的 session：`pinnedPreferencesPrompt = "Preferred language: English"` 已经写进 session 状态
- fix 落地后用户继续在**旧 session** 里发消息：仍用 pinned 英文 prefs（不会重新读 i18n）
- 只有**新建 session**（或老 session 经历一次 compaction 触发 unpin/repin）才会拿到中文 prefs

**给用户的可观察现象**：fix 落地后第一次启动，已有的对话标题仍然是英文（这是历史 pinned 数据），但**新建对话**的标题立即变中文。这与"fix 修标题生成 bug"的范畴一致，**不是 fix 的缺陷**——但需要在 release notes 里告知用户"已有标题不会回填"。

如果未来用户要求"批量重新生成所有历史会话标题"，那是另一个 feature（手动重生入口已存在，但批量是新功能）——不在本 fix 范围。

### 6.7 首次安装/全新用户

**没有 `localStorage["i18nextLng"]` 的全新用户**：

1. LanguageDetector 走 `navigator.language` —— 在中文系统返回 `"zh-CN"`
2. `supportedLngs = [en, es, zh-Hans, ja, hu, de, pl]`，**不含 `zh-CN`**
3. i18next fallback：`zh-CN` → 找不到 → 用 `fallbackLng: "en"`
4. renderer 推送 `"en"` 给 main → main = en
5. 用户首次启动 UI 是英文 → 标题英文（与 fix 前同等行为）
6. 用户进设置选"简体中文"→ renderer + main 都变中文 → 后续会话标题中文 ✓

**这不是 fix 引入的问题**——是 i18n 默认语言配置层面的限制（`zh-CN` → `zh-Hans` 没自动 alias）。如果优智体作为面向中文用户的产品想"开箱即中文"，需要另开 spec 改 i18n 配置（不在本 fix 范围）。

---

## 7. `// U-API:` 标记新增条目（同步至 CLAUDE.md §3.7）

落地后需在 [`CLAUDE.md §3.7`](../CLAUDE.md) "v0.9.4 sync 期间新增改造点" 表（或新开 M3 i18n sync 子表）追加：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 53 | renderer 启动同步当前语言到主进程（修标题生成英文 bug）| `apps/electron/src/renderer/main.tsx` | 注释 `把 detector 解析到的语言立即推给主进程` | 单行 | M3-I18N-MAIN-PROCESS-SYNC-FIX |

**基线更新**：U-API 标记总数 96 → **98**（本 fix 贡献 +1 #53，同期落地的 v0.9.5 sync 自身贡献 +1 #54 model-picker brand patch，合计 +2；±2 浮动仍维持）

---

## 8. 上游同步影响

- **冲突可能性**：极低。`git log --oneline apps/electron/src/renderer/main.tsx` 显示该文件自 v0.4.2 → v0.8.5 → v0.9.x 全期间仅有的 1 次实质改动是 `393409ce refactor: rename @craft-agent to @u-agents NPM scope`（仅 import 路径）。新加的同步行紧贴 setupI18n 调用，C11/C12/C13 任意模式触发概率 < 5%
- **若上游引入自己的启动同步机制**（例如改 `setupI18n` 直接接管 IPC）：删除本 fix 的 `window.electronAPI?.changeLanguage?.(…)?.catch(...)` 块即可，无后续清理
- **若上游引入 webui 多用户 locale 路径**：本 fix 不阻碍，desktop 路径仍独立工作

### 8.1 这个 bug 其实是上游 bug — 是否上报 upstream

[`preferences.ts:91`](../packages/shared/src/config/preferences.ts) + [`SessionManager.ts:6451`](../packages/server-core/src/sessions/SessionManager.ts) 都从 `i18n.resolvedLanguage` 取语言，但 [`main/index.ts:63`](../apps/electron/src/main/index.ts) `setupI18n()` 不带 detector——这是**上游自己的 bug**，影响所有 craft-agents-oss 用户（不止优智体）。

**可选 follow-up**（不阻塞本 fix 落地）：
- 把本 fix 整理成 PR 提给上游 `lukilabs/craft-agents-oss`
- 优点：如果 accept，下次 sync 时此 fix 就被永久 merge，§3.7 #53 改造点可以从 U-API 标记表里移除
- 缺点：上游 review 周期可能很长；如果上游有更好的设计（比如他们正在做方案 C），PR 会被拒

**建议**：fix 落地稳定运行 2 周后再决定要不要 upstream PR。先确保我们自己用得稳。

### 8.2 i18next 单例假设的 build-config 依赖

§2 坐实了 i18next 通过 bun workspaces hoist 到顶层 `node_modules/` → main + server-core 共享同一实例。但这个假设依赖**当前的 build 配置**：

- 如果未来 build 工具改为按 package 独立 bundle（例如把 server-core 单独打成独立 chunk + externalize i18next）
- 或者上游把 i18next 改为 `peerDependencies` + 各 package 各自版本
- 单例假设会失效，fix 的 main 推送对 server-core 不生效

**反向核对命令**（同步上游后跑）：
```bash
ls packages/shared/node_modules/i18next 2>/dev/null && echo "⚠️ DUPLICATE" || echo "✓ hoisted"
ls packages/server-core/node_modules/i18next 2>/dev/null && echo "⚠️ DUPLICATE" || echo "✓ hoisted"
# 都应该是 hoisted
```

---

## 9. 实施 checklist（交给外部 AI / 用户执行）

- [ ] 1. 改 `apps/electron/src/renderer/main.tsx`：
  - import 行加 `i18n`：`import { setupI18n, i18n } from '@u-agents/shared/i18n'`
  - `setupI18n([LanguageDetector, initReactI18next])` 后追加 4 行（含 `// U-API:` 注释 + `.catch()` 兜底调用），严格按 §4.1 代码块
- [ ] 2. 跑 `bun run tsc --noEmit` —— 0 errors
- [ ] 3. 跑 `bun run lint:electron` —— 不应新增 warnings
- [ ] 4. macOS dev 实测 §5.1 步骤 1-6（标题语言对齐）
- [ ] 5. macOS dev 实测 §6.4 步骤 7-11（chat 输出风格 + 原生菜单语言 + 不撑爆 + 会话恢复 race）
- [ ] 6. 更新 [`CLAUDE.md §3.7`](../CLAUDE.md) 改造点表 +1 项（#53）+ 基线总数 96 → 97
- [ ] 7. commit 信息：`fix(i18n): sync renderer language to main process on startup (M3-I18N-MAIN-PROCESS-SYNC-FIX)`

> **不写单测**——见 §5.2 决策记录。

### 9.1 Risk-free dry-run（推荐执行方式）

如果你（用户）担心 fix 出连锁反应，**最稳妥的落地方式是 dry-run**——0 风险的回滚保证：

```bash
# Step 1: 改代码（按 §4.1）但不 commit
# Step 2: dev 模式起 App（从 repo root 跑 — 不是 cd apps/electron && bun run electron）
bun run electron:dev

# Step 3: 跑完 §5.1 + §6.4 所有 11 步实测
# Step 4a: 全过 → commit
git add apps/electron/src/renderer/main.tsx
git commit -m "fix(i18n): sync renderer language to main process on startup"

# Step 4b: 发现问题 → 一行命令回到 fix 前状态
git restore apps/electron/src/renderer/main.tsx
# 然后回到 spec 修订
```

**dry-run 期间 fix 只存在你的 working tree**——
- 不会污染 git history
- 不会触发上游同步影响
- 不会影响其它 AI / 工具看到的代码状态
- 任何"看起来不对"的现象都能用 `git restore` 1 秒回到 fix 前对照

这是非职业开发者保护自己的标准流程。**用户应当强烈考虑走 dry-run**。

---

## 10. 后续延伸（**不在本 fix 范围**，仅记录）

如果后续发现还有其它"main 进程 i18n stale"导致的 bug（例如菜单语言、错误对话框、Sentry 错误消息），同一根因，**本 fix 同时修复**——因为推送了正确的语言到 main 进程，所有依赖 main `i18n.resolvedLanguage` / `i18n.t()` 的路径都会获益。

如果要做更彻底的 webui multi-user locale 支持，参考方案 C：标题生成请求时由 renderer/webui 携带 locale 参数，server-core 不再依赖 main 进程 i18n 单例。**预估 0.5-1 天**，留给 M4+ 视用户反馈决定。
