import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JournalForm } from './JournalForm'

describe('JournalForm', () => {
  it('accepts a process-correct losing trade classification', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<JournalForm tradeId="t1" onSave={onSave} />)

    await user.type(screen.getByLabelText('市场背景与阶段'), '4h需求背景，1h吸筹右侧')
    await user.type(screen.getByLabelText('关键价量证据'), 'Spring测试缩量')
    await user.selectOptions(screen.getByLabelText('情绪状态'), 'calm')
    await user.selectOptions(screen.getByLabelText('复盘分类'), 'valid-loss')
    await user.type(screen.getByLabelText('复盘结论'), '过程符合规则，接受一次正常止损')
    await user.click(screen.getByRole('button', { name: '保存复盘' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      tradeId: 't1',
      category: 'valid-loss',
      ruleViolation: false,
    }))
  })
})
