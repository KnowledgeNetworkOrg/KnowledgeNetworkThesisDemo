// THE MAP'S LABEL FITTING (#324 seam 4) — the reading half of the label layer,
// moved out of MapView whole. `model/labelfit.ts` is the pure arithmetic
// (measure, wrap, shrink, collide); this hook is the map's one reading of it per
// level: every drawn name's fit for the current stratum, the root's own, and the
// boxes the walk pins must steer around (OB-108). The drawing is `MapLabels.tsx`.
//
// It is called where `labelFontsReady` and its memos sat in MapView, so the
// font-ready effect keeps its exact place in the hook order.

import { useEffect, useMemo, useState } from 'react'

import { LabelCut } from '@/ds'
import { byId } from '../../corpus/graph'
import { countryLabels, provinceLabels, rootLabel } from '../../model/atlas'
import { fitLabel, fitRegionLabel, keepClearOfEarlier, labelBox, regionLabelBox } from '../../model/labelfit'
import type { FitLine, LabelBox, LabelFit } from '../../model/labelfit'
import { countryRings, provinceRings, rootRings, territories } from '../../model/nested'
import { LEVEL_S } from './camera'

// ── THE CONTEXT WINDOW ───────────────────────────────────────────────────────
// One formal rule for ALL receded line-work and ghost text, keyed on
// d = level − tier (how many grains above the active stratum an ancestor is).
// Relevance is LOCAL: the immediate parent (d = 1) is the only ancestor that
// renders — full border emphasis plus one big faint watermark ghost. Every
// grain above it disappears ENTIRELY (a sharp window, not a decay): global
// orientation is already carried by the tree COLORS of every fill, so
// far-ancestor line-work and text were redundant noise. d < 1 (the active
// level and the pre-mounted next tier) is the fill layers' job, not the
// line-work's. THE TWO HALVES LIVE HERE TOGETHER, both read off this one window:
// MapView imports `ancBorderO` for its line-work, `MapLabels` imports
// `ancLabelO` for its ghosts, so the window cannot drift apart per layer.
// The window has exactly ONE local exception, and it is a reading exception,
// not a structural one: the single ghost the CURSOR is standing inside fades
// almost away (see `ancLabelOAt`, item 10, in MapLabels.tsx). The rule below
// still decides which grains exist; that one only decides whether the ghost you
// are reading through gets out of your way.
export const ancBorderO = (d: number) => (d === 1 ? 0.6 : 0)
/** THE GHOST HEADING IS DRAWN AT FULL OPACITY INSIDE THE WINDOW (OB-223) — it was 0.32. The quiet
 *  now lives in the COLOUR, one opaque mid-tone per hue (`topicPaintValues().ghost`), because a hue
 *  at 0.32 alpha composited through whatever lay beneath it took a different value over every child
 *  and changed shade mid-word: "a background layer reporting what is under it". Outside the window
 *  it is still 0. The one exception is unchanged and lives in `ancLabelOAt` (MapLabels.tsx): the
 *  ghost the cursor is standing inside steps aside. */
export const ancLabelO = (d: number) => (d === 1 ? 1 : 0)

/** the intended size (world units) of a parent-grain region name and of the deep
 *  ghost heading — the one size the fitting below measures against. */
export const PARENT_LABEL_PX = 26

/** the weight a domain name is drawn at — read by the `<text>` AND by the box `labelFit`
 *  measures for it (#369), which is a width at this weight, so the two cannot drift. */
export const DOMAIN_NAME_WEIGHT = 800

/** everything `labelFit` builds, in one value: the active-grain names, the one ghost
 *  grain, the region names (L0/L1), and every drawn name as a box (OB-108). */
export type MapLabelFit = {
  active: Map<string, LabelFit>
  ghost: Map<string, LabelFit>
  region: Map<string, { lines: FitLine[]; fs: number }>
  box: Map<string, LabelBox>
}

/** the root's own fitted name (OB-193), kept out of `labelFit` — that memo is guarded
 *  off entirely at level -1, and this is the one thing still drawn there. */
export type MapRootLabelFit = { lines: FitLine[]; fs: number }

export function useMapLabelFit({ level, f }: { level: number; f: number }) {
  // OB-212: `fitLabel` now MEASURES a name against the real webfont rather than estimating —
  // before Nunito/Quicksand load, `textWidth` reads the fallback face's metrics, so the first
  // paint can wrap and shrink names against the wrong numbers. Re-run the memo once the real
  // face is in, same pattern as AuthorRoad's `setFontsReady`.
  const [labelFontsReady, setLabelFontsReady] = useState(0)
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let on = true
    document.fonts.ready.then(() => { if (on) setLabelFontsReady((n) => n + 1) })
    return () => { on = false }
  }, [])

  // wrapped labels, fitted at the level's CANONICAL scale — not the mid-flight
  // zoom — so a name's line breaks are decided once per level, not per frame
  const labelFit = useMemo<MapLabelFit>(() => {
    // OB-212: no value read here, only a re-run trigger — `textWidth` measures against
    // whichever face is ACTUALLY loaded for a given font-family string, and that changes
    // as the webfont arrives even though the string itself never does.
    void labelFontsReady
    const active = new Map<string, LabelFit>()
    const ghost = new Map<string, LabelFit>()
    // OB-108: every fitted label's own extent, so a walk pin can be kept off the
    // name it would otherwise delete. Built HERE rather than beside the pins
    // because this is the only place that knows each label's font size — the
    // three cases below each choose their own — and a box without its size is a
    // second guess at the same number.
    const box = new Map<string, LabelBox>()
    const noteBox = (id: string, lines: FitLine[] | null, fs: number) => {
      const bx = lines ? labelBox(lines, fs) : null
      if (bx) box.set(id, bx)
    }
    // REGION names (SelfNotes: "labels overlap / region text not wrapped"):
    // the L0/L1 names go through the same wrap-into-the-cell mechanic as the
    // deep tiers now, against the honest region chord — with fitRegionLabel's
    // shrink instead of a drop, because they are the only names their level
    // has (the one drop is below: an L0 domain name that would collide with an
    // earlier one). Computed one level past their visibility window so the
    // 350ms opacity fades keep an element to fade.
    const region = new Map<string, { lines: FitLine[]; fs: number }>()
    // OB-193: level -1 (the root) draws through its own small, separate block below — none of
    // this memo's tier machinery applies to it, and LEVEL_S has no entry at -1 to index.
    if (level < 0) return { active, ghost, region, box }
    const world = (v: number) => (v * f) / LEVEL_S[level]
    if (level <= 2) {
      const size = level === 0 ? 24 : PARENT_LABEL_PX
      const fitted = countryLabels.map((c) => ({ c, fit: fitRegionLabel(c.label, countryRings[c.key], c.x, c.y, world(size)) }))
      // #369: each name fits ITS OWN region, and nothing asked whether two names run into each
      // other. At L0 the domain names are the ACTIVE grain — the level being read — so a name
      // that would collide with an earlier one is left out (the hover tooltip still names it),
      // and only the survivors are stored below, which also keeps a walk pin from steering
      // around a name that is not drawn. At L1 and beyond they are the parent's watermark, which
      // stays named for orientation, so they are not gated.
      const keep =
        level === 0
          ? keepClearOfEarlier(fitted.map(({ fit }) => regionLabelBox(fit.lines, world(size * fit.shrink), DOMAIN_NAME_WEIGHT)))
          : fitted.map(() => true)
      fitted.forEach(({ c, fit }, i) => {
        if (!keep[i]) return
        region.set(c.key, { lines: fit.lines, fs: size * fit.shrink })
        noteBox(c.key, fit.lines, world(size * fit.shrink))
      })
    }
    if (level <= 3)
      for (const m of provinceLabels) {
        const size = level <= 1 ? 15 : PARENT_LABEL_PX
        const fit = fitRegionLabel(m.label, provinceRings[m.key], m.x, m.y, world(size))
        region.set(m.key, { lines: fit.lines, fs: size * fit.shrink })
        noteBox(m.key, fit.lines, world(size * fit.shrink))
      }
    if (level < 2) return { active, ghost, region, box }
    // OB-212: the floor a cell name may shrink to before `clipToRoom` takes over — in this
    // memo's own world-unit space, so it shrinks alongside the name being fitted rather than
    // a raw `LabelCut.floorPx` (a real-px number) being compared against a world-unit size.
    const floorFs = world(LabelCut.floorPx)
    for (const t of territories) {
      if (t.tier === level || (t.leaf && t.tier < level)) {
        const fs = world(t.tier === level ? 12.5 : 11.5)
        const fit = fitLabel(byId.get(t.id)!.title, t, fs, false, floorFs)
        if (fit) active.set(t.id, fit)
        noteBox(t.id, fit ? fit.lines : null, fit ? fit.fs : fs)
      } else if (level >= 3 && !t.leaf && t.tier === level - 1) {
        const fs = world(PARENT_LABEL_PX)
        const fit = fitLabel(byId.get(t.id)!.title, t, fs, true, floorFs)!
        ghost.set(t.id, fit)
        // THE PARENT WATERMARK COUNTS AS A LABEL TOO (OB-108). It is the name of
        // the very cell a pin at this level belongs to, so a pin over it is the
        // same fault as one over an active name, only quieter. It is a WEAK case
        // on purpose: the ghost is set at the parent grain and can span most of
        // the region, so there is often nowhere inside the cell that clears it —
        // and `pinSpotClear` then leaves the pin where it was rather than
        // shoving it somewhere worse. Registering it costs one box and improves
        // the cases where a clear spot does exist.
        noteBox(t.id, fit.lines, fit.fs)
      }
    }
    return { active, ghost, region, box }
    // labelFontsReady is a re-run trigger only (OB-212): the memo re-measures against
    // whichever face is loaded when it runs, it never branches on the counter's value.
  }, [level, f, labelFontsReady])

  /** OB-193: the root's own name, fitted into `rootRings` the same way a country's name fits
   *  into its own — kept OUT of `labelFit` above because that memo is guarded off entirely at
   *  level -1, and this is the one thing still drawn there. Shares level 0's world-scale
   *  (`LEVEL_S[0]`), for the same reason `flyToLevel` shares its camera framing. */
  const rootLabelFit = useMemo<MapRootLabelFit | null>(() => {
    if (level !== -1) return null
    const size = 24
    const world = (v: number) => (v * f) / LEVEL_S[0]
    const fit = fitRegionLabel(rootLabel.label, rootRings, rootLabel.x, rootLabel.y, world(size))
    return { lines: fit.lines, fs: size * fit.shrink }
  }, [level, f])

  /** every name actually drawn at this level, as boxes — what a walk pin has to
   *  stay off (OB-108). Its own memo so `routeStops` re-runs when the labels
   *  move, not when anything else in `labelFit` does. */
  const labelBoxes = useMemo(() => [...labelFit.box.values()], [labelFit])

  return { labelFit, rootLabelFit, labelBoxes }
}
