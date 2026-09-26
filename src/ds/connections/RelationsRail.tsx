import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react'

import { RelationsMark } from '../chrome/RelationsMark'
import { RailCorner, RailFrame, railWidth } from './RailFrame'
import type { Relation, ViaRelation } from './RelationCards'
import { RelationOrbit } from './RelationOrbit'
import { RelationStats, relationStats } from './RelationStats'

/* the two corrections `orbitBox` applies, to a column width the frame has already decided —
   which is what the rail itself draws with, so the figure follows the seam WHILE it is dragged */
const orbitBoxAt = (w: number) => ({ width: w - 18, height: w + 6 })

/** THE FIGURE'S BOX INSIDE THE RAIL, derived rather than typed: the drawing takes the rail's own
 *  width less its padding, and a height that keeps the two rings round as the rail narrows. Both
 *  are CHOSEN corrections to `railWidth`, and they are here rather than in a host because a host
 *  that types 228 into a 186px rail wastes the difference instead of shrinking the drawing.
 *  Pass the SAME stored `width` the rail is given, or the host sizes its card against a figure
 *  the rail is not drawing. */
export function orbitBox(paneW?: number, width?: number | null): { width: number; height: number } {
  return orbitBoxAt(railWidth('right', paneW, width))
}

/** THE RELATIONS RAIL, WHOLE — the figure, the reading under it, and the chrome that hides it:
 *  the dissolved connections pane's right half as one thing a document pane mounts.
 *
 *  THE CARD IS NOT IN HERE, AND THAT IS THE ONE PIECE THE HOST KEEPS. A relationship card is
 *  wider than the rail and must open over the PROSE — never over the figure being pointed at —
 *  so it belongs to the pane's own `NodePreviewLayer`, which owns the clamp. The rail reports
 *  what is pointed at through `onHot` and draws nothing about it. Hand `figureRef` down and the
 *  layer can avoid the figure's box.
 *
 *  THE TWO FILTERS ARE THE RAIL'S OWN. `kind` and `hopSel` are reported by the chart and read by
 *  the figure, and nothing outside the rail has an opinion about them, so keeping them here is
 *  what makes the pair impossible to wire up disagreeing. The pointer's ring zone is internal too.
 *
 *  WHAT THE HOST AROUND IT MUST DO:
 *  1. BE `position: relative` and pass `paneW` from `RailMath.usePaneWidth()`.
 *  2. CENTRE IT ON THE DOCUMENT'S NODE. Feed `direct`/`via` for whatever the pane is reading;
 *     the hub is not a third piece of state anybody keeps.
 *  3. FEED THEM DECOMPOSED, one entry per (target, kind).
 *  4. OWN THE CARD on its own layer, and light its map from `onHot`.
 *
 *  IT RENDERS NO STANDING LIST OF CARDS, and a host must not add one: that list is what this rail
 *  replaced. A NODE WITH NO RELATIONSHIPS OPENS ON A PLACEHOLDER — the figure and the hairline
 *  under it are both dropped, leaving the rail's label and the reading's own `PanePlaceholder`.
 *
 *  Typed port of the DS components/connections/RelationsRail.jsx (OB-238 + OB-253; #342). */
export interface RelationsRailProps {
  /** the centred node's own relationships, one per (target, kind) */
  direct?: Relation[]
  /** relationships a DESCENDANT holds, with the containment path */
  via?: ViaRelation[]
  /** the PANE's measured width, not the rail's */
  paneW?: number
  /** the rail's open state. Default open */
  railOpen?: boolean
  /** the intent to open or close */
  onRailOpenChange?: (open: boolean) => void
  /** what the pointer is on, as the figure's key — the host holds it because the host draws the
   *  card: `<targetId>|<kind>` is one relationship, `<targetId>` the neighbour, `ORBIT_SELF` the
   *  hub */
  hot?: string | null
  /** the figure's pointer report, with the event the host places its card from */
  onHot?: (key: string | null, e: ReactPointerEvent<Element>) => void
  /** put on the figure's wrapper, so the pane's layer can keep its card off the drawing */
  figureRef?: Ref<HTMLDivElement>
  /** the rail's name, on the header and the closed button. Default `"Relations"` */
  label?: string
  /** hand the closed-state control to the pane — see `RailFrameProps.closedControl`. The
   *  document pane has a header row, so it passes `"host"` and mounts `RelationsRailCorner` */
  closedControl?: 'corner' | 'host'
  /** the seam's stored drag width — see `RailFrameProps.width`. Size the host's card with
   *  `orbitBox(paneW, width)` */
  width?: number | null
  /** the seam's report — see `RailFrameProps.onWidthChange`. The figure follows the seam live */
  onWidthChange?: (width: number | null) => void
}

export function RelationsRail({
  direct, via, paneW, railOpen = true, onRailOpenChange, hot, onHot, figureRef, label = 'Relations',
  closedControl, width, onWidthChange,
}: RelationsRailProps) {
  const [kind, setKind] = useState<string | null>(null)
  const [hopSel, setHopSel] = useState<'own' | 'via' | null>(null)
  const [hop, setHop] = useState<'own' | 'via' | null>(null)
  const count = useMemo(() => relationStats(direct, via).relationships, [direct, via])
  return (
    <RailFrame side="right" label={label} count={count} mark={<RelationsMark size={12} />} open={railOpen} onOpenChange={onRailOpenChange} paneW={paneW} closedControl={closedControl}
      width={width} onWidthChange={onWidthChange}>
      {(railW) => {
        const box = orbitBoxAt(railW)
        return (
          <Fragment>
            <div ref={figureRef}>
              {/* NO FIGURE, AND NO RULE UNDER IT, WHEN THERE IS NOTHING TO DRAW. `figureRef` stays
                  attached either way — the host's preview layer asks it for a box to avoid, and an
                  empty box is the right answer. */}
              {count ? <RelationOrbit width={box.width} height={box.height} direct={direct} via={via}
                hot={hot} onHot={onHot} kind={kind} hop={hop} onHop={setHop} hopSel={hopSel} /> : null}
            </div>
            {count ? <div style={{ height: 1, background: 'var(--border-hair)', margin: '6px 0 8px' }}></div> : null}
            <RelationStats direct={direct} via={via} kind={kind} onKind={setKind} hopSel={hopSel} onHopSel={setHopSel} />
          </Fragment>
        )
      }}
    </RailFrame>
  )
}

/** THE RELATIONS RAIL'S WAY BACK, for a pane that has a header row of its own — same reason as
 *  `ExplorerRailCorner`: the word and the mark are paired once. Takes the same `count` the rail
 *  header shows, so the button can say how many relationships are waiting behind it. */
export interface RelationsRailCornerProps {
  /** the PANE's measured width — the same number the rail is given */
  paneW?: number
  /** the rail's open state. Draws nothing while open with room to draw */
  open: boolean
  /** the intent to open */
  onOpenChange?: (open: boolean) => void
  /** shown after the label on the button — the rail's relationship count */
  count?: number | null
  /** the rail's name, on the button. Default `"Relations"` */
  label?: string
  /** placement in the host's own row — this component takes no position of its own */
  style?: CSSProperties
}

export function RelationsRailCorner({ paneW, open, onOpenChange, count, label = 'Relations', style }: RelationsRailCornerProps) {
  return <RailCorner side="right" label={label} count={count} mark={<RelationsMark size={12} />} paneW={paneW} open={open} onOpenChange={onOpenChange} style={style} />
}

/** the capitalised way in. Same function object: `RelationsRailMath.orbitBox` IS `orbitBox`. */
export const RelationsRailMath = { orbitBox }
