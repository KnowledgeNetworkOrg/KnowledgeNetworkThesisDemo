// OB-246 — the presenter strip's open row spans the row: `pitch` is a floor, not the spacing.
//
// What a unit test can pin is the row's GEOMETRY, because a static render puts every dot's `left`
// into the markup: where the outermost stops sit, that the drawn spacing never falls under the
// published floor, that a window whose centre went stale is drawn inside the walk, and when the
// "back to the active node" marker appears. The gesture halves (dragging the record lands on the
// stop under the pointer, the ring keeps its fraction on opening) need a laid-out box, so they are
// asserted in the browser (`tools/studio-spike/browsertest-presenter.mjs`).
//
// The row mounts at whatever `half` its parent hands it, so the cases below pass `half` directly:
// 3 is what the parent derives at the 600px default, 7 is what it derives at 1200.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { PRESENTER_STRIP_METRICS, PRESENTER_STRIP_PARTS, PresenterStripMath, fillBounds } from './PresenterStrip'

const M = PRESENTER_STRIP_METRICS
/** the outermost label's half-width — how far in a LABELLED end stop is held */
const SIDE_PAD = 36
const OpenRow = PRESENTER_STRIP_PARTS.OpenRow

const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ title: 'stop ' + (i + 1) }))
const draw = (o: { n: number; width: number; center: number; half: number; activeStop?: number }) =>
  renderToStaticMarkup(createElement(OpenRow, {
    steps: steps(o.n), activeStop: o.activeStop ?? 0, roamingStop: null, flags: [],
    isDone: () => false, walked: () => false, holdMs: 600, onHover: () => {}, rowHot: false,
    width: o.width, center: o.center, half: o.half,
  }))
/** the `left` of stop `i`'s dot in px, or null when that stop is not drawn at all */
const leftOf = (markup: string, i: number) => {
  const hit = markup.match(new RegExp('data-presenter-dot="' + i + '" style="[^"]*?left:([-\\d.]+)px'))
  return hit ? parseFloat(hit[1]) : null
}

describe('OB-246 — the open row is spread across the width it has', () => {
  it('a walk that fits whole runs from one labelled end to the other, not in a huddle at the centre', () => {
    const markup = draw({ n: 8, width: 800, center: 3.5, half: 5 })
    expect(leftOf(markup, 0)).toBeCloseTo(SIDE_PAD, 6)
    expect(leftOf(markup, 7)).toBeCloseTo(800 - SIDE_PAD, 6)
    // 728px over seven gaps: a constant 68 pitch would have drawn 476px of it
    expect(leftOf(markup, 1)! - leftOf(markup, 0)!).toBeCloseTo(104, 6)
  })

  it('a window clamped at the start holds its first stop at the labelled inset and its peek at the dot\'s own', () => {
    const markup = draw({ n: 30, width: 800, center: 3, half: 3 })
    expect(leftOf(markup, 0)).toBeCloseTo(SIDE_PAD, 6)
    // the peek past the end of the window is an unlabelled dot, so it is inset by its RADIUS — as
    // far out as the closed rail's outermost tick (`railInset`), which is what "as close to the
    // pane's edges" means
    expect(leftOf(markup, 7)).toBeCloseTo(800 - M.stopDot / 2, 6)
    expect(M.stopDot / 2).toBe(M.railInset)
  })

  it('reserves no peek slot at an end that has no peek, and one at an end that does', () => {
    // start clamp: no room held back on the left, so the first stop is at 36, not at 9 + a pitch
    const start = draw({ n: 30, width: 800, center: 3, half: 3 })
    expect(leftOf(start, 0)).toBeCloseTo(SIDE_PAD, 6)
    // mid-walk: a peek at BOTH ends, so both outermost slots sit at the dot's own inset
    const mid = draw({ n: 40, width: 574, center: 20, half: 3 })
    expect(leftOf(mid, 16)).toBeCloseTo(M.stopDot / 2, 6)
    expect(leftOf(mid, 24)).toBeCloseTo(574 - M.stopDot / 2, 6)
  })

  it('never draws a pitch under the published floor once the row is wide enough to label anything', () => {
    // half 3 is what the parent derives at 574px of row, half 7 at 1200
    for (const [width, half] of [[574, 3], [1200, 7]] as const) {
      const markup = draw({ n: 60, width, center: 30, half })
      for (let i = 30 - half; i < 30 + half; i++) {
        const gap = leftOf(markup, i + 1)! - leftOf(markup, i)!
        expect(gap, `width ${width}, stop ${i} to ${i + 1}`).toBeGreaterThanOrEqual(M.pitch)
      }
    }
  })

  it('draws a window whose stored centre went stale INSIDE the walk (a row that mounted narrow and was measured wider)', () => {
    // half 5's clamp ceiling on a 20-stop walk is centre 14; the row mounted at half 3 and picked 18.
    // Unclamped, hi would sit at 23 — four slots for stops that do not exist.
    const markup = draw({ n: 20, width: 800, center: 18, half: 5 })
    expect(leftOf(markup, 20)).toBeNull()
    // the last stop is the row's labelled end: as far out as the first stop of a walk that fits
    expect(leftOf(markup, 19)).toBeCloseTo(800 - SIDE_PAD, 6)
    // and the span kept its width: eleven slots from the peek at 8 to the end at 19
    expect(leftOf(markup, 8)).toBeCloseTo(M.stopDot / 2, 6)
  })
})

describe('OB-246 — the "back to the active node" marker asks the window, not the pixel', () => {
  const PILL = 'back to the active node'

  it('is absent while the active stop is the row\'s own first dot, however far apart the dots are drawn', () => {
    // the old test read `activeX < pitch / 2`, true of a first dot at 36px once the pitch passed 72
    const markup = draw({ n: 30, width: 800, center: 3, half: 3, activeStop: 0 })
    expect(markup).not.toContain(PILL)
  })

  it('appears when the active stop is outside the drawn window, on the side it left', () => {
    expect(draw({ n: 30, width: 800, center: 3, half: 3, activeStop: 25 })).toContain(PILL)
    expect(draw({ n: 30, width: 800, center: 26, half: 3, activeStop: 1 })).toContain(PILL)
  })
})

describe('OB-246 — fillBounds takes the drawn slots', () => {
  it('is one slot either side of the outermost slots, clamped to the segments that exist', () => {
    expect(fillBounds(3, 9, 20)).toEqual([2, 10])
    expect(fillBounds(0, 5, 20)).toEqual([0, 6])
    expect(fillBounds(15, 19, 20)).toEqual([14, 19])
    expect(fillBounds(0, 0, 1)).toEqual([0, 0])
  })

  it('is the same function object the capitalised way in publishes', () => {
    expect(PresenterStripMath.fillBounds).toBe(fillBounds)
  })
})
