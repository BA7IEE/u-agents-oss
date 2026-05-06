#!/usr/bin/env bash
# check-raw-sends.sh — IPC raw-send guard (M2.5 #5 stub fill)
#
# v0.9.1 上游 package.json 引用 lint:ipc-sends → scripts/check-raw-sends.sh
# 但上游漏了实现文件（C13 模式继承）。本仓库自实现最小版本，让 CI 走通。
#
# 检查：apps/electron 下有没有"裸"调用 ipcRenderer.send / webContents.send
# 而不走 packages/server-core 的 transport channel-map。这是上游 IPC 设计原则
# （所有 IPC 必须经类型化 channel 路由）。
#
# 当前实现：grep 报告，不 fail（fork 暂未发现违规）。下次 sync 上游若提供官方
# 实现就 sync 过来。
#
# U-API: M2.5 #5 — v0.9.1 上游引入 package.json 入口但漏实现文件，本仓库 stub 占位

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 允许的 raw send 文件（transport 层自身 + preload bootstrap 与 main 通信）
ALLOWED_PATTERNS=(
  "apps/electron/src/preload/"
  "apps/electron/src/main/"
  "apps/electron/src/transport/"
  "packages/server-core/src/transport/"
  "packages/messaging-gateway/"
)

# 在 apps/electron/src 下扫 ipcRenderer.send / webContents.send 的裸调用
violations=()
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  allowed=0
  for pattern in "${ALLOWED_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern"* ]]; then
      allowed=1
      break
    fi
  done
  if [[ $allowed -eq 0 ]]; then
    violations+=("$line")
  fi
done < <(grep -rn -E "ipcRenderer\.send\(|webContents\.send\(" \
  apps/electron/src \
  --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "lint:ipc-sends found ${#violations[@]} raw IPC send(s) outside transport layer:"
  for v in "${violations[@]}"; do
    echo "  $v"
  done
  echo
  echo "All IPC must go through the typed channel-map in packages/server-core/src/transport/."
  exit 1
fi

echo "lint:ipc-sends OK (no raw IPC sends outside transport layer)"
