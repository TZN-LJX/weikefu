import { describe, expect, it } from 'vitest'
import { CourseSchema, MarketCasesSchema, validateChallengeContent } from './contentSchema'

const source = {
  pdfPath: 'assets/original.pdf',
  chapter: '第一章 聪明钱的看盘顺序',
  pageStart: 10,
  pageEnd: 12,
}

function question(index: number) {
  return {
    id: `question-${index}`,
    prompt: `第 ${index} 题：当前证据说明什么？`,
    options: [
      { id: 'a', label: '需求占优', explanation: '上涨进展与成交量支持需求。' },
      { id: 'b', label: '供应占优', explanation: '下跌进展与成交量支持供应。' },
      { id: 'c', label: '证据不足', explanation: '供需证据冲突时不能强行判断。' },
    ],
    correctOptionId: 'c',
    explanation: '必须先看背景，再比较努力与结果。',
    source,
  }
}

function candle(time: number, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

function marketCase(unitId: string, index: number) {
  const start = 1_700_000_000 + index * 1_000_000
  return {
    id: `${unitId}-case-${index}`,
    unitId,
    title: `ETH 回放 ${index}`,
    symbol: 'ETHUSDT',
    market: 'Binance USD-M Futures',
    timeframe: '1h',
    cutoffTime: start + 48 * 3_600,
    horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, candleIndex) => candle(start + candleIndex * 3_600)),
    futureCandles: Array.from({ length: 24 }, (_, candleIndex) => candle(start + (48 + candleIndex) * 3_600, 3_000 + candleIndex * 4)),
    candles4h: Array.from({ length: 24 }, (_, candleIndex) => candle(start - (24 - candleIndex) * 14_400)),
    correctDirection: 'up',
    evidence: ['回测时供应收缩', '突破后价格能够继续进展'],
    directionAnalysis: {
      up: '需求保持控制，未来 24 小时上涨。',
      down: '截止点前没有持续扩大的供应。',
      range: '价格已经出现方向性需求证据。',
    },
    actualOutcome: '未来 24 小时收盘上涨约 3%。',
    metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source,
  }
}

function validContent() {
  const units = Array.from({ length: 14 }, (_, unitIndex) => ({
    id: `unit-${unitIndex + 1}`,
    title: `知识单元 ${unitIndex + 1}`,
    summary: '根据市场自身行为判断供需关系，并严格按照背景、证据和结论的顺序分析。',
    source,
    excerpt: '市场自身的行为提供判断供需变化所需要的信息。',
    keyPoints: ['先看背景', '比较努力与结果', '证据不足时等待'],
    bookQuestions: Array.from({ length: 20 }, (_, questionIndex) => question(unitIndex * 20 + questionIndex)),
  }))
  const course = { version: 2, stages: [{ id: 'stage-1', title: '威科夫核心方法', goal: '掌握原书并迁移到真实行情', units }] }
  const marketCases = {
    version: 2,
    symbol: 'ETHUSDT',
    market: 'Binance USD-M Futures',
    generatedAt: '2026-07-17T00:00:00.000Z',
    cases: units.flatMap((unit, unitIndex) => Array.from({ length: 3 }, (_, caseIndex) => marketCase(unit.id, unitIndex * 3 + caseIndex))),
  }
  return { course, marketCases }
}

describe('challenge content schemas', () => {
  it('accepts 14 units with 20 source-linked book questions each', () => {
    const { course } = validContent()
    const result = CourseSchema.parse(course)
    expect(result.stages.flatMap((stage) => stage.units)).toHaveLength(14)
    expect(result.stages[0].units[0].bookQuestions).toHaveLength(20)
    expect(result.stages[0].units[0].bookQuestions[0].options[0].explanation).toBeTruthy()
  })

  it('preserves exact excerpt pages and structured replay annotations', () => {
    const { course, marketCases } = validContent()
    Object.assign(course.stages[0].units[0], { excerptPage: 19 })
    Object.assign(marketCases.cases[0], {
      cutoffJudgment: 'range',
      annotations: [{ time: marketCases.cases[0].visibleCandles[10].time, description: '放量突破' }],
    })

    const result = validateChallengeContent(course, marketCases)
    expect(result.course.stages[0].units[0].excerptPage).toBe(19)
    expect(result.marketCases.cases[0].annotations).toEqual([
      { time: marketCases.cases[0].visibleCandles[10].time, description: '放量突破' },
    ])
    expect(result.marketCases.cases[0].cutoffJudgment).toBe('range')
  })

  it('rejects a book question whose correct option is missing', () => {
    const { course } = validContent()
    course.stages[0].units[0].bookQuestions[0].correctOptionId = 'missing'
    expect(() => CourseSchema.parse(course)).toThrow('正确选项不存在')
  })

  it('requires exactly 24 hidden future 1h candles', () => {
    const { marketCases } = validContent()
    marketCases.cases[0].futureCandles.pop()
    expect(() => MarketCasesSchema.parse(marketCases)).toThrow()
  })

  it('rejects a direction that conflicts with the objective 24h metrics', () => {
    const { marketCases } = validContent()
    marketCases.cases[0].correctDirection = 'down'
    expect(() => MarketCasesSchema.parse(marketCases)).toThrow('标准方向与收益率指标不一致')
  })

  it('requires at least three market cases for every course unit', () => {
    const { course, marketCases } = validContent()
    const reassigned = marketCases.cases.find((item) => item.unitId === 'unit-14')
    if (!reassigned) throw new Error('fixture case missing')
    reassigned.unitId = 'unit-13'
    expect(() => validateChallengeContent(course, marketCases)).toThrow('unit-14 至少需要 3 个 ETH 案例')
  })
})
