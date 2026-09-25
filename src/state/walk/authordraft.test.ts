// #92 — id-based version lookup so deleting a variant never silently retargets
// the active one. chosenIdx is the single place choices are resolved; testing
// it covers every consumer (promote, gapFor, extractVariant, resolveRoad).

import { describe, expect, test } from 'vitest'

import { chosenIdx } from './mockwalk'
import type { Stop } from './mockwalk'

function fork(...ids: string[]): Stop {
  return {
    key: 'c',
    title: 'container',
    variants: ids.map((id, i) => ({ id, label: `v${i + 1}`, steps: [] })),
  }
}

describe('chosenIdx — id-based lookup (#92)', () => {
  test('finds the version with the matching id', () => {
    const s = fork('a', 'b', 'c')
    expect(chosenIdx(s, { c: 'b' })).toBe(1)
  })

  test('returns 0 when no choice is stored (default road)', () => {
    const s = fork('a', 'b', 'c')
    expect(chosenIdx(s, {})).toBe(0)
  })

  test('returns 0 when the stored id is not found (version deleted)', () => {
    // choices still holds 'b', but 'b' was deleted from the container
    const s = fork('a', 'c')
    expect(chosenIdx(s, { c: 'b' })).toBe(0)
  })

  test('#92 scenario: delete-above does not shift the active version', () => {
    // three versions [a, b, c]; user picks b → choices = { c: 'b' }
    const before = fork('a', 'b', 'c')
    expect(chosenIdx(before, { c: 'b' })).toBe(1)

    // delete 'a' (index 0) — remaining array is [b, c]
    const after = fork('b', 'c')
    // id-based: 'b' is now at index 0 → correct
    // old index-based: stored 1 would point at 'c' → wrong
    expect(chosenIdx(after, { c: 'b' })).toBe(0)
    expect(after.variants[chosenIdx(after, { c: 'b' })].id).toBe('b')
  })
})
