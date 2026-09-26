// corpusrelations.test.ts — the relationship index both relation surfaces read, and the
// Relations rail's via-children roll-up (#342).
//
// The roll-up's one rule is the one that is easy to lose: a relationship with BOTH ends inside
// the node's own subtree is internal wiring, not a neighbour. Kept in, the corpus root's figure
// would draw the whole corpus as its neighbourhood — every edge twice, once from each end.

import { describe, expect, it } from 'vitest'

import { byId, childrenOf, edges, ROOT_ID } from '../corpus/graph'
import { relationsOfNode, viaRelationsOf } from './corpusrelations'

/** every node at or under `id` */
const subtree = (id: string): Set<string> => {
  const out = new Set<string>([id])
  for (const c of childrenOf.get(id) ?? []) for (const d of subtree(c.id)) out.add(d)
  return out
}

describe('relationsOfNode — one entry per edge END', () => {
  it('every authored edge appears exactly twice across the corpus, once from each end', () => {
    let total = 0
    for (const id of byId.keys()) total += relationsOfNode(id).length
    expect(total).toBe(edges.length * 2)
  })

  it('is stable per id, so a memo keyed on it holds', () => {
    const some = edges[0].source
    expect(relationsOfNode(some)).toBe(relationsOfNode(some))
  })

  it('tells direction from the reading end', () => {
    const e = edges.find((x) => x.type !== 'see_also')!
    expect(relationsOfNode(e.source).find((r) => r.id === e.id)?.direction).toBe('out')
    expect(relationsOfNode(e.target).find((r) => r.id === e.id)?.direction).toBe('in')
  })
})

describe('viaRelationsOf — the neighbourhood a node reaches THROUGH its children', () => {
  it('the corpus root has none: everything is inside it', () => {
    expect(viaRelationsOf(ROOT_ID)).toEqual([])
  })

  const containers = [...byId.keys()].filter((id) => id !== ROOT_ID && (childrenOf.get(id) ?? []).length > 0)

  it('the corpus has containers to check this on', () => {
    expect(containers.length).toBeGreaterThan(0)
  })

  it('no via relationship ends inside the node it is rolled up under', () => {
    for (const id of containers) {
      const inside = subtree(id)
      for (const v of viaRelationsOf(id)) expect(inside.has(v.rel.targetId), `${id} → ${v.rel.targetId}`).toBe(false)
    }
  })

  it('each carries the containment path from the node down to the child that holds it', () => {
    for (const id of containers) {
      for (const v of viaRelationsOf(id)) {
        expect(v.path[0].id).toBe(id)
        expect(v.path.length).toBeGreaterThanOrEqual(2)
        const holder = v.path[v.path.length - 1].id
        expect(relationsOfNode(holder)).toContain(v.rel)
      }
    }
  })

  it('and it misses none: every outward relationship of every descendant is there', () => {
    for (const id of containers) {
      const inside = subtree(id)
      let expected = 0
      for (const d of inside) if (d !== id) expected += relationsOfNode(d).filter((r) => !inside.has(r.targetId)).length
      expect(viaRelationsOf(id).length, id).toBe(expected)
    }
  })

  it('a node with no children has no via relationships, and the answer is stable', () => {
    const leaf = [...byId.keys()].find((id) => !(childrenOf.get(id) ?? []).length)!
    expect(viaRelationsOf(leaf)).toEqual([])
    const some = containers[0]
    expect(viaRelationsOf(some)).toBe(viaRelationsOf(some))
  })
})
