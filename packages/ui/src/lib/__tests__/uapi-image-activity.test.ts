// U-API: UI只从strict envelope + session root重建生成图路径（16 §8.3）。
import { describe, expect, it } from 'bun:test'
import { parseUApiImageActivity, stripRenderedUApiImageAttachments } from '../tool-parsers.ts'

describe('parseUApiImageActivity', () => {
  const success = JSON.stringify({
    kind: 'uapi_generated_image',
    version: 1,
    operation: 'generate',
    contract_status: 'ok',
    input_image_count: 0,
    file_name: 'generated-image-123e4567-e89b-42d3-a456-426614174000.png',
    gateway_model_id: 'actual-catalog-id',
    mime_type: 'image/png',
    width: 1024,
    height: 1024,
  })

  it('reconstructs a generated file only for the exact tool and safe basename', () => {
    expect(parseUApiImageActivity({ toolName: 'mcp__session__generate_image', content: success }, '/srv/session-a')).toEqual({
      type: 'success',
      value: JSON.parse(success),
      filePath: '/srv/session-a/downloads/generated-image-123e4567-e89b-42d3-a456-426614174000.png',
    })
    expect(parseUApiImageActivity({ toolName: 'other_tool', content: success }, '/srv/session-a')).toBeNull()
  })

  it('rejects unknown fields and path-like filenames', () => {
    const unsafe = JSON.stringify({ ...JSON.parse(success), file_name: '../outside.png' })
    const unknown = JSON.stringify({ ...JSON.parse(success), local_path: '/secret' })
    expect(parseUApiImageActivity({ toolName: 'generate_image', content: unsafe }, '/srv/session-a')).toBeNull()
    expect(parseUApiImageActivity({ toolName: 'generate_image', content: unknown }, '/srv/session-a')).toBeNull()
  })

  it('preserves structured possibly-charged errors for fixed UI guidance', () => {
    const error = '[ERROR] {"kind":"uapi_image_error","version":1,"category":"request_uncertain","charge_state":"possibly_charged"}'
    expect(parseUApiImageActivity({ toolName: 'generate_image', content: error })).toEqual({
      type: 'error',
      value: { kind: 'uapi_image_error', version: 1, category: 'request_uncertain', charge_state: 'possibly_charged' },
    })
  })

  it('removes only duplicate attachment markdown already rendered by the strict result card', () => {
    const parsed = parseUApiImageActivity(
      { toolName: 'generate_image', content: success },
      '/srv/session-a',
    )
    expect(parsed).not.toBeNull()
    const text = [
      '图片已经生成。',
      '',
      '![result](attachment://generated-image-123e4567-e89b-42d3-a456-426614174000.png)',
      '',
      '![other](attachment://user-upload.png)',
    ].join('\n')
    expect(stripRenderedUApiImageAttachments(text, parsed ? [parsed] : [])).toBe(
      '图片已经生成。\n\n![other](attachment://user-upload.png)',
    )
    expect(stripRenderedUApiImageAttachments(
      '![result](attachment://generated-image-123e4567-e89b-42d3-a456-426614174000.png)',
      parsed ? [parsed] : [],
    )).toBe('')
  })
})
