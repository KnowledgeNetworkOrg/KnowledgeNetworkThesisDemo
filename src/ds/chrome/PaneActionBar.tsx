import { useContext, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { PillButton } from './PillButton'
import { PaneFrameContext } from './PaneHeader'
import { usePresence } from './IconButton'

export interface PaneActionBarItemSpec {
  /** the action's word — this bar has no icon-only mode, so every item carries one */
  label: string
  /** the action's icon — a house Unicode glyph, or one of the DS's drawn marks
   *  (`OptionalMark`, …). An app assembles its OWN mix of these into whatever buttons
   *  a screen needs — but it does not draw a NEW icon on its own: a genuinely new mark
   *  is requested from the design system first, the same way OB-036's fifth mark was,
   *  never improvised app-side. Keep custom compositions (icon choice, ordering) free;
   *  keep new drawing centralised. */
  glyph?: ReactNode
  /** hover tooltip, e.g. extra detail the label doesn't say — never the ONLY name of the action */
  title?: string
  disabled?: boolean
  /** currently active / toggled on — e.g. "make optional" while the selection already is one.
   *  ★ LOCAL: `'mixed'` for a toggle whose subject is partly on — the walk editor's Optional
   *  button over a group some of whose leaves are optional (DS OB-215). The DS gave that third
   *  state to `Toolbar`'s `on`; this bar is where the button actually lives here, so `PillButton`
   *  mirrors the same rung (its `selected`). */
  selected?: boolean | 'mixed'
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost'
  onClick?: () => void
}

export interface PaneActionBarProps {
  /** the bar's buttons, left to right */
  actions: PaneActionBarItemSpec[]
  /** 4px vertical padding instead of 6px */
  dense?: boolean
}

/** A pane's OWN actions, docked directly under its header — never floating, never icon-only.
 *  Pass it to `Pane`'s `actionBar` prop, never as a plain child: `Pane` clips this bar's top
 *  corners to its own arc there. `Toolbar` is the app-wide bar (glyph-only, hosted once,
 *  above every pane); this is the other half: one pane's unique operations, worn as labelled
 *  pills so nobody has to learn a glyph to use them. Replaces a per-pane floating "Toolbox"
 *  panel (drag/resize/reposition/persisted rect) that existed only to hold icon-only buttons
 *  — once the buttons carry their own word, none of that machinery is needed. Background is
 *  `--surface-paper`, the same face as the pane it sits in.
 *
 *  Dims (never disappears) when the pane has been idle, on the same presence clock
 *  `PaneHeader`'s ✕ uses — a docked strip that fully vanished would reflow the canvas under
 *  it on every idle edge, which a floating panel never had to answer for.
 *
 *  Typed port of the DS PaneActionBar.jsx (contract: PaneActionBar.d.ts). */
export function PaneActionBar({ actions = [], dense }: PaneActionBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frame = useContext(PaneFrameContext)
  const live = usePresence(rootRef, {
    resolve: () => frame?.current ?? rootRef.current?.parentElement ?? null,
  })
  const style: CSSProperties = {
    display: 'flex', flexWrap: 'wrap', flexShrink: 0,
    alignItems: 'center', gap: 'var(--space-15)',
    padding: dense ? '4px var(--pane-pad-x)' : '6px var(--pane-pad-x)',
    background: 'var(--surface-paper)', borderBottom: '1px solid var(--border-hair)',
    opacity: live ? 1 : 0.6,
    transition: 'opacity var(--dur-hover) var(--ease-soft)',
  }
  return (
    <div ref={rootRef} style={style}>
      {actions.map((a, i) => (
        <PillButton key={i} size="sm" glyph={a.glyph} tone={a.tone} disabled={a.disabled} selected={a.selected} title={a.title} onClick={a.onClick}>
          {a.label}
        </PillButton>
      ))}
    </div>
  )
}
