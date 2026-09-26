import type { CSSProperties } from 'react'

import { wrapTip } from '../chrome/IconButton'
import { chipBorder } from './NodeChip'
import { fitLines } from './textFit'

/** the label-fitting function `NodeArrow fill` uses, re-exported from the helper file it lives
 *  in — moved out of `RelationCards`' private copy upstream on 2026-08-28, so a pill's label and
 *  an arrow's label fit through ONE function rather than two that can drift. Re-exported here
 *  and not only from `textFit`, because that is where the DS publishes it. */
export { fitLines } from './textFit'
export type { FitLinesOptions } from './textFit'

/** The arrow between two nodes — sequence, not a typed relation. Port of DS
 *  components/graph/NodeArrow.jsx. Drawn in SVG so shapeRendering snaps the
 *  shaft to one device pixel, avoiding the antialiasing thickness variation that
 *  CSS box-based shafts produce at different fractional offsets.
 *
 *  IMPORTS ONE WAY: this file reads `chipBorder` from `NodeChip` and `NodeChip` never
 *  reads back. The weights travel from the chip that DRAWS the border to the line that
 *  ANSWERS it. */

/** THE RULE, AS A FUNCTION: A CONNECTOR IS DRAWN AT THE BORDER WEIGHT OF WHAT IT CONNECTS,
 *  NEVER ABOVE IT. The nodes are the objects; a line between them is a statement about them,
 *  so it is never the heaviest mark in the row. Hand it the `mark` of the chips at the ends
 *  and it returns the shaft weight that matches their border — so no caller ever types 1.5
 *  or 1.25, and a reviewer can grep for a stroke literal at a call site instead of eyeballing
 *  weights. Change a chip's form and the lines meeting it re-weight themselves.
 *
 *  ANYTHING THAT IS NOT ONE OF THE FOUR CHIP FORMS answers with a number, and there are two
 *  ways to get one without typing it. A component an arrow can meet DECLARES what its edge
 *  weighs as a static — `NodeChip.joinBorder`, `VersionedGroup.joinBorder` — and a container
 *  reads it. Everything else, a host's own box included, passes the width it renders.
 *
 *  A NODE WITH NO BORDER AT ALL passes 0 and gets 1.25 — the lightest step, never a
 *  zero-width line. There is no stroke to match, so the question becomes what a line beside
 *  the quietest thing in the system may weigh, and that is what a 1px border gets. An OPEN
 *  `VersionedGroup` card is exactly this case (its edge is transparent until folded) and
 *  lands on 1.25 either way. Do NOT read a missing border as "no constraint" and take the
 *  full-rank default: a borderless box is the LEAST able to carry a heavy line beside it.
 *
 *  IT TAKES A NUMBER — the border width, in px, of a node that is not one of our chips. That
 *  is still a MEASUREMENT and not a taste: you are reporting what sits at the ends of your
 *  line, exactly as a mark name does, and the same rule picks the weight. What it is NOT is a
 *  way to make one surface a little firmer than the rest. If the number you are about to pass
 *  is not the border width you render, it does not belong here.
 *
 *  WHY 1px IN BECOMES 1.25 OUT — MATCHING THE NUMBER IS NOT MATCHING THE MARK. A 1px CSS
 *  border takes the browser's own rounding; a 1px rect with `crispEdges` snaps to the device
 *  grid. At dpr 1.5 the steps are about 0.67 / 1.33 / 2.0 css px, so a flat 1 lands a step
 *  BELOW the border it is meant to match, reads as a divider, and fades
 *  `--edge-depends-on` — the quietest of the four relation hues — out from under
 *  `implemented_with`. This is the one place that correction lives. Keep the fraction. */
export function shaftFor(mark?: ChipForm | number): number {
  const w = typeof mark === 'number' ? mark : chipBorder(mark)
  return w <= 1 ? 1.25 : w
}

/** the four chip forms a line can meet, by name */
export type ChipForm = 'dot' | 'border' | 'border-2' | 'none'

/** THE SHAFT BETWEEN FULL-RANK `mark="border"` CHIPS — `--stroke-rule`, 1.5. A chain's and a
 *  road's case, which is why it is the default. `shaftFor` is the general answer; this is its
 *  common value, exported so a port cannot retype it. `EdgeEntry` joins the 1px `border-2`
 *  form and draws 1.25 (`EDGE_SHAFT_STROKE`) — a different weight for a different neighbour,
 *  not a lighter kind of arrow.
 *
 *  THE OPEN CASE: an arrow between two `border-2` chips would outweigh the 1px borders it
 *  joined. Nothing draws that today. If it appears the answer is a third constant chosen by
 *  the form — never a weight prop, which would make the heaviest mark in a row a call-site
 *  decision. */
export const SHAFT_STROKE = shaftFor('border')

export interface NodeArrowProps {
  /** 'down' for a stacked chain (the default), 'right' for a row */
  direction?: 'down' | 'right'
  /** the shaft, in px, before the head. Default 14 */
  length?: number
  /** 'walk' (acorn — movement through the corpus, the default), 'quiet'
   *  (bark-400), 'hint' (bark-300). Never a --domain-* or --edge-* hue */
  tone?: 'walk' | 'quiet' | 'hint'
  /** conditional: an optional step, a gap awaiting a node. Dashed never decorates */
  dashed?: boolean
  /** an explicit paint, for the rare case a caller owns the colour */
  color?: string
  /** give the arrow a title and it stops being decorative to a screen reader */
  title?: string
  /** WHAT THIS LINE MEETS — and NOT a weight prop, however much it looks like one sitting
   *  beside `length` and `tone`. It names the chip FORM at the ends of the line, or gives the
   *  measured border width in px of a node that is not one of our chips. Either way it is a
   *  fact about the SURROUNDINGS rather than a preference, so it cannot be set for the wrong
   *  reason and no stroke number ever appears at a call site; `shaftFor` turns it into the
   *  weight. `NodeChain` fills it in from the chips it places, so a chain needs nothing.
   *  The test for any value passed here: is it the border you actually render? */
  joins?: ChipForm | number
  /** A SIGNED px OFFSET OF THE SHAFT'S OWN MIDPOINT, perpendicular to its axis — bows the
   *  line into a curve instead of drawing it straight, and the head follows the curve's own
   *  tangent at the tip rather than staying axis-aligned. Default 0: the straight `<line>`
   *  the DS's own cards read `stroke-width` and head bbox off, unchanged.
   *
   *  FOR A HOST ROUTING ARBITRARY LINES ONLY — the map's case (`direction="right"` plus its
   *  own rotate transform: the mark draws itself, the host owns position and angle). NOT for
   *  `NodeChain`'s fixed-gap arrows, which have nothing to route around; passing it there
   *  bows the resolved road for no reason.
   *
   *  Why the mark owns this rather than the host drawing its own bezier: a curved shaft still
   *  needs a head that reads as pointing where the line ARRIVES, so the head's angle has to
   *  track the tangent — the same reasoning `ARROW_METRICS` already applies to the head's
   *  size. One copy of that arithmetic, not two kept in step by hand.
   *
   *  A NEGATIVE BOW ALSO MOVES THE SHAFT inside the drawing (the box grows on the side the
   *  curve bulges toward), so a host placing arrows absolutely must offset by
   *  `shaftTailOffset` or the same magnitude bowed either way will not be symmetric about
   *  the line it is drawn on. */
  bow?: number
  /** THE HALO — `--surface-raised` behind the shaft and the head, so the arrow reads against
   *  ANY fill under it and not only against this system's own paper. FOR A HOST ROUTING
   *  ARBITRARY LINES OVER ARBITRARY FILLS ONLY, the same split as `bow`; a chain gap sits on
   *  `--surface-paper` already and never passes it. Fixes CONTRAST, NOT SIZE — head and shaft
   *  keep their own paint and dimensions — which is why it answers a SHORT arrow (two
   *  adjacent territories) as fully as a long one. Works with `bow`; the casing follows the
   *  curve too. Default false. */
  casing?: boolean
  /** THE HEAD THIS ARROW MUST DRAW, when a view has computed one head for a whole SET of
   *  arrows. Takes `headForSet`'s result verbatim and overrides this arrow's own
   *  `headFor({ joins, length })`. `shaftTailOffset` takes it too — a set-sized head with a
   *  per-arrow tail puts the shaft off the centre of its own box.
   *
   *  WAS ★ LOCAL, and is not any more (DS OB-150, adopted 2026-09-11). `headForSet`'s whole
   *  contract is "call it ONCE per view and pass the result to all of them", and this arrow had
   *  no prop that could accept a head — so every arrow re-derived its own from its own length,
   *  which is exactly the emphasis fault `headForSet` exists to remove. We added the prop here
   *  to satisfy OB-126 clause (5) and reported it; the design system took the shape verbatim,
   *  so the local copy is deleted rather than reconciled. */
  headSize?: { head: number; halfWidth: number }
  /** HOW MUCH OF THIS ARROW HAS BEEN WALKED, 0…1 (DS OB-132: `walkArrow().walked`).
   *  Undefined draws exactly what this component always drew, so no existing caller moves.
   *  Given, the shaft is drawn in two paints — the walked part in `walkedTone` from the tail,
   *  the rest in `tone` at `aheadOpacity` — and THE HEAD RIDES THE SPLIT: strictly between 0
   *  and 1 it sits at the walked point, in the walked paint, travelling along the line as the
   *  walk plays; at 0 it is the resting head in `tone`, at 1 the resting head in
   *  `walkedTone`. The DS's reference rig (guidelines/walk-strip-compact.html) draws this as
   *  two dashed paths and a head placed by getPointAtLength; here the two paints are dash
   *  offsets over one `pathLength`, and the head is placed from the arc-length arithmetic
   *  the bow's own tangent already needs.
   *
   *  UNDEFINED IS THE PLAIN ARROW, AND THAT IS A CALLER RULE RATHER THAN A DEFAULT. An arrow
   *  the walk has NOT entered passes no `walked` at all (with `tone="quiet"` if it should
   *  recede), because 0 means something else: the walk standing exactly at this arrow's tail,
   *  head at the tail, nothing acorn yet. Reading 0 as "not entered" would put the head at the
   *  far end at w=0 and at the near end at w=0.01 — a jump of the whole shaft on the
   *  animation's first frame. Our own map was passing 0 at rest until 2026-09-11; see
   *  `src/model/walkarrow.ts`.
   *
   *  THE GATE FOR WHETHER TO PASS IT AT ALL IS `walkArrow(...).headAcorn` (`map/WalkDock`), and
   *  that is the HOST'S ENTRY TEST rather than a drawing instruction (DS OB-175, 2026-09-14). So
   *  the two files read as if they disagreed at 0 and do not: this component's rule is total and
   *  continuous over every value it can RECEIVE, while the recipe decides which arrows receive
   *  one at all. Read either file alone and the disagreement looks real — which is how this port
   *  once put an acorn head on the TAIL of every arrow the walk had not reached, caught by the
   *  browser suite rather than by reading (OB-159; `receipts/bd56bb0.md`).
   *
   *  COULD THIS COMPONENT JUST DO IT? No, and that is settled rather than left open: an arrow
   *  cannot know whether the walk has entered it — that is the host's fact about the walk, not a
   *  fact about the arrow — so it stays a caller rule. One of the three kinds that resist.
   *
   *  WAS ★ LOCAL, and is not any more (DS OB-159, adopted 2026-09-11). The design system
   *  published the recipe with no arrow that took it — `walkArrow` returns `walked`,
   *  `headTravels`, `headAcorn` and `aheadOpacity` for a host to draw, and their reference rig
   *  draws them in raw SVG, while this map draws its walk with THIS component (OB-069). We grew
   *  the three props here and reported them; they were adopted verbatim, names, defaults and
   *  arc table, so the two files converge instead of diverging twice. */
  walked?: number
  /** the walked part's paint. 'walk' (acorn) unless the whole walk is receded (OB-117). */
  walkedTone?: 'walk' | 'quiet' | 'hint'
  /** the UNWALKED part's opacity, relative to the arrow — `walkArrow().aheadOpacity` over its
   *  `.opacity`, i.e. `1 − walked · aheadFade`: the part ahead drops as the head passes. */
  aheadOpacity?: number
  /** THE FILL VARIANT — a horizontal connector that FILLS its row instead of drawing a fixed
   *  pixel span, added upstream 2026-08-28 for `RelationCards`' relationship rows: a card's row
   *  width is only known at layout time, unlike a walk's fixed chain gap. Every prop below this
   *  one applies ONLY when `fill` is true, and `direction`, `length`, `joins`, `bow`, `casing`,
   *  `headSize` and the three `walked` props are the fixed-span variant's own and do nothing
   *  here. Default false, which keeps every existing caller — `NodeChain`, the road, the map —
   *  on the original SVG drawing, unchanged. */
  fill?: boolean
  /** the corpus's own wording for this relationship (`kindLabel`), floated ABOVE the shaft so a
   *  wrapped label never pushes the line down. Fitted with `fitLines` against `width`, never
   *  against `ARROW_METRICS.fillMin` — pass the real column width or the label wraps early */
  label?: string
  /** the column width available to this arrow — used to fit `label` and, on the fill variant,
   *  as the arrow's own flex/measurement basis. Omit and it falls back to `ARROW_METRICS.fillMin` */
  width?: number
  /** THE SEVERAL-ARROWS-INTO-ONE-PILL LAYOUT: `width: 100%` plus `minHeight`, in place of the
   *  lone arrow's `flex: 1 0 fillMin` / `minHeight: 34`. NOT cosmetic — the default root's flex
   *  basis is a WIDTH, and inside a column CSS reads a basis as a HEIGHT, so an unflagged arrow
   *  in a stack sizes its own height off a width constant. Pass `minHeight` alongside it; there
   *  is deliberately no built-in default for the pair, because the spacing that makes a stack
   *  read as belonging to one pill (`REL_CARD_METRICS`' `blockGap`/`arrowStacked` ratio) is that
   *  caller's rhythm decision and not a fact about arrows */
  stacked?: boolean
  /** overrides the fill variant's own default box height (34 unstacked, none stacked — see
   *  `stacked`). The caller's rhythm decision; this component supplies no stacked default */
  minHeight?: number
  /** the fill variant's arrowheads: 'out' (target end only, the default), 'in' (source end
   *  only), 'both' (a symmetric relation such as `see_also`). The fixed-span variant always
   *  draws one head, at the direction it travels; this prop does nothing there */
  heads?: 'out' | 'in' | 'both'
}

const TONE: Record<string, string> = {
  walk: 'var(--accent-walk)',
  quiet: 'var(--bark-400)',
  hint: 'var(--bark-300)',
}
const DASH = '4 4'

/** THE DRAWN GEOMETRY, published so a board that positions arrows ITSELF can align them
 *  without re-deriving these numbers. The DS does not lay arrows out either — it puts one
 *  in each gap of a NodeChain, which owns both ends — but it now exports this (OB-053): the
 *  same four keys and the same values this file already carried, so the port is a docblock
 *  change rather than a rewrite. A board like the road computes every box arithmetically in
 *  one pass and places each arrow absolutely, so it needs the head's length (to turn a gap
 *  into a `length`) and the cross-axis extent (to centre the shaft on the column). Same
 *  shape as NodeChip's `chipSize` and VersionedGroup's `GROUP_METRICS`. */
export const ARROW_METRICS = {
  /** the head's length along the shaft at the PUBLISHED STUB — weight 1.5, length 14. An
   *  arrow's total span is `length + head`.
   *
   *  THIS IS A SAFE UPPER BOUND ONLY WHEN A `length` IS UNKNOWN, and the sentence it replaces
   *  was false (OB-126). That sentence said a lighter `joins` draws a smaller head "never a
   *  larger one, so a board sizing off this constant always has room" — true only for shafts
   *  LIGHTER than full rank, which is all the OB-067 scaling contemplated. A HEAVIER shaft
   *  scales the head UP: the map's own 4px pin ring over a 450px hop drew a 21px head 23.5px
   *  across off exactly this number, a spearhead on a hairline curve. Ask `headFor({ joins,
   *  length })` for the head that will actually be drawn. */
  head: 8,
  /** the head's half-width at the full-rank shaft weight, either side of the shaft — the
   *  same reservation as `head`. */
  halfWidth: 4.4,
  /** the shaft's stroke width for the COMMON case — the full-rank `border` chips a road
   *  and a chain join. Reads `SHAFT_STROKE` rather than repeating 1.5, so the literal this
   *  file used to carry is gone: a gap that meets something else asks `shaftFor` for its own
   *  weight and does not come here. */
  stroke: SHAFT_STROKE,
  /** the cross-axis extent of the whole drawing; the shaft sits at `across / 2` ONLY in the
   *  plain case (full rank, no casing, no bow, short) — `shaftTailOffset` is the real answer */
  across: 4.4 * 2 + 3,
  /** THE FILL VARIANT'S OWN FLOOR — how narrow a filling connector may draw before a head and
   *  a shred of shaft stop reading as an arrow at all. Independent of any `arrowMin`-shaped
   *  number a caller's layout maths derives (`REL_CARD_METRICS.arrowMin` is the connections
   *  card's own, and happens to agree): this is what `NodeArrow fill` falls back to when no
   *  `width` is passed at all. Only the fill variant reads it. */
  fillMin: 38,
  /** THE HEAD'S CEILING ON A LONG LINE, as a fraction of the shaft's own `length`. CHOSEN,
   *  not derived (OB-126). The head is sized off the shaft's WEIGHT, which was the whole story
   *  while every caller drew a 14px gap between two chips. On a long routed line it is the
   *  wrong input: `head: 8` against `stroke: 1.5` is a head 5.9× its shaft's width, and that
   *  ratio is RIGHT for a stub, where the head IS the arrow and the shaft is barely there.
   *  Carried onto a 4px shaft over 450px it draws a symbol sitting on a curve rather than a
   *  terminator on a line. A long shaft does not need a proportionally large head, because the
   *  line is already unmissable; the head only has to end it. 0.03 puts a 450px line on a
   *  13.5px head 14.9px across — 3.7× its shaft. Tune the LOOK upstream; no arithmetic forces
   *  0.03. */
  /** THE ARC-LENGTH TABLE the walked split reads on a BOWED arrow, in pieces. CHOSEN, and the
   *  number is ours (`receipts/d9d5288.md`): 32 chords over a quadratic this shallow put the
   *  seam within a fraction of a pixel of its true arc position, which is finer than the head
   *  drawn on it can show. The straight case needs no table — the seam is `length * walked`.
   *  Published upstream at OB-159 so the two sides read one number instead of each picking its
   *  own and drawing seams that creep against each other mid-animation. */
  walkedSeamSegments: 32,
  headLengthMax: 0.03,
} as const

/** THE DRAWN HEAD — `{ head, halfWidth }` for the arrow about to be rendered, which is what
 *  `ARROW_METRICS` only describes at the published stub.
 *
 *  TWO INPUTS PULLING OPPOSITE WAYS. The shaft's WEIGHT (`joins`) scales the head up: a heavy
 *  line needs a head that can terminate it. The shaft's LENGTH caps it: a long line is already
 *  unmissable, so its head only has to end it.
 *
 *  OMIT `length` AND YOU GET THE UPPER BOUND, deliberately, rather than a default standing in
 *  for a real number: the cap can only ever reduce the head, so a board reserving space before
 *  it knows its own span gets a box no drawing will overflow. Pass `length` for the drawn
 *  value — and the SAME `length` to `shaftTailOffset`, which reads `halfWidth` from here. */
export function headFor(
  opts: { joins?: ChipForm | number; length?: number } = {},
): { head: number; halfWidth: number } {
  const { joins, length } = opts
  const T = joins !== undefined ? shaftFor(joins) : SHAFT_STROKE
  const proportional = ARROW_METRICS.head * (T / SHAFT_STROKE)
  /* min against max(published, cap) rather than against the cap alone, so the ceiling never
     bites a SHORT line: at length 14 the cap is 0.42px and the published 8px head stands. */
  const cap = length === undefined ? Infinity : Math.max(ARROW_METRICS.head, length * ARROW_METRICS.headLengthMax)
  const head = Math.round(Math.min(proportional, cap) * 100) / 100
  /* the triangle keeps its proportions: halfWidth follows the head's OWN final ratio, not the
     shaft's, so a capped head is a smaller version of the same arrowhead. */
  return { head, halfWidth: Math.round(ARROW_METRICS.halfWidth * (head / ARROW_METRICS.head) * 100) / 100 }
}

/** ONE HEAD FOR A SET OF ARROWS DRAWN TOGETHER — pass every shaft length in the picture and
 *  give the answer to all of them. A view that draws MANY arrows at once must not let
 *  `headFor` size each one off its own length.
 *
 *  WHY, and it is the opposite failure to the one the cap was written for. The cap fixes a
 *  LONE long line, where a head sized off weight alone becomes a spearhead. Read across a SET
 *  at one weight it does something else: head size becomes a function of length, and length is
 *  already drawn by the line. On this map's own walk, hops under ~267px take the published 8px
 *  head and hops over ~427px take the full 12.8px — 2.5× the triangle's AREA, on arrows that
 *  mean exactly the same thing, and a reader takes a bigger head as EMPHASIS.
 *
 *  THE ANSWER IS THE SMALLEST HEAD THE SET ALLOWS, not an average and not a chosen constant:
 *  every arrow then carries a head its own shaft could have carried, so the set is uniform
 *  without any single arrow being overdrawn. A set containing one short hop resolves to
 *  `ARROW_METRICS.head` (8). Averaging was rejected — it lets a short arrow wear a head too big
 *  for it, the fault the cap exists to prevent.
 *
 *  Call it ONCE per view and pass the result to every arrow through `headSize`. */
export function headForSet(
  opts: { joins?: ChipForm | number; lengths?: number[] } = {},
): { head: number; halfWidth: number } {
  const { joins, lengths } = opts
  if (!lengths || lengths.length === 0) return headFor({ joins })
  let best: { head: number; halfWidth: number } | null = null
  for (const L of lengths) {
    const h = headFor({ joins, length: L })
    if (best === null || h.head < best.head) best = h
  }
  return best!
}

/** THE SHORTEST SHAFT THAT STILL READS AS AN ARROW, and it is a RATIO: `minHeads` head lengths,
 *  not a pixel count (DS OB-197). Owner-reported 2026-09-16, on this app's map — a relation
 *  between two ADJACENT territories is clipped to their shared boundary, so the two clearances
 *  leave a stub a few units long, and at the map's weight the head is then most of the drawing:
 *  "the head is way too big, also when the arrow is so short its really hard to read the arrow
 *  at all".
 *
 *  WHY A RATIO AND NOT A NUMBER. The map draws in its own units and the room looks at it through
 *  a zoom, so a px minimum is a different arrow at every scale — the mistake `headLengthMax` was
 *  written as a fraction to avoid at the other end. The head's own length is the one measure
 *  already in the drawing's own space, and it is what makes a shaft read as a shaft: below about
 *  three head-lengths the triangle stops terminating a line and becomes the line.
 *
 *  CHOSEN, NOT DERIVED: 3. Judged at 1:1 against the shipped stub on the DS's
 *  `guidelines/short-relation-arrow.html`, where the shaft length is a slider.
 *
 *  WHAT IT IS NOT: a length to draw every arrow at. It is a FLOOR. A line longer than this is
 *  untouched, and nothing here may ever shorten one. */
export const ARROW_MIN_SHAFT_HEADS = 3
export function minShaft(
  opts: { joins?: ChipForm | number; headSize?: { head: number; halfWidth: number }; minHeads?: number } = {},
): number {
  const { joins, headSize, minHeads } = opts
  const head = (headSize ?? headFor({ joins })).head
  const k = minHeads === undefined ? ARROW_MIN_SHAFT_HEADS : minHeads
  return Math.round(head * k * 100) / 100
}

/** THE TWO ENDPOINTS, PUSHED BACK UNTIL THE SHAFT CLEARS THAT FLOOR — the owner's own fix for the
 *  stub above, as arithmetic rather than as a sentence: "is it possible it could make the arrows
 *  longer? like it doesn't have to land on the absolute edge of either node's territories?"
 *
 *  Give it the two points a host clipped to its regions' edges and it returns the pair to draw:
 *  each end moved back along the line by HALF the shortfall, so the line grows symmetrically and
 *  its midpoint — where a label sits — does not shift. `{ from, to, length, grew }`; `grew` is
 *  false when the line was already long enough, when `min` is 0, or when the two points coincide
 *  (there is no direction to extend along, and a host cannot be handed a guess).
 *
 *  WHAT IT GIVES UP, said plainly because it is the cost of the fix: the ends no longer touch the
 *  exact boundary between the two regions. That was never information a map like this could
 *  carry — a territory is a region, not a point — and the alternative (shrinking the head on a
 *  short line) would have taken the head off every 14px chain arrow, where the head IS the arrow.
 *
 *  THREE CALLER RULES this cannot enforce:
 *   - EXTEND INTO BOTH REGIONS, never one. An asymmetric extension moves the midpoint, which moves
 *     the label, which is the one part of a relation line a reader reads.
 *   - THE OVERLAP IS ALLOWED TO CROSS INTO A NEIGHBOUR. On a small cell the shortfall is bigger
 *     than the region it is pushed into; accept it — the arrow's meaning is the PAIR it joins.
 *   - SIZE ONE HEAD FOR THE SET BEFORE ASKING FOR THE MINIMUM. The floor follows the head, so
 *     per-arrow heads give a per-arrow floor, and a set of arrows meaning the same thing ends up
 *     drawn at several lengths for no reason a reader can see. */
export function extendToMin(
  opts: { from?: { x: number; y: number }; to?: { x: number; y: number }; joins?: ChipForm | number; headSize?: { head: number; halfWidth: number }; minHeads?: number; min?: number } = {},
): { from: { x: number; y: number }; to: { x: number; y: number }; length: number; grew: boolean } {
  const { from, to, joins, headSize, minHeads, min } = opts
  const a = from ?? { x: 0, y: 0 }
  const b = to ?? { x: 0, y: 0 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  const floor = min === undefined ? minShaft({ joins, headSize, minHeads }) : min
  if (!length || length >= floor || floor <= 0) return { from: a, to: b, length, grew: false }
  const k = (floor - length) / 2 / length
  return {
    from: { x: a.x - dx * k, y: a.y - dy * k },
    to: { x: b.x + dx * k, y: b.y + dy * k },
    length: floor, grew: true,
  }
}

/** HOW FAR OFF ITS OWN LINE A BOWED HEAD MAY POINT — the cap the `bow` prop never had, and the
 *  second half of the short-relation fault the floor above fixes the first half of (DS OB-197,
 *  2026-09-16). Owner-reported on this app's map, focusing a node: "the arrow heads look a bit
 *  weird, like they have 2 arrow heads overlapped on top of each other".
 *
 *  WHY A BOW IS ONLY LEGIBLE AS A RATIO. The head's rotation on a bowed shaft is the quadratic's
 *  end tangent, `atan(2 * bow / length)` — in THIS component (`dv = mid - ctrl`) and in the map's
 *  own relation layer alike. A CONSTANT sagitta is a gentle 24-degree curve on a 64-unit chord
 *  and a 70-degree hairpin on a 10-unit stub, whose whole drawing is then a head pointing
 *  sideways into the fill beside the neighbouring line's head — "two heads overlapped".
 *
 *  CHOSEN, NOT DERIVED: 20 degrees, judged at 1:1 on the DS's `guidelines/bow-cap-probe.html`.
 *  At 30 a 10-unit stub still curls into a hook; at 12 the bow stops separating anything on the
 *  medium lines it exists for. The BOW is derived from it: `|bow| <= tan(maxDeg) * length / 2`.
 *
 *  A CAP, NEVER A LENGTH TO BOW AT: a bow already inside it comes back untouched, and the sign is
 *  kept. Length 0 or unknown returns the bow as asked — there is no chord to scale against.
 *  `NodeArrow` applies this to its own bowed shaft, so no caller can get it wrong; it is exported
 *  for a host drawing its OWN quadratic between two points (the map's relation layer), where the
 *  order is `extendToMin` FIRST and this against the length that comes back — capping against
 *  the stub chord caps against a chord the drawing no longer has. A host placing a bowed
 *  `NodeArrow` with `shaftTailOffset` passes it the capped bow too, or the two disagree. */
export const ARROW_BOW_MAX_DEG = 20
export function capBow(opts: { length?: number; bow?: number; maxDeg?: number } = {}): number {
  const { length, bow, maxDeg } = opts
  const b = bow || 0
  if (!b) return 0
  if (!(length !== undefined && length > 0)) return b
  const deg = maxDeg === undefined ? ARROW_BOW_MAX_DEG : maxDeg
  const max = Math.tan((deg * Math.PI) / 180) * (length / 2)
  const capped = Math.min(Math.abs(b), max)
  return Math.round((b < 0 ? -capped : capped) * 100) / 100
}

/** THE HALO (OB-116) — a caller-drawn line's own casing: `--surface-raised` behind the shaft
 *  AND the head, so the arrow reads against any fill under it rather than only against the
 *  paper this system's own cards draw on. FOR A HOST ROUTING ARBITRARY LINES OVER ARBITRARY
 *  FILLS ONLY — the map's case, the same split `bow` makes; a chain gap already sits on
 *  `--surface-paper`, which is why `NodeChain` never passes it.
 *
 *  IT FIXES CONTRAST, NOT SIZE. The head and the shaft keep their own paint and their own
 *  dimensions — which is also why it answers the SHORT arrow (two adjacent territories) as
 *  well as the long one: a stub was never hard to see because its head was small, it was hard
 *  to see because it weighed the same as everything under it. */
const CASING_EXTRA = 3
const CASING_COLOR = 'var(--surface-raised)'
const CASING_OPACITY = 0.92

/** WHERE THE SHAFT'S TAIL SITS INSIDE THE DRAWING, in the drawing's own px — `along` the
 *  shaft's axis, `across` it — measured from the `<svg>`'s own origin.
 *
 *  LOCAL ADDITION, not in the DS's `.jsx` or `.d.ts`, and pure arithmetic over the constants
 *  three lines up rather than a design decision of ours. It exists because THE SHAFT IS NOT
 *  DRAWN AT THE DRAWING'S ORIGIN: it sits at `across / 2` down the cross-axis, and both
 *  `casing` (which adds `PAD` on every side) and `bow` (which grows the box on the side it
 *  bulges toward) move it again. A host that places a chain's arrow inside a reserved GAP
 *  never notices — the box is the gap. A host that rotates an arrow onto a line between two
 *  points, which is exactly what `bow` and `casing` are documented for, is placing the
 *  DRAWING when it means to place the SHAFT, and lands the line beside the two points it
 *  joins instead of on them.
 *
 *  `ARROW_METRICS.across` is the DS's published answer to this and is not enough on its own:
 *  it is the FULL-RANK value, while the drawn `across` scales with `joins`, and it says
 *  nothing about `casing`'s pad or `bow`'s sign — under a negative `bow` the tail moves and a
 *  positive one leaves it where it was, so the same magnitude bowed either way would not be
 *  symmetric about the line. Reported for the DS to publish; delete this when it does. */
export function shaftTailOffset(
  opts: { joins?: ChipForm | number; bow?: number; casing?: boolean; length?: number; headSize?: { head: number; halfWidth: number } } = {},
): { along: number; across: number } {
  const { joins, bow = 0, casing = false, length, headSize } = opts
  /* `length` (OB-126) reaches the tail through `halfWidth`, which follows the capped head's
     ratio — so a LONG arrow's tail sits closer to its box's midline than it used to. Omitting
     it keeps the pre-cap arithmetic, which is the upper bound: safe for reserving space, WRONG
     as a position for anything past ~267px. Pass what you pass the render. `headSize` overrides
     both, for a caller drawing a SET at one head; see `headForSet`. */
  const scaledHalf = (headSize ?? headFor({ joins, length })).halfWidth
  const across = scaledHalf * 2 + 3
  const pad = casing ? Math.ceil(CASING_EXTRA / 2) + 1 : 0
  /* the render caps its bow against the chord (`capBow`, DS OB-197), so given the same
     `length` this places the tail against the SAME capped bow — told and drawn stay one number.
     Without `length` there is no chord to cap against, and the bow is taken as asked. */
  const b = capBow({ length, bow })
  return { along: pad, across: pad + (b >= 0 ? across / 2 : across / 2 + Math.abs(b)) }
}

/* the fill variant's head is a CSS triangle rather than an SVG path, and that is upstream's
   choice rather than an inconsistency: this arrow's shaft is a `borderTop` on a flex child that
   takes whatever the row leaves, so the head has to be a flex sibling of it. An SVG head would
   need its own measured width to sit flush against a shaft nobody has measured yet. */
function FillArrowHead({ color, flip }: { color: string; flip?: boolean }) {
  return (
    <span
      style={{
        width: 0, height: 0, flexShrink: 0,
        borderTop: '3px solid transparent', borderBottom: '3px solid transparent',
        ...(flip ? { borderRight: '5px solid ' + color } : { borderLeft: '5px solid ' + color }),
      }}
    />
  )
}

/** THE FILL VARIANT — a horizontal connector that fills its row, with an optional LABEL floating
 *  above the shaft (absolutely positioned, so a wrapped label never pushes the line down) and a
 *  head at either end per `heads`. What a relationship card's arrow needs and a walk's chain
 *  arrow never has: the row width is only known at layout time, and the kind label is the
 *  corpus's own wording rather than decoration. Moved upstream out of `RelationCards`' private
 *  `RelArrow` on 2026-08-28 — same drawing, so a relation diagram anywhere else gets a labelled
 *  arrow without a second copy of it. */
function FillArrow({ label, color, tone, heads = 'out', width, stacked, minHeight, dashed }: NodeArrowProps) {
  const paint = color || TONE[tone || 'walk'] || TONE.walk
  const lines = label ? fitLines(label, Math.max(ARROW_METRICS.fillMin, width || ARROW_METRICS.fillMin), { fontPx: 9, pad: 0 }) : []
  const left = heads === 'both' || heads === 'in'
  const right = heads === 'both' || heads === 'out'
  const root: CSSProperties = stacked
    ? { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minWidth: ARROW_METRICS.fillMin, minHeight: minHeight || ARROW_METRICS.fillMin }
    : { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 0 ' + ARROW_METRICS.fillMin + 'px', minWidth: ARROW_METRICS.fillMin, minHeight: minHeight || 34 }
  return (
    <div style={root}>
      {label ? (
        <span
          title={wrapTip(label)}
          style={{
            position: 'absolute', bottom: '52%', left: 0, right: 0, width: '100%', boxSizing: 'border-box',
            textAlign: 'center', fontSize: 9, fontWeight: 'var(--fw-medium)', color: 'var(--text-3)',
            lineHeight: 1.15, overflow: 'hidden',
          }}
        >
          {lines.map((ln, i) => <div key={i}>{ln}</div>)}
        </span>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {left ? <FillArrowHead color={paint} flip /> : <span style={{ width: 6, flexShrink: 0 }} />}
        <div style={{ flex: 1, height: 0, borderTop: '1px ' + (dashed ? 'dashed' : 'solid') + ' ' + paint, opacity: 0.75 }} />
        {right ? <FillArrowHead color={paint} /> : <span style={{ width: 6, flexShrink: 0 }} />}
      </div>
    </div>
  )
}

export function NodeArrow({
  direction = 'down', length = 14, tone = 'walk', dashed, color, title, joins, bow = 0, casing = false, headSize, walked, walkedTone = 'walk', aheadOpacity = 1,
  fill, label, width, stacked, minHeight, heads,
}: NodeArrowProps) {
  if (fill) return <FillArrow fill label={label} color={color} tone={tone} heads={heads} width={width} stacked={stacked} minHeight={minHeight} dashed={dashed} />
  const paint = color || TONE[tone] || TONE.walk
  /* the rule, applied — the neighbour's form decides, and the default is the full-rank
     chain that draws most of these */
  const T = joins !== undefined ? shaftFor(joins) : SHAFT_STROKE
  /* THE HEAD, from the one function that owns both corrections (OB-067's weight scaling and
     OB-126's length cap) rather than re-derived here. `headSize` wins when a view has sized a
     whole SET at once — see the prop, and `headForSet`. At the full-rank stub every path
     through this returns the published 8 / 4.4, so the chain and the road draw as they did. */
  const drawnHead = headSize ?? headFor({ joins, length })
  const scaledHead = drawnHead.head
  const scaledHalf = drawnHead.halfWidth
  const span = length + scaledHead
  const across = scaledHalf * 2 + 3
  const down = direction === 'down'
  // the casing's own numbers, derived from the shaft it hides behind rather than typed:
  // `casingT` is the shaft plus a half-extra either side, `casingHalf` the head's half-width
  // grown to match, and `casingBack` how far the halo overhangs each end of the drawn mark.
  const PAD = casing ? Math.ceil(CASING_EXTRA / 2) + 1 : 0
  const casingT = T + CASING_EXTRA
  const casingHalf = scaledHalf + CASING_EXTRA / 2 + 0.6
  const casingBack = CASING_EXTRA / 2 + 0.6
  /* THE SPLIT (★ LOCAL, `walked` — see the prop). `wk` is undefined for every caller that did
     not ask, and every branch below then draws its old markup byte for byte: one shaft in
     `paint`, the head at the end. Given, the shaft is one or two strokes — the walked part
     from the tail in the walked paint, the rest in `paint` at `aheadOpacity` — split as dash
     offsets over a `pathLength` of 1 so the same fraction reads on a line and on a curve; and
     while the split is strictly inside the line the head sits AT it, in the walked paint. */
  const wk = walked === undefined ? undefined : Math.max(0, Math.min(1, walked))
  const walkedPaint = TONE[walkedTone] || TONE.walk
  /* a head on a walked arrow is the WALK's, at every position including its tail: the walk has
     arrived there, which is what having a position at all means. Absent `walked`, it is the
     arrow's own tone. */
  const headPaint = wk !== undefined ? walkedPaint : paint
  /* THE HEAD IS PLACED BY THE WALK'S POSITION WHENEVER THERE IS ONE — including at 0 (DS
     OB-159, adopted 2026-09-11). This used to read `wk > 0 && wk < 1`, so `walked={0}` drew a
     resting head at the FAR end and `walked={0.01}` drew it at the tail: the head jumped the
     whole shaft on the animation's first frame. The design system's own file places the head at
     `length * wk` for every defined `wk`, and their reading of 0 is the one that makes that
     continuous — 0 means the walk is STANDING AT THIS ARROW'S TAIL, not "unwalked". Unwalked is
     `walked` absent, which is the branch below.
     Our `src/model/walkarrow.ts` was returning 0 at rest and had to be fixed in the same pull. */
  const travels = wk !== undefined
  const shafts: { paint: string; opacity?: number; dash?: string }[] =
    wk === undefined ? [{ paint }]
      : wk <= 0 ? [{ paint, opacity: aheadOpacity }]
        : wk >= 1 ? [{ paint: walkedPaint }]
          : [{ paint, opacity: aheadOpacity, dash: `0 ${wk} ${1 - wk} 1` }, { paint: walkedPaint, dash: `${wk} 1` }]
  if (bow) {
    /* ROUTING ONLY (OB-107) — for a host drawing an arbitrary line between two points that
       needs to separate it from another line running close beside it for part of its length
       (the map's case: two walk steps whose lines converge on one pin from close angles and
       read as a single doubled shaft right up to the head). `bow` offsets the shaft's own
       midpoint perpendicular to its axis; the head follows the CURVE's tangent at the tip,
       for the reason ARROW_METRICS' scaling already tracks the shaft's weight — a head left
       axis-aligned beside a bowed shaft stops pointing where the line actually arrives.
       KEPT AS A SEPARATE DRAWING from the straight case below rather than folded in as its
       `bow === 0` special case: the straight shaft is a real <line>, and the DS's own cards
       read stroke-width and head bbox off exactly that element, so there is no reason to move
       the common, tested case onto a <path>. */
    /* THE BOW IS CAPPED AGAINST ITS OWN CHORD BEFORE ANYTHING READS IT (DS OB-197) — see
       `capBow`. Uncapped, `ang` below is `atan(2 * bow / length)`, so a fixed sagitta on a short
       shaft rotated the head up to 70 degrees off the line it terminates. Capped here rather than
       asked of the caller. The walk's own bows (`bowFor`, 9% of the shaft) sit well inside it,
       so a walk arrow draws exactly what it drew before. */
    const drawnBow = capBow({ length, bow })
    const extra = Math.abs(drawnBow)
    const acrossB = across + extra
    const mid = drawnBow >= 0 ? across / 2 : across / 2 + extra
    const ctrl = mid + drawnBow
    const du = length / 2
    const dv = mid - ctrl
    /* WHERE THE HEAD SITS ON THE CURVE, and which way it points. At rest that is the curve's
       end and the tangent there — the arithmetic this drawing always used, kept verbatim so a
       resting arrow's markup does not move. Travelling, it is the point at the walked
       fraction of the curve's ARC LENGTH (the same measure the dash split reads — a quadratic's
       `t` is not its arc, and the two must agree or the head slides off the seam) and the
       tangent at that point. */
    let hu = length
    let hv = mid
    let ang = Math.atan2(dv, du)
    if (travels) {
      const at = bezierAtArc(length, mid, ctrl, wk!)
      hu = at.u
      hv = at.v
      ang = at.ang
    }
    const tipU = hu + scaledHead * Math.cos(ang)
    const tipV = hv + scaledHead * Math.sin(ang)
    const perpU = -Math.sin(ang) * scaledHalf
    const perpV = Math.cos(ang) * scaledHalf
    const toXY = (u: number, v: number): [number, number] => (down ? [v, u] : [u, v])
    const w = (down ? acrossB : span) + PAD * 2
    const h = (down ? span : acrossB) + PAD * 2
    const [sx, sy] = toXY(0, mid)
    const [cx, cy] = toXY(length / 2, ctrl)
    const [ex, ey] = toXY(length, mid)
    const [p1x, p1y] = toXY(hu + perpU, hv + perpV)
    const [tx, ty] = toXY(tipU, tipV)
    const [p3x, p3y] = toXY(hu - perpU, hv - perpV)
    const casingPerpU = -Math.sin(ang) * casingHalf
    const casingPerpV = Math.cos(ang) * casingHalf
    const cTipU = hu + (scaledHead + casingBack) * Math.cos(ang)
    const cTipV = hv + (scaledHead + casingBack) * Math.sin(ang)
    const [cp1x, cp1y] = toXY(hu - casingBack * Math.cos(ang) + casingPerpU, hv - casingBack * Math.sin(ang) + casingPerpV)
    const [ctx, cty] = toXY(cTipU, cTipV)
    const [cp3x, cp3y] = toXY(hu - casingBack * Math.cos(ang) - casingPerpU, hv - casingBack * Math.sin(ang) - casingPerpV)
    const curve = `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`
    return (
      <svg
        width={w} height={h} viewBox={`0 0 ${w} ${h}`}
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : undefined}
        style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
      >
        {title ? <title>{title}</title> : null}
        <g transform={`translate(${PAD},${PAD})`}>
          {casing ? (
            <path d={curve} fill="none" stroke={CASING_COLOR} strokeOpacity={CASING_OPACITY}
              strokeWidth={casingT} strokeLinecap="round" strokeDasharray={dashed ? DASH : undefined} />
          ) : null}
          {casing ? (
            <path d={`M${cp1x} ${cp1y} L${ctx} ${cty} L${cp3x} ${cp3y} Z`} fill={CASING_COLOR} fillOpacity={CASING_OPACITY} />
          ) : null}
          {shafts.map((s, k) => (
            <path key={k} d={curve} fill="none" stroke={s.paint} strokeWidth={T} strokeOpacity={s.opacity}
              pathLength={s.dash ? 1 : undefined} strokeDasharray={s.dash ?? (dashed ? DASH : undefined)} />
          ))}
          <path d={`M${p1x} ${p1y} L${tx} ${ty} L${p3x} ${p3y} Z`} fill={headPaint} />
        </g>
      </svg>
    )
  }
  const w = (down ? across : span) + PAD * 2
  const h = (down ? span : across) + PAD * 2
  const mid = across / 2
  /* the head's base along the axis: the shaft's end at rest, the walked point travelling. At
     rest `hx + scaledHead` is `span` by the same addition, so the resting path is unchanged. */
  const hx = travels ? wk! * length : length
  const hs = hx + scaledHead
  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
    >
      {title ? <title>{title}</title> : null}
      <g transform={`translate(${PAD},${PAD})`}>
        {down ? (
          <>
            {casing ? (
              <line x1={mid} y1={-casingBack} x2={mid} y2={length + 1} stroke={CASING_COLOR} strokeOpacity={CASING_OPACITY}
                strokeWidth={casingT} strokeLinecap="round" strokeDasharray={dashed ? DASH : undefined} />
            ) : null}
            {casing ? (
              <path d={`M${mid - casingHalf} ${hx} L${mid} ${hs + casingBack} L${mid + casingHalf} ${hx} Z`}
                fill={CASING_COLOR} fillOpacity={CASING_OPACITY} />
            ) : null}
            {shafts.map((s, k) => (
              <line key={k} x1={mid} y1="0" x2={mid} y2={length + 1} stroke={s.paint} strokeWidth={T} strokeOpacity={s.opacity}
                pathLength={s.dash ? 1 : undefined} strokeDasharray={s.dash ?? (dashed ? DASH : undefined)}
                shapeRendering={dashed ? undefined : 'crispEdges'} />
            ))}
            <path d={`M${mid - scaledHalf} ${hx} L${mid} ${hs} L${mid + scaledHalf} ${hx} Z`} fill={headPaint} />
          </>
        ) : (
          <>
            {casing ? (
              <line x1={-casingBack} y1={mid} x2={length + 1} y2={mid} stroke={CASING_COLOR} strokeOpacity={CASING_OPACITY}
                strokeWidth={casingT} strokeLinecap="round" strokeDasharray={dashed ? DASH : undefined} />
            ) : null}
            {casing ? (
              <path d={`M${hx} ${mid - casingHalf} L${hs + casingBack} ${mid} L${hx} ${mid + casingHalf} Z`}
                fill={CASING_COLOR} fillOpacity={CASING_OPACITY} />
            ) : null}
            {shafts.map((s, k) => (
              <line key={k} x1="0" y1={mid} x2={length + 1} y2={mid} stroke={s.paint} strokeWidth={T} strokeOpacity={s.opacity}
                pathLength={s.dash ? 1 : undefined} strokeDasharray={s.dash ?? (dashed ? DASH : undefined)}
                shapeRendering={dashed ? undefined : 'crispEdges'} />
            ))}
            <path d={`M${hx} ${mid - scaledHalf} L${hs} ${mid} L${hx} ${mid + scaledHalf} Z`} fill={headPaint} />
          </>
        )}
      </g>
    </svg>
  )
}

/** the point on the bowed shaft at a fraction of its ARC length, and the curve's direction
 *  there — for the travelling head. The shaft is the quadratic from (0, mid) through the
 *  control (length/2, ctrl) to (length, mid), in the drawing's own along/across axes. Arc
 *  length has no closed form, so the curve is walked in `ARROW_METRICS.walkedSeamSegments`
 *  pieces and the fraction found by interpolation: at that count, over the bows this map
 *  draws, the error is well under a pixel and the head sits on the seam between the two dashes
 *  rather than beside it. The count is READ rather than retyped (DS OB-159) — it is published
 *  upstream now, so the two sides cannot draw seams that creep against each other if it is
 *  ever tuned. */
function bezierAtArc(length: number, mid: number, ctrl: number, frac: number): { u: number; v: number; ang: number } {
  const N = ARROW_METRICS.walkedSeamSegments
  const at = (t: number): [number, number] => {
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    return [b * (length / 2) + c * length, a * mid + b * ctrl + c * mid]
  }
  const pts: [number, number][] = []
  const cum: number[] = [0]
  for (let i = 0; i <= N; i++) {
    const p = at(i / N)
    pts.push(p)
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]))
  }
  const target = frac * cum[N]
  let i = 1
  while (i < N && cum[i] < target) i++
  const seg = cum[i] - cum[i - 1]
  const t = ((i - 1) + (seg > 0 ? (target - cum[i - 1]) / seg : 0)) / N
  const [u, v] = at(t)
  // the tangent of a quadratic: 2(1−t)(C − P0) + 2t(P1 − C)
  const tu = 2 * (1 - t) * (length / 2) + 2 * t * (length / 2)
  const tv = 2 * (1 - t) * (ctrl - mid) + 2 * t * (mid - ctrl)
  return { u, v, ang: Math.atan2(tv, tu) }
}
