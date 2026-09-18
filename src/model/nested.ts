// Nested atlas geometry — the "territory at every level" MOCK (2026-07-11).
// Extends the atlas's two region tiers (countries = domains, provinces =
// modules) DOWNWARD: EVERY node gets a convex territory and its children
// tile it exactly, so the whole map stays ONE fixed geometry across zoom —
// no level ever gets its own layout, which is what keeps continuous zoom
// possible at all. Tier map: 2 = topics (their global Voronoi cells), then
// 2 + band below (3 = subtopics … maxTier = the level-8 spine tips). Leaves
// get a zone like containers do (2026-07-12: "a zone for each node, all the
// way down"), plus a dot at the zone's center as the place marker.
//
// Sub-cells are computed by half-plane clipping (child cell = parent polygon
// clipped by the bisector against each sibling), NOT a bounded Voronoi:
// convex ∩ half-planes stays convex, so the recursion needs no polygon
// library and 1–2 children are not degenerate cases. Seeds start at the
// authored atlasPos ring positions (they sit within ~24 units of their topic,
// inside cells ≥50 across) and two deterministic Lloyd passes spread them
// from dot-rings into area-filling region seeds.
//
// The global topic tessellation (sea points, Voronoi, country and province
// outlines) is DUPLICATED from MapView on purpose — this is a feel prototype;
// unify the substrate only if the nested atlas graduates. Outlines here are
// RAW cell unions, NOT chaikin-smoothed like MapView's (2026-07-12): every
// tier of this atlas is angular Voronoi work, and rounded region borders
// visibly missed the straight cell edges they are supposed to sit on.

import { Delaunay } from 'd3-delaunay'

import { childrenOf, domainIds, domainOf, topicIds } from '../corpus/graph'
import type { GNode } from '../corpus/graph'
import { atlasPos, FLAT_H, FLAT_W, leafPos, provinceIds, provinceOf } from './flat'
import type { XY } from './derive'

// ── Global topic tessellation (duplicated from MapView — see header) ────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const seaPoints: XY[] = (() => {
  const rnd = mulberry32(7)
  const out: XY[] = []
  for (let i = 0; i < 1100; i++) {
    const p = { x: -40 + rnd() * (FLAT_W + 80), y: -40 + rnd() * (FLAT_H + 80) }
    let dmin = Infinity
    for (const id of topicIds) dmin = Math.min(dmin, Math.hypot(p.x - leafPos[id].x, p.y - leafPos[id].y))
    if (dmin > 84) out.push(p)
  }
  return out
})()

const allPoints: XY[] = [...topicIds.map((id) => leafPos[id]), ...seaPoints]
const voronoi = Delaunay.from(allPoints, (p) => p.x, (p) => p.y).voronoi([-40, -40, FLAT_W + 40, FLAT_H + 40])
const cellOfTopic = new Map(topicIds.map((id, i) => [id, i]))

type Pt = [number, number]

function regionOutlines(cellIdx: number[]): Pt[][] {
  const key = (p: Pt) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`
  const segs = new Map<string, { a: Pt; b: Pt }>()
  for (const i of cellIdx) {
    const poly = voronoi.cellPolygon(i)
    if (!poly) continue
    for (let k = 0; k + 1 < poly.length; k++) {
      const a = poly[k] as Pt
      const b = poly[k + 1] as Pt
      const ka = key(a)
      const kb = key(b)
      if (ka === kb) continue
      if (segs.delete(`${kb}|${ka}`)) continue
      segs.set(`${ka}|${kb}`, { a, b })
    }
  }
  const byStart = new Map<string, { a: Pt; b: Pt }>()
  for (const s of segs.values()) byStart.set(key(s.a), s)
  const rings: Pt[][] = []
  const used = new Set<string>()
  for (const s of segs.values()) {
    if (used.has(key(s.a))) continue
    const ring: Pt[] = []
    let cur: { a: Pt; b: Pt } | undefined = s
    while (cur && !used.has(key(cur.a))) {
      used.add(key(cur.a))
      ring.push(cur.a)
      cur = byStart.get(key(cur.b))
    }
    if (ring.length > 2) rings.push(ring)
  }
  return rings
}

const ringsToPath = (rings: Pt[][]) =>
  rings.map((r) => `M${r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`).join('')

const regionGeom = (memberTopics: string[]) => {
  const rings = regionOutlines(memberTopics.map((t) => cellOfTopic.get(t)!))
  return { d: ringsToPath(rings), rings: rings.map((r) => r.map((p) => ({ x: p[0], y: p[1] }))) }
}

export const countryPath: Record<string, string> = {}
/** region outline polygons (may be multi-ring) — arrow trimming at L0 */
export const countryRings: Record<string, XY[][]> = {}
for (const d of domainIds) {
  const g = regionGeom(topicIds.filter((t) => domainOf(t) === d))
  countryPath[d] = g.d
  countryRings[d] = g.rings
}

export const provincePath: Record<string, string> = {}
export const provinceRings: Record<string, XY[][]> = {}
export const provinceParity: Record<string, number> = {}
for (const d of domainIds) {
  ;(provinceIds.filter((m) => domainOf(m) === d)).forEach((m, i) => {
    const g = regionGeom(topicIds.filter((t) => provinceOf(t) === m))
    provincePath[m] = g.d
    provinceRings[m] = g.rings
    provinceParity[m] = i % 2
  })
}

/** OB-193: the corpus ROOT'S own region — the whole corpus as ONE shape, the union of every
 *  domain's territory. Same `regionGeom` recipe as `countryPath`/`provincePath` above, just
 *  handed every topic instead of one domain's. There is exactly one, so no per-id record. */
const rootGeom = regionGeom(topicIds)
export const rootPath: string = rootGeom.d
export const rootRings: XY[][] = rootGeom.rings

// ── Convex-polygon toolkit ───────────────────────────────────────────────────
function polyCentroid(poly: XY[]): XY {
  let a2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const cross = p.x * q.y - q.x * p.y
    a2 += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(a2) < 1e-6) {
    // degenerate: fall back to the vertex mean
    return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length }
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) }
}

export function pointInPoly(pt: XY, poly: XY[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Clip `poly` to the half-plane of points closer to `a` than to `b`.
 * The signed test d²(p,a) − d²(p,b) is AFFINE in p, so edge crossings
 * interpolate exactly — this is Sutherland–Hodgman against the bisector. */
function clipCloser(poly: XY[], a: XY, b: XY): XY[] {
  const f = (p: XY) => (p.x - a.x) ** 2 + (p.y - a.y) ** 2 - (p.x - b.x) ** 2 - (p.y - b.y) ** 2
  const out: XY[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const fp = f(p)
    const fq = f(q)
    if (fp <= 0) out.push(p)
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq)
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
    }
  }
  return out
}

/** Voronoi-by-clipping: seed i's cell = parent ∩ (closer to i than each sibling). */
const cellsFor = (parent: XY[], seeds: XY[]): XY[][] =>
  seeds.map((s, i) => seeds.reduce((poly, o, j) => (j === i ? poly : clipCloser(poly, s, o)), parent))

// ── Recursive subdivision ────────────────────────────────────────────────────
export interface Territory {
  id: string
  /** 2 = topic … maxTier = deepest stratum (the zoom level that discloses it) */
  tier: number
  /** owning topic — the culling anchor */
  topic: string
  /** svg path of the territory polygon */
  d: string
  cx: number
  cy: number
  /** childless — labeled with the dots, not the region names */
  leaf: boolean
  /** the cell polygon (convex) — label fitting takes horizontal chords of it */
  poly: XY[]
}

/** the horizontal chord of a convex polygon at height y — [x0, x1], or null
 * where y misses the polygon. For horizontal text this is the EXACT room a
 * line has inside the cell, which no inscribed-circle estimate matches. */
export function chordAt(poly: XY[], y: number): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    if (p.y <= y === q.y <= y) continue
    const x = p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x)
    lo = Math.min(lo, x)
    hi = Math.max(hi, x)
  }
  return hi >= lo ? [lo, hi] : null
}

/** chordAt for a REGION outline — non-convex, possibly multi-ring. A convex
 * min/max would claim the span across a concave bite (or across the gap
 * between two lobes) as room for text; here the crossings pair even-odd into
 * the true INSIDE intervals, and the label line gets the interval its anchor
 * stands in — or the widest one when the anchor's row misses it. */
export function regionChordAt(rings: XY[][], y: number, cx: number): [number, number] | null {
  const xs: number[] = []
  for (const poly of rings) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      if (p.y <= y === q.y <= y) continue
      xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x))
    }
  }
  if (xs.length < 2) return null
  xs.sort((a, b) => a - b)
  let widest: [number, number] | null = null
  let home: [number, number] | null = null
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const iv: [number, number] = [xs[i], xs[i + 1]]
    if (!widest || iv[1] - iv[0] > widest[1] - widest[0]) widest = iv
    if (cx >= iv[0] && cx <= iv[1]) home = iv
  }
  return home ?? widest
}

export interface NestedDot {
  id: string
  tier: number
  topic: string
  x: number
  y: number
}

const pathOf = (poly: XY[]) => `M${poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`

export const territories: Territory[] = []
export const nestedDots: NestedDot[] = []
/** raw (unsmoothed) topic cell polygons — hit-testing and the flip layer */
export const topicPoly = new Map<string, XY[]>()

function subdivide(parent: XY[], kids: GNode[], band: number, topic: string) {
  const tier = 2 + band
  const center = polyCentroid(parent)
  // seeds: authored ring positions where they fall inside the parent,
  // a deterministic ring around the centroid where they don't
  let seeds = kids.map((k, i) => {
    const p = atlasPos[k.id]
    if (p && pointInPoly(p, parent)) return { x: p.x, y: p.y }
    const a = (2 * Math.PI * i) / kids.length
    return { x: center.x + Math.cos(a) * 5, y: center.y + Math.sin(a) * 5 }
  })
  for (let pass = 0; pass < 2; pass++) {
    const cells = cellsFor(parent, seeds)
    seeds = cells.map((c, i) => (c.length > 2 ? polyCentroid(c) : seeds[i]))
  }
  const cells = cellsFor(parent, seeds)
  kids.forEach((k, i) => {
    const cell = cells[i]
    const grand = childrenOf.get(k.id) ?? []
    if (cell.length > 2) {
      const c = polyCentroid(cell)
      territories.push({ id: k.id, tier, topic, d: pathOf(cell), cx: c.x, cy: c.y, leaf: grand.length === 0, poly: cell })
      if (grand.length > 0) subdivide(cell, grand, band + 1, topic)
      else nestedDots.push({ id: k.id, tier, topic, x: c.x, y: c.y })
    } else {
      // degenerate sliver — no drawable zone, but the place keeps its marker
      nestedDots.push({ id: k.id, tier, topic, x: seeds[i].x, y: seeds[i].y })
    }
  })
}

for (const t of topicIds) {
  const raw = voronoi.cellPolygon(cellOfTopic.get(t)!)
  if (!raw) continue
  let cell: XY[] = raw.map((p) => ({ x: p[0], y: p[1] }))
  const first = cell[0]
  const last = cell[cell.length - 1]
  if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) cell = cell.slice(0, -1)
  const c = polyCentroid(cell)
  territories.push({ id: t, tier: 2, topic: t, d: pathOf(cell), cx: c.x, cy: c.y, leaf: false, poly: cell })
  topicPoly.set(t, cell)
  subdivide(cell, childrenOf.get(t) ?? [], 1, t)
}

/** deepest stratum present in the data — the zoom scale runs L0..maxTier */
export const maxTier = territories.reduce((m, t) => Math.max(m, t.tier), nestedDots.reduce((m, d) => Math.max(m, d.tier), 2))
