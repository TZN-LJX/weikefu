import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createChallengeProgress } from '../../domain/challenge'
import { createChallengeContentFixture } from '../../test/fixtures/challengeContent'
import type { ContentUnit } from '../pack/contentSchema'
import { ChallengeMapPage } from './ChallengeMapPage'

const fixture = createChallengeContentFixture()
const units = fixture.course.stages.flatMap((stage) => stage.units) as ContentUnit[]

describe('ChallengeMapPage', () => {
  it('shows all 15 units, keeps standard units sequential, and opens training immediately', async () => {
    const user = userEvent.setup()
    const onOpenUnit = vi.fn()
    render(<ChallengeMapPage units={units} progress={createChallengeProgress(units)} wrongCount={3} onOpenUnit={onOpenUnit} onStartReinforcement={vi.fn()} />)

    expect(screen.getByText('15个知识单元 · 顺序解锁')).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(15)
    expect(screen.getByLabelText('3 道活跃错题')).toBeVisible()
    expect(screen.getByRole('button', { name: '开始 知识单元 1' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '开始 知识单元 2' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始 知识单元 1' }))
    expect(onOpenUnit).toHaveBeenCalledWith('unit-1')
    const trainingButton = screen.getByRole('button', { name: new RegExp(fixture.trainingUnit.title) })
    expect(trainingButton).toBeEnabled()
    await user.click(trainingButton)
    expect(onOpenUnit).toHaveBeenCalledWith(fixture.trainingUnit.id)
  })

  it('shows training progress and uses its start and continue commands', () => {
    const progress = createChallengeProgress(units)
    progress.unlockedUnitIndex = units.length - 1
    progress.unitStates[fixture.trainingUnit.id] = { step: 'case-training' }
    const { rerender } = render(<ChallengeMapPage units={units} progress={progress} wrongCount={0} onOpenUnit={vi.fn()} onStartReinforcement={vi.fn()} />)

    expect(screen.getByText('已完成 0/100')).toBeVisible()
    expect(screen.getByRole('button', { name: '开始 真实案例集训' })).toBeEnabled()

    progress.unitStates[fixture.trainingUnit.id] = {
      step: 'case-training',
      training: {
        caseOrder: fixture.trainingCases.map((marketCase) => marketCase.id),
        nextIndex: 37,
        correctCount: 30,
        wrongCount: 7,
        completedBySymbol: { ETHUSDT: 19, BTCUSDT: 18 },
        outcomes: {},
      },
    }
    rerender(<ChallengeMapPage units={units} progress={progress} wrongCount={0} onOpenUnit={vi.fn()} onStartReinforcement={vi.fn()} />)

    expect(screen.getByText('已完成 37/100')).toBeVisible()
    expect(screen.getByRole('button', { name: '继续 真实案例集训' })).toBeEnabled()
  })

  it('keeps standard units reopenable and shows reinforcement after training completes', () => {
    const progress = createChallengeProgress(units)
    for (const unit of units) progress.unitStates[unit.id] = { step: 'completed' }
    progress.unitStates[fixture.trainingUnit.id] = {
      step: 'completed',
      training: {
        caseOrder: fixture.trainingCases.map((marketCase) => marketCase.id),
        nextIndex: 100,
        correctCount: 80,
        wrongCount: 20,
        completedBySymbol: { ETHUSDT: 50, BTCUSDT: 50 },
        outcomes: {},
      },
    }
    progress.unlockedUnitIndex = 14
    progress.mode = 'reinforcement'
    render(<ChallengeMapPage units={units} progress={progress} wrongCount={0} onOpenUnit={vi.fn()} onStartReinforcement={vi.fn()} />)

    expect(screen.getByRole('button', { name: '重练 知识单元 1' })).toBeEnabled()
    expect(screen.getByText('已完成 100/100')).toBeVisible()
    expect(screen.getByRole('button', { name: '查看完成 真实案例集训' })).toBeEnabled()
    expect(screen.getByText('继续混合复习错题、原书题和 ETH/BTC 历史回放。')).toBeVisible()
    expect(screen.getByRole('button', { name: '开始无限巩固' })).toBeEnabled()
  })
})
