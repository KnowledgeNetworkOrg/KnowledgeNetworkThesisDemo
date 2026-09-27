// THE MAP'S BASE (#399 cut 4) — the fills and the line-work every other layer
// paints over, moved out of MapView whole: the root's own level, the domains,
// the provinces and the mounted territories, then the immediate parent grain's
// borders. The camera's cross-fade (`FADE`) and the border weight
// (`PARENT_BORDER_W`) move with the paint they style.

import { ROOT_ID, domainIds } from '../../corpus/graph'
import { colorOf, territoryFillOf } from '../../model/color'
import { provinceIds } from '../../model/flat'
import { countryPath, provincePath, rootPath } from '../../model/nested'
import type { Territory } from '../../model/nested'
import { ancBorderO } from './maplabelfit'

// The level-change cross-fade: a cell's paint and its outline arrive and leave
// together, so a stratum swap reads as one movement instead of two.
//
// STROKE-WIDTH IS DELIBERATELY NOT IN THIS LIST (#238). It was, and it was wrong
// twice over. Every stroke on the map is `px(k)` = `k * f / view.s`, so its width
// is a CONSTANT at any given level and changes only while `view.s` is moving —
// which is to say, only during a zoom flight, where it is ALREADY interpolating
// smoothly on its own, once per animation frame.
//
//   the cost — a 350ms transition restarted ~16 times over a 260ms flight, on
//   every one of ~350 elements, on a property that (unlike transform and opacity)
//   is not compositor-only and so forces layout and paint on the main thread each
//   time. Measured by probe-maplag.mjs, medians of 5: a zoom round trip at L2
//   738ms -> 428ms, and layouts 82 -> 33.
//
//   the bug — a transition does not only cost, it LAGS, and this one lagged
//   enormously. Sampling the rendered width against the attribute React had just
//   written, frame by frame through one flight: the gap peaked at 98.8% — the
//   line-work drawing at 1.72 units where the map had asked for 0.86, i.e. TWICE
//   the intended weight — and was still more than 1% out 587ms in, well over
//   double the length of the flight it was supposedly smoothing. With the property
//   removed the same sampling reads 0% on every frame. So this is a correctness
//   fix that happens to also be faster: there is no level change at which a width
//   jumps, so the transition was never smoothing anything, only blurring it.
const FADE = 'fill-opacity 350ms, stroke-opacity 350ms'

/** the immediate parent grain's border weight. The window that decides WHEN a border
 *  or a ghost exists — `ancBorderO`/`ancLabelO`, one rule for both halves — is
 *  `./map/maplabelfit.ts`, so the line-work and the labels cannot drift apart. */
const PARENT_BORDER_W = 2.6

export interface MapBaseProps {
  level: number
  sel: string | null
  mounted: Territory[]
  isActive: (t: { tier: number; leaf: boolean }) => boolean
  isMuted: (t: { tier: number; leaf: boolean }) => boolean
  /** real screen px -> world units — MapView's own `px` */
  px: (v: number) => number
  regionClick: (id: string) => void
  enterCell: (id: string) => void
  leaveCell: (id: string) => void
}

export function MapBase({ level, sel, mounted, isActive, isMuted, px, regionClick, enterCell, leaveCell }: MapBaseProps) {
  return (
    <>
      {/* ── FILLS, painted shallow → deep. Only the active level carries
          paint (pale tree colors) and pointer events; everything else is
          mounted transparent so level changes FADE. ─────────────────── */}
      {/* OB-193: THE ROOT'S OWN LEVEL — one region, the whole corpus, drawn where the six
          domains sit today (same `rootRings`/`countryRings` extent, same camera). It takes
          `territoryFillOf`/`colorOf(ROOT_ID)`, which every map fill/anchor lookup already
          falls back to a neutral swatch for on an id with no hue family — the root has
          none, by design (owner, 2026-09-15), so it draws colourless without a second
          colour path to keep in step with the rest of the map. It has no sibling to
          separate from, so it carries no ancestor-border line-work of its own. */}
      <path
        d={rootPath}
        data-region={ROOT_ID}
        data-rtier={-1}
        fill={territoryFillOf(ROOT_ID)}
        fillOpacity={level === -1 ? 0.95 : 0}
        stroke="#ffffff"
        strokeOpacity={level === -1 ? 0.9 : 0}
        strokeWidth={px(1.2)}
        pointerEvents={level === -1 ? 'auto' : 'none'}
        style={{ cursor: sel === ROOT_ID ? 'grab' : 'pointer', transition: FADE }}
        onClick={() => regionClick(ROOT_ID)}
        onPointerEnter={() => enterCell(ROOT_ID)}
        onPointerLeave={() => leaveCell(ROOT_ID)}
      />
      <g>
        {domainIds.map((d) => (
          <path
            key={d}
            d={countryPath[d]}
            data-region={d}
            data-rtier={0}
            fill={territoryFillOf(d)}
            fillOpacity={level === 0 ? 0.95 : 0}
            stroke="#ffffff"
            strokeOpacity={level === 0 ? 0.9 : 0}
            strokeWidth={px(1.2)}
            pointerEvents={level === 0 ? 'auto' : 'none'}
            style={{ cursor: sel === d ? 'grab' : 'pointer', transition: FADE }}
            onClick={() => regionClick(d)}
            onPointerEnter={() => enterCell(d)}
            onPointerLeave={() => leaveCell(d)}
          />
        ))}
      </g>
      <g>
        {provinceIds.map((m) => (
          <path
            key={m}
            d={provincePath[m]}
            data-region={m}
            data-rtier={1}
            fill={territoryFillOf(m)}
            fillOpacity={level === 1 ? 0.95 : 0}
            stroke="#ffffff"
            strokeOpacity={level === 1 ? 0.95 : 0}
            strokeWidth={px(1.1)}
            pointerEvents={level === 1 ? 'auto' : 'none'}
            style={{ cursor: sel === m ? 'grab' : 'pointer', transition: FADE }}
            onClick={() => regionClick(m)}
            onPointerEnter={() => enterCell(m)}
            onPointerLeave={() => leaveCell(m)}
          />
        ))}
      </g>
      <g>
        {mounted.map((t) => (
          <path
            key={t.id}
            d={t.d}
            data-terr={t.id}
            data-tier={t.tier}
            fill={territoryFillOf(t.id)}
            fillOpacity={isActive(t) ? (isMuted(t) ? 0.6 : 0.95) : 0}
            stroke="#ffffff"
            strokeOpacity={isActive(t) ? 0.95 : 0}
            strokeWidth={px(1.05)}
            pointerEvents={isActive(t) ? 'auto' : 'none'}
            style={{ cursor: sel === t.id ? 'grab' : 'pointer', transition: FADE }}
            onClick={() => regionClick(t.id)}
            onPointerEnter={() => enterCell(t.id)}
            onPointerLeave={() => leaveCell(t.id)}
          />
        ))}
      </g>

      {/* ── LINE-WORK: under the context window at most ONE of these
          layers is visible at a time — the immediate parent grain. The
          active level owns the whole color budget. ──────────────────── */}
      <g pointerEvents="none">
        {domainIds.map((d) => (
          <path
            key={d}
            d={countryPath[d]}
            data-border={d}
            data-btier={0}
            fill="none"
            stroke={colorOf(d)}
            strokeOpacity={ancBorderO(level)}
            strokeWidth={px(PARENT_BORDER_W)}
            style={{ transition: FADE }}
          />
        ))}
        {provinceIds.map((m) => (
          <path
            key={m}
            d={provincePath[m]}
            data-border={m}
            data-btier={1}
            fill="none"
            stroke={colorOf(m)}
            strokeOpacity={ancBorderO(level - 1)}
            strokeWidth={px(PARENT_BORDER_W)}
            style={{ transition: FADE }}
          />
        ))}
        {[...mounted]
          .filter((t) => !t.leaf)
          .sort((a, b) => a.tier - b.tier)
          .map((t) => (
            <path
              key={t.id}
              d={t.d}
              data-border={t.id}
              data-btier={t.tier}
              fill="none"
              stroke={colorOf(t.id)}
              strokeOpacity={ancBorderO(level - t.tier)}
              strokeWidth={px(PARENT_BORDER_W)}
              style={{ transition: FADE }}
            />
          ))}
      </g>
    </>
  )
}
