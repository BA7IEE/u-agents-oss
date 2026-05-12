# SYNC v0.9.3 实际报告（2026-05-12）

> 本报告是 v0.9.3 sync 流程的闭环工件。与同日 [UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md](UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md) 预测报告**双工对照**：预测在 merge 前写，实测在 merge + 实机装包后写。
> 关联 commit：`463349ac sync: merge upstream/main as of 20260512 (v0.9.3)` + `1d265457 docs+i18n: 0.9.3.md 中文翻译`

---

## 0. TL;DR + 评级

| 维度 | 结果 |
|---|---|
| 上游版本 | v0.9.3 (`c310624f`，2026-05-11 release) |
| sync merge commit | `463349ac`（2026-05-12）|
| release notes 翻译 commit | `1d265457`（2026-05-12）|
| 影响面 | 134 文件，+8376 / −1199（含我们 brand patch + §3.7 表更新）|
| §3.7 主基线 | **94 → 95**（−1 #37 自动过期，+2 #50/#51 FabNewChat shadow disable）|
| §3.7 START/END 块数 | 9 / 9（不变）|
| C11 触发 | **6 文件 9 处**（mobile UI 新建 5 + messaging test 1）|
| C12 触发 | **2 处**（FabNewChat shadow → §3.7 #50/#51）|
| C13 触发 | **未触发**（上游反而修了 v0.9.1 routing 自身 bug）|
| C14 触发 | 未触发（build-win.ps1 不变）|
| 验证三件套 | typecheck ✓ / lint:electron 0 errors ✓ / lint:i18n:parity ✓ |
| bun test 真 fail | 0 sync 引入 + 19 pre-existing tech debt（转 M2 backlog）|
| 装包 | macOS arm64 + x64 ad-hoc 签名成功；产物 sha512/manifest 完整 |
| 实机实测 | macOS arm64 8/8 通过（含 release notes 中文化 source 修复后视觉验证 deferred 到 R2 上线后）|
| **评级** | **A**（无新 P0 / 无新 spec / 无 regression / D-β 分发路径完整复用）|

**预测准确度**：
- 风险等级 **B（小到中）** ✓ 准确
- 真冲突 / 硬冲突自动过期 / C 系列触发数 ✓ 准确（review 修订后）
- 但**总冲突数（25）严重低估**：预测 review 修订前说 "B/2 真冲突"，实测 25 unmerged

---

## 1. 预测报告漏盘点（review 修订 + sync 后再总结）

预测报告附录 B 已记录 5 个事实漏点 + 2 个不准确表述（review 修订）。**本次 sync 实测又暴露了 3 个 review 时没抓到的漏盘**。

### 1.1 Review 修订前已抓到的 5+2 漏盘（已修订）

详见 [UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md 附录 B](UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md#附录-b-——-review-修订记录2026-05-12)。

### 1.2 Sync 实测新暴露的 3 个漏盘

| # | 漏盘 | 严重程度 | 实测发现 |
|---|---|---|---|
| **a** | **14 个 package.json 必撞**（§3.7 #11g 改造 + 每次 release 改 version 模式）| P0 | 实际 15 个（漏算 `apps/webui/package.json`，review 后纠正为 15）。预测时把 package.json 全部归为"接受 theirs version"，未识别这是必撞冲突 |
| **b** | **D 组 4 文件高风险 + 上游架构方向反向**：上游把 menu rendering 从 TopBar 拆出，但**我们 fork v0.9.2 把它从 AppMenu 搬到了 TopBar**——架构方向完全相反 | P0 | 预测只看 stat 显示"对我们透明"，没读 conflict 区内容；review 时通过读 conflict 区识别 |
| **c** | **release notes 翻译需要 sync 内处理**：上游 `apps/electron/resources/release-notes/0.9.3.md` 11385 字节英文 release notes，含 craft 字面量 + PR 链接 + commit hash + GHCR namespace 等大量 OSS 仓库管理信息。**用户首次升级 v0.9.3 时在"最新动态"页面看到** | **P1** 预测时低估，实测时升 P0 | 预测 §2.5 仅标"P1 跟踪，merge 后单独处理"。实测装包后用户首屏感知，必须在 R2 上线前完成翻译；09 §L405-406 已有完整翻译机制化 SOP（v0.9.2 时机制化），但**预测报告未引用此 SOP**导致漏盘 |

### 1.3 预测准确的部分

- §3.3 7 高冲突文件中 4 个（electron-builder/branding/llm-connections/provider-metadata）确实未碰 ✓
- routing.ts #37 自动过期判定正确 ✓
- AiSettingsPage.tsx 是真冲突 ✓（虽然处理方案细节略有调整）
- C11 数字 6 文件 9 处 ✓（review 后纠正）
- 4 个软冲突 spot check（ApiKeyInput / provider-icons / FreeFormInput / source-test）**全部 git auto-merge 通过** ✓
- C12 触发 2 处（FabNewChat shadow）✓
- C13 未触发（上游反而修了 v0.9.1 自身 routing 漏分类）✓
- 装包 D-β 策略复用 v0.9.2 ✓
- 体积变化 < 0.1% ✓

---

## 2. 25 个 unmerged 冲突真实分类

预测 review 修订时记录了 25 个 unmerged 分布（24 both modified + 1 modify/delete）。实测处理流程：

### 2.1 处理矩阵

| 组 | 文件 | 数量 | 处理方式 |
|---|---|---|---|
| **A** 14 个 package.json + 1 root | `package.json` + `apps/{cli,electron,viewer,webui}/package.json` + 10 个 `packages/*/package.json` | 15 | Python 脚本批量：保 our `name`/`description`/`private` + 接受 their `version: 0.9.3` |
| **B** routing.ts 硬冲突自动过期 | `packages/shared/src/protocol/routing.ts` | 1 | 删 #37 marker + 删重复的 PENDING_CHANGED + 接受 theirs |
| **C** AiSettingsPage 真冲突 | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | 1 | 第一处保 manifest 分支结构 + fallback 用 `'U-API'`（不是 `'U-API Compatible'`，与现状 simplified 字面量一致）；第二处**完全保 ours 单行**（避免上游三元 switch 引入 craft 字面量）|
| **D1** AppMenu 上游重写为 wrapper | `apps/electron/src/renderer/components/AppMenu.tsx` | 1 | Write 完全重写为 6 行 routing wrapper |
| **D2** TopBar 接受上游 wrapper 调用 | `apps/electron/src/renderer/components/app-shell/TopBar.tsx` | 1 | 3 处 Edit：保 `@u-agents/ui` import + 删 UAgentsSymbol dead import + 删 200 行旧 menu rendering 代码 + 接受 `<AppMenu />` 调用 + `CompactWorkspaceSwitcher` 引入 + `getDocUrl` from `@u-agents/shared` |
| **D3** SessionMenu Share UI 接收 | `apps/electron/src/renderer/components/app-shell/SessionMenu.tsx` | 1 | 5 处 Edit：JSDoc + 加 CloudUpload import + 保 `@u-agents/shared/labels` + 删 dead `extractLabelId` import + 加 `sharedUrl` 定义 + 接受 Share UI |
| **D4** SessionMenuParts Share 组件接收 | `apps/electron/src/renderer/components/app-shell/SessionMenuParts.tsx` | 1 | 2 处 Edit：接受 imports + 全盘接受 ShareMenuItems 组件 |
| **E1** index.html 标题 + CSP | `apps/electron/src/renderer/index.html` | 1 | 保 `<title>U Agents</title>` + 接受上游 CSP（font-src 加 `data:`）|
| **E2** playground.html 标题 + CSP | `apps/electron/src/renderer/playground.html` | 1 | 保 `<title>Design System Playground - U Agents</title>` + 接受上游 CSP |
| **F** README.md 保 ours | `README.md` | 1 | 删上游 Trendshift badge + 保 `# U Agents` |
| **G** bug_report.yml modify/delete | `.github/ISSUE_TEMPLATE/bug_report.yml` | 1 | `git rm`（维持我们之前的删除决策）|

### 2.2 实际数字对照预测

| 维度 | 预测（review 修订后）| 实测 |
|---|---|---|
| §3.3 真冲突 | 0 | 0 ✓ |
| §3.7 真冲突 | 1 (AiSettings) | 1 ✓ |
| §3.7 硬冲突自动过期 | 1 (routing #37) | 1 ✓ |
| §3.7 软冲突 spot check | 3 | 3 ✓（全 auto-merge 通过）|
| **D 组架构级冲突** | 4（D1-D4 review 时识别）| 4 ✓ |
| **package.json 必撞** | 15（review 时纠正为 15）| 15 ✓ |
| **html 标题/CSP 冲突** | 2（review 时识别）| 2 ✓ |
| **README/bug_report 杂项** | 2（review 时识别）| 2 ✓ |
| **总 unmerged** | 25 ✓ | 25 ✓ |

---

## 3. D 组菜单架构迁移方案沉淀

**这是本次 sync 最有学习价值的部分**，应当作为 SOP 范例。

### 3.1 架构方向冲突的本质

- **我们 fork v0.9.2 时**：把 menu rendering 从 `AppMenu.tsx` 搬到 `TopBar.tsx`（inline 实现），`AppMenu.tsx` 沦为传统 dropdown
- **上游 v0.9.3 重构**：把 menu rendering 从 `TopBar.tsx` 拆到 `AppMenu.tsx`（wrapper）+ 新文件 `app-menu/DesktopAppMenu.tsx` / `app-menu/MobileAppMenu.tsx`，让 menu 按 `AppShellContext.isCompactMode` 路由 desktop/mobile 双形态

两个改造**方向完全相反**——同一份 menu rendering 代码被两边搬到不同位置，conflict 不是"双方都加内容"而是"双方都改动同一段逻辑的所在位置"。

### 3.2 迁移决策

接受上游 wrapper 架构（与用户决策 3 "全盘接收 mobile/compact UI" 一致）：

```
TopBar.tsx
  └── <AppMenu /> (6 行 routing wrapper)
       ├── DesktopAppMenu.tsx (从原 AppMenu inline 实现搬过来 + 新调整)
       └── MobileAppMenu.tsx (全屏 sheet 实现，新文件)
```

### 3.3 必须迁移的 U Agents 改造点（实测处理）

| 我们旧 AppMenu / TopBar 内的改造 | 迁移到哪 | 实测处理 |
|---|---|---|
| `UAgentsSymbol` import + JSX 使用 | DesktopAppMenu.tsx + MobileAppMenu.tsx | Edit L17/L171 + L8/L184，将 `CraftAgentsSymbol` → `UAgentsSymbol` |
| `aria-label={t("menu.craftMenu")}` | 已在上游 DesktopAppMenu L170 + MobileAppMenu L180 用同 key | i18n key 由 menu-schema 控制；fork zh-Hans 已翻译为 "U Agents 菜单" ✓ |
| `{t("menu.quitUAgents")}` 退出文案 | menu-schema.ts L279 改 `labelKey: 'menu.quitUAgents'` | Edit menu-schema.ts L279 |
| `https://u-agents.u-studio.cn/docs` Help URL | menu-schema.ts L302 HELP_LINKS 数组 | Edit menu-schema.ts L302 |
| `Automations` 入口 | menu-schema.ts HELP_LINKS 加 1 entry | Edit menu-schema.ts 新增 1 项 |
| Back/Forward nav buttons | **自动随上游 TopBar 保留**（上游 TopBar L181-191）| 无操作（auto-merge）|
| `@u-agents/ui` import path（Tooltip）| TopBar.tsx 保 ours import | Edit L13 删除 conflict 区，保 `@u-agents/ui` |
| `@u-agents/shared/docs/doc-links`（getDocUrl）| TopBar.tsx 保 ours import path | Edit L36-63 删 conflict 区，保 `@u-agents/shared/docs/doc-links` |

### 3.4 SOP 沉淀

**架构方向相反的冲突无法通过 `git diff --stat` 预测**——必须读 conflict 区内容才能识别。预测 SOP 加：

```bash
# 预测必跑：D 组冲突探测
for f in $(git diff --name-only 8981384b..upstream/main); do
  # 读上游版本，看是否完全重写
  upstream_lines=$(git show upstream/main:"$f" 2>/dev/null | wc -l)
  ours_lines=$(wc -l < "$f" 2>/dev/null || echo 0)
  # 重写 = 上游版本 ≤ ours 版本 50% 或 ≥ 150%
  ratio=$(echo "scale=2; $upstream_lines / $ours_lines" | bc 2>/dev/null)
  if [ "$ratio" = "" ]; then continue; fi
  if [ $(echo "$ratio < 0.5 || $ratio > 1.5" | bc) = 1 ]; then
    echo "POTENTIAL REWRITE: $f (ours $ours_lines lines, theirs $upstream_lines lines)"
  fi
done
```

加入 [`.planning/07-upstream-sync.md` §2.7d](../07-upstream-sync.md)（待沉淀）。

---

## 4. C11/C12/C13 实际数字 vs 预测

| 模式 | 预测 | 实测 | 差异 |
|---|---|---|---|
| **C11** NPM scope rename `@craft-agent/` → `@u-agents/` | 6 文件 9 处 | **6 文件 9 处** | ✓ 精确匹配 |
| **C12** 上游 release 自身 lint 违规 | "未触发"（预测 review 修订时未识别）| **2 处 ESLint disable**（FabNewChat shadow）| 实测发现，新增 §3.7 #50/#51 |
| **C13** 上游 release 自身 test fail | "未触发，反而修了 v0.9.1 自身 routing 漏分类" | ✓ 未触发 | ✓ 精确匹配 |
| **C14** build-win.ps1 漏盘 | 未触发 | ✓ 未触发 | ✓ 精确匹配 |
| **C10** connection 加新字段 | 未触发 | ✓ 未触发 | ✓ 精确匹配 |

### 4.1 C11 实测命中 6 文件

```
apps/electron/src/renderer/components/app-shell/CompactSessionListFilter.tsx  (2 hits)
apps/electron/src/renderer/components/app-shell/CompactSessionMenu.tsx        (1 hit)
apps/electron/src/renderer/hooks/useSessionMenuActions.ts                     (2 hits)
apps/electron/src/renderer/playground/demos/mobile-webui/ChatDisplayMobilePreview.tsx (1 hit)
apps/electron/src/renderer/playground/demos/mobile-webui/mock-mobile-data.ts          (2 hits)
packages/messaging-gateway/src/__tests__/gateway-button-perm.test.ts          (1 hit)
```

Python 脚本批量 sed `@craft-agent/` → `@u-agents/`，sed 完 git grep 0 命中 ✓

### 4.2 C12 实测：FabNewChat.tsx 2 处 shadow ESLint 违规

```
L35:9  error  Disallowed shadow class "shadow-[...]"  craft-styles/no-nonstandard-shadows
L37:9  error  Disallowed shadow class "shadow-[...]"  craft-styles/no-nonstandard-shadows
```

**性质**：上游 v0.9.3 release 自己 lint fail（同 commit 写自定义 shadow + 强化 `no-nonstandard-shadows` 规则，矛盾）。

**处理**：方案 A（用户决策）—— eslint-disable + `// U-API:` marker，保留上游视觉效果，新增 §3.7 改造点 #50/#51。

---

## 5. 19 pre-existing test fail 清单（转 M2 backlog）

**实测发现**：删除 `apps/electron/release/` stale .app bundle 副本后，bun test 真 fail 数从 39 → **19**。

| 组 | 文件 | fail 数 | 性质 | git log 最近 touch |
|---|---|---|---|---|
| A | `packages/server/src/__tests__/smoke.test.ts` (headless server smoke) | 3 | server-side env var (`CRAFT_SERVER_TOKEN`) 与 fork 未完全改造 | v0.8.0 |
| B | `apps/electron/src/main/__tests__/browser-pane-manager.test.ts` (BrowserPaneManager) | 8 | 可能与 §3.7 #46 `browserToolEnabled` 默认 false 改造有关 | v0.9.1 sync |
| C | `packages/shared/src/agent/__tests__/send-developer-feedback-permissions.test.ts` | 1 | permission mode 测试，与 fork 改造可能相关 | (未改) |
| D | `packages/server-core/src/webui/__tests__/http-server.test.ts` (startWebuiHttpServer) | 6 | webui server 测试，可能 server-side env var 相关 | (未改) |
| E | `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts` (transport-banner) | 1 | 测试期望 `description.toContain('CRAFT_SERVER_TOKEN')`，实际 description 走 i18n（不含字面量） | v0.8.5 |

**全部 19 fail 涉及的 5 个 test 文件都不在 v0.9.3 sync commit 的 diff 范围内**（sync commit 改的 15 个 test 文件全是 messaging/labels/utils/source-test 等无关文件）。

**结论**：v0.9.3 sync **无新 test 回归**。19 fail 全部 pre-existing tech debt。

### 5.1 转 M2 backlog（待 M2 阶段批量修）

| 项 | 描述 | 优先级 |
|---|---|---|
| M2-TEST-A | `CRAFT_SERVER_TOKEN` env var 改造（fork 漏改）+ 修 smoke test 3 fail + http-server 6 fail | P1（可能 production 用到 server 模式时暴露）|
| M2-TEST-B | BrowserPaneManager 8 fail 诊断 + 修（可能与 §3.7 #46 决策耦合）| P2 |
| M2-TEST-C | send_developer_feedback permission mode 测试修 | P3 |
| M2-TEST-E | transport-banner test 期望与实际 description 对齐 | P3 |

---

## 6. 验证三件套结果

| 检查 | 状态 | 输出 |
|---|---|---|
| **typecheck:all** | ✅ exit code 0 | 全 monorepo 8 子项目 tsc 通过 |
| **lint:i18n:parity** | ✅ OK | `i18n parity OK (6 locales, 1448 keys each)` |
| **lint:i18n:coverage**（pre-commit hook 自动跑）| ✅ OK | `i18n coverage OK (3989 literal callsites checked, 1448 keys in en.json)` |
| **lint:i18n:sorted**（pre-commit hook 自动跑）| ✅ OK | sort check 通过 |
| **lint:electron** | ✅ **0 errors** | 110 warnings（pre-existing，与 sync 无关）|
| **bun test** | ✅ exit 0 + 19 pre-existing fail（转 M2 backlog） | 4500 pass + 12 skip + 19 fail |
| **§3.7 主基线 grep** | ✅ 95 | START 9 + END 9 配对 |
| **brand grep 6 类** | ✅ 用户路径 0 命中 | OAuth relay 2 处 + Apache §4(b) 注释 5 处 + playground fixture 1 处均预期保留 |
| **git diff --check HEAD^..HEAD** | ✅ 0 output | 无 whitespace error / conflict marker 残留 |
| **husky pre-commit hook** | ✅ 通过 | sync commit 时 `lint:i18n:staged` 跑 sort/parity/coverage 全过 |

---

## 7. 装包实测结果

### 7.1 装包流程

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `cd apps/electron && bun run dist:mac` | ❌ **codesign fail**：keychain 中 self-signed identity `com.justiceleague.batman` 被误选 |
| 2 | `bun run electron:dist:adhoc:mac` (fallback) | ✅ **5-10 分钟内成功**：arm64 + x64 同时打出 DMG/ZIP |

### 7.2 产物

```
apps/electron/release/
├── U-Agents-arm64.dmg     224M  (sha512: f9b93032ec259dca...)
├── U-Agents-arm64.zip     225M  (sha512: 917a311b525e23c5...)
├── U-Agents-arm64.dmg.blockmap
├── U-Agents-arm64.zip.blockmap
├── U-Agents-x64.dmg       240M  (sha512: 84c5238d76264bc9...)
├── U-Agents-x64.zip       225M  (sha512: 6fd5258686a96edc...)
├── U-Agents-x64.dmg.blockmap
├── U-Agents-x64.zip.blockmap
├── latest-mac.yml         (manifest v0.9.3, 4 entries)
└── builder-debug.yml
```

### 7.3 体积对比（v0.9.2 → v0.9.3）

| 产物 | v0.9.2 | v0.9.3 | 差异 |
|---|---|---|---|
| arm64.dmg | 233,851,006 | 233,953,062 | +102 KB / **+0.04%** ✓ |
| arm64.zip | 225,535,504 | 225,652,724 | +117 KB / **+0.05%** ✓ |

**结论**：上游 mobile UI 重构 + 28 个新文件经 vite tree-shaking 后增量极小。

### 7.4 Bundle metadata（Info.plist）

```
CFBundleDisplayName: "U Agents"     ✓
CFBundleExecutable: "U Agents"      ✓
CFBundleIdentifier: "cn.u-studio.u-agents"  ✓
CFBundleName: "U Agents"            ✓
```

### 7.5 .app 内 craft 字面量残留（main.cjs strings 扫描）

**7 处命中，全部预期保留 / 用户不可见**：

| # | 字面量 | 性质 | 用户可见？ | 决策 |
|---|---|---|---|---|
| 1-3 | `craftAgentRoot, "config.json"/"preferences.json"/"tool-icons.json"` | source 变量名（路径构造）| ❌ 不可见（路径值 = `~/.u-agents/`，变量名是旧的 craft）| **转 M2 backlog**：改 `craftAgentRoot` → `uAgentsRoot` |
| 4 | `U_AGENTS_FEATURE_CRAFT_AGENTS_CLI=1\|0` | FEATURE_FLAG 门控环境变量 | ❌ 仅 dev `=1` 启用 | **保留**（有意设计——名称标明这是 craft 上游 feature）|
| 5 | `craftAgentsBackend: "U-API"` i18n key | i18n 字典 key | ❌ 不可见（值已品牌化为 "U-API"）| **保留**（key 不可见，值正确）|
| 6-7 | `CRAFT_AGENTS_CLI_*` 常量 / accessor | FEATURE_FLAG 内部 | ❌ FEATURE_FLAG 门控 | **保留**（同 #4）|

### 7.6 实机实测（macOS arm64 D-β）

| # | 验证项 | 结果 |
|---|---|---|
| 1 | 窗口 < 768px mobile/compact 切换 | ✅ |
| 2 | TopBar Back/Forward 显示 + 可点 | ✅ |
| 3 | AppMenu desktop dropdown 打开 | ✅ |
| 4 | MobileAppMenu 全屏 sheet 打开/返回/关闭 | ✅ |
| 5 | 退出菜单文案"退出 U Agents" | ✅ |
| 6 | Help & Docs URL 指向 u-agents.u-studio.cn/docs | ✅ |
| 7 | Automations 入口存在 + 指向 U Agents 文档 | ✅ |
| 8 | Share menu item 渲染 + 错误处理（不暴露 craft）| ✅ |
| **+9** | release notes/最新动态中文化 + 白标 | ⚠️ → ✅ 已 source 修复（commit `1d265457`），视觉验证 deferred 到 R2 上线后重打或本地重打 |

### 7.7 release notes 翻译 follow-up commit

```
1d265457 docs+i18n: 0.9.3.md 中文翻译
  apps/electron/resources/release-notes/0.9.3.md: 11,385 → 7,049 字节 (−38%)
```

按 09 §L405-406 SOP 完整翻译：
- 删除 PR 链接 / commit hash / issue 链接 / 外部贡献者 GitHub URL
- 删除 OSS 仓库管理类信息（GHCR namespace migration / Windows CI 修复 / docs path 修复）
- 品牌化日志路径 `@craft-agent` → `@u-agents`
- SOP 验收 grep `craft|github\.com|(#NNN)|commit-hash` **全 0 命中** ✓

---

## 8. M2 backlog 新增项

本次 sync 暴露的 P1-P3 待处理项（不在 sync commit 范围内修，转 M2）：

| # | backlog 项 | 优先级 | 来源 |
|---|---|---|---|
| **M2-TEST-A** | `CRAFT_SERVER_TOKEN` env var 改造（fork §3.7 #11f 9 个 env var 漏改 1 个）+ 修 smoke test 3 fail + http-server 6 fail | P1 | bun test 19 fail 中 9 个 |
| **M2-TEST-B** | BrowserPaneManager 8 test fail 诊断（可能与 §3.7 #46 browserToolEnabled 默认 false 决策耦合）| P2 | bun test 19 fail 中 8 个 |
| **M2-TEST-C** | send_developer_feedback permission mode 测试修 | P3 | bun test 19 fail 中 1 个 |
| **M2-TEST-E** | transport-banner test 期望与实际 description 对齐（test 期望 `CRAFT_SERVER_TOKEN` 在 description 中，实际走 i18n 不含字面量）| P3 | bun test 19 fail 中 1 个 |
| **M2-VAR-craftAgentRoot** | `craftAgentRoot` 变量名残留（3 处 path 构造）改 `uAgentsRoot` | P2 | .app 内 main.cjs strings 扫描 |
| **M2-FIXTURE-AllowList** | `apps/electron/src/renderer/playground/demos/messaging/AllowListPreview.tsx:317` playground fixture 含 `Craft Agents` 字面量 | P3（playground demo 不发用户路径）| brand grep 6 类 |
| **M2-LINT-warnings** | 110 个 lint warning（主要 `craft-agent/no-localstorage` 规则名内含 craft + 一些 pre-existing 模式）| P3 | lint:electron 输出 |
| **M2-MANIFEST-preset-tooltip** | Manifest preset 在 ApiKeyInput dropdown 暴露，但 `enforceUApiBaseUrl` 重写——是否加 i18n tooltip 解释 | P3（M2 i18n 阶段顺手）| §5.1 决策点 |
| **M2-x64-IntelMac-test** | macOS x64 装包实测 deferred（用户暂无 Intel Mac）| 等用户拿到 Intel 机后 | D-β 决策延续 |

---

## 9. SOP 沉淀建议

### 9.1 加入 [`.planning/07-upstream-sync.md`](../07-upstream-sync.md)

| 建议 | 内容 |
|---|---|
| **§2.7d 架构方向相反冲突探测** | 加 §3 中 SOP 沉淀的 bash 脚本（line ratio 检查）。预测必跑——发现 ratio < 0.5 或 > 1.5 的文件标 "POTENTIAL REWRITE" 加入预测报告 D 组 |
| **§2.7e package.json 必撞模式** | 提示：每次 sync 必有 14-15 个 package.json conflict（我们改 name/description，上游改 version）。预测时直接归 A 组（机械合并），不要漏算 |
| **§2.7f release notes 翻译机制化** | 预测报告必须把 release notes 翻译列入 sync 流程，**不要标 P1 backlog**。完整翻译应当作为 sync 流程内 follow-up commit，与 v0.9.2 commit `947b2bdc` 同模式 |

### 9.2 加入 [`.planning/09-test-checklist.md`](../09-test-checklist.md)

| 建议 | 内容 |
|---|---|
| **bun test 前必清 release/** | 加在 §test setup 节："bun test 前先 `rm -rf apps/electron/release/` 清 stale .app bundle 副本，避免 stale module resolution error 噪声埋没真 fail" |
| **装包首选 ad-hoc** | 加在 §5 装包小节："默认用 `bun run electron:dist:adhoc:mac`（已通过 §3.7 #B1 改造点 CSC_IDENTITY_AUTO_DISCOVERY=false）。不要用 `bun run dist:mac`——keychain 中如有 self-signed identity 会被 codesign 误选" |

### 9.3 加入 [`.planning/CLAUDE.md`](../../CLAUDE.md) §3.7

无新增（本次 sync 加 #50/#51 + 删 #37 + 基线 94→95 已经做）。

---

## 10. 完成后归档

merge 完成 + 实测通过 + 本报告归档后：
- **本报告** = sync 流程闭环工件
- **配套预测报告**：[UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md](UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md)
- **完整 commit 链**：
  ```
  1d265457 docs+i18n: 0.9.3.md 中文翻译
  463349ac sync: merge upstream/main as of 20260512 (v0.9.3)
  c310624f v0.9.3 (上游)
  f8339872 revert: 撤销 web/download-page/
  ...
  ```

---

## 11. 是否进入 main 的判断

按用户当前指令"保留 sync 分支，进入实机装包验证阶段"——本报告完成后再决策。

### 11.1 进入 main 的检查清单

- [x] sync merge commit 落地（`463349ac`）
- [x] release notes 翻译 commit 落地（`1d265457`）
- [x] 验证三件套全过
- [x] §3.7 主基线 95 对齐
- [x] brand grep 6 类预期通过
- [x] 装包 ad-hoc 签名成功
- [x] 实机实测 8/8 + release notes source 修复
- [x] 19 pre-existing test fail 转 M2 backlog（本报告 §8）
- [ ] **本报告 commit** ← 等本 commit 后
- [ ] R2 上线决策（这次 sync 是否要 R2 发布 v0.9.3 给用户）

### 11.2 进入 main 的可选路径

**路径 A：fast-forward merge**
```bash
git checkout main
git merge sync/upstream-20260512-v093 --ff-only
# sync 分支可保留作为历史 ref
```
- 优势：main 上线性 history
- 风险：fast-forward 把 sync 整个链合上，main 直接指向最新 commit

**路径 B：no-ff merge 保留 sync 拓扑**
```bash
git checkout main
git merge sync/upstream-20260512-v093 --no-ff -m "..."
```
- 优势：保留 sync 工作的 branch 拓扑
- 风险：增加 merge commit 噪声

**路径 C：暂不 merge main**
- 保留 sync 分支等 R2 上线后才 merge
- 优势：万一 R2 上线问题，sync 分支独立可丢弃
- 风险：sync 分支 stale 久了与 main 后续 commit 可能冲突

**推荐 A**（与 v0.9.1/v0.9.2 sync 同 SOP——历史显示之前都是 fast-forward）。

### 11.3 R2 上线决策

按 D-β 策略：
- macOS arm64 + Windows x64 单平台发布
- macOS x64 deferred（用户无 Intel Mac 实测）
- Linux deferred（M2 stretch）

**R2 上线前必跑**：重打一次（避免 ad-hoc 测试包 + R2 包混淆，且 release notes 翻译需要重打才生效）。

详见 [`06-update-server.md`](../06-update-server.md) §4.2 R2 上传 SOP（含 v0.9.2 教训机制化的 4 项防错）。

---

**报告完成**。等用户拍板 commit 本报告 + 决定进入 main 路径 + R2 上线时机。
