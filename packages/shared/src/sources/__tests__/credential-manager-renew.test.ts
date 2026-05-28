/**
 * Unit tests for the API renew endpoint token refresh feature.
 *
 * Tests the token substitution helpers and the doRefresh() routing
 * for sources with renewEndpoint configuration.
 */

import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { SourceCredentialManager } from '../credential-manager.ts';
import type { FolderSourceConfig } from '../types.ts';

// Track save() calls without globally mocking credentials/storage modules.
// Bun module mocks leak across files in the same test process; method spies keep
// this test discoverable alongside storage.ts regression tests.
let setCalls: unknown[][] = [];
let mockGet = mock(() => Promise.resolve(null as unknown));
let loadSpy: { mockRestore: () => void } | null = null;
let saveSpy: { mockRestore: () => void } | null = null;

function createRenewSource(overrides: Partial<FolderSourceConfig> = {}) {
  const config: FolderSourceConfig = {
    id: 'test-id',
    name: 'Test Source',
    slug: 'test-source',
    enabled: true,
    provider: 'custom-api',
    type: 'api',
    isAuthenticated: true,
    api: {
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      renewEndpoint: { path: '/auth/refresh' },
    },
    ...overrides,
  };
  return {
    config,
    guide: null,
    folderPath: '/mock/path',
    workspaceRootPath: '/mock/workspace',
    workspaceId: 'mock-workspace',
  };
}

// Capture fetch calls
let fetchCalls: { url: string; init: RequestInit }[] = [];

function mockFetch(responseBody: unknown, status = 200) {
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response(
      JSON.stringify(responseBody),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof globalThis.fetch;
}

function mockFetchText(text: string, status: number) {
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response(text, { status });
  }) as typeof globalThis.fetch;
}

describe('refreshApiRenew via refresh()', () => {
  let credManager: SourceCredentialManager;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    credManager = new SourceCredentialManager();
    originalFetch = globalThis.fetch;
    setCalls = [];
    fetchCalls = [];
    mockGet = mock(() => Promise.resolve(null as unknown));
    loadSpy = spyOn(credManager, 'load').mockImplementation(async () => await mockGet() as never);
    saveSpy = spyOn(credManager, 'save').mockImplementation(async (source, credential) => {
      setCalls.push([credManager.getCredentialId(source), credential]);
    });
  });

  afterEach(() => {
    loadSpy?.mockRestore();
    saveSpy?.mockRestore();
    loadSpy = null;
    saveSpy = null;
    globalThis.fetch = originalFetch;
  });

  test('calls renew endpoint and saves new token', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: {
          path: '/auth/refresh',
          method: 'POST',
          tokenField: 'access_token',
          expiresInField: 'expires_in',
        },
      },
    });

    const result = await credManager.refresh(source);

    expect(result).toBe('new-token');
    expect(fetchCalls[0]!.url).toBe('https://api.example.com/auth/refresh');
    expect(setCalls.length).toBeGreaterThan(0);
  });

  test('uses custom token and expiry field names', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ jwt: 'jwt-token-xyz', ttl: 7200 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: '/api/token/renew', tokenField: 'jwt', expiresInField: 'ttl' },
      },
    });

    expect(await credManager.refresh(source)).toBe('jwt-token-xyz');
  });

  test('substitutes {{token}} in body', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'current-access-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: {
          path: '/auth/refresh',
          body: { token: '{{token}}', grant_type: 'refresh' },
        },
      },
    });

    await credManager.refresh(source);

    const body = JSON.parse(fetchCalls[0]!.init.body as string);
    expect(body.token).toBe('current-access-token');
    expect(body.grant_type).toBe('refresh');
  });

  test('handles absolute renew URL', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://auth.example.com/oauth/token' },
      },
    });

    await credManager.refresh(source);
    expect(fetchCalls[0]!.url).toBe('https://auth.example.com/oauth/token');
  });

  test('returns null on 401 response', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetchText('Unauthorized', 401);

    const source = createRenewSource();
    expect(await credManager.refresh(source)).toBeNull();
  });

  test('uses fallbackTtlSecs when response has no expiry', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token' }); // no expires_in

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: '/auth/refresh', fallbackTtlSecs: 1800 },
      },
    });

    expect(await credManager.refresh(source)).toBe('new-token');

    // Verify expiresAt was set using fallbackTtlSecs
    const savedCred = setCalls[0]?.[1] as { expiresAt?: number } | undefined;
    expect(savedCred?.expiresAt).toBeDefined();
    const expectedExpiry = Date.now() + 1800 * 1000;
    expect(Math.abs((savedCred?.expiresAt ?? 0) - expectedExpiry)).toBeLessThan(5000);
  });

  test('merges defaultHeaders into renew request', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        defaultHeaders: { 'X-Tenant-ID': 'acme-corp' },
        renewEndpoint: { path: '/auth/refresh' },
      },
    });

    await credManager.refresh(source);

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['X-Tenant-ID']).toBe('acme-corp');
    expect(headers['Authorization']).toBe('Bearer old-token');
  });
});

// U-API: M3 SSRF 防护 — 拒绝 credential-bearing fetch 到云元数据/私网（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md）
// REVIEW-3 v0.9.6 sync: 上游把 module-level mock.module 改成 per-describe spyOn，
// 这里同步迁移 — 否则 credManager.load/save 不被拦截，SSRF guard 测试断言会 fail。
describe('refreshApiRenew SSRF guard', () => {
  let credManager: SourceCredentialManager;
  let loadSpy: { mockRestore: () => void } | null = null;
  let saveSpy: { mockRestore: () => void } | null = null;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    setCalls = [];
    fetchCalls = [];
    credManager = new SourceCredentialManager();
    originalFetch = globalThis.fetch;
    mockGet = mock(() => Promise.resolve(null as unknown));
    loadSpy = spyOn(credManager, 'load').mockImplementation(async () => await mockGet() as never);
    saveSpy = spyOn(credManager, 'save').mockImplementation(async (source, credential) => {
      setCalls.push([credManager.getCredentialId(source), credential]);
    });
  });

  afterEach(() => {
    loadSpy?.mockRestore();
    saveSpy?.mockRestore();
    loadSpy = null;
    saveSpy = null;
    globalThis.fetch = originalFetch;
    mockGet.mockReset();
  });

  test('rejects renew endpoint pointing at AWS/GCP IMDS', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' },
      },
    });

    // SSRF guard throws inside try/catch → refresh() returns null (consistent with other failures);
    // critical assertion is that fetch() was NEVER called with the malicious URL (no token leak).
    const result = await credManager.refresh(source);
    expect(result).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  test('rejects renew endpoint pointing at localhost', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://localhost:9200/auth/refresh' },
      },
    });

    // SSRF guard throws inside try/catch → refresh() returns null (consistent with other failures);
    // critical assertion is that fetch() was NEVER called with the malicious URL (no token leak).
    const result = await credManager.refresh(source);
    expect(result).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  test('rejects renew endpoint pointing at private 192.168.x', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://192.168.1.1/auth/refresh' },
      },
    });

    // SSRF guard throws inside try/catch → refresh() returns null (consistent with other failures);
    // critical assertion is that fetch() was NEVER called with the malicious URL (no token leak).
    const result = await credManager.refresh(source);
    expect(result).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  test('rejects http:// (non-https) renew endpoint', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'http://api.example.com/auth/refresh' },
      },
    });

    // SSRF guard throws inside try/catch → refresh() returns null (consistent with other failures);
    // critical assertion is that fetch() was NEVER called with the malicious URL (no token leak).
    const result = await credManager.refresh(source);
    expect(result).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  test('still accepts public https renew endpoint', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://api.example.com/auth/refresh' },
      },
    });

    await credManager.refresh(source);
    expect(fetchCalls).toHaveLength(1);
  });

  // U-API: M3 SSRF redirect bypass 防护（v24 F1.F3 P0 真修）
  test('passes redirect:"manual" to fetch options', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const source = createRenewSource({
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://api.example.com/auth/refresh' },
      },
    });

    await credManager.refresh(source);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.init.redirect).toBe('manual');
  });

  test('rejects 302 redirect (would otherwise leak token to attacker → 169.254.169.254)', async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve({
      value: 'old-token', expiresAt: Date.now() - 60_000,
    }));
    // attacker controls baseUrl 但 SSRF guard 通过（合法 https），fetch 后返回 302 → 云元数据
    fetchCalls = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init: init ?? {} });
      return new Response('', {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' },
      });
    }) as typeof globalThis.fetch;

    const source = createRenewSource({
      api: {
        baseUrl: 'https://attacker.com',
        authType: 'bearer',
        renewEndpoint: { path: 'https://attacker.com/refresh' },
      },
    });

    // 30x 被主动拒绝 → throw → refresh() returns null
    const result = await credManager.refresh(source);
    expect(result).toBeNull();
    // fetch 跑了 1 次（attacker.com 合法 https），但 redirect 没 follow（fetchCalls.length 仍 1）
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.init.redirect).toBe('manual');
  });
});
