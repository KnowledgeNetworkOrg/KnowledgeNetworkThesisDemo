import { describe, expect, it } from 'vitest'
import { WALL_FRAME_INSET, wallArrowShown, wallExtent, wallFit, wallPinState } from './walkwall'

/* #267 (DS OB-139 rule 4) — the walk on the wall, unbanded: pins lit / done / ahead, and the
 * line through the covered stops and the lit one only. */

const pin = (step: number, stepEnd = step) => ({ step, stepEnd })

describe('wallPinState', () => {
  const wall = { lit: 3, covered: [0, 1, 2] } // stops 1–3 covered, the room looks at stop 4
  it('the lit stop is current, the covered ones done, the rest ahead', () => {
    expect(wallPinState(pin(4), wall)).toBe('current')
    expect(wallPinState(pin(2), wall)).toBe('done')
    expect(wallPinState(pin(5), wall)).toBe('ahead')
  })
  it('a pin standing for a run: current when the lit stop is inside it, done only when the whole run was covered', () => {
    expect(wallPinState(pin(3, 5), wall)).toBe('current')
    expect(wallPinState(pin(1, 3), wall)).toBe('done')
    expect(wallPinState(pin(2, 6), { lit: 8, covered: [0, 1, 2, 3] })).toBe('ahead')
  })
  it('a skip is a gap: a stop the record jumped over is ahead, not done', () => {
    const skipped = { lit: 4, covered: [0, 1, 3] } // stop 3 (index 2) was never presented
    expect(wallPinState(pin(3), skipped)).toBe('ahead')
    expect(wallPinState(pin(4), skipped)).toBe('done')
  })
})

describe('wallArrowShown — the line joins the covered stops and the lit one', () => {
  const wall = { lit: 3, covered: [0, 1, 2] }
  it('drawn between two covered stops, and into the lit one', () => {
    expect(wallArrowShown(pin(1), pin(2), wall)).toBe(true)
    expect(wallArrowShown(pin(3), pin(4), wall)).toBe(true)
  })
  it('not drawn out of the lit stop or between stops ahead', () => {
    expect(wallArrowShown(pin(4), pin(5), wall)).toBe(false)
    expect(wallArrowShown(pin(5), pin(6), wall)).toBe(false)
  })
  it('a gap in the record breaks the line', () => {
    expect(wallArrowShown(pin(2), pin(3), { lit: 4, covered: [0, 1, 3] })).toBe(false)
  })
})

describe('the wall\'s frame (DS OB-163): the whole walk, fitted once', () => {
  const pts = [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 60, y: 70 }]
  it('wallExtent is the pins\' bounding rect, and null for no pins', () => {
    expect(wallExtent(pts, 2)).toEqual({ x: 10, y: 20, w: 100, h: 50, level: 2 })
    expect(wallExtent([], 2)).toBeNull()
  })
  it('the fit fills the clear area on the tighter axis and centres the frame in it', () => {
    const box = { w: 1000, h: 500 }
    const fit = wallFit({ x: 10, y: 20, w: 100, h: 50, level: 1 }, box, { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 })
    // clear area 800×400: 100 units across it is 8 px/unit, 50 units down it is 8 too — the tighter wins at 8
    expect(fit.pxPerUnit).toBe(8)
    expect(fit.focus).toEqual({ x: 60, y: 45 })
    expect(fit.at).toEqual({ x: 500, y: 250 })
  })
  it('a tall frame is limited by the height, a wide one by the width', () => {
    const box = { w: 1000, h: 500 }, inset = { top: 0, right: 0, bottom: 0, left: 0 }
    expect(wallFit({ x: 0, y: 0, w: 10, h: 100, level: 1 }, box, inset).pxPerUnit).toBe(5)
    expect(wallFit({ x: 0, y: 0, w: 1000, h: 10, level: 1 }, box, inset).pxPerUnit).toBe(1)
  })
  it('the same frame and box give the same fit — M down then M up is one picture', () => {
    const a = wallFit({ x: 3, y: 4, w: 30, h: 40, level: 2 }, { w: 686, h: 457 })
    const b = wallFit({ x: 3, y: 4, w: 30, h: 40, level: 2 }, { w: 686, h: 457 })
    expect(a).toEqual(b)
  })
  it('a fraction inset gives the same fit per unit of box on two boxes of one shape', () => {
    const f = { x: 0, y: 0, w: 100, h: 50, level: 1 }
    const small = wallFit(f, { w: 686, h: 386 }), big = wallFit(f, { w: 1372, h: 772 })
    expect(big.pxPerUnit / small.pxPerUnit).toBeCloseTo(2, 9)
    expect(WALL_FRAME_INSET.top).toBeGreaterThan(WALL_FRAME_INSET.bottom) // the caption is taller than the foot
  })
  it('a frame with no extent asks for an unbounded scale, and it is the host\'s to clamp', () => {
    expect(wallFit({ x: 5, y: 5, w: 0, h: 0, level: 1 }, { w: 100, h: 100 }).pxPerUnit).toBeGreaterThan(1e6)
  })
})
