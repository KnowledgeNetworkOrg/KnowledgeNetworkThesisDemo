// The recap does its own wording, and these are the two rules a host must never have to
// retype: the clock and the plurals. Both are pure functions the DS moved into code
// precisely so a second host could not word them differently (OB-147, #267).

import { describe, expect, it } from 'vitest'

import { LectureClock, RecapMath, recapStats } from './LectureRecap'

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min, 0, 0).getTime()

describe('the lecture clock', () => {
  it('says elapsed time as mm:ss, floored and padded', () => {
    expect(LectureClock.mmss(0)).toBe('00:00')
    expect(LectureClock.mmss(9.9)).toBe('00:09')
    expect(LectureClock.mmss(65)).toBe('01:05')
    expect(LectureClock.mmss(3000)).toBe('50:00')
  })

  it('never prints a negative or a nonsense clock', () => {
    expect(LectureClock.mmss(-40)).toBe('00:00')
    expect(LectureClock.mmss(Number.NaN)).toBe('00:00')
  })

  it('reads the wall clock in 24 hours, with no commas', () => {
    expect(LectureClock.clockLabel(at(2026, 9, 4, 13, 12))).toBe('13:12')
    expect(LectureClock.clockLabel(at(2026, 9, 4, 9, 5))).toBe('09:05')
    // the dated form is "Fri 4 Sep 2026 13:12" — weekday and month come from the locale's
    // short names, so the test pins the SHAPE and the parts it owns rather than the words
    const dated = LectureClock.clockLabel(at(2026, 9, 4, 13, 12), true)
    expect(dated).toMatch(/^\S+ 4 \S+ 2026 13:12$/)
  })

  it('says the date once when the lecture began and ended on the same day', () => {
    const span = LectureClock.span(at(2026, 9, 4, 13, 12), at(2026, 9, 4, 14, 2))
    expect(span.started).toMatch(/2026 13:12$/)
    expect(span.ended).toBe('14:02')
  })

  it('says it TWICE across a day boundary — a lecture that ended after midnight', () => {
    const span = LectureClock.span(at(2026, 9, 4, 23, 40), at(2026, 9, 5, 0, 25))
    expect(span.started).toMatch(/ 4 \S+ 2026 23:40$/)
    expect(span.ended).toMatch(/ 5 \S+ 2026 00:25$/)
  })

  it('gives back only the half it was given', () => {
    expect(LectureClock.span(at(2026, 9, 4, 13, 12), null)).toEqual({ started: expect.stringMatching(/13:12$/) })
    expect(LectureClock.span(null, null)).toEqual({})
  })
})

describe('the recap wording', () => {
  it('decides the plurals so the host does not', () => {
    expect(recapStats({ stops: 1, slides: 1, flags: 1 }).map((s) => s.label))
      .toEqual(['stop covered', 'slide flagged', 'flag'])
    expect(recapStats({ stops: 0, slides: 3, flags: 12 }).map((s) => s.label))
      .toEqual(['stops covered', 'slides flagged', 'flags'])
  })

  it('passes the numbers straight through — a recap that recounted would be a second source', () => {
    expect(recapStats({ stops: 7, slides: 2, flags: 4 }).map((s) => s.value)).toEqual([7, 2, 4])
  })

  it('still reads the old counts when a host has not moved to flags yet', () => {
    expect(recapStats({ stops: 1, notes: 1, flagged: 1 }).map((s) => s.label))
      .toEqual(['stop covered', 'note taken', 'slide flagged'])
    expect(recapStats({ stops: 7, notes: 4, flagged: 2 }).map((s) => s.value)).toEqual([7, 4, 2])
  })

  it('words where next time picks up with the start card\'s own resolver', () => {
    const words = (runs: [string, boolean][] | null) => (runs ? runs.map((r) => r[0]).join('') : null)
    expect(RecapMath.nextTime(undefined)).toBeNull()
    expect(words(RecapMath.nextTime({ walkId: 'f', walk: 'Forwarding', stop: 3, of: 7, stopTitle: 'Distance vector' })))
      .toBe('Next time, continue picks up at Forwarding, stop 4 of 7 – Distance vector')
    expect(words(RecapMath.nextTime({ walkId: 'f', walk: 'Forwarding', stop: 6, of: 7 }))).toBe('Finished the walk Forwarding')
  })
})
