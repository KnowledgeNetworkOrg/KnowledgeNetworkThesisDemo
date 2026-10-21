import React from 'react'
import { Pane } from '../chrome/Pane.jsx'
import { LEGEND_INSET } from '../chrome/PaneHeader.jsx'
import { PillButton } from '../chrome/PillButton.jsx'
import { FlagChip } from './FlagChip.jsx'
import { wrapTip } from '../chrome/IconButton.jsx'
import { WalkerMark } from '../chrome/WalkerMark.jsx'
import { StartMath } from './PresentStartCard.jsx'
import { LECTURE_NOTES_METRICS } from './LectureNotes.jsx'

/** The recap's numbers. `aside` (360) is the same column the quick actions deck stands in during
 *  the lecture, so nothing moves sideways when the lecture ends; `statValue` (26) is the one place
 *  in the system a numeral is set at display size, because these numbers ARE the screen's content.
 *  `aside` (360) is now the PREVIEW COLUMN's width inside the notes pane (since 21 Oct). */
export const LECTURE_RECAP_METRICS = { aside: LECTURE_NOTES_METRICS.aside, statValue: 26, statPad: 18, headPad: '15px 18px', step: 26 }

/** THE CLOCK, AS CODE (2026-09-04, filing part 7). Every rule below lived in the reference host and
 *  in prose — "24-hour, no commas, the date said once when the lecture ended the day it started" —
 *  which is the kind of rule a port retypes. Published so the host passes INSTANTS and the recap
 *  does the wording; the string props survive as overrides for a host with its own clock.
 *  - `mmss(seconds)` → "21:05" (floored, zero-padded; the header bar's own face).
 *  - `clockLabel(t, withDate)` → "Fri 4 Sep 2026 13:12" or "13:12". Weekday and month are
 *    the locale's short names; the rest is fixed (owner, 2026-09-04: "Fri, Sep 4, 2026, 01:12 PM"
 *    did not read well; 2026-10-01: no "·" between the year and the time).
 *  - `span(startedAt, endedAt)` → `{ started, ended }`: the date on `started` always; on `ended`
 *    only when it is a different calendar day. */
const two = (n) => (n < 10 ? '0' : '') + n
const mmss = (s) => { s = Math.max(0, Math.floor(Number(s) || 0)); return two(Math.floor(s / 60)) + ':' + two(s % 60) }
const clockLabel = (t, withDate) => {
  const d = new Date(t)
  const time = two(d.getHours()) + ':' + two(d.getMinutes())
  if (!withDate) return time
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' }) + ' ' + d.getFullYear() + ' ' + time
}
const span = (startedAt, endedAt) => {
  const out = {}
  if (startedAt != null) out.started = clockLabel(startedAt, true)
  if (endedAt != null) out.ended = clockLabel(endedAt, !(startedAt != null && new Date(startedAt).toDateString() === new Date(endedAt).toDateString()))
  return out
}
export const LectureClock = { mmss, clockLabel, span }

/** THE STAT WORDING, AS CODE: `counts` in, three `{ value, label }` out, plural decided here. The
 *  numbers stay the host's (they are read off its store); only the words moved. Exported so a
 *  card can read it and a host can compose more. */
/*  v4 (owner, 6 Oct): EVERY NOTE IS A FLAG, so "notes taken" goes and the band counts stops, slides
 *  flagged and flags — one slide can now hold several. `{ stops, slides, flags }` is the shape;
 *  the old `{ notes, flagged }` is still read when `flags` is absent, so a host one build behind
 *  keeps its band. */
export const recapStats = ({ stops, slides, flags, notes, flagged }) => (flags != null ? [
  { value: stops, label: stops === 1 ? 'stop covered' : 'stops covered' },
  { value: slides, label: slides === 1 ? 'slide flagged' : 'slides flagged' },
  { value: flags, label: flags === 1 ? 'flag' : 'flags' },
] : [
  { value: stops, label: stops === 1 ? 'stop covered' : 'stops covered' },
  { value: notes, label: notes === 1 ? 'note taken' : 'notes taken' },
  { value: flagged, label: flagged === 1 ? 'slide flagged' : 'slides flagged' },
])
/** WHERE NEXT TIME PICKS UP, AS CODE (2026-10-01, with the start card). `last` is the session's
 *  record — the SAME `StartSession.last` the start card reads — and the line is THE CARD'S OWN
 *  `StartMath.resolve` run on it, so the two screens cannot word a place differently: mid-walk,
 *  the lead then "Forwarding, stop 2.2 – Distance vector"; a finished walk, "Finished the walk
 *  Forwarding" alone (resolved with no open walk, since this screen cannot know which walk will be
 *  open next time). Runs, `[text, emphasised][]`. */
const nextTimeRuns = (last, walks, lead) => {
  if (!last) return null
  const r = StartMath.resolve({ last }, null, walks)
  return r.kind === 'continue' ? [[lead != null ? lead : 'Next time, continue picks up at ', false]].concat(r.lineEm) : r.lineEm
}
export const RecapMath = { stats: recapStats, nextTime: nextTimeRuns }

/** THE SESSION THE LECTURE WAS RECORDED AGAINST (2026-10-01). Read-only here (owner, same day:
 *  the pencil was removed) — a session is named and renamed on the start card, which is where it
 *  is chosen. Untitled is drawn the system's untitled way (italic, third ink), never as an error. */
function SessionLine({ session, untitled }) {
  const name = session.name || ''
  const days = StartMath.meetsLabel(session.meets)
  return (
    <div title={wrapTip('the session this lecture was recorded against')} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22, minWidth: 0 }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', fontWeight: 'var(--fw-semibold)', color: name ? 'var(--text-2)' : 'var(--text-3)', fontStyle: name ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>{name || untitled}</span>
      {days ? <span style={{ flexShrink: 0, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>{days}</span> : null}
    </div>
  )
}

/** ONE STAT. Divided by a hairline rather than by space: four numbers in a row read as one
 *  instrument that way, and as four loose facts the other. The first one carries no rule — a
 *  leading hairline would read as a column edge with nothing on its left. */
function Stat({ stat, first }) {
  return (
    <div style={{ padding: '0 ' + LECTURE_RECAP_METRICS.statPad + 'px', borderLeft: first ? 'none' : '1px solid var(--border-hair)' }}>
      <b style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: LECTURE_RECAP_METRICS.statValue, lineHeight: 1.1, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', fontVariantNumeric: 'var(--tnum)' }}>{stat.value}</b>
      <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>{stat.label}</span>
    </div>
  )
}

/** ‹ AND › ON THE SHOWN SLIDE — a round chip half over each side edge, the way a carousel says
 *  "there is more this way". Disabled (faded, inert) at the first and the last slide. */
function StepButton({ dir, disabled, onClick }) {
  const [hot, setHot] = React.useState(false)
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

/**
 * The end-of-lecture recap — part 7 of the presenter-mode split, and the whole region the film
 * roll and the strip occupied while the lecture was live.
 */
export function LectureRecap({
  course, when, eyebrow, elapsed, booked, started, ended, stats, notes,
  elapsedS, bookedS, startedAt, endedAt, counts,
  slide, shownStop = 0, stops, stopCount, onShowStop, slideLabel,
  onFlag, flagTypes, usualFlag, onUsualFlagChange, flagHint,
  actions = [], asideWidth = LECTURE_RECAP_METRICS.aside, style,
  session, untitledLabel = 'Untitled session', walks, nextLead,
}) {
  /* INSTANTS FIRST, STRINGS AS OVERRIDES: a host passes `elapsedS` / `bookedS` (seconds),
     `startedAt` / `endedAt` (ms or Date) and `counts` and the recap does every piece of wording
     above; a string prop, where given, wins. */
  const clock = span(startedAt, endedAt)
  const elapsedTxt = elapsed != null ? elapsed : elapsedS != null ? mmss(elapsedS) : undefined
  const bookedTxt = booked != null ? booked : bookedS != null ? mmss(bookedS) : undefined
  const startedTxt = started != null ? started : clock.started
  const endedTxt = ended != null ? ended : clock.ended
  const statList = stats || (counts ? recapStats(counts) : [])
  /* THE SHOWN SLIDE (v4, owner 6 Oct). The host holds `shownStop` — slide 1 of the walk (0) until a
     flag or a slide head is clicked in the notes slot — and passes that slide's picture as `slide`.
     ‹ › step through the WHOLE walk, flagged or not, and stop at its ends; the recap does the
     clamping and the wording, the host only stores the index. */
  const count = stopCount != null ? stopCount : stops ? stops.length : 0
  const at = Math.max(0, Math.min(count ? count - 1 : 0, shownStop || 0))
  /* THE PREVIEW COLUMN'S HEAD is "Preview" (owner, 21 Oct), not the stop: the slide carries its title,
     and "stop N of M" under it says where in the walk it is. A column head, capitalised like "Flags"
     and "Class chat". `slideLabel` still overrides it verbatim. */
  const legend = slideLabel != null ? slideLabel : 'Preview'
  /* ONE PROP, NOT TWO: the session the host stored carries its own `last` once the lecture's end is
     written, so the next-time line reads it there */
  const nextRuns = nextTimeRuns(session && session.last, walks, nextLead)
  const line = eyebrow != null ? eyebrow : 'lecture ended' + (elapsedTxt ? ' · ' + elapsedTxt : '') + (elapsedTxt && bookedTxt ? ' of ' + bookedTxt : '')
  /* THE PREVIEW: the shown slide, its flag chip, ‹ ›, and "stop N of M" under it. It is a COLUMN of the
     notes pane (below), so it takes the column's width and the column's height; it does not fill the
     height, and the space under it is the pane's own, as under the Class chat in class. THE SLIDE
     FITS BOTH WAYS: the outer box takes the slide's shape from the column's WIDTH (`aspectRatio`) and
     may be squeezed shorter (`minHeight: 0`); the slide inside is as tall as that box and as wide as
     its shape allows. Full width with height to spare, narrower and never cut without. */
  const preview = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 1 auto', minHeight: 0, aspectRatio: '1120 / 630' }}>
        <div style={{ position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: '1120 / 630' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-frame)', background: 'var(--bark-50)' }}>{slide}</div>
          {/* THE FLAG CHIP, THE FILM ROLL'S OWN (v4): tap for the usual type, hold for the ring. It adds a
             BARE flag to the shown slide at once; the professor gives it words by clicking its row. */}
          {onFlag ? <span style={{ position: 'absolute', right: 6, top: 6, zIndex: 3 }}><FlagChip types={flagTypes} usual={usualFlag} onUsualChange={onUsualFlagChange} hint={flagHint} onFlag={onFlag} /></span> : null}
          {onShowStop && count > 1 ? <StepButton dir={-1} disabled={at <= 0} onClick={() => onShowStop(at - 1)} /> : null}
          {onShowStop && count > 1 ? <StepButton dir={1} disabled={at >= count - 1} onClick={() => onShowStop(at + 1)} /> : null}
        </div>
      </div>
      {count ? <div style={{ flexShrink: 0, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>{'stop ' + (at + 1) + ' of ' + count}</div> : null}
    </div>
  )
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      {/* THE HEAD IS A BAND, NOT A PANE: it carries no title hat and nothing in it scrolls, so a
         `Pane` would put a legend on a thing whose whole first line already names it. It takes the
         pane's own frame and radius so it belongs to the same set of objects. */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', padding: LECTURE_RECAP_METRICS.headPad, boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        {/* THE HEAD IS THE SIDE THAT GIVES, THE NUMBERS NEVER ARE. The head block could not shrink and
           the slot line would not wrap, so at the ended screen's narrower width the stats spilled past
           the band and the third read "slide flagg" (found by review, 2026-09-04). `flex: 1;
           min-width: 0` here, the slot line wraps and the clock line ellipsises, and the stats row is
           `flexShrink: 0` — a number cut in half is a wrong number. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)' }}>{line}</div>
          {/* THE SESSION RIDES THE COURSE LINE (owner, 2026-10-01: a line of its own made the band
             messy) — the course is what was taught, the session who it was taught to */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 6 }}>
            <div style={{ minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.2, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', textWrap: 'pretty' }}>{course}</div>
            {session ? <SessionLine session={session} untitled={untitledLabel} /> : null}
          </div>
          {/* WHEN IT STARTED AND WHEN IT ENDED (owner, 2026-09-04) — the two wall-clock readings the
             elapsed figure cannot give back, printed VERBATIM: the host formats them, because only
             the host knows the locale and the clock. Mono, because they are numerals. */}
          {/* ONE SPAN, A DASH BETWEEN (owner, 2026-10-01): "Tue 2 Sep 2026 14:02 – 14:23". The
             "started" / "ended" words went; the dash says it is a duration. */}
          {startedTxt || endedTxt ? (
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(startedTxt || '') + (startedTxt && endedTxt ? ' – ' : '') + (endedTxt || '')}
            </div>
          ) : null}
          {when ? /* THE DATE FIRST, THEN WHAT WAS COVERED (owner, 2026-10-01): course, session and date say
             WHICH lecture; the topics sit next to the next-time line, covered then where to go next.
             INSIDE the expression on purpose: a braced JSX comment is stripped on compile, and the
             card's guard reads this one. */ <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)', marginTop: 6, textWrap: 'pretty' }}>{when}</div> : null}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginLeft: 'auto' }}>
          {statList.map((s, i) => <Stat key={s.label || i} stat={s} first={i === 0} />)}
        </div>
      </div>
      {/* NEXT TIME — the start card's Continue row, said back at the moment it is written. ITS OWN
         FOOT under a hairline, the band's full width, so it holds one line and does not read as a
         fourth fact about the lecture that ended. The walker is the Continue row's icon. */}
      {/* THE WAY OUT RIDES THIS FOOT, AT ITS RIGHT (owner, 21 Oct: a band of its own at the screen's foot
         was "very awkward", one pill in a wide empty box). "Where next time picks up" and "close the
         presenter" are the two things about AFTER the lecture, so they share the line; the pill sits at
         the band's right edge, under the numbers. With no next-time line the foot holds the pill alone. */}
      {nextRuns || actions.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-hair)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>
          {nextRuns ? (<React.Fragment>
          {/* THE WALKER SITS ON THE LINE (owner, 2026-10-01: it floated). DERIVED from the mark's
             16-unit box at size 16: its ink starts 5.8 in, so -5 puts the figure under the text edge
             above; its feet are at 13.3 of 16, so -1px lifts them onto the 12px caption's baseline. */}
          <span style={{ display: 'flex', flexShrink: 0, marginLeft: -5, transform: 'translateY(-1px)', color: 'var(--acorn-600)' }}><WalkerMark size={16} /></span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextRuns.map((r, i) => (r[1] ? <span key={i} style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{r[0]}</span> : <React.Fragment key={i}>{r[0]}</React.Fragment>))}</span>
          </React.Fragment>) : null}
          {actions.length ? (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingLeft: 16 }}>
              {actions.map((a, i) => <PillButton key={a.label || i} size="sm" tone={a.tone || 'quiet'} onClick={a.onSelect}>{a.label}</PillButton>)}
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
      {/* ONE PANE FOR THE FLAGS AND THE SLIDE THEY ARE ABOUT (owner, 21 Oct: in two panes "it's not
         obvious they are linked"). The preview is the notes pane's RIGHT COLUMN, as the Class chat is in
         class: the recap hands it to the host's `LectureNotes variant="review"` as `aside`, so a click on
         a slide's flags and the slide it shows sit side by side, under one legend. The host still makes
         the notes pane (the entries are the host's); the recap adds the column to it. A `notes` that is
         not an element gets the preview in a pane of its own beside it. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--space-3)' }}>
        {React.isValidElement(notes) ? React.cloneElement(notes, { aside: preview, asideLabel: notes.props.asideLabel != null ? notes.props.asideLabel : legend, asideWidth: notes.props.asideWidth != null ? notes.props.asideWidth : asideWidth }) : (
          <React.Fragment>
            {notes}
            <Pane title={legend} scroll="none" bodyStyle={{ padding: '4px 16px 12px ' + LEGEND_INSET + 'px' }} style={{ flexShrink: 0, width: asideWidth, minHeight: 0 }}>{preview}</Pane>
          </React.Fragment>
        )}
      </div>
    </div>
  )
}
