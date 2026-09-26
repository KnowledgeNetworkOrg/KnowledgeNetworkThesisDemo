// relationstats.test.ts — the reading under the Relations figure (#342, DS OB-235).
//
// The item's own check is "by reading: the chart's `relationships` total equals the number of
// marks the figure draws", and that is pinned here literally — both components rendered from
// one input, the dots counted out of the figure's markup.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Relation, ViaRelation } from './RelationCards'
import { ORBIT_METRICS, RelationOrbit } from './RelationOrbit'
import { relationStats, RelationStats, statKindRows } from './RelationStats'

const rel = (targetId: string, kind: string): Relation => ({ id: targetId + '-' + kind, targetId, targetTitle: targetId, kind })
const viaRel = (holder: string, targetId: string, kind: string): ViaRelation => ({
  path: [{ id: 'centre', title: 'Centre' }, { id: holder, title: holder }],
  rel: { id: holder + '-' + targetId + '-' + kind, targetId, targetTitle: targetId, kind },
})

// x: two kinds direct AND once through a child; y: one direct; z: only through a child
const DIRECT = [rel('x', 'uses'), rel('x', 'depends_on'), rel('y', 'uses')]
const VIA = [viaRel('c1', 'z', 'see_also'), viaRel('c2', 'x', 'uses')]

describe('relationStats — two measures that do not agree, on purpose', () => {
  const s = relationStats(DIRECT, VIA)

  it('relationships counts marks; neighbours counts distinct nodes', () => {
    expect(s.relationships).toBe(5)
    expect(s.neighbours).toBe(3)
  })

  it('a neighbour holding ANY direct relationship is direct, so the hop halves partition the headline', () => {
    expect(s.ownNeighbours).toBe(2) // x (also reached through a child) and y
    expect(s.viaNeighbours).toBe(1) // z
    expect(s.ownNeighbours + s.viaNeighbours).toBe(s.neighbours)
  })

  it('nothing at all is zero everywhere, not an error', () => {
    expect(relationStats([], [])).toMatchObject({ neighbours: 0, relationships: 0, ownNeighbours: 0, viaNeighbours: 0 })
  })
})

describe('statKindRows — descending on the measure being SHOWN', () => {
  const marks = relationStats(DIRECT, VIA).marks

  it('all hops: by total', () => {
    expect(statKindRows(marks).map((r) => [r.kind, r.own, r.via])).toEqual([
      ['uses', 2, 1], ['depends_on', 1, 0], ['see_also', 0, 1],
    ])
  })

  it('a hop filter re-sorts on that hop and drops the kinds it leaves empty', () => {
    expect(statKindRows(marks, 'own').map((r) => r.kind)).toEqual(['uses', 'depends_on'])
    expect(statKindRows(marks, 'via').map((r) => r.kind)).toEqual(['uses', 'see_also'])
  })
})

describe('RelationStats — the block itself', () => {
  it("the chart's relationships total equals the number of marks the figure draws (done-when 4)", () => {
    const figure = renderToStaticMarkup(createElement(RelationOrbit, { width: 200, height: 206, direct: DIRECT, via: VIA }))
    const drawn = (figure.match(new RegExp(`r="${ORBIT_METRICS.dot}"`, 'g')) || []).length
    expect(drawn).toBe(relationStats(DIRECT, VIA).relationships)
  })

  it('a node with NO relationships is the system placeholder, with a NOTE and no gesture (done-when 6)', () => {
    const html = renderToStaticMarkup(createElement(RelationStats, { direct: [], via: [] }))
    expect(html).toContain('data-pane-placeholder')
    expect(html).toContain('No relationships')
    expect(html).toContain('Nothing connects to this node')
    expect(html).not.toContain('data-relation-stats')
  })

  it('no track carries a pixel width — every bar is a share of the rail (done-when 5)', () => {
    const html = renderToStaticMarkup(createElement(RelationStats, { direct: DIRECT, via: VIA }))
    expect(html).toContain('data-relation-stats')
    // `width:` only — the DS's own `min-width:10px` floor on a bar's track is what keeps a
    // one-relationship kind visible, and it is not a width the block imposes on the rail
    expect(html).not.toMatch(/(?:^|[;"])width:\d+px/)
    expect(html).toMatch(/flex:0 0 52%/) // the longest kind takes exactly `trackShare`
  })
})
