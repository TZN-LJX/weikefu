import { describe, expect, it } from 'vitest'
import { canUnlock, updateMastery } from './mastery'

describe('mastery', () => {
  it('unlocks only at ninety percent with a complete explanation', () => {
    expect(canUnlock({ accuracy: 0.9, explanationComplete: true })).toBe(true)
    expect(canUnlock({ accuracy: 0.899, explanationComplete: true })).toBe(false)
    expect(canUnlock({ accuracy: 1, explanationComplete: false })).toBe(false)
  })

  it('updates accuracy from real attempts', () => {
    const result = updateMastery({ correct: 7, attempts: 8 }, true)
    expect(result).toEqual({ correct: 8, attempts: 9, accuracy: 8 / 9 })
  })
})
