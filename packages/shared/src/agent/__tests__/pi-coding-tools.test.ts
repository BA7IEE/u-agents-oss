// U-API: integration regressions for the Coding tool/permission/event boundaries.
import { ensureConfigDir } from '../../config/storage.ts';
import { beforeAll, afterEach, describe, expect, it } from 'bun:test';
import { PiAgent } from '../pi-agent.ts';
import type { BackendConfig } from '../backend/types.ts';
import { mergeSessionScopedToolCallbacks } from '../session-scoped-tool-callback-registry.ts';
import { shouldAllowToolInMode, initializeModeState, cleanupModeState } from '../mode-manager.ts';
import { ProxyToolRegistry } from '../../../../pi-agent-server/src/proxy-tool-registry.ts';
import { AbortReason } from '../backend/types.ts';

beforeAll(() => ensureConfigDir());

const agents: PiAgent[] = [];
const PR_TOOLS = ['pr_status', 'pr_bind', 'pr_unbind', 'pr_set_auto_merge'];
let sequence = 0;
function setup(options: Partial<BackendConfig> = {}) {
  const id = `pi-coding-regression-${sequence++}`;
  const config = {
    provider: 'pi',
    workspace: { id: 'synthetic', name: 'Synthetic', rootPath: `${process.env.TMPDIR}/coding-tools` },
    session: { id, workspaceRootPath: `${process.env.TMPDIR}/coding-tools`, createdAt: 0, lastUsedAt: 0 },
    isHeadless: true, skipConfigWatcher: true, agentProfile: 'coding', ...options,
  } as BackendConfig;
  const agent = new PiAgent(config);
  agents.push(agent);
  const internal = agent as any;
  const messages: any[] = [];
  const registry = new ProxyToolRegistry();
  internal.send = (message: any) => {
    messages.push(message);
    if (message.type === 'register_tools') registry.register(message.tools, message.scope);
    if (message.type === 'prompt') queueMicrotask(() => internal.handleSubprocessEvent({ type: 'agent_end', messages: [], willRetry: false }));
  };
  internal.ensureSubprocess = async () => {};
  internal.subprocess = { kill: () => {} };
  internal.emitAutomationEvent = async () => {};
  internal.getSessionToolContext = () => ({ prWatch: {
    status: async () => ({ kind: 'ready', sessionId: id, prs: [] }),
    bind: async () => ({ ok: true }), unbind: async () => ({ ok: true, removed: true }),
    setAutoMerge: async () => ({ ok: true }),
  } });
  return { agent, internal, messages, registry, id };
}

afterEach(() => { for (const agent of agents.splice(0)) { const id = agent.getSessionId(); if (id) cleanupModeState(id); agent.destroy(); } });

describe('Coding PR tool execution and Explore classification', () => {
  it('executes every registered PR tool for full Coding and rejects ordinary, mini and stale profiles', async () => {
    const t = setup();
    const args = { pr: 'https://github.com/acme/app/pull/12', enabled: true };
    t.internal.refreshSessionToolsWithSubprocess();
    for (const name of PR_TOOLS) {
      expect(t.registry.definitions().some(d => d.name === `mcp__session__${name}`)).toBe(true);
      expect((await t.internal.routeToolCall(`mcp__session__${name}`, args)).isError).toBe(false);
    }
    t.agent.setAgentProfile('default'); // registered list is deliberately stale
    for (const name of PR_TOOLS) expect((await t.internal.routeToolCall(`mcp__session__${name}`, args)).content).toContain('Unknown session tool');
    const mini = setup({ systemPromptPreset: 'mini' });
    mini.internal.refreshSessionToolsWithSubprocess();
    for (const name of PR_TOOLS) {
      expect(mini.registry.definitions().some(d => d.name === `mcp__session__${name}`)).toBe(false);
      expect((await mini.internal.routeToolCall(`mcp__session__${name}`, args)).isError).toBe(true);
    }
  });

  it('allows only PR status through the real Pi pre-tool pipeline in Explore', async () => {
    const t = setup();
    initializeModeState(t.id, 'safe');
    for (const name of [...PR_TOOLS, 'pr_future_write', 'decide', 'source_credential_prompt', 'call_llm']) {
      const toolName = `mcp__session__${name}`;
      const allowed = name === 'pr_status' || name === 'call_llm';
      expect(shouldAllowToolInMode(toolName, {}, 'safe').allowed).toBe(allowed);
      await t.internal.handlePreToolUseRequest({ requestId: name, toolName, input: {} });
      expect(t.messages.at(-1).action === 'block').toBe(!allowed);
    }
    expect(shouldAllowToolInMode('Read', { file_path: '/synthetic/readme.md' }, 'safe').allowed).toBe(true);
  });
});

describe('Pi raw events pin created PRs', () => {
  it('correlates interleaved start/end calls and never pins failed, unrelated or aborted commands', async () => {
    const t = setup();
    const binds: unknown[] = [];
    mergeSessionScopedToolCallbacks(t.id, { prWatch: {
      bind: async input => { binds.push(input); return { ok: true }; },
      status: async () => ({ kind: 'none', sessionId: t.id, prs: [] }),
      unbind: async () => ({ ok: true }), setAutoMerge: async () => ({ ok: true }),
    } });
    const start = (id: string, command: string, toolName = 'bash') => t.internal.handleSubprocessEvent({ type: 'tool_execution_start', toolCallId: id, toolName, args: { command } });
    const end = (id: string, isError = false, toolName = 'bash') => t.internal.handleSubprocessEvent({ type: 'tool_execution_end', toolCallId: id, toolName, isError, result: { content: [{ type: 'text', text: 'https://github.com/acme/app/pull/12' }] } });
    start('create', 'gh pr create --fill');
    start('other', 'gh pr view 12');
    end('other'); end('create'); end('create');
    await Promise.resolve();
    expect(binds).toEqual([{ ref: 'https://github.com/acme/app/pull/12', skipBranchPr: true }]);
    start('failed', 'gh pr create --fill'); end('failed', true);
    start('read', 'gh pr create --fill', 'read'); end('read', false, 'read');
    start('abort', 'gh pr create --fill'); await t.agent.abort(); end('abort');
    expect(t.internal.bashCommandsByCallId.size).toBe(0);
    t.internal.turnAbort = new AbortController();
    start('forced', 'gh pr create --fill'); t.agent.forceAbort(AbortReason.UserStop); end('forced');
    t.internal.turnAbort = new AbortController();
    start('replace', 'gh pr create --fill'); t.internal.killSubprocess(); end('replace');
    await Promise.resolve();
    expect(binds).toHaveLength(1);
  });
});

describe('one living Pi backend tracks project and source changes', () => {
  it('refreshes the next prompt, revokes stale calls immediately, and keeps the other tool group and owner', async () => {
    let projectId: string | undefined;
    let proxyTools: any[] = [];
    const paidImageTool = { sessionPath: '/synthetic/session', ownerToken: 'synthetic-owner' };
    const pool = { sync: async () => [], getProxyToolDefs: () => proxyTools };
    const t = setup({ getCurrentProjectId: () => projectId, mcpPool: pool as any, paidImageTool });
    // Exercise chatImpl's actual pre-prompt registration path, without a model or child process.
    const prompt = async () => { for await (const _event of t.internal.chatImpl('synthetic turn')) { /* consume */ } };
    await prompt();
    const names = () => t.registry.definitions().map(d => d.name);
    expect(names()).not.toContain('mcp__session__project_memory_append');
    projectId = 'project-a';
    proxyTools = [{ name: 'mcp__source__read', description: 'Synthetic', inputSchema: { type: 'object' } }];
    await t.agent.setSourceServers({}, {}, ['source']);
    await prompt();
    expect(names()).toContain('mcp__session__project_memory_append');
    expect(names()).toContain('mcp__session__source_test');
    expect(names()).toContain('mcp__source__read');
    expect(t.internal.getCurrentProjectId()).toBe('project-a');
    projectId = 'project-b';
    expect(t.internal.getCurrentProjectId()).toBe('project-b');
    projectId = undefined;
    // Snapshot fallback must not resurrect a project after explicit unbinding.
    t.internal.config.session.projectId = 'stale-project';
    expect((await t.internal.routeToolCall('mcp__session__project_memory_append', { note: 'test' })).content).toContain('Unknown session tool');
    await prompt();
    expect(names()).not.toContain('mcp__session__project_memory_append');
    expect(names()).toContain('mcp__source__read');
    proxyTools = [];
    await t.agent.setSourceServers({}, {}, []);
    expect((await t.internal.routeToolCall('mcp__session__source_test', {})).content).toContain('Unknown session tool');
    await prompt();
    expect(names()).not.toContain('mcp__source__read');
    expect(names()).not.toContain('mcp__session__source_test');
    expect(names()).toContain('mcp__session__pr_status');
    expect(t.internal.config.paidImageTool).toBe(paidImageTool);
    const before = t.messages.filter(m => m.type === 'register_tools').length;
    await prompt();
    expect(t.messages.filter(m => m.type === 'register_tools')).toHaveLength(before);
  });
});
