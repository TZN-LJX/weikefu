import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MarketCase } from '../pack/contentSchema'
import { ReplayStep } from './ReplayStep'

vi.mock('../replay/MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

function candle(time: number, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

const start = 1_700_000_000
const marketCase: MarketCase = {
  id: 'case-1',
  unitId: 'unit-1',
  title: 'ETH 回放 01',
  symbol: 'ETHUSDT',
  market: 'Binance USD-M Futures',
  timeframe: '1h',
  cutoffTime: start + 48 * 3_600,
  horizonEndTime: start + 72 * 3_600,
  visibleCandles: Array.from({ length: 48 }, (_, index) => candle(start + index * 3_600)),
  futureCandles: Array.from({ length: 24 }, (_, index) => candle(start + (48 + index) * 3_600, 3_000 + index * 4)),
  candles4h: Array.from({ length: 24 }, (_, index) => candle(start - (24 - index) * 14_400)),
  correctDirection: 'up',
  evidence: ['回测时成交量收缩', '上涨波价格进展扩大'],
  directionAnalysis: {
    up: '需求控制市场，上涨最符合证据。',
    down: '截止点前没有持续扩大的供应。',
    range: '已经出现方向性价格进展。',
  },
  actualOutcome: '未来24小时收盘上涨3%。',
  metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
  source: { pdfPath: 'assets/original.pdf', chapter: '第二章 吸筹', pageStart: 80, pageEnd: 82 },
}

describe('ReplayStep', () => {
  it('keeps the 24 future candles hidden until one direction is submitted', async () => {
    const user = userEvent.setup()
    const onAnswered = vi.fn()
    render(<ReplayStep marketCase={marketCase} onAnswered={onAnswered} onOpenSource={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByTestId('chart')).toHaveTextContent('24 candles')
    await user.click(screen.getByRole('button', { name: '1小时走势' }))
    expect(screen.getByTestId('chart')).toHaveTextContent('48 candles')
    expect(screen.getByText('未来走势已隐藏')).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '提交走势判断' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: '下跌' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))

    expect(onAnswered).toHaveBeenCalledWith({ caseId: 'case-1', selectedDirection: 'down', correct: false })
    expect(screen.getByTestId('chart')).toHaveTextContent('72 candles')
    expect(screen.getByText('回答错误')).toBeVisible()
    expect(screen.getByText('标准答案：上涨')).toBeVisible()
    expect(screen.getByText('截止点前没有持续扩大的供应。')).toBeVisible()
    expect(screen.getByText('未来24小时收盘上涨3%。')).toBeVisible()
  })

  it('shows Binance timestamps, evidence, and the cited book source', async () => {
    const user = userEvent.setup()
    const onOpenSource = vi.fn()
    render(<ReplayStep marketCase={marketCase} onAnswered={vi.fn()} onOpenSource={onOpenSource} onContinue={vi.fn()} />)

    expect(screen.getByText('Binance USD-M Futures · ETHUSDT')).toBeVisible()
    expect(screen.getByText(/北京时间截止/)).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '上涨' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    expect(screen.getByText('回测时成交量收缩')).toBeVisible()
    expect(screen.getByText('第二章 吸筹 · 第 80-82 页')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '查看原书' }))
    expect(onOpenSource).toHaveBeenCalledWith(marketCase.source)
  })
})
