import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReplayCandidate, classifyDirection, normalizeKlines, parseArchiveCsv, selectUnitCandidates } from './fetch-market-cases.mjs'

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
