import { CheckCircle2, ChevronRight, LockKeyhole, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CourseStage } from '../pack/contentSchema'

type CurriculumPageProps = {
  stages: CourseStage[]
  unlockedStageIndex: number
}

export function CurriculumPage({ stages, unlockedStageIndex }: CurriculumPageProps) {
  return <div className="page-stack curriculum-page">
    <header className="page-heading"><div><p className="eyebrow">七阶段路线</p><h1>闯关地图</h1></div><span className="route-progress">阶段 {Math.min(unlockedStageIndex + 1, stages.length)} / {stages.length}</span></header>
    <div className="stage-list">{stages.map((stage, index) => {
      const locked = index > unlockedStageIndex
      const complete = index < unlockedStageIndex
      return <section className={`stage-band ${locked ? 'locked' : ''}`} key={stage.id}>
        <div className="stage-index">{String(index + 1).padStart(2, '0')}</div>
        <div className="stage-copy"><span>{complete ? '已完成' : locked ? '尚未解锁' : '当前阶段'}</span><h2>{stage.title}</h2><p>{stage.goal}</p><small>{stage.units.length} 个知识单元</small></div>
        {complete ? <CheckCircle2 className="stage-status complete" /> : locked ? <LockKeyhole className="stage-status" /> : stage.units[0] ? <Link className="stage-action" to={`/lesson/${stage.units[0].id}`} title="开始本阶段"><PlayCircle /><ChevronRight size={17} /></Link> : <PlayCircle className="stage-status" />}
      </section>
    })}</div>
  </div>
}
