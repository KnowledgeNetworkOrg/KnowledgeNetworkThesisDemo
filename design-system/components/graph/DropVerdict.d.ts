/**
 * THE DRAG VERDICT — the two marks a road draws while a node is dragged over it.
 *
 * WHAT A HOST MUST DO, because none of it can live here:
 *  1. OWN THE PREDICATE. This file draws a verdict; it never computes one. Whether a drop is
 *     allowed is a fact about the host's own array.
 *  2. REFUSE THE GESTURE, not just mark it. A refused gap must not accept the drop: the node
 *     returns where it came from and NOTHING is reported on release — nothing happened, so
 *     there is nothing to say. A toast on a refused drop is the design this replaced.
 *  3. SET THE CURSOR. `grabbing` over a gap that accepts, `no-drop` over one that does not.
 *     A cursor is on the element the pointer is over, which is the host's drag surface.
 *  4. NEVER COLOUR THE HELD NODE. See the note in `DropVerdict.jsx`: a 2px verdict ring is
 *     `--ring-selected`'s exact geometry and collides with `lit`, which a dragged chip can be.
 *
 * THE ASYMMETRY IS THE DESIGN (owner, 2026-09-18): a valid drop is silent. There is no green
 * pill, no step number on a valid gap, and no component here that can draw one.
 */
export interface DropLineProps {
  /** the verdict. `true` draws a solid line in `--verdict-yes`, `false` a struck line in
   *  `--verdict-no`. STRUCK, NOT ABSENT: an empty gap reads as a broken drag, a dashed line in
   *  the refusal's colour reads as "not here" */
  ok: boolean
  /** the gap's own width (or height, running `right`). Omit for `100%`. Pass the arrow's width
   *  so the column does not reflow when the drag begins — this mark REPLACES the gap's
   *  `NodeArrow` for the duration, it does not sit beside it */
  width?: number | string
  /** matches `NodeChain`'s own prop. Default `'down'` */
  direction?: 'down' | 'right'
  style?: React.CSSProperties
}
export function DropLine(props: DropLineProps): JSX.Element
/**
 * THE REFUSAL PILL — one short sentence under the held node.
 *
 * IT TAKES NO VERDICT, AND THAT IS THE API ENFORCING A RULE. There is no valid form of this
 * component: it cannot be handed `ok`, so it can never be used to reintroduce the green pill
 * the design does not have. The name says the same thing to the next reader.
 *
 * WHERE THE HOST PUTS IT: centred under the dragged node, `VERDICT_METRICS.dropGap` below it,
 * travelling with the drag — not in the column, and not in a corner of the screen. During a
 * drag the eye is on the node in hand; a message anywhere else arrives after the gesture is
 * over. It leaves when the drag does.
 */
export interface DropRefusalProps {
  /** the sentence. **MUST BE SIDE-FREE** — the same refusal happens dragging a node above its
   *  twin or below it, so anything naming a side ("already the step above") is wrong half the
   *  time, and this component is never told which neighbour it is refusing.
   *
   *  Default and shipped wording: `'already adjacent'` (owner, 2026-09-18). It describes the
   *  RELATIONSHIP rather than the node, so it cannot be read as "this node is a copy" — a live
   *  misreading in a corpus where nodes genuinely can be duplicated and versioned. `'duplicate
   *  node'` was the owner's first wording and was changed for exactly that reason; do not
   *  reintroduce it as a default.
   *
   *  ONE LINE. It never wraps — it is read in motion under a moving pointer. A sentence long
   *  enough to need two lines is a sentence that belongs somewhere else.
   *
   *  PASS ONE OF `REFUSAL_REASONS`, never a retyped string: `adjacent` ('already adjacent') for
   *  the same node twice in a row, `inside` ('inside itself') for a group dropped into its own
   *  inside (owner, 2026-10-01) */
  reason?: string
  style?: React.CSSProperties
}
export function DropRefusal(props: DropRefusalProps): JSX.Element
/**
 * THE PAIR, one object per verdict — a caller picks a VERDICT, never a hue. Same shape as
 * `topicPaint()` and `relationPaint()`.
 *
 * `wash`, `hair` and `ink` ARE UNDEFINED ON THE YES VERDICT, deliberately: green never writes,
 * so it has nothing to paint them onto. Reaching for `verdictPaint(true).ink` has found the
 * rule, not a gap — and `tokens/colors.css` carries no `--verdict-yes-wash` for the same
 * reason. Do not add one "for symmetry"; a token for a green pill is an invitation to draw it.
 */
export function verdictPaint(ok: boolean): { line: string; wash?: string; hair?: string; ink?: string }
/**
 * Every number these marks spend, and whether it was CHOSEN or DERIVED.
 *
 *  - `stroke` 2 — **CHOSEN.** `NodeArrow`'s shaft is 1.5 and a landing line has to read as
 *    heavier than the scaffolding it replaces without becoming a bar. The arithmetic forces
 *    nothing; do not re-derive it from the shaft.
 *  - `dropGap` 4 — **CHOSEN, and it was 8 for one session.** The pill must read as belonging to
 *    the node ABOVE it rather than to whatever the road holds below it; at 8 it read as detached,
 *    and a label floating between two nodes belongs to neither. 4 still clears the ghost's own
 *    `--lift-3`, which is the floor this number cannot go under. Do not open it back up for
 *    breathing room — the closeness IS the statement of what the sentence is about.
 *  - `glyphPx` 11 — **CHOSEN.** The ⊘ reads at the pill's `--fs-micro` without out-weighing
 *    the words beside it.
 */
export const VERDICT_METRICS: { stroke: number; dropGap: number; glyphPx: number }
/**
 * THE RULE ITSELF, published so no host retypes it — given one chain's members IN ORDER, the
 * index of every member that repeats the one before it.
 *
 * **IDS, WITH GAPS.** A member with no id passes `null`, and that one convention carries both
 * exceptions with no special case for either:
 *  - an unresolved `NodePicker` has nothing chosen yet, so two pickers may sit together;
 *  - a nested node / versioned group is deliberately NOT compared. Two nested members may sit
 *    together even though they may walk the same nodes underneath — comparing their contents was
 *    ruled too complicated to be worth it (owner, 2026-09-18). Pass `null` for them.
 * A `null` is never equal to anything, including another `null`.
 *
 * **ADJACENT ONLY.** The same node twice in one walk is legitimate — a walk may return to a node
 * later, and that is authored meaning, not a mistake. What is refused is a step that does not
 * MOVE. Do not extend this to a whole-walk uniqueness check.
 */
export function adjacentDuplicates(ids: (string | null)[]): number[]
/**
 * WHICH IDS A SLOT MAY NOT TAKE — whatever sits either side of it, `null`s dropped.
 *
 * For a picker filling slot `at`, these are the options to mark `disabled`; for a drag landing in
 * the gap before slot `at`, the same answer decides the verdict. **Both surfaces of the rule read
 * this one function**, so the greyed row and the struck line can never disagree about what is
 * refused — which is the failure a hand-written copy on each side produces within a week.
 *
 * `at` is a POSITION BETWEEN OR ON members, the same convention `NodeChain.onReorder` uses. The
 * EDGES are where a retyped version goes wrong: slot 0 has one neighbour, slot n has one
 * neighbour, and a neighbour with no id contributes nothing rather than blocking everything.
 */
export function neighboursOf(ids: (string | null)[], at: number): string[]
/** the capitalised way in — `paint`, `METRICS`, `adjacentDuplicates` and `neighboursOf`, the same
 *  objects as the named exports above. Only capitalised exports reach `window.<Namespace>`, so
 *  none of the lower-case names is reachable there; read them off `DropVerdict` from a card, a
 *  contract or a port. */
/** the refusal sentences: `adjacent` 'already adjacent', `inside` 'inside itself'. Added 2026-10-01 */
export const REFUSAL_REASONS: { adjacent: string; inside: string }
export const DropVerdict: {
  paint: typeof verdictPaint
  METRICS: typeof VERDICT_METRICS
  REASONS: typeof REFUSAL_REASONS
  adjacentDuplicates: typeof adjacentDuplicates
  neighboursOf: typeof neighboursOf
}
