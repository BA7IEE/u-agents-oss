/**
 * M3 死路径清理 — 防回归测试（详见 .planning/M3-DEAD-PATH-CLEANUP-SPEC.md 修订版）
 *
 * 实施时 grep 发现 CRAFT_DEBUG 有 14+ 处真消费方（跨 packages/server, shared,
 * agent, server-core），是上游全局调试 flag 不是死路径——决策**保留**。
 * 真删除的是：CRAFT_SCRIPTS / CRAFT_AGENT_VERSION / 4 个 ENTRY/DOC_PATH（0 消费方）。
 * craft-clipboard 5 处临时文件名重命名为 u-agents-clipboard（防与上游 craft-agents-oss
 * 同机并装时 tmp 文件冲突）。
 */

import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf-8')
}

describe('M3 死路径清理 — main/index.ts', () => {
  let mainSrc: string

  it('reads main/index.ts', () => {
    mainSrc = readSource('apps/electron/src/main/index.ts')
    expect(mainSrc.length).toBeGreaterThan(0)
  })

  describe('已删除的 6 处 CRAFT_* env（0 消费方）', () => {
    it.each([
      ['CRAFT_SCRIPTS'],
      ['CRAFT_COMMANDS_ENTRY'],
      ['CRAFT_CLI_ENTRY'],
      ['CRAFT_COMMANDS_DOC_PATH'],
      ['CRAFT_CLI_DOC_PATH'],
      ['CRAFT_AGENT_VERSION'],
    ])('main/index.ts 不再设置 process.env.%s', (env) => {
      const src = readSource('apps/electron/src/main/index.ts')
      expect(src).not.toMatch(new RegExp(`process\\.env\\.${env}\\s*=`))
    })

    it.each([
      ['craft-agents-commands'],
      ['craft-cli'],
    ])('main/index.ts 不再引用 packages/%s', (pkg) => {
      const src = readSource('apps/electron/src/main/index.ts')
      expect(src).not.toMatch(new RegExp(`packages.*${pkg}`))
    })
  })

  describe('保留的 CRAFT_DEBUG（决策依据：14+ 处真消费方）', () => {
    it('main/index.ts 仍设置 CRAFT_DEBUG（dev 模式）', () => {
      const src = readSource('apps/electron/src/main/index.ts')
      expect(src).toMatch(/process\.env\.CRAFT_DEBUG\s*=/)
    })

    it('packages/shared/src/utils/debug.ts 仍读 CRAFT_DEBUG', () => {
      const src = readSource('packages/shared/src/utils/debug.ts')
      expect(src).toMatch(/CRAFT_DEBUG/)
    })

    it('packages/server-core/src/runtime/platform-headless.ts 仍读 CRAFT_DEBUG', () => {
      const src = readSource('packages/server-core/src/runtime/platform-headless.ts')
      expect(src).toMatch(/CRAFT_DEBUG/)
    })
  })
})

describe('M3 死路径清理 — utils/files.ts craft-clipboard 重命名', () => {
  it('utils/files.ts 0 处 craft-clipboard 残留', () => {
    const src = readSource('packages/shared/src/utils/files.ts')
    expect(src).not.toMatch(/craft-clipboard/)
  })

  it('utils/files.ts 5 处 u-agents-clipboard', () => {
    const src = readSource('packages/shared/src/utils/files.ts')
    const matches = src.match(/u-agents-clipboard/g) ?? []
    expect(matches.length).toBe(5)
  })
})

describe('M3 死路径清理 — system.ts craft 字面量门控', () => {
  it('system.ts Craft CLI 表行被 FEATURE_FLAGS.craftAgentsCli 三元门控（B 选项 — 保留代码）', () => {
    const src = readSource('packages/shared/src/prompts/system.ts')
    // 必须含三元门控（不能裸出 craft 字面量）
    expect(src).toMatch(/FEATURE_FLAGS\.craftAgentsCli\s*\?/)
    // 三元的 truthy 分支才含 Craft CLI
    expect(src).toMatch(/FEATURE_FLAGS\.craftAgentsCli\s*\?\s*`[\s\S]*Craft CLI/)
  })

  it('feature-flags.ts craftAgentsCli 默认 false', () => {
    const src = readSource('packages/shared/src/feature-flags.ts')
    // isUAgentsCliEnabled 默认 return false
    expect(src).toMatch(/isUAgentsCliEnabled[\s\S]*?return\s+false/)
  })
})
