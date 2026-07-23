import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ContentUnit, MarketCase } from '../pack/contentSchema'
import { ReplayStep } from './ReplayStep'

vi.mock('../replay/MarketChart', () => ({
  MarketChart: ({ candles, annotations = [] }: { candles: unknown[]; annotations?: unknown[] }) => (
    <div data-testid="chart" data-marker-count={annotations.length}>{candles.length} candles</div>
  ),
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
  cutoffJudgment: 'range',
  evidence: [`${start + 30 * 3_600}回测时成交量收缩`, 'recentReturn为0.03，上涨波价格进展扩大'],
  directionAnalysis: {
    up: '需求控制市场，上涨最符合证据。',
    down: '截止点前没有持续扩大的供应。',
    range: '已经出现方向性价格进展。',
  },
  actualOutcome: 'return24h: 0.03，1678640400后上涨。',
  metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
  source: { pdfPath: 'assets/original.pdf', chapter: '第二章 吸筹', pageStart: 80, pageEnd: 82 },
}

const unit = {
  id: 'unit-1', title: '看盘顺序', summary: '按固定顺序分析。',
  source: marketCase.source,
  excerpt: '“聪明钱的看图顺序：背景、价量形态、性质、结论和行动。”',
  excerptPage: 19,
  keyPoints: ['背景', '价量'], bookQuestions: [],
} as unknown as ContentUnit

describe('ReplayStep', () => {
  it('keeps the 24 future candles hidden until one direction is submitted', async () => {
    const user = userEvent.setup()
    const onAnswered = vi.fn()
    const { container } = render(<ReplayStep marketCase={marketCase} unit={unit} onAnswered={onAnswered} onOpenSource={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByTestId('chart')).toHaveTextContent('24 candles')
    expect(screen.getByTestId('chart')).toHaveAttribute('data-marker-count', '0')
    expect(screen.queryByText('辅助统计')).not.toBeInTheDocument()
    expect(screen.queryByText('复盘SOP')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1小时走势' }))
    expect(screen.getByTestId('chart')).toHaveTextContent('48 candles')
    expect(screen.getByText('未来走势已隐藏')).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '提交走势判断' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: '下跌' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))

    expect(onAnswered).toHaveBeenCalledWith({ caseId: 'case-1', selectedDirection: 'down', correct: false })
    expect(screen.getByTestId('chart')).toHaveTextContent('72 candles')
    expect(screen.getByTestId('chart')).toHaveAttribute('data-marker-count', '1')
    expect(screen.getByText('回答错误')).toBeVisible()
    expect(screen.getByText('实际结果标签：上涨')).toBeVisible()
    expect(screen.getByText('等待／方向不明')).toBeVisible()
    expect(screen.getByRole('heading', { name: '辅助统计' })).toBeVisible()
    expect(screen.getByText('最近24小时涨跌幅')).toBeVisible()
    expect(screen.getByRole('heading', { name: '复盘SOP' })).toBeVisible()
    expect(screen.getByText('背景与关键位置')).toBeVisible()
    expect(screen.getByText('“识别支撑和阻力。（用价格判断）”')).toBeVisible()
    expect(screen.getByText('截止点前没有持续扩大的供应。')).toBeVisible()
    expect(container.querySelector('.direction-analysis .is-correct')).toHaveTextContent('震荡／方向不明')
    expect(container.querySelector('.actual-outcome')).not.toHaveTextContent(/return24h|\b1\d{9}\b/)
    expect(container.querySelector('.actual-outcome')).toHaveTextContent('北京时间')
  })

  it('shows Binance timestamps, evidence, and the cited book source', async () => {
    const user = userEvent.setup()
    const onOpenSource = vi.fn()
    render(<ReplayStep marketCase={marketCase} unit={unit} onAnswered={vi.fn()} onOpenSource={onOpenSource} onContinue={vi.fn()} />)

    expect(screen.getByText('Binance USD-M Futures · ETHUSDT')).toBeVisible()
    expect(screen.getByText(/截止 .*（北京时间）/)).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '上涨' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    expect(screen.getByText(/A柱（.*北京时间.*回测时成交量收缩/)).toBeVisible()
    expect(screen.getByText('本单元原书依据')).toBeVisible()
    expect(screen.getByText(unit.excerpt)).toBeVisible()
    expect(screen.getAllByText('原书第19页').length).toBeGreaterThan(0)
    expect(screen.getByText('第二章 吸筹 · 第 80-82 页')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '查看原书' }))
    expect(onOpenSource).toHaveBeenCalledWith(marketCase.source)
  })
})
