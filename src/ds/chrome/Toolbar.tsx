import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'

import { wrapTip } from './IconButton'

/** One action in a toolbar group. Toolbar items are glyph-only by default; a
 *  `label` is the rare exception where a mark cannot carry the meaning. */
export interface ToolbarItemSpec {
  /** rare — toolbar items are glyph-only where this bar is the TOP of a surface; use only where a
   *  mark cannot carry the meaning.
   *
   *  ONE CASE IS NOT RARE: a `seam` bar docked inside a pane, where every item may carry a label.
   *  A pane-local row is read against the `PaneActionBar` beneath it, whose items always carry a
   *  word, and a glyph-only row above a labelled one asks the reader to learn marks for the actions
   *  that matter MORE (the walk as a whole) than the ones spelled out (edits to the draft).
   *  Labelled items in a seam bar are the walk editor's shape and are correct there — do not
   *  "correct" `WalkUtilityBar` to glyph-only (DS OB-205, 2026-09-17). */
  label?: string
  /** a Unicode glyph from the house set, or a small drawn mark (an inline SVG) */
  glyph?: ReactNode
  /** names the action AND states the current truth: "optionals: on the road" */
  title?: string
  /** this toggle's state: `true` on, `false` off, `'mixed'` partly on. THREE RUNGS OF ONE LADDER,
   *  each adding a whole channel rather than turning one up (owner's pick, 2026-09-17, DS OB-215):
   *
   *  - `false` — no ring, no wash, `--text-2` ink, semibold.
   *  - `'mixed'` — the RING and the tone's ink, NO wash, still semibold.
   *  - `true` — ring AND wash, the tone's ink, BOLD. Never a hue swap.
   *
   *  `'mixed'` EXISTS FOR A BULK SETTER WHOSE SUBJECT DISAGREES WITH ITSELF — the walk editor's
   *  optional button over a versioned group, three of whose four leaves are optional.
   *
   *  ABSENT AND `false` ARE DIFFERENT CONTROLS, not two spellings of off. Omitting `on` means "this
   *  is not a toggle" and no `aria-pressed` is emitted; `on={false}` is a toggle that is currently
   *  off. `'mixed'` maps to ARIA's own `aria-pressed="mixed"`. A caller does NOT dash the pill to
   *  mean mixed — the glyph inside an optional-style button is already a dashed ring. */
  on?: boolean | 'mixed'
  disabled?: boolean
  /** walk = acorn (movement through the corpus); primary = moss */
  tone?: 'quiet' | 'walk' | 'primary'
  onClick?: () => void
  /** a stable identifier for a caller that needs to find THIS item's own DOM node
   *  later (an animation anchor, a driver, a tour step) — rendered as
   *  `data-toolbar-hook`. Added because `title` is free text that changes ("show
   *  the palette" / "hide the palette") and, past `wrapTip`'s 44 characters,
   *  FOLDS — a folded title cannot be written as a CSS attribute selector at all
   *  (a CSS string may not carry a raw newline, so `querySelector` throws rather
   *  than misses). Pass a hook for anything that must be found this way; never
   *  match a toolbar item by its `title`. (OB-124)
   *
   *  NOT ported: the DS's sibling `morph` prop. Its `view-transition-name` shape
   *  belongs to `ViewMorph`, which the DS declares a divergence — their Studio
   *  shell runs on view transitions and this app deliberately keeps its own FLIP
   *  palette animation (`f4bb691`). See OB-124's revision note. */
  hook?: string
}

/** A docked strip of actions that sits directly under the app bar. Items are
 *  pills; groups are separated by a hairline rule, never by extra space alone.
 *
 *  WHAT A CALLER STACKING TWO BARS MUST DO (DS OB-205, from the live walk editor): the LAST bar
 *  in a pane's `actionBar` slot owns the rule, every bar above it takes `seam`. Nothing here can
 *  detect what follows it in the slot, so this one is on the host — get it wrong and the pane
 *  grows an internal hairline that reads as a lid on the row below it.
 *
 *  Typed port of the DS Toolbar.jsx (contract: Toolbar.d.ts). */
export interface ToolbarProps {
  /** left-to-right groups, divided by a hairline rule */
  groups?: Array<{ label?: string; items: ToolbarItemSpec[] }>
  /** right-aligned content — the live focus, counts, a session action */
  trailing?: ReactNode
  /** the wordmark in plain type — use when the toolbar is the topmost bar */
  brand?: string
  /** a decorative mark pinned to the trailing edge and CROPPED by the strip —
   *  pass `<LeafMark size={40} opacity={0.2} />`. Non-interactive; toolbar clips it. */
  motif?: ReactNode
  /** 24px items instead of 30px. Default true — dense is the standard weight
   *  everywhere this ships; pass `dense={false}` only for a deliberately larger,
   *  standalone bar. */
  dense?: boolean
  /** THIS BAR IS NOT THE LAST THING BEFORE THE CANVAS — it is docked in a pane's `actionBar` slot
   *  with another bar (normally a `PaneActionBar`) under it. Pass it on every bar in such a stack
   *  except the last.
   *
   *  It draws no bottom rule (the last bar's rule is the stack's rule), its gutter becomes
   *  `--pane-pad-x` so its first item starts on the same x as the pills below, and its bottom
   *  padding drops to 2px so the two rows sit `--space-15` apart — the same gap as two items within
   *  one row. All three are consequences of having a bar below; none is a style choice a caller
   *  should re-derive. Default false. */
  seam?: boolean
}

/* `seam` is for the one place this bar is NOT the last thing before a canvas. Two facts change
   there, and both are arithmetic rather than taste. The RULE belongs to the LAST bar in the stack,
   so a seam bar draws none — two hairlines one row apart put a lid on the bar below. The LEFT EDGE:
   the gutter becomes `--pane-pad-x` (14px) instead of `--space-4` (16px), which is what
   `PaneActionBar` uses — the 2px the owner saw as "optionals is a bit to the right" was the whole
   difference between the two gutters, the items' padding already being identical, so there is
   nothing to nudge inside a button. The bottom padding drops to 2px so the gap between the two
   rows' buttons is `--space-15` (6px, against `PaneActionBar dense`'s 4px top) — CHOSEN against
   that 4px; do not re-derive it from the rungs, and a non-dense bar over a dense one landing a
   pixel looser is expected. */
export function Toolbar({ groups = [], trailing, dense = true, brand, motif, seam = false }: ToolbarProps) {
  const padX = seam ? 'var(--pane-pad-x)' : dense ? 'var(--space-4)' : 'var(--space-5)'
  const padTop = dense ? 5 : 7
  const padBottom = seam ? (dense ? 2 : 3) : padTop
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: dense ? 'var(--space-15)' : 'var(--space-2)',
        padding: padTop + 'px ' + padX + ' ' + padBottom + 'px',
        background: 'var(--surface-paper)',
        borderBottom: seam ? 'none' : '1px solid var(--border-hair)',
      }}
    >
      {motif ? <span style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', lineHeight: 0 }}>{motif}</span> : null}
      {brand ? (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--fw-bold)',
            fontSize: 'var(--fs-title)',
            color: 'var(--moss-600)',
            letterSpacing: 'var(--ls-display)',
            flexShrink: 0,
            marginRight: 2,
          }}
        >
          {brand}
        </span>
      ) : null}
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {gi > 0 ? <span style={{ width: 1, height: 18, alignSelf: 'center', background: 'var(--border-frame)', flexShrink: 0 }} /> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
            {g.label ? (
              <span
                style={{
                  fontSize: 'var(--fs-micro)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-caps)',
                  fontWeight: 'var(--fw-bold)',
                  color: 'var(--text-3)',
                  marginRight: 2,
                  flexShrink: 0,
                }}
              >
                {g.label}
              </span>
            ) : null}
            {g.items.map((it, i) => (
              <ToolbarItem key={i} {...it} dense={dense} />
            ))}
          </div>
        </Fragment>
      ))}
      <span style={{ flex: 1 }} />
      {trailing ? <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>{trailing}</div> : null}
    </div>
  )
}

/* ONE LADDER, THREE RUNGS, AND EACH RUNG ADDS A WHOLE CHANNEL rather than turning one up (DS
   OB-215, 2026-09-17, owner's pick) — see `on`. WHY A RING/WASH LADDER AND NOT A DASHED PILL: the
   house rule is "dashed means conditional", and the glyph inside the optional button is already
   `OptionalMark`, a dashed ring; a dashed pill around it would put two dashes in one control saying
   two different things. HOVER ON `mixed` KEEPS THE RING AND TAKES THE NEUTRAL `--surface-hover`,
   never the walk wash — a walk-washed mixed button is pixel-identical to `on`, so hovering would
   appear to change the state.

   A GLYPH BESIDE A LABEL ALIGNS ON THE BASELINE, NOT ON THE BOX (DS OB-215 clause 6) — adopted from
   `PillButton`, where the owner settled it over five rounds on 2026-08-21; this bar never got the
   ruling, so `OptionalMark` drew 2.00px below the label's cap-height centre here and 1.00px in a
   pill. Three parts, all `PillButton`'s: `alignItems: 'baseline'`, the glyph span at `lineHeight:
   1`, and the uniform `top: -1px` optical nudge. ALL KEYED ON `label`: a glyph-only item has no
   baseline to meet, is a square box, and its mark belongs in the middle of it — the nudge would
   lift it off centre, and most of the app toolbar is glyph-only. */
function ToolbarItem({ label, glyph, title, on, disabled, tone, onClick, dense, hook }: ToolbarItemSpec & { dense?: boolean }) {
  const [hot, setHot] = useState(false)
  const walk = tone === 'walk'
  const mixed = on === 'mixed'
  /* THE TWO READINGS OF `on` ARE DELIBERATELY DIFFERENT, and a truthiness test cannot tell them
     apart: `engaged` is "wholly or partly" and carries the ink and the ring; `isOn` is "wholly",
     and is the only one that earns the wash and the bold weight. `on ?` would draw the STRING
     'mixed' as fully on. */
  const isOn = on === true
  const engaged = isOn || mixed
  const ink = disabled
    ? 'var(--text-3)'
    : engaged
      ? walk
        ? 'var(--text-walk)'
        : 'var(--accent-primary-ink)'
      : tone === 'primary'
        ? 'var(--accent-primary-ink)'
        : 'var(--text-2)'
  const bd = engaged ? (walk ? 'var(--border-walk)' : 'var(--moss-300)') : hot && !disabled ? 'var(--border-rule)' : 'transparent'
  const bg = isOn ? (walk ? 'var(--accent-walk-wash)' : 'var(--accent-primary-wash)') : hot && !disabled ? 'var(--surface-hover)' : 'transparent'
  const box = dense ? 24 : 30
  return (
    <button
      type="button"
      title={wrapTip(title || label)}
      aria-label={label ? undefined : title}
      disabled={disabled}
      onClick={onClick}
      data-toolbar-hook={hook}
      aria-pressed={on === undefined ? undefined : mixed ? 'mixed' : isOn}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        display: 'inline-flex',
        alignItems: label ? 'baseline' : 'center',
        justifyContent: 'center',
        gap: 6,
        flexShrink: 0,
        minHeight: box,
        height: box,
        padding: label ? (dense ? '3px 9px' : '5px 11px') : 0,
        width: label ? 'auto' : box,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid ' + bd,
        background: bg,
        color: ink,
        fontFamily: 'var(--font-ui)',
        fontSize: label ? 'var(--fs-body)' : 'var(--fs-title)',
        fontWeight: isOn ? 'var(--fw-bold)' : 'var(--fw-semibold)',
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 'var(--opacity-disabled)' : 1,
        transition: 'var(--transition-wash)',
        whiteSpace: 'nowrap',
      }}
    >
      {glyph ? <span style={{ opacity: 0.85, lineHeight: 1, position: 'relative', top: label ? -1 : 0 }}>{glyph}</span> : null}
      {label}
    </button>
  )
}
