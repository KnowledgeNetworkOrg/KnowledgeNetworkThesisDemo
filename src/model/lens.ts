// Lens — "what is true from this node, through one relation type." Where the
// Unfold map grows an arbitrary multi-type neighborhood by hand, a lens holds
// focus and type fixed and asks a directed, transitive question: everything
// this node points AT through `type` (the out cone), and everything that
// points AT it (the in cone). Curriculum reuses the exact same out-cone
// computation, read differently: instead of "what's reachable," it asks "in
// what order must these be learned" — a Kahn's-algorithm topo-sort over the
// same induced subgraph, prerequisites first. One BFS, two readings.
//
// Pure, hand-rolled, no React. Adjacency is built once at module load from
// graph.ts's `edges`; everything below is synchronous and deterministic.

import { byId, edges } from '../corpus/graph'
import type { EdgeType } from '../corpus/graph'

type Adjacency = Map<EdgeType, Map<string, string[]>>

function sortByTitle(ids: Iterable<string>): string[] {
  return [...ids].sort((a, b) => byId.get(a)!.title.localeCompare(byId.get(b)!.title))
}

function buildAdjacency(): { outAdj: Adjacency; inAdj: Adjacency } {
  const rawOut = new Map<EdgeType, Map<string, Set<string>>>()
  const rawIn = new Map<EdgeType, Map<string, Set<string>>>()
  const add = (m: Map<EdgeType, Map<string, Set<string>>>, type: EdgeType, from: string, to: string) => {
    if (!m.has(type)) m.set(type, new Map())
    const byNode = m.get(type)!
    if (!byNode.has(from)) byNode.set(from, new Set())
    byNode.get(from)!.add(to)
  }
  for (const e of edges) {
    add(rawOut, e.type, e.source, e.target)
    add(rawIn, e.type, e.target, e.source)
  }
  const freeze = (m: Map<EdgeType, Map<string, Set<string>>>): Adjacency => {
    const out: Adjacency = new Map()
    for (const [type, byNode] of m) {
      const sm = new Map<string, string[]>()
      for (const [node, set] of byNode) sm.set(node, sortByTitle(set))
      out.set(type, sm)
    }
    return out
  }
  return { outAdj: freeze(rawOut), inAdj: freeze(rawIn) }
}

const { outAdj, inAdj } = buildAdjacency()

function neighbors(adj: Adjacency, type: EdgeType, id: string): string[] {
  return adj.get(type)?.get(id) ?? []
}

/** BFS from `focus` along `type` edges in the direction `adj` encodes. Each
 * node lands at its shallowest depth; `focus` itself is never in `levels`. */
function bfsCone(
  focus: string,
  type: EdgeType,
  maxDepth: number,
  adj: Adjacency,
): { levels: string[][]; depthOf: Map<string, number> } {
  const depthOf = new Map<string, number>([[focus, 0]])
  const levels: string[][] = []
  let frontier = [focus]
  for (let d = 1; d <= maxDepth && frontier.length > 0; d++) {
    const discovered = new Set<string>()
    for (const id of frontier) for (const nb of neighbors(adj, type, id)) if (!depthOf.has(nb)) discovered.add(nb)
    if (discovered.size === 0) break
    const level = sortByTitle(discovered)
    for (const id of level) depthOf.set(id, d)
    levels.push(level)
    frontier = level
  }
  return { levels, depthOf }
}

function inducedEdges(type: EdgeType, nodeSet: Set<string>): { from: string; to: string }[] {
  const result: { from: string; to: string }[] = []
  for (const e of edges) if (e.type === type && nodeSet.has(e.source) && nodeSet.has(e.target)) result.push({ from: e.source, to: e.target })
  return result
}

export interface ConeSide {
  levels: string[][] // levels[0] = depth-1 ids, each level title-sorted
  edges: { from: string; to: string }[] // induced edges of `type` among {focus} ∪ this side, real direction
  frontier: Record<string, number> // deepest-level id -> onward same-type links not in the cone
}

export interface LensModel {
  focus: string
  out: ConeSide // BFS following source→target: what focus points at
  in: ConeSide // BFS following target→source: what points at focus
}

function buildSide(focus: string, type: EdgeType, maxDepth: number, adj: Adjacency): ConeSide {
  const { levels } = bfsCone(focus, type, maxDepth, adj)
  const contained = new Set(levels.flat())
  contained.add(focus)
  const deepest = levels[levels.length - 1] ?? []
  const frontier: Record<string, number> = {}
  for (const id of deepest) {
    const onward = neighbors(adj, type, id).filter((nb) => !contained.has(nb))
    if (onward.length > 0) frontier[id] = onward.length
  }
  return { levels, edges: inducedEdges(type, contained), frontier }
}

export function lensModel(focus: string, type: EdgeType, maxDepth: number): LensModel {
  return { focus, out: buildSide(focus, type, maxDepth, outAdj), in: buildSide(focus, type, maxDepth, inAdj) }
}

export interface Curriculum {
  goal: string
  order: string[] // prerequisites-first; every node in the out-cone exactly once
  hadCycle: boolean
}

export function curriculum(goal: string, type: EdgeType, maxDepth: number): Curriculum {
  const { levels, depthOf } = bfsCone(goal, type, maxDepth, outAdj)
  const nodeSet = new Set([goal, ...levels.flat()])
  const prereqs = new Map<string, Set<string>>()
  for (const id of nodeSet) prereqs.set(id, new Set(neighbors(outAdj, type, id).filter((nb) => nodeSet.has(nb))))

  const emitted = new Set<string>()
  const unmet = (id: string) => [...prereqs.get(id)!].filter((p) => !emitted.has(p)).length
  const tiebreak = (a: string, b: string) => depthOf.get(b)! - depthOf.get(a)! || byId.get(a)!.title.localeCompare(byId.get(b)!.title)

  const remaining = new Set(nodeSet)
  const order: string[] = []
  let hadCycle = false

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => unmet(id) === 0)
    if (ready.length === 0) hadCycle = true // stalled: fall back to fewest unmet prerequisites
    const pool = ready.length > 0 ? ready : [...remaining]
    pool.sort((a, b) => unmet(a) - unmet(b) || tiebreak(a, b))
    const next = pool[0]
    order.push(next)
    emitted.add(next)
    remaining.delete(next)
  }

  return { goal, order, hadCycle }
}

// ── Module-load guards (idiom: graph.ts throws if the deterministic corpus
// ever stops matching what these functions assume) ─────────────────────────
// The hub is CHOSEN FROM THE DATA, not named: the topic with the most outgoing
// `depends_on` edges — whichever corpus is loaded, that is its richest builds-on
// cone and so the hardest case for these functions. It was the literal id
// `cry-tls-certificates` until the repo gained a second corpus, where that id
// does not exist and this guard turned a different dataset into a crash on
// import. Ties break on id so the choice is deterministic.
const HUB = (() => {
  const outDegree = new Map<string, number>()
  for (const e of edges) if (e.type === 'depends_on') outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1)
  let best = ''
  let bestN = 0
  for (const [id, n] of [...outDegree].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = id
      bestN = n
    }
  }
  return best
})()
if (!HUB || !byId.has(HUB)) throw new Error('lens.ts guard: the corpus has no depends_on edges to pick a hub from')

{
  const c = curriculum(HUB, 'depends_on', 3)
  if (new Set(c.order).size !== c.order.length) throw new Error('lens.ts guard: curriculum(HUB) has duplicate ids')
  if (!c.order.includes(HUB)) throw new Error('lens.ts guard: curriculum(HUB) missing the goal id')
  if (!c.hadCycle && (c.order.length < 2 || c.order[c.order.length - 1] !== HUB)) {
    throw new Error('lens.ts guard: acyclic curriculum(HUB) must have length >= 2 and end at the goal')
  }
}

if ((lensModel(HUB, 'depends_on', 2).out.levels[0]?.length ?? 0) === 0) {
  throw new Error('lens.ts guard: lensModel(HUB, depends_on, 2).out.levels[0] is empty')
}
