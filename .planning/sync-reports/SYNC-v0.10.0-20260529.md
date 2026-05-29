# SYNC v0.10.0 — 实测报告（2026-05-29）

> 本报告记录 v0.10.0 上游同步的**实际执行**（经用户当次授权破 §0 铁律）。
> 配套预分析：[`UPSTREAM-PREVIEW-v0.10.0-2026-05-29.md`](UPSTREAM-PREVIEW-v0.10.0-2026-05-29.md)（含 REVIEW-1 安全核查 + REVIEW-2 dry-run）。
> 安全收紧规格：[`M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md`](../M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md)。

---

## 0. TL;DR

| 维度 | 结果 |
|---|---|
| 上游版本 | **v0.10.0**（`215910da`），base v0.9.6（`d0e674f5`）|
| merge commit | **`7bfd977a`**（分支 `sync/upstream-v0.10.0-20260529`）|
| 影响面 | 61 文件 / +2588 −162（merge）；fork 改动后 62 文件 / +2632 −162 |
| 主题 | remote `browser_tool` 桥接 + 浏览器标签 per-workspace 隔离 + #824 basic-auth fix |
| **冲突** | **19 个，全是浅冲突**（14 package.json C11 + 5 源码 import 块/config 值）|
| C11 scope rename | 3 上游新文件 5 处 import → `@u-agents/`；全仓 `@craft-agent/` = **0** |
| brand patch | 2 处 remote browser 错误文案 "Craft Agent" → "U Agents"（#55/#56）|
| **安全 lockdown** | **D1**（`allowRemoteEvaluate` 默认 false，#57）+ **D5-b**（dispatcher `browserToolEnabled` 总闸，#58）+ 防回归测试（#57t/#58t）|
| marker 基线 | **98 → 105**（净 +7）；START/END 各 9 |
| typecheck | `typecheck:all` **0 errors**（全 8 包）|
| i18n | parity OK，6 locales × 1462 keys；coverage OK（1541 callsites）|
| test | **0 新增 regression**（browser-pane-manager 8 fail = v0.10.0 upstream baseline latent，临时 worktree 实测确认）|
| lint | `lint:electron` 0 errors（112 warnings pre-existing）；`lint:shared` **4 errors = baseline pre-existing**（C13 follow-up）|
| SDK / Breaking | 无 SDK bump / Breaking None |
| **评级** | **A−**（代码 sync 完成 + 全自动验证绿、0 regression；打包 + 平台实测 deferred）|

---

## 1. 执行过程（4 段授权递进）

本次 sync 在用户 4 次明确授权下分段推进，每段可回滚：

1. **拉取 + 预分析**（PREVIEW）：`git fetch upstream` + 只读分析 → PREVIEW 报告。
2. **REVIEW-1 对抗性自查**：回代码验证，纠正安全论述（dispatcher 无总闸）、测试 take-theirs 危险、数字笔误；产出 LOCKDOWN-SPEC。
3. **REVIEW-2 dry-run**：`git merge --no-commit` → 看真实冲突 → `git merge --abort`，校正 2 处漏预测（均浅冲突）。
4. **实际执行**（本报告）：正式 merge + 解冲突 + C11 + brand + D1/D5-b lockdown + 验证 + commit。

---

## 2. 冲突解决实录（19）

### 2.1 五个源码冲突（全浅，与 dry-run 一致）

| 文件 | 冲突 | 解法 |
|---|---|---|
| `config-defaults.json` | `browserToolEnabled:false`(ours) vs 上游加 `allowRemoteEvaluate:true` | 保 false + `allowRemoteEvaluate:false`（D1）|
| `bootstrap.ts` | import 块 scope + 上游加 `BrowserCapabilityRequest` | 取 theirs + `@u-agents` scope |
| `storage.ts` | #46 marker+false vs 上游加 `allowRemoteEvaluate` | 保 #46 + `allowRemoteEvaluate:false` + D1 marker |
| `browser-pane-manager.ts` | import 块 scope + 上游加 5 remote-browser import | 取 theirs + scope + 加 `getBrowserToolEnabled`（D5-b 预备）|
| `SessionManager.ts` | import 块 scope + 上游加 `RpcServer`/`RemoteBrowserPaneManager` | 取 theirs + scope |

### 2.2 十四个 package.json（C11 统一模式）

全部 `name`(ours `@u-agents`) + `version`(theirs `0.10.0`)，2 个（electron/server）多 description(ours "U Agents")。非冲突部分（deps/exports）git 已自动合并。用 `perl -i` 批量解（取 ours 段 + version→0.10.0）。

> ⚠️ **踩坑记录**：首次批量用 `for f in $CONFLICTED`（unquoted 变量）失败——**zsh 不对未引用变量做 word-splitting**，整个多行列表被当成一个文件名。改用 `... | while read -r f` 逐行（zsh/bash 通用）后成功。perl 报错时未写文件，无破坏。

---

## 3. C11 / brand / lockdown

### 3.1 C11 scope rename
上游 3 新文件 5 处 `@craft-agent/` import（`RemoteBrowserPaneManager.ts` ×2 + `error-codes.test.ts` + `browser-broadcast.test.ts` ×2）→ `perl -i` rename `@u-agents/`。全仓 grep `@craft-agent/` = **0**。

### 3.2 brand patch（#55/#56）
2 处 v0.10.0 新增的用户/agent 可见错误文案（remote browser 无可用 client 时）："Craft Agent desktop app" → "U Agents desktop app"：
- `pi-agent.ts:129` `mapBrowserToolErrorCode`
- `RemoteBrowserPaneManager.ts:75` `invoke()`

> 其它 "Craft Agent" 命中均**不处理**：Apache attribution 注释（`* based on Craft Agents`，合规保留）、代码注释、测试字符串、playground demo——要么合规、要么 v0.10.0 未碰的既有文件（§5.5 不扩张范围）。

### 3.3 安全 lockdown（D1 + D5-b）
REVIEW-1 坐实 **remote workspace 可达**（"Connect Remote" UI + URL 自由输入 + 未裁剪）+ **dispatcher 无 `browserToolEnabled` 总闸**，故 #46 拦不住远程驱动本地浏览器的非-`evaluate` 方法。落地：
- **D1（#57）**：`allowRemoteEvaluate` 默认 `false`（config-defaults.json + storage.ts FALLBACK + marker）。
- **D5-b（#58）**：`dispatchCapability` 入口加 `if (!getBrowserToolEnabled()) throw CAPABILITY_UNAVAILABLE` 总闸（复用现有 error code + pi-agent 友好文案，零新增）。
- **防回归（#57t/#58t）**：`m2-security-regression.test.ts` 加 2 describe（17 tests 全绿）。

默认效果：`browserToolEnabled=false`（#46）→ D5-b 在 dispatcher 入口拒绝**所有**远程 browser 调用；即便用户手动开 browser tool，D1 仍默认禁远程 `evaluate`。

---

## 4. 验证结果

| 项 | 结果 |
|---|---|
| `bun install` | ✅ 1732 packages（bun.lock 无变化——无外部依赖 bump，符合 PREVIEW）|
| `typecheck:all` | ✅ **0 errors**（core/shared/server-core/server/session-tools-core/pi-agent-server/electron/ui 全过）|
| `lint:i18n:parity` | ✅ 6 locales × 1462 keys |
| i18n coverage（husky）| ✅ 1541 callsites / 1462 keys |
| `lint:electron` | ✅ 0 errors（112 warnings pre-existing）|
| `lint:shared` | ⚠️ **4 errors = baseline pre-existing**（见 §5）|
| `m2-security-regression` | ✅ 17 pass / 0 fail（含 D1/D5-b 新测试）|
| browser 相关 test（7 文件 107）| 99 pass / 8 fail（见 §5 baseline 对照）|
| marker grep | ✅ 105 / START 9 / END 9 |
| `@craft-agent/` grep | ✅ 0 |

---

## 5. baseline 对照（0 新增 regression 确认）

### 5.1 browser-pane-manager.test.ts 8 fail = v0.10.0 upstream baseline
fail 测试全是 focus/destroy/toolbar/popup/theme-replay（electron BrowserWindow mock 在 bun runtime 的固有问题），**不调用 `dispatchCapability`**，与 D5-b 无关。

**确凿验证**：`git worktree add --detach /tmp/v0100base v0.10.0` + `bun install` + 跑同一测试 → **纯 v0.10.0 baseline 也是 68 pass / 8 fail**。完全一致 → 本次 sync **0 新增 test regression**（符合 CLAUDE.md C13 + electron latent fail 记载）。

### 5.2 lint:shared 4 errors = fork baseline pre-existing
4 errors 全是 `craft-shared/no-inline-source-auth-check`，落在 `token-refresh-manager.ts` + 其 test——**本次 sync 未碰、v0.10.0 也未碰**（merge 前后 0 diff）。**merge 前 main `87ffbeb7` 跑 lint:shared 同样 4 errors / 9 warnings**。

→ 既有技术债（fork 早期引入，之前 sync 报告未注意 `lint:shared` 此规则），**与本次 sync 无关**。

---

## 6. Follow-up（backlog）

| # | 项 | 说明 |
|---|---|---|
| F1 | ✅ **已清（2026-05-29）** | 经查实为**规则误报**：170/180 是赋值写 in-memory mirror（非 gating 读，`isSourceUsable()` 是只读 helper 不能替代写）、507/538 是测试字段断言（验证 reset 语义，同 §3.7 #39）。4 处加 `eslint-disable` + `// U-API:` 注释（§3.7 #59）→ lint:shared **0 errors**；token-refresh test 32 pass 不变。基线 105→109。|
| F2 | **打包 + 平台实测** | 本次只到 merge commit，未打包。建议 macOS arm64 + Windows x64 D-β（与 v0.9.4/v0.9.6 一致）|
| F3 | **remote browser lockdown 手动 verify** | 连一个 remote workspace 验证：默认 browserToolEnabled=false 时远程 `browser_tool` 收到 `CAPABILITY_UNAVAILABLE`；开启后远程 `evaluate` 被 D1 拦（`BROWSER_REMOTE_EVALUATE_BLOCKED`）|
| F4 | **merge 回主分支** | 当前在 `sync/upstream-v0.10.0-20260529`，验证后 merge 回 main（用户决定时机）|

---

## 7. 评级：A−

- **支撑 A−**：全浅冲突机械解决 / typecheck:all 0 errors / i18n 绿 / marker 105 一致 / **0 新增 test regression**（baseline 实测对照）/ 无 SDK bump / Breaking None / 安全 lockdown 同步落地。
- **未达 A**：打包实测暴露 2 个 bug（§8，均已修 + 重打包）；x64 实测 + merge-to-main 待做（F2/F4）；lint:shared baseline 技术债待清（F1）。
- 与 PREVIEW 预测（A−）一致，dry-run 校正后无意外。

> **关键经验**：dry-run（REVIEW-2）准确预演了全部冲突，实际执行 0 意外；REVIEW-1 的安全核查（dispatcher 无总闸 + remote workspace 可达）驱动了 D1/D5-b 必要的纵深防御——若只做机械 sync 会漏掉这个新远程控制面的收紧。

---

## 8. 打包后实测发现的 bug（2026-05-29，macOS arm64 D-β）

用户实测首个 arm64 DMG 发现 2 个问题，均已修复（commit `675f622b`）并重新打包：

### 8.1 `piServerPath not configured`（P0，agent 不可用）

**现象**：首条 LLM 消息抛 "piServerPath not configured. Cannot spawn Pi subprocess."

**根因**：`build-dmg.sh` 长期缺 `copy-subprocess-servers.ts` 调用：
- pi-agent-server build 到 `packages/pi-agent-server/dist/index.js`（electron:build 产物）
- resolveServerPath packaged 分支找 `resources/pi-agent-server/index.js`；electron-builder.yml `files` 打包 `resources/pi-agent-server/**`
- **但 `apps/electron/resources/` 只有 bridge-mcp-server，缺 pi/session**——无任何步骤把 server copy 进去
- `build-win.ps1` §2.3 调了 `copy-subprocess-servers.ts`，但 **`build-dmg.sh` 从未调**（`git log -S` 确认）= macOS/Windows 打包长期不对称

**影响**：macOS DMG 的 Pi backend 从未真正工作过（之前 macOS 实测有限，M2.5 #4 deferred，掩盖了此缺陷）。

**fix**：build-dmg.sh `electron:build` 后加 `bun run scripts/copy-subprocess-servers.ts`（B8 marker，§3.7 build 子表；build grep 期望 ≥13→≥14）。

### 8.2 更新日志（最新动态）未翻译（P2，体验）

**现象**：app「最新动态」显示 v0.10.0 英文 release notes。

**根因**：v0.10.0 sync 执行时漏盘 release-notes 翻译（PREVIEW §6 SOP step 10 列了但实际跳过）。

**fix**：`release-notes/0.10.0.md` 中文翻译 + brand 替换 + 去 commit hash / lukilabs URL + 补 U Agents 安全默认说明（D1/D5-b）。

> **教训**：打包必须真测 Pi 对话（触发 subprocess spawn），不能只测启动——B8 是 fork 历史上首次在 macOS 实测中暴露的 subprocess 打包缺陷，与 Windows 事故 #3/#4/#5 同根（build 脚本与 root chain 结构性差距，C14）。**两个 build 脚本（build-dmg.sh / build-win.ps1）应纳入定期对称性核对**；release-notes 翻译应进 sync 收尾 checklist（已在 SOP 但执行漏盘）。

---

> 本报告由本仓库 AI 在用户当次授权下产出；执行的代码改动均已记录于 §3.7 marker 表（#55-#58 + build 子表 B8）。后续 x64 实测 / merge-to-main 待用户驱动。
