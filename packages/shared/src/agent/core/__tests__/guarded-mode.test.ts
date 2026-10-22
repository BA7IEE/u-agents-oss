import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupModeState, initializeModeState, setGuardedModeActiveResolver } from '../../mode-manager.ts';
import { runPreToolUseChecks } from '../pre-tool-use.ts';
import { permissionsConfigCache } from '../../permissions-config.ts';
import { applyGuardedModeCheck, getGuardedModeCall, needsGuardedModeCheck, type GuardedModeCheck, type GuardedModeCall } from '../guarded-mode.ts';
import type { PreToolUseCheckResult, PreToolUseInput } from '../pre-tool-use.ts';

const SESSION = 'guarded-mode-test';
const originalConfigDir = process.env.U_AGENTS_CONFIG_DIR;
let configDir: string;
let workspaceRootPath: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'guard-config-'));
  workspaceRootPath = mkdtempSync(join(tmpdir(), 'guard-workspace-'));
  mkdirSync(join(configDir, 'permissions'), { recursive: true });
  writeFileSync(join(configDir, 'permissions', 'default.json'), JSON.stringify({
    version: '2026-09-27',
    allowedBashPatterns: [{ pattern: '^ls\\b', comment: 'list' }],
    allowedMcpPatterns: ['get', 'list'],
    allowedApiEndpoints: [],
    allowedWritePaths: [],
  }));
  process.env.U_AGENTS_CONFIG_DIR = configDir;
  permissionsConfigCache.clear();
  cleanupModeState(SESSION);
  initializeModeState(SESSION, 'guarded');
  setGuardedModeActiveResolver(() => true);
});

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.U_AGENTS_CONFIG_DIR;
  else process.env.U_AGENTS_CONFIG_DIR = originalConfigDir;
  permissionsConfigCache.clear();
  cleanupModeState(SESSION);
  setGuardedModeActiveResolver(null);
  rmSync(configDir, { recursive: true, force: true });
  rmSync(workspaceRootPath, { recursive: true, force: true });
});

function ctx(toolName: string, input: Record<string, unknown>): PreToolUseInput {
  return {
    toolName,
    input,
    sessionId: SESSION,
    permissionMode: 'guarded',
    workspaceRootPath,
    workspaceId: 'ws',
    workingDirectory: '/repo',
    activeSourceSlugs: ['github'],
    allSourceSlugs: ['github'],
    hasSourceActivation: false,
    permissionManager: { isCommandWhitelisted: () => false, getBaseCommand: (c: string) => c, isDomainWhitelisted: () => false } as never,
    prerequisiteManager: { checkPrerequisites: () => ({ allowed: true }), trackBashSkillRead: () => false } as never,
  } as PreToolUseInput;
}

describe('getGuardedModeCall', () => {
  it('skips read-only calls and built-in session tools', () => {
    expect(getGuardedModeCall('Bash', { command: 'ls -la' }, ctx('Bash', {}))).toBeNull();
    expect(getGuardedModeCall('mcp__github__get_issue', { number: 1 }, ctx('mcp__github__get_issue', {}))).toBeNull();
    expect(getGuardedModeCall('mcp__session__set_session_status', {}, ctx('mcp__session__set_session_status', {}))).toBeNull();
    expect(getGuardedModeCall('api_github', { method: 'GET', path: '/repos' }, ctx('api_github', {}))).toBeNull();
    expect(getGuardedModeCall('Read', { file_path: '/x' }, ctx('Read', {}))).toBeNull();
  });

  it('asks, without the model, before a file write outside the project and its session folders', () => {
    const plans = join(workspaceRootPath, 'plans');
    const withFolders = { ...ctx('Write', {}), plansFolderPath: plans };
    expect(getGuardedModeCall('Write', { file_path: '/repo/src/a.ts' }, withFolders)).toBeNull();
    expect(getGuardedModeCall('Edit', { file_path: 'src/a.ts' }, withFolders)).toBeNull();
    expect(getGuardedModeCall('Write', { file_path: join(plans, 'p.md') }, withFolders)).toBeNull();
    expect(getGuardedModeCall('Write', { file_path: '~/.ssh/config' }, withFolders)).toMatchObject({ promptType: 'file_write', alwaysAsk: 'outside_workspace' });
    expect(getGuardedModeCall('MultiEdit', { file_path: '/repo/../other/x.ts' }, withFolders)).toMatchObject({ command: '/other/x.ts' });
  });

  it('judges session tools that Explore blocks, but not session bookkeeping', () => {
    expect(getGuardedModeCall('mcp__session__delete_page', { slug: 'p' }, ctx('mcp__session__delete_page', {}))).toMatchObject({ promptType: 'mcp_mutation' });
    expect(getGuardedModeCall('mcp__session__set_session_labels', {}, ctx('mcp__session__set_session_labels', {}))).toBeNull();
  });

  it('describes writes, MCP mutations and non-GET API calls', () => {
    expect(getGuardedModeCall('Bash', { command: 'git push --force' }, ctx('Bash', {}))).toMatchObject({
      promptType: 'bash', command: 'git push --force', workingDirectory: '/repo',
    });
    expect(getGuardedModeCall('mcp__github__create_issue', { title: 't' }, ctx('mcp__github__create_issue', {}))).toMatchObject({
      promptType: 'mcp_mutation', command: 'mcp__github__create_issue', arguments: { title: 't' },
    });
    expect(getGuardedModeCall('api_github', { method: 'DELETE', path: '/repos/o/r' }, ctx('api_github', {}))).toMatchObject({
      promptType: 'api_mutation',
    });
  });
});

// U-API: a stored Guarded mode must use normal Ask checks; no decision callback runs.
describe('disabled Guarded execution', () => {
  it('requires ordinary approval for mutations, even with an active decision resolver', async () => {
    let calls = 0;
    const check: GuardedModeCheck = { isActive: () => true, check: async () => { calls++; return { risks: [] }; } };
    const input = ctx('Bash', { command: 'git push --force' });
    const result = await runPreToolUseChecks(input);
    expect(result.type).toBe('prompt');
    expect(needsGuardedModeCheck(result, input, check)).toBe(false);
    expect(await applyGuardedModeCheck(result, input, check)).toBe(result);
    expect(calls).toBe(0);
  });
  it('retains Explore blocks and explicit Execute behavior without model calls', async () => {
    for (const [mode, expected] of [['safe', 'block'], ['allow-all', 'allow']] as const) {
      initializeModeState(SESSION, mode);
      const result = await runPreToolUseChecks({ ...ctx('Bash', { command: 'git push --force' }), permissionMode: mode });
      expect(result.type).toBe(expected);
    }
  });
});
