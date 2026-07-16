type ProgressBarProps = {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)))
  return <div className="progress" aria-label={label ?? `进度 ${percent}%`}>
    <span style={{ width: `${percent}%` }} />
  </div>
}
