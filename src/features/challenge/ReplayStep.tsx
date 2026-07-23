import { useState } from 'react'
import { BookOpenText, Check, CircleX, LockKeyhole } from 'lucide-react'
import type { ContentUnit, Direction, MarketCase, SourceReference } from '../pack/contentSchema'
import { MarketChart } from '../replay/MarketChart'
import { formatBeijingCrosshair } from '../replay/chartTime'
import { buildReplayPresentation } from './replayPresentation'

export type ReplayAnswer = {
  caseId: string
  selectedDirection: Direction
  correct: boolean
}

type ReplayStepProps = {
  marketCase: MarketCase
  unit?: ContentUnit
  onAnswered: (answer: ReplayAnswer) => void
  onOpenSource: (source: SourceReference) => void
  onContinue: (correct: boolean) => void
}

const directionLabels: Record<Direction, string> = {
  up: '上涨',
  down: '下跌',
  range: '震荡／方向不明',
}

function sourceLabel(source: SourceReference) {
  const pages = source.pageEnd > source.pageStart ? `${source.pageStart}-${source.pageEnd}` : String(source.pageStart)
  return `${source.chapter} · 第 ${pages} 页`
}

export function ReplayStep({ marketCase, unit, onAnswered, onOpenSource, onContinue }: ReplayStepProps) {
  const [chartTimeframe, setChartTimeframe] = useState<'4h' | '1h'>('4h')
  const [selectedDirection, setSelectedDirection] = useState<Direction>()
  const [submitted, setSubmitted] = useState(false)
  const correct = selectedDirection === marketCase.correctDirection
  const oneHourCandles = submitted ? [...marketCase.visibleCandles, ...marketCase.futureCandles] : marketCase.visibleCandles
  const presentation = buildReplayPresentation(marketCase, unit)

  return <section className="replay-question">
    <header className="replay-question-header">
      <div>
        <p className="eyebrow">{marketCase.market} · {marketCase.symbol}</p>
        <h2>{marketCase.title}</h2>
        <p>截止 {formatBeijingCrosshair(marketCase.cutoffTime)} · 判断至 {formatBeijingCrosshair(marketCase.horizonEndTime)}</p>
      </div>
      {!submitted && <span className="future-lock"><LockKeyhole size={16} />未来走势已隐藏</span>}
    </header>

    <div className="chart-shell">
      <div className="chart-timeframes" role="group" aria-label="图表周期">
        <button type="button" className={chartTimeframe === '4h' ? 'active' : ''} onClick={() => setChartTimeframe('4h')}>4小时背景</button>
        <button type="button" className={chartTimeframe === '1h' ? 'active' : ''} onClick={() => setChartTimeframe('1h')}>1小时走势</button>
      </div>
      <MarketChart
        candles={chartTimeframe === '4h' ? marketCase.candles4h : oneHourCandles}
        annotations={submitted && chartTimeframe === '1h' ? presentation.annotations : []}
      />
    </div>

    <div className="direction-question">
      <h3>未来24小时的主要走势是什么？</h3>
      <div className="direction-options" role="radiogroup" aria-label="未来走势">
        {(Object.keys(directionLabels) as Direction[]).map((direction) => <button
          key={direction}
          type="button"
          role="radio"
          aria-checked={selectedDirection === direction}
          disabled={submitted}
          className={selectedDirection === direction ? 'selected' : ''}
          onClick={() => setSelectedDirection(direction)}
        >{directionLabels[direction]}</button>)}
      </div>
      {!submitted && <button className="primary-command" type="button" disabled={!selectedDirection} onClick={() => {
        if (!selectedDirection) return
        setSubmitted(true)
        setChartTimeframe('1h')
        onAnswered({ caseId: marketCase.id, selectedDirection, correct })
      }}>提交走势判断</button>}
    </div>

    {submitted && selectedDirection && <div className={`answer-feedback ${correct ? 'correct' : 'incorrect'}`}>
      <div className="answer-result">
        {correct ? <Check size={21} /> : <CircleX size={21} />}
        <strong>{correct ? '回答正确' : '回答错误'}</strong>
      </div>
      <p className="standard-answer">实际结果标签：{presentation.resultLabel}</p>
      <p className="cutoff-judgment">截止点前的合理判断：<strong>{presentation.judgmentLabel}</strong></p>

      <section className="auxiliary-statistics">
        <h3>辅助统计</h3>
        <p>这些数值只描述背景位置，不能单独决定方向。</p>
        <dl>{presentation.statistics.map((statistic) => <div key={statistic.label}>
          <dt>{statistic.label}</dt>
          <dd>{statistic.value}</dd>
        </div>)}</dl>
      </section>

      <section className="replay-sop">
        <h3>复盘SOP</h3>
        <ol>{presentation.sopSteps.map((step) => <li key={step.title}>
          <strong>{step.title}</strong>
          <span>{step.guidance}</span>
          {step.quote && <blockquote>{step.quote}<cite>原书第{step.page}页</cite></blockquote>}
        </li>)}</ol>
      </section>

      <section className="evidence-summary">
        <h3>本题截止点前证据链</h3>
        <ul>{presentation.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
      </section>

      <section className="direction-analysis">
        <h3>分别验证三个选项</h3>
        {(Object.keys(directionLabels) as Direction[]).map((direction) => <div key={direction} className={direction === presentation.judgmentDirection ? 'is-correct' : ''}>
          <strong>{directionLabels[direction]}</strong>
          <span>{presentation.directionAnalysis[direction]}</span>
        </div>)}
      </section>

      {presentation.bookCitation && <section className="book-citation">
        <h3>本单元原书依据</h3>
        <blockquote>{presentation.bookCitation.quote}</blockquote>
        <p>原书第{presentation.bookCitation.page}页</p>
      </section>}

      <section className="actual-outcome">
        <h3>未来实际走势</h3>
        <p>{presentation.actualOutcome}</p>
      </section>

      <div className="source-reference">
        <BookOpenText size={19} />
        <span>{sourceLabel(marketCase.source)}</span>
        <button type="button" className="text-command" onClick={() => onOpenSource(marketCase.source)}>查看原书</button>
      </div>
      <button className="primary-command" type="button" onClick={() => onContinue(correct)}>{correct ? '完成本单元' : '换一个案例继续'}</button>
    </div>}
  </section>
}
