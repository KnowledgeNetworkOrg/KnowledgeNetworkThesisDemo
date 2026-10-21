import React from 'react'

/** THE HANDLE'S GEOMETRY, published for the reason every metric here is: a host drawing its own
 *  desk has to reserve the strip's width in its own layout arithmetic, and a number in prose gets
 *  retyped. `hit` is the STRIP, `line` the hairline drawn inside it — they are different numbers
 *  on purpose: a 1px target is not a target (the rule `ConnectionsSplitPane`'s internal divider
 *  paid for, and this is the same 14/1 at `inset` 6). `lineHover` is the swell on hover and while
 *  dragging, the same "a scrubber thickens under the pointer" move the walk rail makes.
 *  `keyStep` / `keyStepBig` are the arrow-key nudges, in px: a divider that can only be dragged
 *  cannot be moved by someone who is not holding a mouse. */
export const PANE_DIVIDER_METRICS = { hit: 14, line: 1, lineHover: 2, inset: 6, keyStep: 16, keyStepBig: 64 }
const D = PANE_DIVIDER_METRICS

/** WHAT A PANE DECLARES ABOUT ITS OWN WIDTH — TWO NUMBERS, NOT ONE, and that is the answer to the
 *  question `receipts/4b3ef1c.md` asked and OB-168 reserved: "degrade to a lesser reading" and "do
 *  not function at all" are different promises, and a desk cannot arbitrate between panes without
 *  knowing which it is being told.
 *
 *   - `narrowBelow` — below this the pane still works but draws a LESSER READING (the connections
 *     pane becomes one sliding column; a document pane drops to one text column). The pane itself
 *     reads this; a desk only needs to know it exists, to avoid parking a pane just under it.
 *   - `floor` — below this the pane does not work at all. THE DRAG STOPS HERE. Required: a pane
 *     that declares only `narrowBelow` has told a desk the interesting number and not the
 *     load-bearing one, and the clamp then has to invent a floor, which is how a handle starves a
 *     pane to 200px.
 *
 *  A pane with nothing to degrade to sets them equal, and that is a real statement rather than a
 *  gap: it says there is no lesser reading, only working and not working.
 *
 *  THE DECLARATION IS THE COMPONENT'S, AND ITS NUMBERS ARE MEASUREMENTS, not preferences — the
 *  width at which its own content stops fitting, which only it can know. A desk may not override
 *  them; a desk that needs a pane narrower than its floor needs a different pane. */
export function paneFit(fit) {
  const narrowBelow = fit && Number.isFinite(fit.narrowBelow) ? fit.narrowBelow : undefined
  const floor = fit && Number.isFinite(fit.floor) ? fit.floor : narrowBelow
  return { narrowBelow: narrowBelow === undefined ? floor : narrowBelow, floor: floor === undefined ? 0 : floor }
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
 *  The three-pane case is exactly where this matters, and it is the one problem the two internal
 *  dividers never had.
 *
 *  THE TOTAL IS PRESERVED. Two panes exchange width; every other pane is byte-identical in the
 *  returned array. A desk whose total changed under a drag would re-fit its own layout mid-gesture.
 *
 *  IT IS PURE, AND THE STATE STAYS THE HOST'S. `PaneDivider` reports pointer deltas; this turns a
 *  delta into widths; the desk's store holds them. Same split as the walk's clock: the arithmetic
 *  is ours so it cannot drift, the state is the host's because that is where it already lives. */
export function clampDesk({ sizes = [], index = 0, delta = 0, fits = [] } = {}) {
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
export function deskBounds({ sizes = [], index = 0, fits = [] } = {}) {
  const a = index, b = index + 1
  if (!(a >= 0 && b < sizes.length)) return { min: 0, max: 0, now: 0 }
  const fa = paneFit(fits[a]), fb = paneFit(fits[b])
  return {
    now: sizes[a],
    min: Math.min(sizes[a], fa.floor),
    max: Math.max(sizes[a], sizes[a] + Math.max(0, sizes[b] - fb.floor)),
  }
}

/** THE DRAG HANDLE BETWEEN TWO PANES — a 14px hit strip drawing a 1px hairline, `ew-resize`,
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
 *  that is for the drawn widths to be derived from the measured row every render. A handle that
 *  positioned itself from a stored number would reintroduce it.
 *
 *  KEYBOARD, because a divider only draggable is a divider only some people have: it is a
 *  `role="separator"` with `tabIndex=0`, and arrows nudge by `keyStep` (Shift: `keyStepBig`),
 *  Home/End run to the bounds, Enter resets. Every key goes through the SAME `onDrag`/`onDragEnd`
 *  pair as the pointer, so a nudge cannot escape the clamp that a drag obeys.
 *
 *  `onDragEnd` RECEIVES THE GESTURE'S TOTAL TRAVEL, and that is not a convenience: both callbacks
 *  fire inside one event on a key nudge, so a host reading its own state in the end callback reads
 *  the value from BEFORE the gesture and persists it. Re-run the clamp with the delta it hands you
 *  instead — the same delta, the same clamp, the same answer, and no state to be stale.
 *
 *  `now`/`min`/`max` are for the announcement only (`aria-valuenow` and friends) — spread a
 *  `deskBounds(...)` answer straight in; its keys are those three names. (`value` is accepted as a
 *  deprecated alias for `now`, from the day the two names disagreed and the position was silently
 *  dropped.) Omit them and the separator is still operable, just silent about where it stands. */
export function PaneDivider({ orientation = 'vertical', onDrag, onDragEnd, onReset, now, value, min, max, label = 'resize the panes', disabled, style }) {
  const [hot, setHot] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const vertical = orientation !== 'horizontal'
  const start = React.useRef(0)
  /* THE GESTURE'S TOTAL TRAVEL, so `onDragEnd` can hand it back. A host that had to read its own
     state inside the end callback got the PRE-gesture value — both callbacks fire inside one
     event, so a `setState` from `onDrag` has not rendered yet, and a keyboard nudge (which fires
     both in the same handler) then persisted the widths from before the nudge and re-derived the
     boundary BACKWARDS. Found by the verifier 2026-09-16 on the card's own keyboard path; fixed
     here rather than in the card, because every host following the documented pattern had it. */
  const travel = React.useRef(0)
  const nudge = (px) => { travel.current = px; if (onDrag) onDrag(px); if (onDragEnd) onDragEnd(px) }
  const onPointerDown = (e) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    start.current = vertical ? e.clientX : e.clientY
    travel.current = 0
    /* THE LISTENERS GO ON `window`, not on the strip: a 14px target is left behind by the first
       fast flick of the pointer, and a gesture that ends when the cursor leaves the handle is a
       gesture that ends immediately. The same reason the walk dock's rail drag does it. */
    const mv = (ev) => {
      travel.current = (vertical ? ev.clientX : ev.clientY) - start.current
      if (onDrag) onDrag(travel.current)
    }
    /* A CANCELLED POINTER ENDS THE GESTURE TOO, AT ZERO TRAVEL. A touch the browser takes for a
       scroll, or a lost capture, fires `pointercancel` and never `pointerup`; listening for the
       second alone left the drag live, following the next pointer that came by. Zero travel means
       the host re-runs its clamp from where the gesture began, so the stored width stands.
       Reported by the app's port, `receipts/b7692ec.md`. */
    const end = (cancelled) => {
      setDragging(false)
      if (cancelled) { travel.current = 0; if (onDrag) onDrag(0) }
      if (onDragEnd) onDragEnd(travel.current)
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel)
    }
    const up = () => end(false)
    const cancel = () => end(true)
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel)
  }
  const onKeyDown = (e) => {
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
  return (
    <div role="separator" aria-orientation={vertical ? 'vertical' : 'horizontal'} tabIndex={disabled ? undefined : 0}
      aria-label={label} aria-disabled={disabled ? 'true' : undefined}
      aria-valuenow={Number.isFinite(now) ? Math.round(now) : Number.isFinite(value) ? Math.round(value) : undefined}
      aria-valuemin={Number.isFinite(min) ? Math.round(min) : undefined}
      aria-valuemax={Number.isFinite(max) ? Math.round(max) : undefined}
      title={disabled ? undefined : 'drag to resize \u00b7 double-click to reset'}
      onPointerDown={onPointerDown} onDoubleClick={disabled ? undefined : onReset} onKeyDown={onKeyDown}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)} onBlur={() => setHot(false)}
      style={{
        flex: 'none', position: 'relative', outline: 'none', touchAction: 'none',
        ...(vertical ? { width: D.hit, alignSelf: 'stretch' } : { height: D.hit, width: '100%' }),
        /* `ew-resize` / `ns-resize`, the system's own arrows (owner 2026-10-20): Chrome on Windows
           draws `col-resize` / `row-resize` as its own grey bitmap, which read as "half greyed out" */
        cursor: disabled ? 'default' : (vertical ? 'ew-resize' : 'ns-resize'),
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
           gutter is a THIRD line saying what the first two say, and it says it down the full
           height of the desk. The mark is now the answer to a gesture rather than furniture: it
           fades in under the pointer, on keyboard focus (`lit` covers both) and while dragging.
           The strip keeps its 14px and its resize cursor, so the boundary is still found the way
           a boundary is found. */
        background: dragging ? 'var(--accent-primary)' : lit ? 'var(--border-frame)' : 'transparent',
        transition: 'background var(--dur-hover) var(--ease-soft), width .12s var(--ease-soft), height .12s var(--ease-soft)',
      }} />
    </div>
  )
}

/** THE SAME ARITHMETIC UNDER A REACHABLE NAME — `paneFit`, `clampDesk` and `deskBounds` are
 *  lower-case exports, so `window.<Namespace>` never carried them and nothing on this side could
 *  call the very functions the contract tells a desk to call. Same function objects, no wrappers,
 *  the way `WalkMath` and `ArrowMath` exist. FOR THIS SIDE ONLY: a port imports the functions. */
export const DeskMath = { fit: paneFit, clamp: clampDesk, bounds: deskBounds, METRICS: PANE_DIVIDER_METRICS }
