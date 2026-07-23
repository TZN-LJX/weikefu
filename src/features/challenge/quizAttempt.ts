import type { ChoiceQuestion } from '../pack/contentSchema'

export function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function selectLeastUsedPosition(candidates: number[], usage: Map<number, number>) {
  return candidates.reduce((selected, candidate) => (
    (usage.get(candidate) ?? 0) < (usage.get(selected) ?? 0) ? candidate : selected
  ))
}

export function arrangeQuestionOptions(questions: ChoiceQuestion[], random: () => number) {
  const usage = new Map<number, number>()
  const recentPositions: number[] = []

  return questions.map((question) => {
    const correctOption = question.options.find((option) => option.id === question.correctOptionId)
    if (!correctOption) return question

    const validPositions = shuffle(question.options.map((_, index) => index), random)
    const wouldRepeatThreeTimes = recentPositions.length >= 2
      && recentPositions.at(-1) === recentPositions.at(-2)
    const allowedPositions = wouldRepeatThreeTimes
      ? validPositions.filter((position) => position !== recentPositions.at(-1))
      : validPositions
    const correctPosition = selectLeastUsedPosition(allowedPositions.length ? allowedPositions : validPositions, usage)
    const distractors = shuffle(question.options.filter((option) => option.id !== question.correctOptionId), random)
    const options = [...distractors]
    options.splice(correctPosition, 0, correctOption)

    usage.set(correctPosition, (usage.get(correctPosition) ?? 0) + 1)
    recentPositions.push(correctPosition)
    return { ...question, options }
  })
}

export function prepareQuizAttempt(
  questionPool: ChoiceQuestion[],
  previousIds: Set<string>,
  random: () => number,
) {
  const unseen = shuffle(questionPool.filter((question) => !previousIds.has(question.id)), random)
  const seen = shuffle(questionPool.filter((question) => previousIds.has(question.id)), random)
  return arrangeQuestionOptions([...unseen, ...seen].slice(0, 10), random)
}
