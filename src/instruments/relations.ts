// THE RELATIONSHIP ADAPTERS THE RELATIONS READERS SHARE — the decomposed index of who is related
// to whom, the roll-up of what a node's DESCENDANTS are related to, and the three small questions a
// hover asks of them. It moved out of `ConnectionsPane` when the Document pane's relations rail
// mounted (#342, OB-229): two readers of one corpus, and two copies of the index are how two
// answers to "what is this node connected to" would come to disagree. Instruments-layer, like
// `corpustree.ts` beside it: it imports the DS for the shapes it builds and the corpus for the
// data it reads, so it belongs to no single instrument.
//
// Everything here is PURE and module-scoped on purpose. The Connections pane memoises on the
// identity of `relationsOfNode`, and the rail memoises on the arrays `neighbourhoodOf` returns, so
// both must come back referentially stable for the same node.
import { ORBIT_SELF, REL_CARD_METRICS } from '@/ds'
import type { Relation, ViaRelation } from '@/ds'

import { byId, childrenOf, EDGE_LABEL, edges, pathTo, topicHueOf } from '../corpus/graph'

/** ONE ENTRY PER TARGET AND KIND, decomposed — the shape the cards and the figure both read. An
 *  authored edge is a fact about a PAIR, so it appears twice in this index, once from each end,
 *  with `direction` told from that end's point of view; nothing downstream then has to know which
 *  way round the corpus authored it. `see_also` is the one kind this corpus authors as symmetric,
 *  and it reads 'both' from either end. `kindLabel` is the corpus's OWN wording ("builds on"), not
 *  the palette's example. */
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

/** a node's OWN relationships, exactly as the index holds them. MODULE SCOPE IS LOAD-BEARING: the
 *  Connections pane memoises its answers on this function's identity, and a fresh closure per
 *  render would recompute its whole via-children roll-up on every keystroke in the filter box. */
export function relationsOfNode(id: string): Relation[] {
  return RELATIONS.get(id) ?? NO_RELATIONS
}

/** the ids of a node and everything beneath it */
function subtreeOf(id: string): Set<string> {
  const out = new Set<string>()
  const walk = (n: string) => { out.add(n); for (const k of childrenOf.get(n) ?? []) walk(k.id) }
  walk(id)
  return out
}

const VIA = new Map<string, ViaRelation[]>()

/** THE ROLL-UP: every relationship a DESCENDANT holds, with the containment path down to the
 *  descendant that owns it — the path is the selected node first and the owner last, and its
 *  entries are whole tree nodes with their own topic, because the via pill draws the owner's
 *  colour and not the selected node's (`viaSourceDomain`, OB-211).
 *
 *  A relationship whose far end is INSIDE the node is left out: both ends inside is internal wiring
 *  of the node, not a neighbour of it, and it could not be drawn as a road from the node to itself.
 *  This is RAW — one entry per descendant per relationship, so two children that both `use` the
 *  same outside node are two entries. That is what a card wants (it names every source); the
 *  figure wants one mark per (target, kind), which is `neighbourhoodOf`. */
export function viaRelationsOf(id: string): ViaRelation[] {
  const hit = VIA.get(id)
  if (hit) return hit
  const inside = subtreeOf(id)
  const out: ViaRelation[] = []
  const node = (n: string) => ({ id: n, title: byId.get(n)!.title, domain: topicHueOf(n) })
  const walk = (n: string, trail: ViaRelation['path']) => {
    for (const c of childrenOf.get(n) ?? []) {
      const path = trail.concat([node(c.id)])
      for (const rel of relationsOfNode(c.id)) if (!inside.has(rel.targetId)) out.push({ path, rel })
      walk(c.id, path)
    }
  }
  walk(id, [node(id)])
  VIA.set(id, out)
  return out
}

/** what the relations rail draws for a node: its own relationships and its descendants', ONE ENTRY
 *  PER (TARGET, KIND). The figure draws one mark per relationship and the reading counts the same
 *  marks, so two entries with one key would be one mark drawn twice on the same spot under a
 *  duplicated React key, and a chart total that disagrees with the picture. Direct wins over via,
 *  and the first descendant wins among several — the card, which asks `cardRelationsOf`, still
 *  names every one of them. */
export interface Neighbourhood {
  direct: Relation[]
  via: ViaRelation[]
}

const HOODS = new Map<string, Neighbourhood>()

export function neighbourhoodOf(id: string): Neighbourhood {
  const hit = HOODS.get(id)
  if (hit) return hit
  const seen = new Set<string>()
  const fresh = (r: Relation) => {
    const k = r.targetId + '|' + r.kind
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }
  const hood: Neighbourhood = {
    direct: relationsOfNode(id).filter(fresh),
    via: viaRelationsOf(id).filter((v) => fresh(v.rel)),
  }
  HOODS.set(id, hood)
  return hood
}

/** THE FIGURE'S KEY, SPLIT: `<targetId>|<kind>` is one relationship, `<targetId>` is the neighbour
 *  (every kind it is related by), `ORBIT_SELF` is the hub. The same split `RelationOrbit` reads. */
export function orbitKeyParts(key: string): { targetId: string | null; kind: string | null } {
  if (key === ORBIT_SELF) return { targetId: null, kind: null }
  const cut = key.indexOf('|')
  return cut > 0 ? { targetId: key.slice(0, cut), kind: key.slice(cut + 1) } : { targetId: key, kind: null }
}

/** THE FILTER BEHIND THE HOVER CARD, over the lists it is handed: the relationships a figure key
 *  stands for, in the two groups the card draws (own, and through a child). A neighbour key stands
 *  for EVERY kind it is related by; a relationship key for that one kind. The hub has no
 *  relationship card — it opens the node's document preview instead — so it answers empty. Pure and
 *  list-in, so the widening from a relationship to its neighbour is tested with a neighbour related
 *  two ways, which neither shipped corpus contains. */
export function relationsForKey(direct: readonly Relation[], via: readonly ViaRelation[], key: string): { direct: Relation[]; via: ViaRelation[] } {
  const { targetId, kind } = orbitKeyParts(key)
  if (targetId == null) return { direct: [], via: [] }
  const pick = (r: Relation) => r.targetId === targetId && (kind == null || r.kind === kind)
  return { direct: direct.filter(pick), via: via.filter((v) => pick(v.rel)) }
}

/** WHAT THE HOVER CARD LISTS for a figure key on a node. The direct group reads the rail's own
 *  de-duplicated entries; the via group reads the RAW roll-up, because the figure draws one mark
 *  for a relationship two children share and the card must still name both of them. */
export function cardRelationsOf(id: string, key: string): { direct: Relation[]; via: ViaRelation[] } {
  return relationsForKey(neighbourhoodOf(id).direct, viaRelationsOf(id), key)
}

/** WHICH NEIGHBOUR OF THE NODE A HOVER ELSEWHERE IS ON, or null — the reverse of the figure
 *  lighting the map. The hover may be on the neighbour's own cell or on a cell DEEPER inside it (a
 *  concept inside a topic), so it is matched against the whole chain from the root down to the
 *  hovered node, and the first neighbour found on that chain is the one. The answer is the
 *  neighbour's id, which is the figure's key for "the neighbour, both of its lines" — so lighting a
 *  mark from the map never opens the card, which belongs to the figure's own pointer. */
export function neighbourLitBy(hoverId: string | null | undefined, hood: Neighbourhood): string | null {
  if (!hoverId || !byId.has(hoverId)) return null
  const chain = new Set(pathTo(hoverId))
  for (const r of hood.direct) if (chain.has(r.targetId)) return r.targetId
  for (const v of hood.via) if (chain.has(v.rel.targetId)) return v.rel.targetId
  return null
}

/** THE CARD'S OWN PADDING, one side, and its border. The card sits in a gutter the pane sizes for
 *  it, so the rows inside must be solved against what is left after these, or the target pill
 *  overhangs the card's edge. CHOSEN, a look. */
export const ORBIT_CARD_PAD_X = 10
const ORBIT_CARD_BORDER = 1
/** the widest a pill in the hover card may draw, CHOSEN: past this a wider gutter adds shaft to
 *  the connector, and the reading happens in the pills */
const ORBIT_CARD_PILL_MAX = 88

/** THE ROW WIDTHS INSIDE THE HOVER CARD, solved backward from the card's own width the way
 *  `RelationCards` solves them from its measured one: both pills take an equal share of what the
 *  connector's minimum and the group's chrome leave, and the connector takes the rest. Pure, so the
 *  one thing that goes silently wrong — a target pill overhanging the card's edge in a narrow
 *  gutter — is pinned by a test rather than by looking. */
export function orbitCardWidths(cardW: number): { pill: number; arrow: number } {
  const RM = REL_CARD_METRICS
  const avail = cardW - ORBIT_CARD_BORDER * 2 - ORBIT_CARD_PAD_X * 2 - RM.rowPad * 2 - RM.rowGap * 2
  const pill = Math.max(RM.pillMin, Math.min(ORBIT_CARD_PILL_MAX, Math.floor((avail - RM.groupChrome - RM.arrowMin) / 2)))
  const arrow = Math.max(RM.arrowMin, avail - RM.groupChrome - pill * 2)
  return { pill, arrow }
}
