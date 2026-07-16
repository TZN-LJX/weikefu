import { z } from 'zod'

const ExerciseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  correctOptionId: z.string().min(1),
  evidence: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  requiredEvidenceIds: z.array(z.string().min(1)).min(1),
  explanationPrompt: z.string().min(1),
})

export const ContentUnitSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: z.object({
    pdfPath: z.string().min(1),
    chapter: z.string().min(1),
    pageStart: z.number().int().positive(),
    pageEnd: z.number().int().positive(),
  }).refine((source) => source.pageEnd >= source.pageStart, '来源结束页不能早于起始页'),
  excerpt: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).default([]),
  exercise: ExerciseSchema,
})

export const CourseStageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  units: z.array(ContentUnitSchema),
})

export const CourseSchema = z.object({
  version: z.literal(1),
  stages: z.array(CourseStageSchema).min(1),
})

const CandleSchema = z.object({
  time: z.number().int().nonnegative(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
}).refine((candle) => candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close), 'K线高低价无效')

const MarketCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  timeframe: z.string().min(1),
  context4h: z.string().min(1),
  cutoff: z.number().int().positive(),
  evidenceOptions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  candles: z.array(CandleSchema).min(2),
}).superRefine((marketCase, context) => {
  if (marketCase.cutoff >= marketCase.candles.length) {
    context.addIssue({ code: 'custom', path: ['cutoff'], message: '必须包含隐藏的未来K线' })
  }
})

export const MarketCasesSchema = z.object({
  version: z.literal(1),
  cases: z.array(MarketCaseSchema).min(1),
})

export type Course = z.infer<typeof CourseSchema>
export type CourseStage = z.infer<typeof CourseStageSchema>
export type ContentUnit = z.infer<typeof ContentUnitSchema>
export type MarketCases = z.infer<typeof MarketCasesSchema>
