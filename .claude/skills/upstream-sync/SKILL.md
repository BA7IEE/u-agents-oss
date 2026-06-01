---
name: upstream-sync
description: U Agents fork 与上游 craft-agents-oss 每月同步时使用。当任务涉及 git merge upstream、解决同步冲突、核对改造点基线、写同步差异报告（sync-reports）、或检查上游是否引入新 provider/品牌入口时触发。本仓库 AI 只产出指引/报告 .md，不执行 merge 本身。
---

# 上游同步（每月一次）

> 铁律：本仓库 AI **不执行** merge/fetch/checkout 等写命令（见 `CLAUDE.md` §0）。
> AI 的角色：①产出"照做指引" ②合并后读最终结果写差异报告 ③更新受影响规格。

## 必读（按顺序）
1. [`.planning/07-upstream-sync.md`](../../../.planning/07-upstream-sync.md) — 完整同步规程（含 §2.7 反向核对、C1–C14）
2. [`.planning/08-conflict-zones.md`](../../../.planning/08-conflict-zones.md) — 高冲突文件清单
3. [`.planning/14-uapi-marker-registry.md`](../../../.planning/14-uapi-marker-registry.md) — 改造点登记表 + 基线 + 校验 grep
4. [`.planning/01-branding-spec.md`](../../../.planning/01-branding-spec.md) + [`.planning/02-llm-gateway-spec.md`](../../../.planning/02-llm-gateway-spec.md) — 品牌/网关反向核对
5. [`.planning/09-test-checklist.md`](../../../.planning/09-test-checklist.md) — 发版回归

## 用户/执行会话照做的流程（AI 只产出，不执行）
`git fetch upstream` → `git checkout -b sync/upstream-YYYYMMDD` → `git merge upstream/main` → 解冲突（§3.3 文件优先保我方再挑上游逻辑）→ 品牌核对 → 跑回归 → merge 回主分支。

## 合并完成后 AI 要做的（产出 .md）
1. **跑 §14 校验 grep**（只读）：核对标记总数 vs §14 §0 当前基线（写作时 98）、`START`/`END` 各 = 9；超 ±2 停下逐项核对。
2. **过 C1–C14 踩坑表**（见 §14 §6）：重点 C11（新文件旧 NPM scope `@craft-agent/` 必须 = 0）、C12（上游自带 lint 违规）、C13（上游自带 test fail）。
3. 写 `.planning/sync-reports/SYNC-vX.Y.Z-YYYYMMDD.md` 差异报告。
4. 上游若新增 provider / 品牌入口 → 更新 `01-` / `02-` 规格。
5. **刷新基线**（照 §14 §0「基线刷新规则」）：更新 §14 §0 基线数字+日期（唯一权威）→ §14 §5 追加历史行 → 有新改造点再在 §14 §3 子表加行。
6. 顺带做 harness 复审（见 [`.planning/13-claude-harness.md`](../../../.planning/13-claude-harness.md) §维护）。
