# v0.15.5 升级方案评审

> 日期：2026-10-22。对象：[升级方案](UPGRADE-PLAN-v0.15.5-20261022.md)。
> 本地仍为 `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`；上游固定为 `cede6ea49e0c4a42933ed0f1bc129db698fc581f`，不改变升级目标。
> 原评审轮次只核对源码和方案，新增本评审记录；当时原方案保持不变。未 merge、安装、构建、启动应用、运行业务测试或请求真实网关。下文是**方案缺口**，不代表现有产品已复现越权、扣费或数据损坏。
> 修订跟踪：用户随后明确要求按 R1–R4 修订，主方案现为 **r2**。§1–§3 保留 r1 评审原始结论及当时行号；r2 文档处置见 §4，第二轮复核见 §5。文档闭环不等于代码已实现或验收通过。

## 1. 结论

**建议补齐 4 项后再进入实施：2 项 P1、2 项 P2。** 独立候选、固定 v0.15.5、保住 U-API 边界、先 macOS 后 Windows 的总体路线可以保留。

P1 涉及运行隔离和付费工具包装器身份，应在实施前写明设计与验收；P2 应补进本轮具体任务和回归，不能留给解冲突时临时猜测。没有发现需要放弃 v0.15.5 或改为连续发布 7 个中间版本的依据。

| 编号 | 级别 | 需要补齐的内容 | 原方案定位 |
|---|---|---|---|
| R1 | P1 | 测试隔离必须在 Bun/preload 启动前生效 | W3，128 行；统一验证命令，165 行 |
| R2 | P1 | 缓存身份必须同时包含原有 owner/full-mini 与新 profile 条件 | §3.2，62–67 行；G3，154 行 |
| R3 | P2 | 新增防串运行时逻辑需适配 U_AGENTS_* | §4.3，113–118 行；G10，161 行 |
| R4 | P2 | maxTokens 保留还要覆盖“编辑 Token → 测试 → 保存”的重建链路 | §3.1，53–55 行；G2，153 行 |

## 2. 逐项发现

### R1 — [P1] 把测试隔离提前到任何 Bun 进程启动之前

**问题。** W2 只说目录隔离在“首次启动”前到位，W3 给出了定向/完整测试步骤，W4 才展开运行副本隔离。方案没有规定测试/构建子进程也必须先隔离，更没有规定 preload 之前的环境设置顺序。独立 Git worktree 只隔离源码，不能隔离配置、凭据、日志或网络。

**代码证据。**

- [bunfig.toml](../bunfig.toml) 第 1 行自动 preload `unified-network-interceptor.ts`，早于测试文件主体执行；没有统一测试隔离 preload。
- [interceptor-common.ts](../packages/shared/src/interceptor-common.ts) 35–48 行在模块加载时确定配置/日志根；223–228 行会从这个根读取 config.json。
- [config/paths.ts](../packages/shared/src/config/paths.ts) 39–44 行也在模块加载时固定 `CONFIG_DIR`；[package.json](../package.json) 44 行的统一 test 入口没有设隔离环境。
- 上次 [v0.14 实施记录](UPGRADE-EXECUTION-v0.14.0.md) 58 行明确使用进程沙箱限制真实目录及外发。本轮不能仅继承它的测试命令而漏掉运行条件。

**影响。** 执行者即使在某个测试的 beforeAll 中才设置测试根，preload 也可能已捕获正式配置根。这里确认的是隔离合同不足；没有执行测试验证真实文件已被访问。

**建议修订。** 在 W0/W3 之间增加全流程测试环境前置项：每个 Bun 进程启动前，`U_AGENTS_CONFIG_DIR` 与兼容的 `CRAFT_CONFIG_DIR` 都指向明确的一次性合成根；拒绝落回正式目录，并限制进程访问真实配置/凭据/workspace 和非测试网络。该要求覆盖定向测试、统一 test、isolated 子进程和包内 smoke，不只覆盖桌面启动。不要改全局 HOME，也不要要求为合成测试退出用户正在使用的应用。

**新增验收。** 首个进程的 preload、应用配置和凭据后端均解析到测试根；缺少/冲突的隔离参数在执行测试前失败；正式目录不产生读写，外发 mock 无意外请求。不能以测试代码中后置赋值或“临时目录已经建好”作为通过证据。

### R2 — [P1] 明确两套工具缓存键的组合合同

**问题。** §3.2 已要求保住 owner 和 full/mini 边界，但只把具体保留点落在 SessionManager/callback；没有规定与上游新工具缓存键怎样合并。两边同时改了 factory 的第 4 个参数和 cacheKey，属于需要预先决定的接缝。

**代码证据。**

- 本地 [session-scoped-tools.ts](../packages/shared/src/agent/session-scoped-tools.ts) 220–232 行，第 4 个参数是 `agentKind/paidImageTool`，key 含 `sessionId + workspaceRootPath + agentKind + ownerToken`。生成的 handler 闭包会捕获该 owner。
- [上游同一函数](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/shared/src/agent/session-scoped-tools.ts#L222) 的第 4 个参数改为 `profileOptions`；230–232 行 Coding key 含 profile、hasEnabledSources、hasProject，但没有本地 agentKind/owner。
- [上游 Claude 调用点](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/shared/src/agent/claude-agent.ts#L1196) 同样改用第 4 个参数传 profile。

**影响。** 只保旧 key，会使同一会话不同 profile/来源条件复用错误工具集合；只保上游 key，会让不同 owner/full-mini 包装器共享缓存，可能继续携带旧 owner 的闭包。后端拒绝旧 owner 可以阻止执行，但不能代替正确的工具可见性和缓存隔离。这里没有声称已发生收费请求重放。

**建议修订。** 规定统一 options 与调用点迁移，cache 身份至少同时包含两边的有效条件；保留不同 owner/agentKind 的隔离，并把 Coding 的 profile/hasEnabledSources/hasProject 纳入有效 key。释放缓存和新建 wrapper 也按此合同处理，不能仅要求“现有 marker 仍在”。

**新增验收。** 同一 session/workspace 依次创建 full/mini、普通/Coding、owner A/B、来源/项目条件变化的工具集合；证明集合不串、wrapper 不捕获旧 owner、mini/Coding 不出现 generate_image，合法普通 full 可正常调用。至少一项直接走 factory/cache，不能全由 callback registry 单测代替。

### R3 — [P2] 新增防串包模块不能只认识 CRAFT_* 环境变量

**问题。** 方案关注了包内资源是否齐全，却未把新增的“忽略其他安装目录的继承运行时”纳入 U Agents 适配。旧版 U Agents 启动的 shell 会继承自己的运行时地址，不能仅靠在新工作目录执行命令保证使用候选。

**代码证据。**

- 本地 [Electron main](../apps/electron/src/main/index.ts) 151–160 行输出 `U_AGENTS_IS_PACKAGED/RESOURCES_BASE/APP_ROOT/UV/BUN`。
- 本地 [headless platform](../packages/server-core/src/runtime/platform-headless.ts) 44–51 行及 [script runtime resolver](../packages/session-tools-core/src/runtime/resolve-script-runtime.ts) 78–91 行消费 U_AGENTS 路径。
- [上游新 inherited-app-env.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/runtime/inherited-app-env.ts#L45) 50 行只读 `CRAFT_APP_ROOT`，58 行只收集 `CRAFT_*` 路径。[上游 headless 接入](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/runtime/platform-headless.ts#L52) 也使用该结果。

**影响。** 若保留上游新模块不作相应适配，或只保本地旧 platform，U Agents shell → 候选 headless 的场景仍可能使用旧资源，造成“测试通过但跑了旧运行时”。这是有明确触发条件的集成风险，并非断言当前普通终端环境已经串包。

**建议修订。** 把 `inherited-app-env.ts`、其测试、headless platform 和资源解析器列为联合适配任务，处理本地运行时变量及实际保留的兼容变量。只清理经确认属于外部 checkout 的运行时提示；不要机械删所有 U_AGENTS_*，尤其不能破坏配置隔离变量。

**新增验收。** 注入旧安装目录的 U_AGENTS runtime hints，从候选启动 headless，断言 appRoot、Pi/Claude runtime、uv/脚本都来自候选；配置隔离根仍保留。另测合法 bundled 模式继续接受自身资源路径，避免修复测试路径时破坏安装包。

### R4 — [P2] maxTokens 要覆盖编辑连接重建，不能只修后台刷新

**问题。** §3.1 对 `preserveUApiImageCapabilities` 的发现成立，但“保存后不丢”仍缺少用户操作链路。方案只列了刷新/存储回归，执行者可能补完 helper 就认为 G2 已覆盖。

**代码证据。**

1. [submit-helpers.ts](../apps/electron/src/renderer/components/apisetup/submit-helpers.ts) 7–16 行的 U-API 表单只提交 Token、固定 baseUrl 和同步模式，不携带 maxTokens。
2. [useOnboarding.ts](../apps/electron/src/renderer/hooks/useOnboarding.ts) 489–526 行先测试，再优先采用 `testResult.resolvedSetup.customEndpoint` 保存。
3. 本地 [连接测试 RPC](../packages/server-core/src/handlers/rpc/llm-connections.ts) 361–389 行重新发现模型并返回 selection；[selection 构造](../packages/server-core/src/domain/u-api-model-discovery.ts) 220–226 行只有 api/supportsImages。
4. 同一保存 RPC 121–124 行会用传入对象替换 `updates.customEndpoint`；上游这次没有修改该 handler。新 [Pi 默认输出上限](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/pi-agent-server/src/custom-endpoint-models.ts#L69) 为 8192。

**影响。** 已保存 `maxTokens=16000` 的合法 U-API 连接，只要在设置中对同一 Token 做掩码重测并保存，仍可能变回无 maxTokens，随后使用 8192 默认值。即使后台刷新和直接存储重载测试都通过，这个路径也没有经过保留 helper。

**建议修订。** 补齐“同一连接编辑 → 凭据解析 → 发现/探活 → 保存”的字段合并规则。至少明确密钥不变的掩码重测保留旧合法上限；更换 Token/协议时保留还是重置另行写清。只从服务端已校验的同一连接读取保留字段，新建连接不能继承其他 slug 的配置。

**新增验收。** 用合成凭据和 mock 探活，覆盖同 slug 掩码编辑、换 Token、协议变化、新建第二连接，再经实际 setup RPC 保存→重载→Pi 初始化；断言预期上限与固定网关政策同时成立。无需真实付费调用。

## 3. 复核后保留的结论

- 固定 SHA、730 路径变化、285 交集、44 个 marker 文件与“交集不等于冲突数”的口径成立。
- Artifact 前置后端拒绝、cacheWarming 首个候选关闭、保住依赖下限/Office 链路的方向有源码依据。
- 先形成统一候选、平台安装验收后再合回/发布的边界合理。
- 真实合并冲突、依赖组合、平台运行和网关业务结果继续为 UNKNOWN/NOT_RUN；本轮没有为取得评审结论运行这些检查。
- 原评审未修改原方案；后续 r2 的文档处置另列于下方，不能把文档修订记为代码修复。

## 4. r2 文档处置（2026-10-22）

本节记录用户要求的方案修订，原发现保留作历史证据。当前使用 [r2 主方案](UPGRADE-PLAN-v0.15.5-20261022.md)，旧行号只定位 r1。

| 编号 | 已补齐的设计 | 当前状态 |
|---|---|---|
| R1 | W0.5/§5.1 明确 Bun/preload 前的根、父/子进程、文件/网络限制与失败条件；新增 G0，并约束 W3、W4、G11 及统一验证命令 | 文档已处置；执行 NOT_RUN |
| R2 | §3.2 合并第 4 个 options 参数、缓存身份、query wrapper 与 cleanup 规则；G3 增加直接 factory/cache 组合回归 | 文档已处置；代码/测试 NOT_RUN |
| R3 | §4.4 规定 U_AGENTS 与兼容变量的优先级、运行时路径白名单、配置变量保护与 bundled 模式；W1/G10 加入联动验收 | 文档已处置；代码/测试 NOT_RUN |
| R4 | §3.1 定义同凭据/协议保留、换 Token/协议及新连接重置；保存 RPC 重新校验，不信任 renderer；G2 覆盖实际编辑保存到 Pi 初始化 | 文档已处置；代码/测试 NOT_RUN |

本次只修订主方案与本评审跟踪 Markdown；固定 O/T、730/285/44 统计和升级范围未改变。未创建分支/工作树、修改源码/配置、安装、构建、测试或启动应用；没有更新改造点源码基线。

## 5. r2 第二轮复核（2026-10-22）

**结论：R1–R4 均已在方案层面闭环；本轮未发现这四项中的新增阻断问题。** r2 可以作为后续实施依据，但不是代码已实现、测试已通过或开始实施的授权。

本次复核对象为主方案 r2，SHA-256：`dfb590cbc44c5e443c0887f98b8953ed93cffd33ef5f26979d2491e09bd383d1`。本地主线仍为 `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`；上游仍按固定 T `cede6ea49e0c4a42933ed0f1bc129db698fc581f` 的已读源码核对，不重新选择目标版本。

复核同时检查“处理规则 → 工作步骤 → 验收条件”，并以原问题的触发场景反查，未仅凭修订状态表确认。

| 原评审项 | r2 规则与执行定位 | 本轮反查的触发场景 | 对应验收 | 结论 |
|---|---|---|---|---|
| R1 | §5.1，203–209 行；W0.5/W3/W4，178–182 行；统一命令前置，231 行 | 测试文件中才设根、子进程漏继承、缺参或指向正式目录：现在均要求在被测逻辑前失败，且 preload/进程 I/O 与网络限制单列，不用目录存在或 hash 未变化替代 | G0/G11；首个进程与子进程的根一致、访问拒绝和网络限制证据 | **方案闭环** |
| R2 | §3.2，99–106 行；W1/W3 | 同 session 的 owner A→B、full↔mini、普通↔Coding、来源/项目条件变化：现在明确统一 options、组合缓存身份、全变体 cleanup、每次 query 新 wrapper，并要求直接走 factory/cache | G3；工具集合与 handler 身份同时检查，callback registry 单测不能替代 | **方案闭环** |
| R3 | §4.4，160–171 行；W1/W3/W4 | U_AGENTS 主根有效但兼容路径指向旧安装、源码误继承 packaged 状态、误清配置根或合法 bundled 目录：现在规定两前缀联合判断、路径键范围与保护对象，且验证实际执行来源 | G10；候选实际路径/版本、配置根保留和 bundled 正例 | **方案闭环** |
| R4 | §3.1，69–84 行；W1/W3 | 掩码编辑覆盖 maxTokens、同 slug 换 Token/协议、第二连接继承旧值、无效值与异步旧结果晚到：现在有保留/重置矩阵、保存端重新判断和提交串行/失效检查，不信任 renderer 旧结果 | G2；经过实际编辑/测试/setup RPC 到保存、启动及 Pi 初始化，覆盖后台刷新 | **方案闭环** |

已重新核对本地 preload 的配置根捕获时机、工具 factory 的 owner 闭包、Electron/headless 的 U_AGENTS 路径消费，以及测试结果→保存 RPC 的 customEndpoint 替换链；上游缓存 profile、CRAFT 环境过滤和 maxTokens 合法值规则与本轮处置无冲突。这里只确认设计覆盖原风险，未执行这些业务路径。

状态区分：

- **文档闭环：4/4**。本轮不新增修订要求，也不改主方案。
- **实现与运行验证：NOT_RUN**。G0–G12 尚不能记 PASS；合并冲突、依赖组合、平台运行、真实网关/费用与升级恢复仍按原方案等待执行证据。
- 本轮仅在本评审记录增加复核结论；未修改源码/配置、创建工作树、fetch/merge、安装、构建、测试或启动应用。

