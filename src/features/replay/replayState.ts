export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type ReplaySession = {
  visibleCandles: Candle[]
  futureCandles: Candle[]
  submitted: boolean
}

export function createReplaySession(candles: Candle[], cutoff: number): ReplaySession {
  if (cutoff <= 0 || cutoff >= candles.length) {
    throw new Error('回放截点必须位于行情中间')
  }
  return {
    visibleCandles: candles.slice(0, cutoff),
    futureCandles: candles.slice(cutoff),
    submitted: false,
  }
}

export function serializeVisibleSession(session: ReplaySession) {
  return {
    visibleCandles: session.visibleCandles,
    submitted: session.submitted,
  }
}

export function submitReplay(session: ReplaySession): ReplaySession {
  return { ...session, submitted: true }
}

export function revealNext(session: ReplaySession, count: number): ReplaySession {
  if (!session.submitted) throw new Error('提交判断后才能揭示走势')
  const reveal = session.futureCandles.slice(0, count)
  return {
    ...session,
    visibleCandles: [...session.visibleCandles, ...reveal],
    futureCandles: session.futureCandles.slice(count),
  }
}
