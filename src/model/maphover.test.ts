// The map's hover rule, asserted directly (OB-127, #251).
//
// The obligation's done-when is behavioural — "hovering a tree row or a
// connections row highlights the matching territory and draws no tooltip there"
// — and this repo has no way to render a React component in a test: vitest runs
// in `node`, with no DOM and no testing-library. The same wall was hit on OB-128,
// and the answer there was the one taken here: lift the decision out of the
// component into a pure function, and assert the rule instead of a screenshot.
//
// The first two cases below ARE the done-when. The rest exist because the two
// hovers have to stay distinguishable when the next obligation adds a third
// (OB-131's walk preview, #246).

import { describe, expect, test } from 'vitest'

import { hoverMarks } from './maphover'
import type { HoverSources } from './maphover'

/** nothing hovered, nothing selected — every case below is this plus one thing. */
const NOTHING: HoverSources = {
  walkPinHovered: false,
  cursorCell: null,
  selectedCell: null,
  publishedCell: null,
  lookedAtCell: null,
  walkStopCell: null,
  onRelation: false,
}

describe('the card belongs to the cursor over THIS pane', () => {
  test('our own hover lights nothing extra and gets a node card', () => {
    const marks = hoverMarks({ ...NOTHING, cursorCell: 'topic-a' })

    expect(marks.card).toEqual({ kind: 'node', id: 'topic-a' })
    // our own hover draws the dashed preselect, which is not this function's
    // business; what matters is that it does not ALSO spotlight itself
    expect(marks.spotlightId).toBeNull()
  })

  test('a hover published by another pane lights the territory and draws NO card', () => {
    const marks = hoverMarks({ ...NOTHING, publishedCell: 'topic-a' })

    expect(marks.spotlightId).toBe('topic-a')
    expect(marks.card).toBeNull()
  })

  test('a cell clicked in another pane stays lit, and it draws no card either', () => {
    const marks = hoverMarks({ ...NOTHING, lookedAtCell: 'topic-b' })

    expect(marks.spotlightId).toBe('topic-b')
    expect(marks.card).toBeNull()
  })

  test('nothing hovered anywhere draws neither', () => {
    expect(hoverMarks(NOTHING)).toEqual({ spotlightId: null, centreId: null, card: null })
  })
})

describe('the two sources stay separable', () => {
  test('our cursor and a published hover at once: one card, and it is ours', () => {
    const marks = hoverMarks({ ...NOTHING, cursorCell: 'topic-a', publishedCell: 'topic-b' })

    expect(marks.spotlightId).toBe('topic-b')
    expect(marks.card).toEqual({ kind: 'node', id: 'topic-a' })
  })

  test('our own hover echoing back off the bus is not spotlit on top of itself', () => {
    const marks = hoverMarks({ ...NOTHING, cursorCell: 'topic-a', publishedCell: 'topic-a' })

    expect(marks.spotlightId).toBeNull()
    expect(marks.card).toEqual({ kind: 'node', id: 'topic-a' })
  })

  test('a look at the already-selected cell stands aside for the selection', () => {
    const marks = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', lookedAtCell: 'topic-c' })

    expect(marks.spotlightId).toBeNull()
  })

  test('a live published hover outranks a stale look', () => {
    const marks = hoverMarks({ ...NOTHING, publishedCell: 'topic-a', lookedAtCell: 'topic-b' })

    expect(marks.spotlightId).toBe('topic-a')
  })
})

describe('a relation under the pointer wins the card', () => {
  test('on a relation line over a cell, the card reports the relation', () => {
    const marks = hoverMarks({ ...NOTHING, cursorCell: 'topic-a', onRelation: true })

    expect(marks.card).toEqual({ kind: 'relation' })
  })

  test('a relation hover is still a cursor hover, so a published one cannot fake it', () => {
    const marks = hoverMarks({ ...NOTHING, publishedCell: 'topic-a', onRelation: false })

    expect(marks.card).toBeNull()
  })
})

describe('the walk’s own stop is a light, not a selection (DS OB-173)', () => {
  // Playing a walk writes the focus, and a focus is a SELECTION on the map — an outline plus
  // every relation the stop has, drawn across it. So playback was flashing a relationship
  // diagram over the walk on every stop. The owner asked for the hover's treatment instead.
  // The map decides `walkStopCell` (only while a walk is actually on it); this file decides
  // what that light beats and what beats it.
  test('a walk stop lights the map like a published hover does', () => {
    const marks = hoverMarks({ ...NOTHING, walkStopCell: 'stop-3' })
    expect(marks.spotlightId).toBe('stop-3')
  })

  test('and never raises a card — nobody is pointing at it', () => {
    // the same rule OB-127 set for a published hover: a card is FOR a cursor over this pane.
    expect(hoverMarks({ ...NOTHING, walkStopCell: 'stop-3' }).card).toBeNull()
  })

  test('a cursor somewhere ELSE does not put the walk’s light out', () => {
    // Two different questions, two different answers, both worth drawing: the walk marks
    // where the lecture is, the cursor marks what the hand is asking about. The same rule a
    // published hover already follows.
    const marks = hoverMarks({ ...NOTHING, walkStopCell: 'stop-3', cursorCell: 'topic-a' })
    expect(marks.spotlightId).toBe('stop-3')
    expect(marks.card).toEqual({ kind: 'node', id: 'topic-a' })
  })

  test('another pane\'s live hover beats it too', () => {
    expect(hoverMarks({ ...NOTHING, walkStopCell: 'stop-3', publishedCell: 'topic-b' }).spotlightId).toBe('topic-b')
  })

  test('but it beats the LOOK, which is the older answer to \'where are we\'', () => {
    expect(hoverMarks({ ...NOTHING, walkStopCell: 'stop-3', lookedAtCell: 'topic-c' }).spotlightId).toBe('stop-3')
  })

  test('the walk standing on the cell our own cursor is on lights nothing twice', () => {
    // two treatments on one cell read as a bug — the same reason a published hover that is
    // only our own cell echoing back is dropped.
    expect(hoverMarks({ ...NOTHING, walkStopCell: 'topic-a', cursorCell: 'topic-a' }).spotlightId).toBeNull()
  })

  test('no walk on the map is no light — nothing is left stuck on', () => {
    expect(hoverMarks({ ...NOTHING, walkStopCell: null }).spotlightId).toBeNull()
  })
})

describe('the centre is its own channel (DS OB-230)', () => {
  // The document's Relations figure lights the map two ways: a NEIGHBOUR through the published
  // hover (the road to it and its cell), and the node the document is ABOUT through a separate
  // centre signal. Folding the centre into the published hover would light every road around
  // the selection at once — the highlight meaning only "something is hovered".
  test('the centre signal lights the selected cell, and nothing else', () => {
    const marks = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', centerLit: true })
    expect(marks.centreId).toBe('topic-c')
    expect(marks.spotlightId).toBeNull()
    expect(marks.card).toBeNull()
  })

  test('with nothing selected it lights nothing rather than guessing a cell', () => {
    expect(hoverMarks({ ...NOTHING, centerLit: true }).centreId).toBeNull()
  })

  test('without the signal the selection is never lit by it, however much else is hovered', () => {
    const marks = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', publishedCell: 'topic-a' })
    expect(marks.centreId).toBeNull()
    expect(marks.spotlightId).toBe('topic-a')
  })

  test('a neighbour and the centre can be lit at once, each on its own channel', () => {
    const marks = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', publishedCell: 'topic-a', centerLit: true })
    expect(marks.centreId).toBe('topic-c')
    expect(marks.spotlightId).toBe('topic-a')
  })

  test('dropping the signal drops the light — nothing outlives the hover', () => {
    const lit = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', centerLit: true })
    const after = hoverMarks({ ...NOTHING, selectedCell: 'topic-c', centerLit: false })
    expect(lit.centreId).toBe('topic-c')
    expect(after.centreId).toBeNull()
  })
})

describe('a walk pin\'s preview wins the pointer (DS OB-184 clause 4)', () => {
  // Entering a pin leaves the cell under it, so the cell's card went as the pin's came — by
  // accident. This is the stated rule: ONE CARD PER POINTER, and the pin's is the one the
  // pointer is on. The spotlight is untouched: a pin hover is the weakest channel on the pane.
  test('while a pin is hovered the cell\'s card stays down, even with a cursor cell', () => {
    expect(hoverMarks({ ...NOTHING, cursorCell: 'topic-a', walkPinHovered: true }).card).toBeNull()
  })

  test('and a relation under the pointer does not get a card either', () => {
    expect(hoverMarks({ ...NOTHING, onRelation: true, walkPinHovered: true }).card).toBeNull()
  })

  test('the spotlight is untouched by it', () => {
    const marks = hoverMarks({ ...NOTHING, walkStopCell: 'stop-3', walkPinHovered: true })
    expect(marks.spotlightId).toBe('stop-3')
  })

  test('the card comes back the moment the pointer leaves the pin', () => {
    expect(hoverMarks({ ...NOTHING, cursorCell: 'topic-a', walkPinHovered: false }).card).toEqual({ kind: 'node', id: 'topic-a' })
  })
})
