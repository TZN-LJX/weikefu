import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExercisePage } from './ExercisePage'

const exercise = {
  id: 'effort-result-1',
  prompt: '当前哪一方控制市场？',
  options: [
    { id: 'demand', label: '需求控制' },
    { id: 'supply', label: '供应控制' },
    { id: 'unclear', label: '暂不明确' },
  ],
  correctOptionId: 'supply',
  evidence: [
    { id: 'down-wave', label: '下跌波价差扩大且成交量增加' },
    { id: 'weak-rally', label: '反弹阳线缩短且成交量递减' },
  ],
  requiredEvidenceIds: ['down-wave', 'weak-rally'],
  explanationPrompt: '如果需求控制市场，反弹应该出现什么行为？',
}

describe('ExercisePage', () => {
  it('opens evidence feedback without revealing the standard answer after an error', async () => {
    const user = userEvent.setup()
    render(<ExercisePage exercise={exercise} onComplete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '需求控制' }))
    await user.click(screen.getByRole('button', { name: '提交判断' }))

    expect(screen.getByRole('heading', { name: '重新检查证据' })).toBeVisible()
    expect(screen.getByText('下跌波价差扩大且成交量增加')).toBeVisible()
    expect(screen.queryByText('标准答案：供应控制')).not.toBeInTheDocument()
  })
})
