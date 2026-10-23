import { expect, test } from 'bun:test'
import { resolve, join } from 'node:path'
import { resolveInheritedAppEnv } from './inherited-app-env'

const checkout = resolve(import.meta.dir, '../../../..')
const foreign = join(process.env.TMPDIR!, 'foreign-running-app')
const hints: Record<string, string> = {}
for (const prefix of ['U_AGENTS_', 'CRAFT_']) for (const suffix of [
  'APP_ROOT', 'RESOURCES_BASE', 'RESOURCES_PATH', 'BUNDLED_ASSETS_ROOT', 'BUN', 'UV', 'SCRIPTS',
]) hints[prefix + suffix] = suffix === 'APP_ROOT' ? foreign : join(foreign, suffix.toLowerCase())

test('both runtime families are sanitized while explicit configuration roots survive', () => {
  const env = { ...hints, U_AGENTS_CONFIG_DIR: join(foreign, 'test-config'), CRAFT_CONFIG_DIR: join(foreign, 'legacy-test-config') }
  const result = resolveInheritedAppEnv(env, checkout, checkout)
  expect(result.appRootPath).toBe(checkout)
  expect(result.dropKeys.sort()).toEqual(Object.keys(hints).sort())
  expect(result.dropKeys).not.toContain('U_AGENTS_CONFIG_DIR')
  expect(result.dropKeys).not.toContain('CRAFT_CONFIG_DIR')
  expect(resolveInheritedAppEnv(env, null, '/packaged').dropKeys).toEqual([])
  expect(resolveInheritedAppEnv(env, null, '/packaged').appRootPath).toBe(foreign)
})

test('actual headless platform resolves the candidate Pi, Claude, Bun, document script and assets', () => {
  const script = `
    import { createHeadlessPlatform } from './packages/server-core/src/runtime/platform-headless';
    import { resolveBackendRuntimePaths } from './packages/shared/src/agent/backend/internal/runtime-resolver';
    import { resolveMarkitdownRuntime } from './packages/server-core/src/services/markitdown';
    import { CONFIG_DIR } from './packages/shared/src/config/paths';
    import { getBundledAssetsDir, setBundledAssetsRoot } from './packages/shared/src/utils/paths';
    import { dirname } from 'node:path';
    const platform = createHeadlessPlatform();
    setBundledAssetsRoot(process.env.U_AGENTS_BUNDLED_ASSETS_ROOT ?? dirname(platform.resourcesPath));
    const paths = resolveBackendRuntimePaths(platform);
    console.log('RUNTIME_PROOF=' + JSON.stringify({ platform: { appRootPath: platform.appRootPath, isPackaged: platform.isPackaged },
      paths, document: resolveMarkitdownRuntime(platform), docs: getBundledAssetsDir('docs'), configDir: CONFIG_DIR,
      legacyConfigDir: process.env.CRAFT_CONFIG_DIR }));
  `
  const result = Bun.spawnSync([process.execPath, '--eval', script], { cwd: checkout,
    env: { ...process.env, ...hints, U_AGENTS_IS_PACKAGED: 'true', CRAFT_IS_PACKAGED: 'true' }, stdout: 'pipe', stderr: 'pipe' })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  const proofLine = result.stdout.toString().split('\n').find(line => line.startsWith('RUNTIME_PROOF='))!
  const proof = JSON.parse(proofLine.slice('RUNTIME_PROOF='.length))
  expect(proof.platform).toEqual({ appRootPath: checkout, isPackaged: false })
  expect(proof.paths.piServerPath).toBe(join(checkout, 'packages/pi-agent-server/dist/index.js'))
  expect(proof.paths.claudeCliPath).toStartWith(join(checkout, 'node_modules/@anthropic-ai/'))
  expect(proof.paths.bundledRuntimePath).toBeTruthy()
  expect(proof.paths.interceptorBundlePath).toBe(join(checkout, 'packages/shared/src/unified-network-interceptor.ts'))
  expect(proof.document.scriptPath).toBe(join(checkout, 'apps/electron/resources/scripts/markitdown_cli.py'))
  expect(proof.docs).toBe(join(checkout, 'apps/electron/resources/docs'))
  expect(proof.configDir).toBe(process.env.U_AGENTS_CONFIG_DIR)
  expect(proof.legacyConfigDir).toBe(process.env.CRAFT_CONFIG_DIR)
  expect(JSON.stringify(proof)).not.toContain(foreign)
})
