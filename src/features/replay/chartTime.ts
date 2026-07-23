import { TickMarkType, type BusinessDay, type Time } from 'lightweight-charts'

type DisplayTime = Time | number

type BeijingParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}

function timestampOf(time: DisplayTime) {
  if (typeof time === 'number') return time
  const day = time as BusinessDay
  return Date.UTC(day.year, day.month - 1, day.day) / 1_000
}

function beijingParts(time: DisplayTime): BeijingParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampOf(time) * 1_000))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') }
}

export function formatBeijingCrosshair(time: DisplayTime) {
  const parts = beijingParts(time)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}（北京时间）`
}

export function formatBeijingTick(time: DisplayTime, tickMarkType: TickMarkType) {
  const parts = beijingParts(time)
  if (tickMarkType === TickMarkType.Year) return parts.year
  if (tickMarkType === TickMarkType.Month) return `${parts.year}-${parts.month}`
  if (tickMarkType === TickMarkType.DayOfMonth) return `${parts.month}-${parts.day}`
  return `${parts.hour}:${parts.minute}`
}
