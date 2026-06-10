# 05 — 打包与发版手册

> 给"用户/外部 AI"的逐步操作手册——本仓库 AI 不执行这些命令（详见 `CLAUDE.md` §0），只产出/维护本文。
> 每次发版按本文从上到下走一遍。

---

## 0. 一次性准备（首次发版前做）

### 0.1 域名与服务

| 服务 | 状态 | 准备方式 |
|---|---|---|
| `update.u-agents.u-studio.cn` | M1 必需 | 见 `06-update-server.md` |
| `u-agents.u-studio.cn` | M1 软依赖（菜单链接指过来）| 静态页占位即可 |
| `token.u-studio.cn` | ✅ 已有 | newapi 自营 |

### 0.2 macOS 签名策略（**M1 走 adhoc，M2 切正式签名 + 公证**）

#### M1 路径：adhoc 签名，无公证（**当前阶段**）

不需要 Apple Developer 账号、不需要证书、不需要环境变量。

代价：用户首次启动 .app 会被 Gatekeeper 拦截，必须手动绕过：
- macOS 12-：Finder 右键 .app → "打开"
- macOS 13+：双击被拒后，去**系统设置 → 隐私与安全性 → 拉到底点 "仍要打开"**

⚠️ **每次自动更新装新版本**，用户都要重新走一次这个流程——这是 M1 阶段最大的体验痛点。在网站和文档里**必须**清楚说明。

#### M2 路径：正式签名 + 公证（**M2 出口条件**）

需要的资产（一次性申请，每年续）：

| 资产 | 来源 | 用途 |
|---|---|---|
| Apple Developer 账号（个人 $99/年）| `developer.apple.com` | 注册 ID |
| Developer ID Application 证书 | Xcode → Preferences → Accounts → Manage Certificates | 代码签名 |
| Apple ID + App-specific password | `appleid.apple.com` → Sign-In → App-specific Passwords | 公证（notarization）|
| Apple Team ID | Apple Developer 账号页面 | 公证身份 |

环境变量（写到 `.env.release`，**不要**提交到 git）：

```bash
# macOS 签名
CSC_LINK="path/to/your-cert.p12"  # 或 base64 字符串
CSC_KEY_PASSWORD="证书密码"

# macOS 公证
APPLE_ID="your@apple.id"
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
APPLE_TEAM_ID="ABCD1234EF"
```

⚠️ **必须**手动把 `.env.release` 加入 `.gitignore`。

上游 `.gitignore` 实际只包含这几行（不是通配 `.env*`）：

```
.env
.env.development.local
.env.test.local
.env.production.local
.env.local
```

**`.env.release` 不在内**——如果不手动添加，Apple 公证密码、签名证书路径等敏感信息会被 git tracked。

操作（用户/外部 AI 执行，一次性）：在 `.gitignore` 末尾追加 `.env.release`，提交。

#### 切换时机

M1 → M2 升级时，重新打一次正式签名 + 公证版本，上传到更新服务器，发布即可。**已装 adhoc 版本的用户**会通过自动更新升级到正式版（首次升级仍需手动绕过 Gatekeeper，**之后都不再被拦**）。

### 0.3 Windows 签名（M2 时做）

| 资产 | 来源 | 用途 |
|---|---|---|
| Windows 代码签名证书 | DigiCert / GlobalSign / SSL.com 等（约 $200-400/年）| Windows EV/OV Code Signing |

环境变量：

```bash
WIN_CSC_LINK="path/to/your-cert.pfx"
WIN_CSC_KEY_PASSWORD="证书密码"
```

> **M1 阶段如果不发 Windows 包，跳过 0.3。**

### 0.4 上传凭证

更新服务器选择决定上传方式：

| 方案 | 凭证 | 适合 |
|---|---|---|
| Cloudflare R2 + 静态域名 | R2 access key | ⭐ 推荐 |
| AWS S3 + CloudFront | AWS IAM key | 也行 |
| 自有 VPS + Nginx | SSH key + scp | 简单但要自己维护 |

详见 `06-update-server.md` §3。

---

## 1. 发版前检查清单

每次发版前**必跑**：

```bash
cd /Users/dengwang/Documents/coding/u-agents-oss/u-agents

# 1. 工作区干净 + 同步到最新 main（安全版）
git status                          # 应为干净状态（无未提交修改）
git remote -v                       # 确认 origin 已指向你的私有 fork（不是指向上游）
git pull --ff-only origin main      # --ff-only 不会悄悄创建 merge commit，遇分叉直接报错

# 2. typecheck + lint（OSS 工作区不要跑组合 bun run lint，详见 11-roadmap.md 入口条件）
bun run typecheck:all
bun run lint:i18n:parity
bun run lint:electron
bun run lint:shared
bun run lint:ui

# 3. 测试
bun run validate:dev          # = typecheck:all + test:shared:all + test:doc-tools（不含 i18n parity / eslint）
bun run test:shared:all       # validate:dev 已包含；可单独重跑以定位 shared auth/source/url fixture 问题

# 4. 品牌验收（来自 01-branding-spec.md §8）
grep -rEn "Craft Agents?" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.html" --include="*.md" \
  | grep -v node_modules | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v "LICENSE" | grep -v ".planning"
# 用户可见发布物应为 0；合规署名只允许在 LICENSE / NOTICE / TRADEMARK / LEGAL / About 文案中出现

# Deeplink / release notes / shared fixture 验收
rg -n "craftagents://|mcp\.craft\.do" packages/shared/src/auth packages/shared/src/sources packages/shared/src/utils apps/electron/resources/release-notes packages/shared/src/release-notes
# 默认应为 0；如历史 release note 被产品层隐藏，必须在发版说明中记录隐藏策略

# README / CLI / 包级文档示例验收
rg -n "craftagents://|Craft Agents?|Craft-Agents-|\.craft-agent|@craft-agent/|agents\.craft\.do|docs\.craft\.do" README.md docs packages apps --glob '*.md' \
  | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v "LEGAL.md" | grep -v ".planning"
# M1 对外发布文档不应命中；M1 不发布范围的残留必须在发版说明中标注

# env / CI / server 模板不能继续教用户配置 Craft 命名变量或第三方 Sentry 示例
rg -n "CRAFT_[A-Z0-9_]+|your-public-key@o0\.ingest\.sentry\.io|craft-server|craft-data|/root/\.craft-agent" .env.example .github Dockerfile.server scripts/install-server.sh scripts/build-server.ts apps/webui/src/login.html
# M1 可保留不发布的 server/WebUI/CLI 文件若命中，必须在发版说明中明确“不发布”；.env.example 不应命中

grep -rE 'com\.lukilabs' . | grep -v node_modules
# 应为空

grep -rE '"@craft-agent/' --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" | grep -v node_modules | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v ".planning"
# 用户可见发布物应为空；包级 README 若随 npm/文档站发布必须同步改

# 5. 锁定验收（02-llm-gateway-spec.md §10 + 03-ui-lockdown-spec.md §5）
# 这些需要在打包后的应用里手动测，不能通过 grep 验证；另需在曾安装上游包的机器上点击 craftagents://，确认不会打开 U Agents

# 6. 子进程产物验收（必跑，详见 12-subprocess-build-pipeline.md §3）
# 这是 M1 v0.9.0 真实事故根因——打包脚本不调 copyPiAgentServer，导致首条 LLM 消息必报 piServerPath not configured
ls apps/electron/resources/pi-agent-server/index.js apps/electron/resources/pi-agent-server/node_modules/koffi
ls apps/electron/resources/session-mcp-server/index.js apps/electron/resources/bridge-mcp-server/index.js
# 任一缺失 = 修 12 §2 的脚本接线后重新 electron:build
```

任何一步失败都**不能**继续发版。

---

## 2. 版本号 bump

```bash
# 1. 同步修改根 package.json 与 apps/electron/package.json 的 "version" 字段
# 1.0.0（首发）→ 1.0.1（patch）→ 1.1.0（minor）→ 2.0.0（major）

# 2. 如执行 AI 选择“全 workspace 同版本”，再同步其他有 version 字段的 package.json
# 但 Electron 构建/manifest 至少会受 apps/electron/package.json 影响，不能只改根 package.json

# 3. 提交
git add package.json apps/electron/package.json
git commit -m "chore: bump to 1.x.y"
git tag v1.x.y
```

> 我们的版本号**与上游解耦**（`07-upstream-sync.md` §6）。

---

## 3. macOS 打包

> ⚠️ **D1 决策（2026-06-10）：自 v0.10.3 上游同步版起，macOS 仅出 arm64（Apple Silicon），跟随上游 Intel (x64) 停产**（上游 v0.10.0 是最后一个 Intel 版，我方对应版本同此）。
> - 本节下文所有 `x64` 命令、产物（`U-Agents-x64.dmg` / `U-Agents-x64.zip`）**自该版本起不再产出**，保留文字仅作历史参考
> - 执行项：调整 mac 打包目标仅 arm64（`electron-builder.yml` mac target 或对应 `dist:mac*` 脚本参数，以同步时实际配置为准），下载页/公告注明 v0.10.0 为最后 Intel 版
> - 待验证（同步后）：**存量 x64 用户的自动更新行为**——新 `latest-mac.yml` 不再含 x64 产物时，Intel 机上 electron-updater 是静默不更新还是报错弹窗；若报错需在 `06-update-server.md` 补处理方案（如保留旧 yml 的 x64 条目冻结在 v0.10.0）
> - 决策出处：[`sync-reports/UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md) §8 D1

### 3.1 清理 + 构建

```bash
# 清理旧产物
bun run electron:clean

# 全量构建（main + preload + renderer + resources + assets + subprocess servers）
bun run electron:build
```

**预期输出**：`apps/electron/dist/` 有完整产物 **且 `apps/electron/resources/pi-agent-server/index.js` 存在**。

> ⚠️ **`electron:build` 必须包含 subprocess servers 复制步骤**（详见 [`12-subprocess-build-pipeline.md`](12-subprocess-build-pipeline.md) §2.1）。
> 上游原版 `electron:build` **不复制 pi-agent-server**——这是 U Agents M1 v0.9.0 首次发版的实际事故根因，导致装包后首条 LLM 消息必报 `piServerPath not configured`。
> 上游同步后必须确认 `package.json` 的 `electron:build` 仍以 `&& bun run electron:build:subprocess` 结尾。

---

### 3.2 M1 路径：adhoc 打包（无 Apple ID）

#### 3.2.0 ⚠️ 命令深度对照表（**M2-REBUILD 2026-05-05 补遗**）

整个 root 的 `electron:dist:*` 命令族**都跳过 `apps/electron/scripts/build-dmg.sh`**——只跑 electron-builder 直打包。**`build-dmg.sh` 才负责 SDK 复制 + claude-agent-sdk-binary alias 创建**。

| 命令 | 含 SDK 复制 | DEV_RUNTIME flag | 实际适用 |
|---|---|---|---|
| `bun run electron:dist:dev:mac` | ❌ | ✅ | 仅你的 dev 机器（walk-up 找 SDK） |
| `bun run electron:dist:adhoc:mac` | ❌ | ❌ | M1 锁 U-API 时勉强可用，**SDK 缺失对 pi_compat 路径透明** |
| `bun run electron:dist:mac` | ❌ | ❌ | 同上但启用自动 codesign |
| **`cd apps/electron && bun run dist:mac`** | ✅ 调 build-dmg.sh | ❌ | **真正完整产物**——M2 应切换到这条 |
| **`cd apps/electron && bun run dist:mac:x64`** | ✅ | ❌ | ~~同上 x64~~ **D1：v0.10.3 起停产，勿再使用** |

**M1 历史选择**：v0.9.0 首发 + 2026-05-05 hotfix 重打都用 `electron:dist:adhoc:mac`，SDK 不在 DMG 但 U-API 用户走 pi-agent.ts 路径（不调 Claude SDK），透明。

**M2 应切换到** `cd apps/electron && bun run dist:mac` —— 让 SDK 真正进 DMG，**防御性 bundle**：万一未来上游同步引入 Claude 直连 fallback，也不会因 SDK 缺失 crash。

> ⚠️ **v0.10.3 同步起本节"SDK 缺失透明"论述失效**：上游 v0.10.1 把 `@anthropic-ai/claude-agent-sdk` 从 esbuild bundle 改为 externalize（运行时 `require`），**不含 SDK 的包（adhoc 直打不调 build-dmg.sh）从"功能透明"变成"启动即崩"（MODULE_NOT_FOUND）**。该同步后所有打包必须走含 `build-dmg.sh` 的完整路径（已含 SDK 本体复制，L132-137 段，无需改脚本）；冷启动为第一道哨兵测试。详见 [`sync-reports/UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md`](sync-reports/UPSTREAM-PREVIEW-v0.10.3-2026-06-10.md) §5。

详见 [`sync-reports/M2-REBUILD-HOTFIX-2026-05-05.md`](sync-reports/M2-REBUILD-HOTFIX-2026-05-05.md) §4。

#### 3.2.1 一次性配置：在 package.json 加 adhoc 脚本

上游有 `electron:dist:dev:mac` 但带了 `CRAFT_DEV_RUNTIME=1`，**不适合 production 分发**。

`CRAFT_DEV_RUNTIME` 的实际作用是控制 `packages/shared/src/agent/backend/internal/runtime-resolver.ts:12` 的 SDK binary 路径解析：
- `CRAFT_DEV_RUNTIME=1`：从 .app bundle 往上 walk-up 找 monorepo `node_modules/` 解析 SDK binary（**仅 dev 机器有效**）
- 不设：从 packaged 路径（`Resources/app/node_modules/@anthropic-ai/claude-agent-sdk-binary/`）解析；如该路径不存在则 strict 模式 throw

⚠️ **重要**：M1 的 `electron:dist:adhoc:mac` 不调 build-dmg.sh，packaged 路径里**没有 SDK**——但 U-API 用户走 pi-agent.ts 路径（0 SDK 依赖），所以 SDK 缺失对单连接 U-API 用户**透明**。M2 应改用 `cd apps/electron && bun run dist:mac`（含 SDK）防御性 bundle。

需要在 `package.json` `scripts` 块里**新增**一行（用户/外部 AI 执行）：

```json
"electron:dist:adhoc:mac": "CSC_IDENTITY_AUTO_DISCOVERY=false bun run electron:build && cd apps/electron && CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --config electron-builder.yml --mac"
```

**和 `dev:mac` 的区别**：去掉了 `CRAFT_DEV_RUNTIME=1`，让 SDK binary 走 packaged 路径。

#### 3.2.2 打包

打包前先确认 #27 已落地，否则命令不存在：

```bash
bun run | grep electron:dist:adhoc:mac
# 应能看到 electron:dist:adhoc:mac；如果没有，先回到 §3.2.1 新增脚本
```

```bash
# adhoc 签名（D1：v0.10.3 起仅 arm64，不再打 x64）
bun run electron:dist:adhoc:mac
```

**预期输出**：`apps/electron/release/`（D1 后 x64 两项不再产出）：
- `U-Agents-arm64.dmg`
- ~~`U-Agents-x64.dmg`~~（D1 停产）
- `U-Agents-arm64.zip`（用于自动更新）
- ~~`U-Agents-x64.zip`~~（D1 停产）
- `latest-mac.yml`
- `*.blockmap`

**Round 44 补遗：manifest JSON 也要出现在更新服务器**

除 `electron-updater` 用的 `latest-mac.yml` 外，`packages/shared/src/version/manifest.ts` 还会按 `VERSIONS_URL` 拉版本 manifest JSON。打包/上传脚本必须确认：
- `VERSIONS_URL` 已指向 `https://update.u-agents.u-studio.cn`
- 更新服务器提供 `/latest` 与 `/{version}/manifest.json`（字段以 `manifest.ts` 代码为准）
- 当前上游打包脚本不会自动在 `apps/electron/release/` 生成完整 `manifest.json` / `latest.json`；若 #29 尚未新增生成脚本，必须按 `06-update-server.md` §4.0 的模板人工生成
- 返回内容里的下载文件名/URL 不含 `Craft-Agents-*` 或 `agents.craft.do`

**验证 adhoc 签名**：

```bash
codesign -dvv apps/electron/release/mac-arm64/U\ Agents.app 2>&1 | head -10
# Authority 这里应该输出 "Signature=adhoc" 或者根本无 Authority 行（电子签名仅自签）
# 这是正常的——证明没用真实证书，但能在本机/开发机运行
```

#### 3.2.3 用户首次启动操作（写入用户文档）

把以下文案放到 `u-agents.u-studio.cn` 下载页 + 应用安装文档中：

```markdown
## 首次启动 macOS 版本

由于 U Agents M1 阶段未启用 Apple 公证（M2 上线后自动消除），
首次启动会看到"无法验证开发者"警告。请：

**macOS 13 (Ventura) 及更新**：
1. 双击 U Agents.app，在弹窗中点"取消"
2. 打开"系统设置" → "隐私与安全性"
3. 拉到最底部，找到 "U Agents 已被阻止" → 点"仍要打开"
4. 重新双击应用，再次点"打开"
5. 之后启动均正常（直到下次自动更新装新版本）

**macOS 12 (Monterey) 及更早**：
1. 在 Finder 中找到 U Agents.app
2. 按住 Control 键点击 / 右键 → "打开"
3. 弹窗中再次点"打开"
4. 之后启动均正常

**自动更新装新版本后**：
更新装好的新版本是首次运行，需要重新走上面流程一次。
M2 升级到正式公证版本后，所有用户**升级到该版本**之后再也不会被拦截。

**fallback：右键打开和系统设置都失败时**（少数 macOS 13+ 严格安全配置 / 企业管理 Mac 会遇到）：

打开"终端" (Terminal)，粘贴下面命令：

```bash
xattr -dr com.apple.quarantine /Applications/U\ Agents.app
```

如果上面提示 "Operation not permitted"（多见于公司管理的 Mac 或 SIP 严格配置），追加 `sudo`：

```bash
sudo xattr -dr com.apple.quarantine /Applications/U\ Agents.app
```

然后再次双击启动应用。

> 这条命令只移除"隔离标志"（quarantine attribute），不会清除其他文件元数据。这是因为我们应用启用了 `hardenedRuntime: true`（上游构建配置），adhoc 包带 hardenedRuntime 但未公证，少数 macOS 严格配置会拒绝运行——M2 切到正式签名+公证后此命令不再需要。
```

---

### 3.3 M2 路径：正式签名 + 公证（**M2 阶段才做**）

#### 3.3.1 一次性配置：启用公证

`apps/electron/electron-builder.yml` 中 `mac:` 块下，把上游注释掉的 `notarize` 段恢复为有效配置。改成（用户/外部 AI 执行）：

```yaml
mac:
  category: public.app-category.productivity
  icon: resources/icon.icns
  # ... 其他既有配置 ...
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  # ↓ 新增：启用公证（teamId 由环境变量提供）
  notarize:
    teamId: ${env.APPLE_TEAM_ID}
```

> ⚠️ 这是一次性配置，做完后纳入 Git，与上游同步时按 `08-conflict-zones.md` §1 的方法保留。

#### 3.3.2 加载环境变量

```bash
source .env.release
```

#### 3.3.3 打包

```bash
# 正式签名 + 公证（D1：v0.10.3 起仅 arm64，不再打 x64）
bun run electron:dist:mac
```

打包过程中 electron-builder 会：
1. 用 `CSC_LINK` + `CSC_KEY_PASSWORD` 签名 .app
2. 用 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` 调用 Apple 公证服务（约 5-15 分钟）
3. 公证通过后 staple 票据到 .app 上
4. 打成 .dmg 和 .zip

#### 3.3.4 验证签名 + 公证

```bash
codesign -dvv apps/electron/release/mac-arm64/U\ Agents.app
# Authority 应该列出 "Developer ID Application: U Studio (xxx)"

spctl -a -t exec -vv apps/electron/release/mac-arm64/U\ Agents.app
# 输出应包含 "accepted" 与 "source=Notarized Developer ID"
```

**预期输出**：`apps/electron/release/`（D1 后 x64 两项不再产出）：
- `U-Agents-arm64.dmg`
- ~~`U-Agents-x64.dmg`~~（D1 停产）
- `U-Agents-arm64.zip`（用于自动更新）
- ~~`U-Agents-x64.zip`~~（D1 停产）
- `latest-mac.yml`（自动更新清单）
- `*.blockmap`（增量更新用）

**验证签名**：

```bash
codesign -dvv apps/electron/release/mac-arm64/U\ Agents.app
# Authority 应该列出 "Developer ID Application: U Studio (xxx)"

# 验证公证
spctl -a -t exec -vv apps/electron/release/mac-arm64/U\ Agents.app
# 输出应包含 "accepted" 与 "source=Notarized Developer ID"
```

### 3.4 在干净 macOS 上测安装

**必须**：在另一台 Mac（或重置过的虚拟机）上：
1. 双击 DMG
2. 拖到 Applications
3. 启动应用

**M1 阶段（adhoc）预期**：
- 出现"无法验证开发者"警告 → **正常**，按 §3.2.3 的步骤右键打开/系统设置允许
- 允许之后能进入 Welcome → 通过 onboarding

**M2 阶段（公证）预期**：
- **不应出现** Gatekeeper 警告
- 如果出现，回到 §3.3 检查公证是否真的成功

按 `09-test-checklist.md` 跑一遍 onboarding。

---

## 4. Windows 打包（M2）

### 4.0 ⚠️ Windows 命令深度对照（**M2-REBUILD 2026-05-05 补遗**）

跟 macOS 同样规律——root 的 `electron:dist:*win` 命令都不调 `build-win.ps1`：

| 命令 | 含 SDK 复制 | DEV_RUNTIME | 适用 |
|---|---|---|---|
| `bun run electron:dist:dev:win` | ❌ | ✅ | 仅你的 Windows dev 机器（walk-up）|
| `bun run electron:dist:win` | ❌ | ❌ | M1 锁 U-API 时勉强可用 |
| **`cd apps/electron && bun run dist:win`** | ✅ 调 build-win.ps1 | ❌ | **真正发版命令** |

**user 之前 Windows 打包用 `electron:dist:dev:win`** —— 在你 dev 机器自测能用是因为：
1. CRAFT_DEV_RUNTIME=1 让 walk-up 找到 SDK（仅你机器）
2. 即使 walk-up 失败，U-API 用户也不调 SDK

**装到种子用户机器后**：walk-up 必失败，但 U-API 路径透明 → 用户能用。

**M2 标准命令**：`cd apps/electron && bun run dist:win`（含 SDK 复制）

### 4.1 标准 Windows 打包流程

```cmd
:: 在 Windows 机器上
git pull
bun install
cd apps/electron
bun run dist:win
```

**预期输出**（`apps/electron/release/`）：
- `U-Agents-x64.exe`（NSIS 安装器）
- `U-Agents-x64.exe.blockmap`
- `latest.yml`（Win 自动更新清单）

**测试**：在干净 Windows 11 上双击 .exe 安装。

⚠️ **未签名的 Windows .exe** 会触发 SmartScreen 警告，新发布的证书需要"积累信誉"几周才不会被警告。建议至少买一份**OV** 级证书。EV 级证书（HSM 硬件 dongle）能立即清除 SmartScreen，但贵 2-3 倍。

---

## 5. Linux 打包（M2）

```bash
source .env.release
bun run electron:dist:linux
```

**预期输出**：
- `U-Agents-x64.AppImage`
- `latest-linux.yml`

测试：在 Ubuntu 22.04+ 双击 AppImage 启动（首次需要 `chmod +x`）。

---

## 6. 上传到更新服务器

详见 `06-update-server.md` §4。不要使用旧 `build-dmg.sh --upload` / `build-linux.sh --upload` 链路：旧脚本会尝试上传安装脚本或调用 OSS 工作区不存在的 upload 脚本，且无法保证 `/latest` 与 `/{version}/manifest.json` 两条链路完整。

最小确认：

```bash
curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml
# 应返回 electron-updater YAML，version 字段是最新版本号

curl https://update.u-agents.u-studio.cn/latest
# 应返回 JSON：{"version":"v1.x.y"}

curl https://update.u-agents.u-studio.cn/v1.x.y/manifest.json
# 应返回完整 VersionManifest；下载 URL / 文件名不含 Craft-Agents-* 或 agents.craft.do
```

上传命令以 `06-update-server.md` §4 为准，本文不复制一份简化版，避免漏掉 manifest JSON 或把 `/latest` 误上传成 `latest/latest.json`。

---

## 7. 网站发布（用户下载页）

在 `u-agents.u-studio.cn` 主页放置下载按钮，链接指向：
- `https://update.u-agents.u-studio.cn/v1.x.y/U-Agents-arm64.dmg`（macOS Apple Silicon）
- `https://update.u-agents.u-studio.cn/v1.x.y/U-Agents-x64.dmg`（macOS Intel）
- `https://update.u-agents.u-studio.cn/v1.x.y/U-Agents-x64.exe`（Windows，M2）
- `https://update.u-agents.u-studio.cn/v1.x.y/U-Agents-x64.AppImage`（Linux，M2）

---

## 8. 验证自动更新流程

**每次发版**必须**亲自验证一次**自动更新：

1. 在你的测试 Mac 上装 N-1 版本
2. 启动应用
3. 观察是否在 30 秒内出现"发现新版本"提示
4. 点击下载 → 安装 → 重启
5. 验证新版本号正确

如果失败：
- 看 `~/Library/Logs/U Agents/main.log`
- 看是否能 fetch 到 `update.u-agents.u-studio.cn/latest/latest-mac.yml`
- 看 latest-mac.yml 中 sha512 / 文件大小是否与上传的 zip 匹配

---

## 9. 版本回滚

如果发版后发现严重 bug：

### 9.1 立即"撤回 latest 指针"（让自动更新指向上一版）

```bash
# 把 v1.x.y-1 的 latest-mac.yml 重新拷贝到 latest/
rclone copy r2:u-agents-update/v1.x.y-1/latest-mac.yml r2:u-agents-update/latest/
```

新装机用户会装到上一版；已装新版的用户**不会自动降级**（electron-updater 不支持降级），需要等修复版本。

### 9.2 紧急修复版本

按 `07-upstream-sync.md` §3"紧急安全同步流程"打 hotfix 包，bump 到 v1.x.y+1。

---

## 10. 发版后归档

每次发版完成后：

1. 在 git 上标记 tag：`git push origin v1.x.y`
2. 在 `.planning/release-notes/v1.x.y.md` 写发版说明（**这一步可让本仓库 AI 协助**）
3. 在 `u-agents.u-studio.cn` 网站更新"What's new"
4. 通知用户群

发版说明模板：

```markdown
# U Agents v1.x.y — YYYY-MM-DD

## 新增
- ...

## 修复
- ...

## 已知问题
- ...

## 合规与发布边界
- 本版本基于 Craft Agents OSS，遵循 Apache 2.0 署名与 NOTICE 要求。
- M1 已知边界：OAuth Source 授权中可能出现 `agents.craft.do`；详见 `LEGAL.md` §5。
- 本版本不发布 standalone server / CLI / WebUI / Viewer 分发入口（如适用）；相关 Markdown 或模板中的上游残留不进入用户发布路径。
- About 面板、NOTICE 派生声明、核心改造文件 modification header 已复核。

## 同步上游
- 合并 craft-agents-oss vX.Y.Z（同步报告：sync-reports/YYYYMMDD.md）

## 升级方式
- 自动更新：启动应用即提示
- 手动下载：u-agents.u-studio.cn/download
```

---

## 11. 常见问题

### 11.1 [M1] 用户报"无法打开应用，已被移到废纸篓"

→ macOS 13+ 强行拒绝 adhoc 包的双击运行。让用户：
1. 把应用从废纸篓**还原**（不要清空废纸篓！）
2. 拖回 Applications
3. 按 §3.2.3 文档走"系统设置 → 隐私与安全性 → 仍要打开"

如果用户已经清空废纸篓了：让他重新下载 .dmg 重装。

### 11.2 [M2] 公证失败 "ERROR ITMS-90886: Invalid signing"

→ 证书过期或环境变量不对。检查 `CSC_LINK` 路径、`APPLE_TEAM_ID` 与你 Apple Developer 账号的 Team ID 一致。

### 11.3 打包后启动闪退，控制台报 "Code signature invalid"

→ 通常是 SDK binary 路径错误。检查 `electron-builder.yml` 第 64-76 行注释，对照 `apps/electron/node_modules/@anthropic-ai/claude-agent-sdk-binary/` 是否软链到正确平台。

### 11.4 自动更新提示 "Cannot find latest.yml"

→ 没上传或 URL 配错。检查：
- `electron-builder.yml:83` 的 `publish.url`
- `update.u-agents.u-studio.cn/latest/latest-mac.yml` 是否能 curl 到

### 11.5 用户在 Windows 装包时 SmartScreen 警告

→ 证书信誉没积累。短期内可让用户点 "更多信息" → "仍要运行"。长期解决方案：换 EV 证书。

### 11.6 macOS Apple Silicon 用户装了 x64 版

→ 用户从下载页选错了。在网站上做 UA 检测自动推荐对应版本。
