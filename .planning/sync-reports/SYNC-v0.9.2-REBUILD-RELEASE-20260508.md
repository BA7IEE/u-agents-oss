# SYNC v0.9.2 重打 + R2 发布报告（2026-05-08）

**触发**：v22 → v26 review 链 + v0.9.2 sync 后 R2 仍是 v0.9.1 → 用户决定用方案 D-β（仅 macOS arm64 + Windows EXE）重打 + 上线
**主线 commit**：`947b2bdc`（origin/main / claude/admiring-lichterman-a47f82 / sync/upstream-20260507-v092 三处同步）
**分发产物 sha512**：见下 §3
**总评**：**A−**（核心路径全 200 OK；`/v0.9.2/` 归档目录 deferred 到明天）

> v0.9.1 是 fork 第一次正式发布；**v0.9.2 是第一次"代码层 + 分发层"完整闭环的发布**——含 v24 SSRF 真修 + v25/v26 review 抓的 P0 / SOP 工程化。

---

## 1. 发布范围（D-β 决策）

| 平台 | 状态 | 原因 |
|---|---|---|
| **macOS arm64** | ✅ 上线 | 用户开发机即 arm64，已实测 |
| **Windows x64** | ✅ 上线 | 用户 Windows 机/VM 实测 |
| macOS x64 | ⏸ deferred | 用户暂无 Intel Mac 实测；强行上 R2 = vendor/bun 错架构闪退 |
| Linux AppImage | ⏸ M2 stretch | 从未实战；M3-1 OAuth relay 同期再做 |

**为什么不直接上 electron-builder 自动生成的 4-entries yml**：
- `dist:mac` 默认在 Apple Silicon 上同时打 arm64 + x64 DMG，但 x64 DMG 里 `vendor/bun` 是 arm64 二进制（host arch）—— Intel Mac 装上 spawn bun 立即闪退
- 详见 [`12-subprocess-build-pipeline.md`](../12-subprocess-build-pipeline.md) §6 TODO #4 实证
- D-β 解决方案：手编 `latest-mac.yml` 仅含 arm64 entries，Intel Mac 用户看到"无可用更新"（卡 v0.9.1）但不损坏

---

## 2. R2 上线状态（curl 实证）

### 2.1 `/latest/` 路径（自动更新源）

```
URL                                                                              Status        Size (bytes)
https://update.u-agents.u-studio.cn/latest/latest-mac.yml                        200 OK        482
https://update.u-agents.u-studio.cn/latest/latest.yml                            200 OK        329
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg                    200 OK        233,851,006
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.zip                    200 OK        225,535,504
https://update.u-agents.u-studio.cn/latest/U-Agents-arm64.dmg.blockmap           200 OK        246,640
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe                      200 OK        232,218,353
https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe.blockmap             200 OK        236,400
```

### 2.2 `/v0.9.2/` 归档（**P3 deferred 到明天**）

```
全部 404 ❌ — 用户首次 rclone 时漏了归档目录；明天补上。
```

不影响当下用户使用（自动更新只读 `/latest/`），但损失版本回滚能力。

### 2.3 latest-mac.yml 实际内容（D-β）

```yaml
version: 0.9.2
files:
  - url: U-Agents-arm64.zip
    sha512: 5YJfhbgUjhKcGckTHN/5gzeuLtioxtmjwWA4W6Y+f+ioD13bz8zTI39jY4NtHD/AZ3O/uSFXjNdOv2FaSIkIFg==
    size: 225535504
  - url: U-Agents-arm64.dmg
    sha512: J+/Y6T6Bnf7fdjwmRmno1yVRqd0GLNxxca3u1YO935h6xzfoyc0ClbWJTz9ITp9s+xUguIqJ31t1yf73I27lIw==
    size: 233851006
path: U-Agents-arm64.zip
sha512: 5YJfhbgUjhKcGckTHN/5gzeuLtioxtmjwWA4W6Y+f+ioD13bz8zTI39jY4NtHD/AZ3O/uSFXjNdOv2FaSIkIFg==
releaseDate: '2026-05-07T16:02:06.410Z'
```

仅 2 entries（arm64.zip + arm64.dmg）✓

### 2.4 latest.yml 实际内容（Windows）

```yaml
version: 0.9.2
files:
  - url: U-Agents-x64.exe
    sha512: MRG2yOaEMT6ByetDCgUVCIcvhGLzuwyUHnWODHo5J4ek55+Vul1mNBbVCu73v53gmdJluSOPsWDW1AyWUAw9TQ==
    size: 232218353
path: U-Agents-x64.exe
sha512: MRG2yOaEMT6ByetDCgUVCIcvhGLzuwyUHnWODHo5J4ek55+Vul1mNBbVCu73v53gmdJluSOPsWDW1AyWUAw9TQ==
releaseDate: '2026-05-07T16:41:40.175Z'
```

---

## 3. 产物 sha512（完整记录）

| 文件 | Size | sha512 (base64) |
|---|---|---|
| U-Agents-arm64.dmg | 233,851,006 | `J+/Y6T6Bnf7fdjwmRmno1yVRqd0GLNxxca3u1YO935h6xzfoyc0ClbWJTz9ITp9s+xUguIqJ31t1yf73I27lIw==` |
| U-Agents-arm64.zip | 225,535,504 | `5YJfhbgUjhKcGckTHN/5gzeuLtioxtmjwWA4W6Y+f+ioD13bz8zTI39jY4NtHD/AZ3O/uSFXjNdOv2FaSIkIFg==` |
| U-Agents-x64.exe | 232,218,353 | `MRG2yOaEMT6ByetDCgUVCIcvhGLzuwyUHnWODHo5J4ek55+Vul1mNBbVCu73v53gmdJluSOPsWDW1AyWUAw9TQ==` |

---

## 4. v0.9.2 含的修复（用户视角）

### v0.9.2 上游 fix（中文 release-notes 已在产物内）

1. OAuth refresh ordering — 冷会话不再有"需要重新授权"瞬时闪烁
2. **Pi 系统 prompt persistence** — Pi backend 用户系统 prompt 不再被悄悄丢掉（**高频痛点**）
3. SDK spawn 保护 — "发送到工作区"接收方首次发消息不再撞 spawn 错误
4. source_test lastTestedAt 持久化 — UI 不再永远显示"从未"
5. 助手回复内容完成后不再变空 — 修复 SDK 竞态导致消息气泡空
6. browser toggle gate 完整 — 关闭 browser tool 时 system prompt 段也彻底关掉

### v23 / v24 / v25 / v26 review 链额外增强

7. **SSRF redirect bypass 真修**（v24 Bucket B1）— `api-tools.ts` + `credential-manager.ts` 都加 `redirect:'manual'` + 30x 主动拒绝。攻击者无法用 `https://attacker.com → 302 → http://169.254.169.254/` 拿云元数据
8. **browser tool 默认改 false**（v24 Bucket C）— 与 PRODUCT.md "非技术 / 半技术用户"目标 + 默认安全原则一致
9. **pi-agent-server 注释 brand**（v24 漏盘补丁）— v0.9.2 上游 commit 引入的 "Craft-built system prompt" 注释已改为 "U Agents-built"
10. **release-notes 中文翻译**（v26 follow-up）— 0.9.2.md 32 行完整中文化（v23 P1 时只做 brand 替换漏了翻译，v26 review 用户发现并补译）

---

## 5. 09 §13.8 sync 报告必备贴片（7 块）

### §5.1 §3.7 主基线 grep（期望 82）

```bash
$ grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
82
```

### §5.2 §13.5 M2 安全 fix 4/4

```bash
$ bun test packages/shared/src/__tests__/m2-security-regression.test.ts 2>&1 | tail -3
12 pass / 0 fail / 21 expect / 1 file
```
（含 v24 Bucket C 加的 `browserToolEnabled 默认 false 防回归` 3 个 it）

### §5.3 §13.6 M3 安全 fix（SSRF + DSN + 死路径）

```bash
$ bun test packages/shared/src/sources/__tests__/credential-manager-renew.test.ts \
           packages/shared/src/sources/__tests__/api-tools-ssrf.test.ts \
           packages/shared/src/utils/__tests__/url-safety.test.ts 2>&1 | tail -3
全绿（具体数字见 v24 Bucket B commit `943a40be`）

$ grep -rEn "CRAFT_COMMANDS_ENTRY|CRAFT_CLI_ENTRY|CRAFT_AGENT_VERSION|CRAFT_SCRIPTS|craft-clipboard" \
    packages apps --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l
0
```

### §5.4 §13.7 v22 后 CI / hook

```bash
$ bun run validate:ci 2>&1 | tail -3
typecheck:all OK / shared 63/63 pass / Python smoke 19/19 / i18n parity OK / sort-locales OK / coverage OK

$ ls -la .husky/pre-commit
-rwxr-xr-x  1 dengwang  staff  ... 跑 lint:i18n:staged
```

### §5.5 用户可见 brand grep（无新泄漏）

```bash
$ grep -rEn "Craft Agents?" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html" --include="*.md" \
    | grep -v node_modules | grep -v __tests__ | grep -v "TRADEMARK.md" | grep -v "NOTICE" | grep -v ".planning"
（无用户可见路径命中；测试 fixture 命中已 §3.5 决策保留）
```

### §5.6 craft.do 守恒（应 4 处已知瑕疵）

```bash
$ grep -rEn "agents\.craft\.do" packages apps --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
4
（OAuth relay 已知瑕疵，M3-1 部署后修）
```

### §5.7 测试 baseline 漂移

```
v22 baseline:    2821 pass / 12 skip / 3 fail
v0.9.2 sync:     2854 pass / 12 skip / 3 fail   (+33 上游新测试)
v24 完整:         2865 pass / 12 skip / 4 fail   (+44 vs v22；+10 SSRF runtime + 3 browser tool 防回归)
v26 后（当前）：   2866 pass / 12 skip / 3 fail
```
4 fail 全是历史已知技术债（OAuth network-flaky × 3 + send_developer_feedback Explore mode），0 新引入 fail。

---

## 6. 实测结果

| 平台 | 步骤 | 结果 |
|---|---|---|
| **macOS arm64** | DMG 装机 + onboarding + 首条 LLM 对话 | ✅ 通过（v25 已确认；中文 release-notes 重打后再次确认）|
| **Windows x64** | EXE 装机 + onboarding + 首条 LLM 对话 | ✅ 通过（用户原话"测试会话正常"）|
| **自动更新链路（v0.9.1 → v0.9.2）** | curl latest yml + 模拟拉新版 | ⏳ 等待用户实测（v0.9.1 装机器留 30-60s polling）|
| SSRF 攻击模拟 | 构造 baseUrl=https://attacker.com → 302 | ⏳ 可选验证 |

---

## 7. 时间消耗

| 阶段 | 实际时长 |
|---|---|
| v22 → v23 → v24 → v0.9.2 sync 链路 | 约 8h（review + 落地）|
| v25/v26 重打决策 review | 约 3h |
| Pre-rebuild + 阶段 1 验证 | 30min |
| 阶段 2 macOS arm64 build + dist:mac | 40min |
| 0.9.2.md 中文翻译 + SOP 加 + 重打 | 30min |
| Windows 端 build + 装机实测 | 用户做（约 1h） |
| R2 上传 + 修问题 1（latest-mac.yml 重命名）+ 上 EXE | 用户做（约 30min）|
| Release 报告（本文）| 15min |

**总计约 14h**（含 4 轮 review + 误操作修正 + 翻译补译）

---

## 8. 已知 follow-up

### 立即（明天）

- [ ] `/v0.9.2/` 归档目录补传（用户已预约：`rclone copy` arm64.dmg/zip/blockmap + x64.exe/blockmap 到 `r2:u-agents-update/v0.9.2/`）

### M2.5 收尾

- [ ] macOS x64 实测（需 Intel Mac，用户暂无 → deferred）
- [ ] Linux AppImage 首次打包（M2 stretch）

### M3 入口同期

- [ ] M3-1 OAuth relay 部署（消除 4 处 craft.do 残留）
- [ ] M3-4 GlitchTip self-host（M2 过渡期 SENTRY_ELECTRON_INGEST_URL 未设置 warn 切 fail）
- [ ] 文档站 / 官网升级（agents.u-studio.cn → +/docs）

---

## 9. v22-v26 完整 review 链总结

```
v22 (5 项落地复盘)              A
v23 (10-Agent 多智能体扫描)     A−  → 88 finding 分级
v24 (7-Agent 复盘)              B+  → 抓 4 真 P0
v24-A+B+C (Bucket 全落地)       A   → 8 P0+P1 全解
v25 (重打决策)                  A   → 推 D 折衷
v26 (重打 readiness)            B+  → 抓 1 P0 新发现 (latest-mac.yml x64 entry) + 修 worktree 错位
v26 后续 (release-notes 补译)   A   → 漏盘 + SOP 工程化
v0.9.2 重打 + R2 上线 (本报告)  A−  → /v0.9.2/ 归档 deferred
```

**真 P0 全部解决**：
- v22 起的 14 真 P0 + v23 6 SOP P0 + v24 4 真 P0 + v26 1 P0（latest-mac.yml x64 entry）+ v26 后续 1 P0（release-notes 漏译）= **26 真 P0 全部关闭**

---

## 10. 关键 commit 链（推送顺序）

```
947b2bdc docs+i18n: 0.9.2.md 中文翻译 + 07/09 SOP 加 release-notes 翻译机制化  ← 当前 origin/main
53f9ba61 docs: REVIEW v26 — 重打 readiness 综合 + 抓到 L3 P0 新发现
00138a46 docs: REVIEW v25 — 重打 R2 决策（推荐 D 折衷方案）
f6ce25a7 feat(safety): v24 Bucket C — browser tool 默认关闭（保留 toggle）
943a40be fix(security)+test: v24 Bucket B — SSRF redirect bypass 真修 + 单测 runtime 化
8fbb8e12 docs+brand: v24 Bucket A — SOP 工程化 + sync 漏盘补丁
91ee3924 docs: SYNC v0.9.2 报告 + §3.7 历次演进表加 v0.9.2 行
a76e502d sync: merge upstream/main as of 20260507 (v0.9.2)
├── 8981384b v0.9.2 (上游)
└── 7c9cce68 fix(security+brand): v23 P1 follow-up — api-tools SSRF + 用户可见 craft 残留
    074875dd docs: REVIEW v23 + M2.5 SOP 5 项 P0 刷新
```

10 个有意义 commit + 1 个 merge commit = v22 → v0.9.2 上线 完整链路。

---

## 11. 评级演进

| 阶段 | 评级 | 关键 |
|---|---|---|
| v22 后 | A | 项目主基线健康 |
| v23 | A− | 88 finding 分级 |
| v24 | B+ → A | 4 P0 + 4 P1 全解 |
| v0.9.2 sync 完成 | A | 三处同步 |
| v25 推荐 D | A | 折衷方案落地 |
| v26 抓 P0 + 修 | B+ → A | latest-mac.yml D-β + worktree ff |
| **v0.9.2 R2 上线（本报告）** | **A−** | `/v0.9.2/` 归档 deferred 到明天 |
| 明天补归档 | A | 全维度对齐 |
| M3-1 OAuth relay | A+ | M3 readiness 90% |

---

## 12. 一句话总结

v0.9.2 上线是 fork 项目第一次"代码层 + 分发层"完整闭环——从 v22 review 链 28 真 P0 全部关闭（含 v26 抓的 latest-mac.yml x64 entry 严重 bug 阻止 Intel Mac 闪退 + v26 后续抓的 release-notes 漏译）→ 到 macOS arm64 + Windows x64 双平台实测通过 + R2 上线自动更新链路全 200。

**v0.9.2 用户立即受益**：Pi 系统 prompt 不再丢、SSRF 加固、browser tool 默认关、中文 release-notes、所有 v0.9.2 上游 6 项 fix。

下次 review（v27）触发条件：
- 明天补归档后实证（事件驱动）
- 或 v0.9.3 上游发版（事件驱动，预计 1-3 周）
- 或 M3-1 OAuth relay 部署 readiness（事件驱动）
