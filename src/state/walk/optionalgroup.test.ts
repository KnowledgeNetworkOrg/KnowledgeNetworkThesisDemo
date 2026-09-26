// DS OB-215 (#344) — the optional button acts on a whole versioned group, and a group never
// carries an `optional` field of its own. The owner's ruling, 2026-09-17: a group "cannot be made
// optional, but all its containing nodes could be optional, which would make the versioned group
// effectively optional". So only leaves hold the flag; the button's reading over a selection, what
// one press writes, and what the road does with an all-optional group are all pure, and all here.
// The hook that wires them to the pill (`useAuthorDraft`) commits `setOptionalAt`'s one tree as
// one undo step; it is not under test (vitest runs without a renderer), these are its decisions.

import { describe, expect, test } from 'vitest'

import { optionalOf, setOptionalAt } from './authordraft'
import { leavesIn, optionalReading, resolveRoad, skippableBox, withOptional } from './mockwalk'
import type { Stop } from './mockwalk'

/** real corpus topics — resolveRoad does not look them up, but the ids should be true ones */
const A = 'stk-dns-naming'
const B = 'stk-ip-routing'
const C = 'stk-tcp-udp'

const leaf = (node: string, optional?: boolean): Stop => (optional ? { node, optional: true, variants: [] } : { node, variants: [] })
const group = (key: string, steps: Stop[]): Stop => ({ key, title: key, variants: [{ id: key + '-v0', label: '', steps }] })
const fork = (key: string, ...lanes: Stop[][]): Stop => ({ key, title: key, variants: lanes.map((steps, i) => ({ id: `${key}-v${i}`, label: '', steps })) })

/** the flags of every leaf under the plan, in tree order — what the chips draw */
const flags = (stops: Stop[]) => leavesIn(stops).map((l) => l.optional === true)

describe('the reading — what the button shows over a selection', () => {
  test('a leaf reads its own flag', () => {
    const plan = [leaf(A), leaf(B, true)]
    expect(optionalOf(plan, [[0]])).toBe(false)
    expect(optionalOf(plan, [[1]])).toBe(true)
  })

  test('a group reads its leaves: none, all, or MIXED — never a flag of its own', () => {
    expect(optionalOf([group('g', [leaf(A), leaf(B)])], [[0]])).toBe(false)
    expect(optionalOf([group('g', [leaf(A, true), leaf(B, true)])], [[0]])).toBe(true)
    expect(optionalOf([group('g', [leaf(A, true), leaf(B)])], [[0]])).toBe('mixed')
  })

  test('a fork reads EVERY version, not only the one on screen', () => {
    expect(optionalOf([fork('f', [leaf(A, true)], [leaf(B)])], [[0]])).toBe('mixed')
  })

  test('nested groups count all the way down', () => {
    expect(optionalOf([group('g', [leaf(A, true), group('h', [leaf(B)])])], [[0]])).toBe('mixed')
  })

  test('a selection of several blocks reads as one subject', () => {
    const plan = [leaf(A, true), leaf(B), leaf(C, true)]
    expect(optionalOf(plan, [[0], [2]])).toBe(true)
    expect(optionalOf(plan, [[0], [1]])).toBe('mixed')
  })

  test('nothing to act on: an empty group, an empty selection, a path that is gone', () => {
    expect(optionalOf([group('g', [])], [[0]])).toBeNull()
    expect(optionalOf([leaf(A)], [])).toBeNull()
    expect(optionalOf([leaf(A)], [[4]])).toBeNull()
    expect(optionalReading([])).toBeNull()
  })
})

describe('the press — one tree, every leaf under the selection, the group untouched', () => {
  test('a press on an all-required group marks every leaf inside it', () => {
    const plan = [leaf(A), group('g', [leaf(B), group('h', [leaf(C)])])]
    const next = setOptionalAt(plan, [[1]], true)
    expect(flags(next)).toEqual([false, true, true])
    expect(optionalOf(next, [[1]])).toBe(true)
  })

  test('pressing again clears every leaf inside it', () => {
    const plan = [group('g', [leaf(A, true), leaf(B, true)])]
    expect(flags(setOptionalAt(plan, [[0]], false))).toEqual([false, false])
  })

  test('THE GROUP GAINS NO FIELD — set or cleared, only its leaves change', () => {
    const plan = [group('g', [leaf(A)]), fork('f', [leaf(B)], [leaf(C)])]
    for (const on of [true, false]) {
      const next = setOptionalAt(plan, [[0], [1]], on)
      expect(next[0]).not.toHaveProperty('optional')
      expect(next[1]).not.toHaveProperty('optional')
    }
  })

  test('a press on a fork reaches the version that is not on screen too', () => {
    const next = setOptionalAt([fork('f', [leaf(A)], [leaf(B), leaf(C)])], [[0]], true)
    expect(flags(next)).toEqual([true, true, true])
  })

  test('a cleared leaf has NO flag, not `false` — the shape of one never marked', () => {
    const [cleared] = setOptionalAt([leaf(A, true)], [[0]], false)
    expect(cleared).not.toHaveProperty('optional')
    expect(withOptional(leaf(B), false)).toEqual(leaf(B))
  })

  test('it rebuilds, never mutates — the old tree is what undo goes back to', () => {
    const plan = [group('g', [leaf(A)])]
    const before = JSON.stringify(plan)
    setOptionalAt(plan, [[0]], true)
    expect(JSON.stringify(plan)).toBe(before)
  })

  test('a group and a leaf inside it selected together is harmless — both land on the same value', () => {
    const plan = [group('g', [leaf(A), leaf(B)])]
    expect(flags(setOptionalAt(plan, [[0], [0, 0, 1]], true))).toEqual([true, true])
  })
})

describe('the mixed group — reachable by ordinary use, and a press from it SETS', () => {
  test('press on the group, toggle one leaf back: the group reads mixed', () => {
    const plan = [group('g', [leaf(A), leaf(B)])]
    const all = setOptionalAt(plan, [[0]], true)
    const one = setOptionalAt(all, [[0, 0, 0]], false)
    expect(optionalOf(one, [[0]])).toBe('mixed')
  })

  test('the next press from mixed makes EVERY leaf optional (the tri-state checkbox convention)', () => {
    const plan = [group('g', [leaf(A), leaf(B, true)])]
    const reading = optionalOf(plan, [[0]])
    expect(reading).toBe('mixed')
    // the hook's rule: only a fully-on reading clears
    const next = setOptionalAt(plan, [[0]], reading !== true)
    expect(flags(next)).toEqual([true, true])
  })

  test('a leaf ADDED to an all-optional group arrives required, so the group turns mixed', () => {
    // the palette and "Add node" build `{ node, variants: [] }` — no flag inherited at creation
    const plan = [group('g', [leaf(A, true), leaf(B, true)])]
    const grown: Stop[] = [{ ...plan[0], variants: [{ ...plan[0].variants[0], steps: [...plan[0].variants[0].steps, leaf(C)] }] }]
    expect(optionalOf(grown, [[0]])).toBe('mixed')
  })
})

describe('the derived reading on the road — "this group is optional" is computed, never stored', () => {
  test('a group is skippable only when every leaf on its road is optional', () => {
    expect(skippableBox(group('g', [leaf(A, true), leaf(B, true)]), {})).toBe(true)
    expect(skippableBox(group('g', [leaf(A, true), leaf(B)]), {})).toBe(false)
    expect(skippableBox(group('g', []), {})).toBe(false)
    expect(skippableBox(leaf(A, true), {})).toBe(false)
  })

  test('a fork is read on its CHOSEN road — the one the walk would take', () => {
    const f = fork('f', [leaf(A, true)], [leaf(B)])
    expect(skippableBox(f, {})).toBe(true)
    expect(skippableBox(f, { f: 'f-v1' })).toBe(false)
  })

  test('bypassing optionals drops an all-optional group WHOLE — no empty numbered group left behind', () => {
    const plan = [leaf(A), group('g', [leaf(B, true), leaf(C, true)]), leaf(A)]
    expect(resolveRoad(plan, {}, false).map((s) => s.node ?? s.key)).toEqual([A, A])
    // with optionals on the road, the group and its leaves are all there
    expect(resolveRoad(plan, {}, true)).toHaveLength(3)
  })

  test('a mixed group stays, holding only its required leaves', () => {
    const plan = [group('g', [leaf(A, true), leaf(B)])]
    const road = resolveRoad(plan, {}, false)
    expect(road).toHaveLength(1)
    expect(road[0].variants[0].steps.map((s) => s.node)).toEqual([B])
  })

  test('an empty group is not dropped — it has nothing to skip', () => {
    expect(resolveRoad([group('g', [])], {}, false)).toHaveLength(1)
  })
})
