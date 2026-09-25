import { describe, expect, it } from 'vitest'

import { WALKS } from '../corpus/walks'
import { DOC_BODY } from '../corpus/docs'
import { byId, domainOf } from '../corpus/graph'
import { playSteps } from '../state/walk/playback'
import { BOOKED_SECONDS, clampStop, coveredBefore, lectureStart, lectureSteps, mmss } from './lecture'

/* #267 (DS OB-135) — the pure half of presenter mode, asked directly. */

describe('mmss — the clocks', () => {
  it('pads both halves, floors, and clamps at zero', () => {
    expect(mmss(0)).toBe('00:00')
    expect(mmss(19.9)).toBe('00:19')
    expect(mmss(BOOKED_SECONDS)).toBe('50:00')
    expect(mmss(21 * 60 + 5)).toBe('21:05')
    expect(mmss(-4)).toBe('00:00')
  })
})

describe('lectureSteps — the walk being played, as the presenter reads it', () => {
  const walk = WALKS[0]
  const steps = lectureSteps(playSteps(walk, []), walk.title)
  it('one lecture stop per played step, in order, with the corpus title', () => {
    expect(steps.map((s) => s.id)).toEqual(walk.stops.map((s) => s.id))
    expect(steps[0].title).toBe(byId.get(walk.stops[0].id)!.title)
  })
  it('names the territory as the stop\'s domain and gives it the domain\'s ring hue', () => {
    for (const s of steps) {
      expect(s.territory).toBe(byId.get(domainOf(s.id))!.title)
      expect(typeof s.hue).toBe('string')
    }
  })
  it('carries the stop\'s own note and the walk\'s name for the foot', () => {
    expect(steps[0].note).toBe(walk.stops[0].note)
    expect(steps.every((s) => s.walk === walk.title)).toBe(true)
  })

  it('carries the NODE\'S DOCUMENT for the slide, not the walk\'s note (DS OB-172)', () => {
    // What the room sees is the corpus, not the tour through it — the owner's ruling closing
    // #217. The two are different strings for the same stop, so this asserts the IDENTITY
    // rather than just "something non-empty": a slide printing the note again would pass a
    // presence check and still be showing the wrong thing.
    expect(steps[0].document).toBe(DOC_BODY[walk.stops[0].id])
    expect(steps[0].document).not.toBe(steps[0].note)
  })
})

describe('every stop the room can be shown has a document to show (DS OB-172)', () => {
  // `lectureSteps` falls back to '' for a stop with no authored body, which on a projected
  // wall is a blank slide in front of a room. That fallback must never fire, so the corpus is
  // asserted rather than the fallback trusted: every stop of every authored walk carries one.
  it('no authored walk has a stop whose document is missing or empty', () => {
    const blank: string[] = []
    for (const w of WALKS) {
      for (const st of lectureSteps(playSteps(w, []), w.title)) {
        if (!st.document || !st.document.trim()) blank.push(w.title + ' -> ' + st.id)
      }
    }
    expect(blank, 'these stops would project a blank slide: ' + blank.join(', ')).toEqual([])
  })

  it('and the walks it checked were not an empty set', () => {
    // the guard on the guard: zero walks would make the sweep above pass saying nothing.
    expect(WALKS.length).toBeGreaterThan(0)
    expect(WALKS.every((w) => w.stops.length > 0)).toBe(true)
  })
})

describe('lectureStart / coveredBefore / clampStop', () => {
  const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('starts at the focus when it is a stop of the walk, else at the first stop', () => {
    expect(lectureStart(steps, 'b')).toBe(1)
    expect(lectureStart(steps, 'zzz')).toBe(0)
    expect(lectureStart(steps, null)).toBe(0)
    expect(lectureStart([], 'a')).toBe(0)
  })
  it('a lecture starting at stop 3 takes stops 1 and 2 as covered', () => {
    expect(coveredBefore(2)).toEqual([0, 1])
    expect(coveredBefore(0)).toEqual([])
  })
  it('clamps into the walk, and to 0 for an empty one', () => {
    expect(clampStop(5, 3)).toBe(2)
    expect(clampStop(-1, 3)).toBe(0)
    expect(clampStop(2, 0)).toBe(0)
  })
})
