// #246 (OB-133, OB-131) — the shared parts' pure rules and the preview's geometry.
// #345 (OB-196) — the transport's third state: when a walk counts as finished, and
// which glyph the button draws for it.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { PAUSE_PATH, PLAY_PATH, PlayToggle, REPLAY_PATH, WALK_HOVER_GROW, WALK_ROW_HOVER_GROW, stopInk, stopState, walkComplete, walkHoverStyle } from './WalkParts'
import type { PlayToggleProps } from './WalkParts'
import { PREVIEW_GAP, previewAnchor } from './WalkPreview'

describe('walkComplete — the replay is offered on the last stop, never a stop early or late', () => {
  it('a walk of fewer than two stops is never complete: there is nothing to replay', () => {
    expect(walkComplete(0, 0)).toBe(false)
    expect(walkComplete(0, 1)).toBe(false)
    expect(walkComplete(5, 1)).toBe(false)
  })

  it('true on the last stop, false one stop before it', () => {
    expect(walkComplete(4, 5)).toBe(true)
    expect(walkComplete(3, 5)).toBe(false)
    expect(walkComplete(0, 2)).toBe(false)
    expect(walkComplete(1, 2)).toBe(true)
  })

  it('reads the FRACTIONAL position: travelling toward the last stop is not arriving at it', () => {
    expect(walkComplete(3.5, 5)).toBe(false)
    expect(walkComplete(3.999, 5)).toBe(false)
    // a caller's own float arithmetic landing a hair short still counts — the walkArrival epsilon
    expect(walkComplete(4 - 1e-12, 5)).toBe(true)
  })
})

describe('PlayToggle — three glyphs on one button, and playing wins', () => {
  const draw = (props: PlayToggleProps) => renderToStaticMarkup(createElement(PlayToggle, props))

  it('draws play at rest, pause while playing', () => {
    expect(draw({})).toContain(`d="${PLAY_PATH}"`)
    expect(draw({})).toContain('aria-label="play the walk"')
    expect(draw({ playing: true })).toContain(`d="${PAUSE_PATH}"`)
  })

  it('draws the replay arrow for a completed walk, with its own label', () => {
    const m = draw({ completed: true })
    expect(m).toContain(`d="${REPLAY_PATH}"`)
    expect(m).toContain('aria-label="replay the walk from the start"')
    expect(m).not.toContain(`d="${PLAY_PATH}"`)
  })

  it('a completed walk being played again shows a pause, not the replay', () => {
    const m = draw({ playing: true, completed: true })
    expect(m).toContain(`d="${PAUSE_PATH}"`)
    expect(m).not.toContain(`d="${REPLAY_PATH}"`)
  })
})

describe('stopState / stopInk — one ladder for every surface', () => {
  it('behind is done, on is current, past is ahead', () => {
    expect(stopState(1, 3)).toBe('done')
    expect(stopState(3, 3)).toBe('current')
    expect(stopState(4, 3)).toBe('ahead')
  })

  it('ink follows the state', () => {
    expect(stopInk('current')).toBe('var(--text-walk)')
    expect(stopInk('done')).toBe('var(--text-2)')
    expect(stopInk('ahead')).toBe('var(--text-3)')
  })
})

describe('walkHoverStyle — the fragment that keeps the numeral from jiggling', () => {
  it('carries translateZ(0), the whole fix, and the prefix ahead of the scale', () => {
    const s = walkHoverStyle(WALK_HOVER_GROW)
    expect(s.transform).toBe('scale(1.18) translateZ(0)')
    expect(s.backfaceVisibility).toBe('hidden')
    expect(walkHoverStyle(WALK_ROW_HOVER_GROW, 'translate(-50%, 0)').transform).toBe('translate(-50%, 0) scale(1.08) translateZ(0)')
  })
})

describe('previewAnchor — a discrete hover anchors on its element', () => {
  it('centred on the box, on its top edge', () => {
    expect(previewAnchor({ left: 100, top: 40, width: 20 })).toEqual({ x: 110, top: 40 })
    expect(PREVIEW_GAP).toBe(12)
  })
})
