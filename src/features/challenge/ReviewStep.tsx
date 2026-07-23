import { useState } from 'react'
import type { WrongItem } from '../../domain/challenge'
import type { ChoiceQuestion, ContentUnit, MarketCase, SourceReference } from '../pack/contentSchema'
import { ChoiceQuestionCard } from './ChoiceQuestionCard'
import { arrangeQuestionOptions } from './quizAttempt'
import { ReplayStep } from './ReplayStep'

export type ReviewEntry = {
  item: WrongItem
} & ({ kind: 'book'; question: ChoiceQuestion } | { kind: 'market'; marketCase: MarketCase; unit?: ContentUnit })

type ReviewStepProps = {
  entries: ReviewEntry[]
  onReviewAnswer: (item: WrongItem, correct: boolean) => void
  onComplete: () => void
  onOpenSource: (source: SourceReference) => void
  random?: () => number
}

function arrangeReviewEntries(entries: ReviewEntry[], random: () => number) {
  const arrangedQuestions = arrangeQuestionOptions(
    entries.filter((entry) => entry.kind === 'book').map((entry) => entry.question),
    random,
  )
  let bookIndex = 0
  return entries.map((entry) => entry.kind === 'book'
    ? { ...entry, question: arrangedQuestions[bookIndex++] }
    : entry)
}

export function ReviewStep({ entries, onReviewAnswer, onComplete, onOpenSource, random = Math.random }: ReviewStepProps) {
  const [attemptEntries] = useState(() => arrangeReviewEntries(entries, random))
  const [index, setIndex] = useState(0)
  const entry = attemptEntries[index]
  if (!entry) return <p className="error-notice">当前没有需要复习的错题</p>
  const last = index === attemptEntries.length - 1
  const continueReview = () => last ? onComplete() : setIndex((current) => current + 1)

  return <section className="review-step">
    <div className="step-counter">错题回顾 {index + 1} / {attemptEntries.length}</div>
    {entry.kind === 'book' ? <ChoiceQuestionCard
      key={entry.item.questionId}
      question={entry.question}
      onAnswered={(answer) => onReviewAnswer(entry.item, answer.correct)}
      onOpenSource={onOpenSource}
      onContinue={continueReview}
      continueLabel={last ? '完成错题回顾' : '下一道错题'}
    /> : <ReplayStep
      key={entry.item.questionId}
      marketCase={entry.marketCase}
      unit={entry.unit}
      onAnswered={(answer) => onReviewAnswer(entry.item, answer.correct)}
      onOpenSource={onOpenSource}
      onContinue={continueReview}
    />}
  </section>
}
