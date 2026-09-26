import type { CSSProperties } from 'react'

/**
 *  THE DRAG VERDICT — the two marks a road draws while a node is being dragged over it, and
 *  the one function that paints them.
 *
 *  THE DESIGN IS ASYMMETRICAL AND THAT IS THE POINT (owner, 2026-09-18). A valid drop says
 *  where it lands and NOTHING ELSE — no pill, no words, no step number, because releasing
 *  simply performs the operation and there is nothing to report. A refusal has one short
 *  sentence. So green is spent entirely on the line and red carries the only message in the
 *  system's drag vocabulary.
 *
 *  WHAT THIS BUYS, beyond being quieter: with no green pill there is no glyph pair to balance,
 *  no number cell, and nothing for a colour-blind reader to confuse — the difference a reader
 *  reads first is MESSAGE PRESENT OR ABSENT, and the hue confirms it rather than carrying it.
 *  A drag stays legible with the hue removed altogether (solid line vs struck line, silence vs
 *  a sentence, `grabbing` vs `no-drop`).
 *
 *  THE HELD NODE STAYS NEUTRAL, and this is a rule, not an omission. `NodeChip` states its
 *  channel inventory twice in its own source — "the border STYLE is `optional`; the OUTLINE is
 *  `selected`; the RING is `lit`" — and `tokens/elevation.css` defines `--ring-selected` as
 *  `0 0 0 2px`, which is a verdict ring's exact geometry, differing only in hue. A dragged chip
 *  can be `lit` at the same moment (cross-pane correspondence does not pause for a drag) and
 *  that file's rule is "one ring per meaning, never stacked". Since the line and the pill both
 *  already carry the verdict, a ring would be a third telling of the same thing, paid for out
 *  of a channel that has a job. Do not add one.
 *
 *  WHAT A HOST MUST DO, because none of it can live here (the DS's .d.ts, verbatim in substance):
 *   1. OWN THE PREDICATE — through `neighboursOf` below, never a retyped copy of it.
 *   2. REFUSE THE GESTURE, not just mark it. A refused gap must not accept the drop, and
 *      NOTHING is reported on release — nothing happened, so there is nothing to say.
 *   3. SET THE CURSOR — `grabbing` over a gap that accepts, `no-drop` over one that does not.
 *   4. NEVER COLOUR THE HELD NODE.
 *
 *  Typed port of the DS components/graph/DropVerdict.jsx (contract: DropVerdict.d.ts), OB-219.
 *  The DS names the file `DropVerdict.ts`; it draws, so it lands as `.tsx`.
 */

/** THE PAIR, as one object per verdict. A caller picks a VERDICT, never a hue — the same shape
 *  `topicPaint()` and `relationPaint()` established for data colour.
 *
 *  `wash`, `hair` and `ink` are UNDEFINED on the yes verdict, deliberately: there is no green
 *  pill to draw, so there is nothing for them to paint. A caller reaching for
 *  `verdictPaint(true).ink` has found the rule rather than a gap — and `tokens/colors.css`
 *  carries no `--verdict-yes-wash` for the same reason. */
export function verdictPaint(ok: boolean): { line: string; wash?: string; hair?: string; ink?: string } {
  return ok
    ? { line: 'var(--verdict-yes)' }
    : { line: 'var(--verdict-no)', wash: 'var(--verdict-no-wash)', hair: 'var(--verdict-no-hair)', ink: 'var(--verdict-no-ink)' }
}

/** every number these two marks spend, and whether it was CHOSEN or DERIVED — so the next
 *  reader does not re-derive one that was a look.
 *
 *  `stroke` 2 is CHOSEN: `NodeArrow`'s shaft is 1.5, and a landing line has to read as heavier
 *  than the scaffolding it is replacing without becoming a bar. The arithmetic forces nothing.
 *  `dropGap` 4 is CHOSEN, and it was 8 for one session. The pill has to read as belonging to the
 *  node ABOVE it rather than to whatever the road has below it, and at 8 the owner read it as
 *  detached — a label floating between two nodes belongs to neither. 4 still clears the ghost's
 *  own `--lift-3`, which is the floor the number cannot go under.
 *  `glyphPx` 11 is CHOSEN: the ⊘ reads at the pill's `--fs-micro` without out-weighing the words. */
export const VERDICT_METRICS = { stroke: 2, dropGap: 4, glyphPx: 11 }

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
  /** merged last onto the line itself — for a host's placement, never for its paint */
  style?: CSSProperties
}

/**
 * THE LANDING LINE — solid where the node will land, struck where it will not.
 *
 * Drawn INSTEAD of the gap's `NodeArrow` for the duration of a drag, at the arrow's own width,
 * so the column does not reflow when the drag starts. `direction` matches `NodeChain`'s.
 */
export function DropLine({ ok, width, direction = 'down', style }: DropLineProps) {
  const p = verdictPaint(ok)
  const down = direction !== 'right'
  const bar: CSSProperties = down
    ? { width: width == null ? '100%' : width, height: ok ? VERDICT_METRICS.stroke : 0 }
    : { height: width == null ? '100%' : width, width: ok ? VERDICT_METRICS.stroke : 0 }
  /* STRUCK, NOT ABSENT. A gap with nothing in it says "this drag is broken"; a dashed line
     in the refusal's own colour says "not here", which is a different sentence. The .jsx
     writes this as one computed key; spelled as two literals here so it types as a style. */
  const struck = ok ? undefined : VERDICT_METRICS.stroke + 'px dashed ' + p.line
  const edge: CSSProperties = down ? { borderTop: struck } : { borderLeft: struck }
  return (
    <span aria-hidden="true" style={{
      display: 'block', flex: 'none', borderRadius: 1,
      background: ok ? p.line : 'transparent',
      ...edge, ...bar, ...style,
    }} />
  )
}

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
   *  enough to need two lines is a sentence that belongs somewhere else */
  reason?: string
  /** merged last onto the pill — for a host's placement, never for its paint */
  style?: CSSProperties
}

/**
 * THE REFUSAL — one short sentence, under the node being held, in berry.
 *
 * THERE IS NO VALID FORM OF THIS COMPONENT, and the name says so. It takes no `ok`: it cannot
 * be handed a verdict, so it can never be used to reintroduce the green pill this design
 * deliberately does not have. The rule is enforced by the API rather than written in a doc
 * nobody opens.
 *
 * THE SENTENCE MUST BE SIDE-FREE. The same refusal happens whether a node was dragged above
 * its twin or below it, so a sentence naming a side ("already the step above") is wrong half
 * the time — and a component that had to know WHICH neighbour it was refusing would need
 * knowledge it is never given. `already adjacent` is the shipped wording (owner, 2026-09-18):
 * it describes the RELATIONSHIP rather than the node, so it cannot be misread as "this node is
 * a copy" — a live risk in a corpus where nodes really can be duplicated and versioned.
 *
 * WHERE THE HOST PUTS IT: centred under the dragged node, `VERDICT_METRICS.dropGap` below it,
 * travelling with the drag — not in the column, and not in a corner of the screen. It leaves
 * when the drag does.
 *
 * ONE LINE, NEVER WRAPPING. It is read in motion, under a moving pointer.
 */
export function DropRefusal({ reason = 'already adjacent', style }: DropRefusalProps) {
  const p = verdictPaint(false)
  return (
    <span role="status" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: p.wash, border: '1px solid ' + p.line, borderRadius: 'var(--radius-sm)',
      padding: '3px 8px', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)',
      lineHeight: 'var(--lh-snug)', color: p.ink, whiteSpace: 'nowrap',
      boxShadow: 'var(--lift-1)', userSelect: 'none', WebkitUserSelect: 'none', ...style,
    }}>
      <span aria-hidden="true" style={{ fontSize: VERDICT_METRICS.glyphPx, lineHeight: VERDICT_METRICS.glyphPx + 'px' }}>⊘</span>
      {reason}
    </span>
  )
}

/** THE RULE ITSELF, published so no host retypes it — given the members of one chain IN ORDER,
 *  the index of every member that repeats the one before it.
 *
 *  IDS, WITH GAPS: a member with no id passes `null`. That single convention carries both
 *  exceptions the rule has, with no special case for either — an unresolved `NodePicker` has
 *  nothing chosen yet, and a nested node or versioned group is deliberately NOT compared (two
 *  nested members may sit together even though they may walk the same nodes; comparing their
 *  contents was ruled too complicated to be worth it, owner 2026-09-18). A `null` is never equal
 *  to anything, including another `null`.
 *
 *  ADJACENT ONLY. The same node twice in one walk is legitimate — a walk may return to a node
 *  later. It is the step that does not MOVE that is refused. Do not extend this to a whole-walk
 *  uniqueness check. */
export function adjacentDuplicates(ids: (string | null)[]): number[] {
  const out: number[] = []
  for (let i = 1; i < (ids || []).length; i++) {
    const a = ids[i - 1], b = ids[i]
    if (a != null && b != null && a === b) out.push(i)
  }
  return out
}

/** WHICH IDS A SLOT MAY NOT TAKE — the ids of whatever sits either side of it, `null`s dropped.
 *  For a picker filling slot `at`, these are the options to disable; for a drag landing in the
 *  gap before slot `at`, the same answer decides the verdict.
 *
 *  `at` is a POSITION BETWEEN OR ON members, the same convention `NodeChain.onReorder` uses, and
 *  the edges are where a hand-written version goes wrong: slot 0 has one neighbour, slot n has
 *  one neighbour, and a neighbour with no id contributes nothing rather than blocking everything.
 *  Both surfaces of the rule read this, so the picker and the drag can never disagree. */
export function neighboursOf(ids: (string | null)[], at: number): string[] {
  const list = ids || []
  return [list[at - 1], list[at]].filter((x): x is string => x != null)
}

/** THE CAPITALISED WAY IN. Only capitalised exports reach `window.<Namespace>`, so the helpers
 *  and the metrics are published here as well as on their own names — a card, a contract or a
 *  port that reads `verdictPaint` off the namespace would find nothing there. Same function
 *  objects, not copies. */
export const DropVerdict = { paint: verdictPaint, METRICS: VERDICT_METRICS, adjacentDuplicates, neighboursOf }
