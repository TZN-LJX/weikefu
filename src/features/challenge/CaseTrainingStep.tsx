import type { CaseTrainingProgress } from '../../domain/challenge'
import type { ContentUnit, MarketCase, SourceReference } from '../pack/contentSchema'
import { ReplayStep, type ReplayAnswer } from './ReplayStep'

export type CaseTrainingAdvance = Pick<ReplayAnswer, 'caseId' | 'correct'>

type CaseTrainingStepProps = {
  marketCase: MarketCase
  unit: ContentUnit
  progress: CaseTrainingProgress
  total?: number
  onAnswered: (answer: ReplayAnswer) => void
  onWrong: (answer: ReplayAnswer) => void
  onAdvance: (answer: CaseTrainingAdvance) => void
  onOpenSource: (source: SourceReference) => void
}

export function CaseTrainingStep({
  marketCase,
  unit,
  progress,
  total = 100,
  onAnswered,
  onWrong,
  onAdvance,
  onOpenSource,
}: CaseTrainingStepProps) {
  const displayIndex = progress.nextIndex + 1
  const continueLabel = progress.nextIndex === total - 1
    ? '完成真实案例集训'
    : `下一案例（${progress.nextIndex + 2}/${total}）`

  return <>
    <section className="training-progress" aria-label={`真实案例集训 ${displayIndex}/${total}`}>
      <strong>真实案例集训 {displayIndex}/{total}</strong>
      <div className="training-counter-grid">
        <span>正确 {progress.correctCount}</span>
        <span>错误 {progress.wrongCount}</span>
        <span>ETH {progress.completedBySymbol.ETHUSDT}</span>
        <span>BTC {progress.completedBySymbol.BTCUSDT}</span>
      </div>
    </section>
    <ReplayStep
      key={marketCase.id}
      marketCase={marketCase}
      unit={unit}
      continueLabel={continueLabel}
      onOpenSource={onOpenSource}
      onAnswered={(answer) => {
        onAnswered(answer)
        if (!answer.correct) onWrong(answer)
      }}
      onContinue={(correct) => onAdvance({ caseId: marketCase.id, correct })}
    />
  </>
}
