import type { ChallengeProgress, WrongItem } from '../domain/challenge'
import type { ImportedPackFile, PackManifest } from '../features/pack/packSchema'
import type { ProgressBackup } from './backup'
import type { AssetRecord, ChallengeAttemptRecord, WeikefuDatabase } from './database'

function assetId(packId: string, path: string) {
  return `${packId}:${path}`
}

export function createRepositories(database: WeikefuDatabase) {
  return {
    async savePack(manifest: PackManifest, files: ImportedPackFile[]) {
      await database.transaction('rw', database.packs, database.assets, async () => {
        await database.packs.toCollection().modify({ active: false })
        await database.assets.where('packId').equals(manifest.id).delete()
        await database.packs.put({
          id: manifest.id,
          title: manifest.title,
          version: manifest.version,
          importedAt: new Date().toISOString(),
          active: true,
        })
        await database.assets.bulkPut(files.map((file) => ({
          id: assetId(manifest.id, file.path),
          packId: manifest.id,
          path: file.path,
          kind: file.kind,
          bytes: file.bytes,
        })))
      })
    },

    async clearPartial() {
      return undefined
    },

    getActivePack() {
      return database.packs.filter((pack) => pack.active).first()
    },

    async getAsset(path: string): Promise<AssetRecord | undefined> {
      const pack = await database.packs.filter((candidate) => candidate.active).first()
      return pack ? database.assets.get(assetId(pack.id, path)) : undefined
    },

    async getJsonAsset<T>(path: string): Promise<T | undefined> {
      const asset = await this.getAsset(path)
      if (!asset) return undefined
      return JSON.parse(new TextDecoder().decode(asset.bytes)) as T
    },

    async deleteActivePack() {
      const pack = await database.packs.filter((candidate) => candidate.active).first()
      if (!pack) return
      await database.transaction('rw', database.packs, database.assets, async () => {
        await database.assets.where('packId').equals(pack.id).delete()
        await database.packs.delete(pack.id)
      })
    },

    async setSetting(key: string, value: unknown) {
      await database.settings.put({ key, value })
    },

    async getSetting<T>(key: string): Promise<T | undefined> {
      return (await database.settings.get(key))?.value as T | undefined
    },

    saveChallengeProgress(progress: ChallengeProgress) {
      return database.challengeProgress.put(progress)
    },

    getChallengeProgress() {
      return database.challengeProgress.get('main')
    },

    async saveChallengeAttempt(attempt: ChallengeAttemptRecord) {
      await database.challengeAttempts.add(attempt)
    },

    getChallengeAttempts() {
      return database.challengeAttempts.toArray()
    },

    saveWrongItem(item: WrongItem) {
      return database.wrongItems.put(item)
    },

    getWrongItem(questionId: string) {
      return database.wrongItems.get(questionId)
    },

    getWrongItems() {
      return database.wrongItems.toArray()
    },

    async resetChallengeProgress() {
      await database.transaction('rw', database.challengeProgress, database.challengeAttempts, database.wrongItems, async () => {
        await Promise.all([
          database.challengeProgress.clear(),
          database.challengeAttempts.clear(),
          database.wrongItems.clear(),
        ])
      })
    },

    async getBackupSnapshot() {
      const settings = Object.fromEntries((await database.settings.toArray()).map((item) => [item.key, item.value]))
      return {
        challengeProgress: await database.challengeProgress.toArray(),
        challengeAttempts: await database.challengeAttempts.toArray(),
        wrongItems: await database.wrongItems.toArray(),
        settings,
      }
    },

    async restoreProgress(backup: ProgressBackup) {
      await database.transaction('rw', database.challengeProgress, database.challengeAttempts, database.wrongItems, database.settings, async () => {
        await Promise.all([
          database.challengeProgress.clear(),
          database.challengeAttempts.clear(),
          database.wrongItems.clear(),
          database.settings.clear(),
        ])
        await database.challengeProgress.bulkPut(backup.challengeProgress as ChallengeProgress[])
        await database.challengeAttempts.bulkPut(backup.challengeAttempts as ChallengeAttemptRecord[])
        await database.wrongItems.bulkPut(backup.wrongItems as WrongItem[])
        await database.settings.bulkPut(Object.entries(backup.settings).map(([key, value]) => ({ key, value })))
      })
    },
  }
}

export type Repositories = ReturnType<typeof createRepositories>
