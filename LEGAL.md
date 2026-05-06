# LEGAL.md — U Agents 合规清单

> 本文档是合规审计依据。**任何修改 `LICENSE` / `NOTICE` / `TRADEMARK.md` 的行为都需要本文授权**。

> **章节编号速查**（其他文档用 `LEGAL.md §N` 引用本文时按下表换算）：
>
> | 引用形式 | 对应章节 |
> |---|---|
> | `LEGAL.md §1` | 一、三层法律义务 |
> | `LEGAL.md §2` | 二、Apache 2.0 强制项 |
> | `LEGAL.md §3` | 三、上游商标合规 |
> | `LEGAL.md §4` | 四、Anthropic Commercial Terms |
> | `LEGAL.md §5` | 五、已知白标瑕疵（子章节用 §5.1 / §5.2 / ... 阿拉伯数字）|
> | `LEGAL.md §6` | 六、用户协议 / 隐私政策 |
> | `LEGAL.md §7` | 七、合规检查清单 |

---

## 一、三层法律义务

| 层级 | 来源 | 我们的义务 |
|---|---|---|
| 1. 代码许可 | Apache License 2.0 (`LICENSE`) | 保留 LICENSE 全文、保留 NOTICE 全文、声明派生作品 |
| 2. 商标使用 | 上游 `TRADEMARK.md`（Craft Docs Ltd.）| 改名、改 Bundle ID、改 Logo、移除 craft.do 引用 |
| 3. 第三方服务 | Anthropic Commercial Terms（因使用 Claude SDK）| 遵守 Anthropic 商业条款 |

---

## 二、Apache 2.0 强制项（永不删改）

### 必须保留的文件

- ✅ `LICENSE`（Apache 2.0 全文）
- ✅ `NOTICE`（Craft Docs Ltd. 版权声明 + 第三方依赖说明）
- ✅ 所有源文件中已有的版权头（如有）

**Round 45 合规边界补充**：`LICENSE` / `NOTICE` / `TRADEMARK.md` 内出现的 `Craft`、`Craft Docs Ltd.`、`craft.do`、`legal@craft.do` 属于上游许可/版权/商标政策证据，**不得为了白标而删除或替换**。但这些联系渠道只代表上游权利人或商标许可咨询，**不是 U Agents 用户支持渠道**；应用 UI、README、下载页、安装包元数据、package metadata 中的客服/主页/author/email 仍应改为 U Studio / U Agents 自有信息。

**Round 46 文档边界补充**：根 `README.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`、`docs/cli.md`、`apps/electron/README.md`、`packages/*/README.md`、`packages/*/CLAUDE.md` 中的 `security@craft.do`、`conduct@craft.do`、上游 GitHub clone/PR 流程、`@craft-agent/*` 安装示例等，**不属于必须保留的合规证据**。如果这些文档会随 U Agents 对外发布或被官网/下载页引用，必须改为 U Agents 自有支持/安全/贡献边界；如果 M1 不发布，则必须在发版说明中标注“不发布范围”。

### 我们必须新增的

- ✅ 在 `NOTICE` 文件**底部追加**一段（不修改原内容）：

```
---

This product is "U Agents" (优智体), a derivative work based on
Craft Agents (https://github.com/lukilabs/craft-agents-oss),
licensed under the Apache License, Version 2.0.

Modifications and additional code in this distribution are
Copyright © 2026 U Studio (tungwerl@gmail.com).

This distribution contains modifications to the original Craft Agents
source files. A summary of modifications is documented in:
https://u-agents.u-studio.cn/docs/modifications

Per Apache License 2.0 §4(b), a list of modified files and the nature
of changes can be found in the project's CHANGELOG.md and the
.planning/ directory in the source repository.
```

### Apache 2.0 §4(b)：修改声明合规（**新增，第 18 轮发现，前 17 轮漏**）

**LICENSE 原文要求**：
> (b) You must cause any modified files to carry prominent notices stating that You changed the files; and

**含义**：我们 fork 后修改的每个文件，理论上**都要在文件顶部加显著修改声明**。M1 改造涉及几十个文件，逐个加注释维护成本极高。

**业界 fork 项目实际做法**（按合规严格度排序）：

| 等级 | 做法 | 维护成本 | 我们的选择 |
|---|---|---|---|
| 🔴 严格 | 每个改过的文件顶部加 modification header | 高 | 仅核心改造点（见下） |
| 🟡 中等 | NOTICE 文件中声明"包含修改" + 文档化修改清单 | 中 | ✅ **M1 选这个** |
| 🟢 最低 | 仅 NOTICE 顶部声明 | 低 | 不够 |

**M1 合规策略（中等级别）**：

1. **NOTICE 文件**在 M1 #12 完成后应包含"contains modifications"声明（见上面追加的第二段）；当前源码未改造前不代表已追加 ✅
2. **文档化修改清单**：`.planning/01-branding-spec.md` + `.planning/03-ui-lockdown-spec.md` + `.planning/04-feature-cuts.md` 已经详细列出所有改造点，可作为合规证据 ✅
3. **核心改造点加 modification header**（限定 6 个最显著文件）：
   - `apps/electron/electron-builder.yml`（appId / productName 改动）
   - `packages/shared/src/branding.ts`（VIEWER_URL / CRAFT_LOGO）
   - `packages/shared/src/config/paths.ts`（CONFIG_DIR 改名）
   - `packages/shared/src/auth/state.ts`（U-API keyless 特判）
   - `packages/server-core/src/domain/connection-setup-logic.ts`（BUILT_IN_CONNECTION_TEMPLATES + validateSetupTestInput）
   - `packages/shared/src/config/storage.ts`（enforceUApiBaseUrl 注入点）

**推荐 modification header 格式**（每个核心改造文件顶部）：

```typescript
/**
 * Modified by U Studio for U Agents (优智体) — derivative work
 * based on Craft Agents (Apache 2.0).
 *
 * Original: https://github.com/lukilabs/craft-agents-oss
 * Modifications: see .planning/01-branding-spec.md, .planning/02-llm-gateway-spec.md
 */
```

或更简短的 inline header（适合小改动）：

```typescript
// U-API: <修改简述>，详见 .planning/02-llm-gateway-spec.md §4.1
```

**未来 CHANGELOG.md**（M2 阶段建立）：
- 列出每个版本的改造范围
- 提供"上游 base commit + 我们的 commit 范围"映射
- 这本身也是 §4(b) 合规的一部分

**关于 i18n / 注释 / 配置文件**：
- 这些是数据/配置文件，不是源代码，**严格意义上不在 §4(b) 范围**
- M1 #12 完成后的 NOTICE 中的"contains modifications"声明覆盖
- 不需要在每个 `.json` / `.yml` 顶部加 header

**法律风险评估**：
- Apache 2.0 是宽松许可证，§4(b) 历史上极少触发法律诉讼
- 业界 fork 项目（包括很多商业产品）多数采用"中等"级别合规
- 我们做到 NOTICE 声明 + 文档化清单 + 核心文件 header，**已属合规上游线**
- 但**永远不要**移除 LICENSE / 原始 NOTICE 内容——这是 §4(c) 强制要求

### About / 关于页面必须显示（**2026-05-04 修订 — 决策变更**）

合规要求分两阶段实现，与 Electron 原生 about 面板的能力限制对齐（详见 `03-ui-lockdown-spec.md` §3.1）：

#### M1（macOS 原生 about 面板 — 简化合规）

**当前实现**（commit d6d3aaa → 5月 4 日修订）：

```typescript
app.setAboutPanelOptions({
  applicationName: 'U Agents',
  applicationVersion: app.getVersion(),
  copyright: 'Copyright © 2026 U Studio Ltd.',
})
```

About 面板**只显示** U Studio 自有版权——**不再** 在 copyright/credits 字段提及上游品牌。

**为什么仍然合规（Apache §4(c)）**：

Apache 2.0 §4(c) 要求 derivative work 的 distribution **必须包含** NOTICE 文件的可读副本（"a readable copy of the attribution notices"）——但**没有规定必须出现在 About 对话框**。当前合规路径：

1. **NOTICE 文件保留上游版权 + 我们追加的派生声明**（详见本节上方"我们必须新增的"）— ✅
2. **`electron-builder.yml` 的 mac/win/linux extraResources 把 LICENSE + NOTICE 打进 packaged app**（`U Agents.app/Contents/Resources/{LICENSE,NOTICE}`）— ✅ 用户解 .app 或在 Finder "显示包内容" 即可看到完整 attribution
3. **About 对话框**仅显示 U Studio 版权 — 简洁的产品 UI

**§4(c) 满足判定**：用户拿到 packaged app → 包内含 LICENSE/NOTICE 文件副本 → 满足"readable copy of the attribution notices"。

**previous M1 决策**（已废弃，仅作历史记录）：曾在 About 显示 `Based on Craft Agents (Apache 2.0)` + `Original work © Craft Docs Ltd.`，理由是"用户能看到署名"。新决策取消这个，因为产品方希望 About UI 干净；§4(c) 的合规底线由 NOTICE 文件 + extraResources 联合满足。

#### M2（自定义 About 对话框）

M2 阶段新建一个 React 自定义 About 对话框（菜单项 "About U Agents..." 调 IPC 打开 BrowserWindow），届时升级为：
- 可点击的 GitHub 链接（如果产品方决定显示上游引用）
- 可点击的 Apache 2.0 链接 → 内嵌 `LICENSE` 文件查看
- "View third-party licenses" → 内嵌 `NOTICE` 全文查看

> M1 阶段**不要**为追求"可点击链接"强行做自定义对话框——会扩大改造范围，破坏 M1 "最小可白标"目标。

---

## 三、上游商标合规（Trademark Policy）

来源：上游 `TRADEMARK.md`（已在仓库根目录保留）。

### 必须做的

| 项 | 状态 |
|---|---|
| 改名（不含 "Craft"）| ✅ U Agents / 优智体 |
| 改 Bundle ID | ✅ `cn.u-studio.u-agents`（已落地于 `electron-builder.yml`，详见 `.planning/01-branding-spec.md`）|
| 替换所有 Logo / Icon | ✅ 已落地（M1 首发：`apps/electron/resources/icon.*` + `craft-logos/` 全替换为 U Agents 视觉）|
| 移除/替换 `craft.do` 域名引用 | ⚠️ 已清理用户可见路径；剩余约 17 处属已知瑕疵（OAuth relay 首次授权地址栏短暂显示 `agents.craft.do`，路线图 M3 自建 relay 后解决；上游 `README.md` / `docs/cli.md` 内 `craft-cli` 字面量按 §3.6 + `08-conflict-zones.md` 设计保留——M1 不发布范围）|
| **不**暗示官方背书 | ✅ |

### 可以做的（合规表述）

- "Based on Craft Agents" ✅
- "Fork of Craft Agents" ✅
- "Built with Craft Agents technology" ✅

### 不能做的

- ❌ 用 "Craft" 任何变体作产品名
- ❌ 用 Craft 的 Logo
- ❌ 暗示"Craft 官方中文版"

---

## 四、Anthropic Commercial Terms

来源：`NOTICE` 文件提到，因为使用 `@anthropic-ai/claude-agent-sdk`，受 [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms) 约束。

### 关键义务

- 我们作为商业分发方，需遵守 Anthropic 的内容政策
- 不得宣传"用 U Agents 生成违法内容"
- 模型输出引发的责任，按 Anthropic 条款分配

### 中转站架构带来的特殊点

由于流量经过 `token.u-studio.cn`（newapi）再到 Anthropic：
- **U Studio 是 newapi 的运营方**，对最终模型供应商（Anthropic / OpenAI）的合约义务由 U Studio 直接承担
- 终端桌面应用层面，Anthropic 看到的请求来源是 newapi，不是终端用户
- 这意味着：**U Studio 需要自己有 Anthropic 商业账号，并对所有终端用户的合规使用负责**

---

## 五、已知白标瑕疵（已被开发者接受）

### 5.1 OAuth 中转走 craft.do

**现象**：当用户首次添加 Slack / Gmail / Microsoft / Google 类型的 Source 时，浏览器会跳到：
- `https://agents.craft.do/auth/callback`
- `https://agents.craft.do/auth/slack/callback?port=...`

URL 地址栏会短暂显示 `craft.do`，可能让用户察觉这是基于 Craft 的 fork。

**原因**：Slack / Microsoft / Google OAuth 要求**固定回调 URL**。上游用 `agents.craft.do` 作为统一中转，再通过 `state` 参数把请求转回到本地端口。这是上游产品基础设施的硬依赖。

**短期对策**：
- 不主动宣传 OAuth Source 功能
- 文档/帮助里注明"首次授权时浏览器会短暂跳转中转域名，正常现象"
- 使用其他 Source 类型（MCP / API Key / 本地）替代时无此问题

**长期对策（路线图 M3）**：
- 自建 OAuth relay 服务，部署到主域路径下（`https://u-agents.u-studio.cn/auth/callback` 与 `/auth/slack/callback`）
- 注册自己的 Google / Slack / Microsoft 开发者应用（Client ID / Client Secret）
- 修改 `packages/shared/src/auth/oauth-relay.ts` 与 `slack-oauth.ts` 把回调地址换成自己的

### 5.2 自动更新初期可能"双指"

如果在 `electron-builder.yml` 中的 `publish.url` 改造完成前出包发给用户，老包会去 `agents.craft.do/electron/latest` 拉更新清单——**用户机器会被官方 Craft 更新覆盖**。

**对策**：M1 阶段**绝不**对外发布任何 publish.url 未改造的构建。详见 `.planning/05-build-release.md`。

### 5.3 错误日志 / Sentry 链路

上游用 `@sentry/electron`。在 `apps/electron/src/main/index.ts:20` 已经做了正确的防护：

```typescript
Sentry.init({
  dsn: process.env.SENTRY_ELECTRON_INGEST_URL,
  enabled: !!process.env.SENTRY_ELECTRON_INGEST_URL,  // 没 DSN 自动完全禁用
  beforeSend(event) {
    // 上游已实现：移除 authorization headers / API keys / tokens / credential-like values
  }
})
```

**M1 阶段对策**：环境变量 `SENTRY_ELECTRON_INGEST_URL` **不设置**——`enabled` 自动为 `false`，Sentry **完全不工作**，不会有任何流量发出。✓ 这是上游已经替我们做好的能力。

**M3 自建 Sentry 时**：注册自己的 Sentry self-hosted 或 GlitchTip，把 DSN 设到环境变量。**保留**上游的 `beforeSend(event)` 钩子（已做 PII scrubbing），按 `02-llm-gateway-spec.md` §9.2 的要求扩展，确保 Token 不上报。

### 5.4 Remote workspace TLS 校验关闭（**REVIEW-5 2026-05-04 首发现 → 2026-05-05 已修复**）

**修复**：commit `c516e4d2`（"fix(security): enforce strict TLS verification"）删除 3 处显式 `tlsRejectUnauthorized: false` override，让 `WsRpcClient` 默认严格 TLS（client.ts:160 `?? true`）接管。

**修复位置**：
- ✅ `apps/electron/src/main/handlers/workspace.ts:27` — 删 + 加 `// U-API:` marker
- ✅ `apps/electron/src/preload/bootstrap.ts:124, 148` — 删 + 加 marker
- ✅ `packages/server-core/src/transport/client.ts:99` — JSDoc 校正（"Default: false" → "Default: true (strict)"）

**详细 spec**：[`M2-TLS-FIX-SPEC.md`](.planning/M2-TLS-FIX-SPEC.md)

**M1 用户影响**：0（M1 单机使用，不连 remote workspace）

**M3+ 影响**：未来用户用自签名证书的 remote server 会被 TLS 校验拒绝。M3 自建 OAuth relay 时应同时设计 cert pinning UI 或 opt-in 关闭，详见 spec §7。

---

### 5.4-historical 修复前的安全风险（保留作为历史记录）

修复前：用户配置 remote workspace 连接 `wss://example.com` 类远端 server 时**不验证 TLS 证书**。LAN 攻击者（咖啡馆 WiFi + ARP 投毒 + self-signed 证书）可截全流量（session prompt + 文件 + Token + LLM 请求），mitmproxy 即可拦。M1 单机使用未触发。M2 修复后此风险消除。

### 5.5 ASAR 关闭——锁定不防技术高超用户

**代码事实**：`apps/electron/electron-builder.yml:86` `asar: false`（注释说 "Disable ASAR to avoid decompression overhead and click delays"——上游性能优化决策）。

**含义**：
- packaged 后的 `.app` 内**所有 dist/* 文件直接以源码形式存在**（不打成 .asar 单一压缩包）
- 用户可以在 Finder 右键 → 显示包内容 → 进入 `Contents/Resources/app/` 直接看到所有源代码
- 即使开启 ASAR (asar: true)，`npx asar extract` 也能轻松解包

**对 M1 锁定的影响**：

| 用户类型 | 我们的锁定能否生效 |
|---|---|
| 普通用户（99%）| ✓ 看不到源码、不会改 |
| 高级用户（1%，会用终端）| ⚠️ 可以编辑 `.app/Contents/Resources/app/dist/` 内的代码绕过锁定（如改 `paths.ts` 的 CONFIG_DIR、改 `enforceUApiBaseUrl` 的 FIXED_BASE_URL）|

**M1 决策（接受这个限制）**：
- 不改 `asar: false` —— 改回 `true` 会牺牲启动性能（上游已评估过 trade-off）
- 用户改完代码后，**自动更新装新版本会覆盖**他们的改动（除非他们一直拒绝更新）
- M1 锁定的目标是"普通用户的产品体验锁定"，不是"防黑客 / 防破解"——这与 `PRODUCT.md` 目标用户画像（非技术 / 半技术用户）一致

**M3+ 阶段可选优化**：
- 切到 `asar: true` 接受启动延迟换取一道屏障（但 npx asar extract 仍可解）
- 真正"防破解"需要做代码混淆（如 `electron-builder` 的 native 编译选项）—— 超出 U Agents 商业模式需要的强度

---

## 六、用户协议 / 隐私政策（待补）

**M1 上线前必须有**：
- 用户协议（中文）—— 明确数据流向（用户 → 桌面客户端 → token.u-studio.cn → 上游 LLM）
- 隐私政策（中文）—— 明确收集什么、不收集什么
- 国内合规：如面向公众销售，需要 ICP 备案；如涉及生成式 AI，需要按照《生成式人工智能服务管理暂行办法》考虑算法备案问题

**v0.9.1 同步后隐私政策起草补充项**（v15 B 路盲区 5 提示）：
- **Telegram 集成数据收集**：v0.9.1 上游加 Telegram bot whitelisting + access control（per-binding `'inherit' | 'allow-list' | 'open'` + workspace-level `'open' | 'owner-only'`）。涉及"用户 ID 白名单"——属 PII 处理，但**当前 [`packages/messaging-gateway/src`](../packages/messaging-gateway/src) 已经处理 Telegram 数据**（v0.9.1 加 access control 反而是 PII 收敛而非新增暴露）。隐私政策章节应说明：
  - U Agents 不主动采集用户 Telegram 用户名/ID
  - 仅当用户主动绑定 Telegram bot 时存储用户白名单（本地配置文件）
  - 数据存储位置：`~/.u-agents/messaging-gateway/`
  - 不上传任何 Telegram 数据到 token.u-studio.cn 或第三方
- **WhatsApp 集成数据**：同样原则（已在 packages/messaging-whatsapp-worker 处理）
- **Per-model image support toggle**（v0.9.1 新增）：用户附件图片在 LLM 不支持图像时被替换占位符——这是隐私正向（图片不会泄露给不支持的 LLM）

这两份文档不在本仓库管理范围内，但产品上架前必须完成，建议放在官网（`u-studio.cn`）。

---

## 七、合规检查清单（每次发版前）

- [ ] `LICENSE` 文件未被修改
- [ ] `NOTICE` 文件保留原内容 + 我们追加的派生声明
- [ ] **packaged app 内含 LICENSE + NOTICE 文件**（`U Agents.app/Contents/Resources/{LICENSE,NOTICE}` — 由 `electron-builder.yml` mac/win/linux extraResources 注入；满足 Apache §4(c)）
- [ ] About 对话框显示 `Copyright © 2026 U Studio Ltd.` （上游署名走 NOTICE 文件，不在 About UI 显示 — 详见 §2）
- [ ] 应用内**用户可见**界面无 `Craft` / `craft.do` / `lukilabs` 字样
- [ ] `electron-builder.yml` 的 `publish.url` 指向自建更新服务器
- [ ] 自动更新清单 `latest.yml` 由我们的服务器提供
- [ ] OAuth 中转的"已知瑕疵"已在帮助文档中说明
- [ ] Sentry DSN 不指向 craft 项目（要么禁用，要么自己的）
- [ ] 用户协议、隐私政策已在官网上线（生产分发前）
