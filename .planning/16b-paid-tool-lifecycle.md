# 16B — 付费工具最小生命周期合同

> **状态**：首个consumer `generate_image`的进程内生命周期已实现；targeted/focused tests、`typecheck:all`、lint、`validate:ci`与独立子进程build已通过。跨进程exactly-once、durable ledger与网关内部重试控制仍不在本合同范围内。
> **目标**：在不建设durable billing ledger、不修改公共IPC协议的前提下，保证一个受信顶层用户invocation最多接受一次可能计费的operation POST，并让取消、重放和费用不确定对用户诚实。
> **范围**：这是可复用的host合同，不是要求P0立即抽象成通用框架。生图实施只增加满足本合同的窄类型和方法。

---

## 0. 第一性原理

付费工具必须同时满足：

1. **授权窗口可识别**：执行只能归属于当前受信顶层用户消息，而不是agent实例或可伪造renderer字段。
2. **付费边界唯一**：一个invocation最多一个accepted operation POST。
3. **无费用错误可恢复**：参数格式、图片ref等在POST前失败时，允许模型有限自修正，不能为了防重放牺牲普通用户成功率。
4. **有费用可能后不重试**：一旦进入claimed，timeout、abort、5xx、断网或保存失败都不能自动再次发送。
5. **状态不确定要诚实**：无法证明POST未执行时提示 `possibly_charged`，而不是猜错误名或隐藏费用风险。
6. **崩溃不自动恢复**：没有网关idempotency key或durable ledger前，app restart不能恢复旧付费任务。

不是目标：

- 不提供跨进程exactly-once。
- 不持久化claim文件或billing outbox。
- 不让模型、renderer或用户参数提供可信invocation ID。
- 不重构所有session tool、callback、source或automation生命周期。
- 不把所有非法tool shape变成poison carrier。

---

## 1. 受信 invocation

### 1.1 host创建

`SessionManager`在顶层user Message成功持久化后创建：

```ts
type InvocationOrigin = 'interactive' | 'messaging' | 'automation' | 'internal'

interface PaidInvocationContext {
  invocationId: string       // persisted user Message.id
  origin: InvocationOrigin
  executionNonce: string     // <process random>.<turn random>
}
```

规则：

- `invocationId`来自已经持久化的user `Message.id`。
- `executionNonce`由host生成，不由renderer /agent传入。
- 当前进程启动时生成128-bit `processNonce`；每个顶层Message生成128-bit `turnNonce`。
- context只进入agent内部 `ChatOptions` /runtime closure，不加入renderer可写的 `SendMessageOptions`。
- `toolUseId`不进入此context；它在Claude /Pi之间没有统一到canonical handler的执行合同，只能作为现有UI事件关联值。

### 1.2 origin

只有经现有认证进入 `sessions.SEND_MESSAGE` 的普通顶层Electron /WebUI payload得到 `interactive`。

不得从下列字段判断付费权限：

- `webContentsId`、`clientCapabilities`、mode、User-Agent；
- 历史 `triggeredBy`；
- 模型参数或tool description；
- workspace名称、session ID或本机路径能力。

Messaging、Automation、内部nudge、测试直接调用和缺少受信RPC context的 `SessionManager.sendMessage()`默认为 `internal`。

### 1.3 queue、nested chat、retry

- queue中的每条user Message使用自己的context。
- 同一顶层调用内的Claude nested `chat()`、resume /auth recovery继承原context，不生成新nonce；未进入preflight的auth retry必须复用原user `Message.id`，不能删除原消息后以新ID重新发送。
- source activation retry只有在host明确关联原pending record时继承；无法关联的legacy suffix降为 `internal`。
- 用户后来在曾由automation创建的session里通过普通UI发消息，按这次入口得到新的 `interactive`，不继承历史automation身份。
- steer进入当前stream后立即失效该invocation的付费能力；用户结束后新发消息才能建立新授权。

source retry只需一个窄pending record：

```ts
interface PendingRetryBinding {
  digest: string
  originalContext: PaidInvocationContext
  state: 'pending' | 'committed' | 'superseded'
}
```

server timer与legacy renderer只有exact digest的first match可继承。任何匹配保留suffix但没有pending record的payload都降为 `internal`，不能因超过旧2秒窗口重新获得interactive身份。记录可保留到session销毁；不需要为本功能重写Source schema或所有activation逻辑。

---

## 2. runtime nonce

### 2.1 为什么需要nonce

Claude / Pi可能持久化SDK transcript；旧tool-use可能在后续turn或app restart后再次出现。仅依赖“当前agent正在chat”会把旧调用错误归给新用户消息。

host把当前exact nonce放进既有volatile turn tail，并在付费tool runtime schema中要求模型复制：

```ts
const RuntimePaidToolSchema = CanonicalToolSchema.extend({
  _uapi_execution_nonce: z.string(),
})
```

nonce不是秘密，也不是用户授权本身；它只是重放fence。真正授权仍来自host context的interactive origin与当前invocation状态。

### 2.2 分类

| 输入 | 处理 |
|---|---|
| exact当前nonce | 可进入canonical参数校验 |
| 当前process、旧turn nonce | `not_executable + not_sent` |
| 旧process nonce | `request_uncertain + possibly_charged`，零凭据 /网络 |
| missing /malformed nonce | schema或host拒绝，零凭据 /网络 |
| 模型伪造current nonce | 仍受interactive、单飞和唯一claim约束，不能获得第二个POST |

nonce必须在activity、logger、ToolResult和UI前剥离。SDK自身的volatile transcript可以包含nonce；不能把它宣传成credential或防恶意模型秘密。

具体redaction边界：`SessionManager.processEvent(tool_start)`必须在`formatToolInputPaths`和`Message`持久化前删除`_uapi_execution_nonce`及所有lease /owner /host correlation字段。renderer侧隐藏是纵深防护，不是防落盘措施。测试必须重新加载session journal证明这些字段不存在。

---

## 3. 最小状态机

按canonical session path隔离，避免不同workspace复用相同session ID串状态：

```ts
type PaidPhase =
  | { phase: 'open'; localFailureCount: number }
  | { phase: 'preflight'; leaseToken: string; controller: AbortController }
  | { phase: 'claimed'; leaseToken: string; controller: AbortController }
  | { phase: 'terminal'; leaseToken?: string; chargeState: 'not_sent' | 'possibly_charged' }

interface PaidInvocationRecord {
  invocationId: string
  executionNonce: string
  origin: InvocationOrigin
  ownerToken: string
  phase: PaidPhase
}
```

一个session同一时刻最多一个付费image invocation进入 `preflight | claimed`。不同workspace状态独立。

`leaseToken`是host在原子取得preflight时生成的128-bit opaque random值。它只存在于进程内record，不进入runtime schema、模型上下文、renderer、日志、ToolResult或持久化session。`ownerToken`来自当前agent callback注册；replace后旧owner不能取得或claim新lease。

### 3.1 canonical校验与自修正

host按以下顺序处理tool call：

1. 验证session path、exact `ownerToken`、origin、nonce、agent kind与steer /stop状态。
2. strict解析canonical参数，剥离runtime字段。
3. 对本地ref /文件完成无网络校验。
4. 原子生成`leaseToken`并取得preflight lease。

schema或本地输入失败发生在lease前，或释放尚未联网的preflight lease：

- 返回稳定 `not_sent`错误；
- `localFailureCount += 1`；
- 允许最多一次新的合法tool call自修正；
- 第二次本地失败后置terminal，防止无限循环。

这两次都是**本地尝试预算**，不是图片生成次数。任何时刻只有一个合法call可持有preflight lease。

禁止用poison carrier把第一次无费用格式错误永久升级为invocation失败。若SDK在host hook前拒绝非法schema，模型下一次合法调用仍按上述同一预算处理。

### 3.2 preflight

取得lease后才能读取credential和请求目录。以下失败都终结本invocation，charge state为 `not_sent`：

- 非U-API连接、缺Token；
- catalog HTTP /解析失败；
- 无唯一default或marker不完整；
- stop在claim前发生。

preflight失败后同一invocation不再GET /POST。用户通过新消息重试。

### 3.3 claim

完成所有本地验证与目录选择后，在operation POST前同步执行：

```text
recheck current record is preflight with same invocationId + ownerToken + leaseToken
  -> phase = claimed
  -> send POST with the record's same AbortController.signal
```

recheck与状态写入之间不得 `await`。claim后无论HTTP结果、timeout、abort、响应校验或落盘结果，record最终都为 `terminal + possibly_charged`；成功UI envelope本身证明结果已交付，但不能删除已发生过claim的事实。

第二个tool call、不同SDK `toolUseId`、agent重建或nested recovery看到 `preflight | claimed | terminal`时均零新增GET /POST。SDK `toolUseId`不能替换、恢复或重新取得`leaseToken`。

---

## 4. 取消与崩溃

### 4.1 Stop

- `open`：置 `terminal + not_sent`。
- `preflight`：同步abort controller，置 `terminal + not_sent`；fetch必须使用同一signal并在返回后重查状态。
- `claimed`：同步abort，置 `terminal + possibly_charged`；UI提示先查用量，不提供一键retry。

`UserStop | Redirect | PlanSubmitted | Timeout | InternalError | unknown abort | destroy /dispose`都失效当前invocation。Auth /source recovery只有在尚无付费tool attempt时可以继承；继承时保持原`invocationId + executionNonce`，不得创建新user Message ID。一旦进入preflight，恢复应提示用户完成修复后发送新消息。

### 4.2 app restart

进程内record不持久化。新process收到旧nonce时：

- 不读取credential、不GET、不POST；
- 返回 /展示prior request可能已扣费；
- 不自动恢复旧image task；
- 用户新发普通消息建立全新nonce和新的可能费用。

如果未来需要自动恢复，必须先具备网关幂等键或受保护durable ledger；不在本规格上追加普通JSON claim文件伪装exactly-once。

---

## 5. callback与cache所有权

付费callback不得只以 `sessionId`注册。最小key：

```text
canonicalSessionPath + opaqueAgentOwnerToken
```

要求：

- lookup同时校验path和owner token；
- replace生成新owner；旧agent迟到调用失败；
- unregister使用compare-and-delete，旧agent不能删掉新callback；
- cached tool array不捕获credential、invocation record、manifest或旧callback对象；
- full /mini cache identity包含agent kind，或在每次构建wrapper前重新过滤。
- list /registration过滤只是用户体验边界；canonical handler每次执行仍必须校验current surface、agent kind、path和owner。Pi的merge式`register_tools`不能替代执行gate。

不迁移所有legacy callback。只为第一个付费consumer增加独立窄registry，等第二个consumer出现后再评审是否抽象。

---

## 6. ToolResult与费用语义

所有付费工具错误至少包含：

```ts
interface PaidToolErrorV1 {
  version: 1
  category: string
  charge_state: 'not_sent' | 'possibly_charged'
}
```

分类依据是**状态机阶段和结构化证据**：

- `open / preflight`失败：`not_sent`。
- `claimed`后的任何不确定错误：`possibly_charged`。
- 明确quota /policy仍可使用业务category，但claim后不能因此改成 `not_sent`。
- 上游自由文本、HTTP错误名或 `get_channel_failed`不能撤销claim。
- UI对 `possibly_charged`固定显示“先查用量，不要直接重试”。

如果claimed后拿到安全但语义降级的产物，consumer应尽量交付并显示degraded warning；不能自动重做，也不应为了维持“成功率”隐瞒降级。

---

## 7. 对抗性测试

### 7.1 invocation /origin

- Electron /WebUI顶层认证消息得到interactive。
- renderer伪造origin、mode、`webContentsId`或capabilities不改变host context。
- Messaging、Automation和direct call为internal。
- automation创建的旧session中，后来UI消息得到新的interactive。
- queue两条消息使用不同nonce；nested recovery继承原nonce。
- auth retry在open阶段保留原user `Message.id`与nonce；不得删除后创建新invocation。
- legacy source retry exact pending digest继承；无record /committed /superseded为internal。

### 7.2 自修正与并发

- 第一次schema或ref本地失败后，第二次合法call可执行一个POST。
- 两次本地失败后第三次零网络。
- 两个合法call并发争抢，只有一个preflight，另一个稳定busy。
- preflight目录失败后模型再次调用零GET /POST。
- claimed后任何新SDK `toolUseId`、agent重建和nested chat均零GET /POST。
- claim只接受record中的exact `invocationId + ownerToken + leaseToken`；伪造 /替换任一项均零POST。

### 7.3 nonce /replay

- current nonce首次call通过。
- 同process旧turn、missing、malformed、伪造correlation零credential /网络。
- 旧process nonce提示possibly charged并零网络。
- 旧replay与current合法call两种先后均不会占用 /覆盖current record。

### 7.4 cancel

- schema、本地文件、catalog各阶段Stop均零POST。
- claim与POST之间barrier证明状态同步写入先于网络。
- POST await中Stop使用同一个controller object并提示possibly charged。
- fetch迟到返回后不能保存或覆盖terminal状态。
- app restart不恢复旧task。

### 7.5 ownership

- 两个workspace使用相同session ID不串callback /Token /state。
- old agent unregister不能删除new agent callback。
- full → mini、mini → full cache顺序不泄露付费tool。
- Codex ListTools隐藏且陈旧CallTool直接拒绝。
- Pi即使保留一次旧merge注册，mini /陈旧执行也在main-process handler零凭据、零网络拒绝。

### 7.6 persistence /parser

- `tool_start`写入session前已删除nonce、lease、owner和host correlation；reload后仍不存在。
- success /degraded /error envelope由host与UI共用的lower-package strict parser得到相同结论。
- unknown key、错误version、危险basename和畸形dimensions不会被任一消费方接受。

---

## 8. 实施边界与停止条件

生图P0只需要窄实现：

- `SessionManager`的paid image record与private context；
- Claude /Pi current nonce注入、落盘前redaction和校验；
- canonical path +owner callback；
- surface /agent-kind集中filter；
- host `leaseToken` claim、claimed取消与费用提示；
- auth /source continuation保持原invocation identity；
- host与UI共享dependency-free ToolResult parser。

出现下列需求时停止并另立平台规格：

1. 第二种付费工具要求共享框架。
2. 需要跨进程恢复、exactly-once或durable ledger。
3. 需要无人值守Automation预算。
4. 需要把origin加入公共renderer DTO或新IPC协议。
5. 需要重写全局source grammar、所有callback registry或session persistence queue。
6. 无法在operation POST前无await地完成唯一claim。
7. SDK会在没有当前顶层用户invocation时自行使用current nonce发起付费call。
8. 需要修改Pi子进程协议来传递`toolUseId`；应先证明host `leaseToken`不足。
9. 需要把nonce、lease、owner或origin加入renderer可写DTO。

满足停止条件不能以扩大生图P0 write set绕过。

---

## 9. 完成判定

- [x] context来自持久化 user Message和host认证入口，不来自renderer字段。
- [x] current nonce绑定当前process +turn，旧turn /旧process零网络。
- [x] 一个invocation只有一个host `leaseToken`和一个claimed POST；SDK `toolUseId`不参与费用授权。
- [x] 一次无费用参数错误允许有限自修正；不使用全turn poison。
- [x] preflight错误终结并为not sent；claim后错误为possibly charged。
- [x] Stop /destroy共用`terminatePaidImageInvocation()`，steer由same-process old-turn nonce拒绝，app restart由old-process nonce拒绝；对应自动化均不产生第二个POST。
- [x] auth /source recovery在允许继承时保持原user `Message.id`、nonce与context。
- [x] callback /cache按canonical path、owner和agent kind隔离。
- [x] `tool_start`落盘前redact；host /UI共用strict envelope parser。
- [x] 对抗性并发、replay、取消与旧owner /旧agent tests通过。
- [ ] 仍缺“不同canonical workspace path不能复用callback”的显式负例；当前只有registry按path建键与owner compare-delete合同，不能把结构推导表述成跨workspace测试已通过。
- [x] 实现未扩张为通用付费平台或durable ledger。

该合同只提供进程内at-most-one accepted POST，不宣称网关内部不会重试；网关放大请求仍由 [`16a-image-api-evidence.md`](16a-image-api-evidence.md) 的运维门禁负责。
