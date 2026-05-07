# Review v26 — 重打 readiness 综合 review（2026-05-07）

**Review 焦点**：用户决定重打 macOS arm64 + Windows EXE（不补 x64 / Linux），全方位 readiness 评估
**总评**：**B+**（核心链路就绪；1 项**新发现 P0** + 3 项 P1 待解决）
**HEAD**：`f6ce25a7`（worktree + main + origin/main 三处一致）

> v25 是决策 review；v26 是**决策后 readiness 实证**——专门找"开始打包前应当解决的问题"。

---

## 0. 5 Agent 评级

| Agent | 焦点 | 评级（修正后）| 备注 |
|---|---|---|---|
| **L1** macOS arm64 readiness | **B+** | 13/16 项达标，3 阻塞均已知 SOP 化 |
| **L2** Windows EXE readiness | **A** | build-win.ps1 完整，待用户准备 Windows 机 |
| **L3** R2 + 自动更新链路 | **B+ ⚠️** | **抓到 P0 新发现：arm64-only latest-mac.yml 覆盖会丢 x64 entry** |
| **L4** 文档自洽全核 | **A**（修正） | L4 原报 C+ 是因 worktree 落后 main 看到"虚构"；ff 后所有引用解锁 |
| **L5** 下次同步顺畅度 | **A−**（修正） | 双源不一致问题在 ff 后消失 |

---

## 1. ⚠️ 关键修正：worktree 落后 main 导致 L4/L5 误判

**v26 review 启动时**：worktree HEAD = `7c9cce68`（v23 P1 follow-up），main HEAD = `f6ce25a7`（v24 完整）—— **worktree 落后 main 6 commit**。

**L4 / L5 在 worktree 上跑 grep 看到**：
- §3.7 主基线 = 73（不是 v24 后的 82）
- 04-feature-cuts.md 无 §九类 browser tool
- 09-test-checklist.md 无 §13.8 sync 报告必备贴片
- api-tools.ts 无 `redirect: 'manual'`

**这让 L4 报告判断"REVIEW-25 大量虚构 v24 引用"——但实际上 v24 改动真实存在（在 main 分支 + origin/main 上），只是 worktree 这个 feature branch 未跟上。**

**修复**：`git fetch origin && git merge origin/main --ff-only` → worktree 现 = main = origin/main = `f6ce25a7`。

ff 后实证：
- §3.7 主基线 = **82** ✓
- 04 第九类 = ✓
- 09 §13.8 = ✓
- api-tools redirect:'manual' = ✓
- v25 untracked 报告保留 ✓ → 已 commit `00138a46`

**教训**：worktree 是 git 的独立 work tree，必须显式 `git merge origin/main`，否则文档/代码视角与 main 不一致。建议**重打前必跑** `git pull --ff-only origin main`（或等价 ff merge）作为硬校验第一步。

---

## 2. 真问题清单（按严重度）

### 🔴 L3.F12-F15 [P0 新发现] arm64-only 会让 Intel Mac 用户卡在 v0.9.1

**问题**：`bun run dist:mac` 默认生成完整 mac yml（含 arm64 + x64 entries）。但我们只跑 `dist:mac:arm64` → 生成的 yml 只含 arm64 entries → 上传覆盖 `/latest/latest-mac.yml` 后：

| 用户 arch | v0.9.1 R2 状态 | v0.9.2 重打后 R2 状态 | electron-updater 行为 |
|---|---|---|---|
| arm64 | latest-mac.yml 含 arm64 entry → 拉到 v0.9.1 | latest-mac.yml 含 arm64 entry → 拉到 v0.9.2 | ✓ 自动更新成功 |
| x64 | latest-mac.yml 含 x64 entry → 拉到 v0.9.1 | latest-mac.yml **不含** x64 entry → 找不到匹配 | ❌ "无可用更新"或 download 404 |

**风险评级**：**P0**（让 Intel Mac 用户的自动更新链路实际损坏）

**3 个缓解方案**：

| 方案 | 操作 | 风险 |
|---|---|---|
| **D-α 手工补 x64 entry** | 重打 arm64 后**手编 latest-mac.yml**：把 v0.9.1 的 x64 entry（含原 sha512 + size）保留下来，仅替换 arm64 entry | sha512 / size 计算手动易出错 → Intel 用户拉到的 x64 文件 sha 校验失败 |
| **D-β 接受 Intel 用户暂不更新** | 直接覆盖 latest-mac.yml 为 arm64-only → Intel 用户看到"无可用更新"（不报错只是不升）| Intel 用户卡 v0.9.1 直到 macOS x64 重打。简洁但用户体验差 |
| **D-γ 不动 latest-mac.yml** | v0.9.2 包传到 `/v0.9.2/` 归档目录，但 **不覆盖** `/latest/latest-mac.yml` → 所有用户继续用 v0.9.1 自动更新；新装机用户从下载页可以选 v0.9.2 arm64 | 用户得不到自动更新（与"立即重打"目的违背）|

**推荐 D-β**：理由——
- arm64 用户能自动更新到 v0.9.2（核心目的达成）
- Intel 用户不损坏（只是不升级，仍能用 v0.9.1）
- 操作简单不易出错
- 等用户拿到 x64 机器后单独打 x64 + 补 latest-mac.yml entry

### 🟡 L1.F11 [P1] electron-builder.yml v0.9.2 SDK extraResources 新结构

v0.9.2 上游把 SDK 接入方式改了（`mac.extraResources` 增 `from: node_modules/@anthropic-ai/claude-agent-sdk-binary`）。这要求**SDK 必须先 stage 到 `apps/electron/node_modules/`**，否则 electron-builder 找不到路径直接 fail。

**操作选项**：

| 操作命令 | SDK stage 行为 | batman keychain 兼容 |
|---|---|---|
| `cd apps/electron && bun run dist:mac` | 调 build-dmg.sh 自动 stage | ❌ 撞 batman 证书报错（除非 export `CSC_IDENTITY_AUTO_DISCOVERY=false`）|
| `bun run electron:dist:adhoc:mac` | **不 stage**（你需手动复制）| ✓ CSC=false 自带 |

**推荐**：用 `cd apps/electron && CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac`——既自动 stage 又绕过 batman。这是 M2-REBUILD-WITH-SDK §1 已 SOP 化的方式。

### 🟡 L1.F3 [P1] keychain `com.justiceleague.batman` 证书干扰仍可复发

证书未清理，与 v0.9.1 重打时同根。Workaround 已 SOP（CSC env var），但每次重打仍要记得设。

**长期 fix**：去 macOS 钥匙串删 batman 证书。**短期**：CSC env var 兜底足够。

### 🟡 L2.F11 [P1] Windows 机器待用户准备

用户工作机是 Mac，必须找 Windows 机器/VM。可选项：

| 选项 | 可行性 | 时长 |
|---|---|---|
| Parallels/VMware Win11 VM | 最便捷 | VM 装好后 ~30min build |
| 远程 Windows 机器（同事/家人/云）via RDP | 需协调 | 不定 |
| GitHub Actions Windows runner | repo 当前未配 win build workflow | 需先写 workflow |

**推荐**：用户决定。如已有 Win VM 最佳。

---

## 3. P2 改进项（不阻塞重打）

### L1.F19 [P2] vendor binary 3 条非阻塞 warning（已知）

`apps/electron/vendor/codex/win32-x64`、`vendor/copilot/win32-x64`、`resources/bin/win32-x64` 缺失会出 warning（非 error）。M2 deferred，不影响主链路。

### L3.F1 [P2] 06-update-server.md misnomer

文档全文称 R2 但实际是腾讯云 COS（REVIEW-18 §2.1 实证）。重打操作时凭证类型不同——用户重打前应核对凭证位置 + 命令是 rclone（R2）还是 cos-cli（腾讯）。

### L3.F8 [P2] CDN cache flush SOP 缺路径

M2-REBUILD-HOTFIX §5 教训：上传 yml 后 CDN 不刷会发送旧 sha512。文档未明确腾讯 COS 控制台路径。重打时易踩——但上次（v0.9.1）已实战过，用户应记得操作路径。

### L3.F19 [P2] `apps/electron/scripts/upload.ts` 不存在

`build-dmg.sh:294` + `build-linux.sh:253` 引用的 upload 脚本根本没写。**user 必须用 rclone / cos-cli 手工流程**，不能用 `--upload` flag。

### L3.F17 [P2] R2 凭证位置文档缺失

v0.9.1 重打时凭证存哪里没明确文档化。重打前应核对凭证仍可用。

---

## 4. 重打 readiness 总览

| 维度 | 状态 |
|---|---|
| origin/main 代码层 | A（worktree ff 后三处同步 = `f6ce25a7`）|
| §3.7 marker 基线 | A（82/9/9 全对位）|
| 测试 | A（2865 pass / 0 新引入 fail）|
| build-dmg.sh / build-win.ps1 | A（5 步流水线 step 全闭环）|
| macOS arm64 SDK stage | B+（SOP 已知，需 CSC env var）|
| Windows 机器 | 待用户准备 |
| R2 / 自动更新链路 | **B**（**arm64-only latest-mac.yml 风险，需选 D-β**）|
| 文档自洽 | A（worktree ff 后引用解锁）|
| 下次 sync 顺畅度 | A−（v0.9.3 patch 30-60min；v0.10.0 minor 2-4h）|

---

## 5. 推荐执行顺序（**重打前必跑** + **方案 D-β**）

### 阶段 0：worktree 同步硬校验（已完成 ✓）

```bash
# 已在 v26 review 中完成
git fetch origin
git merge origin/main --ff-only
# worktree HEAD = f6ce25a7 ✓
```

### 阶段 1：Pre-rebuild 验证（30min）

```bash
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git status                              # 应干净
bun run typecheck:all                   # 应全绿
bun run validate:ci                     # 应全绿
bun test packages/shared 2>&1 | tail -5 # 应 2865 pass / 0 新引入 fail
# §3.7 marker 基线
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望 82
```

### 阶段 2：macOS arm64 重打（30-40min）

```bash
# 干净 build
bun run electron:clean
bun run electron:build

# adhoc 签名 + SDK stage（避开 batman 证书）
cd apps/electron
CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac
# 输出 release/U-Agents-arm64.dmg + latest-mac.yml（**注意**：含 arm64 entry，**不含 x64 entry**）

# 装机实测
xattr -dr com.apple.quarantine /Applications/U\ Agents.app
# 启动 → onboarding → 输 Token → 选协议 → 输 model → 首条对话验证
# 验证 SSRF 防护：grep "redirect: 'manual'" release/.../app/dist/main.cjs
# 验证 browser tool 默认 false：设置页 Tools section toggle 应是 off
```

### 阶段 3：Windows EXE 重打（30-45min）

```powershell
# 在 Windows 机器/VM 上
cd apps/electron
bun run dist:win
# 输出 release/U-Agents-Setup-x64.exe + latest.yml

# 装机实测
# - SmartScreen 警告 → "更多信息" → "仍要运行"
# - onboarding → 首条对话
# - 自动更新链路（v0.9.1 → v0.9.2）
```

### 阶段 4：R2 上传 + latest yml 处理（30min，**方案 D-β**）

```bash
# 1. 归档版本目录（保留历史）
rclone copy release/ r2:u-agents-update/v0.9.2/ \
  --include "U-Agents-arm64.dmg" --include "U-Agents-arm64.dmg.blockmap" \
  --include "U-Agents-Setup-x64.exe" --include "U-Agents-Setup-x64.exe.blockmap"

# 2. **方案 D-β：覆盖 /latest/latest-mac.yml 为 arm64-only**
#    Intel 用户看到 "无可用更新"，但不损坏（仍能用 v0.9.1）
rclone copyto release/latest-mac.yml r2:u-agents-update/latest/latest-mac.yml
rclone copyto release/latest.yml r2:u-agents-update/latest/latest.yml

# 3. CDN cache flush（腾讯云 COS 控制台 → 域名 → 刷新 CDN）
# 不刷会发送旧 sha512 错配 latest-mac.yml
```

### 阶段 5：Post-验证（30min）

```bash
# 1. 干净机器自动更新测试（macOS arm64 + Windows）
#    装 v0.9.1 → 等 30-60 秒应弹 "发现新版本 v0.9.2"

# 2. SSRF 实证（v24 真修验证）
#    构造测试 source: baseUrl=https://attacker.com → 模拟 302 → 应被 isError 拦截

# 3. 写 SYNC-v0.9.2-REBUILD-RELEASE-20260507.md
#    含 09 §13.8 必备贴片（7 块 grep 输出）
```

---

## 6. 综合判断

**可以开始重打**——如果用户接受方案 D-β（Intel 用户暂不自动更新）。

**不能开始重打**的情况：
- 用户希望 Intel 用户也能自动更新 → 需要先解决 macOS x64 实测（找 Intel Mac）
- 用户不接受 SDK stage workaround → 需要先清 batman keychain 证书

**总预估时长**（不重要，但记录）：~3h（含全部验证）

---

## 7. v8-v26 review 体系演化

```
v8-v17  防御性 review    (14 真 P0 关闭)
v18-v20 深度 review       (9 项新 finding)
v21     发布后稳态盘点
v22     5 项代码层落地
v23     10-Agent 多智能体扫描 (88 finding)
v24     7-Agent 复盘 (4 真 P0)
v24-A+B+C 4 P0 + 4 P1 全解决
v25     重打决策 review (推荐 D 折衷)
v26     重打 readiness 综合 (抓到 L3.F12 P0 新发现)
```

**v26 真新价值**：
1. 抓到 worktree 落后 main 的事实（修复 L4/L5 误判基础）
2. 抓到 arm64-only latest-mac.yml 覆盖丢 x64 entry 的 P0（v25 决策 review 漏盘）
3. 给出 D-β 缓解方案（让 arm64 用户立即受益 + Intel 用户不损坏）

---

## 8. 等待用户决定

需要你确认：

1. **接受方案 D-β（arm64 自动更新到 v0.9.2，Intel 用户暂不动）吗？**
2. **Windows 机器准备好了吗？**（Parallels VM / 远程 / 同事机器）
3. **batman keychain 证书清理 vs 用 CSC env var 兜底——选哪个？**
4. **R2 凭证位置确认了吗？**（rclone config / 腾讯 COS）

确认 1+2 后我可以帮你 commit v26 报告 → 你/外部 AI 跑打包流程。

---

**v26 commit**：仅 .md 报告 + worktree ff 操作（`git merge origin/main`，已完成），无代码改动。

**下次 review（v27）触发条件**：
- 重打完成后 release 报告核（事件驱动）
- 或 v0.9.3 上游发版（事件驱动）
- 或 M3-1 OAuth relay 部署（事件驱动）
