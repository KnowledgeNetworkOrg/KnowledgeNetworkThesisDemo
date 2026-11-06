// The unified history engine's invariants. The bus wires visit/step/mark to
// focus writes; what MUST hold — the log never loses an event, dedup at the
// log tip and at the stack cursor, forward-branch burning, hard step bounds —
// lives here where it runs on every test pass.

import { describe, expect, test } from 'vitest'

import { domainIds, topicIds } from '../corpus/graph'
import { HISTORY_EMPTY, kindLabel, mark, step, visit } from './nav'
import type { History } from './nav'

const visitAll = (ids: string[], h: History = HISTORY_EMPTY) => ids.reduce((acc, id) => visit(acc, id, 'map'), h)

describe('the browsable stack — back/forward', () => {
  test('a visit appends and stands on the new entry', () => {
    const h = visitAll(['a', 'b'])
    expect(h.stack).toEqual(['a', 'b'])
    expect(h.cursor).toBe(1)
  })

  test('re-visiting the place under the cursor never re-pushes — several bus writers report one click', () => {
    let h = visit(HISTORY_EMPTY, 'a', 'map')
    h = visit(h, 'a', 'tree')
    expect(h.stack).toEqual(['a'])
    expect(h.cursor).toBe(0)
  })

  test('a visit mid-history burns the forward branch — the log keeps it', () => {
    let h = visitAll(['a', 'b', 'c'])
    h = step(h, -1)!.hist // standing on b
    h = visit(h, 'd', 'map')
    expect(h.stack).toEqual(['a', 'b', 'd'])
    expect(h.cursor).toBe(2)
    expect(h.log.map((e) => e.id)).toContain('c') // burned from the line, not from history
  })

  test('revisiting an OLD place is a real entry, not a dedup — only the cursor entry dedups', () => {
    let h = visitAll(['a', 'b'])
    h = visit(h, 'a', 'map')
    expect(h.stack).toEqual(['a', 'b', 'a'])
  })

  test('back and forward walk the stack without mutating it', () => {
    const h3 = visitAll(['a', 'b', 'c'])
    const back = step(h3, -1)!
    expect(back.id).toBe('b')
    expect(back.hist.stack).toBe(h3.stack)
    const fwd = step(back.hist, 1)!
    expect(fwd.id).toBe('c')
  })

  test('null past either end — the empty history has no steps at all', () => {
    const h3 = visitAll(['a', 'b', 'c'])
    expect(step(h3, 1)).toBeNull()
    let h = h3
    h = step(h, -1)!.hist
    h = step(h, -1)!.hist
    expect(h.cursor).toBe(0)
    expect(step(h, -1)).toBeNull()
    expect(step(HISTORY_EMPTY, -1)).toBeNull()
    expect(step(HISTORY_EMPTY, 1)).toBeNull()
  })

  test('back to the start then a fresh visit leaves exactly two stack entries', () => {
    let h = visitAll(['a', 'b', 'c'])
    h = step(h, -1)!.hist
    h = step(h, -1)!.hist
    h = visit(h, 'z', 'map')
    expect(h.stack).toEqual(['a', 'z'])
    expect(h.cursor).toBe(1)
  })
})

describe('the log — every navigation event, forever', () => {
  test('append-only: no operation ever removes or reorders a logged event', () => {
    let h = visitAll(['a', 'b', 'c'])
    const snapshots = [h.log]
    h = step(h, -1)!.hist
    snapshots.push(h.log)
    h = visit(h, 'd', 'tree')
    snapshots.push(h.log)
    h = mark(h, 'e', 'walk')
    snapshots.push(h.log)
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].slice(0, snapshots[i - 1].length)).toEqual(snapshots[i - 1])
    }
  })

  test("a step lands on the log tagged 'nav' — walking history is itself history", () => {
    let h = visitAll(['a', 'b'])
    h = step(h, -1)!.hist
    const tip = h.log[h.log.length - 1]
    expect(tip).toEqual({ id: 'a', via: 'nav', jump: false })
  })

  test('a write identical to the log tip is dropped, whatever produced it', () => {
    let h = visit(HISTORY_EMPTY, 'a', 'map')
    const n = h.log.length
    h = mark(h, 'a', 'walk')
    h = visit(h, 'a', 'tree')
    expect(h.log.length).toBe(n)
  })

  test('mark logs provenance without moving the stack — the Unfold/route case', () => {
    let h = visitAll(['a', 'b'])
    h = mark(h, 'x', 'graph')
    expect(h.log.map((e) => e.id)).toEqual(['a', 'b', 'x'])
    expect(h.stack).toEqual(['a', 'b'])
    expect(h.cursor).toBe(1)
  })

  test('the log and the stack dedup independently — mark between visits', () => {
    // visit a, mark b, visit a again: the log reads a,b,a (all real events);
    // the stack still stands on the single a (nothing re-pushed).
    let h = visit(HISTORY_EMPTY, 'a', 'map')
    h = mark(h, 'b', 'walk')
    h = visit(h, 'a', 'tree')
    expect(h.log.map((e) => e.id)).toEqual(['a', 'b', 'a'])
    expect(h.stack).toEqual(['a'])
  })

  test('via and jump ride each event — the trail strip reads them off the log', () => {
    let h = visit(HISTORY_EMPTY, 'a', 'map')
    h = visit(h, 'b', 'link', true)
    expect(h.log[1]).toEqual({ id: 'b', via: 'link', jump: true })
  })
})

describe('kindLabel — the word the document header and hover card give a place', () => {
  test('every top-level domain reads as a container, whether or not it holds a unit', () => {
    expect(domainIds.length).toBeGreaterThan(0)
    for (const d of domainIds) expect(kindLabel(d), d).toBe('container')
  })

  test('a topic reads as a topic', () => {
    expect(topicIds.length).toBeGreaterThan(0)
    for (const t of topicIds) expect(kindLabel(t), t).toBe('topic')
  })

  test('an id the corpus does not hold reads as a leaf', () => {
    expect(kindLabel('no-such-place')).toBe('leaf')
  })
})
