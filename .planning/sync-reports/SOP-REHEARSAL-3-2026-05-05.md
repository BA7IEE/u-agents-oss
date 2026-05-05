# SOP 演练 Round 3 — 第一次完整同步演练（2026-05-05）

**目的**：fetch 上游 → 跑完整 §2.7b/c + §3.7 基线 → 验证 SOP 已可上线
**结果**：**SOP 健壮，5/5 类 grep 0 误报，基线完全匹配**
**总评**：**A — SOP 上线就绪，等上游打 v0.10.0 即可执行真同步**

---

## 1. 上游状态（fetch 后）

```
upstream → https://github.com/lukilabs/craft-agents-oss.git
最新 commit: acb08842 v0.9.0  (= 我们 fork 起点)

git log upstream/main..HEAD = 56 commits（M1 + M2 全部本地工作）
git log HEAD..upstream/main = 0 commits
```

**结论**：上游是 release-only squash 仓库（[`07-upstream-sync.md` §1.0](../07-upstream-sync.md) 已记录），现在最新就是 `v0.9.0` —— **没有任何新 commit 待合并**。

下次真同步要等上游打 `v0.10.0` 等新 release tag。

---

## 2. SOP grep 演练（5/5 类 0 误报）

| 类别 | 检查项 | Round 3 结果 | 评估 |
|---|---|---|---|
| §2.7b A2 | 任务清单文件路径 hallucination | **0 missing** | ✅ |
| §2.7b A3 | 跨文档引用悬空 | **0 处** | ✅ |
| §2.7b B1 | 品牌名变体 | u-agents 361 / U Agents 216 / U-Agents 77 / UAgents 28 / **u_agents 3**（合法保留）| ✅ |
| §2.7b B2 | 域名规划 | **0 违规** | ✅ |
| §2.7b B5 | typo 扫描 | **0 文件** | ✅ |
| §2.7c C1-C9 | 代码踩坑模式 | **全 0 命中** | ✅ |
| §3.7 基线 | 标记 / START / END | **59 / 8 / 8** | ✅ 完全匹配 |

**B1 剩 3 处 u_agents** = SOP 自身 grep 命令字面量 + 11-roadmap 描述 code identifier 名（合法保留）。

---

## 3. 高冲突文件状态（CLAUDE.md §3.3 列 7 个）

模拟"如果上游打了 v0.10.0"路径——预先核对每个文件的最近改动：

| 文件 | 最近 commit |
|---|---|
| `apps/electron/electron-builder.yml` | `323293b9` Apache §4(c) closure |
| `packages/shared/src/branding.ts` | `99fd9952` M1 packaging readiness |
| `packages/shared/src/config/llm-connections.ts` | `68137e2d` v0.8.13（**上游未改**）|
| `packages/shared/src/config/provider-metadata.ts` | `88ab13bf` 多 U-API 连接 soft lockdown |
| `apps/electron/src/renderer/components/onboarding/ProviderSelectStep.tsx` | `540509bd` onboarding settings UI lockdown |
| `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx` | `35444566` branding replacements + i18n cleanup |
| `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx` | `814c0243` simplify U-API Token UI |

**关键发现**：`llm-connections.ts` 自上游 v0.8.13 后**我们没改过**——若上游 v0.10.0 改这个文件 → 多半 git auto-merge clean 不冲突 → 但需 SOP §2.5 "应冲突而未冲突的隐患"主动核对。

---

## 4. 三轮 SOP 演练对比

| 检查 | Round 1（5/4）| Round 2（5/5 上午）| Round 3（5/5 下午）|
|---|---|---|---|
| §2.7b A3 跨文档引用 | 79% 误报（48 处假悬空）| 0 处 ✅ | 0 处 ✅ |
| §2.7b B1 品牌变体 | 9 误报 u_agents | 9 误报（grep 抽短串）| **3 误报**（grep 抽长串 + 白名单）|
| §2.7b B2 域名规划 | 4 误报 share/docs | 4 误报（grep 顺序问题）| **0 违规** ✅ |
| §2.7b B5 typo | 2 误报（自指 paradox）| 0 ✅ | 0 ✅ |
| §2.7c C 类 9 项 | 9/9 准确 ✅ | 9/9 ✅ | 9/9 ✅ |
| §3.7 基线 | 44 / 7 / 7 | 47 → 48 → 51 → 55 → 59 | **59 / 8 / 8** ✅ |

**改进路径**：
- Round 1 → Round 2：A3/B5 改进，但 B1/B2 grep 模式问题没识别
- Round 2 → Round 3：B1（抽长串）+ B2（先按行过滤再抽 URL）落实 → 误报全清

---

## 5. SOP 上线就绪判定

| 维度 | 状态 |
|---|---|
| §2.7b A 类（自相矛盾审计）| ✅ 命令精准，0 误报 |
| §2.7b B 类（品牌反向 grep）| ✅ 命令精准（B1 3 处合法保留 acceptable）|
| §2.7c C 类（9 anti-patterns）| ✅ 9/9 准确 |
| §3.7 基线 grep | ✅ 59/8/8 与文档完全一致 |
| `--exclude-dir=node_modules` | ✅ 抗 build-dmg.sh SDK 复制中间态 |
| baseline fail 描述 | ✅ "13 stable + 2 OAuth network-flaky"（避免漂移迷惑）|
| §3.3 高冲突文件清单 | ✅ 7 个文件全存在 |
| §2.4 冲突解决路径 | ⏸ 等真有冲突才能真测 |

**结论**：SOP 已可上线。等上游打 v0.10.0 时，按 [`07-upstream-sync.md` §2.1-§2.9](../07-upstream-sync.md) 流程跑即可。

---

## 6. 模拟 v0.10.0 同步执行清单（参考）

下次真同步时按下面顺序：

```bash
# §2.1 同步前准备
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git fetch upstream
git log HEAD..upstream/main --oneline | wc -l  # 看上游新增多少 commit

# §2.2 创建同步分支
DATE=$(date +%Y%m%d)
git checkout -b sync/upstream-$DATE

# §2.3 执行 merge
git merge upstream/main  # 预期会有冲突

# §2.4 解决冲突（按 §3.3 7 个高冲突文件优先保留我们的版本）
# 详细步骤见 §2.4.1-§2.4.5

# §2.7 跑测试
bun run typecheck:all
cd packages/shared && bun test 2>&1 | tail -5  # 期望：13 stable + 2 OAuth flaky

# §2.7b 反向核对（A + B 类）
# §2.7c 9 anti-patterns（C 类）
# §3.7 基线 grep（标记 59/8/8 ±2 浮动）

# §2.8 合回主分支
git checkout main && git merge sync/upstream-$DATE
git push origin main
git tag sync-$DATE && git push origin sync-$DATE

# §2.9 写报告 .planning/sync-reports/$DATE.md
```

整个流程预计 1-3 小时（取决于上游变化量 + 冲突复杂度）。SOP 已经把每一步精化到 grep 命令级别。

---

## 7. 下一步建议

### 不阻塞同步的事

- 等上游打新 release tag（监控周期：07-upstream-sync §1.1 建议每 2 周看一次）
- M2 剩余任务正常推进（Linux / macOS 公证 / Web 端 / 法务）

### 监控上游 release

```bash
# 简单脚本（可加 cron 每 2 周跑）
cd /Users/dengwang/Documents/u-agents-oss/u-agents
git fetch upstream 2>&1
LATEST=$(git tag -l 'v*' --sort=-v:refname --merged upstream/main | head -1)
if [ "$LATEST" != "v0.9.0" ]; then
  echo "上游新 release: $LATEST，可启动同步流程"
fi
```

### 持续 SOP 演练价值

- Round 1（5/4）：发现 SOP 命令本身的精度问题
- Round 2（5/5 上午）：修 A3/B5，跑通 9 anti-patterns
- Round 3（5/5 下午）：修 B1/B2，**SOP 上线就绪**

**未来跑频率**：每月 1 次同步 + 每次同步前后跑一次 SOP grep。
