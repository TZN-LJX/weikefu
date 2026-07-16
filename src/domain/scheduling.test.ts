import { describe, expect, it } from 'vitest'
import { nextReviewDate } from './scheduling'

describe('nextReviewDate', () => {
  it('uses one, three, seven, fourteen, and thirty day intervals', () => {
    const base = new Date('2026-07-16T00:00:00.000Z')
    expect(nextReviewDate(base, 0).toISOString()).toBe('2026-07-17T00:00:00.000Z')
    expect(nextReviewDate(base, 1).toISOString()).toBe('2026-07-19T00:00:00.000Z')
    expect(nextReviewDate(base, 2).toISOString()).toBe('2026-07-23T00:00:00.000Z')
    expect(nextReviewDate(base, 3).toISOString()).toBe('2026-07-30T00:00:00.000Z')
    expect(nextReviewDate(base, 99).toISOString()).toBe('2026-08-15T00:00:00.000Z')
  })
})
