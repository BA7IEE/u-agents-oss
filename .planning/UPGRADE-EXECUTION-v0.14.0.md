# v0.14.0 实施记录

## 状态

已完成本地代码候选与最终自动化验证。用户于本会话明确要求“开始落地”，按 r2 授权范围实施。原 main 和未跟踪项保持原地；不接真实数据、不发布。

## W0

- O: `c6cf072d5bd03fa645430d901ff5bd112b708c2f`
- T: `73bd9c2a3573158bea880984eb8d5fdb41e0cac2`
- 工作区: `/Users/dengwang/.codex/worktrees/upstream-v014/u-agents`
- 分支: `codex/upstream-v0.14.0`
- 初始 tracked 改动为零；原 `.agents/`、`.codex/`、`manifest.json` 不搬移、不清理。
- 只使用合成 fixtures。未启动应用，未读取正式凭证/工作区数据；停机生产备份和旧包恢复演练保留为真实数据运行前置项，不能记已完成。

### 原未跟踪项指纹（仅路径与摘要）

- `.agents/skills/brand-audit/SKILL.md`: `c7c1aa81e5ec31e751f71e1a086fc1d580913b41a8dc74f78f532e6890c598d6`
- `.agents/skills/i18n-check/SKILL.md`: `202f78d394ece45cd0af14f4116d01bf4dbf795131d0808107256638a5d9cabf`
- `.agents/skills/spec-writer/SKILL.md`: `2e1b97a2b25af4692525361e2245267d00d63532dee816b1f957a1afe45bf6f9`
- `.agents/skills/uapi-markers/SKILL.md`: `cb992960b672107094f2dcf6643db59e319c69c650ed73c746e0ae909700dd4b`
- `.agents/skills/upstream-sync/SKILL.md`: `c7f276b5fc56dbdd9916ca2275a9903fa89c77940efe9dccf983fcb319a2c643`
- `.codex/hooks/enforce-docs-only.py`: `3cadbb6042fa3e1234b4cdf0f1f60edb5b3b81d09e42c2d894dcd65d411552a1`
- `.codex/hooks.json`: `0e94f21a16afbccb8b98a138688ad01a87627f856596c63956b2248ab1112fb3`
- `manifest.json`: `f8e78c3707eecd0198cb9bb8ba178f298e1ac683b32928590ad75cda2ed70fb4`


## W1–W8 实施与关键冲突处置

首次三方合并出现 102 个冲突路径；先消除 `@craft-agent`/`@u-agents` 等命名差异，再逐块适配，未以整目录 ours/theirs 覆盖。最终 `git ls-files -u` 为空。

| 冲突/边界 | 最终实现 | 验证 |
|---|---|---|
| 连接设置与密钥复用 | handler 先校验固定网关与合法已存 slug，再读取凭据；掩码不作密钥发送 | llm-connections-uapi-policy.isolated |
| 动态模型刷新 | 保留推荐/手选/消失模型规则、逐模型及连接级图片覆盖值 | discovery + refresh-preservation + refresh-storage.isolated |
| SessionManager / Claude/Pi 工具 | 保留 owner/cache 隔离、nonce 脱敏与原付费身份；新 ChatOptions 使用 ephemeral turnContext | paid-image-lifecycle/redaction/registry + source-activated-auto-retry |
| 权限 | 接收细粒度记忆、子会话权限上限等修复；Guarded 在存储恢复、解析、切换和检查处归一 Ask | permission suites + guarded product regressions |
| API 共用执行层 | executeApiRequest 保留 HTTPS/私网拒绝、手动重定向和错误脱敏，聊天/Pages 共用 | api-tools-ssrf + source_test |
| 配置与凭证目录 | U_AGENTS_CONFIG_DIR 优先，兼容 CRAFT_CONFIG_DIR；不把真实目录自动复制进空测试根 | secure-storage-config-dir + upgrade-isolation |
| Pages | F1、F2 API/MCP 开放；script/F3/公开发布关闭，旧配置可见且不执行 | pages suites + pages-feature-policy |
| 决策模型 | resolve 的政策检查先于 skipGates/取密钥；test/probe/密钥写入同样受限；UI 与工具不开放 | policy、health、decide/tool-defs |
| 自动化 | 普通任务保留；semanticCondition 拦截且保留原配置；持久 Webhook 重试核对现配置，未知/停用任务暂停 | u-agents-semantic-policy，含普通重试恢复 |
| SDK 重试 | 显式设置 main 16 秒、ephemeral 4 秒 agent 等待上限，保持原退避预算，不增加测试超时 | session-settings |
| 构建 | 接收上游移除旧 session MCP bundle；保留 Pi subprocess，使用新工作树安装和清空 dist 后构建 | frozen-lockfile + electron:clean/build |
| 品牌与本地化 | 自有网关/下载/更新入口、来源声明保留；Pages 文档与 13 份中文升级摘要裁剪未支持功能 | locale parity/sorted/coverage，marker audit |

### 测试适配说明

- 关闭功能的上游正例改为零网络/零模型/零脚本负例；纯解析、API/MCP、普通自动化测试保留。
- 修复测试临时目录仍被更高优先级环境变量覆盖的问题；拦截器用例不再写真实 HOME。
- 移除无 I/O 的 OAuth URL 测试中的永久 fetch 替换；其他 fetch 模拟在 afterEach 恢复。
- 浏览器测试跟随 toolbarView 与 did-finish-load 的真实容器/事件，不增加等待时长。
- 上传 TTL 用受控计时器验证 25ms 分片刷新 40ms TTL，去除机器负载竞争，不放宽 TTL。
- 不增加 skip。现有 12 项跳过：11 项 Windows/PowerShell 环境相关，1 项 dist host-root 开发环境检查。

## 运行隔离与验收边界

本轮测试使用 `/tmp/uagents-v014-execution/config` 与合成 fixture；macOS sandbox 拒绝读写真实 `~/.u-agents`、`~/.craft-agent`，禁止外发（仅允许 localhost 测试）。目录预检 `bun scripts/upgrade-isolation-preflight.ts <合成副本根>` 拒绝符号链接、外部绝对路径、凭证库与后台定义。它是启动前的保守筛查，不能替代进程沙箱或证明任意脚本安全。

未启动桌面应用、未使用真实业务副本、未做计费请求。真实数据备份/迁移副本启动/旧包恢复、Windows 与正式 macOS 安装包运行、签名公证、实时网关、生图费用对账仍待验收；本轮不得把这些项目标成通过。

## 验证日志

日志位于 `/tmp/uagents-v014-execution/logs`。该目录是本机临时证据，不保证跨机器或重启长期留存；下列结果将在最终回归后补齐。

- `frozen-install.log`：`bun install --frozen-lockfile` 成功，无 lock 更新。
- `validate-ci-final.log`：隔离环境 `bun run validate:ci` 成功；19 项文档工具测试通过，7 语言各 1914 key，2093 个 literal callsite 通过检查。公开源码不含 workers/pages，原脚本明确跳过其类型检查；Pages Worker 非本轮发布内容。
- `lint-1.log`：0 errors，Electron 119 warnings、shared 14 warnings。未通过关闭规则消除警告；这些警告不等同于无质量债务。
- `refresh-storage-2.log`：实际刷新→原子写配置→重载的独立回归通过。
- `semantic-policy-2.log`、`targeted-6.log`：政策拦截、持久重试保留/恢复与 HTTP 登录定向回归通过。


### 最终收口前复核

- `full-5.log` 的主测试集：6070 pass / 12 skip / 0 fail。随后原隔离测试夹具暴露问题，已修正：prerequisite-manager 显式模拟浏览器开关并使用当前 `browser_tool` 名；branch rollback 使用保留实际导出的 partial config mock。
- `prerequisite-isolated-2.log`：33/33；`branch-isolated-2.log`：3/3。其余七个隔离文件见 `isolated-final-*.log`，均通过。
- `clean-build-final.log`：`electron:clean` 后完整 Electron 构建成功，renderer 有大 chunk 提示；没有旧 dist 或旧 session MCP bundle 兜底。
- `test-final.log` 与 `lint-final.log` 为修正后的统一入口复验，结果以下方最终证据为准，不能仅凭上面的中间日志声称统一命令通过。
- 再次核对原工作区：main 仍为 O；原七组未跟踪项保留；没有 tracked 改动。

## 当前交付边界

本轮目标是本地代码候选，未合入 main、未 push/PR、未发布。安装包与真实数据运行门禁继续保留；需要先有停机备份、可回滚旧包和隔离重映射副本，才能进行真实迁移验收。真实网关和收费生图需要单独记录费用/凭据边界，不以本轮假数据测试代替。


## 最终验证结果

- `bun run test`：退出码 0；主测试 6070 pass / 12 skip / 0 fail，随后 9 个隔离文件全部通过，共 6200 pass / 12 skip / 0 fail。
- `bun run validate:ci`：退出码 0。
- `bun run lint`：退出码 0，133 warnings、0 errors。
- `bun install --frozen-lockfile`：退出码 0，依赖图无改动。
- `bun run electron:clean && bun run electron:build`：退出码 0。
- `git diff --check` 与冲突索引检查通过；主改造点 216，START/END 10/10。

### 证据摘要

- `test-final.log` SHA-256：`4b59fafa6b3af51346090611058eac656edbed58e8f133b1a45bc653eb33ae31`
- `validate-ci-final.log` SHA-256：`fee723bed69485679742cff819ccc44f28c202b254f92c50250ca8c73575d77d`
- `lint-final.log` SHA-256：`0873b61da4f3a599229eebaa14420ef098900fc24e5a5371ae068fbf80217517`
- `clean-build-final.log` SHA-256：`060bb52f0fbd27a2fac337e75f7797335b17f84577429e5a461f81b7f882cb37`
- `frozen-install.log` SHA-256：`13fd8b4e03759361db94a19fbeeb798647e5889e6bafae2a64d05ede844ed209`

最终提交审查另外清理上游新增文件中的 3 处多余末尾空行；仅格式调整，不改变上述测试结果对应的行为。合并提交保留 O 与固定 T 两个父提交。

## macOS 本地测试包（2026-10-01）

用户要求先打 macOS 包测试，本节补充前述代码候选之后的安装包证据，未发布更新、未替换已安装应用。

- 基础候选：`da579abcc16e62566ee2389487d689b60d9496fd`；本次附加修复见同一分支的后续打包提交。
- 修复 `feature-flags.ts` 的工作区别名依赖：改为相对导入，并在 `build-dmg.sh` 与 `electron-builder.yml` 中纳入 `config/u-agents-feature-policy.ts`。否则安装版 Pi 的 preload 无法解析此新增依赖。
- macOS 流水线使用 `bun install --frozen-lockfile` 与 `bun x --no-install electron-builder --publish never`；修正 builder 文件头的上游署名。
- 完整 `build-dmg.sh arm64` 成功；本地 ad hoc 签名，无 Apple 公证。
- 定向 `feature-flags.test.ts`：11 pass / 0 fail；脚本语法与 `git diff --check` 通过。
- `hdiutil verify` 通过；只读挂载后的 `.app` 通过 `codesign --verify --deep --strict`。
- 在仓库外 `/tmp`，以隔离配置、禁止外网和真实配置访问的沙箱运行 **DMG 内** Bun + preload，输出 `DMG_PRELOAD_OK 1.3.9`；包内 `uv --version` 为 `0.10.6`。
- 已核对 arm64 主程序、版本 `0.14.0`、SDK core/native alias、Pi server 和 WhatsApp worker。
- 产物：`apps/electron/release/U-Agents-arm64.dmg`，300182950 bytes（约 286 MiB）。
- DMG SHA-256：`cddbe13d54094e5e0e9cc29feeeb8093ea7e775015e4158b60f37b8aacd3af67`。
- 构建日志：`/tmp/uagents-v014-execution/logs/mac-package.log`。
- 同目录提供 `启动隔离测试.command`，直接运行 `mac-arm64/U Agents.app`，将配置与 Electron 用户数据置于 `~/Library/Application Support/U Agents Test 0.14.0/`，使用独立应用名和 URL scheme。启动器通过 shell 语法检查；尚未代用户进行 GUI 首启。

用户测试时建议先通过隔离启动器进入空配置测试版；不要把直接双击普通安装版当作隔离测试。真实数据迁移、回滚、网关调用与收费生图仍待另行验收。本次未启动 GUI、未导入旧数据、未作付费请求，也未自动安装。
