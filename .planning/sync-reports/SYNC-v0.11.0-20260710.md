# v0.11.0 上游同步报告 — 2026-07-10

> 分支：`codex/sync-upstream-v0.11.0-20260710`
> 上游标签：`v0.11.0`（`f4e172bf372f4ccc7389a189be1e0b0541f96282`）
> 合并基线：`v0.10.5`（`c9d9a26fbefa3a5165ee9aa50cb30c25466afd81`）
> 状态：同步、冲突处理、代码验证、macOS 打包与真实 U-API 对话验收完成；保留在独立分支，未合回 `main`、未推送。

## 1. 结论

本次同步按预分析结论“有条件接收”执行，接收 Projects、Kanban / Tasks / Conductor、Pi SDK 0.80.3、自动化测试超时修复、侧栏长标签修复及新增 i18n 文案。

U Agents 的产品约束保持不变：

- LLM 入口仍固定为 U-API，`pi-agent.ts` 的 `backendName` 保持 `U-API`。
- 未恢复 Copilot SDK、`markitdown-js` 或其它 provider UI。
- 后台代理跨 turn 常驻改为默认关闭，仅在 `U_AGENTS_KEEP_BG_AGENTS_ALIVE=1` 时开启；兼容旧 `CRAFT_*` 变量。
- macOS 本地网络权限说明已接收并改为 U Agents 文案。
- `release-notes/0.11.0.md` 已中文化，并移除上游 commit hash、issue 链接和用户可见 Craft 品牌。
- 依赖安全 `overrides` 与删除链全部保留，生产审计仍为 40 项。

综合评级：**A−，U-API 核心链路已完成独立分支验收；WhatsApp 按当前产品决策不使用，不纳入本轮验收门槛。是否合回 `main` 仍由用户 review 决定**。

## 2. 合并影响

- 上游影响：207 个文件，约 `+15506 / -555`。
- 实际冲突：37 个文件。
- 冲突主要分组：15 个 package / lockfile、15 个源码与高冲突配置、7 个 locale。
- `CLAUDE.md §3.3` 高冲突文件命中：`apps/electron/electron-builder.yml` 1 个。
- marker-bearing 交叉文件：8 个核心代码文件，均逐项复核；既有 U-API 语义未丢失。

冲突处理原则：

1. 包名与 import 保留 `@u-agents/*`，版本统一升至 `0.11.0`。
2. 接收 Pi SDK 0.80.3 和 Projects / Tasks 新合同，不重新引入 `@github/copilot-sdk`。
3. `bun.lock` 以上一版安全锁文件为基底增量安装，避免 Sentry 重复版本事故。
4. locale 使用三方逐 key 合并：本地已修改/删除的品牌 key 优先，上游新增或未冲突值跟进。
5. ChatPage 继续隐藏未自建的分享入口，同时接收 Task 编辑动作。

## 3. 品牌、i18n 与标记基线

### 3.1 品牌

- `@craft-agent/`：0。
- 新增本地网络权限文案：`U Agents uses your local network ...`。
- 用户可见 release notes：已中文化，无上游 issue / commit 链接。
- 剩余 `agents.craft.do` 仅为既有 OAuth relay 已知瑕疵，未扩大范围。

详见 [`M2-BRAND-AUDIT-v0.11.0-2026-07-10.md`](../M2-BRAND-AUDIT-v0.11.0-2026-07-10.md)。

### 3.2 i18n

- 6 个非英语 locale 与 `en.json` 均为 1669 keys。
- 相比 v0.10.5 的 1466 keys，净增 203 keys。
- parity、排序与调用覆盖全部通过。

详见 [`M2-I18N-AUDIT-v0.11.0-2026-07-10.md`](../M2-I18N-AUDIT-v0.11.0-2026-07-10.md)。

### 3.3 U-API marker

- 合并前：120 / START 10 / END 10。
- 合并后：123 / START 10 / END 10。
- 新增 #67 / #67t：后台代理默认关闭、U Agents 环境变量与防回归测试。
- 新增 #68：上游测试适配本 fork 的 `noUncheckedIndexedAccess` 严格基线。

权威基线已更新到 [`.planning/14-uapi-marker-registry.md`](../14-uapi-marker-registry.md)。

## 4. 验证结果

| 验证项 | 结果 |
|---|---|
| `bun install` | 通过，1749 installs / 1651 packages |
| `bun run validate:ci` | 通过 |
| `bun run typecheck:all` | 通过 |
| v0.11 重点测试 | 118 pass / 0 fail |
| WhatsApp worker + messaging gateway | 237 pass / 0 fail |
| i18n parity / sorted / coverage | 通过，6 × 1669 keys |
| `bun audit --production` | 40：1 critical / 20 high / 18 moderate / 1 low，与同步前一致 |
| Electron build | 通过；main 24.7 MB，Pi server 26.59 MB，WhatsApp worker 6.0 MB |
| macOS arm64 DMG | 通过；272 MB，版本 0.11.0，adhoc 签名深度校验通过 |

DMG：`apps/electron/release/U-Agents-arm64.dmg`
SHA-256：`c7171d28740d16bb41c6370d82909c46080b620f786deeaf34727201eee743b3`

包体核对通过：LICENSE、NOTICE、Assets.car、Pi server、session MCP server、Bun、uv、WhatsApp worker、Claude SDK core 与原生 binary 均存在。

## 5. 实机结果与遗留项

### 已通过

- 打包版冷启动稳定，无 SDK / Pi server / module-not-found 崩溃。
- 中文主界面、U Agents 菜单、Projects 入口、列表/看板切换和版本 0.11.0 均正常。
- 实际配置中的 U-API 连接与默认模型能被 v0.11.0 读取。
- 在打包版中新建隔离会话，选择 `gpt-5.5` 并发送最小回显请求，实际收到精确回复 `U-API v0.11.0 OK`；真实 U-API 对话链路通过。
- 消息绑定页正确显示 WhatsApp `Not connected`；点击连接后 worker 能启动并渲染二维码，包内 worker 文件存在。用户明确当前不使用 WhatsApp，因此未扫码、未发送真人消息，真人收发记为不适用（N/A），不构成本轮验收阻塞。

### 遗留项（不阻塞本轮 U-API 验收）

1. **隔离配置编辑错误**：在没有可用凭据的隔离配置中，只补模型并继续时出现 `Cannot convert argument to a ByteString ... 8226`；表明掩码 Token 可能被当成真实值提交。未改真实配置，建议单独修复并补回归测试。
2. **i18n strings 旧入口**：`bun run lint:i18n:strings` 仍引用不存在的 `scripts/lint-i18n-strings.sh`。该引用在 v0.10.5 已存在，不是本次上游引入；当前 CI 使用 parity / sorted / coverage，不受影响，但治理入口需要后续收口。

## 6. 合回 main 前的决策点

- 真实 U-API 对话门槛已通过；WhatsApp 因当前不使用而记为 N/A，不再作为本轮门槛。
- 单独决定是否在合回前修复掩码 Token 编辑错误；至少不要把该项误写成通过。
- 从本轮功能验收看，独立分支已具备合回 `main` 的条件；用户 review 本报告和两项非阻塞遗留后，再决定是否 merge 与 push。
