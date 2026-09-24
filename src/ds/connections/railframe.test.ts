// railframe.test.ts — `railWidth`'s two rules, as arithmetic (reviewer-asked on #372).
//
// A dragged width is CAPPED AT `stretch`, and it is still clamped by `paneW - keep`: a width
// chosen in a wide pane must never starve a narrow one. Both are silent when broken — the seam
// simply draws a slightly different number, and the browser driver's +80px drag at one pane
// width cannot see either — so they are pinned here rather than described in a comment.

import { describe, expect, it } from 'vitest'

import { PANE_RAIL_METRICS, railWidth } from './RailFrame'

const L = PANE_RAIL_METRICS.left

describe('railWidth — the fit, the stretch cap and the pane clamp', () => {
  it('with no dragged width it fits the rail itself, at its own max', () => {
    expect(railWidth('left', 2000, null)).toBe(L.max)
  })

  it('caps a dragged width at `stretch`, however wide the pane is', () => {
    expect(railWidth('left', 2000, 900)).toBe(L.stretch)
  })

  it('a dragged width is still clamped by `paneW - keep`', () => {
    expect(railWidth('left', 400, 900)).toBe(400 - L.keep)
  })

  it('never goes under the rail\'s own minimum, even in a pane with no room to give', () => {
    expect(railWidth('left', 300, null)).toBe(L.min)
  })

  it('an unmeasured pane (0) counts as room — nothing to clamp against yet', () => {
    expect(railWidth('left', 0, 900)).toBe(L.stretch)
  })

  it('the right rail carries its own numbers, not the left\'s', () => {
    expect(railWidth('right', 2000, 900)).toBe(PANE_RAIL_METRICS.right.stretch)
    expect(PANE_RAIL_METRICS.right.stretch).not.toBe(L.stretch)
  })
})
