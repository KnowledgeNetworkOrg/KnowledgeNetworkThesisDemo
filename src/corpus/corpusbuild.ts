// Turning an AUTHORED corpus into a usable one. Everything here used to sit at
// the bottom of graph.ts, where it could only ever serve the one hand-authored
// CS teaching corpus. It is a separate module now because the repo holds a
// SECOND corpus — `coursedata.ts`, generated from Toronto Metropolitan
// University's published course outlines — and both need identical derivation
// or the instruments would be comparing two different things.
//
// The split is exactly: an AUTHORED corpus is a tree of nodes, a set of deep
// layers keyed by topic, and a list of edge triples. Everything else —
// container-vs-leaf, the indexes, the paths, the domains, the edge ids — is
// DERIVED here, from that and nothing else. A dataset file therefore contains
// no logic, and this file contains no data.
//
// The strictness is deliberate and unchanged: an unknown id, a non-topic
// endpoint, a self-loop or a duplicate pair throws at module load. An authoring
// typo — or a generator bug — cannot ship silently.

import type { CorpusSpec, DeepSpec, GEdge, GNode } from './graphshape'
import { slug } from './graphshape'

export { slug }
export type { CorpusSpec, DeepSpec } from './graphshape'

/** everything the app imports from a corpus module */
export interface BuiltCorpus {
  nodes: GNode[]
  edges: GEdge[]
  byId: Map<string, GNode>
  childrenOf: Map<string, GNode[]>
  deepDoc: Record<string, string>
  allContainerIds: string[]
  topicIds: string[]
  domainIds: string[]
  maxDepth: number
  isTopic: (id: string) => boolean
  pathTo: (id: string) => string[]
  domainOf: (id: string) => string
  topicHueOf: (id: string) => string | undefined
  topicsUnder: (id: string) => string[]
  depthOf: (id: string) => number
}

export function buildCorpus(spec: CorpusSpec, rootId: string): BuiltCorpus {
  const nodes = spec.nodes

  // ── Deep layers ───────────────────────────────────────────────────────────
  const deepDoc: Record<string, string> = {}
  function attach(parentId: string, children: Record<string, DeepSpec>) {
    for (const [title, s] of Object.entries(children)) {
      const id = `${parentId}-${slug(title)}`
      nodes.push({ id, kind: 'leaf', parentId, title })
      deepDoc[id] = s.d
      if (s.c) attach(id, s.c)
    }
  }
  for (const [topicId, children] of Object.entries(spec.deep)) {
    const t = nodes.find((n) => n.id === topicId)
    if (!t?.topic) throw new Error(`deep layers key a non-topic id: ${topicId}`)
    attach(topicId, children)
  }

  // kind is DERIVED, not trusted: a node with children is a container no matter
  // what the authoring helpers guessed — "leaf with children" cannot exist here.
  {
    const hasKids = new Set(nodes.filter((n) => n.parentId !== null).map((n) => n.parentId!))
    for (const n of nodes) n.kind = hasKids.has(n.id) ? 'container' : 'leaf'
  }

  // ── Derived indexes ───────────────────────────────────────────────────────
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map<string, GNode[]>()
  for (const n of nodes) {
    if (n.parentId === null) continue
    const list = childrenOf.get(n.parentId) ?? []
    list.push(n)
    childrenOf.set(n.parentId, list)
  }

  const allContainerIds = nodes.filter((n) => n.kind === 'container' && n.id !== rootId).map((n) => n.id)
  const topicIds = nodes.filter((n) => n.topic).map((n) => n.id)
  const isTopic = (id: string) => byId.get(id)?.topic === true

  /** [root, …, node] — the containment path down to (and including) the node. */
  function pathTo(id: string): string[] {
    const path: string[] = []
    let cur = byId.get(id)
    while (cur) {
      path.unshift(cur.id)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return path
  }

  /** The depth-1 ancestor (domain) a node belongs to; the id itself if it IS a domain. */
  function domainOf(id: string): string {
    const path = pathTo(id)
    return path[1] ?? id
  }

  const domainIds = (childrenOf.get(rootId) ?? []).map((d) => d.id)

  /** the ring hue NAME stored on the top-level topic `id` descends from. `undefined` for the
   *  root and for a domain with no stored hue, which every reader resolves to the anchor
   *  fallback rather than to nothing. */
  function topicHueOf(id: string): string | undefined {
    return byId.get(domainOf(id))?.hue
  }

  /** Topic ids inside the subtree rooted at `id` — the id itself if it IS a
   * topic, every topic below it for containers above the topic level, and []
   * for deep nodes (typed edges never reach below topics). */
  function topicsUnder(id: string): string[] {
    const out: string[] = []
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      if (byId.get(cur)!.topic) out.push(cur)
      else for (const c of childrenOf.get(cur) ?? []) stack.push(c.id)
    }
    return out
  }

  /** containment level, root = 1 */
  const depthOf = (id: string) => pathTo(id).length
  const maxDepth = Math.max(...nodes.map((n) => depthOf(n.id)))

  // ── Edges ─────────────────────────────────────────────────────────────────
  // Validated here rather than at authoring time so a dataset file can stay
  // pure data. The guarantees are the ones graph.ts always made.
  const edges: GEdge[] = []
  const seen = new Set<string>()
  for (const { source, target, type } of spec.edges) {
    for (const id of [source, target]) {
      const n = byId.get(id)
      if (!n) throw new Error(`edge references unknown id: ${id}`)
      if (!n.topic) throw new Error(`edge endpoint is not a topic: ${id}`)
    }
    if (source === target) throw new Error(`self-loop: ${source}`)
    const key = `${source}>${target}`
    if (seen.has(key)) throw new Error(`duplicate edge: ${key}`)
    seen.add(key)
    edges.push({ id: `e${edges.length}`, source, target, type })
  }

  return {
    nodes,
    edges,
    byId,
    childrenOf,
    deepDoc,
    allContainerIds,
    topicIds,
    domainIds,
    maxDepth,
    isTopic,
    pathTo,
    domainOf,
    topicHueOf,
    topicsUnder,
    depthOf,
  }
}
