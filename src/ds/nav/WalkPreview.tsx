import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { portalInto } from '../chrome/portal'

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
 *  Typed port of the DS WalkPreview.jsx (contract: WalkPreview.d.ts), OB-131. */
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
