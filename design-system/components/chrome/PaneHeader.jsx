import React from 'react'
import { IconButton, usePresence } from './IconButton.jsx'
import { Grip } from './Grip.jsx'

/** THE PANE'S FRAME, handed down rather than found. `Pane` puts a ref to its frame in
 *  here, so this header knows which element to watch for the pointer WITHOUT walking the
 *  DOM. It used to reach `parentElement`, which made "PaneHeader must be a direct child
 *  of the frame" a rule a caller could break silently — a wrapper div between the two
 *  scoped the reveal to the header strip, so the ✕ simply never appeared and nothing
 *  said why. With the context there is no rule left: nest it as deep as you like inside
 *  a `Pane`. The `parentElement` walk survives as the fallback for a pane composed by
 *  hand, where it is still the right answer and still needs the header to be a direct
 *  child. */
export const PaneFrameContext = React.createContext(null)

/** Every instrument pane wears the same hat: just its title, sitting ON the
 *  pane's own hairline border like a legend — the border is the frame and the
 *  title is part of it. A pane carries NO subtitle or description line.
 *  `variant="bar"` is the older filled title row.
 *
 *  `grabbable` makes the title a drag handle. THE HEADER OWNS THE AFFORDANCE, THE HOST
 *  OWNS THE POSITION: cursor, touch-action, text-selection and the grabbing state are
 *  here, because those are what a hand-written copy forgets; where the thing ends up is
 *  the host's, because only the host knows its coordinate space, its bounds and its
 *  z-order. So this fires `onGrabStart` and stops — it does NOT capture the pointer or
 *  listen for move/up, leaving the host's existing gesture loop untouched. Added
 *  2026-08-18 for the app's floating panel, which hand-wrote this whole hat to keep its
 *  drag and drifted the legend padding while it was there.
 *
 *  A GRABBABLE TITLE WEARS A GRIP, because a cursor is feedback and not an affordance: it
 *  arrives only once you are already hovering the exact strip, so a draggable pane and a
 *  fixed one looked identical at rest and you had to suspect the drag to discover it
 *  (owner, 2026-08-21, reading the chrome card). Four dots in a square, AFTER the title,
 *  inside the same span that carries the grab — so the mark is inside the hit area it
 *  advertises rather than beside it. Both of those were corrections the same day: a 2×3
 *  rectangle is 6×10 against an 11px legend and competes with the title, and a mark placed
 *  BEFORE the title reads as a bullet on the pane's name rather than as a handle.
 *
 *  ONE TONE, NO HOVER STEP. `--bark-400` — `Grip`'s own default, below the text ramp on
 *  purpose — always. It briefly darkened to `--text-1` on the presence clock; the owner cut
 *  that the same day, and rightly — the cursor already answers the hover, so the colour step
 *  was the mark asking to be noticed twice. It also never FADES: `opacity` on a grip read as
 *  a smudge (1.80:1), whereas a lower tone is a chosen colour rather than a half-erased one. */
/** WHERE THE LEGEND'S FIRST LETTER SITS, measured from the frame's outer edge: the legend row
 *  is placed at 16 and the title span pads 5, so 21. DERIVED, not chosen — change either of
 *  those and this must follow. Published (2026-09-04, owner) so a body can put its own text on
 *  the same line: `paddingLeft: LEGEND_INSET` aligns "During class" under "notes". The old
 *  bodies sat at 13–14, a 7px near-miss that read as neither a step nor an alignment. */
export const LEGEND_INSET = 21
/** HOW TALL THE LEGEND ROW IS — 11, the height of the strip the title straddles the frame's top
 *  edge in. Published because `Pane`'s first-line numbers are derived from it. */
export const LEGEND_ROW = 11

export function PaneHeader({ title, glyph, onClose, actions, tally, variant = 'legend', legendBg = 'var(--surface-canopy)', frameBg, grabbable = false, onGrabStart }) {
  // The ✕ keeps the scrollbar's manners: absent while the pane is at rest,
  // present the moment the pointer (or the keyboard) is inside it. Its notch in
  // the frame fades WITH it, so a dormant pane wears an unbroken border rather
  // than a hole where a control used to be.
  const rootRef = React.useRef(null)
  // `grabbing` only swaps the cursor. It clears on the WINDOW rather than on this
  // element because the pointer is somewhere else by the time the drag ends — on a
  // pointerup here the cursor would stay `grabbing` for as long as the panel sat still.
  const [grabbing, setGrabbing] = React.useState(false)
  React.useEffect(() => {
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
  const grab = grabbable ? {
    cursor: grabbing ? 'grabbing' : 'grab',
    touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
  } : null
  const onGrabDown = grabbable ? (e) => { setGrabbing(true); if (onGrabStart) onGrabStart(e) } : undefined
  // A STABLE HOOK FOR WHOEVER HAS TO FIND THIS HANDLE. `data-grab` is the same attribute
  // VersionedGroup's card puts on its own grab surface, so one selector finds every drag
  // handle in the system. It hands over an IDENTIFIER, not behaviour — which is why it is
  // not the `titleProps` spread that was refused: nothing about the cursor, touch-action or
  // text-selection becomes the caller's. Asked for by the app 2026-08-19: adopting this hat
  // cost their interaction driver `aria-label="floating-panel-handle"`, and it fell back to
  // finding the title BY TEXT — which works and breaks the next time a title is re-worded.
  const grabAttr = grabbable ? { 'data-grab': '' } : null
  // one clock for everything that recedes, owned by IconButton.jsx. Prefer the frame
  // `Pane` handed down; fall back to walking up one level, for a hand-composed pane.
  const frame = React.useContext(PaneFrameContext)
  const live = usePresence(rootRef, {
    resolve: () => (frame && frame.current) || (rootRef.current && rootRef.current.parentElement),
  })
  if (variant === 'legend') {
    // The title is transparent: only the 1px border LINE is masked behind it, so
    // the frame reads as interrupted rather than as a filled chip sitting on it.
    // The row is inset by the pane's corner radius on the trailing side so the
    // ✕'s notch stops where the corner arc begins — a straight 2px mask cannot
    // erase a curve, so a notch that reaches into the arc leaves a stub of border
    // beside the button. That inset is the hard limit on how far right the ✕ can
    // sit; it is pushed out the last 2px by unbalancing its own padding, and the
    // notch's left edge moves with it so the gap in the frame stays even on both
    // sides of the button rather than trailing off to its left.
    /* THE MASK IS TWO 1px STRIPS, NOT ONE OF 2px, and the split is the frame's own top
       edge. The row is centred on that edge, so the upper pixel covers the border line
       (over the DESK, hence `legendBg`) and the lower pixel covers the frame's fill. One
       strip of `legendBg` therefore painted desk colour over the frame for its lower half
       — invisible while every frame was paper on a canopy desk, and a 1px warm smear the
       width of the title the moment `Pane` grew a `face` (owner, 2026-08-22, asking what a
       coloured frame would do to the title; measured at 8× in
       `guidelines/pane-content-face-2026-08-22.html`). `frameBg` defaults to paper so a
       hand-composed pane is unchanged. */
    const cutUp = { position: 'absolute', left: 0, right: 0, top: 'calc(50% - 1px)', height: 1, background: legendBg, zIndex: 0 }
    const cutDown = { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: frameBg || 'var(--surface-paper)', zIndex: 0 }
    const Cut = ({ left = 0 }) => (
      <><span style={{ ...cutUp, left }} /><span style={{ ...cutDown, left }} /></>
    )
    const over = { position: 'relative', zIndex: 1 }
    return (
      <div ref={rootRef} style={{ position: 'relative', flexShrink: 0, height: LEGEND_ROW }}>
        <div style={{
          position: 'absolute', top: 0, left: 16, right: 20, zIndex: 2,
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', pointerEvents: 'none',
        }}>
          <span onPointerDown={onGrabDown} {...grabAttr} style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline', gap: grabbable ? 5 : 0, minWidth: 0, padding: '0 5px', pointerEvents: 'auto', ...grab }}>
            <Cut />
            <span style={{
              ...over,
              transform: 'translateY(-1px)',
              fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)',
              color: 'var(--text-1)', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{glyph ? glyph + ' ' : ''}{title}</span>
            {grabbable ? (
              <Grip style={{ ...over, alignSelf: 'center' }} />
            ) : null}
          </span>
          <span style={{ flex: 1 }} />
          {/* THE PANE'S TALLY ON ITS OWN FRAME, right end (OB-233 D1, owner 2026-09-27: "20 nodes ·
              31 relations" on the map). A FACT ABOUT THE PANE'S CONTENTS, NOT A CONTROL, so it is not
              `actions`: that slot is for IconButtons and says so. It rests at `--text-3` and never
              recedes — a count you have to hover to read is not a count. It sits BEFORE the actions
              and the ✕, so a pane that has both reads count, then controls, outward. */}
          {tally ? (
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: '0 5px', flexShrink: 0, pointerEvents: 'auto' }}>
              <Cut />
              <span style={{
                ...over, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', lineHeight: 1,
                fontVariantNumeric: 'var(--tnum)', color: 'var(--text-3)', whiteSpace: 'nowrap',
              }}>{tally}</span>
            </span>
          ) : null}
          {actions ? (
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 7px', pointerEvents: 'auto' }}>
              <Cut />
              <span style={{ ...over, display: 'inline-flex', alignItems: 'center', gap: 6, maxHeight: 18, overflow: 'hidden' }}>{actions}</span>
            </span>
          ) : null}
          {onClose ? (
            <span style={{
              position: 'relative', padding: '0 1px 0 5px', flexShrink: 0, display: 'inline-flex',
              opacity: live ? 1 : 0, pointerEvents: live ? 'auto' : 'none',
              transition: 'opacity var(--dur-hover) var(--ease-soft)',
            }}>
              <Cut left={4} />
              <IconButton title="close" label="close" onClick={onClose} reveal={live}
                style={{ position: 'relative', zIndex: 1 }} />
            </span>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <header style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      minHeight: 'var(--pane-header-h)', padding: '7px var(--pane-pad-x)',
      /* the bar takes the frame's face too, or a faced pane wears a paper hat */
      borderBottom: '1px solid var(--border-hair)', background: frameBg || 'var(--surface-paper)',
      borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
    }}>
      <span onPointerDown={onGrabDown} {...grabAttr} style={{
        display: 'inline-flex', alignItems: 'center', gap: grabbable ? 6 : 0,
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)',
        color: 'var(--text-1)', whiteSpace: 'nowrap', flexShrink: 0, ...grab,
      }}><span>{glyph ? glyph + ' ' : ''}{title}</span>{grabbable ? <Grip /> : null}</span>
      <span style={{ flex: 1 }} />
      {tally ? <span style={{ fontSize: 'var(--fs-micro)', fontVariantNumeric: 'var(--tnum)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{tally}</span> : null}
      {actions}
      {onClose ? (
        <IconButton title="close" label="close" onClick={onClose} size={24} />
      ) : null}
    </header>
  )
}
