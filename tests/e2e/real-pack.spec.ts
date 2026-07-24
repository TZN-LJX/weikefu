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

test('contains 100 spaced ETH/BTC training cases without changing the original 42', async () => {
  test.skip(!packPath, 'real private pack path is not configured')
  const { course, marketCases } = await readPackContent()
  const units = course.stages.flatMap((stage: { units: { id: string; mode?: string }[] }) => stage.units)
  const trainingUnit = units.at(-1)
  const trainingCases = marketCases.cases.filter((item: { unitId: string }) => item.unitId === trainingUnit.id)
  const originalCases = marketCases.cases.filter((item: { unitId: string }) => item.unitId !== trainingUnit.id)

  expect(units).toHaveLength(15)
  expect(trainingUnit.mode).toBe('case-training')
  expect(originalCases).toHaveLength(42)
  expect(trainingCases).toHaveLength(100)
  for (const symbol of ['ETHUSDT', 'BTCUSDT']) {
    const symbolCases = trainingCases
      .filter((item: { symbol: string }) => item.symbol === symbol)
      .sort((left: { cutoffTime: number }, right: { cutoffTime: number }) => left.cutoffTime - right.cutoffTime)
    expect(symbolCases).toHaveLength(50)
    expect(symbolCases.filter((item: { correctDirection: string }) => item.correctDirection === 'up')).toHaveLength(17)
    expect(symbolCases.filter((item: { correctDirection: string }) => item.correctDirection === 'down')).toHaveLength(17)
    expect(symbolCases.filter((item: { correctDirection: string }) => item.correctDirection === 'range')).toHaveLength(16)
    expect(symbolCases.slice(1).every((item: { cutoffTime: number }, index: number) => item.cutoffTime - symbolCases[index].cutoffTime >= 7 * 86_400)).toBe(true)
  }
  const originalEthCutoffs = originalCases.filter((item: { symbol: string }) => item.symbol === 'ETHUSDT').map((item: { cutoffTime: number }) => item.cutoffTime)
  expect(trainingCases
    .filter((item: { symbol: string }) => item.symbol === 'ETHUSDT')
    .every((item: { cutoffTime: number }) => originalEthCutoffs.every((cutoff: number) => Math.abs(item.cutoffTime - cutoff) >= 7 * 86_400)))
    .toBe(true)
})

test('imports the real pack and completes its first source-backed challenge', async ({ page }) => {
  test.skip(!packPath, 'real private pack path is not configured')
  const { course, marketCases } = await readPackContent()
  const firstUnit = course.stages.flatMap((stage: { units: unknown[] }) => stage.units)[0]
  const questionByPrompt = new Map(firstUnit.bookQuestions.map((question: { prompt: string }) => [question.prompt, question]))
  const unitCases = marketCases.cases.filter((item: { unitId: string }) => item.unitId === firstUnit.id)
  const directionLabels = { up: '上涨', down: '下跌', range: '震荡／方向不明' }

  await page.goto('./#/')
  await page.getByLabel('选择 .wkf 文件').setInputFiles(packPath!)
  await expect(page.getByRole('heading', { name: '闯关地图' })).toBeVisible({ timeout: 30_000 })
  const trainingUnit = course.stages.flatMap((stage: { units: { title: string }[] }) => stage.units).at(-1)
  await expect(page.getByRole('button', { name: new RegExp(trainingUnit.title) })).toBeEnabled()
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
  const visibleCaseTitle = await page.locator('.replay-question-header h2').innerText()
  const firstCase = unitCases.find((item: { title: string }) => item.title === visibleCaseTitle)
  if (!firstCase) throw new Error(`Visible replay case not found in pack: ${visibleCaseTitle}`)
  await expect(page.getByText('未来走势已隐藏')).toBeVisible()
  await page.getByRole('radio', { name: directionLabels[firstCase.correctDirection as keyof typeof directionLabels], exact: true }).click()
  await page.getByRole('button', { name: '提交走势判断' }).click()
  await expect(page.getByText(`实际结果标签：${directionLabels[firstCase.correctDirection as keyof typeof directionLabels]}`)).toBeVisible()
  await expect(page.locator('.answer-feedback')).not.toContainText(/recentReturn|priorReturn|rangePosition|volumeRatio|\b1\d{9}\b/)
  await expect(page.locator('.market-chart-wrap')).not.toHaveAttribute('data-annotation-count', '0')
  await expect(page.getByText(firstUnit.excerpt)).toBeVisible()
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
  await expect.poll(
    async () => canvas.evaluate((item) => (item as HTMLCanvasElement).width * (item as HTMLCanvasElement).height),
    { timeout: 60_000 },
  ).toBeGreaterThan(100_000)
})
