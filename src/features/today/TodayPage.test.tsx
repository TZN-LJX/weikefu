import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TodayPage } from './TodayPage'

describe('TodayPage', () => {
  it('shows one focused daily queue with review, lesson, and replay', () => {
    render(<TodayPage
      stageTitle="供需与市场背景"
      progress={0.58}
      tasks={[
        { id: 'r1', kind: 'review', minutes: 3, title: '回顾错题', detail: '3 道证据题' },
        { id: 'l1', kind: 'lesson', minutes: 5, title: '努力与结果', detail: '第一章 · 第八节' },
        { id: 'c1', kind: 'replay', minutes: 8, title: 'ETH 隐藏回放', detail: '判断 4h 背景与 1h 结构' },
      ]}
      onStart={() => undefined}
    />)

    expect(screen.getByRole('heading', { name: '今日任务' })).toBeVisible()
    expect(screen.getByText('预计 16 分钟')).toBeVisible()
    expect(screen.getByText('回顾错题')).toBeVisible()
    expect(screen.getByText('努力与结果')).toBeVisible()
    expect(screen.getByText('ETH 隐藏回放')).toBeVisible()
    expect(screen.getAllByRole('button', { name: '开始今日训练' })).toHaveLength(1)
  })
})
