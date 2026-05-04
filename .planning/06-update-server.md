# 06 — 自建更新服务器

> 给"用户/外部 AI"的部署手册——本仓库 AI 不执行部署命令（详见 `CLAUDE.md` §0），只产出/维护本文。
> 与 `05-build-release.md` 配套：05 写"打什么包 + 怎么上传"，本文写"服务器怎么搭"。

---

## 1. 目标

一个能被 `electron-updater` 接受的**纯静态文件服务器**，部署在 `update.u-agents.u-studio.cn`。

它做的事很简单：
1. 提供 `/latest/latest-mac.yml`（macOS 自动更新清单）
2. 提供 `/latest/latest.yml`（Windows，M2）
3. 提供 `/latest/latest-linux.yml`（Linux，M2）
4. 提供安装包文件（`.dmg` / `.exe` / `.AppImage`）和增量更新 blockmap
5. 启用 HTTPS（electron-updater 强制要求）
6. 启用合理 CORS（一般不需要，因为 electron-updater 直接 fetch，不在浏览器里）

**不需要**：
- 数据库
- 后端逻辑
- 鉴权（更新文件本身公开）
- API 网关

---

## 2. 推荐架构

| 方案 | 月成本估计 | 优点 | 缺点 |
|---|---|---|---|
| ⭐ **Cloudflare R2 + Custom Domain** | $0~5（10GB 内免费）| 全球 CDN、零运维、HTTPS 自动 | 国内访问 R2 速度一般（Cloudflare 国内不一定快）|
| 阿里云 OSS + CDN | ~¥20-50 | 国内速度快 | 需要 ICP 备案 |
| 腾讯云 COS + CDN | ~¥20-50 | 国内速度快、ICP 已备案 | 同上 |
| 自有 VPS + Nginx | $5-10 | 完全自主 | 单机带宽受限、要自己证书续期 |

**推荐**：M1 用 **Cloudflare R2 + Custom Domain**（够用），M2 看用户分布再决定要不要切到国内 OSS。

---

## 3. Cloudflare R2 部署步骤

### 3.1 创建 Bucket

1. Cloudflare 后台 → R2 → "Create bucket"
2. 名称：`u-agents-update`
3. Location: Automatic
4. **重要**：Bucket 默认私有；要在 "Settings → Public Access" 启用 "Allow Access"

### 3.2 绑定自定义域名

1. R2 → 你的 bucket → "Settings" → "Public access" → "Custom Domains"
2. 添加 `update.u-agents.u-studio.cn`
3. Cloudflare 会自动配 DNS（如果你的 u-studio.cn 也在 Cloudflare 上）；如果不是，手动在你的 DNS 服务商加 CNAME → `<bucket-id>.r2.dev`
4. 等 DNS 生效（通常 5-10 分钟）
5. 验证：`curl -I https://update.u-agents.u-studio.cn/`

### 3.3 上传第一份测试文件

```bash
# 本地装 rclone（一次性）
brew install rclone   # macOS
# 或 https://rclone.org/install/

# 配置 R2 凭证（一次性）
rclone config
# 选 New remote
# name: r2
# Storage: Amazon S3 Compatible
# provider: Cloudflare
# access_key_id / secret_access_key: 从 Cloudflare R2 → Manage R2 API Tokens 生成
# endpoint: https://<account-id>.r2.cloudflarestorage.com

# 测试
echo "hello" > test.txt
rclone copy test.txt r2:u-agents-update/
curl https://update.u-agents.u-studio.cn/test.txt    # 应返回 "hello"
rclone delete r2:u-agents-update/test.txt
```

### 3.4 目录结构约定

```
u-agents-update/                          (bucket 根)
├── latest                                (version manifest 当前指针；注意是对象，不是目录)
├── latest/                               (electron-updater 当前版本目录)
│   ├── latest-mac.yml
│   ├── latest.yml                        (Windows，M2)
│   ├── latest-linux.yml                  (Linux，M2)
│   ├── U-Agents-arm64.zip                (mac arm64 自动更新增量包)
│   ├── U-Agents-arm64.zip.blockmap
│   ├── U-Agents-x64.zip
│   └── U-Agents-x64.zip.blockmap
├── v0.9.0/                               (按版本号归档，下载页用；同时供 manifest.ts 读取)
│   ├── manifest.json                     (version manifest，字段以 manifest.ts 代码为准)
│   ├── U-Agents-arm64.dmg
│   ├── U-Agents-x64.dmg
│   ├── U-Agents-arm64.zip
│   ├── U-Agents-x64.zip
│   ├── ... .blockmap
│   └── latest-mac.yml
├── v0.9.0+u-agents.1/                    (示例 hotfix 版本，SemVer build metadata)
│   ├── manifest.json
│   └── ...
└── ...
```

> `electron-builder.yml` 中 `publish.url: https://update.u-agents.u-studio.cn/latest`
> electron-updater 会去 `https://update.u-agents.u-studio.cn/latest/latest-mac.yml` 拉清单。

**Round 44 补遗：第二条版本 manifest 链路**

`packages/shared/src/version/manifest.ts` 还有一条独立的 `VERSIONS_URL`，不是 `electron-updater` 的 `publish.url`。M1 必须同步指向 `https://update.u-agents.u-studio.cn`，并在静态服务器上提供它请求的 JSON 结构（至少 `/latest` 与 `/{version}/manifest.json`，具体字段以代码实时读取为准）。否则即使自动更新清单已改到我们的域名，运行时版本检查仍会访问 `https://agents.craft.do/electron`。

> 路径边界：R2 可以同时存在对象 key `latest` 与 prefix `latest/`，但自定义域/CDN 不能把 `/latest` 强制重定向为 `/latest/`。上线前必须分别 `curl https://update.u-agents.u-studio.cn/latest` 和 `curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml` 验证。

---

## 4. 上传发版流程

每次 `05-build-release.md` 出包后：

### 4.0 先生成 version manifest JSON（当前不会自动产出）

当前上游打包脚本只自动生成 `latest-mac.yml`；`apps/electron/scripts/build-dmg.sh` / `scripts/build/common.ts` 里生成的 `.build/upload/manifest.json` 也只是 `{ "version": "..." }` 简化对象，**不满足** `packages/shared/src/version/manifest.ts` 的 `VersionManifest` 结构。

在 #29 未新增正式生成脚本前，先人工生成两个 JSON 文件：

```bash
VERSION=v0.9.0  # 示例占位符，按实际发版号替换
BASE=https://update.u-agents.u-studio.cn/$VERSION
BUILD_TS=$(date +%s)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# sha256 和 size 必须从实际打包产物计算，不要照抄占位值
ARM64_SHA=$(shasum -a 256 apps/electron/release/U-Agents-arm64.dmg | cut -d ' ' -f 1)
X64_SHA=$(shasum -a 256 apps/electron/release/U-Agents-x64.dmg | cut -d ' ' -f 1)
ARM64_SIZE=$(stat -f%z apps/electron/release/U-Agents-arm64.dmg)
X64_SIZE=$(stat -f%z apps/electron/release/U-Agents-x64.dmg)

cat > /tmp/u-agents-manifest.json <<EOF
{
  "version": "$VERSION",
  "build_time": "$BUILD_TIME",
  "build_timestamp": $BUILD_TS,
  "binaries": {
    "darwin-arm64": {
      "url": "$BASE/U-Agents-arm64.dmg",
      "sha256": "$ARM64_SHA",
      "size": $ARM64_SIZE,
      "filename": "U-Agents-arm64.dmg"
    },
    "darwin-x64": {
      "url": "$BASE/U-Agents-x64.dmg",
      "sha256": "$X64_SHA",
      "size": $X64_SIZE,
      "filename": "U-Agents-x64.dmg"
    }
  }
}
EOF

cat > /tmp/u-agents-latest.json <<EOF
{"version":"$VERSION"}
EOF
```

M2 增加 Windows/Linux 后，按 `manifest.ts` 的 `binaries` 约定追加对应平台 key。

```bash
# 1. 上传到版本归档
VERSION=v0.9.0  # 示例占位符，按实际发版号替换
rclone copy apps/electron/release/U-Agents-arm64.dmg r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/U-Agents-x64.dmg r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/U-Agents-arm64.zip r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/U-Agents-x64.zip r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/U-Agents-arm64.zip.blockmap r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/U-Agents-x64.zip.blockmap r2:u-agents-update/$VERSION/
rclone copy apps/electron/release/latest-mac.yml r2:u-agents-update/$VERSION/
# manifest.json 由 §4.0 按 manifest.ts 字段要求生成；下载 URL / 文件名不得含 Craft-Agents-* 或 agents.craft.do
rclone copyto /tmp/u-agents-manifest.json r2:u-agents-update/$VERSION/manifest.json

# 2. 切换 latest 指针（让所有用户的自动更新都看到这个版本）
rclone copy apps/electron/release/U-Agents-arm64.zip r2:u-agents-update/latest/
rclone copy apps/electron/release/U-Agents-x64.zip r2:u-agents-update/latest/
rclone copy apps/electron/release/U-Agents-arm64.zip.blockmap r2:u-agents-update/latest/
rclone copy apps/electron/release/U-Agents-x64.zip.blockmap r2:u-agents-update/latest/
rclone copy apps/electron/release/latest-mac.yml r2:u-agents-update/latest/
# /latest 是 version manifest 当前指针；不是 latest/ 目录内文件，必须用 copyto 避免上传成 latest/latest.json
rclone copyto /tmp/u-agents-latest.json r2:u-agents-update/latest

# 3. 验证
curl -I https://update.u-agents.u-studio.cn/latest/latest-mac.yml
# 200 OK
curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml
# 应返回 YAML 内容，version 字段是新版本号
curl https://update.u-agents.u-studio.cn/latest
# 应返回 JSON，指向新版本号
curl https://update.u-agents.u-studio.cn/$VERSION/manifest.json
# 应返回 JSON，下载 URL / 文件名不含 Craft-Agents-* 或 agents.craft.do
```

### 4.1 关键文件类型与 MIME

R2 默认按文件扩展名给 Content-Type：

| 文件 | 期望 Content-Type |
|---|---|
| `.yml` | `text/yaml` 或 `application/x-yaml` |
| `.dmg` | `application/x-apple-diskimage` 或 `application/octet-stream` |
| `.zip` | `application/zip` |
| `.exe` | `application/octet-stream` |
| `.AppImage` | `application/octet-stream` |
| `.blockmap` | `application/octet-stream` |

如果发现 yml 被当成 `text/plain` 而 electron-updater 解析失败，在 R2 的 Object 元数据里手动改。

---

## 5. `latest-mac.yml` 文件示例

`electron-builder` 会在打包时自动生成。**结构供参考**：

```yaml
version: 0.9.0
files:
  - url: U-Agents-arm64.zip
    sha512: <sha512 hash>
    size: 123456789
  - url: U-Agents-x64.zip
    sha512: <sha512 hash>
    size: 234567890
path: U-Agents-arm64.zip
sha512: <sha512 hash>
releaseDate: '2026-05-15T12:00:00.000Z'
```

⚠️ **不要手工编辑**这个文件——`electron-builder` 用 sha512 校验，手工改会让自动更新失败。

---

## 6. 自定义"下载页"

`u-agents.u-studio.cn`（主域）至少要有一个简单下载页，列出当前版本的 .dmg / .exe / .AppImage 链接。

最小实现：一个静态 HTML，按 User-Agent 自动推荐对应平台。

> M2 阶段再考虑做得花哨。M1 阶段一个 `index.html` 就行。

---

## 7. 高级话题（M2/M3 再做）

### 7.1 灰度发布

`electron-updater` 自带 `staged rollouts`：在 `latest-mac.yml` 里加 `stagingPercentage: 10`，只 10% 的用户会拿到这个清单。

实现：维护两个 yml（`latest-mac.yml` 含 staging，`latest-mac-stable.yml` 不含），定期"升级" stable 指针。

### 7.2 区分稳定通道 / Beta 通道

让用户在设置里选"稳定" / "Beta"，从不同 URL 拉清单：
- 稳定：`update.u-agents.u-studio.cn/latest/`
- Beta：`update.u-agents.u-studio.cn/beta/`

### 7.3 Sentry / 错误上报

M3 阶段：自建 Sentry self-hosted 或 GlitchTip，DSN 写到 `SENTRY_ELECTRON_INGEST_URL` 环境变量。

### 7.4 国内访问速度优化

如果 R2 国内速度不行：
- 选 1：迁移到阿里云 OSS / 腾讯云 COS（都需要 ICP 备案）
- 选 2：用 Cloudflare Argo Tunnel + 国内 CDN 中转
- 选 3：双源（国内 CDN + 海外 R2），客户端首次 ping 后选最快的

### 7.5 自动更新签名校验（**M2 必启**）

**M1 现状**：adhoc 包没有正式签名，`electron-updater` 默认在 macOS 上**会**做基础的代码签名校验。但 adhoc 签名不是"已知发布者"，所以严格模式下可能拒绝更新（或等同关闭校验）。

**M2 切到正式签名 + 公证后**，应在 `apps/electron/src/main/auto-update.ts` 中**显式启用**签名校验：

```typescript
// macOS（M2 公证后）
autoUpdater.autoDownload = true
// 上游默认就会做 codesign 校验，但 M2 阶段建议显式记录在 main.log 里：
mainLog.info(`[auto-update] codesign verification will reject updates not signed by '${expectedTeamId}'`)

// Windows（M2 EV 证书后）
autoUpdater.publisherName = ['U Studio']  // 显式声明可信发布者
```

**为什么不在 M1 做**：
- adhoc 包没真实签名，`publisherName` 校验会让"M1 → M2 自动更新"失败（旧版本拒绝接受新版本，因为发布者从"无"变成"U Studio"）
- M2 切公证后，第一次发版要让 M1 用户**有一次"自动更新接受新发布者"** 的窗口；之后再启用严格 publisherName 校验
- 详见 `electron-updater` 文档的 "minor signature changes" 章节

**风险**：M1 阶段的 adhoc 包**没**强签名校验——理论上中间人攻击（如劫持 `update.u-agents.u-studio.cn` 的 HTTPS）可能推送恶意更新。但因为 update server 走 HTTPS + Cloudflare 的 TLS 终端 + 我们的 R2 bucket，攻击面很小。**M2 启用 publisherName 后真正闭环**。

登记到 `LEGAL.md` §5（已知瑕疵）：M1 自动更新无强签名校验是 adhoc 包的固有限制。

---

## 8. 故障排查

### 8.1 用户报"无法检查更新"

按顺序排：

```bash
# 1. DNS 是否解析
dig update.u-agents.u-studio.cn

# 2. HTTPS 证书是否有效
curl -I https://update.u-agents.u-studio.cn/latest/latest-mac.yml

# 3. 服务是否返回 200
curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml

# 4. 用户机器上的 log
# macOS: ~/Library/Logs/U Agents/main.log
# Windows: %LOCALAPPDATA%/U Agents/logs/main.log
# Linux: ~/.config/U Agents/logs/main.log
```

### 8.2 自动更新拉到 yml 但下载 zip 失败

→ zip 文件没上传 / sha512 不匹配 / 文件名大小写不对。

```bash
rclone ls r2:u-agents-update/latest/
# 确认 zip 文件存在且文件名与 yml 一致
```

### 8.3 旧版本用户看不到新版本

→ 用户客户端 cache 太久。`electron-updater` 默认 30 分钟检查一次，可以让他们手动"检查更新"。

如果 latest/ 目录的 yml 上传后用户仍拿到旧 yml → CDN 边缘缓存。CF R2 自定义域名默认无 CDN cache，但如果加了 Cloudflare Workers/规则可能会缓存——必要时用 "Purge Cache"。

---

## 9. 监控

每周（自动化）跑一次健康检查：

```bash
#!/bin/bash
# 放在你自己的服务器 cron 或 GitHub Actions
URLS=(
  "https://update.u-agents.u-studio.cn/latest/latest-mac.yml"
  "https://u-agents.u-studio.cn/"
  "https://token.u-studio.cn/v1/models"   # U-API 健康
)
for url in "${URLS[@]}"; do
  if ! curl -fsS "$url" >/dev/null; then
    # 发个邮件或推送通知给自己
    echo "ALERT: $url is down"
  fi
done
```
