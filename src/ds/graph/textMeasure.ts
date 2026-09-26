/** CANVAS TEXT MEASUREMENT — one copy, for every component that predicts its own height.
 *  `NodeChip.chipSize()` and `VersionedGroup`'s `GroupGeometry` both wrap a title in JS to say how
 *  tall the box will be before the browser lays it out; until 2026-09-02 each carried its own copy
 *  of these functions, byte-similar, and a fix to one would have missed the other.
 *
 *  Not a component (no `.d.ts`): a helper file in the shape of `textFit`. A port takes it
 *  alongside whichever component imports it, the way `textFit` travels with `NodeArrow`.
 *  Typed port of the DS components/graph/textMeasure.js (2026-09-02), OB-110 (#256);
 *  `WRAP_SAFETY_PX` and the narrowed wrap decision added OB-217 (#343).
 *
 *  Font families are read ONCE from the stylesheet (`--font-ui` / `--font-mono` / `--font-display`)
 *  and cached; the 2D context is created once. With no `document` (a test), `measure()` falls back
 *  to a 0.55em average and `canMeasure()` says so, which is how a caller marks a prediction as
 *  unmeasured rather than presenting a guess as a reading. */

export type FontKind = 'ui' | 'display' | 'mono'

const FONTS: Partial<Record<FontKind, string>> = {}
export function fontOf(kind: FontKind): string {
  const cached = FONTS[kind]
  if (cached) return cached
  let fam = kind === 'mono' ? 'ui-monospace, monospace'
    : kind === 'display' ? 'Georgia, serif' : 'system-ui, sans-serif'
  if (typeof document !== 'undefined' && document.documentElement) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-' + (kind === 'display' ? 'display' : kind === 'mono' ? 'mono' : 'ui')).trim()
    if (v) fam = v
  }
  FONTS[kind] = fam
  return fam
}

let ctx2d: CanvasRenderingContext2D | null | false = null
export function measure(text: unknown, weight: number, size: number, kind: FontKind): number {
  const str = String(text == null ? '' : text)
  if (!str) return 0
  if (typeof document !== 'undefined') {
    if (!ctx2d) {
      try { ctx2d = document.createElement('canvas').getContext('2d') } catch { ctx2d = false }
    }
    if (ctx2d) {
      ctx2d.font = weight + ' ' + size + 'px ' + fontOf(kind)
      return ctx2d.measureText(str).width
    }
  }
  return str.length * size * 0.55
}

/** true once a real canvas has measured something; false until the first `measure()` call and
 *  forever in an environment with no canvas. Read it AFTER the measurements it vouches for. */
export function canMeasure(): boolean { return ctx2d !== false && ctx2d !== null }

/** THE MARGIN A WRAP DECISION KEEPS AGAINST ITS OWN MEASUREMENT, in px (DS OB-217). CHOSEN, not
 *  derived: 1px covers the worst measured case (0.48) with room, and a whole pixel is easier to
 *  reason about than the error it absorbs. ONE DECLARATION for both places that spend it — this
 *  file's wrap decision below and `chipSize()`'s one-line WIDTH in `NodeChip`, which imports it
 *  from here and publishes it.
 *
 *  WHY A WRAP DECISION NEEDS ONE AT ALL. Every line count here comes from canvas `measureText`,
 *  and that is not the same engine as the one that lays the text out. In Chromium the two agree to
 *  about 0.01px. In FIREFOX the canvas UNDERSHOOTS Firefox's own DOM text layout by roughly
 *  0.24-0.48px on the same string (OB-074). So a run whose real width is a fraction over the
 *  column measures as a fraction under it, and the count comes back one line low — the text then
 *  wraps anyway and a box sized from that count crops it.
 *
 *  MEASURED, 2026-09-17, on the case that reported it: "Transistors & Logic Gates" in a 150.18px
 *  title column on the road. Firefox predicted **1 line** and DREW **2** — a box 16.1px short of
 *  the 45.77px its own text needed, the whole second line. Chromium predicted 2 and drew 2.
 *
 *  THE DIRECTION IS THE WHOLE POINT: a line too MANY costs a few pixels of slack in a box, and a
 *  line too FEW crops the words. They are not symmetric mistakes, so the comparison is made
 *  pessimistic and stays that way — do not tighten it to the measured error and do not make it
 *  engine-conditional. The width safety in `chipSize()` could not cover this: it is discarded the
 *  moment the width clamps to `maxWidth` (the road clamps at 220), which is exactly when the
 *  column gets tight enough for the wrap decision to matter. And do not fix it by ceiling or
 *  padding the predicted HEIGHT: that height is what a board stacks on, so a pixel per chip makes
 *  a long road longer than the road drawn beneath it. The line COUNT was wrong, not the height. */
export const WRAP_SAFETY_PX = 1

/** lines ONE run of text takes at a column, honouring `overflow-wrap: break-word`: word
 *  boundaries first, and only a word that cannot fit at all is split inside itself. Empty text
 *  is one line — an empty editable row is still a row.
 *
 *  The column is narrowed by `WRAP_SAFETY_PX` before ANYTHING is compared to it — the `trial`
 *  fit and the `solo` overflow that decides how many times an unbreakable word divides — see that
 *  constant for why a wrap decision cannot trust its own measurement to the pixel. */
export function wrappedLines(text: unknown, width: number, weight: number, size: number, kind: FontKind): number {
  const str = String(text == null ? '' : text).trim()
  if (!str) return 1
  /* floored at 1 so an absurdly narrow column still divides */
  const room = Math.max(1, width - WRAP_SAFETY_PX)
  const words = str.split(/\s+/)
  let lines = 1
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const trial = cur ? cur + ' ' + w : w
    if (measure(trial, weight, size, kind) <= room) { cur = trial; continue }
    if (cur) { lines++; cur = w } else cur = w
    const solo = measure(cur, weight, size, kind)
    if (solo > room) {
      lines += Math.ceil(solo / room) - 1
      cur = ''
    }
  }
  return lines
}

/** lines for text drawn with `white-space: normal` — a newline is a space, so the whole string
 *  is one run. Empty text is 0 lines; `clamp` caps the count (0 = no cap). `NodeChip`'s title. */
export function linesOf(text: unknown, width: number, weight: number, size: number, kind: FontKind, clamp: number): number {
  const str = String(text == null ? '' : text).trim()
  if (!str) return 0
  if (!(width > 0)) return clamp || 1
  const lines = wrappedLines(str, width, weight, size, kind)
  return clamp ? Math.min(lines, clamp) : lines
}

/** lines for text drawn with `white-space: pre-wrap` — every `\n` is a forced break, each
 *  segment wraps on its own. `VersionedGroup`'s editable title, description and version name.
 *  EXPLICIT LINE BREAKS COUNT AS LINES: a prediction that only measured WRAPPING runs one whole
 *  line light per break, which on a board is a card overlapping the next one. Each segment
 *  between breaks takes at least one line even when empty — a blank line the user typed is a
 *  line they can see. */
export function linesOfBlock(text: unknown, width: number, weight: number, size: number, kind: FontKind, clamp: number): number {
  const whole = String(text == null ? '' : text).trim()
  if (!whole) return 0
  if (!(width > 0)) return clamp || 1
  let lines = 0
  for (const segment of whole.split('\n')) lines += wrappedLines(segment, width, weight, size, kind)
  return clamp ? Math.min(lines, clamp) : lines
}

/** the longest prefix of `text` that wraps within `lines` at `col`, ending in "…" — backed up to a
 *  word boundary when that costs under 12 characters, so the line ends after a whole word.
 *
 *  THE ELLIPSIS IS DRAWN INTO THE TEXT, because the CSS that would draw it does not work where
 *  this is used: `display: -webkit-box` computes `flow-root` in the card's nesting, so
 *  `-webkit-line-clamp` goes inert, silently and font-dependently; `-webkit-line-clamp` on a
 *  plain block draws no ellipsis; standard `line-clamp` is unsupported (all three re-measured in
 *  Chrome 148, 2026-08-19). So the string is cut where the TEXT will be cut, measured with
 *  `wrappedLines` — the same measurement the published geometry wraps with — so the drawn text
 *  and a `headHeight()` line count come from one expression. Binary search over the prefix
 *  rather than a per-character walk: this runs on every card of a board on every resize. */
export function clampToLines(text: unknown, lines: number, col: number, weight: number, size: number, kind: FontKind): string {
  const whole = String(text == null ? '' : text)
  if (!whole || !col || !lines) return whole
  if (wrappedLines(whole, col, weight, size, kind) <= lines) return whole
  let lo = 0
  let hi = whole.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (wrappedLines(whole.slice(0, mid).replace(/\s+$/, '') + '…', col, weight, size, kind) <= lines) lo = mid
    else hi = mid - 1
  }
  /* one word is better than half a word: back up to the last space when trimming to it costs
     little, so the line ends "…" after a whole word rather than mid-run */
  const cut = whole.slice(0, lo).replace(/\s+$/, '')
  const lastSpace = cut.lastIndexOf(' ')
  const tidy = lastSpace > cut.length - 12 && lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return tidy.replace(/[\s,;:]+$/, '') + '…'
}
