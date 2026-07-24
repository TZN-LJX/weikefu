import assert from 'node:assert/strict'
import test from 'node:test'
import { appendCaseTrainingContent, selectSpacedCandidates } from './generate-case-training.mjs'

const DAY = 86_400

function candidate(cutoffTime, direction) {
  return { cutoffTime, correctDirection: direction, id: `${direction}-${cutoffTime}` }
}

test('selects exact direction quotas with global seven-day spacing and blocked cutoffs', () => {
  const start = 1_700_000_000
  const directions = ['up', 'down', 'range']
  const candidates = Array.from({ length: 1_200 }, (_, index) => candidate(
    start + index * DAY,
    directions[index % directions.length],
  ))
  const blockedCutoffs = [start + 333 * DAY]

  const selected = selectSpacedCandidates(candidates, {
    quotas: { up: 17, down: 17, range: 16 },
    blockedCutoffs,
    minimumSpacingSeconds: 7 * DAY,
  })

  assert.equal(selected.length, 50)
  assert.equal(selected.filter((item) => item.correctDirection === 'up').length, 17)
  assert.equal(selected.filter((item) => item.correctDirection === 'down').length, 17)
  assert.equal(selected.filter((item) => item.correctDirection === 'range').length, 16)

  const times = selected.map((item) => item.cutoffTime).sort((left, right) => left - right)
  assert.ok(times.every((time, index) => index === 0 || time - times[index - 1] >= 7 * DAY))
  assert.ok(times.every((time) => Math.abs(time - blockedCutoffs[0]) >= 7 * DAY))
  assert.ok(times.at(-1) - times[0] >= 300 * DAY)
})

function trainingCase(symbol, cutoffTime, direction) {
  return {
    id: `training-${symbol}-${cutoffTime}`,
    symbol,
    cutoffTime,
    correctDirection: direction,
  }
}

test('appends one final training unit without changing the original cases', () => {
  const originalCases = [
    { id: 'old-1', unitId: 'unit-1', symbol: 'ETHUSDT', cutoffTime: 1 },
    { id: 'old-2', unitId: 'unit-2', symbol: 'ETHUSDT', cutoffTime: 2 },
    { id: 'old-3', unitId: 'unit-3', symbol: 'ETHUSDT', cutoffTime: 3 },
  ]
  const course = {
    version: 2,
    stages: [{ id: 'stage-1', title: '阶段', goal: '目标', units: Array.from({ length: 14 }, (_, index) => ({
      id: `unit-${index + 1}`,
      title: `单元${index + 1}`,
      summary: '摘要',
      source: { pdfPath: 'assets/original.pdf', chapter: '章节', pageStart: 1, pageEnd: 1 },
      excerpt: '摘录',
      keyPoints: ['要点'],
      bookQuestions: [],
    })) }],
  }
  const ethCases = Array.from({ length: 50 }, (_, index) => trainingCase('ETHUSDT', 1000 + index * 604800, index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : 'range'))
  const btcCases = Array.from({ length: 50 }, (_, index) => trainingCase('BTCUSDT', 2000 + index * 604800, index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : 'range'))
  const result = appendCaseTrainingContent(course, { version: 2, symbol: 'ETHUSDT', market: 'Binance USD-M Futures', generatedAt: '2026-01-01T00:00:00.000Z', cases: originalCases }, { ETHUSDT: ethCases, BTCUSDT: btcCases })

  assert.deepEqual(result.marketCases.cases.slice(0, originalCases.length), originalCases)
  assert.equal(result.marketCases.cases.length, 103)
  assert.deepEqual(result.marketCases.symbols, ['ETHUSDT', 'BTCUSDT'])
  assert.equal(result.course.stages.at(-1).units.at(-1).mode, 'case-training')
  assert.equal(result.course.stages.at(-1).units.at(-1).trainingCaseCount, 100)
  assert.equal(result.marketCases.cases.at(-1).unitId, 'stage-8-real-case-training')
})
