// WHERE THE WALK'S NUMBERED PINS GO ON THE MAP — the whole decision, in one
// pure function, out of the component that draws it.
//
// It used to be two `useMemo`s inside `MapView` (`routeVis` and `routeStops`).
// It is here because four separate obligations have now rewritten the same
// arithmetic — OB-069's revisit rule, OB-087's crowding spread, OB-108's label
// clearance, OB-109's deep-level clamp — and each one had to be argued from a
// screenshot, because a memo closed over React state cannot be called with a
// walk and a level and asked what it would draw. The DS's house rule for this
// code says it plainly: two more items (OB-114, OB-132) are queued against it
// and "both rewrite whatever function builds the list of pins to draw". A named
// function is what stops the next one re-deriving this one.
//
// THE PIPELINE, AND WHY IT IS IN THIS ORDER. Every stage can move a pin, and
// each one can undo the one before it, so the order is the design:
//
//   1. RESOLVE      each stop to the cell that is actually on screen at this
//                   level (`walkAnchorAt`) — deep stops roll up to an ancestor,
//                   shallow ones clamp onto their own centroid.
//   2. MERGE        a contiguous run of stops on one cell becomes ONE pin spanning
//                   `step`..`stepEnd`; a later return to the same cell stays a
//                   separate pin (OB-069).
//   3. CROWD        how many pins are competing for the same piece of screen —
//                   which fixes the size they are all drawn at.
//   4. FAN          pins that want the exact same point get spread around it.
//   5. CLEAR LABELS nudge each pin off any name it would otherwise delete
//                   (OB-108). Runs after the fan, never before: run the other
//                   way round it takes a fanned pin and puts it back on the text.
//   6. SEPARATE     the guarantee, and it runs LAST because stages 4 and 5 are
//                   both allowed to move a pin toward its neighbour.
//
// STAGE 3 IS OB-128 AND IT REPLACES A NARROWER RULE. Crowding used to be counted
// per CELL: two pins were a crowd only if the map had resolved them to the same
// region. The DS's correction states the rule the other way round and says it is
// not to be read narrowly — "crowding is a property of the DRAWN POSITION, not
// of the node". Two stops on two different but adjacent cells are just as much
// on top of each other as two stops on one cell; the viewer cannot see which
// case they are looking at, and a rule keyed on identity cannot see the first.
// So the count is taken over pins whose discs would actually touch.
//
// STAGE 6 IS THE OTHER HALF OF THE SAME OBLIGATION, and it exists because
// counting correctly is not the same as drawing correctly. The fan and the label
// nudge each move pins for their own good reasons and neither checks the other's
// result — MapView's own comment admitted the hole ("in principle two spread
// pins could be pushed toward each other"). The done-when is a statement about
// the finished picture, so the check belongs at the end of the pipeline, where
// nothing can come after it and reintroduce the fault.

import { cellPolyOf, pinSpotClear, walkAnchorAt } from './atlas'
import type { XY } from './derive'
import type { LabelBox } from './labelfit'

/** the full-size pin, in real screen px. Every other size is this one shrunk. */
export const PIN_SIZE = 22
/** the floor a shrinking pin will not go below — smaller than this and a
 *  two-digit number stops being readable at all, which costs more than the
 *  crowding does. */
export const PIN_SIZE_MIN = 16
/** clear air between two pins that had to be pushed apart, in screen px. Zero
 *  would satisfy "no part of either circle inside the other" and still read as
 *  one blob with a seam; this is the smallest gap that reads as two marks.
 *
 *  A TARGET, NOT A FLOOR — the distinction matters when reading `separate`. The
 *  obligation's requirement is that no circle is inside another, which is a gap
 *  of zero; this is what the relaxation aims at, and in a chain it approaches it
 *  from below rather than reaching it exactly. Landing a millionth of a pixel
 *  short of 2 still clears the actual requirement by two whole pixels. */
export const PIN_GAP = 2

/** one pin, ready to draw. `c` is in the map's world coordinates; `size` is in
 *  real screen px, because that is what `StepDot` is built in. */
export interface WalkPin {
  key: string
  /** the cell this pin's stop resolved to at this level */
  visId: string
  /** 1-based index of the first walk stop this pin stands for */
  step: number
  /** 1-based index of the LAST stop it stands for — `step` itself unless the pin is a
   *  merged run. `pinPosition` reads both: a walk anywhere inside the run is ON this pin. */
  stepEnd: number
  c: XY
  size: number
}

export interface WalkPinInput {
  /** the walk, as ordered corpus node ids — `bus.route` */
  route: string[]
  /** the map's current nesting level */
  level: number
  /** real screen px -> world units at the current zoom. The pins are sized in
   *  screen px and positioned in world units, so every distance compared here
   *  has to cross that boundary exactly once. */
  px: (v: number) => number
  /** every name drawn at this level, as boxes — what a pin has to stay off */
  labelBoxes: LabelBox[]
}

/** the size a pin takes when `n` pins are competing for the same spot. OB-087's
 *  formula, unchanged — only what feeds `n` has changed (see stage 3). */
export const pinSizeFor = (n: number): number => Math.max(PIN_SIZE_MIN, PIN_SIZE - (n - 1) * 3)

interface Resolved {
  visId: string
  c: XY
  step: number
}

interface Merged {
  visId: string
  c: XY
  steps: number[]
}

// ── stage 1: resolve ────────────────────────────────────────────────────────
/** each stop's cell at this level, in walk order. Stops the map cannot place at
 *  all are dropped. `walkAnchorAt` carries the whole rule, including OB-109's
 *  clamp for a stop shallower than the level — spelled out in atlas.ts. */
function resolved(route: string[], level: number): Resolved[] {
  const out: Resolved[] = []
  for (let i = 0; i < route.length; i++) {
    const anchor = walkAnchorAt(route[i], level)
    if (anchor) out.push({ visId: anchor.visId, c: anchor.c, step: i + 1 })
  }
  return out
}

// ── stage 2: merge ──────────────────────────────────────────────────────────
/** OB-069, settled by the DS after a pill, a corner badge and an inline digit
 *  all failed legibility on a 24px mark (2026-08-22). A CONTIGUOUS run of stops
 *  sharing a cell is ONE pin with a range label, never three circles stacked on
 *  one point. A NON-adjacent return to a cell already pinned is always a SECOND
 *  pin, never a merged mark. The two cases are told apart by ADJACENCY, which is
 *  why this walks the list in order rather than bucketing by cell. */
function merged(stops: Resolved[]): Merged[] {
  const out: Merged[] = []
  for (const s of stops) {
    const last = out[out.length - 1]
    if (last && last.visId === s.visId) last.steps.push(s.step)
    else out.push({ visId: s.visId, c: s.c, steps: [s.step] })
  }
  return out
}

// ── stage 3: crowd ──────────────────────────────────────────────────────────
/** which pins are competing for the same piece of screen, as a crowd id per pin.
 *  Two pins are in the same crowd when their FULL-SIZE discs would touch;
 *  crowding is transitive, so a line of three overlapping pins is one crowd of
 *  three rather than two crowds of two.
 *
 *  MEASURED AT FULL SIZE ON PURPOSE, and it has to be: the size is what this
 *  count decides, so testing at the shrunk size would be circular — a crowd
 *  would shrink until it no longer counted as a crowd and then grow back. Full
 *  size is also the honest question, since that is what the pins would be drawn
 *  at if nothing were done about them. */
export function crowdIds(at: XY[], px: (v: number) => number): number[] {
  const touching = px(PIN_SIZE) // centre-to-centre distance at which full-size discs meet
  const owner = at.map((_, i) => i)
  const find = (i: number): number => (owner[i] === i ? i : (owner[i] = find(owner[i])))
  for (let i = 0; i < at.length; i++)
    for (let j = i + 1; j < at.length; j++)
      if (Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y) < touching) owner[find(i)] = find(j)
  return at.map((_, i) => find(i))
}

// ── stage 6: separate ───────────────────────────────────────────────────────
/** THE GUARANTEE. Pushes overlapping pins apart until none intersect, half the
 *  overlap each so neither pin of a pair is privileged over the other.
 *
 *  Iterative because separating one pair can push a pin into a third: a single
 *  straight pass would fix the pairs it visits and create new ones behind it. It
 *  settles in a handful of rounds for any crowd a walk actually produces, and
 *  the cap is there so a pathological arrangement costs a bounded amount of work
 *  rather than spinning — two pins still touching is a far smaller fault than a
 *  frame that never renders.
 *
 *  A pin can be pushed back onto a name stage 5 cleared it from, and in a tight
 *  cell it can be pushed past the cell's own edge. Both are accepted, in that
 *  order of preference: the obligation's done-when is about circles not
 *  overlapping, and OB-108's own mechanism already gives up rather than shoving
 *  when it cannot find room. Two pins merged into one blob is the fault a reader
 *  cannot recover from — they cannot even tell there are two.
 *
 *  Mutates `pins` in place; it is the last stage and owns them by then. */
const SEPARATE_ROUNDS = 12
export function separate(pins: WalkPin[], px: (v: number) => number): void {
  for (let round = 0; round < SEPARATE_ROUNDS; round++) {
    let moved = false
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i]
        const b = pins[j]
        const need = px((a.size + b.size) / 2 + PIN_GAP)
        const dx = b.c.x - a.c.x
        const dy = b.c.y - a.c.y
        const d = Math.hypot(dx, dy)
        if (d >= need) continue
        moved = true
        // exactly coincident pins have no direction to be pushed along, so one
        // is invented from the pair's own indices — deterministic, so the same
        // walk at the same level always draws the same picture.
        const th = (Math.PI * 2 * (i * 31 + j * 17)) / 97
        const ux = d > 1e-6 ? dx / d : Math.cos(th)
        const uy = d > 1e-6 ? dy / d : Math.sin(th)
        const push = (need - d) / 2
        a.c = { x: a.c.x - ux * push, y: a.c.y - uy * push }
        b.c = { x: b.c.x + ux * push, y: b.c.y + uy * push }
      }
    }
    if (!moved) return
  }
}

// ── the whole thing ─────────────────────────────────────────────────────────
export function walkPins({ route, level, px, labelBoxes }: WalkPinInput): WalkPin[] {
  if (route.length === 0) return []
  const groups = merged(resolved(route, level))
  if (groups.length === 0) return []

  // 3 — crowd, off the cells' own centres, before anything has been moved
  const crowdOf = crowdIds(
    groups.map((g) => g.c),
    px,
  )
  const crowdSize = new Map<number, number>()
  for (const id of crowdOf) crowdSize.set(id, (crowdSize.get(id) ?? 0) + 1)

  // 4 — fan the pins that want the SAME point. Only exact coincidence, which in
  //     practice means several separate visits to one cell: an evenly-spaced arc
  //     around the shared centre (OB-087). Pins that merely landed NEAR each
  //     other keep their own cell's centre and are dealt with by stage 6 —
  //     arcing them around a point between their cells would drag each one off
  //     the territory it names, and a pin outside its own cell is a worse lie
  //     than a crowded one.
  const spotKey = (c: XY) => `${c.x.toFixed(4)},${c.y.toFixed(4)}`
  const sameSpotTotal = new Map<string, number>()
  for (const g of groups) sameSpotTotal.set(spotKey(g.c), (sameSpotTotal.get(spotKey(g.c)) ?? 0) + 1)
  const placedAtSpot = new Map<string, number>()

  const pins: WalkPin[] = groups.map((g, i) => {
    const size = pinSizeFor(crowdSize.get(crowdOf[i])!)
    const spot = spotKey(g.c)
    const together = sameSpotTotal.get(spot)!
    let c = g.c
    if (together > 1) {
      const idx = placedAtSpot.get(spot) ?? 0
      placedAtSpot.set(spot, idx + 1)
      const angle = (2 * Math.PI * idx) / together - Math.PI / 2
      const radius = px(size * 1.3 + 6) // clears a same-size neighbour, plus a gap
      c = { x: g.c.x + Math.cos(angle) * radius, y: g.c.y + Math.sin(angle) * radius }
    }
    // 5 — EVERY LABEL DRAWN AT THIS LEVEL, not just this cell's own. Past the
    //     level where a stop owns a cell its own label is gone and its
    //     CHILDREN's names are what the pin can land on — same fault, different
    //     owner. `pinSpotClear` does the proximity filtering; handing it the
    //     whole set keeps the decision about which labels count in one place.
    c = pinSpotClear(c, cellPolyOf(g.visId, g.c), labelBoxes, px(size / 2))
    // WHAT THE PIN PRINTS IS NOT DECIDED HERE. Until DS OB-188 (2026-09-15) this
    // minted a top-level step number or a hyphenated range; the map now prints the
    // stop's two-number ADDRESS (`walkMarkLabel` over the walk's steps), so the
    // pin carries only the stop indices the label is composed from.
    return { key: `${g.visId}-${g.steps[0]}`, visId: g.visId, step: g.steps[0], stepEnd: g.steps[g.steps.length - 1], c, size }
  })

  separate(pins, px)
  return pins
}

// ── the walk's position, in PINS ────────────────────────────────────────────
/** WHERE THE WALK IS, COUNTED IN PINS RATHER THAN STOPS — what the map's band reads
 *  (DS OB-132). The DS's `walkBand(index, position)` is written for one mark per stop. A
 *  pin here can stand for a RUN of stops (a merged "4-7" at a coarse level, stage 2), and a
 *  stop the map cannot place is dropped from the pins altogether (stage 1). So the band is
 *  read in PIN units: a position anywhere inside a pin's run is ON that pin — distance 0,
 *  the whole run is "you are here" — and a position between two pins' runs is the same
 *  fraction of the way between the two PINS, which is what carries the arrow between them.
 *  At a level fine enough for one pin per stop this is the identity and the map reads
 *  exactly the DS's rule. `position` is the player's 0-based fractional stop;
 *  `step`/`stepEnd` are 1-based. ★ LOCAL, reported on the receipt. */
export function pinPosition(pins: readonly { step: number; stepEnd: number }[], position: number): number {
  if (pins.length === 0) return 0
  const s = position + 1
  for (let k = 0; k < pins.length; k++) {
    const p = pins[k]
    if (s > p.stepEnd) continue
    if (s >= p.step || k === 0) return k
    const prev = pins[k - 1]
    return k - 1 + (s - prev.stepEnd) / (p.step - prev.stepEnd)
  }
  return pins.length - 1
}

/** A ROUTE THAT IS NOT A WALK HAS NO POSITION — a `bus.teach` curriculum draws pins, but
 *  nobody is walking it — and so no band: every pin at full opacity and rest size, ahead of
 *  nobody. These are the four fields the map reads off `walkBand()`. ★ LOCAL: the DS's band
 *  has no "no walk" case, because its host never draws a route it is not playing. */
export const PIN_NO_POSITION = { behind: false, active: 0, pinOpacity: 1, pinScale: 1 } as const
