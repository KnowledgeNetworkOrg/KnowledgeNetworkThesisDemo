import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { WALK_HOVER_GROW, WALK_ROW_HOVER_GROW, walkHoverStyle } from '../nav/WalkParts'
import { settleRead } from '../chrome/MeasureBox'
import { StepDot } from '../nav/StepDot'
import { Caret, CARET_INK } from '../nav/TreeRow'
import { FlagMark } from '../chrome/FlagMark'
import { FindMark } from '../chrome/FindMark'
import { IconButton, wrapTip } from '../chrome/IconButton'
import { WalkPreview, previewAnchor } from '../nav/WalkPreview'
import { walkBand } from '../map/WalkDock'

/* Typed port of the DS components/presenter/PresenterStrip.jsx (contract: PresenterStrip.d.ts),
   part 3 of the presenter-mode split — OB-137 / #267, on the 2026-09-04 source with both of that
   day's amendments (the box-bounded fill, the carry, the settle ladder, the peeks, the one-pitch
   slide), and the 2026-09-21 spread open row (OB-246: `pitch` is a floor, the window spans the
   row, `fillBounds` takes slots, the marker asks the window, the centre is re-clamped). */

const HOLD_MS_DEFAULT = 600

/** THE STRIP'S PARTS, top to bottom. The four published heights below are SUMS of these —
 *  change a part and the heights follow; never retype a height. */
const P = {
  padTop: 6, row: 20,
  railGap: 6, railGapRoaming: 9,     /* the roaming labels above the ring want 3px more */
  rail: 20, railRoaming: 34,         /* "(hold to make active)" sits under the rail while roaming */
  rowGap: 8, rowGapRoaming: 14,      /* room for the "roaming" cap above the ring */
  dots: 28, labelGap: 5,
  labels: 28, labelsRoaming: 45,     /* the hold instruction is a third line under the label */
  padBottom: 10, border: 2,
}
const sum = (...ks: (keyof typeof P)[]) => ks.reduce((a, k) => a + P[k], 0)

/** Published because a host laying out a column ARITHMETICALLY needs the strip's height before it
 *  draws; a host that lets flex do it needs none of this. `pitch` 68 and the band floor 0.22 are
 *  CHOSEN on the v18 render — the shipped `WALK_BAND_DEFAULTS` floor (0.05) is for pins on a
 *  coloured map; on a paper strip those ticks vanish. `peekOpacity` 0.4 (CHOSEN) is the one
 *  unlabelled stop drawn past each end of the open window. THE RAIL'S INSET IS HALF THE KNOB'S
 *  HOVER SIZE (18 → 9), the same rule `WalkDock` keeps. `tickGrow`/`lineGrow` are WHOLE PIXELS:
 *  on a 2×6 tick a factor gains half a pixel, which is nothing to see. */
export const PRESENTER_STRIP_METRICS = {
  closed: sum('padTop', 'row', 'railGap', 'rail', 'padBottom', 'border'),                          /* 64 */
  closedRoaming: sum('padTop', 'row', 'railGapRoaming', 'railRoaming', 'padBottom', 'border'),     /* 81 */
  open: sum('padTop', 'row', 'rowGap', 'dots', 'labelGap', 'labels', 'padBottom', 'border'),        /* 107 */
  openRoaming: sum('padTop', 'row', 'rowGapRoaming', 'dots', 'labelGap', 'labelsRoaming', 'padBottom', 'border'), /* 130 */
  /* `pitch` IS A FLOOR, NOT THE SPACING (DS OB-246, 2026-09-21). It answers "how many stops can
     this row label without crowding them", and the open row then spreads exactly that many across
     the width it has — so the drawn pitch is >= this number and the row fills the pane the way the
     closed rail always has. 68 is CHOSEN against the 66px label. */
  pitch: 68, stopDot: 18, ring: 13, ringOpen: 18, knob: 14,
  peekOpacity: 0.4,
  railInset: 9, railSpan: 18,
  tick: { w: 2, h: 6 }, line: 2,
  tickGrow: { row: 2, hover: 4 }, lineGrow: 1,
  band: { floor: 0.22 },
}
/** The strip's height for a state — the four numbers above, picked by two booleans. */
export function presenterStripHeight({ open = false, roaming = false }: { open?: boolean; roaming?: boolean } = {}): number {
  const M = PRESENTER_STRIP_METRICS
  return open ? (roaming ? M.openRoaming : M.open) : (roaming ? M.closedRoaming : M.closed)
}
/** WHICH SEGMENTS OF THE WALK LINE CAN REACH THE BOX — the fill's bound, and a FUNCTION rather
 *  than a rule in prose because the version of it that lived inline was wrong for a week: it used
 *  the DOT window (±half around centre), so a segment whose two dots were both outside that window
 *  was skipped even where it crossed the visible line, leaving a grey stub at the left end of a
 *  fully walked walk (owner, 2026-09-04). The line spans the box; the dots are a window; the two
 *  are different spans.
 *
 *  TAKES THE DRAWN SLOTS, NOT A PITCH AND A CENTRE (DS OB-246, 2026-09-21). The row spreads its
 *  window across the width it is given rather than stepping a constant pitch from the middle, so
 *  "how far past the last dot can the line still be inside the box" is no longer a pixel sum — it
 *  is one slot either side of the drawn span, exactly. `slotLo`/`slotHi` are the outermost slots
 *  the row lays out, peeks included. Returns `[first, last)` over segment indices. */
export function fillBounds(slotLo: number, slotHi: number, count: number): [number, number] {
  return [Math.max(0, slotLo - 1), Math.min(count - 1, slotHi + 1)]
}
/** The capitalised way in for a card or a rig — the same function objects, not copies. */
export const PresenterStripMath = { height: presenterStripHeight, fillBounds }

const SIDE_PAD = 36
const UP: CSSProperties = { transform: 'rotate(225deg) translate(-' + CARET_INK + 'px, -' + CARET_INK + 'px)' }

/** The hold gesture, one clock — `progress` 0→100 over `holdMs` while held, firing `onComplete`
 *  at 100 and resetting. Released early, it eases back to 0 rather than snapping.
 *
 *  THE TICK IS AN INTERVAL, NOT `requestAnimationFrame`, AND THAT IS THE WHOLE POINT (2026-09-06,
 *  found by this app in a real browser with a real projector window; OB-165). A window that is not
 *  in front gets NO animation frames, and opening the projector focuses it — so a hold begun while
 *  the professor is looking at the projector never advanced at all: the ring filled to nothing and
 *  the gesture that COMMITS the record was simply dead until their own window came forward. A
 *  background interval is throttled but it still fires, and because elapsed is read from
 *  `performance.now()` rather than counted in frames, the first tick after the throttle lands on
 *  the true progress instead of resuming where it stopped. Cost, stated: the fill is not
 *  vsync-aligned, so it is a hair less smooth than a rAF fill on a 600ms gesture. Worth it — an
 *  animation may stall in a window nobody is watching; a commit may not.
 *
 *  Measured here 2026-09-12 (`browsertest-presenter.mjs`, the second hold): with the projector in
 *  front the presenter's page still reports `visibilityState` "visible" and `hasFocus()` true, so
 *  its intervals keep the full 16ms cadence — it is only the frames that stop (2 in 1.5s). */
function useHold(holdMs: number, onComplete?: () => void): [number, () => void, () => void] {
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef(0)
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null }
  const start = () => {
    stop()
    startedAt.current = performance.now()
    const tick = () => {
      const p = Math.min(100, ((performance.now() - startedAt.current) / holdMs) * 100)
      setProgress(p)
      if (p >= 100) { stop(); if (onComplete) onComplete(); setProgress(0) }
    }
    timer.current = setInterval(tick, 16)
    tick()
  }
  const cancel = () => { stop(); setProgress(0) }
  useEffect(() => stop, [])
  return [progress, start, cancel]
}

/** CARRYING THE RECORD: a drag that starts ON the active node's own mark and drops it on a stop.
 *  The pointer's x becomes an index through `indexAt`, which each row supplies because each row
 *  has its own geometry. Returns the stop under the pointer while dragging so the row can draw
 *  the record where it WILL land, and commits on release.
 *
 *  WHY THIS IS ALLOWED TO COMMIT, when a click on a tick only roams: THE RECORD MOVES ONLY BY A
 *  GESTURE THAT STARTS ON THE RECORD (owner, 2026-09-04). A hold on the ring and a drag of the
 *  knob both do; a click on a tick does not, and still only roams. */
function useCarry(indexAt: (clientX: number) => number | null, onCommit?: (i: number) => void): [number | null, (e: ReactPointerEvent) => void, { current: boolean }] {
  const [at, setAt] = useState<number | null>(null)
  const moved = useRef(false)
  const start = (e: ReactPointerEvent) => {
    if (e.button) return
    e.preventDefault()
    e.stopPropagation()
    moved.current = false
    const move = (ev: PointerEvent) => { moved.current = true; const i = indexAt(ev.clientX); if (i != null) setAt(i) }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const i = indexAt(ev.clientX)
      setAt(null)
      if (moved.current && i != null && onCommit) onCommit(i)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return [at, start, moved]
}

/** The ring that fills inward, rim to centre, as the hold progresses — the roaming stop's own
 *  mark, never a `StepDot` state (roaming is provisional, not one of the walk's three settled
 *  states). `n` is drawn only in the open row; at 13px on the closed rail a number is 5px tall
 *  and reads as dirt, so the closed ring is bare and the labels around it say what it is. */
function HoldRing({ size, n, holdMs, onMakeActive, title }: { size: number; n?: number; holdMs: number; onMakeActive?: () => void; title?: string }) {
  const [progress, start, cancel] = useHold(holdMs, onMakeActive)
  const fillR = (progress / 100) * (size / 2)
  return (
    <button type="button" data-hold-ring title={wrapTip(title || 'hold to make this the active node')} aria-label={title || 'hold to make this the active node'}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel}
      style={{
        position: 'relative', width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center', padding: 0, boxSizing: 'border-box', cursor: 'pointer',
        border: '1.6px solid var(--acorn-600)', background: '#fff',
        boxShadow: progress > 0 ? 'inset 0 0 0 ' + fillR.toFixed(1) + 'px var(--acorn-200)' : 'none',
        transition: progress > 0 ? 'none' : 'box-shadow 200ms var(--ease-soft)',
      }}>
      {n != null ? <span style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-medium)', fontSize: Math.round(size * 0.42), fontVariantNumeric: 'var(--tnum)', color: 'var(--text-walk)' }}>{n}</span> : null}
    </button>
  )
}

/** A small white pill that answers the pointer with the house wash. `PillButton` owns this
 *  treatment everywhere else; it cannot be used here because its `sm` floor is 24px and this row
 *  is 20 — so the wash is the same token (`--surface-hover`), not a new one. */
function HotPill({ onClick, title, style, children }: { onClick?: () => void; title: string; style?: CSSProperties; children: ReactNode }) {
  const [hot, setHot] = useState(false)
  /* THE WASH IS LAID OVER A SOLID FACE, never used AS the face: `--surface-hover` is 4% ink, and a
     pill whose only background is 4% ink shows the dots under it through itself */
  const face = hot ? 'linear-gradient(var(--surface-hover), var(--surface-hover)), var(--surface-raised)' : 'var(--surface-raised)'
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick() }} title={wrapTip(title)} aria-label={title}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, boxSizing: 'border-box', flexShrink: 0,
        borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)',
        background: face, transition: 'var(--transition-wash)',
        ...style,
      }}>{children}</div>
  )
}

/** The caps label that names the ring, and the italic line that says what to do with it — the
 *  same two strings wherever the ring shows, because a gesture explained two ways reads as two. */
const CAPS: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)', whiteSpace: 'nowrap', background: '#fff', padding: '0 4px', borderRadius: 3 }
const HOLD_HINT: CSSProperties = { fontFamily: 'var(--font-ui)', fontStyle: 'italic', fontSize: 10.5, lineHeight: 1.2, color: 'var(--text-2)', whiteSpace: 'nowrap' }

export interface PresenterStripStep {
  title: string
  /** shown before the title, with a drawn › separator, when present */
  territory?: string
  /** colours the small dot in front of the title, e.g. `'cobalt'` — `--hue-<hue>-ink` */
  hue?: string
}

/** Territory › current stop, one line, the shape every breadcrumb in the app reads. */
function Crumbs({ step }: { step?: PresenterStripStep }) {
  if (!step) return <span style={{ flex: 1, minWidth: 0 }} />
  return (
    <span data-presenter-crumbs style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>
      {step.territory ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>{step.territory}</span> : null}
      {step.territory ? (
        <svg width="7" height="11" viewBox="0 0 7 11" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M1.6 1.4 L5.4 5.5 L1.6 9.6" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', overflow: 'hidden', minWidth: 0 }}>
        {step.hue ? <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--hue-' + step.hue + '-ink)', flexShrink: 0 }} /> : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.title}</span>
      </span>
    </span>
  )
}

interface RailProps {
  steps: PresenterStripStep[]
  activeStop: number
  roamingStop: number | null
  flags: number[]
  isDone: (i: number) => boolean
  walked: (i: number) => boolean
  holdMs: number
  onMakeActive?: (i: number) => void
  onRoamTo?: (i: number) => void
  onHover: (i: number | null, el?: HTMLElement) => void
  renderPreview?: (step: PresenterStripStep, index: number) => ReactNode
  rowHot: boolean
}

/** Closed: the thin rail. One 2×6 tick per stop centred on the line, inked by `walkBand` around the
 *  ACTIVE node (5 behind, 2 ahead, floor 0.22), a flag above a flagged tick, the active node's own
 *  knob, and — while roaming — the bare 13px ring with "roaming" above it and the hold hint below. */
function ClosedRail({ steps, activeStop, roamingStop, flags, isDone, walked, holdMs, onMakeActive, onRoamTo, onHover, renderPreview, rowHot }: RailProps) {
  const [hotStop, setHotStop] = useState<number | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const M = PRESENTER_STRIP_METRICS
  const N = steps.length
  const LAST = Math.max(1, N - 1)
  /* the inverse of `at(i)`: the rail spaces stops across its own width, inset by `railInset` at
     each end, so x maps back through the same two numbers rather than a second layout guess */
  const indexAt = (clientX: number) => {
    const el = railRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const span = r.width - M.railSpan
    if (span <= 0) return null
    const frac = (clientX - r.left - M.railInset) / span
    return Math.max(0, Math.min(N - 1, Math.round(frac * LAST)))
  }
  const [carryTo, startCarry, carried] = useCarry(indexAt, onMakeActive)
  /* THE DROP MUST NOT ALSO ROAM. A carry ends with the pointer over a TICK, and that tick's click
     would fire straight after `onMakeActive` — the record would land and the roam would move on top
     of it. `carried` is the gesture's own memory; the ticks read it and refuse the click that
     belongs to the drag. */
  const roamClick = (i: number) => (onRoamTo ? () => { if (carried.current) { carried.current = false; return } onRoamTo(i) } : undefined)
  const shownActive = carryTo != null ? carryTo : activeStop
  const at = (i: number) => 'calc(' + M.railInset + 'px + ' + (i / LAST).toFixed(5) + ' * (100% - ' + M.railSpan + 'px))'
  const roaming = roamingStop != null
  return (
    <div ref={railRef} data-presenter-rail style={{ position: 'relative', height: roaming ? P.railRoaming : P.rail, marginTop: roaming ? P.railGapRoaming : P.railGap }}>
      {/* THE LINE RUNS FROM THE FIRST TICK TO THE LAST, not border to border. The fill is per
          SEGMENT, drawn only between two covered stops (or a covered stop and the active node), so
          a skipped stretch reads as a gap in the fill. THE LINE THICKENS WITH THE MARKS: about its
          own centre, so the ticks stay centred on it. */}
      <div style={{ position: 'absolute', left: M.railInset, right: M.railInset, top: 9 - (rowHot ? M.lineGrow / 2 : 0), height: M.line + (rowHot ? M.lineGrow : 0), borderRadius: 999, background: 'var(--bark-100)', transition: 'height var(--dur-hover) var(--ease-soft), top var(--dur-hover) var(--ease-soft)' }}>
        {steps.slice(0, -1).map((_, i) => walked(i) ? <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: (i / LAST * 100).toFixed(4) + '%', width: (1 / LAST * 100).toFixed(4) + '%', background: 'var(--accent-walk)', opacity: 0.55 }} /> : null)}
      </div>
      {steps.map((s, i) => {
        const b = walkBand(i, activeStop, M.band)
        const hot = hotStop === i
        return (
          /* an 8px hit box around a 2px tick — hoverable and clickable without being drawn 8 wide.
             THE MARK GROWS UNDER THE POINTER, not the hit box, in whole pixels. */
          <div key={i} data-presenter-tick={i} title={renderPreview ? undefined : wrapTip(s.title)} onClick={roamClick(i)}
            onMouseEnter={(e) => { setHotStop(i); onHover(i, e.currentTarget) }} onMouseLeave={() => { setHotStop(null); onHover(null) }}
            style={{ position: 'absolute', top: 4, left: at(i), width: 8, height: 12, transform: 'translateX(-50%)', display: 'grid', placeItems: 'center', cursor: onRoamTo ? 'pointer' : 'default' }}>
            <div style={{ width: M.tick.w, height: M.tick.h + (hot ? M.tickGrow.hover : rowHot ? M.tickGrow.row : 0), borderRadius: 1, opacity: b.ink, background: isDone(i) ? 'var(--accent-walk)' : 'var(--bark-400)', transition: 'height var(--dur-hover) var(--ease-soft)' }} />
          </div>
        )
      })}
      {/* A FLAG IS A CLICK TARGET: it roams to its stop, the same act as clicking the tick under it */}
      {flags.map((f) => (
        <div key={f} title={renderPreview ? undefined : wrapTip('flagged — ' + (steps[f] ? steps[f].title : ''))} onClick={onRoamTo ? () => onRoamTo(f) : undefined}
          onMouseEnter={(e) => onHover(f, e.currentTarget)} onMouseLeave={() => onHover(null)}
          style={{ position: 'absolute', left: at(f), top: -8, ...walkHoverStyle(rowHot ? WALK_ROW_HOVER_GROW : 1, 'translateX(-30%)'), cursor: onRoamTo ? 'pointer' : 'default' }}><FlagMark size={10} filled style={{ color: 'var(--acorn-600)' }} /></div>
      ))}
      {roaming ? (
        <>
          <div style={{ position: 'absolute', top: 10, left: at(roamingStop), ...walkHoverStyle(hotStop === roamingStop ? WALK_HOVER_GROW : rowHot ? WALK_ROW_HOVER_GROW : 1, 'translate(-50%,-50%)') }}>
            <HoldRing size={M.ring} holdMs={holdMs} onMakeActive={() => onMakeActive && onMakeActive(roamingStop)} title={'hold to make stop ' + (roamingStop + 1) + ' the active node'} />
          </div>
          <div style={{ position: 'absolute', left: at(roamingStop), top: -9, transform: 'translateX(-50%)', pointerEvents: 'none', ...CAPS }}>roaming</div>
          <div style={{ position: 'absolute', left: at(roamingStop), top: 19, transform: 'translateX(-50%)', pointerEvents: 'none', ...HOLD_HINT }}>(hold to make active)</div>
        </>
      ) : null}
      {/* THE ACTIVE NODE'S KNOB IS ALSO THE HANDLE THAT CARRIES IT (owner, 2026-09-04). While
          carrying, the knob is drawn at the stop it WILL land on. The ONE mark that does not take
          `walkHoverStyle`: its transition animates `left` as well as `transform`, and the factory
          would overwrite that; it carries the `translateZ(0)` by hand for the same reason the
          factory exists — one composited layer, one rasterization. */}
      <div data-presenter-knob onPointerDown={onMakeActive ? startCarry : undefined}
        title={onMakeActive ? wrapTip('drag to move the active node here') : undefined}
        style={{ position: 'absolute', top: 10, left: at(shownActive), width: M.knob, height: M.knob, borderRadius: '50%', background: 'var(--accent-walk)', boxShadow: carryTo != null ? 'var(--lift-2)' : 'var(--lift-1)', transform: 'translate(-50%,-50%) scale(' + (carryTo != null ? WALK_HOVER_GROW : rowHot ? WALK_ROW_HOVER_GROW : 1) + ') translateZ(0)', transition: carryTo != null ? 'transform var(--dur-hover) var(--ease-soft)' : 'left var(--dur-move) var(--ease-soft), transform var(--dur-hover) var(--ease-soft)', cursor: onMakeActive ? (carryTo != null ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }} />
    </div>
  )
}

interface OpenRowProps extends RailProps {
  onJumpToActive?: () => void
  width: number
  center: number
  half: number
}

/** Open: the rail widened into a row of named `StepDot`s around `center`. The roaming stop takes the
 *  18px hold ring with its number, "roaming" above and the hold hint under its label. The line is
 *  filled up to the active node. Dots animate to a new `left`, so a re-centre slides rather than
 *  jumps. An edge marker pins the active node to whichever side it left. */
function OpenRow({ steps, activeStop, roamingStop, flags, isDone, walked, holdMs, onMakeActive, onRoamTo, onJumpToActive, onHover, renderPreview, width, center, half, rowHot }: OpenRowProps) {
  const [hotStop, setHotStop] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const M = PRESENTER_STRIP_METRICS
  const N = steps.length
  const roaming = roamingStop != null
  const centerX = width / 2
  /* THE OPEN ROW SPANS THE ROW, LIKE THE CLOSED RAIL DOES (DS OB-246; owner, 2026-09-21: opening
     the strip left "the same walk stops squashed a lot more compared to [the closed rail] where it
     spans the entire pane"). The row used to place dots at the CONSTANT `M.pitch` either side of
     centre, so its drawn span was a function of the stop COUNT and the row's spare width went
     unused: a walk that fits whole huddled in the middle, and a window clamped at either end left
     most of a pitch of bare line past its last dot.
     NOW `M.pitch` IS A FLOOR, NOT THE SPACING. The parent still counts how many stops fit AT that
     floor (`half`); this row spreads exactly that many across the usable span, so the pitch is
     `usable / (slotHi - slotLo)` and can only ever be >= the floor. */
  const all = N <= 2 * half + 1
  /* THE WINDOW IS CLAMPED TO THE WALK HERE, NOT ONLY WHERE `center` IS SET. `center` is state and
     `half` is a reading of the width: the row mounts at the 600px default, the opening effect picks
     a centre legal at THAT half, and `settleRead` then widens the row — whose clamp ceiling is
     lower. With a constant pitch a window past the end was invisible; with a SPREAD row it reserves
     slots for stops that do not exist. A row that lays itself out cannot trust a number set when
     the row was a different width: it clamps what it draws, keeping the span. */
  const spanMax = Math.min(N - 1, 2 * half)
  let lo = all ? 0 : center - half
  let hi = all ? N - 1 : center + half
  if (hi > N - 1) { hi = N - 1; lo = Math.max(0, hi - spanMax) }
  if (lo < 0) { lo = 0; hi = Math.min(N - 1, lo + spanMax) }
  /* WHAT EACH END OF THE ROW HOLDS decides where the spread starts. A labelled end stop is inset by
     the outermost LABEL's half-width (`SIDE_PAD`), or its label hangs over the strip's border; a
     PEEK end holds an unlabelled dot, so it is inset by the dot's own radius and the walk reaches
     almost the whole row. Reserving a peek slot where no peek exists is the dead space at the ends
     this row is not allowed to draw, so the two ends are asked separately. */
  const hasPeekLo = lo > 0
  const hasPeekHi = hi < N - 1
  const x0 = hasPeekLo ? M.stopDot / 2 : SIDE_PAD
  const x1 = width - (hasPeekHi ? M.stopDot / 2 : SIDE_PAD)
  const slotLo = hasPeekLo ? lo - 1 : lo
  const slotHi = hasPeekHi ? hi + 1 : hi
  const spread = slotHi > slotLo && x1 > x0
  const PITCH = spread ? (x1 - x0) / (slotHi - slotLo) : Math.max(1, width - SIDE_PAD * 2)
  const xOf = (i: number) => (spread ? x0 + (i - slotLo) * PITCH : centerX)
  /* the inverse of `xOf`, so the carried record lands on the stop under the pointer: the row's
     geometry is the window's left edge plus the derived pitch, which is all either direction needs */
  const indexAt = (clientX: number) => {
    const el = boxRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!spread) return lo
    return Math.max(0, Math.min(N - 1, slotLo + Math.round((clientX - r.left - x0) / PITCH)))
  }
  const [carryTo, startCarry, carried] = useCarry(indexAt, onMakeActive)
  const shownActive = carryTo != null ? carryTo : activeStop
  /* same guard as the closed rail: a carry ends over a dot, whose click would roam on top of the
     record that just landed */
  const roamClick = (i: number) => (onRoamTo ? () => { if (carried.current) { carried.current = false; return } onRoamTo(i) } : undefined)
  /* NO SLIDE ON THE FIRST PAINT: the row mounts already in place; only a later re-centre animates.
     Without this the dots slid in from wherever the row last stood, and opening read as movement. */
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id) }, [])
  const slide = ready ? 'left var(--dur-move) var(--ease-soft), width var(--dur-move) var(--ease-soft)' : 'none'
  const dots: ReactNode[] = []
  const labels: ReactNode[] = []
  /* THE ROOM AT EACH END IS NOT EMPTY — IT SHOWS THE NEXT STOP, FADED (clause 11): the real stop,
     at `peekOpacity`, no label, still a click to roam. DOTS SLIDE IN, NOT POP IN (clause 12): the
     row also renders `OVERSCAN` stops past each peek at opacity 0. */
  const peekLo = all ? -1 : lo - 1
  const peekHi = all ? N : hi + 1
  const OVERSCAN = 3
  for (let i = peekLo - OVERSCAN; i <= peekHi + OVERSCAN; i++) {
    if (i < 0 || i >= N) continue
    const beyond = i < peekLo || i > peekHi
    const peek = !beyond && (i < lo || i > hi)
    const x = xOf(i)
    const isRoam = roaming && i === roamingStop
    const isActive = i === shownActive
    const state: 'done' | 'current' | 'ahead' = isActive ? 'current' : isDone(i) ? 'done' : 'ahead'
    const flagged = flags.indexOf(i) >= 0
    /* THE RECORD'S OWN DOT IS THE HANDLE — the same gesture the closed rail's knob takes. Only the
       ACTIVE dot picks up: a drag from any other stop would be the click-to-roam gesture with a
       wobble in it. */
    dots.push(
      <div key={i} data-presenter-dot={i} style={{ position: 'absolute', left: x, top: '50%', transform: 'translate(-50%,-50%)', transition: slide + (ready ? ', opacity var(--dur-move) var(--ease-soft)' : ''), opacity: beyond ? 0 : peek ? M.peekOpacity : 1, pointerEvents: beyond ? 'none' : undefined, cursor: isActive && onMakeActive ? (carryTo != null ? 'grabbing' : 'grab') : undefined, touchAction: isActive && onMakeActive ? 'none' : undefined }}
        onPointerDown={isActive && onMakeActive ? startCarry : undefined}
        onMouseEnter={(e) => { setHotStop(i); onHover(i, e.currentTarget) }} onMouseLeave={() => { setHotStop(null); onHover(null) }}>
        {/* the scale goes on the INNER box, never the wrapper: the wrapper's transform is the
           `translate(-50%,-50%)` that centres the dot on its x */}
        <div style={{ position: 'relative', ...walkHoverStyle(hotStop === i ? WALK_HOVER_GROW : rowHot ? WALK_ROW_HOVER_GROW : 1) }}>
          {isRoam ? (
            <HoldRing size={M.ringOpen} n={i + 1} holdMs={holdMs} onMakeActive={() => onMakeActive && onMakeActive(i)} title={'hold to make stop ' + (i + 1) + ' the active node'} />
          ) : (
            <StepDot n={i + 1} size={M.stopDot} state={state} title={renderPreview ? undefined : steps[i].title} onClick={roamClick(i)} />
          )}
          {flagged ? <div title={renderPreview ? undefined : wrapTip('flagged')} onClick={onRoamTo ? () => onRoamTo(i) : undefined} style={{ position: 'absolute', left: '50%', top: -12, transform: 'translateX(-30%)', cursor: onRoamTo ? 'pointer' : 'default' }}><FlagMark size={10} filled style={{ color: 'var(--acorn-600)' }} /></div> : null}
          {isRoam ? <div style={{ position: 'absolute', left: '50%', top: -13, transform: 'translateX(-50%)', pointerEvents: 'none', ...CAPS }}>roaming</div> : null}
        </div>
      </div>
    )
    labels.push(
      <div key={'l' + i} style={{ position: 'absolute', left: x, top: 0, transform: 'translateX(-50%)', width: 66, textAlign: 'center', transition: slide + (ready ? ', opacity var(--dur-move) var(--ease-soft)' : ''), opacity: peek || beyond ? 0 : 1, pointerEvents: peek || beyond ? 'none' : undefined }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, lineHeight: 1.25, color: isActive || isRoam ? 'var(--text-walk)' : 'var(--text-3)', fontWeight: isActive || isRoam ? 'var(--fw-semibold)' : 'var(--fw-regular)', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{steps[i].title}</div>
        {isRoam ? <div style={{ position: 'absolute', left: '50%', top: 30, transform: 'translateX(-50%)', width: 150, textAlign: 'center', ...HOLD_HINT }}>(hold to make active)</div> : null}
      </div>
    )
  }
  /* THE MARKER ASKS WHETHER THE RECORD IS IN THE WINDOW, NOT WHERE ITS PIXEL LANDS. This was
     `activeX < PITCH / 2`, which is true of the row's FIRST DOT the moment the pitch grows past
     twice the inset — the spread row would have pinned a "back to the active node" pill beside a
     stop the reader can see. The window's own bounds answer it exactly, at any pitch. */
  const offLeft = activeStop < lo
  const offRight = activeStop > hi
  /* the drawn line runs between the walk's REAL ends, clipped to the strip; the fill is per segment,
     the same rule as the closed rail — a skipped stretch is a gap, never orange */
  const lineStart = Math.max(0, xOf(0))
  const lineEnd = Math.min(width, xOf(N - 1))
  const segs: ReactNode[] = []
  /* THE FILL IS BOUNDED BY THE PIXELS, NOT BY THE DOTS (clause 5) — `fillBounds`, published so the
     arithmetic is testable rather than retyped. It takes the row's OUTERMOST SLOTS, peeks included,
     and extends one segment past each: with the window spread across the width there is no
     pitch-and-centre sum left to get wrong. */
  const [first, last] = fillBounds(slotLo, slotHi, N)
  for (let i = first; i < last; i++) {
    if (!walked(i)) continue
    const a = Math.max(0, xOf(i))
    const b = Math.min(width, xOf(i + 1))
    if (b > a) segs.push(<div key={'s' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: a - lineStart, width: b - a, background: 'var(--accent-walk)', opacity: 0.55, transition: slide }} />)
  }
  return (
    <>
      <div ref={boxRef} data-presenter-row style={{ position: 'relative', height: P.dots, marginTop: roaming ? P.rowGapRoaming : P.rowGap, clipPath: 'inset(-40px 0)' }}>
        <div style={{ position: 'absolute', left: lineStart, width: Math.max(0, lineEnd - lineStart), top: P.dots / 2 - (M.line + (rowHot ? M.lineGrow : 0)) / 2, height: M.line + (rowHot ? M.lineGrow : 0), background: 'var(--bark-100)', transition: slide + ', height var(--dur-hover) var(--ease-soft), top var(--dur-hover) var(--ease-soft)' }}>
          {segs}
        </div>
        {dots}
        {offLeft || offRight ? (
          /* a 3px halo in the strip's own paper masks the dots the marker sits over, so it reads as
             ON the row rather than tangled in it */
          <HotPill onClick={onJumpToActive} title="back to the active node" style={{ position: 'absolute', ...(offLeft ? { left: 4 } : { right: 4 }), top: '50%', transform: 'translateY(-50%)', zIndex: 2, gap: 4, padding: '0 6px', boxShadow: '0 0 0 3px var(--surface-paper), var(--lift-1)', fontSize: 10, fontWeight: 'var(--fw-semibold)', color: 'var(--text-walk)' }}>
            {offLeft ? '←' : null}<StepDot n={activeStop + 1} state="current" size={14} /><span>active node</span>{offRight ? '→' : null}
          </HotPill>
        ) : null}
      </div>
      <div style={{ position: 'relative', height: roaming ? P.labelsRoaming : P.labels, marginTop: P.labelGap, clipPath: 'inset(0 0 -40px)' }}>{labels}</div>
    </>
  )
}

/** THE TWO ROWS, PUBLISHED SO THEY CAN BE READ — the same `ClosedRail` and `OpenRow` function
 *  objects this component renders. Read them; do not render them. The supported surface is
 *  `PresenterStrip`. */
export const PRESENTER_STRIP_PARTS = { ClosedRail, OpenRow }

/** The presenter strip: a breadcrumb row over a rail that grows into a row of named stops.
 *
 *  WHAT THE COLUMN AROUND IT MUST DO: THE STRIP IS IN FLOW, NEVER AN OVERLAY — mount it as a
 *  `flex: none` child of a flex COLUMN (it sets that itself) and give every pane below it
 *  `flex: 1; min-height: 0`; a host that lays out arithmetically reads `presenterStripHeight`.
 *  The height changes on exactly two events: `onOpenChange`/`open`, and `roamingStop` going
 *  null ↔ a number.
 *
 *  ROAMING AND ACTIVE ARE TWO DIFFERENT FACTS. `activeStop` is the lecture's committed record —
 *  what the pill counts, what the fill reaches, where ←/→ resume. `roamingStop` is provisional.
 *  THE RECORD MOVES ONLY BY A GESTURE THAT STARTS ON THE RECORD: a hold on the roaming ring, or
 *  a drag of the active node's own mark — both fire `onMakeActive`. A click on a tick, a dot, a
 *  flag or a finder row only ROAMS.
 *
 *  COVERED IS A THIRD FACT, the host's. With `covered` given, a stop draws done only if the host
 *  says it was presented; without it, every stop before the active node counts. THE FILL IS PER
 *  SEGMENT, so a skipped stretch is a gap. The pill always counts the ACTIVE NODE'S POSITION.
 *
 *  THE OPEN ROW IS A WINDOW, NOT A SPOTLIGHT: opening keeps the shown stop at the fraction the
 *  closed rail had it; a step slides one pitch, a jump re-centres; the ends peek. A drag across
 *  the strip selects nothing. Every mark on the row grows under the pointer; type does not. */
export interface PresenterStripProps {
  /** the walk's stops, in order — title, territory and hue for the breadcrumb and the labels */
  steps: PresenterStripStep[]
  /** the lecture's committed record, 0 … steps.length − 1 */
  activeStop: number
  /** the stop being shown while roaming, or `null`/`undefined` when not roaming */
  roamingStop?: number | null
  /** flagged stop indices — a small flag above that stop's tick/dot on either rail. Clicking a flag
   *  fires `onRoamTo(index)`, like the tick under it. */
  flags?: number[]
  /** indices the host has actually presented. Given, a stop is `done` only if listed; omitted,
   *  every index below `activeStop` is `done`. */
  covered?: number[]
  /** the find button (magnifying glass, row 1's left end). Omit to hide it. Fires with the button's
   *  `getBoundingClientRect()` to open — pass it to `StopFinder` as `anchor` — or `null` to close,
   *  when `finderOpen` is true. */
  onFind?: (anchor: DOMRect | null) => void
  /** the finder is showing — the button draws pressed and its next click closes. Default `false` */
  finderOpen?: boolean
  /** "back to active node" (row 1, while roaming) and the open row's edge marker both fire this */
  onJumpToActive?: () => void
  /** a stop was clicked — a closed-rail tick or an open-row dot. The HOST decides what it means
   *  (typically: start roaming there). Omit for a read-only rail; the hold ring stays live. */
  onRoamTo?: (index: number) => void
  /** the hold completed on `roamingStop`'s ring, or the record was dragged — the host sets
   *  `activeStop`, typically clears `roamingStop`, and records the stop in `covered`. Omitted,
   *  the ring is inert and nothing can be carried. */
  onMakeActive?: (index: number) => void
  /** ms to hold before `onMakeActive` fires. Default 600 — still an open call per the plan.
   *  THE HOLD'S CLOCK IS AN INTERVAL READING `performance.now()`, NEVER A FRAME COUNT, and a port
   *  must keep it that way (2026-09-06; `receipts/5db0dea.md`, OB-165). A window that is not in
   *  front gets no animation frames, and starting a lecture focuses the projector window — so a
   *  rAF-driven hold begun while the professor looks at the projector never advances at all, and
   *  the one gesture that COMMITS the record is dead with nothing on screen to say so. A throttled
   *  interval still fires, and a monotonic read lands on the true progress rather than resuming
   *  where it stopped. The fill is a hair less smooth than vsync in exchange; that is the trade. */
  holdMs?: number
  /** controlled open state (rail vs. named row). Omit to let the strip own it via `defaultOpen`. */
  open?: boolean
  /** the strip's own starting state when uncontrolled */
  defaultOpen?: boolean
  /** its height is about to change */
  onOpenChange?: (open: boolean) => void
  /** the hover preview's content, shown through `WalkPreview` above a hovered tick or dot — the
   *  same card the walk strip, the map dock and a map pin show. Omitted, a native `title` carries
   *  the stop's name instead (never both: two tooltips for one pointer rest). */
  renderPreview?: (step: PresenterStripStep, index: number) => ReactNode
  /** the hovered stop, `null` on leave — for a host that lights the same stop elsewhere */
  onStepHover?: (index: number | null) => void
  /** the pill's face — the stop number ("10 / 22") or the walk as a percentage. Clicking the pill
   *  toggles it; controlled via `metric`, or the strip owns it from `defaultMetric`. */
  metric?: 'position' | 'percent'
  /** the pill's starting face when uncontrolled */
  defaultMetric?: 'position' | 'percent'
  /** the pill's face was toggled */
  onMetricChange?: (metric: 'position' | 'percent') => void
}

export function PresenterStrip({
  steps = [], activeStop = 0, roamingStop = null, flags = [], covered, onFind, onJumpToActive,
  onRoamTo, onMakeActive, holdMs = HOLD_MS_DEFAULT, open, defaultOpen = false, onOpenChange, renderPreview, onStepHover,
  metric, defaultMetric = 'position', onMetricChange, finderOpen = false,
}: PresenterStripProps) {
  const M = PRESENTER_STRIP_METRICS
  const [openState, setOpenState] = useState(defaultOpen)
  const isOpen = open === undefined ? openState : open
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenState(v))
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [rowWidth, setRowWidth] = useState(600)
  /* READ ON A SETTLE LADDER, THEN OBSERVE (clause 8): an observer's first callback arrives before
     layout is final, and a settled box gets no second one — so the open row sat on its 600px
     default. The ladder reads; the observer follows later changes. */
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const read = () => { if (rowRef.current) setRowWidth(rowRef.current.getBoundingClientRect().width) }
    const stop = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, [])
  const N = steps.length
  const LAST = Math.max(1, N - 1)
  const roaming = roamingStop != null
  const shown = roaming ? roamingStop : activeStop
  const width = Math.max(200, rowWidth - 26)
  /* HOW MANY STOPS THE ROW CAN LABEL, at the `pitch` FLOOR and no tighter. The row itself then
     spreads that many across the width (see `OpenRow`), so this number decides density and the
     width decides spacing — two questions that used to be one. One slot per side is held back for
     the peek dot and for the outermost label's overhang. */
  const half = Math.max(1, Math.floor(Math.max(1, Math.ceil((width - SIDE_PAD * 2) / M.pitch)) / 2) - 1)
  /* THE ROW IS A WINDOW, NOT A SPOTLIGHT: it re-centres only when the shown stop reaches its edge.
     THE WINDOW NEVER SHOWS DEAD SPACE: its centre is clamped so the first and last stops sit at its
     edges, a walk that fits whole is spread across the row, and the window itself is spread whether
     or not it is clamped. */
  const all = N <= 2 * half + 1
  const clampCenter = (c: number) => (all ? LAST / 2 : Math.max(half, Math.min(LAST - half, c)))
  const [center, setCenter] = useState(() => clampCenter(shown))
  /* A STEP SCROLLS ONE PITCH; ONLY A JUMP RE-CENTRES (clause 12). The shown stop moved by one →
     the window slides one pitch, keeping the stop at its edge; further → re-centres on it. */
  const prevShown = useRef(shown)
  useEffect(() => {
    const d = shown - center
    const step = Math.abs(shown - prevShown.current) <= 1
    prevShown.current = shown
    if (Math.abs(d) < Math.max(1, half)) return
    setCenter(clampCenter(step ? center + Math.sign(d) : shown))
    // the DS's deps: the shown stop and the window's half-width, deliberately not `center`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, half])
  /* AND THE STATE IS RE-CLAMPED WHEN THE READING CHANGES (DS OB-246). `half` is derived from a width
     that arrives after the first paint, so a centre legal at the mount width can be illegal a frame
     later; the step effect above returns early whenever the shown stop is inside the window, so
     nothing else ever corrects it. `OpenRow` clamps what it DRAWS regardless — this keeps the
     stored centre honest as well, so a later step starts from a legal number. */
  useEffect(() => {
    setCenter((c) => clampCenter(c))
    // the DS's deps: the reading and the walk's length — `clampCenter` is derived from both
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [half, N])
  /* OPENING KEEPS THE SHOWN STOP WHERE THE CLOSED RAIL HAD IT — the same horizontal fraction of the
     row — so the ring does not leap to the middle as the row grows around it. A LAYOUT effect, so
     the first paint is already in place. */
  useLayoutEffect(() => {
    if (!isOpen) return
    const frac = N > 1 ? shown / LAST : 0.5
    const x = SIDE_PAD + frac * (width - SIDE_PAD * 2)
    const lim = Math.max(0, half - 1)
    /* the DRAWN pitch, not the floor: the row spreads its slots across the width, so a pixel
       distance converts to slots at `(width - dot) / slots` — the 68 floor here would over-count
       the offset by whatever slack the spread took up and land the ring a stop or two from where
       the rail had it. */
    const drawnPitch = Math.max(1, (width - M.stopDot) / (2 * half + 2))
    const offset = Math.max(-lim, Math.min(lim, Math.round((x - width / 2) / drawnPitch)))
    setCenter(clampCenter(shown - offset))
    // the DS's deps: the open flag alone — the row's first paint, not every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
  /* THE PILL'S FACE: position ("10 / 22") or percent, toggled by clicking it — `WalkDock`'s pair. */
  const [metricU, setMetricU] = useState(defaultMetric)
  const face = metric === undefined ? metricU : metric
  const setFace = (v: 'position' | 'percent') => { setMetricU(v); if (onMetricChange) onMetricChange(v) }
  const [pillHot, setPillHot] = useState(false)
  /* THE ROW ANSWERS THE POINTER AS A WHOLE, in BOTH modes (clause 9) */
  const [rowHot, setRowHot] = useState(false)
  const covSet = covered ? new Set(covered) : null
  const isDone = (i: number) => (covSet ? covSet.has(i) : i < activeStop)
  /* a SEGMENT i→i+1 is walked when both ends are covered, or i is covered and i+1 is the active node */
  const walked = (i: number) => isDone(i) && (isDone(i + 1) || i + 1 === activeStop)
  /* THE HOVER PREVIEW — `WalkPreview`, the same popup the strip, the dock and a map pin open. */
  const [hover, setHover] = useState<{ i: number; x: number; top: number } | null>(null)
  const onHover = (i: number | null, el?: HTMLElement) => {
    if (i == null) { setHover(null); if (onStepHover) onStepHover(null); return }
    if (onStepHover) onStepHover(i)
    if (renderPreview && el) setHover({ i, ...previewAnchor(el.getBoundingClientRect()) })
  }
  const pc = (N ? activeStop / LAST : 0) * 100
  const railProps: RailProps = { steps, activeStop, roamingStop, flags, isDone, walked, holdMs, onMakeActive, onRoamTo, onHover, renderPreview, rowHot }
  return (
    <div ref={rowRef} data-presenter-strip={isOpen ? 'open' : 'closed'}
      onMouseEnter={() => setRowHot(true)} onMouseLeave={() => setRowHot(false)}
      style={{ boxSizing: 'border-box', padding: P.padTop + 'px 12px ' + P.padBottom + 'px', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', flex: 'none',
      /* NOTHING ON THE STRIP IS TEXT TO TAKE AWAY (clause 6): every part of it is furniture */
      userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: P.row }}>
        {/* THE FIND BUTTON IS A TOGGLE: with `finderOpen` true it fires `onFind(null)` — close — and
            draws pressed, so a second click on the magnifier puts the finder away */}
        <IconButton tone="chrome" size={20} glyphSize={12} title={finderOpen ? 'close the finder' : 'find a stop'} label={finderOpen ? 'close the finder' : 'find a stop'}
          style={finderOpen ? { background: 'var(--surface-hover)', color: 'var(--text-1)' } : undefined}
          onClick={onFind ? (e) => onFind(finderOpen ? null : e.currentTarget.getBoundingClientRect()) : undefined}><FindMark size={12} /></IconButton>
        <Crumbs step={steps[shown]} />
        {roaming ? (
          <HotPill onClick={onJumpToActive} title="back to the active node" style={{ padding: '0 8px 0 6px', border: '1px solid var(--border-frame)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>
            <StepDot n={activeStop + 1} state="current" size={14} />back to active node
          </HotPill>
        ) : null}
        {/* THE PILL COUNTS THE RECORD, not the roam, and its wash is the same fraction the rail fills */}
        <button type="button" data-presenter-pill onClick={() => setFace(face === 'position' ? 'percent' : 'position')} title={wrapTip(face === 'position' ? 'show the walk as a percentage' : 'show the stop number')}
          onMouseEnter={() => setPillHot(true)} onMouseLeave={() => setPillHot(false)}
          style={{ flexShrink: 0, minWidth: 52, textAlign: 'center', whiteSpace: 'nowrap', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-snug)', fontVariantNumeric: 'var(--tnum)', color: pillHot ? 'var(--text-1)' : 'var(--text-2)', border: '1px solid ' + (pillHot ? 'var(--border-frame)' : 'var(--border-rule)'), borderRadius: 999, padding: '1px 7px', boxSizing: 'border-box', transition: 'var(--transition-wash)',
          background: 'linear-gradient(90deg, color-mix(in oklab, var(--accent-walk) 26%, var(--surface-raised)) ' + pc.toFixed(2) + '%, var(--surface-raised) ' + pc.toFixed(2) + '%)' }}>{N === 0 ? '—' : face === 'position' ? (activeStop + 1) + ' / ' + N : Math.round(pc) + '%'}</button>
        {/* DOWN WHEN CLOSED (the row will appear below), UP WHEN OPEN (it folds back up). */}
        <IconButton tone="chrome" size={20} glyphSize={12} title={isOpen ? 'hide the stops' : 'show every stop'} label={isOpen ? 'hide the stops' : 'show every stop'} onClick={() => setOpen(!isOpen)}><Caret open style={isOpen ? UP : undefined} /></IconButton>
      </div>
      {isOpen
        ? <OpenRow {...railProps} onJumpToActive={onJumpToActive} width={width} center={center} half={half} />
        : <ClosedRail {...railProps} />}
      {hover && renderPreview && steps[hover.i] ? (
        <WalkPreview x={hover.x} top={hover.top}>{renderPreview(steps[hover.i], hover.i)}</WalkPreview>
      ) : null}
    </div>
  )
}
