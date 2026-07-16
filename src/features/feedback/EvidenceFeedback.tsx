import { AlertTriangle, Search } from 'lucide-react'

type EvidenceFeedbackProps = {
  evidence: { id: string; label: string }[]
  prompt: string
  onRetry: () => void
}

export function EvidenceFeedback({ evidence, prompt, onRetry }: EvidenceFeedbackProps) {
  return <section className="feedback-panel">
    <div className="feedback-title">
      <AlertTriangle size={20} />
      <div>
        <p className="eyebrow">未来K线仍然隐藏</p>
        <h2>重新检查证据</h2>
      </div>
    </div>
    <div className="evidence-list">
      {evidence.map((item, index) => <div key={item.id}>
        <span>{index + 1}</span>
        <p>{item.label}</p>
      </div>)}
    </div>
    <div className="socratic-prompt">
      <Search size={18} />
      <p>{prompt}</p>
    </div>
    <button className="primary-command" type="button" onClick={onRetry}>重新判断</button>
  </section>
}
