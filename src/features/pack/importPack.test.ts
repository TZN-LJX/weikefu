import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { importPack } from './importPack'

async function sha256(value: Uint8Array) {
  const copy = Uint8Array.from(value)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function createPack(options?: { minAppVersion?: string; corrupt?: boolean }) {
  const zip = new JSZip()
  const course = '{"stages":[]}'
  const bytes = new TextEncoder().encode(course)
  const checksum = await sha256(bytes)
  zip.file('content/course.json', course)
  zip.file('manifest.json', JSON.stringify({
    format: 'weikefu-pack',
    formatVersion: 1,
    id: 'wyckoff-core',
    title: '威科夫私人学习包',
    version: '1.0.0',
    minAppVersion: options?.minAppVersion ?? '1.0.0',
    createdAt: '2026-07-16T00:00:00.000Z',
    sourceFingerprints: [],
    files: [{
      path: 'content/course.json',
      sha256: options?.corrupt ? '0'.repeat(64) : checksum,
      kind: 'course',
    }],
  }))
  return zip.generateAsync({ type: 'uint8array' })
}

function createDeps(overrides = {}) {
  return {
    appVersion: '1.0.0',
    estimateStorage: vi.fn().mockResolvedValue({ quota: 10_000_000, usage: 0 }),
    savePack: vi.fn().mockResolvedValue(undefined),
    clearPartial: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('importPack', () => {
  it('imports a valid pack without any network dependency', async () => {
    const deps = createDeps()
    const result = await importPack(await createPack(), deps)

    expect(result).toMatchObject({ id: 'wyckoff-core', active: true, fileCount: 1 })
    expect(deps.savePack).toHaveBeenCalledOnce()
  })

  it('rejects a corrupt pack without replacing current content', async () => {
    const deps = createDeps()
    await expect(importPack(await createPack({ corrupt: true }), deps))
      .rejects.toThrow('学习包校验失败')
    expect(deps.savePack).not.toHaveBeenCalled()
    expect(deps.clearPartial).toHaveBeenCalledOnce()
  })

  it('rejects a pack that needs a newer app', async () => {
    const deps = createDeps()
    await expect(importPack(await createPack({ minAppVersion: '2.0.0' }), deps))
      .rejects.toThrow('需要更新应用')
  })

  it('checks available browser storage before writing', async () => {
    const deps = createDeps({
      estimateStorage: vi.fn().mockResolvedValue({ quota: 100, usage: 99 }),
    })
    await expect(importPack(await createPack(), deps)).rejects.toThrow('浏览器存储空间不足')
    expect(deps.savePack).not.toHaveBeenCalled()
  })
})
