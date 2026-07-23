import { describe, expect, it } from 'vitest'
import type { ChoiceQuestion } from '../pack/contentSchema'
import { prepareQuizAttempt } from './quizAttempt'

function question(index: number, optionCount = 3): ChoiceQuestion {
  const options = Array.from({ length: optionCount }, (_, optionIndex) => ({
    id: optionIndex === 0 ? `correct-${index}` : `wrong-${index}-${optionIndex}`,
    label: optionIndex === 0 ? `Correct ${index}` : `Wrong ${index}-${optionIndex}`,
    explanation: `Explanation ${index}-${optionIndex}`,
  }))
  return {
    id: `q${index}`,
    prompt: `Question ${index}`,
    options,
    correctOptionId: options[0].id,
    explanation: `Question explanation ${index}`,
    source: { pdfPath: 'assets/original.pdf', chapter: 'Chapter', pageStart: 1, pageEnd: 1 },
  }
}

function correctPositions(questions: ChoiceQuestion[]) {
  return questions.map((item) => item.options.findIndex((option) => option.id === item.correctOptionId))
}

describe('prepareQuizAttempt', () => {
  it('balances correct answers across every available position', () => {
    const prepared = prepareQuizAttempt(
      Array.from({ length: 20 }, (_, index) => question(index + 1)),
      new Set(),
      () => 0.42,
    )

    const positions = correctPositions(prepared)
    const counts = [0, 1, 2].map((position) => positions.filter((candidate) => candidate === position).length)

    expect(prepared).toHaveLength(10)
    expect(counts.every((count) => count > 0)).toBe(true)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('does not place the correct answer in the same position three times in a row', () => {
    const prepared = prepareQuizAttempt(
      Array.from({ length: 20 }, (_, index) => question(index + 1, 4)),
      new Set(),
      () => 0.17,
    )

    const positions = correctPositions(prepared)
    for (let index = 2; index < positions.length; index += 1) {
      expect(new Set(positions.slice(index - 2, index + 1)).size).toBeGreaterThan(1)
    }
  })

  it('preserves option identities and leaves the source questions unchanged', () => {
    const source = Array.from({ length: 20 }, (_, index) => question(index + 1, 4))
    const originalFirstIds = source[0].options.map((option) => option.id)

    const prepared = prepareQuizAttempt(source, new Set(), () => 0.75)
    const preparedFirst = prepared.find((item) => item.id === source[0].id)

    expect(source[0].options.map((option) => option.id)).toEqual(originalFirstIds)
    if (preparedFirst) {
      expect(new Set(preparedFirst.options.map((option) => option.id))).toEqual(new Set(originalFirstIds))
      expect(preparedFirst.options.find((option) => option.id === preparedFirst.correctOptionId)?.label).toBe('Correct 1')
    }
  })
})
