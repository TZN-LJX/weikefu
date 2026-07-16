import Dexie, { type EntityTable } from 'dexie'

export type PackRecord = {
  id: string
  title: string
  version: string
  importedAt: string
  active: boolean
}

export type AssetRecord = {
  id: string
  packId: string
  path: string
  kind: string
  bytes: Uint8Array
}

export type SettingRecord = { key: string; value: unknown }

export class WeikefuDatabase extends Dexie {
  packs!: EntityTable<PackRecord, 'id'>
  assets!: EntityTable<AssetRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  attempts!: EntityTable<Record<string, unknown> & { id?: number }, 'id'>
  mastery!: EntityTable<Record<string, unknown> & { contentUnitId: string }, 'contentUnitId'>
  trades!: EntityTable<Record<string, unknown> & { id: string }, 'id'>
  journals!: EntityTable<Record<string, unknown> & { id: string }, 'id'>

  constructor(name = 'weikefu') {
    super(name)
    this.version(1).stores({
      packs: 'id, importedAt',
      assets: 'id, packId, path, kind',
      settings: 'key',
      attempts: '++id, exerciseId, createdAt',
      mastery: 'contentUnitId, stageId, nextReviewAt',
      trades: 'id, caseId, openedAt, status',
      journals: 'id, tradeId, createdAt',
    })
  }
}

export function createDatabase(name?: string) {
  return new WeikefuDatabase(name)
}

export const database = createDatabase()
