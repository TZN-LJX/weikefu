import { expect, test } from '@playwright/test'
import path from 'node:path'
import { completeBookQuiz, importFixturePack } from './helpers'

test('captures required viewports and verifies the chart canvas is nonblank', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one browser is sufficient for visual artifacts')
  await page.setViewportSize({ width: 360, height: 800 })
  await importFixturePack(page)
  for (const viewport of [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('./#/')
    await page.screenshot({ path: path.resolve('test-results', 'visual', `challenge-map-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }

  await page.setViewportSize({ width: 412, height: 915 })
  await page.getByRole('button', { name: '开始 知识单元 1' }).click()
  await completeBookQuiz(page)
  const settingsBox = await page.getByTitle('设置').boundingBox()
  const lockBox = await page.getByText('未来走势已隐藏').boundingBox()
  expect(settingsBox && lockBox && (
    settingsBox.x + settingsBox.width <= lockBox.x || lockBox.x + lockBox.width <= settingsBox.x ||
    settingsBox.y + settingsBox.height <= lockBox.y || lockBox.y + lockBox.height <= settingsBox.y
  )).toBeTruthy()
  const canvases = page.locator('canvas')
  await expect(canvases).not.toHaveCount(0)
  const paintedPixels = await canvases.evaluateAll((items) => items.reduce((total, item) => {
    const canvas = item as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return total
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let painted = 0
    for (let index = 3; index < data.length; index += 64) if (data[index] > 0) painted += 1
    return total + painted
  }, 0))
  expect(paintedPixels).toBeGreaterThan(100)
  await page.screenshot({ path: path.resolve('test-results', 'visual', 'replay-412x915.png'), fullPage: true })
})
