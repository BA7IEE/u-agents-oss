// U-API: real RPC -> vault/config -> reload -> Pi model definition, with synthetic credentials.
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { ensureConfigDir, saveConfig } from '@u-agents/shared/config/storage'
import { getLlmConnection, U_API_BASE_URL, type LlmConnection } from '@u-agents/shared/config'
import { getCredentialManager } from '@u-agents/shared/credentials'
import * as backend from '@u-agents/shared/agent/backend'
import { RPC_CHANNELS } from '@u-agents/shared/protocol'
import { initModelRefreshService } from '../../model-fetchers'
import { buildCustomEndpointModelDef } from '../../../../pi-agent-server/src/custom-endpoint-models'
import { maskApiKey } from '../../domain/connection-setup-logic'

const probes: any[] = []
mock.module('@u-agents/shared/agent/backend', () => ({ ...backend,
  testBackendConnection: async (input: any) => { probes.push(input); return { success: true } },
}))
const { registerLlmConnectionsHandlers } = await import('./llm-connections')
const handlers = new Map<string, (...args: any[]) => Promise<any>>()
registerLlmConnectionsHandlers({ handle: (channel: string, fn: any) => handlers.set(channel, fn) } as never, {
  sessionManager: { reinitializeAuth: async () => {}, refreshConnectionRuntime: async () => {} },
  platform: { appRootPath: process.cwd(), resourcesPath: process.cwd(), isPackaged: false },
} as never)
const dispatch = (channel: string, input: any) => handlers.get(channel)!({}, input)
const manager = getCredentialManager()
let service: ReturnType<typeof initModelRefreshService>
const originalFetch = globalThis.fetch
const catalog = () => Response.json({ data: [{ id: 'chat-model', supported_endpoint_types: ['openai'] }] })
const seed = (maxTokens: unknown = 32768) => saveConfig({
  workspaces: [], defaultLlmConnection: 'u-api',
  llmConnections: [{ slug: 'u-api', name: 'U-API', providerType: 'pi_compat', authType: 'api_key_with_endpoint',
    baseUrl: U_API_BASE_URL, models: ['chat-model'], defaultModel: 'chat-model',
    modelSelectionMode: 'automaticallySyncedFromProvider',
    customEndpoint: { api: 'openai-completions', supportsImages: false, maxTokens },
  }],
} as never)
const setup = (credential: string, customEndpoint: object = { api: 'openai-completions', maxTokens: 999999 }) => ({
  slug: 'u-api', baseUrl: U_API_BASE_URL, credential, models: ['chat-model'], defaultModel: 'chat-model', customEndpoint,
})
beforeEach(async () => {
  ensureConfigDir(); seed(); probes.length = 0
  await manager.setLlmApiKey('u-api', 'synthetic-original-token')
  globalThis.fetch = (async () => catalog()) as unknown as typeof fetch
  service = initModelRefreshService(async slug => ({ apiKey: await manager.getLlmApiKey(slug) ?? undefined }))
})
afterEach(() => { service.stopAll(); globalThis.fetch = originalFetch })

test('masked and plain same-Token edits preserve the cap through test, save, refresh, reload and Pi initialization', async () => {
  for (const apiKey of [maskApiKey('synthetic-original-token'), 'synthetic-original-token']) {
    const result = await dispatch(RPC_CHANNELS.settings.TEST_LLM_CONNECTION_SETUP, {
      provider: 'pi', baseUrl: U_API_BASE_URL, connectionSlug: 'u-api', apiKey,
    })
    expect(result.success).toBe(true)
    expect(result.resolvedSetup.customEndpoint.maxTokens).toBe(32768)
    expect(probes.at(-1).connection.customEndpoint.maxTokens).toBe(32768)
    expect((await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, {
      ...setup(apiKey), ...result.resolvedSetup,
    })).success).toBe(true)
    await service.refreshConnection('u-api')
    const saved = getLlmConnection('u-api')!
    expect(saved.customEndpoint?.maxTokens).toBe(32768)
    expect(buildCustomEndpointModelDef(saved.defaultModel!, saved.customEndpoint).maxTokens).toBe(32768)
  }
})

test('new Token, new protocol and new connection discard echoed caps', async () => {
  expect((await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, setup('synthetic-new-token'))).success).toBe(true)
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()
  seed()
  expect((await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION,
    setup('synthetic-new-token', { api: 'anthropic-messages', maxTokens: 32768 }))).success).toBe(true)
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()
  const added = await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, { ...setup('synthetic-new-token'), slug: 'u-api-2' })
  expect(added.success).toBe(true)
  expect(getLlmConnection('u-api-2')!.customEndpoint?.maxTokens).toBeUndefined()
})

test('invalid stored caps cannot be restored by testing or saving', async () => {
  for (const value of [0, -1, 1.5, '32768', null, Number.MAX_SAFE_INTEGER + 1]) {
    seed(value)
    const result = await dispatch(RPC_CHANNELS.settings.TEST_LLM_CONNECTION_SETUP, {
      provider: 'pi', baseUrl: U_API_BASE_URL, connectionSlug: 'u-api', apiKey: maskApiKey('synthetic-original-token'),
    })
    expect(result.resolvedSetup.customEndpoint.maxTokens).toBeUndefined()
    expect((await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, setup('synthetic-original-token'))).success).toBe(true)
    expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()
  }
})

test('an old refresh cannot restore metadata after the Token changes', async () => {
  let release!: () => void
  let started!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const entered = new Promise<void>(resolve => { started = resolve })
  globalThis.fetch = (async () => { started(); await waiting; return catalog() }) as unknown as typeof fetch
  const refresh = service.refreshConnection('u-api')
  await entered
  const result = await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, setup('synthetic-new-token'))
  expect(result.success).toBe(true)
  release(); await refresh
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()
  expect(await manager.getLlmApiKey('u-api')).toBe('synthetic-new-token')
})

test('an old successful test cannot put its cap back after a later Token save', async () => {
  const result = await dispatch(RPC_CHANNELS.settings.TEST_LLM_CONNECTION_SETUP, {
    provider: 'pi', baseUrl: U_API_BASE_URL, connectionSlug: 'u-api', apiKey: 'synthetic-original-token',
  })
  await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, setup('synthetic-new-token'))
  await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, {
    ...setup(maskApiKey('synthetic-new-token')), ...result.resolvedSetup,
  })
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()
})

test('generic metadata saves cannot inject caps or revive stale Token/protocol metadata', async () => {
  const original = getLlmConnection('u-api')!
  const save = (connection: LlmConnection) => dispatch(RPC_CHANNELS.llmConnections.SAVE, connection)
  expect((await save({ ...original, name: 'Renamed',
    customEndpoint: { ...original.customEndpoint!, maxTokens: 999999 },
  })).success).toBe(true)
  expect(getLlmConnection('u-api')!.name).toBe('Renamed')
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBe(32768)

  expect((await dispatch(RPC_CHANNELS.settings.SETUP_LLM_CONNECTION, setup('synthetic-new-token'))).success).toBe(true)
  expect((await save(original)).success).toBe(true)
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()

  seed()
  expect((await save({ ...original, customEndpoint: { api: 'anthropic-messages', maxTokens: 32768 } })).success).toBe(true)
  expect(getLlmConnection('u-api')!.customEndpoint?.maxTokens).toBeUndefined()

  expect((await save({ ...original, slug: 'u-api-3' })).success).toBe(true)
  expect(getLlmConnection('u-api-3')!.customEndpoint?.maxTokens).toBeUndefined()
  expect((await save({ ...original, baseUrl: 'https://example.invalid/v1' })).success).toBe(false)
})
