import { describe, expect, it } from 'vitest'
import { buildTodayQueue } from './today'

describe('buildTodayQueue', () => {
  it('prioritizes reviews, then a lesson, then a replay within the time budget', () => {
    const queue = buildTodayQueue({
      dueReviews: [
        { id: 'review-1', minutes: 3 },
        { id: 'review-2', minutes: 3 },
      ],
      newLessons: [{ id: 'lesson-1', minutes: 5 }],
      replayCases: [{ id: 'replay-1', minutes: 8 }],
      minutes: 20,
    })

    expect(queue).toEqual([
      { id: 'review-1', minutes: 3, kind: 'review' },
      { id: 'review-2', minutes: 3, kind: 'review' },
      { id: 'lesson-1', minutes: 5, kind: 'lesson' },
      { id: 'replay-1', minutes: 8, kind: 'replay' },
    ])
  })

  it('never exceeds the requested minutes', () => {
    const queue = buildTodayQueue({
      dueReviews: [{ id: 'review-1', minutes: 6 }],
      newLessons: [{ id: 'lesson-1', minutes: 6 }],
      replayCases: [{ id: 'replay-1', minutes: 8 }],
      minutes: 10,
    })

    expect(queue).toEqual([{ id: 'review-1', minutes: 6, kind: 'review' }])
  })
})
