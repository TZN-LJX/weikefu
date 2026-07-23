import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppContent } from './App'

const source = { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 10 }

function candle(time: number, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

function content() {
  const standardUnits = Array.from({ length: 14 }, (_, unitIndex) => ({
    id: `unit-${unitIndex + 1}`, title: `知识单元 ${unitIndex + 1}`,
    summary: '先判断背景，再比较价量努力与结果。', source, excerpt: '根据市场自身行为判断。', keyPoints: ['先背景', '后证据'],
    bookQuestions: Array.from({ length: 20 }, (_, questionIndex) => ({
      id: `u${unitIndex + 1}-q${questionIndex + 1}`, prompt: `原书题 ${questionIndex + 1}`,
      options: [
        { id: 'a', label: '等待', explanation: '证据不足。' },
        { id: 'b', label: '做多', explanation: '需求不足。' },
        { id: 'c', label: '做空', explanation: '供应不足。' },
      ], correctOptionId: 'a', explanation: '按证据判断。', source,
    })),
  }))
  const trainingUnit = {
    id: 'stage-8-real-case-training', mode: 'case-training', trainingCaseCount: 100,
    title: '真实案例集训', summary: '连续完成100个不重复真实案例。', source,
    excerpt: '根据市场自身行为判断。', keyPoints: ['先背景', '后证据'], bookQuestions: [],
  }
  function replayCase(unitId: string, id: string, absoluteIndex: number, symbol: 'ETHUSDT' | 'BTCUSDT' = 'ETHUSDT') {
    const start = 1_700_000_000 + absoluteIndex * 1_000_000
    return {
      id, unitId, title: `${symbol} 回放 ${absoluteIndex + 1}`, symbol, market: 'Binance USD-M Futures', timeframe: '1h',
      cutoffTime: start + 48 * 3_600, horizonEndTime: start + 72 * 3_600,
      visibleCandles: Array.from({ length: 48 }, (_, index) => candle(start + index * 3_600)),
      futureCandles: Array.from({ length: 24 }, (_, index) => candle(start + (48 + index) * 3_600, 3_000 + index * 4)),
      candles4h: Array.from({ length: 24 }, (_, index) => candle(start - (24 - index) * 14_400)),
      correctDirection: 'up', cutoffJudgment: 'range',
      annotations: [{ time: start + 40 * 3_600, description: '需求扩大' }], evidence: ['需求扩大', '供应收缩'],
      directionAnalysis: { up: '需求控制。', down: '供应不足。', range: '方向明确。' }, actualOutcome: '未来上涨。',
      metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 }, source,
    }
  }
  const standardCases = standardUnits.flatMap((unit, unitIndex) => Array.from({ length: 3 }, (_, caseIndex) => (
    replayCase(unit.id, `${unit.id}-case-${caseIndex + 1}`, unitIndex * 3 + caseIndex)
  )))
  const trainingCases = Array.from({ length: 100 }, (_, caseIndex) => {
    const symbol = caseIndex < 50 ? 'ETHUSDT' : 'BTCUSDT'
    return replayCase(trainingUnit.id, `${trainingUnit.id}-case-${caseIndex + 1}`, standardCases.length + caseIndex, symbol)
  })
  return {
    course: { version: 2, stages: [
      { id: 'stage-1', title: '核心方法', goal: '顺序学习', units: standardUnits },
      { id: 'stage-8-case-training', title: '真实案例集训', goal: '连续判断真实行情', units: [trainingUnit] },
    ] },
    marketCases: {
      version: 2, symbol: 'ETHUSDT', symbols: ['ETHUSDT', 'BTCUSDT'], market: 'Binance USD-M Futures',
      generatedAt: '2026-07-17T00:00:00.000Z', cases: [...standardCases, ...trainingCases],
    },
  }
}

function fakeRepositories(hasPack: boolean) {
  const { course, marketCases } = content()
  return {
    getActivePack: vi.fn(async () => hasPack ? { id: 'core', title: '私人课程', version: '2.0.0', active: true, importedAt: '' } : undefined),
    getJsonAsset: vi.fn(async (path: string) => path.includes('course') ? course : marketCases),
    getChallengeProgress: vi.fn(async () => undefined),
    getWrongItems: vi.fn(async () => []),
    saveChallengeProgress: vi.fn(async () => undefined),
    saveChallengeAttempt: vi.fn(async () => undefined),
    saveWrongItem: vi.fn(async () => undefined),
    savePack: vi.fn(), clearPartial: vi.fn(), deleteActivePack: vi.fn(), setSetting: vi.fn(), getSetting: vi.fn(), getAsset: vi.fn(),
    resetChallengeProgress: vi.fn(), getBackupSnapshot: vi.fn(async () => ({ challengeProgress: [], challengeAttempts: [], wrongItems: [], settings: {} })), restoreProgress: vi.fn(),
  }
}

describe('AppContent', () => {
  it('gates the app behind a valid private learning pack', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(false) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '导入私人学习包' })).toBeVisible()
    expect(screen.queryByText('闯关地图')).not.toBeInTheDocument()
  })

  it('opens the challenge map after loading private content', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(true) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '闯关地图' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '知识单元 1' })).toBeVisible()
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument()
  })
})
