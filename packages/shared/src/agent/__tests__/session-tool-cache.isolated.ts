import { expect, mock, test } from 'bun:test'
import * as context from '../claude-context'
import { ensureConfigDir } from '../../config/storage'
let builds = 0
const createContext = context.createClaudeContext
mock.module('../claude-context', () => ({ ...context, createClaudeContext: (options: Parameters<typeof context.createClaudeContext>[0]) => {
  builds++; return createContext(options)
} }))
const { getSessionScopedTools, cleanupSessionScopedTools, invalidateAllSessionToolsCaches } = await import('../session-scoped-tools')

test('cache reuse and cleanup cover full/mini, owner, profile, source and project variants', () => {
  ensureConfigDir(); invalidateAllSessionToolsCaches()
  const options = [
    {}, { agentKind: 'mini' as const },
    { paidImageTool: { sessionPath: '/cache-test/session', ownerToken: 'a' } },
    { paidImageTool: { sessionPath: '/cache-test/session', ownerToken: 'b' } },
    { profile: 'coding' as const },
    { profile: 'coding' as const, hasEnabledSources: true },
    { profile: 'coding' as const, hasProject: true },
    { profile: 'coding' as const, hasProject: true, hasEnabledSources: true },
  ]
  for (const value of options) { getSessionScopedTools('one', '/cache-test', 'test', value); getSessionScopedTools('one', '/cache-test', 'test', value) }
  expect(builds).toBe(options.length)
  getSessionScopedTools('two', '/cache-test')
  cleanupSessionScopedTools('one')
  for (const value of options) getSessionScopedTools('one', '/cache-test', 'test', value)
  getSessionScopedTools('two', '/cache-test')
  expect(builds).toBe(options.length * 2 + 1)
  invalidateAllSessionToolsCaches()
  getSessionScopedTools('two', '/cache-test')
  expect(builds).toBe(options.length * 2 + 2)
})
