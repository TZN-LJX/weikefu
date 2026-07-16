import type { ImportedPackFile, PackManifest } from '../features/pack/packSchema'
import type { AssetRecord, WeikefuDatabase } from './database'
import type { ProgressBackup } from './backup'

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

    async saveTrade(trade: Record<string, unknown> & { id: string }) {
      await database.trades.put(trade)
    },

    getTrades() {
      return database.trades.toArray()
    },

    async saveJournal(journal: Record<string, unknown> & { id: string }) {
      await database.journals.put(journal)
    },

    getJournals() {
      return database.journals.toArray()
    },

    async getBackupSnapshot() {
      const settings = Object.fromEntries((await database.settings.toArray()).map((item) => [item.key, item.value]))
      return {
        attempts: await database.attempts.toArray(),
        mastery: await database.mastery.toArray(),
        trades: await database.trades.toArray(),
        journals: await database.journals.toArray(),
        settings,
      }
    },

    async restoreProgress(backup: ProgressBackup) {
      await database.transaction('rw', database.attempts, database.mastery, database.trades, database.journals, database.settings, async () => {
        await Promise.all([
          database.attempts.clear(),
          database.mastery.clear(),
          database.trades.clear(),
          database.journals.clear(),
        ])
        await database.attempts.bulkPut(backup.attempts as (Record<string, unknown> & { id?: number })[])
        await database.mastery.bulkPut(backup.mastery as (Record<string, unknown> & { contentUnitId: string })[])
        await database.trades.bulkPut(backup.trades as (Record<string, unknown> & { id: string })[])
        await database.journals.bulkPut(backup.journals as (Record<string, unknown> & { id: string })[])
        await database.settings.bulkPut(Object.entries(backup.settings).map(([key, value]) => ({ key, value })))
      })
    },
  }
}

export type Repositories = ReturnType<typeof createRepositories>
