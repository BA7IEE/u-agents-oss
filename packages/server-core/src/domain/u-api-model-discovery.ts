import {
  U_API_BASE_URL,
  type CustomEndpointApi,
} from '@u-agents/shared/config'

const DEFAULT_DISCOVERY_TIMEOUT_MS = 10_000

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const NON_CHAT_MODEL_TOKENS = new Set([
  'audio',
  'embedding',
  'embeddings',
  'image',
  'imagen',
  'moderation',
  'rerank',
  'speech',
  'tts',
  'whisper',
])

interface RawUApiModel {
  id?: unknown
  supported_endpoint_types?: unknown
  recommended?: unknown
  recommended_priority?: unknown
}

interface RawUApiModelsResponse {
  data?: unknown
  default_model?: unknown
  fallback_models?: unknown
  utility_model?: unknown
}

export interface UApiModelCandidate {
  id: string
  protocols: CustomEndpointApi[]
  recommended: boolean
  recommendedPriority?: number
  sourceIndex: number
}

export interface UApiModelDiscovery {
  candidates: UApiModelCandidate[]
  explicitDefault?: string
  utilityModel?: string
}

export interface UApiResolvedModelSelection {
  defaultModel: string
  models: string[]
  customEndpoint: {
    api: CustomEndpointApi
    supportsImages: boolean
  }
  piAuthProvider: 'openai' | 'anthropic'
}

interface UApiModelProbeResult {
  success: boolean
  error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeModelId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 256) return undefined
  return trimmed
}

function isChatModelId(modelId: string): boolean {
  const tokens = modelId.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return !tokens.some(token => NON_CHAT_MODEL_TOKENS.has(token))
}

function resolveProtocols(value: unknown): CustomEndpointApi[] {
  if (!Array.isArray(value)) return []

  const normalized = new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim().toLowerCase()),
  )

  const protocols: CustomEndpointApi[] = []
  if (normalized.has('openai') || normalized.has('openai-completions')) {
    protocols.push('openai-completions')
  }
  if (normalized.has('anthropic') || normalized.has('anthropic-messages')) {
    protocols.push('anthropic-messages')
  }
  return protocols
}

function versionParts(modelId: string): number[] {
  return modelId.match(/\d+/g)?.map(part => Number.parseInt(part, 10)) ?? []
}

function compareVersionPartsDescending(a: string, b: string): number {
  const aParts = versionParts(a)
  const bParts = versionParts(b)
  const length = Math.max(aParts.length, bParts.length)

  for (let index = 0; index < length; index += 1) {
    const delta = (bParts[index] ?? -1) - (aParts[index] ?? -1)
    if (delta !== 0) return delta
  }

  return 0
}

function normalizeRecommendationList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeModelId).filter((id): id is string => !!id)
}

/**
 * Convert the token-scoped U-API catalog into an ordered chat-model list.
 * Server-provided recommendation fields win. When the current gateway does not
 * provide them yet, numeric model versions are ordered newest-first without
 * pinning the desktop app to a concrete model id.
 */
// U-API: token-scoped automatic model discovery, capability filtering and version-aware recommendation fallback
export function parseUApiModelsResponse(payload: unknown): UApiModelDiscovery {
  if (!isRecord(payload)) {
    throw new Error('U-API returned an invalid model list')
  }

  const response = payload as RawUApiModelsResponse
  if (!Array.isArray(response.data)) {
    throw new Error('U-API returned an invalid model list')
  }

  const seen = new Set<string>()
  const discovered: UApiModelCandidate[] = []

  response.data.forEach((entry, sourceIndex) => {
    if (!isRecord(entry)) return
    const raw = entry as RawUApiModel
    const id = normalizeModelId(raw.id)
    if (!id || seen.has(id) || !isChatModelId(id)) return

    const protocols = resolveProtocols(raw.supported_endpoint_types)
    if (protocols.length === 0) return

    seen.add(id)
    discovered.push({
      id,
      protocols,
      recommended: raw.recommended === true,
      recommendedPriority: typeof raw.recommended_priority === 'number' && Number.isFinite(raw.recommended_priority)
        ? raw.recommended_priority
        : undefined,
      sourceIndex,
    })
  })

  if (discovered.length === 0) {
    throw new Error('No compatible chat models are available for this API key')
  }

  const byId = new Map(discovered.map(candidate => [candidate.id, candidate]))
  const explicitDefault = normalizeModelId(response.default_model)
  const fallbackModels = normalizeRecommendationList(response.fallback_models)
  const explicitOrder = [explicitDefault, ...fallbackModels]
    .filter((id): id is string => !!id && byId.has(id))

  const remainder = [...discovered].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1

    const aPriority = a.recommendedPriority ?? Number.POSITIVE_INFINITY
    const bPriority = b.recommendedPriority ?? Number.POSITIVE_INFINITY
    if (aPriority !== bPriority) return aPriority - bPriority

    const versionOrder = compareVersionPartsDescending(a.id, b.id)
    if (versionOrder !== 0) return versionOrder
    return a.sourceIndex - b.sourceIndex
  })

  const orderedIds = [...new Set([...explicitOrder, ...remainder.map(candidate => candidate.id)])]
  const candidates = orderedIds.map(id => byId.get(id)!).filter(Boolean)
  const utilityModel = normalizeModelId(response.utility_model)

  return {
    candidates,
    explicitDefault: explicitDefault && byId.has(explicitDefault) ? explicitDefault : undefined,
    utilityModel: utilityModel && byId.has(utilityModel) ? utilityModel : undefined,
  }
}

export function resolveUApiModelSelection(
  discovery: UApiModelDiscovery,
  selected: UApiModelCandidate,
  selectedProtocol?: CustomEndpointApi,
): UApiResolvedModelSelection {
  const protocol = selectedProtocol ?? selected.protocols[0]
  if (!protocol || !selected.protocols.includes(protocol)) {
    throw new Error(`No supported protocol is available for model ${selected.id}`)
  }

  const compatibleIds = discovery.candidates
    .filter(candidate => candidate.protocols.includes(protocol))
    .map(candidate => candidate.id)

  const models = [selected.id, ...compatibleIds.filter(id => id !== selected.id)]
  const utilityModel = discovery.utilityModel
  if (utilityModel && utilityModel !== selected.id && models.includes(utilityModel)) {
    const utilityIndex = models.indexOf(utilityModel)
    models.splice(utilityIndex, 1)
    models.push(utilityModel)
  }

  return {
    defaultModel: selected.id,
    models,
    customEndpoint: {
      api: protocol,
      supportsImages: true,
    },
    piAuthProvider: protocol === 'anthropic-messages' ? 'anthropic' : 'openai',
  }
}

/**
 * Follow a newly recommended model only while the connection still uses its
 * previous first-ranked model. Preserve an advanced user override while it
 * remains in the token-scoped catalog.
 */
export function resolveUApiRefreshSelection(
  discovery: UApiModelDiscovery,
  current: {
    defaultModel?: string
    modelIds: string[]
    customEndpointApi?: CustomEndpointApi
  },
): UApiResolvedModelSelection {
  const recommended = discovery.candidates[0]
  if (!recommended) {
    throw new Error('No compatible chat models are available for this API key')
  }

  const currentCandidate = current.defaultModel
    ? discovery.candidates.find(candidate => candidate.id === current.defaultModel)
    : undefined
  const followsAutomaticRecommendation = !!current.defaultModel
    && current.modelIds[0] === current.defaultModel
  const selected = currentCandidate && !followsAutomaticRecommendation
    ? currentCandidate
    : recommended
  const protocol = current.customEndpointApi && selected.protocols.includes(current.customEndpointApi)
    ? current.customEndpointApi
    : undefined

  return resolveUApiModelSelection(discovery, selected, protocol)
}

export function shouldTryNextUApiModel(error: string): boolean {
  const normalized = error.toLowerCase()

  if (/\b(401|403|429)\b/.test(normalized)) return false
  if (/(unauthorized|authentication|invalid api key|permission|insufficient balance|quota|rate limit)/.test(normalized)) return false
  if (/(timeout|timed out|econnrefused|enotfound|fetch failed|network)/.test(normalized)) return false

  return /(\b(400|404|409|422|500|502|503|504|520|521|522|523|524)\b|model|unsupported|unavailable|no available channel)/.test(normalized)
}

export async function selectWorkingUApiModel(
  discovery: UApiModelDiscovery,
  probe: (
    candidate: UApiModelCandidate,
    selection: UApiResolvedModelSelection,
  ) => Promise<UApiModelProbeResult>,
): Promise<UApiResolvedModelSelection> {
  let lastError = 'No available U-API model passed connection validation'

  for (const candidate of discovery.candidates) {
    for (const protocol of candidate.protocols) {
      const selection = resolveUApiModelSelection(discovery, candidate, protocol)
      const result = await probe(candidate, selection)
      if (result.success) return selection

      lastError = result.error || lastError
      if (!shouldTryNextUApiModel(lastError)) {
        throw new Error(lastError)
      }
    }
  }

  throw new Error(lastError)
}

export async function discoverUApiModels(
  apiKey: string,
  options: {
    fetchImpl?: FetchLike
    timeoutMs?: number
  } = {},
): Promise<UApiModelDiscovery> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) throw new Error('API key is required')

  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS)

  try {
    const response = await fetchImpl(`${U_API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      redirect: 'error',
      signal: controller.signal,
    })

    if (response.status === 401) throw new Error('Invalid API key')
    if (response.status === 403) throw new Error('API key does not have permission to access this resource')
    if (!response.ok) throw new Error(`U-API model discovery failed with status ${response.status}`)

    return parseUApiModelsResponse(await response.json())
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Network timeout while contacting U-API')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
