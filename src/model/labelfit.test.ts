// The region-label fit (SelfNotes: "labels overlap / region text not
// wrapped"). The convex-cell fitLabel is exercised through the atlas driver;
// what needs pinning here is the part that made region names WRONG before:
// a convex chord over a concave region claims room that is not there, and an
// active region name must shrink rather than vanish.

import { describe, expect, test } from 'vitest'

import { fitLabel, fitRegionLabel, keepClearOfEarlier, regionLabelBox } from './labelfit'
import type { LabelBox } from './labelfit'
import { regionChordAt } from './nested'
import type { Territory } from './nested'
import type { XY } from './derive'
import { LabelCut } from '@/ds/values'

const rect = (w: number, h: number): XY[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
]

// a U opening upward: two 10-wide arms joined by a base — at y=20 a horizontal
// row crosses BOTH arms, which is exactly where min/max-style chords lie
const U: XY[] = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 30 },
  { x: 20, y: 30 },
  { x: 20, y: 10 },
  { x: 10, y: 10 },
  { x: 10, y: 30 },
  { x: 0, y: 30 },
]

describe('regionChordAt — the honest room a text row has inside a region', () => {
  test('a convex ring behaves like the plain chord', () => {
    expect(regionChordAt([rect(100, 40)], 20, 50)).toEqual([0, 100])
  })

  test('a concave region yields the anchor\'s own interval, never the span across the bite', () => {
    expect(regionChordAt([U], 20, 5)).toEqual([0, 10]) // left arm
    expect(regionChordAt([U], 20, 25)).toEqual([20, 30]) // right arm
  })

  test('an anchor over the bite falls back to a real interval, not the void', () => {
    const c = regionChordAt([U], 20, 15)!
    expect(c[1] - c[0]).toBe(10) // one of the arms — 10 wide, not the 30 span
  })

  test('two disjoint rings pair independently — the anchor picks its ring', () => {
    const twin: XY[][] = [rect(10, 40), rect(10, 40).map((p) => ({ x: p.x + 50, y: p.y }))]
    expect(regionChordAt(twin, 20, 55)).toEqual([50, 60])
  })

  test('a row that misses the region entirely is null', () => {
    expect(regionChordAt([rect(100, 40)], 99, 50)).toBeNull()
  })
})

describe('fitRegionLabel — wrap first, shrink instead of dropping', () => {
  const wide = [rect(100, 40)]

  test('a short name is one line at full size', () => {
    const fit = fitRegionLabel('Security', wide, 50, 20, 10)
    expect(fit.lines).toHaveLength(1)
    expect(fit.shrink).toBe(1)
  })

  test('a long two-word name wraps to two lines before it ever shrinks', () => {
    const fit = fitRegionLabel('Aaaaaaaaaa Bbbbbbbbbb', wide, 50, 20, 10)
    expect(fit.lines.map((l) => l.text)).toEqual(['Aaaaaaaaaa', 'Bbbbbbbbbb'])
    expect(fit.shrink).toBe(1)
  })

  test('no split loses a word — the lines re-join to the title', () => {
    const fit = fitRegionLabel('Core Computer Science', wide, 50, 20, 10)
    expect(fit.lines.map((l) => l.text).join(' ')).toBe('Core Computer Science')
  })

  test('a name too big for its region shrinks to the floor instead of vanishing', () => {
    const tiny = [rect(20, 40)]
    const fit = fitRegionLabel('Aaaaaaaaaa Bbbbbbbbbb', tiny, 10, 20, 10, 0.55)
    expect(fit.lines.length).toBeGreaterThan(0)
    expect(fit.shrink).toBe(0.55)
  })

  test('lines centre on their own chord, not on the region centroid', () => {
    // anchor in the U's left arm: both lines must centre near x=5, inside it
    const fit = fitRegionLabel('Aa Bb', [U], 5, 20, 6)
    for (const l of fit.lines) {
      expect(l.x).toBeGreaterThanOrEqual(0)
      expect(l.x).toBeLessThanOrEqual(10)
    }
  })
})

// #369: with the Explorer rail open, two L0 domain names each fit their own region and still met
// by ~3px, because the fit above looks at ONE name and its own cell. These pin the second gate: the
// box a drawn name occupies, and which of a list of names survive each other. Like the fitLabel
// tests below, they run without a canvas, so widths are `textWidth`'s no-document fallback —
// what is pinned is the relationships (centred, wider for more text, linear in size), not a
// glyph measurement; the browser driver is what proves the box against the rendered face.
describe('regionLabelBox — the box a drawn region name occupies (#369)', () => {
  const line = (x: number, y: number, text: string) => ({ x, y, text })

  test('a name with no lines has no box', () => {
    expect(regionLabelBox([], 12, 800)).toBeNull()
  })

  test('the box is centred on the line (text-anchor: middle) and wider for a longer name', () => {
    const short = regionLabelBox([line(50, 20, 'Sys')], 12, 800)!
    const long = regionLabelBox([line(50, 20, 'Systems Programming')], 12, 800)!
    expect((short.x0 + short.x1) / 2).toBeCloseTo(50)
    expect((long.x0 + long.x1) / 2).toBeCloseTo(50)
    expect(long.x1 - long.x0).toBeGreaterThan(short.x1 - short.x0)
  })

  test('the box grows in step with the font size', () => {
    const small = regionLabelBox([line(50, 20, 'Systems')], 10, 800)!
    const big = regionLabelBox([line(50, 20, 'Systems')], 20, 800)!
    expect(big.x1 - big.x0).toBeCloseTo(2 * (small.x1 - small.x0))
    expect(big.y1 - big.y0).toBeCloseTo(2 * (small.y1 - small.y0))
  })

  test('the baseline sits inside the box, with more of it above than below', () => {
    const b = regionLabelBox([line(50, 20, 'Systems')], 12, 800)!
    expect(b.y0).toBeLessThan(20)
    expect(b.y1).toBeGreaterThan(20)
    expect(20 - b.y0).toBeGreaterThan(b.y1 - 20)
  })

  test('a wrapped name takes the union of its lines — taller than the same name on one line', () => {
    const one = regionLabelBox([line(50, 20, 'Core')], 12, 800)!
    const two = regionLabelBox([line(50, 14, 'Core'), line(50, 28, 'Science')], 12, 800)!
    expect(two.y1 - two.y0).toBeCloseTo(one.y1 - one.y0 + 14)
    expect(two.x1 - two.x0).toBeGreaterThan(one.x1 - one.x0) // the wider second line sets the width
  })
})

describe('keepClearOfEarlier — the later of two colliding names is left out (#369)', () => {
  const box = (x0: number, y0: number, x1: number, y1: number): LabelBox => ({ x0, y0, x1, y1 })

  test('a name that meets an earlier one is dropped; the earlier one stays', () => {
    expect(keepClearOfEarlier([box(0, 0, 10, 10), box(5, 5, 15, 15)])).toEqual([true, false])
  })

  test('names that are all clear of each other all stay', () => {
    expect(keepClearOfEarlier([box(0, 0, 10, 10), box(20, 0, 30, 10), box(0, 20, 10, 30)])).toEqual([true, true, true])
  })

  test('boxes must clear on BOTH axes to stay: sharing a column is not a collision', () => {
    expect(keepClearOfEarlier([box(0, 0, 10, 10), box(2, 20, 12, 30)])).toEqual([true, true])
  })

  test('boxes that only touch along an edge do not meet', () => {
    expect(keepClearOfEarlier([box(0, 0, 10, 10), box(10, 0, 20, 10)])).toEqual([true, true])
  })

  test('a dropped name blocks nobody: a third that met only the dropped one stays', () => {
    // A meets B, B meets C, A and C are clear — B goes, and C has nothing left to collide with
    const a = box(0, 0, 10, 10)
    const b = box(8, 0, 18, 10)
    const c = box(16, 0, 26, 10)
    expect(keepClearOfEarlier([a, b, c])).toEqual([true, false, true])
  })

  test('a name that meets a kept name is dropped whether or not it also meets a dropped one', () => {
    const a = box(0, 0, 10, 10)
    const b = box(5, 0, 15, 10) // meets a — dropped
    const c = box(8, 0, 18, 10) // meets a (kept) and b (dropped) — dropped, because of a
    expect(keepClearOfEarlier([a, b, c])).toEqual([true, false, false])
  })

  test('list order decides which of two colliding names goes', () => {
    const boxes: Record<string, LabelBox> = { sys: box(0, 0, 10, 10), cs: box(6, 4, 16, 14) }
    const kept = (order: string[]) => {
      const keep = keepClearOfEarlier(order.map((n) => boxes[n]!))
      return order.filter((_, i) => keep[i])
    }
    expect(kept(['sys', 'cs'])).toEqual(['sys'])
    expect(kept(['cs', 'sys'])).toEqual(['cs'])
  })

  test('a name with no box has no extent: it is kept and blocks nothing', () => {
    expect(keepClearOfEarlier([null, box(0, 0, 10, 10), null, box(5, 5, 15, 15)])).toEqual([true, true, true, false])
  })

  test('no names, nothing to keep', () => {
    expect(keepClearOfEarlier([])).toEqual([])
  })

  test('two real name boxes: close together the later goes, far apart both stay', () => {
    const at = (x: number) => regionLabelBox([{ x, y: 20, text: 'Systems' }], 12, 800)!
    expect(keepClearOfEarlier([at(0), at(1)])).toEqual([true, false])
    expect(keepClearOfEarlier([at(0), at(500)])).toEqual([true, true])
  })
})

// OB-212: a topic cell went nameless because its width was GUESSED
// (`CHAR_W = 0.58 * length`) rather than measured, over-counting a real name
// by 1.11-1.25x — so a name that fit was dropped outright, with no attempt to
// shrink first the way region names already do. These tests run under
// vitest's `node` environment (see vitest.config.ts), which has no canvas —
// `textWidth`'s no-document fallback (0.55 * fontPx per character, this
// file's own established convention) is what's exercised here, not real
// glyph measurement. That fallback is still a DIFFERENT, smaller ratio than
// the deleted `CHAR_W` estimate, so the shrink-before-giving-up behaviour
// below is real; the browser driver is what proves the numbers against the
// actual rendered face.
const mkTerritory = (w: number, h: number): Territory => ({
  id: 't',
  tier: 2,
  topic: 't',
  d: '',
  cx: w / 2,
  cy: h / 2,
  leaf: false,
  poly: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
})

describe('fitLabel — measured, and shrinks before it gives up (OB-212)', () => {
  const OLD_CHAR_W = 0.58 // the deleted estimate ratio, kept here only for the comparison below
  const FIT = 0.88 // this file's own margin — same number `fitLabel` uses internally

  test('a name the OLD estimate would drop outright now survives by shrinking', () => {
    // one un-splittable word (no spaces — a two-line split cannot rescue it), sized so it
    // overflows a 70-wide room at the ceiling but fits once shrunk part-way to the floor.
    const title = 'Aaaaaaaaaa' // 10 chars
    const t = mkTerritory(70, 40)
    const fs = 12.5
    const room = 70 * FIT

    // the fault, reproduced: the deleted estimate says this never fits, at any size a real
    // cell offers, because it never tried shrinking.
    expect(title.length * fs * OLD_CHAR_W).toBeGreaterThan(room)

    const fit = fitLabel(title, t, fs, false, LabelCut.floorPx)
    expect(fit).not.toBeNull()
    expect(fit!.lines).toHaveLength(1)
    expect(fit!.lines[0]!.text).toBe(title) // shrunk, not clipped — the full name survives
    expect(fit!.fs).toBeLessThan(fs) // it had to give up SOME size to fit
    expect(fit!.fs).toBeGreaterThanOrEqual(LabelCut.floorPx) // but not more than the floor
  })

  test('below the floor, a one-line clip beats dropping the name to nothing', () => {
    const title = 'Aaaaaaaaaa'
    const t = mkTerritory(40, 40) // too small even at the floor size
    const fit = fitLabel(title, t, 12.5, false, LabelCut.floorPx)
    expect(fit).not.toBeNull()
    expect(fit!.fs).toBe(LabelCut.floorPx) // clipToRoom always draws at the floor
    expect(fit!.lines).toHaveLength(1)
    expect(fit!.lines[0]!.text.endsWith('…')).toBe(true)
    expect(fit!.lines[0]!.text.length).toBeGreaterThanOrEqual(LabelCut.minStub + 1) // +1 for the ellipsis
  })

  test('a name with nowhere left to shrink to is dropped, not force-fit into noise', () => {
    // a single-character room can hold no stub at all worth drawing (clipToRoom's own floor)
    const t = mkTerritory(1, 1)
    const fit = fitLabel('Aaaaaaaaaa', t, 12.5, false, LabelCut.floorPx)
    expect(fit).toBeNull()
  })

  test('force=true never drops the name, even where the ordinary path would', () => {
    const t = mkTerritory(1, 1)
    const fit = fitLabel('Aaaaaaaaaa', t, 12.5, true, LabelCut.floorPx)
    expect(fit).not.toBeNull()
    expect(fit!.lines.length).toBeGreaterThan(0)
  })

  test('a name that already fits at the ceiling is not shrunk at all', () => {
    const t = mkTerritory(400, 100)
    const fit = fitLabel('Security', t, 12.5, false, LabelCut.floorPx)
    expect(fit).not.toBeNull()
    expect(fit!.fs).toBe(12.5)
  })
})

describe('LabelCut — the numbers a cell-label fit spends, pinned so no consumer retypes them', () => {
  test('every value is the owner-chosen number, not a re-derivation', () => {
    expect(LabelCut.floorPx).toBe(10)
    expect(LabelCut.shrinkStep).toBe(0.9)
    expect(LabelCut.minStub).toBe(4)
    expect(LabelCut.minWord).toBe(2)
  })
})
