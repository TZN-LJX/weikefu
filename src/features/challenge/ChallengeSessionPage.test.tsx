import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createChallengeProgress, type ChallengeProgress, type WrongItem } from '../../domain/challenge'
import type { ChoiceQuestion, ContentUnit, MarketCase } from '../pack/contentSchema'
import { ChallengeSessionPage } from './ChallengeSessionPage'

vi.mock('../replay/MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

function question(index: number): ChoiceQuestion {
  return {
    id: `q${index}`, prompt: `原书题 ${index}`,
    options: [
      { id: 'a', label: `正确 ${index}`, explanation: '符合原书。' },
      { id: 'b', label: `错误甲 ${index}`, explanation: '忽略背景。' },
      { id: 'c', label: `错误乙 ${index}`, explanation: '证据不足。' },
    ],
    correctOptionId: 'a', explanation: '按背景和价量证据判断。',
    source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 10 },
  }
}

function candle(time: number, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

function replayCase(index: number): MarketCase {
  const start = 1_700_000_000 + index * 1_000_000
  return {
    id: `case-${index}`, unitId: 'unit-1', title: `ETH 回放 ${index}`, symbol: 'ETHUSDT', market: 'Binance USD-M Futures', timeframe: '1h',
    cutoffTime: start + 48 * 3_600, horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, candleIndex) => candle(start + candleIndex * 3_600)),
    futureCandles: Array.from({ length: 24 }, (_, candleIndex) => candle(start + (48 + candleIndex) * 3_600, 3_000 + candleIndex * 4)),
    candles4h: Array.from({ length: 24 }, (_, candleIndex) => candle(start - (24 - candleIndex) * 14_400)),
    correctDirection: 'up', evidence: ['需求扩大', '回测供应收缩'],
    directionAnalysis: { up: '需求控制。', down: '供应没有扩大。', range: '已经出现方向。' },
    actualOutcome: '未来24小时上涨。', metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source: { pdfPath: 'assets/original.pdf', chapter: '第二章', pageStart: 80, pageEnd: 82 },
  }
}

const unit: ContentUnit = {
  id: 'unit-1', title: '市场自身行为', summary: '通过背景和价量证据判断供需。',
  source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 12 },
  excerpt: '根据市场自身行为判断。', keyPoints: ['先背景', '后证据'],
  bookQuestions: Array.from({ length: 20 }, (_, index) => question(index + 1)),
}

function Harness({ initialProgress, wrongItems = [] }: { initialProgress: ChallengeProgress; wrongItems?: WrongItem[] }) {
  const [progress, setProgress] = useState(initialProgress)
  const [items, setItems] = useState(wrongItems)
  return <ChallengeSessionPage
    unit={unit}
    allUnits={[unit]}
    marketCases={[replayCase(1), replayCase(2), replayCase(3)]}
    progress={progress}
    wrongItems={items}
    random={() => 0.9}
    now={() => new Date('2026-07-17T00:00:00.000Z')}
    onProgressChange={setProgress}
    onWrongItemChange={(item) => setItems((current) => [...current.filter((candidate) => candidate.questionId !== item.questionId), item])}
    onAttempt={vi.fn()}
    onOpenSource={vi.fn()}
    onReturnToMap={vi.fn()}
  />
}

describe('ChallengeSessionPage', () => {
  it('skips an empty review queue and resumes at the book quiz', async () => {
    render(<Harness initialProgress={createChallengeProgress(['unit-1'])} />)
    await waitFor(() => expect(screen.getByText('第 1 / 10 题')).toBeVisible())
    expect(screen.getByRole('heading', { name: '市场自身行为' })).toBeVisible()
    expect(screen.getByText('原书测验')).toBeVisible()
  })

  it('adds a wrong replay to the wrong list and switches cases before retry', async () => {
    const user = userEvent.setup()
    const progress = createChallengeProgress(['unit-1'])
    progress.unitStates['unit-1'] = { step: 'market-replay' }
    render(<Harness initialProgress={progress} />)

    expect(screen.getByRole('heading', { name: 'ETH 回放 1' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '下跌' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '换一个案例继续' }))
    expect(screen.getByRole('heading', { name: 'ETH 回放 2' })).toBeVisible()
  })
})
