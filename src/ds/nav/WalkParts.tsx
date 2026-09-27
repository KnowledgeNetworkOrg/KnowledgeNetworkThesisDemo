import type { CSSProperties } from 'react'

import { wrapTip } from '../chrome/IconButton'

/** THE PARTS `WalkStrip` AND `WalkDock` DRAW THE SAME WAY, WRITTEN ONCE (owner, 2026-09-01). The
 *  strip is a pane and the dock is an overlay — two components, deliberately — but a stop's title
 *  under its dot, the "(optional)" suffix on it, the ink a stop's state earns and the play/pause
 *  button were drawn twice, once in each file, and the two copies had already disagreed: the
 *  dock's open row showed no "(optional)" at all while the strip's did. Two drawings of one rule
 *  drift the day one is edited; here the rule exists in one place and both hosts read it. Sizes
 *  stay the host's (the strip's 26px transport and `--fs-micro` titles, the dock's 20px and 10px)
 *  because those are the host's density decisions, not the rule.
 *
 *  Typed port of the DS WalkParts.jsx (contract: WalkParts.d.ts), OB-133 + OB-140, OB-196's
 *  replay state (`REPLAY_PATH`, `walkComplete`, `PlayToggle.completed`), and OB-216's italic
 *  optional name in `StopTitle` (as amended 2026-09-17: the name keeps the cursor's weight). */

export type StopState = 'done' | 'current' | 'ahead'

/** the transport glyphs, on a 14×16 viewBox; both hosts draw these paths and no others */
export const PLAY_PATH = 'M2 1.5 L12.5 8 L2 14.5 Z'
export const PAUSE_PATH = 'M2 1.5 H5.4 V14.5 H2 Z M8.6 1.5 H12 V14.5 H8.6 Z'
/** THE THIRD GLYPH — the walk has reached its last stop, so the button restarts it (owner,
 *  2026-09-16, DS OB-196, choosing the form: "like youtube"). A FILLED circular arrow,
 *  anticlockwise, its head at the top-right pointing back across the gap in the ring: the
 *  convention every media player has taught for "play it again from the start", which a double
 *  chevron does not say (that one means skip back). Filled rather than stroked so the button still
 *  draws ONE `fill` path for all three states — the ring is an annulus with a 300-degree band, not
 *  a stroked arc, constructed at 10× in the DS's `guidelines/replay-glyph.html` (centre 7,8 · radii
 *  6.7 and 4.1 · band open from -60 to 240 degrees). Re-tune it there rather than by editing this
 *  string by eye. IT FILLS ITS BOX, like `PLAY_PATH` does: a ring is a thin band around a hole, so
 *  the same extent inscribed politely read SMALLER than the solid triangle beside it. */
export const REPLAY_PATH = 'M10.35 2.2 A6.7 6.7 0 1 1 3.65 2.2 L4.95 4.45 A4.1 4.1 0 1 0 9.05 4.45 Z M11.2 0.73 L5.98 1.17 L8.2 5.92 Z'

/** HAS THE WALK REACHED ITS END — the one input the replay glyph needs (DS OB-196), published
 *  rather than left to each surface because it is an off-by-one in a place nothing would notice:
 *  a transport that answers "complete" one stop early offers to restart a walk still on its way
 *  to the last stop, and one stop late never offers it at all. `position` is the FRACTIONAL cursor
 *  every drawing of the walk reads, so the comparison carries the same epsilon `walkArrival` uses.
 *  A walk of one stop (or none) is never complete: there is nothing to replay.
 *
 *  A CALLER OBLIGATION COMES WITH IT: in this state the button's click means "back to the start
 *  and run", which is TWO calls in order — seek to 0, then play. Toggling alone plays a clock that
 *  is already at the end, i.e. for no frames, and that is the silent way to get this wrong.
 *  `WalkDock` does both itself unless the host passes `onReplay`. */
export function walkComplete(position: number, count: number): boolean {
  const n = Number(count) || 0
  if (n < 2) return false
  return (Number(position) || 0) + 1e-9 >= n - 1
}

/** A STOP'S STATE FROM ITS INDEX AND THE CURSOR — behind is `done`, on is `current`, past is
 *  `ahead`. `StepDot`'s three states, derived one way for every surface. */
export function stopState(index: number, cursor: number): StopState {
  return index < cursor ? 'done' : index === cursor ? 'current' : 'ahead'
}

/** THE INK A STOP'S TITLE TAKES FOR ITS STATE: acorn on the cursor (`--text-walk`, movement),
 *  `--text-2` behind it (a fact — where you have been), `--text-3` ahead (furniture until you get
 *  there). Same ladder on the strip and in the dock's open row. */
export function stopInk(state: StopState): string {
  return state === 'current' ? 'var(--text-walk)' : state === 'done' ? 'var(--text-2)' : 'var(--text-3)'
}

/** A MARK ON THE WALK, as `walkProgress` reads it — `from`/`to` are STEP indices (feed them to
 *  `walkBandSpan` too). On the dock and the strip a mark IS a step, so `from === to`.
 *
 *  A MARK SPANNING SEVERAL STOPS IS THE HOST'S, and only the map has one: its pins merge a
 *  contiguous run of stops that resolve to one CELL at the level being drawn, labelled `"2-3"`.
 *  Ruled 2026-09-14 (owner): THE DOCK AND THE STRIP DRAW NO RANGES — a stop is a stop on a control
 *  that lists the walk. The by-NODE grouping the DS shipped on 2026-09-09 (`walkRanges` /
 *  `walkMarkAt`, marks numbered `2.1–2.3`) is REMOVED with that ruling: it made a mark mean "one
 *  node, several visits" there and "several nodes, one cell" on the map, so the two pills were two
 *  different claims wearing one shape. This port never took that grouping (OB-185 clause 1);
 *  nothing here derives a mark. */
export interface WalkMark {
  from: number
  to: number
  /** what the HOST prints on a merged pin, e.g. `"1.1–1.3"` (`walkMarkLabel`). Never minted here. */
  label?: string
  /** the steps the mark covers, for a host card that reads them */
  steps?: unknown[]
  /** ★ LOCAL: the ADDRESSES of the steps the mark covers (`walkAddresses(steps)` sliced to the
   *  run), aligned to `steps` — what the merged pin's card prints for the one stop it names
   *  (DS OB-186: "the stop this card names carries the PIN's numbering"). The card sees only
   *  the run, and an address is counted across the whole walk, so the host hands it over. */
  addresses?: string[]
}

/** HOW MUCH OF A MARK THE WALK HAS PASSED, 0…1 — what `StepDot`'s `progress` wants for the wash.
 *  A one-step mark is 0 until the cursor reaches it and 1 after; the fractional case is a HOST's
 *  merged mark (a map pin covering a run of stops), which washes a step at a time as the class
 *  works through it. Published rather than left to callers because it is an off-by-one waiting to
 *  happen: a mark is complete when the cursor has PASSED its last step, not when it arrives at it. */
export function walkProgress(mark: WalkMark, position: number): number {
  if (position < mark.from) return 0
  if (position > mark.to) return 1
  const span = mark.to - mark.from + 1
  return Math.max(0, Math.min(1, (Math.floor(position + 1e-4) - mark.from + 1) / span))
}

/** WHICH ONE STOP A MERGED PIN'S HOVER CARD PREVIEWS — the cursor CLAMPED into the mark's span
 *  (owner's ruling 2026-09-15, DS OB-186, choosing this over listing every stop under the pin).
 *
 *  A merged map pin covers a contiguous run of stops that resolve to one cell at the level being
 *  drawn, so it usually covers several DIFFERENT documents and the card can only be one of them.
 *  A walk is ordered, and that is what settles which: ahead of the cursor the honest lead is the
 *  run's FIRST stop (what you are about to reach), behind it the run's LAST (where you left it),
 *  and inside it the stop you are standing on. Those three cases are one clamp. The host then
 *  says how many others the pin covers — the count is `mark.to - mark.from`, and admitting it is
 *  not optional: the card names one of several documents and nothing else on screen says so.
 *
 *  PASS THE ARRIVAL CURSOR, NOT THE FRACTIONAL POSITION — `walkArrival(position)`. At position
 *  4.6 the walk has ARRIVED at 4 and is travelling; rounding it to 5 names a stop it has not
 *  reached, and on a two-stop pin that is the whole answer wrong. This rounds a fractional input
 *  rather than trusting it, which makes a careless caller merely late instead of wrong.
 *
 *  PUBLISHED BECAUSE THE WRONG END IS SILENT. Leading a run with `mark.from` unconditionally —
 *  the natural way to write it, and what `WalkPinHover`'s own `step` argument invites — previews
 *  the stop the walk finished with hours ago and looks perfectly correct. */
export function walkLeadStop(mark: WalkMark, cursor: number): number {
  const c = Math.round(Number.isFinite(cursor) ? cursor : mark.from)
  return Math.min(mark.to, Math.max(mark.from, c))
}

/** THE ONE WORD FOR A STEP THE WALK MAY SKIP — fixed at " (optional)", italic at regular weight,
 *  `--text-3`, inline after the name with a single space (owner, 2026-08-23) — the same word and
 *  the same styling `NodeChip`'s own optional label uses. Never its own line, never a colour.
 *
 *  SINCE 2026-09-17 THE NAME BESIDE IT IS ITALIC TOO (DS OB-216), so italic is no longer what
 *  SEPARATES this word from the name — the parentheses and `--text-3` are. Do not drop one of them
 *  as redundant, or the word has nothing left distinguishing it from the title it follows. Weight
 *  is a third separator on a CURRENT optional stop: the name is semibold italic and this word
 *  stays REGULAR, deliberately — it is furniture after the name, and a semibold suffix reads as a
 *  second title. Do not make it follow the name's weight. */
export function OptionalSuffix({ style }: { style?: CSSProperties }) {
  return <span style={{ fontStyle: 'italic', fontWeight: 'var(--fw-regular)', color: 'var(--text-3)', ...style }}> (optional)</span>
}

export interface StopTitleProps {
  /** the step's name */
  title: string
  /** italicises the name, appends `OptionalSuffix` and gives the clamp one more line for it */
  optional?: boolean
  /** picks the weight (semibold only on `current`) and the ink (`stopInk`) */
  state?: StopState
  /** the clamp for a NON-optional title; an optional one gets `lines + 1`. Default 2. */
  lines?: number
  /** the host's density. Defaults: `var(--fs-micro)` / `var(--lh-snug)` (the strip's); the dock passes 10 / 1.25 */
  fontSize?: string | number
  /** the host's density — see `fontSize` */
  lineHeight?: string | number
  /** PLACEMENT ONLY — width, margin, padding. Never type, weight or colour: those are the rule. */
  style?: CSSProperties
}

/** A STOP'S NAME UNDER ITS DOT: centred, wrapped and clamped to `lines`, weighted semibold only
 *  on the cursor, inked by `stopInk(state)`, and carrying `OptionalSuffix` when the step is
 *  optional. THE CLAMP GAINS A LINE FOR AN OPTIONAL STEP — the suffix shares the clamped box with
 *  the name, and a title that already fills every clamped line swallows it (owner-reported on the
 *  strip, 2026-08-23: line-clamp cuts whatever overflows its OWN box, and the suffix is what
 *  overflows first). A host whose row height is derived from this budgets `lines + 1` lines.
 *  `fontSize`/`lineHeight` are the host's density; `style` places the box (width, margin,
 *  padding) and never restyles the type.
 *
 *  AN OPTIONAL STOP'S NAME IS ITSELF ITALIC (DS OB-216, owner, 2026-09-17: "can we make the title
 *  and number step inside italic too") — the whole name, not just the suffix after it, so the stop
 *  reads as skippable from the type rather than from a word at the end of a clamped line that may
 *  have been cut. `StepDot` slants the numeral the same turn (`StepDotMath.oblique`).
 *
 *  AND IT KEEPS THE CURSOR'S SEMIBOLD (the item's amendment, same day — owner: "we should have bold
 *  italic as it's weird if the bold is dropped"). The weight is picked by `state` ALONE, with no
 *  branch on `optional`: an optional CURRENT stop is semibold italic. That is real type, not a
 *  synthesised slant, only because `tokens/fonts.css` loads Nunito's VARIABLE italic at 400-800 —
 *  the italic declared at 400 alone would have rendered this as a fake bold. The widths move +1.4%
 *  at semibold italic; nothing here predicts a box (the clamp is a line count), so nothing is
 *  under-reserved. */
export function StopTitle({ title, optional = false, state = 'ahead', lines = 2, fontSize = 'var(--fs-micro)', lineHeight = 'var(--lh-snug)', style }: StopTitleProps) {
  return (
    <span style={{
      overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: optional ? lines + 1 : lines,
      textAlign: 'center', textWrap: 'pretty', fontFamily: 'var(--font-ui)', fontSize, lineHeight,
      fontStyle: optional ? 'italic' : undefined,
      fontWeight: state === 'current' ? 'var(--fw-semibold)' : 'var(--fw-regular)', color: stopInk(state),
      ...style,
    } as CSSProperties}>{title}{optional ? <OptionalSuffix /> : null}</span>
  )
}

export interface PlayToggleProps {
  /** which glyph draws — display only; the host sets it from its own clock */
  playing?: boolean
  /** the walk is at its last stop, so the glyph becomes the circular replay arrow and the label
   *  says "replay the walk from the start". DERIVED, never a mode set by hand: pass
   *  `walkComplete(position, count)`. `playing` WINS — a completed walk being played again shows a
   *  pause, and the two are legitimately true together for the frame the cursor sits on the last
   *  stop. The CLICK means something else in this state; see `walkComplete` for the two calls it
   *  owes. */
  completed?: boolean
  /** fires; the HOST plays. Does not fire any seek. */
  onToggle?: () => void
  /** the round button's side. The strip passes `WALK_METRICS.transport` (26), the dock `WALK_DOCK_METRICS.row` (20). */
  size?: number
  /** the glyph's [width, height] inside it; [11, 12] in the strip, [8, 10] in the dock */
  glyph?: [number, number]
  /** placement only */
  style?: CSSProperties
}

/** THE TRANSPORT: one round acorn button, a play, pause or replay glyph, at the host's `size`
 *  with the glyph at `glyph` = [width, height] (the strip draws 11×12 in a 26px button, the dock
 *  8×10 in 20px). Fires `onToggle`; the HOST runs the walk and holds the clock — this is display
 *  and a report, the same split both hosts already make. `playing` only picks the glyph.
 *
 *  `completed` IS THE THIRD STATE AND IT IS A PICTURE, NOT A SECOND BUTTON (owner, 2026-09-16, DS
 *  OB-196). The button stays in one place, keeps one hit box and one channel; only the glyph and
 *  the label change. It is DERIVED, never a mode a caller sets by hand: pass
 *  `walkComplete(position, count)`. `playing` WINS over it — a completed walk being played again
 *  is a pause button, not a replay one.
 *
 *  WHAT THE CLICK MEANS IS THE HOST'S, and it is a different sentence in this state: play/pause
 *  toggles the clock, replay means "put the cursor back at stop 1 and run". A host wiring one
 *  handler to all three states restarts nothing — the clock is already at the end, so the walk
 *  plays for no frames. `WalkDock` takes an `onReplay` for it and falls back to `onSeek(0)` then
 *  `onPlayToggle()`; a surface using this button directly owes the same two calls, in that order. */
export function PlayToggle({ playing = false, completed = false, onToggle, size = 26, glyph = [11, 12], style }: PlayToggleProps) {
  const label = playing ? 'pause the walk' : completed ? 'replay the walk from the start' : 'play the walk'
  return (
    <button type="button" onClick={onToggle} title={wrapTip(label)} aria-label={label} style={{
      flex: 'none', width: size, height: size, padding: 0, appearance: 'none', WebkitAppearance: 'none', border: 'none',
      borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', color: 'var(--text-inverse)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...style,
    }}>
      <svg width={glyph[0]} height={glyph[1]} viewBox="0 0 14 16" aria-hidden="true" style={{ display: 'block' }}>
        <path d={playing ? PAUSE_PATH : completed ? REPLAY_PATH : PLAY_PATH} fill="currentColor" />
      </svg>
    </button>
  )
}

/** HOW MUCH A STOP GROWS UNDER THE POINTER — 1.18, and it is a LOOK, not a derivation (owner,
 *  2026-09-04, OB-140). IT IS A SCALE AND NOT A FACE, a deliberate exception to the house hover
 *  rule ("the face changes; no scale, no translate"). That rule is about CHROME — buttons, rows,
 *  pills — where a growing control moves its neighbours and reads as a click already happening. A
 *  walk stop is not chrome: it is a mark on a line whose own vocabulary is already SIZE
 *  (`walkBand`'s `grow` scales dots by recency), it is absolutely positioned or sits in a fixed
 *  slot on every surface that draws it, so nothing reflows, and the pointer needs to say WHICH
 *  stop it is on when the ticks are 2px apart at the ends. Published here so the strip, the dock
 *  and the presenter strip grow by the same amount. */
export const WALK_HOVER_GROW = 1.18

/** AND HOW MUCH THE WHOLE ROW GROWS WHILE THE POINTER IS ANYWHERE ON IT — 1.08 (owner, 2026-09-04).
 *  Two factors, because they are two facts: the row says "you are on me", the hovered stop says
 *  "and this one". IT GROWS THE MARKS, NOT THE ROW'S BOX — scaling the row itself would push its
 *  ends outside the pane's frame; every mark scales in place instead, and the LINE thickens with
 *  them, which is what makes it read as the row growing rather than as a dozen dots twitching. */
export const WALK_ROW_HOVER_GROW = 1.08

/** THE FALLOFF, as fractions of the distance from the row's base grow to the pointed stop's peak:
 *  the stop under the pointer takes the whole of it, its neighbours half, the next pair a sixth.
 *  CHOSEN, not derived — three rungs because a fourth is under a quarter of a pixel on an 18px
 *  dot, and 0.5/0.18 rather than a smooth curve because the row is 68px per stop and the eye is
 *  reading rank ("this one, then those"), not a gradient. (DS OB-190, 2026-09-15.) */
export const WALK_SWELL_FALLOFF: readonly number[] = [1, 0.5, 0.18]

/** HOW MUCH THE STOP AT `i` GROWS WHILE THE POINTER IS ON THE ROW AT `hovered` — the whole swell
 *  rule as one function, because it is the answer to a question two surfaces ask (owner,
 *  2026-09-15, DS OB-190, choosing it on `ideas/row-swell.html` over the flat all-row swell that
 *  shipped).
 *
 *  IT STILL DOES BOTH JOBS THE TWO CONSTANTS WERE WRITTEN FOR, and that is why it is a falloff and
 *  not a single hovered stop: the row answers "you are on me" by putting EVERY mark at
 *  `WALK_ROW_HOVER_GROW`, and the pointer answers "and this one" by rising from that floor to
 *  `WALK_HOVER_GROW` over two stops either side. The flat version could only do the first — with
 *  every dot at one factor, nothing said where the pointer was.
 *
 *  `hovered == null` (the pointer off the row) is 1, NOT the base: the base is a hover state, and
 *  a row at rest is a row at rest.
 *
 *  A FUNCTION RATHER THAN THREE MORE CONSTANTS — the ladder is a recipe, and a recipe retyped by
 *  eye is where the dock's own row drifted to a flat 1.18 against the 1.08 published here (found
 *  2026-09-15, shipped wrong since 2026-09-04: `WALK_ROW_HOVER_GROW` was never declared in the
 *  DS's `.d.ts`, so nothing reading the contract could know the row had a base distinct from the
 *  peak). Spread the result through `walkHoverStyle(walkRowSwell(i, hovered))`; never restate
 *  either factor. */
export function walkRowSwell(i: number, hovered: number | null | undefined, base = WALK_ROW_HOVER_GROW, peak = WALK_HOVER_GROW): number {
  if (hovered == null) return 1
  const f = WALK_SWELL_FALLOFF[Math.abs(i - hovered)]
  return f === undefined ? base : base + (peak - base) * f
}

/** THE WHOLE STYLE FRAGMENT FOR A HOVER SCALE — spread it, never restate it (owner, 2026-09-04:
 *  "the effect on the numbers in the node a bit jiggly").
 *
 *  WHY THE NUMBER JIGGLED: a stop's numeral is TEXT inside the box being scaled, and a browser
 *  re-rasterizes text on every frame of a scale transition to keep it crisp. At fractional scales
 *  the glyph's baseline lands between device pixels and the rounding differs frame to frame, so
 *  the digit walks up and down by a fraction of a pixel while the disc around it moves smoothly.
 *
 *  THE FIX IS TO RASTERIZE ONCE AND SCALE THE PICTURE: `translateZ(0)` (plus the hint and the
 *  backface flag) promotes the mark to its own composited layer. The cost is honest: at 1.18 the
 *  numeral is very slightly softer at the peak of the gesture. A FACTORY, not a documented recipe,
 *  because `translateZ(0)` looks like a no-op and is the entire fix, so anyone rewriting this by
 *  eye would drop it. Pass `prefix` when the same property must also carry a centring translate. */
export function walkHoverStyle(scale: number, prefix?: string): { transform: string; transition: string; willChange: string; backfaceVisibility: 'hidden' } {
  return {
    transform: (prefix ? prefix + ' ' : '') + 'scale(' + scale + ') translateZ(0)',
    transition: 'transform var(--dur-hover) var(--ease-soft)',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
  }
}

/** THE STOP'S ADDRESS ON EVERY SURFACE THAT IS NOT THE EDITOR — exactly TWO numbers, at any
 *  nesting depth: the top-level walk step, then the stop's ordinal among that step's stops with
 *  the nesting flattened away. `"1.4"`. Returns one string per step, aligned to `steps`.
 *
 *  THE OWNER'S RULING, 2026-09-15 (DS OB-188), and both halves of it matter. The walk editor, the
 *  map and the dock are to print ONE numbering (their screenshot: the map drew "1" twice while the
 *  dock said 2 and the editor said 1.2 — three answers for one stop). The numbering is the
 *  editor's own path, because it already exists: `VersionedGroup` composes a group ordinal plus a
 *  child ordinal, and `WalkPreview` has been printing it in a hover card all along. But a path
 *  GROWS with nesting, and `StepDot`'s `n` will not carry four numbers on a 26px pin — so on the
 *  two surfaces that cannot show structure the address is capped at two numbers. Three length
 *  rules were drawn three levels deep and measured at 1:1: the full path put the widest map mark
 *  at 111px and an elide-to-the-last-two at 71px, against 58px here — the same width the un-nested
 *  walk already drew. The full path stays where nesting is visible: the editor keeps
 *  `numberScope: 'local'` and is untouched.
 *
 *  WHAT IT COSTS, SO NOBODY "FIXES" IT: at depth 2 or deeper only the FIRST number matches the
 *  editor's chip — the editor says `1.` inside a subgroup where the dock says `1.4`. Accepted, on
 *  the same reasoning `numberScope` already carries: a path repeats what the nesting shows on
 *  screen, and these two surfaces draw no nesting to repeat.
 *
 *  PASS THE PATH, GET THE ADDRESS. A step's `path` is its position in the group structure,
 *  outermost first (`[1, 2, 3, 2]`); the host has it, this side cannot know it. A step WITHOUT a
 *  path is a top-level stop and addresses as its own step number alone, which is what every
 *  existing caller already draws.
 *
 *  PUBLISHED AS CODE BECAUSE THE FLATTENING IS SILENT. Counting a stop's ordinal within its
 *  top-level step means counting across subgroup boundaries in WALK ORDER — and the natural
 *  mistakes (the path's last element, which restarts at every group; the flat walk index, which
 *  ignores the step; same-depth siblings only) all produce a plausible two-number label that is
 *  wrong for exactly the stops a nested walk has. */
export function walkAddresses(steps: readonly { path?: readonly number[] }[]): string[] {
  const list = Array.isArray(steps) ? steps : []
  const seen = new Map<number, number>()
  return list.map((s, i) => {
    const path = s && Array.isArray(s.path) && s.path.length ? s.path : null
    const top = path ? path[0] : i + 1
    /* the ordinal is counted in walk order within the top-level step, so nesting collapses. A
       top-level stop with no path is its own step and takes no second number. */
    if (!path || path.length === 1) { seen.set(top, (seen.get(top) || 0) + 1); return String(top) }
    const n = (seen.get(top) || 0) + 1
    seen.set(top, n)
    return top + '.' + n
  })
}

/** THE LABEL FOR A MERGED MAP PIN — the addresses of the run's two ends, joined by an en dash
 *  (`"1.1–1.3"`), or the single address when the mark covers one stop. Feed it the same `steps`
 *  and the mark the host built.
 *
 *  PUBLISHED FOR THE SAME REASON `walkLeadStop` is: a caller composing this by hand reaches for the
 *  mark's own `from`/`to` (flat walk indices — a different numbering entirely, which is the option
 *  the owner rejected on 2026-09-15) or for the full path of each end, which is the label that
 *  measured 111px. Both look right on a one-stop pin and only diverge where a walk merges.
 *
 *  THE DASH IS AN EN DASH, not a hyphen: a hyphen is what the flat-index range `"2-3"` used, and
 *  the two notations have to be distinguishable while any of the app still draws the old one.
 *
 *  ★ LOCAL: `mark.from`/`mark.to` ARE 0-BASED STEP INDICES HERE, as `walkProgress` and
 *  `walkLeadStop` read them and as `WalkMark`'s own docblock says. The DS's `.jsx` indexes
 *  `all[mark.from - 1]`, which is right only for a 1-based mark — on a 0-based one the first
 *  pin's run would print "0". Reported on the receipt; this port reads the mark the way the
 *  other two functions in this file do. */
export function walkMarkLabel(steps: readonly { path?: readonly number[] }[], mark: WalkMark | null | undefined): string {
  if (!mark) return ''
  const all = walkAddresses(steps)
  const from = all[mark.from] || String(mark.from + 1)
  const to = all[mark.to] || String(mark.to + 1)
  return from === to ? from : from + '\u2013' + to
}

/** THE SAME PARTS AS ONE OBJECT, named for the file (the DS's bundler wants an export named
 *  `WalkParts`; a consumer that prefers one import gets it). The named exports above are the
 *  primary API. */
export const WalkParts = { StopTitle, PlayToggle, OptionalSuffix, stopState, stopInk, rowSwell: walkRowSwell, SWELL_FALLOFF: WALK_SWELL_FALLOFF, progress: walkProgress, leadStop: walkLeadStop, addresses: walkAddresses, markLabel: walkMarkLabel, complete: walkComplete, PLAY_PATH, PAUSE_PATH, REPLAY_PATH, WALK_HOVER_GROW, WALK_ROW_HOVER_GROW, hoverStyle: walkHoverStyle }
