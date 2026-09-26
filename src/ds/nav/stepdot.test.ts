// OB-129 — which branch a stop label takes, and OB-132's `arrival` riding in with it.
//
// The measurement half of OB-129's acceptance test lives in
// `tools/studio-spike/drive-stepdot.mjs`, because it is a measurement and jsdom
// lays nothing out. What is left for a unit test is the part a browser cannot
// reach at will: the RANGE case, which needs a corpus where some cell is crowded
// enough to draw "1-3" and today's is not, and the `arrival` blend, which has no
// caller yet and so appears on no screen.
//
// The two branches are told apart by their FACE: a circle draws fill, ring and
// dash as `<circle>`s; a pill draws them as a `<rect>` of the text's own width.
// Both are ONE `<svg>` since OB-214 (2026-09-26) — the pill used to be a CSS
// border with no SVG at all, which is why it could not show a dash — so "has an
// <svg>" no longer separates them and "has a <circle>" does. That distinction is
// exact at every size, which the measurement is not — the pill keeps
// `minWidth: size`, so at the rail's 28px dot two digits still fit inside the
// minimum and a broken build measures square anyway.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, test } from 'vitest'

import { StepDot, StepDotMath } from './StepDot'
import type { StepDotProps } from './StepDot'

const draw = (props: StepDotProps) => renderToStaticMarkup(createElement(StepDot, props))
const isCircle = (markup: string) => markup.includes('<circle')

describe('a range is a string; a number never is', () => {
  test('two-digit stop numbers draw the circle face, not the pill', () => {
    for (const n of [10, 25, 60]) {
      for (const variant of ['rail', 'pin'] as const) {
        for (const state of ['done', 'current', 'ahead'] as const) {
          expect(isCircle(draw({ n, variant, state })), `n=${n} ${variant}/${state}`).toBe(true)
        }
      }
    }
  })

  test('single digits are unchanged, which is the control', () => {
    expect(isCircle(draw({ n: 9 }))).toBe(true)
  })

  test('a range label is still a pill — the branch exists for it', () => {
    expect(isCircle(draw({ n: '1-3' }))).toBe(false)
    expect(isCircle(draw({ n: '10-12' }))).toBe(false)
  })

  test('a ONE-character string is a circle: "5" is a label, not a range', () => {
    // the test is `length > 1`, not `typeof n === 'string'` — a caller that
    // stringifies its labels must not lose the circle for stops 1 through 9
    expect(isCircle(draw({ n: '5' }))).toBe(true)
  })

  test('the pill keeps a MINIMUM width, which is why measuring alone missed this', () => {
    // recorded so nobody weakens the driver back to a measurement: the pill only
    // outgrows the circle once its content plus padding passes `size`
    const pill = draw({ n: '1-3', size: 28 })
    expect(pill).toContain('min-width:28px')
    expect(pill).toContain('width:auto')
  })
})

describe('arrival blends the three colours and nothing else', () => {
  test('undefined draws exactly what the component always drew', () => {
    expect(draw({ n: 4, state: 'ahead' })).toBe(draw({ n: 4, state: 'ahead', arrival: undefined }))
    expect(draw({ n: 4, state: 'ahead' })).toBe(draw({ n: 4, state: 'ahead', arrival: 0 }))
  })

  test('1 lands exactly on the current look, from either direction', () => {
    const atCurrent = draw({ n: 4, state: 'current' })
    expect(draw({ n: 4, state: 'ahead', arrival: 1 })).toBe(atCurrent)
    expect(draw({ n: 4, state: 'done', arrival: 1 })).toBe(atCurrent)
  })

  test('midway is a real oklab mix, not a snap to either end', () => {
    const mid = draw({ n: 4, state: 'ahead', arrival: 0.5 })
    expect(mid).toContain('color-mix(in oklab')
    expect(mid).toContain('50%')
  })

  test('out-of-range values clamp rather than producing nonsense', () => {
    expect(draw({ n: 4, state: 'ahead', arrival: 2 })).toBe(draw({ n: 4, state: 'current' }))
    expect(draw({ n: 4, state: 'ahead', arrival: -1 })).toBe(draw({ n: 4, state: 'ahead' }))
  })

  test('geometry does not blend — an optional dash is keyed on the discrete state', () => {
    // `optional && current` shrinks the fill; a half-arrived `ahead` dot must not
    // half-shrink it. Two circles in the SVG means the shrink happened.
    const circles = (m: string) => (m.match(/<circle/g) || []).length
    expect(circles(draw({ n: 4, state: 'current', optional: true }))).toBe(3)
    expect(circles(draw({ n: 4, state: 'ahead', optional: true, arrival: 0.5 }))).toBe(2)
  })
})

// ── OB-214 clause 1 — the pill honours `optional` ─────────────────────────────
// Every map pin and every dock dot prints a two-number address ("1.4"), so all of them take
// the pill branch — which drew no dash, whatever it was told. The dock had been passing
// `optional` into it since the address landed.
describe('the pill draws its dash', () => {
  const hasDash = (m: string) => m.includes('data-stepdot-dash')

  test('an addressed pin with `optional` draws a dashed edge, at the crowding floor as well as full size', () => {
    for (const size of [16, 19, 22]) {
      for (const state of ['done', 'current', 'ahead'] as const) {
        const m = draw({ n: '1.4', variant: 'pin', size, state, optional: true })
        expect(isCircle(m), `size ${size} ${state}`).toBe(false)
        expect(hasDash(m), `size ${size} ${state}`).toBe(true)
      }
    }
  })

  test('its required twin draws none — the ring is solid', () => {
    expect(hasDash(draw({ n: '1.4', variant: 'pin', size: 22 }))).toBe(false)
  })

  test('the pill face is one SVG sized by percentage — no text measured, no 300x150 default', () => {
    const m = draw({ n: '1.1–1.3', variant: 'pin', size: 22 })
    expect(m).toContain('<svg width="100%" height="100%"')
    expect(m).toContain('rx="10.25"') // (size - ringW) / 2 = (22 - 1.5) / 2
  })

  test('the pill dash strokes in the number\'s own ink in every state — no band, so no `bd` swap', () => {
    // at pin `current` the ink and the ring share --accent-walk, so read `done`, where they differ
    const m = draw({ n: '1.4', variant: 'pin', size: 22, state: 'done', optional: true })
    expect(m).toMatch(/data-stepdot-dash="[^"]*"[^>]*stroke="var\(--text-walk\)"/)
  })

  test('both branches read the cap-compensated array, never the two authored numbers', () => {
    const pill = draw({ n: '1.4', variant: 'pin', size: 16, state: 'ahead', optional: true })
    expect(pill).toContain(`stroke-dasharray="${StepDotMath.dash(16, 1.5).array}"`)
    const circle = draw({ n: 4, variant: 'pin', size: 22, state: 'current', optional: true })
    expect(circle).toContain(`stroke-dasharray="${StepDotMath.dash(22, 2.25).array}"`)
  })
})

describe('StepDotMath.dash — the drawn gap is the authored gap', () => {
  test('the array is pre-compensated for the round cap: (ink - w) (gap + w)', () => {
    const d = StepDotMath.dash(22, 1.5)
    expect(d.ink).toBeCloseTo(2.2)
    expect(d.gap).toBeCloseTo(1.76)
    const [dash, gap] = d.array.split(' ').map(Number)
    // what a round cap paints: ink = dash + w, gap = gap - w — the authored numbers, exactly
    expect(dash + 1.5).toBeCloseTo(d.ink)
    expect(gap - 1.5).toBeCloseTo(d.gap)
  })

  test('the period is unchanged, so the cycle count round a ring is too', () => {
    for (const [size, w] of [[16, 1.5], [22, 1.5], [22, 2.25]] as const) {
      const d = StepDotMath.dash(size, w)
      const [dash, gap] = d.array.split(' ').map(Number)
      expect(dash + gap).toBeCloseTo(d.period)
    }
  })

  test('at the 16px floor there is a real gap left — it painted 0.00 before', () => {
    const d = StepDotMath.dash(16, 1.5)
    const gapPainted = Number(d.array.split(' ')[1]) - 1.5
    expect(gapPainted).toBeGreaterThanOrEqual(1.5)
  })
})

// ── OB-216 clause 1 — the numeral slants on an optional stop ─────────────────
describe('the numeral takes the oblique, on both branches', () => {
  const slanted = 'font-style:oblique 11deg'
  const nudged = 'transform:translateX(-0.071em)'

  test('the published constants — chosen angle, derived nudge', () => {
    expect(StepDotMath.oblique).toEqual({ angle: 11, nudgeEm: -0.071 })
    expect(0.365 * Math.tan((11 * Math.PI) / 180)).toBeCloseTo(-StepDotMath.oblique.nudgeEm, 3)
  })

  test('an optional circle and an optional pill both slant AND nudge, on an inline-block span', () => {
    for (const n of [4, '1.4']) {
      const m = draw({ n, variant: 'pin', size: 22, optional: true })
      expect(m, String(n)).toContain(slanted)
      expect(m, String(n)).toContain(nudged)
      expect(m, String(n)).toContain('display:inline-block')
    }
  })

  test('an OBLIQUE, never `italic` — the mono\'s own italic is a different, measured angle', () => {
    expect(draw({ n: '1.4', variant: 'pin', optional: true })).not.toContain('font-style:italic')
  })

  test('a required stop is upright and un-nudged', () => {
    for (const n of [4, '1.4']) {
      const m = draw({ n, variant: 'pin', size: 22 })
      expect(m).not.toContain('oblique')
      expect(m).not.toContain('translateX')
    }
  })
})
