# v0.11.1 → v0.14.0 升级差异审查

> 审查日期：2026-10-01（北京时间）。状态：**只读审查完成，尚未实施升级**。
> 本文的功能取舍是建议，未自动变更 PRODUCT.md、既有规格或代码。依据 upstream-sync 与 spec-writer 规范，先核查源码，再记录接收条件。
> 后续：详细任务包、执行顺序和验收矩阵见 [升级落地方案](UPGRADE-PLAN-v0.14.0-20261001.md)，全量 561 文件见 [文件清单](UPGRADE-FILE-INVENTORY-v0.14.0-20261001.md)。

## 1. 结论

建议把 **v0.14.0 作为下一次同步目标**，但不能原样接收全部新入口。这次有直接影响当前代码的权限修复，也有新增外部服务、数据存储与会话生命周期变化。

建议的候选版本范围：

- 接收权限、会话、数据源、中转接口兼容、中文输入与更新安装修复。
- 保留现有 U-API 多连接、Token 自动发现模型、真实探活、付费生图生命周期及手动下载兜底。
- 本地 Pages 可作为 Beta 接收候选；交互动作和脚本定时刷新必须单独验收，不能因页面能显示就视为全部通过。
- 本轮不开放决策模型、Guarded 模式及 Pages 公开分享。前两者增加独立模型调用通道；分享默认连接上游服务，且公开仓库没有配套服务端。

**不是“升级不可做”，而是需要一次完整的 fork 适配。** 下文的文件交叉数不是实际合并冲突数；没有执行合并演练，不能据此承诺工期或冲突数量。

## 2. 固定基线与审查方法

| 项目 | 已核实值 |
|---|---|
| 本地 HEAD | `c6cf072d`，`feat: add manual update fallback` |
| 当前分支 | `main`；相对本地缓存的 `origin/main` ahead 1，未核实远端 fork 最新状态 |
| 本地应用版本 | `apps/electron/package.json` 为 `0.11.1` |
| 已合入的上游基线 | `4289b16097322e9911d3078d8a64bd8c830717c3`（v0.11.1） |
| 上次同步提交 | `5536427b70e0462068c293350b6337fa26cc3a69`（2026-07-11） |
| 本次目标 | `73bd9c2a3573158bea880984eb8d5fdb41e0cac2`（v0.14.0） |
| 上游 main | 核查时与 v0.14.0 相同 |
| 发布间隔 | 12 个正式发布版本、12 个公开 squash 提交 |
| 上游文件差异 | **561 个：新增 237、修改 322、删除 2**；按路径及 blob SHA 比较，不做重命名推断 |
| 双方都改过的文件 | **201 个**：上游变更路径与 `git diff --name-only 4289b160 HEAD` 的交集 |
| 现有改造标记 | **178 / START 10 / END 10**，与 §14 当前基线一致 |
| 带标记的交叉文件 | **45 个**；按含 U-API 注释的 TS/TSX 文件统计，排除 node_modules 和 release |
| 初始未跟踪项 | `.agents/`、`.codex/`、`manifest.json`，本次没有处理 |

GitHub compare 接口只给出前 300 个文件，本轮没有用它的文件数或缺失的行统计推算整体规模。561 的依据是两个固定 SHA 的完整递归文件树，二者 `truncated=false`。重点模块通过固定 SHA 的原始源码与本地源码核对；不是逐行审完 561 个文件。

12 个版本依次为：`0.11.2`、`0.11.3`、`0.11.4`、`0.12.0`、`0.12.1`、`0.13.0`、`0.13.1`、`0.13.3`、`0.13.4`、`0.13.5`、`0.13.6`、`0.14.0`。未按连续版本号虚构 `0.13.2`。

依据：[上游比较](https://github.com/craft-ai-agents/craft-agents-oss/compare/v0.11.1...v0.14.0)、[发布记录](https://github.com/craft-ai-agents/craft-agents-oss/releases)、[上次同步报告](sync-reports/SYNC-v0.11.1-20260711.md)、[改造点基线](14-uapi-marker-registry.md)。上次报告的“未合回 main”等状态是历史快照，本轮以实际分支为准。

## 3. 主要发现与接收条件

### R1 — 优先接收现有权限修复，但保留我方管理员审批

**已确认当前代码存在旧路径，尚未做运行时攻击复现。**

- 本地 `packages/shared/src/agent/core/pre-tool-use.ts:1048–1067` 用 `getBaseCommand()` 得到命令首词，再检查会话白名单。授权粒度不足以区分同一命令下不同动作。
- 本地 `packages/server-core/src/sessions/SessionManager.ts:4266` 直接使用 `request.permissionMode ?? managed.permissionMode` 创建子会话，没有此处的父级权限上限。
- 上游新增 `permission-remember.ts` 的 `getBashRememberKey()`、`getFileWriteRememberKey()`、`getNetworkCommandHosts()`，并通过 `PromptInfo.remember` 将相同授权键贯穿提示、记忆与检查。
- 上游 `SessionManager.ts:4724–4727` 用 `clampPermissionMode(request.permissionMode, parentMode)` 限制子会话。
- 上游 `pi-agent.ts:1396–1405` 在没有权限回调处理器时明确 block，不能将无人应答当允许。

**建议**：完整接收相关调用链和测试，不能只复制一个白名单函数。本地 `classifyAdminApproval()`、`admin_approval` 与 `privileged-execution-broker.ts` 的命令摘要绑定、过期与审计仍需保留；它们和上游权限改动位于交叉区域。

验收至少覆盖：批准一个 Git 子命令后其他写操作仍需确认；带串联、管道或解释器参数的命令不能借用更宽授权；子会话不得比父会话更宽松；无人应答时拒绝；现有管理员审批仍按原合同工作。

上游证据：[permission-remember.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/agent/core/permission-remember.ts#L140)、[SessionManager.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/server-core/src/sessions/SessionManager.ts#L4724)。

### R2 — 决策模型是独立出口，现有 U-API 锁定覆盖不到

上游 `packages/shared/src/decisions/providers.ts` 新增 TypeSafe、OpenRouter、Vercel、Laya 与 custom，使用 **`/v1/systemone`** 协议，不能当作普通 Chat Completions / Anthropic Messages 换个 baseUrl 就接入。

`resolve.ts` 从独立 `decisionLayer` 设置和 `decision_api_key` 凭证解析客户端；当前我方 `enforceUApiBaseUrl()` 约束的是 `llmConnections`。因此，保留原连接锁定并不等于约束了新通道。

默认 `enabled=false` 也不等于无外发路径：`status.ts:testDecisionConnection()` 明确以 `skipGates: true` 解析客户端，供总开关未开启时测试；RPC 还提供 `SET_SETTINGS`、`SET_API_KEY`、`TEST`、`PROBE_SERVER`。

**建议本轮不开放**：UI 隐藏之外，服务端设置、测试、探测、实际解析与 `decide` 工具都必须遵守 fork 的禁用政策；不能仅改变默认值，也不能仅依赖可被配置覆盖的环境开关。保留类型或上游模块以降低同步成本可以，但必须验证运行时不可旁路。

本轮没有探测 U-API 是否实现 System One，也没有发送模型请求；“新协议当前可接入 U-API”仍是未证实命题。未来开放应单列协议、计费与内容外发规格。

上游证据：[providers.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/decisions/providers.ts#L48)、[status.ts](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/decisions/status.ts#L102)、[RPC](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/server-core/src/handlers/rpc/decisions.ts#L30)。

### R3 — Guarded 的失败行为不能概括为“出错就询问”

源码区分两种情况：

1. `mode-manager.ts:resolveEffectivePermissionMode()`：检查未激活或活动解析器抛错时，从 guarded 退回 ask。
2. `core/guarded-mode.ts:applyGuardedModeCheck()`：已进入检查后，单次返回 null 或抛错会得到空风险列表，返回原先允许结果；停止信号和明确的工作目录外文件写入另有拦截。

这不等于每次模型失败都会拦截操作。上游源码注释也明确说明，模型只增加提示，单次没有答案仍执行。风险判断请求会携带命令、参数与工作目录信息，见 `server-core/src/decisions/guarded-mode.ts:buildGuardedModeRequest()`。

**建议**：随决策模型一起暂不开放 Guarded；保留 Explore / Ask / Execute 现有产品语义。配置或历史会话带入 guarded 时应明确降为 ask，不能只从下拉菜单删除。独立权限修复不应因此被放弃。

上游证据：[有效模式解析](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/agent/mode-manager.ts#L449)、[单次风险判断](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/agent/core/guarded-mode.ts#L167)。

### R4 — Pages 本地功能与公开分享必须分开决定

本地 Pages 涉及 `packages/shared/src/pages/`、`server-core/src/handlers/rpc/pages.ts`、`server-core/src/pages/` 和 renderer 的 `components/pages/`，并接入会话工具、项目与自动化。

已见到的保护包括：`PageFrame.tsx:sandboxForKind()` 对静态页面不开放脚本，交互页面仅使用 `allow-scripts allow-forms`，不开放 `allow-same-origin`；`PageActionBroker` 检查 lease、内容摘要、grant 匹配及过期。定时刷新通过 `buildPageRefreshMatchers()` 接入脚本自动化，意味着它不只是 HTML 查看器。

公开分享则是另一条外部服务链：

- `feature-flags.ts:isPagesSharingEnabled()` 默认返回 true，环境变量可覆盖。
- `publisher.ts:DEFAULT_PAGES_SHARE_API_BASE_URL` 是 `https://thecraftagents.com/p/api`，可通过 `CRAFT_PAGES_SHARE_API_URL` 覆盖。
- 改我方 `VIEWER_URL` **不会**改变这个独立常量。
- v0.14.0 完整公开文件树没有 `workers/pages`。根 package 的 `typecheck:pages-worker` 明确在 OSS 缺目录时跳过；`pages-worker:dev/test/deploy` 脚本仍存在。因此不能把 typecheck 通过理解为分享服务端已具备，也不能声称改域名即可自建。

**建议**：本地 Pages 列为 Beta 接收候选；本轮关闭公开发布、更新公开副本与设密码入口，并在 publisher 层拒绝，防止 UI/工具/RPC 绕过。已有公开副本的取消发布能力单独处理，不因关闭发布而使其无法撤回；涉及历史外部副本时需明确用户操作，不能自动联系上游清理。

本地页面要验收：内容更新使旧授权失效、过期/不匹配授权被拒绝、来源失效后的重连、交互写操作确认、脚本执行与刷新失败展示。不能把上游存在保护代码当成我方集成已通过安全验收。

上游证据：[分享开关](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/feature-flags.ts#L62)、[publisher](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/pages/publisher.ts#L34)、[PageActionBroker](https://github.com/craft-ai-agents/craft-agents-oss/blob/73bd9c2a3573158bea880984eb8d5fdb41e0cac2/packages/shared/src/pages/action-bridge.ts#L294)。

### R5 — 会话重试和消息处理必须保住付费生图合同

上游更新了 `SessionManager.ts`、`claude-agent.ts`、`pi-agent.ts`、Pi 子进程、会话工具定义和事件适配器，覆盖排队、steering、source activation retry、停止、后台完成通知及重试回复交付。

这些路径与我方生图直接交叉：当前 `generate_image` 仅向 full Claude/Pi 注册，`SessionManager` 持有受信 invocation 与计费调用状态。即使生图 handler 自身没有上游同名文件，也不能判定功能不会受影响。

**必须保留** [16B 付费工具合同](16b-paid-tool-lifecycle.md)：顶层用户消息产生受信上下文；内部/自动化来源不冒充 interactive；同一 invocation 最多一个可能计费的 accepted POST；进入 claimed 后不自动重发；取消、断网、保存失败如无法排除已计费，必须返回 `possibly_charged`；重启不恢复旧付费任务。

验收以可计数的 mock POST 和真实工具注册链为主，覆盖重试、恢复、source 激活、steer、队列与取消；禁止为了测重复扣费而默认发起真实收费请求。

### R6 — 新域名与配置路径重构会绕过旧清洗清单

v0.12.0 后上游域名变为 **`thecraftagents.com`**。品牌检查不能只查 `craft.do` / `lukilabs`。

已确认的入口有 `branding.ts:VIEWER_URL`、`docs/doc-links.ts:DOC_BASE_URL`、`prompts/system.ts` 的产品文档指引、Pages publisher、自动更新配置和安装脚本。决策模型 provider 还带有 `X-Title: Craft Agents`。

路径方面，上游新增 `DEFAULT_CONFIG_DIR_NAME` 和 `resolveConfigDir()`，并让多个模块使用统一配置根目录。我方当前合同是 `U_AGENTS_CONFIG_DIR` 优先、兼容 `CRAFT_CONFIG_DIR`、默认 `~/.u-agents`。不能直接拿上游默认 `~/.craft-agent` 覆盖，否则可能表现为旧数据和凭证“消失”，或与上游应用混用。

**建议**：接收统一路径解析的实现方式，保留我方目录名与环境变量优先级；同时核对 import-free 的 `interceptor-common.ts`、`session-tools-core/handlers/config-validate.ts`。保留 LICENSE / NOTICE / TRADEMARK 合规证据，不把法律文件中的原始署名当品牌遗漏清掉。

### R7 — SDK 升级和构建裁剪不能照抄 manifest / lock

| 依赖 | 本地 | v0.14.0 |
|---|---|---|
| Claude Agent SDK | 0.3.197 | 0.3.280 |
| Pi SDK 系列 | 0.80.6 | 0.87.1 |

中转兼容修复值得接收，例如 `custom-endpoint-models.ts:buildCustomEndpointModelDef()` 对 `openai-completions` 设置 `compat.supportsStore=false`；但新签名需要调用方一起传入协议，不能只搬函数内部一行。

Manifest 也存在我方约束被放松的风险：本地 `linkify-it` 为 `^5.0.2`，上游为 `^5.0.0`；shared 的 `shell-quote` 本地为 `^1.9.0`、上游为 `^1.8.3`。这是声明范围比较，不是对最终解析版本的漏洞判定。保留现有 overrides 和安全下限，在实施阶段重新验证新 SDK 兼容性。

上游 `scripts/build/common.ts` 从 `buildMcpServers()` 转为 `buildSubprocessServers()`，移除 session MCP 打包复制与存在检查；同时删除旧 bridge bundle。需要追踪我方 `generate_image`、session tools 和各平台子进程实际装载路径，再接收“瘦身”，不能凭上游称 unused 就删除本 fork 所需资源。

**建议**：以我方 manifest/安全约束为基础增量调和，保留 `@u-agents/*` scope、已有构建修复；lock 不整份覆盖或删除重建。新增上游文件中的 `@craft-agent/*` import 必须一起适配。

### R8 — 自动更新修复与手动下载兜底需要同时保留

上游在 `auto-update.ts` 新增 `setBeforeUpdateInstallHook()` 和 `setInstallQuitFailedHook()`：先完成会话落盘和资源清理，再交给安装器；安装交接失败时由主进程通知并重新启动，避免停留在已清理的半关闭状态。

本地最新提交又增加了手动下载兜底，`AppSettingsPage.tsx` 在同版本无法自动前进时仍显示手动下载。因此，两条路径都应保留，不能把上游安装修复当作删除我方兜底的理由。

验收：更新源仍为 `https://update.u-agents.u-studio.cn/latest`；安装前会话保存、正常退出、失败重启链路完整；同版本仍可手动下载；macOS 与 Windows 分别实测，不以源码检查替代安装验证。

### R9 — 两个删除项、中文日志与历史规格也要处理

上游删除：

1. `apps/electron/resources/bridge-mcp-server/index.js`：与构建裁剪一起核查，不能单看文件删除。
2. `packages/shared/src/sources/builtin-sources.ts`：产品文档从内置 Source 改成公开文档指引。迁移后不能自动指引用户到上游设置外部 provider；需要我方文档去向或明确不可用说明，不能虚构已经存在的替代页面。

后续全量内容比对修正：正式 Release 仍为 12 次，但源码新增 **13 份版本号 release notes**，其中还包含没有对应本次公开 Release 记录的 `0.13.2.md`；另有 `next.md` 修改。13 份版本说明需逐份中文化、清理不开放的 provider / 决策模型 / 分享宣传、去上游 commit hash 和按既有规则处理 issue 引用。不能因没有 Release 记录而漏处理应用可能展示的文件；`next.md` 应接收上游版本文件过滤逻辑，不能作为正式版本展示。7 种语言均需 key parity 和排序校验；中文文案应表达我方最终功能范围。

现有 `08-conflict-zones.md` 把 `llm-connections.ts` 描述为“理论上零差异”，但当前文件已有我方标记，旧描述不可当作整份接收依据。本轮只在此登记差异，没有顺手重写历史规格。§14 当前 178 标记基线有效，不因升级尚未执行而刷新。

## 4. 建议的接收矩阵

| 范围 | 本轮建议 | 关键限制 |
|---|---|---|
| 旧三档权限、授权记忆、子会话上限 | 优先接收修复 | 保留管理员审批合同，贯穿 Claude/Pi |
| 会话队列、停止、重试、长工具显示 | 接收并回归 | 不改变生图付费生命周期 |
| Sources 鉴权、MCP、路径与浏览器修复 | 接收并回归 | 保留既有 TLS、SSRF 与浏览器功能锁定 |
| Kimi/Fable 等模型目录和新 provider 预设 | 兼容实现可接收，入口继续锁定 | U-API 动态目录与探活为准，不承诺网关支持上游全部模型 |
| 本地 Pages | 建议接收为 Beta 候选 | 显示、数据、授权动作、刷新分别验收 |
| Pages 公开分享 | 本轮关闭 | UI + 服务端 + publisher 拒绝发布，撤回另行处理 |
| Decision model / decide | 本轮不开放 | 不能只关闭默认开关或改 baseUrl |
| Guarded | 本轮不开放 | 历史/配置注入值明确降为 ask |
| SDK / 打包更新 | 接收并做打包回归 | 保留 scope、安全约束和我方工具装载 |
| WhatsApp、官方账号直连、远程能力 | 不借同步扩大范围 | 维持既有产品取舍 |

## 5. 交叉文件的人工审查顺序

| 顺序 | 文件或目录 | 为什么优先 |
|---|---|---|
| 1 | `config/storage.ts`、`handlers/rpc/llm-connections.ts`、`domain/connection-setup-logic.ts`、新 `decisions/` | 模型目录、网关锁定、新出口 |
| 2 | `agent/core/pre-tool-use.ts`、`mode-manager.ts`、`permission-manager.ts`、新 `permission-remember.ts`、`SessionManager.ts` | 授权收敛与我方审批、生图上下文 |
| 3 | `claude-agent.ts`、`pi-agent.ts`、`pi-agent-server/src/index.ts`、session tool 定义与 callbacks | 重试、工具注册、收费与取消 |
| 4 | `config/paths.ts`、interceptor、credentials、preload、window-state | 用户数据与凭证目录兼容 |
| 5 | 新 Pages 模块、`feature-flags.ts`、AppShell、RPC、自动化 | 新存储与执行面、外部分享 |
| 6 | `auto-update.ts`、主进程 `index.ts`、`electron-builder.yml`、构建脚本 | 更新、退出、安装与资源裁剪 |
| 7 | `AiSettingsPage.tsx`、onboarding、apisetup、branding、prompts、docs、locales | 新入口、中文与品牌回流 |

201 个交叉文件中包含文档、测试、语言包和 package，并非 201 个逻辑冲突。45 个带标记交叉文件也不是全部风险：无标记的新模块正是独立模型出口和分享入口的来源。

## 6. 实施与验收交接

以下为后续实施要求，本轮没有运行其中的修改、安装或测试操作。

1. 固定本地 `c6cf072d` 和上游完整 SHA，先说明已有 ahead 提交与未跟踪 harness 文件的归属，不盲目覆盖或清理。执行会话需获得本次代码修改授权，并按仓库规则处理核心高冲突文件。
2. 在独立同步分支按 tag 接收。上游每个公开提交是一整个 release，不能假定有可单独 cherry-pick 的内部安全修复提交。可按模块分批审查与提交适配，不必打包发布 12 个中间版本。
3. 按 R1–R9 完成适配。新增标记逐项登记，START/END 成对；在实际变更完成后再更新 §14 基线。现有 178 个标记不能作为永远不变的机械目标。
4. 运行现有 `validate:ci`、类型、lint/i18n、适用测试，并运行上游权限、子会话、Pi 重试和 Pages 相关新增测试。实际脚本及所覆盖范围按合并后 manifest 核实。
5. 重点补齐集成验收：U-API 新旧连接/启动强制归一/模型探活；改配置和直调 RPC 仍无法启动决策模型或上游分享；收费工具单次 POST 与取消重放；旧目录凭证/会话/任务读取；Pages 授权失效；管理员审批。
6. 打包后分别验证 macOS、Windows 的真实 U-API 对话、工具可用性、中文输入、路径、升级与手动下载。真实模型或生图测试的收费范围需在实施验收时明确，不默认发起。
7. 对 `typecheck:pages-worker` 的 OSS 缺目录跳过如实记录为“不包含分享服务端”，不能归入分享功能通过。若关闭分享，不因此增加自建 Worker 项目。

**完成条件**：上述建议范围形成明确的实现决策、实际冲突解决、我方约束和回归通过后，才能称为升级候选完成；合并、发布与部署仍是后续独立动作。

## 7. 本轮验证边界

- 已做：读取当前源码/规格，核实 Git 基线与工作区状态，比较两份完整上游文件树，核查关键源码与差异、依赖声明、改造标记及交叉路径。
- 未做：fetch、checkout、merge、安装、构建、测试、运行 app、网关探活、真实付费调用、修改配置、部署或推送。
- 无法据本轮确认：实际文本冲突数、运行时漏洞可利用性、完整 Pages 安全性、新 SDK 对所有 U-API 模型兼容性、最终安装包表现和工期。
- 本轮唯一新增文件为本文，已有未跟踪文件保持原状。
