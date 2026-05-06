/**
 * M3-Sentry build-time DSN assertion — 防回归（详见 .planning/M3-SENTRY-DSN-ASSERTION-SPEC.md）
 *
 * M2 过渡期：缺 DSN 仅 warn 不 fail（GlitchTip 未部署）。
 * M3-4 GlitchTip 上线后改 fail：
 *   - electron-build-main.ts:assertSentryDsnForPackaging 把 console.warn 改 process.exit(1)
 *   - build-dmg.sh/build-linux.sh/build-win.ps1 已 export U_AGENTS_PACKAGING=1，无需改
 *
 * 关键不变量：
 *   1. assertSentryDsnForPackaging 函数存在 + 在 main() 第一步被调用
 *   2. 三个 build 脚本都 export U_AGENTS_PACKAGING=1
 *   3. assertSentryDsnForPackaging 检测三种 packaging 信号：argv --packaging /
 *      NODE_ENV=production / U_AGENTS_PACKAGING=1
 */

import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf-8')
}

describe('M3-Sentry — electron-build-main.ts assertion 函数', () => {
  let src: string

  it('reads scripts/electron-build-main.ts', () => {
    src = readSource('scripts/electron-build-main.ts')
    expect(src.length).toBeGreaterThan(0)
  })

  it('包含 assertSentryDsnForPackaging 函数定义', () => {
    const s = readSource('scripts/electron-build-main.ts')
    expect(s).toMatch(/function assertSentryDsnForPackaging/)
  })

  it('main() 函数调用 assertSentryDsnForPackaging', () => {
    const s = readSource('scripts/electron-build-main.ts')
    // main() 内部应有调用，loadEnvFile 之后
    const mainBody = s.split('async function main(')[1] ?? ''
    expect(mainBody).toMatch(/assertSentryDsnForPackaging\(\)/)
  })

  it('三种 packaging 信号都检测', () => {
    const s = readSource('scripts/electron-build-main.ts')
    // argv --packaging
    expect(s).toMatch(/process\.argv\.includes\(["']--packaging["']\)/)
    // NODE_ENV=production
    expect(s).toMatch(/NODE_ENV.*===\s*["']production["']/)
    // U_AGENTS_PACKAGING=1
    expect(s).toMatch(/U_AGENTS_PACKAGING.*===\s*["']1["']/)
  })

  it('SENTRY_ELECTRON_INGEST_URL 检查', () => {
    const s = readSource('scripts/electron-build-main.ts')
    expect(s).toMatch(/process\.env\.SENTRY_ELECTRON_INGEST_URL/)
  })

  it('M2 过渡期标识：用 console.warn 不用 process.exit', () => {
    const s = readSource('scripts/electron-build-main.ts')
    // assertSentryDsnForPackaging 函数体应只 warn 不 exit；
    // 当 M3-4 GlitchTip 上线后此测试需更新为 expect(...).toMatch(/process\.exit\(1\)/)
    const fnMatch = s.match(/function assertSentryDsnForPackaging[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fnMatch).toMatch(/console\.warn/)
    expect(fnMatch).not.toMatch(/process\.exit\(1\)/)
  })
})

describe('M3-Sentry — 三平台 build 脚本 packaging signal', () => {
  it('build-dmg.sh export U_AGENTS_PACKAGING=1', () => {
    const src = readSource('apps/electron/scripts/build-dmg.sh')
    expect(src).toMatch(/export U_AGENTS_PACKAGING=1/)
  })

  it('build-linux.sh export U_AGENTS_PACKAGING=1', () => {
    const src = readSource('apps/electron/scripts/build-linux.sh')
    expect(src).toMatch(/export U_AGENTS_PACKAGING=1/)
  })

  it('build-win.ps1 设置 $env:U_AGENTS_PACKAGING = "1"', () => {
    const src = readSource('apps/electron/scripts/build-win.ps1')
    expect(src).toMatch(/\$env:U_AGENTS_PACKAGING\s*=\s*["']1["']/)
  })

  it('build-win.ps1 含 SENTRY DSN warn（绕过 electron-build-main.ts）', () => {
    const src = readSource('apps/electron/scripts/build-win.ps1')
    expect(src).toMatch(/SENTRY_ELECTRON_INGEST_URL/)
    expect(src).toMatch(/Write-Warning.*\[build-warn\]/)
  })
})

describe('M3-Sentry — getBuildDefines 仍处理 SENTRY DSN（注入 esbuild）', () => {
  it('getBuildDefines 包含 SENTRY_ELECTRON_INGEST_URL', () => {
    const src = readSource('scripts/electron-build-main.ts')
    expect(src).toMatch(/SENTRY_ELECTRON_INGEST_URL/)
    // getBuildDefines 数组里应有
    const fnMatch = src.match(/function getBuildDefines[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fnMatch).toMatch(/SENTRY_ELECTRON_INGEST_URL/)
  })
})
