# Review v25 — v0.9.2 R2 重打决策 review（2026-05-07）

**Review 焦点**：origin/main = `f6ce25a7` push 完成后，是否立即重打 v0.9.2 三平台 R2 包
**总评**：**重打决策 = 轻量子集**（macOS arm64 + Windows，~1.5-2h；不补 deferred x64/Linux）

> v22 实施落地、v23 多智能体扫描、v24 复盘修真 P0、v25 是**决策 review**（不是问题 review）。

---

## 0. 5 Agent 评级 + 推荐对比

| Agent | 焦点 | 评级 | 推荐 |
|---|---|---|---|
| **K1** push 后实证 + spec 漂移 | **A** | — origin/main 状态健康 |
| **K2** 重打 readiness | **B+** | 13/16 项达标，1 阻塞（git pull）|
| **K3** 打包流程预演 | **A** | 事故同根第 4 个风险低；预估 1.5-2h |
| **K4** 不重打风险 | **B** | **B（等触发点）**：SSRF 攻击概率 < 0.1%，用户基数小 |
| **K5** 决策综合 | **A** | **A（立即重打）**：A=27/35 vs B=23/35 vs C=20/35 |

**关键矛盾**：K4（等）vs K5（立即），同样数据不同权重。

---

## 1. K4 / K5 核心论点对比

### K4：等触发点的理由

| 论点 | 数据 |
|---|---|
| SSRF 攻击实际概率 | **< 0.1%**：需用户主动导入恶意 source + LLM 配合外发 + 个位数用户基数 |
| 重打成本 ≠ 0 | macOS x64 仍 deferred / Linux 从未打过 / R2 上传仍人工，"重打又一遍承担同类成本" |
| 等待成本可接受 | 用户基数低（估 0-2 人导入非默认 source）|
| 推荐时机 | v0.9.3 上游发版（1-3 周） / 或 M3-1 OAuth relay 上线 |
| 例外触发 | 若 1-2 周内 v0.9.3 不来，且接到 Pi backend 用户反馈"AI 突然变笨" |

### K5：立即重打的理由

| 论点 | 数据 |
|---|---|
| 已知 P0 在分发链路 | SSRF redirect bypass + browser tool 默认关都是 v24 真修 P0 |
| 重打 SOP 已就绪 | v0.9.1 实战 SOP 化，事故 #1-#5 已闭环 |
| 历史节奏远快于预期 | v0.9.0+u-agents.1 → v0.9.1 = 2 天，v0.9.1 → v0.9.2 = 1 天 |
| 顺便补 M2 出口 | macOS x64 deferred 一并解决 |
| 维护"代码 + 分发"节奏一致 | 避免外部 AI 误读 R2 为现状 |

---

## 2. 我的整合判断（独立第三方）

K4 和 K5 都对，但都不完整：

**K4 错估的**：
- "重打成本 = 全平台" — 不是。可以**只重打已实测的 arm64 + Windows**，把 x64/Linux deferred 状态保持
- "等触发点" 假设忽视了"已知 P0 在分发链路是合规债"——即使没人攻击，专业项目也应当合上

**K5 错估的**：
- "顺便补 macOS x64" 引入新风险（首次 x64 实测可能爆事故 #6）
- "立即重打全平台" 工作量 6-8h 不必要——核心 fix 只需 arm64 + Windows 即可覆盖现有用户
- "历史节奏 1-2 天" 论据反向不成立——如果真的快就更不该急（v0.9.3 来得快，等就行）

**两者忽视的中间路径**：**轻量子集重打**
- 范围：仅 macOS arm64 + Windows EXE（v0.9.1 已实测过的两个平台）
- 不做：macOS x64（继续 deferred）+ Linux AppImage（M2 stretch，从未打过）
- 工作量：**~1.5-2h**（K3 估）vs 全平台 ~6-8h（K2 含 buffer）
- 风险：**低**（不引入新平台 deferred 转执行的失败风险）
- 收益：**arm64 + Windows 用户立即拿到 v0.9.2 + v24 修复**

---

## 3. 推荐：方案 D（K4/K5 折衷）

| 选项 | 范围 | 工作量 | 收益 | 风险 |
|---|---|---|---|---|
| A K5 推荐 | 4 平台全打 + R2 全推 | 6-8h | 5/5 | 中（x64/Linux 首次实测）|
| B K4 推荐 | 不打，等 v0.9.3 | 0h | 0/5 | 低（用户暴露持续）|
| C 跳到 v0.9.3 | 不打，跳过 v0.9.2 | 0h | -1/5 | 中（漂移加大）|
| **D 折衷** | **arm64 + Windows 重打 + R2 推**（保留 x64/Linux deferred）| **1.5-2h** | **4/5** | **低** |

**推荐 D 的核心理由**：

1. **覆盖率**：v0.9.1 R2 当前只有 arm64 + Windows 实测过；x64/Linux 本来就是 deferred 状态——重打 D 不引入 deferred 反向 deferred
2. **风险锁定**：在 v0.9.1 已成功打过的两个平台上重打 v0.9.2，等同于"修一个已知好的零件"，事故概率最低
3. **工作量合理**：1.5-2h 是独立开发者周末 1-2 个早晨能完成的，不需要假期级投入
4. **触发逻辑不冲突**：v0.9.3 真来了，再打一次 v0.9.3 也是同样 1.5-2h（M3-1 OAuth relay 上线时一并补 x64/Linux）

---

## 4. 执行清单（如选 D）

### Pre-rebuild（30min）

```bash
# 1. 主仓库工作树切到 main 并 ff-pull
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git checkout main
git pull --ff-only origin main   # 应当 already up to date (f6ce25a7)

# 2. 跑 §13.5/§13.6/§13.7 全套 grep + bun test 验证（v24 §13.8 必备贴片）
bun run validate:ci             # 期望全绿
bun test packages/shared 2>&1 | tail -5   # 期望 2865 pass / 0 新引入 fail

# 3. §3.7 marker 基线核
grep -rEn --exclude-dir=node_modules "U-API" packages apps --include="*.ts" --include="*.tsx" \
  | grep -E "^[^:]+:[0-9]+:.*(//|/\*|\{/\*|<!--)\s*U-API" | wc -l
# 期望 82
```

### macOS arm64 重打（30-40min）

```bash
# 4. 干净 build + dist:mac
cd /Users/dengwang/Documents/u-agents-oss/u-agents
bun run electron:clean
bun run electron:build           # 重生 subprocess 依赖（事故 #3 防御）
cd apps/electron && bun run dist:mac    # 生成 U-Agents-arm64.dmg

# 5. 实测 (M2-REBUILD §1 SOP)
# - 装机：xattr -dr com.apple.quarantine /Applications/U\ Agents.app
# - onboarding 输 Token + 选协议 + 输 model ID → 进主界面 → 发首条对话验证
# - 验证 SSRF marker：grep "redirect: 'manual'" apps/electron/release/.../app/dist/main.cjs（应命中）
```

### Windows x64 重打（30-45min）

```powershell
# 6. 在 Windows 物理机/VM 上同步代码 + 跑 dist:win
cd apps/electron
bun run dist:win
# 输出 U-Agents-Setup-x64.exe
# 实测：装包 → onboarding → 首条对话
```

### R2 上传（30min）

```bash
# 7. 三套件齐了一起传（避免 latest-mac.yml / latest.yml 版本号漂移）
# 参考 06-update-server.md §4.0/§4.1
# - r2://u-agents-update/v0.9.2/U-Agents-arm64.dmg
# - r2://u-agents-update/v0.9.2/U-Agents-Setup-x64.exe
# - r2://u-agents-update/latest/latest-mac.yml（指向 v0.9.2）
# - r2://u-agents-update/latest/latest.yml（Windows 指针）
# - r2://u-agents-update/latest/manifest.json（人工生成）

# 8. CDN cache flush（M2-REBUILD-HOTFIX §5 教训：不刷会发送旧 sha512 错配）
```

### Post-rebuild（30min 验证）

```bash
# 9. 干净机器自动更新测试（装 v0.9.1 → 等 30-60 秒应当跳转 v0.9.2）
# 10. SSRF 实证：在用户态构造 source 配 baseUrl=https://attacker.com → AI 调 tool → 应被 isError 拦截
# 11. 写 SYNC-v0.9.2-REBUILD-RELEASE-20260507.md（按 09 §13.8 必备贴片）
```

**总预估**：**2.5-3h**（含验证；不含 buffer）

---

## 5. 不推荐的细节理由

### 为什么不推 A（全平台）？

- macOS x64 / Linux 从未实测过 → 首次实测发现的事故 #6 会让 1.5h 变 4h+
- M3-1 OAuth relay 上线时（M3 入口）一并补全平台更经济
- 当前用户基数 < 10 人，实际只有 macOS + Windows 用户

### 为什么不推 B（等触发点）？

- v0.9.3 不一定 1-3 周内来（上游 release 节奏不可控）
- "等到 Pi 用户反馈"是被动反应，不专业
- M3-1 OAuth relay 部署还需 ≥50 活跃用户，距离尚远

### 为什么不推 C（跳过）？

- 跳过 v0.9.2 直接等 v0.9.3 = 让 SSRF redirect bypass / browser tool 默认 true 在用户机器持续 1+ 月
- v0.9.2 → v0.9.3 sync 时累积漂移更大（但没那么大，因为代码层已合）

---

## 6. 评级演进确认

| 阶段 | 评级 | 说明 |
|---|---|---|
| v23 review 后 | A− | 项目主基线健康 |
| v24 review 后 | B+ | 抓到 4 真 P0 |
| v24 Bucket A+B+C 落地 | A | 4 P0 + 4 P1 全解决 |
| v0.9.2 + v24 push origin/main | A | 三处同步齐 |
| **现在（R2 缺 v0.9.2）** | **A−** | git 层 A，分发层 B |
| 选 D 完成 | A | 全维度对齐 |
| M3-1 OAuth relay | A+ | M3 readiness 90% |

---

## 7. 一句话决策建议

**推荐 D（轻量 arm64 + Windows 重打）**：2.5-3h 一次完成；不引入新风险（保持 x64/Linux deferred 不动）；让 v0.9.1 已实测平台的用户立即拿到 v24 修复；与 K4 / K5 都兼容（K4 看作"轻量"，K5 看作"分阶段重打"）。

**最终决定权在用户**——本仓库 AI 不能跑 `bun run dist:mac` / `dist:win`（§0 铁律允许范围外），需要你或外部 AI 执行。

---

**v25 commit**：仅 .md 报告，无代码改动。

**下次 review（v26）触发条件**：
- D 完成后实证 R2 v0.9.2 上线（事件驱动）
- 或 v0.9.3 上游发版后（事件驱动）
- 或 M3-1 OAuth relay 部署 readiness（事件驱动）
