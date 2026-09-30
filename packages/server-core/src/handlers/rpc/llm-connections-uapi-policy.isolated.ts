// U-API: real RPC dispatch, isolated module mocks, no credentials or external requests.
import { describe, expect, it, mock } from 'bun:test'
import * as config from '@u-agents/shared/config'
import * as credentials from '@u-agents/shared/credentials'
import * as backend from '@u-agents/shared/agent/backend'
import { RPC_CHANNELS } from '@u-agents/shared/protocol'

let keyReads = 0
let probes: Record<string, unknown>[] = []
const slugs = ['u-api-default', 'u-api', 'u-api-2']
mock.module('@u-agents/shared/config', () => ({
  ...config,
  getLlmConnection: (slug: string) => slugs.includes(slug) ? { slug, providerType: 'pi_compat' } : null,
}))
mock.module('@u-agents/shared/credentials', () => ({
  ...credentials,
  getCredentialManager: () => ({ getLlmApiKey: async () => { keyReads++; return 'fixture-token' } }),
}))
mock.module('@u-agents/shared/agent/backend', () => ({
  ...backend,
  testBackendConnection: async (input: Record<string, unknown>) => { probes.push(input); return { success: true } },
}))
const { registerLlmConnectionsHandlers } = await import('./llm-connections')
const { maskApiKey } = await import('../../domain/connection-setup-logic')
const handlers = new Map<string, (...args: any[]) => Promise<any>>()
registerLlmConnectionsHandlers({ handle: (channel: string, fn: any) => handlers.set(channel, fn) } as never,
  { sessionManager: {}, platform: { appRootPath: '/tmp', resourcesPath: '/tmp', isPackaged: false } } as never)
const testConnection = handlers.get(RPC_CHANNELS.settings.TEST_LLM_CONNECTION_SETUP)!

describe('U-API setup credential routing', () => {
  it('rejects forbidden combinations before credential lookup or any fetch', async () => {
    const originalFetch = globalThis.fetch
    let fetches = 0
    globalThis.fetch = mock(async () => { fetches++; throw new Error('unexpected network') }) as unknown as typeof fetch
    keyReads = 0; probes = []
    try {
      for (const connectionSlug of slugs) {
        for (const patch of [
          { baseUrl: 'https://outside.example/v1' }, { baseUrl: 'http://127.0.0.1:9000' },
          { provider: 'anthropic' }, { connectionSlug: 'u-api-99' },
          { connectionSlug: 'openrouter' }, { connectionSlug: undefined },
        ]) {
          const result = await testConnection({}, { provider: 'pi', baseUrl: config.U_API_BASE_URL,
            connectionSlug, apiKey: maskApiKey('fixture-token'), ...patch })
          expect(result.success).toBe(false)
        }
      }
      expect(keyReads).toBe(0)
      expect(fetches).toBe(0)
      expect(probes).toHaveLength(0)
    } finally { globalThis.fetch = originalFetch }
  })

  it('resolves masks only for an existing U-API connection at the fixed gateway', async () => {
    const originalFetch = globalThis.fetch
    const urls: string[] = []
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url))
      return Response.json({ data: [{ id: 'chat-model', supported_endpoint_types: ['openai'] }] })
    }) as typeof fetch
    keyReads = 0; probes = []
    try {
      for (const connectionSlug of slugs) {
        const result = await testConnection({}, { provider: 'pi', baseUrl: config.U_API_BASE_URL,
          connectionSlug, apiKey: maskApiKey('fixture-token') })
        expect(result.success).toBe(true)
        expect(JSON.stringify(result)).not.toContain('fixture-token')
      }
      expect(keyReads).toBe(3)
      expect(urls).toEqual(slugs.map(() => `${config.U_API_BASE_URL}/models`))
      expect(probes).toHaveLength(3)
      for (const probe of probes) expect(probe.baseUrl).toBe(config.U_API_BASE_URL)
    } finally { globalThis.fetch = originalFetch }
  })
})
