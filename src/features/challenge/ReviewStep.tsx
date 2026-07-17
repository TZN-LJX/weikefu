import { useState } from 'react'
import type { WrongItem } from '../../domain/challenge'
import type { ChoiceQuestion, MarketCase, SourceReference } from '../pack/contentSchema'
import { ChoiceQuestionCard } from './ChoiceQuestionCard'
import { ReplayStep } from './ReplayStep'

export type ReviewEntry = {
  item: WrongItem
} & ({ kind: 'book'; question: ChoiceQuestion } | { kind: 'market'; marketCase: MarketCase })

type ReviewStepProps = {
  entries: ReviewEntry[]
  onReviewAnswer: (item: WrongItem, correct: boolean) => void
  onComplete: () => void
  onOpenSource: (source: SourceReference) => void
}

export function ReviewStep({ entries, onReviewAnswer, onComplete, onOpenSource }: ReviewStepProps) {
  const [index, setIndex] = useState(0)
  const entry = entries[index]
  if (!entry) return <p className="error-notice">当前没有需要复习的错题</p>
  const last = index === entries.length - 1
  const continueReview = () => last ? onComplete() : setIndex((current) => current + 1)

  return <section className="review-step">
    <div className="step-counter">错题回顾 {index + 1} / {entries.length}</div>
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
      onAnswered={(answer) => onReviewAnswer(entry.item, answer.correct)}
      onOpenSource={onOpenSource}
      onContinue={continueReview}
    />}
  </section>
}
