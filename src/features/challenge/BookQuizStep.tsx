import { useState } from 'react'
import type { ChoiceQuestion, SourceReference } from '../pack/contentSchema'
import { scoreBookQuiz } from '../../domain/challenge'
import { ChoiceQuestionCard, type ChoiceAnswer } from './ChoiceQuestionCard'

type BookQuizStepProps = {
  unitId: string
  questionPool: ChoiceQuestion[]
  random?: () => number
  onAnswer?: (question: ChoiceQuestion, answer: ChoiceAnswer) => void
  onWrong: (question: ChoiceQuestion) => void
  onPassed: () => void
  onOpenSource: (source: SourceReference) => void
}

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function selectAttempt(questionPool: ChoiceQuestion[], previousIds: Set<string>, random: () => number) {
  const unseen = shuffle(questionPool.filter((question) => !previousIds.has(question.id)), random)
  const seen = shuffle(questionPool.filter((question) => previousIds.has(question.id)), random)
  return [...unseen, ...seen].slice(0, 10)
}

export function BookQuizStep({ unitId, questionPool, random = Math.random, onAnswer, onWrong, onPassed, onOpenSource }: BookQuizStepProps) {
  const [attemptQuestions, setAttemptQuestions] = useState(() => selectAttempt(questionPool, new Set(), random))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<boolean[]>([])
  const [result, setResult] = useState<ReturnType<typeof scoreBookQuiz>>()
  const currentQuestion = attemptQuestions[questionIndex]

  if (!currentQuestion && !result) return <p className="error-notice">当前单元题库不足 10 题</p>

  if (result) {
    return <section className="quiz-result">
      <p className="eyebrow">原书掌握测验</p>
      <h2>{result.passed ? '本轮通过' : '本轮未通过'}</h2>
      <p className="quiz-score">答对 {result.correct} / {result.total}</p>
      <p>{result.passed ? '已经达到 80% 的通过标准。' : '未达到 80%，错题已自动进入错题本。'}</p>
      {result.passed ? <button className="primary-command" type="button" onClick={onPassed}>进入ETH历史回放</button>
        : <button className="primary-command" type="button" onClick={() => {
          const previousIds = new Set(attemptQuestions.map((question) => question.id))
          setAttemptQuestions(selectAttempt(questionPool, previousIds, random))
          setQuestionIndex(0)
          setAnswers([])
          setResult(undefined)
        }}>重新随机测验</button>}
    </section>
  }

  return <div className="quiz-step" data-unit-id={unitId}>
    <div className="step-counter">第 {questionIndex + 1} / 10 题</div>
    <ChoiceQuestionCard
      key={currentQuestion.id}
      question={currentQuestion}
      onOpenSource={onOpenSource}
      onAnswered={(answer) => {
        onAnswer?.(currentQuestion, answer)
        setAnswers((current) => [...current, answer.correct])
        if (!answer.correct) onWrong(currentQuestion)
      }}
      continueLabel={questionIndex === 9 ? '查看本轮结果' : '下一题'}
      onContinue={() => {
        if (questionIndex === 9) setResult(scoreBookQuiz(answers))
        else setQuestionIndex((current) => current + 1)
      }}
    />
  </div>
}
