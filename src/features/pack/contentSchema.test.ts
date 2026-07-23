import { describe, expect, it } from 'vitest'
import { createChallengeContentFixture, createFixtureBookQuestion } from '../../test/fixtures/challengeContent'
import { CourseSchema, MarketCasesSchema, validateChallengeContent } from './contentSchema'

const validContent = createChallengeContentFixture

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

  it('requires declared market symbols to be unique', () => {
    const { marketCases } = validContent()
    marketCases.symbols = ['ETHUSDT', 'ETHUSDT', 'BTCUSDT']

    expect(() => MarketCasesSchema.parse(marketCases)).toThrow('市场包 symbols 标的必须唯一')
  })

  it('requires declared market symbols to exactly match case symbols', () => {
    const { marketCases } = validContent()
    marketCases.symbols = ['ETHUSDT']

    expect(() => MarketCasesSchema.parse(marketCases)).toThrow('市场包 symbols 必须与案例标的一致')
  })

  it('preserves exact excerpt pages and structured replay annotations', () => {
    const { course, marketCases } = validContent()
    Object.assign(course.stages[0].units[0], { excerptPage: 19 })

    const result = validateChallengeContent(course, marketCases)
    expect(result.course.stages[0].units[0].excerptPage).toBe(19)
    expect(result.marketCases.cases[0].annotations).toEqual([
      { time: marketCases.cases[0].visibleCandles[40].time, description: 'A柱需求扩大' },
      { time: marketCases.cases[0].visibleCandles[44].time, description: 'B柱回调供应收缩' },
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
    trainingUnit.bookQuestions.push(createFixtureBookQuestion(99, 999))

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
    trainingUnit.bookQuestions = Array.from({ length: 20 }, (_, index) => createFixtureBookQuestion(100, index))

    expect(() => CourseSchema.parse(course)).toThrow('课程最后一个单元必须是真实案例集训')
  })

  it('requires the preceding 14 units to be standard', () => {
    const { course, trainingUnit } = validContent()
    course.stages[0].units[13] = {
      ...trainingUnit,
      id: 'extra-case-training',
      title: '额外案例集训',
    }

    expect(() => CourseSchema.parse(course)).toThrow('课程必须且只能包含一个真实案例集训单元')
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
    trainingCases[0].symbol = 'BTCUSDT'

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

  it.each(['volumeRatio', '1700000000'])(
    'rejects internal data in a learner-facing training annotation: %s',
    (forbiddenText) => {
      const { course, marketCases, trainingCases } = validContent()
      trainingCases[0].annotations[0].description = `标注 ${forbiddenText}`

      expect(() => validateChallengeContent(course, marketCases)).toThrow('学习者文本不能包含内部字段名或 Unix 时间戳')
    },
  )
})
