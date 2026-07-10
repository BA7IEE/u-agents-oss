import { describe, expect, it } from 'bun:test'
import { resolveMarkitdownRuntime } from './markitdown'

describe('resolveMarkitdownRuntime', () => {
  it('prefers explicit server-build environment paths', () => {
    const runtime = resolveMarkitdownRuntime(
      { appRootPath: '/app', resourcesPath: '/resources', isPackaged: true },
      { CRAFT_SCRIPTS: '/app/resources/scripts', U_AGENTS_UV: '/app/resources/bin/uv' },
    )

    expect(runtime).toEqual({
      uvPath: '/app/resources/bin/uv',
      scriptPath: '/app/resources/scripts/markitdown_cli.py',
    })
  })

  it('uses the Electron resources base when configured', () => {
    const runtime = resolveMarkitdownRuntime(
      { appRootPath: '/repo', resourcesPath: '/electron-resources', isPackaged: false },
      { U_AGENTS_RESOURCES_BASE: '/repo/apps/electron', U_AGENTS_UV: '/repo/uv' },
    )

    expect(runtime.scriptPath).toBe('/repo/apps/electron/resources/scripts/markitdown_cli.py')
  })

  it('resolves the packaged Electron fallback layout', () => {
    const runtime = resolveMarkitdownRuntime(
      {
        appRootPath: '/Applications/U Agents.app/Contents/Resources/app.asar',
        resourcesPath: '/Applications/U Agents.app/Contents/Resources',
        isPackaged: true,
      },
      {},
    )

    expect(runtime).toEqual({
      uvPath: 'uv',
      scriptPath: '/Applications/U Agents.app/Contents/Resources/app/resources/scripts/markitdown_cli.py',
    })
  })

  it('resolves the monorepo development fallback layout', () => {
    const runtime = resolveMarkitdownRuntime(
      { appRootPath: '/repo', resourcesPath: '/electron-resources', isPackaged: false },
      {},
    )

    expect(runtime.scriptPath).toBe('/repo/apps/electron/resources/scripts/markitdown_cli.py')
  })
})
