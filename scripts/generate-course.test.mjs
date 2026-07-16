import assert from 'node:assert/strict'
import test from 'node:test'
import { generateStageWithRetry, parseApiConfigText, validateCourse } from './generate-course.mjs'

test('parses an OpenAI-compatible config without relying on label encoding', () => {
  const config = parseApiConfigText('地址：https://example.com/v1\nKey：sk-test-value\n模型：gpt-test')
  assert.deepEqual(config, { endpoint: 'https://example.com/v1', apiKey: 'sk-test-value', model: 'gpt-test' })
})

test('requires seven non-empty, source-linked stages', () => {
  assert.throws(() => validateCourse({ version: 1, stages: [] }), /七个阶段/)
  const stages = Array.from({ length: 7 }, (_, index) => ({ id: `s${index}`, title: '阶段', goal: '目标', units: [] }))
  assert.throws(() => validateCourse({ version: 1, stages }), /至少一个知识单元/)
})

test('retries a malformed stage response without exceeding the limit', async () => {
  let attempts = 0
  const result = await generateStageWithRetry(async () => {
    attempts += 1
    if (attempts === 1) throw new SyntaxError('malformed JSON')
    return { id: 'stage-ok' }
  }, 3)
  assert.equal(result.id, 'stage-ok')
  assert.equal(attempts, 2)
})
