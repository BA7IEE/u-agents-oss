/**
 * Pages script executor: builds a ScriptAction from the grant invocation,
 * injects CRAFT_* env, never sets `page` (so it can't clobber the refresh
 * marker), returns process outcome on run, and throws on a blocked run.
 * The runner itself is injected — spawn behavior is covered by the automations
 * script-executor tests.
 */

import { describe, test, expect } from 'bun:test'
import { createPagesScriptExecutor } from '../script-executor-bridge'
import type { ScriptAction, ScriptActionResult } from '@u-agents/shared/automations'
import type { Logger } from '@u-agents/server-core/runtime'

const log: Logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger
const signal = new AbortController().signal

function makeExecutor(result: Partial<ScriptActionResult>) {
  const seen: Array<{ action: ScriptAction; ctx: { workspaceRootPath: string; env: Record<string, string> } }> = []
  const executor = createPagesScriptExecutor({
    workspaceRootPath: '/tmp/ws',
    log,
    runScript: async (action, ctx) => {
      seen.push({ action, ctx })
      return {
        type: 'script',
        script: action.script,
        success: (result.exitCode ?? 0) === 0,
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        ...result,
      }
    },
  })
  return { executor, seen }
}

// U-API: direct bridge callers cannot bypass the broker's product policy.
describe('createPagesScriptExecutor', () => {
  test('rejects valid, escaping and malformed legacy invocations without running scripts', async () => {
    const { executor, seen } = makeExecutor({ exitCode: 0 });
    for (const script of ['pages/dash/run.sh', 'pages/dash/run.ts', '../evil.sh', '']) {
      await expect(executor({ pageSlug: 'dash', script, runtime: 'bun', args: ['--once'] }, { signal }))
        .rejects.toThrow('当前版本不支持');
    }
    expect(seen).toEqual([]);
  });
});
