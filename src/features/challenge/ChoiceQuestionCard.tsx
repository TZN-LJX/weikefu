import { useState } from 'react'
import { BookOpenText, Check, CircleX } from 'lucide-react'
import type { ChoiceQuestion, SourceReference } from '../pack/contentSchema'

export type ChoiceAnswer = {
  questionId: string
  selectedOptionId: string
  correct: boolean
}

type ChoiceQuestionCardProps = {
  question: ChoiceQuestion
  onAnswered: (answer: ChoiceAnswer) => void
  onOpenSource: (source: SourceReference) => void
  onContinue?: () => void
  continueLabel?: string
}

function sourceLabel(source: SourceReference) {
  const pages = source.pageEnd > source.pageStart ? `${source.pageStart}-${source.pageEnd}` : String(source.pageStart)
  return `${source.chapter} · 第 ${pages} 页`
}

export function ChoiceQuestionCard({ question, onAnswered, onOpenSource, onContinue, continueLabel = '下一题' }: ChoiceQuestionCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const correct = selectedOptionId === question.correctOptionId
  const correctOption = question.options.find((option) => option.id === question.correctOptionId)

  return <section className="choice-card">
    <h2>{question.prompt}</h2>
    <div className="choice-options" role="radiogroup" aria-label="答案选项">
      {question.options.map((option) => <button
        key={option.id}
        type="button"
        role="radio"
        aria-checked={selectedOptionId === option.id}
        className={`choice-option ${selectedOptionId === option.id ? 'selected' : ''}`}
        disabled={submitted}
        onClick={() => setSelectedOptionId(option.id)}
      >
        <span className="choice-marker">{selectedOptionId === option.id ? <Check size={17} /> : null}</span>
        <span>{option.label}</span>
      </button>)}
    </div>

    {!submitted ? <button
      className="primary-command"
      type="button"
      disabled={!selectedOptionId}
      onClick={() => {
        setSubmitted(true)
        onAnswered({ questionId: question.id, selectedOptionId, correct })
      }}
    >提交答案</button> : <div className={`answer-feedback ${correct ? 'correct' : 'incorrect'}`}>
      <div className="answer-result">
        {correct ? <Check size={21} /> : <CircleX size={21} />}
        <strong>{correct ? '回答正确' : '回答错误'}</strong>
      </div>
      <p className="standard-answer">标准答案：{correctOption?.label}</p>
      <p>{question.explanation}</p>
      <div className="option-explanations">
        {question.options.map((option) => <div key={option.id} className={option.id === question.correctOptionId ? 'is-correct' : ''}>
          <strong>{option.label}</strong>
          <span>{option.explanation}</span>
        </div>)}
      </div>
      <div className="source-reference">
        <BookOpenText size={19} />
        <span>{sourceLabel(question.source)}</span>
        <button type="button" className="text-command" onClick={() => onOpenSource(question.source)}>查看原书</button>
      </div>
      {onContinue && <button className="primary-command" type="button" onClick={onContinue}>{continueLabel}</button>}
    </div>}
  </section>
}
