/**
 * M2 安全 fix 单测 — LLM API key 长度边界（防大文本误粘贴）
 *
 * 防御场景：用户把整个 .env 文件 / 一个 PDF / 一段日志误粘贴到 API key 输入框，
 * 触发存储侧无穷膨胀或 backend 异常。详见 .planning/M2-SECURITY-CLEANUP-SPEC.md。
 *
 * 关键常量：MIN_LLM_API_KEY_LENGTH=1 / MAX_LLM_API_KEY_LENGTH=4096
 * （manager.ts:15-16，由 §3.7 #34 marker 标记）
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { CredentialManager } from '../manager.ts'
import type { CredentialBackend } from '../backends/types.ts'

class MockBackend implements CredentialBackend {
  name = 'mock'
  readonly priority = 100
  available = true
  store = new Map<string, unknown>()

  async isAvailable() { return true }
  async get(id: { type: string; connectionSlug?: string }) {
    return this.store.get(JSON.stringify(id)) as never
  }
  async set(id: { type: string; connectionSlug?: string }, cred: unknown) {
    this.store.set(JSON.stringify(id), cred)
  }
  async delete(id: { type: string; connectionSlug?: string }) {
    return this.store.delete(JSON.stringify(id))
  }
  async list() { return [] }
  async clear() { this.store.clear() }
}

describe('CredentialManager.setLlmApiKey — M2 长度边界', () => {
  let manager: CredentialManager
  let backend: MockBackend

  beforeEach(async () => {
    manager = new CredentialManager()
    backend = new MockBackend()
    // Inject mock backend before initialization completes
    ;(manager as unknown as { backends: CredentialBackend[]; writeBackend: CredentialBackend; initialized: boolean })
      .backends = [backend]
    ;(manager as unknown as { writeBackend: CredentialBackend }).writeBackend = backend
    ;(manager as unknown as { initialized: boolean }).initialized = true
  })

  describe('MIN_LLM_API_KEY_LENGTH=1（拒绝空）', () => {
    it('空字符串拒绝', async () => {
      await expect(manager.setLlmApiKey('test-conn', '')).rejects.toThrow(/empty/i)
    })

    it('单字符接受（边界值 1）', async () => {
      await manager.setLlmApiKey('test-conn', 'x')
      const stored = await manager.getLlmApiKey('test-conn')
      expect(stored).toBe('x')
    })
  })

  describe('MAX_LLM_API_KEY_LENGTH=4096（拒绝过长）', () => {
    it('4096 字符接受（边界值）', async () => {
      const key = 'a'.repeat(4096)
      await manager.setLlmApiKey('test-conn', key)
      const stored = await manager.getLlmApiKey('test-conn')
      expect(stored).toBe(key)
    })

    it('4097 字符拒绝（超出 1）', async () => {
      const key = 'a'.repeat(4097)
      await expect(manager.setLlmApiKey('test-conn', key)).rejects.toThrow(/too long.*4097.*max 4096/i)
    })

    it('10MB 大文本拒绝（防 .env / PDF 误粘贴）', async () => {
      const key = 'x'.repeat(10_000_000)
      await expect(manager.setLlmApiKey('test-conn', key)).rejects.toThrow(/too long/i)
    })

    it('错误信息包含"file"提示（提示用户原因）', async () => {
      const key = 'x'.repeat(5000)
      try {
        await manager.setLlmApiKey('test-conn', key)
        throw new Error('should have thrown')
      } catch (err) {
        expect((err as Error).message).toContain('file')
      }
    })
  })

  describe('合法范围内不影响 backend', () => {
    it('正常长度 API key (40 字符) 持久化', async () => {
      const key = 'sk-test-' + 'a'.repeat(32)
      await manager.setLlmApiKey('test-conn', key)
      expect(await manager.getLlmApiKey('test-conn')).toBe(key)
    })

    it('删除合法 API key', async () => {
      await manager.setLlmApiKey('test-conn', 'sk-test')
      expect(await manager.deleteLlmApiKey('test-conn')).toBe(true)
      expect(await manager.getLlmApiKey('test-conn')).toBeNull()
    })
  })
})
