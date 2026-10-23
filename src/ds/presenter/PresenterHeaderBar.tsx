import { useState } from 'react'

import { wrapTip } from '../chrome/IconButton'
import { PillButton } from '../chrome/PillButton'

/* Typed port of the DS components/presenter/PresenterHeaderBar.jsx (contract:
   PresenterHeaderBar.d.ts), with the ended bar's "close the presenter" pill (owner, 21 Oct). */

export type PresenterState = 'presenting' | 'roaming' | 'ended' | 'preview'

/** The state dot/ring that opens the chip. */
function StateDot({ state }: { state: PresenterState }) {
  if (state === 'preview') return <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-pill)', border: '1.2px solid var(--bark-400)', boxSizing: 'border-box', flexShrink: 0 }} />
  if (state === 'roaming') {
    const size = 11, r = size / 2 - 0.75
    return (
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0, display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bark-400)" strokeWidth="1.2" strokeDasharray="1.6 2.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (state === 'ended') return <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bark-400)', flexShrink: 0 }} />
  return <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', flexShrink: 0 }} />
}

/** The one status chip. */
function StateChip({ state, activeStop, roamingStop, endedTotal }: { state: PresenterState; activeStop: number; roamingStop?: number; endedTotal?: string }) {
  const roaming = state === 'roaming', ended = state === 'ended', preview = state === 'preview'
  const verb = preview ? 'Preview' : ended ? 'Lecture ended' : roaming ? 'Roaming' : 'Presenting'
  const numeral = ended ? endedTotal : `stop ${roaming ? roamingStop : activeStop}`
  const tip = preview ? 'the presenter layout, nothing projected \u2014 \u25b6 on the app toolbar starts the lecture' : roaming ? `roaming stop ${roamingStop} \u2014 the active node is still stop ${activeStop}` : ended ? 'the lecture is over \u2014 \u25b6 on the app toolbar resumes it' : 'the active node, and what the class is looking at'
  return (
    <span data-presenter-chip="" title={wrapTip(tip)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px 0 8px',
      borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap', boxSizing: 'border-box',
      border: (roaming ? '1.5px dashed var(--border-dashed)' : ended || preview ? '1px solid var(--border-rule)' : '1px solid var(--border-walk)'),
      background: roaming || preview ? 'var(--surface-paper)' : ended ? 'var(--bark-100)' : 'var(--accent-walk-wash)',
    }}>
      <StateDot state={preview ? 'preview' : ended ? 'ended' : roaming ? 'roaming' : 'presenting'} />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', opacity: 0.75, lineHeight: 1, color: roaming || ended || preview ? 'var(--text-2)' : 'var(--text-walk)' }}>{verb}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', lineHeight: 1, color: roaming || preview ? 'var(--text-2)' : ended ? 'var(--text-1)' : 'var(--text-walk)' }}>{numeral}</span>
    </span>
  )
}

/** Elapsed time, with the booked length over a hairline when the caller has one. */
function Clock({ elapsed, bookedLength, progressPct }: { elapsed?: string; bookedLength?: string; progressPct?: number }) {
  if (bookedLength == null) return (
    <span data-presenter-clock="" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
      {elapsed}<i style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>elapsed</i>
    </span>
  )
  return (
    <span data-presenter-clock="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
        {elapsed}<i style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>of {bookedLength}</i>
      </span>
      <span style={{ width: 56, height: 2, borderRadius: 2, background: 'var(--bark-100)', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (progressPct == null ? 0 : progressPct) + '%', background: 'var(--accent-walk)', borderRadius: 2 }} />
      </span>
    </span>
  )
}

/** The stop control, always a stop. Once ended or in preview it stays one, disabled and faded. */
function EndButton({ state, onEndClick }: { state: PresenterState; onEndClick?: () => void }) {
  const [hot, setHot] = useState(false)
  const ended = state === 'ended' || state === 'preview'
  return (
    <button type="button" disabled={ended} aria-disabled={ended} aria-label="end lecture"
      title={wrapTip(state === 'preview' ? 'nothing is projected \u2014 \u25b6 on the app toolbar starts the lecture' : ended ? 'the lecture has ended \u2014 \u25b6 on the app toolbar resumes it' : 'end lecture')}
      onClick={ended ? undefined : onEndClick}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{
        width: 26, height: 26, borderRadius: 'var(--radius-pill)', display: 'grid', placeItems: 'center',
        flexShrink: 0, boxSizing: 'border-box', cursor: ended ? 'default' : 'pointer',
        border: '1px solid ' + (!ended && hot ? 'var(--border-strong)' : 'var(--border-rule)'),
        background: !ended && hot ? 'var(--bark-200)' : 'var(--bark-100)',
        color: !ended && hot ? 'var(--text-1)' : 'var(--text-2)',
        opacity: ended ? 0.4 : 1,
        transition: 'var(--transition-wash)',
      }}>
      <span style={{ width: 8, height: 8, background: 'currentColor' }} />
    </button>
  )
}

const END_MESSAGE = 'You can resume from the same place later on.'

function EndLectureButton({ onClick }: { onClick?: () => void }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
      height: 24, padding: '0 14px', borderRadius: 'var(--radius-pill)', boxSizing: 'border-box',
      border: '1px solid ' + (hot ? 'var(--border-strong)' : 'var(--border-rule)'),
      background: hot ? 'var(--bark-200)' : 'var(--bark-100)', color: 'var(--text-1)',
      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
      whiteSpace: 'nowrap', transition: 'var(--transition-wash)',
    }}>end lecture</button>
  )
}

function EndConfirm({ onConfirmEnd, onCancelEnd }: { onConfirmEnd?: () => void; onCancelEnd?: () => void }) {
  return (
    <div role="dialog" aria-label="end this lecture" style={{
      position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 246, textAlign: 'left',
      background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--lift-3)', padding: 12, boxSizing: 'border-box', zIndex: 9,
    }}>
      <h6 style={{ margin: '0 0 5px', fontFamily: 'var(--font-ui)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>End this lecture?</h6>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-normal)', color: 'var(--text-2)' }}>{END_MESSAGE}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <PillButton size="sm" onClick={onCancelEnd}>keep going</PillButton>
        <EndLectureButton onClick={onConfirmEnd} />
      </div>
    </div>
  )
}

export interface PresenterHeaderBarProps {
  /** the course name, set at display size */
  course: string
  /** the one status chip's state: presenting, roaming, ended or preview */
  state: PresenterState
  /** the active stop's 1-based number, shown in the chip */
  activeStop: number
  /** where the professor is looking while roaming, 1-based */
  roamingStop?: number
  /** the elapsed clock, verbatim ("18:42") - the host formats it */
  elapsed?: string
  /** the booked length, verbatim ("50:00"); with it the clock draws its progress rule */
  bookedLength?: string
  /** 0-100, the progress rule's width - the caller computes it */
  progressPct?: number
  /** the total the chip shows once ended ("52:10 total") */
  endedTotal?: string
  /** is the end confirm open */
  confirmOpen?: boolean
  /** the stop button was pressed; the host opens its own confirm or sets `confirmOpen` */
  onEndClick?: () => void
  /** the confirm's "end lecture" */
  onConfirmEnd?: () => void
  /** the confirm's "keep going" */
  onCancelEnd?: () => void
  /** @deprecated never fired since 2026-09-03 - accepted and ignored */
  onResume?: () => void
  /** ENDED ONLY: the way out. Pass it and the bar draws a "close the presenter" pill */
  onClose?: () => void
  /** the close pill's words. Default "close the presenter" */
  closeLabel?: string
}

export function PresenterHeaderBar({
  course, state = 'presenting', activeStop, roamingStop, elapsed, bookedLength, progressPct,
  endedTotal, confirmOpen, onEndClick, onConfirmEnd, onCancelEnd,
  onClose, closeLabel = 'close the presenter',
}: PresenterHeaderBarProps) {
  const ended = state === 'ended', preview = state === 'preview'
  return (
    <div data-presenter-header="" style={{
      flexShrink: 0, height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      gap: 'var(--space-3)', padding: '0 var(--space-4) 0 var(--space-5)',
      background: 'var(--surface-paper)', borderBottom: '1px solid var(--border-hair)', userSelect: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-title)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{course}</span>
        <StateChip state={state} activeStop={activeStop} roamingStop={roamingStop} endedTotal={endedTotal} />
      </span>
      {ended || preview ? null : <Clock elapsed={elapsed} bookedLength={bookedLength} progressPct={progressPct} />}
      <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        {ended && onClose ? <PillButton size="sm" tone="neutral" onClick={onClose}>{closeLabel}</PillButton> : <EndButton state={state} onEndClick={onEndClick} />}
        {confirmOpen ? <EndConfirm onConfirmEnd={onConfirmEnd} onCancelEnd={onCancelEnd} /> : null}
      </span>
    </div>
  )
}
