import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const source = {
  pdfPath: 'assets/original.pdf',
  chapter: '第一章 聪明钱的看盘顺序',
  pageStart: 12,
  pageEnd: 14,
}

const trainingSource = {
  ...source,
  pageStart: 17,
  pageEnd: 25,
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

const standardUnits = Array.from({ length: 14 }, (_, unitIndex) => ({
  id: `unit-${unitIndex + 1}`,
  title: `知识单元 ${unitIndex + 1}`,
  summary: '先判断市场背景，再比较价格进展与成交量，最后决定证据是否足以支持方向判断。',
  source,
  excerpt: '根据市场自身行为判断供需关系，证据不足时保持等待。',
  excerptPage: 12,
  keyPoints: ['先看背景', '比较努力与结果', '证据不足时等待'],
  bookQuestions: Array.from({ length: 20 }, (_, questionIndex) => bookQuestion(unitIndex, questionIndex)),
}))

const trainingUnit = {
  id: 'stage-8-real-case-training',
  mode: 'case-training',
  trainingCaseCount: 100,
  title: '真实案例集训',
  summary: '连续完成100个不重复真实案例。',
  source: trainingSource,
  excerpt: '只看技术指标无法得到真正的答案，我们这里介绍一下聪明钱的看图顺序：',
  excerptPage: 19,
  keyPoints: ['先看背景', '比较价量形态', '给出失效条件'],
  bookQuestions: [],
}

const course = {
  version: 2,
  stages: [
    { id: 'stage-1', title: '威科夫核心方法', goal: '掌握原书并迁移到真实行情', units: standardUnits },
    { id: 'stage-8-case-training', title: '真实案例集训', goal: '连续判断不重复的真实行情', units: [trainingUnit] },
  ],
}

function replayCase(unitId: string, id: string, absoluteIndex: number, symbol: 'ETHUSDT' | 'BTCUSDT' = 'ETHUSDT') {
  const start = 1_700_000_000 + absoluteIndex * 1_000_000
  const correctDirection = ['up', 'down', 'range'][absoluteIndex % 3] as 'up' | 'down' | 'range'
  const metrics = correctDirection === 'up'
    ? { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 }
    : correctDirection === 'down'
      ? { return24h: -0.03, minInterimReturn: -0.04, maxInterimReturn: 0.005 }
      : { return24h: 0.01, minInterimReturn: -0.02, maxInterimReturn: 0.02 }
  const futureStep = correctDirection === 'up' ? 4 : correctDirection === 'down' ? -4 : 0.5
  return {
    id,
    unitId,
    title: `${symbol} 回放 ${String(absoluteIndex + 1).padStart(3, '0')}`,
    symbol,
    market: 'Binance USD-M Futures',
    timeframe: '1h',
    cutoffTime: start + 48 * 3_600,
    horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, index) => candle(start + index * 3_600, 3_000 + index)),
    futureCandles: Array.from({ length: 24 }, (_, index) => candle(start + (48 + index) * 3_600, 3_050 + index * futureStep)),
    candles4h: Array.from({ length: 24 }, (_, index) => candle(start - (24 - index) * 14_400, 2_980 + index * 3)),
    correctDirection,
    cutoffJudgment: 'range',
    annotations: [
      { time: start + 40 * 3_600, description: 'A柱需求扩大' },
      { time: start + 44 * 3_600, description: 'B柱回调供应收缩' },
    ],
    evidence: ['回测时成交量收缩，但突破尚未得到确认', '上涨波与下跌波都没有形成可持续的单边优势'],
    directionAnalysis: {
      up: '上涨需要有效突破、需求跟随和回测确认，截止点前证据仍不足。',
      down: '下跌需要供应持续扩大和向下价格进展，截止点前没有出现。',
      range: '截止点判断为等待／方向不明，供需尚未形成可持续的单边优势。',
    },
    actualOutcome: correctDirection === 'up'
      ? '未来一天收盘上涨约 3%。'
      : correctDirection === 'down'
        ? '未来一天收盘下跌约 3%。'
        : '未来一天保持在震荡区间。',
    metrics,
    source,
  }
}

const standardCases = standardUnits.flatMap((unit, unitIndex) => (
  Array.from({ length: 3 }, (_, caseIndex) => replayCase(
    unit.id,
    `${unit.id}-case-${caseIndex + 1}`,
    unitIndex * 3 + caseIndex,
  ))
))

const trainingCases = Array.from({ length: 100 }, (_, caseIndex) => {
  const symbol = caseIndex % 2 === 0 ? 'ETHUSDT' : 'BTCUSDT'
  return replayCase(
    trainingUnit.id,
    `${trainingUnit.id}-${symbol.toLowerCase()}-${String(caseIndex + 1).padStart(3, '0')}`,
    standardCases.length + caseIndex,
    symbol,
  )
})

const marketCases = {
  version: 2,
  symbol: 'ETHUSDT',
  symbols: ['ETHUSDT', 'BTCUSDT'],
  market: 'Binance USD-M Futures',
  generatedAt: '2026-07-17T00:00:00.000Z',
  cases: [...standardCases, ...trainingCases],
}

export async function createFixturePack() {
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
  return {
    name: 'fixture.wkf',
    mimeType: 'application/octet-stream',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  }
}
