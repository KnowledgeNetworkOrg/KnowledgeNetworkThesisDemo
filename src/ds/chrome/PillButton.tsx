import { useState } from 'react'
import type { ReactNode } from 'react'

import { wrapTip } from './IconButton'

/** The six tones. Each is a {background, border, ink, hover-background} quad;
 *  `selected` overrides all of them with the moss ring wash, so a toggled pill
 *  reads the same regardless of its resting tone. */
type Tone = 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost' | 'neutral'

const TONES: Record<Tone, { bg: string; bd: string; ink: string; hoverBg: string }> = {
  quiet: { bg: 'transparent', bd: 'var(--border-rule)', ink: 'var(--text-2)', hoverBg: 'var(--surface-hover)' },
  primary: { bg: 'var(--accent-primary-wash)', bd: 'var(--moss-300)', ink: 'var(--accent-primary-ink)', hoverBg: 'var(--moss-100)' },
  walk: { bg: 'var(--accent-walk-wash)', bd: 'var(--border-walk)', ink: 'var(--text-walk)', hoverBg: 'var(--acorn-100)' },
  danger: { bg: 'var(--state-danger-wash)', bd: 'var(--berry-100)', ink: 'var(--state-danger)', hoverBg: 'var(--berry-100)' },
  ghost: { bg: 'transparent', bd: 'transparent', ink: 'var(--text-2)', hoverBg: 'var(--surface-hover)' },
  /* NEUTRAL IS QUIET WITH A FLOOR UNDER IT. `quiet` is transparent, which is right in a toolbar
     sitting on paper and wrong for a pill standing alone at the bottom of a pane — there it reads
     as a caption until the pointer finds it. Same border and same ink, a bark wash instead of
     nothing, so it is legible at rest without claiming the emphasis `primary` carries. */
  neutral: { bg: 'var(--bark-50)', bd: 'var(--border-rule)', ink: 'var(--text-2)', hoverBg: 'var(--bark-100)' },
}

/** A small round-cornered action. Labels name a STATE or an action in lower
 *  case. Typed port of the DS PillButton.jsx (contract: PillButton.d.ts).
 *
 *  THE ROW ALIGNS ON `baseline`, NOT `center` (DS OB-164, owner-ruled 2026-09-06, adopted
 *  wholesale): a glyph that is a drawn mark (`OptionalMark`, `AddNodeMark`, `NewWalkMark`)
 *  needs its own text baseline to land on, not its box centred against the label's line
 *  height. The glyph span inherits the button's own font-size (no fixed `--fs-body` — that
 *  used to make a `size="sm"` pill's glyph a size larger than its own label), sits at
 *  `lineHeight: 1` so its box adds no spurious height that shifts the baseline, and is
 *  lifted `position: relative; top: -1px`: even with the baseline correctly computed every
 *  glyph, drawn and Unicode alike, read a hair low against the label, so all get one small
 *  optical nudge rather than a tuning per mark. The gap is `--space-1`. Baseline is the
 *  rule for a glyph beside a word everywhere in the system; a per-case exception inside a
 *  shared component is the shape that never comes back out, which is why there is no prop
 *  to undo any of this — a toolbar that reads wrong after it has its own spacing at fault. */
export interface PillButtonProps {
  /** quiet = the default bordered pill; primary = moss; walk = acorn
   *  (movement — a walk, a stop, a jump); danger = berry; ghost = no resting
   *  border; neutral = quiet with a bark wash under it, for a pill standing
   *  alone rather than in a bar */
  tone?: Tone
  size?: 'sm' | 'md'
  /** a Unicode glyph from the house set (e.g. '▶' or '✦'), or one of the DS's drawn
   *  marks (`<OptionalMark />`). Never an emoji. Widened from the DS's `string` to
   *  `ReactNode` — `PaneActionBar` passes a drawn mark through this same slot. */
  glyph?: ReactNode
  disabled?: boolean
  /** on/toggled — draws the moss ring wash rather than a separate colour.
   *
   *  ★ LOCAL, `'mixed'` (DS OB-215): a toggle whose subject is only PARTLY on — the walk editor's
   *  Optional button over a group some of whose leaves are optional. The DS drew this rung on
   *  `Toolbar`'s `on`, and it is the same ladder here, each rung adding a whole channel: off = the
   *  tone's own face; `'mixed'` = the moss RING and ink, NO wash; `true` = ring AND wash. Never a
   *  dashed pill (the `OptionalMark` inside is already a dashed ring — two dashes saying two
   *  things), and hover on `'mixed'` takes the tone's own neutral hover, never the moss wash that
   *  would draw it pixel-identical to `true`.
   *
   *  Passing it at all makes the button a toggle: `aria-pressed` is emitted whenever `selected` is
   *  given, `'mixed'` as ARIA's own `aria-pressed="mixed"`. Omitted, the pill is a plain action. */
  selected?: boolean | 'mixed'
  title?: string
  /** fill the row and centre the label, for a pill that stands alone in a column rather than
   *  beside others in a bar (the recap's closing action). Omit and the pill is inline and takes
   *  only the width its own label needs */
  block?: boolean
  onClick?: () => void
  /** e.g. preventDefault so a toolbar press does not steal focus from the field
   *  the action applies to */
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>
  children?: ReactNode
}

export function PillButton({ tone = 'quiet', size = 'md', glyph, disabled, selected, block, onClick, onMouseDown, title, children }: PillButtonProps) {
  const t = TONES[tone] ?? TONES.quiet
  const [hot, setHot] = useState(false)
  const pad = size === 'sm' ? '3px 9px' : '6px 13px'
  /* THE TWO READINGS OF `selected` ARE DIFFERENT, and a truthiness test cannot tell them apart —
     the string 'mixed' is truthy, so `selected ?` would draw it fully on (the collapse the DS's
     Toolbar names). `engaged` (wholly or partly) earns the ring and the ink; `isOn` (wholly) is
     the only one that earns the wash. */
  const isOn = selected === true
  const engaged = isOn || selected === 'mixed'
  return (
    <button
      type="button"
      title={wrapTip(title)}
      disabled={disabled}
      aria-pressed={selected === undefined ? undefined : selected === 'mixed' ? 'mixed' : isOn}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        justifyContent: block ? 'center' : undefined,
        alignItems: 'baseline',
        gap: 'var(--space-1)',
        minHeight: size === 'sm' ? 24 : 'var(--hit-min)',
        padding: pad,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid ' + (engaged ? 'var(--moss-400)' : t.bd),
        background: hot && !disabled ? t.hoverBg : isOn ? 'var(--accent-primary-wash)' : t.bg,
        color: engaged ? 'var(--accent-primary-ink)' : t.ink,
        fontFamily: 'var(--font-ui)',
        fontSize: size === 'sm' ? 'var(--fs-caption)' : 'var(--fs-body)',
        fontWeight: 'var(--fw-semibold)',
        lineHeight: 'var(--lh-snug)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 'var(--opacity-disabled)' : 1,
        transition: 'var(--transition-wash)',
        whiteSpace: 'nowrap',
      }}
    >
      {glyph ? <span style={{ lineHeight: 1, opacity: 0.85, position: 'relative', top: '-1px' }}>{glyph}</span> : null}
      {children}
    </button>
  )
}
