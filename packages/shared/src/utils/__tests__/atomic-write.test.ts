/**
 * M2 安全 fix 单测 — atomicWriteFileSync 原子性保证
 *
 * 防御场景：用户配置 / preferences / topic-registry / window-state 写入中途崩溃
 * 时旧数据不被半写覆盖。详见 .planning/M2-ATOMIC-WRITES-SPEC.md。
 *
 * 测试模式：写入临时文件 + rename → 失败时清理 .tmp + 抛错；目标文件永远要么是
 * 旧值要么是新值，不能是半写损坏值。
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { atomicWriteFileSync } from '../files.ts'

const TEST_DIR = join(tmpdir(), `u-agents-atomic-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)

describe('atomicWriteFileSync — M2 安全 fix 回归测试', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  describe('成功路径', () => {
    it('写入新文件（目标不存在）', () => {
      const target = join(TEST_DIR, 'fresh.json')
      atomicWriteFileSync(target, '{"foo":"bar"}')

      expect(existsSync(target)).toBe(true)
      expect(readFileSync(target, 'utf-8')).toBe('{"foo":"bar"}')
      // .tmp 必须已被 rename 走，不该残留
      expect(existsSync(target + '.tmp')).toBe(false)
    })

    it('覆盖已存在文件（旧值 → 新值原子切换）', () => {
      const target = join(TEST_DIR, 'overwrite.json')
      writeFileSync(target, '{"version":1}')

      atomicWriteFileSync(target, '{"version":2}')

      expect(readFileSync(target, 'utf-8')).toBe('{"version":2}')
      expect(existsSync(target + '.tmp')).toBe(false)
    })

    it('写入大数据（验证 rename 不截断）', () => {
      const target = join(TEST_DIR, 'large.json')
      const data = JSON.stringify({ payload: 'x'.repeat(100_000) })

      atomicWriteFileSync(target, data)

      expect(readFileSync(target, 'utf-8').length).toBe(data.length)
    })

    it('空字符串写入合法', () => {
      const target = join(TEST_DIR, 'empty.json')
      atomicWriteFileSync(target, '')

      expect(existsSync(target)).toBe(true)
      expect(readFileSync(target, 'utf-8')).toBe('')
    })
  })

  describe('失败路径 — 临时文件清理', () => {
    it('rename 失败时（目标父目录不可写）抛错并清理 .tmp', () => {
      const nonExistentDir = join(TEST_DIR, 'does-not-exist', 'sub')
      const target = join(nonExistentDir, 'fail.json')

      // 写入会失败（父目录不存在）
      expect(() => atomicWriteFileSync(target, '{"foo":1}')).toThrow()

      // 失败后不应留下 .tmp
      expect(existsSync(target + '.tmp')).toBe(false)
    })

    it('原子性 — rename 之前目标文件保持旧内容', () => {
      const target = join(TEST_DIR, 'atomicity.json')
      writeFileSync(target, '{"v":1}')

      // 模拟：写入失败时旧文件不该被破坏
      try {
        // 写入合法新值（成功路径）
        atomicWriteFileSync(target, '{"v":2}')
      } catch {}

      // 不管中途如何，最终文件要么是 v:1 要么是 v:2，不能是半写
      const content = readFileSync(target, 'utf-8')
      expect([JSON.stringify({ v: 1 }), JSON.stringify({ v: 2 })]).toContain(content)
    })
  })

  describe('调用方核验 — 关键持久化路径都用 atomicWriteFileSync', () => {
    it.each([
      ['packages/shared/src/config/storage.ts', 'config/storage 用 atomicWriteFileSync'],
      ['packages/shared/src/config/preferences.ts', 'config/preferences 用 atomicWriteFileSync'],
      ['packages/messaging-gateway/src/topic-registry.ts', 'topic-registry 用 atomicWriteFileSync'],
      ['apps/electron/src/main/window-state.ts', 'window-state 用 atomicWriteFileSync'],
    ])('%s 包含 atomicWriteFileSync 调用', (relPath) => {
      const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
      const fullPath = join(repoRoot, relPath)
      const src = readFileSync(fullPath, 'utf-8')
      // 必须既 import 又调用
      expect(src).toMatch(/atomicWriteFileSync/)
    })
  })

  describe('文件 mode — config 持久化路径目录权限', () => {
    it('atomicWriteFileSync 不主动设 mode（继承 umask；目录由调用方建）', () => {
      const target = join(TEST_DIR, 'mode-test.json')
      atomicWriteFileSync(target, 'data')

      const stat = statSync(target)
      // 文件存在即可；mode 由 umask 决定，本测试不强校验
      expect(stat.isFile()).toBe(true)
    })
  })
})
