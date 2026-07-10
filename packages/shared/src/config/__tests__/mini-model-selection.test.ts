import { describe, expect, it } from 'bun:test'
import { getMiniModel, getSummarizationModel, type LlmConnection } from '../llm-connections'

describe('compat model utility selection', () => {
  // U-API: regression coverage for MiniMax brand names and exact utility-model tokens
  it('does not treat the MiniMax brand as a mini model', () => {
    const connection = {
      providerType: 'pi_compat',
      models: ['gpt-5.6-sol', 'MiniMax-M2.7', 'claude-sonnet-5'],
    } as LlmConnection

    expect(getMiniModel(connection)).toBe('claude-sonnet-5')
    expect(getSummarizationModel(connection)).toBe('claude-sonnet-5')
  })

  it('still recognizes mini as a distinct model-id token', () => {
    const connection = {
      providerType: 'pi_compat',
      models: ['gpt-5.6-sol', 'gpt-5.6-mini', 'claude-sonnet-5'],
    } as LlmConnection

    expect(getMiniModel(connection)).toBe('gpt-5.6-mini')
  })
})
