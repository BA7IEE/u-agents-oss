# v0.11.0 品牌反向核查 — 2026-07-10

> 范围：正式同步 `v0.11.0` 后，对 U Agents（桌面应用）与 U-API（LLM 网关）做反向核查。OAuth relay、官网和法务页面不在本次改造范围。

## 1. 结论

- 用户可见的应用品牌保持 U Agents / 优智体。
- LLM 连接、模型描述与系统 prompt 的网关品牌保持 U-API。
- `@craft-agent/` scope 为 0。
- `electron-builder.yml` 新增本地网络权限说明已从 Craft Agents 改为 U Agents。
- v0.11.0 release notes 已整篇中文化并去除上游链接和品牌。
- Projects、Kanban、Tasks 新 UI 未发现新的用户可见 Craft 品牌入口。

## 2. 双品牌核对

| 场景 | 期望 | 结果 |
|---|---|---|
| Bundle / 窗口 / 菜单 / DMG | U Agents | 通过 |
| 中文产品称呼 | 优智体 | 通过 |
| AI 连接卡片 | U-API | 通过 |
| Pi backendName / 模型描述 | U-API | 通过 |
| 本地网络权限说明 | U Agents | 通过 |
| package scope | `@u-agents/*` | 通过 |

## 3. 可保留命中

- 核心修改文件头中的 `based on Craft Agents`：Apache 2.0 派生声明。
- 测试 fixture 中的旧 connection name：用于验证历史配置迁移。
- U-API marker 注释中的 “Craft Agent → U Agents”：同步溯源说明。
- browser/window 注释里的旧产品名：不进入 UI，可在以后触碰文件时顺手清理。
- `agents.craft.do` OAuth relay：`LEGAL.md §5.1` 已知瑕疵，仍属 M3。

## 4. 新增修正

- `apps/electron/electron-builder.yml`：`NSLocalNetworkUsageDescription` 改为 U Agents。
- `packages/shared/src/agent/pi-agent.ts`：接收 `projectContext` 参数时继续传 `U-API`。
- `apps/electron/resources/release-notes/0.11.0.md`：中文化、去 hash / issue 链接、改写后台代理默认策略。
- `apps/electron/src/renderer/playground/demos/messaging/AllowListPreview.tsx`：演示名改为 U Agents。

## 5. 结论边界

本次品牌核查通过，不代表 OAuth relay 已自建，也不代表官网、下载页或法务页面已完成；这些仍按用户要求保持不动。
