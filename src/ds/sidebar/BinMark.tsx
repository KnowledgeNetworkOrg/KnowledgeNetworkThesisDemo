import type { CSSProperties } from 'react'

import { EDIT_MARK_LIFT } from '../chrome/EditMark'

/** The bin, for deleting a user-saved thing — and ONLY that; a ✕ means "remove from the
 *  composition", which is a different act. Unicode has no in-class bin (U+1F5D1 renders as emoji
 *  at half the house advance), so this is built from plain geometry — a lid rule and a tapered
 *  body, in currentColor at 1.5px. It was the system's first drawn mark and is no longer its
 *  only one: the chrome family (`CloseMark`, `EditMark`, `CopyMark` and the rest) is drawn too.
 *  It carries its own optical centring — the same lift `EditMark` carries — because
 *  its mass hangs under the lid and a box-centred bin reads low; in a row beside the
 *  pencil the two now share a line. Never counter-nudge it from outside: `style` is merged
 *  UNDER the lift, so a caller can place the mark but cannot cancel its optical centring.
 *  Typed port of the DS BinMark.jsx. */
export interface BinMarkProps {
  /** px. Default 11, the size inside a 20px icon button (`PresetButton`, `LectureNotes`) */
  size?: number
  /** placement only (margin, flex); `transform` is overridden by the lift */
  style?: CSSProperties
}

export function BinMark({ size = 11, style }: BinMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* THE MARK'S OWN OPTICAL CENTRING, the pencil's sibling (OB-144): the body is the bin's
         mass and it hangs under the lid, so a box-centred bin reads low — and it drew 0.35px
         below centre to begin with (path 3.25–13.45 in a 16 box). Beside the pencil in a note
         row the two sat 1.6px apart (owner, 2026-09-04). Same number as the pencil so the pair
         share a line; a nudge, not a redraw of the paths. */
      style={{ display: 'block', flexShrink: 0, ...style, transform: `translateY(-${EDIT_MARK_LIFT}px)` }}
    >
      <path d="M2.75 4.5h10.5" />
      <path d="M6.25 4.5V3.25h3.5V4.5" />
      <path d="M4.25 4.5l.6 8a1 1 0 0 0 1 .95h4.3a1 1 0 0 0 1-.95l.6-8" />
    </svg>
  )
}
