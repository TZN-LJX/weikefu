import Dexie, { type EntityTable } from 'dexie'
import type { ChallengeProgress, WrongItem, WrongQuestionKind } from '../domain/challenge'

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

export type ChallengeAttemptRecord = {
  id?: number
  questionId: string
  questionKind: WrongQuestionKind
  unitId: string
  selectedOptionId: string
  correct: boolean
  createdAt: string
}

export class WeikefuDatabase extends Dexie {
  packs!: EntityTable<PackRecord, 'id'>
  assets!: EntityTable<AssetRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  challengeProgress!: EntityTable<ChallengeProgress, 'id'>
  challengeAttempts!: EntityTable<ChallengeAttemptRecord, 'id'>
  wrongItems!: EntityTable<WrongItem, 'questionId'>

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
    this.version(2).stores({
      attempts: null,
      mastery: null,
      trades: null,
      journals: null,
      challengeProgress: 'id',
      challengeAttempts: '++id, questionId, unitId, questionKind, createdAt',
      wrongItems: 'questionId, unitId, status, nextReviewAt',
    }).upgrade(async (transaction) => {
      await transaction.table('settings').delete('ai')
    })
  }
}

export function createDatabase(name?: string) {
  return new WeikefuDatabase(name)
}

export const database = createDatabase()
