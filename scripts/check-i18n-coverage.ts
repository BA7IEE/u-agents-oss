#!/usr/bin/env bun
/**
 * check-i18n-coverage.ts — CI-safe i18n coverage check.
 *
 * Scans packages/ + apps/ for `t('xxx')` / `i18n.t('xxx')` / `<Trans i18nKey="xxx">`
 * literal-key callsites and verifies every referenced key exists in
 * packages/shared/src/i18n/locales/en.json.
 *
 * Dynamic keys (template literals like `t(\`status.${id}\`)`) are skipped —
 * those surface via i18next's runtime missing-key warnings. We only catch
 * literal keys to keep the regex simple and avoid false positives.
 *
 * Scope: complements check-i18n-parity.ts (which validates locale-to-locale
 * symmetry). Coverage closes the parity blind spot — a merge that drops the
 * same 50 keys from every locale file passes parity but breaks the UI;
 * coverage detects it as "callsite references key not in en.json".
 *
 * Exits 0 when every literal key resolves; 1 with diagnostics otherwise.
 *
 * U-API: M2.5 #5 CI dead refs fix — v0.9.1 上游 release 引入 lint:i18n:coverage
 * package.json 入口但漏了实现文件（C13 模式）。本仓库自实现。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const REPO_ROOT = resolve(import.meta.dir ?? new URL('.', import.meta.url).pathname, '..')
const EN_LOCALE = resolve(REPO_ROOT, 'packages/shared/src/i18n/locales/en.json')
const SCAN_DIRS = ['packages', 'apps'].map(d => resolve(REPO_ROOT, d))

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  'build',
  '__tests__',
  'tests',  // shared/tests/
])

const SCAN_EXTENSIONS = ['.ts', '.tsx']

// Match literal keys only — skip template literals (which contain ${...})
// Patterns:
//   t('foo.bar')        / t("foo.bar")
//   i18n.t('foo.bar')   / i18n.t("foo.bar")
//   <Trans i18nKey="foo.bar">  / <Trans i18nKey='foo.bar'>
const PATTERNS: ReadonlyArray<RegExp> = [
  /\bt\(\s*(['"])([\w.-]+)\1/g,             // t('key')
  /\bi18n\.t\(\s*(['"])([\w.-]+)\1/g,       // i18n.t('key')
  /<Trans[^>]*?\bi18nKey=(['"])([\w.-]+)\1/g, // <Trans i18nKey="key">
]

function* walk(dir: string): Generator<string> {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return }

  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue
    if (name.startsWith('.')) continue

    const full = join(dir, name)
    let stat
    try { stat = statSync(full) } catch { continue }

    if (stat.isDirectory()) {
      yield* walk(full)
    } else if (SCAN_EXTENSIONS.some(ext => name.endsWith(ext))) {
      yield full
    }
  }
}

function extractKeys(content: string): { key: string; pattern: string }[] {
  const found: { key: string; pattern: string }[] = []
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      // match[2] is the key (group 1 is quote)
      found.push({ key: match[2]!, pattern: pattern.source })
    }
  }
  return found
}

const en = JSON.parse(readFileSync(EN_LOCALE, 'utf-8')) as Record<string, string>
const enKeys = new Set(Object.keys(en))

const missing = new Map<string, string[]>() // key -> [file:line, ...]
let totalCallsites = 0

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    let content: string
    try { content = readFileSync(file, 'utf-8') } catch { continue }

    const refs = extractKeys(content)
    if (!refs.length) continue
    totalCallsites += refs.length

    for (const { key } of refs) {
      // i18next pluralization: `t('foo.count', { count: 1 })` resolves at runtime
      // to `foo.count_one` / `foo.count_other`. Treat as covered if either the
      // base key OR any plural variant exists.
      if (enKeys.has(key)) continue
      const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other']
      const hasPluralVariant = PLURAL_SUFFIXES.some(suffix => enKeys.has(`${key}${suffix}`))
      if (hasPluralVariant) continue

      const lines = content.slice(0, content.indexOf(key)).split('\n').length
      const rel = file.replace(REPO_ROOT + '/', '')
      if (!missing.has(key)) missing.set(key, [])
      missing.get(key)!.push(`${rel}:${lines}`)
    }
  }
}

if (missing.size > 0) {
  console.error(`i18n coverage check failed: ${missing.size} keys referenced in code but not in en.json`)
  let shown = 0
  for (const [key, callsites] of missing) {
    if (shown >= 20) {
      console.error(`  ... and ${missing.size - shown} more`)
      break
    }
    console.error(`  "${key}" — ${callsites.length} callsite(s), e.g. ${callsites[0]}`)
    shown++
  }
  process.exit(1)
}

console.log(`i18n coverage OK (${totalCallsites} literal callsites checked, ${enKeys.size} keys in en.json)`)
