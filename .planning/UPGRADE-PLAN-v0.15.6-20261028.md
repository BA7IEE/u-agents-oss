# v0.15.5 → v0.15.6 详细升级方案

> 执行进度（2026-10-29）：已按本轮“修订后开始落地”指令在独立候选实施，实时结果见[执行记录](UPGRADE-EXECUTION-v0.15.6-20261028.md)。下述“未执行”描述保留初次规划时点。
> 核查日期：2026-10-28。修订：**r3，已补齐 R1–R4 的实现规则与验收；用户已要求修订后开始落地，实施结果另记**。
> 初版依据本地源码、GitHub 固定版本差异和既有验收记录；本轮按[第一轮评审](UPGRADE-PLAN-REVIEW-v0.15.6-20261028.md)修订方案、文件清单和评审跟踪 Markdown。未 fetch、merge、创建候选工作树、安装依赖、运行测试、构建或发布。
> 配套：[93 个文件的逐项清单](UPGRADE-FILE-INVENTORY-v0.15.6-20261028.md)。规则依据：[CLAUDE.md](../CLAUDE.md)、[PRODUCT.md](../PRODUCT.md)、[同步 SOP](07-upstream-sync.md)、[冲突区](08-conflict-zones.md)、[网关规格](02-llm-gateway-spec.md)、[功能裁剪](04-feature-cuts.md)、[改造点登记](14-uapi-marker-registry.md)。

## §1 建议与升级目标

**建议从当前 main 建立独立候选分支，一次合入固定的 v0.15.6，完成 U Agents 适配后交付 macOS arm64、Windows x64 测试包。** 建议分支名为 `codex/upstream-v0.15.6`。不需要再经过中间版本，也不把公开上游的后续 main 自动混进本次候选。

这次主要价值是完善编码工作流：多 PR 管理、Agent 原生 PR 工具、按需自动修复审查意见、工作树仓库发现和更快的模式切换。属于中等规模集成；1 个上游提交不代表只改了一处。

建议接收全部版本变更，保留现有产品边界。其中自动修复默认关闭，开启后才允许产生后台推理；自动合并遵循具体 PR 的用户授权。先修正 §4.3 的启动前状态检查，再验收自动修复。

完成分成三个独立结果：

| 结果 | 达标条件 |
|---|---|
| 源码候选可用 | 固定版本合入、定制迁移完成、自动检查和本次新增关键用例通过 |
| 双平台测试包可交付 | 同一候选提交构建；安装包、包内运行时和列明的桌面流程有证据 |
| 正式发布完成 | 另有明确发布授权；真实使用和更新链路达到验收要求；实际发布资源经过核对 |

“出方案”只覆盖本文档。本次不会执行这些阶段，也不会把历史任务的合并、发包或真实计费测试授权直接当成本次执行指令。

### §1.1 r2 修订对应关系

| 评审项 | 本轮补齐的规则 | 实施与验收位置 |
|---|---|---|
| R1 | Pi 注册与执行共用有效 profile 条件；执行端保留最后过滤，拒绝失效注册 | §4.2.1；G4 |
| R2 | Explore 按 canonical 权限元数据分类；展示与执行仍各自受有效工具集合约束 | §4.4.1；G4 |
| R3 | PiAgent 以内存表按 toolUseId 关联 start/end 命令，明确清理与旧事件失效 | §4.2.2；G5 |
| R4 | 活跃 agent 从 host 获取当前项目状态；下一轮 prompt 前按作用域替换工具清单，撤销即时由执行 gate 拒绝 | §4.2.3；G4 |

以上只表示**方案层要求已补齐**；代码实施和运行验收以本次执行记录为准。原有自动修复竞态 A1 继续按 §4.3 处理。

## §2 固定基线与差异规模

| 对象 | 已核实事实 |
|---|---|
| 上游共同基线 B | v0.15.5：`cede6ea49e0c4a42933ed0f1bc129db698fc581f`，在本地 HEAD 历史中 |
| 当前本地主线 O | `475fc0c72bf41454359134d371e3b6b49b914fac`，2026-10-24 合入 v0.15.5 发布说明与更新资源 |
| 远端 origin/main | 本轮 GitHub branches/main 实时返回同一 O |
| 升级目标 T | v0.15.6：`8df01c5d0ac73c35add5954e6f190ce038d35845`，远端 tag 已核实直接指向此 commit |
| 发布日期 | 2026-10-23，北京时间 08:26；本轮查询最新正式版为 v0.15.6 |
| 当前应用版本 | 根与 Electron 的 package.json 都是 `0.15.5` |
| 工作区状态 | tracked 无改动；原有未跟踪 `.agents/`、`.codex/`、`manifest.json` 应原地保留 |

B→T 共 **93 个文件：16 新增、77 修改、0 删除；+4,837 / −602 行**。Compare API 返回了全部 93 个文件及其 patch，未触及 300 文件上限。分布：Electron 20、server-core 22、shared 32、session-tools-core 7，其余 12。

其中 **57 个路径也在 B→O 本地差异中，9 个是带 U-API 标记的文件**。这只是交叉审查范围，可能包含包名替换等机械差异；**实际 Git 冲突数量仍为 UNKNOWN**，要在授权后的独立候选中合并才能确定。

当前源码实测为 **239 个 U-API 标记、START 9、END 9**。登记表数字相同，但表头仍写“候选、未合主线”；实际 main 已包含该实现，不能根据旧表头退回旧基线。本轮不改历史记录或提前填写 v0.15.6 的新计数。

本次没有上游 Claude/Pi SDK 版本升级：本地仍为 Claude SDK `0.3.302`、Pi `1.1.0`。目标 package.json 改动主要是版本号与 shared 新 export；上游 lock 还调整了 `@keyv/bigmap` 的嵌套解析位置。不能把 lock 看作完全没有变化。

来源：[固定版本差异](https://github.com/craft-ai-agents/craft-agents-oss/compare/cede6ea49e0c4a42933ed0f1bc129db698fc581f...8df01c5d0ac73c35add5954e6f190ce038d35845)、[发布说明](https://github.com/craft-ai-agents/craft-agents-oss/releases/tag/v0.15.6)。

## §3 接收范围与产品行为

| 功能 | 本轮处理 | 用户能看到的结果 |
|---|---|---|
| 多 PR 卡片、固定/取消固定、复制链接 | 接收 | 同一编码会话查看多个 PR；明确区分当前分支 PR 与外部固定 PR |
| `pr_status / pr_bind / pr_unbind / pr_set_auto_merge` | 接收并贯通 U-API/Pi | 编码会话可直接读取和管理 PR；普通会话不增加这些工具 |
| 自动修复审查意见 | 接收、默认关闭，按会话/当前分支 PR 开启 | 开启后每 5 分钟检查；有合格的新意见才启动推理；关闭后不再启动新修复 |
| GitHub 自动合并 | 接收上游开关及原因提示 | 只在用户指定 PR 并要求启用时变更 GitHub 状态；不开启仓库级设置、不绕过保护 |
| 仓库发现 | 接收 | 支持嵌套代码目录和 `~/...` 路径；目录扫描不创建工作树 |
| 切换 Coding 模式 | 接收 | 先打开新会话，后台生成旧会话摘要；首次发送最多等待 30 秒 |
| Claude 构造参数透传修复 | 接收底层修复 | 保持底层一致性，不据此宣传 U-API 的长上下文问题已解决 |
| MCP `oauthRelay: false` | 接收可选配置 | 指定 MCP Source 可直接使用回调地址；默认行为不变 |
| 新文案、样式与发布说明 | 接收并中文化 | PR 自动修复/合并、固定状态和提示有完整中文；减少动效设置继续有效 |

继续保留：U-API 唯一 LLM 入口、Token 自动发现模型、多连接、既有模型选择与 maxTokens 规则、普通会话生图、数据目录隔离、手动下载兜底、已有中文修订。

继续关闭：独立 Decision 模型、公开会话分享、Pages 发布/脚本/定时刷新、未开放的模型提供商入口。Coding 默认仍关闭；已有会话不因升级自动转为 Coding。浏览器工具与后台代理沿用现有默认和用户设置。

不扩大到 Intel macOS、Linux、网站改版、新 OAuth relay 服务或新收费能力。平台交付范围沿用当前 macOS arm64 与 Windows x64。

## §4 关键适配与具体落点

### §4.1 先补齐 shared 导出、协议与新文件包名

新增 `packages/shared/src/pr-watch/` 承载 renderer 与 server 共用规则；新 `packages/server-core/src/pr-watch/` 承载操作和自动修复。它们与协议、RPC、工具不能拆成互不兼容的半套。

- 在 `packages/shared/package.json:exports` 接收 `./pr-watch`，同时保留本地 `./utils/files` 等既有导出。
- 新文件及新增 import 使用 `@u-agents/*`；新增文件不会自动继承旧文件的包名替换。
- 共同合入 `protocol/channels.ts、dto.ts、events.ts、pr-watch.ts、routing.ts`，Electron `shared/types.ts、transport/channel-map.ts` 与 RPC 的 `HANDLED_CHANNELS`。
- `GET_DETAILS` 从仅 sessionId 变为同时需要 prId；界面、hook、server 和测试夹具必须一起迁移。不能让多 PR 切换后详情仍显示上一个 PR。
- `PrWatchSessionState` 是会话级聚合，单 PR 的 `PrWatchState` 仍供选中卡片展示；按目标类型迁移，不把所有旧类型名盲目替换。

验收：新 export 可被实际构建解析；RPC 注册与 transport 对照测试通过；同会话两个 PR 的状态、详情和动作始终对应当前选择。

### §4.2 PR 工具要实际走通 Pi，并保住生图隔离

本地 `packages/shared/src/agent/backend/factory.ts:providerTypeToAgentProvider` 明确把 `pi_compat` 映射到 `PiAgent`。因此 U-API 用户即使选择 Claude 模型，也不等于走上游原生 ClaudeAgent。

贯通以下调用链，注册、权限分类和执行过滤分别验证：

```text
session-tools-core/tool-defs
  → Pi getSessionToolProxyDefs（有效 profile）
  → 实际 pre_tool_use_request（模式权限检查）
  → handleToolExecuteRequest / routeToolCall
  → executeSessionTool（当前有效工具集合）
  → handlers/pr-tools
  → session-self-management-bindings 的动态 getter
  → session-scoped-tool-callback-registry
  → SessionManager.buildPrWatchToolCallbacks
  → pr-watch/operations
  → registry / GitHub
```

- 接收 `CODING_ONLY_TOOLS` 与 Coding 白名单；`pr_status` 只读，其余三个保留非只读及 Explore 阻断元数据。普通会话、mini/标题/摘要任务不能因缓存或复用获得新的 PR 写入能力。
- 保留 `session-scoped-tools.ts:getSessionScopedTools` 的 full/mini、profile、workspace、付费 owner 等缓存身份，以及“缓存工具数组、每次创建新 wrapper”的行为。
- 新增 PR callback 合并到现有注册链，不能整份替换而丢掉 Source、Pages 或生图 callback；重建与销毁后不复用旧 session/owner。
- 保留普通 full 会话的 `generate_image`；Coding、mini 和内部唤醒仍不能获得生图执行资格。工具列表与主进程执行校验两层都要回归。
- Pi 的 `pinCreatedPr` 按 §4.2.2 关联命令与成功 Bash 结果；拒绝失败结果、`--web` compare 链接和无法验证的 PR。固定失败不应把已成功的代码任务改成失败。
- PR 凭据留在服务端，来自对应 Source/gh 凭据链；不能把 U-API Token 当 GitHub Token，也不能把任何 Token 放进工具结果或日志。

上游 ClaudeAgent 的构造函数改为透传完整 BackendConfig；接收这个修复时保留本地 `paidImageTool` 和 full/mini/profile 调用参数。它属于回归保护，不应被计为 Pi 长上下文、压缩或大图片已修复的证据。

#### §4.2.1 R1：统一 Pi 注册与执行的有效条件

当前 `PiAgent` 注册工具时传入 profile、来源和项目条件，但 `executeSessionTool` 的本地执行 registry 只传 full/mini 等字段。接收 v0.15.6 的 `CODING_ONLY_TOOLS` 后，缺少 profile 的执行 registry 会把四个新 PR 工具全部过滤掉。**这次必须修改执行入口，保留旧 gate 的目的不能理解成逐字保留旧参数。**

本轮采用以下组织方式：

1. 在 `PiAgent` 内集中生成有效 `SessionToolProfileOptions`：`agentKind`、`profile`、`hasEnabledSources`、`hasProject`。来源使用 `sourceManager.getIntendedSlugs()`，项目使用当前会话状态；未指定 profile 归一为 default。
2. subprocess 注册把这组条件交给 `getSessionToolProxyDefs`；`executeSessionTool` 每次重新派生当前条件，传入 `getSessionToolRegistry`，并使用与 proxy helper 同源的 developerFeedback、browser、decide 开关及 `surface: pi`。不能缓存启动时的一份 profile 后一直复用。
3. 四个 PR 工具仅向 full Coding 提供；在 canonical 工具定义中补 `availability.agentKinds: ['full']` 并保留 Coding-only 过滤。普通会话、mini/标题/摘要不获得这四个工具。
4. 保留执行 registry 的最终拒绝、handler 校验和生图主机来源检查；工具因 profile、来源、项目或功能设置变化而失效时，即使 subprocess 尚有旧注册也拒绝。不得改成不经筛选的全量 registry，或为所有调用写死 Coding。
5. 现有 `call_llm / spawn_session / browser_tool` 专用路径保持各自检查；本次不以“共用 registry”为由删除它们的校验或改变普通会话能力。

**验收。** 使用真实 Pi 请求路由、执行 gate、SessionManager callback 和 mock GitHub，分别验证四个 PR 工具；将权限允许与执行成功分开断言。另覆盖普通/mini 拒绝、来源/项目条件变化、旧注册重放和原生图隔离。只跑 core handler、schema 或 helper 单测不能通过 G4。

#### §4.2.2 R3：从 Pi start/end 事件关联命令

当前 `BaseEventAdapter.createToolResult` 不提供 input，Pi 的结束事件也没有把 start 的命令补回；不能直接接收上游新 hook 对 `agentEvent.input.command` 的读取假设。

本轮优先在 `PiAgent.handleSessionEvent` 的适配事件边界维护轻量内存表，不修改公共 tool_result 的持久化格式：

- 在当前 Coding agent 收到规范化的 Bash `tool_start` 时，记录 `toolUseId → command`，并归属当前 agent/subprocess 生命周期。只保留本功能需要的字符串，不复用会在 end 之前删除的 `preToolMetadataByCallId`。
- 收到对应 `tool_result` 后按同一 ID 取出并立即删除，再对成功 Bash 结果调用 `pinCreatedPr(command, result)`。结果没有对应 start、失败、非 Coding 或生命周期已失效时不绑定；未知命令不能从输出或别的调用猜测。
- 完成/失败消费对应记录；中止、重新开始、子进程替换及 agent 销毁清理剩余记录并使旧回调失效。交错调用不能串命令；旧 subprocess 的晚到结果不能消费新生命周期的同名 ID。
- 保留 URL 验证、verify-before-persist 和当前分支 PR 的去重逻辑；缓存不写日志或会话文件，不为这个功能放宽 Bash 权限。
- `backend/pi/event-adapter.ts` 与 `backend/base-event-adapter.ts` 是事件形状复核点；本轮修复首选落在 PiAgent，不要求同时重写两个 adapter。

**验收。** 输入实际形状的 start/end 事件，经真实 adapter 与 `handleSessionEvent` 到绑定 callback。至少一个正例使用从其他分支创建的 PR，避免当前分支 watcher 掩盖 hook 失效；绑定恰好一次。负例覆盖交错调用、失败、普通模式、gh pr view、--web、无法验证的 URL、重复 end、中止和销毁后晚到结果。直接调用 `pinCreatedPr('gh pr create', url)` 只能算辅助函数测试，不能通过 G5。

#### §4.2.3 R4：运行中同步项目、来源与工具集合

本轮采用 host 实时状态加命名空间替换，保持活跃 agent，不为元数据变化重建 host agent 或更换生图 owner：

1. BackendConfig 增加 host-only 的项目状态 getter；SessionManager 注入读取当前 managed.projectId 的闭包。UI 绑定和外部元数据更新共同通过 managed 状态生效，不再依赖创建时的 sessionConfig 快照。其他未提供 getter 的调用方仍兼容 session.projectId。
2. Pi 在下一轮 prompt 前重算并同步 session 工具；setSourceServers 更新后也同步可见集合。执行 gate 每次按当前状态计算，撤销能力不等待下一轮。工具变化本身不发起模型请求。
3. register_tools 增加可选 scope：session 或 sources；带 scope 的消息仅替换该 scope 的集合，允许空数组真正移除该组旧工具。未带 scope 的旧调用继续保留 merge 语义，避免破坏兼容入口。
4. session 与 sources 分组持有，按名称去重后构建下一轮工具集；sources 不得覆盖保留的 session 名称。空 sources 也要发送，避免已移除工具残留。沿用 toolsChanged 在下一轮重新建立 Pi SDK session 的边界，不中断正在生成的回合。
5. 测试同一个存活 agent：无项目/来源→绑定/启用→下一轮可见→解绑/停用→下一轮移除且旧调用立即拒绝；切换项目后主机动作使用新项目。两组交替更新不得相互删除或复活工具，既有 paid owner 不轮换。

实施落点：SessionManager 的 backend 配置、BackendConfig、PiAgent 的 profile/注册/执行、pi-agent-server 的消息类型与 handleRegisterTools，以及对应集成用例。协议类型、兼容 merge、scope 替换与空集合均需验证，不以比较 helper 的两个数组代替 host→子进程链路。

### §4.3 自动修复：默认关闭，并修正网络等待期间的状态变化

上游 `auto-fix.ts:createAutoFixMonitor/evaluate` 已实现 5 分钟间隔、同会话串行、可信作者过滤、相同反馈去重、仅当前分支 PR、忙碌/Explore/冲突时跳过、重启后恢复显式开启状态。这些行为均保留。

**本轮静态确认的缺口 A1：** `evaluate` 在等待 `fetchReviewSignature` 前读取 session 与 monitors，网络返回后直接尝试唤醒；`wakeIdleSessionWithNotice` 只检查会话存在和忙碌。期间关闭 Auto、切换到 Explore、归档或更换工作目录，旧检查结果仍可能继续进入唤醒路径。此判断来自代码顺序，尚未运行复现。

实施要求：

1. 在真正唤醒前，重新读取会话与对应 PR 开关，确认仍是 Coding、未归档、空闲、非 Explore，且 monitor/registry 实例仍有效。
2. 确认目录和当前分支 PR 仍与本次检查一致；关闭开关、解绑、切换目标或 dispose 后的旧异步结果作废。不得根据旧快照在新目录执行。
3. 沿现有会话串行/忙碌控制启动一次；没有成功接受唤醒，不记录为已执行。具体并发保护复用现有机制，不另造任务系统。
4. 用可延迟的 GitHub mock 覆盖“请求发出 → 关闭/归档/切 Explore/换目录/重建 registry → 返回”这些时序，断言没有新增 `sendMessage` 或 LLM 请求。
5. 开关提示以简短中文说明“开启后会自动运行并消耗 Token”；不增加重复确认流程。只有用户明确开启的状态才可在重启后恢复。
6. `mapReviewSignature` 保留 OWNER/MEMBER/COLLABORATOR 过滤、忽略本人和已解决评论；评论正文、标题、链接都是外部数据，不构成命令授权。
7. 自动修复提示保留“仅本地修复，不自动 push、发 GitHub 回复或解决讨论”；自动修复不等于自动合并授权。

新增的 hidden turn 经 `SessionManager.sendMessage` 运行：必须继续作为内部来源，不能继承前一轮的付费生图 nonce/lease。测试用 mock 证明零 Images POST；不能用真实扣费尝试来验证拒绝是否生效。

若 A1 尚未修复或对应时序用例未通过，不能把 Auto 开关作为已验收能力交付；允许交付注明限制的测试候选，但正式可用结论保持 HOLD。

### §4.4 多 PR 与自动合并的边界

- `operations.bind` 验证 PR 可访问后再保存；重复固定按 host/owner/repo/number 去重；取消固定不关闭 GitHub PR。
- 查看其他会话的 `pr_status` 保留上游 cache-only 语义，不因读取状态启动另一个会话或额外模型调用。
- 手动修复外部固定 PR 时使用独立 checkout，当前会话目录不切分支；仅弹出卡片、读取状态或固定 PR 不创建工作树。
- 自动修复只作用于当前分支 PR，不能延伸到任意固定 PR。
- `setAutoMerge` 保留仓库允许的合并方法与阻断原因；不能把“仓库未开启自动合并”自动修成修改仓库设置，不能把草稿自动改 Ready。
- UI 直接点击和 Agent 工具分别验收。Explore 下模型写入工具受权限拦截；用户主动点击 UI 的行为按该动作的现有产品语义处理，不声称仅靠工具元数据就限制了所有 RPC。
- 升级测试先用 GitHub mock。真实 PR 的自动合并开关可能导致实际合并，需在已明确授权的测试 PR 上验证。

#### §4.4.1 R2：把 Explore 权限分类与工具展示分开

当前 `mode-manager.ts:shouldAllowToolInMode` 通过未传 profile 的 `getSessionSafeAllowedToolNames` 分类；该 helper 会经过默认展示过滤。新版默认隐藏 PR 工具后，只读 pr_status 也会误入写操作拒绝路径。

本轮选择**按工具名称查询 canonical 权限元数据**，不为权限检查硬塞 Coding profile：

1. 在 `shouldAllowToolInMode` 的 `mcp__session__` 分支规范化工具名，使用已导出的 `SESSION_TOOL_REGISTRY` 查定义，再按其 `safeMode` 判断 Explore 是否允许；未知名称拒绝，禁止按 `pr_*` 前缀放行。
2. 分类之前保留现有功能政策与开关约束，尤其关闭的 Decision 与 developerFeedback 不因这次读取原始定义而重新可用。普通会话既有只读工具继续按各自权限属性分类。
3. 这份 canonical registry 只用于权限分类；实际展示仍使用 `getSessionToolDefs` 等过滤视图，Pi 实际执行仍走 §4.2.1 的有效 registry，不能将原始 registry 用作执行清单。
4. 原有 filtered helper 继续表示其 options 对应的工具视图；不通过全局更改其默认 profile 来修一处调用。权限判断为“只读”本身不授予普通会话调用隐藏 PR 工具的能力。

**验收。** 先直接验证 `shouldAllowToolInMode`，再经过 Claude/Pi 实际前置权限入口验证：Coding/Explore 的 pr_status 放行，三个 PR 写工具拒绝；普通会话原有只读工具与被关闭的功能政策均符合原合同。普通会话的 stale PR 调用即使被分类为只读，也必须在有效性/执行层拒绝。元数据字段断言不能替代这些调用链证据。

### §4.5 模式切换、异步摘要与会话字段

重点定位 `SessionManager.continueSessionInNewSession / attachHandoffSummary / waitForHandoffSummary`、`conversation-summary.ts`、`sessions/types.ts:SESSION_PERSISTENT_FIELDS`。

- 新会话即时返回，摘要后台生成；首次消息只等待约定上限，不重新触发多次摘要。失败和超时可继续，不能卡住发送队列。
- 摘要仅作为一次历史上下文；测试及时返回、超时后晚到、摘要失败、目标会话已删除、用户取消或快速连续发送。晚到摘要不能覆盖用户新消息或重复注入。
- 新会话沿用所选 U-API 连接、模型、权限、Sources、项目和目录；不能复制原会话付费生图 owner/nonce。
- 新持久字段 `boundPrs / prMonitors` 完成保存、重启、DTO、导入/导出验证；旧记录缺失字段时为空且不开启 Auto。
- 继续会话/分支/导入不得把别的目录的监控自动启动；显式检查其字段复制策略，不能只验证 TypeScript 可编译。
- 摘要生成本身可能调用模型。本次离线验收替换模型调用；实际网关验收单独记录摘要请求，不能把“切换更快”误写为“零请求”。

### §4.6 MCP OAuth 与工作目录扫描

**MCP OAuth：** 接收 `config/validators.ts`、`sources/types.ts`、`SourceCredentialManager.prepareOAuthFlow` 的 `oauthRelay` 字段及透传。只有显式 false 才使用直接 callback；未设置沿用旧默认。回调 URL 与携带凭据的资源请求 URL 是两类地址，不能为了支持 loopback callback 放松资源请求的私网/重定向校验。保留同文件的 U-API SSRF 防护及刷新测试。此功能不代表已摆脱默认 OAuth relay，也不是新增 LLM 出口。

**仓库扫描：** 接收 `coding-repos.ts:workspaceFolders/listing` 与 `discover.ts:scanRoots/findRepoDirs`。上游设置一般深度 4、目录预算 20,000、扫描循环时间预算 2 秒；home/磁盘根目录只探一层，不跟随子目录符号链接，跳过 workspace 数据目录、node_modules 和 Library。

这里的 2 秒是扫描循环预算，不能保证慢磁盘上的单次读取或后续 git 查询也在 2 秒内结束。验收涵盖嵌套仓库、bare/worktree 去重、~ 展开、不可访问目录、符号链接循环和超大目录；观察到慢盘卡住才针对实际瓶颈修复，不预先扩大扫描范围。

### §4.7 必须逐项复核的 9 个带标记交叉文件

| 当前文件 | 合并时必须保住的内容 |
|---|---|
| `apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx` | 新 PR props/卡片接入与公开分享隐藏同时存在；桌面和紧凑布局均检查 |
| `packages/server-core/src/sessions/SessionManager.ts` | 新监控/摘要、callback 注入，与原生图生命周期、分享禁用、模型和内部来源规则共同成立 |
| `packages/session-tools-core/src/context.ts` | PR callback 类型加入时不扩大 generateImage 的输入/主机权限 |
| `packages/session-tools-core/src/index.ts` | 新 PR 类型/接口导出与既有生图合同导出同时保留 |
| `packages/session-tools-core/src/tool-defs.ts` | Coding-only、四个 PR 工具 full-only、现有生图与功能政策过滤共同生效 |
| `packages/session-tools-core/src/tool-defs-filtering.test.ts` | 原断言保留，新增 PR 场景；不能通过删除生图负例让测试变绿 |
| `packages/shared/src/agent/claude-agent.ts` | 完整 config 透传，同时保留本地工具身份参数和付费 owner |
| `packages/shared/src/agent/pi-agent.ts` | R1 注册/执行有效条件一致；R3 start/end 命令关联与生命周期清理；原工具权限/付费执行阻断继续生效 |
| `packages/shared/src/sources/credential-manager.ts` | 直接 callback 配置与凭据请求地址/重定向保护分别验证 |

这 9 个文件不是全部定制。未被上游改动的 `storage.ts`、`u-api-model-discovery.ts`、`handlers/rpc/llm-connections.ts`、`session-scoped-tools.ts`、`session-settings.ts` 和 `u-agents-feature-policy.ts` 仍作为集成回归检查点。

r2 另将未被上游改动的 `agent/mode-manager.ts` 列为 R2 必须适配文件，并复核 Pi/base event adapter 的事件形状。新增联动任务不改变上游原始差异的 93/57/9 统计；候选实际修改文件和 marker 增减在实施后另行对账。

## §5 依赖、中文与构建适配

### §5.1 依赖保持可复现

- 保留当前 `@u-agents/*` 包名、24 项 root overrides、Electron `^39.8.10`、固定 `@types/bun 1.4.2`、Bun runner/包内运行时 `1.3.12` 与现有 Python/uv 文档转换。
- 不借本次升级更新全部依赖、移除 overrides 或更换 npm/yarn/pnpm。依赖调整以本次实际需要为限。
- lock 在候选中增量协调，记录确实变化的解析项；不能整份覆盖本地 lock 后只看 install 成功。
- 候选最终必须可在干净环境 `bun install --frozen-lockfile`，且不再改动 lock。
- `packages/shared/package.json` 的新增 export 必须通过真实 Electron 与 server 构建验证，类型检查不能替代打包解析。

### §5.2 中文与发布说明

上游七种 locale 各新增 **22 个 key**、修改 **1 个旧 key 的值**。已逐项对照 en/zh-Hans：新增中文键中 **14 项值与英文完全相同**，包括自动修复 7 项、固定 PR 的动作提示、取消固定两项，以及自动合并标签/三种方法名。

- 把完整句子与用户动作翻成自然中文；方法名可写“合并提交 / 压缩合并 / 变基合并”，必要时保留括号内英文标识符。
- 保持 `{{age}} / {{count}} / {{number}}` 等占位符原样。修正 `chat.codingMode.repos.workspace` 的新含义，不只检查 key 是否存在。
- 保留本地 U-API、Token 空值提示、连接错误脱敏、Chat Starters、分享隐藏、生图与手动下载相关文案。
- 三项检查均须通过：parity、sorted、coverage；它们无法证明翻译质量，仍需实际 UI 核对。
- 新增 `apps/electron/resources/release-notes/0.15.6.md` 全文中文化、品牌改为 U Agents、去掉 commit hash 与上游 issue 外链，按实际开放功能撰写。
- 日志不宣称原生 Claude 修复已经解决 U-API/Pi 长上下文或真实生图问题；`next.md` 只按其用途处理，不把待发占位说明当正式日志。
- PR 修复提示已移到 shared 的 `pr-watch/rules.ts`，同步检查用户可见的固定操作文本、系统来源品牌及旧 renderer re-export，不能只扫描 locale。

### §5.3 双平台流水线

现有 `.github/workflows/windows-candidate.yml` 和 `macos-candidate.yml` 仍硬编码 `codex/upstream-v0.15.5`、artifact 名及 BUILD.txt 的版本；这些文件不在上游 93 文件里，却必须随本次候选调整。

1. 候选触发分支改为本次分支；版本从实际 package.json 读取或在本轮一致改为 0.15.6。BUILD.txt 里的“真实生图未跑”必须反映本轮证据，不复制旧 Token 状态。
2. 两平台构建同一最终 commit，保留 `contents: read`、checkout 不留 Git 凭据、只读依赖下载 Token 与不自动发布。
3. 保留双 CONFIG_DIR、独立 CLAUDE_CONFIG_DIR 在任何 Bun/preload 之前注入的顺序。`validate.yml` 当前没有同样的准备步骤；候选验证入口应补齐隔离设置。
4. 沿用实际存在的 `build-dmg.sh arm64`、`build-win.ps1` 与 `.github/scripts/verify-packaged-runtime.ts`。不使用 `--upload / --latest`，确认 builder 保持 `--publish never`。
5. 不直接使用 root 的 `check-version` 或 `release` 脚本：当前 scripts/check-version.ts、scripts/release.ts 不存在。版本核对应读取实际包清单；本轮不为修复这些旧入口扩范围。
6. 保留 arm64/macOS、x64/Windows 策略。历史 macOS ad hoc/未公证、Windows 未签名只是旧候选事实，新包如沿用需如实标明。

## §6 执行顺序与每阶段产物

以下供后续得到执行授权的会话使用，当前没有执行。若用户的下一次明确授权已覆盖相关代码和写命令，不重复要求同一范围的确认；仍遵守未包含的发布/远端写入边界。

| 阶段 | 工作 | 完成后留下什么 |
|---|---|---|
| W0 冻结输入 | 复核 O/B/T、远端 main、tracked 和未跟踪状态；读取本方案 | 基线 SHA、原工作区状态、目标 tag 证明 |
| W1 隔离候选 | 优先创建 Codex 管理的工作树，命名候选分支；建立隔离测试配置；fetch 目标 tag 并核对 SHA | 候选绝对路径、分支、隔离入口、保护检查结果 |
| W2 合入目标 | 只合固定 T；记录真实冲突；逐项迁移 §4、§5 | 冲突/处置表、9 文件审查表及 R2 联动文件、依赖差异、A1/R1–R3 实施与用例 |
| W3 自动验收 | 先重点用例，再完整验证、lint、locale/品牌/标记检查 | 命令、退出码、测试数量、失败分类、最终候选 commit |
| W4 双平台测试包 | 在已授权远端 CI 范围内推送/触发构建；否则先完成本地可交付部分 | 同提交两平台包、BUILD、摘要、包内运行报告、GUI 证据 |
| W5 真实流程与发布判断 | 按当次授权做真实网关、测试 PR、升级/回退和更新验证 | 完整通过/未跑/阻塞清单；主线合并和正式发布分别结论 |

合并策略是逐块保留两边有效意图。禁止用“全部 ours”留下旧功能，也禁止“全部 theirs”覆盖 U-API、品牌和隔离逻辑。没有文本冲突的 57 个交叉路径仍做语义核对。

本次上游没有直接修改 CLAUDE.md §3.3 的七类文件。若执行中确实需要修改这些高冲突入口，先写清具体差异并检查当次授权覆盖范围；不要为了预防未知冲突事先改它们。

### §6.1 测试隔离必须先于 Bun

当前 `bunfig.toml` 会 preload `unified-network-interceptor.ts`，不能启动 Bun 后再设置测试根。用原生 shell/系统入口先完成：

- 新建候选专用的配置和工作区目录；`U_AGENTS_CONFIG_DIR` 与兼容 `CRAFT_CONFIG_DIR` 指向同一合成根，`CLAUDE_CONFIG_DIR` 单独隔离。**HOME 保持原值**。
- 使用合成配置、假 Token、模拟 GitHub/网关；不复制正式凭据，不把实际个人配置作为夹具。
- 确认候选应用及其子进程继承隔离入口。通过 Finder/open 或自动化工具重新启动时，若环境不能保证，改用固定隔离 launcher；不能继续操作可能已复用正式实例的窗口。
- 验证 config、credentials、workspace 的实际解析路径；保护正式 profile 不被候选读写。网络检查覆盖系统 HTTP/SOCKS 代理，不能只认为“禁止外网域名”就一定断网。
- 依赖下载/构建资产与业务请求分开控制。测试 PR 与模型请求默认模拟；放行依赖下载不等于授权真实聊天、自动修复或生图。
- 基线测试、单测、preload smoke、打包 smoke 和 GUI 都使用同一隔离约定；任何一步无法确认则先修隔离，不触碰正式 profile。

此前 v0.15.5 曾出现正式配置隔离事故，后续修订已补专用入口；见 [GUI 修订记录](UPGRADE-GUI-FIX-v0.15.5-20261023.md)。本次复用方法前检查入口和证据是否仍存在，不能把 /tmp 历史文件当作一定可用。

### §6.2 候选检查命令

下面命令仅在已准备好隔离环境的候选根目录执行；本轮未运行：

```bash
bun install --frozen-lockfile
bun run validate:ci
bun run lint
bun run test
```

`bun run test` 当前包含默认 bun test 与逐个 isolated 入口。全量测试安排在构建前，避免 release/dist 中的源码副本被再次扫描；构建后如需重测，用显式测试路径或已核实的排除清单。失败先区分真实回归、上游问题和隔离/环境问题，不以旧版通过数量覆盖本轮结果，也不通过扩大超时或删除用例掩盖原因。

重点新增/变化测试路径：

- `packages/server-core/src/pr-watch/{auto-fix,operations}.test.ts`
- `packages/server-core/src/services/pr-watch/{registry,map-github,github-client,pr-ref}.test.ts`
- `packages/shared/src/pr-watch/rules.test.ts`
- `packages/session-tools-core/src/handlers/pr-tools.test.ts` 与 `tool-defs-filtering.test.ts`
- `packages/shared/src/agent/__tests__/pin-created-pr.test.ts`、`backend/__tests__/factory.test.ts`
- `packages/server-core/src/sessions/handoff-summary.test.ts`
- `packages/server-core/src/services/coding-repos/coding-repos.test.ts`
- `packages/shared/src/sources/__tests__/oauth-relay.test.ts`

针对本轮评审，定向验收还必须包含以下三条完整链路；使用合成配置和 mock GitHub，不真实运行 gh pr create 或修改 GitHub：

| 项目 | 必须经过的真实路径 | 模拟边界与关键断言 |
|---|---|---|
| R1 | Pi 注册 → `handleToolExecuteRequest / routeToolCall / executeSessionTool` → SessionManager callback | GitHub 返回模拟结果；四个工具实际到达 host；普通/mini 和失效注册拒绝；不可 mock 掉执行 registry |
| R2 | `shouldAllowToolInMode` → Claude/Pi 各自的 pre-tool-use 入口 | Coding/Explore 查询放行、三写拒绝；普通只读和关闭政策回归；不可直接伪造权限允许结果 |
| R3 | Pi start/end → 实际 event adapter → `handleSessionEvent` → PR 绑定 callback | 命令和输出为合成数据；非当前分支正例恰好绑定一次，交错/重复/中止/旧生命周期不误绑；不可跳过事件层直接调用辅助函数 |

R2 扩展现有 `packages/shared/src/agent/__tests__/session-tool-safe-mode-permissions.test.ts` 及前置权限用例；R1/R3 的集成回归放在 PiAgent 对应测试位置。若需新增测试文件，实施时在执行记录列出路径，不能把“上游同名测试通过”当成上述链路都已覆盖。

并运行本地既有 U-API 连接/模型刷新/maxTokens、付费生图生命周期、配置隔离、禁用功能及构建合同用例。新增测试应验证具体跨组件行为与时序，不只重复实现内部条件。

## §7 验收矩阵

以下全是本次执行后的要求；**当前状态均为 NOT_RUN**。不因旧版本证据或静态阅读改写成 PASS。

| 编号 | 场景 | 通过条件/证据 |
|---|---|---|
| G0 | 配置与网络隔离 | 父入口、子进程、GUI 的解析根一致；正式数据受保护；模拟网络可用，非授权业务请求被拒 |
| G1 | 固定版本与导出 | T 是候选祖先；包版本一致；@u-agents 新导出能在实际打包中解析；93 文件逐项有处置 |
| G2 | U-API 连接回归 | 首次空 Token 拒绝；已有凭据空值编辑关闭浮层且不改配置；同/换 Token、协议变化、第二连接、刷新晚到及 maxTokens 保存/重载均符合现行规则 |
| G3 | 工具与生图身份 | full 普通/Coding/mini、owner 轮换、会话销毁与缓存重建正确；内部 Auto 唤醒和摘要不会发 Images POST |
| G4 | PR 工具与动态同步（R1/R2/R4） | Coding full 四工具实际执行；Explore 查询放行、三写拒绝；普通/mini 与失效注册拒绝；同一活跃 agent 项目/来源增减后在下一轮真实工具集同步，session/sources 作用域互不覆盖，旧 merge 兼容 |
| G5 | 多 PR 交互与自动固定（R3） | branch+bound 去重、标签/详情/动作正确；真实 Pi start/end 事件使非当前分支 PR 恰好绑定一次；交错/重复/失败/中止/旧生命周期不误绑；取消固定仅改本地，读状态不改仓库 |
| G6 | 自动修复正常路径 | 默认关闭零推理；明确开启后可信新反馈触发一次；自己/陌生人/旧反馈/冲突/忙碌/Explore/归档不触发；重启恢复有明确状态 |
| G7 | A1 异步时序 | GitHub 请求悬挂期间关闭/归档/换目录/Explore/解绑/dispose，返回后零新唤醒；快速开关与并发通知不重复启动 |
| G8 | 自动合并 | UI、工具都走共享操作；阻断原因和方法正确；授权动作才发 mutation；不代改 repo 设置、不转 Ready、不直接 merge |
| G9 | 模式切换/会话数据 | 即时创建；摘要及时/失败/超时/晚到/取消正确；连接和权限保留；新字段持久化；旧会话不开 Auto |
| G10 | 仓库发现与 OAuth | 嵌套/~/bare/worktree/跳过目录/慢盘场景有结果；relay 默认/false 两路正确；资源凭据保护仍在 |
| G11 | 中文与政策 | 22 新 key、1 改值正确；无未处理的英文动作句；新菜单不恢复分享、Decision、Pages 发布或外部模型入口 |
| G12 | 工具链 | validate:ci、lint、全量及 isolated 用例通过；新增 warning/skip 逐项解释；239/9/9 的变化逐文件对账 |
| G13 | 包内运行时 | 同 commit 两平台；仓库外使用包内 Bun/Pi/SDK、Photon、QuickJS 和 uv；loopback 对话/图片输入/输出上限可运行 |
| G14 | 桌面实际流程 | 两平台分别启动、新建/重开聊天、附件、设置、Coding/多 PR、权限提示；截图/日志与包摘要对应 |
| G15 | 真实使用 | 获当次授权后，用实际 U-API 完成桌面对话→工具→结果；记录主/辅助/摘要请求数；测试 PR 使用限定仓库 |
| G16 | 升级和回退 | 合成 0.15.5 数据副本升级到候选，核对会话/凭据/目录/设置；再从快照恢复并运行旧包，能正常继续 |

G15 中的真实生图需要模型目录满足现有合同并取得相应测试范围；没有可用模型则记 NOT_RUN，不通过猜 ID 或手工补能力字段绕过。普通聊天支持图片输入与支持生图分开验。

自动合并/自动修复的真实外部动作没有授权时，mock 可以证明实现链路，但不能写“真实 GitHub 场景已验收”。未完成完整真实流程可交付清楚标注的测试包，正式发布结论保持 HOLD。

## §8 安装包与交付资料

先完成本地适配和检查，再在同一最终候选 SHA 上做两平台构建。后续修改了产品代码或打包输入，两平台产物需重新对应新 SHA；纯验收文档变化另行记录，不混淆来源。

| 平台 | 应交付资源 | 必验项目 |
|---|---|---|
| macOS arm64 | DMG、ZIP、两份 blockmap、latest-mac.yml | 架构、签名状态、DMG/ZIP 完整性、相同应用载荷、原入口安装启动 |
| Windows x64 | EXE、blockmap、latest.yml | 临时目录安装、包内资源、runtime smoke、实际 GUI 与退出/重开 |

共同附带：BUILD.txt（commit/版本/平台/运行链接/签名状态/未验项）、SHA256SUMS.txt、RUNTIME-CHECK.json、验收记录。不能用“CI 构建成功”代替 GUI 验收，也不能把隔离改造副本的 GUI 结果当成原安装包入口已通过。

包内检查沿用 `.github/scripts/verify-packaged-runtime.ts`：Bun 1.3.12、preload、Pi loopback 请求、Photon 图片、QuickJS WASM、uv。另保留 PDF/HEIC/Office 附件检查；缓存条件下 Office 转换通过不等于首次冷安装和文档查看器通过。

正式发布前要核对完整更新元数据。当前 `scripts/build/common.ts` 生成的简版 manifest 只有 version，不能直接当作 `packages/shared/src/version/manifest.ts` 所需的完整结构；以最终包、hash、size、架构和下载 URL 生成并校验。原工作区未跟踪的 manifest.json 不能被当作本轮产物覆盖。

## §9 回滚与发布边界

### §9.1 候选阶段回退

主 checkout 与正式应用数据不参与候选运行。合并失败时只在候选里终止合并/修复；在再次操作前确认其无用户新增工作。需要放弃候选时先保留差异、日志和包，再归档管理工作树，不删除原有未跟踪文件。

对合成数据保留升级前快照，测试“旧数据→新包→恢复快照→旧包”。v0.15.6 新增持久化 PR 字段；旧包可能忽略或重写这些字段，不能把“旧包能启动”当成降级无损证明。恢复必须使用完整备份，不能让旧包直接改唯一的新数据副本。

### §9.2 合入主线与对外发布

源码候选通过后，按当次授权准备 PR/合并；主线合并、GitHub Release、更新服务器 latest 切换分别记录。没有发布授权时，先把包、元数据和差异做成可审阅交付物，再交用户决定。

发布时先上传并校验固定版本资源，再更新 latest 指针；先验下载状态、大小/hash和实际更新，再宣布完成。既有 0.15.5 安装包和元数据保留。

回退 latest 只影响后续更新获取，通常不能让已经升级的客户端自动降级。已升级用户的回退需要旧安装包及其升级前数据备份；如果 v0.15.6 已运行真实工作，要先保存新增数据并评估兼容性，不能直接覆盖。

## §10 历史验收与当前未知项

已读 v0.15.5 的 [GUI 修订](UPGRADE-GUI-FIX-v0.15.5-20261023.md)、[双平台构建](UPGRADE-GITHUB-BUILD-v0.15.5-20261023.md)、[真实 U-API 验收](UPGRADE-REAL-UAPI-v0.15.5-20261023.md)。它们证明当时的限定场景，不自动覆盖本次候选。

- 历史有双平台包内运行及 macOS 隔离 GUI 证据；不等于本次 0.15.6 的平台验证通过。
- 当时包内 Pi 单次真实文本推理通过；真实生图因 Token 无对应模型未发送，完整 GUI 多轮工具、长上下文等未由该记录证明。
- 历史文档中“未合主线”的阶段描述已被当前 main 历史超越；正式线上版本、当前安装包及真实 Token 权限本轮未检查。
- 实际合并冲突、A1/R1–R3 实施后行为、最终 marker 数、各平台运行、真实 PR/模型流程、升级回退均待执行。

执行过程中发现新的事实，应在本次执行记录中更新，不能回写旧报告以制造完整历史。

## §11 执行完成后的文档收口

只更新本次确实受影响的内容：

1. 本方案加最终候选 SHA 与执行记录链接；文件清单补实际冲突和处理结果。
2. 新建 `.planning/UPGRADE-EXECUTION-v0.15.6-YYYYMMDD.md`，记录阶段、命令、测试、包和明确的未验项；日期使用实际执行日。
3. 改造点逐文件核对后，更新 §14 的权威基线和新增改造点，特别是 A1、R1/R2 的过滤与权限分类、R3 事件关联及工具/内部来源边界。超过旧基线 ±2 先解释增减，不为了凑数删标记。
4. 对确实改变的品牌/中文/构建规则更新对应规格；网关行为未变就不重写整份网关规格。
5. 合并、发布发生后再补同步/发行记录；没有运行的检查始终保留 NOT_RUN。

## §12 可交给执行会话的任务说明

> 在当前 main 的独立管理工作树中，按本方案 r2 升级 U Agents 到固定上游 v0.15.6（8df01c5d0ac73c35add5954e6f190ce038d35845）。先复核主线基线和原工作区状态，保留未跟踪文件，使用隔离配置；不要启动会读写正式 profile 的候选实例。逐项完成共享 PR 模块、Pi 工具链、多 PR/自动合并、自动修复 A1 时序修正、异步摘要、OAuth 配置、中文和流水线适配。必须落实 R1 注册/执行同源过滤、R2 Explore 按元数据分类、R3 start/end 命令关联，并以 §6.2 的实际调用链验收，保住全部 U-API 定制。完成对应检查并提交可审阅的候选差异、同版本测试包和证据。实际可执行的代码、远端 CI、真实计费请求、PR 写入、主线合并与发布范围，以用户当次明确指令为准；本段是任务模板，不能自行当成新授权。
