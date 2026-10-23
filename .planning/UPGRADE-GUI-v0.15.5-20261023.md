# v0.15.5 macOS GUI 验收记录

> 2026-10-23。结论：**HOLD，不能标记 GUI 整体通过**。发现空 Token 完成页停滞、隐藏的会话分享入口仍可见，以及中文漏翻译。本轮未修改产品源码，未合主线、push 或发布。

## §1 候选与证据范围

- 分支：`codex/upstream-v0.15.5`；包内源码：`88d8cc7b0f81215418b2299f95edd70fd177cec9`；目标 tag：`cede6ea49e0c4a42933ed0f1bc129db698fc581f`。
- 原 DMG、ZIP 及原 `.app` 保留，校验值与 [实施记录](UPGRADE-EXECUTION-v0.15.5-20261022.md) 一致。本轮没有重新构建产品包。
- 证据根：`/private/tmp/uagents-v0155-execution-20261022/gui-qa-20261023`。合成配置根：`/private/tmp/uagents-v0155-execution-20261022/gui/config`；工作区 ID：`54be4665-1c7e-cddb-7c08-72e71b744655`。
- 桌面工具存在自动重启应用的行为。事故后改用专用 `U Agents GUI QA.app`，独立 bundle ID，原生入口固定环境及外层 sandbox，再执行原 Electron 程序；每次业务界面操作前核对专用路径和工作区 ID。
- 专用副本有 2,122 个文件/链接与原包逐字节一致；13 项差异属于入口、`Info.plist` 和重新签名，另增加改名后的 Electron 程序。所有 `Contents/Resources/app/` 文件一致；变动的 framework 和 Electron 程序代码节逐项一致。证据：`guarded-clone-manifest-comparison.json`。
- 因入口、bundle ID 和签名不同，后续结果只证明相同产品载荷的 GUI 行为，**不替代原 DMG 的安装、原入口及正式签名验收**。原包 adhoc、未公证的边界不变。

## §2 GUI 结果

| 项目 | 结果与证据文件 |
|---|---|
| 欢迎页与品牌 | U Agents 欢迎页、应用菜单、U-API Token 入口正常。所查看页面未见 Craft 品牌；不等于全仓品牌审计。`01-welcome.png`、`38-app-menu.txt` |
| 首次配置 | **FAIL，G-01**。仅 Token 输入框，无 provider、URL、协议或模型 ID 输入；空值继续后停在保存状态，间隔 56.3 秒仍未完成。`05-*`、`06-*` |
| 中文界面 | 导航、菜单、会话、主要设置已显示中文；**FAIL，G-03**。Token 页按钮和错误、Chat Starters 区域仍为英文。`08-*`、`10-*`、`12-*` |
| 连接设置 | 最后一个连接的删除项禁用；新增与编辑均为 Token 入口，无其他 provider。`11-connection-menu.txt`、`12-token-edit.txt`、`17-add-connection.txt` |
| 空 Token 编辑 | **FAIL，G-01**。已有合成凭据时也停在保存页；19.5 秒后仍未完成，可用 Esc 关闭浮层。没有改模型目录、凭据和 cap。`13-*`、`14-*` |
| 模型选择 | 合成的两个模型均可见，默认值通过 GUI 切至 `synthetic-long-context`；重读配置确认持久化，cap 仍为 32768。`15-*`、`16-*`、`gui-20261023-synthetic-credential-verification.log` |
| 新会话与 Coding | 新会话默认关闭 Coding；开启和关闭成功，权限菜单有探索/询问/执行，无独立 Decision 入口。没有发送模型请求。`24-*`—`26-*` |
| 会话显示与状态 | 本地合成消息的 Markdown、表格、代码块正常；切到待审查和看板成功。消息为预置测试数据，不是实际推理结果。`07-*`、`34-*`、`35-*` |
| HEIC | 从原生文件选择器选取合成 HEIC，草稿显示转换后的彩色缩略图。没有发送附件；最终模型载荷沿用此前包内 smoke，不能称为真实模型接收通过。`27-*`、`28-*` |
| PDF | GUI 选择成功；已存合成 PDF 可打开预览并显示彩色页面。`29-*`、`31-pdf-preview.png` |
| Office | GUI 选择 DOCX 成功；此前包内转换的 Markdown 文件存在、内容正确。点击已存 DOCX 后未观察到文档预览，**查看能力保留待验**。`30-*`、`32-*` |
| 数据源、技能、自动化 | 导航及空状态打开正常；添加自动化打开自然语言编辑器，没有提交或执行任务。连接外部服务、实际自动化及完整动作矩阵未验。`18-*`、`19-*`、`21-*`、`23-*` |
| 本地 Pages | GUI 创建空白本地页面成功；菜单只有重命名、打开文件夹、刷新预览、删除页面，未见公开发布入口。未运行脚本或定时刷新。`36-*`、`37-*` |
| 会话公开分享 | **FAIL，G-02**。标题栏操作菜单出现“共享”，对应直接上传路径。未点击该项。`33-session-actions.*` |
| 版本及更新入口 | 设置页显示 0.15.5，立即检查、手动下载按钮可见；未点击下载/安装。应用启动的更新检查见 §4，不能记为自动更新验收通过。`09-app-settings.*` |

## §3 已确认问题与 TODO

### G-01 / P1：空 Token 路径进入永远保存的完成页

首次配置与已有连接编辑均可复现。[useOnboarding.ts:233](../apps/electron/src/renderer/hooks/useOnboarding.ts#L233) 初始化 `completionStatus = 'saving'`；[空值分支:440](../apps/electron/src/renderer/hooks/useOnboarding.ts#L440) 仅切换 `step`，没有保存或把完成状态设为 `complete`。向导据此展示 [CompletionStep](../apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx#L179)。首次配置又使用固定的 `editingSlug`，占位连接因此走进编辑空值分支。

同一分支已存在于 O=`2c496aaa`，属于既有问题，仍阻塞当前候选的首次使用。TODO：首次配置必须拒绝空 Token；已有凭据的空值编辑要正确完成并关闭，不改变目录、默认模型、cap 或凭据。补覆盖真实 Hook/完成页状态的回归；已有 RPC/storage/cap 测试通过不能代替这条 UI 链路。

### G-02 / P1：会话分享入口违反隐藏功能要求

[09-test-checklist §11](09-test-checklist.md#11-会话分享m1-隐藏功能) 和 `PRODUCT.md` 要求工具栏及菜单均找不到会话分享入口。GUI 中 [SessionMenu.tsx:122](../apps/electron/src/renderer/components/app-shell/SessionMenu.tsx#L122) 仍渲染“共享”；`useSessionMenuActions.share` 调用 `shareToViewer`，再到 [SessionManager.shareToViewer:5665](../packages/server-core/src/sessions/SessionManager.ts#L5665)，后者会向 `VIEWER_URL + /s/api` POST 完整会话，函数入口未见禁用判断。

O 中也保留同一菜单及后端路径，不能归因为本次升级新增。TODO：统一核对列表、标题栏、紧凑布局和上下文菜单的隐藏规则；明确并补齐后端拒绝策略。此次没有点击分享、生成分享链接或发布数据。Pages 的发布门禁不能证明会话分享也受保护。

### G-03 / P2：中文漏翻译和误导性连接错误

中文 Token 页仍显示 Back、Continue；`primitives.tsx` 的默认按钮文本为英文。服务端 [parseTestConnectionError:38](../packages/server-core/src/domain/connection-setup-logic.ts#L38) 返回固定英文错误，提示检查页面没有提供的 URL。另有 [zh-Hans.json:1138](../packages/shared/src/i18n/locales/zh-Hans.json#L1138) 的 8 个 `settings.ai.chatStarters.*` 值直接保留英文，GUI 可见。

TODO：按钮使用 locale，连接错误返回可本地化分类、结合固定网关提示；翻译 Chat Starters 的标题、说明、字段、空状态及按钮。没有修改 locale 或组件。

## §4 隔离事故与已授权恢复

本轮前段发生两次隔离失效，因此 **G0/G11 不能按整轮无事故记 PASS**。

1. 旧 sandbox 允许全部 localhost 出站；系统代理位于 127.0.0.1:6152/6153，应用的启动更新检查经代理成功访问更新服务。最初的直接公网 EPERM 探针不足以证明零外发。随后正常退出，并将 GUI 出站限制为本机 RPC 18656，追加 `--no-proxy-server`；公网、HTTP/SOCKS 系统代理三项均被 OS 拒绝。
2. 桌面工具在原隔离进程结束后，自动重启了原候选 app，未携带隔离环境，实际读取正式会话列表。发现后立即退出。正式 `config.json` 和 `window-state.json` 的修改时间变化；不能声称正式 profile 未被接触，也不能证明该应用未读取/使用正式凭据。
3. 用户随后分别授权只读比较正式配置与既有备份，以及只恢复 `models`、`defaultModel`。比较确认配置 JSON 仅有这两项变化：10→6 个模型，默认 `gpt-6-astra`→`gpt-6.1-sol`。现已只恢复这两项，其他字段未变；没有覆盖整份配置。
4. 核对及恢复程序没有读取 Token 或 `credentials.enc` 内容；凭据文件仅查看元数据，其修改时间未变。没有写回 `window-state.json`；缺少此前备份，窗口状态的具体影响仍为 UNKNOWN。`config-defaults.json` 的文件时间也落在误启动时段，缺少此前基线，内容未读取或恢复，影响未核实。事故期间没有由本轮 GUI 操作发起对话、生图或分享，不能据此宣称整个误启动进程零外发。

事故截图及会话文本仅保留于 `incident-private/`（目录 0700、文件 0600），不进入交付证据副本。脱敏核对结果见 `formal-config-readonly-comparison.json`、`formal-config-restoration.json`。

专用原生入口使桌面工具再次自动启动时也先进入隔离；后续操作持续核对专用路径及合成工作区。`guarded-runtime-identity.json` 记录实际进程的双配置根。收尾探针再次确认直接公网与系统代理被拒绝；严格子阶段通过不抹去上述事故。原有其他 stage 的宽 localhost 策略不能继续当作 GUI 的安全入口。

## §5 追加授权的真实连接只读验证

用户明确授权仅访问 `token.u-studio.cn`，使用其手动输入的 Token 获取模型列表并检测连接，不发送对话或生图。由于应用内 Continue 会在目录发现之后继续进行模型推理探测，未在该按钮上放行真实网关。

改用独立本机只读页：仅执行 `GET https://token.u-studio.cn/v1/models`，证书校验开启，不跟随重定向；只读服务仅能连接专用本机 tunnel，tunnel 只接受该固定网关的 443 CONNECT，其他主机在连接前拒绝。此服务不读正式配置，Token 不进 URL、配置或日志，提交后清空输入。原生测试 app 仍保持断网。

第一次请求失败，原因是验证通道的 DNS 被 sandbox 拒绝；修正为预解析的固定网关地址后，无 Token 请求返回 401，TLS 验证通过。用户重新输入并提交后，于北京时间 2026-10-23 02:01:05 收到 **HTTP 200，6 个模型**：`gpt-5.5`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`、`gpt-6.1-sol`、`minimax-m3`。

证据：`real-models-readonly-result.json`、`readonly-models-network-policy.json`、`22-real-models-result.png`。这是网关可达、Token 鉴权和目录读取通过，**没有证明应用内自动选型/推理探活/保存全链路通过**。真实对话、长上下文、生图及扣费、自动更新仍 NOT_RUN；G12 仅此只读子项通过。未将真实模型目录写入正式配置或合成连接。

## §6 收尾与下一步

- 专用测试 app 正常退出；本轮只读验证页关闭，验证服务及 tunnel 停止，18656/18556/18657 端口释放。
- 合成凭据复核仍为不可用的 fixture Token；合成默认模型切换已保存，32768 cap 保留；没有保留用户在只读页输入的真实 Token。
- 正式配置两个获准恢复的字段再次核对正确；原 checkout 的 10 个未跟踪文件哈希和 HEAD/main/origin-main 均保持原值。
- 产品源码未改，候选只新增/更新验收文档与本机测试辅助材料；DMG/ZIP 保持原校验值。未合主线、push、覆盖安装或发布。
- 后续先处理 G-01/G-02/G-03，收紧所有相关运行阶段的隔离入口，再重打候选包并补受影响的 GUI 回归。Office 查看、原入口/安装、Windows 和其余 G12 项继续保留未验状态。
