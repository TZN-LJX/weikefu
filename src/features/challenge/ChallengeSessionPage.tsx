import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import {
  addWrongItem,
  advanceUnitProgress,
  recordReviewAnswer,
  selectReviewQuestions,
  type ChallengeProgress,
  type ProgressEvent,
  type WrongItem,
} from '../../domain/challenge'
import type { ChallengeAttemptRecord } from '../../db/database'
import type { ContentUnit, MarketCase, SourceReference } from '../pack/contentSchema'
import { BookQuizStep } from './BookQuizStep'
import { ReplayStep } from './ReplayStep'
import { ReviewStep, type ReviewEntry } from './ReviewStep'

type ChallengeSessionPageProps = {
  unit: ContentUnit
  allUnits: ContentUnit[]
  marketCases: MarketCase[]
  includeAllMarketCases?: boolean
  progress: ChallengeProgress
  wrongItems: WrongItem[]
  random?: () => number
  now?: () => Date
  onProgressChange: (progress: ChallengeProgress) => void
  onWrongItemChange: (item: WrongItem) => void
  onAttempt: (attempt: ChallengeAttemptRecord) => void
  onOpenSource: (source: SourceReference) => void
  onReturnToMap: () => void
}

function resolveReviewEntries(items: WrongItem[], units: ContentUnit[], marketCases: MarketCase[]): ReviewEntry[] {
  const bookQuestions = new Map(units.flatMap((unit) => unit.bookQuestions).map((question) => [question.id, question]))
  const cases = new Map(marketCases.map((marketCase) => [marketCase.id, marketCase]))
  const entries: ReviewEntry[] = []
  for (const item of items) {
    if (item.questionKind === 'book') {
      const question = bookQuestions.get(item.questionId)
      if (question) entries.push({ item, kind: 'book', question })
    } else {
      const marketCase = cases.get(item.questionId)
      if (marketCase) entries.push({ item, kind: 'market', marketCase })
    }
  }
  return entries
}

const stepNames = ['错题回顾', '原书测验', 'ETH回放'] as const
const currentDate = () => new Date()

export function ChallengeSessionPage({
  unit, allUnits, marketCases, includeAllMarketCases = false, progress, wrongItems,
  random = Math.random, now = currentDate,
  onProgressChange, onWrongItemChange, onAttempt, onOpenSource, onReturnToMap,
}: ChallengeSessionPageProps) {
  const step = progress.unitStates[unit.id]?.step ?? 'locked'
  const [reviewEntries] = useState(() => resolveReviewEntries(selectReviewQuestions(wrongItems, now(), random), allUnits, marketCases))
  const unitCases = includeAllMarketCases ? marketCases : marketCases.filter((marketCase) => marketCase.unitId === unit.id)
  const [caseIndex, setCaseIndex] = useState(0)

  const advance = useCallback((event: ProgressEvent) => {
    onProgressChange(advanceUnitProgress(progress, unit.id, event, now()))
  }, [now, onProgressChange, progress, unit.id])

  useEffect(() => {
    if (step === 'review' && reviewEntries.length === 0) advance('review-completed')
  }, [advance, step, reviewEntries.length])

  const saveWrong = (questionId: string, questionKind: 'book' | 'market', sourceUnitId: string) => {
    const current = wrongItems.find((item) => item.questionId === questionId)
    onWrongItemChange(addWrongItem(current, { questionId, questionKind, unitId: sourceUnitId, now: now() }))
  }

  const stepIndex = step === 'review' ? 0 : step === 'book-quiz' ? 1 : step === 'market-replay' ? 2 : step === 'completed' ? 3 : -1

  return <div className="challenge-session page-stack">
    <header className="session-header">
      <button type="button" className="icon-command" title="返回闯关地图" onClick={onReturnToMap}><ArrowLeft /></button>
      <div><p className="eyebrow">当前知识单元</p><h1>{unit.title}</h1></div>
    </header>
    <div className="session-steps">
      {stepNames.map((name, index) => <div key={name} className={stepIndex > index ? 'done' : stepIndex === index ? 'current' : ''}>
        <span>{stepIndex > index ? <Check size={15} /> : index + 1}</span><strong>{name}</strong>
      </div>)}
    </div>

    {step === 'review' && (reviewEntries.length ? <ReviewStep
      entries={reviewEntries}
      onOpenSource={onOpenSource}
      onReviewAnswer={(item, correct) => onWrongItemChange(recordReviewAnswer(item, correct, now()))}
      onComplete={() => advance('review-completed')}
    /> : <p className="loading-inline">正在准备原书测验...</p>)}

    {step === 'book-quiz' && <BookQuizStep
      unitId={unit.id}
      questionPool={unit.bookQuestions}
      random={random}
      onOpenSource={onOpenSource}
      onAnswer={(question, answer) => onAttempt({
        questionId: question.id, questionKind: 'book', unitId: allUnits.find((candidate) => candidate.bookQuestions.some((item) => item.id === question.id))?.id ?? unit.id,
        selectedOptionId: answer.selectedOptionId, correct: answer.correct, createdAt: now().toISOString(),
      })}
      onWrong={(question) => saveWrong(question.id, 'book', allUnits.find((candidate) => candidate.bookQuestions.some((item) => item.id === question.id))?.id ?? unit.id)}
      onPassed={() => advance('book-quiz-passed')}
    />}

    {step === 'market-replay' && (unitCases[caseIndex] ? <ReplayStep
      key={unitCases[caseIndex].id}
      marketCase={unitCases[caseIndex]}
      onOpenSource={onOpenSource}
      onAnswered={(answer) => {
        const sourceUnitId = unitCases[caseIndex].unitId
        onAttempt({
          questionId: answer.caseId, questionKind: 'market', unitId: sourceUnitId,
          selectedOptionId: answer.selectedDirection, correct: answer.correct, createdAt: now().toISOString(),
        })
        if (!answer.correct) saveWrong(answer.caseId, 'market', sourceUnitId)
      }}
      onContinue={(correct) => {
        if (correct) advance('market-replay-passed')
        else setCaseIndex((current) => (current + 1) % unitCases.length)
      }}
    /> : <p className="error-notice">当前单元缺少ETH历史案例</p>)}

    {step === 'completed' && <section className="unit-complete">
      <Check size={28} />
      <p className="eyebrow">三个步骤全部通过</p>
      <h2>本单元完成</h2>
      <button className="primary-command compact-command" type="button" onClick={onReturnToMap}>返回闯关地图</button>
    </section>}
  </div>
}
