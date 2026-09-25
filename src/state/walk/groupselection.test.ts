// OB-115 (#257): "Group" works on a NON-CONTIGUOUS selection. Two rules, both pure and
// both here: which selections are groupable at all (`siblingSelection` — same parent,
// gaps allowed), and what a gapped group does with the hole (`gatherIntoGroup` — the
// members collapse into one container at the first member's slot; what sat between
// them moves after). The hook that wires them to the button is not under test; these
// are the whole of its decision.

import { describe, expect, test } from 'vitest'

import { gatherIntoGroup, pathKey, siblingSelection } from './authordraft'
import type { Stop } from './mockwalk'

const leaf = (node: string): Stop => ({ node, variants: [] })
const chain = (...nodes: string[]): Stop[] => nodes.map(leaf)
const wrap = (steps: Stop[]): Stop => ({ key: 'g', title: '', variants: [{ id: 'v', label: '', steps }] })
const nodesOf = (list: Stop[]) => list.map((s) => (s.variants.length ? '[' + s.variants[0].steps.map((x) => x.node).join(' ') + ']' : s.node))

describe('siblingSelection — what "Group" is willing to take', () => {
  test('a gapped selection under one parent is groupable, in chain order', () => {
    const sel = new Set([pathKey([4]), pathKey([1])])
    expect(siblingSelection(sel)).toEqual({ parent: [], indices: [1, 4] })
  })

  test('a contiguous run is unchanged: still groupable', () => {
    const sel = new Set([pathKey([2]), pathKey([3])])
    expect(siblingSelection(sel)).toEqual({ parent: [], indices: [2, 3] })
  })

  test('a selection that reaches into two containers is NOT groupable', () => {
    // step 0 of variant 0 of stop 1, and top-level stop 3 — different parents
    const sel = new Set([pathKey([1, 0, 0]), pathKey([3])])
    expect(siblingSelection(sel)).toBeNull()
  })

  test('nothing selected, nothing to group', () => {
    expect(siblingSelection(new Set())).toBeNull()
  })
})

describe('gatherIntoGroup — the reorder is the ask, not a side effect', () => {
  test('THE CHECKABLE CASE (#257): in a chain of 6, group 2 and 5', () => {
    const before = chain('1', '2', '3', '4', '5', '6')
    const after = gatherIntoGroup(before, [1, 4], wrap)
    // one container at position 2 holding both; the old 3 / 4 / 6 renumber to 3 / 4 / 5
    expect(nodesOf(after)).toEqual(['1', '[2 5]', '3', '4', '6'])
    expect(after).toHaveLength(5)
    expect(after[1].variants[0].steps).toHaveLength(2)
  })

  test('members are gathered in CHAIN order, whatever order they were clicked', () => {
    const after = gatherIntoGroup(chain('1', '2', '3', '4', '5', '6'), [4, 1], wrap)
    expect(nodesOf(after)).toEqual(['1', '[2 5]', '3', '4', '6'])
  })

  test('an adjacent-selection group is unchanged', () => {
    const after = gatherIntoGroup(chain('1', '2', '3', '4'), [1, 2], wrap)
    expect(nodesOf(after)).toEqual(['1', '[2 3]', '4'])
  })

  test('three members with two holes: both holes move after the group, in their order', () => {
    const after = gatherIntoGroup(chain('a', 'b', 'c', 'd', 'e', 'f', 'g'), [0, 3, 5], wrap)
    expect(nodesOf(after)).toEqual(['[a d f]', 'b', 'c', 'e', 'g'])
  })

  test('the first and the last of a chain: everything between lands after', () => {
    const after = gatherIntoGroup(chain('1', '2', '3'), [0, 2], wrap)
    expect(nodesOf(after)).toEqual(['[1 3]', '2'])
  })

  test('the list is not mutated', () => {
    const before = chain('1', '2', '3')
    gatherIntoGroup(before, [0, 2], wrap)
    expect(nodesOf(before)).toEqual(['1', '2', '3'])
  })
})
