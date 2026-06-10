---
name: brand-audit
description: 核查 U Agents fork 的品牌替换是否遗漏。当任务涉及检查 Craft/craft.do/lukilabs 残留、验证 U Agents（桌面应用）与 U-API（LLM 网关）双品牌使用是否正确、或上游同步后做品牌反向核对时触发。产出核查清单/规格 .md，不改代码。
---

# 品牌替换核查

> 规则正本：[`.planning/01-branding-spec.md`](../../../.planning/01-branding-spec.md)（品牌替换全表）。
> 双品牌区分见 `CLAUDE.md` §3.5 / §3.6。本 skill 只做核查 + 产出清单，不改代码。

## 双品牌（别混用）
- **U Agents / 优智体** = 桌面应用（产品名、Bundle、窗口标题、安装包名、关于页）。
- **U-API** = LLM 中转站（所有 LLM 连接 UI、连接卡片、错误提示、控制台跳转）。

## 用户可见面 0 残留（`CLAUDE.md` §3.5）
`Craft` / `Craft Agents` / `craft.do` / `lukilabs` / `craft-ai-agents` 不得出现在菜单、对话框、错误提示、邮件签名、commit 模板。
已知可接受瑕疵：OAuth 首授时地址栏短暂 `agents.craft.do`（M3 自建 relay 前保留，见 `LEGAL.md`）。

## 快速反向核查（只读 grep）
```bash
# 用户可见品牌残留（应为 0；FEATURE_FLAG 门控/系统 prompt 例外见 01 规格）
grep -rIn --exclude-dir=node_modules -E "Craft Agents|craft\.do|lukilabs|craft-ai-agents" packages apps --include="*.ts" --include="*.tsx" | grep -v "U-API"
# 旧 NPM scope（同步后必须 0，命中即 C11）
grep -rIn --exclude-dir=node_modules "@craft-agent/" packages apps
```
命中项逐条对照 `01-branding-spec.md` 判断"该替换/可保留"，写进核查清单 .md；不要直接改源码。

## 必查资源（来自 `CLAUDE.md` §3.2）
`electron-builder.yml` · `branding.ts` 🔴 · 各 `package.json` name/homepage · `auto-update.ts` 更新源 · `CraftAgentsSymbol.tsx` · `resources/craft-logos/` · `i18n/locales/` 字面量。
