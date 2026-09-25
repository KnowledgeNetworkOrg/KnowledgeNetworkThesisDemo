// OB-107 — the bow policy, checked as geometry rather than as an argument.
//
// The one thing here that is genuinely easy to get backwards, and that a
// screenshot would only tell you about after the fact: WHICH WAY to bow the two
// lines at a pin the walk doubles back through. The DS proposed alternating the
// sign. That is right for two lines both POINTING AT a shared pin, and wrong for
// a walk, because a walk is a path — its two lines travel in OPPOSITE directions
// through the pin, and `bow` is signed in each arrow's own rotated frame. So the
// same sign puts them on opposite sides of the corridor and the alternating one
// stacks them.
//
// The last test measures that on the drawn curves instead of reasoning about it.

import { describe, expect, test } from 'vitest'

import { WALK_ARROW_DEFAULTS, walkArrow } from '@/ds/values'

import { BOW_CLOSE_DEG, BOW_LENGTH_RATIO, BOW_MAX_PX, bowFor, bowSignAt, bowedPoint, outwardAngleGap, walkArrowBetween } from './walkarrow'
import type { XY } from './derive'

const at = (x: number, y: number): XY => ({ x, y })

/** how close curve A ever comes to curve B along A's own length — the nearest
 *  point on B to each sampled point of A, minimised.
 *
 *  `skipEnd` drops the tail of A's own parameter range. THE TWO CURVES SHARE THE
 *  PIN, so an unrestricted minimum is 0 in every arrangement and measures
 *  nothing: what OB-090 point 1 already fixed is exactly that meeting point. This
 *  item is about the stretch BEFORE it, which is why the measurement has to look
 *  there. */
function nearestGapAlong(
  a: [XY, XY, number],
  b: [XY, XY, number],
  skipEnd = 0.15,
  steps = 200,
): number {
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

describe('outwardAngleGap', () => {
  test('two neighbours in opposite directions are 180 apart — the walk passes straight through', () => {
    expect(outwardAngleGap(at(0, 0), at(-10, 0), at(10, 0))).toBeCloseTo(180)
  })

  test('two neighbours in the same direction are 0 apart — the walk doubles straight back', () => {
    expect(outwardAngleGap(at(0, 0), at(-10, 0), at(-40, 0))).toBeCloseTo(0)
  })

  test('a right-angle turn is 90', () => {
    expect(outwardAngleGap(at(0, 0), at(0, -10), at(10, 0))).toBeCloseTo(90)
  })

  test('it does not care which neighbour is named first', () => {
    const p = at(3, 7)
    expect(outwardAngleGap(p, at(30, 12), at(-4, 40))).toBeCloseTo(outwardAngleGap(p, at(-4, 40), at(30, 12)))
  })

  test('it never exceeds 180, however the angles wrap', () => {
    // 170° and -170° are 20° apart, not 340°
    const p = at(0, 0)
    const one = at(Math.cos((170 * Math.PI) / 180) * 50, Math.sin((170 * Math.PI) / 180) * 50)
    const two = at(Math.cos((-170 * Math.PI) / 180) * 50, Math.sin((-170 * Math.PI) / 180) * 50)
    expect(outwardAngleGap(p, one, two)).toBeCloseTo(20)
  })

  test('the doubling-back case the policy is looking for falls under the threshold', () => {
    // step 10 out to the left, back through 6, on to 11 — also to the left
    expect(outwardAngleGap(at(400, 300), at(120, 320), at(90, 260))).toBeLessThan(BOW_CLOSE_DEG)
  })

  test('and an ordinary corner does not', () => {
    expect(outwardAngleGap(at(400, 300), at(120, 320), at(410, 40))).toBeGreaterThan(BOW_CLOSE_DEG)
  })
})

describe('bowFor', () => {
  test('no sign, no bow — most arrows draw the straight <line> they always did', () => {
    expect(bowFor(0, 200)).toBe(0)
  })

  test('a very long shaft takes the cap, not the ratio', () => {
    expect(bowFor(1, 4000)).toBe(BOW_MAX_PX)
  })

  test('a short shaft takes the ratio, so a stub does not become a semicircle', () => {
    expect(bowFor(1, 20)).toBeCloseTo(20 * BOW_LENGTH_RATIO)
    expect(bowFor(1, 20)).toBeLessThan(BOW_MAX_PX)
  })

  test('the sign passes straight through', () => {
    expect(bowFor(-1, 4000)).toBe(-BOW_MAX_PX)
  })

  // THE REGRESSION THIS FILE EXISTS TO CATCH TWICE. The first magnitude was a
  // flat 28px cap that every map arrow reached, so a 308px shaft and a 5938px
  // shaft bent by the same 14px — a visible lean on one and 0.24% on the other.
  // A bow is read against the line it bends, so what has to stay constant is the
  // RATIO, not the offset.
  test('the bend stays proportional across the range of lengths the map actually draws', () => {
    const bulgeFraction = (len: number) => bowFor(1, len) / 2 / len
    expect(bulgeFraction(308)).toBeCloseTo(BOW_LENGTH_RATIO / 2, 6)
    expect(bulgeFraction(1200)).toBeCloseTo(BOW_LENGTH_RATIO / 2, 6)
    // only the cap breaks the proportion, and it still leaves a bend worth seeing
    expect(bulgeFraction(5938)).toBeGreaterThan(0.008)
  })

  test('and a map-scale shaft bends by tens of px, not by fourteen', () => {
    expect(bowFor(1, 1200) / 2).toBeGreaterThan(40)
    expect(bowFor(1, 5938) / 2).toBe(BOW_MAX_PX / 2)
  })
})

describe('bowSignAt — the sign that actually separates a doubled-back pair', () => {
  // Two arrangements of the same shape, mirrored. The walk comes into a pin from
  // one neighbour and leaves to another lying only ~12 degrees away, so the two
  // shafts share a corridor and read as one doubled line. In `ccw` the outgoing
  // neighbour sits anticlockwise of the incoming one; in `cw` it sits clockwise.
  // THE CORRECT SIGN IS OPPOSITE IN THE TWO CASES, which is the whole reason
  // this is a function and not the constant +1 it was first written as.
  const cases = {
    ccw: { prev: at(-260, -50), pin: at(0, 0), next: at(-300, 10) },
    cw: { prev: at(-260, 50), pin: at(0, 0), next: at(-300, -10) },
  }

  /** a fixed bow for these ~265px shafts, deliberately NOT `bowFor`. What is on
   *  trial below is the SIGN, and retuning the magnitude — which has happened
   *  once already — must not be able to move these results by a hair and read as
   *  the sign policy changing. */
  const B = 28

  for (const [name, { prev, pin, next }] of Object.entries(cases)) {
    describe(name, () => {
      const arriving: [XY, XY] = [prev, pin]
      const leaving: [XY, XY] = [pin, next]
      const picked = bowSignAt(pin, prev, next)
      const gap = (sign: number) =>
        nearestGapAlong([...arriving, sign * B], [...leaving, sign * B])

      test('the policy calls it close and picks a side', () => {
        expect(outwardAngleGap(pin, prev, next)).toBeLessThan(BOW_CLOSE_DEG)
        expect(Math.abs(picked)).toBe(1)
      })

      test('drawn straight, the two shafts stay within a few px of each other', () => {
        expect(gap(0)).toBeLessThan(10)
      })

      test('the sign it picks opens a real gap', () => {
        expect(gap(picked)).toBeGreaterThan(gap(0) * 2)
      })

      test('and the OTHER sign curves them together instead — this is the direction that can be got backwards', () => {
        expect(gap(-picked)).toBeLessThan(gap(picked))
      })

      test('alternating the sign, as the item proposed, does not separate them either', () => {
        const alternating = nearestGapAlong([...arriving, B], [...leaving, -B])
        expect(alternating).toBeLessThan(gap(picked))
      })
    })
  }

  test('the two arrangements really do want opposite signs', () => {
    expect(bowSignAt(cases.ccw.pin, cases.ccw.prev, cases.ccw.next)).toBe(-bowSignAt(cases.cw.pin, cases.cw.prev, cases.cw.next))
  })

  test('a walk that turns a real corner gets no bow at all', () => {
    expect(bowSignAt(at(400, 300), at(120, 320), at(410, 40))).toBe(0)
  })
})

describe('walkArrowBetween — the DS\'s recipe read at two pin sizes (OB-132)', () => {
  test('two pins of one size read exactly what the DS reads', () => {
    expect(walkArrowBetween(2, 2.4, 11, 11, 180)).toEqual(walkArrow(2, 2.4, undefined, { pinRadius: 11, length: 180 }))
  })

  test('a smaller head pin gets ITS clearance, not the tail pin\'s', () => {
    const r = walkArrowBetween(2, 2, 11, 8, 180)
    const same = walkArrow(2, 2, undefined, { pinRadius: 11, length: 180 })
    expect(r.tailClear).toBe(same.tailClear)
    expect(r.headClear).toBe(walkArrow(2, 2, undefined, { pinRadius: 8 }).headClear)
    expect(r.headClear).toBeLessThan(same.headClear)
    expect(r.walked).toBe(same.walked)
    expect(r.opacity).toBe(same.opacity)
  })

  test('and `hidden` is exact for the two radii — a shaft the smaller head pin leaves room for is drawn', () => {
    // at position 2 the tail pin (2) is popped: tailClear = 11 · 1.36 + 3 = 17.96;
    // the head pin (3) is one ahead at rest: headClear = r + 4
    const tight = walkArrowBetween(2, 2, 11, 11, 17.96 + 15 + 0.5) // 11 + 4 = 15 → 0.5px of shaft
    expect(tight.hidden).toBe(false)
    expect(walkArrowBetween(2, 2, 11, 11, 17.96 + 15 - 0.5).hidden).toBe(true)
    // the same length with an 8px head pin leaves 3.5px MORE shaft — the one-radius
    // reading would have hidden it
    expect(walkArrowBetween(2, 2, 11, 8, 17.96 + 15 - 0.5).hidden).toBe(false)
    expect(walkArrowBetween(2, 2, 11, 8, 17.96 + 12 - 0.5).hidden).toBe(true)
  })

  test('no position: the arrow at rest — unwalked, quiet, clearances at the resting radii', () => {
    const r = walkArrowBetween(0, null, 11, 8, 100)
    expect(r).toEqual({
      hidden: false, opacity: WALK_ARROW_DEFAULTS.quiet, walked: 0, aheadOpacity: WALK_ARROW_DEFAULTS.quiet,
      tailClear: 11 + WALK_ARROW_DEFAULTS.clearTail, headClear: 8 + WALK_ARROW_DEFAULTS.clearHead,
      headTravels: false, headAcorn: false,
    })
    expect(walkArrowBetween(0, null, 11, 11, 20).hidden).toBe(true)
  })
})
