# M1 v0.9.0 首发种子分发清单

**生效日期**：2026-05-04（首发）/ 2026-05-05（重打 hotfix）
**版本**：v0.9.0+u-agents.1（commit `161e0938` 基线，含 6 轮 review + hotfix）

> ⚠️ R2 上的 DMG/EXE 已本地重打为 hotfix 版（5/5 12:28），新 sha512 见 [M2-REBUILD-HOTFIX-2026-05-05.md](sync-reports/M2-REBUILD-HOTFIX-2026-05-05.md)。R2 上传 + Windows 重打**待 user 执行**，完成后此处更新 sha512 并标 ✅。
**目标**：把首批 DMG 投放给受信任的种子用户，验证白标改造在真实环境无回归，收集首批反馈。

---

## 1. 分发产物

### 1.1 下载链接（已上线）

| 平台/架构 | 下载直链 | 大小 | 用途 |
|---|---|---|---|
| macOS Apple Silicon (M1/M2/M3/M4) | `https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg` | 162 MB | **macOS 推荐** |
| macOS Intel | `https://update.u-agents.u-studio.cn/latest/U-Agents-x64.dmg` | 168 MB | 已知限制：bun 二进制仍是 arm64，Intel 上跑会触发 Rosetta，性能折损 |
| Windows x64 | `https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe` | 169 MB | **Windows 推荐**（M2 新增，2026-05-04 上线）|

> ⚠️ Intel Mac 用户请在分发前**主动告知**性能限制；如反馈不可接受，后续补 x64 原生 bun。
> 自动更新清单：macOS 走 `latest-mac.yml`，Windows 走 `latest.yml`。

### 1.2 校验

让用户拿到安装包后可选执行：

```bash
# macOS
shasum -a 512 ~/Downloads/U-Agents-arm64.dmg | base64
# 对比 https://update.u-agents.u-studio.cn/latest/latest-mac.yml 中的 sha512

# Windows (PowerShell)
Get-FileHash -Algorithm SHA512 .\U-Agents-x64.exe
# 对比 https://update.u-agents.u-studio.cn/latest/latest.yml 中的 sha512
```

---

## 2. 种子用户名单

| 序号 | 姓名/代号 | 联系方式 | 设备架构 | 用途场景 | 发送日期 | 反馈状态 |
|---|---|---|---|---|---|---|
| 1 | _待填_ | _待填_ | _arm64/x64_ | _测试方向_ | _yyyy-mm-dd_ | _未发/已发/已反馈_ |
| 2 | | | | | | |
| 3 | | | | | | |

> 建议首批控制在 **3-5 人**，覆盖 arm64 + x64 + 不同熟练度层级。

---

## 3. 给种子用户的安装说明（可直接转发）

> 复制下面这段发给用户即可。

---

### 安装 U Agents（优智体）v0.9.0

**1. 下载**

- **Apple Silicon Mac**（M1/M2/M3/M4）：[U-Agents-arm64.dmg](https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg)
- **Intel Mac**：[U-Agents-x64.dmg](https://update.u-agents.u-studio.cn/latest/U-Agents-x64.dmg)（性能略受限）
- **Windows x64**：[U-Agents-x64.exe](https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe)

不确定自己 Mac 是哪种？点左上角苹果图标 → 关于本机，看"芯片"那一栏：写"Apple M..."就是 arm64，写"Intel"就是 x64。

**2. 安装（macOS）**

双击 DMG → 把 "U Agents" 拖到 Applications 文件夹。

**2-Win. 安装（Windows）**

双击 `U-Agents-x64.exe` → 按提示走完 NSIS 安装向导 → 默认装到 `C:\Users\<你>\AppData\Local\Programs\u-agents\`。

**3. 首次启动（macOS：处理 Gatekeeper 警告）**

由于本应用未做 Apple 公证，**直接双击会被拒绝**。请按以下步骤启动：

1. 打开 **访达** → **应用程序**，**右键点击** "U Agents" → 选 **打开**
2. 弹出"无法验证开发者"对话框 → 点 **打开**
3. 之后每次启动可以正常双击

如果第 1 步右键也没"打开"选项：

1. 系统设置 → 隐私与安全性 → 滚到底
2. 看到 "已阻止 U Agents..."的提示 → 点 **仍要打开**

**3-Win. 首次启动（Windows：处理 SmartScreen 警告）**

由于本应用未做 Microsoft 代码签名，**首次双击会弹"Windows 已保护你的电脑"**。请按以下步骤启动：

1. 弹窗里点 **更多信息**
2. 出现 **仍要运行** 按钮 → 点击即可启动
3. 之后每次启动正常双击（Windows 会记住你的选择）

**4. 配置 Token**

首次启动会进入引导流程：

- 选 **U-API**（应用内置且默认选项）
- 粘贴你的 Token（由我直接发给你）
- 选模型 → 完成

**5. 发送第一条消息**

引导流程结束后会进入主界面，输入框打字 → 回车，确认能正常返回回复。

---

### 反馈方式

测试时遇到任何问题——崩溃、卡顿、文案怪、连不上、UI 错位——请按下面格式发我：

- **现象**：（一句话描述发生了什么）
- **重现步骤**：（怎么操作触发的）
- **截图**：（如果可以）
- **设备**：Mac 型号 + 系统版本
- **应用版本**：v0.9.0

---

## 4. 反馈跟踪

### 4.1 已知瑕疵（无需重复反馈）

| 项 | 状态 |
|---|---|
| Intel Mac 性能受 Rosetta 影响 | M1 已知限制，M1 后补原生 x64 bun |
| 应用未公证（macOS），首次启动需右键打开 | M1 已知限制，M3+ 评估 Apple 开发者账号 |
| Windows 未代码签名，首次启动有 SmartScreen 警告 | M2 已知限制，M3+ 评估 EV 代码签名证书 |
| 第三方 OAuth Source（Slack/Gmail）首次授权浏览器地址栏闪现 `agents.craft.do` | M3 自建 relay 解决 |
| 部分设置/日志面板英文 | M2 中文化阶段处理 |

### 4.2 反馈分类

收到反馈后按下表分类记录到 `.planning/sync-reports/M1-FEEDBACK.md`（待创建）：

| 类别 | 处理方式 |
|---|---|
| **崩溃/无法启动** | P0 立即排查，必要时 hotfix 重打 v0.9.0+u-agents.1 |
| **LLM 请求失败/连接错误** | P0，先排查 token.u-studio.cn 侧还是客户端侧 |
| **品牌泄露（界面看到 Craft/craft.do）** | P1，记入 `.planning/sync-reports/M1-LEAKS.md`，下个版本批量改 |
| **中文文案问题** | P2，并入 M2 中文化任务 |
| **功能缺陷/UX 问题** | P2，评估是否上游既有问题 |
| **新功能建议** | P3，记入 `.planning/wishlist.md`（待创建） |

### 4.3 Hotfix 触发条件

只有 P0 级别（崩溃 / 无法启动 / LLM 完全不通）才触发 hotfix 重打包。版本号规则：`0.9.0+u-agents.1`、`0.9.0+u-agents.2`...（SemVer build metadata，详见 01 §4.1）。

---

## 5. 分发执行节奏

| 阶段 | 时间 | 动作 |
|---|---|---|
| **T+0** | 当天 | 发给前 1-2 个最紧密的种子用户，观察 24-48 小时 |
| **T+2 天** | 无 P0 反馈则 | 扩展到剩余种子用户 |
| **T+1 周** | 收齐反馈 | 评估是否需 hotfix；无则保留 v0.9.0，开始 M2 |
| **T+2 周** | 反馈窗口关闭 | M1 阶段总结写入 `.planning/sync-reports/M1-CLOSURE.md` |

---

## 6. 检查清单（首次发送前必跑）

- [ ] DMG 直链 `curl -I` 返回 200
- [ ] `latest-mac.yml` 可访问且 version 正确
- [ ] 你自己的 Mac 上完成全新安装 + onboarding + 首条消息（验证一次端到端）
- [ ] Token 已为种子用户准备好（newapi 后台开通账号 + 配额）
- [ ] 安装说明文案最后通读一遍，没错别字
- [ ] 反馈渠道（微信/邮箱/issue 链接）确定并写在说明里

---

## 7. 后续衔接

- 本次反馈窗口结束后 → 写 `.planning/sync-reports/M1-CLOSURE.md`，记录"M1 是否实质达成所有出口判定"
- M2 启动条件：M1 无 P0 反馈 + 性能基准已记录
- 性能基准模板：`.planning/perf-baseline-M1.md`（M1 后补）
