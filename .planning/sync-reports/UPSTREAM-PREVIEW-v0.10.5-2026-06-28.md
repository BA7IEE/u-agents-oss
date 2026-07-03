# UPSTREAM PREVIEW — v0.10.5 同步预分析报告（2026-06-28）

> merge 之前产出。上次同步 v0.10.4 终评见 [`SYNC-v0.10.4-20260628.md`](SYNC-v0.10.4-20260628.md)。
> **预测评级：A（比 v0.10.4 更小更干净的一版）。**

---

## 0. TL;DR

- 上游 `v0.10.5`（commit `c9d9a26f`，单 squash）相对 `v0.10.4`（`556c59a7`）改动 **22 文件，+122 / −51**——fork 历史上最小的一版。
- 主题只有一个：**Claude Sonnet 5 上架**（`claude-sonnet-5`，1M context）+ **Claude Agent SDK 0.3.170 → 0.3.197**。默认模型不变（Opus 4.8）。
- **不涉及新 provider、新品牌入口、路径变化、logger/lockdown 逻辑。** §3.3 高冲突文件仅 `llm-connections.ts` 被改，且我方该文件与上游基线**逐字节一致** → 自动合并，零冲突。
- **预测冲突：15 个，全机械**（14 package.json 名称/版本 + bun.lock）。
- **本次唯一实质工作：i18n 值同步**——上游把 `model.sonnetDesc` 英文值改了（"Best for everyday tasks" → "The best combination of speed and intelligence"），我方 6 个非英语 locale 还是旧含义的翻译。**parity 检查抓不到值变化**（key 集合没变），必须手动同步（见 §4）。
- 改造点基线预期 **118 不变**（无品牌/路径改造需求）。
- release-notes `0.10.5.md` 中文化三件套照做（草稿见 §6）。

---

## 1. 上游元数据

| 项 | 值 |
|---|---|
| tag / commit | `v0.10.5` / `c9d9a26f`（squash 单提交）|
| 我方基线 | `v0.10.4` = `556c59a7`（main 已含）|
| 规模 | 22 文件，+122 / −51 |
| 新 provider / 品牌入口 | **无 / 无** |
| SDK | `@anthropic-ai/claude-agent-sdk` 0.3.170 → **0.3.197**（root package.json + bun.lock）|

---

## 2. 逐项改动与 U Agents 相关性

| 改动 | 内容 | 我方处理 |
|---|---|---|
| `models.ts` + `models.test.ts` | `MODEL_REGISTRY` 加 Sonnet 5（1M context）；Sonnet 4.6 保留、hardcode 描述改 "Previous Sonnet generation"；Bedrock US/EU/Global 三区映射 | 照收。我方用户走 U-API 路由名，Anthropic 直连模型注册表对我方 UI 不可达 |
| `llm-connections.ts` + 其测试（§3.3 #3）| `PI_PREFERRED_DEFAULTS.anthropic` / `amazon-bedrock` 列表插入 `claude-sonnet-5` + BEDROCK 双向映射 | 照收（dead-ish path：anthropic/bedrock Pi provider 我方已隐藏；D2 豁免保证 U-API 连接模型清单不被动）。**我方此文件与上游基线逐字节一致 → 零冲突** |
| `en.json` | 仅 1 行：`model.sonnetDesc` 值变 | 自动合并（离我方品牌改动区远）；**但触发 §4 的 6-locale 值同步** |
| 14 × `package.json` | 版本 0.10.4 → 0.10.5 | C11 惯例冲突：保我方 `@u-agents` 名/描述，取 `0.10.5` |
| `bun.lock` | SDK bump | **C15 程序**（见 §3，v0.10.4 踩坑沉淀）|
| `release-notes/0.10.5.md` | 新增（英文）| 中文化三件套（§6 草稿）|

**上游小瑕疵（记录，不处理）**：Sonnet 4.6 的 hardcode 描述改成了 "Previous Sonnet generation"，但 `descriptionKey` 仍与 Sonnet 5 共用 `model.sonnetDesc` → 启用 i18n 的 UI 里两代 Sonnet 显示**同一句**描述。上游自身 cosmetic bug（C13 类，记录即可）；我方模型选择器不展示 Anthropic 直连模型，零影响。

---

## 3. bun.lock 处理（C15，v0.10.4 教训固化）

**禁止**对冲突态 lock 直接 `bun install`（会从头解析、传递依赖漂移——v0.10.4 时 @sentry 被拉成 10.60+10.62 双版本致 typecheck 断）。照做：

```bash
git checkout upstream/main -- bun.lock   # 以上游 v0.10.5 lock 为基底
bun install                              # 只调和我方 @u-agents 工作区名
grep -c '"@craft-agent/' bun.lock        # 期望 0
```

---

## 4. i18n 值同步（本次唯一实质工作）⚠️

上游只改了 `en.json` 的值；我方 7 locale 中其余 6 个仍是旧含义翻译。`lint:i18n:parity` **抓不到**（key 集合不变）。merge 后把下表落进各 locale（`model.sonnetDesc`，值按新英文 "The best combination of speed and intelligence" 重译）：

| locale | 现值（旧）| 建议新值 |
|---|---|---|
| zh-Hans | 最适合日常任务 | 速度与智能的最佳结合 |
| ja | 日常的なタスクに最適 | 速度と知性の最良の組み合わせ |
| es | Lo mejor para tareas cotidianas | La mejor combinación de velocidad e inteligencia |
| de | Ideal für alltägliche Aufgaben | Die beste Kombination aus Geschwindigkeit und Intelligenz |
| pl | Najlepszy do codziennych zadań | Najlepsze połączenie szybkości i inteligencji |
| hu | Ideális mindennapi feladatokhoz | A sebesség és az intelligencia legjobb kombinációja |

（en.json 由 merge 自动带入，无需手动。）

---

## 5. 改造点基线（§14）

- 预期 **118 不变**，START/END 10/10（本次无品牌/路径类新改造点；i18n 值同步与 package.json 版本合并均不加 marker）。
- merge 后照跑 §14 §0 全格式 grep + `@mariozechner`（0）+ `@craft-agent/`（0）+ `.craft-agent` 硬路径（0）。

---

## 6. release-notes 中文化草稿（merge 后落 `apps/electron/resources/release-notes/0.10.5.md`）

```markdown
# v0.10.5 — Claude Sonnet 5 上架

## 新增功能

- **Claude Sonnet 5 现已可用** — Anthropic 最新的 Sonnet 级模型（`claude-sonnet-5`，2026-06-30 发布）加入模型清单，拥有 100 万 token 上下文窗口与自适应思考能力。它成为当前主力 Sonnet，Sonnet 4.6 作为上一代继续保留。默认模型不变（仍为 Opus 4.8）。（说明：U Agents 通过 U-API 使用模型——若需使用 Sonnet 5，请在 newapi 后台配置对应路由后，于连接的模型清单中自行添加 `claude-sonnet-5`。）

## 改进

- **Claude Agent SDK 升级至 0.3.197** — 内置 SDK 从 0.3.170 升级（对齐 Claude Code v2.1.197），自带 CLI 现已原生识别 Sonnet 5（`sonnet` 别名、上下文窗口与 effort 默认值），并包含 0.3.170 以来的上游修复（含 Windows CLI 子进程闪窗修复）。全量类型检查与测试套件通过。

## 缺陷修复

- 无。

## 破坏性变更

- 无。

> 备注：本版是一次极小的跟随更新——仅 Sonnet 5 模型注册与 SDK 升级，不涉及 U Agents 的任何锁定与品牌逻辑。
```

（已去 commit hash；Bedrock 段对我方无意义已略；补 U-API 路由说明与 0.10.4 版式一致。）

---

## 7. 可选跟进（不阻塞）

- **U-API 预设清单是否加 `claude-sonnet-5`**（D4，02 §3.3）：取决于 newapi 后台是否配置该路由。配置后可在 `ApiKeyInput.tsx` 的 Anthropic 侧候选清单加入；不配置则不动。用户拍板。

---

## 8. 建议 SOP（与 v0.10.4 相同，含 C15）

```bash
git checkout -b sync/upstream-v0.10.5-YYYYMMDD
git merge upstream/main            # 预期 15 冲突：14 package.json + bun.lock
# 14 package.json：保 @u-agents 名/描述，版本取 0.10.5
git checkout upstream/main -- bun.lock && bun install     # C15
# §4 locale 值同步（6 文件）
# §6 release-notes 中文化
bun run typecheck:all              # 期望 EXIT=0
# §14 grep：118 / 10 / 10 + 三残留全 0
bun run dist:mac                   # SDK bump → 打包 + 真发一条 Pi 对话（C14 铁律）
```

---

## 9. 预测评级

**A。** 无决策点（§7 的预设清单是可选项）；实质工作只有 6 个 locale 的一行值翻译 + release-notes 中文化。风险集中在 bun.lock（已有 C15 程序）与 SDK bump 后的打包冷启动（C14 真测一条对话）。
