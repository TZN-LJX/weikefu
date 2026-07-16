import { describe, expect, it } from 'vitest'
import { calculateTradePlan, validateTradeChecklist } from './risk'

describe('calculateTradePlan', () => {
  it('caps a position by one percent account risk', () => {
    const result = calculateTradePlan({
      equity: 1_000,
      availableEquity: 1_000,
      leverage: 10,
      side: 'long',
      entry: 3_000,
      stop: 2_970,
      target: 3_090,
    })

    expect(result.riskAmount).toBe(10)
    expect(result.stopDistanceRatio).toBeCloseTo(0.01)
    expect(result.riskCappedNotional).toBeCloseTo(1_000)
    expect(result.maxNotional).toBeCloseTo(1_000)
    expect(result.requiredMargin).toBeCloseTo(100)
    expect(result.plannedR).toBe(3)
  })

  it('caps a position by available margin when the stop is very close', () => {
    const result = calculateTradePlan({
      equity: 1_000,
      availableEquity: 300,
      leverage: 5,
      side: 'short',
      entry: 3_000,
      stop: 3_003,
      target: 2_991,
    })

    expect(result.riskCappedNotional).toBeCloseTo(10_000)
    expect(result.marginCappedNotional).toBe(1_500)
    expect(result.maxNotional).toBe(1_500)
  })

  it('rejects an invalid long stop', () => {
    expect(() => calculateTradePlan({
      equity: 1_000,
      availableEquity: 1_000,
      leverage: 5,
      side: 'long',
      entry: 3_000,
      stop: 3_010,
      target: 3_060,
    })).toThrow('做多止损必须低于入场价')
  })
})

describe('validateTradeChecklist', () => {
  it('returns every missing decision requirement', () => {
    expect(validateTradeChecklist({
      background4h: '',
      structure1h: '',
      evidence: [],
      confirmation: '',
      invalidation: '',
      checkedNoTrade: false,
    })).toEqual([
      '需要先判断 4 小时市场背景',
      '需要先判断 1 小时结构',
      '至少选择一项价量证据',
      '需要填写入场后的确认条件',
      '需要填写判断失效条件',
      '需要明确检查不交易理由',
    ])
  })
})
