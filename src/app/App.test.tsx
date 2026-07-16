import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppContent } from './App'

const course = {
  version: 1 as const,
  stages: [{ id: 's1', title: '风险纪律', goal: '控制风险', units: [{
    id: 'u1', title: '单笔风险', summary: '每笔最多风险 1%。', keyPoints: ['先找止损', '再算仓位'],
    source: { pdfPath: 'assets/original.pdf', chapter: '风险', pageStart: 1, pageEnd: 1 }, excerpt: '私人摘录',
    exercise: { id: 'e1', prompt: '风险是多少？', options: [{ id: 'a', label: '1%' }, { id: 'b', label: '10%' }], correctOptionId: 'a', evidence: [{ id: 'x', label: '账户权益' }], requiredEvidenceIds: ['x'], explanationPrompt: '解释风险。' },
  }] }],
}

function fakeRepositories(hasPack: boolean) {
  const marketCases = { version: 1, cases: [{
    id: 'c1', title: 'ETH 回放', timeframe: '1h', context4h: '需求', cutoff: 2,
    evidenceOptions: [{ id: 'e1', label: '缩量回测' }],
    candles: [
      { time: 1, open: 100, high: 102, low: 99, close: 101, volume: 10 },
      { time: 2, open: 101, high: 103, low: 100, close: 102, volume: 11 },
      { time: 3, open: 102, high: 105, low: 101, close: 104, volume: 15 },
    ],
  }] }
  return {
    getActivePack: vi.fn(async () => hasPack ? { id: 'core', title: '私人课程', version: '1.0.0', active: true, importedAt: '' } : undefined),
    getJsonAsset: vi.fn(async (path: string) => path.includes('course') ? course : marketCases),
    getSetting: vi.fn(async () => undefined), getJournals: vi.fn(async () => []), getTrades: vi.fn(async () => []),
    savePack: vi.fn(), clearPartial: vi.fn(), deleteActivePack: vi.fn(), setSetting: vi.fn(), saveTrade: vi.fn(), saveJournal: vi.fn(), getAsset: vi.fn(), getBackupSnapshot: vi.fn(),
  }
}

describe('AppContent', () => {
  it('gates the app behind a valid private learning pack', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(false) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '导入私人学习包' })).toBeVisible()
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument()
  })

  it('opens the daily queue after loading private content', async () => {
    render(<MemoryRouter initialEntries={['/today']}><AppContent repositories={fakeRepositories(true) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '今日任务' })).toBeVisible()
    expect(screen.getByText('单笔风险')).toBeVisible()
  })
})
