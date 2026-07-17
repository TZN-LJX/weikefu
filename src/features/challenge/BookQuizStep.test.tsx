import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChoiceQuestion } from '../pack/contentSchema'
import { BookQuizStep } from './BookQuizStep'

function question(index: number): ChoiceQuestion {
  return {
    id: `q${index}`,
    prompt: `原书题 ${index}`,
    options: [
      { id: 'a', label: `正确 ${index}`, explanation: '符合原书的供需判断顺序。' },
      { id: 'b', label: `错误甲 ${index}`, explanation: '忽略了市场背景。' },
      { id: 'c', label: `错误乙 ${index}`, explanation: '把单根K线当成完整证据。' },
    ],
    correctOptionId: 'a',
    explanation: '先背景、再价量证据、最后结论。',
    source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 10 },
  }
}

async function answerCurrent(user: ReturnType<typeof userEvent.setup>, correct: boolean, isLast: boolean) {
  await user.click(screen.getByRole('radio', { name: new RegExp(correct ? '^正确' : '^错误甲') }))
  await user.click(screen.getByRole('button', { name: '提交答案' }))
  await user.click(screen.getByRole('button', { name: isLast ? '查看本轮结果' : '下一题' }))
}

describe('BookQuizStep', () => {
  it('passes at eight correct answers out of ten and records errors', async () => {
    const user = userEvent.setup()
    const onWrong = vi.fn()
    const onPassed = vi.fn()
    render(<BookQuizStep
      unitId="unit-1"
      questionPool={Array.from({ length: 20 }, (_, index) => question(index + 1))}
      random={() => 0.5}
      onWrong={onWrong}
      onPassed={onPassed}
      onOpenSource={vi.fn()}
    />)

    for (let index = 0; index < 10; index += 1) await answerCurrent(user, index < 8, index === 9)

    expect(screen.getByRole('heading', { name: '本轮通过' })).toBeVisible()
    expect(screen.getByText('答对 8 / 10')).toBeVisible()
    expect(onWrong).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: '进入ETH历史回放' }))
    expect(onPassed).toHaveBeenCalledTimes(1)
  })

  it('requires a fresh attempt below eight correct answers', async () => {
    const user = userEvent.setup()
    render(<BookQuizStep
      unitId="unit-1"
      questionPool={Array.from({ length: 20 }, (_, index) => question(index + 1))}
      random={() => 0.25}
      onWrong={vi.fn()}
      onPassed={vi.fn()}
      onOpenSource={vi.fn()}
    />)

    for (let index = 0; index < 10; index += 1) await answerCurrent(user, index < 7, index === 9)

    expect(screen.getByRole('heading', { name: '本轮未通过' })).toBeVisible()
    expect(screen.getByText('答对 7 / 10')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '重新随机测验' }))
    expect(screen.getByText('第 1 / 10 题')).toBeVisible()
  })
})
