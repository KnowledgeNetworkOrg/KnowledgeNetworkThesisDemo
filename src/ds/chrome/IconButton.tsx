import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'

import { CloseMark } from './CloseMark'

/** The system's round icon control: a ✕, a chevron, a small glyph act. One shape
 *  and one set of manners everywhere, in two TONES — chrome for a neutral act
 *  (close a pane, dismiss a menu), danger for a destructive one (delete a node,
 *  delete a version).
 *
 *  THE BORDER IS RESERVED AT REST. 1px transparent, always, with
 *  `boxSizing: 'border-box'`, so hovering paints the border IN rather than adding
 *  it — a border that appears on hover moves the glyph a pixel and the control
 *  twitches under the pointer. This is the single most-repeated mistake when the
 *  recipe is hand-written, and it is why this is a component and not prose.
 *
 *  DESTRUCTIVE IS BERRY AT REST. `tone="danger"` inks `--state-danger` before
 *  anyone touches it and hovers within its OWN ramp. Never neutral-until-berry:
 *  hover in this system is a one-step wash of an element's own family and never a
 *  hue change, and a warning that arrives on hover arrives too late.
 *
 *  `reveal={false}` is the recede: the control keeps its space (so nothing
 *  reflows when it arrives) but is invisible, untabbable and inert. Every
 *  hover-revealed control in the system uses this rather than unmounting.
 *
 *  THE DEFAULT MARK IS DRAWN, NOT TYPED (DS OB-201, 2026-09-16, owner: the ✕ read off-centre in
 *  its circle). It was: `placeItems: center` centres the LINE BOX, and a text ✕ has no descender,
 *  so its ink sat ~1.5px high of the button's centre — and U+2715 is outside the latin subsets we
 *  load, so the character came from the platform fallback and the error differed per machine.
 *  `CloseMark` is centred by construction. A text `glyph` still renders (`+`, `▽`, `⊞` and the
 *  rest are still typed) and still leans; each becomes a drawn mark as it comes up.
 *
 *  Typed port of the DS IconButton.jsx (contract: IconButton.d.ts). Replaces the
 *  private copy that lived inside VersionedGroup.tsx — the fifth of five
 *  hand-written copies the DS standardised on 2026-08-17. */
export interface IconButtonProps {
  /** `chrome` for a neutral act — close a pane, dismiss a menu: `--text-2` at
   *  rest, washing to `--surface-hover` / `--border-rule` / `--text-1`.
   *  `danger` for a destructive one: `--state-danger` AT REST, washing to
   *  `--state-danger-wash` / `--state-danger` / `--berry-600`. The two tones
   *  share every other property; the difference is the ramp alone, which is the
   *  point — the same control, wearing the stake of the act it performs */
  tone?: 'chrome' | 'danger'
  /** box in px; 18 is the standard, 24 the filled-bar size. The glyph steps with
   *  it (10px below 22, 13 at or above) — do not set a font size from outside */
  size?: number
  /** the glyph's point size, when the derived one is optically wrong. A cross
   *  puts far more ink on the page than a single stroke at the same size, so ✕
   *  sits at 10 in a cluster where – and + sit at 12. Optical sizing, not a
   *  weight change */
  glyphSize?: number
  /** false hides it WITHOUT unmounting: it keeps its space so nothing reflows
   *  when it arrives, and goes untabbable and inert. Every hover-revealed
   *  control in the system recedes this way, on `--dur-fade` */
  reveal?: boolean
  /** tab order only, appearance untouched — for a control inside a cluster whose
   *  FADE the parent owns. A receded button that is merely transparent is still
   *  tabbable and still answers Enter; this is what withdraws it */
  reachable?: boolean
  /** the glyph, when it is not the default ✕. Pass a single character (`+`, `▽`, `⊞`) or omit
   *  it and the button draws `CloseMark` — the DRAWN ✕, since 2026-09-16 (OB-201). A typed ✕ is
   *  no longer the default because nothing could centre it: the character is outside the latin
   *  subsets this system loads, so it came from the platform fallback, and having no descender
   *  its ink sat ~1.5px above the button's centre wherever the line box was centred. `children`
   *  wins over this for anything that is not a single character. */
  glyph?: string
  /** a drawn mark — `<Check />`, `<RestoreMark />` — for anything a character
   *  cannot carry at this size */
  children?: ReactNode
  /** the tooltip, and the accessible name unless `label` overrides it */
  title?: string
  /** the accessible name, when it should differ from the tooltip */
  label?: string
  /** the act itself */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** on by default: these sit inside rows and cards that answer to clicks of
   *  their own */
  stopPropagation?: boolean
  /** POSITION ONLY — `marginLeft: auto`, `position: absolute`, `zIndex`,
   *  `alignSelf`. Do not restyle the face, the border or the ink from here: the
   *  tones are the component's, and a fifth hand-written variant is what this
   *  replaced */
  style?: CSSProperties
  /** FADED, NOT RECEDED (OB-072). `reveal={false}` is for a control that isn't
   *  relevant right now and goes fully invisible + untabbable; `disabled` is for
   *  a control that IS relevant — the act it names still applies to this pane —
   *  but has nothing left to do right now, e.g. "expand all" when every stop is
   *  already open. Reads as a dimmed glyph (0.35 opacity), still in place, still
   *  in the tab order (a screen reader should still hear the act and that it's
   *  off, not have the control silently disappear), just not clickable or
   *  hoverable. Default false. */
  disabled?: boolean
}

export function IconButton({
  tone = 'chrome', size = 18, glyphSize, reveal = true, reachable = true, glyph,
  title, label, onClick, stopPropagation = true, style, children, disabled = false,
}: IconButtonProps) {
  const [hot, setHot] = useState(false)
  const markSize = glyphSize || (size >= 22 ? 13 : 10)
  const danger = tone === 'danger'
  const shown = reveal !== false
  /* the two ramps. Rest ink differs by tone; the hover step is one wash of that
     tone's own family in both cases, which is what makes them read as the same
     control. */
  const restInk = danger ? 'var(--state-danger)' : 'var(--text-2)'
  const hotInk = danger ? 'var(--berry-600)' : 'var(--text-1)'
  const hotFace = danger ? 'var(--state-danger-wash)' : 'var(--surface-hover)'
  const hotEdge = danger ? 'var(--state-danger)' : 'var(--border-rule)'
  return (
    <button
      /* EVERY TOOLTIP IN THE SYSTEM GOES THROUGH `wrapTip`, the short ones included.
         Folding HERE rather than at each call site is what makes that true: a short
         string comes back untouched, so it costs nothing, and no call site is left
         deciding whether its own label is long enough to bother with.
         `aria-label` keeps the UNFOLDED string — a screen reader reads a line, not a
         shape.
         NO LOCAL `|| undefined` ANY MORE (OB-047). This button used to carry its own —
         upstream `wrapTip` returned `''` for an absent title, and `title=""` is not the
         same as no title: it also suppresses any ANCESTOR's tooltip, which two call
         sites here relied on (VersionedGroup's fold and ungroup buttons). Reported
         rather than silently kept; the DS moved the guard one level down instead —
         `wrapTip` itself now returns `undefined` for an absent or empty string, so
         every caller gets the fix at once rather than each guarding its own. */
      type="button" title={wrapTip(title)} aria-label={label || title}
      /* a receded button is invisible but still in the tab order and still
         answers Enter; opacity and pointer-events do not fix that, tabIndex
         does. `reachable` is the same withdrawal for a cluster whose FADE the
         parent owns — tab order only, appearance untouched. */
      disabled={disabled}
      tabIndex={shown && reachable ? 0 : -1}
      onClick={(e) => { if (disabled) return; if (stopPropagation) e.stopPropagation(); if (onClick) onClick(e) }}
      onMouseEnter={() => !disabled && setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => !disabled && setHot(true)}
      onBlur={() => setHot(false)}
      style={{
        width: size, height: size, padding: 0, flexShrink: 0,
        display: 'grid', placeItems: 'center', boxSizing: 'border-box',
        borderRadius: 'var(--radius-pill)',
        /* reserved at rest — see the note above */
        border: '1px solid ' + (hot && !disabled ? hotEdge : 'transparent'),
        background: hot && !disabled ? hotFace : 'transparent',
        color: hot && !disabled ? hotInk : restInk,
        /* the glyph is point-sized SEPARATELY where it has to be: a cross puts
           far more ink on the page than a single stroke at the same size, so ✕
           sits at 10 beside – and + at 12. Optical sizing, not a weight change. The same
           number sizes the drawn `CloseMark`, so the default mark matches the ink the text glyph
           used to draw. */
        fontFamily: 'var(--font-ui)', fontSize: markSize, lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
        /* the fade step, one number (OB-072): 0.35 is dim enough to read as
           "nothing to do here" beside a full-ink sibling without dropping under
           AA for the glyph it still has to show at a glance — this is presence,
           not text, so AA's ratio doesn't gate it, but any lower stopped reading
           as a button at all. */
        opacity: !shown ? 0 : disabled ? 0.35 : 1, pointerEvents: !shown ? 'none' : disabled ? 'none' : 'auto',
        transition: 'opacity var(--dur-fade) var(--ease-soft), var(--transition-wash)',
        ...style,
      }}>{children || (glyph === undefined || glyph === null ? <CloseMark size={markSize} /> : glyph)}</button>
  )
}

/* ── the recede clock ──────────────────────────────────────────────────────
 * ONE grace period for everything in this product that appears on hover and goes
 * away again: the scrollbar, a pane's ✕, a chip's ✕, a group's head controls, a
 * menu row's ✕. Two controls in the same pane receding at two speeds reads as one
 * of them being broken, and a control that goes the instant the pointer leaves
 * vanishes under the cursor's heels on the way to it.
 *
 * WHAT A CALLER MUST NOT DO: open-code the number. `window.PKT_SB.LEAVE` is
 * published by `src/ds/assets/scrollbars.js` (imported at src/main.tsx), which is
 * the owner; `RECEDE_LEAVE_MS` is the FALLBACK for a page that never loaded it,
 * not a second opinion about the timing. Four files here open-coded `?? 500`
 * until this landed — four numbers with nothing keeping them equal.
 * ───────────────────────────────────────────────────────────────────────── */

/** the fallback, for a page with no scrollbar script. Capitalised, so it reaches
 *  `window.<Namespace>` in the DS's own build — a consuming page can read it
 *  without importing anything */
export const RECEDE_LEAVE_MS = 500

/** the live grace period: the script's value, or the fallback */
export function recedeMs(): number {
  const w = window as { PKT_SB?: { LEAVE?: number } }
  return w.PKT_SB?.LEAVE ?? RECEDE_LEAVE_MS
}

/** Presence of the pointer OR the keyboard anywhere in `el`, pushed into `set`.
 *  Returns its own teardown, so it drops straight into a `useEffect` where the
 *  element is found by hand. Focus counts: a control reachable only by pointer is
 *  not reachable. */
export function subscribePresence(
  el: HTMLElement | null | undefined,
  set: (live: boolean) => void,
): (() => void) | undefined {
  if (!el) return undefined
  let t: ReturnType<typeof setTimeout>
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

/** Which element `usePresence` watches, in order: `resolve()` if given (called
 *  once, at effect time, so it can read a context that was empty during render);
 *  `parent` for the ref'd node's `parentElement`, for a header rendered BY its
 *  container rather than around it; the ref'd node otherwise. */
export interface PresenceOptions {
  /** watch the ref'd node's `parentElement` — for a header its container renders */
  parent?: boolean
  /** find the element at effect time, when render was too early to know it */
  resolve?: () => HTMLElement | null
}

/** The clock as a hook, for a control revealed by presence in a CONTAINER — a
 *  pane's ✕, a group's head controls. */
export function usePresence(
  ref: { current: HTMLElement | null },
  options?: PresenceOptions,
): boolean {
  const optsRef = useRef<PresenceOptions>(options || {})
  optsRef.current = options || {}
  const [live, setLive] = useState(false)
  useEffect(() => {
    const o = optsRef.current
    const node = ref && ref.current
    const el = o.resolve ? o.resolve() : (o.parent ? node?.parentElement : node)
    return subscribePresence(el, setLive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return live
}

/** The clock as a pair of handlers, for a control revealed by its OWN hover or
 *  focus rather than by presence in a container — a chip's ✕.
 *  `const [shown, show, hide] = useRecede()`, then `reveal={shown}`.
 *
 *  NEVER DRIVE A HOVER WASH FROM THIS, and never share one state between a wash and a
 *  receding control (DS OB-206, 2026-09-17). The two want opposite things: a wash follows the
 *  pointer, so it must be instant in both directions, while a receding control has to wait out
 *  the grace period so it does not vanish under the cursor's heels on the way to it.
 *  `VersionedGroup`'s menu row drove both from one `hot` and stayed lit for the full 500ms
 *  after the pointer left — reported as a delayed hover a day after the CSS transition had been
 *  taken off that row, because the transition was never the big half of it. Two states, one
 *  gesture. */
export function useRecede(): [boolean, () => void, () => void] {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const show = () => { if (timer.current) clearTimeout(timer.current); setShown(true) }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(false), recedeMs())
  }
  return [shown, show, hide]
}


/* ── the clipped line ───────────────────────────────────────────
 * A HOUSE RULE HANDED OVER AS CODE: wherever a "…" can appear, hovering must give
 * the whole string. It lives here beside the recede clock because it is the same
 * kind of thing — a behaviour several unrelated controls share, where a rule left
 * as prose gets restated five ways and drifts apart.
 * ────────────────────────────────────────────────────────── */

/** A CLIPPED STRING SAYS WHAT IT SAYS, ON HOVER. Spread the result on the element
 *  that DOES the clipping —
 *  `<span {...clip} style={{ …, overflow: 'hidden', textOverflow: 'ellipsis' }}>` —
 *  never on an ancestor, which is not the box that overflows and would therefore
 *  never report anything.
 *
 *  IT IS A HOOK RATHER THAN AN UNCONDITIONAL `title=`, and that is the whole design.
 *  A tooltip repeating a line you can already read in full fires on every hover of
 *  every row on a board, and noise at that scale trains people straight past the one
 *  tooltip that matters. So the title exists only while the text is really cut.
 *
 *  MEASURED ON POINTER ENTRY, not at render. Whether a line clips is a fact about
 *  its laid-out width, and that changes with the pane, the sidebar, a window resize
 *  and the string itself — a value computed at render is stale by the time anyone
 *  hovers it. The cost is one measurement per hover, of an element already under the
 *  pointer.
 *
 *  BOTH AXES, because the system clips both ways: `scrollWidth` for a one-line
 *  `text-overflow` clip, `scrollHeight` for a clamped block. The 1px tolerance is for
 *  sub-pixel text metrics, which report a 0.3px overflow on plenty of lines that are
 *  not clipped at all.
 *
 *  The type parameter is the element it will be spread on —
 *  `useClipped<HTMLSpanElement>(name)` — because a ref typed as the base HTMLElement
 *  is not assignable to a span's. */
export function useClipped<T extends HTMLElement = HTMLElement>(text?: string | null) {
  const ref = useRef<T | null>(null)
  const [cut, setCut] = useState(false)
  const onPointerEnter = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCut(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
  }, [])
  /* folded into readable lines rather than one screen-wide one — see `wrapTip` */
  return { ref, onPointerEnter, title: cut && text ? wrapTip(text) : undefined }
}

/** A TOOLTIP IS NOT A RULER. A native `title` holding a long name draws ONE line the
 *  width of the screen, which is the hardest shape there is to read — the eye gets no
 *  return sweep. The platform offers no styling hook for a native tooltip, and
 *  replacing it with a drawn one would mean a popover that has to escape every
 *  stacking context in the app (the version menu already needs a portal for exactly
 *  that) plus its own show delay, hover grace, edge flipping and focus behaviour — a
 *  component's worth of surface for a line of text. Newlines, though, a native tooltip
 *  does honour. So the string is folded on word boundaries at about 44 characters, the
 *  same measure a paragraph of prose wants and well inside every platform's cap.
 *
 *  ANYTHING ALREADY SHORTER COMES BACK UNTOUCHED. That is what lets this be applied at
 *  every `title=` in the system with no judgement left at the call site about whether a
 *  particular label is "long enough to bother" — the one exception the DS allowed
 *  lasted an hour before producing the exact defect it was excusing.
 *
 *  AND AN UNBROKEN RUN LONGER THAN THE MEASURE IS BROKEN ANYWAY. The first version left
 *  a long word whole, reasoning that a break inside a word misreports the string; one
 *  60-character run then drew the screen-wide line this function exists to prevent, so
 *  the exception swallowed the rule. The reasoning was wrong as well as costly — the
 *  tooltip shows the same characters either way, only the line breaks are added, and a
 *  NAME is exactly where such a run turns up (a pasted id, a typo, a URL). Word
 *  boundaries are still preferred; a run with none is cut into measure-sized pieces.
 *
 *  AN ABSENT OR EMPTY STRING COMES BACK AS `undefined`, NEVER AS `''` (OB-047). An empty
 *  `title` attribute is not the same as no title at all — it also suppresses any
 *  ANCESTOR's tooltip — so `title={wrapTip(x)}` is correct for every `x`, missing ones
 *  included, and no call site has to guard it with its own `|| undefined`. A caller that
 *  needs a string back unconditionally should write `wrapTip(x) ?? ''` and mean it. */
export function wrapTip(text?: string | null, at?: number): string | undefined {
  const s = String(text ?? '').trim()
  if (!s) return undefined
  const measure = at || 44
  if (s.length <= measure) return s
  const words: string[] = []
  for (const word of s.split(/\s+/)) {
    if (word.length <= measure) { words.push(word); continue }
    for (let i = 0; i < word.length; i += measure) words.push(word.slice(i, i + measure))
  }
  const out: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) line = word
    else if ((line + ' ' + word).length > measure) { out.push(line); line = word }
    else line += ' ' + word
  }
  if (line) out.push(line)
  return out.join('\n')
}

/** The resize handles' tooltip, published as one string rather than retyped per handle.
 *  Six handles carry it — NodeChip's three and VersionedGroup's three. Each of those two
 *  files typed its own copy of this literal until this obligation (OB-047); the DS's own
 *  six had drifted further still, three of them carrying a `·` escape a JSX string
 *  attribute never processes, so the tooltip read the escape out loud rather than
 *  showing "·". A literal retyped six times drifts, and the middot is the character
 *  most likely to be got wrong — this port reached the same extraction independently
 *  (receipts/b319861.md), so publishing it here is convergence, not a new decision. */
export const RESIZE_TIP = 'drag to resize · double-click to reset'
