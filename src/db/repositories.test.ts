import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChallengeProgress, WrongItem } from '../domain/challenge'
import type { PackManifest } from '../features/pack/packSchema'
import { createDatabase } from './database'
import { createRepositories } from './repositories'

const manifest: PackManifest = {
  format: 'weikefu-pack',
  formatVersion: 1,
  id: 'core',
  title: 'Core pack',
  version: '2.0.0',
  minAppVersion: '2.0.0',
  createdAt: '2026-07-17T00:00:00.000Z',
  sourceFingerprints: [],
  files: [{ path: 'content/course.json', sha256: '0'.repeat(64), kind: 'course' }],
}

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.map((name) => Dexie.delete(name)))
  databaseNames.length = 0
})

describe('local repositories', () => {
  it('stores a pack and retrieves its private JSON asset', async () => {
    const name = `test-${crypto.randomUUID()}`
    databaseNames.push(name)
    const database = createDatabase(name)
    const repositories = createRepositories(database)

    await repositories.savePack(manifest, [{
      path: 'content/course.json',
      kind: 'course',
      bytes: new TextEncoder().encode('{"version":2}'),
    }])

    expect(await repositories.getActivePack()).toMatchObject({ id: 'core', active: true })
    expect(await repositories.getJsonAsset('content/course.json')).toEqual({ version: 2 })
  })

  it('persists progress, attempts, and wrong items', async () => {
    const name = `test-${crypto.randomUUID()}`
    databaseNames.push(name)
    const repositories = createRepositories(createDatabase(name))
    const progress: ChallengeProgress = {
      id: 'main', unitOrder: ['u1'], unlockedUnitIndex: 0,
      unitStates: { u1: { step: 'book-quiz' } }, mode: 'course', updatedAt: '2026-07-17T00:00:00.000Z',
    }
    const wrongItem: WrongItem = {
      questionId: 'q1', questionKind: 'book', unitId: 'u1', status: 'active', correctReviewCount: 0,
      lastWrongAt: '2026-07-17T00:00:00.000Z', nextReviewAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-17T00:00:00.000Z',
    }

    await repositories.saveChallengeProgress(progress)
    await repositories.saveChallengeAttempt({ questionId: 'q1', questionKind: 'book', unitId: 'u1', selectedOptionId: 'b', correct: false, createdAt: '2026-07-17T00:00:00.000Z' })
    await repositories.saveWrongItem(wrongItem)

    expect(await repositories.getChallengeProgress()).toEqual(progress)
    expect(await repositories.getChallengeAttempts()).toEqual([expect.objectContaining({ questionId: 'q1', correct: false })])
    expect(await repositories.getWrongItems()).toEqual([wrongItem])
  })

  it('restores challenge progress without touching private pack assets', async () => {
    const name = `test-${crypto.randomUUID()}`
    databaseNames.push(name)
    const repositories = createRepositories(createDatabase(name))
    await repositories.savePack(manifest, [{ path: 'private.pdf', kind: 'pdf', bytes: new Uint8Array([1]) }])

    await repositories.restoreProgress({
      schemaVersion: 2,
      exportedAt: '2026-07-17T00:00:00.000Z',
      challengeProgress: [{ id: 'main', unitOrder: ['u1'], unlockedUnitIndex: 0, unitStates: { u1: { step: 'review' } }, mode: 'course', updatedAt: '2026-07-17T00:00:00.000Z' }],
      challengeAttempts: [],
      wrongItems: [],
      settings: { language: 'zh-CN' },
    })

    expect(await repositories.getAsset('private.pdf')).toBeDefined()
    expect(await repositories.getChallengeProgress()).toMatchObject({ id: 'main', unlockedUnitIndex: 0 })
    expect(await repositories.getSetting('language')).toBe('zh-CN')
  })

  it('upgrades legacy storage by deleting AI settings and legacy tables', async () => {
    const name = `test-${crypto.randomUUID()}`
    databaseNames.push(name)
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      packs: 'id, importedAt', assets: 'id, packId, path, kind', settings: 'key',
      attempts: '++id, exerciseId, createdAt', mastery: 'contentUnitId, stageId, nextReviewAt',
      trades: 'id, caseId, openedAt, status', journals: 'id, tradeId, createdAt',
    })
    await legacy.open()
    await legacy.table('settings').put({ key: 'ai', value: { apiKey: 'secret' } })
    await legacy.table('trades').put({ id: 'trade-1' })
    legacy.close()

    const database = createDatabase(name)
    await database.open()

    expect(await database.settings.get('ai')).toBeUndefined()
    expect(database.tables.map((table) => table.name)).not.toContain('trades')
    expect(database.tables.map((table) => table.name)).toContain('wrongItems')
    database.close()
  })
})
