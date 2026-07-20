// U-API: canonical generate_image 薄 handler，网络与文件能力由 server host 注入（16 §10.1）。
import type { GenerateImageToolInput, SessionToolContext } from '../context.ts'
import type { ToolResult } from '../types.ts'
import { errorResponse } from '../response.ts'
import { validateGenerateImageInput } from '../generate-image-contract.ts'

function stableError(category: 'input_invalid' | 'not_executable'): ToolResult {
  return errorResponse(JSON.stringify({
    kind: 'uapi_image_error',
    version: 1,
    category,
    charge_state: 'not_sent',
  }))
}

export async function handleGenerateImage(
  ctx: SessionToolContext,
  args: GenerateImageToolInput,
): Promise<ToolResult> {
  if (!validateGenerateImageInput(args).success) return stableError('input_invalid')
  if (!ctx.generateImage) return stableError('not_executable')
  return ctx.generateImage(args)
}
