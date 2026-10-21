import type { ReactNode } from 'react'

/**
 * The map, projected: what the wall shows while the professor holds the map up. Part 4 of the
 * presenter-mode split (see `guidelines/presenter-component-split-plan.md`) — "the map, on
 * request only". Settled in v18; no open calls.
 *
 * WHAT THE HOST MUST DO — the rules are the host's, because the component is only the picture:
 *  1. SHOW IT ON REQUEST ONLY. A key (M in the Studio) or the quick action ("Project map · M")
 *     puts it up; nothing puts it up by itself — not advancing, not arriving at a stop, not
 *     roaming. Travel on every advance would get old (owner, v18).
 *  2. A SECOND PRESS TAKES IT DOWN and the slide comes back. While it is up it STAYS up: an advance
 *     or a roam moves the lit pin and the caption, it does not dismiss the map. Ending the lecture
 *     takes it down.
 *  3. IT GOES WHEREVER THE SLIDE GOES. The map is the wall's content, so it replaces the slide on
 *     every surface that shows the wall — the film roll's live card, the full-screen frame, the
 *     projector — and on none of the others (the roll's neighbours stay slides). Give it the same
 *     1120:630 box the slide gets; it fills it. The roll's live label stays "On the projector now":
 *     the map IS what is on the projector.
 *  4. THE MAP IN THE SLOT SHOWS THE WHOLE LECTURE. It is the app's own map (the map pane's
 *     drawing, not a second one) with every stop of the lecture as a pin (`StepDot variant="pin"`,
 *     numbered per OB-114), the covered stops and the stop on the wall joined by the walk line, and
 *     the stop on the wall lit (`state="current"`). The pane's recency band (OB-132: pins beyond
 *     the band hide on a map at rest) does NOT apply here — the room is looking at a still picture
 *     to see where it has been and where it is going, and a band with nothing moving would hide
 *     the past for no reason. This is the one surface that shows the walk unbanded.
 *  5. THE STOP ON THE WALL is `stop` — whichever the room is looking at, the active stop or the
 *     roam, the same index the roll's live card shows. Pass 1-based, as the header chip does.
 *  6. LATER, WITH SESSIONS: a stop marked "show the map when we arrive here" plays this same
 *     component. Nothing about it changes for that; rule 1 gains one authored exception.
 *  6b. THE FOOT'S SLOT IS FIXED, ITS WORDS ARE NOT. `footer` occupies the same 1120×32 band the
 *     slide's own foot does — that stays constant so the flip never moves anything — but the
 *     host should not hand it the IDENTICAL string the slide just showed a moment earlier; that
 *     reads as if nothing changed. Say something PLAIN the map view adds instead ("the whole
 *     walk" reads to a room; "unbanded" is this system's own word, not theirs).
 *     THE BAND CARRIES `data-projected-map-foot` so that guarantee is CHECKABLE: a test asserting
 *     the foot does not move on the flip has to find the foot, and locating it by structure
 *     (`> div:last-child`) rots the first time the tree changes, silently and in the test's
 *     favour. Select the attribute; it is part of the promise, not an implementation detail.
 *     (Added 2026-09-14 on the app side's offer — they had been validating what a structural
 *     selector found rather than trusting it, which is the right instinct: keep that check.)
 *  7. THE ✕ (`onClose`) IS ANOTHER WAY TO SAY WHAT M SAYS, NEVER A BIGGER ONE. Pass it and the
 *     component draws a close button; pressing it must do exactly what a second M would do —
 *     the map comes down, the slide is back, and if the room is in full screen it STAYS in
 *     full screen looking at the slide. The ✕ is never a way to leave full screen; that stays
 *     the full-screen frame's own backdrop-click/Escape, untouched by this component. It fades
 *     in on activity over the wall and recedes after the system's grace period (`useRecede`),
 *     the same manners as every other hover-revealed control — not permanently on screen.
 *
 * THE CHROME SCALES, THE MAP DOES NOT. Caption and foot are laid out at the 1120-wide reference
 * and scaled to the box; the `map` slot is handed the real pixel box, so a canvas map stays crisp.
 * `PROJECTED_MAP_METRICS` publishes the reference and the insets (CHOSEN, not derived — 62 is the
 * slide's own text inset, so the caption and the slide's eyebrow share a vertical line when the
 * wall flips; 44 clears the roll's corner pill; 32 is the slide's foot so it does not jump).
 */
/** the ✕ (`onClose`) is meant for a surface with room to spare (full screen) — a host that also
 *  wires it on a small card (the film roll's live card) will sit it right on top of that card's
 *  own corner control (a flag) and the two will fight for the same space. Pass it only where
 *  that isn't true. */
export interface ProjectedMapProps {
  /** the stop on the wall, 1-based — the same index the roll's live card shows */
  stop: number
  /** how many stops the lecture has */
  count: number
  /** the stop's territory (its domain's title) — the first half of "Territory › Stop" */
  territory: string
  /** the stop's title — the second half */
  title: string
  /** THE MAP — the app's own, drawn by the host into the real pixel box (rule 4 above). Absolutely
   *  filled: render `position: absolute; inset: 0` or a block that fills its parent */
  map: ReactNode
  /** the foot's content, laid out at 1120×32 and scaled — same SLOT the host's slide foot
   *  occupies (so the flip does not move anything at the bottom), but the text itself may
   *  differ: passing the identical string as the slide's own foot reads as nothing having
   *  changed when the map goes up. A short, map-specific, PLAIN-WORDED line (e.g. the slide's
   *  own foot text plus " · the whole walk" — not jargon like "unbanded", which means nothing
   *  to the room) keeps the position steady while saying something the slide's foot didn't.
   *  The band is selectable as `[data-projected-map-foot]` — see rule 6b; the equal-band
   *  guarantee is only worth having if a test can find the band it is about.
   *  Omit for no foot (the map takes the whole frame). */
  footer?: ReactNode
  /** the eyebrow's lead-in before " · stop N of M". Default "where we are" */
  eyebrow?: string
  /** draws a ✕ at the wall's top right when passed; omit for no close affordance (M alone
   *  still works — and is the ONLY way down on a card too small for a ✕, see the note above
   *  this interface). Pressing it is always exactly a second M — the map comes down, the slide
   *  is back, and a room in full screen STAYS in full screen looking at the slide. It fades in
   *  on activity over the wall and recedes after the system's grace period (`useRecede`), the
   *  same manners as every other hover-revealed control — not permanently on screen. */
  onClose?: () => void
}
export function ProjectedMap(props: ProjectedMapProps): JSX.Element

/** the wall's reference frame and insets — see the docblock. `refWidth` 1120, `refHeight` 630,
 *  `captionLeft` 62, `captionTop` 44, `footHeight` 32; all chosen */
export const PROJECTED_MAP_METRICS: {
  refWidth: number; refHeight: number; captionLeft: number; captionTop: number; footHeight: number
}
