// THE TWO PIECES OF A STOP'S MARKS a surface can draw: the notable badges and
// the secondary tags in full. They live together because a stop preview and
// the document panel show the same pair, and the values come from one helper
// (`model/stopmarks.ts`) so a badge cannot say something the data does not.
//
// THE BADGES SIT WITH THE APP-OWNED TITLES, not in the viewer strip: the DS
// WalkStrip's step carries no mark field, so a mark there would be a DS change
// this card does not make.

import type { WalkStop } from '../../corpus/walks'
import { stopMarksOf } from '../../model/stopmarks'
import type { StopMarkTone } from '../../model/stopmarks'
import type { PlayStep } from './playback'

const MARK_TONE: Record<StopMarkTone, { ink: string; wash: string; rule: string }> = {
  split: { ink: 'var(--hue-jade-ink)', wash: 'var(--hue-jade-wash)', rule: 'var(--hue-jade-stroke)' },
  // violet sits far enough from jade that split and filled read as two marks,
  // not one mark with two words
  filled: { ink: 'var(--hue-violet-ink)', wash: 'var(--hue-violet-wash)', rule: 'var(--hue-violet-stroke)' },
  unmatched: { ink: 'var(--hue-amber-ink)', wash: 'var(--hue-amber-wash)', rule: 'var(--hue-amber-stroke)' },
  exception: { ink: 'var(--hue-brick-ink)', wash: 'var(--hue-brick-wash)', rule: 'var(--hue-brick-stroke)' },
}

/** the stop's notable marks as small badges. A plain stop draws none. */
export function StopMarks({ source, confidence }: Pick<PlayStep, 'source' | 'confidence'>) {
  const marks = stopMarksOf({ source, confidence })
  if (!marks.length) return null
  return (
    <span data-stop-marks="" style={{
      display: 'inline-flex', flexWrap: 'wrap', gap: 4,
      background: 'var(--surface-paper)', border: '1px solid var(--border-hair)',
      borderRadius: 'var(--radius-pill)', padding: '2px 5px',
    }}>
      {marks.map((m) => {
        const tone = MARK_TONE[m.tone]
        return (
          <span key={m.kind} data-stop-mark={m.value} style={{
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', lineHeight: 'var(--lh-snug)',
            fontWeight: 'var(--fw-semibold)', color: tone.ink, background: tone.wash,
            border: '1px solid ' + tone.rule, borderRadius: 'var(--radius-pill)',
            padding: '0 5px', whiteSpace: 'nowrap',
          }}>{m.label}</span>
        )
      })}
    </span>
  )
}

/** a stop position's secondary tags, in full: no clamp, so a long label wraps
 *  rather than losing its end. */
export function StopSecondary({ secondary }: { secondary?: WalkStop['secondary'] }) {
  if (!secondary?.length) return null
  return (
    <div data-stop-secondary="" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {secondary.map((s) => (
        <div key={s.id} data-stop-secondary-item={s.id} style={{
          fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)',
          color: 'var(--text-2)', overflowWrap: 'anywhere',
        }}>{s.label}</div>
      ))}
    </div>
  )
}
