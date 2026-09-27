// #195 — the pure half of the player. `useWalkPlayback` itself cannot be tested
// here (vitest runs `environment: 'node'`, there is no DOM and no renderer), but
// the two things that would break silently can be: the projection from either
// source into a flat list of steps, and the cursor arithmetic that has to stay
// inside that list while the list is being edited underneath it.

import { describe, expect, it } from 'vitest'

import { byId } from '../../corpus/graph'
import type { Walk } from '../walkstore'
import { leafIds, resolveRoad, routeStepsOf } from './mockwalk'
import { routeLeafIds, routeNumbers } from '../../model/route'
import type { Stop } from './mockwalk'
import { clampCursor, playSteps, routeIsWalk } from './playback'

/** real corpus topics — playSteps reads `byId.get(id)!.title`, so a made-up id
 * would throw rather than fail an assertion */
const A = 'stk-dns-naming'
const B = 'stk-ip-routing'
const C = 'stk-tcp-udp'

const leaf = (node: string, extra: Partial<Stop> = {}): Stop => ({ node, variants: [], ...extra })
const fork = (key: string, lanes: { id: string; label: string; steps: Stop[] }[]): Stop => ({
  key,
  title: 'which way',
  variants: lanes,
})

describe('playSteps — the draft road', () => {
  it('flattens a resolved tree to its leaves, in order', () => {
    const road = resolveRoad([leaf(A), fork('f', [{ id: 'v0', label: 'one', steps: [leaf(B)] }]), leaf(C)], {}, true)
    expect(playSteps(null, road).map((s) => s.id)).toEqual([A, B, C])
  })

  it('agrees with leafIds — the player and bus.route never walk the tree differently', () => {
    // the two projections are the reason a strip can say "stop 2 of 5" while the
    // map highlights a different node. Expressed as one assertion so they cannot
    // drift apart without a red test.
    const road = resolveRoad([leaf(A), fork('f', [{ id: 'v0', label: '', steps: [leaf(B), leaf(C)] }])], {}, true)
    expect(playSteps(null, road).map((s) => s.id)).toEqual(leafIds(road))
  })

  it('carries the note and the optional flag through', () => {
    const road = resolveRoad([leaf(A, { note: 'why we start here' }), leaf(B, { optional: true })], {}, true)
    const [first, second] = playSteps(null, road)
    expect(first.note).toBe('why we start here')
    expect(second.optional).toBe(true)
    expect(first.optional).toBeUndefined()
  })

  it('takes only the chosen lane of a fork', () => {
    const f = fork('f', [
      { id: 'v0', label: 'the short way', steps: [leaf(B)] },
      { id: 'v1', label: 'the long way', steps: [leaf(C)] },
    ])
    expect(playSteps(null, resolveRoad([f], {}, true)).map((s) => s.id)).toEqual([B])
    expect(playSteps(null, resolveRoad([f], { f: 'v1' }, true)).map((s) => s.id)).toEqual([C])
  })

  it('drops a bypassed optional, so the deck shows what will actually be presented', () => {
    const road = resolveRoad([leaf(A), leaf(B, { optional: true }), leaf(C)], {}, false)
    expect(playSteps(null, road).map((s) => s.id)).toEqual([A, C])
  })

  it('carries the originating Stop on every step — the fork door (#195)', () => {
    // asserted so a later refactor cannot quietly drop the field: without it a
    // present-time fork chooser has nothing to read and needs a second structure
    // running parallel to `steps`.
    const road = resolveRoad([leaf(A), leaf(B)], {}, true)
    for (const step of playSteps(null, road)) expect(step.stop).toBeDefined()
    expect(playSteps(null, road)[0].stop!.node).toBe(A)
  })

  it('titles every step from the corpus, not from the stop', () => {
    const road = resolveRoad([leaf(A)], {}, true)
    expect(playSteps(null, road)[0].title).toBe(byId.get(A)!.title)
  })
})

describe('the road on the bus keeps its groups (#228, DS OB-114)', () => {
  it('routeStepsOf walks the tree exactly as leafStops does', () => {
    const road = resolveRoad([leaf(A), fork('f', [{ id: 'v0', label: 'one', steps: [leaf(B), leaf(C)] }]), leaf(A)], {}, true)
    expect(routeLeafIds(routeStepsOf(road))).toEqual(leafIds(road))
    expect(routeStepsOf(road)[1]).toEqual({ title: 'which way', steps: [{ node: B }, { node: C }] })
  })

  it('every step carries its path — a group\'s stop its group ordinal then its own, a top-level stop its step number alone', () => {
    const road = resolveRoad([leaf(A), fork('f', [{ id: 'v0', label: 'one', steps: [leaf(B), leaf(C)] }]), leaf(A)], {}, true)
    expect(playSteps(null, road).map((s) => s.path)).toEqual([[1], [2, 1], [2, 2], [3]])
    expect(routeNumbers(routeStepsOf(road)).map((n) => n.step)).toEqual([1, 2, 2, 3])
  })

  it('a leaf\'s optional flag rides on its step, and a required step is the same `{ node }` as ever (DS OB-214)', () => {
    const road = resolveRoad([leaf(A), fork('f', [{ id: 'v0', label: 'one', steps: [leaf(B, { optional: true }), leaf(C)] }])], {}, true)
    expect(routeStepsOf(road)).toEqual([{ node: A }, { title: 'which way', steps: [{ node: B, optional: true }, { node: C }] }])
    expect(routeStepsOf(road)[0]).not.toHaveProperty('optional')
  })

  it('a saved walk has no paths at all', () => {
    const w: Walk = { id: 'w', title: 't', stops: [{ id: A, note: '' }, { id: B, note: '' }] } as Walk
    expect(playSteps(w, []).every((s) => s.path === undefined)).toBe(true)
  })
})

describe('playSteps — a saved walk', () => {
  const walk: Walk = {
    id: 'authored-x',
    title: 'a saved one',
    description: '',
    // `note` is REQUIRED on a saved walk's stops (corpus/walks.ts) — a saved
    // walk always carries one, empty at worst. That is the difference from a
    // draft Stop, whose note is genuinely optional.
    stops: [
      { id: A, note: 'kept' },
      { id: B, note: '' },
    ],
  }

  it('is flat, keeps notes, and has no optionals or stops to carry', () => {
    const steps = playSteps(walk, [])
    expect(steps.map((s) => s.id)).toEqual([A, B])
    expect(steps[0].note).toBe('kept')
    // a saved Walk is {id, note} only — there is no optional and no tree behind
    // it, and inventing either would be a lie about what was saved
    expect(steps[0].optional).toBeUndefined()
    expect(steps[0].stop).toBeUndefined()
  })

  it('wins over the draft road entirely', () => {
    const road = resolveRoad([leaf(C)], {}, true)
    expect(playSteps(walk, road).map((s) => s.id)).toEqual([A, B])
  })
})

describe('clampCursor', () => {
  it('holds the cursor inside the list', () => {
    expect(clampCursor(-3, 5)).toBe(0)
    expect(clampCursor(0, 5)).toBe(0)
    expect(clampCursor(2, 5)).toBe(2)
    expect(clampCursor(4, 5)).toBe(4)
    expect(clampCursor(9, 5)).toBe(4)
  })

  it('survives an empty walk', () => {
    // reachable in the app: delete every stop in the editor while the viewer is
    // mounted. -1 would index off the end of an empty array.
    expect(clampCursor(0, 0)).toBe(0)
    expect(clampCursor(7, 0)).toBe(0)
  })
})

// #246 — the dock's mount condition and the clock's one arithmetic.
describe('routeIsWalk — is the route the map draws the walk being played?', () => {
  const steps = [{ id: A }, { id: B }, { id: C }]

  it('the whole draft, published by presented.ts', () => {
    expect(routeIsWalk([A, B, C], steps)).toBe(true)
  })

  it('the played PREFIX of a saved walk (activateWalk publishes only that)', () => {
    expect(routeIsWalk([A], steps)).toBe(true)
    expect(routeIsWalk([A, B], steps)).toBe(true)
  })

  it('a curriculum from bus.teach is not a walk', () => {
    expect(routeIsWalk([B, A], steps)).toBe(false)
    expect(routeIsWalk([C], steps)).toBe(false)
  })

  it('an empty route is nothing to dock onto; a longer route than the walk is not it', () => {
    expect(routeIsWalk([], steps)).toBe(false)
    expect(routeIsWalk([A, B, C, A], steps)).toBe(false)
    expect(routeIsWalk([A], [])).toBe(false)
  })
})

