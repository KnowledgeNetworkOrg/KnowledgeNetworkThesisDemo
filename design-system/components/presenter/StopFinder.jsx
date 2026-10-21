import React from 'react'
import { scrollerPadRight } from '../chrome/Pane.jsx'
import { StepDot } from '../nav/StepDot.jsx'
import { FlagMark } from '../chrome/FlagMark.jsx'
import { FindMark } from '../chrome/FindMark.jsx'
import { TextInput, MatchTitle } from '../chrome/TextInput.jsx'
import { IconButton } from '../chrome/IconButton.jsx'
import { WalkPreview, previewAnchor } from '../nav/WalkPreview.jsx'
import { portalInto } from '../chrome/portal.js'

/** The finder's numbers. `width` and `maxListHeight` are CHOSEN (the picker's menu is 280 tall for
 *  the same reason: about nine rows before you would rather type). `asideWidth` is the map slot's
 *  column when a host gives `renderAside`. `gap` is the drop below the anchor; `row` is derived
 *  from the 16px dot plus 6px above and below. `minListHeight` is four rows — the least the list
 *  shrinks to when the window is short (CHOSEN: fewer and the finder reads as broken). */
export const STOP_FINDER_METRICS = { width: 320, asideWidth: 220, maxListHeight: 280, minListHeight: 112, gap: 6, row: 28, dot: 16 }

/** WHICH STOPS A QUERY KEEPS, in walk order. Case-insensitive substring on the title or the
 *  territory; a query that is only digits also matches that stop NUMBER exactly ("43" → stop 43),
 *  because the strip's pill and the header both speak in numbers. Empty query keeps every stop. */
export function filterStops(steps, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return steps.map((_, i) => i)
  const asNumber = /^\d+$/.test(q) ? parseInt(q, 10) - 1 : -1
  const out = []
  steps.forEach((s, i) => {
    if (i === asNumber || (s.title || '').toLowerCase().indexOf(q) >= 0 || (s.territory || '').toLowerCase().indexOf(q) >= 0) out.push(i)
  })
  return out
}

/* THE MATCHED RUN IS `MatchTitle`'s HIGHLIGHTER (2026-10-01), the same mark as the Explorer tree and
   `NodePicker`'s menu. It used to be bold here, which vanished on the CURRENT stop's row — already
   semibold, in walk ink — exactly the bold-on-bold fault the Explorer hit. No `cut`: the row's one
   ellipsis spans title and territory together, and the row already carries the full title. */

function Row({ step, index, state, flagged, roaming, selected, query, showTerritory, onPick, onSelect, onLeave, renderPreview }) {
  const M = STOP_FINDER_METRICS
  return (
    <div role="option" aria-selected={selected} data-stop-finder-row={index} onClick={() => onPick(index)}
      onMouseEnter={(e) => onSelect(index, e.currentTarget)} onMouseLeave={onLeave}
      title={renderPreview ? undefined : step.title}
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: M.row, padding: '0 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selected ? 'var(--surface-hover)' : 'transparent', /* a tracked highlight is instant both ways — see --transition-wash-tracking */ transition: 'var(--transition-wash-tracking)' }}>
      <StepDot n={index + 1} size={M.dot} state={state} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: state === 'current' ? 'var(--text-walk)' : 'var(--text-1)', fontWeight: state === 'current' ? 'var(--fw-semibold)' : 'var(--fw-regular)' }}>
        <MatchTitle text={step.title} match={query} />
        {showTerritory && step.territory ? <span style={{ color: 'var(--text-3)', fontWeight: 'var(--fw-regular)' }}> · <MatchTitle text={step.territory} match={query} /></span> : null}
      </span>
      {roaming ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)', flexShrink: 0 }}>roaming</span> : null}
      {flagged ? <FlagMark size={10} filled style={{ color: 'var(--acorn-600)', flexShrink: 0 }} /> : null}
    </div>
  )
}

/** The stop finder — part 8 of the presenter-mode split. A popover under the strip's find button:
 *  type, the walk narrows, ↑↓ pick, ↵ roams there. It NEVER moves the active node: picking fires
 *  `onPick(index)` and the host does what a click on a tick does (start roaming there). Committing
 *  is still the hold on the strip's ring, so the finder cannot skip the one deliberate gesture.
 *
 *  NO QUERY SHOWS THE WHOLE WALK grouped under its territories, so it doubles as an outline when
 *  the professor cannot remember the name. A query flattens to matches in walk order, each row
 *  carrying its territory because the group heading is gone.
 *
 *  ANCHORED OR IN FLOW. With `anchor` (the find button's rect, what `PresenterStrip.onFind`
 *  hands over) it is `position: fixed`, portaled into `document.body` like `NodePicker`'s menu,
 *  hung `gap` below the anchor's bottom-left and kept inside the viewport. Without `anchor` it
 *  renders where it is — a host with its own overlay layer, or a specimen.
 *
 *  TWO WAYS TO SHOW THE HOVERED STOP, both the host's content: `renderPreview` opens `WalkPreview`
 *  above the hovered row (the same card every walk surface shows); `renderAside` adds a column to
 *  the right, `asideWidth` wide, redrawn for the hovered or keyboard-selected stop — the place for
 *  a small territory map. Pointer hover and keyboard selection are ONE selection here. */
export function StopFinder({ steps = [], activeStop = 0, roamingStop = null, flags = [], covered, open = true, anchor, onPick, onClose, placeholder = 'find a stop', autoFocus = true, renderPreview, renderAside, onStepHover, flat = false }) {
  const M = STOP_FINDER_METRICS
  const [query, setQuery] = React.useState('')
  const matches = React.useMemo(() => filterStops(steps, query), [steps, query])
  /* the selection starts on the shown stop when nothing is typed (so ↵ with no query is a no-op
     you can see), and on the first match once there is a query */
  const shown = roamingStop != null ? roamingStop : activeStop
  const [sel, setSel] = React.useState(shown)
  /* the hover preview's anchor — set by the pointer only, never by the keyboard (a card needs a
     pointer under it; see `WalkPreview` rule 3) */
  const [hover, setHover] = React.useState(null)
  const select = (i, el) => {
    setSel(i)
    if (onStepHover) onStepHover(i)
    if (el && renderPreview) setHover({ i, ...previewAnchor(el.getBoundingClientRect()) })
  }
  const leave = () => { setHover(null); if (onStepHover) onStepHover(null) }
  React.useEffect(() => { setSel(query.trim() ? (matches.length ? matches[0] : -1) : shown); setHover(null) }, [query])
  const inputRef = React.useRef(null)
  const listRef = React.useRef(null)
  React.useEffect(() => { if (open && autoFocus && inputRef.current) inputRef.current.focus() }, [open])
  /* keep the keyboard selection in view without `scrollIntoView` (which can scroll the host page) */
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector('[data-stop-finder-row="' + sel + '"]')
    if (!row) return
    const top = row.offsetTop, bottom = top + row.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [sel])
  React.useEffect(() => {
    if (!open || !anchor || !onClose) return
    /* a mousedown on the ANCHOR itself is not "outside": the strip's magnifier is a toggle, and if
       this closed on its mousedown the click that followed would find the finder shut and reopen it */
    const onAnchor = (e) => anchor.top != null && anchor.right != null && e.clientX >= anchor.left && e.clientX <= anchor.right && e.clientY >= anchor.top && e.clientY <= anchor.bottom
    const away = (e) => { if (panelRef.current && !panelRef.current.contains(e.target) && !onAnchor(e)) onClose() }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, anchor])
  /* the room below the anchor is read at render; a window resized while the finder is open
     re-renders so the ceiling follows */
  const [, bump] = React.useState(0)
  React.useEffect(() => {
    if (!open || !anchor || typeof window === 'undefined') return
    const onResize = () => bump((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, anchor])
  const panelRef = React.useRef(null)
  /* the close ✕ keeps a pane header's manners: absent at rest, present while the pointer or the
     keyboard is inside the panel (the input has focus on open, so it shows from the first frame) */
  const [inside, setInside] = React.useState(autoFocus)
  if (!open) return null
  const covSet = covered ? new Set(covered) : null
  const stateOf = (i) => (i === activeStop ? 'current' : (covSet ? covSet.has(i) : i < activeStop) ? 'done' : 'ahead')
  const pick = (i) => { if (i < 0) return; if (onPick) onPick(i); if (onClose) onClose() }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose && onClose(); return }
    if (e.key === 'Enter') { e.preventDefault(); pick(sel); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!matches.length) return
    const at = matches.indexOf(sel)
    const next = e.key === 'ArrowDown' ? (at < 0 ? 0 : Math.min(matches.length - 1, at + 1)) : (at < 0 ? matches.length - 1 : Math.max(0, at - 1))
    setSel(matches[next]); setHover(null)
  }
  const grouped = !query.trim()
  /* THE COUNT, under the query box once there is a query (2026-10-01, as the Explorer filter and
     `NodePicker`): "7 matches", then "3 of 7 matches" — the selected row's place among them. The
     selection starts ON the first match, so a query reads "1 of N" from the first keystroke. */
  const selAt = matches.indexOf(sel)
  const countText = grouped || !matches.length ? '' : selAt >= 0 ? (selAt + 1) + ' of ' + matches.length + ' matches' : matches.length + (matches.length === 1 ? ' match' : ' matches')
  const rows = []
  let lastTerr = null
  matches.forEach((i) => {
    const s = steps[i]
    if (grouped && s.territory && s.territory !== lastTerr) {
      lastTerr = s.territory
      rows.push(<div key={'t' + i} style={{ padding: rows.length ? '8px 8px 3px' : '2px 8px 3px', fontFamily: 'var(--font-ui)', fontSize: 9.5, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: s.hue ? 'var(--hue-' + s.hue + '-ink)' : 'var(--text-3)' }}>{s.territory}</div>)
    }
    rows.push(<Row key={i} step={s} index={i} state={stateOf(i)} flagged={flags.indexOf(i) >= 0} roaming={roamingStop === i} selected={sel === i} query={query} showTerritory={!grouped} onPick={pick} onSelect={select} onLeave={leave} renderPreview={renderPreview} />)
  })
  const width = M.width + (renderAside ? M.asideWidth : 0)
  /* THE PANEL FITS THE ROOM BELOW ITS ANCHOR. Anchored, it is `position: fixed` under the
     magnifier, and a short window (owner, 2026-09-04: a laptop with the taskbar up) ran the 280px
     list off the bottom edge — the last rows and the scrollbar's end were cut. The room is measured
     here (viewport bottom, less the panel's top, less an 8px margin — the same margin the left edge
     keeps) and the inner column takes it as a ceiling; the list then shrinks under `maxListHeight`
     by ordinary flex, and the aside shrinks with it. Floor of four rows (`minListHeight`): below
     that the finder is clipped rather than useless, and a window that short has other problems. */
  const room = anchor && typeof window !== 'undefined' ? Math.max(M.minListHeight + 60, window.innerHeight - (anchor.bottom + M.gap) - 8) : undefined
  /* FLAT (2026-10-01, owner's pick, for `PresentStartCard`): the finder sits IN another surface
     that already frames it — no border, shadow, face or ✕, the full width it is given, and the
     list does not scroll on its own (the host scrolls; two nested scrollers fight the wheel).
     `onClose` still fires on Escape. Ignored with `anchor`: a floating finder needs its frame. */
  const isFlat = flat && !anchor
  const list = (
    <div ref={listRef} style={isFlat ? { flex: 1, minWidth: 0, padding: '4px 0 0' } : { flex: 1, minWidth: 0, minHeight: 0, maxHeight: M.maxListHeight, overflowY: 'auto', padding: 4, paddingRight: 4 + scrollerPadRight() }}>
      {rows.length ? rows : <div style={{ padding: '14px 8px', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontStyle: 'italic' }}>no stop matches "{query.trim()}"</div>}
    </div>
  )
  const panel = (
    <div ref={panelRef} role="dialog" aria-label="find a stop" onKeyDown={onKey}
      onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)} onFocus={() => setInside(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInside(false) }} style={{
      ...(anchor ? { position: 'fixed', top: anchor.bottom + M.gap, left: Math.max(8, Math.min(anchor.left, (typeof window !== 'undefined' ? window.innerWidth : 1e9) - width - 8)), zIndex: 60 } : { position: 'relative' }),
      width: isFlat ? '100%' : width, boxSizing: 'border-box',
      ...(isFlat ? {} : { background: 'var(--surface-raised)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)' }),
    }}>
      {/* THE CLOSE SITS ON THE TOP-RIGHT BORDER, the way a pane's does. A pane masks its border with
          the DESK colour (`PaneHeader` legend); a popover floats over panes it cannot name, so the
          mask here is a 1px strip of the panel's own face over the border LINE only — the button
          itself is transparent, as the pane's is, and floats over whatever is behind. Revealed while
          the pointer or the keyboard is inside, absent at rest, like the pane's. The query box below
          starts under the button's lower edge (`padTop` 14 > 9), so the two never touch. */}
      {onClose && !isFlat ? (
        <span style={{ position: 'absolute', top: -9, right: 10, zIndex: 3, display: 'inline-flex', opacity: inside ? 1 : 0, pointerEvents: inside ? 'auto' : 'none', transition: 'opacity var(--dur-hover) var(--ease-soft)' }}>
          <span style={{ position: 'absolute', left: -3, right: -3, top: 8, height: 1, background: 'var(--surface-raised)' }} />
          <IconButton title="close" label="close" onClick={onClose} reveal={inside} style={{ position: 'relative', zIndex: 1 }} />
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: room }}>
      {/* THE QUERY IS THE SYSTEM'S TEXT BOX — `TextInput`, the filter's recipe, with the magnifier
          drawn inside its left end and the house ✕ to clear */}
      <div style={{ padding: isFlat ? '0 0 8px' : onClose ? '14px 8px 8px' : 8, borderBottom: '1px solid var(--border-hair)', flexShrink: 0 }}>
        <TextInput value={query} onChange={setQuery} placeholder={placeholder} leading={<FindMark size={12} />} size="md" inputRef={inputRef} />
        {countText ? <div aria-live="polite" style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', padding: '4px 2px 0' }}>{countText}</div> : null}
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
  const out = <React.Fragment>{panel}{preview}</React.Fragment>
  return anchor && typeof document !== 'undefined' ? portalInto(document.body, out) : out
}
