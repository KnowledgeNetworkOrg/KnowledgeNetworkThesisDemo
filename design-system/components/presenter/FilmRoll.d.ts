import type { ReactNode } from 'react'

/**
 * The presenter film roll: the live slide with its two whole neighbours. Part 2 of the
 * presenter-mode split (see `guidelines/presenter-component-split-plan.md`) — settled,
 * no open calls.
 *
 * WHOLE NEIGHBOURS, ONE FLAG CORNER. Neighbours used to bleed off the roll's edge, which
 * meant no single corner was reliable for the flag — it was arbitrary, chosen per card to
 * survive the clipping. Drawing both neighbours whole, at their own smaller size, is what
 * makes "the flag is top right, on every card, no exceptions" a true sentence.
 *
 * THE HOST SUPPLIES SLIDE CONTENT — this component places three cards, sizes them, dims
 * the neighbours, and carries the flag/expand affordances; it never renders a slide
 * itself. Same split `WalkPreview` already makes for its hover card.
 *
 * A NEIGHBOUR'S WHOLE CARD IS THE CLICK TARGET FOR ITS OWN DIRECTION, not its corner tag
 * alone — pass `onNavigate` on `prev`/`next` and hovering lightens that card's dim wash to
 * say it's clickable. The same handler also drives a big chevron over that edge of the
 * roll, an additional obvious affordance for a professor scanning left to right — both
 * point at the one handler, so there is exactly one way each direction actually moves.
 * Omit `onNavigate` for a read-only preview: no chevron, no click, no cursor change.
 *
 * THE ROLL FILLS ITS CONTAINER. `height`/`liveWidth`/`neighborWidth` are reference sizes
 * at scale 1 — a ResizeObserver scales all three together so the three cards' combined
 * width always matches whatever width it's given, clamped to `minScale`/`maxScale`. A
 * wider presenter screen gets bigger cards, in the same proportions; it never leaves a
 * dead band either side inside the frame (the old failure mode, from stretching the
 * bordered frame around fixed-size cards).
 *
 * THE TRAVEL FRAME (owner, 2026-09-16). A stop change plays one short slide instead of cutting:
 * the row of three cards starts one step displaced on the side it came FROM, at half opacity, and
 * settles over `--dur-move` — forward reads as content moving left, back as content moving right,
 * and the chevron for that direction goes full weight and leans 3px while it runs. The step is
 * DERIVED, not chosen: half the live card + the gap + half a neighbour, the real distance the live
 * card travels. Under `prefers-reduced-motion` `--dur-move` is 1ms and this is a cut again.
 *
 * THE MOVE IS ONE `Element.animate()` CALL, and the port must not turn it back into a CSS
 * transition. The first build committed a displaced frame with `transition: none` and re-rendered
 * to rest WITH a transition; the transition arrived after the element was already home, so nothing
 * interpolated — a frozen half-opacity hold, then a snap, measured at 0-210ms displaced and 245ms
 * home. It also raced a `requestAnimationFrame` return against a `setTimeout` reset, and rAF is
 * exactly what stops in a backgrounded window (`receipts/b546186.md`). Web Animations has no such
 * failure: there is one clock, and the row's own style stays STATIC.
 * BE PRECISE ABOUT WHAT THAT GUARANTEES, because the obvious stronger claim is false (measured
 * 2026-09-16): a pending or frame-starved animation APPLIES ITS FIRST KEYFRAME, so a window
 * getting no frames DOES hold the row at the displacement at 0.5 opacity until frames resume. What
 * is guaranteed is that no REACT STATE holds it — a remount, a cancel, or an environment with no
 * `animate()` leaves the cards at rest, and there is no second clock that can strip the move
 * halfway. Do not write "it can never park at the displacement" into the port; it can, briefly,
 * and only where nothing is being drawn anyway.
 * Read the duration and curve off the computed
 * `--dur-move` / `--ease-settle` — never a literal, which is what keeps reduced motion working.
 *
 * WHAT THE HOST MUST DO FOR THE CUE TO BE COMPLETE: pass `current.stopIndex`. With it the
 * direction is read from the number, so EVERY route into a new stop animates — keyboard arrows,
 * the strip, the finder, a jump of several stops. Without it the roll can only see its own clicks
 * (a chevron or a neighbour card) and a keyboard advance plays nothing at all; that is a partial
 * cue, not a break. A host that passes it does not also need to do anything on click — the roll
 * suppresses its click-driven path whenever the number is present, so the slide never plays twice.
 *
 * PROJECTING OR NOT (owner, 2026-09-03). `projecting={false}` is a PREVIEW of the presenter
 * layout with nothing on the projector — the Studio's palette Present. The live card's label
 * defaults to "Not on the projector" (the negation of the live default, same words), its moss
 * dot becomes the hollow bark ring `PresenterHeaderBar`'s preview chip wears, and
 * `current.elapsed` is not drawn: nothing is being timed. WHAT THE HOST MUST DO: pass the same
 * flag here and to the header bar (`state="preview"`), so the two never disagree about whether
 * the room is watching.
 */
export interface FilmRollProps {
  /** the roll's reference height in px at scale 1 — see the fill note above; card widths
   *  below stay in the same 1120:630 aspect as every slide, whole neighbours included */
  height?: number
  liveWidth?: number
  neighborWidth?: number
  /** how far the fill scale may shrink/grow the reference sizes. Default 0.55–1.6 */
  minScale?: number
  maxScale?: number
  /** the live card's corner label. Default "On the projector now", or "Not on the projector"
   *  when `projecting` is false; pass a string to override either */
  liveLabel?: string
  /** is the live slide actually on the projector. Default true. False = preview: negated label,
   *  hollow ring instead of the moss dot, `current.elapsed` hidden */
  projecting?: boolean
  /** the previous slide, or `null`/`undefined` at the first stop — no card renders there,
   *  its width stays reserved so the live card doesn't recentre */
  prev?: { content: ReactNode; stopLabel: string; flagged?: boolean; onNavigate?: () => void } | null
  /** the live slide. `content` is required in practice; typed optional only so a host
   *  mid-load can pass `current={null}` without a crash. `elapsed` is a running duration on
   *  this stop ("00:19"), folded into the live label's pill after a thin divider, shown
   *  ALWAYS while present — independent of `flagged`; time-on-stop and marked-for-revision
   *  are different ideas and don't share a spot. The HOST owns resetting it to zero when
   *  the live stop changes — this component just displays whatever string it's given.
   *  `stopIndex` is the live stop's position in the walk (0-based or 1-based, either, as long as
   *  it is consistent) — the roll reads only the SIGN of its change, to decide which way the
   *  travel frame slides. See the travel note above for what is lost by omitting it. */
  current?: { content: ReactNode; flagged?: boolean; elapsed?: string; stopIndex?: number } | null
  /** the next slide, or `null`/`undefined` at the last stop */
  next?: { content: ReactNode; stopLabel: string; flagged?: boolean; onNavigate?: () => void } | null
  /** v4 (owner, 6 Oct): THE ROLL IS FOR QUICK FLAGGING; THE NOTES PANE IS THE LOG. With `onFlag` the
   *  CURRENT frame wears `FlagChip` at its top right — tap for the usual type, hold (or right-click)
   *  for the ring of three — and this fires with the type's key. ADD A BARE FLAG to the shown slide
   *  (text ''), the same entry the notes pane's composer writes. Every OTHER frame wears the plain
   *  mark while its `flagged` is true: "this slide has flags", no type, no count, not a control. On
   *  the current frame the chip takes that corner, so a flagged current slide shows the chip, not the
   *  mark. `flagged` is DERIVED by the host: true while the slide has an unresolved flag. */
  onFlag?: (category: string) => void
  /** the ring's three types. Default `NOTE_CATEGORIES` (the first three of the user's list) */
  flagTypes?: Array<{ key: string; glyph: string; label: string; short?: string; wash: string }>
  /** the usual type's key — what a tap makes. Default 'fix'. HOST-HELD AND STORED (owner, 15 Oct):
   *  a type picked on the ring becomes the usual one, through `onUsualFlagChange` */
  usualFlag?: string
  /** the ring picked a type that is not the usual one: it is now. Store it against the user and pass
   *  it back as `usualFlag` here, on `LectureRecap` and on `LectureNotes` */
  onUsualFlagChange?: (key: string) => void
  /** the chip's "tap to flag · hold to change flag" tooltip. Default true; a host may switch it off once the
   *  professor has opened the ring twice (count with `onFlagRingOpen`) */
  flagHint?: boolean
  onFlagRingOpen?: () => void
  /** @deprecated v4 — the per-slide switch, the OLD flag model. Ignored once `onFlag` is passed.
   *  Without `onFlag` it still flips a flag on any of the three cards */
  onToggleFlag?: (which: 'prev' | 'current' | 'next') => void
  /** full screen, live card only, revealed on that card's own hover OR when keyboard focus is
   *  inside the card (2026-10-02). It stays in the tab order at rest, so a keyboard user can
   *  always reach it; focusing it reveals it. Omit to hide the button entirely */
  onExpand?: () => void
}
export function FilmRoll(props: FilmRollProps): JSX.Element

/** THE FLAG MARK, on its own — the plain mark a flagged neighbour frame wears, and the old
 *  switch's control. Since v4 (6 Oct) `LectureNotes` no longer wears it: the flag button moved to
 *  the current frame as `FlagChip`. Filled acorn and full opacity when
 *  `flagged`; an outline at reduced opacity when not; the hover wash follows the state. It does
 *  NOT decide when it is visible — the card and the pane each reveal it by their own hover rule
 *  (filled: always; outline: while recently hovered) — so wrap it in the reveal, don't add one. */
export interface FlagButtonProps {
  flagged?: boolean
  /** on a dimmed neighbour card: lower rest and hover opacities */
  dim?: boolean
  /** the mark, px. Default 12 */
  glyphSize?: number
  /** the hit box, px. Default 24 (a slide corner); 20 beside a 20px pencil in a pane head */
  size?: number
  /** px the mark is lifted inside the button. Default 0. BESIDE THE PENCIL pass `EDIT_MARK_LIFT`
   *  (from `EditMark`) or the pair reads misaligned — the pencil lifts itself by that much. */
  lift?: number
  onClick?: () => void
  /** default "flag this slide", in BOTH states. Also the button's spoken name (`aria-label`);
   *  `aria-pressed` follows `flagged` whenever `onClick` is passed, and is the ONLY carrier of
   *  the state. PASS A FIXED NAME, NEVER ONE THAT FLIPS WITH `flagged`: a flipping name plus
   *  `aria-pressed` reads "unflag this slide, pressed" (2026-10-02, `receipts/9b89dce.md`). */
  title?: string
  /** Pass -1 only where the reveal around it CANNOT be opened by focus, so the keyboard does not
   *  land on an invisible control. The film roll card no longer passes it: focus inside the card
   *  reveals the corner, so the flag stays in the tab order (2026-10-02). */
  tabIndex?: number
}
export function FlagButton(props: FlagButtonProps): JSX.Element
