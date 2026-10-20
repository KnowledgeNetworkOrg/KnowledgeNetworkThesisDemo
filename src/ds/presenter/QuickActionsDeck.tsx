import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { Grip } from '../chrome/Grip'
import { IconButton, wrapTip } from '../chrome/IconButton'
import { Pane, PaneScroller } from '../chrome/Pane'
import type { PaneFit } from '../chrome/PaneDivider'
import { LEGEND_INSET } from '../chrome/PaneHeader'

/* Typed port of the DS components/presenter/QuickActionsDeck.jsx (contract: QuickActionsDeck.d.ts)
   — part 6 of the presenter-mode split (OB-146, #267). */

/** The deck's numbers. `cap` 8 is the DECIDED shape of the deck (two columns of four); the tile
 *  heights are CHOSEN on the v18 render — the library's tiles are one step down (34) so an open
 *  popover reads as the shelf and the deck reads as the hand.
 *  TWO FLOORS AND TWO GAPS, all four CHOSEN, and the pair is the fit ladder's currency: `tileMin`
 *  (28) is the comfortable floor — a row that still reads like something you would press without
 *  looking; `tileFloor` (22) is the last one, taken only on a pane too short for 28 and worth
 *  taking because the alternative is a scrollbar over a control deck. `gapMin` (4) is the tight
 *  ROW gap; the column gap never changes, since horizontal room is not what runs out. */
export const QUICK_ACTIONS_METRICS = {
  cap: 8, tile: 42, tileMin: 28, tileFloor: 22, labelBlock: 21, dividerBlock: 18, dividerInset: 0,
  dividerInk: 'var(--bark-200)', libraryTile: 34, columns: 2, gap: 8, gapMin: 4, tileGap: 6,
  keyBox: 14, tilePadX: 9, dot: 9, tileFill: '100%',
  shelfFace: { rest: 'var(--bark-50)', hover: 'var(--bark-100)', open: 'var(--bark-100)', openHover: 'var(--bark-200)' },
  shelfOffset: 21, headClear: 6, groupGap: 14,
}

/** THE DECK'S FLOOR AND THE WIDTH IT OPENS AT. 300 is chosen for a deck that still reads as two
 *  columns of four; 360 is the width it stood at before the divider, and the width the recap's
 *  aside still keeps, so ending a lecture moves nothing sideways. */
export const QUICK_ACTIONS_FIT: PaneFit & { seed: number } = { narrowBelow: 300, floor: 300, seed: 360 }

/** ONE TILE'S WORTH OF ACTION. `id` is the identity the swap and the key binding both work in;
 *  everything else is what the tile draws. A host's own action kinds live in `dot` as a colour,
 *  deliberately open — a closed union here would compile into a rule against them. */
export interface QuickAction {
  /** stable identity — what `onSwap` names and what `on` matches against */
  id: string
  /** the tile's name, one short line. Truncates with an ellipsis rather than wrapping */
  label: string
  /** a single bare letter the deck BINDS while it is mounted, drawn as `(M)` on the tile's right.
   *  Never bound for a placeholder or a disabled action, and never while a field has focus */
  key?: string
  /** the square beside the label — names the KIND of action (class-facing, private, destructive)
   *  in the host's own colours. Omit for the default bark square */
  dot?: string
  /** the tooltip, when the label alone is not the whole story. Defaults to the label */
  title?: string
  /** a real refusal, with a reason — draws unlit and takes no pointer, no key and no hover */
  disabled?: boolean
  /** a slot nobody has decided yet — dashed, unlit, no key hint, and still hoverable so the
   *  pointer can find it and read the tooltip that says so. NOT the same as `disabled` */
  placeholder?: boolean
  /** what pressing the tile does. Also what its bound key runs */
  onSelect?: () => void
}

/** A NAMED GROUP OF TILES. The heading is the first thing the fit ladder gives up when the pane
 *  runs short — the tiles still say what they are, a heading only says where a group starts. */
export interface QuickActionGroup {
  /** the heading over the group. Omit and the group draws with no heading at all */
  label?: string
  /** the group's tiles, in order. The deck's `cap` is spent across groups top-down */
  actions: QuickAction[]
}

/** the live position of the shelf, as a delta from wherever the deck computed it should open */
export interface ShelfOffset {
  /** horizontal delta in px from the measured placement */
  x: number
  /** vertical delta in px from the measured placement */
  y: number
}

/** EIGHT TILES THAT SAY NOTHING YET — the deck's shape with its contents still open. Exported so
 *  the host and the card show the SAME eight rather than each inventing a list: whatever replaces
 *  them replaces them once, here, and the two groups' names are the part that is settled.
 *
 *  A placeholder is not a disabled action. `placeholder: true` draws the tile dashed and unlit
 *  and gives it no key hint, so the deck itself says on screen that the decision is open — a
 *  greyed-out tile would say "this action exists and you cannot have it". */
export const QUICK_ACTION_PLACEHOLDERS: QuickActionGroup[] = [
  { label: 'Class controls', actions: [1, 2, 3, 4].map((n) => ({ id: 'class-' + n, label: 'Class control ' + n, placeholder: true })) },
  { label: 'Other actions', actions: [1, 2, 3, 4].map((n) => ({ id: 'other-' + n, label: 'Other action ' + n, placeholder: true })) },
]

/** THE SWAP, AS CODE. Pure: `(groups, library, shelfId, deckId)` → `{ groups, library }` with the
 *  shelf action in the deck's slot and the displaced deck action at the END of the shelf (so a
 *  swapped-out tile is where the eye goes to find it). Either id unknown → the same two lists
 *  back, untouched. The host still OWNS the two lists and the store they live in; only the
 *  arithmetic moved. */
export function swapActions(groups: QuickActionGroup[], library: QuickAction[], shelfId: string, deckId: string): { groups: QuickActionGroup[]; library: QuickAction[] } {
  const inbound = (library || []).find((a) => a && a.id === shelfId)
  if (!inbound) return { groups, library }
  let outbound: QuickAction | null = null
  const nextGroups = groups.map((g) => ({ ...g, actions: g.actions.map((a) => { if (a.id !== deckId) return a; outbound = a; return inbound }) }))
  if (!outbound) return { groups, library }
  return { groups: nextGroups, library: library.filter((a) => a.id !== shelfId).concat([outbound]) }
}
export const QuickActionsMath = { swap: swapActions }

/** THE DOT is a plain 9px square with a 2px radius, not `DomainDot` and not `StepDot`: it names
 *  the KIND of action (class-facing, private, destructive), which is neither a domain nor a walk
 *  position. It takes any colour, deliberately. */
function ActionDot({ colour, placeholder }: { colour?: string; placeholder?: boolean }) {
  if (placeholder) return <span style={{ flexShrink: 0, width: QUICK_ACTIONS_METRICS.dot, height: QUICK_ACTIONS_METRICS.dot, borderRadius: 2, border: '1px dashed var(--border-dashed)', boxSizing: 'border-box' }} />
  return <span style={{ flexShrink: 0, width: QUICK_ACTIONS_METRICS.dot, height: QUICK_ACTIONS_METRICS.dot, borderRadius: 2, background: colour || 'var(--bark-400)' }} />
}

/** ONE TILE. `on` is a HELD state (the map is up, the slide is flagged) and wears the walk-tinted
 *  active face the system reserves for exactly that — acorn wash, `--border-walk`, acorn ink.
 *  `leaving` is the drag's answer: the tile the dropped action would displace, named while the
 *  pointer is over it, because the deck is fixed at eight and something has to go back to the
 *  shelf. */
function Tile({ action, height, on, leaving, dragging, onDrop, onDragOverTile, onDragLeaveTile }: {
  action: QuickAction; height: number; on?: boolean; leaving?: boolean; dragging?: boolean
  onDrop?: (id: string) => void; onDragOverTile?: (id: string) => void; onDragLeaveTile?: (id: string) => void
}) {
  const [hot, setHot] = useState(false)
  const ph = !!action.placeholder
  const dead = ph || action.disabled
  /* HOVER ON EVERY TILE THAT IS NOT REFUSING. Three answers, not one:
       · A LIVE tile takes the face and the strong border — the promise of a click.
       · A PLACEHOLDER takes the border alone, still DASHED and with no face change: it is a slot
         nobody has decided, and its tooltip says so, so the pointer needs to find it without
         being told it can be pressed.
       · A DISABLED action takes nothing. That is a refusal with a reason, and lighting it up
         invites the click it is going to swallow. */
  const live = hot && !dead
  /* NATIVE `disabled` IS ONLY FOR A REAL REFUSAL: Chrome and Safari dispatch no mouse events from
     a disabled control, so on a placeholder — that is, on every tile of the default deck —
     `onMouseEnter` would never fire, `hot` would stay false, and neither the hover nor the
     `title` could ever be observed. A placeholder is not refusing; it is UNDECIDED, and it stays
     a hit-test target so the pointer can find it and read its tooltip. The click is guarded
     below, and `aria-disabled` is what tells a screen reader in both cases. */
  const refusing = !ph && !!action.disabled
  /* out of the tab order but not out of the pointer's reach: eight undecided slots taking eight
     tab stops is noise, and there is nothing to activate when it arrives */
  const tab = dead ? -1 : undefined
  /* `width: 100%` IS LOAD-BEARING. A `<button>` with `width: auto` is fit-content even at
     `display: flex` — on the DECK the tile is a grid item, so it stretches and nobody notices; in
     the SHELF it sits inside the draggable span, where fit-content makes a 122px tile in a 148px
     column. It reads `tileFill` off the published metrics rather than writing `'100%'` inline. */
  const face = leaving ? 'var(--acorn-50)' : on ? 'var(--accent-walk-wash)' : ph ? 'var(--bark-50)' : live ? 'var(--bark-50)' : 'var(--surface-paper)'
  const line = leaving ? '1px dashed var(--acorn-400)' : on ? '1px solid var(--border-walk)' : ph ? '1px dashed ' + (hot ? 'var(--border-strong)' : 'var(--border-dashed)') : '1px solid ' + (live ? 'var(--border-strong)' : 'var(--border-frame)')
  return (
    <button type="button" disabled={refusing} aria-disabled={dead} aria-pressed={on ? true : undefined} tabIndex={tab}
      data-quick-action={action.id}
      title={wrapTip(ph ? 'a placeholder — this slot has not been decided yet' : action.title || action.label)}
      onClick={dead ? undefined : action.onSelect}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      onDragOver={dragging ? (e) => { e.preventDefault(); if (onDragOverTile) onDragOverTile(action.id) } : undefined}
      onDragLeave={dragging ? () => { if (onDragLeaveTile) onDragLeaveTile(action.id) } : undefined}
      onDrop={dragging ? (e) => { e.preventDefault(); if (onDrop) onDrop(action.id) } : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: QUICK_ACTIONS_METRICS.tileGap, width: QUICK_ACTIONS_METRICS.tileFill, height, padding: '0 ' + QUICK_ACTIONS_METRICS.tilePadX + 'px', boxSizing: 'border-box',
        border: line, borderRadius: 'var(--radius-md)', background: face, textAlign: 'left',
        fontFamily: 'var(--font-ui)', fontSize: height > 38 ? 'var(--fs-body)' : 'var(--fs-caption)',
        fontWeight: 'var(--fw-semibold)', whiteSpace: 'nowrap', overflow: 'hidden',
        color: leaving ? 'var(--acorn-600)' : on ? 'var(--text-walk)' : ph ? 'var(--text-2)' : 'var(--text-1)',
        cursor: dead ? 'default' : 'pointer', opacity: action.disabled && !ph ? 0.45 : 1,
        transition: 'var(--transition-wash)',
      }}>
      <ActionDot colour={on ? 'var(--accent-walk)' : action.dot} placeholder={ph} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{action.label}</span>
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: leaving ? 'var(--acorn-600)' : 'var(--text-3)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {/* THE KEY COLUMN IS PART OF THE DECK'S SHAPE, so a placeholder draws it as a DASHED BOX
           rather than leaving the column empty — the planned deck shows a key on every tile, and
           eight tiles with a blank right edge read as a different design. Same vocabulary as the
           dashed dot beside it: the slot exists, nobody has chosen what goes in it. A real
           action's key is drawn AND BOUND — see the deck's own keydown handler; a hint nothing
           listens for is a picture of a shortcut.
           THE COLUMN'S WIDTH IS THE LABEL'S BUDGET: at the 162px tile the presenter's 360 column
           gives, 162 − 18 padding − 9 dot − 12 (two gaps) leaves 123, so a real `(Q)` at ~22
           leaves the label 101 and the longest planned name, "Take a question", measures 90. */}
        {leaving ? '↑ shelf' : ph ? <span aria-hidden="true" style={{ width: QUICK_ACTIONS_METRICS.keyBox, height: 11, border: '1px dashed var(--border-dashed)', borderRadius: 2, boxSizing: 'border-box' }} /> : action.key ? '(' + action.key + ')' : ''}
      </span>
    </button>
  )
}

function Grid({ children, columns, rowGap }: { children?: ReactNode; columns: number; rowGap?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + columns + ', 1fr)', columnGap: QUICK_ACTIONS_METRICS.gap, rowGap: rowGap != null ? rowGap : QUICK_ACTIONS_METRICS.gap }}>{children}</div>
}

function GroupLabel({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', margin: '0 0 5px', ...style }}>{children}</div>
}

/** THE SHELF opens BESIDE the pane, not over it. Over it, the popover covers the deck — and the
 *  deck is every drop target the drag-to-swap gesture has. Beside it, the deck is whole and
 *  droppable.
 *
 *  `side` is measured, not assumed: left if the pane has room to its left (it is the right-hand
 *  column of the presenter, so it normally does), right if it does not — a deck at the window's
 *  left edge would otherwise open off-screen.
 *
 *  `shelfOffset` IS 21, NOT 8, and the number is derived: the anchor is the More button, which
 *  sits inside the pane body's 13px inset, so 8px of air from the anchor is 5px INSIDE the pane's
 *  own frame. 13 + 8. */
function Library({ actions, columns, onSelect, onDragStart, onDragEnd, note, onClose, side = 'left', offset, onOffsetChange }: {
  actions: QuickAction[]; columns: number; onSelect?: (a: QuickAction) => void
  onDragStart?: (id: string) => void; onDragEnd?: () => void; note?: ReactNode; onClose?: () => void
  side?: 'left' | 'right'; offset?: ShelfOffset | null; onOffsetChange?: (o: ShelfOffset) => void
}) {
  const [inside, setInside] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const grab = useRef<{ px: number; py: number; x: number; y: number; originX: number; originY: number; w: number; h: number } | null>(null)
  /* THE SHELF IS MOVABLE, AND THE SAVED POSITION IS A DELTA. Not an absolute point: the shelf is
     placed BESIDE the pane and which side that is gets measured on every open, so a saved
     coordinate would be wrong the first time the window changed width or the deck flipped sides.
     A delta from the computed placement survives both, and it clamps to the viewport on open — a
     delta saved on a wide screen cannot strand the shelf off the edge of a narrow one. `at` is
     the live drag; `offset` is what the HOST has saved, because this pane stores nothing. */
  const [at, setAt] = useState<ShelfOffset | null>(null)
  const shown = at || offset || { x: 0, y: 0 }
  /* THE ORIGIN IS MEASURED ONCE, AT POINTERDOWN. Re-measuring it during the drag drifts the
     bounds by exactly the distance dragged: `r.left - shown.x` is only the untranslated origin
     while the rect and `shown` agree, and inside a gesture they cannot — the rect already carries
     the live offset while the closure still holds the offset the drag STARTED from. The open-time
     clamp below re-measures on purpose: there nothing is mid-gesture, so the two do agree. */
  const bounds = (g: { originX: number; originY: number; w: number; h: number }, p: ShelfOffset): ShelfOffset => ({
    x: Math.max(8 - g.originX, Math.min(window.innerWidth - 8 - g.w - g.originX, p.x)),
    y: Math.max(8 - g.originY, Math.min(window.innerHeight - 8 - g.h - g.originY, p.y)),
  })
  const originOf = () => {
    const r = ref.current!.getBoundingClientRect()
    return { originX: r.left - shown.x, originY: r.top - shown.y, w: r.width, h: r.height }
  }
  /* THE CLAMP RUNS ONCE, WHEN THE SHELF APPEARS, and the empty dependency list is the whole
     point of it: a saved delta is checked against THIS viewport on open and then left alone. Re-
     running it on every render would re-measure mid-gesture, which is the drift the origin note
     above describes. It needs the shelf's own laid-out rect, so it cannot happen during render. */
  useLayoutEffect(() => {
    if (!ref.current || typeof window === 'undefined') return
    const fixed = bounds(originOf(), shown)
    if (fixed.x !== shown.x || fixed.y !== shown.y) { if (onOffsetChange) onOffsetChange(fixed); else setAt(fixed) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once, on open; see above
  }, [])
  const onGrab = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button) return
    e.preventDefault()
    const g = { px: e.clientX, py: e.clientY, x: shown.x, y: shown.y, ...originOf() }
    grab.current = g
    /* the last position is held in the closure, not read back out of state: `onOffsetChange` is
       the host's persistence and must not be called from inside a state updater, where StrictMode
       double-invokes it and a save becomes a side effect of rendering */
    let last = { x: g.x, y: g.y }
    setAt(last)
    const move = (ev: PointerEvent) => {
      if (!grab.current) return
      last = bounds(g, { x: g.x + ev.clientX - g.px, y: g.y + ev.clientY - g.py })
      setAt(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      if (!grab.current) return
      grab.current = null
      if (onOffsetChange) { onOffsetChange(last); setAt(null) } else setAt(last)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const beside: CSSProperties = side === 'left'
    ? { right: 'calc(100% + ' + QUICK_ACTIONS_METRICS.shelfOffset + 'px)', width: '100%' }
    : { left: 'calc(100% + ' + QUICK_ACTIONS_METRICS.shelfOffset + 'px)', width: '100%' }
  return (
    <div ref={ref} data-quick-shelf onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)}
      onFocus={() => setInside(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInside(false) }}
      style={{ position: 'absolute', bottom: 0, ...beside, transform: (shown.x || shown.y) ? 'translate(' + shown.x + 'px, ' + shown.y + 'px)' : undefined, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-3)', padding: '11px 13px', boxSizing: 'border-box', zIndex: 7 }}>
      {/* THE CLOSE SITS ON THE TOP-RIGHT BORDER, the way a pane's does. A pane masks its border
         with the DESK colour; a popover floats over panes it cannot name, so the mask is a 1px
         strip of the panel's OWN face over the border line only. Revealed while the pointer or
         the keyboard is inside, absent at rest, fading on `--dur-hover`. */}
      {onClose ? (
        <span style={{ position: 'absolute', top: -9, right: 10, zIndex: 3, display: 'inline-flex', opacity: inside ? 1 : 0, pointerEvents: inside ? 'auto' : 'none', transition: 'opacity var(--dur-hover) var(--ease-soft)' }}>
          <span style={{ position: 'absolute', left: -3, right: -3, top: 8, height: 1, background: 'var(--surface-paper)' }} />
          <IconButton title="Close (esc)" label="close the shelf" onClick={onClose} reveal={inside} style={{ position: 'relative', zIndex: 1 }} />
        </span>
      ) : null}
      {/* THE HEADER IS THE HANDLE, and the grip is the affordance — `PaneHeader`'s own split: the
         mark says the gesture exists, the row owns the pointer. It is the whole row rather than
         the mark alone because a 9px target is not a target. */}
      <div onPointerDown={onGrab} title={wrapTip('drag to move · the position is remembered')}
        style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <GroupLabel style={{ margin: 0 }}>More actions</GroupLabel><Grip />
      </div>
      <Grid columns={columns}>
        {actions.map((a) => (
          <span key={a.id} draggable={!!onDragStart} onDragStart={() => onDragStart && onDragStart(a.id)} onDragEnd={onDragEnd} style={{ display: 'block', cursor: onDragStart ? 'grab' : 'default' }}>
            <Tile action={{ ...a, onSelect: () => onSelect && onSelect(a) }} height={QUICK_ACTIONS_METRICS.libraryTile} />
          </span>
        ))}
      </Grid>
      {note ? <div style={{ marginTop: 9, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontStyle: 'italic', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>{note}</div> : null}
    </div>
  )
}

/** THE PARTS, PUBLISHED SO THEY CAN BE READ — the same function objects the deck renders, not a
 *  second copy and not a widened API. Read them; do not render them. The supported surface is
 *  `QuickActionsDeck`. */
export const QUICK_ACTION_PARTS = { Tile, Library }

/** The quick actions deck — part 6 of the presenter-mode split. Eight tiles in two named groups,
 *  a shelf of everything else behind one button, and drag-to-swap between the two. */
export interface QuickActionsDeckProps {
  /** the tiles on the deck, in named groups. Defaults to the eight undecided placeholders */
  groups?: QuickActionGroup[]
  /** everything that is NOT on the deck — the shelf's contents, shown behind the More button */
  library?: QuickAction[]
  /** how many tiles the deck will draw. A ninth is reported to the console and dropped: it fits,
   *  it looks right, and the deck stops being a deck */
  cap?: number
  /** how many tiles per row, on the deck and in the shelf alike */
  columns?: number
  /** the ids of actions currently in a HELD state — the map is up, the slide is flagged. They
   *  wear the walk-tinted active face */
  on?: string[]
  /** the shelf's open state, when the host keeps it. Omit and the deck keeps its own */
  libraryOpen?: boolean
  /** told when the shelf opens or closes. Required only if you pass `libraryOpen` */
  onLibraryOpenChange?: (open: boolean) => void
  /** where the host has saved the shelf, as a DELTA from wherever the deck computes it should
   *  open. Omit and the deck keeps the position for this mount only */
  shelfPosition?: ShelfOffset | null
  /** told when the shelf is dropped somewhere new — persist this and pass it back */
  onShelfPositionChange?: (o: ShelfOffset) => void
  /** a shelf action was dropped onto a deck tile: `(shelfId, deckId)`. Run `swapActions` and save
   *  both lists. Omit and the deck is not rearrangeable — no drag, and no note in the shelf */
  onSwap?: (shelfId: string, deckId: string) => void
  /** a shelf tile was CLICKED rather than dragged. Omit and a shelf tile does nothing on click */
  onLibrarySelect?: (a: QuickAction) => void
  /** the pane's name */
  title?: string
  /** what the shelf button says while the shelf is shut */
  moreLabel?: string
  /** the line under the shelf's tiles explaining the swap. Only drawn when `onSwap` is given */
  libraryNote?: ReactNode
  /** merged into the pane frame — for the caller's own size and place in its parent's flex */
  style?: CSSProperties
}

export function QuickActionsDeck({
  groups = QUICK_ACTION_PLACEHOLDERS, library = [], cap = QUICK_ACTIONS_METRICS.cap,
  columns = QUICK_ACTIONS_METRICS.columns, on = [], libraryOpen, onLibraryOpenChange,
  shelfPosition, onShelfPositionChange,
  onSwap, onLibrarySelect, title = 'quick actions', moreLabel = '+ More actions…',
  libraryNote = 'drag an action onto the deck to keep it there — the deck is fixed at eight, so whichever tile you drop onto goes back to the shelf.',
  style,
}: QuickActionsDeckProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const [moreHot, setMoreHot] = useState(false)
  const [ownPos, setOwnPos] = useState<ShelfOffset | null>(null)
  const [side, setSide] = useState<'left' | 'right'>('left')
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const open = libraryOpen != null ? libraryOpen : ownOpen
  const setOpen = (v: boolean) => { if (onLibraryOpenChange) onLibraryOpenChange(v); if (libraryOpen == null) setOwnOpen(v) }
  /* ESC CLOSES THE SHELF. The ✕ on its border says `Close (esc)`, so the key has to be real — a
     shortcut taught by a label and implemented nowhere is the fault this system removes wherever
     it finds it. Document-level, because the shelf takes no focus of its own: it is a drag target,
     and a professor opens it and reaches for the pointer.
     The closer goes through a ref so the listener is bound once per open rather than re-bound on
     every render — `setOpen` closes over props and is a new function each pass. */
  const closeRef = useRef<() => void>(() => {})
  useEffect(() => { closeRef.current = () => setOpen(false) })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  /* THE CAP IS A CODE GUARD, not a sentence in the contract: a ninth tile is a silent failure —
     it fits, it looks right, and the deck stops being a deck. It is reported and dropped. The
     whole sentence is computed during render and the effect only prints it, so the warning fires
     once per distinct overflow rather than once per render. */
  const flat: QuickAction[] = []
  groups.forEach((g) => (g.actions || []).forEach((a) => flat.push(a)))
  const capWarning = flat.length > cap
    ? 'QuickActionsDeck: ' + flat.length + ' tiles passed, ' + cap + ' is the cap — dropped: ' + flat.slice(cap).map((a) => a.label).join(', ')
    : ''
  useEffect(() => { if (capWarning) console.warn(capWarning) }, [capWarning])
  /* THE CAP IS SPENT TOP-DOWN, one group at a time, in a plain loop — not a running total
     decremented from inside a `.map` callback. The DS's version does the latter and the hooks
     compiler rejects it here: a closure that mutates a variable declared outside it is a
     reassignment it cannot prove happens during this render. Same arithmetic, no closure. */
  const shown: { label?: string; actions: QuickAction[] }[] = []
  let budget = cap
  for (const g of groups) {
    const take = Math.max(0, Math.min(budget, (g.actions || []).length))
    budget -= take
    shown.push({ label: g.label, actions: (g.actions || []).slice(0, take) })
  }
  /* WHICH SIDE THE SHELF OPENS ON is measured when it opens, not assumed: the deck is the
     presenter's right-hand column and normally has the whole board to its left, but a deck placed
     at the window's left edge would open off-screen. One read of the anchor, on open. */
  /* eslint-disable react-hooks/set-state-in-effect -- WHICH SIDE HAS ROOM IS A MEASUREMENT, and
     the thing measured is the anchor's laid-out rect, which does not exist until the browser has
     placed it. There is nothing to derive during render and no external subscription to hang it
     on: read it once when the shelf opens, keep it in state. */
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setSide(r.left - r.width - 8 >= 0 ? 'left' : 'right')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */
  /* THE DECK BINDS THE KEYS IT DRAWS. A tile's `(M)` must not be a picture of a shortcut: the
     deck listens while it is mounted and runs the action's own `onSelect`. What it will NOT do is
     bind a key for a tile that cannot act (a placeholder or a disabled action), and it stays out
     of the way while someone is typing — a professor writing a note must be able to type an M.
     Modifier chords are the host's: this matches a bare letter, which is what `key` is for.
     `preventDefault` is how the host knows not to fire the same key a second time from its own
     window-level handler. */
  const bound = flat.filter((a) => a.key && a.onSelect && !a.placeholder && !a.disabled && String(a.key).length === 1)
  const boundSignature = bound.map((a) => a.id + ':' + (a.key || '')).join(',')
  const boundRef = useRef(bound)
  useEffect(() => { boundRef.current = bound })
  useEffect(() => {
    if (!boundSignature) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return
      const hit = boundRef.current.find((a) => String(a.key).toLowerCase() === String(e.key).toLowerCase())
      if (!hit) return
      e.preventDefault()
      hit.onSelect!()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [boundSignature])
  const onFlag = (id: string) => on.indexOf(id) >= 0
  /* THE EIGHT ARE VISIBLE WITHOUT SCROLLING AT WHATEVER HEIGHT THE HOST GIVES. The presenter's
     panes row is short — measured at 214px, which leaves 146px of content space for 240px of
     tiles. At 42px there is no spacing trick that fits eight; the tiles themselves have to give.
     So the deck measures what it is given and picks a tile height between `tile` (42) and
     `tileMin` (28, the smallest that still reads as a pressable row — the tile drops to caption
     type under 38 on its own). Below the floor the scroller takes over. This is the one
     measurement the component cannot avoid owning: only it knows how many rows, labels and gaps
     its own groups make, and the host cannot compute a tile height it does not lay out. */
  const fitRef = useRef<HTMLDivElement | null>(null)
  const [avail, setAvail] = useState(0)
  /* THE ResizeObserver IS THE EXTERNAL SYSTEM this effect subscribes to, and its callback setting
     state is exactly the shape an effect is for. The one synchronous call is the FIRST reading: an
     observer does not fire until the box next changes, so without it the deck would draw one frame
     at its unmeasured default. */
  useEffect(() => {
    const el = fitRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setAvail(el.clientHeight))
    ro.observe(el)
    setAvail(el.clientHeight)
    return () => ro.disconnect()
  }, [])
  const M2 = QUICK_ACTIONS_METRICS
  const rowsPer = shown.map((g) => Math.ceil((g.actions.length || 0) / Math.max(1, columns)))
  const rows = rowsPer.reduce((n, r) => n + r, 0)
  const fixedPart = (labels: boolean, rule: boolean, gap: number) => (labels ? shown.filter((g) => g.label).length * M2.labelBlock : 0)
    + Math.max(0, shown.length - 1) * (rule ? M2.dividerBlock : M2.groupGap)
    + rowsPer.reduce((n, r) => n + Math.max(0, r - 1), 0) * gap
  const fitFor = (labels: boolean, rule: boolean, gap: number) => Math.floor((avail - fixedPart(labels, rule, gap)) / rows)
  /* IT DEGRADES IN A STATED ORDER, and the order is the whole design of this thing — each rung
     gives up the cheapest remaining thing, and the LAST rung is the scrollbar, because a control
     deck you have to scroll to reach is not a deck. Read the table as "the first row that fits
     wins":
       1. tile height, 42 down to `tileMin` 28, headings and rule intact;
       2. the ROW GAP, 8 down to `gapMin` 4 — the cheapest 12px on the pane, and it is bought
          before any WORDS are given up; the column gap never moves;
       3. the group LABELS — the tiles still say what they are, a heading only says where a group
          starts;
       4. the tiles again, `tileMin` 28 down to `tileFloor` 22, the smallest row this system will
          draw as pressable;
       5. the RULE, replaced by `groupGap`, which is the last thing that still separates them;
       6. the scroller. The net, not the norm.
     THE RULE OUTLIVES THE LABELS ON PURPOSE — a label costs 21 a group, the rule 18 for the pair,
     so the cheaper mark is also the one that survives longer. And the ladder ONLY CLIMBS DOWN
     WHILE THERE IS SOMETHING TO BUY: once no rung fits, the scroller is arriving whatever the
     deck does, so the headings, the rule and the resting gap all come back and the height is
     spent on legibility instead. */
  const PLANS = [
    { labels: true, rule: true, gap: M2.gap, floor: M2.tileMin },
    { labels: true, rule: true, gap: M2.gapMin, floor: M2.tileMin },
    { labels: false, rule: true, gap: M2.gap, floor: M2.tileMin },
    { labels: false, rule: true, gap: M2.gapMin, floor: M2.tileMin },
    { labels: false, rule: true, gap: M2.gapMin, floor: M2.tileFloor },
    { labels: false, rule: false, gap: M2.gapMin, floor: M2.tileFloor },
  ]
  const measured = !(!avail || !rows)
  const plan = measured ? PLANS.find((p) => fitFor(p.labels, p.rule, p.gap) >= p.floor) : null
  const fit = plan || { labels: true, rule: true, gap: M2.gap, floor: M2.tileFloor }
  const withLabels = measured ? fit.labels : true
  const withRule = measured ? fit.rule : true
  const rowGap = measured ? fit.gap : M2.gap
  const tileH = !measured ? M2.tile
    : Math.max(fit.floor, Math.min(M2.tile, fitFor(fit.labels, fit.rule, fit.gap)))
  return (
    <Pane title={title} scroll="none" bodyStyle={{ padding: QUICK_ACTIONS_METRICS.headClear + 'px 13px 12px ' + LEGEND_INSET + 'px', position: 'relative',
      /* NOTHING HERE IS TEXT TO TAKE AWAY. Every word on this pane is a control's own label or a
         heading over one, and a drag across the tiles would otherwise select them — which is not
         a copy anybody wanted and it fights the drag-to-swap gesture the deck is built on. The
         notes composer next door is the opposite case, and gets the opposite rule. */
      userSelect: 'none', WebkitUserSelect: 'none' }} style={{ flex: 1, minHeight: 0, ...style }}>
      {/* THE TILES SCROLL, THE SHELF BUTTON DOES NOT. The deck needs ~294px and the presenter
         gives it whatever the roll and the strip leave, which on a laptop is less — and
         `scroll="none"` on a body with no scroller CROPS in silence: no scrollbar, no warning,
         two tiles and the one control that always works simply absent. A pane that is short is
         normal; losing the shelf is not. So the groups get their own scroller and the button
         stays pinned under it, which is the same shape `LectureNotes` uses for its composer.
         ITS OWN 12px VERTICAL MARGINS GO: `PaneScroller` insets itself for the case it was
         written for — a scroller under a column head, where the gap is the head's. Here the pane
         body's own padding already does that, and the 24px is exactly what the eighth tile needs. */}
      <PaneScroller forwardRef={fitRef} data-quick-deck style={{ paddingRight: 6, margin: '0 -6px 0 0' }}>
        {shown.map((g, i) => (
          <Fragment key={g.label || i}>
            {/* THE DIVIDER IS INSET TO NOTHING. `dividerInk` is `--bark-200` — a solid tint rather
               than a new alpha token, and lighter on paper than the `--border-hair` it replaces —
               and `dividerInset` is 0, so the rule runs the FULL width of the tile grid and ends
               exactly where the buttons do. Ink carries the softening; length carries the
               belonging. The LINE stays 1px (the thinnest a border renders identically across
               displays); what came off is the BAND — 13/11 margins became 9/8, `dividerBlock`
               25 → 18, which is also what lets the rule outlive the labels at 214px.
               It is not label furniture: it drops AFTER them, and only when even 28px tiles will
               not fit around it. */}
            {i ? (withRule
              ? <div style={{ height: 1, background: M2.dividerInk, margin: '9px ' + M2.dividerInset + 'px 8px' }} />
              : <div style={{ height: M2.groupGap }} />) : null}
            {g.label && withLabels ? <GroupLabel>{g.label}</GroupLabel> : null}
            <Grid columns={columns} rowGap={rowGap}>
              {g.actions.map((a) => (
                <Tile key={a.id} action={a} height={tileH} on={onFlag(a.id)}
                  dragging={!!dragId} leaving={!!dragId && overId === a.id}
                  onDragOverTile={setOverId} onDragLeaveTile={(id) => setOverId((cur) => (cur === id ? null : cur))}
                  onDrop={(id) => { if (onSwap && dragId) onSwap(dragId, id); setDragId(null); setOverId(null) }} />
              ))}
            </Grid>
          </Fragment>
        ))}
      </PaneScroller>
      <div ref={anchorRef} style={{ flexShrink: 0, marginTop: 'auto', paddingTop: 8, position: 'relative' }}>
        {open ? (
          <Library actions={library} columns={columns} note={onSwap ? libraryNote : null} side={side}
            offset={shelfPosition != null ? shelfPosition : ownPos}
            onOffsetChange={onShelfPositionChange || setOwnPos}
            onSelect={onLibrarySelect} onClose={() => setOpen(false)}
            onDragStart={onSwap ? setDragId : undefined} onDragEnd={() => { setDragId(null); setOverId(null) }} />
        ) : null}
        {/* DASHED, because the shelf is where the deck is still open to change — the same thing
           dashed means everywhere else in this system. It stays put when the shelf is open so the
           popover has a fixed anchor. IT WEARS A WASH AT REST: transparent reads as a caption
           rather than the one control on the pane that always works. Three steps, so hover is
           still an answer and not a repeat of the resting face: `--bark-50` at rest, `--bark-100`
           hovered, `--bark-100` open — and `--bark-200` HOVERED WHILE OPEN, because otherwise
           "Close the shelf" answers a pointer with nothing. The dash goes `--border-strong` and
           the ink `--text-1` for every lit state. */}
        <button type="button" data-quick-shelf-toggle onClick={() => setOpen(!open)}
          onMouseEnter={() => setMoreHot(true)} onMouseLeave={() => setMoreHot(false)} style={{
            width: '100%', height: 30, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '1px dashed ' + (open || moreHot ? 'var(--border-strong)' : 'var(--border-dashed)'), borderRadius: 'var(--radius-md)',
            background: moreHot
              ? (open ? QUICK_ACTIONS_METRICS.shelfFace.openHover : QUICK_ACTIONS_METRICS.shelfFace.hover)
              : (open ? QUICK_ACTIONS_METRICS.shelfFace.open : QUICK_ACTIONS_METRICS.shelfFace.rest),
            color: open || moreHot ? 'var(--text-1)' : 'var(--text-2)', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)',
            transition: 'var(--transition-wash)',
          }}>{open ? 'Close the shelf' : moreLabel}</button>
      </div>
    </Pane>
  )
}
