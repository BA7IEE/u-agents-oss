/**
 * M2 安全 fix 防回归测试 — TLS 严格化 + dir 0o700
 *
 * 这两项修复是删除上游已有的不安全配置（TLS strict）或新增 fs 权限位（dir 0o700）。
 * 单测不能直接执行（涉及 main process / electron / preload runtime），用源码 grep
 * 防止以后被无心 revert。详见：
 *   - .planning/M2-TLS-FIX-SPEC.md
 *   - .planning/M2-SECURITY-CLEANUP-SPEC.md
 *
 * §3.7 关联：#31a/#31b TLS marker；#33a/#33b/#33c dir 0o700 marker
 */

import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf-8')
}

describe('M2 TLS 严格化（防回归）', () => {
  it.each([
    ['apps/electron/src/main/handlers/workspace.ts', 'workspace handler'],
    ['apps/electron/src/preload/bootstrap.ts', 'preload bootstrap'],
  ])('%s 代码中无 tlsRejectUnauthorized: false 字段（%s）', (relPath) => {
    const src = readSource(relPath)
    // 排除注释行（以 // 开头）；只检查实际代码字段
    const codeOnly = src
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
    // 上游历史曾是 `tlsRejectUnauthorized: false` —— 我们的 fix 是删除该字段
    expect(codeOnly).not.toMatch(/tlsRejectUnauthorized:\s*false/)
  })

  it('TLS strict marker 三处全在', () => {
    const workspaceSrc = readSource('apps/electron/src/main/handlers/workspace.ts')
    const bootstrapSrc = readSource('apps/electron/src/preload/bootstrap.ts')

    // workspace.ts 1 处
    const workspaceMatches = workspaceSrc.match(/U-API:\s*TLS strict mode/g) ?? []
    expect(workspaceMatches.length).toBeGreaterThanOrEqual(1)

    // bootstrap.ts 2 处（initialWorkspaceClient + setClientFactory）
    const bootstrapMatches = bootstrapSrc.match(/U-API:\s*TLS strict mode/g) ?? []
    expect(bootstrapMatches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('M2 dir 0o700（防回归）', () => {
  it.each([
    ['packages/shared/src/config/watcher.ts'],
    ['packages/shared/src/config/storage.ts'],
    ['apps/electron/src/main/window-state.ts'],
  ])('%s 用 mkdirSync({ mode: 0o700 })', (relPath) => {
    const src = readSource(relPath)
    // 必须含 mode: 0o700（防 multi-user 机器上 ~/.u-agents/ 被同机用户读到 token）
    expect(src).toMatch(/mkdirSync\([^)]+mode:\s*0o700/s)
  })

  it('dir 0o700 marker 三处全在', () => {
    const expected = [
      'packages/shared/src/config/watcher.ts',
      'packages/shared/src/config/storage.ts',
      'apps/electron/src/main/window-state.ts',
    ]
    for (const path of expected) {
      const src = readSource(path)
      expect(src).toMatch(/U-API:\s*dir mode 0o700/)
    }
  })
})

describe('M2 fix 完整性 — §3.7 marker grep', () => {
  it('credential-manager LLM API key 长度常量定义', () => {
    const src = readSource('packages/shared/src/credentials/manager.ts')
    expect(src).toMatch(/MIN_LLM_API_KEY_LENGTH\s*=\s*1/)
    expect(src).toMatch(/MAX_LLM_API_KEY_LENGTH\s*=\s*4096/)
    expect(src).toMatch(/U-API:\s*LLM API key length bounds/)
  })

  it('atomicWriteFileSync helper 4 处持久化路径接入', () => {
    const expected = [
      'packages/shared/src/config/storage.ts',
      'packages/shared/src/config/preferences.ts',
      'packages/messaging-gateway/src/topic-registry.ts',
      'apps/electron/src/main/window-state.ts',
    ]
    for (const path of expected) {
      const src = readSource(path)
      expect(src).toMatch(/atomicWriteFileSync/)
    }
  })
})

// U-API: browser tool 默认关闭防回归（v24 G1.F4.1 决策；详见 .planning/04-feature-cuts.md §九类）
describe('browserToolEnabled 默认 false（v24 G1.F4.1 防回归）', () => {
  it('config-defaults.json browserToolEnabled = false', () => {
    const json = readSource('apps/electron/resources/config-defaults.json')
    const parsed = JSON.parse(json) as { defaults?: { browserToolEnabled?: boolean } }
    expect(parsed.defaults?.browserToolEnabled).toBe(false)
  })

  it('storage.ts FALLBACK_DEFAULTS.browserToolEnabled = false', () => {
    const src = readSource('packages/shared/src/config/storage.ts')
    // 匹配 defaults: { ... browserToolEnabled: false ... }（允许中间任何字段）
    expect(src).toMatch(/browserToolEnabled:\s*false/)
    // 反向：确保没有 browserToolEnabled: true（防止 git auto-merge 时漏盘）
    expect(src).not.toMatch(/browserToolEnabled:\s*true/)
  })

  it('U-API: marker 在 storage.ts browserToolEnabled 附近', () => {
    const src = readSource('packages/shared/src/config/storage.ts')
    // marker 应当包围 browserToolEnabled: false 这一行
    expect(src).toMatch(/U-API:\s*browser tool 默认关闭/)
  })
})
