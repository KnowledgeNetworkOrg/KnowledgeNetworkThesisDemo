import type { ReactNode } from 'react'

/**
 * The pane's hat. The title sits ON the pane's hairline border — the frame and
 * the label are one thing. A pane carries a title and nothing else: no subtitle,
 * no description, no contract line.
 *
 * WHAT THE PANE AROUND IT MUST DO. Three rules this header's geometry depends on that
 * no prop can express. PREFER `Pane`, which owns the frame and the body and makes all
 * three unstateable-wrong; these apply when something composes a frame by hand. They
 * lived in the design system's readme until 2026-08-17, where a port could not see them,
 * and all three were missed in the app:
 *
 *  1. `position: relative`, the `--border-frame` hairline on the pane itself, and
 *     `--radius-lg` (20px) corners. The legend masks the border with a straight 2px
 *     bar, which cannot erase a curve — a tighter radius leaves a stub beside the ✕.
 *  2. THE BODY TAKES NO BACKGROUND OF ITS OWN; the pane's `--surface-paper` shows
 *     through it. This header is 11px tall, so a body that paints its own colour starts
 *     INSIDE the 20px corner arc with square corners, and bites two square notches out
 *     of the pane's rounded top — worst when that colour is `--surface-canopy`, which
 *     reads as a hole in the sheet rather than as a pane.
 *     **THIS RULE IS NOT SATISFIED BY CLIPPING.** Amended 2026-08-21, because it was:
 *     `src/studio/StudioView.tsx:216` wraps every pane body in an
 *     `overflow: hidden` + `--radius-lg` div, cites this rule, and keeps its
 *     `bg-slate-50` bodies — the notches are hidden rather than gone, and the clip
 *     costs two things instead. It cuts the scrollbar: the scroller sits inside it, so
 *     the arc bites the gutter and the end arrow loses about half its 12px square. And
 *     it re-traps what the frame's `overflow: visible` was for — a menu opened in the
 *     body cannot leave a clip layer any more than it can leave a clipping frame.
 *     DELETE THE BODY'S BACKGROUND; do not add a clip. The only pane that legitimately
 *     clips is one whose CONTENT must be cropped (a canvas, a motif), and it rounds all
 *     four corners at `--radius-lg`, never the bottom two alone — that clause is an
 *     escape hatch for a pane that has no choice, not a way to satisfy this rule.
 *  A FLOATING PANE DOES NOT HAND-WRITE THIS HAT. Pass `grabbable` and start your gesture
 *  in `onGrabStart`; the header keeps the notch, the mask and the type, and you keep the
 *  drag. The app's `FloatingPanel` copied the whole legend for want of this prop and its
 *  padding drifted to `0 8px` against the system's `0 5px` — a wider hole in the top
 *  border than a pane's, structurally identical in every other respect. Added 2026-08-18.
 *
 *  3. A SCROLLING BODY INSETS ITSELF 12px FROM THE TOP **AND** THE BOTTOM
 *     (`marginTop` and `marginBottom`, not a radius on the scroller), so the scrollbar's
 *     end arrow stays clear of the corner arc at EITHER end instead of being clipped by
 *     it or painting out over it; the pane's own paper fills both strips. One inset
 *     serves both axes and both ends — a scroller reserves an arrow square at each end
 *     of its gutter, and a pane has a rounded corner at each end of its right edge.
 *     **Amended 2026-08-21. This rule said FROM THE BOTTOM until today, and that is
 *     what a port implementing it built** — `src/ds/chrome/PaneHeader.tsx:37` carries the
 *     bottom-only sentence verbatim and `src/studio/StudioView.tsx:219` is `mb-3` with no
 *     top margin, so the palette's top arrow paints out across its corner arc. The
 *     amendment landed in `Pane.jsx`'s `SCROLLER_INSET` docblock on 2026-08-17f and never
 *     reached this file, which is the one a port reads. If you implemented the
 *     bottom-only form, this is a re-read, not a new rule: add the top margin.
 *     Better still, take `PaneScroller`, which applies both.
 */
export interface PaneHeaderProps {
  /** lower case, one or two words: "tree", "document", "palette" */
  title: string
  /** an optional Unicode mark from the house set */
  glyph?: string
  /** drops the pane from the composition. Renders an 18px ✕ (tooltip "close")
   *  that is hidden while the pane is at rest and fades in — with its notch in
   *  the frame — whenever the pointer or the keyboard is inside the pane. */
  onClose?: () => void
  /** pane-scoped controls, rendered on the frame beside the title. The legend slot
   *  is 18px tall — put only icon-height controls here, never a full-height pill, and
   *  build them to the house icon-button recipe: round, transparent, with a **1px
   *  transparent border reserved at rest** so hover cannot move the glyph, then face →
   *  `--surface-hover`, border → `--border-rule`, ink `--text-2` → `--text-1`, and
   *  nothing else. A control on a frame is chrome, never destructive-hued */
  actions?: ReactNode
  /** a count about the pane's contents, on the border at the right end, before `actions` and
   *  the ✕ — plain text, `--text-3`, never receding, never a control. See `PaneProps.tally`. */
  tally?: ReactNode
  /** legend = the title straddles the pane border (default); bar = a filled title row */
  variant?: 'legend' | 'bar'
  /** what sits BEHIND the pane, so the legend can mask the border it interrupts.
   *  Defaults to `--surface-canopy`, the desk — correct for a docked pane and WRONG for
   *  a pane that floats above something else: the mask then paints a canopy-coloured notch
   *  across the pane's own top border. **A pane not sitting on the desk must pass its own
   *  face**, e.g. `--surface-raised` for a floating panel. Fails as a colour, not as an
   *  error, so nothing reports it. (The app's `FloatingPanel` hit this adopting the hat.) */
  legendBg?: string
  /** WHAT THE PANE ITSELF IS PAINTED, so the mask knows which pixel is which. Defaults to
   *  `--surface-paper`.
   *
   *  THE MASK IS TWO 1px STRIPS, NOT ONE OF 2px. The title's row is centred on the frame's
   *  top edge, so the upper pixel of the mask covers the border line (with the DESK behind
   *  it, hence `legendBg`) and the lower pixel covers the PANE'S OWN FILL. A single strip of
   *  `legendBg` therefore painted desk colour over the pane for its lower half — invisible
   *  for as long as every frame was paper on a canopy desk, and a 1px warm smear the width
   *  of the title the moment `Pane` grew a `face` (2026-08-22; measured at 8× in
   *  `guidelines/pane-content-face-2026-08-22.html`).
   *
   *  `Pane` passes its `face` down for you. A HAND-COMPOSED PANE MUST PASS IT: a frame
   *  painted anything other than paper and a header left to its default draws that smear,
   *  and like `legendBg` it fails as a colour rather than as an error, so nothing reports
   *  it. `variant="bar"` uses the same value as the title row's own face, for the same
   *  reason — a faced pane otherwise wears a paper hat. Added 2026-08-22 */
  frameBg?: string
  /** makes the title a drag handle, for a pane that floats. Opt-in and `false` by
   *  default: a docked pane is the common case and must not offer a grab cursor.
   *
   *  THE HEADER OWNS THE AFFORDANCE, THE HOST OWNS THE POSITION. Set this and the header
   *  supplies `cursor: grab` → `grabbing`, `touch-action: none` and `user-select: none`
   *  on the title, and clears the grabbing cursor on the window rather than on itself.
   *  Those are exactly what a hand-written copy of this hat forgets, and all of them fail
   *  invisibly: without `touch-action` the browser scrolls instead of dragging on touch,
   *  without `user-select` a slow grab selects the title text mid-drag, and a cursor
   *  cleared on this element stays `grabbing` after the pointer leaves.
   *
   *  It does NOT move anything, capture the pointer, or listen for pointermove/up. Where
   *  the pane ends up is the host's: only the host knows its coordinate space, its bounds,
   *  its snapping and its z-order, and a component that positions itself for a host that
   *  computes coordinates is the wrong shape (see `VersionedGroup`'s controlled props).
   *  Your existing gesture loop is untouched — begin it in `onGrabStart`.
   *
   *  IT ALSO PUTS A `Grip` AFTER THE TITLE — 2×2 dots, inside the same span that takes the
   *  pointerdown, so the mark sits in the hit area it advertises rather than beside it. Not
   *  optional, and not the caller's to place: before 2026-08-21 the only affordance was the
   *  cursor, so a draggable pane and a fixed one were identical until you happened to hover
   *  the exact strip. It TRAILS the title and it is a square rather than a 2×3 rectangle —
   *  both corrections the same day: the taller form competed with the title for weight, and
   *  leading it read as a bullet on the pane's name instead of a handle. One flat tone,
   *  `--bark-400`, with no hover step — the cursor answers the hover, and a mark that darkens
   *  too is asking to be noticed twice. `--bark-400` is `Grip`'s own quiet default, so this
   *  header passes no colour at all — tone is the lever for emphasis, never a fade. */
  grabbable?: boolean
  /** the pointerdown that begins a drag on the title. Only fires when `grabbable`.
   *  Start your own gesture here — capture the pointer yourself if you want it. */
  onGrabStart?: (e: React.PointerEvent<HTMLElement>) => void
}
/** FINDING THE HANDLE FROM OUTSIDE. A `grabbable` header marks its title element
 * `data-grab=""` — the same attribute `VersionedGroup` puts on its card's grab surface, so
 * `[data-grab]` finds every drag handle in the system. Use it in tests and interaction
 * drivers instead of matching the title's TEXT, which changes whenever the copy does.
 * It is an identifier only: no cursor, `touch-action` or selection behaviour is handed
 * back with it. Added 2026-08-19, for a driver that lost its own hook adopting this hat. */
export function PaneHeader(props: PaneHeaderProps): JSX.Element
/** WHERE THE LEGEND'S FIRST LETTER SITS, from the frame's outer edge — 21, DERIVED from the
 *  legend row's 16 offset plus the title span's 5 padding; it follows those two, never the
 *  other way round. A body whose text should line up under the legend pads its LEFT by this
 *  (`paddingLeft: LEGEND_INSET`); the right side keeps its own clearance for the scrollbar.
 *  Until 2026-09-04 every body sat 13–14 in, a 7px near-miss under a 21px legend that read as
 *  neither a step nor an alignment (owner). The presenter panes use it; see OB-143 for the rest. */
export const LEGEND_INSET: 21
/** HOW TALL THE LEGEND ROW IS — 11. `Pane`'s `FIRST_ROW_PAD` and `FIRST_SCROLL_PAD` are derived
 *  from it; read those rather than subtracting this yourself. */
export const LEGEND_ROW: 11
/** THE FRAME, HANDED DOWN. `Pane` publishes a ref to its frame element here and this
 *  header reads it, so the header knows which element to watch for the pointer without
 *  walking the DOM and can sit at any depth inside the pane. A caller composing a pane by
 *  hand can provide it for the same reason; without a provider the header falls back to
 *  `parentElement`, which is why "must be a direct child" was a rule until 2026-08-17e.
 *
 *  DECLARED HERE, in `PaneHeader`. `Pane` imports it from this file — never the other way
 *  round, which would be a cycle: `Pane` already imports `PaneHeader` itself. A port that
 *  declares it in `Pane` bundles cleanly and fails at runtime with an undefined context,
 *  which presents as the ✕ never appearing — the exact silent failure the context exists
 *  to remove. */
export const PaneFrameContext: import('react').Context<{ current: HTMLElement | null } | null>
