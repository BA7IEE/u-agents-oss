# v0.15.5 GitHub 双平台测试包

> 用户授权 Windows 和 macOS 均由 GitHub 编译并收尾。延续当前独立候选；不合主线，不创建 Release、不上传更新服务器。

## §1 范围与状态

本次目标是 Windows x64 NSIS 安装包，以及 macOS arm64 DMG / ZIP。按既定产品范围继续停发 Intel macOS；没有改 `electron-builder.yml` 或恢复 x64 Mac 分发。

产品代码沿用本机已验证的 `bb605b286d863927a5e28f97267df04ee0b0a1b6`；本轮开始时候选 HEAD 为 `ea22895c11b9380277ce73105c4feb7c4855b43a`。新增内容仅为候选 CI、运行时检查与本记录。原 checkout / main 仍应保持 O `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`。

**当前状态：本地流水线检查 PASS，GitHub 编译尚未启动，等待用户修复本机 GitHub 登录。** `gh auth status` 报默认登录无效；候选分支推送预检返回 `unable to get password from user`。GitHub 连接器可以读取仓库，但本机候选及完整 Git 历史尚未推送。已请求用户通过 `gh auth login --hostname github.com --git-protocol https --web --scopes workflow` 重新登录，不在聊天接收 Token。

## §2 流水线与交付约定

| 项目 | Windows | macOS |
|---|---|---|
| Workflow | `.github/workflows/windows-candidate.yml` | `.github/workflows/macos-candidate.yml` |
| Runner | `windows-2022` | `macos-15`，运行前确认 `uname -m = arm64` |
| 构建入口 | `build-win.ps1` | `build-dmg.sh arm64` |
| 安装包 | `U-Agents-x64.exe` | `U-Agents-arm64.dmg`、`U-Agents-arm64.zip` |
| Artifact | `U-Agents-0.15.5-windows-x64` | `U-Agents-0.15.5-macos-arm64` |
| 运行验证 | 临时目录静默安装，再执行包内 Bun / Pi / uv / QuickJS | 签名严格校验、DMG / ZIP 完整性、包内 Bun / Pi / uv / QuickJS |
| 元数据 | `BUILD.txt`、`SHA256SUMS.txt`、`RUNTIME-CHECK.json` | 同左 |
| 签名边界 | 无发行代码签名 | adhoc，未公证 |

两条流水线仅在 `codex/upstream-v0.15.5` 的构建相关文件 push 时触发，也可手动运行；权限只有 `contents: read`，checkout 不保留 Git 凭据，构建显式 `--publish never`。没有 Release、S3、更新服务器或真实业务 API 步骤，artifact 保留 14 天。收到同一提交的两平台成功结果、核对并下载产物后，才能将本记录更新为完成。

在原生 shell 的首个准备步骤写入相同的双 CONFIG_DIR 和独立 CLAUDE_CONFIG_DIR，再安装 / 启动 Bun。HOME 保持 runner 原值。配置根经 `GITHUB_ENV` 传递，避免在不支持 runner context 的 job env 中引用 `runner.temp`，规则依据 [GitHub contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)。runner 架构依据 [GitHub runner images](https://github.com/actions/runner-images#available-images) 核对；不使用漂移的 `macos-latest`。

## §3 包内检查与本地证据

新增 CI 辅助脚本 `.github/scripts/verify-packaged-runtime.ts`：在仓库外启动实际包内 Bun / Pi，仅使用合成凭据及 loopback SSE，校验 Photon 图片确实进入请求、输出上限 32,768 未丢失、回复标记正确且请求只有一次。另执行包内 preload、uv、QuickJS WASM 的 `6 * 7 = 42`，检查 SDK / 原生二进制及所需资源。

本机已对现有 macOS 测试包执行同一脚本，PASS；外层 sandbox 拒绝正式 profile、仓库 `node_modules` 和真实外网，只允许本机测试端口 18660。本机验证只证明 macOS 当前包和检查脚本可运行，不能替代即将执行的 GitHub 冷构建或 Windows 验证。

证据根：`/private/tmp/uagents-v0155-execution-20261022/github-build-20261023`。

| 检查 | 状态 / 证据 |
|---|---|
| 双 workflow YAML / 隔离步骤顺序 / 权限 / 无发布步骤 | PASS；`workflow-check.json`、`workflow-check.log` |
| macOS run 步骤 Bash 语法 | PASS；同上 |
| 同一脚本执行实际包内运行时 | PASS；`local-runtime-check.json`、`local-smoke-final.log` |
| 真实网关请求 | 0；只有合成 loopback 模型请求 |
| GitHub Windows / macOS 构建与产物 | NOT_RUN，待登录后推送 |

检查脚本开发时的两次 QuickJS API 调用问题已在辅助脚本中修正，最终使用实际包内 WASM bytes 和 `JSValueHandle.consume`；没有因此修改产品包或升级依赖。旧失败日志保留，最终结果以 `local-smoke-final.log` 为准。

## §4 验收边界

真实文字推理一次已通过；用户确认 Token 无生图模型，真实生图和图像扣费仍 NOT_RUN，见 [真实 U-API 验收](UPGRADE-REAL-UAPI-v0.15.5-20261023.md)。本轮 CI 不请求真实 Token、不重复已通过的真实推理，也不把合成 Photon 图片检查称为真实生图通过。

Windows 用户 GUI / 旧系统兼容性、macOS 原包安装 / 原入口、正式签名 / 公证和真实 profile 迁移仍未覆盖。此前隔离事故及窗口状态 / config-defaults 的 UNKNOWN 结论保留。本轮可以交付测试候选，不据此宣称全部产品功能已验收或已发布。
