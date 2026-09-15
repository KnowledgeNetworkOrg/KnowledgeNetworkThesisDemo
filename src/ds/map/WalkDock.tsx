import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { StepDot } from '../nav/StepDot'
import { WalkerMark } from '../chrome/WalkerMark'
import { WalkPreview, previewAnchor } from '../nav/WalkPreview'
import { StopTitle, PlayToggle, OptionalSuffix, stopState } from '../nav/WalkParts'
import type { WalkMark } from '../nav/WalkParts'
import { wrapTip } from '../chrome/IconButton'
import type { WalkStep } from '../nav/WalkStrip'

/** Typed port of the DS WalkDock.jsx (contract: WalkDock.d.ts), OB-130 with OB-133's parts and
 *  OB-131's preview. The band, the arrow recipe and the clock (`walkBand`, `walkArrow`,
 *  `walkAdvance`) are published here as the DS publishes them, for OB-132 to consume. NOT
 *  PORTED: `WalkMath`, the capital-initial bundle the DS exports so its own cards can reach the
 *  band through `window.<Namespace>` — its `.d.ts` says "nothing here is required in `src/ds`",
 *  and OB-130 clause (8) says do not add it to the barrel and do not import it. */

export interface WalkBand {
  /** stops BEHIND the position over which ink fades to `floor` */
  trail: number
  /** stops AHEAD over which it fades. 2 — one showed only the next stop, which reads as the walk
   *  stopping dead at the cursor rather than continuing past it. */
  lead: number
  /** the ink a stop keeps once out of the band (the dock never drops below it; a map pin does) */
  floor: number
  /** a pin one stop AHEAD at its brightest — a promise, not a place you have been */
  peak: number
  /** what a pin shrinks toward across the trail */
  shrink: number
  /** THE POP: how much the active pin/dot grows at `active` 1 — 0.36 is scale 1.36× */
  grow: number
  /** the dock's ink at the band's edge, before `floor` applies */
  inkRest: number
  /** the closed rail's tick height across the band */
  tickMin: number
  tickMax: number
}

/** THE RECENCY BAND — ONE TUNABLE SET FOR EVERY DRAWING OF THE WALK: the dock's ticks, the dock's
 *  open row and the map's pins and arrows all read these through `walkBand()`, so one object moves
 *  every drawing. Owner-tuned on the playback rig; CHOSEN, not derived, and every number here is
 *  meant to be re-tuned — pass a partial `band` to override any of them without touching the rest.
 *  EVERY SHAPE NUMBER LIVES HERE. A literal inside `walkBand()` is a number the owner cannot
 *  change without an edit to this file, which is the thing this object exists to prevent. */
export const WALK_BAND_DEFAULTS: WalkBand = {
  trail: 5,
  lead: 2,
  floor: 0.05,
  peak: 0.55,
  shrink: 0.65,
  grow: 0.36,
  inkRest: 0.28,
  tickMin: 3, tickMax: 10,
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export interface WalkBandReading {
  /** signed distance, index − position */
  d: number
  behind: boolean
  /** 1 on the stop, 0 one stop away — the "you are here" weight, whatever the band */
  active: number
  /** 1 on the stop, 0 at the band's edge on that side */
  near: number
  inBand: boolean
  /** the DOCK's opacity for a tick or a stop, floored so the extent never vanishes */
  ink: number
  /** px, for the closed rail */
  tickHeight: number
  /** the MAP's: 0 outside the band, full on the active stop, `peak` one stop ahead */
  pinOpacity: number
  /** the POP: `1 + grow` on the active stop, shrinking toward `shrink` over the trail */
  pinScale: number
  /** the acorn fill's opacity on a raw-SVG pin (arrival, = `active`) */
  pinWarm: number
  /** the acorn ring's — full once behind: a visited stop keeps its ring, an approaching one earns it */
  pinRing: number
  /** the number's crossfade to `--text-inverse` as the acorn fill arrives under it */
  pinInverse: number
}

/** ONE BAND FOR EVERY MARK ON THE WALK — a rule about DATA drawing is code, not prose. Given a
 *  stop's index and the FRACTIONAL position, returns every number a drawing needs, so a caller
 *  picks a FIELD and never re-derives the fade. `position` may be an integer (the host's cursor)
 *  — everything still reads; the fractional case is what animates travel between two stops.
 *
 *  WHICH OF THE TWO WAYS, since 2026-09-02 there are two: a pin drawn with `StepDot` (the app's
 *  is) takes `active` as that component's `arrival` prop and ignores `pinWarm` / `pinRing` /
 *  `pinInverse` — fill, ring and number are inside it and a caller cannot reach them. They stay
 *  for a host drawing its own pin in raw SVG. `pinOpacity` and `pinScale` are the host's in both
 *  cases. THE POP IS `pinScale`, and it is a consequence of the position being FRACTIONAL: an
 *  integer cursor makes it a jump instead — the pop is the clock's, not a keyframe's. */
export function walkBand(index: number, position: number, band?: Partial<WalkBand>): WalkBandReading {
  const b = band ? { ...WALK_BAND_DEFAULTS, ...band } : WALK_BAND_DEFAULTS
  const d = index - position
  const behind = d < 0
  const dist = Math.abs(d)
  const active = Math.max(0, 1 - dist)
  const span = Math.max(1, behind ? b.trail : b.lead)
  const near = Math.max(0, 1 - dist / span)
  const inBand = dist <= span
  const ink = Math.max(b.floor, lerp(b.inkRest, 1, near))
  const tickHeight = lerp(b.tickMin, b.tickMax, near)
  const bandOp = !inBand ? 0 : behind ? lerp(1, b.floor, dist / span) : lerp(b.peak, Math.max(b.floor * 0.9, 0.04), dist / span)
  const pinOpacity = Math.max(bandOp, active)
  const pinScale = (1 + b.grow * active) * (behind ? lerp(1, b.shrink, Math.min(1, dist / span)) : 1)
  return { d, behind, active, near, inBand, ink, tickHeight, pinOpacity, pinScale, pinWarm: active, pinRing: behind ? 1 : active, pinInverse: active }
}

/** HOW MUCH OF THE ARROW OUT OF STOP `i` HAS BEEN WALKED, 0..1 — the walked part draws acorn,
 *  the rest quiet; with a fractional position the head travels along it. One line, published so
 *  it is not retyped with the clamp the other way round. */
export function segmentWalked(position: number, i: number): number {
  return Math.max(0, Math.min(1, position - i))
}

export interface WalkArrowGeom {
  /** the host's pin radius AT SCALE 1, px. The clearances below are added to the SCALED radius,
   *  which is the part that cannot be a constant: a pin pops to 1.36× as the cursor arrives, and
   *  a tail clipped at the resting radius is swallowed by its own pin at that moment. */
  pinRadius: number
  /** gap between the tail pin's edge and the shaft's start (a round cap may sit close) */
  clearTail: number
  /** gap between the head's point and the target pin's edge — larger, because a triangle's point
   *  reads as touching well before it does */
  clearHead: number
  /** an arrow is a shade quieter than the pins it joins */
  quiet: number
  /** how far the unwalked part drops as the walked part passes it */
  aheadFade: number
  /** OPTIONAL, per arrow: the path's own length in px. Given, `hidden` also covers the case where
   *  the two clearances have eaten the whole shaft (two crowded stops, or two popped pins). */
  length?: number
}

/** pinRadius 11, clearTail 3, clearHead 4, quiet 0.92, aheadFade 0.65 — the compact rig's arrows,
 *  CHOSEN. `pinRadius` is the only one a host should expect to change. */
export const WALK_ARROW_DEFAULTS: WalkArrowGeom = {
  pinRadius: 11,
  clearTail: 3,
  clearHead: 4,
  quiet: 0.92,
  aheadFade: 0.65,
}

/** THE ARROW BETWEEN TWO STOPS, as a recipe rather than a description — same reason as the band:
 *  the map draws fifteen of these per frame from a machine, and a rule applied per frame per arrow
 *  gets retyped and drifts. Read fields; do not re-derive them from the two pins. Pass the SAME
 *  `band` object the pins and the dock are given.
 *
 *  `headAcorn` (the head takes the walk's colour the moment any of the segment is walked) IS ALSO
 *  THE HOST'S ENTRY TEST, which is its more load-bearing job (DS OB-175, 2026-09-14): pass
 *  `walked` to `NodeArrow` only for an arrow this is true of. That component reads 0 as "the walk
 *  is standing at this arrow's TAIL" — head at the tail, nothing walked yet — so handing it 0 for
 *  an arrow the walk has NOT entered draws an acorn head on that arrow's tail; exactly what this
 *  map's OB-159 port did, and the browser suite caught it. The two files are not in conflict:
 *  this one decides WHICH arrows get a `walked` at all, that one decides what a given value DRAWS.
 *  A component cannot know whether the walk has entered it — that is the host's fact — so the
 *  gate stays here, as a field to read. */
export function walkArrow(i: number, position: number, band?: Partial<WalkBand>, geom?: Partial<WalkArrowGeom>): {
  hidden: boolean; opacity: number; walked: number; aheadOpacity: number
  tailClear: number; headClear: number; headTravels: boolean; headAcorn: boolean
} {
  const g = geom ? { ...WALK_ARROW_DEFAULTS, ...geom } : WALK_ARROW_DEFAULTS
  const a = walkBand(i, position, band)
  const b = walkBand(i + 1, position, band)
  const walked = segmentWalked(position, i)
  const opacity = Math.min(a.pinOpacity, b.pinOpacity) * g.quiet
  const tailClear = g.pinRadius * a.pinScale + g.clearTail
  const headClear = g.pinRadius * b.pinScale + g.clearHead
  const crushed = g.length !== undefined && g.length - headClear <= tailClear
  return {
    hidden: opacity <= 0 || crushed,
    opacity, walked,
    aheadOpacity: opacity * (1 - walked * g.aheadFade),
    tailClear, headClear,
    headTravels: walked > 0 && walked < 1,
    headAcorn: walked > 0,
  }
}

export interface WalkPlayback {
  /** ms a stop takes end to end */
  step: number
  /** of that, the fraction spent MOVING; the rest dwells on the stop. The dwell is what makes a
   *  stop legible — without it the walk never rests long enough to read the name that arrived. */
  travel: number
  /** THE STALL CAP — the most elapsed time one `walkAdvance` call may spend, in ms. `null` (the
   *  default) means ONE `step`, DERIVED: the cap tracks whatever speed the walk is tuned to. A
   *  NUMBER is an explicit override and is then CHOSEN. Do not "pin" the default by writing
   *  today's 900 in — at `step` 300 a fixed 900 lets one stalled frame spend three stops. */
  maxDt: number | null
}

/** THE CLOCK, PUBLISHED FOR THE SAME REASON THE BAND IS: playback is a rule about how a drawing
 *  MOVES, applied per frame by a machine, and two surfaces running their own arithmetic disagree
 *  the first time someone re-tunes it. `step` and `travel` are owner-tuned on the compact rig and
 *  CHOSEN; `maxDt` is DERIVED by default (null = one `step`) and only becomes a chosen constant if
 *  a caller passes a number. THE HOST STILL OWNS THE CLOCK — this is not a timer. */
export const WALK_PLAYBACK_DEFAULTS: WalkPlayback = {
  step: 900,
  travel: 0.7,
  maxDt: null,
}

/** the travel easing, in and out — a walk starts and stops at each stop, it does not scroll */
export function walkEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** ONE STEP OF A PLAYBACK LOOP, pure. Give it the integer stop, the phase within that stop (0…1+)
 *  and the milliseconds since the last frame; get back the next `{ step, phase, position, done }`,
 *  where `position` is the FRACTIONAL position every drawing reads. `count` clamps at the end and
 *  reports `done` so the host can stop its own timer.
 *
 *  IT CLAMPS `dt` ITSELF — CLAMP THE ELAPSED TIME, NOT THE RESULT. Two ordinary conditions break
 *  an unguarded clock: a throttled or stalled frame delivers seconds at once (a hidden tab took a
 *  60-stop walk straight to the end in one frame), and a stale timestamp delivers a NEGATIVE one
 *  (the same object then reports `step` 4 with `position` 2.0). Both are one unbounded input, so
 *  both are fixed in one place; a caller must not stack a second guard on top. */
export function walkAdvance({ step = 0, phase = 0, dt = 0, count = 0, playback }: {
  step?: number; phase?: number; dt?: number; count?: number; playback?: Partial<WalkPlayback>
} = {}): { step: number; phase: number; position: number; done: boolean } {
  const p = playback ? { ...WALK_PLAYBACK_DEFAULTS, ...playback } : WALK_PLAYBACK_DEFAULTS
  const last = Math.max(0, count - 1)
  const cap = p.maxDt == null ? p.step : p.maxDt
  const dtc = Math.min(Math.max(0, dt), Math.max(0, cap))
  let s = step
  let ph = Math.max(0, phase) + dtc / Math.max(1, p.step)
  while (ph >= 1 && s < last) { ph -= 1; s += 1 }
  if (s >= last) return { step: last, phase: 0, position: last, done: true }
  return { step: s, phase: ph, position: s + walkEase(Math.min(1, ph / Math.max(0.01, p.travel))), done: false }
}

/** THE DOCK'S GEOMETRY. `closed` and `open` are DERIVED from the parts beneath them — change a
 *  part and both move; the host's auto-fit reads `closed` (rule 2 in the `.d.ts`). */
/** THE BAND FOR A RANGE PIN — one node holding several contiguous walk stops, drawn as a single
 *  pin labelled "2.1–2.5". Hand it the span and it answers as `walkBand` would for whichever stop
 *  in that span the cursor is nearest — which is zero distance anywhere INSIDE it, so the node
 *  stays current until the walk actually leaves it.
 *
 *  WHY THIS IS A CALL AND NOT A SENTENCE: banding a range against its FIRST stop is the natural
 *  mistake and it is silent — the pin begins fading and shrinking the moment the walk reaches the
 *  span's second stop, so a node recedes into the past while the class is still inside it. Nothing
 *  errors; it just looks like the walk has moved on. (Owner-reported 2026-09-09, on the DS's own
 *  rig.) A port handed the rule in prose has a fair chance of making it too, so the clamp ships. */
export function walkBandSpan(from: number, to: number, position: number, band?: Partial<WalkBand>): WalkBandReading {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return walkBand(Math.max(lo, Math.min(hi, position)), position, band)
}

/** THE STOP THE WALK HAS ARRIVED AT, off the same clock every drawing of the walk reads — and
 *  the one thing an ARRIVAL-TIMED reaction must be written from. Published 2026-09-14, after the
 *  owner reported the map's node highlight landing AFTER the pin pop and the arrow fill on play.
 *
 *  `walkAdvance` returns TWO cursors and they are not the same instant:
 *   - `position` is fractional and reaches the next stop at phase `travel` — 0.7 of the step. The
 *     pin's pop, the arrow's fill and the band all ride it, so they finish ON the arrival.
 *   - `step` is the integer stop and increments only when the phase WRAPS, at the end of the
 *     dwell that follows. It is the loop's own bookkeeping, not a statement about what is drawn.
 *
 *  So anything written from `step` — a highlight, a focus, a pane that follows the walk — lands
 *  `walkArrivalLag()` milliseconds late: `step * (1 - travel)`, 270ms at the defaults. Late enough
 *  to read as two separate events rather than one arrival. Both cursors are legitimate; the fault
 *  is reading the bookkeeping one as the arrival.
 *
 *  DERIVED, not chosen: this is `Math.floor(position)`, and the reason it is a call rather than a
 *  sentence is that the sentence has already been got wrong once. `position` lands exactly on the
 *  integer at phase `travel` (`walkEase(1)` is exactly 1), so the epsilon only guards a caller's
 *  own float arithmetic, never ours. */
export function walkArrival(position: number, count?: number): number {
  const i = Math.floor((Number(position) || 0) + 1e-9)
  const last = count ? Math.max(0, count - 1) : Infinity
  return Math.max(0, Math.min(last, i))
}
/** HOW LATE AN ARRIVAL-TIMED REACTION IS IF IT RIDES `step` INSTEAD OF `walkArrival(position)`,
 *  in ms — the dwell, `step * (1 - travel)`. DERIVED from the playback numbers, so it tracks a
 *  re-tune; published so the figure in a test is not a retyped 270. Compare it with a tolerance:
 *  `900 * (1 - 0.7)` is 270.00000000000006. */
export function walkArrivalLag(playback?: Partial<WalkPlayback>): number {
  const p = playback ? { ...WALK_PLAYBACK_DEFAULTS, ...playback } : WALK_PLAYBACK_DEFAULTS
  return p.step * (1 - p.travel)
}

export interface WalkLook {
  /** how close to the frame edge still counts as off-screen, as a FRACTION of the view's smaller
   *  side. Default 0.12, CHOSEN. A fraction rather than a pixel count so it survives zoom: a px
   *  margin means something different at every scale, and this question is asked at whatever scale
   *  the room is looking at. A pin flush against the frame edge is visible and still unreadable. */
  edgeInset: number
}
/** edgeInset 0.12, CHOSEN. Pass a partial to `walkLook` to re-tune it. */
export const WALK_LOOK_DEFAULTS: WalkLook = { edgeInset: 0.12 }
/** WHETHER THE CAMERA SHOULD MOVE FOR THE STOP THE WALK JUST REACHED — and if so, where to.
 *  Owner's call, 2026-09-14: the camera moves ONLY when the stop is off-screen, never on every
 *  advance. Motion that happens every time becomes scenery; motion that happens rarely reads as
 *  "we have gone somewhere new", which is the whole information it carries (the same reasoning as
 *  `ProjectedMap` rule 1 — travel on every advance gets old).
 *
 *  `point` and `view` are in ONE coordinate space, the host's own map space — this never converts
 *  between spaces and cannot tell you if you have mixed them. `to` is the view's new CENTRE in
 *  that space; `move: false` returns the CURRENT centre rather than null, so a host may apply
 *  `to` unconditionally if that is simpler than branching.
 *
 *  THE HOST OWNS THE CAMERA, AS IT OWNS THE CLOCK. This returns arithmetic, not an animation.
 *  THREE CALLER RULES it cannot enforce: ask ON ADVANCE ONLY (not a pause, a hover or a seek the
 *  user is dragging — a paused walk is standing still and the camera stands with it); A USER'S
 *  OWN PAN WINS (once the room has panned during playback, stop asking until the walk moves
 *  again); and THIS IS THE `look` CHANNEL, NEVER THE FOCUS — playback writes the focus already,
 *  and moving the camera must not change which node the other panes are showing. */
export function walkLook({ point, view, look }: {
  point?: { x: number; y: number }
  view?: { x: number; y: number; width: number; height: number }
  look?: Partial<WalkLook>
} = {}): { move: boolean; to: { x: number; y: number } | null } {
  const L = look ? { ...WALK_LOOK_DEFAULTS, ...look } : WALK_LOOK_DEFAULTS
  const to = view ? { x: view.x + view.width / 2, y: view.y + view.height / 2 } : null
  if (!point || !view || !view.width || !view.height) return { move: false, to }
  const inset = Math.min(view.width, view.height) * L.edgeInset
  const inside =
    point.x >= view.x + inset && point.x <= view.x + view.width - inset &&
    point.y >= view.y + inset && point.y <= view.y + view.height - inset
  return inside ? { move: false, to } : { move: true, to: { x: point.x, y: point.y } }
}

const P = {
  padTop: 6, padBottom: 10, border: 1, padX: 12,
  row: 20,        /* the transport row: play, name, readout, chevron — all 20 tall */
  railGap: 6,     /* between the row and the closed rail */
  rail: 20,       /* the closed rail's hit box; the drawn line is `line` tall inside it */
  rowH: 76,       /* the open row: pad 2 + walker 12 + gap 3 + dot 18 + gap 3 + THREE 10px/1.25 title
                     lines (37.5) = 75.5. Three, not two, since 2026-09-01: an optional stop's title
                     carries " (optional)" and `StopTitle` gives it a third clamped line so the word
                     is never swallowed by a two-line name (the strip's own rule). Was 64 for two. */
}
const FOLD_MS = 280 /* the fold: the two rails' height transition and the chevron's turn. The open row
                       unmounts this long after a close, so it cannot drift from the animation.
                       PUBLISHED as `WALK_DOCK_METRICS.fold` — the host's floating chrome rides the
                       dock's live height (rule 2b in the DS `.d.ts`; MapView) and must move on the
                       same clock. */
export const WALK_DOCK_METRICS = {
  ...P,
  /** CHOSEN: ms of the open/close fold. What the host's floating chrome transitions over (rule 2b
   *  of the DS contract): whatever the host moves with the dock's height animates for exactly this
   *  long, with `--ease-soft`, so it reads as the dock pushing it rather than a second animation. */
  fold: FOLD_MS,
  /** DERIVED: padTop + row + railGap + rail + padBottom + border = 63. What the auto-fit insets. */
  closed: P.padTop + P.row + P.railGap + P.rail + P.padBottom + P.border,
  /** DERIVED: padTop + row + rowH + padBottom + border = 113. Covers `open − closed` of map. */
  open: P.padTop + P.row + P.rowH + P.padBottom + P.border,
  line: 2, lineHover: 4,   /* the rail's drawn line, at rest and while hovered — a scrubber's swell */
  tick: 2,                 /* a stop on the closed rail; its height is `walkBand().tickHeight` */
  knob: 14, knobHover: 18, /* the position mark on the closed rail. THE RAIL'S INSET IS HALF THE
                              HOVER SIZE (9), not the rest size: a knob centred on the rail's first
                              pixel would hang outside it and clip when it grew */
  stopW: 68,               /* one stop's column in the open row */
  stopDot: 18, walker: 12, /* the open row's StepDot and the WalkerMark standing on the current one */
  edge: 28,                /* the open row's edge zone: a drag held here scrolls the row on */
  readoutMin: 52,          /* the readout pill's minimum width — `12 / 60` and `100%` both fit */
}

const SOFT = 'var(--ease-soft)'
const FOLD = FOLD_MS + 'ms'

export type WalkDockMetric = 'position' | 'percent'

export interface WalkDockProps {
  /** the walk's steps, in order — the same `WalkStep` the strip takes. `note` is shown after the
   *  name in the row (`Turing machine · Theory`); an optional step's name carries " (optional)"
   *  before the note, in the closed row and under its dot in the open row alike. HOST-OWNED. */
  steps: WalkStep[]
  /** where the walk stands, 0 … steps.length−1. FRACTIONAL: 12.4 is 40% of the way from stop 12 to
   *  stop 13 and the knob, the fill, the open row's scroll and every band all sit there. An
   *  integer cursor is accepted unchanged and snaps. Clamped to the range. */
  position: number
  /** the transport glyph — play (false) or pause (true). Display only. */
  playing?: boolean
  /** mounts the play/pause button at the row's left end; omit it and there is no transport. Fires;
   *  the HOST runs the walk. Does not fire `onSeek`. */
  onPlayToggle?: () => void
  /** the user picked stop `index` — by clicking or dragging the closed rail, dragging the open
   *  row, or a key while the dock has focus. Fires live during a drag. Set `position` from it. */
  onSeek?: (index: number) => void
  /** controlled open state. Omit to let the dock own it (`defaultOpen`). */
  open?: boolean
  /** the dock's own initial open state when `open` is not controlled */
  defaultOpen?: boolean
  /** reports a chevron click, controlled or not */
  onOpenChange?: (open: boolean) => void
  /** THE READOUT'S FACE — `'position'` is `12 / 60`, `'percent'` is `20%` (the fraction of the
   *  RAIL walked, position over N−1, so 60/60 and 100% agree and 1/60 reads 0%). One pill, two
   *  faces, a click swaps them; its background is an acorn wash to the same fraction. Controlled
   *  or `defaultMetric`. */
  metric?: WalkDockMetric
  /** the dock's own initial face when `metric` is not controlled */
  defaultMetric?: WalkDockMetric
  /** reports a readout click, controlled or not */
  onMetricChange?: (metric: WalkDockMetric) => void
  /** the recency band, defaulting to `WALK_BAND_DEFAULTS`; a partial merges over the defaults.
   *  PASS THE SAME OBJECT TO EVERY DRAWING OF THE WALK — the dock and the map's pins read
   *  `walkBand()` with it, and one control then moves both. */
  band?: Partial<WalkBand>
  /** the hover preview, shown above the stop the pointer is on — on the closed rail or the open
   *  row, AND while a drag is choosing a stop on either of them (never blanked by the pointer
   *  going down). Through `WalkPreview`, the strip's own convention. Pass the SAME function you
   *  pass `WalkStrip` and the map's pins. Omit it: no popup.
   *
   *  ONE CARD PER STOP, because the dock draws ONE MARK PER STOP (owner, 2026-09-14): the dock has
   *  no ranges. A mark that means two things cannot be read, and the map's own `"2-3"` pin means
   *  something else entirely (several nodes in one cell at this zoom).
   *
   *  A DRAG SHOWS THE CARD TOO, and that is the newer rule (owner, 2026-09-14; OB-185): the dock
   *  used to clear the preview on `pointerdown`, which is backwards — a hover asks *what is over
   *  there*, a drag is CHOOSING, so the gesture that commits is the one the card is worth more to.
   *  While a drag is down the card anchors on the stop being landed on, not on the pointer, and it
   *  survives the pointer crossing the surface's own edge (an edge-zone drag scrolls the row on).
   *
   *  THE THIRD ARGUMENT EXISTS FOR THE MAP AND THE DOCK NEVER SENDS ONE. A host whose marks merge
   *  stops — the map's pins do — hands its own mark to `WalkPinHover`, and that mark arrives here
   *  as `mark`, so ONE `renderPreview` serves both surfaces: on the dock it is always `undefined`
   *  and the card is the stop's; on a merged pin it carries `label` and `steps` and the card names
   *  everything under the pin. Write the function to read `mark` and fall back to the step.
   *
   *  THIS IS THE DOCK'S ONLY TOOLTIP, AND IT IS NOT THE MAP'S: never a `MapTooltip` on a rail, a
   *  tick, a stop or the transport row — and while `renderPreview` is given the open row's stops
   *  carry NO native `title`, so the browser's own tip cannot fade in over the card. */
  renderPreview?: (step: WalkStep, index: number, mark?: WalkMark) => ReactNode
  /** the pointer is over stop `index` on either rail, or over none (`null`). Fires while a DRAG
   *  moves through the stops as well as on a hover, ONCE PER CHANGE OF STOP — report-only, for a
   *  pane that wants to react to attention. The same contract as `WalkStrip.onStepHover`. */
  onStepHover?: (index: number | null) => void
  /** position/size overrides for the mount only. Do not restyle the face. */
  style?: CSSProperties
}

interface Hover { i: number; x: number; top: number }

/** THE WALK DOCKED INSIDE THE MAP PANE — an overlay on its bottom edge, two heights. CLOSED it
 *  is a comet rail: every stop a 2px tick whose ink and height carry the recency band, the
 *  position one round knob riding the FRACTIONAL position, the current stop's name and a readout
 *  in the row above. OPEN, the chevron grows the rail upward into a row of named `StepDot`s with
 *  the walker on the current one — the same line runs on through the dots, so the two sizes read
 *  as one rail at two scales, not two controls. The transport row stays on top in both.
 *
 *  WHY AN OVERLAY: expanding must not move the map. The dock is absolutely positioned inside the
 *  pane's clip, over the map, on a paper wash; the SVG never changes size, and the pins under the
 *  open dock show through. The host insets its auto-fit by `WALK_DOCK_METRICS.closed` so at rest
 *  no pin sits under the strip (owner, 2026-09-01); open covers 50px of map and that is the
 *  trade for a collapsed state that costs nothing.
 *
 *  WHY TICKS, NOT DOTS, WHEN CLOSED: sixty dots across a 520px rail sit 8.8px apart, so an 11px
 *  dot overlaps both neighbours and the trail becomes one blob. A tick carries the band in ink
 *  and height — the map's own vocabulary at a scale where a dot cannot go.
 *
 *  THE HOST OWNS THE POSITION, as `WalkStrip` and `NodeRail` own nothing of theirs: `onSeek`
 *  reports an integer stop, `onPlayToggle` asks the host to run its clock; the dock holds no
 *  timer. `position` accepts the host's integer cursor unchanged — the knob then steps; a
 *  fractional clock is what buys travel. */
export function WalkDock({ steps = [], position = 0, playing = false, onPlayToggle, onSeek, open, defaultOpen = false, onOpenChange, metric, defaultMetric = 'position', onMetricChange, band, renderPreview, onStepHover, style }: WalkDockProps) {
  const M = WALK_DOCK_METRICS
  const N = steps.length
  const last = Math.max(0, N - 1)
  const pos = Math.min(last, Math.max(0, Number.isFinite(position) ? position : 0))
  const cur = Math.round(pos)
  const frac = last ? pos / last : 0
  const [openU, setOpenU] = useState(defaultOpen)
  const isOpen = open === undefined ? openU : open
  const setOpen = (v: boolean) => { setOpenU(v); if (onOpenChange) onOpenChange(v) }
  /* THE OPEN ROW IS MOUNTED ONLY WHILE IT CAN BE SEEN. Closed, the dock is a 20px rail of 2px
     ticks; the row's sixty `StepDot`s and titles (~500 DOM nodes at 60 stops) used to sit
     folded under it at height 0 on every render of every position. Now they mount when the
     dock opens and stay `FOLD_MS` after it closes, so the fold animation still has something to
     fold — then unmount. The container keeps its height transition either way.
     ★ LOCAL: the DS writes `setRowLinger(true)` synchronously inside the effect, which this
     repo's react-hooks/set-state-in-effect rule rejects. Same behaviour, no synchronous write:
     `rowLive` is `isOpen || linger`, so opening mounts the row at once from the prop alone; the
     linger flag is raised a frame later and dropped `FOLD_MS` after a close, both asynchronously. */
  const [linger, setLinger] = useState(defaultOpen)
  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => setLinger(true))
      return () => cancelAnimationFrame(id)
    }
    const t = setTimeout(() => setLinger(false), FOLD_MS + 40)
    return () => clearTimeout(t)
  }, [isOpen])
  const rowLive = isOpen || linger
  const [metricU, setMetricU] = useState<WalkDockMetric>(defaultMetric)
  const face = metric === undefined ? metricU : metric
  const setFace = (v: WalkDockMetric) => { setMetricU(v); if (onMetricChange) onMetricChange(v) }
  const [railHover, setRailHover] = useState(false)
  const [rowHover, setRowHover] = useState(false)
  const [pillHover, setPillHover] = useState(false)
  /* THE HOVERED OR DRAGGED STOP for the preview — `null` when the pointer is off both rails. */
  const [hover, setHover] = useState<Hover | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const nameRef = useRef<HTMLSpanElement | null>(null)
  const dragRef = useRef(false)
  const lastRef = useRef<number | null>(null)

  /* ONE MAPPING FOR EVERY MARK ON THE CLOSED RAIL: the usable span is inset by half the HOVER
     knob at both ends, and ticks, fill, knob and the seek hit-test all read the same two numbers
     — the knob SITTING ON a tick is the whole claim the rail makes. */
  const KNOB = M.knobHover
  const INSET = KNOB / 2
  const at = (f: number) => 'calc(' + INSET + 'px + ' + f.toFixed(5) + ' * (100% - ' + KNOB + 'px))'
  const clampI = (i: number) => Math.max(0, Math.min(last, i))
  const railIndexAt = (clientX: number) => {
    const r = railRef.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left - INSET) / Math.max(1, r.width - KNOB)))
    return Math.round(f * last)
  }
  const railXOf = (i: number) => {
    const r = railRef.current!.getBoundingClientRect()
    return r.left + INSET + (last ? i / last : 0) * (r.width - KNOB)
  }
  /* THE OPEN ROW SEEKS IN ITS OWN COORDINATES — pointer x plus scrollLeft over the stop width. */
  const rowIndexAt = (clientX: number) => {
    const el = rowRef.current!
    const r = el.getBoundingClientRect()
    return clampI(Math.round((clientX - r.left + el.scrollLeft - M.stopW / 2) / M.stopW))
  }
  const rowXOf = (i: number) => {
    const el = rowRef.current!
    const r = el.getBoundingClientRect()
    return r.left + i * M.stopW + M.stopW / 2 - el.scrollLeft
  }
  const seek = (i: number) => { if (onSeek && N) onSeek(clampI(i)) }
  /* ONE REPORT PER CHANGE OF STOP, kept in a REF and not compared against `hover`: a drag's
     `pointermove` listener lives on `window` for the whole gesture and closes over the render that
     created it, so a check against the state value goes stale on the first move and reports the
     same stop on every frame after it. */
  const report = (i: number | null) => { if (i !== lastRef.current) { lastRef.current = i; if (onStepHover) onStepHover(i) } }
  /* THE PREVIEW FOR BOTH RAILS AND FOR A DRAG, in one place — the ANCHOR is the only thing that
     differs between the four ways in, and it is the thing that keeps being got wrong.

     A DRAG SHOWS THE SAME CARD A HOVER DOES (owner, 2026-09-14; OB-185). The dock used to blank the
     preview the instant the pointer went down, which is backwards: a hover is asking *what is
     over there*, a drag is CHOOSING, and the card is worth more to the gesture that commits. It
     anchors on the stop's own mark rather than the pointer, so the card sits over the stop being
     landed on and not beside the finger. `mark` stays in `renderPreview`'s signature and the dock
     never sends one: it has no ranges, so there is nothing to send. */
  const previewAt = (i: number, x: number, top: number) => { report(i); setHover({ i, x, top }) }
  const clearPreview = () => { setHover(null); report(null) }
  const outside = (el: HTMLElement | null, ev: { clientX: number; clientY: number } | null) => {
    if (!el || !ev) return false
    const r = el.getBoundingClientRect()
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom
  }
  const railPreview = (clientX: number) => { const i = railIndexAt(clientX); previewAt(i, railXOf(i), railRef.current!.getBoundingClientRect().top) }
  const rowPreview = (clientX: number) => { const i = rowIndexAt(clientX); previewAt(i, rowXOf(i), rowRef.current!.getBoundingClientRect().top) }

  /* THE OPEN ROW TRAVELS TOO: scrollLeft follows the FRACTIONAL position, so the row slides
     between stops at the knob's own pace rather than jumping a column at each step. */
  const follow = useCallback(() => {
    const el = rowRef.current
    if (!el || dragRef.current) return
    el.scrollLeft = pos * M.stopW + M.stopW / 2 - el.clientWidth / 2
  }, [pos, M.stopW])
  useEffect(() => { if (isOpen) follow() }, [follow, isOpen])

  const onRailDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !N) return
    dragRef.current = true
    seek(railIndexAt(e.clientX)); railPreview(e.clientX)
    const mv = (ev: PointerEvent) => { seek(railIndexAt(ev.clientX)); railPreview(ev.clientX) }
    const up = (ev: PointerEvent) => { dragRef.current = false; if (outside(railRef.current, ev)) clearPreview(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  /* WHILE A ROW DRAG IS DOWN THE ROW DOES NOT RECENTRE on the position — recentring would slide
     the stops under the pointer and the mapping would chase itself; it recentres on release.
     HOLDING THE POINTER IN EITHER EDGE ZONE SCROLLS THE ROW ON, faster the deeper in, so a drag
     can reach stops the row is not showing (owner, 2026-09-01). */
  const onRowDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !N) return
    dragRef.current = true
    let lastX = e.clientX
    let raf = 0
    const el = rowRef.current!
    const seekAt = (x: number) => { const i = rowIndexAt(x); if (i !== cur) seek(i) }
    const edge = () => {
      if (!dragRef.current) return
      const r = el.getBoundingClientRect()
      let v = 0
      if (lastX < r.left + M.edge) v = -(6 + 14 * Math.min(1, (r.left + M.edge - lastX) / M.edge))
      else if (lastX > r.right - M.edge) v = 6 + 14 * Math.min(1, (lastX - (r.right - M.edge)) / M.edge)
      if (v) { el.scrollLeft += v; seekAt(lastX); rowPreview(lastX) }
      raf = requestAnimationFrame(edge)
    }
    seek(rowIndexAt(e.clientX)); rowPreview(e.clientX)
    raf = requestAnimationFrame(edge)
    const mv = (ev: PointerEvent) => { lastX = ev.clientX; seekAt(ev.clientX); rowPreview(ev.clientX) }
    const up = (ev: PointerEvent) => { dragRef.current = false; cancelAnimationFrame(raf); if (outside(rowRef.current, ev)) clearPreview(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); follow() }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  /* HOVER PREVIEW ON BOTH SIZES: the closed rail anchors on the nearest tick's own x, the open row
     on the stop's column centre. A DRAG KEEPS THE CARD UP, so these two only handle the pointer-up
     case; the drag handlers call the same two functions. `onLeave` stands aside while a drag is
     down, or the card would blink out every time the gesture crosses the surface's own edge on its
     way to an edge scroll. */
  const onRailMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragRef.current || !N) return; railPreview(e.clientX) }
  const onRowMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragRef.current || !N) return; rowPreview(e.clientX) }
  const onLeave = () => { if (!dragRef.current) clearPreview() }

  /* THE NAME ARRIVES, it does not swap — the one thing on the closed rail that says which stop
     you are ON. Web Animations rather than a keyframe: inline styles cannot declare one. */
  useEffect(() => {
    const el = nameRef.current
    if (!el || !el.animate) return
    el.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' })
  }, [cur])

  /* KEYBOARD, on the focused dock: arrows step, Home/End jump, space toggles play. Focus comes from
     a click on it or the host's own tab order — the dock binds nothing on `document`. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!N) return
    const k = e.key
    if (k === 'ArrowRight') { e.preventDefault(); seek(cur + 1) }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(cur - 1) }
    else if (k === 'Home') { e.preventDefault(); seek(0) }
    else if (k === 'End') { e.preventDefault(); seek(last) }
    else if (k === ' ' && onPlayToggle) { e.preventDefault(); onPlayToggle() }
  }

  const step = steps[cur]
  const pc = (frac * 100).toFixed(2) + '%'
  const lineH = railHover ? M.lineHover : M.line
  const knob = railHover ? M.knobHover : M.knob
  const rowLineH = rowHover ? M.lineHover : M.line
  const rowLineTop = 2 + M.walker + 3 + M.stopDot / 2 - rowLineH / 2 /* through the dots' centre */
  const btn: CSSProperties = { flex: 'none', width: M.row, height: M.row, padding: 0, appearance: 'none', WebkitAppearance: 'none', border: 'none', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
  return (
    <div tabIndex={0} onKeyDown={onKeyDown} data-walk-dock={isOpen ? 'open' : 'closed'} style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, boxSizing: 'border-box',
      padding: P.padTop + 'px ' + P.padX + 'px ' + P.padBottom + 'px',
      background: 'color-mix(in oklab, var(--surface-paper) 86%, transparent)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      borderTop: P.border + 'px solid var(--border-rule)', userSelect: 'none', outline: 'none',
      fontFamily: 'var(--font-ui)', color: 'var(--text-1)', ...style,
    }}>
      {/* THE TRANSPORT ROW — first in both states. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: M.row }}>
        {onPlayToggle ? (
          /* `PlayToggle` (WalkParts) — the strip's own button at this row's 20px. */
          <PlayToggle playing={playing} onToggle={onPlayToggle} size={M.row} glyph={[8, 10]} />
        ) : null}
        <span ref={nameRef} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text-walk)' }}>
          {step ? step.title : ''}
          {/* THE SAME SUFFIX THE OPEN ROW AND THE STRIP DRAW (owner, 2026-09-01) — the closed rail's
              name is the one place a stop is named while the dock is at rest, so it says
              optional the same way. Before the note, since the note is the territory. */}
          {step && step.optional ? <OptionalSuffix /> : null}
          {step && step.note ? <span style={{ fontWeight: 'var(--fw-regular)', color: 'var(--text-3)' }}>{' · ' + step.note}</span> : null}
        </span>
        {/* ONE READOUT, TWO FACES, AND IT IS ITS OWN PROGRESS BAR: position is the count of stops;
            percent is the fraction of the RAIL walked (pos over N−1), so 60/60 and 100% agree and
            1/60 reads 0%. The acorn wash fills the pill to the same fraction, so the number and the
            picture of the number sit in one 52px element. */}
        <button type="button" onClick={() => setFace(face === 'position' ? 'percent' : 'position')}
          title={wrapTip(face === 'position' ? 'click to show as a percentage' : 'click to show as stop of total')} style={{
            flex: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', minWidth: M.readoutMin, textAlign: 'center', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-snug)',
            color: pillHover ? 'var(--text-1)' : 'var(--text-2)', border: '1px solid ' + (pillHover ? 'var(--border-frame)' : 'var(--border-rule)'), borderRadius: 'var(--radius-pill)', padding: '1px 7px',
            background: 'linear-gradient(90deg, color-mix(in oklab, var(--accent-walk) 26%, var(--surface-raised)) ' + pc + ', var(--surface-raised) ' + pc + ')',
          } as CSSProperties}
          onMouseEnter={() => setPillHover(true)} onMouseLeave={() => setPillHover(false)}>
          {N === 0 ? '—' : face === 'position' ? (cur + 1) + ' / ' + N : Math.round(frac * 100) + '%'}
        </button>
        <button type="button" onClick={() => setOpen(!isOpen)} title={wrapTip(isOpen ? 'hide the stops' : 'show every stop')} aria-label={isOpen ? 'hide the stops' : 'show every stop'} aria-expanded={isOpen}
          style={{ ...btn, background: 'transparent', color: 'var(--text-2)' }}>
          <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" style={{ display: 'block', transition: 'transform ' + FOLD + ' ' + SOFT, transform: isOpen ? 'rotate(180deg)' : 'none' }}>
            <path d="M1 5 L5 1 L9 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* THE CLOSED RAIL — folds to nothing when open (the clip applies only while folding, so
          the hover knob is never cut at rest). */}
      <div ref={railRef} data-walk-dock-rail="" onPointerDown={onRailDown} onPointerMove={onRailMove} onPointerLeave={onLeave}
        onMouseEnter={() => setRailHover(true)} onMouseLeave={() => setRailHover(false)} style={{
          position: 'relative', cursor: 'pointer',
          height: isOpen ? 0 : M.rail, marginTop: isOpen ? 0 : P.railGap, opacity: isOpen ? 0 : 1,
          overflow: isOpen ? 'hidden' : 'visible', pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'height ' + FOLD + ' ' + SOFT + ', margin-top ' + FOLD + ' ' + SOFT + ', opacity .2s ' + SOFT,
        }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: M.rail / 2 - lineH / 2, height: lineH, borderRadius: 'var(--radius-pill)', background: 'var(--bark-100)', transition: 'height .15s ' + SOFT + ', top .15s ' + SOFT }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: at(frac), borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', opacity: 0.55 }} />
        </div>
        {steps.map((s, i) => {
          const b = walkBand(i, pos, band)
          return <div key={s.id} aria-hidden="true" style={{
            position: 'absolute', top: M.rail / 2, left: at(last ? i / last : 0), width: M.tick, height: b.tickHeight, borderRadius: 1,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: b.ink,
            background: b.behind ? 'var(--accent-walk)' : 'var(--bark-400)',
          }} />
        })}
        {N ? <div aria-hidden="true" data-walk-dock-knob="" style={{
          position: 'absolute', top: M.rail / 2, left: at(frac), width: knob, height: knob, borderRadius: 'var(--radius-pill)',
          background: 'var(--accent-walk)', boxShadow: 'var(--lift-1)', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          transition: 'width .15s ' + SOFT + ', height .15s ' + SOFT,
        }} /> : null}
      </div>
      {/* THE OPEN ROW — the same rail at the other size: real StepDot + WalkerMark, one line through
          the dots, the same fill and the same band as the ticks. */}
      <div style={{ height: isOpen ? M.rowH : 0, opacity: isOpen ? 1 : 0, overflow: 'hidden', transition: 'height ' + FOLD + ' ' + SOFT + ', opacity .2s ' + SOFT }}>
        <div ref={rowRef} data-sb-off="" onPointerDown={onRowDown} onPointerMove={onRowMove} onPointerLeave={onLeave}
          onMouseEnter={() => setRowHover(true)} onMouseLeave={() => setRowHover(false)} style={{
            overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', height: M.rowH, boxSizing: 'border-box', cursor: 'pointer',
          } as CSSProperties}>
          <div style={{ position: 'relative', display: 'flex', minWidth: 'max-content', paddingTop: 2 }}>
            {rowLive ? <Fragment>
            {/* THE LINE SPANS DOT CENTRE TO DOT CENTRE, not the columns' full width (OB-157). Each
               stop is a `stopW` column with its dot centred, so the first centre sits `stopW / 2`
               in and the last one `stopW / 2` short of the end — a `left: 0; right: 0` track hung
               half a column off BOTH ends. It read as a line continuing past the last stop, which
               on a walk means "there is more after this", the one thing the last stop must not
               say (owner, seen at 13 / 13, 2026-09-05, where scrolling to the end puts the overhang
               against empty space). The closed rail never had this: its ticks are placed at
               `i / last`, so its line already ends on a tick. At one stop the track has zero width
               and draws nothing — one stop is not a journey.
               ★ LOCAL: A WIDTH, NOT A `right` INSET. The DS's fix is `right: stopW / 2`, which ends
               on the last dot only when the row is at least as wide as its scroller. This row's
               container is a block child of the scroller with `minWidth: max-content`, so a walk
               narrower than the pane (the seed draft: 7 stops, 476px, in a ~780px pane) stretches
               the container to the pane's width and the track overhangs the last dot by the
               difference — measured 171px at 7 / 7, the same fault at a larger size. A width of
               `last * stopW` from the first centre ends on the last centre whether the row scrolls
               or not. Reported in the receipt. */}
            <div aria-hidden="true" data-walk-dock-track="" style={{ position: 'absolute', left: M.stopW / 2, width: Math.max(0, last * M.stopW), top: rowLineTop, height: rowLineH, borderRadius: 'var(--radius-pill)', background: 'var(--bark-100)', transition: 'height .15s ' + SOFT + ', top .15s ' + SOFT }} />
            {/* the walked part ends ON the current dot's centre, and starts on the first one's — at
               position 0 a `left: 0` fill stuck out to the left of stop 1 with nothing walked. */}
            <div aria-hidden="true" data-walk-dock-fill="" style={{ position: 'absolute', left: M.stopW / 2, top: rowLineTop, height: rowLineH, width: Math.max(0, pos * M.stopW), borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', opacity: 0.55, transition: 'height .15s ' + SOFT + ', top .15s ' + SOFT }} />
            {steps.map((s, i) => {
              const st = stopState(i, cur)
              const b = walkBand(i, pos, band)
              return (
                /* NO NATIVE `title` WHILE THE PREVIEW IS LIVE: the row's hover already opens
                   `WalkPreview` on this stop, and the browser's own tip then fades in on top of
                   it a second later — two tooltips for one pointer rest. The attribute survives
                   only for a host that passes no `renderPreview`, where a clamped title would
                   otherwise have no way to be read in full. */
                <div key={s.id} data-walk-dock-stop={i} title={renderPreview ? undefined : wrapTip(s.optional ? s.title + ' (optional)' : s.title)} style={{ position: 'relative', flex: 'none', width: M.stopW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: Math.max(b.ink, 0.35 * (1 - b.near) + b.near) }}>
                  <div style={{ height: M.walker, display: 'flex', alignItems: 'flex-end', color: 'var(--accent-walk)' }}>
                    {i === cur ? <WalkerMark size={M.walker} animated={playing} /> : null}
                  </div>
                  {/* THE DOT GROWS ALONE ON HOVER so the titles do not jump. */}
                  <div style={{ display: 'flex', transition: 'transform .15s ' + SOFT, transform: rowHover ? 'scale(1.18)' : 'none' }}>
                    {/* the DS's dock passes `progress={walkProgress({ from: i, to: i }, pos)}` here — the wash
                        `StepDot` grew on 2026-09-09. This port's StepDot has no `progress` prop yet (a lag on
                        that component, reported with OB-185), so the dock passes none: the dot draws as it
                        did. Add it back the day StepDot is re-ported. */}
                    <StepDot n={i + 1} state={st} size={M.stopDot} optional={!!s.optional} />
                  </div>
                  {/* `StopTitle` (WalkParts, 2026-09-01) — the strip's title rule at this row's density:
                      same clamp, same ink ladder, same " (optional)" suffix (which this row used to
                      lack — the drift that made the shared file). */}
                  <StopTitle title={s.title} optional={!!s.optional} state={st} lines={2} fontSize={10} lineHeight={1.25} style={{ padding: '0 3px' }} />
                </div>
              )
            })}
            </Fragment> : null}
          </div>
        </div>
      </div>
      {hover && renderPreview && steps[hover.i] ? (
        <WalkPreview x={hover.x} top={hover.top}>{renderPreview(steps[hover.i], hover.i)}</WalkPreview>
      ) : null}
    </div>
  )
}

export interface WalkPinHoverProps {
  /** the stop this pin stands for */
  step: WalkStep
  /** its index in the walk */
  index: number
  /** THE MARK THIS PIN STANDS FOR, when it stands for more than one stop — forwarded to
   *  `renderPreview` as its third argument, the same one the dock never sends, so one pin reading
   *  `"2-3"` previews BOTH stops instead of the first one silently. THE HOST BUILDS IT, and since
   *  2026-09-14 it is the ONLY mark in this system that spans more than one stop: the dock draws
   *  none, and a map pin's run is a fact about the LEVEL being drawn — a contiguous set of stops
   *  resolving to one cell, which may cross node boundaries and re-merges as the user zooms.
   *  Pass `{ from, to, label, steps }` in your own numbering; omit it for a one-stop pin. */
  mark?: WalkMark | null
  /** the same preview the dock and the strip show; omit it and the wrapper adds nothing */
  renderPreview?: (step: WalkStep, index: number, mark?: WalkMark) => ReactNode
  /** report-only, the same contract as `WalkDock.onStepHover` */
  onStepHover?: (index: number | null) => void
  /** whatever the host draws for one stop */
  children?: ReactNode
  /** placement only */
  style?: CSSProperties
}

/** A WALK PIN'S OWN HOVER, for a pin drawn in HTML (a `foreignObject` or an overlay): wraps
 *  whatever the host draws for one stop and shows the same preview the dock and the strip show,
 *  anchored on the pin's box. The map keeps drawing its pins — this adds the hover, nothing else.
 *  A pin that is a bare SVG `<g>` cannot take a `<span>` parent: there the host binds enter/leave
 *  on the `<g>` and renders `WalkPreview` itself with `previewAnchor(g.getBoundingClientRect())`
 *  — the same two lines this component is. Cursor-hover only (see `WalkPreview`). */
export function WalkPinHover({ step, index, mark, renderPreview, onStepHover, children, style }: WalkPinHoverProps) {
  const [anchor, setAnchor] = useState<{ x: number; top: number } | null>(null)
  return (
    <span style={{ display: 'inline-flex', ...style }}
      onMouseEnter={(e) => { setAnchor(previewAnchor(e.currentTarget.getBoundingClientRect())); if (onStepHover) onStepHover(index) }}
      onMouseLeave={() => { setAnchor(null); if (onStepHover) onStepHover(null) }}>
      {children}
      {anchor && renderPreview ? <WalkPreview x={anchor.x} top={anchor.top}>{renderPreview(step, index, mark ?? undefined)}</WalkPreview> : null}
    </span>
  )
}
