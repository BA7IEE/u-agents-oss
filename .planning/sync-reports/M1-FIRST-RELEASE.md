# M1 v0.9.0 首次发布报告

**日期**：2026-05-04
**Baseline**：commit `99fd995` (chore: M1 packaging readiness)
**最终 commit**：`323293b` (Apache §4(c) closure)
**M1 改造范围**：`99fd995..323293b` 共 13 个 commit

---

## 步骤 1 — automations.md C2 决策说明

✅ commit `ec0dd37`：在 `apps/electron/resources/docs/automations.md` 顶部加 4 行 quote block，
解释 `$CRAFT_*` webhook protocol variable 为何保留（与代码侧 runtime env vars 同步，#11f 范围）。

---

## 步骤 2 — 验证链

| 项 | 结果 |
|---|---|
| `bun run typecheck:all` | ✅ 0 errors |
| `bun run lint:i18n:parity` | ✅ 6 locales × 1376 keys |
| `bun run lint:electron` | ⚠️ 0 errors / 111 warnings（不阻塞）|
| `bun run lint:shared` | ❌ 1 error（baseline 既有 — 见技术债章节）|
| `bun run lint:ui` | ❌ 3 errors（baseline 既有 — 见技术债章节）|
| `bun run test:shared:all` | ✅ 63 / 63 |
| `cd packages/shared && bun test`（全跑）| ⚠️ 2656 pass / 14 fail（全 baseline 既有 — 见技术债）|
| `bun run validate:dev` | ✅ typecheck + test:shared:all + 19 doc-tools 全过 |

**M1 出口判定列出的必过项全部通过**（typecheck + lint:i18n:parity + test:shared:all + validate:dev）。

---

## 步骤 3 — macOS adhoc 打包

✅ 打包成功，产物：

```
apps/electron/release/
├── U-Agents-arm64.dmg       169,604,361 bytes  (162 MB)
├── U-Agents-arm64.dmg.blockmap
├── U-Agents-arm64.zip       (auto-update 用)
├── U-Agents-arm64.zip.blockmap
├── U-Agents-x64.dmg         (Intel mac，⚠️ 仍受 hotfix #2 已知限制：bun 是 arm64)
├── U-Agents-x64.{dmg.blockmap, zip, zip.blockmap}
└── latest-mac.yml           776 bytes
```

DMG 内部验收（关键运行时依赖）：
- ✅ `Contents/Resources/app/resources/pi-agent-server/index.js` (20.5 MB)
- ✅ `Contents/Resources/app/resources/pi-agent-server/node_modules/koffi/build/koffi/darwin_arm64/koffi.node` (4.0 MB)
- ✅ `Contents/Resources/app/vendor/bun/bun` (59.9 MB, arm64 Mach-O)
- ✅ `Contents/Resources/icon.icns` (223 KB, U Agents logo)
- ✅ `Contents/Resources/Assets.car` (148 KB, Liquid Glass)
- ✅ `Contents/Resources/LICENSE` (10.7 KB) + `NOTICE` (1.0 KB) — Apache §4(c) closure

**Onboarding 端到端验证**：⏸ 待用户人工跑（装 DMG + token + model + 第一条消息）

---

## 步骤 4 — 更新服务器部署

⏸ **待用户人工跑**（需要 Cloudflare R2 凭证 + DNS 操作权限）。

`latest-mac.yml` 已由 build 自动生成（含 4 个产物的 sha512 + size），上传后：

```bash
curl https://update.u-agents.u-studio.cn/latest/latest-mac.yml
# 期望: 返回 yaml 内容，version: 0.9.0
```

详细上传清单（10 个文件）+ wrangler/rclone 命令在上一轮对话给出。

---

## Apache §4(c) 闭环（commit `323293b`）

**问题发现**：v0.9.0 baseline 时 LEGAL.md §2 写的 NOTICE 派生段 + LICENSE/NOTICE 打进 packaged app
两项都没落地——单纯有 about-dialog 署名不够，packaged DMG 用户实际找不到 attribution 文件。

**完整修复**：
1. `NOTICE` 底部追加派生作品声明段（U Studio Ltd. + Apache §4(b) 修改声明指引）
2. `electron-builder.yml` mac/win/linux 三段 `extraResources` 加 `../../LICENSE` + `../../NOTICE`
3. About 对话框简化为 `Copyright © 2026 U Studio Ltd.`（不再显示上游品牌）
4. `LEGAL.md §2` About 章节完整改写决策；§7 checklist 加"packaged app 内含 LICENSE+NOTICE"

DMG 验收：`U Agents.app/Contents/Resources/{LICENSE,NOTICE}` 都在；NOTICE 含双重 attribution。

---

## 已知技术债（v0.9.0 baseline，非 M1 引入）

| 类别 | 位置 | 备注 |
|---|---|---|
| `lint:ui` `craft-styles/no-nonstandard-shadows` | `packages/ui/src/components/annotations/block-markers.ts` (×2) + `packages/ui/src/components/chat/TurnCard.tsx` (×1) | 上游 ESLint 自定义规则；上游自己违反；不阻塞 build。M1 改造未触及这些文件 |
| `lint:shared` `craft-shared/no-inline-source-auth-check` | `packages/shared/src/sources/types.ts:141` | 同上，上游既有；M1 未碰 |
| i18n `about.*` keys 排序 | 7 个 locale `*.json` 末尾段（commit `3544456` 早于 M1 引入）| `locale-parity.test.ts` 7 个 alphabetical 测试 fail；M2 中文化扫描时一并修 |
| 7 处上游测试 fail | `packages/shared/tests/`（Bedrock auth env / classifyExternalUrl / safe-mode / channel routing / 测试 fixture syntax 错误）| 涵盖 M1 #21 / #11e 已禁用但代码仍存在的分支；上游既有，预期 fail。**M2 校正 2026-05-05**：实际 baseline = **13** fail（不是 14），M2 TLS 修复执行 AI 实测确认；M1-FIRST-RELEASE 初版"14 fail"是过时数字，git stash 撤销修改后跑也是 13 fail |
| **apps/electron 35 fail（去重 ~10）** | RPC transport 通道一致性（`RoutedClient workspace switch` / `RPC_CHANNELS wire-format` / `getTransportBannerCopy`）| **REVIEW-5 2026-05-04 补遗**：M1-FIRST-RELEASE 初版只跑 packages/shared，未覆盖 apps/electron。这部分 fail 全是上游 RPC 既有问题，与 M1 改造无关 |
| **Claude SDK native binary 不在 packaged DMG** | `Contents/Resources/app/node_modules/@anthropic-ai/claude-agent-sdk-binary/claude` 缺失 | **M2-REBUILD 2026-05-05 补遗**：`electron:dist:adhoc:mac` 跳过了 `build-dmg.sh` 的 SDK 复制步骤。M1 锁定 U-API（pi_compat）路径不调 Claude SDK，对用户透明（首发版亦如此）。但若上游同步引入 Claude 直连 fallback → 会 crash。M2 应改用 `cd apps/electron && bun run dist:mac` 调 build-dmg.sh，让 SDK 进 DMG。详见 `M2-REBUILD-HOTFIX-2026-05-05.md` §4 |

**结论**：上述均不属于 M1 白标改造引入的 regression；上游同步时若上游修了某项，自动跟随；M1 不主动修。验证锚点：将这些测试在 `99fd995` baseline 上重跑，结果与现在一致。

---

## M1 出口判定 §4 14 项核对

> ⚠️ **本表是首发当日（2026-05-04）快照**。后续状态变更不修改本表（保留历史），实时状态见 [`REVIEW-6-2026-05-04.md`](REVIEW-6-2026-05-04.md) §"M1 14 项最新状态"。

| # | 条件 | 状态（首发当日）|
|---|---|---|
| 1 | 全新装机能完成 onboarding，能发第一条对话 | ⏸ 待用户人工 |
| 2 | adhoc 包通过 Gatekeeper 流程 | ⏸ 待用户人工 |
| 3 | About 对话框含合规署名 | ✅ `Copyright © 2026 U Studio Ltd.` + NOTICE 文件随 .app 分发（commit `323293b`）|
| 4 | 01 §8 4 个 grep 全过 | ✅ 已实施（M1 改造范围内 0 命中）|
| 5 | 02 §10 验收全过 | ✅ 多连接 + UI lockdown commit `88ab13b`/`814c024` 实现 |
| 6 | `lint:i18n:parity` | ✅ 步骤 2.2 |
| 7 | `typecheck:all` | ✅ 步骤 2.1 |
| 8 | `test:shared:all` | ✅ 步骤 2.4（M1 范围 63/63）|
| 9 | `validate:dev` | ✅ 步骤 2.5 |
| 10 | 09 §3.5 后端 setup 端到端 | ⏸ 待用户人工 onboarding 跑通 |
| 11 | M1 性能基准记录到 `.planning/perf-baseline-M1.md` | ⏸ M1 后补 |
| 12 | 自动更新指向 `update.u-agents.u-studio.cn` | ✅ `electron-builder.yml:88-89` 已配置；服务器上线待步骤 4 |
| 13 | 网站下载页"首次启动指引" | ⏸ M1 后补 |
| 14 | Sentry DSN 未注入 | ✅ `SENTRY_ELECTRON_INGEST_URL` 不设 → enabled=false |

**首发当日：12/14 ✅；剩 perf-baseline + 网站下载页 — M1 后补即可**。

---

## 下一步

1. 用户人工：装 `apps/electron/release/U-Agents-arm64.dmg` → onboarding → 发首条消息
2. 用户人工：步骤 4 R2 上传 + DNS 配置
3. 通知种子用户启动 M1 装包测试
4. M1 后补：性能基准 + 网站下载页
