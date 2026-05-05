# SOP 演练 Round 4 — 17-commit 收尾后审计（2026-05-05 晚）

**目的**：今天 17 commits 全部落地后，验证 SOP 仍精准 + 找文档对齐漏洞
**结果**：发现 §3.7 表反向覆盖率从 100% 退化到 63% — **已修复**
**总评**：**A — Round 4 是今天大量 fix 后必跑的"自审"**

---

## 1. 真实发现：§3.7 表覆盖度退化

### 现象

每次 fix 都加了 `// U-API:` marker（基线 48 → 51 → 55 → 59 → 61），但 marker **没补进 §3.7 表**：

| 实际有 marker 的文件 | §3.7 表覆盖 |
|---|---|
| **27 个文件** | **17 个表项**（覆盖 17 文件）|

**未文档化的 10 个文件**：
- TLS 修复：workspace.ts + bootstrap.ts
- atomic writes：preferences.ts + topic-registry.ts + window-state.ts
- dir 0o700：watcher.ts（storage.ts + window-state.ts 复用 32a/32d）
- key bounds：credentials/manager.ts
- cli rename：apps/cli/src/index.ts
- 回归测试：state.test.ts
- 防护性禁用：ProviderSelectStep.tsx（#26 与 LocalModelStep 合写漏识别）

### 根因

新 fix → 加 marker → 但忘记同步 §3.7 表 / 或合写多文件让 grep 抽不到独立路径。

**这正是 §2.7c C7（反向覆盖核对）该 catch 的问题** — Round 4 跑 C7 才暴露。

### 修复

[`CLAUDE.md` §3.7](../CLAUDE.md) 新增表项 #31a-#36 + 拆分 #26 = 12 个新增子项（27 = 17 + 10 新加 = ✅ 100% 覆盖）。

```diff
+ #31a TLS — handlers/workspace
+ #31b TLS — preload/bootstrap
+ #32a atomic — storage
+ #32b atomic — preferences
+ #32c atomic — topic-registry
+ #32d atomic — window-state
+ #33a dir 0o700 — watcher
+ #33b dir 0o700 — storage（与 32a 同文件）
+ #33c dir 0o700 — window-state（与 32d 同文件）
+ #34 key bounds — manager.ts
+ #35 cli rename — apps/cli/src/index.ts
+ #36 keyless 回归测试 — state.test.ts
+ #26a/#26b 拆分 LocalModelStep + ProviderSelectStep
```

---

## 2. 其他 SOP 项检查

| 项 | 结果 |
|---|---|
| §3.7 标记总数 | **61 / 8 / 8** ✅ 完全匹配 |
| §3.7 反向覆盖（修复后）| **27 / 27 = 100%** ✅ |
| §2.7b A2（任务路径 hallucination）| 0 missing ✅ |
| §2.7b A3（跨文档引用悬空）| 0 处 ✅ |
| §2.7b B1-B5（品牌反向 grep）| 全过 ✅ |
| §2.7c C1-C9（代码踩坑）| 全过 ✅ |
| **跨文档"M2 安全主线 4/4"描述** | ✅ 一致（M2-SECURITY-CLOSURE / REVIEW-5 / M2-PROGRESS / 11-roadmap / spec 5 处表述统一）|
| **commit hash 引用一致性** | ✅ c516e4d2 (9) / 25d38ab9 (7) / 2972d8f4 (6) / 1a49d128 (4) — 跨 spec/REVIEW/CLAUDE/LEGAL 多处引用都准 |

---

## 3. 4 轮演练演进总览

| 轮 | 焦点 | 关键发现 | 评级 |
|---|---|---|---|
| Round 1（5/4）| 首次跑 SOP | A3 79% 误报 + B 类 4 类误报 | C+ |
| Round 2（5/5 上午）| 修 A3/B5 | B1/B2 grep 模式问题暴露 | B |
| Round 3（5/5 下午）| 修 B1/B2 + 全跑 | SOP 5/5 类全 0 误报；上线就绪 | A |
| **Round 4（5/5 晚）**| **17-commit 收尾审计** | **§3.7 表覆盖退化 100%→63%；已修复** | **A**（修复后）|

### 关键洞察

**SOP 不是"一次写完就完了"**——每次 fix 加 marker 必须同步更新 §3.7 表。否则反向覆盖率会随时间持续退化。

**自动化建议**（M3 评估）：写一个 `scripts/check-marker-coverage.sh` 在 pre-commit hook 里跑，发现新 marker 未入表就 reject commit。

---

## 4. SOP 改进沉淀

### 已落实到 SOP 文档

- §2.7b A3：grep 改为抓显式 `<doc>.md §X.Y` 跨文档引用（消除 79% 误报）
- §2.7b B1：grep 抽长串 `u_agents(_xxx)?` + 白名单合法 underscore code identifier
- §2.7b B2：先按整行过滤再抽 URL（消除 grep -v 顺序问题）
- §2.7b B5：`--exclude` SOP 自身 + audit table（消除自指 paradox）
- §2.7c C1-C9：9 个 anti-pattern grep 命令
- §3.7 基线 grep：`--exclude-dir=node_modules` 抗 build-dmg.sh 中间态
- §2.9 同步报告模板：含 C 类核对结果 + §3.7 基线对照

### 本轮 Round 4 沉淀（**新增**）

- §3.7 表项规则：**多文件不要用 `+` 联合写**，每个文件独立反引号引用
  - 否则 grep 抽路径模式 `\`packages/...\`|\`apps/...\`` 只能识别第一个
  - 影响反向覆盖率核对的 diff 命令准确度

---

## 5. 总评

**SOP 现状**：成熟 + 自我闭环。Round 4 找到的退化问题是"维护中产生的", 不是 SOP 本身缺陷 — SOP 的 §2.7c C7 命令成功 catch 了它。

**未来跑频率**：
- 每次 fix 加 marker 后立即跑反向覆盖核对（C7 命令）
- 每次同步上游后跑完整 §2.7b/c
- 每月跑一次 Round 5 类型的"维护审计"
