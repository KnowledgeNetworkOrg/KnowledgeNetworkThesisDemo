// #342 (OB-229, OB-235) — the relations figure and the reading under it, pinned where a screenshot
// cannot see them. The figure's rules are all silent when broken: a wedge floor that only one of
// two callers applies washes half a circle under marks fanned across the whole one, and a chart
// that counts a population the figure does not draw is a legend that lies. Nothing errors.
//
// Rendered with `renderToStaticMarkup`, which needs no DOM, so this lives in the node run beside
// the rest (the same choice `nodearrow.test.ts` makes).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Relation, ViaRelation } from './RelationCards'
import { ORBIT_SELF, orbitKinds, orbitMarks, orbitWedge, RelationOrbit } from './RelationOrbit'
import { relationStats, RelationStats, statKindRows } from './RelationStats'
import { orbitBox, RelationsRail } from './RelationsRail'
import { PANE_RAIL_METRICS, railWidth } from './RailFrame'

const rel = (targetId: string, kind: string, extra: Partial<Relation> = {}): Relation => ({
  id: `${targetId}-${kind}`, targetId, targetTitle: targetId.toUpperCase(), kind, ...extra,
})
const viaRel = (owner: string, r: Relation): ViaRelation => ({ path: [{ id: 'root', title: 'Root' }, { id: owner, title: owner }], rel: r })

describe('orbitWedge — one kind may not own the whole circle', () => {
  it('floors at two sectors, so a lone kind takes half and the empty half is true of the data', () => {
    expect(orbitWedge(1)).toBe(180)
    expect(orbitWedge(0)).toBe(180)
    expect(orbitWedge(2)).toBe(180)
  })

  it('is the plain share once there are more kinds than the floor', () => {
    expect(orbitWedge(3)).toBe(120)
    expect(orbitWedge(4)).toBe(90)
  })

  it('a corpus with ONE relation kind draws its marks in one half of the circle (OB-229 clause 6)', () => {
    // five depends_on relationships — the shape a corpus of course prerequisites produces. At
    // `360 / 1` these fan across every angle and draw exactly as five different kinds would.
    const direct = ['a', 'b', 'c', 'd', 'e'].map((t) => rel(t, 'depends_on'))
    const svg = renderToStaticMarkup(createElement(RelationOrbit, { width: 200, height: 206, direct }))
    const cx = 100
    // the INK lines only (the hit-target twins carry `data-orbit` before `x1`)
    const ends = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => Number(m[3]))
    expect(ends).toHaveLength(5)
    // a half circle centred on 0° (pointing right) keeps every end at or right of the hub
    for (const x of ends) expect(x).toBeGreaterThanOrEqual(cx)
  })
})

describe('orbitMarks — one mark per RELATIONSHIP, never per neighbour', () => {
  it('a neighbour related two ways is two marks sharing one target id', () => {
    const marks = orbitMarks([rel('t1', 'uses'), rel('t1', 'see_also'), rel('t2', 'uses')], [])
    expect(marks.map((m) => m.key)).toEqual(['t1|uses', 't1|see_also', 't2|uses'])
    expect(new Set(marks.map((m) => m.rel.targetId)).size).toBe(2)
  })

  it('an indirect mark names the descendant that owns it, and a direct one names none', () => {
    const marks = orbitMarks([rel('t1', 'uses')], [viaRel('child', rel('t2', 'uses'))])
    expect(marks[0].via).toBeNull()
    expect(marks[1].via).toEqual({ id: 'child', title: 'child' })
  })

  it('nothing in, nothing out', () => {
    expect(orbitMarks(undefined, undefined)).toEqual([])
    expect(orbitMarks([], [])).toEqual([])
  })
})

describe('orbitKinds — the wedges are cut in first-appearance order, the corpus\'s own', () => {
  it('keeps the order the data arrived in rather than an alphabetical one', () => {
    const marks = orbitMarks([rel('a', 'uses'), rel('b', 'depends_on'), rel('c', 'uses')], [viaRel('k', rel('d', 'see_also'))])
    expect(orbitKinds(marks)).toEqual(['uses', 'depends_on', 'see_also'])
  })
})

describe('RelationOrbit — no marks, no drawing', () => {
  it('draws NOTHING for a node with no relationships: the dashed rings would label two empty regions', () => {
    expect(renderToStaticMarkup(createElement(RelationOrbit, { direct: [], via: [] }))).toBe('')
  })

  it('the hub is a mark like the others, and a hot key lights exactly what it names', () => {
    const direct = [rel('t1', 'uses'), rel('t1', 'see_also'), rel('t2', 'uses')]
    const lit = (hot: string | null) => {
      const svg = renderToStaticMarkup(createElement(RelationOrbit, { direct, hot }))
      const flag = (id: string) => [...svg.matchAll(new RegExp(`data-orbit="${id.replace('|', '\\|')}" data-orbit-lit="(\\d)"`, 'g'))].map((m) => m[1])
      return { t1: flag('t1'), t2: flag('t2'), hub: flag(ORBIT_SELF) }
    }
    // a neighbour key lights BOTH of its twin marks and nothing else
    expect(lit('t1')).toEqual({ t1: ['1', '1'], t2: ['0'], hub: ['0'] })
    // one relationship's key names a neighbour too: the twin dot is the neighbour's
    expect(lit('t1|uses').t1).toEqual(['1', '1'])
    // the hub lights on its own key, and no neighbour with it
    expect(lit(ORBIT_SELF)).toEqual({ t1: ['0', '0'], t2: ['0'], hub: ['1'] })
    expect(lit(null)).toEqual({ t1: ['0', '0'], t2: ['0'], hub: ['0'] })
  })
})

describe('relationStats — the population, counted once, in two measures that do not agree', () => {
  const direct = [rel('t1', 'uses'), rel('t1', 'see_also'), rel('t2', 'depends_on')]
  const via = [viaRel('k1', rel('t2', 'uses')), viaRel('k2', rel('t3', 'uses'))]

  it('neighbours count nodes and relationships count marks: a two-kind neighbour is one and two', () => {
    const s = relationStats(direct, via)
    expect(s.neighbours).toBe(3)
    expect(s.relationships).toBe(5)
  })

  it('the chart counts exactly the marks the figure draws (OB-235 clause 4)', () => {
    expect(relationStats(direct, via).relationships).toBe(orbitMarks(direct, via).length)
  })

  it('a neighbour is direct if it holds ANY direct relationship, so the two halves partition the headline', () => {
    const s = relationStats(direct, via)
    // t1 and t2 are direct (t2 also appears via k1); t3 is indirect only
    expect(s.ownNeighbours).toBe(2)
    expect(s.viaNeighbours).toBe(1)
    expect(s.ownNeighbours + s.viaNeighbours).toBe(s.neighbours)
  })

  it('kind rows descend on the measure being shown, and the hop selection changes the measure', () => {
    const marks = orbitMarks(direct, via)
    expect(statKindRows(marks).map((r) => [r.kind, r.own + r.via])).toEqual([['uses', 3], ['see_also', 1], ['depends_on', 1]])
    // only-indirect: `uses` twice, and the kinds with none indirect drop out
    expect(statKindRows(marks, 'via').map((r) => [r.kind, r.via])).toEqual([['uses', 2]])
    expect(statKindRows(marks, 'own').map((r) => r.kind)).toEqual(['uses', 'see_also', 'depends_on'])
  })
})

describe('RelationStats — a count of zero is a reading, drawn as the system\'s placeholder', () => {
  it('a node with no relationships says whose absence it is, in a NOTE and not a gesture (OB-235 clause 6)', () => {
    const html = renderToStaticMarkup(createElement(RelationStats, { direct: [], via: [] }))
    expect(html).toContain('data-pane-placeholder')
    expect(html).toContain('No relationships')
    expect(html).toContain('Nothing connects to this node')
    // the placeholder's own second line — no instruction the reader would hunt for a control to follow
    expect(html).not.toMatch(/point at|click|select/i)
  })

  it('a node WITH relationships draws the two totals, the hop bar and the kind rows, and no placeholder', () => {
    const html = renderToStaticMarkup(createElement(RelationStats, { direct: [rel('t1', 'uses')], via: [] }))
    expect(html).not.toContain('data-pane-placeholder')
    expect(html).toContain('neighbours')
    expect(html).toContain('relationships')
    expect(html).toContain('data-stat-hop="own"')
    expect(html).toContain('data-stat-kind="uses"')
  })

  it('every hover tooltip on the bars is folded, and empty ones are not raw', () => {
    // the adherence sweep guards the source; this guards that the folded value reaches the markup
    const html = renderToStaticMarkup(createElement(RelationStats, { direct: [rel('t1', 'uses')], via: [] }))
    expect(html).toContain('title="1 direct"')
  })
})

describe('RelationsRail — the figure, the reading, and NO standing card list', () => {
  it('opens a node with relationships on the figure, a hairline, and the reading', () => {
    const html = renderToStaticMarkup(createElement(RelationsRail, { direct: [rel('t1', 'uses')], via: [], paneW: 0, closedControl: 'host' }))
    expect(html).toContain('data-relation-orbit')
    expect(html).toContain('data-relation-stats')
    // OB-235 clause 2: the rail renders no card list of any kind, in either form
    expect(html).not.toContain('data-rel-group-header')
    expect(html).not.toContain('data-orbit-card')
  })

  it('a node with NO relationships drops the figure AND the hairline, and keeps the reading\'s own placeholder', () => {
    const html = renderToStaticMarkup(createElement(RelationsRail, { direct: [], via: [], paneW: 0, closedControl: 'host' }))
    expect(html).not.toContain('data-relation-orbit')
    expect(html).toContain('No relationships')
    // the figure's wrapper stays attached (the pane's layer asks it for a box to avoid) but is empty
    expect(html).toMatch(/<div data-relations-figure="1"><\/div>/)
    // …and there is no 1px rule under the absent figure
    expect(html).not.toMatch(/height:1px;background:var\(--border-hair\);margin:6px 0 8px/)
  })

  it('closed with `closedControl="host"` draws nothing at all — the pane\'s row draws the way back', () => {
    expect(renderToStaticMarkup(createElement(RelationsRail, { direct: [rel('t1', 'uses')], paneW: 0, railOpen: false, closedControl: 'host' }))).toBe('')
  })
})

describe('orbitBox — derived from the rail, never typed', () => {
  it('is the rail\'s own width less its padding, and a height that keeps the rings round', () => {
    const w = railWidth('right', 2000, null)
    expect(orbitBox(2000, null)).toEqual({ width: w - 18, height: w + 6 })
  })

  it('shrinks with the pane down to the rail\'s floor, where the figure is at its smallest', () => {
    const floor = PANE_RAIL_METRICS.right.min
    expect(orbitBox(floor + PANE_RAIL_METRICS.right.keep, null).width).toBe(floor - 18)
  })

  it('follows a dragged width, so a card sized against it is sized against what the rail draws', () => {
    expect(orbitBox(2000, 300).width).toBe(300 - 18)
    // …capped at the rail's stretch, and clamped by the pane
    expect(orbitBox(2000, 9999).width).toBe(PANE_RAIL_METRICS.right.stretch - 18)
    expect(orbitBox(500, 420).width).toBe(500 - PANE_RAIL_METRICS.right.keep - 18)
  })
})
