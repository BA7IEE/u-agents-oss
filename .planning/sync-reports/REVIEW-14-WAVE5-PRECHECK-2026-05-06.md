# Review v14 — Wave 5（v0.9.1 同步执行）前置 SOP 深度核（2026-05-06）

**Review 焦点**：Wave 4 已修完文档，但 Wave 5 真要跑 git merge 之前必须 review SOP 可执行性
**审查方法**：3 个并行 Opus agent 覆盖（A SOP 流程可执行性 / B 风险地图事实精核 / C 执行链路命令可用性）
**总评**：**Wave 5 就绪度从 v12 评估的 95% 实测降到 75%**——发现 3 个 P0 SOP 缺陷阻碍执行

> v14 是"大 review v12 + 元 review v13 + Wave 4 文档修"之后的"可执行性 review"——找出 v12/v13 没 catch 的执行细节缺陷。这是 v0.9.1 同步前的最后一道防线。

---

## 1. 3 个 P0 阻塞型新发现

### P0-1：[07-upstream-sync.md §2.7c C10](.planning/07-upstream-sync.md) 的 grep 方向反了

Wave 4 我加 C10 时写：
```bash
git diff upstream/main..HEAD -- packages/shared/src/config/llm-connections.ts | grep -E "^[+-]\s+\w+\?:"
```

**方向错**：要找"上游新增字段"，方向应是 `acb08842..upstream/main`（merge-base → 上游 HEAD）或 `HEAD..upstream/main`。当前命令是 `upstream/main..HEAD` —— 查的是"我们相对上游删除的"，merge 前我们没动 llm-connections.ts，输出 0 条 `+ midStreamBehavior` —— **user 会被假报误以为"上游没加新字段"**。

**修复**：改成 `git diff acb08842..upstream/main -- ...`。

### P0-2：[zh-Hans.json](packages/shared/src/i18n/locales/zh-Hans.json) 90 行不符合字典序

C 路实测：当前 `packages/shared/src/i18n/locales/zh-Hans.json` 跟字典序 sort 后**diff 90 行**——具体：
- `about.basedOn` / `basedOnDesc` / `viewLicenses` / `viewSource` 4 个 key 被追加在**文件末尾**（应在 `apiSetup.*` 之前）
- `chat.inputFailedTitle/Description` 等顺序不对

v0.9.1 引入的 `lint:i18n:sorted` pre-commit hook **会在 merge 后第一个 commit（即 merge commit 本身）就阻塞**——SOP 当前没说怎么应对。

**修复**：07 §2.6 / §2.4.3 加流程：`merge → bun install（让 v0.9.1 拉来 sort-locales script）→ bun run sort-locales → 重 add zh-Hans.json → 继续 commit`。

### P0-3：07 §2.4.3 手解策略表 + §2.6 lint 列表缺关键步骤

A 路 + C 路联合 finding：

| 缺失项 | 位置 | 影响 |
|---|---|---|
| AiSettingsPage.tsx 手解步骤 | 07 §2.4.3 表 | user 撞 P0 冲突时不知所措（v12/v13 说"用上游做基底"但没给具体 6 步 git 命令）|
| `bun run lint:i18n:sorted` | 07 §2.6 lint 列表 | merge 后跑 validate:ci 会失败但 user 不知道为啥 |
| `bun run sort-locales` 抢救 | 07 §4 实操陷阱 | locale 排序阻塞 commit 时找不到救援命令 |
| Pi SDK 0.72.1 重 build | 07 §2.6 step 0 | bun install 不会自动重 build pi-agent-server，子进程跑老 SDK 不报错（M2 无单测覆盖）|
| `git checkout --theirs <file>` | 07 §2.4.3 | v12/v13 "用上游基底"在 git 操作层面没明写命令 |

C 路给了 AiSettingsPage 完整 6 步手解 cheatsheet（含 grep 锚点），这是个**可直接拷进 07 §2.4.3 的素材**。

---

## 2. P1 漂移（v12/v13 自身的）

### P1-1：v13 漏抓 v12 第 3 处量化误差

B 路新发现：
- v12 §1.2 表说 `storage.ts` `+1 行 updateLlmConnection` —— **实测 +2 insertions**
- v13 §2 修正了 v12 两处误差，**但漏抓这第 3 处**

### P1-2：v13 §3 自身引入新算术错

- v13 §3 表说 `AiSettingsPage.tsx` "+58/-3 = 115 总 diff"
- 实测 `git diff --stat` = `1 file changed, 55 insertions(+), 3 deletions(-)`
- **stat header 的 "58" 本身就是 55+3 总计**——v13 把它当成 "+58" 再加 -3 → 算成 115 = 双重错误
- 真实 = +55/-3

### P1-3：08 §9 grep 提示精确性

- §9 写 "`wc -l` 应有 ~124 行"
- 实测 `git diff acb08842..upstream/main -- packages/shared/src/config/llm-connections.ts | wc -l` = **149**（含 hunk 头/上下文）
- 用户照做会以为漂移
- 应改 `git diff --stat ... | grep insertions` 直接拿 124（=insertions 数）

### P1-4：07 §2.1 `$DATE` 环境变量跨命令断

`DATE=$(date +%Y%m%d)` 在 §2.2 设定，但 §2.4.5 / §2.8 引用 `$DATE`——user 复制代码块到新 shell 时变量未定义，会推空 tag `sync-`。

---

## 3. v14 综合 finding 清单（Wave 4.5 修）

| # | 严重度 | 项 | 文件 |
|---|---|---|---|
| 1 | **P0** | C10 grep 方向反，改 `acb08842..upstream/main` | [07-upstream-sync.md §2.7c](.planning/07-upstream-sync.md) |
| 2 | **P0** | §2.4.3 手解策略表加 AiSettingsPage.tsx + 6 步 cheatsheet | [07-upstream-sync.md §2.4.3](.planning/07-upstream-sync.md) |
| 3 | **P0** | §2.6 lint 列表加 `lint:i18n:sorted` + 顺手提 sort-locales 救援 | [07-upstream-sync.md §2.6](.planning/07-upstream-sync.md) |
| 4 | **P0** | §2.6 加 step 0：`bun run server:build:subprocess` 重 build pi-agent-server（Pi SDK 0.72.1）| 同上 |
| 5 | **P0** | §4 加新坑 4.5：locale 排序 hook 阻塞 + sort-locales 修复路径 | [07-upstream-sync.md §4](.planning/07-upstream-sync.md) |
| 6 | P1 | §2.1 提示"全程同 shell 执行"或改 inline | [07-upstream-sync.md §2.1](.planning/07-upstream-sync.md) |
| 7 | P1 | 08 §9 grep 提示改 `--stat` 形式（避免 149 vs 124 误判）| [08-conflict-zones.md §9](.planning/08-conflict-zones.md) |
| 8 | P1 | REVIEW-13 加 v12 第 3 处量化误差（storage.ts +1→+2）+ 修正 v13 自身算术错（AiSettingsPage +55/-3）| [REVIEW-13](.planning/sync-reports/REVIEW-13-META-2026-05-06.md) |
| 9 | P2 | 07 §2.5 step 1 grep 表达式优化（防 0 命中假报）| [07-upstream-sync.md §2.5](.planning/07-upstream-sync.md) |

**预计 Wave 4.5 工作量**：5 项 P0 + 3 项 P1 + 1 项 P2 = ~9 项 .md 修，预计 30-40 分钟。

---

## 4. 三维度评级（修完 Wave 4.5 后）

| 维度 | v12 评估 | v14 实测 | 修完 Wave 4.5 |
|---|---|---|---|
| git 仓库 | A | A | A |
| 文档（spec 内容）| A | A | A |
| **SOP 可执行性** | n/a | **B** | A |
| 风险地图精度 | n/a | A−（B 路 finding）| A |
| 执行链路就绪度 | n/a | **B**（C 路 locale sort 高风险）| A |
| **v0.9.1 同步就绪度** | 95% | **75%** | **95%** |

**v12 评估的 95% 偏乐观**——v12 只看了"风险地图"内容是否齐全，没核 SOP 步骤是否真能照做。v14 是第一次以"假装真要执行"的角度审 SOP。

---

## 5. v14 元评估

**v14 模式价值**：在大 review（v12）+ 元 review（v13）+ Wave 4 文档修之后，做"可执行性 review" —— 这是又一个被忽略的维度。

| 维度 | v12 | v13 | v14 |
|---|---|---|---|
| 范围 | 风险地图 | v12 量化精核 | SOP 可执行性 + 命令可用性 |
| Agent 数 | 4 | 1 | 3 |
| 真新发现 | 4（dead helper + 0 测试 + CI 缺口 + v0.9.1 时效）| 2 量化误差 | **3 P0 + 4 P1 + 1 P2** |
| 价值密度 | 高 | 高 | **极高**（找到的全是阻塞型）|

**v14 启发**：未来同步前 SOP review 应该作为标准流程——不只是看"文档说了什么"，而是模拟 user "假装真要跑这些命令"，找出隐藏假设。

---

## 6. 总评

v14 找到的 3 个 P0 + 4 个 P1 + 1 个 P2 都是**真实可阻塞 Wave 5 执行**的缺陷。**强烈建议先做 Wave 4.5（~30 分钟）再启动 Wave 5**。

修完后：
- SOP 可执行性 B → A
- 风险地图精度 A− → A
- v0.9.1 同步就绪度 75% → 95% 真就绪
- user 可一次跑通 Wave 5（git fetch/merge/解冲突/build/test/commit）

**v14 唯一动作建议**：跑 Wave 4.5（9 项 .md 修），然后才启动 Wave 5。
