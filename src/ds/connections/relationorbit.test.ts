// relationorbit.test.ts — the Relations figure's placement rules, read back out of its markup
// (#342, DS OB-229 and its 2026-09-22 amendments).
//
// The rules are arithmetic, and every one of them fails SILENTLY: a single kind fanned over the
// whole circle still draws five tidy dots, an empty figure still draws two tidy rings, and two
// marks sharing a key still draw — on one spot. So these render the component with
// `renderToStaticMarkup` (no DOM needed) and read where the dots actually landed.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Relation, ViaRelation } from './RelationCards'
import { ORBIT_METRICS, ORBIT_SELF, orbitKinds, orbitMarks, orbitWedge, RelationOrbit } from './RelationOrbit'
import type { RelationOrbitProps } from './RelationOrbit'

const rel = (targetId: string, kind: string): Relation => ({ id: targetId + '-' + kind, targetId, targetTitle: targetId.toUpperCase(), kind })
const viaRel = (holder: string, targetId: string, kind: string): ViaRelation => ({
  path: [{ id: 'centre', title: 'Centre' }, { id: holder, title: holder }],
  rel: { id: holder + '-' + targetId + '-' + kind, targetId, targetTitle: targetId.toUpperCase(), kind },
})

const W = 200
const H = 206
const draw = (props: RelationOrbitProps) => renderToStaticMarkup(createElement(RelationOrbit, { width: W, height: H, ...props }))

/** every relationship DOT (the resting radius), as [x, y] */
const dots = (svg: string) =>
  [...svg.matchAll(new RegExp(`<circle cx="([-\\d.e]+)" cy="([-\\d.e]+)" r="${ORBIT_METRICS.dot}"`, 'g'))].map((m) => [Number(m[1]), Number(m[2])])

describe('orbitWedge — one kind may not own the whole circle (amendment (a))', () => {
  it('one kind takes HALF the circle, not all of it', () => {
    expect(orbitWedge(1)).toBe(180)
  })
  it('no kinds at all is floored the same way, never a division by zero', () => {
    expect(orbitWedge(0)).toBe(180)
  })
  it('two or more kinds share the circle evenly', () => {
    expect(orbitWedge(2)).toBe(180)
    expect(orbitWedge(4)).toBe(90)
  })
})

describe('orbitMarks / orbitKinds — one mark per relationship, kinds in authored order', () => {
  it('a neighbour with two kinds is two marks sharing one target', () => {
    const marks = orbitMarks([rel('x', 'uses'), rel('x', 'depends_on')], [])
    expect(marks.map((m) => m.key)).toEqual(['x|uses', 'x|depends_on'])
    expect(new Set(marks.map((m) => m.rel.targetId)).size).toBe(1)
  })
  it('a via mark carries the descendant that holds it; a direct one carries none', () => {
    const marks = orbitMarks([rel('x', 'uses')], [viaRel('child', 'y', 'uses')])
    expect(marks[0].via).toBeNull()
    expect(marks[1].via?.id).toBe('child')
  })
  it('kinds are cut in first-appearance order, not alphabetically', () => {
    expect(orbitKinds(orbitMarks([rel('a', 'uses'), rel('b', 'depends_on'), rel('c', 'uses')], []))).toEqual(['uses', 'depends_on'])
  })
})

describe('RelationOrbit — what it draws', () => {
  it('draws NOTHING without marks — no rings around a lone hub (amendment (b))', () => {
    expect(draw({ direct: [], via: [] })).toBe('')
    expect(draw({})).toBe('')
  })

  it('a single kind draws every mark in ONE half of the circle', () => {
    const svg = draw({ direct: ['a', 'b', 'c', 'd', 'e'].map((t) => rel(t, 'depends_on')) })
    const at = dots(svg)
    expect(at).toHaveLength(5)
    // the one kind's wedge is centred on the right-hand horizontal, so the whole left half —
    // the vocabulary's unused room — stays empty
    for (const [x] of at) expect(x).toBeGreaterThan(W / 2)
  })

  it('and its wedge wash covers that same half — the floor is applied to both uses', () => {
    const svg = draw({ direct: ['a', 'b'].map((t) => rel(t, 'depends_on')), kind: 'depends_on' })
    const d = svg.match(/data-orbit-wedge="depends_on" d="([^"]+)"/)
    expect(d).not.toBeNull()
    const nums = d![1].match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number)
    // M cx cy L x0 y0 A rx ry 0 0 1 x1 y1 Z — both ends on the vertical through the hub
    const [, , x0, y0, , , , , , x1, y1] = nums
    expect(x0).toBeCloseTo(W / 2, 6)
    expect(x1).toBeCloseTo(W / 2, 6)
    expect(y0).toBeLessThan(H / 2)
    expect(y1).toBeGreaterThan(H / 2)
  })

  it('two kinds use both halves', () => {
    const at = dots(draw({ direct: [rel('a', 'uses'), rel('b', 'depends_on')] }))
    expect(at.some(([x]) => x > W / 2)).toBe(true)
    expect(at.some(([x]) => x < W / 2)).toBe(true)
  })

  it('direct marks sit on the inner ring and via marks on the outer', () => {
    const at = dots(draw({ direct: [rel('a', 'uses')], via: [viaRel('child', 'b', 'uses')] }))
    const r = ([x, y]: number[]) => Math.hypot(x - W / 2, y - H / 2)
    expect(r(at[0])).toBeLessThan(r(at[1]))
  })

  it('two children related the SAME way to the SAME node draw two marks, not one on top of the other', () => {
    // ★ LOCAL fix: the DS keys positions by `targetId|kind`, so the second overwrote the first
    const at = dots(draw({ via: [viaRel('child-1', 'x', 'depends_on'), viaRel('child-2', 'x', 'depends_on')] }))
    expect(at).toHaveLength(2)
    expect(at[0][0] !== at[1][0] || at[0][1] !== at[1][1]).toBe(true)
  })

  it('a hot neighbour lights every mark it owns; the hub has its own key', () => {
    const svg = draw({ direct: [rel('x', 'uses'), rel('x', 'depends_on'), rel('y', 'uses')], hot: 'x' })
    expect((svg.match(/data-orbit="x" data-orbit-lit="1"/g) || []).length).toBe(2)
    expect(svg).toContain('data-orbit="y" data-orbit-lit="0"')
    expect(draw({ direct: [rel('x', 'uses')], hot: ORBIT_SELF })).toContain(`data-orbit="${ORBIT_SELF}" data-orbit-lit="1"`)
  })
})
