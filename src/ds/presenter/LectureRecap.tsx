import { Fragment, isValidElement, cloneElement, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

import { wrapTip } from '../chrome/IconButton'
import { Pane } from '../chrome/Pane'
import { LEGEND_INSET } from '../chrome/PaneHeader'
import { PillButton } from '../chrome/PillButton'
import { WalkerMark } from '../chrome/WalkerMark'
import { FlagChip } from './FlagChip'
import { LECTURE_NOTES_METRICS } from './LectureNotes'
import { StartMath } from './PresentStartCard'
import type { PresentStartCardProps, StartSession } from './PresentStartCard'

/* Typed port of the DS components/presenter/LectureRecap.jsx (contract: LectureRecap.d.ts),
   v4: the preview column beside the review notes, the session and the next-time line. */

export interface RecapStat {
  /** the numeral, verbatim - "6", "21:05". Set at display size, tabular */
  value: string | number
  /** two or three words under it, sentence case: "stops covered", "notes taken" */
  label: string
}

/** The recap's numbers. */
export const LECTURE_RECAP_METRICS = { aside: LECTURE_NOTES_METRICS.aside, statValue: 26, statPad: 18, headPad: '15px 18px', step: 26 }

const two = (n: number) => (n < 10 ? '0' : '') + n
const mmss = (s: number) => { s = Math.max(0, Math.floor(Number(s) || 0)); return two(Math.floor(s / 60)) + ':' + two(s % 60) }
const clockLabel = (t: number | Date, withDate?: boolean) => {
  const d = new Date(t)
  const time = two(d.getHours()) + ':' + two(d.getMinutes())
  if (!withDate) return time
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' }) + ' ' + d.getFullYear() + ' ' + time
}
const span = (startedAt?: number | Date | null, endedAt?: number | Date | null) => {
  const out: { started?: string; ended?: string } = {}
  if (startedAt != null) out.started = clockLabel(startedAt, true)
  if (endedAt != null) out.ended = clockLabel(endedAt, !(startedAt != null && new Date(startedAt).toDateString() === new Date(endedAt).toDateString()))
  return out
}
export const LectureClock = { mmss, clockLabel, span }

/** THE STAT WORDING, AS CODE: `counts` in, three `{ value, label }` out, plural decided here. */
export const recapStats = ({ stops, slides, flags, notes, flagged }: { stops: number; slides?: number; flags?: number; notes?: number; flagged?: number }): RecapStat[] => (flags != null ? [
  { value: stops, label: stops === 1 ? 'stop covered' : 'stops covered' },
  { value: slides == null ? 0 : slides, label: slides === 1 ? 'slide flagged' : 'slides flagged' },
  { value: flags, label: flags === 1 ? 'flag' : 'flags' },
] : [
  { value: stops, label: stops === 1 ? 'stop covered' : 'stops covered' },
  { value: notes == null ? 0 : notes, label: notes === 1 ? 'note taken' : 'notes taken' },
  { value: flagged == null ? 0 : flagged, label: flagged === 1 ? 'slide flagged' : 'slides flagged' },
])

const nextTimeRuns = (last?: StartSession['last'], walks?: PresentStartCardProps['walks'], lead?: string): Array<[string, boolean]> | null => {
  if (!last) return null
  const r = StartMath.resolve({ last }, null, walks)
  return r.kind === 'continue' ? ([([lead != null ? lead : 'Next time, continue picks up at ', false] as [string, boolean])].concat(r.lineEm) as Array<[string, boolean]>) : r.lineEm
}
export const RecapMath = { stats: recapStats, nextTime: nextTimeRuns }

/** THE SESSION THE LECTURE WAS RECORDED AGAINST. Read-only here. */
function SessionLine({ session, untitled }: { session: StartSession; untitled: string }) {
  const name = session.name || ''
  const days = StartMath.meetsLabel(session.meets)
  return (
    <div title={wrapTip('the session this lecture was recorded against')} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22, minWidth: 0 }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', fontWeight: 'var(--fw-semibold)', color: name ? 'var(--text-2)' : 'var(--text-3)', fontStyle: name ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>{name || untitled}</span>
      {days ? <span style={{ flexShrink: 0, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>{days}</span> : null}
    </div>
  )
}

/** ONE STAT. Divided by a hairline rather than by space. */
function Stat({ stat, first }: { stat: RecapStat; first: boolean }) {
  return (
    <div style={{ padding: '0 ' + LECTURE_RECAP_METRICS.statPad + 'px', borderLeft: first ? 'none' : '1px solid var(--border-hair)' }}>
      <b style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: LECTURE_RECAP_METRICS.statValue, lineHeight: 1.1, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', fontVariantNumeric: 'var(--tnum)' }}>{stat.value}</b>
      <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>{stat.label}</span>
    </div>
  )
}

/** ‹ AND › ON THE SHOWN SLIDE. Disabled at the first and the last slide. */
function StepButton({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  const [hot, setHot] = useState(false)
  const name = dir < 0 ? 'previous slide' : 'next slide'
  return (
    <button type="button" aria-label={name} title={wrapTip(name)} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ position: 'absolute', top: '50%', [dir < 0 ? 'left' : 'right']: -LECTURE_RECAP_METRICS.step / 3, width: LECTURE_RECAP_METRICS.step, height: LECTURE_RECAP_METRICS.step, marginTop: -LECTURE_RECAP_METRICS.step / 2, zIndex: 3, padding: 0, boxSizing: 'border-box', borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'var(--surface-paper)', border: '1px solid ' + (hot && !disabled ? 'var(--border-strong)' : 'var(--border-rule)'), boxShadow: 'var(--lift-2)',
        color: hot && !disabled ? 'var(--text-1)' : 'var(--text-2)', opacity: disabled ? 'var(--opacity-disabled)' : 1, cursor: disabled ? 'default' : 'pointer', transition: 'var(--transition-wash)' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={dir < 0 ? 'M6.3 2 3.3 5l3 3' : 'M3.7 2l3 3-3 3'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}

export interface RecapAction {
  label: string
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'neutral'
  onSelect?: () => void
}

export interface LectureRecapProps {
  /** the course name, set at display size in the head band */
  course: string
  /** what was covered - no day or time, the clock line already says when */
  when?: string
  /** the caps line above the course name. Composed from `elapsed`/`booked` when omitted */
  eyebrow?: string
  /** "21:05" - the clock as it stopped, verbatim. Prefer `elapsedS` */
  elapsed?: string
  /** "50:00" - the booked length, verbatim. Prefer `bookedS` */
  booked?: string
  /** seconds; printed as mm:ss by `LectureClock.mmss` */
  elapsedS?: number
  /** the booked length in seconds; printed as mm:ss */
  bookedS?: number
  /** the wall clock when the lecture STARTED, verbatim - an override for `startedAt` */
  started?: string
  /** the wall clock when it ENDED, verbatim - an override for `endedAt` */
  ended?: string
  /** the instant the lecture started (ms or Date); printed with its date */
  startedAt?: number | Date | null
  /** the instant it ended; printed with its date only when that is a different day */
  endedAt?: number | Date | null
  /** the three numbers, read off the host's store; the recap words them */
  counts?: { stops: number; slides?: number; flags?: number; notes?: number; flagged?: number }
  /** the stats verbatim - an override for `counts`, for a host composing more */
  stats?: RecapStat[]
  /** the notes pane - `<LectureNotes variant="review" />`, AS AN ELEMENT: the recap adds its
   *  preview to it as `aside`. Do not pass `aside` yourself */
  notes?: ReactNode
  /** THE SHOWN SLIDE'S PICTURE - the host renders it, as it renders the film roll's cards */
  slide?: ReactNode
  /** the shown slide's index in the walk. The HOST holds it: 0 until something is clicked */
  shownStop?: number
  /** the walk's stop titles by index - gives the legend its title and the step buttons their ends */
  stops?: string[]
  /** the walk's length, when `stops` is not passed */
  stopCount?: number
  /** the step buttons asked for this index (already clamped). Omit and they are absent */
  onShowStop?: (index: number) => void
  /** the aside's legend verbatim - an override for "preview" */
  slideLabel?: string
  /** the flag chip on the shown slide made a flag of this type. Add a BARE flag to the shown
   *  slide. Omit and no chip is drawn */
  onFlag?: (category: string) => void
  /** the chip's three types. Default the first three of `NOTE_CATEGORIES` */
  flagTypes?: Array<{ key: string; glyph: string; label: string; short?: string; wash: string }>
  /** the usual type's key - what a tap makes. Default 'fix' */
  usualFlag?: string
  /** a type picked on the ring that is not the usual one: it is now. Store it */
  onUsualFlagChange?: (key: string) => void
  /** the chip's hint tooltip. Default true */
  flagHint?: boolean
  /** the closing actions, under the rule at the band's foot */
  actions?: RecapAction[]
  /** the aside column's width. Default `LECTURE_RECAP_METRICS.aside` */
  asideWidth?: number
  /** the recap's own style overrides */
  style?: CSSProperties
  /** the session the lecture was recorded against, named beside the course */
  session?: StartSession
  /** what an unnamed session is called. Default "Untitled session" */
  untitledLabel?: string
  /** the walks, so "next time" can name the one that comes next */
  walks?: PresentStartCardProps['walks']
  /** the lead-in before "next time" resumes the walk */
  nextLead?: string
  /** @deprecated v4 - the old flagged-slides list. Accepted and ignored */
  flagged?: Array<{ id?: string | number; title?: string; stop?: number }>
}

export function LectureRecap({
  course, when, eyebrow, elapsed, booked, started, ended, stats, notes,
  elapsedS, bookedS, startedAt, endedAt, counts,
  slide, shownStop = 0, stops, stopCount, onShowStop, slideLabel,
  onFlag, flagTypes, usualFlag, onUsualFlagChange, flagHint,
  actions = [], asideWidth = LECTURE_RECAP_METRICS.aside, style,
  session, untitledLabel = 'Untitled session', walks, nextLead,
}: LectureRecapProps) {
  const clock = span(startedAt, endedAt)
  const elapsedTxt = elapsed != null ? elapsed : elapsedS != null ? mmss(elapsedS) : undefined
  const bookedTxt = booked != null ? booked : bookedS != null ? mmss(bookedS) : undefined
  const startedTxt = started != null ? started : clock.started
  const endedTxt = ended != null ? ended : clock.ended
  const statList = stats || (counts ? recapStats(counts) : [])
  const count = stopCount != null ? stopCount : stops ? stops.length : 0
  const at = Math.max(0, Math.min(count ? count - 1 : 0, shownStop || 0))
  const legend = slideLabel != null ? slideLabel : 'Preview'
  const nextRuns = nextTimeRuns(session && session.last, walks, nextLead)
  const line = eyebrow != null ? eyebrow : 'lecture ended' + (elapsedTxt ? ' · ' + elapsedTxt : '') + (elapsedTxt && bookedTxt ? ' of ' + bookedTxt : '')
  const notesEl = isValidElement(notes) ? (notes as ReactElement<Record<string, unknown>>) : null
  const preview = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 1 auto', minHeight: 0, aspectRatio: '1120 / 630' }}>
        <div style={{ position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: '1120 / 630' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-frame)', background: 'var(--bark-50)' }}>{slide}</div>
          {onFlag ? <span style={{ position: 'absolute', right: 6, top: 6, zIndex: 3 }}><FlagChip types={flagTypes} usual={usualFlag} onUsualChange={onUsualFlagChange} hint={flagHint} onFlag={onFlag} /></span> : null}
          {onShowStop && count > 1 ? <StepButton dir={-1} disabled={at <= 0} onClick={() => onShowStop(at - 1)} /> : null}
          {onShowStop && count > 1 ? <StepButton dir={1} disabled={at >= count - 1} onClick={() => onShowStop(at + 1)} /> : null}
        </div>
      </div>
      {count ? <div style={{ flexShrink: 0, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>{'stop ' + (at + 1) + ' of ' + count}</div> : null}
    </div>
  )
  return (
    <div data-lecture-recap="" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', padding: LECTURE_RECAP_METRICS.headPad, boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)' }}>{line}</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 6 }}>
            <div style={{ minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.2, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', textWrap: 'pretty' }}>{course}</div>
            {session ? <SessionLine session={session} untitled={untitledLabel} /> : null}
          </div>
          {startedTxt || endedTxt ? (
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(startedTxt || '') + (startedTxt && endedTxt ? ' – ' : '') + (endedTxt || '')}
            </div>
          ) : null}
          {when ? <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)', marginTop: 6, textWrap: 'pretty' }}>{when}</div> : null}
        </div>
        <div data-recap-stats="" style={{ display: 'flex', flexShrink: 0, marginLeft: 'auto' }}>
          {statList.map((s, i) => <Stat key={s.label || i} stat={s} first={i === 0} />)}
        </div>
      </div>
      {nextRuns || actions.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-hair)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>
          {nextRuns ? (<Fragment>
          <span style={{ display: 'flex', flexShrink: 0, marginLeft: -5, transform: 'translateY(-1px)', color: 'var(--acorn-600)' }}><WalkerMark size={16} /></span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextRuns.map((r, i) => (r[1] ? <span key={i} style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{r[0]}</span> : <Fragment key={i}>{r[0]}</Fragment>))}</span>
          </Fragment>) : null}
          {actions.length ? (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingLeft: 16 }}>
              {actions.map((a, i) => <PillButton key={a.label || i} size="sm" tone={a.tone || 'quiet'} onClick={a.onSelect}>{a.label}</PillButton>)}
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--space-3)' }}>
        {notesEl ? cloneElement(notesEl, { aside: preview, asideLabel: notesEl.props.asideLabel != null ? notesEl.props.asideLabel : legend, asideWidth: notesEl.props.asideWidth != null ? notesEl.props.asideWidth : asideWidth }) : (
          <Fragment>
            {notes}
            <Pane title={legend} scroll="none" bodyStyle={{ padding: '4px 16px 12px ' + LEGEND_INSET + 'px' }} style={{ flexShrink: 0, width: asideWidth, minHeight: 0 }}>{preview}</Pane>
          </Fragment>
        )}
      </div>
    </div>
  )
}
