import { describe, expect, it } from 'vitest'
import { evaluateExplanation } from './explanationRubric'

const complete = {
  observation: '下跌波价差扩大且成交量增加',
  meaning: '供应正在主动进入市场',
  expectation: '反弹如果缩量，弱势将延续',
  action: '等待 LPSY 再考虑做空',
  invalidation: '放量突破阻力并缩量回测成功',
}

describe('evaluateExplanation', () => {
  it('passes a complete explanation with supporting evidence', () => {
    expect(evaluateExplanation(complete, ['supply-expands'], [])).toEqual({
      complete: true,
      conflictingEvidence: [],
    })
  })

  it('fails when one Feynman field is missing', () => {
    expect(evaluateExplanation({ ...complete, invalidation: '' }, ['supply-expands'], []))
      .toMatchObject({ complete: false })
  })

  it('reports evidence that conflicts with the conclusion', () => {
    expect(evaluateExplanation(complete, ['demand-expands'], ['demand-expands']))
      .toEqual({ complete: false, conflictingEvidence: ['demand-expands'] })
  })
})
