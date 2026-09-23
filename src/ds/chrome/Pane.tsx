import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ElementType, PointerEvent, ReactNode, Ref, RefObject } from 'react'
import { PaneHeader, PaneFrameContext } from './PaneHeader'
import { Grip } from './Grip'

/** How far a scrolling body holds off the pane's edge, so the scrollbar's end
 *  arrows clear the `--radius-lg` corners instead of being clipped by them. One
 *  inset serves both axes AND BOTH ENDS — a scroller reserves an arrow square at
 *  each end of its gutter, and a pane has a rounded corner at each end of its
 *  right edge. It was bottom-only until 2026-08-17f, which left the top arrow
 *  inside the top corner's arc: total overlap in a pane with no header (the
 *  scroller starts 1px down against a 20px arc), ~2px in one with a legend, whose
 *  11px hat is not enough on its own. Insetting from the header rather than
 *  computing `radius − headerHeight` keeps it one number and stops the two
 *  coupling.
 *
 *  Exported for the rare pane that builds its own body (`scroll="none"`), so the
 *  number still lives in exactly one place. Prefer `PaneScroller`, which applies
 *  it for you. */
export const SCROLLER_INSET = 12

/** THE FIRST ROW'S OWN TOP PADDING, when that row sits directly under the legend in a
 *  `scroll="none"` body with no margin — the pad that puts a pane's first line of text on
 *  the shared `FIRST_LINE` (25) below the frame's top edge, so panes docked side by side
 *  read level (DS OB-249, #358).
 *
 *  ONLY THIS ONE CONSTANT IS HERE SO FAR: `RailFrame` imports it for the left rail's head,
 *  which opens its pane and must sit on that line (#340). OB-249's other two exports
 *  (`FIRST_LINE` 25 and `FIRST_SCROLL_PAD` 2, for a first row inside a scrolling body),
 *  `PaneHeader`'s `LEGEND_ROW`, `DocHeader`'s pad and the host pads are #358's — do not
 *  restate any of them from here. */
export const FIRST_ROW_PAD = 14

export interface PaneScrollerProps {
  /** which axis scrolls; the other is hidden. Default `y` */
  axis?: 'y' | 'x' | 'both'
  /** the caller's padding and gaps. Not the inset or the overflow: those are the
   *  component's */
  style?: CSSProperties
  /** ref to the scrolling element, for scroll restoration and the like */
  forwardRef?: Ref<HTMLDivElement>
  /** the column's content */
  children?: ReactNode
  [key: string]: unknown
}

/** ONE SCROLLING COLUMN of a pane's body, for the `scroll="none"` case — a body
 *  split into columns that scroll separately, which is the only reason a caller
 *  ever owns the body. It carries the inset, so "a `none` body that scrolls MUST
 *  apply SCROLLER_INSET itself" stops being something to remember. `Pane`'s own
 *  body IS this component, so there is one implementation rather than two that can
 *  drift.
 *
 *  A fixed-width scrolling column passes `flex: 'none'` with its width in `style`,
 *  since this sets `flex: 1`. Extra props (a `data-*` hook, `aria-label`) pass
 *  through untouched, same as the DS's own `...rest` spread.
 *
 *  Typed port of the DS Pane.jsx (contract: Pane.d.ts). */
export function PaneScroller({ axis = 'y', style, forwardRef, children, ...rest }: PaneScrollerProps) {
  return (
    <div
      ref={forwardRef}
      data-pane-body="scroller"
      {...rest}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: axis === 'x' ? 'hidden' : 'auto',
        overflowX: axis === 'y' ? 'hidden' : 'auto',
        /* both ends: not a radius on the scroller — the pane's own paper fills the strip */
        marginTop: SCROLLER_INSET,
        marginBottom: SCROLLER_INSET,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const CANVAS_FACE: Record<string, string> = { sunken: 'var(--surface-sunken)', paper: 'var(--surface-paper)', none: 'transparent' }

/** THE NESTED-RADIUS RULE, MEASURED RATHER THAN ASSUMED. A box that fills a rounded box
 *  cannot repeat its radius: the child sits some distance in, and at that depth the
 *  parent's arc has already turned, so an equal radius curves away from the parent's now
 *  straight edge and leaves a crescent of the parent showing. A canvas 12px below a 20px
 *  frame with a 20px top radius shows two of them, and `--sink-1`'s 1px inner ring traces
 *  the lot — which reads as a grey outline floating inside the body.
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
 *  that can change it never runs again. Mutations are committed before layout effects, so
 *  the DOM is reliable when a ref is not: `closest('[data-pane-frame]')`, then the nearest
 *  rounded ancestor, which also makes this work inside a frame composed by hand. */
function paneFrame(el: HTMLElement): HTMLElement | null {
  const marked = el.closest('[data-pane-frame]')
  if (marked) return marked as HTMLElement
  let n: HTMLElement | null = el.parentElement
  for (let i = 0; n && i < 5; n = n.parentElement, i++) {
    if ((parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0) > 0) return n
  }
  return null
}
function useNestedRadius(ref: RefObject<HTMLElement | null>, active: boolean): string | null {
  const [r, setR] = useState<string | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const frame = el && paneFrame(el)
    // a live DOM measurement, not derivable state: useLayoutEffect measuring
    // the frame and deriving the nested radius before paint is the pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!active || !el || !frame) { setR(null); return }
    const f = frame.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const fs = getComputedStyle(frame)
    const R = { tl: parseFloat(fs.borderTopLeftRadius) || 0, tr: parseFloat(fs.borderTopRightRadius) || 0, br: parseFloat(fs.borderBottomRightRadius) || 0, bl: parseFloat(fs.borderBottomLeftRadius) || 0 }
    const top = b.top - f.top, bottom = f.bottom - b.bottom
    const left = b.left - f.left, right = f.right - b.right
    const nest = (radius: number, a: number, c: number) => Math.max(0, radius - Math.max(a, c))
    setR([nest(R.tl, top, left), nest(R.tr, top, right), nest(R.br, bottom, right), nest(R.bl, bottom, left)]
      .map((n) => n + 'px').join(' '))
  }, [ref, active])
  return r
}

export interface PaneCanvasProps {
  /** `sunken` (default) for a recessed canvas, `paper` for one flush with the pane, `none`
   *  for a canvas that draws its own field. Never a raw colour — a canvas needing
   *  something else is asking for a token */
  face?: 'sunken' | 'paper' | 'none'
  /** make it a WELL rather than a lining: held `SCROLLER_INSET` off every edge at
   *  `--radius-lg`, with `--sink-1`. That ring belongs here and only here — a ring says
   *  "this is a distinct object", and a lining is not one, so the bleed form (default)
   *  takes the face and no ring. Reach for `inset` when the canvas is one panel among
   *  several; leave it off when the canvas IS the pane's content and its nodes are meant
   *  to be cropped at the pane's own edge */
  inset?: boolean
  /** the caller's padding and gaps. Not the overflow, the radius or the position */
  style?: CSSProperties
  forwardRef?: Ref<HTMLDivElement>
  children?: ReactNode
}

/** THE OTHER SHAPE A PANE BODY CAN BE, and the reason a clip ever belongs in a pane: a
 *  CANVAS whose content must be cropped — absolutely-positioned nodes that can run past
 *  the pane's edge and must be cut by the curve rather than paint over the frame.
 *
 *  A clip is only fatal when it wraps a SCROLLING element (the arc then has a scrollbar
 *  gutter to bite) or traps a menu the frame's `overflow: visible` was meant to release.
 *  **A scrolling body is `PaneScroller`, a cropping body is `PaneCanvas`, and only the
 *  second one clips.**
 *
 *  It rounds each corner to the frame's radius LESS its own inset from that corner — see
 *  `useNestedRadius` above; repeating the frame's radius is what leaves a crescent of
 *  paper inside the body. `inset` makes it a WELL instead: held `SCROLLER_INSET` off every
 *  edge, `--radius-lg`, and `--sink-1`, which is where that ring belongs — a ring says
 *  "this is a distinct object", and a lining is not one, which is why the bleed form takes
 *  the face and no ring. `position: relative` either way, so the canvas's absolute
 *  children measure against it.
 *
 *  Typed port of the DS Pane.jsx (contract: Pane.d.ts). */
export function PaneCanvas({ face = 'sunken', inset = false, style, forwardRef, children, ...rest }: PaneCanvasProps & Record<string, unknown>) {
  const own = useRef<HTMLDivElement | null>(null)
  const radius = useNestedRadius(own, !inset)
  const ref = useMemo(() => setRefs(own, forwardRef), [forwardRef])
  return (
    <div
      ref={ref}
      data-pane-body="canvas"
      {...rest}
      style={{
        flex: 1, minHeight: 0, position: 'relative',
        overflow: 'hidden',
        borderRadius: inset ? 'var(--radius-lg)' : (radius || 'var(--radius-lg)'),
        margin: inset ? SCROLLER_INSET : 0,
        background: CANVAS_FACE[face] || CANVAS_FACE.sunken,
        boxShadow: inset && face === 'sunken' ? 'var(--sink-1)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const AUDITED = new WeakSet<HTMLElement>()
const opaque = (c: string) => !!c && c !== 'transparent' && !/,\s*0\s*\)$/.test(c)
const scrolls = (el: HTMLElement) => {
  const s = getComputedStyle(el)
  return /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflowX)
}

/** WCAG relative luminance of one resolved sRGB channel (0-255) */
const linearOf = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
/** parses the one shape `getComputedStyle` ever returns a resolved colour in —
 *  `rgb(...)` / `rgba(...)` — regardless of how the token itself was authored
 *  (hex, rgb, a name); null for anything the browser didn't resolve to a colour */
function rgbOf(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
/** WCAG contrast ratio between two resolved colours: 1 (identical) to 21 (max).
 *  Null when either failed to parse — an unresolvable colour warns about nothing,
 *  rather than reporting a false 1:1. */
function contrastOf(a: string, b: string): number | null {
  const ca = rgbOf(a), cb = rgbOf(b)
  if (!ca || !cb) return null
  const la = 0.2126 * linearOf(ca[0]) + 0.7152 * linearOf(ca[1]) + 0.0722 * linearOf(ca[2])
  const lb = 0.2126 * linearOf(cb[0]) + 0.7152 * linearOf(cb[1]) + 0.0722 * linearOf(cb[2])
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
/** resolves a token to its computed colour IN THE FRAME'S OWN CASCADE, via a
 *  throwaway probe element. `getComputedStyle(frame).getPropertyValue('--text-1')`
 *  is not the same check: a custom property's computed value is not the real
 *  property resolution `color` gets, and `--text-1` is itself `var(--bark-800)` —
 *  one more hop a raw property-value read is not guaranteed to have taken. `color`
 *  always resolves fully and always normalizes to `rgb()`/`rgba()`, on any chain. */
function resolveColor(scope: HTMLElement, token: string): string {
  const probe = document.createElement('span')
  probe.style.color = token
  scope.appendChild(probe)
  const c = getComputedStyle(probe).color
  scope.removeChild(probe)
  return c
}

/** WHICH ELEMENTS COUNT AS "the body" for the face check — the body box, its direct
 *  children, and then the single-child WRAPPER CHAIN below it, stopping at the first
 *  element that scrolls (inclusive) or crops. Depth matters, and a fixed one is wrong in
 *  both directions: check only the body and its children and you miss the common shape —
 *  a caller's painted root inside their own wrapper, one level too deep; walk the whole
 *  subtree and you flag every legitimately-painted well, card and chip INSIDE a scroller,
 *  which are content, not the body's face. A wrapper is single-child by definition, and
 *  content begins at the scroller. */
function bodyChrome(body: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [body]
  if (scrolls(body)) return out
  out.push(...(Array.from(body.children) as HTMLElement[]))
  let el: HTMLElement | null = body
  let guard = 0
  while (el && guard++ < 6) {
    if (el.children.length !== 1) break
    el = el.children[0] as HTMLElement
    if (out.indexOf(el) < 0) out.push(el)
    if (scrolls(el) || el.dataset.paneBody === 'canvas') break
  }
  return out
}

/** THE ONE RULE THAT CANNOT BE MADE STRUCTURAL, MADE LOUD INSTEAD. A caller's own root
 *  element is beyond any component's reach: nothing `Pane` renders can stop an
 *  instrument painting itself its own background, and that failure is silent — it looks
 *  like a pane, just the wrong colour, with two square notches where the rounded top
 *  should be. So `Pane` reads its body once on mount and says so in the console, naming
 *  the element.
 *
 *  Three checks, all of them faults this system has actually shipped:
 *   - the FRAME's own face (OB-066's `Pane.face`, a free string — nothing stops it landing
 *     somewhere the legend title can't be read) against `--text-1`, under 4.5:1 for the
 *     11px semibold title;
 *   - a body element with an opaque background (`PaneCanvas` is exempt — its face is the
 *     canvas's own surface — and so, now, is a body face that resolves to the FRAME's own:
 *     `face` exists precisely so a host can paint content that reaches the frame on
 *     purpose, and that is not the fault this check exists to catch);
 *   - a rounded clipping ancestor between a scrolling element and the frame, which is the
 *     configuration that bites the scrollbar's gutter.
 *  Pass `audit={false}` to silence it; it costs one pass per pane, once. */
/** A RULE IS NOT A FACE (OB-141). A 1px child painted with a border colour is a hairline
 *  divider, and the face check below used to call it a face and print the notch warning on
 *  every mount of a correctly-built pane — the DS's own quick-actions deck puts one between its
 *  two tile groups. Nothing 1px thick can bite a 20px corner arc: the fault the check exists
 *  for is a WRAPPER, which by definition has the body's own extent. So thickness decides it.
 *
 *  Exported because vitest runs with no DOM and cannot mount a pane: this is the one line of
 *  the audit that carries a threshold, and the threshold is what the unit test pins. The DS's
 *  `.jsx` reads the height alone; OB-141's text says height OR width, and a 1px vertical rule
 *  is the same case turned sideways, so both are read here. Reported on the receipt. */
export function isHairlineRule(box: { width: number; height: number }): boolean {
  return box.height <= 1 || box.width <= 1
}

function auditBody(frame: HTMLElement | null, body: HTMLElement | null) {
  if (!frame || !body || AUDITED.has(frame)) return
  AUDITED.add(frame)
  const warn = (msg: string, el: HTMLElement) => console.warn('[Pane] ' + msg, el)

  const frameBg = getComputedStyle(frame).backgroundColor
  const ratio = contrastOf(frameBg, resolveColor(frame, 'var(--text-1)'))
  if (ratio !== null && ratio < 4.5) {
    warn(`the frame's face (${frameBg}) contrasts ${ratio.toFixed(2)}:1 against --text-1 — `
      + 'below the 4.5:1 the 11px semibold legend title needs. Not refused, just named: a '
      + 'dark face is a legitimate design, and this is the one place that gets checked.', frame)
  }

  for (const el of bodyChrome(body)) {
    if (el.dataset.paneBody === 'canvas') continue
    if (isHairlineRule(el.getBoundingClientRect())) continue // a divider, not a face — see isHairlineRule
    const bg = getComputedStyle(el).backgroundColor
    if (bg === frameBg) continue // matches the frame's own face — a deliberate face, not the fault
    if (opaque(bg)) {
      warn(`the body paints its own background (${bg}). A pane body shows the frame's own face `
        + "through it; a body with a face of its own (that isn't the frame's) starts inside the "
        + '20px corner arc with square corners and bites two notches out of the pane\'s rounded '
        + 'top. Delete the face — or if this is a canvas whose content must be cropped, render '
        + 'PaneCanvas.', el)
    }
  }
  /* bounded on purpose: a canvas pane can hold thousands of nodes, and this is a
     mount-time courtesy, not a validator. The fault it looks for is always near the top
     of the body — it is a wrapper, by definition. */
  const nodes = Array.from(body.querySelectorAll('*')).slice(0, 300) as HTMLElement[]
  for (const el of nodes) {
    if (!scrolls(el)) continue
    for (let n: HTMLElement | null = el.parentElement; n && n !== frame.parentElement; n = n.parentElement) {
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

const setRefs = <T,>(...refs: (Ref<T> | undefined)[]) => (el: T | null) => refs.forEach((r) => {
  if (!r) return
  if (typeof r === 'function') r(el)
  else (r as { current: T | null }).current = el
})

export interface PaneProps {
  /** the pane's name. A pane carries a title and nothing else: no subtitle, no
   *  description, no contract line */
  title: string
  /** an optional Unicode mark from the house set */
  glyph?: string
  /** shows the ✕ on the frame. It arrives with the pointer and recedes on the
   *  scrollbar's clock */
  onClose?: () => void
  /** pane-scoped controls beside the title. The legend slot is 18px tall — icon-height
   *  only, and built from `IconButton` rather than by hand */
  actions?: ReactNode
  /** THE PANE'S OWN ACTIONS, docked between the header and the scrolling body — pass a
   *  `PaneActionBar`. Never pass one as a plain `children` element instead: this slot
   *  clips the bar's top corners to the frame's own arc (the same fix `PaneCanvas`
   *  uses), which a raw child sitting inside the scroller cannot get — it paints its
   *  opaque face square, inside the 20px radius, and bites two notches out of the
   *  rounded top. */
  actionBar?: ReactNode
  /** THE FRAME'S OWN COLOUR — typed `string`, not a union: it is not this system's to
   *  name. A data-driven host (the map's water) picks its own at runtime, per pane;
   *  every other caller leaves this out and gets the default. Painted on the frame,
   *  never the body: a body element is still expected to take no background of its
   *  own, UNLESS it happens to equal this exact colour, which `auditBody` now reads
   *  as a deliberate match rather than the fault it exists to catch. Forwarded to
   *  `PaneHeader` as `frameBg`, so the legend's border-mask keeps agreeing with what
   *  is actually behind it. Defaults to `--surface-paper`. */
  face?: string
  /** the colour the legend masks the border with; defaults to the desk. Pass the real
   *  surface if a pane ever sits on something other than `--surface-canopy` */
  legendBg?: string
  /** `legend` (default) or the older filled `bar` title row */
  variant?: 'legend' | 'bar'
  /** THE TITLE BECOMES A DRAG HANDLE. Passed straight through to `PaneHeader`, which
   *  supplies the grab cursor, `touch-action` and `user-select` and clears the grabbing
   *  state on the window; the host keeps the position, because a component that computes
   *  coordinates is the wrong shape. A floating pane is this, not a hand-written frame. */
  grabbable?: boolean
  /** the pointerdown that begins the drag. Only fires when `grabbable`. Start your gesture
   *  here; nothing here captures the pointer or sets a position */
  onGrabStart?: (e: PointerEvent<HTMLElement>) => void
  /** show the resize corner — a `Grip variant="corner"` (three hairlines) in the frame's
   *  bottom-right, with `nwse-resize`, `touch-action: none` and text-selection off. It sits
   *  ON THE FRAME, outside the body box, so a scrolling body cannot scroll its own handle
   *  away and a `PaneCanvas` cannot clip it. Its hit area is 21px around the 9px mark,
   *  running inward from the corner. Carries `role="separator"` and
   *  `aria-label="resize pane"`; `data-resize` is a stable hook for an interaction driver,
   *  the sibling of the header's `data-grab`.
   *
   *  As with the grab, the pane owns the affordance and you own the geometry: nothing here
   *  captures the pointer, sets a size or enforces a minimum, because only the host knows
   *  its bounds and what else is on the board. */
  resizable?: boolean
  /** the pointerdown that begins the resize. Only fires when `resizable`. Read the frame's
   *  rect here and run your own move/up loop; the corner only swaps its cursor */
  onResizeStart?: (e: PointerEvent<HTMLElement>) => void
  /** which axis the body scrolls, and WHICH OF THE TWO SHAPES A BODY CAN BE.
   *  `y` / `x` / `both`: the pane's body is a `PaneScroller` and this component owns it.
   *  `none`: the body's CONTENTS come back to the caller — for a body split into columns
   *  that scroll separately, or one that is a canvas. The body BOX is still this
   *  component's: a transparent flex column under the hat, so a child sized
   *  `height: 100%` measures the body and not the whole frame. Wrap each scrolling part
   *  in `PaneScroller` (it carries the inset) and each cropping part in `PaneCanvas`; a
   *  raw `overflow: auto` has its end arrow clipped by the corner, and a raw
   *  `overflow: hidden` + radius wrapper is the one clip a pane must never have. */
  scroll?: 'y' | 'x' | 'both' | 'none'
  /** the frame element; `section` by default, `aside` for a palette or sidebar */
  as?: ElementType
  /** merged into the frame — for the caller's own SIZE and place in its parent's flex
   *  (`flex: '0 0 var(--tree-w)'`, a fixed height). Not for the surface, the radius or
   *  the border: those are the pane's */
  style?: CSSProperties
  /** merged into the body — padding, and gap for a body that is itself a flex column.
   *  Not `background`, and not `marginBottom`. Under `scroll="none"` it lands on the body
   *  BOX: pass `{ flexDirection: 'row' }` for columns side by side, or `{ flex: 'none' }`
   *  for a strip that sizes to its own content */
  bodyStyle?: CSSProperties
  /** the scrolling element under `scroll="y"|"x"|"both"`, the body box under `none` */
  bodyRef?: Ref<HTMLDivElement>
  /** THE ONE RULE THAT CANNOT BE MADE STRUCTURAL, MADE LOUD INSTEAD. Default `true`: on
   *  mount the pane reads its own body once and `console.warn`s, naming the element, if
   *  the frame's own face contrasts under 4.5:1 against `--text-1` (the legend title),
   *  if a body element paints an opaque background that isn't the frame's own face
   *  (`PaneCanvas` excepted — its face is the canvas's own surface), or if a rounded
   *  clipping ancestor wraps a scrolling element. Set `false` to silence; it costs one
   *  bounded pass per pane, once. */
  audit?: boolean
  children?: ReactNode
}

/** The instrument pane, whole: the frame, its hat, and the body between them.
 *
 *  It exists because `PaneHeader` alone could not enforce the three rules its own
 *  geometry depends on — the legend is 11px tall against a 20px corner arc, so the
 *  box around it is not incidental. Every caller was rebuilding that box, and two of
 *  them got it wrong the same way: a body painting its own background starts INSIDE
 *  the corner arc with square corners and bites two square notches out of the pane's
 *  rounded top; a scroller with no inset has an end arrow clipped by the same arc, at
 *  whichever end it was forgotten. Here there is no body div for a caller to give a
 *  background to, and the inset is not optional.
 *
 *  The frame is handed to `PaneHeader` through `PaneFrameContext`, so the header knows
 *  which element to watch for the pointer without walking the DOM. That used to be a
 *  `parentElement` walk, and "PaneHeader must be a direct child" was a rule a wrapper
 *  div could break in silence. Inside a `Pane` there is no such rule any more.
 *
 *  Typed port of the DS Pane.jsx (contract: Pane.d.ts). */
export function Pane({
  title, glyph, onClose, actions, face = 'var(--surface-paper)', legendBg, variant, grabbable, onGrabStart,
  resizable = false, onResizeStart, actionBar,
  scroll = 'y', as, style, bodyStyle, bodyRef, audit = true, children, ...rest
}: PaneProps & Record<string, unknown>) {
  const Frame = (as || 'section') as ElementType
  const frameRef = useRef<HTMLElement | null>(null)
  const bodyEl = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  /* THE SAME NESTED-RADIUS FIX PaneCanvas USES, for a docked bar that sits between the
     header and the scroller. An action bar paints its own opaque face (PaneActionBar,
     --surface-raised) directly under an 11px legend header that hasn't cleared the 20px
     corner arc — without this, its square top corners bite the same two notches out of
     the rounded frame that auditBody warns about for any other opaque body child. */
  const barRadius = useNestedRadius(barRef, !!actionBar)
  useEffect(() => { if (audit) auditBody(frameRef.current, bodyEl.current) }, [audit])
  const bodyElRef = useMemo(() => setRefs(bodyEl, bodyRef), [bodyRef])
  return (
    <Frame
      ref={frameRef}
      data-pane-frame=""
      {...rest}
      style={{
        position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
        minWidth: 0, minHeight: 0,
        background: face,
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-frame)',
        /* visible, not hidden: the ✕'s notch and any menu a body opens have to leave
           the frame — and nothing inside the frame clips either. A clip layer here
           (an `overflow: hidden` + radius div wrapping the body) traps those menus
           again AND bites the scroller's gutter with the corner arc; a body that
           paints no background never needs one. The only pane that legitimately
           clips is one whose CONTENT must be cropped, and that is `PaneCanvas`. */
        overflow: 'visible',
        ...style,
      }}
    >
      <PaneFrameContext.Provider value={frameRef}>
        <PaneHeader
          title={title} glyph={glyph} onClose={onClose} actions={actions}
          variant={variant} legendBg={legendBg} frameBg={face} grabbable={grabbable} onGrabStart={onGrabStart}
        />
        {actionBar ? (
          <div ref={barRef} data-pane-actionbar="" style={{ flexShrink: 0, overflow: 'hidden', borderRadius: barRadius || 0 }}>
            {actionBar}
          </div>
        ) : null}
        {scroll === 'none' ? (
          /* `none` hands the body's CONTENTS back, not the body BOX. The box is still
             ours — a transparent flex column that takes the space under the hat — so a
             child sized `height: 100%` measures the body rather than the whole frame.
             A body that must size to its own content passes `bodyStyle={{ flex: 'none' }}`. */
          <div
            ref={bodyElRef}
            data-pane-body="box"
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0, ...bodyStyle }}
          >
            {children}
          </div>
        ) : (
          <PaneScroller axis={scroll} forwardRef={bodyElRef} style={bodyStyle}>{children}</PaneScroller>
        )}
        {resizable ? (
          /* THE CORNER IS THE PANE'S, NOT THE BODY'S — it sits on the frame, outside the
             body box, so a scrolling body never scrolls its own resize handle away and a
             cropping one never clips it. `nwse-resize` is the cursor; the GESTURE is the
             host's, exactly as with the grab: only the host knows the pane's bounds, its
             minimum size and what else is on the board. `data-resize` is the stable hook
             for an interaction driver, the sibling of the header's `data-grab`. */
          <span
            data-resize=""
            role="separator"
            aria-label="resize pane"
            onPointerDown={onResizeStart}
            style={{
              /* THE MARK SITS OUTSIDE THE ROUNDED CORNER, in the empty notch the curve
                 leaves behind. A `--radius-lg` curve cuts R − R/√2 ≈ 5.86px deep on the
                 diagonal and the 9px triangle is size/√2 ≈ 6.36px deep, so the tip has to
                 clear the box corner by only ~0.51px on the diagonal (≈0.36px per axis) for
                 the mark to be off the arc at all. -2 per axis leaves ~2px of paper between
                 the hypotenuse and the border — a LOOK, not that geometric minimum, since at
                 the minimum the hairlines graze the border. Padding is on the TOP AND LEFT so
                 the 21px hit area still runs inward from the mark. */
              position: 'absolute', right: -2, bottom: -2, padding: '12px 0 0 12px',
              display: 'inline-flex', cursor: 'nwse-resize',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              /* ONE TONE, AND IT IS THE GRAB'S TONE — set here AS WELL AS inside `Grip`, so
                 a future `inherit` lands on the right tone instead of on the text ramp (a
                 `color` passed to `Grip` itself is dropped; see `Grip`'s `ownTone`). */
              color: 'var(--bark-400)',
            }}
          >
            <Grip variant="corner" />
          </span>
        ) : null}
      </PaneFrameContext.Provider>
    </Frame>
  )
}
