import { expect, test } from '@playwright/test'
import { importFixturePack } from './helpers'

for (const viewport of [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
  test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await importFixturePack(page)
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    await expect(page.getByRole('heading', { name: '闯关地图' })).toBeVisible()
    await page.getByRole('button', { name: /真实案例集训/ }).click()
    await expect(page.getByLabel('真实案例集训 1/100')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}
