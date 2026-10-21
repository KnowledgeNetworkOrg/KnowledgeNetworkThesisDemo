import React from 'react'
import { Caret } from './TreeRow.jsx'
import { StopFinder } from '../presenter/StopFinder.jsx'

/** `indent` 20 is CHOSEN: one level in, enough that a walk reads as inside its map and a stop
 *  list as inside its walk, little enough that three levels fit the start card's 400px column. */
export const LOAD_PICKER_METRICS = { indent: 20, row: 40 }

/** ONE ROW: a map or a walk. The caret is the system's disclosure mark when the row opens
 *  something. `note` is the grey count at the right.
 *
 *  ONE BLUE ROW AT MOST, AND IT IS THE SELECTION (owner, 2026-10-01: an unfolded map and the walk
 *  inside it were the same colour, and read as two selections). `selected` wears the walk wash;
 *  an unfolded row that is not selected takes the strong outline and a dark caret; pointing is
 *  the neutral hover. */
function PickRow({ title, note, caret, open, selected, level, onClick, onDoubleClick, onPoint }) {
  const [hot, setHot] = React.useState(false)
  const map = level === 0
  const blue = !!selected
  const enter = () => { setHot(true); onPoint && onPoint(true) }
  const leave = () => { setHot(false); onPoint && onPoint(false) }
  return (
    <button type="button" aria-expanded={caret ? !!open : undefined} aria-pressed={selected != null ? !!selected : undefined} onClick={onClick} onDoubleClick={onDoubleClick}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: LOAD_PICKER_METRICS.row, padding: '6px 12px', boxSizing: 'border-box', textAlign: 'left',
        border: '1px solid ' + (blue ? 'var(--border-walk)' : open || hot ? 'var(--border-strong)' : 'var(--border-hair)'), borderRadius: 'var(--radius-md)',
        background: blue ? 'var(--accent-walk-wash)' : hot ? 'var(--surface-hover-raised)' : 'var(--surface-raised)', cursor: 'pointer', transition: 'var(--transition-wash)', fontFamily: 'var(--font-ui)' }}>
      {caret ? <span aria-hidden="true" style={{ flexShrink: 0, width: 12, display: 'grid', placeItems: 'center', color: open ? 'var(--text-1)' : hot ? 'var(--text-2)' : 'var(--text-3)' }}><Caret open={!!open} /></span> : null}
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-body)', fontWeight: map ? 'var(--fw-bold)' : 'var(--fw-semibold)', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      {note ? <span style={{ flexShrink: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)' }}>{note}</span> : null}
    </button>
  )
}

const openFirst = (list, id) => [...(list || [])].sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0))
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many)

const same = (a, b) => !!a && !!b && a.mapId === b.mapId && (a.walkId == null ? b.walkId == null : a.walkId === b.walkId)

/**
 * WHAT TO LOAD, at one of two depths, each ONE decision deep (owner, 2026-10-01: choosing a map,
 * then a walk, then a stop in one list was confusing):
 *   - the TOOLBAR's Load: a map, then a walk on it. Never a stop.
 *   - the PRESENTER's (`withStops`): a walk on the map already open, then a stop. Never a map.
 *
 * Toolbar: maps are the top level and a map opens its walks beneath it. Presenter: the open map's
 * walks are the top level and a walk opens its stops beneath it in a flat `StopFinder`. One open
 * at a time; the open map and walk are listed first, with NO "open" note (owner, 2026-10-01:
 * the word read as a label nobody could place). The toolbar draws the map level even for ONE map,
 * unfolded, so the map itself can be selected.
 *
 * Without `withStops` (the toolbar) A CLICK SELECTS, it does not load (owner, 2026-10-01: "select
 * what you want and have a load button"). A map or a walk can be selected; selecting a map unfolds
 * it, and clicking the selected map again folds it. Selecting the map itself is how the map is
 * loaded with no walk, so there is no "Just the map" row. `onSelect(choice)` reports it;
 * `LoadDialog`'s Load button acts on it. A double-click is `onPick` at once, the shortcut.
 * With `withStops` (presenting) nothing is selected: a stop pick is `onPick` at once, as before.
 *
 * It loads nothing itself: `onPick({ mapId, walkId?, stop? })`, and the host guards unsaved work
 * (`UnsavedWarning`) and navigates.
 *
 * `onPoint(choice | null)` reports the row under the pointer or keyboard focus (a map row as
 * `{ mapId }`, a walk as `{ mapId, walkId }`), and `onOpenMap(id | null)` the map currently
 * unfolded, on mount too — what `LoadDialog`'s preview follows.
 */
export function LoadPicker({ maps = [], openMapId, openWalkId, withStops = false, activeStop, onPick, onSelect, onPoint, onOpenMap, style }) {
  const M = LOAD_PICKER_METRICS
  /* TWO DEPTHS, ONE DECISION EACH (owner, 2026-10-01: map, walk, then stop was confusing). With
     `withStops` the picker is the PRESENTER's: walk then stop on the map already open, so the map
     level is never drawn. Without it, it is the TOOLBAR's: map then walk, never a stop. */
  const shownMaps = withStops ? maps.filter((m) => m.id === openMapId).concat(maps.length === 1 ? maps : []).slice(0, 1) : maps
  /* THE MAP LEVEL: the presenter's depth never draws one (its one map is implied). The toolbar's
     ALWAYS does, even for one map (owner, 2026-10-01: with the row dropped, the Studio's single map
     could not be chosen). One map starts unfolded. */
  const single = withStops
  const [mapOpen, setMapOpen] = React.useState(single ? (shownMaps[0] ? shownMaps[0].id : null) : openMapId != null ? openMapId : maps.length === 1 ? maps[0].id : null)
  const [walkOpen, setWalkOpen] = React.useState(null)
  const [sel, setSel] = React.useState(null)
  React.useEffect(() => { if (onOpenMap) onOpenMap(mapOpen) }, [mapOpen])
  const choose = (c) => { setSel(c); if (onSelect) onSelect(c) }
  /* a row's leave and the next row's enter arrive in that order, so the null in between never paints */
  const point = (c) => (on) => { if (onPoint) onPoint(on ? c : null) }
  /* the finder fires `onClose` after every pick; the pick has already been handed over, so that
     close must not fold the walk shut behind it */
  const pickedRef = React.useRef(false)
  const walksOf = (m) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: single ? 0 : M.indent }}>
      {openFirst(m.walks, openWalkId).map((w) => {
        const n = w.stops ? w.stops.length : 0
        const note = plural(n, 'stop', 'stops')
        const c = { mapId: m.id, walkId: w.id }
        if (!withStops) return <PickRow key={w.id} level={1} title={w.title} note={note} selected={same(sel, c)} onPoint={point(c)} onClick={() => choose(c)} onDoubleClick={() => onPick && onPick(c)} />
        const ex = walkOpen === w.id
        return (
          <React.Fragment key={w.id}>
            <PickRow level={1} title={w.title} note={note} caret open={ex} onClick={() => setWalkOpen((v) => (v === w.id ? null : w.id))} />
            {ex ? (
              <div style={{ padding: '2px 0 6px ' + M.indent + 'px' }}>
                <StopFinder steps={w.stops || []} activeStop={activeStop ? activeStop(w.id, m.id) : -1}
                  placeholder={'find a stop in ' + w.title} autoFocus flat
                  onPick={(i) => { pickedRef.current = true; onPick && onPick({ mapId: m.id, walkId: w.id, stop: i }) }}
                  onClose={() => { if (pickedRef.current) { pickedRef.current = false; return } setWalkOpen(null) }} />
              </div>
            ) : null}
          </React.Fragment>
        )
      })}
    </div>
  )
  return (
    <div role="group" aria-label="load" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      {single ? (shownMaps[0] ? walksOf(shownMaps[0]) : null) : openFirst(shownMaps, openMapId).map((m) => {
        const ex = mapOpen === m.id
        const nw = (m.walks || []).length
        const c = { mapId: m.id }
        const isSel = same(sel, c)
        return (
          <React.Fragment key={m.id}>
            <PickRow level={0} title={m.title} note={plural(nw, 'walk', 'walks')} caret open={ex} selected={isSel} onPoint={point(c)}
              onDoubleClick={() => onPick && onPick(c)}
              onClick={() => { setWalkOpen(null); if (isSel && ex) { setMapOpen(null); return } choose(c); setMapOpen(m.id) }} />
            {ex ? walksOf(m) : null}
          </React.Fragment>
        )
      })}
    </div>
  )
}
