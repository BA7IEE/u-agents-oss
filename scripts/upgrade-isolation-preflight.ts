/** U-API: read-only preflight for a synthetic/remapped upgrade rehearsal, never production data. */
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export interface IsolationIssue { file: string; reason: string }
/** All copied files, symlinks and absolute path references must stay inside the rehearsal root. */
export function auditUpgradeSandbox(root: string): IsolationIssue[] {
  const issues: IsolationIssue[] = []
  if (lstatSync(root).isSymbolicLink()) return [{ file: root, reason: 'Sandbox root is a symlink' }]
  const canonicalRoot = realpathSync(root)
  const inside = (path: string) => {
    const rel = relative(canonicalRoot, resolve(path))
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
  }
  function scanValue(value: unknown, file: string, key = ''): void {
    if (typeof value === 'string' && isAbsolute(value) && !inside(value)) {
      issues.push({ file, reason: `External absolute path at ${key}` })
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => scanValue(item, file, `${key}[${i}]`))
    } else if (value && typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) scanValue(item, file, `${key}.${name}`)
    }
  }
  function visit(dir: string): void {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name)
      const stat = lstatSync(file)
      if (stat.isSymbolicLink()) {
        // Refuse all links, including dangling links; never follow into original data.
        issues.push({ file, reason: 'Symlinks must be removed from the rehearsal copy' })
      } else if (stat.isDirectory()) visit(file)
      else if (stat.isFile()) {
        if (/credentials|\.env(?:\.|$)/i.test(name)) issues.push({ file, reason: 'Credential stores are forbidden in a synthetic rehearsal' })
        if (['automations.json', 'hooks.json'].includes(name)) {
          issues.push({ file, reason: 'Background definitions must be excluded from the startup rehearsal' })
        }
        if (name.endsWith('.json') || name.endsWith('.jsonl')) {
          try {
            const text = readFileSync(file, 'utf8')
            const records = name.endsWith('.jsonl') ? text.split('\n').filter(Boolean).map(line => JSON.parse(line)) : [JSON.parse(text)]
            records.forEach(value => scanValue(value, file))
          } catch { issues.push({ file, reason: 'Cannot inspect structured data; fail closed' }) }
        }
      }
    }
  }
  visit(canonicalRoot)
  return issues
}

if (import.meta.main) {
  const root = process.argv[2]
  if (!root) throw new Error('Usage: bun scripts/upgrade-isolation-preflight.ts <synthetic-rehearsal-root>')
  const issues = auditUpgradeSandbox(root)
  console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2))
  process.exitCode = issues.length ? 1 : 0
}
