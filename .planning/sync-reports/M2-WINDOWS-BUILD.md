# M2 — Windows 首次打包报告

**日期**：2026-05-04
**版本基线**：v0.9.0（与 macOS 同基线，commit `99ba7cf` 之前的 M1 改造历史）
**M2 任务对应**：`11-roadmap.md` §M2 任务大类"打包 — Windows 签名 / Linux AppImage"

---

## 1. 产物清单

| 文件 | 大小 | 说明 |
|---|---|---|
| `U-Agents-x64.exe` | 169 MB（173,272 KB / 177,429,991 bytes） | NSIS 单文件安装包，x64 |
| `latest.yml` | (sha512 + size) | electron-updater Windows 自动更新清单 |

**R2 上线状态**：✅ 已上传至 `https://update.u-agents.u-studio.cn/latest/`

服务端验证（2026-05-04 测试）：

```bash
curl -I https://update.u-agents.u-studio.cn/latest/U-Agents-x64.exe
# HTTP/1.1 200 OK
# Content-Type: application/octet-stream

curl https://update.u-agents.u-studio.cn/latest/latest.yml
# version: 0.9.0
# files:
#   - url: U-Agents-x64.exe
#     sha512: uPu+CB9umetNVXTvynWSO3fKR25yY4Crj48X68E7nljEM2GbJS7QDhTSyekaPu+yLvTAWF0S+lV0aLcr/1DaeA==
#     size: 177429991
# path: U-Agents-x64.exe
# releaseDate: '2026-05-04T16:25:47.222Z'
```

---

## 2. 自测结果（基础冒烟）

测试范围：用户在 Windows 上自测，**未做完整工具回归**——只验证核心通路。

### 2.1 基础通路 ✅

| 项 | 结果 |
|---|---|
| NSIS 安装向导走完 | ✅ |
| 应用启动 | ✅ |
| 首次启动 SmartScreen 警告 → "更多信息" → "仍要运行" | ✅ |
| Onboarding 完成 + Token 配置 | ✅ |
| 添加模型 | ✅ |
| 发送消息，模型正常回复 | ✅ |
| 界面图标显示 | ✅ |

### 2.2 工具调用（已测） ✅

| 工具 | 状态 |
|---|---|
| `multi_tool_use.parallel`（并行调用） | ✅ |
| `ls` | ✅ |
| `find` | ✅ |
| `bash` | ✅ |
| `write` | ✅ |
| `read` | ✅ |
| `edit` | ✅ |
| `grep` | ✅ |
| `mcp__session__script_sandbox` | ⚠️ 当前环境不可用，原因是缺少网络隔离 backend（不阻塞，独立问题） |

### 2.3 未测（M2 后续阶段补）

下列工具 Windows 上未做端到端验证。**不阻塞 M2 Windows 打包出口判定**——这些工具在 macOS 已验证过，Windows 用同套上游代码，跨平台差异概率低。但**种子分发前最好覆盖一次**：

- **Web/外部网络**：`web_search`、`web_fetch`
- **浏览器**：`mcp__session__browser_tool`
- **配置/Source/OAuth**：`config_validate`、`source_test`、`source_oauth_trigger`、Google/Slack/Microsoft OAuth trigger、credential prompt
- **Session 管理**：`get_session_info`、`list_sessions`、`set_session_labels`、`set_session_status`、`spawn_session`、`send_agent_message`
- **渲染/数据转换**：`transform_data`、`render_template`、`mermaid_validate`、`call_llm`
- **会话状态变更**：`SubmitPlan`、OAuth trigger、credential prompt

---

## 3. 已知 Windows 限制

| 项 | 状态 | 处理 |
|---|---|---|
| 未代码签名（无 EV 证书）| 已知 | 用户首次启动看到 SmartScreen 警告，需手动"仍要运行"。安装说明已写明（`M1-SEED-DISTRIBUTION.md` §3 步骤 3-Win） |
| `mcp__session__script_sandbox` 不可用 | 已知 | 缺少网络隔离 backend；非 Windows 特有，跨平台问题，等 M3 自建 backend 后修 |
| Windows 7/8/10 旧版本兼容性 | 未测 | 上游 electron 39 默认仅支持 Windows 10+；M2 不主动验证旧系统 |
| ARM Windows（Surface Pro X 等）| 未做 | M2 不出 win-arm64；如有 ARM 用户反馈再评估 |

---

## 4. 与 11-roadmap.md M2 出口判定的对照

| M2 出口条件 | Windows 部分状态 |
|---|---|
| 三平台安装包均通过 09-test-checklist.md | ⏸ Windows 部分基础冒烟通过；待补完整工具回归 |
| Windows/Linux 构建脚本和 `scripts/build/common.ts` 生成的 artifact name 不再使用 `Craft-Agents-*` | ✅ artifact 名为 `U-Agents-x64.exe`，无 craft 残留 |
| 三平台自动更新均能从 N→N+1 | ⏸ 当前是首版，无 N+1 可测；待 v0.9.0+u-agents.1 hotfix 时验证 |
| zh-Hans.json 中无 "Craft" 字面量 | ✅（`M2-I18N-SCAN.md` 已确认）|

---

## 5. 下一步建议

1. **Windows 端 SmartScreen 警告** — 下次发版前可考虑申请 EV 代码签名证书（年费约 ¥3000-5000，能直接消除 SmartScreen 警告）。M3 阶段评估
2. **完整工具回归** — 下次种子分发前补 §2.3 列出的未测工具至少一轮
3. **Linux AppImage** — M2 剩余子任务，参考 `05-build-release.md` Linux 章节
4. **首次自动更新链路验证** — 等下一次 hotfix（v0.9.0+u-agents.1）时端到端测一遍 Windows 自动更新

---

## 6. 校验清单（Windows 完结判定）

- [x] `U-Agents-x64.exe` 上传 R2（HTTP 200）
- [x] `latest.yml` 上传 R2 + 含 sha512/size
- [x] 应用启动 + onboarding + 首条消息验证通过
- [x] 基础工具集（ls/bash/write/read/edit/grep）通过
- [x] 界面图标显示正常
- [ ] §2.3 未测工具完整回归（M2 后续阶段补）
- [ ] 自动更新 N→N+1 链路验证（待 hotfix 触发）
