import { BookOpenText, ExternalLink } from 'lucide-react'
import type { ContentUnit } from '../pack/contentSchema'

export function LessonPage({ unit, onOpenSource, onStartExercise }: { unit: ContentUnit; onOpenSource: () => void; onStartExercise: () => void }) {
  return <article className="page-stack lesson-page">
    <header className="lesson-header"><p className="eyebrow">短讲解</p><h1>{unit.title}</h1><p>{unit.summary}</p></header>
    {unit.keyPoints.length > 0 && <section className="lesson-section"><h2>本节判断顺序</h2><ol>{unit.keyPoints.map((point) => <li key={point}>{point}</li>)}</ol></section>}
    <section className="source-section"><div><BookOpenText size={21} /><div><span>原书来源</span><strong>{unit.source.chapter} · 第 {unit.source.pageStart}{unit.source.pageEnd > unit.source.pageStart ? `-${unit.source.pageEnd}` : ''} 页</strong></div></div><blockquote>{unit.excerpt}</blockquote><button className="secondary-command" type="button" onClick={onOpenSource}><ExternalLink size={17} />打开原书页</button></section>
    <button className="primary-command" type="button" onClick={onStartExercise}>进入本节检验</button>
  </article>
}
