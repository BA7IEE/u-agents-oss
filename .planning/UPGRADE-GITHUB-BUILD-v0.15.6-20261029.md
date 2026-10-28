# v0.15.6 GitHub 双平台测试包

> 用户本轮要求 Windows 与 macOS 都用 GitHub 编译并收尾。授权覆盖候选推送、CI 修复、构建与产物核验；本轮不合主线、不创建 Release、不更新自建更新服务器。

## §1 固定对象

- 仓库：`BA7IEE/u-agents-oss`，候选分支 `codex/upstream-v0.15.6`。
- 已通过本地回归的应用源码提交：`43367c5e85f256394a75ca3e10c69c2aa3896218`。
- 首次推送：`05db0ddfff2f8c53787f482db07fe429b0dfabe1`；原主线：`475fc0c72bf41454359134d371e3b6b49b914fac`。
- 两个平台最终必须同一构建提交，BUILD.txt、RUNTIME-CHECK.json、GitHub run/artifact metadata 与安装包内版本逐项对齐。
- 交付目录：`/Volumes/WorkSSD/Work/Builds/U-Agents/v0.15.6-github-20261029`，原本机包与旧版本资源保留。

## §2 CI 修复

首轮 GitHub 在解析 Validate 时拒绝 job-level env 的 `runner.temp`（HTTP 422）。三项隔离路径改为首个准备步骤读取 `$RUNNER_TEMP`，再写入 `$GITHUB_ENV`，仍在 Bun/preload 之前生效。不改应用源码、依赖或包版本。

首轮 macOS `40781284479`、Windows `40781284435` 与解析失败 `40781282190` 作为历史记录保留。最终结果在本记录完成后补齐，不把已启动当作构建成功。

## §3 构建与下载

PENDING：等待最终同提交的 Validate、macOS arm64、Windows x64 结果；完成后下载到外盘并核对 artifact 摘要、文件摘要、更新元数据、包内运行与安装证据。

## §4 收尾边界

只使用合成 loopback 模型请求验证包内 Pi/Photon/QuickJS/Bun/uv 与 session/sources 动态注册。真实 U-API、计费生图、普通用户 GUI 及旧系统兼容性仍单独验收。Windows 未签名，macOS 临时签名且未经公证。
