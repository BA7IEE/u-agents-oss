# M1-READINESS — M1 文档移交执行确认

> **本文档是 M1 文档收敛的正式宣言**。读完意味着外部执行 AI / 用户可以开始按 `11-roadmap.md` 任务清单实施 M1。
>
> 本仓库 AI 不执行任何代码改造（详见 `CLAUDE.md` §0 零号铁律）。

---

## 1. 当前文档状态

| 项 | 值 |
|---|---|
| **文档数** | **15 份（12 份 `.planning/*.md` 含本文 + 根目录 3 份 CLAUDE/PRODUCT/LEGAL）** —— Round 51 A10 修正：M1-READINESS.md 本身也是 .planning/，原说 14 份未计入本文 |
| **`.planning/` 总行数** | 6304 行（含本文）；6143 行（不含本文） |
| **挖矿轮次** | 50 轮（Round 0-46 代码扫 + Round 47-50 收敛） |
| **M1 任务数** | 57 项 |
| **核心规格表** | `01-branding-spec.md` §2.0 总览 / `02-llm-gateway-spec.md` §4.3 全景验证表 (~99 行) / `01 §2.43` 审计表 (14 矛盾) |
| **审计机制** | `07-upstream-sync.md §2.7b` 月度反向核对 SOP 已建立 |

---

## 2. 移交执行 AI 的必读文档顺序

**第 1 优先（任何动作前必读，零号铁律 + 硬规则）**：

1. `CLAUDE.md` §3 硬规则 + §3.7 `// U-API:` 改造点标记规范
2. `LEGAL.md` §2 Apache §4(b)/§4(c) 合规边界（**LICENSE/NOTICE/TRADEMARK 不动；package author 改 U Studio**）
3. `PRODUCT.md` 产品定位与功能边界

**第 2 优先（实施开始前看路线图 + 任务）**：

4. `.planning/11-roadmap.md` §M1 任务清单（57 项 + 6 阶段 commit 分组 + 关键依赖关系）
5. `.planning/01-branding-spec.md` §2.0 子节分级总览（按 🔴 P0 → 🟡 P1 → 🟢 P2 顺序做）
6. `.planning/02-llm-gateway-spec.md` §4.3 全景验证表（每次同步上游必扫）

**第 3 优先（具体改造时按需查）**：

7-14. 其他规格 §03-§10（按任务卡片"对应规格"列指向阅读）

---

## 3. M1 任务执行顺序（详见 `11-roadmap.md` §M1 阶段图）

| Commit | 阶段 | 任务集 | 验收 |
|---|---|---|---|
| **1** | NPM scope 重命名 | #1 + #11j Vite exclude | `bun run typecheck:all` + dev console 无 "multiple React copies" + `grep "@craft-agent" tsconfig*.json` = 0 |
| **2** | 品牌替换 + i18n | #2-#12 (含 #11/b/c/d/f/g/h/l/m/o/p/r/s/t/u), #25-#26b | `01 §8` grep 全过 + 各小节验证 grep（详见 commit 2 验收行） |
| **3** | U-API 锁定核心 | #13-#15, #17b, #23, #11i, #11n | `bun run test:shared:all` + `grep "\\.craft-agent" packages/shared/src/agent/core` = 0 |
| **4** | Onboarding + UI 锁定 | #16-#19, #24 | `09 §2 + §3` 全过 |
| **5** | 功能裁剪 | #20-#22, #24b, #11e, #11q | `grep "craft-agents-docs\|SearchCraftAgents"` = 0 |
| **6** | 打包发版 | #24c, #24d, #27-#31, #11k, #11v | M1 出口条件全过 + `grep [Cc]raft apps/electron/scripts/build-dmg.sh` = 0 |

**关键时序硬约束**（违反即 typecheck 失败）：
1. **#1 必先做**（其他 import 解析依赖此）
2. **#13 在 #14/#15 之前**
3. **#23 + #11i + #11n 必同 commit**（paths 改名 + 正则路径 + EditPopover AI prompt 三方联动）
4. **#17b 在 #18 之前**
5. **#27 在 #28 之前**
6. **#11k 在 #28 之前**（build-dmg.sh artifactName 与 #2 耦合）

---

## 3.5 M1 已知阻塞项（实施过程中发现）

### B1 — `electron:build` 不复制 pi-agent-server（M1 v0.9.0 真实事故）

**症状**：`electron:dist:adhoc:mac` 打包成功 → DMG 装上能起 → 发首条 LLM 消息立刻报 `piServerPath not configured. Cannot spawn Pi subprocess.`

**根因**：[`scripts/build/common.ts:520`](../scripts/build/common.ts) `copyPiAgentServer()` 定义了但 `electron:build` 链路没调；`apps/electron/resources/pi-agent-server/` 目录不存在；`electron-builder.yml` `extraResources` 把空目录打进 DMG。

**影响**：U Agents 锁定 `https://token.u-studio.cn/v1` (`providerType: 'pi_compat'`)，主链路必走 pi 子进程 → **缺失 = 应用全废**。

**修复**：详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §2 完整方案 + AI 实施 prompt。

**入闸条件**：§4 出口清单第 1 项（"全新装机能发第一条对话"）必须验证此项已修。验证手段：[`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §3 验收 A/B/C 全过。

---

## 4. M1 出口条件清单（**全部勾选 = M1 完成**）

详见 `11-roadmap.md §M1 出口条件`，浓缩为 14 项：

> **M1 实质完成度：13/14**（详见 [`perf-baseline-M1.md`](perf-baseline-M1.md) §5；仅剩 #13 网站下载页未做，hotfix v0.9.0+u-agents.1 已发布，详见 [`M1-SEED-DISTRIBUTION.md`](M1-SEED-DISTRIBUTION.md)）

- [x] 全新装机能完成 onboarding，能发第一条对话
- [x] adhoc 包通过 `09 §1.2` Gatekeeper 流程
- [x] About 对话框含 "Based on Craft Agents" 署名（决策已改为通过 NOTICE/LICENSE 文件落实 §4(c) 合规，详见 [`LEGAL.md`](../LEGAL.md) §2）
- [x] `01 §8` 4 个 grep 命令全过
- [x] `02 §10` 验收全过
- [x] `bun run lint:i18n:parity` 通过
- [x] `bun run typecheck:all` 通过
- [x] `bun run test:shared:all` 通过（baseline 12 stable + 1-2 OAuth flaky，REVIEW v8 修 url-safety:48 后从 13→12）
- [x] `bun run validate:dev` 通过
- [x] `09 §3.5` 后端 setup 端到端验证
- [x] M1 性能基准记录到 `.planning/perf-baseline-M1.md`
- [x] 自动更新指向 `update.u-agents.u-studio.cn`，能拉到 `latest.yml`
- [ ] 网站下载页显著位置展示"首次启动指引"（**唯一剩余项**，M3 自建文档站时一并交付）
- [x] Sentry DSN 未被注入（`SENTRY_ELECTRON_INGEST_URL` 不设置）

---

## 5. 已知"M1 不改 / 保留"清单（执行 AI 不要踩坑）

按 LEGAL.md §5 已知瑕疵 + 各 §2.X 决策保留汇总：

| 类别 | 决策 | 出处 |
|---|---|---|
| OAuth relay (`agents.craft.do/auth/callback`) | M3 自建后改 | LEGAL §5.1 / 01 §2.4-§2.5 |
| `craftAgentsCli` flag | 默认 false 永不开 | LEGAL §5.4 / 01 §2.2 |
| `bin/craft-agent*` + `tool-icons/craft-agent.svg` + `docs/craft-cli.md` | 保留（craftAgentsCli flag 联动） | 01 §2.2 |
| `apps/cli` / `apps/webui` (大部分) / `apps/viewer` | M1 不发布，**用户界面文案保留** + **NPM scope/共享组件/全局协议必改** | 01 §2.36 |
| `Dockerfile.server` ~15 处 craft | M1 不发布 server / Docker | 01 §2.42 |
| ESLint inline plugin namespace `craft-*` | dev tooling，用户看不到，保留 | 01 §2.42 |
| Shiki theme `craft-dark/craft-light` + `__craftShikiThemesRegistered__` | 内部命名，保留 | 01 §2.35 |
| `connection-setup-logic.ts:162` 模板 name `'Craft Agents Backend (API Key)'` | 上游测试 fixture 兼容，保留 | 01 §2.31 |
| `playground/` ~20 处 craft demo 数据 | dev 工具，M2 重构时改 | 01 §2.38 |
| `credentials.enc` magic header `CRAFT01\0` | 改 magic 破坏既有文件解密 | 02 §9.2 |
| `__craftRpcType` wire protocol marker | M1 用户群新装机安全 | 02 §4.3 |
| `LICENSE` / `NOTICE` / `TRADEMARK.md` 内 `Craft Docs Ltd.` 字样 | 合规凭证不得删 | LEGAL §2 Round 45 |

---

## 6. 待下一文档版本处理（M2 / M3）

| 项 | 触发时机 | 出处 |
|---|---|---|
| §2.12 主表加 system.ts:650（craft-agents-docs 引用）| 下次 §2.12 维护时补；**代码改造仍属 M1 #11e，不能推迟** | 01 §2.43 A9 |
| §2.14 / §2.14a / §2.14b / §2.14 编号重排 | M2 文档大版本 | 01 §2.43 A7 |
| Windows `setAppUserModelId` 设置 | M2 Windows 打包 | 01 §2.27 + 01 §2.18 |
| `apps/webui/viewer` 静态品牌清洗；`apps/cli` 评估 | WebUI/Viewer 静态白标 M2；完整分享 viewer 启用 M3；CLI M2 或不做 | 01 §2.36 + 11 §M2 |
| OAuth relay 自建 (`craft.do/auth/callback` → 主域 `/auth/callback`) | M3 | LEGAL §5.1 |
| Sentry `setTag` 5 处脱敏 review | M3 自建 Sentry 启用前 | 02 §9.2 + 02 §4.3 HHHH |
| `.github/ISSUE_TEMPLATE/` 删除（M1 任务 #11v）| M1 commit 6 | 01 §2.42 |

---

## 7. 文档质量保障机制

**月度同步上游后必跑**（详见 `07-upstream-sync.md §2.7b`）：

1. **A 类反向核对** — 文档自相矛盾审计（数字过期 / 任务路径 hallucination / 引用断链 / 决策漂移）
2. **B 类反向核对** — 反向 grep（品牌名变体 / URL 域名规划 / 邮箱白名单 / Token URL / typo）
3. **结果填入同步报告 §2.9 "反向核对结果" 节**
4. **新发现矛盾追加到 `01 §2.43` 审计表**

**经验数据**（基于 Round 47-49 实际产出）：
- A 类：每 5-10 轮代码扫产出 ~5-9 个矛盾
- B 类：每月跑产出 ~2-5 个矛盾
- 累计 23 轮挖矿 + 4 轮收敛 → 14 个文档矛盾被识别（5 P0 + 7 P1 + 2 一致）

---

## 8. 移交确认

本仓库 AI 已完成的范围：
- ✅ 14 份规格文档（`.planning/` 6304 行含本文 / 6143 行不含本文，57 任务 / 99 行全景表 / 14 矛盾审计）
- ✅ 月度反向核对 SOP 机制化
- ✅ M1 出口条件清单
- ✅ M1 不改决策清单
- ✅ M2/M3 待办标记

本仓库 AI **不**做的范围（零号铁律）：
- ❌ 任何代码改造
- ❌ `bun install` / 任何写入命令
- ❌ git push / merge / rebase
- ❌ 触发 CI / 打包

**外部执行 AI / 用户**接手实施时：
1. **从本文 §2 必读文档顺序开始**
2. **按本文 §3 commit 阶段分组逐步推进**
3. **每个 commit 后跑对应验收命令**（详见 `11-roadmap.md` commit 粒度建议表）
4. **不确定时回查对应规格**（每个任务卡片"对应规格"列指向具体 §X.Y）
5. **遇到规格未覆盖的新情况**：让本仓库 AI 先扩规格，再决定改不改

---

> **签发**：U Studio（独立开发者 tungwerl@gmail.com）
>
> **生效**：M1 文档冻结日（本文创建日，即 Round 50 完成日）
>
> **下次大版本**：M2 启动时（多平台稳定 + 中文化深度优化）
