import { expect, test } from '@playwright/test'
import { completeBookQuiz, importFixturePack } from './helpers'

test('records an incorrect book answer and shows the fixed source-backed answer', async ({ page }) => {
  await importFixturePack(page)
  await page.getByRole('button', { name: '开始 知识单元 1' }).click()
  await page.getByRole('radio', { name: '立即做多' }).click()
  await page.getByRole('button', { name: '提交答案' }).click()

  await expect(page.getByText('回答错误')).toBeVisible()
  await expect(page.getByText('标准答案：等待更多证据')).toBeVisible()
  await expect(page.getByText('第一章 聪明钱的看盘顺序 · 第 12-14 页')).toBeVisible()
  await page.getByText('威科夫闯关').click()
  await expect(page.getByLabel('1 道活跃错题')).toBeVisible()
})

test('completes the three-step unit and unlocks the next unit', async ({ page }) => {
  await importFixturePack(page)
  await page.getByRole('button', { name: '开始 知识单元 1' }).click()
  await completeBookQuiz(page)

  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await expect(page.getByRole('radio', { name: '上涨' })).toBeVisible()
  await page.getByRole('button', { name: '1小时走势' }).click()
  await page.getByRole('radio', { name: '上涨' }).click()
  await page.getByRole('button', { name: '提交走势判断' }).click()
  await expect(page.getByText('实际结果标签：上涨')).toBeVisible()
  await expect(page.getByText('截止点前的合理判断：')).toContainText('等待／方向不明')
  await expect(page.getByText('未来 24 小时收盘上涨约 3%。')).toBeVisible()
  await page.getByRole('button', { name: '完成本单元' }).click()
  await expect(page.getByRole('heading', { name: '本单元完成' })).toBeVisible()
  await page.locator('.unit-complete').getByRole('button', { name: '返回闯关地图' }).click()
  await expect(page.getByRole('button', { name: '开始 知识单元 2' })).toBeEnabled()
})

test('keeps future candles hidden before submission and resumes progress after refresh', async ({ page }) => {
  await importFixturePack(page)
  await page.getByRole('button', { name: '开始 知识单元 1' }).click()
  await completeBookQuiz(page)
  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await page.reload()
  const replayTitle = page.locator('.replay-question-header h2')
  await expect(replayTitle).toHaveText(/ETH 回放 0[1-3]/)
  const firstCaseTitle = await replayTitle.innerText()
  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await page.getByRole('radio', { name: '下跌' }).click()
  await page.getByRole('button', { name: '提交走势判断' }).click()
  await expect(page.getByText('未来 24 小时收盘上涨约 3%。')).toBeVisible()
  await page.getByRole('button', { name: '换一个案例继续' }).click()
  await expect(replayTitle).not.toHaveText(firstCaseTitle)
})
