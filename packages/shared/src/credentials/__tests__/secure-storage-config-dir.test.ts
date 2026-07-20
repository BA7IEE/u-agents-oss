import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const CREDENTIALS_MODULE = pathToFileURL(join(import.meta.dir, '..', 'index.ts')).href
const createdRoots: string[] = []

function createRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  createdRoots.push(root)
  return root
}

function runCredentialRoundTrip(options: {
  homeDir: string
  uAgentsConfigDir?: string
  craftConfigDir?: string
}): { exitCode: number; stdout: string; stderr: string } {
  const env: Record<string, string | undefined> = {
    ...process.env,
    HOME: options.homeDir,
    USERPROFILE: options.homeDir,
  }
  delete env.U_AGENTS_CONFIG_DIR
  delete env.CRAFT_CONFIG_DIR

  if (options.uAgentsConfigDir) env.U_AGENTS_CONFIG_DIR = options.uAgentsConfigDir
  if (options.craftConfigDir) env.CRAFT_CONFIG_DIR = options.craftConfigDir

  const result = Bun.spawnSync([
    process.execPath,
    '--eval',
    `
      import { getCredentialManager } from '${CREDENTIALS_MODULE}';
      const manager = getCredentialManager();
      await manager.setLlmApiKey('isolation-test', 'sk-isolation-test');
      const stored = await manager.getLlmApiKey('isolation-test');
      console.log(JSON.stringify({ stored }));
    `,
  ], {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('SecureStorageBackend CONFIG_DIR isolation', () => {
  // U-API: regression for packaged test profiles overwriting ~/.u-agents/credentials.enc.
  it('writes credentials only under U_AGENTS_CONFIG_DIR when set', () => {
    const homeDir = createRoot('u-agents-credential-home-')
    const configDir = createRoot('u-agents-credential-config-')
    const legacyConfigDir = createRoot('u-agents-credential-legacy-')

    const result = runCredentialRoundTrip({ homeDir, uAgentsConfigDir: configDir, craftConfigDir: legacyConfigDir })

    expect(result.exitCode, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ stored: 'sk-isolation-test' })
    expect(existsSync(join(configDir, 'credentials.enc'))).toBe(true)
    expect(existsSync(join(legacyConfigDir, 'credentials.enc'))).toBe(false)
    expect(existsSync(join(homeDir, '.u-agents', 'credentials.enc'))).toBe(false)
  })

  it('keeps CRAFT_CONFIG_DIR as the legacy fallback', () => {
    const homeDir = createRoot('u-agents-credential-home-')
    const configDir = createRoot('u-agents-credential-legacy-')

    const result = runCredentialRoundTrip({ homeDir, craftConfigDir: configDir })

    expect(result.exitCode, result.stderr).toBe(0)
    expect(existsSync(join(configDir, 'credentials.enc'))).toBe(true)
    expect(existsSync(join(homeDir, '.u-agents', 'credentials.enc'))).toBe(false)
  })

  it('preserves ~/.u-agents as the default without an override', () => {
    const homeDir = createRoot('u-agents-credential-home-')

    const result = runCredentialRoundTrip({ homeDir })

    expect(result.exitCode, result.stderr).toBe(0)
    expect(existsSync(join(homeDir, '.u-agents', 'credentials.enc'))).toBe(true)
  })
})
