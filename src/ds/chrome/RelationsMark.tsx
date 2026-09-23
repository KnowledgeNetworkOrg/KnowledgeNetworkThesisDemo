import type { CSSProperties } from 'react'

/** THREE NODES, EVERY PAIR LINKED — the mark for a relations rail: the thing that rail counts.
 *  Its partner is `OutlineMark`, and the pair is meant to be read together: one names a
 *  hierarchy, one names a network, and that difference is the only thing that has to survive at
 *  12px. The family owned neither shape before these two (`NewMapMark` and `LeafMark` are the
 *  nearest and are neither).
 *
 *  Construction is `AddNodeMark`'s exactly — invisible same-font character behind an absolutely
 *  positioned SVG, so the mark keeps a real text baseline for `baseline`-aligned rows. Stroke
 *  1.4, `CopyMark`'s weight: this is a multi-stroke mark, and 1.5 belongs to marks with a single
 *  closed outline. The three discs are r 1.9 — small enough that the links between them stay
 *  legible ink rather than closing the triangle into a blob at 12px. A one-off ACTION mark, not
 *  one of the five state marks.
 *
 *  WHAT THE CALLER MUST DO: use it WITH ITS WORD (the glyph is a second read on a control that
 *  already says "Relations"); pair it with `OutlineMark` (neither mark is self-evident alone;
 *  together they are); do not re-draw it at another weight.
 *
 *  Typed port of the DS components/chrome/RelationsMark.jsx (contract: RelationsMark.d.ts),
 *  #340 / OB-234. */
export interface RelationsMarkProps {
  /** rendered box in px; the 16-unit viewBox scales to it. Rail pills pass 12 */
  size?: number
  /** merged into the wrapper — colour comes from `currentColor`, so a host tints by ink */
  style?: CSSProperties
}

export function RelationsMark({ size = 14, style }: RelationsMarkProps) {
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
        <path d="M6 4.6 10.1 5.8" />
        <path d="M4.7 6 6.1 10.4" />
        <path d="M10.6 8 8.2 10.8" />
        <circle cx="4" cy="4" r="1.9" />
        <circle cx="12" cy="6.4" r="1.9" />
        <circle cx="6.8" cy="12.4" r="1.9" />
      </svg>
    </span>
  )
}
