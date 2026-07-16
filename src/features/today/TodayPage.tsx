import { BookOpen, Brain, ChartCandlestick, Play } from 'lucide-react'
import { ProgressBar } from '../../components/ProgressBar'

type TodayTask = {
  id: string
  kind: 'review' | 'lesson' | 'replay'
  minutes: number
  title: string
  detail: string
}

type TodayPageProps = {
  stageTitle: string
  progress: number
  tasks: TodayTask[]
  onStart: () => void
}

const taskMeta = {
  review: { label: '复习', Icon: Brain },
  lesson: { label: '新知识', Icon: BookOpen },
  replay: { label: '图表训练', Icon: ChartCandlestick },
}

export function TodayPage({ stageTitle, progress, tasks, onStart }: TodayPageProps) {
  const minutes = tasks.reduce((total, task) => total + task.minutes, 0)
  return <div className="page-stack">
    <header className="today-header">
      <div>
        <p className="eyebrow">当前阶段</p>
        <h1>{stageTitle}</h1>
      </div>
      <span className="progress-number">{Math.round(progress * 100)}%</span>
      <ProgressBar value={progress} label="当前阶段学习进度" />
    </header>
    <section className="today-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">自适应安排</p>
          <h2>今日任务</h2>
        </div>
        <span>预计 {minutes} 分钟</span>
      </div>
      <div className="task-list">
        {tasks.map((task, index) => {
          const { Icon, label } = taskMeta[task.kind]
          return <div className={`task-row task-${task.kind}`} key={task.id}>
            <span className="task-index">{index + 1}</span>
            <Icon size={20} />
            <div className="task-copy">
              <span>{label} · {task.minutes}分钟</span>
              <strong>{task.title}</strong>
              <small>{task.detail}</small>
            </div>
          </div>
        })}
      </div>
      <button className="primary-command" type="button" onClick={onStart}>
        <Play size={19} fill="currentColor" /> 开始今日训练
      </button>
    </section>
  </div>
}
