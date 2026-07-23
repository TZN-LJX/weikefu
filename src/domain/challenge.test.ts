import { describe, expect, it, vi } from 'vitest'
import {
  addWrongItem,
  advanceCaseTraining,
  advanceUnitProgress,
  createChallengeProgress,
  ensureCaseTrainingProgress,
  migrateChallengeProgress,
  recordReviewAnswer,
  scoreBookQuiz,
  selectReviewQuestions,
  type ChallengeProgress,
  type ChallengeUnitDescriptor,
  type WrongItem,
} from './challenge'

const now = new Date('2026-07-17T00:00:00.000Z')

function wrongItem(overrides: Partial<WrongItem> = {}): WrongItem {
  return {
    questionId: 'question-1',
    questionKind: 'book',
    unitId: 'unit-1',
    status: 'active',
    correctReviewCount: 0,
    lastWrongAt: '2026-07-16T00:00:00.000Z',
    nextReviewAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  }
}

describe('wrong-answer mastery', () => {
  it('adds a new wrong item without duplicating an existing active item', () => {
    const created = addWrongItem(undefined, { questionId: 'q1', questionKind: 'book', unitId: 'u1', now })
    const repeated = addWrongItem({ ...created, correctReviewCount: 4 }, { questionId: 'q1', questionKind: 'book', unitId: 'u1', now })

    expect(created.correctReviewCount).toBe(0)
    expect(created.nextReviewAt).toBe('2026-07-18T00:00:00.000Z')
    expect(repeated.correctReviewCount).toBe(4)
  })

  it('uses the approved intervals and retires a question after ten correct reviews', () => {
    const intervals = [1, 2, 4, 7, 14, 21, 30, 45, 60]
    let item = wrongItem()

    for (const [index, days] of intervals.entries()) {
      item = recordReviewAnswer(item, true, now)
      expect(item.correctReviewCount).toBe(index + 1)
      expect(item.nextReviewAt).toBe(new Date(now.getTime() + days * 86_400_000).toISOString())
      expect(item.status).toBe('active')
    }

    item = recordReviewAnswer(item, true, now)
    expect(item.correctReviewCount).toBe(10)
    expect(item.status).toBe('retired')
    expect(item.nextReviewAt).toBeUndefined()
  })

  it('keeps an active count after an error but resets a failed retired spot check', () => {
    const active = recordReviewAnswer(wrongItem({ correctReviewCount: 6 }), false, now)
    const retired = recordReviewAnswer(wrongItem({ status: 'retired', correctReviewCount: 10, nextReviewAt: undefined }), false, now)

    expect(active.correctReviewCount).toBe(6)
    expect(active.nextReviewAt).toBe('2026-07-18T00:00:00.000Z')
    expect(retired.status).toBe('active')
    expect(retired.correctReviewCount).toBe(0)
  })

  it('selects no more than five due questions and at most one retired spot check', () => {
    const items = [
      ...Array.from({ length: 7 }, (_, index) => wrongItem({
        questionId: `active-${index}`,
        correctReviewCount: index,
        nextReviewAt: new Date(now.getTime() - (7 - index) * 86_400_000).toISOString(),
      })),
      wrongItem({ questionId: 'retired-1', status: 'retired', correctReviewCount: 10, nextReviewAt: undefined }),
    ]
    const randomValues = [0.1, 0]
    const selected = selectReviewQuestions(items, now, () => randomValues.shift() ?? 0.9)

    expect(selected).toHaveLength(5)
    expect(selected.filter((item) => item.status === 'retired')).toHaveLength(1)
    expect(selected[0].questionId).toBe('active-0')
  })
})

describe('challenge progression', () => {
  it('passes a ten-question book quiz at eight correct answers', () => {
    expect(scoreBookQuiz([true, true, true, true, true, true, true, true, false, false])).toEqual({ correct: 8, total: 10, passed: true })
    expect(scoreBookQuiz([true, true, true, true, true, true, true, false, false, false]).passed).toBe(false)
  })

  it('advances the three steps and unlocks the next unit', () => {
    let progress = createChallengeProgress(['unit-1', 'unit-2'])
    progress = advanceUnitProgress(progress, 'unit-1', 'review-completed', now)
    expect(progress.unitStates['unit-1'].step).toBe('book-quiz')

    progress = advanceUnitProgress(progress, 'unit-1', 'book-quiz-passed', now)
    expect(progress.unitStates['unit-1'].step).toBe('market-replay')

    progress = advanceUnitProgress(progress, 'unit-1', 'market-replay-passed', now)
    expect(progress.unitStates['unit-1'].step).toBe('completed')
    expect(progress.unitStates['unit-2'].step).toBe('review')
    expect(progress.unlockedUnitIndex).toBe(1)
  })

  it('enters reinforcement mode after the final unit', () => {
    let progress = createChallengeProgress(['unit-1'])
    progress = advanceUnitProgress(progress, 'unit-1', 'review-completed', now)
    progress = advanceUnitProgress(progress, 'unit-1', 'book-quiz-passed', now)
    progress = advanceUnitProgress(progress, 'unit-1', 'market-replay-passed', now)
    expect(progress.mode).toBe('reinforcement')
  })

  it('initializes descriptor-based training units locked and unlocks them at the training step', () => {
    const units: ChallengeUnitDescriptor[] = [
      { id: 'unit-1', mode: 'standard' },
      { id: 'training', mode: 'case-training' },
    ]
    let progress = createChallengeProgress(units, now)

    expect(progress.unitOrder).toEqual(['unit-1', 'training'])
    expect(progress.unitStates.training.step).toBe('locked')

    progress = advanceUnitProgress(progress, 'unit-1', 'review-completed', now, units)
    progress = advanceUnitProgress(progress, 'unit-1', 'book-quiz-passed', now, units)
    progress = advanceUnitProgress(progress, 'unit-1', 'market-replay-passed', now, units)

    expect(progress.unlockedUnitIndex).toBe(1)
    expect(progress.unitStates.training.step).toBe('case-training')
    expect(progress.mode).toBe('course')
  })
})

function challengeUnits(): ChallengeUnitDescriptor[] {
  return [
    ...Array.from({ length: 14 }, (_, index) => ({ id: `unit-${index + 1}`, mode: 'standard' as const })),
    { id: 'training', mode: 'case-training' },
  ]
}

function trainingCases(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    id: `case-${index + 1}`,
    symbol: index % 2 === 0 ? 'ETHUSDT' as const : 'BTCUSDT' as const,
  }))
}

describe('challenge progress migration', () => {
  it('appends a locked training unit without disturbing incomplete legacy progress', () => {
    const legacy = createChallengeProgress(challengeUnits().slice(0, 14), new Date('2026-07-16T00:00:00.000Z'))
    legacy.unlockedUnitIndex = 9
    legacy.unitStates['unit-1'] = { step: 'completed' }
    legacy.unitStates['unit-10'] = { step: 'book-quiz' }

    const migrated = migrateChallengeProgress(legacy, challengeUnits(), now)

    expect(migrated.unitOrder).toEqual(challengeUnits().map((unit) => unit.id))
    expect(migrated.unlockedUnitIndex).toBe(9)
    expect(migrated.unitStates['unit-1']).toEqual({ step: 'completed' })
    expect(migrated.unitStates['unit-10']).toEqual({ step: 'book-quiz' })
    expect(migrated.unitStates.training).toEqual({ step: 'locked' })
    expect(migrated.mode).toBe('course')
    expect(migrated.updatedAt).toBe(now.toISOString())
  })

  it('unlocks training when all legacy units are complete', () => {
    const legacy = createChallengeProgress(challengeUnits().slice(0, 14))
    legacy.unlockedUnitIndex = 13
    legacy.mode = 'reinforcement'
    for (const unitId of legacy.unitOrder) legacy.unitStates[unitId] = { step: 'completed' }

    const migrated = migrateChallengeProgress(legacy, challengeUnits(), now)

    expect(migrated.unlockedUnitIndex).toBe(14)
    expect(migrated.unitStates.training).toEqual({ step: 'case-training' })
    expect(migrated.mode).toBe('course')
  })

  it('preserves an existing valid fifteen-unit training state', () => {
    const progress = createChallengeProgress(challengeUnits(), now)
    progress.unlockedUnitIndex = 14
    progress.unitStates.training = {
      step: 'case-training',
      training: {
        caseOrder: ['case-1', 'case-2'],
        nextIndex: 1,
        correctCount: 1,
        wrongCount: 0,
        completedBySymbol: { ETHUSDT: 1, BTCUSDT: 0 },
      },
    }

    expect(migrateChallengeProgress(progress, challengeUnits(), new Date('2026-07-18T00:00:00.000Z'))).toBe(progress)
  })
})

describe('case training progress', () => {
  it('shuffles once and keeps the same order across repeated ensure calls', () => {
    const random = vi.fn(() => 0)
    const progress = createChallengeProgress([{ id: 'training', mode: 'case-training' }], now)

    const initialized = ensureCaseTrainingProgress(progress, 'training', trainingCases(), random, now)
    const ensuredAgain = ensureCaseTrainingProgress(initialized, 'training', trainingCases(), random, now)
    const training = initialized.unitStates.training.training!

    expect(training.caseOrder).toHaveLength(100)
    expect(new Set(training.caseOrder)).toHaveLength(100)
    expect(training).toMatchObject({
      nextIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      completedBySymbol: { ETHUSDT: 0, BTCUSDT: 0 },
    })
    expect(ensuredAgain.unitStates.training.training!.caseOrder).toEqual(training.caseOrder)
    expect(random).toHaveBeenCalledTimes(99)
  })

  it('repairs changed content while preserving the valid completed prefix and coherent counts', () => {
    const progress: ChallengeProgress = {
      id: 'main',
      unitOrder: ['training'],
      unlockedUnitIndex: 0,
      unitStates: {
        training: {
          step: 'case-training',
          training: {
            caseOrder: ['a', 'removed', 'b', 'c'],
            nextIndex: 3,
            correctCount: 2,
            wrongCount: 1,
            completedBySymbol: { ETHUSDT: 2, BTCUSDT: 1 },
          },
        },
      },
      mode: 'course',
      updatedAt: '2026-07-16T00:00:00.000Z',
    }
    const cases = [
      { id: 'a', symbol: 'ETHUSDT' as const },
      { id: 'b', symbol: 'BTCUSDT' as const },
      { id: 'c', symbol: 'BTCUSDT' as const },
      { id: 'd', symbol: 'ETHUSDT' as const },
    ]

    const repaired = ensureCaseTrainingProgress(progress, 'training', cases, () => 0, now)

    expect(repaired.unitStates.training.training).toEqual({
      caseOrder: ['a', 'b', 'c', 'd'],
      nextIndex: 2,
      correctCount: 2,
      wrongCount: 0,
      completedBySymbol: { ETHUSDT: 1, BTCUSDT: 1 },
    })
  })

  it('advances wrong answers and rejects an inactive case or unsupported symbol', () => {
    const initialized = ensureCaseTrainingProgress(
      createChallengeProgress([{ id: 'training', mode: 'case-training' }], now),
      'training',
      [{ id: 'case-1', symbol: 'BTCUSDT' }],
      () => 0,
      now,
    )

    expect(() => advanceCaseTraining(initialized, 'training', { caseId: 'other', symbol: 'BTCUSDT', correct: false }, now)).toThrow()
    expect(() => advanceCaseTraining(initialized, 'training', { caseId: 'case-1', symbol: 'SOLUSDT' as 'BTCUSDT', correct: false }, now)).toThrow()

    const advanced = advanceCaseTraining(initialized, 'training', { caseId: 'case-1', symbol: 'BTCUSDT', correct: false }, now)
    expect(advanced.unitStates.training.training).toMatchObject({
      nextIndex: 1,
      correctCount: 0,
      wrongCount: 1,
      completedBySymbol: { ETHUSDT: 0, BTCUSDT: 1 },
    })
    expect(advanced.unitStates.training.step).toBe('completed')
    expect(advanced.mode).toBe('reinforcement')
  })

  it('completes 100 shuffled cases without repeating an active ID', () => {
    const cases = trainingCases()
    const byId = new Map(cases.map((item) => [item.id, item]))
    let progress = ensureCaseTrainingProgress(
      createChallengeProgress([{ id: 'training', mode: 'case-training' }], now),
      'training',
      cases,
      () => 0.42,
      now,
    )
    const completedIds: string[] = []

    for (let index = 0; index < 100; index += 1) {
      const training = progress.unitStates.training.training!
      const caseId = training.caseOrder[training.nextIndex]
      const marketCase = byId.get(caseId)!
      completedIds.push(caseId)
      progress = advanceCaseTraining(progress, 'training', {
        caseId,
        symbol: marketCase.symbol,
        correct: index % 2 === 0,
      }, now)
    }

    expect(new Set(completedIds)).toHaveLength(100)
    expect(progress.unitStates.training.step).toBe('completed')
    expect(progress.unitStates.training.training).toMatchObject({
      nextIndex: 100,
      correctCount: 50,
      wrongCount: 50,
      completedBySymbol: { ETHUSDT: 50, BTCUSDT: 50 },
    })
    expect(progress.mode).toBe('reinforcement')
  })
})
