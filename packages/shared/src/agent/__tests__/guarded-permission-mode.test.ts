import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  DEFAULT_PERMISSION_MODES,
  PERMISSION_MODE_ORDER,
  availablePermissionModes,
  clampPermissionMode,
  isAutonomousPermissionMode,
  isPermissionMode,
  parsePermissionMode,
  toCanonicalPermissionMode,
} from '../mode-types.ts';
import { cleanupModeState, cyclePermissionMode, getPermissionMode, initializeModeState, resolveEffectivePermissionMode, setGuardedModeActiveResolver, shouldAllowToolInMode } from '../mode-manager.ts';
import { PermissionManager } from '../core/permission-manager.ts';

const SESSION = 'guarded-permission-mode-test';

describe('Guarded permission mode', () => {
  it('retains the stored enum but clamps legacy Guarded sessions and children to Ask', () => {
    expect(PERMISSION_MODE_ORDER).toEqual(['safe', 'ask', 'guarded', 'allow-all']);
    expect(clampPermissionMode('allow-all', 'guarded')).toBe('ask');
    expect(clampPermissionMode(undefined, 'guarded')).toBe('ask');
    expect(clampPermissionMode('ask', 'guarded')).toBe('ask');
    expect(clampPermissionMode('guarded', 'ask')).toBe('ask');
    expect(clampPermissionMode('guarded', 'allow-all')).toBe('ask');
  });

  it('parses, names and validates the mode', () => {
    expect(parsePermissionMode('guarded')).toBe('ask');
    expect(parsePermissionMode(' Guarded ')).toBe('ask');
    expect(toCanonicalPermissionMode('guarded')).toBe('guarded');
    expect(isPermissionMode('guarded')).toBe(true);
    expect(isPermissionMode('auto')).toBe(false);
    expect(isPermissionMode(undefined)).toBe(false);
  });

  it('is never offered, even with flags on or a legacy current mode', () => {
    expect(DEFAULT_PERMISSION_MODES).toEqual(['safe', 'ask', 'allow-all']);
    expect(availablePermissionModes(false)).toEqual(['safe', 'ask', 'allow-all']);
    expect(availablePermissionModes(true)).toEqual(['safe', 'ask', 'allow-all']);
    expect(availablePermissionModes(false, 'guarded')).toEqual(['safe', 'ask', 'allow-all']);
  });

  it('does not count as autonomous; the low-level allow check retains Ask semantics', () => {
    expect(isAutonomousPermissionMode('guarded')).toBe(false);
    expect(isAutonomousPermissionMode('allow-all')).toBe(true);
    expect(isAutonomousPermissionMode('ask')).toBe(false);
    expect(shouldAllowToolInMode('Write', { file_path: '/tmp/x', content: 'y' }, 'guarded')).toEqual({ allowed: true });
    expect(shouldAllowToolInMode('Bash', { command: 'rm -rf build' }, 'guarded')).toEqual({ allowed: true });
  });

  describe('with session state', () => {
    beforeEach(() => cleanupModeState(SESSION));
    afterEach(() => {
      cleanupModeState(SESSION);
      setGuardedModeActiveResolver(null);
    });

    it('requires ordinary Ask approval even when a decision resolver reports active', () => {
      setGuardedModeActiveResolver(() => true);
      initializeModeState(SESSION, 'guarded');
      const manager = new PermissionManager({ workspaceId: 'test-workspace', sessionId: SESSION, workingDirectory: '/tmp/ws', plansFolderPath: '/tmp/ws/plans' });
      expect(manager.checkBashCommand('rm -rf build')).toBeNull();
      expect(manager.requiresBashPermission('rm -rf build')).toBe(true);
    });

    it('falls back to Ask while its check cannot run, and by default until the host installs it', () => {
      expect(resolveEffectivePermissionMode('guarded')).toBe('ask');
      setGuardedModeActiveResolver(() => true);
      expect(resolveEffectivePermissionMode('guarded')).toBe('ask');
      setGuardedModeActiveResolver(() => { throw new Error('config unreadable'); });
      expect(resolveEffectivePermissionMode('guarded')).toBe('ask');
      expect(resolveEffectivePermissionMode('allow-all')).toBe('allow-all');

      initializeModeState(SESSION, 'guarded');
      setGuardedModeActiveResolver(() => false);
      const manager = new PermissionManager({ workspaceId: 'test-workspace', sessionId: SESSION, workingDirectory: '/tmp/ws', plansFolderPath: '/tmp/ws/plans' });
      expect(manager.requiresBashPermission('rm -rf build')).toBe(true);
    });

    it('cannot be re-enabled by a custom SHIFT+TAB cycle', () => {
      initializeModeState(SESSION, 'allow-all');
      expect(cyclePermissionMode(SESSION)).toBe('safe');
      initializeModeState(SESSION, 'ask');
      expect(cyclePermissionMode(SESSION, ['ask', 'guarded'])).toBe('ask');
      expect(getPermissionMode(SESSION)).toBe('ask');
      expect(cyclePermissionMode(SESSION, ['ask', 'guarded'])).toBe('ask');
    });
  });
});
