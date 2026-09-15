// THE RING'S NUMBERS, in a plain module (OB-153, 2026-09-14): the sixteen hue degrees the DS
// keeps privately in DomainDot.jsx, the five roles' lightness and chroma as tokens/colors.css
// writes them, and `topicPaintValues()`, the JS-resolved twin of `topicPaint()`. Split out of
// DomainDot.tsx for one reason — topicpaint.test.ts reads the token file with node:fs, which
// makes it a node program under tsconfig.node.json, and that config cannot compile a .tsx
// import. DomainDot.tsx imports the table back and re-exports the resolver, so nothing that
// reads the barrel sees a second home.

/** DEGREES, one per `HUE_RING` name — the one deliberate second copy of the ring's angles in
 *  this port, and it exists ONLY for arithmetic (a hue shift needs a number to shift; an SVG
 *  attribute needs a value, not a token). A hue added to `HUE_RING`/`tokens/colors.css` must add
 *  its degree here too — same obligation as `tailwind/kn-theme.css`'s mirror, and for the same
 *  reason: no CSS custom property can be added to or compared against another at runtime, so a
 *  resolver has no choice but to know the numbers. Pinned to the token file by topicpaint.test.ts.
 *  Do not read this table for anything else; read the tokens for that. */
export const HUE_DEGREES: Record<string, number> = { rose: 350, brick: 20, clay: 42, amber: 65, honey: 88, olive: 110, lime: 130, leaf: 148, fern: 166, jade: 183, teal: 198, river: 214, cobalt: 236, iris: 262, violet: 292, mallow: 322 }

/** one resolved OKLCH colour: the three numbers, and the same value as a CSS string */
export interface OklchValue { l: number; c: number; h: number; css: string }

/** THE FIVE ROLES' LIGHTNESS AND CHROMA, one row per role — the numbers `tokens/colors.css`
 *  writes for every `--hue-<name>[-role]`, restated here for ONE reason: an SVG presentation
 *  attribute cannot take a `var()`. Pinned to the token file by topicpaint.test.ts, which reads
 *  colors.css and compares all eighty values, so this copy cannot go stale unnoticed. */
const ROLE_LC: Record<'mark' | 'ink' | 'stroke' | 'wash' | 'washRaised', readonly [number, number]> = {
  mark: [0.55, 0.15], ink: [0.44, 0.14], stroke: [0.6, 0.14], wash: [0.955, 0.038], washRaised: [0.925, 0.055],
}
/** the anchor fallback (`--swatch-anchor-fallback`, slate) as numbers, for the same reason */
const FALLBACK_LCH: OklchValue = { l: 0.55, c: 0.04, h: 255, css: 'oklch(0.55 0.04 255)' }

/** ★ LOCAL — THE JS-RESOLVED TWIN OF `topicPaint()`, for the places a `var()` cannot go
 *  (OB-153 clause 9; measured in `receipts/9fbc05a.md`): a topic's colour handed to an SVG
 *  `fill`/`stroke` PRESENTATION ATTRIBUTE — the map's anchors, the neighbourhood wheel, the
 *  unfold views — where `var()` computes to `none` and the shape renders black. Same five
 *  fields as `topicPaint`, each an `OklchValue` rather than a token name, plus `deg`, the
 *  ring degree the arc grading in `src/model/color.ts` anchors on. An unknown or absent topic
 *  resolves to the anchor fallback in every role, never to nothing. */
export function topicPaintValues(topic?: string | null): { hue: string | null; deg: number | null; mark: OklchValue; ink: OklchValue; stroke: OklchValue; wash: OklchValue; washRaised: OklchValue } {
  const hue = topic != null && Object.prototype.hasOwnProperty.call(HUE_DEGREES, topic) ? topic : null
  if (!hue) return { hue: null, deg: null, mark: FALLBACK_LCH, ink: FALLBACK_LCH, stroke: FALLBACK_LCH, wash: FALLBACK_LCH, washRaised: FALLBACK_LCH }
  const deg = HUE_DEGREES[hue]
  const role = (k: keyof typeof ROLE_LC): OklchValue => ({ l: ROLE_LC[k][0], c: ROLE_LC[k][1], h: deg, css: `oklch(${ROLE_LC[k][0]} ${ROLE_LC[k][1]} ${deg})` })
  return { hue, deg, mark: role('mark'), ink: role('ink'), stroke: role('stroke'), wash: role('wash'), washRaised: role('washRaised') }
}
