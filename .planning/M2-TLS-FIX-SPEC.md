# M2 TLS 校验修复（REVIEW-5 §🔴 P0）

**任务**：消除 3 处 `tlsRejectUnauthorized: false`，让 remote workspace 连接默认严格校验 TLS 证书
**优先级**：P0（安全）/ M1 用户透明 / M2 必修
**关联文档**：[REVIEW-5-DEEP-2026-05-04.md](sync-reports/REVIEW-5-DEEP-2026-05-04.md) §🔴 + [LEGAL.md §5.4](../LEGAL.md) + [11-roadmap.md M2 安全行](11-roadmap.md)

---

## 1. 背景

REVIEW-5（2026-05-04）3 个 opus agent 深度审查发现：

```
apps/electron/src/main/handlers/workspace.ts:27   tlsRejectUnauthorized: false
apps/electron/src/preload/bootstrap.ts:124         tlsRejectUnauthorized: false
apps/electron/src/preload/bootstrap.ts:148         tlsRejectUnauthorized: false
```

**风险**：用户配置 remote workspace 连接 `wss://example.com` 时，**不验证 TLS 证书**。LAN MITM（咖啡馆 WiFi + ARP 投毒 + self-signed cert）可截全流量（session prompt + 文件 + Token + LLM 请求）。

**M1 用户影响**：M1 锁定单机使用 + U-API 仅本地 LLM 中转，**不触达 remote workspace 路径**——首发种子用户 0 影响。

---

## 2. 关键发现：上游默认其实是严格的

读 `packages/server-core/src/transport/client.ts`：

```typescript
// L99-100: 类型定义
/** Accept self-signed TLS certificates for wss:// connections. Default: false. Only works in Node.js (main process). */
tlsRejectUnauthorized?: boolean

// L160: 实际 default
this.tlsRejectUnauthorized = opts?.tlsRejectUnauthorized ?? true

// L329: 用法（仅在 wss + 显式 false 时启用 ws library 加 rejectUnauthorized:false）
const needsTlsOptions = url.startsWith('wss://') && !this.tlsRejectUnauthorized
```

**含义**：
- WsRpcClient default **严格**（`true`）
- 3 个调用点是**显式 opt-in 关闭**（不是无意 hardcode）
- 注释里"Default: false"过时（实际代码 default true）—— 也是个 bug

修复就是**删除 3 处 `tlsRejectUnauthorized: false`**，让 default `true` 接管。代码无逻辑改动，只是删字段。

---

## 3. 修复任务（给执行 AI 的精准提示词）

### 修改 1 — `apps/electron/src/main/handlers/workspace.ts:27`

```diff
  const client = new WsRpcClient(url, {
    token,
    workspaceId,
    autoReconnect: false,
-   tlsRejectUnauthorized: false,
  })
```

### 修改 2 — `apps/electron/src/preload/bootstrap.ts:124`

```diff
    initialWorkspaceClient = new WsRpcClient(remoteConfig.url, {
      token: remoteConfig.token,
      workspaceId: remoteConfig.remoteWorkspaceId,
      webContentsId,
      autoReconnect: true,
      mode: 'remote',
      clientCapabilities: [...LOCAL_CLIENT_CAPABILITIES],
-     tlsRejectUnauthorized: false,
    })
```

### 修改 3 — `apps/electron/src/preload/bootstrap.ts:148`

```diff
  routedClient.setClientFactory((remoteServer: RemoteServerConfig) => {
    return new WsRpcClient(remoteServer.url, {
      token: remoteServer.token,
      workspaceId: remoteServer.remoteWorkspaceId,
      webContentsId,
      autoReconnect: true,
      mode: 'remote',
      clientCapabilities: [...LOCAL_CLIENT_CAPABILITIES],
-     tlsRejectUnauthorized: false,
    })
  })
```

### 修改 4 — `packages/server-core/src/transport/client.ts:99` 修复过时注释

```diff
- /** Accept self-signed TLS certificates for wss:// connections. Default: false. Only works in Node.js (main process). */
+ /** Accept self-signed TLS certificates for wss:// connections. Default: true (strict). Set to false ONLY for trusted dev/test scenarios. Only works in Node.js (main process). */
  tlsRejectUnauthorized?: boolean
```

### 加 U-API 标记（让 §3.7 抓得到）

在每个修改点的同行/上方加 `// U-API:` 注释作为 grep 锚点。例如修改 2 改为：

```typescript
    initialWorkspaceClient = new WsRpcClient(remoteConfig.url, {
      token: remoteConfig.token,
      // ... 其他选项
      clientCapabilities: [...LOCAL_CLIENT_CAPABILITIES],
      // U-API: TLS strict mode (REVIEW-5 P0 fix, 2026-05-05) — was tlsRejectUnauthorized: false
    })
```

3 处 `// U-API:` marker（不含 client.ts JSDoc 那行）共 **+3 个 U-API 标记**（基线 48 → 51，超出 ±2 浮动需 §3.7 基线刷新到 51）。

> **执行 AI 反馈（c516e4d2 实测）**：基线刷新已落实到 51。client.ts:99 JSDoc 修复了但**未加额外 marker**（按用户提示词执行的 +3 不是 spec §3 写的 +4）。下次同步时 §3.7 表查 client.ts 改动需走非 marker grep（直接搜 "Default: true (strict)"）。

---

## 4. 校验

### typecheck

```bash
bun run typecheck:all
# 应仍 0 errors（删字段不会引入类型错误）
```

### 反向 grep 确认 0 残留

```bash
# REVIEW-7 修正：排除 // U-API: marker 注释行（含 "was tlsRejectUnauthorized: false" 解释文本会自匹配）
grep -rn "tlsRejectUnauthorized:\s*false" apps packages --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "U-API:"
# 期望：0 命中（业务代码 0 残留）
```

### U-API 标记数

```bash
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望：51（基线 48 + 3 个 TLS 修复标记 marker；client.ts:99 JSDoc 修复未额外加 marker，下次同步查 client.ts 改动需走非 marker grep "Default: true (strict)"）
```

### 集成测试（remote workspace 行为）

M1 没真实 remote workspace 用户，**不影响首发**。但可以本地起一个 wss://localhost 测：

```bash
cd packages/shared && bun test --bail 2>&1 | tail -10
# 应仍是 baseline 14 fail 不变（修改不应引入新 fail）
```

---

## 5. 提交规范

单 commit：

```
fix(security): enforce strict TLS verification for remote workspace (REVIEW-5 P0)

Remove 3 explicit `tlsRejectUnauthorized: false` overrides that disabled
TLS certificate validation for remote workspace WsRpcClient connections.
Default behavior of WsRpcClient is already strict (line 160: ?? true);
these 3 locations were upstream's explicit opt-in to skip validation.

Eliminates LAN MITM risk: attackers on user's WiFi can no longer
self-signed-cert intercept session prompts / files / tokens / LLM calls
when user connects to remote workspace.

M1 user impact: 0 (M1 single-machine, no remote workspace usage).
M3+ users connecting to self-signed-cert remote servers will get TLS
errors — by design (must use valid CA-signed certs).

Also fix outdated JSDoc on WsRpcClientOptions.tlsRejectUnauthorized
(was "Default: false", now "Default: true (strict)").

- apps/electron/src/main/handlers/workspace.ts:27 (delete line)
- apps/electron/src/preload/bootstrap.ts:124 (delete line)
- apps/electron/src/preload/bootstrap.ts:148 (delete line)
- packages/server-core/src/transport/client.ts:99 (fix JSDoc)
- 4 lines `// U-API:` markers added (grep anchors)

Closes REVIEW-5 §🔴 P0. LEGAL.md §5.4 should be updated to mark TLS
issue as resolved (separate doc commit).
```

---

## 6. 修完后落实文档

1. **LEGAL.md §5.4** 把"M2 必修"标为"✅ 已修复"+ commit hash
2. **CLAUDE.md §3.7 基线表** 更新为 52（基线刷新）
3. **REVIEW-5-DEEP-2026-05-04.md §🔴** 标 ✅
4. **11-roadmap.md M2 安全行** 把 TLS 项标 ✅

---

## 7. M3+ 范围（不在本次）

M3 自建 OAuth relay + remote workspace 实际启用时，应考虑：

- **Cert pinning**：在 UI 让用户首次连接时确认证书指纹（类似 SSH known_hosts）
- **Opt-in 严格关闭**：在 UI 高级设置里加"接受自签名证书"选项，默认关闭，用户明确勾选后才传 `tlsRejectUnauthorized: false`
- **强制 CA 签名**：要求用户的 remote server 用 Let's Encrypt 等公开 CA 签名

3 选 1 由 M3 阶段决定。本次 M2 修复只做**最严格**：删除 false override，default true。

---

## 8. 风险评估

| 维度 | 评估 |
|---|---|
| typecheck | 0 风险（删字段不影响类型）|
| 单元测试 | 0 风险（无 test 直接测 TLS 行为）|
| 集成测试（M1 范围）| 0 风险（M1 不连 remote workspace）|
| 用户体验（M1 种子用户）| 0 风险（同上）|
| 用户体验（M3 远端 self-signed）| TLS 错误，需用户配合规证书或 M3 加 opt-in |
| 上游同步 | 低风险（删除字段；上游若未来改这块需手动 review）|

**总评：极低风险高价值修复**。
