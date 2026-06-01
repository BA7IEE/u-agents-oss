# AGENTS.md — U Agents (优智体)

> **本文件不再是规则正本。完整、最新的 AI 工作守则在 [`CLAUDE.md`](CLAUDE.md)，以它为准。**
>
> 历史原因：本文件曾与 `CLAUDE.md` 各维护一份全文，结果两边漂移（本文件一度停在改造点基线 71，而 `CLAUDE.md` 已到 98）。为消除"双源不一致"，自 2026-05-29 起本文件降为 stub——只保留下面的 §0 零号铁律（保证只读 `AGENTS.md` 约定的工具也不丢最关键约束），其余全部跳转到 `CLAUDE.md`。

---

## 0. 零号铁律：永不动代码，只搞文档

**本仓库 `u-agents/` 内的 AI 永远只产出 Markdown 文档（`.md`），永远不修改源码或运行会改变代码状态的命令。**

| 允许 | 禁止 |
|---|---|
| Read / Grep / Glob 任何文件（含源码） | Edit / Write 任何 `.ts` / `.tsx` / `.json` / `.yml` / `.yaml` / `.html` / `.css` / `.svg` 等源码与配置 |
| Edit / Write `.md`（仅 `u-agents/*.md` 与 `u-agents/.planning/*.md`）| Edit / Write 上游 `packages/` `apps/` `scripts/` 内任何非 `.md` 文件 |
| Bash 只读命令：`ls` / `cat` / `grep` / `find` / `wc` / `git log` / `git status` / `git show` / `git diff` / `git remote -v` | Bash 写入命令：`mv` / `rm` / `cp` / `sed -i` / `git checkout <file>` / `git merge` / `git pull` / `bun install` |

**例外**：仅当用户**当次明确指令**要求 AI 改代码或跑写入命令时，方可破例。一次破例只覆盖一次任务，不延续。自 2026-05-29 起此铁律由 `.claude/hooks/enforce-docs-only.py` 机械强制（破例需 `U_AGENTS_ALLOW_CODE=1`）。

---

## 其余全部内容 → 见 [`CLAUDE.md`](CLAUDE.md)

- §1 项目身份、§2 仓库布局与代码地图
- §3 硬规则（LLM 入口锁定 / 品牌替换 / 高冲突文件 / 包管理器锁定 / 双品牌区分 / §3.7 改造点标记）
- §4 上游同步流程
- §5 AI 操作准则、§7 与用户沟通规则
- §8 Claude Code Harness（settings / hooks / skills）

改造点登记表与同步基线见 [`.planning/14-uapi-marker-registry.md`](.planning/14-uapi-marker-registry.md)；
Claude Code harness 配置规格见 [`.planning/13-claude-harness.md`](.planning/13-claude-harness.md)。
