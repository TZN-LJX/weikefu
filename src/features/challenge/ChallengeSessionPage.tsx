import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import {
  addWrongItem,
  advanceCaseTraining,
  advanceUnitProgress,
  ensureCaseTrainingProgress,
  recordReviewAnswer,
  selectReviewQuestions,
  type CaseTrainingProgress,
  type ChallengeProgress,
  type ProgressEvent,
  type WrongItem,
} from '../../domain/challenge'
import type { ChallengeAttemptRecord } from '../../db/database'
import type { ContentUnit, MarketCase, SourceReference } from '../pack/contentSchema'
import { BookQuizStep } from './BookQuizStep'
import { CaseTrainingStep } from './CaseTrainingStep'
import { shuffle } from './quizAttempt'
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
  onProgressChange: (progress: ChallengeProgress) => void | Promise<void | ChallengeProgress>
  onWrongItemChange: (item: WrongItem) => void
  onAttempt: (attempt: ChallengeAttemptRecord) => void
  onOpenSource: (source: SourceReference) => void
  onReturnToMap: () => void
}

function resolveReviewEntries(items: WrongItem[], units: ContentUnit[], marketCases: MarketCase[]): ReviewEntry[] {
  const bookQuestions = new Map(units.flatMap((unit) => unit.bookQuestions).map((question) => [question.id, question]))
  const cases = new Map(marketCases.map((marketCase) => [marketCase.id, marketCase]))
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))
  const entries: ReviewEntry[] = []
  for (const item of items) {
    if (item.questionKind === 'book') {
      const question = bookQuestions.get(item.questionId)
      if (question) entries.push({ item, kind: 'book', question })
    } else {
      const marketCase = cases.get(item.questionId)
      if (marketCase) entries.push({ item, kind: 'market', marketCase, unit: unitsById.get(marketCase.unitId) })
    }
  }
  return entries
}

const stepNames = ['错题回顾', '原书测验', 'ETH回放'] as const
const currentDate = () => new Date()

function sameTrainingProgress(left: CaseTrainingProgress | undefined, right: CaseTrainingProgress | undefined) {
  if (!left || !right) return left === right
  if (left.nextIndex !== right.nextIndex
    || left.correctCount !== right.correctCount
    || left.wrongCount !== right.wrongCount
    || left.completedBySymbol.ETHUSDT !== right.completedBySymbol.ETHUSDT
    || left.completedBySymbol.BTCUSDT !== right.completedBySymbol.BTCUSDT
    || left.caseOrder.length !== right.caseOrder.length
    || left.caseOrder.some((caseId, index) => caseId !== right.caseOrder[index])) return false

  const leftOutcomeIds = Object.keys(left.outcomes)
  const rightOutcomeIds = Object.keys(right.outcomes)
  return leftOutcomeIds.length === rightOutcomeIds.length
    && leftOutcomeIds.every((caseId) => {
      const leftOutcome = left.outcomes[caseId]
      const rightOutcome = right.outcomes[caseId]
      return rightOutcome?.correct === leftOutcome.correct && rightOutcome.symbol === leftOutcome.symbol
    })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '真实案例集训进度无效'
}

function trainingSnapshotKey(progress: ChallengeProgress, unitId: string, cases: MarketCase[]) {
  return JSON.stringify({
    state: progress.unitStates[unitId],
    cases: cases.map((marketCase) => ({ id: marketCase.id, symbol: marketCase.symbol })),
  })
}

type PendingTrainingSave = {
  sourceKey: string
  targetKey: string
  status: 'saving' | 'saved' | 'failed'
  error?: string
}

export function ChallengeSessionPage({
  unit, allUnits, marketCases, includeAllMarketCases = false, progress, wrongItems,
  random = Math.random, now = currentDate,
  onProgressChange, onWrongItemChange, onAttempt, onOpenSource, onReturnToMap,
}: ChallengeSessionPageProps) {
  const step = progress.unitStates[unit.id]?.step ?? 'locked'
  const [reviewEntries] = useState(() => resolveReviewEntries(selectReviewQuestions(wrongItems, now(), random), allUnits, marketCases))
  const [unitCases] = useState(() => shuffle(
    includeAllMarketCases ? marketCases : marketCases.filter((marketCase) => marketCase.unitId === unit.id),
    random,
  ))
  const [caseIndex, setCaseIndex] = useState(0)
  const activeMarketCase = unitCases[caseIndex]
  const activeMarketUnit = activeMarketCase
    ? allUnits.find((candidate) => candidate.id === activeMarketCase.unitId) ?? (unit.id === activeMarketCase.unitId ? unit : undefined)
    : undefined

  const advance = useCallback((event: ProgressEvent) => {
    onProgressChange(advanceUnitProgress(progress, unit.id, event, now(), allUnits))
  }, [allUnits, now, onProgressChange, progress, unit.id])

  const trainingCases = useMemo(
    () => marketCases.filter((marketCase) => marketCase.unitId === unit.id),
    [marketCases, unit.id],
  )
  const expectedTrainingTotal = 100
  const trainingCatalogError = unit.mode === 'case-training' && trainingCases.length !== expectedTrainingTotal
    ? `真实案例集训需要 ${expectedTrainingTotal} 个当前单元案例，实际找到 ${trainingCases.length} 个。`
    : undefined
  const [trainingReady, setTrainingReady] = useState(false)
  const [trainingError, setTrainingError] = useState<string>()
  const [trainingAdvancing, setTrainingAdvancing] = useState(false)
  const pendingTrainingSave = useRef<PendingTrainingSave | undefined>(undefined)
  const [trainingSaveRevision, setTrainingSaveRevision] = useState(0)

  useEffect(() => {
    if (unit.mode !== 'case-training') return
    if (trainingCatalogError) {
      setTrainingReady(false)
      setTrainingError(trainingCatalogError)
      return
    }
    const sourceKey = trainingSnapshotKey(progress, unit.id, trainingCases)
    const pending = pendingTrainingSave.current
    if (pending?.status === 'failed' && (sourceKey === pending.sourceKey || sourceKey === pending.targetKey)) {
      setTrainingReady(false)
      setTrainingError(pending.error)
      return
    }
    if (pending?.sourceKey === sourceKey) return
    if (pending && pending.status !== 'failed' && pending.targetKey !== sourceKey) return
    if (pending?.status === 'failed') pendingTrainingSave.current = undefined

    try {
      const ensured = ensureCaseTrainingProgress(progress, unit.id, trainingCases, random, now())
      const currentState = progress.unitStates[unit.id]
      const ensuredState = ensured.unitStates[unit.id]
      if (currentState?.step === ensuredState.step && sameTrainingProgress(currentState?.training, ensuredState.training)) {
        if (pending?.targetKey === sourceKey && pending.status === 'saving') return
        pendingTrainingSave.current = undefined
        setTrainingError(undefined)
        setTrainingReady(true)
        return
      }
      const request: PendingTrainingSave = {
        sourceKey,
        targetKey: trainingSnapshotKey(ensured, unit.id, trainingCases),
        status: 'saving',
      }
      pendingTrainingSave.current = request
      setTrainingReady(false)
      setTrainingError(undefined)
      let saveResult: void | Promise<void | ChallengeProgress>
      try {
        saveResult = onProgressChange(ensured)
      } catch (error) {
        request.status = 'failed'
        request.error = errorMessage(error)
        setTrainingError(request.error)
        return
      }
      void Promise.resolve(saveResult).then((persistedProgress) => {
        if (pendingTrainingSave.current !== request) return
        if (persistedProgress) request.targetKey = trainingSnapshotKey(persistedProgress, unit.id, trainingCases)
        request.status = 'saved'
        setTrainingSaveRevision((revision) => revision + 1)
      }, (error: unknown) => {
        if (pendingTrainingSave.current !== request) return
        request.status = 'failed'
        request.error = errorMessage(error)
        setTrainingReady(false)
        setTrainingError(request.error)
      })
    } catch (error) {
      setTrainingReady(false)
      setTrainingError(errorMessage(error))
    }
  }, [now, onProgressChange, progress, random, trainingCases, trainingCatalogError, trainingSaveRevision, unit.id, unit.mode])

  useEffect(() => {
    if (unit.mode === 'standard' && step === 'review' && reviewEntries.length === 0) advance('review-completed')
  }, [advance, step, reviewEntries.length, unit.mode])

  const saveWrong = (questionId: string, questionKind: 'book' | 'market', sourceUnitId: string) => {
    const current = wrongItems.find((item) => item.questionId === questionId)
    onWrongItemChange(addWrongItem(current, { questionId, questionKind, unitId: sourceUnitId, now: now() }))
  }

  if (unit.mode === 'case-training') {
    const trainingState = progress.unitStates[unit.id]
    const training = trainingState?.training
    const activeCaseId = training?.caseOrder[training.nextIndex]
    const activeTrainingCase = trainingCases.find((marketCase) => marketCase.id === activeCaseId)
    const visibleError = trainingCatalogError ?? trainingError
    const invalidActiveCase = trainingReady && trainingState?.step === 'case-training' && (!training || !activeCaseId || !activeTrainingCase)

    return <div className="challenge-session page-stack">
      <header className="session-header">
        <button type="button" className="icon-command" title="返回闯关地图" onClick={onReturnToMap}><ArrowLeft /></button>
        <div><p className="eyebrow">当前知识单元</p><h1>{unit.title}</h1></div>
      </header>

      {visibleError && <p className="error-notice" role="alert">{visibleError}</p>}
      {!visibleError && !trainingReady && <p className="loading-inline" role="status" aria-live="polite">正在保存真实案例顺序...</p>}
      {!visibleError && trainingReady && trainingAdvancing && <p className="loading-inline" role="status" aria-live="polite">正在保存案例进度...</p>}
      {!visibleError && invalidActiveCase && <p className="error-notice" role="alert">无法找到当前真实案例，请返回闯关地图后重新进入。</p>}

      {!visibleError && trainingReady && !trainingAdvancing && trainingState?.step === 'case-training' && training && activeTrainingCase && <CaseTrainingStep
        marketCase={activeTrainingCase}
        unit={unit}
        progress={training}
        total={expectedTrainingTotal}
        onOpenSource={onOpenSource}
        onAnswered={(answer) => onAttempt({
          questionId: answer.caseId,
          questionKind: 'market',
          unitId: activeTrainingCase.unitId,
          selectedOptionId: answer.selectedDirection,
          correct: answer.correct,
          createdAt: now().toISOString(),
        })}
        onWrong={(answer) => saveWrong(answer.caseId, 'market', activeTrainingCase.unitId)}
        onAdvance={(answer) => {
          setTrainingAdvancing(true)
          setTrainingError(undefined)
          let saveResult: void | Promise<void | ChallengeProgress>
          try {
            saveResult = onProgressChange(advanceCaseTraining(progress, unit.id, answer, trainingCases, now()))
          } catch (error) {
            setTrainingAdvancing(false)
            setTrainingError(errorMessage(error))
            return
          }
          void Promise.resolve(saveResult).then(
            () => setTrainingAdvancing(false),
            (error: unknown) => {
              setTrainingAdvancing(false)
              setTrainingError(errorMessage(error))
            },
          )
        }}
      />}

      {!visibleError && trainingReady && trainingState?.step === 'completed' && <section className="unit-complete">
        <Check size={28} />
        <p className="eyebrow">100 个真实案例全部完成</p>
        <h2>真实案例集训完成</h2>
        <button className="primary-command compact-command" type="button" onClick={onReturnToMap}>返回闯关地图</button>
      </section>}

      {!visibleError && trainingReady && trainingState?.step !== 'case-training' && trainingState?.step !== 'completed' && <p className="error-notice" role="alert">
        真实案例集训进度无效，请返回闯关地图后重新进入。
      </p>}
    </div>
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
      random={random}
      onReviewAnswer={(item, correct) => onWrongItemChange(recordReviewAnswer(item, correct, now()))}
      onComplete={() => advance('review-completed')}
    /> : <p className="loading-inline" role="status" aria-live="polite">正在准备原书测验...</p>)}

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

    {step === 'market-replay' && (activeMarketCase ? <ReplayStep
      key={activeMarketCase.id}
      marketCase={activeMarketCase}
      unit={activeMarketUnit}
      onOpenSource={onOpenSource}
      onAnswered={(answer) => {
        const sourceUnitId = activeMarketCase.unitId
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
    /> : <p className="error-notice" role="alert">当前单元缺少ETH历史案例</p>)}

    {step === 'completed' && <section className="unit-complete">
      <Check size={28} />
      <p className="eyebrow">三个步骤全部通过</p>
      <h2>本单元完成</h2>
      <button className="primary-command compact-command" type="button" onClick={onReturnToMap}>返回闯关地图</button>
    </section>}
  </div>
}
