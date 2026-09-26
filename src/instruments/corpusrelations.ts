// THE CORPUS'S RELATIONSHIPS, AS BOTH RELATION SURFACES READ THEM — moved out of
// `ConnectionsPane` when the document pane grew its Relations rail (#342, OB-229): two hosts
// read the same index now, and two copies are how the two ends of the dissolution would drift.
// The same reason `corpustree.ts` exists for the tree (#341). Instruments-layer: it imports the
// DS for the `Relation` shape it builds and the corpus for the data it reads.
//
// MODULE SCOPE IS LOAD-BEARING rather than tidy: both panes memoise on these functions'
// answers, and the via roll-up below walks a subtree per call.
import { findTreePath } from '@/ds'
import type { ContainNode, Relation, ViaRelation } from '@/ds'

import { byId, EDGE_LABEL, edges, topicHueOf } from '../corpus/graph'
import { CORPUS_TREE } from './corpustree'

/** ONE ENTRY PER TARGET AND KIND, decomposed — the shape the cards, the figure and the chart
 *  all read. An authored edge is a fact about a PAIR, so it appears twice in this index, once
 *  from each end, with `direction` told from that end's point of view; nothing downstream then
 *  has to know which way round the corpus authored it. `see_also` is the one kind this corpus
 *  authors as symmetric, and it reads 'both' from either end. `kindLabel` is the corpus's OWN
 *  wording ("builds on"), not the palette's example. */
const RELATIONS: Map<string, Relation[]> = (() => {
  const m = new Map<string, Relation[]>()
  const push = (from: string, to: string, e: (typeof edges)[number], direction: Relation['direction']) => {
    const other = byId.get(to)!
    const list = m.get(from) ?? []
    list.push({
      id: e.id, targetId: to, targetTitle: other.title, targetDomain: topicHueOf(to),
      kind: e.type, kindLabel: EDGE_LABEL[e.type], direction,
    })
    m.set(from, list)
  }
  for (const e of edges) {
    const both = e.type === 'see_also'
    push(e.source, e.target, e, both ? 'both' : 'out')
    push(e.target, e.source, e, both ? 'both' : 'in')
  }
  return m
})()
const NO_RELATIONS: Relation[] = []

/** a node's OWN relationships, decomposed. Stable: the same array every call for one id */
export function relationsOfNode(id: string): Relation[] {
  return RELATIONS.get(id) ?? NO_RELATIONS
}

const NO_VIA: ViaRelation[] = []
const VIA = new Map<string, ViaRelation[]>()

/** THE RELATIONSHIPS A NODE'S DESCENDANTS HOLD WITH THE OUTSIDE — the Relations rail's
 *  "indirect" ring, each with the containment path from the node down to the child that holds
 *  it (whole tree NODES, so a via pill can read the child's own topic — `viaSourceDomain`).
 *
 *  BOTH ENDS INSIDE IS INTERNAL WIRING, NOT A NEIGHBOUR, and is left out — the rule the DS's
 *  reference shell (`viaOf`) applies. Kept in, a container's figure draws its own children as
 *  its neighbours, and every edge between two of its descendants appears TWICE (once from each
 *  end); at the corpus root that is the whole corpus, twice. This is deliberately NOT the
 *  Connections pane's roll-up, which counts every descendant's relationships and stays as it
 *  is until that pane is retired (OB-226).
 *
 *  Stable per id (memoised), so a pane that keys a memo on the answer does not recompute. */
export function viaRelationsOf(id: string): ViaRelation[] {
  const hit = VIA.get(id)
  if (hit) return hit
  const path = findTreePath(CORPUS_TREE, id)
  const top = path ? path[path.length - 1] : null
  if (!top || !top.children || !top.children.length) {
    VIA.set(id, NO_VIA)
    return NO_VIA
  }
  const inside = new Set<string>()
  const collect = (n: ContainNode) => { inside.add(n.id); for (const c of n.children || []) collect(c) }
  collect(top)
  const out: ViaRelation[] = []
  const walk = (n: ContainNode, trail: ContainNode[]) => {
    for (const c of n.children || []) {
      const childPath = trail.concat([c])
      for (const rel of relationsOfNode(c.id)) {
        if (inside.has(rel.targetId)) continue
        out.push({ path: childPath, rel })
      }
      walk(c, childPath)
    }
  }
  walk(top, [top])
  const answer = out.length ? out : NO_VIA
  VIA.set(id, answer)
  return answer
}
