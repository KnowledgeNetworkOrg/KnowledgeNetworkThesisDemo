import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { CollapseChevron } from '../chrome/CollapseChevron'
import { wrapTip } from '../chrome/IconButton'
import { FIRST_ROW_PAD } from '../chrome/Pane'
import { PaneDivider, PANE_DIVIDER_METRICS } from '../chrome/PaneDivider'

/** THE NUMBERS A RAIL IS MADE OF, and every one of them is CHOSEN. `min` is the narrowest the
 *  column may draw and still be read; `max` is the widest it is worth; `keep` is what the pane's
 *  own content must be left with, and `min + keep` is therefore the pane width below which the
 *  rail does not draw at all. The two sides differ because their contents do: a containment tree
 *  of pills is legible at 140, a figure with two rings and a chart under it is not.
 *
 *  THE FLOOR IS A SUM, NOT A TASTE. A pane's declared minimum should equal `floor(side)` for the
 *  rail it carries — kept equal deliberately, so a pane honoured at its minimum still shows its
 *  rail rather than hiding it the moment it is granted.
 *
 *  THE LEFT RAIL OPENS ITS PANE, so its head sits on the pane's shared first line (`top` =
 *  `FIRST_ROW_PAD`, 14; it was 6, which put the Explorer 8px above the panes beside it) and it
 *  must be mounted in a body with no top margin. The right rail sits under a header row of its
 *  own and keeps 6. `pad`'s first value IS `top` — read `top`, never parse `pad`. (DS OB-249;
 *  the rest of that item, and `FIRST_LINE`/`FIRST_SCROLL_PAD` beside it, are #358's.) */
export interface RailMetrics {
  /** the narrowest the column may draw and still be read */
  min: number
  /** the widest the column is worth — what it FITS ITSELF to untouched */
  max: number
  /** THE WIDEST A DRAG MAY TAKE THE COLUMN (left 360, right 420) — CHOSEN, not derived: `max`
   *  stays what the column fits itself to untouched, and a professor who wants a wider tree may
   *  have it, up to here, and never past `paneW - keep` */
  stretch: number
  /** what the pane's own content must be left with */
  keep: number
  /** THE HEAD'S TOP PADDING AS A NUMBER, and the closed corner is placed at it so open and closed
   *  start at the same height. LEFT: `Pane`'s `FIRST_ROW_PAD` (14). RIGHT: 6, that rail sitting
   *  under a header row of its own */
  top: number
  /** the rail body's padding. Its first value IS `top` */
  pad: string
}

export const PANE_RAIL_METRICS: Record<'left' | 'right', RailMetrics> = {
  left: { min: 140, max: 196, stretch: 360, keep: 190, top: FIRST_ROW_PAD, pad: FIRST_ROW_PAD + 'px 6px 10px' },
  right: { min: 186, max: 250, stretch: 420, keep: 210, top: 6, pad: '6px 8px 12px' },
}

/** the column's width at this pane width — it SHRINKS to its floor before it goes. `want` is a
 *  width the professor dragged to (the host's stored number, px, or null for none): it replaces
 *  `max` as the target and may reach `stretch`, and it is still clamped by the pane every call —
 *  a width chosen in a wide pane never pushes the pane's own content under `keep`. */
export function railWidth(side: 'left' | 'right', paneW?: number, want?: number | null): number {
  const r = PANE_RAIL_METRICS[side] || PANE_RAIL_METRICS.left
  const chosen = typeof want === 'number' && Number.isFinite(want)
  const target = chosen ? Math.min(r.stretch, want) : r.max
  if (!paneW) return Math.max(r.min, target)
  return Math.max(r.min, Math.min(target, paneW - r.keep))
}

/** the pane width below which the rail must not be drawn — `min + keep` */
export function railFloor(side: 'left' | 'right'): number {
  const r = PANE_RAIL_METRICS[side] || PANE_RAIL_METRICS.left
  return r.min + r.keep
}

/** UNMEASURED COUNTS AS ROOM (`paneW === 0`): a rail that hides itself on the first frame, before
 *  any box has been measured, flickers shut and open on every mount. */
export function railFits(side: 'left' | 'right', paneW?: number): boolean {
  return !paneW || paneW >= railFloor(side)
}

/** HOW WIDE THE PANE ACTUALLY IS — measured, because a rail's fate cannot be decided from the
 *  instrument's declared `min`: a desk hands a pane whatever the window leaves after the other
 *  panes take theirs.
 *
 *  IT RETURNS A CALLBACK REF, NOT A `useRef`, and that is the whole of a bug that froze both
 *  rails shut. With `useRef` + `useEffect(…, [ref])` the effect runs once, on whatever node
 *  existed at mount, and a ref object never changes so it never runs again — while a pane that
 *  swaps the node at that JSX position (a hover layer mounting on the second render, say) leaves
 *  the observer bound to the detached original. `paneW` then freezes at a NONZERO reading, which
 *  is worse than zero because every caller believes it.
 *
 *  AND A READ ON EVERY RENDER, because a ResizeObserver notification can arrive arbitrarily
 *  late and the rail's whole behaviour hangs off this number. Measured in a live shell
 *  2026-09-20: closing the palette grew the document pane 333 to 443, the observer's
 *  notification for 443 was still undelivered 700ms later, and the rail sat refusing to open
 *  in a pane that had room — recovering only on reload. Delivery is tied to the frame loop,
 *  and an idle page produces no frames; a host re-render is exactly the moment a pane is most
 *  likely to have changed size, and it costs one `getBoundingClientRect` to be sure.
 *  The two mechanisms cover each other: the effect catches every resize the host re-renders
 *  for, the observer catches the ones it does not (a window drag, a sibling pane's own
 *  animation). Neither is redundant and neither loops — the state only moves when the number
 *  does.
 *
 *  Typed port of the DS components/connections/RailFrame.jsx, #340 / OB-238 + OB-239 + OB-241. */
export function usePaneWidth(): [number, (node: HTMLElement | null) => void] {
  const [w, setW] = useState(0)
  const node = useRef<HTMLElement | null>(null)
  const obs = useRef<ResizeObserver | null>(null)
  const ref = useCallback((n: HTMLElement | null) => {
    if (obs.current) { obs.current.disconnect(); obs.current = null }
    node.current = n
    if (!n || typeof ResizeObserver === 'undefined') return
    setW(Math.round(n.getBoundingClientRect().width))
    const o = new ResizeObserver((entries) => {
      const cw = entries[entries.length - 1].contentRect.width
      if (cw > 0) setW(Math.round(cw))
    })
    o.observe(n)
    obs.current = o
  }, [])
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- NO dependency list is the point,
     not an omission: this read runs on EVERY render because that is the half the observer
     cannot cover (see above). The state only moves when the number does, so it cannot loop. */
  useLayoutEffect(() => {
    const n = node.current
    if (!n) return
    const now = Math.round(n.getBoundingClientRect().width)
    if (now > 0) setW((prev) => (prev === now ? prev : now))
  })
  return [w, ref]
}

/** THE WAY BACK, AS AN ELEMENT — so a pane with a header row of its own can put the button IN
 *  that row, and a pane without one can let `RailFrame` drop it in the corner. One drawing
 *  either way; a host that redraws it owns a second button that drifts.
 *
 *  ITS HOVER IS TRACKED IN STATE AND NOT LEFT TO `data-kn-hover` (owner-reported 2026-09-20:
 *  the Explorer and Relations buttons did not wash). The utility sets `background` and
 *  `border-color` from the stylesheet, and an INLINE style beats any selector — so a control
 *  that names its own resting face inline silently opts out of the hook it is tagged with, and
 *  the attribute then reads as a claim the control does not honour. `MapFloatingButton` had
 *  already paid for this once. The border is reserved at rest, so hovering repaints it rather
 *  than adding one and the glyph never twitches. */
export interface RailOpenButtonProps {
  /** the rail's name, shown in the button and its tooltip */
  label: string
  /** shown after the label, after a middot. Omit where the pane already states the number */
  count?: number | null
  /** the rail's mark, drawn before the word (`OutlineMark`, `RelationsMark`) */
  mark?: ReactNode
  /** the press. The host owns what opening MEANS — this only reports the click */
  onOpen?: () => void
  /** placement in the host's own row — this component takes no position of its own */
  style?: CSSProperties
}

export function RailOpenButton({ label, count, mark, onOpen, style }: RailOpenButtonProps) {
  const [hot, setHot] = useState(false)
  const text = label + (count === undefined || count === null ? '' : ' · ' + count)
  return (
    <button
      type="button" onClick={() => onOpen && onOpen()} title={wrapTip('Show ' + label)}
      onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setHot(true) }} onBlur={() => setHot(false)}
      style={{
        font: 'inherit', fontSize: 'var(--fs-micro)', display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 7px', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box',
        border: '1px solid ' + (hot ? 'var(--border-rule)' : 'var(--border-strong)'),
        background: hot ? 'var(--surface-hover)' : 'var(--surface-paper)',
        color: hot ? 'var(--text-1)' : 'var(--text-2)',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'var(--transition-wash)',
        ...style,
      }}
    >{mark}{text}</button>
  )
}

/** WHAT A CLOSED RAIL LEAVES BEHIND — the button, or the refusal when the pane has no room for
 *  the column at all. Published because the two cases are one decision and a host placing the
 *  control itself (`RailFrame`'s `closedControl="host"`) must not have to re-derive which of
 *  them applies: `railFits` is the same call the frame makes. Draws NOTHING while the rail is
 *  open. */
export interface RailCornerProps {
  /** which edge of the pane the rail sits on — decides which floor applies */
  side?: 'left' | 'right'
  /** the rail's name, shown on the button and in its tooltip */
  label: string
  /** shown after the label on the button only */
  count?: number | null
  /** the rail's mark, drawn on the button */
  mark?: ReactNode
  /** the PANE's measured width — the same number the rail is given, or the two disagree about
   *  whether there is room */
  paneW?: number
  /** the rail's open state. Draws nothing while open with room to draw */
  open: boolean
  /** the intent to open */
  onOpenChange?: (open: boolean) => void
  /** placement in the host's own row — this component takes no position of its own */
  style?: CSSProperties
}

export function RailCorner({ side = 'left', label, count, mark, paneW, open, onOpenChange, style }: RailCornerProps) {
  const room = railFits(side, paneW)
  if (open && room) return null
  if (!room) return (
    <span style={{
      fontSize: 'var(--fs-micro)', color: 'var(--text-3)', background: 'var(--surface-paper)',
      border: '1px dashed var(--border-hair)', borderRadius: 'var(--radius-sm)', padding: '3px 7px',
      whiteSpace: 'nowrap', pointerEvents: 'none', ...style,
    }}>{label + ' — widen this pane'}</span>
  )
  return <RailOpenButton label={label} count={count} mark={mark} onOpen={() => onOpenChange && onOpenChange(true)} style={style} />
}

/** the capitalised way in, for a card or a raw page reading off `window.<Namespace>` (which
 *  carries no lower-case export). Same function objects. */
export const RailMath = { width: railWidth, floor: railFloor, fits: railFits, metrics: PANE_RAIL_METRICS, usePaneWidth }

/** THE CHROME EVERY PANE RAIL WEARS — the column, its header, the handle that closes it, and the
 *  corner button that brings it back. `ExplorerRail` and `RelationsRail` are both this frame with
 *  contents; nothing else about them is shared, and nothing about the chrome is written twice.
 *
 *  THREE STATES, AND THE THIRD IS THE ONE HOSTS GET WRONG:
 *  1. OPEN — the column, at `railWidth(side, paneW, width)`.
 *  2. CLOSED — a button in the pane's own corner, carrying the rail's MARK and its word. Not a
 *     32px shelf: a permanent column of pane width holding one sideways word is what the corner
 *     button replaced. It sits at the same HEIGHT as the open head (`top`), so closing a rail
 *     does not move the pane's first line. It does NOT sit at the same x as the open handle:
 *     open, the handle is at the SEAM end of the rail's head (beside the content, pointing the
 *     way the rail will go); closed, the button is in the pane's OUTER corner. Both live in the
 *     pane's top row; they are one rail width apart.
 *  3. NO ROOM — the same corner, as a NOTE: no cursor, no handler, and it says what would make
 *     the rail available. A control that refuses is worse than no control, and a rail squeezed
 *     past its own minimum is worse still: a flex item cannot shrink below its minimum, so the
 *     pane CLIPS it, and a clipped rail is worse than an absent one because the reader cannot
 *     tell.
 *
 *  WHAT THE PANE AROUND IT MUST DO:
 *  1. BE `position: relative`. States 2 and 3 are absolutely positioned in the pane's corner.
 *  2. MEASURE ITSELF and pass `paneW` — `RailMath.usePaneWidth()` is published for exactly this
 *     and carries the callback-ref rule above. Pass 0 while unmeasured; do not guess.
 *  3. DECLARE ITS OWN MINIMUM AS `RailMath.floor(side)`. A pane that asks for less than its rail's
 *     floor is a pane whose rail is usually absent.
 *  4. OWN `open`. The rail is the user's to close; the frame only reports the intent.
 *  5. IF THE SEAM SHOULD DRAG, OWN THE WIDTH: pass `width` (stored) and `onWidthChange` (store
 *     what it reports, on release only). The frame draws the `PaneDivider` itself, over its own
 *     border — the host must not draw a second handle or a resting rule in the gutter.
 *
 *  Typed port of the DS components/connections/RailFrame.jsx, #340 / OB-238 + OB-239 + OB-241
 *  (OB-250's `top` and the corrected comments, and OB-253's seam, with #341). */
export interface RailFrameProps {
  /** which edge of the pane the rail sits on. Decides the border, the corner, the chevron's
   *  direction and which set of widths applies */
  side?: 'left' | 'right'
  /** the rail's name — the header eyebrow and the closed button's word */
  label: string
  /** shown on the CLOSED button only, after the label. For a tally that appears nowhere else on
   *  the pane's frame; omit it where the pane already states the number */
  count?: number | null
  /** the rail's mark, drawn on the closed button (`OutlineMark`, `RelationsMark`). The word stays
   *  beside it: the glyph is a second read, not a rebus */
  mark?: ReactNode
  /** the rail's open state. The host owns it; the frame only reports intent */
  open: boolean
  /** the intent to open or close. The frame keeps nothing */
  onOpenChange?: (open: boolean) => void
  /** the PANE's measured width, not the rail's. 0 means not measured yet and counts as room */
  paneW?: number
  /** WHO DRAWS THE WAY BACK WHEN THE RAIL IS CLOSED. `'corner'` (default) floats the frame's
   *  own button in the pane's corner, which is right for a pane whose content starts at its top
   *  edge. `'host'` draws NOTHING when closed — the pane mounts `RailCorner` (or the rail's own
   *  `ExplorerRailCorner` / `RelationsRailCorner`) as an item in its header row instead.
   *
   *  A PANE WITH A HEADER ROW MUST USE `'host'`. The floating corner is absolutely positioned at
   *  the pane's top corner, which is exactly where a header row's first (or last) item already
   *  is, so the two land on top of each other. In a pane that has a row, the row is where the way
   *  back lives */
  closedControl?: 'corner' | 'host'
  /** THE WIDTH THE PROFESSOR DRAGGED THE SEAM TO, px, or null/omitted for the frame's own fit.
   *  The HOST stores it. It is a target, not a width to draw: the frame still clamps it to
   *  `[min, min(stretch, paneW - keep)]` every render, so a width chosen in a wide pane cannot
   *  starve a narrow one. NEVER write the clamped value back — store only what `onWidthChange`
   *  reports */
  width?: number | null
  /** PASS THIS AND THE SEAM DRAGS: a `PaneDivider` straddles the rail's border, drawing nothing
   *  at rest. Called ONCE per gesture, on release (and after each key nudge), with the width to
   *  store; with `null` on the reset gesture (double-click, Enter), meaning "back to the fit".
   *  Omit it and the seam is not a handle — the rail fits itself, as before */
  onWidthChange?: (width: number | null) => void
  /** content, or a function of the column's DRAWN width — for content that must track the seam
   *  while it is being dragged (the relations figure does), which the host's stored width
   *  cannot, since it only changes on release */
  children?: ReactNode | ((railW: number) => ReactNode)
}

export function RailFrame({ side = 'left', label, count, mark, open, onOpenChange, paneW, closedControl = 'corner', width, onWidthChange, children }: RailFrameProps) {
  const m = PANE_RAIL_METRICS[side] || PANE_RAIL_METRICS.left
  const room = railFits(side, paneW)
  const edge = side === 'left' ? 'left' : 'right'
  /* THE SEAM DRAGS when the host passes `onWidthChange` (owner, 2026-09-23). The host OWNS the
     width and is told once, on release; `live` is only the gesture in flight, so the frame never
     keeps a second copy of the professor's choice. `start` is the width AS IT WAS when the gesture
     began: the delta is measured from there, never added to the live width. */
  const [live, setLive] = useState<number | null>(null)
  const start = useRef<number | null>(null)
  if (!open || !room) {
    /* `closedControl="host"` — the pane draws `RailCorner` itself, in its own header row. A
       pane WITH a header row cannot use the floating corner: the button would land on top of
       the first thing in that row (which is where the idea sheet puts it deliberately, in
       flow, as the row's first child). Default stays the floating corner, which is right for
       a pane whose content starts at its top edge. */
    if (closedControl === 'host') return null
    return (
      <RailCorner
        side={side} label={label} count={count} mark={mark} paneW={paneW} open={false} onOpenChange={onOpenChange}
        style={{ position: 'absolute', top: m.top, [edge]: 6, zIndex: 3 }}
      />
    )
  }
  const eyebrow = (
    <span style={{
      fontSize: 'var(--fs-micro)', letterSpacing: '.06em', textTransform: 'uppercase',
      fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', flex: 1, minWidth: 0,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
  const handle = <CollapseChevron collapsed={false} side={side} onClick={() => onOpenChange && onOpenChange(false)} title={'Hide ' + label} />
  const shown = live != null ? live : railWidth(side, paneW, width)
  const hi = Math.max(m.min, Math.min(m.stretch, paneW ? paneW - m.keep : m.stretch))
  /* a positive delta grows the thing BEFORE the handle: the left rail, or the right rail's pane */
  const fit = (w0: number, d: number) => Math.max(m.min, Math.min(hi, w0 + (side === 'left' ? d : -d)))
  const changeWidth = onWidthChange
  /* A GESTURE THAT MOVED NOTHING STORES NOTHING. Travel 0 is a plain click on the seam, or a
     pointer the browser cancelled (`PaneDivider` reports that as 0). Storing `fit(w0, 0)` then
     would turn the rail's own fit — null, which follows the pane — into a pinned number that
     looks identical at this width, so the rail never grew back when the pane widened again
     (reviewer-measured on #372, 2026-09-24: 185px at a 1100px window, still 185 at 1750). */
  const divider = changeWidth ? (
    <PaneDivider label={'resize the ' + String(label).toLowerCase() + ' rail'} now={shown} min={m.min} max={hi}
      onDrag={(d) => { if (start.current == null) start.current = shown; setLive(fit(start.current ?? shown, d)) }}
      onDragEnd={(d) => { const w0 = start.current != null ? start.current : shown; start.current = null; setLive(null); if (d !== 0) changeWidth(fit(w0, d)) }}
      onReset={() => { start.current = null; setLive(null); changeWidth(null) }}
      /* ON THE SEAM, OVER IT: the strip straddles the rail's own border, half over the pane's
         content, and takes no width from either — a strip in the flow would move both by 14px
         the moment a host passed the callback. */
      style={{ position: 'absolute', top: 0, bottom: 0, [side === 'left' ? 'right' : 'left']: -PANE_DIVIDER_METRICS.hit / 2, zIndex: 4 }} />
  ) : null
  return (
    <div style={{
      flex: '0 0 ' + shown + 'px', minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column',
      [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid var(--border-hair)',
    }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: m.pad }}>
        {/* THE HANDLE SITS AT THE SEAM END OF THE HEAD — beside the content, pointing the way the
            rail will go. The eyebrow's `flex: 1` is what puts it there, on both sides. This is
            the approved drawing (`ideas/connections-dissolved-into-map-and-document.html`), not
            an accident. The way back is findable because it stays in the pane's TOP ROW at the
            same height, not because it keeps the same x. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 4px 2px' }}>
          {side === 'left' ? eyebrow : handle}
          {side === 'left' ? handle : eyebrow}
        </div>
        {typeof children === 'function' ? children(shown) : children}
      </div>
      {divider}
    </div>
  )
}
