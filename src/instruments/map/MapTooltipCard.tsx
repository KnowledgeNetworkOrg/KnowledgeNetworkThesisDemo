// THE MAP'S TOOLTIP CARD (#399 cut 3) — the cursor-anchored MapTooltip, moved
// out of MapView whole: a relation hover (an edge of the current selection)
// wins over a node hover. The deciding half is `useMapHover` (hoverlayer.ts).

import { MapTooltip } from '@/ds'
import { byId, EDGE_COLOR, EDGE_LABEL, MIXED_EDGE_COLOR, ROOT_ID } from '../../corpus/graph'
import type { Bundle } from '../../model/atlas'
import { colorOf } from '../../model/color'
import type { XY } from '../../model/derive'
import { descendantCount, parentOf } from '../../model/nav'

export interface MapTooltipCardProps {
  /** the cursor's position in the pane — the mount's own `{pointerPos && tipLive && (…)}` gate narrows it */
  pointerPos: XY
  hoverEdge: Bundle | null
  cardNode: string | null
  hoverRelIn: number
  hoverRelOut: number
}

export function MapTooltipCard({ pointerPos, hoverEdge, cardNode, hoverRelIn, hoverRelOut }: MapTooltipCardProps) {
  return (
    <>
      {/* ── OB-096: MapTooltip, cursor-anchored, replacing the old fixed
          top-left hover chip (OB-095) — a relation hover (an edge of the
          current selection) wins over a node hover, since the two can only
          coexist when the pointer sits exactly on the boundary between an
          edge's stroke and the territory under it. pointer-events-none so
          the card itself never steals the hover it is reporting on. ────── */}
      <div data-maptip className="absolute z-10 pointer-events-none" style={{ left: pointerPos.x + 14, top: pointerPos.y + 14 }}>
        {hoverEdge ? (
          <MapTooltip
            kind="relation"
            hue={hoverEdge.type ? EDGE_COLOR[hoverEdge.type] : MIXED_EDGE_COLOR}
            title={hoverEdge.type ? EDGE_LABEL[hoverEdge.type] : 'mixed'}
            from={byId.get(hoverEdge.src)!.title}
            to={byId.get(hoverEdge.tgt)!.title}
          />
        ) : (
          <MapTooltip
            kind="node"
            hue={colorOf(cardNode!)}
            title={byId.get(cardNode!)!.title}
            typeLabel={byId.get(cardNode!)!.topic ? 'topic' : byId.get(cardNode!)!.kind}
            nodeCount={byId.get(cardNode!)!.kind === 'container' ? descendantCount(cardNode!) : undefined}
            relationsIn={hoverRelIn}
            relationsOut={hoverRelOut}
            parent={parentOf(cardNode!) !== ROOT_ID ? byId.get(parentOf(cardNode!))?.title : undefined}
          />
        )}
      </div>
    </>
  )
}
