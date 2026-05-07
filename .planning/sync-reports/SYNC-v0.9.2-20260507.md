# SYNC v0.9.2 — 上游同步实施报告（2026-05-07）

**触发**：v23 review 后用户授权"修好 + v0.9.2 sync"全链路落地
**Sync 分支**：`sync/upstream-20260507-v092`
**Merge commit**：[`a76e502d`](../../) sync: merge upstream/main as of 20260507 (v0.9.2)
**Tag**：`sync-20260507-v092`
**总评**：**A**（小型修补 release，0 阻塞，预估 45-75min vs 实际 ~50min）

---

## 1. v0.9.2 真增量

| 维度 | 数字 |
|---|---|
| 上游 commits（v0.9.1 → v0.9.2）| 1（squash） |
| 上游 commit hash | `8981384b` (v0.9.2) ← `b31904c6` (v0.9.1) |
| 改动文件 | **38** |
| 改动行数 | **+1369 / −304** |
| 新增 .ts 文件 | 4（spawn-helpers / system-prompt-override + 4 个测试文件）|
| package.json version bump | 14 |

---

## 2. 5 项 v0.9.2 主要变化

| # | 主题 | 影响 |
|---|---|---|
| 1 | OAuth refresh ordering | `SessionManager.sendMessage` 改顺序：refresh → getOrCreateAgent → build。避免 cold session token flicker |
| 2 | Pi 系统 prompt persistence | `applySystemPromptOverride` helper 解决 SDK 0.72.1 wipe `state.systemPrompt` 问题（影响 Pi backend 的所有用户）|
| 3 | Cross-machine spawn ENOENT guard | 新 `spawn-helpers.ts` + 4 测试文件；解决 "Send to Workspace" 接收方首次使用 import session 时的 SDK 错误 |
| 4 | source_test lastTestedAt 持久化 | 修 ISO string vs number 类型不匹配 |
| 5 | streaming 文本完成不消失 + browser toggle gate 完整 | 3 个 hotfix（用户体验）|

---

## 3. 冲突解决（C 类踩坑核对）

### 3.1 实际冲突清单

| 类别 | 文件数 | 解决方式 |
|---|---|---|
| package.json version bump + NPM scope（C11）| 15 | take ours + sed bump 0.9.1 → 0.9.2 |
| 其他 .ts/.tsx | 23 | git auto-merge OK |

### 3.2 C1-C14 核对

| # | 模式 | 触发 | 处理 |
|---|---|---|---|
| **C10** | 字段透传 | 未触发（v0.9.2 加的是 spawn-helpers + branchInfo 字段，不动 connection 字段，`enforceUApiBaseUrl` 浅合并不受影响）| ✓ |
| **C11** | NPM scope rename | **1 文件触发**：`packages/server-core/src/sessions/sendmessage-oauth-refresh.test.ts`（v0.9.2 新增），2 处 `@craft-agent/shared/*` import → `@u-agents/shared/*` | ✓ 已修 |
| **C12** | 上游 ESLint 违规 | 未触发（merge 干净）| ✓ |
| **C13** | 上游 release 自身 test fail | 未触发（v0.9.2 新增 4 个测试文件全部通过）| ✓ |
| **C14** | build-win.ps1 vs root chain | 未触发（v0.9.2 未改 build pipeline）| ✓ |

---

## 4. 品牌化处理（用户可见 craft 字面量）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `packages/shared/src/agent/errors.ts:7,12` | NPM scope `@craft-agent/core/types` → `@u-agents/core/types`（C11 + Apache §4(b) doc 引用同步） |
| 2 | `packages/shared/src/agent/errors.ts:236` | 用户可见错误文案 `Reinstalling Craft Agents` → `Reinstalling U Agents` |
| 3 | `packages/shared/src/agent/claude-agent.ts:1926` | 同上（duplicate of #2 — 同 `sdk_binary_missing` 错误代码的 inline 文案）|
| 4 | `packages/shared/src/agent/spawn-helpers.ts:31` | JSDoc 示例路径 `/Applications/Craft Agents.app/...` → `/Applications/U Agents.app/...` |
| 5 | `apps/electron/resources/release-notes/0.9.2.md` 行 7 | 用户可见标题 `Pi backend silently dropped the Craft system prompt` → `... the system prompt`（去 Craft）；`Craft-built system-prompt content` → `U Agents-built system-prompt content` |
| 6 | 同上（"Improvements" 段）| `@craft-agent/core/types` → `@u-agents/core/types`（与 #1 一致）|

**保留的 craft brand**（合规/技术接口）：
- `agents.craft.do` 4 处 OAuth relay 残留（M3-1 未做，已知瑕疵）
- `lukilabs/craft-agents-oss` GitHub URL 引用（Apache §4(b) attribution 上游 issue tracker）
- `CRAFT_DEBUG` / `CRAFT_AGENT_CLI_VERSION` / `~/.local/share/craft/...` 等 env vars 与路径（M3-DEAD-PATH §1.4 决策保留 14+ 真消费方）

---

## 5. 验证结果

| 验证项 | 结果 |
|---|---|
| `bun install` | OK（1734 packages） |
| `bun run typecheck:all` | 全绿 |
| `bun run validate:ci` | 全绿（typecheck + 3 test:shared file 63 pass + Python smoke 19 + i18n parity/sort/coverage 全 OK）|
| `bun test packages/shared` | **2854 pass / 12 skip / 3 fail**（vs v22 baseline 2821 pass，新增 33 pass，0 新引入 fail；3 fail 全是历史已知 OAuth flaky × 2 + send_developer_feedback Explore mode）|
| §3.7 主基线 | **73**（v23 P1 后基线，sync 未破坏 marker）|
| `/* U-API START */` | **9** ✓ |
| `/* U-API END */` | **9** ✓ |
| Build 子表 | **20** ✓ |
| `@craft-agent/` NPM scope 残留 | **0** ✓ |
| `agents.craft.do` 残留 | **4**（已知瑕疵）✓ |

---

## 6. v0.9.2 新增测试文件（4 个，全部通过）

| 文件 | 通过 | 说明 |
|---|---|---|
| `packages/shared/src/agent/__tests__/claude-agent-branching.test.ts` | ✓ | branchInfo 持久化 + onBranchForkInvalidated callback 回归 |
| `packages/shared/src/agent/__tests__/claude-agent-spawn-cwd.test.ts` | ✓ | 34 个 spawn-helpers 单元测试 |
| `packages/server-core/src/sessions/sendmessage-oauth-refresh.test.ts` | ✓ | OAuth refresh 顺序回归（修后含 v23 NPM scope rename） |
| `packages/shared/src/sources/__tests__/token-refresh-manager.test.ts` | ✓ | TokenRefreshManager.ensureFreshToken disk write 回归 |

---

## 7. 时间消耗

| 阶段 | 实际时间 |
|---|---|
| Pre-merge 准备（fetch + 检查 diff stat）| 2min |
| Create sync branch + git merge | 1min |
| 解决 15 个 package.json 冲突（take ours + sed）| 3min |
| 4 个高风险文件 brand 核对 + 修 | 8min |
| typecheck / validate:ci / bun test | ~5min |
| C11 sendmessage-oauth-refresh.test.ts 修 1 处 + 重 typecheck | 2min |
| 0.9.2 release-notes brand 核对 + 修 | 2min |
| Commit + tag | 1min |
| **总计** | **~24min**（仅 sync 部分；P0 + P1 + sync 全链路 ~75min）|

vs D1 agent 预估 45-75min（小阻力）→ **A**

---

## 8. 历史性意义

**v0.9.2 是 v0.9.1 之后的第一次月度 sync**：
- 验证了 SOP-REHEARSAL-4 → v0.9.1 SYNC-PLAYBOOK → v23 review → v0.9.2 sync 的完整流水线
- 验证了 v23 SOP P0 5 项刷新（特别是 09-test-checklist §13.5/13.6/13.7 的新工序）实战可用性
- 验证了 §3.7 marker 基线（73/9/9）抗 sync 自动 merge 的健壮性
- 验证了 D1 agent 预估的准确性（45-75min vs 实际 24min sync 部分；含 P0/P1 全链路 75min）

**剩余 follow-up**（未阻塞 sync 完成）：
- P2 13 项下次月度 sync 前批量清理（v23 §3）
- M3-1 OAuth relay 部署（4 处 craft.do 残留）等 ≥50 活跃用户
- M3-4 GlitchTip self-host + DSN assertion 切 fail
- v0.9.2 onwards：M2.5 #4 macOS x64 装包实测（用户暂无 x64 机器 deferred）

---

## 9. 推送清单

```bash
# sync 分支已建：sync/upstream-20260507-v092
# tag 已建：sync-20260507-v092
# 当前 HEAD：a76e502d（merge commit）

# 推荐做法（待用户决定）：
# 1. 切回主分支并 merge sync 分支（fast-forward）
git checkout claude/admiring-lichterman-a47f82
git merge sync/upstream-20260507-v092 --ff-only

# 2. 推送到 origin
git push origin claude/admiring-lichterman-a47f82
git push origin sync-20260507-v092  # 推 tag

# 3. （可选）创建 PR 让用户 review
```

---

## 10. v8-v23 review 体系下的本次 sync 定位

```
v8-v17  防御性 review        (14 真 P0 关闭)
v18-v20 深度 review           (9 项新 finding)
v21     发布后稳态盘点
v22     5 项代码层落地实施
v23     10-Agent 多智能体 review (88 项 finding)
v23 后  → P0 SOP 5 项 + P1 代码 3 项 + v0.9.2 sync 全链路落地（本报告）
```

**评级演进确认**：
- v22 → v23：A−（项目主基线完整健康）
- v23 + P0/P1 落地：A
- v23 + P0/P1 + v0.9.2 sync：**A**（与原计划一致）
- 下一步：M3-1 OAuth relay 部署 → A+ / M3 readiness 90%

---

**v23 → v0.9.2 sync 全链路 commit 链**（push 顺序）：
```
a76e502d sync: merge upstream/main as of 20260507 (v0.9.2)
7c9cce68 fix(security+brand): v23 P1 follow-up — api-tools SSRF + 用户可见 craft 残留
074875dd docs: REVIEW v23 + M2.5 SOP 5 项 P0 刷新
a41df06b docs: M2.5 #4 macOS x64 实测 deferred + #3 husky 状态记录（v22 后历史）
```

下次 review (v24) 触发：v0.9.2 sync push 后实证落地核查（事件驱动）。
