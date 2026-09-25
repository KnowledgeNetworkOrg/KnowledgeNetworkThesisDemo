// Not the #160 bug itself, but the same class of defect and the same
// neighbourhood: a y-fraction read off a bounding rect and compared against
// fixed thresholds, sitting right beside AuthorRoad's marquee guard — the
// other half of what #160 found broken. Locking in the 0.3/0.5/0.7 split so a
// future edit here can't silently retarget where a drop lands without a test
// noticing.

import { describe, expect, test } from 'vitest'

import { bandFor, gapFor } from './authordnd'
import type { Stop } from './mockwalk'

type DragLike = Parameters<typeof bandFor>[0]
function fakeDrag(clientY: number, top: number, height: number): DragLike {
  return { clientY, currentTarget: { getBoundingClientRect: () => ({ top, height }) } } as unknown as DragLike
}

const leaf: Stop = { node: 'leaf-node', variants: [] }

const container: Stop = {
  key: 'c',
  title: 'Container',
  variants: [
    { id: 'v0', label: 'a', steps: [{ node: 'n1', variants: [] }, { node: 'n2', variants: [] }] },
    { id: 'v1', label: 'b', steps: [] },
  ],
}

describe('bandFor', () => {
  test('a leaf is never "inside" — before/after split at the midline', () => {
    expect(bandFor(fakeDrag(20, 0, 100), leaf)).toBe('before')
    expect(bandFor(fakeDrag(80, 0, 100), leaf)).toBe('after')
    expect(bandFor(fakeDrag(50, 0, 100), leaf)).toBe('after') // y===0.5 is NOT < 0.5
  })

  test('a container is "inside" only strictly between 0.3 and 0.7', () => {
    expect(bandFor(fakeDrag(50, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(31, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(69, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(30, 0, 100), container)).toBe('before') // boundary excluded
    expect(bandFor(fakeDrag(70, 0, 100), container)).toBe('after') // boundary excluded
    expect(bandFor(fakeDrag(10, 0, 100), container)).toBe('before')
    expect(bandFor(fakeDrag(90, 0, 100), container)).toBe('after')
  })
})

describe('gapFor', () => {
  test('top-level leaf, before vs after', () => {
    expect(gapFor(fakeDrag(20, 0, 100), [2], leaf, {})).toEqual([2])
    expect(gapFor(fakeDrag(80, 0, 100), [2], leaf, {})).toEqual([3])
  })

  test('nested leaf keeps its parent path, only the last index moves', () => {
    expect(gapFor(fakeDrag(80, 0, 100), [1, 2], leaf, {})).toEqual([1, 3])
  })

  test('dropping inside a container lands at the end of its CHOSEN variant', () => {
    // choices={} → chosenIdx defaults to 0 → v0's 2 steps → append at index 2
    expect(gapFor(fakeDrag(50, 0, 100), [0], container, {})).toEqual([0, 0, 2])
  })

  test('dropping on a container outside the middle band still falls back to before/after', () => {
    expect(gapFor(fakeDrag(10, 0, 100), [0], container, {})).toEqual([0])
    expect(gapFor(fakeDrag(90, 0, 100), [0], container, {})).toEqual([1])
  })

  test('inside-drop respects an explicit choice, not just the default variant', () => {
    expect(gapFor(fakeDrag(50, 0, 100), [0], container, { c: 'v1' })).toEqual([0, 1, 0])
  })
})
