import { describe, expect, it } from 'vitest'
import { CourseSchema, MarketCasesSchema } from './contentSchema'

describe('private pack content schemas', () => {
  it('accepts a source-linked course unit with an exercise', () => {
    const result = CourseSchema.parse({
      version: 1,
      stages: [{
        id: 'stage-1', title: '风险纪律', goal: '先活下来',
        units: [{
          id: 'unit-1', title: '单笔风险', summary: '风险由止损距离决定。',
          source: { pdfPath: 'assets/original.pdf', chapter: '风险纪律', pageStart: 1, pageEnd: 2 },
          excerpt: '用于私人学习包的原书摘录。',
          exercise: {
            id: 'exercise-1', prompt: '哪一种仓位更合理？',
            options: [{ id: 'a', label: '固定风险' }, { id: 'b', label: '固定仓位' }],
            correctOptionId: 'a', evidence: [{ id: 'e1', label: '止损距离不同' }],
            requiredEvidenceIds: ['e1'], explanationPrompt: '风险应由什么决定？',
          },
        }],
      }],
    })
    expect(result.stages[0].units[0].source.pageStart).toBe(1)
  })

  it('rejects a replay case with no hidden future segment', () => {
    expect(() => MarketCasesSchema.parse({
      version: 1,
      cases: [{ id: 'case-1', title: '测试', timeframe: '1h', context4h: '需求', cutoff: 2,
        evidenceOptions: [{ id: 'e1', label: '缩量回测' }],
        candles: [{ time: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 }, { time: 2, open: 2, high: 3, low: 2, close: 3, volume: 12 }],
      }],
    })).toThrow('必须包含隐藏的未来K线')
  })

  it('accepts optional 4h candles for background-first replay', () => {
    const candle = { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 }
    const result = MarketCasesSchema.parse({ version: 1, cases: [{
      id: 'case-2', title: '多周期', timeframe: '1h', context4h: '需求', cutoff: 2,
      evidenceOptions: [{ id: 'e1', label: '缩量回测' }],
      candles: [candle, { ...candle, time: 2 }, { ...candle, time: 3 }],
      candles4h: Array.from({ length: 10 }, (_, index) => ({ ...candle, time: index + 1 })),
    }] })
    expect(result.cases[0].candles4h).toHaveLength(10)
  })
})
