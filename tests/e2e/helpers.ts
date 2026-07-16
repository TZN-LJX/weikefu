import type { Page } from '@playwright/test'
import { createFixturePack } from './fixture-pack'

export async function importFixturePack(page: Page) {
  await page.goto('./#/')
  await page.getByLabel('选择 .wkf 文件').setInputFiles(await createFixturePack())
  await page.getByRole('heading', { name: '今日任务' }).waitFor()
}
