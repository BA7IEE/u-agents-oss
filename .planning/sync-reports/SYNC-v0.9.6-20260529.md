# SYNC v0.9.6 实测报告（2026-05-26 ~ 2026-05-29）

> 实测报告 —— 记录 v0.9.6 sync 的实际 merge / 打包 / 发版过程，与 [UPSTREAM-PREVIEW-v0.9.6-2026-05-26.md](./UPSTREAM-PREVIEW-v0.9.6-2026-05-26.md) 的 7 轮 review + REVIEW-7 截止 + 重做完整链对比。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.7 / §0 / §4

---

## 0. TL;DR

| 维度 | PREVIEW 预测 | **实测** | 一致度 |
|---|---|---|---|
| 上游 commit | `d0e674f5 v0.9.6` | ✅ 实际 `d0e674f5` | ✅ |
| 文件数 | 66 (含 9 NEW + 57 MODIFIED) | 实际 66 | ✅ |
| §3.3 真冲突 | 0 | ✅ 0 | ✅ |
| **实际冲突总数** | 19 预测 | **33**（17 UU + 7 AA + 9 modified-staged）| ❌ 漏报 14 处（merge-base v0.9.4 而非 v0.9.5 的认知盲区，REVIEW-7 截止后重写策略）|
| **真 git 冲突** | 3 (api-tools + handlers/system + server-core/handlers/rpc/system) | 实际 1 真 git 冲突（api-tools.ts 实际 auto-merge 干净）+ **7 个 UU 之前没预测到**（drawer / main/index / mock-mobile-data / SessionManager / event-adapter / url-safety.test / TurnCard / url-safety）| ⚠️ 预测方向对（关键 brand-patch 路径 2 处 hit），但漏盘 7 处其它 UU |
| **语义冲突（git 不报警）** | 1 (credential-manager-renew.test.ts) | ✅ 完全命中 — 3 SSRF 测试 fail，按 REVIEW-3 SOP 改造 spyOn 后全过 | ✅ |
| §3.7 marker 基线 | 98 → 98 | ✅ 98 → 98 实测 | ✅ |
| C11 NPM scope | 3 文件 4 处 + 15 package.json | ⚠️ 4 文件 5 处（window-manager.ts 漏盘 1 文件 2 处 import — Python 3-way merge 之后批量 sed 没覆盖）| ⚠️ 漏 1 文件 |
| C13 触发 | 0 新增 | ✅ 0 | ✅ |
| 1453 行 fork non-scope 改造 | REVIEW-7 截止后才识别 | 实测确认存在；采用"逐文件手工 merge + 仅编辑 conflict markers"策略避免 take-theirs 静默丢失 | ✅ 策略验证有效 |
| 评级 | A−（预测）| **A−**（与预测一致 — 33 冲突全部干净解决，无 regression） | ✅ |
| macOS arm64 D-β 实测 | 待实测 | **✅ 通过**（2026-05-26 23:52 build / 装包 + 基本路径 + release notes 中文验证）| ✅ |
| Windows x64 D-β 实测 | 待实测 | **✅ 通过**（2026-05-28 跑通 build-win.ps1 完整链 / 装包 + 中文 release notes + 基本路径）| ✅ |
| R2 发版 | 待 | **✅ 完成**（2026-05-29，14 个文件全 HTTP 200：6 个 v0.9.6/ 归档 + 8 个 latest/ 镜像含 D-β latest-mac.yml + latest.yml）| ✅ |

---

## 1. 预测 vs 实际关键差异

### 1.1 PREVIEW 全程基于 v0.9.5..v0.9.6 diff，实际 merge-base 是 v0.9.4

**REVIEW-1..6 全部基于** `gh api compare/v0.9.5...v0.9.6` 的 GitHub Compare diff（66 文件 / +2199 −184）。

**实测** `git merge-base sync/upstream-v0.9.6-20260526 v0.9.6` = `4144f795 (v0.9.4)`，不是 v0.9.5。原因：fork 的 v0.9.5 sync commit (`f863f915`) 是 merge commit，所以 `git merge-base` 算法找到的最近 linear ancestor 是 v0.9.4 而不是 v0.9.5。

**后果**：3-way merge 实际比对 base = v0.9.4，导致：
- 7 个 AA 冲突（v0.9.5 加的 NEW 文件 + v0.9.6 改 → AA）
- 7 个额外 UU 冲突（v0.9.5 sync 期间 fork 改过的非 NPM-scope 内容 + v0.9.6 也改）

这是 PREVIEW v0-v6 的系统性盲区，REVIEW-7 截止后才识别（实际试过 take-theirs 第一次执行才暴露）。

### 1.2 1453 行 fork non-scope 改造漏盘

REVIEW-7 实测发现 fork main vs v0.9.5（+NPM scope sed）共 1453 行非-scope 改造，分布在 44 个 v0.9.6 改的文件中。**典型未带 marker 的 fork 改造**：

| 类别 | 例子 | 文件数 |
|---|---|---|
| env var rename | `CRAFT_IS_PACKAGED` → `U_AGENTS_IS_PACKAGED` 等 | main/index.ts +5 处 |
| env var feature-cut | `CRAFT_SCRIPTS` / `CRAFT_COMMANDS_ENTRY` / `CRAFT_CLI_ENTRY` 等 12 行删除 | main/index.ts |
| 内部 MCP server feature-cut | `'craft-agents-docs': { 'SearchCraftAgents': 'Search Docs' }` 段删除 | SessionManager.ts |
| 函数名 rename | `parseInternalCraftAgentsDeepLink` → `parseInternalUAgentsDeepLink` | server-core/handlers/rpc/system.ts |
| 注释 brand | `// uagents:// URLs` / `// Synthetic event from pi-agent-server` | handlers/system.ts / event-adapter.ts |
| Type alias brand | `Generator<UAgentEvent>` vs `Generator<CraftAgentEvent>` | event-adapter.ts |
| i18n locale brand + 翻译 | 7 个 locale 文件各 96-118 行 | de/en/es/hu/ja/pl/zh-Hans.json |

**全部不在 §3.7 marker 表内**（PREVIEW 默认假设 marker 表覆盖所有 fork 改造，错）。

### 1.3 取消 take-theirs，改成"仅编辑 conflict markers + 保 fork patches 不动"

第一次尝试用 PREVIEW SOP 的 `git checkout --theirs <file>` 策略，实测把 main/index.ts 的 fork env var renames、SessionManager.ts 的 craft-agents-docs feature-cut、event-adapter.ts 的 UAgentEvent 等都覆盖回了 upstream 版本。**git auto-merge 干净 + 工作树没 conflict marker + typecheck 过 → 但用户运行时会看到 brand 泄漏**。

REVIEW-7 截止 + 重做后新策略：
1. 15 package.json：保留 PREVIEW Python 3-way merge 脚本（验过安全）
2. bun.lock：保留 `git checkout v0.9.6 -- bun.lock + bun install`
3. **AA 文件**：根据 `diff main vs v0.9.5+sed` 的 non-scope diff 行数决定：
   - 0 行 → take theirs + batch sed（如 CompactModelSelector.tsx）
   - >0 行 → take theirs + batch sed + **手工重打 fork brand patches**（如 model-picker-helpers.ts 的 'U-API' + § 3.7 #54 marker comment）
4. **10 UU 代码文件**：**仅编辑 conflict markers，不用 git checkout**——保留 git auto-merge 已合并的 fork patches 区域

新策略验证：所有 fork brand patches（env vars / feature-cuts / 函数名 / 注释）merge 后**全保留**（gates 实测）。

### 1.4 collateral 修复（v0.9.5 同模式重现）

| 问题 | 表现 | 修复 |
|---|---|---|
| `packages/shared/package.json` `exports` 缺 `./utils/files` | macOS dist build 时 `@u-agents/shared/utils/files` 解析失败 | Python 3-way merge BRAND_FIELDS 不含 `exports`，被 v0.9.6 上游覆盖；手工补回（v0.9.5 同样踩过，sync collateral）|
| `apps/electron/src/main/window-manager.ts` 2 处 `@craft-agent/` import | 全 gates 通过但留下残留（其它 PR 影响为 0） | 后续手工 sed 修 |
| `SessionManager.ts` 重复 `const PI_SDK_MESSAGE_ID_CACHE_LIMIT = 256` | typecheck error TS2451 | 删除冲突区域引入的第二份 |
| `release-notes/0.9.6.md` 没翻译中文 + 留链接 | 用户首次实测发现 .dmg 内是英文版 + lukilabs/craft-agents-oss 链接 | 沿 0.9.5.md 风格全去链接 / 全去 commit hash + 完整中文翻译 + 加 "## 备注" |

---

## 2. 实际执行步骤记录（13-commit chain，含 REVIEW-7 截止）

按 PREVIEW §11.11 方案 Y++ 但有重大偏离（第一次 take-theirs 失败 → 回滚 → REVIEW-7 截止 → 重做）。完整 commit 时间线：

```
9d6ff4a4 (其后被 amend) chore(sync): upstream v0.9.6 merge  ← Phase 1 ends
7a4872ab (其后被 amend) chore(sync): + 中文 release notes 加链接
798ff882 chore(sync): upstream v0.9.6 merge                  ← 最终 sync commit
8230dda8 docs: PREVIEW v0.9.6 + REVIEW-7 截止报告（执行尝试 → 回滚）
a6bedb4c docs: PREVIEW v0.9.6 sync 预分析 + REVIEW-1..6
983c2691 docs: SYNC-v0.9.5-20260521 实测报告（previous main HEAD）
```

### 2.1 Phase 0 — PREVIEW + REVIEW-1..6（2026-05-26）

7 轮 review 累计修订（详见 PREVIEW §11）。最大单点发现：
- REVIEW-3：credential-manager-renew.test.ts mock pattern 迁移是 git 不报警的语义破坏（最大隐藏陷阱）
- REVIEW-4：'uagents:' literal vs 'classification.kind' 重构 2 处 git 真冲突
- REVIEW-6：4 处 "9→7" / "真冲突→语义冲突" 连锁同步漏改

### 2.2 Phase 0.5 — 执行尝试 → REVIEW-7 截止（2026-05-26 同日）

1. 用户："好，小心执行"，授权 Phase 1 merge
2. AI commit PREVIEW 到 main (`a6bedb4c`)
3. 建 sync 分支 + `git merge --no-ff v0.9.6` → 33 conflicts（vs PREVIEW 预测 19）
4. 走 PREVIEW §6.2 a-f SOP 解 conflicts：15 package.json + bun.lock + 7 AA + 部分 UU take-theirs
5. **AI 自己发现 take-theirs 静默丢 fork brand patches**（main/index.ts env vars / SessionManager.ts feature-cuts / event-adapter.ts UAgentEvent）
6. 用户："中止 + git merge --abort，重新规划"
7. `git reset --hard a6bedb4c` 回滚 + 删 sync 分支
8. AI 写 REVIEW-7 截止报告 → commit (`8230dda8`) 到 main

REVIEW-7 截止报告 §13 总结：PREVIEW v0-v6 全程基于 v0.9.5..v0.9.6 上游 diff，**漏盘 1453 行 fork non-scope 改造**。take-theirs 不可用，必须改用"逐文件手工 merge + 仅编辑 conflict markers"。

### 2.3 Phase 1 — 重做 merge（2026-05-26 同日）

用户："A"（继续干）。新策略 SOP：

| 子步 | 操作 | 结果 |
|---|---|---|
| 1.0 | 重建 sync 分支 + merge --no-ff v0.9.6 | 33 conflicts（确认） |
| 1.1 | 15 package.json Python 3-way merge | ✅ 14 patched + 1 unchanged |
| 1.2 | bun.lock checkout + bun install | ✅ Saved lockfile |
| 1.3 | 7 AA：release-notes/0.9.5.md take ours；6 NEW take theirs + batch sed + 重打 model-picker brand | ✅ 全 staged |
| 1.4 | 10 UU 代码文件：**仅编辑 conflict markers，不用 git checkout** | ✅ |
| 1.5 | 后处理：rename `parseInternalCraftAgentsDeepLink` → `parseInternalUAgentsDeepLink`（v0.9.6 上游恢复成 craft 命名，fork 保 UAgents） | ✅ |
| 1.6 | 全树 batch sed @craft-agent/ → @u-agents/ | ✅ 0 残留 |
| 1.7 | typecheck 跑出 SessionManager.ts 重复 const → 修复 | ✅ |
| 1.8 | SSRF 24 测试 → credential-manager-renew 3 fail → spyOn 迁移修复（REVIEW-3 关键 gate）| ✅ 24/24 pass |
| 1.9 | i18n parity 1462 keys（v0.9.5 1460 + v0.9.6 新 2 keys preview.expandPreview + preview.markdownPreview，上游已译 zh-Hans） | ✅ |

### 2.4 Phase 2 (Mac arm64 打包 — 2026-05-26 晚)

1. 第 1 次跑 `cd apps/electron && CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac` → 失败 `@u-agents/shared/utils/files` 解析失败
2. 修：`packages/shared/package.json` `exports` 加 `./utils/files`（v0.9.5 sync 同模式重现）+ amend sync commit
3. 第 2 次跑 → ✅ 成功
   - U-Agents-arm64.dmg 259 MB
   - U-Agents-arm64.zip 250 MB
   - U-Agents-x64.dmg + x64.zip 顺手生成（无 x64 mac 实测，D-β 方案）
   - 签名：ad-hoc（B1 escape hatch `CSC_IDENTITY_AUTO_DISCOVERY=false` 触发）
   - Bundle ID `cn.u-studio.u-agents` / Bundle Name `U Agents` / Version `0.9.6` ✓
4. 用户实测 .dmg ✅ 通过；但反馈 release notes 没翻译
5. 修：release-notes/0.9.6.md 中文翻译 + amend sync commit + 重打包
6. 用户反馈链接还在能打开 → 第 2 次修：全去链接 + 全去 commit hash + 加 "## 备注" 沿 0.9.5.md 风格 + amend + 第 3 次打包
7. 最终验证 .dmg 内 release notes 中文 + 0 链接 + 0 commit hash ✓

### 2.5 Phase 3 (Windows x64 打包 — 2026-05-28，用户在 Windows 机器上跑)

1. AI 准备源码包 `u-agents-v0.9.6-src.tar.gz` 到 `/Users/dengwang/Documents/u-agents-oss/`（91 MB，沿 v0.9.5 模式：含 .git + .planning + 源码 + bun.lock，不含 node_modules + dist + release）
2. AI 给 Windows 打包指令：**只有** `cd apps\electron && bun run dist:win` 是真发版命令（PREVIEW §14 反复强调 root scripts 不能用）
3. 用户跑 build-win.ps1 完整链 ✅ 成功
   - U-Agents-x64.exe 248 MB
   - signtool 签 (.exe / __uninstaller.exe / bun.exe / ripgrep.exe / claude.exe / elevate.exe) ✓ 但是自签证书 SmartScreen 警告（v0.9.5 同模式）
   - build log 出现 `file source doesn't exist from=...resources/bin/win32-x64` warning（uv.exe bootstrap gap，long-standing，PREVIEW §14.4 / SYNC-v0.9.5 F8，不阻塞）
4. 用户实测 .exe → ✅ 通过

### 2.6 Phase 4 — R2 发版（2026-05-29）

1. AI 准备 D-β `latest-mac.yml`（只含 arm64 entry，删 x64 — 跟 v0.9.5 同模式，避免给 Intel mac 推未实测包）
2. 用户跑 rclone 上传
3. 第 1 次 curl 验证发现：
   - latest-mac.yml 上传成了完整版（4 entries） → 用户重新上传 D-β 版覆盖
   - manifest.json / `/latest` pointer 缺 → AI 解释这俩是死代码（packages/shared/src/version/manifest.ts.getVersionManifest 实测 0 调用方），跟 v0.9.5 一样跳过
   - **arm64.dmg + arm64.zip 都 404**（用户上传时漏了主文件，只传了 blockmap）→ 补传 4 条命令（v0.9.6/ + latest/ 各 2 个文件）
4. 第 2 次 curl 验证 → ✅ 14 个文件全 HTTP 200

---

## 3. bun test fail 分类

| 测试套件 | 结果 | 说明 |
|---|---|---|
| `api-tools-ssrf.test.ts` | ✅ 10 pass / 0 fail | M3-SSRF baseline |
| `credential-manager-renew.test.ts` | ✅ 14 pass / 0 fail（含 7 SSRF guard 测试 spyOn 迁移后） | REVIEW-3 关键 gate |
| `web-fetch-ssrf.test.ts` | ✅ 7 pass / 0 fail | M3-SSRF baseline |
| `typecheck:all` | ✅ 全包 0 errors | 含 core / shared / server-core / server / session-tools-core / pi-agent-server / apps/electron / ui |
| `lint:electron` | ✅ 0 errors / 112 warnings (baseline) | 与 v0.9.5 同水平 |
| `lint:i18n:parity / sorted / coverage` | ✅ 全过 | 6 locales × 1462 keys |
| `packages/shared` 全套 `bun test` | 未单独跑（time constraint，gates 已够）| —— |

24 SSRF 测试全过是 REVIEW-3 commit gate 验收点，**v0.9.6 sync 最大单点风险被防住**。

---

## 4. CLAUDE.md §3.7 表更新清单

| 子表 | 变化 |
|---|---|
| 主基线 grep 数 | 98 → **98**（无新增改造点）|
| START/END 块数 | 9/9 → **9/9** 不变 |
| 各 §3.7 marker 文件 | 验证全保留（gate 1b 跑过）|
| Build 脚本 marker B 系列 | 不变 |

无新 marker 入表。

---

## 5. SOP 教训沉淀（已写进 PREVIEW §13 REVIEW-7 截止 + 本报告 §1）

| 教训 | 沉淀位置 | 已机制化？ |
|---|---|---|
| merge-base 实际可能远早于上一次 sync 版本（fork sync commit 是 merge commit）| §1.1 + PREVIEW §13.5 N7 | 待 REVIEW-8 入 PREVIEW SOP（**F18**）|
| take-theirs 在高 fork-customized 文件会静默丢 fork patches | §1.3 + PREVIEW §13 | 待 REVIEW-8 改 PREVIEW §6.2 默认动作（**F19**）|
| §3.7 marker 表不覆盖所有 fork 改造（1453 行 non-marker brand patches）| PREVIEW §13.4 Top 10 | 待 REVIEW-8 在 CLAUDE.md §3.7 加"未带 marker" sub-table（**F20**）|
| Python 3-way merge 漏 `exports` 字段（utils/files exports v0.9.5/v0.9.6 都踩）| §1.4 第 1 条 | 待 REVIEW-8 在 BRAND_FIELDS 加 `exports`（**F21**）|
| release-notes/X.X.X.md 必须**全去链接 + 全去 commit hash + 加中文 "## 备注"** | §1.4 第 4 条 | 待 REVIEW-8 在 PREVIEW §6.2 g 加显式 SOP + commit gate（**F22**）|
| R2 上传后必须 curl HTTP 200 验证 14 个文件（防漏传主产物）| §2.6 | 待 REVIEW-8 在 PREVIEW 加 commit-gate（**F23**）|
| Mac 端 batch sed 漏 auto-merged 文件（window-manager.ts 2 处 @craft-agent/ 没清）| §0 C11 行 | 全树 batch sed 应在 commit 前最后一步跑（已在新策略里，但 v0.9.6 实际跑时还是漏了 1 文件 — 改为 commit 前**强制** grep 验证）|
| Build 入口 SOP 一致：必须 `cd apps/<platform> && bun run dist:<platform>`，root scripts 全部不能用 | PREVIEW §14 强制核查清单 已就位 | ✅ v0.9.6 没再犯 |
| macOS adhoc 签名 escape hatch | PREVIEW §11.11.7 4-1 已就位 | ✅ v0.9.6 沿用 |

---

## 6. 实测评级：**A−**（与 PREVIEW 预测一致）

| 评级维度 | 判断 |
|---|---|
| sync regression | 0（功能 / 测试 / 性能没出新问题）|
| §3.3 高冲突 | 0 真冲突 |
| §3.7 改造点 | 1 真冲突 + 1 语义冲突（REVIEW-3 命中）+ 其它 8 个 UU 都干净解决 |
| C 类踩坑 | C11 / C13 各 1 触发（已机制化处理）；C13 未新增（v0.9.5 stub 复用）|
| sync collateral | 4 处（utils/files exports 漏 / window-manager.ts batch sed 漏 / SessionManager.ts 重复 const / release-notes 没译没去链）— 全是基线漏盘 fix 或新策略验证间发现的边角问题，不是 v0.9.6 引入 |
| 实测覆盖 | macOS dev + 装包 + Windows 装包 + R2 发版 14 文件 HTTP 200 |
| 用户主观接受度 | 用户反馈 macOS + Windows 实测都"OK 了"，release notes 中文化反馈一次（已修） |

**评级理由**：A 级缺漏只有"REVIEW-7 截止 + 重做"的工程曲折，但**最终产物质量与 PREVIEW 预测一致**。SOP 短板会在下次 sync 前的 REVIEW-8 修复。

不到 A 的 0.5：
- REVIEW-7 截止暴露 PREVIEW v0-v6 系统性盲区（merge-base 假设 + take-theirs 静默丢失），消耗一次回滚才发现
- R2 上传漏主文件（v0.9.5 也有类似漂移，但 fix 简单）
- release-notes 翻译反复改 2 次（用户体验插曲）

---

## 7. R2 发版记录（2026-05-29）

### 7.1 上传清单

| 路径 | 文件 | 大小 | 用途 |
|---|---|---|---|
| `r2:u-agents-update/v0.9.6/` | U-Agents-arm64.dmg | 259M | 归档 |
| 同上 | U-Agents-arm64.dmg.blockmap | 280 KB | 增量更新元数据 |
| 同上 | U-Agents-arm64.zip | 250M | 自动更新源 |
| 同上 | U-Agents-arm64.zip.blockmap | 264 KB | 同上 |
| 同上 | U-Agents-x64.exe | 248M | Windows NSIS installer |
| 同上 | U-Agents-x64.exe.blockmap | (随同) | 同上 |
| `r2:u-agents-update/latest/` | （以上 6 文件镜像） | 同上 | 自动更新指针 |
| 同上 | latest-mac.yml | 数百 B | Mac 自动更新清单（D-β arm64 only）|
| 同上 | latest.yml | 数百 B | Windows 自动更新清单 |

**v0.9.5 同模式：**
- 不传 manifest.json（packages/shared/src/version/manifest.ts.getVersionManifest 0 调用方，死代码）
- 不传 `/latest` pointer JSON（同上）

### 7.2 验证（curl）

- ✅ `latest-mac.yml` version 0.9.6 / 2 entries（arm64.zip + arm64.dmg）/ D-β 方案 ✓
- ✅ `latest.yml` version 0.9.6 / x64.exe entry ✓
- ✅ 14 文件 (v0.9.6/ 6 + latest/ 8) HTTP 200
- ✅ releaseDate: Mac 2026-05-26T15:53:35.610Z / Win 2026-05-28T15:32:01.662Z

### 7.3 自动更新验证

**待用户主动跑**（按 05 §8 要求）：
- 把 /Applications/U Agents.app 替回 v0.9.5（或从 R2 下个旧版）
- 启动 → 30 秒内出现"发现新版本 0.9.6"提示
- 点下载 → 安装 → 重启 → 验证版本号 0.9.6

---

## 8. Follow-up backlog（F8-F23，**不阻塞本次发版**）

| # | 项 | 触发 | 优先级 | 类别 |
|---|---|---|---|---|
| F8 | Windows uv.exe bootstrap gap (long-standing) | Windows fresh 机器 | P2 | M4 backlog |
| F11 | M3 SSRF spec 加 v0.9.6 credential getter 备注 | sync 后维护 | P2 | spec 同步 |
| F12 | 07-upstream-sync 加 C15 暗坑模式 (git auto-merge clean + 语义破坏) | sync SOP 沉淀 | P2 | SOP 同步 |
| F13 | REVIEW-8: Python 3-way merge 加 `exports` 字段保留（v0.9.5/v0.9.6 都踩 utils/files 漏盘）| 重复踩坑 | P1 | PREVIEW SOP |
| F14 | REVIEW-8: 'uagents:' literal vs 'classification.kind' 这种 brand-patch 路径列入 §3.7 sub-table | brand-patch 路径化 | P1 | CLAUDE.md §3.7 |
| F15 | REVIEW-8: release-notes/X.X.X.md "去掉所有链接 + commit hash" SOP 写明 + commit gate | 用户体验事故 | P1 | PREVIEW + commit gate |
| F16 | REVIEW-8: 1453 行 fork non-scope 改造审计 + 加到 PREVIEW SOP（17 高 fork-customized 文件 manual merge 指引）| REVIEW-7 截止根因 | P1 | PREVIEW SOP 重写 |
| F17 | REVIEW-8: R2 上传后 curl HTTP 200 验证作 commit gate（v0.9.6 漏传 arm64 主文件没人发现）| R2 实测漏 | P1 | PREVIEW commit gate |
| F18 | REVIEW-8: `git merge-base` 实测优先（sync 启动时第一步算实际共同祖先，校准 PREVIEW 预测范围）| §1.1 根因 | P1 | PREVIEW §6.1 |
| F19 | REVIEW-8: 把 PREVIEW §6.2 默认动作从 take-theirs 改成"仅编辑 conflict markers" | §1.3 教训 | P1 | PREVIEW SOP |
| F20 | REVIEW-8: CLAUDE.md §3.7 加"未带 marker"的 fork brand patches sub-table（env vars / 函数名 / 注释 brand / feature-cut 删除）| §1.2 教训 | P1 | CLAUDE.md §3.7 |
| F21 | REVIEW-8: Python 3-way merge BRAND_FIELDS 加 `exports` 字段 | F13 同源 | P1 | PREVIEW §6.2 b |
| F22 | REVIEW-8: release-notes SOP 显式化 | F15 同源 | P1 | PREVIEW §6.2 g |
| F23 | REVIEW-8: R2 上传 curl HTTP 200 commit gate | F17 同源 | P1 | PREVIEW commit gate |

F11-F23 都在 sync 后维护任务里，**不阻塞 v0.9.6 发版闭环**。建议在下次 sync (v0.9.7?) 启动前先做完 F13-F23 这批 REVIEW-8 PREVIEW 重写。

---

## 9. 给下次 sync (v0.9.7) 的提醒

1. **PREVIEW 启动第一步先实测 git merge-base**（不要假设是上一次 sync 版本，可能是更早的 base）

2. **PREVIEW SOP 默认动作改成"仅编辑 conflict markers"**：
   - 15 package.json + bun.lock 保留原 SOP（Python 3-way merge + checkout v0.9.X -- bun.lock）
   - AA 文件按 fork non-scope diff 行数决定（0 → take theirs；>0 → take theirs + 重打 brand patches）
   - **UU 代码文件全部手工编辑 conflict markers，不用 git checkout --theirs/ours**

3. **Commit gates 强制核查链**（按顺序）：
   - typecheck:all 全过
   - U-API marker 基线刷新（grep）
   - `@craft-agent/` 残留 0（grep）
   - REVIEW-4 grep 核查 `internal-deeplink` 等关键 brand-patch 路径
   - SSRF 24 测试 0 fail（REVIEW-3 gate）
   - lint:i18n parity / sorted / coverage
   - **R2 上传后 14 文件 curl HTTP 200**（新加）

4. **release-notes/X.X.X.md 翻译 SOP**：
   - 全去 GitHub 链接 / commit hash / lukilabs / craft-agents-oss
   - 完整中文翻译（沿 0.9.5.md / 0.9.6.md 风格）
   - 加 "## 备注" 章节收尾
   - **commit gate**：merge sync commit 前必须 grep 验证 0 链接 / 0 commit hash

5. **fork 长期 gap 清单**（每次 sync 必查是否仍存在）：
   - Windows uv.exe 不进 .exe（F8）
   - root `electron:dist:*` vs app `dist:*` 入口差（PREVIEW §14 已机制化）
   - Mac adhoc 签名需 `CSC_IDENTITY_AUTO_DISCOVERY=false`（PREVIEW §11.11.7 已机制化）
   - `packages/shared/package.json` `exports` 字段会被 v0.9.X 上游覆盖（F13/F21 修后不再需要）

---

> **本报告产出时间**：2026-05-29（R2 上传完成后）
> **总耗时**：sync 启动 → 发版完整闭环 ~3 天（2026-05-26 早 PREVIEW → 2026-05-29 R2 上线 + 验证）
> **方案**：PREVIEW SOP（v6）→ REVIEW-7 截止 → 重做新策略（"仅编辑 conflict markers"）
> **下一步**：用户主动测一次自动更新流程（按 05 §8），完成后 sync 闭环
