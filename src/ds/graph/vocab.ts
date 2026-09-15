// The graph vocabulary the DS components are typed against: the four authored
// relations. Not the saturated `-raw` source values — adopting these components
// re-tints hue to the muted palette on purpose (#62).
//
// THERE IS NO DOMAIN VOCABULARY HERE ANY MORE (OB-153, 2026-09-14). Until then this
// file carried `DomainCode`, a closed union of the demo corpus's six top-level ids,
// and `DOMAIN_TOKEN`, a table from those six codes to ring-slot tokens. The owner's
// ruling: the topics are not fixed — this app is a general graphing tool and a topic
// is whatever the user makes — so a six-entry table was the wrong SHAPE whatever its
// values, and a closed union typed every domain prop against the demo's vocabulary.
// A topic is a user string. Its colour is a ring hue NAME stored on the topic when it
// is created (`src/model/topichue.ts`; the corpus carries it as `GNode.hue`), and every
// drawing reads a field off `topicPaint(hue)` / `topicPaintValues(hue)` in
// src/ds/graph/DomainDot.tsx. Nothing anywhere maps a topic name to a colour.

export type EdgeKind = 'depends_on' | 'uses' | 'see_also' | 'implemented_with'

/** edge kind → its muted DS colour token (the same muted palette the EdgeLegend
 *  renders — used where a caller passes an edge colour INTO a DS component, e.g.
 *  a lens row's swatch) */
export const EDGE_TOKEN: Record<EdgeKind, string> = {
  depends_on: 'var(--edge-depends-on)',
  uses: 'var(--edge-uses)',
  see_also: 'var(--edge-see-also)',
  implemented_with: 'var(--edge-implemented-with)',
}
