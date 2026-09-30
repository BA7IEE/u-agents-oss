/**
 * web-fetch SSRF guard 运行时测试（v27 落地：M3-SSRF-CONSOLIDATION-SPEC §2.1）
 *
 * 验证 createWebFetchTool 返回的 tool 在被调用时：
 * 1. fetchOptions.redirect === 'manual'（防 redirect bypass）
 * 2. 30x 响应被主动拒绝并返回 isError 错误响应（不 follow redirect）
 * 3. 源码层 marker 防回归：// U-API: M3 SSRF 防护 注释存在
 *
 * 详见：
 *   - .planning/M3-SSRF-CONSOLIDATION-SPEC.md §2.1（v27 真修：redirect bypass）
 *   - .planning/sync-reports/REVIEW-27-FULL-2026-05-08.md（触发本测试的 review）
 *
 * 注意：validateUrl（DNS-based 私网检查）在上游已实现，本测试不重复 — 只测我们 v27 加的部分。
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createWebFetchTool } from './web-fetch.ts';

// Capture fetch calls
let fetchCalls: { url: string; init: RequestInit }[] = [];

function mockFetchRedirect(toLocation: string, status = 302): typeof globalThis.fetch {
  fetchCalls = [];
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response('', {
      status,
      headers: { location: toLocation },
    });
  }) as typeof globalThis.fetch;
}

function mockFetchOk(): typeof globalThis.fetch {
  fetchCalls = [];
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response(
      '<html><body><h1>Hello</h1></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
  }) as typeof globalThis.fetch;
}

describe('web-fetch SSRF guard — redirect bypass 防护（v27 真修）', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('passes redirect:"manual" to fetch options', async () => {
    globalThis.fetch = mockFetchOk();
    const tool = createWebFetchTool(() => null);
    await tool.execute('test-1', { url: 'https://93.184.216.34' });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.init.redirect).toBe('manual');
  });

  it('rejects 302 redirect to cloud metadata (would otherwise leak IAM credentials)', async () => {
    globalThis.fetch = mockFetchRedirect('http://169.254.169.254/latest/meta-data/iam/security-credentials/', 302);
    const tool = createWebFetchTool(() => null);
    const result = await tool.execute('test-2', { url: 'https://93.184.216.34' });
    // fetch was called once (to example.com legitimately), but redirect was NOT followed
    expect(fetchCalls).toHaveLength(1);
    const errResult = result as { content: Array<{ text: string }>; details?: { isError?: boolean } };
    expect(errResult.details?.isError).toBe(true);
    expect(errResult.content[0]?.text).toContain('redirect blocked');
    expect(errResult.content[0]?.text).toContain('SSRF protection');
  });

  it('rejects 301 permanent redirect to private IP', async () => {
    globalThis.fetch = mockFetchRedirect('http://192.168.1.1/admin', 301);
    const tool = createWebFetchTool(() => null);
    const result = await tool.execute('test-3', { url: 'https://93.184.216.34' });
    const errResult = result as { content: Array<{ text: string }>; details?: { isError?: boolean } };
    expect(errResult.details?.isError).toBe(true);
    expect(errResult.content[0]?.text).toContain('301');
  });

  it('rejects 307 temporary redirect (preserves method)', async () => {
    globalThis.fetch = mockFetchRedirect('https://attacker.com/', 307);
    const tool = createWebFetchTool(() => null);
    const result = await tool.execute('test-4', { url: 'https://93.184.216.34' });
    const errResult = result as { content: Array<{ text: string }>; details?: { isError?: boolean } };
    expect(errResult.details?.isError).toBe(true);
    expect(errResult.content[0]?.text).toContain('307');
  });

  it('rejects 308 permanent redirect (preserves method)', async () => {
    globalThis.fetch = mockFetchRedirect('https://elsewhere.com/', 308);
    const tool = createWebFetchTool(() => null);
    const result = await tool.execute('test-5', { url: 'https://93.184.216.34' });
    const errResult = result as { content: Array<{ text: string }>; details?: { isError?: boolean } };
    expect(errResult.details?.isError).toBe(true);
    expect(errResult.content[0]?.text).toContain('308');
  });

  it('accepts legitimate non-redirect 200 response (passes through)', async () => {
    globalThis.fetch = mockFetchOk();
    const tool = createWebFetchTool(() => null);
    const result = await tool.execute('test-6', { url: 'https://93.184.216.34' });
    expect(fetchCalls).toHaveLength(1);
    const okResult = result as { content: Array<{ text: string }>; details?: { isError?: boolean } };
    expect(okResult.details?.isError).toBeUndefined();
  });
});

describe('web-fetch SSRF guard — marker 防回归', () => {
  it('static source check: redirect:"manual" + U-API marker 都在', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(__dirname, 'web-fetch.ts'), 'utf-8');
    // redirect:'manual' 必须存在（不能 revert 为 'follow' 或省略）
    expect(src).toMatch(/redirect:\s*['"]manual['"]/);
    // 30x reject 块必须存在（不能 revert）
    expect(src).toMatch(/redirect blocked/);
    // U-API: M3 SSRF marker 至少 2 处（redirect:'manual' 注释 + 30x reject 注释）
    const markers = src.match(/\/\/\s*U-API:\s*M3 SSRF/g) ?? [];
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });
});
