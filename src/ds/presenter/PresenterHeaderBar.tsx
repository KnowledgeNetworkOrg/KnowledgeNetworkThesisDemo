import { useState } from 'react'

import { PillButton } from '../chrome/PillButton'
import { wrapTip } from '../chrome/IconButton'

/* Typed port of the DS components/presenter/PresenterHeaderBar.jsx (contract:
   PresenterHeaderBar.d.ts), part 1 of the presenter-mode split — OB-135 / #267. */

/** The state dot/ring that opens the chip. Presenting = filled acorn — the walk hue,
 *  because presenting is the one state actually moving the class through the corpus, the
 *  same reason `--border-walk` is reserved for "a walk-tinted control in its active
 *  state". Roaming = a DASHED, unfilled ring, carrying no hue at all: dashed always means
 *  conditional in this system (`--border-dashed`, `OptionalMark`), and roaming is exactly
 *  that — provisional, not yet committed as the lecture's own record. Drawn as an SVG
 *  `stroke-dasharray` ring rather than a CSS dashed border, same reason as `OptionalMark`:
 *  a CSS dashed circle renders unevenly at this size. Ended = a flat bark square, the
 *  same "nothing left to count" mark the clock loses. Preview = a SOLID, unfilled bark ring:
 *  the slot a lecture would fill, empty — nothing is projected, so there is no walk hue to
 *  carry and nothing conditional to dash. */
function StateDot({ state }: { state: PresenterState }) {
  if (state === 'preview') return <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-pill)', border: '1.2px solid var(--bark-400)', boxSizing: 'border-box', flexShrink: 0 }} />
  if (state === 'roaming') {
    const size = 11
    const r = size / 2 - 0.75
    return (
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0, display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bark-400)" strokeWidth="1.2" strokeDasharray="1.6 2.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (state === 'ended') return <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bark-400)', flexShrink: 0 }} />
  return <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', flexShrink: 0 }} />
}

/** The one status chip. The stop number (or the ended total) is set apart the way
 *  `CountBadge` sets its own number apart from its label — mono, tabular, full ink — so
 *  the two words carrying the STATE ("Presenting" / "Roaming" / "Lecture ended") read as
 *  a softer lead-in and the number is the thing the eye actually lands on, the same split
 *  every other numeral in this system already uses. Still one pill, one baseline row. */
function StateChip({ state, activeStop, roamingStop, endedTotal }: { state: PresenterState; activeStop: number; roamingStop?: number; endedTotal?: string }) {
  const roaming = state === 'roaming'
  const ended = state === 'ended'
  const preview = state === 'preview'
  const verb = preview ? 'Preview' : ended ? 'Lecture ended' : roaming ? 'Roaming' : 'Presenting'
  const numeral = ended ? endedTotal : `stop ${roaming ? roamingStop : activeStop}`
  const tip = preview ? 'the presenter layout, nothing projected — ▶ on the app toolbar starts the lecture' : roaming ? `roaming stop ${roamingStop} — the active node is still stop ${activeStop}` : ended ? 'the lecture is over — ▶ on the app toolbar resumes it' : 'the active node, and what the class is looking at'
  return (
    <span data-presenter-chip={state} title={wrapTip(tip)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px 0 8px',
      borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap', boxSizing: 'border-box',
      border: (roaming ? '1.5px dashed var(--border-dashed)' : ended || preview ? '1px solid var(--border-rule)' : '1px solid var(--border-walk)'),
      background: roaming || preview ? 'var(--surface-paper)' : ended ? 'var(--bark-100)' : 'var(--accent-walk-wash)',
    }}>
      <StateDot state={state} />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', opacity: 0.75, lineHeight: 1, color: roaming || ended || preview ? 'var(--text-2)' : 'var(--text-walk)' }}>{verb}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', lineHeight: 1, color: roaming || preview ? 'var(--text-2)' : ended ? 'var(--text-1)' : 'var(--text-walk)' }}>{numeral}</span>
    </span>
  )
}

/** Elapsed time, with the booked length over a hairline when the caller has one. The
 *  ratio is the caller's to compute (`progressPct`) — this component reads a number, it
 *  does not parse "18:42" against "50:00" to get one. */
function Clock({ elapsed, bookedLength, progressPct }: { elapsed?: string; bookedLength?: string; progressPct?: number }) {
  if (bookedLength == null) return (
    <span data-presenter-clock style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
      {elapsed}<i style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>elapsed</i>
    </span>
  )
  return (
    <span data-presenter-clock style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
        {elapsed}<i style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>of {bookedLength}</i>
      </span>
      <span style={{ width: 56, height: 2, borderRadius: 2, background: 'var(--bark-100)', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (progressPct == null ? 0 : progressPct) + '%', background: 'var(--accent-walk)', borderRadius: 2 }} />
      </span>
    </span>
  )
}

/** ■, always ■, in its own grey wash so it reads as the one control in the bar rather than a
 *  stray glyph. No red, no fill: ending a lecture is normal, not destructive. Once ended it
 *  stays a stop button and FADES — there is nothing left to stop — rather than turning into ▶:
 *  the bar never starts or resumes a lecture; that is the host's toolbar's job, and a play mark
 *  here beside a play mark there said two different things (owner, 2026-09-03). In PREVIEW it is
 *  faded the same way: nothing is projected, so there is nothing to stop (owner, 2026-09-03). */
function EndButton({ state, onEndClick }: { state: PresenterState; onEndClick?: () => void }) {
  const [hot, setHot] = useState(false)
  const ended = state === 'ended' || state === 'preview'
  return (
    <button type="button" disabled={ended} aria-disabled={ended} aria-label="end lecture"
      title={wrapTip(state === 'preview' ? 'nothing is projected — ▶ on the app toolbar starts the lecture' : ended ? 'the lecture has ended — ▶ on the app toolbar resumes it' : 'end lecture')}
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

/** The confirm's one line — fixed, so no call site retypes it. */
const END_MESSAGE = 'You can resume from the same place later on.'

/** Washed grey, always, not on hover — the same face the ■ button itself wears. No
 *  PillButton tone matches (none washes a neutral fill at rest), and this must not read
 *  like a primary/success action: ending is not a win. Hover darkens one bark step,
 *  same ramp move every neutral control in this system makes. */
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

/** The one-line confirm before ■ does anything. It asks because ending is reversible but
 *  not silent — stops get recorded as covered the moment it happens — never because
 *  anything is destroyed; that is why it is a two-line popover off the button, not a
 *  dialog over the room. Neither button washes green: this is an ending, not a success. */
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
        {/* washed grey, not a PillButton tone — none of the five washes to a neutral
           fill AT REST, and this should read like the same grey the ■ button itself
           wears, not like a primary/success action (this is an ending, not a win) */}
        <EndLectureButton onClick={onConfirmEnd} />
      </div>
    </div>
  )
}

export type PresenterState = 'presenting' | 'roaming' | 'ended' | 'preview'

/** The bar at the top of presenter mode: course name, the ONE state chip (Presenting /
 *  Roaming / Ended / Preview), the clock, and the ■ control.
 *
 *  PREVIEW IS NOT A LECTURE (owner, 2026-09-03). `state === 'preview'` is the presenter LAYOUT
 *  shown without anything being projected — a professor looking at how the panes will sit. No
 *  clock is drawn (`elapsed`/`bookedLength`/`progressPct` are ignored — nothing is being timed),
 *  the chip reads "Preview stop N" in a neutral solid-ring mark with no walk hue and no dash,
 *  and ■ is disabled and faded exactly as when ended — there is nothing to stop. WHAT THE HOST
 *  MUST DO: start no clock while in preview; keep its own start control (the app toolbar's ▶)
 *  PRESSABLE, since pressing it is how a preview becomes the lecture; and on that press, start
 *  the clock from zero, not from when the preview opened.
 *
 *  THE BAR ENDS; IT NEVER STARTS OR RESUMES (2026-09-03). ■ is always ■. Once `state === 'ended'`
 *  it stays a stop button, disabled and faded to 0.4 — there is nothing left to stop — and does
 *  NOT become ▶. Starting and resuming a lecture belong to the host's own toolbar, so the
 *  professor has one play button on screen with one meaning.
 *
 *  ONCE ENDED, ■'S PLACE IS THE WAY OUT (owner, 21 Oct). Pass `onClose` and the ended bar draws a
 *  "close the presenter" pill (`neutral`, small) where the faded ■ was. It leaves; it does not
 *  resume. The recap then carries no close action of its own.
 *
 *  TWO MARKS, ONE SENTENCE SHAPE — BUT ONLY ONE OF THEM CARRIES THE WALK HUE. `activeStop` is
 *  the lecture's own record and wears acorn; `roamingStop` is only where the professor is
 *  currently looking — provisional — and wears the system's other standing convention: DASHED
 *  ALWAYS MEANS CONDITIONAL.
 *
 *  ENDING ASKS FIRST, AND IS NOT DESTRUCTIVE. ■ opens a confirm popover — CONTROLLED
 *  (`confirmOpen`), so the host can coordinate it with anything else on screen. Nothing is
 *  deleted by ending: notes and flags stay, and the lecture resumes from the same place. */
export interface PresenterHeaderBarProps {
  /** the course name, e.g. "Foundations of Computing" */
  course: string
  /** which of the four states the bar is in right now. `preview` = the layout with nothing
   *  projected: no clock, ■ faded, the host's start control stays pressable */
  state: PresenterState
  /** the active node's stop number (1-based) — always meaningful, even while roaming */
  activeStop: number
  /** the stop the professor is currently looking at, only while `state === 'roaming'` */
  roamingStop?: number
  /** "18:42" — omitted entirely once `state === 'ended'` (the clock has nothing left to count)
   *  and ignored in `preview` (nothing is being timed) */
  elapsed?: string
  /** "50:00" — when given, the clock adds "of {bookedLength}" over a hairline fill.
   *  Omit to fall back to a bare "{elapsed} elapsed" */
  bookedLength?: string
  /** 0–100, the hairline's fill against `bookedLength`. The caller computes this — the
   *  component reads a number, it does not parse two time strings against each other */
  progressPct?: number
  /** "21:05 total" — shown verbatim in the chip once `state === 'ended'`. The component adds
   *  nothing to it: pass the unit yourself, or a bare "21:05" for none */
  endedTotal?: string
  /** is the "End this lecture?" popover open. Controlled — the host owns this so it can
   *  close the popover on outside-click, escape, or any of its own logic */
  confirmOpen?: boolean
  /** ■ pressed while presenting or roaming — open the confirm popover. Never fires in
   *  `ended` or `preview`: the button is disabled in both */
  onEndClick?: () => void
  /** "End lecture" pressed inside the popover */
  onConfirmEnd?: () => void
  /** "Keep going" pressed inside the popover, or any outside-dismiss the host wires up */
  onCancelEnd?: () => void
  /** @deprecated never fired since 2026-09-03 — the bar has no ▶. Resume from the host's own
   *  toolbar instead; keep the handler there. Accepted and ignored so older call sites compile. */
  onResume?: () => void
  /** ENDED ONLY: the way out (owner, 21 Oct). Pass it and the ended bar draws a "close the presenter"
   *  pill where the faded ■ was. Omit it and the faded ■ stays. Pass the same handler the recap used
   *  to get in its `actions`, and do NOT pass it there too: one way out, one place */
  onClose?: () => void
  /** the pill's words. Default "close the presenter" */
  closeLabel?: string
}

export function PresenterHeaderBar({
  course, state = 'presenting', activeStop, roamingStop, elapsed, bookedLength, progressPct,
  endedTotal, confirmOpen, onEndClick, onConfirmEnd, onCancelEnd,
  onClose, closeLabel = 'close the presenter',
}: PresenterHeaderBarProps) {
  const ended = state === 'ended'
  const preview = state === 'preview'
  return (
    <div data-presenter-header={state} style={{
      flexShrink: 0, height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      gap: 'var(--space-3)', padding: '0 var(--space-4) 0 var(--space-5)',
      background: 'var(--surface-paper)', borderBottom: '1px solid var(--border-hair)', userSelect: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-title)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{course}</span>
        <StateChip state={state} activeStop={activeStop} roamingStop={roamingStop} endedTotal={endedTotal} />
      </span>
      {/* no clock in preview either: nothing is being timed */}
      {ended || preview ? null : <Clock elapsed={elapsed} bookedLength={bookedLength} progressPct={progressPct} />}
      <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        {/* ONCE ENDED, ■'S PLACE IS THE WAY OUT (owner, 21 Oct): the faded ■ said "nothing to stop" in
           the one spot the eye goes to leave, while "close the presenter" sat down in the recap. With
           `onClose`, the ended bar draws that pill there instead. Still no ▶: closing is leaving, not
           resuming. Without `onClose` the faded ■ stays, as before. Preview keeps its faded ■. */}
        {ended && onClose ? <PillButton size="sm" tone="neutral" onClick={onClose}>{closeLabel}</PillButton> : <EndButton state={state} onEndClick={onEndClick} />}
        {confirmOpen ? <EndConfirm onConfirmEnd={onConfirmEnd} onCancelEnd={onCancelEnd} /> : null}
      </span>
    </div>
  )
}
