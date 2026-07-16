import { z } from 'zod'
import { COACH_SYSTEM_PROMPT } from './aiPrompts'

export type AiConfig = {
  endpoint: string
  model: string
  apiKey: string
}

export type CoachContext = {
  prompt: string
  selectedAnswer: string
  evidence: string[]
  explanation: string
}

const CoachResponseSchema = z.object({
  question: z.string().min(1),
  evidenceIds: z.array(z.string()),
})

function endpointUrl(base: string) {
  return `${base.replace(/\/$/, '')}/chat/completions`
}

function providerError(status: number) {
  if (status === 401 || status === 403) return new Error('AI接口鉴权失败')
  if (status === 429) return new Error('AI接口请求过于频繁或余额不足')
  return new Error(`AI接口请求失败（${status}）`)
}

async function post(config: AiConfig, messages: { role: string; content: string }[], fetcher: typeof fetch) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetcher(endpointUrl(config.endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_completion_tokens: 500,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw providerError(response.status)
    return response.json() as Promise<{ id?: string; choices?: { message?: { content?: string } }[] }>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI接口响应超时')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function parseJsonContent(content: string) {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
  return JSON.parse(trimmed) as unknown
}

export async function requestCoachFeedback(
  config: AiConfig,
  context: CoachContext,
  fetcher: typeof fetch = fetch,
) {
  const data = await post(config, [
    { role: 'system', content: COACH_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ currentQuestion: context }) },
  ], fetcher)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI接口返回内容为空')
  return CoachResponseSchema.parse(parseJsonContent(content))
}

export async function testAiConnection(config: AiConfig, fetcher: typeof fetch = fetch) {
  const data = await post(config, [
    { role: 'user', content: '只回复 OK。' },
  ], fetcher)
  if (!data.id && !data.choices?.length) throw new Error('AI接口返回格式无效')
  return { ok: true as const }
}
