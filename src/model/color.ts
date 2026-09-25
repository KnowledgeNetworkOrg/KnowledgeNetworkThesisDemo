// Formal color model (2026-07-12) — ONE definition of every node's color,
// shared by all instruments, so the layered map, the Children wheel and any
// future view paint the same node the same way.
//
// The scheme is recursive hue-range partitioning ("tree colors") in OKLCH:
// each domain anchors an arc of the hue wheel at its STORED ring hue (the
// name written on the domain node when it was created — `GNode.hue`, OB-153);
// children subdivide their parent's arc (weighted by subtree size), so
// any node's hue provably sits inside its ancestor's neighborhood — color
// does double duty: sibling discrimination locally, lineage globally.
//
// Two escape hatches keep DEEP levels legible, where naive partitioning
// collapses arcs to fractions of a degree:
//  - a per-sibling hue floor (MIN_STEP) from generation 2 down — sibling
//    centers never sit closer than ~11°, even if that bleeds past the
//    parent's arc (distant cousins may then share hues; borders and
//    geography disambiguate),
//  - a lightness parity nudge from generation 3 down — adjacent same-hue
//    siblings still alternate light/dark.
// (The MAP's territory fill no longer reads the recursive hue at all — see
// "Territory fill" below; the anchor, ink and flat-fill swatches still do.)
//
// Three derived swatches per node, all from the same (hue, gen, nudge):
//  colorOf    — the saturated identity anchor (borders, capitals, chips)
//  fillOf     — the pale country fill (active-level territory paint)
//  inkOf      — dark readable text tinted toward the hue (labels)
//  inkStrongOf— a crisper, near-black emphasis ink (selected/focused labels),
//               darker AND far less chromatic than inkOf so it reads as clean
//               type, not a muddy colored gray, on a hue-tinted/glowing cell

import { childrenOf, domainIds, topicHueOf } from '../corpus/graph'
import { familySlots, nestedFamilyPaint, topicPaintValues, topicSlots } from '@/ds/values'
import { countryRings, provinceRings, territories } from './nested'
import { hexToOklch, lin, oklchToHex } from './oklab'
import type { XY } from './derive'

// the OKLab/OKLCH ↔ sRGB arithmetic lives in ./oklab (shared with the flat model)
export { hexToOklch } from './oklab'

const FALLBACK = { anchor: '#64748b', fill: '#e2e8f0', ink: '#334155', inkStrong: '#1e2530' }

// ── Recursive arc assignment ─────────────────────────────────────────────────
const DOMAIN_SPAN = 46 // deg of hue wheel a domain's subtree spreads over
const KEEP = 0.82 // a child keeps this fraction of its width — gaps between arcs
const MIN_STEP = 11 // deg — sibling-center floor from generation 2 down

interface Slot {
  hue: number
  /** generations below the domain: 0 = domain, 1 = module, 2 = topic … */
  gen: number
  /** sibling parity: alternating ±1 (0 for only children) */
  nudge: number
}

const slot = new Map<string, Slot>()

const weightMemo = new Map<string, number>()
function weight(id: string): number {
  const hit = weightMemo.get(id)
  if (hit !== undefined) return hit
  const w = 1 + (childrenOf.get(id) ?? []).reduce((s, k) => s + weight(k.id), 0)
  weightMemo.set(id, w)
  return w
}

function assign(id: string, hue: number, span: number, gen: number, nudge: number) {
  slot.set(id, { hue: ((hue % 360) + 360) % 360, gen, nudge })
  const kids = childrenOf.get(id) ?? []
  if (kids.length === 0) return
  const W = kids.reduce((s, k) => s + weight(k.id), 0)
  const spread = Math.max(span, gen >= 2 ? MIN_STEP * (kids.length - 1) : 0)
  let acc = 0
  kids.forEach((k, i) => {
    const fr = weight(k.id) / W
    const center = hue - spread / 2 + (acc + fr / 2) * spread
    assign(k.id, center, spread * fr * KEEP, gen + 1, kids.length > 1 ? (i % 2 ? 1 : -1) : 0)
    acc += fr
  })
}

/* the domain's arc is anchored at its stored hue's ring degree — read through the same
   resolver every drawing uses, so the arc and the mark can never disagree. A domain with no
   stored hue takes the fallback anchor's own hue, which is where every other reader lands. */
for (const d of domainIds) assign(d, topicPaintValues(topicHueOf(d)).deg ?? hexToOklch(FALLBACK.anchor).h, DOMAIN_SPAN, 0, 0)

// ── Derived swatches ─────────────────────────────────────────────────────────
// A domain's anchor is its stored hue's MARK role, resolved in JS (the ring's
// L 0.55 / C 0.15 — `topicPaintValues`, pinned to tokens/colors.css by a test);
// descendants converge from that L/C toward a standard anchor over three
// generations, so each family keeps its character. Until OB-153 the anchor was
// an authored hex per domain, and the L/C descendants converged from varied
// with it (0.43 … 0.76) — now every family starts from the same register.
const anchorMap = new Map<string, string>()
const fillMap = new Map<string, string>()
/** id → the domain it descends from: the lineage FAMILY the territory fill pins its hue to */
const familyMap = new Map<string, string>()
const inkMap = new Map<string, string>()
const inkStrongMap = new Map<string, string>()

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

for (const d of domainIds) {
  const mark = topicPaintValues(topicHueOf(d)).mark
  const base = { l: mark.l, c: mark.c }
  const domainAnchor = topicHueOf(d) ? oklchToHex(mark.l, mark.c, mark.h) : FALLBACK.anchor
  const walk = (id: string) => {
    const s = slot.get(id)!
    familyMap.set(id, d)
    const t = Math.min(1, s.gen / 3)
    const push = s.gen >= 3 ? s.nudge : 0
    anchorMap.set(id, s.gen === 0 ? domainAnchor : oklchToHex(lerp(base.l, 0.6, t) + push * 0.03, lerp(base.c, 0.125, t), s.hue))
    fillMap.set(id, oklchToHex(0.905 + push * 0.02, 0.058, s.hue))
    inkMap.set(id, oklchToHex(0.42, 0.1, s.hue))
    // near-black, hue barely present: on the selected cell (tinted by the glow)
    // the standard ink's L 0.42 / C 0.1 reads as a muddy colored gray, so the
    // emphasis ink drops to L 0.30 and C 0.04 — clean type that still carries a
    // whisper of lineage rather than a flat neutral black.
    inkStrongMap.set(id, oklchToHex(0.3, 0.04, s.hue))
    for (const k of childrenOf.get(id) ?? []) walk(k.id)
  }
  walk(d)
}

// ── Territory fill: the family's hue, five slots by real adjacency (OB-119) ──
// Three versions of this have shipped, and the two rejected ones are recorded
// here so nobody retries them. (1) Four GLOBAL hues (an atlas red/green/blue/
// purple): correct — no two touching regions ever matched — but it threw away
// lineage entirely and read as garish beside this app's pale fills. (2) The
// lineage hue plus a hue STEP off it (±14/28/42°, 2026-08-27, `b656ebc`): the
// four-colour guarantee spent inside each family — but a 42° step inside amber
// (65°) lands on olive (107°), two ring stops away, because amber's ring
// neighbours are only 23° off. The owner's level-4 screenshots showed olive
// cells inside the amber domain. They were not misassigned; they were amber
// plus the largest step the ladder allowed.
//
// So (3), the design system's ruling (OB-119, 2026-08-29): HUE IS PINNED TO
// THE FAMILY, ±6°, and neighbours are told apart in LIGHTNESS AND CHROMA —
// a person reads a hue difference as "a different family" and an L/C
// difference as "the same colour, a bit different". The ladder is the DS's
// `nestedFamilyPaint(family, { slot })`: FIVE slots (four suffice on a planar
// map, the fifth is head-room for a greedy assignment; six only shrank every
// gap), L 0.900 → 0.720, C 0.050 → 0.130, hue 0/+6/−6/+4/−4. The FAMILY is
// the node's domain — its ring stop, not this file's recursive-arc hue, which
// the anchor/ink swatches above keep — so every fill's nearest ring stop IS
// its own lineage hue, checkable and checked (territoryfill.test.ts). Depth
// is no longer a channel at all: it was the wrong axis (who a region touches
// decides confusability, not how deep it is) and the map already draws depth
// as the ancestor boundary ladder. Domains need none of this WHILE THE RING
// HOLDS: each owns its authored anchor hue, distinct from every other by
// construction, so they reuse `fillMap` unchanged — until a corpus's 17th
// top-level topic wraps onto the 1st's hue; see "Generation 0" below (OB-171).
//
// The ASSIGNMENT is the DS's too, `familySlots()`: a graph colouring only
// promises two touching regions DIFFERENT slots and says nothing about how far
// apart the colours are — lowest-free-index crowded the low end (worst border
// 0.0269 against 0.0569 for the same colours differently spread). It takes the
// free slot FURTHEST from what its neighbours already hold, in DSATUR order,
// and ignores edges between different families, which hue already separates.
// What stays ours is the topology: `regionAdjacency` finds neighbours by
// testing every edge of one polygon against every edge of the other (a shared
// vertex counts too — stricter than the theorem strictly needs, which only
// ever costs an extra slot, never a wrong one), coloured in three independent
// groups matching what the map paints side by side at once: all provinces
// (level 1, which can sit shoulder to shoulder across DIFFERENT domains), and
// each tier of the nested atlas separately (model/nested.ts).
//
// THE PROVINCE TIER CONSTRAINS EVERY EDGE (OB-162, ruled by the owner
// 2026-09-06). Level 1 is the one tier where two touching regions usually
// belong to DIFFERENT domains, and hue was supposed to separate those. It did
// not for `dig` (sys, leaf 148°) beside `prc` (se, fern 166°): eighteen degrees
// apart, both in slot 0, 0.0156 in OKLab — under a just-noticeable difference,
// so two provinces read as one region. So at that tier `familySlots` is fed
// ONE family value for every region and every shared border is constrained;
// measured, the pair lifts to ~0.10 with the same slots in use and nothing
// under 0.020 anywhere. The nested tiers keep cross-family edges DROPPED:
// they rarely touch across domains, and dropping them is what keeps a
// family's five slots spread. From here on the province tier is a different
// colouring problem from the nested ones, and the flag below says so.
const EPS = 0.3 // world units — cells run 50+ units across (model/nested.ts)

function segDist(a1: XY, a2: XY, b1: XY, b2: XY): number {
  const distPtSeg = (p: XY, s1: XY, s2: XY) => {
    const dx = s2.x - s1.x
    const dy = s2.y - s1.y
    const len2 = dx * dx + dy * dy
    const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - s1.x) * dx + (p.y - s1.y) * dy) / len2))
    return Math.hypot(p.x - (s1.x + t * dx), p.y - (s1.y + t * dy))
  }
  return Math.min(distPtSeg(a1, b1, b2), distPtSeg(a2, b1, b2), distPtSeg(b1, a1, a2), distPtSeg(b2, a1, a2))
}

function bbox(rings: XY[][]) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const ring of rings)
    for (const p of ring) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  return { x0, y0, x1, y1 }
}

function ringsTouch(a: XY[][], b: XY[][]): boolean {
  for (const ra of a)
    for (let i = 0; i < ra.length; i++) {
      const a1 = ra[i]
      const a2 = ra[(i + 1) % ra.length]
      for (const rb of b)
        for (let j = 0; j < rb.length; j++) {
          if (segDist(a1, a2, rb[j], rb[(j + 1) % rb.length]) < EPS) return true
        }
    }
  return false
}

function regionAdjacency(regions: { id: string; rings: XY[][] }[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>(regions.map((r) => [r.id, new Set<string>()]))
  const boxed = regions.map((r) => ({ id: r.id, rings: r.rings, box: bbox(r.rings) }))
  for (let i = 0; i < boxed.length; i++)
    for (let j = i + 1; j < boxed.length; j++) {
      const A = boxed[i]
      const B = boxed[j]
      if (A.box.x1 < B.box.x0 - EPS || B.box.x1 < A.box.x0 - EPS || A.box.y1 < B.box.y0 - EPS || B.box.y1 < A.box.y0 - EPS) continue
      if (ringsTouch(A.rings, B.rings)) {
        adj.get(A.id)!.add(B.id)
        adj.get(B.id)!.add(A.id)
      }
    }
  return adj
}

/** the DS's `nestedFamilyPaint` answers in `oklch()` strings — a computed member of the
 *  ring's family has no token to point at — and everything downstream of this file
 *  (the label-contrast pass below, the map's `fill=`) speaks hex. One parse, here. */
function oklchStringToHex(css: string): string | null {
  const m = /^oklch\(([\d.]+) ([\d.]+) (-?[\d.]+)\)$/.exec(css)
  return m ? oklchToHex(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

const territoryFillMap = new Map<string, string>()
const territorySlotMap = new Map<string, number>()
const territoryNeighbourMap = new Map<string, readonly string[]>()

function paintGroup(regions: { id: string; rings: XY[][] }[], { constrainEveryEdge = false } = {}) {
  const adj = regionAdjacency(regions)
  const ids = regions.map((r) => r.id)
  const at = new Map(ids.map((id, i) => [id, i]))
  const neighbours = ids.map((id) => [...adj.get(id)!].map((n) => at.get(n)!))
  const family = ids.map((id) => familyMap.get(id) ?? '')
  /* one family value for every region = every shared border constrained (the DS's own
     whole-tier form of the call); the fill still takes each region's REAL family */
  const slots = familySlots(neighbours, { family: constrainEveryEdge ? ids.map(() => 'tier') : family })
  ids.forEach((id, i) => {
    territorySlotMap.set(id, slots[i])
    territoryNeighbourMap.set(id, [...adj.get(id)!])
    /* the ladder wants the family's HUE NAME (stored on the domain node), not the domain id */
    territoryFillMap.set(id, oklchStringToHex(nestedFamilyPaint(topicHueOf(id), { slot: slots[i] }).fill) ?? FALLBACK.fill)
  })
}

// ── Generation 0: stored hue, derived shade (OB-171, 2026-09-14) ────────────
// The ring has sixteen stops and the assignment wraps, so a corpus's 17th
// top-level topic is handed the 1st's hue exactly. On a chip that costs
// nothing; on the map two identical fills that SHARE A BORDER read as one
// region, and by the owner's ruling (2026-09-05) nothing may report it — no
// threshold, no notice, no prompt to group topics. So the DS's `topicSlots()`
// steps the touching twin one rung down the same family ladder the nested
// tiers use, and steps nothing else: a region with no same-hue NEIGHBOUR keeps
// slot 0 and draws today's flat `fillMap` value, byte for byte, which is what
// makes this safe to adopt — every map of sixteen topics or fewer, and every
// map whose twins do not touch, is pixel-identical to before. Adjacency comes
// from the GEOMETRY (`regionAdjacency` over the domains' country rings, the
// same test the provinces get), never from the tree; the hue array is the
// STORED assignment (`topicHueOf`, the hue name on the domain node), never
// recomputed; and the slot is derived here at render time and persisted
// nowhere — it is a fact about who a region touches, not identity.
// The nearest rung that clears `TOPIC_SEPARATION_MIN`, not the furthest: the
// DS measured the furthest-slot rule (what `familySlots` rightly does inside a
// family) drawing the one graded twin as the single saturated cell on a pastel
// map. Six domains ship today, so on this corpus every slot is zero; the rule
// is exercised by topicfill.test.ts on a synthetic seventeen-topic map.
/** the generation-0 fills — one entry per region: the slot `topicSlots` gave it and the fill
 *  the map draws (today's `flat` fill at slot 0, the family ladder's rung otherwise). Exported
 *  for the test that puts seventeen top-level topics in front of it; the map reads the result
 *  through `territoryFillOf`. */
export function topicTerritoryFills(
  regions: { id: string; rings: XY[][] }[],
  hueName: (id: string) => string | null,
  flat: (id: string) => string,
): Map<string, { slot: number; fill: string }> {
  const adj = regionAdjacency(regions)
  const ids = regions.map((r) => r.id)
  const at = new Map(ids.map((id, i) => [id, i]))
  const neighbours = ids.map((id) => [...adj.get(id)!].map((n) => at.get(n)!))
  const hue = ids.map((id) => hueName(id))
  const slots = topicSlots(neighbours, { hue })
  return new Map(ids.map((id, i) => [id, {
    slot: slots[i],
    fill: slots[i] === 0 ? flat(id) : (oklchStringToHex(nestedFamilyPaint(hue[i] ?? undefined, { slot: slots[i] }).fill) ?? flat(id)),
  }]))
}

for (const [d, { fill }] of topicTerritoryFills(domainIds.map((d) => ({ id: d, rings: countryRings[d] })), (d) => topicHueOf(d) ?? null, (d) => fillMap.get(d)!)) territoryFillMap.set(d, fill)
paintGroup(Object.keys(provinceRings).map((m) => ({ id: m, rings: provinceRings[m] })), { constrainEveryEdge: true })

const territoriesByTier = new Map<number, typeof territories>()
for (const t of territories) {
  if (!territoriesByTier.has(t.tier)) territoriesByTier.set(t.tier, [])
  territoriesByTier.get(t.tier)!.push(t)
}
for (const group of territoriesByTier.values()) paintGroup(group.map((t) => ({ id: t.id, rings: [t.poly] })))

// ── Label ink: contrast against the cell the label actually sits on ─────────
// OB-102 (2026-08-28), answering receipts/b656ebc.md + issue #220. The stepped
// territory fill (above) moves each cell's L/C off `fillOf`'s flat 0.905/0.058
// to separate neighbors, and on the lighter/more chromatic steps the standard
// `inkOf` (L 0.42, C 0.10) drops under 4.5:1 — 458 of 745 labels, worst 3.42.
//
// The design system's answer was explicit about which lever moves: THE INK, per
// cell. Not the halo — MapView's thin white case is grain separation, and a
// fatter or more opaque one buys the outlined-sticker look the label pass
// already rejected. And not L_STEP/C_STEP, since the neighbor separation those
// buy is the whole point of the fill change.
//
// So: keep the hue, and slide L and C together from `inkOf`'s register toward
// `inkStrongOf`'s (L 0.30, C 0.04 — measured to hold 5.77:1 everywhere) by the
// SMALLEST step that reaches 4.5:1. A cell that already passes keeps `inkOf`
// unchanged, so this darkens only where it must.
function relLum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255)
}

/** WCAG 2.x contrast ratio between two opaque sRGB hexes. */
function contrastRatio(a: string, b: string): number {
  const la = relLum(a)
  const lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const LABEL_MIN_CONTRAST = 4.5
const INK_STEPS = 12

const labelInkMap = new Map<string, string>()
for (const [id, fill] of territoryFillMap) {
  const s = slot.get(id)
  const base = inkMap.get(id) ?? FALLBACK.ink
  if (!s || contrastRatio(base, fill) >= LABEL_MIN_CONTRAST) {
    labelInkMap.set(id, base)
    continue
  }
  // fall through to the full inkStrong register if no partial step clears it
  let chosen = inkStrongMap.get(id) ?? FALLBACK.inkStrong
  for (let step = 1; step <= INK_STEPS; step++) {
    const t = step / INK_STEPS
    const cand = oklchToHex(lerp(0.42, 0.3, t), lerp(0.1, 0.04, t), s.hue)
    if (contrastRatio(cand, fill) >= LABEL_MIN_CONTRAST) {
      chosen = cand
      break
    }
  }
  labelInkMap.set(id, chosen)
}

/** saturated identity anchor — borders, capitals, chips */
export const colorOf = (id: string): string => anchorMap.get(id) ?? FALLBACK.anchor
/** pale country fill — active-level territory paint */
export const fillOf = (id: string): string => fillMap.get(id) ?? FALLBACK.fill
/** the map's territory fill — the family's ring hue (±6°), in one of five
 *  lightness/chroma slots chosen by real geometric adjacency (see header) so
 *  touching regions are never confusable and never leave the family. Map-only:
 *  other `fillOf` consumers (ConnectionsPane) are unaffected. */
export const territoryFillOf = (id: string): string => territoryFillMap.get(id) ?? FALLBACK.fill
/** which of the five family slots a map region was given — null for a domain
 *  (which takes its own anchor) or an unknown id. Published for the audit that
 *  re-measures the fill, not for drawing. */
export const territorySlotOf = (id: string): number | null => territorySlotMap.get(id) ?? null
/** the regions a map region shares a border with, as `regionAdjacency` found
 *  them — the topology the slot assignment was fed. Same audience as above. */
export const territoryNeighboursOf = (id: string): readonly string[] => territoryNeighbourMap.get(id) ?? []
/** the domain a node descends from — the family its territory fill is pinned to */
export const familyOf = (id: string): string | null => familyMap.get(id) ?? null
/** dark hue-tinted text color — labels on the node's own fill */
export const inkOf = (id: string): string => inkMap.get(id) ?? FALLBACK.ink
/** the label ink for a MAP territory — `inkOf`, darkened toward
 *  `inkStrongOf`'s register only as far as 4.5:1 against that cell's own
 *  stepped `territoryFillOf` requires (OB-102, see header). Map-only: every
 *  other `inkOf` consumer paints on the flat `fillOf` and is unaffected. */
export const labelInkOf = (id: string): string => labelInkMap.get(id) ?? inkMap.get(id) ?? FALLBACK.ink
/** crisp near-black emphasis ink — selected/focused labels (see header) */
export const inkStrongOf = (id: string): string => inkStrongMap.get(id) ?? FALLBACK.inkStrong
/** the assigned hue in degrees, for anything that derives its own swatch */
export const hueOf = (id: string): number | null => slot.get(id)?.hue ?? null
