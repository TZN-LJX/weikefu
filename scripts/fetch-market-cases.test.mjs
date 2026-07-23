import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildActualOutcome,
  buildAnalysisSummaries,
  buildReplayCandidate,
  classifyDirection,
  fallbackAnalyses,
  normalizeKlines,
  parseArchiveCsv,
  selectUnitCandidates,
  validateReplayAnalyses,
} from './fetch-market-cases.mjs'

function candle(time, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

test('normalizes Binance futures klines to closed candle records', () => {
  const candles = normalizeKlines([[1_720_000_000_000, '3000', '3020', '2980', '3010', '123.4']])
  assert.deepEqual(candles[0], { time: 1_720_000_000, open: 3000, high: 3020, low: 2980, close: 3010, volume: 123.4 })
})

test('parses the official Binance futures archive CSV format', () => {
  const csv = 'open_time,open,high,low,close,volume,close_time\n1720000000000,3000,3020,2980,3010,123.4,1720003599999\n'
  assert.deepEqual(parseArchiveCsv(csv), [[1720000000000, '3000', '3020', '2980', '3010', '123.4']])
})

test('classifies only unambiguous 24-hour paths', () => {
  assert.equal(classifyDirection({ return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 }), 'up')
  assert.equal(classifyDirection({ return24h: -0.03, minInterimReturn: -0.04, maxInterimReturn: 0.005 }), 'down')
  assert.equal(classifyDirection({ return24h: 0.005, minInterimReturn: -0.02, maxInterimReturn: 0.025 }), 'range')
  assert.equal(classifyDirection({ return24h: 0.03, minInterimReturn: -0.04, maxInterimReturn: 0.05 }), undefined)
})

test('builds a replay with 24 future candles and no 4h future leak', () => {
  const start = 1_700_000_000
  const oneHour = Array.from({ length: 160 }, (_, index) => candle(start + index * 3_600, index < 136 ? 3_000 : 3_000 + (index - 135) * 4))
  const fourHour = Array.from({ length: 50 }, (_, index) => candle(start - 40 * 14_400 + index * 14_400))
  const candidate = buildReplayCandidate(oneHour, fourHour, 136)
  assert.equal(candidate.visibleCandles.length, 120)
  assert.equal(candidate.futureCandles.length, 24)
  assert.ok(candidate.candles4h.every((item) => item.time + 14_400 <= candidate.cutoffTime))
})

test('selects one up, down, and range case per unit without reuse', () => {
  const candidates = ['up', 'down', 'range'].flatMap((direction) => Array.from({ length: 4 }, (_, index) => ({ id: `${direction}-${index}`, direction, cutoffTime: 1_700_000_000 + index * 1_000_000 })))
  const { selected, remaining } = selectUnitCandidates(candidates, 'unit-1')
  assert.deepEqual(selected.map((item) => item.correctDirection).sort(), ['down', 'range', 'up'])
  assert.equal(new Set(selected.map((item) => item.id)).size, 3)
  assert.equal(remaining.length, candidates.length - 3)
})

function analysis(caseId, evidence) {
  return {
    caseId,
    cutoffJudgment: 'range',
    evidence,
    annotations: [{ time: 1_700_000_000, description: 'A柱放量突破' }],
    directionAnalysis: { up: 'A柱后需求跟随。', down: '供应扩大证据不足。', range: '价格已经离开区间。' },
  }
}

test('requires an independent cutoff-time judgment in generated analyses', () => {
  const analyses = ['case-1', 'case-2', 'case-3'].map((caseId) => analysis(caseId, ['背景事实。', '价量事实。', '失效条件。']))
  assert.equal(validateReplayAnalyses(analyses)[0].cutoffJudgment, 'range')
  assert.throws(
    () => validateReplayAnalyses(analyses.map(({ cutoffJudgment: _cutoffJudgment, ...item }) => item)),
    /cutoffJudgment/,
  )
})

test('keeps future outcome data out of the cutoff-time analysis input', () => {
  const start = 1_700_000_000
  const candidate = {
    id: 'case-1',
    cutoffTime: start + 120 * 3_600,
    correctDirection: 'up',
    metrics: { return24h: 0.08, minInterimReturn: -0.01, maxInterimReturn: 0.09 },
    visibleCandles: Array.from({ length: 120 }, (_, index) => candle(start + index * 3_600, 3_000 + index)),
  }

  const summaries = buildAnalysisSummaries([candidate])

  assert.equal(summaries[0].caseId, 'case-1')
  assert.ok(summaries[0].visibleFacts)
  assert.equal('correctDirection' in summaries[0], false)
  assert.equal('metrics' in summaries[0], false)
  assert.equal(buildActualOutcome(candidate), '未来24小时收盘净变化 +8.00%，期间最低相对变化 -1.00%，最高相对变化 +9.00%。')
})

test('builds fallback judgment and A/B/C explanations from visible candles only', () => {
  const start = 1_700_000_000
  const base = {
    id: 'case-1',
    cutoffTime: start + 120 * 3_600,
    visibleCandles: Array.from({ length: 120 }, (_, index) => candle(start + index * 3_600, 3_000 + index * 2)),
    metrics: { return24h: 0.08, minInterimReturn: -0.01, maxInterimReturn: 0.09 },
    correctDirection: 'up',
  }
  const unit = { keyPoints: ['先看背景', '比较努力与结果'] }

  const first = fallbackAnalyses(unit, [base])[0]
  const changedFuture = fallbackAnalyses(unit, [{
    ...base,
    correctDirection: 'down',
    metrics: { return24h: -0.08, minInterimReturn: -0.09, maxInterimReturn: 0.01 },
  }])[0]

  assert.equal(first.cutoffJudgment, changedFuture.cutoffJudgment)
  assert.match(first.evidence.join(' '), /A柱.*B柱.*C柱/)
})

test('rejects learner-facing replay analysis with internal metrics or Unix timestamps', () => {
  const valid = ['case-1', 'case-2', 'case-3'].map((caseId) => analysis(caseId, ['最近24小时上涨，A柱出现需求跟随。', '回调时供应收缩。', '努力带来价格进展。']))
  assert.equal(validateReplayAnalyses(valid).length, 3)
  assert.throws(
    () => validateReplayAnalyses(valid.map((item, index) => index === 0 ? { ...item, evidence: ['recentReturn为0.03', ...item.evidence.slice(1)] } : item)),
    /学习者文本不能包含内部指标名或Unix时间戳/,
  )
  assert.throws(
    () => validateReplayAnalyses(valid.map((item, index) => index === 0 ? { ...item, evidence: ['1678640400出现突破', ...item.evidence.slice(1)] } : item)),
    /学习者文本不能包含内部指标名或Unix时间戳/,
  )
})
