import { describe, expect, it } from 'vitest'
import { createBackup, validateBackup } from './backup'

describe('progress backup', () => {
  it('excludes AI credentials and private publication assets', () => {
    const backup = createBackup({
      attempts: [{ id: 1 }],
      mastery: [{ contentUnitId: 'u1' }],
      trades: [{ id: 't1' }],
      journals: [{ id: 'j1' }],
      settings: { endpoint: 'https://example.com/v1', model: 'model', aiKey: 'secret' },
      contentAssets: [{ path: 'assets/original.pdf' }],
      packs: [{ id: 'pack' }],
    })

    expect(backup.schemaVersion).toBe(1)
    expect(backup.settings).toEqual({ endpoint: 'https://example.com/v1', model: 'model' })
    expect(backup).not.toHaveProperty('contentAssets')
    expect(backup).not.toHaveProperty('packs')
  })

  it('rejects unsupported backup versions', () => {
    expect(() => validateBackup({ schemaVersion: 999 })).toThrow('不支持的备份版本')
  })

  it('removes a nested AI key from stored settings', () => {
    const backup = createBackup({
      attempts: [], mastery: [], trades: [], journals: [],
      settings: { ai: { endpoint: 'https://example.com/v1', model: 'coach', apiKey: 'secret', rememberKey: true } },
    })
    expect(backup.settings).toEqual({ ai: { endpoint: 'https://example.com/v1', model: 'coach', rememberKey: true } })
    expect(JSON.stringify(backup)).not.toContain('secret')
  })
})
