// OB-107 — the arithmetic behind bowing a walk arrow on the map, kept out of the
// component so it can be tested against real coordinates instead of eyeballed in
// a screenshot.
//
// `NodeArrow`'s `bow` is a signed offset of the shaft's midpoint PERPENDICULAR TO
// ITS OWN AXIS, and the map draws every walk arrow inside a `rotate(angle)` of its
// own — so a sign that separates two lines in one arrow's frame can put them on
// the same side of the map. Both functions here work in the map's WORLD
// coordinates, which is the only frame in which "do these two lines run together"
// is a real question.

import { WALK_ARROW_DEFAULTS, walkArrow } from '@/ds/values'

import type { XY } from './derive'

/** how far apart, in degrees (0–180), two neighbours lie AS SEEN FROM a shared
 *  point — the outward angle between `at → a` and `at → b`.
 *
 *  Not the angle between the two lines' travel directions, which is the same
 *  measurement read from one end and its opposite read from the other. Measuring
 *  outward from the shared pin makes the question symmetric: a small gap means
 *  both neighbours lie in the same direction, so the two shafts leave the pin down
 *  one corridor and stay in it. */
export function outwardAngleGap(at: XY, a: XY, b: XY): number {
  const one = Math.atan2(a.y - at.y, a.x - at.x)
  const two = Math.atan2(b.y - at.y, b.x - at.x)
  const deg = Math.abs(((one - two) * 180) / Math.PI) % 360
  return deg > 180 ? 360 - deg : deg
}

/** how much of its own length a shaft leans, as a fraction.
 *
 *  PROPORTIONAL, NOT FIXED, and that is the whole point of the number. A bow is
 *  read relative to the line it bends — the same 14px that visibly curves a
 *  300px shaft is 0.24% of a 6000px one and reads as dead straight. The map's
 *  arrows span both: a walk step is ~250px at L1 and ~6000px at L6, because
 *  diving multiplies the distance between two stops without changing what the
 *  arrow is. A flat offset therefore disappears exactly where the map gets
 *  large, which is measurable and was measured (drive-maparrows/probe: bulge
 *  14px at every length from 308px to 5938px). */
export const BOW_LENGTH_RATIO = 0.09
/** and it stops growing here, in real px. Past this a curve stops reading as a
 *  line that leans and starts reading as an arc drawn for its own sake.
 *
 *  READ BOTH NUMBERS AS TWICE THE BULGE. `bow` moves the quadratic's CONTROL
 *  point and a quadratic passes half way to its control, so the widest the drawn
 *  line ever leaves its own straight axis is 60px, not 120. The cap bites from
 *  ~1330px of shaft upward; below that the ratio rules, and at ~310px it
 *  reproduces the 28 this started as. */
export const BOW_MAX_PX = 120

/** the bow to draw on a shaft of this length, given a sign from the policy above —
 *  0 (straight) passes straight through, which is what most arrows get. */
export const bowFor = (sign: number, length: number): number =>
  sign * Math.min(BOW_MAX_PX, length * BOW_LENGTH_RATIO)

/** WHERE A BOWED SHAFT ACTUALLY RUNS, in world coordinates — the point at `t`
 *  along it, `t` from 0 at the tail to 1 at the head.
 *
 *  Derived from what `NodeArrow` draws rather than from what it means: the shaft
 *  is a quadratic whose control point is the straight midpoint pushed a full
 *  `bow` along the arrow's own cross axis — so the DRAWN curve passes only half
 *  the bow at its middle, not all of it. The map rotates each arrow by
 *  `atan2(dy, dx)`, which sends that local cross axis to `(-dy, dx) / len` out
 *  here.
 *
 *  This exists so "do these two arrows actually separate?" is a measurement
 *  taken on the drawn lines, and not an argument about signs. */
export function bowedPoint(tail: XY, head: XY, bow: number, t: number): XY {
  const dx = head.x - tail.x
  const dy = head.y - tail.y
  const len = Math.hypot(dx, dy) || 1
  const cx = (tail.x + head.x) / 2 + bow * (-dy / len)
  const cy = (tail.y + head.y) / 2 + bow * (dx / len)
  const u = 1 - t
  return {
    x: u * u * tail.x + 2 * u * t * cx + t * t * head.x,
    y: u * u * tail.y + 2 * u * t * cy + t * t * head.y,
  }
}

/** how close, in degrees, two neighbours must lie from a shared pin before their
 *  two shafts count as running in one corridor. 20° is the DS's own suggestion
 *  and it holds: at a shaft length of 200px, 20° already separates the far ends
 *  by ~70px, which no bow needs to help. */
export const BOW_CLOSE_DEG = 20

/** WHICH WAY THE TWO SHAFTS AT A DOUBLED-BACK PIN SHOULD BOW — one signed answer
 *  they BOTH take, or 0 when they are far enough apart to need none.
 *
 *  `at` is the shared pin, `prev` the stop the walk came from, `next` the one it
 *  goes to. Both lines get the SAME sign, and the sign is read off the geometry
 *  rather than fixed: `bow` is signed in each arrow's own rotated frame, and the
 *  two frames here point in opposite directions, so one number sends the two
 *  curves to opposite sides of the corridor they share. WHICH side is which
 *  depends on whether `next` lies clockwise or counter-clockwise of `prev` as
 *  seen from the pin — get that backwards and the two curve TOWARD each other
 *  and end up closer than they were straight.
 *
 *  (The DS proposed alternating the sign between the pair. That is the right
 *  answer for two lines both POINTING AT a pin; a walk is a path, so its two
 *  lines travel THROUGH it and the same sign is what separates them. Measured
 *  either way in `walkarrow.test.ts`, both arrangements, rather than argued.) */
export function bowSignAt(at: XY, prev: XY, next: XY): number {
  if (outwardAngleGap(at, prev, next) >= BOW_CLOSE_DEG) return 0
  const back = Math.atan2(prev.y - at.y, prev.x - at.x)
  const on = Math.atan2(next.y - at.y, next.x - at.x)
  let turn = on - back
  while (turn > Math.PI) turn -= 2 * Math.PI
  while (turn < -Math.PI) turn += 2 * Math.PI
  return turn >= 0 ? 1 : -1
}

// ── OB-132: the arrow as a reading of the band ──────────────────────────────
export type WalkArrowReading = ReturnType<typeof walkArrow>

/** THE DS'S ARROW RECIPE, READ BETWEEN TWO OF THIS MAP'S PINS (OB-132). `walkArrow(i,
 *  position, band, geom)` takes ONE `pinRadius` for both ends; this map's pins can differ
 *  in size (a crowded pin shrinks, OB-087), so when the two radii differ the head end is
 *  read again at its own radius and its clearance replaces the tail-radius one. `hidden`
 *  stays the DS's own test rather than a copy of it: the tail-radius call is handed `length`
 *  less the head end's EXTRA clearance, so its one-radius reading is exact for two.
 *
 *  `length` is the pin-centre-to-pin-centre distance in px LESS THE DRAWN HEAD, so "crushed"
 *  means no shaft is left once both clearances and the head have taken their share.
 *
 *  A `null` position is a route nobody is walking (see `PIN_NO_POSITION`): the arrow at
 *  rest — unwalked, at the recipe's `quiet`, clearances at the resting radii. */
export function walkArrowBetween(k: number, position: number | null, tailRadius: number, headRadius: number, length: number): WalkArrowReading {
  if (position === null) {
    const G = WALK_ARROW_DEFAULTS
    const tailClear = tailRadius + G.clearTail
    const headClear = headRadius + G.clearHead
    return { hidden: length - headClear <= tailClear, opacity: G.quiet, walked: 0, aheadOpacity: G.quiet, tailClear, headClear, headTravels: false, headAcorn: false }
  }
  if (headRadius === tailRadius) return walkArrow(k, position, undefined, { pinRadius: tailRadius, length })
  const atTail = walkArrow(k, position, undefined, { pinRadius: tailRadius })
  const atHead = walkArrow(k, position, undefined, { pinRadius: headRadius })
  const extra = atHead.headClear - atTail.headClear
  return { ...walkArrow(k, position, undefined, { pinRadius: tailRadius, length: length - extra }), headClear: atHead.headClear }
}
