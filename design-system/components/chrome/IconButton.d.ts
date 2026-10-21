import type { CSSProperties, ReactNode, MouseEvent } from 'react'

/**
 * The round icon control — one shape and one set of manners for every small glyph act
 * in the system, in two tones.
 *
 * It exists so the recipe stops being hand-written. Two rules it now enforces that were
 * previously prose, and were got wrong in three of the four hand-written copies:
 *
 *  1. THE 1px BORDER IS RESERVED AT REST (transparent, `border-box`). A border that
 *     appears on hover moves the glyph and the control twitches under the pointer.
 *  2. A DESTRUCTIVE CONTROL IS INKED AT REST and hovers within its own ramp. Hover in
 *     this system is a one-step wash of an element's own family, never a hue change,
 *     and a warning that arrives on hover arrives too late.
 */
export interface IconButtonProps {
  /** `chrome` for a neutral act — close a pane, dismiss a menu: `--text-2` at rest,
   *  washing to `--surface-hover` / `--border-rule` / `--text-1`.
   *  `danger` for a destructive one — delete a node, delete a version: `--state-danger`
   *  AT REST, washing to `--state-danger-wash` / `--state-danger` / `--berry-600`.
   *  The two tones share every other property; the difference is the ramp alone, which
   *  is the point — the same control, wearing the stake of the act it performs */
  tone?: 'chrome' | 'danger'
  /** box in px; 18 is the standard, 24 the filled-bar size. The glyph steps with it
   *  (10px below 22, 13 at or above) — do not set a font size from outside; use
   *  `glyphSize` where the glyph genuinely needs its own point size */
  size?: number
  /** the glyph's point size, when the derived one is optically wrong. A cross puts far
   *  more ink on the page than a single stroke at the same size, so ✕ sits at 10 in a
   *  cluster where – and + sit at 12. Optical sizing, not a weight change */
  glyphSize?: number
  /** false hides it WITHOUT unmounting: it keeps its space so nothing reflows when it
   *  arrives, and goes untabbable and inert. Every hover-revealed control in the system
   *  recedes this way, on `--dur-fade`, rather than being conditionally rendered */
  reveal?: boolean
  /** tab order only, appearance untouched — for a control inside a cluster whose FADE
   *  the parent owns. A receded button that is merely transparent is still tabbable and
   *  still answers Enter; this is what withdraws it */
  reachable?: boolean
  /** the act still applies here but has nothing left to do right now — "expand all"
   *  when every stop is already open. Dims to 0.35 opacity, drops hover/click/tab
   *  reachability, but STAYS IN PLACE (unlike `reveal={false}`, which removes the
   *  control from the pane entirely). Use this, never `reveal`, for a control whose
   *  relevance doesn't change, only its usefulness right now */
  disabled?: boolean
  /** the glyph, when it is not the default ✕. Pass a single character (`+`, `▽`, `⊞`) or
   *  omit it and the button draws `CloseMark` — the DRAWN ✕, since 2026-09-16. A typed ✕ is
   *  no longer the default because nothing could centre it: the character is outside the
   *  latin subsets this system loads, so it came from the platform fallback, and having no
   *  descender its ink sat ~1.5px above the button's centre wherever the line box was
   *  centred. The typed glyphs that remain lean the same way, by about a pixel; each becomes
   *  a drawn mark as it comes up. `children` wins over this for anything that is not a
   *  single character. */
  glyph?: string
  children?: ReactNode
  /** the tooltip, and the accessible name unless `label` overrides it */
  title?: string
  label?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** on by default: these sit inside rows and cards that answer to clicks of their own */
  stopPropagation?: boolean
  /** POSITION, AND THE THREE COLOUR PROPERTIES A HELD FACE NEEDS — `marginLeft: auto`,
   *  `position: absolute`, `zIndex`, `alignSelf`, plus `color`, `background` and `borderColor`
   *  for a mark whose
   *  PRESSED or HELD face this component has no tone for (the group card's pencil is the standing
   *  example, and has passed them since it was written). Nothing else: no border, no radius, no
   *  padding, no size — the tones are the component's, and a fifth hand-written variant is what
   *  this replaced.
   *  Widened 2026-09-06 from "POSITION ONLY", which the app's OB-110 port rightly asked about
   *  (`receipts/c968155.md`): our own caller had been outside the contract since the day it was
   *  drawn, and the honest fix is the contract rather than the caller — a held face is a real
   *  need, and the alternative is a `tone` for every one-off pressed state.
   *  `borderColor` added 2026-09-26: the component FOLDS it into its own `border` shorthand, so it
   *  holds through hover. Pass the colour alone — never a `border` shorthand of your own. */
  style?: CSSProperties
}
export function IconButton(props: IconButtonProps): JSX.Element

/* ── the recede clock ────────────────────────────────────────────────────────
 * ONE grace period for everything in this product that appears on hover and goes away
 * again: the scrollbar, a pane's ✕, a chip's ✕, a group's head controls, a menu row's ✕.
 * Two controls in the same pane receding at two speeds reads as one of them being
 * broken, and a control that goes the instant the pointer leaves vanishes under the
 * cursor's heels on the way to it.
 *
 * WHAT A CALLER MUST NOT DO: open-code the number. `window.PKT_SB.LEAVE` is published by
 * `assets/scrollbars.js`, which is the owner; `RECEDE_LEAVE_MS` is the fallback for a
 * page that never loaded it, not a second opinion about the timing. A port that writes
 * `?? 500` in four files has four numbers that can drift, which is the state the app is
 * in today.
 * ─────────────────────────────────────────────────────────────────────────── */
/** the fallback, for a page with no scrollbar script. Capitalised, so it reaches
 *  `window.<Namespace>` — a consuming page can read it without importing anything */
export const RECEDE_LEAVE_MS: number
/** the live grace period: the script's value, or the fallback */
export function recedeMs(): number
/** pointer OR keyboard presence anywhere in `el`, pushed into `set`; returns its own
 *  teardown. Focus counts — a control reachable only by pointer is not reachable */
export function subscribePresence(el: HTMLElement | null, set: (live: boolean) => void): (() => void) | undefined
/** presence in a CONTAINER, as a hook — a pane's ✕, a group's head controls. Which
 *  element it watches, in order: `resolve()` if given (called once at effect time, so it
 *  can read a context that was empty during render); the ref'd node's `parentElement`
 *  with `{ parent: true }`, for a header rendered BY its container; the ref'd node
 *  otherwise */
export function usePresence(
  ref: { current: HTMLElement | null },
  options?: { parent?: boolean; resolve?: () => HTMLElement | null }
): boolean
/** the clock for a control revealed by its OWN hover or focus — a chip's ✕.
 *  `const [shown, show, hide] = useRecede()`, then `reveal={shown}`.
 *
 *  ONE GESTURE, TWO STATES: this drives the RECEDING CONTROL only. A hover wash on the same row
 *  gets its own plain boolean, set and cleared immediately — a wash follows the pointer and must
 *  be instant in both directions, while this waits out the grace period so the control does not
 *  vanish under the cursor. Sharing one state makes the row stay lit for the whole 500ms after
 *  the pointer leaves, which reads as a broken hover (2026-09-17, `VersionedGroup`'s menu row). */
export function useRecede(): [boolean, () => void, () => void]

/* ── the clipped line ────────────────────────────────────────────────────────
 *  A HOUSE RULE, HANDED OVER AS CODE: wherever a "…" can appear, hovering must give the whole
 *  string. Owner's rule, 2026-08-19. It lives here, beside the recede clock, because it is the
 *  same kind of thing — a behaviour several unrelated controls share, where a rule in prose gets
 *  restated five ways and drifts. */
/** `const clip = useClipped(text)`, then spread it on the element that CLIPS —
 *  `<span {...clip} style={{ …, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>`.
 *  Spread on an ancestor it reports nothing: the ancestor is not the box that overflows.
 *
 *  It returns `{ ref, onPointerEnter, title }` and titles the element ONLY while the text is
 *  really cut. That condition is the point: an unconditional `title` repeats a line you can
 *  already read in full, on every hover of every row on a board, which trains people past the
 *  one tooltip that matters. The measurement happens on pointer entry rather than at render
 *  because clipping is a fact about the laid-out width — it changes with the pane, the sidebar,
 *  a window resize and the string — so a value computed at render is stale by the time it is
 *  hovered.
 *
 *  Both axes: `scrollWidth` for a one-line `text-overflow` clip, `scrollHeight` for a
 *  line-clamped block, each with 1px of tolerance for sub-pixel text metrics.
 *
 *  A port must keep it a hook, not a prop: a caller cannot know whether a string will be cut in a
 *  box the component lays out. */
export function useClipped(text?: string | null): {
  ref: { current: HTMLElement | null }
  onPointerEnter: () => void
  title: string | undefined
}
/** the same hook under a capitalised name, because only capitalised exports reach
 *  `window.<Namespace>`. For cards and consuming pages; a port imports `useClipped`. */
/** fold a tooltip into readable lines. A native `title` holding a long name draws ONE line the
 *  width of the screen, which is the hardest shape there is to read — no return sweep for the eye
 *  (owner-reported 2026-08-19). A native tooltip takes no styling, and replacing it with a drawn
 *  one costs a popover that must escape every stacking context in the app, plus its own delay,
 *  hover grace, flipping and focus rules — a component's worth of surface for a line of text.
 *  Newlines it does honour, so the string is folded on word boundaries at about 44 characters,
 *  the same measure prose wants. Short strings come back untouched. An UNBROKEN RUN longer than
 *  the measure is cut into measure-sized pieces rather than left whole — the first version made
 *  that exception and a 60-character run of letters immediately drew the screen-wide line the
 *  function exists to prevent (owner-reported with a screenshot, 2026-08-19); the tooltip shows
 *  the same characters either way, only the line breaks are added.
 *  `useClipped` folds its own title; anywhere else a name goes into a `title`, fold it.
 *  **AN ABSENT OR EMPTY STRING COMES BACK AS `undefined`, NEVER AS `''`** (2026-08-21b), which is
 *  why the return type is nullable: an empty `title` attribute is not the same as no title — it
 *  suppresses any ANCESTOR's tooltip as well as its own. So `title={wrapTip(x)}` is correct for
 *  every x, including a missing one, and no call site has to guard. A caller that needs a string
 *  back unconditionally should say `wrapTip(x) ?? ''` and mean it. */
export function wrapTip(text?: string | null, at?: number): string | undefined
export const Clipped: { useClipped: typeof useClipped; wrapTip: typeof wrapTip }

/** The resize handles' tooltip, published as one string rather than retyped per handle.
 *  Six handles carry it — NodeChip's three and VersionedGroup's three. It was typed out at all
 *  six until 2026-08-21b, and three of those copies had a \u00b7 escape that a JSX string
 *  attribute does not process (OB-030), so the tooltip read the escape out loud on 108 handles
 *  on one card. A literal retyped six times drifts, and the middot is the character most likely
 *  to be got wrong. Their port reached the same extraction independently (receipts/b319861.md,
 *  as RESIZE_TIP), so this is convergence rather than a change. */
export const RESIZE_TIP: string
