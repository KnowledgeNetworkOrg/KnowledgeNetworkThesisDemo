import type { CSSProperties, ReactNode } from 'react'

/** THE PLACEHOLDER'S OWN NUMBERS. `minHeight` keeps a placeholder from collapsing to two lines
 *  of text in a tall column — it is a VACANCY, and a vacancy that does not look like a shape
 *  reads as a rendering failure. CHOSEN; a column shorter than this gets the placeholder
 *  centred in whatever room there is. `maxTextWidth` (34ch) is the second line's measure. */
export const PANE_PLACEHOLDER_METRICS = { minHeight: 120, maxTextWidth: 34 } as const

/**
 * A PANE, OR A COLUMN IN ONE, WITH NO SUBJECT — and the gesture that gives it one.
 *
 * DASHED MEANS CONDITIONAL, everywhere in this system: `--border-dashed` at `--radius-md` is
 * what an empty version's drop zone draws, and a pane nobody has pointed at yet is the same
 * kind of absence — a shape waiting for content, not an error and not a message.
 *
 * TWO LINES, IN THIS ORDER: the STATE, then the SECOND LINE — `gesture` when there is a way out
 * of the absence, `note` when there is not. "Nothing chosen" answers what the reader is looking
 * at; "point at a cell on the map" answers what to do about it. A placeholder with only the
 * first is a dead end, and one with only the second is an instruction with no diagnosis.
 *
 * IT ALSO DRAWS A NODE THAT HAS NO ANSWER, not only a pane that has no subject — owner's ruling,
 * 2026-09-22, chosen at 1:1 off three built candidates over the two that kept the states apart.
 * THE SHAPE THEREFORE NO LONGER SEPARATES THOSE TWO STATES AND THE WORDS ARE ALL THAT DO: the
 * state line names WHOSE absence it is — "Nothing chosen" is the pane's, "No relationships" is
 * the node's — and a factual second line is passed as `note`, never as `gesture`, because there
 * is nothing to do about a course that publishes no prerequisites.
 *
 * WHAT THE PANE AROUND IT MUST GET RIGHT:
 *   1. SAY WHOSE ABSENCE IT IS, IN THE STATE LINE. A line naming neither ("Nothing to show")
 *      leaves a reader unable to tell a corpus with no answer from an app waiting for input.
 *   2. BOTH LINES, IN ORDER, AND THE SECOND ONE UNDER THE RIGHT NAME (`gesture` / `note`).
 *   3. IT REPLACES THE COLUMN'S CONTENT, NOT THE PANE. Things that are true with nothing chosen
 *      stay on screen.
 *   4. THE ROW ABOVE IT KEEPS ITS HEIGHT. A head, a breadcrumb or a banner that disappears when
 *      the subject does moves everything under it.
 *
 * `data-pane-placeholder` is the component's own hook — a driver finds the vacancy by it.
 *
 * Typed port of the DS components/chrome/PanePlaceholder.jsx (OB-209 clause 5, with clause 5b's
 * `note`; #342).
 */
export interface PanePlaceholderProps {
  /** the absence, in the reader's words — "Nothing chosen". `--fs-body`, semibold, `--text-2` */
  state: ReactNode
  /** how to leave it — "Point at a cell on the map to read its document". `--fs-caption`,
   *  `--text-3`, capped at `PANE_PLACEHOLDER_METRICS.maxTextWidth` ch so it wraps like prose.
   *  Only for an absence that CAN be left */
  gesture?: ReactNode
  /** the second line for an absence with NO way out — "Nothing connects to this node". Same
   *  typography as `gesture`; what differs is whether the sentence asks anything of the reader.
   *  `gesture` wins if both are given */
  note?: ReactNode
  /** default `PANE_PLACEHOLDER_METRICS.minHeight` (120). Pass a smaller number for a short
   *  column; pass `0` to let it be exactly as tall as its two lines */
  minHeight?: number
  /** merged last into the dashed box */
  style?: CSSProperties
}

export function PanePlaceholder({ state, gesture, note, minHeight = PANE_PLACEHOLDER_METRICS.minHeight, style }: PanePlaceholderProps) {
  const M = PANE_PLACEHOLDER_METRICS
  return (
    <div data-pane-placeholder="1" style={{
      boxSizing: 'border-box', minHeight, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: '18px 16px',
      border: '1px dashed var(--border-dashed)', borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-ui)', lineHeight: 'var(--lh-normal)', ...style,
    }}>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)' }}>{state}</div>
      {/* ONE SECOND LINE, EITHER KIND, AND THEY ARE THE SAME TYPOGRAPHY ON PURPOSE: what differs
          is whether the sentence asks anything of the reader, and that is carried by the words.
          `gesture` wins if a caller passes both — a state with a way out should always offer it. */}
      {gesture || note ? <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', maxWidth: M.maxTextWidth + 'ch' }}>{gesture || note}</div> : null}
    </div>
  )
}
