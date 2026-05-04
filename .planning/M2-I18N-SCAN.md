# M2 中文化全量扫描报告 + 执行规格

**扫描日期**：2026-05-04
**扫描基线**：M1 v0.9.0（commit `323293b`）
**对象**：`packages/shared/src/i18n/locales/*.json`（7 个 locale，每个 1376 keys）

> 本文是 **M2 中文化执行规格**——给执行 AI / 用户照做。本仓库 AI 只产出本文，不改 `.json`。

---

## 1. 扫描总览

| 项 | 数量 |
|---|---|
| Locale 总数 | 7（en / zh-Hans / de / es / ja / hu / pl） |
| 每个 locale keys | 1376 |
| Parity 状态 | ✅ 7 locale 完全对齐（missing=0 / extra=0） |
| zh-Hans 含 `Craft` 字面量 value | 0 ✅（M1 已清洗） |
| key 名含 `craft`（不区分大小写） | **3 个**（保留，见 §4） |
| zh-Hans 未翻译 value（无 CJK 字符） | **51 个** = 34 个白名单（专有名词/占位符）+ 17 个真需翻译 |

**结论**：M1 品牌词清洗到位；M2 主要工作是**翻译完成度补齐 + 术语统一 + 长度审视**。

---

## 2. zh-Hans 未翻译 value 全表（51 个）

按"是否需翻译"分两组。

### 2.1 ✅ 保留英文（合理，无需改）— 34 个

这些是专有名词、协议名、UI 占位符、缩写——保留英文是正确选择。

| Key | 当前值 | 保留原因 |
|---|---|---|
| `automations.badgeWebhook` | `Webhook` | 协议名 |
| `automations.webhookUrl` | `URL` | 缩写 |
| `chat.taskTypeShell` | `Shell` | 技术术语 |
| `common.url` | `URL` | 缩写 |
| `onboarding.apiSetup.beta` | `Beta` | 标签 |
| `onboarding.apiSetup.claude` | `Claude` | 模型专名 |
| `onboarding.apiSetup.craftAgentsBackend` | `U-API` | 品牌名（key 名是上游遗留，value 已是 U-API）|
| `onboarding.gitBash.pathPlaceholder` | `C:\Program Files\Git\bin\bash.exe` | 占位符样例 |
| `onboarding.localModel.endpointPlaceholder` | `http://localhost:11434` | 占位符样例 |
| `onboarding.providerSelect.claudeProMax` | `Claude Pro / Max` | 产品专名（已裁掉，但保留 parity）|
| `onboarding.providerSelect.codexChatGPT` | `Codex · ChatGPT Plus` | 同上 |
| `onboarding.providerSelect.githubCopilot` | `GitHub Copilot` | 同上 |
| `settings.ai.title` | `AI` | 缩写 |
| `settings.appearance.fontInter` | `Inter` | 字体专名 |
| `settings.input.cmdEnterKey` | `⌘ Enter` | 键盘符号 |
| `settings.input.ctrlEnterKey` | `Ctrl+Enter` | 键盘符号 |
| `settings.input.enterKey` | `Enter` | 键盘符号 |
| `settings.messaging.lark.appIdLabel` | `App ID` | 飞书官方术语（保持一致）|
| `settings.messaging.lark.appIdPlaceholder` | `cli_xxxxxxxxxxxx` | 占位符样例 |
| `settings.messaging.lark.appSecretLabel` | `App Secret` | 飞书官方术语 |
| `settings.messaging.telegram.title` | `Telegram` | 产品专名 |
| `settings.messaging.telegram.tokenLabel` | `Bot Token` | 技术术语 |
| `settings.messaging.whatsapp.title` | `WhatsApp` | 产品专名 |
| `settings.network.bypassPlaceholder` | `localhost, 127.0.0.1, .example.com` | 占位符样例 |
| `settings.network.proxyPlaceholder` | `http://proxy.example.com:8080` | 占位符样例 |
| `sidebar.apis` | `API` | 缩写 |
| `sidebar.mcps` | `MCP` | 缩写 |
| `sourcesList.filterApi` | `API` | 缩写 |
| `sourcesList.filterMcp` | `MCP` | 缩写 |
| `sourcesList.typeApi` | `API` | 缩写 |
| `sourcesList.typeMcp` | `MCP` | 缩写 |
| `transport.wsClosedReason` | `（{{reason}}）` | 实际是中文全角括号（grep 误判，无需改）|
| `uapi.connectionName` | `U-API` | 品牌名 |
| `uapi.tokenLabel` | `Token` | 中转语境保留英文（10 §5.3）|

### 2.2 ⚠️ 需要翻译 — 17 个

| Key | 当前值（en）| 建议 zh-Hans | 备注 |
|---|---|---|---|
| `settings.messaging.bindings.empty` | `No active bindings` | `暂无绑定` | |
| `settings.messaging.bindings.title` | `Active Bindings` | `已绑定` | |
| `settings.messaging.bindings.unbind` | `Disconnect` | `解绑` | 上下文是消息绑定 |
| `settings.messaging.telegram.configure` | `Configure` | `配置` | |
| `settings.messaging.telegram.connected` | `Connected` | `已连接` | |
| `settings.messaging.telegram.disconnect` | `Disconnect` | `断开连接` | |
| `settings.messaging.telegram.instructions` | （多行）| `1. 打开 Telegram，搜索 @BotFather\n2. 发送 /newbot 并按提示操作\n3. 复制 Token 并粘贴到这里` | 注意保留 `\n` |
| `settings.messaging.telegram.notConfigured` | `Not configured` | `未配置` | |
| `settings.messaging.telegram.testConnection` | `Test Connection` | `测试连接` | |
| `settings.messaging.telegram.tokenPlaceholder` | `Paste your bot token from @BotFather` | `粘贴从 @BotFather 获取的 Bot Token` | |
| `settings.messaging.title` | `Messaging` | `消息绑定` | |
| `settings.messaging.whatsapp.desktopApprovalsOnly` | `Approvals happen in the desktop app` | `授权操作仅在桌面应用中进行` | |
| `settings.messaging.whatsapp.disable` | `Disable` | `停用` | |
| `settings.messaging.whatsapp.forget` | `Disconnect` | `断开连接` | |
| `settings.messaging.whatsapp.reconnect` | `Reconnect` | `重新连接` | |
| `settings.workspace.title` | `Workspace` | `工作空间` | 与 10 §5.2 术语表一致 |
| `skillInfo.sourceWorkspace` | `Workspace` | `工作空间` | 同上 |

> **执行注意**：所有 7 个 locale 必须同步加 keys。en/zh-Hans 用上表新值；de/es/ja/hu/pl 沿用 en 英文不动（保持 parity）。

---

## 3. M2 已知瑕疵补丁

### 3.1 `onboarding.reauth.loginWithCraft` value 误译

| Locale | 当前 value | 问题 |
|---|---|---|
| en | `Log In with U Agents` | ⚠️ 这是已裁掉的功能（OAuth Login with Craft），key 应不显示 |
| zh-Hans | `使用 U Agents 登录` | 同上 |

**处理决策**：value 保留现状（key 不再被渲染，但保留以防上游回引）；M2 不改 key 名（见 §4）。

### 3.2 onboarding 已裁剪 keys（仍存在但不渲染）

详见 `04-feature-cuts.md` §1.1。这些 keys 由于 ProviderSelectStep / APISetupStep 多 provider 选项被裁，**不再被用户看到**：

```
onboarding.apiSetup.apiKeyDesc
onboarding.apiSetup.chatGPTPlusDesc
onboarding.apiSetup.craftAgentsBackend
onboarding.apiSetup.githubCopilotDesc
onboarding.apiSetup.piDesc
onboarding.providerSelect.codexChatGPTDesc
onboarding.providerSelect.githubCopilotDesc
onboarding.providerSelect.title
onboarding.providerSelect.claudeProMax
onboarding.providerSelect.codexChatGPT
onboarding.providerSelect.githubCopilot
onboarding.credentials.connectChatGPTDesc
onboarding.credentials.connectGitHubDesc
onboarding.reauth.loginWithCraft
workspace.connectRemoteDesc
```

**M2 处理**：保留 keys（parity），翻译时**做最低限度处理**——en + zh-Hans 各自合理即可，无需精修。如果未来上游加新代码路径让这些 key 重新被渲染，至少不会暴露 Craft 字面量。

---

## 4. Key 名含 `craft` 的 3 处（M2 评估保留 vs 重命名）

```
menu.craftMenu                      → menu.appMenu  ?
onboarding.apiSetup.craftAgentsBackend → onboarding.apiSetup.uapiBackend ?
onboarding.reauth.loginWithCraft    → onboarding.reauth.loginLegacy ?
```

**变更影响面**：
- 改 key 名 → 所有 `i18n.t('menu.craftMenu')` 调用方必须同步改
- 不改 → 仅是技术债（用户看不见），但每次 grep "craft" 有干扰

**M2 决策**：
- ✅ **保留 key 名**（不改）。理由：
  1. 改 key 名 = 改 source code（违背"M2 主线是中文化值，不是改逻辑"）
  2. 上游同步时如果上游也用同名 key，改了反而引入冲突
  3. 不影响用户可见
- ⚠️ M3+ 重新评估：如果届时上游已彻底移除这些 key，再做 codemod 一并改

---

## 5. 翻译长度审视（10 §5.4 的 M2 落实）

按 10 §5.4 长度建议表，扫描以下场景的当前 zh-Hans 值是否超出：

### 5.1 权限模式 badge（≤ 5 字）

| Key | 当前 zh-Hans | 字数 | 状态 |
|---|---|---|---|
| `permissionMode.explore` | `探索` | 2 | ✅ |
| `permissionMode.askToEdit` 或类似 | (待定位) | - | 需要 M2 实测 UI 判断 |
| `permissionMode.auto` | `自动` | 2 | ✅ |

### 5.2 设置页 tab label（≤ 6 字）

设置页 sidebar tabs 全量审视已在 M1 做过。M2 重审：

| Key | 当前 zh-Hans | 字数 | 状态 |
|---|---|---|---|
| `settings.ai.title` | `AI` | 2 | ✅ |
| `settings.appearance.title` | (查) | - | M2 实测 |
| `settings.workspace.title` | `Workspace` → `工作空间` | 4 | ✅（如执行 §2.2）|
| `settings.messaging.title` | `Messaging` → `消息绑定` | 4 | ✅（如执行 §2.2）|

> 完整 tab 列表 M2 实测时由执行 AI 用 grep 定位 `settings.*.title` 后比对。

### 5.3 按钮 / 菜单项

M2 实测策略：种子用户反馈中"哪个按钮看着别扭/挤"集中审视，**不预先穷举**——避免做无用功。

---

## 6. 执行步骤（给执行 AI / 用户）

> 本节是可直接复制给外部执行 AI 的提示词。

### 6.1 任务范围

仅修改 `packages/shared/src/i18n/locales/*.json`（7 个文件）。**不改源码、不改 i18n key 名**。

### 6.2 三步执行

**Step 1 — 翻译 §2.2 的 17 个 key**

打开 `packages/shared/src/i18n/locales/zh-Hans.json`，按本文 §2.2 表批量更新 value。

注意：
- `settings.messaging.telegram.instructions` 含 `\n`，必须保留为字面 `\n`（不要换成真实换行）
- `settings.messaging.bindings.unbind` / `whatsapp.disable` / `whatsapp.forget` 三处 disconnect-类按钮，按上下文分别译为 `解绑` / `停用` / `断开连接`

**Step 2 — 同步其他 6 个 locale 的 parity**

`en.json` 不需要任何改动（§2.2 表的 en 值是当前值）。`de/es/ja/hu/pl.json` 也不需要改动（保持 parity，仍用英文值）。

> ⚠️ 这一步 M2 阶段**只动 zh-Hans**，其他 locale 不动。理由：M1 已确保 7 locale parity，M2 只补 zh-Hans 翻译完成度。

**Step 3 — 验证**

```bash
# 1. 7 locale parity（应全过）
bun run lint:i18n:parity

# 2. zh-Hans 仍未翻译键（应只剩 §2.1 的 31 个白名单）
bun -e '
const en = await Bun.file("packages/shared/src/i18n/locales/en.json").json();
const zh = await Bun.file("packages/shared/src/i18n/locales/zh-Hans.json").json();
let n = 0;
for (const k of Object.keys(en)) {
  const zv = zh[k];
  if (typeof zv === "string" && !/[一-鿿]/.test(zv) && zv.length > 0) n++;
}
console.log("untranslated zh-Hans values:", n);
'
# 期望：34（§2.1 白名单数量），不再是 51

# 3. 品牌污染（应 0 命中）
grep -nE '"[^"]*Craft[^"]*"' packages/shared/src/i18n/locales/zh-Hans.json
grep -nE '"[^"]*Craft[^"]*"' packages/shared/src/i18n/locales/en.json
# 期望：均无输出（key 名 craft 是 §4 已知保留，不算污染）
```

### 6.3 提交规范

- 一个 commit 完成 §2.2 全部 17 处翻译
- commit message 建议：`i18n(zh-Hans): translate 20 remaining settings/messaging keys (M2)`
- 不要在 commit 里改其他 locale 文件

---

## 7. M2 后续工作（本次扫描之外）

完成 §6 翻译后，M2 还剩：

| 项 | 优先级 | 关联文档 |
|---|---|---|
| Windows 打包 | ✅ 已完成 | 2026-05-04 出 `U-Agents-x64.exe` (169 MB)，已上线 R2，详见 `sync-reports/M2-WINDOWS-BUILD.md` |
| Linux 打包 | P2 | `05-build-release.md` Linux 章节 |
| 性能基准（M1 后补）| P1 | 待创建 `.planning/perf-baseline-M1.md` |
| 网站下载页（M1 后补）| P2 | 与 §6 安装说明文案对齐 |
| 7 处上游既有测试 fail 跟进 | P3 | 等上游修或单独评估 |
| 种子用户反馈分类入档 | 滚动 | `M1-SEED-DISTRIBUTION.md` §4 |

---

## 8. 校验清单（M2 中文化阶段完成判定）

- [x] §6 Step 1 已执行（zh-Hans.json 17 处翻译落地，commit `75bcda8`，2026-05-04）
- [x] §6 Step 3 校验通过：parity OK + 未翻译值 51 → 34 + 品牌污染 0 命中
- [ ] 启动应用，进入"设置 → 消息绑定"页面，所有可见文案已中文化
- [ ] Telegram 配置流程目测中文通顺（含 instructions 多行换行）
- [ ] WhatsApp 区块按钮（停用/断开连接/重新连接）目测合适

完成判定后，把本节勾选状态写入 `.planning/sync-reports/M2-I18N-CLOSURE.md`。
