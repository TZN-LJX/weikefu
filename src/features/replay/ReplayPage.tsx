import { useState } from 'react'
import { Expand, Eye, LockKeyhole } from 'lucide-react'
import { MarketChart } from './MarketChart'
import { createReplaySession, revealNext, submitReplay, type Candle } from './replayState'

export type MarketCase = {
  id: string
  title: string
  timeframe: string
  context4h: string
  candles: Candle[]
  candles4h?: Candle[]
  cutoff: number
  evidenceOptions: { id: string; label: string }[]
}

type ReplayPageProps = {
  marketCase: MarketCase
  onComplete: (answer: {
    background4h: string
    structure1h: string
    evidence: string[]
    action: string
    invalidation: string
  }) => void
}

export function ReplayPage({ marketCase, onComplete }: ReplayPageProps) {
  const [session, setSession] = useState(() => createReplaySession(marketCase.candles, marketCase.cutoff))
  const [chartTimeframe, setChartTimeframe] = useState<'4h' | '1h'>(() => marketCase.candles4h?.length ? '4h' : '1h')
  const [background4h, setBackground4h] = useState('')
  const [structure1h, setStructure1h] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [action, setAction] = useState('')
  const [invalidation, setInvalidation] = useState('')
  const ready = Boolean(background4h && structure1h && evidence.length && action && invalidation.trim())

  return <div className="replay-page">
    <header className="replay-header">
      <div>
        <p className="eyebrow">ETHUSDT · {marketCase.timeframe}</p>
        <h1>{marketCase.title}</h1>
      </div>
      <div className="locked-state"><LockKeyhole size={16} />未来走势已隐藏</div>
    </header>

    <div className="chart-shell">
      {marketCase.candles4h?.length && <div className="chart-timeframes" role="group" aria-label="图表周期">
        <button type="button" className={chartTimeframe === '4h' ? 'active' : ''} onClick={() => setChartTimeframe('4h')}>4小时背景</button>
        <button type="button" className={chartTimeframe === '1h' ? 'active' : ''} onClick={() => setChartTimeframe('1h')}>1小时结构</button>
      </div>}
      <MarketChart candles={chartTimeframe === '4h' && marketCase.candles4h ? marketCase.candles4h : session.visibleCandles} />
      <button className="chart-expand" type="button" title="横屏查看完整图表"><Expand size={17} /></button>
    </div>

    <section className="analysis-form">
      <div className="field-row">
        <label>4小时市场背景
          <select value={background4h} onChange={(event) => setBackground4h(event.target.value)}>
            <option value="">请选择</option><option value="bullish">需求背景</option><option value="bearish">供应背景</option><option value="range">震荡待确认</option>
          </select>
        </label>
        <label>1小时结构
          <select value={structure1h} onChange={(event) => setStructure1h(event.target.value)}>
            <option value="">请选择</option><option value="accumulation">吸筹</option><option value="distribution">派发</option><option value="trend">趋势延续</option><option value="unclear">暂不明确</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>关键价量证据</legend>
        <div className="check-list">{marketCase.evidenceOptions.map((item) => <label key={item.id}>
          <input type="checkbox" checked={evidence.includes(item.id)} onChange={(event) => setEvidence(event.target.checked ? [...evidence, item.id] : evidence.filter((id) => id !== item.id))} />
          <span>{item.label}</span>
        </label>)}</div>
      </fieldset>

      <fieldset>
        <legend>行动判断</legend>
        <div className="segmented-options">
          {['做多', '做空', '不交易'].map((label) => <label key={label} className={action === label ? 'selected' : ''}>
            <input type="radio" name="action" checked={action === label} onChange={() => setAction(label)} />{label}
          </label>)}
        </div>
      </fieldset>

      <label>判断失效条件
        <textarea value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="什么价量行为出现后，说明当前判断错误？" />
      </label>

      {!session.submitted ? <button className="primary-command" type="button" disabled={!ready} onClick={() => {
        const answer = { background4h, structure1h, evidence, action, invalidation }
        onComplete(answer)
        setChartTimeframe('1h')
        setSession((current) => submitReplay(current))
      }}>提交整体判断</button> : <button className="primary-command" type="button" disabled={!session.futureCandles.length} onClick={() => setSession((current) => revealNext(current, 5))}>
        <Eye size={18} />揭示后续 5 根K线
      </button>}
    </section>
  </div>
}
