import React from 'react'
import { LoadPicker } from './LoadPicker.jsx'
import { IconButton } from '../chrome/IconButton.jsx'
import { PillButton } from '../chrome/PillButton.jsx'
import { UnsavedWarning, WARNING_DIALOG_METRICS } from '../chrome/WarningDialog.jsx'
import { portalInto } from '../chrome/portal.js'

/** The dialog's numbers, all CHOSEN. `width` 760 holds the 300px list and a preview wide enough
 *  to read a map's shape; `height` 520 shows about eight rows; `list` 300 fits "Foundations of
 *  Computing" beside its "2 walks" note at body size. It shares the warning's `z`, because
 *  the warning REPLACES it rather than stacking on it. `footerPadY` 10 sets the footer strip at about
 *  44px with a `md` pill. */
export const LOAD_DIALOG_METRICS = { width: 760, height: 520, list: 300, pad: 14, footerPadY: 10 }

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many)
const findMap = (maps, id) => (maps || []).find((m) => m.id === id) || null
const findWalk = (map, id) => (map && id != null ? (map.walks || []).find((w) => w.id === id) || null : null)

/** WHAT THE PREVIEW IS SHOWING, in words, under the picture */
function PreviewLine({ map, walk }) {
  if (!map) return null
  const stops = walk && walk.stops ? walk.stops : []
  const line = walk
    ? plural(stops.length, 'stop', 'stops') + (stops.length > 1 ? ' · from “' + stops[0].title + '” to “' + stops[stops.length - 1].title + '”' : '')
    : plural((map.walks || []).length, 'walk', 'walks') + ' · the map alone'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walk ? walk.title : map.title}</div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)', textWrap: 'pretty' }}>{line}</div>
    </div>
  )
}

/** what the preview frame holds when the host draws nothing: a labelled stripe, never a fake map */
function PreviewBlank({ map, walk }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, var(--bark-100) 0 8px, var(--surface-raised) 8px 16px)' }}>
      <span style={{ position: 'absolute', left: 10, top: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
        {map ? (walk ? 'the map, with ' + walk.title + '’s path on it' : 'the map, no walk on it') : 'nothing to preview'}
      </span>
    </div>
  )
}

/**
 * THE TOOLBAR'S LOAD, as a dialog (owner, 2026-10-01; `ideas/toolbar-load-options.html` 00c). A
 * centred card over a scrim: the `LoadPicker` list on the left, a PREVIEW on the right.
 *
 * SELECT, THEN LOAD (owner, 2026-10-01: "select what you want and have a load button"). A click
 * SELECTS a map or a walk; Load, in a footer across the dialog beside Cancel, loads the selection. Selecting a
 * map loads it with no walk, so there is no "Just the map" row. A double-click loads at once.
 * HOVER PREVIEWS: a map row shows the map with NO walk on it, a walk row the map with that walk's
 * path. Nothing pointed at: the selection, else the unfolded map. On touch, a tap selects and
 * previews, and Load loads.
 *
 * UNSAVED WORK: pass `unsaved` (the name of what holds the changes) and a pick does not load; the
 * dialog's card is REPLACED by `UnsavedWarning` on the same scrim. Cancel brings the list back.
 * The answer reaches `onPick(choice, 'save' | 'discard')`; with no `unsaved`, `onPick(choice)`.
 */
export function LoadDialog({ open = true, maps = [], openMapId, openWalkId, onPick, onClose, preview, unsaved, inline = false, style }) {
  const M = LOAD_DIALOG_METRICS
  const [pointed, setPointed] = React.useState(null)
  const [unfolded, setUnfolded] = React.useState(openMapId != null ? openMapId : null)
  const [chosen, setChosen] = React.useState(null)
  const [pending, setPending] = React.useState(null)
  const warnRef = React.useRef(null)
  const cardRef = React.useRef(null)
  /* MODAL MANNERS, as the warning has them: focus moves INTO the dialog when it opens (so Escape
     works at once, without a click first), Tab stays inside, and focus goes back where it came
     from when it closes. Inline (a specimen) moves nothing. */
  React.useEffect(() => {
    if (!open || inline || typeof document === 'undefined') return undefined
    const back = document.activeElement
    const c = cardRef.current
    if (c) c.focus()
    return () => { if (back && back.focus) back.focus() }
  }, [open])
  React.useEffect(() => { if (!open) { setPending(null); setPointed(null); setChosen(null) } }, [open])
  /* the warning is drawn `inline` inside this dialog, which skips its own focus move: do it here,
     so Enter still takes the default ("Save and load") */
  React.useEffect(() => {
    if (!pending || !warnRef.current) return
    const b = warnRef.current.querySelector('[data-warning-default] button') || warnRef.current.querySelector('button')
    if (b) b.focus()
  }, [pending])
  if (!open) return null

  const target = pointed || chosen || (unfolded != null ? { mapId: unfolded } : openMapId != null ? { mapId: openMapId } : null)
  const tMap = target ? findMap(maps, target.mapId) : null
  const tWalk = tMap ? findWalk(tMap, target.walkId) : null
  const pick = (c) => { if (unsaved) setPending(c); else onPick && onPick(c) }
  const nameOf = (c) => { const m = findMap(maps, c.mapId); const w = findWalk(m, c.walkId); return w ? w.title : m ? m.title : '' }
  const onKey = (e) => {
    if (e.key === 'Escape' && !pending) { e.preventDefault(); e.stopPropagation(); onClose && onClose(); return }
    if (e.key !== 'Tab' || inline || !cardRef.current) return
    const bs = Array.from(cardRef.current.querySelectorAll('button:not([disabled])'))
    if (!bs.length) return
    const i = bs.indexOf(document.activeElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); bs[bs.length - 1].focus() }
    else if (!e.shiftKey && i === bs.length - 1) { e.preventDefault(); bs[0].focus() }
  }

  const card = (
    <div ref={cardRef} tabIndex={-1} role="dialog" aria-modal={inline ? undefined : true} aria-label="Load a map" onKeyDown={onKey} onClick={(e) => e.stopPropagation()}
      style={{ width: M.width, maxWidth: 'calc(100vw - 32px)', height: M.height, maxHeight: 'calc(100vh - 32px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--lift-3)', fontFamily: 'var(--font-ui)', overflow: 'hidden', outline: 'none', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: M.pad + 'px ' + M.pad + 'px 10px', borderBottom: '1px solid var(--border-hair)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* THE TITLE SAYS WHAT THE LIST STARTS AS (owner, 2026-10-01): maps, always — the picker
             draws the map level even for one map */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)' }}>Load a map</div>
          <div style={{ marginTop: 2, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>
            Choose a map, or a walk on it, then press Load.
          </div>
        </div>
        {onClose ? <IconButton glyph="✕" size={24} glyphSize={11} title="close" label="close" onClick={onClose} /> : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: M.list + 'px minmax(0, 1fr)' }}>
        <div style={{ minHeight: 0, overflowY: 'auto', padding: M.pad, borderRight: '1px solid var(--border-hair)' }}>
          <LoadPicker maps={maps} openMapId={openMapId} openWalkId={openWalkId} onPick={pick} onSelect={setChosen} onPoint={setPointed} onOpenMap={setUnfolded} />
        </div>
        <div style={{ minWidth: 0, minHeight: 0, padding: M.pad, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div aria-hidden="true" style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hair)', background: 'var(--surface-sunken)' }}>
            {preview && tMap ? preview({ mapId: tMap.id, walkId: tWalk ? tWalk.id : undefined }) : <PreviewBlank map={tMap} walk={tWalk} />}
          </div>
          <PreviewLine map={tMap} walk={tWalk} />
        </div>
      </div>
      {/* THE FOOTER (owner, 2026-10-01, sheet 00d option A): a strip across the whole dialog, Cancel and
         Load together at the right. "Load" is one word (the name made it too long); the preview line
         names what it loads. Off until something is selected. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: M.footerPadY + 'px ' + M.pad + 'px', borderTop: '1px solid var(--border-hair)' }}>
        {onClose ? <PillButton size="md" tone="quiet" onClick={onClose}>Cancel</PillButton> : null}
        <PillButton size="md" tone="primary" disabled={!chosen} onClick={() => chosen && pick(chosen)}>Load</PillButton>
      </div>
    </div>
  )
  const warning = pending ? (
    <div ref={warnRef}>
      <UnsavedWarning inline what={unsaved} next={nameOf(pending)}
        onSave={() => { const c = pending; setPending(null); onPick && onPick(c, 'save') }}
        onDiscard={() => { const c = pending; setPending(null); onPick && onPick(c, 'discard') }}
        onCancel={() => setPending(null)} />
    </div>
  ) : null
  /* THE CARD STAYS MOUNTED UNDER THE WARNING, hidden: the picker keeps its selection and unfolded
     map in its own state, and an unmount would reset them, so Cancel would bring back a list that
     disagrees with the Load button. */
  /* ONE STABLE TREE: the card's wrapper and position never change, or React remounts it anyway */
  const face = <React.Fragment>{warning}<div style={{ display: warning ? 'none' : 'contents' }}>{card}</div></React.Fragment>
  if (inline) return face
  const scrim = (
    <div onClick={() => { if (pending) setPending(null); else if (onClose) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: WARNING_DIALOG_METRICS.z, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>{face}</div>
  )
  return typeof document !== 'undefined' ? portalInto(document.body, scrim) : scrim
}
