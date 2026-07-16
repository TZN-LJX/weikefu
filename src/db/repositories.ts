import type { ImportedPackFile, PackManifest } from '../features/pack/packSchema'
import type { AssetRecord, WeikefuDatabase } from './database'

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
  }
}

export type Repositories = ReturnType<typeof createRepositories>
