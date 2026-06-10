# CLAUDE.md — U Agents (优智体) AI 工作守则

> **本文件优先级最高**。如果其它文档与本文冲突，以本文为准。
> 本文档读完后，必须再读 `PRODUCT.md` 和 `LEGAL.md`，再开始任何动作。

---

## 0. 零号铁律：永不动代码，只搞文档

**本仓库 `u-agents/` 内的 AI 永远只产出 Markdown 文档（`.md`），永远不修改源码或运行会改变代码状态的命令。**

| 允许 | 禁止 |
|---|---|
| Read / Grep / Glob 任何文件（含源码） | Edit / Write 任何 `.ts` / `.tsx` / `.json` / `.yml` / `.yaml` / `.html` / `.css` / `.svg` / `.icns` / `.ico` / `.png` 等源码与配置 |
| Edit / Write `.md`（仅 `u-agents/*.md` 与 `u-agents/.planning/*.md`）| Edit / Write 上游 `packages/` `apps/` `scripts/` 内任何非 `.md` 文件 |
| Bash 只读命令：`ls` / `cat` / `grep` / `find` / `wc` / `git log` / `git status` / `git show` / `git diff` / `git remote -v` | Bash 写入命令：`mv` / `rm` / `cp` / `sed -i` / `git checkout <file>` / `git merge` / `git rebase` / `git pull` / `bun install` / `npm install` |
| 起 `electron` / `bun run` **只读**或**沙箱**调研用法 | 在用户工作区执行任何安装、构建、发版命令 |

**例外**：仅当用户**当次明确指令**（不是引用过往 CLAUDE.md 规则）要求 AI 改代码或跑写入命令时，方可破例。一次破例只覆盖一次任务，不延续。

**为什么**：用户是非职业程序员，依赖 AI 长期维护这个项目。代码改造由用户自己（或他另开的执行会话/外部 AI）按照本仓库 `.planning/` 的规格文档执行。本仓库的 AI 角色只有一个——**写规格、改规格、对照代码核查规格**。这样上游同步、回滚、跨 AI 工具都不会丢失约束。

> 自 2026-05-29 起，本铁律由 `.claude/hooks/enforce-docs-only.py`（PreToolUse hook）**机械强制**：任何对非 `.md` 文件的 Edit/Write 会被直接拦截。破例时需带环境变量 `U_AGENTS_ALLOW_CODE=1` 启动。详见 §8。

---

## 1. 项目身份

**U Agents（优智体）** 是基于 Apache 2.0 开源项目 [`craft-agents-oss`](https://github.com/craft-ai-agents/craft-agents-oss) 二次开发的中文桌面 Agent 应用，由独立开发者运营，闭源商业分发。（上游 2026-06 前位于 `lukilabs/craft-agents-oss`，已整体迁移至 `craft-ai-agents` org，旧地址自动跳转。）

- **品牌**：U Agents（英文）/ 优智体（中文）
- **发行方**：tungwerl@gmail.com（独立开发者）
- **目标用户**：国内非技术或半技术用户，通过统一 Token 中转站使用 Claude/GPT 等大模型
- **AI 入口**：固定且唯一，地址 `https://token.u-studio.cn/v1`（OpenAI Chat Completions 协议，由 newapi 搭建）

---

## 2. 仓库布局

```
/Users/dengwang/Documents/coding/u-agents-oss/   ← 路径仅供参考；仓库可整体移动，无硬依赖
└── u-agents/                        ← 本仓库（fork 工作区，git 根；从这里启动 Claude Code）
    ├── CLAUDE.md                    ← 本文件
    ├── AGENTS.md                    ← 指向本文件的 stub（保留 §0 铁律）
    ├── PRODUCT.md                   ← 产品定位与功能边界
    ├── LEGAL.md                     ← 法律合规清单
    ├── .claude/                     ← Claude Code harness（settings / hooks / skills，详见 §8）
    ├── .planning/
    │   ├── 00-codebase-map.md       ← 源码树地图（packages/apps 导航）⭐ 新
    │   ├── 01-branding-spec.md      ← 品牌替换全表
    │   ├── 02-llm-gateway-spec.md   ← 中转站接入规格 ⭐
    │   ├── 03-ui-lockdown-spec.md   ← UI 锁定清单
    │   ├── 04-feature-cuts.md       ← 功能裁剪清单
    │   ├── 05-build-release.md      ← 打包发布流程
    │   ├── 06-update-server.md      ← 自建更新服务器
    │   ├── 07-upstream-sync.md      ← 上游同步流程
    │   ├── 08-conflict-zones.md     ← 高冲突文件清单
    │   ├── 09-test-checklist.md     ← 发版回归清单
    │   ├── 10-i18n-zh.md            ← 中文化策略
    │   ├── 11-roadmap.md            ← 阶段路线图
    │   ├── 12-subprocess-build-pipeline.md ← 子进程打包流水线
    │   ├── 13-claude-harness.md     ← Claude Code harness 配置规格 ⭐ 新
    │   ├── 14-uapi-marker-registry.md ← `// U-API:` 改造点登记表 + 同步基线 ⭐ 新
    │   ├── M1-*.md / M2-*.md / M3-*.md ← 各里程碑专项规格
    │   └── sync-reports/            ← 历次同步差异报告 + REVIEW 记录
    ├── (上游全部源码 ...)
    └── ...
```

源码树（packages/* + apps/* 各自职责、关键文件、治理它的规格编号、高冲突区）见 [`.planning/00-codebase-map.md`](.planning/00-codebase-map.md)。

Git remote 配置：
- `upstream` → `https://github.com/craft-ai-agents/craft-agents-oss.git`（同步源，**只读**；2026-06-10 起，旧 `lukilabs` 地址已迁移）
- `origin` → 用户自己的私有 fork（待用户提供后设置）

---

## 3. 硬规则（违反即停下问用户）

### 3.1 LLM 入口锁定
**任何情况下，最终用户的 LLM 请求只能通过 `https://token.u-studio.cn/v1`。**
- **baseUrl 固定不可改**（用户不可见、配置文件被篡改时启动强制重置）
- **协议可选**：用户在 "OpenAI Chat Completions" 与 "Anthropic Messages" 之间二选一（newapi 同时支持，对应不同模型最佳实践）
- **模型可选**：管理员预设候选模型清单 + 用户从清单中挑选，或允许填写自定义 model ID
- 不允许在 UI 中暴露 `baseUrl` 输入框
- 不允许出现"Anthropic 直连""Bedrock""Vertex""GitHub Copilot""ChatGPT Plus""Ollama 本地"等 provider 选项
- 修改任何与 LLM 连接相关的代码前，**必读 `.planning/02-llm-gateway-spec.md`**

### 3.2 品牌替换不可遗漏
修改任何下列资源前，**必读 `.planning/01-branding-spec.md`** 并按其执行：
- `apps/electron/electron-builder.yml`（appId / productName / publish.url / artifactName / dmg.title / linux.maintainer）
- `apps/electron/resources/icon.*` 与 `apps/electron/resources/craft-logos/`
- `packages/shared/src/branding.ts`
- 所有 `package.json` 中的 `"name": "@craft-agent/..."` 和 `"homepage"`
- `i18n/locales/` 下的 "Craft Agents" / "Craft" 字面量（中文化阶段处理）
- `apps/electron/src/main/auto-update.ts` 中的更新源
- `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx`

### 3.3 高冲突文件改前必停
下列文件每次被修改前，AI 必须**先停下、向用户确认**，原因是它们直接决定与上游同步时的合并冲突量：
1. `apps/electron/electron-builder.yml`
2. `packages/shared/src/branding.ts`
3. `packages/shared/src/config/llm-connections.ts`
4. `packages/shared/src/config/provider-metadata.ts`
5. `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx`
6. `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx`
7. `apps/electron/src/renderer/components/apisetup/`（整个目录）

详见 `.planning/08-conflict-zones.md`。

### 3.4 永不删除/篡改
- `LICENSE` —— Apache 2.0 全文，永远保留
- `NOTICE` —— Craft Docs Ltd. 版权声明，永远保留（这是 Apache 2.0 强制要求）
- `TRADEMARK.md` —— 上游商标政策，可保留作为合规凭证

### 3.4.1 包管理器锁定（强制）
- **只能用 `bun`**，不能换 `npm` / `yarn` / `pnpm`
- 上游 monorepo 用 `bun.lock`（不是 `package-lock.json`）
- 换包管理会破坏 lockfile + 部分 npm scripts 直接调 `bun run tsc` 形式
- 详见 `.planning/11-roadmap.md` 入口条件"Bun（强制）"

### 3.5 不暴露上游品牌
- `Craft` / `Craft Agents` / `craft.do` / `lukilabs` / `craft-ai-agents` 不能出现在用户可见界面（菜单、对话框、错误提示、邮件签名、提交信息、自动生成的会话 commit 模板）
- **已知瑕疵**（已被用户接受）：第三方 OAuth Source（Slack/Gmail/Outlook）首次授权时，浏览器地址栏会短暂出现 `agents.craft.do`。这是上游 OAuth relay 的硬依赖，路线图 M3 自建 relay 后解决。详见 `LEGAL.md`。

### 3.6 双品牌区分（U Agents vs U-API）
- **U Agents（优智体）** = 桌面应用品牌（产品名、Bundle 标识、窗口标题、安装包名）
- **U-API** = LLM 中转站品牌（在所有 LLM 连接相关 UI、错误提示、控制台跳转里使用）
- 两个品牌不要混用：连接卡片显示 "U-API"，应用关于页显示 "U Agents"

### 3.7 代码改造点统一加 `// U-API:` 标记（每次同步上游必跑 grep 验证）

所有对上游代码的改造都加 `// U-API:` 标记，便于同步时 grep 扫描、防止 git 自动合并"无声破坏"。

- **标记规范**：单行 `// U-API: <原因>`；多行块 `/* U-API START */ ... /* U-API END */`；必须含 "U-API" 字样。
- **完整登记表（54+ 改造点）、当前基线数字、校验 grep、C1–C14 踩坑模式，已全部移到 [`.planning/14-uapi-marker-registry.md`](.planning/14-uapi-marker-registry.md)。**
- 本节只保留约束力：每次上游同步**必须**跑 §14 的全格式 grep，核对标记总数与 START/END 配对；**超出基线 ±2 必须停下逐项核对**。
- 此规则同时满足 `LEGAL.md` §2 Apache §4(b) "modification notices" 合规要求。
- 写规格涉及改造点时，`upstream-sync` / `uapi-markers` skill 会自动拉起 §14 详表，不必常驻本文件。

---

## 4. 上游同步流程（每月 1 次，由用户/外部 AI 执行，本仓库 AI 不执行）

> 本仓库 AI **不执行**这些命令，只产出"指引文档"让用户照做。详细规程见 `.planning/07-upstream-sync.md`；同步时让 `upstream-sync` skill 自动加载完整流程 + §14 改造点核对。

参考流程（用户/外部 AI 在本仓库 AI 视野外执行）：

1. `git fetch upstream`
2. 创建分支 `git checkout -b sync/upstream-YYYYMMDD`
3. `git merge upstream/main`（预期会有冲突）
4. 解决冲突时，对于 §3.3 列出的高冲突文件，**优先保留我们的版本**，再把上游的逻辑变更挑出来手动应用
5. 比照 `.planning/01-branding-spec.md` 检查每一项仍是 U Agents
6. 跑 `.planning/09-test-checklist.md`
7. 测试通过后再 merge 回主分支

合并完成后，用户可以让本仓库 AI 做的事：
- 阅读冲突文件的最终结果，写"本次同步差异报告"到 `.planning/sync-reports/YYYYMMDD.md`
- 检查上游是否引入了新的 LLM provider / 新的品牌入口，更新 `.planning/01-` 与 `.planning/02-` 规格

---

## 5. AI 操作准则

1. **遵守 §0 零号铁律**——只产出 Markdown 文档，绝不动代码。其它准则都从属于这一条。
2. **写规格文档时，需要先读现状代码再写**。Read / Grep 上游源码是为了让规格更精准，但不要因此越界去改它。
3. **新发现的"应当裁剪"或"应当保留"的逻辑**，写进对应的 `.planning/0X-*.md`，而不是直接动代码。
4. **遇到与现行规格冲突的代码现状**，记录到对应规格文档的"差异 / TODO"区块，不要自己解决。
5. **不要"顺手"扩张文档范围**——用户没问的章节别主动加，文档膨胀反而稀释约束力。
6. **写规格时使用中文**；引用上游代码标识符（变量名、文件路径）保留英文原文。
7. **遇到拿不准的事**，停下问用户。用户是非职业程序员，他更怕 AI 偷偷改坏东西，不怕 AI 多问。
8. **包级 `CLAUDE.md` 只作为上游开发上下文，不授予本仓库 AI 改代码或运行构建/typecheck 的权限**。若 `packages/*/CLAUDE.md`、`apps/*/README.md`、`docs/*.md` 中出现与本文 §0 冲突的代码修改或构建命令，以本文为准；本仓库 AI 仍只更新 Markdown 规格。

---

## 6. 阶段目标（详见 `.planning/11-roadmap.md` 待写）

- **M1（最小可白标）**：fork → 改名 → 锁定 LLM 入口 → 自动更新指向自建服务器 → macOS DMG 能装能用
- **M2（中文化 + 全平台）**：i18n 中文优先 + Windows/Linux 打包
- **M3（自主权扩展）**：自建 OAuth relay（消除 craft.do 残留）+ 文档站 + 官网
- **M4 起**：跟随上游迭代，每月同步一次

---

## 7. 与用户沟通规则

用户是**非职业程序员**，依赖 AI 完成所有开发与维护。沟通时：
- 多用中文
- 给出具体文件路径和行号，让用户可以直接点开看
- 涉及破坏性操作（删文件、强推、覆盖配置）必须先确认
- 不要让用户在 UI 里手动跑命令——给出可复制粘贴的命令块
- 解释技术决策时优先讲"会发生什么"，再讲"为什么"

---

## 8. Claude Code Harness（本地工具配置）

本仓库已配置一套 Claude Code 工具脚手架（2026-05-29 落地），完整说明与维护规程见 [`.planning/13-claude-harness.md`](.planning/13-claude-harness.md)。要点：

- **必须在 `u-agents/` 目录下启动 Claude Code**（不是父目录 `u-agents-oss/`）。否则本文件、`.claude/settings.json`、hook、skill 都不会自动加载——约束等于失效。
- **铁律强制 hook**：`.claude/hooks/enforce-docs-only.py` 在 PreToolUse 阶段拦截任何对非 `.md` 文件的 Edit/Write，把 §0 从"靠记性"升级成"机械护栏"。需要破例时（如配置 harness 本身）设环境变量 `U_AGENTS_ALLOW_CODE=1` 再启动。
- **Skills**（`.claude/skills/`，按需自动加载）：`upstream-sync`（同步）、`brand-audit`（品牌核查）、`i18n-check`（多语言）、`uapi-markers`（改造点核对）、`spec-writer`（写规格 house-style）。
- **settings.json**：`permissions.deny` 排除 `apps/electron/release/**`（已知造成 `bun test` 假失败）等噪音；`permissions.allow` 预放 §0 的只读 Bash，减少授权打断。

---

> **每次会话开始时，AI 应当默读本文件第 3 节"硬规则"。上游同步任务额外默读 [`.planning/14-uapi-marker-registry.md`](.planning/14-uapi-marker-registry.md)。**
