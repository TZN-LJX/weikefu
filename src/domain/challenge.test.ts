import { describe, expect, it } from 'vitest'
import {
  addWrongItem,
  advanceUnitProgress,
  createChallengeProgress,
  recordReviewAnswer,
  scoreBookQuiz,
  selectReviewQuestions,
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
})
