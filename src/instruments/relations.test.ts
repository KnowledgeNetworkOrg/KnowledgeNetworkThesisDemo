// #342 (OB-229, OB-230, OB-235) — the relationship adapters the relations rail and the Connections
// pane share, read against the REAL corpus. Every count in this file is derived from the corpus
// itself (never typed), so it measures whichever corpus is loaded and the pinned numbers elsewhere
// in the suite stay the teaching corpus's.
//
// WHAT IS PINNED HERE IS WHAT GOES WRONG SILENTLY: a via roll-up that leaves in a relationship
// whose far end is inside the node draws a road from the node to itself; a figure fed two entries
// with one (target, kind) key draws one mark twice on the same spot under a duplicated React key;
// a card width that overhangs its gutter covers the figure it describes. None of them errors.

import { describe, expect, it } from 'vitest'

import { REL_CARD_METRICS } from '@/ds'
import type { Relation, ViaRelation } from '@/ds'

import { allContainerIds, byId, childrenOf, edges, nodes, pathTo, topicIds } from '../corpus/graph'
import {
  cardRelationsOf, neighbourhoodOf, neighbourLitBy, ORBIT_CARD_PAD_X, orbitCardWidths, orbitKeyParts,
  relationsForKey, relationsOfNode, viaRelationsOf,
} from './relations'

const subtree = (id: string): Set<string> => {
  const out = new Set<string>()
  const walk = (n: string) => { out.add(n); for (const k of childrenOf.get(n) ?? []) walk(k.id) }
  walk(id)
  return out
}
const keyOf = (r: { targetId: string; kind: string }) => r.targetId + '|' + r.kind

describe('relationsOfNode — one entry per target and kind, told from each end', () => {
  it('every authored edge appears from BOTH ends, with the direction told from that end', () => {
    const e = edges.find((x) => x.type !== 'see_also')!
    const out = relationsOfNode(e.source).find((r) => r.id === e.id)!
    const back = relationsOfNode(e.target).find((r) => r.id === e.id)!
    expect(out.targetId).toBe(e.target)
    expect(out.direction).toBe('out')
    expect(back.targetId).toBe(e.source)
    expect(back.direction).toBe('in')
  })

  it('the symmetric kind reads "both" from either end', () => {
    const e = edges.find((x) => x.type === 'see_also')
    if (!e) return // a corpus with no symmetric kind (the course corpus) has nothing to say here
    expect(relationsOfNode(e.source).find((r) => r.id === e.id)!.direction).toBe('both')
    expect(relationsOfNode(e.target).find((r) => r.id === e.id)!.direction).toBe('both')
  })

  it('answers the same array for the same node — the pane memoises on it', () => {
    const id = edges[0].source
    expect(relationsOfNode(id)).toBe(relationsOfNode(id))
    expect(relationsOfNode('no-such-node')).toEqual([])
  })
})

describe('viaRelationsOf — what a node\'s DESCENDANTS are related to', () => {
  const containers = [...allContainerIds].filter((id) => byId.has(id))

  it('a topic with no children rolls up nothing', () => {
    const leaf = topicIds.find((id) => !childrenOf.has(id))
    if (leaf) expect(viaRelationsOf(leaf)).toEqual([])
  })

  it('never lists a relationship whose far end is INSIDE the node: internal wiring is not a neighbour', () => {
    for (const id of containers) {
      const inside = subtree(id)
      for (const v of viaRelationsOf(id)) expect(inside.has(v.rel.targetId), `${id} -> ${v.rel.targetId}`).toBe(false)
    }
  })

  it('the path runs from the node itself down to the descendant that owns the relationship', () => {
    for (const id of containers) {
      for (const v of viaRelationsOf(id)) {
        expect(v.path[0].id).toBe(id)
        expect(v.path.length).toBeGreaterThanOrEqual(2)
        const owner = v.path[v.path.length - 1]
        expect(relationsOfNode(owner.id)).toContain(v.rel)
        // each step is a real child of the one before it
        for (let i = 1; i < v.path.length; i++) expect(byId.get(v.path[i].id)!.parentId).toBe(v.path[i - 1].id)
      }
    }
  })

  it('carries each path entry\'s OWN topic, because the via pill wears the owner\'s colour (OB-211)', () => {
    const withVia = containers.find((id) => viaRelationsOf(id).length)
    expect(withVia, 'a corpus with at least one container that reaches out').toBeDefined()
    for (const v of viaRelationsOf(withVia!)) expect('domain' in v.path[v.path.length - 1]).toBe(true)
  })

  it('is cached: the same node answers the same array', () => {
    const id = containers.find((c) => viaRelationsOf(c).length)!
    expect(viaRelationsOf(id)).toBe(viaRelationsOf(id))
  })
})

describe('neighbourhoodOf — ONE ENTRY PER (TARGET, KIND), because the figure draws one mark per relationship', () => {
  it('no two entries in direct + via share a key, for ANY node of the corpus', () => {
    // a duplicated key is one mark drawn twice on one spot under a duplicated React key, and a
    // chart total that disagrees with the picture (OB-235 clause 4)
    for (const n of nodes) {
      const h = neighbourhoodOf(n.id)
      const keys = [...h.direct.map(keyOf), ...h.via.map((v) => keyOf(v.rel))]
      expect(new Set(keys).size, n.id).toBe(keys.length)
    }
  })

  it('the de-duplication is not speculative: the raw roll-up DOES carry repeated keys somewhere', () => {
    // if this ever stops holding, the guard above is guarding nothing and can go — but say so here
    const raw = nodes.some((n) => {
      const keys = viaRelationsOf(n.id).map((v) => keyOf(v.rel))
      return new Set(keys).size !== keys.length
    })
    expect(raw).toBe(true)
  })

  it('direct wins, and dropping a repeat never drops the neighbour: every raw target survives', () => {
    for (const n of nodes) {
      const h = neighbourhoodOf(n.id)
      const drawn = new Set([...h.direct.map(keyOf), ...h.via.map((v) => keyOf(v.rel))])
      for (const r of relationsOfNode(n.id)) expect(drawn.has(keyOf(r)), `${n.id} ${keyOf(r)}`).toBe(true)
      for (const v of viaRelationsOf(n.id)) expect(drawn.has(keyOf(v.rel)), `${n.id} ${keyOf(v.rel)}`).toBe(true)
    }
  })

  it('answers the same object for the same node — the rail memoises on it', () => {
    const id = topicIds[0]
    expect(neighbourhoodOf(id)).toBe(neighbourhoodOf(id))
  })
})

describe('orbitKeyParts — the figure\'s key, split the way the figure splits it', () => {
  it('a relationship, a neighbour and the hub', () => {
    expect(orbitKeyParts('t1|uses')).toEqual({ targetId: 't1', kind: 'uses' })
    expect(orbitKeyParts('t1')).toEqual({ targetId: 't1', kind: null })
    expect(orbitKeyParts('@self')).toEqual({ targetId: null, kind: null })
  })
})

describe('relationsForKey — the filter behind the hover card, on a neighbour related TWO ways', () => {
  // neither shipped corpus contains a neighbour related two ways (measured), so the widening from a
  // relationship to its neighbour is pinned here on lists built for the purpose
  const rel = (targetId: string, kind: string): Relation => ({ id: `${targetId}-${kind}`, targetId, targetTitle: targetId, kind })
  const direct = [rel('t1', 'uses'), rel('t1', 'see_also'), rel('t2', 'uses')]
  const via: ViaRelation[] = [
    { path: [{ id: 'p', title: 'P' }, { id: 'c1', title: 'C1' }], rel: rel('t1', 'uses') },
    { path: [{ id: 'p', title: 'P' }, { id: 'c2', title: 'C2' }], rel: rel('t1', 'uses') },
  ]

  it('a relationship key lists THAT relationship and not its neighbour\'s other kind', () => {
    const c = relationsForKey(direct, [], 't1|uses')
    expect(c.direct.map(keyOf)).toEqual(['t1|uses'])
  })

  it('a neighbour key lists EVERY relationship with that neighbour — both kinds', () => {
    const c = relationsForKey(direct, [], 't1')
    expect(c.direct.map(keyOf)).toEqual(['t1|uses', 't1|see_also'])
  })

  it('names every descendant that carries a shared relationship, not just the first', () => {
    const c = relationsForKey([], via, 't1|uses')
    expect(c.via.map((v) => v.path[v.path.length - 1].id)).toEqual(['c1', 'c2'])
  })

  it('answers both groups at once for a neighbour reached both ways', () => {
    const c = relationsForKey(direct, via, 't1')
    expect(c.direct).toHaveLength(2)
    expect(c.via).toHaveLength(2)
  })

  it('the hub, and a key nothing matches, list nothing', () => {
    expect(relationsForKey(direct, via, '@self')).toEqual({ direct: [], via: [] })
    expect(relationsForKey(direct, via, 'nobody|uses')).toEqual({ direct: [], via: [] })
    expect(relationsForKey(direct, via, 't2|see_also')).toEqual({ direct: [], via: [] })
  })
})

describe('cardRelationsOf — what the hover card lists for a figure key on a real node', () => {
  const someTopic = topicIds.find((id) => neighbourhoodOf(id).direct.length)!

  it('a relationship key lists THAT relationship of the real node', () => {
    const r = neighbourhoodOf(someTopic).direct[0]
    const c = cardRelationsOf(someTopic, r.targetId + '|' + r.kind)
    expect(c.direct.map(keyOf)).toEqual([keyOf(r)])
    expect(c.via).toEqual([])
  })

  it('the hub has no relationship card: it opens the node\'s own preview instead', () => {
    expect(cardRelationsOf(someTopic, '@self')).toEqual({ direct: [], via: [] })
  })

  it('a via relationship is listed with EVERY descendant that carries it, not just the first', () => {
    // the figure draws one mark for a repeated (target, kind); the card must still name every source
    for (const n of nodes) {
      const raw = viaRelationsOf(n.id)
      const seen = new Map<string, number>()
      for (const v of raw) seen.set(keyOf(v.rel), (seen.get(keyOf(v.rel)) ?? 0) + 1)
      const repeated = [...seen].find(([, count]) => count > 1)
      if (!repeated) continue
      expect(cardRelationsOf(n.id, repeated[0]).via.length).toBe(repeated[1])
      return
    }
  })

  it('an unrelated key lists nothing', () => {
    expect(cardRelationsOf(someTopic, 'no-such-node|uses')).toEqual({ direct: [], via: [] })
  })
})

describe('neighbourLitBy — a hover on the MAP lights a mark in the figure (OB-230, the reverse direction)', () => {
  const topic = topicIds.find((id) => neighbourhoodOf(id).direct.length)!
  const hood = neighbourhoodOf(topic)
  const neighbour = hood.direct[0].targetId

  it('the neighbour\'s own cell lights that neighbour', () => {
    expect(neighbourLitBy(neighbour, hood)).toBe(neighbour)
  })

  it('a cell DEEPER inside the neighbour lights it too — the map hovers at any level', () => {
    const deeper = [...subtree(neighbour)].find((id) => id !== neighbour)
    if (deeper) expect(neighbourLitBy(deeper, hood)).toBe(neighbour)
  })

  it('a cell that is not a neighbour lights nothing, and neither does nothing at all', () => {
    const stranger = topicIds.find((id) => id !== topic && !hood.direct.some((r) => r.targetId === id) && !pathTo(id).some((a) => hood.direct.some((r) => r.targetId === a)))!
    expect(neighbourLitBy(stranger, hood)).toBeNull()
    expect(neighbourLitBy(null, hood)).toBeNull()
    expect(neighbourLitBy(undefined, hood)).toBeNull()
    expect(neighbourLitBy('no-such-node', hood)).toBeNull()
  })

  it('the node\'s own cell is not its own neighbour', () => {
    expect(neighbourLitBy(topic, hood)).toBeNull()
  })
})

describe('orbitCardWidths — the card\'s rows must fit the gutter they sit in', () => {
  const M = REL_CARD_METRICS
  const CARD_BORDER = 1
  /** everything a row spends, summed: the two pills, the connector, the group's chrome, the row's own
   *  gaps and padding, and the card's own padding and border */
  const spent = (w: number) => {
    const { pill, arrow } = orbitCardWidths(w)
    return 2 * pill + arrow + M.groupChrome + M.rowPad * 2 + M.rowGap * 2 + ORBIT_CARD_PAD_X * 2 + CARD_BORDER * 2
  }

  it('never overhangs, across every gutter the rail can leave (previewGutter\'s ceiling down to the narrowest that opens)', () => {
    // the rail opens at a pane of `min + keep` = 396, where the figure is 168 wide and the gutter
    // 396 - 168 - 14 - 8 = 206; a wider pane only widens it, up to the card's own 262
    for (let w = 206; w <= 262; w++) expect(spent(w), `card ${w}`).toBeLessThanOrEqual(w)
  })

  it('a wider card puts the extra into the pills first (capped), then the connector', () => {
    expect(orbitCardWidths(262).pill).toBeGreaterThanOrEqual(orbitCardWidths(206).pill)
    expect(orbitCardWidths(262).arrow).toBeGreaterThanOrEqual(M.arrowMin)
  })

  it('never takes a pill below its minimum or the connector below its own', () => {
    for (const w of [150, 206, 262]) {
      expect(orbitCardWidths(w).pill).toBeGreaterThanOrEqual(M.pillMin)
      expect(orbitCardWidths(w).arrow).toBeGreaterThanOrEqual(M.arrowMin)
    }
  })
})
