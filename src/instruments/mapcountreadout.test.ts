import { describe, expect, it } from 'vitest'
import { subtreeCount } from '../ds/connections/ContainTree'
import type { ContainNode } from '../ds/connections/ContainTree'
import { byId, childrenOf, edges, nodes, ROOT_ID } from '../corpus/graph'
import { territories } from '../model/nested'

/* OB-183 — one "nodes" count on screen. The map pane's readout and the connections pane's hover
 * on the corpus root must give the SAME total (owner-ruled 2026-09-14: the number changes, not the
 * label). The readout prints `nodes.length - 1` (the root IS the corpus, not a node in it); the
 * tooltip prints `subtreeCount(root)` — every descendant, the root excluded. Asserted on the real
 * corpus, not a fixture. */

/** the connections pane's own tree shape (ConnectionsPane.buildContainTree), built here from the
 *  corpus so the assertion runs in the model layer */
function tree(id: string): ContainNode {
  const kids = childrenOf.get(id) ?? []
  const node: ContainNode = { id, title: byId.get(id)!.title }
  if (kids.length) node.children = kids.map((k) => tree(k.id))
  return node
}

describe('OB-183 — the map readout counts the corpus, the same population the root\'s hover counts', () => {
  const readoutNodes = nodes.length - 1

  it('(1) hovering the corpus root and reading the map pane give the same total', () => {
    expect(subtreeCount(tree(ROOT_ID))).toBe(readoutNodes)
  })

  it('(2) the number comes from the corpus, not from geometry — and the gap to the drawing is exactly the 6 domains + 16 modules', () => {
    /* clause (6): a gap other than 22 would mean a cell is collapsing to a sliver — a separate fault */
    expect(readoutNodes - territories.length).toBe(22)
    expect(readoutNodes).toBe(752)
  })

  it('(3) the relations half is unchanged: the corpus\'s authored edges, 116 on this corpus', () => {
    expect(edges.length).toBe(116)
  })
})
