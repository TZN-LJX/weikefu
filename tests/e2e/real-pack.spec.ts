import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import JSZip from 'jszip'

const packPath = process.env.WEIKEFU_REAL_PACK

async function readPackContent() {
  if (!packPath) throw new Error('WEIKEFU_REAL_PACK is not set')
  const zip = await JSZip.loadAsync(await readFile(packPath))
  return {
    course: JSON.parse(await zip.file('content/course.json')!.async('text')),
    marketCases: JSON.parse(await zip.file('content/market-cases.json')!.async('text')),
  }
}

test('imports the real pack and completes its first source-backed challenge', async ({ page }) => {
  test.skip(!packPath, 'real private pack path is not configured')
  const { course, marketCases } = await readPackContent()
  const firstUnit = course.stages.flatMap((stage: { units: unknown[] }) => stage.units)[0]
  const questionByPrompt = new Map(firstUnit.bookQuestions.map((question: { prompt: string }) => [question.prompt, question]))
  const firstCase = marketCases.cases.find((item: { unitId: string }) => item.unitId === firstUnit.id)
  const directionLabels = { up: '上涨', down: '下跌', range: '震荡／方向不明' }

  await page.goto('./#/')
  await page.getByLabel('选择 .wkf 文件').setInputFiles(packPath!)
  await expect(page.getByRole('heading', { name: '闯关地图' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: `开始 ${firstUnit.title}` }).click()

  for (let index = 0; index < 10; index += 1) {
    const prompt = await page.locator('.choice-card h2').innerText()
    const question = questionByPrompt.get(prompt) as { correctOptionId: string; options: { id: string; label: string }[] }
    const correctLabel = question.options.find((option) => option.id === question.correctOptionId)!.label
    await page.getByRole('radio', { name: correctLabel, exact: true }).click()
    await page.getByRole('button', { name: '提交答案' }).click()
    await expect(page.getByText('回答正确')).toBeVisible()
    await page.getByRole('button', { name: index === 9 ? '查看本轮结果' : '下一题' }).click()
  }
  await page.getByRole('button', { name: '进入ETH历史回放' }).click()
  await expect(page.getByRole('heading', { name: firstCase.title })).toBeVisible()
  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await page.getByRole('radio', { name: directionLabels[firstCase.correctDirection as keyof typeof directionLabels], exact: true }).click()
  await page.getByRole('button', { name: '提交走势判断' }).click()
  await expect(page.getByText(`标准答案：${directionLabels[firstCase.correctDirection as keyof typeof directionLabels]}`)).toBeVisible()
  await expect(page.getByText(firstCase.actualOutcome)).toBeVisible()
  await page.getByRole('button', { name: '完成本单元' }).click()
  await expect(page.getByRole('heading', { name: '本单元完成' })).toBeVisible()
})

test('renders the original PDF from the real private pack', async ({ page }) => {
  test.skip(!packPath, 'real private pack path is not configured')
  await page.goto('./#/')
  await page.getByLabel('选择 .wkf 文件').setInputFiles(packPath!)
  await expect(page.getByRole('heading', { name: '闯关地图' })).toBeVisible({ timeout: 30_000 })
  await page.goto('./#/pdf?page=6')
  const canvas = page.locator('.pdf-canvas-scroll canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => canvas.evaluate((item) => (item as HTMLCanvasElement).width * (item as HTMLCanvasElement).height)).toBeGreaterThan(100_000)
})
