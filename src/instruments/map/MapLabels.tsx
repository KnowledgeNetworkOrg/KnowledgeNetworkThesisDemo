// THE MAP'S LABEL LAYER (#324 seam 4) — the `pointerEvents="none"` group that
// draws every name on the map: the active grain in full ink, the one ghost
// heading above it, and the rules for their ink, case and the one ghost that
// steps aside under the cursor. The fitting is `useMapLabelFit` (maplabelfit.ts);
// the pure arithmetic is `model/labelfit.ts`.

import { LabelCut, topicPaintValues } from '@/ds'
import { ROOT_ID, topicHueOf } from '../../corpus/graph'
import { countryLabels, provinceLabels } from '../../model/atlas'
import { colorOf, labelInkOf, selectedInkOf } from '../../model/color'
import type { XY } from '../../model/derive'
import { parentOf } from '../../model/nav'
import type { Territory } from '../../model/nested'
import { ancLabelO, DOMAIN_NAME_WEIGHT } from './maplabelfit'
import type { MapLabelFit, MapRootLabelFit } from './maplabelfit'

/** THE PARENT LAYER'S NAME GETS A CASE OF ITS OWN, and it is that — not the
 *  opacity alone — that makes the ghost legible (owner, 2026-08-28: the parent
 *  headings are too faint, make them more visible).
 *
 *  The ghost is set in the region's OWN hue over that region's own fill, so it is
 *  tint on tint: at 0.15 it read as a stain rather than a word, and simply
 *  turning it up muddies into the fill instead of separating from it — more ink,
 *  still no edge. A white case gives the glyphs a boundary, and with one the same
 *  word carries at far less ink than it would need bare. So the opacity moves
 *  0.15 → 0.32 AND the case arrives; either half alone is the wrong fix.
 *
 *  DELIBERATELY THINNER AND SOFTER THAN THE ACTIVE GRAIN'S CASE (2.4 at 0.85):
 *  the ghost is context, not the stratum being read, and must not come forward
 *  far enough to compete with the names on the level you are actually on. The
 *  element's own `opacity` still multiplies fill and case together, so the hover
 *  fade to 0.03 keeps working untouched — the ghost you are standing inside
 *  still steps aside.
 *
 *  OB-223: the ghost's FILL is no longer the region's hue at 0.32 alpha but one opaque tone per hue
 *  (`ghostOf`, below), drawn at full opacity and above every fill and every wash — this case is
 *  unchanged and still rides on top of that tone. */
const GHOST_CASE = { stroke: '#ffffff', strokeWidth: 3.2, strokeOpacity: 0.75 }

export interface MapLabelsProps {
  level: number
  labelFit: MapLabelFit
  rootLabelFit: MapRootLabelFit | null
  /** real screen px -> world units — MapView's own `px` */
  px: (v: number) => number
  /** a fitted world-unit size -> the live zoom's SVG units (OB-212) */
  worldFsToPx: (worldFs: number) => number
  onScreen: (p: XY, margin: number) => boolean
  mounted: Territory[]
  isActive: (t: { tier: number; leaf: boolean }) => boolean
  isMuted: (t: { tier: number; leaf: boolean }) => boolean
  sel: string | null
  /** the cell MY cursor is on — the one ghost that steps aside (item 10) */
  hover: string | null
}

export function MapLabels({ level, labelFit, rootLabelFit, px, worldFsToPx, onScreen, mounted, isActive, isMuted, sel, hover }: MapLabelsProps) {
  /** the parent layer's case, applied ONLY where a name is acting as a ghost.
   *  A domain name at L0 and a module name at L1 are the ACTIVE grain, not
   *  context — they are the level you are reading — and they keep exactly the
   *  treatment they shipped with. The same element draws both roles, so the
   *  distinction has to be made per render rather than per component. */
  const ghostCase = (on: boolean) =>
    on
      ? { stroke: GHOST_CASE.stroke, strokeWidth: px(GHOST_CASE.strokeWidth), strokeOpacity: GHOST_CASE.strokeOpacity, paintOrder: 'stroke' }
      : {}

  // ── item 10: "labels blocking when zoomed in" ────────────────────────────
  // The watermark never blocked a CLICK — every label layer is pointerEvents:
  // none. What it blocked was READING: 26px of parent name lying across the
  // small active names underneath. The cure is one rule, the same shape as the
  // context window itself — the ghost you are STANDING INSIDE steps aside,
  // because that is exactly the cell whose contents you are trying to read.
  // Move the cursor away and it returns; orientation costs nothing the moment
  // you stop needing the detail. Since the territories tile their parent
  // exactly, the ghost under the cursor is just the parent of the hovered cell
  // — true at every level, so countries, provinces and deep ghosts share it.
  const ghostUnderCursor = hover ? parentOf(hover) : null
  const ancLabelOAt = (d: number, id: string) => (id === ghostUnderCursor ? 0.03 : ancLabelO(d))
  /** THE GHOST HEADING'S ONE TONE (OB-223): the region's hue as a single resolved, OPAQUE `oklch()`
   *  from `topicPaintValues().ghost` — the JS-resolved twin of `topicPaint().ghost`, because a
   *  `var()` in an SVG presentation attribute is not something this map trusts (an unknown hue
   *  would otherwise draw nothing). One value per hue, so a heading reads the SAME colour over every
   *  child it spans, selected or not; what the cell beneath it is doing is none of its business. */
  const ghostOf = (id: string) => topicPaintValues(topicHueOf(id)).ghost.css

  // ── labels: the active grain in full ink, ONE ghost above it. No capital dots
  // (2026-07-13) — the fill, border and name already say "a node lives here";
  // the wrapped name IS the place marker.
  //
  // PAINT ORDER IS THE POINT (2026-07-14, item 10): every ghost paints BEFORE the
  // active names, never after. The deep ghost layer used to come last and so laid
  // its 26px parent name ON TOP of the very labels the reader was zooming in to
  // read. Ghosts are background; they go in the background.
  return (
    <g pointerEvents="none">
      {/* OB-193: the root's own name — full ink only at its own level, exactly the
          active-grain treatment `countryLabels` gets at level 0 below (no ghost: there
          is nothing above the root to ghost it FOR, and nothing beside it to separate
          it FROM). `colorOf(ROOT_ID)` resolves to the same neutral anchor its fill does. */}
      {rootLabelFit && (
        <text
          data-regionlabel={ROOT_ID}
          textAnchor="middle"
          fontSize={px(rootLabelFit.fs)}
          fontWeight={800}
          fill={colorOf(ROOT_ID)}
          opacity={0.55}
          style={{ userSelect: 'none', transition: 'opacity 350ms' }}
        >
          {rootLabelFit.lines.map((ln, i) => (
            <tspan key={i} x={ln.x} y={ln.y}>
              {ln.text}
            </tspan>
          ))}
        </text>
      )}
      {countryLabels.map((c) => {
        const fit = labelFit.region.get(c.key)
        if (!fit) return null
        return (
          <text
            key={c.key}
            data-regionlabel={c.key}
            textAnchor="middle"
            fontSize={px(fit.fs)}
            fontWeight={DOMAIN_NAME_WEIGHT}
            /* at its own level the domain name is the ACTIVE grain (its anchor at a
               watermark's weight); at every other level it is a GHOST heading, in the one
               opaque tone for its hue (OB-223) */
            fill={level === 0 ? colorOf(c.key) : ghostOf(c.key)}
            opacity={level === 0 ? 0.55 : ancLabelOAt(level, c.key)}
            {...ghostCase(level !== 0)}
            style={{ userSelect: 'none', transition: 'opacity 350ms' }}
          >
            {fit.lines.map((ln, i) => (
              <tspan key={i} x={ln.x} y={ln.y}>
                {ln.text}
              </tspan>
            ))}
          </text>
        )
      })}
      {provinceLabels.map((m) => {
        const fit = labelFit.region.get(m.key)
        if (!fit) return null
        return (
          <text
            key={m.key}
            data-regionlabel={m.key}
            textAnchor="middle"
            fontSize={px(fit.fs)}
            fontWeight={level === 1 ? 700 : 800}
            /* at level 1 a province name is a CELL NAME — it wears the paper case like every
               other (OB-223), because the domain's ghost heading crosses it here; its ink is
               resolved against the cell AS WASHED once the cell is selected. At every other
               level it is the GHOST heading, in the one opaque tone for its hue */
            fill={level === 1 ? (sel === m.key ? selectedInkOf(m.key) : labelInkOf(m.key)) : ghostOf(m.key)}
            opacity={level === 1 ? 0.9 : ancLabelOAt(level - 1, m.key)}
            {...(level === 1 ? LabelCut.case(px(LabelCut.casePx)) : ghostCase(true))}
            style={{ userSelect: 'none', transition: 'opacity 350ms' }}
          >
            {fit.lines.map((ln, i) => (
              <tspan key={i} x={ln.x} y={ln.y}>
                {ln.text}
              </tspan>
            ))}
          </text>
        )
      })}
      {level >= 3 &&
        mounted
          // the window admits ONE territory-grain ghost: the parent
          .filter((t) => !t.leaf && t.tier === level - 1 && onScreen({ x: t.cx, y: t.cy }, 60) && labelFit.ghost.has(t.id))
          .map((t) => (
            <text
              key={`ghost-${t.id}`}
              data-ghostlabel={t.id}
              textAnchor="middle"
              fontSize={worldFsToPx(labelFit.ghost.get(t.id)!.fs)}
              fontWeight={800}
              fill={ghostOf(t.id)}
              opacity={ancLabelOAt(1, t.id)}
              {...ghostCase(true)}
              style={{ userSelect: 'none', transition: 'opacity 200ms' }}
            >
              {labelFit.ghost.get(t.id)!.lines.map((ln, i) => (
                <tspan key={i} x={ln.x} y={ln.y}>
                  {ln.text}
                </tspan>
              ))}
            </text>
          ))}
      {/* the active grain, LAST and white-cased: a name on the stratum you
          are reading punches cleanly through whatever ghost lies under it,
          instead of muddying into it */}
      {level >= 2 &&
        mounted
          .filter((t) => isActive(t) && onScreen({ x: t.cx, y: t.cy }, 60) && labelFit.active.has(t.id))
          .map((t) => {
            // The selected cell's name is CALMED, not shouted (the glow
            // and heavy border already mark the cell): a crisp near-black
            // emphasis ink instead of the muddy dark tint, weight 700 —
            // clean type over an outlined-sticker look. Full opacity keeps
            // it the clearest label even as the glow tints the body beneath.
            //
            // EVERY CELL NAME WEARS THE PAPER CASE, SELECTED OR NOT (OB-223, owner
            // 2026-09-18): `LabelCut.case` — `paintOrder: 'stroke'` so the stroke
            // is drawn first and the letterform keeps its exact weight — spread
            // whole, never retyped, and sized through `px` so it tracks zoom like
            // every other hairline here. A case that arrived on selection would make
            // the label's own drawing a second selection channel, blinking as the
            // user clicks. Worn always, no name on the map depends on what is behind
            // it being light, which is what lets the ghost heading be an opaque tone.
            // AND THE INK IS RESOLVED AGAINST THE COLOUR ACTUALLY PAINTED: a selected
            // cell is washed, so its name takes `selectedInkOf`, not the pre-wash ink.
            const isSel = t.id === sel
            return (
              <text
                key={t.id}
                data-label={t.id}
                textAnchor="middle"
                fontSize={worldFsToPx(labelFit.active.get(t.id)!.fs)}
                fontWeight={isSel ? 700 : 600}
                fill={isSel ? selectedInkOf(t.id) : labelInkOf(t.id)}
                {...LabelCut.case(px(LabelCut.casePx))}
                opacity={isSel ? 1 : isMuted(t) ? 0.7 : 0.92}
                style={{ userSelect: 'none' }}
              >
                {labelFit.active.get(t.id)!.lines.map((ln, i) => (
                  <tspan key={i} x={ln.x} y={ln.y}>
                    {ln.text}
                  </tspan>
                ))}
              </text>
            )
          })}
    </g>
  )
}
