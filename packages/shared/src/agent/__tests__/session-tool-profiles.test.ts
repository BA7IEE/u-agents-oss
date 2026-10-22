import { afterEach, beforeAll, expect, test } from 'bun:test'
import { ensureConfigDir } from '../../config/storage'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { getSessionScopedTools, cleanupSessionScopedTools, invalidateAllSessionToolsCaches } from '../session-scoped-tools'
import { getSessionToolProxyDefs } from '../backend/pi/session-tool-defs'
import { registerPaidImageToolCallback, clearPaidImageToolRegistryForTests } from '../paid-image-tool-registry'

const session = 'profile-cache-regression'
const workspace = '/synthetic/workspace'
const clients: Client[] = []
beforeAll(() => ensureConfigDir())
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()))
  cleanupSessionScopedTools(session)
  clearPaidImageToolRegistryForTests()
})

async function connect(options: NonNullable<Parameters<typeof getSessionScopedTools>[3]>) {
  const server = getSessionScopedTools(session, workspace, 'workspace', options)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'profile-test', version: '1' })
  clients.push(client)
  await server.instance.connect(serverSide)
  await client.connect(clientSide)
  return { server, client, names: (await client.listTools()).tools.map(tool => tool.name) }
}

test('factory and Pi agree on full/mini and every coding source/project combination', async () => {
  for (const agentKind of ['full', 'mini'] as const) {
    for (const profile of ['default', 'coding'] as const) {
      for (const hasEnabledSources of [false, true]) for (const hasProject of [false, true]) {
        const options = { agentKind, profile, hasEnabledSources, hasProject }
        const { names } = await connect(options)
        const pi = getSessionToolProxyDefs(options).map(tool => tool.name.replace('mcp__session__', ''))
        expect(new Set(names)).toEqual(new Set(pi))
        expect(names.includes('generate_image')).toBe(agentKind === 'full' && profile === 'default')
        expect(names).not.toContain('decide')
        if (profile === 'coding') {
          expect(names.includes('source_test')).toBe(hasEnabledSources)
          expect(names.includes('project_memory_append')).toBe(hasProject)
          expect(names).not.toContain('browser_tool')
          expect(names).not.toContain('create_page')
        }
      }
    }
  }
})

test('back-to-back queries get fresh transports; replacing the paid owner never reuses its callback', async () => {
  const sessionPath = '/synthetic/workspace/sessions/profile-cache-regression'
  const paid = (ownerToken: string) => ({ paidImageTool: { sessionPath, ownerToken } })
  registerPaidImageToolCallback(sessionPath, 'owner-a', async () => ({ content: [{ type: 'text', text: 'owner-a' }] }))
  const first = await connect(paid('owner-a'))
  const second = await connect(paid('owner-a'))
  expect(first.server.instance).not.toBe(second.server.instance)
  const call = { name: 'generate_image', arguments: { prompt: 'synthetic image', _uapi_execution_nonce: 'synthetic-nonce-1234567890' } }
  // The handler still enforces its host-origin contract; route the callback via its bound context.
  registerPaidImageToolCallback(sessionPath, 'owner-b', async () => ({ content: [{ type: 'text', text: 'owner-b' }] }))
  const replacement = await connect(paid('owner-b'))
  expect(JSON.stringify(await first.client.callTool(call))).toContain('not_executable')
  expect(JSON.stringify(await replacement.client.callTool(call))).toContain('owner-b')
  expect(replacement.names).toContain('generate_image')
  cleanupSessionScopedTools(session)
  const afterCleanup = await connect({ profile: 'coding', hasEnabledSources: true })
  expect(afterCleanup.names).not.toContain('generate_image')
  expect(afterCleanup.names).toContain('source_test')
  invalidateAllSessionToolsCaches()
})
