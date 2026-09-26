import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { FlagMark } from '../chrome/FlagMark'
import { wrapTip } from '../chrome/IconButton'
import { Pane, PaneScroller } from '../chrome/Pane'
import { LEGEND_INSET } from '../chrome/PaneHeader'
import { PillButton } from '../chrome/PillButton'

/* Typed port of the DS components/presenter/LectureRecap.jsx (contract: LectureRecap.d.ts) —
   part 7 of the presenter-mode split (OB-147, #267). */

/** The recap's numbers. `aside` (360) is the same column the quick actions deck stands in during
 *  the lecture, so nothing moves sideways when the lecture ends; `statValue` (26) is the one place
 *  in the system a numeral is set at display size, because these numbers ARE the screen's content. */
export const LECTURE_RECAP_METRICS = { aside: 360, statValue: 26, statPad: 18, headPad: '15px 18px' }

/** THE CLOCK, AS CODE. Every rule below would otherwise live in the host and in prose — "24-hour,
 *  no commas, the date said once when the lecture ended the day it started" — which is the kind of
 *  rule a second host retypes differently. Published so the host passes INSTANTS and the recap
 *  does the wording; the string props survive as overrides for a host with its own clock.
 *  - `mmss(seconds)` → "21:05" (floored, zero-padded; the header bar's own face).
 *  - `clockLabel(t, withDate)` → "Fri 4 Sep 2026 · 13:12" or "13:12". Weekday and month are the
 *    locale's short names; the rest is fixed.
 *  - `span(startedAt, endedAt)` → `{ started, ended }`: the date on `started` always; on `ended`
 *    only when it is a different calendar day. */
const two = (n: number) => (n < 10 ? '0' : '') + n
const mmss = (s: number) => { const v = Math.max(0, Math.floor(Number(s) || 0)); return two(Math.floor(v / 60)) + ':' + two(v % 60) }
const clockLabel = (t: number | Date, withDate?: boolean) => {
  const d = new Date(t)
  const time = two(d.getHours()) + ':' + two(d.getMinutes())
  if (!withDate) return time
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' }) + ' ' + d.getFullYear() + ' · ' + time
}
const span = (startedAt?: number | Date | null, endedAt?: number | Date | null): { started?: string; ended?: string } => {
  const out: { started?: string; ended?: string } = {}
  if (startedAt != null) out.started = clockLabel(startedAt, true)
  if (endedAt != null) out.ended = clockLabel(endedAt, !(startedAt != null && new Date(startedAt).toDateString() === new Date(endedAt).toDateString()))
  return out
}
export const LectureClock = { mmss, clockLabel, span }

/** what the recap counts, and the only three numbers it knows how to word */
export interface RecapCounts {
  /** stops covered this lecture */
  stops: number
  /** notes taken during it */
  notes: number
  /** slides flagged for revision */
  flagged: number
}

/** one number and its word, as the stats row draws it */
export interface RecapStat {
  /** the numeral — display size, tabular figures. It is the screen's content, not a label */
  value: ReactNode
  /** what it counts, already pluralised */
  label: string
}

/** THE STAT WORDING, AS CODE: `counts` in, three `{ value, label }` out, plural decided here. The
 *  numbers stay the host's (they are read off its store); only the words moved. */
export const recapStats = ({ stops, notes, flagged }: RecapCounts): RecapStat[] => [
  { value: stops, label: stops === 1 ? 'stop covered' : 'stops covered' },
  { value: notes, label: notes === 1 ? 'note taken' : 'notes taken' },
  { value: flagged, label: flagged === 1 ? 'slide flagged' : 'slides flagged' },
]
export const RecapMath = { stats: recapStats }

/** ONE STAT. Divided by a hairline rather than by space: four numbers in a row read as one
 *  instrument that way, and as four loose facts the other. The first one carries no rule — a
 *  leading hairline would read as a column edge with nothing on its left. */
function Stat({ stat, first }: { stat: RecapStat; first?: boolean }) {
  return (
    <div style={{ padding: '0 ' + LECTURE_RECAP_METRICS.statPad + 'px', borderLeft: first ? 'none' : '1px solid var(--border-hair)' }}>
      <b style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: LECTURE_RECAP_METRICS.statValue, lineHeight: 1.1, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', fontVariantNumeric: 'var(--tnum)' }}>{stat.value}</b>
      <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>{stat.label}</span>
    </div>
  )
}

/** a slide the professor flagged while teaching, listed as something to come back to */
export interface FlaggedSlide {
  /** stable identity for the row; the list index is used when it is missing */
  id?: string | number
  /** the slide's own name */
  title: ReactNode
  /** what to call its position — "stop 4". Omit and `stop` is worded into one */
  stopLabel?: string
  /** the stop's zero-based index, worded as `stop N+1` when `stopLabel` is absent */
  stop?: number
  /** jump back to it. Omit and the row is a readout, not a control */
  onOpen?: () => void
}

/** ONE FLAGGED SLIDE — a to-do, so it is a ROW with a filled flag and the stop it was on, not a
 *  quick-actions tile: the deck's tiles are things to DO now, and these are things to come back
 *  to. The flag is filled because the professor set it during the lecture; an outline flag is the
 *  hover hint on a slide that is NOT flagged, and reusing it here would say the opposite. */
function FlaggedRow({ item }: { item: FlaggedSlide }) {
  const [hot, setHot] = useState(false)
  const act = !!item.onOpen
  return (
    <button type="button" disabled={!act} onClick={item.onOpen} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      data-flagged-slide
      title={wrapTip(act ? 'open this slide' : undefined)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', height: 38, padding: '0 10px', boxSizing: 'border-box',
        border: '1px solid ' + (act && hot ? 'var(--border-strong)' : 'var(--border-frame)'), borderRadius: 'var(--radius-md)',
        background: act && hot ? 'var(--bark-50)' : 'var(--surface-paper)', cursor: act ? 'pointer' : 'default',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)',
        textAlign: 'left', transition: 'var(--transition-wash)',
      }}>
      <span style={{ display: 'flex', flexShrink: 0, color: 'var(--acorn-600)' }}><FlagMark size={13} filled /></span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>{item.stopLabel}</span>
    </button>
  )
}

/** something to do now that the lecture is over, drawn under a rule below the flagged list */
export interface RecapAction {
  /** the pill's label, lower case */
  label: string
  /** which face it wears; `quiet` when omitted */
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost' | 'neutral'
  /** what pressing it does */
  onSelect?: () => void
}

/** The end-of-lecture recap — part 7 of the presenter-mode split, and the whole region the film
 *  roll and the strip occupied while the lecture was live.
 *
 *  INSTANTS FIRST, STRINGS AS OVERRIDES: a host passes `elapsedS` / `bookedS` (seconds),
 *  `startedAt` / `endedAt` (ms or Date) and `counts`, and the recap does every piece of wording; a
 *  string prop, where given, wins. */
export interface LectureRecapProps {
  /** what was being taught — the recap's headline */
  course: ReactNode
  /** the slot's own line under the course name — "Tuesday · lecture 4", say */
  when?: ReactNode
  /** replaces the whole caps line over the course name. Omit and it is composed from the
   *  elapsed and booked times: "lecture ended · 47:12 of 50:00" */
  eyebrow?: ReactNode
  /** the elapsed time, already worded. Prefer `elapsedS` and let the recap say it */
  elapsed?: string
  /** the booked length, already worded. Prefer `bookedS` */
  booked?: string
  /** the start of the lecture, already worded. Prefer `startedAt` */
  started?: string
  /** the end of the lecture, already worded. Prefer `endedAt` */
  ended?: string
  /** the stats row, already worded. Prefer `counts` and let `recapStats` word it */
  stats?: RecapStat[]
  /** THE NOTES SIDE IS THE HOST'S OWN PANE (typically `LectureNotes variant="review"`): the
   *  entries belong to the host, and one component owning both the live pane and the recap's copy
   *  of it is how the two drift apart */
  notes?: ReactNode
  /** how long the lecture actually ran, in seconds */
  elapsedS?: number
  /** how long it was booked for, in seconds */
  bookedS?: number
  /** when it started — ms since the epoch, or a Date */
  startedAt?: number | Date | null
  /** when it ended — ms since the epoch, or a Date. The date is said again only when it is a
   *  different calendar day from the start */
  endedAt?: number | Date | null
  /** the three numbers the stats row draws, worded here */
  counts?: RecapCounts
  /** what was flagged for revision, in the order it should be revisited */
  flagged?: FlaggedSlide[]
  /** the aside pane's name */
  flaggedTitle?: string
  /** what the aside says when nothing was flagged */
  flaggedEmpty?: ReactNode
  /** what to do now the lecture is over — drawn as full-width pills under a rule, separated from
   *  the flagged list because "what to revise" and "what to do now" are different questions */
  actions?: RecapAction[]
  /** the aside's width. Defaults to the 360 the quick actions deck stood in, so nothing moves
   *  sideways when the lecture ends */
  asideWidth?: number
  /** merged into the recap's root — for its place in the host's own flex */
  style?: CSSProperties
}

export function LectureRecap({
  course, when, eyebrow, elapsed, booked, started, ended, stats, notes,
  elapsedS, bookedS, startedAt, endedAt, counts,
  flagged = [], flaggedTitle = 'flagged for revision',
  flaggedEmpty = 'nothing was flagged this lecture.',
  actions = [], asideWidth = LECTURE_RECAP_METRICS.aside, style,
}: LectureRecapProps) {
  const clock = span(startedAt, endedAt)
  const elapsedTxt = elapsed != null ? elapsed : elapsedS != null ? mmss(elapsedS) : undefined
  const bookedTxt = booked != null ? booked : bookedS != null ? mmss(bookedS) : undefined
  const startedTxt = started != null ? started : clock.started
  const endedTxt = ended != null ? ended : clock.ended
  const statList = stats || (counts ? recapStats(counts) : [])
  const rows = flagged.map((f) => (f.stopLabel != null || f.stop == null ? f : { ...f, stopLabel: 'stop ' + (f.stop + 1) }))
  const line = eyebrow != null ? eyebrow : 'lecture ended' + (elapsedTxt ? ' · ' + elapsedTxt : '') + (elapsedTxt && bookedTxt ? ' of ' + bookedTxt : '')
  return (
    <div data-lecture-recap style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      {/* THE HEAD IS A BAND, NOT A PANE: it carries no title hat and nothing in it scrolls, so a
         `Pane` would put a legend on a thing whose whole first line already names it. It takes the
         pane's own frame and radius so it belongs to the same set of objects. */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 26, padding: LECTURE_RECAP_METRICS.headPad, boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)' }}>
        {/* THE HEAD IS THE SIDE THAT GIVES, THE NUMBERS NEVER ARE. `flex: 1; min-width: 0` here,
           so the slot line wraps and the clock line ellipsises; the stats row is `flexShrink: 0`
           — a number cut in half is a wrong number, and "slide flagg" is not a statistic. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)' }}>{line}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.2, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', marginTop: 6, textWrap: 'pretty' }}>{course}</div>
          {when ? <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)', marginTop: 4, textWrap: 'pretty' }}>{when}</div> : null}
          {/* WHEN IT STARTED AND WHEN IT ENDED — the two wall-clock readings the elapsed figure
             cannot give back. Mono, because they are numerals. */}
          {startedTxt || endedTxt ? (
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {startedTxt ? <span><span style={{ color: 'var(--text-3)' }}>started </span>{startedTxt}</span> : null}
              {endedTxt ? <span><span style={{ color: 'var(--text-3)' }}>ended </span>{endedTxt}</span> : null}
            </div>
          ) : null}
        </div>
        <div data-recap-stats style={{ display: 'flex', flexShrink: 0, marginLeft: 'auto' }}>
          {statList.map((s, i) => <Stat key={s.label || i} stat={s} first={i === 0} />)}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--space-3)' }}>
        {notes}
        <div style={{ flexShrink: 0, width: asideWidth, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Pane title={flaggedTitle} scroll="none" bodyStyle={{ padding: '0 13px 12px ' + LEGEND_INSET + 'px' }} style={{ flex: 1, minHeight: 0 }}>
            <PaneScroller style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.length ? rows.map((f, i) => <FlaggedRow key={f.id != null ? f.id : i} item={f} />)
                : <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-normal)', color: 'var(--text-2)' }}>{flaggedEmpty}</p>}
            </PaneScroller>
            {actions.length ? (
              /* THE ACTIONS ARE NOT ROWS OF THE LIST: a rule above them and a bark-washed floor
                 under them separate "what to revise" from "what to do now". Each pill is `block` —
                 full width, label centred; the host's `tone` decides its face, `quiet` by
                 default. */
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--border-hair)' }}>
                {actions.map((a, i) => <PillButton key={a.label || i} block tone={a.tone || 'quiet'} onClick={a.onSelect}>{a.label}</PillButton>)}
              </div>
            ) : null}
          </Pane>
        </div>
      </div>
    </div>
  )
}
