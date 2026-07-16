export type TradeSide = 'long' | 'short'

export type StudyTaskKind = 'review' | 'lesson' | 'replay'

export type StudyTask = {
  id: string
  minutes: number
  kind: StudyTaskKind
}

export type Explanation = {
  observation: string
  meaning: string
  expectation: string
  action: string
  invalidation: string
}
