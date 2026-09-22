// WHAT A GRAPH IS, for every corpus in this repo. Types only, plus the root's
// id — no data and no logic, so anything may import it without dragging a
// corpus in behind it.
//
// These lived in graph.ts until the repo gained a second corpus (`coursedata.ts`,
// generated from real university course outlines). graph.ts re-exports every
// name here, so an importer that has always said `from '../corpus/graph'` is
// unaffected and should keep saying it.

export type EdgeType = 'depends_on' | 'uses' | 'see_also' | 'implemented_with'

export interface GNode {
  id: string
  /** tree role, DERIVED from the authored structure: has children or not */
  kind: 'container' | 'leaf'
  parentId: string | null // null only for root
  title: string
  /** the edge-bearing level: one of the 53 teaching topics */
  topic?: true
  /** the ring hue this TOP-LEVEL topic was handed when it was created — stored with the
   *  topic, never derived from its name or its position (DS OB-153). A rename keeps it, a
   *  delete frees it; `src/model/topichue.ts` is the mechanism, this field is the storage.
   *  Only the depth-1 nodes carry one; everything beneath inherits it (`topicHueOf`). */
  hue?: string
}

export interface GEdge {
  id: string
  source: string // always a topic
  target: string // always a topic
  type: EdgeType
}

export const ROOT_ID = 'root'

/** one node of a deep layer: a blurb, and optional children by title */
export interface DeepSpec {
  /** one-line teaching blurb — merged into the document bodies under the derived id */
  d: string
  /** children by title; absence means this node is a true leaf */
  c?: Record<string, DeepSpec>
}

/** what a dataset file hands over: authored structure, nothing derived */
export interface CorpusSpec {
  /** the tree, root first; `kind` on these is a guess and is overwritten by the builder */
  nodes: GNode[]
  /** children below each topic, keyed by topic id — ids chain parent-id + title slug */
  deep: Record<string, Record<string, DeepSpec>>
  /** edges as authored, in authoring order; ids are assigned by the builder */
  edges: { source: string; target: string; type: EdgeType }[]
}

/** the id rule every corpus shares: a title becomes a url-safe fragment */
export const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-')
