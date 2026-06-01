---
name: i18n-check
description: U Agents 多语言（i18n）规格与核查。当任务涉及 locale 文件、中文化策略、翻译 key 的 parity/coverage/排序检查、或上游新增文案的本地化时触发。产出规格/核查 .md，不改 locale 文件本身。
---

# i18n 多语言核查

> 规则正本：[`.planning/10-i18n-zh.md`](../../../.planning/10-i18n-zh.md)（中文化策略）。
> 本 skill 只做核查 + 写规格；locale 文件是代码，由用户/执行会话改。

## 三道闸（CI `validate:ci` 会跑，权威）
| 检查 | 命令（只读核查可跑） | 含义 |
|---|---|---|
| parity | `bun run lint:i18n:parity` | 所有 locale 的 key 集合一致（6 locales 必须对齐）|
| coverage | `bun run lint:i18n:coverage` | 代码里用到的 key 都有翻译，无悬空 |
| sorted | `bun run lint:i18n:sorted` | key 按字母序排列 |

> commit 钩子 `.husky/pre-commit` 跑 `lint:i18n:staged`（只查暂存的 locale 文件）。

## 写规格要点
- 上游每次同步新增的英文文案 → 记进核查清单：哪些 key 需要中文翻译、哪些 locale 缺。
- 新增 key 必须**所有 locale 同时加**（否则 parity fail）+ 保持字母序（否则 sorted fail）。
- 发现缺漏只**记录到规格/清单 .md**，由用户落地到 `i18n/locales/`。
- 品牌字面量（Craft→U Agents）的本地化与 [`brand-audit`] skill 协同，对照 `01-branding-spec.md`。
