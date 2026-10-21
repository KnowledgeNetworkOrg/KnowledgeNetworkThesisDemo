import type { ReactNode } from 'react'

/**
 * A small round-cornered action button. Every control in a P.Kt pane is a pill.
 */
export interface PillButtonProps {
  /** quiet = the default bordered pill; primary = moss; walk = acorn, the hue of MOVEMENT through
   *  the corpus — correct for a control that STARTS or holds a traversal ("walk this", "teach me
   *  this"), wrong for one that merely affirms (that is primary); danger = berry; neutral = a bark
   *  grey WASH at rest, for a way out ("close the presenter") — a dismissal, not a success and not
   *  a danger. Added 2026-09-04 */
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost' | 'neutral'
  size?: 'sm' | 'md'
  /** a full-width row with the label CENTRED, for a pill stacked in a column. An inline pill
   *  stretched by its column keeps its label at the left edge and reads as a list row. Added
   *  2026-09-04 */
  block?: boolean
  /** a Unicode glyph from the house set, e.g. '▶' or '✦' — the real character, never
   *  escape text (a `\uNNNN` in a JSX string ATTRIBUTE does not process; that trap shipped
   *  as OB-030). Never an emoji. */
  glyph?: string
  disabled?: boolean
  /** on/toggled — draws the moss ring wash rather than a separate colour. THREE RUNGS, the
   *  `Toolbar` ladder: `false` off; `'mixed'` ring and ink, NO wash (some of the subject is on —
   *  a group whose leaves disagree); `true` ring, ink and wash. Weight never changes. HOVER
   *  NEVER TAKES THE WASH AWAY FROM `true`, and never adds it to `'mixed'` — either would make
   *  pointing look like a state change. Passing it at all makes the pill a toggle to assistive
   *  tech (`aria-pressed`, `"mixed"` included); leave it out on a plain action. */
  selected?: boolean | 'mixed'
  /** the hover tooltip. Folded to ~44-character lines by `wrapTip` before it is set — every
   *  tooltip in the system is width-limited, short ones included, so no call site has to decide
   *  (see the Tooltips card, and `chrome/IconButton`). */
  title?: string
  onClick?: () => void
  /** pressed before focus moves — the one case that needs it is a cancel button beside
   *  a field that commits on blur, where `preventDefault()` here stops the commit the
   *  blur would otherwise fire before the click lands */
  onMouseDown?: (e: React.MouseEvent) => void
  children?: ReactNode
}
export function PillButton(props: PillButtonProps): JSX.Element
