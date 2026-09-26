import type { CSSProperties, ReactNode } from 'react'

import { RelationsMark } from '../chrome/RelationsMark'
import { RailCorner, RailFrame, railWidth } from './RailFrame'

/** THE RELATIONS RAIL, WHOLE — the right-hand column a document's relationships became when the
 *  connections pane dissolved (OB-229). It is the SAME chrome the Explorer rail wears
 *  (`RailFrame`, side="right") with the relations mark instead of the outline mark; the two rails
 *  sit on opposite pans — Explorer on the map, Relations on the document — and share the frame
 *  but nothing inside it.
 *
 *  WHY IT IS A COMPONENT AND NOT A RECIPE, the same reason ExplorerRail is: everything ABOUT a
 *  rail that is a design decision — its minimum width, when it refuses rather than clips, where
 *  the closed button sits, which mark it wears — is invisible in the parts, and a host
 *  re-deriving it by eye is how two builds drift.
 *
 *  UNLIKE ExplorerRail, THE CONTENT IS THE HOST'S. The design system ships no graph, and a
 *  "reading of the neighbourhood" is corpus knowledge — so `children` is passed straight through
 *  (the relation figure and its reading come from the instrument, not from here). What the rail
 *  owns is only the frame and its chrome.
 *
 *  WHAT THE HOST AROUND IT MUST DO (the same contract ExplorerRail's `RailFrame` asks):
 *  1. BE `position: relative` and pass `paneW` from `RailMath.usePaneWidth()`.
 *  2. OWN `open` — the rail is the reader's to close; the frame only reports the intent.
 *  3. DECLARE ITS OWN MINIMUM AS `RailMath.floor('right')`.
 *  4. IF THE SEAM SHOULD DRAG, OWN THE WIDTH: pass `width` and `onWidthChange`.
 *
 *  Typed port of the DS components/connections/RelationsRail.jsx (OB-229 / #342). */
export interface RelationsRailProps {
  /** the rail's open state. Default open */
  open?: boolean
  /** the intent to open or close */
  onOpenChange?: (open: boolean) => void
  /** the PANE's measured width, not the rail's */
  paneW?: number
  /** hand the closed-state control to the pane — see `RailFrameProps.closedControl` */
  closedControl?: 'corner' | 'host'
  /** the seam's stored drag width and its report — see `RailFrameProps` (`width`,
   *  `onWidthChange`). Pass `onWidthChange` and the seam between the rail and the document drags */
  width?: number | null
  /** the seam's report; see `RailFrameProps.onWidthChange` */
  onWidthChange?: (width: number | null) => void
  /** the rail's name, on the header and the closed button. Default `"Relations"` */
  label?: string
  /** content, or a function of the column's DRAWN width — the figure and its reading, which
   *  must track the seam while it is dragged (the figure's own `RailFrame` children contract) */
  children?: ReactNode | ((railW: number) => ReactNode)
}

export function RelationsRail({
  open = true, onOpenChange, paneW, closedControl, width, onWidthChange, label = 'Relations', children,
}: RelationsRailProps) {
  return (
    <RailFrame side="right" label={label} mark={<RelationsMark size={12} />} open={open} onOpenChange={onOpenChange}
      paneW={paneW} closedControl={closedControl} width={width} onWidthChange={onWidthChange}>
      {children}
    </RailFrame>
  )
}

/** THE RELATIONS RAIL'S WAY BACK, FOR A PANE THAT HAS A HEADER ROW OF ITS OWN — mount this as the
 *  last thing in that row and pass the rail `closedControl="host"`. It exists so the pairing of
 *  WORD and MARK is made once: a host assembling `RailCorner` itself would pick the mark again.
 *  Draws nothing while the rail is open, and the refusal when the pane has no room. */
export interface RelationsRailCornerProps {
  /** the PANE's measured width — the same number the rail is given */
  paneW?: number
  /** the rail's open state. Draws nothing while open with room to draw */
  open: boolean
  /** the intent to open */
  onOpenChange?: (open: boolean) => void
  /** the rail's name, on the button. Default `"Relations"` */
  label?: string
  /** placement in the host's own row — this component takes no position of its own */
  style?: CSSProperties
}

export function RelationsRailCorner({ paneW, open, onOpenChange, label = 'Relations', style }: RelationsRailCornerProps) {
  return <RailCorner side="right" label={label} mark={<RelationsMark size={12} />} paneW={paneW} open={open} onOpenChange={onOpenChange} style={style} />
}

/** the rail's own column width at a given pane width — published so a host can size the figure
 *  beside it against the same number the rail uses (the right rail's rules differ from the left's).
 *  Pass the same stored `width` the rail is given. */
export function relationsRailWidth(paneW?: number, width?: number | null): number {
  return railWidth('right', paneW, width)
}

/** the capitalised way in, for the same reason as `RailMath`. Same function object. */
export const RelationsRailMath = { width: relationsRailWidth }
