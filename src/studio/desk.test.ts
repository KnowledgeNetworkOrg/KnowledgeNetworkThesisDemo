import { describe, expect, it } from 'vitest'

import { railFloor } from '@/ds'

import {
  DESK_GUTTER,
  deskAvailable,
  deskFits,
  dragDesk,
  fitSizes,
  fractionsOf,
  initialFractions,
  stackFit,
} from './desk'
import { byInstrument, INSTRUMENTS, PRESETS } from './instruments'

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol

describe('OB-170 - every pane declares its own floor', () => {
  it('a column pane declares a usable floor and a lesser-reading point at or above it', () => {
    for (const i of INSTRUMENTS.filter((x) => x.slot === 'column')) {
      expect(i.fit.floor, `${i.id}'s floor`).toBeGreaterThan(0)
      expect(i.fit.narrowBelow, `${i.id}'s narrowBelow`).toBeGreaterThanOrEqual(i.fit.floor)
    }
  })

  it('the map and the document take their floors from the rails they carry', () => {
    expect(byInstrument.get('map')!.fit.floor).toBe(railFloor('left'))
    expect(byInstrument.get('document')!.fit.floor).toBe(railFloor('right'))
  })

  it('a strip declares no width floor - it has no horizontal boundary', () => {
    for (const i of INSTRUMENTS.filter((x) => x.slot === 'strip')) expect(i.fit.floor).toBe(0)
  })

  it('a stack is as demanding as its strongest member', () => {
    const members = [byInstrument.get('walkpalette')!, byInstrument.get('document')!]
    expect(stackFit(members)).toEqual({
      narrowBelow: Math.max(members[0].fit.narrowBelow, members[1].fit.narrowBelow),
      floor: Math.max(members[0].fit.floor, members[1].fit.floor),
    })
    expect(deskFits([{ key: 'stack', members }])[0].floor).toBe(railFloor('right'))
  })
})

describe('OB-170 - the desk divides the measured row', () => {
  it('each seam costs the divider strip and a gutter either side', () => {
    expect(deskAvailable(1000, 1)).toBe(1000)
    expect(deskAvailable(1000, 2)).toBe(1000 - 14 - 2 * DESK_GUTTER)
    expect(deskAvailable(1000, 3)).toBe(1000 - 2 * (14 + 2 * DESK_GUTTER))
    expect(deskAvailable(10, 3)).toBe(0)
  })

  it("Explore's preset split starts from its own weights", () => {
    const columns = ['map', 'document'].map((id) => ({ key: id, members: [byInstrument.get(id)!] }))
    const f = initialFractions(columns, PRESETS.find((p) => p.id === 'explore')!.flex, 1000)
    expect(near(f[0], 1.55 / 2.55)).toBe(true)
    expect(near(f[1], 1 / 2.55)).toBe(true)
    expect(near(f[0] + f[1], 1)).toBe(true)
  })

  it('a fixed-width pane contributes its pixels first', () => {
    const columns = ['walkstack', 'map'].map((id) => ({ key: id, members: [byInstrument.get(id)!] }))
    const f = initialFractions(columns, { map: 1 }, 800)
    expect(near(f[0] + f[1], 1)).toBe(true)
    expect(near(f[0] * 800, 372)).toBe(true)
    expect(near(f[1] * 800, 800 - 372)).toBe(true)
  })

  it('floors are honoured by taking from the pane with room, not by overflowing', () => {
    // document's share is 300 but its floor is 396: it is pinned there and the map keeps the rest
    const sizes = fitSizes([0.7, 0.3], 1000, [{ floor: 330 }, { floor: 396 }])
    expect(sizes).toEqual([604, 396])
  })

  it('only when the floors together exceed the row does the desk overflow', () => {
    expect(fitSizes([0.5, 0.5], 700, [{ floor: 400 }, { floor: 396 }])).toEqual([400, 396])
  })
})

describe('OB-170 - the drag is the same clamp as the bounds', () => {
  it('moves one boundary, preserves the total, and stops at a floor', () => {
    const fits = [{ floor: 400 }, { floor: 400 }]
    const left = dragDesk({ fractions: [0.5, 0.5], available: 1000, fits, index: 0, delta: -300 })
    expect(left.sizes).toEqual([400, 600])
    expect(left.fractions).toEqual([0.4, 0.6])
    expect(left.sizes[0] + left.sizes[1]).toBe(1000)

    const right = dragDesk({ fractions: [0.5, 0.5], available: 1000, fits, index: 0, delta: 300 })
    expect(right.sizes).toEqual([600, 400])
    expect(right.fractions).toEqual([0.6, 0.4])
  })

  it('a pane already under its floor gives nothing back', () => {
    const sizes = fitSizes([0.5, 0.5], 700, [{ floor: 400 }, { floor: 396 }])
    const moved = dragDesk({ fractions: fractionsOf(sizes), available: 700, fits: [{ floor: 400 }, { floor: 396 }], index: 0, delta: 100 })
    expect(moved.sizes).toEqual([400, 396])
  })

  it('sizes convert back to fractions that sum to one', () => {
    expect(fractionsOf([250, 750])).toEqual([0.25, 0.75])
    expect(fractionsOf([0, 250])).toEqual([0, 1])
    expect(fractionsOf([0, 0])).toEqual([0.5, 0.5])
  })
})
