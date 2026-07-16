import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'

export type JournalCategory = 'valid-win' | 'valid-loss' | 'invalid-win' | 'invalid-loss' | 'no-trade'

export type JournalEntry = {
  id: string
  tradeId: string
  createdAt: string
  context: string
  evidence: string
  emotion: 'calm' | 'fear' | 'greed' | 'revenge' | 'hesitation'
  category: JournalCategory
  ruleViolation: boolean
  resultR: number | null
  conclusion: string
}

type JournalFormProps = {
  tradeId: string
  onSave: (entry: JournalEntry) => void
}

export function JournalForm({ tradeId, onSave }: JournalFormProps) {
  const [context, setContext] = useState('')
  const [evidence, setEvidence] = useState('')
  const [emotion, setEmotion] = useState<JournalEntry['emotion']>('calm')
  const [category, setCategory] = useState<JournalCategory>('valid-win')
  const [ruleViolation, setRuleViolation] = useState(false)
  const [resultR, setResultR] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!context.trim() || !evidence.trim() || !conclusion.trim()) {
      setError('请补全市场背景、关键证据和复盘结论')
      return
    }
    setError('')
    onSave({
      id: crypto.randomUUID?.() ?? `journal-${Date.now()}`,
      tradeId,
      createdAt: new Date().toISOString(),
      context: context.trim(),
      evidence: evidence.trim(),
      emotion,
      category,
      ruleViolation,
      resultR: resultR.trim() === '' ? null : Number(resultR),
      conclusion: conclusion.trim(),
    })
  }

  return <form className="journal-form" onSubmit={submit}>
    <div className="form-grid two-columns">
      <label>市场背景与阶段<textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="先写 4h 背景，再写 1h 阶段" /></label>
      <label>关键价量证据<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="只记录图表上可观察的证据" /></label>
      <label>情绪状态<select value={emotion} onChange={(event) => setEmotion(event.target.value as JournalEntry['emotion'])}><option value="calm">平静</option><option value="fear">恐惧</option><option value="greed">贪婪</option><option value="revenge">报复冲动</option><option value="hesitation">犹豫</option></select></label>
      <label>复盘分类<select value={category} onChange={(event) => setCategory(event.target.value as JournalCategory)}><option value="valid-win">合格决策且结果盈利</option><option value="valid-loss">合格决策但结果亏损</option><option value="invalid-win">违规决策但偶然盈利</option><option value="invalid-loss">违规决策且结果亏损</option><option value="no-trade">正确选择不交易</option></select></label>
      <label>本次结果（R）<input inputMode="decimal" value={resultR} onChange={(event) => setResultR(event.target.value)} placeholder="例如 -1 或 2.4" /></label>
      <label className="confirm-check"><input type="checkbox" checked={ruleViolation} onChange={(event) => setRuleViolation(event.target.checked)} />存在规则违反</label>
    </div>
    <label>复盘结论<textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} placeholder="下次遇到同类证据，我会如何行动？" /></label>
    {error && <p className="error-notice" role="alert">{error}</p>}
    <button className="primary-command" type="submit"><Save size={18} />保存复盘</button>
  </form>
}
