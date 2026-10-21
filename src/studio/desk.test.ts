import { describe, expect, it } from 'vitest'

import { railFloor } from '@/ds'

import {
  DESK_DIVIDER_MARGIN,
  DESK_GUTTER,
  deskAvailable,
  deskFits,
  dragDesk,
  fixedWidth,
  fractionsOf,
  initialFractions,
  resetSeam,
  stackFit,
} from './desk'
import type { DeskColumn } from './desk'
import { byInstrument, INSTRUMENTS, PRESETS } from './instruments'

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol
const column = (id: string): DeskColumn => ({ key: id, members: [byInstrument.get(id)!] })

describe('OB-170 — every pane declares its own floor', () => {
  it('a column pane declares a usable floor', () => {
    for (const i of INSTRUMENTS.filter((x) => x.slot === 'column')) {
      expect(i.fit.floor, `${i.id}'s floor`).toBeGreaterThan(0)
    }
  })

  it('the map and the document take their floors from the rails they carry', () => {
    expect(byInstrument.get('map')!.fit.floor).toBe(railFloor('left'))
    expect(byInstrument.get('document')!.fit.floor).toBe(railFloor('right'))
  })

  it('a strip declares no width floor — it has no horizontal boundary', () => {
    for (const i of INSTRUMENTS.filter((x) => x.slot === 'strip')) expect(i.fit.floor).toBe(0)
  })

  it('a stack is as demanding as its strongest member', () => {
    const members = [byInstrument.get('walkpalette')!, byInstrument.get('document')!]
    expect(stackFit(members)).toEqual({ floor: Math.max(members[0].fit.floor, members[1].fit.floor) })
    expect(deskFits([{ key: 'stack', members }])[0].floor).toBe(railFloor('right'))
  })
})

describe('OB-170 — the desk divides the measured row', () => {
  it('each seam costs only the gutter it already had', () => {
    expect(deskAvailable(1000, 1)).toBe(1000)
    expect(deskAvailable(1000, 2)).toBe(1000 - DESK_GUTTER)
    expect(deskAvailable(1000, 3)).toBe(1000 - 2 * DESK_GUTTER)
    expect(deskAvailable(10, 3)).toBe(0)
  })

  it('the strip straddles that gutter instead of taking room of its own', () => {
    expect(DESK_DIVIDER_MARGIN).toBe(-(14 + DESK_GUTTER) / 2)
  })

  it("Explore's preset split starts from its own weights", () => {
    const columns = ['map', 'document'].map(column)
    const f = initialFractions(columns, PRESETS.find((p) => p.id === 'explore')!.flex)
    expect(near(f[0], 1.55 / 2.55)).toBe(true)
    expect(near(f[1], 1 / 2.55)).toBe(true)
    expect(near(f[0] + f[1], 1)).toBe(true)
  })

  it('a fixed pane keeps its pixels and takes no share of the fractions', () => {
    expect(fixedWidth(column('walkstack'))).toBe(372)
    expect(fixedWidth(column('map'))).toBe(null)
    expect(initialFractions([column('map')], { map: 1 })).toEqual([1])
  })
})

describe('OB-170 — the drag is the same clamp as the bounds', () => {
  it('moves one boundary, preserves the total, and stops at a floor', () => {
    const fits = [{ floor: 400 }, { floor: 400 }]
    const left = dragDesk({ sizes: [500, 500], fits, index: 0, delta: -300 })
    expect(left.sizes).toEqual([400, 600])
    expect(left.fractions).toEqual([0.4, 0.6])
    expect(left.sizes[0] + left.sizes[1]).toBe(1000)

    const right = dragDesk({ sizes: [500, 500], fits, index: 0, delta: 300 })
    expect(right.sizes).toEqual([600, 400])
    expect(right.fractions).toEqual([0.6, 0.4])
  })

  it('a pane already under its floor gives nothing back', () => {
    const moved = dragDesk({ sizes: [350, 350], fits: [{ floor: 400 }, { floor: 396 }], index: 0, delta: 100 })
    expect(moved.sizes).toEqual([350, 350])
  })

  it('a drag on the drawn widths moves only the boundary it touches', () => {
    const launch = dragDesk({
      sizes: [459, 322, 231],
      fits: [{ floor: 330 }, { floor: 240 }, { floor: 396 }],
      index: 0,
      delta: 2,
    })
    expect(launch.sizes).toEqual([461, 320, 231])
  })

  it('sizes convert back to fractions that sum to one', () => {
    expect(fractionsOf([250, 750])).toEqual([0.25, 0.75])
    expect(fractionsOf([0, 250])).toEqual([0, 1])
    expect(fractionsOf([0, 0])).toEqual([0.5, 0.5])
  })
})

describe('OB-170 — a reset belongs to its seam and goes through the clamp', () => {
  it("puts the seam's two panes back in the preset proportion and leaves the third alone", () => {
    const fits = [{ floor: 100 }, { floor: 100 }, { floor: 100 }]
    const preset = [0.25, 0.25, 0.5]
    const next = resetSeam({ sizes: [300, 200, 500], fits, index: 0, preset })
    expect(next.sizes).toEqual([250, 250, 500])
    expect(next.atPreset).toBe(true)

    const partial = resetSeam({ sizes: [300, 300, 400], fits, index: 0, preset })
    expect(partial.sizes).toEqual([300, 300, 400])
    expect(partial.atPreset).toBe(false)
  })

  it('stops at a floor instead of restoring the split under it (Plan, every pane at its floor)', () => {
    // Plan opens 1.6 : 2 : 2. With every pane at its own floor, the map and the document
    // hold too little for a 1:1 split to keep the document at its rail floor.
    const plan = PRESETS.find((p) => p.id === 'plan')!
    const cols = plan.active.map((id) => column(id as string))
    const fits = deskFits(cols)
    const preset = initialFractions(cols, plan.flex)
    const docAt = cols.findIndex((c) => c.members[0].id === 'document')
    const mapAt = cols.findIndex((c) => c.members[0].id === 'map')
    expect(docAt).toBe(mapAt + 1)
    const docFloor = fits[docAt].floor
    const sizes = fits.map((f) => f.floor)
    expect(sizes[mapAt]).toBeLessThan(docFloor) // so a 1:1 split lands under the document's floor
    const next = resetSeam({ sizes, fits, index: mapAt, preset })
    expect(next.sizes[docAt]).toBeGreaterThanOrEqual(docFloor)
    expect(next.sizes.reduce((s, w) => s + w, 0)).toBeCloseTo(sizes.reduce((s, w) => s + w, 0), 9)
  })
})
