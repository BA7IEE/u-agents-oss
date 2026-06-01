# 13 — Claude Code Harness 配置规格

> 落地日期：2026-05-29。
> 依据：Anthropic《How Claude Code works in large codebases》的 harness 方法论（CLAUDE.md → hooks → skills → plugins → MCP，逐层叠加），套到本仓库"AI 只搞文档"的角色上。
> 本仓库 AI 维护本文件即可；非 .md 产物（settings.json / hook / skill 目录结构）已按用户单次破例直接落地，后续变更同样走"破例"或由用户执行。

---

## 0. 为什么要这套 harness

文章核心论点：**决定 Claude Code 表现的不是模型，而是围绕它的脚手架**。本仓库不是空白起步——已有相当成熟但偏重的 CLAUDE.md。本次优化目标 = 让 Claude 更会**写规格、对照代码核查规格**（本仓库 AI 的唯一职责），而不是更会改代码。

落地的取舍对应文章三条配置模式：① 让上下文精简可导航；② 随模型进化主动维护；③ 指派负责人/复审节奏。

---

## 1. ⚠️ 头号前提：在 `u-agents/` 目录启动

`u-agents/` 才是 git 仓库与全部规则所在；父目录 `u-agents-oss/` 不是 git 仓库、没有 CLAUDE.md。

**Claude Code 只从"启动目录"向上找 CLAUDE.md / `.claude/`，不向下找。** 若在父目录 `u-agents-oss/` 启动：
- `u-agents/CLAUDE.md` **不会**自动加载（实测 2026-05-29：父目录启动时只加载了 auto-memory，没加载 CLAUDE.md）；
- `u-agents/.claude/settings.json`、hook、skill 全部**不生效**——铁律护栏等于关掉。

✅ **正确做法**：每次都在 `u-agents/` 目录里启动 Claude Code（或把它设为项目根）。
> 自检：会话开始若没看到 CLAUDE.md §3 被加载，多半是启动目录错了，提醒用户切到 `u-agents/` 重开。

---

## 2. 落地清单（本次新增/改动，全部已就位）

| 文件 | 类型 | 作用 |
|---|---|---|
| `CLAUDE.md` | 改（瘦身 434→207 行）| §3.7 巨表搬走；新增 §8 harness 说明；§2 加代码地图与 13/14 指针 |
| `AGENTS.md` | 改（377→~40 行 stub）| 保留 §0 铁律，其余指向 CLAUDE.md，消除 71-vs-98 双源漂移 |
| `.planning/00-codebase-map.md` | 新 | 源码树地图（packages/apps 职责 + 关键文件 + 治理规格 + 高冲突区）|
| `.planning/14-uapi-marker-registry.md` | 新 | 从 §3.7 抽出的改造点登记表 + 基线 + 校验 grep + C1–C14 |
| `.planning/13-claude-harness.md` | 新 | 本文件 |
| `.claude/settings.json` | 新 | hook 注册 + permissions.deny（噪音）+ permissions.allow（只读 Bash）|
| `.claude/hooks/enforce-docs-only.py` | 新 | §0 铁律机械护栏（PreToolUse）|
| `.claude/skills/{upstream-sync,brand-audit,i18n-check,uapi-markers,spec-writer}/SKILL.md` | 新 | 5 个按需加载的 skill |

> `.claude/settings.local.json` 仍由 `.gitignore` 排除（用户私有覆盖）；其余 `.claude/` 文件随 git 提交、全员同享。

---

## 3. CLAUDE.md 瘦身（文章模式①）

**问题**：旧 CLAUDE.md 434 行，其中 §3.7 改造点登记表 + 基线史约 260 行（≈60%）只在每月同步用得上，却每次会话都加载——正是文章点名的"根文件臃肿、拖累性能"。AGENTS.md 又有 377 行近重复且已漂移到旧基线 71。

**改法**：
- §0 铁律 / §3.1–3.6 / §4 / §5 / §6 / §7 **逐字保留**（承重墙，不动）。
- §3.7 压成 ~12 行：留标记规范 + "同步必跑 grep / 超 ±2 停下"约束 + 指向 §14。
- 完整登记表搬 `.planning/14-uapi-marker-registry.md`，**当前基线数字只在 §14 维护**（CLAUDE.md 不再随每次同步改动，更稳定）。
- AGENTS.md 降 stub（保 §0，指向 CLAUDE.md）。

**演练效果**：
- 常驻上下文（CLAUDE.md + AGENTS.md）从 811 行 → 239 行（CLAUDE.md 207 + AGENTS stub 32）；改造点巨表（284 行）不再常驻，只在同步时按需加载 → 改规格类会话更快更准。
- 同步类会话：`upstream-sync` skill 按需拉起 §14 + 07，知识不丢，只是不再常驻。

---

## 4. 铁律强制 hook（文章模式：hooks 做确定性强制）

`.claude/hooks/enforce-docs-only.py`，注册为 `PreToolUse`（matcher `Write|Edit|MultiEdit|NotebookEdit`）。

- **行为**：写操作目标不是 `.md`/`.markdown` → 退出码 2 拦截，文案回喂模型。是 .md → 放行。
- **逃生阀**：环境变量 `U_AGENTS_ALLOW_CODE=1`（或 true/yes）启动 → 全放行，对应 §0「用户当次明确指令可破例」。
- **fail-open**：stdin 解析失败时放行（护栏是 backstop，不阻断正常 .md 流）。
- **已自测**：.ts/.json/.ipynb 拦截、.md 放行、逃生阀放行、坏输入放行——6 例全过。

> 价值：把 §0 从"靠模型记性"升级成"机械保证"。换模型、换 AI 工具、上下文被压缩后，铁律都不会松动——正是文章举的 "p4 edit hook" 同构。

---

## 5. Skills（文章模式：渐进式披露，按需加载）

5 个 skill 在 `.claude/skills/`，靠 `description` 关键词自动触发；正文精简，重内容指向 `.planning`。

| skill | 触发场景 | 指向 |
|---|---|---|
| `upstream-sync` | 每月上游同步、解冲突、写差异报告 | 07 / 08 / 14 / 01 / 02 / 09 |
| `brand-audit` | 品牌残留核查、双品牌核对 | 01 + 反向 grep |
| `i18n-check` | locale/中文化/parity·coverage·sorted | 10 + CI 三查命令 |
| `uapi-markers` | 改造点计数/定位/基线核对 | 14 |
| `spec-writer` | 写/改 `.planning/*.md` 规格 | CLAUDE.md §5 house-style |

每个 skill 都重申"只产出 .md、不改代码"，与 §0 一致。

---

## 6. LSP（文章："多语言导航最高价值投资之一"）—— 待用户安装

本仓库 93% TS/TSX，且 §14 整套方法就是"按符号 grep 定位"——正是 LSP 的强项（grep 一个常见符号返回上千行，LSP 只给真正指向同一符号的引用）。

**安装步骤（用户/环境操作，非 .md，AI 不执行）**：
1. 在 Claude Code 装 TypeScript 的 code-intelligence 插件（见 Claude Code 官方文档 LSP/plugins 章节）。
2. 装对应 language server 二进制（typescript-language-server / vtsls）。
3. 验证：让 Claude "go to definition / find references" 某个跨包符号（如 `createBackend`）能精确跳转。

收益：写规格时核对"某改造点的所有调用方"从 grep 猜测升级成精确引用，少烧上下文、少落错符号。优先级：中（grep 方案已能用，LSP 是增强）。

---

## 7. 插件打包 + 维护节奏（文章模式②③）

### 7.1 插件打包 —— 暂缓（够用即止）
文章建议把 skills/hooks/MCP 打包成 plugin 分发，避免"好设置只在小圈子流传"。但本仓库是**单人闭源**、`.claude/` 已随 git 提交——`git clone` 就拿到全套，**插件此刻收益≈0**（文章也警告别过早搭基础设施）。

**何时再做**：将来多人协作 / 多机 / 多仓复用时。届时结构：
```
.claude-plugin/plugin.json   # name, version, 描述
└── 复用现有 .claude/skills + .claude/hooks
```
通过 managed marketplace 分发。在此之前不建。

### 7.2 维护节奏（文章："每 3–6 月复审；大模型发布后也查"）
本仓库已有**每月上游同步**节奏——把 harness 复审挂进去（已写进 `upstream-sync` skill 收尾步骤）。每次同步顺带核对：

- [ ] CLAUDE.md 规则有没有在"和更强的新模型对着干"？（例：旧模型才需要的"拆成单文件"类限制，新模型可能反被拖累——文章原话）
- [ ] 为补模型/工具短板写的 skill/hook 是否已多余？（例：上游若加原生支持就删，类似文章的 p4 hook 案例）
- [ ] §14 基线是否已随本次同步刷新？
- [ ] 新增的规格文件是否要进 00-codebase-map / CLAUDE.md §2 索引？
- [ ] skill 的 `description` 是否还能精准触发、有没有过度触发？

---

## 8. 决策日志（为什么这么选）

- **§3.7 抽到 §14 而非删**：它是同步合规的承重内容（Apache §4(b) modification notices），只是不该常驻 → 移到按需加载。
- **AGENTS.md 降 stub 而非删**：部分工具只读 AGENTS.md；保 §0 防止丢最关键约束，同时消除双源漂移。
- **没有把 CLAUDE.md 散到上游源码子目录**（原 Phase 5 想法）：本仓库纪律是"上游树保持干净、改动靠 `// U-API:` 标记追踪"，往 `apps/electron/.../apisetup/` 塞 fork 专属 CLAUDE.md 会污染上游树；且 §3.3 已让 AI 对这些高冲突区"停下确认"，保护已存在。**改为**把高冲突区导航集中进 `00-codebase-map.md`（🔴 标记）+ `upstream-sync` skill。若将来确实想要子目录自动注入，再单独评估。
- **MCP 暂缓**：产品自带 session-mcp-server；开发 harness 不需要额外 MCP（文章："别在基础没跑通前搭 MCP"）。
- **permissions.deny 含 node_modules**：减少噪音；若写规格需读 SDK 内部，在 `.claude/settings.local.json` 本地覆盖（不影响版本化配置），对应文章"做代码生成的人可本地覆盖项目级排除"。

---

## 9. 给用户的一次性动作清单

1. **务必在 `u-agents/` 启动 Claude Code**（见 §1）——否则全套不生效。
2. 重开一次会话让新 settings/hook/skill 生效（hook 在配置加载后才激活）。
3. 可选：按 §6 装 TS LSP 插件 + language server。
4. 把 `.claude/`（除 `settings.local.json`）随下次提交进 git，全员/多机同享。
