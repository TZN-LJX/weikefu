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

export type ChallengeStep = 'locked' | 'review' | 'book-quiz' | 'market-replay' | 'completed'
export type ProgressEvent = 'review-completed' | 'book-quiz-passed' | 'market-replay-passed'

export type ChallengeProgress = {
  id: 'main'
  unitOrder: string[]
  unlockedUnitIndex: number
  unitStates: Record<string, { step: ChallengeStep }>
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

export function createChallengeProgress(unitOrder: string[], now = new Date()): ChallengeProgress {
  if (!unitOrder.length) throw new Error('闯关至少需要一个知识单元')
  return {
    id: 'main',
    unitOrder,
    unlockedUnitIndex: 0,
    unitStates: Object.fromEntries(unitOrder.map((unitId, index) => [unitId, { step: index === 0 ? 'review' : 'locked' }])),
    mode: 'course',
    updatedAt: now.toISOString(),
  }
}

export function advanceUnitProgress(progress: ChallengeProgress, unitId: string, event: ProgressEvent, now = new Date()): ChallengeProgress {
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
      unlockedUnitIndex = completedIndex + 1
      unitStates[progress.unitOrder[unlockedUnitIndex]] = { step: 'review' }
    }
  }

  return { ...progress, unitStates, unlockedUnitIndex, mode, updatedAt: now.toISOString() }
}
