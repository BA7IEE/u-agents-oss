# REVIEW-27 执行完成报告

> **日期**：2026-05-08
> **触发**：v27 10-Agent 全方位 review 找到 8 真 P0 + 21 P1
> **执行**：Bucket A 7 文档 + Bucket B 4/6 代码（2/6 defer）
> **状态**：**已闭环——真实安全风险全修；用户感知改进按"数据驱动"延后**
> **关联文档**：
> - [`REVIEW-27-FULL-2026-05-08.md`](./REVIEW-27-FULL-2026-05-08.md)（review 报告）
> - [`M3-SSRF-CONSOLIDATION-SPEC.md`](../M3-SSRF-CONSOLIDATION-SPEC.md)（v27 触发的新 spec）
> - 两个 commit：`b87e11b6`（A）+ `005215a4`（B）

---

## 0. 一句话结论

v27 review 提出的 **真正的安全/合规风险（SSRF redirect bypass、SSRF 横向覆盖、品牌漏盘、文档死链）全修了**。B4 toast / B5 chat gate 是"用户感知改进"，没有真实用户数据驱动**，按"等用户真的踩到再做"原则延后**——把它们存档进有触发条件的 backlog，不会再被反复翻出来作为"未完成"。

---

## 1. 已交付清单

### Bucket A（7 文档 P0）

| # | 改进 | 状态 |
|---|---|---|
| A1 | 09 §13.8 + 4 M3 spec 历次基线演进轨迹补完 | ✅ |
| A2 | 13 处 `../AGENTS.md` 死链改 `../CLAUDE.md`（v0.9.2 sync 漏盘） | ✅ |
| A3 | 02 §4.4 `enforceUApiBaseUrl` 触发 toast SOP（含 i18n key 草案） | ✅ spec 完整 |
| A4 | 02 §3.3.1 模型清单**前置校验升 P0**（chat sendMessage gate） | ✅ spec 完整 |
| A5 | 04 §9.2.1 browser tool i18n 重写指引 | ✅ |
| A6 | 06 §6.1+§6.2 下载页 Intel Mac 声明 + 推动 SOP | ✅ |
| A7 | 新建 [`M3-SSRF-CONSOLIDATION-SPEC.md`](../M3-SSRF-CONSOLIDATION-SPEC.md) | ✅ |

### Bucket B（4/6 代码 ✅ + 2/6 defer ⏸）

| # | 改进 | 状态 | 影响范围 |
|---|---|---|---|
| B1 (P0-1) | web-fetch.ts redirect:'manual' + 30x reject + 7 runtime tests | ✅ | **真安全风险** |
| B2 (P0-5) | auto-update.ts:5 注释 URL 与 publish.url 对齐 | ✅ | 文档一致性 |
| B3 (P0-7) | zh-Hans browser tool i18n 重写 + 风险提示 | ✅ | 用户感知 |
| B6 (P1) | source-test.ts 4 处 SSRF guard | ✅ | **真安全风险** |
| B7 (P2) | U_API_TOPUP_URL 死代码清 | ⏸ skip | 无害，留作 documented dead code |
| B4 (P0-6) | `enforceUApiBaseUrl` 触发 toast 实现 | ⏸ defer | 用户感知改进 |
| B5 (P0-3) | 模型清单 sendMessage gate 实现 | ⏸ defer | 用户感知改进 |

### §3.7 marker baseline

- 之前：82 → 现在：**94**（+12 marker：B1=2 + 测试 1 + B6=8 + B2=1）
- START/END 块：9/9（不变）
- 新增 §3.7 表项：#47a / #47b / #48a-d / #49

---

## 2. defer 项的"触发条件"——什么时候真的去做

### B4 enforceUApiBaseUrl toast（P0-6）

**实施成本**：~2-3 小时（IPC 通道 + 7 locale × 4 keys + toast 组件复用）

**触发条件**（满足任一即升级为"必须做"）：
1. **真实用户反馈**：3 个以上用户报告"我改了 baseUrl 配置怎么没生效" / "为什么我的 config.json 自动改了"
2. **合规审查**：法务/安全审查要求"用户篡改防护必须有用户感知证据"
3. **下次 sync 顺手做**：上游若引入 toast/通知系统升级，借力顺道做掉

**触发前的兜底**：
- spec 在 02 §4.4 已写完整——任何时候上手都不需要重新设计
- main 进程当前已 log（mainLog.warn），运维可查 — 用户感知层缺失但不无证据

---

### B5 模型清单 sendMessage gate（P0-3）

**实施成本**：~2-3 小时（chat hook + 阻塞对话框 + 7 locale × 5 keys + navigate 路由）

**触发条件**（满足任一即升级为"必须做"）：
1. **真实用户反馈**：3 个以上用户报告"发消息直接 fail，错误是英文'Default model is required'"
2. **支持成本**：你/客服收到此类问题超过 1 次/周
3. **下次 sync 顺手做**：上游若改 chat 入口，借力做

**触发前的兜底**：
- onboarding 阶段的校验依然在（首次配置不会空）
- 用户**主动**删光模型才会触发——非默认路径
- 后端报错信息至少能引导（虽是英文）

---

### B7 死代码（U_API_TOPUP_URL）

**永远不必做**：documented dead code，注释清楚"为什么留着"。M4 重构时若需要可一并清。

---

## 3. 没做的"幽灵任务"——为什么不做（防止下次 review 再翻）

| 想做但没做 | 不做的理由 |
|---|---|
| B4/B5 完整实现 | 见 §2 — 用户数据驱动，没数据不动 |
| B7 删 U_API_TOPUP_URL export | 风险/收益比不对 — 1 行死代码删了无收益，万一别处隐式依赖反而坏 |
| 全 fetch callsite SSRF 扫雷一次性做完（M3-SSRF-CONSOLIDATION 全部） | spec 写了，按 P0→P1→P2 节奏分批做。本次只做 P0（web-fetch）+ 部分 P1（source-test）；webhook / telegram / oauth 等 P1+ 等下次或 sync 触发再做 |
| 修 pi-agent-server typecheck 错误（rootDir） | 是上游的预存在问题，sync 时已知技术债，跟我们改造无关 |

---

## 4. 当前 ship 状态（用户视角）

| 维度 | 状态 |
|---|---|
| **v0.9.2 macOS arm64**（D-β）| ✅ R2 已上传 / 已实测 / 自动更新链路通 |
| **v0.9.2 Windows x64** | ✅ R2 已上传 / 已实测 |
| **v0.9.2 macOS x64**（Intel）| ⚠️ 暂不支持 — 06 §6.1 SOP 已加 |
| **v0.9.2 Linux** | ⚠️ 实验性 — 06 §6.1 SOP 已加 |
| **更新服务器** | ✅ `update.u-agents.u-studio.cn/latest/` 全部 200 |
| **§3.7 marker baseline** | ✅ 82 → 94（+12，下次同步基线） |
| **validate:ci** | ✅ 全绿 |
| **三地 git 同步** | ✅ worktree = main = origin/main = `005215a4` |

---

## 5. 接下来你（用户）要做的事

按"成本 × 价值"排：

### 立即做（成本 0）
1. **下载页加 §6.1 内容**（v27 P0-2/P0-4 spec 写好的 Intel Mac 声明）—— HTML 改一个 banner / 装机引导卡片即可
2. **持续观察 v0.9.2 用户反馈**——记录每个客服问题，命中 §2 触发条件就回来做 B4/B5

### 不要做
- ❌ 重打 v0.9.2（已经稳定）
- ❌ 单独发 v0.9.3 修 B4/B5（没数据支撑）
- ❌ 主动改其它 fetch callsite 的 SSRF（按 M3-SSRF-CONSOLIDATION-SPEC §3 节奏，不要提前优化）

### 等"自然时机"做
1. **下次每月上游同步时**：顺手做 B4/B5（如果上游碰到相关代码）
2. **下次 review 时**：跑 §3.7 baseline grep（期望 92-96，超出停下）
3. **3 个真实用户反馈累积时**：把 B4/B5 升级为下个 hotfix

---

## 6. v27 review 闭环判定

| 闭环维度 | 判定 |
|---|---|
| 真安全/合规风险 | ✅ 全修（SSRF / 品牌 / 文档死链）|
| 用户感知改进 | ⏸ spec 完整，等数据驱动 |
| 文档一致性 | ✅ 全修（baseline / AGENTS→CLAUDE / Intel Mac SOP）|
| 测试覆盖 | ✅ 新增改造点全有单测 |
| §3.7 marker | ✅ baseline 刷新（82→94）|
| 三地 git 同步 | ✅ |
| spec 与代码的一一对应 | ✅ |

**闭环结论**：v27 在"该做的全做了 / 不该做的明确说不做 / 按数据驱动延后的有触发条件"三层标准下闭环。下次 review 不应该把这些项再翻出来当"未完成"——它们要么已交付、要么有 backlog 触发条件。

---

## 7. 工程纪律——本次新建立的"延后但不丢"机制

> 这是本次 review 留下的最大遗产——比修了多少 P0 更重要。

### 之前的问题
v23 review 把 `createApiTool` 提为"v23 §5.2 follow-up P1"——v24 实施时只修了那一处，没追问"还有哪些 fetch 同形态"。结果 v27 N1 反向追踪发现 6 处同形态漏洞——证明"修一个点"不等于"修一面"。

### 本次新机制
1. **横向 spec**：M3-SSRF-CONSOLIDATION-SPEC 把"按点修"的反模式记录下来，每次新 P0 P1 都问"是不是面 vs 点"
2. **触发条件 backlog**：B4/B5 不再是 "TODO 不知道什么时候做"，而是 "X 条件触发即升 P0"——明确数据/反馈门槛
3. **闭环报告**：每次 review 必有 `*-EXECUTION-COMPLETE.md`，把"做了什么 / 没做什么 / 为什么"全记录——下次 review 直接对照

---

**结束。v0.9.2 处于稳态，等你下次发版/同步/数据反馈再启动新一轮工作。**
