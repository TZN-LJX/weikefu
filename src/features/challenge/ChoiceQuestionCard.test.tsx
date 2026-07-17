import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChoiceQuestion } from '../pack/contentSchema'
import { ChoiceQuestionCard } from './ChoiceQuestionCard'

const question: ChoiceQuestion = {
  id: 'q1',
  prompt: '供需证据互相冲突时，最合理的处理是什么？',
  options: [
    { id: 'wait', label: '等待更多证据', explanation: '证据不足时保持等待，避免强行预测。' },
    { id: 'long', label: '立即做多', explanation: '没有需求占优证据，不能立即做多。' },
    { id: 'short', label: '立即做空', explanation: '没有供应占优证据，不能立即做空。' },
  ],
  correctOptionId: 'wait',
  explanation: '先判断背景，再比较价量努力与结果；证据冲突时不作方向结论。',
  source: { pdfPath: 'assets/original.pdf', chapter: '第一章 聪明钱的看盘顺序', pageStart: 12, pageEnd: 14 },
}

describe('ChoiceQuestionCard', () => {
  it('requires one selection and freezes the answer after submit', async () => {
    const user = userEvent.setup()
    const onAnswered = vi.fn()
    render(<ChoiceQuestionCard question={question} onAnswered={onAnswered} onOpenSource={vi.fn()} />)

    const submit = screen.getByRole('button', { name: '提交答案' })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '立即做多' }))
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(onAnswered).toHaveBeenCalledWith({ questionId: 'q1', selectedOptionId: 'long', correct: false })
    expect(screen.getByText('回答错误')).toBeVisible()
    expect(screen.getByText('标准答案：等待更多证据')).toBeVisible()
    expect(screen.getByText(question.explanation)).toBeVisible()
    expect(screen.getByText('没有需求占优证据，不能立即做多。')).toBeVisible()
    expect(screen.getByRole('radio', { name: '等待更多证据' })).toBeDisabled()
  })

  it('opens the cited original-book pages from feedback', async () => {
    const user = userEvent.setup()
    const onOpenSource = vi.fn()
    render(<ChoiceQuestionCard question={question} onAnswered={vi.fn()} onOpenSource={onOpenSource} />)
    await user.click(screen.getByRole('radio', { name: '等待更多证据' }))
    await user.click(screen.getByRole('button', { name: '提交答案' }))

    expect(screen.getByText('回答正确')).toBeVisible()
    expect(screen.getByText('第一章 聪明钱的看盘顺序 · 第 12-14 页')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '查看原书' }))
    expect(onOpenSource).toHaveBeenCalledWith(question.source)
  })
})
