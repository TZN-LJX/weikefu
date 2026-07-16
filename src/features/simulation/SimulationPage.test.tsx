import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SimulationPage } from './SimulationPage'

describe('SimulationPage', () => {
  it('blocks a trade and lists missing analysis requirements', async () => {
    const user = userEvent.setup()
    render(<SimulationPage equity={1_000} onCreateTrade={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '计算并提交模拟订单' }))
    expect(screen.getByText('需要先判断 4 小时市场背景')).toBeVisible()
    expect(screen.getByText('需要填写判断失效条件')).toBeVisible()
  })

  it('creates one valid risk-capped simulation trade', async () => {
    const user = userEvent.setup()
    const onCreateTrade = vi.fn()
    render(<SimulationPage equity={1_000} onCreateTrade={onCreateTrade} />)

    await user.selectOptions(screen.getByLabelText('方向'), 'long')
    await user.clear(screen.getByLabelText('入场价'))
    await user.type(screen.getByLabelText('入场价'), '3000')
    await user.clear(screen.getByLabelText('止损价'))
    await user.type(screen.getByLabelText('止损价'), '2970')
    await user.clear(screen.getByLabelText('目标价'))
    await user.type(screen.getByLabelText('目标价'), '3090')
    await user.selectOptions(screen.getByLabelText('4小时市场背景'), '需求背景')
    await user.selectOptions(screen.getByLabelText('1小时结构'), '吸筹右侧')
    await user.click(screen.getByLabelText('回测缩量'))
    await user.type(screen.getByLabelText('入场确认条件'), '出现需求柱')
    await user.type(screen.getByLabelText('判断失效条件'), '放量跌破支撑')
    await user.click(screen.getByLabelText('我已检查不交易理由'))
    await user.click(screen.getByRole('button', { name: '计算并提交模拟订单' }))

    expect(onCreateTrade).toHaveBeenCalledOnce()
    expect(screen.getByText('最大名义仓位')).toBeVisible()
    expect(screen.getByText('3.00 R')).toBeVisible()
  })
})
