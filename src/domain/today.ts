import type { StudyTask, StudyTaskKind } from './types'

type SourceTask = Omit<StudyTask, 'kind'>

type TodayInput = {
  dueReviews: SourceTask[]
  newLessons: SourceTask[]
  replayCases: SourceTask[]
  minutes: number
}

export function buildTodayQueue(input: TodayInput) {
  const queue: StudyTask[] = []
  let used = 0

  const add = (tasks: SourceTask[], kind: StudyTaskKind, limit?: number) => {
    for (const task of limit ? tasks.slice(0, limit) : tasks) {
      if (used + task.minutes > input.minutes) continue
      queue.push({ ...task, kind })
      used += task.minutes
    }
  }

  add(input.dueReviews, 'review')
  add(input.newLessons, 'lesson', 1)
  add(input.replayCases, 'replay', 1)
  return queue
}
