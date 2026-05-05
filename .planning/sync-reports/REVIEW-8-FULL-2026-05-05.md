# 全方位 Review v8 — 20-commit 终审 + 生产产物缺口（2026-05-05 晚）

**Review 焦点**：今天 20 commits + 11 轮审计后的最终 sanity check
**审查方法**：3 个 Opus 子 agent（回归测试 / 生产产物 / 依赖 + 元 review）
**总评级**：**B（git 仓库 A，生产分发 P0 缺口）**

---

## 1. 三 agent 综合发现

### Agent 1 — 回归测试（B+）

| 检查 | 结果 |
|---|---|
| typecheck:all | ✅ 0 errors |
| lint:i18n:parity | ✅ 6 locales × 1376 keys |
| lint:electron / shared / ui | ✅ 全部 baseline 不变 |
| §3.7 反向覆盖 | ✅ 100%（27/27 文件，0 diff） |
| §2.7c C1-C9 anti-patterns | ✅ 全 0 |
| **packages/shared bun test** | **14 fail（在 13-15 浮动范围内）** |

**1 个"高度可疑回归"经核实是误判**：
- `classifyExternalUrl > is case-insensitive for the scheme` (`url-safety.test.ts:48`) 仍 `CRAFTAGENTS://`
- 实际是 **M1 改造期遗漏**：主代码 `INTERNAL_DEEPLINK_SCHEME` 已从 `craftagents:` 改 `uagents:`，但 test fixture L48 那行 case-insensitive 测试**没同步改**为 `UAGENTS://`
- 不是今天 cli rename 引入；是 M1 期既有 baseline fail
- 修复极简（1 行 Edit），可降 baseline 13→12 stable

### Agent 2 — 生产产物验证（**🔴 P0 发现**）

**核心矛盾**：

| 渠道 | 内容 | 时间 |
|---|---|---|
| **R2 用户下载** | hotfix v0.9.0+u-agents.1（无 SDK，无任何今天 fix）| 5/5 04:28 UTC |
| **本地 release/** | hotfix + SDK 防御版（无今天 4 个 P 安全 fix）| 5/5 13:33 UTC |
| **git HEAD `12d7381a`** | hotfix + SDK + TLS + atomic + 0o700 + key bounds + cli rename | 5/5 15:26 UTC |

**`apps/electron/release/mac-arm64/U Agents.app/Contents/Resources/app/dist/main.cjs` 内验证**：
- ✅ hotfix 内容（"integrate Linear, GitHub, Notion"）：1 命中
- ❌ TLS 修复（删 `tlsRejectUnauthorized: false`）：1 处仍残留
- ❌ atomic writes 11 sites：仍 plain `writeFileSync`
- ❌ LLM key bounds（"Did you accidentally paste a file?"）：0 命中
- ❌ cli rename `u-agents-cli`：0 命中（仍 `craft-cli` 残留 3 处）
- ❌ dir 0o700（`mode: 448`）：仅 1 处（应 3 处 mkdirSync）

**判定**：**所有 4 个今天 P 安全 fix 既不在 R2、也不在本地 release/ 产物中**。

**严重度**：**P0** — "M2 安全主线 4/4 = 100%" 在 git 仓库层面真，**生产分发层面假**：
- TLS LAN MITM 风险（已知瑕疵清除→ 实际仍存）
- atomic writes（断电会丢用户 config / conversation）
- LLM key bounds（误粘大文本 OOM）
- dir 0o700（多用户机器隐私）

### Agent 3 — 依赖健康度 + 元 review（A）

**依赖健康度 A**：
- 14 个 package.json version 100% 一致（全 0.9.0）
- workspace deps 完整（@u-agents/* 全部对应真实包）
- 0 高危 CVE 包
- 唯一小瑕疵：`BUN_VERSION = bun-v1.3.9` vs 本地 1.3.12（+3 patch；产物 bundle 1.3.9）

**11 轮 review 元评估**：
- 真问题：~37 个（含 2 个 P0：state.ts:306 keyless + TLS）
- 误报：~5 类（多为 SOP grep 模式，已修）
- 累积 effort：~13-17 小时 / 2 工作日
- ROI 极高：仅 2 个 P0 修复就回本
- **边际收益递减**：v6 起明显减弱；v7-v8 都是对齐型，少新发现
- **建议**：v8+ 不再做"全维度审计"，改事件驱动（上游同步 / hotfix 后 mini-review / 每月维护审计）

---

## 2. 7 + 4 = 11 轮审计累积总结

| 轮 | 真问题 | 误报 | 主要价值 |
|---|---|---|---|
| v1-v3 | 14（基础 + grep 改进）| ≥4 SOP 缺陷 | 体系建设 |
| v4 | **1 P0**（state.ts:306）| 0 | 回本 |
| v5 | **1 P0**（TLS）+ 6 P1 | 0 | 二次回本 |
| v6-v7 | 6 漂移修复 | 1 | 维护对齐 |
| SOP-1/3/4 | 4 类 SOP 自身缺陷修复 | 大量但都改进了 | SOP 上线就绪 |
| **v8** | **1 P0 生产缺口** | 1（误判 cli rename 回归）| **暴露 git vs 生产 ≠** |

---

## 3. 🔴 唯一 P0 待决策：生产分发缺口

### 现状

R2 用户下载到 / 已装机的 hotfix v0.9.0+u-agents.1：
- ✅ 含 hotfix v0.9.0+u-agents.1 内容（system.ts 等）
- ❌ **不含**今天 4 个 P 安全 fix
- ❌ **不含**含 SDK 的防御性 bundle
- ❌ **不含**cli rename

### 三条路径

**Path A — 重打 + 重传 R2**（最干净）
1. 跑 `cd apps/electron && bun run dist:mac` （含 build-dmg.sh + SDK）+ `dist:win` 同步
2. 上传 R2 + 刷 CDN
3. 用户下次自动更新拿到含全部 fix 的版本

时间：构建 10 分钟 + 上传 5 分钟 + CDN 刷新 3 分钟 = 20 分钟

**Path B — 接受现状 + 文档标注**
1. M2-SECURITY-CLOSURE 加"⚠️ git 仓库已落地，等下次发版分发"
2. 等下个自然版本（如上游打 v0.10.0 同步时）一起发
3. 用户当前跑的 hotfix 在 M1 锁 U-API 场景下**实际安全**（pi-agent 路径不调 SDK + 单机不连 remote workspace + 单连接 keyless 触发条件不存在）

时间：1 个 doc commit。

**Path C — 标注 + 加快 hotfix v0.9.0+u-agents.2 节奏**
1. 同 B，标注现状
2. 收集种子用户反馈后，把 4 fix 一起作为 v0.9.0+u-agents.2 发
3. 比 A 多走一个版本号

时间：等种子分发反馈周期。

### 推荐：**Path A**

理由：
- 重打成本仅 20 分钟
- 4 个 P 安全 fix 真生效（即使 M1 用户当前不会触发，但**未来如启用 multi-connection 或 remote workspace 立刻有保护**）
- "M2 安全 4/4 = 100%" 才真正闭环（git 仓库 = 生产分发）
- 不需走 v0.9.0+u-agents.2 版本号 hop

---

## 4. 1 个 baseline cleanup（极小）

`url-safety.test.ts:48`：

```diff
- expect(classifyExternalUrl('CRAFTAGENTS://settings').kind).toBe('internal-deeplink')
+ expect(classifyExternalUrl('UAGENTS://settings').kind).toBe('internal-deeplink')
```

修复后：baseline 13 stable + 2 OAuth flaky → **12 stable + 2 OAuth flaky**。可放进任何 hotfix commit 的尾巴。

---

## 5. v8+ 后续 review 节奏建议（来自 Agent 3 元评估）

**不再日历驱动 "全维度审计"**。改为事件驱动：

1. **上游打新 release tag** → 同步前/后各跑 SOP §2.7b/c + §3.7
2. **任何 hotfix commit 后** → mini-review（C1-C9 + §3.7 基线对照）
3. **每月 1 次"维护审计"** → 扫 marker 覆盖率退化（SOP-4 类型）
4. **重打 R2 后** → Agent 2 类型验证（产物 vs git 一致性）

---

## 6. 总评

| 维度 | git 仓库 | 生产分发 |
|---|---|---|
| 代码质量 | A | A |
| 文档对齐 | A | n/a |
| 安全主线 4/4 | ✅ 100% | ❌ 0%（fix 不在产物） |
| 部署一致性 | n/a | ❌ R2 ≠ 本地 ≠ git |

**git 仓库评级：A**
**生产分发评级：C**（git 已修但用户跑的没修）
**总评：B**

唯一 P0：决策 Path A/B/C 之一。**强烈推荐 Path A**——20 分钟重打 + 重传，让 git 与生产真正一致。
