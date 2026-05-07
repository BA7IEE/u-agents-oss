/**
 * api-tools SSRF guard 运行时测试（v24 F1.F5 重写：从 grep-only 占位符 → runtime mock fetch）
 *
 * 验证 createApiTool 返回的 tool 在被调用时：
 * 1. assertPublicHttpsUrl 拒绝云元数据/私网/非 https URL（不发 fetch）
 * 2. fetchOptions.redirect === 'manual'（防 redirect bypass）
 * 3. 30x 响应被主动拒绝并返回 isError 错误响应（不 follow redirect）
 *
 * 详见：
 *   - .planning/M3-REFRESH-API-SSRF-SPEC.md §5.2 follow-up（v23 落地）
 *   - .planning/sync-reports/REVIEW-24-POST-SYNC-2026-05-07.md §1.1-1.2（v24 F1.F3+F1.F5 真修）
 *
 * §3.7 关联：#45a api-tools.ts SSRF marker（基线 73）
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createApiTool } from '../api-tools.ts';
import type { ApiCredential } from '../api-tools.ts';
import type { ApiConfig } from '../types.ts';

// Capture fetch calls
let fetchCalls: { url: string; init: RequestInit }[] = [];

function mockFetchOk(responseBody: unknown = { ok: true }, status = 200) {
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response(
      JSON.stringify(responseBody),
      { status, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof globalThis.fetch;
}

function mockFetchRedirect(toLocation: string, status = 302) {
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response('', {
      status,
      headers: { location: toLocation },
    });
  }) as typeof globalThis.fetch;
}

function makeConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    name: 'test-api',
    baseUrl: 'https://api.example.com',
    auth: { type: 'bearer' },
    ...overrides,
  };
}

const cred: ApiCredential = 'test-token-12345';

describe('api-tools SSRF guard — pre-fetch URL rejection', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('rejects cloud metadata IP (169.254.169.254) without fetching', async () => {
    mockFetchOk();
    const tool = createApiTool(
      makeConfig({ baseUrl: 'http://169.254.169.254' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/latest/meta-data/iam/security-credentials/', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(0);
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('SSRF guard');
  });

  it('rejects private 192.168.x.x without fetching', async () => {
    mockFetchOk();
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://192.168.1.1' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/admin', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(0);
    expect(result.isError).toBe(true);
  });

  it('rejects http:// (non-https) without fetching', async () => {
    mockFetchOk();
    const tool = createApiTool(
      makeConfig({ baseUrl: 'http://api.example.com' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(0);
    expect(result.isError).toBe(true);
  });

  it('rejects localhost without fetching', async () => {
    mockFetchOk();
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://localhost:9200' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(0);
    expect(result.isError).toBe(true);
  });

  it('accepts legitimate public https URL (passes through to fetch)', async () => {
    mockFetchOk({ data: 'ok' });
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://api.example.com' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/users', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe('https://api.example.com/users');
    expect(result.isError).toBeUndefined();
  });
});

describe('api-tools SSRF guard — redirect bypass防护（v24 F1.F3）', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('passes redirect:"manual" to fetch options', async () => {
    mockFetchOk();
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://api.example.com' }),
      cred,
    );
    await tool.handler(
      { path: '/', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.init.redirect).toBe('manual');
  });

  it('rejects 302 redirect (would otherwise leak token to attacker.com → 169.254.169.254)', async () => {
    mockFetchRedirect('http://169.254.169.254/latest/meta-data/iam/security-credentials/', 302);
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://attacker.com' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/api', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    // fetch was called once (to attacker.com legitimately), but redirect was NOT followed
    expect(fetchCalls).toHaveLength(1);
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('redirect');
    expect(text).toContain('SSRF prevention');
  });

  it('rejects 301 permanent redirect', async () => {
    mockFetchRedirect('https://elsewhere.com/', 301);
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://api.example.com' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/', method: 'GET', params: undefined, _intent: 'test' },
      {},
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('301');
  });

  it('rejects 307/308 redirect (preserves method)', async () => {
    mockFetchRedirect('https://elsewhere.com/', 307);
    const tool = createApiTool(
      makeConfig({ baseUrl: 'https://api.example.com' }),
      cred,
    );
    const result = await tool.handler(
      { path: '/', method: 'POST', params: undefined, _intent: 'test' },
      {},
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('307');
  });
});

describe('api-tools SSRF guard — marker 防回归', () => {
  it('static source check: assertPublicHttpsUrl 接入 + redirect:"manual" 配置都在', async () => {
    // 这是源码层防护，确保 import 和接入未来不被 revert
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(__dirname, '..', 'api-tools.ts'), 'utf-8');
    expect(src).toMatch(/import\s*\{\s*assertPublicHttpsUrl\s*\}/);
    expect(src).toMatch(/redirect:\s*['"]manual['"]/);
    // marker 至少 4 处（import + redirect:'manual' 注释 + safety check + 30x reject 注释）
    const markers = src.match(/\/\/\s*U-API:\s*M3 SSRF/g) ?? [];
    expect(markers.length).toBeGreaterThanOrEqual(4);
  });
});
