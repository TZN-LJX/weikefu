import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { z } from 'zod'
import { buildSourcePacket, parseApiConfigText } from './generate-challenge-content.mjs'

const directions = ['up', 'down', 'range']

export function normalizeKlines(rows) {
  return rows.map((row) => ({
    time: Math.floor(Number(row[0]) / (Number(row[0]) > 100_000_000_000_000 ? 1_000_000 : 1_000)),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }))
}

export function parseArchiveCsv(csv) {
  return csv.trim().split(/\r?\n/)
    .map((line) => line.split(','))
    .filter((row) => /^\d+$/.test(row[0]))
    .map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]])
}

export function classifyDirection(metrics) {
  if (metrics.return24h >= 0.02 && metrics.minInterimReturn > -0.02) return 'up'
  if (metrics.return24h <= -0.02 && metrics.maxInterimReturn < 0.02) return 'down'
  if (Math.abs(metrics.return24h) < 0.02 && metrics.minInterimReturn >= -0.035 && metrics.maxInterimReturn <= 0.035) return 'range'
  return undefined
}

function continuous(candles, seconds) {
  return candles.every((candle, index) => index === 0 || candle.time - candles[index - 1].time === seconds)
}

export function buildReplayCandidate(oneHourCandles, fourHourCandles, cutoffIndex) {
  const visibleCandles = oneHourCandles.slice(cutoffIndex - 120, cutoffIndex)
  const futureCandles = oneHourCandles.slice(cutoffIndex, cutoffIndex + 24)
  if (visibleCandles.length !== 120 || futureCandles.length !== 24 || !continuous(visibleCandles, 3_600) || !continuous(futureCandles, 3_600)) {
    throw new Error('回放窗口必须包含连续的120根可见K线和24根未来K线')
  }
  const cutoffTime = futureCandles[0].time
  if (visibleCandles.at(-1).time + 3_600 !== cutoffTime) throw new Error('回放截止点不连续')
  const cutoffClose = visibleCandles.at(-1).close
  const interimReturns = futureCandles.map((candle) => candle.close / cutoffClose - 1)
  const metrics = {
    return24h: interimReturns.at(-1),
    minInterimReturn: Math.min(...interimReturns),
    maxInterimReturn: Math.max(...interimReturns),
  }
  const correctDirection = classifyDirection(metrics)
  const candles4h = fourHourCandles.filter((candle) => candle.time + 14_400 <= cutoffTime).slice(-60)
  if (candles4h.length < 24 || !continuous(candles4h, 14_400)) throw new Error('4小时背景K线不足或不连续')
  return {
    id: `raw-${cutoffTime}`,
    cutoffTime,
    horizonEndTime: futureCandles.at(-1).time + 3_600,
    visibleCandles,
    futureCandles,
    candles4h,
    metrics,
    correctDirection,
  }
}

export function selectUnitCandidates(candidates, unitId) {
  const selectedOriginals = directions.map((direction) => candidates.find((candidate) => (candidate.correctDirection ?? candidate.direction) === direction))
  if (selectedOriginals.some((candidate) => !candidate)) throw new Error(`${unitId} 缺少上涨、下跌或震荡案例`)
  const selectedSet = new Set(selectedOriginals)
  return {
    selected: selectedOriginals.map((candidate, index) => ({
      ...candidate,
      id: `${unitId}-case-${String(index + 1).padStart(2, '0')}`,
      unitId,
      correctDirection: candidate.correctDirection ?? candidate.direction,
    })),
    remaining: candidates.filter((candidate) => !selectedSet.has(candidate)),
  }
}

function monthsBetween(startDate, endDate) {
  const months = []
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
  const inclusiveEnd = new Date(endDate.getTime() - 1)
  const last = new Date(Date.UTC(inclusiveEnd.getUTCFullYear(), inclusiveEnd.getUTCMonth(), 1))
  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return months
}

export function buildArchiveDescriptor(symbol, interval, month) {
  const filename = `${symbol}-${interval}-${month}.zip`
  return {
    filename,
    url: `https://data.binance.vision/data/futures/um/monthly/klines/${symbol}/${interval}/${filename}`,
  }
}

export async function cachedArchive(interval, month, cacheDirectory, symbol = 'ETHUSDT') {
  const { filename, url } = buildArchiveDescriptor(symbol, interval, month)
  const cachePath = path.join(cacheDirectory, filename)
  let bytes
  try {
    await access(cachePath)
    bytes = await readFile(cachePath)
  } catch {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${filename} 下载失败（HTTP ${response.status}）`)
    bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(cachePath, bytes)
  }
  const zip = await JSZip.loadAsync(bytes)
  const entry = Object.values(zip.files).find((file) => !file.dir && file.name.endsWith('.csv'))
  if (!entry) throw new Error(`${filename} 缺少 CSV`)
  return normalizeKlines(parseArchiveCsv(await entry.async('text')))
}

export async function loadArchiveSeries(interval, startDate, endDate, cacheDirectory, symbol = 'ETHUSDT') {
  const rows = []
  const months = monthsBetween(startDate, endDate)
  for (const [index, month] of months.entries()) {
    rows.push(...await cachedArchive(interval, month, cacheDirectory, symbol))
    process.stdout.write(`Binance ${interval} ${index + 1}/${months.length} 已读取\n`)
  }
  const startTime = startDate.getTime() / 1_000
  const endTime = endDate.getTime() / 1_000
  return rows.filter((candle) => candle.time >= startTime && candle.time < endTime).sort((left, right) => left.time - right.time)
}

export function scanCandidates(oneHourCandles, fourHourCandles) {
  const candidates = []
  for (let cutoffIndex = 120; cutoffIndex <= oneHourCandles.length - 24; cutoffIndex += 24) {
    try {
      const candidate = buildReplayCandidate(oneHourCandles, fourHourCandles, cutoffIndex)
      if (candidate.correctDirection) candidates.push(candidate)
    } catch {
      // Skip archive gaps and windows without enough 4h context.
    }
  }
  return candidates
}

export function takeEvenly(items, count) {
  if (items.length < count) throw new Error(`清晰行情不足：需要 ${count}，只有 ${items.length}`)
  return Array.from({ length: count }, (_, index) => items[Math.floor(index * items.length / count)])
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function visibleFacts(candidate) {
  const visible = candidate.visibleCandles
  const recent = visible.slice(-24)
  const prior = visible.slice(-48, -24)
  const high = Math.max(...visible.map((candle) => candle.high))
  const low = Math.min(...visible.map((candle) => candle.low))
  const cutoffClose = visible.at(-1).close
  const recentReturn = cutoffClose / recent[0].open - 1
  const priorReturn = prior.at(-1).close / prior[0].open - 1
  const recentVolume = average(recent.map((candle) => candle.volume))
  const priorVolume = average(prior.map((candle) => candle.volume))
  return {
    recentReturn,
    priorReturn,
    volumeRatio: recentVolume / priorVolume,
    rangePosition: (cutoffClose - low) / Math.max(1e-9, high - low),
    last24Candles: recent.map((candle) => [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume]),
  }
}

const AnalysisSchema = z.object({
  caseId: z.string().min(1),
  cutoffJudgment: z.enum(directions),
  evidence: z.array(z.string().min(1)).min(3).max(6),
  annotations: z.array(z.object({
    time: z.number().int().nonnegative(),
    description: z.string().min(1).optional(),
  })).min(1).max(8),
  directionAnalysis: z.object({ up: z.string().min(1), down: z.string().min(1), range: z.string().min(1) }),
}).superRefine((analysis, context) => {
  const learnerText = [
    ...analysis.evidence,
    analysis.directionAnalysis.up,
    analysis.directionAnalysis.down,
    analysis.directionAnalysis.range,
  ].join('\n')
  if (/recentReturn|priorReturn|rangePosition|volumeRatio|\b1\d{9}\b/.test(learnerText)) {
    context.addIssue({ code: 'custom', message: '学习者文本不能包含内部指标名或Unix时间戳' })
  }
  const annotationTimes = analysis.annotations.map((annotation) => annotation.time)
  if (new Set(annotationTimes).size !== annotationTimes.length
    || annotationTimes.some((time, index) => index > 0 && time <= annotationTimes[index - 1])) {
    context.addIssue({ code: 'custom', path: ['annotations'], message: 'K线标注必须按时间升序且不能重复' })
  }
})

export function validateReplayAnalyses(value) {
  return z.array(AnalysisSchema).length(3).parse(value)
}

function parseJsonObject(content) {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('案例解析接口未返回 JSON 对象')
  return JSON.parse(content.slice(start, end + 1))
}

export function buildAnalysisSummaries(cases) {
  return cases.map((candidate) => ({
    caseId: candidate.id,
    cutoffTime: new Date(candidate.cutoffTime * 1_000).toISOString(),
    visibleFacts: visibleFacts(candidate),
  }))
}

async function requestAnalyses(config, unit, cases, sourcePacket) {
  const summaries = buildAnalysisSummaries(cases)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 240_000)
  const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      max_completion_tokens: 9_000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是严谨的威科夫历史行情题目编辑。你只能看到并使用截止点前数据，必须独立给出当时的合理判断。只输出合法JSON。' },
        { role: 'user', content: `为知识单元“${unit.title}”的3个ETHUSDT永续历史案例编写固定解析。\n判断要点：${unit.keyPoints.join('；')}\n原书章节与页码：${unit.source.chapter}，${unit.source.pageStart}-${unit.source.pageEnd}页。\n\n输出：{"analyses":[{"caseId":"...","cutoffJudgment":"up|down|range","evidence":["3到6条截止点前可观察价量事实"],"annotations":[{"time":1700000000,"description":"A柱的价量意义"}],"directionAnalysis":{"up":"上涨为何成立或不成立","down":"下跌为何成立或不成立","range":"震荡为何成立或不成立"}}]}\n\n要求：\n1. cutoffJudgment是截止点当时的独立判断，只能根据可见行情在up、down、range中选择。\n2. directionAnalysis必须分别解释三个选项，不能只写所选判断。\n3. evidence只能引用visibleFacts与last24Candles。\n4. 解析要按“背景与关键位置→当前位置→价量形态→形态性质→努力与结果→三个选项→结论和失效条件”的SOP组织。\n5. annotations必须选择1到8根截止点前关键K线，按time升序排列；evidence用A柱、B柱等称呼，不得直接显示time。\n6. evidence与directionAnalysis只能使用“最近24小时涨跌幅”“此前24小时涨跌幅”“最近120小时区间位置”“成交量对比”等中文名称，禁止recentReturn、priorReturn、rangePosition、volumeRatio和十位Unix时间戳。\n7. 解析必须对应给定原书材料，结论必须包含失效条件。\n\n截止点前案例数据：${JSON.stringify(summaries)}\n\n原书材料：\n${sourcePacket}` },
      ],
    }),
  }).finally(() => clearTimeout(timeout))
  if (!response.ok) throw new Error(`案例解析生成失败（HTTP ${response.status}）`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('案例解析生成返回为空')
  const analyses = validateReplayAnalyses(parseJsonObject(content).analyses)
  const expectedIds = new Set(cases.map((candidate) => candidate.id))
  if (analyses.some((analysis) => !expectedIds.has(analysis.caseId))) throw new Error('案例解析 ID 不匹配')
  return analyses
}

function percent(value) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

export function buildActualOutcome(candidate) {
  return `未来24小时收盘净变化 ${percent(candidate.metrics.return24h)}，期间最低相对变化 ${percent(candidate.metrics.minInterimReturn)}，最高相对变化 ${percent(candidate.metrics.maxInterimReturn)}。`
}

export function inferCutoffJudgment(facts) {
  if (facts.recentReturn >= 0.02 && facts.priorReturn >= -0.01 && facts.rangePosition >= 0.65) return 'up'
  if (facts.recentReturn <= -0.02 && facts.priorReturn <= 0.01 && facts.rangePosition <= 0.35) return 'down'
  return 'range'
}

function price(value) {
  return Number(value).toFixed(2)
}

function volume(value) {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  return Number(value).toFixed(2)
}

function annotationDescription(candle, index) {
  const label = String.fromCharCode(65 + index)
  const movement = candle[4] >= candle[1] ? '上涨至' : '下跌至'
  return `${label}柱从 ${price(candle[1])} ${movement} ${price(candle[4])}，成交量 ${volume(candle[5])}`
}

export function fallbackAnalyses(unit, cases) {
  return cases.map((candidate) => {
    const facts = visibleFacts(candidate)
    const directionNames = { up: '上涨', down: '下跌', range: '震荡／方向不明' }
    const cutoffJudgment = inferCutoffJudgment(facts)
    const judgment = directionNames[cutoffJudgment]
    const annotations = [...facts.last24Candles]
      .sort((left, right) => right[5] - left[5])
      .slice(0, 3)
      .sort((left, right) => left[0] - right[0])
      .map((candle, index) => ({
        time: candle[0],
        description: annotationDescription(candle, index),
      }))
    return {
      caseId: candidate.id,
      cutoffJudgment,
      annotations,
      evidence: [
        `先按“${unit.keyPoints[0]}”观察背景，不能只凭最后一根K线判断。`,
        `截止前24小时价格变化为 ${percent(facts.recentReturn)}，前一段24小时变化为 ${percent(facts.priorReturn)}。`,
        `最近24小时平均成交量是此前24小时的 ${facts.volumeRatio.toFixed(2)} 倍，需要结合价格进展判断努力与结果。`,
        `截止价位于过去120小时区间的 ${(facts.rangePosition * 100).toFixed(1)}% 位置。`,
        annotations.map((annotation) => annotation.description).join('；') + '。',
      ],
      directionAnalysis: {
        up: cutoffJudgment === 'up' ? `截止点判断偏多。可见行情按“${unit.keyPoints[1] ?? unit.keyPoints[0]}”形成需求占优的联合证据。失效条件：价格跌回原区间且供应持续扩大。` : `上涨证据不足，截止点前没有形成足以推翻“${judgment}”判断的持续需求进展。`,
        down: cutoffJudgment === 'down' ? `截止点判断偏空。可见行情按“${unit.keyPoints[1] ?? unit.keyPoints[0]}”形成供应占优的联合证据。失效条件：价格收复原区间且需求持续扩大。` : `下跌证据不足，截止点前没有形成足以推翻“${judgment}”判断的持续供应进展。`,
        range: cutoffJudgment === 'range' ? '截止点判断为等待／方向不明。供需证据没有形成可持续的单边优势，等待确认比强行预测更符合原书顺序。失效条件：价格有效离开区间并出现同方向价量跟随。' : `震荡判断不成立，因为截止点前已经出现支持${judgment}的方向性价格进展。`,
      },
    }
  })
}

async function analysesWithRetry(config, unit, cases, sourcePacket) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestAnalyses(config, unit, cases, sourcePacket)
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500))
    }
  }
  process.stderr.write(`案例解析接口不可用，使用固定规则解析：${lastError?.message || '未知错误'}\n`)
  return fallbackAnalyses(unit, cases)
}

async function main() {
  const cwd = process.cwd()
  const contentDirectory = path.join(cwd, 'private-content')
  const cacheDirectory = path.join(contentDirectory, 'binance-cache')
  const draftDirectory = path.join(contentDirectory, 'market-drafts')
  await mkdir(cacheDirectory, { recursive: true })
  await mkdir(draftDirectory, { recursive: true })
  const startDate = new Date(process.env.WEIKEFU_MARKET_START || '2023-01-01T00:00:00Z')
  const endDate = new Date(process.env.WEIKEFU_MARKET_END || '2026-07-01T00:00:00Z')
  const [oneHourCandles, fourHourCandles] = await Promise.all([
    loadArchiveSeries('1h', startDate, endDate, cacheDirectory),
    loadArchiveSeries('4h', startDate, endDate, cacheDirectory),
  ])
  const candidates = scanCandidates(oneHourCandles, fourHourCandles)
  const selectedPool = directions.flatMap((direction) => takeEvenly(candidates.filter((candidate) => candidate.correctDirection === direction), 14))
  const course = JSON.parse(await readFile(path.join(contentDirectory, 'course.json'), 'utf8'))
  const pages = JSON.parse(await readFile(path.join(contentDirectory, 'original-pages.json'), 'utf8'))
  const configPath = process.env.WEIKEFU_API_FILE || path.join(process.env.USERPROFILE || '', 'Desktop', 'APIKEY.txt')
  let config
  try {
    config = parseApiConfigText(await readFile(configPath, 'utf8'))
  } catch {
    config = undefined
  }
  let available = selectedPool
  const finalCases = []
  const units = course.stages.flatMap((stage) => stage.units)
  for (const [unitIndex, unit] of units.entries()) {
    const selection = selectUnitCandidates(available, unit.id)
    available = selection.remaining
    const draftPath = path.join(draftDirectory, `${unit.id}.json`)
    let analyses
    if (process.env.WEIKEFU_REGENERATE !== '1') {
      try {
        analyses = validateReplayAnalyses(JSON.parse(await readFile(draftPath, 'utf8')))
      } catch {
        analyses = undefined
      }
    }
    if (!analyses) {
      analyses = config
        ? await analysesWithRetry(config, unit, selection.selected, buildSourcePacket(pages, unit.source))
        : fallbackAnalyses(unit, selection.selected)
      await writeFile(draftPath, JSON.stringify(analyses, null, 2), 'utf8')
    }
    const analysisById = new Map(analyses.map((analysis) => [analysis.caseId, analysis]))
    for (const candidate of selection.selected) {
      const analysis = analysisById.get(candidate.id)
      if (!analysis) throw new Error(`${candidate.id} 缺少固定解析`)
      finalCases.push({
        ...candidate,
        title: `ETH 回放 ${String(finalCases.length + 1).padStart(2, '0')}`,
        symbol: 'ETHUSDT',
        market: 'Binance USD-M Futures',
        timeframe: '1h',
        cutoffJudgment: analysis.cutoffJudgment,
        annotations: analysis.annotations,
        evidence: analysis.evidence,
        directionAnalysis: analysis.directionAnalysis,
        actualOutcome: buildActualOutcome(candidate),
        source: unit.source,
      })
    }
    process.stdout.write(`ETH 案例解析 ${unitIndex + 1}/${units.length} 已校验\n`)
  }
  if (finalCases.length !== 42 || new Set(finalCases.map((item) => item.cutoffTime)).size !== 42) throw new Error('最终必须生成42个不重复ETH案例')
  const output = path.join(contentDirectory, 'market-cases.json')
  await writeFile(output, JSON.stringify({
    version: 2,
    symbol: 'ETHUSDT',
    market: 'Binance USD-M Futures',
    generatedAt: new Date().toISOString(),
    cases: finalCases,
  }, null, 2), 'utf8')
  process.stdout.write(`ETH 历史案例已生成：${output}（42 个）\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
