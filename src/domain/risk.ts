import type { TradeSide } from './types'

export type TradePlanInput = {
  equity: number
  availableEquity: number
  leverage: number
  side: TradeSide
  entry: number
  stop: number
  target: number
}

export type TradeChecklist = {
  background4h: string
  structure1h: string
  evidence: string[]
  confirmation: string
  invalidation: string
  checkedNoTrade: boolean
}

function assertPositive(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}必须大于 0`)
  }
}

export function calculateTradePlan(input: TradePlanInput) {
  assertPositive('账户权益', input.equity)
  assertPositive('可用权益', input.availableEquity)
  assertPositive('杠杆', input.leverage)
  assertPositive('入场价', input.entry)
  assertPositive('止损价', input.stop)
  assertPositive('目标价', input.target)

  if (input.side === 'long' && input.stop >= input.entry) {
    throw new Error('做多止损必须低于入场价')
  }
  if (input.side === 'short' && input.stop <= input.entry) {
    throw new Error('做空止损必须高于入场价')
  }

  const riskAmount = input.equity * 0.01
  const stopDistanceRatio = Math.abs(input.entry - input.stop) / input.entry
  const riskCappedNotional = riskAmount / stopDistanceRatio
  const marginCappedNotional = input.availableEquity * input.leverage
  const maxNotional = Math.min(riskCappedNotional, marginCappedNotional)

  return {
    riskAmount,
    stopDistanceRatio,
    riskCappedNotional,
    marginCappedNotional,
    maxNotional,
    requiredMargin: maxNotional / input.leverage,
    plannedR: Math.abs(input.target - input.entry) / Math.abs(input.entry - input.stop),
  }
}

export function validateTradeChecklist(checklist: TradeChecklist) {
  const errors: string[] = []
  if (!checklist.background4h.trim()) errors.push('需要先判断 4 小时市场背景')
  if (!checklist.structure1h.trim()) errors.push('需要先判断 1 小时结构')
  if (checklist.evidence.length === 0) errors.push('至少选择一项价量证据')
  if (!checklist.confirmation.trim()) errors.push('需要填写入场后的确认条件')
  if (!checklist.invalidation.trim()) errors.push('需要填写判断失效条件')
  if (!checklist.checkedNoTrade) errors.push('需要明确检查不交易理由')
  return errors
}
