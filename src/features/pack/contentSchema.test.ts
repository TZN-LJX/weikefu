import { describe, expect, it } from 'vitest'
import { CourseSchema, MarketCasesSchema, validateChallengeContent } from './contentSchema'

const source = {
  pdfPath: 'assets/original.pdf',
  chapter: '第一章 聪明钱的看盘顺序',
  pageStart: 10,
  pageEnd: 12,
}

const trainingSource = {
  ...source,
  pageStart: 17,
  pageEnd: 25,
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

function marketCase(unitId: string, index: number, symbol: 'ETHUSDT' | 'BTCUSDT' = 'ETHUSDT') {
  const start = 1_700_000_000 + index * 1_000_000
  return {
    id: `${unitId}-${symbol}-case-${index}`,
    unitId,
    title: `${symbol} 回放 ${index}`,
    symbol,
    market: 'Binance USD-M Futures',
    timeframe: '1h',
    cutoffTime: start + 48 * 3_600,
    horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, candleIndex) => candle(start + candleIndex * 3_600)),
    futureCandles: Array.from({ length: 24 }, (_, candleIndex) => candle(start + (48 + candleIndex) * 3_600, 3_000 + candleIndex * 4)),
    candles4h: Array.from({ length: 24 }, (_, candleIndex) => candle(start - (24 - candleIndex) * 14_400)),
    correctDirection: 'up',
    cutoffJudgment: 'range' as 'up' | 'down' | 'range' | undefined,
    annotations: [{ time: start + 40 * 3_600, description: '放量突破' }],
    evidence: ['回测时供应收缩', '突破后价格能够继续进展'],
    directionAnalysis: {
      up: '需求保持控制，未来一天偏向上涨。',
      down: '截止点前没有持续扩大的供应。',
      range: '价格已经出现方向性需求证据。',
    },
    actualOutcome: '未来一天收盘上涨约 3%。',
    metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source,
  }
}

function validContent() {
  const standardUnits = Array.from({ length: 14 }, (_, unitIndex) => ({
    id: `unit-${unitIndex + 1}`,
    title: `知识单元 ${unitIndex + 1}`,
    summary: '根据市场自身行为判断供需关系，并严格按照背景、证据和结论的顺序分析。',
    source,
    excerpt: '市场自身的行为提供判断供需变化所需要的信息。',
    keyPoints: ['先看背景', '比较努力与结果', '证据不足时等待'],
    bookQuestions: Array.from({ length: 20 }, (_, questionIndex) => question(unitIndex * 20 + questionIndex)),
  }))
  const trainingUnit = {
    id: 'stage-8-real-case-training',
    mode: 'case-training' as 'standard' | 'case-training',
    trainingCaseCount: 100,
    title: '真实案例集训',
    summary: '连续完成100个不重复真实案例。',
    source: trainingSource,
    excerpt: '只看技术指标无法得到真正的答案，我们这里介绍一下聪明钱的看图顺序：',
    excerptPage: 19,
    keyPoints: ['先看背景', '比较价量形态', '给出失效条件'],
    bookQuestions: [] as ReturnType<typeof question>[],
  }
  const course = {
    version: 2,
    stages: [
      { id: 'stage-1', title: '威科夫核心方法', goal: '掌握原书并迁移到真实行情', units: standardUnits },
      { id: 'stage-8-case-training', title: '真实案例集训', goal: '连续判断不重复的真实行情', units: [trainingUnit] },
    ],
  }
  const standardCases = standardUnits.flatMap((unit, unitIndex) => (
    Array.from({ length: 3 }, (_, caseIndex) => marketCase(unit.id, unitIndex * 3 + caseIndex))
  ))
  const trainingCases = Array.from({ length: 100 }, (_, caseIndex) => (
    marketCase(trainingUnit.id, standardCases.length + caseIndex, caseIndex < 50 ? 'ETHUSDT' : 'BTCUSDT')
  ))
  const marketCases = {
    version: 2,
    symbol: 'ETHUSDT',
    symbols: ['ETHUSDT', 'BTCUSDT'],
    market: 'Binance USD-M Futures',
    generatedAt: '2026-07-17T00:00:00.000Z',
    cases: [...standardCases, ...trainingCases],
  }
  return { course, marketCases, standardUnits, trainingUnit, trainingCases }
}

describe('challenge content schemas', () => {
  it('accepts 15 units and 142 ETH/BTC cases with legacy units defaulted to standard mode', () => {
    const { course, marketCases } = validContent()

    const result = validateChallengeContent(course, marketCases)
    const units = result.course.stages.flatMap((stage) => stage.units)

    expect(units).toHaveLength(15)
    expect(units[0].mode).toBe('standard')
    expect(units[0].bookQuestions).toHaveLength(20)
    expect(units.at(-1)?.mode).toBe('case-training')
    expect(result.marketCases.cases).toHaveLength(142)
    expect(result.marketCases.cases.filter((item) => item.symbol === 'BTCUSDT')).toHaveLength(50)
    expect(result.marketCases.symbols).toEqual(['ETHUSDT', 'BTCUSDT'])
  })

  it('accepts a legacy market pack with only the top-level symbol field', () => {
    const { marketCases } = validContent()
    const legacyMarketCases = { ...marketCases, symbols: undefined }

    expect(MarketCasesSchema.parse(legacyMarketCases).symbol).toBe('ETHUSDT')
  })

  it('preserves exact excerpt pages and structured replay annotations', () => {
    const { course, marketCases } = validContent()
    Object.assign(course.stages[0].units[0], { excerptPage: 19 })

    const result = validateChallengeContent(course, marketCases)
    expect(result.course.stages[0].units[0].excerptPage).toBe(19)
    expect(result.marketCases.cases[0].annotations).toEqual([
      { time: marketCases.cases[0].visibleCandles[40].time, description: '放量突破' },
    ])
    expect(result.marketCases.cases[0].cutoffJudgment).toBe('range')
  })

  it('rejects a standard unit with fewer than 20 book questions', () => {
    const { course } = validContent()
    course.stages[0].units[0].bookQuestions.pop()

    expect(() => CourseSchema.parse(course)).toThrow('标准单元至少需要 20 道原书题')
  })

  it('requires a training unit to declare exactly 100 cases', () => {
    const { course, trainingUnit } = validContent()
    trainingUnit.trainingCaseCount = 99

    expect(() => CourseSchema.parse(course)).toThrow('真实案例集训必须声明 100 个案例')
  })

  it('requires a training unit to contain zero book questions', () => {
    const { course, trainingUnit } = validContent()
    trainingUnit.bookQuestions.push(question(999))

    expect(() => CourseSchema.parse(course)).toThrow('真实案例集训不能包含原书测验')
  })

  it('requires exactly 15 units', () => {
    const { course } = validContent()
    course.stages.pop()

    expect(() => CourseSchema.parse(course)).toThrow('课程必须包含 15 个知识单元')
  })

  it('requires the final unit to use case-training mode', () => {
    const { course, trainingUnit } = validContent()
    trainingUnit.mode = 'standard'
    trainingUnit.bookQuestions = Array.from({ length: 20 }, (_, index) => question(1_000 + index))

    expect(() => CourseSchema.parse(course)).toThrow('课程最后一个单元必须是真实案例集训')
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

  it('requires at least three market cases for every standard course unit', () => {
    const { course, marketCases } = validContent()
    const reassigned = marketCases.cases.find((item) => item.unitId === 'unit-14')
    if (!reassigned) throw new Error('fixture case missing')
    reassigned.unitId = 'unit-13'
    expect(() => validateChallengeContent(course, marketCases)).toThrow('unit-14 至少需要 3 个市场案例')
  })

  it('requires exactly 100 cases for the training unit', () => {
    const { course, marketCases, trainingUnit } = validContent()
    const caseIndex = marketCases.cases.findIndex((item) => item.unitId === trainingUnit.id)
    marketCases.cases.splice(caseIndex, 1)

    expect(() => validateChallengeContent(course, marketCases)).toThrow('必须包含 100 个真实案例')
  })

  it('requires 50 ETHUSDT and 50 BTCUSDT training cases', () => {
    const { course, marketCases, trainingCases } = validContent()
    trainingCases[49].symbol = 'BTCUSDT'

    expect(() => validateChallengeContent(course, marketCases)).toThrow('必须包含 50 个 ETHUSDT 和 50 个 BTCUSDT')
  })

  it('requires every case ID to be unique', () => {
    const { marketCases } = validContent()
    marketCases.cases[1].id = marketCases.cases[0].id

    expect(() => MarketCasesSchema.parse(marketCases)).toThrow('案例 ID 必须唯一')
  })

  it('requires every symbol and cutoff time pair to be unique', () => {
    const { marketCases } = validContent()
    marketCases.cases[1].cutoffTime = marketCases.cases[0].cutoffTime
    marketCases.cases[1].horizonEndTime = marketCases.cases[0].horizonEndTime
    marketCases.cases[1].visibleCandles = marketCases.cases[0].visibleCandles
    marketCases.cases[1].futureCandles = marketCases.cases[0].futureCandles
    marketCases.cases[1].candles4h = marketCases.cases[0].candles4h
    marketCases.cases[1].annotations = marketCases.cases[0].annotations

    expect(() => MarketCasesSchema.parse(marketCases)).toThrow('标的和截止时间必须唯一')
  })

  it('requires training cases to include a cutoff judgment', () => {
    const { course, marketCases, trainingCases } = validContent()
    trainingCases[0].cutoffJudgment = undefined

    expect(() => validateChallengeContent(course, marketCases)).toThrow('真实案例必须包含截止点判断')
  })

  it('requires training cases to include 1-8 annotations', () => {
    const { course, marketCases, trainingCases } = validContent()
    trainingCases[0].annotations = []

    expect(() => validateChallengeContent(course, marketCases)).toThrow('真实案例必须包含 1-8 个标注')
  })

  it.each([
    'recentReturn',
    'priorReturn',
    'rangePosition',
    'volumeRatio',
    'return24h',
    'minInterimReturn',
    'maxInterimReturn',
    '截止时间 1700000000',
  ])('rejects learner-facing training text containing internal data: %s', (forbiddenText) => {
    const { course, marketCases, trainingCases } = validContent()
    trainingCases[0].evidence[0] = `内部数据 ${forbiddenText}`

    expect(() => validateChallengeContent(course, marketCases)).toThrow('学习者文本不能包含内部字段名或 Unix 时间戳')
  })

  it.each(['directionAnalysis', 'actualOutcome'] as const)(
    'checks every learner-facing training text field: %s',
    (field) => {
      const { course, marketCases, trainingCases } = validContent()
      if (field === 'directionAnalysis') trainingCases[0].directionAnalysis.up = '内部 return24h'
      else trainingCases[0].actualOutcome = '内部 return24h'

      expect(() => validateChallengeContent(course, marketCases)).toThrow('学习者文本不能包含内部字段名或 Unix 时间戳')
    },
  )

  it.each(['recentReturn', '1700000000'])(
    'rejects internal data in a learner-facing training case title: %s',
    (forbiddenText) => {
      const { course, marketCases, trainingCases } = validContent()
      trainingCases[0].title = `真实案例 ${forbiddenText}`

      expect(() => validateChallengeContent(course, marketCases)).toThrow('学习者文本不能包含内部字段名或 Unix 时间戳')
    },
  )
})
