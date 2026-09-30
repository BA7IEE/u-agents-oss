import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { PiAgent } from '../pi-agent.ts'
import { cleanupModeState, initializeModeState, setGuardedModeActiveResolver } from '../mode-manager.ts'
import type { BackendConfig } from '../backend/types.ts'
import type { GuardedModeCheck } from '../core/guarded-mode.ts'

const SESSION = 'pi-guard-session'

function createAgent() {
  const config = {
    provider: 'pi',
    workspace: { id: 'ws-test', name: 'Test Workspace', rootPath: '/tmp/pi-guard-ws' },
    session: { id: SESSION, workspaceRootPath: '/tmp/pi-guard-ws', createdAt: Date.now(), lastUsedAt: Date.now(), workingDirectory: '/tmp/pi-guard-project' },
    isHeadless: true,
  } as unknown as BackendConfig
  const agent = new PiAgent(config)
  const sent: Array<Record<string, unknown>> = []
  ;(agent as any).send = (message: Record<string, unknown>) => { sent.push(message) }
  ;(agent as any).emitAutomationEvent = async () => {}
  return { agent, sent }
}

const pushRequest = { requestId: 'req-1', toolName: 'Bash', input: { command: 'git push --force origin main' } }

describe('PiAgent Guarded mode', () => {
  beforeEach(() => {
    initializeModeState(SESSION, 'guarded')
    setGuardedModeActiveResolver(() => true)
  })
  afterEach(() => {
    cleanupModeState(SESSION)
    setGuardedModeActiveResolver(null)
  })

  it('uses normal user approval and never calls a decision model for stored Guarded sessions', async () => {
    for (const approved of [false, true]) {
      const { agent, sent } = createAgent();
      let checks = 0;
      agent.guardedModeCheck = { isActive: () => true, check: async () => { checks++; return { risks: [] }; } };
      let prompts = 0;
      agent.onPermissionRequest = request => { prompts++; agent.respondToPermission(request.requestId, approved, false); };
      await (agent as any).handlePreToolUseRequest(pushRequest);
      expect(prompts).toBe(1);
      expect(checks).toBe(0);
      expect(sent.at(-1)).toMatchObject({ type: 'pre_tool_use_response', requestId: 'req-1', action: approved ? 'allow' : 'block' });
    }
  });
  it('keeps explicit Execute behavior without decision calls', async () => {
    initializeModeState(SESSION, 'allow-all');
    const { agent, sent } = createAgent();
    let checks = 0;
    agent.guardedModeCheck = { isActive: () => true, check: async () => { checks++; return { risks: ['external'] }; } };
    await (agent as any).handlePreToolUseRequest(pushRequest);
    expect(checks).toBe(0);
    expect(['allow', 'modify']).toContain(sent.at(-1)!.action as string);
  });
});
