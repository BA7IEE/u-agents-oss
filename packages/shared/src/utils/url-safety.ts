/**
 * Classification of external URLs for `shell.openExternal`-style handlers.
 *
 * We use a blocklist instead of an allowlist: the OS only dispatches URL
 * schemes that have a registered handler, so passing through
 * `obsidian://`, `vscode://`, etc. is safe in practice. Known-dangerous
 * schemes (XSS primitives and `file:` as an RCE vector on Windows) stay
 * explicitly blocked.
 */

export type UrlClassification =
  | { kind: 'dangerous'; reason: string }
  | { kind: 'internal-deeplink' }
  | { kind: 'safe-external' }

const DANGEROUS_SCHEMES: ReadonlySet<string> = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'blob:',
  'file:',
])

const INTERNAL_DEEPLINK_SCHEME = 'uagents:'

export function classifyExternalUrl(rawUrl: string): UrlClassification {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { kind: 'dangerous', reason: 'empty URL' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { kind: 'dangerous', reason: 'malformed URL' }
  }

  const protocol = parsed.protocol.toLowerCase()

  if (DANGEROUS_SCHEMES.has(protocol)) {
    return { kind: 'dangerous', reason: `blocked scheme "${protocol}"` }
  }

  if (protocol === INTERNAL_DEEPLINK_SCHEME) {
    return { kind: 'internal-deeplink' }
  }

  return { kind: 'safe-external' }
}

export function isSafeExternalUrl(rawUrl: string): boolean {
  return classifyExternalUrl(rawUrl).kind === 'safe-external'
}

/* U-API START: M3 SSRF 防护 — assertPublicHttpsUrl helper（详见 .planning/M3-REFRESH-API-SSRF-SPEC.md）
 * Blocks credential-bearing fetch() to private/loopback/cloud-metadata targets.
 * Does NOT defend against DNS rebinding — that requires runtime resolution. */
const PRIVATE_HOST_RANGES: ReadonlyArray<RegExp> = [
  /^127\./,                              // loopback 127.0.0.0/8
  /^10\./,                               // private 10.0.0.0/8
  /^192\.168\./,                         // private 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[01])\./,          // private 172.16.0.0/12
  /^169\.254\./,                         // link-local + cloud metadata 169.254.169.254
  /^0\./,                                // 0.0.0.0/8
  /^::1$/,                               // IPv6 loopback
  /^\[::1\]$/,                           // IPv6 loopback bracketed
  /^fc[0-9a-f]{2}:/i,                    // IPv6 ULA fc00::/7
  /^\[fc[0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,                 // IPv6 link-local fe80::/10
  /^\[fe[89ab][0-9a-f]:/i,
]

const PRIVATE_HOST_NAMES: ReadonlySet<string> = new Set([
  'localhost',
  'metadata.google.internal',           // GCP metadata
  'metadata.azure.com',                 // Azure metadata
])

export type AssertHttpsUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string }

export function assertPublicHttpsUrl(rawUrl: string): AssertHttpsUrlResult {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { ok: false, reason: 'empty URL' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { ok: false, reason: 'malformed URL' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `protocol "${parsed.protocol}" not allowed (https only)` }
  }

  // URL.hostname strips brackets for IPv6, but keep both checks for safety
  const host = parsed.hostname.toLowerCase()

  if (PRIVATE_HOST_NAMES.has(host)) {
    return { ok: false, reason: `host "${host}" is a known private/metadata target` }
  }

  for (const pattern of PRIVATE_HOST_RANGES) {
    if (pattern.test(host)) {
      return { ok: false, reason: `host "${host}" matches private/loopback range` }
    }
  }

  return { ok: true, url: parsed }
}
/* U-API END */
