import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSourcePacket, parseApiConfigText, validateQuestionSet } from './generate-challenge-content.mjs'

function question(index) {
  return {
    id: `q${index}`,
    prompt: `第 ${index} 题如何判断供需？`,
    options: [
      { id: 'a', label: '等待', explanation: '证据不足时等待。' },
      { id: 'b', label: '做多', explanation: '需求证据不足。' },
      { id: 'c', label: '做空', explanation: '供应证据不足。' },
    ],
    correctOptionId: 'a',
    explanation: '先背景，再比较努力与结果。',
  }
}

test('parses an OpenAI-compatible config without printing the secret', () => {
  const config = parseApiConfigText('地址：https://example.com/v1\nKey：sk-test-value\n模型：gpt-test')
  assert.deepEqual(config, { endpoint: 'https://example.com/v1', apiKey: 'sk-test-value', model: 'gpt-test' })
})

test('builds a source packet only from the cited page range', () => {
  const packet = buildSourcePacket({ pages: [
    { page: 9, text: 'outside', charCount: 7 },
    { page: 10, text: 'page ten source', charCount: 15 },
    { page: 11, text: 'page eleven source', charCount: 18 },
  ] }, { pageStart: 10, pageEnd: 11 })
  assert.match(packet, /原书第10页/)
  assert.match(packet, /page eleven source/)
  assert.doesNotMatch(packet, /outside/)
})

test('requires exactly twenty unique, fully explained questions', () => {
  const valid = Array.from({ length: 20 }, (_, index) => question(index + 1))
  assert.equal(validateQuestionSet(valid).length, 20)
  assert.throws(() => validateQuestionSet(valid.slice(0, 19)), /20 道/)
  assert.throws(() => validateQuestionSet([...valid.slice(0, 19), { ...valid[0], id: 'duplicate' }]), /题干必须唯一/)
  assert.throws(() => validateQuestionSet(valid.map((item, index) => index === 0 ? { ...item, correctOptionId: 'missing' } : item)), /正确选项不存在/)
})
