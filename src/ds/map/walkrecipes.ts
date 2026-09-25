// THE PURE RECIPES OF THE WALK, in a plain module (#338 step 4): extracted out of
// WalkDock.tsx so the model layer can read them through ds/values.ts without
// loading the component (a model test is a node program under tsconfig.node.json,
// which cannot compile a .tsx import). WalkDock.tsx re-exports every name here,
// so the barrel and every importer see one home.

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
