import { z } from 'zod'

export const DirectionSchema = z.enum(['up', 'down', 'range'])

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
  title: z.string().min(1),
  summary: z.string().min(1),
  source: SourceReferenceSchema,
  excerpt: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1),
  bookQuestions: z.array(ChoiceQuestionSchema).min(20),
}).superRefine((unit, context) => {
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
  if (units.length !== 14) {
    context.addIssue({ code: 'custom', path: ['stages'], message: '课程必须包含 14 个知识单元' })
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

function hasInterval(candles: z.infer<typeof CandleSchema>[], seconds: number) {
  return candles.every((candle, index) => index === 0 || candle.time - candles[index - 1].time === seconds)
}

export const MarketCaseSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  title: z.string().min(1),
  symbol: z.literal('ETHUSDT'),
  market: z.literal('Binance USD-M Futures'),
  timeframe: z.literal('1h'),
  cutoffTime: z.number().int().nonnegative(),
  horizonEndTime: z.number().int().nonnegative(),
  visibleCandles: z.array(CandleSchema).min(48),
  futureCandles: z.array(CandleSchema).length(24),
  candles4h: z.array(CandleSchema).min(24),
  correctDirection: DirectionSchema,
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
  symbol: z.literal('ETHUSDT'),
  market: z.literal('Binance USD-M Futures'),
  generatedAt: z.string().datetime(),
  cases: z.array(MarketCaseSchema).min(42),
}).superRefine((marketCases, context) => {
  const ids = marketCases.cases.map((marketCase) => marketCase.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['cases'], message: 'ETH 案例 ID 必须唯一' })
  }
})

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
    const count = marketCases.cases.filter((marketCase) => marketCase.unitId === unit.id).length
    if (count < 3) throw new Error(`${unit.id} 至少需要 3 个 ETH 案例`)
  }
  return { course, marketCases }
}

export type Direction = z.infer<typeof DirectionSchema>
export type SourceReference = z.infer<typeof SourceReferenceSchema>
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>
export type Course = z.infer<typeof CourseSchema>
export type CourseStage = z.infer<typeof CourseStageSchema>
export type ContentUnit = z.infer<typeof ContentUnitSchema>
export type Candle = z.infer<typeof CandleSchema>
export type MarketCase = z.infer<typeof MarketCaseSchema>
export type MarketCases = z.infer<typeof MarketCasesSchema>
