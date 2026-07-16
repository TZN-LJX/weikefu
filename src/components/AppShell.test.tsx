import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('shows the four primary learning destinations and settings', () => {
    render(<MemoryRouter><AppShell><p>content</p></AppShell></MemoryRouter>)
    expect(screen.getAllByText('今日').length).toBeGreaterThan(0)
    expect(screen.getAllByText('闯关').length).toBeGreaterThan(0)
    expect(screen.getAllByText('训练').length).toBeGreaterThan(0)
    expect(screen.getAllByText('复盘').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('设置').length).toBeGreaterThan(0)
  })
})
