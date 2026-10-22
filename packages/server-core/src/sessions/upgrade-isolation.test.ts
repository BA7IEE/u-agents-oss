// U-API: synthetic fixtures only; production-root sentinels must remain untouched.
import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditUpgradeSandbox } from '../../../../scripts/upgrade-isolation-preflight'
import { resolveConfigDir } from '../../../shared/src/config/paths'

test('config override precedence ignores blank overrides', () => {
  expect(resolveConfigDir({ U_AGENTS_CONFIG_DIR: '/copy', CRAFT_CONFIG_DIR: '/legacy' }, '/fake')).toBe('/copy')
  expect(resolveConfigDir({ U_AGENTS_CONFIG_DIR: ' ', CRAFT_CONFIG_DIR: '/legacy' }, '/fake')).toBe('/legacy')
  expect(resolveConfigDir({}, '/fake')).toBe('/fake/.u-agents')
})

test('preflight rejects escaped records, external workspaces, links, credentials and background definitions', () => {
  const root = mkdtempSync(join(tmpdir(), 'uagents-isolation-'))
  const original = join(root, 'original'); const copy = join(root, 'copy')
  mkdirSync(original); mkdirSync(copy)
  const sentinel = join(original, 'sentinel.json')
  writeFileSync(sentinel, '{"unchanged":true}')
  try {
    expect(auditUpgradeSandbox(copy)).toEqual([])
    writeFileSync(join(copy, 'config.json'), JSON.stringify({ workspaces: [{ rootPath: original }] }))
    writeFileSync(join(copy, 'session.jsonl'), JSON.stringify({ attachments: [{ path: sentinel }] }) + '\n')
    writeFileSync(join(copy, 'automations.json'), '{}')
    writeFileSync(join(copy, 'credentials.enc'), 'synthetic')
    symlinkSync(original, join(copy, 'escape'))
    const issues = auditUpgradeSandbox(copy)
    expect(issues.filter(i => i.reason.includes('External absolute path'))).toHaveLength(2)
    expect(issues.some(i => i.reason.includes('Symlinks'))).toBe(true)
    expect(issues.some(i => i.reason.includes('Credential'))).toBe(true)
    expect(issues.some(i => i.reason.includes('Background'))).toBe(true)
    expect(readFileSync(sentinel, 'utf8')).toBe('{"unchanged":true}')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
