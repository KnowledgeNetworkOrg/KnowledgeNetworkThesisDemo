import { describe, expect, it } from 'vitest'

import { connectionsHighlight, previewGutter, previewPlacement } from './ConnectionsRails'

/* Pure functions, so they are tested directly — the same choice pane.test.ts makes for the audit's
   one testable line. The placement is the pair of rules a port gets wrong: it SLIDES instead of
   flipping, and beside a figure it anchors to the larger gutter. */
const rect = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect
const avoid = { left: 500, right: 700, top: 100, bottom: 400, width: 200, height: 300 } as DOMRect

describe('previewPlacement — it slides, it never flips', () => {
  it('anchors the card at the pointer, clear of the cursor', () => {
    expect(previewPlacement(100, 100, rect)).toEqual({ x: 114, y: 114 })
  })

  it('slides back by the overhang near an edge rather than moving across the pointer', () => {
    /* raw x = 790 + 14 = 804; the right clamp is 800 - 262 - 4 = 534. Flipping would put the card
       left of the pointer — the placement this rule exists to prevent. */
    expect(previewPlacement(790, 100, rect).x).toBe(534)
    /* raw y = 595 + 14 = 609; the bottom clamp is 600 - 112 - 4 = 484. */
    expect(previewPlacement(100, 595, rect).y).toBe(484)
  })

  it('beside a figure it takes the larger gutter and follows the pointer only vertically', () => {
    /* leftRoom = 500 - 8 = 492 against rightRoom = 800 - 700 - 8 = 92: left wins, and the card
       sits against the figure's left edge, offset by offsetX. */
    expect(previewPlacement(400, 300, rect, avoid)).toEqual({ x: 500 - 262 - 14, y: 300 - 56 })
    /* a figure against the left edge mirrors it: the right gutter is larger, so the card sits to
       its right. */
    const leftFigure = { left: 20, right: 220, top: 100, bottom: 400, width: 200, height: 300 } as DOMRect
    expect(previewPlacement(100, 300, rect, leftFigure).x).toBe(220 + 14)
  })
})

describe('previewGutter — anchoring is half the fix; the card must be sized too', () => {
  it('caps at the card box when the gutter is generous', () => {
    expect(previewGutter(1000, 200)).toBe(262)
  })
  it('floors at `min` when the pane cannot hold both, where the honest answer is the rail should close', () => {
    expect(previewGutter(500, 400, 120)).toBe(120)
    expect(previewGutter(500, 400)).toBe(180)
  })
})

describe('connectionsHighlight — one answer to what is lit', () => {
  it('a hover on the aimed node is not an external highlight, and the centre lights on its own signal', () => {
    expect(connectionsHighlight({ aimId: 'a', graphHoverId: 'a' })).toEqual({ highlightId: null, centerHighlight: true, filterTargetId: null })
    expect(connectionsHighlight({ graphHoverId: 'focus' })).toEqual({ highlightId: null, centerHighlight: true, filterTargetId: null })
  })
  it('an external hover lights and filters; a pin outlives a hover but loses to one', () => {
    expect(connectionsHighlight({ aimId: 'a', graphHoverId: 'b' })).toEqual({ highlightId: 'b', centerHighlight: false, filterTargetId: 'b' })
    expect(connectionsHighlight({ pinnedId: 'p' })).toEqual({ highlightId: 'p', centerHighlight: false, filterTargetId: 'p' })
    expect(connectionsHighlight({ treeHoverId: 't', pinnedId: 'p' })).toEqual({ highlightId: 't', centerHighlight: false, filterTargetId: 'p' })
  })
  it('a tree hover lights without filtering', () => {
    expect(connectionsHighlight({ treeHoverId: 't' }).filterTargetId).toBe(null)
  })
})
