// The selection overlay. Until this derivation was lifted out of the component
// (2026-07-14) its invariant could only be checked by querying the rendered DOM
// in the screenshot driver, on the two selections that driver happens to make.
// It is a pure function, so ask it about every node in the corpus instead.

import { describe, expect, test } from 'vitest'

import { byId, domainIds, domainOf, edges, nodes, pathTo, topicIds, topicsUnder } from '../corpus/graph'
import { provinceIds, provinceOf, topicAnchorOf } from './flat'
import { countryPath, maxTier, pointInPoly, territories } from './nested'
import { fitLabel, labelBox } from './labelfit'
import { cellPolyOf, endpointAtTier, flightTargetOf, outlineOf, pinSpotClear, roadsFor, tierOf, walkAnchorAt } from './atlas'

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** every id a user can actually click on the map, at any level */
const SELECTABLE = [...domainIds, ...provinceIds, ...topicIds]

describe('ONE ROAD PER PAIR — the map draws a road, not a bundle of curves', () => {
  test('no unordered pair is ever drawn twice, for any selection in the corpus', () => {
    // This is the assertion browsertest-mapconnections.mjs makes by splitting data-seledge
    // attributes out of the DOM, on exactly two selections. Here it runs on all
    // 75 selectable regions — including every reciprocal pair, which is the case
    // that regresses (A→B and B→A drawn as two bowed arrows past each other).
    for (const sel of SELECTABLE) {
      const { bundles } = roadsFor(sel)
      const keys = bundles.map((b) => pairKey(b.src, b.tgt))
      expect(new Set(keys).size, `${sel} drew a pair twice`).toBe(keys.length)
    }
  })

  test('collapsing loses no traffic — bundle counts sum to arrow counts', () => {
    for (const sel of SELECTABLE) {
      const { arrows, bundles } = roadsFor(sel)
      const drawn = bundles.reduce((s, b) => s + b.n, 0)
      const raw = arrows.reduce((s, a) => s + a.n, 0)
      expect(drawn, `${sel} lost links in the collapse`).toBe(raw)
    }
  })

  test('a bundle is two-way exactly when the pair really is reciprocal', () => {
    // dir: 'both' suppresses the arrowhead. Getting this wrong either draws a
    // one-way arrow on a two-way road (a lie) or drops the head off a one-way
    // road (an omission), and both look plausible on screen.
    for (const sel of SELECTABLE) {
      const { arrows, bundles } = roadsFor(sel)
      for (const b of bundles) {
        const mine = arrows.filter((a) => pairKey(a.src, a.tgt) === pairKey(b.src, b.tgt))
        const dirs = new Set(mine.map((a) => `${a.src}>${a.tgt}`))
        expect(b.dir, `${sel}: ${b.key}`).toBe(dirs.size > 1 ? 'both' : 'fwd')
      }
    }
  })

  test("type is null exactly when the bundle mixes types — that's what draws it slate", () => {
    for (const sel of SELECTABLE) {
      const { arrows, bundles } = roadsFor(sel)
      for (const b of bundles) {
        const mine = arrows.filter((a) => pairKey(a.src, a.tgt) === pairKey(b.src, b.tgt))
        const kinds = new Set(mine.map((a) => a.type))
        expect(b.type === null, `${sel}: ${b.key} carries ${[...kinds].join('+')}`).toBe(kinds.size > 1)
        if (kinds.size === 1) expect(b.type).toBe([...kinds][0])
      }
    }
  })

  test('no road ever runs from a cell to itself', () => {
    for (const sel of SELECTABLE) {
      for (const b of roadsFor(sel).bundles) expect(b.src, sel).not.toBe(b.tgt)
    }
  })
})

describe('rolling up to a coarser grain', () => {
  test('a region selection drops the edges INTERNAL to it', () => {
    // The whole point of the roll-up: a domain's own internal wiring is its
    // children's business. Drawing it across the region would be drawing a
    // relationship the map is not currently showing the endpoints of.
    for (const d of domainIds) {
      const inside = new Set(topicsUnder(d))
      const internal = edges.filter((e) => inside.has(e.source) && inside.has(e.target))
      expect(internal.length, `${d} has no internal edges to test with`).toBeGreaterThan(0)

      const { arrows } = roadsFor(d)
      const carried = arrows.reduce((s, a) => s + a.n, 0)
      const crossing = edges.filter((e) => inside.has(e.source) !== inside.has(e.target))
      expect(carried, `${d} rolled up the wrong number of edges`).toBe(crossing.length)
      // and every road it drew touches the selected region itself
      for (const a of arrows) expect(a.src === d || a.tgt === d, `${d} drew a road it is not on`).toBe(true)
    }
  })

  test('a region selection draws region↔region roads, never topic ones', () => {
    for (const d of domainIds) {
      for (const a of roadsFor(d).arrows) {
        expect(domainIds, `${a.src}`).toContain(a.src)
        expect(domainIds, `${a.tgt}`).toContain(a.tgt)
      }
    }
    for (const m of provinceIds) {
      for (const a of roadsFor(m).arrows) {
        expect(provinceIds, `${a.src}`).toContain(a.src)
        expect(provinceIds, `${a.tgt}`).toContain(a.tgt)
      }
    }
  })

  test('a topic selection keeps its edges RAW — one arrow per link', () => {
    for (const t of topicIds) {
      const { tier, arrows } = roadsFor(t)
      expect(tier).toBe(2)
      const touching = edges.filter((e) => e.source === t || e.target === t)
      expect(arrows.length, t).toBe(touching.length)
      for (const a of arrows) expect(a.n).toBe(1)
    }
  })

  test('a DEEP node draws NO roads — the map refuses the lift, like the pane', () => {
    // A concept below a topic has no edges of its own (the corpus forbids
    // them). Until 2026-07-17 the overlay borrowed the owning topic's roads
    // here — the map-side twin of the pane's retired "via" lift — which kept
    // the parent's arrows on screen for every relation-less child. Now the
    // selection tint is all a deep cell gets; the topic's roads belong to the
    // topic's selection.
    const deep = nodes.filter((n) => !n.topic && topicsUnder(n.id).length === 0 && n.parentId).slice(0, 40)
    expect(deep.length).toBeGreaterThan(0)
    for (const d of deep) {
      const r = roadsFor(d.id)
      expect(r.arrows, `${d.id} borrowed arrows`).toEqual([])
      expect(r.bundles, `${d.id} borrowed bundles`).toEqual([])
      expect(r.tier, d.id).toBe(2) // still a real tier — the chip reads it
    }
  })
})

describe('the empty and impossible cases', () => {
  test('no selection means no roads', () => {
    expect(roadsFor(null)).toEqual({ tier: -1, arrows: [], bundles: [] })
  })

  test('an unknown id means no roads, not a crash', () => {
    expect(roadsFor('not-a-node').bundles).toEqual([])
  })
})

describe('outlineOf and tierOf — one question, one answer', () => {
  test('every clickable region has an outline to draw', () => {
    // the selection, the hover preselect and the cross-pane spotlight all call
    // this; an undefined outline is an invisible selection
    for (const id of SELECTABLE) expect(outlineOf(id), id).toBeDefined()
  })

  test('tierOf agrees with the corpus about what kind of thing an id is', () => {
    for (const d of domainIds) expect(tierOf(d), d).toBe(0)
    for (const m of provinceIds) expect(tierOf(m), m).toBe(1)
    for (const t of topicIds) expect(tierOf(t), t).toBe(2)
  })

  test('OB-193: the root IS a region now — its own outline, at its own level', () => {
    // the owner's ruling (2026-09-15): the corpus root is a node like any other, drawn as ONE
    // region at the map's new level -1 — so it has an outline now, distinct from every
    // domain's/province's/territory's own (rootPath, not countryPath/provincePath/a territory)
    expect(outlineOf('root')).toBeDefined()
    expect(outlineOf('root')).not.toBe(countryPath[domainIds[0]])
    expect(byId.get('root')!.parentId).toBeNull()
  })
})

describe('endpointAtTier — the road a hovered counterpart lights (item 3)', () => {
  test('every bundle endpoint is idempotent under the lift at its own grain', () => {
    // this IS the feature: hovering a counterpart cell must resolve to itself,
    // or the road drawn to it would never light. Checked on every road the
    // corpus can draw, at every grain, not the two the driver happens to hover.
    for (const sel of SELECTABLE) {
      const { tier, bundles } = roadsFor(sel)
      for (const b of bundles) {
        expect(endpointAtTier(b.src, tier), `${sel}:${b.src}`).toBe(b.src)
        expect(endpointAtTier(b.tgt, tier), `${sel}:${b.tgt}`).toBe(b.tgt)
      }
    }
  })

  test('a topic lifts to itself at topic grain, to its region when rolled up', () => {
    // a relationship row publishes a TOPIC id; at a domain/module selection that
    // topic must lift to the region whose road is actually on screen
    for (const t of topicIds) {
      expect(endpointAtTier(t, 2), t).toBe(t)
      expect(endpointAtTier(t, 1), t).toBe(provinceOf(t))
      expect(endpointAtTier(t, 0), t).toBe(domainOf(t))
    }
  })

  test('a deep node lifts through its owning topic — the "via" a hover follows', () => {
    const deep = nodes.filter((n) => !n.topic && n.parentId && topicsUnder(n.id).length === 0).slice(0, 30)
    for (const d of deep) {
      const owner = topicAnchorOf(d.id)
      expect(endpointAtTier(d.id, 2), d.id).toBe(owner)
      expect(endpointAtTier(d.id, 0), d.id).toBe(domainOf(owner))
    }
  })
})

describe('flightTargetOf — where the peek flies the camera', () => {
  test('every selectable node has a target, at its own grain', () => {
    for (const id of SELECTABLE) {
      const t = flightTargetOf(id)!
      expect(t, id).not.toBeNull()
      expect(t.tier, id).toBe(domainIds.includes(id) ? 0 : provinceIds.includes(id) ? 1 : 2)
      expect(Number.isFinite(t.c.x) && Number.isFinite(t.c.y), id).toBe(true)
    }
  })

  test('a deep node flies to a real territory; an unknown id flies nowhere', () => {
    const deep = nodes.filter((n) => !n.topic && n.parentId && topicsUnder(n.id).length === 0).slice(0, 30)
    for (const d of deep) {
      const t = flightTargetOf(d.id)
      expect(t, d.id).not.toBeNull()
      expect(t!.tier, d.id).toBeGreaterThanOrEqual(2)
    }
    expect(flightTargetOf('no-such-node')).toBeNull()
  })
})

describe('walkAnchorAt — where a walk stop sits at each level (OB-109)', () => {
  test('EVERY selectable node anchors somewhere at EVERY level — the regression itself', () => {
    // The bug, in two halves, both silent. `pathTo(id)[level + 1]` returns
    // undefined once the level is deeper than the stop (so from L3 down every
    // stop in a walk of tier-2 topics resolved to nothing and the walk left the
    // map), and it lands on a cell-less container whenever containment depth
    // runs ahead of cell tier (so `auto-continuous-integration` was already
    // missing at L2). One assertion over the whole corpus and the whole level
    // range is what makes both unrepeatable.
    for (const id of SELECTABLE) {
      for (let level = 0; level <= maxTier; level++) {
        const a = walkAnchorAt(id, level)
        expect(a, `${id} @ L${level}`).not.toBeNull()
        expect(Number.isFinite(a!.c.x) && Number.isFinite(a!.c.y), `${id} @ L${level}`).toBe(true)
      }
    }
  })

  test('the anchor is always an ancestor-or-self that owns a cell at or above the level', () => {
    for (const id of SELECTABLE) {
      const chain = pathTo(id)
      for (let level = 0; level <= maxTier; level++) {
        const a = walkAnchorAt(id, level)!
        expect(chain, `${id} @ L${level}`).toContain(a.visId)
        expect(flightTargetOf(a.visId)!.tier, `${id} @ L${level}`).toBeLessThanOrEqual(level)
      }
    }
  })

  test('it takes the DEEPEST such ancestor, never a coarser one that would also fit', () => {
    for (const id of SELECTABLE) {
      const chain = pathTo(id)
      for (let level = 0; level <= maxTier; level++) {
        const a = walkAnchorAt(id, level)!
        // nothing below the chosen link may also have qualified
        for (let k = chain.indexOf(a.visId) + 1; k < chain.length; k++) {
          const ft = flightTargetOf(chain[k])
          expect(ft === null || ft.tier > level, `${id} @ L${level}: ${chain[k]} also fit`).toBe(true)
        }
      }
    }
  })

  test('deeper than the level: rolls UP, and skips a container that owns no cell', () => {
    // `auto` is exactly that container — 4 deep, no territory of its own, which
    // is what the old index-based lookup landed on and died to.
    const deep = 'auto-continuous-integration'
    expect(pathTo(deep)).toContain('auto')
    expect(flightTargetOf('auto')).toBeNull()
    expect(walkAnchorAt(deep, 0)!.visId).toBe('se')
    expect(walkAnchorAt(deep, 1)!.visId).toBe('tool')
    expect(walkAnchorAt(deep, 2)!.visId).toBe(deep)
  })

  test('shallower than the level: CLAMPS to the stop itself, and stops moving', () => {
    for (const id of topicIds.slice(0, 40)) {
      const own = flightTargetOf(id)!.tier
      const self = walkAnchorAt(id, own)!
      expect(self.visId, id).toBe(id)
      for (let level = own + 1; level <= maxTier; level++) {
        const a = walkAnchorAt(id, level)!
        expect(a.visId, `${id} @ L${level}`).toBe(id)
        expect(a.c, `${id} @ L${level}`).toEqual(self.c)
      }
    }
  })

  test('an id the map has never heard of anchors nowhere', () => {
    expect(walkAnchorAt('no-such-node', 0)).toBeNull()
    expect(walkAnchorAt('no-such-node', maxTier)).toBeNull()
  })
})

describe('pinSpotClear — a walk pin must not sit on its own territory name (OB-108)', () => {
  /** the real thing this exists for: every tier-2 territory whose name actually
   *  fits inside it, at the font size the map draws at L2. Not a fixture — if
   *  the corpus or the fitter changes, this changes with it. */
  const cases = territories
    .filter((t) => t.tier === 2)
    .map((t) => ({ t, lines: fitLabel(byId.get(t.id)!.title, t, 12.5, false) }))
    .filter((c) => c.lines !== null)
    .map((c) => ({ ...c, box: labelBox(c.lines!, 12.5)! }))

  test('the corpus actually exercises this — most centres START on the name', () => {
    // If this ever drops to nothing, every assertion below passes vacuously.
    const onTheName = cases.filter(
      (c) => c.t.cx >= c.box.x0 && c.t.cx <= c.box.x1 && c.t.cy >= c.box.y0 && c.t.cy <= c.box.y1,
    )
    expect(cases.length).toBeGreaterThan(20)
    expect(onTheName.length / cases.length).toBeGreaterThan(0.5)
  })

  test('the pin ends up clear of the name, or honestly gives up where it cannot', () => {
    let moved = 0
    let gaveUp = 0
    for (const { t, box } of cases) {
      const from = { x: t.cx, y: t.cy }
      const r = 3 // a small pin in world units at this scale
      const p = pinSpotClear(from, t.poly, [box], r)
      const hits =
        p.x >= box.x0 - r && p.x <= box.x1 + r && p.y >= box.y0 - r && p.y <= box.y1 + r
      if (p.x !== from.x || p.y !== from.y) {
        moved++
        // a pin that moved must be clear AND still inside its own cell — a pin
        // outside its territory would be a worse lie than one over a word
        expect(hits, `${t.id} moved but still on the label`).toBe(false)
        expect(pointInPoly(p, t.poly), `${t.id} moved outside its own cell`).toBe(true)
      } else if (hits) {
        gaveUp++ // no candidate fit: the cell is smaller than its name plus a pin
      }
    }
    expect(moved, 'nothing moved — the search is not running').toBeGreaterThan(10)
    // giving up is allowed, but it must be the exception, not the mechanism
    expect(gaveUp).toBeLessThan(cases.length / 2)
  })

  test('a pin already clear of the name is left exactly where it was', () => {
    const { t, box } = cases[0]
    const far = { x: box.x1 + 500, y: box.y1 + 500 }
    expect(pinSpotClear(far, t.poly, [box], 3)).toBe(far)
  })

  test('it clears a NEIGHBOUR’s label too, not only the cell’s own', () => {
    // The deep-zoom case, and the reason this takes a list. Past the level where
    // a stop owns a cell, its own name is not drawn at all and the ground under
    // its pin belongs to its children. A per-id check sees nothing to avoid; the
    // pin still lands on a word.
    const { t } = cases[0]
    const at = { x: t.cx, y: t.cy }
    const foreign = { x0: at.x - 40, y0: at.y - 6, x1: at.x + 40, y1: at.y + 6 }
    const moved = pinSpotClear(at, t.poly, [foreign], 3)
    expect(moved, 'a foreign label was ignored').not.toBe(at)
    const hits =
      moved.x >= foreign.x0 - 3 && moved.x <= foreign.x1 + 3 && moved.y >= foreign.y0 - 3 && moved.y <= foreign.y1 + 3
    expect(hits, 'moved but still on the foreign label').toBe(false)
    expect(pointInPoly(moved, t.poly), 'left its own cell to dodge a neighbour').toBe(true)
  })

  test('several labels at once: the pin clears every one of them', () => {
    const { t, box } = cases[0]
    const at = { x: t.cx, y: t.cy }
    const second = { x0: box.x0, y0: box.y0 + 14, x1: box.x1, y1: box.y1 + 14 }
    const p = pinSpotClear(at, t.poly, [box, second], 3)
    for (const b of [box, second]) {
      const hits = p.x >= b.x0 - 3 && p.x <= b.x1 + 3 && p.y >= b.y0 - 3 && p.y <= b.y1 + 3
      expect(hits, 'still on one of the two labels').toBe(false)
    }
  })

  test('no polygon or no labels means no opinion', () => {
    const { t, box } = cases[0]
    const at = { x: t.cx, y: t.cy }
    expect(pinSpotClear(at, null, [box], 3)).toBe(at)
    expect(pinSpotClear(at, t.poly, [], 3)).toBe(at)
  })

  test('cellPolyOf finds a cell for a territory and a ring for a region', () => {
    const t = territories.find((x) => x.tier === 2)!
    expect(cellPolyOf(t.id, { x: t.cx, y: t.cy })).toBe(t.poly)
    for (const d of domainIds) {
      const ring = cellPolyOf(d, { x: 0, y: 0 })
      expect(ring, d).not.toBeNull()
      expect(ring!.length, d).toBeGreaterThan(2)
    }
    expect(cellPolyOf('no-such-node', { x: 0, y: 0 })).toBeNull()
  })
})
