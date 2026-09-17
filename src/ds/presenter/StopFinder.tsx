import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { StepDot } from '../nav/StepDot'
import { FlagMark } from '../chrome/FlagMark'
import { FindMark } from '../chrome/FindMark'
import { TextInput } from '../chrome/TextInput'
import { IconButton, wrapTip } from '../chrome/IconButton'
import { WalkPreview, previewAnchor } from '../nav/WalkPreview'
import { portalInto } from '../chrome/portal'

/* Typed port of the DS components/presenter/StopFinder.jsx (contract: StopFinder.d.ts), part 8
   of the presenter-mode split — OB-138 / #267. */

/** The finder's numbers. `width` and `maxListHeight` are CHOSEN (the picker's menu is 280 tall for
 *  the same reason: about nine rows before you would rather type). `asideWidth` is the map slot's
 *  column when a host gives `renderAside`. `gap` is the drop below the anchor; `row` is derived
 *  from the 16px dot plus 6px above and below. `minListHeight` is four rows — the least the list
 *  shrinks to when the window is short (CHOSEN: fewer and the finder reads as broken). */
export const STOP_FINDER_METRICS = { width: 320, asideWidth: 220, maxListHeight: 280, minListHeight: 112, gap: 6, row: 28, dot: 16 }

export interface StopFinderStep {
  title: string
  /** shown as the group heading with no query, and after the title with one */
  territory?: string
  /** colours the territory heading in the grouped (no-query) view — `--hue-<hue>-ink` */
  hue?: string
}

/** WHICH STOPS A QUERY KEEPS, in walk order. Case-insensitive substring on the title or the
 *  territory; a query that is only digits also matches that stop NUMBER exactly ("43" → stop 43),
 *  because the strip's pill and the header both speak in numbers. Empty query keeps every stop. */
export function filterStops(steps: readonly StopFinderStep[], query: string): number[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return steps.map((_, i) => i)
  const asNumber = /^\d+$/.test(q) ? parseInt(q, 10) - 1 : -1
  const out: number[] = []
  steps.forEach((s, i) => {
    if (i === asNumber || (s.title || '').toLowerCase().indexOf(q) >= 0 || (s.territory || '').toLowerCase().indexOf(q) >= 0) out.push(i)
  })
  return out
}

/** The title with the matched run in the walk's bold — the query is what the eye is scanning for. */
function Match({ text, query }: { text: string; query: string }) {
  const q = (query || '').trim()
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return <span>{text}</span>
  return <span>{text.slice(0, at)}<b style={{ fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>{text.slice(at, at + q.length)}</b>{text.slice(at + q.length)}</span>
}

interface RowProps {
  step: StopFinderStep
  index: number
  state: 'done' | 'current' | 'ahead'
  flagged: boolean
  roaming: boolean
  selected: boolean
  query: string
  showTerritory: boolean
  onPick: (i: number) => void
  onSelect: (i: number, el: HTMLElement) => void
  onLeave: () => void
  renderPreview?: (step: StopFinderStep, index: number) => ReactNode
}

function Row({ step, index, state, flagged, roaming, selected, query, showTerritory, onPick, onSelect, onLeave, renderPreview }: RowProps) {
  const M = STOP_FINDER_METRICS
  return (
    <div role="option" aria-selected={selected} data-stop-finder-row={index} onClick={() => onPick(index)}
      onMouseEnter={(e) => onSelect(index, e.currentTarget)} onMouseLeave={onLeave}
      title={renderPreview ? undefined : wrapTip(step.title)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: M.row, padding: '0 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selected ? 'var(--surface-hover)' : 'transparent', /* a tracked highlight is instant both ways — see --transition-wash-tracking (OB-204) */ transition: 'var(--transition-wash-tracking)' }}>
      <StepDot n={index + 1} size={M.dot} state={state} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: state === 'current' ? 'var(--text-walk)' : 'var(--text-1)', fontWeight: state === 'current' ? 'var(--fw-semibold)' : 'var(--fw-regular)' }}>
        <Match text={step.title} query={query} />
        {showTerritory && step.territory ? <span style={{ color: 'var(--text-3)', fontWeight: 'var(--fw-regular)' }}> · <Match text={step.territory} query={query} /></span> : null}
      </span>
      {roaming ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)', flexShrink: 0 }}>roaming</span> : null}
      {flagged ? <FlagMark size={10} filled style={{ color: 'var(--acorn-600)', flexShrink: 0 }} /> : null}
    </div>
  )
}

/** The stop finder — a popover under the strip's find button: type, the walk narrows, ↑↓ pick,
 *  ↵ roams there, esc closes.
 *
 *  IT NEVER MOVES THE ACTIVE NODE. `onPick(index)` is the same ask as clicking a tick on the
 *  strip — the host starts roaming there. Committing stays the hold on the strip's ring, so the
 *  finder cannot skip the one deliberate gesture the mode is built around.
 *
 *  NO QUERY IS AN OUTLINE: every stop, grouped under territory headings in the territory's hue,
 *  so a professor who cannot recall a name can browse. A query flattens to matches in walk order,
 *  each row then carrying its territory. A query of digits only also matches that stop NUMBER.
 *
 *  ANCHORED OR IN FLOW. With `anchor` (the find button's rect, what `PresenterStrip.onFind` hands
 *  over) it is `position: fixed`, portaled into `document.body`, hung `gap` below the anchor's
 *  bottom-left and kept inside the viewport; the list shrinks to the room below the anchor, never
 *  under `minListHeight`, and re-measures on resize. Without `anchor` it renders where it is.
 *
 *  TWO WAYS TO SHOW THE HOVERED STOP, both the host's content: `renderAside` (the presenter's
 *  default — a column for a small territory map, redrawn for the hovered OR keyboard-selected
 *  stop) and `renderPreview` (`WalkPreview` above the hovered row; pointer only). Passing both
 *  draws the stop twice. WHAT THE HOST MUST DO: open it from `onFind(rect)`, close it on
 *  `onClose` (esc, a pick, an outside mousedown — the anchor itself is NOT outside — or the ✕),
 *  pass the same `open` to the strip as `finderOpen`, and bind the J shortcut itself. */
export interface StopFinderProps {
  /** the walk's stops, in order — what the query narrows and the outline groups by territory */
  steps: StopFinderStep[]
  /** the lecture's record — drawn `current`; stops before it `done` unless `covered` says otherwise */
  activeStop: number
  /** the roaming stop, if any — its row carries a "roaming" cap and is the initial selection */
  roamingStop?: number | null
  /** flagged stop indices */
  flags?: number[]
  /** the host's list of presented stops, as on `PresenterStrip` — decides `done` vs `ahead` */
  covered?: number[]
  /** the host owns this; default `true` */
  open?: boolean
  /** the find button's `getBoundingClientRect()` — pass the WHOLE rect (`top`/`right` let a mousedown
   *  on the button count as inside, so it can toggle); omitted, the panel renders in flow */
  anchor?: { left: number; bottom: number; top?: number; right?: number }
  /** a stop was chosen — typically `setRoamingStop(index)` */
  onPick?: (index: number) => void
  /** esc, a pick, a click outside, or the panel's ✕ — the host sets `open` false. Omitted, no ✕ draws. */
  onClose?: () => void
  /** the input's placeholder and aria-label. Default "find a stop" */
  placeholder?: string
  /** focus the input when it opens. Default `true` */
  autoFocus?: boolean
  /** the hover preview's content — `WalkPreview` above the hovered row. Omitted, a native `title` */
  renderPreview?: (step: StopFinderStep, index: number) => ReactNode
  /** the right-hand column's content for the selected stop (`null` = none selected). Given, the panel
   *  is `width + asideWidth` wide. THE PRESENTER PASSES THIS — the map aside is the default */
  renderAside?: (index: number | null) => ReactNode
  /** the hovered stop, `null` on leave — for a host lighting the same stop elsewhere */
  onStepHover?: (index: number | null) => void
}

export function StopFinder({ steps = [], activeStop = 0, roamingStop = null, flags = [], covered, open = true, anchor, onPick, onClose, placeholder = 'find a stop', autoFocus = true, renderPreview, renderAside, onStepHover }: StopFinderProps) {
  const M = STOP_FINDER_METRICS
  const [query, setQuery] = useState('')
  const matches = useMemo(() => filterStops(steps, query), [steps, query])
  /* the selection starts on the shown stop when nothing is typed (so ↵ with no query is a no-op
     you can see), and on the first match once there is a query */
  const shown = roamingStop != null ? roamingStop : activeStop
  const [sel, setSel] = useState(shown)
  /* the hover preview's anchor — set by the pointer only, never by the keyboard (a card needs a
     pointer under it; see `WalkPreview` rule 3) */
  const [hover, setHover] = useState<{ i: number; x: number; top: number } | null>(null)
  const select = (i: number, el?: HTMLElement) => {
    setSel(i)
    if (onStepHover) onStepHover(i)
    if (el && renderPreview) setHover({ i, ...previewAnchor(el.getBoundingClientRect()) })
  }
  const leave = () => { setHover(null); if (onStepHover) onStepHover(null) }
  /* a typed query moves the selection to its first match; clearing it returns to the shown stop.
     The query's own change handler does it, so nothing is set from inside an effect. */
  const changeQuery = (q: string) => {
    setQuery(q)
    const next = filterStops(steps, q)
    setSel(q.trim() ? (next.length ? next[0] : -1) : shown)
    setHover(null)
  }
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { if (open && autoFocus && inputRef.current) inputRef.current.focus() }, [open, autoFocus])
  /* keep the keyboard selection in view without `scrollIntoView` (which can scroll the host page) */
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>('[data-stop-finder-row="' + sel + '"]')
    if (!row) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [sel])
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open || !anchor || !onClose) return
    /* a mousedown on the ANCHOR itself is not "outside": the strip's magnifier is a toggle, and if
       this closed on its mousedown the click that followed would find the finder shut and reopen it */
    const onAnchor = (e: MouseEvent) => anchor.top != null && anchor.right != null && e.clientX >= anchor.left && e.clientX <= anchor.right && e.clientY >= anchor.top && e.clientY <= anchor.bottom
    const away = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node) && !onAnchor(e)) onClose() }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, anchor, onClose])
  /* the room below the anchor is read at render; a window resized while the finder is open
     re-renders so the ceiling follows */
  const [, bump] = useState(0)
  useEffect(() => {
    if (!open || !anchor || typeof window === 'undefined') return
    const onResize = () => bump((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, anchor])
  /* the close ✕ keeps a pane header's manners: absent at rest, present while the pointer or the
     keyboard is inside the panel (the input has focus on open, so it shows from the first frame) */
  const [inside, setInside] = useState(autoFocus)
  if (!open) return null
  const covSet = covered ? new Set(covered) : null
  const stateOf = (i: number): 'done' | 'current' | 'ahead' => (i === activeStop ? 'current' : (covSet ? covSet.has(i) : i < activeStop) ? 'done' : 'ahead')
  const pick = (i: number) => { if (i < 0) return; if (onPick) onPick(i); if (onClose) onClose() }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); if (onClose) onClose(); return }
    if (e.key === 'Enter') { e.preventDefault(); pick(sel); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!matches.length) return
    const at = matches.indexOf(sel)
    const next = e.key === 'ArrowDown' ? (at < 0 ? 0 : Math.min(matches.length - 1, at + 1)) : (at < 0 ? matches.length - 1 : Math.max(0, at - 1))
    setSel(matches[next])
    setHover(null)
  }
  const grouped = !query.trim()
  const rows: ReactNode[] = []
  let lastTerr: string | null = null
  matches.forEach((i) => {
    const s = steps[i]
    if (grouped && s.territory && s.territory !== lastTerr) {
      lastTerr = s.territory
      rows.push(<div key={'t' + i} style={{ padding: rows.length ? '8px 8px 3px' : '2px 8px 3px', fontFamily: 'var(--font-ui)', fontSize: 9.5, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: s.hue ? 'var(--hue-' + s.hue + '-ink)' : 'var(--text-3)' }}>{s.territory}</div>)
    }
    rows.push(<Row key={i} step={s} index={i} state={stateOf(i)} flagged={flags.indexOf(i) >= 0} roaming={roamingStop === i} selected={sel === i} query={query} showTerritory={!grouped} onPick={pick} onSelect={select} onLeave={leave} renderPreview={renderPreview} />)
  })
  const width = M.width + (renderAside ? M.asideWidth : 0)
  /* THE PANEL FITS THE ROOM BELOW ITS ANCHOR (OB-138 clause 4): a short window ran the 280px list
     off the bottom edge. The room is measured here (viewport bottom, less the panel's top, less an
     8px margin) and the inner column takes it as a ceiling; the list then shrinks under
     `maxListHeight` by ordinary flex. Floor of four rows (`minListHeight`). */
  const room = anchor && typeof window !== 'undefined' ? Math.max(M.minListHeight + 60, window.innerHeight - (anchor.bottom + M.gap) - 8) : undefined
  const list = (
    <div ref={listRef} role="listbox" style={{ flex: 1, minWidth: 0, minHeight: 0, maxHeight: M.maxListHeight, overflowY: 'auto', padding: 4 }}>
      {rows.length ? rows : <div style={{ padding: '14px 8px', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontStyle: 'italic' }}>no stop matches "{query.trim()}"</div>}
    </div>
  )
  const panel = (
    <div ref={panelRef} role="dialog" aria-label="find a stop" data-stop-finder onKeyDown={onKey}
      onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)} onFocus={() => setInside(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInside(false) }} style={{
      ...(anchor ? { position: 'fixed' as const, top: anchor.bottom + M.gap, left: Math.max(8, Math.min(anchor.left, (typeof window !== 'undefined' ? window.innerWidth : 1e9) - width - 8)), zIndex: 60 } : { position: 'relative' as const }),
      width, boxSizing: 'border-box',
      background: 'var(--surface-raised)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)',
    }}>
      {/* THE CLOSE SITS ON THE TOP-RIGHT BORDER, the way a pane's does. A pane masks its border with
          the DESK colour; a popover floats over panes it cannot name, so the mask here is a 1px strip
          of the panel's own face over the border LINE only. Revealed while the pointer or the keyboard
          is inside, absent at rest, like the pane's. */}
      {onClose ? (
        <span style={{ position: 'absolute', top: -9, right: 10, zIndex: 3, display: 'inline-flex', opacity: inside ? 1 : 0, pointerEvents: inside ? 'auto' : 'none', transition: 'opacity var(--dur-hover) var(--ease-soft)' }}>
          <span style={{ position: 'absolute', left: -3, right: -3, top: 8, height: 1, background: 'var(--surface-raised)' }} />
          <IconButton title="close" label="close the finder" onClick={onClose} reveal={inside} style={{ position: 'relative', zIndex: 1 }} />
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: room }}>
        {/* THE QUERY IS THE SYSTEM'S TEXT BOX — `TextInput`, the filter's recipe, with the magnifier
            drawn inside its left end and the house ✕ to clear */}
        <div style={{ padding: onClose ? '14px 8px 8px' : 8, borderBottom: '1px solid var(--border-hair)', flexShrink: 0 }}>
          <TextInput value={query} onChange={changeQuery} placeholder={placeholder} leading={<FindMark size={12} />} size="md" inputRef={inputRef} />
        </div>
        {renderAside ? (
          <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
            {list}
            <div style={{ width: M.asideWidth, flexShrink: 0, borderLeft: '1px solid var(--border-hair)', maxHeight: M.maxListHeight, minHeight: 0, overflow: 'hidden', position: 'relative' }}>{renderAside(sel >= 0 ? sel : null)}</div>
          </div>
        ) : list}
      </div>
    </div>
  )
  const preview = hover && renderPreview && steps[hover.i] ? <WalkPreview x={hover.x} top={hover.top}>{renderPreview(steps[hover.i], hover.i)}</WalkPreview> : null
  const out = <>{panel}{preview}</>
  return anchor && typeof document !== 'undefined' ? portalInto(document.body, out) : out
}
