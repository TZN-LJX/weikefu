import { StrictMode, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  createChallengeProgress,
  type CaseTrainingProgress,
  type ChallengeProgress,
  type WrongItem,
} from '../../domain/challenge'
import type { ChallengeAttemptRecord } from '../../db/database'
import { createChallengeContentFixture } from '../../test/fixtures/challengeContent'
import type { ChoiceQuestion, ContentUnit, MarketCase } from '../pack/contentSchema'
import { ChallengeSessionPage } from './ChallengeSessionPage'

vi.mock('../replay/MarketChart', () => ({
  MarketChart: ({ candles }: { candles: unknown[] }) => <div data-testid="chart">{candles.length} candles</div>,
}))

function question(index: number): ChoiceQuestion {
  return {
    id: `q${index}`, prompt: `原书题 ${index}`,
    options: [
      { id: 'a', label: `正确 ${index}`, explanation: '符合原书。' },
      { id: 'b', label: `错误甲 ${index}`, explanation: '忽略背景。' },
      { id: 'c', label: `错误乙 ${index}`, explanation: '证据不足。' },
    ],
    correctOptionId: 'a', explanation: '按背景和价量证据判断。',
    source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 10 },
  }
}

function candle(time: number, close = 3_000) {
  return { time, open: close, high: close + 10, low: close - 10, close, volume: 100 }
}

function replayCase(index: number, correctDirection: MarketCase['correctDirection'] = 'up'): MarketCase {
  const start = 1_700_000_000 + index * 1_000_000
  return {
    id: `case-${index}`, unitId: 'unit-1', title: `ETH 回放 ${index}`, symbol: 'ETHUSDT', market: 'Binance USD-M Futures', timeframe: '1h',
    cutoffTime: start + 48 * 3_600, horizonEndTime: start + 72 * 3_600,
    visibleCandles: Array.from({ length: 48 }, (_, candleIndex) => candle(start + candleIndex * 3_600)),
    futureCandles: Array.from({ length: 24 }, (_, candleIndex) => candle(start + (48 + candleIndex) * 3_600, 3_000 + candleIndex * 4)),
    candles4h: Array.from({ length: 24 }, (_, candleIndex) => candle(start - (24 - candleIndex) * 14_400)),
    correctDirection, evidence: ['需求扩大', '回测供应收缩'],
    directionAnalysis: { up: '需求控制。', down: '供应没有扩大。', range: '已经出现方向。' },
    actualOutcome: '未来24小时上涨。', metrics: { return24h: 0.03, minInterimReturn: -0.005, maxInterimReturn: 0.04 },
    source: { pdfPath: 'assets/original.pdf', chapter: '第二章', pageStart: 80, pageEnd: 82 },
  }
}

const unit: ContentUnit = {
  id: 'unit-1', mode: 'standard', title: '市场自身行为', summary: '通过背景和价量证据判断供需。',
  source: { pdfPath: 'assets/original.pdf', chapter: '第一章', pageStart: 10, pageEnd: 12 },
  excerpt: '根据市场自身行为判断。', keyPoints: ['先背景', '后证据'],
  bookQuestions: Array.from({ length: 20 }, (_, index) => question(index + 1)),
}

function Harness({
  initialProgress,
  wrongItems = [],
  random = () => 0.9,
  marketCases = [replayCase(1), replayCase(2), replayCase(3)],
}: {
  initialProgress: ChallengeProgress
  wrongItems?: WrongItem[]
  random?: () => number
  marketCases?: MarketCase[]
}) {
  const [progress, setProgress] = useState(initialProgress)
  const [items, setItems] = useState(wrongItems)
  return <ChallengeSessionPage
    unit={unit}
    allUnits={[unit]}
    marketCases={marketCases}
    progress={progress}
    wrongItems={items}
    random={random}
    now={() => new Date('2026-07-17T00:00:00.000Z')}
    onProgressChange={setProgress}
    onWrongItemChange={(item) => setItems((current) => [...current.filter((candidate) => candidate.questionId !== item.questionId), item])}
    onAttempt={vi.fn()}
    onOpenSource={vi.fn()}
    onReturnToMap={vi.fn()}
  />
}

function savedTrainingProgress(
  unitId: string,
  marketCases: MarketCase[],
  nextIndex = 0,
  caseOrder = marketCases.map((marketCase) => marketCase.id),
) {
  const outcomes: CaseTrainingProgress['outcomes'] = {}
  const completedBySymbol: CaseTrainingProgress['completedBySymbol'] = { ETHUSDT: 0, BTCUSDT: 0 }
  for (const caseId of caseOrder.slice(0, nextIndex)) {
    const marketCase = marketCases.find((candidate) => candidate.id === caseId)!
    outcomes[caseId] = { correct: true, symbol: marketCase.symbol }
    completedBySymbol[marketCase.symbol] += 1
  }
  const progress = createChallengeProgress([{ id: unitId, mode: 'case-training' }])
  progress.unitStates[unitId] = {
    step: 'case-training',
    training: {
      caseOrder,
      nextIndex,
      correctCount: nextIndex,
      wrongCount: 0,
      completedBySymbol,
      outcomes,
    },
  }
  return progress
}

function TrainingHarness({
  initialProgress,
  unit,
  marketCases,
  random = () => 0.9,
  onProgressChange = vi.fn(),
  onWrongItemChange = vi.fn(),
  onAttempt = vi.fn(),
}: {
  initialProgress: ChallengeProgress
  unit: ContentUnit
  marketCases: MarketCase[]
  random?: () => number
  onProgressChange?: (progress: ChallengeProgress) => void | Promise<void | ChallengeProgress>
  onWrongItemChange?: (item: WrongItem) => void
  onAttempt?: (attempt: ChallengeAttemptRecord) => void
}) {
  const [progress, setProgress] = useState(initialProgress)
  const [wrongItems, setWrongItems] = useState<WrongItem[]>([])
  return <ChallengeSessionPage
    unit={unit}
    allUnits={[unit]}
    marketCases={marketCases}
    progress={progress}
    wrongItems={wrongItems}
    random={random}
    now={() => new Date('2026-07-23T00:00:00.000Z')}
    onProgressChange={(nextProgress) => {
      const saveResult = onProgressChange(nextProgress)
      setProgress(nextProgress)
      return saveResult
    }}
    onWrongItemChange={(item) => {
      onWrongItemChange(item)
      setWrongItems((current) => [...current.filter((candidate) => candidate.questionId !== item.questionId), item])
    }}
    onAttempt={onAttempt}
    onOpenSource={vi.fn()}
    onReturnToMap={vi.fn()}
  />
}

describe('ChallengeSessionPage', () => {
  it('skips an empty review queue and resumes at the book quiz', async () => {
    render(<Harness initialProgress={createChallengeProgress(['unit-1'])} />)
    await waitFor(() => expect(screen.getByText('第 1 / 10 题')).toBeVisible())
    expect(screen.getByRole('heading', { name: '市场自身行为' })).toBeVisible()
    expect(screen.getByText('原书测验')).toBeVisible()
  })

  it('adds a wrong replay to the wrong list and switches cases before retry', async () => {
    const user = userEvent.setup()
    const progress = createChallengeProgress(['unit-1'])
    progress.unitStates['unit-1'] = { step: 'market-replay' }
    render(<Harness initialProgress={progress} />)

    expect(screen.getByRole('heading', { name: 'ETH 回放 1' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '下跌' }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    expect(screen.getByText(unit.excerpt)).toBeVisible()
    await user.click(screen.getByRole('button', { name: '换一个案例继续' }))
    expect(screen.getByRole('heading', { name: 'ETH 回放 2' })).toBeVisible()
  })

  it('does not always start ETH replay with the stored up case', () => {
    const progress = createChallengeProgress(['unit-1'])
    progress.unitStates['unit-1'] = { step: 'market-replay' }
    render(<Harness
      initialProgress={progress}
      random={() => 0}
      marketCases={[replayCase(1, 'up'), replayCase(2, 'down'), replayCase(3, 'range')]}
    />)

    expect(screen.getByRole('heading', { name: 'ETH 回放 2' })).toBeVisible()
  })

  it('initializes case-training order once and waits for the saved progress', () => {
    const { marketCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = createChallengeProgress([{ id: unit.id, mode: 'case-training' }])
    const onProgressChange = vi.fn()
    const random = () => 0
    const now = () => new Date('2026-07-23T00:00:00.000Z')
    const callbacks = {
      onProgressChange,
      onWrongItemChange: vi.fn(),
      onAttempt: vi.fn(),
      onOpenSource: vi.fn(),
      onReturnToMap: vi.fn(),
    }

    const { rerender } = render(<StrictMode>
      <ChallengeSessionPage
        unit={unit}
        allUnits={[unit]}
        marketCases={marketCases.cases}
        progress={progress}
        wrongItems={[]}
        random={random}
        now={now}
        {...callbacks}
      />
    </StrictMode>)

    expect(screen.getByRole('status')).toHaveTextContent('正在保存真实案例顺序...')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(onProgressChange).toHaveBeenCalledTimes(1)
    expect(onProgressChange.mock.calls[0][0].unitStates[unit.id].training?.caseOrder).toHaveLength(100)

    rerender(<StrictMode>
      <ChallengeSessionPage
        unit={unit}
        allUnits={[unit]}
        marketCases={marketCases.cases}
        progress={progress}
        wrongItems={[]}
        random={random}
        now={now}
        {...callbacks}
      />
    </StrictMode>)
    expect(onProgressChange).toHaveBeenCalledTimes(1)
  })

  it('keeps initialization loading until persistence succeeds and surfaces save errors', async () => {
    const { marketCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = createChallengeProgress([{ id: unit.id, mode: 'case-training' }])
    let rejectSave!: (error: Error) => void
    const savePromise = new Promise<never>((_resolve, reject) => { rejectSave = reject })

    render(<TrainingHarness
      initialProgress={progress}
      unit={unit}
      marketCases={marketCases.cases}
      onProgressChange={() => savePromise}
    />)

    expect(screen.getByText('正在保存真实案例顺序...')).toBeVisible()
    expect(screen.queryByRole('heading', { name: /回放/ })).not.toBeInTheDocument()

    rejectSave(new Error('真实案例顺序保存失败'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('真实案例顺序保存失败'))
    expect(screen.queryByRole('heading', { name: /回放/ })).not.toBeInTheDocument()
  })

  it('resumes the saved BTC case and renders only the training step', () => {
    const { marketCases, trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const btcCase = trainingCases.find((marketCase) => marketCase.symbol === 'BTCUSDT')!
    const caseOrder = trainingCases.map((marketCase) => marketCase.id)
    caseOrder.splice(caseOrder.indexOf(btcCase.id), 1)
    caseOrder.unshift(btcCase.id)
    const progress = savedTrainingProgress(unit.id, trainingCases, 0, caseOrder)
    const { container } = render(<TrainingHarness initialProgress={progress} unit={unit} marketCases={marketCases.cases} />)

    expect(screen.queryByText('错题回顾')).not.toBeInTheDocument()
    expect(screen.queryByText('原书测验')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.training-progress')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: btcCase.title })).toBeVisible()
    expect(screen.getByText('Binance USD-M Futures · BTCUSDT')).toBeVisible()
  })

  it('saves a wrong training attempt and advances regardless of correctness', async () => {
    const user = userEvent.setup()
    const { marketCases, trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const btcCase = trainingCases.find((marketCase) => marketCase.symbol === 'BTCUSDT')!
    const nextCase = trainingCases.find((marketCase) => marketCase.id !== btcCase.id)!
    const remainingCases = trainingCases.filter((marketCase) => marketCase.id !== btcCase.id && marketCase.id !== nextCase.id)
    const caseOrder = [btcCase.id, nextCase.id, ...remainingCases.map((marketCase) => marketCase.id)]
    const progress = savedTrainingProgress(unit.id, trainingCases, 0, caseOrder)
    const onProgressChange = vi.fn()
    const onWrongItemChange = vi.fn()
    const onAttempt = vi.fn()
    render(<TrainingHarness
      initialProgress={progress}
      unit={unit}
      marketCases={marketCases.cases}
      onProgressChange={onProgressChange}
      onWrongItemChange={onWrongItemChange}
      onAttempt={onAttempt}
    />)

    const wrongLabel = btcCase.correctDirection === 'up' ? '下跌' : '上涨'
    await user.click(screen.getByRole('radio', { name: wrongLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))

    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({
      questionId: btcCase.id,
      questionKind: 'market',
      unitId: unit.id,
      correct: false,
    }))
    expect(onWrongItemChange).toHaveBeenCalledWith(expect.objectContaining({
      questionId: btcCase.id,
      questionKind: 'market',
      unitId: unit.id,
      status: 'active',
    }))

    await user.click(screen.getByRole('button', { name: '下一案例（2/100）' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: nextCase.title })).toBeVisible())
    expect(onProgressChange).toHaveBeenCalledTimes(1)
    const advanced = onProgressChange.mock.calls[0][0].unitStates[unit.id].training!
    expect(advanced).toMatchObject({ nextIndex: 1, correctCount: 0, wrongCount: 1 })
    expect(advanced.completedBySymbol.BTCUSDT).toBe(1)
  })

  it('completes training after advancing the final case', async () => {
    const user = userEvent.setup()
    const { marketCases, trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = savedTrainingProgress(unit.id, trainingCases, 99)
    const finalCase = trainingCases[99]
    const onProgressChange = vi.fn()
    render(<TrainingHarness initialProgress={progress} unit={unit} marketCases={marketCases.cases} onProgressChange={onProgressChange} />)

    const correctLabel = finalCase.correctDirection === 'up' ? '上涨' : finalCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'
    await user.click(screen.getByRole('radio', { name: correctLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '完成真实案例集训' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '真实案例集训完成' })).toBeVisible())
    expect(onProgressChange.mock.calls[0][0].unitStates[unit.id].step).toBe('completed')
  })

  it('surfaces a failed training advance without showing the next case', async () => {
    const user = userEvent.setup()
    const { marketCases, trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = savedTrainingProgress(unit.id, trainingCases)
    const activeCase = trainingCases[0]
    const correctLabel = activeCase.correctDirection === 'up' ? '上涨' : activeCase.correctDirection === 'down' ? '下跌' : '震荡／方向不明'

    render(<ChallengeSessionPage
      unit={unit}
      allUnits={[unit]}
      marketCases={marketCases.cases}
      progress={progress}
      wrongItems={[]}
      onProgressChange={() => Promise.reject(new Error('案例进度保存失败'))}
      onWrongItemChange={vi.fn()}
      onAttempt={vi.fn()}
      onOpenSource={vi.fn()}
      onReturnToMap={vi.fn()}
    />)

    await user.click(screen.getByRole('radio', { name: correctLabel }))
    await user.click(screen.getByRole('button', { name: '提交走势判断' }))
    await user.click(screen.getByRole('button', { name: '下一案例（2/100）' }))

    await waitFor(() => expect(screen.getByText('案例进度保存失败')).toBeVisible())
    expect(screen.queryByRole('heading', { name: trainingCases[1].title })).not.toBeInTheDocument()
  })

  it('shows a clear error when the training catalog does not contain 100 unit cases', () => {
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = createChallengeProgress([{ id: unit.id, mode: 'case-training' }])

    render(<TrainingHarness initialProgress={progress} unit={unit} marketCases={trainingCases.slice(0, 99)} />)

    expect(screen.getByRole('alert')).toHaveTextContent('真实案例集训需要 100 个当前单元案例，实际找到 99 个。')
  })

  it('does not run standard review transitions for an invalid training state', () => {
    const { trainingCases, trainingUnit } = createChallengeContentFixture()
    const unit = trainingUnit as ContentUnit
    const progress = createChallengeProgress([{ id: unit.id, mode: 'case-training' }])
    progress.unitStates[unit.id] = { step: 'review' }
    const onProgressChange = vi.fn()

    render(<ChallengeSessionPage
      unit={unit}
      allUnits={[unit]}
      marketCases={trainingCases}
      progress={progress}
      wrongItems={[]}
      onProgressChange={onProgressChange}
      onWrongItemChange={vi.fn()}
      onAttempt={vi.fn()}
      onOpenSource={vi.fn()}
      onReturnToMap={vi.fn()}
    />)

    expect(screen.getByRole('alert')).toHaveTextContent('真实案例集训尚未解锁')
    expect(onProgressChange).not.toHaveBeenCalled()
  })
})
