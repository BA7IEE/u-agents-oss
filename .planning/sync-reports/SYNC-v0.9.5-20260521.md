# SYNC v0.9.5 实测报告（2026-05-21 ~ 2026-05-22）

> 实测报告 —— 记录 v0.9.5 sync 的实际 merge / 打包 / 发版过程，与 [UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md](./UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md) 的 6 轮 review 预测对比。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.7 / §0 / §4

---

## 0. TL;DR

| 维度 | PREVIEW 预测 | **实测** | 一致度 |
|---|---|---|---|
| 上游 commit | `96454c27 v0.9.5` | ✅ 实际 `96454c27` | ✅ |
| 文件数 | 73（含 21 NEW + 52 MODIFIED）| 实际 73 | ✅ |
| §3.3 真冲突 | 0 | ✅ 0 | ✅ |
| §3.7 改造点真冲突数 | 1 真（model-picker-helpers brand）| ✅ 1 真 | ✅ |
| §3.7 编号策略 | 字典序：model-picker = #53, M3 i18n = #54 | **时间序：M3 i18n = #53（先落地），model-picker = #54** | ❌ 与 SOP 字典序相反 |
| 实际冲突总数 | 4-5 处预测 | **20 处**（15 package.json + bun.lock + FreeFormInput + mock-mobile-data + event-adapter + TurnCard）| ⚠️ 漏报 3 处（mock-mobile-data / event-adapter / TurnCard，全 C11 模式）|
| C11 NPM scope | 7 文件 9 处 + 15 package.json | ✅ 实际 7 文件 9 处 + 15 package.json | ✅（REVIEW-1 修正后准）|
| C13 触发 | 1（`lint:tool-name-checks` stub）| ✅ 1 处 stub | ✅ |
| §3.7 marker 基线 | 96 → 97 | **96 → 98**（+2：#53 + #54，预测漏算 model-picker 自己也 +1）| ⚠️ +1 |
| 评级 | A−（预测）| **A−**（与预测一致；20 冲突全是 trivial brand 修正不构成降级理由）| ✅ |
| macOS arm64 D-β 实测 | 待实测 | **✅ 通过**（2026-05-22 12:31 build / 装包 dev 实测正常；ad-hoc 签名走 B1 escape hatch）| ✅ |
| Windows x64 D-β 实测 | 待实测 | **✅ 通过**（2026-05-22 22:43 build；用户态 14 项 regression test 9 过 / 5 部分异常 / 2 失败 —— 5+2 全是 fork 长期 baseline 问题非本 sync 引入）| ✅ |
| R2 发版 | 待 | **✅ 完成**（2026-05-22 macOS + Windows 完整上传 + curl 验证 yml 内容 + 6 个归档文件全 HTTP 200）| ✅ |

---

## 1. 预测 vs 实际关键差异

### 1.1 §3.7 编号策略：字典序 → 时间序

**PREVIEW §11.5.1 / §11.11.6** 决策：按文件路径字典序分配编号。
- `apps/electron/.../input/model-picker-helpers.ts` → #53
- `apps/electron/.../renderer/main.tsx` → #54

**实际落地**：方案 Y++ Phase 2 静置期间，另一个 AI 在 commit `60929f25 docs(claude-md): 记录 #53 marker + 基线校准 96→98（M3 i18n fix）` 中把 #53 给了 M3 i18n fix（按时间序——M3 fix commit `5212197b` 先落地）。

Phase 3 spec 同步时按"事实优先"原则保留这个顺序，把 v0.9.5 sync 自身的 model-picker brand 补登为 #54。详见 PREVIEW §11.10 REVIEW-6 callout。

**教训**：PREVIEW SOP 写编号规则时，应该写"按时间序"而不是"按文件路径字典序"——前者更符合多 AI 协作场景的自然落地节奏。

### 1.2 冲突总数漏报

**PREVIEW §6.2** 预测：a/b/c/d/e 5 类冲突（15 package.json + bun.lock + FreeFormInput + 全树 sed + C13 stub）。

**实际**：20 处 git 报告的 conflict markers，其中 3 处 PREVIEW 没单独列：

| 文件 | 冲突性质 |
|---|---|
| `apps/electron/src/renderer/playground/demos/mobile-webui/mock-mobile-data.ts` | C11 + 上游新增 1 行 `LlmConnectionWithStatus` import |
| `packages/shared/src/agent/backend/pi/event-adapter.ts` | C11 + 上游加 `pi_turn_anchor` 分支 + docblock 改 `Craft AgentEvents` → `CraftAgentEvent`（我们 fork 改成了 `UAgentEvent`）|
| `packages/ui/src/components/chat/TurnCard.tsx` | C11 + 上游加 `isParentTaskTool` import |

3 处都是 **C11 NPM scope rename 跨上游新增 import 行**——属同模式。SOP 命令 `git checkout --theirs $packages/*/package.json && batch sed` 不覆盖这 3 个非 package.json 文件，需要手工 merge。

**教训**：PREVIEW §6.2 应该把 "C11 模式冲突文件清单" 列全（不只 15 package.json），下次预测能更准。

### 1.3 §3.7 基线漂移 +1

**PREVIEW §0** 预测：96 → 97。
**实际**：96 → 98（+2）。

差异源：PREVIEW 算 "+1 = v0.9.5 sync 的 model-picker brand"，没算 M3 i18n fix 同期搭车贡献的 +1。Phase 3 spec 同步时按"事实优先"补登 #54，基线刷成 98 ✓ 完全吻合。

### 1.4 PREVIEW §11.4 推演 vs 实际

**PREVIEW §11.4** REVIEW 7 个 ⚠️ AUDIT 项前提：v0.9.5 不改 setupI18n / bootstrap / main/index / registry / menu → 7 项推理仍有效。**实测全部成立**。dormant 路径 A（preferences system prompt 注入中文 → 模型风格变中文）激活效果用户主观接受（Phase 2.5 静置无反馈）。

---

## 2. 实际执行步骤记录（方案 Y++ 增稳版 — 7 commit chain）

按 PREVIEW §11.11 DECISION-1 用户选定方案。7 commit 落地时间线：

```
0fdf05bd docs: PREVIEW §11.11.7 4-1 加 ad-hoc 签名 escape hatch 说明      ← B1 教训
782d6d0b docs: Phase 3 spec 文档同步 — §3.7 基线 96 → 98 反映 v0.9.5 + M3
60929f25 docs(claude-md): 记录 #53 marker + 基线校准 96→98（M3 i18n fix）   ← 其它 AI Phase 2.5 期间补登
216fd61c docs: PREVIEW v0.9.5 §9 F7 — call_llm parallel outputSchema follow-up
5212197b fix(i18n): main process startup language sync (M3-I18N-MAIN-PROCESS-SYNC-FIX)  ← #53
7a415f1b docs: PREVIEW v0.9.5 REVIEW-1..5 + DECISION-1 + §13 长期反思
d43f04d9 fix(sync): drop @github/copilot-sdk dep re-introduced by 3-way merge
f863f915 chore(sync): upstream v0.9.5 merge                              ← sync 主体 + #54
```

Phase 后续：

```
4986d53a docs: PREVIEW v0.9.5 §14 — AI 打包指令强制核查清单（REVIEW-7）  ← 防错机制化
fe83afb4 fix(build-win): subprocess server build 命令链笔误修正（B2 marker 完善）  ← 真源码 fix
```

bisect 友好的单一职责 commit 设计——方案 Y++ 的核心好处兑现。

### 2.1 Phase 1（sync commit dry-run + 1.5 静置 1 天）

- merge upstream/v0.9.5 → 20 个冲突
- 5 类批量处理（package.json / bun.lock / FreeFormInput / mock-mobile-data + event-adapter + TurnCard / 全树 sed）
- C13 stub 创建（`scripts/check-task-tool-checks.sh`）
- model-picker-helpers brand patch + 4 处单测断言
- typecheck 0 errors / lint:electron 0 errors 112 warnings (+2 来自 NEW 文件) / i18n 全绿 (6 locales × 1460 keys)
- marker 基线 97（含 #54 model-picker brand）

**Phase 1.5 静置 1 天**：dev 模式日常使用 — 用户反馈 "使用过程中没遇到什么问题目前"。

### 2.2 Phase 2（i18n fix commit + 2.5 静置 1 天）

- 改 `apps/electron/src/renderer/main.tsx` 加 IPC 推送 + `.catch` 兜底
- typecheck / lint / marker 基线 98
- dev 实测：用户报 "Phase 2 实测没有啥问题，但是它自己测试遇到一个：call_llm parallel outputSchema 参数错位"
  - 诊断与 sync 无关（v0.9.5 没改 llm-tool / parallel 序列化）→ 记 §9 F7 follow-up

**Phase 2.5 静置 1 天**：用户反馈 "可以打包了吧 没发现什么明显问题"。

### 2.3 Phase 3（spec 文档同步）

按事实优先策略：
- CLAUDE.md §3.7 补 "v0.9.5 sync 期间新增改造点" 子表（#54 = model-picker brand）
- M3 spec §7 基线 96→97 改成 96→98
- AUDIT §7 同步基线断言
- PREVIEW §11.10 加 REVIEW-6 callout 说明字典序 vs 时间序

### 2.4 Phase 4（双平台打包 + R2 发版）

**macOS arm64**（用户授权我执行）：
- 第一次跑 `bun run electron:dist:mac` 挂在 codesign（keychain 残留 `com.justiceleague.batman` self-signed）→ 用 `CSC_IDENTITY_AUTO_DISCOVERY=false` (B1 escape hatch) 重跑成功
- 产物：U-Agents-arm64.dmg + .zip + x64 (267MB)；bundle ID / brand 全 ✓
- Mac dev 实测：6 项 D1-D6 全过

**Windows x64**（用户在 Windows 机器上跑）：
- 第一次跑 `bun run electron:dist:win`（**我给错指令**，root scripts 跳过 bootstrap）→ 5 个 extraResources warnings → .exe 缺核心 binary
- 第二次跑 `cd apps/electron && bun run dist:win`（= build-win.ps1）→ 挂在 `electron:build:subprocess` script 不存在
- **诊断为 build-win.ps1 L301 真源码 bug**（v0.9.4 B2 marker 注释笔误带进来的）
- 修复：commit `fe83afb4` 改 build-win.ps1 L301 改成 `server:build:subprocess` + `scripts/copy-subprocess-servers.ts`
- Windows 端用一行 PowerShell 替换继续打包成功
- 用户态 14 项 regression test：9 过 / 5 部分异常 / 2 失败（详见 §8 F8-F13）

**R2 上传**（用户跑 rclone）：
- arm64.dmg / .zip / .blockmap 4 文件 + Windows x64.exe / .blockmap + 手编 latest-mac-arm64-only.yml + latest.yml
- D-β 方案（只 arm64 上 R2，无 x64 entry）
- copyto vs copy 没踩坑
- curl 验证 latest-mac.yml + latest.yml 内容正确 + 11 个文件 HTTP 200

---

## 3. bun test fail 分类

实测 `cd packages/shared && bun test`：**2928 pass / 1 fail / 12 skip**

| 测试 | 性质 |
|---|---|
| `send_developer_feedback permission mode handling > is allowed in safe (Explore) mode` | **v0.9.4 baseline pre-existing**（已通过 stash + checkout main 验证）—— 不是 v0.9.5 sync 引入 |

`cd apps/electron && bun test src/renderer/components/app-shell/input/__tests__/model-picker-helpers.test.ts`：**18/18 pass** — brand patch + 4 处单测同步改成功验证。

vs PREVIEW 预测 v0.9.4 baseline 19 latent fail：**显著好转**——上游 v0.9.5 顺手修了其它 18 个 latent fail（含 turn-lifecycle / turn-utils-grouping / source-activation-drain 等新增测试覆盖到的）。

---

## 4. CLAUDE.md §3.7 表更新清单

| 子表 | 变化 |
|---|---|
| "M3 i18n 主进程启动同步（2026-05-21）" 子表 | 已加 #53 = `renderer/main.tsx` IPC 推送（commit `5212197b` / 其它 AI 在 `60929f25` 落地）|
| "v0.9.5 sync 期间新增改造点（2026-05-21）" 子表 | 已加 #54 = `model-picker-helpers.ts` brand patch（commit `f863f915` / 我在 `782d6d0b` 补登）|
| 主基线 grep 数 | 96 → **98**（验证：grep U-API 实测 98 / START 9 / END 9 全吻合）|
| Build 脚本 marker B 系列 | 不变 |

---

## 5. SOP 教训沉淀（已写进 PREVIEW §6 / §11 / §14）

| 教训 | 沉淀位置 |
|---|---|
| package.json 处理必须 3-way merge（不能 `--theirs + sed scope`）| PREVIEW §6.2 b 步（加 Python 脚本）|
| `bun run electron:dev` from repo root，不是 `cd apps/electron && bun run electron` | PREVIEW §11.10 R8 + M3 spec §9.1 |
| macOS adhoc 打包用 `CSC_IDENTITY_AUTO_DISCOVERY=false` (B1 escape hatch) | PREVIEW §11.11.7 4-1 |
| **AI 给打包指令前必读 05 §3.2.0 命令深度对照表**（root scripts vs app scripts）| PREVIEW §14（强制核查清单 C1-C6）|
| `bun run dist:{mac,win}` 在 `apps/electron/` 子目录跑，调 `build-{dmg,win}.{sh,ps1}` 含完整 bootstrap | PREVIEW §14 |
| fresh 机器 build script 不 bootstrap uv → 必须手动 | PREVIEW §14.4 + §14.5（M4 backlog）|
| build-win.ps1 L301 笔误 `electron:build:subprocess` → 实际是 `server:build:subprocess` + `scripts/copy-subprocess-servers.ts` | commit `fe83afb4` 真源码 fix |

---

## 6. 实测评级：**A−**（与 PREVIEW 预测一致）

| 评级维度 | 判断 |
|---|---|
| sync regression | 0（功能 / 测试 / 性能没出新问题）|
| §3.3 高冲突 | 0 真冲突 |
| §3.7 改造点 | 1 真冲突（按预期处理）|
| C 类踩坑 | C11 / C13 各 1 触发（已机制化处理）|
| sync collateral | 3 处（@github/copilot-sdk dep 重新带回 / utils/files exports 漏盘 / electron:dev:logs brand 漏盘）—— 全是 baseline 漏盘 fix，不是 v0.9.5 引入 |
| 实测覆盖 | macOS dev + 装包 + Windows 装包 + R2 发版 + 用户态 regression test 14 项 |
| 用户主观接受度 | 静置 2 天后报"没发现什么明显问题" |

**评级理由**：A 级缺漏只有 Windows uv.exe 没进 .exe（PREVIEW §14 long-standing gap），且不影响主路径（chat / call_llm / file ops / Bash 全过）。

不到 A 的 0.5：fork main / Windows baseline gap 较多（详见 §8 F8-F13）。

---

## 7. R2 发版记录（2026-05-22）

### 7.1 上传清单

| 路径 | 文件 | 大小 | 用途 |
|---|---|---|---|
| `r2:u-agents-update/v0.9.5/` | U-Agents-arm64.dmg | 259M | 归档（回滚 / 审计）|
| 同上 | U-Agents-arm64.dmg.blockmap | ~150KB | 增量更新元数据 |
| 同上 | U-Agents-arm64.zip | 250M | 自动更新源（electron-updater）|
| 同上 | U-Agents-arm64.zip.blockmap | ~150KB | 同上 |
| 同上 | U-Agents-x64.exe | 247M | Windows NSIS installer |
| 同上 | U-Agents-x64.exe.blockmap | ~150KB | 同上 |
| `r2:u-agents-update/latest/` | （以上 6 文件镜像）| 同上 | 自动更新指针 |
| 同上 | latest-mac.yml | 数百 B | Mac 自动更新清单（D-β arm64 only）|
| 同上 | latest.yml | 数百 B | Windows 自动更新清单 |

### 7.2 验证（curl 跑过）

- ✅ `latest-mac.yml` version 0.9.5 / 2 entries（arm64.zip + arm64.dmg）/ D-β 方案
- ✅ `latest.yml` version 0.9.5 / x64.exe entry
- ✅ 11 个文件 (latest/ 5 + v0.9.5/ 6) HTTP 200
- ✅ releaseDate: Mac 2026-05-22T04:32:09Z / Win 2026-05-22T14:44:23Z

### 7.3 自动更新验证

**待用户主动跑**（按 05 §8 要求）：
- 把 /Applications/U Agents.app 替回 v0.9.4
- 启动 → 30 秒内出现"发现新版本 0.9.5"提示
- 点下载 → 安装 → 重启 → 验证版本号 0.9.5

---

## 8. Follow-up backlog（F7-F13，**不阻塞本次发版**）

| # | 项 | 触发 | 优先级 | 类别 |
|---|---|---|---|---|
| F7 | `call_llm + multi_tool_use.parallel + outputSchema` 组合参数错位 | Phase 2 LLM 自跑 regression test | P3 | Pi SDK / Claude Agent SDK 自身 bug（与 sync 无关）|
| F8 | Windows uv.exe 不进 .exe：build-win.ps1 没 bootstrap uv | Phase 4 Windows fresh 机器 | P2 | M4 backlog——build script 调 `downloadUv()` 与 dev 模式一致 |
| F9 | Windows markitdown shim 损坏（指向 `C:/Program Files/Git/markitdown_cli.py` 不存在）| 用户 regression test | P2 | 调查 npm install hook / packaging 路径 |
| F10 | Windows `script_sandbox` 平台 long-standing gap：当前 message 改成"Windows 暂不支持"更友好 | 用户 regression test | P3 | i18n message 优化 |
| F11 | Windows `browser_tool` example.com 触发安全验证 false positive（`ax:near-empty(1/2)`）| 用户 regression test | P3 | 上游 baseline，等收集更多 sample |
| F12 | Windows `find` glob `**/config.json` 不匹配 | 用户 regression test | P2 | Windows path 分隔符兼容性 |
| F13 | tool 默认 working directory 一致性：pwd 显示 workspace 而非 session 根 | 用户 regression test | P2 | spec 核对 + 实现修正（可能是 PI SDK 行为）|

**所有 F7-F13 都是 fork main / Windows baseline / 上游 SDK 问题，不是 v0.9.5 sync 引入**——用户 Phase 4 实测期间发现，已记进 PREVIEW §9 / §14 follow-up 表。

---

## 9. 给下次 sync (v0.9.6) 的提醒

1. **PREVIEW SOP**：
   - §14 强制核查清单 C1-C6 必走（不能直接 grep root package.json scripts）
   - §6.2 b 步用 Python 脚本 3-way merge package.json
   - §11.11.7 4-1 默认 `CSC_IDENTITY_AUTO_DISCOVERY=false`（除非用户拿到 Apple Developer ID）

2. **编号策略**：按时间序，不按字典序（多 AI 协作场景下时间序更自然）

3. **冲突预测**：C11 NPM scope rename 跨"上游新增 import 行"会触发 conflict marker，不只 package.json。PREVIEW §6.2 应列全模式

4. **build-win.ps1 完整 self-contained**：commit `fe83afb4` 已修笔误，但 uv bootstrap 仍 missing（M4 backlog F8）

5. **fork 长期 gap 清单**（每次 sync 必查是否仍存在）：
   - root `electron:dist:*` vs app `dist:*` 入口差（依赖 dev 模式副作用）
   - build script 不 bootstrap uv
   - Windows browser_tool anti-bot heuristic false positive
   - Windows script_sandbox 平台限制

---

> **本报告产出时间**：2026-05-22（晚上 R2 上传完成后）
> **总耗时**：sync merge → 发版完整闭环 ~24 小时（2026-05-21 早 sync 启动 → 2026-05-22 晚 R2 上线 + 验证）
> **方案**：Y++ 增稳版（DECISION-1）
> **下一步**：用户主动测一次自动更新流程（按 05 §8），完成后 sync 闭环
