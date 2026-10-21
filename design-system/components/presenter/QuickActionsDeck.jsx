import React from 'react'
import { Pane, PaneScroller } from '../chrome/Pane.jsx'
import { LEGEND_INSET } from '../chrome/PaneHeader.jsx'
import { IconButton, wrapTip } from '../chrome/IconButton.jsx'
import { Grip } from '../chrome/Grip.jsx'

/** The deck's numbers. `cap` 8 is the DECIDED shape of the deck (two columns of four); the tile
 *  heights are CHOSEN on the v18 render — the library's tiles are one step down (34) so an open
 *  popover reads as the shelf and the deck reads as the hand.
 *  TWO FLOORS AND TWO GAPS, all four CHOSEN, and the pair is the fit ladder's currency: `tileMin`
 *  (28) is the comfortable floor — a row that still reads like something you would press without
 *  looking; `tileFloor` (22) is the last one, taken only on a pane too short for 28 and worth
 *  taking because the alternative is a scrollbar over a control deck (owner, 2026-09-05: "i want
 *  the quick actions pane to not have a scrollbar, could we make the buttons scale smaller?").
 *  `gapMin` (4) is the tight ROW gap; the column gap never changes, since horizontal room is not
 *  what runs out. Four px of air between rows still separates them, and buying height there is
 *  cheaper than buying it from the tiles or from the group headings. */
export const QUICK_ACTIONS_METRICS = { cap: 8, tile: 42, tileMin: 28, tileFloor: 22, labelBlock: 21, dividerBlock: 18, dividerInset: 0, dividerInk: 'var(--bark-200)', libraryTile: 34, columns: 2, gap: 8, gapMin: 4, tileGap: 6, keyBox: 14, tilePadX: 9, dot: 9, tileFill: '100%', shelfFace: { rest: 'var(--bark-50)', hover: 'var(--bark-100)', open: 'var(--bark-100)', openHover: 'var(--bark-200)' }, shelfOffset: 21, headClear: 6, groupGap: 14 }

/** EIGHT TILES THAT SAY NOTHING YET — the deck's shape with its contents still open (owner,
 *  2026-09-03: "place placeholder buttons for now, as we're not sure yet what buttons we should
 *  have on there"). Exported so the Studio and the card show the SAME eight rather than each
 *  inventing a list: whatever replaces them replaces them once, here, and the two groups' names
 *  ("Class controls" / "Other actions") are the part of v18 that is settled.
 *
 *  A placeholder is not a disabled action. `placeholder: true` draws the tile dashed and unlit
 *  and gives it no key hint, so the deck itself says on screen that the decision is open — a
 *  greyed-out tile would say "this action exists and you cannot have it". */
export const QUICK_ACTION_PLACEHOLDERS = [
  { label: 'Class controls', actions: [1, 2, 3, 4].map((n) => ({ id: 'class-' + n, label: 'Class control ' + n, placeholder: true })) },
  { label: 'Other actions', actions: [1, 2, 3, 4].map((n) => ({ id: 'other-' + n, label: 'Other action ' + n, placeholder: true })) },
]

/** THE SWAP, AS CODE (2026-09-04, filing part 6). The exchange used to be five lines in the
 *  reference host; a port rewrites five lines differently. Pure: `(groups, library, shelfId,
 *  deckId)` → `{ groups, library }` with the shelf action in the deck's slot and the displaced
 *  deck action at the END of the shelf (so a swapped-out tile is where the eye goes to find it).
 *  Either id unknown → the same two lists back, untouched. The host still OWNS the two lists and
 *  the store they live in; only the arithmetic moved. */
export function swapActions(groups, library, shelfId, deckId) {
  const inbound = (library || []).find((a) => a && a.id === shelfId)
  if (!inbound) return { groups, library }
  let outbound = null
  const nextGroups = groups.map((g) => ({ ...g, actions: g.actions.map((a) => { if (a.id !== deckId) return a; outbound = a; return inbound }) }))
  if (!outbound) return { groups, library }
  return { groups: nextGroups, library: library.filter((a) => a.id !== shelfId).concat([outbound]) }
}
export const QuickActionsMath = { swap: swapActions }

/** WHAT THE DECK DECLARES ABOUT ITS OWN WIDTH, as a `PaneFit` (see `chrome/PaneDivider.d.ts`) —
 *  for the presenter's divider between the notes pane and this column (owner, 2026-09-23).
 *  `seed` (360) is the width it stands at untouched, the same column `LectureRecap`'s aside keeps.
 *  `floor` (300) is CHOSEN, not derived: two columns of tiles whose labels still read at
 *  `--fs-caption` without ellipsis on the placeholder set. No lesser reading, so the two are equal. */
export const QUICK_ACTIONS_FIT = { narrowBelow: 300, floor: 300, seed: 360 }
/** THE DOT is a plain 9px square with a 2px radius, not `DomainDot` and not `StepDot`: it names
 *  the KIND of action (class-facing, private, destructive), which is neither a domain nor a walk
 *  position. It takes any colour, deliberately — a host's own action kinds are the host's, and a
 *  closed union here would compile into a lint rule against them. */
function ActionDot({ colour, placeholder }) {
  if (placeholder) return <span style={{ flexShrink: 0, width: QUICK_ACTIONS_METRICS.dot, height: QUICK_ACTIONS_METRICS.dot, borderRadius: 2, border: '1px dashed var(--border-dashed)', boxSizing: 'border-box' }} />
  return <span style={{ flexShrink: 0, width: QUICK_ACTIONS_METRICS.dot, height: QUICK_ACTIONS_METRICS.dot, borderRadius: 2, background: colour || 'var(--bark-400)' }} />
}

/** ONE TILE. `on` is a HELD state (the map is up, the slide is flagged) and wears the walk-tinted
 *  active face the system reserves for exactly that — acorn wash, `--border-walk`, acorn ink.
 *  `leaving` is the drag's answer: the tile the dropped action would displace, named while the
 *  pointer is over it, because the deck is fixed at eight and something has to go back to the
 *  shelf. */
function Tile({ action, height, on, leaving, dragging, onDrop, onDragOverTile, onDragLeaveTile }) {
  const [hot, setHot] = React.useState(false)
  const ph = !!action.placeholder
  const dead = ph || action.disabled
  /* HOVER ON EVERY TILE THAT IS NOT REFUSING (owner, 2026-09-03: "could we add a hover effect on
     the buttons" — the deck HAD one and it never showed, because the Studio's deck is all
     PLACEHOLDERS and `hot && !dead` shut them out of it, so the pane read as eight dead cards).
     Three answers, not one:
       · A LIVE tile takes the face and the strong border — the promise of a click.
       · A PLACEHOLDER takes the border alone, still DASHED and with no face change: it is a slot
         nobody has decided, and its tooltip says so, so the pointer needs to find it without
         being told it can be pressed.
       · A DISABLED action takes nothing. That is a refusal with a reason, and lighting it up
         invites the click it is going to swallow. */
  const live = hot && !dead
  /* NATIVE `disabled` IS ONLY FOR A REAL REFUSAL, and that is what made the hover above
     unobservable in its first cut (found by review, 2026-09-03): Chrome and Safari dispatch no
     mouse events from a disabled control, so on a placeholder — that is, on every tile of the
     default deck — `onMouseEnter` never fired, `hot` stayed false, and the new branch could not
     paint. The `title` was dead for the same reason, which had been wrong since the tile was
     written. A placeholder is not refusing; it is UNDECIDED, and it stays a hit-test target so
     the pointer can find it and read its tooltip. The click is already guarded below, and
     `aria-disabled` is what tells a screen reader in both cases. */
  const refusing = !ph && !!action.disabled
  /* out of the tab order but not out of the pointer's reach: eight undecided slots taking eight
     tab stops is noise, and there is nothing to activate when it arrives */
  const tab = dead ? -1 : undefined
  /* `width: 100%` IS LOAD-BEARING, and its absence was both of the owner's shelf complaints in
     one line (2026-09-03: "more space between them", "looks off centre from the horizontal"). A
     `<button>` with `width: auto` is fit-content even at `display: flex` — on the DECK the tile
     is a grid item, so it stretched and nobody noticed; in the SHELF it sits inside the draggable
     span, where fit-content made a 122px tile in a 148px column. Measured: 34px between the two
     columns against the 8px gap the grid actually sets, 28px of slack on the right and none on
     the left. Not a gap value and not a centring bug — four tiles narrower than their cells.
     It reads `tileFill` off the published metrics rather than writing `'100%'` inline, and that
     is not decoration: `Tile` is a module-level helper, invisible to `String(NS.QuickActionsDeck)`,
     so a literal here cannot be guarded by a specimen card — the same reason `glyphPanel` was
     published for `LectureNotes`' composer. */
  const face = leaving ? 'var(--acorn-50)' : on ? 'var(--accent-walk-wash)' : ph ? 'var(--bark-50)' : live ? 'var(--bark-50)' : 'var(--surface-paper)'
  const line = leaving ? '1px dashed var(--acorn-400)' : on ? '1px solid var(--border-walk)' : ph ? '1px dashed ' + (hot ? 'var(--border-strong)' : 'var(--border-dashed)') : '1px solid ' + (live ? 'var(--border-strong)' : 'var(--border-frame)')
  return (
    <button type="button" disabled={refusing} aria-disabled={dead} aria-pressed={on ? true : undefined} tabIndex={tab}
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
           rather than leaving the column empty (owner, 2026-09-04: "what about the shortcuts?" —
           the planned deck shows a key on every tile, and eight tiles with a blank right edge
           read as a different design). Same vocabulary as the dashed dot beside it: the slot
           exists, nobody has chosen what goes in it. A real action's key is drawn AND BOUND — see
           the deck's own keydown handler; a hint nothing listens for is the fault this system
           removed from the shelf yesterday, and it is not coming back in a different column.
           THE COLUMN'S WIDTH IS THE LABEL'S BUDGET, and the first cut spent it (found by review,
           2026-09-04): a 20px box with 8px gaps left the label exactly 89px in a 162px tile, and
           the PLAN's own "Take a question" measures 92 — it truncated, as did every 15-character
           name one font fallback away. `tileGap` 6 and `keyBox` 14 give the label 107 for a
           placeholder and ~99 beside a real `(Q)`, which clears every name in v18 with room. The
           box only has to stand for a COLUMN; it was never meant to match a keycap.
           THE BUDGET, MEASURED at the 162px tile the presenter's 360 column gives: 162 − 18
           padding − 9 dot − 12 (two gaps) leaves 123, so a real `(Q)` at ~22 leaves the label 101
           and the plan's longest name, "Take a question", measures 90. `tilePadX` is 9 rather
           than v18's 10 for the last two of those px — imperceptible on the frame, and the
           difference between 11px of slack and 9. */}
        {leaving ? '↑ shelf' : ph ? <span aria-hidden="true" style={{ width: QUICK_ACTIONS_METRICS.keyBox, height: 11, border: '1px dashed var(--border-dashed)', borderRadius: 2, boxSizing: 'border-box' }} /> : action.key ? '(' + action.key + ')' : ''}
      </span>
    </button>
  )
}

function Grid({ children, columns, rowGap }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + columns + ', 1fr)', columnGap: QUICK_ACTIONS_METRICS.gap, rowGap: rowGap != null ? rowGap : QUICK_ACTIONS_METRICS.gap }}>{children}</div>
}

function GroupLabel({ children, style }) {
  return <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', margin: '0 0 5px', ...style }}>{children}</div>
}

/** THE SHELF opens BESIDE the pane, not over it (owner, 2026-09-03: "we cant drag the buttons
 *  onto the buttons behind the pane"). It used to sit at `bottom: calc(100% + 8px)` on an anchor
 *  that is the More button — and the More button is at the pane's FOOT, so "above the anchor" is
 *  directly on top of the deck: measured in the Studio, six of the eight tiles were under the
 *  popover, which is every drop target the gesture has. The docblock claimed the opposite and had
 *  since the day it was built. Beside it, the deck is whole and droppable.
 *
 *  `side` is measured, not assumed: left if the pane has room to its left (it is the right-hand
 *  column of the presenter, so it normally does), right if it does not — a deck at the window's
 *  left edge would otherwise open off-screen.
 *
 *  `shelfOffset` IS 21, NOT 8, and the number is derived: the anchor is the More button, which
 *  sits inside the pane body's 13px inset, so 8px of air from the anchor is 5px INSIDE the pane's
 *  own frame — measured, the popover lapped the pane's left border (2026-09-03). 13 + 8. */
function Library({ actions, columns, onSelect, onDragStart, onDragEnd, note, onClose, side = 'left', offset, onOffsetChange }) {
  const [inside, setInside] = React.useState(false)
  const ref = React.useRef(null)
  const grab = React.useRef(null)
  /* THE SHELF IS MOVABLE, AND THE SAVED POSITION IS A DELTA (owner, 2026-09-04: "can we grip the
     more actions or the top of its pane to drag it… the position of it should be saved"). Not an
     absolute point: the shelf is placed BESIDE the pane and which side that is gets measured on
     every open, so a saved coordinate would be wrong the first time the window changed width or
     the deck flipped sides. A delta from the computed placement survives both, and it clamps to
     the viewport on open — a delta saved on a wide screen cannot strand the shelf off the edge of
     a narrow one. `at` is the live drag; `offset` is what the HOST has saved, because this pane
     stores nothing (the same boundary as a minted category). */
  const [at, setAt] = React.useState(null)
  const shown = at || offset || { x: 0, y: 0 }
  /* THE ORIGIN IS MEASURED ONCE, AT POINTERDOWN. Re-measuring it during the drag is the bug this
     shipped with for one turn (found by review, 2026-09-04): `r.left - shown.x` is only the
     untranslated origin while the rect and `shown` agree, and inside a gesture they cannot — the
     rect already carries the live offset while the closure still holds the offset the drag STARTED
     from, so the bounds drifted by exactly the distance dragged. The shelf stuck short of the
     right edge and could be pushed past the left one, which is precisely the guarantee the
     contract states in words. The open-time clamp below re-measures on purpose: there nothing is
     mid-gesture, so the rect and `shown` do agree. */
  const bounds = (g, p) => ({
    x: Math.max(8 - g.originX, Math.min(window.innerWidth - 8 - g.w - g.originX, p.x)),
    y: Math.max(8 - g.originY, Math.min(window.innerHeight - 8 - g.h - g.originY, p.y)),
  })
  const originOf = () => {
    const r = ref.current.getBoundingClientRect()
    return { originX: r.left - shown.x, originY: r.top - shown.y, w: r.width, h: r.height }
  }
  React.useLayoutEffect(() => {
    if (!ref.current || typeof window === 'undefined') return
    const fixed = bounds(originOf(), shown)
    if (fixed.x !== shown.x || fixed.y !== shown.y) { if (onOffsetChange) onOffsetChange(fixed); else setAt(fixed) }
  }, [])
  const onGrab = (e) => {
    if (e.button) return
    e.preventDefault()
    const g = { px: e.clientX, py: e.clientY, x: shown.x, y: shown.y, ...originOf() }
    grab.current = g
    /* the last position is held in the closure, not read back out of state: `onOffsetChange` is
       the host's persistence and must not be called from inside a state updater, where StrictMode
       double-invokes it and a save becomes a side effect of rendering (same review) */
    let last = { x: g.x, y: g.y }
    setAt(last)
    const move = (ev) => {
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
  const beside = side === 'left'
    ? { right: 'calc(100% + ' + QUICK_ACTIONS_METRICS.shelfOffset + 'px)', width: '100%' }
    : { left: 'calc(100% + ' + QUICK_ACTIONS_METRICS.shelfOffset + 'px)', width: '100%' }
  return (
    <div ref={ref} onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)}
      onFocus={() => setInside(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInside(false) }}
      style={{ position: 'absolute', bottom: 0, ...beside, transform: (shown.x || shown.y) ? 'translate(' + shown.x + 'px, ' + shown.y + 'px)' : undefined, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-3)', padding: '11px 13px', boxSizing: 'border-box', zIndex: 7 }}>
      {/* THE CLOSE SITS ON THE TOP-RIGHT BORDER, the way a pane's does and the way `StopFinder`'s
         does (owner, 2026-09-03). It was inline in the header for a turn, which put a control
         inside the content it dismisses and cost the header a row of its own. A pane masks its
         border with the DESK colour; a popover floats over panes it cannot name, so the mask is a
         1px strip of the panel's OWN face over the border line only. Revealed while the pointer
         or the keyboard is inside, absent at rest, fading on `--dur-hover` — the same delay every
         other revealed control in the system uses. */}
      {onClose ? (
        <span style={{ position: 'absolute', top: -9, right: 10, zIndex: 3, display: 'inline-flex', opacity: inside ? 1 : 0, pointerEvents: inside ? 'auto' : 'none', transition: 'opacity var(--dur-hover) var(--ease-soft)' }}>
          <span style={{ position: 'absolute', left: -3, right: -3, top: 8, height: 1, background: 'var(--surface-paper)' }} />
          <IconButton title={wrapTip('Close (esc)')} label="close the shelf" onClick={onClose} reveal={inside} style={{ position: 'relative', zIndex: 1 }} />
        </span>
      ) : null}
      {/* THE HEADER IS THE HANDLE, and the grip is the affordance — `PaneHeader`'s own split:
         the mark says the gesture exists, the row owns the pointer. It is the whole row rather
         than the mark alone because a 9px target is not a target (the same reasoning that gives
         the pane's resize corner 21px of padding around its triangle). */}
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
 *  second copy and not a widened API: `Tile` and `Library` are module-level helpers, and
 *  `String(NS.QuickActionsDeck)` contains only the exported function's OWN body, so every
 *  behaviour living in a helper is invisible to a specimen card's staleness guard. Six of one
 *  card's seven tokens were unreachable or false at once before this existed (2026-09-03): four
 *  permanent reds naming changes already in the build, two greens matching a comment and a
 *  previous turn's code. Published capitalised in the same turn the need appeared, per the rule
 *  — a lower-case helper the namespace cannot carry is a token nobody can write.
 *
 *  Read them; do not render them. The supported surface is `QuickActionsDeck`. */
export const QUICK_ACTION_PARTS = { Tile, Library }

/**
 * The quick actions deck — part 6 of the presenter-mode split. Eight tiles in two named groups,
 * a shelf of everything else behind one button, and drag-to-swap between the two.
 */
export function QuickActionsDeck({
  groups = QUICK_ACTION_PLACEHOLDERS, library = [], cap = QUICK_ACTIONS_METRICS.cap,
  columns = QUICK_ACTIONS_METRICS.columns, on = [], libraryOpen, onLibraryOpenChange,
  shelfPosition, onShelfPositionChange,
  onSwap, onLibrarySelect, title = 'quick actions', moreLabel = '+ More actions…',
  libraryNote = 'drag an action onto the deck to keep it there — the deck is fixed at eight, so whichever tile you drop onto goes back to the shelf.',
  style,
}) {
  const [ownOpen, setOwnOpen] = React.useState(false)
  const [moreHot, setMoreHot] = React.useState(false)
  const [ownPos, setOwnPos] = React.useState(null)
  const [side, setSide] = React.useState('left')
  const anchorRef = React.useRef(null)
  const [dragId, setDragId] = React.useState(null)
  const [overId, setOverId] = React.useState(null)
  const open = libraryOpen != null ? libraryOpen : ownOpen
  const setOpen = (v) => { if (onLibraryOpenChange) onLibraryOpenChange(v); if (libraryOpen == null) setOwnOpen(v) }
  /* ESC ACTUALLY CLOSES IT NOW. The shelf carried an "esc to close" text button from the day it
     was built and nothing listened for the key — a shortcut taught by a label and implemented
     nowhere, which is the same fault the category rows' numerals were removed for. The ✕ that
     replaced that button says `Close (esc)` in its tooltip, so the key had to become real in the
     same turn (owner, 2026-09-03). Document-level, because the shelf takes no focus of its own:
     it is a drag target, and a professor opens it and reaches for the pointer. */
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  /* THE CAP IS A CODE GUARD, not a sentence in the contract: a ninth tile is a silent failure —
     it fits, it looks right, and the deck stops being a deck. It is reported and dropped. */
  const flat = []
  groups.forEach((g) => (g.actions || []).forEach((a) => flat.push(a)))
  const over = flat.length - cap
  React.useEffect(() => {
    if (over > 0) console.warn('QuickActionsDeck: ' + flat.length + ' tiles passed, ' + cap + ' is the cap — dropped: ' + flat.slice(cap).map((a) => a.label).join(', '))
  }, [over, flat.length])
  let budget = cap
  const shown = groups.map((g) => {
    const take = Math.max(0, Math.min(budget, (g.actions || []).length))
    budget -= take
    return { label: g.label, actions: (g.actions || []).slice(0, take) }
  })
  /* WHICH SIDE THE SHELF OPENS ON is measured when it opens, not assumed: the deck is the
     presenter's right-hand column and normally has the whole board to its left, but a deck placed
     at the window's left edge would open off-screen. One read of the anchor, on open. */
  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setSide(r.left - r.width - 8 >= 0 ? 'left' : 'right')
  }, [open])
  /* THE DECK BINDS THE KEYS IT DRAWS. A tile's `(M)` used to be a picture of a shortcut: the
     component printed the hint and nobody, here or in the app, listened for the key — the same
     fault as the shelf's "esc to close", which cost a day to find because a label is indis-
     tinguishable from a feature until you press it. So the deck listens while it is mounted and
     runs the action's own `onSelect`. What it will NOT do is bind a key for a tile that cannot
     act (a placeholder or a disabled action), and it stays out of the way while someone is
     typing — a professor writing a note must be able to type an M. Modifier chords are the
     host's: this matches a bare letter, which is what `key` is for. */
  React.useEffect(() => {
    const bound = flat.filter((a) => a.key && a.onSelect && !a.placeholder && !a.disabled && String(a.key).length === 1)
    if (!bound.length) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return
      const hit = bound.find((a) => String(a.key).toLowerCase() === String(e.key).toLowerCase())
      if (!hit) return
      e.preventDefault()
      hit.onSelect()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flat.map((a) => a.id + ':' + (a.key || '')).join(',')])
  const onFlag = (id) => on.indexOf(id) >= 0
  /* THE EIGHT ARE VISIBLE WITHOUT SCROLLING AT WHATEVER HEIGHT THE HOST GIVES (owner, 2026-09-04,
     asking a second time — and the second ask is what sent me to MEASURE the real pane instead of
     the one on the card: 214px in their Studio, not the 311 I had fixed for. The panes row is
     short, so the deck had 146px of content space for 240px of tiles. At 42px there is no spacing
     trick that fits eight; the tiles themselves have to give.)
     So the deck measures what it is given and picks a tile height between `tile` (42, the v18
     look) and `tileMin` (28, the smallest that still reads as a pressable row at
     `--fs-caption` — the tile drops to caption type under 38 on its own). Below the floor the
     scroller takes over, which is the net that was already there. This is the one measurement the
     component cannot avoid owning: only it knows how many rows, labels and gaps its own groups
     make, and the host cannot compute a tile height it does not lay out. */
  const fitRef = React.useRef(null)
  const [avail, setAvail] = React.useState(0)
  React.useEffect(() => {
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
  const fixedPart = (labels, rule, gap) => (labels ? shown.filter((g) => g.label).length * M2.labelBlock : 0)
    + Math.max(0, shown.length - 1) * (rule ? M2.dividerBlock : M2.groupGap)
    + rowsPer.reduce((n, r) => n + Math.max(0, r - 1), 0) * gap
  const fitFor = (labels, rule, gap) => Math.floor((avail - fixedPart(labels, rule, gap)) / rows)
  /* IT DEGRADES IN A STATED ORDER, and the order is the whole design of this thing — each rung
     gives up the cheapest remaining thing, and the LAST rung is the scrollbar, because a control
     deck you have to scroll to reach is not a deck (owner, 2026-09-05: "i want the quick actions
     pane to not have a scrollbar, could we make the buttons scale smaller?" — yes, and the gaps
     before them). Read the table as "the first row that fits wins":
       1. tile height, 42 down to `tileMin` 28, headings and rule intact;
       2. the ROW GAP, 8 down to `gapMin` 4 — the cheapest 12px on the pane, and it is bought
          before any WORDS are given up; the column gap never moves, horizontal room is not what
          runs out;
       3. the group LABELS — the tiles still say what they are, a heading only says where a group
          starts;
       4. the tiles again, `tileMin` 28 down to `tileFloor` 22, the smallest row this system will
          draw as pressable;
       5. the RULE, replaced by `groupGap`, which is the last thing that still separates them;
       6. the scroller. The net, not the norm.
     THE RULE OUTLIVES THE LABELS ON PURPOSE (owner, 2026-09-04: "why is the divider gone after
     the error fix") — a label costs 21 a group, the rule 18 for the pair, so the cheaper mark is
     also the one that survives longer. And the ladder ONLY CLIMBS DOWN WHILE THERE IS SOMETHING TO
     BUY: once no rung fits, the scroller is arriving whatever the deck does, so the headings, the
     rule and the resting gap all come back and the height is spent on legibility instead (owner,
     2026-09-05: "the divider is now gone and also the 8 buttons is causing the scroll bar to
     appear?" — it had been paying for a scrollbar it got anyway). */
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
      /* NOTHING HERE IS TEXT TO TAKE AWAY (owner, 2026-09-04). Every word on this pane is a
         control's own label or a heading over one, and a drag across the tiles used to select
         them — which is not a copy anybody wanted and it fights the drag-to-swap gesture the deck
         is built on. The composer next door is the opposite case, and gets the opposite rule. */
      userSelect: 'none', WebkitUserSelect: 'none' }} style={{ flex: 1, minHeight: 0, ...style }}>
      {/* THE TILES SCROLL, THE SHELF BUTTON DOES NOT (owner's screenshot, 2026-09-03: the pane
         had cropped its own last row and the More button with it). The deck needs ~294px and the
         presenter gives it whatever the roll and the strip leave, which on a laptop is less — and
         `scroll="none"` on a body with no scroller CROPS in silence: no scrollbar, no warning,
         two tiles and the one control that always works simply absent. A pane that is short is
         normal; losing the shelf is not. So the groups get their own scroller and the button
         stays pinned under it, which is the same shape `LectureNotes` uses for its composer.
         ITS OWN 12px VERTICAL MARGINS GO: `PaneScroller` insets itself for the case it was
         written for — a scroller under a column head, where the gap is the head's. Here the pane
         body's own padding already does that, and the 24px was measured to be exactly what the
         eighth tile needed (2026-09-03, with the group rule the owner had called too strong). */}
      <PaneScroller forwardRef={fitRef} style={{ paddingRight: 6, margin: '0 -6px 0 0' }}>
        {shown.map((g, i) => (
          <React.Fragment key={g.label || i}>
          {/* THE DIVIDER IS BACK, INSET (owner, 2026-09-04: "how come u got rid of the divider… it
             doesnt look like the planned one" — and they are right; v18's `.qdiv` is a 1px
             `--border-hair` at 13/11 margins, which is exactly what I deleted to buy height when
             they said it was too strong. "Too strong" was a request to soften, and the height had
             to come from somewhere else. It now comes from the fit ladder.
             SOFTER MEANS LIGHTER AND LONGER NOW (owner, 2026-09-04, second pass): `--border-hair`
             at 10px of inset was still the strongest mark on a pane of dashed tiles, and a rule
             shorter than the things it divides reads as a fragment. `dividerInk` is `--bark-200`
             — a solid tint rather than a new alpha token, and lighter on paper than the hairline
             it replaces — and `dividerInset` is 0, so the rule runs the FULL width of the tile
             grid and ends exactly where the buttons do. Ink carries the softening; length carries
             the belonging.
             The reason it read heavy in the first place is worth keeping: OUR tiles are dashed
             placeholders, so a solid `--border-hair` was the strongest thing on the pane, where
             v18's solid-edged tiles made the same hairline the quietest in the group.
             THINNER, TOO (owner, same message): the LINE stays 1px — it is already the thinnest a
             border renders identically across displays, and a 0.5px rule is a different weight on
             every device — so the thickness that came off is the BAND. 13/11 margins became 9/8,
             `dividerBlock` 25 → 18, which reads lighter and is also what lets the rule outlive the
             labels at 214px.
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
        </React.Fragment>
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
           dashed means everywhere else in this system. It stays put when the shelf is open so
           the popover has a fixed anchor. IT WEARS A WASH AT REST (owner, 2026-09-03): it was
           transparent, which on paper reads as a caption rather than the one control on the pane
           that always works. Three steps, so hover is still an answer and not a repeat of the
           resting face: `--bark-50` at rest, `--bark-100` hovered, `--bark-100` open — and
           `--bark-200` HOVERED WHILE OPEN, because the open face and the hover face were the
           same wash for a turn, so "Close the shelf" answered a pointer with nothing (owner,
           2026-09-03). Open is as heavy as hover; hovering an open button goes one step past it.
           The dash goes `--border-strong` and the ink `--text-1` for every lit state. */}
        <button type="button" onClick={() => setOpen(!open)}
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
