// THE CORPUS ADAPTERS THE EXPLORER RAIL READS — the containment tree and the preview's one-line
// summary, moved out of `ConnectionsPane` when the rail mounted on the map (#341, OB-238): two
// hosts read the same tree now, and two copies are how the two ends of the dissolution would
// drift. This is instruments-layer (it imports the DS for the `ContainNode` type it builds and
// the corpus for the data it reads), so it belongs to no single instrument.
import type { ContainNode } from '@/ds'

import { DOC_BODY } from '../corpus/docs'
import { byId, childrenOf, ROOT_ID, topicHueOf } from '../corpus/graph'

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
