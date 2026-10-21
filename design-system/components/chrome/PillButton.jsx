import React from 'react'
import { wrapTip } from './IconButton.jsx'

const TONES = {
  quiet:   { bg: 'transparent', bd: 'var(--border-rule)', ink: 'var(--text-2)', hoverBg: 'var(--surface-hover)' },
  primary: { bg: 'var(--accent-primary-wash)', bd: 'var(--moss-300)', ink: 'var(--accent-primary-ink)', hoverBg: 'var(--moss-100)' },
  walk:    { bg: 'var(--accent-walk-wash)', bd: 'var(--border-walk)', ink: 'var(--text-walk)', hoverBg: 'var(--acorn-100)' },
  danger:  { bg: 'var(--state-danger-wash)', bd: 'var(--berry-100)', ink: 'var(--state-danger)', hoverBg: 'var(--berry-100)' },
  ghost:   { bg: 'transparent', bd: 'transparent', ink: 'var(--text-2)', hoverBg: 'var(--surface-hover)' },
  /* A GREY WASH FOR A WAY OUT (owner, 2026-09-04): "close the presenter" at the foot of the recap
     read as one more pill in the flagged list. Bark's own 50 fills it at rest so it reads as a
     dismissal — the same grey the header bar's confirm washes — and steps to 100 under the pointer. */
  neutral: { bg: 'var(--bark-50)', bd: 'var(--border-rule)', ink: 'var(--text-2)', hoverBg: 'var(--bark-100)' },
}

/** A small round-cornered action. Labels name a STATE or an action in lower case.
 *  The glyph span inherits the button's own font-size (no fixed `--fs-body` override,
 *  which used to make a `size="sm"` pill's glyph a size larger than its own label) and
 *  sits at `lineHeight: 1` so its box doesn't add spurious height that shifts baseline
 *  alignment, and `position: relative; top: -1px` — even with baseline alignment
 *  correctly computed, every glyph (drawn marks and plain Unicode alike) read a hair
 *  low against the label, so all of them get the same small optical nudge rather than
 *  tuning each mark separately (owner, 2026-08-21, fifth round). The row aligns on
 *  `baseline`, not `center` — a glyph that is a drawn mark
 *  (e.g. `OptionalMark`) needs its own text baseline to land on, not its box centred
 *  against the label's line height (owner, 2026-08-21).
 *  `block` makes the pill a full-width row with its label CENTRED — for a pill stacked in a
 *  column (the recap's closing actions); an inline pill stretched by its column kept its label
 *  at the left edge and read as a list row (owner, 2026-09-04). */
export function PillButton({ tone = 'quiet', size = 'md', glyph, disabled, selected, onClick, onMouseDown, title, block = false, children }) {
  const t = TONES[tone] || TONES.quiet
  const [hot, setHot] = React.useState(false)
  const pad = size === 'sm' ? '3px 9px' : '6px 13px'
  /* THREE RUNGS, THE TOOLBAR'S LADDER (OB-215): off / `'mixed'` = ring and ink, no wash / `true` =
     ring, ink and wash. The weight does not change — a pill is always semibold. A truthiness test
     would render 'mixed' as fully on, so the two readings are named. */
  const isOn = selected === true
  const engaged = isOn || selected === 'mixed'
  /* THE WASH IS CHECKED BEFORE HOVER. Hover first painted a hovered ON pill with the plain hover
     wash — the same picture as a hovered MIXED one, so pointing at it appeared to change the state
     (the port's finding, `receipts/e5b0460.md`). Hovered ON keeps its wash; hovered MIXED takes
     the neutral hover, which differs from the accent wash in hue, not only in lightness. */
  const bg = isOn ? 'var(--accent-primary-wash)' : hot && !disabled ? t.hoverBg : t.bg
  return (
    <button
      type="button"
      title={wrapTip(title)}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      aria-pressed={selected === undefined ? undefined : selected === 'mixed' ? 'mixed' : isOn}
      style={{
        display: block ? 'flex' : 'inline-flex', alignItems: 'baseline', gap: 'var(--space-1)',
        justifyContent: block ? 'center' : undefined, width: block ? '100%' : undefined,
        minHeight: size === 'sm' ? 24 : 'var(--hit-min)', padding: pad,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid ' + (engaged ? 'var(--moss-400)' : t.bd),
        background: bg,
        color: engaged ? 'var(--accent-primary-ink)' : t.ink,
        fontFamily: 'var(--font-ui)', fontSize: size === 'sm' ? 'var(--fs-caption)' : 'var(--fs-body)',
        fontWeight: 'var(--fw-semibold)', lineHeight: 'var(--lh-snug)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        /* a button's label is never caught in a drag-selection (owner 2026-10-05) */
        userSelect: 'none', WebkitUserSelect: 'none',
        opacity: disabled ? 'var(--opacity-disabled)' : 1,
        transition: 'var(--transition-wash)', whiteSpace: 'nowrap',
      }}
    >
      {glyph ? <span style={{ lineHeight: 1, opacity: 0.85, position: 'relative', top: '-1px' }}>{glyph}</span> : null}
      {children}
    </button>
  )
}
