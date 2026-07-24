import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  buildActualOutcome,
  fallbackAnalyses,
  loadArchiveSeries,
  scanCandidates,
} from './fetch-market-cases.mjs'

const TRAINING_STAGE_ID = 'stage-8-case-training'
const TRAINING_UNIT_ID = 'stage-8-real-case-training'
const MINIMUM_SPACING_SECONDS = 7 * 86_400
const DIRECTIONS = ['up', 'down', 'range']
const TRAINING_SOURCE = {
  pdfPath: 'assets/original.pdf',
  chapter: '第一章 聪明钱的看盘顺序',
  pageStart: 17,
  pageEnd: 25,
}

export const TRAINING_UNIT = {
  id: TRAINING_UNIT_ID,
  mode: 'case-training',
  trainingCaseCount: 100,
  title: '真实案例集训',
  summary: '跳过原书测验，连续完成100个不重复的ETHUSDT和BTCUSDT真实行情案例。',
  source: TRAINING_SOURCE,
  excerpt: '只看技术指标无法得到真正的答案，我们这里介绍一下聪明钱的看图顺序：',
  excerptPage: 19,
  keyPoints: [
    '先分析4小时背景、震荡区、支撑位和阻力位。',
    '再观察1小时K线长度、成交量和价格进展，判断需求或供应是否跟随。',
    '最后分别验证上涨、下跌和震荡，并写出结论与失效条件。',
  ],
  bookQuestions: [],
}

function directionOf(candidate) {
  return candidate.correctDirection ?? candidate.direction
}

function distanceFromBlocked(time, blockedCutoffs, spacing) {
  return blockedCutoffs.every((blocked) => Math.abs(time - blocked) >= spacing)
}

/**
 * Select candidates near evenly distributed time targets while enforcing one
 * global spacing rule. The candidate set is normally daily, so the target
 * scoring keeps the result spread across the complete archive window.
 */
export function selectSpacedCandidates(candidates, options) {
  const quotas = options.quotas
  const spacing = options.minimumSpacingSeconds ?? MINIMUM_SPACING_SECONDS
  const blockedCutoffs = (options.blockedCutoffs ?? []).map((item) => typeof item === 'number' ? item : item.cutoffTime)
  const eligible = candidates
    .filter((candidate) => DIRECTIONS.includes(directionOf(candidate)))
    .filter((candidate) => distanceFromBlocked(candidate.cutoffTime, blockedCutoffs, spacing))
    .sort((left, right) => left.cutoffTime - right.cutoffTime)
  const limits = Object.fromEntries(DIRECTIONS.map((direction) => [direction, quotas[direction] ?? 0]))
  const totalRequired = Object.values(limits).reduce((sum, value) => sum + value, 0)
  const availableCounts = Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    eligible.filter((candidate) => directionOf(candidate) === direction).length,
  ]))
  for (const direction of DIRECTIONS) {
    if (availableCounts[direction] < limits[direction]) {
      throw new Error(`${direction} 候选不足：需要 ${limits[direction]} 个，只有 ${availableCounts[direction]} 个`)
    }
  }
  if (eligible.length === 0 && totalRequired > 0) throw new Error('没有可用历史行情候选')

  const firstTime = eligible[0]?.cutoffTime ?? 0
  const lastTime = eligible.at(-1)?.cutoffTime ?? firstTime
  const selected = []
  const used = new Set()
  const counts = Object.fromEntries(DIRECTIONS.map((direction) => [direction, 0]))
  while (selected.length < totalRequired) {
    const possible = eligible
      .filter((candidate) => !used.has(candidate) && counts[directionOf(candidate)] < limits[directionOf(candidate)])
      .filter((candidate) => selected.every((picked) => Math.abs(picked.cutoffTime - candidate.cutoffTime) >= spacing))
      .map((candidate) => {
        const direction = directionOf(candidate)
        const quota = limits[direction]
        const nextRank = counts[direction]
        const target = firstTime + ((nextRank + 0.5) / quota) * Math.max(0, lastTime - firstTime)
        return { candidate, score: Math.abs(candidate.cutoffTime - target) }
      })
      .sort((left, right) => left.score - right.score || left.candidate.cutoffTime - right.candidate.cutoffTime)
    if (possible.length === 0) {
      throw new Error(`无法在 ${spacing} 秒间隔下满足方向配额`)
    }
    const picked = possible[0].candidate
    used.add(picked)
    selected.push(picked)
    counts[directionOf(picked)] += 1
  }
  return selected.sort((left, right) => left.cutoffTime - right.cutoffTime)
}

function stripTrainingStage(course) {
  return {
    ...course,
    stages: course.stages
      .filter((stage) => stage.id !== TRAINING_STAGE_ID)
      .map((stage) => ({
        ...stage,
        units: stage.units.filter((unit) => unit.id !== TRAINING_UNIT_ID && unit.mode !== 'case-training'),
      }))
      .filter((stage) => stage.units.length > 0),
  }
}

function makeTrainingStage() {
  return {
    id: TRAINING_STAGE_ID,
    title: '真实案例集训',
    goal: '在不重复的真实行情中连续完成100次独立判断，建立可复盘的证据链。',
    units: [{ ...TRAINING_UNIT, source: { ...TRAINING_SOURCE }, keyPoints: [...TRAINING_UNIT.keyPoints] }],
  }
}

function buildTrainingCases(symbol, selected, unit) {
  return selected
    .sort((left, right) => left.cutoffTime - right.cutoffTime)
    .map((candidate, index) => {
      const id = `${TRAINING_UNIT_ID}-${symbol.toLowerCase()}-${String(index + 1).padStart(3, '0')}`
      const renamed = { ...candidate, id, unitId: TRAINING_UNIT_ID }
      const analysis = fallbackAnalyses(unit, [renamed])[0]
      const evidence = [
        '原书第19页：“只看技术指标无法得到真正的答案，我们这里介绍一下聪明钱的看图顺序：”',
        ...analysis.evidence,
      ].slice(0, 6)
      return {
        ...renamed,
        title: `${symbol === 'ETHUSDT' ? 'ETH' : 'BTC'} 真实案例 ${String(index + 1).padStart(2, '0')}`,
        symbol,
        market: 'Binance USD-M Futures',
        timeframe: '1h',
        cutoffJudgment: analysis.cutoffJudgment,
        annotations: analysis.annotations,
        evidence,
        directionAnalysis: analysis.directionAnalysis,
        actualOutcome: buildActualOutcome(candidate),
        source: unit.source,
      }
    })
}

export function appendCaseTrainingContent(course, marketCases, pools) {
  const baseCourse = stripTrainingStage(course)
  const baseCases = marketCases.cases.filter((marketCase) => marketCase.unitId !== TRAINING_UNIT_ID)
  const ethCases = pools.ETHUSDT ?? []
  const btcCases = pools.BTCUSDT ?? []
  if (ethCases.length !== 50 || btcCases.length !== 50) {
    throw new Error(`真实案例集训必须追加50个ETHUSDT和50个BTCUSDT，当前为${ethCases.length}/${btcCases.length}`)
  }
  const trainingCases = [...ethCases, ...btcCases].map((marketCase) => ({
    ...marketCase,
    unitId: TRAINING_UNIT_ID,
  }))
  return {
    course: { ...baseCourse, stages: [...baseCourse.stages, makeTrainingStage()] },
    marketCases: {
      ...marketCases,
      symbol: 'ETHUSDT',
      symbols: ['ETHUSDT', 'BTCUSDT'],
      cases: [...baseCases, ...trainingCases],
    },
  }
}

async function loadCandidates(symbol, startDate, endDate, cacheDirectory) {
  const [oneHourCandles, fourHourCandles] = await Promise.all([
    loadArchiveSeries('1h', startDate, endDate, cacheDirectory, symbol),
    loadArchiveSeries('4h', startDate, endDate, cacheDirectory, symbol),
  ])
  return scanCandidates(oneHourCandles, fourHourCandles)
}

async function main() {
  const contentDirectory = path.join(process.cwd(), 'private-content')
  const cacheDirectory = path.join(contentDirectory, 'binance-cache')
  await mkdir(cacheDirectory, { recursive: true })
  const startDate = new Date(process.env.WEIKEFU_MARKET_START || '2021-01-01T00:00:00Z')
  const endDate = new Date(process.env.WEIKEFU_MARKET_END || '2026-07-01T00:00:00Z')
  const [course, marketCases] = await Promise.all([
    readFile(path.join(contentDirectory, 'course.json'), 'utf8').then(JSON.parse),
    readFile(path.join(contentDirectory, 'market-cases.json'), 'utf8').then(JSON.parse),
  ])
  const originalEthCutoffs = marketCases.cases
    .filter((marketCase) => marketCase.symbol === 'ETHUSDT' && marketCase.unitId !== TRAINING_UNIT_ID)
    .map((marketCase) => marketCase.cutoffTime)
  const [ethCandidates, btcCandidates] = await Promise.all([
    loadCandidates('ETHUSDT', startDate, endDate, cacheDirectory),
    loadCandidates('BTCUSDT', startDate, endDate, cacheDirectory),
  ])
  const quotaOptions = { quotas: { up: 17, down: 17, range: 16 }, minimumSpacingSeconds: MINIMUM_SPACING_SECONDS }
  const ethSelected = selectSpacedCandidates(ethCandidates, { ...quotaOptions, blockedCutoffs: originalEthCutoffs })
  const btcSelected = selectSpacedCandidates(btcCandidates, quotaOptions)
  const pools = {
    ETHUSDT: buildTrainingCases('ETHUSDT', ethSelected, TRAINING_UNIT),
    BTCUSDT: buildTrainingCases('BTCUSDT', btcSelected, TRAINING_UNIT),
  }
  const result = appendCaseTrainingContent(course, marketCases, pools)
  await writeFile(path.join(contentDirectory, 'course.json'), JSON.stringify(result.course, null, 2), 'utf8')
  await writeFile(path.join(contentDirectory, 'market-cases.json'), JSON.stringify({ ...result.marketCases, generatedAt: new Date().toISOString() }, null, 2), 'utf8')
  process.stdout.write(`真实案例集训已生成：ETHUSDT ${pools.ETHUSDT.length} 个，BTCUSDT ${pools.BTCUSDT.length} 个\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
