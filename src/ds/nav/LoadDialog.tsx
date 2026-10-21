import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import { IconButton } from '../chrome/IconButton'
import { PillButton } from '../chrome/PillButton'
import { portalInto } from '../chrome/portal'
import { UnsavedWarning, WARNING_DIALOG_METRICS } from '../chrome/WarningDialog'
import { LoadPicker } from './LoadPicker'
import type { LoadChoice, LoadMap } from './LoadPicker'

/** width 760, height 520, list 300, pad 14, footerPadY 10 — all chosen; z is the warning's. */
export const LOAD_DIALOG_METRICS = { width: 760, height: 520, list: 300, pad: 14, footerPadY: 10 }

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)
const findMap = (maps: LoadMap[], id: string | number) => (maps || []).find((m) => m.id === id) || null
const findWalk = (map: LoadMap | null, id?: string | number) => (map && id != null ? (map.walks || []).find((w) => w.id === id) || null : null)

/** What the preview is showing, in words, under the picture. */
function PreviewLine({ map, walk }: { map: LoadMap | null; walk: LoadMap['walks'][number] | null }) {
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

/** What the preview frame holds when the host draws nothing: a labelled stripe, never a fake map. */
function PreviewBlank({ map, walk }: { map: LoadMap | null; walk: LoadMap['walks'][number] | null }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, var(--bark-100) 0 8px, var(--surface-raised) 8px 16px)' }}>
      <span style={{ position: 'absolute', left: 10, top: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
        {map ? (walk ? 'the map, with ' + walk.title + '’s path on it' : 'the map, no walk on it') : 'nothing to preview'}
      </span>
    </div>
  )
}

export interface LoadDialogProps {
  open?: boolean
  maps: LoadMap[]
  /** the map open in the app */
  openMapId?: string | number | null
  /** the walk open in the app */
  openWalkId?: string | number | null
  /** `how` is 'save' or 'discard' only when `unsaved` was set and the warning was answered */
  onPick?: (choice: LoadChoice, how?: 'save' | 'discard') => void
  /** Escape, the ✕, Cancel in the footer, or a click on the scrim */
  onClose?: () => void
  /** the host's map view for the preview frame; see the host rules above */
  preview?: (target: { mapId: string | number; walkId?: string | number }) => ReactNode
  /** the name of what holds unsaved changes; absent = nothing to guard */
  unsaved?: string
  /** specimen only: draw in place, no scrim, no portal */
  inline?: boolean
  style?: CSSProperties
}

/** The toolbar's Load, as a dialog: the map/walk list on the left and a preview
 *  on the right. A click selects, Load loads the selection, and a double-click
 *  loads at once. Hovering or tabbing to a row previews it. Unsaved work replaces
 *  the card with `UnsavedWarning` on the same scrim. */
export function LoadDialog({ open = true, maps = [], openMapId, openWalkId, onPick, onClose, preview, unsaved, inline = false, style }: LoadDialogProps) {
  const M = LOAD_DIALOG_METRICS
  const [pointed, setPointed] = useState<LoadChoice | null>(null)
  const [unfolded, setUnfolded] = useState<string | number | null>(openMapId != null ? openMapId : null)
  const [chosen, setChosen] = useState<LoadChoice | null>(null)
  const [pending, setPending] = useState<LoadChoice | null>(null)
  const warnRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  /* Modal manners: focus moves into the dialog when it opens, Tab stays inside,
     and focus goes back where it came from when it closes. */
  useEffect(() => {
    if (!open || inline || typeof document === 'undefined') return undefined
    const back = document.activeElement as HTMLElement | null
    const c = cardRef.current
    if (c) c.focus()
    return () => { if (back && back.focus) back.focus() }
  }, [open, inline])
  /* The host keeps this mounted and closes it with `open`; the next open starts
     from a clean list rather than last time's selection. */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!open) { setPending(null); setPointed(null); setChosen(null) } }, [open])
  /* The warning is drawn `inline` inside this dialog, which skips its own focus
     move, so Enter still takes the default ("Save and load"). */
  useEffect(() => {
    if (!pending || !warnRef.current) return
    const b = warnRef.current.querySelector<HTMLButtonElement>('[data-warning-default] button') || warnRef.current.querySelector<HTMLButtonElement>('button')
    if (b) b.focus()
  }, [pending])
  if (!open) return null

  const target: LoadChoice | null = pointed || chosen || (unfolded != null ? { mapId: unfolded } : openMapId != null ? { mapId: openMapId } : null)
  const tMap = target ? findMap(maps, target.mapId) : null
  const tWalk = tMap ? findWalk(tMap, target?.walkId) : null
  const pick = (c: LoadChoice) => { if (unsaved) setPending(c); else if (onPick) onPick(c) }
  const nameOf = (c: LoadChoice) => { const m = findMap(maps, c.mapId); const w = findWalk(m, c.walkId); return w ? w.title : m ? m.title : '' }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !pending) { e.preventDefault(); e.stopPropagation(); if (onClose) onClose(); return }
    if (e.key !== 'Tab' || inline || !cardRef.current) return
    const bs = Array.from(cardRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    if (!bs.length) return
    const i = bs.indexOf(document.activeElement as HTMLButtonElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); bs[bs.length - 1].focus() }
    else if (!e.shiftKey && i === bs.length - 1) { e.preventDefault(); bs[0].focus() }
  }

  const card = (
    <div ref={cardRef} tabIndex={-1} role="dialog" aria-modal={inline ? undefined : true} aria-label="Load a map" onKeyDown={onKey} onClick={(e) => e.stopPropagation()}
      style={{ width: M.width, maxWidth: 'calc(100vw - 32px)', height: M.height, maxHeight: 'calc(100vh - 32px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--lift-3)', fontFamily: 'var(--font-ui)', overflow: 'hidden', outline: 'none', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: M.pad + 'px ' + M.pad + 'px 10px', borderBottom: '1px solid var(--border-hair)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
      {/* The footer runs across the dialog: Cancel and Load together at the right.
          Load is off until something is selected. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: M.footerPadY + 'px ' + M.pad + 'px', borderTop: '1px solid var(--border-hair)' }}>
        {onClose ? <PillButton size="md" tone="quiet" onClick={onClose}>Cancel</PillButton> : null}
        <PillButton size="md" tone="primary" disabled={!chosen} onClick={() => chosen && pick(chosen)}>Load</PillButton>
      </div>
    </div>
  )
  const warning = pending ? (
    <div ref={warnRef}>
      <UnsavedWarning inline what={unsaved} next={nameOf(pending)}
        onSave={() => { const c = pending; setPending(null); if (onPick) onPick(c, 'save') }}
        onDiscard={() => { const c = pending; setPending(null); if (onPick) onPick(c, 'discard') }}
        onCancel={() => setPending(null)} />
    </div>
  ) : null
  /* THE CARD STAYS MOUNTED UNDER THE WARNING, hidden: the picker keeps its selection and unfolded
     map in its own state, and an unmount would reset them, so Cancel would bring back a list that
     disagrees with the Load button. */
  /* ONE STABLE TREE: the card's wrapper and position never change, or React remounts it anyway */
  const face = <>{warning}<div style={{ display: warning ? 'none' : 'contents' }}>{card}</div></>
  if (inline) return face
  const scrim = (
    <div onClick={() => { if (pending) setPending(null); else if (onClose) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: WARNING_DIALOG_METRICS.z, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>{face}</div>
  )
  return typeof document !== 'undefined' ? portalInto(document.body, scrim) : scrim
}
