import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from './database'
import { createRepositories } from './repositories'
import type { PackManifest } from '../features/pack/packSchema'

const manifest: PackManifest = {
  format: 'weikefu-pack',
  formatVersion: 1,
  id: 'core',
  title: 'Core pack',
  version: '1.0.0',
  minAppVersion: '1.0.0',
  createdAt: '2026-07-16T00:00:00.000Z',
  sourceFingerprints: [],
  files: [{ path: 'content/course.json', sha256: '0'.repeat(64), kind: 'course' }],
}

const databases: ReturnType<typeof createDatabase>[] = []

afterEach(async () => {
  await Promise.all(databases.map((database) => database.delete()))
  databases.length = 0
})

describe('local repositories', () => {
  it('stores a pack and retrieves its private JSON asset', async () => {
    const database = createDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = createRepositories(database)

    await repositories.savePack(manifest, [{
      path: 'content/course.json',
      kind: 'course',
      bytes: new TextEncoder().encode('{"stages":[{"id":"risk"}]}'),
    }])

    expect(await repositories.getActivePack()).toMatchObject({ id: 'core', active: true })
    expect(await repositories.getJsonAsset<{ stages: { id: string }[] }>('content/course.json'))
      .toEqual({ stages: [{ id: 'risk' }] })
  })

  it('replaces old files from the same pack atomically', async () => {
    const database = createDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = createRepositories(database)

    await repositories.savePack(manifest, [{
      path: 'old.txt', kind: 'text', bytes: new TextEncoder().encode('old'),
    }])
    await repositories.savePack({ ...manifest, version: '1.1.0' }, [{
      path: 'new.txt', kind: 'text', bytes: new TextEncoder().encode('new'),
    }])

    expect(await repositories.getAsset('old.txt')).toBeUndefined()
    expect(new TextDecoder().decode((await repositories.getAsset('new.txt'))?.bytes)).toBe('new')
  })

  it('persists settings, simulation trades, and journals for the app shell', async () => {
    const database = createDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = createRepositories(database)

    await repositories.setSetting('ai', { endpoint: 'https://example.com/v1', model: 'coach' })
    await repositories.saveTrade({ id: 't1', status: 'open' })
    await repositories.saveJournal({ id: 'j1', tradeId: 't1', conclusion: '遵守规则' })

    expect(await repositories.getSetting('ai')).toEqual({ endpoint: 'https://example.com/v1', model: 'coach' })
    expect(await repositories.getTrades()).toEqual([expect.objectContaining({ id: 't1' })])
    expect(await repositories.getJournals()).toEqual([expect.objectContaining({ tradeId: 't1' })])
  })

  it('restores progress records without touching private pack assets', async () => {
    const database = createDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = createRepositories(database)
    await repositories.savePack(manifest, [{ path: 'private.pdf', kind: 'pdf', bytes: new Uint8Array([1]) }])

    await repositories.restoreProgress({
      schemaVersion: 1, exportedAt: new Date().toISOString(),
      attempts: [{ id: 1, exerciseId: 'e1' }], mastery: [{ contentUnitId: 'u1' }],
      trades: [{ id: 't1' }], journals: [{ id: 'j1', tradeId: 't1' }], settings: { language: 'zh-CN' },
    })

    expect(await repositories.getAsset('private.pdf')).toBeDefined()
    expect(await repositories.getTrades()).toHaveLength(1)
    expect(await repositories.getSetting('language')).toBe('zh-CN')
  })
})
