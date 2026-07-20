// U-API: host paid lease的本地自修正预算、owner gate与claimed取消语义（16B §3-§5）。
import { describe, expect, it } from 'bun:test'
import { SessionManager, createManagedSession } from './SessionManager.ts'

function harness() {
  const manager = new SessionManager()
  const managed = createManagedSession({ id: 'paid-image-test', messagesLoaded: true }, {
    id: 'workspace-test',
    name: 'Workspace',
    rootPath: '/tmp/paid-image-workspace',
    createdAt: Date.now(),
  } as never)
  managed.isProcessing = true
  ;(managed as never as { paidImageOwnerToken: string }).paidImageOwnerToken = 'owner-current'
  const context = (manager as never as {
    createPaidImageContext(id: string, origin: 'interactive'): { invocationId: string; origin: 'interactive'; executionNonce: string }
  }).createPaidImageContext('message-1', 'interactive')
  const record: {
    context: typeof context
    ownerToken: string
    manifest: Map<unknown, unknown>
    phase: Record<string, unknown>
  } = {
    context,
    ownerToken: 'owner-current',
    manifest: new Map(),
    phase: { phase: 'open', localFailureCount: 0 },
  }
  ;(managed as never as { paidImageInvocation: unknown }).paidImageInvocation = record
  return { manager, managed, context, record }
}

describe('paid image host lifecycle', () => {
  it('allows one local correction, then terminates without credential or network access', async () => {
    const { manager, managed, context, record } = harness()
    const execute = (manager as never as {
      executePaidImageTool(m: unknown, owner: string, input: unknown): Promise<{ content: Array<{ text: string }> }>
    }).executePaidImageTool.bind(manager)
    const input = {
      prompt: 'edit it',
      input_images: [{ ref: 'img_1', role: 'edit_target' }],
      _uapi_execution_nonce: context.executionNonce,
    }

    expect((await execute(managed, 'owner-current', input)).content[0]?.text).toContain('input_invalid')
    expect(record.phase).toEqual({ phase: 'open', localFailureCount: 1 })
    expect((await execute(managed, 'owner-current', input)).content[0]?.text).toContain('input_invalid')
    expect(record.phase).toEqual({ phase: 'terminal', chargeState: 'not_sent' })
  })

  it('rejects stale owners and classifies old-process nonces without changing the current record', async () => {
    const { manager, managed, context, record } = harness()
    const execute = (manager as never as {
      executePaidImageTool(m: unknown, owner: string, input: unknown): Promise<{ content: Array<{ text: string }> }>
    }).executePaidImageTool.bind(manager)
    const valid = { prompt: 'draw', _uapi_execution_nonce: context.executionNonce }
    expect((await execute(managed, 'owner-stale', valid)).content[0]?.text).toContain('not_executable')
    expect(record.phase).toEqual({ phase: 'open', localFailureCount: 0 })

    ;(managed as never as { paidImageInvocation?: unknown }).paidImageInvocation = undefined
    const oldNonce = '123e4567-e89b-42d3-a456-426614174000.123e4567-e89b-42d3-a456-426614174001'
    expect((await execute(managed, 'owner-current', { prompt: 'draw', _uapi_execution_nonce: oldNonce })).content[0]?.text)
      .toContain('possibly_charged')
  })

  it('aborts a claimed request and keeps the honest possibly-charged terminal state', () => {
    const { manager, managed, record } = harness()
    const controller = new AbortController()
    record.phase = { phase: 'claimed', leaseToken: 'lease-1', controller }
    ;(manager as never as { terminatePaidImageInvocation(m: unknown): void }).terminatePaidImageInvocation(managed)
    expect(controller.signal.aborted).toBe(true)
    expect(record.phase).toEqual({ phase: 'terminal', leaseToken: 'lease-1', chargeState: 'possibly_charged' })
  })

  it('aborts preflight as not-sent and rejects a concurrent second call', async () => {
    const { manager, managed, context, record } = harness()
    const controller = new AbortController()
    record.phase = { phase: 'preflight', leaseToken: 'lease-preflight', controller }
    const execute = (manager as never as {
      executePaidImageTool(m: unknown, owner: string, input: unknown): Promise<{ content: Array<{ text: string }> }>
    }).executePaidImageTool.bind(manager)
    const second = await execute(managed, 'owner-current', {
      prompt: 'draw again',
      _uapi_execution_nonce: context.executionNonce,
    })
    expect(second.content[0]?.text).toContain('"charge_state":"not_sent"')
    expect(record.phase).toMatchObject({ phase: 'preflight', leaseToken: 'lease-preflight' })

    ;(manager as never as { terminatePaidImageInvocation(m: unknown): void }).terminatePaidImageInvocation(managed)
    expect(controller.signal.aborted).toBe(true)
    expect(record.phase).toEqual({ phase: 'terminal', leaseToken: 'lease-preflight', chargeState: 'not_sent' })
  })

  it('treats a same-process old-turn nonce as not executable, not possibly charged', async () => {
    const { manager, managed, context, record } = harness()
    const execute = (manager as never as {
      executePaidImageTool(m: unknown, owner: string, input: unknown): Promise<{ content: Array<{ text: string }> }>
    }).executePaidImageTool.bind(manager)
    const [processNonce] = context.executionNonce.split('.')
    const result = await execute(managed, 'owner-current', {
      prompt: 'replay',
      _uapi_execution_nonce: `${processNonce}.123e4567-e89b-42d3-a456-426614174001`,
    })
    expect(result.content[0]?.text).toContain('"category":"not_executable"')
    expect(result.content[0]?.text).toContain('"charge_state":"not_sent"')
    expect(record.phase).toEqual({ phase: 'open', localFailureCount: 0 })
  })
})
