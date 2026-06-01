# M3 — Remote Browser Pane Lockdown 规格（D1 + D5）

> **状态**：待执行（**v0.10.0 merge 落地后**执行——`allowRemoteEvaluate` / `dispatchCapability` 等是 v0.10.0 引入的代码）。
> **来源**：[`sync-reports/UPSTREAM-PREVIEW-v0.10.0-2026-05-29.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.0-2026-05-29.md) §3.3/§3.4/§3.5 REVIEW-1 安全核查。
> **关联**：[`CLAUDE.md`](../CLAUDE.md) §3.7（marker 登记）+ [`04-feature-cuts.md`](04-feature-cuts.md) §九类（browser tool 裁剪，#46）。
> **本仓库 AI 只产出本规格**；代码改造由用户/外部 AI 在 v0.10.0 sync 时（或紧随其后的 commit）执行。

---

## 0. 背景与威胁模型

v0.10.0 引入 **remote browser pane**：连接到远程 agent server 的用户，其本地 Electron 浏览器可被**远程 server 上的 agent** 通过 transport capability `CLIENT_BROWSER_INVOKE` 端到端驱动。

**REVIEW-1 已坐实的两个事实**：

1. **D2 = remote workspace 可达**（[PREVIEW §3.5](sync-reports/UPSTREAM-PREVIEW-v0.10.0-2026-05-29.md)）：添加 workspace 主界面有 "Connect Remote" 卡片、server URL 用户自由输入、fork 有意 brand 保留、`04-feature-cuts.md` 0 裁剪。
2. **#46（`browserToolEnabled` 默认 false）拦不住远程驱动**：`browser-pane-manager.ts` 的 `__browser:invoke` dispatcher **无 `browserToolEnabled` 总闸**（实测全文件 grep `getBrowserToolEnabled` 零命中），唯一本地闸是 `getAllowRemoteEvaluate()`，且**只 gate `evaluate`**。`#46` 只 gate 本地进程内的工具广告，而 remote 场景下 agent 在**远程 server**，其工具广告由远程配置决定。

**结论**：默认配置下，恶意/被攻破的远程 server 可驱动用户本地浏览器执行 `navigate`（任意 URL）/ `screenshot`（截屏）/ `getClipboard`（读剪贴板）/ `getNetworkLogs` / `clickAtCoordinates` / `typeText` 等，**仅 `evaluate` 被 `allowRemoteEvaluate`(默认 true) 拦，其余裸奔**。

**已有缓解**（不消除）：① 用户须主动填 url+token 才连；② fork #31b TLS strict 防 MITM；③ dispatcher 有 owner-key 授权防跨 session 劫持；④ `uploadFile` 已被上游禁。

---

## 1. 改造总览

| 改造 | 目标 | 默认效果 | 文件 |
|---|---|---|---|
| **D1** | `allowRemoteEvaluate` 默认 `false` | 即使用户手动开了 browser tool，远程 `evaluate`(任意 JS) 仍默认禁 | `config-defaults.json` + `storage.ts` + 测试 |
| **D5-b** | dispatcher 入口加 `browserToolEnabled` 总闸 | browser tool 关（默认）→ **所有**远程 browser 调用被拒；开 → 放行（再受 D1 约束 `evaluate`）| `browser-pane-manager.ts` + 测试 |

**两者叠加的纵深防御**：
- 默认（`browserToolEnabled=false`）→ **D5-b 在 dispatcher 入口拒绝一切远程 browser 调用**（最强闸）。
- 用户知情后手动开 `browserToolEnabled=true` → D5-b 放行，但 **D1 仍默认禁 `evaluate`**（第二层）。
- 两者独立有意义；**推荐 D1 + D5-b 同时落地**。

> **为何推荐 D5-b 而非 D5-a（移除 `CLIENT_BROWSER_INVOKE` 广告）**：D5-b 与 #46 联动（开关一处控制本地 + 远程），且复用现有 `CAPABILITY_UNAVAILABLE` error code + `pi-agent.ts` 已有的友好文案（远程 agent 收到可读提示），改动最小、保留灵活性。D5-a 作为备选记录于 §3.5。

---

## 2. D1 — `allowRemoteEvaluate` 默认 `false`

> 模板：完全对齐 #46（`browserToolEnabled` 默认 false）的现有做法。

### 2.1 `apps/electron/resources/config-defaults.json`

v0.10.0 merge 后此处为 `"allowRemoteEvaluate": true`（在 `features` 块，紧跟 `browserToolEnabled`）。改为 `false`：

```json
"features": {
  ...
  "browserToolEnabled": false,
  "allowRemoteEvaluate": false
}
```

> 注：config-defaults.json 不接受注释（纯 JSON），marker 加在 §2.2 的 storage.ts。

### 2.2 `packages/shared/src/config/storage.ts`

`FALLBACK_CONFIG_DEFAULTS`（v0.10.0 merge 后约 L124，定位：`grep -n "allowRemoteEvaluate: true" storage.ts`）改值 + 加 marker：

```ts
    browserToolEnabled: false,
    // U-API: 远程 evaluate 默认关闭（M3 remote browser lockdown；详见 .planning/M3-REMOTE-BROWSER-LOCKDOWN-SPEC.md §2.2）
    allowRemoteEvaluate: false,
```

> `getAllowRemoteEvaluate()` getter（v0.10.0 L491）逻辑无需改——它已是 `config 值 ?? defaults`，改 FALLBACK 默认即生效。

### 2.3 防回归测试 `packages/shared/src/__tests__/m2-security-regression.test.ts`

仿 #46t（`browserToolEnabled 默认 false` describe）追加：

```ts
// U-API: 远程 evaluate 默认关闭防回归（M3 remote browser lockdown）
describe('allowRemoteEvaluate 默认 false（防回归）', () => {
  it('config-defaults.json allowRemoteEvaluate = false', () => {
    // 路径解析对齐同文件 #46t / TLS / dir describe 现有写法
    const cfg = JSON.parse(readConfigDefaults())
    expect(cfg.defaults.allowRemoteEvaluate).toBe(false)
  })
  it('storage.ts FALLBACK allowRemoteEvaluate = false + marker', () => {
    const src = readStorageSrc()
    expect(src).toMatch(/allowRemoteEvaluate:\s*false/)
    expect(src).toMatch(/U-API:.*remote browser lockdown/)
  })
})
```

---

## 3. D5-b — dispatcher `browserToolEnabled` 总闸

### 3.1 import（`browser-pane-manager.ts` 顶部，v0.10.0 L21）

```ts
// 改前（v0.10.0，且 sync 后 scope 已 rename 成 @u-agents/）
import { DEFAULT_THEME, loadAppTheme, getAllowRemoteEvaluate } from '@u-agents/shared/config'
// 改后
import { DEFAULT_THEME, loadAppTheme, getAllowRemoteEvaluate, getBrowserToolEnabled } from '@u-agents/shared/config'
```

### 3.2 总闸（`dispatchCapability`，v0.10.0 L2494，定位：`grep -n "private async dispatchCapability" browser-pane-manager.ts`）

在 `req.v` 形状校验**之后**、`ownerKey` 计算**之前**插入：

```ts
private async dispatchCapability(req: BrowserCapabilityRequest): Promise<unknown> {
  if (!req || req.v !== 1) {
    throw new CodedError('HANDLER_ERROR',
      `Unsupported browser capability request shape (v=${(req as { v?: unknown })?.v}).`)
  }
  // U-API: remote browser pane 总闸 — browser tool 关闭时拒绝所有远程 capability 调用
  //（dispatcher 是远程→本地浏览器的唯一入口；#46 只 gate 本地工具广告，拦不住远程 server 侧 agent —— 详见 M3-REMOTE-BROWSER-LOCKDOWN-SPEC §0）
  if (!getBrowserToolEnabled()) {
    throw new CodedError('CAPABILITY_UNAVAILABLE',
      'Browser tool is disabled on this desktop client.')
  }
  const ownerKey = this.toOwnerKey(req.workspaceId, req.sessionId)
  const args = req.args ?? []
  ...
}
```

**为何放这里**：`dispatchCapability` 是 `__browser:invoke` IPC handler 的唯一实现，所有远程 browser 方法（`navigate`/`click`/`screenshot`/`evaluate`/…）都经它分发。在入口加闸 = 一处拦全部。

### 3.3 复用现成 error code + 文案（无需新增）

- `CAPABILITY_UNAVAILABLE` 已在 `packages/shared/src/protocol/types.ts:87/107` 定义。
- `pi-agent.ts mapBrowserToolErrorCode()` 已有 `case 'CAPABILITY_UNAVAILABLE'` 的友好文案（"No connected desktop client supports browser tools…"）——远程 agent 抛此 code 即收到可读提示。
- **⚠️ 该文案是 §4 brand patch 的命中点之一**（"Craft Agent desktop app" → "U Agents"），D5-b 落地时确认已 brand 化。

### 3.4 防回归测试（`m2-security-regression.test.ts`）

```ts
// U-API: remote browser dispatcher 总闸防回归（M3 remote browser lockdown）
describe('remote browser dispatcher browserToolEnabled 总闸（防回归）', () => {
  it('dispatchCapability 含 browserToolEnabled 总闸 + marker', () => {
    const src = readFileSync(bpmPath, 'utf8')
    expect(src).toMatch(/getBrowserToolEnabled\(\)/)
    expect(src).toMatch(/U-API:.*remote browser pane 总闸/)
  })
})
```

> 进阶（可选）：在 `browser-pane-manager.test.ts` 加运行时单测——`browserToolEnabled=false` 时 `dispatchCapability({v:1, method:'navigate', ...})` 抛 `CAPABILITY_UNAVAILABLE`；`=true` 时正常分发。仿 v0.10.0 上游 27 个新 browser 测试的 mock 模式。

### 3.5 备选 D5-a（记录，**不推荐**）

从 `packages/server-core/src/transport/capabilities.ts` 的 `LOCAL_CLIENT_CAPABILITIES` 数组移除 `CLIENT_BROWSER_INVOKE`。

- 优点：本地 client 握手不再广告该能力，远程探测即知不支持（`BROWSER_NO_CAPABLE_CLIENT`）。
- 缺点：**无条件**移除——browser tool 即使开启也无法远程用；将来想启用需回退。与 #46 的"开关联动"哲学不符。
- **仅当**决定"永久不支持 remote browser pane"时才选 D5-a；否则用 D5-b。

---

## 4. §3.7 marker 登记（v0.10.0 sync 时统一分配编号）

v0.10.0 sync 会一并产生以下 marker，**编号在 sync 落地时按 §3.7 表末尾顺序分配**（当前末尾 #54；下列为建议占位）：

| 建议# | 改造 | 文件 | marker | 关联 |
|---|---|---|---|---|
| #55 | brand patch（v0.10.0 sync）| `pi-agent.ts` `mapBrowserToolErrorCode` "Craft Agent desktop app"→"U Agents" | `// U-API:` 单行 | PREVIEW §4 |
| #56 | brand patch（v0.10.0 sync）| `browser-pane-manager.ts` "Craft Agent desktop app"→"U Agents" | `// U-API:` 单行 | PREVIEW §4 |
| #57 | **D1** allowRemoteEvaluate 默认 false | `storage.ts` FALLBACK | `// U-API:` 单行 | 本 spec §2.2 |
| #57t | D1 防回归测试 | `m2-security-regression.test.ts` | `// U-API:` 单行 | 本 spec §2.3 |
| #58 | **D5-b** dispatcher 总闸 | `browser-pane-manager.ts` `dispatchCapability` | `// U-API:` 单行 | 本 spec §3.2 |
| #58t | D5-b 防回归测试 | `m2-security-regression.test.ts` | `// U-API:` 单行 | 本 spec §3.4 |

> **基线影响**：当前 98。v0.10.0 sync 仅 brand patch（#55/#56）= +2 → **100**。本 spec D1+D5-b（#57/#57t/#58/#58t）再 +4 → **104**。
> 若 D1/D5 与 v0.10.0 sync **同一 commit** 落地，基线一次到 **104**；若分两 commit，则 100 → 104。**落地后须在 [`CLAUDE.md`](../CLAUDE.md) §3.7 表新增子表 + 刷新基线数字 + grep 验证**。

---

## 5. 验收清单

落地后（v0.10.0 merge + D1 + D5-b）：

```bash
# D1：默认值
grep -n "allowRemoteEvaluate" apps/electron/resources/config-defaults.json   # 期望 false
grep -n "allowRemoteEvaluate: false" packages/shared/src/config/storage.ts   # 期望命中 + 上一行有 U-API marker

# D5-b：总闸
grep -n "getBrowserToolEnabled" apps/electron/src/main/browser-pane-manager.ts  # 期望 ≥1（import + dispatcher）
grep -n "remote browser pane 总闸" apps/electron/src/main/browser-pane-manager.ts # 期望 1

# 测试
bun test packages/shared/src/__tests__/m2-security-regression.test.ts        # 新增 2 describe 全绿
bun run typecheck                                                            # 0 errors

# §3.7 基线
# 跑 CLAUDE.md §3.7 的全格式 grep，期望 104（含 v0.10.0 brand patch + 本 spec 4 marker）
```

**针对性 verify**（手动）：
1. 默认状态（browserToolEnabled=false）连一个 remote workspace → 远程 agent 调 `browser_tool open` → 应收到 `CAPABILITY_UNAVAILABLE` 友好提示（已 brand 化文案），本地浏览器不动。
2. 手动开 browserToolEnabled → 远程 `navigate`/`screenshot` 放行，但 `evaluate` 仍被拒（`BROWSER_REMOTE_EVALUATE_BLOCKED`，因 D1 默认 false）。
3. 本地 agent 场景不受影响（browser tool 开启时本地正常用）。

---

## 6. 与现有改造的关系

- **#46（browserToolEnabled 默认 false）**：D5-b 复用其 `getBrowserToolEnabled()` 作总闸——#46 的开关现在**同时**控制本地工具广告（原有）+ 远程 capability dispatcher（D5-b 新增）。语义统一：一个开关，本地远程同关同开。
- **#31b（TLS strict）**：正交，防 MITM；D1/D5 防的是"已建立的可信/不可信连接里远程方的越权"。
- **LLM 入口锁定（§3.1）**：完全正交——remote server URL ≠ LLM baseUrl；`enforceUApiBaseUrl` 不约束 remote server。本 spec 不碰 LLM 入口。

---

> 执行顺序建议：**v0.10.0 sync merge（含 #55/#56 brand patch）→ 同 commit 或紧随 commit 落地 D1+D5-b → 跑 §5 验收 → 更新 CLAUDE.md §3.7 + 基线 → PREVIEW 转 SYNC 实测报告**。
