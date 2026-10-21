import type { ReactNode } from 'react'

export interface StopFinderStep {
  title: string
  territory?: string
  /** colours the territory heading in the grouped (no-query) view — `--hue-<hue>-ink` */
  hue?: string
}

/**
 * The stop finder — part 8 of the presenter-mode split. A popover under `PresenterStrip`'s find
 * button: type, the walk narrows, ↑↓ pick, ↵ roams there, esc closes.
 *
 * IT NEVER MOVES THE ACTIVE NODE. `onPick(index)` is the same ask as clicking a tick on the strip —
 * the host starts roaming there (`setRoamingStop(i)`). Committing stays the hold on the strip's
 * ring, so the finder cannot skip the one deliberate gesture the mode is built around.
 *
 * NO QUERY IS AN OUTLINE: every stop, grouped under territory headings in the territory's hue, so a
 * professor who cannot recall a name can browse. A query flattens to matches in walk order, each row
 * then carrying its territory (the heading is gone). A query of digits only also matches that stop
 * NUMBER exactly, because the pill and the header speak in numbers. `filterStops` is exported so a
 * host driving the finder from a keyboard shortcut can reuse the rule. Under a query a count line
 * sits under the box: "N matches" / "k of N matches", k being the selected row's place (2026-10-01,
 * the same line the Explorer filter and `NodePicker` draw).
 *
 * ROWS ARE THE STRIP'S VOCABULARY: a 16px `StepDot` in the stop's state (`done` / `current` /
 * `ahead`, honouring `covered` like the strip), the title with the matched run on `MatchTitle`'s
 * neutral highlighter (2026-10-01; bold vanished on the current stop's semibold row), a
 * `FlagMark` for a flagged stop, a "ROAMING" cap on the roaming stop. The selection follows the
 * keyboard AND the pointer — one wash (`--surface-hover`) means "↵ picks this". The query box is
 * `TextInput`, the system's text box, with the magnifier inside its left end.
 *
 * TWO WAYS TO SHOW THE HOVERED STOP, both the host's content:
 *   `renderAside` — THE PRESENTER'S DEFAULT (owner, 2026-09-02): a column `STOP_FINDER_METRICS.asideWidth`
 *     (220) wide to the right of the list, present with or without a query, redrawn for the hovered
 *     OR keyboard-selected stop; `null` when nothing is selected. The place for a small territory
 *     map that frames the stop — the map is the host's drawing. The presenter host passes this.
 *   `renderPreview` — `WalkPreview` above the hovered row, the same card every walk surface shows.
 *     Pointer only (a card needs a pointer under it); the keyboard never opens it. For a host with
 *     no map to show; passing both draws the stop twice.
 *
 * WHAT THE HOST MUST DO:
 *
 *   1. OPEN IT FROM `PresenterStrip.onFind(rect)` and pass that rect as `anchor` — the finder is
 *      `position: fixed`, portaled into `document.body`, hung `STOP_FINDER_METRICS.gap` below the
 *      anchor's bottom-left and kept inside the viewport. Re-read the rect if the strip moves.
 *   2. CLOSE IT ON `onClose` — fired by esc, by a pick, by a mousedown outside the panel (a mousedown
 *      on the anchor itself is NOT outside, so the strip's magnifier can toggle), and by the panel's
 *      own ✕ — on the top-right border like a pane's, revealed while the pointer or keyboard is
 *      inside; its notch is the panel's own face, since a popover cannot know the desk behind it.
 *      The host owns `open`; the finder never hides itself. Pass the same `open` to the strip as
 *      `finderOpen`, so its magnifier draws pressed and closes on a second click.
 *   3. WITHOUT `anchor` IT RENDERS IN FLOW — for a host with its own overlay layer, or a specimen.
 *      The outside-click rule is off in that mode (there is no "outside" it can know about).
 *   4. A KEYBOARD SHORTCUT TO OPEN IT (v18 drew "J") is the host's, like every presenter shortcut.
 */
export interface StopFinderProps {
  steps: StopFinderStep[]
  /** the lecture's record — drawn `current`; stops before it `done` unless `covered` says otherwise */
  activeStop: number
  /** the roaming stop, if any — its row carries a "roaming" cap and is the initial selection */
  roamingStop?: number | null
  flags?: number[]
  /** the host's list of presented stops, as on `PresenterStrip` — decides `done` vs `ahead` */
  covered?: number[]
  /** the host owns this; default `true` */
  open?: boolean
  /** the find button's `getBoundingClientRect()` — pass the WHOLE rect (`top`/`right` let a mousedown
   *  on the button count as inside, so it can toggle); omitted, the panel renders in flow */
  anchor?: { left: number; bottom: number; top?: number; right?: number }
  /** a stop was chosen — typically `setRoamingStop(index)` */
  onPick?: (index: number) => void
  /** esc, a pick, a click outside, or the panel's ✕ — the host sets `open` false. Omitted, no ✕ draws. */
  onClose?: () => void
  /** the input's placeholder and aria-label. Default "find a stop" */
  placeholder?: string
  /** focus the input when it opens. Default `true` */
  autoFocus?: boolean
  /** the hover preview's content — `WalkPreview` above the hovered row. Omitted, a native `title` */
  renderPreview?: (step: StopFinderStep, index: number) => ReactNode
  /** the right-hand column's content for the selected stop (`null` = none selected). Given, the panel
   *  is `width + asideWidth` wide. THE PRESENTER PASSES THIS — the map aside is the default, with or
   *  without a query. */
  renderAside?: (index: number | null) => ReactNode
  /** the hovered stop, `null` on leave — for a host lighting the same stop elsewhere */
  onStepHover?: (index: number | null) => void
  /** FLAT, for a finder sitting IN a surface that already frames it (`PresentStartCard`'s walk
   *  list): no border, shadow, face or ✕; the full width it is given; the list does not scroll on
   *  its own, so the HOST must scroll. `onClose` still fires on Escape. Ignored with `anchor`. */
  flat?: boolean
}
export function StopFinder(props: StopFinderProps): JSX.Element | null

/** width 320, asideWidth 220, maxListHeight 280, gap 6, minListHeight 112 (CHOSEN — four rows); row 28 and dot 16 (row = dot + 6 above and below).
 *  ANCHORED, THE PANEL FITS THE ROOM BELOW ITS ANCHOR: the list shrinks from `maxListHeight` down to
 *  `minListHeight` so the finder never runs off the bottom of a short window (and re-measures on
 *  resize). Below the floor it clips rather than vanishes. The host does nothing for this. */
export const STOP_FINDER_METRICS: { width: number; asideWidth: number; maxListHeight: number; minListHeight: number; gap: number; row: number; dot: number }

/** the finder's matching rule — indices in walk order; empty query keeps every stop */
export function filterStops(steps: StopFinderStep[], query: string): number[]
