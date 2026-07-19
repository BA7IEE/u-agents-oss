# 16A — U-API 生图接口证据与运维门禁

> **状态**：2026-07-19 实测快照；2026-07-20 仅修正客户端付费 /持久化上线门禁，没有新增HTTP请求。本文不是长期能力声明，也不是客户端静态模型表。
> **用途**：保存 [`16-image-generation-tool-spec.md`](16-image-generation-tool-spec.md) 的目录、generation / edit、NewAPI实现和上线证据。产品与客户端合同以主规格为准。
> **计费说明**：本文记录的29次 operation POST都可能产生费用，尚未完成U-API /上游逐笔对账。临时Token已在对话中暴露，必须轮换。

---

## 1. 证据边界

所有真实请求均由用户逐次明确授权，使用同一临时Token和 `https://token.u-studio.cn`；没有HTTP自动retry、模型fallback或Gemini Native fallback。Token未写入仓库、请求文件或响应文件。

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

`2026-07-19T15:19Z`完整actual ID：

`deepseek-v4-pro`, `gemini-3-pro-image-preview`, `glm-5.2`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-sol`, `gpt-image-2`, `gpt-image-2-client`, `k3`, `minimax-m3`, `qwen3.5-plus`。

最新目标条目：

| exact ID | `owned_by` | 标准 endpoint types | edit marker | default marker | 结论 |
|---|---|---|---|---|---|
| `gpt-image-2` | `openai` | `openai`, `image-generation` | 无 | 无 | P0唯一候选；当前仍不可由客户端选择 |
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

## 8. 当前未完成

- [ ] 临时Token已轮换。
- [ ] 29次历史POST完成U-API /上游逐笔用量对账。
- [ ] production-equivalent generation response确认顶层quality存在并匹配。
- [ ] JPEG edit真实canary。
- [ ] WebP edit真实canary。
- [ ] exact `gpt-image-2`全节点route /retry /Debug审计。
- [ ] 两个自定义marker配置并逐实例回读。
- [ ] host lease、auth retry identity、落盘前redaction与host /UI parser parity实现并通过对抗性测试。
- [ ] U Agents功能实现及实现后两次smoke。

未完成项不能被历史HTTP 200、后台保存成功或单节点目录采样替代。
