import type { CSSProperties } from 'react'

/** THE ✕, DRAWN — the mark `IconButton` puts in a round control by default. A close, a dismiss,
 *  a remove-from-the-composition. Every round icon control used the Unicode character U+2715
 *  until 2026-09-16, when the owner reported the glyph reading off-centre inside its circle.
 *  Measured, and it was: the ink sat about 1.5px above the button's centre in an 18px control.
 *
 *  THE CAUSE IS NOT OURS TO TUNE. A text ✕ has no descender, so its ink fills the top of the line
 *  box and leaves the descender's room empty underneath — `placeItems: center` centres the LINE
 *  BOX, and the ink inside it is then high by half that empty room. Worse, U+2715 is not in the
 *  latin subsets of Nunito (see `tokens/fonts.css`): it was always served by whatever the platform
 *  fell back to, so the offset differed per machine and no number could have fixed it for
 *  everyone. A drawn mark is centred by construction, at every size, on every machine.
 *
 *  SO: NEVER TYPE A ✕ INTO A BUTTON. `IconButton` with no `glyph` draws this; a caller who needs
 *  the mark outside a button draws `<CloseMark />`. Not one of the five state marks: a caller does
 *  not draw its own version, and a genuinely new icon is requested from the design system first.
 *
 *  Typed port of the DS CloseMark.jsx (contract: CloseMark.d.ts), OB-201. */
export interface CloseMarkProps {
  /** px, both dimensions — the mark is square. Default 10, which is `IconButton`'s glyph size for
   *  a control under 22px; the cross spans 0.72 of it, matching the ink height the text glyph had
   *  at the same size (CHOSEN to match, not derived). */
  size?: number
  /** on the svg itself */
  style?: CSSProperties
}

export function CloseMark({ size = 10, style }: CloseMarkProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d="M1.7 1.7 10.3 10.3M10.3 1.7 1.7 10.3" />
    </svg>
  )
}
