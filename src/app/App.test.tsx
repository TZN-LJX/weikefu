import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createChallengeContentFixture } from '../test/fixtures/challengeContent'
import { AppContent } from './App'

function fakeRepositories(hasPack: boolean) {
  const { course, marketCases } = createChallengeContentFixture()
  return {
    getActivePack: vi.fn(async () => hasPack ? { id: 'core', title: '私人课程', version: '2.0.0', active: true, importedAt: '' } : undefined),
    getJsonAsset: vi.fn(async (path: string) => path.includes('course') ? course : marketCases),
    getChallengeProgress: vi.fn(async () => undefined),
    getWrongItems: vi.fn(async () => []),
    saveChallengeProgress: vi.fn(async () => undefined),
    saveChallengeAttempt: vi.fn(async () => undefined),
    saveWrongItem: vi.fn(async () => undefined),
    savePack: vi.fn(), clearPartial: vi.fn(), deleteActivePack: vi.fn(), setSetting: vi.fn(), getSetting: vi.fn(), getAsset: vi.fn(),
    resetChallengeProgress: vi.fn(), getBackupSnapshot: vi.fn(async () => ({ challengeProgress: [], challengeAttempts: [], wrongItems: [], settings: {} })), restoreProgress: vi.fn(),
  }
}

describe('AppContent', () => {
  it('gates the app behind a valid private learning pack', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(false) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '导入私人学习包' })).toBeVisible()
    expect(screen.queryByText('闯关地图')).not.toBeInTheDocument()
  })

  it('opens the challenge map after loading private content', async () => {
    render(<MemoryRouter><AppContent repositories={fakeRepositories(true) as never} /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '闯关地图' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '知识单元 1' })).toBeVisible()
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument()
  })
})
