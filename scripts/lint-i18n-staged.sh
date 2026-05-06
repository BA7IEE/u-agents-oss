#!/usr/bin/env bash
# lint-i18n-staged.sh — i18n lint for staged locale files (pre-commit)
#
# v0.9.1 上游 package.json 引用 lint:i18n:staged 但漏实现文件（C13 模式）。
# 本仓库自实现：检测 staged 里是否有 packages/shared/src/i18n/locales/*.json，
# 有就跑 sort-locales --check + parity + coverage（与 validate:ci 等价）。
#
# 设计：pre-commit 速度优先；只有 i18n 文件改时才跑（多数 commit 不动 i18n
# 直接 skip）。
#
# U-API: M2.5 #5 — v0.9.1 上游引入 package.json 入口但漏实现文件，本仓库 stub 占位

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 检查 staged 里有没有 i18n 文件
staged_i18n=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^packages/shared/src/i18n/locales/.*\.json$' || true)

# 也检查代码改动（影响 t() callsite）
staged_code=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' || true)

if [[ -z "$staged_i18n" ]] && [[ -z "$staged_code" ]]; then
  echo "lint:i18n:staged — no staged i18n or TypeScript files, skipping"
  exit 0
fi

if [[ -n "$staged_i18n" ]]; then
  echo "lint:i18n:staged — staged i18n locale files:"
  echo "$staged_i18n" | sed 's/^/  /'
  echo
  echo "Running sort check..."
  bun run lint:i18n:sorted
  echo
  echo "Running parity check..."
  bun run lint:i18n:parity
fi

if [[ -n "$staged_code" ]]; then
  echo "Running coverage check..."
  bun run lint:i18n:coverage
fi
