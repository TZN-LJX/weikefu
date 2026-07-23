import { describe, expect, it } from 'vitest'
import { createChallengeContentFixture } from './challengeContent'

describe('createChallengeContentFixture', () => {
  it('creates fresh standard and training source references for every call', () => {
    const first = createChallengeContentFixture()
    first.standardUnits[0].source.pageStart = 999
    first.trainingUnit.source.pageStart = 999

    const second = createChallengeContentFixture()

    expect(second.standardUnits[0].source.pageStart).toBe(12)
    expect(second.trainingUnit.source.pageStart).toBe(17)
  })
})
