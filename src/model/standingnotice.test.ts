import { describe, expect, it } from 'vitest'

import { CS2023_WALKS } from '../corpus/cs2023walks'
import { standingNotice } from './standingnotice'

const route = (description: string, stops = 1) => ({ description, stops: Array.from({ length: stops }, () => ({ id: 'x', note: '' })) })

describe('standingNotice — the cs2023 placement sentence', () => {
  it("returns the route description's own closing sentence", () => {
    expect(standingNotice(route('A course. Placements are AI-suggested and under the author\'s review.'), 'cs2023'))
      .toBe("Placements are AI-suggested and under the author's review.")
  })

  it('is null on the other corpora even when the sentence is there', () => {
    expect(standingNotice(route('A course. Placements are AI-suggested and under the author\'s review.'), 'teaching')).toBeNull()
  })

  it('is null for a route with no stops, no description, or no notice', () => {
    expect(standingNotice(route('A course.', 0), 'cs2023')).toBeNull()
    expect(standingNotice(route('A course with no notice'), 'cs2023')).toBeNull()
    expect(standingNotice(route(''), 'cs2023')).toBeNull()
    expect(standingNotice(null, 'cs2023')).toBeNull()
  })

  it('every cs2023 route with stops carries the notice, and the zero-stop one does not', () => {
    const expected = "Placements are AI-suggested and under the author's review."
    for (const walk of CS2023_WALKS) {
      if (!walk.stops.length) {
        expect(standingNotice(walk, 'cs2023'), walk.id).toBeNull()
        continue
      }
      expect(standingNotice(walk, 'cs2023'), walk.id).toBe(expected)
    }
  })
})
