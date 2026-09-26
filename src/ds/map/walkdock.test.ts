// #246 (OB-130) — the dock's pure rules. The component cannot render here (vitest
// runs `environment: 'node'`), but every number a drawing reads comes from these
// functions, and they are what would break silently.

import { describe, expect, it } from 'vitest'

import { WALK_BAND_DEFAULTS, WALK_DOCK_METRICS, WALK_PLAYBACK_DEFAULTS, segmentWalked, walkAdvance, walkArrivalLag, walkArrow, walkBand, walkEase } from './WalkDock'

describe('WALK_DOCK_METRICS — the two heights are DERIVED from the parts', () => {
  it('closed = padTop + row + railGap + rail + padBottom + border', () => {
    const M = WALK_DOCK_METRICS
    expect(M.closed).toBe(M.padTop + M.row + M.railGap + M.rail + M.padBottom + M.border)
    expect(M.closed).toBe(63)
  })

  it('open = padTop + row + rowH + padBottom + border', () => {
    const M = WALK_DOCK_METRICS
    expect(M.open).toBe(M.padTop + M.row + M.rowH + M.padBottom + M.border)
    expect(M.open).toBe(113)
  })
})

describe('walkBand — one band for every mark', () => {
  it('on the stop: fully active, full ink, the pop at 1 + grow', () => {
    const r = walkBand(4, 4)
    expect(r.d).toBe(0)
    expect(r.active).toBe(1)
    expect(r.near).toBe(1)
    expect(r.ink).toBe(1)
    expect(r.pinOpacity).toBe(1)
    expect(r.pinScale).toBeCloseTo(1 + WALK_BAND_DEFAULTS.grow)
    expect(r.tickHeight).toBe(WALK_BAND_DEFAULTS.tickMax)
  })

  it('behind fades over `trail`, ahead over `lead`, and the dock never drops under `floor`', () => {
    const behind = walkBand(0, 5) // five behind — the trail's edge
    expect(behind.behind).toBe(true)
    expect(behind.inBand).toBe(true)
    expect(behind.near).toBe(0)
    expect(behind.ink).toBe(WALK_BAND_DEFAULTS.inkRest)
    const gone = walkBand(0, 20)
    expect(gone.inBand).toBe(false)
    expect(gone.ink).toBeGreaterThanOrEqual(WALK_BAND_DEFAULTS.floor)
    expect(gone.pinOpacity).toBe(0) // the MAP's pin does vanish outside the band
    const ahead = walkBand(6, 5) // one ahead — the promise
    expect(ahead.behind).toBe(false)
    expect(ahead.pinOpacity).toBeCloseTo(WALK_BAND_DEFAULTS.peak * 0.5 + Math.max(WALK_BAND_DEFAULTS.floor * 0.9, 0.04) * 0.5)
    expect(ahead.pinScale).toBe(1)
  })

  it('a fractional position reads half-way between two stops', () => {
    const r = walkBand(3, 2.5)
    expect(r.active).toBeCloseTo(0.5)
    expect(r.pinScale).toBeCloseTo(1 + WALK_BAND_DEFAULTS.grow * 0.5)
  })

  it('a partial band merges over the defaults', () => {
    const r = walkBand(0, 3, { trail: 3 })
    expect(r.near).toBe(0)
    expect(walkBand(0, 3).near).toBeGreaterThan(0)
  })
})

describe('segmentWalked / walkArrow', () => {
  it('the walked fraction of the arrow out of stop i, clamped', () => {
    expect(segmentWalked(2.25, 2)).toBeCloseTo(0.25)
    expect(segmentWalked(5, 2)).toBe(1)
    expect(segmentWalked(1, 2)).toBe(0)
  })

  it('the head travels only while the segment is partly walked', () => {
    expect(walkArrow(2, 2.5).headTravels).toBe(true)
    expect(walkArrow(2, 2).headTravels).toBe(false)
    expect(walkArrow(2, 3).headTravels).toBe(false)
    expect(walkArrow(2, 3).headAcorn).toBe(true)
  })

  it('an arrow whose clearances eat its whole shaft is hidden', () => {
    expect(walkArrow(2, 2, undefined, { length: 10 }).hidden).toBe(true)
    expect(walkArrow(2, 2, undefined, { length: 200 }).hidden).toBe(false)
  })
})

describe('walkAdvance — the published clock, pure', () => {
  it('a full step lands on the next stop, resting (phase 0 → position integer)', () => {
    const r = walkAdvance({ step: 0, phase: 0, dt: WALK_PLAYBACK_DEFAULTS.step, count: 5 })
    expect(r.step).toBe(1)
    expect(r.done).toBe(false)
  })

  it('mid-travel the position is fractional and eased', () => {
    const r = walkAdvance({ step: 0, phase: 0, dt: WALK_PLAYBACK_DEFAULTS.step * 0.35, count: 5 })
    expect(r.step).toBe(0)
    expect(r.position).toBeGreaterThan(0)
    expect(r.position).toBeLessThan(1)
    expect(r.position).toBeCloseTo(walkEase(0.5))
  })

  it('CLAMPS dt: a stalled frame spends at most one step, a negative one none', () => {
    const stalled = walkAdvance({ step: 0, phase: 0, dt: 60_000, count: 60 })
    expect(stalled.step).toBe(1)
    const stale = walkAdvance({ step: 4, phase: 0.2, dt: -5000, count: 60 })
    expect(stale.step).toBe(4)
    expect(stale.position).toBeGreaterThanOrEqual(4)
  })

  it('a chosen maxDt caps instead of the step', () => {
    const r = walkAdvance({ step: 0, phase: 0, dt: 60_000, count: 60, playback: { maxDt: 2 * WALK_PLAYBACK_DEFAULTS.step } })
    expect(r.step).toBe(2)
  })

  it('reports done at the last stop and clamps there', () => {
    const r = walkAdvance({ step: 3, phase: 0.9, dt: 500, count: 5 })
    expect(r).toEqual({ step: 4, phase: 0, position: 4, done: true })
    expect(walkAdvance({ count: 0 }).done).toBe(true)
  })

  // OB-196 (d): the replay's beat is playback tuning, published beside the clock — and
  // longer than one dwell on purpose, because the first stop of a replay is the one the
  // room has not looked at for a whole walk.
  it('publishes the replay beat, 600ms, longer than one dwell, and outside the arithmetic', () => {
    expect(WALK_PLAYBACK_DEFAULTS.restartPause).toBe(600)
    expect(WALK_PLAYBACK_DEFAULTS.restartPause).toBeGreaterThan(walkArrivalLag())
    const r = walkAdvance({ step: 0, phase: 0, dt: 400, count: 5 })
    expect(walkAdvance({ step: 0, phase: 0, dt: 400, count: 5, playback: { restartPause: 0 } })).toEqual(r)
  })
})

describe('walkEase — in and out', () => {
  it('is 0 at 0, 1 at 1, and halfway at 0.5', () => {
    expect(walkEase(0)).toBe(0)
    expect(walkEase(1)).toBe(1)
    expect(walkEase(0.5)).toBeCloseTo(0.5)
  })
})
