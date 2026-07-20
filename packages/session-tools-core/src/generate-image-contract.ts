// U-API: generate_image 的唯一 schema 与联网前不变量校验（16 §3.1）。
import { z } from 'zod'

export const GenerateImageSchema = z.object({
  prompt: z.string().trim().min(1).max(16_000),
  aspect_ratio: z.enum(['1:1', '3:2', '2:3']).optional(),
  preset: z.enum(['standard', 'high']).optional(),
  input_images: z.array(z.object({
    ref: z.string().regex(/^img_[1-8]$/),
    role: z.enum([
      'edit_target',
      'subject_reference',
      'style_reference',
      'composition_reference',
      'insert',
    ]),
  }).strict()).min(1).max(3).optional(),
  _uapi_execution_nonce: z.string().min(16).max(512),
}).strict()

export function validateGenerateImageInput(input: unknown):
  | { success: true; data: z.infer<typeof GenerateImageSchema> }
  | { success: false; reason: string } {
  const parsed = GenerateImageSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: 'invalid_schema' }
  const images = parsed.data.input_images ?? []
  const refs = new Set(images.map(image => image.ref))
  if (refs.size !== images.length) return { success: false, reason: 'duplicate_ref' }
  if (images.filter(image => image.role === 'edit_target').length > 1) {
    return { success: false, reason: 'multiple_edit_targets' }
  }
  if (images.length > 0 && parsed.data.preset === 'high') {
    return { success: false, reason: 'edit_high_unsupported' }
  }
  return { success: true, data: parsed.data }
}
