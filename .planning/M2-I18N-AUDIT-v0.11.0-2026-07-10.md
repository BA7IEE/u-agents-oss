# v0.11.0 i18n 核查 — 2026-07-10

> 范围：上游 v0.11.0 新增 Projects、Kanban、Tasks、后台任务与通用 UI 文案后的 locale 合并与质量核查。

## 1. 结论

- `en.json` 与 6 个非英语 locale 均为 1669 keys。
- 相比同步前 1466 keys，净增 203 keys。
- `zh-Hans.json` 保留 U Agents / U-API 既有品牌 key，未恢复 `menu.aboutCraftAgents`、`menu.hideCraftAgents`、`menu.quitCraftAgents`。
- parity、排序和调用覆盖全部通过。

## 2. 合并策略

locale 冲突没有整文件选 `ours` 或 `theirs`，而是按三方 key 合并：

1. 本地已修改值保留本地版本。
2. 本地明确删除的旧品牌 key 继续删除。
3. 上游新增 key 接收上游对应 locale 值。
4. 本地未修改而上游变更的值跟随上游。
5. 最后按字典序输出并执行 parity / coverage。

## 3. 验证

| 检查 | 结果 |
|---|---|
| `bun run lint:i18n:parity` | 通过，6 locales × 1669 keys |
| `bun run lint:i18n:sorted` | 通过 |
| `bun run lint:i18n:coverage` | 通过，3406 literal callsites |
| 旧菜单品牌 key | 0 |
| v0.11.0 release notes | 已中文化 |

## 4. 已知治理缺口

`bun run lint:i18n:strings` 指向不存在的 `scripts/lint-i18n-strings.sh`。该断链在同步前已存在，且不属于当前 `validate:ci` 闸门；本报告不擅自发明检查规则，后续应先定义它与 `coverage` 的职责边界，再决定补脚本或删除过期入口。
