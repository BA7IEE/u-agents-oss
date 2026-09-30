// U-API: refresh preserves explicit false and the established recommendation rule.
import { expect, it } from 'bun:test'
import { preserveUApiImageCapabilities, resolveUApiRefreshSelection, type UApiModelDiscovery } from '../domain/u-api-model-discovery'
import { modelSupportsImages, type LlmConnection } from '@u-agents/shared/config'

const discovery: UApiModelDiscovery = { candidates: ['new', 'manual', 'old'].map((id, sourceIndex) => ({
  id, sourceIndex, recommended: sourceIndex === 0, protocols: ['openai-completions', 'anthropic-messages'],
})) }

it('distinguishes automatic first-ranked defaults, manual choices and missing models', () => {
  for (const [current, expected] of [['old', 'new'], ['manual', 'manual'], ['gone', 'new']]) {
    expect(resolveUApiRefreshSelection(discovery, { defaultModel: current, modelIds: ['old', 'manual'] }).defaultModel).toBe(expected)
  }
})

it('keeps image overrides by surviving ID through protocol change and JSON reload', () => {
  const connection = {
    slug: 'u-api', providerType: 'pi_compat',
    models: [{ id: 'manual', supportsImages: false }, { id: 'gone', supportsImages: true }, 'old'],
    customEndpoint: { api: 'openai-completions', supportsImages: false },
  } as LlmConnection
  const selection = resolveUApiRefreshSelection(discovery, {
    defaultModel: 'manual', modelIds: ['old', 'manual'], customEndpointApi: 'anthropic-messages',
  })
  const saved = JSON.parse(JSON.stringify({ ...connection, ...preserveUApiImageCapabilities(connection, selection) })) as LlmConnection
  expect(saved.customEndpoint?.api).toBe('anthropic-messages')
  expect(saved.customEndpoint?.supportsImages).toBe(false)
  expect(saved.models?.map(m => typeof m === 'string' ? m : m.id)).not.toContain('gone')
  expect(modelSupportsImages(saved, 'manual')).toBe(false)
  expect(modelSupportsImages(saved, 'new')).toBe(false)
  expect(saved.models?.find(m => typeof m !== 'string' && m.id === 'manual')).toMatchObject({ supportsImages: false })
})
