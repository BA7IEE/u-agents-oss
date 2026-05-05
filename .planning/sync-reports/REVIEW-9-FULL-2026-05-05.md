# 全方位 Review v9 — v8 后事件驱动 mini-review（2026-05-05 夜）

**Review 焦点**：v8 之后单 commit（`1119ee32` url-safety fixture 修复）+ 跨上游对齐 + §3.7 表精核 + 跨文档一致性
**审查方法**：3 个并行 Opus 子 agent（A 上游对齐 / B §3.7 表精核 / C 文档一致性）+ 主 review 交叉验证
**总评级**：**A−（git 仓库 A，文档 B+ 因 1 处状态矛盾 + 2 处 baseline 漂移）**

> v8 元评估明确建议"v8+ 不再做全维度审计，改事件驱动"。本轮 v9 严格执行：只 review v8→HEAD 的 1 个 commit + 上游对齐 + 跨文档一致性，不重复 v8 结论。

---

## 1. 三路 agent 综合发现

### A 路 — 上游对齐核查（A）

**关键发现（v8 未明确点出）**：
`git merge-base HEAD upstream/main = acb08842 = upstream v0.9.0`。
我们的 fork 已基于 upstream 最新 release tag。**当前没有上游待吸收 commit**——下一次同步触发条件是 upstream 发 v0.9.1+。

§3.3 七个高冲突文件 vs upstream/main 全部 **aligned**：
- `electron-builder.yml` / `branding.ts` / `provider-metadata.ts` / `ProviderSelectStep.tsx` / `OnboardingWizard.tsx` / `apisetup/`：差异均与 §3.7 表项对应，标记齐全。
- `llm-connections.ts`：与 upstream **0 diff**——§3.7 表里也没该文件，§3.3 保留它纯属"未来防御"。

**无 P0/P1 同步动作**。

### B 路 — §3.7 标记表精核（A）

| 维度 | 结果 |
|---|---|
| 总数 | 61 ✓（基线 ±2 = 59-63） |
| START/END 配对 | 8/8 ✓（同文件、行差合理 7-58 行） |
| 表 → 代码反向覆盖 | 36/36 项全命中 |
| 代码 → 表正向覆盖 | 11 个文件含 "U-API" 文字但**非 marker**（产品文案/品牌字符串），基线 grep 用 `(//|/\*|\{/\*|<!--)\s*U-API` 不计入——非漏登记 |

**唯一可挑剔的小点（不需修）**：
- §3.7 #36 `state.test.ts` 表声明"单行" → 实际是 describe block 内 4 处文字引用 + 1 处 commented-out marker。基线 61 有意算入。属表格描述与实际形态轻度不严格，但**不影响 grep 验证流程**。

**CLAUDE.md §3.7 不需要更新**。

### C 路 — 跨文档一致性（B+）

**3 项实质漂移**（Top-3 待修）：

| # | 严重度 | 漂移 | 真相 |
|---|---|---|---|
| **C1** | **P1** | `M2-SECURITY-CLOSURE.md:21,116,136` 三处仍写"apps/cli rename ⏸ M2/M3 边界未做" | 已完成（commit `1a49d128` + CLAUDE.md §3.7 #35 + `M2-CLI-RENAME-SPEC.md`） |
| **C2** | **P2** | `07-upstream-sync.md:455` grep 期望注释 `# 期望：13` | 同文件 446 行已写 12（commit `1119ee32` 修后），455 行未同步 |
| **C3** | **P2** | M2 三个 SPEC（CLI/ATOMIC/SECURITY-CLEANUP）正文仍写"baseline 13 stable + 2 flaky" | 这些 spec 写于 url-safety 修复前；现真值 12 stable + 1-2 OAuth flaky。无"历史快照"提示 |

**无 P0**。CLAUDE.md §3.7 内交叉引用（02 §4.1 / §6.2 等 8 处抽查）全命中、无断链。BUN_VERSION（1.3.9）跨 3 文档一致。LLM 入口地址（`token.u-studio.cn/v1`）跨文档无冲突。

`craft-cli` 残留（README.md / docs/cli.md 30+ 处）按 §3.4.1 + LEGAL.md §39 + `08 §160` 设计保留——M1 不发布范围，**非死链**。

---

## 2. 与 v8 的差异

| 维度 | v8（5/5 下午） | v9（5/5 夜） |
|---|---|---|
| 范围 | 20 commit + 11 轮累积 | v8→HEAD 仅 1 commit |
| 方法 | 3 路深度 agent（回归/产物/依赖+元）| 3 路窄角度 agent（上游/§3.7/文档） |
| 新发现 | 1 P0（生产分发缺口）+ 1 baseline 修 | 1 P1（C1 状态矛盾）+ 2 P2（baseline 漂移） |
| 评级 | B（git A，生产 C） | A−（git A，文档 B+） |

**v8 P0 状态追踪**：生产分发缺口（R2 用户跑的 hotfix v0.9.0+u-agents.1 不含 4 个 P 安全 fix）**仍未决策**。Path A/B/C 待选。本轮 v9 不重复列。

**v8 baseline cleanup（url-safety:48）**：已落地（commit `1119ee32`），baseline 13→12 stable。✓

---

## 3. P0/P1/P2 行动清单

| 严重度 | 项 | 修复成本 | 推荐时机 |
|---|---|---|---|
| **P0**（来自 v8）| 生产分发缺口（R2 ≠ git）| 20 分钟（Path A 重打 + 重传）| 待用户决策 |
| **P1（v9 新）** | C1：`M2-SECURITY-CLOSURE.md:21/116/136` 改"⏸"→"✅ commit 1a49d128" | 1 个 doc commit（3 处 Edit） | 任何时候 |
| **P2（v9 新）** | C2：`07-upstream-sync.md:455` `# 期望：13` → `# 期望：12` | 1 行 Edit | 与 P1 同 commit |
| **P2（v9 新）** | C3：M2 三个 SPEC baseline 加"历史快照"尾注 | 3 处 Edit | 与 P1 同 commit |

**P1+P2 合计 1 个 doc commit，预计 5 分钟**。完成后文档健康度 B+ → A。

---

## 4. v9 元评估：边际收益

v8 元评估说"v8+ 不再做全维度审计"——本轮 v9 用窄角度 3 路 agent 验证了这条建议的可行性：

| 指标 | v8（全维度）| v9（事件驱动） |
|---|---|---|
| Agent 数 | 3 | 3 |
| Token 预算 | 高（深度审计）| 低（窄角度） |
| 新发现 | 1 P0 + 1 修 | 1 P1 + 2 P2 |
| 价值密度 | 高 | 中 |
| Review 时长 | ~25 分钟 | ~12 分钟 |

**结论**：事件驱动 mini-review 适合"v8 后无新 commit 周期"的常态维护。**真正大的 review 触发条件**应是：
1. 上游发新 release tag（acb08842 后）
2. 任何 hotfix 重打 R2 后（产物验证）
3. M2 收尾 → M3 入口（milestone 跨界）

---

## 5. 总评

| 维度 | git 仓库 | 文档 | 生产分发 |
|---|---|---|---|
| 代码质量 | A | n/a | A（已修但未分发）|
| §3.7 标记 | A（61 ✓ + 配对 ✓）| n/a | n/a |
| 上游对齐 | A（merge-base = v0.9.0）| n/a | n/a |
| 跨文档一致 | n/a | **B+**（C1 状态矛盾 + 2 漂移）| n/a |
| 安全主线 4/4 | ✅ 100% | ✅ spec 闭环 | ❌ 0%（v8 P0 未解决）|

**git 仓库评级：A**
**文档评级：B+**（→ 修完 C1+C2+C3 = A）
**生产分发评级：C**（v8 P0 未解决）
**总评：A−**（修完 C1+C2+C3 + 生产 P0 决策 = A）

**v9 唯一新增动作建议**：
1 个文档 commit 修 C1+C2+C3（5 分钟）。
v8 P0 仍待用户决策（推荐 Path A：20 分钟重打 + 重传 R2）。
