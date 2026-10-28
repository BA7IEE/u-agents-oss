# v0.15.6 候选执行记录

> 2026-10-28 启动，2026-10-29 完成本地候选交付。授权来自本轮“修订后开始落地”。代码、自动检查、macOS 测试包及限定桌面检查已完成；跨平台和真实业务验收仍有明确未验项。未向远端写入，未合主线，未发布，未运行真实网关或计费请求。

## §1 固定对象与隔离

- 原 main：`475fc0c72bf41454359134d371e3b6b49b914fac`（0.15.5）。
- 上游固定 tag：`v0.15.6`，`8df01c5d0ac73c35add5954e6f190ce038d35845`。实际 fetch 后核对。
- 源码提交：`43367c5e85f256394a75ca3e10c69c2aa3896218`，父提交为原 main 与固定 T；构建前后 2,494 个 tracked 文件摘要一致，见 `artifacts/build-source-match.json`。最终文档另行提交，不改变应用载荷。
- 候选：`codex/upstream-v0.15.6`，目录 `/Users/dengwang/.codex/worktrees/upstream-v0156/u-agents`。
- 证据与包：`/Volumes/WorkSSD/Work/Builds/u-agents-0.15.6-20261028-1fj6zn9s`。系统盘构建时空余约 6 GB，大型产物放外盘。
- 实际初始冲突 29 个文件，已全部解决；`artifacts/merge-conflicts-initial.json` 保留原始清单。旧 scope 归一化后三方合并；四处人工处理为 Electron/server 包信息、tool-defs 注释和 bun.lock。
- 每次 Bun 启动前设置独立双 CONFIG_DIR、CLAUDE_CONFIG_DIR、cache/TMPDIR；不同检查使用不同 profile。正式配置目录受系统沙箱拒绝；收尾补核发现 `.claude.json` 单文件规则转义错误，修正后已拒绝读写并复验 Claude hook 和全源测试。原文件修改时间仍为 2026-10-15 00:36:31，未被本轮改写。
- `offline.sb` 拒绝全部网络；`test.sb` 仅放行本次测试端口；asset 模式仅可通过本次 CONNECT 代理访问 npm/GitHub/PyPI 依赖域名。代理未用于业务请求。
- `g0-proof.log`：正式目录读写、外网、系统代理和 asset 代理均被测试沙箱拒绝；自有 loopback 与隔离配置读写通过。
- release/.build 链接到本次外盘目录；原构建脚本清理 release 时，由本次外部 BASH_ENV 包装只清空本次目标并保留链接。未改构建脚本。HUSKY=0 防止 install 改共享 Git hook。

## §2 修订落地与证据

| 项目 | 结果与证据 |
|---|---|
| R1 | Pi 注册与执行共用实时 profile 与 feature 条件；full Coding 四工具走真实 route；普通/mini/失效 profile 拒绝。`pi-coding-tools.test.ts`、`session-tool-profiles.test.ts` |
| R2 | canonical safeMode 分类；PR status 允许，三写及未知/禁用 Decision 拒绝。真实 Pi pre-tool 和 Claude SDK hook 通过 |
| R3 | toolUseId 内存关联 Bash start/end；成功恰好绑定一次；交错、重复、失败、非 Bash、中止、子进程清理不会误绑定。原始事件经 adapter 测试通过 |
| R4 | SessionManager host getter 区分未绑定与旧快照；同一 Pi host 下一轮按 session/sources 替换，空集合撤销；保持 paid owner。host 与 registry 测试通过；包内真实 Pi 子进程 → SDK → loopback 的五轮模型边界检查已通过，工具增加/撤销/空集合/旧协议均有实际请求断言 |
| A1 | sync 请求立即使旧 await 失效；返回后复核 registry、订阅、最新 PR、当前目录、Coding、权限、归档、忙碌和开关；dispose 后订阅不得复活。12 个新增竞态用例通过 |
| 中文/品牌 | 7 locale key 对齐；新增中文动作和整篇更新日志完成；新增运行时和 UI 无未处理的上游品牌；命名、网关、关闭政策与高冲突文件继续保留 |
| 标记 | 原 239 个全部保留，新增 24 个；263/9/9。逐条 diff 见 `artifacts/marker-audit.json`，登记表已刷新 |

## §3 自动检查

| 检查 | 当前结果 | 证据 |
|---|---|---|
| Bun frozen 安装 | PASS，1.3.12，24 overrides 保留 | `logs/install-assets.log`、`logs/build-macos.log` |
| 定向 7 文件 | 57 pass、0 fail | `logs/focused-coding-rerun.log` |
| 全量测试 | 6,851 pass、12 skip、0 fail；567 文件 | `logs/full-tests-source-final.log`（加强隔离后的最终复验） |
| isolated | 17 入口，196 pass、0 fail | `logs/isolated-tests.log`、`artifacts/isolated-results.json` |
| validate:ci | PASS：全包类型、配置回归、20 个文档工具 smoke、i18n 三闸 | `logs/validate-ci-final.log` |
| lint | PASS，0 errors，190 warnings；新增/改动行无 warning，未自动修复既有警告 | `logs/lint-final.log` |
| 法律与高冲突文件 | LICENSE/NOTICE/TRADEMARK、§3.3 文件均无差异 | 本地 git diff 核查 |

包后直接 `bun test` 会扫入 release 中复制的用例，产生伪失败，详见 `full-tests-hardened.log`；按 Git 字典序显式枚举又暴露现有 PDF `?url` mock 的顺序耦合，详见 `full-tests-tracked-final.log`。最终复验只临时摘下本次创建的 release 软链接，所有安装包字节完整留在外盘；按仓库标准发现顺序检查 567 个源码文件，结束必恢复软链接。runner 是证据目录下 `run-source-tests.py`，不改生产测试实现。

12 个 skip 均为现有 Windows/PowerShell 或特定开发环境分支，本次没有增加 skip。首轮失败及修复过程保留：配置未初始化的上游测试补 beforeAll；默认工具测试适配永久关闭 Decision；文档工具先经 asset 通道预热依赖再离线复验；测试端口映射传入子进程；macOS /tmp 别名测试显式使用 /private/tmp，不受外盘 TMPDIR 影响。未通过修改生产权限或开放业务网络规避失败。

## §4 包与桌面验收

| 项目 | 结果与限制 |
|---|---|
| macOS arm64 包 | DMG 328,848,874 bytes，ZIP 318,387,234 bytes；两份 blockmap、latest-mac.yml、SHA256SUMS.txt 齐全。临时签名、未公证 |
| 完整性 | `codesign --verify --deep --strict`、arm64 架构、DMG verify、ZIP CRC、latest 中 size/SHA-512 全通过。DMG 只读挂载与 ZIP 的 2,137 个文件/链接载荷一致，检查后卸载 |
| 包内运行时 | 在仓库外调用包内 Bun 1.3.12、uv 0.10.6、Pi、Photon、QuickJS。含真实图片的 loopback 请求、32768 输出上限与五轮 scope 刷新通过；真实网关请求为 0。`release/RUNTIME-CHECK.json` |
| 包内文档工具 | 实际包内 wrapper + uv，先只走依赖 asset 通道预热，再断网执行 10 个命令。HEIC 读取/转 PNG、PDF 创建/读取、DOCX/XLSX/PPTX 创建/读取通过。`artifacts/packaged-doc-tools.json` |
| 桌面限定检查 | 使用独立配置和 userData；历史会话、新建/重开、设置版本、U-API 页面与分享入口隐藏通过。包内 playground 的 3/7 PR、固定标记、溢出选择通过；它是组件 fixture，不等于真实 GitHub PR 操作。截图与 `artifacts/gui-check.json` |
| GUI 沙箱限制 | 外层网络/文件沙箱保留；为避免 Chromium 嵌套沙箱初始化冲突，验收启动加 `--no-sandbox`，只放行该实例 SingletonSocket 与测试端口。不改安装包默认设置；普通安装后的原入口完整流程仍需验收 |
| 升级/回退 | 从精确 0.15.5 源码创建合成历史与加密测试凭据，用本候选读写，再恢复快照交给旧源码读取。消息、权限、固定入口、模型、32768 cap 保留，新监控默认关闭。旧/新均用隔离 Bun 与当前依赖；这是数据层验证，未执行旧原生包降级。`artifacts/upgrade-rollback.json` |
| Windows x64 | workflow 已更新，构建/Windows 真机验收 NOT_RUN；未向远端推送或触发 CI |
| 真实业务 | 真实 U-API 对话、第三方 OAuth、真实 PR 写操作、计费生图 NOT_RUN；未沿用旧 Token 或上次发布授权 |
| 清理 | 本次 GUI、内嵌服务、依赖代理已停止，18560/32080/32081 关闭。证据和候选工作树保留 |

可直接审阅外盘 `release/README.md`、`RUNTIME-CHECK.json`、`SHA256SUMS.txt`。本轮没有替换 `/Applications` 中的应用，也没有改更新服务器。

## §5 上游 93 文件逐项处置

| # | 路径 | 实际处置 |
|---|---|---|
| 1 | `apps/cli/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 2 | `apps/electron/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 3 | `apps/electron/resources/docs/sources.md` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 4 | `apps/electron/resources/release-notes/0.15.6.md` | 改为中文产品更新说明，并说明本地修复与用量边界。 |
| 5 | `apps/electron/resources/release-notes/next.md` | 保留下一版说明；清洗新增品牌文案。 |
| 6 | `apps/electron/src/renderer/components/app-shell/chat-header/ChatHeader.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 7 | `apps/electron/src/renderer/components/app-shell/chat-header/__tests__/pr-watch-state.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 8 | `apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/ChatHeaderPrChip.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 9 | `apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrDetailsCard.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 10 | `apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/PrTabStrip.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 11 | `apps/electron/src/renderer/components/app-shell/chat-header/pr-watch/pr-watch-state.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 12 | `apps/electron/src/renderer/hooks/__tests__/useHoverPopover.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 13 | `apps/electron/src/renderer/hooks/useHoverPopover.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 14 | `apps/electron/src/renderer/hooks/usePrWatch.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 15 | `apps/electron/src/renderer/pages/ChatPage.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 16 | `apps/electron/src/renderer/playground/registry/chat-header.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 17 | `apps/electron/src/renderer/playground/registry/chat-panel.tsx` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 18 | `apps/electron/src/renderer/playground/registry/samples/pr-watch.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 19 | `apps/electron/src/shared/__tests__/ipc-channels.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 20 | `apps/electron/src/shared/types.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 21 | `apps/electron/src/transport/channel-map.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 22 | `apps/viewer/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 23 | `apps/webui/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 24 | `bun.lock` | 保留 fork 已验证解析和 24 个 overrides；workspace 版本更新；frozen 安装通过。 |
| 25 | `package.json` | 更新至 0.15.6；保留 Bun、SDK 与 overrides。 |
| 26 | `packages/core/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 27 | `packages/messaging-gateway/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 28 | `packages/messaging-whatsapp-worker/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 29 | `packages/pi-agent-server/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 30 | `packages/server-core/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 31 | `packages/server-core/src/handlers/rpc/coding-repos.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 32 | `packages/server-core/src/handlers/rpc/pr-watch.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 33 | `packages/server-core/src/handlers/session-manager-interface.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 34 | `packages/server-core/src/pr-watch/auto-fix.test.ts` | 合入并补 12 个竞态回归。 |
| 35 | `packages/server-core/src/pr-watch/auto-fix.ts` | 合入并落实 A1 generation 与唤醒前实时复核。 |
| 36 | `packages/server-core/src/pr-watch/operations.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 37 | `packages/server-core/src/pr-watch/operations.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 38 | `packages/server-core/src/pr-watch/tool-callbacks.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 39 | `packages/server-core/src/services/coding-repos/coding-repos.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 40 | `packages/server-core/src/services/coding-repos/discover.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 41 | `packages/server-core/src/services/pr-watch/github-client.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 42 | `packages/server-core/src/services/pr-watch/github-client.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 43 | `packages/server-core/src/services/pr-watch/github-queries.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 44 | `packages/server-core/src/services/pr-watch/map-github.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 45 | `packages/server-core/src/services/pr-watch/map-github.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 46 | `packages/server-core/src/services/pr-watch/pr-ref.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 47 | `packages/server-core/src/services/pr-watch/pr-ref.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 48 | `packages/server-core/src/services/pr-watch/registry.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 49 | `packages/server-core/src/services/pr-watch/registry.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 50 | `packages/server-core/src/sessions/SessionManager.ts` | 合入后台摘要和 PR 监控；增加 host 项目 getter 与唤醒资格复核。 |
| 51 | `packages/server-core/src/sessions/handoff-summary.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 52 | `packages/server/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 53 | `packages/session-tools-core/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 54 | `packages/session-tools-core/src/context.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 55 | `packages/session-tools-core/src/handlers/pr-tools.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 56 | `packages/session-tools-core/src/handlers/pr-tools.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 57 | `packages/session-tools-core/src/index.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 58 | `packages/session-tools-core/src/tool-defs-filtering.test.ts` | 合入；适配 U Agents 永久关闭 Decision 的断言。 |
| 59 | `packages/session-tools-core/src/tool-defs.ts` | 保留本地工具与过滤；四个 PR 工具限定 full Coding。 |
| 60 | `packages/shared/CLAUDE.md` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 61 | `packages/shared/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 62 | `packages/shared/src/agent/__tests__/conversation-summary.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 63 | `packages/shared/src/agent/__tests__/pin-created-pr.test.ts` | 合入；补独立 config 初始化；原始 Pi 事件链另有集成测试。 |
| 64 | `packages/shared/src/agent/backend/__tests__/factory.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 65 | `packages/shared/src/agent/base-agent.ts` | 合入 pin hook；增加实时项目 getter。 |
| 66 | `packages/shared/src/agent/claude-agent.ts` | 合入；保留 fork 权限/模型路径；项目判断改为 host 实时 getter。 |
| 67 | `packages/shared/src/agent/conversation-summary.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 68 | `packages/shared/src/agent/pi-agent.ts` | 合入并落实 R1/R3/R4；保留 paid-image 权限边界。 |
| 69 | `packages/shared/src/agent/session-scoped-tool-callback-registry.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 70 | `packages/shared/src/agent/session-self-management-bindings.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 71 | `packages/shared/src/config/validators.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 72 | `packages/shared/src/i18n/locales/de.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 73 | `packages/shared/src/i18n/locales/en.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 74 | `packages/shared/src/i18n/locales/es.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 75 | `packages/shared/src/i18n/locales/hu.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 76 | `packages/shared/src/i18n/locales/ja.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 77 | `packages/shared/src/i18n/locales/pl.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 78 | `packages/shared/src/i18n/locales/zh-Hans.json` | 保留旧翻译和 key；合入 22 新 key、1 改值；中文补全；parity/排序/覆盖检查通过。 |
| 79 | `packages/shared/src/pr-watch/index.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 80 | `packages/shared/src/pr-watch/rules.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 81 | `packages/shared/src/pr-watch/rules.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 82 | `packages/shared/src/protocol/channels.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 83 | `packages/shared/src/protocol/dto.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 84 | `packages/shared/src/protocol/events.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 85 | `packages/shared/src/protocol/git-repos.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 86 | `packages/shared/src/protocol/pr-watch.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 87 | `packages/shared/src/protocol/routing.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 88 | `packages/shared/src/sessions/types.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 89 | `packages/shared/src/sources/__tests__/oauth-relay.test.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 90 | `packages/shared/src/sources/credential-manager.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 91 | `packages/shared/src/sources/types.ts` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |
| 92 | `packages/ui/package.json` | 更新版本；保留 @u-agents 包名和本地声明。 |
| 93 | `packages/ui/src/styles/base.css` | 合入上游变化；交叉路径保留本地定制，新增 import 统一 @u-agents。 |

## §6 上游差异之外的适配

实际还修改实时项目 getter、Pi scope registry、Explore 分类、两后端集成测试、macOS 路径测试、候选/validate workflows、包内 runtime 五轮检查与本记录/标记登记。额外测试文件在 Git 中保存；外部依赖缓存、沙箱和构建输出不提交。

## §7 交付边界

源码候选、组件/loopback 验证、真实桌面行为、Windows、真实网关和正式发布分别记录。当前交付是本地 macOS 测试候选，不等于跨平台、普通安装或真实业务验收完成。原 main 和用户既有未跟踪文件保持原样；原 0.15.5 资源保留。
