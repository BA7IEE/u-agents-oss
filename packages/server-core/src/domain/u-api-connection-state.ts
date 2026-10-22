import type { CustomEndpointConfig, LlmConnection } from '@u-agents/shared/config'

// U-API: invalidate asynchronous discovery when setup starts; never retain token text here.
const revisions = new Map<string, number>()
const writes = new Map<string, Promise<unknown>>()
export const uApiConnectionRevision = (slug: string): number => revisions.get(slug) ?? 0
export function invalidateUApiConnection(slug: string): void {
  revisions.set(slug, uApiConnectionRevision(slug) + 1)
}

/** Serialize config/credential writes together, including asynchronous vault operations. */
export function withUApiConnectionWrite<T>(slug: string, write: () => Promise<T>): Promise<T> {
  invalidateUApiConnection(slug)
  const previous = writes.get(slug) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => {
    invalidateUApiConnection(slug)
    return write()
  })
  writes.set(slug, next)
  return next.finally(() => { if (writes.get(slug) === next) writes.delete(slug) })
}

export function validUApiMaxTokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** Only server-stored metadata supplies the cap; ignore any cap echoed by the renderer. */
export function preserveUApiEndpointLimit<T extends CustomEndpointConfig>(
  stored: LlmConnection | null | undefined,
  endpoint: T,
  storedKey: string | null | undefined,
  submittedKey: string | null | undefined,
): Omit<T, 'maxTokens'> & { maxTokens?: number } {
  const { maxTokens: _ignored, ...routing } = endpoint
  return {
    ...routing,
    ...(stored && storedKey && submittedKey && storedKey.trim() === submittedKey.trim()
      && stored.customEndpoint?.api === endpoint.api && validUApiMaxTokens(stored.customEndpoint.maxTokens)
      ? { maxTokens: stored.customEndpoint.maxTokens } : {}),
  }
}
