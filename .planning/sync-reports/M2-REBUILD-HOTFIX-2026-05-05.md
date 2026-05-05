# macOS Rebuild — v0.9.0+u-agents.1 hotfix（2026-05-05）

**目的**：把 5 轮 review + hotfix 内容打进 packaged DMG，替换 R2 上的 v0.9.0 首发版
**基线 commit**：`161e0938`（含全部 6 轮 review + 4 个 hotfix commit）
**构建命令**：`bun run electron:dist:adhoc:mac`（M1 #27 任务定义）

---

## 1. 产物清单（5/5 12:28 时间戳）

| 文件 | 大小 | sha512 (新)|
|---|---|---|
| `U-Agents-arm64.dmg` | 162 MB | `97Ke3Eqw6cDS...zEx2ErA==` |
| `U-Agents-arm64.zip` | 156 MB | `CYf3+2khZdBe...VR9drtA==` |
| `U-Agents-x64.dmg` | 168 MB | `t9BteaIiAeOT...y10u2nXwPT7Q==` |
| `U-Agents-x64.zip` | 162 MB | `q/vPVBvaTvTs...8RVq9cljqCQ==` |
| `latest-mac.yml` | 776 B | （含 4 文件 sha512 + size + releaseDate）|

**新 releaseDate**：`2026-05-05T04:28:58.607Z`（首发版是 `2026-05-04T14:18:35.997Z`，可区分）

**首发版 vs 当前**：

| 项 | 首发（5/4 22:18）| 当前（5/5 12:28）| 差异 |
|---|---|---|---|
| arm64.dmg 大小 | 169,603,885 B | 169,600,030 B | -3,855 B（hotfix 改注释 + 加测试代码）|
| x64.dmg 大小 | 175,795,456 B | 175,796,110 B | +654 B |
| sha512 | `O4nSEF...` | `97Ke3E...` | 完全不同（证明是新打）|

---

## 2. 内部依赖核对（DMG 内 `Contents/Resources/app/`）

| 文件 | 大小 | 状态 |
|---|---|---|
| `resources/pi-agent-server/index.js` | 20 MB | ✅ |
| `resources/pi-agent-server/node_modules/koffi/build/koffi/darwin_arm64/koffi.node` | 3.8 MB | ✅ |
| `vendor/bun/bun` | 57 MB | ✅ arm64 Mach-O |
| `resources/session-mcp-server/` | 1 个文件 | ✅ |
| `Contents/Resources/Assets.car` | 192 KB | ✅ Liquid Glass |
| `Contents/Resources/LICENSE` | 12 KB | ✅ Apache §4(c) 闭环 |
| `Contents/Resources/NOTICE` | 4 KB | ✅（含 derivative 段）|

---

## 3. hotfix 内容已进 DMG（核心验收）

```bash
APP="apps/electron/release/mac-arm64/U Agents.app/Contents/Resources/app"
grep -c "integrate Linear, GitHub, Notion" "$APP/dist/main.cjs"  # 1 ✅（system.ts:470 hotfix）
grep -c "integrate Linear, GitHub, Craft"  "$APP/dist/main.cjs"  # 0 ✅
```

**确认**：v0.9.0+u-agents.1 hotfix 的代码改动（system.ts / errors.ts / diagnostics.ts / 测试文件）已 bundle 进 main.cjs。

---

## 4. ⚠️ 已知缺失：Claude SDK native binary（~~**by design**~~ ✅ **已在含 SDK 重打中解决**）

> 本节为 5/5 早期 hotfix 快照。后续含 SDK 重打详见 [`M2-REBUILD-WITH-SDK-2026-05-05.md`](M2-REBUILD-WITH-SDK-2026-05-05.md)。


### 现状

build log 中 3 条 warning：

```
file source doesn't exist  from=node_modules/@anthropic-ai/claude-agent-sdk
file source doesn't exist  from=node_modules/@anthropic-ai/claude-agent-sdk-binary
file source doesn't exist  from=node_modules/@vscode/ripgrep
```

DMG 内 `find -name "claude" -type f` 0 命中（除 SVG 图标）。

### 根因

`bun run electron:dist:adhoc:mac` **跳过了 `apps/electron/scripts/build-dmg.sh`**。后者负责 3 个关键步骤：

1. `cp -r root/node_modules/@anthropic-ai/claude-agent-sdk → apps/electron/node_modules/@anthropic-ai/`
2. `cp -r claude-agent-sdk-darwin-arm64 → claude-agent-sdk-binary/`（创建 stable alias）
3. `chmod +x ALIAS_DEST/claude`

`runtime-resolver.ts:122` 在运行时按 `node_modules/@anthropic-ai/claude-agent-sdk-binary/claude` 找 SDK。

### 为什么不影响 M1 用户

| 层 | 是否依赖 Claude SDK |
|---|---|
| `claude-agent.ts`（Anthropic 直连）| ✅ 依赖 |
| `pi-agent.ts`（U-API / pi_compat）| ❌ **不依赖** |
| `claude-llm-query.ts`（Claude SDK query）| ✅ 依赖 |

M1 已锁定到 U-API（providerType: pi_compat） → 用户对话**永远走 pi-agent.ts** → 不调用 Claude SDK 的 native binary → SDK 缺失对用户透明。

**首发版也是这样打的**（差异 3855 bytes 远小于 SDK 的 ~210MB），用户自测能用证明 by design 成立。

### 风险评估

| 触发条件 | 概率 | 影响 |
|---|---|---|
| 上游同步引入 Claude 直连 fallback 路径 | 低 | 触发即 crash（"Claude Agent SDK native binary not found"）|
| 测试/调试代码意外调用 Claude SDK query | 极低 | 同上 |
| 用户改 config.json 突破 U-API 锁定 | 极低 | enforceUApiBaseUrl 会强制重置 |

### 处理建议

- **M1 不修**：与首发版一致，单连接 U-API 用户 0 影响
- **M2 修**：改用 `cd apps/electron && bun run dist:mac` 调 `build-dmg.sh`（含 SDK 复制），让 SDK binary 进 DMG。这样万一上游同步引入 Claude 路径也不会 crash
- **替代方案**：在 `electron:dist:adhoc:mac` 命令链前加一步运行 `build-dmg.sh` 的 SDK 复制段

记入 [`M1-FIRST-RELEASE.md`](M1-FIRST-RELEASE.md) "已知技术债"段。

---

## 5. R2 上传清单

新产物需上传以下 5 个文件到 `u-agents-update` bucket / `latest/` 路径，**覆盖**旧版：

```
U-Agents-arm64.dmg
U-Agents-arm64.dmg.blockmap
U-Agents-arm64.zip
U-Agents-arm64.zip.blockmap
U-Agents-x64.dmg
U-Agents-x64.dmg.blockmap
U-Agents-x64.zip
U-Agents-x64.zip.blockmap
latest-mac.yml
```

（共 9 个文件）

上传后验证：

```bash
curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml | grep releaseDate
# 期望：releaseDate: '2026-05-05T04:28:58.607Z'
```

---

## 6. Windows 重打（待 user 在 Windows 机器跑）

macOS 上无法打 Windows，需要在 Windows 机器跑：

```cmd
bun run electron:dist:adhoc:win
```

或如果 adhoc:win 命令未定义：

```cmd
cd apps/electron
bun run dist:win
```

产物：`U-Agents-x64.exe` + `latest.yml`

上传 R2 后同样验证 `https://update.u-agents.u-studio.cn/latest/latest.yml` 的 sha512 是否换新。

---

## 7. 完成判定

- [x] macOS arm64 + x64 DMG/zip 重打成功（commit `161e0938` 基线）
- [x] hotfix 内容（system.ts:470 等）已进 main.cjs
- [x] LICENSE + NOTICE + Assets.car + bun + pi-agent-server 全部就位
- [ ] **R2 上传 macOS 9 个文件**（user 操作）
- [ ] **Windows 端重打 EXE + latest.yml**（user 在 Windows 机器）
- [ ] **R2 上传 Windows 文件**（user 操作）
- [ ] **更新 [M1-SEED-DISTRIBUTION.md](../M1-SEED-DISTRIBUTION.md) §1.1 sha512**（待 R2 上线后）
- [ ] **种子用户测试**（M1 后续）
