import { useState } from 'react'
import { Check, CircleHelp } from 'lucide-react'
import { EvidenceFeedback } from '../feedback/EvidenceFeedback'

export type Exercise = {
  id: string
  prompt: string
  options: { id: string; label: string }[]
  correctOptionId: string
  evidence: { id: string; label: string }[]
  requiredEvidenceIds: string[]
  explanationPrompt: string
}

type ExercisePageProps = {
  exercise: Exercise
  onComplete: (correct: boolean) => void
}

export function ExercisePage({ exercise, onComplete }: ExercisePageProps) {
  const [selected, setSelected] = useState('')
  const [needsReview, setNeedsReview] = useState(false)
  const [correct, setCorrect] = useState(false)

  if (needsReview) {
    return <EvidenceFeedback
      evidence={exercise.evidence.filter((item) => exercise.requiredEvidenceIds.includes(item.id))}
      prompt={exercise.explanationPrompt}
      onRetry={() => {
        setNeedsReview(false)
        setSelected('')
      }}
    />
  }

  return <section className="exercise-panel">
    <div className="exercise-heading">
      <CircleHelp size={21} />
      <div><p className="eyebrow">提交后才会反馈</p><h1>{exercise.prompt}</h1></div>
    </div>
    <div className="answer-grid">
      {exercise.options.map((option) => <button
        type="button"
        key={option.id}
        className={selected === option.id ? 'answer-option selected' : 'answer-option'}
        aria-pressed={selected === option.id}
        onClick={() => setSelected(option.id)}
      >
        {selected === option.id && <Check size={17} />}{option.label}
      </button>)}
    </div>
    {correct && <p className="success-notice">判断正确。下一步需要补充价量证据和失效条件。</p>}
    <button
      className="primary-command"
      type="button"
      disabled={!selected}
      onClick={() => {
        const isCorrect = selected === exercise.correctOptionId
        onComplete(isCorrect)
        if (isCorrect) setCorrect(true)
        else setNeedsReview(true)
      }}
    >提交判断</button>
  </section>
}
