// OB-219 / OB-220 — the duplicate-neighbour rule, as the design system published it. Both
// surfaces read these two functions (the road's drag verdict and the picker's greyed rows),
// so a regression here is a regression in both at once. The edges are pinned because the DS
// names them as the part a retyped copy gets wrong: slot 0 and slot n have one neighbour
// each, and a neighbour with no id blocks nothing.

import { describe, expect, test } from 'vitest'

import { adjacentDuplicates, DropVerdict, neighboursOf, verdictPaint, VERDICT_METRICS } from './DropVerdict'

describe('adjacentDuplicates', () => {
  test("the obligation's own example: the nulls and the non-adjacent repeat both pass", () => {
    expect(adjacentDuplicates(['a', 'b', 'b', null, null, 'a'])).toEqual([2])
  })

  test('the same node NOT adjacent is legitimate — a walk may return to a node', () => {
    expect(adjacentDuplicates(['bin', 'tlg', 'graph', 'tlg'])).toEqual([])
  })

  test('a null is never equal to anything, including another null', () => {
    expect(adjacentDuplicates([null, null])).toEqual([])
    expect(adjacentDuplicates(['tlg', null, null, 'tlg'])).toEqual([])
  })

  test('three in a row — both gaps refused', () => {
    expect(adjacentDuplicates(['tlg', 'tlg', 'tlg'])).toEqual([1, 2])
  })

  test('an empty chain has nothing to refuse', () => {
    expect(adjacentDuplicates([])).toEqual([])
  })
})

describe('neighboursOf — the DS card table, slot by slot', () => {
  const ids = ['bin', 'tlg', null, 'graph']

  test('the head of the chain — one neighbour below it', () => {
    expect(neighboursOf(ids, 0)).toEqual(['bin'])
  })

  test('between two resolved nodes — both refused', () => {
    expect(neighboursOf(ids, 1)).toEqual(['bin', 'tlg'])
  })

  test('a picker below, so only the node above is refused', () => {
    expect(neighboursOf(ids, 2)).toEqual(['tlg'])
  })

  test('a picker above, so only the node below is refused', () => {
    expect(neighboursOf(ids, 3)).toEqual(['graph'])
  })

  test('the tail — one neighbour above it', () => {
    expect(neighboursOf(ids, 4)).toEqual(['graph'])
  })

  test('an empty list refuses nothing', () => {
    expect(neighboursOf([], 0)).toEqual([])
  })
})

describe('the paint and the numbers', () => {
  test('green is a line and nothing else — the asymmetry, as a value', () => {
    expect(verdictPaint(true)).toEqual({ line: 'var(--verdict-yes)' })
    expect(verdictPaint(false)).toEqual({
      line: 'var(--verdict-no)', wash: 'var(--verdict-no-wash)', hair: 'var(--verdict-no-hair)', ink: 'var(--verdict-no-ink)',
    })
  })

  test('the chosen numbers, including the amended dropGap (4, not 8)', () => {
    expect(VERDICT_METRICS).toEqual({ stroke: 2, dropGap: 4, glyphPx: 11 })
  })

  test('the capitalised way in carries the same function objects, not copies', () => {
    expect(DropVerdict.paint).toBe(verdictPaint)
    expect(DropVerdict.METRICS).toBe(VERDICT_METRICS)
    expect(DropVerdict.adjacentDuplicates).toBe(adjacentDuplicates)
    expect(DropVerdict.neighboursOf).toBe(neighboursOf)
  })
})
