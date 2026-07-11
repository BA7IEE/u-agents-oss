# 14 — `// U-API:` 代码改造点登记表与同步基线

> 本文件从 `CLAUDE.md` §3.7 抽出（2026-05-29）。
> **每月上游同步时必读、必跑本文件的 grep 验证。** 非同步任务无需加载本文件。
> 标记规范的"约束力"在 `CLAUDE.md` §3.7（精简版）；本文件是**完整登记表 + 历史 + 校验命令**。

---

## 0. 当前基线（速查）

| 指标 | 基线（2026-07-11 v0.11.1 同步复核）| 下次同步允许浮动 |
|---|---|---|
| U-API 标记总数（含全部注释格式）| **134** | ±2 |
| `/* U-API START */` 块数 | **10** | 必须等于 END |
| `/* U-API END */` 块数 | **10** | 必须等于 START |

**每次同步必跑 grep（覆盖全部注释格式）**：

```bash
# 全部 U-API 标记（含 // 单行 / /* 块 / <!-- HTML / {/* JSX 行内）
# SOP-REHEARSAL 2026-05-05 改进：用 --exclude-dir 替代 grep -v 过滤，
# 同时排除 apps/electron/release/ 下的历史打包副本；否则会重复统计已打包源码副本
grep -rEn --exclude-dir=node_modules --exclude-dir=release "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：134（基线，允许 132-136）

# 块标记 START/END 配对（数量必须相等）
grep -rE --exclude-dir=node_modules --exclude-dir=release "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules --exclude-dir=release "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望：均 = 10
```

**基线刷新规则**（每次同步成功后照做）：
1. 更新 §0「当前基线」表的数字 + 日期——**这是基线数字的唯一权威位置**，CLAUDE.md / 07 / skill 等其它文档都引用这里，不要在别处另填硬数字。
2. 在 §5「历次基线演进」追加一行：日期 + 新计数 + 一句变更说明。
3. 若本次有新改造点，在 §3 对应子表加行（并按 C5 同步加单测）。

> 此规则同时满足 `LEGAL.md` §2 Apache §4(b) "modification notices" 合规要求——标记本身就是修改声明的一种形式。

---

## 1. 为什么需要标记

M1 我们改造了几十处代码（详见 `01-branding-spec.md` §2 + `03-ui-lockdown-spec.md` §1.10）。同步上游时这些改造点容易被 git 自动合并"无声破坏"——加统一标记后可以 grep 快速扫描所有改造点。

## 2. 标记规范

- 单行改造：`// U-API: <改造原因/简述>`
- 多行块：用 `/* U-API START */` 和 `/* U-API END */` 包围
- 必须含"U-API"字样（grep 用，且与上游历史 craft 标记隔离）

**示例**：

```typescript
// state.ts:296-299（详见 02 §4.1）
if (!apiKey && connection.baseUrl) {
  // U-API: 上游 keyless 路径仅给 Ollama 用；U-API 必须有 Token，加特判
  const isUApi = defaultConnectionSlug === 'u-api-default';
  hasCredentials = !isUApi;
}
```

```typescript
/* U-API START: 03 §1.10.1 BUILT_IN_CONNECTION_TEMPLATES 新增 entry */
'u-api-default': {
  name: 'U-API',
  providerType: 'pi_compat',
  authType: 'api_key_with_endpoint',
},
/* U-API END */
```

---

## 3. 改造点登记表

**M1 必加 `// U-API:` 标记的改造点**（与 `01 §2.0 子节分级总览表`对应）：

> **定位策略说明（REVIEW-2 P1 改进，2026-05-04）**：
> 本表用**函数/变量名**而非硬行号定位——上游同步时行号会漂，符号名稳定。每行用 `grep -n "<符号>" <文件>` 即可定位。
> 标记类型：`单行` = `// U-API: ...`；`块` = `/* U-API START ... */ ... /* U-API END */`。

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 1 | baseUrl 锁定 + 多连接重写 | `packages/shared/src/config/storage.ts` | 函数 `enforceUApiBaseUrl` 整体 | 块 | 02 §4.3 + §6.2.1 |
| 2 | model 列表保护 loop | `packages/shared/src/config/storage.ts` | 注释 `token-scoped model catalogs must not be overwritten` | 单行 | 02 §6.2.2 |
| 3 | startup lock | `packages/shared/src/config/storage.ts` | 注释 `continuous startup lock, not a one-shot migration` | 单行 | 02 §4.3 |
| 4 | 凭证 keyless 特判 | `packages/shared/src/auth/state.ts` | 函数 `hasCredentials` 内 `if (!apiKey && connection.baseUrl)` 块 | 单行 | 02 §4.1 |
| 5 | BUILT_IN_CONNECTION_TEMPLATES `'u-api'` 模板 | `packages/server-core/src/domain/connection-setup-logic.ts` | 注释 `multi-connection soft lockdown — base 'u-api' template` | 块 | 03 §1.10.1 |
| 6 | validateSetupTestInput 扩展 | `packages/server-core/src/domain/connection-setup-logic.ts` | 注释 `validateSetupTestInput 扩展，支持 pi_compat` | 块 | 02 §4.2 |
| 7 | u_api ApiSetupMethod 类型 | `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx` | 注释 `u_api ApiSetupMethod 定义（M1 多 provider 裁剪后保留）` | 块 | 03 §1.10 |
| 8 | API_SETUP_ICONS u_api 项 | 同上 | 常量 `API_SETUP_ICONS` 内（在 #7 块内）| 块内 | 03 §1.10 |
| 9 | BASE_SLUG_FOR_METHOD u_api 项 | `apps/electron/src/renderer/hooks/useOnboarding.ts` | 注释 `multi-connection soft lockdown — base 'u-api'` | 单行 | 02 §6.2.2 |
| 10 | apiSetupMethodToConnectionSetup case 'u_api' | 同上 | 函数 `apiSetupMethodToConnectionSetup` 内注释 `let resolveSlugForMethod` | 块 | 02 §6.2.2 |
| 11 | useOnboarding U_API_SLUG 已迁移 | 同上 | 注释 `U_API_SLUG no longer needed here` | 单行 | 02 §6.2.2 |
| 12 | ApiKeyInput U_API_TOPUP_URL 移除 | `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 注释 `U_API_TOPUP_URL no longer imported` | 单行 | 02 §6.2 |
| 13 | ApiKeyInput lockNotice + 三链接移除 | 同上 | 注释 `removed lockNotice banner` + `removed Topup link per UI cleanup` | JSX 行内 `{/* U-API: */}` （2 处）| 02 §6.2 |
| 14 | CredentialsStep isUApi 路由 | `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx` | 注释 `路由 U-API 凭证流程，绕过通用 OAuth 路径` + 2 处 `U-API 模式分支` | 单行（3 处）| 03 §1.10 |
| 15 | paths.ts CONFIG_DIR 双 env 兼容 | `packages/shared/src/config/paths.ts` | 注释 `allow the new env var while preserving the legacy override` | 单行 | 01 §2.15 + §2.20 |
| 16 | interceptor-common.ts 路径迁移 | `packages/shared/src/interceptor-common.ts` | 注释 `path migration from CRAFT_CONFIG_DIR to U_AGENTS_CONFIG_DIR` | 单行 | 01 §2.15 |
| 17 | isUApiSlug helper（多连接判定）| `packages/shared/src/config/u-api-defaults.ts` | 函数 `isUApiSlug` 上方 | 单行 | 02 §6.2.2 |
| 18 | provider-metadata pi_compat 分支 | `packages/shared/src/config/provider-metadata.ts` | 注释 `multi-connection soft lockdown — match all U-API slugs` + import 注释 | 单行（2 处）| 02 §6.2.2 |
| 19 | AiSettings isUApiSlug import | `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | 注释 `isUApiSlug recognizes 'u-api-default'` | 单行 | 02 §6.2.2 |
| 20 | ConnectionRow isUApiConnection 判定 | 同上 | 注释 `ConnectionRow isUApiConnection 判定` + 4 行解释 | 单行（5 处连排）| 02 §6.2 |
| 21 | getApiKeyMethodForConnection | 同上 | 注释 `every U-API slug routes to the U-API setup wizard` | 单行 | 02 §6.2.2 |
| 22 | uApiConnections filter | 同上 | 注释 `show every U-API slug, not just primary` | 单行 | 02 §6.2.2 |
| 23 | Default Connection selector 恢复 | 同上 | 注释 `always show Default Connection`（多行注释起始行）| 块 | 02 §6.2 |
| 24 | last-connection 删除保护 | 同上 | 注释 `last U-API connection cannot be deleted` | 单行 | 02 §6.2 Q2 |
| 25 | Add Connection button 恢复 | 同上 | 注释 `restore Add Connection button removed by 540509b` | 块 | 02 §6.2 |
| 26a | onboarding 防护性禁用 — LocalModelStep | `apps/electron/src/renderer/components/onboarding/LocalModelStep.tsx` | 注释 `intentionally not reached by the M1 onboarding state machine` | 单行 | 03 §1.10（裁剪后防护）|
| 26b | onboarding 防护性禁用 — ProviderSelectStep | `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | 同上注释 | 单行 | 同上 |
| 27 | first-install onboarding 路由到 placeholder slug | `apps/electron/src/renderer/App.tsx` | 注释 `first-install onboarding edits the placeholder` + `first-install onboarding always targets the placeholder` | 单行（2 处）| 02 §6.2.3 |
| 28 | About panel Apache §4(c) attribution | `apps/electron/src/main/index.ts` | 注释 `Apache §4(c) attribution — About panel shows U Studio copyright only` | 块 | LEGAL.md §2 + commit 323293b |
| 29 | EditPopover example brand cleanup | `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 注释 `brand cleanup — mirrors editPopover.example.addSource i18n value` | 单行 | 01 §2.29 |
| 30 | OAuth callback HTML 品牌化 | `packages/shared/src/auth/callback-page.ts` | HTML 注释 `<!-- U-API: brand title for OAuth callback page` | HTML 注释 | 01 §2.16 |

**M2 期间新增改造点（2026-05-05 收尾后补入）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 31a | TLS 严格化 — handlers/workspace | `apps/electron/src/main/handlers/workspace.ts` | 注释 `TLS strict mode (REVIEW-5 P0 fix` | 单行 | `M2-TLS-FIX-SPEC.md` + LEGAL §5.4 |
| 31b | TLS 严格化 — preload/bootstrap | `apps/electron/src/preload/bootstrap.ts` | 同上注释（2 处）| 单行 | 同上 |
| 32a | atomicWriteFileSync — storage | `packages/shared/src/config/storage.ts` | 注释 `atomic writes for user-data persistence` | 单行 | `M2-ATOMIC-WRITES-SPEC.md` |
| 32b | atomicWriteFileSync — preferences | `packages/shared/src/config/preferences.ts` | 同上注释 | 单行 | 同上 |
| 32c | atomicWriteFileSync — topic-registry | `packages/messaging-gateway/src/topic-registry.ts` | 同上注释 | 单行 | 同上 |
| 32d | atomicWriteFileSync — window-state | `apps/electron/src/main/window-state.ts` | 同上注释 | 单行 | 同上 |
| 33a | dir 0o700 — watcher | `packages/shared/src/config/watcher.ts` | 注释 `dir mode 0o700 for multi-user machine privacy` | 单行 | `M2-SECURITY-CLEANUP-SPEC.md` |
| 33b | dir 0o700 — storage（与 32a 同文件）| `packages/shared/src/config/storage.ts` | 同上注释 | 单行 | 同上 |
| 33c | dir 0o700 — window-state（与 32d 同文件）| `apps/electron/src/main/window-state.ts` | 同上注释 | 单行 | 同上 |
| 34 | LLM API key 长度限制 | `packages/shared/src/credentials/manager.ts` | 注释 `LLM API key length bounds` + 常量 `MIN_LLM_API_KEY_LENGTH` / `MAX_LLM_API_KEY_LENGTH` | 单行 | `M2-SECURITY-CLEANUP-SPEC.md` |
| 35 | apps/cli rename | `apps/cli/src/index.ts` | 注释 `tmpDir prefix renamed (M2 cli rename)` + `skill description rebrand` | 单行（2 处）| `M2-CLI-RENAME-SPEC.md` |
| 36 | REVIEW-4 P0 多连接 keyless 回归测试 | `packages/shared/src/auth/__tests__/state.test.ts` | describe block `hasCredentials keyless special case (multi-connection)` | 单行 | REVIEW-4 + REVIEW-5 §1 P1 |

**v0.9.1 sync 期间新增改造点（2026-05-06 commit `bd2a005d` sync merge 时落地）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| ~~37~~ | ~~v0.9.1 routing.ts 漏分类 9 channel 修复~~ | ~~`packages/shared/src/protocol/routing.ts`~~ | **已过期（v0.9.3 sync 删除）**：上游 v0.9.3 自己补了 9 channel 进 `REMOTE_ELIGIBLE_CHANNELS`（与我们 patch 等价），SYNC-v0.9.3 merge 时全盘接受 theirs + 删 marker | —— | SYNC-v0.9.3-20260512 自动过期 |
| 38 | 上游 v0.9.1 ESLint 违规 disable（color-mix annotation） | `packages/ui/src/components/annotations/block-markers.ts` | 注释 `dynamic color-mix annotation; cannot be expressed as a static utility class` | 单行 | SYNC-v0.9.1-20260506 §6.2（C12 上游 lint 违规） |
| 39 | 上游 v0.9.1 ESLint 违规 disable（test 直读 isAuthenticated） | `packages/shared/src/resources/__tests__/resource-bundle.test.ts` | 注释 `test asserts the field directly to verify reset semantics, not gating logic` | 单行 | SYNC-v0.9.1-20260506 §6.2（C12 上游 lint 违规） |

**v17 review 后修复（v0.9.1 sync 后实测发现的 3 项漏盘改造点）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 40 | messaging access-control rejection 文案品牌（v0.9.1 引入）| `packages/messaging-gateway/src/access-control.ts` | 注释 `brand replacement — v0.9.1 上游引入 messaging access-control` | 单行 | REVIEW-17 F2（v0.9.1 sync 漏品牌替换）|
| 41 | messaging pairing-code rejection 文案品牌（v0.9.1 引入）| `packages/messaging-gateway/src/commands.ts` | 注释 `brand — v0.9.1 上游引入 pairing code rejection 文案` | 单行 | 同上 |
| 42 | apps/cli printHelp craft-cli → u-agents-cli（M2 cli rename 漏盘补丁）| `apps/cli/src/index.ts` | 注释 `M2 cli rename — bin name 改为 u-agents-cli (commit 1a49d128), 此 printHelp 文案漏改` | 单行 | REVIEW-17 F3（M2-CLI-RENAME 验收清单未含 printHelp）|

**M3 SSRF 防护落地（v21 后 P1，详见 [`M3-REFRESH-API-SSRF-SPEC.md`](M3-REFRESH-API-SSRF-SPEC.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 43 | `assertPublicHttpsUrl` helper（IPv4/IPv6 私网 + 云元数据域名）| `packages/shared/src/utils/url-safety.ts` | 块 `M3 SSRF 防护 — assertPublicHttpsUrl helper` | 块 | M3-REFRESH-API-SSRF-SPEC §2.1 |
| 44a | `refreshApiRenew` 接入 SSRF guard | `packages/shared/src/sources/credential-manager.ts` | 函数 `refreshApiRenew` 内 `M3 SSRF 防护 — 阻止 credential-bearing fetch` | 单行 | M3-REFRESH-API-SSRF-SPEC §2.2 |
| 44b | `refreshApiRenew` SSRF 回归测试（5 个）| `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | 注释 `M3 SSRF 防护 — 拒绝 credential-bearing fetch 到云元数据/私网` | 单行 | C5 自洽（新改造点必加单测） |
| 44c | `refreshApiRenew` redirect bypass 防护（v24 F1.F3 P0）| `packages/shared/src/sources/credential-manager.ts` | 注释 `M3 SSRF 防护 — redirect bypass 修补` + `主动拒绝 30x redirect` | 单行（2 处）| REVIEW-24 §1.1 |
| 44d | `refreshApiRenew` redirect bypass 单测（2 个）| `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts` | 注释 `M3 SSRF redirect bypass 防护（v24 F1.F3 P0 真修）` | 单行 | C5 自洽 |
| 45a | `createApiTool` 接入 SSRF guard + redirect:'manual'（v23 §5.2 follow-up + v24 F1.F3 真修）| `packages/shared/src/sources/api-tools.ts` | 注释 `M3 SSRF 防护 — ...`（4 处：import + redirect:'manual' 配置 + safety check + 30x reject）| 单行（4 处）| REVIEW-23 §2.2 + REVIEW-24 §1.1 |
| 45b | `createApiTool` SSRF 运行时测试（10 个，v24 F1.F5 重写从 grep-only → runtime mock fetch）| `packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts` | describe `api-tools SSRF guard` | 单行 | C5 自洽 + REVIEW-24 §1.2 |
| 45c | `pi-agent-server` 系统 prompt 注释 brand（v0.9.2 sync 漏盘补丁）| `packages/pi-agent-server/src/index.ts:~1285` | 注释 `brand — v0.9.2 sync 漏盘 "Craft-built" → "U Agents-built"` | 单行 | REVIEW-24 §1.3 / G1.F2.1 |
| 45d | spawn-helpers regex U Agents.app 显式回归测试（v24 G1.F3.2）| `packages/shared/src/agent/__tests__/claude-agent-spawn-cwd.test.ts` | 注释 `brand — v24 G1.F3.2 P2 真修：补 U Agents.app 显式回归` | 单行 | REVIEW-24 §3.2 |
| 46 | `browserToolEnabled` 默认改 `false`（v24 G1.F4.1 决策）| `packages/shared/src/config/storage.ts` 内 `defaults.browserToolEnabled: false` | 注释 `browser tool 默认关闭` | 单行 | REVIEW-24 §1（Bucket C）+ 04-feature-cuts §九类 |
| 46t | `browserToolEnabled` 默认 false 防回归测试 | `packages/shared/src/__tests__/m2-security-regression.test.ts` | describe `browserToolEnabled 默认 false` | 单行 | C5 自洽 |

**v27 Bucket B SSRF 横向扩展 + 漏盘补丁（2026-05-08，详见 [`M3-SSRF-CONSOLIDATION-SPEC.md`](M3-SSRF-CONSOLIDATION-SPEC.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 47a | `web_fetch` redirect:'manual' + 30x reject（v27 P0-1 真修，redirect bypass 漏洞）| `packages/pi-agent-server/src/tools/web-fetch.ts:~366,377` | 注释 `M3 SSRF 防护 — redirect bypass 修补` + `主动拒绝 30x redirect` | 单行（2 处）| M3-SSRF-CONSOLIDATION-SPEC §2.1 + REVIEW-27 P0-1 |
| 47b | `web_fetch` SSRF 运行时测试（7 个，含 marker 防回归 1 处）| `packages/pi-agent-server/src/tools/web-fetch-ssrf.test.ts` | describe `web-fetch SSRF guard` | 单行 | C5 自洽 |
| 48a-d | `source-test.ts` 4 处 fetch SSRF guard（auth path + basic path × 3）| `packages/session-tools-core/src/handlers/source-test.ts` | 注释 `M3 SSRF 防护` × 7（import + safety check + auth redirect:'manual' + 30x reject + basic 3× redirect:'manual' + 30x reject）| 单行（8 处）| M3-SSRF-CONSOLIDATION-SPEC §2.2 + REVIEW-27 P1 |
| 49 | `auto-update.ts` 注释 URL 与 publish.url 一致（v27 P0-5 漏盘补丁）| `apps/electron/src/main/auto-update.ts:7` | 注释 `comment URL must match electron-builder.yml publish.url exactly` | 单行 | REVIEW-27 P0-5 |

**v0.9.3 sync 期间新增改造点（2026-05-12，详见 [`sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md`](sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 50 | 上游 v0.9.3 ESLint 违规 disable（FabNewChat base shadow）| `apps/electron/src/renderer/components/app-shell/FabNewChat.tsx` | 注释 `继承上游 v0.9.3 FAB 视觉设计；改 shadow class 会破坏设计` | 单行（含 `eslint-disable-next-line craft-styles/no-nonstandard-shadows`）| SYNC-v0.9.3-20260512（C12 上游 lint 违规）|
| 51 | 上游 v0.9.3 ESLint 违规 disable（FabNewChat hover shadow）| 同上 | 注释 `同上 — 继承上游 hover 视觉效果，豁免 lint` | 单行（含 `eslint-disable-next-line craft-styles/no-nonstandard-shadows`）| 同 #50 |

**v0.9.4 sync 期间新增改造点（2026-05-20，详见 [`sync-reports/SYNC-v0.9.4-20260520.md`](sync-reports/SYNC-v0.9.4-20260520.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 52 | C13 patch — RPC handler HANDLED_CHANNELS 加 RTK 4 channel（上游 v0.9.4 漏分类）| `packages/server-core/src/handlers/rpc/settings.ts` | 注释 `classify v0.9.4 RTK channels missed by upstream's HANDLED_CHANNELS` | 单行 | SYNC-v0.9.4-20260520 §1.3（C13 pattern；与 v0.9.1 上游 routing.ts 漏分类同模式，曾有 `#37` marker 但 v0.9.3 sync 时上游自修后被删——本次 #52 是同模式新触发）|

**M3 i18n 主进程启动同步（2026-05-21，详见 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md`](M3-I18N-MAIN-PROCESS-SYNC-FIX.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 53 | ~~renderer 启动时把 detector 解析到的语言推给主进程~~ **v0.10.3 sync 演化**：原临时修复退役（上游 v0.10.1 uiLanguage 机制取代，同位置同机制超集）；现仅保留 `.catch` 兜底替代上游 `void`（防 unhandledrejection 噪音）| `apps/electron/src/renderer/main.tsx` | 注释 `.catch 兜底替代上游 void` | 单行 | M3-I18N-MAIN-PROCESS-SYNC-FIX（已标注退役）+ SYNC-v0.10.3 §6 |

**v0.9.5 sync 期间新增改造点（2026-05-21，详见 [`sync-reports/UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md`](sync-reports/UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 54 | v0.9.5 model-picker brand patch（上游把 FreeFormInput 内联 grouping 抽到 helper，`'Craft Agents Backend'` → `'U-API'`；同时改 4 处单测断言）| `apps/electron/src/renderer/components/app-shell/input/model-picker-helpers.ts` | 注释 `brand — v0.9.5 上游把 FreeFormInput.tsx 内联 grouping 抽到 helper` | 单行 | UPSTREAM-PREVIEW-v0.9.5-2026-05-21 §3（commit `f863f915`）|

**v0.10.0 sync 期间新增改造点（2026-05-29，详见 [`sync-reports/SYNC-v0.10.0-20260529.md`](sync-reports/SYNC-v0.10.0-20260529.md) + [`M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md`](M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 55 | brand — v0.10.0 remote browser 错误文案 Craft Agent → U Agents | `packages/shared/src/agent/pi-agent.ts` | 注释 `brand — v0.10.0 remote browser 错误文案`（`mapBrowserToolErrorCode` 内）| 单行 | M3-REMOTE-BROWSER-LOCKDOWN-SPEC §3.3 |
| 56 | brand — 同上（远程侧）| `packages/server-core/src/sessions/RemoteBrowserPaneManager.ts` | 注释 `brand — v0.10.0 remote browser 错误文案`（`invoke()` 内）| 单行 | 同上 |
| 57 | D1 — `allowRemoteEvaluate` 默认 false | `packages/shared/src/config/storage.ts` | 注释 `远程 evaluate 默认关闭（M3 remote browser lockdown`（`FALLBACK_CONFIG_DEFAULTS`）+ `config-defaults.json` 改值 | 单行 | M3-REMOTE-BROWSER-LOCKDOWN-SPEC §2 |
| 57t | D1 防回归测试 | `packages/shared/src/__tests__/m2-security-regression.test.ts` | describe `allowRemoteEvaluate 默认 false（M3 remote browser lockdown D1）` | 单行 | 同上 §2.3 |
| 58 | D5-b — dispatcher `browserToolEnabled` 总闸（**2 处 marker**：dispatcher + import）| `apps/electron/src/main/browser-pane-manager.ts` | 注释 `remote browser pane 总闸`（`dispatchCapability`）+ `getBrowserToolEnabled 为 D5-b`（import）| 单行（2 处）| 同上 §3 |
| 58t | D5-b 防回归测试 | `packages/shared/src/__tests__/m2-security-regression.test.ts` | describe `remote browser dispatcher browserToolEnabled 总闸（M3 lockdown D5-b）` | 单行 | 同上 §3.4 |

**v0.10.0 sync 收尾 — F1 baseline lint 技术债清理（2026-05-29，详见 [`sync-reports/SYNC-v0.10.0-20260529.md`](sync-reports/SYNC-v0.10.0-20260529.md) §6 F1）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 59 | F1 — token-refresh-manager `craft-shared/no-inline-source-auth-check` 误报豁免（规则不区分读/写：2 处赋值写 in-memory mirror + 2 处测试字段断言，均非 gating 读；同 #38/#39 模式）| `packages/shared/src/sources/token-refresh-manager.ts`（×2）+ `packages/shared/src/sources/__tests__/token-refresh-manager.test.ts`（×2）| 注释 `非 gating 读` / `验证 reset 语义` + `eslint-disable-next-line craft-shared/no-inline-source-auth-check` | 单行（×4）| C12 + lint:shared baseline（**merge 前 `87ffbeb7` 即 4 errors，非 v0.10.0 引入**）|
| 60a | D2 — 启动序列顺序约定（enforce 先于上游 Phase 1k normalize；第一道防线）| `packages/shared/src/config/storage.ts`（启动迁移序列）| 注释 `enforceUApiBaseUrl 必须先于 Phase 1k`（×2 行命中）| 单行（注释 2 行）| 02 §6.2.2 + SYNC-v0.10.3 §D2 |
| 60b | D2 — 新建连接路径同顺序约定 | `packages/shared/src/config/storage.ts`（`createConnectionsFromLegacy` 尾部）| 注释 `enforce 先于 normalize` | 单行 | 同上 |
| 60c | D2 — `migrateLegacyOpusToDefaultOpus` 连接级 `isUApiSlug` 豁免（第二道防线）| `packages/shared/src/config/storage.ts` | 注释 `U-API 连接的模型清单是 newapi 动态路由名` + `if (isUApiSlug(connection.slug)) continue;` | 单行 | 同上 |
| 60d | D2 — `migrateWorkspaceLegacyOpusToDefaultOpus` 整体 no-op（fork 全连接皆 U-API，workspace 默认模型为 U-API 路由名；上游原实现还会把 4-7 强升 4-8）| `packages/shared/src/config/storage.ts` | `/* U-API START: D2 ... */`（**新增 START/END 第 10 对**）| 块 | 同上 |
| 60t | D2 防回归测试（U-API 连接 `claude-opus-4-6`/`deepseek-v4-pro` 清单经 runMigration 后逐字节不变）| `packages/shared/src/config/__tests__/storage-startup-migration.test.ts` | it `exempts U-API connections from upstream deprecated-model normalization` + 注释 `the U-API exemption must keep` | 单行 | 同上 |
| 61 | D4 — 按协议预设候选清单（OpenAI 侧 `gpt-5.5, deepseek-v4-pro, MiniMax-M3`；Anthropic 侧决策性回退自动合并引入的 `claude-opus-4-8`，不展示 4-8/Fable）| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 注释 `D4 (2026-06-10, 02 §3.3)` | 单行 | 02 §3.3 |
| 62 | D1 — mac 打包仅 arm64（跟随上游 v0.10.1 Intel 停产）。**yml `#` 注释，不计入 .ts/.tsx grep 基线** | `apps/electron/electron-builder.yml` | 注释 `# U-API: D1 (2026-06-10)` | 单行（yml）| 05 §3 |

**v0.10.4 sync 期间新增改造点（2026-06-27，详见 [`sync-reports/UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 63 | 数据目录品牌统一 — 上游 v0.10.4 新增 `autoUpdateLogPath`（always-on auto-update 诊断日志）从 `.craft-agent` 改 `.u-agents` | `apps/electron/src/main/logger.ts` | 注释 `数据目录品牌统一为 ~/.u-agents/（与 messagingGatewayLogPath 一致，避免双目录）` | 单行 | UPSTREAM-PREVIEW-v0.10.4 §4 |
| 64 | 数据目录品牌统一 — `messagingGatewayLogPath` 补登记（既有 `.u-agents` 路径早已改但漏 marker，本次回补）| `apps/electron/src/main/logger.ts` | 注释 `数据目录品牌统一为 ~/.u-agents/（不在 Electron logs 目录内，故单独写死）` | 单行 | UPSTREAM-PREVIEW-v0.10.4 §5 |
| 65 | merge 整合 — `writeRootConfig` 测试 helper 兼容上游 v0.10.4 新增迁移测试的数组传参（我方既有 helper 取 config 对象 spread，上游新测试按数组传 llmConnections；helper 加 `Array.isArray` 归一化两种调用）| `packages/shared/src/config/__tests__/storage-startup-migration.test.ts` | 注释 `兼容两种调用约定——上游 v0.10.4 新增迁移测试按数组传 llmConnections` | 单行 | 本次 sync 整合（typecheck 修复）|

**M2 依赖安全收口（2026-07-10，详见 [`M2-DEPENDENCY-SECURITY-AUDIT-2026-07-10.md`](M2-DEPENDENCY-SECURITY-AUDIT-2026-07-10.md)）**：

| # | 改造类别 | 文件 | 定位（用 `grep` 找）| 标记 | 关联规格 |
|---|---|---|---|---|---|
| 66 | Office 附件转换移除高危 `markitdown-js`，改为 `convertDocumentToMarkdown` 调用受控 Python/uv 工具链 | `packages/server-core/src/handlers/rpc/files.ts` | `convertDocumentToMarkdown(storedPath, mdPath, deps.platform)` | 单行 | M2 dependency audit §3.1；路径解析单测见 `packages/server-core/src/services/markitdown.test.ts` |
| 67 | v0.11.0 后台代理跨 turn 常驻改为默认 OFF；优先读取 `U_AGENTS_KEEP_BG_AGENTS_ALIVE`，兼容旧 `CRAFT_*` 变量 | `packages/shared/src/agent/backend/claude/persistent-input.ts` | `metered-token safety — default OFF` | 单行 | SYNC-v0.11.0 D2 |
| 67t | #67 防回归测试：默认关闭、U Agents 主变量开启/关闭、旧变量兼容、主变量优先级 | `packages/shared/src/agent/backend/claude/persistent-input.test.ts` | `background agents must be explicit opt-in` | 单行 | SYNC-v0.11.0 D2 |
| 68 | v0.11.0 上游 `send-agent-message` 测试适配本 fork 的 `noUncheckedIndexedAccess` 严格基线 | `packages/session-tools-core/src/handlers/send-agent-message.test.ts` | `strict noUncheckedIndexedAccess baseline` | 单行 | SYNC-v0.11.0 C13 |
| 69 | Token-scoped 自动模型发现：解析 `/v1/models`、过滤非聊天模型、动态版本排序、协议映射与降级边界 | `packages/server-core/src/domain/u-api-model-discovery.ts` | `token-scoped automatic model discovery` | 单行 | 02 §0 + §3.3 |
| 69t | #69 回归测试：动态新版本优先、能力过滤、服务端推荐、认证错误与按序降级 | `packages/server-core/src/domain/u-api-model-discovery.test.ts` | `automatic discovery regression coverage` | 单行 | C5 + 02 §10 |
| 70 | Onboarding U-API renderer payload 收敛为 Token + 固定 endpoint + 自动同步模式 | `apps/electron/src/renderer/components/apisetup/submit-helpers.ts` | `onboarding submits only the token` | 单行 | 03 §1.6 + §1.8 |
| 70t | #70 回归测试：禁止在 U-API renderer payload 重新硬编码模型或协议 | `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts` | `never reintroduces a hardcoded model or protocol` | 单行 | C5 + 03 §5.1 |
| 71 | Setup IPC 自动发现目录并按推荐序列实测，返回完整 `resolvedSetup` | `packages/server-core/src/handlers/rpc/llm-connections.ts` | `discover the token-scoped catalog` | 单行 | 02 §3.3 + §4.2 |
| 72 | Token-only 编辑安全：留空保持原凭据；设置页不预填/提交掩码 Token | `apps/electron/src/renderer/hooks/useOnboarding.ts` + `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` | `token-only edit` / `masked placeholder` | 单行（2 处） | 03 §2.2 |
| 73 | U-API 模型目录后台刷新：启动与每小时使用已存 Token 同步目录、默认模型与协议 | `packages/server-core/src/model-fetchers/index.ts` | `token-scoped model catalog` | 单行 | 02 §6.2.2 |
| 74 | 启动迁移把历史 U-API 手动模型模式归一为 provider 自动同步模式 | `packages/shared/src/config/storage.ts` | `catalog owns model/default selection` | 单行 | 02 §4.3 |
| 75 | utility model 关键词按完整 token 匹配，避免把 `MiniMax` 品牌误判为 `mini` 模型 | `packages/shared/src/config/llm-connections.ts` | `MiniMax brand names` | 单行 | 02 §3.3 |
| 75t | #75 回归测试：MiniMax 不误判；真实 `-mini` token 仍可选 | `packages/shared/src/config/__tests__/mini-model-selection.test.ts` | `MiniMax brand names and exact utility-model tokens` | 单行 | C5 + 02 §10 |

---

## 4. Build 脚本 marker（M2 后期补充，不计入主基线）

主基线 grep 命令仅扫 `packages` + `apps` 下的 `.ts/.tsx`，build 脚本（`.sh` / `.ps1`）不在覆盖范围内——但仍需登记，方便上游同步时辨识改造点。

> ⚠️ **命名 disambiguation**：本节的 `B1/B2` = **Build 脚本 marker**（改造点登记表）。
> [`07-upstream-sync.md` §2.7b](07-upstream-sync.md) 里另有一组 `B1/B2/B5` = **SOP-REHEARSAL Branding 类反向核对**（审计分类，非改造点登记）—— 同名异义，不要混淆。

| # | 改造类别 | 文件 | 定位 | 标记 | 引入 commit |
|---|---|---|---|---|---|
| B1 | adhoc 签名 escape hatch | `apps/electron/scripts/build-dmg.sh` | 注释 `allow caller to override (e.g. CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac)` | `# U-API:` 单行 | `6ba75da4` (M2) |
| B2 | Windows EXE 缺 pi-agent-server 修复（事故 #3）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 missed subprocess server build that build-dmg.sh L208 triggers` | `# U-API:` 单行 | M2 收尾（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0.3） |
| B3 | Windows EXE 缺 WhatsApp worker 修复（事故 #4）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 misses electron-build-main.ts:335 buildWhatsAppWorker() step` | `# U-API:` 单行 | v0.9.1 sync 后 Windows 实测 verify 触发（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0.4） |
| B5 | M3-Sentry packaging signal — macOS | `apps/electron/scripts/build-dmg.sh` | 注释 `M3-Sentry — 信号 packaging 模式给 electron-build-main.ts:assertSentryDsnForPackaging` | `# U-API:` 单行 | M3-SENTRY-DSN-ASSERTION（详见 [`M3-SENTRY-DSN-ASSERTION-SPEC.md`](M3-SENTRY-DSN-ASSERTION-SPEC.md) §2.2）|
| B6 | M3-Sentry packaging signal — Linux | `apps/electron/scripts/build-linux.sh` | 注释 `M3-Sentry — 信号 packaging 模式` | `# U-API:` 单行 | 同上 §2.3 |
| B7 | M3-Sentry packaging signal + DSN warn — Windows | `apps/electron/scripts/build-win.ps1` | 注释 `M3-Sentry — 信号 packaging 模式（与 build-dmg.sh 等价）` | `# U-API:` 单行 | 同上 §2.3（Windows 路径绕过 electron-build-main.ts，需独立 warn）|
| B4 | Windows EXE 缺 dist/interceptor.cjs 修复（事故 #5，事故 #3/#4 同根第 3 个）| `apps/electron/scripts/build-win.ps1` | 注释 `build-win.ps1 misses electron-build-main.ts:332 buildInterceptor() step` | `# U-API:` 单行 | v16 review B 路静态分析触发（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0.5） |
| B8 | **macOS DMG 缺 copy-subprocess-servers**（piServerPath；build-dmg.sh ≠ build-win.ps1 长期不对称——root chain `electron:build:subprocess` 被 sync 删后失效）| `apps/electron/scripts/build-dmg.sh` | 注释 `copy subprocess servers (pi-agent-server + session-mcp-server) into apps/electron/resources/` | `# U-API:` 单行 | **v0.10.0 macOS arm64 实测触发**（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0.6 事故 #6 + SYNC-v0.10.0 §8.1）|
| B9 | **Linux AppImage 缺 copy-subprocess-servers**（事故 #6 三平台对称核查连带发现）| `apps/electron/scripts/build-linux.sh` | 注释 `同 build-dmg.sh（事故 #6 三平台对称）` | `# U-API:` 单行 | v0.10.0 事故 #6 连带修（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0.6）|

**Build 脚本 marker 单独 grep 命令**：

```bash
grep -rEn "U-API" apps/electron/scripts/ scripts/ 2>/dev/null | grep -v node_modules | wc -l
# 期望：≥15（floor；v0.10.0 后含 B1-B9 + electron-build-main.ts 函数注释 + main() 注释 +
# scripts/check-i18n-coverage.ts + scripts/check-raw-sends.sh +
# scripts/typecheck-staged.sh + scripts/lint-i18n-staged.sh）
```

---

## 5. 基线浮动规则与历史

浮动 ±2 是为了容纳"上游改了某改造点附近代码，我们顺手补/合并标记"的合理变化。**超出 ±2 必须停下逐项核对**——多半是 git 自动合并吞掉了改造，或者引入了未文档化的新改造（应补进 §3 表）。

> ✅ **基线核对（2026-05-21）**：v0.9.4 sync 基线 96 + 本次 v0.9.5 sync model-picker brand patch (#54) + M3 i18n fix (#53) 各 +1 = **98**。实测 grep = 98 ✓ 完全吻合。
>
> **历史注解**：初版基线注释一度推断"实测多 1，是历史漂移"，但实际是 §3 表漏登记了 v0.9.5 sync 自身的 #54 model-picker brand patch（marker 真实存在于代码中，被 grep 计入 98，但子表登记环节漏盘）。已通过补加"v0.9.5 sync 期间新增改造点"子表修正，无漂移。

**历次基线演进**：

- REVIEW-2（2026-05-04 上午）：44 处（旧 grep 命令漏 3 处 HTML/JSX 注释）
- REVIEW-3（同日修正）：47 处（grep 命令改全格式，覆盖率 100%）
- REVIEW-6（hotfix v0.9.0+u-agents.1 后）：48 处（state.test.ts 新增 1 处回归测试 `// U-API:` 引用）
- M2 TLS 修复（2026-05-05 commit `c516e4d2`）：51 处（workspace.ts:27 + bootstrap.ts:124, 148 各加 1 处 TLS strict mode 注释 marker）
- M2 atomicWriteFileSync 用户数据持久化（2026-05-05 commit `25d38ab9`）：55 处（4 文件各加 1 处 atomic writes 注释 marker：storage.ts / preferences.ts / topic-registry.ts / window-state.ts）
- M2 dir 0o700 + Token 长度限制（2026-05-05 commit `2972d8f4`）：59 处（3 处 dir mode 0o700 marker：watcher.ts / storage.ts / window-state.ts + 1 处 manager.ts MIN/MAX 长度常量 marker）
- M2 apps/cli rename（2026-05-05 commit `1a49d128`）：61 处（apps/cli/src/index.ts 加 2 处 marker：tmpDir 前缀 + skill description）
- v0.9.1 sync（2026-05-06 commit `bd2a005d`）：64 处（routing.ts 加 1 处 + block-markers.ts 加 1 处 + resource-bundle.test.ts 加 1 处；上游 v0.9.1 引入的 1 个 routing bug + 3 处 ESLint 违规我们 patch 后加 marker）
- v17 漏盘补丁（2026-05-07）：67 处（access-control.ts + commands.ts messaging brand + cli/src/index.ts printHelp，3 处都是 v0.9.1 sync 时漏盘 / M2 cli rename 时漏盘）；同次 commit 顺手修 F1 自动更新 publish.url 缺 `/latest` 后缀（electron-builder.yml）+ F6 07-upstream-sync 基线 61→64 漂移
- **M3 SSRF 防护（2026-05-07）：71 处**（url-safety.ts 加 `assertPublicHttpsUrl` 块 1 处 + credential-manager.ts:982 单行 1 处 + credential-manager-renew.test.ts 单行 1 处；详见 [`M3-REFRESH-API-SSRF-SPEC.md`](M3-REFRESH-API-SSRF-SPEC.md)，对应 §3 #43/#44a/#44b）
- **M3 死路径清理（2026-05-07）：71 处不变**（main/index.ts 删 6 行 CRAFT_* env + 1 行注释；utils/files.ts 5 处 craft-clipboard → u-agents-clipboard；删除 + 品牌替换不计 marker。详见 [`M3-DEAD-PATH-CLEANUP-SPEC.md`](M3-DEAD-PATH-CLEANUP-SPEC.md) 修订记录——CRAFT_DEBUG 14+ 处真消费方决策保留）
- **M3-Sentry DSN assertion（2026-05-07）：71 处不变**（scripts/electron-build-main.ts 加 assertSentryDsnForPackaging 函数 + main() 调用，但在 repo root 不计入主基线 grep；Build 脚本子表 4 → 9：B5/B6/B7 + electron-build-main.ts 函数注释 + main() 注释）。M2 过渡期 warn 不 fail；M3-4 GlitchTip 上线日把 console.warn 改 process.exit(1)。详见 [`M3-SENTRY-DSN-ASSERTION-SPEC.md`](M3-SENTRY-DSN-ASSERTION-SPEC.md)
- **M2.5 #5 CI dead refs 修（2026-05-07）：71 处不变**（scripts/check-i18n-coverage.ts + check-raw-sends.sh + typecheck-staged.sh + lint-i18n-staged.sh 4 个 stub 实现；v0.9.1 上游 package.json 引用入口但漏文件 — C13 模式继承）。**`bun run validate:ci` 现全绿**，v0.9.1 sync 后第一次。Build 脚本子表 grep 命令含范围扩到 scripts/，期望 ≥13
- **M2.5 #3 husky 装回（2026-05-07）：71 处不变**（.husky/pre-commit 跑 lint:i18n:staged；.husky/_/ gitignored 由 bun install 自动重建）。每次 git commit 自动跑 i18n staged 检查；无 staged 相关文件时直接 skip 不卡 commit。
- **v23 P1 follow-up（2026-05-07）：73 处**（api-tools.ts 加 import 1 处 + createApiTool fetch 前 1 处 SSRF marker；新增 §3 #45a/#45b。同 commit：webui/login.html placeholder + 3 个 release-notes brand 替换不计 marker——属 01-branding-spec §1 全表）。详见 [`sync-reports/REVIEW-23-DEEP-MULTI-AGENT-2026-05-07.md`](sync-reports/REVIEW-23-DEEP-MULTI-AGENT-2026-05-07.md) §2.2。
- **v0.9.2 sync（2026-05-07 commit `a76e502d`）：73 处不变**（上游 +38 文件 / +1369 −304 主要是 spawn-helpers + system-prompt-override + OAuth refresh 重整；merge 干净未碰任何 §3 改造点；C11 触发 1 处 NPM scope rename `sendmessage-oauth-refresh.test.ts` 已修 + 6 处 brand 化 + 0 单测新增——基线维持。详见 [`sync-reports/SYNC-v0.9.2-20260507.md`](sync-reports/SYNC-v0.9.2-20260507.md)）。
- **v24 SSRF redirect bypass 真修 + brand 漏盘补丁（2026-05-07）：80 处**（+7 marker：api-tools.ts 加 redirect:'manual' + 30x reject 共 4 处 / credential-manager.ts 同样 +2 处 / pi-agent-server/index.ts:1285 brand 漏盘补 +1 处；新增 §3 #44c/#44d/#45c/#45d；#45a 升级到 4 处 marker；同 commit 重写 4 SSRF 单测从 grep-only → runtime mock fetch（v24 F1.F5）+ refreshApiRenew 加 redirect bypass 单测 + spawn-cwd 加 U Agents.app 显式回归测试。详见 [`sync-reports/REVIEW-24-POST-SYNC-2026-05-07.md`](sync-reports/REVIEW-24-POST-SYNC-2026-05-07.md)）。
- **v24 Bucket C browser tool 裁剪决策（2026-05-07）：82 处**（+2 marker：storage.ts browserToolEnabled 默认改 false 加 1 处 marker + m2-security-regression.test.ts 防回归测试加 1 处 marker；同 commit 改 config-defaults.json 默认值；新增 §3 #46/#46t；详见 [`04-feature-cuts.md`](04-feature-cuts.md) §九类）。
- **v27 Bucket B SSRF 横向扩展（2026-05-08）：94 处**（+12 marker：auto-update.ts 注释品牌 1 处 + web-fetch.ts redirect:'manual' + 30x reject 2 处 + web-fetch-ssrf.test.ts marker 防回归 1 处 + source-test.ts SSRF 8 处（import + safety check + auth path redirect:'manual' + 30x reject + basic path 3× redirect:'manual' + 30x reject）；新增 §3 #47a/#47b/#48a-d/#49；同 commit zh-Hans browser tool i18n 文案重写不计 marker（属 i18n 改动）+ Bucket A 7 文档已分别 commit。详见 [`M3-SSRF-CONSOLIDATION-SPEC.md`](M3-SSRF-CONSOLIDATION-SPEC.md) + [`sync-reports/REVIEW-27-FULL-2026-05-08.md`](sync-reports/REVIEW-27-FULL-2026-05-08.md)）。**B4 toast / B5 chat gate defer 给后续 commit，需 IPC 与 chat hook 集成**。
- **v0.9.3 sync（2026-05-12 合并 upstream `c310624f`）：95 处**（净变化 +1：删 #37（上游 v0.9.3 自己修了 v0.9.1 routing 漏分类，自动过期）−1，加 #50/#51（FabNewChat 两处 shadow ESLint 违规 disable）+2。上游 134 文件 / 31 新增 + 103 修改；25 个 unmerged 冲突（14 package.json + routing.ts + AiSettingsPage.tsx + 2 html + README + bug_report.yml + D 组 4 文件 AppMenu/TopBar/SessionMenu/SessionMenuParts）；架构层面接受上游 TopBar → AppMenu wrapper → DesktopAppMenu/MobileAppMenu 重构（替代我们 fork 把 menu rendering 搬到 TopBar 的方向）；C11 触发 6 文件 9 处 NPM scope rename（mobile UI 新建 5 文件 + messaging test 1）；C12 触发 2 处 ESLint 违规 disable（FabNewChat shadow，对应 #50/#51）；C13 未触发（上游反而修了 v0.9.1 routing 自身 bug）；上游新文件 brand patch 3 个（DesktopAppMenu/MobileAppMenu CraftAgentsSymbol → UAgentsSymbol + menu-schema.ts quitUAgents key + u-agents docs URL + HELP_LINKS 加 Automations 入口）。验证：typecheck 全绿 / lint:i18n:parity OK（6 locales × 1448 keys）/ lint:electron 仅剩 FabNewChat 2 处 disable 之外的 110 个 pre-existing warnings / bun test 4 fail 全部来自 stale `apps/electron/release/*.app` bundle 副本（与 sync 无关）。详见 [`sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md`](sync-reports/UPSTREAM-PREVIEW-v0.9.3-2026-05-12.md)）。
- **v0.9.4 sync（2026-05-20 合并 upstream `4144f795` → commit `0a49a089`）：96 处**（净变化 +1：加 #52 C13 patch HANDLED_CHANNELS 加 RTK 4 channel）。上游 73 文件 / +698 −202 行（fork 历史上影响面最小的一次）；主题 = RTK Bash token 压缩 opt-in + Pi SDK 0.72.1→0.73.1 + Codex/Copilot 死代码清理（与 04-feature-cuts 同向）；冲突总数 19 处。验证：typecheck 0 errors / i18n parity OK（6 locales × 1455 keys，+7 RTK key）/ lint:electron 110 warnings 0 errors / bun test 19 latent fail（全 v0.9.3 baseline 已存在，与 sync 无关）。实际评级 **A−**。**macOS arm64 + Windows x64 D-β 双平台实测通过**（2026-05-20）。详见 [`sync-reports/SYNC-v0.9.4-20260520.md`](sync-reports/SYNC-v0.9.4-20260520.md)。
- **v0.9.5 sync + M3 i18n fix（2026-05-21）：98 处**（净 +2）：
  - **v0.9.5 sync（commit `f863f915`）**：+1 marker = #54 model-picker brand patch（上游把 FreeFormInput.tsx 内联 grouping 抽到 helper `model-picker-helpers.ts`，brand 字面量 `'Craft Agents Backend'` 随之迁移到新文件需要重新 patch 成 `'U-API'`；同时改 4 处单测断言）。上游 73 文件 / +4167 −797；20 个冲突。详见 [`sync-reports/UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md`](sync-reports/UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md)
  - **M3 i18n fix（commit `5212197b`）**：+1 marker = #53 renderer/main.tsx setupI18n 后追加 IPC 推送 + `// U-API:` 4 行注释 + `.catch` 兜底。修复"重启 App 后必须手切语言标题才中文"的 bug。**实际是上游 bug**——上游 main 进程 `setupI18n()` 无 detector 永远 fallback `en`。可考虑作为上游 PR 候选。详见 [`M3-I18N-MAIN-PROCESS-SYNC-FIX.md`](M3-I18N-MAIN-PROCESS-SYNC-FIX.md) + [`M3-I18N-FIX-CLAIM-AUDIT.md`](M3-I18N-FIX-CLAIM-AUDIT.md)
- **v0.9.6 sync（2026-05-29，已完成）：98 处不变**（无新增改造点；实测 grep 98 → 98，START/END 仍各 = 9）。上游 66 文件 / +2199 −184（GitHub Compare v0.9.5...v0.9.6）；`git merge-base` 实测落在 v0.9.4（因 v0.9.5 sync 是 merge commit）。sync collateral 4 处（`utils/files` exports 漏 / `window-manager.ts` batch sed 漏 / `SessionManager.ts` 重复 const / release-notes 没译没去链）——均为基线漏盘 fix，非 v0.9.6 引入。验证：`lint:electron` 0 errors / 112 warnings(baseline)、api-tools-ssrf 10 pass、web-fetch-ssrf 7 pass。详见 [`sync-reports/SYNC-v0.9.6-20260529.md`](sync-reports/SYNC-v0.9.6-20260529.md)。
- **v0.10.0 sync（2026-05-29 合并 upstream `215910da` → merge `7bfd977a`，F4 merge 回 main `33602aaa`）：109 处**（净 +11 from 98：#55/#56 brand remote browser 文案 + #57 D1 `allowRemoteEvaluate=false` + #57t + #58 D5-b dispatcher 总闸（含 import 共 2 处）+ #58t + #59 F1 eslint-disable ×4）。上游 61 文件 / +2588 −162；主题 = remote `browser_tool` 桥接 + 浏览器标签 per-workspace 隔离 + #824 basic-auth fix；19 冲突全浅（14 package.json C11 + 5 源码 import/config）；**安全 lockdown D1+D5-b**（REVIEW-1 坐实 remote workspace 可达 + dispatcher 原无 `browserToolEnabled` 总闸）；无 SDK bump。验证：typecheck:all 0 errors / i18n parity 6×1462 / lint:electron 0 errors / **lint:shared 0 errors（F1 清了 4 个 baseline error）** / bun test 0 新增 regression（browser-pane-manager 8 fail = v0.10.0 upstream baseline，临时 worktree 实测确认）。**macOS arm64 + Windows x64 双平台实测通过**（agent 对话工作 = piServerPath 修复生效；连带修 build-dmg.sh/build-linux.sh 缺 copy-subprocess-servers = 事故 #6，B8/B9）。F4 与主 worktree 的 CLAUDE.md 重构整合（§3.7 marker 表抽到本文件）。详见 [`sync-reports/SYNC-v0.10.0-20260529.md`](sync-reports/SYNC-v0.10.0-20260529.md)。
- **v0.10.3 sync（2026-06-10 合并 upstream `a512da7a`，跨 v0.10.1/2/3 三版本）：115 处**（净 +6 from 109：#60a-d D2 模型迁移豁免 ×4+测试 #60t + #61 D4 预设清单 − #53 旧形态退役换 `.catch` 兜底；START/END 9→**10** 对，新增 #60d workspace no-op 块；#62 D1 yml 注释不计入 grep）。上游 105 文件 / +2223 −613；主题 = Opus 4.8 默认 + **Fable 5** + `uiLanguage` 机制 + **Pi prompt-cache 修复(#862)** + SDK **0.2.123→0.3.170** 两连跳 + esbuild externalize + **macOS Intel 停产**（D1 跟随）。27 冲突（14 package.json C11 + bun.lock + 12 源码/docs）；**上游仓库迁移 org：`lukilabs` → `craft-ai-agents`**（remote 已更新）。验证：typecheck:all 0 errors / i18n parity 6×1466 / lint:electron 0 errors（114 warnings，+2 上游）/ **lint:shared 0 errors（上游自修了 4 个 baseline errors，#59 的 C13 follow-up 自动关闭）** / 测试 0 新增 regression（electron 9 fail = browser 8 基线 + transport-banner 1 处 **v0.9.1 起 pre-existing**（上游测试断言 `CRAFT_SERVER_TOKEN` vs 我方更早文案清洗，本次新发现入账）；shared 1 fail send-developer-feedback = pre-existing latent，临时 worktree 基线实测确认）。**打包装机实测 deferred**（SDK externalize 后冷启动为第一道哨兵）。详见 [`sync-reports/SYNC-v0.10.3-20260610.md`](sync-reports/SYNC-v0.10.3-20260610.md)。
- **v0.10.4 sync（2026-06-27 合并 upstream `556c59a7`，单 squash 提交）：118 处**（净 +3 from 115：#63 `autoUpdateLogPath` `.craft-agent`→`.u-agents` + marker（上游 v0.10.4 新增的 always-on auto-update 诊断日志路径）+ #64 `messagingGatewayLogPath` 补 marker（既有 `.u-agents` 路径漏登记回补）+ #65 `writeRootConfig` 测试 helper 兼容上游新迁移测试数组传参（merge 整合，typecheck 修复）；START/END 维持 10/10，新增均为单行 `//`）。上游 52 文件 / +568 −807；主题 = **Pi SDK scope 迁移 `@mariozechner/*`→`@earendil-works/*`（0.73.1→0.79.9）** + config 启动备份（`backupConfigFile`）+ 会话标题跟随语言（`uiLanguage` 直读，修上游 #885）+ Copilot `onDeviceCode`。20 冲突（14 package.json C11 全部"我方 `@u-agents` 名/描述 + 版本升 0.10.4" + bun.lock + storage.ts/auto-update.ts/index.ts/SessionManager.ts 5 源码 import/逻辑 + storage-startup-migration.test.ts 加 upstream 新迁移测试，保我方 U-API lockdown 测试块）；**§3.3 高冲突区 0 命中**；C11 clean（`@craft-agent/` scope = 0、`@mariozechner` = 0）；C13 未触发。**bun.lock 踩坑（lockfile 重生成陷阱）**：直接对冲突态 `bun install` 会从头解析、拉到比 pin 更新的 `@sentry`（10.60+10.62 **dup**）致 electron `main.tsx` typecheck 断（我方 v0.10.3 与上游 v0.10.4 lock **均 pin `@sentry/core@10.36.0` 单版本**）；正解 = **先 `git checkout upstream/main -- bun.lock` 以上游 lock 为基底，再 `bun install` 调和我方 `@u-agents` 工作区名** → @sentry 回 10.36.0 deduped、工作区名全 `@u-agents`（`@craft-agent` = 0）。验证：**118/10/10 ✓ + `@mariozechner`/`@craft-agent`/`.craft-agent` 残留均 0 ✓ + `bun run typecheck:all` EXIT=0 全绿 ✓**。**装机实测通过（2026-06-28，arm64 adhoc DMG 272 MB）**：Pi 对话正常 + "获取 Token" → `/keys` + 中文标题 + onboarding 品牌锁定，均 OK；koffi `not found` 警告**确认无害**（上游 v0.10.4 锁文件同样 koffi=0 且照常发版——新 `@earendil-works` Pi SDK 已弃 koffi；`--external koffi` + trustedDependencies koffi 属上游也有的死配置，不清以免增分歧）。merge sync→main 仅剩用户执行。详见 [`sync-reports/SYNC-v0.10.4-20260628.md`](sync-reports/SYNC-v0.10.4-20260628.md)（终评）+ [`sync-reports/UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.4-2026-06-27.md)（预分析）。
- **v0.10.5 sync（2026-06-28 合并 upstream `c9d9a26f`，merge `35fed047`）：118 处不变**（无新增改造点；START/END 维持 10/10）。上游 22 文件 / +122 −51（fork 史上最小）；主题 = **Claude Sonnet 5 上架**（`claude-sonnet-5`，1M context，registry + Bedrock 三区映射 + `PI_PREFERRED_DEFAULTS`）+ **Claude Agent SDK 0.3.170→0.3.197**。15 冲突全机械（14 package.json C11 + bun.lock）；§3.3 仅 `llm-connections.ts` 被上游改但我方与基线逐字节一致 → 零冲突照收（anthropic/bedrock Pi provider 我方隐藏，dead-ish path；D2 豁免保 U-API 模型清单）。**bun.lock 按 C15 程序**（取上游 lock 基底 + `bun install` 调和；@sentry 保持 10.36.0 单版本、workspace 名 `@u-agents`×80 / `@craft-agent`=0）。**本次唯一实质工作 = i18n 值同步**：上游改 `model.sonnetDesc` 英文值，parity 抓不到值变化，手动同步 6 个非英语 locale（zh-Hans「速度与智能的最佳结合」等）；上游小瑕疵记录：Sonnet 4.6 与 Sonnet 5 共用 `descriptionKey`，i18n UI 两代同句（C13 类 cosmetic，我方不可达，不处理）。release-notes 0.10.5.md 中文化三件套照做。验证：typecheck:all EXIT=0 / 118/10/10 / 三残留全 0 / i18n sorted+parity+coverage 全过（6×1466）+ **装机实测通过（2026-06-28，arm64 adhoc DMG 272 MB）：App 启动 + Pi 对话正常**（SDK 0.3.197 升级后 C14 真测；koffi 警告同 v0.10.4 无害）。详见 [`sync-reports/SYNC-v0.10.5-20260628.md`](sync-reports/SYNC-v0.10.5-20260628.md)（终评）+ [`sync-reports/UPSTREAM-PREVIEW-v0.10.5-2026-06-28.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.5-2026-06-28.md)（预分析）。
- **治理复核（2026-07-10）：119 处 / START 10 / END 10**。本轮没有新增源码 marker；把校验命令补上 `--exclude-dir=release` 后，排除历史 packaged source 副本并对当前源码重新计数，确认后续同步前基线应使用 119。旧命令在当前 checkout 会误报 207，不能再作为基线。
- **M2 依赖安全收口（2026-07-10）：120 处 / START 10 / END 10**。新增 #66 单行 marker；Office 附件转换从 `markitdown-js` 切到受控 Python/uv 工具链，并补 `markitdown.test.ts` 4 个 runtime 路径解析测试。旧命令因 `release/` 历史副本会误报 208。
- **v0.11.0 sync（2026-07-10）：123 处 / START 10 / END 10**。新增 #67/#67t（后台代理默认关闭与兼容变量测试）和 #68（严格 TypeScript 测试适配）；其余 8 个 marker-bearing 交叉文件逐项复核后保持既有语义。
- **Token-only 自动模型发现（2026-07-10）：134 处 / START 10 / END 10**。从 123 基线新增 #69–#75t 共 11 个单行 marker，覆盖目录发现、动态推荐/模型与协议双层降级、Token-only UI、编辑安全、后台刷新、自动同步迁移与 MiniMax 回归。
- **v0.11.1 sync（2026-07-11）：134 处 / START 10 / END 10**。上游 23 文件 / `+82 −63`，唯一 marker-bearing 交叉文件为 `packages/shared/src/config/llm-connections.ts`；接收 GPT-5.6 原生 provider 推荐顺序但不改变 U-API Token-only 动态发现与探活降级，#75 MiniMax 完整 token 匹配标记保持不变。本轮无新增改造点。

---

## 6. 改造点常见踩坑模式（C1–C14）

每月同步必跑核对，详见 [`07-upstream-sync.md` §2.7c](07-upstream-sync.md)。

| # | 模式 | 一句话 |
|---|---|---|
| C1 | 硬编码 slug 而非 helper | 凭证判定别用 `=== U_API_SLUG`，用 `isUApiSlug()` |
| C2 | batch sed 漏 object key 引号 | `{ u-agents: }` 是 syntax error，必须 `{ 'u-agents': }` |
| C3 | sed 改 input 漏 assertion | 测试改输入也要改断言（同文件 'craft' + 'u-agents' 混用是嫌疑）|
| C4 | dead import | 修 callsite 后 grep `<symbol>` 计数 = 1 = dead import 待删 |
| C5 | 新改造点忘记加单测 | 新增 §3 表项必须同时加 `__tests__/*.test.ts` |
| C6 | system prompt craft 字面量未门控 | 用户可见路径 0 craft；FEATURE_FLAGS 门控的可保留 |
| C7 | §3 反向覆盖空白 | grep 实际标记的文件清单要全在表里 |
| C8 | 基线 grep 命令漏注释格式 | 用 §0 的"全格式"grep，不用旧 `// U-API:` 简写 |
| C9 | 测试 syntax 让 baseline fail 数字假 | bun test 不带 --bail 跑，看真实 fail 数对照 M1-FIRST-RELEASE 已知技术债 |
| C10 | 上游新增 connection 字段透传漏 | `enforceUApiBaseUrl` 重写连接时浅合并保字段（v0.9.1 起：midStreamBehavior；未来字段同样处理）|
| C11 | 上游新文件用旧 NPM scope | sync 后 grep `@craft-agent/` 必须 = 0；命中跑 batch sed rename（v0.9.1 sync 触发 12 文件 20 处）。**v0.10.0 细化**：上游若在 fork 已 scope-rename 的**同一 import 块**新增 import，该 rename 以 **merge 冲突**形式出现（非 sync 后批量）——v0.10.0 中 `browser-pane-manager.ts`/`SessionManager.ts` 即此；解法不变（取 theirs + rename），但预测时别因"fork 只 scope-rename 过"就判它不冲突 |
| C12 | 上游 release 自身 lint 违规 | sync 后跑 lint 套件，errors case-by-case 处理：语义等价改源码 / `// eslint-disable-next-line` + `// U-API:` 注释加进 §3 |
| C13 | 上游 release 自身 test fail | 区分 (a) 我们 patch 真能修（如 routing.ts 漏分类）→ commit fix；(b) 上游 bug 我们继承 → 记 sync 报告 follow-up，不阻塞 merge |
| C14 | build 脚本与 root chain 结构性差距（**双向**）| sync 后核 dist 产物缺什么 + **三平台 build 脚本是否都显式调 `copy-subprocess-servers`**。原向：build-win.ps1 落后 root chain（事故 #3/#4/#5）。**v0.10.0 事故 #6 揭示反向**：root chain 自身会被 sync 破坏（`electron:build:subprocess` 被删 → 依赖它的 build-dmg.sh/build-linux.sh 静默失效，macOS/Linux piServerPath，B8/B9 修）。铁律：**打包后必须真测一条 Pi 对话**（事故 #1/#6 只有真发消息才暴露，见 09 §5）|
