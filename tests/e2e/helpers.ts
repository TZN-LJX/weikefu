import type { Page } from '@playwright/test'
import { createFixturePack } from './fixture-pack'

export async function importFixturePack(page: Page) {
  await page.goto('./#/')
  await page.getByLabel('选择 .wkf 文件').setInputFiles(await createFixturePack())
  await page.getByRole('heading', { name: '闯关地图' }).waitFor()
}

export async function completeBookQuiz(page: Page) {
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('radio', { name: '等待更多证据' }).click()
    await page.getByRole('button', { name: '提交答案' }).click()
    await page.getByRole('button', { name: index === 9 ? '查看本轮结果' : '下一题' }).click()
  }
  await page.getByRole('button', { name: '进入ETH历史回放' }).click()
}
