import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CaseTrainingProgress } from '../../domain/challenge'
import { createChallengeContentFixture } from '../../test/fixtures/challengeContent'
import type { ContentUnit, Direction, MarketCase } from '../pack/contentSchema'
import { CaseTrainingStep } from './CaseTrainingStep'

vi.mock('../replay/MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

const directionLabels: Record<Direction, string> = {
  up: '上涨',
  down: '下跌',
  range: '震荡／方向不明',
}

function wrongDirection(marketCase: MarketCase): Direction {
  return marketCase.correctDirection === 'up' ? 'down' : 'up'
}

function trainingProgress(caseOrder: string[], nextIndex: number): CaseTrainingProgress {
  return {
    caseOrder,
    nextIndex,
    correctCount: 20,
    wrongCount: 16,
    completedBySymbol: { ETHUSDT: 18, BTCUSDT: 18 },
    outcomes: {},
  }
}

describe('CaseTrainingStep', () => {
  it('shows fixed counters and forwards a wrong answer before advancing', async () => {
    const user = userEvent.setup()
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const marketCase = trainingCases.find((candidate) => candidate.symbol === 'BTCUSDT')!
    const caseOrder = trainingCases.map((candidate) => candidate.id)
    caseOrder.splice(caseOrder.indexOf(marketCase.id), 1)
    caseOrder.splice(36, 0, marketCase.id)
    const onAnswered = vi.fn()
    const onWrong = vi.fn()
    const onAdvance = vi.fn()

    render(<CaseTrainingStep
      marketCase={marketCase}
      unit={trainingUnit as ContentUnit}
      progress={trainingProgress(caseOrder, 36)}
      onAnswered={onAnswered}
      onWrong={onWrong}
      onAdvance={onAdvance}
      onOpenSource={vi.fn()}
    />)

    expect(screen.getByText('真实案例集训 37/100')).toBeVisible()
    expect(screen.getByText('正确 20')).toBeVisible()
    expect(screen.getByText('错误 16')).toBeVisible()
    expect(screen.getByText('ETH 18')).toBeVisible()
    expect(screen.getByText('BTC 18')).toBeVisible()

    await user.click(screen.getByRole('radio', { name: directionLabels[wrongDirection(marketCase)] }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))

    const answer = {
      caseId: marketCase.id,
      selectedDirection: wrongDirection(marketCase),
      correct: false,
    }
    expect(onAnswered).toHaveBeenCalledWith(answer)
    expect(onWrong).toHaveBeenCalledWith(answer)

    await user.click(screen.getByRole('button', { name: '下一案例（38/100）' }))
    expect(onAdvance).toHaveBeenCalledWith({ caseId: marketCase.id, correct: false })
  })

  it('labels the last continue action as training completion', async () => {
    const user = userEvent.setup()
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const marketCase = trainingCases[99]

    render(<CaseTrainingStep
      marketCase={marketCase}
      unit={trainingUnit as ContentUnit}
      progress={{
        caseOrder: trainingCases.map((candidate) => candidate.id),
        nextIndex: 99,
        correctCount: 50,
        wrongCount: 49,
        completedBySymbol: { ETHUSDT: 50, BTCUSDT: 49 },
        outcomes: {},
      }}
      onAnswered={vi.fn()}
      onWrong={vi.fn()}
      onAdvance={vi.fn()}
      onOpenSource={vi.fn()}
    />)

    await user.click(screen.getByRole('radio', { name: directionLabels[marketCase.correctDirection] }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))

    expect(screen.getByRole('button', { name: '完成真实案例集训' })).toBeVisible()
  })
})
