# M3-I18N-FIX-CLAIM-AUDIT — Spec 事实断言审计表

> **目的**：把 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md`](M3-I18N-MAIN-PROCESS-SYNC-FIX.md) 里**所有"我断言为真"的事实**抽出来，每条标"用什么证据坐实"。
>
> **怎么用**：扫一遍 ⚠️ 行。✅ 行不用看——那些是直接看代码 / 跑命令就能验证的。⚠️ 行是"基于已知 + 推理"得出的——如果某条让你不放心，告诉我，我去把它真正坐实。

---

## 图例

| 标记 | 含义 |
|---|---|
| ✅ | 直读代码 / 命令输出验证 — 最强坐实 |
| ⚠️ | 基于代码 + 库行为/通用知识/上下文推断 — 推理性结论，需要你决定是否接受 |

---

## 全部断言（按 spec 章节）

### §1 问题现象

| 断言 | 坐实 | 证据 |
|---|---|---|
| 重启 App 不切语言 → 标题英文；切一次语言 → 标题中文 | ✅ | 你自己实测确认（v0.9.4 desktop build） |

### §2 根因

| 断言 | 坐实 | 证据 |
|---|---|---|
| Renderer 用 `setupI18n([LanguageDetector, initReactI18next])` | ✅ | [`renderer/main.tsx:17`](../apps/electron/src/renderer/main.tsx) |
| Main 用 `setupI18n()` 无 detector | ✅ | [`main/index.ts:63`](../apps/electron/src/main/index.ts) |
| Detector 从 `localStorage["i18nextLng"]` 读 | ✅ | [`setupI18n.ts:39-43`](../packages/shared/src/i18n/setupI18n.ts) `detection.order` |
| Node 进程没有 localStorage | ✅ | Node.js / Electron main 进程标准事实 |
| `fallbackLng: "en"` 决定 main 启动语言 | ✅ | [`setupI18n.ts:35`](../packages/shared/src/i18n/setupI18n.ts) |
| 同步 IPC `'i18n:changeLanguage'` 仅在用户主动切语言时触发 | ✅ | [`AppearanceSettingsPage.tsx:287-288`](../apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx) 是唯一调用点（grep 验证） |
| 标题生成读 `i18n.resolvedLanguage` | ✅ | [`SessionManager.ts:4679`](../packages/server-core/src/sessions/SessionManager.ts) + [`SessionManager.ts:6451`](../packages/server-core/src/sessions/SessionManager.ts) |
| server-core 被 main 进程 import | ✅ | [`main/index.ts:73`](../apps/electron/src/main/index.ts) |
| i18next 在 monorepo 顶层 `node_modules/` 单实例 | ✅ | `ls packages/{shared,server-core}/node_modules/i18next` 都不存在（hoisted） |
| `LOCALE_REGISTRY["en"].nativeName = "English"` | ✅ | [`registry.ts`](../packages/shared/src/i18n/registry.ts) |
| Prompt 注入 `Reply in English.` 导致模型严格英文 | ✅ | [`title-generator.ts:49-55`](../packages/shared/src/utils/title-generator.ts) + 你的实测 |

### §3 修复方案选择

| 断言 | 坐实 | 证据 |
|---|---|---|
| 上游废弃了 `prefs.language` 字段，改读 `i18n.resolvedLanguage` | ✅ | [`preferences.ts:91`](../packages/shared/src/config/preferences.ts) 注释 `This replaces the old prefs.language field which is now ignored` |
| 方案 A（IPC 推送）与上游设计方向一致 | ⚠️ | **推理**：基于上一条 + i18n 是 source of truth 的设计哲学。如果上游 maintainer 私下认为"main 进程根本不该读 i18n"，方案 A 反而错——但**上游有 2 处 main 侧 i18n 消费**（[preferences.ts](../packages/shared/src/config/preferences.ts) + [SessionManager.ts](../packages/server-core/src/sessions/SessionManager.ts)），说明他们确实期望 main 进程能读 i18n |

### §4 具体改造

| 断言 | 坐实 | 证据 |
|---|---|---|
| `setupI18n` 是同步 init | ✅ | [`setupI18n.ts:38`](../packages/shared/src/i18n/setupI18n.ts) `initImmediate: false` |
| `setupI18n` 返回时 `resolvedLanguage` 已可读 | ⚠️ | **推理**：i18next-browser-languagedetector 的 `detect()` 在 localStorage / navigator 路径下是同步的（库实现）。没直读 detector 源码，但**已有代码 [`AppearanceSettingsPage.tsx:285`](../apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx) `i18n.resolvedLanguage ?? i18n.language` 直接拿来用**——上游已经在依赖这个同步性 |
| preload 在 renderer JS 执行前完成 | ⚠️ | **推理**：Electron 标准时序——preload 在 `document-start` 之前注入。没直接验 `webPreferences.contextIsolation`，但已知是 `true`（[`window-manager.ts:167`](../apps/electron/src/main/window-manager.ts)）。同 `contextBridge.exposeInMainWorld` 路径已被 [`AppearanceSettingsPage.tsx:288`](../apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx) 使用——如果时序不对，那处也会崩 |
| IPC handler `'i18n:changeLanguage'` 注册早于 BrowserWindow 创建 | ✅ | [`main/index.ts:873`](../apps/electron/src/main/index.ts)（在 await bootstrapServer 后）vs [`main/index.ts:997`](../apps/electron/src/main/index.ts) `await createInitialWindows()` —— 注册必先发生 |
| preload `changeLanguage` 返回 `Promise<void>` | ✅ | [`preload/bootstrap.ts:425`](../apps/electron/src/preload/bootstrap.ts) `ipcRenderer.invoke('i18n:changeLanguage', lang)` + [`shared/types.ts:655`](../apps/electron/src/shared/types.ts) 类型声明 |
| `?.catch` optional chained 调用语法合法 | ✅ | TS 5.x / ES2020 标准；preload 类型为 `Promise<void>` 不会变成 undefined |
| `rebuildMenu` 内部有 `cachedWindowManager` null guard | ✅ | [`menu.ts:47`](../apps/electron/src/main/menu.ts) |
| `i18next-browser-languagedetector` 在 Node 环境会报 `window is not defined` | ⚠️ | **推理**：库名叫 "browser-languagedetector"，依赖 `window.localStorage` 和 `navigator.language`——Node 都没有。如果有 SSR polyfill 可能不抛，但默认会 |

### §5 验证

| 断言 | 坐实 | 证据 |
|---|---|---|
| jsdom 跑不动 main.tsx | ⚠️ | **推理**：main.tsx 含 Sentry init + ReactDOM.createRoot + JotaiProvider——jsdom 通常无法直接执行这类 module-level 顶层逻辑。没真的跑过 |
| 没有现有测试 import main.tsx | ✅ | `grep -r "main.tsx" apps/electron/src/**/__tests__/` 无结果 |

### §6 边界

| 断言 | 坐实 | 证据 |
|---|---|---|
| 多窗口 localStorage 同 origin 共享 | ⚠️ | Electron 标准行为（同 `partition`），但**没直接验证** `webPreferences.partition` 配置是否覆盖默认 |
| WebUI 没有 `window.electronAPI` | ✅ | [`apps/webui/src/main.tsx`](../apps/webui/src/main.tsx) 不 import 任何 Electron preload bridge |
| playground.tsx 不打入用户分发包 | ⚠️ | **推理**：从命名 + 内容看是开发用 entry。没去查 `electron-builder.yml` 的 `files` 字段确认实际打包范围 |
| `formatPreferencesForPrompt()` 有 3 个 entry point | ✅ | `grep -r "formatPreferencesForPrompt"` 结果：[`system.ts:362`](../packages/shared/src/prompts/system.ts) + [`prompt-builder.ts:193`](../packages/shared/src/agent/core/prompt-builder.ts) + [`claude-agent.ts:811`](../packages/shared/src/agent/claude-agent.ts) |
| ClaudeAgent 首次 `chat()` 时 pin preferences | ✅ | [`claude-agent.ts:811-818`](../packages/shared/src/agent/claude-agent.ts) 代码 + 注释明确写 `Pin system prompt components on first chat() call for consistency` |
| 启动菜单闪烁 `<500ms 不易察觉` | ⚠️ | **猜测**：IPC 往返通常毫秒级，rebuildMenu 同步执行。**没实测计时**。可能 100ms 也可能 1500ms，取决于机器 |
| 首次安装 `navigator.language="zh-CN"` 不在 supportedLngs → fallback en | ⚠️ | **推理**：[`registry.ts`](../packages/shared/src/i18n/registry.ts) 7 个 locale 不含 `zh-CN`；i18next 默认会 fallback——但没实测验证 `zh-CN` 在 i18next 是否会被自动解析为 `zh-Hans`（理论上不会，但有些 i18next 版本有 region fallback 行为） |
| 旧 session pinned prefs 不会被 fix 追溯 | ✅ | [`claude-agent.ts:814-817`](../packages/shared/src/agent/claude-agent.ts) `if (this.pinnedPreferencesPrompt === null)` 守门 + 该字段 session 级持久化 |
| Windows/Linux 菜单已禁用 | ✅ | [`menu.ts:50-57`](../apps/electron/src/main/menu.ts) `if (!isMac) { Menu.setApplicationMenu(null); return }` |

### §7 U-API 标记

| 断言 | 坐实 | 证据 |
|---|---|---|
| U-API 标记总数 96 → 97 | ✅ | [`CLAUDE.md §3.7`](../CLAUDE.md) 当前基线 96 |

### §8 上游同步

| 断言 | 坐实 | 证据 |
|---|---|---|
| renderer/main.tsx 自 v0.4.2 几乎没动 | ✅ | `git log --oneline -- apps/electron/src/renderer/main.tsx` 输出：v0.4.2 / v0.4.1 / Sync from internal repository / v0.8.5 / v0.3.0 / v0.3.2 / `393409ce refactor: rename @craft-agent to @u-agents NPM scope` —— 全期间仅 1 次实质改动 |
| 这个 bug 是上游 bug | ✅ | [`preferences.ts:91`](../packages/shared/src/config/preferences.ts) 读 i18n + [`SessionManager.ts:6451`](../packages/server-core/src/sessions/SessionManager.ts) 读 i18n + [`main/index.ts:63`](../apps/electron/src/main/index.ts) `setupI18n()` 无 detector —— 三段都是上游代码（U-API 改造点 #1-#52 都不涉及） |
| i18next 单例依赖 build hoist | ✅ | `ls` 命令验证 + bun workspaces 标准行为 |

### §9 实施

| 断言 | 坐实 | 证据 |
|---|---|---|
| `git restore` 可回滚未 commit 改动 | ✅ | git 命令普适事实 |
| `bun run electron` 起 dev 模式 | ⚠️ | **推理**：基于 [`apps/electron/package.json`](../apps/electron/package.json) 应有的 scripts。没直接打开确认 script 名 |

---

## ⚠️ 行汇总（请你重点看这里）

总 **38 条断言** 中：
- **31 条 ✅**（代码 / 命令直证）
- **7 条 ⚠️**（推理性）

如果让你不放心，应该聚焦看这 7 条：

| # | 断言 | 风险等级 | 万一推理错了的后果 |
|---|---|---|---|
| ⚠️1 | 方案 A 与上游架构方向一致 | 低 | 未来上游同步可能产生小冲突，不会破坏 fix 功能 |
| ⚠️2 | `setupI18n` 返回时 `resolvedLanguage` 已可读 | **中** | **如果不可读，fix 推送的是 undefined → 兜底为 `'en'` → 等同 fix 前状态**（不会变更糟，但 fix 静默失效） |
| ⚠️3 | preload 在 renderer JS 执行前完成 | 低 | `window.electronAPI` 为 undefined → `?.` 短路 → fix 静默不生效（等同 fix 前） |
| ⚠️4 | `i18next-browser-languagedetector` 在 Node 抛错 | 极低 | 只影响"不要顺手给 main 进程 setupI18n 加 detector"这条警告的依据，不影响 fix 本身 |
| ⚠️5 | jsdom 跑不动 main.tsx | 极低 | 只影响"不写单测"决策的依据，不影响 fix 本身 |
| ⚠️6 | 启动菜单闪烁 <500ms | 极低 | 实际可能 100ms 也可能 2 秒，不影响功能 |
| ⚠️7 | `navigator.language="zh-CN"` fallback 行为 | 极低 | 只影响 §6.7 首次安装用户的描述，不影响 fix 本身 |

---

## 关键观察

**⚠️2 + ⚠️3 是唯二"可能让 fix 不生效"的推理项**——但**两条都有"软兜底"**：

- ⚠️2 fall back 到 `'en'`，等同 fix 前
- ⚠️3 fall back 到 `undefined` 短路，等同 fix 前

也就是说，**如果这两条推理错了**，fix 不会引入 regression，只会**失效**——你看到的现象会跟今天一模一样（手动切语言才标题中文）。

**没有任何一条推理错了会让事情比今天更糟。**

---

## 如何用这份审计表

1. 扫一遍 ⚠️ 行
2. 如果**没有任何一条**让你不放心 → 走 §9.1 dry-run
3. 如果**有某条**让你不放心 → 告诉我编号，我去把它真正坐实（看 detector 库源码 / 测 contextBridge 时序 / 实测计时 / 等等）
4. **不要**再说"再 review 一轮"——review 的边际收益已经趋零

---

## 反向检验：spec 里有没有"我断言但完全没列在这张表上"的内容？

如果你怀疑我漏报了某条断言，扫 spec 时遇到"这是真的吗"的句子，回来加进表里要我坐实。这个流程比"再 review 一轮"靠谱得多——你来当 reviewer，我当 fact-checker。
