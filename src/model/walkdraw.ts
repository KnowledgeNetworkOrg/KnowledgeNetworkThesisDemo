// THE WALK'S DRAWING ARITHMETIC — which lines bow, where an arrow's shaft starts
// and how long it is, one head for the whole set, and which pins the recency band
// keeps — lifted out of MapView (#324 seam 2) so each rule can be called with
// pins and asked what it would draw. Same argument as walkpins.ts and
// walkarrow.ts: a memo closed over React state cannot be asked that question.
//
// WHAT IS NOT HERE, AND WHY. The DS components, the one-shot `headForSet` call
// and the wall's visibility rule stay in `instruments/map/WalkArrows.tsx` and
// `WalkPins.tsx`: the first two live in `.tsx` files this layer cannot import
// (`ds/values.ts` is the only door, and a test watches what it reaches), and the
// last is a rule about the host's wall mode, not about the geometry. So
// `walkHeadLengths` takes the published head length as an argument rather than
// reaching for `ARROW_METRICS` itself.

import { WALK_ARROW_DEFAULTS, walkBand } from '@/ds/values'
import type { WalkBandReading } from '@/ds/values'

import type { XY } from './derive'
import { bowFor, bowSignAt, walkArrowBetween } from './walkarrow'
import type { WalkArrowReading } from './walkarrow'
import { PIN_NO_POSITION } from './walkpins'
import type { WalkPin } from './walkpins'

// ── OB-126: the lengths the whole-set head is asked about ────────────────────

/** THE PROVISIONAL LENGTHS, ONE PER DRAWN HOP (OB-126). Each is the pin-centre-to-
 *  pin-centre distance in px less both pins' edges, their clearances and the
 *  published head — the length the arrow would carry if the head stayed at its
 *  published 8. `headForSet` then takes the smallest head the set allows, so these
 *  differ from the final lengths only in the all-long case, by at most the few px
 *  the head grew.
 *
 *  ONE PASS IS EXACT WHEREVER IT MATTERS, and that is the whole reason this is a
 *  function rather than a fixpoint: the cap only lifts the head above 8 once the
 *  SHORTEST hop passes ~267px, and `headForSet` takes the minimum, so any walk
 *  with one short hop in it resolves to exactly 8 — what the map already drew —
 *  with no circularity at all.
 *
 *  `head` is passed in (the caller passes `ARROW_METRICS.head`, a `.tsx` constant
 *  this layer cannot reach) so the published head stays the one source of it.
 *  Hops under a pixel — the threshold the renderer has always used to drop a
 *  degenerate arrow — contribute nothing. */
export function walkHeadLengths(pins: readonly { c: XY; size: number }[], viewS: number, f: number, head: number): number[] {
  const lengths: number[] = []
  for (let i = 1; i < pins.length; i++) {
    const from = pins[i - 1]
    const to = pins[i]
    const worldDist = Math.hypot(to.c.x - from.c.x, to.c.y - from.c.y) || 1
    const dist = (worldDist * viewS) / f // world units -> real px
    if (dist < 1) continue
    lengths.push(Math.max(1, dist - (from.size / 2 + WALK_ARROW_DEFAULTS.clearTail) - (to.size / 2 + WALK_ARROW_DEFAULTS.clearHead) - head))
  }
  return lengths
}

// ── OB-107: which walk lines bow, and which way ──────────────────────────────

/** ONE SIGN PER ARROW: 0 draws the straight shaft, ±1 asks for a bow.
 *
 *  OB-090 point 1 pulled the arrows' shared ANCHOR apart — every line leaves and
 *  meets a pin at its own edge rather than at one shared centre. What survived it
 *  is two lines that still run near-parallel for most of their LENGTH and read as
 *  one doubled shaft right up to the head. `bow` curves a shaft away from its own
 *  axis; this decides who gets one.
 *
 *  WHICH: a walk is a PATH, so a stop has exactly two lines at it — the one
 *  arriving and the one leaving. They run close when the walk DOUBLES BACK: both
 *  the previous stop and the next lie in nearly the same direction from this one,
 *  so the two shafts share a corridor. Under BOW_CLOSE_DEG apart, measured
 *  outward from the shared pin, is that case. (Two lines can also run close
 *  WITHOUT sharing a pin; the DS's checkable is the shared-pin case and that is
 *  what this covers — a scope decision, named in `walkarrow.ts`.)
 *
 *  WHICH WAY: the DS proposed alternating the sign between the pair. That is
 *  right for two lines both POINTING AT a pin, and wrong here, because a path's
 *  two lines travel in OPPOSITE directions through it — so ONE sign, taken by
 *  both, sends them to opposite sides of the corridor. Which sign that is depends
 *  on whether the next stop lies clockwise or anticlockwise of the previous one
 *  from this pin; `bowSignAt` reads it off the geometry, and getting it backwards
 *  curves the two TOWARD each other. Measured on the drawn curves in
 *  `walkarrow.test.ts`, both arrangements, rather than argued. */
export function walkBowSigns(pins: readonly { c: XY }[]): number[] {
  const signs = new Array<number>(Math.max(0, pins.length - 1)).fill(0)
  for (let p = 1; p < pins.length - 1; p++) {
    const sign = bowSignAt(pins[p].c, pins[p - 1].c, pins[p + 1].c)
    if (sign === 0) continue
    signs[p - 1] = sign
    signs[p] = sign
  }
  return signs
}

// ── the arrows, as records a renderer can place ──────────────────────────────

/** one arrow, ready to draw — every number the renderer needs and nothing else */
export interface WalkArrowDraw {
  /** the arrow's index in walk order: it joins `pins[i]` to `pins[i + 1]` */
  i: number
  dx: number
  dy: number
  /** pin-centre to pin-centre, in world units */
  worldDist: number
  /** the same distance in real screen px — what every clearance is measured in */
  dist: number
  /** the shaft's angle in degrees, the map's own `rotate` */
  angle: number
  /** the tail anchor: the source pin's edge plus its clearance, world units */
  tailOffset: number
  tailX: number
  tailY: number
  /** the drawn shaft in px, head excluded */
  length: number
  /** the signed bow for this shaft (OB-107) */
  bow: number
  /** what the band says about this arrow (OB-132) */
  reading: WalkArrowReading
}

export interface WalkArrowDrawsInput {
  pins: readonly WalkPin[]
  /** the walk's position in PIN units, or null when no walk is playing */
  pinPos: number | null
  /** the one head for the whole set, as drawn (`headForSet(...).head`) */
  head: number
  viewS: number
  f: number
  /** real screen px -> world units — the host's own `px`; the tail anchor is a px clearance */
  px: (v: number) => number
}

/** ONE RECORD PER ARROW THAT ACTUALLY DRAWS — the per-arrow JSX arithmetic, made
 *  callable. An arrow the band or the clearances have eaten is dropped here rather
 *  than returned with a flag: `hidden` means the two clearances have eaten the whole
 *  shaft (two crowded stops, or two popped pins), and there is nothing to draw.
 *
 *  THE ARROW IS A READING OF THE BAND (OB-132), not a description of two pins: its
 *  opacity, the walked/quiet split, where its head sits and BOTH its clearances come
 *  from the DS's `walkArrow` recipe, through `walkArrowBetween`, which reads it at
 *  this map's two pin sizes, against the SCALED pins. `length` handed to the recipe
 *  is centre to centre less the head.
 *
 *  THE TAIL IS ANCHORED AT THE SOURCE PIN'S OWN EDGE (OB-090), toward the target —
 *  a centred tail is the SAME point for every arrow leaving a pin, however many
 *  attach there. The band's `tailClear` is that edge plus its gap, at the pin's
 *  drawn scale; `px` carries it from screen px into the world units the anchor is
 *  written in, and the same division turns the round trip back into `length`. */
export function walkArrowDraws({ pins, pinPos, head, viewS, f, px }: WalkArrowDrawsInput): WalkArrowDraw[] {
  const signs = walkBowSigns(pins)
  const out: WalkArrowDraw[] = []
  for (let k = 0; k + 1 < pins.length; k++) {
    const from = pins[k]
    const to = pins[k + 1]
    const dx = to.c.x - from.c.x
    const dy = to.c.y - from.c.y
    const worldDist = Math.hypot(dx, dy) || 1
    const dist = (worldDist * viewS) / f // world units -> real px
    if (dist < 1) continue
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const reading = walkArrowBetween(k, pinPos, from.size / 2, to.size / 2, dist - head)
    if (reading.hidden) continue
    const tailOffset = px(reading.tailClear)
    const tailX = from.c.x + (dx / worldDist) * tailOffset
    const tailY = from.c.y + (dy / worldDist) * tailOffset
    const length = Math.max(1, dist - reading.tailClear - reading.headClear - head)
    // MAGNITUDE IS PROPORTIONAL TO THE SHAFT, CAPPED (OB-107): a bow is meant to open
    // a gap between two lines, and a fixed px offset that reads as a gentle curve on
    // a long line is a semicircle on a short one. 0 draws the straight shaft.
    const bow = bowFor(signs[k], length)
    out.push({ i: k, dx, dy, worldDist, dist, angle, tailOffset, tailX, tailY, length, bow, reading })
  }
  return out
}

// ── OB-132: the pins the band keeps, with the reading they draw with ─────────

/** the fields of a band reading a map pin draws from — the rest case is
 *  `PIN_NO_POSITION` over in `walkpins.ts` */
export type PinBand = Pick<WalkBandReading, 'behind' | 'active' | 'pinOpacity' | 'pinScale'>

/** a pin that still draws, with its band reading */
export interface WalkPinDraw {
  pin: WalkPin
  /** the pin's index in walk order — the band's index and the driver's `data-pin`,
   *  preserved from the input array however many pins the band drops */
  index: number
  band: PinBand
}

/** EVERY PIN THAT STILL DRAWS, WITH THE BAND READING IT DRAWS WITH (OB-132).
 *  Every pin is a reading of the band: opacity is `pinOpacity` and the pop is
 *  `pinScale` — 1.36× as the walk arrives — while the pin's FACE (direction plus
 *  arrival) stays the component's. A pin outside the band draws NOTHING AT ALL,
 *  the owner's ruling, which is the drop below.
 *
 *  A route that is not the walk being played (a `bus.teach` curriculum) has no
 *  position and no band: `null`, and every pin draws at rest, `PIN_NO_POSITION`. */
export function walkPinBands(pins: readonly WalkPin[], pinPos: number | null): WalkPinDraw[] {
  const out: WalkPinDraw[] = []
  for (let index = 0; index < pins.length; index++) {
    const band = pinPos === null ? PIN_NO_POSITION : walkBand(index, pinPos)
    if (band.pinOpacity <= 0) continue
    out.push({ pin: pins[index], index, band })
  }
  return out
}
