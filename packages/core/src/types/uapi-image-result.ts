// U-API: 生图 ToolResult 的跨 host/UI 共享严格合同（16-image-generation-tool-spec.md §8）。

export const UAPI_IMAGE_WARNING_VALUES = [
  'quality_unverified',
  'quality_downgraded',
  'aspect_ratio_changed',
] as const

export const UAPI_IMAGE_ERROR_CATEGORIES = [
  'connection_unavailable',
  'service_unconfigured',
  'quota_exceeded',
  'content_rejected',
  'input_invalid',
  'request_uncertain',
  'result_invalid',
  'not_executable',
] as const

export type UApiImageWarning = (typeof UAPI_IMAGE_WARNING_VALUES)[number]
export type UApiImageErrorCategory = (typeof UAPI_IMAGE_ERROR_CATEGORIES)[number]
export type UApiImageChargeState = 'not_sent' | 'possibly_charged'

export interface UApiGeneratedImageResultV1 {
  kind: 'uapi_generated_image'
  version: 1
  operation: 'generate' | 'edit'
  contract_status: 'ok' | 'degraded'
  input_image_count: number
  file_name: string
  gateway_model_id: string
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  warning?: UApiImageWarning
}

export interface UApiImageErrorV1 {
  kind: 'uapi_image_error'
  version: 1
  category: UApiImageErrorCategory
  charge_state: UApiImageChargeState
}

export type ParsedUApiImageToolResult =
  | { type: 'success'; value: UApiGeneratedImageResultV1 }
  | { type: 'error'; value: UApiImageErrorV1 }

const SUCCESS_KEYS = new Set([
  'kind', 'version', 'operation', 'contract_status', 'input_image_count',
  'file_name', 'gateway_model_id', 'mime_type', 'width', 'height',
])
const DEGRADED_KEYS = new Set([...SUCCESS_KEYS, 'warning'])
const ERROR_KEYS = new Set(['kind', 'version', 'category', 'charge_state'])
const WARNING_SET = new Set<string>(UAPI_IMAGE_WARNING_VALUES)
const ERROR_CATEGORY_SET = new Set<string>(UAPI_IMAGE_ERROR_CATEGORIES)
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/
const GENERATED_BASENAME_RE = /^generated-image-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: Set<string>): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every(key => expected.has(key))
}

function parseJsonToolText(text: string): unknown {
  const raw = text.startsWith('[ERROR] ') ? text.slice('[ERROR] '.length) : text
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isSafeModelId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 256
    && !CONTROL_CHAR_RE.test(value)
}

function isSafeDimensions(width: unknown, height: unknown): width is number {
  return Number.isInteger(width)
    && Number.isInteger(height)
    && (width as number) >= 512
    && (width as number) <= 3840
    && (height as number) >= 512
    && (height as number) <= 3840
    && (width as number) * (height as number) <= 8_294_400
}

function mimeMatchesFilename(mimeType: unknown, fileName: unknown): boolean {
  if (typeof mimeType !== 'string' || typeof fileName !== 'string') return false
  if (mimeType === 'image/png') return fileName.toLowerCase().endsWith('.png')
  if (mimeType === 'image/jpeg') return fileName.toLowerCase().endsWith('.jpg')
  if (mimeType === 'image/webp') return fileName.toLowerCase().endsWith('.webp')
  return false
}

/** Parse persisted tool text without trusting unknown keys, paths, or dimensions. */
export function parseUApiImageToolResult(text: string): ParsedUApiImageToolResult | null {
  const parsed = parseJsonToolText(text)
  if (!isRecord(parsed) || parsed.version !== 1) return null

  if (parsed.kind === 'uapi_image_error') {
    if (!hasExactKeys(parsed, ERROR_KEYS)) return null
    if (!ERROR_CATEGORY_SET.has(String(parsed.category))) return null
    if (parsed.charge_state !== 'not_sent' && parsed.charge_state !== 'possibly_charged') return null
    return { type: 'error', value: parsed as unknown as UApiImageErrorV1 }
  }

  if (parsed.kind !== 'uapi_generated_image') return null
  const expectedKeys = parsed.contract_status === 'degraded' ? DEGRADED_KEYS : SUCCESS_KEYS
  if (!hasExactKeys(parsed, expectedKeys)) return null
  if (parsed.operation !== 'generate' && parsed.operation !== 'edit') return null
  if (parsed.contract_status !== 'ok' && parsed.contract_status !== 'degraded') return null
  if (!Number.isInteger(parsed.input_image_count)) return null
  if (parsed.operation === 'generate' && parsed.input_image_count !== 0) return null
  if (parsed.operation === 'edit' && ((parsed.input_image_count as number) < 1 || (parsed.input_image_count as number) > 3)) return null
  if (typeof parsed.file_name !== 'string' || !GENERATED_BASENAME_RE.test(parsed.file_name)) return null
  if (!mimeMatchesFilename(parsed.mime_type, parsed.file_name)) return null
  if (!isSafeModelId(parsed.gateway_model_id)) return null
  if (!isSafeDimensions(parsed.width, parsed.height)) return null
  if (parsed.contract_status === 'degraded' && !WARNING_SET.has(String(parsed.warning))) return null

  return { type: 'success', value: parsed as unknown as UApiGeneratedImageResultV1 }
}
