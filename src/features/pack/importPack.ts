import JSZip from 'jszip'
import { PackManifestSchema, type ImportedPackFile, type PackManifest } from './packSchema'

type StorageEstimate = { quota?: number; usage?: number }

export type ImportPackDeps = {
  appVersion: string
  estimateStorage: () => Promise<StorageEstimate>
  savePack: (manifest: PackManifest, files: ImportedPackFile[]) => Promise<void>
  clearPartial: () => Promise<void>
}

function compareVersions(left: string, right: string) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

async function hashBytes(bytes: Uint8Array) {
  const copy = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function importPack(source: Uint8Array | ArrayBuffer, deps: ImportPackDeps) {
  try {
    const sourceBytes = source instanceof Uint8Array ? source : new Uint8Array(source)
    const estimate = await deps.estimateStorage()
    const available = (estimate.quota ?? Number.POSITIVE_INFINITY) - (estimate.usage ?? 0)
    if (available < sourceBytes.byteLength * 1.25) {
      throw new Error('浏览器存储空间不足')
    }

    const zip = await JSZip.loadAsync(sourceBytes)
    const manifestEntry = zip.file('manifest.json')
    if (!manifestEntry) throw new Error('学习包缺少 manifest.json')

    const manifest = PackManifestSchema.parse(JSON.parse(await manifestEntry.async('text')))
    if (compareVersions(deps.appVersion, manifest.minAppVersion) < 0) {
      throw new Error('需要更新应用')
    }

    const files: ImportedPackFile[] = []
    for (const expected of manifest.files) {
      const entry = zip.file(expected.path)
      if (!entry) throw new Error(`学习包缺少文件：${expected.path}`)
      const bytes = await entry.async('uint8array')
      if (await hashBytes(bytes) !== expected.sha256) {
        throw new Error(`学习包校验失败：${expected.path}`)
      }
      files.push({ path: expected.path, kind: expected.kind, bytes })
    }

    await deps.savePack(manifest, files)
    return { id: manifest.id, version: manifest.version, active: true, fileCount: files.length }
  } catch (error) {
    await deps.clearPartial()
    throw error
  }
}
