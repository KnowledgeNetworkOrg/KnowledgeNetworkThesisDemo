import type { CSSProperties } from 'react'

export interface QuickAction {
  /** stable, and the id `on`, `onSwap` and the shelf all speak in */
  id: string
  /** two or three words, sentence case — "Project map", not "PROJECT MAP" or "map" */
  label: string
  /** the keyboard shortcut, shown mono at the tile's trailing edge as `(M)`. A single bare letter
   *  is also BOUND by the deck while it is mounted — a hint nothing listens for is a picture of a
   *  feature. Not bound for a `placeholder` or `disabled` action, and never while a field or a
   *  contenteditable has focus. A written chord like `⇧⏎` still DRAWS; binding one is the host's */
  key?: string
  /** the 9px square's colour — the KIND of action, e.g. `'var(--hue-teal-ink)'`. Any colour,
   *  deliberately: a host's action kinds are the host's, and a closed union here would compile
   *  into a lint rule against them */
  dot?: string
  /** the tile's tooltip, when the label is not the whole story */
  title?: string
  /** THE SLOT IS NOT DECIDED YET: dashed border, dashed dot, no key, unlit, and a tooltip saying
   *  so. Hover strengthens the dashed border and nothing else — findable, not clickable. It is
   *  NOT natively `disabled` (only `disabled` actions are): a disabled control dispatches no
   *  mouse events in Chrome or Safari, which killed both the hover and the tooltip. The click is
   *  guarded, `aria-disabled` is set and it is out of the tab order, so it is inert to everything
   *  except the pointer that needs to read it. Not the same as `disabled` — a greyed tile says
   *  "this action exists and you cannot have it", where a placeholder says "nobody has chosen
   *  this one" */
  placeholder?: boolean
  /** the action exists and cannot be run right now (nothing to blank, no next flag). Natively
   *  `disabled`, so NO HOVER and no tooltip — a refusal that lights up invites the click it is
   *  going to swallow */
  disabled?: boolean
  onSelect?: () => void
}

export interface QuickActionGroup {
  /** the group's name — "Class controls", "Other actions". Omit for an unlabelled block */
  label?: string
  actions: QuickAction[]
}

/**
 * The quick actions deck — part 6 of the presenter-mode split
 * (`guidelines/presenter-component-split-plan.md`). Eight tiles in two named groups, a shelf of
 * everything else behind one button, and drag-to-swap between the two.
 *
 * THE TILES ARE PLACEHOLDERS TODAY, on purpose (owner, 2026-09-03: "place placeholder buttons for
 * now, as we're not sure yet what buttons we should have on there"). `QUICK_ACTION_PLACEHOLDERS`
 * is the default `groups` and is what the Studio and the card both show, so the eight are named
 * in ONE place and whatever replaces them replaces them once. The two group names are the part of
 * v18 that is settled; the tiles inside them are not.
 *
 * WHAT THE COLUMN AROUND IT MUST DO. The deck is the `flex: 1; min-height: 0` pane of a fixed
 * 360px column beside the notes pane — the same column the recap's flagged-slides pane stands in,
 * so nothing moves sideways when the lecture ends. It sets its own flex; give the COLUMN the
 * width, never the deck a height.
 *
 * EIGHT IS THE DECK, AND THE CAP IS A CODE GUARD. Two columns of four is the shape: reachable
 * without reading, and it fits the column beside the notes pane at the tile height that stays
 * hittable mid-lecture. A ninth tile is a SILENT failure — it fits, it looks right, and the deck
 * stops being a deck — so `QuickActionsDeck` drops the overflow and `console.warn`s naming the
 * dropped labels, rather than stating the cap in prose and hoping. Raise `cap` deliberately if the
 * owner ever decides otherwise; the drag mechanic is what makes eight liveable.
 *
 * ON IS A HELD STATE, NOT A PRESS. `on={['map']}` says the map IS up, the slide IS flagged — the
 * tile takes the walk-tinted active face the system reserves for exactly that (acorn wash,
 * `--border-walk`, `--text-walk` ink, and its dot goes `--accent-walk`). A momentary action never
 * appears in `on`.
 *
 * **THE SHELF OPENS BESIDE THE PANE** (owner, 2026-09-03: "we cant drag the buttons onto the
 * buttons behind the pane"). It used to open above the More button — which sits at the pane's
 * FOOT, so "above" was directly over the deck: measured in the Studio, six of the eight tiles
 * were under the popover, and those tiles are every drop target the gesture has. Beside it, the
 * deck is whole and droppable. The side is MEASURED on open: left when the pane has room (it is
 * the presenter's right-hand column, so it normally does), right when it does not.
 *
 * Drag a shelf tile onto a deck tile and `onSwap(shelfId, deckId)` fires — the
 * host does the exchange, since only it knows which group the tile lands in and what to persist.
 * The tile under the pointer is NAMED while it is hovered ("↑ shelf") rather than merely
 * highlighted: the deck is fixed at eight, so something has to go, and the professor is entitled
 * to see which. Omit `onSwap` and the shelf becomes a plain list of actions to RUN — no drag, no
 * instruction line, nothing that suggests a rearrangement the host cannot perform.
 *
 * THE SHELF MOVES, AND WHERE IT SITS IS THE HOST'S TO REMEMBER (owner, 2026-09-04: "can we grip
 * the more actions or the top of its pane to drag it… the position of it should be saved"). Its
 * header row is the handle, with a `Grip` as the affordance — `PaneHeader`'s split, and the whole
 * row rather than the mark because a 9px target is not a target. `shelfPosition` is a DELTA from
 * the computed beside-placement, never an absolute point: the side is measured on every open, so a
 * saved coordinate would be wrong the first time the window changed width or the deck flipped
 * sides. The delta is clamped to the viewport when the shelf opens, so one saved on a wide screen
 * cannot strand the shelf off the edge of a narrow one. Omit the pair and the deck remembers it
 * for the session only — THE PANE STORES NOTHING, the same boundary a minted category has.
 *
 * A DRAG OVER THIS PANE SELECTS NOTHING (owner, 2026-09-04). Every word on it is a control's own
 * label or a heading over one, so there is no content here to protect — and the deck's whole
 * gesture is a DRAG (shelf tile onto deck tile), which a text selection fights. Refused on the
 * pane body, not per part.
 *
 * THE DIVIDER BETWEEN THE GROUPS is v18's rule, softened three times at the owner's ask
 * (2026-09-04): `dividerInk` is `--bark-200` rather than `--border-hair` (a solid tint, lighter on
 * paper, and no new alpha token to mirror); `dividerInset` is 0, so it runs the full width of the
 * tile grid and ends exactly where the buttons do; and `dividerBlock` is 18 (9/8 margins on a 1px
 * line) rather than v18's 25. **Ink is how loud it is, extent is what it claims to separate, and
 * the BAND is how thick it reads** — the line itself stays 1px, the thinnest a border renders
 * identically across displays, so "less thick" came off the margins. Two earlier attempts are
 * recorded because both were wrong in an instructive way: SHORTENING it (10px inset) made a
 * fragment of a division, and DELETING it to buy height answered "too strong" by removing what the
 * plan has.
 *
 * IT IS NOT LABEL FURNITURE. It drops AFTER the labels and only when 28px tiles will not fit
 * around it — a label costs 21 per group, the rule 18 for the pair, so the rule outlives them. For
 * one turn it dropped WITH them, which took it off the owner's own 214px pane the same day they
 * asked for it back; at 214 it now survives with the tiles at the 28 floor. Amended 2026-09-05: it
 * also comes BACK, with the labels, at any height where the scroller is unavoidable — see the
 * ladder below.
 *
 * THE KEY COLUMN IS THE LABEL'S BUDGET, and the numbers are measured, not chosen: at the 162px
 * tile the presenter's 360 column gives, 162 − 18 (`tilePadX` 9 a side) − 9 (dot) − 12 (two
 * `tileGap`s) leaves 123, so a real `(Q)` at ~22px leaves the label 101 — and v18's longest name,
 * "Take a question", measures 90. The first cut of this column left 89 and truncated it, along with
 * every other 15-character name in the plan (found by review, 2026-09-04). `keyBox` 14 is the
 * placeholder's dashed stand-in; it has to read as a column, not as a keycap. `tilePadX` is 9
 * rather than v18's 10 for the last two px — imperceptible, and the difference between 11px of
 * slack and 9.
 *
 * THE KEY HINT IS DRAWN AND BOUND. `action.key` prints in the tile's mono column as `(M)`, and the
 * deck listens for that bare letter while it is mounted and calls the action's own `onSelect` — a
 * hint nothing listens for is the fault this system spent a day removing from the shelf's "esc to
 * close", and it is not coming back in another column. Not bound: a placeholder or a disabled
 * action (nothing to run), a chord (the host's), or any keystroke while a field or a
 * contenteditable has focus — a professor writing a note must be able to type an M. A PLACEHOLDER
 * still draws the column, as a dashed box: the slot exists, nobody has chosen it, same vocabulary
 * as its dashed dot. Eight tiles with a blank right edge read as a different design.
 *
 * THE EIGHT ARE VISIBLE WITHOUT SCROLLING AT WHATEVER HEIGHT THE HOST GIVES (owner, 2026-09-04,
 * asked twice — and the second ask is what sent me to measure the REAL pane: 214px in their
 * Studio, not the 311 the card had been built around, so the deck had 146px of content space for
 * 240px of tiles). The deck measures what it is given and FITS ITSELF, degrading in order:
 *  - **tile height** first, from `tile` (42, the v18 look) down to `tileMin` (28 — the smallest
 *    that still reads as a pressable row; the tile drops to `--fs-caption` under 38 on its own);
 *  - then the **row gap**, `gap` 8 down to `gapMin` 4 — the cheapest height on the pane, and it is
 *    bought BEFORE any words are given up. The COLUMN gap never moves: horizontal room is not what
 *    runs out.
 *  - then the **group labels**, which at 214 are 42px of the 146 available and cannot be fitted
 *    around at any legible tile height. The tiles still say what they are; a heading only says
 *    where a group starts.
 *  - then the **rule** between the groups, replaced by `groupGap` — the last thing separating them.
 *  - below the floor, the scroller takes over — the net, not the norm.
 * Between the headings and the rule there is one more rung: **the tiles again, `tileMin` 28 down to
 * `tileFloor` 22** — the smallest row this system will draw as pressable. A scrollbar is the LAST
 * rung and not a middle one, because a control deck you have to scroll to reach is not a deck
 * (owner, 2026-09-05: "i want the quick actions pane to not have a scrollbar, could we make the
 * buttons scale smaller?"). At the 206px pane they actually have, the deck lands on tight gap +
 * rule + no headings, tiles at 28, and nothing scrolls.
 * **The ladder only climbs down while there is something to buy.** Steps 2 and 3 exist to AVOID the
 * scroller, so once even the bare grid at `tileMin` will not fit, both come BACK: the pane scrolls
 * either way, and a scrolling deck with its headings and its rule reads better than a scrolling one
 * without them. The owner's own Studio landed under that floor (2026-09-05: "the divider is now gone
 * and also the 8 buttons is causing the scroll bar to appear?") — eight tiles at 28, a scrollbar,
 * and the two things they had asked twice to keep, spent for nothing.
 * This measurement is the COMPONENT's and cannot be the host's: only the deck knows how many rows,
 * labels and gaps its own groups make. `cap` still governs how many tiles exist; this governs how
 * they fit.
 *
 * THE TILES SCROLL AND THE SHELF BUTTON DOES NOT, which is the NET and not the norm (owner's
 * screenshot, 2026-09-03). At 311 nothing scrolls; below it a `scroll="none"` pane with no
 * scroller CROPS in silence — the owner's pane had lost its last tile row and the More button with
 * it, with no scrollbar to say so. The groups take a `PaneScroller` and the button is pinned under
 * it: a short pane stays usable, and losing the one control that always works is not on. The first
 * group label clears the pane's legend by `QUICK_ACTIONS_METRICS.headClear` (6), the same
 * clearance `LectureNotes` needed — at 0 it read as a second line of the legend.
 *
 * THE SHELF BUTTON IS DASHED, the same thing dashed means everywhere else here: this is where the
 * deck is still open to change. It keeps its place when the shelf is open so the popover has a
 * fixed anchor. FOUR FACES, published as `QUICK_ACTIONS_METRICS.shelfFace` so the change is
 * guardable: `--bark-50` at rest, `--bark-100` hovered, `--bark-100` open, and `--bark-200`
 * hovered WHILE open — open and hover were one wash for a turn, so an open button answered the
 * pointer with nothing (owner, 2026-09-03). The dash goes `--border-strong` and the ink
 * `--text-1` for every lit state: transparent, this button read as a caption rather than the one
 * control on the pane that always works.
 *
 * THE SHELF'S CLOSE SITS ON ITS TOP-RIGHT BORDER and is revealed while the pointer or the keyboard
 * is inside, fading on `--dur-hover` — a pane's own recipe, and `StopFinder`'s (owner,
 * 2026-09-03). The border LINE is masked by a 1px strip of the popover's own face; the mark itself
 * is transparent and floats over whatever is behind. Escape still closes it, and `Close (esc)` is
 * the tooltip.
 *
 * EVERY TILE THAT IS NOT REFUSING HOVERS (owner, 2026-09-03). A live tile takes the face and the
 * strong border. A PLACEHOLDER takes the strong border alone and keeps its dash and its face — the
 * pointer has to be able to find a slot nobody has decided without being promised a click; the
 * deck had a hover from the start and it never showed, because every tile on it is a placeholder.
 * A `disabled` action takes NOTHING: that is a refusal with a reason, and lighting it invites the
 * click it will swallow. The shelf's own button hovers too. **Only a `disabled` action carries the
 * native attribute** — a disabled control dispatches no mouse events in Chrome or Safari, so a
 * natively-disabled placeholder had neither hover nor tooltip; a placeholder is undecided, not
 * refusing, and stays a hit-test target (click guarded, `aria-disabled` set, out of the tab
 * order).
 *
 * WHAT IT DOES NOT OWN: the actions, which are on, and what a swap does. **Escape closes the
 * shelf and that is the component's** (2026-09-03) — the shelf used to carry an "esc to close"
 * text button with nothing listening for the key. It is the house ✕ on the border now (see above),
 * tooltip `Close (esc)`,
 * and a document-level key handler makes the tooltip true; the shelf takes no focus of its own
 * (it is a drag target), so the listener cannot be local. A CONTROLLED shelf still gets it: the
 * key calls `onLibraryOpenChange(false)` like the mark does.
 */
export interface QuickActionsDeckProps {
  /** the deck's tiles, in groups, capped at `cap` in order. Defaults to
   *  `QUICK_ACTION_PLACEHOLDERS` */
  groups?: QuickActionGroup[]
  /** everything not on the deck. Empty and the shelf opens on nothing — pass at least one, or
   *  give the shelf button no reason to exist */
  library?: QuickAction[]
  /** the tile cap. Default 8. See the guard above before changing it */
  cap?: number
  /** tiles per row, deck and shelf alike. Default 2 */
  columns?: number
  /** ids of actions in a HELD state */
  on?: string[]
  /** controlled shelf. Omit and the deck owns it. Escape closes it either way — controlled, the key
   *  calls `onLibraryOpenChange(false)` */
  libraryOpen?: boolean
  onLibraryOpenChange?: (open: boolean) => void
  /** where the shelf sits, as a DELTA in px from its computed placement beside the pane — the
   *  gesture is a drag on the shelf's own header. Never an absolute point: which side the shelf
   *  opens on is measured per open, so a coordinate saved today is wrong after a resize. Persist
   *  it against the USER (this is a lecturer's habit, not a stop's state); the pane holds it for
   *  the session only if the pair is omitted, and it is clamped to the viewport on open */
  shelfPosition?: { x: number; y: number }
  onShelfPositionChange?: (offset: { x: number; y: number }) => void
  /** a shelf tile was dropped onto a deck tile. The host performs the exchange. Omitted, the shelf
   *  is a plain list of actions to run */
  onSwap?: (shelfId: string, deckId: string) => void
  /** a shelf tile was CLICKED rather than dragged — run it without adopting it */
  onLibrarySelect?: (action: QuickAction) => void
  /** the pane's legend. Default "quick actions" */
  title?: string
  /** the shelf button's label when closed. Default "+ More actions…" */
  moreLabel?: string
  /** the instruction under the shelf's tiles. Shown only when `onSwap` is set; pass `''` to
   *  suppress it */
  libraryNote?: string
  /** merged into the pane frame — the caller's flex share. Not the surface, radius or border */
  style?: CSSProperties
}
export function QuickActionsDeck(props: QuickActionsDeckProps): JSX.Element

/** EIGHT TILES THAT SAY NOTHING YET — two groups of four, every action `placeholder: true`. The
 *  deck's default `groups`, and the one place the eight are named. */
export const QUICK_ACTION_PLACEHOLDERS: QuickActionGroup[]

/** THE SWAP, AS CODE (2026-09-04). Pure: the shelf action takes the deck slot, the displaced deck
 *  action goes to the END of the shelf; an unknown id returns both lists untouched. Call it from
 *  `onSwap` and store what comes back — the lists are the host's, the arithmetic is not. */
export function swapActions(groups: QuickActionGroup[], library: QuickAction[], shelfId: string, deckId: string): { groups: QuickActionGroup[]; library: QuickAction[] }
export const QuickActionsMath: { swap: typeof swapActions }

/** The deck's numbers. `cap` 8 is the DECIDED shape; the tile heights are CHOSEN on the v18
 *  render (the shelf's are one step down, so an open popover reads as the shelf and the deck as
 *  the hand). `tileFill` ('100%') is load-bearing rather than decorative: a `<button>` at
 *  `width: auto` is fit-content even at `display: flex`, so a shelf tile inside its draggable
 *  span drew narrower than its grid cell — which read as too much space between the tiles and as
 *  a centring fault. It is PUBLISHED because the tile is a module-level helper, so a value here
 *  is the only form of it a specimen card's staleness guard can reach. `shelfOffset` (21) is
 *  DERIVED, not chosen: the shelf's anchor is the More button, which sits inside the pane body's
 *  13px inset, so 8px of air from the anchor would put the popover 5px inside the pane's own
 *  frame. 13 + 8. */
export const QUICK_ACTIONS_METRICS: {
  cap: number; tile: number; libraryTile: number; columns: number; gap: number; dot: number
  gapMin: number; tileFloor: number
  tileFill: string; shelfFace: { rest: string; hover: string; open: string; openHover: string }
  shelfOffset: number; headClear: number; groupGap: number; tileMin: number; labelBlock: number
  dividerBlock: number; dividerInset: number; dividerInk: string; tileGap: number; keyBox: number
  tilePadX: number
}

/** THE PARTS, PUBLISHED SO THEY CAN BE READ — the same function objects the deck renders (`Tile`,
 *  `Library`), not a second copy and not a widened API. `String(NS.QuickActionsDeck)` contains
 *  only the exported function's own body, so anything living in a module-level helper is
 *  invisible to a specimen card's staleness guard: six of one card's seven tokens were
 *  unreachable or false at once before this existed (2026-09-03). READ THEM, DO NOT RENDER THEM
 *  — the supported surface is `QuickActionsDeck`, and these two take undocumented internal
 *  props that will change without notice. */
export const QUICK_ACTION_PARTS: { Tile: unknown; Library: unknown }

/** THE DECK'S `PaneFit`, plus the width it stands at untouched — read it for the presenter's
 *  divider between the notes pane and this column. `seed` 360 (the column `LectureRecap`'s aside
 *  keeps); `floor` 300, CHOSEN: two tile columns whose labels still read. A host stores the
 *  professor's drag and re-clamps it against the measured row every render. */
export const QUICK_ACTIONS_FIT: { narrowBelow: number; floor: number; seed: number }
