# M2 安全主线收官报告（2026-05-05）

**日期**：2026-05-05（一日完成）
**起点**：REVIEW-5 §1 P1 + §🔵 M2 范围（5 项安全清单）
**终点**：M2 安全主线 4/4 = 100% 完成 + SOP grep 精度持续改进
**总评**：A — 用 1 天彻底收官 M2 安全主线

---

## 1. M2 安全主线全景

| # | 项 | 修复 commit | 文档 |
|---|---|---|---|
| 1 | ✅ TLS 校验严格化 | `c516e4d2` | [`M2-TLS-FIX-SPEC.md`](../M2-TLS-FIX-SPEC.md) |
| 2 | ✅ atomicWriteFileSync 用户数据持久化（11 处）| `25d38ab9` | [`M2-ATOMIC-WRITES-SPEC.md`](../M2-ATOMIC-WRITES-SPEC.md) |
| 3 | ✅ ~/.u-agents/ 目录权限 0o700 | `2972d8f4` | [`M2-SECURITY-CLEANUP-SPEC.md`](../M2-SECURITY-CLEANUP-SPEC.md) |
| 4 | ✅ LLM API key 长度限制 (1-4096) | `2972d8f4` | 同上 |

**M3 范围（不在本次）**：
- secure-storage.ts 解密失败改 backup-then-rebuild
- apps/electron 35 fail 测试修复评估

**本日后续完成（不在本盘点报告内）**：
- ✅ apps/cli rename u-agents-cli（commit `1a49d128`，详见 [`M2-CLI-RENAME-SPEC.md`](../M2-CLI-RENAME-SPEC.md)）

---

## 2. 完整提交链（一日 12 commits）

```
6be9a63b  docs(perf): perf baseline 5/6 measured
7d8b19af  docs(perf): M3 = 3s — perf baseline 6/6 ✅
bbb104eb  spec: M2 TLS fix
c516e4d2  fix(security): enforce strict TLS verification (REVIEW-5 P0)  [#1]
a3a1cb80  docs: TLS landed (6 doc updates)
cec04d5a  spec: M2 atomic writes
25d38ab9  fix(reliability): atomic writes for 11 user-data sites         [#2]
c8400875  docs: atomic landed (4 doc updates) + spec typo fix
07293811  spec: M2 security cleanup
2972d8f4  fix(security): dir 0o700 + LLM API key length bounds          [#3 + #4]
25cb1f5e  docs: M2 security cleanup landed (6 doc updates)
（本 commit）docs: M2 安全收官报告 + SOP Round 2 grep 精度改进
```

模式：spec → fix → doc-closure → next spec。每个 P 安全任务约 30-60 分钟。

---

## 3. 每项修复一句话总结

### 🔒 #1 TLS 校验严格化（commit `c516e4d2`）

**before**：`apps/electron/src/main/handlers/workspace.ts:27` + `apps/electron/src/preload/bootstrap.ts:124, 148` 三处显式 `tlsRejectUnauthorized: false`，让 remote workspace 连接接受任何（包括 self-signed）证书 → LAN MITM 风险

**after**：删除 3 处 override，让 `WsRpcClient` 默认严格 TLS（client.ts:160 `?? true`）接管 + 修复 client.ts:99 过时 JSDoc

### 💾 #2 atomicWriteFileSync 用户数据持久化（commit `25d38ab9`）

**before**：用户敏感配置（config.json / preferences / drafts / theme / window-state / topic-registry / conversation / plan）共 11 处用 `writeFileSync`，断电/进程崩溃会留 partial write 损坏文件

**after**：4 个文件 11 处替换为 `atomicWriteFileSync`（write-to-tmp + rename）— helper 已存在于 `packages/shared/src/utils/files.ts:36`

### 🔐 #3 ~/.u-agents/ 目录 0o700（commit `2972d8f4`）

**before**：3 处 `mkdirSync(CONFIG_DIR, { recursive: true })` 用 macOS 默认 `0o755`，多用户机器上其他 user 能读 sessions/ 下会话内容

**after**：3 处加 `mode: 0o700`（仅 owner rwx）。**既存用户已 0o755 不主动 chmod 避 surprise**；新装机用户首启自动 0o700

### 🛡️ #4 LLM API key 长度限制（commit `2972d8f4`）

**before**：`setLlmApiKey` 直接落盘，无校验。用户误粘贴大文本（一篇文章/整个文件）会全部加密入盘 + 后续启动加载到内存

**after**：加 `MIN_LLM_API_KEY_LENGTH = 1` + `MAX_LLM_API_KEY_LENGTH = 4096`（4 KB 远大于任何真 token）+ 友好错误（"Did you accidentally paste a file?"）

---

## 4. SOP 演练 Round 2（今日改进的 grep 精度验证）

第二次跑 §2.7b/c + §3.7 基线，验证今天的多处 SOP 改进是否真的让误报消除：

| 类别 | 改进点 | Round 1（5/4）| Round 2（5/5 实测）|
|---|---|---|---|
| §2.7b A3（跨文档引用）| 抽 `<doc>.md §X.Y` 显式模式 | 79% 误报 | **0 处误报** ✅ |
| §2.7b B1（品牌变体）| 抽长串 `u_agents(_xxx)?` + 排除合法 identifier 白名单 | 9 处误报 | **3 处** ✅ |
| §2.7b B2（域名规划）| 先按整行过滤再抽 URL | 4 处误报 | **0 违规** ✅ |
| §2.7b B5（typo 扫描）| `--exclude` SOP + 审计表 | 2 处误报 | **0 命中** ✅ |
| §2.7c C1-C9（代码踩坑）| Round 1 已 9/9 准确 | 0 误报 | **0 误报** ✅（v0.9.1 同步起 C 类升至 C1-C10，本快照仅记 M2 安全收尾时点的 9 类）|
| §3.7 基线对照 | 切 `--exclude-dir=node_modules` | - | **59 / 8 / 8** ✅ |

**B1 剩 3 处实际是合法保留**：07 SOP 自身 grep 命令字面量 + 11 任务清单描述里引用 code identifier 名（不是真违规）。可接受。

---

## 5. 当前基线（commit `25cb1f5e` 之后）

| 指标 | 值 | 来源 |
|---|---|---|
| U-API 标记总数 | **59** | CLAUDE.md §3.7 |
| START / END 配对 | **8 / 8** ✅ | 同上 |
| §3.7 表项数 | 30 | 含 30 个改造类别 + 反向覆盖 100% |
| packages/shared 测试 | **13 stable + 2 OAuth network-flaky** | M1-FIRST-RELEASE 已知技术债 |
| typecheck | 0 errors（8 包全过）| 每次 fix 都跑 |

---

## 6. M2 整体进度

| 任务 | 状态 |
|---|---|
| i18n 中文化 | ✅ |
| Windows 打包 | ✅（含 SDK dist:win 版） |
| macOS 含 SDK 重打 | ✅ 本地（待 R2） |
| **🔒 安全 4/4** | ✅ **100% 完成（本日）**|
| Linux AppImage | ⏸ |
| macOS Apple 公证 | ⏸（需 Apple Developer 账号 $99/年）|
| Web UI / Viewer 白标 | ⏸ |
| 用户协议 + ICP 备案 | ⏸ |
| apps/cli rename | ✅ 本日后续完成（commit `1a49d128`）|

---

## 7. 给未来 you 的提示

### M2 安全主线为何这么快收官

每项都是"小而独立"的 P 安全改进：
- 单个 spec 1 页（含 grep 命令 + 提示词）
- 外部 AI 30 分钟内执行
- 文档收尾批量 commit
- 验证用今天 SOP 的 grep（基线数字 + START/END 配对）

**关键：每次 fix 都在 SOP 里加 `// U-API:` marker** — 让下次同步上游时这些改造点能被 grep 识别。基线 48 → 59 反映了 4 项修复各加 ~3 个 marker。

### 还能做的"低成本高 ROI"任务

- **a Linux AppImage 打包** — M2 三平台对齐，1-2 小时
- **b macOS Apple 公证** — 需注册 Apple Developer + 半天审核 + 1 小时配置
- ~~**c apps/cli rename + CLI 改造**~~ — ✅ 本日后续完成（commit `1a49d128`，详见 [`M2-CLI-RENAME-SPEC.md`](../M2-CLI-RENAME-SPEC.md)）
- **d 写"M2 完成度盘点报告"** — 当所有 M2 任务接近完成时

### 不要做的事

- ❌ 提前做 M3（OAuth relay / 文档站 / Sentry）— 等 M2 完整收官
- ❌ 一次塞太多任务到 spec — M2 安全 4 项分了 3 个 spec 各 30 分钟，比塞一个大 spec 易执行

---

## 8. 闭环验证

跑 §2.7c C 类 9 个 anti-pattern + §3.7 基线 grep + bun typecheck，全部通过。本日新增 4 个 marker 全部 grep-able。**SOP 自我闭环**——下次同步上游若有人破坏这 4 项修复，§3.7 基线浮动会立即暴露。

**M2 安全主线收官，可以推进 Linux AppImage 或 macOS 公证了**。
