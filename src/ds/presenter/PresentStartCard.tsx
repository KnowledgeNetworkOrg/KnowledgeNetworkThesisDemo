import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

import { EditMark } from '../chrome/EditMark'
import { IconButton, useRecede } from '../chrome/IconButton'
import { InlineText } from '../chrome/InlineText'
import { PaneScroller } from '../chrome/Pane'
import { PillButton } from '../chrome/PillButton'
import { LocateMark } from '../chrome/LocateMark'
import { LoadMark } from '../chrome/LoadMark'
import { WalkerMark } from '../chrome/WalkerMark'
import { LoadPicker } from '../nav/LoadPicker'
import { Caret, CARET_INK } from '../nav/TreeRow'
import { BinMark } from '../sidebar/BinMark'

/* Typed port of the DS components/presenter/PresentStartCard.jsx (contract:
   PresentStartCard.d.ts), filed 2026-10-01. */

export interface StartSession {
  id: string | number
  /** the session's own name, authored. EMPTY IS LEGITIMATE: drawn as `untitledLabel` */
  name: string
  /** OPTIONAL days it meets, 0 = Monday … 6 = Sunday, any order */
  meets?: number[]
  /** where this session was last presented */
  last?: {
    walkId: string | number
    walk: string
    stop: number
    stopId?: string
    of?: number
    at?: number | Date
    stopTitle?: string
    address?: string
  }
}

export interface StartChoice {
  from: 'continue' | 'pick-walk' | 'reading' | 'elsewhere'
  sectionId: string | number | null
  newSession?: boolean
  kind?: 'top' | 'continue' | 'next' | 'choose'
  walkId?: string | number | null
  stop?: number | null
}

export interface StartWalk {
  id: string | number
  title: string
  stops: Array<{ title: string; id?: string; territory?: string; hue?: string; address?: string }>
}

export interface StartReading {
  walkId: string | number
  walk: string
  stop: number
  stopTitle?: string
  address?: string
}

export interface PresentStartCardProps {
  course?: string
  sections?: StartSession[]
  selectedId?: string | number | null
  onSelectSection?: (id: string | number | null) => void
  onAddSection?: (name: string) => void
  onRenameSection?: (id: string | number, name: string) => void
  onSetSectionMeets?: (id: string | number, meets: number[]) => void
  onDeleteSection?: (id: string | number) => void
  openWalk?: { id: string | number; title: string }
  walks?: StartWalk[]
  reading?: StartReading
  onStart?: (choice: StartChoice) => void
  onCancel?: () => void
  keys?: boolean
  now?: number | Date
  title?: string
  untitledLabel?: string
  sessionsLabel?: string
  newLabel?: string
  continueLabel?: string
  beginLabel?: string
  readingLabel?: string
  newLitLine?: string
  elsewhereLabel?: string
  elsewhereLine?: string
  width?: number
  style?: CSSProperties
}

/** The card's numbers. */
export const START_CARD_METRICS = { width: 640, side: 210, row: 52, icon: 28, metaLine: 22, pairGap: 0, editRows: 2, bodyMax: 360, pairRecede: false }

type Runs = Array<[string, boolean]>

const plain = (runs: Runs) => runs.map((r) => r[0]).join('')

function stopAddress(walks: StartWalk[] | undefined, walkId: string | number | null | undefined, stop: number, own?: string): string {
  if (own != null && own !== '') return String(own)
  const w = walks && walkId != null ? walks.find((x) => x.id === walkId) : null
  const s = w && w.stops ? w.stops[stop] : null
  return s && s.address != null && s.address !== '' ? String(s.address) : String(stop + 1)
}

const placeRuns = (walk: string, address: string, of?: number, title?: string): Runs => ([[walk, true], [', ', false], ['stop ' + address, true]]
  .concat(of != null && address.indexOf('.') < 0 ? [[' of ' + of, false]] : [], title ? [[' – ', false], [title, true]] : [])) as Runs

function readingRuns(reading?: StartReading, walks?: StartWalk[]): Runs {
  if (!reading) return [['nothing open', false]]
  return placeRuns(reading.walk, stopAddress(walks, reading.walkId, reading.stop, reading.address), undefined, reading.stopTitle)
}

function placeIndex(walks: StartWalk[] | undefined, walkId: string | number, stop: number, stopId?: string): number {
  if (stopId == null || !walks) return stop
  const w = walks.find((x) => x.id === walkId)
  const i = w && w.stops ? w.stops.findIndex((s) => s.id === stopId) : -1
  return i >= 0 ? i : stop
}

export interface ResolvedStart {
  kind: 'top' | 'continue' | 'next' | 'choose'
  walkId: string | number | null | undefined
  stop: number | null
  line: string
  lineEm: Runs
  next?: string
  nextEm?: Runs
}

function resolveStart(section: StartSession | { last?: StartSession['last'] } | null, openWalk?: { id: string | number; title: string } | null, walks?: StartWalk[]): ResolvedStart {
  const raw = section && section.last
  const last = raw && raw.stopId != null ? { ...raw, stop: placeIndex(walks, raw.walkId, raw.stop, raw.stopId) } : raw
  const open = openWalk || {} as { id?: string | number; title?: string }
  const out = (o: { kind: ResolvedStart['kind']; walkId: string | number | null | undefined; stop: number | null }, lineEm: Runs, nextEm?: Runs): ResolvedStart => ({ ...o, line: plain(lineEm), lineEm, ...(nextEm ? { next: plain(nextEm), nextEm } : {}) })
  if (!last) return out({ kind: 'top', walkId: open.id, stop: 0 }, open.title ? ([['From start of walk: ', false]].concat(placeRuns(open.title, stopAddress(walks, open.id, 0))) as Runs) : ([['From start of walk', false]] as Runs))
  const finished = last.of != null && last.stop >= last.of - 1
  if (!finished) return out({ kind: 'continue', walkId: last.walkId, stop: last.stop }, placeRuns(last.walk, stopAddress(walks, last.walkId, last.stop, last.address), last.of, last.stopTitle))
  if (open.id != null && open.id !== last.walkId) return out({ kind: 'next', walkId: open.id, stop: 0 }, [['Finished the walk ', false], [last.walk, true]], [['Next: ', false], [open.title || '', true], [', the walk you have open', false]])
  return out({ kind: 'choose', walkId: null, stop: null }, [['Finished the walk ', false], [last.walk, true]], [['Choose the next walk', false]])
}

function RunsText({ runs }: { runs: Runs }) {
  return <>{runs.map((r, i) => (r[1] ? <span key={i} style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{r[0]}</span> : <Fragment key={i}>{r[0]}</Fragment>))}</>
}

const UNTITLED = 'Untitled session'
const displayName = (s: StartSession | null, untitled?: string) => (s && s.name ? s.name : untitled || UNTITLED)
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_CHIP = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const meetsLabel = (meets?: number[]) => {
  const d = Array.from(new Set((meets || []).filter((n) => n >= 0 && n <= 6))).sort((a, b) => a - b)
  if (!d.length) return ''
  if (d.length === 7) return 'Every day'
  const parts: string[] = []
  for (let i = 0; i < d.length;) {
    let j = i
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++
    if (j - i >= 2) parts.push(DAY_SHORT[d[i]] + '–' + DAY_SHORT[d[j]])
    else for (let k = i; k <= j; k++) parts.push(DAY_SHORT[d[k]])
    i = j + 1
  }
  return parts.join('/')
}

const toggleDay = (meets: number[] | undefined, n: number) => {
  const d = new Set(meets || [])
  if (d.has(n)) d.delete(n); else d.add(n)
  return Array.from(d).sort((a, b) => a - b)
}

const two = (n: number) => (n < 10 ? '0' : '') + n
const lastLabel = (at?: number | Date, now?: number | Date) => {
  if (at == null) return ''
  const d = new Date(at), n = new Date(now != null ? now : Date.now())
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const ago = Math.round((day(n) - day(d)) / 86400000)
  const time = two(d.getHours()) + ':' + two(d.getMinutes())
  if (ago === 0) return 'Today ' + time
  if (ago === 1) return 'Yesterday ' + time
  if (ago > 1 && ago < 7) return DAY_SHORT[(d.getDay() + 6) % 7] + ' ' + time
  const date = d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' })
  return d.getFullYear() === n.getFullYear() ? date : date + ' ' + d.getFullYear()
}

const rowTitle = (title: string, key?: string) => (key ? title + ' (' + key + ')' : title)

export const StartMath = { resolve: resolveStart, placeIndex, rowTitle, readingRuns, stopAddress, displayName, meetsLabel, toggleDay, lastLabel, DAY_SHORT }

function DayPicker({ meets, onChange }: { meets?: number[]; onChange: (meets: number[]) => void }) {
  const on = new Set(meets || [])
  return (
    <div role="group" aria-label="days this session meets" style={{ display: 'flex', gap: 2 }}>
      {DAY_CHIP.map((label, n) => {
        const sel = on.has(n)
        return (
          <button key={n} type="button" aria-pressed={sel} title={DAY_SHORT[n]} onClick={(e) => { e.currentTarget.focus(); onChange(toggleDay(meets, n)) }}
            style={{ width: 22, height: 22, padding: 0, flexShrink: 0, display: 'grid', placeItems: 'center', boxSizing: 'border-box',
              border: '1px solid ' + (sel ? 'var(--border-walk)' : 'var(--border-hair)'), borderRadius: 'var(--radius-sm)',
              background: sel ? 'var(--accent-walk-wash)' : 'var(--surface-raised)', color: sel ? 'var(--text-walk)' : 'var(--text-2)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: sel ? 'var(--fw-bold)' : 'var(--fw-medium)',
              cursor: 'pointer', transition: 'var(--transition-wash)' }}>{label}</button>
        )
      })}
    </div>
  )
}

function StartRow({ icon, title, line, line2, keyLabel, on, disabled, onPick, onHover }: {
  icon: ReactNode
  title: string
  line?: ReactNode
  line2?: ReactNode
  keyLabel?: string
  on?: boolean
  disabled?: boolean
  onPick?: () => void
  onHover?: () => void
}) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" disabled={disabled} onClick={onPick} title={rowTitle(title, keyLabel)}
      onMouseEnter={() => { setHot(true); if (onHover) onHover() }} onMouseLeave={() => setHot(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: START_CARD_METRICS.row,
        padding: '8px 12px', boxSizing: 'border-box', textAlign: 'left',
        border: '1px solid ' + (on ? 'var(--border-walk)' : hot && !disabled ? 'var(--border-strong)' : 'var(--border-hair)'),
        borderRadius: 'var(--radius-md)',
        background: on ? 'var(--accent-walk-wash)' : hot && !disabled ? 'var(--surface-hover-raised)' : 'var(--surface-raised)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'var(--transition-wash)', fontFamily: 'var(--font-ui)',
      }}>
      <span style={{ flexShrink: 0, width: START_CARD_METRICS.icon, height: START_CARD_METRICS.icon, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)', background: on ? 'var(--surface-raised)' : 'var(--surface-canopy)', color: on ? 'var(--text-walk)' : 'var(--text-2)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)' }}>{title}</span>
        {line ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>{line}</span> : null}
        {line2 ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>{line2}</span> : null}
      </span>
    </button>
  )
}

function SessionRow({ s, on, editing, untitled, now, onPick, onEdit, onRename, onSetMeets, onStopEdit, onDelete }: {
  s: StartSession
  on?: boolean
  editing?: boolean
  untitled: string
  now?: number | Date
  onPick?: () => void
  onEdit?: () => void
  onRename: ((v: string) => void) | null
  onSetMeets: ((v: number[]) => void) | null
  onStopEdit: () => void
  onDelete: (() => void) | null
}) {
  const [hot, setHot] = useState(false)
  const [shown, show, hide] = useRecede()
  const pairShown = START_CARD_METRICS.pairRecede ? shown : hot
  const boxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!editing) return undefined
    const away = (e: PointerEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onStopEdit() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [editing, onStopEdit])
  const leave = (e: FocusEvent<HTMLDivElement>) => {
    if (!editing || !e.relatedTarget) return
    if (!(boxRef.current && boxRef.current.contains(e.relatedTarget as Node))) onStopEdit()
  }
  const onFormKey = (e: ReactKeyboardEvent<HTMLDivElement>) => { if (editing && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onStopEdit() } }
  const nextField = () => setTimeout(() => {
    const f = boxRef.current && boxRef.current.querySelector('[role="group"] button')
    if (f) (f as HTMLButtonElement).focus()
  }, 0)
  const fieldWide: CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box' }
  const days = meetsLabel(s.meets)
  const lastAt = s.last ? lastLabel(s.last.at, now) : ''
  const oneLine = !days && !lastAt
  const pair = (onRename || onDelete) ? (
    <span style={{ display: 'flex', gap: START_CARD_METRICS.pairGap, flexShrink: 0 }}>
      {onRename ? <IconButton size={22} reveal={pairShown} title={onSetMeets ? 'edit name and days' : 'edit name'} onClick={onEdit}><EditMark /></IconButton> : null}
      {onDelete ? <IconButton tone="danger" size={22} reveal={pairShown} title={'delete ' + displayName(s, untitled)} onClick={onDelete}><BinMark size={11} /></IconButton> : null}
    </span>
  ) : null
  const nameStyle: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', fontWeight: 'var(--fw-semibold)', color: s.name ? 'var(--text-1)' : 'var(--text-2)', fontStyle: s.name ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  return (
    <div ref={boxRef} data-session-id={String(s.id)} onKeyDown={onFormKey} onMouseEnter={() => { setHot(true); show() }} onMouseLeave={() => { setHot(false); hide() }} onFocus={() => { setHot(true); show() }} onBlur={(e) => { setHot(false); hide(); leave(e) }}
      style={{ display: 'flex', alignItems: editing ? 'flex-start' : 'center', gap: 2, borderRadius: 'var(--radius-sm)', border: '1px solid ' + (on ? 'var(--border-walk)' : 'transparent'), background: on ? 'var(--surface-raised)' : hot ? 'var(--surface-hover)' : 'transparent', transition: 'var(--transition-wash)' }}>
      {editing ? (
        <div style={{ flex: 1, minWidth: 0, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <InlineText value={s.name || ''} editing placeholder={untitled} editStyle={fieldWide}
            style={{ ...nameStyle, color: 'var(--text-1)', fontStyle: 'normal', whiteSpace: 'normal' }}
            onCommit={(v) => { if (v !== (s.name || '') && onRename) onRename(v); if (onSetMeets) nextField(); else onStopEdit() }} onCancel={onStopEdit} />
          {onSetMeets ? (
            <DayPicker meets={s.meets} onChange={onSetMeets} />
          ) : days ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>{days}</span> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PillButton size="sm" onMouseDown={(e) => e.preventDefault()} onClick={onStopEdit}>Done</PillButton>
          </div>
        </div>
      ) : (
        <div role="button" tabIndex={0} aria-pressed={on} onClick={onPick}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); if (onPick) onPick() } }}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, padding: oneLine ? '4px 4px 4px 9px' : '6px 4px 4px 9px', cursor: 'pointer', fontFamily: 'var(--font-ui)', outline: 'none' }}>
          {oneLine ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: START_CARD_METRICS.metaLine }}>
              <span title={displayName(s, untitled)} style={{ ...nameStyle, flex: 1, minWidth: 0 }}>{displayName(s, untitled)}</span>
              {pair}
            </span>
          ) : (
            <Fragment>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingRight: 5 }}>
                <span title={displayName(s, untitled)} style={{ ...nameStyle, minWidth: 0 }}>{displayName(s, untitled)}</span>
                {lastAt ? <span title="last presented" style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)', whiteSpace: 'nowrap' }}>{lastAt}</span> : null}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: START_CARD_METRICS.metaLine }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{days}</span>
                {pair}
              </span>
            </Fragment>
          )}
        </div>
      )}
    </div>
  )
}

const BACK_CARET = { transform: 'rotate(135deg) translate(-' + CARET_INK + 'px, -' + CARET_INK + 'px)', width: 7, height: 7 }

function StepHead({ back, onBack, label, caps }: { back: string; onBack: () => void; label: string; caps: CSSProperties }) {
  const [hot, setHot] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 6px' }}>
      <button type="button" onClick={onBack} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: hot ? 'var(--accent-walk-wash)' : 'transparent', padding: '3px 8px 3px 8px', margin: '0 0 0 -8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-walk)', transition: 'var(--transition-wash)' }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 10, height: 14 }}><Caret style={BACK_CARET} /></span>{back}</button>
      <span style={{ ...caps, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

function ConfirmDelete({ name, onKeep, onDelete }: { name: string; onKeep: () => void; onDelete: () => void }) {
  return (
    <div role="alertdialog" aria-label={'delete ' + name}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--state-danger)', background: 'var(--surface-raised)' }}>
      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{'Delete ' + name + '?'}</span>
      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>It forgets where this session got to. This can't be undone.</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <PillButton size="sm" onClick={onKeep}>Keep</PillButton>
        <PillButton size="sm" tone="danger" onClick={onDelete}>Delete</PillButton>
      </div>
    </div>
  )
}

const NEW_SESSION: StartSession = { id: null as unknown as string, name: '' }

export function PresentStartCard({
  course, sections = [], selectedId, onSelectSection, onAddSection, onRenameSection, onSetSectionMeets, onDeleteSection,
  openWalk, reading, walks, onStart, onCancel, keys = true, now,
  title = 'Start presenting', sessionsLabel = 'Choose Session', newLabel = '+ New session', untitledLabel = UNTITLED,
  continueLabel = 'Continue from last presentation', beginLabel = 'Start from the beginning', readingLabel = "Where I'm reading", newLitLine = 'untitled · click to name it', elsewhereLabel = 'Load another walk', elsewhereLine = '',
  width = START_CARD_METRICS.width, style,
}: PresentStartCardProps) {
  const real = sections.find((s) => s.id === selectedId) || null
  const isNew = !real
  const sel = real || NEW_SESSION
  const [pick, setPick] = useState(0)
  const [step, setStep] = useState<'walks' | null>(null)
  const allMaps = walks && walks.length ? [{ id: 'open', title: course || '', walks }] : null
  const canBrowse = !!(allMaps && allMaps.some((m) => m.walks && m.walks.length))
  const allWalks = walks
  const back = () => setStep(null)
  const start = (c: StartChoice) => { if (onStart) onStart(isNew ? { ...c, sectionId: null, newSession: true } : c) }
  const nameOf = (c: { walkId?: string | number | null } | null) => {
    const w = c && allWalks ? allWalks.find((x) => x.id === c.walkId) : null
    if (w) return w.title
    if (c && reading && c.walkId === reading.walkId) return reading.walk
    if (c && sel.last && c.walkId === sel.last.walkId) return sel.last.walk
    if (c && openWalk && c.walkId === openWalk.id) return openWalk.title
    return ''
  }
  const [confirming, setConfirming] = useState<string | number | null>(null)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [addHot, setAddHot] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [selEdge, setSelEdge] = useState<'above' | 'below' | null>(null)
  const [edgeHot, setEdgeHot] = useState(false)
  const selRow = () => {
    const sc = listRef.current
    return sc && real ? sc.querySelector('[data-session-id="' + String(real.id).replace(/["\\]/g, '\\$&') + '"]') : null
  }
  const measureSel = () => {
    const sc = listRef.current
    const row = selRow()
    let side: 'above' | 'below' | null = null
    if (row && sc) {
      const a = sc.getBoundingClientRect(), b = row.getBoundingClientRect()
      if (b.bottom <= a.top + 4) side = 'above'
      else if (b.top >= a.bottom - 4) side = 'below'
    }
    setSelEdge(side)
  }
  useLayoutEffect(measureSel)
  const measureRef = useRef(measureSel)
  // the listener below is subscribed once and calls the latest measurement through this ref
  // eslint-disable-next-line react-hooks/refs
  measureRef.current = measureSel
  useEffect(() => {
    const sc = listRef.current
    if (!sc) return undefined
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => measureRef.current()) }
    sc.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { cancelAnimationFrame(raf); sc.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const goSel = () => {
    const sc = listRef.current, row = selRow()
    if (!sc || !row) return
    const a = sc.getBoundingClientRect(), b = row.getBoundingClientRect()
    sc.scrollTop += b.top - a.top - (a.height - b.height) / 2
  }
  const edgePill = (pos: 'top' | 'bottom') => (
    <button type="button" onClick={goSel} onMouseEnter={() => setEdgeHot(true)} onMouseLeave={() => setEdgeHot(false)} title="Scroll to the chosen session"
      style={{ position: 'absolute', left: 0, right: 0, [pos]: 4, display: 'flex', alignItems: 'center', gap: 5, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', textAlign: 'left', padding: '3px 9px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', background: edgeHot ? 'var(--surface-hover)' : 'var(--surface-raised)', boxShadow: 'var(--lift-1)', color: 'var(--text-1)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>{selEdge === 'above' ? '↑' : '↓'}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{real ? displayName(real, untitledLabel) : ''}</span>
    </button>
  )
  const knownRef = useRef<Set<string | number> | null>(null)
  useEffect(() => {
    if (!knownRef.current) return
    const fresh = sections.find((s) => !knownRef.current!.has(s.id))
    if (fresh) { knownRef.current = null; setEditingId(fresh.id); if (onSelectSection) onSelectSection(fresh.id) }
  }, [sections, onSelectSection])
  const addNew = () => { knownRef.current = new Set(sections.map((s) => s.id)); if (onAddSection) onAddSection('') }
  const target = resolveStart(sel, openWalk, allWalks)
  const readLine = <RunsText runs={readingRuns(reading, allWalks)} />
  const titleWalk = step != null ? '' : pick === 0 ? (target.kind === 'choose' ? '' : nameOf({ walkId: target.walkId })) : pick === 1 ? (reading ? reading.walk : '') : ''
  const fire = (i: number) => {
    if (!onStart) return
    if (i === 0) {
      if (target.kind === 'choose' && canBrowse) { setStep('walks'); return }
      if (target.kind === 'choose') { start({ from: 'pick-walk', sectionId: sel.id, kind: target.kind, walkId: null, stop: null }); return }
      start({ from: 'continue', sectionId: sel.id, kind: target.kind, walkId: target.walkId, stop: target.stop })
    }
    else if (i === 1 && reading) start({ from: 'reading', sectionId: sel.id, walkId: reading.walkId, stop: reading.stop })
    else if (i === 2) { if (canBrowse) setStep('walks'); else start({ from: 'elsewhere', sectionId: sel.id }) }
  }
  useEffect(() => {
    if (!keys) return undefined
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (editingId != null || e.defaultPrevented) return
      if (confirming != null) { if (e.key === 'Escape') { e.preventDefault(); setConfirming(null) } return }
      if (step != null) { if (e.key === 'Escape') { e.preventDefault(); back() } return }
      const k = e.key
      if (k === 'Enter') { e.preventDefault(); fire(pick) }
      else if (k === 'r' || k === 'R') { if (reading) { e.preventDefault(); fire(1) } }
      else if (k === 'p' || k === 'P') { e.preventDefault(); fire(2) }
      else if (k === 'ArrowDown') { e.preventDefault(); setPick((p) => { const n = Math.min(2, p + 1); return n === 1 && !reading ? 2 : n }) }
      else if (k === 'ArrowUp') { e.preventDefault(); setPick((p) => { const n = Math.max(0, p - 1); return n === 1 && !reading ? 0 : n }) }
      else if (k === 'Escape' && onCancel) { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const caps: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-2)' }
  return (
    <div role="dialog" aria-label={title}
      style={{ position: 'relative', width, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--lift-3)', overflow: 'hidden', fontFamily: 'var(--font-ui)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 16px', borderBottom: '1px solid var(--border-hair)' }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', letterSpacing: 'var(--ls-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}{titleWalk ? <span style={{ color: 'var(--text-2)', fontWeight: 'var(--fw-semibold)' }}>{' — ' + titleWalk}</span> : null}
        </div>
        {onCancel ? <IconButton size={24} title="cancel (Esc)" onClick={onCancel} /> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: START_CARD_METRICS.side + 'px minmax(0, 1fr)', alignItems: 'start' }}>
        <div style={{ alignSelf: 'stretch', maxHeight: START_CARD_METRICS.bodyMax, boxSizing: 'border-box', background: 'var(--surface-canopy)', borderRight: '1px solid var(--border-hair)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{ ...caps, padding: '2px 4px 6px', flexShrink: 0 }}>{sessionsLabel}</div>
          {onAddSection ? (
            <button type="button" data-new-session="top" aria-pressed={isNew} onClick={() => (isNew ? addNew() : onSelectSection && onSelectSection(null))} onMouseEnter={() => setAddHot(true)} onMouseLeave={() => setAddHot(false)} onFocus={() => setAddHot(true)} onBlur={() => setAddHot(false)}
              title={isNew ? 'create it now and name it' : 'present with a new, untitled session'}
              style={{ flexShrink: 0, marginBottom: 2, padding: '7px 9px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1, border: '1px dashed ' + (isNew || addHot ? 'var(--border-walk)' : 'var(--border-dashed)'), borderRadius: 'var(--radius-sm)', background: isNew ? 'var(--surface-raised)' : addHot ? 'var(--accent-walk-wash)' : 'transparent', transition: 'var(--transition-wash)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: isNew ? 'var(--fw-semibold)' : 'var(--fw-medium)', color: 'var(--text-walk)' }}>
              <span>{newLabel}</span>
              {isNew && newLitLine ? <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>{newLitLine}</span> : null}
            </button>
          ) : null}
          <PaneScroller forwardRef={listRef} style={{ flex: '0 1 auto', marginTop: 0, marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ position: 'sticky', top: 0, height: 0, marginBottom: -4, zIndex: 2, flexShrink: 0 }}>{selEdge === 'above' ? edgePill('top') : null}</div>
          {sections.map((s) => (confirming === s.id
            ? <ConfirmDelete key={s.id} name={displayName(s, untitledLabel)} onKeep={() => setConfirming(null)} onDelete={() => { setConfirming(null); if (onDeleteSection) onDeleteSection(s.id) }} />
            : <SessionRow key={s.id} s={s} on={!!real && s.id === real.id} editing={editingId === s.id} untitled={untitledLabel} now={now}
                onPick={() => onSelectSection && onSelectSection(s.id)}
                onEdit={() => setEditingId(s.id)} onStopEdit={() => setEditingId(null)}
                onRename={onRenameSection ? (v) => onRenameSection(s.id, v) : null}
                onSetMeets={onSetSectionMeets ? (v) => onSetSectionMeets(s.id, v) : null}
                onDelete={onDeleteSection ? () => setConfirming(s.id) : null} />
          ))}
          <div style={{ position: 'sticky', bottom: 0, height: 0, marginTop: -4, zIndex: 2, flexShrink: 0 }}>{selEdge === 'below' ? edgePill('bottom') : null}</div>
          </PaneScroller>
        </div>
        {step === 'walks' ? (
          <div style={{ maxHeight: START_CARD_METRICS.bodyMax, boxSizing: 'border-box', padding: '10px 0 0 14px', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flexShrink: 0, paddingRight: 14 }}><StepHead back="Back" onBack={back} label="Choose a walk, then a stop" caps={caps} /></div>
            <PaneScroller style={{ flex: '0 1 auto', marginTop: 0, marginBottom: 0, paddingRight: 14, paddingBottom: 14 }}>
              <LoadPicker maps={allMaps || []} openMapId="open" openWalkId={openWalk ? openWalk.id : null} withStops
                activeStop={(wid) => (sel.last && sel.last.walkId === wid ? sel.last.stop : -1)}
                onPick={(p) => start({ from: 'elsewhere', sectionId: sel.id, walkId: p.walkId, stop: p.stop })} />
            </PaneScroller>
          </div>
        ) : (
        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...caps, padding: '2px 0 6px' }}>Start from</div>
          <StartRow icon={<WalkerMark size={18} />} title={target.kind === 'top' ? beginLabel : continueLabel} line={<RunsText runs={target.lineEm} />} line2={target.nextEm ? <RunsText runs={target.nextEm} /> : ''} keyLabel="Enter"
            on={pick === 0} onPick={() => fire(0)} onHover={() => setPick(0)} />
          <StartRow icon={<LocateMark size={15} />} title={readingLabel} line={readLine} keyLabel="R"
            on={pick === 1} disabled={!reading} onPick={() => fire(1)} onHover={() => setPick(1)} />
          <StartRow icon={<LoadMark size={15} />} title={elsewhereLabel} line={elsewhereLine} keyLabel="P"
            on={pick === 2} onPick={() => fire(2)} onHover={() => setPick(2)} />
        </div>
        )}
      </div>
    </div>
  )
}
