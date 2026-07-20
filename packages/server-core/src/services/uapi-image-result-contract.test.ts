// U-API: 生图 ToolResult 共享 parser 防漂移回归（16-image-generation-tool-spec.md §11）。
import { describe, expect, it } from 'bun:test'
import { parseUApiImageToolResult } from '@u-agents/core'

const success = {
  kind: 'uapi_generated_image',
  version: 1,
  operation: 'edit',
  contract_status: 'ok',
  input_image_count: 2,
  file_name: 'generated-image-550e8400-e29b-41d4-a716-446655440000.png',
  gateway_model_id: 'gpt-image-2',
  mime_type: 'image/png',
  width: 1024,
  height: 1024,
}

describe('parseUApiImageToolResult', () => {
  it('accepts exact success and error envelopes', () => {
    expect(parseUApiImageToolResult(JSON.stringify(success))?.type).toBe('success')
    expect(parseUApiImageToolResult('[ERROR] {"kind":"uapi_image_error","version":1,"category":"service_unconfigured","charge_state":"not_sent"}')?.type).toBe('error')
  })

  it('accepts an allowlisted degraded warning', () => {
    expect(parseUApiImageToolResult(JSON.stringify({
      ...success,
      contract_status: 'degraded',
      warning: 'quality_downgraded',
    }))?.type).toBe('success')
  })

  it('rejects unknown keys, paths, mime mismatches, and dangerous dimensions', () => {
    expect(parseUApiImageToolResult(JSON.stringify({ ...success, extra: true }))).toBeNull()
    expect(parseUApiImageToolResult(JSON.stringify({ ...success, file_name: '../escape.png' }))).toBeNull()
    expect(parseUApiImageToolResult(JSON.stringify({ ...success, mime_type: 'image/jpeg' }))).toBeNull()
    expect(parseUApiImageToolResult(JSON.stringify({ ...success, width: 3840, height: 3840 }))).toBeNull()
  })

  it('rejects inconsistent operation counts and malformed error envelopes', () => {
    expect(parseUApiImageToolResult(JSON.stringify({ ...success, operation: 'generate', input_image_count: 1 }))).toBeNull()
    expect(parseUApiImageToolResult('[ERROR] {"kind":"uapi_image_error","version":1,"category":"unknown","charge_state":"not_sent"}')).toBeNull()
  })
})
