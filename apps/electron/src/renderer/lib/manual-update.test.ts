// U-API: regression for the visible/manual HTTPS update fallback and failure action.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MANUAL_UPDATE_URL, openManualUpdatePage } from './manual-update'

describe('manual update fallback', () => {
  it('opens the fixed HTTPS U Studio download page exactly once', async () => {
    const opened: string[] = []

    await openManualUpdatePage(async (url) => {
      opened.push(url)
    })

    expect(MANUAL_UPDATE_URL).toBe('https://agents.u-studio.cn')
    expect(opened).toEqual([MANUAL_UPDATE_URL])
  })

  it('stays wired to the settings button and update failure toast', () => {
    const settingsPage = readFileSync(join(import.meta.dir, '../pages/settings/AppSettingsPage.tsx'), 'utf8')
    const updateHook = readFileSync(join(import.meta.dir, '../hooks/useUpdateChecker.ts'), 'utf8')

    expect(settingsPage).toContain('onClick={updateChecker.openManualUpdate}')
    expect(settingsPage).toContain("t(\"settings.about.manualDownload\")")
    expect(updateHook).toContain("label: t('settings.about.manualDownload')")
    expect(updateHook).toContain('onClick: openManualUpdate')
  })
})
