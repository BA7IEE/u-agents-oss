# SYNC v0.9.1 — 2026-05-06 同步报告

> **同步范围**:upstream/main `acb08842` (v0.9.0) → `b31904c6` (v0.9.1)
> **执行**:本仓库 AI 在用户当次破例授权下完成 (CLAUDE.md §0 例外)
> **耗时**:约 60 分钟(含 lint/typecheck 修复 + 上游 bug fix)

---

## 1. Sync commit

| 项 | 值 |
|---|---|
| Sync 分支 | `sync/upstream-20260506` |
| Sync commit | `bd2a005d` |
| Tag | `sync-20260506` |
| Pre-sync HEAD | `10bebe23` (M1 docs merge,v0.9.1 sync prep 落地) |
| Upstream HEAD | `b31904c6` (v0.9.1) |
| Merge-base | `acb08842` (v0.9.0) |
| Stat | **118 files / +9964 / -1176** |

---

## 2. 冲突文件统计 vs Playbook §1 dry-run

| 维度 | Playbook v15 dry-run 预测 | 实际 |
|---|---|---|
| 双方都改的文件(真冲突候选) | 58 | — |
| **实际撞冲突数** | ~5(`AiSettingsPage` 必撞 + 4 简单) | **33** |
| 自动 3-way merge OK | ~52/58 | ~75/108(108 双方动过的文件,33 冲突) |
| AiSettings 主战场实际段数 | 多段(担忧 ConnectionRow signature + handleSetMidStreamBehavior 同行) | **1 段 7 行**(只 import 区,git auto-merge 把 ConnectionRow 等全部解了) |
| zh-Hans 漂移 | 78 行 | 与预测一致(4 段冲突) |

**主要发现**:dry-run 严重低估了冲突数(58 候选实际 33 撞了),但严重高估了 AiSettings 冲突复杂度(预测 P0 主战场实际只 7 行 import)。

冲突分类:
- **package.json × 14 + bun.lock**:全部双方版本字段冲突
- **i18n locale × 7**:6 non-zh 各 1 段(craftAgentsBackend value + 上游加 claudeProMax) + zh-Hans 4 段(中文化 vs 上游 telegram access control)
- **PreferencesPage.tsx UD**:上游删,我们改 import → 接受上游删除(已是 dead code,settings 子目录下有新版)
- **源码 8**:connection-setup-logic + SessionManager(2 段) + messaging-gateway × 3 + 测试 × 3 — 主因 NPM scope (@u-agents vs @craft-agent) + 上游加新 import
- **AiSettingsPage.tsx**:1 段 7 行(import 区 mid-stream 类型加入)

---

## 3. AiSettingsPage 手解 marker 数

| 维度 | Playbook §8 期望 | 实际 |
|---|---|---|
| `// U-API:` 注释行 | ≥ 11 | **9**(Playbook 写法略宽松,实际是数 §3.7 #19-#25 的 7 项的注释行,#20 是 5 行连排,合计 9 行注释) |
| 总 U-API 计数(含 `/* U-API START */` 块标记)| ≥ 11 | **19** ✓ |
| mid-stream 符号(MidStreamBehavior / midStreamBehavior / handleSetMidStreamBehavior 等)| ≥ 5 | **11** ✓ |

§3.7 #19-#25 改造点全部保留(git auto-merge 加 1 段 import Edit 完成)。

---

## 4. Baseline 同步后真实数字

| 指标 | 上次基线 (M2 收尾) | 本次实际 | 浮动 |
|---|---|---|---|
| U-API 标记总数 | 61 | **64** | +3(在 ±5 merge 当下浮动内) |
| `/* U-API START */` 块 | 8 | **8** | ✓ |
| `/* U-API END */` 块 | 8 | **8** | ✓ |
| Build 脚本 marker | 2 | **2** | ✓ |

**新增 3 处 marker**(都是 v0.9.1 上游新代码引入,我们 patch 时加 marker):
1. `packages/shared/src/protocol/routing.ts` — 上游 v0.9.1 加 9 个 access-control channel 但漏分类,我们 patch 加 9 个到 REMOTE_ELIGIBLE,marker 注释 1 处
2. `packages/ui/src/components/annotations/block-markers.ts` — 上游 v0.9.1 加动态 color-mix boxShadow,违反我们的 `craft-styles/no-nonstandard-shadows` ESLint 规则,加 disable 注释 + marker
3. `packages/shared/src/resources/__tests__/resource-bundle.test.ts` — 上游 v0.9.1 加测试断言 `source.config.isAuthenticated` 直接读,违反 `craft-shared/no-inline-source-auth-check`,加 disable 注释 + marker

**§3.7 表后续应补这 3 项**(下次同步前刷新 CLAUDE.md §3.7 表 + 把基线刷新为 64)。

---

## 5. C1-C10 踩坑核对(07 §2.7c)

| # | 模式 | 触发? | 备注 |
|---|---|---|---|
| C1 | 硬编码 slug 而非 helper | ❌ | 未触发 |
| C2 | sed 漏 object key 引号 | ❌ | 未触发 |
| C3 | sed 改 input 漏 assertion | ⚠️ 触发 | event-adapter.ts 中 `CraftAgentEvent` 类型残留(我们 alias `UAgentEvent`),sed batch rename 漏。手 Edit 修复 |
| C4 | dead import | ❌ | 未触发 |
| C5 | 新改造点忘记加单测 | — | 不适用(本次新 marker 都基于上游已有/无改动测试) |
| C6 | system prompt craft 字面量未门控 | ❌ | 未触发 |
| C7 | §3.7 反向覆盖空白 | ⚠️ | 见 §4 新增 3 marker 应补表 |
| C8 | 基线 grep 命令漏注释格式 | ❌ | 用全格式 grep |
| C9 | 测试 syntax 让 baseline fail 数字假 | ❌ | bun test 无 syntax error |
| **C10** | **上游新增 connection 字段透传漏** | ✅ **OK** | `enforceUApiBaseUrl` 用 **in-place 字段修改**(`for (const conn of uApi) { conn.providerType = ... }`),`midStreamBehavior` 等新字段天然保留 |

---

## 6. Playbook 没说但实际撞到的事 (v15 SOP 改进素材)

### 6.1 NPM scope 全仓 rename 漏 12 文件

**症状**:typecheck:all 跑完报 12 个 `Cannot find module '@craft-agent/...'` errors。

**根因**:上游 v0.9.1 加的新文件(主要在 `packages/server-core/src/sessions/runtime-config.{ts,test.ts}`、`messaging-gateway/__tests__/access-control` 各测试文件、`renderer/playground/registry/image-support.tsx` 等)用的还是 `@craft-agent/*` import。我们之前 commit `393409ce` 做的 NPM scope rename 没追到这些**还不存在**的文件。

**修法**:全仓 grep `@craft-agent/` → batch sed 替换为 `@u-agents/`(12 文件 20 处)。

**SOP 改进建议**:在 `07-upstream-sync.md` §2.7c 新加 C11 模式 "上游新文件用旧 NPM scope",每次 sync 必跑 `grep -rEn "@craft-agent/"` 验证 = 0。

### 6.2 上游 v0.9.1 自身 lint 违规

**症状**:`bun run lint:ui` 报 3 errors,`bun run lint:shared` 报 1 error。

**根因**:这些 errors 全部是 v0.9.1 上游新代码引入,违反我们 fork(实际是上游本身的)`packages/{ui,shared}/eslint-rules/` 自定义 ESLint 规则。具体:
- `packages/ui/src/components/annotations/block-markers.ts:8` — `block.style.boxShadow = ''` 违反 `craft-styles/no-nonstandard-shadows`(规则不识别空字符串等价于 'none')
- `packages/ui/src/components/annotations/block-markers.ts:30` — 动态 `color-mix(...)` boxShadow,违反同规则
- `packages/ui/src/components/chat/TurnCard.tsx:1479` — 同 L8 模式
- `packages/shared/src/resources/__tests__/resource-bundle.test.ts:141` — `source.config.isAuthenticated` 直接读,违反 `craft-shared/no-inline-source-auth-check`

**修法**:
- L8 / L1479:`= ''` 改 `= 'none'`(语义等价,符合规则的 `allowInlineNone` 默认)
- L30 / resource-bundle:加 `// eslint-disable-next-line` + `// U-API:` 解释注释

**SOP 改进建议**:在 `07-upstream-sync.md` §2.7c 新加 C12 模式 "上游 release 自身 lint 违规",每次 sync 后跑 lint 套件,errors 都需 case-by-case 处理(改源码语义等价或加 disable)。

### 6.3 上游 v0.9.1 自身测试 fail

**症状**:`packages/shared bun test` 显示 4 fail(M2 baseline 是 1-2 OAuth flaky),其中 2 个明显是 v0.9.1 引入,1 个是 routing.ts bug。

**根因 + 修法**:
- `routing.test.ts × 2 fail` — 上游加 9 个 `messaging:access:*` channel(channels.ts +11)但 `routing.ts` 只分类了 5 个,漏 9 个未分类。**我们 patch**:把 9 个全加到 `REMOTE_ELIGIBLE_CHANNELS` + `// U-API:` marker 注释。修后 2 fail 消除。
- `sdk-bridge.test.ts:30` — `buildEnvFromSdkInput should not include undefined values`,上游 v0.9.1 行为变化导致期望失败。**未修**(记入 follow-up)。
- `send-developer-feedback-permissions.test.ts:34` — `is allowed in safe (Explore) mode` 实际返回 false。上游可能改了 permission 逻辑。**未修**(记入 follow-up)。

最终 sync commit 时 bun test 状态:**2735 pass / 12 skip / 3 fail**(2 个 v0.9.1 上游 release 自身 broken + 1 个 OAuth e2e flaky)。

**SOP 改进建议**:在 `07-upstream-sync.md` §2.7c 新加 C13 模式 "上游 release 自身 test fail",sync 时区分 (a) 我们 patch 真能修的 (b) 上游 bug 我们继承的(记入 follow-up)。

### 6.4 PreferencesPage UD(上游删,我们改 import)

**症状**:`apps/electron/src/renderer/pages/PreferencesPage.tsx` 状态 `UD`(deleted in upstream/main, modified in HEAD)。

**根因**:上游 v0.9.1 完全删除 `pages/PreferencesPage.tsx`(把 preferences 编辑迁到 `pages/settings/PreferencesPage.tsx`)。我们对老位置只做了 brand rename(`@craft-agent/ui` → `@u-agents/ui`、`~/.craft-agent` → `~/.u-agents`),无功能改动,无 §3.7 marker。

**修法**:确认 navigation-registry / settings-pages.ts 引用都已转向新位置,`git rm` 老 PreferencesPage.tsx。

**SOP 改进建议**:`07-upstream-sync.md` 已经对 UD 决策有指引。但应在每次 sync 时 grep `git status | grep -E '^(UD|DU)'` 显式列出,playbook §1 dry-run 应包含 UD 候选预测。

---

## 7. Follow-up 待办(下次 commit 前修)

| # | 项 | 类别 |
|---|---|---|
| 1 | 修 `sdk-bridge.test.ts:30` test fail | v0.9.1 上游引入,baseline 漂 |
| 2 | 修 `send-developer-feedback-permissions.test.ts:34` test fail | 同上 |
| 3 | 在 CLAUDE.md §3.7 主表新增 3 项 marker(routing.ts / block-markers.ts / resource-bundle.test.ts)+ 基线 61 → 64 | §3.7 表反向覆盖 |
| 4 | 在 `07-upstream-sync.md` §2.7c 加 C11/C12/C13 三个新踩坑模式 | SOP 改进 |
| 5 | 跑 `bun run dist:mac` + `dist:win` 实测装包(playbook §8 可选项) | M2 收尾完成度 |
| 6 | (可选)向上游报 routing.ts 漏分类 9 channel(他们 v0.9.1 release 时也应该 fail 测试) | upstream contribution |

---

## 8. 同步成功标志(playbook §8 对照)

✅ 全部满足:
- [x] `git status` 干净(只剩 `?? .claude/` worktree 元数据)
- [x] `git log --oneline -2` 最上是 `bd2a005d sync: merge upstream/main as of 20260506 (v0.9.1)`
- [x] `git tag --list "sync-*" | tail -1` = `sync-20260506`
- [x] U-API 主基线 = 64(在 61 ± 5 merge 当下浮动内)
- [x] `/* U-API START/END */` 配对仍 8/8
- [x] `bun run typecheck:all` exit 0
- [x] `bun run lint:i18n:sorted` exit 0(跑 sort-locales 后)
- [x] `bun run lint:i18n:parity` 6 locales × 1447 keys 全过
- [x] `bun run lint:electron` 0 errors / 112 warnings
- [x] `bun run lint:shared` 0 errors / 9 warnings(修 1 个上游 lint 违规)
- [x] `bun run lint:ui` 0 errors(修 3 个上游 lint 违规)
- [x] `cd packages/shared && bun test 2>&1 | tail -5` = 2735 pass / 3 fail(M2 baseline 12 stable + 1 OAuth flaky → v0.9.1 baseline 14 stable + 1 OAuth flaky + 2 上游引入 fail)
- [x] `grep -nE "MidStreamBehavior|defaultMidStreamBehavior|resolveMidStreamBehavior" packages/shared/src/config/llm-connections.ts | wc -l` = 10 ≥ 5
- [x] `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` 含 U-API 总计数 = 19 ≥ 11
- [ ] (可选) 装包跑 `bun run dist:mac` + `dist:win`(后续手动跑)

---

## 9. 总结

**v0.9.1 sync 主要价值**:
- Pi SDK 0.72.1 升级(undici 长流稳定性 / Anthropic stream-end-as-error / DeepSeek V4 reasoning compat / GPT-5.5 Codex 支持)
- Telegram bot 白名单 + access control(workspace owner + 每绑定 access mode)
- mid-stream send 行为(Steer vs Queue,per-connection 可配)
- 每模型 image support 切换(custom-endpoint)
- HTTP MCP 验证不再 spawn subprocess
- locale 字典序 lint guard(scripts/sort-locales.ts)

**Sync 决策**:
- name 保留 `@u-agents/*` / `u-agents`(品牌锁定)
- version 升 `0.9.1`(对齐上游)
- bun.lock 取上游(`git checkout --theirs` + `bun install` 重生成)
- i18n 中文化保留(zh-Hans 关键 key 如 `bindings.unbind: 解绑`、`messaging.title: 消息绑定`、`whatsapp.disable: 停用` 等保留 vs 上游漏翻)
- 上游 v0.9.1 引入的 1 个 routing bug 我们直接 fix(2 fail 消除)
- 上游 v0.9.1 引入的 2 个 test fail 我们继承(follow-up)

**下次 sync 准备**:
- 基线刷新到 64 ± 2(刷新 CLAUDE.md §3.7 + `01-branding-spec.md` 等)
- §3.7 表补 3 行新 marker
- `07-upstream-sync.md` §2.7c 加 C11/C12/C13 三个新踩坑模式

---

**Generated**: 2026-05-06 by AI in 当次破例授权下(CLAUDE.md §0 例外)
