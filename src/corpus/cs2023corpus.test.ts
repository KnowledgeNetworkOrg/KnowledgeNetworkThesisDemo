// THE CS2023 CORPUS, CHECKED WHETHER OR NOT IT IS THE ONE LOADED.
//
// Like `coursecorpus.test.ts`: `cs2023data.ts` is generated, and `graph.ts` only
// builds it when `VITE_CORPUS=cs2023`, so this file imports it DIRECTLY — not
// through `graph.ts` — and `npm run verify` builds and checks it every time, on the
// default corpus.
//
// What it asserts is what the thesis's map file promises: the CS2023 hierarchy with
// knowledge units as the edge-bearing level, no edge but CS2023's own printed
// "See also" notes, the author's Science exception alongside it, and the TMU
// courses as routes over the map.

import { describe, expect, it } from 'vitest'

import { topicHue } from '../ds/graph/hueslots'
import { throughWalksAt } from '../model/throughwalks'
import { buildCorpus } from './corpusbuild'
import { CS2023 } from './cs2023data'
import { CS2023_DOC } from './cs2023docs'
import { CS2023_WALKS } from './cs2023walks'
import { ROOT_ID } from './graphshape'

const built = buildCorpus({ ...CS2023, nodes: CS2023.nodes.map((n) => ({ ...n })) }, ROOT_ID)
const stops = CS2023_WALKS.flatMap((w) => w.stops)

describe('the CS2023 tree', () => {
  it('has 18 domains: the 17 CS2023 knowledge areas and Science', () => {
    expect(built.domainIds.length).toBe(18)
    expect(built.domainIds).toContain('X-Science')
  })

  it('the knowledge units are the topic level, each directly under its area', () => {
    expect(built.topicIds.length).toBe(162)
    for (const id of built.topicIds) expect(built.depthOf(id), id).toBe(3)
  })

  it('below the units, the 305 CS2023 places some course stops at and the places above them, under CS2023 ids', () => {
    const deep = built.nodes.filter((n) => built.depthOf(n.id) > 3)
    expect(deep.length).toBe(305)
    for (const n of deep) expect(n.id, n.id).toMatch(/^[A-Z]+-[A-Za-z-]+\.T\d+/)
  })

  it('siblings CS2023 gives the same title stay separate places', () => {
    for (const [a, b] of [['AI-ML.T12', 'AI-ML.T22'], ['AL-Strategies.T1', 'AL-Strategies.T4']]) {
      const na = built.byId.get(a), nb = built.byId.get(b)
      expect(na && nb, `${a} and ${b} are both places`).toBeTruthy()
      expect(na?.title).toBe(nb?.title)
      expect(na?.parentId).toBe(nb?.parentId)
    }
  })

  it('every domain stores the ring hue the ring would hand it in area order, Science included', () => {
    built.domainIds.forEach((id, i) => expect(built.byId.get(id)?.hue, id).toBe(topicHue(i)))
  })
})

describe('the edges are CS2023\'s own "See also" notes, and nothing else', () => {
  it('520 edges, all see_also, each joining two knowledge units', () => {
    expect(built.edges.length).toBe(520)
    const units = new Set(built.topicIds)
    for (const e of built.edges) {
      expect(e.type).toBe('see_also')
      expect(units.has(e.source) && units.has(e.target), `${e.source} > ${e.target}`).toBe(true)
    }
  })

  it('keep the printed direction: 72 unit pairs are printed both ways and give two edges', () => {
    const keys = new Set(built.edges.map((e) => `${e.source}>${e.target}`))
    const twoWay = built.edges.filter((e) => keys.has(`${e.target}>${e.source}`)).length
    expect(twoWay).toBe(144)
  })
})

describe('the documents and the routes', () => {
  it('every node has exactly one document body', () => {
    expect(Object.keys(CS2023_DOC).sort()).toEqual(built.nodes.map((n) => n.id).sort())
  })

  it('Science says it is the author\'s exception, outside CS2023', () => {
    expect(CS2023_DOC['X-Science']).toMatch(/exception group, outside CS2023/)
  })

  it('61 routes, 60 with stops, 637 stops, 61 distinct ids', () => {
    expect(CS2023_WALKS.length).toBe(61)
    expect(CS2023_WALKS.filter((w) => w.stops.length > 0).length).toBe(60)
    expect(stops.length).toBe(637)
    expect(new Set(CS2023_WALKS.map((w) => w.id)).size).toBe(61)
  })

  it('every stop is a real place; by level 58 areas, 33 Science, 100 units and 446 deeper', () => {
    const tally = { areas: 0, science: 0, units: 0, deeper: 0 }
    for (const w of CS2023_WALKS) {
      for (const s of w.stops) {
        const n = built.byId.get(s.id)
        expect(n, `${w.id} stops on ${s.id}`).toBeTruthy()
        if (!n) continue
        if (s.id === 'X-Science') tally.science++
        else if (built.depthOf(s.id) === 2) tally.areas++
        else if (built.depthOf(s.id) === 3) tally.units++
        else tally.deeper++
      }
    }
    expect(tally).toEqual({ areas: 58, science: 33, units: 100, deeper: 446 })
  })

  it('carries the data\'s marks verbatim: source, confidence and 129 secondary tags', () => {
    const by = (k: 'source' | 'confidence') => stops.reduce<Record<string, number>>((m, s) => {
      const v = s[k] ?? 'none'
      m[v] = (m[v] ?? 0) + 1
      return m
    }, {})
    expect(by('source')).toEqual({ outline: 444, split: 188, filled: 5 })
    expect(by('confidence')).toEqual({ clear: 157, 'judgment call': 389, 'not matched': 58, exception: 33 })
    expect(stops.reduce((n, s) => n + (s.secondary?.length ?? 0), 0)).toBe(129)
  })

  it('keeps every stop of the 45 routes that visit a place more than once', () => {
    const repeated = CS2023_WALKS.filter((w) => new Set(w.stops.map((s) => s.id)).size < w.stops.length)
    expect(repeated.length).toBe(45)
    for (const w of repeated) expect(new Set(w.stops.map((s) => s.id)).size, w.id).toBeLessThan(w.stops.length)
    expect(stops.length).toBe(637)
  })

  it('"walks through here" gives one entry per visit, not one per place', () => {
    const id = 'SDF-Fundamentals.T6'
    const visits = throughWalksAt(CS2023_WALKS, id)
    const expected = CS2023_WALKS.flatMap((w) => w.stops.map((s, idx) => ({ w, idx, s }))).filter((x) => x.s.id === id)
    expect(visits.length).toBe(expected.length)
    expect(visits.filter((v) => v.walk.id === 'cps-209').map((v) => v.idx)).toEqual([1, 2])
  })

  it('CPS 40A/B is a route with no stops, described by the data\'s own note', () => {
    const empty = CS2023_WALKS.find((w) => w.id === 'cps-40a-b')
    expect(empty).toBeTruthy()
    expect(empty!.stops).toEqual([])
    expect(empty!.description.startsWith('No stops.')).toBe(true)
    expect(empty!.description).toContain('CPS 40A/B (thesis) stays without topics by design.')
  })

  it('every route with stops carries the standing draft line after its calendar words', () => {
    for (const w of CS2023_WALKS) {
      if (w.stops.length === 0) continue
      expect(w.description, w.id).toContain("Placements are AI-suggested and under the author's review.")
    }
  })
})
