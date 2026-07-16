const BACKUP_SCHEMA_VERSION = 1

type BackupSource = {
  attempts: unknown[]
  mastery: unknown[]
  trades: unknown[]
  journals: unknown[]
  settings: { endpoint?: string; model?: string; aiKey?: string; [key: string]: unknown }
  contentAssets?: unknown[]
  packs?: unknown[]
}

export type ProgressBackup = {
  schemaVersion: 1
  exportedAt: string
  attempts: unknown[]
  mastery: unknown[]
  trades: unknown[]
  journals: unknown[]
  settings: Record<string, unknown>
}

function removeSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['aiKey', 'apiKey'].includes(key)).map(([key, child]) => [key, removeSecrets(child)]))
}

export function createBackup(source: BackupSource) {
  const safeSettings = removeSecrets(source.settings) as Record<string, unknown>
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    attempts: source.attempts,
    mastery: source.mastery,
    trades: source.trades,
    journals: source.journals,
    settings: safeSettings,
  }
}

export function validateBackup(value: unknown) {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value)) {
    throw new Error('备份文件格式无效')
  }
  if ((value as { schemaVersion: number }).schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('不支持的备份版本')
  }
  const backup = value as Partial<ProgressBackup>
  if (!Array.isArray(backup.attempts) || !Array.isArray(backup.mastery) || !Array.isArray(backup.trades) || !Array.isArray(backup.journals) || !backup.settings || typeof backup.settings !== 'object') {
    throw new Error('备份文件内容不完整')
  }
  return backup as ProgressBackup
}
