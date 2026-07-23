import type { ContentUnit, MarketCase } from '../pack/contentSchema'
import { formatBeijingCrosshair } from '../replay/chartTime'

type StructuredAnnotation = {
  time: number
  description?: string
}

const directionLabels = { up: '上涨', down: '下跌', range: '震荡／方向不明' } as const
const judgmentLabels = { up: '偏多', down: '偏空', range: '等待／方向不明' } as const

const excerptPages: Record<string, number> = {
  'unit-1-market-behavior-cm': 7,
  'unit-2-smart-money-sequence-risk': 19,
  'unit-2-1-supply-demand-background': 27,
  'unit-2-2-support-resistance-effort-result': 56,
  'unit-3-1-bear-stop-and-accumulation': 71,
  'unit-3-2-test-spring-joc-sos': 97,
  'unit-4-1-bull-end-distribution-intent': 130,
  'unit-4-2-confirm-failure-short-premise': 145,
  'stage-5-spring-u1': 177,
  'stage-5-spring-u2': 182,
  'stage-6-replay-unit-1': 213,
  'stage-6-replay-unit-2': 241,
  'stage-7-simulation-unit-1': 258,
  'stage-7-simulation-unit-2': 286,
}

export const replaySopSteps = [
  { title: '背景与关键位置', guidance: '先看4小时趋势、震荡区、支撑位和阻力位。', quote: '“识别支撑和阻力。（用价格判断）”', page: 17 },
  { title: '当前所处位置', guidance: '判断价格在区间底部、中部、上沿，还是已经有效离开区间。' },
  { title: '价量形态', guidance: '比较蜡烛长度、成交量高度和走势速度。', quote: '“价量形态：蜡烛的长度、成交量的高度、变化速度。”', page: 19 },
  { title: '形态性质', guidance: '判断需求是否跟随、供应是否扩大、回调是否缩量、突破是否失败。' },
  { title: '努力与结果', guidance: '检查成交量的努力有没有带来相应的价格进展。', quote: '“成交量的增长没有使价格大幅增长，这是走势停止行为（努力和效果原则）。”', page: 25 },
  { title: '分别验证三个选项', guidance: '分别检查上涨、下跌和震荡成立或不成立的证据。' },
  { title: '结论和失效条件', guidance: '给出截止点判断，并说明什么行情会推翻它。' },
]

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function rangeDescription(position: number) {
  if (position >= 0.8) return '接近区间上沿'
  if (position <= 0.2) return '接近区间下沿'
  if (position >= 0.6) return '位于区间偏上位置'
  if (position <= 0.4) return '位于区间偏下位置'
  return '位于区间中部'
}

function visibleFacts(marketCase: MarketCase) {
  const visible = marketCase.visibleCandles
  const recent = visible.slice(-24)
  const prior = visible.slice(-48, -24)
  const high = Math.max(...visible.slice(-120).map((candle) => candle.high))
  const low = Math.min(...visible.slice(-120).map((candle) => candle.low))
  const close = visible.at(-1)?.close ?? recent.at(-1)?.close ?? 0
  const recentReturn = recent.length ? close / recent[0].open - 1 : 0
  const priorReturn = prior.length ? prior.at(-1)!.close / prior[0].open - 1 : 0
  const recentVolume = recent.length ? average(recent.map((candle) => candle.volume)) : 0
  const priorVolume = prior.length ? average(prior.map((candle) => candle.volume)) : 0
  return {
    recentReturn,
    priorReturn,
    rangePosition: (close - low) / Math.max(1e-9, high - low),
    volumeRatio: priorVolume > 0 ? recentVolume / priorVolume : 0,
  }
}

function inferCutoffJudgment(facts: ReturnType<typeof visibleFacts>) {
  if (facts.recentReturn >= 0.02 && facts.priorReturn >= -0.01 && facts.rangePosition >= 0.65) return 'up'
  if (facts.recentReturn <= -0.02 && facts.priorReturn <= 0.01 && facts.rangePosition <= 0.35) return 'down'
  return 'range'
}

function legacyTimestampAnnotations(marketCase: MarketCase): StructuredAnnotation[] {
  const visibleTimes = new Set(marketCase.visibleCandles.map((candle) => candle.time))
  const timestamps = marketCase.evidence.flatMap((evidence) => evidence.match(/\b1\d{9}\b/g) ?? [])
    .map(Number)
    .filter((time) => visibleTimes.has(time))
  return [...new Set(timestamps)].sort((left, right) => left - right).map((time) => ({ time }))
}

function annotationsFor(marketCase: MarketCase) {
  const structured = (marketCase as MarketCase & { annotations?: StructuredAnnotation[] }).annotations ?? []
  const combined = structured.length ? structured : legacyTimestampAnnotations(marketCase)
  return [...combined]
    .sort((left, right) => left.time - right.time)
    .slice(0, 8)
    .map((annotation, index) => ({ ...annotation, label: String.fromCharCode(65 + index) }))
}

function cleanText(text: string, annotations: ReturnType<typeof annotationsFor>, facts: ReturnType<typeof visibleFacts>) {
  const markerByTime = new Map(annotations.map((annotation) => [annotation.time, annotation.label]))
  const rangeValue = `${(facts.rangePosition * 100).toFixed(0)}%（${rangeDescription(facts.rangePosition)}）`
  return text
    .replace(/recentReturn\s*(?:为|达到|仅|[:：=])?\s*[+-]?\d+(?:\.\d+)?%?/g, `最近24小时涨跌幅为 ${percent(facts.recentReturn)}`)
    .replace(/priorReturn\s*(?:为|达到|仅|[:：=])?\s*[+-]?\d+(?:\.\d+)?%?/g, `此前24小时涨跌幅为 ${percent(facts.priorReturn)}`)
    .replace(/rangePosition\s*(?:为|达到|仅|[:：=])?\s*[+-]?\d+(?:\.\d+)?%?/g, `最近120小时区间位置为 ${rangeValue}`)
    .replace(/volumeRatio\s*(?:为|达到|仅|[:：=])?\s*[+-]?\d+(?:\.\d+)?/g, `最近24小时平均成交量约为此前24小时的 ${facts.volumeRatio.toFixed(2)} 倍`)
    .replace(/recentReturn/g, '最近24小时涨跌幅')
    .replace(/priorReturn/g, '此前24小时涨跌幅')
    .replace(/rangePosition/g, '最近120小时区间位置')
    .replace(/volumeRatio/g, '最近/此前24小时平均成交量')
    .replace(/\b1\d{9}\b/g, (value) => {
      const time = Number(value)
      const label = markerByTime.get(time)
      const formattedTime = formatBeijingCrosshair(time).replace('（北京时间）', ' 北京时间')
      return label ? `${label}柱（${formattedTime}）` : formattedTime
    })
}

function cleanActualOutcome(text: string) {
  return text
    .replace(/return24h\s*(?:为|达到|仅|[:：=])?\s*([+-]?\d+(?:\.\d+)?)(%?)/g, (_match, value, suffix) => (
      `未来24小时收盘净变化 ${suffix ? `${value}%` : percent(Number(value))}`
    ))
    .replace(/minInterimReturn\s*(?:为|达到|仅|[:：=])?\s*([+-]?\d+(?:\.\d+)?)(%?)/g, (_match, value, suffix) => (
      `未来24小时期间最低相对变化 ${suffix ? `${value}%` : percent(Number(value))}`
    ))
    .replace(/maxInterimReturn\s*(?:为|达到|仅|[:：=])?\s*([+-]?\d+(?:\.\d+)?)(%?)/g, (_match, value, suffix) => (
      `未来24小时期间最高相对变化 ${suffix ? `${value}%` : percent(Number(value))}`
    ))
    .replace(/recentReturn/g, '最近24小时涨跌幅')
    .replace(/priorReturn/g, '此前24小时涨跌幅')
    .replace(/rangePosition/g, '最近120小时区间位置')
    .replace(/volumeRatio/g, '最近/此前24小时平均成交量')
    .replace(/\b1\d{9}\b/g, (value) => formatBeijingCrosshair(Number(value)).replace('（北京时间）', ' 北京时间'))
}

function legacyDirectionAnalysis(cutoffJudgment: 'up' | 'down' | 'range', facts: ReturnType<typeof visibleFacts>) {
  const position = `${(facts.rangePosition * 100).toFixed(0)}%（${rangeDescription(facts.rangePosition)}）`
  return {
    up: cutoffJudgment === 'up'
      ? `截止点判断偏多：最近24小时涨跌幅为 ${percent(facts.recentReturn)}，区间位置为 ${position}，需求的价格进展更明显；若价格跌回原区间则判断失效。`
      : '上涨证据不足：截止点前没有形成持续的需求跟随和有效向上进展。',
    down: cutoffJudgment === 'down'
      ? `截止点判断偏空：最近24小时涨跌幅为 ${percent(facts.recentReturn)}，区间位置为 ${position}，供应的价格进展更明显；若价格收复原区间则判断失效。`
      : '下跌证据不足：截止点前没有形成持续的供应扩大和有效向下进展。',
    range: cutoffJudgment === 'range'
      ? '截止点判断为等待／方向不明：供需证据尚未形成可持续的单边优势，应等待突破、跟随和回测确认。'
      : '震荡证据不足：截止点前已经出现方向性价格进展，但仍需用后续跟随确认。',
  }
}

export function buildReplayPresentation(marketCase: MarketCase, unit?: ContentUnit) {
  const facts = visibleFacts(marketCase)
  const annotations = annotationsFor(marketCase)
  const pageFromContent = (unit as ContentUnit & { excerptPage?: number } | undefined)?.excerptPage
  const cutoffJudgment = marketCase.cutoffJudgment ?? inferCutoffJudgment(facts)
  const directionAnalysis = marketCase.cutoffJudgment ? {
    up: cleanText(marketCase.directionAnalysis.up, annotations, facts),
    down: cleanText(marketCase.directionAnalysis.down, annotations, facts),
    range: cleanText(marketCase.directionAnalysis.range, annotations, facts),
  } : legacyDirectionAnalysis(cutoffJudgment, facts)
  return {
    statistics: [
      { label: '最近24小时涨跌幅', value: percent(facts.recentReturn) },
      { label: '此前24小时涨跌幅', value: percent(facts.priorReturn) },
      { label: '最近120小时区间位置', value: `${(facts.rangePosition * 100).toFixed(0)}%（${rangeDescription(facts.rangePosition)}）` },
      { label: '最近/此前24小时平均成交量', value: `${facts.volumeRatio.toFixed(2)}倍` },
    ],
    evidence: marketCase.evidence.map((evidence) => cleanText(evidence, annotations, facts)),
    directionAnalysis,
    annotations,
    resultLabel: directionLabels[marketCase.correctDirection],
    judgmentLabel: judgmentLabels[cutoffJudgment],
    judgmentDirection: cutoffJudgment,
    actualOutcome: cleanActualOutcome(marketCase.actualOutcome),
    sopSteps: replaySopSteps,
    bookCitation: unit ? {
      quote: unit.excerpt,
      page: pageFromContent ?? excerptPages[unit.id] ?? unit.source.pageStart,
    } : undefined,
  }
}
