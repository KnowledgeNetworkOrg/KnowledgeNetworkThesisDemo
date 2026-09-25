// Fitting a name inside a convex cell. SVG text does not wrap, so wrapping is
// ours: split the title into ≤2 lines and centre each line on the horizontal
// CHORD of the cell at that line's height — the exact room a horizontal line of
// text has there, which no inscribed-circle estimate matches.
//
// A name whose best split still overflows is DROPPED. Not every place is named
// at every scale; zooming in names it, and the hover tooltip always has it.
// force=true (the parent watermark ghost) returns its best split regardless:
// orientation text may bleed, it must not vanish.
//
// Lifted out of NestedAtlasView 2026-07-14. It is pure, and it was sitting in
// the middle of a 948-line component where no test could see it. 2026-07-16
// the region variant below closed the "labels overlap / region text not
// wrapped" note: L0/L1 names wrap through the same mechanic now.

import { chordAt, regionChordAt } from './nested'
import type { Territory } from './nested'
import type { XY } from './derive'
import { clipToRoom, LabelCut, textWidth } from '@/ds/values'

const CHAR_W = 0.58 // ≈ average glyph width / font-size of the UI sans
const FIT = 0.88 // fraction of the chord a line may fill

export interface FitLine {
  x: number
  y: number
  text: string
}

/** The box a fitted label actually occupies, in world units — the union of its
 *  lines' own boxes.
 *
 *  It lives HERE because it is the same measurement `fitLabel` already makes:
 *  a line's width is `text.length * fs * CHAR_W`, and `CHAR_W` is this module's
 *  private constant. A caller that needed a label's extent would have to retype
 *  that number, and the two would drift the first time the UI font changed.
 *
 *  `x` on a `FitLine` is the line's CENTRE (the text is drawn `text-anchor:
 *  middle`) and `y` is its BASELINE, so the box runs half a width either side of
 *  x, and from roughly four-fifths of the font size above the baseline to a
 *  fifth below it — cap height up, descender down. Approximate on purpose: this
 *  is used to keep other marks off the text, where being a pixel generous is
 *  free and being a pixel mean is the bug.
 *
 *  KEEPS THE CHARACTER ESTIMATE ON PURPOSE (OB-212): `fitLabel` below now MEASURES a name's
 *  width, because there being generous was the whole bug (an over-wide estimate dropped names
 *  that fit). A keep-away box has the opposite incentive — measured 1.11-1.25x too wide is a
 *  free margin here, not a missing name, so the cheap estimate stays. */
export interface LabelBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function labelBox(lines: FitLine[], fs: number): LabelBox | null {
  if (lines.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const l of lines) {
    const half = (l.text.length * fs * CHAR_W) / 2
    x0 = Math.min(x0, l.x - half)
    x1 = Math.max(x1, l.x + half)
    y0 = Math.min(y0, l.y - fs * 0.8)
    y1 = Math.max(y1, l.y + fs * 0.2)
  }
  return { x0, y0, x1, y1 }
}

/** The result of fitting a name into a cell: the lines to draw, and the font size actually
 *  used to draw them — which may be smaller than the size asked for (OB-212 clause 3: a
 *  shrunk label must REPORT its shrunk size, not the ceiling it started from, or a caller
 *  sizing a box from the request rather than the answer reserves room the label isn't using
 *  and starves whatever else wanted that room, e.g. a walk pin, OB-108). */
export interface LabelFit {
  lines: FitLine[]
  fs: number
}

/** Fits `title` into cell `t` at up to `fs` (same unit space as `t`'s own coordinates — the
 *  caller may be measuring in real px or, as the map does, in a world-unit stand-in for one;
 *  `textWidth` is linear in its `fontPx` so either is exact as long as `fs` and `floorFs`
 *  share the caller's space). MEASURED, not estimated (OB-212): the old `CHAR_W * length`
 *  guess over-counted a real name by 1.11-1.25x, so combined with `FIT`'s margin the cell
 *  demanded ~1.4x the room a name actually needed — deciding whether a cell got a name by
 *  NAME LENGTH, not cell size, which is the bug this replaces.
 *
 *  Tries the whole title on one line, then the best two-word split, then — if neither fits —
 *  SHRINKS the winning split by `LabelCut.shrinkStep` down to `floorFs` before giving up
 *  (region names have shrunk this way since they were written; cell names now do too, down
 *  to their own floor rather than region's, since a name this small is noise at a cell's
 *  base size — see `LabelCut.floorPx`'s docblock). Below the floor: `force` (the parent
 *  watermark ghost) returns its best split regardless, unclipped, since orientation text may
 *  bleed but must never vanish; otherwise `clipToRoom` decides one final one-line cut, or
 *  drops the name (`null`) if even that reads as noise. */
export function fitLabel(title: string, t: Territory, fs: number, force: boolean, floorFs: number): LabelFit | null {
  const attempt = (f: number) => {
    const lh = f * 1.12
    const wOf = (s: string) => textWidth(s, { fontPx: f })
    const at = (y: number, text: string) => {
      const c = chordAt(t.poly, y)
      return {
        x: c ? (c[0] + c[1]) / 2 : t.cx,
        y: y + f * 0.35,
        text,
        over: wOf(text) - (c ? (c[1] - c[0]) * FIT : 0),
      }
    }
    const one = at(t.cy, title)
    if (one.over <= 0) return { lines: [one], over: one.over }
    const words = title.split(' ')
    let best: { l1: FitLine; l2: FitLine; over: number } | null = null
    for (let k = 1; k < words.length; k++) {
      const l1 = at(t.cy - lh / 2, words.slice(0, k).join(' '))
      const l2 = at(t.cy + lh / 2, words.slice(k).join(' '))
      const over = Math.max(l1.over, l2.over)
      if (!best || over < best.over) best = { l1, l2, over }
    }
    return best ? { lines: [best.l1, best.l2], over: best.over } : { lines: [one], over: one.over }
  }

  let curFs = fs
  let a = attempt(curFs)
  while (a.over > 0 && curFs > floorFs) {
    curFs = Math.max(floorFs, curFs * LabelCut.shrinkStep)
    a = attempt(curFs)
  }
  if (a.over <= 0) return { lines: a.lines, fs: curFs }
  if (force) return { lines: a.lines, fs: curFs }

  const c = chordAt(t.poly, t.cy)
  const room = c ? (c[1] - c[0]) * FIT : 0
  const clipped = clipToRoom(title, room, { fontPx: floorFs })
  if (clipped == null) return null
  return {
    lines: [{ x: c ? (c[0] + c[1]) / 2 : t.cx, y: t.cy + floorFs * 0.35, text: clipped }],
    fs: floorFs,
  }
}

// ── Region names (SelfNotes: "labels overlap / region text not wrapped") ─────
// The L0 domain and L1 module names used to be single unwrapped lines at their
// centroids — long names ran two cells over and piled onto each other. They now
// go through the same wrap-into-the-cell mechanic as the deep tiers, against
// the honest region chord (regionChordAt — non-convex, multi-ring), with one
// extra lever the territory labels don't need: these are the ONLY names on
// their level, so instead of dropping an overflowing one, the FONT SHRINKS
// step by step until the best split fits (floored — below ~½ size a name is
// noise, and an honest small bleed beats an absent name).

export interface RegionFit {
  lines: FitLine[]
  /** multiply the intended font size by this — 1 when the name fit as asked */
  shrink: number
}

export function fitRegionLabel(title: string, rings: XY[][], cx: number, cy: number, fs: number, minShrink = 0.55): RegionFit {
  const attempt = (k: number): { lines: FitLine[]; over: number } => {
    const f = fs * k
    const lh = f * 1.12
    const wOf = (s: string) => s.length * f * CHAR_W
    const at = (y: number, text: string) => {
      const c = regionChordAt(rings, y, cx)
      return {
        x: c ? (c[0] + c[1]) / 2 : cx,
        y: y + f * 0.35,
        text,
        over: wOf(text) - (c ? (c[1] - c[0]) * FIT : 0),
      }
    }
    const one = at(cy, title)
    if (one.over <= 0) return { lines: [one], over: one.over }
    const words = title.split(' ')
    let best: { l1: FitLine; l2: FitLine; over: number } | null = null
    for (let i = 1; i < words.length; i++) {
      const l1 = at(cy - lh / 2, words.slice(0, i).join(' '))
      const l2 = at(cy + lh / 2, words.slice(i).join(' '))
      const over = Math.max(l1.over, l2.over)
      if (!best || over < best.over) best = { l1, l2, over }
    }
    return best ? { lines: [best.l1, best.l2], over: best.over } : { lines: [one], over: one.over }
  }
  let k = 1
  let a = attempt(k)
  while (a.over > 0 && k > minShrink) {
    k = Math.max(minShrink, k * 0.9)
    a = attempt(k)
  }
  return { lines: a.lines, shrink: k }
}
