import { describe, expect, it } from 'vitest'

import { PLACEMENT_NOTICE, standingNotice } from './standingnotice'

const route = (description: string) => ({ description })

describe('standingNotice — the cs2023 placement sentence', () => {
  it("returns the route description's own tail", () => {
    const description = `A course. ${PLACEMENT_NOTICE}`
    expect(standingNotice(route(description), 'cs2023')).toBe(PLACEMENT_NOTICE)
  })

  it('is null on the other corpora even when the sentence is there', () => {
    expect(standingNotice(route(`A course. ${PLACEMENT_NOTICE}`), 'teaching')).toBeNull()
    expect(standingNotice(route(`A course. ${PLACEMENT_NOTICE}`), 'courses')).toBeNull()
  })

  it('is null when the route does not carry it', () => {
    expect(standingNotice(route('A course with no notice.'), 'cs2023')).toBeNull()
    expect(standingNotice(route(''), 'cs2023')).toBeNull()
    expect(standingNotice(null, 'cs2023')).toBeNull()
  })
})
