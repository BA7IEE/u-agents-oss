import { expect, mock, test } from 'bun:test'
import * as config from '@u-agents/shared/config'
import { RPC_CHANNELS } from '@u-agents/shared/protocol'
let lookups = 0
mock.module('@u-agents/shared/config', () => ({ ...config,
  getWorkspaceByNameOrId: () => { lookups++; throw new Error('must reject before workspace or credentials') },
}))
const { registerPagesHandlers } = await import('./pages')
test('the Claude artifact RPC rejects even for a crafted caller before workspace, credentials or SDK access', async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<unknown>>()
  registerPagesHandlers({ handle: (channel: string, fn: any) => handlers.set(channel, fn) } as never,
    { platform: { logger: console } } as never)
  await expect(handlers.get(RPC_CHANNELS.pages.PUBLISH_CLAUDE_ARTIFACT)!({}, 'unknown-workspace', 'crafted-page'))
    .rejects.toThrow('Public page publishing is disabled')
  expect(lookups).toBe(0)
})
