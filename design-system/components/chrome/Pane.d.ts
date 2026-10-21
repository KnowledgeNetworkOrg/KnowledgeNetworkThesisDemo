import type { CSSProperties, ReactNode, Ref } from 'react'

/** How far a scrolling body holds off the pane's top and bottom edges, so the scrollbar's end
 *  arrow clears the `--radius-lg` corner. Exported only for a pane that builds its own
 *  body (`scroll="none"`) — everything else gets it from `Pane` and should not restate
 *  the number. */
export const SCROLLER_INSET: number

/** WHERE EVERY PANE'S FIRST LINE SITS: 25px below the frame's top edge, measured to the top of the
 *  first line's text box. CHOSEN, not derived — do not recompute it. A scrolling body cannot start
 *  higher than 23 (`LEGEND_ROW` 11 + `SCROLLER_INSET` 12), and the document header already sat at
 *  25. **THE HOST'S OBLIGATION: panes side by side put their first line here**, whatever that line
 *  is (a section label, a rail header, a breadcrumb bar, a document header). Take the pad below
 *  that matches where the first row sits rather than restating a number. */
export const FIRST_LINE: 25
/** DERIVED: `FIRST_LINE` − `LEGEND_ROW` = 14. The top padding of a first row directly under the
 *  legend — a `scroll="none"` body with no margin of its own. `DocHeader` and the left
 *  `RailFrame` apply it themselves. */
export const FIRST_ROW_PAD: 14
/** DERIVED: `FIRST_ROW_PAD` − `SCROLLER_INSET` = 2. The top padding of a first row inside a
 *  scrolling body (`Pane`'s default body, or `PaneScroller`), which already starts 12 down. */
export const FIRST_SCROLL_PAD: 2

/** THE ROOM A SCROLLING COLUMN HOLDS OFF ITS OWN RIGHT EDGE, for the bar itself rather than for
 *  the pane's corners — a different number for a different reason, and CONDITIONAL, which is the
 *  part a caller has to take from here rather than reasoning about.
 *
 *  `scrollbar-gutter: stable` is the whole answer where a scrollbar HAS a width, and reserves
 *  exactly nothing where it does not — and FIREFOX IS THAT CASE, not an exotic one: a
 *  `scrollbar-width: thin` bar takes no layout space there, so the rows run beneath the thumb and
 *  it reads as the scrollbar clipping the pane (owner-reported on the running app in Firefox,
 *  2026-09-17). macOS overlay bars and touch devices are the same condition; Chromium with a
 *  styled `::-webkit-scrollbar` is the case where the gutter is real. PaneScroller applies this
 *  for you; a hand-rolled column scroller must call `scrollerPadRight()` itself, and must NOT
 *  simply add `SCROLLBAR_ROOM` unconditionally — where the gutter is real that doubles the gap.
 *
 *  A CALLER'S OWN `paddingRight` WINS, so pass one only for a reason that is not the scrollbar.
 *  Three did (`LectureNotes` twice, `LectureRecap` once, all 6px "clear of the scrollbar") and
 *  all three dropped it on 2026-09-17: that room is computed now, and a hand-picked 6 is both
 *  too much where the gutter is real and too little where it is not. */
export const SCROLLBAR_ROOM: number
export function scrollerPadRight(): number
/** WHAT A SCROLLBAR TAKES OUT OF A SCROLLING BOX ON THIS MACHINE — measured once from an
 *  offscreen box, memoised. 12 under this project's styled bars, 15-17 unstyled, 0 under an
 *  overlay bar. Not a token: it is a fact about the reader's platform, not a decision.
 *  (Moved here from `VersionedGroup` 2026-09-17, which re-exports it for its existing callers —
 *  one implementation, and it lives with the component that owns scrollers.) */
export function scrollbarWidth(): number

/**
 * The instrument pane, whole: the frame, its hat, and the body between them.
 *
 * Prefer this over composing a frame around `PaneHeader` by hand. The header's legend is
 * 11px tall against a `--radius-lg` (20px) corner arc, so three properties of the box
 * around it are load-bearing and no prop on the header could express them. Written into
 * this component 2026-08-17, after all three were missed in the app: a pane body
 * painting its own background bit two square notches out of the pane's rounded top, and
 * a scroller with no bottom inset had its end arrow clipped by the corner.
 *
 * What it now guarantees, so a caller cannot get it wrong:
 *
 *  1. The frame is `--surface-paper`, `--radius-lg`, a `--border-frame` hairline, and
 *     `position: relative`. `overflow` stays VISIBLE — the ✕'s notch and any menu a body
 *     opens have to leave the frame. A pane that genuinely must clip rounds all four
 *     corners at `--radius-lg`, never the bottom two alone.
 *     **AND NOTHING INSIDE THE FRAME CLIPS EITHER.** Added 2026-08-21: a frame that is
 *     correctly `visible` with an `overflow: hidden` + `--radius-lg` div immediately
 *     inside it (`src/studio/StudioView.tsx:216`) has all of the cost and none of the
 *     rule — the body's menus are trapped again, and the scroller inside the clip has
 *     its gutter bitten by the arc, which is where the app's cut scrollbar comes from.
 *     A body that paints no background needs no clip; see rule 2.
 *  2. THE BODY TAKES NO BACKGROUND — and `face` is not an exception to that, it is the
 *     alternative to breaking it. There is no body element for a caller to give a
 *     background to; the pane's own surface shows through. Painting a body
 *     `--surface-canopy` reads as a hole in the desk rather than as a pane. WHEN THE
 *     CONTENT ITSELF HAS A COLOUR — a map's water, a data field's hue — paint the FRAME
 *     with `face` and leave the body alone: the frame is behind the content at every
 *     content height, so the paper cutouts go from the corners and from below a short
 *     content in one move, where filling the body only covers the ones the content
 *     reaches. Added 2026-08-22.
 *  3. A scrolling body insets itself `SCROLLER_INSET` from the top AND the bottom — a
 *     scroller reserves an arrow square at each end of its gutter, and a pane has a
 *     rounded corner at each end of its right edge.
 *
 * A FLOATING PANE is this component with `grabbable`, not a hand-written frame: both props
 * pass straight through to `PaneHeader`, which supplies the grab cursor, `touch-action` and
 * `user-select` and leaves the moving to you. Begin your gesture in `onGrabStart`; nothing
 * here captures the pointer or sets a position, because the host owns its coordinate space.
 *
 * BOTH GESTURES WEAR A MARK, and neither is optional. `grabbable` puts a 2×2 dot `Grip`
 * AFTER the title, inside the same span that takes the pointerdown; `resizable` puts a
 * triangular one in the frame's bottom-right corner. Before 2026-08-21 the only affordance
 * was the cursor, which you cannot see until you are already hovering the right strip — so
 * a draggable pane and a fixed one were identical at rest. **A cursor is feedback, not an
 * affordance.** Both marks are one flat `--bark-400` with NO hover step: the cursor already
 * answers the hover, and a mark that also darkens is asking to be noticed twice. That tone is
 * below the text ramp on purpose (2.35:1, a considered exception to WCAG 1.4.11's 3:1 — see
 * `Grip.d.ts`), and TONE is the only lever for emphasis: fading a grip reads as a smudge,
 * shrinking its dot breaks uniformity, and removing dots cost the corner its shape.
 * A CALLER MUST NOT PASS A COLOUR THROUGH TO EITHER MARK. This component did — the resize
 * span handed `color: 'inherit'` to its `Grip`, which threw away bark-400 and inherited the
 * pane's text colour, so the corner painted near-black for two days while both files' prose
 * said bark-400 (2026-08-21c). It now sets the token on the span too, so even an `inherit`
 * resolves correctly. If you need a quieter or louder mark, change `Grip`'s default; do not
 * tone one instance.
 *
 * `PaneHeader` receives the frame through `PaneFrameContext`, so it knows which element
 * to watch for the pointer without walking the DOM. Nesting it inside a wrapper is fine.
 * (Before 2026-08-17e it reached `parentElement`, and "must be a direct child" was a rule
 * a wrapper div could break in silence — the ✕ simply never appeared. The walk survives
 * as the fallback for a pane composed by hand WITHOUT `Pane`, where it still applies.)
 */
export interface PaneProps {
  /** the pane's name. A pane carries a title and nothing else: no subtitle, no
   *  description, no contract line */
  title: string
  glyph?: string
  /** shows the ✕ on the frame. It arrives with the pointer and recedes on the
   *  scrollbar's clock */
  onClose?: () => void
  /** pane-scoped controls beside the title. The legend slot is 18px tall — icon-height
   *  only, and built from `IconButton` rather than by hand */
  actions?: ReactNode
  /** A COUNT ABOUT THE PANE'S CONTENTS, drawn ON the frame's top border at its right end, before
   *  any `actions` and the ✕ — "20 nodes · 31 relations" on the map (owner, 2026-09-27). Plain
   *  text at `--fs-micro`, `--text-3`, tabular numerals; it never recedes. NOT A CONTROL: pass a
   *  string or a text node, never a button — buttons go in `actions`. Compose the sentence
   *  yourself (the counts are yours); keep it to one short line, since the legend row does not
   *  wrap. Absent draws nothing. */
  tally?: ReactNode
  /** THE FRAME'S SURFACE, for content that has a colour of its own. Default: the pane's
   *  `--surface-paper`. Pass a colour and the FRAME is painted it — never the body, so
   *  rule 2 stands: the audit still warns for any body face except one matching this one.
   *
   *  WHAT IT IS FOR, precisely. A canvas painted its own colour leaves the pane's paper
   *  showing wherever the canvas cannot reach: at the four corners always, and below the
   *  content whenever the content is shorter than the pane — white cutouts around a
   *  coloured map (owner, 2026-08-22, from the app's `MapView`). Painting the frame
   *  removes them at every content height. Filling the body instead removes only the ones
   *  the content happens to cover, which is why that is not the fix.
   *
   *  ONLY WHEN THE CANVAS IS THE WHOLE BODY. A pane that also holds paper parts — a rail, a
   *  header row, a dock — keeps the paper frame and lets `PaneCanvas` carry the colour. A
   *  faced frame turns each paper part into a square-cornered box on the colour, and those
   *  boxes cut straight through the frame's rounded corners (owner, 2026-09-30, the app's
   *  map pane after the Explorer rail and crumb row moved into it).
   *
   *  ANY COLOUR, DELIBERATELY — and NOT a union. The colour this prop is for is not this
   *  system's: the app's water is the app's, and a face driven by a data field is chosen
   *  by code at runtime, per pane, with nobody looking. A closed union would also compile
   *  into a lint rule in a consumer's linter and report their own water as an invalid
   *  prop. So the type is loose and THE GUARD IS CODE: `audit` measures the resolved face
   *  against `--text-1` on mount and warns below 4.5:1. That threshold is the legend, not
   *  a general rule — the title straddles the frame's top edge, so its LOWER HALF sits on
   *  this face while its top half stays on the desk, and a face too dark for it produces a
   *  half-legible word rather than an obviously broken one. 11px semibold is small text,
   *  so AA's large-text 3:1 does not apply. Light faces are safe by a distance: the app's
   *  water measures 11.23:1. Nothing is refused — a dark canvas pane is a legitimate
   *  design, and `variant="bar"` gives the title a row of its own if you want one.
   *
   *  A faced pane's legend mask splits: 1px of `legendBg` over the border line, 1px of
   *  this face under it. One 2px strip of the desk colour painted a warm smear the width
   *  of the title as soon as a frame stopped being paper — see `PaneHeader.d.ts`. Added
   *  2026-08-22 */
  face?: string
  /** the colour the legend masks the border with; defaults to the desk. Pass the real
   *  surface if a pane ever sits on something other than `--surface-canopy` */
  legendBg?: string
  /** `legend` (default) or the older filled `bar` title row */
  variant?: 'legend' | 'bar'
  /** THE PANE'S OWN ACTIONS, docked between the header and the scrolling body — pass a
   *  `PaneActionBar`. Never pass one as a plain `children` element instead: this slot
   *  clips the bar's top corners to the frame's own arc (the same fix `PaneCanvas` uses),
   *  which a raw child sitting inside the scroller cannot get — it paints its opaque
   *  face square, inside the 20px radius, and bites two notches out of the rounded top. */
  actionBar?: ReactNode
  /** THE TITLE BECOMES A DRAG HANDLE. Passed straight through to `PaneHeader`, which supplies
   *  the grab cursor, `touch-action` and `user-select` and clears the grabbing state on the
   *  window; the host keeps the position, because a component that computes coordinates is the
   *  wrong shape. A floating pane is this, not a hand-written frame.
   *  Declared here 2026-08-19, reported by the app: this file's own prose has promised both
   *  props since they shipped and `Pane.jsx` has forwarded both, while `PaneProps` declared
   *  neither — a file contradicting itself, on exactly the component OB-013 points a port at. */
  grabbable?: boolean
  /** the pointerdown that begins the drag. Only fires when `grabbable`. Start your gesture
   *  here; nothing here captures the pointer or sets a position */
  onGrabStart?: (e: React.PointerEvent<HTMLElement>) => void
  /** show the resize corner — a `Grip variant="corner"` (three hairlines) in the frame's
   *  bottom-right, with `nwse-resize`, `touch-action: none` and text-selection off. It sits
   *  ON THE FRAME, outside the body box, so a scrolling body cannot scroll its own handle
   *  away and a `PaneCanvas` cannot clip it. THE MARK SITS OUTSIDE THE ROUNDED CORNER, in
   *  the notch the curve leaves: its tip is 2px beyond the frame's box corner per axis. The
   *  arc cuts R − R/√2 ≈ 5.86px deep on the diagonal and the mark is size/√2 ≈ 6.36px deep,
   *  so it is off the arc once the tip clears the corner by 0.51px on the diagonal — 2px is
   *  the LOOK, not the minimum, because at the minimum the hairlines graze the border. It
   *  was inside the arc until
   *  2026-08-21c — the padding that made the hit area also held the mark in. **THE FRAME
   *  MUST NOT CLIP.** A pane whose frame is given `overflow: hidden` cuts its own resize
   *  mark in half; `Pane` keeps the frame visible, and `PaneCanvas` crops the canvas box
   *  inside it for exactly this reason. Its hit area is 21px around the 9px
   *  mark, running inward from the corner — 44 is not
   *  available in the corner of a 200px pane, so 21 is the honest maximum at this mark size;
   *  16 (the first version) was a mouse-only gesture wearing `touch-action: none`. Carries `role=
   *  "separator"` and `aria-label="resize pane"`: `aria-hidden` belongs on the decorative
   *  `Grip` inside, never on the interactive wrapper, which is what the first version did —
   *  removing the pane's only resize affordance from the accessibility tree.
   *
   *  As with the grab, the pane owns the affordance and you
   *  own the geometry: nothing here captures the pointer, sets a size or enforces a
   *  minimum, because only the host knows its bounds and what else is on the board.
   *  Carries `data-resize` as a stable hook for an interaction driver — the sibling of the
   *  header's `data-grab`, which exists because the app's driver had resorted to finding
   *  the handle by its title text. Added 2026-08-21 */
  resizable?: boolean
  /** the pointerdown that begins the resize. Only fires when `resizable`. Read the frame's
   *  rect here and run your own move/up loop; the corner only swaps its cursor */
  onResizeStart?: (e: React.PointerEvent<HTMLElement>) => void
  /** which axis the body scrolls, and WHICH OF THE TWO SHAPES A BODY CAN BE.
   *  `y` / `x` / `both`: the pane's body is a `PaneScroller` and this component owns it.
   *  `none`: the body's CONTENTS come back to the caller — for a body split into columns
   *  that scroll separately, or one that is a canvas. The body BOX is still this
   *  component's: a transparent flex column under the hat, so a child sized
   *  `height: 100%` measures the body and not the whole frame. Wrap each scrolling part
   *  in `PaneScroller` (it carries the inset) and each cropping part in `PaneCanvas`; a
   *  raw `overflow: auto` has its end arrow clipped by the corner, and a raw
   *  `overflow: hidden` + radius wrapper is the one clip a pane must never have.
   *  (Before 2026-08-21 `none` rendered `children` as direct children of the frame, and
   *  "the root must be `flex-1 min-h-0`, never `h-full`" was a rule a caller had to know.
   *  It is gone; `h-full` now measures what a caller means by it.) */
  scroll?: 'y' | 'x' | 'both' | 'none'
  /** the frame element; `section` by default, `aside` for a palette or sidebar */
  as?: string
  /** merged into the frame — for the caller's own SIZE and place in its parent's flex
   *  (`flex: '0 0 var(--tree-w)'`, a fixed height). Not for the surface, the radius or
   *  the border: those are the pane's */
  style?: CSSProperties
  /** merged into the body — padding, and gap for a body that is itself a flex column.
   *  Not `background`, and not `marginBottom`. Under `scroll="none"` it lands on the body
   *  BOX: pass `{ flexDirection: 'row' }` for columns side by side, or `{ flex: 'none' }`
   *  for a strip that sizes to its own content */
  bodyStyle?: CSSProperties
  /** the scrolling element under `scroll="y"|"x"|"both"`, the body box under `none` */
  bodyRef?: Ref<HTMLDivElement>
  /** THE ONE RULE THAT CANNOT BE MADE STRUCTURAL, MADE LOUD INSTEAD. Default `true`: on
   *  mount the pane reads its own body once and `console.warn`s, naming the element, if
   *  a body element paints an opaque background (`PaneCanvas` excepted — its face is the
   *  canvas's own surface; a body matching the frame's own `face` is excepted too, since
   *  there is nothing lighter behind it to notch; anything 1px tall or less is excepted
   *  as well — a hairline divider in a body is a RULE, not a face, and cannot notch a
   *  20px corner arc, 2026-09-03), if a rounded clipping ancestor wraps a
   *  scrolling element, or if `face` leaves the legend title under 4.5:1.
   *  Nothing this component renders can stop a CALLER'S OWN ROOT painting itself
   *  `bg-slate-50`, and that failure is silent: it still looks like a pane, just the wrong
   *  colour with two square notches out of its top. Both checks are faults this system has
   *  shipped into a real app. Set `false` to silence; it costs one bounded pass per pane,
   *  once. Added 2026-08-21 */
  audit?: boolean
  children?: ReactNode
}
export function Pane(props: PaneProps): JSX.Element
/**
 * ONE SCROLLING COLUMN of a pane's body — for `scroll="none"`, a body split into columns
 * that scroll separately, which is the only reason a caller ever owns the body.
 *
 * It carries `SCROLLER_INSET`, so the rule it replaces ("a `none` body that scrolls must
 * apply the inset itself") is no longer something to remember. `Pane`'s own body IS this
 * component, so there is one implementation rather than two that can drift.
 */
export interface PaneScrollerProps {
  /** which axis scrolls; the other is hidden. Default `y` */
  axis?: 'y' | 'x' | 'both'
  /** the caller's padding and gaps. Not the inset or the overflow: those are the
   *  component's */
  style?: CSSProperties
  /** ref to the scrolling element, for scroll restoration and the like */
  forwardRef?: Ref<HTMLDivElement>
  children?: ReactNode
}
export function PaneScroller(props: PaneScrollerProps): JSX.Element
/**
 * THE OTHER SHAPE A PANE BODY CAN BE — a CANVAS whose content must be cropped, and the
 * only element in a pane that legitimately clips.
 *
 * Absolutely-positioned nodes can run past the pane's edge and have to be cut by the
 * curve rather than paint over the frame. That was documented as an escape hatch beside
 * the body rule and nothing more, and `src/studio/StudioView.tsx:216` read the hatch as
 * the WAY TO SATISFY the rule: an `overflow: hidden` + `--radius-lg` div around every
 * body, scrolling ones included. That is the one configuration a clip must never take —
 * the arc then has a scrollbar gutter to bite (the end arrow loses about half its 12px
 * square) and the body's menus are trapped by a frame deliberately left `visible`.
 *
 * So the distinction stops being something to remember: **a scrolling body is
 * `PaneScroller`, a cropping body is `PaneCanvas`, and only the second one clips.**
 *
 * IT DOES NOT REPEAT THE FRAME'S RADIUS. Each corner takes the frame's radius LESS this
 * box's inset from that corner, floored at 0 and MEASURED off the live frame. A box that
 * fills a rounded box and repeats its radius curves away from the parent's now-straight
 * edge and leaves a crescent of the parent showing: a canvas 12px under a 20px frame with
 * a 20px top radius shows two of them, and `--sink-1`'s 1px inner ring traces the lot,
 * which reads as a grey outline floating inside the body. Shipped that way for four hours
 * on 2026-08-21 and caught by our own card. Measuring rather than hard-coding is what
 * keeps the header's height out of this component — and it gets `variant="bar"` right for
 * free, where a 34px hat is past the arc and the top corners compute to square.
 *
 * A PORT MUST MEASURE AGAIN WHENEVER THE CANVAS OR THE FRAME CHANGES SIZE, not once at
 * mount. The inset is not fixed: a rail opening beside the canvas, or its seam being
 * dragged, moves the canvas's edge off the frame's. Measured once with the rail closed,
 * the corner at the seam keeps the frame's full radius and shows a notch of paper there
 * once the rail opens (the app's map pane, 2026-09-30). A `ResizeObserver` on both boxes
 * is enough, because every inset change resizes one of them.
 *
 * A PORT MUST FIND THE FRAME THROUGH THE DOM, not through `PaneFrameContext`. React
 * attaches a parent host element's ref after its children's layout effects have run, so on
 * first mount `frameRef.current` is null in here, the measurement bails, and nothing ever
 * re-runs it — the canvas then draws the frame's own radius, which is the exact bug this
 * measurement exists to prevent, with no symptom to notice. `Pane` marks its frame
 * `data-pane-frame`; fall back to the nearest ancestor with a non-zero radius, which also
 * makes this work inside a frame composed by hand. (The first version used the context and
 * shipped broken for one build, 2026-08-21.)
 *
 * `position: relative` either way, so the canvas's absolute children measure against it.
 * Added 2026-08-21.
 */
export interface PaneCanvasProps {
  /** `sunken` (default) for a recessed canvas, `paper` for one flush with the pane, `none`
   *  for a canvas that draws its own field. Never a raw colour — a canvas needing
   *  something else is asking for a token */
  face?: 'sunken' | 'paper' | 'none'
  /** make it a WELL rather than a lining: held `SCROLLER_INSET` off every edge at
   *  `--radius-lg`, with `--sink-1`. That ring belongs here and only here — a ring says
   *  “this is a distinct object”, and a lining is not one, so the bleed form (default)
   *  takes the face and no ring. Reach for `inset` when the canvas is one panel among
   *  several; leave it off when the canvas IS the pane's content and its nodes are meant
   *  to be cropped at the pane's own edge */
  inset?: boolean
  /** the caller's padding and gaps. Not the overflow, the radius or the position */
  style?: CSSProperties
  forwardRef?: Ref<HTMLDivElement>
  children?: ReactNode
}
export function PaneCanvas(props: PaneCanvasProps): JSX.Element
/** `PaneFrameContext` IS NOT DECLARED HERE. It is declared in `PaneHeader` and imported by
 *  this file — `Pane` already imports `PaneHeader`, so the other direction is a cycle, and a
 *  port that sites it in `Pane` bundles cleanly and fails at runtime with an undefined
 *  context (the ✕ never appears). See `PaneHeader.d.ts` for its declaration. */
