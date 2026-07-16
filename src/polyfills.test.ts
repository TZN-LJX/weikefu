import { describe, expect, it, vi } from 'vitest'
import { installMapGetOrInsertComputed } from './polyfills'

describe('browser compatibility polyfills', () => {
  it('provides Map.getOrInsertComputed without recomputing existing values', () => {
    installMapGetOrInsertComputed()
    const compute = vi.fn(() => 42)
    const values = new Map<string, number>()
    expect(values.getOrInsertComputed('answer', compute)).toBe(42)
    expect(values.getOrInsertComputed('answer', compute)).toBe(42)
    expect(compute).toHaveBeenCalledOnce()
  })
})
