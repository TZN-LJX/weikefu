import { expect, test } from '@playwright/test'
import { importFixturePack } from './helpers'

test('blocks incomplete trades and creates a journal after a valid risk-capped plan', async ({ page }) => {
  await importFixturePack(page)
  await page.goto('./#/simulation')
  await page.getByRole('button', { name: '计算并提交模拟订单' }).click()
  await expect(page.getByText('需要先判断 4 小时市场背景')).toBeVisible()

  await page.getByLabel('入场价').fill('3000')
  await page.getByLabel('止损价').fill('2970')
  await page.getByLabel('目标价').fill('3090')
  await page.getByLabel('4小时市场背景').selectOption('需求背景')
  await page.getByLabel('1小时结构').selectOption('吸筹右侧')
  await page.getByLabel('回测缩量').check()
  await page.getByLabel('入场确认条件').fill('出现需求柱')
  await page.getByLabel('判断失效条件').fill('放量跌破支撑')
  await page.getByLabel('我已检查不交易理由').check()
  await page.getByRole('button', { name: '计算并提交模拟订单' }).click()
  await expect(page.getByRole('heading', { name: '完成交易前复盘' })).toBeVisible()
})
