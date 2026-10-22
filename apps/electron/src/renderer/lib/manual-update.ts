// U-API: manual update fallback must stay on the HTTPS U Studio download page.
export const MANUAL_UPDATE_URL = 'https://agents.u-studio.cn'

export async function openManualUpdatePage(openUrl: (url: string) => Promise<void>): Promise<void> {
  await openUrl(MANUAL_UPDATE_URL)
}
