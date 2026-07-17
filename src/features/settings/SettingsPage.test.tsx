import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('keeps pack and progress controls without any AI configuration', async () => {
    const user = userEvent.setup()
    const onExportBackup = vi.fn()
    render(<MemoryRouter><SettingsPage
      activePack={{ title: '私人课程', version: '2.0.0' }}
      onReplacePack={vi.fn()}
      onDeletePack={vi.fn()}
      onExportBackup={onExportBackup}
      onImportBackup={vi.fn()}
    /></MemoryRouter>)

    expect(screen.getByText('私人课程 · v2.0.0')).toBeVisible()
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument()
    expect(screen.queryByText('AI 教练')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '导出进度' }))
    expect(onExportBackup).toHaveBeenCalledTimes(1)
  })
})
