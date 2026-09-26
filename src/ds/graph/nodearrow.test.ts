// OB-116 / OB-107 — the two props the map needs from `NodeArrow`, and the one
// coupling between them that can drift in silence.
//
// `shaftTailOffset` is our own addition (the DS publishes only the unscaled,
// bow-blind `ARROW_METRICS.across`), and it works by REDERIVING where the
// component puts its shaft. That is a copy of arithmetic living twelve lines
// above it, and a copy is a thing that goes stale: change `CASING_EXTRA`, or the
// `+ 3` in `across`, and the helper keeps returning the old number while every
// walk arrow on the map slides quietly off its own line. Nothing would fail.
//
// So these tests do not restate the formula — they RENDER the component and read
// the shaft's tail back out of the markup. `renderToStaticMarkup` needs no DOM,
// which is why this can live in the node-environment test run beside the rest.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, test } from 'vitest'

import { ARROW_BOW_MAX_DEG, ARROW_METRICS, ARROW_MIN_SHAFT_HEADS, capBow, extendToMin, headFor, headForSet, minShaft, NodeArrow, shaftTailOffset } from './NodeArrow'
import type { NodeArrowProps } from './NodeArrow'

const draw = (props: NodeArrowProps) => renderToStaticMarkup(createElement(NodeArrow, props))

/** the translate the component wraps its drawing in, as [x, y] */
function padOf(svg: string): [number, number] {
  const m = svg.match(/transform="translate\(([-\d.]+),([-\d.]+)\)"/)
  if (!m) throw new Error('no wrapping translate in:\n' + svg)
  return [Number(m[1]), Number(m[2])]
}

/** where the SHAFT actually starts, in the drawing's own coordinates: the tail of
 *  the straight `<line>`, or the `M` point of the bowed `<path>`. Both are read
 *  after adding the wrapper's translate, so this is the point relative to the
 *  `<svg>`'s own origin — exactly what a host placing the drawing controls. */
function shaftTailIn(svg: string): { along: number; across: number } {
  const [px, py] = padOf(svg)
  // x1="0" is the PAINTED shaft; a casing line starts before it, at -casingBack
  const line = svg.match(/<line x1="0" y1="([-\d.]+)"/)
  if (line) return { along: px, across: Number(line[1]) + py }
  // the bowed case draws the shaft twice when cased (casing first, then paint);
  // both start at the same point, so the first M is the answer either way
  const path = svg.match(/ d="M([-\d.]+) ([-\d.]+) Q/)
  if (!path) throw new Error('no shaft found in:\n' + svg)
  return { along: Number(path[1]) + px, across: Number(path[2]) + py }
}

describe('shaftTailOffset tracks where NodeArrow really puts the shaft', () => {
  const cases: Array<[string, NodeArrowProps]> = [
    ['plain', { direction: 'right', length: 60 }],
    ['cased', { direction: 'right', length: 60, casing: true }],
    ['bowed +', { direction: 'right', length: 60, bow: 9 }],
    ['bowed -', { direction: 'right', length: 60, bow: -9 }],
    ['bowed + cased', { direction: 'right', length: 60, bow: 9, casing: true }],
    ['bowed - cased', { direction: 'right', length: 60, bow: -9, casing: true }],
    ['lighter join', { direction: 'right', length: 60, joins: 'border-2', casing: true }],
    ['borderless join', { direction: 'right', length: 60, joins: 0, bow: -6, casing: true }],
    // OB-197: a bow asked for past the cap is drawn capped, and the helper must tell the host the
    // SAME tail — a negative bow moves the shaft inside its box, so a stale answer here is a
    // drawing placed beside the line it joins
    ['capped bow -', { direction: 'right', length: 10, bow: -14, casing: true }],
    ['capped bow +', { direction: 'right', length: 10, bow: 14 }],
  ]
  for (const [name, props] of cases) {
    test(name, () => {
      const drawn = shaftTailIn(draw(props))
      const told = shaftTailOffset(props)
      expect(told.along).toBeCloseTo(drawn.along, 6)
      expect(told.across).toBeCloseTo(drawn.across, 6)
    })
  }
})

describe('bow', () => {
  test('the straight case is still a <line>, untouched — the DS reads its stroke-width', () => {
    const svg = draw({ direction: 'right', length: 40 })
    expect(svg).toContain('<line')
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).not.toContain(' Q')
  })

  test('a bow turns the shaft into a curve and moves its midpoint by the bow', () => {
    // length 60, so the bow asked for sits inside the 20-degree cap (10.9) and is drawn as asked
    const svg = draw({ direction: 'right', length: 60, bow: 8 })
    expect(svg).not.toContain('<line')
    const [, , ctrlY] = svg.match(/Q([-\d.]+) ([-\d.]+)/)!
    const tail = shaftTailIn(svg)
    // the CONTROL point sits a full bow off the axis; the drawn curve passes
    // half of it, which is the quadratic's own arithmetic and is what
    // walkarrow.bowedPoint models on the map's side
    expect(Number(ctrlY) + padOf(svg)[1] - tail.across).toBeCloseTo(8, 6)
  })

  test('the head follows the curve, not the axis — a bowed arrow does not point straight', () => {
    const straight = draw({ direction: 'right', length: 40 })
    const bowed = draw({ direction: 'right', length: 40, bow: 8 })
    const tipOf = (svg: string) => svg.match(/L([-\d.]+) ([-\d.]+) L/)![2]
    expect(Number(tipOf(bowed))).not.toBeCloseTo(Number(tipOf(straight)), 1)
  })

  test('the two signs are mirror images about the shaft, once the offset is applied', () => {
    const up = draw({ direction: 'right', length: 40, bow: 7 })
    const down = draw({ direction: 'right', length: 40, bow: -7 })
    const ctrl = (svg: string) => Number(svg.match(/Q([-\d.]+) ([-\d.]+)/)![2]) + padOf(svg)[1] - shaftTailIn(svg).across
    expect(ctrl(up)).toBeCloseTo(-ctrl(down), 6)
  })
})

describe('casing', () => {
  test('off by default — a chain gap draws no halo', () => {
    expect(draw({ direction: 'right', length: 40 })).not.toContain('--surface-raised')
  })

  test('on, it draws a halo behind BOTH the shaft and the head', () => {
    const svg = draw({ direction: 'right', length: 40, casing: true })
    expect(svg.split('--surface-raised').length - 1).toBe(2)
  })

  test('and it follows a bowed shaft too', () => {
    const svg = draw({ direction: 'right', length: 40, bow: 8, casing: true })
    expect(svg.split('--surface-raised').length - 1).toBe(2)
    // the halo is a curve as well, not a straight line laid under a curve
    expect(svg.match(/ Q/g)!.length).toBe(2)
  })

  test('it changes contrast, not size: the head and shaft keep their own numbers', () => {
    const bare = draw({ direction: 'right', length: 40 })
    const cased = draw({ direction: 'right', length: 40, casing: true })
    const headOf = (svg: string) => {
      const m = [...svg.matchAll(/d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) Z"/g)]
      const last = m[m.length - 1] // the painted head is drawn after any casing
      const [, y] = padOf(svg)
      return { back: Number(last[2]) + y, tip: Number(last[4]) + y, front: Number(last[6]) + y }
    }
    const b = headOf(bare)
    const c = headOf(cased)
    expect(c.front - c.back).toBeCloseTo(b.front - b.back, 6) // same width
    expect(c.tip - shaftTailIn(cased).across).toBeCloseTo(b.tip - shaftTailIn(bare).across, 6)
    expect(cased).toContain(`stroke-width="${ARROW_METRICS.stroke}"`) // same shaft weight
  })
})

/** the PAINTED head triangle, read out of the markup rather than off a constant.
 *  The casing draws its own larger triangle first when `casing` is on, so the LAST
 *  three-point path is always the paint. Returned as the box the triangle occupies,
 *  which is what a reader of the map actually sees. */
function headBoxIn(svg: string): { along: number; across: number } {
  const tris = [...svg.matchAll(/ d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) Z"/g)]
  if (!tris.length) throw new Error('no head triangle in:\n' + svg)
  const t = tris[tris.length - 1].slice(1).map(Number)
  const xs = [t[0], t[2], t[4]]
  const ys = [t[1], t[3], t[5]]
  return { along: Math.max(...xs) - Math.min(...xs), across: Math.max(...ys) - Math.min(...ys) }
}

describe('the head is capped by its own shaft length (OB-126)', () => {
  // THE CASE THAT WAS BROKEN. The map's pin ring is a 4px border, so `joins={4}`
  // scales the published head by 4/1.5 = 2.67 — which drew a 21px head 23.5px
  // across on a 450px hop. A spearhead on a hairline curve.
  test('a long, heavy arrow no longer draws a spearhead', () => {
    const box = headBoxIn(draw({ direction: 'right', length: 450, joins: 4 }))
    expect(box.along).toBeLessThanOrEqual(450 * ARROW_METRICS.headLengthMax)
    expect(box.along).toBeCloseTo(13.5, 2)
    // and it is far below what the weight alone would have given it
    expect(box.along).toBeLessThan(ARROW_METRICS.head * (4 / ARROW_METRICS.stroke))
  })

  // THE CASES THAT MUST NOT MOVE. Every existing caller — a chain gap, the road,
  // a relation card — draws a short arrow, and the cap is floored at the published
  // head precisely so none of them changes.
  test('the published stub is untouched: 14px gap, full rank', () => {
    const box = headBoxIn(draw({ direction: 'right', length: 14 }))
    expect(box.along).toBeCloseTo(ARROW_METRICS.head, 2)
    expect(box.across).toBeCloseTo(ARROW_METRICS.halfWidth * 2, 2)
  })

  test('and a heavy shaft under ~267px still takes the floor, not the ceiling', () => {
    expect(headBoxIn(draw({ direction: 'right', length: 60, joins: 4 })).along)
      .toBeCloseTo(ARROW_METRICS.head, 2)
  })

  test('omitting length gives the upper bound, and no drawn arrow exceeds it', () => {
    const bound = headFor({ joins: 4 })
    for (const length of [14, 60, 267, 450, 900, 5000]) {
      expect(headFor({ joins: 4, length }).head).toBeLessThanOrEqual(bound.head)
    }
  })

  test('the triangle keeps its proportions as it shrinks', () => {
    const capped = headFor({ joins: 4, length: 450 })
    // 3dp, not more: both numbers are rounded to 2dp on the way out, so the ratio
    // carries that rounding (0.5504 against 0.55). The claim is that the head stays
    // the SAME arrowhead at a smaller size, not that it survives to six places.
    expect(capped.halfWidth / capped.head).toBeCloseTo(ARROW_METRICS.halfWidth / ARROW_METRICS.head, 3)
  })
})

describe('a set of arrows drawn together shares one head (OB-126 amendment)', () => {
  // Per-arrow sizing is the opposite failure to the one the cap was written for:
  // head size becomes a function of length, length is already drawn by the line,
  // and a reader takes the bigger head as emphasis.
  const LENGTHS = [120, 300, 450, 800]

  test('the set takes the SMALLEST head it allows, not an average', () => {
    const set = headForSet({ joins: 4, lengths: LENGTHS })
    const each = LENGTHS.map((l) => headFor({ joins: 4, length: l }).head)
    expect(set.head).toBe(Math.min(...each))
    const mean = each.reduce((a, b) => a + b, 0) / each.length
    expect(set.head).toBeLessThan(mean)
  })

  test('one short hop in the set puts every arrow on the published head', () => {
    expect(headForSet({ joins: 4, lengths: [90, 450, 900] }).head).toBeCloseTo(ARROW_METRICS.head, 2)
  })

  test('no lengths at all falls through to the upper bound', () => {
    expect(headForSet({ joins: 4 })).toEqual(headFor({ joins: 4 }))
    expect(headForSet({ joins: 4, lengths: [] })).toEqual(headFor({ joins: 4 }))
  })

  // THE DONE-WHEN, as an assertion: a short hop and a long cross-map hop must
  // measure the SAME triangle once the view has sized the set.
  test('two arrows of very different lengths draw one identical triangle', () => {
    const shared = headForSet({ joins: 4, lengths: LENGTHS })
    const short = headBoxIn(draw({ direction: 'right', length: 120, joins: 4, headSize: shared }))
    const long = headBoxIn(draw({ direction: 'right', length: 800, joins: 4, headSize: shared }))
    expect(short).toEqual(long)
  })

  test('and without the shared head they would NOT have matched', () => {
    const short = headBoxIn(draw({ direction: 'right', length: 120, joins: 4 }))
    const long = headBoxIn(draw({ direction: 'right', length: 800, joins: 4 }))
    expect(short.along).not.toBeCloseTo(long.along, 2)
  })
})

describe('walked — the split shaft and the travelling head (OB-132, adopted upstream at OB-159)', () => {
  const base: NodeArrowProps = { direction: 'right', length: 100, casing: true }
  /** every painted shaft stroke in draw order: its paint and its dash, or none */
  const shaftsOf = (svg: string) =>
    [...svg.matchAll(/<(?:line|path)[^>]*?stroke="([^"]+)"[^>]*?>/g)]
      .filter((m) => !m[1].includes('surface-raised'))
      .map((m) => ({ paint: m[1], dash: (m[0].match(/stroke-dasharray="([^"]+)"/) || [])[1] ?? null, pathLength: /pathLength="1"/.test(m[0]) }))
  /** the painted head's base x, from its path — `M<x> <y> L…` for direction right */
  const headOf = (svg: string) => {
    const heads = [...svg.matchAll(/<path d="M([-\d.]+) [-\d.]+ L[^"]*" fill="([^"]+)"/g)].filter((m) => !m[2].includes('surface-raised'))
    const m = heads.pop()!
    return { x: Number(m[1]), fill: m[2] }
  }

  test('undefined draws byte for byte what it always drew', () => {
    expect(draw({ ...base, walked: undefined })).toBe(draw(base))
    expect(draw({ direction: 'right', length: 40, bow: 8, walked: undefined })).toBe(draw({ direction: 'right', length: 40, bow: 8 }))
  })

  test('0 is the walk STANDING AT THE TAIL — head at the tail, in acorn (DS OB-159)', () => {
    // This asserted head-at-the-far-end in the quiet paint until 2026-09-11, which was our own
    // reading of 0 as "unwalked". It is not: unwalked is `walked` ABSENT (the test above), and 0
    // means the walk has arrived at this arrow's tail with none of the shaft behind it yet.
    // Ours had a discontinuity because of it — the head sat at the far end at 0 and at the tail
    // at 0.01, jumping the whole shaft on the animation's first frame. The design system's file
    // places the head at `length * wk` for every defined `wk`, so the walk's own position is
    // always where the head is.
    const atTail = draw({ ...base, tone: 'quiet', walked: 0 })
    expect(shaftsOf(atTail)).toEqual([{ paint: 'var(--bark-400)', dash: null, pathLength: false }])
    expect(headOf(atTail)).toEqual({ x: 0, fill: 'var(--accent-walk)' })
  })

  test('and the head moves continuously off the tail rather than jumping the shaft', () => {
    // the fault the change fixes, pinned as the thing it fixes: a hair past 0 must be a hair
    // past the tail, not the whole shaft away from where 0 drew.
    const at0 = headOf(draw({ ...base, tone: 'quiet', walked: 0 })).x
    const at1pc = headOf(draw({ ...base, tone: 'quiet', walked: 0.01 })).x
    expect(Math.abs(at1pc - at0)).toBeLessThan(2)
  })

  test('1 is one acorn shaft with an acorn head at the far end', () => {
    const all = draw({ ...base, tone: 'quiet', walked: 1 })
    expect(shaftsOf(all)).toEqual([{ paint: 'var(--accent-walk)', dash: null, pathLength: false }])
    expect(headOf(all)).toEqual({ x: 100, fill: 'var(--accent-walk)' })
  })

  test('between, the shaft is two strokes split as dash offsets on one pathLength, and the head sits at the split', () => {
    const svg = draw({ ...base, tone: 'quiet', walked: 0.25, aheadOpacity: 0.8 })
    expect(shaftsOf(svg)).toEqual([
      { paint: 'var(--bark-400)', dash: '0 0.25 0.75 1', pathLength: true },
      { paint: 'var(--accent-walk)', dash: '0.25 1', pathLength: true },
    ])
    expect(svg).toContain('stroke-opacity="0.8"')
    expect(headOf(svg)).toEqual({ x: 25, fill: 'var(--accent-walk)' })
    // the casing's head travels with it
    expect(svg).toContain('d="M25 ')
  })

  test('receded, both parts take the receded paint', () => {
    const svg = draw({ ...base, tone: 'hint', walkedTone: 'hint', walked: 0.5 })
    expect(shaftsOf(svg).map((s) => s.paint)).toEqual(['var(--bark-300)', 'var(--bark-300)'])
    expect(headOf(svg).fill).toBe('var(--bark-300)')
  })

  test('on a bowed shaft the head travels along the CURVE — off the chord, pointing along it', () => {
    // a bow of 16 on a 100 shaft: inside the 20-degree cap (18.2), so drawn as asked
    const rest = draw({ direction: 'right', length: 100, bow: 16 })
    const mid = draw({ direction: 'right', length: 100, bow: 16, walked: 0.5 })
    const tip = (svg: string) => svg.match(/L([-\d.]+) ([-\d.]+) L/)!.slice(1).map(Number)
    const [rx] = tip(rest)
    const [mx, my] = tip(mid)
    expect(mx).toBeLessThan(rx)
    // half way along a symmetric bow the head is at the curve's own midpoint — the
    // control point's half — and points straight along the axis
    const tail = shaftTailIn(mid)
    expect(my - tail.across).toBeCloseTo(8, 0)
    const [p1x, p1y, , , p3x, p3y] = mid.match(/<path d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) Z" fill="var/)!.slice(1).map(Number)
    expect(p1x).toBeCloseTo(p3x, 1)
    expect(Math.abs(p1y - p3y)).toBeCloseTo(2 * ARROW_METRICS.halfWidth, 1)
  })
})

// OB-197 — a relation between two ADJACENT territories: lengthen the line, and cap the bow drawn on it.
// The two halves of one fault (owner, 2026-09-16): a shaft clipped to a shared boundary is a few units
// long, so the head is most of the drawing, and a CONSTANT bow on that stub rotates the head up to 70
// degrees off its own line, so the stub reads as a stray arrowhead beside the next line's head.
describe('minShaft — the floor is three head-lengths, never a pixel count (OB-197)', () => {
  test('three, and 24 at the published 8px head', () => {
    expect(ARROW_MIN_SHAFT_HEADS).toBe(3)
    expect(minShaft()).toBe(ARROW_METRICS.head * 3)
    expect(minShaft()).toBe(24)
  })

  test('it follows the head, so a heavier join floors higher — the map draws in its own units', () => {
    expect(minShaft({ joins: 4 })).toBeCloseTo(headFor({ joins: 4 }).head * 3, 2)
    expect(minShaft({ joins: 4 })).toBeGreaterThan(minShaft())
  })

  test('a set-sized head wins over the per-arrow one, and the ratio is a knob', () => {
    expect(minShaft({ headSize: { head: 10, halfWidth: 5.5 } })).toBe(30)
    expect(minShaft({ minHeads: 5 })).toBe(40)
  })
})

describe('extendToMin — the two ends pushed back until the shaft clears the floor (OB-197)', () => {
  const O = { x: 0, y: 0 }

  test('a stub grows to the floor, each end moved back by HALF the shortfall', () => {
    const r = extendToMin({ from: O, to: { x: 10, y: 0 } })
    expect(r.grew).toBe(true)
    expect(r.length).toBe(24)
    expect(r.from.x).toBeCloseTo(-7, 9)
    expect(r.to.x).toBeCloseTo(17, 9)
  })

  test('symmetric: the midpoint, where the kind label sits, does not move', () => {
    const r = extendToMin({ from: O, to: { x: 3, y: 4 } })
    expect((r.from.x + r.to.x) / 2).toBeCloseTo(1.5, 9)
    expect((r.from.y + r.to.y) / 2).toBeCloseTo(2, 9)
    expect(Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y)).toBeCloseTo(24, 9)
    // and it stays on its own line: the direction is the one it came with
    expect((r.to.y - r.from.y) / (r.to.x - r.from.x)).toBeCloseTo(4 / 3, 9)
  })

  test('a line already longer than the floor is drawn at its own length — a floor, not a target', () => {
    const to = { x: 100, y: 0 }
    const r = extendToMin({ from: O, to })
    expect(r.grew).toBe(false)
    expect(r.length).toBe(100)
    expect(r.from).toEqual(O)
    expect(r.to).toEqual(to)
  })

  test('nothing to extend along: coincident points, or a floor of 0, come back as they were', () => {
    const p = { x: 5, y: 5 }
    expect(extendToMin({ from: p, to: p })).toEqual({ from: p, to: p, length: 0, grew: false })
    expect(extendToMin({ from: O, to: { x: 10, y: 0 }, min: 0 }).grew).toBe(false)
  })

  test('the floor is the SET\'s head when one is passed, and never shortens anything', () => {
    const big = { head: 12.8, halfWidth: 7 }
    const r = extendToMin({ from: O, to: { x: 30, y: 0 }, headSize: big })
    expect(r.grew).toBe(true)
    expect(r.length).toBeCloseTo(12.8 * 3, 2)
    // 30 is past the 24 floor of the published head, so THAT head leaves it alone
    expect(extendToMin({ from: O, to: { x: 30, y: 0 } }).grew).toBe(false)
  })
})

describe('capBow — how far off its own line a bowed head may point (OB-197)', () => {
  test('20 degrees, and the bow it allows is tan(20°) × length / 2', () => {
    expect(ARROW_BOW_MAX_DEG).toBe(20)
    expect(capBow({ length: 64, bow: 14 })).toBeCloseTo(11.65, 2) // the 14 the map asks for, at chord 64
    expect(capBow({ length: 10, bow: 14 })).toBeCloseTo(1.82, 2) // and at a 10-unit stub
  })

  test('a bow already inside the cap comes back untouched — a cap, never a length to bow at', () => {
    expect(capBow({ length: 200, bow: 9 })).toBe(9)
    expect(capBow({ length: 200, bow: -9 })).toBe(-9)
  })

  test('the sign is kept, so two lines bowed opposite ways stay separated', () => {
    expect(capBow({ length: 10, bow: -14 })).toBeCloseTo(-capBow({ length: 10, bow: 14 }), 9)
    expect(capBow({ length: 10, bow: -14 })).toBeLessThan(0)
  })

  test('no chord to scale against returns the bow as asked, and no bow is no bow', () => {
    expect(capBow({ length: 0, bow: 14 })).toBe(14)
    expect(capBow({ bow: 14 })).toBe(14)
    expect(capBow({ length: 10 })).toBe(0)
    expect(capBow()).toBe(0)
  })

  test('the angle is a knob, not a constant retyped at a call site', () => {
    expect(capBow({ length: 64, bow: 14, maxDeg: 30 })).toBe(14)
    expect(capBow({ length: 64, bow: 14, maxDeg: 12 })).toBeCloseTo(Math.tan((12 * Math.PI) / 180) * 32, 2)
  })
})

describe('NodeArrow caps its own bow (OB-197)', () => {
  /** how far the PAINTED head points off the axis, in degrees: from the middle of its base to its tip */
  const headAngleIn = (svg: string): number => {
    const tris = [...svg.matchAll(/ d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) Z"/g)]
    const [p1x, p1y, tx, ty, p3x, p3y] = tris[tris.length - 1].slice(1).map(Number)
    return (Math.atan2(ty - (p1y + p3y) / 2, tx - (p1x + p3x) / 2) * 180) / Math.PI
  }

  test('a constant bow on a 10-unit stub no longer rotates the head into a hairpin', () => {
    // asked for 14 on a 10 chord, uncapped, the head sat at atan(2 * 14 / 10) = 70 degrees
    for (const bow of [14, -14]) {
      const angle = Math.abs(headAngleIn(draw({ direction: 'right', length: 10, bow })))
      expect(angle).toBeLessThanOrEqual(ARROW_BOW_MAX_DEG + 0.01)
      expect(angle).toBeGreaterThan(ARROW_BOW_MAX_DEG - 1) // capped TO the limit, not flattened away
    }
  })

  test('the control point takes the capped value — one derivation, so the head cannot point off a curve the shaft is not drawing', () => {
    const svg = draw({ direction: 'right', length: 10, bow: 14 })
    const ctrlY = Number(svg.match(/Q([-\d.]+) ([-\d.]+)/)![2]) + padOf(svg)[1]
    expect(ctrlY - shaftTailIn(svg).across).toBeCloseTo(capBow({ length: 10, bow: 14 }), 9)
  })

  test('a bow inside the cap is drawn exactly as asked', () => {
    const svg = draw({ direction: 'right', length: 100, bow: 9 })
    const ctrlY = Number(svg.match(/Q([-\d.]+) ([-\d.]+)/)![2]) + padOf(svg)[1]
    expect(ctrlY - shaftTailIn(svg).across).toBeCloseTo(9, 9)
  })
})
