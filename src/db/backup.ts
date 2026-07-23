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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

type ValidTrainingProgress = {
  caseOrder: string[]
  nextIndex: number
  correctCount: number
  wrongCount: number
  completedBySymbol: { ETHUSDT: number; BTCUSDT: number }
}

function isValidTrainingProgress(value: unknown): value is ValidTrainingProgress {
  if (!isRecord(value)
    || !Array.isArray(value.caseOrder)
    || value.caseOrder.length === 0
    || value.caseOrder.some((caseId) => typeof caseId !== 'string' || !caseId)
    || new Set(value.caseOrder).size !== value.caseOrder.length
    || !isNonNegativeInteger(value.nextIndex)
    || value.nextIndex > value.caseOrder.length
    || !isNonNegativeInteger(value.correctCount)
    || !isNonNegativeInteger(value.wrongCount)
    || value.correctCount + value.wrongCount !== value.nextIndex
    || !isRecord(value.completedBySymbol)) {
    return false
  }
  const symbolKeys = Object.keys(value.completedBySymbol)
  return symbolKeys.length === 2
    && symbolKeys.includes('ETHUSDT')
    && symbolKeys.includes('BTCUSDT')
    && isNonNegativeInteger(value.completedBySymbol.ETHUSDT)
    && isNonNegativeInteger(value.completedBySymbol.BTCUSDT)
    && value.completedBySymbol.ETHUSDT + value.completedBySymbol.BTCUSDT === value.nextIndex
}

function isValidChallengeProgress(value: unknown) {
  if (!isRecord(value)
    || value.id !== 'main'
    || !Array.isArray(value.unitOrder)
    || value.unitOrder.length === 0
    || value.unitOrder.some((unitId) => typeof unitId !== 'string' || !unitId)
    || new Set(value.unitOrder).size !== value.unitOrder.length
    || !isNonNegativeInteger(value.unlockedUnitIndex)
    || value.unlockedUnitIndex >= value.unitOrder.length
    || !isRecord(value.unitStates)
    || (value.mode !== 'course' && value.mode !== 'reinforcement')
    || typeof value.updatedAt !== 'string') {
    return false
  }

  const validSteps = new Set(['locked', 'review', 'book-quiz', 'market-replay', 'case-training', 'completed'])
  const unitStates = value.unitStates
  return value.unitOrder.every((unitId) => {
    const state = unitStates[unitId]
    if (!isRecord(state) || !validSteps.has(state.step as string)) return false
    if (state.training === undefined) return state.step !== 'case-training'
    const training = state.training
    if ((state.step !== 'case-training' && state.step !== 'completed') || !isValidTrainingProgress(training)) return false
    const orderLength = training.caseOrder.length
    return state.step === 'completed' ? training.nextIndex === orderLength : training.nextIndex < orderLength
  })
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
  if (!backup.challengeProgress.every(isValidChallengeProgress)) {
    throw new Error('挑战进度内容无效')
  }
  return backup as ProgressBackup
}
