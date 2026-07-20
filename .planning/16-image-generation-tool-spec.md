# 16 — U-API 生图工具落地规格

> **状态**：客户端P0已实现；targeted tests、`typecheck:all`、lint、`validate:ci`、独立子进程build、Electron production build与WebUI production build已通过；2026-07-20在真实marker目录下完成11组generation /edit /参考图 /合成矩阵，11/11返回有效图片、8/11严格`ok`、3/11安全质量降级；最终macOS DMG中的Electron成功路径已完成真实端侧smoke，凭据隔离修复后的用户安装版也以一句自然语言成功生成并展示`1536x1024`图片。全量`bun test`与两个既有isolated suite仍有仓库基线失败；费用对账、多实例marker一致性、Electron异常态、WebUI live UI及正式签名 /notarization仍未完成，因此不代表生产已启用。
> **目标**：用户只说一句自然语言，U Agents 即复用当前会话的 U-API Token 完成纯文生图、参考图生成、图片编辑、角色延续或最多三图合成，并在当前回复中直接显示一张新图片。
> **证据**：目录、45次客户端观测到的operation请求、NewAPI源码依据、最终DMG端侧smoke、用户安装版复验与运维门禁见 [`16a-image-api-evidence.md`](16a-image-api-evidence.md)。
> **付费安全**：通用的一次性 invocation、取消和重放边界见 [`16b-paid-tool-lifecycle.md`](16b-paid-tool-lifecycle.md)。本规格只声明生图工具如何接入该最小合同。
> **关联规格**：LLM 出口服从 [`02-llm-gateway-spec.md`](02-llm-gateway-spec.md)；实施后同步 [`14-uapi-marker-registry.md`](14-uapi-marker-registry.md) 与 [`09-test-checklist.md`](09-test-checklist.md)。

---

## 0. 冻结结论

| 决策项 | P0 合同 |
|---|---|
| 用户入口 | 只有自然语言；不新增按钮、设置页、Provider、模型下拉框或第二把 Key |
| 工具 | 一个 canonical `generate_image`；`executionMode: 'registry'`、`safeMode: 'allow'`、非 `readOnly` |
| 可用范围 | 经认证的 Electron / WebUI 顶层交互消息；full Claude / Pi 可见。mini、Codex、Messaging、Automation 与内部调用不可执行 |
| U-API | 固定 `https://token.u-studio.cn/v1`；复用当前 `connectionSlug` 与聊天 Token |
| actual model | 每次任务读取当前 `GET /v1/models`；只使用本次目录返回的 exact `data[].id` |
| 默认选择 | 恰好一个条目同时含 `image-generation`、`uapi-image-edit-v1`、`uapi-image-default-v1`；否则零 POST |
| operation | 零输入图走 `POST /v1/images/generations`；一至三图走 multipart `POST /v1/images/edits` |
| 输出 | 固定 `n = 1`、`response_format = b64_json`；成功或安全降级结果都另存到当前 session `downloads/` 并直显 |
| 画幅 | `1:1`、`3:2`、`2:3`；不承诺精确 16:9 / 9:16 |
| 品质 | 纯文支持 `standard → medium`、`high → high`；带图只支持 `standard → medium` |
| 输入图 | 最多三张当前 session 图片；支持编辑底图、主体、风格、构图与插入物角色 |
| 防重复计费 | 一个顶层 user `Message.id` 只有一个 host-owned paid lease 和一个 accepted image execution；POST 发出后不自动重试、换模型或换协议 |
| 第一版模型 | 客户端不硬编码名称；运维首发只允许已验收的 exact `gpt-image-2` 获得两个自定义 marker |

### 0.1 用户成功定义

纯文生成：

1. 用户说“生成一张雨夜上海街头的电影感横图”。
2. agent 直接映射为 `3:2 + standard`，不询问模型、不打开设置、不追加工具确认。
3. 活动区显示本地化“生成图片”；成功后图片直接出现在当前回复并可全屏预览。

图片任务：

- 用户附一张图说“把背景换成雨夜，人物保持不变”：当前图片作为 `edit_target`，原图不覆盖。
- 用户说“让上一张里的角色去雪山，人物和衣服保持一致”：上一张成功结果作为 `subject_reference` 再次上传。
- 用户附两张图说“把图 2 的产品放到图 1 桌面上”：图 1 是 `edit_target`，图 2 是 `insert`，一次合成一张。
- 用户附三张图描述底图、角色和插入物：按用户表述顺序一次提交，不拆成多个付费请求。

默认规则：

- 纯文未说明画幅时用 `1:1`。
- 明确说“横图 / banner / 封面”用 `3:2`；“竖图 / 手机海报 / story”用 `2:3`。
- 带图任务若底图比例在三种支持画幅的 1% 内，直接沿用；否则只问一次：“当前编辑支持最接近的 X:X，是否扩展画布后继续？”未经确认不裁切、不改比例。
- 纯文只有明确要求“高清 /高品质”才用 `high`。
- 用户要求高品质编辑时只问一次：“当前编辑仅支持标准画质，是否按标准画质继续？”用户确认后才以 `standard` 执行。
- 多图角色明确时不追问；无法判断底图、参考图或合成目标时只问一个最短问题。
- “再来一版”是新的用户消息和新的独立费用；当前 stream 内的 steer 不获得第二次付费机会。

### 0.2 明确残余风险

`safeMode: 'allow'` 用于兑现“一句话完成”。它不能证明每次 tool call 都来自真实鼠标手势；持有有效认证的程序化客户端也能提交顶层消息。P0 用以下边界收敛风险：仅交互 RPC、用户明确图片意图、固定一张、一次性 invocation、无自动 retry / fallback、POST 后费用不确定提示。

P0 不承诺跨进程 exactly-once。应用崩溃后不恢复旧生图任务；旧进程 nonce 在新进程失效。若无法证明旧进程是否已发送 POST，必须提示用户先查 U-API 用量。

---

## 1. 产品范围

### 1.1 P0 必须完成

1. 一个 `generate_image` schema、薄 handler 与 `server-core` Images host service。
2. 纯文生成、单图编辑、参考图角色延续、两图与三图合成。
3. 同 Token 动态目录、唯一默认 marker、exact model ID 原样使用。
4. Electron / WebUI 当前回复直显与全屏预览。
5. 一个 invocation 最多一个付费 POST；取消、崩溃与费用不确定语义清楚。
6. PNG、JPEG、WebP 参考图的真实格式处理与 multipart 测试。
7. 实现测试、完整仓库 gates、运维发布门禁和两次授权 smoke。

### 1.2 P0 不做

- 不做 Google / Gemini、`gpt-image-2-client`、Gemini Native 或按名称分流。
- 不做用户模型选择、自由 `model_id`、价格 /余额、充值或新 Provider。
- 不做 mask 绘制、透明背景工具、variation endpoint、gallery、批量、一次多张或自动择优。
- 不做 edit `high`、四张及以上输入图。
- 不做 Messaging、Automation、Codex 生图或 WebUI 下载到浏览器设备。
- 不做自动重生、跨模型 /协议 fallback、URL 回源或 app restart 后恢复旧任务。
- 不新增 renderer↔server 公共 IPC、图片 DTO 或第二套预览组件。

### 1.3 P1 候选

| 能力 | 进入条件 |
|---|---|
| edit `high` /四图以上 | U-API 修复已测 `low` 降级，并发布新的 `uapi-image-edit-v*` 合同 |
| 其他模型 | 产品确认需求；每个 alias 独立完成 route、质量和费用矩阵 |
| Gemini | 重新评审 native transport、认证、响应和失败扣费，不复用名称猜测 |
| Messaging | turn 携带可信来源 `bindingId`，只向来源 binding 幂等交付 |
| Automation | 独立预算、频率上限、显式启用和无人值守失败通知 |
| mask / gallery /批量 | 另立交互、存储、费用与隐私规格 |

---

## 2. 当前代码边界

- [`packages/session-tools-core/src/tool-defs.ts`](../packages/session-tools-core/src/tool-defs.ts) 是 session tool schema、执行模式和 safe mode 正本；现有 `SessionToolFilterOptions` 还没有 `surface / agentKind`。
- [`packages/shared/src/agent/session-scoped-tools.ts`](../packages/shared/src/agent/session-scoped-tools.ts) 为 Claude 构建 registry tool，当前 cache key 是 `sessionId + workspaceRootPath`。
- [`packages/shared/src/agent/pi-agent.ts`](../packages/shared/src/agent/pi-agent.ts) 会通过未过滤的静态 registry 执行 Pi session tool。
- [`packages/session-mcp-server/src/index.ts`](../packages/session-mcp-server/src/index.ts) 会向 Codex 同时列出和执行 canonical registry；必须双向过滤。
- [`packages/server-core/src/sessions/SessionManager.ts`](../packages/server-core/src/sessions/SessionManager.ts) 已持有持久化 user `Message.id`、queue、steer、auth retry 与 source activation retry，是一次性付费状态的 host owner。
- [`packages/shared/src/agent/backend/types.ts`](../packages/shared/src/agent/backend/types.ts) 才是 `CoreBackendConfig` 与 `ChatOptions` 的正本；private paid context若随 `agent.chat()`传递，应在这里定义，不写进renderer DTO。
- [`packages/shared/src/config/u-api-defaults.ts`](../packages/shared/src/config/u-api-defaults.ts) 已冻结 U-API origin；[`packages/shared/src/credentials/manager.ts`](../packages/shared/src/credentials/manager.ts) 可按当前 `connectionSlug` 读取聊天 Token。
- [`packages/server-core/src/handlers/rpc/files.ts`](../packages/server-core/src/handlers/rpc/files.ts) 可能重编码附件但保留旧扩展名 / MIME metadata；生图输入必须以实际 buffer magic 为权威。
- [`packages/server-core/src/services/image-utils.ts`](../packages/server-core/src/services/image-utils.ts) 已通过platform `ImageProcessor`做真实图片解码；`sharp`由`server-core`持有，图片安全验证与落盘不得下沉到不依赖`sharp`的`shared`。
- [`packages/pi-agent-server/src/index.ts`](../packages/pi-agent-server/src/index.ts) 的`register_tools`是按名称merge而非全量replace；因此“未注册 /未列出”不是安全边界，main-process handler必须按当前surface /agent kind再次拒绝。
- [`packages/ui/src/components/markdown/MarkdownImageBlock.tsx`](../packages/ui/src/components/markdown/MarkdownImageBlock.tsx) 已能通过现有 `READ_DATA_URL` 路径直显和全屏预览。
- [`packages/ui/src/components/chat/TurnCard.tsx`](../packages/ui/src/components/chat/TurnCard.tsx) 默认折叠 tool activity；生图结果必须由 strict parser 提升到主回复，而不能依赖模型再次引用文件路径。

包边界冻结如下：

| 层 | 只负责 | 不负责 |
|---|---|---|
| `session-tools-core` | canonical schema、tool metadata、薄handler | Token、HTTP、文件系统、图片解码 |
| `core` | dependency-free的`uapi_generated_image` /error envelope类型与strict parser | 网络、UI、图片bytes |
| `shared` | Claude /Pi tool暴露、private chat context、owner callback与纯catalog /HTTP合同辅助 | `sharp`、session路径验证、落盘 |
| `server-core` | interactive origin、paid lease、manifest、凭据、Images请求编排、真实解码、安全落盘 | renderer展示 |
| `ui` | 复用`core` parser后的直显、警告、全屏预览 | 自行猜测ToolResult、读取任意路径 |

上述边界已按现状实现；后续上游同步必须按符号和 [`14-uapi-marker-registry.md`](14-uapi-marker-registry.md) #77–#81t复核，不得依赖易漂移行号。

---

## 3. 工具合同

### 3.1 canonical 用户 schema

```ts
const GenerateImageSchema = z.object({
  prompt: z.string().trim().min(1).max(16_000),
  aspect_ratio: z.enum(['1:1', '3:2', '2:3']).optional(),
  preset: z.enum(['standard', 'high']).optional(),
  input_images: z.array(z.object({
    ref: z.string().regex(/^img_[1-8]$/),
    role: z.enum([
      'edit_target',
      'subject_reference',
      'style_reference',
      'composition_reference',
      'insert',
    ]),
  }).strict()).min(1).max(3).optional(),
}).strict()
```

canonical schema还必须通过单一`superRefine`强制：

- `input_images[].ref` exact去重；同一图片不能以多个role重复上传。
- `edit_target`最多一个。
- `preset = high`与任何`input_images`同时出现时在联网前返回`input_invalid`；只有用户完成“按标准画质继续”的新消息才能改为`standard`。
- schema parser、Claude runtime schema与Pi proxy schema从同一正本派生，不复制约束。

禁止用户控制：`operation`、`model`、`provider`、`n`、`size`、`quality`、`response_format`、输出路径、URL、header、Token、base64、mask。

operation 只由输入图数量派生：

```text
0 images   -> generate
1..3 images -> edit
```

### 3.2 图片角色

| role | 语义 |
|---|---|
| `edit_target` | 底图；最多一个，只改变用户明确要求的部分 |
| `subject_reference` | 保持人物、角色或产品的可见身份特征 |
| `style_reference` | 借鉴色彩、材质、笔触，不默认复制主体 |
| `composition_reference` | 借鉴布局、镜头、空间关系，不默认复制内容 |
| `insert` | 把主体合成到底图或新场景，并匹配尺度、透视、光影 |

角色一致性是引用驱动的尽力保持，不宣传像素级、生物识别级或无限轮次一致。

### 3.3 visual manifest

每个顶层 invocation 冻结一次、最多八项：

1. 当前 user Message 的图片附件按用户看到的顺序在前。
2. 最近成功生图结果随后。
3. 再按时间倒序补当前 session 的历史图片附件。
4. 暴露给模型的只有 `img_1..img_8`、来源标签、真实 MIME、dimensions 和安全显示名；不含路径、附件 ID 或 base64。
5. 私有映射绑定完整 execution nonce；旧 turn ref 不回查当前 manifest。
6. 工具一次最多选择三项，multipart 顺序与数组顺序一致。

模型可据“当前附件 1”“上一张生成图”等稳定标签选择；若用户语义不能唯一定位历史图片，只问一次，不猜。

### 3.4 runtime replay nonce与host lease

canonical 用户 schema 不含安全字段。Claude / Pi runtime schema额外要求一个 host 提供的 `_uapi_execution_nonce`；host 在当前 volatile turn context 中提供 exact 值，handler 在执行前剥离。

nonce 只用于把 tool call 绑定到当前顶层 invocation：

- 当前进程、当前 turn exact 匹配才可进入 preflight。
- 同进程旧 turn为 `not_sent`。
- 旧进程 nonce 为 `possibly_charged`，零凭据、零网络。
- nonce、host correlation 不进入 ToolResult、新日志或用户可见 activity。

nonce不是credential、owner或付费claim依据。费用安全使用host在原子取得preflight时生成的128-bit opaque `leaseToken`：

- `leaseToken`只存在于`SessionManager`进程内record与同一`AbortController`对象中。
- 模型、renderer、canonical args、SDK `toolUseId`、ToolResult和日志都不能提供或覆盖它。
- `toolUseId`只保留现有UI事件关联用途；canonical handler没有稳定的跨Claude /Pi `toolUseId`执行合同，不能据此授权或claim。
- claim前同步重查current record仍属于同一`invocationId + ownerToken + leaseToken`，中间不得`await`。

`SessionManager.processEvent(tool_start)`在`formatToolInputPaths`和消息持久化前调用一个canonical redactor，至少删除`_uapi_execution_nonce`、lease /owner /host correlation、绝对路径和私有manifest映射。UI二次隐藏只能作为纵深防护，不能替代落盘前redaction。

参数错误在 POST 前不构成费用风险。SDK 或 host 拒绝非法 schema 后，允许模型在同一 invocation 内有限自修正；只有一个合法 call 能取得 preflight lease。不得因一次无费用格式错误 poison 整个 turn。

---

## 4. 用户意图与 prompt

description 必须告诉 Claude / Pi：

- 只有用户明确要求生成、修改、参考、保持角色或合成图片时调用。
- 一次只生成一张，不主动配图、后台预生成或连续比较。
- 简单描述只补必要构图和用户已有约束，不擅自添加人物、品牌、文字、道具或情节。
- 编辑必须重复用户要求保留的不变量。
- 当前 manifest 有唯一明确图片时直接调用；多图职责不清时先问一个问题。
- 用户指定未支持模型时说明首发版不支持，不静默换成 `gpt-image-2`。

host 在 upstream prompt 末尾追加最小、固定英文块：

```text
Input image roles:
Image 1: edit target. Change only what the user requested; preserve unspecified identity, text and geometry.
Image 2: subject reference. Preserve the same visible identity and defining traits.

Canvas constraint: use a landscape 3:2 canvas.
```

实际只输出存在的角色行。对已经由用户确认“扩展画布”的非标准比例，host 要明确使用扩展画布而非裁切；不能同时要求变更 canvas 又宣称原 framing 完全不变。

---

## 5. 动态模型发现

### 5.1 固定顺序

1. 验证 interactive origin、full agent、当前 nonce、未 steer / stop。
2. 解析 manifest ref，并把输入文件读成已验证 buffer。
3. 原子生成并取得host `leaseToken`；并发或重复调用在凭据 /网络前失败。
4. 确认resolved locked connection同时满足`isUApiSlug(connectionSlug)`与normalized `baseUrl === https://token.u-studio.cn/v1`，再按该exact slug读取一次当前Token snapshot。
5. 用同一 snapshot 请求 `GET https://token.u-studio.cn/v1/models`。
6. 解析本次目录并选择唯一 default；调用前最后检查 stop / duplicate。
7. 保持同一`leaseToken`与同一`AbortController`对象，准备operation请求。
8. 无`await`重查同一`invocationId + ownerToken + leaseToken`后原子标记claimed，发送一个operation POST。

输入文件校验发生在 Token 和目录 GET 前；一次 invocation 最多一个目录 GET和一个 operation POST。

### 5.2 目录解析

- HTTP 必须 2xx；若有 `success`，不得为 `false`；`data` 必须是数组。
- `id` 是 1—256 字符 string，不得 trim、lowercase、改写或含控制字符。
- 同一响应出现重复 exact ID视为配置错误。
- `supported_endpoint_types` 必须是 string array。
- 本次目录只对本次调用权威；不与旧目录并集、不失败回退旧 cache。

唯一选择：

```text
eligible = entries where supported_endpoint_types contains all of:
  image-generation
  uapi-image-edit-v1
  uapi-image-default-v1
```

只有 `eligible.length === 1` 可执行。不得使用名称 substring、`owned_by`、目录顺序、价格、上次成功模型或供应商官网名参与选择。

第一版运维只允许 exact `gpt-image-2` 获得两个自定义 marker；客户端 resolver 仍不硬编码该名称。配置与迁移流程见证据文档 §5。

---

## 6. Images transport

### 6.1 纯文 generation

```http
POST /v1/images/generations
Authorization: Bearer <current U-API Token>
Content-Type: application/json
```

```json
{
  "model": "<exact current catalog id>",
  "prompt": "<user prompt + host canvas suffix>",
  "n": 1,
  "size": "1024x1024",
  "quality": "medium",
  "response_format": "b64_json"
}
```

映射：

| aspect ratio | size | suffix |
|---|---|---|
| `1:1` | `1024x1024` | `use a square 1:1 canvas` |
| `3:2` | `1536x1024` | `use a landscape 3:2 canvas` |
| `2:3` | `1024x1536` | `use a portrait 2:3 canvas` |

`standard → medium`，`high → high`。

### 6.2 multipart edit

固定 parts：

| part | 合同 |
|---|---|
| `model` | 本次 catalog 的 exact ID |
| `image[]` | 一至三次，按角色数组顺序；内容来自已验证 buffer |
| `prompt` | 用户 prompt + 图片角色 /不变量 + 已确认 canvas 约束 |
| `n` | `1` |
| `size` | 三个固定尺寸之一 |
| `quality` | `medium` |
| `response_format` | `b64_json` |

必须让运行时生成 multipart boundary。上传名不使用原文件名，而由 buffer magic 派生：`image-1.png`、`image-1.jpg`或`image-1.webp`；part MIME、扩展名和 bytes 必须一致。

### 6.3 HTTP 安全

- origin、path、method固定；actual model ID只进入 JSON 或 text part。
- `redirect: 'error'`；Authorization 不得转发第二地址。
- discovery timeout 10 秒；operation timeout 180 秒。
- catalog响应上限 2 MiB；Images JSON响应上限 48 MiB；decoded image上限 32 MiB。
- 输入每张不超过10 MiB、合计不超过30 MiB。
- 生产 Debug 不得记录 Authorization、prompt、multipart图片或完整 response body。

---

## 7. 图片校验与交付

### 7.1 输入图片

以实际 buffer 为权威：

- 从可信 session parent 重建候选路径，拒绝任意用户路径。
- `lstat / realpath`验证 regular file、非 symlink与 containment。
- 用 file handle一次性读入并完成 byte上限、magic、dimensions 校验。
- 允许静态 PNG、JPEG、WebP；不依赖可能陈旧的 `StoredAttachment.mimeType`或扩展名决定真实类型。
- GIF、SVG、HEIC、PDF、mask和其他格式 P0 拒绝。
- multipart只使用已验证 buffer，不在网络阶段再次按路径打开。

上线前必须至少完成一次 JPEG 与一次 WebP 的生产等价 edit canary；在此之前不能把它们标为已验收。若 route 不支持，P0 要么在规格重新评审后收窄为 PNG，要么增加有界、明确的本地规范化；不能让扩展名伪装成 PNG。

### 7.2 成功与安全降级

响应必须是 HTTP 2xx、可解析 JSON、恰好一个非空 `data[0].b64_json`。URL-only、多图、data URL或未知图片载荷拒绝。

base64 解码后验证：

- PNG/JPEG/WebP magic与MIME；
- 每边 512—3840；总像素不超过8,294,400；
- header完整、无畸形 dimensions；
- 文件与响应容量有界。

语义合同分开处理：

| 情况 | 用户结果 |
|---|---|
| 安全图片，画幅在目标 ratio 1% 内，响应 `quality`匹配 | `ok`，正常保存并显示 |
| 安全图片，但 `quality`缺失 | `degraded: quality_unverified`，仍保存显示并警告 |
| 安全图片，但响应明确声明其他 `quality` | `degraded: quality_downgraded`，仍保存显示并警告 |
| 安全图片，但画幅超出目标 ratio 1% | `degraded: aspect_ratio_changed`，仍保存显示并警告 |
| base64 / magic / dimensions安全校验失败 | `result_invalid`，不保存、不回源 |
| 保存失败 | `result_invalid`，不再次生成 |

安全降级不是成功门禁：运维 canary只接受 `ok`。运行期 route漂移时仍把用户已经付费获得的安全图片交付，同时明确“结果未满足请求，不会自动重试，请先查用量”。

### 7.3 落盘

- 文件名由 host UUID生成，不含 prompt、模型或原文件名。
- 在可信 session parent下检查 /创建 `downloads/`；拒绝 symlink、非目录和 canonical parent越界。
- 使用 `wx`独占写入，不覆盖已有文件。
- 同 OS 用户并发 rename无法仅靠 Node 文件 API完全防住，作为本地信任模型残余风险记录。

---

## 8. ToolResult、错误与 UI

### 8.1 成功 envelope

```json
{
  "kind": "uapi_generated_image",
  "version": 1,
  "operation": "edit",
  "contract_status": "ok",
  "input_image_count": 2,
  "file_name": "generated-image-550e8400-e29b-41d4-a716-446655440000.png",
  "gateway_model_id": "<exact catalog id>",
  "mime_type": "image/png",
  "width": 1024,
  "height": 1024
}
```

安全降级额外包含且只包含：

```json
{
  "contract_status": "degraded",
  "warning": "quality_downgraded"
}
```

`warning` allowlist：`quality_unverified | quality_downgraded | aspect_ratio_changed`。

### 8.2 错误 envelope

```text
[ERROR] {"kind":"uapi_image_error","version":1,"category":"service_unconfigured","charge_state":"not_sent"}
```

八个稳定 `category`：

| category | 典型原因 | 用户动作 |
|---|---|---|
| `connection_unavailable` | 非 U-API、缺 Token、catalog网络 /认证失败 | 检查连接或稍后新发消息 |
| `service_unconfigured` | 无唯一 default、marker / route未启用 | 联系管理员或稍后再试 |
| `quota_exceeded` | 明确额度错误 | 前往 U-API 处理额度 |
| `content_rejected` | 明确 moderation / policy | 修改描述后新发消息 |
| `input_invalid` | ref、角色、格式、文件或画幅确认无效 | 重新附图或说明用途 |
| `request_uncertain` | POST timeout、abort、断网、旧进程 replay | 先查用量，不直接重试 |
| `result_invalid` | 不安全响应或保存失败 | 先查用量，再决定是否新发 |
| `not_executable` | busy、steer、mini、非 interactive、旧 turn | 等待结束或在支持界面新发 |

`charge_state`只有 `not_sent | possibly_charged`。claim 前为 `not_sent`；claim 后无法证明未执行时为 `possibly_charged`。

### 8.3 UI

- exact completed `generate_image`成功 envelope由`packages/core`唯一strict parser验证；`SessionManager`与UI复用同一结果，分别重建`<session>/downloads/<validated basename>`与显示数据，不复制parser。
- 默认折叠 activity时，图片仍在主回复显示一次。
- `degraded`图片显示本地化警告，不提供一键重试。
- error-only turn必须可见；`possibly_charged`固定提示先查 U-API 用量。
- `TurnCard.getToolDisplayName()`必须接入七个locale中的`generate_image`活动名，不能继续显示硬编码英文或raw tool name。
- P0 所有客户端只承诺内联与全屏预览。生成图 overlay隐藏 Open / Reveal / Copy Path及服务端绝对路径；本机文件动作降为 P1，避免引入全局 `PlatformContext`改造。
- expanded tool input只显示用户可理解的prompt、画幅、品质和输入图数量；必须使用落盘前已redact的输入，不显示nonce、lease、owner、host correlation、内部ref映射和绝对路径。

---

## 9. 隐私与合规

必须如实说明：prompt与选中的参考图片会发送到 U-API及其实际上游；用户消息、附件与canonical tool args仍按现有 session journal合同持久化。P0只保证不把它们再次复制进新增日志、ToolResult、文件名或专用 metadata。

生产开放前的硬门禁：

- 用户协议与隐私政策明确“用户 → U Agents → U-API → 实际上游”的图片数据流。
- 说明输入图片、prompt、生成结果、内容审核、留存与用户删除边界。
- 按 [`LEGAL.md`](../LEGAL.md) §6复核面向公众提供生成式 AI 能力所需的备案 /合规义务。
- 已暴露的临时 Token完成轮换；文档、日志和测试产物中没有 Token或hash。

---

## 10. 最小实施范围

### 10.1 canonical contract与共享结果

1. [`packages/session-tools-core/src/tool-defs.ts`](../packages/session-tools-core/src/tool-defs.ts)：strict schema、description、`surface / agentKind` metadata与集中filter。
2. [`packages/session-tools-core/src/context.ts`](../packages/session-tools-core/src/context.ts)：可选窄能力 `generateImage()`。
3. `packages/session-tools-core/src/handlers/generate-image.ts`及必要 index：薄handler，只调用 capability。
4. `packages/core/src/types/uapi-image-result.ts`与[`packages/core/src/types/index.ts`](../packages/core/src/types/index.ts)：dependency-free strict envelope parser、类型、allowlist和安全basename校验，供host与UI共同复用。

### 10.2 agent暴露与private context

5. [`packages/shared/src/agent/backend/types.ts`](../packages/shared/src/agent/backend/types.ts)：为`ChatOptions` /`CoreBackendConfig`增加不可由renderer写入的窄paid turn context与owner capability；不得加入`SendMessageOptions`或公共IPC DTO。
6. [`packages/shared/src/agent/paid-image-tool-registry.ts`](../packages/shared/src/agent/paid-image-tool-registry.ts)与[`claude-context.ts`](../packages/shared/src/agent/claude-context.ts)：新增独立的canonical session path + opaque owner paid callback，compare-and-delete；不迁移其他callback。
7. [`packages/shared/src/agent/session-scoped-tools.ts`](../packages/shared/src/agent/session-scoped-tools.ts)：Claude surface / full过滤；cache identity包含agent kind，image callback不固化进跨agent cache。
8. [`packages/shared/src/agent/backend/pi/session-tool-defs.ts`](../packages/shared/src/agent/backend/pi/session-tool-defs.ts)与[`pi-agent.ts`](../packages/shared/src/agent/pi-agent.ts)：Pi复用同一canonical schema，注册前过滤并在执行时再次验证当前surface /full、owner和nonce。
9. [`packages/shared/src/agent/claude-agent.ts`](../packages/shared/src/agent/claude-agent.ts)传递owner；当前turn nonce /manifest volatile context与stop失效由[`SessionManager.ts`](../packages/server-core/src/sessions/SessionManager.ts)持有。没有修改`base-agent.ts`，也不把SDK `toolUseId`作为paid lease identity。
10. [`packages/session-mcp-server/src/index.ts`](../packages/session-mcp-server/src/index.ts)：Codex `ListTools` /`CallTool`双向过滤；陈旧直调仍拒绝。

### 10.3 server host、transport与图片安全

11. `packages/server-core/src/services/u-api-image-generation.ts`及[`services/index.ts`](../packages/server-core/src/services/index.ts)：唯一Images host service，负责目录resolver、generation /edit transport、同一Token snapshot、响应上限与错误分类。
12. [`packages/server-core/src/services/image-utils.ts`](../packages/server-core/src/services/image-utils.ts)：复用platform `ImageProcessor`完成PNG /JPEG /WebP真实解码、dimensions与响应安全校验；不在`shared`复制图片parser。
13. [`packages/server-core/src/sessions/SessionManager.ts`](../packages/server-core/src/sessions/SessionManager.ts)只在现有RPC层传入可信`callerClientId`且消息非hidden时创建private `interactive` context；`sessions.ts`与renderer DTO均未新增付费字段。
14. [`packages/server-core/src/sessions/SessionManager.ts`](../packages/server-core/src/sessions/SessionManager.ts)：按canonical session path + user `Message.id`维护paid record、frozen manifest、host `leaseToken`、redactor与取消；auth /source recovery在未进入preflight时保留原`Message.id`和context，不能删除后创建新ID。

[`packages/server-core/src/handlers/session-manager-interface.ts`](../packages/server-core/src/handlers/session-manager-interface.ts)与公共`sendMessage()`合同默认保持不变；优先在`SessionManager`内部增加private continuation seam。若实现证明必须改公共接口或renderer DTO，立即触发§10.5停止条件。

### 10.4 UI、i18n与测试登记

15. [`packages/ui/src/lib/tool-parsers.ts`](../packages/ui/src/lib/tool-parsers.ts)与[`TurnCard.tsx`](../packages/ui/src/components/chat/TurnCard.tsx)：消费`core` parser，主回复直显、error-only可见，并把`getToolDisplayName('generate_image')`接入i18n；未修改`turn-utils.ts`。
16. [`packages/ui/src/components/markdown/MarkdownImageBlock.tsx`](../packages/ui/src/components/markdown/MarkdownImageBlock.tsx)、[`ImagePreviewOverlay.tsx`](../packages/ui/src/components/overlay/ImagePreviewOverlay.tsx)与[`PreviewOverlay.tsx`](../packages/ui/src/components/overlay/PreviewOverlay.tsx)：对生成图增加`hideFileActions`，隐藏Open /Reveal /Copy Path，内部仍通过现有data URL读取。
17. [`packages/shared/src/i18n/locales/`](../packages/shared/src/i18n/locales)：七个locale新增固定活动、八类错误与三类降级文案；同步更新[`09-test-checklist.md`](09-test-checklist.md)中的真实key count与生图回归项。
18. 相邻`__tests__`、package index /exports与fixture：每个新增U-API改造点同时有marker和测试，完成后刷新[`14-uapi-marker-registry.md`](14-uapi-marker-registry.md) §0 /§3；不得预填实施前marker数量。

### 10.5 停止条件

出现以下任一情况，先回到本文说明原因，不能靠扩大write set绕过：

- 需要修改`packages/pi-agent-server`协议来传递`toolUseId`；应优先使用host `leaseToken`。
- 需要让`shared`依赖`sharp`或复制PNG /JPEG /WebP解码器。
- 需要新增renderer↔server公共IPC字段来声明`origin`、nonce、lease或owner。
- 同一Pi subprocess确实会在full /mini之间原地切换且无法由执行端gate收口；此时另行评审显式unregister或安全重建。
- 共享结果parser无法同时被`SessionManager`与UI复用。

不修改：设置页、Provider配置、高冲突连接文件、公共IPC、WebUI adapter、Messaging、Automation、聊天模型 discovery、NewAPI源码或全局文件预览能力。

若实施超出上述范围，先回到规格说明原因；不得为了本工具顺手重构全局source grammar、所有callback或通用持久化队列。

---

## 11. 测试与发布顺序

### 11.1 本地 fixture

- schema：四个用户字段、strict unknown key、角色、0—3图、edit high拒绝。
- schema invariants：duplicate ref、第二个`edit_target`、同ref多role均在零凭据 /零网络阶段拒绝。
- backend parity：full Claude / Pi可见；mini / Codex列表与直调都拒绝；cache构建顺序不泄露。
- nonce /lease：当前turn首次调用成功；旧turn /旧process /伪造nonce零凭据、零网络；不同SDK `toolUseId`不能替换或重取host lease。
- 自修正：一次未发送POST的格式错误后，合法修正仍可取得唯一lease；并发合法call只有一个进入网络。
- recovery：auth retry保持原user `Message.id` /context；source pending exact match继承，legacy suffix与无record均为internal。
- resolver：0 /1 /2 default、marker分裂、unknown version、重复ID、目录变化和误导名称。
- generation：三画幅、两品质、固定 `b64_json / n=1`。
- edit：一至三图、角色顺序、PNG/JPEG/WebP真实magic与匹配上传名、无原文件名 /路径。
- response：ok、三类degraded、非法base64、危险dimensions、URL-only和多图。
- lifecycle：preflight stop零POST；claimed stop /timeout为possibly charged；第二次调用零POST。
- writer：首次创建downloads、EEXIST、symlink、非目录、越界、`wx`冲突。
- result parser：host /UI对同一合法、unknown key、错误version、危险basename与畸形dimensions得到一致结论。
- persistence /UI：`tool_start`落盘前剥离nonce /lease /owner /绝对路径；live /reload直显一次、degraded警告、error-only、本地化活动名与隐藏文件动作。
- i18n：七个locale parity、coverage、sorted。

### 11.2 实施 gates

```bash
bun test <本规格 targeted tests>
bun run typecheck:all
bun run lint
bun run validate:ci
bun run server:build:subprocess
bun run scripts/copy-subprocess-servers.ts
bun test
```

实施时按实际脚本核对，不得把 targeted tests表述成全量通过。`session-mcp-server`独立bundle必须重新构建并验证不暴露 `generate_image`。

#### 11.2.1 2026-07-20 实施与安装包证据

- 最终生图 /路径 /UI组合回归：**70 pass / 0 fail / 199 expects**，覆盖10个测试文件；其中包含realpath根目录规范化、strict result parser、重复附件清理、生命周期与工具隔离。
- 真实字节fixture：测试内由`sharp`生成PNG、JPEG、WebP并走headless真实decoder；multipart顺序、MIME与neutral filename通过。
- `bun run typecheck:all`、`bun run lint`、`bun run validate:ci`均exit 0；i18n为en + 6个非英语locale，parity /sorted /coverage全绿。
- `bun run server:build:subprocess`与`bun run scripts/copy-subprocess-servers.ts`通过，session MCP与Pi独立bundle成功生成/复制。
- `bun run electron:build`与`bun run webui:build`均exit 0；production renderer、main、preload、resources和WebUI bundle均可构建。
- 全量`bun test`（凭据隔离修复后最终复跑）：**5791 pass / 12 skip / 29 fail / 5 errors**，共5832 tests、463 files。失败集中于既有browser-pane /WebUI /developer-feedback基线及被误扫的`apps/electron/release/`源码副本；本次生图、凭据隔离与headless suite没有失败。故“完整repo gates全绿”仍为未完成，不能用targeted结果替代。
- 顶层`test`脚本会在上述全量失败后停止，故另行逐个执行5个源码侧`*.isolated.ts`：`pre-tool-use-checks` 69 pass、`notifications-routing` 2 pass、`sessions-annotations` 3 pass；`prerequisite-manager`为13 pass /20 fail（其`node:fs` mock使新增的config defaults读取固定失败），`session-branch-rollback`为0 pass /1 fail /1 error（`packages/shared/src/config/index.ts`既有`CONFIG_DIR`导出缺失）。两组失败均不在本次生图write-set，但仍阻塞完整repo gates。
- 本轮使用用户授权的临时Token先验证缺marker fail-closed；用户修正后台后，真实目录只让exact `gpt-image-2`同时满足三个必需marker。完整矩阵每次重新GET目录，11个invocation各一次claim、一次POST，全部HTTP 200且无retry /fallback。
- 纯文standard三画幅、PNG /JPEG /WebP单图编辑、两图与三图合成共8项返回`ok`；high纯文、角色延续与style reference共3项返回有效图片但被客户端正确标为`degraded + quality_downgraded`。11张图均通过字节 /MIME /尺寸检查和逐张人工查看。详细耗时、字节数、multipart和视觉边界见16A §8.2。
- v0.11.1 macOS DMG完成完整build、`hdiutil verify`、adhoc codesign校验，并从只读挂载包启动真实Pi subprocess。端侧一次operation返回exact `gpt-image-2`的`ok` PNG `1254x1254`；持久化重载、工具卡直显、全屏与缩放通过，且不暴露服务端路径。首次运行发现的`/tmp -> /private/tmp`误拒绝和重复附件 /空回复卡已修复、重新打包并以原图零新增POST复验。
- 后续用户安装发现§8.3的`U_AGENTS_CONFIG_DIR`没有隔离`SecureStorageBackend`：临时Token曾覆盖正式`~/.u-agents/credentials.enc`。现已让凭据复用`CONFIG_DIR`，新增主变量 /旧变量 /默认路径三组子进程回归，并隔离headless smoke。修复后的最终DMG SHA-256为`8d955394e16abb97bfd6eb520b6dcd324cef3ee78eeb8eb42d73b5ebdc71f25a`；bundle确认`CREDENTIALS_DIR = CONFIG_DIR`且不含临时Token。详见16A §8.4。
- 用户安装上述修复后最终DMG，在正常桌面会话中用一句自然语言生成小猫趴在牛背上的图片；单个工具卡正确显示`1536x1024`结果与已保存文件链接，没有重复破图或空回复卡。本次新增1次客户端观测到的operation调用，累计数为45；route /Debug、费用归属与Token轮换仍按发布门禁处理。详见16A §8.5。
- 当前单Token目录配置、客户端主链和Electron成功路径已获真实证据，但没有开放普通流量、完成跨实例cache回读、后台费用对账、Electron异常态或WebUI live UI smoke；当前包为adhoc且未notarize。严格发布门禁仍未通过，临时Token必须轮换。

### 11.3 发布顺序

1. [x] 缺marker时验证resolver fail-closed；用仓库外临时注入验证transport，但不把注入当成生产能力。
2. [x] 只给 exact `gpt-image-2`配置 `uapi-image-edit-v1 + uapi-image-default-v1`；当前Token目录回读到唯一eligible model。
3. [x] 经实现后的U Agents service完成11组受控真实矩阵；PNG /JPEG /WebP编辑及standard三画幅通过，high与两项参考图case暴露quality降级。
4. [ ] 暂停普通生图流量，审计全节点channel、route、`model_mapping`、retry /failover、timeout和Debug；失效cache并逐实例 /cache domain回读唯一default。
5. [ ] 核对客户端本轮11个POST、NewAPI 11条operation记录和上游用量；调查3次`quality_downgraded`，直到相关canary均为`contract_status = ok`或产品明确修改质量门禁。
6. [x] 用最终macOS DMG验证Electron成功路径：真实operation、保存、历史重载、当前回复直显、全屏缩放和隐藏服务端路径；修复真实端侧发现的路径别名与重复渲染问题并重新打包复验。
7. [x] 修复端侧测试凭据隔离事故：`credentials.enc`与config /workspace /server lock统一服从`CONFIG_DIR`；三路径回归、headless隔离、最终bundle与临时Token零命中通过。
8. [ ] 用Electron安装包验证degraded、error-only与`possibly_charged`提示；完成WebUI live UI smoke，并复核用户协议与隐私政策。
9. [ ] 配置正式macOS发布证书并完成notarization；当前adhoc包只用于开发验收。
10. [ ] 轮换临时Token。上述门禁全部通过后才开放普通流量；任一失败保持quiesced，必要时同时撤两个自定义marker，不尝试其他模型。

具体marker JSON、历史矩阵、运维门禁与smoke记录见 [`16a-image-api-evidence.md`](16a-image-api-evidence.md) §2—§9。

---

## 12. P0 完成判定

- [ ] 用户对纯文、编辑、角色延续和最多三图合成可一句话完成；只有真实歧义、非支持画幅或高品质编辑各问一次最短问题。
- [x] 同一 U-API connection / Token；没有新配置和模型选择。
- [x] 每次目录读取actual ID；唯一三marker条目才能POST，客户端不按名称猜模型。
- [x] generation与edit共用一个adapter；固定一张、三画幅、纯文两品质、edit standard。
- [x] PNG/JPEG/WebP实际buffer、MIME与neutral filename一致并通过真实canary。
- [x] 一个 user `Message.id`最多一个operation POST；参数无费用错误可有限自修正，POST后无retry /fallback。
- [x] host `leaseToken`而非SDK `toolUseId`承担preflight /claim identity；auth /source recovery不改写原invocation identity。
- [x] 安全的质量 /画幅降级图片仍显示并警告；危险或损坏图片不保存。
- [ ] Electron /WebUI主回复直显、全屏预览、error-only与possibly charged提示通过；生成图不暴露服务端路径。当前Electron成功路径的直显、重载、全屏缩放与路径隐藏已通过，异常态和WebUI live UI仍未完成。
- [x] host与UI复用`core` strict parser；`tool_start`持久化前已redact内部nonce /lease /owner。
- [x] 测试 /多实例配置覆盖时，`credentials.enc`与全部状态共同服从`CONFIG_DIR`；不得写入正式`~/.u-agents`。
- [x] full /mini /Codex过滤，Claude /Pi parity，取消、旧turn和旧process重放自动化测试通过。
- [ ] marker配置、逐实例一致性、route、Debug、费用对账与两次实现后smoke通过。
- [ ] 用户协议 /隐私政策已覆盖图片数据流；临时Token已轮换。
- [ ] targeted、完整repo gates和独立bundle均如实通过。
- [x] 所有实际新增 `// U-API:`改造点已登记，交付明确列出“本次未做”。

本文的客户端P0代码已经落地，当前Token下的生产marker已单节点回读并完成真实矩阵，最终macOS DMG的Electron成功路径也已验收；但这不代表多实例cache一致、费用已对账、异常态与WebUI已验收、正式签名 /notarization完成或目录长期稳定。全部发布门禁通过前不得对普通流量宣称可用。
