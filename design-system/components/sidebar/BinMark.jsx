import React from 'react'
import { EDIT_MARK_LIFT } from '../chrome/EditMark.jsx'

/** The bin, for deleting a user-saved thing — and ONLY that; a ✕ means "remove from the
 *  composition", which is a different act. Unicode has no in-class bin (U+1F5D1 renders as emoji
 *  at half the house advance), so this is built from plain geometry — a lid rule and a tapered
 *  body, in currentColor at 1.5px. It was the system's first drawn mark and is no longer its
 *  only one: the chrome family (`CloseMark`, `EditMark`, `CopyMark` and the rest) is drawn too.
 *  `style` is merged UNDER the lift below, so a caller can place the mark but cannot counter-nudge
 *  it. `lift={false}` is the one way to drop it, for a bin ALONE in a round button (owner, 15 Oct):
 *  the 1.4px exists to share a line with the pencil, and with no pencil beside it the ring is what
 *  the eye centres against — measured in `LectureNotes`' flag row, the lifted glyph sat 1.7px
 *  above the ring's centre. */
export function BinMark({ size = 11, style, lift = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      /* THE MARK'S OWN OPTICAL CENTRING, the pencil's sibling (`EditMark` lifts 1.4px for the same
         reason): the body is the bin's mass and it hangs under the lid, so a box-centred bin reads
         low — and it drew 0.35px below centre to begin with (path 3.25–13.45 in a 16 box). Beside
         the pencil in a note row the two sat 1.6px apart (owner, 2026-09-04). Same number as the
         pencil so the pair share a line; a nudge, not a redraw of the paths. */
      style={{ display: 'block', flexShrink: 0, ...style, transform: lift === false ? 'none' : 'translateY(-' + EDIT_MARK_LIFT + 'px)' }}>
      <path d="M2.75 4.5h10.5" />
      <path d="M6.25 4.5V3.25h3.5V4.5" />
      <path d="M4.25 4.5l.6 8a1 1 0 0 0 1 .95h4.3a1 1 0 0 0 1-.95l.6-8" />
    </svg>
  )
}
