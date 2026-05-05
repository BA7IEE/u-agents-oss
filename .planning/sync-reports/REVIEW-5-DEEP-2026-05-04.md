# 全仓 Review v5 — 多角度深度审查（2026-05-04）

**Review 焦点**：前 4 轮没覆盖的角度——代码 vs 规格语义对齐 + 运行时安全 + 测试覆盖
**审查方法**：3 个 Opus 4.x 子 agent 并行扫描
**总评级**：**B+（发现 1 个上游 P0 + 3 个 M1 改造 P1 遗漏）**

---

## ✅ P0 — TLS 校验完全关闭（**2026-05-05 已修复 commit `c516e4d2`**）

**修复**：删 3 处显式 `tlsRejectUnauthorized: false`，让默认严格 TLS 接管。详见 [`M2-TLS-FIX-SPEC.md`](../M2-TLS-FIX-SPEC.md) + [LEGAL.md §5.4](../../LEGAL.md)。

---

### 历史记录（修复前的发现）

### 现状

3 个文件硬编码 `tlsRejectUnauthorized: false`：

```typescript
// apps/electron/src/main/handlers/workspace.ts:27
new WsRpcClient(url, { tlsRejectUnauthorized: false, ... })

// apps/electron/src/preload/bootstrap.ts:124, 148
new WsRpcClient(remoteConfig.url, { tlsRejectUnauthorized: false, ... })
```

### 影响

- **场景**：用户配置 remote workspace 连接到远端 server（`wss://example.com`）
- **攻击**：攻击者在用户 LAN（咖啡馆 WiFi）做 ARP/DNS 投毒 + self-signed 证书 → 全流量明文（session prompt + 文件 + Token + LLM 请求）
- **复现简单度**：mitmproxy 能拦

### 严重度判断

| 维度 | 评估 |
|---|---|
| 是否阻塞首发 | **否** — M1 种子分发都是**单机使用**，不连 remote workspace |
| 上游引入 | ✅ 是上游 craft-agents-oss 既有设计（不是 M1 改造引入） |
| 修复优先级 | **M2 必修**（M3 自建 OAuth relay 之前必须解决） |

### 处理建议

**不在本 hotfix 修**——这是上游既有架构选择，可能上游有自己的 fallback 流程。改前需要：
1. 阅读 wsrpc 协议 + remote workspace 全流程
2. 评估 self-signed cert 是 fallback 还是主路径
3. 考虑加 EV cert pinning 或要求用户手动信任

**立即行动**：在 LEGAL.md §5（已知白标瑕疵）补一行记录，避免遗忘。

---

## 🟡 P1 — M1 改造遗漏的 3 处真 craft 字面量

### #1 system.ts:470 — system prompt 注入到 LLM 上下文

```typescript
// packages/shared/src/prompts/system.ts:470
- **Connect external sources** - MCP servers, REST APIs, local filesystems. 
  Users can integrate Linear, GitHub, Craft, custom APIs, and more.
                                          ^^^^^
```

**风险**：每次对话开始时这段 prompt 注入 LLM 上下文。AI 在自我介绍时**可能复述**："我可以连接 Linear、GitHub、Craft、自定义 API..."—— Craft 字样直接出现在用户 chat 界面。

**修复**：删除 "Craft, " 或改为 "Notion"。

### #2 errors.ts:168 — 错误信息含 "Craft MCP server"

```typescript
// packages/shared/src/agent/errors.ts:168
mcp_unreachable: {
  message: 'Cannot connect to the Craft MCP server. Check your network connection.'
}
```

**当前状态**：dead code（mcp_unreachable error 仅由 dead `checkMcpConnectivity` 触发，无 caller）—— 不会真触达用户。

**风险**：上游同步时如果有人启用 `checkMcpConnectivity`，错误对话框立刻泄漏品牌。

### #3 diagnostics.ts:365, 376 — 同字面量 ×2

`packages/shared/src/agent/diagnostics.ts` 同 dead path，2 处 "Cannot connect to the Craft MCP server"。

### 严重度

| 项 | 严重度 | 阻塞首发？ |
|---|---|---|
| #1 system.ts:470 | **P1**（用户可见路径）| 否，但下个 hotfix 应修 |
| #2-3 errors/diagnostics | **P2**（dead code）| 否，但应一并清 |

### 处理建议

**下个 hotfix（v0.9.0+u-agents.1）一起修**——3 处都是字面量替换，改完跑 typecheck 即可。

---

## 🟡 P1 — REVIEW-4 P0 修复无回归测试

### 现状

REVIEW-4 修了 `state.ts:306` 的多连接 keyless 特判 bug（commit `ede09028`）。但：

```bash
grep -n "isUApiSlug\|hasCredentials" packages/shared/src/auth/__tests__/state.test.ts
# 0 命中 — 该测试文件没有覆盖修复点
```

### 风险

- 下次同步上游时，如果有人重构 state.ts 把 `isUApiSlug(...)` 改回 `=== U_API_SLUG`，**没有测试拦截**
- 多连接场景的"添加无 Token connection 设为 default"路径完全没有 case 验证

### 处理建议

**P1**：在 `packages/shared/src/auth/__tests__/state.test.ts` 加 describe block：

```typescript
describe('hasCredentials keyless special case (multi-connection)', () => {
  it('returns false when default connection is u-api-default with no apiKey', ...)
  it('returns false when default connection is u-api-2 with no apiKey', ...)
  it('returns true when default connection is anthropic-api with no apiKey', ...)
})
```

---

## 🟡 P1 — isUApiSlug helper 无单元测试

`packages/shared/src/config/u-api-defaults.ts:12` 的 `isUApiSlug` 是关键 helper，5 个不同代码路径依赖它（`state.ts` / `provider-metadata.ts` / `AiSettingsPage.tsx` 4 处）。

**正则边界 case 全无验证**：
- `'u-api'` → true
- `'u-api-default'` → true
- `'u-api-1'` `'u-api-99'` → true
- `'u-apix'` → false（边界！）
- `'u-api-1a'` → false
- `null` / `undefined` / `''` → false

**处理建议**：建 `packages/shared/src/config/__tests__/u-api-defaults.test.ts`，覆盖 8 个边界。

---

## ✅ 5 大核心机制 vs 规格 — 全部一致（A 级）

| 机制 | 规格 | 代码实际 | 一致性 |
|---|---|---|---|
| baseUrl 锁定 | 02 §4.3 + §6.2.1 | `enforceUApiBaseUrl` 持续启动锁，覆盖所有 `isUApiSlug` connection，UI 不暴露 baseUrl | ✅ 完全一致 |
| 多连接软锁定 | 02 §6.2 | last-connection 保护、Add 按钮、Default 选择器、slug 递增、模板 — 全部正确 | ✅ |
| 凭证安全 | LEGAL §2 | AES-256-GCM + 硬件 UUID + PBKDF2(100k)；config.json 不存明文 token | ✅ |
| 品牌词裁剪 vs 用户可见 | 01 §2.x | 大多数路径已清，仅 system.ts:470 + errors/diagnostics 残留（见 P1）| ⚠️ 3 处遗漏 |
| Apache §4(c) 闭环 | LEGAL §2 | DMG/EXE/AppImage 三平台 extraResources 含 LICENSE+NOTICE，About 含 U Studio 版权 | ✅ |

---

## ✅ monorepo 健康度（A- 级）

| 项 | 状态 |
|---|---|
| 14 子包 version 全 0.9.0 | ✅ |
| `@u-agents/*` workspace deps 全部 resolve 成功 | ✅ |
| bun.lock 同步无 drift | ✅ |
| 0 处 `@craft-agent/*` 残留 | ✅ |
| 死包 / 死代码 | apps/cli + apps/viewer + apps/webui 暂未使用，M2/M3 启用，**未进 DMG** ✅ |

**P3**：`apps/cli/package.json:9` bin 名 `craft-cli` 需改为 `u-agents-cli`（M2 处理，不阻塞）。

---

## ✅ 上游基线测试 14 fail 状态

**当前**：2656 pass / 14 fail（与 M1-FIRST-RELEASE.md 一字不差）。**0 处 M1/M2 引入新 fail**。

| Fail 类别 | 数量 | 备注 |
|---|---|---|
| Bedrock auth env | 1 | 上游 |
| classifyExternalUrl scheme | 1 | 上游 |
| safe-mode classification | 1 | 上游 |
| send_developer_feedback permission | 1 | 上游 |
| channel routing exhaustiveness | 2 | 上游 |
| **i18n locale parity 排序** | **7** | 上游既有，M2 中文化扫描时可顺手修 |

`apps/electron` 测试有 **35 fail**（去重后 ~10 个）— 全是上游 RPC transport 既有问题。**M1-FIRST-RELEASE.md 没把这部分算进基线**，建议补进"已知技术债"。

---

## 总评

| 维度 | 评级 | 备注 |
|---|---|---|
| 代码 vs 规格语义对齐 | **B**（修 P1 后 A）| 5 大机制 ✅，3 处 craft 残留 |
| 运行时安全 | **C+**（修 P0 TLS 后 B+）| 上游 TLS 设计是主因 |
| 测试覆盖（U-API 改造点）| **C** | 30 项中仅 ~3-4 项有专门测试 |
| monorepo 健康度 | **A-** | 0 引入回归 |
| Apache 合规闭环 | **A** | DMG 内 LICENSE+NOTICE ×3 平台 |

**总评：B+（发现需要后续阶段修复，但首发不阻塞）**

---

## 修复路径建议

### 🟢 立即落实（≤ 30 分钟，本仓库 AI 可代写）

1. ✅ LEGAL.md §5 加一条 TLS rejectUnauthorized 已知瑕疵记录
2. ✅ M1-FIRST-RELEASE.md "已知技术债"加 apps/electron 35 fail（10 unique）
3. ✅ 11-roadmap.md M2 任务表加"修 TLS 校验"

### 🟡 下个 hotfix（v0.9.0+u-agents.1，外部 AI 执行，约 1 小时）

4. 改 `system.ts:470` 删除 "Craft, " 字面量（P1 用户可见）
5. 改 `errors.ts:168` + `diagnostics.ts:365, 376` "Craft MCP" → "MCP"（P2 dead code 防御性清）
6. 补 `state.test.ts` 多连接 keyless 回归测试（P1）
7. 补 `u-api-defaults.test.ts` isUApiSlug 边界测试（P1）

### 🔵 M2 范围（已规划）

8. ✅ **TLS rejectUnauthorized 修复 + remote workspace 安全审计**（commit `c516e4d2`，2026-05-05）
9. ✅ **atomicWriteFileSync 用户数据持久化（11 处）**（commit `25d38ab9`，2026-05-05；spec [`M2-ATOMIC-WRITES-SPEC.md`](../M2-ATOMIC-WRITES-SPEC.md)）
10. ✅ **~/.u-agents/ 目录权限 0o700 + LLM API key 长度限制 (1-4096)**（commit `2972d8f4`，2026-05-05；spec [`M2-SECURITY-CLEANUP-SPEC.md`](../M2-SECURITY-CLEANUP-SPEC.md)）
11. ✅ **apps/cli rename craft-cli → u-agents-cli**（commit `1a49d128`，2026-05-05；spec [`M2-CLI-RENAME-SPEC.md`](../M2-CLI-RENAME-SPEC.md)；4 处真改 + 6 处 e2e fixture 保留）
12. ⏸ apps/electron 35 fail 测试修复评估

**M2 安全主线 4/4 = 100% 完成**（M3 范围除外：secure-storage 解密失败 backup-then-rebuild）

### 🔵 M3 范围（已规划）

13. server:invokeOnServer IPC 加 channel + url 白名单
14. secure-storage.ts 解密失败改为 backup-then-rebuild（不直接 unlinkSync）
15. OAuth relay 自建（消 agents.craft.do）
