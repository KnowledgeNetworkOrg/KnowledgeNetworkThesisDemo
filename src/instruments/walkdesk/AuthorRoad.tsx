// The WALK EDITOR's road — a top-down node chart where the road may fork. A fork
// is a GROUP CARD with more than one variant. Its history: a tab strip (#19),
// then side-by-side comparator COLUMNS (#18). Since #70 the card shows ONE
// version at a time — the ACTIVE one — as a single column. The comparator and
// the ☑/☐ visibility namecard (#15 / 0005 D5) are retired: showing every version
// at once was the thing being simplified away. "Which version is shown" and
// "which version is active" are now the SAME thing, so the two channels collapse
// into one — `choices`/chosenIdx alone.
//
// A container — open or folded — is the DS VersionedGroup, hosted whole. Open, it
// runs in the DS's chrome-only mode (`bodySlot`): the component draws the well,
// the head (outline number · title · tally · fold/ungroup), the description, the
// version picker and its menu, the ancestry rail and the empty-version zone, and
// leaves the body EMPTY for the road to float the active version's steps into as
// board-level siblings. Retitle, describe, rename, switch, add and delete
// versions, fold and ungroup are the component's gestures, wired to ops on
// `authordraft` so undo/redo holds. The road never draws a head of its own now.
//
// The single column is the road (numbered, live arrows) when the container is on
// the road; off-road it's muted+faded with ghost arrows (the same onRoad/dim
// machinery a skipped optional uses).
//
// An OPTIONAL stop is drawn like any other but with a DASHED border and a DASHED
// arrow leading into it — the two signals that it may be skipped. There is no
// separate bypass rail any more; the dashed edge + inbound arrow carry it.
//
// Layout is arithmetic (measure → place): no DOM measurement, one SVG underlay
// for the walk arrows. Step nodes float as board-level siblings OVER each card,
// so no inner click bubbles into a parent.

import { useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

import { byId, childrenOf, domainIds, topicHueOf } from '../../corpus/graph'
import {
  ARROW_METRICS, NodeArrow, NodeChip, NodePicker, chipBorder, chipSizeOf, shaftTailOffset,
  VersionedGroup, GroupGeometry, GROUP_METRICS,
  wrapTip, PaneScroller,
} from '@/ds'
import type { GroupSpec, NodeOption } from '@/ds'
import type { AuthorState, Path } from './authordraft'
import { pathKey, useFreshGroup } from './authordraft'
import { bandFor, DT, gapFor, handleDrop } from './authordnd'
import type { Band } from './authordnd'
import { chosenIdx, chosenSteps, isLeaf } from './mockwalk'
import type { Stop } from './mockwalk'
import type { HoverBinding } from '../../state/bus'

const NODEW = 150
// an UNSET slot is the road's own picker — a dashed pill round a <select> — so
// this is the road's box to choose. A BOUND leaf is a NodeChip and asks that
// component for its own; see leafSize.
const NODEH = 34
// a leaf title used to `truncate` at NODEW; it now WRAPS and the node grows to
// fit, but only up to these bounds so one long title can't balloon the board (#72).
// These two are the road's POLICY — how much of the board one stop may take — and
// they are the only leaf numbers left here. Everything about the chip's own box
// (its 1.5px edge, its paddings, the delete button's 18px, the real advance of the
// mono step number) belongs to ChipGeometry, exported from the file that draws it.
// NODE_MAXH is spent on LINES rather than cropped to, so a title too long for it
// loses its tail instead of the box lying about how tall it is.
const NODE_MAXW = 220
const NODE_MAXH = 66
// the unbound-slot picker's menu (#144 / OB-058, nested OB-077). Domain → module →
// topic, the corpus's own containment chain: a container's own `childrenOf` walk
// stops AT a topic (`n.topic`) rather than descending into the "deep" prose layers
// attached below it — those aren't real walk steps, and going further would turn
// 53 topics into hundreds of unreachable-by-search rows. A container is still
// itself pickable here (NodePicker's own contract: "a node with children is still
// itself pickable"), same as every other level. Built once from static corpus data
// rather than per-render.
function optionFor(id: string): NodeOption {
  const n = byId.get(id)!
  const kids = n.topic ? [] : (childrenOf.get(id) ?? []).map((k) => optionFor(k.id))
  return { id, title: n.title, domain: topicHueOf(id) ?? '', children: kids.length ? kids : undefined }
}
const NODE_OPTIONS: NodeOption[] = domainIds.map(optionFor)
/** the step number as the CHIP is handed it — LOCAL to the container it sits in, so
 *  a leaf shows its position in its own list rather than the path down to it: the
 *  stop whose outline is `2.1` reads `1.`. The last segment IS that position, since
 *  placeList builds every outline as `${prefix}.${i + 1}`.
 *
 *  This is one scheme rather than two. The cards have always read this way —
 *  VersionedGroup's `numberScope` defaults to 'local' and truncates whatever it is
 *  handed — so while the chips carried full paths a nested card said `1.` with
 *  chips beside it saying `2.1.` and `2.2.`: one level in two schemes, which the DS
 *  calls worse than either. Numbering follows the nesting, which the reader can
 *  already see; `numberScope="path"` is there if a citable address is ever the point.
 *
 *  leafSize measures this and the render below draws it, from one place — the
 *  trailing dot is a few px of mono, and a reservation that missed it would be that
 *  much too narrow on every stop. */
const leafIndex = (outline: string) => `${outline.slice(outline.lastIndexOf('.') + 1)}.`
// the selection cue on a LEAF: an OUTLINE, not a ring — it survives the inline
// box-shadow on pills, and its offset sits OUTSIDE a node's thick coloured border,
// so selection stays legible where a 1px ring was lost against the border (#72 #10)
const SEL_OUTLINE = 'outline outline-2 outline-offset-1 outline-[var(--state-selected)]'
// A CONTAINER does not wear this on its wrapper: the wrapper's box is the card plus
// whatever the road reserved round it, so an outline on it is a loose rectangle. The
// DS card draws its own — round the face when folded, round the HEAD when open (its
// body holds nodes that are selectable in their own right) — via `selected`.
const AGAP = 26 // vertical space between siblings — the arrow lives here
// ── the OPEN container card, hosted whole since the DS grew `bodySlot` ────────
// The card is the DS VersionedGroup in chrome-only mode; the road floats the active
// version's steps into the slot it leaves empty. layoutRoad places every box in one
// pass BEFORE anything renders, so it cannot ask the rendered card where its slot is
// — it asks GroupGeometry, the DS's own published numbers, exported from the file
// that draws them (openHeight for the card and where its slot begins; foldedSize
// for a fold). Text is measured on a canvas at the DS's own fonts, so nothing here
// is read off a screenshot any more. What the road still has to know is where the
// slot sits SIDEWAYS: after the well's padding and the ancestry rail on the left,
// before the slot's own padding and the well's padding on the right — all
// GROUP_METRICS, so a change there lands here.
//   proven: node tools/studio-spike/shot-foldab.mjs compares openHeight/foldedSize
//   against the rendered card and the slot the component REPORTS (onBodySlot), and
//   fails on any drift.
const M = GROUP_METRICS
// THE CARD'S SIDEWAYS SLOT INSET is GroupGeometry.slotInsets() (OB-051) — published from
// the same GROUP_METRICS this file already reads, so the rail's stroke width and friends
// are no longer retyped by hand here. Still a FUNCTION call at use, never hoisted into a
// constant: it reads hairline(), and devicePixelRatio is not fixed for the life of a page
// — a window moved to a second display, or a browser zoom, changes it. `axisOffset` is the
// card's own asymmetry: the ancestry rail hangs on the left, so the slot is inset further
// that side, and the card's centre sits `axisOffset` right of the slot's. The SLOT sits on
// the road's axis (see reachOf), so an open card hangs that far left of it — the same
// amount at every width, which is what lets two cards of one width share their edges.
// M.emptySlotMin (published OB-051) is what to ask for when the active version has no steps.
// The zone the component then draws is taller (M.emptyZone); openHeight's own ★ local floor
// knows that and covers it, and the road's transparent drop target does too.
const CARD_MIN_W = M.narrowAt // 250: below this the DS drops the tally to its own line;
// the road keeps a card at least this wide so a head reads as one row
const MARGIN = 16
const SLOTH = 18 // catch height of a between-nodes drop slot (fills the AGAP)
const SELPAD = 7 // breathing room the selection box leaves around its members


/** The DS picker names a version twice: a short mono CODE for its position, and
 *  a written NAME. Our model carries only `label`, so the label is the name and
 *  the code is positional. An unnamed version still shows the placeholder, and
 *  the placeholder still takes room — so measure() and the head read it here,
 *  from one place, or the head would wrap against a width nobody reserved. */
const VERSION_UNNAMED = 'name this version'
/** OB-081: a fresh stage/container used to be SEEDED with this string as its literal
 *  `title` (authordraft.ts's `groupSelection`), so an unnamed card and one somebody
 *  actually named "name this stage" were indistinguishable, and the "name" survived a
 *  save unless the user happened to retype it. The stage now keeps an empty title;
 *  this is passed as `titlePlaceholder` instead, an invitation the component draws
 *  and never treats as real data. */
const STAGE_UNNAMED = 'name this stage'
const versionCode = (chosen: number): string => `v${chosen + 1}`

/** what GroupGeometry — and the component — is told about a container: the same strings,
 *  plus the width the card is laid out at and how tall its slot is. Delegates to the DS's
 *  own `GroupGeometry.groupSpec()` (OB-050) rather than hand-building the `GroupSpec`, so
 *  `slotH` lands as `slotHeight` (ASKED) — the same prop the card is actually rendered
 *  with, `slotHeight={slotH}` below — never `bodyHeight` (TOLD), a different contract in
 *  `openHeight()` this file used to cross without knowing it: the trap OB-050 names, where
 *  the same number reached the prediction and the drawing under two different meanings.
 *  ONE builder, so the reservation and the drawing can never disagree on an input.
 *  (Renamed from `groupSpec` — that name is now the DS's own export, imported as
 *  `GroupGeometry.groupSpec`, and OB-051 asks the two not to collide.) */
const roadSpec = (s: Stop, outline: string, width: number, slotH: number, chosen: number): GroupSpec =>
  GroupGeometry.groupSpec({
    width,
    title: s.title ?? '',
    titlePlaceholder: STAGE_UNNAMED,
    index: outline,
    description: s.description ?? '',
    descPlaceholder: 'enter description',
    // a stand-in, never called: groupSpec() only checks onDescribe's presence, to derive
    // `describable` — every open card here IS editable, matching the real onDescribe below
    onDescribe: () => {},
    versions: s.variants.map((v, i) => ({ id: v.id, name: v.label, label: versionCode(i) })),
    versionNamePlaceholder: VERSION_UNNAMED,
    activeId: s.variants[chosen]?.id ?? '',
    count: s.variants[chosen]?.steps.length ?? 0,
    countLabel: 'nodes',
    narrow: width < M.narrowAt,
    slotHeight: slotH,
    /* NO CEILING — see the render call site's own note by `bodyMaxHeight="none"`. Threading
       the same string through the prediction is what OB-050 fixes: `groupSpec()` maps it to
       `null` for us, so the two can no longer drift apart. */
    bodyMaxHeight: 'none',
  })


type Mark = { key: string; band: Band } | null

/** the active version's column box (width holds its widest step, height its stack) */
interface Col {
  w: number
  h: number
}
interface Placed {
  path: Path
  stop: Stop
  x: number
  y: number
  w: number
  h: number
  /** hierarchical outline number by AUTHORING position — "2", "2.1", "2.1.3" —
   * shown left of every title. Replaced the flat amber walk-order badge (#15);
   * the walk sequence now lives only in the right-pane route preview. */
  outline: string
  onRoad: boolean
  skipped: boolean
  /** container nesting depth (0 at the board's top level, +1 per open container
   * we recurse into) — drives the recessed well's per-level surface tint. Counts
   * containers, NOT path hops: a fork's columns are the same well, not deeper. */
  depth: number
  /** an expanded container's single column box — the active version's steps.
   * `h` is the SLOT height the component is asked for (GROUP_METRICS.emptySlotMin
   * when empty). */
  body?: Col
  /** an expanded container: where its slot's content begins, from the card's top,
   * as GroupGeometry.openHeight predicted it — the same number the component draws */
  bodyTop?: number
  /** an expanded container: the spec the layout built — the render pass hands the
   * SAME strings and numbers to the component, so what was reserved is what draws */
  spec?: GroupSpec
  /** for folded containers: the actual rendered shell width (≥ FOLD_SHELL_W), which
   * overhangs the layout reservation (w = NODEW) — evenly, since `x` centres the
   * fold on the column axis by THIS width, so an arrow lands on its midpoint. The
   * wrapper, selBox and marquee all size by it, so what is drawn, hit and boxed is
   * what the user sees. Absent on leaves and open cards. */
  visualW?: number
}
interface Arrow {
  x1: number
  y1: number
  x2: number
  y2: number
  live: boolean
  /** this arrow leads INTO an optional stop — drawn dashed to say "may be
   * skipped". Optionality reads off the inbound arrow + the node's dashed border
   * now; the old bypass rail is gone. */
  optional: boolean
}
/** a forgiving drop target filling the gap between two siblings (or before the
 * first / after the last) — inserts at `path`, so a drop in dead space no longer
 * falls through to append-at-end */
interface Slot {
  path: Path
  x: number
  y: number
  w: number
}

function layoutRoad(
  stops: Stop[],
  collapsed: ReadonlySet<string>,
  choices: Record<string, string>,
  withOptionals: boolean,
) {
  // one container, one column: the ACTIVE version's steps (#70). The comparator's
  // side-by-side columns are gone, so a card is as wide as its column needs in order
  // to clear the DS rail on BOTH sides (never under CARD_MIN_W), and as tall as the
  // DS says a card with that head and that slot is.
  // a bound leaf's box: wide enough for a short title on one line, growing (and
  // wrapping) toward NODE_MAXW / NODE_MAXH for a long one, then clamped (#72 #8).
  // ASKED, not guessed. chipSize is the chip's own geometry, exported from the
  // file that draws it and reading back the same CHIP_METRICS its style block
  // writes, so a padding change lands in the reservation and in the drawing
  // together or not at all — the rule GroupGeometry already gives the card.
  // What stood here counted characters at CHAR_W = 8 against chrome scored at 40
  // when the chip's real chrome is ~83, so every title it scored as one line
  // wrapped to two and was clipped against the height it had been told (#97).
  // ASKS chipSizeOf(props) rather than hand-keeping a ChipSpec (OB-048): the object here is
  // NodeChipProps-shaped, the same shape the <NodeChip> five lines down is handed, so the
  // DS's own chipSpec() — not a second list kept in step by hand — decides which props move
  // the box. `optional` is why this mattered: the DS gave the optional chip its "(optional)"
  // line (OB-025), one --fs-micro line taller and stacked without wrapping, and a hand-kept
  // spec that forgot to thread it reserved one line too few, live, until someone noticed.
  const leafSize = (node: string, outline: string, optional: boolean): { w: number; h: number } => {
    const c = chipSizeOf({
      title: byId.get(node)?.title ?? '',
      domain: topicHueOf(node) ?? '',
      index: leafIndex(outline),
      mark: 'border', wrap: true, optional,
      onDelete: () => {},
      minWidth: NODEW, maxWidth: NODE_MAXW, maxHeight: NODE_MAXH,
    })
    return { w: c.width, h: c.height }
  }
  /** the active version's column: its widest step wide, its whole stack tall —
   *  or, empty, the slot height the DS zone wants */
  const bodyColOf = (s: Stop, outline: string): Col => {
    const kids = chosenSteps(s, choices).map((c, i) => measure(c, `${outline}.${i + 1}`))
    const w = Math.max(NODEW, ...kids.map((c) => c.w))
    const h = kids.length ? kids.reduce((acc, c) => acc + c.h, 0) + (kids.length - 1) * AGAP : M.emptySlotMin
    return { w, h }
  }
  const measure = (s: Stop, outline: string): { w: number; h: number; body?: Col; bodyTop?: number; spec?: GroupSpec } => {
    if (isLeaf(s)) {
      // a bound leaf wraps and grows within bounds (#72 #8); an unset slot keeps
      // the fixed pill size
      return s.unset ? { w: NODEW, h: NODEH } : leafSize(s.node, outline, !!s.optional)
    }
    const chosen = chosenIdx(s, choices)
    if (collapsed.has(s.key!)) {
      // a COLLAPSED CONTAINER is the DS folded card, so it reserves that card's
      // predicted height (#91) — the DS's own number now. Width stays NODEW so a
      // fold still lines up with the leaf stops above and below it; the shell
      // overhangs that evenly (see visualW).
      const spec = roadSpec(s, outline, NODEW, 0, chosen)
      return { w: NODEW, h: Math.ceil(GroupGeometry.foldedSize({ ...spec, foldedMinWidth: M.foldedMinWidth, narrow: true }).height), spec }
    }
    // the OPEN card wraps its slot ASYMMETRICALLY — slotInsets().left of ancestry rail on
    // one side, slotInsets().right on the other — because the SLOT, not the card, is what
    // sits on the road's axis. That is the DS's own rule (VersionedGroup.prompt.md, "Filling
    // the body slot" point 7): the chain continues THROUGH the body, so the arrows into and
    // out of a card must land on the body's axis, and a chain whose arrows sit on two
    // axes reads as a mistake even when every box is where it should be. The card's own
    // edges then fall a fixed axisOffset left of the axis — fixed being the point, see
    // reachOf. Width is still content-driven, floored at CARD_MIN_W.
    // Never so narrow the head goes to two rows. Width first, THEN height: the head's
    // fields wrap against the width, so this order is what keeps openHeight() an
    // answer rather than a circular question.
    const body = bodyColOf(s, outline)
    const insets = GroupGeometry.slotInsets()
    const w = Math.max(CARD_MIN_W, insets.left + body.w + insets.right)
    const spec = roadSpec(s, outline, w, body.h, chosen)
    const g = GroupGeometry.openHeight(spec)
    return { w, h: Math.ceil(g.height), body, bodyTop: g.bodyTop, spec }
  }

  /** how far a stop reaches either side of the road's AXIS, and what it PAINTS —
   *  which is not always what it RESERVES.
   *
   *  The axis is where the arrows are drawn, and the DS's body-slot rule puts it on
   *  the BODY SLOT rather than on the card. So a leaf or a fold is centred on it and
   *  reaches half its painted width each way (a fold's DS shell overhangs the NODEW
   *  slot it keeps in the column, which is why `painted` is not always `m.w`), while
   *  an OPEN CARD reaches to its SLOT's centre — w / 2 + GroupGeometry.slotInsets().axisOffset,
   *  since the slot is inset further on the rail side — and so hangs that far left of
   *  the axis at every width.
   *
   *  It used to reach to the CONTENT COLUMN's centre instead. That is the same number
   *  only while the content fills the slot, and it never does: CARD_MIN_W (250) is
   *  wider than most bodies, and every pixel of that surplus fell on the RIGHT of the
   *  column, so a card's offset moved with its widest step. Measured on the Plan board
   *  2026-08-16, two cards BOTH 250 wide sat 12px apart, their arrows entering at +17
   *  and +5 from the axis every leaf chip was exactly on — read as two boxes that
   *  simply failed to line up. Reaching to the slot centres the chips in the slot they
   *  are floated over, gives equal-width cards equal edges, and satisfies point 7
   *  exactly rather than approximately.
   *  Placement and board sizing both read this, so the two can never disagree. */
  const reachOf = (s: Stop, m: { w: number; body?: Col; spec?: GroupSpec }) => {
    if (!isLeaf(s) && collapsed.has(s.key!)) {
      const painted = Math.max(m.w, GroupGeometry.foldedSize({ ...m.spec!, foldedMinWidth: M.foldedMinWidth, narrow: true }).width)
      return { left: painted / 2, right: painted / 2, painted }
    }
    if (isLeaf(s)) return { left: m.w / 2, right: m.w / 2, painted: m.w }
    const left = m.w / 2 + GroupGeometry.slotInsets().axisOffset
    return { left, right: m.w - left, painted: m.w }
  }

  const items: Placed[] = []
  const arrows: Arrow[] = []
  const slots: Slot[] = []

  // `prefix` is the parent container's outline number ("" at the top level); each
  // child is prefix.(i+1), so numbering follows AUTHORING position, not walk order.
  const placeList = (list: Stop[], parent: Path, centerX: number, y0: number, onRoad: boolean, depth: number, prefix: string) => {
    let y = y0
    let prevBottom: number | null = null
    let prevSkipped = false
    let lastW = NODEW
    list.forEach((s, i) => {
      const p = [...parent, i]
      const outline = prefix ? `${prefix}.${i + 1}` : String(i + 1)
      const m = measure(s, outline)
      const { w, h } = m
      // the SLOT is what sits on centerX, not the card. Arrows are drawn at
      // centerX, so what has to land there is whatever the chain runs through: a
      // leaf's own box, a fold's face, and an open card's BODY SLOT — never the open
      // card's outline, which hangs 8.25px left of it because the rail is inset
      // further than the other side. That offset is the same for every card, so two
      // cards of one width DO share edges. The drop slot keeps the RESERVED width
      // and stays centred, so a slot above a fold still lines up with the leaves.
      const isFold = !isLeaf(s) && collapsed.has(s.key!)
      const r = reachOf(s, m)
      const vw = r.painted
      const x = centerX - r.left
      slots.push({ path: p, x: centerX - w / 2, y: prevBottom === null ? y - 8 : (prevBottom + y) / 2, w })
      lastW = w
      const skipped = !!s.optional && !withOptionals
      if (prevBottom !== null)
        arrows.push({ x1: centerX, y1: prevBottom + 3, x2: centerX, y2: y - 5, live: onRoad && !prevSkipped && !skipped, optional: !!s.optional })
      if (isLeaf(s)) {
        items.push({ path: p, stop: s, x, y, w, h, outline, onRoad, skipped, depth })
      } else if (isFold) {
        items.push({ path: p, stop: s, x, y, w, h, outline, onRoad, skipped, depth, visualW: vw })
      } else {
        const body = m.body!
        const bodyTop = m.bodyTop!
        items.push({ path: p, stop: s, x, y, w, h, outline, onRoad, skipped, depth, body, bodyTop, spec: m.spec })
        // lay the ACTIVE version's steps as ONE column in the card's slot, on the
        // same axis. It is the road (live arrows, order numbers) when the container
        // itself is on the road. The other versions aren't drawn at all now (#70)
        // — switching versions swaps which steps this column holds.
        const chosen = chosenIdx(s, choices)
        const steps = s.variants[chosen].steps
        if (steps.length) placeList(steps, [...p, chosen], centerX, y + bodyTop, onRoad && !skipped, depth + 1, outline)
      }
      prevBottom = y + h
      prevSkipped = skipped
      y += h + AGAP
    })
    if (list.length && prevBottom !== null)
      slots.push({ path: [...parent, list.length], x: centerX - lastW / 2, y: prevBottom + 8, w: lastW })
  }

  // the board holds the axis at MARGIN + the furthest any stop reaches LEFT of it,
  // and is as wide as that plus the furthest any reaches right. The two sides are
  // measured separately because an open card is not symmetric about the axis, and
  // they are measured from what each stop PAINTS, which keeps a fold's overhanging
  // shell inside the board instead of over its edge.
  const reaches = stops.map((s, i) => reachOf(s, measure(s, String(i + 1))))
  const halfL = Math.max(NODEW / 2, ...reaches.map((r) => r.left))
  const halfR = Math.max(NODEW / 2, ...reaches.map((r) => r.right))
  const W = halfL + halfR + 2 * MARGIN
  placeList(stops, [], MARGIN + halfL, MARGIN, true, 0, '')
  const bottoms = items.map((it) => it.y + it.h)
  const H = (bottoms.length ? Math.max(...bottoms) : 0) + MARGIN
  return { items, arrows, slots, W, H }
}


export default function AuthorRoad({
  state,
  sync,
  stepHover,
  choices,
  pickBranch,
  withOptionals,
  onLeafFocus,
}: {
  state: AuthorState
  sync: HoverBinding
  /** the pointer entered / left the pill of walk stop `index` (0-based, in the PRESENTED
   *  route's order) — what the map's dock lights (DS OB-189). Report-only. */
  stepHover?: { enter(index: number): void; leave(index: number): void }
  choices: Record<string, string>
  pickBranch(key: string, id: string): void
  withOptionals: boolean
  onLeafFocus?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [mark, setMark] = useState<Mark>(null)
  const [hotSlot, setHotSlot] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeDragRef = useRef(false)
  const [freshGroup, setFreshGroup] = useFreshGroup()
  // Title, description and version-name editing, the version menu, the delete
  // confirm and the ungroup refusal are all the DS card's own now — its pencil
  // opens all three fields at once (OB-110), it asks before a delete, and refuses a
  // multi-version ungroup with its own note. The road only hears the results, as
  // ops on `authordraft`.

  const toggle = (key: string) => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
  }

  // create a fresh version and switch to it (#70); the DS card then opens the new
  // name for editing itself. The new variant is appended; addVariant seeds it with
  // one unset slot, so it reads as a blank new version with a default name.
  const createVersion = (s: Stop) => {
    const newId = state.addVariant(s.key!)
    pickBranch(s.key!, newId)
  }
  // the DS card asked already (its inline "delete this version?" row, #33's ask
  // moved into the component), so this is the drop itself
  const deleteVersion = (path: Path, s: Stop, id: string) => {
    const k = s.variants.findIndex((v) => v.id === id)
    if (k >= 0) state.dropVariant(path, k)
  }

  // GroupGeometry measures titles on a canvas at the DS's fonts. Until the webfonts
  // arrive it measures the fallback face, so the first layout can wrap a title
  // differently from the card that renders once Quicksand/Nunito are in — lay out
  // again the moment they are, and every reservation is measured at the real face.
  const [, setFontsReady] = useState(0)
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let on = true
    document.fonts.ready.then(() => { if (on) setFontsReady((n) => n + 1) })
    return () => { on = false }
  }, [])

  const { items, arrows, slots, W, H } = layoutRoad(state.stops, collapsed, choices, withOptionals)
  /* WHICH WALK STOP EACH ON-ROAD LEAF IS (DS OB-189): the placement walks the road in the same
     order `resolveRoad` presents it — every container down to its chosen version, unset slots and
     skipped optionals left out — so the on-road leaves in `items` order ARE `bus.route`'s order,
     and a leaf's stop index is its ordinal among them. Counted here rather than looked up by
     node id, because a node can be on the walk twice and the pill knows which visit it is. */
  const stopIndexByKey = new Map<string, number>()
  {
    let n = 0
    for (const it of items) if (isLeaf(it.stop) && !it.stop.unset && it.onRoad && !it.skipped) stopIndexByKey.set(pathKey(it.path), n++)
  }

  /* ONE WEIGHT FOR THE WHOLE ROAD — the lightest member's edge, which is the same rule and
     the same reasoning `NodeChain` applies to a chain, because the road IS a chain that
     happens to lay itself out arithmetically. A connector is drawn at the border weight of
     what it connects and NEVER above it, so a ceiling that holds for one arrow has to hold
     for the column: the road's arrows read as one interrupted line down one axis, and a
     per-gap weight would give 1.5 · 1.25 · 1.5 down it, which reads as a rendering fault
     rather than as three considered weights.
     ASKED, NOT TYPED, exactly like `chipSize`. A leaf renders `NodeChip mark="border"` and
     answers through `chipBorder`; a container renders a `VersionedGroup` card and answers
     through its own `joinBorder` static. Only the UNSET slot is the road's own box — nothing
     in the design system draws it — so it is the one member that passes a measured number,
     which is what `joins` takes a number FOR. `shaftFor` turns the winner into the stroke, so
     no stroke literal appears here at all. */
  const UNSET_PILL_BORDER = 2 // the dashed picker pill's own `border-2`, measured
  const roadJoins = (() => {
    let min: number | undefined
    for (const pl of items) {
      const w = !isLeaf(pl.stop) ? VersionedGroup.joinBorder
        : pl.stop.unset ? UNSET_PILL_BORDER
        : chipBorder('border')
      if (min === undefined || w < min) min = w
    }
    return min
  })()

  // the SELECTION BOX — the bounding rect of every selected block; the action
  // toolbar pins to it (stable) rather than chasing the cursor. #17.
  const selItems = items.filter((pl) => state.selected.has(pathKey(pl.path)))
  // only drawn for a MULTI-selection — for a single node the per-node thin ring
  // is the whole selection cue, so we don't box a lone node twice.
  const selBox = selItems.length > 1
    ? (() => {
        const x = Math.min(...selItems.map((p) => p.x)) - SELPAD
        const y = Math.min(...selItems.map((p) => p.y)) - SELPAD
        const right = Math.max(...selItems.map((p) => p.x + (p.visualW ?? p.w))) + SELPAD
        const bottom = Math.max(...selItems.map((p) => p.y + p.h)) + SELPAD
        return { x, y, w: right - x, h: bottom - y }
      })()
    : null

  // g = group, once a selection exists (#15). Tab = indent, moving the single
  // selection into the container right above it — indentSelection existed and
  // worked but had no binding until #154 wired this one. Ungroup has no
  // shortcut — it is the container's ✕ now (the toolbar ✕ Delete removes the
  // whole group). Group and indent are the only two keyboard actions; the rest
  // of the toolbar stays mouse-only. Both ignored while a text field is focused,
  // and Tab still falls through to native focus-navigation when canIndent is
  // false (no preventDefault), so it never traps focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if ((e.key === 'g' || e.key === 'G') && state.canGroup) {
        e.preventDefault()
        state.groupSelection()
      } else if (e.key === 'Tab' && state.canIndent) {
        e.preventDefault()
        state.indentSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  /** Plain click selects one block; Shift/Ctrl/Cmd toggles membership.
   * A plain click on a leaf also drives the doc pane (#14). */
  const selectOn = (pl: Placed) => (e: ReactMouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey || e.ctrlKey || e.metaKey) state.toggleSelect(pl.path)
    else {
      state.selectPaths([pl.path])
      if (isLeaf(pl.stop) && onLeafFocus) onLeafFocus(pl.stop.node)
    }
  }

  /** the block gestures every node shares — leaf pill, card header, closed pill */
  const gestures = (pl: Placed) => {
    const key = pathKey(pl.path)
    return {
      draggable: true,
      onDragStart: (e: ReactDragEvent) => {
        e.stopPropagation()
        e.dataTransfer.setData(DT, 'blk:' + key)
      },
      onDragEnd: () => {
        setMark(null)
        setHotSlot(null)
      },
      onDragOver: (e: ReactDragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setHotSlot(null)
        setMark({ key, band: bandFor(e, pl.stop) })
      },
      onDragLeave: () => setMark((m) => (m?.key === key ? null : m)),
      onDrop: (e: ReactDragEvent) => {
        setMark(null)
        setHotSlot(null)
        handleDrop(e, gapFor(e, pl.path, pl.stop, choices), state)
      },
      onClick: selectOn(pl),
    }
  }

/** a LEAF's hover/select chrome (#15): its ✕, top-right, fading in on hover;
   * `shown` forces it visible (selected). A leaf is DELETED by it. A container's
   * fold and ungroup controls are the DS card's own head cluster now — the ✕
   * there UNGROUPS (its active version's steps are lifted out in place and the
   * wrapper drops); with more than one version it asks first, since confirming
   * also drops every OTHER version's contents. All undoable. Deleting a whole
   * PLAIN group outright (rather than ungrouping it) has no dedicated control —
   * #191 retired the road's own toolbar (`data-fly-del`/`deleteSelection`),
   * the only thing that did; ungroup, then delete the spilled leaves one at a
   * time, covers it. */
  // the road's own delete ✕ for a leaf stop is RETIRED (#97): NodeChip carries one,
  // berry at rest, receding on the shared PKT_SB clock with its space reserved so the
  // chip never changes width — the same control every other ✕ in the system is.


  // ── marquee (rubber-band) select ──────────────────────────────────────────
  const boardPoint = (e: ReactPointerEvent) => {
    const r = boardRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onBoardPointerDown = (e: ReactPointerEvent) => {
    marqueeDragRef.current = false
    if (e.button !== 0 || !boardRef.current) return
    // only empty canvas starts a marquee — not a node, control, tab, or overlay
    if ((e.target as HTMLElement).closest('[data-rnode],[data-rstage],[data-rstage-closed],[data-rbody],button,input,select')) return
    const { x, y } = boardPoint(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setMarquee({ x0: x, y0: y, x1: x, y1: y })
    if (!e.shiftKey) state.selectPaths([])
  }
  const onBoardPointerMove = (e: ReactPointerEvent) => {
    if (!marquee) return
    const { x, y } = boardPoint(e)
    setMarquee({ ...marquee, x1: x, y1: y })
  }
  const onBoardPointerUp = (e: ReactPointerEvent) => {
    if (!marquee) return
    const left = Math.min(marquee.x0, marquee.x1)
    const right = Math.max(marquee.x0, marquee.x1)
    const top = Math.min(marquee.y0, marquee.y1)
    const bottom = Math.max(marquee.y0, marquee.y1)
    if (right - left > 4 || bottom - top > 4) {
      marqueeDragRef.current = true
      const hit = items.filter((pl) => pl.x < right && pl.x + (pl.visualW ?? pl.w) > left && pl.y < bottom && pl.y + pl.h > top)
      if (hit.length) state.selectPaths(hit.map((pl) => pl.path), e.shiftKey)
    }
    setMarquee(null)
  }

  return (
    // OB-039: PaneScroller replaces the hand-written margins this used to carry
    // (DS PaneHeader.d.ts rule 3, adopted in #110 as marginBottom alone, then
    // both ends in #113 H2) — one component now owns the 12px inset at both
    // ends instead of a literal repeated at every scroller in the app.
    <PaneScroller
      data-road-root
      onPointerDown={onBoardPointerDown}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onDragOver={(e: ReactDragEvent) => e.preventDefault()}
      onDrop={(e: ReactDragEvent) => {
        setMark(null)
        handleDrop(e, [state.stops.length], state)
      }}
    >
      {state.stops.length === 0 ? (
        <div className="text-[var(--fs-body)] p-3" style={{ color: 'var(--text-3)' }}>drop a node from the palette to start the plan</div>
      ) : (
        <div ref={boardRef} className="relative mx-auto my-2 select-none" style={{ width: W, height: H }}>
          {/* #113 H4: the sequence is drawn with the DS NodeArrow, one per gap, instead
              of the road's own <line>s and two <marker> heads.

              The road still OWNS the layout. It computes every gap arithmetically in one
              pass, so each arrow is PLACED from ARROW_METRICS rather than handed to a
              NodeChain — the chain wants to own order and slots as well, which is the
              same structural reason the open card needs `bodySlot`. Adopting the drawing
              settles the tone; it does not settle AGAP 26 against the chain's 22, which
              is a layout constant and stays open on #109.

              Two signals collapse into the DS's model on purpose:
                · the live shaft goes 2.5 -> 1.5, because NodeArrow strokes one width;
                · the ghost's own '4 3' dash is DROPPED. The DS reserves dashed for
                  CONDITIONAL, and on this road that already means `optional` — so a
                  second dash pattern meaning "off the road" was decoration, and two
                  dashes for two meanings is the thing the rule exists to stop.
              Off-road now reads in tone alone: quiet (--bark-400) against walk
              (--accent-walk). It was --text-3, which IS bark (--bark-500), one step
              darker than the system's quiet — not the "neutral grey" #113 H4 reports. */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {arrows.map((a, i) => (
              <div
                key={`a${i}`}
                data-rarrow
                data-rarrow-tone={a.live ? 'walk' : 'quiet'}
                // `shaftTailOffset`, not `ARROW_METRICS.across / 2`. The two
                // agreed until 2026-08-29: `across` was a fixed constant here, so
                // half of it was where the shaft sat. The DS's own .jsx derives
                // the box from the SCALED half-width now, so a lighter `joins`
                // draws a narrower box with the shaft nearer its edge — and a road
                // holding a VersionedGroup takes `joins = 1` (its `joinBorder`),
                // which would have put every arrow on it 0.73px off its column.
                // The published constant is still the right SPAN reservation (a
                // scaled head is only ever smaller); it is no longer the right
                // cross-axis position.
                style={{ position: 'absolute', left: a.x1 - shaftTailOffset({ joins: roadJoins }).across, top: a.y1 }}
              >
                <NodeArrow
                  direction="down"
                  length={Math.max(1, a.y2 - a.y1 - ARROW_METRICS.head)}
                  tone={a.live ? 'walk' : 'quiet'}
                  dashed={a.optional}
                  joins={roadJoins}
                />
              </div>
            ))}
          </div>

          {items.map((pl) => {
            const key = pathKey(pl.path)
            const isSelected = state.selected.has(key)
            const s = pl.stop
            const dim = (!pl.onRoad || pl.skipped) && !isSelected ? 'opacity-50' : ''

            if (isLeaf(s)) {
              // an unbound placeholder slot — a picker, not a node chip. The wrapper
              // still reserves the road's own NODEW×NODEH box (unchanged — the layout
              // pass is arithmetic and does not measure this), but no longer draws a
              // pill itself: NodePicker's unresolved shell is solid, never dashed (#144
              // / OB-058), so an outer dashed circle around it would double the shape.
              if (s.unset) {
                return (
                  <div
                    key={key}
                    {...gestures(pl)}
                    data-rnode
                    data-node=""
                    data-runset={1}
                    className={[
                      // justify-center is OB-091. `items-center` is the CROSS axis on a
                      // row flex — it was centring the pill vertically and leaving it
                      // pinned to the box's left edge, visibly off the centre line every
                      // resolved NodeChip above and below it sits on. The picker's
                      // unresolved shell is `inline-flex` by design (a pill sized to its
                      // own content, not a full-width box like NodeChip), so a
                      // content-sized pill dropped into a left-anchored slot HAS to be
                      // centred by the host — the component cannot do it from inside.
                      'absolute z-20 flex items-center justify-center cursor-grab',
                      'transition-[left,top,width,height] duration-200 ease-out',
                      dim,
                      isSelected ? SEL_OUTLINE : '',
                    ].join(' ')}
                    style={{ left: pl.x, top: pl.y, width: pl.w, height: pl.h }}
                  >
                    <div data-rpicknode={key} onClick={(e) => e.stopPropagation()}>
                      {/* onDelete is OB-092 — the same act a resolved step's NodeChip
                          already offers below (`state.deleteAt`), so an unbound slot is
                          removable from the chain exactly as a bound one is and the road
                          never swaps which control it renders as a step resolves. */}
                      <NodePicker
                        options={NODE_OPTIONS}
                        onChange={(id) => state.bindNode(pl.path, id)}
                        onDelete={() => state.deleteAt(pl.path)}
                        search
                      />
                    </div>
                  </div>
                )
              }
              // a stop is a DS NodeChip (#97), not a pill the road draws. `mark="border"`
              // is the DS's own form for a node standing on its own — the domain on the
              // edge, no disc, and the step number in the freed column — and it takes its
              // hue from --domain-* rather than the corpus's raw authored hex, which is
              // what the road was reading before.
              //
              // The road keeps everything that is BEHAVIOUR and hands over the drawing,
              // exactly as the folded card does: the wrapper owns position, the relayout
              // transition, drag, the hover-bus binding and the selection SET; the chip
              // owns its picture, its ✕ and its rings. `selected` WITHOUT `selectable` is
              // the DS's own advice for a board — it paints the chip picked without also
              // handing it a click gesture, which would fight the marquee and the drag.
              // `dim` is the DS's off-the-resolved-path treatment (no lift, no fill,
              // --opacity-off-path), a step past the plain opacity the road used.
              const nodeHover = sync.bind(s.node)
              const stopIndex = stopIndexByKey.get(key)
              return (
                <div
                  key={key}
                  {...gestures(pl)}
                  {...nodeHover}
                  /* the node's hover (the map's spotlight) AND the stop's (the dock's halo) from one
                     pointer — two channels, because the map reads a node and the dock a stop */
                  onPointerEnter={() => { nodeHover.onPointerEnter(); if (stepHover && stopIndex !== undefined) stepHover.enter(stopIndex) }}
                  onPointerLeave={() => { nodeHover.onPointerLeave(); if (stepHover && stopIndex !== undefined) stepHover.leave(stopIndex) }}
                  data-rnode
                  data-node={s.node}
                  data-ropt={s.optional ? 1 : undefined}
                  data-rord={pl.outline}
                  className="absolute z-20 cursor-grab transition-[left,top,width,height] duration-200 ease-out"
                  style={{ left: pl.x, top: pl.y, width: pl.w, height: pl.h }}
                >
                  {/* #72 #8: the title WRAPS instead of truncating — the node grew to
                      fit in measure()/leafSize, which ASKS this component's own
                      chipSizeOf() for the box and bounds it by NODE_MAXW/NODE_MAXH. So
                      what the chip is told here is what it would have measured. */}
                  <NodeChip
                    title={byId.get(s.node)!.title}
                    index={leafIndex(pl.outline)}
                    domain={topicHueOf(s.node) ?? ''}
                    mark="border"
                    wrap
                    optional={!!s.optional}
                    dim={(!pl.onRoad || pl.skipped) && !isSelected}
                    lit={sync.lit(s.node)}
                    selected={isSelected}
                    width={pl.w}
                    height={pl.h}
                    onDelete={() => state.deleteAt(pl.path)}
                  />
                </div>
              )
            }

            // a container — COLLAPSED, and since #91 this is the real DS
            // VersionedGroup in its folded state rather than a drawing of one.
            // A closed card has no visible children, so the wall that keeps the
            // OPEN card mirroring the DS head by hand — steps are board-level
            // siblings, not `children` — does not apply here, and the whole
            // component can be hosted.
            //
            // The road keeps everything that is BEHAVIOUR and hands over
            // everything that is DRAWING. The wrapper owns position, the relayout
            // transition, drag (`gestures`), selection, hover-dim, the outline
            // number's hook and double-click-to-open; the component owns the
            // fold's picture, its title, its tally and its two controls.
            //
            // What this gives up, plainly: the two peek plates of ADR-0005 D2.
            // The DS stacks a single well-tinted plate behind its fold, per its
            // own elevation.css rule ("a folded group -> raised again, with the
            // well tint stacked behind it"), and two pill silhouettes behind a
            // rounded-lg card is not a drawing anyone chose. The plural reading
            // those plates carried now rides on the tally instead, in words. That
            // trade is the subject of #100 and was made deliberately — see #91.
            if (collapsed.has(s.key!)) {
              // D1 (0005) still holds and is now the DS's own rule too: a SHUT
              // group is the only persistently-RAISED thing on the road, and the
              // component draws that itself (--lift-2 over a well-tinted plate).
              // It is self-contained — no floating step children — so it still
              // takes the hover-lift scale cleanly.
              const shutSteps = chosenSteps(s, choices)
              const shutChosen = chosenIdx(s, choices)
              return (
                <div
                  key={key}
                  {...gestures(pl)}
                  data-rstage-closed={s.key}
                  data-rord={pl.outline}
                  /* REOPEN IS TAKEN IN THE CAPTURE PHASE, not as an onDoubleClick.
                     A folded card's whole face is the DS card, and its title line
                     stops React's synthetic dblclick from reaching any ancestor —
                     measured on 2026-08-20, and NOT caused by the component's own
                     handler: it still happened with that handler removed. The native
                     event bubbles the whole way; only React's dispatch stops. So the
                     gesture is taken before any descendant can be involved, which
                     also stops it depending on the internals of a component the road
                     does not own. `useCapture` is the third argument. */
                  ref={(el) => {
                    if (!el) return undefined
                    const reopen = (e: MouseEvent) => { e.stopPropagation(); toggle(s.key!) }
                    el.addEventListener('dblclick', reopen, true)
                    return () => el.removeEventListener('dblclick', reopen, true)
                  }}
                  title={wrapTip('double-click to open')}
                  // the DS's own box model applies inside (see [data-ds-host] in
                  // index.css): everything under this wrapper is the DS card
                  data-ds-host=""
                  className={[
                    'group absolute z-20 cursor-grab',
                    'transition-[left,top,width,height] duration-200 ease-out',
                    pl.path.length === 1 ? 'hover-lift' : '',
                    dim,
                    // selection is drawn by the card itself (`selected` below), on
                    // its face; only the drop-target mark rides on the wrapper
                    !isSelected && mark?.key === key && mark.band === 'inside' ? 'ring-2 ring-[var(--accent-primary)] rounded-[var(--radius-lg)]' : '',
                  ].join(' ')}
                  style={{ left: pl.x, top: pl.y, width: pl.visualW ?? pl.w, height: pl.h }}
                >
                  <VersionedGroup
                    folded
                    // the road's two cues, drawn by the card on its own FACE so they
                    // follow the rounded corners like on every other node. Not on
                    // this wrapper: its box is the face + the peek plate + the
                    // reserved height, and an outline on it is a loose rectangle
                    // around a rounded stack (the DS card owns its border, so
                    // neither cue restyles the component's edge — both ride outside
                    // it). dashed ALWAYS means conditional; it yields to selection.
                    selected={isSelected}
                    optional={!!s.optional}
                    title={s.title ?? ''}
                    titlePlaceholder={STAGE_UNNAMED}
                    index={pl.outline}
                    /* the road floats its cards as board-level siblings, so the DS's
                       Depth context never reaches them — `pl.depth` is the same count,
                       kept by the layout that did the floating */
                    depth={pl.depth}
                    description={s.description ?? ''}
                    count={shutSteps.length}
                    versions={s.variants.map((v, i) => ({ id: v.id, name: v.label, label: versionCode(i) }))}
                    versionNamePlaceholder={VERSION_UNNAMED}
                    activeId={s.variants[shutChosen]?.id ?? ''}
                    onSelect={(id) => pickBranch(s.key!, id)}
                    // TOLD, never measured: `narrow` uninstalls the component's
                    // ResizeObserver, which is what lets GroupGeometry.foldedSize()
                    // predict this box before it renders. `width` pins it to the
                    // leaf column so a fold still lines up with the stops above and
                    // below it.
                    narrow
                    width={NODEW}
                    foldedMinWidth={M.foldedMinWidth}
                    // both gestures belong to the road: dragging a stop is the
                    // board's job, and a fold has no resize handle to offer
                    movable={false}
                    resizable={false}
                    // the #15 gesture set, now drawn by the DS: its RestoreMark
                    // maximises, and its ✕ ungroups — including the CONFIRMATION
                    // when more than one version lives here, which askUngroup already
                    // implements exactly as the road did by hand. Both stay ops on
                    // `authordraft`, so undo/redo holds.
                    onToggleFold={() => toggle(s.key!)}
                    onClose={() => state.promote(pl.path, shutChosen)}
                    ungroupConfirmLabel={`ungroup this node? the live version's steps spill onto the road — its other ${s.variants.length - 1} version${s.variants.length === 2 ? '' : 's'} go with it`}
                  />
                </div>
              )
            }

// a container — the OPEN card. The DS VersionedGroup in chrome-only mode
            // (bodySlot): it draws the well, the head, the description, the picker
            // and its menu, the ancestry rail and — for an empty version — the
            // dashed zone; the active version's steps float into its slot as
            // board-level siblings placed by layoutRoad, so no inner click bubbles
            // into the card. What the road keeps is BEHAVIOUR: position, drag,
            // drop bands, selection, hover-dim; every edit the card offers lands as
            // an op on `authordraft`, so undo/redo holds.
            const chosen = chosenIdx(s, choices)
            const steps = chosenSteps(s, choices)
            const spec = pl.spec!
            const bodyTop = pl.bodyTop ?? 0
            // the slot layoutRoad reserved. The card must draw exactly this and
            // impose NO ceiling of its own — see bodyMaxHeight below (#97).
            const slotH = pl.body?.h ?? M.emptySlotMin
            // where a drag over the card lands: the HEAD zone (above the slot) reads
            // before / inside / after in thirds, as bandFor does for a node; the slot
            // itself, and anything under it, is inside — the version on show
            const cardBand = (e: ReactDragEvent): Band => {
              const r = e.currentTarget.getBoundingClientRect()
              const t = (e.clientY - r.top) / bodyTop
              return t >= 1 ? 'inside' : t < 0.3 ? 'before' : t > 0.7 ? 'after' : 'inside'
            }
            const cardGap = (e: ReactDragEvent): Path => {
              const band = cardBand(e)
              const i = pl.path[pl.path.length - 1]
              const parent = pl.path.slice(0, -1)
              return band === 'inside' ? [...pl.path, chosen, steps.length] : band === 'before' ? [...parent, i] : [...parent, i + 1]
            }
            const insets = GroupGeometry.slotInsets()
            return (
              <div
                key={key}
                data-rstage={s.key}
                data-rdrop={s.key}
                // the DS's own box model applies inside (see [data-ds-host] in
                // index.css): everything under this wrapper is the DS card, and
                // GroupGeometry's numbers assume that regime
                data-ds-host=""
                draggable
                onDragStart={(e: ReactDragEvent) => {
                  e.stopPropagation()
                  e.dataTransfer.setData(DT, 'blk:' + key)
                }}
                onDragEnd={() => {
                  setMark(null)
                  setHotSlot(null)
                }}
                onDragOver={(e: ReactDragEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setHotSlot(null)
                  setMark({ key, band: cardBand(e) })
                }}
                onDragLeave={() => setMark((m) => (m?.key === key ? null : m))}
                onDrop={(e: ReactDragEvent) => {
                  setMark(null)
                  setHotSlot(null)
                  handleDrop(e, cardGap(e), state)
                }}
                onClick={(e) => {
                  if (marqueeDragRef.current) return
                  selectOn(pl)(e)
                }}
                title={wrapTip('drag to move')}
                className={[
                  'group absolute z-[5] cursor-grab',
                  // #72 #2: only a TOP-LEVEL card lifts; a nested one is part of its
                  // parent, so hovering into it no longer fires a second lift.
                  pl.path.length === 1 ? 'hover-lift' : '',
                  dim,
                  // the drop-target ring rides on the wrapper, like the fold's; the
                  // card draws its own selection (round the head) via `selected`
                  !isSelected && mark?.key === key && mark.band === 'inside' ? 'ring-2 ring-[var(--accent-primary)] rounded-[var(--radius-lg)]' : '',
                ].join(' ')}
                style={{ left: pl.x, top: pl.y, width: pl.w, height: pl.h }}
              >
                <VersionedGroup
                  // CONTROLLED, both ways: the road owns fold state (`collapsed`), and
                  // the same component instance carries over between this branch and
                  // the folded one (same key, same position), so an uncontrolled fold
                  // would keep the card's own guess after the road had reopened it
                  folded={false}
                  bodySlot
                  slotHeight={slotH}
                  // NO CEILING, DELIBERATELY (OB-050 closes the gap this used to hide). The
                  // DS's well caps at 260 by default and scrolls past it — right for a card
                  // whose contents are its own DOM, wrong here: the road's steps are
                  // board-level SIBLINGS, not children, so they never scroll with a capped
                  // well — they would hang out of the bottom of the card while the well
                  // stopped short above them. The road already reserved this card's exact
                  // height (openHeight() now models the same ceiling, and roadSpec passes it
                  // the same "none" so the two cannot drift); a ceiling of the card's own
                  // would be a second opinion on a box that is not its to decide.
                  bodyMaxHeight="none"
                  // TOLD, never measured — the same spec layoutRoad reserved by, so
                  // the card draws exactly the box that was reserved for it
                  width={pl.w}
                  narrow={spec.narrow}
                  title={spec.title ?? ''}
                  titlePlaceholder={STAGE_UNNAMED}
                  index={spec.index}
                  /* the road floats its cards as board-level siblings, so the DS's
                     Depth context never reaches them — `pl.depth` is the same count,
                     kept by the layout that did the floating */
                  depth={pl.depth}
                  description={spec.description}
                  descPlaceholder={spec.descPlaceholder}
                  count={spec.count}
                  countLabel={spec.countLabel}
                  versions={s.variants.map((v, i) => ({ id: v.id, name: v.label, label: versionCode(i) }))}
                  versionNamePlaceholder={VERSION_UNNAMED}
                  activeId={s.variants[chosen]?.id ?? ''}
                  // the road's two cues, drawn by the card: selection round the head
                  // (a card's body holds nodes selectable in their own right);
                  // dashed round the face when the container is conditional
                  selected={isSelected}
                  optional={!!s.optional}
                  // both gestures belong to the road: dragging a stop is the board's
                  // job, and a card sized by the layout has no resize handle to offer
                  movable={false}
                  resizable={false}
                  // every edit the card offers, as an op on authordraft
                  onRetitle={(v) => state.retitle(s.key!, v)}
                  onDescribe={(v) => state.redesc(s.key!, v)}
                  onRename={(id, name) => {
                    const k = s.variants.findIndex((v) => v.id === id)
                    if (k >= 0) state.relabelVariant(s.key!, k, name)
                  }}
                  onSelect={(id) => pickBranch(s.key!, id)}
                  onAddVersion={() => createVersion(s)}
                  // a FRESHLY GATHERED group opens straight into edit mode (OB-110 clause 5):
                  // `groupSelection` marks its key, this card reads it once on its first
                  // mount, and the mark clears when the edit closes so a later remount
                  // (undo, reload) does not reopen it
                  defaultEditMode={s.key === freshGroup}
                  onEditModeChange={(on) => { if (!on && freshGroup === s.key) setFreshGroup(null) }}
                  onDeleteVersion={(id) => deleteVersion(pl.path, s, id)}
                  onToggleFold={() => toggle(s.key!)}
                  onClose={() => state.promote(pl.path, chosen)}
                  ungroupConfirmLabel={`ungroup this node? the live version's steps spill onto the road — its other ${s.variants.length - 1} version${s.variants.length === 2 ? '' : 's'} go with it`}
                />

                {/* the ACTIVE version's steps float over the slot as board-level
                    siblings (placed by layoutRoad). When that version is empty the
                    card draws its own dashed zone; this transparent target over it
                    is what makes the zone accept the road's drops. */}
                {steps.length === 0 && (
                  <div
                    data-rbody={`${s.key}.${chosen}`}
                    onClick={(e) => e.stopPropagation()}
                    onDragOver={(e: ReactDragEvent) => e.preventDefault()}
                    onDrop={(e: ReactDragEvent) => {
                      setMark(null)
                      handleDrop(e, [...pl.path, chosen, 0], state)
                    }}
                    className="absolute z-30"
                    style={{ left: insets.left, top: bodyTop, width: pl.w - insets.left - insets.right, height: M.emptyZone }}
                  />
                )}
              </div>
            )
          })}

          
          {/* forgiving between-node drop slots — z-0 so nodes (z-20+) still win
              when the pointer is over one, but the dead gaps now catch drops */}
          {slots.map((sl, i) => (
            <div
              key={`slot${i}`}
              data-rslot={pathKey(sl.path)}
              onDragOver={(e: ReactDragEvent) => {
                e.preventDefault()
                e.stopPropagation()
                setMark(null)
                setHotSlot(i)
              }}
              onDragLeave={() => setHotSlot((h) => (h === i ? null : h))}
              onDrop={(e: ReactDragEvent) => {
                setMark(null)
                setHotSlot(null)
                handleDrop(e, sl.path, state)
              }}
              className="absolute z-0"
              style={{ left: sl.x, top: sl.y - SLOTH / 2, width: sl.w, height: SLOTH }}
            >
              {hotSlot === i && (
                <div data-rmark className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded pointer-events-none" style={{ background: 'var(--acorn-500)' }} />
              )}
            </div>
          ))}

          {mark &&
            mark.band !== 'inside' &&
            items
              .filter((pl) => pathKey(pl.path) === mark.key)
              .map((pl) => (
                <div
                  key="mark"
                  data-rmark
                  className="absolute z-30 h-[3px] rounded pointer-events-none"
                  style={{ left: pl.x, top: mark.band === 'before' ? pl.y - 6 : pl.y + pl.h + 3, width: pl.visualW ?? pl.w, background: 'var(--acorn-500)' }}
                />
              ))}

          {/* marquee — the rubber-band while dragging on empty board. #17 */}
          {marquee && (
            <div
              data-marquee
              className="absolute z-40 border pointer-events-none"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
                borderColor: 'var(--state-selected)',
                background: 'color-mix(in oklch, var(--state-selected) 14%, transparent)',
              }}
            />
          )}

          {/* selection box — the bounding rect of the selected run. #17 */}
          {selBox && (
            <div
              data-selbox
              className="absolute z-30 rounded-lg border pointer-events-none transition-all duration-200 ease-out"
              style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h, borderColor: 'var(--state-selected)' }}
            />
          )}

        </div>
      )}
    </PaneScroller>
  )
}
