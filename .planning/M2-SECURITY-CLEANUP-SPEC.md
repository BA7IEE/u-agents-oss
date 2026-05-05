# M2 安全主线收尾（dir 0o700 + Token 长度限制）

**任务**：完成 M2 安全主线剩余 2 项 — `~/.u-agents/` 目录权限 + LLM API key 长度限制
**优先级**：P1（数据隐私 + 防误操作）
**关联**：[REVIEW-5-DEEP §2 P1](sync-reports/REVIEW-5-DEEP-2026-05-04.md) 第 4 + 5 项

---

## 1. 任务 A — `~/.u-agents/` 目录权限 0o700

### 现状

3 处 `mkdirSync(CONFIG_DIR, { recursive: true })` 都**未传 mode**：

```
packages/shared/src/config/watcher.ts:367
packages/shared/src/config/storage.ts:221
apps/electron/src/main/window-state.ts:42
```

macOS 默认 `0o755`（other 可读）→ 多用户机器上其他 user 能读 `~/.u-agents/sessions/` 下的会话 JSONL（含 prompt + 工具输出 + 文件路径）。**Token 不在此目录**（在 keychain），但 session 内容可能含敏感对话。

### 修复

3 处都加 `mode: 0o700`：

```typescript
mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
```

### ⚠️ 既存用户处理

`mkdirSync` with `recursive: true` 对**已存在的目录**：
- ✅ 不抛错
- ❌ **不修改 mode**

含义：
- **新装机用户**首次启动 → 目录 0o700 ✅
- **现存用户**（已是 0o755）→ 不变（保留 0o755）

**M1 决策**：不主动 `chmod` 既存用户的目录。理由：
1. macOS 上 user-only 机器（绝大多数）实际无影响
2. 主动改用户目录权限有 surprise 风险
3. 用户重装时（删 ~/.u-agents 重建）会自动获得 0o700
4. 真要老用户立即收紧，下次发版 release notes 提示用户手动 `chmod 700 ~/.u-agents`

---

## 2. 任务 B — LLM API key 长度限制

### 现状

`packages/shared/src/credentials/manager.ts:291` 的 `setLlmApiKey` 直接落盘，**无长度校验**：

```typescript
async setLlmApiKey(connectionSlug: string, apiKey: string): Promise<void> {
  await this.set({ type: 'llm_api_key', connectionSlug }, { value: apiKey });
}
```

风险：用户在 `ApiKeyInput` 不小心粘贴大文本（一篇文章 / 整个文件内容）→ 全部加密入盘 → 占磁盘 + 后续每次启动加载到内存。

### 上游已有先例

`packages/server-core/src/bootstrap/headless-start.ts:83` 有 server token 的长度校验（`MIN_TOKEN_LENGTH = 16`），可参考相同模式。

### 修复

在 `setLlmApiKey` 入口加长度 + 空校验：

```typescript
const MIN_LLM_API_KEY_LENGTH = 1;
const MAX_LLM_API_KEY_LENGTH = 4096;  // 4 KB — 远大于任何真实 token (Anthropic ~100, OpenAI ~50, U-API ~50)

async setLlmApiKey(connectionSlug: string, apiKey: string): Promise<void> {
  if (apiKey.length < MIN_LLM_API_KEY_LENGTH) {
    throw new Error('API key cannot be empty');
  }
  if (apiKey.length > MAX_LLM_API_KEY_LENGTH) {
    throw new Error(`API key too long (${apiKey.length} chars, max ${MAX_LLM_API_KEY_LENGTH}). Did you accidentally paste a file?`);
  }
  await this.set({ type: 'llm_api_key', connectionSlug }, { value: apiKey });
}
```

### 调用方影响

3 个 caller 已 trim/empty-check（不会回归）：
- `packages/server-core/src/handlers/rpc/llm-connections.ts:240` — RPC 入口
- `packages/shared/src/agent/backend/factory.ts:689` — 用 `trimmedKey`
- `packages/shared/src/config/storage.ts:2553` — 已弃用 legacy migration（M1 用户跑不到）

错误会冒泡到 RPC 层 → renderer onboarding UI 看到错误对话框。M1 onboarding 流程下用户不会粘贴超长字符串（输入框默认 `<input>`），但 hotfix 防御性 catch 误粘贴。

---

## 3. 给执行 AI 的精准提示词

```
执行 M2 安全主线收尾 2 项（按 .planning/M2-SECURITY-CLEANUP-SPEC.md）。

【任务 A — 目录权限】
3 处 mkdirSync 加 { mode: 0o700 }：

1. packages/shared/src/config/watcher.ts:367
   旧: mkdirSync(CONFIG_DIR, { recursive: true });
   新: mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

2. packages/shared/src/config/storage.ts:221
   同上替换

3. apps/electron/src/main/window-state.ts:42
   同上替换（注意上下文这行 statement 末尾无分号）

每个文件首次 mkdirSync 处加 marker（已加过的位置不重复）：
  // U-API: dir mode 0o700 for multi-user machine privacy (M2 cleanup, 2026-05-05)

【任务 B — API key 长度限制】
修改 packages/shared/src/credentials/manager.ts:

L?? 文件顶部（合适位置如其他常量附近）加：
  // U-API: LLM API key length bounds (M2 cleanup, 2026-05-05) — defend against accidental large-text paste
  const MIN_LLM_API_KEY_LENGTH = 1;
  const MAX_LLM_API_KEY_LENGTH = 4096;

L291 setLlmApiKey 函数体改：
  async setLlmApiKey(connectionSlug: string, apiKey: string): Promise<void> {
    if (apiKey.length < MIN_LLM_API_KEY_LENGTH) {
      throw new Error('API key cannot be empty');
    }
    if (apiKey.length > MAX_LLM_API_KEY_LENGTH) {
      throw new Error(`API key too long (${apiKey.length} chars, max ${MAX_LLM_API_KEY_LENGTH}). Did you accidentally paste a file?`);
    }
    await this.set({ type: 'llm_api_key', connectionSlug }, { value: apiKey });
  }

校验：

  # (a) typecheck 0 errors
  bun run typecheck:all

  # (b) 3 处 mkdirSync 都含 mode: 0o700
  grep -rnE "mkdirSync\(CONFIG_DIR.*mode:\s*0o700" packages apps --include="*.ts" 2>/dev/null | grep -v node_modules | wc -l
  # 期望：3

  # (c) MAX_LLM_API_KEY_LENGTH 已定义
  grep -n "MAX_LLM_API_KEY_LENGTH" packages/shared/src/credentials/manager.ts | wc -l
  # 期望：≥ 2 (一处 const + 一处 reference)

  # (d) U-API 标记数 55 → 59 (4 marker: 3 dir mode + 1 length bounds)
  grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
  # 期望：59

  # (e) test 13 fail 不变
  cd packages/shared && bun test 2>&1 | tail -3

提交：单 commit
  fix(security): dir mode 0o700 + LLM API key length bounds (M2 cleanup)

完成后回报：(a) typecheck (b) 0o700 命中数 (c) MAX_ 定义数 (d) U-API 数 (e) test (f) commit hash
```

---

## 4. 修复落地后文档收尾

1. CLAUDE.md §3.7 基线 55 → 59
2. REVIEW-5-DEEP §🔵 M2 范围第 10 项 ✅
3. 11-roadmap.md M2 安全行所有子项 ✅
4. 本 spec §5 加 commit hash

---

## 5. 修复执行回报（待填）

待执行 AI 完成。

---

## 6. M2 安全主线进度（修完后）

- ✅ TLS 校验严格化（commit `c516e4d2`）
- ✅ atomicWriteFileSync 用户数据持久化（commit `25d38ab9`）
- ✅ **dir 0o700 + Token 长度限制（本 spec 完成后）**
- ⏸ secure-storage.ts 解密失败改 backup-then-rebuild（M3 范围）
- ⏸ apps/cli 重命名为 u-agents-cli（M2 后期 / 与 CLI 改造一起做）

**M2 安全主线 4/4 = 100% 完成**（M3 范围除外）

---

## 7. 风险评估

| 维度 | 评估 |
|---|---|
| typecheck | 0 风险 |
| test | 0 风险（baseline 13 fail 不变） |
| 既存用户行为 | 0 影响（dir 已存在不改 mode；short token 用户重新输入即修） |
| 新装机用户 | dir 直接 0o700 + 误粘贴会被 catch 友好报错 |
| 上游同步 | 低风险（4 marker 帮助识别，setLlmApiKey 中文 throw msg 不会被上游覆盖） |

**总评：极低风险高价值，M2 安全主线完美收尾**。
