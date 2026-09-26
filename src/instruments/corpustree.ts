// THE CORPUS ADAPTERS THE EXPLORER RAIL READS — the containment tree and the preview's one-line
// summary, moved out of `ConnectionsPane` when the rail mounted on the map (#341, OB-238): two
// hosts read the same tree now, and two copies are how the two ends of the dissolution would
// drift. This is instruments-layer (it imports the DS for the `ContainNode` type it builds and
// the corpus for the data it reads), so it belongs to no single instrument.
import type { ContainNode, Relation } from '@/ds'

import { DOC_BODY } from '../corpus/docs'
import { byId, childrenOf, EDGE_LABEL, edges, ROOT_ID, topicHueOf } from '../corpus/graph'

/** the whole corpus as the tree the Explorer draws. Built once: the corpus is static, and
 *  rebuilding it per render would remount `ContainTree` (it keys on the root's id) and drop
 *  the open set with it. */
export function buildContainTree(id: string): ContainNode {
  const kids = childrenOf.get(id) ?? []
  // EVERY NODE CARRIES ITS OWN TOPIC (DS OB-174 clause 6). Without this the column draws one
  // colour for the whole tree — the fault reported on the running app — because the component
  // can only fall back to the pane's single `domain`. It cannot invent a per-node topic, and
  // our corpus has had one all along: `topicHueOf` is what the map's territories already read.
  //
  // THE CORPUS ROOT IS THE ONE PILL THIS DRAWS GREY, and that is the wanted answer rather
  // than an accident to tidy up. `topicHueOf(ROOT_ID)` is the root's own id, which is not a
  // topic, so it takes the anchor fallback. The contract's alternative — leave the root
  // without a domain and let it inherit the PANE's — would paint "everything" in whichever
  // topic you happen to be standing in, so the top of the column would change colour as you
  // navigate. A root that means "all of it" has no one topic, and says so.
  const node: ContainNode = { id, title: byId.get(id)!.title, domain: topicHueOf(id), root: id === ROOT_ID }
  if (kids.length) node.children = kids.map((k) => buildContainTree(k.id))
  return node
}

export const CORPUS_TREE = buildContainTree(ROOT_ID)

/** the hover preview's body — the FIRST SENTENCE of the node's own teaching article, never
 *  invented prose. A document body here opens with a definition ("Computer Science — the
 *  whole field this map describes, …"), which is exactly the register a one-line preview
 *  wants; the rest is the Document pane's job. A node with no article draws the card's
 *  skeleton instead, which is the honest fallback. */
export function summaryOfNode(id: string): string | undefined {
  const body = DOC_BODY[id]
  if (!body) return undefined
  const stop = body.indexOf('. ')
  return stop > 40 ? body.slice(0, stop + 1) : body.slice(0, 180)
}

/** THE CORPUS ADAPTER THE RELATIONS RAIL READS — a node's relationships, one entry per
 *  target and kind, moved out of `ConnectionsPane` when the relations rail mounted on the
 *  document (#342, OB-229): two hosts read the same index now, and two copies are how the two
 *  ends of the dissolution would drift. Module-scope identity is still load-bearing rather
 *  than tidy — `ConnectionsSplitPane` memoises its answers on the function's identity, and a
 *  fresh closure per render would recompute the via-children roll-up on every filter keystroke.
 *
 *  An authored edge is a fact about a PAIR, so it appears twice here, once from each end, with
 *  `direction` told from that end's point of view — nothing downstream has to know which way
 *  round the corpus authored it. `see_also` is the one kind this corpus authors as symmetric,
 *  and it reads 'both' from either end. `kindLabel` is the corpus's OWN wording ("builds on"),
 *  not the palette's example. */
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
export function relationsOfNode(id: string): Relation[] {
  return RELATIONS.get(id) ?? NO_RELATIONS
}
