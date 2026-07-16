export type UnlockInput = {
  accuracy: number
  explanationComplete: boolean
}

export function canUnlock(input: UnlockInput) {
  return input.accuracy >= 0.9 && input.explanationComplete
}

export function updateMastery(
  previous: { correct: number; attempts: number },
  correct: boolean,
) {
  const nextCorrect = previous.correct + (correct ? 1 : 0)
  const nextAttempts = previous.attempts + 1
  return {
    correct: nextCorrect,
    attempts: nextAttempts,
    accuracy: nextCorrect / nextAttempts,
  }
}
