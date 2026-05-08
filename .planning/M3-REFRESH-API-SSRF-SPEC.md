# M3-REFRESH-API-SSRF-SPEC — `refreshApiRenew` SSRF 防护

> **优先级**：P1（安全加固，不阻塞 M3 启动但应在 M3 启动同期完成）
> **目标**：阻止恶意 API source 配置经 `refreshApiRenew` 变成 SSRF 攻击向量（拿云元数据/内网服务/凭证）
> **预估**：新 helper 实现 + 单测 + 接入 = **0.5 天**

---

## 0. 风险路径

[`packages/shared/src/sources/credential-manager.ts:965-1033`](../packages/shared/src/sources/credential-manager.ts) `refreshApiRenew` 现状：

```typescript
private async refreshApiRenew(source, cred): Promise<string | null> {
  const renewConfig = source.config.api?.renewEndpoint;
  if (!renewConfig?.path) return null;

  const baseUrl = source.config.api!.baseUrl;
  // ...
  // 1. Resolve URL
  const url = renewConfig.path.startsWith('http')
    ? renewConfig.path                                      // ← 用户配的绝对 URL，无校验
    : new URL(renewConfig.path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  // ...
  // 4. Execute
  const response = await fetch(url, fetchOptions);          // ← 直接发请求，带 Authorization header
}
```

**SSRF 攻击模型**：
1. 用户被诱导导入恶意 source 配置（YAML/JSON share / mcp 推荐）
2. 配置内 `api.renewEndpoint.path = 'http://169.254.169.254/latest/meta-data/iam/security-credentials/'`
3. 用户随便用一次 source（比如打开它的某个动作触发 token refresh）
4. `refreshApiRenew` 携带 user 的 Authorization header 请求 AWS/Azure/GCP 元数据端点 → 拿云凭证回写 → 攻击者从 source 状态 / 错误日志拿到泄漏数据

**也可以打的目标**：
- `http://localhost:9200/`（Elasticsearch 内网）
- `http://192.168.1.1/admin`（家庭路由器）
- `http://10.0.0.X/...`（内网 K8s API）
- `file:///etc/passwd`（虽然 fetch 默认禁但要防）

**对比 OAuth 路径**：OAuth 走的是固定 provider URL（Slack/Google/Microsoft），不接受用户配 endpoint —— 没这个风险。`refreshApiRenew` 是上游为支持自托管 API（Bring Your Own）开的口子，给攻击者也开了同一扇门。

---

## 1. 改造目标

新加 `assertPublicHttpsUrl(rawUrl)` helper 到 [`packages/shared/src/utils/url-safety.ts`](../packages/shared/src/utils/url-safety.ts)，在 `refreshApiRenew` 第 4 步 `fetch(url, ...)` 前调用。

**通过条件**：
- protocol `https:`（不允许 http，避免 MitM 截 token）
- hostname 公网解析（非环回 / 非私网 / 非 link-local / 非云元数据 IP）
- 非 `file:` `javascript:` 等危险 scheme（`url-safety.ts` 现有 `DANGEROUS_SCHEMES` 复用）

**不阻断条件**（保留兼容）：
- 用户配 `path` 为相对路径走 `baseUrl`：仍要校验 `baseUrl` 满足公网 https
- DNS 解析阶段攻击（rebinding）：本 spec **不防**——浏览器/Node fetch 都没法保证 SSRF 完全不可能；本 spec 只防低成本静态配置攻击

---

## 2. 改造范围

### 2.1 新加 helper — `packages/shared/src/utils/url-safety.ts`

```typescript
// U-API: M3 SSRF 防护 — assertPublicHttpsUrl helper（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md §2.1）
const PRIVATE_HOST_RANGES: ReadonlyArray<RegExp> = [
  /^127\./,                              // 回环 127.0.0.0/8
  /^10\./,                               // 私网 10.0.0.0/8
  /^192\.168\./,                         // 私网 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[01])\./,          // 私网 172.16.0.0/12
  /^169\.254\./,                         // link-local + 云元数据 169.254.169.254
  /^0\./,                                // 0.0.0.0/8
  /^::1$/,                               // IPv6 回环
  /^fc[0-9a-f]{2}:/i,                    // IPv6 unique local fc00::/7
  /^fe[89ab][0-9a-f]:/i,                 // IPv6 link-local fe80::/10
];

const PRIVATE_HOST_NAMES: ReadonlySet<string> = new Set([
  'localhost',
  'metadata.google.internal',           // GCP 元数据
  'metadata.azure.com',                 // Azure 元数据
]);

export type AssertHttpsUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Validate that a URL points to a public HTTPS endpoint, suitable for
 * outbound API calls carrying user credentials.
 *
 * Blocks: non-https schemes, private/loopback/link-local IPs, cloud metadata endpoints.
 * Does NOT defend against DNS rebinding — that requires runtime resolution which
 * is out of scope for static config-time defense.
 */
export function assertPublicHttpsUrl(rawUrl: string): AssertHttpsUrlResult {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { ok: false, reason: 'empty URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: 'malformed URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `protocol "${parsed.protocol}" not allowed (https only)` };
  }

  const host = parsed.hostname.toLowerCase();

  if (PRIVATE_HOST_NAMES.has(host)) {
    return { ok: false, reason: `host "${host}" is a known private/metadata target` };
  }

  for (const pattern of PRIVATE_HOST_RANGES) {
    if (pattern.test(host)) {
      return { ok: false, reason: `host "${host}" matches private/loopback range` };
    }
  }

  return { ok: true, url: parsed };
}
```

### 2.2 接入 `credential-manager.ts:refreshApiRenew`

```typescript
// 在 L981 第 1 步 "Resolve URL" 之后、L982 "Build headers" 之前插入：

// U-API: M3 SSRF 防护 — 校验 renewEndpoint 是公网 https（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md）
const safety = assertPublicHttpsUrl(url);
if (!safety.ok) {
  throw new Error(
    `Renew endpoint URL rejected by SSRF guard: ${safety.reason}. ` +
    `Configured path: ${renewConfig.path}, resolved: ${url}`,
  );
}
```

> imports 区加：`import { assertPublicHttpsUrl } from '../utils/url-safety.ts';`

### 2.3 §3.7 marker

| # | 文件 | 注释 | 标记 |
|---|---|---|---|
| 50 | `packages/shared/src/utils/url-safety.ts` | `M3 SSRF 防护 — assertPublicHttpsUrl helper` | 块（含 PRIVATE_HOST_RANGES + PRIVATE_HOST_NAMES + assertPublicHttpsUrl）|
| 51 | `packages/shared/src/sources/credential-manager.ts:~982` | `M3 SSRF 防护 — 校验 renewEndpoint 是公网 https` | 单行 |

> ✅ **已 ship（v23 P1 + v24 Bucket B）**：v23 P1 commit `7c9cce68` 加 createApiTool SSRF 接入；v24 Bucket B `943a40be` 加 redirect:'manual' + 30x 拒绝。当前实际基线 **82**（不是 spec 原写的 75）；详见 CLAUDE.md §3.7 #43/#44a-d/#45a-b 实际登记。
>
> （历史记录）改造完成后 [CLAUDE.md §3.7](../CLAUDE.md) 加 #50-#51（spec 原计划"基线 67 + M3-1/cleanup 6 项 + 此 2 项 = 75"，实施时编号合并到 #44/#45 系列）。

---

## 3. 单测（C5 自洽 + 关键覆盖）

新增 `packages/shared/src/utils/__tests__/assert-public-https-url.test.ts`：

```typescript
import { describe, expect, test } from 'bun:test';
import { assertPublicHttpsUrl } from '../url-safety';

describe('assertPublicHttpsUrl', () => {
  describe('OK cases', () => {
    test.each([
      'https://api.openai.com/v1/auth/refresh',
      'https://example.com:8443/refresh',
      'https://api.u-studio.cn/auth/renew',
    ])('accepts %s', (url) => {
      const result = assertPublicHttpsUrl(url);
      expect(result.ok).toBe(true);
    });
  });

  describe('SSRF rejection', () => {
    test.each([
      // 云元数据
      ['http://169.254.169.254/latest/meta-data/', 'private/loopback'],
      ['https://169.254.169.254/computeMetadata/v1/', 'private/loopback'],
      ['https://metadata.google.internal/', 'private/metadata'],
      ['https://metadata.azure.com/', 'private/metadata'],
      // 回环
      ['https://127.0.0.1/admin', 'private/loopback'],
      ['https://localhost:9200/', 'private/metadata'],
      ['https://[::1]/', 'private/loopback'],
      // 私网
      ['https://10.0.0.1/', 'private/loopback'],
      ['https://192.168.1.1/', 'private/loopback'],
      ['https://172.16.0.1/', 'private/loopback'],
      ['https://172.31.255.255/', 'private/loopback'],
    ])('rejects %s', (url, expectedReason) => {
      const result = assertPublicHttpsUrl(url);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(expectedReason);
      }
    });
  });

  describe('protocol rejection', () => {
    test.each([
      'http://api.example.com/refresh',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/plain;base64,SGVsbG8=',
      'ftp://example.com/',
    ])('rejects non-https %s', (url) => {
      const result = assertPublicHttpsUrl(url);
      expect(result.ok).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('empty string rejected', () => {
      expect(assertPublicHttpsUrl('').ok).toBe(false);
    });
    test('whitespace rejected', () => {
      expect(assertPublicHttpsUrl('   ').ok).toBe(false);
    });
    test('malformed URL rejected', () => {
      expect(assertPublicHttpsUrl('not a url').ok).toBe(false);
    });
    // 边界值（这些必须公网通过——不应被规则误杀）
    test('172.15.x is public（not 172.16-31）', () => {
      expect(assertPublicHttpsUrl('https://172.15.0.1/').ok).toBe(true);
    });
    test('172.32.x is public', () => {
      expect(assertPublicHttpsUrl('https://172.32.0.1/').ok).toBe(true);
    });
    test('11.x is public（not 10.x）', () => {
      expect(assertPublicHttpsUrl('https://11.0.0.1/').ok).toBe(true);
    });
  });
});
```

回归测试加在现有 `credential-manager-renew.test.ts`：

```typescript
test('refreshApiRenew rejects SSRF target (cloud metadata)', async () => {
  const source: LoadedSource = {
    config: {
      type: 'api',
      api: {
        baseUrl: 'https://attacker.example.com',
        renewEndpoint: { path: 'http://169.254.169.254/latest/meta-data/' },
        // ...
      },
    },
    // ...
  };
  // ...
  await expect(manager.refresh(source)).rejects.toThrow(/SSRF guard/);
});
```

---

## 4. 验收清单

- [ ] `url-safety.ts` 加 `assertPublicHttpsUrl` helper（含 IPv4/IPv6 + 元数据域名）
- [ ] `credential-manager.ts:refreshApiRenew` 接入 helper
- [ ] 单测覆盖 ≥ 20 条（OK + SSRF + protocol + edge）
- [ ] 集成测试覆盖 `refreshApiRenew` rejection
- [ ] [CLAUDE.md §3.7](../CLAUDE.md) 加 #50-#51
- [ ] grep `fetch(url` `fetch(\`http` 全仓——其他可能 SSRF 的点列出来作为后续 follow-up（不在本 spec 范围）

---

## 5. 关联规格 + 防御边界

- [REVIEW-21-FULL-2026-05-07.md §2.4 #4](sync-reports/REVIEW-21-FULL-2026-05-07.md)（finding 来源）
- [`packages/shared/src/utils/url-safety.ts`](../packages/shared/src/utils/url-safety.ts)（现有 scheme 防 XSS，本 spec 加 SSRF 防护）
- [CLAUDE.md §3.7](../CLAUDE.md) C5（C5 自洽——新改造点必加单测）

### 5.1 本 spec 不防的攻击

| 攻击 | 原因 |
|---|---|
| **DNS rebinding** | 需要 runtime 解析时再校验 IP，复杂度高，留 follow-up |
| **重定向到私网**（HTTP 30x） | 现 fetch 默认 follow redirect，需要禁 follow 或校验中间跳数；本 spec 不处理 |
| **公网 server 内的 SSRF**（攻击者控制公网域名 → 内部代理）| 不在 SSRF 防护边界内 |
| **第三方 OAuth provider 外的 source 类型**（MCP / Local） | 走不同 fetch 路径，不在本 spec 接入点；建议 follow-up grep 全仓 fetch 后续逐个加 helper |

### 5.2 follow-up（不在本 spec）

```bash
# M3 启动后跑这个 grep 列后续接入点
grep -rn "fetch(url\|await fetch(\`http" packages apps \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v __tests__
```

逐个评估是否走用户配置的 URL；走的都该接 `assertPublicHttpsUrl`。
