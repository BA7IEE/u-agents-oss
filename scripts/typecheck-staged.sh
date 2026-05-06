#!/usr/bin/env bash
# typecheck-staged.sh — typecheck only staged TS files for pre-commit speed
#
# v0.9.1 上游 package.json 引用 typecheck:staged 但漏实现文件（C13 模式）。
# 本仓库自实现：跑 git diff --cached 拿 staged 列表，对受影响的 tsconfig
# 范围跑 tsc --noEmit。
#
# 简化策略：staged 文件只要有 .ts/.tsx 改动就跑全 typecheck（typecheck:all）。
# 增量 typecheck 复杂度高且对小 patch 提速不显著（Bun 的 tsc 很快）。
#
# U-API: M2.5 #5 — v0.9.1 上游引入 package.json 入口但漏实现文件，本仓库 stub 占位

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 看 staged 里有没有 .ts/.tsx
staged_ts=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' || true)

if [[ -z "$staged_ts" ]]; then
  echo "typecheck:staged — no staged TypeScript files, skipping"
  exit 0
fi

echo "typecheck:staged — running full typecheck for staged TS files:"
echo "$staged_ts" | head -10
if [[ $(echo "$staged_ts" | wc -l) -gt 10 ]]; then
  echo "  ... and more"
fi

bun run typecheck:all
