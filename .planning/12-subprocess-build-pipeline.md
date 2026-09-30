# 12 — 子进程构建与打包链路（运行时硬依赖地图）

> **本文档专门解决"打包成功但运行时报 `xxxServerPath not configured` / `Cannot spawn xxx subprocess`"这类故障**。
> 每次发版前必读 §3 验收清单。每次同步上游必读 §5 同步守则。

---

## 0. 为什么需要这份文档（M1 真实事故记录）

### 0.1 事故 #1 — pi-agent-server 缺失（commit `8ebe8c0`）

**事故时间**：M1 v0.9.0 首次 `electron:dist:adhoc:mac` 打包后立即出现。

**症状**：DMG 安装、应用能启动、onboarding 走完、设置 U-API Token 能存入；**首次发任何 LLM 消息**立刻报：

```
piServerPath not configured. Cannot spawn Pi subprocess.
(subprocess produced no stderr output)
```

**根因**：[`scripts/build/common.ts:520`](../scripts/build/common.ts) 定义了 `copyPiAgentServer()` 函数，把 `packages/pi-agent-server/dist/index.js` 复制到 `apps/electron/resources/pi-agent-server/index.js`，但 **`bun run electron:build` 流程从来没调用它**。结果:
- `apps/electron/resources/pi-agent-server/` 目录不存在
- `electron-builder.yml` 的 `extraResources: resources/pi-agent-server/**/*` 因源目录空而打进去 0 文件
- 运行时 [`runtime-resolver.ts:249`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) `resolveServerPath('pi-agent-server')` 返回 `undefined`
- [`pi-agent.ts:340`](../packages/shared/src/agent/pi-agent.ts) throw

**修复**：新增 [`scripts/copy-subprocess-servers.ts`](../scripts/copy-subprocess-servers.ts)，在 [`package.json`](../package.json) 的 `electron:build` 末尾接 `electron:build:subprocess`。详见 §2.1。

### 0.2 事故 #2 — vendor/bun 缺失（commit `8359988`）

**事故时间**：事故 #1 修完后立刻显现——fix 让 pi-agent-server 文件进了 DMG，但子进程一旦被 spawn 又出现新症状。

**症状**：onboarding 输入 Token 那一屏点 **Continue** 后，**Dock 里多出第二个 U Agents 图标，跳几下后消失**。看起来像应用偷偷重启自己。

**根因**：[`runtime-resolver.ts:64-83`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) `resolveBundledRuntimePath()` 找 `appRootPath/vendor/bun/bun`，找不到时 [`runtime-resolver.ts:250`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) `nodeRuntimePath` 落到 `process.execPath`——在 packaged Electron 里就是 **U Agents 主二进制本身**。于是 [`pi-agent.ts:343, 397`](../packages/shared/src/agent/pi-agent.ts) `spawn(nodePath, [piServerPath], ...)` 等价于 `spawn("U Agents.app/Contents/MacOS/U Agents", [pi-agent-server/index.js], ...)`：
- macOS LaunchServices 把 spawn 出来的 Electron 主二进制注册成新 Dock 图标
- 子 Electron 进程加载 ESM bun bundle 立刻 throw 退出
- → 图标"跳几下消失"

跟事故 #1 是同一类问题：[`scripts/build/common.ts:106`](../scripts/build/common.ts) 定义了 `downloadBun()` 函数（下载 ~50 MB bun 到 `electronDir/vendor/bun/bun`），[`electron-builder.yml:62`](../apps/electron/electron-builder.yml) 配置了 `vendor/bun/**/*` 进 files，但 `electron:build` 链路**从未调用 `downloadBun()`**——同样的"helper 定义了但没接到链路"事故模式。

**修复**：扩展 [`scripts/copy-subprocess-servers.ts`](../scripts/copy-subprocess-servers.ts)，加 `downloadBun(buildConfig)` 调用 + `vendor/bun/bun` 已存在则跳过下载（cache 复用）。详见 §2.1。

**已知限制**：`downloadBun()` 一次只能下一个 arch，单一 `apps/electron/vendor/bun/bun` 路径。当前实现按 host arch 下载——arm64 build host 同时打 arm64+x64 时，**x64 DMG 会带 arm64 bun**，装到 Intel Mac 上仍会复现 Dock 闪退。M1 主分发面是 Apple Silicon，可接受；M2 必须拆成按 arch 分两次构建。详见 §6。

### 0.3 事故 #3 — Windows EXE 缺 pi-agent-server（事故 #1 的 Windows 翻版，2026-05-05 修）

**事故时间**：M2 dist:win 重打验证阶段（用户在 Windows 机器跑 `bun run dist:win` 出 EXE 后首次发消息）。

**症状**：Windows 安装包能装、应用能启动、onboarding 走完、Token 存入；首次发任何 LLM 消息立即报：

```
piServerPath not configured. Cannot spawn Pi subprocess.
```

跟事故 #1 在 macOS 的症状完全一致——但事故 #1 的修复**只覆盖了 macOS 链路**。

**根因**：[`apps/electron/scripts/build-dmg.sh:208`](../apps/electron/scripts/build-dmg.sh) 走 `bun run electron:build` 完整 chain，自动触发 `electron:build:subprocess` → `copy-subprocess-servers.ts`。**[`apps/electron/scripts/build-win.ps1`](../apps/electron/scripts/build-win.ps1) 没对齐**——它只手动调 `electron:build:preload` / esbuild main / vite build / `copy-assets.ts` / `electron-builder`，**漏掉 subprocess server 这一步**。结果 Windows EXE 跟事故 #1 一样空 `resources/pi-agent-server/`、runtime resolveServerPath() 返回 undefined。

**为什么 v9/v10 review 没发现**：3 + 4 = 7 路 review agent 都跑的静态扫——没有一个 agent 跑过 dist:win 实测。`scripts/copy-subprocess-servers.ts` 顶部 U-API 注释（"upstream's `electron:build` chain never invokes copyPiAgentServer"）里"electron:build"指 root npm script chain，没人注意到 `build-win.ps1` 是**绕过 root chain 的独立 PowerShell 脚本**。

**修复**：[`apps/electron/scripts/build-win.ps1`](../apps/electron/scripts/build-win.ps1) 在 "Build preload" 块前加一段调 `bun run electron:build:subprocess`，与 `build-dmg.sh:208` 行为对齐。加 `// U-API:` marker（详见 §2.3）。

**修复验证**：commit `8cc943e6`（2026-05-05）。用户在 Windows 机器跑新 zip + `bun run dist:win` 出 EXE，首次发 LLM 消息**不再报 piServerPath**（2026-05-06 实测 ✅）。

### 0.4 事故 #4 — Windows EXE 缺 WhatsApp worker（事故 #3 的同根延伸，2026-05-06 修）

**事故时间**：v0.9.1 sync 后 Windows EXE 实测装包成功 + 首条 LLM 消息回复正常（commit `9df0433a` 后），但 build 输出含 warning：
```
• file source doesn't exist  from=D:\David\0-9-1\packages\messaging-whatsapp-worker\dist\worker.cjs
```

**症状**：electron-builder warning（非 error），EXE 还是出包。**核心 LLM 功能不受影响**，但用户用 WhatsApp 集成时 worker 缺失会失败。

**根因**：[`scripts/electron-build-main.ts:335`](../scripts/electron-build-main.ts) `await buildWhatsAppWorker()` 是 main bundle build 流水线的一步（顺序：sessionServer → piAgentServer → interceptor → **whatsAppWorker** → main process）。

- macOS [`build-dmg.sh:208`](../apps/electron/scripts/build-dmg.sh) 跑 `bun run electron:build` → 调 `electron-build-main.ts` → 触发 `buildWhatsAppWorker()` ✓
- Linux [`build-linux.sh`](../apps/electron/scripts/build-linux.sh) 同理 ✓
- **Windows [`build-win.ps1`](../apps/electron/scripts/build-win.ps1)** 用内联 `npx esbuild` 跑 main bundle（绕过 root chain 历史决定），**不调 `electron-build-main.ts`**——`buildWhatsAppWorker` 没机会跑

**与事故 #3 的关系**：事故 #3 fix 加了 `bun run electron:build:subprocess`（covers session-mcp-server + pi-agent-server），但这只是 root chain 中三个 sub-step 之一。**main bundle 内联的 helper（buildWhatsAppWorker）需要单独补**——事故 #3 的 fix 只是治标，事故 #4 暴露了 build-win.ps1 与 root chain 的整体差距。

**修复**：[`build-win.ps1`](../apps/electron/scripts/build-win.ps1) 在事故 #3 fix（`Build subprocess servers` 块）后加一段调 `bun run build:wa-worker`（root package.json:60 已定义此 script）。加 `# U-API:` marker 标记改造点。

**修复验证**：commit `3ee6e4dd`（2026-05-06，Windows 实测 verify commit `8fea0c00`）。Windows dist:win 输出含 `Building WhatsApp worker (Baileys subprocess)...` + EXE 大小从 220.8 MB → 221.4 MB（含 Baileys bundle），无 `worker.cjs file source doesn't exist` warning。

**共性教训补充**（与事故 #3 联动）：
- **build-win.ps1 与 root chain 之间存在结构性差距**——只要 macOS / Linux 走 `bun run electron:build`、Windows 走内联 esbuild，每次 root chain 加新 helper 都可能漏掉一个。M3 路线图应考虑把 build-win.ps1 也改成调 `bun run electron:build`（事故 #3 fix 的反方向终极方案）
- v15 C 路 agent 提到的"common.ts 8 dead helper"中 `buildWhatsAppWorker` 不算 dead——它在 `electron-build-main.ts:261` 被本地重新定义并使用——**但 Windows 路径漏调它**就是 dead helper 的真实表现

### 0.4b 已知非阻塞 warning（事故 #4 后剩余的 vendor binary 缺失，2026-05-06 记录）

事故 #4 fix 后 Windows dist:win 实测仍含 3 条 `file source doesn't exist` warning（**electron-builder warning 而非 error，EXE 仍出包，核心 LLM 功能不受影响**）：

| Warning 文件 | 用途 | 用户感知 |
|---|---|---|
| `apps/electron/vendor/codex/win32-x64` | OpenAI Codex CLI（agent 工具调用 codex 命令时用）| 不用 codex 完全无感 |
| `apps/electron/vendor/copilot/win32-x64` | GitHub Copilot CLI 集成 | 不用 copilot 完全无感 |
| `apps/electron/resources/bin/win32-x64` | 部分 shell wrapper 二进制（高级工具调用）| 大多数用户用不到 |

**根因**：跟事故 #2（vendor/bun 缺失，已修）同模式——electron-builder.yml 把这些 platform-specific binary 列在 `extraResources`，但需要 build 时下载到 `vendor/<name>/<platform-arch>/`，**build-win.ps1 没触发对应下载流程**。

**为什么不算事故 #5**：
- 事故 #4 = main bundle 内联 helper 漏跑（直接影响核心 LLM 链路）
- 这三个 = vendor binary 下载链路缺失（仅影响可选 feature）
- 严格定义不同，但**根因都是 build-win.ps1 与 root chain 结构性差距**（C14 已记录，M3 终极方案统一处理）

**当前决策**：**不阻塞 v0.9.1 R2 分发**。
- 三个 binary 都是可选 feature，绝大多数用户用不上
- 修复需要研究每个 vendor 的下载脚本（参考 build-dmg.sh 对 vendor/bun 的处理），时间不确定
- M3 路线图把 build-win.ps1 改调 `bun run electron:build` 时一并解决

**下次同步前核对手段**：
```bash
# Windows dist:win 后 grep build 输出
# 如果 warning 数量从 3 增加（新增 vendor binary）= build-win.ps1 又落后了
grep -c "file source doesn't exist" <build_log>
# 期望 ≤ 3（v0.9.1 后基线）
```

如果未来某个 warning 升级为真正影响核心功能（用户报错），按事故 #2 模式（commit `8359988`）修：在 build-win.ps1 加对应 vendor 下载段 + `# U-API:` marker 进 §3.7 Build 脚本子表（B4+）。

### 0.5 事故 #5 — Windows EXE 缺 dist/interceptor.cjs（事故 #3/#4 同根第 3 个，2026-05-06 修）

**事故时间**：v16 review B 路 agent 静态分析发现，commit `c0fe89cc` 修。

**症状**：v0.9.1 sync + 事故 #4 fix 后，Windows EXE 装包 + 首条 LLM 消息回复正常，但 **packaged Windows 应用的 Pi subprocess interceptor 永久不工作**——因为 EXE 包内不含 `apps/electron/dist/interceptor.cjs`。功能受损：流量监控失效 / MCP schema 注入失效 / tool intent capture 失效。多 MCP 场景必撞。

**为什么用户没察觉**：interceptor 不阻塞"首条 LLM 消息"主路径（pi-agent-server 能 spawn + LLM 请求-响应正常），所以 Windows 装包 + 发消息 happy path 测试不能 catch。这是 v15 C 路 agent 警示的"common.ts 8 dead helper"中 buildInterceptor 项的精确兑现。

**根因**：[`scripts/electron-build-main.ts:332 buildInterceptor()`](../scripts/electron-build-main.ts) 是 main bundle 流水线的第 3 步（顺序：sessionServer → piAgentServer → **interceptor** → whatsAppWorker → main process）。

- macOS [`build-dmg.sh`](../apps/electron/scripts/build-dmg.sh) 跑 `bun run electron:build` → 调 `electron-build-main.ts` → 触发 buildInterceptor → 产 `apps/electron/dist/interceptor.cjs` ✓
- Linux [`build-linux.sh`](../apps/electron/scripts/build-linux.sh) 同理 ✓
- **Windows [`build-win.ps1`](../apps/electron/scripts/build-win.ps1) §6** 只 `Copy-Item` `unified-network-interceptor.ts`（**`.ts` 源**）到 `apps/electron/packages/shared/src/`（这是 dev 模式 `--preload` 用），**没产 `dist/interceptor.cjs` bundle**——packaged 模式失效

[`runtime-resolver.ts:168-169`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) 运行时找：
```typescript
return resolveUpwards(hostRuntime.appRootPath, join('dist', 'interceptor.cjs'))
  ?? resolveUpwards(hostRuntime.appRootPath, join('apps', 'electron', 'dist', 'interceptor.cjs'));
```
Windows EXE 包内必然 `undefined`，Pi subprocess 静默 fallback。

**与事故 #3/#4 的关系**：
- 事故 #3 fix（commit `8cc943e6`）补了 main bundle 5 步流水线的 step 1+2（subprocess servers）
- 事故 #4 fix（commit `3ee6e4dd`）补了 step 4（WhatsApp worker）
- **事故 #5 = step 3**（interceptor）—— 同根模式第 3 个胞胎。三起事故共同根因 = `build-win.ps1 与 root chain 结构性差距`（C14）

**修复**：[`build-win.ps1`](../apps/electron/scripts/build-win.ps1) 在事故 #4 fix（"Build WhatsApp worker"块）后加一段调 `bun run build:interceptor`（`apps/electron/package.json:22` 已定义此 script，cwd = `$ElectronDir`，产 `dist/interceptor.cjs`）。加 `# U-API:` marker（B4）。

**修复验证**：commit `c0fe89cc`（2026-05-06）。Windows 实测 verify 通过（2026-05-07，commit `eba259be` 后用户跑 dist:win，EXE 大小 220.8 MB → **221.41 MB**（+0.6 MB = interceptor.cjs 进了 bundle），装包 + 会话回复正常）。

**5 步流水线修复完整状态（事故 #3 + #4 + #5 后）**：

| 流水线步骤 | macOS/Linux | Windows | 修法 |
|---|---|---|---|
| 1. buildSessionServer | electron:build | electron:build:subprocess | 事故 #3 fix |
| 2. buildPiAgentServer | electron:build | electron:build:subprocess | 事故 #3 fix |
| 3. buildInterceptor | electron:build | **build:interceptor** | **事故 #5 fix（本次）** |
| 4. buildWhatsAppWorker | electron:build | build:wa-worker | 事故 #4 fix |
| 5. main process esbuild | electron:build | inline npx esbuild | 历史决定 |

**步骤 1+2+3+4 全闭环 = 事故 #3/#4/#5 修后 Windows 路径与 root chain 在 main bundle 流水线达成等价**。M3 终极方案（C14）= 把 step 5 也改成调 root chain，可考虑跳过本节单独 helper 修复，但风险大（main process 的 OAuth env var inject 逻辑 Windows 路径有特殊处理）。

> ⚠️ **v0.10.0 修正（事故 #6）**：上表"macOS/Linux 走 electron:build ✓"对 **step 1+2（subprocess servers）已失效**——`electron:build` chain 末尾的 `&& bun run electron:build:subprocess` sub-step 在某次 sync 后被删除（事故 #1 fix commit `8ebe8c0` 时存在，现已无；`electron:build:subprocess` script 本身也不存在，`grep -c` = 0）。三平台 build 脚本现都应**显式调** `copy-subprocess-servers.ts`，不再依赖 chain 自动触发。详见 §0.6 事故 #6。

### 0.6 事故 #6 — macOS DMG 缺 copy-subprocess-servers（root chain 回归 = 事故 #1 的 macOS 重现，v0.10.0 修）

**事故时间**：v0.10.0 sync 后用户首次在 macOS arm64 DMG 实测（发首条 LLM 消息）。

**症状**：与事故 #1 完全一致——`piServerPath not configured. Cannot spawn Pi subprocess.`。但这次是 **macOS**（事故 #1 的 fix 本应永久覆盖 macOS）。

**根因（root chain 回归 + REVIEW-7 误判 + 漏修 mac，三重）**：
1. **root chain 退化**：事故 #1 fix（commit `8ebe8c0`）当时把 `&& bun run electron:build:subprocess` 加进 root `electron:build` chain，build-dmg.sh 的 `bun run electron:build` 借此自动 copy subprocess。但**某次 sync 后 `electron:build:subprocess` sub-step 从 chain 被删**（git 自动合并 / 上游重构吞掉），且该 script 本身也消失（现 `grep -c "electron:build:subprocess" package.json` = 0）。build-dmg.sh 仍依赖它自动触发 → macOS 静默缺 pi-agent-server。
2. **REVIEW-7 误判**：v0.9.5 sync 时 REVIEW-7 发现 build-win.ps1 引用的 `electron:build:subprocess` "不存在"，**误判为笔误**（实为 root chain 回归），改 build-win.ps1 用 `server:build:subprocess` + `copy-subprocess-servers.ts`——**修了 Windows**。
3. **漏修 macOS + 没察觉 root chain 回归**：REVIEW-7 没意识到 build-dmg.sh 同样依赖已失效的 chain 自动触发，**没同步修 build-dmg.sh**，也没恢复 / 警示 root chain 退化。文档（本节 §0.3 line 58 + 07 C14）至今仍写"build-dmg.sh 自动触发 ✓"。

**为什么长期没发现**：macOS 实测不充分（M2.5 #4 macOS x64 实测 deferred；v0.9.x 的 macOS"实测通过"未真发 Pi 对话）。build-dmg.sh 在 chain 退化之后**从未真正 copy 过 subprocess**，但 happy-path 启动测试 catch 不到——必须真发一条消息触发 pi spawn。

**与事故 #1/#3 的关系**：事故 #1 = macOS 首次缺 pi；事故 #3 = Windows 翻版；**事故 #6 = macOS 回归**（root chain 退化让事故 #1 的 fix 在 macOS 静默失效）。三者同症状（piServerPath）、同根因家族（subprocess server 没进包），触发机制不同。

**修复**：build-dmg.sh 在 `bun run electron:build` 后显式加 `bun run scripts/copy-subprocess-servers.ts`（与 build-win.ps1 §2.3 对称，不再依赖已失效的 root chain 自动触发）。`electron-build-main.ts` 已 build pi/session 到 `packages/*/dist`，此处只需 copy 到 `resources/`（故 build-dmg.sh 无需像 build-win.ps1 那样先 `server:build:subprocess`）。加 `# U-API:` marker（§3.7 Build 子表 B8）。

**修复验证**：v0.10.0 重新打包后 `find "U Agents.app" -path "*pi-agent-server*"` 命中 `resources/pi-agent-server/index.js` + 用户实测发消息**不再报 piServerPath**（2026-05-29 ✅）。详见 [`sync-reports/SYNC-v0.10.0-20260529.md`](sync-reports/SYNC-v0.10.0-20260529.md) §8.1。

**教训（升级 C14）**：C14 原表述是"build-win.ps1 落后 root chain"。事故 #6 揭示**反向**——**root chain 自身会被 sync 破坏**（subprocess sub-step 被删），依赖它的 build-dmg.sh 静默失效。今后：(a) 三平台 build 脚本都**显式调** `copy-subprocess-servers.ts`（不依赖 chain 自动触发）；(b) sync 后必须 grep 核对 `electron:build` chain 完整性 + 三脚本是否都显式调 subprocess copy；(c) **所有平台打包后必须真测一条 Pi 对话**（不只启动）。

### 0.7 共性教训

**为什么 typecheck / lint / validate:dev 没发现**：所有发版前自动化检查都是**纯静态**——TypeScript 编译、字符串 grep、shared 包单元测试。没有任何一项会启动一个 packaged 应用、点开会话、发出第一条消息。这是 [`05-build-release.md`](05-build-release.md) §1 检查清单的盲点（详见 §3 修订建议）。

**为什么 U Agents 受这两条 bug 的伤害远大于上游**：U Agents 锁定 `https://token.u-studio.cn/v1` + `providerType: 'pi_compat'`（详见 [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md) §3），**LLM 主链路必须经过 pi-agent-server 子进程**。pi-agent-server 缺失 = 应用看上去全好但发任何消息都报错。上游 craft-agents 默认主链路是 Claude SDK 的 `claude` 二进制（不依赖 pi-agent-server / vendor bun），所以同样的构建脚本缺陷在上游"看起来是好的"——但对我们是发版级阻塞。

**事故 #1 fix 后才暴露事故 #2 的原因**：事故 #1 阶段 pi-agent-server 文件本身缺失，[`pi-agent.ts:340`](../packages/shared/src/agent/pi-agent.ts) 在 spawn 之前就 throw，根本没机会触发 `spawn(nodePath, ...)` 的路径。修完事故 #1 才进入 spawn 路径，事故 #2 才显现。下次发版必须**人工跑完整 onboarding + 发首条消息**才能放行（详见 §3 验收 C）。

---

## 1. 子进程依赖完整地图

### 1.1 运行时依赖清单（含 vendor 二进制）

| 依赖 | 源码/下载源 | 构建产物 | 运行时查找路径（packaged） | 谁负责放到 electron 目录 | 缺失影响 |
|---|---|---|---|---|---|
| **pi-agent-server** | `packages/pi-agent-server/src/` | `packages/pi-agent-server/dist/index.js` | `<appRootPath>/resources/pi-agent-server/index.js` | [`scripts/build/common.ts:520 copyPiAgentServer()`](../scripts/build/common.ts) — **接线见 §2.1** | **🔴 P0：所有 U-API LLM 请求 throw** `piServerPath not configured`（事故 #1） |
| **vendor/bun** | github.com `oven-sh/bun` releases ~50 MB | `apps/electron/vendor/bun/bun` (arm64/x64 Mach-O / win32 .exe) | `<appRootPath>/vendor/bun/bun` ([`runtime-resolver.ts:69`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts)) | [`scripts/build/common.ts:106 downloadBun()`](../scripts/build/common.ts) — **接线见 §2.1** | **🔴 P0：pi-agent.ts spawn 落到 process.execPath = U Agents 主二进制 → Dock 闪现 + 子进程加载 ESM bundle 失败**（事故 #2） |
| **session-mcp-server** | `packages/session-mcp-server/src/` | `packages/session-mcp-server/dist/index.js` | `<appRootPath>/resources/session-mcp-server/index.js` | [`scripts/copy-subprocess-servers.ts`](../scripts/copy-subprocess-servers.ts)（事故 #1 修复时一并接线）| 🟡 P1：会话级 MCP 工具不可用 |
| **bridge-mcp-server** | `packages/bridge-mcp-server/` | `apps/electron/resources/bridge-mcp-server/index.js` | `<appRootPath>/resources/bridge-mcp-server/index.js` | 上游已直接提交在 `apps/electron/resources/`（无 build 步骤） | 🟡 P1 |
| **interceptor.cjs** | `packages/shared/src/unified-network-interceptor.ts` | `apps/electron/dist/interceptor.cjs` | `<appRootPath>/dist/interceptor.cjs` 或 `<appRootPath>/apps/electron/dist/interceptor.cjs` | [`scripts/electron-build-main.ts`](../scripts/electron-build-main.ts) `INTERCEPTOR_OUTPUT` | 🟡 P1：Pi 子进程的网络拦截失效，但子进程本身能起 |
| **vendor/codex** | npm `@codex-data/codex-cli` 等 | `apps/electron/vendor/codex/<platform-arch>/codex` | `<appRootPath>/vendor/codex/...` | 上游 build-dmg.sh / build-linux.sh / build-win.ps1（OSS 工作区不用这些脚本，**未接线**） | 🟢 P2：Codex source 不可用，U-API 主链路不受影响 |
| **vendor/copilot** | npm `@github/copilot-<platform>-<arch>` | `apps/electron/vendor/copilot/<platform-arch>/copilot` | `<appRootPath>/vendor/copilot/...` ([`runtime-resolver.ts:182`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts)) | 同上（**未接线**） | 🟢 P2：GitHub Copilot source 不可用，U-API 主链路不受影响 |
| **resources/bin/uv** | github.com `astral-sh/uv` releases | `apps/electron/resources/bin/<platform-arch>/uv` | `<appRootPath>/resources/bin/<platform-arch>/uv` | [`scripts/build/common.ts:197 downloadUv()`](../scripts/build/common.ts)（**未接线**） | 🟢 P2：python-based document tools (markitdown / pdf-tool 等) 不可用，U-API LLM 不受影响 |

### 1.2 koffi 原生依赖（pi-agent-server 专属）

`pi-agent-server` 通过 `koffi` 包加载平台相关原生 `.dylib` / `.dll` / `.so` 调 Pi SDK。`copyPiAgentServer()` 在复制 `index.js` 后还会复制 `node_modules/koffi/` 的最小子集（仅当前平台 + 架构的原生二进制，约 4MB），见 [`common.ts:537-570`](../scripts/build/common.ts)。**漏复制 koffi 会得到不同的报错** —— `Cannot find module 'koffi'`。修复时不要只复制 index.js。

### 1.3 当前 electron:build 调用链（**有缺陷**）

```
package.json electron:build
├── electron:build:main          (scripts/electron-build-main.ts)         ← esbuild main.cjs
├── electron:build:preload       (scripts/electron-build-preload.ts)
├── electron:build:renderer      (scripts/electron-build-renderer.ts)     ← vite renderer
├── electron:build:resources     (scripts/electron-build-resources.ts)    ← cp resources/ → dist/resources/
└── electron:build:assets        (apps/electron/scripts/copy-assets.ts)   ← 同上 + powershell-parser.ps1
```

**没有任何一步**：
- 跑 `cd packages/pi-agent-server && bun run build`
- 跑 `cd packages/session-mcp-server && bun run build`
- 调用 `copyPiAgentServer()` 或 `buildMcpServers()`

`scripts/build/common.ts` 里的 `copyPiAgentServer` 和 `buildMcpServers` 仅被以下两个流程使用，**和 electron 打包链路不交叉**：
- [`scripts/build-server.ts:856`](../scripts/build-server.ts) — headless 服务器打包（M2+ 才用）
- [`scripts/electron-dev.ts:423`](../scripts/electron-dev.ts) — 本地 dev 运行（非打包）

`package.json` 里有现成脚本 [`server:build:subprocess`](../package.json) (line 87)：
```json
"server:build:subprocess": "cd packages/session-mcp-server && bun run build && cd ../pi-agent-server && bun run build"
```
但同样**没接到 `electron:build` 上**。

---

## 2. 修复方案（已实施）

> 实施状态：M1 v0.9.0 hotfix 已两次落地（commit `8ebe8c0` + `8359988`）。本节描述当前实际形态。

### 2.1 现行实现（事故 #1 + 事故 #2 合并修复）

**`package.json`** 接线（commit `8ebe8c0` 引入）：

```json
{
  "scripts": {
    "electron:build:subprocess": "bun run server:build:subprocess && bun scripts/copy-subprocess-servers.ts",
    "electron:build": "bun run electron:build:main && bun run electron:build:preload && bun run electron:build:renderer && bun run electron:build:resources && bun run electron:build:assets && bun run electron:build:subprocess"
  }
}
```

**`scripts/copy-subprocess-servers.ts`**（commit `8ebe8c0` 创建，commit `8359988` 扩展）。当前职责：

1. 调 `copyPiAgentServer(buildConfig)` —— 复制 `pi-agent-server/index.js` + koffi 最小子集（host arch 原生库，约 4 MB）→ `apps/electron/resources/pi-agent-server/`
2. 复制 `packages/session-mcp-server/dist/index.js` → `apps/electron/resources/session-mcp-server/index.js`
3. 调 `downloadBun(buildConfig)` —— 下载 bun-v1.3.9 (~50 MB) → `apps/electron/vendor/bun/bun`（host arch only；已存在则 cache 短路跳过下载）
4. 重新 `cpSync apps/electron/resources/ → apps/electron/dist/resources/`，让前面已经跑过的 `electron-build-resources` 输出与新加的 subprocess 文件同步

整文件用 `/* U-API START */ ... /* U-API END */` 包围（CLAUDE.md §3.7），含跨 arch 限制说明（详见 §6）。

### 2.2 备选（更激进，不推荐 M1）

把 `copyPiAgentServer` / `downloadBun` 调用塞进 `scripts/electron-build-resources.ts` 或 `scripts/electron-build-main.ts`。**为什么不推荐**：上游每月同步这些脚本时会被 git 自动合并冲突，破坏 U-API 改造点。新建独立脚本 + `package.json` 一行 script 钩子，是同步阻力最小的形态。

### 2.3 `// U-API:` 标记记账（CLAUDE.md §3.7）

| 文件 | 标记类型 | 引入 commit |
|---|---|---|
| `scripts/copy-subprocess-servers.ts` 整文件头 | `/* U-API START */ ... /* U-API END */` | `8ebe8c0`（创建）+ `8359988`（扩展） |
| `package.json` `electron:build:subprocess` 与 `electron:build` 末尾 | JSON 不能加注释——标记在本文档 §2.1 + commit message + 同步上游守则 §5 第 1 条 | `8ebe8c0` |
| `apps/electron/scripts/build-win.ps1` "Build subprocess servers" 块 | `# U-API:` 单行（事故 #3 修复） | `8cc943e6`（Windows 实测 verify 2026-05-06） |
| `apps/electron/scripts/build-win.ps1` "Build WhatsApp worker" 块 | `# U-API:` 单行（事故 #4 修复，事故 #3 同根延伸） | `3ee6e4dd`（2026-05-06，v0.9.1 sync 后 Windows 实测 verify `8fea0c00` 触发）|
| `apps/electron/scripts/build-win.ps1` "Build network interceptor bundle" 块 | `# U-API:` 单行（事故 #5 修复，事故 #3/#4 同根第 3 个） | `c0fe89cc`（2026-05-06，v16 review B 路静态分析发现）|

---

## 3. 发版前必跑验收（**对应 [`05-build-release.md`](05-build-release.md) §1 第 6 项**）

```bash
# 验收 A：打包前确认运行时依赖已就位（事故 #1 + #2 联合）
ls apps/electron/resources/pi-agent-server/index.js                       # 必须存在 — 事故 #1
ls apps/electron/resources/pi-agent-server/node_modules/koffi/build/koffi/darwin_arm64/koffi.node  # 必须存在（macOS arm64） — 事故 #1
ls apps/electron/resources/session-mcp-server/index.js                    # 必须存在
ls apps/electron/resources/bridge-mcp-server/index.js                     # 必须存在
ls apps/electron/vendor/bun/bun                                            # 必须存在 — 事故 #2
file apps/electron/vendor/bun/bun                                          # 必须输出 "Mach-O 64-bit executable arm64"（macOS arm64 host）— 事故 #2
```

```bash
# 验收 B：DMG 内部确认（packaged path 多一层 app/，由 electron-builder + asar=false 决定，已在 §6 TODO 第 3 项验证）
hdiutil attach apps/electron/release/U-Agents-arm64.dmg -readonly -nobrowse -mountpoint /tmp/uagents-check
ls "/tmp/uagents-check/U Agents.app/Contents/Resources/app/resources/pi-agent-server/index.js"
ls "/tmp/uagents-check/U Agents.app/Contents/Resources/app/resources/pi-agent-server/node_modules/koffi/build/koffi/darwin_arm64/koffi.node"
ls "/tmp/uagents-check/U Agents.app/Contents/Resources/app/resources/session-mcp-server/index.js"
ls "/tmp/uagents-check/U Agents.app/Contents/Resources/app/resources/bridge-mcp-server/index.js"
ls "/tmp/uagents-check/U Agents.app/Contents/Resources/app/vendor/bun/bun"   # 事故 #2 关键路径
file "/tmp/uagents-check/U Agents.app/Contents/Resources/app/vendor/bun/bun"  # 必须输出 arm64
hdiutil detach /tmp/uagents-check

# 任一为空都不能发版
```

```bash
# 验收 C（运行时烟雾测试 — 事故 #2 后必须的人工步骤）：装 DMG → onboarding → 发首条消息
# 这步必须人工做，无法自动化。详见 [09-test-checklist.md](09-test-checklist.md) §3.5.1
# 验收成功标准（两条都要满足，缺一条即未通过）：
#   1. onboarding 输入 Token 那一屏点 Continue 不出现"第二个 U Agents 图标在 Dock 跳几下"现象（事故 #2 直接症状）
#   2. 走完 onboarding 发出第一条 LLM 消息能拿到回复，无 piServerPath / spawn 报错（事故 #1 直接症状）
# 完成后必须在 .planning/release-notes/v1.x.y.md "测试" 节明确记录"已验证 LLM 主链路畅通"
```

---

## 4. 错误信息升级建议（M2 可做，M1 非阻塞）

[`pi-agent.ts:340`](../packages/shared/src/agent/pi-agent.ts) 当前 throw 是技术 stack：
```
piServerPath not configured. Cannot spawn Pi subprocess.
```

非技术用户看不懂，且不指引修复。建议改造为：

```typescript
/* U-API START: 12 §4 — actionable error message for end users */
throw new Error(
  '应用打包不完整：缺少 pi-agent-server 子进程文件。' +
  '这是 U Agents 打包脚本的已知缺陷（详见 .planning/12-subprocess-build-pipeline.md）。' +
  '请联系 support@u-studio.cn 报告版本号 ' + appVersion
);
/* U-API END */
```

但**必须先做 §2 的真正修复**——否则只是把"看不懂的错"换成"看得懂的同样的错"。

---

## 5. 上游同步守则

每次同步上游 (`07-upstream-sync.md`) 必读以下条目：

1. **检查 [`package.json`](../package.json) `electron:build` 是否仍含 `electron:build:subprocess`**——上游修改 build 链路时容易把这一步合掉。这是事故 #1 + #2 的统一接线点。
2. **检查 [`scripts/build/common.ts`](../scripts/build/common.ts) `copyPiAgentServer` / `buildMcpServers` / `downloadBun` 函数签名**——上游若改了 `BuildConfig` 类型字段名（`platform` / `arch` / `electronDir` / `rootDir` / `upload` / `uploadLatest` / `uploadScript`），[`scripts/copy-subprocess-servers.ts`](../scripts/copy-subprocess-servers.ts) 显式构造 `BuildConfig` 的字段会断，typecheck 应能抓住。
3. **检查 [`runtime-resolver.ts:64-83`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) `resolveBundledRuntimePath`**——上游若改了 bun 查找路径（如改成 `vendor/bun/<platform-arch>/bun`），需同步改 `scripts/copy-subprocess-servers.ts` 的 `bunPath` 计算 + §3 验收 A/B 的 `ls` 路径。这一处一旦走形会重新触发事故 #2。
4. **检查 [`runtime-resolver.ts:192-203`](../packages/shared/src/agent/backend/internal/runtime-resolver.ts) `resolveServerPath` 查找路径**——上游若改了打包态的查找路径（比如改成 `Contents/Resources/app.asar.unpacked/...`），需同步更新 §3 验收 B 的 hdiutil 路径。
5. **检查 [`pi-agent.ts:343, 397`](../packages/shared/src/agent/pi-agent.ts) `nodePath = runtime.paths?.node || process.execPath` fallback 是否仍存在**——这条 fallback 是事故 #2 的"症状放大器"。如果上游把 fallback 改成 throw（更安全），可考虑跟进；如果保留则继续依赖 vendor/bun 接线。
6. **跑 §3 三项验收**（A/B/C），任一失败必须解决再 merge。**特别是 C 必须人工跑**——事故 #2 是事故 #1 的"二阶症状"，纯静态检查抓不到。

---

## 6. TODO

- [ ] 审计 `apps/electron/resources/session-mcp-server/index.js` 当前的存在路径——是上游手动提交的（git tracked）还是某个被遗忘的 build 脚本产物？如果是 git tracked，则上游同步时它会被 upstream 的版本覆盖。
- [ ] 审计 `bridge-mcp-server` 是否真的不需要单独 build —— 看其 `package.json` 是否有 `build` 脚本。
- [x] ~~验证 §3 验收 B 的 DMG 内部路径在 Apple Silicon vs Intel DMG 上是否一致~~ — 2026-05-04 验证：
      实际路径是 `Contents/Resources/app/resources/...`（多一层 `app/`），由 `electron-builder.yml` `asar: false` + `extraMetadata.main: dist/main.cjs` + `files: dist/**/*` 决定。
      §3 验收 B 已修正。`U Agents.app` 含空格，hdiutil 命令必须双引号包裹路径。
- [ ] **跨 arch bun runtime（M2 阻塞）**：当前 `scripts/copy-subprocess-servers.ts` 调 `downloadBun()` 只能下 host arch，单一 `apps/electron/vendor/bun/bun` 路径。
      arm64 build host 同时打 arm64+x64 时，**x64 DMG 装 Intel Mac 上仍会 Dock 闪退**（事故 #2 现象在 x64 端复现）。
      M2 修复方案：把 `electron:dist:adhoc:mac` 拆成两段，每次只 build 一个 arch 并在 build 前重新 `downloadBun({ arch })`，或者把 vendor/bun 改成 arch-namespaced 路径并同步改 `runtime-resolver.ts:69`（后者侵入 runtime-resolver 代码，对上游同步不友好，**不推荐**）。
- [ ] **vendor/codex / vendor/copilot 接线**（M2）：见 §1.1 表格，当前未接线。Codex / GitHub Copilot source 在 packaged 应用里不可用。U-API 主链路不受影响，但若 M2 想恢复这些 source 必须补 download 步骤。
- [ ] **resources/bin/uv 接线**（M2）：[`scripts/build/common.ts:197 downloadUv()`](../scripts/build/common.ts) 同样定义但未接线。Python-based document tools (markitdown / pdf-tool 等) 在 packaged 应用里不可用——影响 doc tools，不影响 LLM 对话。

---

## 7. 关联文档

- [`05-build-release.md`](05-build-release.md) §1 发版前检查清单（验收 A/B 已加引用）
- [`05-build-release.md`](05-build-release.md) §3.1 清理 + 构建（已加"`electron:build` 必须含 `electron:build:subprocess`"提示）
- [`09-test-checklist.md`](09-test-checklist.md) §3.5.1 onboarding 后端 setup 流程验证（首条 LLM 消息 = 验收 C）
- [`07-upstream-sync.md`](07-upstream-sync.md) 月度同步流程（本文 §5 同步守则）
- [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md) §3 LLM 主链路 = pi 子进程的依据
- `M1-READINESS.md` §阻塞项（已加 #B1）
- `CLAUDE.md` §3.7 U-API 改造点标记规范


## 2026-10-01 · v0.14.0 升级候选实施补充

接收上游移除旧 session MCP 运行时打包依赖的调整，保留 Pi subprocess 与本地付费工具注册/owner 隔离。干净构建不复用旧 dist。Electron 编译通过不等于 Windows 原生依赖、安装包签名或运行验收通过。

执行证据与剩余门禁见 [UPGRADE-EXECUTION-v0.14.0.md](UPGRADE-EXECUTION-v0.14.0.md)。本节记录候选分支，不代表 main 或已发布版本。
