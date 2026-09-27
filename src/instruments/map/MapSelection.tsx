// THE MAP'S SELECTION OVERLAY (#399 cut 1) — the `data-seloverlay` group of the
// map, moved out of MapView whole: the selected region's typed edges, the
// neighbourhood's outlines, and the selected cell's three-layer glow. The
// deciding half is `useMapSelection` (mapselect.ts); the model is
// `model/atlas.ts`.

import type { Dispatch, SetStateAction } from 'react'

import { capBow, extendToMin } from '@/ds'
import { EDGE_COLOR, MIXED_EDGE_COLOR } from '../../corpus/graph'
import { outlineOf } from '../../model/atlas'
import type { Bundle } from '../../model/atlas'
import { colorOf } from '../../model/color'
import type { XY } from '../../model/derive'

export interface MapSelectionProps {
  /** the selected id — the mount's own `{sel && !wall && (…)}` gate narrows it */
  sel: string
  selOutline: string | undefined
  centreLit: boolean
  neighbourhood: string[]
  anyRoadLit: boolean
  litRoad: string | null
  bundles: Bundle[]
  clipRoad: (bd: Bundle) => { from: XY; to: XY }
  roadFloor: number
  /** real screen px -> world units — MapView's own `px` */
  px: (v: number) => number
  setHoverEdge: Dispatch<SetStateAction<Bundle | null>>
  placeTipAtCursor: () => void
}

export function MapSelection({ sel, selOutline, centreLit, neighbourhood, anyRoadLit, litRoad, bundles, clipRoad, roadFloor, px, setHoverEdge, placeTipAtCursor }: MapSelectionProps) {
  return (
    <>
      {/* ── SELECTION OVERLAY: the selected region's typed edges, pinned
          until click-off. Edges live at the topic grain but run BORDER to
          BORDER along the capital-to-capital line: each end dips px(11)
          past its cell's border, so the arrows point INTO territories
          instead of converging on the city dots. White-cased for
          readability, arrowhead at the target. ─────────────────────── */}
      <g data-seloverlay pointerEvents="none">
        {/* the selection's NEIGHBOURHOOD (2026-07-17): every cell a road
            reaches gets a wash of its own color too — "what is this
            connected to" reads from the fills, not just the arrows.
            Deliberately quieter than the selected cell on every axis
            (0.1 vs 0.2 fill, hairline vs 3px border), and painted FIRST
            so the primary stays the loudest thing in the overlay. It
            follows the roads' hover dim, so pointing at one counterpart
            recedes the rest of the neighbourhood with its roads.
            THE TINT IS NOT HERE ANY MORE (OB-223): it is in `data-washes`,
            under the label layer, from the same `neighbourhood` list. What
            stays is the OUTLINE, and `data-selconn` with it. */}
        {neighbourhood.map((cp) => {
            const o = outlineOf(cp)
            if (!o) return null
            const dim = anyRoadLit && litRoad !== cp
            return (
              <g key={cp} data-selconn={cp} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity 120ms' }}>
                <path d={o} fill="none" stroke="#ffffff" strokeWidth={px(2.5)} strokeOpacity={0.9} />
                <path d={o} fill="none" stroke={colorOf(cp)} strokeWidth={px(1.3)} strokeOpacity={0.6} />
              </g>
            )
          })}
        {/* The selected cell is the LOUDEST thing on the map (issue #8: a
            hairline + faint tint was still easy to lose, especially once
            the neighbourhood wash tinted its connections at 0.1). Three
            layers, back to front: a real GAUSSIAN GLOW (feGaussianBlur)
            in the cell's tree color that leaks light past the border, a
            white separator that also tints the cell body, and a crisp
            heavy border. The glow lives in the luminance channel the flat
            fills never touch, so it reads as "lit" even next to a same-hue
            sibling — a haloed cell among pale ones is selected at a glance.
            THE TINTS OF THE FIRST TWO ARE IN `data-washes` NOW (OB-223), under
            the label layer, so the ghost heading can be one opaque tone above
            every wash; the glow's blur and the white separator stay here. */}
        {selOutline && (
          <>
            <path d={selOutline} fill="none" stroke={colorOf(sel)} strokeWidth={px(centreLit ? 11 : 7)} strokeOpacity={centreLit ? 0.85 : 0.5} strokeLinejoin="round" filter="url(#sel-glow)" />
            <path d={selOutline} fill="none" stroke="#ffffff" strokeWidth={px(6)} strokeOpacity={0.98} strokeLinejoin="round" />
            <path data-seloutline data-sel-lit={centreLit ? 1 : 0} d={selOutline} fill="none" stroke={colorOf(sel)} strokeWidth={px(centreLit ? 5.5 : 4)} strokeLinejoin="round" />
          </>
        )}
        {bundles.map((bd) => {
          const a = bd.a
          const b = bd.b
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const nx = -dy / len
          const ny = dx / len
          // OB-197 — THE ORDER IS THE CONTRACT: clip to the cells' edges, THEN lengthen,
          // THEN cap the bow against the length that came back. Capping against the stub
          // chord caps against a chord the drawing no longer has.
          //   1. clip: where the road leaves its cell and lands in the next (`clipRoad`)
          //   2. lengthen: a road already past the floor comes back untouched (`grew`
          //      false, nothing moves); a stub is pushed back along its own line by HALF the
          //      shortfall at EACH end — into both territories, never one — so its midpoint,
          //      where the ×n count sits, does not shift
          const clipped = clipRoad(bd)
          const grown = extendToMin({ from: clipped.from, to: clipped.to, min: roadFloor })
          const ax = grown.from.x
          const ay = grown.from.y
          const bx = grown.to.x
          const by = grown.to.y
          //   3. bow: one line per pair now, so the bow no longer has to fan parallels
          //      apart — it only keeps the road off the dead-straight centroid axis. Sign is
          //      pair-deterministic, so it never flips. The bow is a CAP on how far the head
          //      may point off its own line, not a length to draw at: the same px(14)
          //      sagitta is a gentle curve at chord 64 and a hairpin at chord 10, and a stub
          //      whose whole drawing is a head pointing sideways is the "two arrowheads
          //      overlapped" the owner reported.
          const bulge = capBow({ length: grown.length, bow: (bd.src < bd.tgt ? 1 : -1) * px(14) })
          //   4. everything below — the head's angle and the count's position — is derived
          //      from the CAPPED control point: one derivation, so the head cannot point
          //      off a curve the shaft is not drawing.
          const cx = (ax + bx) / 2 + nx * bulge
          const cy = (ay + by) / 2 + ny * bulge
          const ang = (Math.atan2(by - cy, bx - cx) * 180) / Math.PI
          // test hooks, in SCREEN px and degrees: the drawn chord, whether it was lengthened,
          // and how far the head points off its own chord (attributes only)
          const chordPx = grown.length / px(1)
          const headOff = Math.abs((((Math.atan2(by - cy, bx - cx) - Math.atan2(by - ay, bx - ax)) * 180) / Math.PI + 540) % 360 - 180)
          const d = `M${ax},${ay} Q${cx},${cy} ${bx},${by}`
          // the curve's midpoint (t = 0.5 on the quadratic) — where the
          // traffic count sits
          const mx = 0.25 * ax + 0.5 * cx + 0.25 * bx
          const my = 0.25 * ay + 0.5 * cy + 0.25 * by
          const col = bd.type ? EDGE_COLOR[bd.type] : MIXED_EDGE_COLOR
          // item 3: this road lights when the hovered counterpart is its end
          const lit = litRoad != null && (bd.src === litRoad || bd.tgt === litRoad)
          const dim = anyRoadLit && !lit
          return (
            <g
              key={bd.key}
              data-seledge={`${bd.src}>${bd.tgt}`}
              data-en={bd.n}
              data-dir={bd.dir}
              data-rlen={chordPx.toFixed(2)}
              data-rgrew={grown.grew ? 1 : 0}
              data-rhead={headOff.toFixed(1)}
              data-elit={lit ? 1 : 0}
              opacity={dim ? 0.22 : 1}
              // OB-096 — MapTooltip's relation shape, on hover. `stroke`
              // rather than `auto`: only the drawn line (including its
              // wider white halo, a real hit target) responds, not the
              // curve's whole invisible fill-none bounding box.
              pointerEvents="stroke"
              onPointerEnter={() => {
                setHoverEdge(bd)
                placeTipAtCursor()
              }}
              onPointerLeave={() => setHoverEdge((h) => (h === bd ? null : h))}
              style={{ transition: 'opacity 120ms' }}
            >
              {/* A RELATION IS THE FOCUS LAYER, so it must not draw lighter
                  than the walk it displaces. It did: the walk's head is
                  ARROW_METRICS 8 long by 8.8 wide on a 1.5px shaft, and these
                  were 5.5 by 5.6 on 1.8 — the RECEDED layer carrying the bigger
                  arrowheads. OB-117 tried to open that gap by dimming the walk
                  and could not, because the gap was the wrong way round to
                  begin with; owner still reported the relations hard to read
                  with the recede shipped and working. Sized a step ABOVE the
                  walk's head instead of a step below it.

                  The head takes the same white casing as its shaft, which is
                  OB-116's argument one layer up: a bare triangle over a
                  saturated territory fill is a smudge, and enlarging it only
                  makes a bigger smudge. */}
              <path d={d} fill="none" stroke="#ffffff" strokeWidth={px(lit ? 6.2 : 4.8)} strokeOpacity={0.75} />
              <path d={d} fill="none" stroke={col} strokeWidth={px(lit ? 4.4 : bd.n > 1 ? 3.4 : 2.6)} strokeOpacity={0.92} />
              {bd.dir === 'fwd' && (
                <g transform={`translate(${bx} ${by}) rotate(${ang})`}>
                  <path d={`M${px(1.4)},0 L${-px(10.4)},${px(6.2)} L${-px(10.4)},${-px(6.2)} Z`} fill="#ffffff" fillOpacity={0.75} />
                  <path data-selhead d={`M0,0 L${-px(9)},${px(5)} L${-px(9)},${-px(5)} Z`} fill={col} />
                </g>
              )}
              {bd.n > 1 && (
                <text
                  x={mx}
                  y={my - px(4)}
                  textAnchor="middle"
                  fontSize={px(10)}
                  fontWeight={700}
                  fill={col}
                  stroke="#ffffff"
                  strokeWidth={px(2.6)}
                  paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  ×{bd.n}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </>
  )
}
