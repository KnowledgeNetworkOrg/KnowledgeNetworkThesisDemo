import { Fragment, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { NodeArrow } from '../graph/NodeArrow'
import { IconButton, usePresence, wrapTip } from '../chrome/IconButton'
import { PaneFrameContext } from '../chrome/PaneHeader'
import { WalkerMark } from '../chrome/WalkerMark'
import { LocateMark } from '../chrome/LocateMark'
import { StepDot } from './StepDot'
import { WalkPreview, previewAnchor } from './WalkPreview'
import { StopTitle, PlayToggle, stopState, WALK_HOVER_GROW, WALK_ROW_HOVER_GROW, walkHoverStyle } from './WalkParts'
import type { StopState } from './WalkParts'

/** how much wheel delta commits ONE step of the walk in the seek variant. Not a
 *  pixel scroll — the accumulated delta crosses this and the cursor moves to the
 *  next waypoint, remainder carried. */
const WHEEL_STEP_PX = 40

/** THE STRIP'S GEOMETRY, published for the same reason `RAIL_METRICS` is: a number
 *  written once here and read back by the renderer cannot drift from a number retyped
 *  at a call site. */
export const WALK_METRICS = {
  dot: 28,        /* the rail dot's own size — bigger than the trail's 24: this pane's
                      one job is reading the walk, so the mark gets the room */
  slotW: 56,      /* the dot's own column — tight around the 28px dot, so the arrow's
                      gap (below) is the only real space between it and its neighbour;
                      the label bleeds past this on both sides via `labelOverhang` */
  gap: 34,        /* arrow length between two dots — the arrow's head adds a few more.
                      Sized together with `labelOverhang` so two full-width wrapped
                      labels can never touch. */
  labelOverhang: 16, /* how far the title label may bleed past its own dot's column,
                        left and right — capped so a label's total width (slotW + 2×this)
                        stays under dot-to-dot spacing (owner-reported, 2026-08-23). */
  walkerLift: 4,  /* clearance between the walker mark's feet and the dot's own ring */
  walker: 22,     /* the walker mark's own size. Published because the TRACK's top padding is
                      derived from it (`walker + walkerLift`) rather than guessed: the mark is
                      absolutely positioned above the dot, so it does not push the track open
                      and a padding short of this clips its head. */
  corner: 28,
  countRow: 15, /* the count's own reserved row — the figure's own line box at `--fs-micro`
                    plus a hair, not a round number. It was 18, which put 3px of air under a
                    line of 11px type in a pane the owner was already calling too big. It is
                    also the difference between the two minimum heights (115 / 130). */
  transport: 26,  /* the play/pause button's own square in the seek row. Smaller than the
                      corner act (28) on purpose: the corner act is an occasional rescue and
                      wants the bigger target, this one sits permanently beside a 4px rail and
                      would otherwise be the loudest thing in the row. */
}

/**
 * THE ACTIVE WALK AS A HORIZONTAL STRIP — a dedicated pane for one question: where the
 * cursor is on the current walk, what is behind it, what is ahead. Distinct from
 * `TrailStrip.tsx`'s old walk column, which listed the same `StepDot` row without a
 * scroll rail, a cursor mark, or a way back to it once scrolled away.
 *
 * WHAT THE THREE STATES ALREADY CARRY, so this component adds nothing new for it:
 * `StepDot`'s `done` / `current` / `ahead` reads walked vs. future by ITSELF (acorn
 * wash vs. plain grey vs. the filled current dot). This component's only addition is
 * the WALKER — a mark for "the cursor is here" — and the ARROW TONE, which restates the
 * same fact along the connecting line: acorn behind the cursor, quiet bark ahead. Never
 * dashed for this — dashing means CONDITIONAL, and "not yet walked" is not that.
 *
 * THE ROW ANSWERS AS A WHOLE (`WALK_ROW_HOVER_GROW` 1.08) AND THE HOVERED STOP LOUDER
 * (`WALK_HOVER_GROW` 1.18), both from `WalkParts` — the marks growing inside their
 * fixed-width slot, so the row never reflows (OB-140).
 *
 * Typed port of the DS WalkStrip.jsx (contract: WalkStrip.d.ts); re-ported 2026-09-05
 * under OB-131/OB-133 (transport, count, WalkPreview, WalkParts, the 115/130 box). */
export interface WalkStep {
  id: string
  title: string
  /** tooltip / notes shown on hover of the dot */
  note?: string
  /** the step the walk may skip. Draws with a DASHED ring — never a different colour
   *  or weight — and the arrow leading INTO it dashes on its own; never pass `dashed`
   *  anywhere for that yourself. Same rule `NodeChain` already follows for `NodeChip`.
   *  Its title carries " (optional)" — `WalkParts`' `StopTitle`, the same span the dock's
   *  open row draws, so the word and its styling cannot differ between the two. */
  optional?: boolean
  /** THE STOP'S POSITION IN THE WALK'S GROUP STRUCTURE, outermost first, 1-based — `[1, 2, 3, 2]`
   *  is the 2nd stop of the 3rd child of the 2nd child of step 1 (DS OB-188, 2026-09-15). The
   *  HOST has it (the walk editor composes it); this side cannot know it. `walkAddresses` caps it
   *  to the two-number address a map pin and a dock dot print, and the hover card prints it
   *  whole. A step WITHOUT a path is a top-level stop and addresses as its own step number —
   *  today's drawing — so a host that has not adopted the field sees no change. */
  path?: number[]
}

export interface WalkStripProps {
  /** the walk's steps, in order. THE HOST OWNS THIS LIST, same split as `NodeRail`'s
   *  `stops` — which nodes are on the walk is corpus/session state, not drawing */
  steps: WalkStep[]
  /** 'seek' (default) — no scrollbar, a waypoint seek bar under the track instead.
   *  'scrollbar' — the house-styled native scrollbar, no seek bar, no waypoints, no
   *  hover preview (a native scrollbar has no hoverable surface to hang one on).
   *  Both variants share every other piece through the same code path. */
  variant?: 'seek' | 'scrollbar'
  /** THE COUNT ROW, and WHICH FACT IT CARRIES (2026-09-01). `'total'` — the walk's own
   *  SIZE, "60 nodes". `'position'` — where the cursor STANDS in it, "12 / 60 nodes".
   *  Omitted — no row at all, and the minimum height drops by `WALK_METRICS.countRow`.
   *  Two DIFFERENT FACTS in the same corner, so one prop with two values rather than a
   *  boolean that quietly changed meaning. In `'position'` the separator is inside the
   *  mono run (`12 / 60`) so the pair holds its column as the cursor crosses 9 → 10. */
  count?: 'total' | 'position'
  /** @deprecated Pass `count="total"` instead — same row, same drawing. Kept working and
   *  not a meaning change: `showCount` always meant the walk's SIZE. `count` wins if both. */
  showCount?: boolean
  /** index of the step the cursor is standing on. THE HOST OWNS THIS, AND ONLY THIS —
   *  the strip has no click-to-jump. A step's dot and label are display only; the app
   *  is the one thing allowed to move the cursor. */
  cursor: number
  /** the pointer entered step `index`, or left every step (`null`). This is NOT how
   *  the cursor moves — it is the one thing a pointer here still reports, for another
   *  pane that wants to react to "the user is looking at step N". */
  onStepHover?: (index: number | null) => void
  /** the pointer entered the arrow leading INTO step `index`, or left every arrow
   *  (`null`). Same report-only contract as `onStepHover`, for the gap. */
  onArrowHover?: (index: number | null) => void
  /** SEEK VARIANT ONLY — the seek bar (always mounted, OB-089), a click-and-drag pan of
   *  the track, OR a mouse wheel over the pane picked step `index`, live during the
   *  gesture. The host is expected to set `cursor` to `index` in response. Never fires
   *  in `variant="scrollbar"`. */
  onSeek?: (index: number) => void
  /** THE SECOND CONTROL THAT MOVES THE CURSOR, and the only other one (2026-09-01). Pass
   *  a handler and a play/pause button mounts at the LEFT END OF THE SEEK ROW; omit it
   *  and there is no transport at all, rather than a dead button. The strip does not run
   *  the walk and holds no timer: this fires, the HOST plays. IT DOES NOT FIRE `onSeek`. */
  onPlayToggle?: () => void
  /** which glyph the transport draws — play (false) or pause (true). Display only; the
   *  strip never sets it and never infers it from `cursor` moving. */
  playing?: boolean
  /** hovering the seek bar (no click), OR a node's own dot, shows a small preview
   *  window near the pointer/dot. Return the preview content for `step`; the strip
   *  only positions the popup and never invents a fallback. THE POPUP IS `WalkPreview`
   *  (2026-09-01), the same element `WalkDock` and the map's walk pins use — pass all
   *  three the SAME function and a stop previews identically wherever the pointer finds it. */
  renderPreview?: (step: WalkStep, index: number) => ReactNode
  /** fires after the corner act recentres the scroller. */
  onRecenter?: () => void
}

interface StopProps {
  n: number
  title: string
  note?: string
  state: StopState
  current: boolean
  optional?: boolean
  /** the whole row is under the pointer — every mark grows by `WALK_ROW_HOVER_GROW` */
  rowHot: boolean
  onHover?: (index: number | null) => void
  onPreviewEnter?: (index: number, rect: DOMRect) => void
  onPreviewLeave?: () => void
  dragging?: () => boolean
  wrapRef: (el: HTMLDivElement | null) => void
}

/** ONE STEP: the dot, the walker mark above it when it is the cursor, and the step's
 *  own name wrapped underneath, up to two lines. The label is WIDER than the dot's own
 *  column (`labelOverhang` on each side) and centred on it with a negative margin, so
 *  neighbouring stops' names can sit close without their dots crowding. NOT CLICKABLE —
 *  the app owns the cursor entirely. `onHover` is the app's own window into the pointer;
 *  `onPreviewEnter`/`onPreviewLeave` drive the SAME popup the seek bar shows, anchored to
 *  this dot instead of the pointer. `dragging()` suppresses both while a track drag is
 *  committed. */
// note isn't read here — same as the DS's own Stop, which destructures it and never
// uses it either; kept in StopProps only because it's a real WalkStep field callers pass
function Stop({ n, title, state, current, optional, rowHot, onHover, onPreviewEnter, onPreviewLeave, dragging, wrapRef }: StopProps) {
  const [hot, setHot] = useState(false)
  const M = WALK_METRICS
  return (
    <div ref={wrapRef} title={wrapTip(optional ? title + ' (optional)' : title)}
      onMouseEnter={(e) => {
        if (dragging && dragging()) return
        setHot(true)
        if (onHover) onHover(n - 1)
        if (onPreviewEnter) onPreviewEnter(n - 1, e.currentTarget.getBoundingClientRect())
      }}
      onMouseLeave={() => {
        if (dragging && dragging()) return
        setHot(false)
        if (onHover) onHover(null)
        if (onPreviewLeave) onPreviewLeave()
      }}
      style={{ flex: 'none', width: M.slotW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {/* THE STOP GROWS UNDER THE POINTER by `WALK_HOVER_GROW` — the presenter strip's gesture,
          given to this surface in the same breath (owner, 2026-09-04). It scales the MARK
          inside a fixed-width slot, so the row does not reflow, and the amount is published in
          `WalkParts` so all three walk surfaces grow by one number. */}
      <div style={{ position: 'relative', display: 'flex', ...walkHoverStyle(hot ? WALK_HOVER_GROW : rowHot ? WALK_ROW_HOVER_GROW : 1) }}>
        {current ? (
          <span aria-hidden="true" style={{
            position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)',
            marginBottom: M.walkerLift, color: 'var(--accent-walk)',
          }}>
            <WalkerMark size={M.walker} animated />
          </span>
        ) : null}
        <StepDot n={n} state={state} size={M.dot} optional={optional} />
      </div>
      {/* THE TITLE IS `StopTitle` (WalkParts, 2026-09-01) — the clamp (2 lines, 3 for an optional
          step so the suffix is not swallowed), the weight, the state ink and the "(optional)"
          word are the ONE rule the dock's open row reads too. Only the placement is this
          strip's: wider than the dot's column by `labelOverhang` each side, centred on it. */}
      <StopTitle title={title} optional={!!optional} state={state} lines={2}
        style={{ width: M.slotW + M.labelOverhang * 2, margin: `0 -${M.labelOverhang}px` }} />
    </div>
  )
}

interface DragState { x: number; scrollLeft: number; moved: boolean }

/** THE HOST OWNS THE STEPS AND THE CURSOR, same split as `NodeRail`. THE SEEK BAR (below the
 *  track, replacing the scrollbar entirely) is N FIXED WAYPOINTS, ONE PER NODE: a click or drag
 *  snaps the viewport to whichever step is nearest, and IT ALSO MOVES THE WALK'S CURSOR
 *  (`onSeek`) — the one exception to "no click-to-jump" in the whole component, plus the
 *  transport button since 2026-09-01. HOVERING IT shows a PREVIEW POPUP for the nearest step
 *  (`renderPreview`); hovering a dot shows the same popup anchored to the dot. A committed
 *  track drag suspends hover reporting and moves the cursor too. `variant="scrollbar"` swaps
 *  the seek bar for the house scrollbar and keeps everything else. */
export function WalkStrip({ steps = [], cursor = 0, variant = 'seek', showCount = false, count, playing = false, onPlayToggle, onStepHover, onArrowHover, onRecenter, onSeek, renderPreview }: WalkStripProps) {
  /* `showCount` is the 2026-08-23 name and still works: it always meant the walk's SIZE, and
     that is exactly `count="total"`. */
  const countMode = count || (showCount ? 'total' : null)
  const M = WALK_METRICS
  const scrollbar = variant === 'scrollbar'
  /* THE ROW ANSWERS AS A WHOLE, the presenter strip's gesture: every mark grows a little while the
     pointer is anywhere on the strip, and the one under it grows more (owner, 2026-09-04). */
  const [rowHot, setRowHot] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  /* EVERY STEP'S OWN WRAPPER, keyed by index — a plain object rather than a Map so a
     step that unmounts just leaves a stale key nobody reads again next tick. */
  const stopEls = useRef<Record<number, HTMLDivElement>>({})
  const frame = useContext(PaneFrameContext)
  const live = usePresence(rootRef, {
    resolve: () => frame?.current ?? rootRef.current?.parentElement ?? null,
  })
  const [scrollable, setScrollable] = useState(false)
  const [offCursor, setOffCursor] = useState(false)
  const [nearest, setNearest] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [hoverTop, setHoverTop] = useState(0)
  /* EVERY STEP'S OWN SCROLL TARGET (px), evenly spaced by INDEX across the scroll
     range — recomputed whenever the steps or the track's size changes, never on
     scroll. */
  const targetsRef = useRef<number[]>([])

  const check = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setScrollable(max > 1)
    targetsRef.current = steps.map((_, i) => (steps.length > 1 ? (i / (steps.length - 1)) * max : 0))
    let best = 0
    let bestDist = Infinity
    targetsRef.current.forEach((t, i) => {
      const d = Math.abs(t - el.scrollLeft)
      if (d < bestDist) { bestDist = d; best = i }
    })
    setNearest(best)
    const cur = stopEls.current[cursor]
    if (cur) {
      const a = el.getBoundingClientRect()
      const b = cur.getBoundingClientRect()
      setOffCursor(b.left < a.left || b.right > a.right)
    }
  }, [steps, cursor])

  useEffect(() => {
    check()
    const el = trackRef.current
    if (!el) return
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [check, steps.length, cursor])

  /* WHAT THE BAR DRAWS, and the one place the two cases differ (DS OB-089). While the
     track can scroll, `nearest` is measured from the real scroll position. When it
     CANNOT scroll, every waypoint collapses onto scrollLeft 0 and `check`'s distance
     search cannot tell them apart, so the bar reads `cursor` directly.
     ★ LOCAL — DERIVED HERE RATHER THAN STORED: the DS writes `setNearest(cursor)` inside
     `check()`'s no-scroll branch, which is setting state from a PROP inside an effect
     body — exactly what react-hooks/set-state-in-effect forbids. Same rendered result. */
  const barIndex = scrollable ? nearest : cursor

  const recenter = () => {
    const el = trackRef.current
    const cur = stopEls.current[cursor]
    if (!el || !cur) return
    const target = cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    if (onRecenter) onRecenter()
  }

  /* THE APP CAN ALSO MOVE THE ACTIVE NODE (seek variant only): cursor is host-owned,
     and onSeek is only ONE way it changes. lastSeekRef distinguishes a cursor change
     THIS strip's own last onSeek call already reflected on screen from an app-driven
     change this effect must catch up to. */
  const lastSeekRef = useRef<number | null>(null)
  useEffect(() => {
    if (scrollbar) return
    if (lastSeekRef.current === cursor) return
    const el = trackRef.current
    const target = targetsRef.current[cursor]
    if (!el || target === undefined) return
    el.scrollTo({ left: target, behavior: 'smooth' })
    // setNearest here is paired with the DOM scroll above, not derivable from props
    // alone: it exists so the bar's own fill/thumb agree with wherever an app-driven
    // cursor change just scrolled to, which only this effect can know once it runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNearest(cursor)
  }, [cursor, scrollbar])

  /* THE SEEK BAR IS N FIXED WAYPOINTS, NOT A FREE SCROLLBAR: a click or drag anywhere
     on it snaps the viewport to whichever STEP is nearest the pointer, and tells the
     host which stop was picked. */
  const seekTo = (clientX: number) => {
    const bar = barRef.current
    const el = trackRef.current
    const targets = targetsRef.current
    if (!bar || !el || !targets.length) return
    const r = bar.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const i = Math.round(frac * (targets.length - 1))
    el.scrollLeft = targets[i]
    setNearest(i)
    lastSeekRef.current = i
    if (onSeek) onSeek(i)
  }
  const seekingRef = useRef(false)
  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    seekingRef.current = true
    setHoverIndex(null)
    seekTo(e.clientX)
    const move = (ev: PointerEvent) => seekTo(ev.clientX)
    const up = () => {
      seekingRef.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* THE PREVIEW POPUP: hovering the bar — no click needed — shows a small window near
     the pointer for whichever step is nearest it. NO PREVIEW WHILE DRAGGING — the popup
     is for looking ahead BEFORE committing. */
  const indexAt = (clientX: number) => {
    const bar = barRef.current
    if (!bar || !steps.length) return 0
    const r = bar.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return Math.round(frac * (steps.length - 1))
  }
  const onBarHoverMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (seekingRef.current) return
    setHoverIndex(indexAt(e.clientX))
    setHoverX(e.clientX)
    const bar = barRef.current
    if (bar) setHoverTop(bar.getBoundingClientRect().top)
  }
  const onBarHoverLeave = () => setHoverIndex(null)

  /* HOVERING A NODE'S OWN DOT ALSO SHOWS THE PREVIEW — the same popup, anchored to
     the dot (`previewAnchor`) instead of following the pointer. Not gated on !scrollbar:
     the scrollbar variant has no seek bar to hover, but its dots still can. */
  const onNodePreviewEnter = (i: number, rect: DOMRect) => {
    if (!renderPreview) return
    const a = previewAnchor(rect)
    setHoverIndex(i)
    setHoverX(a.x)
    setHoverTop(a.top)
  }
  const onNodePreviewLeave = () => setHoverIndex(null)

  /* CLICK-AND-DRAG TO PAN THE TRACK — dragging any empty part of the track scrolls
     it. A small movement threshold before it commits keeps an ordinary click from
     being read as a drag; once committed, hover/preview reporting suspends and the
     drag also moves the cursor (seek variant only). */
  const dragRef = useRef<DragState | null>(null)
  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = trackRef.current
    if (!el || e.button !== 0) return
    dragRef.current = { x: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      const el2 = trackRef.current
      if (!d || !el2) return
      const dx = ev.clientX - d.x
      if (!d.moved && Math.abs(dx) > 3) {
        d.moved = true
        setHoverIndex(null)
        if (onStepHover) onStepHover(null)
        if (onArrowHover) onArrowHover(null)
      }
      if (d.moved) {
        el2.scrollLeft = d.scrollLeft - dx
        if (!scrollbar) {
          const targets = targetsRef.current
          let best = 0
          let bestDist = Infinity
          targets.forEach((t, i) => { const dd = Math.abs(t - el2.scrollLeft); if (dd < bestDist) { bestDist = dd; best = i } })
          setNearest(best)
          lastSeekRef.current = best
          if (onSeek) onSeek(best)
        }
      }
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const cols = scrollbar ? '1fr ' + (M.corner + 8) + 'px' : '1fr'
  /* MOUSE WHEEL OVER THE PANE ALSO MOVES THE TRACK (OB-103): whichever axis carries the
     larger delta becomes movement, bound on the ROOT so it fires over the dots AND the
     bar. Guarded on `scrollable` — its only reader since OB-089. SEEK VARIANT: ONE STEP
     PER NOTCH, delta accumulated across events, remainder carried. SCROLLBAR VARIANT:
     continuous pixel scroll. */
  const wheelAccumRef = useRef(0)
  const onPaneWheel = (e: WheelEvent) => {
    const el = trackRef.current
    if (!el || !scrollable) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (!delta) return
    e.preventDefault()
    if (scrollbar) {
      el.scrollLeft += delta
      return
    }
    const targets = targetsRef.current
    if (!targets.length) return
    wheelAccumRef.current += delta
    while (Math.abs(wheelAccumRef.current) >= WHEEL_STEP_PX) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1
      wheelAccumRef.current -= dir * WHEEL_STEP_PX
      const next = Math.max(0, Math.min(targets.length - 1, nearest + dir))
      if (next === nearest) {
        wheelAccumRef.current = 0
        break
      }
      el.scrollLeft = targets[next]
      setNearest(next)
      lastSeekRef.current = next
      if (onSeek) onSeek(next)
    }
  }
  /* ★ LOCAL — BOUND NATIVELY, NOT AS `onWheel`. React attaches `wheel` at the root as a
     PASSIVE listener, so `preventDefault()` inside a React `onWheel` handler is refused
     (Chromium logs it once per notch; tools/studio-spike/drive-walkwheel.mjs collects that
     message). The handler BODY is the DS's, unchanged; only the attachment differs. The
     ref keeps ONE listener across the component's life while the handler is rebuilt every
     render (it closes over `nearest` and `onSeek`). */
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {})
  useEffect(() => {
    wheelRef.current = onPaneWheel
  })
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const handler = (e: WheelEvent) => wheelRef.current(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])
  return (
    <div ref={rootRef} onMouseEnter={() => setRowHot(true)} onMouseLeave={() => setRowHot(false)} style={{ position: 'relative', height: '100%', minHeight: countMode ? 130 : 115, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '0 14px', userSelect: 'none' }}>
      {/* THE COUNT SITS IN ITS OWN RESERVED ROW ABOVE THE TRACK, never over it — a
          plain absolute overlay collides with the walker mark whenever the current
          step happens to be the last one. Bare, like `VersionedGroup`'s own tally. */}
      {countMode ? (
        <div style={{ flex: 'none', height: M.countRow, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>
            {/* THE WHOLE FIGURE IS ONE MONO RUN, separator included — `12 / 60` has to hold its
                column as the cursor moves through 9 → 10, and a UI-font slash between two mono
                numbers reflows the pair on every step. The noun stays UI, as it always was. */}
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', fontWeight: 'var(--fw-medium)' }}>
              {countMode === 'position' && steps.length > 0 ? (cursor + 1) + ' / ' + steps.length : steps.length}
            </span>
            {' ' + (steps.length === 1 ? 'node' : 'nodes')}
          </span>
        </div>
      ) : null}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', minWidth: 0 }}>
      {/* THE BLOCK IS A GRID, NOT A FLEX ROW, so the seek bar's row can share the exact
          same column as the content row without measuring anything. */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: cols, rowGap: 3, width: '100%', minWidth: 0 }}>
        <div ref={trackRef} data-sb-off={scrollbar ? undefined : ''} onPointerDown={onTrackPointerDown} style={{
          gridColumn: 1, gridRow: 1,
          minWidth: 0, display: 'flex', alignItems: 'flex-start', overflowX: 'auto', overflowY: 'hidden',
          padding: `${M.walker + M.walkerLift}px ${M.labelOverhang}px 4px`, userSelect: 'none', cursor: 'grab',
          scrollbarWidth: scrollbar ? undefined : 'none', msOverflowStyle: scrollbar ? undefined : 'none',
        } as CSSProperties}>
          {steps.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 ? (
                <span style={{ flex: 'none', display: 'flex', alignItems: 'center', height: M.dot, transform: rowHot ? 'scaleY(' + WALK_ROW_HOVER_GROW + ')' : 'none', transition: 'transform var(--dur-hover) var(--ease-soft)' }}
                  onMouseEnter={() => { if (dragRef.current && dragRef.current.moved) return; if (onArrowHover) onArrowHover(i) }}
                  onMouseLeave={() => { if (dragRef.current && dragRef.current.moved) return; if (onArrowHover) onArrowHover(null) }}>
                  <NodeArrow direction="right" length={M.gap} tone={i <= cursor ? 'walk' : 'quiet'} dashed={!!s.optional} />
                </span>
              ) : null}
              <Stop n={i + 1} title={s.title} note={s.note} optional={s.optional} rowHot={rowHot}
                state={stopState(i, cursor)}
                current={i === cursor}
                wrapRef={(el) => { if (el) stopEls.current[i] = el; else delete stopEls.current[i] }}
                onHover={onStepHover} dragging={() => !!(dragRef.current && dragRef.current.moved)}
                onPreviewEnter={onNodePreviewEnter} onPreviewLeave={onNodePreviewLeave} />
            </Fragment>
          ))}
        </div>
        {/* THE SEEK BAR ROW — same column as the track, one row below. ALWAYS mounted
            in the seek variant, whether or not the track can scroll (DS OB-089). */}
        {!scrollbar ? (
          <div style={{ gridColumn: 1, gridRow: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* THE TRANSPORT SITS IN THE ROW, NOT OVER IT, and the TRACK above spans the full
                width regardless — a play button is a seek-row control, so indenting the whole
                component for it would cost the track a column of walk to buy the button a seat
                (owner, 2026-09-01). Mounts only when the host passes `onPlayToggle`. */}
            {onPlayToggle ? (
              /* `PlayToggle` (WalkParts) — the same button the dock draws at 20px; this row's is 26. */
              <PlayToggle playing={playing} onToggle={onPlayToggle} size={M.transport} glyph={[11, 12]} />
            ) : null}
            {/* THE HIT AREA IS TALLER THAN THE DRAWN RAIL — a browser's own scrollbar
                solves this with an invisible gutter wider than the drawn thumb; this
                does the same. */}
            <div ref={barRef} onPointerDown={onBarPointerDown}
              onMouseMove={onBarHoverMove} onMouseLeave={onBarHoverLeave} style={{
              flex: 1, minWidth: 0, height: 24, display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer',
            }}>
              <div aria-hidden="true" style={{ width: '100%', height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--bark-100)', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: (steps.length > 1 ? (barIndex / (steps.length - 1)) * 100 : 0) + '%', borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)' }} />
                <div aria-hidden="true" style={{
                  position: 'absolute', top: '50%', left: (steps.length > 1 ? (barIndex / (steps.length - 1)) * 100 : 0) + '%', width: 10, height: 10, borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-walk)', transform: 'translate(-50%, -50%)', boxShadow: 'var(--lift-1)',
                }} />
              </div>
            </div>
            <span style={{
              flex: 'none', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', fontSize: 'var(--fs-micro)',
              color: 'var(--text-2)', width: 30, textAlign: 'right',
            }}>{steps.length > 1 ? Math.round((barIndex / (steps.length - 1)) * 100) : 0}%</span>
            {/* THE CORNER ACT IS A ROW ITEM HERE, NOT AN ABSOLUTE OVERLAY (2026-09-01). Floating
                in the strip's corner meant the seek row reserved `corner + 8` of padding it could
                never use — 36px of permanently empty white to the right of the percentage. In
                the row it takes exactly its own width, the bar takes the rest. */}
            <span style={{
              flex: 'none', width: M.corner, height: M.corner, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: offCursor ? 1 : 0, pointerEvents: offCursor ? 'auto' : 'none',
              transition: 'opacity var(--dur-fade) var(--ease-soft)',
            }}>
              <IconButton size={M.corner} reveal={live && offCursor} reachable={offCursor}
                title="active node" label="active node" onClick={recenter} style={{ color: 'var(--text-3)' }}>
                <LocateMark />
              </IconButton>
            </span>
          </div>
        ) : null}
        {hoverIndex !== null && renderPreview ? (
          /* THE ONE POPUP EVERY WALK SURFACE SHARES (`WalkPreview`, 2026-09-01) — fixed against
             the viewport, `PREVIEW_GAP` above the bar's top edge. The dock and a walk pin on
             the map hang the same card off the same geometry. */
          <WalkPreview x={hoverX} top={hoverTop}>{renderPreview(steps[hoverIndex], hoverIndex)}</WalkPreview>
        ) : null}
        {scrollbar ? (
          <span style={{
            position: 'absolute', right: 2, bottom: 2,
            opacity: offCursor ? 1 : 0, pointerEvents: offCursor ? 'auto' : 'none',
            transition: 'opacity var(--dur-fade) var(--ease-soft)',
          }}>
            <IconButton size={M.corner} reveal={live && offCursor} reachable={offCursor}
              title="active node" label="active node" onClick={recenter} style={{ color: 'var(--text-3)' }}>
              <LocateMark />
            </IconButton>
          </span>
        ) : null}
      </div>
      </div>
    </div>
  )
}
