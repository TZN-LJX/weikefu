import { expect, test } from '@playwright/test'
import { importFixturePack } from './helpers'

for (const viewport of [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
  test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await importFixturePack(page)
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    await expect(page.getByRole('heading', { name: '今日任务' })).toBeVisible()
  })
}
