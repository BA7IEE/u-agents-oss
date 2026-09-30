// U-API: unsupported conditions never become unconditional execution; stored evidence survives.
import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AutomationSystem } from './automation-system'
import { validateAutomationsContent } from './validation'
import { appendAutomationHistoryEntry } from './history-store'

test('retains stored conditions, rejects editing, filters every action kind and records the reason', async () => {
  const root = mkdtempSync(join(tmpdir(), 'uagents-semantic-'))
  const actions = [{ type: 'prompt', prompt: 'hello' }, { type: 'webhook', url: 'https://example.com' }, { type: 'script', script: 'task.ts' }]
  const config = { automations: { LabelAdd: [
    ...actions.map((action, i) => ({ id: `blocked${i}`, matcher: 'test', semanticCondition: { question: 'Run?' }, actions: [action] })),
    { id: 'ordinary', matcher: 'test', actions: [{ type: 'prompt', prompt: 'ordinary task' }] },
  ] } }
  const raw = JSON.stringify(config)
  writeFileSync(join(root, 'automations.json'), raw)
  const system = new AutomationSystem({ workspaceRootPath: root, workspaceId: 'test' })
  try {
    const validated = validateAutomationsContent(raw)
    expect(validated.valid).toBe(false)
    expect(validated.errors.filter(e => e.path?.endsWith('semanticCondition'))).toHaveLength(3)
    expect(system.getMatchersForEvent('LabelAdd').map(m => m.id)).toEqual(['ordinary'])
    expect(system.getConfig()?.automations.LabelAdd).toHaveLength(4)
    expect(readFileSync(join(root, 'automations.json'), 'utf8')).toBe(raw)
    // Await the serialized history queue, without sleeps or polling.
    await appendAutomationHistoryEntry(root, { id: 'barrier', ts: Date.now(), ok: true })
    const records = readFileSync(join(root, 'automations-history.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s))
    expect(records.filter(r => r.skipped?.includes('不支持语义条件'))).toHaveLength(3)
  } finally { await system.dispose(); rmSync(root, { recursive: true, force: true }) }
})


test('persisted webhook retry cannot bypass a stored semantic condition', async () => {
  const { RetryScheduler } = await import('./retry-scheduler');
  const root = mkdtempSync(join(tmpdir(), 'uagents-retry-policy-'));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('ok'); }) as typeof fetch;
  const scheduler = new RetryScheduler({ workspaceRootPath: root });
  try {
    writeFileSync(join(root, 'automations.json'), JSON.stringify({ automations: { LabelAdd: [{ id: 'blocked', semanticCondition: { question: 'Run?' }, actions: [{ type: 'webhook', url: 'https://example.com' }] }] } }));
    writeFileSync(join(root, 'automations-retry-queue.jsonl'), JSON.stringify({ id: 'retry', matcherId: 'blocked', action: { type: 'webhook', url: 'https://example.com' }, expandedUrl: 'https://example.com', deferredAttempt: 0, createdAt: 1, nextRetryAt: 1 }) + '\n');
    await (scheduler as any).tick();
    expect(calls).toBe(0);
    const saved = JSON.parse(readFileSync(join(root, 'automations-retry-queue.jsonl'), 'utf8').trim());
    expect(saved.deferredAttempt).toBe(0);
    expect(saved.policyBlockReason).toContain('不支持语义条件');
    expect(readFileSync(join(root, 'automations.json'), 'utf8')).toContain('semanticCondition');
    // An explicit supported configuration resumes the ordinary queued webhook.
    writeFileSync(join(root, 'automations.json'), JSON.stringify({ automations: { LabelAdd: [{ id: 'blocked', actions: [{ type: 'webhook', url: 'https://example.com' }] }] } }));
    await (scheduler as any).tick();
    expect(calls).toBe(1);
    expect(readFileSync(join(root, 'automations-retry-queue.jsonl'), 'utf8').trim()).toBe('');
  } finally { scheduler.dispose(); globalThis.fetch = originalFetch; rmSync(root, { recursive: true, force: true }); }
});
