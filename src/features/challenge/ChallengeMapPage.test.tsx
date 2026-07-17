import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createChallengeProgress } from '../../domain/challenge'
import type { ContentUnit } from '../pack/contentSchema'
import { ChallengeMapPage } from './ChallengeMapPage'

const units = Array.from({ length: 14 }, (_, index) => ({ id: `unit-${index + 1}`, title: `知识单元 ${index + 1}`, summary: `目标 ${index + 1}` })) as ContentUnit[]

describe('ChallengeMapPage', () => {
  it('shows all 14 units and only opens the first unlocked unit', async () => {
    const user = userEvent.setup()
    const onOpenUnit = vi.fn()
    render(<ChallengeMapPage units={units} progress={createChallengeProgress(units.map((unit) => unit.id))} wrongCount={3} onOpenUnit={onOpenUnit} onStartReinforcement={vi.fn()} />)

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(14)
    expect(screen.getByLabelText('3 道活跃错题')).toBeVisible()
    expect(screen.getByRole('button', { name: '开始 知识单元 1' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '开始 知识单元 2' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始 知识单元 1' }))
    expect(onOpenUnit).toHaveBeenCalledWith('unit-1')
  })

  it('keeps completed units reopenable and shows reinforcement after all units', () => {
    const progress = createChallengeProgress(units.map((unit) => unit.id))
    for (const unit of units) progress.unitStates[unit.id] = { step: 'completed' }
    progress.unlockedUnitIndex = 13
    progress.mode = 'reinforcement'
    render(<ChallengeMapPage units={units} progress={progress} wrongCount={0} onOpenUnit={vi.fn()} onStartReinforcement={vi.fn()} />)

    expect(screen.getByRole('button', { name: '重练 知识单元 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '开始无限巩固' })).toBeEnabled()
  })
})
