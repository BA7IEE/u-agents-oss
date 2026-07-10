import { describe, expect, it } from 'bun:test'
import {
  discoverUApiModels,
  parseUApiModelsResponse,
  resolveUApiModelSelection,
  resolveUApiRefreshSelection,
  selectWorkingUApiModel,
  shouldTryNextUApiModel,
} from './u-api-model-discovery'

const currentCatalog = {
  object: 'list',
  data: [
    { id: 'gpt-5.4', supported_endpoint_types: ['openai'] },
    { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
    { id: 'gpt-image-2', supported_endpoint_types: ['openai'] },
    { id: 'gemini-3-pro-image-preview', supported_endpoint_types: ['gemini'] },
    { id: 'MiniMax-M2.7', supported_endpoint_types: ['openai'] },
    { id: 'MiniMax-M3', supported_endpoint_types: ['openai'] },
    { id: 'gpt-image-2-client', supported_endpoint_types: ['openai'] },
    { id: 'claude-sonnet-5', supported_endpoint_types: ['anthropic', 'openai'] },
  ],
}

describe('U-API automatic model discovery', () => {
  // U-API: automatic discovery regression coverage for dynamic defaults, filtering and fallback ordering
  it('filters non-chat models and ranks newer numeric model versions first', () => {
    const result = parseUApiModelsResponse({
      ...currentCatalog,
      data: [
        ...currentCatalog.data,
        { id: 'gpt-5.6-sol', supported_endpoint_types: ['openai'] },
      ],
    })

    expect(result.candidates.map(candidate => candidate.id)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.5',
      'gpt-5.4',
      'claude-sonnet-5',
      'MiniMax-M3',
      'MiniMax-M2.7',
    ])
  })

  it('uses server recommendation order and keeps the utility model last', () => {
    const result = parseUApiModelsResponse({
      ...currentCatalog,
      default_model: 'claude-sonnet-5',
      fallback_models: ['gpt-5.4', 'gpt-5.5'],
      utility_model: 'MiniMax-M2.7',
    })

    expect(result.candidates.slice(0, 3).map(candidate => candidate.id)).toEqual([
      'claude-sonnet-5',
      'gpt-5.4',
      'gpt-5.5',
    ])

    const selected = resolveUApiModelSelection(result, result.candidates[0]!)
    expect(selected.defaultModel).toBe('claude-sonnet-5')
    expect(selected.customEndpoint.api).toBe('openai-completions')
    expect(selected.models.at(-1)).toBe('MiniMax-M2.7')
  })

  it('rejects catalogs without a supported chat model', () => {
    expect(() => parseUApiModelsResponse({
      data: [
        { id: 'gpt-image-2', supported_endpoint_types: ['openai'] },
        { id: 'gemini-3-pro-image-preview', supported_endpoint_types: ['gemini'] },
      ],
    })).toThrow('No compatible chat models')
  })

  it('maps token authorization failures without exposing credentials', async () => {
    const fetchImpl = async () => new Response('{}', { status: 401 })
    await expect(discoverUApiModels('temporary-secret', { fetchImpl })).rejects.toThrow('Invalid API key')
  })

  it('only falls back for model or upstream availability failures', () => {
    expect(shouldTryNextUApiModel('model not found (404)')).toBe(true)
    expect(shouldTryNextUApiModel('bad response status code 522')).toBe(true)
    expect(shouldTryNextUApiModel('Invalid API key (401)')).toBe(false)
    expect(shouldTryNextUApiModel('Rate limit exceeded (429)')).toBe(false)
    expect(shouldTryNextUApiModel('Connection test timed out after 20000ms')).toBe(false)
  })

  it('probes models in recommendation order and stops at the first working candidate', async () => {
    const discovery = parseUApiModelsResponse({
      data: [
        { id: 'gpt-5.6-sol', supported_endpoint_types: ['openai'] },
        { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
      ],
    })
    const probed: string[] = []

    const selected = await selectWorkingUApiModel(discovery, async candidate => {
      probed.push(candidate.id)
      return candidate.id === 'gpt-5.6-sol'
        ? { success: false, error: 'bad response status code 522' }
        : { success: true }
    })

    expect(probed).toEqual(['gpt-5.6-sol', 'gpt-5.5'])
    expect(selected.defaultModel).toBe('gpt-5.5')
  })

  it('tries another advertised protocol before degrading to the next model', async () => {
    const discovery = parseUApiModelsResponse({
      data: [
        { id: 'gpt-5.6-sol', supported_endpoint_types: ['openai', 'anthropic'] },
        { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
      ],
    })
    const probed: string[] = []

    const selected = await selectWorkingUApiModel(discovery, async (candidate, selection) => {
      const attempt = `${candidate.id}:${selection.customEndpoint.api}`
      probed.push(attempt)
      return selection.customEndpoint.api === 'anthropic-messages'
        ? { success: true }
        : { success: false, error: 'no available channel (503)' }
    })

    expect(probed).toEqual([
      'gpt-5.6-sol:openai-completions',
      'gpt-5.6-sol:anthropic-messages',
    ])
    expect(selected.defaultModel).toBe('gpt-5.6-sol')
    expect(selected.customEndpoint.api).toBe('anthropic-messages')
  })

  it('does not hide token errors by probing lower-ranked models', async () => {
    const discovery = parseUApiModelsResponse({
      data: [
        { id: 'gpt-5.6-sol', supported_endpoint_types: ['openai'] },
        { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
      ],
    })
    let probeCount = 0

    await expect(selectWorkingUApiModel(discovery, async () => {
      probeCount += 1
      return { success: false, error: 'Invalid API key (401)' }
    })).rejects.toThrow('Invalid API key')

    expect(probeCount).toBe(1)
  })

  it('refreshes automatic defaults to a newer recommendation but preserves an explicit override', () => {
    const discovery = parseUApiModelsResponse({
      data: [
        { id: 'gpt-5.6-sol', supported_endpoint_types: ['openai'] },
        { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
        { id: 'gpt-5.4', supported_endpoint_types: ['openai'] },
      ],
    })

    expect(resolveUApiRefreshSelection(discovery, {
      defaultModel: 'gpt-5.5',
      modelIds: ['gpt-5.5', 'gpt-5.4'],
    }).defaultModel).toBe('gpt-5.6-sol')

    expect(resolveUApiRefreshSelection(discovery, {
      defaultModel: 'gpt-5.4',
      modelIds: ['gpt-5.5', 'gpt-5.4'],
    }).defaultModel).toBe('gpt-5.4')
  })
})
