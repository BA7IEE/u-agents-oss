# SYNC-v0.10.4 — 上游同步终评报告（装机实测通过）

> 本报告在 merge + 装机实测后产出。预分析见 [`UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md`](UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md)。
> 合并日期 2026-06-27（merge commit `895210ee`）；装机实测 2026-06-28。
> **终评：A（顺利同步，端到端实测通过）。**

---

## 0. TL;DR

- 上游 `v0.10.4`（`556c59a7`，单 squash）合并完成，分支 `sync/upstream-20260627`，版本号统一 `0.10.4`。
- 主体 = **Pi SDK scope 迁移** `@mariozechner/*` → `@earendil-works/*`（0.73.1 → 0.79.9）+ config 启动备份（`backupConfigFile`）+ 会话标题跟随语言（`uiLanguage` 直读，修上游 #885）+ Copilot `onDeviceCode`。
- **20 个冲突全解**（预分析预测"极少"偏乐观）；§3.3 高冲突区 **0 命中**。
- 品牌补丁：`logger.ts` 两条日志路径 → `.u-agents` + `// U-API:` 标记；`0.10.4.md` release-notes 整篇中文化。
- §14 基线 **115 → 118**（#63/#64/#65）。
- **两个非平凡发现**（见 §4）：① bun.lock 重生成陷阱（@sentry 重复版本致 typecheck 断）② koffi 警告（确认无害）。
- 验证全绿：`typecheck:all` EXIT=0、118/10/10、`@mariozechner`/`@craft-agent`/`.craft-agent` 残留全 0、**arm64 adhoc DMG（272 MB）装机实测通过**。

---

## 1. 冲突与解决（20 个）

| 类别 | 文件数 | 解决方式 |
|---|---|---|
| `package.json`（cli/electron/viewer/webui/core/messaging-gateway/messaging-whatsapp-worker/pi-agent-server/server-core/server/session-mcp-server/session-tools-core/shared/ui） | 14 | 保我方 `@u-agents` 名 + 描述，取上游版本号 `0.10.4`（C11 模式：Pi SDK dep 行已自动合并，仅 name/version 冲突）|
| `auto-update.ts` / `index.ts` | 2 | 取上游新增 `autoUpdateLog` import，保 `@u-agents` scope |
| `SessionManager.ts` | 1 | 取上游新函数 `getPersistedUiLanguage`/`resolveTitleLanguageName` + 移除已不用的 `LOCALE_REGISTRY`/`LanguageCode`，保 `@u-agents`（移除后 0 处残留引用，typecheck 验证安全）|
| `storage.ts` | 1（2 hunk）| 保我方品牌 header + 取上游 `backupConfigFile()` 调用 + 把 docs 注释 `.craft-agent` → `.u-agents` |
| `storage-startup-migration.test.ts` | 1 | 取上游新增迁移测试 + **保住我方 U-API lockdown 测试块**（差点被 `git checkout --theirs` 误删）；helper 兼容两种调用约定（见 §3 #65）|
| `bun.lock` | 1 | 见 §4.1（不可手 merge，须以上游 lock 为基底重生成）|

`@mariozechner` 全清（= 0），`@craft-agent/` NPM scope = 0（C11 clean），C13 未触发。

---

## 2. 品牌补丁（§7 brand patch 清单执行情况）

1. ✅ 接受上游 Pi SDK scope 迁移（`@mariozechner/*` → `@earendil-works/*`）。
2. ✅ `logger.ts:autoUpdateLogPath`：`.craft-agent` → `.u-agents` + `// U-API:` 标记（§14 #63）。上游 v0.10.4 新增的 always-on auto-update 诊断日志，若不改会在用户机器留 `~/.craft-agent/` 旧目录（品牌泄漏 + 日志分裂）。
3. ✅ `logger.ts:messagingGatewayLogPath`：补 `// U-API:` 标记（§14 #64，既有 `.u-agents` 路径漏登记回补）。
4. ✅ 接受 storage `backupConfigFile()`、preferences `uiLanguage`、Copilot `onDeviceCode`。
5. ✅ `release-notes/0.10.4.md` 整篇中文化 + 品牌清洗 + issue 降裸号（#885/#891）+ 路径写 `~/.u-agents/`。
6. ✅ §14 基线刷新 115 → 118 + §3 加 #63/#64/#65 + §5 历史行。
7. ✅ 校验 grep 全过（见 §5）。

---

## 3. §14 基线影响

115 → **118**（净 +3）：

- **#63** `autoUpdateLogPath` 品牌统一 + marker（上游新增路径）。
- **#64** `messagingGatewayLogPath` 补登记（既有路径漏 marker 回补）。
- **#65** `writeRootConfig` 测试 helper 兼容上游新迁移测试的数组传参（merge 整合 / typecheck 修复）。我方既有 helper 取 `config` 对象并 spread，上游新测试按数组传 `llmConnections`；helper 加 `Array.isArray` 归一化，两种调用都通。

START/END 维持 **10/10**（新增均为单行 `//`）。

---

## 4. 两个踩坑（建议沉淀）

### 4.1 bun.lock 重生成陷阱（**建议立 C15**）

**现象**：对带冲突标记的 `bun.lock` 直接 `bun install`，bun 会忽略锁文件**从头解析**，拉到比 pin 更新的传递依赖。本次拉到 `@sentry/core@10.60.0 + 10.62.0`（**两份**，未去重），致 `apps/electron/src/main/main.tsx` typecheck 报 `@sentry/react/node_modules/@sentry/core` 与顶层 `@sentry/core` 类型不兼容。我方 v0.10.3 与上游 v0.10.4 lock **均 pin `@sentry/core@10.36.0` 单版本**。

**正解**：
```bash
git checkout upstream/main -- bun.lock   # 以上游 v0.10.4 lock 为基底（已知 deduped）
bun install                              # 仅调和我方 @u-agents 工作区名，保留 pin 版本
```
→ @sentry 回 10.36.0 deduped，工作区名全 `@u-agents`（`@craft-agent` = 0），typecheck 恢复 EXIT=0。

**教训**：涉及 SDK 大版本/scope 迁移的 sync，`bun.lock` 不要从冲突态从头 `bun install`，要**先取上游 lock 再 install**，否则传递依赖会悄悄漂移到更新的版本。

### 4.2 koffi 警告（**确认无害，不修**）

**现象**：打包时 `copy-subprocess-servers.ts` 报 `Warning: koffi not found in node_modules. Pi SDK sessions may not work.`

**排查**：
- v0.10.3：koffi 由 `@mariozechner/pi-tui` 的 `optionalDependencies` 拉入（koffi@2.15.1）。
- 上游 v0.10.4 **及**本次 merge：koffi 在锁文件计数 = **0**（新 `@earendil-works` Pi SDK 弃用 koffi，改用别的 FFI）。
- `--external koffi`（`pi-agent-server/package.json`）+ `koffi` trustedDependencies（root `package.json`）**上游 v0.10.4 也有**，且上游照常发版。

**结论**：新 Pi SDK 运行时不再 `require('koffi')`，警告只是构建脚本里未清的旧步骤在喊。**装机实测 Pi 对话正常**，坐实无害。`--external koffi` + trustedDependencies koffi + copy 脚本 koffi 步骤现为**上游也有的死配置**——清它只会增加与上游的分歧（更多 merge 冲突面），**不动**。

---

## 5. 验证

| 项 | 结果 |
|---|---|
| `bun run typecheck:all` | **EXIT=0，0 errors**（全 8 包：core/shared/server-core/server/session-tools-core/pi-agent-server/electron/ui）|
| U-API 标记总数 | **118**（基线对齐）|
| `/* U-API START */` / `END` | **10 / 10** 配对 |
| `@mariozechner` 残留 | **0** |
| `@craft-agent/` NPM scope | **0**（C11 clean）|
| `.craft-agent` 硬路径 | **0** |
| 残留冲突标记（全树排除 bun.lock 后再含 bun.lock） | **0** |
| **装机实测**（2026-06-28，arm64 adhoc DMG 272 MB，ad-hoc 签名）| ✅ **Pi 对话能回**（koffi 警告无害坐实）/ "获取 Token" → `token.u-studio.cn/keys` / 会话中文标题 / onboarding 仅 U-API 无 provider 泄漏 |

---

## 6. 同会话附带改动（非本次 sync）

用户在同一分支另提一个 commit：**U-API 控制台链接 `console/token` → `keys`**。
- 代码 2 处：`u-api-defaults.ts:U_API_CONSOLE_URL`、`provider-metadata.ts:'u-api'.dashboardUrl`。
- 文档 8 处：`01-branding-spec.md`、`02-llm-gateway-spec.md`（6）、`09-test-checklist.md`（同步测试步骤，避免误判）。
- 仅 `01-branding-spec.md:1566` 的 Round-49 历史审计快照保留旧值（不改写历史）。
- 不增 `// U-API:` 标记（仅改 URL 值），故 §14 基线仍 118。

---

## 7. 评级与剩余

**终评：A（顺利同步，装机实测通过）。**

剩余动作（用户执行）：
```bash
# 把 sync 分支合回 main
git checkout main
git merge sync/upstream-20260627
# 可选：推送 + 触发自建更新服务器发版（见 05/06 规格）
```

收尾提醒：破例开关若已 `launchctl unsetenv`，下次再改码需重新 `setenv` + 重启 app（见记忆 `u-agents-desktop-escape-hatch`）。
