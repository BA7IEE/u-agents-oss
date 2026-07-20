// U-API: NewAPI Images host service；固定出口、单次claim、真实图片校验与安全落盘（16 §5-§7）。
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import type { ImageProcessor } from '../runtime/platform'
import { inspectImageBuffer } from './image-utils'

export type UApiImageAspectRatio = '1:1' | '3:2' | '2:3'
export type UApiImageRole = 'edit_target' | 'subject_reference' | 'style_reference' | 'composition_reference' | 'insert'

export interface UApiImageManifestItem {
  ref: string
  path: string
  displayName: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
}

export interface UApiImageManifestCandidate {
  path: string
  displayName: string
}

export interface UApiImageExecutionInput {
  prompt: string
  aspectRatio?: UApiImageAspectRatio
  preset?: 'standard' | 'high'
  inputImages?: Array<{ ref: string; role: UApiImageRole }>
}

export interface UApiImageServiceDeps {
  sessionPath: string
  connectionSlug: string
  connectionBaseUrl: string
  getToken: () => Promise<string | null>
  manifest: ReadonlyMap<string, UApiImageManifestItem>
  imageProcessor: ImageProcessor
  controller: AbortController
  /** Synchronously changes host state from preflight to claimed. */
  claim: () => boolean
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}

export interface UApiImageServiceResult {
  text: string
  isError: boolean
  claimed: boolean
}

const U_API_BASE_URL = 'https://token.u-studio.cn/v1'
const CATALOG_LIMIT = 2 * 1024 * 1024
const RESPONSE_LIMIT = 48 * 1024 * 1024
const DECODED_LIMIT = 32 * 1024 * 1024
const INPUT_FILE_LIMIT = 10 * 1024 * 1024
const INPUT_TOTAL_LIMIT = 30 * 1024 * 1024
const MAX_PIXELS = 8_294_400
const TARGETS: Record<UApiImageAspectRatio, { size: string; ratio: number; suffix: string }> = {
  '1:1': { size: '1024x1024', ratio: 1, suffix: 'use a square 1:1 canvas' },
  '3:2': { size: '1536x1024', ratio: 1.5, suffix: 'use a landscape 3:2 canvas' },
  '2:3': { size: '1024x1536', ratio: 2 / 3, suffix: 'use a portrait 2:3 canvas' },
}

async function fetchWithTimeout(
  fetchFn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  controller: AbortController,
): Promise<Response> {
  const timer = setTimeout(() => controller.abort(new Error('uapi_image_timeout')), timeoutMs)
  try {
    return await fetchFn(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function imageError(category: string, chargeState: 'not_sent' | 'possibly_charged'): string {
  return `[ERROR] ${JSON.stringify({ kind: 'uapi_image_error', version: 1, category, charge_state: chargeState })}`
}

function failed(category: string, claimed: boolean): UApiImageServiceResult {
  return { text: imageError(category, claimed ? 'possibly_charged' : 'not_sent'), isError: true, claimed }
}

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function isUApiSlug(slug: string): boolean {
  return slug === 'u-api-default' || /^u-api(?:-\d+)?$/.test(slug)
}

function detectImage(buffer: Buffer): { mimeType: UApiImageManifestItem['mimeType']; ext: 'png' | 'jpg' | 'webp' } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: 'image/png', ext: 'png' }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' }
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp', ext: 'webp' }
  }
  return null
}

async function readBounded(response: Response, limit: number): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new Error('response_too_large')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))))
}

function selectModel(catalog: unknown): string | null {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return null
  const record = catalog as Record<string, unknown>
  if (record.success === false || !Array.isArray(record.data)) return null
  const seen = new Set<string>()
  const eligible: string[] = []
  for (const raw of record.data) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const entry = raw as Record<string, unknown>
    if (typeof entry.id !== 'string' || entry.id.length < 1 || entry.id.length > 256 || /[\u0000-\u001f\u007f]/.test(entry.id)) return null
    if (seen.has(entry.id)) return null
    seen.add(entry.id)
    if (!Array.isArray(entry.supported_endpoint_types) || !entry.supported_endpoint_types.every(value => typeof value === 'string')) continue
    const endpoints = new Set(entry.supported_endpoint_types as string[])
    if (endpoints.has('image-generation') && endpoints.has('uapi-image-edit-v1') && endpoints.has('uapi-image-default-v1')) {
      eligible.push(entry.id)
    }
  }
  return eligible.length === 1 ? eligible[0] : null
}

function inferAspect(input: UApiImageExecutionInput, manifest: ReadonlyMap<string, UApiImageManifestItem>): UApiImageAspectRatio | null {
  if (input.aspectRatio) return input.aspectRatio
  const editTarget = input.inputImages?.find(image => image.role === 'edit_target')
  if (!editTarget) return '1:1'
  const item = manifest.get(editTarget.ref)
  if (!item) return null
  const actual = item.width / item.height
  for (const [name, target] of Object.entries(TARGETS) as Array<[UApiImageAspectRatio, (typeof TARGETS)[UApiImageAspectRatio]]>) {
    if (Math.abs(actual - target.ratio) / target.ratio <= 0.01) return name
  }
  return null
}

function buildPrompt(input: UApiImageExecutionInput, aspect: UApiImageAspectRatio): string {
  const roleLines = (input.inputImages ?? []).map((image, index) => {
    const role = image.role.replaceAll('_', ' ')
    return `Image ${index + 1}: ${role}. Preserve all user-requested invariants.`
  })
  return [input.prompt, ...roleLines, `Canvas constraint: ${TARGETS[aspect].suffix}.`].join('\n\n')
}

async function readVerifiedInput(
  item: UApiImageManifestItem,
  sessionPath: string,
  processor: ImageProcessor,
): Promise<{ buffer: Buffer; mimeType: UApiImageManifestItem['mimeType']; ext: 'png' | 'jpg' | 'webp' } | null> {
  const sessionReal = await realpath(sessionPath)
  const stat = await lstat(item.path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > INPUT_FILE_LIMIT) return null
  const itemReal = await realpath(item.path)
  const rel = relative(sessionReal, itemReal)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || rel.startsWith(sep)) return null
  const handle = await open(itemReal, 'r')
  try {
    const buffer = await handle.readFile()
    if (buffer.length > INPUT_FILE_LIMIT) return null
    const detected = detectImage(buffer)
    if (!detected || detected.mimeType !== item.mimeType) return null
    const inspection = await inspectImageBuffer(buffer, processor)
    if (inspection.status !== 'ok') return null
    if (inspection.width !== item.width || inspection.height !== item.height) return null
    return { buffer, ...detected }
  } finally {
    await handle.close()
  }
}

/**
 * Freeze the image files that a single interactive turn may reference. The
 * model only receives img_N handles; paths and attachment identifiers stay in
 * the host process. Invalid, duplicate, oversized, or out-of-session files are
 * omitted instead of weakening the execution-time checks.
 */
export async function buildUApiImageManifest(
  sessionPath: string,
  candidates: readonly UApiImageManifestCandidate[],
  processor: ImageProcessor,
): Promise<Map<string, UApiImageManifestItem>> {
  const manifest = new Map<string, UApiImageManifestItem>()
  const seen = new Set<string>()
  const sessionReal = await realpath(sessionPath)

  for (const candidate of candidates) {
    if (manifest.size >= 8) break
    try {
      const stat = await lstat(candidate.path)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > INPUT_FILE_LIMIT) continue
      const itemReal = await realpath(candidate.path)
      const rel = relative(sessionReal, itemReal)
      if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith(sep) || seen.has(itemReal)) continue

      const handle = await open(itemReal, 'r')
      let buffer: Buffer
      try {
        buffer = await handle.readFile()
      } finally {
        await handle.close()
      }
      if (buffer.length <= 0 || buffer.length > INPUT_FILE_LIMIT) continue
      const detected = detectImage(buffer)
      if (!detected) continue
      const inspection = await inspectImageBuffer(buffer, processor)
      if (inspection.status !== 'ok') continue

      seen.add(itemReal)
      const ref = `img_${manifest.size + 1}`
      const cleanName = candidate.displayName
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, 120) || `Image ${manifest.size + 1}`
      manifest.set(ref, {
        ref,
        path: itemReal,
        displayName: cleanName,
        mimeType: detected.mimeType,
        width: inspection.width,
        height: inspection.height,
      })
    } catch {
      // A manifest is best-effort context. Execution revalidates every selected
      // entry and fails closed if the file changes after this snapshot.
    }
  }

  return manifest
}

function classifyHttp(status: number): 'quota_exceeded' | 'content_rejected' | 'connection_unavailable' | 'request_uncertain' {
  if (status === 429) return 'quota_exceeded'
  if (status === 400 || status === 403 || status === 422) return 'content_rejected'
  if (status === 401) return 'connection_unavailable'
  return 'request_uncertain'
}

async function safeSave(sessionPath: string, buffer: Buffer, ext: 'png' | 'jpg' | 'webp'): Promise<string | null> {
  const sessionReal = await realpath(sessionPath)
  const downloads = join(sessionReal, 'downloads')
  await mkdir(downloads, { recursive: true })
  const downloadsStat = await lstat(downloads)
  if (!downloadsStat.isDirectory() || downloadsStat.isSymbolicLink()) return null
  const downloadsReal = await realpath(downloads)
  if (relative(sessionReal, downloadsReal).startsWith('..')) return null
  const fileName = `generated-image-${randomUUID()}.${ext}`
  const target = join(downloadsReal, fileName)
  await writeFile(target, buffer, { flag: 'wx' })
  return basename(target)
}

export async function executeUApiImageGeneration(
  input: UApiImageExecutionInput,
  deps: UApiImageServiceDeps,
): Promise<UApiImageServiceResult> {
  let claimed = false
  try {
    if (!isUApiSlug(deps.connectionSlug) || normalizedBaseUrl(deps.connectionBaseUrl) !== U_API_BASE_URL) {
      return failed('connection_unavailable', false)
    }
    const refs = input.inputImages ?? []
    const verified: Array<{ buffer: Buffer; mimeType: UApiImageManifestItem['mimeType']; ext: 'png' | 'jpg' | 'webp' }> = []
    let inputBytes = 0
    for (const selected of refs) {
      const item = deps.manifest.get(selected.ref)
      if (!item) return failed('input_invalid', false)
      const loaded = await readVerifiedInput(item, deps.sessionPath, deps.imageProcessor)
      if (!loaded) return failed('input_invalid', false)
      inputBytes += loaded.buffer.length
      if (inputBytes > INPUT_TOTAL_LIMIT) return failed('input_invalid', false)
      verified.push(loaded)
    }
    const aspect = inferAspect(input, deps.manifest)
    if (!aspect) return failed('input_invalid', false)
    const token = await deps.getToken()
    if (!token) return failed('connection_unavailable', false)
    const fetchFn = deps.fetchFn ?? fetch
    const catalogResponse = await fetchWithTimeout(fetchFn, `${U_API_BASE_URL}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
    }, 10_000, deps.controller)
    if (!catalogResponse.ok) return failed('connection_unavailable', false)
    const catalogText = await readBounded(catalogResponse, CATALOG_LIMIT)
    let catalog: unknown
    try { catalog = JSON.parse(catalogText) } catch { return failed('service_unconfigured', false) }
    const model = selectModel(catalog)
    if (!model) return failed('service_unconfigured', false)
    if (deps.controller.signal.aborted || !deps.claim()) return failed('not_executable', false)
    claimed = true

    const prompt = buildPrompt(input, aspect)
    let response: Response
    if (verified.length === 0) {
      response = await fetchWithTimeout(fetchFn, `${U_API_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        redirect: 'error',
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: TARGETS[aspect].size,
          quality: input.preset === 'high' ? 'high' : 'medium',
          response_format: 'b64_json',
        }),
      }, 180_000, deps.controller)
    } else {
      const form = new FormData()
      form.set('model', model)
      verified.forEach((image, index) => {
        const bytes = new ArrayBuffer(image.buffer.byteLength)
        new Uint8Array(bytes).set(image.buffer)
        form.append('image[]', new Blob([bytes], { type: image.mimeType }), `image-${index + 1}.${image.ext}`)
      })
      form.set('prompt', prompt)
      form.set('n', '1')
      form.set('size', TARGETS[aspect].size)
      form.set('quality', 'medium')
      form.set('response_format', 'b64_json')
      response = await fetchWithTimeout(fetchFn, `${U_API_BASE_URL}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        body: form,
      }, 180_000, deps.controller)
    }
    if (!response.ok) return failed(classifyHttp(response.status), true)
    const responseText = await readBounded(response, RESPONSE_LIMIT)
    let payload: unknown
    try { payload = JSON.parse(responseText) } catch { return failed('result_invalid', true) }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failed('result_invalid', true)
    const body = payload as Record<string, unknown>
    if (!Array.isArray(body.data) || body.data.length !== 1 || !body.data[0] || typeof body.data[0] !== 'object') return failed('result_invalid', true)
    const imageEntry = body.data[0] as Record<string, unknown>
    if (typeof imageEntry.b64_json !== 'string' || imageEntry.b64_json.startsWith('data:')) return failed('result_invalid', true)
    const output = Buffer.from(imageEntry.b64_json, 'base64')
    if (output.length === 0 || output.length > DECODED_LIMIT) return failed('result_invalid', true)
    const detected = detectImage(output)
    if (!detected) return failed('result_invalid', true)
    const inspection = await inspectImageBuffer(output, deps.imageProcessor)
    if (inspection.status !== 'ok') return failed('result_invalid', true)
    if (inspection.width < 512 || inspection.width > 3840 || inspection.height < 512 || inspection.height > 3840 || inspection.width * inspection.height > MAX_PIXELS) {
      return failed('result_invalid', true)
    }
    const requestedQuality = verified.length === 0 && input.preset === 'high' ? 'high' : 'medium'
    const responseQuality = typeof imageEntry.quality === 'string' ? imageEntry.quality : (typeof body.quality === 'string' ? body.quality : null)
    const actualRatio = inspection.width / inspection.height
    const ratioChanged = Math.abs(actualRatio - TARGETS[aspect].ratio) / TARGETS[aspect].ratio > 0.01
    let warning: 'quality_unverified' | 'quality_downgraded' | 'aspect_ratio_changed' | undefined
    if (!responseQuality) warning = 'quality_unverified'
    else if (responseQuality !== requestedQuality) warning = 'quality_downgraded'
    else if (ratioChanged) warning = 'aspect_ratio_changed'
    const fileName = await safeSave(deps.sessionPath, output, detected.ext)
    if (!fileName) return failed('result_invalid', true)
    const result = {
      kind: 'uapi_generated_image',
      version: 1,
      operation: verified.length === 0 ? 'generate' : 'edit',
      contract_status: warning ? 'degraded' : 'ok',
      input_image_count: verified.length,
      file_name: fileName,
      gateway_model_id: model,
      mime_type: detected.mimeType,
      width: inspection.width,
      height: inspection.height,
      ...(warning ? { warning } : {}),
    }
    return { text: JSON.stringify(result), isError: false, claimed: true }
  } catch {
    return failed(claimed ? 'request_uncertain' : 'connection_unavailable', claimed)
  }
}

export const U_API_IMAGE_INTERNALS_FOR_TESTS = { detectImage, selectModel }
