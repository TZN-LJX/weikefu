export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 21, 30, 45, 60] as const

export type WrongQuestionKind = 'book' | 'market'
export type WrongItemStatus = 'active' | 'retired'

export type WrongItem = {
  questionId: string
  questionKind: WrongQuestionKind
  unitId: string
  status: WrongItemStatus
  correctReviewCount: number
  lastWrongAt: string
  nextReviewAt?: string
  updatedAt: string
}

export type WrongAttempt = {
  questionId: string
  questionKind: WrongQuestionKind
  unitId: string
  now: Date
}

export type ChallengeStep = 'locked' | 'review' | 'book-quiz' | 'market-replay' | 'case-training' | 'completed'
export type ProgressEvent = 'review-completed' | 'book-quiz-passed' | 'market-replay-passed'

export type CaseTrainingSymbol = 'ETHUSDT' | 'BTCUSDT'

export type CaseTrainingOutcome = {
  correct: boolean
  symbol: CaseTrainingSymbol
}

export type CaseTrainingProgress = {
  caseOrder: string[]
  nextIndex: number
  correctCount: number
  wrongCount: number
  completedBySymbol: Record<CaseTrainingSymbol, number>
  outcomes: Record<string, CaseTrainingOutcome>
}

export type UnitProgressState = {
  step: ChallengeStep
  training?: CaseTrainingProgress
}

export type ChallengeUnitDescriptor = {
  id: string
  mode?: 'standard' | 'case-training'
}

export type ChallengeProgress = {
  id: 'main'
  unitOrder: string[]
  unlockedUnitIndex: number
  unitStates: Record<string, UnitProgressState>
  mode: 'course' | 'reinforcement'
  updatedAt: string
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000).toISOString()
}

export function addWrongItem(current: WrongItem | undefined, attempt: WrongAttempt): WrongItem {
  const timestamp = attempt.now.toISOString()
  if (!current || current.status === 'retired') {
    return {
      questionId: attempt.questionId,
      questionKind: attempt.questionKind,
      unitId: attempt.unitId,
      status: 'active',
      correctReviewCount: 0,
      lastWrongAt: timestamp,
      nextReviewAt: addDays(attempt.now, 1),
      updatedAt: timestamp,
    }
  }
  return {
    ...current,
    lastWrongAt: timestamp,
    nextReviewAt: addDays(attempt.now, 1),
    updatedAt: timestamp,
  }
}

export function recordReviewAnswer(item: WrongItem, correct: boolean, now: Date): WrongItem {
  const timestamp = now.toISOString()
  if (!correct) {
    return {
      ...item,
      status: 'active',
      correctReviewCount: item.status === 'retired' ? 0 : item.correctReviewCount,
      lastWrongAt: timestamp,
      nextReviewAt: addDays(now, 1),
      updatedAt: timestamp,
    }
  }
  if (item.status === 'retired') return { ...item, updatedAt: timestamp }
  const correctReviewCount = Math.min(10, item.correctReviewCount + 1)
  if (correctReviewCount === 10) {
    return { ...item, status: 'retired', correctReviewCount, nextReviewAt: undefined, updatedAt: timestamp }
  }
  return {
    ...item,
    correctReviewCount,
    nextReviewAt: addDays(now, REVIEW_INTERVAL_DAYS[correctReviewCount - 1]),
    updatedAt: timestamp,
  }
}

export function selectReviewQuestions(items: WrongItem[], now: Date, random: () => number = Math.random) {
  const nowTime = now.getTime()
  const active = items
    .filter((item) => item.status === 'active' && item.nextReviewAt && Date.parse(item.nextReviewAt) <= nowTime)
    .sort((left, right) => {
      const overdueDifference = (nowTime - Date.parse(right.nextReviewAt!)) - (nowTime - Date.parse(left.nextReviewAt!))
      if (overdueDifference !== 0) return overdueDifference
      if (left.correctReviewCount !== right.correctReviewCount) return left.correctReviewCount - right.correctReviewCount
      return Date.parse(right.lastWrongAt) - Date.parse(left.lastWrongAt)
    })
    .slice(0, 5)

  const retired = items.filter((item) => item.status === 'retired')
  if (retired.length && random() < 0.2) {
    const spotCheck = retired[Math.min(retired.length - 1, Math.floor(random() * retired.length))]
    if (active.length === 5) active[4] = spotCheck
    else active.push(spotCheck)
  }
  return active
}

export function scoreBookQuiz(answers: boolean[]) {
  const correct = answers.filter(Boolean).length
  return { correct, total: answers.length, passed: answers.length === 10 && correct >= 8 }
}

function normalizeUnits(units: readonly (string | ChallengeUnitDescriptor)[]) {
  return units.map((unit) => typeof unit === 'string' ? { id: unit, mode: 'standard' as const } : { ...unit, mode: unit.mode ?? 'standard' })
}

function unitEntryStep(unit: ChallengeUnitDescriptor | undefined): ChallengeStep {
  return unit?.mode === 'case-training' ? 'case-training' : 'review'
}

export function createChallengeProgress(units: readonly (string | ChallengeUnitDescriptor)[], now = new Date()): ChallengeProgress {
  if (!units.length) throw new Error('闯关至少需要一个知识单元')
  const descriptors = normalizeUnits(units)
  const unitOrder = descriptors.map((unit) => unit.id)
  return {
    id: 'main',
    unitOrder,
    unlockedUnitIndex: 0,
    unitStates: Object.fromEntries(descriptors.map((unit, index) => [
      unit.id,
      { step: index === 0 || unit.mode === 'case-training' ? unitEntryStep(unit) : 'locked' },
    ])),
    mode: 'course',
    updatedAt: now.toISOString(),
  }
}

export function advanceUnitProgress(
  progress: ChallengeProgress,
  unitId: string,
  event: ProgressEvent,
  now = new Date(),
  units?: readonly ChallengeUnitDescriptor[],
): ChallengeProgress {
  const current = progress.unitStates[unitId]
  if (!current) throw new Error('知识单元不存在')
  const expectedStep: Record<ProgressEvent, ChallengeStep> = {
    'review-completed': 'review',
    'book-quiz-passed': 'book-quiz',
    'market-replay-passed': 'market-replay',
  }
  if (current.step !== expectedStep[event]) throw new Error('闯关步骤顺序无效')

  const nextStep: Record<ProgressEvent, ChallengeStep> = {
    'review-completed': 'book-quiz',
    'book-quiz-passed': 'market-replay',
    'market-replay-passed': 'completed',
  }
  const unitStates = { ...progress.unitStates, [unitId]: { step: nextStep[event] } }
  let unlockedUnitIndex = progress.unlockedUnitIndex
  let mode = progress.mode

  if (event === 'market-replay-passed') {
    const completedIndex = progress.unitOrder.indexOf(unitId)
    if (completedIndex < 0 || completedIndex > progress.unlockedUnitIndex) throw new Error('知识单元尚未解锁')
    if (completedIndex === progress.unitOrder.length - 1) {
      mode = 'reinforcement'
    } else if (completedIndex === progress.unlockedUnitIndex) {
      const nextUnitId = progress.unitOrder[completedIndex + 1]
      const nextUnit = units?.find((unit) => unit.id === nextUnitId)
      if (!nextUnit) throw new Error('缺少下一知识单元描述')
      unlockedUnitIndex = completedIndex + 1
      if (!unitStates[nextUnitId] || unitStates[nextUnitId].step === 'locked') {
        unitStates[nextUnitId] = { step: unitEntryStep(nextUnit) }
      }
      if (progress.unitOrder.every((candidateId) => unitStates[candidateId]?.step === 'completed')) {
        mode = 'reinforcement'
      }
    }
  }

  return { ...progress, unitStates, unlockedUnitIndex, mode, updatedAt: now.toISOString() }
}

function hasValidCurrentShape(progress: ChallengeProgress, unitIds: string[]) {
  return progress.unitOrder.length === unitIds.length
    && progress.unitOrder.every((unitId, index) => unitId === unitIds[index])
    && unitIds.every((unitId) => Boolean(progress.unitStates[unitId]))
    && Number.isInteger(progress.unlockedUnitIndex)
    && progress.unlockedUnitIndex >= 0
    && progress.unlockedUnitIndex < unitIds.length
}

function makeTrainingUnitsAvailable(
  progress: ChallengeProgress,
  units: readonly ChallengeUnitDescriptor[],
  now: Date,
) {
  const lockedTrainingIds = units
    .filter((unit) => unit.mode === 'case-training' && progress.unitStates[unit.id]?.step === 'locked')
    .map((unit) => unit.id)
  if (!lockedTrainingIds.length) return progress
  const unitStates = { ...progress.unitStates }
  for (const unitId of lockedTrainingIds) unitStates[unitId] = { step: 'case-training' }
  return { ...progress, unitStates, updatedAt: now.toISOString() }
}

export function migrateChallengeProgress(
  saved: ChallengeProgress | undefined,
  units: readonly ChallengeUnitDescriptor[],
  now = new Date(),
): ChallengeProgress {
  const descriptors = normalizeUnits(units)
  const unitIds = descriptors.map((unit) => unit.id)
  if (!saved) return createChallengeProgress(descriptors, now)
  if (hasValidCurrentShape(saved, unitIds)) return makeTrainingUnitsAvailable(saved, descriptors, now)

  const addsOneUnit = saved.unitOrder.length + 1 === unitIds.length
    && saved.unitOrder.every((unitId, index) => unitId === unitIds[index])
  if (!addsOneUnit) return createChallengeProgress(descriptors, now)

  const nextUnit = descriptors.at(-1)!
  const legacyComplete = saved.mode === 'reinforcement'
    || saved.unitOrder.every((unitId) => saved.unitStates[unitId]?.step === 'completed')
  return {
    ...saved,
    unitOrder: unitIds,
    unlockedUnitIndex: legacyComplete ? unitIds.length - 1 : saved.unlockedUnitIndex,
    unitStates: {
      ...saved.unitStates,
      [nextUnit.id]: {
        step: nextUnit.mode === 'case-training' ? 'case-training' : legacyComplete ? unitEntryStep(nextUnit) : 'locked',
      },
    },
    mode: legacyComplete ? 'course' : saved.mode,
    updatedAt: now.toISOString(),
  }
}

type TrainingCaseDescriptor = {
  id: string
  symbol: CaseTrainingSymbol
}

function shuffle<T>(values: readonly T[], random: () => number) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = random()
    const bounded = Number.isFinite(randomValue) ? Math.max(0, Math.min(randomValue, 0.9999999999999999)) : 0
    const swapIndex = Math.floor(bounded * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function isTrainingSymbol(value: unknown): value is CaseTrainingSymbol {
  return value === 'ETHUSDT' || value === 'BTCUSDT'
}

function indexTrainingCases(cases: readonly TrainingCaseDescriptor[]) {
  const caseById = new Map<string, TrainingCaseDescriptor>()
  for (const marketCase of cases) {
    if (!marketCase.id || caseById.has(marketCase.id) || !isTrainingSymbol(marketCase.symbol)) {
      throw new Error('真实案例列表无效')
    }
    caseById.set(marketCase.id, marketCase)
  }
  return caseById
}

export function ensureCaseTrainingProgress(
  progress: ChallengeProgress,
  unitId: string,
  cases: readonly TrainingCaseDescriptor[],
  random: () => number = Math.random,
  now = new Date(),
): ChallengeProgress {
  const current = progress.unitStates[unitId]
  if (!current) throw new Error('知识单元不存在')
  if (current.step !== 'case-training' && current.step !== 'completed') throw new Error('真实案例集训尚未解锁')
  if (!cases.length) throw new Error('真实案例集训至少需要一个案例')

  const caseById = indexTrainingCases(cases)

  const previous = current.training
  const previousOrder = previous?.caseOrder ?? []
  const previousNextIndex = previous && Number.isInteger(previous.nextIndex)
    ? Math.max(0, Math.min(previous.nextIndex, previousOrder.length))
    : 0
  const seen = new Set<string>()
  const completedPrefix: string[] = []
  const outcomes: Record<string, CaseTrainingOutcome> = {}
  for (const caseId of previousOrder.slice(0, previousNextIndex)) {
    const marketCase = caseById.get(caseId)
    const outcome = previous?.outcomes?.[caseId]
    if (marketCase && !seen.has(caseId)
      && outcome && typeof outcome.correct === 'boolean'
      && isTrainingSymbol(outcome.symbol) && outcome.symbol === marketCase.symbol) {
      seen.add(caseId)
      completedPrefix.push(caseId)
      outcomes[caseId] = { correct: outcome.correct, symbol: marketCase.symbol }
    }
  }
  const remainingExisting: string[] = []
  for (const caseId of previousOrder.slice(previousNextIndex)) {
    if (caseById.has(caseId) && !seen.has(caseId)) {
      seen.add(caseId)
      remainingExisting.push(caseId)
    }
  }
  const unseen = cases.map((marketCase) => marketCase.id).filter((caseId) => !seen.has(caseId))
  const caseOrder = [...completedPrefix, ...remainingExisting, ...shuffle(unseen, random)]
  const nextIndex = completedPrefix.length
  const correctCount = Object.values(outcomes).filter((outcome) => outcome.correct).length
  const wrongCount = nextIndex - correctCount
  const completedBySymbol = { ETHUSDT: 0, BTCUSDT: 0 }
  for (const outcome of Object.values(outcomes)) completedBySymbol[outcome.symbol] += 1
  const unitIndex = progress.unitOrder.indexOf(unitId)
  if (unitIndex < 0) throw new Error('知识单元不存在')
  const reopened = current.step === 'completed' && nextIndex < caseOrder.length

  return {
    ...progress,
    unlockedUnitIndex: reopened ? Math.max(progress.unlockedUnitIndex, unitIndex) : progress.unlockedUnitIndex,
    unitStates: {
      ...progress.unitStates,
      [unitId]: {
        ...current,
        step: reopened ? 'case-training' : current.step,
        training: { caseOrder, nextIndex, correctCount, wrongCount, completedBySymbol, outcomes },
      },
    },
    mode: reopened ? 'course' : progress.mode,
    updatedAt: now.toISOString(),
  }
}

export function advanceCaseTraining(
  progress: ChallengeProgress,
  unitId: string,
  answer: { caseId: string; correct: boolean },
  cases: readonly TrainingCaseDescriptor[],
  now = new Date(),
): ChallengeProgress {
  const current = progress.unitStates[unitId]
  const training = current?.training
  if (!current || current.step !== 'case-training' || !training) throw new Error('真实案例集训进度无效')
  if (training.caseOrder[training.nextIndex] !== answer.caseId) throw new Error('真实案例顺序无效')
  if (typeof answer.correct !== 'boolean') throw new Error('真实案例答案无效')
  const marketCase = indexTrainingCases(cases).get(answer.caseId)
  if (!marketCase) throw new Error('真实案例目录与进度不匹配')

  const nextIndex = training.nextIndex + 1
  const completed = nextIndex === training.caseOrder.length
  const allOtherUnitsComplete = progress.unitOrder.every((candidateId) => (
    candidateId === unitId || progress.unitStates[candidateId]?.step === 'completed'
  ))
  return {
    ...progress,
    unitStates: {
      ...progress.unitStates,
      [unitId]: {
        step: completed ? 'completed' : 'case-training',
        training: {
          ...training,
          nextIndex,
          correctCount: training.correctCount + (answer.correct ? 1 : 0),
          wrongCount: training.wrongCount + (answer.correct ? 0 : 1),
          completedBySymbol: {
            ...training.completedBySymbol,
            [marketCase.symbol]: training.completedBySymbol[marketCase.symbol] + 1,
          },
          outcomes: {
            ...training.outcomes,
            [answer.caseId]: { correct: answer.correct, symbol: marketCase.symbol },
          },
        },
      },
    },
    mode: completed ? (allOtherUnitsComplete ? 'reinforcement' : 'course') : progress.mode,
    updatedAt: now.toISOString(),
  }
}
