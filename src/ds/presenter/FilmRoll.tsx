import { Fragment, useEffect, useRef, useState } from 'react'
import type { FocusEvent, ReactNode } from 'react'

import { ExpandMark } from '../chrome/ExpandMark'
import { FlagMark } from '../chrome/FlagMark'
import { useRecede, wrapTip } from '../chrome/IconButton'
import { settleRead } from '../chrome/MeasureBox'
import { FlagChip } from './FlagChip'

/* Typed port of the DS components/presenter/FilmRoll.jsx (contract: FilmRoll.d.ts), v4. */

const ASPECT = 630 / 1120

interface MirrorProps {
  width: number
  content?: ReactNode
  cornerLabel?: string
  live?: boolean
  projecting?: boolean
  dim?: boolean
  flagged?: boolean
  elapsed?: string
  onToggleFlag?: () => void
  onExpand?: () => void
  onNavigate?: () => void
  chip?: ReactNode
  card: 'live' | 'neighbour'
}

function Mirror({ width, content, cornerLabel, live, projecting = true, dim, flagged, elapsed, onToggleFlag, onExpand, onNavigate, chip, card }: MirrorProps) {
  const [hot, setHot] = useState(false)
  const [hovered, showReveal, hideReveal] = useRecede()
  const [focusIn, setFocusIn] = useState(false)
  const revealed = hovered || focusIn
  const onFocus = () => setFocusIn(true)
  const onBlur = (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false) }
  const height = Math.round(width * ASPECT)
  const glyphSize = dim ? 13 : 16
  const clickable = !!onNavigate
  const enter = () => { setHot(true); showReveal() }
  const leave = () => { setHot(false); hideReveal() }
  return (
    <div data-filmroll-card={card} onMouseEnter={enter} onMouseLeave={leave} onFocus={onFocus} onBlur={onBlur} onClick={onNavigate} style={{
      position: 'relative', flexShrink: 0, width, height, overflow: 'hidden', cursor: clickable ? 'pointer' : 'default',
      background: 'var(--bark-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
      boxShadow: live ? 'var(--lift-3)' : 'none', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>{content}</div>
      {dim ? <div style={{ position: 'absolute', inset: 0, background: 'var(--bark-200)', opacity: clickable && hot ? 0.32 : 0.58, transition: 'var(--transition-wash)' }} /> : null}
      {cornerLabel ? (
        <div data-filmroll-label="" style={{
          position: 'absolute', left: 0, top: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', background: 'var(--bark-800)', color: 'var(--bark-100)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)',
          letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', borderRadius: '0 0 var(--radius-xs) 0',
          opacity: dim ? (clickable && hot ? 0.85 : 0.7) : 1, transition: 'var(--transition-wash)',
        }}>
          {live ? (projecting ? <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--moss-300)', flexShrink: 0 }} /> : <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-pill)', border: '1px solid var(--bark-400)', boxSizing: 'border-box', flexShrink: 0 }} />) : null}
          {cornerLabel}
          {live && elapsed ? (
            <Fragment>
              <span style={{ width: 1, height: 10, background: 'var(--bark-600)', flexShrink: 0 }} />
              <span data-filmroll-elapsed="" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-regular)', letterSpacing: 0, textTransform: 'none', color: 'var(--bark-300)' }}>{elapsed}</span>
            </Fragment>
          ) : null}
        </div>
      ) : null}
      {chip ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3 }}>{chip}</span>
      ) : onToggleFlag ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3, opacity: flagged ? (dim ? (hot ? 0.85 : 0.7) : 1) : (revealed ? 1 : 0), pointerEvents: flagged || revealed ? 'auto' : 'none', transition: 'opacity var(--dur-fade) var(--ease-soft)' }}>
          <FlagButton flagged={flagged} dim={dim} glyphSize={glyphSize} onClick={onToggleFlag} />
        </span>
      ) : flagged ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3, opacity: dim ? 0.7 : 1, transition: 'var(--transition-wash)' }}>
          <FlagButton flagged dim={dim} glyphSize={glyphSize} />
        </span>
      ) : null}
      {live && onExpand ? (
        <ExpandButton onClick={onExpand} revealed={revealed} />
      ) : null}
    </div>
  )
}

/** THE FLAG MARK, on its own. Filled acorn and full opacity when `flagged`; an outline at reduced
 *  opacity when not. */
export interface FlagButtonProps {
  /** filled acorn and full opacity when flagged; an outline at reduced opacity when not */
  flagged?: boolean
  /** on a dimmed neighbour card: lower rest and hover opacities */
  dim?: boolean
  /** the mark, px. Default 12 */
  glyphSize?: number
  /** the hit box, px. Default 24 (a slide corner); 20 beside a 20px pencil in a pane head */
  size?: number
  /** px the mark is lifted inside the button. Default 0 */
  lift?: number
  /** the per-slide switch; omitted, the mark is a readout with no hover wash */
  onClick?: () => void
  /** default "flag this slide", in both states - also the button's spoken name */
  title?: string
  /** pass -1 only where the reveal around it cannot be opened by focus */
  tabIndex?: number
}

export function FlagButton({ flagged, dim, glyphSize = 12, size = 24, lift = 0, onClick, title, tabIndex }: FlagButtonProps) {
  const [hot, setHot] = useState(false)
  const name = title || 'flag this slide'
  return (
    <button type="button" title={wrapTip(name)} aria-label={name}
      aria-pressed={onClick ? !!flagged : undefined} tabIndex={tabIndex}
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        display: 'grid', placeItems: 'center', width: size, height: size, borderRadius: 'var(--radius-pill)', padding: 0,
        border: 'none', cursor: onClick ? 'pointer' : 'default',
        background: hot ? (flagged ? 'var(--accent-walk-wash)' : 'var(--surface-hover)') : 'transparent',
        transition: 'var(--transition-wash)',
        opacity: flagged ? 1 : (hot ? (dim ? 0.7 : 0.85) : (dim ? 0.4 : 0.5)),
        color: flagged ? 'var(--acorn-600)' : (hot ? 'var(--text-1)' : 'var(--text-2)'),
      }}>
      <FlagMark size={glyphSize} filled={!!flagged} style={lift ? { transform: 'translateY(-' + lift + 'px)' } : undefined} />
    </button>
  )
}

function ExpandButton({ onClick, revealed }: { onClick?: () => void; revealed: boolean }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" title={wrapTip('full screen')} aria-label="full screen"
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', right: 9, bottom: 9, zIndex: 3, width: 26, height: 26, borderRadius: 7,
        display: 'grid', placeItems: 'center', background: hot ? 'var(--bark-800)' : 'color-mix(in srgb, var(--surface-raised) 92%, transparent)',
        border: '1px solid ' + (hot ? 'var(--bark-800)' : 'var(--border-rule)'),
        color: hot ? 'var(--text-inverse)' : 'var(--text-1)', boxShadow: hot ? 'var(--lift-2)' : 'var(--lift-1)',
        opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none',
        cursor: 'pointer', transition: 'var(--transition-wash), opacity var(--dur-fade) var(--ease-soft)',
      }}>
      <ExpandMark size={13} />
    </button>
  )
}

function EdgeChevron({ dir, onClick, roomHot, traveling }: { dir: -1 | 1; onClick: () => void; roomHot: boolean; traveling: boolean }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" title={wrapTip(dir < 0 ? 'previous stop' : 'next stop')} aria-label={dir < 0 ? 'previous stop' : 'next stop'}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', [dir < 0 ? 'left' : 'right']: 6, top: '50%',
        transform: 'translateY(-50%) translateX(' + (traveling ? dir * 3 : 0) + 'px)',
        width: 30, height: 60, zIndex: 4, border: 'none', background: 'transparent', color: 'var(--bark-500)',
        opacity: traveling ? 1 : (hot ? 0.85 : (roomHot ? 0.6 : 0.4)), cursor: 'pointer', display: 'grid', placeItems: 'center',
        transition: 'var(--transition-wash), opacity var(--dur-hover) var(--ease-soft), transform var(--dur-move) var(--ease-settle)',
      }}>
      <svg width="20" height="40" viewBox="0 0 30 60" aria-hidden="true">
        <path d={dir < 0 ? 'M22 6 L8 30 L22 54' : 'M8 6 L22 30 L8 54'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export interface FilmRollNeighbour {
  content: ReactNode
  stopLabel: string
  flagged?: boolean
  onNavigate?: () => void
}

export interface FilmRollLive {
  content: ReactNode
  flagged?: boolean
  elapsed?: string
  stopIndex?: number
}

export interface FilmRollProps {
  /** the roll's reference height in px at scale 1 - the fill scales it with the widths */
  height?: number
  /** the live card's reference width in px at scale 1 */
  liveWidth?: number
  /** a neighbour's reference width in px at scale 1 */
  neighborWidth?: number
  /** how far the fill scale may shrink the reference sizes. Default 0.55 */
  minScale?: number
  /** how far the fill scale may grow the reference sizes. Default 1.6 */
  maxScale?: number
  /** the live card's corner label. Default "On the projector now", or the negation when
   *  `projecting` is false; pass a string to override either */
  liveLabel?: string
  /** is the live slide actually on the projector. Default true. False = preview: negated
   *  label, hollow ring instead of the moss dot, `current.elapsed` hidden */
  projecting?: boolean
  /** the previous slide, or `null`/`undefined` at the first stop - no card renders there,
   *  its width stays reserved so the live card doesn't recentre */
  prev?: FilmRollNeighbour | null
  /** the live slide. `elapsed` is the running time on this stop; `stopIndex` is its position
   *  in the walk, whose change plays the travel frame */
  current?: FilmRollLive | null
  /** the next slide, or `null`/`undefined` at the last stop */
  next?: FilmRollNeighbour | null
  /** v4: the current frame wears `FlagChip`, and this adds a BARE FLAG of the chosen type to
   *  the shown slide - the same entry the notes pane's composer writes */
  onFlag?: (category: string) => void
  /** the ring's three types. Default `NOTE_CATEGORIES` (the first three of the user's list) */
  flagTypes?: Array<{ key: string; glyph: string; label: string; short?: string; wash: string }>
  /** the usual type's key - what a tap makes. Default 'fix', host-held and stored */
  usualFlag?: string
  /** a type picked on the ring that is not the usual one: it is now. Store it against the user */
  onUsualFlagChange?: (key: string) => void
  /** the chip's "tap to flag - hold to change flag" tooltip. Default true */
  flagHint?: boolean
  /** fired each time the ring opens - for a host counting toward switching `hint` off */
  onFlagRingOpen?: () => void
  /** @deprecated v4 - the per-slide switch. Ignored once `onFlag` is passed */
  onToggleFlag?: (which: 'prev' | 'current' | 'next') => void
  /** full screen, live card only, revealed on hover or when focus is inside the card */
  onExpand?: () => void
}

export function FilmRoll({
  height = 286, liveWidth = 470, neighborWidth = 336, liveLabel, projecting = true,
  prev, current, next, onToggleFlag, onExpand, minScale = 0.55, maxScale = 1.6,
  onFlag, flagTypes, usualFlag, onUsualFlagChange, flagHint, onFlagRingOpen,
}: FilmRollProps) {
  const toggle = onFlag ? undefined : onToggleFlag
  const chip = onFlag ? <FlagChip types={flagTypes} usual={usualFlag} onUsualChange={onUsualFlagChange} hint={flagHint} onFlag={onFlag} onRingOpen={onFlagRingOpen} /> : null
  const label = liveLabel != null ? liveLabel : projecting ? 'On the projector now' : 'Not on the projector'
  const [travelDir, setTravelDir] = useState(0)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const anim = useRef<Animation | null>(null)
  const stopIndex = current && typeof current.stopIndex === 'number' ? current.stopIndex : null
  const lastIndex = useRef<number | null>(stopIndex)
  useEffect(() => () => { if (anim.current) anim.current.cancel() }, [])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [roomHot, setRoomHot] = useState(false)
  const gap = 8
  const chevronPad = 16
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const refWidth = neighborWidth * 2 + liveWidth + gap * 2
    const read = () => {
      const box = wrapRef.current
      if (!box) return
      const w = box.getBoundingClientRect().width - chevronPad * 2
      if (!w) return
      setScale(Math.max(minScale, Math.min(maxScale, w / refWidth)))
    }
    const stop = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, [liveWidth, neighborWidth, minScale, maxScale])
  const sLive = Math.round(liveWidth * scale)
  const step = Math.round(((liveWidth + neighborWidth) / 2 + gap) * scale)
  const play = (dir: -1 | 1) => {
    const row = rowRef.current
    if (!dir || !row || typeof row.animate !== 'function') return
    if (anim.current) anim.current.cancel()
    const cs = getComputedStyle(row)
    const raw = (cs.getPropertyValue('--dur-move') || '').trim()
    const duration = raw.slice(-2) === 'ms' ? parseFloat(raw) : raw.slice(-1) === 's' ? parseFloat(raw) * 1000 : 200
    const easing = (cs.getPropertyValue('--ease-settle') || '').trim() || 'ease-out'
    setTravelDir(dir)
    const a = row.animate(
      [{ transform: 'translateX(' + dir * step + 'px)', opacity: 0.5 }, { transform: 'translateX(0px)', opacity: 1 }],
      { duration: duration || 1, easing, fill: 'none' },
    )
    anim.current = a
    const done = () => { if (anim.current === a) { anim.current = null; setTravelDir(0) } }
    if (a.finished && typeof a.finished.then === 'function') a.finished.then(done, () => {})
    else a.onfinish = done
  }
  useEffect(() => {
    const from = lastIndex.current
    lastIndex.current = stopIndex
    if (stopIndex == null || from == null || stopIndex === from) return
    // the chevron's lean is state; the row's movement is the animation this fires
    // eslint-disable-next-line react-hooks/set-state-in-effect
    play(stopIndex > from ? 1 : -1)
  }, [stopIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = (dir: -1 | 1, fn: () => void) => () => { if (stopIndex == null) play(dir); fn() }
  const sNeighbor = Math.round(neighborWidth * scale)
  const sHeight = Math.round(height * scale)
  const sGap = Math.round(gap * scale)
  return (
    <div ref={wrapRef} data-filmroll="" onMouseEnter={() => setRoomHot(true)} onMouseLeave={() => setRoomHot(false)} style={{
      position: 'relative', height: sHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: sGap,
      background: 'var(--bark-100)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', boxSizing: 'border-box', padding: '0 ' + chevronPad + 'px', userSelect: 'none',
    }}>
      <div ref={rowRef} data-filmroll-row="" style={{ display: 'flex', alignItems: 'center', gap: sGap, willChange: 'transform' }}>
        {prev ? (
          <Mirror width={sNeighbor} content={prev.content} cornerLabel={'\u2190 ' + prev.stopLabel} dim card="neighbour"
            flagged={prev.flagged} onToggleFlag={toggle && (() => toggle('prev'))}
            onNavigate={prev.onNavigate && navigate(-1, prev.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
        <Mirror width={sLive} content={current && current.content} cornerLabel={label} live card="live" projecting={projecting}
          flagged={current ? current.flagged : undefined} elapsed={projecting && current ? current.elapsed : undefined}
          onToggleFlag={toggle && (() => toggle('current'))} onExpand={onExpand} chip={chip} />
        {next ? (
          <Mirror width={sNeighbor} content={next.content} cornerLabel={next.stopLabel + ' \u2192'} dim card="neighbour"
            flagged={next.flagged} onToggleFlag={toggle && (() => toggle('next'))}
            onNavigate={next.onNavigate && navigate(1, next.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
      </div>
      {prev && prev.onNavigate ? <EdgeChevron dir={-1} onClick={navigate(-1, prev.onNavigate)} roomHot={roomHot} traveling={travelDir === -1} /> : null}
      {next && next.onNavigate ? <EdgeChevron dir={1} onClick={navigate(1, next.onNavigate)} roomHot={roomHot} traveling={travelDir === 1} /> : null}
    </div>
  )
}
