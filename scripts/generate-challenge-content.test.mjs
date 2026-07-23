import assert from 'node:assert/strict'
import test from 'node:test'
import { balanceQuestionOptionPositions, buildSourcePacket, parseApiConfigText, resolveExcerptPage, validateQuestionSet } from './generate-challenge-content.mjs'

function question(index, correctPosition = 0) {
  const options = [
    { id: 'a', label: '等待', explanation: '证据不足时等待。' },
    { id: 'b', label: '做多', explanation: '需求证据不足。' },
    { id: 'c', label: '做空', explanation: '供应证据不足。' },
  ]
  return {
    id: `q${index}`,
    prompt: `第 ${index} 题如何判断供需？`,
    options,
    correctOptionId: options[correctPosition].id,
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
  const valid = Array.from({ length: 20 }, (_, index) => question(index + 1, index % 3))
  assert.equal(validateQuestionSet(valid).length, 20)
  assert.throws(() => validateQuestionSet(valid.slice(0, 19)), /20 道/)
  assert.throws(() => validateQuestionSet([...valid.slice(0, 19), { ...valid[0], id: 'duplicate' }]), /题干必须唯一/)
  assert.throws(() => validateQuestionSet(valid.map((item, index) => index === 0 ? { ...item, correctOptionId: 'missing' } : item)), /正确选项不存在/)
})

test('rejects a question set whose correct answers are stored in one position', () => {
  const biased = Array.from({ length: 20 }, (_, index) => question(index + 1, 0))
  assert.throws(() => validateQuestionSet(biased), /正确答案位置分布/)
})

test('rejects a heavily skewed 10/9/1 correct-answer distribution', () => {
  const positions = Array.from({ length: 19 }, (_, index) => index % 2).concat(2)
  const skewed = positions.map((position, index) => question(index + 1, position))
  assert.throws(() => validateQuestionSet(skewed), /正确答案位置分布/)
})

test('rebalances stored option order without changing option identities or answers', () => {
  const biased = Array.from({ length: 20 }, (_, index) => question(index + 1, 0))

  const balanced = balanceQuestionOptionPositions(biased)
  const positions = balanced.map((item) => item.options.findIndex((option) => option.id === item.correctOptionId))
  const counts = [0, 1, 2].map((position) => positions.filter((candidate) => candidate === position).length)

  assert.equal(validateQuestionSet(balanced).length, 20)
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1)
  assert.deepEqual(new Set(balanced[0].options.map((option) => option.id)), new Set(['a', 'b', 'c']))
  assert.equal(balanced[0].correctOptionId, 'a')
})

test('resolves and verifies the exact source page for a unit excerpt', () => {
  const pages = { pages: [
    { page: 10, text: '背景之外的内容。' },
    { page: 11, text: '识别支撑和阻力。（用价格判断）' },
  ] }
  const unit = {
    excerpt: '“识别支撑和阻力。（用价格判断）”',
    source: { pageStart: 10, pageEnd: 11 },
  }

  assert.equal(resolveExcerptPage(pages, unit), 11)
  assert.throws(() => resolveExcerptPage(pages, { ...unit, excerpt: '不存在的逐字引文' }), /无法确认逐字引文的准确页码/)
})
