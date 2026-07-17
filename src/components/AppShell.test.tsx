import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('keeps only the challenge brand and settings command', () => {
    render(<MemoryRouter><AppShell><h1>闯关地图</h1></AppShell></MemoryRouter>)
    expect(screen.getByText('威科夫闯关')).toBeVisible()
    expect(screen.getByTitle('设置')).toBeVisible()
    expect(screen.queryByText('今日')).not.toBeInTheDocument()
    expect(screen.queryByText('训练')).not.toBeInTheDocument()
    expect(screen.queryByText('复盘')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '闯关地图' })).toBeVisible()
  })
})
