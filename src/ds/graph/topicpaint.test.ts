// `topicPaintValues()` agrees with the ring tokens it resolves (OB-153, 2026-09-14).
//
// A topic's colour reaches SVG `fill`/`stroke` PRESENTATION ATTRIBUTES on the map, the
// neighbourhood wheel and the unfold views, where a `var()` computes to `none` and the shape
// renders black (receipts/9fbc05a.md). So the app resolves the value in JS — and a hand-kept
// copy of sixteen hues in five roles is exactly the thing that goes stale unnoticed. Same
// discipline as edgecolor.test.ts: the token file is READ and every role of every hue compared.
// A node program (tsconfig.node.json), like that test; it imports only the plain module.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { nestedFamilyPaint, topicPaint } from './hueslots'
import { GHOST_C, GHOST_L, HUE_DEGREES, topicPaintValues } from './topicvalues'

const TOKENS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tokens')
const css = readFileSync(join(TOKENS, 'colors.css'), 'utf8')

/** every `--name: oklch(L C H);` in the stylesheet */
function oklchTokens(): Map<string, { l: number; c: number; h: number }> {
  const out = new Map<string, { l: number; c: number; h: number }>()
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*oklch\(([\d.]+)\s+([\d.]+)\s+(-?[\d.]+)\)\s*;/gim)) {
    out.set(m[1], { l: Number(m[2]), c: Number(m[3]), h: Number(m[4]) })
  }
  return out
}

describe('topicPaintValues — the JS-resolved twin of topicPaint, pinned to tokens/colors.css', () => {
  const tokens = oklchTokens()
  const hues = Object.keys(HUE_DEGREES)
  const roles = [['mark', ''], ['ink', '-ink'], ['stroke', '-stroke'], ['wash', '-wash'], ['washRaised', '-wash-raised']] as const

  it('read a non-empty token file with all sixteen ring hues in it, and no seventeenth', () => {
    expect(tokens.size).toBeGreaterThan(80)
    expect(hues).toHaveLength(16)
    for (const hue of hues) expect(tokens.has(`--hue-${hue}`), hue).toBe(true)
    const inTokens = [...tokens.keys()].filter((k) => /^--hue-[a-z]+$/.test(k)).map((k) => k.slice(6))
    expect(inTokens.sort()).toEqual([...hues].sort())
  })

  it('every role of every hue equals its token, L, C and H — 80 values', () => {
    let checked = 0
    for (const hue of hues) {
      const v = topicPaintValues(hue)
      expect(v.hue).toBe(hue)
      for (const [field, suffix] of roles) {
        const tok = tokens.get(`--hue-${hue}${suffix}`)!
        expect(tok, `--hue-${hue}${suffix}`).toBeDefined()
        const got = v[field]
        expect(got.l, `${hue} ${field} L`).toBeCloseTo(tok.l, 3)
        expect(got.c, `${hue} ${field} C`).toBeCloseTo(tok.c, 3)
        expect(got.h, `${hue} ${field} H`).toBeCloseTo(tok.h, 3)
        expect(got.css).toBe(`oklch(${tok.l} ${tok.c} ${tok.h})`)
        checked++
      }
      expect(v.deg).toBe(tokens.get(`--hue-${hue}`)!.h)
    }
    expect(checked).toBe(80)
  })

  it('an unknown or absent topic resolves to the anchor fallback, never to nothing', () => {
    for (const t of [undefined, null, 'sys', 'not-a-hue', 'toString']) {
      const v = topicPaintValues(t)
      expect(v.hue).toBeNull()
      expect(v.deg).toBeNull()
      expect(v.mark.css).toMatch(/^oklch\(/)
    }
  })
})

// THE GHOST ROLE (OB-223, 2026-09-18) — one OPAQUE tone per hue for a group's name written across its
// children. It is a resolved oklch() and not a token, on purpose (sixteen per-hue tokens would be
// sixteen tokens for one role), so no stylesheet says what it is and these are the value guards: what
// it must be, and that the two twins that hand it out cannot disagree.
describe('topicPaint().ghost — one opaque tone per hue', () => {
  const hues = Object.keys(HUE_DEGREES)

  it('is oklch(0.640 0.110 <the ring degree>) for every hue — the DS\'s own string, character for character', () => {
    expect(GHOST_L).toBe(0.64)
    expect(GHOST_C).toBe(0.11)
    for (const hue of hues) {
      expect(topicPaint(hue).ghost, hue).toBe(`oklch(0.640 0.110 ${HUE_DEGREES[hue].toFixed(1)})`)
    }
  })

  it('is OPAQUE — no alpha channel anywhere in it, because compositing through a fill is the fault', () => {
    for (const hue of hues) {
      const g = topicPaint(hue).ghost
      expect(g, hue).toMatch(/^oklch\([\d. ]+\)$/)
      expect(g, hue).not.toContain('/')
    }
  })

  it('sits one tone BELOW the family-fill band, so it stays visible over the lightest child and never goes darker than the darkest', () => {
    // slot 4 is the darkest rung of `nestedFamilyPaint`'s ladder: L 0.720
    const darkest = Number(/^oklch\(([\d.]+)/.exec(nestedFamilyPaint('teal', { slot: 4 }).fill)![1])
    expect(darkest).toBeCloseTo(0.72, 3)
    expect(GHOST_L).toBeLessThan(darkest)
  })

  it('the JS-resolved twin hands out the same value the token twin does, hue for hue', () => {
    for (const hue of hues) {
      const v = topicPaintValues(hue).ghost
      expect(v.css, hue).toBe(topicPaint(hue).ghost)
      expect([v.l, v.c, v.h], hue).toEqual([GHOST_L, GHOST_C, HUE_DEGREES[hue]])
    }
  })

  it('an unknown topic gets the anchor fallback in both twins, never nothing', () => {
    expect(topicPaint('not-a-hue').ghost).toBe('var(--swatch-anchor-fallback)')
    expect(topicPaint(null).ghost).toBe('var(--swatch-anchor-fallback)')
    expect(topicPaintValues('not-a-hue').ghost.css).toMatch(/^oklch\(/)
  })
})
