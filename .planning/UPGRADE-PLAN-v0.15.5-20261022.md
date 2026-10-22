# v0.14.0 → v0.15.5 升级方案

> 核查日期：2026-10-22。修订：**r2，已按 R1–R4 补齐方案，尚未执行升级**。
> 本文依据本地源码、GitHub 固定提交的完整文件树及关键调用链；本轮只修订本方案与评审跟踪 Markdown。未 fetch、merge、创建分支/工作树、安装依赖、构建、启动应用或请求真实网关。
> 修订依据：[方案评审](UPGRADE-PLAN-REVIEW-v0.15.5-20261022.md)。设计和验收条目已补齐，不表示代码已修复或运行验收已通过。
> 规则依据：[CLAUDE.md](../CLAUDE.md)、[上游同步 SOP](07-upstream-sync.md)、[冲突区](08-conflict-zones.md)、[网关规格](02-llm-gateway-spec.md)、[功能裁剪](04-feature-cuts.md)、[回归清单](09-test-checklist.md)。

## 1. 建议怎么升

**从当前 main 创建独立候选，一次同步固定的 v0.15.5，在同一分支完成产品适配，先出 macOS 测试包，再验 Windows。** 不单独发布中间的 0.14.1、0.15.0–0.15.4。

这是一次涉及界面、Agent 运行时和会话工具的中等规模集成。优先接收费用统计、上下文压缩、Sources、浏览器和日常交互修复；界面跟随上游；Coding 作为默认关闭的可选模式。U-API 接入、生图、数据目录和现有功能限制均按本地合同迁移。源码候选、平台安装验收、正式发布分别记状态。

上游为 release squash；7 个提交不能代表工作量。一次固定最终版本可避免重复解决同一批界面和 SDK 冲突，但不意味着一次性忽略中间版本的变更。

### 1.1 本次修订对应关系

| 评审项 | r2 明确的处理规则 | 落点 |
|---|---|---|
| R1 | 测试环境在 Bun/preload 启动前建立，覆盖父进程、子进程和包内 smoke | §5 的 W0.5、§5.1、G0/G11 |
| R2 | options 与缓存身份同时保留 owner/full-mini 和 Coding 条件；每次 query 新建 MCP wrapper | §3.2、G3 |
| R3 | 防串运行时同时处理 U_AGENTS 与实际兼容变量，保留配置隔离变量和合法 bundled 模式 | §4.4、G10 |
| R4 | 同 Token/协议的既有上限保留；换 Token、换协议、新连接或无效值恢复默认 | §3.1、G2 |

以上四项均为**文档设计已补齐，实施与运行验证 NOT_RUN**。

## 2. 固定输入与实际规模

| 对象 | 本次核实结果 |
|---|---|
| 共同上游基线 B | v0.14.0，`73bd9c2a3573158bea880984eb8d5fdb41e0cac2`，已在本地主线祖先中 |
| 本地主线 O | `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`，合入 v0.14.0 的 PR #1 |
| 远端 origin/main | GitHub branches/main 实时返回同一 O；不是仅比较本地缓存 |
| 目标 T | v0.15.5，`cede6ea49e0c4a42933ed0f1bc129db698fc581f`；tag 已核实直接指向该 commit |
| 最新正式版 | GitHub latest = v0.15.5；2026-10-21 发布 |
| 本地缓存 upstream/main | 仍为 v0.11.2，`a60ebc1a`，不能拿它作为升级目标 |
| 当前工作区 | tracked 无改动；原有未跟踪 `.agents/`、`.codex/`、`manifest.json` 保留原地 |

完整树比较 B→T：**730 个路径变化，216 新增、511 修改、3 删除**。B→O 共 1028 个路径变化；双方交集 **285 个**。其中上游改到了 **44 个带 U-API 标记的本地文件**。当前源码标记实测 **216 / START 10 / END 10**，与 [§14 基线](14-uapi-marker-registry.md) 一致。

统计按路径、blob SHA 和 mode 比较；不推断 rename。上游 recursive tree 返回 2575 项（含目录），`truncated=false`；不是只统计 Compare API 的前 300 个文件。285 是审查交集，**不是真实 Git 冲突数**。本轮没有做合并演练，实际冲突数为 UNKNOWN。

变化分布：Electron 368、shared 131、server-core 87、ui 76、Pi 子进程 23，其余 45。对所有路径做清单和交集检查，对下列重点读取实际实现；没有声称逐行审完 730 个文件。

## 3. 接收范围与关键适配

| 模块 | 本轮建议 | 实施定位与通过条件 |
|---|---|---|
| 整体界面、默认缩放、右键、复制、会话分组 | 接收 | 沿用新组件结构；迁移 U Agents 图标、中文、手动下载入口、生图展示，避免用整份旧界面覆盖新界面 |
| 费用与 token 统计 | 接收 | `sessions/turn-usage.ts`、`SessionManager.ts`；覆盖累计值→增量、分支起始值、Pi 多调用与子任务汇总；客户端统计不等于网关账单 |
| 上下文压缩阈值 | 接收并验证 U-API/Pi | `storage.ts:getAutoCompactWindow` → `pi-agent.ts` → `session-settings.ts:compactionReserveFor`；不得只接入 Claude 设置而漏 Pi |
| Coding / worktree / PR 状态 | 接收，默认关闭 | `codingMode`、`AgentProfile`、`CODING_PROFILE_TOOLS`；旧会话默认不转换。PR 状态读取不启动 LLM；按钮仍服从会话权限，不自动 push、评论或发布 |
| MCP resources/prompts、项目记忆追加、登录与浏览器修复 | 接收 | 保留 Source 认证、权限和错误结果语义；后台任务停止/完成行为按新实现回归 |
| HEIC/HEIF | 接收 | `services/heic.ts` 使用 `heic-convert` 转 JPEG；验收依赖入包、预览、缩略图与最终模型附件 |
| Cloudflare AI Gateway、OpenCode Go | 实现可随上游保留，产品入口继续关闭 | 不是新增 `LlmProviderType` 才算新出口；这两项是 preset/helper 路径，仍须检查首次配置、设置和测试/保存 RPC |
| Claude artifact 发布 | 接入现有禁止发布策略 | 新 `pages.PUBLISH_CLAUDE_ARTIFACT` 不能仅依赖“没有 Claude 账号”；在后端取凭据/启动 SDK 前拒绝，UI 隐藏 |
| Decision / Guarded / Pages script、refresh、公开发布 | 延续本地政策 | 保留 `U_AGENTS_FEATURE_POLICY`；普通本地 Pages 与 API/MCP 动作保留；关闭能力不因新界面或新 RPC 恢复 |
| Claude 专用子代理模型选项 | 不作为 U-API/Pi 可用功能展示 | 上游 `chooseSubagentModel` 只处理 Claude family/Agent aliases；本地连接固定走 `pi_compat`，不可承诺该选项能给 Pi 指定 Sonnet/Haiku |

### 3.1 U-API 连接与 maxTokens

本地必须继续保持：只填 Token；固定 `https://token.u-studio.cn/v1`；真实 Token 目录发现与协议选择；多连接；手选/推荐模型规则；存储密钥只用于受信固定目的地。

- `handlers/rpc/llm-connections.ts` 的目的地与 slug 校验发生在 `resolveSetupTestApiKey` 前。该文件上游本次未改，也要作为集成哨兵核对，不能在重整目录时丢失。
- 上游 `CustomEndpointConfig` 新增 `maxTokens?: number`，Pi 初始化会传给自定义模型。当前本地 `preserveUApiImageCapabilities` 重新构造 `customEndpoint`，只额外保留 `supportsImages`，**升级后照搬会丢掉新 maxTokens**；不能因为该文件本次上游未改就跳过。
- 扩展保留逻辑覆盖两条链：①后台目录刷新；②设置页编辑 Token → 测试/发现/探活 → setup RPC 保存。不能只修 `preserveUApiImageCapabilities`，也不能仅用直接存储重载用例证明表单编辑通过。
- 连接测试与保存仍由服务端控制：先验证固定网关与合法连接身份，再按需要读凭据。网络地址、provider、协议不随 renderer 的任意对象展开而改变。

**输出上限的具体合并规则（R4）。** `maxTokens` 是同一连接的输出上限，不是模型 ID 或凭据。合法数值限定为正的安全整数；不猜测网关实际上限。源值只能取自服务端当前读取的同一已校验连接，不能把 renderer 回传的 `resolvedSetup` 当成保留依据。

| 操作 | maxTokens 处理 |
|---|---|
| 同一既有 slug，掩码重测或输入值等于原凭据，发现协议未变 | 保留该连接旧的合法值；未设置则仍不设置 |
| 同一 slug 更换 Token，即使协议相同 | 删除旧值，使用默认行为；不把旧账号的上限带给新 Token |
| Token 未变但发现协议改变，或刷新目录后切换协议 | 删除旧值；不能仅按 slug 相同保留 |
| 新建连接或第二个 Token 连接 | 不继承其他 slug 的上限 |
| 旧值为零、负数、小数、字符串或非安全整数 | 不保留，使用默认行为；不擅自钳制为猜测的上限 |
| 后台刷新且凭据、协议未变 | 保留旧的合法值，继续保留现有模型选择和图片能力规则 |

Token 是否改变由服务端在覆盖凭据前比较本次解析值与同一连接当前存储值；比较只在内存中完成，不输出 Token、比较摘要或包装了 Token 的日志。掩码必须先按既有规则解析，不能把掩码文本当新 Token。无法确认同一凭据时不继承旧值；业务校验失败仍按原逻辑失败，不以恢复默认代替凭据校验。

测试 RPC 可返回按上述规则派生的 `resolvedSetup`；**实际保存 RPC 必须重新读取并校验当前连接/凭据与最终协议，再合并该字段**，不能相信之前的测试结果一直有效。先完成字段决策，再写凭据和配置；随后触发的后台刷新也遵循同一规则。同一连接的保存/刷新提交须串行或采用等效的失效检查，晚到的探活/刷新结果不能把旧凭据对应的上限写回；不要求为此新增持久化凭据摘要。纯重测不提前写配置，校验失败不改已有凭据与上限。没有新增输出上限编辑 UI，renderer 传入的任意 maxTokens 不作为本轮新授权值来源。

实施定位包括 `useOnboarding.ts` 的测试后保存链、`submit-helpers.ts:buildUApiSubmitPayload`、`handlers/rpc/llm-connections.ts` 的 TEST/SETUP 路径、发现/刷新 helper 与 Pi 初始化。新增回归必须经过实际 setup RPC，覆盖掩码编辑、显式输入同值 Token、更换 Token、协议变化、第二连接、无效旧值及异步结果晚到，最后保存→重载→启动→Pi 初始化；只改 helper 的测试不足以通过 G2。
- 首个候选不新增整套 custom endpoint UI，也不默认把输出上限提高为某个猜测值。未设置时沿用默认；已有合法设置传到 Pi。真实网关/模型可接受的上限尚未验证，因此“支持参数”不能记为“长对话压缩已实测修复”。
- 现状边界：`enforceUApiBaseUrl` 会显式设连接级 `supportsImages: true`；刷新 helper 保留 false 不等于完整启动后仍保留。回归应分别记录逐模型覆盖与连接级既有行为，不把这个已存在的差异误报成本次升级回归，也不顺手改变政策。

定位：[模型刷新](../packages/server-core/src/model-fetchers/index.ts)、[保留函数](../packages/server-core/src/domain/u-api-model-discovery.ts)、[启动归一](../packages/shared/src/config/storage.ts)。

### 3.2 生图与新的工具集合

`getSessionToolDefs` 新增 `profile/hasEnabledSources/hasProject` 过滤，默认不在 Coding 白名单里的工具会被隐藏。同步时必须同时处理 registry、Claude wrapper、Pi proxy 与主进程 callback。

- 普通完整会话仍有本地 `generate_image`；mini/title/summary、内部任务继续禁止执行。
- Coding 首个候选遵循上游的精简工具集合，不额外开放生图。正常模式的生图不能被 Coding 过滤误伤。
- `SessionManager` 继续保留 owner、workspace/session 身份、turn nonce、脱敏和可能扣费状态；不得把新会话延续/分支复制成可重放旧执行凭据。
- 使用 mock 证明跨 workspace、旧 owner/nonce、重复回调和未知扣费结果不会再次发送 Images POST；不能通过“测试自动重试”产生真实费用。

**factory、缓存和调用点合并规则（R2）。**

- `getSessionScopedTools` 的第 4 个参数合为一套 options，同时保留本地 `agentKind/paidImageTool` 和上游 `profile/hasEnabledSources/hasProject`。统一迁移 Claude full/mini 调用点，保留原 workspaceId；不能让两种参数对象互相覆盖。Pi proxy 同步使用相同 profile 默认值和工具可见性规则，主进程付费授权检查继续独立存在。
- 缓存身份必须包含 `sessionId、workspaceRootPath、agentKind、ownerKey、profile`；Coding 再包含有效的 `hasEnabledSources/hasProject`。未提供时归一为 `agentKind=full`、`profile=default`、无付费 owner；只有 Coding 使用的两个布尔条件才参与对应工具集合。角色、owner 或有效 profile 条件不同必须生成不同工具数组，不能复用捕获旧 owner 的 handler。
- 仅缓存工具数组；**每次 query 都创建新的 MCP server wrapper**，不复用带旧 transport 的 server。owner/nonce/完整缓存键不写日志。
- `cleanupSessionScopedTools(sessionId)` 要清掉该 session 的所有 owner、role、profile 变体，不能只删除旧格式的一个 key；`invalidateAllSessionToolsCaches` 仍全清。释放一个 session 不影响其他 session。owner 轮换后下一次 factory 不能返回旧 owner 闭包。

G3 至少补以下直接经过 factory/cache 的组合用例，不能全部用 callback registry 测试代替：同 session/workspace 的 full↔mini、普通↔Coding、owner A→B；Coding 来源/项目条件从无到有；session cleanup 与全局 invalidation 后重新创建；同一有效身份连续 query 的 wrapper 独立。验证 mini/Coding 不出现 generate_image，合法普通 full 只调用当前 owner 的 mock callback，无 owner/旧 owner 不产生付费 POST。

定位：[本地工具定义](../packages/session-tools-core/src/tool-defs.ts)、[host callback](../packages/shared/src/agent/paid-image-tool-registry.ts)、[生命周期测试](../packages/server-core/src/sessions/paid-image-lifecycle.test.ts)。

### 3.3 Pi 1.x 的新增行为与重试预算

SDK 从 Claude `0.3.280 → 0.3.302`、Pi `0.87.1 → 1.1.0`，不能只改 package.json。

- 接收 Pi 项目/全局 extension 隔离；普通会话与 ephemeral 会话都不能因工作目录下 `.pi/extensions` 获得额外执行路径。
- 保住本地 agent-level 等待上限：main 16 秒、ephemeral 4 秒。上游新文件仍写 60 秒，不整份覆盖；同时按 Pi 1.1.0 实际 API 重新验证 timeout/退避合同，不以延长测试超时代替修复。
- 上游 `buildCraftPiSettings` 新增 `cacheWarming: purpose === 'ephemeral' ? 'off' : 'streaming'`。其源码说明主会话会为保温重放带 1-token 输出上限的请求。**建议首个 U Agents 候选将 main/ephemeral 都显式设 off**，保持无新增保温调用的行为；网关是否支持相同缓存及计费收益为 UNKNOWN，后续需独立测量才能考虑开启。

定位：[当前 Pi settings](../packages/pi-agent-server/src/session-settings.ts)、[上游新 settings](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/pi-agent-server/src/session-settings.ts#L89)。

### 3.4 新发布路径与 Coding 品牌

- [上游 pages RPC](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/handlers/rpc/pages.ts#L443) 会解析 Claude 账号、读取凭据，再调用 SDK 发布。用 `pagesPublishingAllowed=false` 在该路径前置拦截；新增负例断言凭据读取、SDK query、上传均未发生。现有本地 Pages 能力不因此整体关闭。
- 新 `CodingWorkspacePanel.tsx:defaultWorktreeBranch` 返回 `craft/<session id>`。改为产品自己的 `u-agents/<session id>`，同步测试、占位提示与 PR 文案；用户自己指定的分支名不被强制改写。
- Coding 的短提示词仍须带上工作目录中的 CLAUDE.md/AGENTS.md、会话权限和 U-API 边界；不得因提示词精简丢失用户规则。
- 新建工作树可以隐式 fetch 默认分支，未在本机的仓库可以 clone。产品必须由用户操作明确触发；保留失败与已有路径处理，不能把显示仓库列表变成创建动作。

## 4. 依赖、中文与构建

### 4.1 依赖合并不能直接取上游整份

| 项目 | 当前与上游差异 | 处理 |
|---|---|---|
| 根 overrides | 本地 19 项，上游没有 | 逐项保留并检查新依赖兼容；不得为 install 成功全部删除 |
| Electron 范围 | 本地 `^39.8.10`，上游 `^39.2.7` | 保留本地下限；范围不同不等于 lock 实际已经降级，另核实际解析版本 |
| Bun types | 本地固定 `1.3.6`，上游 `^1.4.2` | 实施时核验包可获取性、API 与 runner 兼容后固定版本；不能照搬范围或盲目沿用旧类型 |
| Bun runner | 两个本地 workflow 当前 `1.3.12` | 选择可验证的同一版本；validate 与 Windows 构建及包内 Bun 分别核实，不能只改其中一个 |
| Office 转换 | 本地 Python/uv，上游根仍含 `markitdown-js` | 保留已落地的 Python/uv 链路与资源；不因 package 合并重新启用旧链路 |
| HEIC | 上游 server-core 新增 `heic-convert` | 合并依赖并验包内实际转换；不能用 Sharp 内置支持作替代证明 |

lockfile 以上游目标版本的新增依赖为参考，协调本地 `@u-agents/*`、overrides 和自有依赖后形成候选 lock；不删 lock 从头追全量最新版。最终必须能在干净环境 `bun install --frozen-lockfile`，且不再改 lock。

### 4.2 中文和更新日志

已对上游 en、zh-Hans 的 B→T 键和值逐项比较：每种语言 **251 新 key、11 删除、3 改值**；本地各有 **51 个相对 B 独有 key**（不是相对 T 的差值，最终数量需合并后重算）。

不能用上游 locale 整份覆盖本地。处理新 UI/Coding/设置文案、合法删除和上游改值，同时保住本地 U-API、生图与下载文案；其他 5 个 locale 的完整 parity/sorted/coverage 在实施时运行。本轮没有声称 7 语言验收已过。

新增的 7 份 `apps/electron/resources/release-notes/`：`0.14.1.md`、`0.15.0.md`–`0.15.5.md`，均须中文化、去外链/commit hash、清理上游品牌，并按实际开放范围删改描述。不能宣传已关闭的 Claude artifact、Decision、外部 provider 或尚未验证的“省钱比例”。

### 4.3 两个平台的包

本轮上游没有修改 `electron-builder.yml`、macOS/Windows build 脚本、`electron-build-main.ts` 与 `copy-subprocess-servers.ts`，但新的 SDK/模块必须在这些链路下重新验包。

- 保留 U Agents appId、安装包名、图标、自有更新/下载入口及 LICENSE/NOTICE。
- policy 文件仍进入 preload 可读取的资源位置；Pi subprocess、SDK binary、interceptor、WhatsApp worker、uv/Python 脚本完整。
- [Windows Candidate](../.github/workflows/windows-candidate.yml) 的 push 分支和 artifact 名仍硬编码 `codex/upstream-v0.14.0` / `U-Agents-0.14.0-windows-x64`，实施时改为新候选或使用实际版本生成；校验预加载入口仍以实际构建输出为准。
- 先 macOS arm64 测试包；再 Windows x64 CI 构建、静默安装与包内 runtime 检查，最后 Windows GUI。CI 安装成功不替代桌面对话、附件、生图与真实网关验证。
- 构建继续 `--publish never`，上传 Actions artifact 与正式 Release/更新服务器发布分开。

### 4.4 防止继承旧安装目录的运行时（R3）

联合适配上游新增 `runtime/inherited-app-env.ts` 及其测试、本地 `platform-headless.ts`、`bootstrap/headless-start.ts`、`runtime/resolve-script-runtime.ts`、`services/markitdown.ts` 与 Electron 导出的 runtime hints。不能只确认文件已入包，也不能只保留本地旧 platform 而跳过新防护。

- 对语义相同的运行时键采用非空 `U_AGENTS_*` 优先、实际保留的 `CRAFT_*` 兼容值回退。至少覆盖 APP_ROOT、RESOURCES_BASE、BUNDLED_ASSETS_ROOT、BUN、UV；当前仍消费的 `CRAFT_RESOURCES_PATH/CRAFT_SCRIPTS` 也进入明确的路径键清单。对未实际支持的别名不凭名称新增能力。
- 只有确认当前从源码 checkout 运行时，才把候选源码根与两组继承路径进行比对。识别 U_AGENTS 与兼容前缀中属于其他安装/checkout 的根，检查其下的运行时路径；不能因为 U_AGENTS 主根有效，就漏掉指向旧安装的 CRAFT 脚本等兼容值。
- 清理范围限于经验证属于其他安装根的**运行时路径键**，再从候选重新解析资源；不能按前缀清空环境。保留 `U_AGENTS_CONFIG_DIR/CRAFT_CONFIG_DIR`、网络代理、用户模型凭据及其他非运行时变量。无法判定来源的自定义工具路径须明确记录，不静默改写成候选，也不把它算作候选捆绑资源的验收证据。
- 源码模式不能沿用旧应用的 packaged 状态；`U_AGENTS_IS_PACKAGED/CRAFT_IS_PACKAGED` 按实际消费点统一归一。合法 bundled 模式保留自身资源路径，不能以“位于源码根以外”为由清掉安装包目录。

新增回归向隔离进程注入旧安装的 U_AGENTS hints，再加入两前缀混合和兼容键场景；断言候选 appRoot、Pi/Claude runtime、uv/Office 脚本的实际解析路径和所测版本来自预期候选，配置隔离根未丢。另测合法 bundled 资源不变及 packaged 标志的实际取值。不能仅用设置页版本号或“文件存在”证明运行的是候选；明确允许的系统 fallback 也须与候选捆绑资源分开记录。

上游依据：[继承路径判断](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/runtime/inherited-app-env.ts#L45)、[headless 接入](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/runtime/platform-headless.ts#L52)。

## 5. 执行顺序

以下供后续明确授权的实施任务执行，**本轮未运行**。

1. **W0 固定基线**：重新核对 O、origin/main 与目标 tag；任一 SHA 变化即重算交集。不清理原未跟踪项。确认旧安装包和恢复路径；未启动新版本前不接正式数据。
2. **W0.5 先建立进程隔离（R1）**：按 §5.1 准备合成测试根、Bun 启动前环境和进程文件/网络限制。首次安装的 prepare hook、定向测试、完整 test、isolated 子进程、构建与包内 smoke 均受此约束；未满足时不运行依赖这些条件的步骤。合成测试不要求退出用户正在使用的应用。
3. **W1 建立隔离候选并集成**：从 O 创建 `codex/upstream-v0.15.5` 与独立 worktree，fetch 固定 tag 并校验 T，再 merge 该 tag。worktree 与主 checkout 共享 Git 数据库/refs，不能宣称“主仓库 refs 完全不变”。记录实际冲突；逐模块解决 §3/§4，包括 wrapper 缓存身份、继承 runtime guard、编辑 Token 保存链与 44 个标记文件。不得整目录 ours/theirs 覆盖。
4. **W2 完成集成门禁**：禁止发布、Decision、目录隔离和付费生命周期必须在首次验证/启动前到位。关键冲突按最终方案解决后才结束 merge；不用“后续会补”当作可运行状态。复核全部 216 个 marker 的语义，新增/退役逐项记账。
5. **W3 验证候选**：先确认 G0 通过且隔离对子进程仍有效，再做定向测试与依赖/干净构建，之后跑完整统一检查。R2 factory/cache 组合、R3 防串运行时、R4 编辑保存链均须有具体结果。真实 Git 冲突数与测试结果在实施记录填实，不把静态分析替代为 PASS。
6. **W4 平台候选与隔离验收**：产出测试包、SHA-256、精确源码 SHA/版本；包内 smoke 同样先满足 G0，验证真实执行路径来自候选。验证干净首次配置和旧版本升级副本。首次数据演练使用合成数据；真实数据须先正常退出应用，留原样备份，再做脱敏、重映射的运行副本。
7. **W5 验收后交付**：测试结果、未过项和恢复方法可审阅后，再处理合回主线及正式发布。不能因本方案已写完而视为已授权 push、发布或改正式更新源。

固定目标的命令骨架如下；worktree 实际绝对路径由实施时选择，先确认目标路径不存在且不占用其他任务。

```bash
git worktree add -b codex/upstream-v0.15.5 <独立候选目录> 2c496aaa7871fb4beaf99b63c0ef5746b89fe55e
cd <独立候选目录>
git fetch --no-tags upstream tag v0.15.5
git rev-parse 'v0.15.5^{commit}'
# 必须为 cede6ea49e0c4a42933ed0f1bc129db698fc581f
git merge --no-commit --no-ff v0.15.5
# 按本文完成所有冲突与产品适配，再提交和验证
```

不得 merge 当前缓存的 `upstream/main`；不得执行 reset/clean、删除正式数据或用正式目录直接试迁移。

### 5.1 Bun/preload 之前的隔离合同（R1）

下列是后续执行环境的前置条件，本次不创建目录、不改环境、不运行脚本。

1. **进程启动前设根。** 在启动任何 Bun/安装 hook/测试进程之前，由父进程为其指定同一专用合成配置根的 `U_AGENTS_CONFIG_DIR` 与 `CRAFT_CONFIG_DIR`。使用已确认的一次性绝对路径，拒绝缺失、两者冲突、指向正式目录或经符号链接落到正式目录的配置。不能等 beforeAll、测试 import 或应用初始化后再赋值；不重设全局 HOME。
2. **约束实际 I/O。** 进程限制须阻止访问真实 `~/.u-agents`、`~/.craft-agent`、凭据与用户 workspace，并允许测试所需源码、依赖及合成路径。配置变量只能选根，不能代替访问限制；合成 config 中 workspace、session 工作目录、附件、脚本等引用也要验证，旧自动化与后台定义不得实际执行。
3. **区分依赖下载和业务外发。** 依赖准备只允许已确认的包源/构建资源下载，不放开模型和发布服务。测试与 smoke 默认只允许指定的 mock/loopback，禁止真实网关、OAuth 发送、发布和付费图片请求；真实业务验收仍归 G12，不能借全量测试顺便执行。
4. **对子进程继续生效。** 定向测试、`bun run test`、isolated 子进程、SDK/Pi/Office helper、构建和包内 smoke 均继承或明确重设安全的根与限制；不允许默认回退到用户目录。刻意测试“参数缺失”的负例须运行在仍拒绝正式目录和外发的受控子进程中；纯路径计算可传合成参数，不能为通过负例而解除保护。
5. **先失败，再启动被测逻辑。** 父进程先校验参数与访问策略，缺少条件即停止该验证步骤并记 NOT_RUN。准备完成后，用无凭据、无网络的受控探针确认首个 Bun preload、`CONFIG_DIR` 与凭据后端解析一致；仅记录合成路径、拒绝结果和策略状态，不读取真实配置内容作“验证”。

G0 的通过证据必须早于 W3 测试日志：包含测试根、父/子进程根一致性、受控访问拒绝和网络限制结果。正式目录的零访问由执行限制及可取得的审计证据支持，不能仅靠前后文件 hash 未变化证明。没有可用的受控执行条件时保留 NOT_RUN，再选择具备条件的执行环境，不直接在用户默认环境尝试。

## 6. 验收门槛

所有条目当前均为 **NOT_RUN**。以下是实施门槛，不是本轮结果。

| 编号 | 需要证明什么 | 验证入口 |
|---|---|---|
| G0 | 任何 Bun/preload 前已建立隔离；父/子进程及包内 smoke 使用合成根，访问/网络限制有效；缺参在被测逻辑前失败 | W0.5、§5.1；受控环境前置证据，不由 afterAll/hash 对照替代 |
| G1 | 只填 Token、固定网关、多 Token、目录发现/降级、默认模型和图片能力不退化；禁止组合在取凭据前拒绝 | discovery、refresh-preservation、refresh-storage.isolated、llm-connections-uapi-policy.isolated |
| G2 | maxTokens 按 §3.1 的同 Token/协议保留及更换重置规则，经实际编辑→测试→setup RPC 保存→重载→启动→Pi 初始化生效；后台刷新遵循同一规则；100K–1M 阈值映射到 Pi | 新增掩码/同值/换 Token/换协议/第二连接/无效值回归；refresh/storage、auto-compact-window、session-settings |
| G3 | §3.2 的 factory/cache 身份不串、wrapper/cleanup 正确；普通 full 仅绑定当前 owner，mini/Coding/internal 不执行生图；旧 nonce/跨 workspace 不发付费请求 | 新增直接 factory/cache 组合回归；tool-defs-filtering、paid-image-lifecycle/redaction/registry |
| G4 | 新旧发布 RPC、Decision test/probe/keys、Pages script/refresh 仍拒绝；API/MCP 与普通自动化可用 | pages-feature-policy、decision/guarded、u-agents-semantic-policy；新增 artifact 零调用负例 |
| G5 | Pi 1.1.0 的 main/ephemeral 预算保持，保温关闭，项目/全局扩展不被加载 | session-settings、agent-dir、utility 请求 mock |
| G6 | Coding 默认关闭、旧会话不转换、切模式新会话保留模型/权限/来源；新目录、PR 查询无自动写 GitHub | coding-mode、coding-repos、pr-watch、UI |
| G7 | 费用增量/分支统计、Source 失败、停止与后台结果、登录共享、密码脱敏行为正确 | turn-usage、background-task、source-oauth、browser-password-redaction |
| G8 | 中文、品牌、用户可见链接、7 份版本日志正确，Fork 独有 key 保留 | locale parity/sorted/coverage、品牌扫描、人工 UI 核对 |
| G9 | 依赖可重现且下限不倒退；无旧 scope；216 marker 逐项处置，START/END 成对 | frozen install、lock 审查、§14 全格式扫描、git diff --check |
| G10 | 包内资源完整且实际执行候选代码；§4.4 的 U_AGENTS/兼容继承提示不串旧安装，配置根保留，合法 bundled 模式不受误清理；首次启动、对话、HEIC/PDF/Office 可用 | 新增 inherited-app-env/headless/资源路径联动回归；clean build、macOS 包内/GUI、Windows workflow/GUI |
| G11 | G0 的进程限制在运行/迁移副本中持续有效；配置、凭据及 workspace/session/附件不指向原件，自动化/脚本不意外外发；旧包恢复有实证 | upgrade-isolation-preflight、secure-storage-config-dir、隔离运行与恢复演练；不与首次测试环境前置混为一项 |
| G12 | 正式网关、长对话、真实生图与扣费、自动更新 | 有记录的业务/平台验收；本地 mock、CI 或“设置可保存”不能替代 |

**以下验证命令均以 G0 已通过为前提，使用 §5.1 的父进程环境和限制启动，不能在默认用户环境直接照跑。** 候选应运行 `bun run validate:ci`、`bun run lint`、`bun run test`（含 isolated 入口）、`bun run electron:clean` 后 `bun run electron:build`。版本协调完成后再以 frozen install 重跑可重现性。现有测试/脚本名以候选实际 package.json 为准；不跳 hook、不临时放宽断言或增加 skip 取得绿灯。

旧文档中的“清空应用数据”命令只可面向明确的一次性测试根；不得指向真实 `~/.u-agents`、`~/.craft-agent` 或用户 workspace。原样恢复备份不改路径；演练运行副本另做路径映射并暂停自动任务，配置根环境变量本身不足以证明运行隔离。

## 7. 44 个带标记的交叉文件

以下不是自动接受清单；各文件原有 marker 的行为均须核对，未改到 marker 所在行也不能免查调用链。

- `apps/cli/src/index.ts`
- `apps/electron/src/main/browser-pane-manager.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/electron/src/renderer/App.tsx`
- `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`
- `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts`
- `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx`
- `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx`
- `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx`
- `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx`
- `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`
- `apps/electron/src/renderer/components/pages/PageView.tsx`
- `apps/electron/src/renderer/components/ui/EditPopover.tsx`
- `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`
- `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx`
- `packages/core/src/types/index.ts`
- `packages/pi-agent-server/src/index.ts`
- `packages/pi-agent-server/src/session-settings.ts`
- `packages/pi-agent-server/src/tools/web-fetch.ts`
- `packages/server-core/src/domain/connection-setup-logic.ts`
- `packages/server-core/src/handlers/rpc/files.ts`
- `packages/server-core/src/handlers/rpc/settings.ts`
- `packages/server-core/src/services/index.ts`
- `packages/server-core/src/sessions/RemoteBrowserPaneManager.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/session-tools-core/src/context.ts`
- `packages/session-tools-core/src/handlers/index.ts`
- `packages/session-tools-core/src/index.ts`
- `packages/session-tools-core/src/tool-defs-filtering.test.ts`
- `packages/session-tools-core/src/tool-defs.ts`
- `packages/shared/src/agent/backend/pi/session-tool-defs.ts`
- `packages/shared/src/agent/backend/types.ts`
- `packages/shared/src/agent/claude-agent.ts`
- `packages/shared/src/agent/core/__tests__/guarded-mode.test.ts`
- `packages/shared/src/agent/index.ts`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/agent/session-scoped-tools.ts`
- `packages/shared/src/config/llm-connections.ts`
- `packages/shared/src/config/preferences.ts`
- `packages/shared/src/config/storage.ts`
- `packages/shared/src/sources/credential-manager.ts`
- `packages/ui/src/components/chat/TurnCard.tsx`
- `packages/ui/src/components/markdown/MarkdownImageBlock.tsx`

## 8. 证据与未知项

- [最新正式版 v0.15.5](https://github.com/craft-ai-agents/craft-agents-oss/releases/tag/v0.15.5)、[目标提交](https://github.com/craft-ai-agents/craft-agents-oss/commit/cede6ea49e0c4a42933ed0f1bc129db698fc581f)、[完整 tree API](https://api.github.com/repos/craft-ai-agents/craft-agents-oss/git/trees/cede6ea49e0c4a42933ed0f1bc129db698fc581f?recursive=1)。
- [新 endpoint 配置字段](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/shared/src/config/llm-connections.ts#L105)、[工具 profile 过滤](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/session-tools-core/src/tool-defs.ts#L805)、[新发布 RPC](https://github.com/craft-ai-agents/craft-agents-oss/blob/cede6ea49e0c4a42933ed0f1bc129db698fc581f/packages/server-core/src/handlers/rpc/pages.ts#L443)。
- [既有 v0.14 实施记录](UPGRADE-EXECUTION-v0.14.0.md) 仅作历史参考；本次 main/远端 SHA、源码、标记和 manifest 均重新核实。旧测试数字不作为 v0.15.5 验收结果。
- UNKNOWN：实际 Git 冲突数、最终 lock 解析图、合适的 Bun/types 新组合、网关最大输出与缓存计费、两平台运行与真实升级/恢复结果。
- 本文提出的 cacheWarming 默认关闭、Coding 的产品分支前缀、artifact 后端拦截等是**本轮建议实施项**，不表示现有源码已完成。

