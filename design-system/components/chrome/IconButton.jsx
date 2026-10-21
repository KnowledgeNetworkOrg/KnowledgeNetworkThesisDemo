import React from 'react'
import { CloseMark } from './CloseMark.jsx'

/** The system's round icon control: a ✕, a chevron, a small glyph act. One shape and
 *  one set of manners everywhere, in two TONES — chrome for a neutral act (close a
 *  pane, dismiss a menu), danger for a destructive one (delete a node, delete a
 *  version). Standardised 2026-08-17 from five hand-written copies that had drifted —
 *  the fifth being VersionedGroup's own private one, found only when the duplicate name
 *  broke the build.
 *
 *  THE BORDER IS RESERVED AT REST. 1px transparent, always, with `boxSizing:
 *  border-box`, so hovering paints the border in rather than adding it — a border that
 *  appears on hover moves the glyph a pixel and the control twitches under the pointer.
 *  This is the single most-repeated mistake when the recipe is hand-written.
 *
 *  DESTRUCTIVE IS BERRY AT REST. `tone="danger"` inks `--state-danger` before anyone
 *  touches it and hovers within its OWN ramp — face `--state-danger-wash`, border
 *  `--state-danger`, ink `--berry-600`. Never neutral-until-berry: hover in this system
 *  is a one-step wash of an element's own family and never a hue change, and warning a
 *  user only once they are already on the control is warning them too late.
 *
 *  `reveal={false}` is the recede: the control keeps its space (so nothing reflows when
 *  it arrives) but is invisible, untabbable and inert. Every hover-revealed control in
 *  the system uses this rather than unmounting, and they all fade on `--dur-fade`.
 *
 *  THE DEFAULT MARK IS DRAWN, NOT TYPED (2026-09-16, owner: the ✕ read off-centre in its
 *  circle). It was: `placeItems: center` centres the LINE BOX, and a text ✕ has no
 *  descender, so its ink sat ~1.5px high of the button's centre — and U+2715 is outside the
 *  latin subsets we load, so the character came from the platform fallback and the error
 *  differed per machine. `CloseMark` is centred by construction. A text `glyph` still
 *  renders (`+`, `▽`, `⊞` and the rest are still typed) and still leans; each becomes a
 *  drawn mark as it comes up. */
export function IconButton({
  tone = 'chrome', size = 18, glyphSize, reveal = true, reachable = true, glyph,
  title, label, onClick, stopPropagation = true, style, children, disabled = false,
}) {
  const [hot, setHot] = React.useState(false)
  const markSize = glyphSize || (size >= 22 ? 13 : 10)
  const danger = tone === 'danger'
  const shown = reveal !== false
  /* FADED, NOT RECEDED. `reveal={false}` is for a control that isn't relevant right now
     and goes fully invisible + untabbable; `disabled` is for a control that IS relevant
     (the act it names still applies to this pane) but has nothing left to do — "expand
     all" when every stop is already open. That reads as a dimmed glyph, still in place,
     still in tab order (a screen reader should still hear the act and why it's off
     rather than the control silently disappearing), just not clickable or hoverable. */
  /* the two ramps. Rest ink differs by tone; the hover step is one wash of that tone's
     own family in both cases, which is what makes them read as the same control. */
  const restInk = danger ? 'var(--state-danger)' : 'var(--text-2)'
  const hotInk = danger ? 'var(--berry-600)' : 'var(--text-1)'
  const hotFace = danger ? 'var(--state-danger-wash)' : 'var(--surface-hover)'
  const hotEdge = danger ? 'var(--state-danger)' : 'var(--border-rule)'
  /* A HELD EDGE IS FOLDED INTO THE SHORTHAND, never spread after it. `border` below changes with
     `hot`, and when React re-applies a changed shorthand it wipes a separately-set `borderColor`:
     the pencil's editing edge drew at first and vanished the moment the pointer left. Reported
     by the app's port (`receipts/c8fae13.md`, measured there as transparent on all four sides). */
  const { borderColor: heldEdge, ...restStyle } = style || {}
  return (
    <button
      /* EVERY TOOLTIP IN THE SYSTEM GOES THROUGH `wrapTip`, including the short ones. Owner's
         rule, 2026-08-19: the width restriction applies to ALL tooltips, not only names. Wrapping
         here rather than at each call site is what makes that true — a short string comes back
         untouched, so it costs nothing, and there is no judgement left at the call site about
         whether a particular label is "long enough to bother". The one exception this system
         allowed lasted an hour before it produced the exact defect it was excusing.
         `aria-label` keeps the UNFOLDED string: a screen reader reads a line, not a shape. */
      /* `wrapTip` returns `undefined` — not `''` — for an absent title, so a button given only a
         `label` sets no attribute at all. That guard lives in `wrapTip` and not here on purpose;
         see its docblock. */
      type="button" title={wrapTip(title)} aria-label={label || title}
      /* a receded button is invisible but still in the tab order and still answers
         Enter; opacity and pointer-events do not fix that, tabIndex does. `reachable`
         is the same withdrawal for a cluster whose FADE the parent owns — tab order
         only, appearance untouched. */
      disabled={disabled}
      tabIndex={shown && reachable ? 0 : -1}
      onClick={(e) => { if (disabled) return; if (stopPropagation) e.stopPropagation(); onClick && onClick(e) }}
      onMouseEnter={() => !disabled && setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => !disabled && setHot(true)}
      onBlur={() => setHot(false)}
      style={{
        width: size, height: size, padding: 0, flexShrink: 0,
        display: 'grid', placeItems: 'center', boxSizing: 'border-box',
        borderRadius: 'var(--radius-pill)',
        /* reserved at rest — see the note above */
        border: '1px solid ' + (heldEdge || (hot && !disabled ? hotEdge : 'transparent')),
        background: hot && !disabled ? hotFace : 'transparent',
        color: hot && !disabled ? hotInk : restInk,
        /* the glyph is point-sized SEPARATELY where it has to be: a cross puts far
           more ink on the page than a single stroke at the same size, so ✕ sits at 10
           beside – and + at 12. That is optical sizing, not a weight change. The same
           number sizes the drawn `CloseMark`, so the default mark matches the ink the
           text glyph used to draw. */
        fontFamily: 'var(--font-ui)', fontSize: markSize, lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none', WebkitUserSelect: 'none',
        /* the fade step, one number: 0.35 is dim enough to read as "nothing to do here"
           beside a full-ink sibling without dropping under AA for the glyph it still
           has to show at a glance (this is presence, not text, so AA's ratio doesn't
           gate it — but going lower than this stopped reading as a button at all). */
        opacity: !shown ? 0 : disabled ? 0.35 : 1, pointerEvents: !shown ? 'none' : disabled ? 'none' : 'auto',
        transition: 'opacity var(--dur-fade) var(--ease-soft), var(--transition-wash)',
        ...restStyle,
      }}>{children || (glyph === undefined || glyph === null ? <CloseMark size={markSize} /> : glyph)}</button>
  )
}

/** THE RECEDE CLOCK, in ONE place. Everything in this product that appears on hover and
 *  goes away again — the scrollbar, a pane's ✕, a chip's ✕, a group's head controls, a
 *  menu row's ✕ — waits out the SAME grace period, published by `assets/scrollbars.js`
 *  as `window.PKT_SB.LEAVE`. Two controls in one pane receding at two speeds reads as
 *  one of them being broken, and a control that goes the instant the pointer leaves
 *  vanishes under the cursor's heels on the way to it.
 *
 *  `RECEDE_LEAVE_MS` is the fallback for a page that never loaded the script — not a
 *  second opinion about the timing. Read the clock, fall back to this. Four files in the
 *  app open-code `?? 500` today: that is this constant, four times, with nothing keeping
 *  them equal. It is capitalised so it reaches `window.<Namespace>` like SCROLLER_INSET. */
export const RECEDE_LEAVE_MS = 500

export function recedeMs() {
  return (typeof window !== 'undefined' && window.PKT_SB && window.PKT_SB.LEAVE) || RECEDE_LEAVE_MS
}

/** Presence of the pointer OR the keyboard anywhere in `el`, pushed into `set`. Returns
 *  its own teardown, so it drops straight into a `useEffect` where the element is found
 *  by hand. Focus counts: a control reachable only by pointer is not reachable. */
export function subscribePresence(el, set) {
  if (!el) return undefined
  let t
  const on = () => { clearTimeout(t); set(true) }
  const off = () => { clearTimeout(t); t = setTimeout(() => set(false), recedeMs()) }
  el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off)
  el.addEventListener('focusin', on); el.addEventListener('focusout', off)
  return () => {
    clearTimeout(t)
    el.removeEventListener('pointerenter', on); el.removeEventListener('pointerleave', off)
    el.removeEventListener('focusin', on); el.removeEventListener('focusout', off)
  }
}

/** The same thing as a hook, for a control revealed by presence in a CONTAINER — a pane's
 *  ✕, a group's head controls.
 *
 *  Which element to watch, in order: `resolve()` if given (called once, at effect time,
 *  so it can read a context that was empty during render); `{ parent: true }` for the
 *  ref'd node's `parentElement`, for a header rendered BY its container rather than
 *  around it; the ref'd node otherwise. */
export function usePresence(ref, options) {
  const opts = options || {}
  const optsRef = React.useRef(opts)
  optsRef.current = opts
  const [live, setLive] = React.useState(false)
  React.useEffect(() => {
    const o = optsRef.current
    const node = ref && ref.current
    const el = o.resolve ? o.resolve() : (o.parent ? (node && node.parentElement) : node)
    return subscribePresence(el, setLive)
  }, [])
  return live
}

/** The clock as a pair of handlers, for a control revealed by its OWN hover or focus
 *  rather than by presence in a container — a chip's ✕.
 *  `const [shown, show, hide] = useRecede()`, then `reveal={shown}` on the IconButton.
 *
 *  NEVER DRIVE A HOVER WASH FROM THIS, and never share one state between a wash and a
 *  receding control. The two want opposite things: a wash follows the pointer, so it must be
 *  instant in both directions, while a receding control has to wait out the grace period so it
 *  does not vanish under the cursor's heels on the way to it. `VersionedGroup`'s menu row drove
 *  both from one `hot` and stayed lit for the full 500ms after the pointer left — reported as a
 *  delayed hover a day after the CSS transition had been taken off that row, because the
 *  transition was never the big half of it (2026-09-17). Two states, one gesture. */
export function useRecede() {
  const [shown, setShown] = React.useState(false)
  const timer = React.useRef(null)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const show = () => { clearTimeout(timer.current); setShown(true) }
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setShown(false), recedeMs()) }
  return [shown, show, hide]
}

/** A CLIPPED STRING SAYS WHAT IT SAYS, ON HOVER. Owner's rule, 2026-08-19: wherever a "…"
 *  appears, hovering must give the whole text. Seven lines in the system clip — the version
 *  menu's rows, a chip's name, a tree row, a trail chip, an instrument row, a family head, the
 *  header's corpus line — and none of them carried the full string.
 *
 *  It is a HOOK rather than an unconditional `title=`, and the difference is the whole design:
 *  a tooltip that repeats a line you can already read in full is noise on every hover of every
 *  row on a board, and noise trains people to ignore the one that matters. So the title appears
 *  only when the text is actually cut. Measured on pointer entry, not on render: clipping depends
 *  on the laid-out width, which changes with the pane, the sidebar, a resize and the string
 *  itself, and a value read at render is stale by the time it is hovered. It costs one
 *  measurement per hover of an element already under the pointer.
 *
 *  Both axes, because we clip both ways: `text-overflow` on one line (scrollWidth) and a
 *  line-clamped block (scrollHeight). The 1px tolerance is for sub-pixel text metrics, which
 *  report a 0.3px overflow on plenty of lines that are not clipped at all.
 *
 *  `const clip = useClipped(name)`, then spread it on the element that does the clipping:
 *  `<span {...clip} style={{ …, textOverflow: 'ellipsis' }}>{name}</span>`. Spread it on the
 *  element with `overflow: hidden` on it, never on an ancestor — the ancestor is not the box
 *  that overflows, so nothing would ever be reported. */
export function useClipped(text) {
  const ref = React.useRef(null)
  const [cut, setCut] = React.useState(false)
  const onPointerEnter = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    setCut(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
  }, [])
  /* folded into readable lines rather than one screen-wide one — see `wrapTip` */
  return { ref: ref, onPointerEnter: onPointerEnter, title: cut && text != null && text !== '' ? wrapTip(text) : undefined }
}

/** Reachable from the DS window namespace, where a bare lowercase export is NOT — the same reason
 *  `RECEDE_LEAVE_MS` is capitalised and `GroupGeometry` exists. Nothing in the app needs it (a
 *  port imports `useClipped` directly); it is here so a specimen card's staleness guard has a
 *  value it can actually read. A guard that names a lowercase export can never clear, which is
 *  the same trap as one naming a module-level helper. */
/** A TOOLTIP IS NOT A RULER. Owner's ask, 2026-08-19: a native `title` holding a long name draws
 *  one line the width of the screen, which is the hardest possible shape to read — the eye has no
 *  return sweep. The platform gives no styling hook for a native tooltip, and replacing it with a
 *  drawn one would mean a popover that has to escape every stacking context in the app (the
 *  version menu already needs a portal for exactly that) plus its own show delay, hover grace,
 *  edge flipping and focus behaviour — a component's worth of surface for a line of text.
 *  Newlines, though, a native tooltip does honour. So the text is folded into lines of about 44
 *  characters on word boundaries, which is the same measure a paragraph of prose wants and well
 *  inside every platform's tooltip cap.
 *  Anything already shorter than the measure is returned untouched, so a short name still draws
 *  as one line.
 *  AND AN UNBROKEN RUN LONGER THAN THE MEASURE IS BROKEN ANYWAY. The first version left a long
 *  word whole, on the reasoning that a break inside a word misreports the string. Owner-reported
 *  the same day with a screenshot: one 60-character run of letters drew the screen-wide line this
 *  function exists to prevent, so the exception swallowed the rule. It was also the wrong
 *  reasoning — the tooltip shows the same characters either way; only the line breaks are added,
 *  and a name is the one place a run like that is likely (a pasted id, a typo, a URL). Word
 *  boundaries are still preferred; a run with none is cut into measure-sized pieces.
 *  AN ABSENT OR EMPTY STRING COMES BACK AS `undefined`, NEVER AS `''`. An empty `title`
 *  attribute is not the same as no title: it suppresses any ANCESTOR's tooltip as well as its
 *  own, so a button given only a `label` would silently blank the tooltip of whatever it sits
 *  in. Found on the app side and reported as a deviation in `receipts/b319861.md` — their port
 *  guarded it at the one call site with `wrapTip(title) || undefined`, which is correct. The
 *  guard is here instead because the whole point of folding at the element that SETS the
 *  attribute is that no call site has to decide anything; a fix that lives at one call site is
 *  a fix with holes in it, and this system has sixteen `title={wrapTip(…)}` sites under
 *  `components/`, plus two in the Studio shell. Same move as
 *  handing back the number rather than the rule. */
export function wrapTip(text, at) {
  const s = String(text == null ? '' : text).trim()
  if (!s) return undefined
  const measure = at || 44
  if (s.length <= measure) return s
  const words = []
  for (const word of s.split(/\s+/)) {
    if (word.length <= measure) { words.push(word); continue }
    for (let i = 0; i < word.length; i += measure) words.push(word.slice(i, i + measure))
  }
  const out = []
  let line = ''
  for (const word of words) {
    if (!line) { line = word }
    else if ((line + ' ' + word).length > measure) { out.push(line); line = word }
    else { line += ' ' + word }
  }
  if (line) out.push(line)
  return out.join('\n')
}

export const Clipped = { useClipped, wrapTip }

/** THE RESIZE HANDLES' TOOLTIP, ONE COPY. Six handles carry it — `NodeChip`'s three and
 *  `VersionedGroup`'s three — and it was typed out at all six until 2026-08-21b. That is exactly
 *  the shape OB-030 was: the same sentence retyped per handle, with a `\u00b7` escape in three of
 *  them that a JSX string attribute does not process, so 108 tooltips on one card read the escape
 *  out loud. A literal retyped six times is a literal that drifts, and the middot is the character
 *  most likely to be got wrong. `/design-sync` reported the same extraction on their side
 *  (`receipts/b319861.md`, three copies → one `RESIZE_TIP`), so this is convergence, not a change.
 *  Hand back the string, not the rule. */
export const RESIZE_TIP = 'drag to resize · double-click to reset'
