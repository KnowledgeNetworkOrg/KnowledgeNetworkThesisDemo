import { describe, expect, it } from 'vitest'
import { familySlots } from '@/ds/values'
import { domainIds, topicHueOf } from '../corpus/graph'
import { provinceRings, territories } from './nested'
import { familyOf, hexToOklch, inkOf, labelInkOf, territoryFillOf, territoryNeighboursOf, territorySlotOf } from './color'

/* OB-119 (#250) — the map's territory fill, re-measured the way the item asks: every fill's
 * nearest ring stop IS its own family's hue; no two touching regions of one family share a slot;
 * the adjacent-pair ΔE table from receipts/8a96805.md re-run (min / median / count under 0.020,
 * printed for the receipt); and labelInkOf still clears 4.5:1 on every label on the new, darker
 * fills. The ring's degrees are restated here on purpose — the DS keeps its table private and
 * says not to read it for anything but the shift arithmetic; a test that pins the rule against
 * the tokens' own angles is exactly the second reader that should not depend on it. */

const RING_DEGREES: Record<string, number> = { rose: 350, brick: 20, clay: 42, amber: 65, honey: 88, olive: 110, lime: 130, leaf: 148, fern: 166, jade: 183, teal: 198, river: 214, cobalt: 236, iris: 262, violet: 292, mallow: 322 }

const circ = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
const nearestStop = (hue: number) => Object.entries(RING_DEGREES).sort((a, b) => circ(a[1], hue) - circ(b[1], hue))[0][0]

/** every region the map paints as a country at some level: the provinces and every tier */
const regions = [...Object.keys(provinceRings), ...territories.map((t) => t.id)]
const domains = new Set<string>(domainIds)

const lab = (hex: string) => {
  const { l, c, h } = hexToOklch(hex)
  return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
}
const deltaE = (a: string, b: string) => { const p = lab(a); const q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }

/** WCAG contrast, the same arithmetic color.ts uses, restated so the test cannot pass by
 *  reading the thing it checks */
const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4))
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255) }
const contrast = (a: string, b: string) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

describe('OB-119 — the territory fill is pinned to its family', () => {
  it('measures a real map: hundreds of regions in six families', () => {
    expect(regions.length).toBeGreaterThan(500)
    expect(new Set(regions.map((id) => familyOf(id))).size).toBe(6)
  })

  it('(1) every fill\'s nearest ring stop is its own lineage hue — no exceptions', () => {
    const wrong: string[] = []
    for (const id of regions) {
      const family = familyOf(id)!
      const own = topicHueOf(family)!
      const stop = nearestStop(hexToOklch(territoryFillOf(id)).h)
      if (stop !== own) wrong.push(`${id}: ${stop} not ${own}`)
      expect(circ(hexToOklch(territoryFillOf(id)).h, RING_DEGREES[own])).toBeLessThanOrEqual(6.5)
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  it('(2) the assignment is adjacency-safe inside each family, over five slots', () => {
    const slots = new Set<number>()
    for (const id of regions) {
      const k = territorySlotOf(id)!
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(5)
      slots.add(k)
      for (const nb of territoryNeighboursOf(id)) {
        if (familyOf(nb) !== familyOf(id)) continue
        expect(territorySlotOf(nb), `${id} and ${nb} touch and share slot ${k}`).not.toBe(k)
      }
    }
    expect(slots.size).toBeLessThanOrEqual(5)
  })

  it('domains keep their own fill; the depth term is gone (same slot → same fill at any depth)', () => {
    for (const d of domainIds) expect(territorySlotOf(d)).toBeNull()
    const byKey = new Map<string, Set<string>>()
    for (const id of regions) {
      const key = familyOf(id) + ':' + territorySlotOf(id)
      if (!byKey.has(key)) byKey.set(key, new Set())
      byKey.get(key)!.add(territoryFillOf(id))
    }
    for (const [key, fills] of byKey) expect(fills.size, key).toBe(1)
  })

  it('(4) adjacent-pair ΔE, re-run from receipts/8a96805.md (printed for the receipt)', () => {
    const seen = new Set<string>()
    const pairs: { a: string; b: string; d: number; same: boolean }[] = []
    for (const id of regions)
      for (const nb of territoryNeighboursOf(id)) {
        const key = id < nb ? id + '|' + nb : nb + '|' + id
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push({ a: id, b: nb, d: deltaE(territoryFillOf(id), territoryFillOf(nb)), same: familyOf(id) === familyOf(nb) })
      }
    const sorted = pairs.map((p) => p.d).sort((x, y) => x - y)
    const median = sorted[Math.floor(sorted.length / 2)]
    const under = (t: number) => sorted.filter((d) => d < t).length
    const within = pairs.filter((p) => p.same).map((p) => p.d).sort((x, y) => x - y)
    const across = pairs.filter((p) => !p.same).map((p) => p.d).sort((x, y) => x - y)
    const distinct = new Set(regions.map((id) => territoryFillOf(id))).size
    const closest = pairs.slice().sort((x, y) => x.d - y.d)[0]
    console.log(`OB-119 adjacent pairs: ${pairs.length} | min ${sorted[0].toFixed(4)} | median ${median.toFixed(4)} | <0.010: ${under(0.01)} | <0.020: ${under(0.02)} | distinct fills ${distinct}`)
    console.log(`  within a family: ${within.length} pairs, min ${within[0].toFixed(4)} | across families: ${across.length} pairs, min ${across[0].toFixed(4)} (${closest.a} ~ ${closest.b})`)
    expect(pairs.length).toBeGreaterThan(1000)
    /* two touching regions of ONE family sit in different slots, and the closest two slots are
       0.045 apart in L alone; anything under that means the ladder was not applied */
    expect(within[0]).toBeGreaterThan(0.04)
    expect(under(0.01)).toBe(0)
  })

  it('(5) labelInkOf is untouched and still clears 4.5:1 on every label of the darker fills', () => {
    let worst = Infinity
    let moved = 0
    let below = 0
    for (const id of [...domainIds, ...regions]) {
      const r = contrast(labelInkOf(id), territoryFillOf(id))
      worst = Math.min(worst, r)
      if (r < 4.5) below++
      if (labelInkOf(id) !== inkOf(id)) moved++
    }
    console.log(`OB-119 labelInkOf over ${domains.size + regions.length} labels: below 4.5:1 ${below} | worst ${worst.toFixed(2)} | differs from inkOf ${moved}`)
    expect(below).toBe(0)
  })
})

/* OB-162 — the PROVINCE tier constrains every edge. Level 1 is the one tier where two touching
 * regions usually belong to different domains, and hue was supposed to separate those; it did not
 * for `dig` (sys, leaf 148°) beside `prc` (se, fern 166°) — eighteen degrees apart, both in slot 0,
 * 0.0156 in OKLab, under a just-noticeable difference, so two provinces read as one region. Ruled
 * by the owner 2026-09-06: at that tier `familySlots` is fed one family value for every region, so
 * every shared border is constrained. The NESTED tiers keep cross-family edges dropped — they
 * rarely touch across domains, and dropping them is what keeps a family's five slots spread. */
describe('OB-162 — the province tier constrains every edge', () => {
  const provinces = Object.keys(provinceRings)
  const provinceSet = new Set(provinces)

  it('(1) two touching provinces never share a slot, whatever their families', () => {
    let crossFamilyPairs = 0
    for (const id of provinces)
      for (const nb of territoryNeighboursOf(id)) {
        if (!provinceSet.has(nb)) continue
        if (familyOf(nb) !== familyOf(id)) crossFamilyPairs++
        expect(territorySlotOf(nb), `${id} and ${nb} touch and share slot ${territorySlotOf(id)}`).not.toBe(territorySlotOf(id))
      }
    /* the clause has teeth only if provinces of different families actually touch */
    expect(crossFamilyPairs).toBeGreaterThan(0)
  })

  it('(1) the nested tiers are unchanged: still familySlots over same-family edges only', () => {
    const byTier = new Map<number, string[]>()
    for (const t of territories) byTier.set(t.tier, [...(byTier.get(t.tier) ?? []), t.id])
    let crossFamilyShared = 0
    for (const [tier, ids] of byTier) {
      const at = new Map(ids.map((id, i) => [id, i]))
      const neighbours = ids.map((id) => territoryNeighboursOf(id).filter((n) => at.has(n)).map((n) => at.get(n)!))
      const family = ids.map((id) => familyOf(id)!)
      const expected = familySlots(neighbours, { family })
      ids.forEach((id, i) => expect(territorySlotOf(id), `tier ${tier}: ${id}`).toBe(expected[i]))
      for (const id of ids) for (const nb of territoryNeighboursOf(id)) if (familyOf(nb) !== familyOf(id) && territorySlotOf(nb) === territorySlotOf(id)) crossFamilyShared++
    }
    console.log(`OB-162 nested tiers: cross-family touching pairs still sharing a slot ${crossFamilyShared / 2} (allowed there — the flag did not leak)`)
  })

  it('(2) the 1704-pair measurement: dig ~ prc at or above 0.09, nothing under 0.020, five slots at most', () => {
    expect(territoryNeighboursOf('dig')).toContain('prc')
    const digPrc = deltaE(territoryFillOf('dig'), territoryFillOf('prc'))
    const seen = new Set<string>()
    const ds: number[] = []
    for (const id of regions)
      for (const nb of territoryNeighboursOf(id)) {
        const key = id < nb ? id + '|' + nb : nb + '|' + id
        if (seen.has(key)) continue
        seen.add(key)
        ds.push(deltaE(territoryFillOf(id), territoryFillOf(nb)))
      }
    const slotsInUse = new Set(regions.map((id) => territorySlotOf(id))).size
    console.log(`OB-162 dig ~ prc ${digPrc.toFixed(4)} | pairs ${ds.length} | <0.020: ${ds.filter((d) => d < 0.02).length} | slots in use ${slotsInUse}`)
    expect(digPrc).toBeGreaterThanOrEqual(0.09)
    expect(ds.filter((d) => d < 0.02).length).toBe(0)
    expect(slotsInUse).toBeLessThanOrEqual(5)
  })
})
