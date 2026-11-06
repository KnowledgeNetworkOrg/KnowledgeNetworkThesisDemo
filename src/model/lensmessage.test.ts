import { describe, expect, it } from 'vitest'

import { nonTopicLensMessage } from './lensmessage'

describe('nonTopicLensMessage — a lens centred on a place that is not a topic', () => {
  it('names the enclosing knowledge unit for a stop inside one', () => {
    expect(nonTopicLensMessage({ corpus: 'cs2023', isScience: false, enclosingTitle: 'Digital Logic' }))
      .toBe('this place sits inside Digital Logic — lenses read its knowledge unit')
  })

  it('calls a place with no unit ancestor an area', () => {
    expect(nonTopicLensMessage({ corpus: 'cs2023', isScience: false }))
      .toBe('this place is an area — lenses read its knowledge units')
  })

  it('gives the Science exception group its own wording, never an area claim', () => {
    expect(nonTopicLensMessage({ corpus: 'cs2023', isScience: true }))
      .toBe('Science is outside CS2023 — it has no knowledge units for the lenses to read')
  })

  it('leaves the topic corpora wording unchanged', () => {
    expect(nonTopicLensMessage({ corpus: 'teaching', isScience: false }))
      .toBe('lenses read topics — typed links live at the topic level')
    expect(nonTopicLensMessage({ corpus: 'courses', isScience: false, enclosingTitle: 'Anything' }))
      .toBe('lenses read topics — typed links live at the topic level')
  })
})
