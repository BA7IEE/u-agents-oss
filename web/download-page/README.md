# 下载页（u-agents.u-studio.cn）

> **目标**：U Agents 官方下载页，部署到 `https://u-agents.u-studio.cn/`（主域）。
> **状态**：v1（v0.9.2 ship 同步配套）
> **由来**：v27 review O1 P0-2/P0-4 — Intel Mac 用户下载 arm64 包必崩，下载页必须有 UA 检测拦截 + 风险声明。
> **关联文档**：[`.planning/06-update-server.md`](../../.planning/06-update-server.md) §6.1 + §6.2

---

## 1. 文件结构

```
web/download-page/
├── index.html      ← 单文件下载页（无外部依赖）
└── README.md       ← 本文档
```

**为什么是单文件**：
- COS / 静态托管对单文件友好，无需配置打包
- 所有 CSS + JS 内嵌，离线即可在本机预览
- 便于复制粘贴到任意托管服务（COS / Cloudflare Pages / Vercel 等）

---

## 2. 功能

### 2.1 自动 UA 检测 + 推荐
| 用户系统 | 自动行为 |
|---|---|
| **macOS Apple Silicon** | 推荐 arm64 dmg |
| **macOS Intel** | 隐藏推荐卡 + 显示 ⚠️ 警告 + 显示 Windows 备用下载 |
| **Windows** | 推荐 x64 exe |
| **Linux** | 推荐 Windows + 副标题加"Linux 实验性"提示 |
| **移动端** | 提示"在桌面访问" |
| **未识别** | 兜底推荐 macOS arm64 |

### 2.2 Intel Mac 检测策略
- 优先看 `navigator.userAgent` 是否含 `arm` / `aarch64` / `apple silicon` 关键字
- 退而求其次：检测 `navigator.maxTouchPoints`（Apple Silicon 通常 ≥5，Intel Mac = 0）
- 最终验证：WebGL renderer 字符串（Intel Mac 含 "Intel" / "AMD" / "NVIDIA"，Apple Silicon 含 "Apple"）
- **三层都命中才标 Intel**——宁可误判为 Apple Silicon（不警告），不要误判为 Intel（误警告）

### 2.3 永久可见的"所有平台"列表
- 默认折叠（Apple Silicon / Windows 用户看到推荐即可下载）
- Intel Mac / Linux / 移动端**默认展开**（让他们看到完整状态）

### 2.4 自动深色模式
- `@media (prefers-color-scheme: dark)` 跟系统偏好

---

## 3. 部署到 Tencent COS

### 3.1 创建 / 找到主域 bucket
- Domain: `u-agents.u-studio.cn`
- 你现在用的 COS bucket 跟 `update.u-agents.u-studio.cn` 是分开的 bucket（一个是更新服务器，一个是主域下载页）
- 如果还没建主域 bucket：
  1. COS 后台 → 新建 bucket → region 选香港或新加坡（国内访问 + 海外稳定平衡）
  2. bucket 命名建议：`u-agents-website`
  3. 权限设置：**公有读私有写**（静态网站托管必需）
  4. 开启"静态网站"功能：默认首页 = `index.html`，错误文档 = `index.html`（SPA 兼容）
  5. 绑定自定义域名 `u-agents.u-studio.cn`
  6. 配置 SSL 证书（Tencent 提供免费 DV 证书）

### 3.2 上传 index.html

**方法 A — COS 后台手动上传**：
1. 打开 bucket
2. 上传 → 选择 `web/download-page/index.html`
3. 上传到根目录（路径 `/index.html`）
4. **关键**：上传完成后，在该文件的"权限"页确认是"继承 bucket 公共读"
5. **关键**：检查"元数据" → `Content-Type` 必须是 `text/html; charset=utf-8`

**方法 B — rclone 上传**（推荐，可重复执行不会出错）：

假设你已配置 rclone remote 名 `tencent-cos`（同 06 §3 配置）：

```bash
# 从仓库根目录执行
rclone copyto web/download-page/index.html \
  tencent-cos:u-agents-website/index.html \
  --header-upload "Content-Type: text/html; charset=utf-8" \
  --header-upload "Cache-Control: public, max-age=300, must-revalidate" \
  -v
```

⚠️ **必须用 `copyto` 不要用 `copy`** — `copy` 会把 index.html 当成"目录里的文件"上传，路径会变成 `index.html/index.html`（同 06 §4.2 教训）。

### 3.3 CDN 刷新（重要）

如果你用了 Tencent CDN 加速（推荐）：

```bash
# 用 Tencent CLI 或 Tencent CDN 后台
# 方法一：CDN 后台 → 缓存刷新 → 输入 https://u-agents.u-studio.cn/index.html → 提交
# 方法二：用 Tencent CLI
tccli cdn PurgeUrlsCache --Urls '["https://u-agents.u-studio.cn/index.html","https://u-agents.u-studio.cn/"]'
```

不刷 CDN，用户可能 1-24 小时内拿到旧版（取决于 cache TTL）。

---

## 4. 验收清单（每次更新 index.html 必跑）

### 4.1 浏览器验收
- [ ] 打开 https://u-agents.u-studio.cn/
- [ ] 在 Apple Silicon Mac 上看到「推荐 macOS Apple Silicon · v0.9.2 · arm64」
- [ ] 点"下载"按钮 → 跳到 `update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg` 开始下载
- [ ] 在 Windows 上看到「推荐 Windows x64 · v0.9.2 · x86_64」
- [ ] 点"查看所有平台" → 表格展开，4 行平台清晰
- [ ] 移动端访问 → 提示"在桌面访问"
- [ ] 暗色模式自动跟随系统

### 4.2 Intel Mac 验收（关键，需要找一台 Intel Mac 实测或用 Chrome devtools 模拟）

**模拟方法**（Chrome devtools）：
1. F12 → Console
2. 粘贴：`Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });`
3. 刷新页面（Cmd+R）
4. WebGL 检测会基于真实硬件——若你在 Apple Silicon 上模拟，WebGL 仍报 Apple GPU，无法 100% 模拟 Intel
5. **最可靠**：找一台 Intel Mac 实测

**实测预期**：
- [ ] 推荐卡隐藏
- [ ] 顶部出现 ⚠️ Intel Mac 警告 banner
- [ ] 显示备用「下载 Windows 版」按钮
- [ ] "所有平台"表格默认展开

### 4.3 链接验收
- [ ] arm64 dmg 链接：`https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg` → 200 OK
- [ ] x64 exe 链接：`https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe` → 200 OK
- [ ] github craft-agents-oss 链接：可访问
- [ ] U-API 中转站链接 `https://token.u-studio.cn` → 可访问

### 4.4 SEO / 元数据
- [ ] `<title>` = `U Agents 优智体 — 下载`
- [ ] meta description 含 "U-API 中转站"
- [ ] 中文 lang 标签：`<html lang="zh-Hans">`

---

## 5. 维护节奏

### 5.1 版本号更新（必做）
每次发新版本（v0.9.3 / v1.0 等）后，必须更新本页：

```bash
# 在 web/download-page/index.html 内 grep 替换
sed -i '' 's/v0.9.2/v0.9.3/g' web/download-page/index.html
```

会改到 3 处：
- `<span class="version-badge" id="version-badge">v0.9.2</span>`
- `<p class="arch" id="recommended-arch">v0.9.2 · arm64</p>`
- JS 中 `'v0.9.2 · ' + arch` 拼接

然后重新跑 §3.2 上传 + §3.3 CDN 刷新。

### 5.2 新增平台（如 Intel Mac 在 v0.9.3 补齐）
1. 编辑 §4.1 表格，把 Intel Mac 行的"v0.9.3 计划"改为"推荐"+ 加下载链接
2. 编辑 JS 中的 `isIntelMac` 分支：从"显示警告"改为"推荐 x64 dmg"
3. 测试 4.2 Intel Mac 验收

### 5.3 新平台 release notes
本页**只**显示当前最新版本。若用户想查历史版本，引导到 `https://update.u-agents.u-studio.cn/v0.9.2/`、`https://update.u-agents.u-studio.cn/v0.9.3/` 等归档目录（详见 06 §3.4）。

---

## 6. 常见问题

### Q1: 上传后 https://u-agents.u-studio.cn/ 返回 403？
- 检查 bucket 权限：必须是"公有读"
- 检查"静态网站"功能是否开启
- 检查 index.html 的"权限"是否继承 bucket 公共读

### Q2: 上传后页面是 XML / 乱码？
- Content-Type 设置错误。重新上传时加 `--header-upload "Content-Type: text/html; charset=utf-8"`

### Q3: 改了 HTML 但页面没更新？
- CDN 缓存。跑 §3.3 CDN 刷新
- 浏览器缓存。Cmd+Shift+R 强刷

### Q4: 我能不能让本页也跑客户端 telemetry（统计下载次数）？
- 当前不行——M3-4 接入 GlitchTip / Plausible 后再加
- 临时方案：看 COS 流量统计 → arm64.dmg / x64.exe 的 download count

---

## 7. 不在本页做的事（避免范围蔓延）

| 想做但不做 | 不做的理由 |
|---|---|
| 多语言版本（英文） | M3 后期再加 — 当前用户群 95% 中文 |
| 更新日志页（changelog） | 跳到 GitHub Releases 看就好 — 我们没准备做单独的 changelog 站 |
| 用户登录 / 客户端 | 桌面应用，没账号体系 |
| 文档站 | 那是 M3 单独的 docs.u-agents.u-studio.cn 域名 — 在 11-roadmap M3-2 |
| 站内搜索 | 单页应用，没必要 |
