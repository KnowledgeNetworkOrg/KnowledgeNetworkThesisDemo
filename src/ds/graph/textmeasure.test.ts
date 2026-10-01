import { describe, expect, it } from 'vitest'
import { canMeasure, clampToLines, linesOf, linesOfBlock, measure, wrappedLines, WRAP_SAFETY_PX } from './textMeasure'
import { chipSize, WRAP_SAFETY_PX as CHIP_WRAP_SAFETY_PX } from './NodeChip'

/* OB-110 (#256) — the DS's one canvas predictor, shared by NodeChip and VersionedGroup. Vitest
 * runs with no document, so every number here comes from the 0.55em fallback the file promises
 * for exactly that case; what is pinned is the arithmetic and the two rules that differ between
 * the block and normal readings, not a font. */

describe('textMeasure with no document', () => {
  it('measure() falls back to 0.55em per character and says so through canMeasure()', () => {
    expect(measure('abcd', 600, 10, 'ui')).toBeCloseTo(4 * 10 * 0.55)
    expect(measure('', 600, 10, 'ui')).toBe(0)
    expect(canMeasure()).toBe(false)
  })

  it('wrappedLines() breaks at words first, and only a word wider than the column inside itself', () => {
    // each character is 5.5px at 10px: "aaaa bbbb" is 49.5px wide, each word 22px
    expect(wrappedLines('aaaa bbbb', 60, 400, 10, 'ui')).toBe(1)
    expect(wrappedLines('aaaa bbbb', 30, 400, 10, 'ui')).toBe(2)
    // a 12-char word at 66px in a 30px column takes three lines on its own
    expect(wrappedLines('aaaaaaaaaaaa', 30, 400, 10, 'ui')).toBe(3)
    expect(wrappedLines('', 30, 400, 10, 'ui')).toBe(1)
  })

  /* OB-217 — Firefox's canvas measureText undershoots its own DOM layout by ~0.24-0.48px, so a run
   * that measures as fitting a column by a hair can really overflow it. There is no way to feed
   * this file a Firefox measurer, so the test picks a column that sits INSIDE the safety margin of
   * the measured width — exactly where a 0.4px-short measurer is wrong — and pins that the count
   * comes back pessimistic there and unchanged everywhere else. */
  it('wrappedLines() keeps WRAP_SAFETY_PX against its own measurement (OB-217)', () => {
    expect(WRAP_SAFETY_PX).toBe(1)
    const text = 'aaaa bbbb'
    const w = measure(text, 400, 10, 'ui') // 49.5 — what a Chromium-accurate canvas says
    // a column the canvas says fits by 0.4px, where a Firefox measurer 0.4px short is exactly
    // wrong: it must count the second line, because the text may really wrap there
    expect(wrappedLines(text, w + 0.4, 400, 10, 'ui')).toBe(2)
    // exactly the measured width: no slack at all, still the pessimistic answer
    expect(wrappedLines(text, w, 400, 10, 'ui')).toBe(2)
    // a column a full margin wider than the measurement fits on one line, as it always did
    expect(wrappedLines(text, w + WRAP_SAFETY_PX + 0.1, 400, 10, 'ui')).toBe(1)
  })

  it('wrappedLines() narrows the unbreakable-word division too, not only the fit test (OB-217)', () => {
    // one 12-char word: 66px. In a 33px column the division is ceil(66 / 33) = 2 lines against
    // the raw column, and ceil(66 / 32) = 3 against the narrowed one
    expect(wrappedLines('aaaaaaaaaaaa', 33, 400, 10, 'ui')).toBe(3)
  })

  it('wrappedLines() floors the narrowed column at 1, so an absurdly narrow column still divides', () => {
    // 3 chars = 16.5px against a 1px room (a 0.5px column narrows below zero, then floors)
    expect(wrappedLines('abc', 0.5, 400, 10, 'ui')).toBe(Math.ceil(16.5))
    expect(wrappedLines('abc', 0, 400, 10, 'ui')).toBe(Math.ceil(16.5))
  })

  it('chipSize() and wrappedLines() read ONE declaration of the margin (OB-217)', () => {
    expect(CHIP_WRAP_SAFETY_PX).toBe(WRAP_SAFETY_PX)
  })

  it('a wrapping chip clamped to a column within the margin of its title counts the second line (OB-217)', () => {
    const spec = { title: 'aaaa bbbb cccc', wrap: true, mark: 'border' as const }
    // unclamped, the chip reserves its own one-line width plus the margin, and the wrap decision
    // takes that margin back: a title that fits stays one line
    expect(chipSize(spec).titleLines).toBe(1)
    // clamped so the title column is 0.9px wider than the title measures: `chipSize` spends its
    // width pad only when unclamped, so this is where the wrap decision has to keep its own
    const wide = chipSize(spec)
    const clamped = chipSize({ ...spec, maxWidth: wide.width - 1 })
    expect(clamped.titleColumn).toBeCloseTo(wide.titleColumn - 1, 6)
    expect(clamped.titleLines).toBe(2)
  })

  it('linesOf() reads a newline as a space; linesOfBlock() reads it as a forced break', () => {
    expect(linesOf('aa\nbb', 100, 400, 10, 'ui', 0)).toBe(1)
    expect(linesOfBlock('aa\nbb', 100, 400, 10, 'ui', 0)).toBe(2)
    expect(linesOf('', 100, 400, 10, 'ui', 0)).toBe(0)
    expect(linesOfBlock('', 100, 400, 10, 'ui', 0)).toBe(0)
    expect(linesOfBlock('a\nb\nc\nd', 100, 400, 10, 'ui', 2)).toBe(2)
  })

  it('clampToLines() returns the whole string when it fits and a "…"-ended prefix that does when not', () => {
    expect(clampToLines('short', 1, 100, 400, 10, 'ui')).toBe('short')
    const cut = clampToLines('one two three four five six seven', 1, 60, 400, 10, 'ui')
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.length).toBeLessThan('one two three four five six seven'.length)
    expect(wrappedLines(cut, 60, 400, 10, 'ui')).toBe(1)
  })
})
