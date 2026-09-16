// The walk's pins on the map, asked directly instead of measured off a
// screenshot (OB-128, #249).
//
// This is the reason the layout was lifted out of `MapView` at all. The DS filed
// OB-128 from a picture of a walk we do not have, with a diagnosis that turned
// out not to match the code; the driver that measures the shipped walks finds no
// collision at any level, so there is nothing there to reproduce. The obligation
// anticipates exactly that and says to treat the DONE-WHEN as the requirement.
//
// A done-when of the form "no circle overlaps another" is a claim about every
// walk at every level, not about one screenshot — which a browser can never
// check and a pure function can. So the guarantee is asserted here, over both
// authored walks, every level the atlas has, and a spread of pane sizes; and the
// crowd cases the DS names (two on one cell, three, five) are BUILT rather than
// hunted for, because the shipped corpus does not contain a five.

import { describe, expect, test } from 'vitest'

import { WALKS } from '../corpus/walks'
import { topicIds } from '../corpus/graph'
import { walkAnchorAt } from './atlas'
import { maxTier } from './nested'
import { crowdIds, PIN_GAP, PIN_NO_POSITION, PIN_SIZE, PIN_SIZE_MIN, pinPosition, pinSizeFor, separate, walkPins } from './walkpins'
import type { WalkPin } from './walkpins'

const LEVELS = Array.from({ length: maxTier + 1 }, (_, i) => i)
/** the map's own zoom ladder (MapView's BASE_S), so the scales tested here are
 *  the scales the app is actually drawn at rather than round numbers. */
const LEVEL_S = [0.8, 1.6, 3.0, 5.5, 9.5, 14]
/** the fit factor is viewport width over the atlas's own width, so it varies
 *  with the pane. Three values stand in for a narrow pane, a normal one and a
 *  wide one — the invariant must not depend on which. */
const FITS = [0.6, 1.2, 2.4]

const pxAt = (level: number, f: number) => (v: number) => (v * f) / (LEVEL_S[level] ?? LEVEL_S[LEVEL_S.length - 1] * Math.pow(1.5, level - (LEVEL_S.length - 1)))

/** the pair that overlaps most, or null when none do. The done-when's own
 *  words: no part of either circle inside the other. */
function worstOverlap(pins: WalkPin[], px: (v: number) => number): { a: WalkPin; b: WalkPin; by: number } | null {
  let worst: { a: WalkPin; b: WalkPin; by: number } | null = null
  for (let i = 0; i < pins.length; i++)
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i]
      const b = pins[j]
      const by = px((a.size + b.size) / 2) - Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y)
      if (by > 1e-6 && (!worst || by > worst.by)) worst = { a, b, by }
    }
  return worst
}

const describeOverlap = (o: { a: WalkPin; b: WalkPin; by: number }) =>
  `stop ${o.a.step} (${o.a.visId}, ${o.a.size}px) and stop ${o.b.step} (${o.b.visId}, ${o.b.size}px) overlap by ${o.by.toFixed(2)} world units`

describe('THE GUARANTEE — no two walk pins are ever drawn inside each other', () => {
  test('every authored walk, every level, every pane width', () => {
    for (const walk of WALKS) {
      const route = walk.stops.map((s) => s.id)
      for (const level of LEVELS) {
        for (const f of FITS) {
          const px = pxAt(level, f)
          const pins = walkPins({ route, level, px, labelBoxes: [] })
          const worst = worstOverlap(pins, px)
          expect(worst && `${walk.id} L${level} f${f}: ${describeOverlap(worst)}`).toBeNull()
        }
      }
    }
  })

  test('and it holds with the labels in the way too — the clearance nudge runs before it, not after', () => {
    // stage 5 moves pins off names and stage 6 moves them off each other; the
    // order is what makes the second one final. Feeding real label boxes is the
    // only way to exercise that interaction, so the boxes are taken from the
    // territories the walk actually crosses.
    const route = WALKS[0].stops.map((s) => s.id)
    for (const level of LEVELS) {
      const px = pxAt(level, 1.2)
      const bare = walkPins({ route, level, px, labelBoxes: [] })
      // a fat box centred on every pin — the worst case the nudge can face
      const labelBoxes = bare.map((p) => ({ x0: p.c.x - px(60), y0: p.c.y - px(9), x1: p.c.x + px(60), y1: p.c.y + px(9) }))
      const pins = walkPins({ route, level, px, labelBoxes })
      const worst = worstOverlap(pins, px)
      expect(worst && `L${level}: ${describeOverlap(worst)}`).toBeNull()
    }
  })
})

// ── the DS's own three crowd cases ──────────────────────────────────────────
// "Re-check with three and with five stops on one cell: no circle overlaps
// another." The shipped walks have a two; three and five have to be built.

/** a route whose stops land on `cell` `n` times NON-ADJACENTLY — the case that
 *  stays `n` separate pins rather than merging into one range pin. `other` is
 *  the cell it bounces off between visits. */
function alternating(a: string, b: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(a)
    if (i < n - 1) out.push(b)
  }
  return out
}

/** two topics that resolve to DIFFERENT cells at `level`, so a walk bouncing
 *  between them produces separate pins rather than one merged run. */
function twoApartAt(level: number): [string, string] | null {
  const first = topicIds.find((id) => walkAnchorAt(id, level))
  if (!first) return null
  const home = walkAnchorAt(first, level)!.visId
  const away = topicIds.find((id) => walkAnchorAt(id, level)?.visId && walkAnchorAt(id, level)!.visId !== home)
  return away ? [first, away] : null
}

describe('several stops on ONE cell — OB-087 sizing, and none of them touching', () => {
  for (const n of [2, 3, 5]) {
    test(`${n} separate visits to the same cell draw ${n} pins, all clear of each other`, () => {
      const level = 2
      const pair = twoApartAt(level)
      expect(pair).not.toBeNull()
      const [home, away] = pair!
      const px = pxAt(level, 1.2)
      const pins = walkPins({ route: alternating(home, away, n), level, px, labelBoxes: [] })

      const homeCell = walkAnchorAt(home, level)!.visId
      const onHome = pins.filter((p) => p.visId === homeCell)
      expect(onHome).toHaveLength(n)
      // every one of them is its own pin standing for ONE stop — a non-adjacent
      // return is never merged into a run (OB-069)
      expect(onHome.every((p) => p.stepEnd === p.step)).toBe(true)

      const worst = worstOverlap(pins, px)
      expect(worst && describeOverlap(worst)).toBeNull()
    })
  }

  test('and they take the crowded size, which is what makes room for them', () => {
    const level = 2
    const [home, away] = twoApartAt(level)!
    const px = pxAt(level, 1.2)
    for (const n of [1, 2, 3, 5]) {
      const pins = walkPins({ route: alternating(home, away, n), level, px, labelBoxes: [] })
      const homeCell = walkAnchorAt(home, level)!.visId
      const onHome = pins.filter((p) => p.visId === homeCell)
      for (const p of onHome) expect(p.size).toBe(pinSizeFor(n))
    }
  })
})

describe('pinSizeFor — OB-087’s formula, unchanged', () => {
  test('a lone pin is full size and the shrink is floored', () => {
    expect(pinSizeFor(1)).toBe(PIN_SIZE)
    expect(pinSizeFor(2)).toBe(19)
    expect(pinSizeFor(3)).toBe(16)
    expect(pinSizeFor(9)).toBe(PIN_SIZE_MIN)
  })
})

describe('CROWDING IS A PROPERTY OF THE DRAWN POSITION (OB-128), not of the cell', () => {
  const px = (v: number) => v // 1 world unit == 1 screen px, so distances read directly

  test('two pins on DIFFERENT cells that land on top of each other are one crowd', () => {
    // the case the old per-cell count could not see: two stops that never share
    // an id, drawn a few px apart
    expect(crowdIds([{ x: 0, y: 0 }, { x: 5, y: 0 }], px)).toEqual([1, 1])
  })

  test('pins with clear air between them are not', () => {
    expect(new Set(crowdIds([{ x: 0, y: 0 }, { x: 200, y: 0 }], px)).size).toBe(2)
  })

  test('crowding is transitive — a chain of three is ONE crowd of three, not two of two', () => {
    // A touches B and B touches C while A and C do not touch. Counted pairwise,
    // each would read as a crowd of two and take the wrong size.
    const ids = crowdIds([{ x: 0, y: 0 }, { x: PIN_SIZE - 2, y: 0 }, { x: (PIN_SIZE - 2) * 2, y: 0 }], px)
    expect(new Set(ids).size).toBe(1)
  })

  test('it is measured at FULL size, so a crowd cannot shrink itself out of existence', () => {
    // at the shrunk size for a crowd of three (16px) these three would not
    // touch, and a count taken after shrinking would grow them back to 22 and
    // overlap again
    const apart = 18
    const ids = crowdIds([{ x: 0, y: 0 }, { x: apart, y: 0 }, { x: apart * 2, y: 0 }], px)
    expect(new Set(ids).size).toBe(1)
    expect(pinSizeFor(3)).toBeLessThan(apart)
  })
})

// ── stage 6 on its own ──────────────────────────────────────────────────────
// TESTED DIRECTLY, AND IT HAS TO BE. On the shipped corpus this stage never
// fires: no two cells the authored walks touch are close enough to collide, and
// the fan already spaces the same-cell pins well clear. Disabling it leaves
// every end-to-end assertion above still passing — so those assertions say
// nothing about it, and a test that cannot fail is not evidence.
//
// It earns its place as the pipeline's last word, for cases the corpus does not
// contain today: two cells drawn close together, and the label nudge moving a
// pin toward its neighbour. Both are reachable by editing a walk, neither can be
// reached from `walks.ts`, so the guarantee is asserted where it can be made to
// fail — on pins placed by hand.

const pin = (step: number, x: number, y: number, size = PIN_SIZE): WalkPin => ({
  key: `p${step}`,
  visId: `cell${step}`,
  step,
  c: { x, y },
  stepEnd: step,
  size,
})
/** the identity scale — 1 world unit is 1 screen px, so the numbers below are
 *  the numbers a reader sees. */
const one = (v: number) => v
/** How far short of the TARGET gap a settled arrangement is allowed to land.
 *  Not slack in the guarantee: the requirement is that no circle is inside
 *  another, which is a gap of ZERO, and every case below clears that by the
 *  best part of two pixels. The relaxation approaches its 2px target from below
 *  in a chain — fixing one pair nudges the next — so asserting the target to the
 *  last bit would be asserting that an iterative solver terminates exactly,
 *  which it does not and does not need to. */
const SETTLED = 1e-3
const closest = (pins: WalkPin[]) => {
  let min = Infinity
  for (let i = 0; i < pins.length; i++)
    for (let j = i + 1; j < pins.length; j++) min = Math.min(min, Math.hypot(pins[i].c.x - pins[j].c.x, pins[i].c.y - pins[j].c.y) - (pins[i].size + pins[j].size) / 2)
  return min
}

describe('SEPARATE — the pipeline’s last word (OB-128)', () => {
  test('two pins a few px apart end up a full gap apart, moved half each', () => {
    const pins = [pin(1, 0, 0), pin(2, 6, 0)]
    separate(pins, one)
    expect(closest(pins)).toBeGreaterThanOrEqual(PIN_GAP - SETTLED)
    // symmetric: neither pin is privileged, so the midpoint does not move
    expect((pins[0].c.x + pins[1].c.x) / 2).toBeCloseTo(3, 6)
    expect(pins[0].c.y).toBeCloseTo(0, 6)
  })

  test('two pins on EXACTLY the same point are separated too', () => {
    // no direction to push along — the case a naive implementation divides by
    // zero on, or silently leaves stacked
    const pins = [pin(1, 40, 40), pin(2, 40, 40)]
    separate(pins, one)
    expect(closest(pins)).toBeGreaterThanOrEqual(PIN_GAP - SETTLED)
    expect(Number.isFinite(pins[0].c.x)).toBe(true)
  })

  test('and it draws the same picture every time — no random jitter', () => {
    const a = [pin(1, 40, 40), pin(2, 40, 40)]
    const b = [pin(1, 40, 40), pin(2, 40, 40)]
    separate(a, one)
    separate(b, one)
    expect(a.map((p) => p.c)).toEqual(b.map((p) => p.c))
  })

  test('five pins piled into one blob all come apart', () => {
    const pins = [pin(1, 0, 0), pin(2, 3, 1), pin(3, -2, 2), pin(4, 1, -3), pin(5, 4, 4)].map((p) => ({ ...p, size: pinSizeFor(5) }))
    separate(pins, one)
    expect(closest(pins)).toBeGreaterThan(0) // the obligation itself
    expect(closest(pins)).toBeGreaterThanOrEqual(PIN_GAP - SETTLED)
  })

  test('a chain resolves — pushing one pair apart must not leave a new overlap behind', () => {
    // three in a row, each overlapping only its neighbour. One straight pass
    // fixes 1-2, which shoves 2 into 3. Only the iteration finishes the job.
    const pins = [pin(1, 0, 0), pin(2, 14, 0), pin(3, 28, 0)]
    separate(pins, one)
    expect(closest(pins)).toBeGreaterThan(0) // the obligation itself
    expect(closest(pins)).toBeGreaterThanOrEqual(PIN_GAP - SETTLED)
  })

  test('pins that already have room are left exactly where they were', () => {
    const pins = [pin(1, 0, 0), pin(2, 500, 0), pin(3, 0, 500)]
    const before = pins.map((p) => ({ ...p.c }))
    separate(pins, one)
    expect(pins.map((p) => p.c)).toEqual(before)
  })

  test('it works in world units, not screen px — the same overlap at a different zoom', () => {
    // px() is the only place the two coordinate systems meet; getting it
    // backwards separates by a factor of the zoom and passes a same-scale test
    const zoomed = (v: number) => v * 4
    const pins = [pin(1, 0, 0), pin(2, 24, 0)] // 24 world units apart = 6 screen px
    separate(pins, zoomed)
    expect(Math.hypot(pins[0].c.x - pins[1].c.x, pins[0].c.y - pins[1].c.y)).toBeGreaterThanOrEqual(zoomed(PIN_SIZE + PIN_GAP) - 1e-6)
  })
})

describe('separation leaves real air, not a shared edge', () => {
  test('two pins forced onto the same point end up a full gap apart', () => {
    const level = 2
    const [home, away] = twoApartAt(level)!
    const px = pxAt(level, 1.2)
    const pins = walkPins({ route: alternating(home, away, 2), level, px, labelBoxes: [] })
    const homeCell = walkAnchorAt(home, level)!.visId
    const [a, b] = pins.filter((p) => p.visId === homeCell)
    const gap = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) - px((a.size + b.size) / 2)
    expect(gap).toBeGreaterThanOrEqual(px(PIN_GAP) - 1e-6)
  })
})

describe('what the pins say, which the layout must not change', () => {
  const level = 1
  const px = pxAt(level, 1.2)

  test('a CONTIGUOUS run on one cell is one pin spanning the run (OB-069)', () => {
    const [home] = twoApartAt(level)!
    const pins = walkPins({ route: [home, home, home], level, px, labelBoxes: [] })
    expect(pins).toHaveLength(1)
    expect([pins[0].step, pins[0].stepEnd]).toEqual([1, 3])
  })

  test('a single stop is a one-stop pin', () => {
    const [home] = twoApartAt(level)!
    const pins = walkPins({ route: [home], level, px, labelBoxes: [] })
    expect([pins[0].step, pins[0].stepEnd]).toEqual([1, 1])
  })

  test('a merged run knows its LAST stop too, which is what puts the walk on the pin (OB-132)', () => {
    const [home, away] = twoApartAt(level)!
    const pins = walkPins({ route: [home, home, home, away], level, px, labelBoxes: [] })
    expect(pins.map((p) => [p.step, p.stepEnd])).toEqual([[1, 3], [4, 4]])
  })

  test('an empty walk draws nothing', () => {
    expect(walkPins({ route: [], level, px, labelBoxes: [] })).toEqual([])
  })
})

describe('pinPosition — the walk\'s position counted in PINS (OB-132)', () => {
  const run = (...runs: [number, number][]) => runs.map(([step, stepEnd]) => ({ step, stepEnd }))

  test('one pin per stop is the identity — the fine map reads exactly the DS\'s rule', () => {
    const pins = run([1, 1], [2, 2], [3, 3], [4, 4])
    expect(pinPosition(pins, 0)).toBe(0)
    expect(pinPosition(pins, 2)).toBe(2)
    expect(pinPosition(pins, 1.25)).toBeCloseTo(1.25)
    expect(pinPosition(pins, 3)).toBe(3)
  })

  test('anywhere inside a merged run is ON that pin — the whole run is "you are here"', () => {
    const pins = run([1, 3], [4, 7])
    expect(pinPosition(pins, 0)).toBe(0)
    expect(pinPosition(pins, 1)).toBe(0)
    expect(pinPosition(pins, 2)).toBe(0)
    expect(pinPosition(pins, 3)).toBe(1)
    expect(pinPosition(pins, 6)).toBe(1)
  })

  test('between two runs the position is the same fraction of the way between the two PINS', () => {
    const pins = run([1, 3], [4, 7])
    expect(pinPosition(pins, 2.5)).toBeCloseTo(0.5)
    expect(pinPosition(pins, 2.1)).toBeCloseTo(0.1)
  })

  test('a stop the map dropped is crossed by the arrow, not by a missing pin', () => {
    // stop 2 was unplaceable at this level: pin 0 ends at 1, pin 1 starts at 3
    const pins = run([1, 1], [3, 3])
    expect(pinPosition(pins, 1)).toBeCloseTo(0.5)
    expect(pinPosition(pins, 0.5)).toBeCloseTo(0.25)
  })

  test('past the ends it clamps to the first and the last pin; no pins is 0', () => {
    const pins = run([2, 2], [3, 3])
    expect(pinPosition(pins, 0)).toBe(0)
    expect(pinPosition(pins, 9)).toBe(1)
    expect(pinPosition([], 3)).toBe(0)
  })

  test('a route with no position draws every pin at rest, ahead of nobody', () => {
    expect(PIN_NO_POSITION).toEqual({ behind: false, active: 0, pinOpacity: 1, pinScale: 1 })
  })
})
