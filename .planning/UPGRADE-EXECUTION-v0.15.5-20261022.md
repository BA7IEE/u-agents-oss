# v0.15.5 升级实施与测试包记录

> 2026-10-22；按 r2 方案执行。本次用户明确允许改代码，仅独立候选、macOS 测试包；不合主线、不发布。
> 当前：v0.15.5 macOS arm64 DMG/ZIP 已生成并验包。GUI 因 Mac 锁屏待解锁，G12 未运行。

## 候选与范围

- 原 checkout：`/Users/dengwang/Documents/coding/u-agents-oss/u-agents`。
- 候选：`/Users/dengwang/.codex/worktrees/upstream-v0155/u-agents`，分支 `codex/upstream-v0.15.5`。
- O：`2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`；B/v0.14.0：`73bd9c2a3573158bea880984eb8d5fdb41e0cac2`；固定 T/v0.15.5：`cede6ea49e0c4a42933ed0f1bc129db698fc581f`。
- 合入固定 tag，未使用旧缓存 upstream/main。实际初始冲突 121 个文件；不把方案中的 285 个路径交集当冲突数。
- r2 方案原样保留，SHA-256 `dfb590cbc44c5e443c0887f98b8953ed93cffd33ef5f26979d2491e09bd383d1`。版本统一为 0.15.5，包括保留的 legacy session-mcp workspace；后者不重新进入运行链。
- 证据根：`/private/tmp/uagents-v0155-execution-20261022`。最终包源码 SHA 为 `88d8cc7b0f81215418b2299f95edd70fd177cec9`；随后文档补记不改变包内源码。产物 SHA-256 由 release/BUILD.txt 和 SHA256SUMS.txt 记录。

## 四项评审落实

| 项目 | 最终实现与证据 |
|---|---|
| R1 先隔离再启动 | 每次安装 hook、Bun/preload、测试、构建及包内 smoke 由父 launcher 预设相同的 U_AGENTS_CONFIG_DIR/CRAFT_CONFIG_DIR。保留 HOME；外层 macOS sandbox 拒绝真实配置、凭据、主 checkout 和其他工作区，默认拒绝外网。依赖准备仅用 loopback CONNECT proxy 的资产域名白名单。最终 source preload、包内 Bun 和 OS network 探针通过；凭据后端 3 项隔离测试通过。 |
| R2 factory/cache | cache key 包含 session、workspace root/id、agentKind、paid owner/path、profile、source/project 与 feature flags；只缓存 tools，MCP wrapper 每次新建；cleanup 清全部变体。Claude/Pi 同一套过滤，Coding/mini 不获付费工具。实际 MCP 列表 16 种组合、owner 替换与 factory reuse/cleanup 回归通过。 |
| R3 继承运行时 | U_AGENTS 优先并兼容 CRAFT；清理外来运行时路径时保护双 CONFIG_DIR，合法 bundled 模式保留。另修复启动入口在 sanitizer 前缓存外来 assets 的顺序问题。既有 8 项 env 单测及新 2 项实际 runtime 路径回归通过。 |
| R4 输出上限 | 只接受服务端当前连接的正安全整数，且 Token/协议相同才保留。TEST 探活与结果、SETUP 保存、通用 SAVE、后台刷新及重载/Pi 初始化均覆盖。保存串行、刷新失效检查、删除失效处理；换 Token/协议、新连接、无效值、renderer 注入、过期结果均不能复活旧 cap。实际 RPC/vault/storage/Pi 用例 6 项通过。 |

## 功能适配

- 接收上游新 UI、费用增量、上下文压缩阈值、Coding/PR 只读状态、MCP resource/prompt、项目记忆、浏览器和后台任务修复。
- 固定 U-API 网关、Token-only、多连接、目录发现、默认连接和最后连接保护保留。Coding 默认关闭；Decision/Guarded、Pages script/refresh、公开发布继续关闭，新 Claude artifact RPC 在读 workspace/凭据、SDK import 或网络前拒绝。
- 生图 owner/nonce/取消/脱敏与主回复展示保留；mini/Coding/internal 不触发付费图片工具。main/ephemeral 重试预算保持 16,000/4,000ms，cache warming 均关闭。
- 保留 Python/uv Office 链，不引入 markitdown-js。7 份新增版本日志中文化并裁剪未开放能力；7 个 locale 文件每份 2,154 keys，排序/parity/2,378 个源码 callsite coverage 通过。
- Electron 39.8.10、Bun runner/各平台构建及包内 Bun 1.3.12；Bun types 固定 1.4.2；Pi 1.1.0、Claude SDK 0.3.302、uv 0.10.6。保留原 19 项安全 overrides，另固定 5 项 Pi 内部传递依赖 1.1.0，避免范围解析到不兼容 1.4。
- Windows candidate workflow 改到本候选与 0.15.5 artifact，并检查 Photon/QuickJS 资产；未 push、触发 CI 或运行 Windows。

## 包内图片问题及修复

真实 Pi 包测试发现：内联 Photon 模块后，其 WASM 路径含构建机位置；SDK 捕获加载错误并静默移除图片，普通文字对话仍能成功。修复各 Pi 构建入口为 external Photon，并随 index.js 复制完整 Photon/QuickJS 运行包与 WASM。新增 `packaged-images.isolated.ts` 在仓库外构建/启动真实 bundle，并拒绝旧绝对 WASM 路径；loopback 模型请求确实包含图片和 32,768 输出上限。

现有 unpacked .app 原生 RPC 已证明 HEIC→JPEG、预览、缩略图、Office→Markdown；转换后的 HEIC JPEG 再进入包内 Pi 模拟模型请求，图片数量为 1。外层 sandbox 拒绝仓库 node_modules/src，未由仓库依赖兜底。最终包已复测：HEIC/预览/缩略图、PDF 二进制往返、Office Markdown、Pi 图片请求及 QuickJS WASM 执行均通过。包内实际 Electron 39.8.10、Bun 1.3.12、uv 0.10.6、Claude native CLI 2.1.302 已执行；SDK package 为 0.3.302。

## 验证记录

| 验证 | 结果 / 日志 |
|---|---|
| 完整 `bun run test` | 6,725 pass、12 原有 skip、0 fail；15 个 isolated 入口另 194 pass、0 fail；`logs/test-clean-final.log` |
| `bun run validate:ci` | PASS：全包 typecheck、shared 合同、20 项文档工具 smoke、i18n；`logs/validate-ci-candidate.log` |
| CLI typecheck | PASS；`logs/typecheck-cli.log` |
| `bun run lint` | 0 errors；Electron 165、shared 14、UI 11 warnings；`logs/lint-candidate.log` |
| frozen install | PASS；最终版本协调后再复核，见 `logs/frozen-install-candidate.log` |
| 改造点 | 原标记逐项处置与 44 个交集文件见 [核对报告](UPGRADE-MARKERS-v0.15.5-20261022.md)，当前数字只以 [§14](14-uapi-marker-registry.md#0-当前基线速查) 为准 |
| macOS 包 | PASS：DMG UDIF checksum、ZIP CRC、DMG/ZIP 内 app 全部 2,135 文件/链接与实测 app 一致，双方 codesign deep/strict 通过；包内 HEIC/PDF/Office/Pi/QuickJS 通过；`release/verification/package-verification.json` |
| 升级与回退 | 安装的 v0.14.0 在合成配置根创建会话/文本附件/双加密 Token。正常退出后备份 194 文件；v0.15.5 打开后连接、cap、会话及附件验证通过；正常退出并恢复同一路径备份，逐字节 hash 一致；旧版重开验证通过。`logs/migration-{old-seed,new-verify,restored-verify}.log` |

一次在 release 内已有 .app 时的根测试误扫描其打包源码副本，出现 6 个模块解析错误。随后按方案 clean 后完整重跑，上表记录的是 clean 后通过结果；未为此增加 skip 或降低断言。测试时发现 SDK 错误字段和合法 header 语义发生变化，相应旧断言按实际合同调整，SSRF/凭据目的地与控制字符拒绝断言保留。

## 门禁与待验收

| 门禁 | 本轮状态 |
|---|---|
| G0 | PASS，源码及包内进程的根与访问/网络限制通过 |
| G1–G5 | 本地测试 PASS；发现/探活/模型调用使用 mock/loopback，不能替代真实网关 |
| G6–G8 | 自动测试与静态检查 PASS；GUI 视觉/点击、Coding 实操待解锁 |
| G9 | 依赖、版本、改造点与源码差异检查通过；原样纳入的两份方案文档各有一个既存 EOF 空行；保留原有 skips/warnings |
| G10 | macOS DMG/ZIP 与包内运行通过；GUI、Windows NOT_RUN，G10 整体尚未完全验收 |
| G11 | 合成旧版→新版→恢复旧版 PASS；正式用户数据迁移与恢复 NOT_RUN，未触碰原件 |
| G12 | NOT_RUN：真实网关、长对话、真实生图与扣费、自动更新 |

Mac 被锁屏，桌面工具返回无法访问；未使用 CDP/DOM 绕过锁屏进行 UI 操作。测试 app 的原生进程、渲染页加载和后端 RPC 可验证，不能称为 GUI 点击验收。嵌套 Electron sandbox 在 sandbox-exec 内无法启动，测试启动额外传 `--no-sandbox`，外层文件与外网限制始终生效；产品包默认参数未修改。仅为 Chromium Singleton socket 允许本机标准临时目录中新建 scoped_dir/Singleton 文件，不开放用户 Library/config。

## 品牌与交付边界

新界面、主题（Studio）、Coding 分支前缀、7 份版本日志和新错误文案已适配。LICENSE/NOTICE 保留。CRAFT 兼容变量、内部 Craft 标识、历史修改说明、已注册 OAuth relay/callback 与关闭功能下的上游 CLI 指引保留，不把这些内部/兼容项当用户界面品牌替换。真实 OAuth 和未开放 provider 不因此获得启用授权。

当前仅 macOS arm64 本地测试候选，adhoc 签名，未公证。未安装覆盖 `/Applications/U Agents.app`，未接真实 profile/workspace，未合回 main、push 或发布。原 checkout 的 HEAD/main/origin-main 均仍为 O，状态与原 10 项未跟踪文件哈希相同。运行证据和合成备份保留；两个测试 app 已正常退出，资产代理停止，18555/18655/18656/18657 均释放；只卸载本次 DMG 验证挂载。

## 最终产物

- DMG：`apps/electron/release/U-Agents-arm64.dmg`，328,839,318 bytes。
- ZIP：`apps/electron/release/U-Agents-arm64.zip`，318,387,836 bytes。
- 启动说明：`apps/electron/release/TESTING.md`；来源与摘要：`BUILD.txt`、`SHA256SUMS.txt`。
- 证据副本：`apps/electron/release/verification/`；不复制真实 profile、凭据或合成加密 Token。

| 产物 | SHA-256 |
|---|---|
| DMG | `0b44f86fa1c41a968c23e9426d2b1406f411e94fd38185548a92398e3b33392b` |
| ZIP | `04cba1047212ec045c5242765b00c6b8dabb68173f2bdcf47e67df3257978af4` |

首次 DMG 构建在写 `/Volumes/U Agents/.VolumeIcon.icns` 时被 G0 阻止，ZIP 成功。重试只给新建且启动前不存在的专用卷名 `U Agents Test 0.15.5 20261022` 增加路径权限，从同一已签名 app 创建 DMG；不开放其他卷。最后只读挂载到证据根下，逐文件比对、验证签名后卸载。Bun 被 builder 重新 adhoc 签名导致整文件 hash 变化，17 个 Mach-O 文件节逐项一致，代码/数据未变。
