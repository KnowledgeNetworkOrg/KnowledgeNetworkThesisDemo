import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { portalInto } from '../chrome/portal'
/* the SAME suffix every other walk surface draws after an optional stop's name (`WalkParts`, the
   file that exists because the dock's copy of this had already lost it). No cycle: `WalkParts`
   imports nothing from here — `WalkDock` is the file that imports both. */
import { OptionalSuffix } from './WalkParts'
import { StepDotMath } from './StepDot'

/** THE PREVIEW POPUP'S ONE GEOMETRY, published so three surfaces share it: how far above its
 *  anchor the card floats. A number in prose gets retyped; `WalkStrip` carried `top - 12` inline
 *  and the compact-strip rig carried a second `-12` of its own before this existed. */
export const PREVIEW_GAP = 12

/** THE CARD'S MINIMUM CLEARANCE FROM THE WINDOW'S LEFT AND RIGHT EDGE. CHOSEN, a look, not
 *  derived — the card is a floating sheet and 8px is the smallest gap that still reads as one.
 *  Published for the same reason `PREVIEW_GAP` is: a host drawing its own card for the same hover
 *  must clamp to the same edge, and a number in prose gets retyped. */
export const PREVIEW_EDGE = 8

/** THE ANCHOR FOR A DISCRETE HOVER — a dot, a map pin, a stop in the open row: centred on the
 *  element's own box, sitting on its top edge. A continuous scrub (the seek bar, the closed
 *  rail) anchors on the pointer's x instead and passes `{ x, top }` itself. */
export function previewAnchor(rect: { left: number; top: number; width: number }): { x: number; top: number } {
  return { x: rect.left + rect.width / 2, top: rect.top }
}

export interface WalkPreviewProps {
  /** viewport x the card is centred on — the pointer's `clientX` for a continuous scrub, the
   *  anchor element's centre for a discrete hover (`previewAnchor(rect).x`) */
  x: number
  /** viewport y of the anchor's TOP edge; the card floats `gap` above it */
  top: number
  /** px between the anchor's top edge and the card's bottom. Default `PREVIEW_GAP` (12) — CHOSEN,
   *  a look, not derived; pass a different one only when the anchor is taller than a dot. */
  gap?: number
  /** the host's preview content — what `renderPreview(step, index, mark?)` returned */
  children?: ReactNode
}

/** THE ONE POPUP EVERY WALK SURFACE SHOWS ON HOVER — the strip's seek bar and dots, the dock's
 *  closed rail and open row, and a walk pin on the map all hang the SAME card off the same
 *  geometry, so a stop previews identically wherever the pointer finds it. The host supplies the
 *  content (`renderPreview(step, index, mark?)` on every one of those components); this only places it.
 *
 *  POSITIONED AGAINST THE VIEWPORT (fixed), never the surface — a preview is meant to float free
 *  of the pane's own clipping, the same reason a video scrubber's thumbnail is never cropped by
 *  the timeline's box. Sits `PREVIEW_GAP` above the anchor, centred on its x. Pointer-transparent
 *  and aria-hidden: it is a look-ahead, not a control, and it must never steal the hover that
 *  raised it.
 *
 *  WHAT THE CALLER MUST DO (WalkPreview.d.ts): render it while a hover is live AND WHILE A DRAG IS
 *  CHOOSING A STOP — that rule was the other way round until 2026-09-14 and the reversal is the
 *  owner's (OB-185): a hover asks *what is over there*, a drag COMMITS, so the card belongs to the
 *  gesture that commits; what a scrub needs is a better ANCHOR (the stop being landed on, not the
 *  pointer), which `WalkDock` does. Still no card when nothing is pointed at or dragged. Pass
 *  VIEWPORT coordinates and re-read `top` on every hover move; CURSOR HOVER ONLY — a hover
 *  published by another pane has no pointer over this surface to anchor to; and
 *  NAME THE STOP BY ITS FULL STEP PATH when the stop sits inside a `VersionedGroup` on the walk
 *  ("3.1", "1.1.1.2" — the group's own `numberScope`/`localIndex` numbering). A map pin shows
 *  only the top-level step and several pins may share it (OB-114 / #228, owner 2026-09-03); this
 *  card is where the path has room, and the ONLY place on the map it is readable. A stop at the
 *  top level names its plain number as before. The app's `renderStopPreview` does exactly that
 *  from `PlayStep.path`.
 *
 *  AND IT CLAMPS ITSELF TO THE WINDOW'S EDGES, WHICH IS NOT THE CALLER'S JOB (DS OB-191,
 *  2026-09-15). The card is centred on `x` by `translateX(-50%)`, so an anchor closer to the
 *  window's left or right edge than half the card's width puts part of the card outside the
 *  window, cut off with no scrollbar and no overflow to notice — the owner's report: pointer on
 *  the dock's FIRST stop, the card flush against the window's left edge with its border and the
 *  start of its text cut away. The width belongs to the HOST (it is `renderPreview`'s content),
 *  so the clamp measures the rendered box in a layout effect and shifts `left` before the browser
 *  paints — no jump, and no published maximum width this side would have to guess at. A window
 *  narrower than the card plus its two insets keeps the card centred: there is no placement that
 *  does not clip, and shifting would hide one edge to save the other. Callers pass the anchor's
 *  TRUE centre and never pre-shift `x` — the clamp cannot tell a pre-shifted anchor from a real
 *  one and would correct it twice (`WalkPreview.d.ts` rule 6).
 *
 *  AND THE CONTENT IS THE STOP'S DOCUMENT, NOT ITS NAME (rule 7, DS OB-199, 2026-09-16) — and the
 *  way to keep that true is to pass `StopCard` (below) rather than a card of your own. A hover
 *  here asks *what will I read when I get there*; the name is already under the dot, beside the
 *  transport and in the breadcrumb, so a card carrying only the name is a native tooltip with a
 *  border on it. That is what the owner reported (the app's card printed `address · title` plus
 *  the walk's note WHEN THE WALK HAD ONE, and the stop in the screenshot had none).
 *
 *  Typed port of the DS WalkPreview.jsx (contract: WalkPreview.d.ts), OB-131, and OB-199's
 *  `StopCard` + `STOP_CARD_METRICS`. */
/** IT RENDERS THROUGH A PORTAL, AND THAT IS NOT A DETAIL — it is what makes `position: fixed` mean
 *  what the docblock above says. A `filter`, `backdrop-filter`, `transform`, `perspective` or
 *  `will-change` on ANY ancestor makes that ancestor the containing block for a fixed descendant,
 *  so the card's viewport coordinates are silently re-read as offsets inside it and the card draws
 *  somewhere else — usually under the pane's own `overflow: hidden`, where it is invisible. Not
 *  hypothetical: `WalkDock` wears `backdrop-filter: blur(6px)` for its paper wash, so from the day
 *  the dock was written its hover preview was mounted, populated and drawn ~137px below the rail,
 *  outside the pane, clipped (owner-reported 2026-09-14; OB-185 clause 6, measured both ways in
 *  the DS's `guidelines/preview-containing-block-probe.html`). Every DOM-count probe passed. A host
 *  rule would not have saved it — the ancestor is a LOOK three levels up and the failure draws
 *  nothing — so the mechanism ships here: `portalInto(document.body, …)`, the same helper
 *  `VersionedGroup` and `NodePicker` use. Rendering in place is the no-`document` fallback and the
 *  only state in which the fault can return. `data-walk-preview` is a test hook only. */
export function WalkPreview({ x, top, gap = PREVIEW_GAP, children }: WalkPreviewProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shift, setShift] = useState(0)
  // (the clamp reads the card's RENDERED width, which a render cannot know and which is the
  // host's content; a layout effect lands the shift before paint)
  // No dependency list ON PURPOSE: the card's width is the host's content, which can change
  // without `x` or `top` moving. Runs before paint; an unchanged shift bails out of re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const half = el.getBoundingClientRect().width / 2
    const min = PREVIEW_EDGE + half
    const max = window.innerWidth - PREVIEW_EDGE - half
    setShift(max < min ? 0 : Math.min(Math.max(x, min), max) - x)
  })
  const card = (
    <div ref={ref} aria-hidden="true" data-walk-preview="" style={{
      position: 'fixed', left: x + shift, top: top - gap,
      transform: 'translate(-50%, -100%)', zIndex: 20, pointerEvents: 'none',
    }}>{children}</div>
  )
  const host = typeof document !== 'undefined' ? document.body : null
  return host ? portalInto(host, card) : card
}

/** THE CARD'S OWN MEASURE AND ITS CLAMPS — CHOSEN, not derived. 264px is ≈38 characters at
 *  `--fs-body`, which is a readable measure for two or three lines of prose and still narrower
 *  than the narrowest pane the dock sits on. The clamps are what keep a long document from
 *  turning a look-ahead into a page: three lines of the document alone, two when a walk note is
 *  above it, three for the note itself. */
export const STOP_CARD_METRICS = { width: 264, bodyLines: 3, bodyLinesWithNote: 2, noteLines: 3 }

function stopClamp(lines: number): CSSProperties {
  return { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }
}

export interface StopCardProps {
  /** the stop's number as the SURFACE counts it — the dock and the map pin pass the two-number
   *  address (`walkAddresses`), a grouped stop its full path (rule 4), a merged pin its run's
   *  label. Omit for no number. */
  address?: string | number
  /** the stop's node title */
  title: string
  /** draws the shared " (optional)" suffix after the name — the same `OptionalSuffix` every other
   *  walk surface uses, never a second wording — italicises the name, and slants the address in
   *  front of it by `StepDotMath.oblique.angle` (DS OB-216 clause 3). */
  optional?: boolean
  /** where the stop sits, one line, clipped: "Core Computer Science › Digital Logic". The host
   *  composes it from its own tree — a breadcrumb string, not a list of nodes. */
  ancestry?: string
  /** the WALK's own note for this stop — why this walk comes here. Clamped to three lines. */
  note?: ReactNode
  /** the NODE's document opening — what the reader will actually find. Clamped to three lines, or
   *  two when a note sits above it. THIS IS THE ONE THE REPORT WAS ABOUT: without it a stop the
   *  walk never annotated draws a card with nothing in it. */
  body?: ReactNode
  /** a merged MAP pin's mark (`{ from, to, label }`, 0-based, the host's own numbering). The
   *  footer then counts the other stops under that pin — load-bearing, because the card names one
   *  of several documents and nothing else on the map says so (OB-186). The dock passes none. */
  mark?: { from: number; to: number; label?: string }
  /** position/size overrides for the mount only. Do not restyle the type or the ink. */
  style?: CSSProperties
}

/** WHAT THE CARD SAYS, WRITTEN ONCE (owner, 2026-09-16, DS OB-199: "when i hover over the walk
 *  dock's nodes the tooltip preview is still not right, just shows the title of the node being
 *  hovered over"). `WalkPreview` places the card and this composes it, so the strip, the dock's two
 *  rails, the dock's name readout and a map pin all answer the hover with the same thing.
 *
 *  THE QUESTION THE HOVER ASKS IS "WHAT WILL I READ WHEN I GET THERE", and a name cannot answer
 *  it — the name is already under the dot on the open row, beside the transport on the closed
 *  rail, and in the tree and the breadcrumb besides. So the card is the stop's DOCUMENT: where the
 *  stop sits, the walk's own reason for stopping there, and the opening of the page itself.
 *
 *  THE HOST OWNS EVERY STRING AND THIS INVENTS NONE. `body` is the node's document opening — the
 *  app's `DOC_BODY` is guarded at module load to hold one for every graph node, so a card with
 *  nothing under its head is a host that did not pass it, not a stop without a page. With neither
 *  `note` nor `body` the card draws its head and its placement line and stops: no skeleton, no
 *  "no description", no prose this side made up.
 *
 *  THE INK LADDER CARRIES THE SOURCE, so no labels are needed and none are drawn: the walk's own
 *  note is `--text-1` (someone wrote it for this walk), the document's opening is `--text-2` (it
 *  belongs to the node and is true whoever is reading), the placement line a meta line at
 *  `--fs-caption`. AND THE PROSE IS `--fs-body`: 11px is this system's floor for numerals, tags
 *  and glyph marks, never for sentences — the reported card was 11px prose, which is half of why
 *  it read as a tip rather than as a page.
 *
 *  A MERGED PIN'S FOOTER IS LOAD-BEARING (OB-186): the card names ONE of several documents under
 *  that pin and nothing else on the map admits it. Pass the pin's own `mark` and the footer counts
 *  the rest; the dock passes none, because the dock draws one mark per stop.
 *
 *  Test hooks: `data-stop-card` and `data-stop-card-more` are the DS's; ★ LOCAL
 *  `data-stop-card-head` marks the heading, so a browser check can assert the card says MORE than
 *  its head — OB-199's own acceptance test. */
export function StopCard({ address, title, optional = false, ancestry, note, body, mark, style }: StopCardProps) {
  const M = STOP_CARD_METRICS
  const under = mark ? Math.max(0, mark.to - mark.from) : 0
  return (
    <div data-stop-card="" style={{
      width: M.width, maxWidth: '100%', boxSizing: 'border-box',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hair)',
      background: 'var(--surface-paper)', boxShadow: 'var(--lift-2)', overflow: 'hidden',
      fontFamily: 'var(--font-ui)', textAlign: 'left', ...style,
    }}>
      <div style={{ padding: '8px 11px 0' }}>
        {/* AN OPTIONAL STOP'S NAME IS ITALIC HERE TOO (DS OB-216 clause 3), on the same terms as
            `WalkParts.StopTitle`: the whole name, AND THE CARD KEEPS ITS HEADING WEIGHT (the item's
            2026-09-17 amendment — the variable italic loads at 400-800, so semibold italic is real
            type). No `fontWeight` branch on `optional`. */}
        <div data-stop-card-head="" style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', fontStyle: optional ? 'italic' : undefined, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', ...stopClamp(2) }}>
          {address == null || address === '' ? null : (
            /* the address takes the SAME OBLIQUE the pin's numeral takes, AND NOT THE NUDGE that goes
               with it: `StepDotMath.oblique.nudgeEm` puts a slanted numeral back on the centre of a
               circle, and this one sits inline in a run of text with no centring to restore —
               translating it here would push it off its own baseline run. */
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)', color: 'var(--text-2)', fontStyle: optional ? `oblique ${StepDotMath.oblique.angle}deg` : undefined }}>{address + ' · '}</span>
          )}
          {title}
          {optional ? <OptionalSuffix /> : null}
        </div>
        {ancestry ? (
          <div style={{ marginTop: 2, fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)', ...stopClamp(1) }}>{ancestry}</div>
        ) : null}
      </div>
      {note || body ? (
        <div style={{ padding: '6px 11px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {note ? (
            <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', color: 'var(--text-1)', ...stopClamp(M.noteLines) }}>{note}</div>
          ) : null}
          {body ? (
            <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)', ...stopClamp(note ? M.bodyLinesWithNote : M.bodyLines) }}>{body}</div>
          ) : null}
        </div>
      ) : <div style={{ height: 8 }} />}
      {mark && under > 0 ? (
        <div data-stop-card-more="" style={{ padding: '5px 11px 7px', borderTop: '1px solid var(--border-hair)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)' }}>{mark.label}</span>
          {' · +' + under + (under === 1 ? ' more stop' : ' more stops') + ' under this pin'}
        </div>
      ) : null}
    </div>
  )
}
