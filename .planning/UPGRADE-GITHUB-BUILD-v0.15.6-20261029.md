# v0.15.6 GitHub 双平台测试包

> 用户本轮要求 Windows 与 macOS 都用 GitHub 编译并收尾。授权覆盖候选推送、CI 修复、构建与产物核验。本轮不合主线、不创建 Release、不更新自建更新服务器。

## §1 结果与固定版本

**三条流程均 SUCCESS，两平台测试包已下载并完成本地二次核验，本次编译交付完成。**

构建提交统一为 `5b968c18551cd0f875c1a07f2ff8d2c6244bdc0c`，分支 `codex/upstream-v0.15.6`。应用源码与本地通过回归的 `43367c5e85f256394a75ca3e10c69c2aa3896218` 一致；其后仅修正 CI 的变量初始化位置并补记录，没有改 `apps/`、`packages/`、`scripts/`、package.json 或 lockfile。

| 流程 | 最终运行 | 核验 |
|---|---|---|
| Validate | [40781602448](https://github.com/BA7IEE/u-agents-oss/actions/runs/40781602448) | 类型、配置回归、文档工具 smoke、i18n 三闸通过 |
| macOS arm64 | [40781607757](https://github.com/BA7IEE/u-agents-oss/actions/runs/40781607757) | 编译、签名/架构、DMG/ZIP、包内运行、上传通过 |
| Windows x64 | [40781613573](https://github.com/BA7IEE/u-agents-oss/actions/runs/40781613573) | 编译、临时目录静默安装、包内运行、上传通过 |

原 main 与远端 main 保持 `475fc0c72bf41454359134d371e3b6b49b914fac`，原 checkout 的未跟踪文件与规划文档未改动。构建后仅提交交付文档，包的来源仍以本节构建提交为准。

## §2 交付文件

交付目录：`/Volumes/WorkSSD/Work/Builds/U-Agents/v0.15.6-github-20261029`。与原本机包及旧版本资源分开保留。

| 平台 | 安装包 | 大小 | Artifact |
|---|---|---|---|
| macOS Apple Silicon | `macos-arm64/U-Agents-arm64.dmg` | 332,277,409 bytes | `12857458062` |
| macOS Apple Silicon | `macos-arm64/U-Agents-arm64.zip` | 321,814,293 bytes | 同上 |
| Windows x64 | `windows-x64/U-Agents-x64.exe` | 309,781,511 bytes | `12857198163` |

每个平台均附 `BUILD.txt`、`SHA256SUMS.txt`、`RUNTIME-CHECK.json`，以及对应 `latest.yml` / `latest-mac.yml` 和 blockmap。根目录另有汇总 `SHA256SUMS.txt`、`VERIFICATION.json`、README.md；完整外层 artifact ZIP、分块和运行日志保留用于复核。

GitHub artifact 保留 14 天；本地交付不依赖其在线保留期。没有把构建产物推入源码仓库。

## §3 通过的检查

| 层面 | 结果 / 证据 |
|---|---|
| 构建提交 | 两平台 run、artifact、BUILD、runtime 均为 `5b968c18551cd0f875c1a07f2ff8d2c6244bdc0c`；`evidence/runs-completed.json` |
| 配置隔离 | 两平台在 Bun/preload 前初始化双 CONFIG_DIR 和独立 CLAUDE_CONFIG_DIR；Validate 也已修正并通过 |
| 产品源码未变 | `43367c5e..5b968c18551cd0f875c1a07f2ff8d2c6244bdc0c` 的产品目录、package.json、lockfile 差异为 0；`evidence/workflow-check.json` |
| 下载外层完整性 | 两个 ZIP 的 SHA-256 均与 GitHub artifact digest 完全一致；`evidence/*-download.json` |
| 文件摘要 | 两平台 SHA256SUMS 全通过；latest 文件中的大小、SHA-512、默认下载文件一致；`evidence/delivery-verification.json` |
| blockmap | 版本与块数有效，每份覆盖完整对应安装包；同上 |
| macOS 原生检查 | arm64 / 0.15.6 / `cn.u-studio.u-agents`；严格签名、DMG、ZIP、LICENSE/NOTICE 均通过；`evidence/macos-native-verification.json` |
| DMG / ZIP 一致性 | 同一次 CI 的 2,119 个文件与链接载荷完全一致，DMG 只读挂载后已卸载；同上 |
| Windows 安装与运行 | 在 GitHub windows-2022 临时目录静默安装，使用安装后的资源运行检查；日志含 `PACKAGED_RUNTIME_CHECK_PASS` |
| Windows 下载文件 | PE 安装器结构和摘要通过；NSIS 启动器的 machine 为 `0x14c`，目标应用由 x64 构建步骤生成；本机未运行 EXE |
| 包内运行时 | 两平台包内 Bun 1.3.12、uv 0.10.6、preload、Pi、Photon 图片输入、QuickJS `6*7=42`、32768 输出上限通过 |
| 动态工具同步 | 每个平台真实包内子进程连续 5 轮 loopback 请求，覆盖 session/source 添加、撤销、空集合移除及旧 merge 兼容 |
| 请求边界 | 每个平台均为 5 次合成 loopback 请求，真实网关请求 0；两份 RUNTIME-CHECK.json |
| 原 checkout 保留 | HEAD、原状态、三份原始规划文档摘要均不变；`evidence/source-preservation.json` |

本轮 CI 包与之前本机包来自各自构建，不能声称二者字节相同；本节的完全一致只指本轮 CI 的 DMG 与 ZIP 载荷。

## §4 失败与修正

首轮推送为 `05db0ddfff2f8c53787f482db07fe429b0dfabe1`。GitHub 拒绝在 job-level env 引用 `runner.temp`，解析失败运行 [40781282190](https://github.com/BA7IEE/u-agents-oss/actions/runs/40781282190) 保留。三项路径改为首个准备步骤读取 `$RUNNER_TEMP`，写入 `$GITHUB_ENV`，仍先于任何 Bun；修复提交即本轮最终构建提交。

首轮 macOS `40781284479`、Windows `40781284435` 主动取消，避免旧提交重复构建。随后对齐同一提交重跑三条流程，全部成功。没有跳过失败步骤或放松运行检查。

下载使用可续传分块，Mac 653,351,671 bytes、Windows 310,037,816 bytes 的外层 artifact ZIP 均通过 GitHub digest 校验，再解包验证每个交付文件；没有混用先前本机包或旧版本包。

## §5 收尾边界

**本次“收尾”完成的是 GitHub 双平台编译、运行检查与产物交付。** 真实 U-API、计费生图、真实 GitHub PR 写入、Windows 用户 GUI / 旧系统兼容性、macOS 普通原入口安装及正式签名/公证均未因此获得验收结论。

Windows 未签名，macOS 临时签名且未经公证。未替换 `/Applications` 中的应用，未覆盖正式配置，未合 main，未创建 Release，未改变自建更新服务器。候选工作树与完整证据保留，供后续审阅、安装验收或另行授权发布使用。
