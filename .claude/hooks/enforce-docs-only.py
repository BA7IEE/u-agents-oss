#!/usr/bin/env python3
"""
enforce-docs-only.py — U Agents 仓库 §0 零号铁律的机械护栏。

作为 PreToolUse hook 运行（matcher: Write|Edit|MultiEdit|NotebookEdit）。
拦截任何对非 .md 文件的写操作，把"AI 只搞文档、永不动代码"从靠记性升级成硬规则。
详见 CLAUDE.md §0 / §8 与 .planning/13-claude-harness.md。

退出码约定（Claude Code hook 协议）：
  0  放行
  2  拦截，stderr 文案回喂给模型

破例：设环境变量 U_AGENTS_ALLOW_CODE=1（或 true/yes）启动，则全部放行——
对应 §0 "用户当次明确指令可破例，一次只覆盖一次任务"。
"""
import json
import os
import sys

ALLOWED_EXT = (".md", ".markdown")
ESCAPE_ENV = "U_AGENTS_ALLOW_CODE"


def escape_hatch_on() -> bool:
    val = os.environ.get(ESCAPE_ENV, "").strip().lower()
    return val in ("1", "true", "yes", "on")


def extract_path(tool_input: dict) -> str:
    # Write/Edit/MultiEdit 用 file_path；NotebookEdit 用 notebook_path
    return (
        tool_input.get("file_path")
        or tool_input.get("notebook_path")
        or ""
    )


def main() -> int:
    if escape_hatch_on():
        return 0

    try:
        payload = json.load(sys.stdin)
    except Exception:
        # 解析失败时 fail-open：不阻断正常 .md 工作流；护栏只是 backstop。
        return 0

    tool_name = payload.get("tool_name", "")
    if tool_name not in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        return 0

    tool_input = payload.get("tool_input") or {}
    path = extract_path(tool_input)
    if not path:
        return 0

    if path.lower().endswith(ALLOWED_EXT):
        return 0

    sys.stderr.write(
        "[U Agents 零号铁律] 已拦截对非 Markdown 文件的写操作：\n"
        f"  {path}\n\n"
        "本仓库 AI 只产出 .md 文档，绝不修改源码/配置（见 CLAUDE.md §0）。\n"
        "代码改造请写进 .planning/*.md 规格，由用户或执行会话落地。\n"
        "若用户当次明确要求破例，请用 U_AGENTS_ALLOW_CODE=1 重新启动 Claude Code。\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
