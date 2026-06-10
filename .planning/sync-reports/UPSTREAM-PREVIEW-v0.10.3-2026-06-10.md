# UPSTREAM PREVIEW — v0.10.1→v0.10.3 同步预分析报告（2026-06-10）

> 纯只读预分析（未 fetch、未 dry-run），数据来自 GitHub API 对 `v0.10.0...v0.10.3` 的 compare 与 release notes。
> 基线：本地 fork 停在上游 **v0.10.0**（`215910da`，merge `7bfd977a`，见 [`SYNC-v0.10.0-20260529.md`](SYNC-v0.10.0-20260529.md)）。
> 本报告对应 CLAUDE.md §4 流程的"拉取前预分析"环节；实际 merge 由用户/执行会话另行授权执行。
>
> **✅ 决策点 D1–D4 已由用户拍板（2026-06-10），结论见 §8。规格落点：D4 → `02-llm-gateway-spec.md` §3.3；D1 → `05-build-release.md` §3 + `09-test-checklist.md` 设备矩阵。**

---

## 0. TL;DR

| 维度 | 结果 |
|---|---|
| 落后版本 | **3 个**：v0.10.1（06-02）/ v0.10.2（06-09）/ v0.10.3（06-09） |
| 影响面 | 3 squash commits（`26948f8b` / `da0437e8` / `a512da7a`）/ **105 文件 / +2223 −613** |
| ⚠️ 上游搬家 | 仓库已从 `lukilabs/craft-agents-oss` 迁到 **`craft-ai-agents/craft-agents-oss`**（旧 URL 自动 redirect，fetch 仍可用；建议顺手更新 remote，见 §1） |
| 主题 | 模型线大更新（Opus 4.8 默认 + **Fable 5** + 删 Opus 4.6）｜SDK **0.2.123→0.3.170 跨 minor 两连跳**｜`language`→`uiLanguage` 机制｜Pi prompt-cache 修复｜macOS Intel 停产 |
| **头号语义风险** | `storage.ts` 模型自动迁移作用范围 **从 `anthropic` 扩到 `pi` 连接** —— U-API 连接 providerType 正是 `'pi'`，会改写用户自管模型清单，撞 02 §6.2.2（§4） |
| **工程风险** | SDK 两连跳 + 上游把 SDK 从 esbuild bundle 改 **externalize**（纯 ESM），打包链需全平台实测（§5） |
| 直接收益 | ① Pi prompt-cache 修复 → U-API 走非 Claude 模型（DeepSeek 等）**缓存命中恢复、token 费直降**；② 中文会话标题修复（与我方 main.tsx 临时修复同源，上游方案更优，**marker 可退役**）（§6） |
| Breaking | macOS **Intel (x64) 停产**（v0.10.0 是最后一版 Intel）→ 决策点 D1；`preferences.json` 的 `language` 字段移除（自动 scrub，无用户动作） |
| marker 交集 | 105 上游文件 ∩ 74 本地 marker 文件 = **20 个**；§3.3 高冲突区命中 **3 个**（§3） |
| 预计冲突 | **15 个 workspace package.json（C11 惯例，root 自动并）+ storage.ts（深）+ main.tsx（语义重叠，take theirs）+ 少量浅冲突**；总量与 v0.10.0 那次（19 个）同量级 |
| brand patch | 上游新增 3 个应用内 release-notes（`0.10.1/2/3.md`）含 craft 字样 **共 6 行**，用户可见，必须清洗（§7） |
| 新 provider / 品牌入口 | **无新 provider**（Fable 5 是 Anthropic 模型；OAuth identity 是既有 Anthropic 连接增强，对 U-API 不可达） |

---

## 1. 上游元数据与 org 迁移

| 项 | 值 |
|---|---|
| 新仓库 | `https://github.com/craft-ai-agents/craft-agents-oss`（default branch `main`，last push 2026-06-09） |
| 旧仓库 | `lukilabs/craft-agents-oss` → GitHub API 已 301 redirect 到新地址 |
| 本地 remote | `upstream` 仍指旧 URL —— **可用但建议更新** |

执行会话可照做（一次性，写命令仅供用户复制）：

```bash
git remote set-url upstream https://github.com/craft-ai-agents/craft-agents-oss.git
git remote -v   # 确认
```

同步后需更新文档中的上游地址：`CLAUDE.md` §1/§2、`.planning/07-upstream-sync.md` 等出现 `lukilabs` 处（merge 完成后由本仓库 AI 修订 .md）。

版本线：

| tag | 发布日 | squash commit | 一句话 |
|---|---|---|---|
| v0.10.1 | 2026-06-02 | `26948f8b` | Opus 4.8 默认 + SDK 0.3.154 + uiLanguage 修复 + **Intel mac 停产** |
| v0.10.2 | 2026-06-09 | `da0437e8` | Link label 类型 + OAuth 身份显示 + Stop 恢复输入 + **Pi prompt-cache 修复** |
| v0.10.3 | 2026-06-09 | `a512da7a` | **Claude Fable 5**（1M context）+ SDK 0.3.170 |

---

## 2. 逐版本摘要与 U Agents 相关性

### v0.10.1
| 上游变更 | 对 U Agents |
|---|---|
| Opus 4.8 设为默认 Opus，删 Opus 4.6，旧选择自动迁移 | ⚠️ 迁移逻辑扩到 `pi` 连接 → **§4 头号风险** |
| SDK 0.2.123 → 0.3.154 | ⚠️ 跨 minor，**§5 工程风险** |
| 会话标题跟随 Appearance 语言（`uiLanguage` 持久化 + main 进程 hydrate，#815/#738） | ✅ 直接收益；与我方 `main.tsx` L19 临时修复**同源竞合**，§6 |
| `markdown-preview` 滚动时选区高亮錨定修复 | ✅ 照收 |
| **macOS Intel 停产**（仅 arm64） | ⚠️ 决策点 **D1**：我方是否跟随 |
| `preferences.json` 删 `language` 字段（读时 scrub）；`update_user_preferences` tool 不再收 `language` 参数 | ✅ 照收，无交集 |

### v0.10.2
| 上游变更 | 对 U Agents |
|---|---|
| Label 新增 `link` 值类型（zod/CLI/prompt 全链 + 新文件 `open-label-link.ts`） | ✅ 照收 |
| Settings → LLM Connections 显示 Anthropic OAuth 身份（email · org + 同账号 amber 警告） | ➖ U-API 连接非 OAuth，UI 不触发；但 `AiSettingsPage.tsx` / `useOnboarding.ts` / `ApiKeyInput.tsx` 与我方 lockdown 改造同文件，**浅冲突候选** |
| 顺带修复 `updateLlmConnection` 硬编码字段白名单静默丢字段 bug | ✅ **对我方多连接（02 §6.2）是利好**——自定义字段保存更稳；merge 后核对我方 U-API 字段是否在新白名单内 |
| Stop 时把最后已发消息恢复进输入框 | ✅ 照收 |
| **Pi prompt-cache 修复**（#862）：volatile context 移出缓存前缀，`PromptBuilder.buildContextParts` 拆分 | ✅✅ **本次同步最大用户收益**：U-API 走 OpenAI 协议 / 非 Claude 模型（DeepSeek V4 等）`cacheRead` 不再每回合清零。`pi-agent.ts` 本地有 brand marker（L129/159/2002），改动区域不同，预计浅/无冲突 |
| Accept-Plan chevron 旋转修复 | ✅ 照收 |

### v0.10.3
| 上游变更 | 对 U Agents |
|---|---|
| **Claude Fable 5** 进模型注册表（Anthropic 直连 + Bedrock 三区变体，7 语言本地化描述；thinking resolver 对 Fable/Mythos 类映射 off→low-effort adaptive） | ➖ 注册表照收（`models.ts` 我方未改造，0 marker，干净合并）；**D4 已拍板：不进 U-API 预设展示**（OpenAI 协议侧改为加 `gpt-5.5, deepseek-v4-pro, MiniMax-M3`，见 §8） |
| SDK 0.3.154 → 0.3.170 | §5 |

---

## 3. 文件交集分析

105 个上游变更文件中：

- **∩ 本地 74 个 marker 文件 = 20 个**（merge 真冲突候选池）：
  `storage.ts`★ / `preferences.ts` / `watcher.ts` / `models-pi.ts` / `llm-connections.ts`(server-core rpc) / `pi-agent.ts` / `ApiKeyInput.tsx`★ / `AiSettingsPage.tsx` / `useOnboarding.ts` / `main.tsx`★ / `main/index.ts` / `electron-build-main.ts` / `storage-startup-migration.test.ts` / 7 × locale json
- **∩ CLAUDE.md §3.3 高冲突区 = 3 个**：`shared/config/llm-connections.ts`（本地 0 marker，实际未改造，预计干净合并）、`server-core rpc llm-connections.ts`、`apisetup/ApiKeyInput.tsx`
- **新增 10 文件**：3 × release-notes（含品牌，§7）+ 6 × 测试 + `open-label-link.ts`。新文件内 `@craft-agent/` import 待 merge 时按 **C11** 全量扫（v0.10.0 那次 3 个新文件 5 处 import）
- **16 × package.json + bun.lock**（REVIEW-1 修正预估）：**15 个 workspace 包必冲突**（ours `@u-agents` name + theirs version 0.10.3，抽查 9 个全部已改名 ✓）；**root `package.json` 预计自动合并**——其 `"name": "craft-agent"` 是 01 规格 L696 登记的**既定豁免**（非 scoped 内部 monorepo 名，非品牌遗漏），我方本地差异（adhoc 脚本行）与上游改动行（version + SDK dep）不相邻。解法沿用 SYNC-v0.10.0 §2.2 的逐行 while-read 批量模式（注意该报告记录的 zsh unquoted-variable 坑）

> `ApiKeyInput.tsx` 上游仅改 `COMPAT_ANTHROPIC_DEFAULTS` 常量与 placeholder 两处文案（加 opus-4-8），本地 L151 同行存在 → **必冲突但极浅**。
> **解法（按 D4 拍板更新）**：`COMPAT_ANTHROPIC_DEFAULTS` **保 ours**（不加 opus-4-8 / fable-5，"展示不用"）；同文件 `COMPAT_OPENAI_DEFAULTS`（L152，无冲突）按 D4 更新为 `gpt-5.5, deepseek-v4-pro, MiniMax-M3`（三个 ID 为 newapi 后台自定义模型，与后台命名一致即可）。两处都补/沿用 U-API marker。

---

## 4. 头号语义风险：模型自动迁移扩到 `pi` 连接（决策点 D2）

上游 `storage.ts` 把旧的 `migrateOpus45ToOpus46`（只扫 `providerType === 'anthropic'`）整体替换为通用迁移系统：

- 新增 `DEPRECATED_MODEL_REPLACEMENTS` 映射 + `normalizeDeprecatedModelId()`（`models.ts`），`claude-opus-4-6` → `claude-opus-4-8` 等
- 新函数 `migrateLegacyOpusToDefaultOpus` 的扫描条件变为：
  `if (connection.providerType !== 'anthropic' && connection.providerType !== 'pi') continue;`
- 对 `pi` 连接调用 `normalizeConnectionModelId()` 改写 `defaultModel` 与 `models` 数组（Bedrock 分支另有 native-ID 处理 + "Pi 0.73.1 暂无 4.8 → 回落 4.7"逻辑）
- `models-pi.ts` 同时新增 `isDeprecatedClaudeOpus46Model()` 并入 `isExcludedPiModel` 目录过滤

**与我方的对撞（REVIEW-1 已回上游 v0.10.3 全文验证，2026-06-10）**：U-API 连接的 `providerType` 正是 `'pi'`（本地 `storage.ts` L1580-1610 的 legacy 迁移都归一到 `'pi'`）。上游 `normalizeConnectionModelId` 第一行就是**无条件** `normalizeDeprecatedModelId(modelId)`，pi 分支只调整 `pi/` 前缀与 4.8→4.7 fallback 细节，**没有"在 defaults 清单内才动"的守卫**。merge 后对每个 U-API 连接：

1. `defaultModel` 与 `models` 数组**逐条**被 normalize：用户自配的 `claude-opus-4-6`（**newapi 路由名，下不下线由中转站决定，不必跟随 Anthropic 官方**）会被静默改写成 `claude-opus-4-8` —— 直接违反 02 §6.2.2"用户自管模型清单不被覆盖"（本地 `storage.ts` L1690 marker 守的就是这条）。
2. 附带行为（REVIEW-1 新发现，比初版预估更重）：改写后**去重合并**（清单里同时有 4-6 和 4-8 时条目减少）+ `defaultModel` 不在清单时**强插回清单头部**；且该迁移有 **4 个调用点**（含启动路径 L2283/2296/2314/2437），是**每次启动都会跑的持续 normalize**，不是一次性迁移——与我方 02 §6.2.2 的"持续启动锁"同机制、反方向，不豁免则每次启动都会改回去。
3. ~~`isExcludedPiModel` 过滤影响已配清单~~ **REVIEW-1 修正：不影响已存清单**。`isExcludedPiModel` 只作用于 Pi SDK catalog（`getPiModelsForAuthProvider` / `getAllPiModels`，经 pi driver L265 与 `main/index.ts` L170 服务于"添加模型"的候选目录），用户已存 `models` 数组不经过它。影响降级为"新增模型时候选目录里少了 opus-4-6"，手填 model ID 兜底仍在（02 §3.3）——**`models-pi.ts` 无需豁免**，D2 执行范围聚焦 `storage.ts` 一处。

**建议解法（写给执行会话，REVIEW-1 已坐实落点）**：merge 时在 `migrateLegacyOpusToDefaultOpus` 给 U-API 连接加豁免分支（开头 `continue` 掉 U-API slug 连接）并登记 marker；**`storage.ts` 本文件 lockdown 块（L2171+）已有现成 `isUApiSlug(connection.slug)` 判定，直接复用，无需跨层引用**。✅ D2 已拍板：豁免。

> 同文件还要叠加：本地 L2171-2229 `multi-connection soft lockdown` START/END 块、L26 atomic writes、L134/137 browser 默认关闭、L2367 continuous startup lock 都在 `storage.ts`，上游该文件 +165/-129 —— **本次唯一深冲突文件，预留最多人工时间**。

---

## 5. 工程风险：SDK 跨 minor 两连跳 + 打包链 externalize（决策点 D3）

- `@anthropic-ai/claude-agent-sdk`：**0.2.123 →（v0.10.1）0.3.154 →（v0.10.3）0.3.170**。上游声称 0.3.154→0.3.170 无 API breakage，但 **0.2→0.3 跨 minor 这一跳没有同等承诺**；我方 `pi-agent.ts` / agent backend 改造点都坐在 SDK 行为之上。
- `scripts/electron-build-main.ts` 新增 `--external:@anthropic-ai/claude-agent-sdk`：SDK 0.3.x 是纯 ESM（`sdk.mjs` + `createRequire(import.meta.url)`），esbuild CJS bundle 会炸（ERR_INVALID_ARG_VALUE），故改为 externalize、由 Node（Electron 39 / Node 22 支持 require ESM）原生加载。
  - **REVIEW-1 加重：externalize 打破了"SDK 缺失对 U-API 用户透明"这一 M1 既有属性**（05 §3.2 的历史论述自 v0.10.3 起失效）。externalize 后 `main.cjs` 在模块初始化处就有运行时 `require('@anthropic-ai/claude-agent-sdk')`——**任何不含 SDK 的打包路径（M1 式 `electron:dist:adhoc:mac` 直打，不调 `build-dmg.sh`）从"功能透明"变成"启动即崩"（MODULE_NOT_FOUND）**。
  - **好消息（REVIEW-1 核实）**：M2 完整路径（`cd apps/electron && bun run dist:mac` → `build-dmg.sh`）**已经复制 SDK 本体**（`build-dmg.sh` L132-137 `cp -r node_modules/@anthropic-ai/claude-agent-sdk`）+ binary 包（L142+），正常流程无需改打包脚本；merge 后冷启动是第一道哨兵测试。
  - 上游本次未改 `electron-builder.yml`；我方 `electron-builder.yml` 是深度改造文件（§3.3 #1）——merge 后仍须确认 files 配置不排除 SDK。
  - 与 backlog 15 §1 刚修完的 `copy-subprocess-servers` + downloadUv 流水线（`ef4581ca`）同属一条打包链，**回归时一起验**。
- **验证要求（D3）**：本次 sync 不能只跑 typecheck——至少 macOS arm64 全量打包 + 装包实测（启动、发消息、transform_data、切模型），Windows 视 D1 结论加测。`storage-startup-migration.test.ts` 上游大改（+172/-113），我方该文件有 marker，测试冲突解法警惕 v0.10.0 报告里"测试 take-theirs 危险"教训。

---

## 6. `uiLanguage` 机制 vs 我方中文优先改造

上游 v0.10.1 修复链：`preferences.ts` 增 `uiLanguage`（validated、内部维护）+ 读时 scrub 旧 `language` → `main/index.ts` 启动用 `getPersistedUiLanguage()` hydrate 主进程 i18n + `i18n:changeLanguage` IPC 持久化 → renderer 升级首启把 resolved language 推给 main。

**我方现状**：`main.tsx` L19 marker —— "把 detector 解析到的语言立即推给主进程，修复'重启后必须手切语言标题才中文'"。**这与上游修的是同一个 bug（#815/#738）**。

**REVIEW-1 已对照上游 main.tsx patch 全文坐实**：上游实现与我方修复**同位置（`setupI18n` 之后）、同机制（renderer 启动推 `i18n.resolvedLanguage` 给 main）**，且注释明确 "safe to run on every renderer startup"——**每次启动无条件 push（首装也覆盖），不只 release notes 字面的 'on upgrade'**，并多了 console 诊断 + main 侧 idempotent 持久化。上游版本是我方修复的功能超集。

**解法（已坐实）**：`main.tsx` 必冲突（同位置两版本），**take theirs，退役我方 marker**（基线 −1）。两处微差留给执行会话判断：① 我方用 `.catch` 兜底而上游用 `void`（上游 IPC handler 内有 rebuildMenu 可能抛，保留 `.catch` 习惯可作一行 marker，或干脆全收上游版）；② 专项规格 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md`](../M3-I18N-MAIN-PROCESS-SYNC-FIX.md) 同步标注"已被上游 v0.10.1 uiLanguage 机制取代"。`main/index.ts` 的 import 行（`@craft-agent/shared/i18n` → 新增 `@craft-agent/shared/config`）按 C11 改 scope；本地该文件的 About-panel marker（L353-363）区域不相邻，无叠加。

默认语言交互：上游持久化 hydrate + renderer 每启动 push 双保险，**首装用户首启即由 renderer detector 推中文给 main** → 我方"中文优先"默认（10-i18n-zh）不受破坏；09 回归单保留"中文环境下重启后新会话标题为中文"+ 首装路径两条用例。

---

## 7. brand patch 清单（merge 时执行）

| 位置 | 问题 | 处理 |
|---|---|---|
| `apps/electron/resources/release-notes/0.10.1.md` | craft 字样 ×2 行 | 应用内"新版本说明"用户可见（§3.5 红线）。按本地 0.9.x 先例清洗为 U Agents 表述，或按产品口径重写中文 release notes |
| `.../0.10.2.md` | ×3 行 | 同上 |
| `.../0.10.3.md` | ×1 行（"available in Craft Agent"） | 同上 |
| 新文件 import scope | 待查 | merge 时跑 C11 全格式 grep（`@craft-agent/` 必须 = 0） |
| i18n | en +6/−2，其余 6 locale 各 +4（Fable 5 描述等新 key，zh-Hans 上游自带翻译） | merge 后跑 parity 脚本 + 10 号规格中文复核（上游 zh-Hans 措辞按我方术语表过一遍） |

---

## 8. 决策点汇总（✅ 已全部拍板，2026-06-10）

| # | 决策 | **用户结论（2026-06-10）** |
|---|---|---|
| **D1** | macOS Intel 停产是否跟随？ | **跟随**。我方自 v0.10.3 同步版起 mac 仅出 arm64；v0.10.0 为最后 Intel 版（下载页/公告注明）。落点：`05-build-release.md` §3 决策标注 + 打包配置去 x64（执行项，见 §9 步骤 7）+ `09-test-checklist.md` 设备矩阵 |
| **D2** | `storage.ts` 模型迁移对 U-API 连接豁免 or 接受？ | **豁免 + marker 登记**。U-API 连接的 `defaultModel` / `models` 不被 `migrateLegacyOpusToDefaultOpus` / `normalizeConnectionModelId` 改写；判定复用 `isUApiSlug` 同型逻辑（§4） |
| **D3** | SDK 两连跳验证深度 | **全量**：typecheck + 全测试 + arm64 打包装机实测（启动 / 发消息 / transform_data + uv 链路 / 切模型） |
| **D4** | 预设模型清单更新？ | **Anthropic 协议侧不加** `claude-opus-4-8` / `claude-fable-5`（注册表照收但不进 U-API 预设展示）；**OpenAI 协议侧预设清单更新为 `gpt-5.5, deepseek-v4-pro, MiniMax-M3`**（对应 `ApiKeyInput.tsx` `COMPAT_OPENAI_DEFAULTS`，现值 `openai/gpt-5.2-codex, openai/gpt-5.1-codex-mini`）。三个 ID 为 newapi 后台**自定义模型**（管理员自行添加命名，非预置清单），应用端清单与后台自定义名一致即可。规格已落：`02-llm-gateway-spec.md` §3.3 |

---

## 9. 建议合并 SOP（用户/执行会话照做）

1. `git remote set-url upstream ...`（§1）→ `git fetch upstream`
2. `git checkout -b sync/upstream-v0.10.3-YYYYMMDD`
3. 可选但推荐：`git merge --no-commit upstream/main` dry-run 看真实冲突 → `git merge --abort`（v0.10.0 经验：dry-run 纠正过 2 处漏预测）
4. 正式 merge；冲突按本报告 §3/§4 处理，`storage.ts` 留到最后精解（D2 豁免）
5. C11 批量解 16 × package.json（while-read 模式）；bun.lock 取 theirs 后由 `bun install` 重生成
6. **D4 模型清单 patch**：`ApiKeyInput.tsx` 的 `COMPAT_OPENAI_DEFAULTS` → `gpt-5.5, deepseek-v4-pro, MiniMax-M3`（三个 ID 为 newapi 后台自定义模型，与后台命名保持一致即可）；`COMPAT_ANTHROPIC_DEFAULTS` 保 ours 不加新模型。同步核对 02 §3.3 是否还有其它预设清单引用点
7. **D1 打包配置去 x64**：调整 mac 打包目标仅 arm64（`electron-builder.yml` mac target 或对应 `dist:mac*` 脚本参数，执行时以实际配置为准）；下载页/公告注明 v0.10.0 为最后 Intel 版
8. brand patch（§7）+ §14 全格式 grep 核对 marker 基线（当前 **109**；预期变动：main.tsx 退役 −1、storage.ts 豁免 +1、ApiKeyInput D4 ±，超基线 ±2 停下逐项核对）
9. 验证（D3 全量）→ 测试基线对照 SYNC-v0.10.0 已知 fail（browser-pane-manager 8 fail / lint:shared 4 errors 为 pre-existing）→ arm64 打包装机实测（启动 / 发消息 / transform_data + uv / 切模型，**含 OpenAI 协议三个新预设模型各发一条消息实测路由可用**）
10. merge 回主分支；本仓库 AI 写 `SYNC-v0.10.3-YYYYMMDD.md` + 刷新 §14 基线 + 更新 CLAUDE.md/07 号规格的上游 URL

---

## 10. 预测评级

**B+（可同步，但有一个必须先拍板的语义冲突）**。冲突总量与 v0.10.0 同量级且多为惯例浅冲突；扣分项集中在 `storage.ts` 深冲突 + D2 语义决策 + SDK 跨 minor 两连跳的验证成本。**收益明确**（prompt-cache 修复直接降用户成本、中文标题修复、Fable 5/Opus 4.8 可用性），建议尽快安排同步窗口。

---

## 11. 附：本预分析所用只读命令（可复核）

```bash
gh api repos/craft-ai-agents/craft-agents-oss/releases --jq '.[] | {tag: .tag_name, published: .published_at}'
gh api "repos/craft-ai-agents/craft-agents-oss/compare/v0.10.0...v0.10.3" --jq '{total_commits, files: (.files|length)}'
gh api "repos/craft-ai-agents/craft-agents-oss/compare/v0.10.0...v0.10.3" --jq '.files[] | "\(.status)\t\(.filename)"'
# fork ∩ 上游交集：
grep -rl "U-API" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" packages apps scripts | sort > /tmp/markers.txt
# （与上游文件清单 comm -12 求交）
gh api "repos/craft-ai-agents/craft-agents-oss/contents/package.json?ref=v0.10.0" --jq '.content' | base64 -d | grep claude-agent-sdk
```

---

## 12. REVIEW-1 对抗性自查记录（2026-06-10，决策拍板后）

> 方法：拉取上游 v0.10.3 `storage.ts` / `main.tsx` **全文**（初版只看了 compare patch 片段）+ 本地调用链 grep + 14 §0 权威基线 grep。全程只读。

### 12.1 验证结论汇总

| 类型 | 条目 | 结论 |
|---|---|---|
| ✅ 坐实+加重 | §4 pi 连接迁移 | `normalizeConnectionModelId` 第一行无条件 normalize，无 defaults 守卫；另发现去重合并、defaultModel 强插头部、4 调用点持续启动行为 |
| ✅ 坐实+变好 | §6 main.tsx 退役 | 上游实现同位置同机制超集，每次启动无条件 push（首装覆盖），take theirs 安全 |
| 🔄 修正（降级） | §4 第 3 点 `isExcludedPiModel` | 只过滤 Pi SDK catalog（添加模型候选目录），不碰用户已存清单；`models-pi.ts` 无需豁免 |
| 🔄 修正（数字） | §0/§3 冲突预估 | 16 → **15 个 workspace package.json**；root `"name": "craft-agent"` 为 01 规格 L696 既定豁免，预计自动合并 |
| 🆕 新发现（升级） | §5 打包链 | externalize 后 **adhoc 直打（不调 build-dmg.sh）的包启动即崩**（MODULE_NOT_FOUND）；M2 完整路径已复制 SDK 本体（`build-dmg.sh` L132-137），正常流程无需改 |
| 🆕 新发现（落点） | §4 D2 豁免实现 | `storage.ts` lockdown 块已有现成 `isUApiSlug(connection.slug)`，无需跨层引用 |
| ✅ 数字验证 | marker 基线 | 权威 grep 实测 **109 / START 9 / END 9**，与 14 §0 完全一致（初查 125 是自定义宽口径含 scripts+json，非异常） |
| 🔄 修正（表述） | §0/§7 craft 计数 | `grep -c` 统计的是**行数**非次数，表述统一为"×N 行" |

### 12.2 残留未验证项（留给执行会话）

1. U-API 连接的 `piAuthProvider` 具体取值对 normalize 的 `pi/` 前缀分支细节影响——**不改变 D2 豁免结论**（豁免后整段不执行），仅影响"若不豁免会改写成什么"的精确预测
2. 真实冲突清单需 dry-run 坐实（本仓库 AI 不执行 merge，对应 §9 步骤 3）
3. 存量 x64 用户的自动更新行为（已登记在 `05-build-release.md` §3 D1 决策块的待验证项）
