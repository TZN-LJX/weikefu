import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(path.resolve('src/styles/app.css'), 'utf8')

describe('training progress styles', () => {
  it('collapses the training strip before tablet widths can clip it', () => {
    const tabletBreakpoint = /@media\s*\(max-width:\s*900px\)/.exec(appCss)?.index ?? -1
    const mobileBreakpoint = /@media\s*\(max-width:\s*720px\)/.exec(appCss)?.index ?? -1
    const tabletStyles = appCss.slice(tabletBreakpoint, mobileBreakpoint)

    expect(tabletBreakpoint).toBeGreaterThanOrEqual(0)
    expect(mobileBreakpoint).toBeGreaterThan(tabletBreakpoint)
    expect(tabletStyles).toMatch(/\.training-progress\s*\{\s*grid-template-columns:\s*1fr/)
    expect(tabletStyles).toMatch(/\.training-counter-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  })
})
