import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode, RefObject } from 'react'
import { IconButton, usePresence } from './IconButton'
import { Grip } from './Grip'

/** THE PANE'S FRAME, handed down rather than found. `Pane` puts a ref to its frame
 *  in here, so this header knows which element to watch for the pointer WITHOUT
 *  walking the DOM. It used to reach `parentElement`, which made "PaneHeader must
 *  be a direct child of the frame" a rule a caller could break silently — a wrapper
 *  div between the two scoped the reveal to the header strip, so the close control
 *  simply never appeared and nothing said why. With the context there is no rule
 *  left: nest it as deep as you like inside a `Pane`. The `parentElement` walk
 *  survives as the fallback for a pane composed BY HAND, where it is still the right
 *  answer and still needs the header to be a direct child. */
export const PaneFrameContext = createContext<RefObject<HTMLElement | null> | null>(null)

/** HOW TALL THE LEGEND'S ROW IS, below the frame's top edge — the hat the title straddles the
 *  border with, and the first thing a body is measured from. 11, as it already was: published
 *  (OB-249) so `Pane`'s `FIRST_ROW_PAD` is DERIVED from it (`FIRST_LINE` less this) instead of
 *  typed beside it, and a change here moves every first row with it. */
export const LEGEND_ROW = 11

/** THE TWO NUMBERS THE LEGEND IS DRAWN WITH, named so the inset below can be derived from
 *  them rather than typed beside them: the legend row is placed this far in from the frame,
 *  and the title span pads this much more. Used in the JSX below and nowhere else. */
const LEGEND_ROW_LEFT = 16
const LEGEND_TITLE_PAD = 5

/** WHERE THE LEGEND'S FIRST LETTER SITS, measured from the frame's edge — the row's 16 plus
 *  the title's 5. DERIVED, not chosen: change either constant above and this follows, never
 *  the other way round. Published (OB-143, owner 2026-09-04) so a body can put its own text
 *  on the same line — a host pads its body's LEFT by it, and only the left: the right
 *  padding exists for the scrollbar and is a different number for a different reason. The
 *  old bodies sat at 12–16, a near-miss that read as neither a step nor an alignment. */
export const LEGEND_INSET = LEGEND_ROW_LEFT + LEGEND_TITLE_PAD

/** Every instrument pane wears the same hat: just its title, sitting ON the
 *  pane's own hairline border like a legend — the border is the frame and the
 *  title is part of it. A pane carries NO subtitle or description line.
 *  `variant="bar"` is the older filled title row.
 *
 *  The ✕ keeps the scrollbar's manners: absent while the pane is at rest,
 *  present the moment the pointer (or the keyboard) is inside it, so a dormant
 *  pane wears an unbroken border rather than a hole where a control used to be.
 *  WHAT THE PANE AROUND IT MUST DO — three rules this header's geometry depends on
 *  that no prop can express. PREFER `Pane`, which owns the frame and the body and
 *  makes all three unstateable-wrong; these apply when something composes a frame
 *  by hand. They lived only in the DS readme until 2026-08-17, where a port could
 *  not see them, and all three were missed here:
 *
 *   1. `position: relative`, the `--border-frame` hairline on the pane itself, and
 *      `--radius-lg` (20px) corners. The legend masks the border with a straight 2px
 *      bar, which cannot erase a curve — a tighter radius leaves a stub beside the ✕.
 *      This rule is NOT satisfied by clipping: a frame that is correctly `visible`
 *      with an `overflow: hidden` + radius div immediately inside it has all of the
 *      cost and none of the rule — it re-traps the ✕'s notch and any menu a body
 *      opens, and it bites the scroller's gutter with the corner arc. Delete the
 *      body's background; do not add a clip. The only pane that legitimately clips
 *      is one whose CONTENT must be cropped (`PaneCanvas`), and it rounds all four
 *      corners at `--radius-lg`, never the bottom two alone.
 *   2. THE BODY TAKES NO BACKGROUND OF ITS OWN; the pane's `--surface-paper` shows
 *      through. This header is 11px tall, so a body that paints its own colour starts
 *      INSIDE the 20px corner arc with square corners and bites two square notches out
 *      of the pane's rounded top — worst when that colour is `--surface-canopy`, which
 *      reads as a hole in the sheet.
 *   3. A SCROLLING BODY INSETS ITSELF `SCROLLER_INSET` FROM THE TOP **AND** THE BOTTOM
 *      (`marginTop` and `marginBottom`, not a radius on the scroller), so the
 *      scrollbar's end arrow stays clear of the corner arc at EITHER end instead of
 *      being clipped by it or painting out over it; the pane's own paper fills both
 *      strips. One inset serves both axes and both ends — a scroller reserves an
 *      arrow square at each end of its gutter, and a pane has a rounded corner at
 *      each end of its right edge. Better still, take `PaneScroller`, which applies
 *      both automatically.
 *
 *  A GRABBABLE TITLE WEARS A `Grip`, because a cursor is feedback and not an
 *  affordance: it arrives only once you are already hovering the exact strip, so a
 *  draggable pane and a fixed one otherwise look identical at rest. Four dots in a
 *  square, AFTER the title, inside the same span that carries the grab — so the
 *  mark sits in the hit area it advertises rather than beside it. One flat
 *  `--bark-400`, no hover step: the cursor already answers the hover, and a mark
 *  that also darkens is asking to be noticed twice.
 *
 *  Typed port of the DS PaneHeader.jsx (contract: PaneHeader.d.ts). */
export interface PaneHeaderProps {
  /** lower case, one or two words: "tree", "document", "palette" */
  title: string
  /** an optional Unicode mark from the house set */
  glyph?: string
  onClose?: () => void
  /** pane-scoped controls, rendered on the frame beside the title. The legend slot
   *  is 18px tall — put only icon-height controls here, never a full-height pill, and
   *  build them to the house icon-button recipe: round, transparent, with a **1px
   *  transparent border reserved at rest** so hover cannot move the glyph, then face
   *  → `--surface-hover`, border → `--border-rule`, ink `--text-2` → `--text-1`, and
   *  nothing else. A control on a frame is chrome, never destructive-hued */
  actions?: ReactNode
  /** legend = the title straddles the pane border (default); bar = a filled row */
  variant?: 'legend' | 'bar'
  /** what sits BEHIND the pane, so the legend can mask the border it interrupts.
   *  Only the strip ABOVE the border line — outside the frame, on the desk. The
   *  strip below it is `frameBg`, not this: two different things sit on the two
   *  sides of a 1px line, so one colour masking both was always a latent bug (OB-066)
   *  — invisible only while every frame happened to be `--surface-paper`. */
  legendBg?: string
  /** what the frame itself is painted — `Pane`'s own `face`, forwarded. Masks the
   *  border strip BELOW the line (inside the frame) and, under `variant="bar"`, is
   *  the row's own face. Defaults to `--surface-paper`, matching the frame's own
   *  default. */
  frameBg?: string
  /** makes the title a drag handle. THE HEADER OWNS THE AFFORDANCE, THE HOST OWNS
   *  THE POSITION: the grab cursor, `touch-action`, text-selection and the grabbing
   *  state are here, because those are what a hand-written copy forgets; where the
   *  thing ends up is the host's, because only the host knows its coordinate space,
   *  its bounds and its z-order. It also puts a `Grip` after the title — see above —
   *  and marks the title `data-grab=""`, the stable hook `VersionedGroup`'s own grab
   *  surface already uses, so `[data-grab]` finds every drag handle in the system
   *  instead of an interaction driver matching the title's TEXT. */
  grabbable?: boolean
  /** fires on pointer-down on the title and stops there — this does NOT capture the
   *  pointer or listen for move/up, so an existing gesture loop is left untouched.
   *  Begin your drag here */
  onGrabStart?: (e: PointerEvent<HTMLElement>) => void
}

export function PaneHeader({
  title, glyph, onClose, actions, variant = 'legend',
  legendBg = 'var(--surface-canopy)', frameBg = 'var(--surface-paper)', grabbable = false, onGrabStart,
}: PaneHeaderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  // `grabbing` only swaps the cursor. It clears on the WINDOW rather than on this
  // element, because the pointer is somewhere else by the time the drag ends — on a
  // pointerup here the cursor would stay `grabbing` for as long as the panel sat still.
  const [grabbing, setGrabbing] = useState(false)
  useEffect(() => {
    if (!grabbing) return
    const end = () => setGrabbing(false)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [grabbing])
  // touchAction and userSelect are the two a copy always forgets, and both fail
  // invisibly: without touchAction the browser scrolls instead of dragging on touch,
  // without userSelect a slow grab selects the title text mid-drag.
  const grab: CSSProperties | null = grabbable ? {
    cursor: grabbing ? 'grabbing' : 'grab',
    touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
  } : null
  const onGrabDown = grabbable
    ? (e: PointerEvent<HTMLElement>) => { setGrabbing(true); if (onGrabStart) onGrabStart(e) }
    : undefined
  // A STABLE HOOK FOR WHOEVER HAS TO FIND THIS HANDLE. `data-grab` is the same
  // attribute VersionedGroup's card puts on its own grab surface, so one selector
  // finds every drag handle in the system. It hands over an IDENTIFIER, not
  // behaviour — nothing about the cursor, touch-action or text-selection becomes
  // the caller's.
  const grabAttr = grabbable ? { 'data-grab': '' } : undefined
  // one clock for everything that recedes, owned by IconButton. Prefer the frame
  // `Pane` handed down; fall back to walking up one level, for a hand-composed pane.
  const frame = useContext(PaneFrameContext)
  const live = usePresence(rootRef, {
    resolve: () => frame?.current ?? rootRef.current?.parentElement ?? null,
  })
  if (variant === 'legend') {
    // The title is transparent: only the 1px border LINE is masked behind it, so
    // the frame reads as interrupted rather than as a filled chip sitting on it.
    // The row is inset by the pane's corner radius on the trailing side so the
    // ✕'s notch stops where the corner arc begins — a straight mask cannot erase
    // a curve, so a notch that reaches into the arc leaves a stub of border
    // beside the button.
    //
    // TWO 1px STRIPS, not one 2px strip (OB-066): the line has a different colour
    // on each side. Above it is the desk the pane sits on — `legendBg`. Below it
    // is the frame's own face — `frameBg`. A single `legendBg` strip covering both
    // pixels used to paint the DESK colour one pixel INSIDE the frame — invisible
    // only as long as every frame happened to be `--surface-paper` near enough to
    // the desk's own canopy tone that the seam didn't read; a frame with any other
    // face turns that pixel into a smear the width of the title.
    const cutTop: CSSProperties = { position: 'absolute', left: 0, right: 0, top: 'calc(50% - 1px)', height: 1, background: legendBg, zIndex: 0 }
    const cutBottom: CSSProperties = { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: frameBg, zIndex: 0 }
    const over: CSSProperties = { position: 'relative', zIndex: 1 }
    return (
      <div ref={rootRef} style={{ position: 'relative', flexShrink: 0, height: LEGEND_ROW }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: LEGEND_ROW_LEFT,
            right: 20,
            zIndex: 2,
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            pointerEvents: 'none',
          }}
        >
          <span onPointerDown={onGrabDown} {...grabAttr} style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline', gap: grabbable ? 5 : 0, minWidth: 0, padding: `0 ${LEGEND_TITLE_PAD}px`, pointerEvents: 'auto', ...grab }}>
            <span style={cutTop} />
            <span style={cutBottom} />
            <span
              style={{
                ...over,
                transform: 'translateY(-1px)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--fs-title)',
                fontWeight: 'var(--fw-semibold)',
                color: 'var(--text-1)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {glyph ? glyph + ' ' : ''}
              {title}
            </span>
            {grabbable ? <Grip style={{ ...over, alignSelf: 'center' }} /> : null}
          </span>
          <span style={{ flex: 1 }} />
          {actions ? (
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 7px', pointerEvents: 'auto' }}>
              <span style={cutTop} />
              <span style={cutBottom} />
              <span style={{ ...over, display: 'inline-flex', alignItems: 'center', gap: 6, maxHeight: 18, overflow: 'hidden' }}>{actions}</span>
            </span>
          ) : null}
          {onClose ? (
            <span
              style={{
                position: 'relative',
                padding: '0 1px 0 5px',
                flexShrink: 0,
                display: 'inline-flex',
                opacity: live ? 1 : 0,
                pointerEvents: live ? 'auto' : 'none',
                transition: 'opacity var(--dur-hover) var(--ease-soft)',
              }}
            >
              <span style={{ ...cutTop, left: 4 }} />
              <span style={{ ...cutBottom, left: 4 }} />
              <IconButton title="close" label="close" onClick={onClose} reveal={live} style={over} />
            </span>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        minHeight: 'var(--pane-header-h)',
        padding: '7px var(--pane-pad-x)',
        borderBottom: '1px solid var(--border-hair)',
        background: frameBg,
        borderTopLeftRadius: 'var(--radius-lg)',
        borderTopRightRadius: 'var(--radius-lg)',
      }}
    >
      <span
        onPointerDown={onGrabDown}
        {...grabAttr}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: grabbable ? 6 : 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-title)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--text-1)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          ...grab,
        }}
      >
        <span>{glyph ? glyph + ' ' : ''}{title}</span>
        {grabbable ? <Grip /> : null}
      </span>
      <span style={{ flex: 1 }} />
      {actions}
      {onClose ? <IconButton title="close" label="close" onClick={onClose} size={24} /> : null}
    </header>
  )
}
