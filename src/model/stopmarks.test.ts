import { describe, expect, it } from 'vitest'

import { stopMarksOf } from './stopmarks'

describe('stopMarksOf — the four marks worth drawing', () => {
  it('draws nothing for the quiet values', () => {
    expect(stopMarksOf({ source: 'outline', confidence: 'clear' })).toEqual([])
    expect(stopMarksOf({ source: 'outline', confidence: 'judgment call' })).toEqual([])
    expect(stopMarksOf({})).toEqual([])
  })

  it('draws a split and its not-matched confidence together, source first', () => {
    const marks = stopMarksOf({ source: 'split', confidence: 'not matched' })
    expect(marks.map((m) => m.value)).toEqual(['split', 'not matched'])
    expect(marks.map((m) => m.tone)).toEqual(['split', 'unmatched'])
  })

  it('draws a filled source without a badge for a clear confidence', () => {
    expect(stopMarksOf({ source: 'filled', confidence: 'clear' })).toEqual([
      { kind: 'source', value: 'filled', label: 'filled', tone: 'filled' },
    ])
  })

  it('draws an exception confidence under its own tone', () => {
    expect(stopMarksOf({ source: 'split', confidence: 'exception' }).map((m) => m.tone)).toEqual(['split', 'exception'])
  })
})
