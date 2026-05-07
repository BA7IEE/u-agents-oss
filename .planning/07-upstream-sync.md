# 07 — 上游同步 SOP

> **本文是给"用户/外部 AI"的执行手册**——本仓库 AI 不执行这些命令（详见 `CLAUDE.md` §0），只产出/维护本文。
> 与 `08-conflict-zones.md` 配套：08 写"哪些文件危险"，本文写"什么时候同步、怎么同步"。

---

## 1. 上游观察节奏

### 1.1 上游仓库

- URL: `https://github.com/lukilabs/craft-agents-oss`
- 主分支: `main`
- 我们的 git remote: `upstream`（已配置）

### 1.0 ⚠️ 关键事实：上游是 **release-only squash 仓库**

- 上游 git log 只有**寥寥几个 commit**（每个对应一个 release，如 `v0.9.0`）
- 上游团队在**私有仓库**开发，定期把多次迭代 squash 后**单 commit 推送**到公开 OSS 仓库
- **后果**：无法做以下操作（之前文档暗含的假设）：
  - ❌ 逐 commit review 上游变更
  - ❌ Cherry-pick 单个安全修复
  - ❌ 看上游 git log 推断改动意图
  - ❌ 通过 `git blame` 找哪一行是新加的
- ✅ **唯一可做的**：等上游打新 release tag → 整批 merge → 通过 release notes / GitHub release 页面理解变化范围

**这彻底改变同步策略**：不能"小步同步"，只能"按 release 整批同步"。M1 fork 时是 v0.9.0；M2/M3 阶段同步时按上游打的下一个 tag（v0.10.0 / v1.0.0 等）整批合入。

### 1.2 看什么

每 2 周看一次（推荐周一）：

1. **Release 页面** — `https://github.com/lukilabs/craft-agents-oss/releases`
   - 看是否有新版本号
   - 读 release notes，识别 breaking changes
2. **Commits 页面** — `https://github.com/lukilabs/craft-agents-oss/commits/main`
   - 看主分支自上次同步以来的 commit 数
   - 标题里出现的关键词：`provider`、`onboarding`、`branding`、`auto-update`、`security` 必须重点 review
3. **CHANGELOG**（如果有）

### 1.3 决策矩阵

| 上游变化 | 是否同步 | 紧急度 |
|---|---|---|
| 安全修复 | ✅ 必须 | 立即（24-48h 内）|
| Major version（如 0.x → 1.0）| ✅ 必须 | 高（评估并安排 1-2 周内）|
| Minor version | ✅ 必须 | 中（月度同步覆盖）|
| Patch（仅 bugfix） | 可选 | 低（按需）|
| 仅 i18n / 文档 | 可选 | 低（按需）|
| 新 LLM provider 接入 | ⚠️ 同步代码，但**不暴露** UI | 中（按 `04-feature-cuts.md` 裁剪）|

---

## 2. 月度同步标准流程

### 2.1 同步前准备（30 分钟）

```bash
# 1. 确保本地工作区干净
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git status
# 应无 untracked 与 unstaged 修改；如有，stash 或 commit 完再继续

# 2. 当前分支应在 main（U Agents 主分支）且最新
git checkout main
git remote -v                       # 确认 origin 指向你的私有 fork
git pull --ff-only origin main      # --ff-only 防止意外 merge commit

# 3. 抓取上游最新
git fetch upstream

# 4. 看一下要合哪个上游 release/tag
# 上游采用 release-only squash 合并，不能依赖逐 commit review；优先比较 tag / release note / diffstat
git tag --list | tail -20
git log --oneline main..upstream/main | head -10
git diff --stat main..upstream/main
```

如果跨多个上游 release，建议按 release tag 分批同步，而不是按 commit 数拆批。上游 squash 后一个 commit 可能包含大量改动，`git log | wc -l` 不能代表风险。

### 2.2 创建同步分支

```bash
DATE=$(date +%Y%m%d)
git checkout -b sync/upstream-$DATE
```

> ⚠️ **`$DATE` 是 shell 局部变量**——必须**全程在同一个 shell session 里执行**后续命令（§2.4.5 `git commit`、§2.8 `git tag sync-$DATE` 都用 `$DATE`）。开新 terminal / 新 SSH session 后 `$DATE` 会失效，会推空 tag `sync-`。
> 替代方案：直接用 inline `git tag sync-$(date +%Y%m%d)`。

### 2.3 执行 merge

```bash
git merge upstream/main
```

**预期会有冲突**——这是正常的。冲突后会进入"待解决"状态，`git status` 会列出冲突文件。

### 2.4 解决冲突（核心环节）

按以下顺序处理，参考 `08-conflict-zones.md`：

#### 2.4.1 先看冲突文件分类

```bash
git diff --name-only --diff-filter=U
```

把输出按 `08-conflict-zones.md` 的 🔴/🟡/🟢 分类。

#### 2.4.2 处理 🟢 依赖密集

```bash
# bun.lock 永远用上游版本
git checkout --theirs bun.lock

# package.json 类（v0.9.2 sync 实战标准做法）：
# 上游每次 release 都 bump 全部 14+ 个 package.json 的 version，与我们的 NPM scope rename
# (@craft-agent/ → @u-agents/) + private:true 在同一文件同一行交叉，git auto-merge 处理不了。
# 标准做法：take ours（保留我们的 scope + private + description），sed 批量 bump version：

OLD_VER="0.9.1"  # 上次 sync 时的版本
NEW_VER="0.9.2"  # 上游本次 release 的版本

# 1. take ours 全部 conflicted package.json
for f in $(git diff --name-only --diff-filter=U | grep package.json); do
  git checkout --ours "$f"
done

# 2. sed 批量 bump version（macOS 用 -i ''；Linux 用 -i）
for f in $(git diff --name-only --diff-filter=U HEAD | grep package.json) \
         $(find . -name 'package.json' -not -path '*/node_modules/*' -maxdepth 4); do
  sed -i '' "s/\"version\": \"${OLD_VER}\"/\"version\": \"${NEW_VER}\"/" "$f"
done

# 3. （可选但推荐）手动 review 上游有没有加新 dependency
git diff upstream/main -- package.json | grep -E '^\+\s+"' | head -10

# 4. git add 全部
git add $(find . -name 'package.json' -not -path '*/node_modules/*' -maxdepth 4)
```

#### 2.4.3 处理 🔴 核心锁定

逐个处理，**绝不**用 `git checkout --theirs` 全取上游：

| 文件 | 推荐策略 |
|---|---|
| `apps/electron/electron-builder.yml` | 取上游为基础，再手动改回我们的 7 个字段（含 `copyright`） |
| `packages/shared/src/branding.ts` | 同上：取上游 + 改回 VIEWER_URL + 替换 ASCII art |
| `packages/shared/src/config/llm-connections.ts` | 取上游（我们没改这个文件），但 review 看是否有新 ProviderType；v0.9.1 同步**注意 +124 行 mid-stream 类型必须完整进入**（详见 [`08-conflict-zones.md` §9](08-conflict-zones.md) 哨兵） |
| `packages/shared/src/config/provider-metadata.ts` | 手动合并：保留 'u-api' entry + getProviderMetadata 修改 |
| `apps/electron/src/renderer/components/onboarding/*` | 逐文件手动合并 |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 最痛苦的一个：保留我们的 `mode === 'u_api'` 分支，接受上游对其他分支的修改 |
| **`apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`** | **v0.9.1+ 新增手解主战场**——见下方 6 步 cheatsheet |

**AiSettingsPage.tsx 6 步手解 cheatsheet**（v0.9.1 同步专用，§3.7 #19-#25 涉及 11+ 处 marker）：

```bash
# 1. 确认冲突
git status   # 应见 both modified: apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 2. 用上游版做基底（覆盖我们当前内容）—— 上游必有逻辑变更，从我们版挑出比从上游版贴回我们的 marker 容易
git checkout --theirs apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 3. 在编辑器里手动重新插入 §3.7 #19-#25 标记（共 11+ 处实例）
#    用 grep 定位插入点（symbol 名稳定，行号会漂）：
grep -n "isUApiSlug\|isUApiConnection\|getApiKeyMethodForConnection\|uApiConnections\|always show Default Connection\|last U-API connection cannot be deleted\|restore Add Connection button" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx
#    参考 CLAUDE.md §3.7 表 #19-#25 列举的注释/单行标记/块标记位置

# 4. 加完 marker 后 grep 总数验证
grep -c "U-API" apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx
# 期望 ≥ 11 处实例（19=1, 20=5, 21=1, 22=1, 23=1块, 24=1, 25=1块）

# 5. 标记冲突已解决
git add apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx

# 6. 跑全仓 baseline 验证 §3.7（merge 完所有冲突后再跑）
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望 82 ± 2（v24 全 Bucket A+B+C 后基线，详见 CLAUDE.md §3.7；merge commit 当下浮动允许扩到 ±5，第一个 follow-up commit 后回到 ±2）

# 7. (v0.9.1+) 验证 mid-stream 类型完整进入（08 §9 哨兵）
grep -nE "MidStreamBehavior|defaultMidStreamBehavior|resolveMidStreamBehavior" packages/shared/src/config/llm-connections.ts | wc -l
# 期望 ≥ 5（type 定义 + 2 函数 + 引用点）
# 若为 0：merge 漏掉 v0.9.1 +124 行 mid-stream 类型，必须 abort merge 重做
```

**为何用 `git checkout --theirs`（v12/v13 "用上游做基底"建议的具体命令）**：上游必有 v0.9.1 引入的 +58 行 midStream 子菜单 + onSetMidStreamBehavior prop —— 从我们版本挑出上游变更非常困难，反向更简单。但 `--theirs` 会**全吞**我们的 25+ 行 marker，**必须**手动从 git history 回贴（参考点：`git show :2:apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx` 看 merge 时我们的版本，或 `git log -p HEAD -- <file>`）。

#### 2.4.4 处理 🟡 品牌密集

```bash
# 1. 取上游版本
git checkout --theirs <file>
# 2. 跑品牌替换（依据 01-branding-spec.md §8 命令）
# 3. 手动改对应 §2-§7 列出的具体行
```

#### 2.4.5 标记冲突解决

```bash
git add <已解决的文件>
git status  # 直到所有 unmerged paths 清空
git commit -m "sync: merge upstream/main as of YYYY-MM-DD"
```

### 2.5 解决"应冲突而未冲突"的隐患

参照 `08-conflict-zones.md` §"应当冲突而没冲突的危险信号"。这是同步的最大坑——git 觉得没冲突，但实际我们的锁定被绕过了。

#### 2.5.0 前置硬校验（必跑 0 残留，不达标 typecheck 必 fail）

v24 H1.F3 实战教训（v0.9.2 sync `sendmessage-oauth-refresh.test.ts` typecheck fail 才发现）——**先跑这两条 grep，命中 = 立即 batch sed 修，再跑 typecheck**：

```bash
# 硬校验 1：@craft-agent/ NPM scope 0 残留（C11 模式）
N=$(grep -rE '"@craft-agent/|from .@craft-agent/' packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | grep -v node_modules | wc -l)
echo "@craft-agent/ 残留数：$N（期望 0）"
# 命中：batch sed rename
[ "$N" -gt 0 ] && grep -rlE '"@craft-agent/|from .@craft-agent/' packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | grep -v node_modules | xargs sed -i '' 's|@craft-agent/|@u-agents/|g'

# 硬校验 2：上游 release commit 自身的 brand 注释漏盘（v17 + v24 模式）
# v0.9.1 漏 messaging access-control 文案 / v0.9.2 漏 pi-agent-server/index.ts 注释
git show upstream/main --unified=0 -- '*.ts' '*.tsx' | grep -E '^\+.*(Craft|craft\.do)' | grep -v node_modules
# 命中：逐处审视——是 brand leak（要改）还是真接口名（按 §1.4 决策保留）

# 硬校验 3（可选）：v0.9.1 mid-stream 类型完整性
grep -nE "MidStreamBehavior|defaultMidStreamBehavior|resolveMidStreamBehavior" packages/shared/src/config/llm-connections.ts | wc -l
# 期望 ≥ 5；< 5 = 上游版本回退或 merge 漏字段
```

#### 2.5.1 完整扫描（在前置硬校验通过后跑）

```bash
# 1. 检查是否引入新的 LlmProviderType
# 直接看 LlmProviderType union 定义（行内不含 'ProviderType' 字面量，下面命令两步走更稳）
grep -nB1 -A20 "type LlmProviderType" packages/shared/src/config/llm-connections.ts
# 输出含整段 union（'anthropic' | 'pi' | 'pi_compat' | ...）
# 把输出和上次同步时记下的 type 列表对比；多出来的 entry = 上游新加

# 2. 检查是否引入新的 OnboardingStep
grep -nE "^\s*\| '" apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx | grep -i Step

# 3. 跑品牌验收命令
# (来自 01-branding-spec.md §8)
grep -rEn "Craft Agents?" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.html" \
  | grep -v node_modules | grep -v __tests__ | grep -v "TRADEMARK.md" | grep -v "NOTICE"

grep -rEn "craft\.do" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.sh" --include="*.ps1" \
  | grep -v node_modules | grep -v __tests__ | grep -v "url-validator.ts" | grep -v "oauth-relay.ts" | grep -v "slack-oauth.ts"

grep -rE '"@craft-agent/' --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" | grep -v node_modules | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v ".planning"

grep -rE 'com\.lukilabs' . | grep -v node_modules

# 3b. Round 45 后新增：Markdown / 可复制示例 / server 模板也要扫
rg -n "Craft Agents?|Craft-Agents-|craftagents://|\.craft-agent|@craft-agent/|agents\.craft\.do|docs\.craft\.do|craft-server|craft-data|/root/\.craft-agent" README.md docs packages apps scripts/build-server.ts --glob '*.md' --glob '*.ts' \
  | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v "LEGAL.md" | grep -v ".planning"
# README/CLI/package README/server 生成模板若属于 M1 不发布范围，必须在同步报告里标注；若会发布，必须改为 U Agents / U-API。

# 4. 检查上游是否新增 storage migration 函数（可能没排除 pi_compat 而误伤 U-API）
grep -nE "^function migrate|^export function migrate" packages/shared/src/config/storage.ts
# 把输出和上次同步时记下的 migration 函数列表对比；新增项必须 review：
#   - 新 migrate 函数是否含 if (connection.providerType !== 'anthropic') continue 类的 pi_compat 跳过判断？
#   - 若没有，必须加判断，否则我们的 u-api-default 连接会被误改 models / defaultModel 等字段

# 5. 检查上游是否新增 saveLlmConnection IPC 调用点（可能绕过 setupLlmConnection 锁定）
grep -rEn "electronAPI.saveLlmConnection|llmConnections\.SAVE" apps/electron/src --include="*.ts" --include="*.tsx" \
  | grep -v __tests__
# 已知 2 处（AiSettingsPage:715 rename + :857 change defaultModel）—— 新增的必须 review：
#   - 新调用点是否会改 baseUrl / providerType / customEndpoint 等锁定字段？
#   - 若会，要么改为 setupLlmConnection 调用，要么 enforceUApiBaseUrl 仍能兜底（详见 03 §2.2）

# 6. 检查上游 state.ts keyless 路径是否仍有效
grep -nE "if \(!apiKey && connection.baseUrl\)" packages/shared/src/auth/state.ts
# 若上游改了 keyless 判断的实现方式（如改成基于 providerType），我们的 isUApi 特判（详见 02 §4.1）需要同步迁移

# 7. 检查上游 validateSetupTestInput 函数签名是否变化
grep -nA15 "^export function validateSetupTestInput" packages/server-core/src/domain/connection-setup-logic.ts
# 我们扩展了它接受 customEndpoint（详见 02 §4.2）；上游若改了签名或新增校验逻辑，我们的扩展可能需要重新合并

# 8. 检查上游 ModelRefreshService 对 pi_compat 处理是否仍 skip
grep -nA3 "if \(isCompatProvider" packages/server-core/src/model-fetchers/index.ts
# 应仍能找到 "if (isCompatProvider(connection.providerType)) return"。若上游改成对 pi_compat 也拉模型，会让 U-API 用户看到自动拉的模型清单覆盖手动添加的——需要评估

# 9. 检查 U-API 改造标记完整性（防止 git auto-merge 吞掉我们的改造）
# **必须使用全格式 grep**——旧版 `// U-API:|/\* U-API (START|END)` 漏 HTML 注释（<!-- -->）+
# JSX 行内注释（{/* */}），同步时会假报数低（v9/v10 review 期间 REVIEW-3 修正过的"基线 47 而非 44"
# 就是这个根因）。CLAUDE.md §3.7 已改全格式，本节同步对齐。
echo "U-API 改造标记总数（期望 82，允许 ±2 浮动；超出范围必须停下逐项核对；v24 全 Bucket A+B+C 后基线，详见 CLAUDE.md §3.7 历次基线演进表）:"
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l

echo "U-API START/END 配对数（必须相等且 = 9）:"
grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l
grep -rE --exclude-dir=node_modules "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | wc -l

echo "Build 脚本 marker（B1-B7 build-* + scripts/ stub + M3-Sentry，期望 ≥13；M3-SSRF 后实测 20）:"
grep -rEn "U-API" apps/electron/scripts/ scripts/ 2>/dev/null | grep -v node_modules | wc -l
# 详见 CLAUDE.md §3.7 "代码改造点统一加 // U-API: 标记" + Build 脚本子表（B1-B7）

# 10. 检查 ConfigWatcher handleConfigChange 是否仍只调 loadStoredConfig（防自触发死循环）
echo "ConfigWatcher handleConfigChange 函数体应仅调 loadStoredConfig，不应出现 migrate* 调用:"
sed -n '/private handleConfigChange/,/^  }/p' packages/shared/src/config/watcher.ts | grep -E "migrateLegacy|migrate"
# 上面 grep 应返回**0 行**——若有命中说明上游改了 watcher 行为，可能让 enforceUApiBaseUrl 陷入死循环

# 11. 检查 RPC_CHANNELS 关键 entries 字符串值是否稳定（破坏性变更检测）
echo "我们引用的关键 RPC_CHANNELS 字符串:"
grep -nE "settings:setupLlmConnection|settings:testLlmConnectionSetup" packages/shared/src/protocol/channels.ts
# 上面应仍能找到原值；若上游改了字符串，我们的 IPC 引用会断（但 TypeScript 编译会 fail-fast 提示）

# 12. 检查 ESLint 自定义规则是否新增（M2+ 阶段）
echo "ESLint 自定义规则:"
ls packages/shared/eslint-rules/ 2>/dev/null
# 当前 2 条（no-direct-open-import / no-inline-source-auth-check），新增项需 review 是否影响我们改造
```

任何**非空**或**与上次记录不一致**的输出都需要 review + 决定是否修复。

### 2.5b 翻译上游 release notes 为中文（**v0.9.1 sync 后机制化为月度 SOP**）

> **背景**：`apps/electron/resources/release-notes/{version}.md` 是上游用英文写的、随 packaged app 出现在用户"关于"对话框/版本历史里的用户向文案。每次上游同步必带新 release note 文件，**用户**（中文桌面用户）打开看到一堆英文 + GitHub issue 链接 + commit hash + craft 字面量——直接破坏白标。

**SOP**：每次同步含新 release notes 文件，必须翻译成中文。**绝不**直接接受上游英文版进发版包。

**翻译要求**（4 项硬规则）：
1. **翻译为中文**——按用户向语气，不是逐字硬翻；技术细节大幅简化（内部状态机名 / helper 函数 / 内部代码引用对用户无意义，删或重写）
2. **删除所有外部链接**：
   - GitHub issue / PR 引用（如 `(#672)` `[#697](https://github.com/...)` 等全删）
   - Commit hash（如 `(`fd68c070`, `bd575ed1`)` 全删）
   - 内部代码路径（如 `apps/online-docs/source-guides/google-oauth-setup.mdx`，改写为"OAuth 配置文档"）
3. **品牌替换**：
   - `Custom-endpoint` / `pi_compat` connections → "U-API（自定义端点）"（首次出现完整说明）
   - `Craft's <symbol>` 等 → 整段改写为用户向描述（不暴露品牌）
   - `CraftMcpClient` 等内部类名 → "MCP 客户端"
   - `agents.craft.do` / 上游域名 → 整段简化或删（首次出现可改为占位 URL）
4. **保留**：
   - UI 路径（如 `Settings → Messaging → Telegram`）—— 这是用户在 UI 里能看到的
   - 版本号（`Pi SDK 0.72.1`）
   - 贡献者命令（`bun run sort-locales`）—— 用户会用到

**核对手段**：
```bash
# 翻译完跑下面三组 grep，全部应 = 0 命中
FILE=apps/electron/resources/release-notes/{version}.md

# 1. 残留链接？
grep -nE "https?://|github\.com|\(#[0-9]+\)" "$FILE"

# 2. 残留 commit hash？
grep -nE "\`[a-f0-9]{7,10}\`" "$FILE"

# 3. craft / lukilabs 字样残留？
grep -niE "craft|lukilabs|agents\.craft" "$FILE"
```

**历次执行**：
- v0.9.1 sync（2026-05-06 commit `5a87e9e1` 后）：原文 56 行 → 译文 59 行；删 9 处 GitHub URL + 13 处 commit hash + 5 处 craft 字面量；语义通顺重组（如 5 行 mid-stream 段重组为 2 段 + 列表）。
- **v0.9.2 sync（2026-05-07）：本次 sync 漏翻译，v26 review 时用户发现并要求补译。**经验教训：
  - 漏盘根因：v0.9.2 sync commit `a76e502d` 中只对 `0.9.2.md` 做了 brand 替换（"Pi backend silently dropped the **Craft** system prompt" → "the system prompt"、`@craft-agent/core` → `@u-agents/core`），**忘了整体翻译为中文**——这是历史 release-notes 完全中文风格的硬要求，brand 替换 ≠ 翻译。
  - 第二次错误：v26 补译时第一版机翻味重（"迟到的 refresh 恢复状态前"、"盖写**三个** SDK 私有字段"等英文句式直译），且**违反 SOP 第 2 项**保留了 5 处 `(#xxx)` issue 引用 + 7 处 commit hash + 1 处 `github.com/openclaw` URL——用户再次质疑后才完全按 SOP 重做。
  - **本节 SOP 强化**：从此 sync 后必跑核对手段 3 组 grep（见上方代码块），**0 命中才算翻译合格**；翻译动作不能简化为"brand 替换"，必须**完整中文化**——参考既有 0.9.0 / 0.9.1 / 0.8.13 风格。
  - 文件最终状态（2026-05-07 v26 后）：32 行；删 5 处 `(#xxx)` + 7 处 commit hash + 1 处 OpenClaw URL + 1 处 OpenClaw 完整链接（保留"社区项目 OpenClaw 同名实现"提名）；6 项缺陷修复 + 1 项改进 + 备注 2 条全部按 0.9.1 短句口语化风格重写。

### 2.6 跑构建与 typecheck

```bash
# 0. 重新装依赖（让 v0.9.1 新 scripts 如 sort-locales 出现，并触发 husky prepare）
bun install

# 0a. (v0.9.1+) 必跑：locale 字典序检查
# v0.9.1 引入 lint:i18n:sorted hook，merge 时若 zh-Hans.json 不字典序会阻塞 commit
bun run lint:i18n:sorted
# 失败修复路径：
bun run sort-locales
git add packages/shared/src/i18n/locales/*.json
# 然后才能继续 commit

# 0b. (v0.9.1 Pi SDK 升级 0.70.2→0.72.1) 必跑：重 build pi-agent-server 子进程
# 否则 packages/pi-agent-server/dist/index.js 仍是 0.70.2 老产物，packaged 应用
# spawn 时新 koffi binding + 老 JS 不兼容 = LLM 请求 silent fail（M2 无单测覆盖）
bun run server:build:subprocess
# 等价于 cd packages/session-mcp-server && bun run build && cd ../pi-agent-server && bun run build

# 1. typecheck
bun run typecheck:all
# 任何报错必须解决

# 2. lint（OSS 工作区不要跑组合 bun run lint；该脚本会调用 OSS 缺失的 check-raw-sends.sh）
bun run lint:i18n:parity
bun run lint:i18n:sorted          # v0.9.1+ 必跑（同 step 0a，复测确保未漂回）
bun run lint:electron
bun run lint:shared
bun run lint:ui
# 同上
```

### 2.7 跑测试清单

按 `09-test-checklist.md` 的全部清单走一遍。

### 2.7b 反向核对必跑（**Round 50 机制化为月度 SOP**）

> **背景**：Round 47-49 三轮专项审计发现 14 个文档矛盾（A 9 + B 5 / 5 P0 + 7 P1），其中 1 处违反 §1 核心域名规划、1 处任务清单 hallucination、2 处数字过期跨多轮未被发现。**单方向"挖新发现"扫不出这些**——必须跑反向核对。

**A 类：文档自相矛盾审计**（详见 `01-branding-spec.md` §2.43 审计表）

每月同步上游后，跑下面 grep 找 7 类常见矛盾：

```bash
# A1 数字过期：§2.0 总览表声明的数字 vs 子节实际表行数
# 重点 §2.15 / §2.18 / §2.19 / §2.21 / §2.22 / §2.31 / §2.32
# 标题"X 处" / 表行"Y 处" / grep 注释"约 Z 处" 三者交叉对比

# A2 任务清单文件路径 hallucination
# 11 #11* 任务列的所有文件路径用 ls 验证
for f in $(grep -hoE '`packages/[^`]+\.ts`|`apps/[^`]+\.tsx?`' .planning/11-roadmap.md); do
  path="${f//\`/}"
  [ ! -f "$path" ] && echo "MISSING: $path"
done

# A3 §X 引用 §Y 但 §Y 不存在（SOP-REHEARSAL 2026-05-05 改进：只抓显式跨文档引用）
# 旧版抓所有 "§X.Y" 字面量会把"02 引用 01 §2.43"误判为"02 缺 §2.43"——单文档 §X.Y 默认是引用本文档，跨文档须写 "<doc>.md §X.Y"
grep -hoE "(0[1-9]|1[0-2])-[a-z-]+\.md\s*§[0-9]+\.[0-9]+[a-z]?" .planning/*.md ../LEGAL.md ../CLAUDE.md | sort -u > /tmp/refs
# 然后对每个引用 doc, 验证目标 §章节存在
# 自引用（同文档内 §X.Y 不带 doc 前缀）默认认为引用本文档, 单独验证

# A4 决策版本漂移：M1/M2/M3 决策标签在 LEGAL/01/04/11 间一致性
grep -nE "M1 (不|必)改|M1 (保留|发布)" .planning/*.md ../LEGAL.md | grep -i "(webui|cli|viewer|playground|docker|server)"
# 同一对象的 M1 决策应只有一种说法
```

**B 类：反向 grep（找已写品牌字面量的不一致）**

> **SOP-REHEARSAL 2026-05-05 改进**：B1/B2/B5 加排除规则避免误报（白名单合法 underscore code identifier、审计历史描述、SOP 自身 grep 命令字面量）。

```bash
# B1 品牌名变体（找 typo / 大小写不一致）
# SOP-REHEARSAL Round 2 改进：抽长串 u_agents(_xxx)? 才能让白名单正则 match
grep -hoE "(U[ -]?Agents|UAgents|u[-_]agents(_[a-z_]+)?)" .planning/*.md | \
  grep -vE "u_agents_(environment|logo|screenshot|theme|session|transfer|validate)" | \
  sort | uniq -c | sort -rn
# 预期：U Agents (产品名) / U-Agents (DMG artifactName) / UAgents (HTTP UA token + class) / u-agents (URL)
# u_agents_* code identifier 已被白名单排除（XML marker / DOM ID / 文件名 / cookie / theme key 等是合法的）
# 异常：UAgent / U Agent 单数形式（除非合规署名）

# B2 URL 域名规划合规（必须只用 §1 行 29-32 规定的 2 个 host）
# SOP-REHEARSAL Round 2 改进：先按整行过滤再抽 URL，否则 grep -v 在 URL 短串上 match 不到行内容
grep -E "https?://[a-z.-]*u-agents\.u-studio\.cn" .planning/*.md | \
  grep -v "Round 49\|B-2\|B6 误报\|§2.43\|审计表" | \
  grep -hoE "https?://[a-z.-]*u-agents\.u-studio\.cn[/a-z]*" | \
  sort -u
# 合法：u-agents.u-studio.cn/* + update.u-agents.u-studio.cn
# 违规：share.u-agents.u-studio.cn / docs.u-agents.u-studio.cn / 任何新 subdomain（除 update）
# 注：审计表 §2.43 内"Round 49 修正历史"描述含违规字面量是合法的（已用 grep -v 排除）

# B3 邮箱白名单
grep -hoE "[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+" .planning/*.md ../LEGAL.md | sort -u
# 合法：support@u-studio.cn / agents@u-studio.cn / 上游 *@craft.do（合规凭证保留）
# 违规：其他 @ 自有域名都要审核

# B4 Token URL 一致性
grep -hoE "https?://token\.u-studio\.cn[/a-z]*" .planning/*.md | sort | uniq -c
# 预期：单域 token.u-studio.cn 多路径

# B5 typo 扫描
grep -nE "u-studi[^o]|agnets|agnest|uagentss|u-aagents" .planning/*.md \
  --exclude=07-upstream-sync.md \
  --exclude=01-branding-spec.md
# 预期：0 命中
# 排除 07（SOP 自身含 grep 命令字面量 `u-studi[^o]`）+ 01（§2.43 审计表内描述 B5 检查也含同字面量）
```

**审计输出**：每月同步报告 §2.9 必须含一节 "反向核对结果"，列出本月新发现的矛盾 + 修正动作。

**触发频率**：
- **必跑**：每月上游同步后（§2.7b 步骤）
- **建议跑**：单轮挖矿轮次 ≥ 5 轮后插入 1 轮 A+B 审计（防数字过期 / 任务 hallucination 累积）
- **可选跑**：M1/M2/M3 阶段切换前做一次（保证 release readiness）

**预期产出量**（参考 Round 47-49 实际数据）：
- A 类：每 5-10 轮代码扫产出 ~5-9 个矛盾
- B 类：每月跑产出 ~2-5 个矛盾（其中 1-2 个真违规）

> ⚠️ **A 类的 hallucination 检查最关键**：LLM 文档驱动开发最容易在"任务清单写文件路径"环节产生 hallucination（外部 Round 43 写错 4 个路径案例）。**任务清单的文件路径必须 ls/find 验证存在**，否则执行 AI 拿到任务跑命令会立即报错。

### 2.7c C 类：代码改造踩坑模式核对（**REVIEW-6 2026-05-04 加入**）

> **背景**：6 轮 review + hotfix 暴露 9 类"代码改造模式陷阱"。v0.9.1 上游同步前置追加 C10（新增 connection 字段透传），sync 实际执行又触发 C11/C12/C13；Windows 实测又暴露 C14（build-win.ps1 与 root chain 结构性差距），共 14 类。每月同步必跑下面 grep，命中即停下逐项核对。这是从血泪教训中提炼的 anti-pattern detector。

#### C1 — 硬编码 slug 而非用 `isUApiSlug` helper

**历史触发**：`state.ts:306`（REVIEW-4 P0）— `defaultConnectionSlug !== U_API_SLUG` 在多连接场景失效

```bash
# 任何 hasCredentials / 凭证判定逻辑用了 === U_API_SLUG 或 !== U_API_SLUG 都是嫌疑
grep -rnE "=== U_API_SLUG|!== U_API_SLUG|=== 'u-api-default'|!== 'u-api-default'" \
  packages/shared/src --include="*.ts" 2>/dev/null | grep -v test | grep -v __tests__
# 期望：除 u-api-defaults.ts 自身常量定义外，0 命中。命中即用 isUApiSlug() 替代
```

#### C2 — batch sed branding 漏 object key 引号

**历史触发**：commit `35444566` 把 `craft-agent` → `u-agents` 时，**测试文件中作为 object literal key** 的位置漏了引号 → syntax error → mcp-pool.test 死了 N 周（REVIEW-5）

```bash
# JS/TS 中 object key 含连字符必须加引号
grep -rnE "\{\s*u-agents\s*:|,\s*u-agents\s*:" packages apps tests --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules
# 期望：0 命中
```

#### C3 — batch sed 改 input 但漏 assertion

**历史触发**：mcp-pool.test.ts — `pool.sync({'u-agents': ...})` 改了，但 `expect(pool.isConnected('craft'))` 没改 → assertion 失败但被 syntax 提前 bail 掩盖

```bash
# 测试文件中 'craft' 字面量与 'u-agents' 字面量混用是嫌疑
for f in $(grep -rl "'u-agents'" packages apps --include="*.test.ts" 2>/dev/null | grep -v node_modules); do
  if grep -q "'craft'" "$f"; then
    echo "MIXED: $f — 同文件含 'u-agents' 和 'craft' 字面量，可能是 sed 漏改 assertion"
  fi
done
```

#### C4 — 修 callsite 但留 dead import

**历史触发**：state.ts 把 `U_API_SLUG` 用法改为 `isUApiSlug()` 但 import 没删（REVIEW-4 卫生 commit `8392dc9d`）

```bash
# tsc 不开 noUnusedLocals 时 dead import 不报错。手动核：
# 改了任何 import 时，最终 grep 该 symbol 在文件中是否仍被使用
# 例：修 state.ts 后
grep -c "U_API_SLUG" packages/shared/src/auth/state.ts  # 期望 1（仅 import）= dead，应删
# 期望：grep 数 ≥ 2（import + 至少 1 处使用）
```

**SOP**：每次改完任何 `state.ts` / `provider-metadata.ts` / `AiSettingsPage.tsx` 这类 multi-import 文件，都跑 `grep -c <symbol>` 自查。

#### C5 — 新增改造点忘记加单元测试

**历史触发**：REVIEW-4 P0 修复（state.ts:306）当时未补回归测试，REVIEW-5 才发现；isUApiSlug 这个 5 处依赖的核心 helper 也长期无单测

```bash
# 检查关键 U-API helper 是否都有单元测试
test -f packages/shared/src/config/__tests__/u-api-defaults.test.ts || echo "MISSING: u-api-defaults.test.ts"

# state.test.ts 必须含多连接 keyless 回归测试（描述块关键字搜索）
grep -qE "keyless special case|multi-connection|u-api-2.*no apiKey" \
  packages/shared/src/auth/__tests__/state.test.ts || echo "MISSING: state.ts hasCredentials multi-conn regression test"
```

**SOP**：CLAUDE.md §3.7 表新增任何改造点时，**必须同时**加对应单测。Review 时该项是必检项。

#### C6 — system prompt 字面量未受 feature flag 门控

**历史触发**：`system.ts:470` "integrate Linear, GitHub, Craft, custom APIs" + `system.ts:626` "Craft source (slug: `craft`)" 都无门控，每次对话注入 LLM；REVIEW-5 找到

```bash
# 精准匹配"用户可见路径"模式（这是 REVIEW-5 真实修过的两个 case 的模式）
grep -nE "(integrate.*[Cc]raft|[Cc]raft source|Example: [Cc]raft|[Cc]raft space|[Cc]raft Documents|slug.*\`craft\`)" \
  packages/shared/src/prompts/system.ts
# 期望：0 命中
```

**说明**：system.ts 内仍有合规保留的 craft 字面量（`getCraftAssistantPrompt` 内部函数名、`<craft_agent_environment>` XML marker、`FEATURE_FLAGS.craftAgentsCli` 门控的 CLI 块内文本、JSDoc 注释）—— 这些**不进用户可见路径**，无需修。C6 grep 只捕"用户能在 chat 里看到的"模式。

#### C7 — §3.7 表反向覆盖（实际标记 → 表项）

**历史触发**：REVIEW-3 反向核对发现 5 个文件（App.tsx / main/index.ts / EditPopover.tsx 等）有真实标记但 §3.7 表未列

```bash
# 全仓 U-API 标记按文件分布
grep -rEn "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" \
  | awk -F: '{print $1}' | sort -u

# 与 CLAUDE.md §3.7 表中"文件"列对照：每个文件至少有 1 项
# 出现在 grep 输出但表里没有 = 未文档化标记，必须补
```

#### C8 — 基线 grep 命令漏注释格式

**历史触发**：REVIEW-3 修正——旧基线 grep `// U-API:|/\* U-API (START|END)` 漏 HTML 注释 + JSX 行内注释，真实数 47 而非 44

**SOP**：CLAUDE.md §3.7 的全格式基线 grep 命令是权威；下次同步用旧命令产出旧数字时，**先核对命令是不是 §3.7 写的那个**。

#### C9 — 测试 syntax error / 网络 flaky 让 baseline fail 数字漂移

**历史触发**：
- mcp-pool.test.ts 因 object key 缺引号 syntax error → bun test --bail 提前 bail → mcp-pool 7 个 test 一直被掩盖
- **OAuth Metadata Discovery 测试网络 flaky**（GitHub MCP api.githubcopilot.com + Linear MCP mcp.linear.app 跑外网 5002ms timeout）— 偶尔过/失败让 fail 数在 13/14/15 漂移，每次同步都被这种漂移迷惑

**真实 baseline**：**12 stable + 1-2 OAuth network-flaky**（REVIEW v8 修 url-safety.test.ts:48 后从 13→12 stable；M1-FIRST-RELEASE.md 已知技术债已记录此口径）

```bash
# bun test 不带 --bail 跑，看真实 fail 数
cd packages/shared && bun test 2>&1 | tail -5
# 期望：fail 数 ∈ [12, 14]，超出范围才停下逐项对照

# 精准对照：用 set diff 排除 OAuth flaky
cd packages/shared && bun test 2>&1 | grep -E "^✗|FAIL" | grep -v "OAuth Metadata Discovery" | wc -l
# 期望：12（stable baseline，REVIEW v8 修 url-safety.test.ts:48 后从 13→12）

# 完整 set diff（git stash 后跑 baseline，再 unstash 跑当前，对比 set 而非 count）
git stash
cd packages/shared && bun test 2>&1 | grep "^✗" | sort -u > /tmp/baseline-fails
git stash pop
cd packages/shared && bun test 2>&1 | grep "^✗" | sort -u > /tmp/current-fails
diff /tmp/baseline-fails /tmp/current-fails
# 期望：仅 OAuth Metadata Discovery 行有差异（network flaky）；其他 diff = 真新引入回归
```

#### C10 — 上游新增 connection 字段，`enforceUApiBaseUrl` 重写时漏透传

**历史触发**：upstream v0.9.1（commit `b31904c6`，2026-05-06）引入 `connection.midStreamBehavior` 字段（`'steer' | 'queue' | undefined`）。这是**上游会持续发生的模式**：每个新 release 都可能在 `LlmConnection` 类型上加新 optional 字段。

**踩坑机制**：
我们 §3.7 #1 `enforceUApiBaseUrl`（`packages/shared/src/config/storage.ts`）在启动时强制重置 U-API 连接，重写逻辑里如果只覆盖了模板硬定义的字段（baseUrl / authType / providerType / models 等），新字段会**静默丢**——用户在 UI 改的 `midStreamBehavior` / 未来 `temperature` 等会在下次启动被吞。

**核对手段（每次同步必跑）**：
```bash
# 1. 找上游本次新增的 connection 字段（**方向**：merge-base → upstream HEAD，找上游加了什么）
git diff $(git merge-base HEAD upstream/main)..upstream/main -- packages/shared/src/config/llm-connections.ts | grep -E "^\+\s+\w+\?:" | head
# 输出格式：+ midStreamBehavior?: MidStreamBehavior
# 上游 v0.9.1 应能 grep 到 midStreamBehavior
# ⚠️ 不要写反方向：`upstream/main..HEAD` 查的是"我们相对上游删除的"，merge 前必然 0 命中假报

# 2. 核对 enforceUApiBaseUrl 是否透传所有上游字段
sed -n '/function enforceUApiBaseUrl/,/^function\|^const/p' packages/shared/src/config/storage.ts | grep -E "name:|baseUrl:|authType:|providerType:|models:|midStreamBehavior:|<新字段>"
# 上游每加一个字段，本节命中数应同步加一行
```

**修复策略**：
- **选项 A（推荐）**：参考上游 [`storage.ts:updateLlmConnection`](../packages/shared/src/config/storage.ts) 的 `{ ...existing, ...updates }` 浅合并模式，保证未知字段透传
- **选项 B**：在 `enforceUApiBaseUrl` 顶部 `const { /* lockdown 字段 */ baseUrl, authType, providerType, ...rest } = existingConnection` + 重写后展开 `...rest`——但 lockdown 字段必须显式列出，避免 baseUrl 被 rest 覆盖回去
- **不要**用 hard-coded 字段白名单（每次同步都漏字段）

#### C11 — 上游新文件用旧 `@craft-agent/` NPM scope（v0.9.1 sync 触发）

**历史触发**：v0.9.1 上游加的新文件（`packages/server-core/src/sessions/runtime-config.{ts,test.ts}` / `messaging-gateway/__tests__/access-control` 各测试文件 / `renderer/playground/registry/image-support.tsx` 等共 12 文件 20 处）用 `@craft-agent/*` import。我们之前的 NPM scope rename 没追到这些"还不存在"的文件。

**症状**：merge 后 `bun run typecheck:all` 报 12 个 `Cannot find module '@craft-agent/...'` errors。

**核对手段**：
```bash
# 每次 sync 后必跑：上游新文件是否含旧 NPM scope
grep -rEn "@craft-agent/" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | head
# 期望：0 命中。任何命中 = batch sed rename
```

**修复手段**：
```bash
# 全仓 sed rename（注意保留 @u-agents/ 而非 @craft-agent/）
find packages apps -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" \
  -exec sed -i '' 's|@craft-agent/|@u-agents/|g' {} +
# 然后核对 grep 0 命中、跑 typecheck:all
```

#### C12 — 上游 release 自身 lint 违规（v0.9.1 sync 触发）

**历史触发**：v0.9.1 上游新代码违反我们 fork（实际是上游本身的）`packages/{ui,shared}/eslint-rules/` 自定义 ESLint 规则：
- `block-markers.ts:8` — `block.style.boxShadow = ''` 违反 `craft-styles/no-nonstandard-shadows`（规则不识别空字符串等价于 'none'）
- `block-markers.ts:30` — 动态 `color-mix(...)` boxShadow，违反同规则
- `TurnCard.tsx:1479` — 同 L8 模式
- `resource-bundle.test.ts:141` — `source.config.isAuthenticated` 直接读，违反 `craft-shared/no-inline-source-auth-check`

**症状**：merge 后 `bun run lint:ui` 报 3 errors / `bun run lint:shared` 报 1 error。

**修复策略（case-by-case）**：
- 语义等价改源码（如 `= ''` 改 `= 'none'` 走规则的 `allowInlineNone` 默认）
- 加 `// eslint-disable-next-line` + `// U-API:` 解释注释（写明为什么必须违反 — 这是改造点，加进 §3.7 主表）
- **绝不**改我们的 ESLint 规则本身（那是上游的，会被同步覆盖）

#### C13 — 上游 release 自身 test fail（v0.9.1 sync 触发）

**历史触发**：v0.9.1 release 同时引入 4 个 test fail，其中：
- `routing.test.ts × 2 fail` — 上游加 9 个 `messaging:access:*` channel 但 routing.ts 只分类了 5 个，漏 9 个未分类。**我们 patch 修**：把 9 个全加到 `REMOTE_ELIGIBLE_CHANNELS` + `// U-API:` marker（§3.7 #37）
- `sdk-bridge.test.ts:30` — 上游 v0.9.1 行为变化导致期望失败。**我们继承**（记入 follow-up）
- `send-developer-feedback-permissions.test.ts:34` — 上游可能改了 permission 逻辑。**我们继承**（记入 follow-up）

**核对手段**：
```bash
cd packages/shared && bun test 2>&1 | grep -E "^(✗|FAIL)" | sort -u > /tmp/sync-fails
diff /tmp/baseline-fails /tmp/sync-fails
# 期望：仅 OAuth Metadata Discovery flaky 行 + 我们已知继承的上游 fail
```

**判定原则**：
- **(a) 我们 patch 真能修**（如 routing.ts 漏分类）→ commit fix + 加 §3.7 marker
- **(b) 上游 bug 我们继承**（行为变化、permission 改）→ 记入 sync 报告 follow-up，**不阻塞 merge**，等上游 v0.9.2+ 修
- 区分手段：跑 `git log upstream/main -- <test 文件>` 看是否上游历次自己也 fail 过

#### C14 — build-win.ps1 与 root chain 之间的结构性差距（v0.9.1 sync 后 Windows 实测触发）

**历史触发**：v0.9.1 sync 后 Windows EXE 实测装包成功 + 首条 LLM 消息回复正常，但 build 输出含 warning：
```
• file source doesn't exist  from=...\packages\messaging-whatsapp-worker\dist\worker.cjs
```
事故 #3（pi-agent-server 缺失）2026-05-05 已修，但事故 #4（WhatsApp worker 缺失）+ 事故 #5（dist/interceptor.cjs 缺失）是同根模式的延伸：[`scripts/electron-build-main.ts:main()`](../scripts/electron-build-main.ts) 的 main bundle 流水线含 5 步：sessionServer → piAgentServer → **interceptor** → **whatsAppWorker** → main process。事故 #3 fix 加了 `bun run electron:build:subprocess`（covers session-mcp-server + pi-agent-server）治标 step 1+2；事故 #4 fix 补 step 4（`build:wa-worker`）；事故 #5 fix 补 step 3（`build:interceptor`）。**至此 main bundle 5 步中 step 1+2+3+4 全闭环**。

**踩坑机制**：
- macOS [`build-dmg.sh`](../apps/electron/scripts/build-dmg.sh) 跑 `bun run electron:build` → 调 `electron-build-main.ts` → 5 步全跑 ✓
- Linux [`build-linux.sh`](../apps/electron/scripts/build-linux.sh) 同理 ✓
- **Windows [`build-win.ps1`](../apps/electron/scripts/build-win.ps1)** 用内联 `npx esbuild` 跑 main bundle（绕过 root chain 历史决定），**不调 `electron-build-main.ts`**——5 步中 sessionServer + piAgentServer 被事故 #3 fix 补齐 / whatsAppWorker 被事故 #4 fix 补齐 / interceptor 被事故 #5 fix 补齐 / step 5 main process 由 build-win.ps1 自身 inline npx esbuild 处理（这一步 build-win.ps1 历史就是 owner，没差距）

**核对手段（每次 sync 后必跑）**：
```bash
# 1. macOS / Linux 跑 dist 后看产物缺什么
ls apps/electron/release/mac-arm64/U\ Agents.app/Contents/Resources/app/messaging-whatsapp-worker/worker.cjs 2>&1
ls apps/electron/release/win-unpacked/resources/messaging-whatsapp-worker/worker.cjs 2>&1
# 两个应都存在；缺 = build 链路漏调

# 2. 反向：grep build-win.ps1 是否调齐 main bundle 5 步
grep -E "build:wa-worker|build:interceptor|electron:build:subprocess" apps/electron/scripts/build-win.ps1 | wc -l
# 期望 ≥ 3（subprocess + interceptor + wa-worker 三个 root chain script）

# 3. 与 electron-build-main.ts:main() 顺序对照
grep -nE "buildSessionServer|buildPiAgentServer|buildInterceptor|buildWhatsAppWorker" \
  scripts/electron-build-main.ts
# 5 步顺序：session → pi → interceptor → wa-worker → main process
```

**修复策略**：
- **当前修法（局部）**：每发现一个漏的 helper（事故 #3 / #4 都是这种），就给 build-win.ps1 加一段调对应 root script。**优点**：最小改动；**缺点**：每次 root chain 加新 helper 都可能漏一次
- **M3 终极方案（结构性）**：把 build-win.ps1 也改成调 `bun run electron:build`（跟 macOS / Linux 对齐）。**风险**：windows 历史绕过 root chain 可能有原因（exhaustive analysis 待 M3 做）

**已知非阻塞 warning（v0.9.1 sync 后基线）**：事故 #4 fix 后 Windows dist:win 仍有 3 条 `file source doesn't exist`（vendor/codex / vendor/copilot / resources/bin/win32-x64）—— 都是 platform-specific binary 下载链路缺失，但都是可选 feature，**核心 LLM 功能不受影响**。详见 [`12-subprocess-build-pipeline.md` §0.4b](12-subprocess-build-pipeline.md)。下次 sync 监控：`grep -c "file source doesn't exist" <build_log>` 应 ≤ 3；超过 = build-win.ps1 又落后了，按事故 #2 模式补 vendor 下载段。

**审计输出**：§2.9 同步报告 "C 类核对结果" 必填——**C1-C14 共 14 类**陷阱本月新触发情况（v0.9.1 sync 后从 13 类升至 14 类；C14 是结构性长期债务）。

---

### 2.8 合回主分支

```bash
git checkout main
git merge sync/upstream-$DATE  # fast-forward
git push origin main
git tag sync-$DATE
git push origin sync-$DATE
```

### 2.9 写同步报告

在 `.planning/sync-reports/YYYYMMDD.md` 创建一份简短报告（**这一步可以让本仓库 AI 协助**）：

```markdown
# 上游同步报告 — YYYY-MM-DD

## 合并范围
- 上游版本：vX.Y.Z（如有 tag）
- Commits 数量：N
- 主要变化：
  - <从 release notes 提炼>

## 影响我们锁定的变更
- [ ] 新 LlmProviderType: 无 / 列表
- [ ] 新 OnboardingStep: 无 / 列表
- [ ] 品牌密集文件冲突数: N
- [ ] 核心锁定文件冲突数: N

## 验收
- [ ] 01-branding-spec §8 全部通过
- [ ] **§2.5b release notes 翻译完成**：新版本 release notes 文件（`apps/electron/resources/release-notes/{version}.md`）已译为中文 + 删链接 + 替品牌；3 组 grep（外部链接 / commit hash / craft 字样）全 0 命中
- [ ] **§2.7b 反向核对全部通过**：A 类（自相矛盾）+ B 类（反向 grep）当月无新发现矛盾，或已记录到下月待办
- [ ] **§2.7c 代码改造踩坑模式核对**：C1-C14 跑一遍，命中 = 0 或已修（v0.9.1 sync 后含 C10/C11/C12/C13；Windows 实测后含 C14）

## 反向核对结果（§2.7b + §2.7c 必填）
- A 类（自相矛盾）本月新发现：N 个（详细列表 → `01-branding-spec.md §2.43` 审计表追加行）
- B 类（反向 grep）本月新发现：N 个
- C 类（代码踩坑模式）本月新触发：N 个（按 C1-C14 列出哪几个）
- P0 已修正：N 个；P1 已记录待下月：N 个

## §3.7 标记基线对照
- 旧基线（上次同步）：N 处 / START N / END N
- 本次同步后实际：N 处 / START N / END N
- 浮动：±X（在 ±2 内 ✅ / 超出需逐项核对 ⚠️）
- 任务路径 hallucination 检查：✅ 全部存在 / ❌ 列出 missing 路径
- [ ] 02-llm-gateway-spec §10 全部通过（§9 是 Token 安全规则；M1 完成判定在 §10）
- [ ] 03-ui-lockdown-spec §5 全部通过
- [ ] 09-test-checklist 全部通过

## 后续
- <如果有遗留问题，记录到 ROADMAP / 单独 issue>
```

---

## 3. 紧急安全同步流程（**因 release-only squash 仓库而调整**）

⚠️ **关键事实**：上游是 release-only squash 仓库（详见 §1.0），**不能**逐 commit cherry-pick。

如果上游发布了安全公告（`SECURITY.md` 或 release notes 中提到 CVE）：

1. **立即** `git fetch upstream`
2. 看 release notes 确认是否影响我们使用的代码路径
3. 如果影响：
   - 创建 `hotfix/security-YYYYMMDD` 分支
   - **整批 merge** 上游新 release（**不能** cherry-pick——上游没细粒度 commits）
   - 通过 git diff 定位安全修复的具体文件，**手动**review 是否仅含安全修复（避免大量功能改动一并进来）
   - 如果上游 release 含大量功能改动 + 安全修复**混在一起**，按以下方案：

```bash
# 方案 A：整批合入（如果改动可控）
git merge upstream/main

# 方案 B：仅取安全相关文件（如果其他改动不想要）
# 1. 抓取上游 tree 但不 merge
git fetch upstream
# 2. 用 checkout 仅取需要的安全相关文件
git checkout upstream/main -- packages/shared/src/security/
git checkout upstream/main -- <其他安全相关文件>
# 3. 提交为 hotfix
git commit -m "hotfix: cherry-pick security fixes from upstream vX.Y.Z"
```

   - 跑 typecheck + `bun run test:shared:all` + 关键功能测试（聊天能用、Token 校验能用）
   - 立即出包发布

⚠️ **方案 B 的风险**：手动挑文件可能漏掉安全修复连带的依赖文件——因此**首选方案 A**，除非上游 release 的非安全改动确实不能接受。

---

## 4. 同步常见坑

### 4.1 `bun.lock` 冲突且 `bun install` 失败

**原因**：上游升级了某个依赖的 major 版本，与我们环境冲突。

**处理（按风险递增的顺序，逐步尝试）**：

```bash
# 步骤 1：先确保 git 状态干净（防止误删未提交修改）
git status

# 步骤 2：只删 node_modules 重装（最安全，95% 情况下能解决）
rm -rf node_modules
bun install

# 仍失败 → 步骤 3：确认 bun.lock 是合并冲突产物，且没有手动重要修改
# 看一下 bun.lock 的 git diff，确认没有我们手动调过的版本固定
git log --oneline -5 bun.lock
git diff HEAD~5 -- bun.lock | head -50

# 步骤 4：如果确认 bun.lock 安全可重建，再删它
rm bun.lock
bun install
git add bun.lock && git commit -m "chore: regenerate bun.lock after upstream merge"
```

⚠️ **绝不**一上来就 `rm bun.lock node_modules -rf` —— 这会丢掉我们可能在 `bun.lock` 中固定的特定版本（如安全考虑、兼容性补丁等）。先删 `node_modules` 90% 能解决问题。

### 4.2 i18n 文件 grep 不到 key 但应用启动报错"Missing translation"

**原因**：上游加了新 i18n key，但我们的 zh-Hans.json 没同步加。

**处理**：
```bash
bun run lint:i18n:parity
# 看输出哪些 key 缺失，对照 en.json 翻译后加到 zh-Hans.json
```

### 4.3 `enforceUApiBaseUrl` 之后用户连接不见了

**原因**：上游修改了 `LlmConnection` interface，旧字段被 storage 迁移流水线"清洗"掉了。

**处理**：先回滚到合并前 commit；review `packages/shared/src/config/storage.ts` 中的迁移函数；调整 `enforceUApiBaseUrl` 的兼容逻辑。

### 4.4 macOS 打包后启动崩溃

**原因**：上游升级了 `@anthropic-ai/claude-agent-sdk`，但 SDK 二进制（platform-specific）在我们的 build script 中未被同步替换。

**处理**：参考 `electron-builder.yml` 第 64-76 行的注释，确保 build 脚本中的 SDK binary 软链/拷贝逻辑仍然有效。详见 `05-build-release.md`。

### 4.5 (v0.9.1+) locale 排序 hook 阻塞 commit

**症状**：merge upstream/main 后跑 `git commit` 时 husky pre-commit hook 报：
```
Error: zh-Hans.json keys are not sorted alphabetically.
Fix: bun run sort-locales
```
这是 v0.9.1 上游引入的 `scripts/sort-locales.ts` + `lint:i18n:sorted` 守门——保证 locale 文件按字典序，避免历次 mass-translate script 留下的乱序。

**根因**：我们的 zh-Hans.json 在 M2 中文化期间按"插入顺序"加了一些 key（如 `about.basedOn` 系列被追加在文件末尾），不符合字典序——v0.9.1 之前没 hook 不报错，merge 后立即阻塞。

**处理**（**绝不**用 `--no-verify` 跳过）：
```bash
# 1. 自动修复（v0.9.1 引入的工具脚本）
bun run sort-locales

# 2. 重 add（修了的 locale 文件需要重新 stage）
git add packages/shared/src/i18n/locales/*.json

# 3. 验证
bun run lint:i18n:sorted   # 应静默退出（exit 0）

# 4. 继续 commit（hook 不再阻塞）
git commit -m "..."
```

**为什么不能 --no-verify**：CLAUDE.md 默认禁止跳 hook（`fix the underlying issue`）；此处 underlying issue 就是 locale 不字典序，sort-locales 自动修就行，没理由跳 hook。

### 4.6 (v0.9.1+) Pi SDK 0.70.2 → 0.72.1 但子进程跑老产物

**症状**：merge 后应用启动正常、onboarding 走完，**首次发 LLM 消息 silent fail**（pi-agent-server 进程起来但 LLM 请求不返回，no error log）。

**根因**：pi-* 三包升级 0.70.2 → 0.72.1，bun install 装新版到 node_modules，但 `packages/pi-agent-server/dist/index.js` 是预先 bundled 的产物（不是 ESM source），bun install 不会自动重 build。**packaged 应用 spawn 时新 koffi native binding + 老 JS 不兼容**——M2 无单测覆盖，typecheck 也不能 catch（dist 不入 typecheck）。

**处理**：
```bash
# 在 §2.6 step 0b 已加，但若漏跑可补救：
bun run server:build:subprocess
# 等价于 cd packages/session-mcp-server && bun run build && cd ../pi-agent-server && bun run build
```

事故 #1（M1 期 commit `8ebe8c0`）/ #3（M2 期 commit `8cc943e6`）的同根模式——helper 函数定义但漏接到链路，详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §0。

---

## 5. 何时拒绝同步上游变更

并非所有上游变更都该照单全收。以下情况**应该**拒绝（保持我们的版本）：

- 上游加了新的"添加 LLM Provider"入口 → 直接保持 UI 隐藏，不暴露给 U Agents 用户
- 上游引入了新的 craft.do 域名引用 → 必须替换为我们的域名
- 上游改了 OAuth relay 默认 URL → 我们 M3 自建后才跟随
- 上游加了 telemetry / analytics 上报到 craft.do → 必须禁用或替换
- 上游加了新的 product placement（如内置 Craft 笔记 Source）→ 必须裁剪（同 `04-feature-cuts.md` §4）

每一项拒绝都应在同步报告中显式记录。

---

## 6. 长期版本号策略

我们的版本号**与上游解耦**：

| 我们的版本 | 含义 |
|---|---|
| 1.0.0 | M1 首发版本 |
| 1.x.y | M2/M3 阶段，上游小版本同步 + 我们的功能演进 |
| 2.0.0 | 重大重构（如自建 OAuth relay 完成）|

上游的版本号（`0.9.x`）只在我们的"关于"对话框 / sync report 中作为参考标注，不影响我们的对外版本号。

`package.json` 的 `version` 字段由我们维护，发版时手动 bump（详见 `05-build-release.md` §发版流程）。
