# v0.15.6 升级方案第一轮评审

> 日期：2026-10-28。对象：[升级方案](UPGRADE-PLAN-v0.15.6-20261028.md)与[93 文件清单](UPGRADE-FILE-INVENTORY-v0.15.6-20261028.md)。
> 初审结论（r1）：**需修订后再进入执行。共 3 项，1 项 P1、2 项 P2。** 固定版本、隔离策略和平台范围可保留。
> 修订跟踪（2026-10-28）：**升级方案 r2 已补齐 R1–R3 的实施规则、文件清单和对应验收，详见 §5。** 仅为方案层闭环，代码未实施，运行验收 NOT_RUN。
> 第二轮复评（r2）：**新增 1 项 P2，R4 运行中项目/来源条件与子进程工具清单同步仍需补齐，详见 §6。没有新增 P1。** 本轮只更新本评审记录，未修改方案正文或源码。
> 初审只做静态源码/调用链核对并新增本记录；后续修订仅更新三份 Markdown。未修改源码或配置，未运行 Bun、测试、构建、应用或真实业务请求。下面不是运行复现结果。

## §1 初审发现总表（r1）

| 编号 | 优先级 | 问题 | 原方案位置 | 初审状态 |
|---|---|---|---|---|
| R1 | P1 | Pi 工具执行端遗漏 profile，新 PR 工具会被当成未知工具 | §4.2，96–98 行；G4 | OPEN |
| R2 | P2 | Explore 权限分类套用了默认展示过滤，误拦只读 pr_status | §4.2，96 行；§4.4，132 行；G4 | OPEN |
| R3 | P2 | Pi 自动固定 PR 的 hook 读取了结果事件中不存在的 input | §4.2，100 行；自动固定验收 | OPEN |

三项可以分别修复：补齐 Pi 的执行过滤仍不能修好 Explore 分类；修好工具调用也不能让自动固定 hook 得到原始命令。原方案已有的 A1 自动修复状态竞态和中文残留不重复计为本轮新发现。

## §2 逐项证据与修订要求

### R1 — [P1] 把 Pi 的执行清单纳入 profile 迁移，避免“看得到、调不了”

**触发与影响。** 升级后在 U-API 的 Coding 会话调用任一新 PR 工具，即使 Ask/Auto 的权限检查已经允许，也会在 Pi 的实际执行入口返回 `Unknown session tool`。新 PR 工具的核心用途因此无法走通。

**证据链。**

1. 当前 [pi-agent.ts](../packages/shared/src/agent/pi-agent.ts) 623–628 行注册 subprocess 工具时传入 `profile: this._agentProfile`、`hasEnabledSources` 和 `hasProject`。Coding 模式会拿到新增 PR 工具。
2. 同文件 1668–1672 行 `executeSessionTool` 再生成执行 registry，却只传 `includeDeveloperFeedback / surface / agentKind`，没有 profile。
3. 目标版本 [tool-defs.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/tool-defs.ts#L945) 新增 `!coding && CODING_ONLY_TOOLS.has(def.name)` 过滤；未传 profile 就按普通模式排除全部四个 PR 工具。
4. 本地执行入口随后在 1673–1675 行查不到 def，直接返回错误，尚未进入新的 host callback。目标上游对 pi-agent.ts 只增加自动固定 hook，不会自动修复本地这个执行 gate。

**原方案缺口。** §4.2 写出了从工具定义到 host 的连接，但没有把这个既有执行过滤作为必须修改点。§4.7 对 PiAgent 的逐文件要求只强调 hook 和原付费阻断，容易把保持旧 gate 原样当成保护定制。

**应补进方案的具体规则。**

- Pi 工具注册与执行应从同一套有效输入派生可见工具，包括当前 profile、来源/项目条件、full/mini 和既有功能政策；执行时使用当前状态。
- 保留本地的最后执行检查和生图身份保护，不能为了让 PR 工具运行而删除 gate、换成全量原始 registry，或把所有会话写死为 Coding。
- 当工具因为 profile/来源条件变化而不再可用，旧 subprocess 注册也不能让它继续执行。
- 在 §4.2、9 文件表、文件清单和 G4 中明确 `PiAgent.executeSessionTool` 的这次适配。

**闭环验证。** 在合成 Coding 会话中，经实际 Pi 工具请求路由、执行 registry、SessionManager callback 到 mock GitHub，分别验证四个 PR 工具；只读查询和本地固定操作成功，自动合并 mutation 仍遵守授权测试条件。普通/mini 与失效注册负例继续拒绝。不能只调用 `handlers/pr-tools` 或检查 schema 列表来证明通过。

### R2 — [P2] 权限分类应保留 Coding 只读工具，不能靠默认可见列表判定

**触发与影响。** 即使 R1 修好了，Coding 会话处于 Explore 时，查询 PR 状态仍会被误判成“修改会话配置”，提示用户切到可写模式。方案预期只读查询可用，这条流程却走不通；原生 Claude 与 Pi 共用这层权限检查。

**证据链。**

1. 当前 [mode-manager.ts](../packages/shared/src/agent/mode-manager.ts) 2070–2076 行在 `shouldAllowToolInMode` 中调用 `getSessionSafeAllowedToolNames`，不传 profile。
2. 当前 [tool-defs.ts](../packages/session-tools-core/src/tool-defs.ts) 956–962 行的这个 helper 基于 `getSessionToolDefs(options)` 生成集合。
3. 目标版本默认隐藏 `CODING_ONLY_TOOLS`，因此上述集合没有 `mcp__session__pr_status`；2078 行未命中，随后按写操作拒绝。
4. 目标 [PR 工具元数据](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/session-tools-core/src/tool-defs.ts#L831) 把 pr_status 明确标为 `safeMode: allow / readOnly: true`。目标版本没有修改 mode-manager.ts，不能指望本轮自动获得修正。

**原方案缺口。** §4.2 只要求接收正确元数据，§4.4 和 G4 只写读写权限正确；没有识别到“展示过滤”和“权限分类”之间的耦合及其调用点。

**应补进方案的具体规则。**

- 明确权限分类使用 canonical 工具的权限属性；可选择把有效 profile 传到分类调用，或将分类与展示过滤分开，但不能因 default 展示策略把只读 PR 工具认成写操作。
- 不要把权限 helper 全局写死为 `profile: coding`：这会反过来漏掉普通会话原有的只读工具。
- 将 mode-manager.ts 加入非上游变更中的联动适配清单，且同时覆盖 Claude/Pi 的实际前置权限入口。
- 三个 PR 写工具仍在 Explore 被拒绝，不能为放行一个查询而放行整个 `pr_*` 前缀。

**闭环验证。** 经 `shouldAllowToolInMode` 和实际前置权限链验证：Coding/Explore 的 pr_status 可用，pr_bind/pr_unbind/pr_set_auto_merge 被拒；普通会话原有允许的只读 session 工具继续允许。另验证普通会话即使有 stale PR 注册，仍由可见性/执行检查拒绝。纯粹断言定义里的 `safeMode` 字段不够。

### R3 — [P2] 自动固定 PR 必须保留 start→end 的命令关联

**触发与影响。** Pi 成功执行 `gh pr create` 并得到合法 PR URL 后，新 hook 从结果事件读取 `input.command`，但实际结果没有 input，因而一直传入 undefined 并提前返回。对其他分支/工作树创建的 PR，预期的自动固定不会发生；当前分支 PR 仍可能靠原 watcher 显示，从而掩盖这个缺口。

**证据链。**

1. 目标 [pi-agent.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/pi-agent.ts#L1217) 新增 hook，从 `agentEvent.input?.command` 取得命令后调用 `pinCreatedPr`。
2. 当前 [Pi event-adapter.ts](../packages/shared/src/agent/backend/pi/event-adapter.ts) 727–759 行在结束事件只关联 toolName、结果与错误，调用 `createToolResult`。
3. 当前 [base-event-adapter.ts](../packages/shared/src/agent/backend/base-event-adapter.ts) 204–219 行的 `createToolResult` 输出中没有 input。input 只在 start 事件里提供。这两个 adapter 不在本次上游变更中。
4. 新 `BaseAgent.pinCreatedPr` 首先检查 `typeof command === 'string'`；undefined 直接返回 null。
5. 上游新增 [pin-created-pr.test.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/8df01c5d0ac73c35add5954e6f190ce038d35845/packages/shared/src/agent/__tests__/pin-created-pr.test.ts#L76) 的 Pi 用例直接调用 `pinCreatedPr('gh pr create --fill', PR_URL)`，绕过真实事件转换，不会发现参数丢失。

**原方案缺口。** §4.2 第 100 行只要求模拟输出验证固定，没有限定测试必须经过实际 Pi start/end 事件。执行者沿用上游用例可以得到通过结果，用户流程仍失效。

**应补进方案的具体规则。**

- 在 Pi 事件边界按 toolCallId 保留必要的命令参数，并在对应完成结果上取回；也可采用等效的 adapter 透传，但不能把“结果自带 input”当作事实。
- 仅成功 Bash 结果尝试固定，保持 Coding、URL 校验和服务端 verify-before-persist 条件；无需把命令缓存写进会话文件。
- 明确完成、失败、中止、会话销毁/重启时的缓存清理；交错的不同 toolCallId 不能串命令。
- 文件清单补入 Pi event-adapter/base helper 的检查，以及最终选择的实际修复位置；不要求为了本功能同时重写两个 adapter。

**闭环验证。** 用同一个 toolCallId 输入真实形状的 `tool_execution_start(bash, args.command)` 和 `tool_execution_end(result)`，经过实际 Pi adapter/handleSessionEvent 后检查绑定 callback 恰好一次。覆盖交错调用、失败、普通模式、gh pr view、--web、无法验证的 URL 和销毁后晚到事件。不能直接向 `pinCreatedPr` 喂命令来替代这个用例。

## §3 方案的修订落点

| 原方案位置 | 需新增内容 |
|---|---|
| §4.2 与 §4.7 | R1 注册/执行同源 profile 合同；R3 的实际命令关联与清理 |
| §4.4 | R2 分类与展示的区别，保留只读及写入权限 |
| §6.2 定向用例 | Pi 请求实际路由、session-tool-safe-mode-permissions、Pi start/end 事件链 |
| §7 G4/G5 | 分别验证“能展示”“能执行”“Explore 可查询”“能自动固定”，不能相互替代 |
| 配套清单 §3 | mode-manager.ts 与事件转换相关文件加入联动检查；改造点在实施后对账 |

修订后应逐条列出处理规则及对应验收，才能把本报告标成“方案层已闭环”；代码和运行结果仍需实施后另记。初审阶段没有改写原方案；后续经用户要求形成 r2，处理跟踪见 §5。

## §4 本轮确认可保留的部分与审查边界

固定 B/O/T、93 文件规模、57 个本地交叉路径、9 个带标记文件的审查范围，以及隔离在 Bun/preload 前生效、同 SHA 双平台包、更新资源与回退边界，可沿原方案推进。已有 A1 的最终状态重验也应继续保留。

本轮重点核对新增 PR 工具从显示、权限、执行到回传，以及自动固定的 Pi 事件链；没有把全部 93 文件作逐行安全审计。没有新增关于 SDK、计费或公开发布已通过的结论。

## §5 r2 修订跟踪（2026-10-28）

用户要求“那就修订”后，已更新[方案 r2](UPGRADE-PLAN-v0.15.6-20261028.md)及[文件清单](UPGRADE-FILE-INVENTORY-v0.15.6-20261028.md)。下表表示设计和验收要求已落文档，不表示缺陷已在代码里修复，也不是第二轮独立评审通过。

| 项目 | r2 的具体处理 | 验收对应 | 当前状态 |
|---|---|---|---|
| R1 | §4.2.1 集中生成有效 profile/来源/项目/full-mini 条件，注册与执行同源；四个 PR 工具 full Coding；保留最终执行过滤 | §6.2 真实 Pi 请求路由→执行 registry→host→mock GitHub；G4 正反例 | 方案层已闭环；实施/运行 NOT_RUN |
| R2 | §4.4.1 在 mode-manager 通过已导出的 SESSION_TOOL_REGISTRY 按名称读 safeMode；保持功能政策与实际工具集合约束，不全局写死 Coding | §6.2 shouldAllowToolInMode 与 Claude/Pi 前置权限链；G4 查询放行、三写拒绝、旧只读/关闭政策回归 | 方案层已闭环；实施/运行 NOT_RUN |
| R3 | §4.2.2 采用 PiAgent 内存表关联 start/end 的 toolUseId 与命令，明确清理和旧生命周期结果失效；不假设结果自带 input | §6.2 真实 adapter/handleSessionEvent；G5 非当前分支正例与交错/重复/失败/中止/晚到负例 | 方案层已闭环；实施/运行 NOT_RUN |

§4.7、W2、改造点收口和执行任务模板已同步更新；清单新增 mode-manager、事件 adapter 检查及集成测试联动项。原 93/57/9 差异统计保持其原始口径。文档结构、相对链接、三项修订覆盖和状态口径经静态自检；代码层闭环仍以候选实施及真实调用链验收记录为准。

## §6 第二轮复评：r2（2026-10-28）

本轮针对 r2 新增规则，复核 Pi 注册/执行、canonical 权限分类、事件 start/end 关联及生命周期，再检查动态项目/来源变化。仍为静态审查，没有运行测试、创建候选或执行升级。

### §6.1 第一轮修订的复核

| 项目 | 复核结果 |
|---|---|
| R1 的四个 PR 工具调用主路径 | 注册与执行共用有效条件、保留最后执行 gate、四工具 full-only 的规则可以保留；附带的动态项目/来源条件仍有 R4 补充项 |
| R2 的 Explore 权限分类 | SESSION_TOOL_REGISTRY 确实已导出；按 canonical 属性分类并保留关闭政策，与展示/执行过滤分开，规则可保留 |
| R3 的自动固定 | start/end 的 toolUseId 可对应；PiAgent 内存关联及 abort/forceAbort/新轮次/销毁时清理的规则可保留，且验收已要求真实事件链 |

上述是方案可实施性复核，不代表代码或运行结果通过。原有 A1 的状态重验、隔离和正式发布边界继续保留，不重复列为新问题。

### R4 — [P2] 明确运行中项目/来源变化如何同步工具清单

**方案位置。** [r2 方案 §4.2.1](UPGRADE-PLAN-v0.15.6-20261028.md) 第 126–129 行要求每次使用当前项目/来源条件，注册与执行同源；第 132 行与 G4 要验证条件变化。但尚未指定最新状态从何同步、何时重新注册 session 工具，以及旧定义如何移除。

**实际触发。** 一个已经创建 agent/subprocess 的 Coding 会话，起初无项目或无来源，用户随后绑定项目、启用来源，再发送一轮。按现有结构只重算执行端过滤，模型仍可能看不到新增的 project_memory_append/source 辅助工具；取消绑定后，模型清单又可能保留过期工具。这里不是把已知旧行为宣称成 v0.15.6 新引入的回归，而是 r2 的“当前有效条件”合同还缺同步步骤。

**源码证据。**

1. [SessionManager.ts](../packages/server-core/src/sessions/SessionManager.ts) 4076–4093 行在创建 agent 时构造独立 sessionConfig，其中 projectId 是当时 managed.projectId 的值。8474–8489 行 setSessionProjectId 更新 managed、持久化和事件，没有更新已存在 agent 的 config.session 或重建其工具集合；2127–2129 行的外部项目元数据同步也只改 managed。
2. [pi-agent.ts](../packages/shared/src/agent/pi-agent.ts) 623–640 行在启动时生成 session 工具定义，hasProject 来自 this.config.session.projectId。仅重新执行读取这个快照的 helper 不会使项目状态变新。
3. 同文件 2416–2427 行 setSourceServers 只重注册 MCP pool 的 proxy 工具，不重新生成 canonical session 工具。因此 sourceManager 状态变了，也不会自动增加 Coding 的 source_* 辅助工具。
4. [Pi 子进程 index.ts](../packages/pi-agent-server/src/index.ts) 1486–1500 行的 register_tools 按名称合并，不删除本次消息中未包含的旧工具。单纯再次发送缩小后的数组，甚至空数组，都不能理解成替换整个工具集。这个模块没有在本次上游差异中获得新的替换语义。
5. SessionManager.getOrCreateAgent 的运行时签名以连接/provider/auth/model 为输入，不能依赖它在 projectId 变化时自动重建 agent。

**影响与边界。** 四个 PR 工具在 full Coding 中固定保留，因此这项不推翻 R1 对它们的主路径修正。问题影响方案同时承诺的运行中项目/来源条件变化：执行检查与模型可见集合可能不同步。现有 project_memory_append 主机 callback 会再次检查当前项目，不能据此断言已经写错项目或发生越权。

**建议补进方案。**

- 明确项目条件以 SessionManager 当前 managed 状态为准，通过受控更新/回调传给现有 agent；不要只读创建时的 config.session 快照。外部元数据变更与 UI 绑定使用相同同步规则。
- 在受控的回合边界、发送下一次 prompt 前刷新 session 工具清单；来源变化也要触发这一步。不能为更新工具列表中途打断用户任务或自动发起模型请求。
- 明确 register_tools 的范围和替换/删除策略。session 工具更新不能删掉 MCP pool 工具，MCP 更新也不能恢复已禁用的 session 工具；不能把当前 merge 协议当作全量替换。可用有界的命名空间更新或等效的受控重建，具体选择应落在方案中。
- 撤销能力时主机执行 gate 立即按当前条件拒绝旧调用；新增能力在下一次模型请求前真实可见。工具同步不能授予新生图 owner 或重放旧付费上下文。
- 对应补充 SessionManager 项目更新入口、PiAgent 重新注册入口、子进程注册协议与集成测试的联动文件清单。

**必须新增的验收。** 同一个存活会话和 agent 从“无项目/无来源”开始，先建立 subprocess，再通过真实项目/来源更新入口改变状态；下一次 prompt 实际携带 project_memory_append/source_*。随后解绑/停用，验证模型清单和主机拒绝结果；切换到另一个项目时不复用旧项目。刷新 session 集合时原 MCP 工具仍在，刷新 MCP 时 session 限制仍在。测试应经过 host→子进程 register_tools/下一轮工具构建，不能只改变 helper 参数后比较两个数组。

### §6.2 本轮结论

| 项目 | 优先级 | 状态 | 建议修订落点 |
|---|---|---|---|
| R4 动态项目/来源与工具清单同步 | P2 | r3 方案已补齐；实施结果另记 | §4.2.3、G4、联动文件清单 |

本轮没有发现新增 P1。建议在 r2 中补齐 R4 的状态来源、同步时点与注册协议处理后进入候选实施；无需改变固定上游版本、平台范围或另增功能。运行正确性仍由隔离候选的实际验收确认。

2026-10-28 用户要求“修订后开始落地”。r3 明确采用 host-only 实时项目 getter、Pi prompt 前同步及 session/sources 命名空间替换，保留旧 merge 兼容与 host agent 付费身份；方案层已补齐 R4。此更新不宣称代码或测试通过。


## §7 本轮实施跟踪（2026-10-29）

用户已要求“修订后开始落地”。R1–R4 与 A1 均已在 `codex/upstream-v0.15.6` 实施，57 项定向用例、两后端权限入口、全量与 isolated 回归通过。R4 的包内真实子进程 → SDK → loopback 五轮工具集合验证已通过；源码提交 `43367c5e`。Windows、真实业务和普通安装验收仍未完成。具体结果、包及剩余边界以[执行记录](UPGRADE-EXECUTION-v0.15.6-20261028.md)为准。
