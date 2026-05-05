# M2 apps/cli rename — craft-cli → u-agents-cli

**任务**：清理 apps/cli 4 处用户/二进制可见 craft 残留
**优先级**：P3（M2 边界——独立 CLI app，0 调用方，DMG 不含）
**关联**：[REVIEW-5-DEEP §🔵 第 11 项](sync-reports/REVIEW-5-DEEP-2026-05-04.md)

---

## 1. 背景

`apps/cli/` 是独立 CLI app entry：
- `name`: `@u-agents/cli` ✅（已改）
- `bin`: **`craft-cli`** ❌（待改）
- 0 个 package import 它
- packaged DMG 不含 binary（DMG 只含 `craft-cli.md` doc，已计划保留）
- M1 不发布；M2/M3 评估发布

**改造范围**：仅 4 处真"craft 字面量需改"。其他 6 处（`craft-public` / `craft-kb` 等）是 e2e 测试连真实 craft.do MCP 的 fixture slug，**保留**——改了测试跑不通。

---

## 2. 修改清单

### 改动 1 — `apps/cli/package.json:9`

```diff
  "bin": {
-   "craft-cli": "src/index.ts"
+   "u-agents-cli": "src/index.ts"
  },
```

### 改动 2 — `apps/cli/src/index.ts:3` 头部 JSDoc

```diff
- * craft-cli — Terminal client for U Agents server.
+ * u-agents-cli — Terminal client for U Agents server.
```

### 改动 3 — `apps/cli/src/index.ts:1054` tmpDir 前缀

```diff
- const tmpDir = await mkdtemp(`${tmpdir()}/craft-validate-`)
+ const tmpDir = await mkdtemp(`${tmpdir()}/u-agents-validate-`)
```

加 `// U-API:` marker 注释。

### 改动 4 — `apps/cli/src/index.ts:1379` skill description

```diff
- description: "Validation skill created by craft-cli"
+ description: "Validation skill created by u-agents-cli"
```

加 `// U-API:` marker 注释。

---

## 3. 不改清单（已确认）

| 位置 | 字面量 | 保留原因 |
|---|---|---|
| `commands.test.ts:167, 171` | `'craft-kb', 'github'` | e2e 测试 source slug |
| `run.test.ts:189, 194, 236, 243, 353` | `'craft-kb'` / `'craft-public'` | e2e 测试 source slug |
| `index.ts:1332, 1335-1336, 1342, 1355` | `craft-public` / `mcp:craft-public` | 真连 craft.do MCP 的 e2e fixture |

这些**不能改**——改了 e2e 测试连不上真实 source 就 fail。

---

## 4. 给执行 AI 的精准提示词

```
执行 M2 apps/cli rename（按 .planning/M2-CLI-RENAME-SPEC.md）。

任务：4 处编辑 + 2 个 marker。仅 apps/cli/ 一个目录。

【改动 1】apps/cli/package.json:9
  bin: { "craft-cli": "src/index.ts" }
  → bin: { "u-agents-cli": "src/index.ts" }

【改动 2】apps/cli/src/index.ts:3 (JSDoc 头)
  * craft-cli — Terminal client for U Agents server.
  → * u-agents-cli — Terminal client for U Agents server.

【改动 3】apps/cli/src/index.ts:1054
  旧：const tmpDir = await mkdtemp(`${tmpdir()}/craft-validate-`)
  新：// U-API: tmpDir prefix renamed (M2 cli rename, 2026-05-05)
      const tmpDir = await mkdtemp(`${tmpdir()}/u-agents-validate-`)

【改动 4】apps/cli/src/index.ts:1379
  旧：description: "Validation skill created by craft-cli"
  新：// U-API: skill description rebrand (M2 cli rename, 2026-05-05)
      description: "Validation skill created by u-agents-cli"

不改：
- 任何 e2e 测试 fixture 中 'craft-kb' / 'craft-public' / 'mcp:craft-public'
  字面量（这些是 e2e 连真实 craft.do MCP 的 source slug，改了 test fail）

校验：

  # (a) typecheck 0 errors
  bun run typecheck:all

  # (b) bin 名已改
  grep -E "\"u-agents-cli\":\s*\"src/index.ts\"" apps/cli/package.json
  # 期望：1 行命中

  # (c) craft-validate / craft-cli skill description 已改
  grep -nE "craft-validate-|created by craft-cli" apps/cli/src/index.ts
  # 期望：0 命中

  # (d) e2e fixture 保留（不应被改）
  grep -c "craft-public" apps/cli/src/index.ts
  # 期望：≥ 4（保留这些 fixture）

  # (e) U-API 标记数 59 → 61（+2 markers）
  grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
  # 期望：61

  # (f) packages/shared test baseline 不变 (13 stable + 2 OAuth flaky)
  cd packages/shared && bun test 2>&1 | tail -3

提交：单 commit
  refactor(cli): rename craft-cli → u-agents-cli (M2)

完成后回报：(a) typecheck (b) bin 名 (c) 0 命中 (d) e2e fixture 保留数 (e) U-API 标记 61 (f) test (g) commit hash
```

---

## 5. 修复落地后文档收尾

1. CLAUDE.md §3.7 基线 59 → 61
2. REVIEW-5-DEEP §🔵 第 11 项 ✅
3. 11-roadmap.md M2 范围加"apps/cli rename ✅"
4. 本 spec §6 加 commit hash

---

## 6. 修复执行回报（待填）

待执行 AI 完成。

---

## 7. 风险评估

| 维度 | 评估 |
|---|---|
| typecheck | 0 风险 |
| test | 0 风险（e2e fixture 保留，单元测试不受影响）|
| 用户 | 0 风险（apps/cli M1 不发布，无现有用户）|
| 上游同步 | 极低（apps/cli 上游可能也变化少；4 处 marker 帮识别）|

**总评：极低风险，纯品牌一致性 cleanup**。
