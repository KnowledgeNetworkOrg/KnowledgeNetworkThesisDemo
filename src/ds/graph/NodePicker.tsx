import { portalInto } from '../chrome/portal'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { DomainDot } from './DomainDot'
import { NodeChip, CHIP_METRICS as M } from './NodeChip'
import { IconButton, useClipped } from '../chrome/IconButton'

export interface NodeOption {
  id: string
  title: string
  /** a ring hue name — what the corpus stores on a topic (`topicHueOf`). `string`, as the
   *  DS has it; the six-code union this once carried is gone (OB-153). */
  domain: string
  /** nested options, indented one step further. A node with children is still itself pickable */
  children?: NodeOption[]
}

export interface NodePickerProps {
  /** the menu's contents, as a tree — any option may carry `children` */
  options: NodeOption[]
  /** the picked option's `id` (a leaf or a parent), or `undefined`/`null` while unresolved */
  value?: string | null
  /** fires once, with the picked option's id — the pick is final, there is no way
   *  back into the menu afterward */
  onChange?: (id: string) => void
  /** shown, unresolved only. Default `'pick a node'` */
  placeholder?: string
  /** the `mark` a resolved node renders as — passed straight to `NodeChip`. Default `'border'` */
  mark?: 'dot' | 'border' | 'border-2' | 'none'
  /** adds a filter field above the list. Typing keeps only options whose own title matches;
   *  a match keeps its place relative to other matches (ancestor+descendant both matching
   *  still nest), and a match under a non-matching ancestor promotes up to the nearest one
   *  that did (or the top). Default off */
  search?: boolean
  /** where the open menu portals to. Default `document.body`; `null` renders in place */
  menuPortal?: HTMLElement | null
  /** the open menu's scroll cap, px. Default 280 */
  menuMaxHeight?: number
  /** OPT-IN, AND IT WORKS ON BOTH STATES — same contract as `NodeChip`'s own: passing
   *  the handler is the whole switch. Resolved, it passes straight through to the
   *  `NodeChip` this renders, unchanged. Unresolved, it adds the same hover-revealed ✕
   *  at the pill's trailing edge, after the chevron. An empty slot is removable from a
   *  chain exactly as a filled one is, so a host never has to swap which control it
   *  renders as a step resolves. */
  onDelete?: () => void
}

/** A node NOT YET PICKED, standing where a `NodeChip` will stand once it is. Two states,
 *  drawn differently on purpose:
 *
 *  UNRESOLVED — a neutral pill (`--border-rule`, solid — never dashed; dashed already
 *  means CONDITIONAL in this system, and an empty picker is not a maybe-node, it is a
 *  not-yet-node), the placeholder in `--text-3`, and a small down-chevron at the trailing
 *  edge. Click it and a menu of `options` opens under it, portaled to `document.body` and
 *  measured off the picker's own rect, the same way `VersionedGroup`'s version menu is.
 *
 *  `options` IS A TREE, NOT A FLAT LIST — any option can carry `children`, to any depth,
 *  and a PARENT IS ALSO A PICKABLE NODE: clicking "Networking" picks Networking itself,
 *  exactly like clicking "TCP & UDP" underneath it picks that. Nesting is drawn as
 *  indentation and nothing else — no caret, no collapse. Pass `search` to add a filter
 *  field: typing keeps ONLY the nodes that themselves match, but a match keeps its place
 *  relative to other matches.
 *
 *  RESOLVED — the chevron is gone, and so is the click. The moment a node is picked this
 *  renders it as an ordinary, STATIC `NodeChip` (`mark`, passed through) — the same
 *  drawing a walk step or a rail entry uses. The pick is final: there is no way back into
 *  the menu from a resolved chip. A surface that wants to change it removes the node and
 *  picks again.
 *
 *  THE SHELL IS SOLID, NEVER DASHED — dashed already means CONDITIONAL (an optional step,
 *  an inactive bypass); an empty picker is a different fact ("no answer yet," not "may not
 *  happen").
 *
 *  Typed port of the DS NodePicker.jsx (contract: NodePicker.d.ts). */
export function NodePicker({
  options, value, onChange, placeholder = 'pick a node', mark = 'border', search, menuPortal, menuMaxHeight = 280, onDelete,
}: NodePickerProps) {
  const ROW_PAD = 4
  const [open, setOpen] = useState(false)
  /* `top` and `bottom` are exclusive — which one is set says whether the menu hangs
     below the picker or sits above it. See place() for why the flip exists. */
  const [anchor, setAnchor] = useState<
    { left: number; width: number; up: boolean; maxHeight: number; top?: number; bottom?: number } | null
  >(null)
  const [hover, setHover] = useState(false)
  const [query, setQuery] = useState('')
  const anchorRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const picked = useMemo(() => findNode(options, value ?? undefined), [options, value])

  const portalTarget = menuPortal === null ? null : menuPortal || (typeof document !== 'undefined' ? document.body : null)

  useEffect(() => {
    if (!open || !portalTarget) return undefined
    const place = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setAnchor(placeMenu(r, window.innerHeight, menuMaxHeight))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (ro && anchorRef.current) ro.observe(anchorRef.current)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      if (ro) ro.disconnect()
    }
    // menuMaxHeight joined the deps when place() started capping to it — a caller
    // that raises the cap must get the menu re-placed, not left at the old room
  }, [open, portalTarget, menuMaxHeight])

  useEffect(() => {
    if (!open) return undefined
    if (search) requestAnimationFrame(() => inputRef.current?.focus())
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, search])

  const filtered = useMemo(() => filterTree(options, query), [options, query])

  const menu = open && portalTarget && anchor ? (
    <div
      ref={menuRef}
      /* ★ LOCAL: THE MENU KEEPS ITS POINTER EVENTS TO ITSELF.
         A portal moves the menu in the DOM but NOT in the React tree, so React
         still bubbles its events up through whatever rendered the picker. On this
         app's road that lands in AuthorRoad's board `onPointerDown`, whose guard
         asks `e.target.closest('[data-rnode],…,button,input,select')` — a DOM
         question the portal has already put out of reach, since the row really is
         a child of document.body and `MenuItem` is a div rather than a button. The
         guard therefore does not bail, the board calls setPointerCapture, and the
         captured pointer retargets mouseup away from the row — so `click` never
         fires and PICKING A NODE SILENTLY DOES NOTHING. (VersionedGroup's own
         portaled menu escapes this only by accident: its rows ARE buttons, so the
         same guard matches and bails.)
         Stopping here rather than widening the host's selector, because the fix
         has to hold for every ancestor gesture and every host, not just this one
         board's marquee — a portaled overlay delivering pointerdown into an
         arbitrary React ancestor is the defect. The outside-click dismiss above is
         a NATIVE document listener and is deliberately unaffected by this.
         Reported upstream; drop if the DS adopts it. */
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width, minWidth: 200,
        maxHeight: anchor.maxHeight, display: 'flex', flexDirection: 'column', background: 'var(--surface-raised)',
        border: '1px solid var(--border-rule)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)',
        zIndex: 60, overflow: 'hidden',
      }}
    >
      {search ? (
        <div style={{ padding: 6, borderBottom: '1px solid var(--border-hair)', flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search nodes"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '6px 8px', font: 'inherit', fontSize: 'var(--fs-body)',
              border: '1px solid var(--border-rule)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-paper)',
              color: 'var(--text-1)', outline: 'none',
            }}
          />
        </div>
      ) : null}
      <div style={{ overflowY: 'auto', padding: 4 }}>
        {filtered.length
          ? renderRows(filtered, 0, (id) => { onChange?.(id); setOpen(false) }, ROW_PAD)
          : <div style={{ padding: '7px 9px', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>no nodes</div>}
      </div>
    </div>
  ) : null

  // resets the search query at the one place `open` can go false→true, rather than in
  // an effect keyed on `open` (which the query-reset used to live in) — an unconditional
  // setState in an effect body risks a cascading render the linter now catches.
  const toggleOpen = () => {
    if (open) { setOpen(false); return }
    setQuery('')
    setOpen(true)
  }

  const anchorEl: ReactNode = picked ? (
    <NodeChip title={picked.title} domain={picked.domain} mark={mark} onDelete={onDelete} />
  ) : (
    /* THE PILL IS THE SPAN, THE TOGGLE IS THE BUTTON INSIDE IT (DS OB-092). The whole
       unresolved shell used to be one <button>; it is split so an optional ✕ can sit
       inside the pill's own border without being nested in the control that opens the
       menu — a button inside a button is invalid, and a ✕ outside the pill would read
       as a different slot's control. The border, background, hover wash and padding
       all stay on the span, so the pill's measured box is unchanged when no `onDelete`
       is passed. */
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: M.gap,
        font: 'inherit', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-medium)', color: 'var(--text-3)',
        padding: M.padYFlat + 'px ' + M.padXFlat + 'px', borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-rule)', background: hover || open ? 'var(--surface-hover)' : 'var(--surface-raised)',
        transition: 'background var(--dur-hover) var(--ease-soft)',
      }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: M.gap, cursor: 'pointer',
          font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{placeholder}</span>
        <Chevron open={open} />
      </button>
      {onDelete ? (
        <IconButton
          tone="danger"
          title="delete this node"
          label="delete this node"
          reveal={hover}
          onClick={onDelete}
          style={{ marginLeft: 'auto', marginRight: -M.delPull }}
        />
      ) : null}
    </span>
  )

  if (picked) return anchorEl

  return (
    <>
      {/* the DS's .jsx puts this same anchorRef on BOTH the span and the inner button —
          harmless in JS (the span, mounted last, wins) but not cleanly typeable across two
          different host element refs in TS. Dropped from the button: the span wraps it with
          no padding or border of its own, so their measured rects are identical. */}
      <span ref={anchorRef} style={{ display: 'inline-flex' }}>{anchorEl}</span>
      {portalTarget && open && menu ? portalInto(portalTarget, menu) : menu}
    </>
  )
}

/** getBoundingClientRect() gives more than placeMenu needs — only these four matter,
 *  which is also what lets a test pass a plain object instead of a real DOMRect. */
export interface AnchorRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface MenuPlacement {
  left: number
  width: number
  up: boolean
  /** exclusive with `bottom` — which one is set says whether the menu hangs
   *  below the anchor or sits above it */
  top?: number
  bottom?: number
  maxHeight: number
}

/** ★ LOCAL: flips the menu above the anchor when the viewport has no room below,
 *  and CAPS its height to whatever room it actually has on that side.
 *
 *  The DS's own NodePicker.jsx anchors at `rect.bottom + 4` unconditionally, and
 *  its docblock says the menu opens "the same way VersionedGroup's version menu
 *  is" — the one sentence about it that is false: VersionedGroup DOES flip (see
 *  its own place(), the `up` term). The menu is position:fixed, so nothing
 *  absorbs the overflow — the page cannot scroll to reveal it, and scrolling the
 *  pane re-anchors it to keep following the trigger. On this app's road that is
 *  not an edge case: adding a version GROWS the card and pushes the fresh empty
 *  slot further down, so the picker most likely to be opened is the one most
 *  likely to be near the bottom. Measured on the road's second card at a 950px
 *  viewport: 280px of menu, 46px of it off-screen, 7 of 53 rows reachable.
 *
 *  TWO TERMS, AND THE SECOND IS THE ONE THAT ACTUALLY FIXES IT. Flipping alone
 *  does not: VersionedGroup's `room < Math.min(cap, 160)` test asks whether
 *  there is ALMOST NO room below, so a picker with 230px under it and a 280px
 *  menu does not flip and still overflows by 46 — measured, that exact case. So
 *  the menu is also CAPPED to the room it has, whichever way it faces. A menu
 *  that flips but still overruns has only moved which rows you cannot reach.
 *  Floor of 120 so a picker wedged against an edge still shows a few rows and
 *  its own scrollbar rather than collapsing to a sliver.
 *
 *  Split out from the effect above so this regression (menu opens off-screen,
 *  uncapped) has a fast unit test that runs with no browser — see
 *  NodePicker.test.ts. Reported upstream; drop this block if the DS adopts the
 *  flip. */
export function placeMenu(anchor: AnchorRect, viewportHeight: number, menuMaxHeight: number): MenuPlacement {
  const below = viewportHeight - anchor.bottom - 8
  const above = anchor.top - 8
  const up = below < menuMaxHeight && above > below
  return {
    left: anchor.left,
    width: anchor.width,
    up,
    top: up ? undefined : anchor.bottom + 4,
    bottom: up ? viewportHeight - anchor.top + 4 : undefined,
    maxHeight: Math.min(menuMaxHeight, Math.max(120, up ? above : below)),
  }
}

/** a plain down-chevron — no relation to the house disclosure `Caret`: that mark heads a
 *  disclosure (something opens or closes), and there is none here to point at, since a
 *  parent option is never collapsed. This just says "more options below". */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-hover) var(--ease-soft)' }}>
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function findNode(nodes: NodeOption[] | undefined, id: string | undefined): NodeOption | null {
  if (id == null) return null
  for (const n of nodes || []) {
    if (n.id === id) return n
    const hit = n.children && findNode(n.children, id)
    if (hit) return hit
  }
  return null
}

/** while searching, ONLY matched nodes survive — but a match keeps its place relative to
 *  OTHER matches: if an ancestor and a descendant both match, the descendant still nests
 *  under the ancestor, guide and all. A match under a NON-matching ancestor is promoted up
 *  to wherever the nearest matching ancestor is (or the top, if none matched). */
function filterTree(nodes: NodeOption[], query: string): NodeOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes || []
  const walk = (list: NodeOption[]): NodeOption[] => {
    const out: NodeOption[] = []
    for (const n of list || []) {
      const kids = n.children ? walk(n.children) : []
      if (n.title.toLowerCase().includes(q)) out.push(kids.length ? { ...n, children: kids } : { ...n, children: undefined })
      else out.push(...kids)
    }
    return out
  }
  return walk(nodes)
}

function renderRows(nodes: NodeOption[], depth: number, onPick: (id: string) => void, rowPad: number): ReactNode[] {
  const rows: ReactNode[] = []
  for (const n of nodes) {
    const hasKids = n.children && n.children.length
    rows.push(<MenuItem key={n.id} node={n} depth={depth} onPick={onPick} rowPad={rowPad} />)
    if (hasKids) {
      const guide = 9 + depth * 16 + 4
      rows.push(
        <div key={n.id + '-kids'} style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: guide, top: 0, bottom: 0, width: 1, background: 'var(--border-hair)' }} />
          {renderRows(n.children!, depth + 1, onPick, rowPad)}
        </div>,
      )
    }
  }
  return rows
}

function MenuItem({ node, depth, onPick, rowPad }: { node: NodeOption; depth: number; onPick: (id: string) => void; rowPad: number }) {
  const clip = useClipped<HTMLSpanElement>(node.title)
  const rowStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: rowPad + 'px 9px ' + rowPad + 'px ' + (9 + depth * 16) + 'px',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--fs-body)', color: 'var(--text-1)',
  }
  return (
    <div
      onClick={() => onPick(node.id)}
      style={rowStyle}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <DomainDot domain={node.domain} />
      <span {...clip} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.title}
      </span>
    </div>
  )
}
