import type { ReactNode } from 'react'

export interface PresenterStripStep {
  title: string
  /** shown before the title, with a drawn › separator, when present */
  territory?: string
  /** colours the small dot in front of the title, e.g. `'cobalt'` — `--hue-<hue>-ink` */
  hue?: string
}

/**
 * The presenter strip: a breadcrumb row over a rail that grows into a row of named stops — part 3
 * of the presenter-mode split (`guidelines/presenter-component-split-plan.md`). Built apart from
 * `PresenterHeaderBar` and `FilmRoll` because the plan flags it as the piece most likely to change.
 * (Named `RoamingDock` until 2026-09-02; roaming is one of its states, not what it is for.)
 *
 * WHAT THE COLUMN AROUND IT MUST DO — a port can get every prop right and still overlap the pane
 * under it:
 *
 *   1. THE STRIP IS IN FLOW, NEVER AN OVERLAY. Mount it as a `flex: none` child of a flex COLUMN
 *      (it sets `flex: none` on itself), and give every pane below it `flex: 1; min-height: 0`.
 *      Opening the strip then shrinks the notes pane; nothing is drawn over anything. Do not
 *      `position: absolute` it over the panes — that is the overlap the owner asked about.
 *   2. A HOST THAT LAYS OUT ARITHMETICALLY reads `presenterStripHeight({ open, roaming })` — the
 *      four heights are `PRESENTER_STRIP_METRICS.closed` 64 / `.closedRoaming` 81 / `.open` 107 /
 *      `.openRoaming` 130, each a SUM of the strip's parts in the source. Never retype them.
 *   3. THE HEIGHT CHANGES ON EXACTLY TWO EVENTS, both the host's own state before the strip draws:
 *      `onOpenChange` (or the controlled `open`), and `roamingStop` going null ↔ a number. There
 *      is no third — a hover, a hold or a re-centre never changes the height.
 *
 * ROAMING AND ACTIVE ARE TWO DIFFERENT FACTS. `activeStop` is the lecture's committed record —
 * what the pill counts, what the fill reaches, where ←/→ resume. `roamingStop` is provisional: the
 * breadcrumb follows it and the row centres on it, and nothing about the record has changed. Only
 * the HOLD GESTURE (`onMakeActive`, fired from the ring) promotes a roamed stop.
 *
 * COVERED IS A THIRD FACT AND IT IS THE HOST'S. Pass `covered` and a stop draws done only if the
 * host says it was presented — so holding stop 43 active from 20 does not paint 21–42 as walked.
 * Omit it and every stop before the active node counts (the v18 drawing). THE FILL IS PER SEGMENT:
 * the line between two stops is orange only when both are covered (or one is covered and the next is
 * the active node), so a skipped stretch is a GAP in the fill, never orange under grey ticks. The
 * pill always counts the ACTIVE NODE'S POSITION, not the covered stops.
 *
 * THE HOLD RING IS ITS OWN MARK, not a `StepDot` state — `StepDot` knows `done`/`current`/`ahead`
 * only, on purpose. Closed rail: a bare 13px ring, "ROAMING" above it, "(hold to make active)"
 * below. Open row: an 18px ring carrying the stop number, the same two strings around it. Holding
 * fills it inward rim to centre; releasing early eases it back to empty.
 *
 * THE OPEN ROW IS A WINDOW, NOT A SPOTLIGHT. Opening keeps the shown stop at the horizontal fraction
 * the closed rail had it (no leap to the middle, and the first paint is already in place — nothing
 * slides on open). After that it re-centres only when the shown stop reaches its edge, sliding on
 * `--dur-move`. The window never shows dead space: its centre is clamped so stop 1 and the last stop
 * sit at its edges, and a walk that fits whole is spread across the row. Clicking a neighbour moves
 * one dot.
 *
 * THE OPEN ROW SPANS THE ROW, AND `pitch` IS A FLOOR (2026-09-21, owner: opening the strip left
 * "the same walk stops squashed a lot more compared to [the closed rail] where it spans the entire
 * pane"). A PORT MUST NOT STEP A CONSTANT PITCH FROM THE CENTRE — that is what this replaces, and
 * it is the natural way to write the row. `pitch` answers ONE question: how many stops can a row
 * this wide label without crowding them. The row then spreads exactly that many across the width
 * it has, so the drawn spacing is always >= `pitch` and the open row reaches the same edges the
 * closed rail does. Two consequences a port must keep: a window clamped at either end of a long
 * walk still fills the row, and a short walk in a wide pane is spread rather than huddled in the
 * middle. The ends are inset separately — half a label (36) where the end stop is labelled, half a
 * dot (9) where it is an unlabelled peek — because reserving a peek slot at an end that has no
 * peek IS the dead space the paragraph above forbids.
 *
 * THE LINE ENDS AT THE LAST STOP on both rails — a line running to the border says the walk goes on.
 * A FLAG IS A CLICK TARGET: it fires `onRoamTo` for its stop, the same act as clicking the tick.
 *
 * THE TICKS ARE `walkBand`'S, with `PRESENTER_STRIP_METRICS.band` (floor 0.22) over the shipped
 * defaults — the same 5-behind / 2-ahead band the map's dock draws, floored higher because on a
 * paper strip a 0.05 tick vanishes. The rail is inset `railInset` (9) at both ends so the knob at
 * stop 1 or the last stop never clips the border; every mark on the rail reads that one mapping.
 *
 * WHAT IT REPORTS, AND WHAT IT DOES NOT OWN. `activeStop` and `roamingStop` are INPUTS: the host
 * holds both and hands the same two numbers to `PresenterHeaderBar`, the film roll, the notes pane.
 * The strip never stores them, so there is nothing to "read back" — it asks for changes through
 * `onRoamTo`, `onMakeActive`, `onJumpToActive`, and reports what only it knows: `onStepHover`
 * (the hovered stop), `onOpenChange` (its height is about to change), `onMetricChange` (the pill's
 * face). A host that wants another pane to light the hovered stop listens to `onStepHover`.
 *
 * THE FIND BUTTON IS A TOGGLE. Closed finder: it fires `onFind(rect)` with its own bounding rect —
 * open `StopFinder` (part 8) anchored there. With `finderOpen` true it draws pressed and fires
 * `onFind(null)` — close it. The host owns the finder's `open`; leave `onFind` unset and the button
 * hides.
 *
 * THE RECORD CAN BE CARRIED, and the old invariant is RESTATED rather than broken (owner,
 * 2026-09-04: "in addition to clicking to roam, can we also have action that they drag the active
 * node to another place, then it moves the active node directly to that place… both expanded and
 * contracted"). The rule used to read "one gesture commits: the hold on the roaming ring". The rule
 * BEHIND it is what matters and now says so: **the record moves only by a gesture that starts on
 * the record.** A hold on the roaming ring qualifies, and so does a drag of the active node's own
 * mark — the closed rail's knob, the open row's current dot. A click on a tick, a dot, a flag or a
 * finder row still only ROAMS, so you cannot move the lecture's position by brushing the rail.
 *
 * Both drags commit through `onMakeActive(index)` — the same callback, because it is the same act.
 * While carrying, the record is drawn AT THE STOP IT WILL LAND ON rather than following the raw
 * pointer, so the gesture shows its result; the drop's own click is swallowed, or the tick under
 * the pointer would roam on top of the record that just landed.
 *
 * THE ROW ANSWERS THE POINTER AS A WHOLE, IN BOTH MODES, and the hovered stop answers louder
 * (owner, 2026-09-04: "not only the node in expanded mode should expand, the lines and all the
 * other nodes should as well… and u didnt do it for the contracted mode"). Two facts, two numbers:
 * the row says "you are on me" (`WALK_ROW_HOVER_GROW`, 1.08), the stop under the pointer says "and
 * this one" (`WALK_HOVER_GROW`, 1.18) — one factor cannot carry both, since growing everything
 * equally leaves the hovered stop unmarked.
 *
 * EVERY MARK ON THE ROW GROWS, INCLUDING THE ACTIVE NODE'S KNOB. The reference the owner gave is a
 * YouTube progress bar, and it is the right one: there the track, the played part and the knob
 * change size AS ONE OBJECT. So the ticks, the line, the fill, the flags, the roaming ring and the
 * knob all answer together in the closed rail; the dots, their flags and the line do in the open
 * row. Nothing is exempt except TYPE — labels and the pill keep their size, because scaled text
 * reads as a zoom rather than as a surface lifting.
 *
 * IT GROWS THE MARKS, NEVER THE ROW'S BOX: a full-width strip scaled 8% spills ~40px through the
 * pane's rounded border, and a `flex: none` row would lift over the pane below it. Positions stay,
 * so nothing can clip.
 *
 * AND THE FORM DIFFERS BY MODE, because a factor is meaningless on a hairline — measured, which is
 * how the contracted mode turned out to be the half that "did not happen": the closed rail's tick
 * is 2×6 and its line 2px, where 8% is 0.48px and 0.16px. So the CLOSED rail steps in whole pixels
 * (`PRESENTER_STRIP_METRICS.tickGrow` — `row` 2, `hover` 4 — and `lineGrow` 1, the line growing
 * about its own centre), while the OPEN row keeps the two SCALES on its 18px dots, where they are
 * 1.4 and 3.2px and a factor is the right form for a mark whose size already varies by recency.
 *
 * THE WALK LINE'S FILL IS BOUNDED BY THE BOX, NOT BY THE DOT WINDOW (owner, 2026-09-04: "on the
 * left most line its grey when its walked"). The line is drawn edge to edge; the dots are a window
 * of ±half around centre. For a week the fill looped the DOT window, so a segment with both ends
 * outside it was skipped even where it crossed the visible line — a fully walked walk began with a
 * grey stub whenever the first visible tick sat further from the edge than one pitch (measured: 8px
 * on a 60-stop walk at 900px). `PresenterStripMath.fillBounds` is the arithmetic, published so a
 * card can ask it the question rather than restate it. **Its signature changed on 2026-09-21** with
 * the spread row: it takes the outermost drawn SLOTS (peeks included) and the stop count, and
 * returns one segment past each — there is no pitch-and-centre sum left to get wrong.
 *
 * A DRAG ACROSS THE STRIP SELECTS NOTHING (owner, 2026-09-04). The crumbs, the pill and the stop
 * numerals all label controls, and this row is worked with the pointer — hold to make active,
 * click a tick to roam. A drag that leaves half-selected breadcrumbs behind it reports the wrong
 * gesture. Refused on the row, because every part of it is furniture.
 */
export interface PresenterStripProps {
  steps: PresenterStripStep[]
  /** the lecture's committed record, 0 … steps.length − 1 */
  activeStop: number
  /** the stop being shown while roaming, or `null`/`undefined` when not roaming */
  roamingStop?: number | null
  /** flagged stop indices — a small flag above that stop's tick/dot on either rail. Clicking a flag
   *  fires `onRoamTo(index)`, like the tick under it. */
  flags?: number[]
  /** indices the host has actually presented. Given, a stop is `done` only if listed; omitted,
   *  every index below `activeStop` is `done`. Skipped stops (roamed past, held active from afar)
   *  are the reason this exists. */
  covered?: number[]
  /** the find button (magnifying glass, row 1's left end). Omit to hide it. Fires with the button's
   *  `getBoundingClientRect()` to open — pass it to `StopFinder` as `anchor` — or `null` to close,
   *  when `finderOpen` is true. */
  onFind?: (anchor: DOMRect | null) => void
  /** the finder is showing — the button draws pressed and its next click closes. Default `false` */
  finderOpen?: boolean
  /** "back to active node" (row 1, while roaming) and the open row's edge marker both fire this */
  onJumpToActive?: () => void
  /** a stop was clicked — a closed-rail tick or an open-row dot. The HOST decides what it means
   *  (typically: start roaming there). Omit for a read-only rail; the hold ring stays live. */
  onRoamTo?: (index: number) => void
  /** the hold completed on `roamingStop`'s ring — the host sets `activeStop`, typically clears
   *  `roamingStop`, and records the stop in `covered` if it keeps one. Omitted, the ring is inert. */
  onMakeActive?: (index: number) => void
  /** ms to hold before `onMakeActive` fires. Default 600 — still an open call per the plan.
   *  THE HOLD'S CLOCK IS AN INTERVAL READING `performance.now()`, NEVER A FRAME COUNT, and a port
   *  must keep it that way (2026-09-06; `receipts/5db0dea.md`, OB-165). A window that is not in
   *  front gets no animation frames, and starting a lecture focuses the projector window — so a
   *  rAF-driven hold begun while the professor looks at the projector never advances at all, and
   *  the one gesture that COMMITS the record is dead with nothing on screen to say so. A throttled
   *  interval still fires, and a monotonic read lands on the true progress rather than resuming
   *  where it stopped. The fill is a hair less smooth than vsync in exchange; that is the trade. */
  holdMs?: number
  /** controlled open state (rail vs. named row). Omit to let the strip own it via `defaultOpen`. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** the hover preview's content, shown through `WalkPreview` above a hovered tick or dot — the
   *  same card the walk strip, the map dock and a map pin show. Omitted, a native `title` carries
   *  the stop's name instead (never both: two tooltips for one pointer rest). */
  renderPreview?: (step: PresenterStripStep, index: number) => ReactNode
  /** the hovered stop, `null` on leave — for a host that lights the same stop elsewhere */
  onStepHover?: (index: number | null) => void
  /** the pill's face — the stop number ("10 / 22") or the walk as a percentage. Clicking the pill
   *  toggles it; controlled via `metric`, or the strip owns it from `defaultMetric`. Both count the
   *  ACTIVE node. The same pair `WalkDock` carries. */
  metric?: 'position' | 'percent'
  defaultMetric?: 'position' | 'percent'
  onMetricChange?: (metric: 'position' | 'percent') => void
}
export function PresenterStrip(props: PresenterStripProps): JSX.Element

/** The strip's numbers. The four heights are SUMS of its parts (see the source); `pitch` 68,
 *  `band.floor` 0.22 and `railInset` 9 are CHOSEN on the v18 render. **`pitch` is a FLOOR, not the
 *  open row's spacing** — it decides how many stops a row can label, and the row spreads that many
 *  across its width, so the drawn pitch is >= 68 and grows with the pane. `peekOpacity` 0.4
 *  (CHOSEN) is
 *  the opacity of the one unlabelled stop drawn past each end of the open window — the sign that
 *  the walk continues; a walk that fits whole draws none. */
export const PRESENTER_STRIP_METRICS: {
  closed: number; closedRoaming: number; open: number; openRoaming: number
  pitch: number; stopDot: number; ring: number; ringOpen: number; knob: number; peekOpacity: number
  railInset: number; railSpan: number; tick: { w: number; h: number }; line: number
  band: { floor: number }
}
/** The strip's height for a state — one of the four numbers above. */
export function presenterStripHeight(state?: { open?: boolean; roaming?: boolean }): number
/** The same function under a capitalised name, for a card or rig reading the namespace — plus the
 *  open row's fill bound, published for the same reason (a card asks it; nobody retypes it).
 *  `fillBounds(slotLo, slotHi, count)` takes the outermost slots the row draws, peeks included,
 *  and returns `[first, last)` over segment indices: one segment past each end, which is every
 *  segment that can still cross the box. (It was declared on the type only from 2026-09-21; it has
 *  been on the object since 2026-09-04, with a pitch-and-centre signature this replaces.) */
export const PresenterStripMath: {
  height: typeof presenterStripHeight
  fillBounds(slotLo: number, slotHi: number, count: number): [number, number]
}

/** THE TWO ROWS, PUBLISHED SO THEY CAN BE READ — the same `ClosedRail` and `OpenRow` function
 *  objects this component renders. Every rule that lives in a row (the carry gesture, the hover
 *  growth, the walk line's fill bound) is invisible through `String(NS.PresenterStrip)`, so a
 *  specimen card cannot guard it otherwise. READ THEM, DO NOT RENDER THEM — the supported surface
 *  is `PresenterStrip`, and both take undocumented internal props that will change without
 *  notice. Same pattern as `QUICK_ACTION_PARTS` and `LECTURE_NOTES_PARTS`. */
export const PRESENTER_STRIP_PARTS: { ClosedRail: unknown; OpenRow: unknown }
