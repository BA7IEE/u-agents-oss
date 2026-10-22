// U-API: exercise the actual refresh -> atomic config write -> reload path with a fake token.
import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('refresh persists explicit image overrides and manual selection through reload', () => {
  const root = mkdtempSync(join(tmpdir(), 'uapi-refresh-storage-'))
  try {
    writeFileSync(join(root, 'config.json'), JSON.stringify({ workspaces: [], defaultLlmConnection: 'u-api', llmConnections: [{
      slug: 'u-api', name: 'U-API', providerType: 'pi_compat', authType: 'api_key', baseUrl: 'https://token.u-studio.cn/v1',
      defaultModel: 'manual', models: ['old', { id: 'manual', supportsImages: false }],
      customEndpoint: { api: 'openai-completions', supportsImages: false },
    }] }))
    const script = `
      import { initModelRefreshService } from ${JSON.stringify(join(import.meta.dir, 'index.ts'))};
      import { getLlmConnection, modelSupportsImages } from '@u-agents/shared/config';
      globalThis.fetch = async (url) => {
        if (String(url) !== 'https://token.u-studio.cn/v1/models') throw Error('unexpected route');
        return new Response(JSON.stringify({ data: [
          { id: 'new', recommended: true, supported_endpoint_types: ['openai'] },
          { id: 'manual', supported_endpoint_types: ['openai'] }
        ] }), { status: 200 });
      };
      const service = initModelRefreshService(async () => ({ apiKey: 'synthetic-test-key' }));
      await service.refreshConnection('u-api');
      const saved = getLlmConnection('u-api');
      if (saved.defaultModel !== 'manual' || modelSupportsImages(saved, 'manual') !== false) throw Error('capability drift');
    `
    const child = Bun.spawnSync([process.execPath, '--eval', script], {
      cwd: join(import.meta.dir, '../../../..'), env: { ...process.env, U_AGENTS_CONFIG_DIR: root, CRAFT_CONFIG_DIR: root },
      stdout: 'pipe', stderr: 'pipe',
    })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
    const saved = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8')).llmConnections[0]
    expect(saved.defaultModel).toBe('manual')
    expect(saved.customEndpoint.supportsImages).toBe(false)
    expect(saved.models.find((m: any) => m.id === 'manual').supportsImages).toBe(false)
    expect(saved.models).not.toContain('old')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
