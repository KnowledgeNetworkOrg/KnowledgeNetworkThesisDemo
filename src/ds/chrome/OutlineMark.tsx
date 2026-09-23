import type { CSSProperties } from 'react'

/** AN INDENTED OUTLINE — a parent rule with two children under it. The mark for a containment
 *  rail (the Explorer): it is literally the shape that rail's own rows draw, so it names what is
 *  inside the rail rather than naming the rail (a PANEL mark was rejected for exactly that —
 *  `RelationsMark` would have had to be a panel too, and the pair would stop telling each other
 *  apart).
 *
 *  THREE STROKES, NOTHING TO CLOSE UP AT 12px. Two earlier shapes were rejected: a spine with
 *  three ringed branches (seven marks in a 12px box — it read as texture, the circles filled
 *  in), and a folder (`LoadMark` is ALREADY a folder, same 16 grid, same 1.4 stroke; at 12px an
 *  open folder and a closed one are one mark, and the system would have shipped two).
 *  The ends align RIGHT and the indent is the only difference, so hierarchy is the one thing
 *  the mark says — three EQUAL bars would be a hamburger.
 *
 *  Construction is `AddNodeMark`'s exactly: an invisible same-font character keeps a real text
 *  baseline so this can sit in a `baseline`-aligned row, and the visible glyph is a separate
 *  absolutely positioned SVG so nothing depends on font metrics. Stroke 1.4 — `CopyMark`'s
 *  weight, the family weight for multi-stroke marks; 1.5 belongs to marks with a single closed
 *  outline. A one-off ACTION mark, not one of the five state marks.
 *
 *  WHAT THE CALLER MUST DO: use it WITH ITS WORD, not instead of it (the glyph is a faster
 *  second read on a control that already says "Explorer"); pair it with `RelationsMark` and
 *  nothing else (the two are a set — hierarchy against network — and a lone one loses the
 *  contrast that makes either legible at 12px); do not re-draw it at another weight.
 *
 *  Typed port of the DS components/chrome/OutlineMark.jsx (contract: OutlineMark.d.ts),
 *  #340 / OB-234. */
export interface OutlineMarkProps {
  /** rendered box in px; the 16-unit viewBox scales to it. Rail pills pass 12 */
  size?: number
  /** merged into the wrapper — colour comes from `currentColor`, so a host tints by ink */
  style?: CSSProperties
}

export function OutlineMark({ size = 14, style }: OutlineMarkProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, lineHeight: size + 'px', ...style }}>
      <span aria-hidden="true" style={{ color: 'transparent' }}>+</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', inset: 0 }}
      >
        <path d="M2.4 4.2h11.2" />
        <path d="M6.2 8h7.4" />
        <path d="M6.2 11.8h7.4" />
      </svg>
    </span>
  )
}
