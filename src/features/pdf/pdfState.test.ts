import { describe, expect, it } from 'vitest'
import { normalizePage } from './pdfState'

describe('normalizePage', () => {
  it('keeps the selected page inside the document', () => {
    expect(normalizePage(0, 288)).toBe(1)
    expect(normalizePage(145, 288)).toBe(145)
    expect(normalizePage(999, 288)).toBe(288)
  })
})
