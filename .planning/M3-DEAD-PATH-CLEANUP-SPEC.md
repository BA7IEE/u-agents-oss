# M3-DEAD-PATH-CLEANUP-SPEC — 三死路径清理（与 M3-1 OAuth relay 同 commit）

> **优先级**：P0（M3-1，必须与 [M3-OAUTH-RELAY-SPEC.md](M3-OAUTH-RELAY-SPEC.md) 同 commit 落地）
> **目标**：清理 v0.9.1 闭环后浮现的 3 类 craft 死路径，避免与 OAuth relay 改造分散两个 commit 增加 cherry-pick 难度
> **预估**：与 M3-1 同 commit，**0.5 天**（含 grep 验证 + 单测）

---

## 修订记录

**2026-05-07（实施时修订）**：grep 实测后调整 CRAFT_DEBUG 决策。

| spec 原假设 | grep 实测 | 修订后决策 |
|---|---|---|
| `CRAFT_DEBUG` → 改名 `U_AGENTS_DEBUG` | 14+ 处真消费方（feature-flags / server / unified-network-interceptor / interceptor-common / debug.ts / agent/options.ts / pi-agent.ts × 2 / platform-headless × 2 / server/index.ts × 2）| **保留 `CRAFT_DEBUG`**——上游全局调试 flag，跨进程/SDK 边界用，跟用户可见无关，改名风险大于收益 |
| `CRAFT_SCRIPTS` → 改名 `U_AGENTS_SCRIPTS` | 0 真消费方（仅自身设置 + 1 处注释）| **删除整行设置**（scriptsDir 变量保留作 mainLog 输出用）|
| `CRAFT_AGENT_VERSION` → 改名 `U_AGENTS_VERSION` | 0 真消费方 | **删除整行设置** |
| `CRAFT_COMMANDS_ENTRY/CRAFT_CLI_ENTRY/CRAFT_COMMANDS_DOC_PATH/CRAFT_CLI_DOC_PATH` → 删除 | 0 真消费方 ✓ | 与 spec 一致，**删除** |

**最终落地**：删除 6 行 + 改 1 行注释 + 5 处 craft-clipboard → u-agents-clipboard。CRAFT_DEBUG 不动。

---

## 0. 为什么必须与 M3-1 同 commit

[REVIEW-21-FULL-2026-05-07.md §2.4 #2](sync-reports/REVIEW-21-FULL-2026-05-07.md) 强制要求"M3 cleanup 三死路径与 OAuth relay 改造**同 commit**清理"。原因：

1. **回滚单元一致**：M3-1 OAuth relay 是大改造，分发后若需要 hot-revert，cleanup 改动必须跟着回滚——拆 commit 后回滚选择性变弱
2. **commit 历史可读性**：M3-1 改造时每个 craft 字面量都该被审视；分两 commit 容易让"清完了 OAuth 但忘了 cleanup"
3. **§3.7 marker 表一次性更新**：避免 #43-#48 marker 跨两 commit 更新表头，引入临时基线漂移

---

## 1. 清理范围（grep 命中清单）

### 1.1 `apps/electron/src/main/index.ts:114, 150-161` — 7 个 `CRAFT_*` env

| 行 | 当前 | 处理 |
|---|---|---|
| 114 | `process.env.CRAFT_DEBUG = '1'` | 改名 `U_AGENTS_DEBUG`；同步 grep 整仓 `CRAFT_DEBUG` 消费方 |
| 150 | `process.env.CRAFT_SCRIPTS = scriptsDir` | 改名 `U_AGENTS_SCRIPTS`（grep 消费方）|
| 151-153 | `CRAFT_COMMANDS_ENTRY` 块 | **删除**（M1 已裁剪 craft-agents-commands package，详见 [04-feature-cuts.md](04-feature-cuts.md)）|
| 154-156 | `CRAFT_CLI_ENTRY` 块 | **删除**（M1 已裁剪 craft-cli package，[FEATURE_FLAGS.craftAgentsCli=false](../packages/shared/src/feature-flags.ts)）|
| 157-160 | `CRAFT_COMMANDS_DOC_PATH` + `CRAFT_CLI_DOC_PATH` | **删除**（同上） |
| 161 | `process.env.CRAFT_AGENT_VERSION = app.getVersion()` | 改名 `U_AGENTS_VERSION` |

> **重要**：删除 5 行（151-160）必须先 grep 全仓确认这些 env 没有任何消费方，否则改名而非删除。

```bash
# 跑这 5 个 grep 都必须 = 0（除了 main/index.ts 本身这一处定义）
grep -rn "CRAFT_COMMANDS_ENTRY\|CRAFT_CLI_ENTRY\|CRAFT_COMMANDS_DOC_PATH\|CRAFT_CLI_DOC_PATH" \
  packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "apps/electron/src/main/index.ts"
```

### 1.2 `packages/shared/src/utils/files.ts` 5 处 `craft-clipboard` 临时文件名

| 行 | 当前 | 改造后 |
|---|---|---|
| 473 | `\`craft-clipboard-files-${Date.now()}.js\`` | `\`u-agents-clipboard-files-${Date.now()}.js\`` |
| 592 | `\`craft-clipboard-${Date.now()}.png\`` | `\`u-agents-clipboard-${Date.now()}.png\`` |
| 688 | `\`craft-clipboard-${Date.now()}.png\`` | 同上 |
| 737 | `\`craft-clipboard-${Date.now()}.png\`` | 同上 |
| 752 | `\`craft-clipboard-script-${Date.now()}.js\`` | `\`u-agents-clipboard-script-${Date.now()}.js\`` |

> **影响域**：纯本地 tmpdir 临时文件名，无跨进程协议依赖——`replace_all` 安全。
> **C2 防护**（[CLAUDE.md §3.7 C2](../CLAUDE.md)）：用 Edit 工具不要 sed，规避 object key 引号问题（这里 5 处都是模板字符串，不是 object key，但保持习惯）。

### 1.3 `packages/shared/src/prompts/system.ts:533-540` — `Craft CLI` 三元分支

```typescript
// L532-540 现状
| Sources | ... |${FEATURE_FLAGS.craftAgentsCli ? `
| LLM Tool | \`${DOC_REFS.llmTool}\` | When using \`call_llm\` for subtasks |
| Craft CLI | \`${DOC_REFS.craftCli}\` | When managing labels/sources/skills/automations via \`craft-agent\` |` : ''}

**IMPORTANT:** Always read the relevant doc file BEFORE making changes...${FEATURE_FLAGS.craftAgentsCli ? `
... craft-agent CLI specific guidance ...` : ''}
```

**两个选项**（外部 AI 决策）：

| 选项 | 操作 | 上游同步影响 |
|---|---|---|
| **A：彻底删** | 删 L533-540 三元 + 删 `DOC_REFS.craftCli` 字段 + 删 [`apps/electron/resources/docs/craft-cli.md`](../apps/electron/resources/docs/craft-cli.md) | 上游同步时若该段更新会冲突 |
| **B：保留代码 + grep 验证 false 默认** | 现状保持（`FEATURE_FLAGS.craftAgentsCli` 默认 false），仅在 §3.7 加 C6 注释说明已门控 | 维持上游 diff 最小 |

**推荐 B**——理由：M3-1 同 commit 的清理目标是"消除可能泄漏给用户的 craft 残留"。`craftAgentsCli` flag 默认 false 时整段被剥离不进 system prompt，[09-test-checklist.md §13.3.1](09-test-checklist.md) 已加 verify。**留代码可降低上游同步成本**。

> **若选 A**：必须同时改 [`packages/shared/src/feature-flags.ts:79-81`](../packages/shared/src/feature-flags.ts) `craftAgentsCli` getter（删或永远 return false）+ `permissions-config.ts:379` + `pre-tool-use.ts:808/822` 共 4 处消费点。

### 1.4 §3.7 改造点 marker（实施后修订，与"修订记录"一致）

> **2026-05-07 修订**：原表头预设要加 3 处 marker（CRAFT_DEBUG/SCRIPTS/AGENT_VERSION 改名），但 grep 实测后决策改为"CRAFT_DEBUG 保留 + CRAFT_SCRIPTS/CRAFT_AGENT_VERSION 删除"。**删除/重命名都不需要加 marker**（§3.7 marker 是给"我们改了上游代码、但保留行为"的改造贴的；删除/纯改名属品牌替换全表 §1，不是 §3.7 改造点）。

| # | 文件 | 处理 | 是否加 marker |
|---|---|---|---|
| —  | `apps/electron/src/main/index.ts:114` `process.env.CRAFT_DEBUG = '1'` | **保留不动**（14+ 真消费方）| 无（不是改造）|
| —  | `apps/electron/src/main/index.ts:150` `process.env.CRAFT_SCRIPTS = scriptsDir` | **删除整行**（0 真消费方）| 无（删除不要 marker）|
| —  | `apps/electron/src/main/index.ts:161` `process.env.CRAFT_AGENT_VERSION = ...` | **删除整行**（0 真消费方）| 无（删除不要 marker）|
| —  | `apps/electron/src/main/index.ts:151-160` 4 个 ENTRY/DOC_PATH 删除 | **删除**（spec §1.1）| 无 |
| —  | `packages/shared/src/utils/files.ts` 5 处 `craft-clipboard` → `u-agents-clipboard` | **品牌替换**（spec §1.2）| 无（属 01-branding-spec.md §1 全表）|

> **结论**：M3-DEAD-PATH 改造 = 6 行删除 + 5 处品牌替换 + 0 处 marker 新增。**§3.7 marker 基线不变**（71/9/9 仍来自 M3-1 OAuth relay + M3-SSRF 落地）。

---

## 2. 改造 step-by-step（外部 AI 执行）

### 步骤 1：grep 死路径全消费方

```bash
# 1.1 验证 5 个 CRAFT_*_ENTRY env 真无消费方
for env in CRAFT_COMMANDS_ENTRY CRAFT_CLI_ENTRY CRAFT_COMMANDS_DOC_PATH CRAFT_CLI_DOC_PATH; do
  echo "=== $env ==="
  grep -rn "$env" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -v "apps/electron/src/main/index.ts"
done

# 1.2 grep CRAFT_DEBUG 消费方（CRAFT_SCRIPTS / CRAFT_AGENT_VERSION 同样跑）
grep -rn "process.env.CRAFT_DEBUG\|CRAFT_DEBUG" packages apps \
  --include="*.ts" --include="*.tsx" 2>/dev/null
```

| env | 期望消费方处理 |
|---|---|
| `CRAFT_DEBUG` | 全部消费方改读 `U_AGENTS_DEBUG`（grep 找一处改一处） |
| `CRAFT_SCRIPTS` | 同上改 `U_AGENTS_SCRIPTS` |
| `CRAFT_AGENT_VERSION` | 同上改 `U_AGENTS_VERSION` |
| `CRAFT_COMMANDS_ENTRY` 等 4 个 | 必须 grep 出 0 消费方才能删；非 0 则停下问 |

### 步骤 2：改 `apps/electron/src/main/index.ts`

```typescript
// L114（替换 CRAFT_DEBUG）
// U-API: M3 cleanup — CRAFT_DEBUG → U_AGENTS_DEBUG（详见 .planning/M3-DEAD-PATH-CLEANUP-SPEC.md §1.1）
process.env.U_AGENTS_DEBUG = '1'

// L150（替换 CRAFT_SCRIPTS）
// U-API: M3 cleanup — CRAFT_SCRIPTS → U_AGENTS_SCRIPTS
process.env.U_AGENTS_SCRIPTS = scriptsDir

// L151-160（删除 5 行 + 1 行 CRAFT_CLI_DOC_PATH = CRAFT_COMMANDS_DOC_PATH）
// 注：完全删除该 6 行，不留注释墓碑（参考 .claude/CLAUDE.md "无 dead code 注释"原则）

// L161（替换 CRAFT_AGENT_VERSION）
// U-API: M3 cleanup — CRAFT_AGENT_VERSION → U_AGENTS_VERSION
process.env.U_AGENTS_VERSION = app.getVersion()
```

### 步骤 3：改 `packages/shared/src/utils/files.ts` 5 处

直接 sed/Edit `craft-clipboard` → `u-agents-clipboard`（5 处都是模板字符串，安全 replace_all）。

### 步骤 4：单测（C5 自洽）

新增 `apps/electron/src/main/__tests__/env-bootstrap.test.ts`（或类似），验证：

```typescript
test('main process bootstraps with U_AGENTS_* env, not CRAFT_*', () => {
  // 启动后 process.env 检查
  expect(process.env.U_AGENTS_DEBUG).toBeDefined();
  expect(process.env.U_AGENTS_SCRIPTS).toBeDefined();
  expect(process.env.U_AGENTS_VERSION).toBeDefined();
  // craft 残留全 undefined
  expect(process.env.CRAFT_DEBUG).toBeUndefined();
  expect(process.env.CRAFT_SCRIPTS).toBeUndefined();
  expect(process.env.CRAFT_COMMANDS_ENTRY).toBeUndefined();
  expect(process.env.CRAFT_CLI_ENTRY).toBeUndefined();
  expect(process.env.CRAFT_AGENT_VERSION).toBeUndefined();
});
```

**注**：此测试要在主进程 bootstrap 后跑，可能需要 mock `app.isPackaged` + 实例化 main process（spawn 子进程实测）。复杂度高时可降级为 grep 测试：

```typescript
test('main/index.ts has zero CRAFT_*_ENTRY references', async () => {
  const fs = await import('fs');
  const src = fs.readFileSync('apps/electron/src/main/index.ts', 'utf-8');
  expect(src).not.toMatch(/CRAFT_COMMANDS_ENTRY/);
  expect(src).not.toMatch(/CRAFT_CLI_ENTRY/);
  expect(src).not.toMatch(/CRAFT_COMMANDS_DOC_PATH/);
  expect(src).not.toMatch(/CRAFT_CLI_DOC_PATH/);
});
```

### 步骤 5：grep 全仓最终验证

```bash
# 这 5 个必须 = 0
grep -rn "craft-clipboard\|CRAFT_COMMANDS_ENTRY\|CRAFT_CLI_ENTRY\|CRAFT_COMMANDS_DOC_PATH\|CRAFT_CLI_DOC_PATH" \
  packages apps --include="*.ts" --include="*.tsx" 2>/dev/null
```

### 步骤 6：[CLAUDE.md §3.7](../CLAUDE.md) marker 增量

> ⚠️ **本 spec 编写于 v22 时点（基线 67），后续实施分散到 v24 多个 Bucket**。当前实际基线已演进到 **82**（v24 全 Bucket A+B+C 落地后；详见 CLAUDE.md §3.7 历次演进表）。下面"67 → 73"是 spec 原计划记录，实施时已被合并到 v24 链路；本 spec 不再独立刷基线（M3-DEAD-PATH 部分已由 v24 commit `a983c5ba` ship，0 marker 净增）。

主表加 #43-#48（M3-1 OAuth relay 3 项 + M3 cleanup 3 项）。基线行：67 → 73（允许 71-75）。历次演进末行加：

```
> - **M3-1 OAuth relay + M3 cleanup（YYYY-MM-DD commit `<hash>`）：73 处**（OAuth relay 3 处 + main/index.ts CRAFT_*→U_AGENTS_* 3 处 改造点 marker；同 commit 删 5 行 CRAFT_*_ENTRY env 不计 marker；files.ts 5 处 craft-clipboard 改 u-agents-clipboard 不计 marker（品牌替换非改造））
```

---

## 3. 验收清单

- [ ] grep `CRAFT_COMMANDS_ENTRY` `CRAFT_CLI_ENTRY` `CRAFT_COMMANDS_DOC_PATH` `CRAFT_CLI_DOC_PATH` 全仓 = 0
- [ ] grep `CRAFT_DEBUG` `CRAFT_SCRIPTS` `CRAFT_AGENT_VERSION` 全仓 = 0（消费方全改 `U_AGENTS_*`）
- [ ] grep `craft-clipboard` 全仓 = 0
- [ ] 单测覆盖（C5 自洽）
- [ ] [CLAUDE.md §3.7](../CLAUDE.md) #43-#48 + 基线 67 → 73
- [ ] [09-test-checklist.md §13.3.1](09-test-checklist.md) verify 跑通
- [ ] **与 [M3-OAUTH-RELAY-SPEC.md](M3-OAUTH-RELAY-SPEC.md) 同 commit**

---

## 4. 关联规格

- [REVIEW-21-FULL-2026-05-07.md §2.4 #2](sync-reports/REVIEW-21-FULL-2026-05-07.md)（强制同 commit 来源）
- [M3-OAUTH-RELAY-SPEC.md](M3-OAUTH-RELAY-SPEC.md)（必须同 commit）
- [04-feature-cuts.md](04-feature-cuts.md)（craft-cli / craft-agents-commands 已裁剪依据）
- [CLAUDE.md §3.7](../CLAUDE.md) C5（新改造点必加单测） + C6（system prompt craft 字面量门控）
- [09-test-checklist.md §13.3.1](09-test-checklist.md)（craftAgentsCli=false verify）
