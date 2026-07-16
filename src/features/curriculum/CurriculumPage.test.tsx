import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CurriculumPage } from './CurriculumPage'

describe('CurriculumPage', () => {
  it('shows stages in order and keeps future stages locked', () => {
    render(<MemoryRouter><CurriculumPage stages={[
      { id: 's1', title: '风险纪律', goal: '控制单笔风险', units: [] },
      { id: 's2', title: '供需与背景', goal: '先背景后形态', units: [] },
    ]} unlockedStageIndex={0} /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '风险纪律' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '供需与背景' })).toBeVisible()
    expect(screen.getByText('当前阶段')).toBeVisible()
    expect(screen.getByText('尚未解锁')).toBeVisible()
  })
})
