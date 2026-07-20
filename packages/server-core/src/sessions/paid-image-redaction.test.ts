// U-API: paid tool内部字段在任何format / journal持久化前剥离（16B §2.2）。
import { describe, expect, it } from 'bun:test'
import { redactPaidImageToolInput } from './SessionManager.ts'

describe('redactPaidImageToolInput', () => {
  it('keeps only user-readable image inputs and converts private refs to a count', () => {
    expect(redactPaidImageToolInput('mcp__session__generate_image', {
      prompt: 'keep the character and change the background',
      aspect_ratio: '3:2',
      preset: 'standard',
      input_images: [{ ref: 'img_1', role: 'subject_reference' }],
      _uapi_execution_nonce: 'process.turn',
      leaseToken: 'must-not-persist',
      ownerToken: 'must-not-persist',
      host_path: '/private/session/image.png',
    })).toEqual({
      prompt: 'keep the character and change the background',
      aspect_ratio: '3:2',
      preset: 'standard',
      input_image_count: 1,
    })
  })

  it('does not alter unrelated tools', () => {
    const input = { file_path: '/workspace/readme.md' }
    expect(redactPaidImageToolInput('Read', input)).toBe(input)
  })
})
