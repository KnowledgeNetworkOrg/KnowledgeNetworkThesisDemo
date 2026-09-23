import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { CollapseChevron } from '../chrome/CollapseChevron'
import { wrapTip } from '../chrome/IconButton'
import { FIRST_ROW_PAD } from '../chrome/Pane'

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
 *  `left.pad`'s top is `FIRST_ROW_PAD` (14, was 6): the left rail opens its pane, so its head
 *  sits on the pane's shared first line and reads level with the panes beside it. The right rail
 *  sits under a header row of its own and keeps 6 (DS OB-249 — the rest of that item, and
 *  `FIRST_LINE`/`FIRST_SCROLL_PAD` beside it, are #358's). */
export interface RailMetrics {
  /** the narrowest the column may draw and still be read */
  min: number
  /** the widest the column is worth */
  max: number
  /** what the pane's own content must be left with */
  keep: number
  /** the rail body's padding */
  pad: string
}

export const PANE_RAIL_METRICS: Record<'left' | 'right', RailMetrics> = {
  left: { min: 140, max: 196, keep: 190, pad: FIRST_ROW_PAD + 'px 6px 10px' },
  right: { min: 186, max: 250, keep: 210, pad: '6px 8px 12px' },
}

/** the column's width at this pane width — it SHRINKS to its floor before it goes */
export function railWidth(side: 'left' | 'right', paneW?: number): number {
  const r = PANE_RAIL_METRICS[side] || PANE_RAIL_METRICS.left
  if (!paneW) return r.max
  return Math.max(r.min, Math.min(r.max, paneW - r.keep))
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
 *  1. OPEN — the column, at `railWidth(side, paneW)`.
 *  2. CLOSED — a button in the pane's own corner, carrying the rail's MARK and its word. Not a
 *     32px shelf: a permanent column of pane width holding one sideways word is what the corner
 *     button replaced. The control never moves between states; only the column does.
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
 *
 *  Typed port of the DS components/connections/RailFrame.jsx, #340 / OB-238 + OB-239 + OB-241. */
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
   *  is, so the two land on top of each other. It is the same corner in both cases — the point
   *  of the rule is that the control never moves — and in a pane that has a row, the row is
   *  where that corner lives */
  closedControl?: 'corner' | 'host'
  /** the rail's contents — the tree, the figure, the filter. The chrome is the frame's */
  children?: ReactNode
}

export function RailFrame({ side = 'left', label, count, mark, open, onOpenChange, paneW, closedControl = 'corner', children }: RailFrameProps) {
  const m = PANE_RAIL_METRICS[side] || PANE_RAIL_METRICS.left
  const room = railFits(side, paneW)
  const edge = side === 'left' ? 'left' : 'right'
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
        style={{ position: 'absolute', top: 6, [edge]: 6, zIndex: 3 }}
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
  return (
    <div style={{
      flex: '0 0 ' + railWidth(side, paneW) + 'px', minWidth: 0,
      [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid var(--border-hair)',
      overflowY: 'auto', overflowX: 'hidden', padding: m.pad,
    }}>
      {/* THE HANDLE SITS IN THE PANE'S OWN CORNER — the same corner the closed button occupies,
          which is what makes the way back findable: open, it is the rail header's outer end;
          closed, it is the first thing in that corner of the pane. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 4px 2px' }}>
        {side === 'left' ? eyebrow : handle}
        {side === 'left' ? handle : eyebrow}
      </div>
      {children}
    </div>
  )
}
