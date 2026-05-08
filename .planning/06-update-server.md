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

### 4.2 v0.9.2 实战 SOP（D-β 方案 + 4 个常见错误防范）

> **背景**：v0.9.2 重打 + R2 上线时**实战暴露 4 处坑**（v25/v26 review 抓到 + 用户实操踩到）。本节把每个坑机制化为防错命令，下次发版照做不重蹈覆辙。

#### 4.2.1 D-β 方案：仅 arm64 上 R2，x64 deferred

**问题**：`dist:mac` 默认在 Apple Silicon 上同时打 arm64 + x64 DMG（因 `electron-builder.yml:mac.target.arch` 含 x64）。但 x64 DMG 里 `vendor/bun` 是**主机架构 = arm64** —— Intel Mac 装上 spawn bun 立即闪退。详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §6 TODO #4。

**解决方案 D-β**（v25 review 决策，v0.9.2 落地）：
1. 重打时让 dist:mac 默认产出 arm64 + x64 DMG（不阻止）
2. **只把 arm64 上 R2**：`x64.dmg` / `x64.zip` 不上传 R2 任何路径
3. **手编 latest-mac.yml**：删掉 electron-builder 自动生成的 yml 中 4 entries 里的 x64.zip + x64.dmg，仅保留 arm64 两项

**手编 D-β yml 的标准做法**：

```bash
RELEASE=apps/electron/release

# 1. electron-builder 自动生成的（含 x64 entries，不能直接上传）
cat $RELEASE/latest-mac.yml
# version / files: 4 entries / path / releaseDate

# 2. 拷出 sha512 + size，手编一份 arm64-only 版
cat > $RELEASE/latest-mac-arm64-only.yml <<EOF
version: 0.9.2
files:
  - url: U-Agents-arm64.zip
    sha512: <从原 yml 拷>
    size: <从原 yml 拷>
  - url: U-Agents-arm64.dmg
    sha512: <从原 yml 拷>
    size: <从原 yml 拷>
path: U-Agents-arm64.zip
sha512: <U-Agents-arm64.zip 的 sha512>
releaseDate: '<原 yml 的 releaseDate>'
EOF
```

**Intel Mac 用户的体验**：electron-updater 拉到只含 arm64 的 yml → 找不到匹配 entry → "无可用更新"提示（不报错）→ 继续用 v0.9.1。**比装上 x64 闪退好得多**。

#### 4.2.2 错误防范 #1：`rclone copyto` vs `copy`

**坑**：用户首次上传 D-β yml 时跑 `rclone copy /...latest-mac-arm64-only.yml r2:.../latest/` —— 结果 R2 上**并存两个文件**：
```
r2:u-agents-update/latest/latest-mac.yml             ← 仍是旧 4 entries 版（自动更新读这个）
r2:u-agents-update/latest/latest-mac-arm64-only.yml  ← D-β 版（多余的独立文件）
```

electron-updater 客户端只读 `latest-mac.yml`，所以**用户体验完全没改**，Intel Mac 仍会闪退。

**正解**：用 `rclone copyto`（带重命名 = 覆盖目标）：

```bash
# ✅ 正确：copyto 重命名上传 → 覆盖 latest-mac.yml
rclone copyto $RELEASE/latest-mac-arm64-only.yml r2:u-agents-update/latest/latest-mac.yml

# ❌ 错误：copy 保留原文件名 → 留多余文件
# rclone copy $RELEASE/latest-mac-arm64-only.yml r2:u-agents-update/latest/

# 顺手清多余文件（如果之前误用 copy 留下的）
rclone delete r2:u-agents-update/latest/latest-mac-arm64-only.yml || true
```

#### 4.2.3 错误防范 #2：上传清单不能漏 EXE / blockmap / 归档

**坑**：用户首次上传时漏了 `U-Agents-x64.exe` 进 `/latest/`（误删后没补） + 漏了 `/v0.9.2/` 整个归档目录。导致 Windows 自动更新拉到 yml 后下载 EXE 时 404 + 无版本回滚能力。

**完整上传清单（每次发版必跑）**：

```bash
RELEASE=/Users/dengwang/Documents/u-agents-oss/u-agents/apps/electron/release
WIN=~/win-release   # Windows 端打的产物（你拷回来的位置）
VERSION=v0.9.2

# === Step 1: 归档版本目录（永久保留，回滚 / 审计 / 历史下载用）===
rclone copy "$RELEASE/U-Agents-arm64.dmg"          r2:u-agents-update/$VERSION/
rclone copy "$RELEASE/U-Agents-arm64.dmg.blockmap" r2:u-agents-update/$VERSION/
rclone copy "$RELEASE/U-Agents-arm64.zip"          r2:u-agents-update/$VERSION/
rclone copy "$WIN/U-Agents-x64.exe"                r2:u-agents-update/$VERSION/
rclone copy "$WIN/U-Agents-x64.exe.blockmap"       r2:u-agents-update/$VERSION/

# === Step 2: 切 latest 指针（自动更新读这里）===
# 2a. 复制产物（COS 内部复制免流量费——也可用 COS 控制台"批量复制"功能从 $VERSION/ 复制）
rclone copy "$RELEASE/U-Agents-arm64.dmg"          r2:u-agents-update/latest/
rclone copy "$RELEASE/U-Agents-arm64.dmg.blockmap" r2:u-agents-update/latest/
rclone copy "$RELEASE/U-Agents-arm64.zip"          r2:u-agents-update/latest/
rclone copy "$WIN/U-Agents-x64.exe"                r2:u-agents-update/latest/
rclone copy "$WIN/U-Agents-x64.exe.blockmap"       r2:u-agents-update/latest/

# 2b. yml 用 copyto（D-β：mac yml 用手编版覆盖原版）
rclone copyto "$RELEASE/latest-mac-arm64-only.yml" r2:u-agents-update/latest/latest-mac.yml
rclone copyto "$WIN/latest.yml"                    r2:u-agents-update/latest/latest.yml
```

**`/v{version}/` 归档目录的 4 个用途**：
1. **回滚**：v0.9.3 出问题时一键改 latest yml 指向 `/v0.9.2/...` 恢复用户体验
2. **历史下载**：种子用户报老版本 bug 时给链接 `https://update.u-agents.u-studio.cn/v0.9.2/U-Agents-arm64.dmg`
3. **审计 / 合规**：每个版本的 sha512 + 文件留存证据
4. **第三方镜像**：未来做镜像加速（多 CDN）拷整个 `/v0.9.2/` 路径

**没有归档的代价**：v0.9.3 上线后 `/latest/` 被覆盖，v0.9.2 的文件就**永久消失**。

#### 4.2.4 错误防范 #3：CDN 缓存必刷

**坑**：上传完 yml 后立即 curl，**仍拿到旧版**——CDN 边缘节点缓存。M2-REBUILD-HOTFIX §5 已记录此教训。

**正解**：

```bash
# 腾讯云 COS 控制台 → 域名管理 → CDN 加速域名 → "刷新预热" → 输入 URL：
# https://update.u-agents.u-studio.cn/latest/latest-mac.yml
# https://update.u-agents.u-studio.cn/latest/latest.yml
# 如果 yml 文件刷新不够，所有 latest/ 路径都刷一下：https://update.u-agents.u-studio.cn/latest/*
```

或用 `tccli`（腾讯云 CLI）：

```bash
tccli cdn PurgeUrlsCache --Urls '["https://update.u-agents.u-studio.cn/latest/latest-mac.yml","https://update.u-agents.u-studio.cn/latest/latest.yml"]'
```

#### 4.2.5 错误防范 #4：上传后必跑验证 grep

**坑**：用户首次说"R2 已上传并刷新"，实际 latest-mac.yml 仍是旧 4 entries 版（rclone copy 误用） + EXE 404 + 归档全 404。**不验证 = 不算上传完成**。

**正解 — 发版后必跑这套验证**：

```bash
DOMAIN=https://update.u-agents.u-studio.cn
VERSION=v0.9.2

echo "=== latest-mac.yml entries 数（D-β 应 = 2）==="
curl -s "$DOMAIN/latest/latest-mac.yml?_=$(date +%s)" | grep -cE "^  - url:"

echo "=== 多余的 latest-mac-arm64-only.yml 应已清（404）==="
curl -sI "$DOMAIN/latest/latest-mac-arm64-only.yml" | grep -E "^HTTP/"

echo "=== latest/ 下 5 + 2 文件全部 200 OK ==="
for f in U-Agents-arm64.dmg U-Agents-arm64.zip U-Agents-arm64.dmg.blockmap \
         U-Agents-x64.exe U-Agents-x64.exe.blockmap latest-mac.yml latest.yml; do
  curl -sI "$DOMAIN/latest/${f}?_=$(date +%s)" | grep -E "^HTTP/" | head -1 | sed "s|^|$f: |"
done

echo "=== /\$VERSION/ 归档 5 个文件全部 200 OK（用于回滚 / 审计）==="
for f in U-Agents-arm64.dmg U-Agents-arm64.zip U-Agents-arm64.dmg.blockmap \
         U-Agents-x64.exe U-Agents-x64.exe.blockmap; do
  curl -sI "$DOMAIN/$VERSION/${f}?_=$(date +%s)" | grep -E "^HTTP/" | head -1 | sed "s|^|$f: |"
done

echo "=== Content-Length 与本地产物一致 ==="
echo "本地 arm64.dmg：$(stat -f%z $RELEASE/U-Agents-arm64.dmg)"
echo "R2   arm64.dmg：$(curl -sI "$DOMAIN/latest/U-Agents-arm64.dmg" | grep -i content-length | awk '{print $2}' | tr -d '\r')"
```

**全部 200 OK + entries=2 + Content-Length 一致 = 发版完成**。任何一项不匹配就停下排查。

---

## 5. `latest-mac.yml` 文件示例

`electron-builder` 会在打包时自动生成。**结构供参考**：

```yaml
version: 0.9.2
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

⚠️ **正常情况下不要手工编辑**这个文件——`electron-builder` 用 sha512 校验，手工改会让自动更新失败。

⚠️ **但 D-β 例外**（v0.9.2 实战）：当 dist:mac 同时打 arm64 + x64 但 x64 包 vendor/bun 错架构（详见 §4.2.1），**必须手编** latest-mac.yml 只保留 arm64 entries。手编时 sha512 / size 必须从 electron-builder 自动生成的原版 yml **逐字符复制**（不能自己重算，那样会和实际产物字节流不匹配）。详见 §4.2.1 操作步骤。

---

## 6. 自定义"下载页"

`u-agents.u-studio.cn`（主域）至少要有一个简单下载页，列出当前版本的 .dmg / .exe / .AppImage 链接。

最小实现：一个静态 HTML，按 User-Agent 自动推荐对应平台。

> M2 阶段再考虑做得花哨。M1 阶段一个 `index.html` 就行。

### 6.1 必须有的"风险与兼容性"声明（**v27 review O1 P0 — 已落地**）

**问题背景**：v0.9.2 发布走的 D-β 策略——arm64-only macOS（vendor/bun 是 arm64，跑 x64 进程会 crash），但 release-notes / 下载页都没说清这一点，Intel Mac 用户下载 arm64 包会启动崩溃但拿不到任何"为什么"的解释。

**已落地实现**：[`web/download-page/index.html`](../web/download-page/index.html)（v27 后跟手做了，2026-05-08 commit）

实现要点（与 README 联动）：
- ✅ 单文件 HTML，所有 CSS + JS 内嵌（COS 友好）
- ✅ UA 检测：macOS Apple Silicon / macOS Intel / Windows / Linux / 移动端 5 路径
- ✅ Intel Mac 三层检测（UA arm 关键字 + maxTouchPoints + WebGL renderer）—— 三层都命中才标 Intel，宁可漏不可误
- ✅ Intel Mac 用户：隐藏推荐卡 + 顶栏 ⚠️ 警告 + 备用 Windows 下载卡 + 默认展开"所有平台"
- ✅ 自动深色模式（跟随系统）
- ✅ 移动端：提示"在桌面访问"
- ✅ 历史版本归档说明（引导用户去 `/v0.9.2/` 等归档目录）

**部署到 COS 的步骤**：[`web/download-page/README.md`](../web/download-page/README.md) §3 — 含 rclone copyto 命令 + CDN 刷新 SOP（同 06 §4.2 教训）

**验收清单**：[`web/download-page/README.md`](../web/download-page/README.md) §4 — 4 大类 14 项检查（浏览器 / Intel Mac 模拟 / 链接 / SEO）

**维护节奏**：每次发新版必更新 3 处版本号 + 重传 + 刷 CDN，详见 [`web/download-page/README.md`](../web/download-page/README.md) §5

### 6.2 推动 Intel Mac 实测的 SOP（**v27 review O1 P0**）

**当前阻塞**：用户没有 Intel Mac 实测设备 →macOS x64 build 一直处于"打了包没人验"状态 → R2 上传后无法保证能用。

**SOP — 推动节奏**（实施 AI 在每次 sync 后跑这套）：

1. **每次 sync 后检查清单**：
   - [ ] vendor/bun 的架构（用户机器是 arm64？x64？兼容包？）
   - [ ] electron-builder 的 `mac.arch` 设置（`['arm64']` / `['x64']` / `['arm64','x64']`）
   - [ ] dist:mac 默认产出包数（如同时产 arm64 + x64，但 vendor/bun 是 arm64-only，**x64 包必崩**）
2. **若用户机器是 arm64-only（当前情况）**：
   - 默认 dist:mac 仅产 arm64 包
   - latest-mac.yml 仅含 arm64 entry（D-β 策略）
   - 下载页 §6.1 显示 Intel "暂不支持"
3. **触发"补 x64"的条件**：
   - 用户买了 Intel Mac → 在用户机器上跑 `dist:mac --arch x64`
   - **OR** GitHub Actions 上跑 macOS-13 runner（Intel）跑 build → 上传产物
   - **OR** 第三方众包测试（找一个有 Intel Mac 的朋友帮跑一次实测）
4. **永远不接受**："本机 cross-compile x64 包但没在 Intel 机器上验过就发布"——vendor/bun 等原生模块在 cross-compile 后大概率运行时崩溃
5. **每次实施 AI 跑 sync 完，必须在 sync 报告里回答**：
   - "Intel Mac x64 当前状态？"（已发布 / 暂不支持 / 待实测）
   - "下次目标？"（按用户当前数据决定，不强行排进 M3）

**长期解法**：M3 阶段计划接入 GitHub Actions / 自建 CI，cross-platform build 就不再依赖用户本机机器（详见 [`05-build-release.md`](./05-build-release.md) §未来 CI/CD）。

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
