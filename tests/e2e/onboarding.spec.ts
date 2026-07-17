import { expect, test } from '@playwright/test'
import { createFixturePack } from './fixture-pack'

test('imports a private pack locally before opening learning routes', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByRole('heading', { name: '导入私人学习包' })).toBeVisible()
  await expect(page.getByText('今日任务')).toHaveCount(0)
  await expect(page.getByText('AI接口设置')).toHaveCount(0)
  await page.getByLabel('选择 .wkf 文件').setInputFiles(await createFixturePack())
  await expect(page.getByRole('heading', { name: '闯关地图' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '知识单元 1', exact: true })).toBeVisible()
})
