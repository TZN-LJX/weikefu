import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReplayPage } from './ReplayPage'

vi.mock('./MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

const candles = Array.from({ length: 110 }, (_, index) => ({
  time: 1_700_000_000 + index * 3_600,
  open: 3_000 + index,
  high: 3_006 + index,
  low: 2_994 + index,
  close: 3_002 + index,
  volume: 100 + index,
}))

describe('ReplayPage', () => {
  it('starts with the 4h background chart when multi-timeframe data is available', async () => {
    const user = userEvent.setup()
    render(<ReplayPage marketCase={{
      id: 'case-mtf', title: '多周期判断', timeframe: '1h', context4h: '4h', candles, candles4h: candles.slice(0, 30), cutoff: 100,
      evidenceOptions: [{ id: 'e1', label: '回测缩量' }],
    }} onComplete={vi.fn()} />)
    expect(screen.getByTestId('chart')).toHaveTextContent('30 candles')
    await user.click(screen.getByRole('button', { name: '1小时结构' }))
    expect(screen.getByTestId('chart')).toHaveTextContent('100 candles')
  })

  it('reveals future candles only after a complete submission', async () => {
    const user = userEvent.setup()
    render(<ReplayPage marketCase={{
      id: 'case-1',
      title: 'ETH 供需判断',
      timeframe: '1h',
      context4h: '4h',
      candles,
      cutoff: 100,
      evidenceOptions: [
        { id: 'e1', label: '下跌波价差扩大' },
        { id: 'e2', label: '反弹成交量递减' },
      ],
    }} onComplete={vi.fn()} />)

    expect(screen.getByTestId('chart')).toHaveTextContent('100 candles')
    expect(screen.queryByRole('button', { name: '揭示后续 5 根K线' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('4小时市场背景'), 'bearish')
    await user.selectOptions(screen.getByLabelText('1小时结构'), 'distribution')
    await user.click(screen.getByLabelText('下跌波价差扩大'))
    await user.click(screen.getByLabelText('不交易'))
    await user.type(screen.getByLabelText('判断失效条件'), '放量突破阻力并回测成功')
    await user.click(screen.getByRole('button', { name: '提交整体判断' }))

    expect(screen.getByRole('button', { name: '揭示后续 5 根K线' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '揭示后续 5 根K线' }))
    expect(screen.getByTestId('chart')).toHaveTextContent('105 candles')
  })
})
