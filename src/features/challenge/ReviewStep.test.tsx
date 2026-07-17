import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { WrongItem } from '../../domain/challenge'
import type { ChoiceQuestion } from '../pack/contentSchema'
import { ReviewStep } from './ReviewStep'

const item: WrongItem = {
  questionId: 'q1', questionKind: 'book', unitId: 'unit-1', status: 'active', correctReviewCount: 3,
  lastWrongAt: '2026-07-16T00:00:00.000Z', nextReviewAt: '2026-07-17T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z',
}

const question: ChoiceQuestion = {
  id: 'q1', prompt: '证据不足时怎么办？',
  options: [
    { id: 'a', label: '等待', explanation: '等待更多证据。' },
    { id: 'b', label: '做多', explanation: '需求证据不足。' },
    { id: 'c', label: '做空', explanation: '供应证据不足。' },
  ],
  correctOptionId: 'a', explanation: '保持耐心。',
  source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 10 },
}

describe('ReviewStep', () => {
  it('records the scheduled review result and completes the queue', async () => {
    const user = userEvent.setup()
    const onReviewAnswer = vi.fn()
    const onComplete = vi.fn()
    render(<ReviewStep
      entries={[{ item, kind: 'book', question }]}
      onReviewAnswer={onReviewAnswer}
      onComplete={onComplete}
      onOpenSource={vi.fn()}
    />)

    expect(screen.getByText('错题回顾 1 / 1')).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '等待' }))
    await user.click(screen.getByRole('button', { name: '提交答案' }))
    expect(onReviewAnswer).toHaveBeenCalledWith(item, true)
    await user.click(screen.getByRole('button', { name: '完成错题回顾' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
