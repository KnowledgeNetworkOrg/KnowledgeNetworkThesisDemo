import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { wrapTip } from './IconButton'

/** THE HANDLE'S GEOMETRY, published for the reason every metric here is: a host drawing its own
 *  desk has to reserve the strip's width in its own layout arithmetic, and a number in prose gets
 *  retyped. `hit` is the STRIP, `line` the hairline drawn inside it — they are different numbers
 *  on purpose: a 1px target is not a target (the rule `ConnectionsSplitPane`'s internal divider
 *  paid for, and this is the same 14/1 at `inset` 6). `lineHover` is the swell on hover and while
 *  dragging, the same "a scrubber thickens under the pointer" move the walk rail makes.
 *  `keyStep` / `keyStepBig` are the arrow-key nudges, in px: a divider that can only be dragged
 *  cannot be moved by someone who is not holding a mouse. */
export const PANE_DIVIDER_METRICS = { hit: 14, line: 1, lineHover: 2, inset: 6, keyStep: 16, keyStepBig: 64 } as const
const D = PANE_DIVIDER_METRICS

/** WHAT A PANE DECLARES ABOUT ITS OWN WIDTH — TWO NUMBERS, NOT ONE, and that is the answer to the
 *  question `receipts/4b3ef1c.md` asked and OB-168 reserved: "degrade to a lesser reading" and "do
 *  not function at all" are different promises, and a desk cannot arbitrate between panes without
 *  knowing which it is being told.
 *
 *  A pane with nothing to degrade to sets them equal, and that is a real statement rather than a
 *  gap: it says there is no lesser reading, only working and not working.
 *
 *  THE DECLARATION IS THE COMPONENT'S, AND ITS NUMBERS ARE MEASUREMENTS, not preferences — the
 *  width at which its own content stops fitting, which only it can know. A desk may not override
 *  them; a desk that needs a pane narrower than its floor needs a different pane. */
export interface PaneFit {
  /** below this the pane still works but draws a LESSER READING (the connections pane becomes one
   *  sliding column; a document pane drops to one text column). The pane itself reads this; a desk
   *  only needs to know it exists, to avoid parking a pane just under it. */
  narrowBelow?: number
  /** below this the pane does not work at all. THE DRAG STOPS HERE. Required: a pane that declares
   *  only `narrowBelow` has told a desk the interesting number and not the load-bearing one, and
   *  the clamp then has to invent a floor, which is how a handle starves a pane to 200px. */
  floor?: number
}

/** normalises a `PaneFit`: fills a missing `floor` from `narrowBelow` and vice versa, so the
 *  clamp never reads `undefined` as zero. Published because a desk assembling fits from several
 *  panes needs the same normalisation the clamp uses. */
export function paneFit(fit?: PaneFit | null): { narrowBelow: number; floor: number } {
  const nb = fit && typeof fit.narrowBelow === 'number' && Number.isFinite(fit.narrowBelow) ? fit.narrowBelow : undefined
  const fl = fit && typeof fit.floor === 'number' && Number.isFinite(fit.floor) ? fit.floor : nb
  return { narrowBelow: nb === undefined ? (fl === undefined ? 0 : fl) : nb, floor: fl === undefined ? 0 : fl }
}

/** THE CLAMP, AS ARITHMETIC — the whole of what this side owes the desk's drag, in one pure
 *  function. Give it the panes' current widths, which boundary is being dragged, the px the
 *  pointer has moved, and each pane's declared fit; get back the widths to draw.
 *
 *  ONE CLAMP PAIR, READ BY THE DRAG AND BY ANY RESET, which is the rule the two dividers this
 *  project already owns paid for: when a double-click fit computed its own bounds, a fit past the
 *  drag's cap snapped back on the first touch of the handle. So there is one function and both
 *  gestures call it.
 *
 *  A DRAG MOVES ONE BOUNDARY AND NEVER CASCADES. When the neighbour you are pushing into reaches
 *  its floor, the handle STOPS — it does not start pushing the pane beyond it. The alternative was
 *  drawn and rejected: a drag that cascades moves two boundaries at once, so the pane under your
 *  pointer keeps growing while a pane you are not touching shrinks, and nothing on screen says
 *  why. A handle that stops is legible; a handle that redistributes the whole desk is a mystery.
 *
 *  THE TOTAL IS PRESERVED. Two panes exchange width; every other pane is identical in the
 *  returned array. A desk whose total changed under a drag would re-fit its own layout.
 *
 *  IT IS PURE, AND THE STATE STAYS THE HOST'S. `PaneDivider` reports pointer deltas; this turns a
 *  delta into widths; the desk's store holds them. Same split as the walk's clock: the arithmetic
 *  is ours so it cannot drift, the state is the host's because that is where it already lives. */
export function clampDesk({ sizes = [], index = 0, delta = 0, fits = [] }: {
  sizes?: number[]
  index?: number
  delta?: number
  fits?: (PaneFit | null | undefined)[]
} = {}): number[] {
  const out = sizes.slice()
  const a = index, b = index + 1
  if (!(a >= 0 && b < out.length)) return out
  const fa = paneFit(fits[a]), fb = paneFit(fits[b])
  /* the room each side has to give: its own width less its own floor. A pane already at or under
     its floor gives nothing — never a negative, which would let a drag STEAL width from a pane
     that is already too narrow. */
  const giveA = Math.max(0, out[a] - fa.floor)
  const giveB = Math.max(0, out[b] - fb.floor)
  const d = Math.max(-giveA, Math.min(giveB, delta))
  out[a] = out[a] + d
  out[b] = out[b] - d
  return out
}

/** HOW FAR THIS BOUNDARY CAN TRAVEL, for the handle's `aria-valuemin`/`max` and for a host that
 *  wants to draw the limit — the same two numbers `clampDesk` clamps with, published so a readout
 *  cannot disagree with the gesture. In the boundary's own coordinate: the left pane's width. */
export function deskBounds({ sizes = [], index = 0, fits = [] }: {
  sizes?: number[]
  index?: number
  fits?: (PaneFit | null | undefined)[]
} = {}): { now: number; min: number; max: number } {
  const a = index, b = index + 1
  if (!(a >= 0 && b < sizes.length)) return { min: 0, max: 0, now: 0 }
  const fa = paneFit(fits[a]), fb = paneFit(fits[b])
  return {
    now: sizes[a],
    min: Math.min(sizes[a], fa.floor),
    max: Math.max(sizes[a], sizes[a] + Math.max(0, sizes[b] - fb.floor)),
  }
}

/** THE DRAG HANDLE BETWEEN TWO PANES — a 14px hit strip drawing a 1px hairline, `col-resize`,
 *  reporting the pointer's px travel and nothing else.
 *
 *  WHAT IT REPORTS, and why it is a DELTA rather than a width: the handle does not know what the
 *  panes either side of it are, and it must not learn. `onDrag(delta)` fires on every move with
 *  the px travelled since the gesture began (signed: positive grows the pane BEFORE it), the host
 *  runs `clampDesk` and writes its own store. `onDragEnd()` closes the gesture — the moment to
 *  persist, and the only one: a store written on every move records a hundred widths for one drag.
 *  `onReset()` is the double-click, the "fit" gesture both internal dividers already have.
 *
 *  THE DRAWN POSITION IS NEVER THIS COMPONENT'S. It sits where the host's flex layout puts it,
 *  which is the other half of the rule those dividers paid for: a width restored from storage into
 *  a smaller pane must not be able to push the handle out of reach, and the only way to guarantee
 *  that is for the drawn widths to be derived from the measured row every render. */
export interface PaneDividerProps {
  /** `vertical` (default) sits between two columns and resizes their widths; `horizontal` sits
   *  between two rows. The cursor, the keys and the axis all follow it. */
  orientation?: 'vertical' | 'horizontal'
  /** every pointer move and every key nudge: the px travelled since the gesture began, signed so
   *  positive grows the pane BEFORE the handle. Feed it to `clampDesk`. */
  onDrag?: (delta: number) => void
  /** the gesture ended, and it hands back the gesture's TOTAL TRAVEL in px. THE ONLY MOMENT TO
   *  PERSIST — a store written on every move records a hundred widths for one drag. Also fires
   *  after each keyboard nudge, which is one whole gesture.
   *
   *  RE-RUN THE CLAMP WITH THIS DELTA; DO NOT READ YOUR OWN STATE HERE. On a key nudge both
   *  callbacks fire inside one event, so the `setState` from `onDrag` has not rendered and a host
   *  reading its widths in this callback reads the values from BEFORE the gesture — it then
   *  persists the wrong ones, and a re-derivation from those stale numbers can move the boundary
   *  BACKWARDS. Same delta, same clamp, same answer, nothing to be stale. */
  onDragEnd?: (delta: number) => void
  /** double-click, Enter or Space: the "fit" gesture both internal dividers already have. What a
   *  reset means is yours (content fit, preset ratio, equal thirds) — but it must go through
   *  `clampDesk` like everything else. */
  onReset?: () => void
  /** announcement only (`aria-valuenow`/`min`/`max`): spread a `deskBounds(...)` answer straight
   *  in — its keys ARE these three names. Omitted, the separator is still operable and simply
   *  silent about where it stands. */
  now?: number
  /** `deskBounds`'s lower bound, for the announcement */
  min?: number
  /** `deskBounds`'s upper bound, for the announcement */
  max?: number
  /** @deprecated pass `now` instead — same meaning, and the name is what `deskBounds` returns.
   *  The two disagreed for a day, so every documented spread landed `min`/`max` and dropped the
   *  position: a separator announced with bounds and no value. */
  value?: number
  /** the separator's accessible name. Default "resize the panes"; name the two panes when a desk
   *  has more than one handle ("resize map and connections"), since "separator" alone tells a
   *  screen-reader user nothing about which boundary they are on. */
  label?: string
  /** a boundary that cannot move right now (a collapsed neighbour): no drag, no keys, no cursor
   *  change, and nothing drawn in any state. The strip STAYS IN THE LAYOUT — removing it would
   *  shift both panes by its width at the moment a pane collapses. */
  disabled?: boolean
  /** placement from the host — the strip takes no position of its own */
  style?: CSSProperties
}

export function PaneDivider({ orientation = 'vertical', onDrag, onDragEnd, onReset, now, value, min, max, label = 'resize the panes', disabled, style }: PaneDividerProps) {
  const [hot, setHot] = useState(false)
  const [dragging, setDragging] = useState(false)
  const vertical = orientation !== 'horizontal'
  const start = useRef(0)
  /* THE GESTURE'S TOTAL TRAVEL, so `onDragEnd` can hand it back. A host that had to read its own
     state inside the end callback got the PRE-gesture value — both callbacks fire inside one
     event, so a `setState` from `onDrag` has not rendered yet, and a keyboard nudge (which fires
     both in the same handler) then persisted the widths from before the nudge and re-derived the
     boundary BACKWARDS. Fixed here rather than in the card, because every host following the
     documented pattern had it. */
  const travel = useRef(0)
  const nudge = (px: number) => { travel.current = px; if (onDrag) onDrag(px); if (onDragEnd) onDragEnd(px) }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    start.current = vertical ? e.clientX : e.clientY
    travel.current = 0
    /* THE LISTENERS GO ON `window`, not on the strip: a 14px target is left behind by the first
       fast flick of the pointer, and a gesture that ends when the cursor leaves the handle is a
       gesture that ends immediately. */
    const mv = (ev: PointerEvent) => {
      travel.current = (vertical ? ev.clientX : ev.clientY) - start.current
      if (onDrag) onDrag(travel.current)
    }
    const up = () => {
      setDragging(false)
      if (onDragEnd) onDragEnd(travel.current)
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const big = e.shiftKey ? D.keyStepBig : D.keyStep
    const k = e.key
    const back = vertical ? 'ArrowLeft' : 'ArrowUp'
    const fwd = vertical ? 'ArrowRight' : 'ArrowDown'
    if (k === back) { e.preventDefault(); nudge(-big) }
    else if (k === fwd) { e.preventDefault(); nudge(big) }
    /* Home/End ask for MORE than the bounds and let the clamp answer — the handle does not know
       the bounds, and a number it computed itself could disagree with the one the drag obeys. */
    else if (k === 'Home') { e.preventDefault(); nudge(-1e6) }
    else if (k === 'End') { e.preventDefault(); nudge(1e6) }
    else if ((k === 'Enter' || k === ' ') && onReset) { e.preventDefault(); onReset() }
  }
  const lit = dragging || hot
  const lineW = lit ? D.lineHover : D.line
  const announced = typeof now === 'number' && Number.isFinite(now) ? Math.round(now)
    : typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined
  return (
    <div role="separator" aria-orientation={vertical ? 'vertical' : 'horizontal'} tabIndex={disabled ? undefined : 0}
      aria-label={label} aria-disabled={disabled ? 'true' : undefined}
      aria-valuenow={announced}
      aria-valuemin={typeof min === 'number' && Number.isFinite(min) ? Math.round(min) : undefined}
      aria-valuemax={typeof max === 'number' && Number.isFinite(max) ? Math.round(max) : undefined}
      title={disabled ? undefined : wrapTip('drag to resize · double-click to reset')}
      onPointerDown={onPointerDown} onDoubleClick={disabled ? undefined : onReset} onKeyDown={onKeyDown}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)} onBlur={() => setHot(false)}
      style={{
        flex: 'none', position: 'relative', outline: 'none', touchAction: 'none',
        ...(vertical ? { width: D.hit, alignSelf: 'stretch' } : { height: D.hit, width: '100%' }),
        cursor: disabled ? 'default' : (vertical ? 'col-resize' : 'row-resize'),
        /* THE WHOLE STRIP DOES NOT PAINT. A 14px band in any tint reads as a gutter between two
           documents; the hairline is the only mark, and it thickens rather than lighting a box. */
        ...style,
      }}>
      <div aria-hidden="true" style={{
        position: 'absolute',
        ...(vertical
          ? { top: 0, bottom: 0, left: D.inset - lineW / 2, width: lineW }
          : { left: 0, right: 0, top: D.inset - lineW / 2, height: lineW }),
        /* AT REST IT DRAWS NOTHING (owner, 2026-09-20: "quite distracting"). The boundary between
           two panes is already drawn — by the two panes' own frames — so a resting hairline in the
           gutter is a THIRD line saying what the first two say. The mark is the answer to a
           gesture rather than furniture: it fades in under the pointer, on keyboard focus (`lit`
           covers both) and while dragging. The strip keeps its 14px and its `col-resize`, so the
           boundary is still found the way a boundary is found. */
        background: dragging ? 'var(--accent-primary)' : lit ? 'var(--border-frame)' : 'transparent',
        transition: 'background var(--dur-hover) var(--ease-soft), width .12s var(--ease-soft), height .12s var(--ease-soft)',
      }} />
    </div>
  )
}

/* NOT PORTED: the DS's `DeskMath` alias (`{ fit, clamp, bounds, METRICS }`), which exists so a
   card or a raw page reading off `window.<Namespace>` can reach lower-case helpers — the window
   namespace carries no lower-case export. Application code imports the named functions, as the
   DS's own contract says; this app does.

   Typed port of the DS components/chrome/PaneDivider.jsx (OB-170 + OB-253 / #341). */
