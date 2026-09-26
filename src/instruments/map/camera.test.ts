import { describe, expect, it } from 'vitest'

import { HOME_VIEW, LEVEL_S, U_CX, U_CY, VB_H, VB_W, VB_X, VB_Y, userPointAt, viewBetween, viewCentredOn, viewKeepingPoint, worldRectOf } from './camera'
import type { View } from './camera'

/* THE CAMERA'S ARITHMETIC, WITHOUT A DOM (#324 seam 3). The frame and the four
 * moves a flight is made of are `camera.ts`'s pure half — the hooks that drive them
 * are `mapcamera.ts`/`arrivallook.ts` and are exercised by the browser suite. What is
 * asserted here is the arithmetic itself: where a level step keeps a point, where a
 * flight's frame sits at t, where a look lands, and how a client point becomes a
 * viewBox point. */

const V: View = { tx: 120, ty: -45, s: 3 }

describe('HOME_VIEW — the frame the map opens at', () => {
  it('(1) is the whole atlas at the first level', () => {
    expect(HOME_VIEW).toEqual({ tx: 0, ty: 0, s: LEVEL_S[0] })
  })
})

describe('viewKeepingPoint — a level step keeps the point under the wheel fixed', () => {
  it('(1) the point under `about` keeps its viewBox position through the step', () => {
    const about = { x: 260, y: 140 }
    const u = { x: (about.x - V.tx) / V.s, y: (about.y - V.ty) / V.s }
    const to = viewKeepingPoint(V, 5.5, about)
    expect(to.s).toBe(5.5)
    expect((about.x - to.tx) / to.s).toBeCloseTo(u.x, 10)
    expect((about.y - to.ty) / to.s).toBeCloseTo(u.y, 10)
  })
})

describe('viewBetween — one frame of a flight', () => {
  const target: View = { tx: -200, ty: 80, s: 14 }

  it('(1) t=0 is `from` and t=1 is `target`', () => {
    const start = viewBetween(V, target, 0)
    expect(start.s).toBeCloseTo(V.s, 10)
    expect(start.tx).toBeCloseTo(V.tx, 10)
    expect(start.ty).toBeCloseTo(V.ty, 10)
    const end = viewBetween(V, target, 1)
    expect(end.s).toBeCloseTo(target.s, 10)
    expect(end.tx).toBeCloseTo(target.tx, 10)
    expect(end.ty).toBeCloseTo(target.ty, 10)
  })

  it('(2) the midpoint is the cubic-eased centre and the geometric scale', () => {
    const e = 1 - Math.pow(1 - 0.5, 3) // 0.875 — the ease lives in the frame
    const c0 = { x: (U_CX - V.tx) / V.s, y: (U_CY - V.ty) / V.s }
    const c1 = { x: (U_CX - target.tx) / target.s, y: (U_CY - target.ty) / target.s }
    const s = V.s * Math.pow(target.s / V.s, e)
    const mid = viewBetween(V, target, 0.5)
    expect(mid.s).toBeCloseTo(s, 10)
    expect(mid.tx).toBeCloseTo(U_CX - (c0.x + (c1.x - c0.x) * e) * s, 10)
    expect(mid.ty).toBeCloseTo(U_CY - (c0.y + (c1.y - c0.y) * e) * s, 10)
  })
})

describe('viewCentredOn — the peek flight and the arrival look land here', () => {
  it('(1) without `up` the point sits dead centre at the asked scale', () => {
    const v = viewCentredOn({ x: 400, y: 300 }, 5.5)
    expect(v.s).toBe(5.5)
    expect(v.tx).toBeCloseTo(U_CX - 400 * 5.5, 10)
    expect(v.ty).toBeCloseTo(U_CY - 300 * 5.5, 10)
  })

  it('(2) `up` lifts the centre by that many viewBox units (the closed dock)', () => {
    const v = viewCentredOn({ x: 400, y: 300 }, 5.5, 23)
    expect(v.tx).toBeCloseTo(U_CX - 400 * 5.5, 10)
    expect(v.ty).toBeCloseTo(U_CY - 23 - 300 * 5.5, 10)
  })
})

describe('worldRectOf — the viewport culling asks its question of', () => {
  it('(1) with no measured box it is the viewBox itself, in world units', () => {
    const r = worldRectOf(V, null)
    expect(r.x).toBeCloseTo((VB_X - V.tx) / V.s, 10)
    expect(r.y).toBeCloseTo((VB_Y - V.ty) / V.s, 10)
    expect(r.w).toBeCloseTo(VB_W / V.s, 10)
    expect(r.h).toBeCloseTo(VB_H / V.s, 10)
  })

  it('(2) a box WIDER than the viewBox is letterboxed by half the overflow each side', () => {
    const cb = { w: 2 * VB_W, h: VB_H } // the box's zoom factor floors at the height, f = 1
    const r = worldRectOf(V, cb)
    expect(r.x).toBeCloseTo((VB_X - VB_W / 2 - V.tx) / V.s, 10)
    expect(r.w).toBeCloseTo((2 * VB_W) / V.s, 10)
    expect(r.y).toBeCloseTo((VB_Y - V.ty) / V.s, 10)
  })
})

describe('userPointAt — a client point through a measured box', () => {
  it('(1) the box centre is the viewBox centre', () => {
    const rect = { left: 40, top: 25, width: VB_W / 2, height: VB_H / 2 }
    const p = userPointAt(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
    expect(p.x).toBeCloseTo(U_CX, 6)
    expect(p.y).toBeCloseTo(U_CY, 6)
  })

  it('(2) a box of the viewBox\'s own aspect maps corner to corner', () => {
    const rect = { left: 40, top: 25, width: VB_W / 2, height: VB_H / 2 }
    const p = userPointAt(rect.left, rect.top, rect)
    expect(p.x).toBeCloseTo(VB_X, 6)
    expect(p.y).toBeCloseTo(VB_Y, 6)
  })
})
