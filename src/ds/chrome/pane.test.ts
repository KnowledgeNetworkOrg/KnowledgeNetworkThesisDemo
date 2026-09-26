import { describe, it, expect } from 'vitest'
import { isHairlineRule, scrollerPadRight, SCROLLBAR_ROOM } from './Pane'
import paneSource from './Pane.tsx?raw'
import groupSource from '../group/VersionedGroup.tsx?raw'
import notesSource from '../presenter/LectureNotes.tsx?raw'
import recapSource from '../presenter/LectureRecap.tsx?raw'
import railSource from '../connections/RailFrame.tsx?raw'
import pickerSource from '../graph/NodePicker.tsx?raw'
import finderSource from '../presenter/StopFinder.tsx?raw'

/* OB-141: the body audit must not call a hairline divider a face.
 *
 * WHY THIS TESTS A PREDICATE AND NOT THE AUDIT. `auditBody` reads `getComputedStyle` and
 * `getBoundingClientRect` off a mounted pane, and vitest runs in `node` with no DOM (jsdom is
 * not installed, and even under jsdom every rect measures 0×0, which would make EVERY child a
 * hairline and the "a real filled child still warns" case impossible to state). So the one
 * line of the audit that carries the threshold is a named, exported function, and the
 * threshold is what gets pinned here. The wiring — that the loop actually consults it before
 * the face check — is asserted from the source text, read through Vite's `?raw` import so this
 * stays an app-project test rather than a node program. */

describe('OB-141 — a rule is not a face', () => {
  it('a 1px-tall divider is a rule, so the face check skips it', () => {
    expect(isHairlineRule({ width: 320, height: 1 })).toBe(true)
  })

  it('a hairline that renders under a pixel is still a rule', () => {
    expect(isHairlineRule({ width: 320, height: 0.5 })).toBe(true)
  })

  it('a 1px-wide vertical rule is the same case turned sideways', () => {
    // OB-141's text says height OR width; the DS's .jsx reads height alone. Ported both.
    expect(isHairlineRule({ width: 1, height: 240 })).toBe(true)
  })

  it('a real filled child is NOT a rule — the face check must still reach it', () => {
    expect(isHairlineRule({ width: 320, height: 240 })).toBe(false)
    // the smallest box that is not a rule: two pixels either way
    expect(isHairlineRule({ width: 2, height: 2 })).toBe(false)
  })

  it('the audit loop consults the predicate BEFORE it reads the background', () => {
    const src = paneSource.replace(/\r\n/g, '\n')
    const loop = src.slice(src.indexOf('for (const el of bodyChrome(body))'))
    const skip = loop.indexOf('isHairlineRule(el.getBoundingClientRect())')
    const face = loop.indexOf('getComputedStyle(el).backgroundColor')
    expect(skip).toBeGreaterThan(-1)
    expect(face).toBeGreaterThan(-1)
    expect(skip).toBeLessThan(face)
  })
})

/* OB-210: in Firefox a thin scrollbar takes no layout space, so `scrollbar-gutter: stable`
 * reserves nothing and every scrolling column drew its last ~8px under its own thumb. The fix
 * is one conditional pad, and the numbers it answers are measured in a browser (the receipt's
 * two readings); what is pinned here is that there is ONE of it and the callers ask it rather
 * than hand-picking. vitest runs in node with no DOM, where `scrollbarWidth()` measures
 * nothing and reads 0 — the overlay-bar branch. */
describe('OB-210 — a scrolling column clears a scrollbar that takes no space', () => {
  it('with no bar width to reserve, the column holds off SCROLLBAR_ROOM', () => {
    expect(SCROLLBAR_ROOM).toBe(10)
    expect(scrollerPadRight()).toBe(SCROLLBAR_ROOM)
  })

  it('scrollbarWidth has exactly one implementation, in Pane; VersionedGroup re-exports it', () => {
    expect(paneSource.match(/function scrollbarWidth/g)?.length).toBe(1)
    expect(groupSource).not.toMatch(/function scrollbarWidth/)
    expect(groupSource).toContain("import { scrollbarWidth } from '../chrome/Pane'")
  })

  it('PaneScroller applies the pad unless the caller priced its own', () => {
    const src = paneSource.replace(/\r\n/g, '\n')
    expect(src).toContain("style && style.paddingRight != null ? style.paddingRight : (axis === 'x' ? 0 : scrollerPadRight())")
    expect(src).toMatch(/\.\.\.style,\n\s*paddingRight: padRight,/)
  })

  it('the three presenter columns dropped their hand-picked 6px', () => {
    expect(notesSource).not.toContain('paddingRight: 6')
    expect(recapSource).not.toContain('paddingRight: 6')
  })

  it('the rails, the node picker and the stop finder ask scrollerPadRight()', () => {
    for (const src of [railSource, pickerSource, finderSource]) expect(src).toContain('+ scrollerPadRight()')
  })
})
