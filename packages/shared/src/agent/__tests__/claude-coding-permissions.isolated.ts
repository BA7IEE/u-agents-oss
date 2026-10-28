// U-API: exercise Claude's actual SDK hook with no subprocess or model request.
import { expect, mock, test } from 'bun:test';
import { ensureConfigDir } from '../../config/storage.ts';
import { cleanupModeState, initializeModeState } from '../mode-manager.ts';
import type { BackendConfig } from '../backend/types.ts';
const sdk = await import('@anthropic-ai/claude-agent-sdk');
let options: any;
mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  ...sdk,
  query: (input: any) => {
    options = input.options;
    return Object.assign((async function* () { yield { type: 'result', subtype: 'success', result: 'synthetic', session_id: 'sdk-test', usage: {}, total_cost_usd: 0 }; })(), {
      interrupt: async () => {}, close: () => {},
    });
  },
}));
const { ClaudeAgent } = await import('../claude-agent.ts');

test('Claude advertises Coding PR tools and Explore allows status but blocks three writes and disabled Decision', async () => {
  ensureConfigDir();
  const id = 'claude-pr-permissions';
  const agent = new ClaudeAgent({
    provider: 'anthropic', isHeadless: true, skipConfigWatcher: true, agentProfile: 'coding',
    workspace: { id: 'ws', name: 'Synthetic', rootPath: `${process.env.TMPDIR}/claude-pr` },
    session: { id, workspaceRootPath: `${process.env.TMPDIR}/claude-pr`, createdAt: 0, lastUsedAt: 0 },
  } as BackendConfig);
  initializeModeState(id, 'safe');
  try {
    const events = [];
    for await (const event of (agent as any).chatImpl('synthetic query')) events.push(event);
    expect(events.filter((e: any) => e.type === 'error')).toEqual([]);
    expect(options).toBeDefined();
    const hook = options.hooks.PreToolUse[0].hooks[0];
    for (const [name, allowed] of [['pr_status', true], ['pr_bind', false], ['pr_unbind', false], ['pr_set_auto_merge', false], ['pr_future_write', false], ['decide', false]] as const) {
      const response = await hook({ hook_event_name: 'PreToolUse', tool_name: `mcp__session__${name}`, tool_input: {}, tool_use_id: name }, name, { signal: new AbortController().signal });
      expect(response.decision !== 'block' && response.hookSpecificOutput?.permissionDecision !== 'deny' && response.continue !== false).toBe(allowed);
    }
  } finally { cleanupModeState(id); agent.destroy(); }
});
