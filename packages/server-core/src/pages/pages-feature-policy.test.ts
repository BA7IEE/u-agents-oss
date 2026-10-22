// U-API: fixed policies reject alternate entry points before credentials, network or child processes.
import { expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveDecisionClient } from '@u-agents/shared/decisions/resolve'
import { normalizeDecisionLayerSettings } from '@u-agents/shared/decisions/settings'
import { testDecisionConnection } from '@u-agents/shared/decisions/status'
import { probeConfiguredDecisionServer } from '@u-agents/shared/decisions/health'
import { createPage, savePageContent, addPageGrant, loadPageConfig } from '@u-agents/shared/pages'
import { buildPageRefreshMatchers } from '../../../shared/src/pages/refresh'
import { createPagesScriptExecutor } from './script-executor-bridge'
import { executeScriptAction } from '@u-agents/shared/automations'
import { isPagesSharingEnabled } from '@u-agents/shared/feature-flags'

it('rejects enabled/skipGates/test/probe without reading a key or making a request', async () => {
  const fetcher = mock(async () => { throw new Error('unexpected fetch') })
  const key = mock(async () => 'fixture-key')
  const settings = normalizeDecisionLayerSettings({ enabled: true, provider: 'custom', baseUrl: 'https://outside.example' })
  const resolution = await resolveDecisionClient({ settings, skipGates: true, fetch: fetcher as never,
    credentialManager: { getDecisionApiKey: key, getLlmApiKey: key } as never })
  expect(resolution.ok).toBe(false)
  expect((await testDecisionConnection({ settings, fetch: fetcher as never })).ok).toBe(false)
  expect((await probeConfiguredDecisionServer(settings, { fetch: fetcher as never })).reachable).toBe(false)
  expect(fetcher).not.toHaveBeenCalled()
  expect(key).not.toHaveBeenCalled()
})

it('ignores the upstream environment switch for public publishing', () => {
  const old = process.env.CRAFT_FEATURE_PAGES_SHARING
  try { process.env.CRAFT_FEATURE_PAGES_SHARING = '1'; expect(isPagesSharingEnabled()).toBe(false) }
  finally { if (old === undefined) delete process.env.CRAFT_FEATURE_PAGES_SHARING; else process.env.CRAFT_FEATURE_PAGES_SHARING = old }
})

it('preserves legacy refresh config but refuses registration, grants and both execution paths', async () => {
  const root = mkdtempSync(join(tmpdir(), 'uapi-page-policy-'))
  try {
    const page = createPage(root, { name: 'Legacy', kind: 'interactive' })
    savePageContent(root, page.slug, '<p>fixture</p>')
    expect(() => addPageGrant(root, page.slug, { action: { kind: 'script', script: 'a.ts' } })).toThrow()
    expect(() => createPage(root, { name: 'New', kind: 'live', refresh: { cron: '*/5 * * * *', script: 'a.ts' } })).toThrow()
    const file = join(root, 'pages', page.slug, 'page.json')
    const legacy = { ...loadPageConfig(root, page.slug), refresh: { cron: '*/5 * * * *', script: 'a.ts' } }
    writeFileSync(file, JSON.stringify(legacy))
    const before = readFileSync(file, 'utf8')
    expect(buildPageRefreshMatchers(root)).toEqual([])
    expect(readFileSync(file, 'utf8')).toBe(before)
    const run = mock(async () => { throw new Error('must not spawn') })
    const executor = createPagesScriptExecutor({ workspaceRootPath: root, log: console as never, runScript: run })
    await expect(executor({ pageSlug: page.slug, script: 'a.ts' }, { signal: new AbortController().signal })).rejects.toThrow()
    const staleJob = await executeScriptAction({ type: 'script', page: page.slug, script: 'a.ts' }, { workspaceRootPath: root, env: {} })
    expect(staleJob.blocked).toBe(true)
    expect(run).not.toHaveBeenCalled()
  } finally { rmSync(root, { recursive: true, force: true }) }
})
