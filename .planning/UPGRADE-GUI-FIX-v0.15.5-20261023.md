# v0.15.5 macOS GUI 问题修订与复验

> 延续用户已授权的独立工作区升级任务。仅在 `codex/upstream-v0.15.5` 修改、构建与验收，不合主线、push 或发布。不再写正式 profile。此前 GUI HOLD 与隔离事故见 [原验收记录](UPGRADE-GUI-v0.15.5-20261023.md)，本记录不覆盖历史结论。

修订源码为 `bb605b286d863927a5e28f97267df04ee0b0a1b6`。**G-01/G-02/G-03 均已在隔离 GUI 中复验闭环**；自动检查、新包完整性和包内运行通过。结论只覆盖本次三项修订与列明的合成场景，不代表真实推理、付费工具、正式 profile 或原包安装验收通过。

## 修订范围

| 问题 | 实现 | 自动验证 |
|---|---|---|
| G-01 空 Token 停在保存页 | 首次配置和未认证连接拒绝空 Token；只有设置页明确确认已有凭据的编辑才能空值完成，关闭浮层，不改凭据、模型、默认值或 cap | 真实 React Hook 五种状态均通过，全部零 RPC |
| G-02 会话分享仍可见 | 普通/紧凑菜单和预留分享组件统一关闭；RPC 与 SessionManager 双层拒绝 share/update/revoke，在取会话或网络前返回失败 | 实际 handler 和实际 service 方法覆盖新会话、旧分享、缺失会话及三命令；零会话访问、零网络 |
| G-03 中文漏翻译 | Back/Continue/Loading 使用 locale，Chat Starters 八项中文化；连接错误映射到固定网关文案，不建议修改 URL/provider，不回显 SDK 原文 | 分类、翻译、脱敏回归通过；七份 locale 各 2,158 keys，排序、parity、2,382 个调用覆盖检查通过 |

当前所有源码变更均避开 `CLAUDE.md` §3.3 高冲突文件；依赖清单和 lockfile 未变。改造点逐文件核对见 [登记表](14-uapi-marker-registry.md#0-当前基线速查)。

## 本轮隔离

证据根为 `/private/tmp/uagents-v0155-execution-20261022/revision-20261023`。所有 Bun/preload、构建和应用进程由父入口先设定相同的两个 CONFIG_DIR，HOME 保持原值；外层 macOS sandbox 拒绝正式 profile、其他用户文件和主 checkout 内容。

- GUI/包内运行只允许本机 18656；明确禁止系统代理 6152/6153 和其他外网连接。
- 测试仅允许源码测试固定端口及 macOS 临时端口的逐端口清单，排除代理和资产/真实验证通道；不是任意 localhost 放行。外网和两种系统代理探针均为 OS_DENIED，自己的临时测试服务器可连接。
- 准备/DMG 只允许本机 18555 资产通道。若无需下载，通道保持关闭；不会借此访问业务网关。
- 旧 release 已 APFS 克隆归档到 `revision-20261023/previous-release`。DMG/ZIP 摘要及 app 全部 2,135 文件/链接一致，随后清理旧 dist/release 再测试与构建。
- GUI 使用独立 bundle ID 和固定原生隔离入口的专用副本，避免桌面工具自动重启时丢失环境；产品载荷必须与最终包核对。首次配置与已有合成凭据分别验收。
- 实际进程复核两个 CONFIG_DIR 均为合成根，HOME 保持原值，启用 `--no-proxy-server`。Office 复测阶段仅在测试父入口加入 `UV_OFFLINE=1`，强制使用已缓存依赖；没有修改产品载荷或开放外网。运行身份见 `gui-qa/runtime-identity.json`。

原 GUI 事故中正式 `models`、`defaultModel` 已按用户单独授权恢复；窗口状态及 config-defaults 缺少事故前证据，仍为 UNKNOWN。本轮不会据此宣称整次升级未触碰正式数据。

## 自动检查

| 检查 | 结果 | 日志（相对证据根） |
|---|---|---|
| 完整测试 | 6,743 pass、12 原有 skip、0 fail；16 个 isolated 入口另 195 pass、0 fail | `logs/full-tests.log` |
| validate:ci | 全包 typecheck、shared 合同、20 项文档工具、i18n PASS | `logs/validate-ci.log` |
| lint | 0 errors，Electron 165/shared 14/UI 11 warnings，数量同首轮 | `logs/lint.log` |
| G0 | 正式 config/credentials 和主 checkout 文件读被拒；外网及系统代理连接被拒；合成配置根和自有临时服务器可用 | `logs/g0-preload.log`、`logs/g0-network.log` |
| GUI 收尾 G0 | 固定入口再次拒绝打开正式 config/credentials、主 checkout 与仓库依赖文件，未读取其内容；公网、HTTP/SOCKS 系统代理和资产端口均被 OS 拒绝 | `artifacts/gui-g0-closeout.json` |
| clean build | PASS，清理旧 dist/release 后重新构建和 staging | `logs/clean-build.log`、`logs/stage-runtime.log`、`logs/copy-subprocess.log` |
| DMG/ZIP | PASS，2,136 文件/链接完全一致，DMG checksum、ZIP CRC、双方 codesign deep/strict；Bun 17 个 Mach-O 节一致 | `artifacts/package-verification.json`、`logs/package-verify.log` |
| 包内 Pi/QuickJS | PASS，实际包内 Bun/Pi 在仓库外启动；loopback 请求确有一张图片及 32768 输出上限，QuickJS WASM 执行得到 42 | `logs/package-pi-smoke.log`、`logs/package-quickjs.log` |
| 包内原生 RPC | PASS：HEIC→JPEG、缩略图/预览、PDF 二进制往返、Office→Markdown；9 个分享负例返回固定禁用错误，历史分享元数据未改变 | `logs/packaged-native-rpc.log`、`artifacts/packaged-sharing-policy.json` |
| HEIC→Pi 完整链 | PASS：本次包内 RPC 转出的 JPEG 再进入包内 Pi 的 loopback 请求，图片数量 1，输出上限 32768 | `logs/package-pi-heic-smoke.log` |
| 原 checkout | HEAD/main/origin-main 仍为 O，原状态及 10 项未跟踪文件哈希一致 | `artifacts/original-checkout-verification.json` |

## 包与 GUI 复验

新包已生成，adhoc 签名、未公证，构建参数明确为 `--publish never`。首次 builder 尝试下载 Electron 被关闭的资产通道拒绝，改为使用已安装且已校验的 `node_modules/electron/dist`，没有重新下载、放宽网络或修改产品构建配置。包来源验证与 runtime staging 均以当前源码为准。

| 产物 | bytes | SHA-256 |
|---|---|---|
| `apps/electron/release/U-Agents-arm64.dmg` | 328,840,846 | `aa7af1a7dda8906a016ab695caeeea6a7d9737ddc50b19d0d96d692c76a06a28` |
| `apps/electron/release/U-Agents-arm64.zip` | 318,394,092 | `7971a64df971d02185a4506e014996aa116b826ca64b404912a56eb649d8a519` |

两个专用 GUI 副本各有 2,123 文件/链接与原包一致；13 项差异为固定隔离入口、bundle ID/专用 URL scheme 与重签名，另增加改名后的原 Electron 程序。`Contents/Resources/app/` 全部逐字节一致；变动的 Mach-O 代码节逐项一致。证据为 `gui-qa/guarded-clone-manifest-comparison.json`。副本 GUI 结果仍不替代原包安装、原入口或正式签名验收。

| GUI 项 | 结果与证据（GUI 文件相对 `gui-qa/`；`artifacts/` 相对证据根） |
|---|---|
| 首次配置空 Token | PASS。独立全新配置根不含凭据，工作区 `07679249-2515-4d3c-bfe7-4045a85b5dd7`；点击 Continue 后立即提示 `Please enter your U-API Token.`，停留在输入页，后续观察仍无保存状态。`01-fresh-empty-token.*`、`02-fresh-empty-token-stable.txt` |
| 已有凭据空 Token 编辑 | PASS。点击“继续”后立即回到 AI 设置，浮层关闭，无保存停滞。凭据文件 hash、模型目录、默认 `synthetic-long-context`、协议与 cap 32768 均与事前基线一致。`04-*`、`05-*`；额外核对见 `artifacts/empty-edit-preservation.json` |
| 中文 Token 流程 | PASS。“返回”“继续”显示中文；新增连接空值提示“请输入你的 U-API Token。”；填入不可用合成 Token 后，断网提示为“连接 U-API 服务失败，请检查网络或稍后重试。”，不再提示修改 URL。失败输入未保存，仍只有一个原连接，原凭据及目录/cap 未变。`04-*`、`06-*`、`07-*`；`artifacts/failed-token-preservation.json` |
| 会话开场提示 | PASS。标题、说明、空状态、名称/提示词字段、两个占位提示与添加按钮均显示中文；未提交提示词。`03-ai-settings-chinese.txt`、`05-empty-edit-completed.png` |
| 历史分享会话 | PASS。仅本地 `example.invalid` 元数据夹具；桌面标题菜单、列表下拉、列表右键、紧凑标题抽屉和紧凑列表抽屉均无分享/已分享动作。`08-*`、`10-*`、`11-*`、`12-*`、`18-*` |
| 新建未分享会话 | PASS。同样五个入口全部隐藏分享，Coding 初始关闭，没有发送聊天请求。`13-*`、`14-*`、`15-*`、`16-*`、`19-*` |

紧凑布局通过原生 View → Zoom In 触发真实响应式断点，未注入 DOM 或切换测试实现；验完通过“重置缩放”恢复。桌面列表的更多按钮先悬停再展开，最终记录必须确实含菜单内容；`09-desktop-list-trigger-before-open.txt` 只保留中间观察，不列为菜单通过证据。

包内 Office RPC 首次复测因 uv 尝试刷新 PyPI 元数据而被 G0 拒绝（`logs/packaged-native-rpc-before-offline.log`）。正常退出后，仅修改隔离父入口以启用 `UV_OFFLINE=1`，从现有缓存完成转换，随后 HEIC/PDF/Office 全部通过。此结果证明缓存条件下的包内转换，不证明无缓存冷安装或 DOCX 查看器通过。

首次配置完成后曾遇到 Mac 锁屏；用户手动解锁后继续完成其余 GUI 检查。没有用其他通道代替 GUI 点击验收。

本轮收尾复核：专用 GUI 正常退出，进程为零；18555/18556/18656/18657 无监听；DMG 只读验证挂载已卸载。入口、夹具、旧包归档和新包均保留。此次复验未改变 DMG/ZIP 内容及摘要，不需要重新构建。`artifacts/closeout-verification.json` 保存收尾证据。

## 授权与待验边界

后续用户已追加真实推理 / 生图各一次授权：包内 Pi 单次真实推理通过，用户确认 Token 没有生图模型，实际生图未发送。最新结论见 [真实 U-API 单次验收](UPGRADE-REAL-UAPI-v0.15.5-20261023.md)。下段保留本 GUI 修订轮结束时的授权与未验边界，不作为后续真实请求为零的证明。

真实只读 GET `/v1/models` 的 HTTP 200/六模型证据沿用原 GUI 记录。Token 没有保存在本轮夹具中。原生 Continue 包含真实推理探活，当前授权只到模型列表与鉴权，所以本轮继续用合成 Token 与阻断网络验证错误行为，不发送真实对话、生图或计费请求。真实推理/保存全链、长上下文、生图扣费、自动更新、正式 profile 迁移、Windows、Office 查看、原包安装/原入口仍未验。合成旧版升级与回退沿用首轮记录，本次未重复整条演练。
