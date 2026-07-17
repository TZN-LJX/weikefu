import { Check, ChevronRight, LockKeyhole, RotateCcw } from 'lucide-react'
import type { ChallengeProgress, ChallengeStep } from '../../domain/challenge'
import type { ContentUnit } from '../pack/contentSchema'

type ChallengeMapPageProps = {
  units: ContentUnit[]
  progress: ChallengeProgress
  wrongCount: number
  onOpenUnit: (unitId: string) => void
  onStartReinforcement: () => void
}

const stepLabels: Record<ChallengeStep, string> = {
  locked: '尚未解锁',
  review: '错题回顾',
  'book-quiz': '原书测验',
  'market-replay': 'ETH历史回放',
  completed: '已完成',
}

function stepNumber(step: ChallengeStep) {
  if (step === 'review') return 0
  if (step === 'book-quiz') return 1
  if (step === 'market-replay') return 2
  if (step === 'completed') return 3
  return -1
}

export function ChallengeMapPage({ units, progress, wrongCount, onOpenUnit, onStartReinforcement }: ChallengeMapPageProps) {
  return <div className="challenge-map page-stack">
    <header className="challenge-map-header">
      <div><p className="eyebrow">14个知识单元 · 顺序解锁</p><h1>闯关地图</h1></div>
      <div className="wrong-count" aria-label={`${wrongCount} 道活跃错题`}><strong>{wrongCount}</strong><span>道活跃错题</span></div>
    </header>

    {progress.mode === 'reinforcement' && <section className="reinforcement-band">
      <div><p className="eyebrow">全部单元已完成</p><h2>无限巩固</h2><p>继续混合复习错题、原书题和ETH历史回放。</p></div>
      <button type="button" className="primary-command compact-command" onClick={onStartReinforcement}>开始无限巩固</button>
    </section>}

    <div className="unit-list">
      {units.map((unit, index) => {
        const state = progress.unitStates[unit.id] ?? { step: 'locked' as const }
        const available = index <= progress.unlockedUnitIndex || state.step === 'completed'
        const currentStep = stepNumber(state.step)
        const command = state.step === 'completed' ? '重练' : state.step === 'review' ? '开始' : '继续'
        return <article className={`unit-row ${available ? '' : 'locked'}`} key={unit.id}>
          <div className="unit-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="unit-copy">
            <span>{stepLabels[state.step]}</span>
            <h2>{unit.title}</h2>
            <p>{unit.summary}</p>
            <div className="unit-steps" aria-label={`${unit.title}三步进度`}>
              {['错题', '原书', '回放'].map((label, stepIndex) => <span key={label} className={currentStep > stepIndex ? 'done' : currentStep === stepIndex ? 'current' : ''}>{currentStep > stepIndex && <Check size={12} />}{label}</span>)}
            </div>
          </div>
          {available ? <button type="button" className="unit-command" aria-label={`${command} ${unit.title}`} onClick={() => onOpenUnit(unit.id)}>
            {state.step === 'completed' ? <RotateCcw size={20} /> : <ChevronRight size={22} />}
          </button> : <LockKeyhole className="unit-lock" />}
        </article>
      })}
    </div>
  </div>
}
