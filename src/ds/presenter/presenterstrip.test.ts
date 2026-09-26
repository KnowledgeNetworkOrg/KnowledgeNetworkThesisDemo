// DS OB-246 — the presenter strip's OPEN row spans the row, the way the closed rail always has.
//
// The row used to place its dots at the constant `pitch` either side of centre, so a walk short
// enough to fit whole huddled in the middle of a wide pane, and a window clamped at either end
// stopped most of a pitch short of it. `pitch` is now a FLOOR: the parent still counts how many
// stops fit at it (`half`), and the row spreads exactly that many across the width it has.
//
// These tests RENDER the row (`renderToStaticMarkup` needs no DOM) and read each dot's `left`
// back out of the markup, so they check the drawing rather than restate the arithmetic.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, test } from 'vitest'

import { fillBounds, PRESENTER_STRIP_METRICS, PRESENTER_STRIP_PARTS } from './PresenterStrip'

const M = PRESENTER_STRIP_METRICS
const SIDE_PAD = 36 // half the 66px label plus its margin — the labelled end's inset

function row(n: number, opts: { width: number; center: number; half: number; active?: number }) {
  const steps = Array.from({ length: n }, (_, i) => ({ title: 'stop ' + (i + 1) }))
  const active = opts.active ?? 0
  const html = renderToStaticMarkup(createElement(PRESENTER_STRIP_PARTS.OpenRow, {
    steps, activeStop: active, roamingStop: null, flags: [], isDone: (i: number) => i < active, walked: () => false,
    holdMs: 600, onHover: () => {}, rowHot: false, width: opts.width, center: opts.center, half: opts.half,
  }))
  /** each laid-out dot's x, by stop index, and whether it is drawn (opacity 0 = overscan) */
  const dots = new Map<number, { x: number; opacity: number }>()
  for (const m of html.matchAll(/data-presenter-dot="(\d+)" style="position:absolute;left:([-\d.]+)px;[^"]*?opacity:([\d.]+)/g)) {
    dots.set(Number(m[1]), { x: Number(m[2]), opacity: Number(m[3]) })
  }
  const shown = [...dots.entries()].filter(([, d]) => d.opacity > 0).sort((a, b) => a[0] - b[0])
  return { html, dots, shown, pill: html.includes('active node</span>') }
}

describe('the open row spreads its window across the width (DS OB-246)', () => {
  test('a walk short enough to fit whole is spread edge to edge, not huddled at the centre', () => {
    const r = row(5, { width: 900, center: 2, half: 5 })
    expect(r.shown.map(([i]) => i)).toEqual([0, 1, 2, 3, 4])
    expect(r.shown[0][1].x).toBeCloseTo(SIDE_PAD, 6)
    expect(r.shown[4][1].x).toBeCloseTo(900 - SIDE_PAD, 6)
    // evenly: the drawn pitch is the usable span over the slots, and it is above the floor
    const pitch = r.shown[1][1].x - r.shown[0][1].x
    expect(pitch).toBeCloseTo((900 - 2 * SIDE_PAD) / 4, 6)
    expect(pitch).toBeGreaterThanOrEqual(M.pitch)
  })

  test('a long walk scrolled to either end still fills the row — no bare stretch past the last dot', () => {
    // clamped against the END: the last stop is labelled, so it sits at the labelled inset;
    // the first slot is a PEEK, inset only by the dot's own radius
    const end = row(40, { width: 900, center: 35, half: 5 })
    const endX = end.dots.get(39)!.x
    expect(endX).toBeCloseTo(900 - SIDE_PAD, 6)
    const peek = end.shown[0]
    expect(peek[1].opacity).toBe(M.peekOpacity)
    expect(peek[1].x).toBeCloseTo(M.stopDot / 2, 6)
    // and clamped against the START, mirrored
    const start = row(40, { width: 900, center: 5, half: 5 })
    expect(start.dots.get(0)!.x).toBeCloseTo(SIDE_PAD, 6)
    const last = start.shown[start.shown.length - 1]
    expect(last[1].opacity).toBe(M.peekOpacity)
    expect(last[1].x).toBeCloseTo(900 - M.stopDot / 2, 6)
  })

  test('the drawn spacing never falls below the floor, and the stop COUNT is the one the floor allows', () => {
    for (const width of [340, 574, 900, 1400]) {
      const half = Math.max(1, Math.floor(Math.max(1, Math.ceil((width - SIDE_PAD * 2) / M.pitch)) / 2) - 1)
      const r = row(60, { width, center: 30, half })
      const labelled = r.shown.filter(([, d]) => d.opacity === 1)
      expect(labelled.length, String(width)).toBe(2 * half + 1)
      const pitch = r.shown[1][1].x - r.shown[0][1].x
      expect(pitch, String(width)).toBeGreaterThanOrEqual(M.pitch)
    }
  })

  test('a centre set when the row was narrower is clamped INSIDE the walk — no slot past the last stop', () => {
    // the real sequence: the opening effect picked centre 37 at half 3 (the 600px default); the
    // row then measured wider and half became 5, whose ceiling for a 40-stop walk is 34
    const r = row(40, { width: 900, center: 37, half: 5 })
    const laidOut = [...r.dots.keys()]
    expect(Math.max(...laidOut)).toBe(39)
    // the last stop sits at the labelled inset, not a slot or two short of the row's end
    expect(r.dots.get(39)!.x).toBeCloseTo(900 - SIDE_PAD, 6)
    expect(r.shown.filter(([, d]) => d.opacity === 1).length).toBe(11)
  })

  test('the "back to the active node" pill asks the WINDOW, not where the pixel lands', () => {
    // inside the window at the row's first labelled dot: the old pixel test (x < pitch / 2) was
    // true of that dot once the pitch grew — no pill for a stop the reader can see
    expect(row(40, { width: 900, center: 5, half: 5, active: 0 }).pill).toBe(false)
    expect(row(40, { width: 900, center: 20, half: 5, active: 15 }).pill).toBe(false)
    // outside it, either side: the pill
    expect(row(40, { width: 900, center: 20, half: 5, active: 3 }).pill).toBe(true)
    expect(row(40, { width: 900, center: 20, half: 5, active: 30 }).pill).toBe(true)
  })
})

describe('fillBounds takes the drawn slots (DS OB-246)', () => {
  test('one segment past each outermost slot, clamped to the walk', () => {
    expect(fillBounds(14, 26, 40)).toEqual([13, 27])
    expect(fillBounds(0, 10, 40)).toEqual([0, 11])
    expect(fillBounds(28, 39, 40)).toEqual([27, 39])
  })
})
