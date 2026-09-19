// The region-label fit (SelfNotes: "labels overlap / region text not
// wrapped"). The convex-cell fitLabel is exercised through the atlas driver;
// what needs pinning here is the part that made region names WRONG before:
// a convex chord over a concave region claims room that is not there, and an
// active region name must shrink rather than vanish.

import { describe, expect, test } from 'vitest'

import { fitLabel, fitRegionLabel } from './labelfit'
import { regionChordAt } from './nested'
import type { Territory } from './nested'
import type { XY } from './derive'
import { LabelCut } from '@/ds'

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
