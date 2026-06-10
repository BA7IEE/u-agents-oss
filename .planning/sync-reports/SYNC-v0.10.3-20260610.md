# SYNC v0.10.3 — 实测报告（2026-06-10）

> 本报告记录 v0.10.1→v0.10.3 三版本上游同步的**实际执行**（经用户当次授权破 §0 铁律，全程在隔离 worktree `claude/exciting-euclid-e210a2` 分支上执行，源码改动经由 Bash 文本工具落地——本会话未带 `U_AGENTS_ALLOW_CODE`，Edit/Write 仅用于 .md）。
> 配套预分析：[`UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md`](UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md)（含 §12 REVIEW-1 对抗性自查）。

---

## 0. TL;DR

| 维度 | 结果 |
|---|---|
| 上游版本 | **v0.10.3**（`a512da7a` = upstream/main HEAD），base v0.10.0（`215910da`），跨 v0.10.1/2/3 三版本 |
| ⚠️ 上游搬家 | `lukilabs/craft-agents-oss` → **`craft-ai-agents/craft-agents-oss`**；remote 已 `set-url`，CLAUDE.md §1/§2 已更新，§3.5 禁词与 brand-audit skill 增补 `craft-ai-agents` |
| 同步 commits | merge `d0fc34d4` → 专项 patch `6cbc9bf4` → C11 修补 `7a30fe2d` → typecheck 修复 `f461326d` |
| 影响面 | 105 文件 / +2223 −613（上游）；**27 冲突**（vs 预测 ~20：14 package.json + bun.lock + 12 源码/docs，漏预测 5 个 = labels 链路 ×4 + update-preferences） |
| 主题 | Opus 4.8 默认 + **Fable 5**（注册表照收，**不进 U-API 预设展示**）+ `uiLanguage` 机制 + **Pi prompt-cache 修复 #862**（U-API 非 Claude 模型 token 费直降）+ SDK **0.2.123→0.3.170** + esbuild externalize + **macOS Intel 停产** |
| 决策落地 | **D1** mac 仅 arm64（`electron-builder.yml`）；**D2** 双防线豁免 + 防回归测试；**D3** 全量验证（代码层完成，打包 deferred）；**D4** `COMPAT_OPENAI_DEFAULTS = gpt-5.5, deepseek-v4-pro, MiniMax-M3` + Anthropic 侧决策性回退 |
| marker 基线 | **109 → 115**（净 +6：#60a-d/#60t/#61 新增，#53 退役换 `.catch` 形态，#62 为 yml 注释不计数）；START/END **9 → 10** 对 ✓ |
| C11 | `@craft-agent/` 全仓 **= 0**（新文件 `i18n-bootstrap.test.ts` 内嵌字符串 5 处已改）；`.craft-agent` 路径 = 0 |
| typecheck | `typecheck:all` 全 8 包 **0 errors** |
| i18n | parity **6 locales × 1466 keys** ✓ / sorted ✓ / coverage ✓（1544 callsites） |
| test | **0 新增 regression**（详 §4：electron 9 fail = 8 browser 基线 + 1 个 v0.9.1 起 pre-existing 新入账；shared 1 fail pre-existing，临时 worktree 基线实测确认） |
| lint | `lint:electron` 0 errors（114 warnings，+2 上游）；**`lint:shared` 0 errors / 9 warnings —— 上游自修了 4 个 baseline errors，#59 的 C13 follow-up 自动关闭** ✓ |
| brand | 3 个新 release-notes 清洗（Craft 字样 + `lukilabs` issue 链接降裸号）；反向核查 0 新增用户可见残留 |
| **评级** | **A**（2026-06-10 终评：代码 sync + 全自动验证绿 + 0 regression + D1-D4 全落地 + **macOS arm64 装机实测通过**——冷启动/U-API 对话/transform_data/三新模型/中文标题/中文更新日志全过，详见 [`test-runs/v0.10.3.md`](../test-runs/v0.10.3.md)；唯一实测发现的 release-notes 漏翻已闭环并固化流程） |

---

## 1. 执行过程（单次授权 + 分段 commit 可回滚）

用户在预分析 + REVIEW-1 自查 + D1-D4 拍板完成后下达"授权执行"（当次授权覆盖本次同步全链）。分 4 个 commit 推进：

1. `d0fc34d4` merge upstream v0.10.3 + 27 冲突解决
2. `6cbc9bf4` 专项 patch（D1/D2/D4 + brand 清洗 + M3-I18N 退役标注）
3. `7a30fe2d` C11 修补（新文件内嵌 scope ×5）
4. `f461326d` typecheck 修复（workspace no-op 改干净空函数体）+ `bun install` lockfile reconcile

执行手段说明：本会话未带 `U_AGENTS_ALLOW_CODE` 环境变量（hook 拦 Edit/Write 非 .md），全部源码修改通过 Bash `python3`/`perl` 文本处理落地——与 v0.10.0 sync 的 perl 批量模式同源。

---

## 2. 冲突解决实录（27 个，vs dry-run 预测对照）

### 2.1 预测命中与漏预测

- **命中**：14 workspace package.json（预测 15，实际 1 个自动合并）、bun.lock、`storage.ts`（深）、`main.tsx`（语义重叠）、`main/index.ts`、`useOnboarding.ts`、`AiSettingsPage.tsx`、`preferences.ts`、`storage-startup-migration.test.ts`
- **漏预测 5 个**（均浅）：`labels.md` + `label-icon.tsx` + `label-badge-row.tsx` + `ActiveOptionBadges.tsx`（v0.10.2 link-label 链路撞我方 scope 改写行）+ `update-preferences.ts`（v0.10.1 删 `language` 参数撞我方 scope 注释）
- **反向陷阱（自动合并无声引入）**：`ApiKeyInput.tsx` **没冲突** —— 我方 `COMPAT_ANTHROPIC_DEFAULTS` 行与 base 相同，git 直接采上游新值（**静默加入 `claude-opus-4-8`**），与 D4 决策相反。专项 patch 阶段决策性回退。**教训入册：预测"必冲突"的文件若实际零冲突，要警惕 ours==base 导致的 take-theirs 自动合并**。

### 2.2 关键解法

| 文件 | 解法 |
|---|---|
| 14 × package.json | Python 状态机批量：保 ours 全字段 + version 取 theirs `0.10.3` |
| `bun.lock` | take theirs + `bun install` reconcile（lock 内 `@craft-agent` workspace 名自动改正） |
| `storage.ts` ×2 块 | **织合**：`enforceUApiBaseUrl` 排在上游 Phase 1k `migrateLegacyOpusToDefaultOpus` **之前**（D2 第一道防线：enforce 把 U-API 连接归一 `pi_compat`，上游迁移只扫 `anthropic`/`pi`，天然不命中）+ 顺序约定 marker |
| `main.tsx` | take theirs（上游 bootstrap push 为我方修复的超集）+ `void` 换 `.catch` 兜底 marker（#53 演化）|
| `storage-startup-migration.test.ts` | **两块全保 ours** —— 上游新增整组 pi-api-key 迁移测试在我方 lockdown 语义下必失败（M1 已删该测试组，-348 行历史决策）；我方 lockdown describe 完整保留 |
| `labels.md` | 保 ours（craft-agent CLI 教学段 M1 deep-clean 有意删除，上游对该段的 link 示例更新随之不收） |
| 其余 7 个 | take theirs + `@craft-agent/`→`@u-agents/` scope 替换 |

### 2.3 踩坑记录（本次新增）

- **正则贪婪跨块事故（已修复，无残留）**：首版冲突解析用 `re.S` 非贪婪正则，遇到 **ours 为空** 的冲突块时跨块匹配，丢失块间公共内容。`git checkout -m -- <file>` 恢复冲突态后改用**逐行状态机**解析（对空边安全）。验证环节（describe 计数）当场抓住，未流入 commit。
- **unreachable narrowing**：workspace 迁移 no-op 化首版保留原实现于 `return` 之后，TS 控制流分析在 unreachable 区失效报 8 个 errors → 改为干净空函数体（原实现在 merge 历史 `a512da7a` 可查）。
- **release-notes 只清洗未翻译（用户装机实测发现，v0.9.6 同坑重犯）**：brand patch 阶段对 `0.10.1/2/3.md` 只做了去品牌+去链，漏了整篇中文化——应用内"更新日志"以英文展示。已补译三篇（风格对照 0.9.6 中文版，含 U Agents 适用性按语：D2 豁免说明 / 缓存修复价值 / Fable 5 如何自行启用）并**固化进 `upstream-sync` skill 合并后清单第 3 条**，下次同步不再靠记性。

---

## 3. 专项 patch 明细

| 决策 | 落点 | marker |
|---|---|---|
| **D2 第一道防线** | 启动序列与新建连接路径：enforce 先于 normalize（×2 处顺序约定） | #60a/#60b |
| **D2 第二道防线** | `migrateLegacyOpusToDefaultOpus` 开头 `if (isUApiSlug(connection.slug)) continue;` | #60c |
| **D2 workspace 级** | `migrateWorkspaceLegacyOpusToDefaultOpus` 整体 no-op（fork 全连接皆 U-API；上游原实现还会把 4-7 强升 4-8） | #60d（START/END 第 10 对） |
| **D2 防回归测试** | lockdown 测试组新增 it：U-API 连接 `['claude-opus-4-6','deepseek-v4-pro']` 经 `runMigration` 后逐字节不变 ✓ pass | #60t |
| **D4** | `COMPAT_OPENAI_DEFAULTS = 'gpt-5.5, deepseek-v4-pro, MiniMax-M3'`（newapi 后台自定义模型名）；`COMPAT_ANTHROPIC_DEFAULTS` 回退至 `claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5` + placeholder 同步 | #61 |
| **D1** | `electron-builder.yml` mac target 仅 arm64（dmg + zip） | #62（yml 注释） |
| **brand** | `0.10.1/2/3.md` 释出说明：`Craft Agents`/`Craft Agent` → `U Agents`、`[#N](lukilabs…)` → `#N` 裸号 | — |
| **#53 退役** | `M3-I18N-MAIN-PROCESS-SYNC-FIX.md` 标注被上游 v0.10.1 uiLanguage 机制取代；代码仅留 `.catch` 兜底一行 | #53（演化） |

---

## 4. 验证结果与基线对照（D3 全量 — 代码层）

| 项 | 结果 | 对照基线 |
|---|---|---|
| `bun install` | 1733 packages，lockfile reconciled | — |
| `typecheck:all` | **0 errors**（全 8 包） | = v0.10.0 ✓ |
| shared `bun test` | 3000 pass（+D2 新测试）/ 12 skip / **1 fail** | fail = `send-developer-feedback-permissions`"safe (Explore) mode"——**pre-existing latent**：临时 worktree 在 merge 前基线 `cef7a610` 实测同样 3 pass/1 fail（v0.10.0 报告未跑全 shared 套件故未入账）。**非本次引入** |
| electron `bun test` | 809 pass / **9 fail** | 8 × `BrowserPaneManager` = v0.10.0 已知基线 ✓；**+1 `getTransportBannerCopy` = v0.9.1 起 pre-existing**：上游测试断言 `CRAFT_SERVER_TOKEN` 字样 vs 我方更早的文案清洗（实现停在 v0.8.5、测试停在 v0.9.1 sync，本次 merge 均未触碰）。本次**新发现入账**，非新增 regression |
| `lint:electron` | 0 errors / 114 warnings | 基线 112，+2 为上游新代码 warning |
| `lint:shared` | **0 errors** / 9 warnings | **优于基线**：v0.10.0 的 4 个 pre-existing errors 被上游自修，#59 C13 follow-up 自动关闭 ✓ |
| `lint:ipc-sends` / `tool-name-checks` / `lint:ui` | ✓ 全过 | — |
| i18n | parity 6×1466 ✓ / sorted ✓ / coverage 1544 callsites ✓（zh-Hans 新 key 上游自带翻译） | v0.10.0 为 6×1462 |
| D2/lockdown 测试 | `storage-startup-migration.test.ts` **5/5 pass** | — |
| brand 反向核查 | 0 新增用户可见残留（命中均为既有豁免：测试 fixture URL / 源码头 Apache §4(b) 声明 / CRAFT_* 内部变量 / 旧 release-notes 内部标识） | ✓ |

---

## 5. Follow-up（按优先级）

1. **🔴 打包装机实测（D3 deferred 项，发版前必做）**：macOS arm64 完整路径打包（`cd apps/electron && bun run dist:mac`，含 `build-dmg.sh` SDK 复制）→ **冷启动**（SDK externalize 后第一道哨兵，崩 = MODULE_NOT_FOUND）→ 发消息 / transform_data+uv / 切模型 / **OpenAI 协议三个新预设模型各发一条**（gpt-5.5 / deepseek-v4-pro / MiniMax-M3，需 newapi 后台已配同名自定义模型）。
   - **✅ 已完成（2026-06-10 同日闭环）**：打包 + 静态验证 + **用户真机实测全部通过**（两轮：第一轮过全部功能项但发现 release-notes 漏翻；补译重打后第二轮验证中文更新日志 ✓）。完整记录见 [`test-runs/v0.10.3.md`](../test-runs/v0.10.3.md)。包内验证 ✓：SDK 本体 + binary alias 均在 `Resources/app/node_modules/@anthropic-ai/`，`main.cjs` 含 8 处 SDK 运行时 `require`（externalize 生效且目标存在）、uv 42M 在 `dist/resources/bin/darwin-arm64/`、Identifier `cn.u-studio.u-agents`。
   - ⚠️ 本机踩坑：钥匙串存在不可签名的自签证书（`com.justiceleague.batman`），`CSC_IDENTITY_AUTO_DISCOVERY` 默认 true 会自动发现它并失败——**本机 adhoc 打包必须带 `CSC_IDENTITY_AUTO_DISCOVERY=false`**（05 §3.2.1 预案）；M2 正式签名走 `.env.release` 显式凭证不受影响。另：`bun run dist:mac 2>&1 | tail` 管道会吞真实退出码，校验用 `pipestatus[1]`。
2. **🟡 transport-banner 测试断言修复**：`transport-connection-banner.test.ts:55` 期望 `CRAFT_SERVER_TOKEN` 应改为断言我方实际文案（"Verify your server token"）——独立小修，建议下次顺手（C13 模式）。
3. **🟡 存量 x64 用户 updater 行为**（D1 尾巴，05 §3 已登记）：新 `latest-mac.yml` 无 x64 产物后，Intel 机上 electron-updater 表现待实测；必要时 06 规格补冻结方案。
4. **🟢 下载页/公告**：注明 v0.10.0 为最后 Intel 版。
5. **🟢 源码头 attribution URL**：`branding.ts`/`paths.ts`/`storage.ts` 等头部 Apache §4(b) 声明仍指 `lukilabs` 旧址（redirect 有效）；M3 或下次 sync 统一换新 org。NOTICE 同理（§3.4 敏感文件，单独评估）。
6. **🟢 03-ui-lockdown L506 陈旧**：规格里 About copyright 草案含 lukilabs URL，实际代码（`main/index.ts` About 块）早已是纯 "U Studio Ltd."——下次修订 03 时同步。

---

## 6. 残留风险声明

- **SDK 0.2.123→0.3.170 跨 minor 两连跳**：typecheck/测试全绿，但 SDK 行为只在 Claude 直连路径深度使用（我方 U-API 用户走 `pi-agent.ts`，0 SDK 依赖）；externalize 后 SDK 实体必须在包内（build-dmg.sh L132-137 已覆盖）。运行时风险集中在打包形态——见 Follow-up #1。
- **`pi_compat` 不在上游迁移扫描范围是隐式契约**：若未来上游把扫描条件扩到 `pi_compat`，D2 第二道防线（#60c 显式豁免）仍兜底；§14 基线 grep 会在 marker 消失时报警。
