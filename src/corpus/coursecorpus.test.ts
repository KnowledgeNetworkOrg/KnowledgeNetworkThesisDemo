// THE COURSE CORPUS, CHECKED WHETHER OR NOT IT IS THE ONE LOADED.
//
// `coursedata.ts` is generated, and a generated file is exactly the kind that
// rots unnoticed: nothing imports it on a default build, so a bad regeneration
// would sit in the repo until someone ran the app with `VITE_CORPUS=courses` and
// saw a blank screen. This file imports it DIRECTLY — not through `graph.ts` —
// so `npm run verify` builds and checks it every time, on the default corpus.
//
// What it asserts is the promise the dataset makes about itself: that it is real
// university data, that the parts which are NOT the university's are visibly
// marked, and that nothing in it was invented to make the graph look fuller.

import { describe, expect, it } from 'vitest'

import { buildCorpus } from './corpusbuild'
import { COURSE_DOC } from './coursedocs'
import { COURSES } from './coursedata'
import { COURSE_WALKS } from './coursewalks'
import { ROOT_ID } from './graphshape'

const built = buildCorpus({ ...COURSES, nodes: COURSES.nodes.map((n) => ({ ...n })) }, ROOT_ID)
const courses = built.topicIds

describe('the course corpus builds at all', () => {
  it('every structural rule the builder enforces holds — it would have thrown otherwise', () => {
    expect(courses.length).toBeGreaterThan(30)
    expect(built.domainIds.length).toBe(7)
    expect(built.edges.length).toBeGreaterThan(30)
  })

  it('a course is the edge-bearing level: every edge runs course to course', () => {
    for (const e of built.edges) {
      expect(courses, `${e.source} is an endpoint but not a course`).toContain(e.source)
      expect(courses, `${e.target} is an endpoint but not a course`).toContain(e.target)
    }
  })

  it('every top-level subject area carries a stored ring hue, so the map can colour it', () => {
    for (const id of built.domainIds) expect(built.byId.get(id)?.hue, id).toBeTruthy()
  })
})

describe('what the university published, and what it did not', () => {
  it('ONLY builds-on edges exist — a course calendar publishes no other relation', () => {
    // If this ever fails, someone has authored a relation the university does not
    // state. That is allowed, but it stops being a dataset and starts being an
    // opinion, and the thesis claim about this corpus has to change with it.
    for (const e of built.edges) expect(e.type, `${e.source} -> ${e.target}`).toBe('depends_on')
  })

  it('the prerequisite graph has no cycles — a degree you could not start', () => {
    const out = new Map<string, string[]>()
    for (const e of built.edges) out.set(e.source, [...(out.get(e.source) ?? []), e.target])
    const state = new Map<string, number>() // 1 = on the stack, 2 = done
    const cycles: string[] = []
    const walk = (id: string, trail: string[]) => {
      if (state.get(id) === 2) return
      if (state.get(id) === 1) return void cycles.push([...trail, id].join(' -> '))
      state.set(id, 1)
      for (const n of out.get(id) ?? []) walk(n, [...trail, id])
      state.set(id, 2)
    }
    for (const c of courses) walk(c, [])
    expect(cycles).toEqual([])
  })

  it('every course has a document body, and a course with nothing under it says so', () => {
    for (const c of courses) {
      const body = COURSE_DOC[c]
      expect(body, `${c} has no document body`).toBeTruthy()
      const childless = (built.childrenOf.get(c) ?? []).length === 0
      // a course the map cannot open must explain the absence rather than look empty
      if (childless) expect(body, c).toMatch(/NO COURSE OUTLINE WAS COLLECTED|publishes no topic breakdown/)
    }
  })

  it('the authored grouping is declared as authored, on every subject area', () => {
    // The seven subject areas are the one piece of structure the university does
    // not publish. Every area's own body has to admit that where a reader is.
    for (const id of built.domainIds) expect(COURSE_DOC[id], id).toMatch(/does not publish/)
  })
})

describe('the walks are routes a student could actually take', () => {
  it('every stop is a real course in this corpus', () => {
    for (const w of COURSE_WALKS) {
      expect(w.stops.length, w.id).toBeGreaterThan(0)
      for (const s of w.stops) expect(courses, `walk "${w.id}" stops on ${s.id}`).toContain(s.id)
    }
  })

  it('and every stop carries a note — a route with no reading is not a walk', () => {
    for (const w of COURSE_WALKS) for (const s of w.stops) expect(s.note.length, `${w.id} / ${s.id}`).toBeGreaterThan(10)
  })
})
