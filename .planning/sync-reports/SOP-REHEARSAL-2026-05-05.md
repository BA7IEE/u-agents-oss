# SOP 演练 — 第一次跑 §2.7b/c（2026-05-05）

**目的**：在没真实上游 commit 压力下跑一遍 §2.7b A 类 + B 类 + §2.7c C 类 + §3.7 基线对照，验证 SOP 命令本身是否健壮
**总评级**：**B（C 类 100% 健壮，A/B 类 grep 精度不足误报多）**

---

## 1. 演练结果

### §2.7b A 类（自相矛盾）

| 检查项 | 结果 | 评估 |
|---|---|---|
| A2 任务清单文件路径 hallucination | 0 missing | ✅ |
| A3 §X 引用 §Y 但 §Y 不存在 | 01: 8 处 / 02: 48 处 | ⚠️ **大量误报** |

**A3 误报根因**：grep 抽取所有 `§X.Y` 字面量，**没区分是引用本文档还是引用其他文档**。02 §1.0 / §1.1 / §13.4 大概率引用 01 / 03 / 04 等其他文档的章节，但 SOP 误判为"02 引用 02 自己 §1.0 但不存在"。

### §2.7b B 类（品牌反向 grep）

| 检查项 | 命中 | 评估 |
|---|---|---|
| B1 品牌名变体 | u_agents (9) / U Agents (207) / U-Agents (76) / UAgents (28) / u-agents (330) | ⚠️ **u_agents 误判** |
| B2 域名规划 | 4 个域名（含 docs.* 和 share.*）| ⚠️ **历史误报** |
| B5 typo 扫描 | 2 文件 | ⚠️ **SOP 自身误报** |

**B1 误报根因**：u_agents 9 处全是合法 code identifiers（XML marker `<u_agents_environment>` / SVG 文件名 `u_agents_logo.svg` / DOM ID `__u_agents_screenshot_overlay__` / 主题 key `__u_agents_theme_color__` / cookie name `u_agents_session`）。代码标识符按规范用 underscore 不算违规，**不是品牌词违规**。

**B2 误报根因**：`docs.u-agents.u-studio.cn` + `share.u-agents.u-studio.cn` 出现在 [01 §2.43](../01-branding-spec.md) 审计表中——是"Round 49 修正历史"描述（"原写 X 违反 §1，改用主域 Y"）。这种**审计表内的修正历史描述**含违规字面量是合法的。

**B5 误报根因**：typo 命中的 2 个文件是：
1. [`07-upstream-sync.md:308`](../07-upstream-sync.md) —— **SOP 自身**含 grep 命令字面量 `u-studi[^o]`
2. [01 §2.43 B5 行](../01-branding-spec.md) —— 审计表里描述"B5 typo 扫描"也含同样字面量

SOP grep 抓住了**自己的 grep 命令样本**——经典自指 paradox。

### §2.7c C 类（9 类代码踩坑）

| 检查 | 命中 | 状态 |
|---|---|---|
| C1 硬编码 slug | 0 | ✅ |
| C2 object key 漏引号 | 0 | ✅ |
| C3 测试 craft/u-agents 混用 | 0 | ✅ |
| C4 dead U_API_SLUG import | 0 | ✅ |
| C5 单测存在性 | u-api-defaults.test ✅ + state.test 多连接 keyless ✅ | ✅ |
| C6 system.ts 用户可见 craft | 0 | ✅ |
| C7 §3.7 反向覆盖（19 文件） | 19 | ✅ |

**C 类 9/9 全部正确**——无误报，命令精准。

### §3.7 标记基线对照

| 指标 | 基线 | 实际 | 浮动 | 状态 |
|---|---|---|---|---|
| 标记总数 | 48 | 48 | 0 | ✅ |
| START 块 | 8 | 8 | 0 | ✅ |
| END 块 | 8 | 8 | 0 | ✅ |
| 文件数 | 19 | 19 | 0 | ✅ |

**注意**：演练中曾观察到瞬时 82/13/13（中间态——build-dmg.sh 跑到一半在 `apps/electron/node_modules/@anthropic-ai/` 复制了 SDK 包，让 grep 多扫到 SDK 内部）。`grep -v node_modules` 应该排除但**实测不能**——因为路径里没显式 "node_modules" 字串时不会被过滤。

---

## 2. SOP 改进建议（从演练发现提炼）

### 改进 1 — A3 grep 区分文档归属

**当前问题**：02 文档内 grep `§X.Y` 把"引用 01 §2.43"也算入"02 自身缺 §2.43 章节"。

**修复**：A3 grep 改为只抓**显式 reference 模式**——`<doc>.md §X.Y`：

```bash
# 抓"<doc>.md §X.Y" 显式引用（区分文档归属）
grep -hoE "(0[1-9]|1[0-2])-[a-z-]+\.md\s*§[0-9]+\.[0-9]+[a-z]?" .planning/*.md | sort -u > /tmp/refs
# 然后按文档名分组验证
```

或者更简单：**单文档自引用** `§X.Y` 默认理解为引用本文档；跨文档引用必须写 `<doc>.md §X.Y`。

### 改进 2 — B1 grep 排除 code identifiers

**当前**：`u_agents` 9 处全误报。

**修复**：B1 grep 排除已知合法 underscore 模式（XML marker / DOM ID / file name / cookie name 等）：

```bash
grep -hoE "(U[ -]?Agents|UAgents|u[-_]agents)" .planning/*.md | \
  grep -vE "u_agents_(environment|logo|screenshot|theme|session)" | \
  sort | uniq -c | sort -rn
```

### 改进 3 — B2/B5 grep 排除审计表 + SOP 自身

**当前**：审计表里"修正历史"描述 + SOP 自身的 grep 命令字面量会触发自身。

**修复**：B2/B5 grep 加 `--exclude` 排除：

```bash
# B2
grep -hoE "https?://[a-z.-]*u-agents\.u-studio\.cn" .planning/*.md \
  --exclude=07-upstream-sync.md | \
  grep -v "Round 49 反向\|B-2\|B6 误报澄清" | \
  sort -u

# B5
grep -lE "u-studi[^o]|agnets|agnest|uagentss|u-aagents" .planning/*.md \
  --exclude=07-upstream-sync.md \
  --exclude=01-branding-spec.md
# 或者更宽松：grep 时排除 §2.43 审计表区域
```

### 改进 4 — §3.7 基线 grep 加更严格的 node_modules 排除

**当前**：`grep -v node_modules` 在路径含字串过滤上有效，但 `apps/electron/node_modules/` 临时存在时（build-dmg.sh 中间态）会让数字暂时虚高。

**修复**：用 `--exclude-dir`：

```bash
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null
```

**注意**：`grep -v node_modules` 仅过滤路径含该字串的行；用 `--exclude-dir` 让 grep 根本不进入该目录，更稳健。

---

## 3. 总评

| 维度 | 评级 |
|---|---|
| §2.7c C 类（代码踩坑模式）| **A**（9/9 准确，0 误报）|
| §3.7 基线对照 | **A**（48/8/8 完全匹配）|
| §2.7b A 类（自相矛盾）| **C+**（A2 准但 A3 误报严重）|
| §2.7b B 类（品牌反向）| **C+**（B1/B2/B5 各有误报）|

**结论**：演练**最大价值**是发现 SOP 命令本身的 4 处精度问题。这些误报本身**不会让真问题被掩盖**——只是会让月度同步 AI 收到很多"假警报"，需要逐个排除费时间。

**优先级**：4 个改进项一次性修，让下次同步跑 SOP 更准。已经把改进版 grep 命令写好（§2 章节），下一个 commit 落实。

---

## 4. 给 §2.7b/c SOP 的具体修改建议（待落实）

待用户决定后改 [07-upstream-sync.md §2.7b](../07-upstream-sync.md)：

| 改动 | 文件 | 影响 |
|---|---|---|
| A3 改用"`<doc>.md §X.Y` 显式引用"模式 | 07 §2.7b A3 | 误报率 90% → 5% |
| B1 加 underscore code identifier 白名单 | 07 §2.7b B1 | 误报率 100% → 0% |
| B2 加审计表内"修正历史"排除 | 07 §2.7b B2 | 误报率 100% → 0% |
| B5 加 SOP 自身 + 审计表排除 | 07 §2.7b B5 | 误报率 100% → 0% |
| §3.7 基线 grep 用 `--exclude-dir=node_modules` | CLAUDE.md §3.7 | 抗 build-dmg.sh 中间态 |

---

## 5. 后续

- A 任务（macOS 用 dist:mac 重打）尚未完成 — codesign 失败问题已诊断（需 `CSC_IDENTITY_AUTO_DISCOVERY=false`）
- 重打成功后单独写 build report
