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
# package.json 类（保留 name/version/homepage，接受其他）
# 手动 merge，或用 ours-then-patch 策略：
git checkout --ours package.json
# 然后跑 git diff upstream/main -- package.json 看上游加了什么 dependencies，手动加进来
```

#### 2.4.3 处理 🔴 核心锁定

逐个处理，**绝不**用 `git checkout --theirs` 全取上游：

| 文件 | 推荐策略 |
|---|---|
| `apps/electron/electron-builder.yml` | 取上游为基础，再手动改回我们的 7 个字段（含 `copyright`） |
| `packages/shared/src/branding.ts` | 同上：取上游 + 改回 VIEWER_URL + 替换 ASCII art |
| `packages/shared/src/config/llm-connections.ts` | 取上游（我们没改这个文件），但 review 看是否有新 ProviderType |
| `packages/shared/src/config/provider-metadata.ts` | 手动合并：保留 'u-api' entry + getProviderMetadata 修改 |
| `apps/electron/src/renderer/components/onboarding/*` | 逐文件手动合并 |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | 最痛苦的一个：保留我们的 `mode === 'u_api'` 分支，接受上游对其他分支的修改 |

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

逐项执行：

```bash
# 1. 检查是否引入新的 LlmProviderType
grep -nE "^\s*\| '" packages/shared/src/config/llm-connections.ts | grep -i ProviderType
# 把输出和上次同步时记下的 type 列表对比

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
echo "U-API 改造标记总数（应与上次同步记录一致或更高）:"
grep -rEn "// U-API:|/\* U-API (START|END)" packages apps --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | wc -l

echo "U-API START/END 配对数（必须相等）:"
grep -rE "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
grep -rE "/\* U-API END" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
# 详见 CLAUDE.md §3.7 "代码改造点统一加 // U-API: 标记"

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

### 2.6 跑构建与 typecheck

```bash
# 1. 重新装依赖
bun install

# 2. typecheck
bun run typecheck:all
# 任何报错必须解决

# 3. lint（OSS 工作区不要跑组合 bun run lint；该脚本会调用 OSS 缺失的 check-raw-sends.sh）
bun run lint:i18n:parity
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
grep -hoE "(U[ -]?Agents|UAgents|u[-_]agents)" .planning/*.md | \
  grep -vE "u_agents_(environment|logo|screenshot|theme|session|transfer|validate)" | \
  sort | uniq -c | sort -rn
# 预期：U Agents (产品名) / U-Agents (DMG artifactName) / UAgents (HTTP UA token + class) / u-agents (URL)
# u_agents_* code identifier 已被白名单排除（XML marker / DOM ID / 文件名 / cookie / theme key 等是合法的）
# 异常：UAgent / U Agent 单数形式（除非合规署名）

# B2 URL 域名规划合规（必须只用 §1 行 29-32 规定的 2 个 host）
grep -hoE "https?://[a-z.-]*u-agents\.u-studio\.cn[/a-z]*" .planning/*.md | \
  grep -v "Round 49 反向\|B-2\|B6 误报澄清\|01 §2.43" | \
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

> **背景**：6 轮 review + hotfix 暴露 9 类"代码改造模式陷阱"。每月同步必跑下面 grep，命中即停下逐项核对。这是从血泪教训中提炼的 anti-pattern detector。

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

**真实 baseline**：**13 stable + 2 OAuth network-flaky**（M1-FIRST-RELEASE.md 已知技术债已记录此口径）

```bash
# bun test 不带 --bail 跑，看真实 fail 数
cd packages/shared && bun test 2>&1 | tail -5
# 期望：fail 数 ∈ [13, 15]，超出范围才停下逐项对照

# 精准对照：用 set diff 排除 OAuth flaky
cd packages/shared && bun test 2>&1 | grep -E "^✗|FAIL" | grep -v "OAuth Metadata Discovery" | wc -l
# 期望：13（stable baseline）

# 完整 set diff（git stash 后跑 baseline，再 unstash 跑当前，对比 set 而非 count）
git stash
cd packages/shared && bun test 2>&1 | grep "^✗" | sort -u > /tmp/baseline-fails
git stash pop
cd packages/shared && bun test 2>&1 | grep "^✗" | sort -u > /tmp/current-fails
diff /tmp/baseline-fails /tmp/current-fails
# 期望：仅 OAuth Metadata Discovery 行有差异（network flaky）；其他 diff = 真新引入回归
```

**审计输出**：§2.9 同步报告 "C 类核对结果" 必填——9 类陷阱本月新触发情况。

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
- [ ] **§2.7b 反向核对全部通过**：A 类（自相矛盾）+ B 类（反向 grep）当月无新发现矛盾，或已记录到下月待办
- [ ] **§2.7c 代码改造踩坑模式核对**：C1-C9 跑一遍，命中 = 0 或已修

## 反向核对结果（§2.7b + §2.7c 必填）
- A 类（自相矛盾）本月新发现：N 个（详细列表 → `01-branding-spec.md §2.43` 审计表追加行）
- B 类（反向 grep）本月新发现：N 个
- C 类（代码踩坑模式）本月新触发：N 个（按 C1-C9 列出哪几个）
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
