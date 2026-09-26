import { Fragment } from 'react'
import type { CSSProperties } from 'react'

import { topicPaint } from '../graph/DomainDot'

/** THE ROW'S OWN HEIGHT, and it is the whole reason this is a component rather than three
 *  lines of markup in each pane. A preview banner appears and leaves under a cursor that is
 *  somewhere else entirely — in another pane, on the map — so if the row only existed while
 *  previewing, everything below it would jump up and down as a pointer swept across a map.
 *  The slot is therefore ALWAYS drawn and always this tall; only its contents come and go.
 *  16 is CHOSEN: the chip's own 14 (`--fs-micro` at `--lh-snug` plus 1px of padding each
 *  side) with a pixel above and below so its wash does not touch what is over or under it.
 *  `chipRadius` (3) is the chip's own corner, smaller than `--radius-xs` because the chip is
 *  14px tall and a larger radius reads as a pill. */
export const PREVIEW_BANNER_METRICS = { height: 16, chipRadius: 3 } as const

/** the previewed node, as little of it as this row needs */
export interface PreviewBannerNode {
  /** published as `data-preview-banner` so a driver can locate the row by what it reports */
  id?: string
  /** the node's name, set in its own topic ink */
  title: string
  /** the node's own topic, resolved through `topicPaint` for the name's ink. A DATA field, not
   *  a closed union: pass whatever the corpus calls the topic, or leave it out for the anchor
   *  fallback */
  domain?: string
}

/**
 * WHAT THIS PANE IS SHOWING IS NOT WHERE YOU STAND — one row, at the top of a pane whose
 * reading has been taken over by somebody else's cursor.
 *
 * The system's hover rule is that hover previews the state a click would set ("Hover lights the
 * OBJECT"). A pane that answers a FOREIGN hover obeys that rule and breaks a second one at the
 * same time: the reading on screen is no longer the reading the session is at, and nothing in
 * the pane says so. This row says so, in the words that name the gesture that ends it — "click
 * to select it".
 *
 * POND, BECAUSE A PREVIEW IS CROSS-PANE CORRESPONDENCE. `--state-selected-wash` and `--pond-600`
 * are the ramp the system reserves for "selection and cross-pane correspondence only". The
 * NODE'S OWN TOPIC COLOUR carries the name inside the sentence, so the reader can match it to the
 * cell they are pointing at without reading the word.
 *
 * WHAT THE PANE AROUND IT MUST DO:
 *   1. MOUNT IT UNCONDITIONALLY, `node={null}` when nothing is previewed. It reserves its own
 *      height precisely so a preview arriving or leaving never reflows the pane under a cursor
 *      that is somewhere else. `{previewing && <PreviewBanner/>}` throws that away.
 *   2. DECIDE `node` FROM A FOREIGN HOVER ONLY, and only while nothing is selected — a pane must
 *      not re-aim itself at its own cursor, and a selection pins the pane.
 *   3. HAVE SOMEWHERE TO GO BACK TO when the cursor leaves.
 *   4. The click this row promises is the pane's, not this component's: it renders no button.
 *
 * Typed port of the DS components/chrome/PreviewBanner.jsx (OB-209 clause 1; #342).
 */
export interface PreviewBannerProps {
  /** the previewed node, or `null` for the resting state — an empty row of the same height */
  node?: PreviewBannerNode | null
  /** what ends the preview, after the em dash. Default "click to select it". Pass `''` to
   *  drop the clause when the gesture is not a click */
  action?: string
  /** the relation between the cursor and the node. Default "hovering" */
  verb?: string
  /** the chip's word, upper-cased by the component. Default "preview" */
  label?: string
  /** merged last into the row */
  style?: CSSProperties
}

export function PreviewBanner({ node, action = 'click to select it', verb = 'hovering', label = 'preview', style }: PreviewBannerProps) {
  const M = PREVIEW_BANNER_METRICS
  const paint = topicPaint(node && node.domain)
  /* ★ LOCAL: THE HOOK IS ON THE RESTING ROW TOO, empty-valued. The DS drops the attribute when
     `node` is null, while OB-209's own done-when asserts `[data-preview-banner]` EXISTS while
     nothing is hovered — the check that proves rule 1 (mounted unconditionally) is being kept.
     The value is still what the row reports: the previewed id, or '' at rest. */
  return (
    <div data-preview-banner={node ? node.id || '' : ''} aria-live="polite" style={{
      flex: 'none', boxSizing: 'border-box', height: M.height, display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', lineHeight: 'var(--lh-snug)',
      color: 'var(--text-3)', userSelect: 'none', WebkitUserSelect: 'none', overflow: 'hidden', ...style,
    }}>
      {node ? (
        <Fragment>
          {/* THE CHIP IS THE STATE, THE SENTENCE IS THE SUBJECT. Upper case and tracked, which
              is this system's own way of saying "a label about the interface, not a word from
              the corpus" — the same register as a pane legend, one rung smaller. */}
          <span style={{
            flex: 'none', padding: '1px 5px', borderRadius: M.chipRadius, background: 'var(--state-selected-wash)',
            color: 'var(--pond-600)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{label}</span>
          {/* ONE LINE, TRUNCATED, NEVER WRAPPED: a wrapped second line is the reflow the fixed
              height exists to prevent, and a long node title is ordinary. */}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {verb} <b style={{ fontWeight: 'var(--fw-semibold)', color: paint.ink }}>{node.title}</b>{action ? ' — ' + action : null}
          </span>
        </Fragment>
      ) : null}
    </div>
  )
}
