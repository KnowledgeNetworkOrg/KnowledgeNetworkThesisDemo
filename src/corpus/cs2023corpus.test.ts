// THE CS2023 CORPUS, CHECKED WHETHER OR NOT IT IS THE ONE LOADED.
//
// Like `coursecorpus.test.ts`: `cs2023data.ts` is generated, nothing imports it on
// a default build, so this file imports it DIRECTLY — not through `graph.ts` — and
// `npm run verify` builds and checks it every time, on the default corpus.
//
// What it asserts is what the thesis's map file promises: the CS2023 hierarchy with
// knowledge units as the edge-bearing level, and no edge but CS2023's own printed
// "See also" notes. Science, the thesis author's exception group, waits for the
// routes (see the generator).

import { describe, expect, it } from 'vitest'

import { topicHue } from '../ds/graph/hueslots'
import { buildCorpus } from './corpusbuild'
import { CS2023 } from './cs2023data'
import { CS2023_DOC } from './cs2023docs'
import { CS2023_WALKS } from './cs2023walks'
import { ROOT_ID } from './graphshape'

const built = buildCorpus({ ...CS2023, nodes: CS2023.nodes.map((n) => ({ ...n })) }, ROOT_ID)

describe('the CS2023 tree', () => {
  it('has 17 domains, the CS2023 knowledge areas; Science waits for the routes', () => {
    expect(built.domainIds.length).toBe(17)
    expect(built.domainIds).not.toContain('X-Science')
  })

  it('the knowledge units are the topic level, each directly under its area', () => {
    expect(built.topicIds.length).toBe(162)
    for (const id of built.topicIds) expect(built.depthOf(id), id).toBe(3)
  })

  it('below the units, the 305 CS2023 places some course stops at, under CS2023 ids', () => {
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

  it('every domain stores the ring hue the ring would hand it in area order', () => {
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

  it('no routes yet: the TMU courses arrive as routes in a later card', () => {
    expect(CS2023_WALKS).toEqual([])
  })
})
