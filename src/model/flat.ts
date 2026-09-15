// Shared substrate for the flat (non-compound) views — the Map (atlas) and
// F·Contours. ONE deterministic CLUSTER-FIRST embedding: the authored
// hierarchy places domain centers first, module anchors inside them, and only
// then does a force pass refine the 53 topics around their anchors — so
// geography IS the authored structure and domains are contiguous by
// construction. Below the topics, every deep node gets a fixed district/street
// position around its topic (atlasPos) so vertical zoom can disclose depth
// in place — ZMLT's nothing-moves invariant, with containment depth as the
// filtration. CNM community detection stays exported for Contours, which
// draws detected-vs-authored disagreement over the same positions.

import { byId, childrenOf, domainIds, domainOf, edges, pathTo, topicHueOf, topicIds, topicsUnder } from '../corpus/graph'
import { topicPaintValues } from '@/ds'
import { oklchToHex } from './oklab'
import type { GEdge } from '../corpus/graph'
import type { XY } from './derive'

export const FLAT_W = 1360
export const FLAT_H = 880

// ── Undirected collapse: pair weights and degrees ───────────────────────────
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

const pairWeight = new Map<string, number>()
for (const e of edges) {
  const k = pairKey(e.source, e.target)
  pairWeight.set(k, (pairWeight.get(k) ?? 0) + 1)
}
export interface Pair {
  a: string
  b: string
  w: number
}
export const pairs: Pair[] = [...pairWeight].map(([k, w]) => {
  const [a, b] = k.split('|')
  return { a, b, w }
})

export const degreeOf = new Map<string, number>(topicIds.map((id) => [id, 0]))
for (const { a, b, w } of pairs) {
  degreeOf.set(a, degreeOf.get(a)! + w)
  degreeOf.set(b, degreeOf.get(b)! + w)
}

// Hubs are COMPUTED, not declared: the five busiest topics by total link
// degree. With authored edges, which topics are central is itself a finding.
export const HUB_IDS = [...topicIds].sort((a, b) => degreeOf.get(b)! - degreeOf.get(a)! || a.localeCompare(b)).slice(0, 5)

const rawAdj = new Map<string, GEdge[]>()
for (const e of edges) {
  if (!rawAdj.has(e.source)) rawAdj.set(e.source, [])
  if (!rawAdj.has(e.target)) rawAdj.set(e.target, [])
  rawAdj.get(e.source)!.push(e)
  rawAdj.get(e.target)!.push(e)
}
/** every raw edge touching a leaf, either direction */
export const edgesTouching = (id: string): GEdge[] => rawAdj.get(id) ?? []

// ── Community detection: CNM greedy modularity maximization ─────────────────
// Direction collapsed, weight = parallel-edge count. Merges the best pair of
// connected communities until one remains, keeps the partition with max Q.
function detectCommunities(): { groups: string[][]; Q: number } {
  const index = new Map(topicIds.map((id, i) => [id, i]))
  const twoM = 2 * edges.length

  const comm = new Map<number, Set<number>>(topicIds.map((_, i) => [i, new Set([i])]))
  const a = new Map<number, number>(topicIds.map((id, i) => [i, degreeOf.get(id)! / twoM]))
  const e = new Map<string, number>() // "ci|cj" ci<cj -> edge fraction between
  for (const p of pairs) {
    const i = index.get(p.a)!
    const j = index.get(p.b)!
    e.set(i < j ? `${i}|${j}` : `${j}|${i}`, p.w / twoM)
  }
  const getE = (x: number, y: number) => (x === y ? 0 : e.get(x < y ? `${x}|${y}` : `${y}|${x}`) ?? 0)
  const setE = (x: number, y: number, v: number) => {
    if (x === y) return
    const k = x < y ? `${x}|${y}` : `${y}|${x}`
    if (v === 0) e.delete(k)
    else e.set(k, v)
  }
  const neighborsOf = (ci: number) => {
    const out: number[] = []
    for (const key of e.keys()) {
      const [x, y] = key.split('|').map(Number)
      if (x === ci) out.push(y)
      else if (y === ci) out.push(x)
    }
    return out
  }

  let Q = -[...a.values()].reduce((s, v) => s + v * v, 0)
  let best = { Q, groups: [...comm.values()].map((s) => [...s]) }

  while (comm.size > 1) {
    let bestPair: { ci: number; cj: number; dQ: number } | null = null
    for (const key of e.keys()) {
      const [i, j] = key.split('|').map(Number)
      const dQ = 2 * (e.get(key)! - a.get(i)! * a.get(j)!)
      if (!bestPair || dQ > bestPair.dQ) bestPair = { ci: i, cj: j, dQ }
    }
    if (!bestPair) break // disconnected remainder — cannot happen, corpus is connected
    const { ci, cj, dQ } = bestPair
    for (const x of neighborsOf(cj)) {
      if (x === ci) continue
      setE(ci, x, getE(ci, x) + getE(cj, x))
      setE(cj, x, 0)
    }
    setE(ci, cj, 0)
    for (const v of comm.get(cj)!) comm.get(ci)!.add(v)
    comm.delete(cj)
    a.set(ci, a.get(ci)! + a.get(cj)!)
    a.delete(cj)
    Q += dQ
    if (Q > best.Q) best = { Q, groups: [...comm.values()].map((s) => [...s]) }
  }

  const groups = best.groups
    .map((g) => g.map((i) => topicIds[i]).sort())
    .sort((x, y) => y.length - x.length || x[0].localeCompare(y[0]))
  return { groups, Q: best.Q }
}

const detected = detectCommunities()
export const modularityQ = detected.Q
export const communities: string[][] = detected.groups
export const communityOf = new Map<string, number>()
communities.forEach((members, ci) => members.forEach((id) => communityOf.set(id, ci)))

// Communities inherit the color of their dominant authored domain — the 88%
// agreement is the story, so the palettes should agree too. A domain that
// splits across communities gets a lightened variant for the second piece.
const mixWhite = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v + (255 - v) * f)
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`
}
export const communityColor: string[] = []
export const communityLabel: string[] = []
{
  const timesSeen = new Map<string, number>()
  for (const members of communities) {
    const count = new Map<string, number>()
    for (const id of members) count.set(domainOf(id), (count.get(domainOf(id)) ?? 0) + 1)
    const dom = [...count].sort((x, y) => y[1] - x[1])[0][0]
    const nth = timesSeen.get(dom) ?? 0
    timesSeen.set(dom, nth + 1)
    /* the domain's mark, resolved to a hex in JS — this feeds an SVG fill (OB-153) */
    const m = topicPaintValues(topicHueOf(dom)).mark
    const domainHex = oklchToHex(m.l, m.c, m.h)
    communityColor.push(nth === 0 ? domainHex : mixWhite(domainHex, 0.42 * nth))
    communityLabel.push(nth === 0 ? byId.get(dom)!.title : `${byId.get(dom)!.title} ${['II', 'III', 'IV'][nth - 1]}`)
  }
}

/** fraction of leaves whose community agrees with its dominant authored domain */
export const domainPurity =
  communities.reduce((sum, members) => {
    const count = new Map<string, number>()
    for (const id of members) count.set(domainOf(id), (count.get(domainOf(id)) ?? 0) + 1)
    return sum + Math.max(...count.values())
  }, 0) / topicIds.length

/** hub id -> how many distinct communities its neighbors span (incl. its own) */
export const hubBridging = new Map<string, number>(
  HUB_IDS.map((hub) => {
    const touched = new Set<number>([communityOf.get(hub)!])
    for (const e of edges) {
      if (e.source === hub) touched.add(communityOf.get(e.target)!)
      if (e.target === hub) touched.add(communityOf.get(e.source)!)
    }
    return [hub, touched.size]
  }),
)

// ── The one shared embedding: cluster-first, geography = authored hierarchy ──
// The old FR embedding let edges alone decide geography, so the map's country
// shapes fragmented wherever hubs pulled foreign topics close. Cluster-first
// flips the order: anchors from the authored tree decide the macro layout,
// and the force pass only refines topics LOCALLY around their module anchor —
// edges shape neighborhoods, never borders.

const hash01 = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function embed(): Record<string, XY> {
  // 1 · circular domain order: brute-force the ring that keeps heavily linked
  // domains adjacent (6 domains → 120 orders; cost = weight × extra hops)
  const dIdx = new Map(domainIds.map((d, i) => [d, i]))
  const dw: number[][] = domainIds.map(() => domainIds.map(() => 0))
  for (const p of pairs) {
    const a = dIdx.get(domainOf(p.a))!
    const b = dIdx.get(domainOf(p.b))!
    if (a !== b) {
      dw[a][b] += p.w
      dw[b][a] += p.w
    }
  }
  let bestOrder: number[] = domainIds.map((_, i) => i)
  let bestCost = Infinity
  const permute = (acc: number[], remaining: number[]) => {
    if (remaining.length === 0) {
      let cost = 0
      for (let i = 0; i < acc.length; i++)
        for (let j = i + 1; j < acc.length; j++) {
          const hops = Math.min(j - i, acc.length - (j - i))
          cost += dw[acc[i]][acc[j]] * (hops - 1)
        }
      if (cost < bestCost) {
        bestCost = cost
        bestOrder = acc
      }
      return
    }
    for (let k = 0; k < remaining.length; k++)
      permute([...acc, remaining[k]], remaining.filter((_, x) => x !== k))
  }
  permute([0], domainIds.map((_, i) => i).slice(1))

  // 2 · anchors: domain centers on an ellipse, module anchors ringed inside
  // their domain (first module faces the interior), nested branches offset
  // further, topics seeded on a small ring around their parent's anchor
  const cx = FLAT_W / 2
  const cy = FLAT_H / 2
  const anchor = new Map<string, XY>()
  bestOrder.forEach((di, slot) => {
    const a = -Math.PI / 2 + (2 * Math.PI * slot) / bestOrder.length
    anchor.set(domainIds[di], { x: cx + Math.cos(a) * FLAT_W * 0.315, y: cy + Math.sin(a) * FLAT_H * 0.3 })
  })
  for (const d of domainIds) {
    const mods = childrenOf.get(d) ?? []
    const c = anchor.get(d)!
    const toward = Math.atan2(cy - c.y, cx - c.x)
    const R = mods.length === 1 ? 0 : 30 + 9 * mods.length
    mods.forEach((m, i) => {
      const a = toward + (2 * Math.PI * i) / mods.length
      const mp = { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R }
      anchor.set(m.id, mp)
      // a module's container children that are NOT topics are nested modules
      // (tooling → automation): anchor them just outside their parent module
      for (const sub of (childrenOf.get(m.id) ?? []).filter((k) => k.kind === 'container' && !k.topic)) {
        anchor.set(sub.id, { x: mp.x + Math.cos(a) * 34, y: mp.y + Math.sin(a) * 34 })
      }
    })
  }
  const seed: Record<string, XY> = {}
  const topicsByParent = new Map<string, string[]>()
  for (const t of topicIds) {
    const pid = byId.get(t)!.parentId!
    topicsByParent.set(pid, [...(topicsByParent.get(pid) ?? []), t])
  }
  for (const [pid, ts] of topicsByParent) {
    const c = anchor.get(pid)!
    const a0 = hash01(pid) * Math.PI * 2
    const R = 12 + 7 * ts.length
    ts.forEach((t, i) => {
      const a = a0 + (2 * Math.PI * i) / ts.length
      seed[t] = { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R }
    })
  }

  // 3 · anchored refinement: local repulsion spreads topics, weak edge springs
  // shape neighborhoods, a firm tether to the module anchor keeps every topic
  // in its own country — the borders were decided in step 2 and stay decided
  const n = topicIds.length
  const index = new Map(topicIds.map((id, i) => [id, i]))
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  topicIds.forEach((id, i) => {
    px[i] = seed[id].x
    py[i] = seed[id].y
    const anc = anchor.get(byId.get(id)!.parentId!)!
    ax[i] = anc.x
    ay[i] = anc.y
  })
  const springs = pairs.map((p) => ({ i: index.get(p.a)!, j: index.get(p.b)!, w: Math.pow(p.w, 0.6) }))
  const SEP = 58 // target nearest-neighbor spacing — a district needs ~50
  const ITER = 320
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  for (let it = 0; it < ITER; it++) {
    const t = Math.max(1.2, 24 * (1 - it / ITER))
    dx.fill(0)
    dy.fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = px[i] - px[j]
        let vy = py[i] - py[j]
        let d = Math.hypot(vx, vy)
        if (d < 0.01) {
          // deterministic tiny separation for coincident points
          vx = 0.01 * (((i * 7919 + j) % 13) - 6)
          vy = 0.01 * (((i * 104729 + j) % 17) - 8)
          d = Math.hypot(vx, vy)
        }
        if (d > 240) continue // repulsion is LOCAL: clusters must not shove each other
        const f = (SEP * SEP) / d / d
        dx[i] += vx * f
        dy[i] += vy * f
        dx[j] -= vx * f
        dy[j] -= vy * f
      }
    }
    for (const s of springs) {
      const vx = px[s.j] - px[s.i]
      const vy = py[s.j] - py[s.i]
      const d = Math.max(0.01, Math.hypot(vx, vy))
      // clamp the effective distance: an edge may NUDGE topics toward each
      // other, never drag a hub across the map (springs grow quadratically,
      // the tether only linearly — unclamped, hubs drift out of their country)
      const dEff = Math.min(d, 120)
      const f = ((dEff * dEff) / SEP) * s.w * 0.012 / d
      dx[s.i] += vx * f
      dy[s.i] += vy * f
      dx[s.j] -= vx * f
      dy[s.j] -= vy * f
    }
    for (let i = 0; i < n; i++) {
      dx[i] += (ax[i] - px[i]) * 0.3 // the tether that keeps borders decided
      dy[i] += (ay[i] - py[i]) * 0.3
      const len = Math.hypot(dx[i], dy[i])
      const cap = Math.min(len, t)
      if (len > 0.01) {
        px[i] += (dx[i] / len) * cap
        py[i] += (dy[i] / len) * cap
      }
    }
  }

  // normalize into a padded canvas box, preserving aspect
  const PADX = 110
  const PADY = 84
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i])
    minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i])
  }
  const scale = Math.min((FLAT_W - 2 * PADX) / (maxX - minX), (FLAT_H - 2 * PADY) / (maxY - minY))
  for (let i = 0; i < n; i++) {
    px[i] = PADX + (px[i] - minX) * scale + (FLAT_W - 2 * PADX - (maxX - minX) * scale) / 2
    py[i] = PADY + (py[i] - minY) * scale + (FLAT_H - 2 * PADY - (maxY - minY) * scale) / 2
  }

  // overlap relaxation: two topics closer than MIN can't both fit a district
  const MIN = 50
  for (let round = 0; round < 90; round++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const vx = px[j] - px[i]
        const vy = py[j] - py[i]
        const d = Math.max(0.01, Math.hypot(vx, vy))
        if (d >= MIN) continue
        const push = (MIN - d) / 2 / d
        px[i] -= vx * push
        py[i] -= vy * push
        px[j] += vx * push
        py[j] += vy * push
      }
    }
  }

  const out: Record<string, XY> = {}
  topicIds.forEach((id, i) => (out[id] = { x: px[i], y: py[i] }))
  return out
}
export const leafPos: Record<string, XY> = embed()

// ── Max-weight spanning tree: the "road network" ZMLT filters along ─────────
function maxSpanningTree(): Pair[] {
  const sorted = [...pairs].sort((x, y) => y.w - x.w || pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)))
  const parent = new Map<string, string>(topicIds.map((id) => [id, id]))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const out: Pair[] = []
  for (const p of sorted) {
    const ra = find(p.a)
    const rb = find(p.b)
    if (ra === rb) continue
    parent.set(ra, rb)
    out.push(p)
    if (out.length === topicIds.length - 1) break
  }
  return out
}
export const treePairs: Pair[] = maxSpanningTree()

/** Push overlapping ghost labels apart vertically (group/country names). */
export function spreadLabels<T extends XY>(labels: T[]): T[] {
  const out = labels.map((l) => ({ ...l }))
  for (let round = 0; round < 30; round++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = Math.abs(out[i].x - out[j].x)
        const dy = out[j].y - out[i].y
        if (dx > 190 || Math.abs(dy) > 42) continue
        const push = (42 - Math.abs(dy)) / 2 + 1
        const sign = dy >= 0 ? 1 : -1
        out[i].y -= sign * push
        out[j].y += sign * push
      }
    }
  }
  return out
}

// ── The vertical atlas: every deep node gets a FIXED place under its topic ──
// ZMLT's invariant extended downward: zoom never moves anything, it only
// discloses. Subtopics ring their topic, deeper concepts fan OUTWARD from
// their parent (away from the topic center, like branches), so a level-8
// spine tip sits at the district's edge. Ring radii shrink by band so a whole
// district fits inside half the topic spacing (12.5+6+3.2+2 < 50/2… barely,
// and the embedding's MIN=50 makes that a guarantee, not a hope).
const RING = [12.5, 6, 3.2, 2] // ring radius by band (1 = subtopic … 4 = spine tip)

/** positions for every place on the atlas: the 53 topics plus all deep nodes */
export const atlasPos: Record<string, XY> = { ...leafPos }
/** containment levels below the owning topic (1..4) — the zoom stratum key */
export const deepBand = new Map<string, number>()
export interface DeepPlace {
  id: string
  parent: string // the street runs parent → id
  band: number
}
/** each topic's deep descendants, parents before children */
export const deepUnder = new Map<string, DeepPlace[]>()

for (const t of topicIds) {
  const list: DeepPlace[] = []
  const walk = (id: string, band: number, inAngle: number) => {
    const kids = childrenOf.get(id) ?? []
    const p = atlasPos[id]
    kids.forEach((k, i) => {
      const b = band + 1
      const r = RING[Math.min(b, RING.length) - 1]
      const a =
        band === 0
          ? hash01(id) * Math.PI * 2 + (2 * Math.PI * i) / kids.length
          : inAngle + (kids.length === 1 ? 0 : Math.PI * 1.3 * (i / (kids.length - 1) - 0.5))
      atlasPos[k.id] = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }
      deepBand.set(k.id, b)
      list.push({ id: k.id, parent: id, band: b })
      walk(k.id, b, a)
    })
  }
  walk(t, 0, 0)
  deepUnder.set(t, list)

  // local relaxation: two branches' fans can point at each other, so push the
  // district's members apart (streets follow their children automatically),
  // clamped inside the district radius so neighboring cities never collide
  const c = atlasPos[t]
  for (let round = 0; round < 60; round++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = atlasPos[list[i].id]
        const b = atlasPos[list[j].id]
        let vx = b.x - a.x
        let vy = b.y - a.y
        let d = Math.hypot(vx, vy)
        if (d < 0.01) {
          vx = 0.01 * (((i + 1) % 7) - 3)
          vy = 0.01 * (((j + 1) % 5) - 2)
          d = Math.hypot(vx, vy)
        }
        const want = list[i].band === 1 && list[j].band === 1 ? 7 : 3.4
        if (d >= want) continue
        const push = (want - d) / 2 / d
        a.x -= vx * push
        a.y -= vy * push
        b.x += vx * push
        b.y += vy * push
      }
    }
    for (const m of list) {
      const p = atlasPos[m.id]
      const dx = p.x - c.x
      const dy = p.y - c.y
      const r = Math.hypot(dx, dy)
      const cap = 24 - m.band // deeper bands hug slightly tighter
      if (r > cap) {
        p.x = c.x + (dx / r) * cap
        p.y = c.y + (dy / r) * cap
      }
    }
  }
}

/** the edge-bearing topic a place belongs to — itself if it IS a topic */
export const topicAnchorOf = (id: string): string => {
  let cur = byId.get(id)
  while (cur && !cur.topic) cur = cur.parentId ? byId.get(cur.parentId) : undefined
  return cur?.id ?? id
}

// ── Capitals and provinces: what the shallow zoom levels may name ───────────
/** the busiest topic under a container — the one place named from afar */
const capitalUnder = (id: string): string => {
  const ts = topicsUnder(id)
  return ts.reduce((best, t) => (degreeOf.get(t)! > degreeOf.get(best)! ? t : best), ts[0])
}
export const domainCapital = new Map(domainIds.map((d) => [d, capitalUnder(d)]))
/** provinces = the domains' direct modules (nested branches count under their module) */
export const provinceIds = domainIds.flatMap((d) => (childrenOf.get(d) ?? []).map((m) => m.id))
export const provinceCapital = new Map(provinceIds.map((m) => [m, capitalUnder(m)]))
/** the province a topic renders under: its depth-3 ancestor */
export const provinceOf = (id: string): string => pathTo(id)[2]
