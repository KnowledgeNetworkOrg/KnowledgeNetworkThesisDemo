// #506 — the walk list's grouping rule. The browser driver proves the lists on
// screen; this pins the order and the saved-walk fallback, which are easy to get
// subtly wrong and invisible in a screenshot.

import { describe, expect, it } from 'vitest'

import type { Walk } from '../corpus/walks'
import { groupWalks, SAVED_WALKS_HEADING } from './walkgroups'

const walk = (id: string, category?: string): Walk => ({
  id,
  title: id,
  description: '',
  category,
  stops: [],
})

const headingsOf = (groups: ReturnType<typeof groupWalks>) => groups.map((g) => g.heading)
const idsOf = (groups: ReturnType<typeof groupWalks>) => groups.map((g) => g.walks.map((w) => w.id))

describe('groupWalks — by the program’s published category', () => {
  it('keeps a corpus with no categories in one flat, ordered group', () => {
    const groups = groupWalks([walk('a'), walk('b'), walk('c')])
    expect(headingsOf(groups)).toEqual([null])
    expect(idsOf(groups)).toEqual([['a', 'b', 'c']])
  })

  it('takes headings in the order the data first meets them, and keeps each group ordered', () => {
    const groups = groupWalks([
      walk('a', 'REQUIRED'),
      walk('b', 'REQUIRED GROUP 1'),
      walk('c', 'REQUIRED'),
      walk('d', 'Professionally-Related Table I'),
    ])
    expect(headingsOf(groups)).toEqual(['REQUIRED', 'REQUIRED GROUP 1', 'Professionally-Related Table I'])
    expect(idsOf(groups)).toEqual([['a', 'c'], ['b'], ['d']])
  })

  it('puts an uncategorised saved walk under its own heading, after the program’s', () => {
    const groups = groupWalks([walk('authored-x'), walk('a', 'REQUIRED')])
    expect(headingsOf(groups)).toEqual(['REQUIRED', SAVED_WALKS_HEADING])
    expect(idsOf(groups)).toEqual([['a'], ['authored-x']])
  })

  it('shows no saved-walk heading when every walk has a category', () => {
    const groups = groupWalks([walk('a', 'REQUIRED'), walk('b', 'REQUIRED')])
    expect(headingsOf(groups)).toEqual(['REQUIRED'])
  })

  it('treats an empty list as one flat group', () => {
    expect(groupWalks([])).toEqual([{ heading: null, walks: [] }])
  })
})
