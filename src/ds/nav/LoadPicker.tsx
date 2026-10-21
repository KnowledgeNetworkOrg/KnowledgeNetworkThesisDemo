import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { StopFinder } from '../presenter/StopFinder'
import type { StopFinderStep } from '../presenter/StopFinder'
import { Caret } from './TreeRow'

/** `indent` 20 (one level in) and `row` 40, both chosen. */
export const LOAD_PICKER_METRICS = { indent: 20, row: 40 }

export interface LoadMap {
  id: string | number
  title: string
  walks: Array<{
    id: string | number
    title: string
    /** `StopFinder` steps; only read with `withStops`, but the count is shown either way */
    stops?: Array<{ title: string; territory?: string; hue?: string; address?: string }>
  }>
}

/** what was picked. `walkId` absent = the map alone (the map row selected); `stop` only with `withStops` */
export interface LoadChoice {
  mapId: string | number
  walkId?: string | number
  stop?: number
}

export interface LoadPickerProps {
  maps: LoadMap[]
  /** the map open in the app */
  openMapId?: string | number | null
  /** the walk open in the app */
  openWalkId?: string | number | null
  /** draw each walk's stops and require one. Default `false` */
  withStops?: boolean
  /** with `withStops`: `(walkId, mapId)` → the stop to mark `current` in that walk, or -1 */
  activeStop?: (walkId: string | number, mapId: string | number) => number
  /** the toolbar's depth: a double-click on a row. With `withStops`: a stop pick */
  onPick?: (choice: LoadChoice) => void
  /** the toolbar's depth only: a click SELECTS a map or a walk and reports it here; the host's Load
   *  button acts on it (`LoadDialog`). Selecting a map is loading it with no walk */
  onSelect?: (choice: LoadChoice) => void
  /** the row under the pointer or keyboard focus, or null when it leaves */
  onPoint?: (choice: LoadChoice | null) => void
  /** the map currently unfolded (null when none), fired on mount and on every change */
  onOpenMap?: (mapId: string | number | null) => void
  /** @deprecated the "Just the map" row is gone: selecting the map row is how a map loads no walk */
  mapOnlyLabel?: string
  style?: CSSProperties
}

interface PickRowProps {
  title: string
  note: string
  caret?: boolean
  open?: boolean
  selected?: boolean
  level: number
  onClick: () => void
  onDoubleClick?: () => void
  onPoint?: (on: boolean) => void
}

/** One row: a map or a walk. The caret is the disclosure mark when the row opens
 *  something. One blue row at most, and it is the selection; an unfolded row that
 *  is not selected takes the strong outline. */
function PickRow({ title, note, caret, open, selected, level, onClick, onDoubleClick, onPoint }: PickRowProps) {
  const [hot, setHot] = useState(false)
  const map = level === 0
  const blue = !!selected
  const enter = () => { setHot(true); if (onPoint) onPoint(true) }
  const leave = () => { setHot(false); if (onPoint) onPoint(false) }
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

const openFirst = <T extends { id: string | number }>(list: T[], id?: string | number | null): T[] => [...(list || [])].sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0))
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)

const same = (a: LoadChoice | null, b: LoadChoice) => !!a && !!b && a.mapId === b.mapId && (a.walkId == null ? b.walkId == null : a.walkId === b.walkId)

/** What to load, at one of two depths, each one decision deep. The toolbar's
 *  depth draws maps, each opening its walks; a click selects and `LoadDialog`'s
 *  Load acts on the selection, while a double-click picks at once. The presenter's
 *  depth (`withStops`) draws the open map's walks and their stops. */
export function LoadPicker({ maps = [], openMapId, openWalkId, withStops = false, activeStop, onPick, onSelect, onPoint, onOpenMap, style }: LoadPickerProps) {
  const M = LOAD_PICKER_METRICS
  const shownMaps = withStops ? maps.filter((m) => m.id === openMapId).concat(maps.length === 1 ? maps : []).slice(0, 1) : maps
  /* The toolbar's depth always draws the map level, even for one map; one map
     starts unfolded. The presenter's depth never draws one. */
  const single = withStops
  const [mapOpen, setMapOpen] = useState<string | number | null>(single ? (shownMaps[0] ? shownMaps[0].id : null) : openMapId != null ? openMapId : maps.length === 1 ? maps[0].id : null)
  const [walkOpen, setWalkOpen] = useState<string | number | null>(null)
  const [sel, setSel] = useState<LoadChoice | null>(null)
  useEffect(() => { if (onOpenMap) onOpenMap(mapOpen) }, [mapOpen, onOpenMap])
  const choose = (c: LoadChoice) => { setSel(c); if (onSelect) onSelect(c) }
  /* a row's leave and the next row's enter arrive in that order, so the null in between never paints */
  const point = (c: LoadChoice) => (on: boolean) => { if (onPoint) onPoint(on ? c : null) }
  /* the finder fires `onClose` after every pick; the pick has already been handed over, so that
     close must not fold the walk shut behind it */
  const pickedRef = useRef(false)
  const walksOf = (m: LoadMap) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: single ? 0 : M.indent }}>
      {openFirst(m.walks || [], openWalkId).map((w) => {
        const n = w.stops ? w.stops.length : 0
        const note = plural(n, 'stop', 'stops')
        const c: LoadChoice = { mapId: m.id, walkId: w.id }
        if (!withStops) return <PickRow key={w.id} level={1} title={w.title} note={note} selected={same(sel, c)} onPoint={point(c)} onClick={() => choose(c)} onDoubleClick={() => onPick && onPick(c)} />
        const ex = walkOpen === w.id
        return (
          <Fragment key={w.id}>
            <PickRow level={1} title={w.title} note={note} caret open={ex} onClick={() => setWalkOpen((v) => (v === w.id ? null : w.id))} />
            {ex ? (
              <div style={{ padding: '2px 0 6px ' + M.indent + 'px' }}>
                <StopFinder steps={(w.stops || []) as StopFinderStep[]} activeStop={activeStop ? activeStop(w.id, m.id) : -1}
                  placeholder={'find a stop in ' + w.title} autoFocus flat
                  onPick={(i) => { pickedRef.current = true; if (onPick) onPick({ mapId: m.id, walkId: w.id, stop: i }) }}
                  onClose={() => { if (pickedRef.current) { pickedRef.current = false; return } setWalkOpen(null) }} />
              </div>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
  return (
    <div role="group" aria-label="load" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      {single ? (shownMaps[0] ? walksOf(shownMaps[0]) : null) : openFirst(shownMaps, openMapId).map((m) => {
        const ex = mapOpen === m.id
        const nw = (m.walks || []).length
        const c: LoadChoice = { mapId: m.id }
        const isSel = same(sel, c)
        return (
          <Fragment key={m.id}>
            <PickRow level={0} title={m.title} note={plural(nw, 'walk', 'walks')} caret open={ex} selected={isSel} onPoint={point(c)}
              onDoubleClick={() => onPick && onPick(c)}
              onClick={() => { setWalkOpen(null); if (isSel && ex) { setMapOpen(null); return } choose(c); setMapOpen(m.id) }} />
            {ex ? walksOf(m) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
