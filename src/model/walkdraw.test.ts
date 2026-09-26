// #324 seam 2 — the walk's drawing arithmetic, checked as geometry rather than
// argued inside a render.
//
// Every piece here used to be inline JSX or a memo closed over React state in
// MapView: the head the whole set shares, the bow signs, each arrow's tail
// anchor and length, and which pins the band keeps. None of it could be called
// with pins and a position and asked what it would draw; all of it can now.
//
// The bow POLICY itself (which sign, and that one sign separates a doubled-back
// pair) is measured in walkarrow.test.ts; what is on trial here is that
// `walkArrowDraws` wires that policy to the right arrows with the right lengths.

import { describe, expect, test } from 'vitest'

import { WALK_ARROW_DEFAULTS, walkBand } from '@/ds/values'

import type { XY } from './derive'
import { bowedPoint } from './walkarrow'
import { walkArrowDraws, walkBowSigns, walkHeadLengths, walkPinBands } from './walkdraw'
import type { WalkPin } from './walkpins'

const at = (x: number, y: number): XY => ({ x, y })
/** the one field `walkBowSigns` reads off a pin */
const node = (x: number, y: number) => ({ c: at(x, y) })

/** a draw-ready pin whose key/visId are readable in a failure message */
const pin = (c: XY, size = 22): WalkPin => ({ key: `k${c.x},${c.y}`, visId: `v${c.x},${c.y}`, step: 1, stepEnd: 1, c, size })

/** `n` pins 100 world units apart along +x, in walk order — long enough that the
 *  band's trailing edge actually bites somewhere in the middle of it */
const row = (n: number, size = 22): WalkPin[] =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, visId: `v${i}`, step: i + 1, stepEnd: i + 1, c: at(i * 100, 0), size }))

/** how close curve A ever comes to curve B along A's own length — the nearest
 *  point on B to each sampled point of A, minimised.
 *
 *  `skipEnd` drops the tail of A's own parameter range. THE TWO CURVES SHARE THE
 *  PIN, so an unrestricted minimum is 0 in every arrangement and measures
 *  nothing: this test is about the stretch BEFORE it, which is why the
 *  measurement has to look there. Same helper as walkarrow.test.ts. */
function nearestGapAlong(a: [XY, XY, number], b: [XY, XY, number], skipEnd = 0.15, steps = 200): number {
  let best = Infinity
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (1 - skipEnd)
    const pa = bowedPoint(a[0], a[1], a[2], t)
    for (let j = 0; j <= steps; j++) {
      const pb = bowedPoint(b[0], b[1], b[2], j / steps)
      best = Math.min(best, Math.hypot(pa.x - pb.x, pa.y - pb.y))
    }
  }
  return best
}

describe('walkBowSigns', () => {
  test('a straight run of stops bows nothing — a walk through three pinned cells in a line', () => {
    expect(walkBowSigns([node(0, 0), node(100, 0), node(200, 0)])).toEqual([0, 0])
  })

  test('an ordinary corner bows nothing', () => {
    expect(walkBowSigns([node(0, 0), node(100, 0), node(100, 100)])).toEqual([0, 0])
  })

  test('a doubled-back stop signs BOTH its arrows, with the one sign', () => {
    // out to (200,0), back toward (90,10): the stop at (200,0) has both neighbours
    // lying to its left, so the two shafts share a corridor
    const signs = walkBowSigns([node(100, 0), node(200, 0), node(90, 10)])
    expect(signs).toHaveLength(2)
    expect(signs[0]).not.toBe(0)
    expect(signs[1]).not.toBe(0)
    expect(Math.sign(signs[0])).toBe(Math.sign(signs[1]))
  })

  test('a two-stop walk has no interior stop to bow at', () => {
    expect(walkBowSigns([node(0, 0), node(100, 0)])).toEqual([0])
  })
})

describe('walkHeadLengths — the provisional lengths the set head is asked about', () => {
  test('an open hop is its centre distance less both pin edges, both clearances and the head', () => {
    // two full-size pins 200px apart, camera at 1:1, published head 8
    const expected = 200 - (11 + WALK_ARROW_DEFAULTS.clearTail) - (11 + WALK_ARROW_DEFAULTS.clearHead) - 8
    expect(walkHeadLengths([pin(at(0, 0)), pin(at(200, 0))], 1, 1, 8)).toEqual([expected])
  })

  test('the camera scales the hop — the same two pins read wider zoomed in', () => {
    // viewS 2 halves the world-per-px, so 200 world units is 400 real px
    const expected = 400 - (11 + WALK_ARROW_DEFAULTS.clearTail) - (11 + WALK_ARROW_DEFAULTS.clearHead) - 8
    expect(walkHeadLengths([pin(at(0, 0)), pin(at(200, 0))], 2, 1, 8)).toEqual([expected])
  })

  test('a hop under a pixel contributes nothing at all', () => {
    expect(walkHeadLengths([pin(at(0, 0)), pin(at(0.5, 0))], 1, 1, 8)).toEqual([])
  })

  test('a hop nearer than its clearances gives the floor of 1, never a negative length', () => {
    expect(walkHeadLengths([pin(at(0, 0)), pin(at(20, 0))], 1, 1, 8)).toEqual([1])
  })
})

describe('walkArrowDraws — the per-arrow record the renderer places', () => {
  test('at rest: one straight shaft, anchored at the source pin\'s edge plus its clearance', () => {
    const draws = walkArrowDraws({ pins: [pin(at(0, 0)), pin(at(200, 0))], pinPos: null, head: 8, viewS: 1, f: 1, px: (v) => v })
    expect(draws).toHaveLength(1)
    const d = draws[0]
    expect(d.i).toBe(0)
    expect(d.worldDist).toBe(200)
    expect(d.dist).toBe(200)
    expect(d.angle).toBe(0)
    // OB-090: the tail sits at the source pin's drawn edge (11) plus the recipe's gap
    expect(d.tailOffset).toBe(11 + WALK_ARROW_DEFAULTS.clearTail)
    expect(d.tailX).toBe(11 + WALK_ARROW_DEFAULTS.clearTail)
    expect(d.tailY).toBe(0)
    // the drawn shaft: centre distance less both clearances and the head
    expect(d.length).toBe(200 - (11 + WALK_ARROW_DEFAULTS.clearTail) - (11 + WALK_ARROW_DEFAULTS.clearHead) - 8)
    // a lone arrow has no interior stop, so nothing bows
    expect(d.bow).toBe(0)
    expect(d.reading.walked).toBe(0)
    expect(d.reading.headAcorn).toBe(false)
    expect(d.reading.hidden).toBe(false)
  })

  test('the angle and the tail follow the direction of travel', () => {
    const draws = walkArrowDraws({ pins: [pin(at(0, 0)), pin(at(0, 100))], pinPos: null, head: 8, viewS: 1, f: 1, px: (v) => v })
    const d = draws[0]
    expect(d.dx).toBe(0)
    expect(d.dy).toBe(100)
    expect(d.angle).toBe(90)
    expect(d.tailX).toBe(0)
    expect(d.tailY).toBe(11 + WALK_ARROW_DEFAULTS.clearTail)
  })

  test('a hop the clearances have eaten is dropped, not returned hidden', () => {
    expect(walkArrowDraws({ pins: [pin(at(0, 0)), pin(at(20, 0))], pinPos: null, head: 8, viewS: 1, f: 1, px: (v) => v })).toEqual([])
  })

  test('a doubled-back pair bows both its shafts, and the drawn curves really separate', () => {
    // the ccw arrangement from walkarrow.test.ts: the walk comes in from (-260,-50)
    // and leaves to (-300,10), only ~12° away as seen from the shared pin
    const prev = at(-260, -50)
    const mid = at(0, 0)
    const next = at(-300, 10)
    const draws = walkArrowDraws({ pins: [pin(prev), pin(mid), pin(next)], pinPos: null, head: 8, viewS: 1, f: 1, px: (v) => v })
    expect(draws).toHaveLength(2)
    expect(draws[0].bow).not.toBe(0)
    expect(draws[1].bow).not.toBe(0)
    expect(Math.sign(draws[0].bow)).toBe(Math.sign(draws[1].bow))
    // measured on the drawn curves, the same way walkarrow.test.ts measures the policy
    const straight = nearestGapAlong([prev, mid, 0], [mid, next, 0])
    const bowed = nearestGapAlong([prev, mid, draws[0].bow], [mid, next, draws[1].bow])
    expect(bowed).toBeGreaterThan(straight * 2)
  })
})

describe('walkPinBands — which pins the band keeps', () => {
  test('no position: every pin draws at rest', () => {
    const pins = row(10)
    const kept = walkPinBands(pins, null)
    expect(kept).toHaveLength(10)
    expect(kept.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const d of kept) {
      expect(d.band.pinOpacity).toBe(1)
      expect(d.band.pinScale).toBe(1)
      expect(d.band.behind).toBe(false)
      expect(d.band.active).toBe(0)
    }
  })

  test('the position\'s pin pops, the trail behind it fades, and pins past the lead are dropped', () => {
    const pins = row(10)
    const kept = walkPinBands(pins, 5)
    // five stops of trail behind, two of lead ahead — indices 8 and 9 are out
    expect(kept.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // the pin the walk is ON: full ink, the pop, facing current
    expect(kept[5].pin).toBe(pins[5])
    expect(kept[5].band.pinOpacity).toBe(1)
    expect(kept[5].band.pinScale).toBe(walkBand(5, 5).pinScale)
    expect(kept[5].band.active).toBe(1)
    expect(kept[5].band.behind).toBe(false)
    // the far end of the trail is behind the walk
    expect(kept[0].band.behind).toBe(true)
  })

  test('the trail\'s far edge keeps the floor ink, and one stop further drops the pin', () => {
    const pins = row(10)
    // at position 5 the pin at index 0 is exactly `trail` behind: it still draws,
    // at the band's floor opacity
    expect(walkPinBands(pins, 5)[0].band.pinOpacity).toBe(walkBand(0, 5).pinOpacity)
    // at position 6 it is one stop past the trail: gone
    expect(walkPinBands(pins, 6).map((d) => d.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('the indices survive the drop — the band index and data-pin never renumber', () => {
    const pins = row(10)
    const kept = walkPinBands(pins, 6)
    expect(kept[0].pin).toBe(pins[1])
    expect(kept[0].index).toBe(1)
  })
})
