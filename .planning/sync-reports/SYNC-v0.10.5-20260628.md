# SYNC-v0.10.5 — 上游同步终评报告（装机实测通过）

> merge + 装机实测后产出。预分析见 [`UPSTREAM-PREVIEW-v0.10.5-2026-06-28.md`](UPSTREAM-PREVIEW-v0.10.5-2026-06-28.md)。
> 合并日期 2026-06-28（merge commit `35fed047`）；装机实测同日。
> **终评：A（fork 史上最小最干净的一版，端到端实测通过）。**

---

## 0. TL;DR

- 上游 `v0.10.5`（`c9d9a26f`，单 squash）合并完成，分支 `sync/upstream-v0.10.5-20260628`，版本号统一 `0.10.5`。
- 规模 **22 文件 / +122 −51**——fork 历史最小一版。主题只有：**Claude Sonnet 5 上架**（`claude-sonnet-5`，1M context）+ **Claude Agent SDK 0.3.170 → 0.3.197**。默认模型不变（Opus 4.8）。
- **15 冲突全机械**（14 package.json C11 + bun.lock）；§3.3 高冲突文件仅 `llm-connections.ts` 被上游改，我方与基线逐字节一致 → **零冲突照收**。
- 改造点基线 **118 不变**（无品牌/路径类改造需求）。
- **唯一实质工作 = i18n 值同步**（见 §3）。
- 验证全绿：`typecheck:all` EXIT=0、118/10/10、三残留全 0、i18n 三连检全过、**arm64 DMG 装机实测通过**。

---

## 1. 冲突与解决（15 个）

| 类别 | 数 | 解决 |
|---|---|---|
| `package.json` × 14 | 14 | 保 `@u-agents` 名/描述，版本取 `0.10.5`（C11） |
| `bun.lock` | 1 | C15 程序（见 §2） |

`llm-connections.ts`（§3.3 #3）被上游改（`PI_PREFERRED_DEFAULTS` + BEDROCK 映射加 `claude-sonnet-5`），但我方该文件与上游 v0.10.4 基线逐字节一致 → 自动合并，无冲突。`models.ts` / `en.json` / 两个测试同理自动合并。

`@mariozechner` = 0，`@craft-agent/` scope = 0（C11 clean），C13 未触发。

---

## 2. bun.lock（C15，v0.10.4 教训）

按固化程序处理，未踩 @sentry 重复坑：
```bash
git checkout upstream/main -- bun.lock   # 上游 v0.10.5 lock 基底
bun install                              # 调和 @u-agents 工作区名
```
结果：`@u-agents` × 80 / `@craft-agent` = 0 / `@sentry/core` 单版本 10.36.0 / SDK `0.3.197` / 0 冲突标记。

---

## 3. i18n 值同步（本次唯一实质工作）

上游把 `en.json` 的 `model.sonnetDesc` 值改了（"Best for everyday tasks" → "The best combination of speed and intelligence"），我方 6 个非英语 locale 仍是旧含义翻译。`lint:i18n:parity` 抓不到值变化（key 集合不变），手动同步：

| locale | 新值 |
|---|---|
| zh-Hans | 速度与智能的最佳结合 |
| ja | 速度と知性の最良の組み合わせ |
| es | La mejor combinación de velocidad e inteligencia |
| de | Die beste Kombination aus Geschwindigkeit und Intelligenz |
| pl | Najlepsze połączenie szybkości i inteligencji |
| hu | A sebesség és az intelligencia legjobb kombinációja |

> **注**：`model.sonnetDesc` 在我方**锁定 UI 里基本不可见**（模型选择器展示 U-API 路由清单，非 Anthropic 直连注册表）。同步是为源码/上游一致性，非用户可见文案。
>
> **上游小瑕疵（C13 类，不处理）**：Sonnet 4.6 的 `descriptionKey` 仍与 Sonnet 5 共用 `model.sonnetDesc` → 启用 i18n 的 UI 里两代 Sonnet 同句。我方不可达，零影响。

---

## 4. 验证

| 项 | 结果 |
|---|---|
| `bun run typecheck:all` | **EXIT=0，0 errors** |
| U-API 标记 / START / END | **118 / 10 / 10** |
| `@mariozechner` / `@craft-agent/` / `.craft-agent` | **0 / 0 / 0** |
| `lint:i18n:sorted` / `parity` / `coverage` | 全过（6 locale × 1466 keys / 2911 callsites） |
| **装机实测**（2026-06-28，arm64 adhoc DMG 272 MB）| ✅ **App 启动正常 + 真发一条 Pi 对话能回**（SDK 0.3.197 升级后 C14 真测；koffi 警告同 v0.10.4 无害坐实）|

---

## 5. 评级与剩余

**终评：A。** 无决策点。

可选跟进（不阻塞）：**U-API 预设清单是否加 `claude-sonnet-5`**（D4，02 §3.3）——取决于 newapi 后台是否配置该路由。用户拍板。

剩余动作：merge `sync/upstream-v0.10.5-20260628` → `main`（fast-forward）。
