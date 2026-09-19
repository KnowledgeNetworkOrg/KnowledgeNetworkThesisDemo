/** MEASURED LINE-FITTING for a label: wrap first, truncate once, at the end.
 *  CSS `-webkit-line-clamp` does not reliably engage everywhere this system renders, so the
 *  lines are built by MEASUREMENT — whole words while they fit, then CHARACTERS of the word
 *  that does not (a mid-word wrap is not a cut), the last line alone carrying an ellipsis with
 *  its room reserved before packing. A split that would orphan one or two characters at the
 *  head of the next line gives them back, so the fragment stays at least three long.
 *
 *  Shared by `NodeArrow`'s `fill label` and `NodeChip`'s `border-2` measured-mention mode
 *  (`path` + `maxLines`) — one function, not two that can drift. It is deliberately a HELPER
 *  FILE and not a component: it has no `.d.ts` upstream either, and a port takes it alongside
 *  whichever component imports it, exactly as `textMeasure` travels with `NodeChip`.
 *
 *  NOT `textMeasure`, and the two are not merged. That one answers HOW MANY LINES a CSS-wrapped
 *  run will take, for a box being predicted before it is laid out; this one answers WHICH WORDS
 *  go on each line, for text this system draws line by line itself. Different questions, and
 *  the DS keeps them in two files.
 *
 *  Typed port of the DS components/graph/textFit.js (contract: inline, it has none of its own),
 *  OB-101 / #253. `textWidth`, `clipToRoom` and `LabelCut` added OB-212/OB-213 (#336). */

let ctx2d: CanvasRenderingContext2D | null | false = null
let family: string | null = null

/** upstream reads `document.body`'s own resolved family rather than a `--font-*` token, because
 *  the two labels this fits are body text on the page, not chrome with a face of its own. */
function fontFamily(): string {
  if (family !== null) return family
  let f = 'Nunito, sans-serif'
  if (typeof document !== 'undefined' && document.body) {
    const v = getComputedStyle(document.body).fontFamily
    if (v) f = v
  }
  family = f
  return f
}

function measureCtx(): CanvasRenderingContext2D | null {
  if (typeof document !== 'undefined' && ctx2d === null) {
    try { ctx2d = document.createElement('canvas').getContext('2d') } catch { ctx2d = false }
  }
  return ctx2d || null
}

export interface TextWidthOptions {
  /** the size to measure at, in the caller's own unit space — a CSS px, or (the map's
   *  usage) a world-unit stand-in for one; measurement is linear in font-size so either
   *  reads correctly as long as the caller stays in one space. Default 12.5. */
  fontPx?: number
  weight?: number
  family?: string
}

/** THE WIDTH A LINE ACTUALLY DRAWS AT — canvas `measureText` with NO correction factor, which
 *  is the reading `guidelines/label-width-measure.html` justifies: at 12.5px and at 10px, for
 *  every real corpus name, `canvas / rendered` is 1.000 to three decimals once the family is
 *  declared once (it is, `tokens/fonts.css`) and `document.fonts.ready` has resolved. The
 *  system's standing warning about `measureText` is about METRICS — it answers from whichever
 *  face is already loaded, so a family declared twice makes it lie — and it is answered by
 *  declaring the family once, not by a fudge factor.
 *
 *  No-canvas fallback (a test, SSR): the same 0.55em average `fitLines` falls back to, so a
 *  measurement taken without a document is coarse rather than absent. */
export function textWidth(text: unknown, opts?: TextWidthOptions): number {
  const o = opts || {}
  const fontPx = o.fontPx == null ? 12.5 : o.fontPx
  const cx = measureCtx()
  if (!cx) return String(text).length * fontPx * 0.55
  cx.font = (o.weight || 500) + ' ' + fontPx + 'px ' + (o.family || fontFamily())
  return cx.measureText(String(text)).width
}

/** THE NUMBERS A CELL-LABEL FIT SPENDS, so no consumer retypes them (all CHOSEN, none
 *  derived): `floorPx` is how small a name may shrink before `clipToRoom` is reached — 10px,
 *  the owner's pick at 1:1 on `guidelines/map-label-fit-options.html`; `shrinkStep` is the
 *  ladder's ratio, the same 0.9 the region names already walk; `minStub` is the shortest
 *  clipped head worth drawing when the cut landed inside a word, `minWord` the shortest when
 *  it landed on a word boundary, and `minFragment` is the length under which a surviving tail
 *  word is dropped as an orphan (3, the same number `fitLines` uses at the other end of a
 *  wrap). */
export const LabelCut = { floorPx: 10, shrinkStep: 0.9, minStub: 4, minWord: 2, minFragment: 3 }

/** THE LAST RESORT FOR A NAME THAT STILL WILL NOT FIT — one line, ONE cut, at the end, and a
 *  floor on what is left (the owner's pick, 2026-09-17: treatment E-prime of
 *  `guidelines/map-label-last-resort.html`, judged at 1:1).
 *
 *  Hand it the room the shape actually has and it answers the string to draw, or `null`
 *  meaning DROP THE NAME — the caller must have a nameless path, because below a few letters
 *  a stub is noise and not a name ("Imp…" identified nothing on the rig).
 *
 *  WHY ONE LINE AND ONE MARK. The rejected alternatives all rendered on that rig: clipping
 *  BOTH lines of a two-line split mutilates the name twice ("Implica… / Vacuo…"); whole-words-
 *  only left two cells of three nameless anyway; and letting the full name bleed its shape put
 *  25px and 38px of it on top of the neighbours, which is a name on the wrong region.
 *  `LabelCut.minStub` is CHOSEN, not derived — four letters is where a stub still read as the
 *  head of a word at 10px.
 *
 *  A TAIL THAT IS NOT WORTH DRAWING GOES WITH THE CUT, and there are two of those. A trailing
 *  connective: "Implication &…" reads as a missing second half, so a final `&` or "and" is
 *  trimmed. And a surviving FRAGMENT of the next word, under `LabelCut.minFragment` letters —
 *  without that rule the connective rule defeats itself the moment one letter of the following
 *  word fits, which is ordinary map geometry and not a corner. Trimming cascades — drop the
 *  orphan and a connective left dangling behind it goes too — so "CNF & D…" becomes "CNF…".
 *
 *  TWO FLOORS, BECAUSE A WHOLE WORD IS NOT A STUB. `minStub` (4) applies to a cut that landed
 *  INSIDE a word. A cut that landed on a word BOUNDARY is a real if shorter name and only
 *  needs `minWord` (2), which is what lets "CNF…" draw. Both CHOSEN, not derived. */
export function clipToRoom(text: string, roomPx: number, opts?: TextWidthOptions): string | null {
  const o = opts || {}
  const fontPx = o.fontPx
  const w = (s: string) => textWidth(s, { fontPx, weight: o.weight, family: o.family })
  /* drop trailing junk until the tail is worth drawing: a dangling connective, or a fragment of
     the next word too short to read as its head. One loop, because each can expose the other. */
  const tidy = (s: string): string => {
    let out = s.replace(/\s+$/, '')
    for (;;) {
      const m = out.match(/(?:^|\s)(\S+)$/)
      if (!m) break
      const last = m[1]
      const connective = /^(&|and)$/i.test(last)
      const orphan = last.length < LabelCut.minFragment && out.length > last.length
      if (!connective && !orphan) break
      out = out.slice(0, out.length - last.length).replace(/\s+$/, '')
    }
    return out
  }
  const whole = String(text).trim()
  if (w(whole) <= roomPx) return whole
  let s = ''
  for (const ch of whole) {
    if (w(s + ch + '…') > roomPx) break
    s += ch
  }
  s = tidy(s)
  while (s.length && w(s + '…') > roomPx) s = tidy(s.slice(0, -1))
  if (!s.length) return null
  const onBoundary = whole.length === s.length || /\s/.test(whole.charAt(s.length))
  return s.length >= (onBoundary ? LabelCut.minWord : LabelCut.minStub) ? s + '…' : null
}

export interface FitLinesOptions {
  /** the drawn size, in px. Default 9.5 */
  fontPx?: number
  /** measure at bold rather than the medium these labels are set in */
  bold?: boolean
  /** the ceiling on lines; the last one carries the ellipsis. Default 2 */
  maxLines?: number
  /** the box's OWN padding, deducted from `boxWidthPx` before fitting. Default 16;
   *  pass 0 to measure raw text with no box around it */
  pad?: number
}

/** wrap `text` into at most `maxLines` lines that each fit `boxWidthPx`, the last one
 *  ellipsised if anything is left over. Returns at least one string, always.
 *
 *  MEASURED WITHOUT A CORRECTION FACTOR since 2026-09-17 (OB-213). It carried `* 1.12` "for
 *  canvas-vs-CSS measurement disagreement" from the day it was written; that disagreement was
 *  finally measured (`guidelines/label-width-measure.html`: canvas over rendered is 1.000 at
 *  both 12.5px and 10px, every string) and found NIL, so the factor was withholding 12% of
 *  every label's box for a disagreement that did not exist. Removing it moved 63 of 208 real
 *  call configurations and improved all 63 (9 lost an unneeded ellipsis, 13 stopped breaking
 *  inside a word, 13 collapsed two lines to one), none regressed — priced per configuration in
 *  `guidelines/fitlines-factor-probe.html` before the owner approved it. */
export function fitLines(text: unknown, boxWidthPx: number, opts?: FitLinesOptions): string[] {
  const o = opts || {}
  const fontPx = o.fontPx || 9.5
  const pad = o.pad == null ? 16 : o.pad
  const cx = measureCtx()
  if (cx) cx.font = (o.bold ? '700 ' : '500 ') + fontPx + 'px ' + fontFamily()
  /* no canvas (a test, SSR): the same 0.55em average `textMeasure` falls back to, so a fit
     computed without a document is coarse rather than absent — the render still draws lines. */
  const measure = (s: string) => (cx ? cx.measureText(s).width : s.length * fontPx * 0.55)
  const maxW = Math.max(10, (boxWidthPx || 70) - pad)
  const maxLines = o.maxLines || 2
  let rest = String(text).trim()
  const lines: string[] = []
  while (lines.length < maxLines - 1 && rest.length) {
    if (measure(rest) <= maxW) break
    const words = rest.split(' ')
    let line = ''
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i]
      if (measure(test) <= maxW) line = test
      else break
    }
    if (!line) {
      let s = ''
      for (let i = 0; i < rest.length; i++) {
        if (measure(s + rest[i]) > maxW) break
        s += rest[i]
      }
      line = s || rest[0]
      /* giving back a character or two so the fragment carried to the next line is at least
         three long: one orphaned letter against the border reads as a rendering fault. */
      const frag = (rest.slice(line.length).match(/^\S*/) || [''])[0]
      if (frag && frag.length < 3 && line.length > 3) line = line.slice(0, line.length - (3 - frag.length))
    }
    lines.push(line)
    rest = rest.slice(line.length).replace(/^\s+/, '')
  }
  if (rest.length) {
    if (measure(rest) <= maxW) {
      lines.push(rest)
    } else {
      let s = ''
      for (let i = 0; i < rest.length; i++) {
        if (measure(s + rest[i] + '…') > maxW) break
        s += rest[i]
      }
      lines.push(s.replace(/\s+$/, '') + '…')
    }
  }
  if (!lines.length) lines.push('')
  return lines
}
