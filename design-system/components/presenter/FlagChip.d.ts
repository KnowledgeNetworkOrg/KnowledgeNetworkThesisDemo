import type { CSSProperties } from 'react'

/** one type on the ring — the same shape as `LectureNotes`' `NoteCategory` */
export interface FlagType {
  key: string
  glyph: string
  label: string
  /** the ring's and the tooltip's word ("fix" for "fix this slide"). Falls back to `label` */
  short?: string
  wash: string
}

/**
 * THE FLAG BUTTON — one chip, two gestures (owner, v4, 6 Oct). It sits on the presenter's current
 * film-roll frame (`FilmRoll onFlag`) and on the recap's shown slide (`LectureRecap onFlag`).
 *
 *  - TAP: one flag of the usual type, at once. Nothing else happens — no message, no pin on the
 *    slide; the new row in the notes pane's Flags list is the confirmation.
 *  - HOLD for `FLAG_CHIP_METRICS.hold` (300ms) or RIGHT-CLICK: a ring of the OTHER types opens
 *    around the chip with a CANCEL mark (✕) in its middle — the usual type is the tap, so it is not
 *    offered again (owner, 15 Oct); with three types that is two petals, up-left and up-right.
 *    HELD: slide onto a petal and let go;
 *    let go in the middle, or outside the ring, and nothing is made. A TYPE CHOSEN ON THE RING
 *    BECOMES THE USUAL ONE (owner, 15 Oct): the flag is made, and the chip now shows and taps that
 *    type. RIGHT-CLICKED (or
 *    opened from the keyboard): the ring stays open for a click; Esc or a click outside closes it.
 *  - KEYBOARD, on a focused chip: Enter/Space is the tap; ↑ or the context-menu key opens the ring.
 *    THERE IS NO GLOBAL KEY (owner, 6 Oct — the old F key went): a flag can never be made by typing.
 *
 * WHAT THE HOST MUST DO:
 *  1. `onFlag(key)` ADDS A BARE FLAG to the slide the chip is on — `{ stop, category: key, text: '',
 *     when, at: Date.now() }`, the same entry the notes pane's composer writes, in the same list. A
 *     flag is a note with a type and no words yet; there is no second store. Pressing the same type
 *     twice makes two rows.
 *  2. Pass the USER's type list's first three as `types` (or omit for the defaults). Only the first
 *     three ever appear on the ring; a type the professor added appears in the composer's menu only.
 *  3. HOLD AND STORE `usual`, and pass `onUsualChange` (owner, 15 Oct, REVERSING the 6 Oct Q2 "a
 *     fixed setting, never the last used"): a type picked on the ring becomes the usual one and
 *     must SURVIVE A RELOAD — store it against the user, like the type list. Pass the same key to
 *     every chip (`FilmRoll usualFlag`, `LectureRecap usualFlag`) and to `LectureNotes usualFlag`,
 *     so the roll, the recap and the composer agree. Without `onUsualChange` the chip remembers
 *     a ring pick only while mounted, and a change to the `usual` prop still takes over.
 *
 * THE RING IS PAINTED ON `document.body`, fixed at the chip's centre, so an `overflow: hidden`
 * parent (a film-roll frame) cannot clip it; it may cover the neighbouring frames while open.
 */
export interface FlagChipProps {
  /** the ring types' source, in order. Default the first three of `NOTE_CATEGORIES` (unclear, fix,
   *  follow up). Only the first three are read; the usual one is left off the ring */
  types?: FlagType[]
  /** the key a TAP makes, and the type the chip shows at rest. Default 'fix'. Host-held: see 3 */
  usual?: string
  /** a type was picked ON THE RING that is not the usual one: it is the usual one now. Store it */
  onUsualChange?: (key: string) => void
  /** a type was chosen — by tap, by release on the ring, or by click on it */
  onFlag?: (key: string) => void
  /** the spoken name. Default "flag this slide" */
  title?: string
  /** show "tap to flag · hold to change flag" as the tooltip. Default true. The v4 sheet shows it only until
   *  the ring has been opened twice; that count is the host's (`onRingOpen`) */
  hint?: boolean
  /** fired each time the ring opens — for a host counting toward switching `hint` off */
  onRingOpen?: () => void
  /** draws the ring open from mount, IN PLACE around the chip (not portalled, so nothing to measure
   *  and nothing to detach on scroll), blocking nothing around it — FOR SPECIMEN CARDS, so the ring
   *  can be drawn without a hand on it. A host never passes it. Default false */
  openOnMount?: boolean
  style?: CSSProperties
}
export function FlagChip(props: FlagChipProps): JSX.Element

/** `hold` 300 (CHOSEN: a tap never opens the ring by accident; WHILE HELD the chip fills from its
 *  edge to its centre over exactly this long, so the professor sees how long to hold — owner, 6
 *  Oct), `ring` 40 (centre to petal), `petal` 26, `centre` 32 — COMPACT (owner, 6 Oct: the bigger wheel looked awkward); each word sits on the OUTSIDE of its petal so none reaches the centre; `label` 14 (a word's line). NO PLATE behind the wheel: each petal, the ✕ and each word carries its own lifted paper, so it reads over a slide with nothing to overhang (6 Oct), `slop` 10 (CHOSEN: how far past a petal a release still
 *  lands on it), `chip` 22 (the chip IS the type tag: a circle in the type's wash, no border, no bezel; under the pointer it lifts and darkens a step with a `--surface-press` veil) and `tag` 18 (a petal's round tag), `layer` 1000 (the ring's z-index on
 *  `document.body`). */
export const FLAG_CHIP_METRICS: {
  hold: number; chip: number; tag: number; ring: number; label: number; petal: number; centre: number; slop: number; layer: number
}

/** the petal geometry under a reachable name, for cards and probes: `angles` (degrees: -90, 150,
 *  30, the three-petal ring), `otherAngles` (-150, -30: the two-petal ring the chip draws once the
 *  usual type is left out) and `petalAt(i)` → a three-petal offset from the chip's centre. */
export const FlagRing: { angles: number[]; otherAngles: number[]; petalAt(i: number): { dx: number; dy: number } }
