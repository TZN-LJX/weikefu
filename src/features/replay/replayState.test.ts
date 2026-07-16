import { describe, expect, it } from 'vitest'
import { createReplaySession, revealNext, serializeVisibleSession, submitReplay } from './replayState'

const candles = Array.from({ length: 120 }, (_, index) => ({
  time: 1_700_000_000 + index * 3_600,
  open: 3_000 + index,
  high: 3_006 + index,
  low: 2_994 + index,
  close: 3_002 + index,
  volume: 100 + index,
}))

describe('replay state', () => {
  it('keeps future candles outside the serializable session', () => {
    const session = createReplaySession(candles, 100)
    expect(session.visibleCandles).toHaveLength(100)
    expect(session.futureCandles).toHaveLength(20)
    expect(JSON.stringify(serializeVisibleSession(session))).not.toContain('3119')
  })

  it('does not reveal candles before submission', () => {
    const session = createReplaySession(candles, 100)
    expect(() => revealNext(session, 5)).toThrow('提交判断后才能揭示走势')
  })

  it('reveals a fixed number after submission', () => {
    const session = submitReplay(createReplaySession(candles, 100))
    const next = revealNext(session, 5)
    expect(next.visibleCandles).toHaveLength(105)
    expect(next.futureCandles).toHaveLength(15)
  })
})
