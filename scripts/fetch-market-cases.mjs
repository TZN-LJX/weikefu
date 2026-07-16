import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

const endpoints = [
  'https://fapi.binance.com/fapi/v1/klines',
  'https://fapi1.binance.com/fapi/v1/klines',
]

const windows = [
  { id: 'eth-2024-01-18', title: '吸筹右侧变式', end: '2024-01-18T00:00:00Z', caseType: 'typical' },
  { id: 'eth-2024-03-18', title: '抢购高潮后的供应', end: '2024-03-18T00:00:00Z', caseType: 'distribution' },
  { id: 'eth-2024-06-22', title: '震荡区间：证据是否足够', end: '2024-06-22T00:00:00Z', caseType: 'no-trade' },
  { id: 'eth-2024-08-10', title: '恐慌抛售后的测试', end: '2024-08-10T00:00:00Z', caseType: 'ambiguous' },
  { id: 'eth-2024-11-12', title: '再吸筹与突破', end: '2024-11-12T00:00:00Z', caseType: 'typical' },
  { id: 'eth-2025-02-08', title: '反弹失败案例', end: '2025-02-08T00:00:00Z', caseType: 'failed' },
  { id: 'eth-2025-05-15', title: '趋势中的回测', end: '2025-05-15T00:00:00Z', caseType: 'variant' },
]

const evidenceOptions = [
  { id: 'demand-expands', label: '上涨波幅与成交量同步扩大' },
  { id: 'supply-expands', label: '下跌波幅与成交量同步扩大' },
  { id: 'test-volume-contracts', label: '回测时成交量和下跌速度收缩' },
  { id: 'effort-no-result', label: '成交量放大但价格进展有限' },
  { id: 'false-break-return', label: '突破区间后迅速收回' },
  { id: 'evidence-conflicts', label: '供需证据互相冲突，暂不交易' },
]

export function normalizeKlines(rows) {
  return rows.map((row) => ({
    time: Math.floor(Number(row[0]) / (Number(row[0]) > 100_000_000_000_000 ? 1_000_000 : 1000)),
    open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
  }))
}

export function parseArchiveCsv(csv) {
  return csv.trim().split(/\r?\n/).map((line) => line.split(',')).filter((row) => /^\d+$/.test(row[0])).map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]])
}

export function splitReplayWindow(candles, hiddenCount) {
  if (hiddenCount <= 0 || hiddenCount >= candles.length) throw new Error('隐藏区间必须小于完整K线数量')
  return { cutoff: candles.length - hiddenCount, hiddenCount }
}

export function visibleContextCandles(candles, cutoffTime) {
  return candles.filter((candle) => candle.time <= cutoffTime)
}

function archiveMonths(endTime) {
  const start = new Date(endTime - 45 * 86_400_000)
  const end = new Date(endTime)
  const months = []
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return months
}

async function fetchArchiveKlines(interval, endTime, limit) {
  const rows = []
  for (const month of archiveMonths(endTime)) {
    const filename = `ETHUSDT-${interval}-${month}.zip`
    const url = `https://data.binance.vision/data/futures/um/monthly/klines/ETHUSDT/${interval}/${filename}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`历史归档 HTTP ${response.status}`)
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    const entry = Object.values(zip.files).find((file) => !file.dir && file.name.endsWith('.csv'))
    if (!entry) throw new Error(`${filename} 缺少 CSV`)
    rows.push(...parseArchiveCsv(await entry.async('text')))
  }
  const candles = normalizeKlines(rows).filter((candle) => candle.time * 1000 < endTime).sort((left, right) => left.time - right.time).slice(-limit)
  if (candles.length < limit * 0.9) throw new Error('历史归档K线数量不足')
  return candles
}

async function fetchKlines(interval, endTime, limit) {
  let lastError
  for (const endpoint of endpoints) {
    const url = new URL(endpoint)
    url.searchParams.set('symbol', 'ETHUSDT')
    url.searchParams.set('interval', interval)
    url.searchParams.set('endTime', String(endTime))
    url.searchParams.set('limit', String(limit))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const rows = await response.json()
      if (!Array.isArray(rows) || rows.length < limit * 0.9) throw new Error('返回的K线数量不足')
      return normalizeKlines(rows)
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timeout)
    }
  }
  try {
    return await fetchArchiveKlines(interval, endTime, limit)
  } catch (archiveError) {
    throw new Error(`无法获取 Binance ETHUSDT ${interval} K线：${lastError?.message || '实时接口失败'}；${archiveError.message}`)
  }
}

async function main() {
  const cases = []
  for (const [index, item] of windows.entries()) {
    const endTime = Date.parse(item.end)
    const [candles, candles4h] = await Promise.all([
      fetchKlines('1h', endTime, 240),
      fetchKlines('4h', endTime, 120),
    ])
    const { cutoff } = splitReplayWindow(candles, 48)
    const contextCutoff = candles[cutoff - 1].time
    cases.push({
      id: item.id,
      title: item.title,
      timeframe: '1h',
      context4h: '先观察 4 小时供需背景，再判断 1 小时结构；不要根据案例标题直接下结论。',
      cutoff,
      evidenceOptions,
      candles,
      candles4h: visibleContextCandles(candles4h, contextCutoff),
      reference: {
        caseType: item.caseType,
        gradingMode: 'evidence-consistency',
        note: '案例标题只用于复盘索引；正式作答必须以截止点前的价量证据和失效条件为准。',
      },
    })
    process.stdout.write(`ETH 历史案例 ${index + 1}/${windows.length} 已获取\n`)
  }
  const output = path.join(process.cwd(), 'private-content', 'market-cases.json')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({
    version: 1,
    symbol: 'ETHUSDT',
    market: 'Binance USD-M Futures',
    generatedAt: new Date().toISOString(),
    closedCandlesOnly: true,
    cases,
  }, null, 2), 'utf8')
  process.stdout.write(`历史案例已生成：${output}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
