import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('keeps the API key masked and saves the user supplied endpoint', async () => {
    const user = userEvent.setup()
    const onSaveAi = vi.fn()
    render(<MemoryRouter><SettingsPage
      aiConfig={{ endpoint: '', model: '', apiKey: '', rememberKey: false }}
      activePack={{ title: '私人课程', version: '1.0.0' }}
      onSaveAi={onSaveAi}
      onTestAi={async () => undefined}
      onReplacePack={() => undefined}
      onDeletePack={() => undefined}
      onExportBackup={() => undefined}
      onImportBackup={() => undefined}
    /></MemoryRouter>)
    expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'password')
    await user.type(screen.getByLabelText('接口地址'), 'https://example.com/v1')
    await user.type(screen.getByLabelText('模型名称'), 'coach-model')
    await user.type(screen.getByLabelText('API Key'), 'secret')
    await user.click(screen.getByRole('button', { name: '保存 AI 设置' }))
    expect(onSaveAi).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://example.com/v1', model: 'coach-model', apiKey: '' }))
  })
})
