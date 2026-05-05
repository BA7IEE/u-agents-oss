# M1 性能基准（v0.9.0+u-agents.1，含 SDK）

**目的**：建立 M1 阶段性能基准，未来上游同步 + hotfix 后对照检测回归
**对应**：M1 出口判定 §4 第 11 项（首发当日报告标 ⏸ 后补）+ [09-test-checklist.md §16.2](09-test-checklist.md)
**测量基线**：v0.9.0+u-agents.1，含 Claude SDK binary（commit `8b8a5986` 后的本地 DMG）

---

## 1. 测量方法（用户/外部 AI 执行）

> ⚠️ **测量前提**：用本地 hotfix DMG 装一遍（不是 R2 上的旧版）
> - 路径：`/Users/dengwang/Documents/u-agents-oss/u-agents/apps/electron/release/U-Agents-arm64.dmg`
> - 装到 Applications 后用 macOS 工具（Activity Monitor / time / iostat）测

### 测量环境

| 项 | 值 |
|---|---|
| Mac 型号 | _填如 MacBook Pro 14" M3 / Mac mini M2 等_ |
| macOS 版本 | _填如 26.4 (Tahoe)_ |
| 内存总量 | _填如 16 GB / 32 GB_ |
| 本地 disk 空闲 | _填如 100 GB / 50 GB_ |
| U-API Token 状态 | _配好且能发消息_ |
| 测量日期 | 2026-05-05 |
| 测量人 | _user / 外部 AI_ |

### 6 个指标 + 测量方法

#### M1 启动时间（cold start）

```bash
# 方法 1：手测秒表（推荐，简单）
# 双击 .app → 看到主窗口出现的时间

# 方法 2：精准
killall "U Agents" 2>/dev/null; sleep 2
time open -W -a "U Agents" &
sleep 8 && killall "U Agents"
# 看 real time
```

**测量值**：____ 秒

**期望范围**：≤ 5 秒（含 SDK 后可能比无 SDK 慢 0.5-1 秒，因为 SDK 包文件多）

---

#### M2 内存峰值（启动后 idle 30 秒）

```bash
# 启动应用 → 等 30 秒（让 lazy init 完成）→ 跑：
ps -o rss= -p $(pgrep -f "U Agents.app/Contents/MacOS" | head -1) | awk '{printf "%.0f MB\n", $1/1024}'
# 或用 Activity Monitor → 找 "U Agents" 进程组（main + renderer + GPU + utility）总和
```

**测量值**：____ MB（main 进程）/ ____ MB（全进程组）

**期望范围**：单进程 ≤ 300 MB，全进程组 ≤ 800 MB（Electron 多进程模型典型）

---

#### M3 首条消息延迟（cold → 第一条 AI 回复）

```bash
# 手测：从启动应用到看到 AI 回复第一个 token 的总时间
# 步骤：
# 1. 装新 DMG → 走 onboarding → 配 Token + model
# 2. 关闭应用
# 3. 双击重启 → 等主界面
# 4. 输入"你好" → 回车 → 计时到出现首个回复 token
```

**测量值**：____ 秒

**期望范围**：≤ 8 秒（含网络往返 + LLM TTFT；token.u-studio.cn 国内延迟 200-500ms）

---

#### M4 DMG 大小

```bash
ls -lh /Users/dengwang/Documents/u-agents-oss/u-agents/apps/electron/release/*.dmg
```

**测量值**：
- arm64.dmg：**223 MB**（含 SDK，5/5 13:34）
- x64.dmg：**230 MB**（含 SDK）

**对照旧版**（无 SDK）：
- arm64.dmg：162 MB
- x64.dmg：168 MB

---

#### M5 CPU idle（启动后 60 秒，无操作）

```bash
# 启动应用 → 等 60 秒 → 跑：
top -l 5 -pid $(pgrep -f "U Agents.app/Contents/MacOS" | head -1) -stats cpu | tail -5
# 取 5 个采样的中位数
```

**测量值**：____ % CPU

**期望范围**：< 2% idle（如果 ≥ 5% 说明有 background loop / polling 异常）

---

#### M6 磁盘占用（包括 ~/.u-agents/）

```bash
du -sh "/Applications/U Agents.app" ~/.u-agents
```

**测量值**：
- .app: ____ MB
- ~/.u-agents/（首次 onboarding 后）：____ MB

**期望**：
- .app ≈ 600-800 MB（含 SDK + bun + pi-agent-server + Electron）
- `~/.u-agents/` 首启 ≤ 5 MB（仅 config + 加密凭证；session 历史按使用增长）

---

## 2. 测量记录表

测量完毕后填本表（v0.9.0+u-agents.1，含 SDK，2026-05-05 基线）：

| 指标 | 测量值 | 期望 | 评估 |
|---|---|---|---|
| M1 启动时间 | ____ s | ≤ 5s | ✅/⚠️/❌ |
| M2 内存峰值（main / 全进程组）| ____ / ____ MB | ≤ 300 / ≤ 800 | |
| M3 首条消息延迟 | ____ s | ≤ 8s | |
| M4 DMG 大小 | arm64 223 / x64 230 MB | - | ✅ 已记录 |
| M5 CPU idle | ____ % | < 2% | |
| M6 .app + ~/.u-agents 磁盘 | ____ / ____ MB | ≤ 800 / ≤ 5 | |

---

## 3. 用法（未来上游同步后）

每次上游同步成功后，重打 DMG 装上重测一次，**对照本表**。任一指标超出期望范围 1.5 倍 → 写 P1 issue 调查（多半是上游引入了启动期 fetch / background polling）。

> **大幅恶化判定**：M1 ≥ 8s / M2 main ≥ 500MB / M3 ≥ 15s / M5 ≥ 5% / M6 .app ≥ 1.2 GB —— 任一项触发都需停下逐项分析。

---

## 4. 与无 SDK 版本对照（参考）

历史比较：
- v0.9.0 首发版（5/4 22:18，无 SDK）：DMG arm64 162 MB
- v0.9.0+u-agents.1 中间版（5/5 12:28，无 SDK + hotfix 内容）：DMG arm64 162 MB
- **v0.9.0+u-agents.1 含 SDK**（5/5 13:34，本基线）：DMG arm64 **223 MB**

启动时间 + 内存方面 SDK 是 lazy load（只在调 Claude SDK query 时才进内存），所以 M1/M2/M5 三项**理论不会因 SDK 增大而恶化**。M4/M6（磁盘相关）必然增大。

---

## 5. 完成判定

- [ ] 装本地 DMG（路径见 §1）
- [ ] 跑 onboarding + 发首条消息 OK
- [ ] 6 个指标全部测出
- [ ] §2 表填完
- [ ] 写完后此处勾选 + commit

完成后 [M1-FIRST-RELEASE.md](sync-reports/M1-FIRST-RELEASE.md) 14 项里第 11 项可标 ✅，M1 实质完成度从 12/14 → 13/14（剩"网站下载页"）。
