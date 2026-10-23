import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

import { CloseMark } from '../chrome/CloseMark'
import { wrapTip } from '../chrome/IconButton'
import { portalInto } from '../chrome/portal'
import { NOTE_CATEGORIES, TagGlyph } from './LectureNotes'

/* Typed port of the DS components/presenter/FlagChip.jsx (contract: FlagChip.d.ts), v4. */

/** one type on the ring - the same shape as `LectureNotes`' `NoteCategory` */
export interface FlagType {
  key: string
  glyph: string
  label: string
  /** the ring's and the tooltip's word ("fix" for "fix this slide"). Falls back to `label` */
  short?: string
  wash: string
}

/** THE FLAG CHIP'S NUMBERS. */
export const FLAG_CHIP_METRICS = { hold: 300, chip: 22, tag: 18, ring: 40, petal: 26, centre: 32, label: 14, slop: 10, layer: 1000 }

const ANGLES = [-90, 150, 30]
const OTHER_ANGLES = [-150, -30]
const radiusOf = () => FLAG_CHIP_METRICS.ring

const shortOf = (c?: FlagType | null) => (c ? c.short || c.label : '')

interface RingState { x: number; y: number; mode: 'hold' | 'click' | 'pin' }

export interface FlagChipProps {
  /** the ring types' source, in order. Default the first three of `NOTE_CATEGORIES` */
  types?: FlagType[]
  /** the key a TAP makes, and the type the chip shows at rest. Default 'fix' */
  usual?: string
  /** a type was picked ON THE RING that is not the usual one: it is the usual one now. Store it */
  onUsualChange?: (key: string) => void
  /** a type was chosen - by tap, by release on the ring, or by click on it */
  onFlag?: (key: string) => void
  /** the spoken name. Default "flag this slide" */
  title?: string
  /** show "tap to flag · hold to change flag" as the tooltip. Default true */
  hint?: boolean
  /** fired each time the ring opens - for a host counting toward switching `hint` off */
  onRingOpen?: () => void
  /** draws the ring open from mount, IN PLACE around the chip. FOR SPECIMEN CARDS */
  openOnMount?: boolean
  style?: CSSProperties
}

export function FlagChip({ types, usual = 'fix', onUsualChange, onFlag, title, hint = true, onRingOpen, openOnMount = false, style }: FlagChipProps) {
  const M = FLAG_CHIP_METRICS
  const list = (types || NOTE_CATEGORIES).slice(0, 3)
  const [ownUsual, setOwnUsual] = useState(usual)
  useEffect(() => { setOwnUsual(usual) }, [usual])
  const usualKey = onUsualChange ? usual : ownUsual
  const usualCat = list.filter((c) => c.key === usualKey)[0] || list[0]
  const btn = useRef<HTMLButtonElement | null>(null)
  const [ring, setRing] = useState<RingState | null>(null)
  const ringRef = useRef<RingState | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [hot, setHot] = useState(false)
  const [holding, setHolding] = useState(false)
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const fillAnim = useRef<Animation | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const el = fillRef.current
    if (!holding || !el || typeof el.animate !== 'function') return undefined
    const r = Math.ceil(M.chip / 2)
    const shade = 'color-mix(in srgb, var(--text-1) 22%, transparent)'
    fillAnim.current = el.animate([{ boxShadow: 'inset 0 0 0 0px ' + shade }, { boxShadow: 'inset 0 0 0 ' + r + 'px ' + shade }], { duration: M.hold, easing: 'linear', fill: 'forwards' })
    return () => { if (fillAnim.current) { fillAnim.current.cancel(); fillAnim.current = null } }
  }, [holding, M.chip, M.hold])
  const others = usualCat ? list.filter((c) => c.key !== usualCat.key) : list
  const angles = others.length === 2 ? OTHER_ANGLES : ANGLES
  const petals = others.map((cat, i) => {
    const a = (angles[i] * Math.PI) / 180
    return { cat, dx: Math.round(Math.cos(a) * radiusOf()), dy: Math.round(Math.sin(a) * radiusOf()) }
  })
  const pickAt = (x: number, y: number, r: RingState) => {
    const dx = x - r.x, dy = y - r.y
    let best: { cat: FlagType; dx: number; dy: number } | null = null, bd = Infinity
    petals.forEach((p) => { const d = Math.hypot(dx - p.dx, dy - p.dy); if (d < bd) { bd = d; best = p } })
    if (best && bd <= M.petal / 2 + M.slop) return (best as { cat: FlagType }).cat.key
    if (Math.hypot(dx, dy) <= M.centre / 2) return 'cancel'
    return null
  }
  const close = () => { ringRef.current = null; setRing(null); setPick(null); setHolding(false) }
  const fire = (k?: string | null) => {
    if (!(ringRef.current && ringRef.current.mode === 'pin')) close()
    if (!k || k === 'cancel' || !onFlag || !usualCat) return
    const key = k === 'usual' ? usualCat.key : k
    onFlag(key)
    if (key !== usualCat.key) { if (onUsualChange) onUsualChange(key); else setOwnUsual(key) }
  }
  const open = (mode: RingState['mode']) => {
    const el = btn.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const r = { x: b.left + b.width / 2, y: b.top + b.height / 2, mode }
    ringRef.current = r
    setRing(r)
    setPick(mode === 'hold' ? 'cancel' : null)
    setHolding(false)
    if (onRingOpen) onRingOpen()
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (openOnMount) { const id = setTimeout(() => open('pin'), 60); return () => clearTimeout(id) }
    return undefined
  // a specimen opens the ring once; this is deliberately mount-only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnMount])
  useEffect(() => {
    if (!ring) return undefined
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); if (btn.current) btn.current.focus() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [ring])
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (timer.current) clearTimeout(timer.current)
    setHolding(true)
    timer.current = setTimeout(() => open('hold'), M.hold)
    const move = (ev: PointerEvent) => { const r = ringRef.current; if (r && r.mode === 'hold') setPick(pickAt(ev.clientX, ev.clientY, r)) }
    const up = (ev: PointerEvent) => {
      if (timer.current) clearTimeout(timer.current)
      setHolding(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      const r = ringRef.current
      if (!r) fire('usual')
      else if (r.mode === 'hold') fire(pickAt(ev.clientX, ev.clientY, r))
    }
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      close()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }
  const name = title || 'flag this slide'
  const tip = hint && usualCat ? 'tap to flag · hold to change flag' : name
  const clickMode = !!ring && (ring.mode === 'click' || ring.mode === 'pin')
  const blocking = !!ring && ring.mode === 'click'
  const ringBody = ring ? (<Fragment>
        <button type="button" role="menuitem" aria-label="cancel" title={wrapTip('cancel - no flag')}
          onMouseEnter={clickMode ? () => setPick('cancel') : undefined} onClick={clickMode ? () => fire('cancel') : undefined}
          style={{ position: 'absolute', left: -M.centre / 2, top: -M.centre / 2, width: M.centre, height: M.centre, padding: 0, boxSizing: 'border-box', pointerEvents: clickMode ? 'auto' : 'none', borderRadius: '50%', background: 'var(--surface-paper)', border: pick === 'cancel' ? '2px solid var(--border-strong)' : '1px solid var(--border-rule)', color: pick === 'cancel' ? 'var(--text-1)' : 'var(--text-2)', boxShadow: 'var(--lift-2)', display: 'grid', placeItems: 'center', cursor: clickMode ? 'pointer' : 'default' }}>
          <CloseMark size={11} />
        </button>
        {petals.map((p, i) => {
          const on = pick === p.cat.key
          return (
            <button key={p.cat.key} type="button" role="menuitem" autoFocus={blocking && i === 0}
              onMouseEnter={clickMode ? () => setPick(p.cat.key) : undefined} onFocus={clickMode ? () => setPick(p.cat.key) : undefined}
              onClick={clickMode ? () => fire(p.cat.key) : undefined}
              style={{ position: 'absolute', left: p.dx, top: p.dy, transform: p.dy < 0 ? 'translate(-50%, calc(-100% + ' + M.petal / 2 + 'px))' : 'translate(-50%, -' + M.petal / 2 + 'px)', display: 'flex', flexDirection: p.dy < 0 ? 'column-reverse' : 'column', alignItems: 'center', gap: 2, padding: 0, border: 'none', pointerEvents: clickMode ? 'auto' : 'none', background: 'transparent', cursor: clickMode ? 'pointer' : 'default', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-regular)', color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
              <span style={{ width: M.petal, height: M.petal, boxSizing: 'border-box', borderRadius: '50%', background: p.cat.wash, boxShadow: on ? 'inset 0 0 0 2px var(--border-strong), var(--lift-2)' : 'var(--lift-1)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}><TagGlyph glyph={p.cat.glyph} /></span>
              <span style={{ padding: '0 5px', borderRadius: 'var(--radius-pill)', background: on ? p.cat.wash : 'var(--surface-paper)', boxShadow: on ? 'var(--lift-2)' : 'var(--lift-1)', lineHeight: M.label + 'px', transition: 'var(--transition-wash-tracking)' }}>{shortOf(p.cat)}</span>
            </button>
          )
        })}
</Fragment>) : null
  const pinned = !!ring && ring.mode === 'pin'
  const layer = !ring || pinned || typeof document === 'undefined' ? null : portalInto(document.body, (
    <div role={clickMode ? 'menu' : undefined} aria-label="flag type"
      onMouseDown={blocking ? (e) => { if (e.target === e.currentTarget) close() } : undefined}
      onContextMenu={blocking ? (e) => { e.preventDefault(); close() } : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: M.layer, pointerEvents: blocking ? 'auto' : 'none' }}>
      <div style={{ position: 'absolute', left: ring.x, top: ring.y, width: 0, height: 0 }}>{ringBody}</div>
    </div>
  ))
  return (
    <span style={{ position: 'relative', display: 'inline-grid' }}>
      {pinned ? <span role="menu" aria-label="flag type" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: M.layer }}>{ringBody}</span> : null}
      <button ref={btn} type="button" aria-label={name} aria-haspopup="menu" aria-expanded={!!ring} title={ring ? undefined : wrapTip(tip)}
        onPointerDown={down}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); open('click') }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fire('usual') }
          else if (e.key === 'ArrowUp' || e.key === 'ContextMenu') { e.preventDefault(); e.stopPropagation(); open('click') }
        }}
        onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
        style={{ position: 'relative', display: 'grid', placeItems: 'center', width: M.chip, height: M.chip, padding: 0, boxSizing: 'border-box', borderRadius: '50%', border: 'none', overflow: 'hidden', background: usualCat ? usualCat.wash : 'var(--surface-paper)', boxShadow: hot || ring || holding ? 'var(--lift-2)' : 'var(--lift-1)', cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', transition: 'var(--transition-wash)', ...style }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', background: hot && !holding && !ring ? 'var(--surface-press)' : 'transparent', transition: 'var(--transition-wash)' }} />
        <span ref={fillRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', visibility: holding ? 'visible' : 'hidden' }} />
        <span aria-hidden="true" style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>{usualCat ? <TagGlyph glyph={usualCat.glyph} /> : ''}</span>
      </button>
      {layer}
    </span>
  )
}

/** the petal geometry under a reachable name, for cards and probes. */
export const FlagRing = {
  angles: ANGLES,
  otherAngles: OTHER_ANGLES,
  petalAt(i: number) { const a = (ANGLES[i] * Math.PI) / 180; return { dx: Math.round(Math.cos(a) * radiusOf()), dy: Math.round(Math.sin(a) * radiusOf()) } },
}
