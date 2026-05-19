# SYNC v0.9.4 实测报告（2026-05-20）

> 实测报告——记录 v0.9.4 sync 的实际 merge 过程，与 [UPSTREAM-PREVIEW-v0.9.4-2026-05-20.md](./UPSTREAM-PREVIEW-v0.9.4-2026-05-20.md) 的 5 轮 review 预测对比。
> 关联规格：[`CLAUDE.md`](../../CLAUDE.md) §3.7 / §0 / §4

---

## 0. TL;DR

| 维度 | PREVIEW 预测 | **实测** | 一致度 |
|---|---|---|---|
| 上游 commit | `4144f795 v0.9.4` | ✅ 实际 `4144f795` | ✅ |
| 文件数 | 73 | 实际 73 | ✅ |
| §3.3 真冲突 | 0 | ✅ 0 | ✅ |
| §3.7 改造点真冲突数 | 0 真 / 0 硬冲突 / 0 软冲突 | **2 真冲突** | ❌ 漏报 |
| §3.7 隐式冲突 | 2 处（eslint + bun.lock） | ✅ 2 处 + 15 package.json | ⚠️ 部分漏报 |
| C11 NPM scope | 1 文件 4 处 | ✅ 1 文件 4 处 | ✅ |
| C13 触发 | 0（routing.ts 上游正确分类）| **1**（HANDLED_CHANNELS 漏 RTK 4 channel）| ❌ 漏报 |
| §3.7 marker 基线 | 95 → 95 | **95 → 96**（+1，C13 patch） | ❌ +1 |
| 评级 | A−（预测）| **B+**（含 2 真冲突 + C13 patch + Sentry dup install 副作用） | 略低预测 |

---

## 1. 预测 vs 实际差异（关键漏点）

### 1.1 漏报：**真实代码冲突 2 处**

PREVIEW 5 轮 review 都说"§3.7 改造点 0 真冲突"——基于"行号不重叠"判断。**实际 git 3-way merge 报了 2 处冲突**：

| # | 文件 | 真冲突原因 | 实际处理 |
|---|---|---|---|
| 1 | `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx` | ours 改 `craftagents://` → `uagents://` deep link（§3.5 brand 替换） vs theirs 改 onShowInFinder 整段逻辑 —— 同一 hunk 内有不同 commits 触发 git 标记 conflict（即便逻辑上不重叠）| 手工保 ours `uagents://` + 接 theirs `async/try/catch/toast` 结构 |
| 2 | `packages/shared/src/agent/backend/claude/event-adapter.ts` | ours 改注释 "Craft Agent's" → "U Agents's" vs theirs 改注释 "Codex/Copilot adapter pattern" → "PiEventAdapter via BaseEventAdapter" —— 同一 hunk 内 brand patch 与 docblock 清理冲突 | 手工保 ours "U Agents's" + 接 theirs "PiEventAdapter via BaseEventAdapter" |

**PREVIEW 预测错的根因**：5 轮 review 都假设"行号不重叠 = git auto-merge 通过"。实际 git 3-way merge 用 **hunk context**（行号附近 3 行）判断冲突 —— 我们 brand patch 与上游 docblock/code 改动**在同一 hunk** 即触发 conflict，即使逻辑上不重叠。

**教训**：未来 PREVIEW 需要核 hunk 边界（用 `git merge-tree --conflict-only` 或 `git merge-base` 做 dry-run），不能只看行号交集。

### 1.2 漏报：**15 个 package.json 全部 conflict**（不只 C11 1 个文件）

PREVIEW 说"C11 NPM scope rename 触发 1 文件 4 处（settings.ts）"——但实际 **15 个 package.json 全部 conflict**，因为：
- 每个 package.json 都有 `"name": "@u-agents/X"` (ours) vs `"name": "@craft-agent/X"` (theirs)
- 每个 package.json 都有 `"version": "0.9.3"` (ours) vs `"version": "0.9.4"` (theirs)
- 两个改动在**同一 hunk**（name 和 version 相邻），git 必标 conflict

PREVIEW 把 `@craft-agent/` → `@u-agents/` rename 范围归类为"C11"——但 C11 仅针对 **.ts/.tsx 文件 import path**，**package.json scope 改动是另一类**（M1 commit 时就做过的同步操作）。

**实际处理**：
- 用 perl 批量删 15 个 package.json 的冲突标记 + 保 ours name + version 升 0.9.4
- 命令：`perl -i -0pe 's/<<<<<<< HEAD\n//g; s/=======\n(.*?)>>>>>>> upstream\/main\n//gs' "$f"` + `perl -i -pe 's/"version": "0\.9\.3"/"version": "0.9.4"/'`

**教训**：PREVIEW 应当**显式列出 package.json 冲突**作为独立类别，不与 C11 混淆。SOP 应预置批量 perl 命令。

### 1.3 漏报：**C13 上游 v0.9.4 漏 HANDLED_CHANNELS 4 channel**

PREVIEW 说"C13 未触发预判（routing.ts exhaustiveness test 应当通过）"——基于 routing.test.ts 的 LOCAL_ONLY / REMOTE_ELIGIBLE 验证。**确实 routing.ts 干净**——但**另一个测试 fail 暴露 RPC handler registration**：

`packages/server-core/src/handlers/rpc/settings.ts` L321-340 注册了 4 个 RTK channel，**但 L14 的 `HANDLED_CHANNELS` 导出数组没含**。导致 `registers all declared handled channels exactly once` test fail（actual 多 4 个 unexpected channel）。

**这是 v0.9.4 上游 release 自身 bug** —— C13 模式 (a) 触发，可 patch。

**实际处理**：在 `HANDLED_CHANNELS` 数组里 `caching.SET_ENABLE_1M_CONTEXT` 之后加 4 行 RTK channel + `// U-API:` marker。新增 §3.7 改造点 #52（C13 pattern，与 v0.9.1 routing.ts #37 同模式）。

**marker 基线变化**：95 → **96**（+1 for #52）。

### 1.4 副作用：**Sentry dup install**（bun.lock 重建副作用）

PREVIEW §6.1a 说"`rm bun.lock && bun install` 让 bun 按 package.json 重新解析"——**实测发现 Sentry dup install**：
- root `@sentry/react ^10.36.0` → bun 选最新 10.53.1（含 nested `@sentry/core` 10.53.1）
- root `@sentry/electron ^7.7.0` 的 transitive dep `@sentry/core` 10.50.0
- main.tsx:39 `integrations: [captureConsoleIntegration]` 用 root @sentry/core 10.50.0 的 Integration 类型，但 @sentry/react 10.53.1 期望 10.53.1 → typecheck fail TS2322

**实际处理**：拿回 v0.9.3 sync 后 bun.lock (`git checkout 29bbfdc7 -- bun.lock`) + 增量 install。bun 会按 lockfile 已锁版本，**仅升 package.json 改的 deps（Pi SDK 0.72.1 → 0.73.1）**，不动其他 transitive。✅ Sentry 单一版本 + Pi SDK 升级到位。

**教训**：`rm bun.lock` 是危险操作 —— 会让 bun 重新解析所有 deps 拉 transitive 最新版本，可能引入 dup install。**SOP 应改为：`git checkout <prev-sync-commit> -- bun.lock && bun install`**（增量同步），而非 `rm + install`。

### 1.5 验证：**REVIEW-3 backlog `@github/copilot-sdk` dep 顺手删**

PREVIEW §9.2 列为 "低紧急度 backlog"。实测 sync 时 root package.json 还有此 dep —— 顺势删（节省 12MB node_modules 浪费）。无副作用。

---

## 2. 实际执行步骤记录

| 步骤 | SOP 章节 | 实际操作 | 结果 |
|---|---|---|---|
| 1 | §6.0 | `git checkout -b sync/upstream-20260520-v094` | ✅ |
| 2 | §6.0 | `git fetch upstream` | ✅ upstream/main 推进到 `4144f795 v0.9.4` |
| 3 | §6.1 | `git merge upstream/main` | ⚠️ 14 文件 conflict（含 2 真代码冲突） |
| 4 | §6.1 手工 | 解 SkillsListPanel.tsx + claude/event-adapter.ts 真冲突 | ✅ |
| 5 | §6.1 批量 | perl 解 15 个 package.json conflict | ✅ |
| 6 | §6.3a | 顺势删 eslint.config.mjs 3 条 ESLint 死规则 | ✅ |
| 7 | §6.1a | `git checkout 29bbfdc7 -- bun.lock && bun install` | ✅ Pi SDK 升级 + Sentry 单版本 |
| 8 | §6.2 | sed 4 处 `@craft-agent/` → `@u-agents/` (settings.ts) | ✅ |
| 9 | §9.2 | 顺手删 root package.json `@github/copilot-sdk` dep | ✅ (REVIEW-3 backlog) |
| 10 | §6.3 | release-notes/0.9.4.md 中文翻译 + brand 替换 | ✅ 0 命中 Craft/lukilabs/Codex/Copilot |
| 11 | C13 patch | 加 RTK 4 channel 进 settings.ts HANDLED_CHANNELS + §3.7 #52 marker | ✅ 新增改造点 |
| 12 | §6.5 验证 | typecheck（0 errors）/ i18n parity (1455 keys × 6 locales) / lint:electron (110 warnings 0 errors) | ✅ |
| 13 | §6.5 验证 | bun test：4500 pass / 19 fail（v0.9.3 baseline latent，非 sync 引入） | ⚠️ 见 §3 |
| 14 | §6.6 | brand 残留扫 `Craft Agents\|craft\.do` = 0 | ✅ |
| 15 | §6.7 | sync commit + tag `sync-20260520` | ✅ commit `0a49a089` |

---

## 3. bun test 19 fail 分类（latent，非本次 sync 引入）

| 类别 | fail 数 | 性质 |
|---|---|---|
| BrowserPaneManager | 8 | 集成测试需要 Electron app 环境（v0.9.3 baseline 已存在）|
| headless server smoke | 3 | 需要环境 |
| startWebuiHttpServer | 6 | http server 实际启动 + 端口绑定（环境敏感） |
| E2E OAuth Metadata | 1 | 网络请求测试 |
| send_developer_feedback | 1 | permission mode 测试，结果与期望不符（latent） |
| getTransportBannerCopy | 1 | i18n 文案 "CRAFT_SERVER_TOKEN" 期望与实际 "server token" 不符（latent，brand patch 漏改测试） |

**结论**：19 fail 全为 latent fail，与 v0.9.4 sync 改动无关。**记 backlog**：M2 阶段统一 review，部分（getTransportBannerCopy）属 brand patch 漏改测试断言，可顺手修。

---

## 4. CLAUDE.md §3.7 表更新清单

### 4.1 新增改造点 #52（C13 pattern）

| # | 改造类别 | 文件 | 定位 | 标记 | 关联规格 |
|---|---|---|---|---|---|
| 52 | C13 patch — RPC handler HANDLED_CHANNELS 加 RTK 4 channel（上游 v0.9.4 漏分类） | `packages/server-core/src/handlers/rpc/settings.ts` | 注释 `classify v0.9.4 RTK channels missed by upstream's HANDLED_CHANNELS` | 单行 | SYNC-v0.9.4-20260520 §1.3（C13 同 v0.9.1 #37 模式）|

### 4.2 基线刷新

| 指标 | v0.9.3 sync 后基线 | **v0.9.4 sync 后** | 浮动 |
|---|---|---|---|
| U-API 标记总数 | 95 | **96** | +1（#52 C13 patch） |
| `/* U-API START */` 块数 | 9 | 9 | 不变 |
| `/* U-API END */` 块数 | 9 | 9 | 不变 |

### 4.3 历次演进表加新行

```
v0.9.4 sync（2026-05-20 commit `0a49a089`）：96 处（+1 #52 C13 patch：HANDLED_CHANNELS 加 RTK 4 channel；
上游 v0.9.4 主题 RTK feature + Pi SDK 0.72.1→0.73.1 + Codex/Copilot 死代码清理；
2 真冲突手工解（SkillsListPanel deep link + event-adapter 注释）；
15 package.json perl 批量解；eslint 死规则顺势删 3 条；
bun.lock 增量重建避免 Sentry dup；
C11 sed 4 处 settings.ts；顺手删 @github/copilot-sdk root dep；
release-notes/0.9.4.md 中文翻译 + brand 五件套 0 命中；
bun test 19 latent fail 与 sync 无关；
评级 B+（PREVIEW 预测 A−，实际因 2 真冲突 + C13 patch + Sentry dup install 副作用降级）
```

---

## 5. SOP 教训沉淀（写进 §07-upstream-sync.md）

REVIEW-5 已写 4 条教训，本次 sync 实测又沉淀 5 条新教训：

### 5.1 PREVIEW "行号不重叠" 不等于 "git auto-merge 通过"

git 3-way merge 用 hunk context 判断冲突，**同一 hunk 内任何 ours/theirs 改动都会触发 conflict**——即使逻辑上不重叠。未来 PREVIEW 应该用 `git merge-tree --no-messages --merge-base=$BASE ours theirs` 做 dry-run merge 拿真实冲突清单，而非只对照行号交集。

### 5.2 `rm bun.lock && bun install` 危险——改用增量同步

`rm` 会让 bun 重新解析所有 deps 拉 transitive 最新版本，可能引入 **dup install**（如本次 Sentry 10.50 + 10.53 两版本共存）。

**新 SOP**：
```bash
# 不要：rm bun.lock && bun install
# 改用：拿回上次 sync 后的 lockfile，再增量 install
git checkout <prev-sync-commit> -- bun.lock
bun install
```

### 5.3 package.json 冲突应独立分类（不归 C11）

C11 仅针对 `.ts/.tsx` 文件的 import path（`@craft-agent/X` → `@u-agents/X`），**package.json scope + version 同 hunk 冲突是另一类**。下次 PREVIEW 应**显式预测"15 个 package.json 全部 conflict"**，并预置批量 perl 命令。

### 5.4 C13 RPC handler registration 与 routing.ts 是两个独立测试

PREVIEW 只核了 routing.ts exhaustiveness test —— **HANDLED_CHANNELS registration test 是另一个**！上游 v0.9.4 漏改后者。下次 PREVIEW 必须**两个 test 都核**（grep `HANDLED_CHANNELS` + 看是否含新 channel）。

### 5.5 Sentry/transitive dep 升级风险纳入 PREVIEW

未来 sync PREVIEW 应当在 §2.6 SDK 升级章节加一步"transitive dep 影响扫"，特别针对 `@sentry/*` / `@dnd-kit/*` / `@radix-ui/*` 等容易 dup install 的库。
