const BACKUP_SCHEMA_VERSION = 2

type BackupSource = {
  challengeProgress: unknown[]
  challengeAttempts: unknown[]
  wrongItems: unknown[]
  settings: Record<string, unknown>
}

export type ProgressBackup = {
  schemaVersion: 2
  exportedAt: string
  challengeProgress: unknown[]
  challengeAttempts: unknown[]
  wrongItems: unknown[]
  settings: Record<string, unknown>
}

function removeSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['ai', 'aiKey', 'apiKey'].includes(key))
    .map(([key, child]) => [key, removeSecrets(child)]))
}

export function createBackup(source: BackupSource): ProgressBackup {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    challengeProgress: source.challengeProgress,
    challengeAttempts: source.challengeAttempts,
    wrongItems: source.wrongItems,
    settings: removeSecrets(source.settings) as Record<string, unknown>,
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
  if (!Array.isArray(backup.challengeProgress)
    || !Array.isArray(backup.challengeAttempts)
    || !Array.isArray(backup.wrongItems)
    || !backup.settings
    || typeof backup.settings !== 'object') {
    throw new Error('备份文件内容不完整')
  }
  return backup as ProgressBackup
}
