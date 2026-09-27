// THE MAP'S SELECTION OVERLAY (#399 cut 1) — the deciding half of the
// `data-seloverlay` drawing, moved out of MapView whole: which topics the
// selection resolves to, which of their edges survive the roll-up to this
// grain, how those collapse into one road per pair, and the clipping and floor
// the drawn roads need. The model is `model/atlas.ts`; the drawing is
// `MapSelection.tsx`.
//
// It is called where the `roadsFor` memo and its clear effect sat in MapView,
// so that effect keeps its exact place in the hook order.

import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { headForSet, minShaft } from '@/ds'
import { endpointAtTier, outlineOf, ringsCrossT, roadsFor } from '../../model/atlas'
import type { Bundle } from '../../model/atlas'
import type { WallView } from '../../model/walkwall'

export function useMapSelection({ sel, selDrawn, wall, px, hoverId, hoverCenter, setHoverEdge }: {
  sel: string | null
  selDrawn: string | null
  wall: WallView | undefined
  px: (v: number) => number
  hoverId: string | null
  hoverCenter: boolean
  setHoverEdge: Dispatch<SetStateAction<Bundle | null>>
}) {
  // ── the selection overlay, whole: which topics the selection resolves to,
  // which of their edges survive the roll-up to this grain, and how those
  // collapse into one road per pair. All of it is model/atlas.ts's job now.
  const { tier: selTier, bundles } = useMemo(() => roadsFor(selDrawn), [selDrawn])
  // a changed (or cleared) selection unmounts the old roads outright — no
  // pointerleave ever fires on them — so a stale hoverEdge would otherwise
  // survive pointing at a bundle object from the previous selection
  useEffect(() => setHoverEdge(null), [sel, setHoverEdge])

  const selOutline = selDrawn ? outlineOf(selDrawn) : undefined
  /* THE CENTRE LIGHTS ON ITS OWN SIGNAL (DS OB-230 clause 2, #342): the Document pane's relations
     rail publishes `bus.hoverCenter` when its hub is pointed at, and the answer here is a modest
     emphasis on the selected cell — a wider glow and a heavier border, never a colour change, so
     it stays the same object rather than becoming a second highlight. It is NOT a reading of
     `bus.hover`: that channel carries one id and the roads below light for whatever id it holds,
     so the centre's own id would light every road at once. Only while a cell is actually drawn
     as selected — a walk that drives the focus draws none, and there is then nothing to light. */
  const centreLit = hoverCenter && !!selOutline

  // item 3: a hovered counterpart lights the ROAD to it, not just its territory.
  // The bus hover arrives as a topic id (a Connections relationship row) or a map
  // cell; lift it to the road's grain (selTier) and the bundle whose end it
  // matches is the connection to the selected node. The rest dim, the same way
  // the star dims its other spokes one pane over.
  const litRoad = hoverId && bundles.length ? endpointAtTier(hoverId, selTier) : null
  const anyRoadLit = litRoad != null && bundles.some((b) => b.src === litRoad || b.tgt === litRoad)

  // ── OB-197: A RELATION BETWEEN TWO ADJACENT TERRITORIES GETS A LINE YOU CAN READ ─────────
  // A road is clipped to the borders of the selected grain, so a relation between two
  // territories that SHARE a border leaves a shaft a few units long — and at this map's weight
  // the head is then most of the drawing (owner, 2026-09-16: "the head is way too big, also when
  // the arrow is so short its really hard to read the arrow at all ... it doesn't have to land on
  // the absolute edge of either node's territories"). RULED: lengthen the line, past the exact
  // boundary. A head cap on the map was considered and rejected — it would take the head off every
  // 14px chain and road arrow elsewhere, where the head IS the arrow — so none is added here.
  //
  // THE FLOOR IS THE DS'S, IN THE DS'S UNITS. `minShaft` is three head-lengths of the head one
  // whole SET of arrows shares (`headForSet`, called once over every road drawn, never a per-arrow
  // head: a floor that follows each arrow's own head draws arrows that mean the same thing at
  // several lengths for no reason a reader can see). It is a count of SCREEN px, so it goes
  // through `px()` before it meets these world-unit endpoints — a px floor typed here would be a
  // different arrow at every zoom. The roads are hand-drawn triangles rather than `NodeArrow`, so
  // it is the shared head sizing and not a drawn head that the set is asked about.
  /** the two points a road is CLIPPED to — where it leaves its source cell and lands in its
   *  target's, each a `dip` past the border so the arrow points INTO the territory, in world units */
  const clipRoad = (bd: Bundle) => {
    const a = bd.a
    const b = bd.b
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // trim to the BORDERS of the SELECTED grain: the tail starts just inside the source
    // region, the head lands just over the target's border — nothing converges on the capitals
    const dip = px(11) / len
    const exitT = ringsCrossT(a, b, bd.srcRings, 'min') ?? px(6) / len
    const entryT = ringsCrossT(a, b, bd.tgtRings, 'max') ?? 1 - px(9) / len
    const t0 = Math.max(0, exitT - dip)
    const t1 = Math.min(1, entryT + dip)
    return { from: { x: a.x + dx * t0, y: a.y + dy * t0 }, to: { x: a.x + dx * t1, y: a.y + dy * t1 } }
  }
  const roadFloor =
    sel && !wall && bundles.length > 0
      ? px(minShaft({
          headSize: headForSet({
            lengths: bundles.map((bd) => {
              const c = clipRoad(bd)
              return Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y) / px(1)
            }),
          }),
        }))
      : 0

  /** the cells a selection's roads reach, other than the selection itself — each gets a wash of its
   *  own colour ("what is this connected to" reads from the fills, not just the arrows). Read by
   *  BOTH halves of that drawing: the tint, which sits under the labels, and the outline, which
   *  sits over them (OB-223), so the two can never disagree about which cells they are. */
  const neighbourhood: string[] = sel && !wall
    ? [...new Set(bundles.flatMap((bd) => [bd.src, bd.tgt]))].filter((id) => id !== sel && id !== endpointAtTier(sel, selTier))
    : []

  return { bundles, selOutline, centreLit, litRoad, anyRoadLit, clipRoad, roadFloor, neighbourhood }
}
