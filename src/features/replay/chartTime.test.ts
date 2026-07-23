import { describe, expect, it } from 'vitest'
import { TickMarkType } from 'lightweight-charts'
import { formatBeijingCrosshair, formatBeijingTick } from './chartTime'

const timestamp = 1_695_960_000 // 2023-09-29 04:00 UTC, 12:00 Beijing

describe('chart time formatting', () => {
  it('formats crosshair time as an unambiguous Beijing timestamp', () => {
    expect(formatBeijingCrosshair(timestamp)).toBe('2023-09-29 12:00（北京时间）')
  })

  it('formats time-scale ticks by their semantic type', () => {
    expect(formatBeijingTick(timestamp, TickMarkType.Year)).toBe('2023')
    expect(formatBeijingTick(timestamp, TickMarkType.Month)).toBe('2023-09')
    expect(formatBeijingTick(timestamp, TickMarkType.DayOfMonth)).toBe('09-29')
    expect(formatBeijingTick(timestamp, TickMarkType.Time)).toBe('12:00')
  })
})
