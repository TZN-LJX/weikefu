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

export function createBackup(source: BackupSource) {
  const { aiKey: _secret, ...safeSettings } = source.settings
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
  return value
}
