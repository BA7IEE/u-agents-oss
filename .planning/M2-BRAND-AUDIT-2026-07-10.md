# M2 品牌治理核查 — 2026-07-10

> 范围：核对本轮 README、路线图、上游同步规程与代码中的品牌残留。只记录现状，不扩大到官网、法务页面或 OAuth relay 改造。

## 1. 结论

- `packages/`、`apps/` 中旧 NPM scope `@craft-agent/` 为 **0**（排除 `release/` 历史打包副本）。
- README 已明确 U Agents / U-API 双品牌、闭源商业 fork、当前能力边界与上游署名，不再宣称本项目是开放贡献型多 provider 产品。
- 当前上游仓库地址统一为 `craft-ai-agents/craft-agents-oss`；同步 SOP 不再使用已迁移的 `lukilabs` 地址作为当前入口。
- 仍存在的 `Craft` / `craft.do` 命中均已分类，未在本轮直接改源码。

## 2. 可保留项

| 类型 | 位置 | 判断 |
|---|---|---|
| Apache §4(b) 修改声明 | `storage.ts`、`paths.ts`、`state.ts`、`branding.ts`、`connection-setup-logic.ts`、`electron-builder.yml` 文件头 | 合规署名，保留；其中旧 GitHub URL 是原始来源记录，不是当前同步入口 |
| 上游 issue / 历史说明 | `SessionManager.ts` 注释、`.planning/` 历史账本 | 仅供溯源，保留 |
| U-API patch 说明 | `model-picker-helpers.ts` 注释 | 用来说明上游字面量如何改成 `U-API`，不是用户可见品牌残留 |
| 内部语义注释 | browser/window 相关源码中的 “local Craft Agents window” 等 | 不进入用户界面，可后续随触碰文件顺手更新，不单独制造冲突 |

## 3. 暂缓项

| 残留 | 当前状态 | 后续边界 |
|---|---|---|
| `agents.craft.do` OAuth relay | `oauth-relay.ts`、`slack-oauth.ts` 及构建后的 Pi 资源仍可达 | 属路线图 M3；本轮按用户要求不处理第 1–3 项，不改回调合同 |
| `mcp.craft.do` URL validator 示例 | Craft MCP URL 校验逻辑与测试仍在源码 | 需结合功能裁剪/兼容策略单独决策，不在文档统一任务里删除 |
| Playground 中 `Craft Agents` 与旧仓库 URL | 仅内部 playground demo/registry | P2 清理项；没有证据表明进入正式桌面主界面，本轮不动源码 |
| `electron-builder.yml` 原始来源 URL | 高冲突文件的合规文件头仍指向 `lukilabs` | 作为历史来源可保留；当前 upstream 地址以 `07-upstream-sync.md` 为准 |

## 4. 本轮文档治理

- 活跃文档只在一个位置维护改造点硬数字：`.planning/14-uapi-marker-registry.md §0`。
- `.planning/07-upstream-sync.md` 与相关 skills 只引用权威基线，不再复制 `98`、`115`、`9/9` 等旧值。
- 全格式命令排除 `release/`，当前实测为 **120 / START 10 / END 10**；新增 1 处为 `files.ts` 依赖安全改造。不排除历史打包副本会误报 208。
- `.agents/` 与 `.codex/` 是任务开始前已存在的未跟踪目录，本轮不覆盖其中的用户文件。
