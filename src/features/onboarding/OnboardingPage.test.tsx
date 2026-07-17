import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('only offers private pack import before content is available', async () => {
    const onImport = vi.fn()
    const user = userEvent.setup()
    render(<OnboardingPage onImport={onImport} importing={false} />)

    expect(screen.getByRole('heading', { name: '导入私人学习包' })).toBeVisible()
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument()
    expect(screen.queryByText('AI接口设置')).not.toBeInTheDocument()

    const file = new File(['pack'], 'weikefu.wkf', { type: 'application/octet-stream' })
    await user.upload(screen.getByLabelText('选择 .wkf 文件'), file)
    expect(onImport).toHaveBeenCalledWith(file)
  })
})
