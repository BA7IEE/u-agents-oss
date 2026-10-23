# v0.15.5 macOS GUI 问题修订与复验

> 延续用户已授权的独立工作区升级任务。仅在 `codex/upstream-v0.15.5` 修改、构建与验收，不合主线、push 或发布。不再写正式 profile。此前 GUI HOLD 与隔离事故见 [原验收记录](UPGRADE-GUI-v0.15.5-20261023.md)，本记录不覆盖历史结论。

修订源码为 `bb605b286d863927a5e28f97267df04ee0b0a1b6`。当前自动检查与包验证通过；首次配置空 Token 已 GUI 通过，剩余 GUI 项等待 Mac 手动解锁，暂不标记三个问题全部 GUI 闭环。

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

原 GUI 事故中正式 `models`、`defaultModel` 已按用户单独授权恢复；窗口状态及 config-defaults 缺少事故前证据，仍为 UNKNOWN。本轮不会据此宣称整次升级未触碰正式数据。

## 自动检查

| 检查 | 结果 | 日志（相对证据根） |
|---|---|---|
| 完整测试 | 6,743 pass、12 原有 skip、0 fail；16 个 isolated 入口另 195 pass、0 fail | `logs/full-tests.log` |
| validate:ci | 全包 typecheck、shared 合同、20 项文档工具、i18n PASS | `logs/validate-ci.log` |
| lint | 0 errors，Electron 165/shared 14/UI 11 原有 warnings | `logs/lint.log` |
| G0 | 正式 config/credentials 和主 checkout 文件读被拒；外网及系统代理连接被拒；合成配置根和自有临时服务器可用 | `logs/g0-preload.log`、`logs/g0-network.log` |
| clean build | PASS，清理旧 dist/release 后重新构建和 staging | `logs/clean-build.log`、`logs/stage-runtime.log`、`logs/copy-subprocess.log` |
| DMG/ZIP | PASS，2,136 文件/链接完全一致，DMG checksum、ZIP CRC、双方 codesign deep/strict；Bun 17 个 Mach-O 节一致 | `artifacts/package-verification.json`、`logs/package-verify.log` |
| 包内 Pi/QuickJS | PASS，实际包内 Bun/Pi 在仓库外启动；loopback 请求确有一张图片及 32768 输出上限，QuickJS WASM 执行得到 42 | `logs/package-pi-smoke.log`、`logs/package-quickjs.log` |
| 原 checkout | HEAD/main/origin-main 仍为 O，原状态及 10 项未跟踪文件哈希一致 | `artifacts/original-checkout-verification.json` |

## 包与 GUI 复验

新包已生成，adhoc 签名、未公证，构建参数明确为 `--publish never`。首次 builder 尝试下载 Electron 被关闭的资产通道拒绝，改为使用已安装且已校验的 `node_modules/electron/dist`，没有重新下载、放宽网络或修改产品构建配置。包来源验证与 runtime staging 均以当前源码为准。

| 产物 | bytes | SHA-256 |
|---|---|---|
| `apps/electron/release/U-Agents-arm64.dmg` | 328,840,846 | `aa7af1a7dda8906a016ab695caeeea6a7d9737ddc50b19d0d96d692c76a06a28` |
| `apps/electron/release/U-Agents-arm64.zip` | 318,394,092 | `7971a64df971d02185a4506e014996aa116b826ca64b404912a56eb649d8a519` |

两个专用 GUI 副本各有 2,123 文件/链接与原包一致；13 项差异为固定隔离入口、bundle ID/专用 URL scheme 与重签名，另增加改名后的原 Electron 程序。`Contents/Resources/app/` 全部逐字节一致；变动的 Mach-O 代码节逐项一致。证据为 `gui-qa/guarded-clone-manifest-comparison.json`。副本 GUI 结果仍不替代原包安装、原入口或正式签名验收。

| GUI 项 | 结果与证据（相对 `gui-qa/`） |
|---|---|
| 首次配置空 Token | PASS。独立全新配置根不含凭据，工作区 `07679249-2515-4d3c-bfe7-4045a85b5dd7`；点击 Continue 后立即提示 `Please enter your U-API Token.`，停留在输入页，后续观察仍无保存状态。`01-fresh-empty-token.*`、`02-fresh-empty-token-stable.txt` |
| 已有凭据空 Token 编辑 | 待 Mac 解锁后验收 |
| 新会话与历史分享菜单 | 待 Mac 解锁后验收；已准备 `example.invalid` 的本地历史分享元数据夹具，未上传任何会话 |
| 中文按钮、连接错误、会话开场提示 | 待 Mac 解锁后验收 |

首次配置专用 app 已正常退出，18656 释放。下一份已有连接副本启动前，桌面工具明确返回 Mac 锁屏且无法自动解锁，已请用户手动解锁；未用其他通道代替 GUI 操作。

本轮收尾复核：专用 GUI 进程为零；18555/18556/18656/18657 无监听；DMG 只读验证挂载已卸载。入口、夹具、旧包归档和新包均保留，解锁后可直接继续剩余验收，不需要重做构建或重新输入真实 Token。`artifacts/closeout-verification.json` 保存收尾证据。

## 授权与待验边界

真实只读 GET `/v1/models` 的 HTTP 200/六模型证据沿用原 GUI 记录。Token 没有保存在本轮夹具中。原生 Continue 包含真实推理探活，当前授权只到模型列表与鉴权，所以本轮继续用合成 Token 与阻断网络验证错误行为，不发送真实对话、生图或计费请求。真实长上下文、生图扣费、自动更新、正式 profile 迁移、Windows 和原包安装仍未验。
