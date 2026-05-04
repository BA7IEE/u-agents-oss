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

### 0.3 共性教训

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
