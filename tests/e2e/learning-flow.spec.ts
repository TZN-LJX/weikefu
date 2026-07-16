import { expect, test } from '@playwright/test'
import { importFixturePack } from './helpers'

test('moves from lesson to evidence-first correction without revealing the answer', async ({ page }) => {
  await importFixturePack(page)
  await page.getByRole('button', { name: '开始今日训练' }).click()
  await expect(page.getByRole('heading', { name: '单笔账户风险' })).toBeVisible()
  await page.getByRole('button', { name: '进入本节检验' }).click()
  await page.getByRole('button', { name: '提高杠杆' }).click()
  await page.getByRole('button', { name: '提交判断' }).click()
  await expect(page.getByRole('heading', { name: '重新检查证据' })).toBeVisible()
  await expect(page.getByText('风险金额固定为账户权益的 1%')).toBeVisible()
  await expect(page.getByText('相应缩小仓位')).toHaveCount(0)
})

test('keeps future candles hidden until a complete replay submission', async ({ page }) => {
  await importFixturePack(page)
  await page.goto('./#/replay/case-1')
  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await expect(page.getByRole('button', { name: '揭示后续 5 根K线' })).toHaveCount(0)
  await page.getByLabel('4小时市场背景').selectOption('bearish')
  await page.getByLabel('1小时结构').selectOption('distribution')
  await page.getByLabel('回测缩量').check()
  await page.getByLabel('不交易').check()
  await page.getByLabel('判断失效条件').fill('放量突破阻力并回测成功')
  await page.getByRole('button', { name: '提交整体判断' }).click()
  await expect(page.getByRole('button', { name: '揭示后续 5 根K线' })).toBeVisible()
})
