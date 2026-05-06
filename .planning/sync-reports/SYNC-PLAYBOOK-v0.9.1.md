# v0.9.1 同步执行 Playbook（单页应急手册）

> **目的**：user 真要跑 `git merge upstream/main` 时，一边看一边做。
> **不替代** [`07-upstream-sync.md`](../07-upstream-sync.md) 主 SOP，是它的"快速参考卡"。
>
> **基线**：当前 HEAD = `fc22763f`（Wave 4.6 收尾）；上游 HEAD = `b31904c6`（v0.9.1）；merge-base = `acb08842` (v0.9.0)。

---

## 0. 同步前 5 项最终核查（同 shell，2 分钟）

```bash
cd /Users/dengwang/Documents/u-agents-oss/u-agents

# 1. 基线健康
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望 61

grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l
# 期望各 8

# 2. git status 干净
git status --short
# 期望仅 ?? .claude/（worktree 元数据）

# 3. 上游领先数（同步触发）
git fetch upstream
git log upstream/main ^HEAD --oneline | wc -l
# 期望 1（v0.9.1 的 release commit）

# 4. 设 DATE 变量（**全程同 shell session**）
DATE=$(date +%Y%m%d)
echo "$DATE"

# 5. 查 v0.9.1 主 feature 落地处（确认上游真改）
git diff $(git merge-base HEAD upstream/main)..upstream/main --stat \
  -- packages/shared/src/config/llm-connections.ts \
     packages/shared/src/agent/backend/pi/event-adapter.ts \
     scripts/sort-locales.ts
# 期望 3 行输出，每行 "+ N insertions"
```

---

## 1. Dry-run 已知数据（v15 静态分析）

| 维度 | 数字 |
|---|---|
| 上游 v0.9.1 改 | **115 文件 / +9724 -960 行** |
| 我们 fork 改造 | ~611 文件（含 §3.7 主表 36 项 + B1/B2）|
| **双方都改的文件**（真冲突候选）| **58** |
| 自动合并 OK 预估 | **~52 / 58**（双方改不同行/不同函数）|
| **必手解** | **`AiSettingsPage.tsx`**（ConnectionRow signature 双方同行加新参数）|

**zh-Hans.json 字典序漂移 = 78 行**——v0.9.1 lint:i18n:sorted hook 会阻塞 merge commit；必跑 `bun run sort-locales` 修复。

---

## 2. 执行 merge（5 分钟）

```bash
git checkout -b sync/upstream-$DATE   # 同步分支
git merge upstream/main               # 撞冲突是预期的
```

---

## 3. 冲突分类处理（核心）

### Tier 1 — 自动 3-way merge 通过（预估 ~52 文件）

跑完 `git merge` 后看 `git status`，**没列入冲突的就是 Tier 1**。代表：
- 14 × `package.json`：双方改不同字段（我们 name/bin，上游 deps version）
- 7 × `i18n/locales/*.json`：双方改不同 key
- `pi-agent.ts` / `event-adapter.ts` / `large-response.ts` / `mcp/client.ts`：上游改 / 我们没改
- `connection-setup-logic.ts`：v0.9.1 +2 行 / 我们 §3.7 #5/#6 不同函数
- `claude-agent.ts` / `claude-context.ts`：上游 +1/-28 行 / 我们没改

**应对**：什么都不做，git 自动处理。

### Tier 2 — 简单手解（预估 ~5 文件）

| 文件 | 双方位置 | 处理 |
|---|---|---|
| `pi-agent-server/src/index.ts` | 我们 L1120 (lint 修) / 上游别处 | 都保留即可 |
| `messaging-gateway/src/*` (5-6 文件) | 我们改 cli rename 副产物 / 上游改 Telegram access control | 接受上游为基底，确认我们的非 break 改动仍在 |
| 其他 | 双方改不同段落 | 编辑器看 conflict marker 选两边都留 |

### Tier 3 — **AiSettingsPage.tsx 必撞冲突**（**P0 主战场**）

**精确冲突点**：
- `ConnectionRowProps` interface（L179-182）：上游 +1 行 `onSetMidStreamBehavior?: ...` 字段
- `ConnectionRow({ ... })` 函数签名（L189-191）：上游 +1 参数 `onSetMidStreamBehavior`
- `<ConnectionRow ... />` 调用点（L988+）：上游加 `onSetMidStreamBehavior={handleSetMidStreamBehavior}` prop
- `handleSetMidStreamBehavior` 新函数（L840-867）：上游纯新增 ~30 行

**我们改造点位置**（§3.7 #19-#25）：
- 同 ConnectionRow 函数签名 / 同函数体内（不同子段）
- `getApiKeyMethodForConnection` `uApiConnections` 新加（L560-569）
- `defaultConn = uApiConnections.find(...)` 替换（L683+）
- `<ConnectionRow ... isUApiConnection={...}>` 加 prop

**6+1 步手解 cheatsheet**：

```bash
# 1. 用上游版做基底（覆盖我们当前内容；上游必有 v0.9.1 +55 行 midStream 逻辑）
git checkout --theirs apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 2. 看我们 merge 前的版本，找 §3.7 #19-#25 标记
git show HEAD:apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx | grep -nE "U-API:|isUApiSlug|isUApiConnection|getApiKeyMethodForConnection|uApiConnections|always show Default Connection|last U-API connection cannot be deleted|restore Add Connection button" | head -25
# 期望 11+ 行输出，复制到剪贴板做对照

# 3. 编辑器打开当前（上游版）的 AiSettingsPage.tsx，对照剪贴板逐项重贴
# 关键插入点（grep 当前文件定位）：
grep -n "ConnectionRow({ connection\|ConnectionRowProps\|defaultConn = \|hasUApi\|first install\|last connection" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 4. 重贴 §3.7 #19-#25 全部 marker 后核对
grep -c "U-API" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx
# 期望 ≥ 11（5 处单行 + 1 处块内多行 + 2 处块）

# 5. 标记冲突已解决
git add apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 6. (合所有冲突后) 跑全仓 baseline 验证 §3.7
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望 61 ± 5（merge 当下浮动允许 ±5；后续 follow-up commit 应回到 ±2）

# 7. (v0.9.1+) 验证 mid-stream 类型完整进入（08 §9 哨兵）
grep -nE "MidStreamBehavior|defaultMidStreamBehavior|resolveMidStreamBehavior" packages/shared/src/config/llm-connections.ts | wc -l
# 期望 ≥ 5；为 0 = 漏 124 行 abort merge 重做
```

---

## 4. 完成所有冲突 → lint + build 链路（10 分钟）

```bash
# 4.1 装依赖（让 v0.9.1 拉来 sort-locales script + 触发 husky prepare）
bun install

# 4.2 (v0.9.1+) locale 字典序检查 — **必跑**（zh-Hans 有 78 行漂移）
bun run lint:i18n:sorted
# 失败必走：
bun run sort-locales
git add packages/shared/src/i18n/locales/*.json
bun run lint:i18n:sorted   # 应静默退出

# 4.3 (v0.9.1+ Pi SDK 0.72.1) 必跑：重 build pi-agent-server
bun run server:build:subprocess
# 不跑 = packaged 应用 spawn 时新 koffi binding + 老 JS 不兼容 = LLM silent fail

# 4.4 typecheck + lint + test
bun run typecheck:all                  # 任何报错必修
bun run lint:i18n:parity
bun run lint:electron
bun run lint:shared
bun run lint:ui
cd packages/shared && bun test 2>&1 | tail -5
# 期望 baseline 12 stable + 1-2 OAuth flaky（详见 07 §2.7c C9）
cd ../..
```

---

## 5. C 类踩坑核对（07 §2.7c C1-C10，5 分钟）

```bash
# 重点跑 C10（v0.9.1 引入的新坑）
git diff $(git merge-base HEAD upstream/main)..upstream/main \
  -- packages/shared/src/config/llm-connections.ts \
  | grep -E "^\+\s+\w+\?:" | head
# 应见 + midStreamBehavior?: MidStreamBehavior

# 核对我们 enforceUApiBaseUrl 是否透传新字段
sed -n '/function enforceUApiBaseUrl/,/^function\|^const/p' \
  packages/shared/src/config/storage.ts \
  | grep -E "name:|baseUrl:|authType:|providerType:|models:|midStreamBehavior:"
# 我们模板默认不写 midStreamBehavior 字段（02 §6.2.4 策略），但用户改了的应保留
# 详见 07 §2.7c C10
```

---

## 6. 提交 + tag

```bash
git commit -m "sync: merge upstream/main as of $DATE (v0.9.1)"

# 同 shell！否则 $DATE 失效
git tag sync-$DATE
```

---

## 7. 应急决策表

| 场景 | 命令 |
|---|---|
| **想完全放弃这次 merge** | `git merge --abort` |
| **merge commit 已建但发现错** | `git reset --hard ORIG_HEAD` |
| **AiSettingsPage 手解搞坏了想从头来** | `git checkout HEAD -- apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`（回到我们 pre-merge 版）→ 重跑 §3 Tier 3 cheatsheet |
| **lint:i18n:sorted 阻塞 commit 但你急着保留进度** | **绝不**用 `--no-verify`。跑 `bun run sort-locales` + `git add` 再 commit |
| **typecheck:all 报奇怪错（找不到符号）** | 多半是 §3.7 改造点漏贴回。`grep -rEn "U-API" packages apps --include="*.ts" --include="*.tsx"` 确认 61，缺的 grep `git log -p HEAD~1 -- <file>` 找回 |
| **bun.lock 冲突** | 取上游 lockfile + 重 install：`git checkout --theirs bun.lock && bun install` |
| **应用启动后首条 LLM 消息 silent fail** | `bun run server:build:subprocess` 后重新打包，详见 [`12-subprocess-build-pipeline.md`](../12-subprocess-build-pipeline.md) §0.3-0.4 |

---

## 8. 同步成功标志

✅ 全部满足才算 done：
- [ ] `git status` 干净
- [ ] `git log --oneline -2` 最上是 merge commit "sync: merge upstream/main as of YYYYMMDD (v0.9.1)"
- [ ] `git tag --list "sync-*" | tail -1` 含本次 tag
- [ ] U-API 主基线 = 61 ± 2（merge 当下允许 ±5）
- [ ] `/* U-API START/END */` 配对仍 8/8
- [ ] `bun run typecheck:all` exit 0
- [ ] `bun run lint:i18n:sorted` exit 0
- [ ] `bun run lint:i18n:parity` 7 locale 全过
- [ ] `cd packages/shared && bun test 2>&1 | tail -5` 显 12 stable + 1-2 OAuth flaky（baseline 不变）
- [ ] `grep -nE "MidStreamBehavior|defaultMidStreamBehavior|resolveMidStreamBehavior" packages/shared/src/config/llm-connections.ts | wc -l` ≥ 5
- [ ] `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` 含 `// U-API:` 计数 ≥ 11
- [ ] (可选) 装包跑 `bun run dist:mac` + `dist:win`（Pi SDK 0.72.1 子进程实测）

---

## 9. 同步后立即写 .planning/sync-reports/SYNC-v0.9.1-YYYYMMDD.md

至少含：
1. merge commit hash
2. 实际撞了几个冲突文件（与本 playbook §1 dry-run 对比）
3. AiSettingsPage 手解最终 marker 数
4. baseline 同步后真实数字
5. C1-C10 触发情况（按 07 §2.7c）
6. 任何"playbook 没说但实际撞到"的事——这些是 v15+ 的 SOP 改进素材

---

**Playbook 总耗时预估**：30-60 分钟（看 AiSettingsPage 手解多快）

**Wave 5 就绪度**：**100%**（所有可预见风险有应对、所有 SOP 缺陷已修、应急路径完整）

**唯一无法预先消除的风险**：上游 v0.9.1 引入的潜在 bug（其他 fork 还没踩到）—— 这是上游 release 的天然风险，跑完一次本 playbook 后再决定要不要追下一个 v0.9.2。
