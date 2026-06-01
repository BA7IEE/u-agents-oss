# 15 — 已知问题 backlog（运行时功能在特定平台/配置的限制）

> 记录**与上游同步无关**的 pre-existing 运行时功能限制（Windows 平台 / pi_compat 锁定 / 环境依赖），供后续按优先级处理。
> 首批来自 **v0.10.0 Windows x64 实测**（2026-06-02，agent 工具自测）。**这些与 v0.10.0 无关**（v0.10.0 是 remote browser pane）；核心功能（LLM 对话 / 文件工具 ls·bash·read·write·edit·grep·find / 并行调用 / config_validate / mermaid_validate / call_llm / session 状态）实测全正常。

---

## 0. 性质判定

4 项异常**没有一个是 v0.10.0 sync 引入**，也都不是 piServerPath 类打包缺陷。是平台/配置/依赖的 pre-existing 限制，需产品层决策或文档说明，**不属于能直接 hotfix 的代码 bug**。建议先在 macOS 复现确认（区分"平台限制" vs "全平台缺口"）。

---

## 1. `transform_data` — **全平台 packaged app 缺 `uv`**（中频，可修的打包缺陷 = 事故 #6 同类）

- **现象**：`spawn uv ENOENT`（Windows 实测；**macOS/Linux 同样缺**，已查实）
- **根因（全平台，已查实）**：`transform-data.ts` python3 runtime 经 `uv` 跑 Python；uv 该在 `apps/electron/resources/bin/<platform>/uv`，由 `downloadUv()`（`scripts/build/common.ts:197`，`UV_VERSION='0.10.6'`）下载。**但只有 `scripts/build-server.ts`（standalone server build）调 downloadUv —— electron app build（build-dmg.sh / build-win.ps1 / build-linux.sh）都不下载 uv，且 `electron-builder.yml` 的 `files` 列了 markitdown/pdf-tool/xlsx-tool 等 wrapper 却漏了 uv**。实测刚打的 macOS app `find uv` = 空 → **全平台 packaged app 都缺 uv**（不只 Windows；那条 Windows `resources\bin\win32-x64` warning 即它）。这是 **事故 #6 同类**（build 漏 vendor binary）。
- **影响**：**所有 packaged app** 用 transform_data 失败。dev 模式若系统装了 uv 则正常，掩盖了它（macOS 之前没测 transform_data）。
- **修复方案**（清晰，复用现成 `downloadUv`）：
  - (a) `scripts/copy-subprocess-servers.ts` 加 `downloadUv()`（它已 downloadBun，三平台 build 脚本都调它 = 一次修三平台）→ uv 落 `resources/bin/<platform>/uv`。
  - (b) **`electron-builder.yml` `files` 加 uv** — ⚠️ §3.3 高冲突文件，**改前必停确认**。
  - (c) 重新打三平台包，验证 `find uv` 命中 + transform_data 实跑。
- **✅ 已修（2026-06-02，commit `ef4581ca`）**：`copy-subprocess-servers.ts` 加 `downloadUv()`（step 3.5，与 downloadBun 同模式）。**无需改 §3.3** —— electron-builder.yml `files` 早已列 `resources/bin/<platform>/**/*` + 注释 "Include bundled uv binary"，只是 build 漏调 downloadUv。macOS 重打包实测 `uv`(42M)进 app `Contents/Resources/app/resources/bin/darwin-arm64/uv` ✓（DMG 225M→261M）。
- **剩余**：Windows/Linux 各自重打包验证（fix 是三平台共用 copy-subprocess-servers，逻辑同）+ packaged app 实跑 transform_data 终验。
- **原优先级**：中（全平台缺口）。

## 2. `web_search` — pi_compat 锁定下后端不可用（中频，需调查）

- **现象**：OpenAI search 401 + DuckDuckGo fallback 异常
- **根因**：`packages/pi-agent-server/src/tools/search/resolve-provider.ts` 按 LLM connection 的 `piAuth.provider` 选 search provider（OpenAI / ChatGPT / Google / DDG fallback）。我们锁定 `pi_compat`（token 站），provider ≠ 'openai' 本应走 DDG（无 key）；但出现 OpenAI 401（疑似 provider 误判）+ DDG 网络/限流。
- **影响**：web_search 在本产品当前不可用。
- **方案**（调查 + 产品决策）：
  - 确认 pi_compat 下 web_search 实际走哪个 provider（应 DDG？token 站若支持 search 则接它？）。
  - DDG fallback 网络问题（限流/需代理？国内网络？）。
  - 或裁剪 web_search（若产品不提供搜索）— 参 04-feature-cuts。
- **优先级**：中。需先 trace `resolveProvider` 在 pi_compat + 我们 baseUrl 下的实际分支。

## 3. `script_sandbox` — Windows 无网络隔离 backend（低频，平台限制）

- **现象**：`script_sandbox requires network isolation ... no supported isolation backend`
- **根因**：`packages/session-tools-core/src/runtime/network-isolation.ts` backend = `sandbox-exec`(macOS) / `unshare`·`firejail`(Linux) / **none(Windows)**。**上游设计** Windows 无网络隔离，fail-safe → script_sandbox 不可用。
- **影响**：Windows 用户用 script_sandbox（隔离执行脚本）失败。**上游固有，非我们引入**。
- **方案**：
  - **(a) 文档说明** Windows 不支持 script_sandbox（平台限制）。最实际。
  - (b) 实现 Windows 网络隔离（WFP / 沙箱 API，复杂）。不值当。
- **优先级**：低（高级功能 + 上游限制）。文档说明即可。

## 4. `get_session_info` — 空字符串 sessionId（用法，非 bug）

- **现象**：`sessionId: ""` 返回 "Session not found"；明确 ID 正常。
- **根因**：schema 要求 sessionId 存在，空串被当作 ID 查找。
- **影响**：调用侧传空串 ≠ 省略；用明确 sessionId 可规避。
- **方案**：调用侧避免空串。**非 bug**；可选改进：工具侧把空串当"当前会话"（便利）。
- **优先级**：极低。

---

## 下一步建议

| # | 项 | 优先级 | 建议动作 |
|---|---|---|---|
| 1 | transform_data uv | 中 | 先 macOS 复现 → 若全平台依赖 uv，build bundle uv |
| 2 | web_search | 中 | trace pi_compat 下 resolveProvider 分支 + DDG 网络 |
| 3 | script_sandbox | 低 | 文档说明 Windows 不支持 |
| 4 | get_session_info | 极低 | 可忽略 / 调用侧避免空串 |

> 都不阻塞已发布的 v0.10.0。按用户活跃需求驱动处理（参 11-roadmap）。
