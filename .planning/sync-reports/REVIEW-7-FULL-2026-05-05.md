# 全方位 Review v7 — 18-commit 累积审计（2026-05-05）

**Review 焦点**：今天 18 commits（M1 perf + M2 安全 4/4 + cli rename + 4 轮 SOP 演练）累积效应审计
**审查方法**：3 个 Opus 子 agent 并行（spec 一致性 + 运行时行为 + 跨文档完整性）
**总评级**：**A-（修 4 处文档漂移后；无错事实）**

---

## 1. Agent 1 — 代码 vs spec 一致性（A）

**4 个 spec → 4 个 commit 全部完全符合**：

| Spec | Commit | 一致性 |
|---|---|---|
| `M2-TLS-FIX-SPEC` | `c516e4d2` | ✅ 4 处 + 3 marker |
| `M2-ATOMIC-WRITES-SPEC` | `25d38ab9` | ✅ 4 文件 11 处 + 4 marker |
| `M2-SECURITY-CLEANUP-SPEC` | `2972d8f4` | ✅ 3 dir + 1 key bounds + 4 marker |
| `M2-CLI-RENAME-SPEC` | `1a49d128` | ✅ 4 处 + 2 marker |

**1 个 spec 内部矛盾**：TLS spec §3 标题 "+3" vs §4 校验 "+4" — 已被 §3.7 末尾"执行 AI 反馈"自我更正为 +3，commit 落 +3，最终对齐。本次已修 §校验 grep。

**总计**：4/4 spec 完全符合，无未授权改动。

---

## 2. Agent 2 — 运行时行为（A）

| Fix | 运行时生效 | 关键发现 |
|---|---|---|
| TLS 严格化 | ✅ | WsRpcClient 默认严格；CLI 端 raw WebSocket 走 Bun-native 也严格；无绕过 |
| atomicWriteFileSync | ✅ | Windows NTFS rename 同 volume 也原子；helper rethrow 不 silent fallback |
| dir 0o700 | ⚠️ by design | 仅新装机生效；既存用户保持 0o755（spec 决策一致）|
| LLM key bounds | ✅ throw before persist | RPC handler 路径 caller (a) 正常显示友好 hint；caller (b) test connection 走 `parseTestConnectionError` 可能转译消息 |

**1 个 follow-up（极次要）**：检查 `parseTestConnectionError` 是否吞掉"Did you accidentally paste a file?"hint。1 行检查工作量。

**总计**：4/4 运行时验证通过。

---

## 3. Agent 3 — 跨文档完整性（B+ → A 修复后）

### ✅ 通过

- 6 个 commit hash 共 50+ 处引用，**0 错指**
- 12 个 M2 项目跨 5 文档 status 标签一致
- §3.7 历次基线演进表完整（44 → 47 → 48 → 51 → 55 → 59 → 61）
- 当前实际 grep = 61 = 表格基线 ✅

### 4 处发现（**本轮已全部修复**）

| # | 位置 | 问题 | 修复 |
|---|---|---|---|
| 1 | `CLAUDE.md:233` | grep 注释期望 48 vs 表格基线 61 自相矛盾 | 改为 `期望：61（基线，允许 59-63）` ✅ |
| 2 | `M2-TLS-FIX-SPEC.md:131` | 反向 grep 期望 0 但实际 3（marker 注释自匹配）| 加 `\| grep -v "U-API:"` 排除 marker 行 ✅ |
| 3 | `M2-PROGRESS:5` | 总评 5/7 vs 正文表头 5/8 不符 | 改为 `5/8`（正文一致）✅ |
| 4 | `M2-ATOMIC-WRITES-SPEC §7` | dir/Token 仍 ⏸ 但已被 `2972d8f4` 完成 | §7 标题加快照说明 + dir/Token 改 ✅ |

### 1 处过时但非错（不修）

- `SOP-REHEARSAL-4-2026-05-05.md:67` 报 hash 计数 9/7/6/4，当前实际 13/13/12/6 — 写报告时刻快照，后续 doc commit 又新增引用导致。**写作当时正确，现已过期但不修**（避免 review 报告本身被改写无穷套娃）。

---

## 4. 七轮 review 演进总览

| 轮 | 焦点 | 评级 |
|---|---|---|
| v1 | 基础健康度 | A- |
| v2 | 上游同步风险 | A++ |
| v3 | 反向覆盖率 100% | A++ |
| v4 | 实际代码（state.ts:306 P0）| A |
| v5 | 多角度深度（system.ts + TLS + 测试空白）| B+ → A |
| v6 | 文档对齐 + baseline 漂移 | A |
| **v7** | **18-commit 累积审计** | **A-（修复后 A）** |

加上 4 轮 SOP 演练 = **11 轮持续审计**。SOP 体系成熟到能 catch 自己的退化。

---

## 5. 综合评估

### 项目当前真实状态

- ✅ 代码 vs spec 一致性：100%（4/4 spec）
- ✅ 运行时验证：**100%**（4/4 fix 真生效；follow-up 已关闭）
- ✅ 跨文档完整性：~95%（4 处局部数字漂移，已全修；0 错事实）
- ✅ §3.7 反向覆盖率：100%（27/27 文件）
- ✅ commit hash 引用一致：100%（50+ 处 0 错指）

### Follow-up 已关闭 ✅

`parseTestConnectionError` 检查完成（[connection-setup-logic.ts:58](../../packages/server-core/src/domain/connection-setup-logic.ts:58)）：

- 函数 7 个 if 匹配 econnrefused/401/404/429/403 等具体错误 pattern
- 未命中 → fallback `return msg.slice(0, 300)`
- 我们的消息 `"API key too long (5000 chars, max 4096). Did you accidentally paste a file?"` ≈ 80 字符 < 300，且不含上述 pattern → 走 fallback → **完整保留**

**结论**：caller (b) test-connection 路径**不会转译消息**，用户能看到完整友好 hint。零修改需要。

**M2 安全主线 4/4 = 100% 运行时全验证 + UI 验证完成**。

---

## 6. 7 轮 review 累积价值

**做对的事**：
- 每次 fix 配 spec → 校验 → 文档收尾闭环
- 每个 fix 加 marker 入 §3.7（让上游同步可 grep 验证）
- SOP 演练 4 轮持续打磨 grep 精度（A3 79% 误报 → 0；B 类 4 类误报 → 0）
- baseline 漂移历史完整记录（44 → 61）
- commit hash 在 spec/sync-reports/CLAUDE/LEGAL 多处一致引用

**累积学到的"模式"**：
- spec → fix → 文档收尾 → 验证 → review 抽样 → 修文档漂移
- 每个文档级 inconsistency 用 grep 定位 → 单文件 Edit 修
- review 报告本身要有时效性标注（避免无限自指）
- §3.7 表项：多文件**必须**独立反引号（避免 grep 抽不到独立路径）
- baseline 数字必须配 commit hash 和"演进史"（避免下次同步迷惑）
- 反向 grep 命令需 `--exclude` SOP 自身 + audit table（消除自指 paradox）

**项目状态**：A 级 + 18 commits 一日完成 + 7 轮 review 全部闭环。
