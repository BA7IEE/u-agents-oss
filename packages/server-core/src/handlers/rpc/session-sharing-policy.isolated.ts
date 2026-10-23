// U-API: crafted RPCs and direct SessionManager calls reject before session access or any viewer request.
import { expect, mock, test } from 'bun:test'
import { RPC_CHANNELS } from '@u-agents/shared/protocol'
import { SESSION_SHARING_DISABLED_REASON } from '@u-agents/shared/config/u-agents-feature-policy'
import { registerSessionsHandlers } from './sessions'
import { SessionManager } from '../../sessions/SessionManager'

test('public sharing is denied at RPC and service boundaries for new and legacy sessions', async () => {
  const calls = mock(() => { throw new Error('Disabled sharing must not touch session state') })
  const sessionManager = new Proxy({}, { get: () => calls })
  const handlers = new Map<string, (...args: never[]) => Promise<unknown>>()
  registerSessionsHandlers({ handle: (channel: string, fn: never) => handlers.set(channel, fn) } as never,
    { sessionManager, platform: { logger: console } } as never)
  const dispatch = handlers.get(RPC_CHANNELS.sessions.COMMAND)!
  const originalFetch = globalThis.fetch
  const request = mock(() => { throw new Error('No viewer request is allowed') })
  globalThis.fetch = request as unknown as typeof fetch
  try {
    for (const sessionId of ['new-session', 'legacy-shared-session', 'missing-session']) {
      for (const type of ['shareToViewer', 'updateShare', 'revokeShare'] as const) {
        expect(await dispatch(...[{}, sessionId, { type }] as never[]))
          .toEqual({ success: false, error: SESSION_SHARING_DISABLED_REASON })
        expect(await SessionManager.prototype[type].call(sessionManager as SessionManager, sessionId))
          .toEqual({ success: false, error: SESSION_SHARING_DISABLED_REASON })
      }
    }
    expect(calls).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  } finally {
    globalThis.fetch = originalFetch
  }
})
