# macOS Rebuild with SDK — 防御性 bundle（2026-05-05）

**目的**：完成"A 任务（让 Claude SDK 真进 DMG）"，把 [M2-REBUILD-HOTFIX-2026-05-05 §4](M2-REBUILD-HOTFIX-2026-05-05.md) 标识的"M2 应修"项目落实到 M1 阶段
**前 1 次重打**：[M2-REBUILD-HOTFIX-2026-05-05.md](M2-REBUILD-HOTFIX-2026-05-05.md)（无 SDK，依赖 U-API 锁定 by design）
**本次基线 commit**：`8b8a5986`

---

## 1. 命令路径（Workaround — 因 keychain `com.justiceleague.batman` 证书干扰）

正常路径 `cd apps/electron && bun run dist:mac` 调 `build-dmg.sh`，内部 hardcoded `CSC_IDENTITY_AUTO_DISCOVERY=true`，会拾取 keychain 里**唯一一个**签名身份 `com.justiceleague.batman`（从证书名看是 dev 测试用），但该证书**不能签 distribution**：

```
⨯ Command failed: codesign --sign com.justiceleague.batman ...
com.justiceleague.batman: this identity cannot be used for signing code
```

### 本次 Workaround 步骤

1. **手动 stage SDK 到 `apps/electron/node_modules/`**（绕过 build-dmg.sh）：

```bash
mkdir -p apps/electron/node_modules/@anthropic-ai
cp -r node_modules/@anthropic-ai/claude-agent-sdk \
      apps/electron/node_modules/@anthropic-ai/

mkdir -p apps/electron/node_modules/@anthropic-ai/claude-agent-sdk-binary
cp -r node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/. \
      apps/electron/node_modules/@anthropic-ai/claude-agent-sdk-binary/
chmod +x apps/electron/node_modules/@anthropic-ai/claude-agent-sdk-binary/claude
```

2. **跑 adhoc 命令**（含 `CSC_IDENTITY_AUTO_DISCOVERY=false`，跳过 batman 证书，做 ad-hoc 签名）：

```bash
bun run electron:dist:adhoc:mac
```

electron-builder 会从 `apps/electron/node_modules/@anthropic-ai/` 找到 SDK + 复制进 packaged DMG。

### 长期方案

按优先级：
1. **M2**：清理 keychain 里的 `com.justiceleague.batman` 证书（`security delete-identity -Z E12A1A27561495F4ABC082D891B3FA28E027F5C7`）后正式跑 `bun run dist:mac`
2. **M2 替代**：改 `build-dmg.sh:215` 为 `export CSC_IDENTITY_AUTO_DISCOVERY=${CSC_IDENTITY_AUTO_DISCOVERY:-true}` 让用户能 override
3. **M2 长期**：注册 Apple Developer 账号 + 正式 Developer ID Application 证书 + 启用公证

---

## 2. 产物清单（5/5 13:34，含 SDK）

| 文件 | 大小 | 较前次（无 SDK）增量 |
|---|---|---|
| `U-Agents-arm64.dmg` | 233,729,240 B（**223 MB**） | +64 MB |
| `U-Agents-arm64.zip` | 225,410,467 B（215 MB） | +62 MB |
| `U-Agents-x64.dmg` | 241,139,307 B（**230 MB**） | +65 MB |
| `U-Agents-x64.zip` | 232,817,369 B（222 MB） | +63 MB |
| `latest-mac.yml` | 776 B | - |

新 releaseDate：`2026-05-05T05:35:05.563Z`

新 sha512：

```
arm64.dmg: lyXwqjhhkDp8+w3E4M82Z4R66Z/xEOTR3mpoQ3DX1qwbEjW7ylJL1gc6r0i0W0onDOZ2dSPUUBXFjl905XsvYw==
x64.dmg:   C37czPvb4eZ7Xma7U1ha1XfF0WIZkjHb6TjgmYamcZ/3AZzVsNl6OGgu6A4N0h3Q3zMEw6giLNSrYAfRBNoWCA==
arm64.zip: ZPd1gVVBheYouNamPlsfsmfPxw1NjVFe5y0Fkn5ykqYp4tk+UdivL8Ubas1cbVTqT9Wvlby78qfB14+rPhalkQ==
x64.zip:   9RKxS8EnqT6yLxHO6i3SOVwjT0w00mzmoQp8ynRuI9QH4l5Zeb978Cq0FvB9I4A8+E7Zs3eYkVmvgU5qjAyShw==
```

---

## 3. SDK 验收（关键差异）

| 文件 | 大小 | 状态 |
|---|---|---|
| `Contents/Resources/app/node_modules/@anthropic-ai/claude-agent-sdk-binary/claude` | **205 MB** | ✅ **首次进 DMG** |
| `Contents/Resources/app/node_modules/@anthropic-ai/claude-agent-sdk` | 4.7 MB | ✅ |

### runtime-resolver 行为对照

| 场景 | 旧版（无 SDK）| 新版（含 SDK）|
|---|---|---|
| U-API 用户对话（pi-agent.ts 路径） | ✅ 正常（不调 SDK）| ✅ 正常 |
| 假设上游同步引入 Claude 直连 fallback | ❌ runtime-resolver 找不到 binary → strict throw "SDK native binary not found" | ✅ 找到 binary → 正常调用 |
| 假设用户改 config.json 突破 U-API 锁定 | enforceUApiBaseUrl 会强制重置（同上 throw 已被消除）| 同左 + 即使重置失败也有 SDK 兜底 |

**含义**：DMG 现在防御性 bundle SDK，**消除了 [M2-REBUILD-HOTFIX-2026-05-05.md §4](M2-REBUILD-HOTFIX-2026-05-05.md) 标识的潜在风险**。

---

## 4. 其他依赖核对

| 项 | 状态 |
|---|---|
| pi-agent-server (20M) + koffi (3.8M) | ✅ |
| vendor/bun/bun (57M) | ✅ |
| LICENSE + NOTICE + Assets.car | ✅ |
| hotfix 内容（system.ts:470）| ✅ Notion 1 命中 / Craft 0 命中 |

---

## 5. R2 上传清单（待 user 执行）

需上传以下 9 个文件，**覆盖** R2 上的 hotfix-without-SDK 版本：

```
apps/electron/release/U-Agents-arm64.dmg            (233,729,240 bytes)
apps/electron/release/U-Agents-arm64.dmg.blockmap
apps/electron/release/U-Agents-arm64.zip            (225,410,467 bytes)
apps/electron/release/U-Agents-arm64.zip.blockmap
apps/electron/release/U-Agents-x64.dmg              (241,139,307 bytes)
apps/electron/release/U-Agents-x64.dmg.blockmap
apps/electron/release/U-Agents-x64.zip              (232,817,369 bytes)
apps/electron/release/U-Agents-x64.zip.blockmap
apps/electron/release/latest-mac.yml
```

上传后**必须刷 CDN 缓存**（参见 [M2-REBUILD-HOTFIX-2026-05-05.md §5](M2-REBUILD-HOTFIX-2026-05-05.md) 教训）：

```
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg.blockmap
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.dmg
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.dmg.blockmap
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.zip
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.zip.blockmap
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.zip
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.zip.blockmap
https://update.u-agents.u-studio.cn/latest/latest-mac.yml
```

验证：

```bash
size=$(curl -sSI https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg | grep -i content-length | tr -d '\r' | awk '{print $2}')
echo "R2 arm64.dmg size: $size  (期望 233729240)"
```

---

## 6. Windows 端

Windows 端**已经在 R2 上是含 SDK 的 dist:win 版本**（232 MB EXE，5/5 04:56 上传）。**不需要重打**。

---

## 7. 完成判定

- [x] 手动 stage SDK 成功（206 MB binary + 4.7 MB 核心）
- [x] adhoc:mac 跑通 + ad-hoc 签名（避开 batman 证书）
- [x] DMG 内 SDK 验收通过
- [x] hotfix 内容仍在
- [x] sha512 + size 已记录
- [ ] **R2 上传 9 文件 + 刷 CDN**（user 操作）
- [ ] **更新 [M1-SEED-DISTRIBUTION.md](../M1-SEED-DISTRIBUTION.md) §1.1**（待 R2 上线后，size 改为 223/230 MB + 新 sha512）

---

## 8. 教训记录（M2 范围）

1. **build-dmg.sh:215 强制 `CSC_IDENTITY_AUTO_DISCOVERY=true`** —— 不能被外部 env 覆盖。M2 应改为 `${VAR:-true}` 模式
2. **keychain `com.justiceleague.batman` 证书** —— 是无效签名身份但被 auto-discovery 拾取。M2 应清理或文档化"打包前先检查 keychain"
3. **build-dmg.sh 单整体脚本** —— 不能只跑前半段（SDK staging）跳过 codesign。M2 应拆分 SDK staging 为独立子脚本
