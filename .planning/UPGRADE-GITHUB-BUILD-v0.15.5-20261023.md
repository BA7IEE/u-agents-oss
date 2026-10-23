# v0.15.5 GitHub 双平台测试包

> 用户授权两平台均由 GitHub 编译并收尾。延续独立候选；不合主线，不创建 Release，不上传更新服务器。

## §1 结果与版本

**GitHub 双平台均 SUCCESS，来自同一提交 `d538cc8809025a8a8b73c34f52b8c4a9b5473d6c`。测试包已下载，本地二次校验全部通过，本次交付完成。**

产品代码沿用本机已验证的 `bb605b286d863927a5e28f97267df04ee0b0a1b6`；其后只增加 CI、CI 检查脚本及记录，没有再次修改 `apps/`、`packages/`、`scripts/` 产品文件。候选分支 `codex/upstream-v0.15.5` 已推送，主线仍为 O `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`。

| 平台 | 最终运行 | 通过项目 | 产物 |
|---|---|---|---|
| Windows x64 | [39949978727](https://github.com/BA7IEE/u-agents-oss/actions/runs/39949978727) | 编译、临时目录静默安装、包内运行检查、上传 | `U-Agents-x64.exe` |
| macOS arm64 | [39949978713](https://github.com/BA7IEE/u-agents-oss/actions/runs/39949978713) | 编译、严格签名、架构、DMG / ZIP、包内运行检查、上传 | `U-Agents-arm64.dmg`、`U-Agents-arm64.zip` |

按既定产品范围继续停发 Intel macOS，没有修改 `electron-builder.yml`。Windows 无发行代码签名；macOS ad hoc 签名、未公证。

## §2 流水线与检查

| 项目 | Windows | macOS |
|---|---|---|
| Workflow | `.github/workflows/windows-candidate.yml` | `.github/workflows/macos-candidate.yml` |
| Runner / 构建 | `windows-2022` / `build-win.ps1` | `macos-15` / `build-dmg.sh arm64` |
| Artifact | `U-Agents-0.15.5-windows-x64` | `U-Agents-0.15.5-macos-arm64` |
| 附带记录 | `BUILD.txt`、`SHA256SUMS.txt`、`RUNTIME-CHECK.json` | 同左 |

仅对候选分支构建相关路径 push 触发，也支持手动运行。权限为 `contents: read`，checkout 不保留 Git 凭据，构建入口使用 `--publish never`。没有 Release、更新服务器或真实业务 API 步骤；artifact 保留 14 天。

Bun 启动前，原生 shell 把相同的双 CONFIG_DIR 与独立 CLAUDE_CONFIG_DIR 写入 GITHUB_ENV，HOME 保持 runner 原值。不在 job env 引用不支持的 runner.temp，依据 [GitHub contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)。macos-15 启动后确认 arm64，架构依据 [GitHub runner images](https://github.com/actions/runner-images#available-images) 核对。

`.github/scripts/verify-packaged-runtime.ts` 在仓库外执行实际打包 / 安装资源。两平台均验证包内 Bun 1.3.12、preload、uv 0.10.6、Pi 与 QuickJS WASM。Pi 仅用合成凭据和 loopback SSE / PNG，确认 Photon 图片实际进入请求、输出上限 32,768、回复正确且恰好 1 次请求。QuickJS 使用包内 WASM bytes 执行 `6 * 7 = 42`。最终日志均有 `PACKAGED_RUNTIME_CHECK_PASS`。

## §3 尝试与修正

首轮提交为 `11bef277e5766a9d4d0d318edbf6e6fcae94bf0b`。

| 运行 | 结果 / 处置 |
|---|---|
| Windows [39949610280](https://github.com/BA7IEE/u-agents-oss/actions/runs/39949610280) | SUCCESS；最终按统一提交再执行一次 |
| macOS [39949610414](https://github.com/BA7IEE/u-agents-oss/actions/runs/39949610414) | FAIL：ripgrep postinstall 从 GitHub release API 取二进制收到 HTTP 403 |
| 修正 `d538cc88` | 仅在 build 步骤传入只读 secrets.GITHUB_TOKEN，供依赖安装使用；没有扩权限或改 lockfile |
| 最终两平台 | 均 SUCCESS，以 §1 的运行和 artifact 为准 |

403 是已观察的状态码，现有证据不能唯一确定远端拒绝原因。修正后 macOS 冷构建和同提交 Windows 重跑均通过。CLI 登录恢复后已成功推送候选，没有创建合并或发布。

两平台日志保留 action 的 Node 20 弃用提示；runner 已强制用 Node 24 执行，两次均成功。本轮没有扩展 action 升级范围。

本地取包时，一条检查误把“单个文件压缩前大小不得超过外层 ZIP”当成条件，拦住 Windows 解包。实际 EXE 309,732,242 bytes，外层 ZIP 309,673,398 bytes，属于正常压缩。已改为预期文件集合及 1 GiB 单文件上限，保留完整 artifact SHA-256 校验；没有重复构建，见 download-recovery.json。

## §4 交付与证据

交付目录：`/Users/dengwang/Downloads/U-Agents-0.15.5-GitHub-d538cc88-20261023`。与先前本机测试包分开，旧 DMG / ZIP 和历史摘要保留。

| GitHub artifact | 字节数 | 外层 ZIP SHA-256 |
|---|---:|---|
| Windows `12500373347` | 309,673,398 | `c4f3cba3ac1e3a873aa926857e1eac4799c81848b5ae8d2192096e8721be4194` |
| macOS `12499753823` | 652,524,640 | `383408855be02075694b6c97e460ba44c85d28a71add07436e25d13292700a5a` |

上表不是 EXE / DMG / 应用 ZIP 的摘要。两份 artifact 分别在北京时间 2026-11-06 20:12 / 20:04 左右到期，本地副本不受该保留期限影响。

实际安装文件已逐项匹配各自 SHA256SUMS.txt：

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| Windows EXE | 309,732,242 | `f600432aaa1e21edbfc7c07cc54c4a13931551f38f90ec1d2bdac663efa26606` |
| macOS DMG | 332,193,797 | `91c160a5ef5414b6d2657bdb5dccc79753f2f5a4d10805c085a37813ce74f648` |
| macOS ZIP | 321,746,035 | `dc1901ce34387c6f9bff081ee978891736c8e6695cb05d438b1829fffd8eac8c` |

下载器只在内存使用已登录 CLI 的凭据，CDN 不携带 Authorization，保持 TLS 验证。先匹配外层 artifact 摘要，再解出有限的预期文件，核对包摘要与构建来源。macOS 通过只读 DMG 挂载、ZIP 流式比对复核，不展开另一份完整 app、不启动原 app。

证据根：`/private/tmp/uagents-v0155-execution-20261022/github-build-20261023`。

| 检查 | 状态 / 证据 |
|---|---|
| Workflow 语法、隔离顺序、权限、无发布步骤 | PASS；workflow-check.json、workflow-check-auth-fix.log |
| 本机同一脚本的实际包内运行 | PASS；local-runtime-check.json、local-smoke-final.log |
| GitHub 最终运行日志 | PASS；macos-final.log、windows-final.log |
| 同提交与 artifact 元数据 | PASS；execution-state.json、artifact-specs.json |
| 本地下载与外层 artifact SHA-256 | PASS；windows-x64-download.json、macos-arm64-download.json |
| 三个文件摘要、BUILD / runtime 同提交 | PASS；delivery-verification.json |
| DMG / ZIP 内全部 2,117 文件与链接 | 完全一致；DMG 完整性、ZIP CRC、arm64 / 0.15.5 / bundle ID、严格签名均 PASS |
| macOS LICENSE / NOTICE | 与候选源文件摘要一致；同上 |
| 本轮真实网关业务请求 | 0；仅合成 loopback 模型请求 |

CI 包的 2,117 项与先前本机包的 2,136 项分别记录：CI 冷构建不含本机的 18 个 Python 测试字节码和 Electron default_app.asar，另有三组 renderer 资源的哈希文件名不同。没有把两次独立构建说成逐字节相同；本轮完全一致指同一 CI 的 DMG 与 ZIP。

辅助脚本开发中的 QuickJS API 用法问题已修正，未因此修改产品包或依赖；历史失败日志保留。

## §5 验收与收尾边界

双平台打包成功不改变既有产品验收 HOLD。此前真实文字推理一次 PASS；用户确认 Token 无生图模型，真实生图 / 图像扣费仍 NOT_RUN，见 [真实 U-API 验收](UPGRADE-REAL-UAPI-v0.15.5-20261023.md)。合成 Photon 图片检查不等于真实生图通过。

Windows 用户 GUI / 旧系统兼容性、macOS 原包安装 / 原入口、正式签名 / 公证、真实 profile 迁移和完整 GUI 多轮生图仍未覆盖。此前隔离事故及窗口状态 / config-defaults 的 UNKNOWN 保留，见 [GUI 修订记录](UPGRADE-GUI-FIX-v0.15.5-20261023.md)。

没有合 main、覆盖正式安装、创建 Release 或发布更新；未再调用真实推理。原 checkout 的 HEAD / main / origin-main 均为 O，原状态和 10 项未跟踪文件摘要一致。此后仅提交交付文档，包的构建来源始终为 d538cc88；文档提交不触发构建路径过滤器。交付目录附 README.md、汇总 SHA256SUMS.txt 与 VERIFICATION.json。
