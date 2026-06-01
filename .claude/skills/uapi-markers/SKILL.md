---
name: uapi-markers
description: 核对 U Agents fork 的 // U-API: 代码改造点标记与同步基线。当任务涉及统计改造点数量、核对基线、定位某个改造点在哪个文件、或新增改造点需要登记时触发。只做核查 + 登记到 .planning，不改源码。
---

# `// U-API:` 改造点核对

> 登记表正本：[`.planning/14-uapi-marker-registry.md`](../../../.planning/14-uapi-marker-registry.md)。
> 标记的"约束力"在 `CLAUDE.md` §3.7。本 skill 只做核查/定位/登记，不改源码。

## 当前基线（下面是写作时数值，**实际永远以 §14 §0 为准**）
- U-API 标记总数 **98**（允许 96–100）
- `/* U-API START */` = **9**，`/* U-API END */` = **9**（必须相等）

> 别把这里的数字当权威——同步后基线变了只更新 §14 §0，这段保持"以 §14 §0 为准"即可。

## 校验 grep（只读）
```bash
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l   # 期望 98
grep -rE --exclude-dir=node_modules "/\* U-API START" packages apps --include="*.ts" --include="*.tsx" | wc -l  # 9
grep -rE --exclude-dir=node_modules "/\* U-API END"   packages apps --include="*.ts" --include="*.tsx" | wc -l  # 9
```

## 用法
- **定位某改造点**：在 §14 §3 表用类别/文件查到"定位（用 grep 找）"列的符号名，`grep -n "<符号>" <文件>`（行号会漂，符号名稳）。
- **新增改造点**：必须同时①源码加 `// U-API:` 标记（用户落地）②§14 §3 表补一行 ③加单测（C5）④刷新 §0 基线数字。
- **超出 ±2**：停下逐项核对——多半是 git 自动合并吞掉改造，或有未登记的新改造。
