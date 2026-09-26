import React, { useState, useRef, useEffect } from 'react'
import { domainToken } from './DomainDot'
import { Caret, CARET_FIRST_LINE_INSET } from '../nav/TreeRow'
import { RESIZE_TIP, useRecede, wrapTip } from '../chrome/IconButton'
import { CloseMark } from '../chrome/CloseMark'
import { fitLines } from './textFit'
import { canMeasure, linesOf, measure, WRAP_SAFETY_PX } from './textMeasure'
/* PUBLISHED FROM HERE (DS OB-217) because this is the file whose predictions depend on it, and a
   number that crosses the boundary is exported rather than retyped. It is DECLARED once, in
   `textMeasure`, and spent twice: this file's one-line width and that file's wrap decision. */
export { WRAP_SAFETY_PX }

/** WHAT EACH FORM'S BORDER WEIGHS, published because A CONNECTOR IS DRAWN AT THE BORDER
 *  WEIGHT OF WHAT IT CONNECTS AND NEVER ABOVE IT. The nodes are the objects; a line
 *  between them is a statement about them, so it is never the heaviest mark in the row.
 *  `NodeArrow.shaftFor(mark)` turns one of these into a shaft weight, so no caller ever
 *  types 1.5 or 1.25, and `NodeChain` reads the mark off the chips it places and needs no
 *  help at all. Keep this in step with the `border:` branch in the chip's style below — it
 *  is the same three cases. The weights travel ONE WAY, from the chip that draws the border
 *  to the line that answers it: this file must never import back from a connector. */
export const CHIP_BORDER: Record<string, number> = { dot: 1, border: 1.5, 'border-2': 1, none: 1 }

/** the border weight of a chip form, in px. An unknown or absent form falls back to the
 *  full-rank 1.5. THAT FALLBACK IS FOR A FORM NAME NOBODY RECOGNISES, not for a non-chip
 *  neighbour: a `VersionedGroup` card weighs 1px, not 1.5, and answers through its own
 *  `joinBorder` static. The DS's own docblock claimed otherwise for one afternoon and had a
 *  chain of group cards taking a 1.5 shaft against 1px edges — the same fault the 3px shaft
 *  was, one component over. */
export function chipBorder(mark?: string): number {
  return mark !== undefined && CHIP_BORDER[mark] !== undefined ? CHIP_BORDER[mark] : CHIP_BORDER.border
}

/** WHERE THE DISC SITS ON A STACKED CHIP, measured rather than chosen (the DS's
 *  `guidelines/chip-wrap-alignment.html`, 2026-08-19). A stacked chip aligns on the name's
 *  FIRST-LINE BASELINE, which is exact for the step number and leaves the disc 0.83px low,
 *  because a box with no text in it has no baseline and CSS synthesizes one from its border
 *  box. So the disc opts OUT (`alignSelf: flex-start`) and is placed against the first
 *  line's TOP, which does not move as the name wraps.
 *  TWO MECHANISMS THAT DO NOT WORK, both tried in the DS's rig before this one:
 *  `marginBottom`, because margins do not move a synthesized baseline (it reads 0.83
 *  unchanged); and `alignSelf: center`, which centres the disc in the whole flex line and so
 *  drifts with every line the name gains (0.44 → 17.98 across three) — and which looks
 *  correct on a one-line chip, so do not "simplify" to it. */
const DOT_FIRST_LINE_INSET = 4.83

/** A corpus node as a chip: dot (or border, or nothing), truncating title, raised
 *  on paper. Port of DS components/graph/NodeChip.jsx.
 *
 *  TWO AXES, AND THEY DO NOT INTERACT. Keep them apart when reading these props and
 *  when adding one:
 *
 *    1. WHAT THE CHIP IS — `mark`, which of the sanctioned carriers holds the domain
 *       hue and at which rank. The SURFACE picks it. Plus the states `lit`, `dim`,
 *       `optional`, `open` and `wrap`, which say how this chip stands right now — each
 *       one works on every form, which is what makes it a state.
 *    2. WHAT CAN BE DONE TO IT — `selectable` (a click), `resizable` (an edge drag),
 *       `onDelete` (a ✕). ALL THREE ARE OPT-IN, ALL THREE DEFAULT OFF, and ALL THREE
 *       WORK ON EVERY `mark` FORM. `<NodeChip title domain />` is the static chip.
 *
 *  So a capability is never a property of a form: there is no resizable form and no
 *  clickable form, and tying one to `mark` — or giving one a form-dependent default —
 *  makes two components out of one. If a chip should not be sized in a dense list,
 *  that is a fact about the LIST, and the list omits the prop.
 *
 *  Deviations from DS source:
 *  - `domain` resolves through `domainToken()` — ring hue names only since OB-153 (2026-09-14) */

export interface NodeChipProps {
  /** the node's NAME. A `ReactNode` rather than a string since 2026-08-19, so a caller can
   *  hand in a composed sentence — `EdgeEntry` passes a bold anchor and an elided
   *  `Parent / … / ` prefix, which belong to the SENTENCE rather than to the chip. Widening
   *  accepts every string that compiled before. Pass `note` alongside a non-string title:
   *  the tooltip reads `note` first and cannot render an element. */
  title: React.ReactNode
  /** the node's step number in its container ("2.1") — derived, mono, tabular,
   *  --fs-micro at --text-3: a figure glanced at beside the name, never level with it */
  index?: string
  /** A RING HUE NAME (`'teal'`) — what the corpus stores on a topic (`topicHueOf`) — resolved
   *  by `domainToken()`; anything else draws the fallback swatch. **Widened from the six-code `DomainCode` union
   *  to `string` here on 2026-09-06**, catching up with the DS's own 2026-08-21j change: the
   *  union was compiled into their adherence lint, and a general corpus passing a ring hue was
   *  reported as an invalid prop. The NAME is still wrong — this is a topic, not a domain — and
   *  DS OB-061 decides that rename on both sides at once rather than half-renaming six props.
   *
   *  ★ LOCAL, and reported on #74: OPTIONAL here where the DS's `.d.ts` says `domain: string`
   *  required. Their own `RelationCards.jsx` passes `domain={t.targetDomain}` from a relation
   *  whose target domain the corpus may not carry, so the contract is already violated by a
   *  sibling in that project — and `domainToken(undefined)` answers the fallback swatch by
   *  design. Ported to what the `.jsx` does rather than to what the `.d.ts` claims. */
  domain?: string
  /** which carrier holds the domain colour. 'dot' (default) is the dense form for
   *  trails, legends and rails; 'border' is a 1.5px domain-coloured edge with no disc,
   *  for a node standing on its own — a stop inside a group, a node on the road;
   *  'none' is no disc and no hue at all — for a surface where domain is not the
   *  channel being read and the edge's only job is to report selection;
   *  'border-2' is THE FORM FOR A NODE BEING NAMED RATHER THAN ACTED ON — the same border
   *  one rank down (1px of domain hue), a transparent face, NO LIFT, caption type at
   *  --text-2, --radius-md and centred text. A chip is the object: raised, white, the thing
   *  being arranged. This is a MENTION of an object that lives somewhere else, and a
   *  citation set in the same ink as the thing cited reads as a second copy of it.
   *  `EdgeEntry`'s two ends are this form and it is what the form was invented for — it drew
   *  them itself as a private node until the DS promoted the recipe. Not to be confused with
   *  `dim`, which is a STATE on any form (off the resolved path) rather than a rank. */
  mark?: 'dot' | 'border' | 'border-2' | 'none'
  /** off the resolved path: no lift, no fill, --opacity-off-path */
  dim?: boolean
  /** THIS NODE IS CONDITIONAL — an optional stop, one that may be bypassed. A STATE, not a
   *  form: it works on all four marks and beside every capability, the same as `lit` and
   *  `dim`. Ours originally, reported on drift-log #74 as a form the DS should own; adopted
   *  from the DS 2026-08-19, which kept the dashed border and ADDED the word.
   *
   *  It says two things at once, on purpose. The border DASHES, which is what dashed already
   *  means everywhere in this system (`NodeArrow dashed`, the group's empty-version zone):
   *  conditional, not yet, may not happen. And the chip says the WORD, because a dash is a
   *  convention and a convention only speaks to a reader who has already learnt it — the
   *  drawing carries the meaning for someone fluent in the system, the word carries it for
   *  everyone else.
   *
   *  DASHED RATHER THAN A COLOUR because a node's hue is its DOMAIN and its border width is
   *  what a connector matches (`chipBorder`), so neither channel is free to carry a state;
   *  the line's style is the only one left. Do NOT reach for `--state-optional` — it is a
   *  shade of acorn, and acorn means ON THE AUTHORED WALK, so an optional step painted with
   *  it says the opposite of what it is.
   *
   *  THE WORD IS FIXED AT "(optional)" AND THERE IS NO PROP TO REWORD IT. One condition, one
   *  name: the moment a caller can write its own wording, the same state reads "optional" on
   *  one screen and "if time allows" on the next, and a reader cannot tell whether those are
   *  two conditions or one. There is also NO GLYPH — no typed ◇ — which is a deliberate
   *  removal, not an omission: the drawn vocabulary is a closed set of four marks (caret,
   *  bin, live-version check, restore), and a state does not join that set by being typed
   *  instead of drawn.
   *
   *  WHERE THE WORD GOES DEPENDS ON THE RANK. A full-rank chip is an object, so the word sits
   *  UNDER the name on its own line (--fs-micro, italic, --text-3) and the chip drops to
   *  --radius-md — which makes it ONE --fs-micro LINE TALLER than the same chip without it,
   *  and `chipSize()` models that. A `border-2` chip is a mention inside a sentence, where a
   *  second line would outweigh the sentence around it, so there the word follows inline. */
  optional?: boolean
  /** cross-pane hover correspondence — a 1.5px pond ring over the chip's own lift */
  lit?: boolean
  /** THE SUBJECT OF ITS PANE — the one node everything else on screen is relative to,
   *  not a state it passes through. `--fw-bold` on the title and one step up the lift
   *  ladder (`--lift-1` → `--lift-2`). Off by default: most chips are one of many.
   *
   *  IT OUTRANKS THE RANK, on weight and on ink. `border-2` sets its own quieter type —
   *  caption at `--fw-medium`, `--text-2` — and `focus` overrides both to `--fw-bold` /
   *  `--text-1`; if the rank won, `focus` would silently do nothing on the form
   *  `EdgeEntry` uses for every relationship end. `chipSize()` must be told this prop
   *  too: `--fw-bold` is wider than either resting weight, and a focus chip predicted at
   *  semibold clips its own name.
   *
   *  Use it for ONE chip per pane — two subjects is no subject. Not `selected`, not
   *  `lit`: those are things a user does or a pointer causes and change while the pane
   *  stays put; this is a fact about what the pane is FOR, decided when it is built. */
  focus?: boolean
  /** THE ANCESTOR PATH ABOVE THIS CHIP'S NAME — `'border-2'` ONLY, and only drawn when `width`
   *  is also a number, because the measured layout needs a fixed box to fit into. A LIST, not a
   *  string: an ancestor name is shown WHOLE or dropped entirely, keeping the longest run that
   *  ENDS AT THE PARENT and fits — so what is lost is the FAR end of the chain, the part a
   *  reader can infer, never the middle of a word. Drawn quiet (`CHIP_METRICS.pathFontPx`,
   *  `--text-3`) above the name.
   *
   *  WHEN THE ROOT ITSELF IS DROPPED THE LINE SAYS SO: `"../ "` prefixes a path that no longer
   *  starts at `path[0]`. Trimming the far end is silent because a reader can infer it;
   *  dropping the near end removes context that cannot be recovered, so it is stated.
   *
   *  Added upstream 2026-08-28, absorbing `RelationCards`' private `RelCardPill` — the
   *  connections pane's grouped source pill is its one caller today. */
  path?: string[]
  /** the ceiling on the ANCESTOR PATH's own lines (default 2). Ignored without `path` */
  pathMaxLines?: number
  /** RAISES THE NAME PAST ONE TRUNCATED LINE — `'border-2'` ONLY, and only when `width` is a
   *  number. Without this (or `path`) a `border-2` chip keeps the plain single-line CSS ellipsis
   *  it always had, so the mode is additive and no existing caller moves; passing either switches
   *  to `fitLines`-measured lines with a real ellipsis on the last, since a citation this small
   *  reads a mid-word CSS break worse than a hard cut. Defaults to 2 when `path` is set without
   *  an explicit value */
  maxLines?: number
  /** THIS CHIP HEADS A DISCLOSURE — an opt-in capability, like `selectable`, `resizable`
   *  and `onDelete`: the surface asks for it and the chip grows a control. Draws the
   *  shared disclosure mark (`Caret` from `../nav/TreeRow`) at the chip's LEADING
   *  edge, before the dot, and reserves its width — 12px on the title, the 6px mark plus
   *  the chip's own 6px gap. `open` only says which way it points.
   *
   *  THE CHIP DOES NOT OWN THE GESTURE — the one way this differs from the other three.
   *  A disclosure is almost always toggled by something bigger than the chip (a whole
   *  row, a header), so the host keeps the click and passes `open` back. `chipSize()`
   *  takes this prop and never `open`: the mark is present in both positions, so
   *  toggling changes a rotation and an ink value and never the box. */
  disclosable?: boolean
  /** WHICH WAY THE MARK POINTS — down when open, right when closed. The drawn half of
   *  `disclosable`, exactly as `selected` is the drawn half of `selectable`. Ink alone
   *  carries it: `--text-3` closed, `--text-1` open. No face, no border, no lift, no
   *  type, no geometry — and WITHOUT `disclosable` it draws nothing.
   *
   *  Two clean booleans rather than one tristate: forwarding an absent `open` straight
   *  through (as `RailStop` does for every closed row) now just means closed, where a
   *  tristate made every closed row arrive `undefined` and silently lose its caret. */
  open?: boolean
  /** THE WASH, DRIVEN FROM OUTSIDE — for the one case where a PARENT owns the click. A
   *  `RailStop`'s whole row is the button, so its chip has no handler of its own and
   *  would never wash by the `onClick`/`selectable` test below, leaving the only
   *  clickable thing in the row giving nothing back. Passing the row's handler to the
   *  chip as well is not the fix — the click would fire on the chip and again on the row
   *  it bubbles to, toggling twice to no effect.
   *
   *  An INPUT, never a second source of truth: an interactive chip still washes on its
   *  own pointer, and this only ever adds. `dim` still refuses. Named `hovered`, not
   *  `hot` — this file's own recede clock already binds `hot`, and a second one shadowed
   *  into it upstream once and dropped every export in the module to a parse error. */
  hovered?: boolean
  /** SELECTABLE OR STATIC — static is the default, and most chips in this product are:
   *  a legend, a trail, a rail and an entry all show nodes being READ. Pass this for a
   *  chip that answers a click, which is what the road's stops and a group's children
   *  are. A click TOGGLES: click again and it is unselected */
  selectable?: boolean
  /** PICKED. A 2px --state-selected outline at 2px offset, sitting OUTSIDE the chip's
   *  own border rather than replacing it — so a picked network node is still visibly a
   *  network node. Hue is the data channel, pond is the state channel, and one stroke
   *  cannot carry both. An outline rather than a border because it takes no layout: a
   *  chip must not move when it is picked, nor shift its neighbours in a chain.
   *  Replaces the `lit` ring while on: one ring per meaning, never stacked.
   *
   *  Pass it and the caller owns the selection (what a board holding more than one must
   *  do); omit it and `selectable` keeps the state here. Drawing follows it either way,
   *  so a board can paint a chip picked without also handing it a gesture */
  selected?: boolean
  /** the starting state when the chip keeps its own. Default false */
  defaultSelected?: boolean
  /** the toggle's report, controlled or not */
  onSelectedChange?: (selected: boolean) => void
  /** tooltip; the stop's note when there is one */
  note?: string
  /** the title wraps (break-word, no clamp) instead of truncating; the chip squares
   *  to --radius-md and top-aligns its furniture so a two-line name reads down */
  wrap?: boolean
  onClick?: () => void
  /** SIZEABLE OR FIXED — fixed is the default. Pass this and the chip's right edge
   *  sizes its width, its bottom edge its height and its corner both; double-click an
   *  edge and that dimension goes back to automatic. Opt-in because three invisible
   *  grab strips are a promise, and most chips are being read rather than arranged — a
   *  strip at every edge of a chip in a twenty-row legend takes the pointer near
   *  something with nothing to answer. Available on EVERY `mark` form: dot, border and
   *  none resize identically, and a chip's form never decides what can be done to it.
   *  Default false (**changed 2026-08-18 upstream, OB-015** — it was true, so a caller
   *  that says nothing now gets the static chip) */
  resizable?: boolean
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  /** CONTROLLED SIZE, on the same terms as VersionedGroup's. Omit and the chip keeps
   *  whatever the user dragged it to; pass these and the caller's numbers win — which is
   *  what a canvas needs, since a size held in the chip's own state cannot be saved
   *  across a reload, undone, or read by anything that aligns or packs. The drag itself
   *  always runs on own state and `onResize` reports on pointer-up; at rest the prop is
   *  authoritative. `null` on an axis is automatic, the same as double-clicking that edge */
  width?: number | null
  height?: number | null
  /** fires on pointer-up after an edge drag, and on the double-click that gives an axis
   *  back to automatic (`null` for that axis) */
  onResize?: (size: { width: number | null; height: number | null }) => void
  /** delete this node — adds a ✕ at the chip's trailing edge that arrives with hover
   *  or focus, berry at rest, and keeps its space reserved so the chip never changes width */
  onDelete?: () => void
}

interface SizeBounds { minW: number; maxW: number; minH: number; maxH: number }
interface SizeState { w: number | null; h: number | null }
type ResizeReport = (size: { width: number | null; height: number | null }) => void

function useSizeDrag(
  ref: React.RefObject<HTMLSpanElement | null>,
  bounds: SizeBounds,
  controlled: SizeState | null,
  onResize?: ResizeReport,
) {
  const [ownSize, setOwnSize] = useState<SizeState | null>(null)
  const [sizing, setSizing] = useState(false)
  /* CONTROLLED SIZE, on the same terms as VersionedGroup's: no prop and the chip keeps
     what it was dragged to, prop and the caller's number wins. A canvas has to own this
     — a size living in this hook cannot be saved across a reload, undone, or read by
     anything that aligns or packs. The drag itself always runs on own state (routing
     every pointermove out and back is what makes a controlled drag lag), so `sizing`
     hands the gesture back for its duration and `onResize` reports on pointer-up. */
  const size = controlled && !sizing ? controlled : ownSize
  const start = (axis: 'x' | 'y' | 'both') => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const box = ref.current && ref.current.getBoundingClientRect()
    if (!box) return
    const node = e.currentTarget as HTMLElement
    const from = { x: e.clientX, y: e.clientY, w: box.width, h: box.height }
    let last: SizeState = { w: (size && size.w) || Math.round(box.width), h: (size && size.h) || Math.round(box.height) }
    /* seed from what is on screen NOW, so a controlled chip does not flash back to
       automatic between pointerdown and the first move */
    setSizing(true)
    setOwnSize(last)
    try { node.setPointerCapture(e.pointerId) } catch { /* older pointer impls */ }
    const move = (ev: PointerEvent) => {
      const w = axis === 'y' ? last.w
        : Math.round(Math.max(bounds.minW, Math.min(bounds.maxW, from.w + (ev.clientX - from.x))))
      const h = axis === 'x' ? last.h
        : Math.round(Math.max(bounds.minH, Math.min(bounds.maxH, from.h + (ev.clientY - from.y))))
      last = { w, h }
      setOwnSize(last)
    }
    const up = () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
      setSizing(false)
      if (onResize) onResize({ width: last.w, height: last.h })
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
  }
  const reset = (axis: 'x' | 'y' | 'both') => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!size) return
    const next: SizeState = { w: axis === 'y' ? size.w : null, h: axis === 'x' ? size.h : null }
    setOwnSize(!next.w && !next.h ? null : next)
    if (onResize) onResize({ width: next.w, height: next.h })
  }
  return [size, start, reset, setOwnSize] as const
}

/* ═══ PUBLISHED GEOMETRY ═════════════════════════════════════════════════════
 *  How wide and how tall is this chip, before it renders?
 *
 *  The same question GroupGeometry answers for the card, asked for the same
 *  reason: a board that lays out arithmetically — AuthorRoad does, and must,
 *  since its arrows, its drop bands and its own extent all need every box
 *  placed before React commits anything — cannot ask a rendered chip how big
 *  it is. So it either guesses or it is told. It guessed: `CHAR_W = 8` for a
 *  proportional face and `LEAF_CHROME_W = 40` for chrome that is really ~83,
 *  so a title scored as one line wrapped to two and was clipped against the
 *  height it had been told.
 *
 *  This table was originally kept in this file because the DS shipped no geometry for
 *  this component (reported on drift-log #74). As of 2026-08-21 it published its own —
 *  `NodeChip.d.ts`'s own PUBLISHED GEOMETRY section — and this port now takes that
 *  contract whole (OB-048): `usedStroke()` for the border edge, no width floor unless
 *  the caller asks for one (`spec.minWidth` defaults to none, not `CHIP_METRICS.minWidth`
 *  — that number is the RESIZE DRAG's floor, not a layout floor), and a height that is
 *  rounded to 2dp rather than ceiled, since a board STACKS on it and a ceiled height puts
 *  a pixel of slack under every chip in a column. Two rules are what make what IS here
 *  hold:
 *
 *  1. CSS OWNS WHAT CSS DECLARES. The stroke, the line height, the font sizes
 *     and the weights are read from the stylesheet at measure time — the very
 *     custom properties the style block below writes — so a token change lands
 *     in the drawing and in the prediction together or not at all.
 *  2. THE TABLE OWNS WHAT JS DECLARES. Every number written as a literal in
 *     that style block lives in CHIP_METRICS and is read back from there, so
 *     the same is true of a padding, a gap or the delete button's box.
 *
 *  Text is MEASURED, not estimated: an offscreen canvas at the chip's own font.
 *  It needs no layout and no paint, so it is legal in the same pass that
 *  computes positions. Without a document (SSR, tests) it falls back to a
 *  0.55em factor and says so via `measured: false`.
 *
 *  `fontOf` / `measure` / `linesOf` are this file's own copies of the group's,
 *  not a shared import — the same call the DS makes for useRecede and
 *  useSizeDrag, and for the same reason: each component stays re-portable on
 *  its own, and a re-sync of one never has to reason about the other.
 *
 *  proven: tools/studio-spike/shot-foldab.mjs renders chips in the road's own
 *  forms and fails on any disagreement between chipSize and the rendered box. */

export const CHIP_METRICS = {
  /** flex gap between the chip's furniture and its title */
  gap: 6,
  /** the 'dot' and 'none' forms take a plain 1px edge; 'border' takes --stroke-rule */
  plainBorder: 1,
  /** wrapping form: squarer, and a touch more room above and below the lines */
  padXWrap: 11, padYWrap: 4,
  /** truncating form: the pill */
  padXFlat: 12, padYFlat: 3,
  /** the dot form reserves a narrower left inset, since the disc sits in it */
  dotPadLeft: 9, dotPadRight: 11, dotPadY: 4,
  /** 'border-2': the mention form. Tighter than the others and 1px rather than --stroke-rule,
   *  because it is a citation rather than an object */
  padXQuiet: 9, padYQuiet: 2, quietBorder: 1,
  /** 'border-2' MEASURED-MENTION MODE (upstream 2026-08-28, absorbing `RelationCards`' private
   *  `RelCardPill`): an ancestor `path` line and/or a multi-line truncated `title` (`maxLines`),
   *  both fitted with `fitLines` rather than CSS wrap — the citation form is small enough that a
   *  hard ellipsis reads better than a mid-word CSS break. `pathFontPx` is tied to no named
   *  token: `RelCardPill` chose it for a small dense pill and no second consumer has asked for
   *  another size to reconcile it against. */
  pathFontPx: 8.5, pathGap: 1,
  dot: 7,
  /** where the disc sits on a STACKED chip — measured, see DOT_FIRST_LINE_INSET. Replaces
   *  the old `dotTop: 6`, which was a correction for top alignment and has no job under
   *  baseline alignment. `indexTop: 1` went with it: the step number now sits on the name's
   *  own baseline, which is what that nudge was approximating by eye. */
  dotTop: DOT_FIRST_LINE_INSET,
  /** THE DISCLOSURE MARK'S LAYOUT BOX IS 6, NOT 8.49. `caretStyle` rotates a 6px box
   *  45°, and transforms are invisible to layout: the wrapper reserves 6px of column and
   *  the flex row sees a 6px-tall child, whatever the ink's bounding box measures. */
  caret: 6,
  /** where THAT mark sits on a stacked chip — a different number from the disc's, since
   *  it is a different shape (see TreeRow's `CARET_FIRST_LINE_INSET`). A centred caret
   *  takes no correction at all. */
  caretTop: CARET_FIRST_LINE_INSET,
  /** the gutter the title keeps from the delete button that follows it */
  titlePadRight: 4,
  /** the delete button: an 18px box pulled 2px into the chip's own right padding */
  del: 18, delPull: 2, delTop: 1,
  /** the resize bounds the component defaults to */
  minWidth: 120, maxWidth: 520, minHeight: 28, maxHeight: 320,
  /** only ever reached without a document: CSS `line-height: normal` is the
   *  font's own metrics, which a canvas cannot report, so this stands in */
  normalLh: 1.36,
}

/* `fontOf`, `measure` and `linesOf` come from ./textMeasure.ts since OB-110 (#256) — the DS's
   one copy of the canvas predictor, shared with `VersionedGroup`; this file carried a
   byte-similar copy of each until then. */

/** a numeric design token, read once from the stylesheet the style block writes
 *  against. `1.5px` and `1.35` both parse; anything unreadable keeps the fallback,
 *  which is the only path a test without a document ever takes. */
const TOKENS: Record<string, number> = {}
function tokenNum(name: string, fallback: number): number {
  const hit = TOKENS[name]
  if (hit !== undefined) return hit
  let v = fallback
  if (typeof document !== 'undefined' && document.documentElement) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const n = parseFloat(raw)
    if (raw && !Number.isNaN(n)) v = n
  }
  TOKENS[name] = v
  return v
}

/** AN AUTHORED STROKE IS NOT THE STROKE THAT IS LAID OUT. The browser lays borders out in
 *  whole DEVICE pixels, so a 1px edge is USED as 0.667 CSS px at dpr 1.5, and this chip's
 *  `border` form — 1.5px authored — is used as 1.333px there. The shell is `border-box`, so
 *  two of those edges sit inside every width and height this file predicts.
 *  `GroupGeometry.hairline()` is this function's 1px case; the chip has two authored weights,
 *  so it needs the general form. NEVER HOIST THE RESULT INTO A CONSTANT: dpr changes when a
 *  window moves between displays, so it has to be asked inside the layout pass. */
export function usedStroke(authored: number): number {
  const r = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
  const device = Math.floor(authored * r)
  return device >= 1 ? device / r : authored
}

/** the room left for text inside a 'border-2' chip at a GIVEN total width — the same
 *  subtraction `chipSize()` does for the quiet form, pulled out so the measured-mention render
 *  path fits `path` and a multi-line `title` against the exact box the CSS will draw rather
 *  than a guess. Only meaningful for `mark="border-2"`; every other form sizes itself from its
 *  own content and never asks. */
function mentionContentWidth(totalWidth: number): number {
  const M = CHIP_METRICS
  return Math.max(10, totalWidth - usedStroke(M.quietBorder) * 2 - M.padXQuiet * 2)
}

/** OB-074: Firefox's `canvas.measureText()` undershoots its OWN real DOM text layout by
 *  up to ~0.5px at this chip's font (measured directly, six titles, `Nunito` 13px/600 —
 *  Chromium's two subsystems agree to ~0.01px, Firefox's do not). `chipSize()` below sizes
 *  the box from a canvas measurement of the full title; a title landing within that gap of
 *  the one-line width was reserved exactly wide enough for its OWN canvas measurement, which
 *  is not quite wide enough for Firefox's real layout of the same string — and since the
 *  chip's box is TOLD that prediction (`AuthorRoad` passes it straight to `width`/`height`),
 *  an under-reservation does not just mispredict, it crops: the box is forced one line short
 *  and the real second line is clipped by the shell's `overflow: hidden`, invisible in
 *  Chromium because its two subsystems happen to agree there. Padding the reserved width by
 *  this much costs nothing visible (the extra column is sub-pixel against a chip's own
 *  rounding) and is cheap insurance against a gap that is real but not worth chasing tighter.
 *  THE CONSTANT ITSELF LIVES IN `textMeasure` (DS OB-217), because the wrap decision there spends
 *  the same pixel for the same reason: this width padding is discarded the moment `chipSize()`
 *  clamps to `maxWidth`, which is exactly when the column is tight enough for the line count to
 *  come back one short in Firefox. */

/** what a chip is going to be, given what it will be handed. The props named
 *  here are the ones that MOVE the box; everything else a chip takes (hue, lit,
 *  selected, dim) is paint, and paint takes no layout — `selected` is an outline
 *  for exactly that reason. */
export interface ChipSpec {
  /** widened to match `NodeChipProps.title` — `chipSpec()` passes it through unchanged, and
   *  `measure()`/`linesOf()` below already take `unknown` and stringify defensively */
  title?: React.ReactNode
  /** the step number, if one is shown — mono, and it is measured, not counted */
  index?: string
  mark?: 'dot' | 'border' | 'border-2' | 'none'
  /** the title wraps instead of truncating. A wrapping chip is STACKED, and a stacked chip
   *  is the form whose height is not a single line */
  wrap?: boolean
  /** the chip is conditional, so it carries the "(optional)" line. ON A FULL-RANK CHIP THIS
   *  MOVES THE BOX — one --fs-micro line taller, and stacked even without `wrap`. A board
   *  that spaces chips from a predicted height and does not pass this reserves one line too
   *  few and laps its own next row. On `border-2` the word is inline and costs nothing. */
  optional?: boolean
  /** heads a disclosure, so it reserves the caret column. 12px, paid once */
  disclosable?: boolean
  /** the emphasis end of a relationship: --fw-bold, and therefore WIDER */
  focus?: boolean
  /** a delete button is offered. It reserves its space at rest, so it counts even unhovered */
  deletable?: boolean
  /** the caller's bounds. `maxHeight` becomes a LINE CLAMP rather than a crop:
   *  the height returned always matches the lines actually drawn, so a title too
   *  long for the bound loses its tail (the chip's own `overflow: hidden`) instead
   *  of the box lying about how tall it is. Defaults are the component's own. */
  minWidth?: number
  maxWidth?: number
  maxHeight?: number
}

export interface ChipSize {
  width: number
  height: number
  /** how many lines the title actually takes at `width` — after the clamp */
  titleLines: number
  /** the column left for the title once the furniture has taken its share */
  titleColumn: number
  /** false when there was no canvas and the text is a 0.55em estimate */
  measured: boolean
}

/** The chip's box at the width it will settle on: as wide as one line of title
 *  wants, bounded, and as tall as that title then takes at that width. */
export function chipSize(spec?: ChipSpec): ChipSize {
  const M = CHIP_METRICS
  const s = spec || {}
  const quiet = s.mark === 'border-2'
  const bordered = s.mark === 'border' || quiet
  const plain = s.mark === 'none'
  const wrap = !!s.wrap
  const optional = !!s.optional
  /* STACKED = baseline-aligned and more than one row. A full-rank optional chip is stacked
     WITHOUT wrapping, because the word sits under the name — which is the one way this
     predictor can be wrong in a direction a board notices, so it is named rather than
     folded into `wrap`. */
  const stacked = wrap || (optional && !quiet)

  const stroke = tokenNum('--stroke-rule', 1.5)
  const snug = tokenNum('--lh-snug', 1.35)
  const fsTitle = tokenNum('--fs-body', 13)
  const fsIndex = tokenNum('--fs-micro', 11)
  const fwTitle = tokenNum('--fw-semibold', 600)
  const fwIndex = tokenNum('--fw-regular', 400)
  /* the mention form sets its own type: caption at medium, not body at semibold */
  const fsCaption = tokenNum('--fs-caption', 12)
  const fwMedium = tokenNum('--fw-medium', 500)
  const fsText = quiet ? fsCaption : fsTitle
  /* FOCUS OUTRANKS THE RANK, on weight and therefore here too: --fw-bold is wider than
     either resting weight, so a focus chip predicted at semibold clips its own name. */
  const fwText = s.focus ? tokenNum('--fw-bold', 700) : quiet ? fwMedium : fwTitle

  /* the shell is border-box, so its border and padding come out of the width — and the
     border is the USED stroke, not the authored one (usedStroke, OB-048). The mention
     form is 1px and tighter on both axes — it is a citation, not an object. */
  const edge = usedStroke(quiet ? M.quietBorder : bordered ? stroke : M.plainBorder) * 2
  const padX = quiet ? M.padXQuiet * 2
    : bordered || plain ? (wrap ? M.padXWrap : M.padXFlat) * 2
    : M.dotPadLeft + M.dotPadRight
  const padY = (quiet ? M.padYQuiet
    : bordered || plain ? (wrap ? M.padYWrap : M.padYFlat) : M.dotPadY) * 2

  /* every flex child except the title, and the gap between each pair. The resize
     handles are position:absolute, so they are out of flow and take no width. */
  const furniture: number[] = []
  if (s.disclosable) furniture.push(M.caret)
  if (!bordered && !plain) furniture.push(M.dot)
  if (s.index) furniture.push(measure(s.index, fwIndex, fsIndex, 'mono'))
  /* marginRight: -2 pulls the delete button back into the chip's own right padding */
  if (s.deletable) furniture.push(M.del - M.delPull)
  const gaps = furniture.length * M.gap
  const chrome = edge + padX + furniture.reduce((a, b) => a + b, 0) + gaps
    + (s.deletable ? M.titlePadRight : 0)

  /* THERE IS NO WIDTH FLOOR UNLESS THE CALLER ASKS FOR ONE (OB-048). `CHIP_METRICS.minWidth`
     (120) is the RESIZE DRAG's floor, not a layout floor: the shell's CSS floor is
     `min-content`, which for one line of title is exactly the width measured above, so a
     chip whose name is short DRAWS short — measured 100.4, 99.65 and 93.55px for the dot,
     mention and none forms against the old prediction of 120. `spec.minWidth` stays
     available for a caller that wants a floor of its own (a column of chips evened up by
     hand, which is every caller on this road today), and it defaults to none. */
  const minW = s.minWidth === undefined ? 0 : s.minWidth
  const maxW = s.maxWidth === undefined ? M.maxWidth : s.maxWidth
  /* on the mention form the word runs INLINE after the name, so it is part of the one line
     the chip wants to be. On a full-rank chip it is its own row and costs height, not width. */
  const oneLine = measure(s.title, fwText, fsText, 'ui')
    + (optional && quiet ? measure(' (optional)', fwIndex, fsText, 'ui') : 0)
  /* read LAST of the measurements above, so the canvas has been settled by the call */
  const measured = canMeasure()
  /* + WRAP_SAFETY_PX: see its own docblock. The reservation is padded by the SAME pixel
     `linesOf()` now narrows its column by (DS OB-217), so the two cancel exactly for an
     unclamped chip: the column is at least `oneLine + WRAP_SAFETY_PX`, the wrap test compares
     against `oneLine` or more, and a one-line title still predicts one line. Where the width
     clamps to `maxWidth` the padding is gone and the narrowed wrap test is what keeps Firefox
     from reserving a line too few. */
  const width = Math.max(minW, Math.min(maxW, Math.ceil(chrome + oneLine + WRAP_SAFETY_PX)))
  const titleColumn = Math.max(1, width - chrome)

  /* wrapping, the line box is --lh-snug on the shell, inherited unitless so each
     child multiplies its OWN size by it. Truncating, there is no line-height at
     all and CSS falls back to the font's normal metrics, which no canvas reports. */
  const lh = stacked || quiet ? snug : M.normalLh
  const lineH = fsText * lh
  /* the height bound is spent on LINES, so the box never claims a height the
     drawn text does not fill */
  const room = s.maxHeight === undefined ? 0
    : Math.max(1, Math.floor((s.maxHeight - padY - edge) / lineH))
  const titleLines = wrap ? Math.max(1, linesOf(s.title, titleColumn, fwText, fsText, 'ui', room)) : 1

  /* THE "(optional)" LINE IS PART OF THE TITLE'S COLUMN, not a fourth flex child: it is a
     block inside the title span, so it stacks under the name rather than sitting beside it.
     Full-rank only — on the mention form it is inline and already counted in the width. */
  const optionalLine = optional && !quiet ? fsIndex * snug : 0

  /* A stacked chip aligns on the name's first-line BASELINE and every other child either
     sits on that baseline or opts out with a measured inset, so the row is still the tallest
     child — but with no nudge on the step number, which baseline alignment makes exact. */
  const rows = [titleLines * lineH + optionalLine]
  if (s.index) rows.push(fsIndex * lh)
  if (s.deletable) rows.push(M.del + (stacked ? M.delTop : 0))
  if (!bordered && !plain) rows.push(M.dot + (stacked ? M.dotTop : 0))
  if (s.disclosable) rows.push(M.caret + (stacked ? M.caretTop : 0))

  /* WIDTH IS CEILED, HEIGHT IS NOT (OB-048), and the asymmetry is deliberate. A width one
     pixel short clips the name it was computed for, and a pixel of extra column costs
     nothing, so the width rounds up. A HEIGHT is what a board STACKS ON, so it is published
     as the number the browser will lay out (2dp): ceiling a 27.01 up to 28 put a pixel of
     slack under every chip in a column, and a column of forty stops was 40px longer than
     the road it draws. */
  const height = Math.round((Math.max.apply(null, rows) + padY + edge) * 100) / 100
  return { width, height, titleLines, titleColumn: Math.round(titleColumn * 100) / 100, measured }
}

/** THE SPEC, DERIVED FROM THE PROPS YOU ALREADY HAVE — pass the same object you spread onto
 *  `<NodeChip>`. It keeps the fields that move the box, translates `onDelete` to `deletable`,
 *  and drops the paint. Prefer this to writing a spec by hand: three of the four box-moving
 *  props (`optional`, `focus`, `disclosable`) look like paint, and forgetting one is silent —
 *  AuthorRoad passed `optional` to the chip and not to `chipSize()` and reserved one line too
 *  few, live, until someone noticed. Build a spec by hand only when the box being measured is
 *  not the box being rendered — a hypothetical width, a what-if. */
export function chipSpec(props: NodeChipProps): ChipSpec {
  const spec: ChipSpec = {
    title: props.title, index: props.index, mark: props.mark,
    wrap: props.wrap, optional: props.optional, disclosable: props.disclosable, focus: props.focus,
    deletable: !!props.onDelete,
  }
  /* the bounds are copied only when SET, so an omitted one keeps this file's own default
     rather than arriving as an explicit `undefined` that reads as "no bound" */
  if (props.minWidth !== undefined) spec.minWidth = props.minWidth
  if (props.maxWidth !== undefined) spec.maxWidth = props.maxWidth
  if (props.maxHeight !== undefined) spec.maxHeight = props.maxHeight
  return spec
}

/** `chipSize(chipSpec(props))` — the box this chip will be, given the props it is handed. */
export function chipSizeOf(props: NodeChipProps): ChipSize {
  return chipSize(chipSpec(props))
}

export const ChipGeometry = { CHIP_METRICS, chipSize, chipSpec, chipSizeOf, CHIP_BORDER, chipBorder, usedStroke }

export function NodeChip({
  title, index, domain, mark = 'dot', dim, optional, lit, focus, note, wrap, onClick, onDelete,
  path, pathMaxLines, maxLines,
  disclosable, open, hovered,
  selectable = false, selected, defaultSelected = false, onSelectedChange,
  resizable = false,
  minWidth = CHIP_METRICS.minWidth, maxWidth = CHIP_METRICS.maxWidth,
  minHeight = CHIP_METRICS.minHeight, maxHeight = CHIP_METRICS.maxHeight,
  width, height, onResize,
}: NodeChipProps) {
  /* the SAME table chipSize() above predicts from — read, never copied */
  const M = CHIP_METRICS
  /* through the RESOLVER, not a table: `domainToken` answers the fallback swatch for anything
     that is not a ring name, which a bare map lookup could not do now that `domain` is a string. */
  const hue = domainToken(domain)
  const quiet = mark === 'border-2'
  const bordered = mark === 'border' || quiet
  const plain = mark === 'none'
  /* see ChipSpec.optional: a full-rank optional chip is two rows without wrapping */
  const stacked = wrap || (optional && !quiet)
  /* OPEN DRAWS A CARET AND MOVES NO OTHER CHANNEL. Every other one is spoken for — the
     FACE is hover and `selected`; the border WEIGHT is read back by `NodeChain` and
     `NodeArrow` through `chipBorder`, so thickening it on open would re-weight every
     arrow through an expanded stop's chain; the border STYLE is `optional`; the OUTLINE
     is `selected`; the RING is `lit`; type weight belongs to the rank ladder. Elevation
     was tried for this state and every rung of it (a recess, a recess with a face tint,
     `--lift-1` through `--lift-3`) read as no change at all — `tokens/elevation.css`
     calls its shadows "soft, wide and low-contrast" by design, and a channel built not
     to shout cannot carry a state on a 28px object. So `depth` here answers to `focus`
     alone: one step up the lift ladder, none at all for the quiet or dim forms unless
     focused too. */
  const depth = quiet || dim ? (focus ? 'var(--lift-1)' : 'none') : (focus ? 'var(--lift-2)' : 'var(--lift-1)')
  /* drawn from the prop when there is one, from own state when there is not — and
     drawing follows `isSel` even without `selectable`, so a board that owns the whole
     selection can paint a chip picked without also handing it a gesture it must not have */
  const [ownSel, setOwnSel] = useState(!!defaultSelected)
  const isSel = selected === undefined ? ownSel : selected
  const toggle = () => {
    const next = !isSel
    if (selected === undefined) setOwnSel(next)
    if (onSelectedChange) onSelectedChange(next)
  }
  const [hot, showX, hideX] = useRecede()
  /* A SECOND HOVER STATE, AND IT HAS TO BE SEPARATE FROM `hot`. `useRecede` holds `hot` true
     for a grace period after the pointer leaves, so a revealed ✕ does not vanish from under a
     pointer travelling towards it. A FACE WASH has no such errand: it must drop the instant
     you leave, or the chip sits lit beside the one you actually moved to. Same handlers, two
     clocks — the control lingers, the wash does not. */
  const [hov, setHov] = useState(false)
  /* A CHIP WASHES ON HOVER ONLY IF IT IS SOMETHING TO DO. Most chips in this product are
     being READ — a legend, a trail, an entry's ends, a rail of names — and feedback on those
     promises an act that is not there. `onClick` or `selectable` is the whole test, the same
     one `cursor` already uses below. `dim` never washes: off the resolved path is a statement
     about the node, and lighting it up on the way past contradicts it. */
  const interactive = !!(onClick || selectable)
  /* `hovered` IS THE WASH DRIVEN FROM OUTSIDE, for the one case the test above gets
     wrong: a parent that owns the click (a RailStop's row). An INPUT, never a second
     source of truth — an interactive chip still washes on its own pointer, and
     `hovered` only ever adds. `dim` refuses either way. */
  const washed = (interactive || hovered) && (hov || hovered) && !dim
  /* MEASURED-MENTION MODE: only the 'border-2' rank, only when the caller has both given a
     fixed `width` and asked for `path` and/or more than one truncated line. Every other
     'border-2' chip — a bare mention, `EdgeEntry`'s two ends — keeps the plain single-line CSS
     ellipsis it always had, so this is purely additive and no existing caller moves. */
  const mentionMeasured = quiet && typeof width === 'number' && typeof title === 'string' && !!(path || (maxLines && maxLines > 1))
  let titleLines: string[] | null = null
  let pathLines: string[] | null = null
  let mentionCut = false
  if (mentionMeasured && typeof width === 'number' && typeof title === 'string') {
    const contentW = mentionContentWidth(width)
    /* the fit is compared to its input with whitespace squashed out, because `fitLines` rebuilds
       the string a line at a time and a re-joined run differs from the original by its spaces
       alone. Only a genuinely LOST character should arm the tooltip. */
    const squashEq = (a: unknown, b: unknown) => String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, '')
    titleLines = fitLines(title, contentW, { fontPx: tokenNum('--fs-caption', 12), bold: focus, maxLines: maxLines || 2, pad: 0 })
    const titleCut = !squashEq(titleLines.join(''), title)
    const parts = (path || []).filter(Boolean)
    const pathOpts = { fontPx: CHIP_METRICS.pathFontPx, maxLines: pathMaxLines || 2, pad: 0 }
    let pathText: string | null = null
    let pathCut = false
    /* the longest run ENDING AT THE PARENT that fits, tried from the root inward. `../ ` marks
       that the chain no longer starts at the root: trimming the FAR end is silent (a reader can
       infer what a name implies) while dropping the NEAR end removes context that cannot be
       recovered — so any `i > 0` here has already lost the root and says so. */
    for (let i = 0; i < parts.length; i++) {
      const candidate = (i > 0 ? '../ ' : '') + parts.slice(i).join(' / ') + ' /'
      const wrapped = fitLines(candidate, contentW, pathOpts)
      if (squashEq(wrapped.join(''), candidate)) { pathLines = wrapped; pathText = candidate; break }
    }
    if (!pathLines && parts.length) {
      /* nothing fits whole — draw the parent alone and let it ellipsise, rather than nothing */
      pathText = (parts.length > 1 ? '../ ' : '') + parts[parts.length - 1] + ' /'
      pathLines = fitLines(pathText, contentW, pathOpts)
    }
    if (pathText) pathCut = !squashEq(pathLines!.join(''), pathText)
    mentionCut = titleCut || pathCut
  }
  const shell = useRef<HTMLSpanElement | null>(null)
  const given: SizeState | null = width === undefined && height === undefined ? null
    : { w: width || null, h: height || null }
  const [size, startSize, resetSize, setSizeFromLayout] = useSizeDrag(
    shell, { minW: minWidth, maxW: maxWidth, minH: minHeight, maxH: maxHeight }, given, onResize)

  useEffect(() => {
    const el = shell.current
    /* a told size is the caller's to correct — writing a measured one back would fight
       the prop every frame, and the loop this guards against is the drag's own */
    if (!el || !size || given) return
    const w = size.w ? Math.max(size.w, Math.round(el.offsetWidth)) : size.w
    const h = size.h ? Math.max(size.h, Math.round(el.offsetHeight)) : size.h
    if (Math.abs((w || 0) - (size.w || 0)) > 1 || Math.abs((h || 0) - (size.h || 0)) > 1) {
      setSizeFromLayout({ w, h })
    }
  })

  return (
    <span
      ref={shell}
      /* the native tooltip is a STRING attribute, so a composed `title` cannot go in it —
         which is why the contract says to pass `note` alongside a non-string title. Falling
         back to `undefined` rather than stringifying: React would render "[object Object]"
         into the attribute, and a tooltip that lies is worse than one that is absent. */
      /* a MEASURED MENTION carries the whole citation — ancestry and name — and only when
         something was actually cut; the drawn lines already say the rest, and a tooltip
         repeating what is on screen is noise on every pill in the list. */
      title={mentionMeasured
        ? (mentionCut ? wrapTip((path || []).filter(Boolean).concat([String(title)]).join(' / ')) : undefined)
        : wrapTip(note || (typeof title === 'string' ? title : undefined))}
      /* announced, not just drawn — only when the chip is actually the control:
         `aria-expanded` on a span nothing can activate promises a keyboard behaviour
         that is not there. */
      aria-expanded={disclosable && (selectable || onClick) ? !!open : undefined}
      onClick={() => { if (selectable) toggle(); if (onClick) onClick() }}
      /* both clocks off the same four handlers — the control lingers (`showX`/`hideX` hold
         `hot` through a grace period so a revealed ✕ stays reachable), the wash does not */
      onMouseEnter={() => { showX(); setHov(true) }}
      onMouseLeave={() => { hideX(); setHov(false) }}
      onFocus={() => { showX(); setHov(true) }}
      onBlur={() => { hideX(); setHov(false) }}
      style={{
        boxSizing: 'border-box',
        position: 'relative', display: 'inline-flex', gap: M.gap,
        /* A STACKED CHIP ALIGNS ON THE NAME'S FIRST-LINE BASELINE, told a height or
           not. This was OURS first — reported as OB-027, adopted by the DS verbatim
           on 2026-08-19 and handed back as OB-035 — so the line is unchanged and it
           is no longer a deviation. What follows is why it is the rule, kept because
           both alternatives are what a flex row reaches for first.

           The two spans have DIFFERENT LINE BOXES: the index at --fs-micro 11 x
           --lh-snug is 14.85, the title at --fs-body 13 x --lh-snug is 17.55. No top-
           or centre-alignment makes two unequal boxes share a line. Measured against
           the title's FIRST line, which is the line the number belongs on at any
           length: `flex-start` is a constant -3px, `center` is -2.14 at one line and
           DRIFTS with the block (+6.63 at two, +15.41 at three), `baseline` is 0.00 at
           one, two and three lines.

           AND A TOLD HEIGHT GETS NO BRANCH OF ITS OWN. The first upstream fix read
           `size && size.h ? 'center' : (stacked ? 'baseline' : 'center')`, which put
           the drift straight back for any caller that sets a height — and that is
           every caller here. A BOARD THAT LAYS ITSELF OUT ARITHMETICALLY TELLS EVERY
           LEAF ITS HEIGHT: `AuthorRoad` asks `chipSize()` and hands back `{w, h}` for
           every stop, so the told path is the ONLY path on our road, and the branch
           upstream treated as the exception is our rule. Told column, measured by
           shot-foldab: -2.64 / +6.13 / +14.91 at one, two and three lines — the same
           drift their own rig had already disqualified `center` for. Their specimens
           all size themselves, which is why none of them showed it.

           A told height still centres a chip that is NOT stacked, and that is right:
           one line in a hand-set box has real slack, and text pinned to its top reads
           as a layout accident. Safe here because the X carries its own alignSelf and
           `mark="border"` has no dot — a dot-form chip would need its marginTop
           revisited, which is the DS's call. */
        alignItems: stacked ? 'baseline' : 'center',
        width: (size && size.w) || undefined, height: (size && size.h) || undefined,
        /* THE TEXT IS THE FLOOR — but only where the text cannot reflow. A WRAPPING CHIP
           TAKES 0 INSTEAD, which is not an exception to that rule but the same rule where
           breaking IS possible. As a flex item, `min-width: min-content` OVERRIDES
           `max-width: 100%`, so a chip whose longest word is wider than its share of a row
           spilled straight out of its container (the DS's connections pane, owner-reported
           2026-08-19). At 0 the box takes its container's width and the title's own
           `overflow-wrap: break-word` breaks the long word onto another line, with
           `min-height: fit-content` growing the box to hold it. Nothing is hidden — the words
           move instead of the border moving. A NOWRAP chip keeps the floor, because there
           breaking is unavailable and the only thing that could give is the name itself.
           THE DIAGNOSTIC, for next time: a wrapping failure looks like TEXT overflowing; a
           min-content floor looks like the BOX overflowing, with the text already wrapped and
           still not fitting. Resize is unaffected — the drag's floor is the `minWidth` PROP
           inside useSizeDrag, not this. */
        minWidth: wrap ? 0 : 'min-content', minHeight: 'fit-content',
        maxWidth: size && size.w ? 'none' : '100%',
        userSelect: 'none', WebkitUserSelect: 'none',
        /* no disc means no room reserved for one: 'none' takes the bordered padding,
           which is symmetric, rather than the dot form's narrower left inset */
        padding: quiet ? `${M.padYQuiet}px ${M.padXQuiet}px`
          : bordered || plain
          ? (wrap ? `${M.padYWrap}px ${M.padXWrap}px` : `${M.padYFlat}px ${M.padXFlat}px`)
          : `${M.dotPadY}px ${M.dotPadRight}px ${M.dotPadY}px ${M.dotPadLeft}px`,
        borderRadius: stacked || quiet ? 'var(--radius-md)' : 'var(--radius-pill)',
        /* DASHED, NEVER A DIFFERENT COLOUR OR WEIGHT. The hue is the domain and the width is
           what a connector matches (`chipBorder`), so neither is available to say `optional`;
           the line's STYLE is the free channel. On the dot form the border is neutral and the
           hue lives in the disc, so the neutral line is what dashes — same statement, same
           place, whichever form the chip takes. */
        border: quiet
          ? M.quietBorder + 'px ' + (optional ? 'dashed ' : 'solid ') + (dim ? 'var(--border-hair)' : hue)
          : bordered
          ? 'var(--stroke-rule) ' + (optional ? 'dashed ' : 'solid ') + (dim ? 'var(--border-hair)' : hue)
          : M.plainBorder + 'px ' + (optional ? 'dashed ' : 'solid ') + (dim ? 'var(--border-hair)' : 'var(--border-rule)'),
        /* takes no layout and leaves the chip's own border readable under it */
        outline: isSel ? 'var(--stroke-ring) solid var(--state-selected)' : undefined,
        /* 2px, not 1: at 1px the 2px pond ring all but touched the 1.5px domain border
           and the two merged into one heavy ~3.5px stroke — which loses the domain hue
           at the exact moment the node is being acted on, and makes a selected chip
           read as a different shape from a selected group, which has no border under
           its ring. 2px of paper between them and both strokes read as themselves. */
        outlineOffset: isSel ? 2 : undefined,
        /* THE FACE STEP, AND NOTHING ELSE. The border is not touched: it carries the DOMAIN,
           and a hue is never a state in this system — nor is the geometry, the lift, or the
           type. `quiet` has no face of its own, so its step is the plain wash over whatever it
           sits on; a filled chip takes the RAISED token, because a wash cannot tint white.
           Hover is deliberately a WEAKER VERSION OF SELECTED rather than a mark of its own, so
           pointing at a chip previews what a click would do. And it lights the CHIP, never the
           row around it — the DS tried a row-wide band in the connections pane on 2026-08-19
           and pulled it the same day. Where the ROW is the object (a TreeRow) the row is right
           to wash; a chip on a rail is the object. */
        background: dim ? 'transparent'
          : quiet ? (washed ? 'var(--surface-hover)' : 'transparent')
          : washed ? 'var(--surface-hover-raised)' : 'var(--surface-raised)',
        color: dim ? 'var(--text-3)' : focus ? 'var(--text-1)' : quiet ? 'var(--text-2)' : 'var(--text-1)',
        /* the second rank takes NO LIFT at all: a mention is not standing on the pane, and a
           ring on it would claim it is the object rather than a reference to one. `depth`
           already folds in `focus`, `quiet` and `dim`; `selected` replaces the `lit` ring —
           one ring per meaning, never stacked — drawn as an outline outside the border. */
        boxShadow: isSel ? depth
          : lit ? (depth === 'none' ? 'var(--ring-linked)' : 'var(--ring-linked), ' + depth)
          : depth,
        fontFamily: 'var(--font-ui)',
        fontSize: quiet ? 'var(--fs-caption)' : 'var(--fs-body)',
        /* FOCUS OUTRANKS THE RANK, on both weight and ink: `border-2` sets its own quieter
           type (caption at --fw-medium, --text-2), and if the rank won here, `focus` would
           silently do nothing on the one form that most needs it — `EdgeEntry` draws both
           ends of a relationship as border-2 chips and marks the focus end with exactly
           this emphasis. */
        fontWeight: focus ? 'var(--fw-bold)' : quiet ? 'var(--fw-medium)' : 'var(--fw-semibold)',
        lineHeight: stacked || quiet ? 'var(--lh-snug)' : undefined,
        whiteSpace: wrap ? 'normal' : 'nowrap', overflow: 'hidden',
        /* 'inherit', not 'default': a chip inside a NodeChain sits on a slot that says
           move, and a chip that reasserted the plain arrow hid the one affordance the
           chain provides. A chip that is itself clickable keeps pointer. */
        cursor: onClick || selectable ? 'pointer' : 'inherit',
        opacity: dim ? 'var(--opacity-off-path)' : 1, transition: 'var(--transition-wash)',
      }}
    >
      {disclosable ? (
        /* THE DISCLOSURE MARK, FIRST CHILD — leading, matching TreeRow's own and the
           rail head's, and leaving the trailing edge to onDelete's ✕. A consistent 12px
           shift on every disclosable chip's title (the 6px mark plus this chip's own 6px
           gap) is not a misalignment. Colour sits on this wrapper because the mark itself
           is `currentColor`; a centred caret takes no vertical correction, a stacked one
           takes `caretTop` (TreeRow's `CARET_FIRST_LINE_INSET` — a different shape from
           the dot's inset, not interchangeable with it). */
        <span style={{
          flexShrink: 0, display: 'flex', width: M.caret, justifyContent: 'center',
          color: open ? 'var(--text-1)' : 'var(--text-3)',
          alignSelf: stacked ? 'flex-start' : undefined,
          marginTop: stacked ? M.caretTop : 0,
          transition: 'color var(--dur-fade) var(--ease-soft)',
        }}>
          <Caret open={open} />
        </span>
      ) : null}
      {bordered || plain ? null : (
        <span style={{
          width: M.dot, height: M.dot, borderRadius: 'var(--radius-pill)', flexShrink: 0,
          background: hue,
          /* opts OUT of baseline alignment — a box with no text has no baseline, so CSS
             synthesizes one from its border box and the disc reads 0.83px low. Placed against
             the first line's TOP instead, which does not move as the name wraps. */
          alignSelf: stacked ? 'flex-start' : undefined,
          marginTop: stacked ? M.dotTop : 0,
        }} />
      )}
      {index ? (
        <span style={{
          flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)',
          fontVariantNumeric: 'var(--tnum)', fontWeight: 'var(--fw-regular)',
          /* NO VERTICAL CORRECTION: baseline alignment puts this on the name's own baseline,
             which is what the old `marginTop: 1` was approximating by eye. */
          color: 'var(--text-3)', opacity: dim ? 0.8 : 1,
        }}>{index}</span>
      ) : null}
      {/* 'break-word', not 'anywhere': anywhere breaks mid-word at the first
          opportunity, which on a narrow chip left single letters sitting against
          the border. Word boundaries first; only split a word that cannot fit. */}
      <span style={{
        /* a told-width mention fills its box, so its centred lines are centred on the CHIP and
           not on their own longest line — which is what makes a two-line citation read as one
           block. Every other form keeps sizing to its content. */
        minWidth: 0, flex: (quiet && typeof width === 'number') ? 1 : (onDelete ? 1 : '0 1 auto'),
        /* block, so the name and the (optional) line below it are two rows rather than one
           inline run with a block in the middle of it */
        display: optional && !quiet ? 'block' : undefined,
        overflow: 'hidden',
        textAlign: quiet ? 'center' : undefined,
        overflowWrap: wrap ? 'break-word' : undefined, wordBreak: wrap ? 'normal' : undefined,
        textOverflow: wrap ? 'clip' : 'ellipsis',
        paddingRight: onDelete ? M.titlePadRight : 0,
      }}>{mentionMeasured ? (
        <>
          {pathLines ? (
            <span style={{ display: 'block', fontSize: M.pathFontPx, fontWeight: 'var(--fw-medium)', color: 'var(--text-3)', lineHeight: 1.2, marginBottom: M.pathGap }}>
              {pathLines.map((ln, i) => <span key={i} style={{ display: 'block' }}>{ln}</span>)}
            </span>
          ) : null}
          {titleLines!.map((ln, i) => <span key={i} style={{ display: 'block' }}>{ln}</span>)}
        </>
      ) : (<>{title}{optional && quiet ? (
        <span style={{ fontStyle: 'italic', fontWeight: 'var(--fw-regular)', color: 'var(--text-3)' }}> (optional)</span>
      ) : null}{optional && !quiet ? (
        /* ITALIC AT REGULAR WEIGHT, and that pairing is not a taste call: Nunito is loaded at
           `ital,wght 1,400` only, so an italic string asked for medium or semibold is
           SYNTHESISED by the browser — a slanted upright, heavier and blurrier than the real
           face beside it. Italic already carries one meaning here (the group's empty
           description): a thing that is not there yet. An optional step is exactly that, so
           the register is borrowed rather than overloaded.
           A separate element, never part of `title`: `title` is the node's NAME, reproduced
           verbatim, and a caller appending "(optional)" to it would be editing the name. */
        <span style={{
          display: 'block', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-regular)',
          fontStyle: 'italic', color: 'var(--text-3)', lineHeight: 'var(--lh-snug)',
        }}>(optional)</span>
      ) : null}</>)}</span>
      {resizable ? (
        <>
          <span aria-hidden="true" title={wrapTip(RESIZE_TIP)}
            onPointerDown={startSize('x')} onDoubleClick={resetSize('x')}
            style={{ position: 'absolute', top: 8, bottom: 8, right: 0, width: 7, zIndex: 2, background: 'transparent', cursor: 'ew-resize', touchAction: 'none' }} />
          <span aria-hidden="true" title={wrapTip(RESIZE_TIP)}
            onPointerDown={startSize('y')} onDoubleClick={resetSize('y')}
            style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 7, zIndex: 2, background: 'transparent', cursor: 'ns-resize', touchAction: 'none' }} />
          <span aria-hidden="true" title={wrapTip(RESIZE_TIP)}
            onPointerDown={startSize('both')} onDoubleClick={resetSize('both')}
            style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, zIndex: 3, background: 'transparent', cursor: 'nwse-resize', touchAction: 'none' }} />
        </>
      ) : null}
      {onDelete ? (
        <button type="button" title={wrapTip('delete this node')} aria-label="delete this node"
          tabIndex={hot ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--state-danger-wash)'; e.currentTarget.style.borderColor = 'var(--state-danger)'; e.currentTarget.style.color = 'var(--berry-600)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--state-danger)' }}
          style={{
            width: M.del, height: M.del, flexShrink: 0, marginLeft: 'auto', marginRight: -M.delPull, padding: 0,
            display: 'grid', placeItems: 'center', boxSizing: 'border-box',
            borderRadius: 'var(--radius-pill)', border: '1px solid transparent', background: 'transparent',
            color: 'var(--state-danger)', fontFamily: 'var(--font-ui)', fontSize: 10, lineHeight: 1,
            cursor: 'pointer', opacity: hot ? 1 : 0, pointerEvents: hot ? 'auto' : 'none',
            /* opts out of the row's baseline alignment and pins to the FIRST LINE, the same
               reference the disc uses. `stacked`, not `wrap`: an optional chip is two lines
               tall without wrapping and the ✕ belongs beside the name either way. */
            alignSelf: stacked ? 'flex-start' : 'center', marginTop: stacked ? M.delTop : 0,
            transition: 'opacity var(--dur-fade) var(--ease-soft), var(--transition-wash)',
            /* drawn, never typed: a text ✕ sits high of centre and comes from the platform's
               fallback font (OB-201) */
          }}><CloseMark size={10} /></button>
      ) : null}
    </span>
  )
}

/** WHAT A LINE MEETING THIS COMPONENT HAS TO MATCH, declared on the component so a container
 *  can read it without knowing what the component is. Set to the DEFAULT form's weight, for
 *  `<NodeChip title domain />` with no explicit `mark`: `props.mark` is undefined there, so a
 *  container reading props alone would learn nothing and fall back to full rank — a 1.5 shaft
 *  against a 1px dot-form border, which is the bug this whole thread is about. A container
 *  reads `props.mark` FIRST (it is the more specific fact) and this second.
 *  Anything new an arrow can meet should declare one; `VersionedGroup` does. Only a host's own
 *  box, which cannot declare anything to us, passes a number itself. */
NodeChip.joinBorder = CHIP_BORDER.dot
