import { useState, type FormEvent } from 'react'
import { AlertTriangle, Calculator, CheckCircle2 } from 'lucide-react'
import { calculateTradePlan, validateTradeChecklist } from '../../domain/risk'

export type SimulationTrade = {
  id: string
  createdAt: string
  side: 'long' | 'short'
  entry: number
  stop: number
  target: number
  leverage: number
  maxNotional: number
  riskAmount: number
  plannedR: number
  checklist: {
    background4h: string
    structure1h: string
    evidence: string[]
    confirmation: string
    invalidation: string
    checkedNoTrade: boolean
  }
}

type SimulationPageProps = {
  equity?: number
  onCreateTrade: (trade: SimulationTrade) => void
}

export function SimulationPage({ equity = 1_000, onCreateTrade }: SimulationPageProps) {
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [leverage, setLeverage] = useState('5')
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [background4h, setBackground4h] = useState('')
  const [structure1h, setStructure1h] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState('')
  const [invalidation, setInvalidation] = useState('')
  const [checkedNoTrade, setCheckedNoTrade] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<ReturnType<typeof calculateTradePlan>>()
  const [submitted, setSubmitted] = useState(false)

  const toggleEvidence = (value: string, checked: boolean) => {
    setEvidence((current) => checked ? [...current, value] : current.filter((item) => item !== value))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (submitted) return

    const checklist = { background4h, structure1h, evidence, confirmation, invalidation, checkedNoTrade }
    const checklistErrors = validateTradeChecklist(checklist)
    let plan: ReturnType<typeof calculateTradePlan> | undefined
    try {
      plan = calculateTradePlan({
        equity,
        availableEquity: equity,
        leverage: Number(leverage),
        side,
        entry: Number(entry),
        stop: Number(stop),
        target: Number(target),
      })
    } catch (reason) {
      checklistErrors.push(reason instanceof Error ? reason.message : '订单参数无效')
    }

    if (checklistErrors.length || !plan) {
      setErrors(checklistErrors)
      setResult(undefined)
      return
    }

    setErrors([])
    setResult(plan)
    setSubmitted(true)
    onCreateTrade({
      id: crypto.randomUUID?.() ?? `trade-${Date.now()}`,
      createdAt: new Date().toISOString(),
      side,
      entry: Number(entry),
      stop: Number(stop),
      target: Number(target),
      leverage: Number(leverage),
      maxNotional: plan.maxNotional,
      riskAmount: plan.riskAmount,
      plannedR: plan.plannedR,
      checklist,
    })
  }

  return <div className="page-stack simulation-page">
    <header className="page-heading">
      <div><p className="eyebrow">规则优先 · 仅模拟</p><h1>风险门控订单</h1></div>
      <span className="account-balance">模拟权益 <strong>{equity.toFixed(2)} USDT</strong></span>
    </header>

    <form className="trade-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-number">1</div>
        <div className="section-body">
          <h2>订单与风险</h2>
          <div className="form-grid three-columns">
            <label>方向<select value={side} onChange={(event) => setSide(event.target.value as 'long' | 'short')}><option value="long">做多</option><option value="short">做空</option></select></label>
            <label>杠杆<input aria-label="杠杆" inputMode="decimal" value={leverage} onChange={(event) => setLeverage(event.target.value)} /></label>
            <label>入场价<input aria-label="入场价" inputMode="decimal" value={entry} onChange={(event) => setEntry(event.target.value)} /></label>
            <label>止损价<input aria-label="止损价" inputMode="decimal" value={stop} onChange={(event) => setStop(event.target.value)} /></label>
            <label>目标价<input aria-label="目标价" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="section-number">2</div>
        <div className="section-body">
          <h2>多周期判断</h2>
          <div className="form-grid two-columns">
            <label>4小时市场背景<select value={background4h} onChange={(event) => setBackground4h(event.target.value)}><option value="">请选择</option><option value="需求背景">需求背景</option><option value="供应背景">供应背景</option><option value="中性待确认">中性待确认</option></select></label>
            <label>1小时结构<select value={structure1h} onChange={(event) => setStructure1h(event.target.value)}><option value="">请选择</option><option value="吸筹右侧">吸筹右侧</option><option value="派发右侧">派发右侧</option><option value="趋势延续">趋势延续</option><option value="结构不清">结构不清</option></select></label>
          </div>
          <fieldset className="evidence-fieldset"><legend>关键价量证据</legend><div className="evidence-choices">
            {['回测缩量', '突破放量', '假突破收回', '供应持续减弱'].map((item) => <label key={item}><input aria-label={item} type="checkbox" checked={evidence.includes(item)} onChange={(event) => toggleEvidence(item, event.target.checked)} />{item}</label>)}
          </div></fieldset>
        </div>
      </section>

      <section className="form-section">
        <div className="section-number">3</div>
        <div className="section-body">
          <h2>确认与失效</h2>
          <div className="form-grid two-columns">
            <label>入场确认条件<textarea value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <label>判断失效条件<textarea value={invalidation} onChange={(event) => setInvalidation(event.target.value)} /></label>
          </div>
          <label className="confirm-check"><input aria-label="我已检查不交易理由" type="checkbox" checked={checkedNoTrade} onChange={(event) => setCheckedNoTrade(event.target.checked)} />我已检查不交易理由，并确认当前证据足以承担风险</label>
        </div>
      </section>

      {errors.length > 0 && <div className="validation-summary" role="alert"><AlertTriangle size={19} /><div><strong>订单未通过规则检查</strong>{errors.map((error) => <p key={error}>{error}</p>)}</div></div>}

      {result && <section className="risk-result" aria-live="polite">
        <div><span>单笔最大风险</span><strong>{result.riskAmount.toFixed(2)} USDT</strong></div>
        <div><span>最大名义仓位</span><strong>{result.maxNotional.toFixed(2)} USDT</strong></div>
        <div><span>计划盈亏比</span><strong>{result.plannedR.toFixed(2)} R</strong></div>
        <CheckCircle2 size={24} />
      </section>}

      <button className="primary-command" type="submit" disabled={submitted}><Calculator size={18} />{submitted ? '模拟订单已创建' : '计算并提交模拟订单'}</button>
    </form>
  </div>
}
