// U-API: generate_image schema、角色与付费前不变量回归（16 §11.1）。
import { describe, expect, it } from 'bun:test'
import { validateGenerateImageInput } from './generate-image-contract.ts'

const nonce = 'process-nonce.turn-nonce'

describe('validateGenerateImageInput', () => {
  it('accepts generation and 1-3 image edit inputs', () => {
    expect(validateGenerateImageInput({ prompt: 'draw a cat', _uapi_execution_nonce: nonce }).success).toBe(true)
    expect(validateGenerateImageInput({
      prompt: 'put product on desk',
      input_images: [
        { ref: 'img_1', role: 'edit_target' },
        { ref: 'img_2', role: 'insert' },
      ],
      _uapi_execution_nonce: nonce,
    }).success).toBe(true)
  })

  it('rejects duplicate refs and multiple edit targets', () => {
    expect(validateGenerateImageInput({
      prompt: 'edit',
      input_images: [
        { ref: 'img_1', role: 'edit_target' },
        { ref: 'img_1', role: 'insert' },
      ],
      _uapi_execution_nonce: nonce,
    })).toEqual({ success: false, reason: 'duplicate_ref' })
    expect(validateGenerateImageInput({
      prompt: 'edit',
      input_images: [
        { ref: 'img_1', role: 'edit_target' },
        { ref: 'img_2', role: 'edit_target' },
      ],
      _uapi_execution_nonce: nonce,
    })).toEqual({ success: false, reason: 'multiple_edit_targets' })
  })

  it('rejects high-quality edits and unknown keys before host execution', () => {
    expect(validateGenerateImageInput({
      prompt: 'edit', preset: 'high',
      input_images: [{ ref: 'img_1', role: 'edit_target' }],
      _uapi_execution_nonce: nonce,
    })).toEqual({ success: false, reason: 'edit_high_unsupported' })
    expect(validateGenerateImageInput({ prompt: 'draw', model: 'gpt-image-2', _uapi_execution_nonce: nonce }).success).toBe(false)
  })
})
