import { describe, expect, it } from 'vitest'
import { HUE_RING, TOPIC_SEPARATION_MIN, topicSlots } from '../ds/graph/DomainDot'
import { domainIds, topicHueOf } from '../corpus/graph'
import { countryRings } from './nested'
import { fillOf, hexToOklch, territoryFillOf, topicTerritoryFills } from './color'
import type { XY } from './derive'

/* OB-171 — the generation-0 shade. The palette's ring wraps at sixteen, so a corpus's 17th
 * top-level topic is handed the 1st topic's hue exactly; on a map two identical fills that SHARE A
 * BORDER read as one region. `topicSlots` (the DS's, adopted here) steps the touching twin one
 * rung down the family ladder — and only the touching twin: a region with no same-hue neighbour
 * keeps slot 0 and its fill does not move, which is what makes the rule safe to adopt.
 *
 * The map draws exactly what `topicTerritoryFills` returns (color.ts feeds `territoryFillOf`
 * from it for the domains), so asserting on its output IS asserting on the render's fill values;
 * a synthetic tessellation is the only way to put seventeen top-level topics in front of it, since
 * the shipped corpus has six. */

/** a square territory, `s` world units on a side, at grid cell (cx, cy) — flush with its
 *  neighbours, so shared edges register as adjacency and nothing else does */
const S = 40
const square = (cx: number, cy: number): XY[][] => [[
  { x: cx * S, y: cy * S }, { x: cx * S + S, y: cy * S }, { x: cx * S + S, y: cy * S + S }, { x: cx * S, y: cy * S + S },
]]

/** today's flat fill for a top-level topic, the same shape color.ts derives — L 0.905, C 0.058 —
 *  so a slot-0 region in these tests draws what a real domain draws */
const RING_DEGREES: Record<string, number> = { rose: 350, brick: 20, clay: 42, amber: 65, honey: 88, olive: 110, lime: 130, leaf: 148, fern: 166, jade: 183, teal: 198, river: 214, cobalt: 236, iris: 262, violet: 292, mallow: 322 }
const flatFor = (hue: string) => oklchHex(0.905, 0.058, RING_DEGREES[hue])
function oklchHex(l: number, c: number, h: number): string {
  /* the same OKLab→sRGB arithmetic color.ts uses, restated so the test does not read the thing
     it measures for its own reference value */
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  const gam = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055)
  const ch = (u: number) => Math.round(255 * Math.min(1, Math.max(0, gam(u)))).toString(16).padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(bl)}`
}
const lab = (hex: string) => { const { l, c, h } = hexToOklch(hex); return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)] }
const deltaE = (a: string, b: string) => { const p = lab(a); const q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }

/** N top-level topics, hues handed out round the ring so topic 17 (index 16) repeats topic 1's.
 *  `place` says where each goes on the grid. */
function corpus(n: number, place: (i: number) => [number, number]) {
  const ids = Array.from({ length: n }, (_, i) => 't' + i)
  const hue = new Map(ids.map((id, i) => [id, HUE_RING[i % 16]]))
  const regions = ids.map((id, i) => ({ id, rings: square(...place(i)) }))
  return { ids, regions, hueOf: (id: string) => hue.get(id) ?? null, flat: (id: string) => flatFor(hue.get(id)!) }
}
/** sixteen in a row on y=0; the rest on y=1 under the SAME column index, so t16 sits under t0 */
const twinsTouch = (i: number): [number, number] => (i < 16 ? [i, 0] : [i - 16, 1])
/** everything in one row: t16 is fifteen cells away from t0 */
const twinsApart = (i: number): [number, number] => [i, 0]

describe('OB-171 — the generation-0 shade, adopted from the DS', () => {
  it('(3) the shipped corpus, six domains: every top-level fill is pixel-identical to the flat fill, all slots zero', () => {
    const out = topicTerritoryFills(domainIds.map((d) => ({ id: d, rings: countryRings[d] })), (d) => topicHueOf(d) ?? null, (d) => fillOf(d))
    expect([...out.values()].map((v) => v.slot)).toEqual(domainIds.map(() => 0))
    for (const d of domainIds) expect(territoryFillOf(d), d).toBe(fillOf(d))
  })

  it('(3) sixteen topics or fewer: all zeros, nothing moves — even when neighbours abound', () => {
    const c = corpus(16, (i) => [i % 4, Math.floor(i / 4)])
    const out = topicTerritoryFills(c.regions, c.hueOf, c.flat)
    for (const id of c.ids) {
      expect(out.get(id)!.slot, id).toBe(0)
      expect(out.get(id)!.fill, id).toBe(c.flat(id))
    }
  })

  it('(3) seventeen topics whose twins do NOT touch: all zeros, nothing moves', () => {
    const c = corpus(17, twinsApart)
    const out = topicTerritoryFills(c.regions, c.hueOf, c.flat)
    for (const id of c.ids) expect(out.get(id)!.fill, id).toBe(c.flat(id))
  })

  it('(2) seventeen topics with the two same-hue territories SHARING A BORDER: different shades', () => {
    const c = corpus(17, twinsTouch)
    const out = topicTerritoryFills(c.regions, c.hueOf, c.flat)
    expect(c.hueOf('t0')).toBe(c.hueOf('t16'))
    expect(out.get('t0')!.fill).not.toBe(out.get('t16')!.fill)
    /* and ONLY the twin moved: every other territory keeps today's flat fill */
    for (const id of c.ids) if (id !== 't16') expect(out.get(id)!.fill, id).toBe(c.flat(id))
  })

  it('(6) the twin moves by ONE rung: a touching pair comes back [0, 1], separated by 0.045 … 0.10 in OKLab', () => {
    const c = corpus(17, twinsTouch)
    const out = topicTerritoryFills(c.regions, c.hueOf, c.flat)
    expect([out.get('t0')!.slot, out.get('t16')!.slot]).toEqual([0, 1])
    const sep = deltaE(out.get('t0')!.fill, out.get('t16')!.fill)
    expect(sep).toBeGreaterThanOrEqual(TOPIC_SEPARATION_MIN)
    expect(sep).toBeLessThan(0.10)
    /* the same answer straight from the slot rule, on a bare two-region pair */
    expect(topicSlots([[1], [0]], { hue: ['rose', 'rose'] })).toEqual([0, 1])
    /* and the rule the DS warned against — the furthest free slot — is NOT what shipped */
    expect(topicSlots([[1], [0]], { hue: ['rose', 'rose'] })).not.toEqual([0, 4])
  })

  it('(1) adjacency comes from the geometry, not from any order: a twin placed far away on the same row is untouched', () => {
    /* t16 well away from the row: flush with nothing, so it has no neighbour at all */
    const c = corpus(17, (i) => (i < 16 ? [i, 0] : [20, 5]))
    const out = topicTerritoryFills(c.regions, c.hueOf, c.flat)
    expect(out.get('t16')!.slot).toBe(0)
  })
})
