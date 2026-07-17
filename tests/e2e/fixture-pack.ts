import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

const source = {
  pdfPath: 'assets/original.pdf',
  chapter: '第一章 聪明钱的看盘顺序',
  pageStart: 12,
  pageEnd: 14,
}

function candle(time: number, close: number) {
  return { time, open: close - 2, high: close + 8, low: close - 8, close, volume: 100 }
}

function bookQuestion(unitIndex: number, questionIndex: number) {
  return {
    id: `unit-${unitIndex + 1}-question-${questionIndex + 1}`,
    prompt: `知识单元 ${unitIndex + 1} 测验 ${questionIndex + 1}：证据不足时应该怎样处理？`,
    options: [
      { id: 'wait', label: '等待更多证据', explanation: '背景和价量证据不一致时不应强行预测。' },
      { id: 'long', label: '立即做多', explanation: '没有需求控制证据，不能直接得出上涨结论。' },
      { id: 'short', label: '立即做空', explanation: '没有供应控制证据，不能直接得出下跌结论。' },
    ],
    correctOptionId: 'wait',
    explanation: '威科夫方法要求根据市场自身行为形成证据链，证据不足时等待。',
    source,
  }
}

const units = Array.from({ length: 14 }, (_, unitIndex) => ({
  id: `unit-${unitIndex + 1}`,
  title: `知识单元 ${unitIndex + 1}`,
  summary: '先判断市场背景，再比较价格进展与成交量，最后决定证据是否足以支持方向判断。',
  source,
  excerpt: '根据市场自身行为判断供需关系，证据不足时保持等待。',
  keyPoints: ['先看背景', '比较努力与结果', '证据不足时等待'],
  bookQuestions: Array.from({ length: 20 }, (_, questionIndex) => bookQuestion(unitIndex, questionIndex)),
}))

const course = {
  version: 2,
  stages: [{ id: 'stage-1', title: '威科夫核心方法', goal: '掌握原书并迁移到真实行情', units }],
}

function replayCase(unitIndex: number, caseIndex: number) {
  const absoluteIndex = unitIndex * 3 + caseIndex
  const start = 1_700_000_000 + absoluteIndex * 1_000_000
  return {
    id: `unit-${unitIndex + 1}-case-${caseIndex + 1}`,
    unitId: `unit-${unitIndex + 1}`,
    title: `ETH 回放 ${String(absoluteIndex + 1).padStart(2, '0')}`,
    symbol: 'ETHUSDT',
    market: 'Binance USD-M Futures',
    timeframe: '1h',
    cutoffTime: start + 48 * 3_600,
    horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, index) => candle(start + index * 3_600, 3_000 + index)),
    futureCandles: Array.from({ length: 24 }, (_, index) => candle(start + (48 + index) * 3_600, 3_050 + index * 4)),
    candles4h: Array.from({ length: 24 }, (_, index) => candle(start - (24 - index) * 14_400, 2_980 + index * 3)),
    correctDirection: 'up',
    evidence: ['回测时成交量收缩', '上涨波的价格进展优于下跌波'],
    directionAnalysis: {
      up: '需求持续推动价格进展，标准答案为上涨。',
      down: '截止点前没有供应持续扩大的证据。',
      range: '需求已经产生方向性价格进展，不属于方向不明。',
    },
    actualOutcome: '未来 24 小时收盘上涨约 3%。',
    metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source,
  }
}

const marketCases = {
  version: 2,
  symbol: 'ETHUSDT',
  market: 'Binance USD-M Futures',
  generatedAt: '2026-07-17T00:00:00.000Z',
  cases: units.flatMap((_, unitIndex) => Array.from({ length: 3 }, (_, caseIndex) => replayCase(unitIndex, caseIndex))),
}

export async function createFixturePack() {
  const output = path.resolve('test-results', 'fixture.wkf')
  await mkdir(path.dirname(output), { recursive: true })
  const files = [
    { path: 'content/course.json', kind: 'course', bytes: Buffer.from(JSON.stringify(course)) },
    { path: 'content/market-cases.json', kind: 'market-cases', bytes: Buffer.from(JSON.stringify(marketCases)) },
    { path: 'assets/original.pdf', kind: 'pdf', bytes: Buffer.from('%PDF-1.4\n%%EOF') },
  ]
  const manifest = {
    format: 'weikefu-pack', formatVersion: 1, id: 'fixture', title: '端到端测试课程', version: '2.0.0', minAppVersion: '2.0.0',
    createdAt: '2026-07-17T00:00:00.000Z', sourceFingerprints: [],
    files: files.map((file) => ({ path: file.path, kind: file.kind, sha256: createHash('sha256').update(file.bytes).digest('hex') })),
  }
  const zip = new JSZip()
  for (const file of files) zip.file(file.path, file.bytes)
  zip.file('manifest.json', JSON.stringify(manifest))
  await writeFile(output, await zip.generateAsync({ type: 'nodebuffer' }))
  return output
}
