import type { CSSProperties } from 'react'

import { topicPaint } from '../graph/DomainDot'

/** THE ROW'S OWN HEIGHT, and it is the whole reason this is a component rather than three lines
 *  of markup in each pane. A preview banner appears and leaves under a cursor that is somewhere
 *  else entirely — in another pane, on the map — so if the row only existed while previewing,
 *  everything below it would jump up and down as a pointer swept across a map. The slot is
 *  therefore ALWAYS drawn and always this tall; only its contents come and go. 16 is CHOSEN: the
 *  chip's own 14 (`--fs-micro` at `--lh-snug` plus 1px of padding each side) with a pixel above
 *  and below so its wash does not touch what is over or under it. */
export const PREVIEW_BANNER_METRICS = { height: 16, chipRadius: 3 }

/** the previewed node, as little of it as this row needs */
export interface PreviewBannerNode {
  /** published as `data-preview-banner` so a driver can locate the row by what it reports. THE
   *  ATTRIBUTE IS ON THE ROW AT REST TOO, EMPTY: "is it previewing" is `getAttribute() !== ''`,
   *  never `hasAttribute()`. */
  id?: string
  title: string
  /** the node's own topic, resolved through `topicPaint` for the name's ink. A DATA field, not a
   *  closed union: pass whatever your corpus calls the topic, or leave it out for the anchor
   *  fallback. Never type this as a list of hue names. */
  domain?: string
}

/** ONE ROW SAYING "THIS PANE IS SHOWING SOMETHING YOU ARE ONLY POINTING AT".
 *
 *  WHAT THE PANE AROUND IT MUST DO:
 *    1. MOUNT IT UNCONDITIONALLY, `node={null}` when nothing is previewed. It reserves its own
 *       height (`PREVIEW_BANNER_METRICS.height`) precisely so a preview arriving or leaving never
 *       reflows the pane under a cursor that is somewhere else. Rendering it only while
 *       previewing throws that away and is the one way to get this wrong.
 *    2. DECIDE `node` FROM A FOREIGN HOVER ONLY, and only while nothing is selected. The rule the
 *       app's Connections pane arrived at, stated as an expression:
 *       `focus == null && !pointerInside && hover != null` — a pane must not re-aim itself at its
 *       own cursor, and a selection pins the pane.
 *    3. HAVE SOMEWHERE TO GO BACK TO. A preview is temporary by definition, so the pane needs a
 *       RESTING reading to snap back to when the cursor leaves — the node the session's cursor
 *       still stands on, not the corpus root. With nothing chosen that reading is the pane's
 *       "Nothing chosen" placeholder, exactly as on a fresh open (OB-209, OB-260). Two panes
 *       previewing the same hover must rest on the same thing, or leaving the hover leaves them
 *       disagreeing.
 *    4. The click this row promises is the pane's, not this component's: it renders no button and
 *       takes no handler, because the thing you click is the node out there under the cursor, not
 *       a control in here.
 *
 *  POND, BECAUSE A PREVIEW IS CROSS-PANE CORRESPONDENCE. `tokens/colors.css` reserves the pond
 *  ramp for "selection and cross-pane correspondence only", which is exactly what this row
 *  reports: another surface's cursor, echoed here. It is deliberately NOT the walk's acorn (this
 *  is not movement along an authored path) and not the moss accent (nothing has been chosen).
 *  The NODE'S OWN TOPIC COLOUR carries the name inside the sentence, so the reader can match it
 *  to the cell they are pointing at without reading the word.
 *
 *  Typed port of the DS components/chrome/PreviewBanner.jsx (contract: PreviewBanner.d.ts),
 *  OB-209 / #342. */
export interface PreviewBannerProps {
  /** the previewed node, or `null` for the resting state — an empty row of the same height */
  node?: PreviewBannerNode | null
  /** what ends the preview, after the em dash. Default "click to select it". Pass `''` to drop
   *  the clause when the gesture is not a click. */
  action?: string
  /** the relation between the cursor and the node. Default "hovering" */
  verb?: string
  /** the chip's word, upper-cased by the component. Default "preview" */
  label?: string
  /** merged onto the row — the pane's own horizontal inset, never its height */
  style?: CSSProperties
}

export function PreviewBanner({ node, action = 'click to select it', verb = 'hovering', label = 'preview', style }: PreviewBannerProps) {
  const M = PREVIEW_BANNER_METRICS
  const paint = topicPaint(node && node.domain)
  return (
    /* THE ATTRIBUTE IS ALWAYS PRESENT, EMPTY AT REST — like the slot itself. A driver finds the row
       whether or not anything is previewed, and "is it previewing" is `getAttribute() !== ''`.
       (This port found the DS drew it only while previewing and said so in `receipts/5ba8bec.md`;
       the DS source now matches, so what was a ★ LOCAL deviation here is retired.) */
    <div data-preview-banner={node ? node.id || '' : ''} aria-live="polite" style={{
      flex: 'none', boxSizing: 'border-box', height: M.height, display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', lineHeight: 'var(--lh-snug)',
      color: 'var(--text-3)', userSelect: 'none', WebkitUserSelect: 'none', overflow: 'hidden', ...style,
    }}>
      {node ? (
        <>
          {/* THE CHIP IS THE STATE, THE SENTENCE IS THE SUBJECT. Upper case and tracked, which is
              this system's own way of saying "a label about the interface, not a word from the
              corpus" — the same register as a pane legend, one rung smaller. */}
          <span style={{
            flex: 'none', padding: '1px 5px', borderRadius: M.chipRadius, background: 'var(--state-selected-wash)',
            color: 'var(--pond-600)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{label}</span>
          {/* ONE LINE, TRUNCATED, NEVER WRAPPED: a wrapped second line is the reflow the fixed
              height exists to prevent, and a long node title is ordinary. */}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {verb} <b style={{ fontWeight: 'var(--fw-semibold)', color: paint.ink }}>{node.title}</b>{action ? ' — ' + action : null}
          </span>
        </>
      ) : null}
    </div>
  )
}
