# Review v23 — 10-Agent 深度多维 review（2026-05-07）

**Review 焦点**：用户授权派 10 个 Opus 4.7 子智能体并行扫描，从对齐 / 质量 / 影响 / 后续更新 4 个方向全方位深度核查
**main HEAD**：`a41df06b`（claude/admiring-lichterman-a47f82 + main + origin/main 三处同步）
**总评**：**A−**（项目主基线完整且健康；6 项 P0 SOP 缺口 + 2 项 P1 用户可见 craft 残留 + 1 项 P1 SSRF 二次接入；无 P0 安全 / 锁定 / 数据破坏问题）

> v22 是 5 项代码改动后的复盘；**v23 是 v22 之后第一次系统性多智能体深度 review**。

---

## 0. 10 Agent 评级总览

| Agent | 焦点 | 评级 | P0 数 | P1 数 | P2 数 | P3 数 |
|---|---|---|---|---|---|---|
| **A1** | §3.7 marker 反向核对 | **A** | 0 | 0 | 0 | 6 |
| **A2** | §3.3 高冲突文件 vs 上游 v0.9.2 diff | **A** | 0 | 0 | 0 | 9 |
| **A3** | spec 群 vs 代码事实校验 | **A** | 0 | 1 | 1 | 9 |
| **B1** | U-API 入口安全审计 | **A−** | 0 | 1 | 2 | 14 |
| **B2** | 测试覆盖与 dead code | **A** | 0 | 0 | 1 | 1 |
| **B3** | 跨平台打包 + i18n 一致性 | **A−** | 0 | 0 | 5 | 4 |
| **C1** | 用户可见 craft 残留 | **B+** | 0 | 2 | 0 | 6 |
| **C2** | LLM 入口锁定边界 | **A** | 0 | 0 | 2 | 6 |
| **D1** | 下次同步阻力预测 | **A** | 0 | 1 | 0 | 0 |
| **D2** | SOP / Playbook 完备度 | **B** | 6 | 4 | 2 | 5 |

**P0 = 6**（全部在 D2 — SOP 工序覆盖空白）
**P1 = 9**（C1×2 用户可见 + B1×1 SSRF + A3×1 OAuth relay 已知 + D1×1 sync 准备 + D2×4 SOP）
**P2 = 13**（多为 dead export / 内部 id / spec 漂移）
**P3 = 60**（大多文档微漂 / 已记 follow-up / 防护性死代码）

---

## 1. P0 关键发现（6 项 — 全在 SOP 完备度，非代码缺陷）

### 1.1 SOP 跨文档基线 67/8/8 → 71/9/9 漂移未刷（D2.F6）

**问题**：CLAUDE.md §3.7 已升至 71/9/9，但 [`07-upstream-sync.md`](../07-upstream-sync.md) §2.5 step 9 行 249 仍写"期望 67"+ 多处 "= 8"；[`SYNC-PLAYBOOK-v0.9.1.md`](SYNC-PLAYBOOK-v0.9.1.md) 行 218-219 仍 "61 ± 2"+ "8/8"。

**影响**：下次外部 AI 按 SOP 跑会以为"基线漂移超容差需告警"，浪费排查时间。

### 1.2 v22 后 5 项新工序未沉淀进 SOP（D2.F1-F5）

| # | 缺失工序 | 证据 |
|---|---|---|
| F1 | `bun run validate:ci` 全绿验证 | 09-test-checklist.md grep `validate:ci` = 0 命中 |
| F2 | husky pre-commit 装回（`.husky/pre-commit` 跑 lint:i18n:staged） | 07 §2.6 step 0 仅说"`bun install` 触发 prepare"，未交代 hook 内容 |
| F3 | M3 SSRF `assertPublicHttpsUrl` 测试 | 09-test-checklist.md grep `SSRF\|assertPublicHttpsUrl\|metadata` = 0 |
| F4 | M3 DSN assertion `U_AGENTS_PACKAGING=1` 三平台 build 验证 | 09 §1+§14 build 章节 0 提 |
| F5 | M3 死路径 `CRAFT_*` env grep 0 残留验证 | 09 §13.3 已含 craft 字面量 grep 但缺 5 项 ENTRY/CLI/CLIPBOARD |

**影响**：v0.10.0 sync 时（预期下月）外部 AI 走 SOP 不会自动跑这些验证，依赖个人记忆 / REVIEW-22 → REVIEW-23 交叉查阅。

### 1.3 M2 安全 fix 4/4 验证空白（D2.F7）

`09-test-checklist.md` grep `atomicWriteFileSync|0o700|MIN_LLM_API_KEY|TLS strict|m2-security` 全文 = 0 命中。REVIEW-22 §2.3 已确认 50 单测落地，但用户验收路径无对照清单——只有 §3 LLM 锁定 / §13.3 品牌 grep，无安全 fix 行为验收。

---

## 2. P1 关键发现（9 项 — 需排期处理）

### 2.1 用户可见 craft 残留 2 处（C1.F1 / C1.F2）— **真实用户可看到的字面量**

#### C1.F1：`apps/webui/src/login.html` `placeholder="Enter CRAFT_SERVER_TOKEN"`

WebUI login 页面密码框 placeholder 直接显示 `CRAFT_SERVER_TOKEN`，用户能看到。i18n 已有 `transport.authFailed: "Verify your server token"`，但此处是硬编码 HTML，未走 i18n。

**修复**：改为 `Enter server token` 或 `U_AGENTS_SERVER_TOKEN`（一行 HTML 改）。

#### C1.F2：release-notes 历史版本含 Craft 字面量经 "What's New" overlay 触达用户

[`apps/electron/resources/release-notes/0.7.0.md`](../../apps/electron/resources/release-notes/0.7.0.md) 标题 `# v0.7.0 — Craft CLI、无头服务器与架构重构` + `## Craft CLI`；`0.7.5.md` 行 19 `Craft 源文档`；`0.8.13.md` 行 25 `Pi 内置工具安全接受 Craft UI 元数据`。

[`AppShell.tsx:560`](../../apps/electron/src/renderer/components/AppShell.tsx) "What's New" overlay 通过 `getCombinedReleaseNotes` 加载所有版本 release-notes — **用户开此面板会看到 Craft 字面量**。直接命中 §3.5（不暴露上游品牌）。

**修复决策**：3 个 release-notes 文件做品牌替换扫描（参考 §3.7 表 #29 模式），或改写为"早于 U Agents 发布的历史版本"声明。

### 2.2 SSRF 二次接入缺口（B1.F8）— P1 安全债

[`packages/shared/src/sources/api-tools.ts:260`](../../packages/shared/src/sources/api-tools.ts) `await fetch(url, fetchOptions)` 是 source-defined API tool 的实际请求，路径来自 `config.baseUrl + path`。**未接 `assertPublicHttpsUrl`**。

**威胁场景**：用户被诱导导入恶意 source 配 `baseUrl: 'http://169.254.169.254/'` + `path: '/latest/meta-data/iam/security-credentials/'`，AI 调 tool 时会带 `Authorization` header 直接打云元数据。

**与 refreshApiRenew 同级别 SSRF 风险**，[`M3-REFRESH-API-SSRF-SPEC.md`](../M3-REFRESH-API-SSRF-SPEC.md) §5.2 已列为 "follow-up" 但未实施。

**修复**：在 api-tools.ts:260 fetch 前加 `await assertPublicHttpsUrl(url)`，加 §3.7 marker，加单测（C5 自洽）。

### 2.3 M3-OAUTH-RELAY 4 处 craft.do 残留（A3.F3 / D1）

[`packages/shared/src/auth/oauth-relay.ts:3`](../../packages/shared/src/auth/oauth-relay.ts) + [`slack-oauth.ts:269/359/360`](../../packages/shared/src/auth/slack-oauth.ts) 仍有 `agents.craft.do`。

**Spec 状态**：[M3-OAUTH-RELAY-SPEC.md](../M3-OAUTH-RELAY-SPEC.md) 已就绪，等 Cloudflare Worker 部署 + 4 OAuth app 注册。**M3 启动入口**（≥50 活跃用户）。

### 2.4 v0.9.2 上游同步阻力（D1.F4-F5）

**已发现**：上游已发 v0.9.2（v0.9.1 之后单 commit `8981384b`，2026-05-06 21:00 UTC，落后约 12h）。

| 高风险点 | 文件 | 估时 | 原因 |
|---|---|---|---|
| #1 | `packages/shared/src/prompts/system.ts` | 30-45min | +109 行（3 hunk）叠加我们 M1 brand 改造 |
| #2 | `packages/shared/src/agent/claude-agent.ts` | 20min | +356 行新功能含 1 处 "Reinstalling Craft Agents typically fixes this" 错误文案（用户可见！）|
| #3 | `packages/pi-agent-server/src/system-prompt-override.ts` | 10min | 新文件全 craft 字面量（4 处） |

**§3.3 7 个高冲突文件全部未被触碰**（0 冲突）。预估总同步 **45-75min（小阻力）**。

### 2.5 SOP 其他 P1（D2.F8-F11）

- **D2.F8**：性能基准未含 SSRF guard 引入的 fetch 微延迟
- **D2.F9**：07-upstream-sync §2.7c C10 仅以 midStreamBehavior 为唯一案例，缺"未来字段同样处理"显式表述
- **D2.F15**：07 假定读者已知"§3.7 标记"语义，无入门索引到 CLAUDE.md
- **D2.F16**：SYNC-PLAYBOOK 是 "v0.9.1 专用"，下次 v0.10.0 没等价模板，新人易困惑

---

## 3. P2 改进项汇总（13 项，下次月度同步前批量）

### 3.1 数据完整性

- **B1.F11**：[`packages/shared/src/sources/storage.ts:138`](../../packages/shared/src/sources/storage.ts) `writeFileSync(... 'config.json')` 是 source 配置（含 baseUrl/auth/headers），用户态数据持久化路径未原子化 — 断电时 source 配置可能损毁。M2-ATOMIC-WRITES-SPEC §2 未列入。
- **B1.F4**：`enforceUApiBaseUrl` 在 customEndpoint spread 时强制 `supportsImages: true`；用户每次启动会被重置 — 与 02-llm-gateway-spec §2"用户可关"轻微 spec drift。

### 3.2 Dead code / Dead export

- **B2.F2**：`U_API_TOPUP_URL` ([`packages/shared/src/config/u-api-defaults.ts:7`](../../packages/shared/src/config/u-api-defaults.ts)) 是 dead export — 定义后零真实消费方（仅 ApiKeyInput.tsx marker 注释提及"no longer imported"）。可安全删除或保留作 Topup 入口 hook。

### 3.3 资源 / 配置内部 id 残留

- **B3.F11**：[`apps/electron/resources/permissions/default.json`](../../apps/electron/resources/permissions/default.json) 含 ~20 处 `^craft-agent\s+...` 正则（CLI 子命令）；`U_AGENTS_FEATURE_CRAFT_AGENTS_CLI` 未启用为休眠路径
- **B3.F12**：[`apps/electron/resources/tool-icons/tool-icons.json:4`](../../apps/electron/resources/tool-icons/tool-icons.json) 含 `id: "craft-agent", icon: "craft-agent.svg"`，displayName 已是 "U Agents"，但 id+icon 名继承上游
- **B3.F8**：[`packages/server/src/index.ts`](../../packages/server/src/index.ts) M2 headless server 模块仍含 `CRAFT_*` env API（与桌面端隔离），未登记进 §3.7 改造点表
- **C1.F8 / C1.F6**：`secure-storage.ts` `MAGIC_BYTES = 'CRAFT01\0'` + `craft-agent-v1/v2` HKDF salt — **凭证兼容性不能动**，仅记录

### 3.4 i18n key 名

- **B3.F5**：全 7 locale 仅剩 1 处 i18n key 名 `loginWithCraft`（值已是 "U Agents"），改 key 会牵动所有调用点

### 3.5 spec 文档自洽

- **A3.F2**：M3-DEAD-PATH-CLEANUP-SPEC §1.4 表头与修订记录矛盾（表说要加 marker，修订记录说不动 CRAFT_DEBUG）

### 3.6 Webui session cookie 半可见

- **C1 其他**：[`packages/server-core/src/webui/auth.ts:56`](../../packages/server-core/src/webui/auth.ts) `SESSION_COOKIE_NAME = 'craft_session'` 在 DevTools Cookies 面板可见 — 半可见，建议改 `u_agents_session`

---

## 4. 各 agent 详细 finding（10 个，按 ID 索引）

### A1 §3.7 marker 反向核对（评级 A）

- **主基线实测：71 / 期望 71（±2）✓**
- START 块：9 / END 块：9 ✓
- Build 子表：20 / 期望 ≥13 ✓
- **反向覆盖：71 行 marker 100% 映射到 §3.7 主表 1-44 项**
- **正向覆盖：44 主条目 + B1-B7 全部能 grep 定位到代码符号**
- 6 个 P3：行号微漂、编号字母后缀混排、B1-B7 视觉断序（disambiguation 注释清晰）

### A2 §3.3 高冲突文件 vs 上游 v0.9.2 diff（评级 A）

- **upstream remote 已配且可达**（`https://github.com/lukilabs/craft-agents-oss.git`，已 fetch v0.9.2）
- 7 文件全部本地改动有 spec 据
- 关键 marker (§3.7 #18/#12/#13/#26b/#1/#2/#3) 全部到位
- `publish.url` 含 `/latest`（v17 F1 修复有效）
- `llm-connections.ts` 与 spec "零差异" 一致
- 3 处轻量品牌字面量替换无 marker（属 01 §2 品牌全表，不要求 marker）
- LICENSE/NOTICE extraResources 建议补登记（A2.F3 P3）

### A3 spec 群 vs 代码事实校验（评级 A）

- 抽样 25 项，对的 24 / 行号轻微漂移 1
- **未发现 P0/P1 假事实**
- 3 处行号轻微漂移：M3-DEAD-PATH §1.4 / M3-SSRF §2.2 / M3-Sentry §2.1
- 1 处 P2 自洽问题（A3.F2，§3.3 已收入）
- M3-OAUTH-RELAY 4 处 craft.do 残留如实标记 P0 待办

### B1 U-API 入口安全审计（评级 A−）

**完整路径**：
- baseUrl 锁定**完整**（continuous lock + 多 slug 覆盖 + C10 字段保留 OK）
- 凭证 keyless 特判**完整** + 测试覆盖
- TLS 严格化、Token 长度限制**完整**
- atomic writes 4 主路径**完整**
- dir 0o700 完整

**缺口**：
- **B1.F8 P1**：`api-tools.ts:260` SSRF 二次接入缺口（§2.2 已收入）
- **B1.F11 P2**：`sources/storage.ts:138` atomic 遗漏（§3.1 已收入）
- **B1.F4 P2**：customEndpoint supportsImages 强制覆盖（§3.1 已收入）

**死代码（依赖 enforceUApiBaseUrl filter）**：
- ApiKeyInput.tsx ANTHROPIC_PRESETS 19 项
- APISetupStep.tsx 5 个非 U-API ApiSetupMethod
- Anthropic driver `connection.baseUrl || 'https://api.anthropic.com'`
- 这些是上游同步火药桶 — 上游若改 useOnboarding 默认 apiSetupMethod 或拆 enforce filter，会一夜泄漏

### B2 测试覆盖与 dead code（评级 A）

- **测试 2821 pass / 3 fail / 12 skip**（5103 expects, 147 files, 20.02s）
- 3 fail 全是历史已知技术债（OAuth network-flaky ×2 + send_developer_feedback Explore mode）
- **新引入 fail：0**
- typecheck:all 全绿 / lint:i18n:parity OK / validate:ci 全绿
- C5 自洽：12 项改造点（#31a-36 + #43-44）有完整单测；2 项（#35/#42）字符串改造仅 marker 即可
- 1 dead export（U_API_TOPUP_URL，§3.2 已收入）

### B3 跨平台打包 + i18n 一致（评级 A−）

- build-win.ps1 vs root chain：一致（5 步主链路 step 1-4 已修，step 5 historically inline）
- `U_AGENTS_PACKAGING=1` 三平台一致 export
- artifact 命名一致：`U-Agents-${arch}.dmg/AppImage`，0 处 `Craft-Agents-*` 残留
- 1 处 i18n key 名 `loginWithCraft`（§3.4 已收入）
- env vars `U_AGENTS_*` 命名一致，无 mix
- resources 内部 id 残留（§3.3 已收入）

### C1 用户可见 craft 残留（评级 B+）

- **2 处 P1 用户可见**（§2.1 已收入：webui placeholder + release-notes overlay）
- 6 处 P3 死路径 / 注释（url-validator.ts 7 处 mcp.craft.do dead code 等）
- **双品牌混用：无新发现**
- craft.do 总数 vs 已知 4：5（多 1 处 url-validator.ts dead code）
- lukilabs：全部在 Apache §4(b) 合规允许范围

### C2 LLM 入口锁定边界（评级 A）

- **三层防护齐全**：UI / 配置 / 运行时
- 真实 baseUrl 输入框可见数：**0**
- provider 字面量真实泄漏：**0**（所有 anthropic.com / openai.com / googleapis / bedrock 路径都被 enforceUApiBaseUrl 拦截或在死路径）
- runtime LLM 流量 100% 锁定到 `U_API_BASE_URL`（continuous startup lock + per-save 调用）
- SDK 子进程 `ANTHROPIC_BASE_URL` 来源链可追溯

### D1 下次同步阻力预测（评级 A）

- 上游 v0.9.2 = 小型修补 release（spawn-ENOENT 防御 + token refresh 健壮化 + 系统 prompt 重整）
- 完全没碰 §3.3 的 7 个高冲突文件，也没碰 build pipeline
- 预估总同步 **45-75min（小阻力）**
- 高风险点 Top 3 已收入 §2.4
- 建议时机：M2.5 收尾批准后立即开 sync 分支处理（合理趁热）

### D2 SOP / Playbook 完备度（评级 B）

- **6 项 P0**（§1 已收入：基线漂移 + 5 项 v22 后新工序）
- 4 项 P1（§2.5 已收入：性能基准 / C10 表述 / 入门索引 / playbook 模板）
- SOP-REHEARSAL-4 演练定基线 61/8/8 → 实际 v0.9.1 release 67/8/8 → v22 落地 71/9/9 — 演练落后 2 步
- v0.9.1 sync 临场补丁（C11/C12/C13/C14）已写进 07-upstream-sync §2.7c，但 SYNC-PLAYBOOK-v0.9.1 §5 仍只跑 C10
- 新人接手时长估计：4-6 小时

---

## 5. 综合评估：4 个维度

### 5.1 对齐情况（上游 ↔ 本地代码 ↔ 文档）

**评级：A**

- §3.7 改造点 marker 71/9/9 全数对位，正反向覆盖率 100%
- §3.3 7 个高冲突文件改动全部 spec 有据
- spec 群 25 项硬事实抽样命中率 24/25
- 仅 1 处 P2 spec 自洽矛盾（M3-DEAD-PATH §1.4 表头 vs 修订记录）

### 5.2 代码质量

**评级：A−**

- 测试 2821 pass / 0 新引入 fail
- typecheck:all + lint + validate:ci 全绿
- C5 自洽完整
- 1 dead export 可清理
- **缺口**：B1.F8 SSRF 二次接入（P1）+ B1.F11 source atomic 遗漏（P2）

### 5.3 改动影响（用户可见 / 锁定边界）

**评级：A−**

- LLM 入口锁定**完整无漏**（三层防护，真实泄漏 0）
- 双品牌使用规范，无混用
- **缺口**：2 处用户可见 craft 残留（webui placeholder + release-notes overlay）— P1 但修复极简

### 5.4 后续更新顺畅度

**评级：B+**

- 下次同步阻力**小**（v0.9.2 只 45-75min）
- 上游 v0.9.2 完全没碰 §3.3 高冲突文件
- **缺口**：SOP 6 项 P0 工序覆盖空白（v22 后新工序未沉淀） — 不阻塞但增加新人接手成本

---

## 6. 推荐 follow-up（按优先级）

### P0：SOP 跨文档刷新（本仓库 AI 可做，§0 铁律允许写 .md）

| # | 项 | 工作量 |
|---|---|---|
| **1** | [07-upstream-sync.md](../07-upstream-sync.md) §2.5 step 9 基线 67/8/8 → 71/9/9 | 5min |
| **2** | [SYNC-PLAYBOOK-v0.9.1.md](SYNC-PLAYBOOK-v0.9.1.md) 行 218-219 基线 61 → 71、8/8 → 9/9 | 5min |
| **3** | [09-test-checklist.md](../09-test-checklist.md) 加 v22 后 5 项新工序验证步骤 | 30-45min |
| **4** | [09-test-checklist.md](../09-test-checklist.md) §17（新章节）M2 安全 fix 4/4 验证 | 15min |
| **5** | M3-DEAD-PATH-CLEANUP-SPEC §1.4 表头修正（CRAFT_DEBUG 保留） | 5min |

### P1：代码改造（需用户授权破例 §0 铁律）

| # | 项 | 工作量 | 依赖 |
|---|---|---|---|
| **6** | C1.F1：[`webui/login.html`](../../apps/webui/src/login.html) placeholder 改 `Enter server token` | 1min | 用户授权 |
| **7** | C1.F2：3 个 release-notes 文件 brand 替换扫描 | 30min | 用户授权 + 决策（替换 / 改写 / 历史档案声明）|
| **8** | B1.F8：[`api-tools.ts:260`](../../packages/shared/src/sources/api-tools.ts) 接入 `assertPublicHttpsUrl` + 单测 + §3.7 marker | 30min | 用户授权 |

### P1：上游 v0.9.2 同步（外部 AI 跑）

| # | 项 | 工作量 |
|---|---|---|
| **9** | v0.9.2 sync 分支 + 3 个高风险文件 review（system.ts / claude-agent.ts / system-prompt-override.ts）| 45-75min |

### P2：批量清理（下次月度同步前）

| # | 项 | 工作量 |
|---|---|---|
| 10 | `U_API_TOPUP_URL` dead export 删除 | 2min |
| 11 | `permissions/default.json` craft-agent 正则评估（FEATURE_FLAG 启用 vs 删除）| 待决策 |
| 12 | `tool-icons.json` id+icon 名重命名 | 5min + 资源同步 |
| 13 | `webui/auth.ts:56` SESSION_COOKIE_NAME 改 `u_agents_session` | 1min（含迁移考虑）|
| 14 | `packages/server/src/index.ts` CRAFT_* env 登记进 §3.7 | 5min |
| 15 | M3-DEAD-PATH §1.4 表 vs 修订记录自洽修复 | 3min |

### P3：长期 backlog

- §3.7 表项 26a/26b/31a-d/32a-d/33a-c/44a/44b 编号格式标准化
- B7 entry "DSN warn" 字样与脚本注释对齐
- LICENSE/NOTICE extraResources 登记进 §3.7

---

## 7. v23 元评估：10-Agent 多智能体 review 价值

| 维度 | 评估 |
|---|---|
| **覆盖广度** | ✓ 4 维度 × 10 子智能体 = 全方位扫描；前 22 次 review 中最广 |
| **发现密度** | 88 项 finding（6 P0 + 9 P1 + 13 P2 + 60 P3）— 高于 v8-v22 单次平均 |
| **新发现** | 2 项 P1 用户可见 craft 残留（webui placeholder + release-notes overlay）此前 review 未触达 |
| **自动化潜力** | ✓ 10 agent 分工明确，可作为月度月初定期 review 模板 |
| **§0 铁律守恒** | ✓ 全部 agent 仅 Read/Grep/Bash 只读；本汇总文档亦为 .md，未触代码 |

**v23 真新价值**：
1. 首次系统性发现 release-notes "What's New" overlay 的 craft 字面量泄漏（v8-v22 22 轮 review 漏盘）
2. SSRF 二次接入缺口（api-tools.ts:260）spec 已列 follow-up 但未实施 — review 督促真实修复
3. SOP 跨文档基线漂移问题（67→71）通过多智能体交叉 review 被识别

---

## 8. v8-v23 review 体系演化

```
v8-v17  (防御性)      → 修问题 / 防发版翻车（14 真 P0）
v18-v20 (深度)        → 跨 review 一致性 + 9 项新 finding
v21     (规划性)      → 发布后稳态盘点 + M3 readiness 55%
v22     (实施后)      → 5 项 P0/P1 代码层落地 + readiness 55% → 75%
v23     (多智能体)    → 10-Agent 并行深度核查 + 88 项 finding 分级
```

**真 P0 全部关闭**（v8 R2 分发缺口 / v17 漏盘 / 事故 #3-#5 build pipeline / M2.5 #5 CI 死引用）。

**v23 后真 P0 仅剩**：6 项 SOP 工序覆盖空白（非代码缺陷，本仓库 AI 可独立修复）。

---

## 9. 一句话推荐

**当前**：先把 P0 SOP 5 项刷新（本仓库 AI 半天搞定，§0 铁律允许） → P1 代码 3 项打成 1 个授权 commit（外部 AI 1 小时） → 同期 v0.9.2 sync 分支（45-75min）。

**等数据驱动**：M3 启动入口（≥50 活跃用户）— 此刻 M3 SSRF / DSN / dead-path 代码已就绪，仅等 OAuth Worker 部署 + Sentry self-host。

**评级演进预期**：
- 修完 P0 SOP 5 项 → v23 评级 A−
- 加 P1 代码 3 项 + v0.9.2 sync → A
- M3-1 OAuth relay 部署 → A+ / M3 readiness 90%

---

**v23 审查 commits 链**：仅本仓库 AI 写 .md（v23 自身报告 + P0 SOP 5 项刷新），无代码改动。

**下次 review（v24）触发条件**：
- v0.9.2 sync 完成后 实证落地核查（事件驱动）
- 或 P1 代码 3 项落地后 复盘核查（事件驱动）
- 或月度定期（2026-06-初）多智能体重 run（流程化）
