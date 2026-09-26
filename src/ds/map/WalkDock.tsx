import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { StepDot } from '../nav/StepDot'
import { WalkerMark } from '../chrome/WalkerMark'
import { WalkPreview, previewAnchor } from '../nav/WalkPreview'
import { StopTitle, PlayToggle, OptionalSuffix, stopState, walkProgress, walkAddresses, walkRowSwell, walkHoverStyle, walkComplete } from '../nav/WalkParts'
import type { WalkMark } from '../nav/WalkParts'
import { wrapTip } from '../chrome/IconButton'
import type { WalkStep } from '../nav/WalkStrip'

/** Typed port of the DS WalkDock.jsx (contract: WalkDock.d.ts), OB-130 with OB-133's parts and
 *  OB-131's preview. The band, the arrow recipe and the clock (`walkBand`, `walkArrow`,
 *  `walkAdvance`) are published here as the DS publishes them, for OB-132 to consume. NOT
 *  PORTED: `WalkMath`, the capital-initial bundle the DS exports so its own cards can reach the
 *  band through `window.<Namespace>` — its `.d.ts` says "nothing here is required in `src/ds`",
 *  and OB-130 clause (8) says do not add it to the barrel and do not import it. Nor OB-216's
 *  italic name on the closed rail: that is a separate obligation, and this port took OB-196's
 *  replay and name hover only. */

import { walkBand, WALK_PLAYBACK_DEFAULTS } from './walkrecipes'
import type { WalkBand } from './walkrecipes'

export { walkBand, walkBandSpan, segmentWalked, walkArrow, walkEase, walkAdvance, walkArrival, walkArrivalLag, walkLook, WALK_BAND_DEFAULTS, WALK_ARROW_DEFAULTS, WALK_PLAYBACK_DEFAULTS, WALK_LOOK_DEFAULTS } from './walkrecipes'
export type { WalkBand, WalkBandReading, WalkArrowGeom, WalkPlayback, WalkLook } from './walkrecipes'

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
/* THE EXTERNAL-HOVER HALO AND ITS PAN, published on `WALK_DOCK_METRICS` (`halo`, `panMs`) rather
   than left as literals, because a host drawing its own pin for the SAME hover has to match this
   mark and a number in prose gets retyped. CHOSEN, both of them: 3px at 30% is the weight that
   reads on an 18px dot without becoming a second ring, and `--accent-walk` mixed toward
   transparent never competes with the cursor's solid fill. 260ms is one fold (280) less a frame,
   so a pan and a fold that run together do not finish at visibly different times. (DS OB-189.) */
const HALO = 'color-mix(in oklab, var(--accent-walk) 30%, transparent)'
const HALO_W = 3
const PAN_MS = 260
export const WALK_DOCK_METRICS = {
  ...P,
  /** the ring an externally hovered stop wears — OUTSIDE the face (OB-189) */
  halo: HALO,
  haloWidth: HALO_W,
  /** ms the open row takes to pan to an off-screen hovered stop. CHOSEN. */
  panMs: PAN_MS,
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
  /** THE TRANSPORT'S THIRD STATE, and the only new call it takes: once the cursor is on the last
   *  stop the button draws the replay arrow and its click means "back to stop 1 and run" (owner,
   *  2026-09-16, DS OB-196). The dock derives the state with `walkComplete(position,
   *  steps.length)` — it is never a prop — and a walk being played shows a pause regardless.
   *
   *  WITHOUT THIS HANDLER the dock does the restart through the two channels it already has:
   *  `onSeek(0)` at once and then `onPlayToggle()` after `restartPause`. That is correct and needs
   *  no adoption. Pass `onReplay` when your store can set cursor and playing in ONE write — and
   *  then the beat is yours too, because this skips it. */
  onReplay?: () => void
  /** THE BEAT BETWEEN A REPLAY CLICK AND THE WALK RUNNING, in ms. Defaults to
   *  `WALK_PLAYBACK_DEFAULTS.restartPause` (600, CHOSEN). The cursor goes back at ONCE and the
   *  walk starts after this pause, because a replay makes two statements — you are at the
   *  beginning, then we go — and run together the jump back is never seen.
   *
   *  ANY SEEK DURING THE PAUSE CANCELS THE PENDING START, and so does a second press of the
   *  button or the space bar: a user who has chosen where to be during the beat does not get the
   *  walk starting out from under them. IGNORED WHEN `onReplay` IS GIVEN — a host doing the
   *  restart in one write owns the beat too, and two pauses read as a stutter. */
  restartPause?: number
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
   *  THE CURRENT STOP'S NAME IN THE TRANSPORT ROW IS A FOURTH WAY IN (owner, 2026-09-16, DS
   *  OB-196). It was the only named stop on the surface with no way to read what is in it, and it
   *  is the one a reader meets first, because it is what the dock shows at rest. The card anchors
   *  on the WORDS, not on the name's slot (the slot is `flex: 1` and a short name sits at its left
   *  end), and a truncated name anchors on the clip. IT REPORTS NOTHING THROUGH `onStepHover`:
   *  that channel says "the reader is pointing at THIS stop", and pointing at the readout of where
   *  the walk already stands says nothing new — it would light the current stop's halo on this
   *  very row.
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
  /** A STOP ANOTHER PANE IS POINTING AT — the walk editor's pointer, reported IN (DS OB-189,
   *  owner 2026-09-15: "when we hover over a node pill in the editor, the map highlights, i also
   *  want the relevant walk stop in the walk dock to highlight too … it shouldnt select it tho
   *  on hover"). Draws a halo OUTSIDE that stop's mark, and pans the open row to it if it is
   *  off-screen. `null` clears. WHAT THE HOST MUST DO: 1. REPORT, DO NOT SEEK — this never
   *  moves `position`; a hover is transient and undone on leave (OB-142/151 clause 5). 2. PASS
   *  `null` ON LEAVE — the row then hands itself back to the cursor (`follow()` owns this
   *  scroller; a stale index parks the row where the walk is not). 3. DRAW NO PREVIEW CARD for
   *  it — `WalkPreview` rule 3: a hover published by another pane has no pointer over this
   *  surface to anchor a card to. THE PAN IS OFF-SCREEN-ONLY (OB-179's rule for the map camera,
   *  same reason), a hand-written tween on `WALK_DOCK_METRICS.panMs`, never `scrollTo({
   *  behavior: 'smooth' })` (traced 2026-09-15: the native smooth scroll asked for 598.5px and
   *  the row never moved); `prefers-reduced-motion` jumps; a DRAG in progress beats it.
   *  THERE IS NO `selected` PROP, AND THAT IS A RULING: a click in the editor selects the node
   *  on the MAP; the dock's only persistent mark is the cursor, and the dock is the one surface
   *  that may move it. The halo was the open row's last free channel (a keyboard focus ring on
   *  these dots cannot have it). */
  hoveredStep?: number | null
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
export function WalkDock({ steps = [], position = 0, playing = false, onPlayToggle, onReplay, restartPause, onSeek, open, defaultOpen = false, onOpenChange, metric, defaultMetric = 'position', onMetricChange, band, renderPreview, onStepHover, hoveredStep, style }: WalkDockProps) {
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
  /* THE ADDRESS, NOT THE INDEX (owner, 2026-09-15, DS OB-188). A stop carrying `path` addresses as
     "1.4" — the same label the map pin prints, capped at two numbers so nesting cannot lengthen
     it. A step with no `path` addresses as `i + 1` inside `walkAddresses` itself, which IS the
     drawing this row made before the ruling. Memoised on `steps` because the ordinals are counted
     across the whole list. */
  const addr = useMemo(() => walkAddresses(steps), [steps])
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
  /* THE REPLAY, IN TWO BEATS (DS OB-196). The cursor goes back at once — so the pins, the ticks
     and the name all say "stop 1" while the room is still looking at the click — and the walk
     starts `restartPause` later. One call would hide the jump back inside the first travel; see
     `WALK_PLAYBACK_DEFAULTS.restartPause`.
     ANY SEEK CANCELS THE PENDING START, which is why `seek` clears the timer rather than the
     handlers doing it one by one: the user dragging the rail during the pause has chosen where to
     be, and a walk that starts running out from under that is the fault this guard exists for.
     A SECOND PRESS of the button or the space bar cancels it too (their own handlers below).
     `onReplay` SKIPS ALL OF IT: a host doing the restart in one write owns the beat as well, and
     two pauses — theirs and ours — would read as a stutter. */
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pause = restartPause === undefined ? WALK_PLAYBACK_DEFAULTS.restartPause : restartPause
  const cancelRestart = () => { if (restartRef.current !== null) { clearTimeout(restartRef.current); restartRef.current = null } }
  useEffect(() => () => { if (restartRef.current !== null) clearTimeout(restartRef.current) }, [])
  /* ★ LOCAL: THE DELAYED START CALLS THE HOST'S TOGGLE AS IT IS WHEN THE BEAT ENDS, not as it was
     at the click. The DS's timer closes over the click's `onPlayToggle`, and this app's toggle is a
     fresh closure per render that remembers its render's cursor — the LAST stop, at the click — so
     it would re-seek to stop 1 and write the focus a second time (a second entry on the trail).
     Read through a ref written after every render, the toggle sees the cursor already at 0. And a
     walk something else started during the beat is left running rather than paused. */
  const playRef = useRef({ onPlayToggle, playing })
  useEffect(() => { playRef.current = { onPlayToggle, playing } })
  /* ★ LOCAL: A SEEK FROM ANOTHER PANE CANCELS THE START TOO. The DS cancels on this dock's own
     seeks; the viewer's strip and the presenter move the same cursor, and a user who picks a stop
     there during the beat has chosen where to be just the same (OB-196 clause 3b: "cursor
     wherever the user put it, `playing` still false"). The replay's own jump lands on 0, which is
     the one change this lets through. */
  useEffect(() => {
    if (cur !== 0 && restartRef.current !== null) { clearTimeout(restartRef.current); restartRef.current = null }
  }, [cur])
  const seek = (i: number) => { cancelRestart(); if (onSeek && N) onSeek(clampI(i)) }
  const restart = () => {
    if (onReplay) { onReplay(); return }
    seek(0)
    restartRef.current = setTimeout(() => {
      restartRef.current = null
      const p = playRef.current
      if (p.onPlayToggle && !p.playing) p.onPlayToggle()
    }, Math.max(0, pause))
  }
  const complete = walkComplete(pos, N)
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
  /* THE NAME IN THE TRANSPORT ROW GETS THE SAME CARD (owner, 2026-09-16, DS OB-196). It is the one
     place a stop is named while the dock is at rest, and it was the only named stop on the whole
     surface with no way to read what is in it — every tick, every dot and every map pin opens the
     preview. Anchored on the NAME's own box, the discrete case, not the pointer: the name is one
     object, not a scrub.
     IT REPORTS NOTHING TO THE HOST, and that is the difference from a stop hover: `onStepHover`
     publishes "the reader is pointing at THIS stop" to the other panes, and pointing at the
     readout of where the walk already is says nothing new — it would light the current stop's
     halo on this very row for as long as the pointer rested on its own label. */
  const nameEnter = (e: ReactMouseEvent<HTMLSpanElement>) => {
    if (!N || !renderPreview) return
    const el = e.currentTarget
    const box = el.getBoundingClientRect()
    /* THE CARD CENTRES ON THE WORDS, NOT ON THE SLOT. This span is `flex: 1` — it owns the whole
       gap between the button and the readout, so its own box is the row's leftover width and a
       short name sits at the left end of it. Anchoring on the box put the card a long way right
       of the thing it describes. A Range over the contents gives the text's true width, which for
       a truncated name runs PAST the clip, so the right edge is clamped back to the box. */
    let right = box.right
    if (el.firstChild && typeof document !== 'undefined' && document.createRange) {
      const rng = document.createRange()
      rng.selectNodeContents(el)
      const tr = rng.getBoundingClientRect()
      if (tr.width) right = Math.min(box.right, tr.right)
    }
    setHover({ i: cur, x: (box.left + right) / 2, top: box.top })
  }
  const nameLeave = () => { if (!dragRef.current) setHover(null) }
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

  /* AN EXTERNALLY HOVERED STOP — another pane (the walk editor) reporting where ITS pointer is
     (DS OB-189). Two jobs, and both are rules this system already settled somewhere else. THE
     HALO IS THE MARK (owner, 2026-09-15, chosen over the title's ink and a column wash). It sits
     OUTSIDE the face because every channel on the face is spoken for: the fill and ring carry
     `state`, the face carries `progress`, and SCALE is spent on the row's swell. NO PREVIEW
     CARD, ever, on this channel — `WalkPreview` rule 3. AND IT NEVER SELECTS OR SEEKS —
     `position` is untouched here; see the `hoveredStep` docblock for why the dock has no
     selected channel at all. */
  const extHover = hoveredStep == null || !N ? null : clampI(hoveredStep)
  const panRef = useRef(0)
  useEffect(() => {
    const el = rowRef.current
    if (!isOpen || !el) return
    /* A DRAG OWNS THE ROW. The user's own gesture beats another pane's pointer, always. */
    if (dragRef.current) return
    const target = extHover == null ? Math.round(pos) : extHover
    const x = target * M.stopW, w = el.clientWidth
    /* ONLY WHEN IT IS OFF-SCREEN — the rule OB-179 settled for the map camera, for the same
       reason: a surface that moves when it did not need to costs the reader their place. */
    if (x >= el.scrollLeft && x + M.stopW <= el.scrollLeft + w) return
    const to = Math.max(0, Math.min(el.scrollWidth - w, x + M.stopW / 2 - w / 2))
    cancelAnimationFrame(panRef.current)
    /* TWEENED BY HAND, NOT `scrollTo({ behavior: 'smooth' })`. Traced on the DS's rig 2026-09-15:
       the native smooth scroll asked for 598.5px and the row never moved — a platform is free to
       ignore it, and then the pan is silently a no-op. This also puts the curve on the system's
       own easing rather than the browser's opaque one. */
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.scrollLeft = to; return }
    const from = el.scrollLeft, t0 = performance.now()
    const step = (t: number) => {
      if (dragRef.current) return
      const k = Math.min(1, (t - t0) / PAN_MS)
      el.scrollLeft = from + (to - from) * (1 - Math.pow(1 - k, 3))
      if (k < 1) panRef.current = requestAnimationFrame(step)
    }
    panRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(panRef.current)
    // `pos` is read on purpose only when the hover CLEARS (the row hands itself back to the cursor);
    // `follow()` already tracks it frame by frame while nothing is hovered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extHover, isOpen])

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
    /* SPACE IS THE SAME CONTROL AS THE BUTTON, including its third state: on a finished walk it
       restarts (with the same beat) rather than toggling a clock that has nowhere to go. */
    else if (k === ' ' && onPlayToggle) { e.preventDefault(); if (complete && !playing) restart(); else { cancelRestart(); onPlayToggle() } }
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
          /* `PlayToggle` (WalkParts) — the strip's own button at this row's 20px, in its third
             state once the cursor is on the last stop: the glyph becomes the replay arrow and the
             click means "from the beginning" (owner, 2026-09-16, DS OB-196). `walkComplete` is the
             derivation, so the dock cannot answer a stop early or a stop late; `playing` wins, so
             a completed walk being replayed shows a pause. THE RESTART IS TWO HOST CALLS IN ORDER
             — seek to 0, then toggle — because the clock is already at the end and toggling alone
             plays for no frames. `onReplay` is the host's own chance to do it as one action. */
          <PlayToggle playing={playing} completed={complete} size={M.row} glyph={[8, 10]}
            onToggle={complete && !playing ? restart : () => { cancelRestart(); onPlayToggle() }} />
        ) : null}
        <span ref={nameRef} data-walk-dock-name="" onMouseEnter={nameEnter} onMouseLeave={nameLeave} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text-walk)' }}>
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
                  {/* THE DOTS GROW, NOT THE ROW'S BOX, so the titles do not jump — and by
                      `walkRowSwell` (DS OB-190): every mark to the row's base grow while the pointer
                      is on the row, rising to the full grow on the stop under it and easing off over
                      two neighbours (owner, 2026-09-15). This used to be a flat `scale(1.18)` on all
                      of them, which was BOTH a drift off the published 1.08 base and the thing that
                      made the row unable to say where the pointer was. The scale and its transition
                      come from `walkHoverStyle` — the `translateZ(0)` in it is the whole fix for the
                      numeral's jiggle. The halo for an externally hovered stop rides this same
                      wrapper, OUTSIDE the face — see the `extHover` block above. `data-walk-dock-mark`
                      is a test hook. */}
                  <div data-walk-dock-mark={i} style={{ display: 'flex', borderRadius: 'var(--radius-pill)', ...walkHoverStyle(walkRowSwell(i, rowHover ? (hover ? hover.i : cur) : null)), transition: 'transform var(--dur-hover) ' + SOFT + ', box-shadow .15s ' + SOFT, boxShadow: i === extHover ? '0 0 0 ' + HALO_W + 'px ' + HALO : 'none' }}>
                    {/* the wash: `progress` is 1 from the instant the cursor arrives (a one-step mark);
                        `StepDot` itself declines to paint it on the rail's `current` face (OB-187). */}
                    <StepDot n={addr[i]} state={st} size={M.stopDot} optional={!!s.optional} progress={walkProgress({ from: i, to: i }, pos)} />
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
