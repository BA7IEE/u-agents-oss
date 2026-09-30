// U-API: paid image callback owner replace / compare-delete 回归（16B §7.5）。
import { describe, expect, it } from 'bun:test'
import {
  clearPaidImageToolRegistryForTests,
  executePaidImageToolCallback,
  registerPaidImageToolCallback,
  unregisterPaidImageToolCallback,
} from '../paid-image-tool-registry.ts'

const input = { prompt: 'draw', _uapi_execution_nonce: 'process-nonce.turn-nonce' }
const result = (text: string) => ({ content: [{ type: 'text' as const, text }], structuredContent: {}, isError: false })

describe('paid image tool registry', () => {
  it('rejects an old owner and compare-deletes only the current owner', async () => {
    clearPaidImageToolRegistryForTests()
    registerPaidImageToolCallback('/tmp/workspace/session-a', 'old-owner', async () => result('old'))
    registerPaidImageToolCallback('/tmp/workspace/session-a', 'new-owner', async () => result('new'))

    expect(await executePaidImageToolCallback('/tmp/workspace/session-a', 'old-owner', input)).toBeNull()
    expect(unregisterPaidImageToolCallback('/tmp/workspace/session-a', 'old-owner')).toBe(false)
    expect((await executePaidImageToolCallback('/tmp/workspace/session-a', 'new-owner', input))?.content[0]?.text).toBe('new')
    expect(unregisterPaidImageToolCallback('/tmp/workspace/session-a', 'new-owner')).toBe(true)
  })
})

// U-API: identical session ids and owner tokens do not authorize a different workspace.
it('isolates paid callbacks by canonical workspace/session path', async () => {
  clearPaidImageToolRegistryForTests()
  let posts = 0
  registerPaidImageToolCallback('/tmp/paid-workspace-a/sessions/same', 'owner', async () => {
    posts++
    return result('authorized')
  })
  expect(await executePaidImageToolCallback('/tmp/paid-workspace-b/sessions/same', 'owner', input)).toBeNull()
  expect(posts).toBe(0)
  expect(await executePaidImageToolCallback('/tmp/paid-workspace-a/sessions/other', 'owner', input)).toBeNull()
  expect(posts).toBe(0)
  await executePaidImageToolCallback('/tmp/paid-workspace-a/sessions/same', 'owner', input)
  expect(posts).toBe(1)
  clearPaidImageToolRegistryForTests()
})
