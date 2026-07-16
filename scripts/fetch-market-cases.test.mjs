import assert from 'node:assert/strict'
import test from 'node:test'
import { neutralCaseTitle, normalizeKlines, parseArchiveCsv, splitReplayWindow, visibleContextCandles } from './fetch-market-cases.mjs'

test('normalizes Binance futures klines to closed candle records', () => {
  const candles = normalizeKlines([[1_720_000_000_000, '3000', '3020', '2980', '3010', '123.4', 0, 0, 0, 0, 0, 0]])
  assert.deepEqual(candles[0], { time: 1_720_000_000, open: 3000, high: 3020, low: 2980, close: 3010, volume: 123.4 })
  expectMicroseconds(normalizeKlines([[1_720_000_000_000_000, '3000', '3020', '2980', '3010', '123.4']]))
})

function expectMicroseconds(candles) {
  assert.equal(candles[0].time, 1_720_000_000)
}

test('keeps a meaningful future segment hidden', () => {
  assert.deepEqual(splitReplayWindow(Array.from({ length: 240 }), 72), { cutoff: 168, hiddenCount: 72 })
  assert.throws(() => splitReplayWindow(Array.from({ length: 20 }), 20), /隐藏区间/)
})

test('does not leak the hidden 1h future through the 4h chart', () => {
  const context = [{ time: 100 }, { time: 200 }, { time: 300 }]
  assert.deepEqual(visibleContextCandles(context, 200), [{ time: 100 }, { time: 200 }])
})

test('parses the official Binance futures archive CSV format', () => {
  const csv = 'open_time,open,high,low,close,volume,close_time\n1720000000000,3000,3020,2980,3010,123.4,1720003599999\n'
  assert.deepEqual(parseArchiveCsv(csv), [[1720000000000, '3000', '3020', '2980', '3010', '123.4']])
})

test('uses a neutral replay title that does not reveal the reference label', () => {
  assert.equal(neutralCaseTitle(0, '2024-01-18T00:00:00Z'), 'ETH 回放 01 · 2024-01')
})
