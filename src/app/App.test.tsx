import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createBackup } from '../db/backup'
import { createChallengeProgress, type CaseTrainingProgress, type ChallengeProgress } from '../domain/challenge'
import { createChallengeContentFixture } from '../test/fixtures/challengeContent'
import { AppContent } from './App'

vi.mock('../features/replay/MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

function fakeRepositories(hasPack: boolean, savedProgress?: ChallengeProgress) {
  const { course, marketCases } = createChallengeContentFixture()
  return {
    getActivePack: vi.fn(async () => hasPack ? { id: 'core', title: '私人课程', version: '2.0.0', active: true, importedAt: '' } : undefined),
    getJsonAsset: vi.fn(async (path: string) => path.includes('course') ? course : marketCases),
    getChallengeProgress: vi.fn(async () => savedProgress),
    getWrongItems: vi.fn(async () => []),
    saveChallengeProgress: vi.fn(async (_progress: ChallengeProgress) => undefined),
    saveChallengeAttempt: vi.fn(async () => undefined),
    saveWrongItem: vi.fn(async () => undefined),
    savePack: vi.fn(), clearPartial: vi.fn(), deleteActivePack: vi.fn(), setSetting: vi.fn(), getSetting: vi.fn(), getAsset: vi.fn(),
    resetChallengeProgress: vi.fn(), getBackupSnapshot: vi.fn(async () => ({ challengeProgress: [], challengeAttempts: [], wrongItems: [], settings: {} })), restoreProgress: vi.fn(),
  }
}

function completedTrainingProgress(): ChallengeProgress {
  const { course, trainingCases, trainingUnit } = createChallengeContentFixture()
  const unitIds = course.stages.flatMap((stage) => stage.units).map((unit) => unit.id)
  const outcomes: CaseTrainingProgress['outcomes'] = Object.fromEntries(trainingCases.map((marketCase) => [
    marketCase.id,
    { correct: true, symbol: marketCase.symbol },
  ]))
  const progress = createChallengeProgress(unitIds)
  progress.unlockedUnitIndex = unitIds.length - 1
  progress.unitStates[trainingUnit.id] = {
    step: 'completed',
    training: {
      caseOrder: trainingCases.map((marketCase) => marketCase.id),
      nextIndex: 100,
      correctCount: 100,
      wrongCount: 0,
      completedBySymbol: { ETHUSDT: 50, BTCUSDT: 50 },
      outcomes,
    },
  }
  progress.mode = 'reinforcement'
  return progress
}

function uninitializedTrainingProgress(): ChallengeProgress {
  const { course, trainingUnit } = createChallengeContentFixture()
  const unitIds = course.stages.flatMap((stage) => stage.units).map((unit) => unit.id)
  const progress = createChallengeProgress(unitIds)
  progress.unlockedUnitIndex = unitIds.length - 1
  progress.unitStates[trainingUnit.id] = { step: 'case-training' }
  return progress
}

function completedStandardProgress(): ChallengeProgress {
  const { course, standardUnits } = createChallengeContentFixture()
  const units = course.stages.flatMap((stage) => stage.units)
  const progress = createChallengeProgress(units)
  progress.unitStates[standardUnits[0].id] = { step: 'completed' }
  return progress
}

function overlappingProgress(): ChallengeProgress {
  const { course, standardUnits, trainingCases, trainingUnit } = createChallengeContentFixture()
  const unitIds = course.stages.flatMap((stage) => stage.units).map((unit) => unit.id)
  const completedCases = trainingCases.slice(0, 99)
  const outcomes: CaseTrainingProgress['outcomes'] = Object.fromEntries(completedCases.map((marketCase) => [
    marketCase.id,
    { correct: true, symbol: marketCase.symbol },
  ]))
  const progress = createChallengeProgress(unitIds)
  progress.unlockedUnitIndex = unitIds.length - 1
  progress.unitStates[standardUnits[0].id] = { step: 'completed' }
  progress.unitStates[trainingUnit.id] = {
    step: 'case-training',
    training: {
      caseOrder: trainingCases.map((marketCase) => marketCase.id),
      nextIndex: 99,
      correctCount: 99,
      wrongCount: 0,
      completedBySymbol: { ETHUSDT: 50, BTCUSDT: 49 },
      outcomes,
    },
  }
  return progress
}

function finalStandardPendingProgress(): ChallengeProgress {
  const { standardUnits } = createChallengeContentFixture()
  const progress = overlappingProgress()
  for (const unit of standardUnits.slice(0, -1)) progress.unitStates[unit.id] = { step: 'completed' }
  progress.unitStates[standardUnits.at(-1)!.id] = { step: 'market-replay' }
  progress.unlockedUnitIndex = standardUnits.length - 1
  return progress
}

function legacyProgress(completed: boolean): ChallengeProgress {
  const { standardUnits } = createChallengeContentFixture()
  const progress = createChallengeProgress(standardUnits.map((unit) => unit.id), new Date('2026-07-22T00:00:00.000Z'))
  if (completed) {
    for (const unit of standardUnits) progress.unitStates[unit.id] = { step: 'completed' }
    progress.unlockedUnitIndex = standardUnits.length - 1
    progress.mode = 'reinforcement'
    return progress
  }

  progress.unlockedUnitIndex = 9
  for (const unit of standardUnits.slice(0, 9)) progress.unitStates[unit.id] = { step: 'completed' }
  progress.unitStates[standardUnits[9].id] = { step: 'book-quiz' }
  return progress
}

function activeTrainingProgress(nextIndex = 37): ChallengeProgress {
  const { course, trainingCases, trainingUnit } = createChallengeContentFixture()
  const units = course.stages.flatMap((stage) => stage.units)
  const completedCases = trainingCases.slice(0, nextIndex)
  const outcomes: CaseTrainingProgress['outcomes'] = Object.fromEntries(completedCases.map((marketCase) => [
    marketCase.id,
    { correct: true, symbol: marketCase.symbol },
  ]))
  const progress = createChallengeProgress(units)
  progress.unlockedUnitIndex = units.length - 1
  progress.unitStates[trainingUnit.id] = {
    step: 'case-training',
    training: {
      caseOrder: trainingCases.map((marketCase) => marketCase.id),
      nextIndex,
      correctCount: nextIndex,
      wrongCount: 0,
      completedBySymbol: {
        ETHUSDT: completedCases.filter((marketCase) => marketCase.symbol === 'ETHUSDT').length,
        BTCUSDT: completedCases.filter((marketCase) => marketCase.symbol === 'BTCUSDT').length,
      },
      outcomes,
    },
  }
  return progress
}

describe('AppContent', () => {
  it('gates the app behind a valid private learning pack', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(false) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '导入私人学习包' })).toBeVisible()
    expect(screen.queryByText('闯关地图')).not.toBeInTheDocument()
  })

  it('opens the challenge map after loading private content', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(true) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '闯关地图' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '知识单元 1' })).toBeVisible()
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument()
  })

  it('migrates completed legacy progress into the unlocked training unit', async () => {
    const { standardUnits, trainingUnit } = createChallengeContentFixture()
    const repositories = fakeRepositories(true, legacyProgress(true))
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: '开始 真实案例集训' })).toBeEnabled()
    await waitFor(() => expect(repositories.saveChallengeProgress).toHaveBeenCalledTimes(1))
    const migrated = repositories.saveChallengeProgress.mock.calls[0][0]
    expect(migrated.unitOrder).toEqual([...standardUnits.map((unit) => unit.id), trainingUnit.id])
    expect(standardUnits.every((unit) => migrated.unitStates[unit.id].step === 'completed')).toBe(true)
    expect(migrated.unitStates[trainingUnit.id]).toEqual({ step: 'case-training' })
    expect(migrated.unlockedUnitIndex).toBe(14)
    expect(migrated.mode).toBe('course')
  })

  it('migrates incomplete legacy progress while making training immediately available', async () => {
    const { standardUnits, trainingUnit } = createChallengeContentFixture()
    const savedProgress = legacyProgress(false)
    const repositories = fakeRepositories(true, savedProgress)
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: trainingUnit.title })).toBeVisible()
    await waitFor(() => expect(repositories.saveChallengeProgress).toHaveBeenCalledTimes(1))
    const migrated = repositories.saveChallengeProgress.mock.calls[0][0]
    expect(migrated.unitStates[standardUnits[0].id]).toEqual({ step: 'completed' })
    expect(migrated.unitStates[standardUnits[9].id]).toEqual({ step: 'book-quiz' })
    expect(migrated.unitStates[trainingUnit.id]).toEqual({ step: 'case-training' })
    expect(migrated.unlockedUnitIndex).toBe(savedProgress.unlockedUnitIndex)
    expect(migrated.mode).toBe(savedProgress.mode)
    expect(screen.getByRole('button', { name: new RegExp(trainingUnit.title) })).toBeEnabled()
  })

  it('preserves valid training progress without persisting it again', async () => {
    const { trainingUnit } = createChallengeContentFixture()
    const savedProgress = activeTrainingProgress()
    const repositories = fakeRepositories(true, savedProgress)
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    expect(await screen.findByText('已完成 37/100')).toBeVisible()
    expect(screen.getByRole('button', { name: '继续 真实案例集训' })).toBeEnabled()
    expect(repositories.saveChallengeProgress).not.toHaveBeenCalled()
    expect(savedProgress.unitStates[trainingUnit.id].training?.nextIndex).toBe(37)
  })

  it('reopens completed case training without discarding its saved history', async () => {
    const user = userEvent.setup()
    const progress = completedTrainingProgress()
    const repositories = fakeRepositories(true, progress)
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '查看完成 真实案例集训' }))

    expect(await screen.findByRole('heading', { name: '真实案例集训完成' })).toBeVisible()
    expect(repositories.saveChallengeProgress).not.toHaveBeenCalled()
    expect(progress.unitStates['stage-8-real-case-training'].training?.outcomes).toHaveProperty(
      progress.unitStates['stage-8-real-case-training'].training!.caseOrder[0],
    )
  })

  it('does not publish a training order when persistence fails', async () => {
    const user = userEvent.setup()
    const repositories = fakeRepositories(true, uninitializedTrainingProgress())
    repositories.saveChallengeProgress.mockRejectedValue(new Error('真实案例顺序保存失败'))
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))
    expect(await screen.findByText('真实案例顺序保存失败')).toBeVisible()

    await user.click(screen.getByTitle('返回闯关地图'))
    await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))

    expect(await screen.findByText('真实案例顺序保存失败')).toBeVisible()
    expect(screen.queryByRole('heading', { name: /回放/ })).not.toBeInTheDocument()
    expect(repositories.saveChallengeProgress).toHaveBeenCalledTimes(2)
  })

  it('immediately reopens a completed standard unit while persistence is pending', async () => {
    const user = userEvent.setup()
    const repositories = fakeRepositories(true, completedStandardProgress())
    repositories.saveChallengeProgress.mockImplementation(() => new Promise(() => undefined))
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '重练 知识单元 1' }))

    expect(await screen.findByText('第 1 / 10 题')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '本单元完成' })).not.toBeInTheDocument()
  })

  it('keeps the standard optimistic reset when persistence rejects', async () => {
    const user = userEvent.setup()
    const repositories = fakeRepositories(true, completedStandardProgress())
    repositories.saveChallengeProgress.mockRejectedValue(new Error('标准进度保存失败'))
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '重练 知识单元 1' }))

    expect(await screen.findByText('第 1 / 10 题')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '本单元完成' })).not.toBeInTheDocument()
  })

  it('serializes overlapping training and standard progress without stale overwrite', async () => {
    const user = userEvent.setup()
    const { standardUnits, trainingCases, trainingUnit } = createChallengeContentFixture()
    const repositories = fakeRepositories(true, overlappingProgress())
    let releaseTrainingWrite!: () => void
    const trainingWrite = new Promise<void>((resolve) => { releaseTrainingWrite = resolve })
    const startedWrites: ChallengeProgress[] = []
    let persistedProgress: ChallengeProgress | undefined
    repositories.saveChallengeProgress.mockImplementation(async (progress) => {
      const writeIndex = startedWrites.push(progress) - 1
      if (writeIndex === 0) await trainingWrite
      persistedProgress = progress
    })
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '继续 真实案例集训' }))
    const finalCase = trainingCases[99]
    const correctLabel = finalCase.correctDirection === 'up' ? '上涨' : finalCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'
    await user.click(screen.getByRole('radio', { name: correctLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '完成真实案例集训' }))
    expect(await screen.findByText('正在保存案例进度...')).toBeVisible()

    await user.click(screen.getByTitle('返回闯关地图'))
    await user.click(await screen.findByRole('button', { name: '重练 知识单元 1' }))
    expect(await screen.findByText('第 1 / 10 题')).toBeVisible()
    expect(startedWrites).toHaveLength(1)

    releaseTrainingWrite()

    await waitFor(() => expect(startedWrites.length).toBeGreaterThanOrEqual(3))
    await waitFor(() => expect(persistedProgress?.unitStates[standardUnits[0].id].step).toBe('book-quiz'))
    expect(persistedProgress?.unitStates[trainingUnit.id].step).toBe('completed')
    expect(screen.getByText('第 1 / 10 题')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '本单元完成' })).not.toBeInTheDocument()

    await user.click(screen.getByTitle('返回闯关地图'))
    expect(await screen.findByRole('button', { name: '查看完成 真实案例集训' })).toBeVisible()
  })

  it('derives reinforcement mode after merging completed training into the final standard save', async () => {
    const user = userEvent.setup()
    const { standardUnits, standardCases, trainingCases, trainingUnit } = createChallengeContentFixture()
    const repositories = fakeRepositories(true, finalStandardPendingProgress())
    let releaseTrainingWrite!: () => void
    const trainingWrite = new Promise<void>((resolve) => { releaseTrainingWrite = resolve })
    const startedWrites: ChallengeProgress[] = []
    let persistedProgress: ChallengeProgress | undefined
    repositories.saveChallengeProgress.mockImplementation(async (progress) => {
      const writeIndex = startedWrites.push(progress) - 1
      if (writeIndex === 0) await trainingWrite
      persistedProgress = progress
    })
    render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /真实案例集训/ }))
    const finalTrainingCase = trainingCases[99]
    const finalTrainingLabel = finalTrainingCase.correctDirection === 'up' ? '上涨' : finalTrainingCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'
    await user.click(screen.getByRole('radio', { name: finalTrainingLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '完成真实案例集训' }))
    expect(await screen.findByText('正在保存案例进度...')).toBeVisible()

    await user.click(screen.getByTitle('返回闯关地图'))
    const finalStandardUnit = standardUnits.at(-1)!
    await user.click(await screen.findByRole('button', { name: new RegExp(finalStandardUnit.title) }))
    const visibleTitle = await screen.findByRole('heading', { level: 2 }).then((heading) => heading.textContent)
    const visibleCase = standardCases.find((marketCase) => marketCase.title === visibleTitle && marketCase.unitId === finalStandardUnit.id)!
    const standardLabel = visibleCase.correctDirection === 'up' ? '上涨' : visibleCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'
    await user.click(screen.getByRole('radio', { name: standardLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '完成本单元' }))
    expect(startedWrites).toHaveLength(1)

    releaseTrainingWrite()

    await waitFor(() => expect(startedWrites).toHaveLength(2))
    expect(persistedProgress?.unitStates[trainingUnit.id].step).toBe('completed')
    expect(persistedProgress?.unitStates[finalStandardUnit.id].step).toBe('completed')
    expect(persistedProgress?.mode).toBe('reinforcement')
  })

  it('publishes the snapshot that a queued training initialization persisted', async () => {
    const user = userEvent.setup()
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const repositories = fakeRepositories(true, uninitializedTrainingProgress())
    let releaseFirstWrite!: () => void
    const firstWrite = new Promise<void>((resolve) => { releaseFirstWrite = resolve })
    const persistedWrites: ChallengeProgress[] = []
    repositories.saveChallengeProgress.mockImplementation(async (progress) => {
      if (persistedWrites.length === 0) await firstWrite
      persistedWrites.push(progress)
    })
    let randomCalls = 0
    const random = vi.spyOn(Math, 'random').mockImplementation(() => randomCalls++ < 198 ? 0 : 0.999)

    try {
      render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

      await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))
      expect(await screen.findByText('正在保存真实案例顺序...')).toBeVisible()
      await user.click(screen.getByTitle('返回闯关地图'))
      await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))
      expect(await screen.findByText('正在保存真实案例顺序...')).toBeVisible()

      releaseFirstWrite()

      await waitFor(() => expect(persistedWrites).toHaveLength(2))
      const persistedTraining = persistedWrites[1].unitStates[trainingUnit.id].training!
      const persistedActiveCase = trainingCases.find((marketCase) => marketCase.id === persistedTraining.caseOrder[0])!
      expect(await screen.findByRole('heading', { name: persistedActiveCase.title })).toBeVisible()
    } finally {
      random.mockRestore()
    }
  })

  it('does not overwrite newer queued training progress with an older training write', async () => {
    const user = userEvent.setup()
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const olderRepositories = fakeRepositories(true, uninitializedTrainingProgress())
    const newerRepositories = fakeRepositories(true, overlappingProgress())
    let releaseOlderWrite!: () => void
    const olderWrite = new Promise<void>((resolve) => { releaseOlderWrite = resolve })
    const persistedWrites: ChallengeProgress[] = []
    olderRepositories.saveChallengeProgress.mockImplementation(async (progress) => {
      await olderWrite
      persistedWrites.push(progress)
    })
    newerRepositories.saveChallengeProgress.mockImplementation(async (progress) => {
      persistedWrites.push(progress)
    })
    const { rerender } = render(<MemoryRouter><AppContent repositories={olderRepositories as never} /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))
    expect(await screen.findByText('正在保存真实案例顺序...')).toBeVisible()

    rerender(<MemoryRouter><AppContent repositories={newerRepositories as never} /></MemoryRouter>)
    releaseOlderWrite()
    const finalCase = trainingCases[99]
    expect(await screen.findByRole('heading', { name: finalCase.title })).toBeVisible()
    const correctLabel = finalCase.correctDirection === 'up' ? '上涨' : finalCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'
    await user.click(screen.getByRole('radio', { name: correctLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '完成真实案例集训' }))

    await waitFor(() => expect(persistedWrites).toHaveLength(2))
    expect(persistedWrites[1].unitStates[trainingUnit.id].step).toBe('completed')
    expect(persistedWrites[1].unitStates[trainingUnit.id].training?.nextIndex).toBe(100)
    expect(await screen.findByRole('heading', { name: '真实案例集训完成' })).toBeVisible()
  })

  it('drains pending training writes before restoring and migrating a backup', async () => {
    const user = userEvent.setup()
    const { trainingUnit } = createChallengeContentFixture()
    let storedProgress = uninitializedTrainingProgress()
    const repositories = fakeRepositories(true, storedProgress)
    repositories.getChallengeProgress.mockImplementation(async () => storedProgress)
    let releaseTrainingWrite!: () => void
    const trainingWrite = new Promise<void>((resolve) => { releaseTrainingWrite = resolve })
    const writes: ChallengeProgress[] = []
    repositories.saveChallengeProgress.mockImplementation(async (progress) => {
      writes.push(progress)
      if (writes.length === 1) await trainingWrite
      storedProgress = progress
    })
    repositories.restoreProgress.mockImplementation(async (backup) => {
      storedProgress = backup.challengeProgress[0] as ChallengeProgress
    })
    const restoredProgress = legacyProgress(false)
    const backup = createBackup({ challengeProgress: [restoredProgress], challengeAttempts: [], wrongItems: [], settings: {} })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    try {
      render(<MemoryRouter><AppContent repositories={repositories as never} /></MemoryRouter>)

      await user.click(await screen.findByRole('button', { name: '开始 真实案例集训' }))
      expect(await screen.findByText('正在保存真实案例顺序...')).toBeVisible()
      expect(writes).toHaveLength(1)

      await user.click(screen.getByTitle('设置'))
      const backupFile = new File([JSON.stringify(backup)], 'restore.json', { type: 'application/json' })
      await user.upload(screen.getByLabelText('导入进度'), backupFile)
      expect(repositories.restoreProgress).not.toHaveBeenCalled()
      expect(writes).toHaveLength(1)

      releaseTrainingWrite()

      await waitFor(() => expect(repositories.restoreProgress).toHaveBeenCalledTimes(1))
      await user.click(screen.getByTitle('返回'))
      expect(await screen.findByText('15个知识单元 · 顺序解锁')).toBeVisible()
      await waitFor(() => expect(writes).toHaveLength(2))
      expect(writes[1].unitStates[trainingUnit.id]).toEqual({ step: 'case-training' })
      expect(storedProgress.unitStates[trainingUnit.id]).toEqual({ step: 'case-training' })
      expect(screen.getByRole('button', { name: '继续 知识单元 10' })).toBeVisible()
      expect(screen.getByRole('button', { name: new RegExp(trainingUnit.title) })).toBeEnabled()
    } finally {
      confirm.mockRestore()
      alert.mockRestore()
    }
  })
})
