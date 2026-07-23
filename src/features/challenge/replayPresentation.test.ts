import { describe, expect, it } from 'vitest'
import type { Candle, ContentUnit, MarketCase } from '../pack/contentSchema'
import { buildReplayPresentation } from './replayPresentation'

const start = 1_695_528_000

function candles(): Candle[] {
  const items = Array.from({ length: 120 }, (_, index) => ({
    time: start + index * 3_600,
    open: 100,
    high: 105,
    low: 95,
    close: 100,
    volume: 50,
  }))
  items[0] = { ...items[0], low: 80 }
  items[47] = { ...items[47], high: 130 }
  for (let index = 72; index < 96; index += 1) items[index] = { ...items[index], open: 100, close: 110, volume: 100 }
  for (let index = 96; index < 120; index += 1) items[index] = { ...items[index], open: 110, close: 121, high: 123, volume: 200 }
  return items
}

function marketCase(): MarketCase {
  const visibleCandles = candles()
  const firstMarkerTime = visibleCandles[100].time
  const secondMarkerTime = visibleCandles[110].time
  return {
    id: 'case-1', unitId: 'unit-1', title: 'Replay', symbol: 'ETHUSDT', market: 'Binance USD-M Futures', timeframe: '1h',
    cutoffTime: visibleCandles.at(-1)!.time + 3_600,
    horizonEndTime: visibleCandles.at(-1)!.time + 25 * 3_600,
    visibleCandles,
    futureCandles: Array.from({ length: 24 }, (_, index) => ({ ...visibleCandles.at(-1)!, time: visibleCandles.at(-1)!.time + (index + 1) * 3_600 })),
    candles4h: Array.from({ length: 30 }, (_, index) => ({ ...visibleCandles[index * 4], time: start + index * 14_400 })),
    correctDirection: 'up',
    cutoffJudgment: 'range',
    evidence: [
      '背景recentReturn: 0.10，priorReturn = 0.10，rangePosition：0.82，volumeRatio为2.0。',
      `${secondMarkerTime}出现跟随，早先${firstMarkerTime}已经放量突破。`,
    ],
    directionAnalysis: {
      up: `recentReturn为0.10，${firstMarkerTime}后需求占优，失效条件是跌回原区间。`,
      down: '供应扩大证据不足。',
      range: '价格已经离开区间。',
    },
    actualOutcome: 'return24h: 0.03，1678640400后上涨。',
    metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source: { pdfPath: 'assets/original.pdf', chapter: 'Chapter', pageStart: 17, pageEnd: 25 },
  }
}

const unit = {
  id: 'unit-1', title: 'Unit', summary: 'Summary',
  source: { pdfPath: 'assets/original.pdf', chapter: 'Chapter', pageStart: 17, pageEnd: 25 },
  excerpt: '“聪明钱的看图顺序：背景、价量形态、性质、结论和行动。”',
  excerptPage: 19,
  keyPoints: ['背景', '价量'], bookQuestions: [],
} as unknown as ContentUnit

describe('buildReplayPresentation', () => {
  it('calculates learner-facing auxiliary statistics from visible candles', () => {
    const presentation = buildReplayPresentation(marketCase(), unit)

    expect(presentation.statistics).toEqual([
      { label: '最近24小时涨跌幅', value: '+10.00%' },
      { label: '此前24小时涨跌幅', value: '+10.00%' },
      { label: '最近120小时区间位置', value: '82%（接近区间上沿）' },
      { label: '最近/此前24小时平均成交量', value: '2.00倍' },
    ])
  })

  it('removes raw field names and Unix timestamps while creating chronological markers', () => {
    const presentation = buildReplayPresentation(marketCase(), unit)
    const evidence = presentation.evidence.join(' ')

    expect(evidence).not.toMatch(/recentReturn|priorReturn|rangePosition|volumeRatio|\b1\d{9}\b/)
    expect(evidence).toContain('最近24小时涨跌幅为 +10.00%')
    expect(evidence).toContain('A柱（')
    expect(evidence).toContain('B柱（')
    expect(evidence).toMatch(/A柱（\d{4}-\d{2}-\d{2} \d{2}:\d{2} 北京时间）/)
    expect(evidence).not.toContain('（北京时间））')
    expect(presentation.annotations.map((annotation) => annotation.label)).toEqual(['A', 'B'])
    expect(presentation.annotations[0].time).toBeLessThan(presentation.annotations[1].time)
    expect(presentation.directionAnalysis.up).not.toMatch(/recentReturn|\b1\d{9}\b/)
    expect(presentation.directionAnalysis.up).toContain('A柱（')
    expect(presentation.actualOutcome).not.toMatch(/return24h|\b1\d{9}\b/)
    expect(presentation.actualOutcome).toContain('未来24小时收盘净变化')
    expect(presentation.actualOutcome).toContain('北京时间')
  })

  it('separates the future result from the cutoff-time judgment and cites the unit excerpt', () => {
    const presentation = buildReplayPresentation(marketCase(), unit)

    expect(presentation.resultLabel).toBe('上涨')
    expect(presentation.judgmentLabel).toBe('等待／方向不明')
    expect(presentation.bookCitation).toEqual({
      quote: '“聪明钱的看图顺序：背景、价量形态、性质、结论和行动。”',
      page: 19,
    })
    expect(presentation.sopSteps.map((step) => step.title)).toEqual([
      '背景与关键位置', '当前所处位置', '价量形态', '形态性质', '努力与结果', '分别验证三个选项', '结论和失效条件',
    ])
  })

  it('infers a legacy cutoff judgment from visible candles instead of the future result', () => {
    const first = marketCase()
    const { cutoffJudgment: _cutoffJudgment, ...legacy } = first
    const hindsightAnalysis = {
      up: '标准答案为上涨。',
      down: '下跌不成立。',
      range: '震荡不成立。',
    }
    const oppositeFuture = { ...legacy, correctDirection: 'down' as const, directionAnalysis: hindsightAnalysis }
    const presentation = buildReplayPresentation({ ...legacy, directionAnalysis: hindsightAnalysis } as MarketCase, unit)

    expect(presentation.judgmentLabel).toBe(buildReplayPresentation(oppositeFuture as MarketCase, unit).judgmentLabel)
    expect(presentation.directionAnalysis[presentation.judgmentDirection]).toContain('截止点判断')
    expect(presentation.directionAnalysis[presentation.judgmentDirection]).not.toContain('不成立')
  })
})
