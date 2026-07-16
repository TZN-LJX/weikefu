import { BookOpenCheck } from 'lucide-react'
import type { JournalEntry } from './JournalForm'

const categoryLabels: Record<JournalEntry['category'], string> = {
  'valid-win': '合格盈利',
  'valid-loss': '合格亏损',
  'invalid-win': '违规盈利',
  'invalid-loss': '违规亏损',
  'no-trade': '正确空仓',
}

export function JournalPage({ entries }: { entries: JournalEntry[] }) {
  return <div className="page-stack">
    <header className="page-heading"><div><p className="eyebrow">过程质量优先</p><h1>交易复盘</h1></div><BookOpenCheck /></header>
    {entries.length === 0 ? <section className="empty-state"><BookOpenCheck size={30} /><h2>暂无复盘记录</h2><p>完成一笔模拟交易后，在这里记录决策证据和过程质量。</p></section> : <div className="journal-list">
      {entries.map((entry) => <article key={entry.id} className="journal-row"><div><span>{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</span><strong>{categoryLabels[entry.category]}</strong></div><p>{entry.conclusion}</p><span className={entry.ruleViolation ? 'rule-broken' : 'rule-kept'}>{entry.ruleViolation ? '存在规则违反' : '规则执行合格'}</span></article>)}
    </div>}
  </div>
}
