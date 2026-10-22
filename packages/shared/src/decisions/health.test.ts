import { describe, it, expect } from 'bun:test';
import { probeDecisionServer, probeConfiguredDecisionServer } from './health.ts';
import { normalizeDecisionLayerSettings } from './settings.ts';

// U-API: probes cannot reopen the disabled independent model route.
describe('decision health product policy', () => {
  it('rejects preset, custom, malformed and overridden URLs without network access', async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; throw new Error('must not fetch'); }) as unknown as typeof fetch;
    for (const provider of ['laya', 'custom'] as const) {
      for (const baseUrl of ['', 'not a url', 'http://127.0.0.1:8000', 'https://example.com']) {
        const direct = await probeDecisionServer(provider, baseUrl, { fetch: fetchImpl });
        const configured = await probeConfiguredDecisionServer(normalizeDecisionLayerSettings({ enabled: true, provider, baseUrl }), { fetch: fetchImpl, baseUrlOverride: baseUrl });
        for (const result of [direct, configured]) {
          expect(result.reachable).toBe(false);
          expect(result.message).toBe('U Agents 不支持独立决策模型');
        }
      }
    }
    expect(calls).toBe(0);
  });
});
