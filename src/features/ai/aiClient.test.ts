import { describe, expect, it, vi } from 'vitest'
import { requestCoachFeedback, testAiConnection } from './aiClient'

const config = {
  endpoint: 'https://api.example.com/v1',
  model: 'gpt-test',
  apiKey: 'top-secret',
}

describe('AI client', () => {
  it('sends only the current learning context', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"question":"请重新比较两段波动","evidenceIds":["down-wave"]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await requestCoachFeedback(config, {
      prompt: '当前哪一方控制市场？',
      selectedAnswer: '需求控制',
      evidence: ['下跌波价差扩大'],
      explanation: '我看到价格反弹',
    }, fetcher)

    const requestBody = JSON.parse(fetcher.mock.calls[0][1].body)
    const serialized = JSON.stringify(requestBody)
    expect(serialized).toContain('当前哪一方控制市场')
    expect(serialized).not.toContain('top-secret')
    expect(serialized).not.toContain('original.pdf')
    expect(result).toEqual({ question: '请重新比较两段波动', evidenceIds: ['down-wave'] })
  })

  it('tests authentication without exposing response content', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'response-id', choices: [{ message: { content: 'OK' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(testAiConnection(config, fetcher)).resolves.toEqual({ ok: true })
  })

  it('reports authentication errors clearly', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    await expect(testAiConnection(config, fetcher)).rejects.toThrow('AI接口鉴权失败')
  })
})
