import React from 'react'
import { PaneHeader, PaneFrameContext, LEGEND_ROW } from './PaneHeader.jsx'
import { Grip } from './Grip.jsx'

/** How far a scrolling body holds off the pane's edge, so the scrollbar's end arrows
 *  clear the `--radius-lg` corners instead of being clipped by them. One inset serves
 *  both axes AND BOTH ENDS — a scroller reserves an arrow square at each end of its
 *  gutter, and a pane has a rounded corner at each end of its right edge. It was
 *  bottom-only until 2026-08-17f, which left the top arrow inside the top corner's arc:
 *  total overlap in a pane with no header (the scroller starts 1px down against a 20px
 *  arc), ~2px in one with a legend, whose 11px hat is not enough on its own. Insetting
 *  from the header rather than computing `radius − headerHeight` keeps it one number
 *  and stops the two coupling. Exported for the rare pane that builds its own body
 *  (`scroll="none"`) — so the number still lives in exactly one place. Prefer
 *  `PaneScroller`, below, which applies it for you. */
export const SCROLLER_INSET = 12

/** WHERE EVERY PANE'S FIRST LINE SITS — 25px below the frame's top edge, to the top of the first
 *  line's text box. CHOSEN, not derived (owner-approved 2026-09-22): the document header already
 *  sat there, and a scrolling body cannot start higher than 23 (`LEGEND_ROW` 11 + `SCROLLER_INSET`
 *  12). Panes side by side put their first line here so they read level; before this, palette,
 *  map and document started at +31, +17 and +25. The two pads below are DERIVED from it — which
 *  one a first row applies depends on what it sits in. */
export const FIRST_LINE = 25
/** the top padding of a first row that sits directly under the legend — a `scroll="none"` body
 *  with no margin of its own: `FIRST_LINE` − `LEGEND_ROW` = 14. */
export const FIRST_ROW_PAD = FIRST_LINE - LEGEND_ROW
/** the top padding of a first row inside a scrolling body, which already sits `SCROLLER_INSET`
 *  down: `FIRST_ROW_PAD` − `SCROLLER_INSET` = 2. */
export const FIRST_SCROLL_PAD = FIRST_ROW_PAD - SCROLLER_INSET

/** WHAT A SCROLLBAR TAKES OUT OF A SCROLLING BOX — MEASURED ONCE, never assumed. 12 under this
 *  project's own styled bars, 15-17 under an unstyled Windows/Linux bar, and ZERO under an
 *  overlay bar (macOS by default, a touch device, Chrome's overlay-scrollbars flag), where the
 *  bar floats ON the content instead of beside it. Not a token, because it is a fact about the
 *  reader's machine rather than a decision of ours. */
let scrollbarPx = null
export function scrollbarWidth() {
  if (scrollbarPx !== null) return scrollbarPx
  if (typeof document === 'undefined' || !document.body) return 0
  const box = document.createElement('div')
  box.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll'
  document.body.appendChild(box)
  scrollbarPx = box.offsetWidth - box.clientWidth
  document.body.removeChild(box)
  return scrollbarPx
}

/** THE ROOM A SCROLLING COLUMN HOLDS OFF ITS OWN RIGHT EDGE, and the answer is conditional
 *  because the question is. `scrollbar-gutter: stable` reserves the bar's width — which is the
 *  whole fix where the bar HAS a width, and reserves exactly nothing where it does not.
 *
 *  FIREFOX IS THE CASE, not an exotic one (owner-reported on the running app, 2026-09-17, and
 *  the screenshot's engine settles it): a `scrollbar-width: thin` bar there takes NO layout
 *  space, so `stable` reserves nothing, the rows run underneath the thumb, and it reads exactly
 *  as "the scrollbar clips the content". macOS overlay bars and touch devices are the same
 *  condition. Chromium with a styled `::-webkit-scrollbar` is the case where the gutter is real
 *  — which is why this project's own renderer cannot show the fault, and why the number is
 *  MEASURED rather than assumed on either side.
 *
 *  10 is CHOSEN, and it is the drawn thumb's own width plus air, not a gutter's: an overlay bar
 *  draws thinner than a reserved gutter, and a column that gives up 12px for a 7px bar reads as
 *  a margin nobody asked for. */
export const SCROLLBAR_ROOM = 10
export function scrollerPadRight() { return scrollbarWidth() > 0 ? 0 : SCROLLBAR_ROOM }

/** ONE SCROLLING COLUMN of a pane's body, for the `scroll="none"` case — a body split
 *  into columns that scroll separately, which is the only reason a caller ever owns the
 *  body. It carries the inset, so "a `none` body that scrolls MUST apply
 *  SCROLLER_INSET itself" stops being something to remember. `Pane`'s own body IS this
 *  component, so there is one implementation rather than two that can drift. */
export function PaneScroller({ axis = 'y', style, forwardRef, children, ...rest }) {
  /* the overlay-bar room, unless the caller has priced its own right padding in */
  const padRight = style && style.paddingRight != null ? style.paddingRight : (axis === 'x' ? 0 : scrollerPadRight())
  return (
    <div ref={forwardRef} data-pane-body="scroller" {...rest} style={{
      flex: 1, minHeight: 0,
      overflowY: axis === 'x' ? 'hidden' : 'auto',
      overflowX: axis === 'y' ? 'hidden' : 'auto',
      /* both ends: not a radius on the scroller, the pane's own paper fills the strip */
      marginTop: SCROLLER_INSET, marginBottom: SCROLLER_INSET,
      ...style,
      paddingRight: padRight,
    }}>{children}</div>
  )
}

const CANVAS_FACE = { sunken: 'var(--surface-sunken)', paper: 'var(--surface-paper)', none: 'transparent' }

/** THE NESTED-RADIUS RULE, MEASURED RATHER THAN ASSUMED. A box that fills a rounded box
 *  cannot repeat its radius: the child sits some distance in, and at that depth the
 *  parent's arc has already turned, so an equal radius curves away from the parent's now
 *  straight edge and leaves a crescent of the parent showing. A canvas 12px below a 20px
 *  frame with a 20px top radius shows two of them, and `--sink-1`'s 1px inner ring traces
 *  the lot — which reads as a grey outline floating inside the body (owner, 2026-08-21,
 *  from the chrome card's own specimen, four hours after this component shipped).
 *
 *  So each corner takes `frame radius − this corner's inset`, floored at 0, read off the
 *  live frame rather than hard-coded. Measuring is what keeps the number out of here: a
 *  `variant="bar"` header is 34px, past the 20px arc, and the top corners then compute to
 *  square all by themselves — which is correct, and is not a case anyone would have
 *  remembered to write down. `useLayoutEffect` runs before paint, so nothing flashes.
 *
 *  THE FRAME IS FOUND THROUGH THE DOM, NOT THROUGH `PaneFrameContext`, and that is not a
 *  style choice. React attaches a parent host element's ref while walking the commit
 *  bottom-up, AFTER its children's layout effects have run — so on first mount
 *  `frameRef.current` is still null here, the measurement bails, and with no dependency
 *  that can change it never runs again. The first version did exactly that and shipped a
 *  canvas still drawing 20px corners while the console said nothing (2026-08-21, caught by
 *  the verifier reading the compiled bundle, not by looking at the card — the fallback
 *  radius is the frame's own, so the failure is invisible except as the bug it was meant
 *  to fix). Mutations are committed before layout effects, so the DOM is reliable when a
 *  ref is not: `closest('[data-pane-frame]')`, then the nearest rounded ancestor, which
 *  also makes this work inside a frame composed by hand. */
function paneFrame(el) {
  const marked = el.closest('[data-pane-frame]')
  if (marked) return marked
  for (let n = el.parentElement, i = 0; n && i < 5; n = n.parentElement, i++) {
    if ((parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0) > 0) return n
  }
  return null
}
function useNestedRadius(ref, active) {
  const [r, setR] = React.useState(null)
  /* MEASURED AGAIN WHENEVER EITHER BOX CHANGES SIZE, not once (2026-09-30). The inset is not
     fixed: a rail opening beside the canvas, or its seam being dragged, moves the canvas's left
     edge off the frame's. Measured once at mount with the rail closed, the bottom-left corner
     kept the frame's full 20px and drew a paper notch at the seam once the rail opened (the
     app's map pane). Both boxes resize whenever an inset changes, so observing both is enough;
     the string only changes when a corner does, so this cannot loop. */
  React.useLayoutEffect(() => {
    const el = ref.current
    const frame = el && paneFrame(el)
    if (!active || !el || !frame) { setR(null); return }
    const measure = () => {
      const f = frame.getBoundingClientRect(), b = el.getBoundingClientRect()
      const fs = getComputedStyle(frame)
      const R = { tl: parseFloat(fs.borderTopLeftRadius) || 0, tr: parseFloat(fs.borderTopRightRadius) || 0,
        br: parseFloat(fs.borderBottomRightRadius) || 0, bl: parseFloat(fs.borderBottomLeftRadius) || 0 }
      const top = b.top - f.top, bottom = f.bottom - b.bottom
      const left = b.left - f.left, right = f.right - b.right
      const nest = (radius, a, c) => Math.max(0, radius - Math.max(a, c))
      const next = [nest(R.tl, top, left), nest(R.tr, top, right), nest(R.br, bottom, right), nest(R.bl, bottom, left)]
        .map((n) => n + 'px').join(' ')
      setR((prev) => (prev === next ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [ref, active])
  return r
}

/** THE OTHER SHAPE A PANE BODY CAN BE, and the reason a clip ever belongs in a pane: a
 *  CANVAS whose content must be cropped — absolutely-positioned nodes that can run past
 *  the pane's edge and must be cut by the curve rather than paint over the frame.
 *
 *  Written 2026-08-21, because this case was documented as an escape hatch and nothing
 *  more, and `src/studio/StudioView.tsx:216` read the hatch as the way to satisfy the
 *  body rule: an `overflow: hidden` + `--radius-lg` div wrapped around EVERY body,
 *  scrolling ones included. That is the one configuration a clip must never take — the
 *  arc then has a scrollbar gutter to bite, and the body's menus are trapped by a frame
 *  that was deliberately left `visible`. The distinction is not something to remember:
 *  **a scroller is `PaneScroller`, a canvas is `PaneCanvas`, and the second one is the
 *  only one that crops.**
 *
 *  It rounds each corner to the frame's radius LESS its own inset from that corner — see
 *  `useNestedRadius` above; repeating the frame's radius is what leaves a crescent of
 *  paper inside the body. `inset` makes it a WELL instead: held `SCROLLER_INSET` off every
 *  edge, `--radius-lg`, and `--sink-1`, which is where that ring belongs — a ring says
 *  “this is a distinct object”, and a lining is not one, which is why the bleed form takes
 *  the face and no ring. `position: relative` either way, so the canvas's absolute
 *  children measure against it. */
export function PaneCanvas({ face = 'sunken', inset = false, style, forwardRef, children, ...rest }) {
  const own = React.useRef(null)
  const radius = useNestedRadius(own, !inset)
  return (
    <div ref={setRefs(own, forwardRef)} data-pane-body="canvas" {...rest} style={{
      flex: 1, minHeight: 0, position: 'relative',
      overflow: 'hidden',
      borderRadius: inset ? 'var(--radius-lg)' : (radius || 'var(--radius-lg)'),
      margin: inset ? SCROLLER_INSET : 0,
      background: CANVAS_FACE[face] || CANVAS_FACE.sunken,
      boxShadow: inset && face === 'sunken' ? 'var(--sink-1)' : 'none',
      ...style,
    }}>{children}</div>
  )
}

const AUDITED = new WeakSet()
const opaque = (c) => !!c && c !== 'transparent' && !/,\s*0\s*\)$/.test(c)
/** Any CSS colour to its three channels, by asking the browser rather than parsing: a
 *  computed `background-color` is already `rgb()`, but a `face` arrives as whatever the
 *  caller wrote — a hex, a `var()`, `oklch()` — and only the engine knows what those
 *  resolve to. Used once per pane, on mount, inside the audit. */
const rgbOf = (v) => {
  if (!v) return null
  const p = document.createElement('span')
  p.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  p.style.color = String(v).trim()
  document.body.appendChild(p)
  const m = getComputedStyle(p).color.match(/[\d.]+/g)
  p.remove()
  return m ? m.slice(0, 3).map(Number) : null
}
const lum = (c) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const scrolls = (el) => {
  const s = getComputedStyle(el)
  return /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflowX)
}

/** WHICH ELEMENTS COUNT AS “the body” for the face check — the body box, its direct
 *  children, and then the single-child WRAPPER CHAIN below it, stopping at the first
 *  element that scrolls (inclusive) or crops. Depth matters, and a fixed one is wrong in
 *  both directions: check only the body and its children and you miss the common shape —
 *  a caller's painted root inside their own wrapper, one level too deep, which is how the
 *  first version of this guard missed the very fault it was written for; walk the whole
 *  subtree and you flag every legitimately-painted well, card and chip INSIDE a scroller,
 *  which are content, not the body's face. A wrapper is single-child by definition, and
 *  content begins at the scroller. */
function bodyChrome(body) {
  const out = [body]
  if (scrolls(body)) return out
  out.push(...body.children)
  let el = body, guard = 0
  while (el && guard++ < 6) {
    if (el.children.length !== 1) break
    el = el.children[0]
    if (out.indexOf(el) < 0) out.push(el)
    if (scrolls(el) || (el.dataset && el.dataset.paneBody === 'canvas')) break
  }
  return out
}

/** THE ONE RULE THAT CANNOT BE MADE STRUCTURAL, MADE LOUD INSTEAD. A caller's own root
 *  element is beyond any component's reach: nothing `Pane` renders can stop an
 *  instrument painting itself `bg-slate-50`, and that failure is silent — it looks like a
 *  pane, just the wrong colour, with two square notches where the rounded top should be.
 *  So `Pane` reads its body once on mount and says so in the console, naming the element.
 *
 *  Two checks, both of them faults we have actually shipped:
 *   - a body element with an opaque background (`PaneCanvas` is exempt — its face is the
 *     canvas's own surface);
 *   - a rounded clipping ancestor between a scrolling element and the frame, which is the
 *     configuration that bites the scrollbar's gutter.
 *  Pass `audit={false}` to silence it; it costs one pass per pane, once. */
function auditBody(frame, body) {
  if (!frame || !body || AUDITED.has(frame)) return
  AUDITED.add(frame)
  const warn = (msg, el) => console.warn('[Pane] ' + msg, el)
  auditFace(frame)
  /* A FACED PANE MAKES ONE PAINTED BODY LEGITIMATE: the same colour. `face` exists so a
     coloured content can reach the pane's edge, and the shape that asks for it is a
     caller's own root painted that colour — which is exactly what this check was
     written to catch when the colour was slate. The face is the pane's declared colour,
     so a body matching it cannot cut a notch: there is nothing lighter behind it. Anything
     ELSE painted on the body still warns, faced pane or not. */
  const frameBg = getComputedStyle(frame).backgroundColor
  for (const el of bodyChrome(body)) {
    if (el.dataset && el.dataset.paneBody === 'canvas') continue
    /* A RULE IS NOT A FACE. A 1px child painted with a border colour is a hairline divider —
       `QuickActionsDeck` puts one between its two tile groups, and this audit called it a face
       and printed the notch warning on every mount (found by review, 2026-09-03). Nothing 1px
       tall can bite a 20px corner arc, so the hairline test decides it: the fault this check is
       for is a WRAPPER, which by definition has the body's own extent.
       EITHER AXIS, not just height (2026-09-05, from `receipts/c7bc6bf.md` — the app read the
       obligation more carefully than this file did and ported both axes). A 1px-WIDE child is a
       vertical rule between two columns, exactly as legitimate as a horizontal one, and it was
       still tripping this audit here. */
    const box = el.getBoundingClientRect()
    if (box.height <= 1 || box.width <= 1) continue
    const bg = getComputedStyle(el).backgroundColor
    if (bg === frameBg) continue
    if (opaque(bg)) {
      warn(`the body paints its own background (${bg}). A pane body shows --surface-paper `
        + 'through it; a body with a face of its own starts inside the 20px corner arc with '
        + 'square corners and bites two notches out of the pane\'s rounded top. Delete the '
        + 'face — or if this is a canvas whose content must be cropped, render PaneCanvas.', el)
    }
  }
  /* bounded on purpose: a canvas pane can hold thousands of nodes, and this is a
     mount-time courtesy, not a validator. The fault it looks for is always near the top
     of the body — it is a wrapper, by definition. */
  const nodes = Array.from(body.querySelectorAll('*')).slice(0, 300)
  for (const el of nodes) {
    if (!scrolls(el)) continue
    for (let n = el.parentElement; n && n !== frame.parentElement; n = n.parentElement) {
      const p = getComputedStyle(n)
      if (p.overflow !== 'visible' && parseFloat(p.borderTopRightRadius) > 0) {
        warn('a rounded clip wraps a scrolling element, so the corner arc bites the '
          + 'scrollbar\'s gutter (the end arrow loses about half its 12px square) and any '
          + 'menu the body opens is trapped. Crop the CANVAS box with PaneCanvas; never '
          + 'crop a scroller.', n)
        break
      }
    }
  }
}

/** THE `face` PROP'S GUARD, AND WHY IT IS CODE RATHER THAN A UNION. `face` takes any
 *  colour, because the colour it is FOR is not ours: the app's map paints water, a pane
 *  over a data field paints that field's hue, and both are chosen at runtime by code
 *  rather than by a person picking from a list (a closed union here would also compile
 *  into a lint rule in a consumer's linter — see CLAUDE.md). What a list would have
 *  bought is the one thing that can actually go wrong, so that is bought here instead,
 *  by measurement: the legend title straddles the frame's top edge, so the LOWER HALF of
 *  every letter sits on the face. On the app's water `--text-1` measures 11.23:1 and
 *  nothing is at risk; on a mid or dark face the title's lower half fails while its top
 *  half, still on the desk, looks fine — a half-legible word, which is worse to read than
 *  a fully illegible one and much easier to ship. 4.5:1 is the threshold because the
 *  legend is 11px semibold: small text, so AA's large-text 3:1 does not apply.
 *  Reported, not refused: whether a face is worth its contrast is the caller's call, and
 *  a component that throws here would block a legitimate dark-canvas pane. */
function auditFace(frame) {
  if (!frame) return
  const cs = getComputedStyle(frame)
  const face = rgbOf(cs.backgroundColor)
  const ink = rgbOf(cs.getPropertyValue('--text-1'))
  if (!face || !ink) return
  const r = contrast(face, ink)
  if (r < 4.5) {
    console.warn('[Pane] the frame\'s face gives the legend title ' + r.toFixed(2) + ':1 '
      + '(' + cs.backgroundColor + ' against --text-1), under the 4.5:1 an 11px title needs. '
      + 'The title sits ON the frame\'s top edge, so its LOWER HALF is on this face while its '
      + 'top half is on the desk \u2014 the word goes half-legible rather than plainly '
      + 'unreadable. Lighten the face, or pass variant="bar" so the title has a row of its own.', frame)
  }
}

const setRefs = (...refs) => (el) => refs.forEach((r) => {
  if (!r) return
  if (typeof r === 'function') r(el); else r.current = el
})

/** The instrument pane, whole: the frame, its hat, and the body between them.
 *
 *  It exists because `PaneHeader` alone could not enforce the three rules its own
 *  geometry depends on — the legend is 11px tall against a 20px corner arc, so the box
 *  around it is not incidental. Every caller was rebuilding that box, and two of them
 *  got it wrong the same way: a body painting its own background starts INSIDE the
 *  corner arc with square corners and bites two square notches out of the pane's
 *  rounded top; a scroller with no inset has an end arrow clipped by the same arc, at
 *  whichever end it was forgotten. Here there is no body div for a caller to give a background to, and the inset
 *  is not optional. Written 2026-08-17.
 *
 *  The frame is handed to `PaneHeader` through `PaneFrameContext`, so the header knows
 *  which element to watch for the pointer without walking the DOM. That used to be a
 *  `parentElement` walk, and "PaneHeader must be a direct child" was a rule a wrapper
 *  div could break in silence. Inside a `Pane` there is no such rule any more. */
export function Pane({
  title, glyph, onClose, actions, tally, legendBg, variant, grabbable, onGrabStart,
  resizable = false, onResizeStart, actionBar, face,
  scroll = 'y', as = 'section', style, bodyStyle, bodyRef, audit = true, children, ...rest
}) {
  const Frame = as || 'section'
  const frameRef = React.useRef(null)
  const bodyEl = React.useRef(null)
  const barRef = React.useRef(null)
  /* THE SAME NESTED-RADIUS FIX PaneCanvas USES, for a docked bar that sits between the
     header and the scroller. An action bar paints its own opaque face (PaneActionBar,
     `--surface-raised`) directly under an 11px legend header that hasn't cleared the
     20px corner arc — without this, its square top corners bite the same two notches
     out of the rounded frame that `auditBody` warns about for any other opaque body
     child (owner, 2026-08-21, from the chrome card's own specimen). */
  const barRadius = useNestedRadius(barRef, !!actionBar)
  React.useEffect(() => { if (audit) auditBody(frameRef.current, bodyEl.current) }, [audit])
  return (
    <Frame ref={frameRef} data-pane-frame="" {...rest} style={{
      position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0,
      /* `face` IS THE ONE SURFACE DECISION A CALLER OWNS, and only because of what it is
         for: content with a colour of its own — a map's water, a data field's hue — which
         otherwise leaves the pane's paper showing wherever the content cannot reach, at the
         corners always and below the content whenever the content is shorter than the pane
         (owner, 2026-08-22, from the app's map). Painting the FRAME is what removes those
         cutouts at every content height; filling the body only removes the ones the content
         happens to cover. It is the frame that is painted, never the body — rule 2 is
         untouched, and `auditBody` still warns for any body face except this one. */
      background: face || 'var(--surface-paper)',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-frame)',
      /* visible, not hidden: the ✕'s notch and any menu a body opens have to leave
         the frame — and nothing inside the frame clips either. A clip layer here
         (an `overflow: hidden` + radius div wrapping the body) traps those menus
         again AND bites the scroller's gutter with the corner arc; a body that
         paints no background never needs one. The only pane that legitimately
         clips is one whose CONTENT must be cropped, and that is `PaneCanvas`. */
      overflow: 'visible',
      ...style,
    }}>
      <PaneFrameContext.Provider value={frameRef}>
        <PaneHeader title={title} glyph={glyph} onClose={onClose} actions={actions} tally={tally}
          variant={variant} legendBg={legendBg} frameBg={face} grabbable={grabbable} onGrabStart={onGrabStart} />
        {actionBar ? (
          <div ref={barRef} style={{ flexShrink: 0, overflow: 'hidden', borderRadius: barRadius || 0 }}>
            {actionBar}
          </div>
        ) : null}
        {scroll === 'none' ? (
          /* `none` hands the body's CONTENTS back, not the body BOX. The box is still
             ours — a transparent flex column that takes the space under the hat — so a
             child sized `height: 100%` measures the body rather than the whole frame,
             which used to overflow by the header's height and was a rule a caller had to
             know (`flex-1 min-h-0`, never `h-full`). A body that must size to its own
             content passes `bodyStyle={{ flex: 'none' }}`. */
          <div ref={setRefs(bodyEl, bodyRef)} data-pane-body="box" style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0,
            ...bodyStyle,
          }}>{children}</div>
        ) : (
          <PaneScroller axis={scroll} forwardRef={setRefs(bodyEl, bodyRef)} style={bodyStyle}>{children}</PaneScroller>
        )}
        {resizable ? (
          /* THE CORNER IS THE PANE'S, NOT THE BODY'S — it sits on the frame, outside the
             body box, so a scrolling body never scrolls its own resize handle away and a
             cropping one never clips it. `nwse-resize` is the cursor; the GESTURE is the
             host's, exactly as with the grab: only the host knows the pane's bounds, its
             minimum size and what else is on the board. `data-resize` is the stable hook
             for an interaction driver, the sibling of the header's `data-grab` — that
             attribute exists because the app's driver had fallen back to finding the
             handle by its title TEXT. */
          <span data-resize="" role="separator" aria-label="resize pane"
            onPointerDown={onResizeStart}
            style={{
              /* THE MARK SITS OUTSIDE THE ROUNDED CORNER, in the empty notch the curve
                 leaves behind (owner, 2026-08-21c). It used to sit INSIDE the arc: box at
                 right/bottom 0 with 6px of padding put the mark 6px in from both edges,
                 where its hairlines ran across the frame's own border.
                 The geometry, and -2 is a LOOK rather than a minimum — the first version of
                 this note got that backwards. A `--radius-lg` curve cuts R − R/√2 ≈ 5.86px
                 deep on the diagonal and the 9px triangle is size/√2 ≈ 6.36px deep, so the
                 tip has to clear the box corner by only **0.51px on the diagonal** (≈0.36px
                 per axis) for the mark to be off the arc AT ALL. At that clearance the
                 hairlines graze the border: clearing an arc and reading as clear of it are
                 different thresholds, and only the second one is the affordance — the same
                 finding that rejected a 0.8px clearance on the inside. -2 per axis leaves
                 ~2px of paper between the hypotenuse and the border, which is what the
                 owner asked for and what `guidelines/grip-probe.html` measures. Padding
                 moved to the TOP AND LEFT so the hit area still runs inward.
                 The earlier note here claimed -2 had been tried and crossed the border. It
                 was tried with the 6px padding still in place, which puts the mark 4px
                 INSIDE, not 2px out — the offset never reached the mark. Read what a
                 rejected attempt actually rendered before writing the rejection down.
                 The PADDING is also the hit area — 21px around a 9px mark, now running
                 inward from (-2, -2). 44px is not available in the corner of a 200px pane,
                 so this is the honest maximum; 16 (the first version) was a mouse-only
                 gesture wearing `touch-action: none`. */
              position: 'absolute', right: -2, bottom: -2, padding: '12px 0 0 12px',
              display: 'inline-flex', cursor: 'nwse-resize',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              /* ONE TONE, AND IT IS THE GRAB'S TONE. This span passed `color: 'inherit'`
                 down to the `Grip`, which overwrote `Grip`'s own `--bark-400` with the
                 PANE'S TEXT COLOUR — so the corner drew in near-black while the header's
                 dots drew in bark-400. That, and not ink density, is why the resize mark
                 "looks darker than the grabbable one" (owner, twice: 2026-08-21 and again
                 on 21c). An override defeating a component's own token is invisible in the
                 source of either file; it only shows up in the pixels. The colour is set
                 here AS WELL as inside `Grip`, so a future `inherit` lands on the right tone
                 instead of on the text ramp. It measures 2.35:1 on paper, under WCAG
                 1.4.11's 3:1, as a considered exception: the cursor, a 21px target and the
                 pane's frame all carry the affordance too. */
              color: 'var(--bark-400)',
            }}>
            <Grip variant="corner" />
          </span>
        ) : null}
      </PaneFrameContext.Provider>
    </Frame>
  )
}
