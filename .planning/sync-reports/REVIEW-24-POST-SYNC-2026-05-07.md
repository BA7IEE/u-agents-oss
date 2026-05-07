# Review v24 — v23 P0/P1 + v0.9.2 sync 落地后复盘（2026-05-07）

**Review 焦点**：v23 review + 落地（P0 5 项 + P1 3 项）+ v0.9.2 sync 完整链后第一次复盘
**main HEAD**：`91ee3924`（sync/upstream-20260507-v092 分支）
**总评**：**B+**（主基线健康但 v23 多智能体 + v0.9.2 sync 各漏盘 1-2 项 P0，"SOP 写了 ≠ 实战跑了"风险暴露）

> v23 是发现问题的多智能体扫描；v24 是**实施后复盘**——专门找"v23 落地时是否有质量瑕疵"。
> 本次 7 agent 抓到的真 P0 都是 v23 + v0.9.2 sync 共同漏盘的——**单轮 review 不够**，需多轮复盘。

---

## 0. 7 Agent 评级总览

| Agent | 焦点 | 评级 | P0 数 | P1 数 | P2 数 | P3 数 |
|---|---|---|---|---|---|---|
| **E1** | 跨 commit spec/code 一致性 | **A−** | 0 | 1 | 0 | 4 |
| **E2** | §3.7 表 vs 实际 marker 完整性 | **A** | 0 | 0 | 0 | 3 |
| **F1** | P1 代码 3 项实施质量 | **C** ⚠️ | **2** | 0 | 2 | 1 |
| **F2** | v0.9.2 sync merge 完整性 | **A** | 0 | 0 | 0 | 0 |
| **G1** | v0.9.2 新功能 U-API 副作用 | **B** ⚠️ | **1** | 1 | 1 | 1 |
| **G2** | craft 残留 + LLM 锁定再扫 | **A** | 0 | 0 | 0 | 5 |
| **H1** | v0.10.x 同步预测 + SOP 残留 | **B** ⚠️ | **1** | 2 | 2 | 0 |

**P0 = 4**（F1 ×2 + G1 ×1 + H1 ×1 — 全部 v23/sync 漏盘）
**P1 = 4**（E1 ×1 SOP 文档矛盾 + G1 ×1 设计冲突 + H1 ×2 SOP 缺步骤）
**P2 = 5**（多为漏遗补丁）
**P3 = 14**（spec 文档 polish）

---

## 1. 关键 P0 新发现（4 项 — v23 多智能体 + sync 共同漏盘）

### 1.1 F1.F3 [P0] SSRF 重定向绕过 — v23 P1 落地无效化

**威胁**：[`api-tools.ts:275`](../../packages/shared/src/sources/api-tools.ts) `await fetch(url, fetchOptions)` 默认 follow redirect。

**攻击路径**（与 [`M3-REFRESH-API-SSRF-SPEC.md`](../M3-REFRESH-API-SSRF-SPEC.md) §5.1 自承缺口同级）：
1. 攻击者诱导用户导入恶意 source 配 `baseUrl: 'https://attacker.com/'`（合法 https，`assertPublicHttpsUrl` 通过）
2. AI 调 tool 时 fetch 到 attacker.com，attacker 返回 302 → `http://169.254.169.254/latest/meta-data/iam/security-credentials/`
3. fetch 默认 follow，**带着 Authorization header** 跟随到云元数据 → AWS 临时凭证泄漏

**v23 review 缺陷**：v23 §2.2 SSRF 二次接入只复用 `assertPublicHttpsUrl`，但 spec §5.1 明确把"重定向到私网"列为不防的攻击。我们 v23 P1 落地时**复制了缺口**，把 spec 已知风险面积从 1 处（refreshApiRenew）扩到 2 处（含 api-tools）。

**修复**：fetch options 加 `redirect: 'manual'`，30x 响应主动校验 `Location` header 后再决定 follow（或拒绝）。

---

### 1.2 F1.F5 [P0] 4 个 SSRF 单测全为 grep-only 占位符 — C5 自洽不成立

**问题**：[`api-tools-ssrf.test.ts`](../../packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts) 4 个 `it()` 块全部用 `readFileSync(api-tools.ts)` + 正则匹配源码字符串，**0 个 invoke createApiTool 跑 runtime**。

**对比同目录 [`credential-manager-renew.test.ts:236`](../../packages/shared/src/sources/__tests__/credential-manager-renew.test.ts)**：
- ✓ 真 mock fetch + 调 `credManager.refresh()` + `expect(fetchCalls).toHaveLength(0)`
- 我的 4 单测：✗ 只检查源码里有 `assertPublicHttpsUrl` import + safety check 在 fetch 之上 + isError:true 字符串

**这种测试无法捕获**：
- (a) 哪天 SSRF 检查被注释掉但 import 保留 → grep-only 仍 pass
- (b) `assertPublicHttpsUrl` 误判 `169.254.169.254` 为公网 → grep-only 仍 pass
- (c) redirect bypass（§1.1 P0）→ grep-only 完全无视

**CLAUDE.md §3.7 C5 自洽要求"新改造点必加单测"** — 占位符级合规，没真测试。

**修复**：重写 4 单测，参考 `credential-manager-renew.test.ts` 模式（mock fetch + invoke createApiTool 的 callback + 验证 fetchCalls.length === 0 / response 含 "Request blocked by SSRF guard"）。

---

### 1.3 G1.F2.1 [P0] v0.9.2 sync 漏盘 1 处用户可见 craft 注释

**漏盘点**：[`packages/pi-agent-server/src/index.ts:1285`](../../packages/pi-agent-server/src/index.ts) 注释：
```typescript
// Force the Craft-built system prompt onto the Pi session.
```

**git blame 证实**：commit `8981384b`（v0.9.2 release commit）新加的。我们 v0.9.2 sync 时 4 处品牌化（errors.ts / claude-agent.ts / spawn-helpers.ts / release-notes 0.9.2.md）**漏了这一处**——与 v17 review F2/F3（messaging access-control 文案漏盘）同模式。

**修复**：改为 `// Force the U Agents-built system prompt onto the Pi session.` + 加 `// U-API:` marker（按 §3.7 #45c 登记）。

---

### 1.4 H1.F4 [P0] v23 §13.5/§13.6 5 项验证清单实战 0 跑 — "SOP 写了 ≠ 实战跑了"

**问题**：[SYNC-v0.9.2-20260507.md](SYNC-v0.9.2-20260507.md) §1（"主要是收尾"）+ §10 自吹"验证了 v23 SOP P0 5 项刷新（特别是 09-test-checklist §13.5/§13.6/§13.7 的新工序）实战可用性"——

**实测**：SYNC 报告 §5 验证结果 + §7 时间消耗，**0 处 grep**：
- §13.5 M2 安全 fix 4/4（TLS strict / atomicWriteFileSync / dir 0o700 / Token 长度）→ 0 跑
- §13.6 M3 安全 fix（SSRF / DSN / 死路径 grep）→ 0 跑
- §13.7 仅跑了 `validate:ci`，没记录 husky 触发统计 / §3.7 基线 grep（已含但其他工序未触发）

**实战覆盖度**：5/13 项 = **38%**

**根因**：v23 P0 加 SOP 清单只让"未来 sync 有清单可对照"，没强制"sync 报告必须逐项 grep 并贴输出到报告"。SOP 工程未内化为流程检查项。

**修复**：
1. SYNC 报告模板加"§13.5-§13.7 验证 grep 输出"独立章节（每项必须贴 grep 输出，0 命中或非 0 都要写）
2. 09-test-checklist §13.7 末尾加"sync 报告必备贴片"checkbox

---

## 2. 关键 P1 新发现（4 项）

### 2.1 G1.F4.1 [P1] browserToolEnabled 默认 true — 设计冲突

[`storage.ts`](../../packages/shared/src/config/storage.ts) `browserToolEnabled: true` → U-API 用户**首次启动会看到 browser_tool 入口**。

[`AppSettingsPage.tsx:233-243`](../../apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx) 显式渲染 Tools section 的 `builtInBrowser` toggle。

**冲突点**：[`04-feature-cuts.md`](../04-feature-cuts.md) **没有 browser tool 裁剪条目**；[`03-ui-lockdown-spec.md`](../03-ui-lockdown-spec.md) 也没列 AppSettingsPage Tools section。

**决策待用户**：
- 选项 A：U Agents 是高级用户工具，browser tool 默认开启 OK（保持现状）
- 选项 B：默认关闭（改 storage.ts 默认值）+ 04-feature-cuts.md 加"第九类"
- 选项 C：完全隐藏 toggle UI（更激进的裁剪）

### 2.2 H1.F2 [P1] package.json 批量 bump SOP 缺命令

实战做法是 `take ours + sed bump 0.9.1 → 0.9.2` 跨 15 文件，但 [`07-upstream-sync.md`](../07-upstream-sync.md) §2.4.2 只写"手动加 dependencies"，没给 sed 批量命令。下次外部 AI 必须重新发明。

**修复**：07 §2.4.2 补一段批量 bump shell 命令模板。

### 2.3 H1.F3 [P1] C11 grep 未前置进 sync §2.5

`@craft-agent/` 残留是 typecheck fail 才发现（v0.9.2 sync 实战触发了 1 处 `sendmessage-oauth-refresh.test.ts`），多 1 轮重跑。SOP §2.7c C11 写了核对命令但 §2.5 主流程"应冲突而未冲突"段没列入。

**修复**：07 §2.5 末尾加 `grep -rEn "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l` 期望 0 必跑。

### 2.4 E1.F12 [P1] SYNC-PLAYBOOK-v0.9.1.md 仍写 71/9/9（应 73 或动态）

P0 commit 加封存声明时基线是 71；P1 commit 升 73 时漏改 [`SYNC-PLAYBOOK-v0.9.1.md:5`](SYNC-PLAYBOOK-v0.9.1.md)。

**修复**：要么 71 → 73（一行改），要么改成"参 CLAUDE.md §3.7 取数"动态指向。

---

## 3. P2 改进项汇总（5 项，下次月度同步前批量）

### 3.1 F1.F2 release-notes brand 漏遗 4 处

v23 P1 commit 只改了 0.7.0/0.7.5/0.8.13 — 但 `getCombinedReleaseNotes` 加载全集，仍命中：

| 文件 | 内容 | 严重度 |
|---|---|---|
| [`0.4.3.md:31`](../../apps/electron/resources/release-notes/0.4.3.md) | `craft-v0.4.1` Codex 上游 release tag | P3（灰区，可改可不改）|
| [`0.7.2.md:17`](../../apps/electron/resources/release-notes/0.7.2.md) | `CRAFT_DEV_RUNTIME` env var 文案 | **P2**（用户可见功能描述把 env var 当品牌读）|
| [`0.7.7.md:41`](../../apps/electron/resources/release-notes/0.7.7.md) | `CRAFT_DEBUG` env var 文案 | **P2**（同上）|
| [`0.8.12.md:23`](../../apps/electron/resources/release-notes/0.8.12.md) | `craftdocs://` URL scheme | P3（技术接口）|

**修复**：0.7.2/0.7.7 用上下文重写（如把 `CRAFT_DEV_RUNTIME` 改成中性"dev runtime override env"）；0.4.3 与 0.8.12 可保留。

### 3.2 G1.F3.2 [P2] 测试 fixture craft + 缺 U Agents.app 显式回归

[`claude-agent-spawn-cwd.test.ts:193, 195`](../../packages/shared/src/agent/__tests__/claude-agent-spawn-cwd.test.ts) 仍用 `/Applications/Craft Agents.app/...` 测试字面量。

虽然 regex `(.+)$` 能 capture 任意 macOS bundle 路径，但**没显式 U Agents.app case**——假设破裂时不会立刻报警。

**修复**：补一条 `'/Applications/U Agents.app/Contents/.../claude'` 测试 case。

### 3.3 H1.F5 [P2] 测试 baseline 漂移记录 SOP 缺失

v22 baseline 2821 → v0.9.2 后 2854（+33）。SOP 没要求记录这种正向漂移作为下次 sync 的 baseline。

**修复**：09-test-checklist §13.7 加"baseline 漂移记录"列，每次 sync 后写 `2821 (v22) → 2854 (v0.9.2)` 形式。

### 3.4 G1.F1.2 / G2.F4 / E1.F13 / E2 polish 等
（细节略，详见各 agent 报告）

---

## 4. 跨 review 一致性矛盾（v24 自身发现）

### G1 vs G2 矛盾

- **G1.F2.1** 报 P0：`pi-agent-server/src/index.ts:1285` "Craft-built" 漏盘
- **G2.F1-F12** 报 "v0.9.2 sync 后新增用户可见 craft：0 处"

**矛盾原因**：G2 agent 在扫描时**漏看了 pi-agent-server/src/index.ts**（可能 grep 时排除了某个目录）。这反而证明：单 agent 扫描有盲区，多 agent 交叉验证有价值。

**结论**：以 G1.F2.1 为准（git blame 实证 + 上下文清晰）。

---

## 5. 修复优先级（按工作量）

### Bucket A：本仓库 AI 立即可做（§0 铁律允许，写 .md / 改 release-notes / 改 code 注释）

| # | 项 | 工作量 |
|---|---|---|
| **1** | E1.F12 SYNC-PLAYBOOK-v0.9.1.md L5 71/9/9 → 73/9/9（或动态指向）| 2min |
| **2** | F1.F2 0.7.2.md / 0.7.7.md release-notes 上下文重写（CRAFT_DEV_RUNTIME / CRAFT_DEBUG → 中性） | 5min |
| **3** | G1.F2.1 pi-agent-server/src/index.ts:1285 注释 "Craft-built" → "U Agents-built" + §3.7 加 #45c marker | 5min |
| **4** | H1.F2 07-upstream-sync.md §2.4.2 加 package.json 批量 bump 命令 | 5min |
| **5** | H1.F3 07-upstream-sync.md §2.5 加 `@craft-agent/` 残留 grep 必跑 | 3min |
| **6** | H1.F4 09-test-checklist.md §13.7 末尾加"sync 报告必备贴片"checkbox + SYNC 模板补 | 10min |

### Bucket B：用户授权破例（改 .ts 代码）

| # | 项 | 工作量 | 风险 |
|---|---|---|---|
| **7** | F1.F3 + F1.F5 SSRF 真修：`api-tools.ts` 加 `redirect: 'manual'` + 处理 30x；4 单测重写为 runtime mock fetch | 30-60min | **P0 安全债** |
| **8** | G1.F3.2 测试 fixture 补 U Agents.app 显式回归 | 10min | P2 |

### Bucket C：用户决策

| # | 项 | 影响 |
|---|---|---|
| **9** | G1.F4.1 browser tool 是否纳入 §3.4 功能裁剪？默认 true / false / 隐藏 toggle | 影响 04-feature-cuts.md + 可能改代码 |

### Bucket D：下次月度 sync 前批量

| # | 项 | 工作量 |
|---|---|---|
| 10 | F1.F2 P3 灰区（0.4.3.md / 0.8.12.md）按用户意见处理 | 5min |
| 11 | H1.F5 baseline 漂移记录 SOP 补 + 加 v22 → v0.9.2 实例 | 10min |
| 12 | E1/E2 P3 polish（§3.7 表项格式 / C11 表加 v0.9.2 实例 / Build 子表 grep 注释罗列 copy-subprocess-servers.ts）| 15min |

---

## 6. v24 元评估：实施后复盘的价值

| 维度 | v24 评估 |
|---|---|
| **覆盖广度** | 7 agent vs v23 10 agent — 更聚焦于"实施质量"而非"全方位扫描" |
| **真 P0 数** | **4 项**（v23 + sync 共同漏盘）— 验证"单轮 review 不够" |
| **跨 review 矛盾** | 1 处（G1 vs G2）— 反向验证多 agent 交叉的价值 |
| **SOP 实战内化** | **失败**（H1.F4 抓到 SOP 写了但不跑）— 本次最痛点 |
| **§0 铁律守恒** | ✓ 全部 agent 仅 Read/Grep/Bash 只读；本汇总文档亦为 .md |

**v24 真新价值**：
1. 证明 v23 P1 SSRF 落地有"假合规"问题（grep-only 测试 + redirect bypass 未补）— v23 多智能体扫描没抓到
2. 抓到 v0.9.2 sync 漏盘 1 处 brand（pi-agent-server/index.ts:1285）— 与 v17 模式一致
3. 抓到 SOP 工程内化失败（§13.5/§13.6 5 项 0 实跑）— v23 P0 真正解决的不是"加清单"而是"清单必须强制贴片"

---

## 7. v8-v24 review 体系演化

```
v8-v17  防御性 review        (14 真 P0 关闭)
v18-v20 深度 review           (9 项新 finding)
v21     发布后稳态盘点
v22     5 项代码层落地实施
v23     10-Agent 多智能体并行 (88 项 finding)
v23 后  P0/P1 + v0.9.2 sync 全链路落地（4 commit）
v24     7-Agent 实施后复盘     (4 真 P0 漏盘 + SOP 工程化失败)
```

**真 P0 演进**：
- v8-v17 关闭 14 个真 P0
- v23 关闭 0（找到 6 SOP P0 + 9 P1，全是文档/代码层）
- v23 落地后 v24 发现 **新 4 个真 P0**（SSRF 实质绕过 + 占位符测试 + sync 漏盘 + SOP 实战失败）

**核心教训**：**SOP review + 实施 + 实施后复盘 = 三步循环，缺一不可**。v23 多智能体广度好但深度不够（B1 agent 没抓 SSRF redirect bypass，C5 自洽合规变占位符）；v24 复盘发现这些隐藏债。

---

## 8. 一句话推荐

**当前**：先做 Bucket A 6 项（本仓库 AI 半小时）→ Bucket B 7+8 共 40-70min（用户授权破例 + SSRF 真修）→ Bucket C 9（用户决策 browser tool 裁剪策略）

**评级演进预期**：
- 修完 Bucket A → v24 评级 A−（SOP 6 项漏洞补全）
- + Bucket B 7 SSRF 真修 + 8 测试 fixture → A（解决 v23 P1 假合规 + 补回归）
- + Bucket C 9 决策落地 → A+

**等数据驱动**（不阻塞）：
- M3-1 OAuth relay 部署
- M3-4 GlitchTip
- macOS x64 装包实测

---

**v24 commit 链**：仅本仓库 AI 写 .md（v24 自身报告 + Bucket A 文档刷新），无代码改动。

**下次 review（v25）触发条件**：
- Bucket A + B 落地后实证核查（事件驱动）
- 或 v0.10.x sync 启动前的 readiness review
- 或月度定期（2026-06-初）多智能体重 run
