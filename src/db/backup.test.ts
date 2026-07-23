import { describe, expect, it } from 'vitest'
import { createBackup, validateBackup } from './backup'

describe('challenge progress backup', () => {
  it('exports only challenge progress, wrong items, attempts, and safe settings', () => {
    const backup = createBackup({
      challengeProgress: [{ id: 'main', unlockedUnitIndex: 1 }],
      challengeAttempts: [{ id: 1, questionId: 'q1', correct: false }],
      wrongItems: [{ questionId: 'q1', correctReviewCount: 0 }],
      settings: {
        language: 'zh-CN',
        ai: { endpoint: 'https://example.com/v1', apiKey: 'secret' },
        nested: { apiKey: 'nested-secret', keep: true },
      },
    })

    expect(backup.schemaVersion).toBe(2)
    expect(backup.challengeProgress).toHaveLength(1)
    expect(backup.wrongItems).toHaveLength(1)
    expect(backup.settings).toEqual({ language: 'zh-CN', nested: { keep: true } })
    expect(JSON.stringify(backup)).not.toContain('secret')
    expect(backup).not.toHaveProperty('trades')
    expect(backup).not.toHaveProperty('journals')
  })

  it('rejects legacy and incomplete backups', () => {
    expect(() => validateBackup({ schemaVersion: 1 })).toThrow('不支持的备份版本')
    expect(() => validateBackup({ schemaVersion: 2, challengeProgress: [] })).toThrow('备份文件内容不完整')
  })

  it('accepts a complete version 2 backup', () => {
    const backup = createBackup({ challengeProgress: [], challengeAttempts: [], wrongItems: [], settings: {} })
    expect(validateBackup(backup)).toEqual(backup)
  })

  it('accepts and preserves case-training progress', () => {
    const progress = {
      id: 'main',
      unitOrder: ['training'],
      unlockedUnitIndex: 0,
      unitStates: {
        training: {
          step: 'case-training',
          training: {
            caseOrder: ['case-1', 'case-2'],
            nextIndex: 1,
            correctCount: 0,
            wrongCount: 1,
            completedBySymbol: { ETHUSDT: 0, BTCUSDT: 1 },
          },
        },
      },
      mode: 'course',
      updatedAt: '2026-07-17T00:00:00.000Z',
    }
    const backup = createBackup({ challengeProgress: [progress], challengeAttempts: [], wrongItems: [], settings: {} })

    expect(validateBackup(backup).challengeProgress[0]).toEqual(progress)
  })

  it.each([
    { caseOrder: 'case-1' },
    { caseOrder: ['case-1', 'case-1'] },
    { caseOrder: ['case-1'], nextIndex: 2 },
    { caseOrder: ['case-1'], nextIndex: 1, correctCount: 0, wrongCount: 0 },
    { caseOrder: ['case-1'], nextIndex: 1, completedBySymbol: { ETHUSDT: 0, BTCUSDT: 0 } },
    { caseOrder: ['case-1'], nextIndex: 1, completedBySymbol: { ETHUSDT: 0, BTCUSDT: 1, SOLUSDT: 0 } },
  ])('rejects malformed case-training progress: %o', (trainingOverride) => {
    const training = Object.assign({
      caseOrder: ['case-1'],
      nextIndex: 1,
      correctCount: 1,
      wrongCount: 0,
      completedBySymbol: { ETHUSDT: 1, BTCUSDT: 0 },
    }, trainingOverride)
    const backup = createBackup({
      challengeProgress: [{
        id: 'main',
        unitOrder: ['training'],
        unlockedUnitIndex: 0,
        unitStates: { training: { step: 'case-training', training } },
        mode: 'course',
        updatedAt: '2026-07-17T00:00:00.000Z',
      }],
      challengeAttempts: [],
      wrongItems: [],
      settings: {},
    })

    expect(() => validateBackup(backup)).toThrow()
  })
})
