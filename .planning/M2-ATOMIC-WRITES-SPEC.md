# M2 atomicWriteFileSync 替换 writeFileSync（REVIEW-5 §1 P1）

**任务**：用户数据持久化路径全部改用 `atomicWriteFileSync`，防断电/进程崩溃时 partial write 损坏文件
**优先级**：P1（数据完整性）/ M1 单机用户首次发现"workspace 列表丢了"会很糟
**关联**：[REVIEW-5-DEEP §1 P1](sync-reports/REVIEW-5-DEEP-2026-05-04.md)

---

## 1. 背景

`packages/shared/src/utils/files.ts:36` 已有 `atomicWriteFileSync` helper：

```typescript
export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = filePath + '.tmp';
  try {
    writeFileSync(tmpPath, data);
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch {}
    throw error;
  }
}
```

POSIX `rename` 是原子操作——要么完全成功要么完全失败。这种 write-temp-then-rename 模式防止 partial write 损坏文件（断电、进程被 kill、磁盘满）。

**已用样板**：`packages/shared/src/workspaces/storage.ts:162` 一处。

**全仓 113 处 `writeFileSync`** 大多是临时文件 / 一次性输出，**不需要**原子化。本次只改 P0/P1 用户数据持久化路径（共 11 处）。

---

## 2. 修改清单

### 🔴 P0（真"用户能感受到的数据丢失"路径，6 处）

| # | 文件:行 | 写入内容 | 丢失影响 |
|---|---|---|---|
| 1 | `packages/shared/src/config/storage.ts:292` | `CONFIG_FILE` (`~/.u-agents/config.json`) | **workspace 列表 + LLM connection 配置全部丢** |
| 2 | `packages/shared/src/config/preferences.ts:57` | `PREFERENCES_FILE` (`~/.u-agents/preferences.json`) | 用户偏好（语言/主题/快捷键等）丢 |
| 3 | `packages/shared/src/config/storage.ts:1097` | `DRAFTS_FILE` (`~/.u-agents/drafts.json`) | 用户输入的草稿丢 |
| 4 | `packages/shared/src/config/storage.ts:1204` | `APP_THEME_FILE` | 自定义主题丢 |
| 5 | `apps/electron/src/main/window-state.ts:44` | `WINDOW_STATE_FILE` 写入 | 窗口位置/大小丢 |
| 6 | `apps/electron/src/main/window-state.ts:83` | `WINDOW_STATE_FILE` 重置（重置场景同样需要原子）| 重置失败留半文件 |

### 🟡 P1（session/plan，单 session 数据完整性，5 处）

| # | 文件:行 | 写入内容 | 丢失影响 |
|---|---|---|---|
| 7 | `packages/shared/src/config/storage.ts:879` | `conversation.json`（session 主体）| 单个会话历史损坏 |
| 8 | `packages/shared/src/config/storage.ts:903` | `conversation.json`（sanitized 重写）| 同上 |
| 9 | `packages/shared/src/config/storage.ts:934` | `conversation.json`（清空）| `'{}'` 写入失败留半 |
| 10 | `packages/shared/src/config/storage.ts:954` | `plan.json` | 单个 plan 损坏 |
| 11 | `packages/messaging-gateway/src/topic-registry.ts:197` | `topic-registry.json` | Telegram topic 映射丢 |

### ⚪ 不改（114 - 11 = 103 处）

- 临时文件（`script-sandbox.ts`、`transform-data.ts`、`render-template.ts`）— 用完就删
- 工件输出（`render-template.ts:76`、`generate-icons.ts:144`）— 用户主动重生成
- 二进制下载（`messaging-gateway/lark/telegram/index.ts`）— 失败可重试
- 静态 stub（`apps/webui/shims/node-builtins.ts`）— 不真写
- Capability 接口（`session-tools-core/context.ts:534`、`session-mcp-server/src/index.ts:161`）— 由调用方决定，调用方在上面 11 处覆盖
- session-mcp-server preferences/feedback `:235, :247` — 跨进程写本地 prefs，**M2 后续再评估**（subprocess 写盘场景特殊，可能需要不同保护）
- interceptor-common.ts 的 api-error/metadata — 频繁小写，单条丢失影响极小（只是诊断数据）

---

## 3. 修改模式

### 3.1 标准替换

```typescript
// 旧
import { writeFileSync, ... } from 'fs';
// ...
writeFileSync(filePath, data, 'utf-8');

// 新
import { ... } from 'fs';  // 移除 writeFileSync 如其他地方未用
import { atomicWriteFileSync } from '<相对路径>/utils/files.ts';
// ...
atomicWriteFileSync(filePath, data);  // helper 默认 utf-8
```

### 3.2 各文件 import 路径

| 修改文件 | atomicWriteFileSync import 路径 |
|---|---|
| `packages/shared/src/config/storage.ts` | `from '../utils/files.ts'` |
| `packages/shared/src/config/preferences.ts` | `from '../utils/files.ts'` |
| `packages/messaging-gateway/src/topic-registry.ts` | `from '@u-agents/shared/utils/files'` |
| `apps/electron/src/main/window-state.ts` | `from '@u-agents/shared/utils/files'` |

### 3.3 加 U-API 标记（让 §3.7 抓得到）

每个文件**首次** import atomicWriteFileSync 上方加一行：

```typescript
// U-API: atomic writes for user-data persistence (REVIEW-5 P1, 2026-05-05) —防断电/crash partial write
import { atomicWriteFileSync } from '...';
```

4 个文件 × 1 marker = +4 个 marker（基线 51 → 55，需 §3.7 基线刷新）。

---

## 4. 给执行 AI 的精准提示词

```
执行 REVIEW-5 §1 P1 atomicWriteFileSync 修复（按 .planning/M2-ATOMIC-WRITES-SPEC.md）。

任务范围：4 个文件 11 处 writeFileSync → atomicWriteFileSync 替换。

【文件 1】packages/shared/src/config/storage.ts （7 处）
- L9 import：保留 writeFileSync（其他位置仍用，比如 :148/157/164/1259/1423 是 config-defaults / cp）
- L?? 加新 import: import { atomicWriteFileSync } from '../utils/files.ts';
- 上方加 // U-API: marker
- L292: writeFileSync(CONFIG_FILE, ..., 'utf-8') → atomicWriteFileSync(CONFIG_FILE, ...)
- L879/903/934/954: 同样替换（注意 L934 是写 '{}' 字符串）
- L1097/1204: 同样替换

【文件 2】packages/shared/src/config/preferences.ts （1 处）
- L1 import 改：移除 writeFileSync（文件其他地方未用）
- 加 import { atomicWriteFileSync } from '../utils/files.ts';
- 上方加 // U-API: marker
- L57: writeFileSync(...) → atomicWriteFileSync(...)

【文件 3】packages/messaging-gateway/src/topic-registry.ts （1 处）
- L22 import 改：移除 writeFileSync（验证文件其他地方未用）
- 加 import { atomicWriteFileSync } from '@u-agents/shared/utils/files';
- 上方加 // U-API: marker
- L197: writeFileSync(this.filePath, ..., 'utf8') → atomicWriteFileSync(this.filePath, ...)

【文件 4】apps/electron/src/main/window-state.ts （2 处）
- L1 import 改：移除 writeFileSync（仅这 2 处用）
- 加 import { atomicWriteFileSync } from '@u-agents/shared/utils/files';
- 上方加 // U-API: marker
- L44 + L83: 同样替换

校验：

  # (a) typecheck 0 errors
  bun run typecheck:all

  # (b) 11 处目标行已替换（grep 应都没残留 writeFileSync 在那些行）
  grep -nE "writeFileSync\(CONFIG_FILE|writeFileSync\(PREFERENCES_FILE|writeFileSync\(DRAFTS_FILE|writeFileSync\(APP_THEME_FILE|writeFileSync\(WINDOW_STATE_FILE|writeFileSync\(this\.filePath|writeFileSync\(filePath, JSON\.stringify\(conversation|writeFileSync\(filePath, JSON\.stringify\(sanitizedConversation|writeFileSync\(filePath, '\{\}'|writeFileSync\(filePath, JSON\.stringify\(plan" packages apps --include="*.ts" 2>/dev/null | grep -v node_modules
  # 期望：0 命中

  # (c) atomicWriteFileSync 调用数应增加（基线 1 → 12）
  grep -rEn "atomicWriteFileSync\(" packages apps --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v "function atomic\|export.*atomic" | wc -l
  # 期望：12（含 workspaces/storage.ts:162 那 1 处既存样板 + 新增 11 处）

  # (d) U-API 标记数 51 → 55（4 文件各 +1 marker）
  grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
  # 期望：55

  # (e) packages/shared 测试基线 = 13 fail 不变
  cd packages/shared && bun test 2>&1 | tail -3

提交：单 commit
  fix(reliability): atomicWriteFileSync for 11 user-data persistence sites (REVIEW-5 P1)

完成后回报：(a) typecheck (b) 11 处 grep 0 命中 (c) atomic 调用数 12 (d) U-API 51→55 (e) test (f) commit hash
```

---

## 5. 修复落地后文档收尾（**2026-05-05 完成**）

1. ✅ CLAUDE.md §3.7 基线刷新 51 → **55**
2. ✅ REVIEW-5-DEEP §🔵 M2 范围第 9 项标 ✅
3. ✅ 11-roadmap.md M2 安全行 atomicWriteFileSync 子项标 ✅
4. ✅ 本 spec 落地 commit：**`25d38ab9`**

## 修复执行回报（commit `25d38ab9`）

| 校验项 | 结果 |
|---|---|
| typecheck:all | EXIT=0 ✓ |
| 11 处目标行 grep 残留 | 0 命中 ✓ |
| atomicWriteFileSync 调用数 | 12 ✓ (1 既存 + 11 新增) |
| U-API 标记数 | 51 → **55** ✓ (+4 markers) |
| packages/shared test | 13 fail（baseline 不变） ✓ |

> ⚠️ **spec 笔误校正**：本文 §4 提示词原写"storage.ts （8 处）"，实际 §2 表列 7 项（P0 3 + P1 4），合计 11 处（7+1+1+2）。执行 AI 按 §2 表执行 = 正确。spec §4 已修。

---

## 6. 风险评估

| 维度 | 评估 |
|---|---|
| typecheck | 0 风险（接口签名相同：`(path, string) => void`）|
| 测试 fail | 0 风险（baseline 13 fail 不变）|
| 性能 | 极小开销（每次写多 1 个 rename syscall，远小于 fs flush 时间）|
| 行为变化 | 0（成功路径相同；失败路径从"半写文件"变为"无变化"——更好）|
| 上游同步 | 低风险（上游若改这些行需手动 review，4 marker 帮助识别）|

**总评：极低风险高价值，跟 TLS 修复同性质（短小精悍 P 安全任务）**。

---

## 7. M2 安全主线进度（**已更新到 commit `25d38ab9`**）

- ✅ TLS 校验严格化（commit `c516e4d2`）
- ✅ **atomicWriteFileSync 用户数据持久化（commit `25d38ab9`）**
- ⏸ `~/.u-agents/` 目录权限 0o700
- ⏸ Token 输入长度限制
- ⏸ secure-storage.ts 解密失败改 backup-then-rebuild（M3 范围）
