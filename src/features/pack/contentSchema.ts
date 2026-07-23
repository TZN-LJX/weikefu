import { z } from 'zod'

export const DirectionSchema = z.enum(['up', 'down', 'range'])
export const MarketSymbolSchema = z.enum(['ETHUSDT', 'BTCUSDT'])
export const ContentUnitModeSchema = z.enum(['standard', 'case-training'])

export const SourceReferenceSchema = z.object({
  pdfPath: z.string().min(1),
  chapter: z.string().min(1),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
}).refine((source) => source.pageEnd >= source.pageStart, '来源结束页不能早于起始页')

const ChoiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  explanation: z.string().min(1),
})

export const ChoiceQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(ChoiceOptionSchema).min(3).max(4),
  correctOptionId: z.string().min(1),
  explanation: z.string().min(1),
  source: SourceReferenceSchema,
}).superRefine((question, context) => {
  const optionIds = question.options.map((option) => option.id)
  if (new Set(optionIds).size !== optionIds.length) {
    context.addIssue({ code: 'custom', path: ['options'], message: '选项 ID 必须唯一' })
  }
  if (!optionIds.includes(question.correctOptionId)) {
    context.addIssue({ code: 'custom', path: ['correctOptionId'], message: '正确选项不存在' })
  }
})

export const ContentUnitSchema = z.object({
  id: z.string().min(1),
  mode: ContentUnitModeSchema.default('standard'),
  trainingCaseCount: z.number().int().positive().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: SourceReferenceSchema,
  excerpt: z.string().min(1),
  excerptPage: z.number().int().positive().optional(),
  keyPoints: z.array(z.string().min(1)).min(1),
  bookQuestions: z.array(ChoiceQuestionSchema),
}).superRefine((unit, context) => {
  if (unit.mode === 'case-training') {
    if (unit.trainingCaseCount !== 100) {
      context.addIssue({ code: 'custom', path: ['trainingCaseCount'], message: '真实案例集训必须声明 100 个案例' })
    }
    if (unit.bookQuestions.length !== 0) {
      context.addIssue({ code: 'custom', path: ['bookQuestions'], message: '真实案例集训不能包含原书测验' })
    }
  } else if (unit.bookQuestions.length < 20) {
    context.addIssue({ code: 'custom', path: ['bookQuestions'], message: '标准单元至少需要 20 道原书题' })
  }
  const ids = unit.bookQuestions.map((question) => question.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['bookQuestions'], message: '单元内题目 ID 必须唯一' })
  }
})

export const CourseStageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  units: z.array(ContentUnitSchema).min(1),
})

export const CourseSchema = z.object({
  version: z.literal(2),
  stages: z.array(CourseStageSchema).min(1),
}).superRefine((course, context) => {
  const units = course.stages.flatMap((stage) => stage.units)
  if (units.length !== 15) {
    context.addIssue({ code: 'custom', path: ['stages'], message: '课程必须包含 15 个知识单元' })
  }
  if (units.at(-1)?.mode !== 'case-training') {
    context.addIssue({ code: 'custom', path: ['stages'], message: '课程最后一个单元必须是真实案例集训' })
  }
  const trainingUnits = units.filter((unit) => unit.mode === 'case-training')
  if (trainingUnits.length !== 1) {
    context.addIssue({ code: 'custom', path: ['stages'], message: '课程必须且只能包含一个真实案例集训单元' })
  }
  const unitIds = units.map((unit) => unit.id)
  if (new Set(unitIds).size !== unitIds.length) {
    context.addIssue({ code: 'custom', path: ['stages'], message: '知识单元 ID 必须唯一' })
  }
})

export const CandleSchema = z.object({
  time: z.number().int().nonnegative(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
}).refine(
  (candle) => candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close),
  'K线高低价无效',
)

export const ReplayAnnotationSchema = z.object({
  time: z.number().int().nonnegative(),
  description: z.string().min(1).optional(),
})

function hasInterval(candles: z.infer<typeof CandleSchema>[], seconds: number) {
  return candles.every((candle, index) => index === 0 || candle.time - candles[index - 1].time === seconds)
}

export const MarketCaseSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  title: z.string().min(1),
  symbol: MarketSymbolSchema,
  market: z.literal('Binance USD-M Futures'),
  timeframe: z.literal('1h'),
  cutoffTime: z.number().int().nonnegative(),
  horizonEndTime: z.number().int().nonnegative(),
  visibleCandles: z.array(CandleSchema).min(48),
  futureCandles: z.array(CandleSchema).length(24),
  candles4h: z.array(CandleSchema).min(24),
  correctDirection: DirectionSchema,
  cutoffJudgment: DirectionSchema.optional(),
  annotations: z.array(ReplayAnnotationSchema).max(8).optional(),
  evidence: z.array(z.string().min(1)).min(2),
  directionAnalysis: z.object({
    up: z.string().min(1),
    down: z.string().min(1),
    range: z.string().min(1),
  }),
  actualOutcome: z.string().min(1),
  metrics: z.object({
    return24h: z.number(),
    minInterimReturn: z.number(),
    maxInterimReturn: z.number(),
  }),
  source: SourceReferenceSchema,
}).superRefine((marketCase, context) => {
  const { metrics } = marketCase
  const directionMatches = marketCase.correctDirection === 'up'
    ? metrics.return24h >= 0.02 && metrics.minInterimReturn > -0.02
    : marketCase.correctDirection === 'down'
      ? metrics.return24h <= -0.02 && metrics.maxInterimReturn < 0.02
      : Math.abs(metrics.return24h) < 0.02 && metrics.minInterimReturn >= -0.035 && metrics.maxInterimReturn <= 0.035
  if (!directionMatches) {
    context.addIssue({ code: 'custom', path: ['correctDirection'], message: '标准方向与收益率指标不一致' })
  }
  if (!hasInterval(marketCase.visibleCandles, 3_600) || !hasInterval(marketCase.futureCandles, 3_600)) {
    context.addIssue({ code: 'custom', path: ['futureCandles'], message: '1小时K线时间必须连续' })
  }
  if (!hasInterval(marketCase.candles4h, 14_400)) {
    context.addIssue({ code: 'custom', path: ['candles4h'], message: '4小时K线时间必须连续' })
  }
  const visibleTimes = new Set(marketCase.visibleCandles.map((candle) => candle.time))
  if (marketCase.annotations?.some((annotation) => !visibleTimes.has(annotation.time))) {
    context.addIssue({ code: 'custom', path: ['annotations'], message: 'K线标注必须指向截止点前的可见K线' })
  }
  const lastVisible = marketCase.visibleCandles.at(-1)
  const firstFuture = marketCase.futureCandles[0]
  const lastFuture = marketCase.futureCandles.at(-1)
  if (!lastVisible || !firstFuture || !lastFuture
    || marketCase.cutoffTime !== lastVisible.time + 3_600
    || firstFuture.time !== marketCase.cutoffTime
    || marketCase.horizonEndTime !== lastFuture.time + 3_600) {
    context.addIssue({ code: 'custom', path: ['cutoffTime'], message: '回放截止时间与未来24小时不连续' })
  }
})

export const MarketCasesSchema = z.object({
  version: z.literal(2),
  symbol: MarketSymbolSchema,
  symbols: z.array(MarketSymbolSchema).min(1).optional(),
  market: z.literal('Binance USD-M Futures'),
  generatedAt: z.string().datetime(),
  cases: z.array(MarketCaseSchema).min(42),
}).superRefine((marketCases, context) => {
  if (marketCases.symbols) {
    const declaredSymbols = new Set(marketCases.symbols)
    if (declaredSymbols.size !== marketCases.symbols.length) {
      context.addIssue({ code: 'custom', path: ['symbols'], message: '市场包 symbols 标的必须唯一' })
    }
    const actualSymbols = new Set(marketCases.cases.map((marketCase) => marketCase.symbol))
    if (declaredSymbols.size !== actualSymbols.size
      || [...declaredSymbols].some((symbol) => !actualSymbols.has(symbol))) {
      context.addIssue({ code: 'custom', path: ['symbols'], message: '市场包 symbols 必须与案例标的一致' })
    }
  }
  const ids = marketCases.cases.map((marketCase) => marketCase.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['cases'], message: '案例 ID 必须唯一' })
  }
  const symbolCutoffs = marketCases.cases.map((marketCase) => `${marketCase.symbol}:${marketCase.cutoffTime}`)
  if (new Set(symbolCutoffs).size !== symbolCutoffs.length) {
    context.addIssue({ code: 'custom', path: ['cases'], message: '案例标的和截止时间必须唯一' })
  }
})

const forbiddenLearnerText = /recentReturn|priorReturn|rangePosition|volumeRatio|return24h|minInterimReturn|maxInterimReturn|(?<!\d)\d{10}(?!\d)/i

export function validateChallengeContent(courseValue: unknown, marketCasesValue: unknown) {
  const course = CourseSchema.parse(courseValue)
  const marketCases = MarketCasesSchema.parse(marketCasesValue)
  const units = course.stages.flatMap((stage) => stage.units)
  const unitIds = new Set(units.map((unit) => unit.id))
  for (const marketCase of marketCases.cases) {
    if (!unitIds.has(marketCase.unitId)) {
      throw new Error(`${marketCase.id} 引用了不存在的知识单元`)
    }
  }
  for (const unit of units) {
    const unitCases = marketCases.cases.filter((marketCase) => marketCase.unitId === unit.id)
    if (unit.mode === 'standard') {
      if (unitCases.length < 3) throw new Error(`${unit.id} 至少需要 3 个市场案例`)
      continue
    }
    if (unitCases.length !== 100) {
      throw new Error(`${unit.id} 必须包含 100 个真实案例`)
    }
    const ethCount = unitCases.filter((marketCase) => marketCase.symbol === 'ETHUSDT').length
    const btcCount = unitCases.filter((marketCase) => marketCase.symbol === 'BTCUSDT').length
    if (ethCount !== 50 || btcCount !== 50) {
      throw new Error(`${unit.id} 必须包含 50 个 ETHUSDT 和 50 个 BTCUSDT`)
    }
    for (const marketCase of unitCases) {
      if (!marketCase.cutoffJudgment) {
        throw new Error(`${marketCase.id} 真实案例必须包含截止点判断`)
      }
      if (!marketCase.annotations || marketCase.annotations.length < 1 || marketCase.annotations.length > 8) {
        throw new Error(`${marketCase.id} 真实案例必须包含 1-8 个标注`)
      }
      const learnerText = [
        marketCase.title,
        ...marketCase.evidence,
        ...Object.values(marketCase.directionAnalysis),
        ...marketCase.annotations.flatMap((annotation) => annotation.description ? [annotation.description] : []),
        marketCase.actualOutcome,
      ]
      if (learnerText.some((text) => forbiddenLearnerText.test(text))) {
        throw new Error(`${marketCase.id} 学习者文本不能包含内部字段名或 Unix 时间戳`)
      }
    }
  }
  return { course, marketCases }
}

export type Direction = z.infer<typeof DirectionSchema>
export type MarketSymbol = z.infer<typeof MarketSymbolSchema>
export type ContentUnitMode = z.infer<typeof ContentUnitModeSchema>
export type SourceReference = z.infer<typeof SourceReferenceSchema>
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>
export type Course = z.infer<typeof CourseSchema>
export type CourseStage = z.infer<typeof CourseStageSchema>
export type ContentUnitInput = z.input<typeof ContentUnitSchema>
export type ContentUnit = z.output<typeof ContentUnitSchema>
export type Candle = z.infer<typeof CandleSchema>
export type MarketCase = z.infer<typeof MarketCaseSchema>
export type MarketCases = z.infer<typeof MarketCasesSchema>
