# v0.15.5 真实 U-API 单次验收

> 后续 GitHub 编译更新：用户已授权推送候选与双平台编译。同一提交 `d538cc88` 的 Windows x64、macOS arm64 均构建成功；本地取包与最终检查见 [GitHub 交付记录](UPGRADE-GITHUB-BUILD-v0.15.5-20261023.md)。下文的“不 push”、Windows 未运行及包摘要是本阶段历史状态，真实生图 NOT_RUN 与既有验收边界保留。

> 用户授权：沿用隔离配置，Token 手动输入，文字推理和生图先各测一次；不合主线、不发布。用户随后确认这枚 Token 没有生图模型。

本轮结论：**包内 Pi 单次真实文字推理 PASS；真实生图 NOT_RUN（Token 无生图模型），整体仍为 HOLD。** 当前候选保留生图实现，离线链路通过；尚不能据此认定真实生图或桌面多轮工具调用验收通过。

## §1 候选与执行范围

- 产品源码 / 测试包提交：`bb605b286d863927a5e28f97267df04ee0b0a1b6`；开始本轮时文档 HEAD：`c09fb08ab3d67261e74773784a61695647228115`。
- 独立工作区：`/Users/dengwang/.codex/worktrees/upstream-v0155/u-agents`，分支 `codex/upstream-v0.15.5`。本轮不修改产品源码，不重构建 DMG/ZIP。
- 文字使用当前 macOS app 内的 `vendor/bun/bun` 与 `resources/pi-agent-server/index.js`，以独立 stdio 入口执行；不启动原 app、不接正式 profile。
- 生图使用同一源码提交的 `executeUApiImageGeneration` 与真实 `createHeadlessPlatform().imageProcessor`。真实网关出口固定为 `https://token.u-studio.cn/v1`。
- 为满足各最多一次，跳过原生配置流程中的多模型探活和完整 Agent 多轮工具编排。Pi 只注册空工具列表，关闭 thinking，本轮输出上限 1,024。原连接输出上限、原生保存和 GUI 自动调用生图不在本次结论内。

## §2 真实结果与请求次数

R1 证据根为 `/private/tmp/uagents-v0155-execution-20261022/real-qa-20261023`；修正后的 R2 根为 `/private/tmp/uagents-v0155-execution-20261022/real-qa-r2-20261023`。下表业务请求次数不含只读模型列表。

| 项目 | 结果 | 实际业务 POST |
|---|---|---:|
| R1 辅助入口 | Pi 启动前被重复套用的 OS sandbox 拒绝，未发送推理；生图目录检查拒绝执行 | 推理 0 / 生图 0 |
| R2 包内 Pi 文字推理 | PASS：`gpt-6.1-sol`，OpenAI Chat Completions，HTTP 200，回复精确为 `UAPI-TEXT-OK`；没有工具调用和重试 | 推理 1 |
| R2 真实生图 | NOT_RUN：服务返回 `service_unconfigured`、`claimed=false`、`charge_state=not_sent`；用户确认 Token 没有生图模型 | 生图 0 |
| 合计 | 一次真实文字推理；没有真实生图或图片文件 | **推理 1 / 生图 0** |

文字提示词为 `只回复 UAPI-TEXT-OK。不要调用任何工具。`，北京时间 2026-10-23 18:52:23 开始、18:52:49 完成本轮。Pi 报告 input 6,305 / output 11 / total 6,316 tokens；input 包含运行时上下文，不等于用户这句提示词的长度。未核对网关账单，不声称最终扣费金额或费用为零。

R1/R2 各执行两次鉴权 GET `/v1/models`，均为 HTTP 200：一次供聊天模型选择，一次由生图服务自行验证。另有不带 Token 的连通性 GET，返回预期 HTTP 401。`result.json` 保留原始分类；其中生图的 `status=FAIL` 是辅助程序对服务错误的分类，验收按未发请求记为 NOT_RUN，不当作真实生图失败样本。

当前 Token 模型目录为 `gpt-5.5`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`、`gpt-6.1-sol`、`minimax-m3`；前五项只有 `openai`，最后一项有 `openai` / `anthropic`，没有图片生成条目。

生图发现规则见 [`u-api-image-generation.ts:126`](../packages/server-core/src/services/u-api-image-generation.ts#L126) 的 `selectModel`：必须有且只有一个模型同时声明 `image-generation`、`uapi-image-edit-v1`、`uapi-image-default-v1`。本轮未猜模型 ID、注入能力标记或绕过目录检查。聊天的 `supportsImages` 表示图片输入能力，不能证明能生成图片。

## §3 辅助入口修正与离线验证

R1 通过父 launcher 进入 OS sandbox 后，Pi 子入口再次调用 `sandbox-exec`，离线复现返回码 71 和 `sandbox_apply: Operation not permitted`。这是本轮辅助程序的问题，发生于推理发送前；不据此判定产品包失败。原结果与辅助文件保留，未清空既有请求记录后重跑。

R2 在已生效的父沙箱内直接启动包内 Bun/Pi，继承同一隔离环境。先在 `offline-fixture/` 使用合成 Token、合成目录 / SSE / PNG 做完整离线检查，再要求用户重新手动输入真实 Token。旧 Token 已按约定清除，没有从正式配置或旧验证服务取回。

离线结果：包内 Pi 输出 `UAPI-TEXT-OK`，同一生图服务与真实图像处理器校验并保存 1,024 × 1,024 PNG；额外一次本机推理转发被 HTTP 400 拒绝，mock 转发仍为 1。该阶段没有真实网关业务请求，图片是合成夹具，不列作真实出图证据。

## §4 隔离与单次约束

- 父入口在 Bun/import/preload 前设置同一 R2 根下的 `U_AGENTS_CONFIG_DIR` / `CRAFT_CONFIG_DIR`；保留 HOME，缓存、临时目录和 Claude/Git 配置均指向测试目录。R2 config 目录没有凭据文件。
- 实际 G0 探针确认正式 config、credentials 和主 checkout 文件打开被 OS 拒绝，未读取其内容；公网 443、系统代理 6152/6153、旧资产 / 验证端口 18555/18556/18656 连接均被拒绝。
- 主测试进程与其 Pi 子进程仅能访问本机 18658 / 18659。独立 TLS 隧道只接受 `CONNECT token.u-studio.cn:443`，程序固定连接预先解析的目标 IP；其他域名和端口的 CONNECT 均返回 403。
- macOS sandbox 不接受任意远端 IP 的 `remote ip` 写法，因此隧道进程的 OS 规则限定到远端 443，目标域名 / IP 由该独立标准库隧道入口约束。主测试进程没有直接访问公网 443 的权限。保持 TLS 证书验证，禁止重定向。
- 真实 Token 仅由用户输入本机 password 表单并短暂保留在父验证服务内存；表单立即清空，不写 query、环境变量或磁盘，不进入 Pi。Pi 只收到无效占位值，由受限转发器代加真实 Authorization。日志不保存 header 或 Token，结果保存前脱敏，结束后清除 Token 引用并关闭服务。
- `run-consumed.json` 防止重复提交；两类 POST 各有独立次数上限和发送前排他记录。计入超时或不确定结果，不转发 SDK 自动重试。R1 两类 POST 均为零，R2 没有重复真实推理。

R2 页面已通过 CUA 核对：Token 输入框为空且禁用，文字 PASS、模型 / 回复、图像 `service_unconfigured` 和实际请求计数均已显示。该页面是验收辅助页，不能替代产品会话 GUI 的工具编排验证。

## §5 证据、收尾与后续

| 证据 | 位置（相对各证据根） |
|---|---|
| R1 未发业务请求、目录缺生图 | R1 `result.json`、`offline-launch-diagnostic.json` |
| R2 真实推理、目录与请求数 | R2 `result.json`、`run-consumed.json`、`text-post-consumed.json`；没有 `image-post-consumed.json` |
| 辅助入口离线验证 / 重试拒绝 | R2 `offline-fixture/result.json`、`offline-fixture/server.sb` |
| 双配置根、包内 Bun 与隔离 | R2 `runtime.json`、`g0-result.json`、`bun-network-preflight.json` |
| 旧尝试零 POST、辅助文件摘要 | R2 `prior-attempt-verification.json`、`helper-hashes.json` |
| 收尾、主线保留与包摘要 | R2 `closeout-verification.json` |

本轮验证页、辅助服务 / relay / tunnel 均关闭；18657/18658/18659 释放。原 checkout 的 HEAD/main/origin-main 仍为 `2c496aaa7871fb4beaf99b63c0ef5746b89fe55e`，原状态与 10 项未跟踪文件摘要一致。

DMG SHA-256 仍为 `aa7af1a7dda8906a016ab695caeeea6a7d9737ddc50b19d0d96d692c76a06a28`；ZIP 仍为 `7971a64df971d02185a4506e014996aa116b826ca64b404912a56eb649d8a519`。构建时的 `BUILD.txt` 是历史快照，本次真实验收以本记录和更新后的 `TESTING.md` 为准。

后续如同一 Token 开放生图且目录满足合同，只继续一次生图，不重复已通过的文字推理。真实生图、图像扣费 / 显示、完整 GUI 多轮生图工具调用、长对话等仍未验。此前正式 profile 隔离事故及窗口状态 / config-defaults 的 UNKNOWN 结论保留，见 [GUI 修订记录](UPGRADE-GUI-FIX-v0.15.5-20261023.md)。未合主线、push、覆盖安装或发布。
