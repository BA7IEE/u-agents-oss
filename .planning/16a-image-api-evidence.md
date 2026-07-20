# 16A — U-API 生图接口证据与运维门禁

> **状态**：2026-07-19 初始接口快照；2026-07-20 已由当前客户端service完成缺marker fail-closed检查、marker修正后的唯一模型回读、11组真实operation矩阵、最终macOS DMG中的Electron成功路径端侧smoke，以及凭据隔离修复后的用户安装版复验。本文不是长期能力声明，也不是客户端静态模型表。
> **用途**：保存 [`16-image-generation-tool-spec.md`](16-image-generation-tool-spec.md) 的目录、generation / edit、NewAPI实现和上线证据。产品与客户端合同以主规格为准。
> **计费说明**：本文累计记录45次客户端观测到的 operation POST，都可能产生费用，尚未完成U-API /上游逐笔对账。临时Token已在对话中暴露，必须轮换。

---

## 1. 证据边界

所有真实请求均由用户明确授权（早期逐次授权，本轮一次授权跑完整矩阵），使用同一临时Token和 `https://token.u-studio.cn`；没有HTTP自动retry、模型fallback或Gemini Native fallback。Token未写入仓库、请求文件或响应文件。

这些证据只能证明：

- 对应时间、Token group /model-limit与当时命中的route；
- 请求表中列出的exact alias和参数组合；
- 客户端观察到的HTTP、JSON、图片和有限人工视觉结果。

不能证明：

- 所有生产用户看见同一目录；
- public alias等于上游模型名；
- 任一节点、cache domain或未来route保持一致；
- HTTP失败一定不计费；
- 单个视觉样本代表稳定角色一致性或模型优劣。

---

## 2. `/v1/models` 快照

| `fetched_at_utc` | 次数 | 结果 | 生图相关结论 |
|---|---:|---|---|
| `2026-07-19T08:48:43Z` | 2 | HTTP 200、11 IDs | 三个生图名称可见，尚无 `image-generation` |
| `2026-07-19T09:15:35Z` | 1 | HTTP 200、10 IDs | 三个名称新增 `image-generation` |
| `2026-07-19T09:17:03Z` | 3 | HTTP 200、5 IDs | 生图名称仍在，其他聊天模型暂时消失 |
| `2026-07-19T11:07:22Z—11:07:24Z` | 3 | HTTP 200、11 IDs | exact集合一致，仍无default marker |
| `2026-07-19T14:47Z` | 1 | HTTP 200、11 IDs | Gemini `owned_by = google gemini` |
| `2026-07-19T14:56:32Z` | 1 | HTTP 200、11 IDs | Gemini `owned_by`漂为 `openai` |
| `2026-07-19T15:14:41Z` | 1 | HTTP 200、11 IDs | Gemini `owned_by`漂回 `google gemini`，route仍失败 |
| `2026-07-19T15:19Z` | 1 | HTTP 200、11 IDs | `gpt-image-2`为 `openai + image-generation` |
| `2026-07-19T16:27:51Z` | 1 | HTTP 200 | `gpt-image-2`仍无两个自定义marker |
| `2026-07-20` | 4 | HTTP 200 | 三个生图条目均只有标准声明；`gpt-image-2`仍无两个自定义marker；当前客户端真实resolver返回`service_unconfigured`且零POST |
| `2026-07-20`（marker修正后） | 12 | HTTP 200 | 每次目录读取均只有exact `gpt-image-2`同时包含三个必需marker；11次operation各自重新解析且均选择同一exact ID |

`2026-07-19T15:19Z`完整actual ID：

`deepseek-v4-pro`, `gemini-3-pro-image-preview`, `glm-5.2`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-sol`, `gpt-image-2`, `gpt-image-2-client`, `k3`, `minimax-m3`, `qwen3.5-plus`。

最新目标条目：

| exact ID | `owned_by` | 标准 endpoint types | edit marker | default marker | 结论 |
|---|---|---|---|---|---|
| `gpt-image-2` | `openai` | `openai`, `image-generation` | 有 | 有 | 当前Token下唯一eligible exact model |
| `gpt-image-2-client` | `openai` | `openai`, `image-generation` | 无 | 无 | 历史方图变横图，P0排除 |
| `gemini-3-pro-image-preview` | 漂移 | `gemini`, `openai`, `image-generation` | 无 | 无 | 四次Images POST失败，P0排除 |

目录事实说明：`supported_endpoint_types`比模型名称可靠，但仍只是声明，不等于channel可执行或费用合同成立。

---

## 3. generation 实测

### 3.1 初始诊断：10 POST

| # | exact model | 请求差异 | HTTP /响应 | 解码 /判定 |
|---:|---|---|---|---|
| 1 | `gpt-image-2` | `1024x1024`, medium, omit format | 200、URL-only | 未回源；证明默认不是base64 |
| 2 | `gpt-image-2` | `1536x864`, high, omit format | 200、URL-only | 任意16:9与默认format不可用 |
| 3 | `gpt-image-2` | `864x1536`, medium, omit format | 200、URL-only | 任意9:16与默认format不可用 |
| 4 | `gpt-image-2-client` | `1024x1024`, medium, omit format | 200、单个base64 | PNG 1,882,062 bytes，实际 `1536x1024`，比例失败 |
| 5 | `gemini-3-pro-image-preview` | `1024x1024`, medium | 500 `get_channel_failed` | 无图 |
| 6 | `gpt-image-2` | `1024x1024`, medium, `b64_json` | 200、单个base64 | PNG 1,865,143 bytes，实际 `1536x1024`，当时route比例失败 |
| 7 | `gpt-image-2` | `1024x1536`, high, `b64_json` | 200、单个base64 | PNG 1,805,200 bytes，`1024x1536`，通过 |
| 8 | Gemini | 用户授权重试 | 500 `get_channel_failed` | 无图 |
| 9 | Gemini | 用户报告扣费后再次授权 | 500 `get_channel_failed` | 无图；错误名不能证明未计费 |
| 10 | Gemini | 用户称后台选择已纠正后授权 | 500 `get_channel_failed` | 无图；停止Google测试 |

结论：

- 客户端必须显式 `response_format = b64_json`。
- 不使用任意16:9 /9:16尺寸；统一为NewAPI标准方、横、竖尺寸。
- POST发出后不能根据 `get_channel_failed`名称断言未触达 /未计费。
- `gpt-image-2-client`与Gemini不进入P0 fallback。

### 3.2 `gpt-image-2`聚焦矩阵：9 POST

全部固定 `n = 1`、`response_format = b64_json`，HTTP 200、恰好一个可解码PNG。

| 请求 | quality | 耗时 | 实际PNG | bytes | 判定 |
|---|---|---:|---|---:|---|
| `1024x1024` | medium | 25.29s | `1254x1254` | 1,910,803 | 1:1通过 |
| `1024x1024` | high | 25.34s | `1254x1254` | 1,792,257 | 1:1通过 |
| `1536x1024` | medium | 54.38s | `1536x1024` | 2,069,100 | 3:2通过 |
| `1536x1024` | high | 58.22s | `1536x1024` | 2,117,658 | 3:2通过 |
| `1024x1536` | medium | 61.83s | `1024x1536` | 1,741,842 | 2:3通过 |
| `1024x1536` | high | 59.67s | `1024x1536` | 1,685,092 | 2:3通过 |

同一中性prompt只改变host画幅suffix：

| suffix | 请求 | 耗时 | 实际PNG | bytes | 判定 |
|---|---|---:|---|---:|---|
| `use a square 1:1 canvas` | square medium | 30.20s | `1254x1254` | 1,674,108 | 正常 |
| `use a landscape 3:2 canvas` | landscape medium | 24.66s | `1536x1024` | 1,914,689 | 正常 |
| `use a portrait 2:3 canvas` | portrait medium | 21.64s | `1024x1536` | 1,857,774 | 正常 |

冻结结论：

- 成功验收以目标ratio的1%相对误差，不要求exact像素；`1254x1254`合法。
- `medium / high`都可请求，但现有记录没有完整证明每次generation响应顶层 `quality`都存在。
- 主规格因此把缺失quality设计为可交付的 `quality_unverified`降级；生产canary仍必须取得 `contract_status = ok`。

---

## 4. edit /参考图实测：10 POST

输入均为本轮临时生成的中性PNG几何测试图。固定 exact `gpt-image-2`、`n = 1`、`b64_json`，multipart按顺序重复 `image[]`，无retry /fallback。

| # | 输入 /角色 | 请求 | HTTP /耗时 | 响应quality /实际PNG | 视觉 /合同判定 |
|---:|---|---|---|---|---|
| 1 | 1图 `edit_target` | 方图 medium，改墙色 | 200 /51.15s | medium /`1254x1254` | 目标编辑、不变量保留，通过 |
| 2 | 1图 `subject_reference` | 方图 medium，同角色去雪山 | 200 /66.27s | medium /`1254x1254` | 显著角色特征保留，通过 |
| 3 | 2图 `edit_target + insert` | 方图 medium，杯子放桌面 | 200 /57.32s | medium /`1254x1254` | 尺度、透视、阴影合理，通过 |
| 4 | 4图，多角色 | 方图 medium | 200 /39.49s | **low** /`1254x1254` | 静默降质，失败 |
| 5 | 3图，底图+角色+插入物 | 方图 medium | 200 /60.76s | medium /`1254x1254` | 三图合成通过 |
| 6 | 同#4四图 | 方图 high | 200 /50.62s | **low** /`1254x1254` | 再次降质，失败 |
| 7 | 1图 `edit_target` | 横图 high | 200 /25.09s | **low** /`1536x1024` | 画幅对、品质失败 |
| 8 | 2图 `subject + style` | 竖图 medium | 200 /57.72s | medium /`1024x1536` | 角色与风格职责分离，通过 |
| 9 | 1图 `edit_target` | 方图 high | 200 /29.03s | **low** /`1254x1254` | high不可用 |
| 10 | 1图 `edit_target` | 横图 medium | 200 /46.44s | medium /`1536x1024` | 通过 |

结论：

- 当前route对已测1—3张PNG、medium及三画幅可执行。
- 四图medium /high与单图high都会返回 `low`；P0固定最多三图、edit medium。
- `usage.output_tokens_details.image_tokens`从常规medium方图的2058降到low方图的515，quality不是可忽略展示字段。
- 本轮没有真实JPEG /WebP edit；主规格将二者列为生产开放前的未完成canary，不再把PNG结果外推到所有格式。
- 十次edit尚未逐笔完成U-API /上游用量对账。

---

## 5. NewAPI实现依据与marker

### 5.1 当前官方依据

- NewAPI Images路由包含 `POST /v1/images/generations`与`POST /v1/images/edits`：[relay router](https://github.com/QuantumNous/new-api/blob/main/router/relay-router.go)。
- 默认endpoint表只有标准 `image-generation → /v1/images/generations`，没有标准edit目录类型：[endpoint defaults](https://github.com/QuantumNous/new-api/blob/main/common/endpoint_defaults.go)。
- 当前 `model/pricing.go`会把Model Meta `Endpoints`中string /object类型的自定义key加入对应模型的 `supported_endpoint_types`并登记path /method：[pricing.go](https://github.com/QuantumNous/new-api/blob/main/model/pricing.go)。
- 当前官方edit页面证明multipart endpoint存在，但公开schema仍偏单图 /旧模型：[NewAPI Edit Image](https://docs.newapi.pro/en/docs/api/ai-model/images/openai/post-v1-images-edits)。多图、`gpt-image-2`和quality合同必须以U-API真实route矩阵为准。
- NewAPI release曾修复OpenAI image edit转发丢失参考图和metadata：[releases](https://github.com/QuantumNous/new-api/releases)。部署版本和route审计不能被endpoint存在替代。
- 旧 `new-api-docs`仓库已经归档，不再作为“当前文档”正本；只可作为历史示例。

### 5.2 marker语义

`uapi-image-edit-v1`表示该exact public alias已由运维验收：

- 一至三张输入图；
- PNG /JPEG /WebP multipart；
- `1:1 /3:2 /2:3`；
- edit固定medium；
- 单个 `b64_json`响应；
- 无客户端外的请求放大retry。

`uapi-image-default-v1`只表示U Agents P0当前唯一默认。它不证明route可用，必须与同条目的 `image-generation + uapi-image-edit-v1`及canary共同使用。

对最终选中的 **Exact Name Rule** Model Meta合并：

```json
{
  "uapi-image-default-v1": {
    "path": "/v1/images/generations",
    "method": "POST"
  },
  "uapi-image-edit-v1": {
    "path": "/v1/images/edits",
    "method": "POST"
  }
}
```

不能覆盖该Model Meta既有 `Endpoints`。保存后必须失效pricing /ability cache或等待真实refresh周期，再用同权限 `/v1/models`回读；后台保存成功不等于客户端已经可见。

---

## 6. 运维发布门禁

### 6.1 配置门禁

| 门禁 | 通过标准 | 失败动作 |
|---|---|---|
| 生产等价目录 | 目标用户同group /model-limit看见exact `gpt-image-2` | 重新取证，不引用旧快照 |
| generation | 三画幅×medium/high、固定base64、host suffix均为 `ok` | 修route，不配置marker |
| PNG edit | 一至三图、角色、三画幅、medium均为 `ok` | 修route |
| JPEG /WebP edit | 真实multipart各至少一次 `ok`，MIME /扩展名 /bytes一致 | 修route或回到规格收窄格式 |
| response | 单个base64；quality存在并匹配；安全尺寸 | 修规范化，不以degraded通过canary |
| retry /failover | 一个客户端POST不会放大为多个operation请求 | 关闭 /限制网关retry |
| 多实例 | 每个服务实例 /cache domain看见同一唯一default及相同route revision | 保持quiesced |
| timeout /body | operation至少180秒；multipart /响应不被代理截断 | 调整代理 |
| Debug | Authorization、prompt、图片和response body不进生产日志 | 关闭Debug /脱敏 |
| 用量 | 客户端POST数等于U-API /上游记录 | 停止上线调查 |
| 客户端连接 | resolved locked connection同时满足U-API slug与normalized base URL exact `https://token.u-studio.cn/v1` | 零凭据 /零网络，修连接锁定 |
| 付费合同 | 一个user Message只有一个host lease /operation POST；auth retry保持原ID；SDK `toolUseId`不参与claim | 停止上线修客户端 |
| 持久化 | session reload后不存在nonce、lease、owner、绝对路径；host /UI strict parser结论一致 | 停止上线修redaction /parser |

### 6.2 首次启用顺序

1. 不依赖marker，使用生产等价受控Token直接canary exact `gpt-image-2`的generation、PNG /JPEG /WebP edit。
2. 对账这些独立授权请求；确认channel、`model_mapping`、费用、retry和response合同。
3. 暂停所有生图业务流量并确认无在途operation。
4. 给exact `gpt-image-2`同时增加两个marker。
5. 失效cache，按部署清单逐实例 /cache domain GET；恰好一个eligible default。
6. 临时开放受控U Agents canary：一次纯文standard、一次单图standard edit。
7. 核对客户端host lease只claim一次、POST、U-API /上游用量、保存、reload、UI和 `contract_status = ok`；不同SDK `toolUseId`不得产生第二次请求。
8. 全部通过才开放；失败保持quiesced并同时撤两个marker，不自动尝试其他alias。

### 6.3 默认迁移

不能宣称marker可原子迁移。固定流程：暂停流量 → 移除旧marker → 全实例回读0 default → 添加新marker → 全实例回读1 default → 独立canary /对账 → 恢复流量。

若无法枚举实例 /cache domain、无法暂停流量或只能经负载均衡随机采样，停止迁移。

---

## 7. 实现后授权smoke记录

每个真实smoke在执行当下重新取得用户授权。两种operation是两个预先声明的请求；前一个失败不触发后一个，也不尝试fallback。

记录：

```md
- time_utc:
- client_commit:
- gateway_model_id:
- catalog_markers:
- operation: generate | edit
- input_count_and_roles:
- input_format: none | png | jpeg | webp
- requested_ratio:
- requested_quality:
- response_contract_status:
- latency_ms:
- output_mime_bytes_dimensions:
- client_get_count:
- client_post_count:
- host_lease_claim_count:
- uapi_usage_count:
- upstream_usage_count:
- interactive_origin_pass:
- auth_retry_identity_preserved:
- session_redaction_pass:
- host_ui_parser_parity_pass:
- ui_inline_pass:
- invariant_manual_result:
```

禁止记录：Token、Token hash、完整prompt、图片内容、base64、原文件名 /path /ref、完整response body或usage明细。

---

## 8. 2026-07-20 当前客户端真实smoke

### 8.1 fail-closed与临时测试注入边界

本轮先不注入任何客户端静态模型名，直接以当前临时Token运行已经实现的resolver：

- 真实`GET /v1/models`为HTTP 200；`gpt-image-2`与`gpt-image-2-client`均为`openai + image-generation`，`gemini-3-pro-image-preview`为`gemini + image-generation`；三个条目都没有`uapi-image-edit-v1`或`uapi-image-default-v1`。
- resolver按生产合同返回`service_unconfigured + not_sent`；抓取记录为GET、零operation POST。这证明缺marker时fail-closed成立，不能把名称为`gpt-image-2`当成隐式授权。

为了继续验证真实transport、格式、落盘和响应合同，只在仓库外的临时测试进程中，对该次真实catalog响应的exact `gpt-image-2`本地附加两个marker。该注入没有修改NewAPI后台、仓库配置或生产resolver；三个operation仍真实发往`https://token.u-studio.cn`，每个invocation恰好一个POST、无retry /fallback：

| operation | 输入 /请求 | HTTP /耗时 | 输出 | 客户端判定 |
|---|---|---|---|---|
| generation | 纯文，`3:2 + high` | 200 /62,159ms | PNG `1536x1024`，2,752,718 bytes | 成功交付；响应quality低于请求，`degraded + quality_downgraded` |
| edit /三图合成 | PNG `edit_target` + JPEG `subject_reference` + WebP `style_reference`，`3:2 + medium` | 200 /66,104ms | PNG `1536x1024`，2,845,027 bytes | `ok`；三张multipart及三种真实格式均被route接受 |
| edit /角色延续 | PNG `subject_reference`，`2:3 + medium` | 200 /61,062ms | PNG `1024x1536`，2,678,359 bytes | `ok`；主体身份、蓝色外套与黄铜指南针在新场景中明显延续 |

人工视觉检查：纯文结果构图和画幅正确；三图结果保留同一人物、服装和道具，并吸收style reference的紫色调，没有拼成宫格；角色延续结果在雪山日出新场景中保持可识别身份。三次成功不能外推为统计意义上的稳定角色一致性。

请求审计共四次catalog GET（含最初原始目录检查）和三次operation POST；三次POST均为HTTP 200。客户端侧尚不能读取NewAPI后台账单，因此`客户端POST数 = U-API用量 = 上游用量`仍需管理员逐笔核对，不能仅凭HTTP 200勾选费用门禁。

本轮补充证据证明：真实PNG /JPEG /WebP可在同一三图multipart中通过，且当前客户端generation、edit、响应解析与安全落盘主链可执行。它在当时尚未证明每种格式分别完成单图canary、Electron /WebUI交互、生产marker或多实例cache一致性；后续证据分别见§8.2与§8.3。

### 8.2 marker修正后的完整真实矩阵

用户修正NewAPI后台marker后，未再做任何客户端目录注入。当前Token的真实catalog只让exact `gpt-image-2`同时满足`image-generation + uapi-image-edit-v1 + uapi-image-default-v1`。测试进程直接调用已实现的service，11个case串行执行；每个case重新GET目录、只claim一次、只发送一个operation POST，无retry、fallback或模型切换。

| case | 请求 | HTTP /耗时 | 实际输出 | 合同判定 |
|---|---|---|---|---|
| 纯文方图standard | `1:1`, standard | 200 /66,881ms | PNG `1254x1254`，2,199,898 bytes | `ok` |
| 纯文横图standard | `3:2`, standard | 200 /53,763ms | PNG `1536x1024`，2,395,520 bytes | `ok` |
| 纯文竖图standard | `2:3`, standard | 200 /42,039ms | PNG `1024x1536`，2,104,023 bytes | `ok` |
| 纯文方图high | `1:1`, high | 200 /64,886ms | PNG `1254x1254`，2,570,189 bytes | `degraded + quality_downgraded` |
| PNG单图编辑 | standard | 200 /68,864ms | PNG `1254x1254`，2,339,023 bytes | `ok` |
| JPEG单图编辑 | standard | 200 /60,279ms | PNG `1254x1254`，2,233,451 bytes | `ok` |
| WebP单图编辑 | standard | 200 /66,236ms | PNG `1254x1254`，2,219,903 bytes | `ok` |
| 角色延续 | subject reference，`2:3` | 200 /153,251ms | PNG `1024x1536`，2,521,446 bytes | `degraded + quality_downgraded` |
| 风格参考 | style reference，`1:1` | 200 /26,954ms | PNG `1254x1254`，1,554,099 bytes | `degraded + quality_downgraded` |
| 两图合成 | edit target + subject reference，`3:2` | 200 /51,463ms | PNG `1536x1024`，2,335,341 bytes | `ok` |
| 三图合成 | edit target + subject + style，`3:2` | 200 /53,316ms | PNG `1536x1024`，2,217,497 bytes | `ok` |

请求审计：12次catalog GET（矩阵前基线一次、每个case一次）、11次operation POST、11次host claim；全部case均为`GET -> 唯一exact model -> 一次claim -> 一次POST`。请求统一`n=1 + b64_json`。编辑multipart字段均为`image[]`，neutral filename依输入真实格式分别为`image-1.png`、`image-1.jpg`、`image-1.webp`；两图与三图按角色顺序编号，没有携带原文件名或本地路径。

11张返回图均通过真实magic、解码、MIME、字节与尺寸检查，并逐张人工查看：三画幅构图正确；PNG /JPEG /WebP单图编辑分别只改变要求的天气、服装颜色或光线；角色延续保留同一人物、红发、蓝色外套与指南针；风格参考成功迁移紫蓝发光视觉；两图和三图合成均保留主体与道具，没有退化成宫格。人工结果只证明这些样本可用，不代表统计稳定性。

矩阵结论为**11/11返回有效图片，8/11严格`ok`，3/11可显示但quality降级**。因此generation /edit /参考图 /合成主链和三种输入格式已得到真实证据，但§7要求的所有相关canary均`contract_status = ok`尚未满足，不能据此开放普通流量。管理员后台应能核到本矩阵新增11条operation用量；客户端无法替代U-API /上游逐笔对账。

### 8.3 最终macOS DMG与Electron端侧真实smoke

最终包由`apps/electron`执行`CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:mac`生成。首次直接执行`bun run dist:mac`时，`electron-builder`自动选中了Keychain中的无效identity `com.justiceleague.batman`，而系统实际报告0个有效签名identity；关闭自动发现后完成adhoc构建。最终产物为v0.11.1：

- `U-Agents-arm64.dmg`：§8.4凭据隔离修复后重新生成，274,969,595 bytes，SHA-256 `8d955394e16abb97bfd6eb520b6dcd324cef3ee78eeb8eb42d73b5ebdc71f25a`；`hdiutil verify`通过，CRC32为`15FE0C35`。
- `U-Agents-arm64.zip`与`latest-mac.yml`同步生成。
- `codesign --verify --deep --strict`通过，identifier为`cn.u-studio.u-agents`，hardened runtime有效；签名为adhoc、没有TeamIdentifier且未notarize，因此只能作为开发验收包，不能据此发布给普通用户。

从只读挂载的当时DMG直接启动`U Agents.app`，使用`U_AGENTS_CONFIG_DIR`指向仓库外测试目录完成真实端侧链路。用户消息经打包后的Pi subprocess调用canonical `mcp__session__generate_image`；resolver重新读取目录并选择exact `gpt-image-2`，随后一次host claim、一次operation POST且无retry /fallback。服务返回`contract_status = ok`的PNG `1254x1254`并安全落盘。本次新增1次可能计费的operation POST，故本文累计数从43增至44。后续发现当时的`SecureStorageBackend`没有服从该隔离变量，故“仓库外测试目录”只隔离了config /workspace，没有隔离凭据；事故与修复见§8.4。

首次端侧展示暴露并修正了两个只有真实macOS路径 /完整UI链路才会出现的问题：

1. macOS把`/tmp`解析为`/private/tmp`，旧`validateFilePath`只realpath目标、不规范化allow root，导致合法workspace图片被误拒绝。`packages/server-core/src/handlers/utils.ts`新增`canonicalizePathAllowMissing()`，在路径边界比较前统一规范化目标与允许根目录；回归测试覆盖`/tmp -> /private/tmp`别名且保持敏感文件与越界路径fail-closed。
2. 工具卡已负责canonical图片展示时，助手正文里的同一`attachment://`图片会形成重复破图和空回复卡。`stripRenderedUApiImageAttachments()`只移除与strict tool result basename精确匹配的重复图片，保留其他附件与文字；`TurnCard`不再渲染清理后为空的回复卡。

修复后重新build、重新打包并从最终DMG复验。为避免新增费用，UI回归复用同一张已持久化图片，没有再次POST。最终验证结果：历史会话重载后图片仍可见；当前回复只显示一个真实图片工具卡；全屏预览、100%与125%缩放、关闭均正常；界面不显示服务端绝对路径，也没有重复附件或空回复卡。

该smoke只覆盖Electron安装包的成功路径。尚未在安装包中触发`degraded`、error-only或`possibly_charged`真实状态；WebUI没有做live UI smoke；发布签名、notarization、隐私文本、跨实例marker一致性、费用对账与Token轮换仍属于发布门禁。

### 8.4 临时Token覆盖正式凭据事故与隔离修复

用户安装测试后发现应用仍使用本轮临时Token。只读核查确认安装包资源没有内嵌该Token；真正原因是两套路径实现不一致：

- `packages/shared/src/config/paths.ts`让config、workspace与server lock服从`U_AGENTS_CONFIG_DIR -> CRAFT_CONFIG_DIR -> ~/.u-agents`优先级。
- 修复前`packages/shared/src/credentials/backends/secure-storage.ts`却把`CREDENTIALS_DIR`硬编码为`join(homedir(), '.u-agents')`。
- 因此§8.3测试界面虽然在隔离config中运行，`SETUP_LLM_CONNECTION`保存`u-api-default`凭据时仍覆盖了正式`~/.u-agents/credentials.enc`。正常安装版随后读取同一正式凭据文件，表现为“安装包使用临时Token”。

修复采用最小单源方案：`SecureStorageBackend`直接复用`CONFIG_DIR`，默认无override时仍是`~/.u-agents/credentials.enc`，但测试 /多实例设置`U_AGENTS_CONFIG_DIR`或兼容变量`CRAFT_CONFIG_DIR`后，`credentials.enc`与config、workspace、lock、`clearAllConfig()`落在同一根目录。没有修改加密格式、magic、PBKDF2 /AES-256-GCM算法或默认用户迁移路径。

新增`secure-storage-config-dir.test.ts`用独立子进程和fake HOME验证三条路径：主变量覆盖旧变量且不写fake HOME；仅旧变量时兼容回退；无override时保持`~/.u-agents`默认。另将headless server smoke改为每个进程独立`U_AGENTS_CONFIG_DIR`，避免正式目录中的活跃或残留`.server.lock`影响测试。

验证结果：

- 凭据 /config聚焦回归：**163 pass / 0 fail**；凭据 + headless复核：**7 pass / 0 fail**，其中headless为4/4。
- `bun run typecheck:all`与`bun run lint`均exit 0；lint只有既有warning。
- 全量`bun test`：**5791 pass / 12 skip / 29 fail / 5 errors**，共5832 tests、463 files；失败集回到既有browser-pane、WebUI、developer-feedback与`release/`源码副本扫描基线，本次隔离测试和headless smoke均无失败。
- 修复后的最终DMG完成production build、`hdiutil verify`与adhoc `codesign --verify --deep --strict`；包内bundle静态核对为`CREDENTIALS_DIR = CONFIG_DIR`，临时Token前缀扫描零命中。
- 整个修复、测试和重新打包过程没有发起任何U-API请求；operation POST累计数仍为44。正式`~/.u-agents/credentials.enc`修改时间保持在事故时点，没有被修复验证再次改写。

用户自行负责把正式连接改为新Token并在NewAPI后台撤销临时Token；客户端修复不能替代服务端轮换。旧DMG已被新哈希产物覆盖，不应继续分发旧副本。

### 8.5 凭据隔离修复后的用户安装版复验

用户安装§8.4重新生成的最终DMG后，在正常桌面会话中用一句自然语言“生成一张小猫咪趴在牛背上的图片”完成生图。当前回复显示单个“已生成图片”工具卡，返回图片标注为`1536x1024`，画面符合小猫趴在牛背上的主体要求；图片下方提供已保存文件链接，未出现重复破图或空回复卡。该结果证明修复后的最终安装包仍可完成普通用户成功路径，不证明异常态、跨实例marker一致性或服务端费用归属。

本次用户复验新增1次客户端观测到的operation调用，故本文累计数从44增至45。截图只能证明客户端收到并展示结果；NewAPI route /Debug、上游用量和U-API账单仍须管理员逐笔对账。用户未确认临时Token已轮换或撤销，因此相关发布门禁继续保持未完成。

## 9. 当前未完成

- [ ] 临时Token已轮换。
- [ ] 45次历史POST完成U-API /上游逐笔用量对账；其中完整矩阵应新增11条、首次Electron端侧smoke应新增1条、修复后用户安装版复验应新增1条operation记录。
- [ ] production-equivalent generation response确认顶层quality存在并匹配。
- [x] PNG /JPEG /WebP分别完成单图standard edit真实canary，MIME、magic、neutral filename与视觉结果一致。
- [ ] high纯文、角色延续和style reference的response quality达到请求值；当前三项均安全降级为`quality_downgraded`。
- [ ] exact `gpt-image-2`全节点route /retry /Debug审计。
- [x] 当前Token目录已回读为exact `gpt-image-2`唯一同时包含三个必需marker；相邻两个生图ID均不满足。
- [ ] marker已跨全部NewAPI实例 /cache domain回读并确认刷新一致性。
- [x] host lease、auth retry identity、落盘前redaction与host /UI parser parity已实现并通过自动化对抗性测试。
- [x] U Agents service主链完成11组真实矩阵；全部单POST返回有效图，8项`ok`、3项安全降级。
- [x] 最终macOS DMG中的Electron成功路径完成真实operation、持久化重载、当前回复直显、全屏缩放和隐藏服务端路径smoke；修复后UI回归未新增POST。
- [x] 凭据目录与`CONFIG_DIR`统一；主 /兼容 /默认三路径、headless独立目录、最终bundle和正式凭据零改写均完成回归。
- [ ] Electron安装包的degraded、error-only与`possibly_charged`状态完成端侧smoke。
- [ ] WebUI完成live UI直显、预览、警告与路径隐藏smoke。
- [ ] macOS发布证书签名与notarization通过；当前adhoc包不得作为公开发布包。

未完成项不能被历史HTTP 200、后台保存成功或单节点目录采样替代。
