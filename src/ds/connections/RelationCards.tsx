import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { topicPaint } from '../graph/DomainDot'
import { relationPaint } from '../graph/EdgeLegend'
import { NodeArrow } from '../graph/NodeArrow'
import { NodeChip } from '../graph/NodeChip'
import { Caret } from '../nav/TreeRow'
import type { ContainNode } from './ContainTree'

/** ONE RELATIONSHIP, DECOMPOSED — one entry per (target, kind). Not the corpus's own edge
 *  record: an edge that a host reads both ways round arrives here twice, once per direction it
 *  is being told from, so nothing downstream has to know which end it started at. */
export interface Relation {
  /** stable within the list — the React key, and what a filter's identity is compared on */
  id: string
  targetId: string
  targetTitle: string
  /** the target's topic hue. Absent falls back to the fallback swatch, never to the source's */
  targetDomain?: string
  /** the corpus's own machine name for the relation — `relationPaint`'s input */
  kind: string
  /** the corpus's own WORDING for it. Given, it wins over the palette's example label */
  kindLabel?: string
  /** which way it runs, from the SOURCE's point of view. Absent defaults `see_also` to 'both'
   *  and everything else to 'out' */
  direction?: 'out' | 'in' | 'both'
}

/** a descendant's relationship, rolled up under the selected node — the path down to the child
 *  that owns it, plus the relation itself */
export interface ViaRelation {
  /** the chain from the selected node down to the child, the child LAST */
  path: ContainNode[]
  rel: Relation
}

/** THE ROW'S GEOMETRY, published. One derivation covers all three boxes in a row — two pills and
 *  the arrow — so the arrow keeps exactly what the pills leave and the row can never need to
 *  scroll to reveal its own edge.
 *
 *  `cardMax` IS THE ANSWER TO A WIDE PANE, and the reason it exists is that the derivation below
 *  hands the connector whatever the pills leave: with the pills capped, every pixel of a widening
 *  went into SHAFT, and at a 980px pane the row drew two 168px pills either side of 621px of
 *  hairline (owner, 2026-08-28). A relationship is a SENTENCE, and the distance between its
 *  subject and its object carries nothing — past a point it only makes the eye travel. So the
 *  CARD stops growing at 620 and the surplus stays OUTSIDE it, as pane margin: a widened pane is
 *  for the graph and the tree, which do use the room. The cap is applied as a `maxWidth` on the
 *  MEASURED container, so `rowsW` is already the capped width and one derivation still covers
 *  every box — there is no second, uncapped path.
 *
 *  `pillMax` 200 (168 before the cap, 108 in the first cut): at 620 the surplus goes to the
 *  PILLS, where the reading happens, not to the connector. The connector needs no cap of its own
 *  — `cardMax` bounds it at about 197 — and A NUMBER THAT IS DERIVED MUST NOT ALSO BE DECLARED.
 *
 *  `groupChrome` is what a grouped card spends that a flat row does not: the 1px source bracket
 *  plus its margins, the 1px TARGET spine that collects a stack of arrows into a shared pill, a
 *  third gap, and 4px of source hover-wash padding. Leave it out of the budget and the target
 *  pill overhangs the pane with its right border clipped by the scroller. It is deducted from
 *  EVERY grouped row, single-target rows that draw no spine included: 2px of pill width is the
 *  price of one budget instead of two. `safety` is spent ONCE, inside the pill derivation;
 *  deducting it again when measuring the arrow's label truncates two characters early.
 *
 *  `blockGap` and `arrowStacked` are ONE DECISION IN TWO NUMBERS, and the RATIO is the point: a
 *  stack of arrows is read as belonging to its pill by PROXIMITY, so the distance between two
 *  arrows inside a block (26) must stay clearly under the distance between two blocks (13 plus
 *  the arrows' own box). Both are CHOSEN, not derived — at the shipped 4/30 the two spacings were
 *  near enough equal that the top two arrows read as floating between their pill and the one
 *  below (owner, 2026-08-28). Move them as a pair or the grouping goes. */
export const REL_CARD_METRICS = {
  rowGap: 3, rowPad: 2, arrowMin: 38, arrowStacked: 26, blockGap: 13,
  pillMin: 50, pillMax: 200, cardMax: 620, groupChrome: 13, safety: 8,
} as const
const M = REL_CARD_METRICS

/** HOW ONE RELATION DRAWS: the label is the corpus's own wording when it carries one
 *  (`kindLabel`), else the palette's example label, else the raw kind; the stroke is always
 *  resolved through `relationPaint`; `heads` comes from `direction`, defaulting `see_also` to
 *  'both' — the one shipped kind the corpus authors as symmetric. */
export function relationLook(rel: Relation): { label: string; color: string; heads: 'out' | 'in' | 'both' } {
  const paint = relationPaint(rel.kind)
  const label = rel.kindLabel != null ? rel.kindLabel : (paint.label != null ? paint.label : String(rel.kind))
  const heads = rel.direction || (rel.kind === 'see_also' ? 'both' : 'out')
  return { label, color: paint.stroke, heads }
}

/** one line per PAIR OF NODES rather than per relationship — the grouping the graph draws from.
 *  Order is preserved by first appearance. A pair with one kind should be labelled with that
 *  kind's NAME in its colour; only a pair carrying two or more falls back to a ×N badge, because
 *  the count is what the line cannot otherwise show. Published so the host's real graph and this
 *  card list read the SAME grouping — two derivations of it is how they disagree. */
export interface RelationGroup {
  targetId: string
  targetTitle: string
  targetDomain?: string
  kinds: string[]
}
export function groupRelationsByTarget(list: readonly Relation[] | null | undefined): RelationGroup[] {
  const map = new Map<string, RelationGroup>()
  for (const rel of list || []) {
    if (!map.has(rel.targetId)) map.set(rel.targetId, { targetId: rel.targetId, targetTitle: rel.targetTitle, targetDomain: rel.targetDomain, kinds: [] })
    map.get(rel.targetId)!.kinds.push(rel.kind)
  }
  return Array.from(map.values())
}

/** one drawn relationship inside a grouped card — a `Relation` already resolved through
 *  `relationLook`, carrying its own paint and its own click */
export interface RelItem {
  key: string
  targetId: string
  targetTitle: string
  targetDomain?: string
  kindLabel: string
  kindColor: string
  heads: 'out' | 'in' | 'both'
  onSelect?: () => void
}

/** THE CARD-LAYER TWIN OF `groupRelationsByTarget`: one BLOCK per target node, drawn as a stack
 *  of arrows converging on a single pill, so a source related to the same node three ways draws
 *  that node once instead of three near-identical pills down the right edge (the mirror of what
 *  source-grouping did on the left — owner, 2026-08-28). It takes items that have already been
 *  through `itemOf` (they carry per-kind colour and their own onSelect), which
 *  `groupRelationsByTarget` cannot: that one groups RAW relations for the graph. Same rule in
 *  both — keyed on `targetId`, ordered by first appearance — AND THEY MUST STAY IN STEP, or the
 *  graph's one line per pair and the card's one block per pair disagree about which pairs exist. */
export interface TargetBlock {
  key: string
  targetId: string
  targetTitle: string
  targetDomain?: string
  onSelect?: () => void
  rels: RelItem[]
}
export function groupItemsByTarget(items: readonly RelItem[] | null | undefined): TargetBlock[] {
  const map = new Map<string, TargetBlock>()
  for (const it of items || []) {
    if (!map.has(it.targetId)) map.set(it.targetId, { key: it.targetId, targetId: it.targetId, targetTitle: it.targetTitle, targetDomain: it.targetDomain, onSelect: it.onSelect, rels: [] })
    map.get(it.targetId)!.rels.push(it)
  }
  return Array.from(map.values())
}

/* two via-children rows with the same path are the same child seen twice — collapse them so the
   grouped view draws that child once. Order preserved: a source appears where its FIRST
   relationship appeared. `pathParts` is the whole chain ABOVE the child, nearest last; the pill
   decides how much of it fits and drops from the far end. */
function groupViaBySource(rows: readonly ViaRelation[] | null | undefined) {
  const map = new Map<string, { key: string; pathParts: string[]; node: ContainNode; items: ViaRelation[] }>()
  for (const vc of rows || []) {
    const key = vc.path.map((n) => n.id).join('/')
    if (!map.has(key)) map.set(key, { key, pathParts: vc.path.slice(0, -1).map((n) => n.title), node: vc.path[vc.path.length - 1], items: [] })
    map.get(key)!.items.push(vc)
  }
  return [...map.values()]
}

/* THE COUNT SHARES THE LABEL'S BASELINE, NOT ITS BOX CENTRE — `alignItems: 'baseline'`, which is
   what every other label-plus-number row in this system already does (`CountBadge`, `PillButton`,
   `SectionLabel`, `PaneHeader`, `AppHeader`, `PresenterHeaderBar`; the rule is written out in the
   DS's `PillButton.prompt.md`). This header was the one place still on `center`, and centring two
   line boxes is not alignment when the two runs are set in DIFFERENT FACES: the mono count's
   ascent and descent are not the UI label's, so centring their boxes puts their baselines apart
   by half the difference in metrics, and the digits ride low against all-caps words that have no
   descenders to fill the gap. Owner-reported on this app's `VIA CHILDREN 42`, 2026-09-14 (DS
   OB-182); measured on the DS's probe: the count's baseline sat 0.67px BELOW the label's and now
   sits on it, at a cost of +0.51px of row height (baseline alignment takes the union of the two
   runs' baseline offsets) and nothing else moving. Both figures are read AFTER
   `document.fonts.ready` — before the faces load the fallback's metrics answer instead.

   THE CARET KEEPS ITS BOX CENTRING (`alignSelf: 'center'`) and its 1px optical lift. It holds an
   SVG and no in-flow line box, so a baseline-aligned flex item aligns by its bottom MARGIN EDGE
   instead — which would drop the mark by most of its own height. The lift is the mark's own
   optical centring and is not re-tuned here.

   The label is wrapped in a bare `<span>` for one reason: a raw text node in a flex container
   becomes an anonymous flex item, which is layout-identical but cannot be measured or read back.
   Both runs are elements now, so a driver reads its own baselines out of the DOM instead of
   asserting them from the source. `data-rel-group-header` is a test hook only. */
function RelGroupHeader({ label, count, open, onClick }: { label: string; count: number; open?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} data-rel-group-header={label} style={{
      fontSize: 11, fontWeight: 'var(--fw-bold)', color: 'var(--text-3)', textTransform: 'uppercase',
      letterSpacing: '.04em', padding: '12px 2px 4px', display: 'flex', alignItems: 'baseline', gap: 5,
      cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
    }}>
      {onClick ? <span style={{ display: 'inline-flex', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0, marginTop: 1 }}><Caret open={open} /></span> : null}
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', fontWeight: 'var(--fw-medium)' }}>{count}</span>
    </div>
  )
}

/** THE GROUP HEADER, READABLE RATHER THAN RE-DRAWN. Published by the DS 2026-09-14 in the turn its
 *  baseline rule was written, because the rule lives in a module-level helper that
 *  `String(RelationCards)` cannot see — a specimen guarding the change had nothing to match. Same
 *  reason `LECTURE_NOTES_PARTS` and `PRESENTER_STRIP_PARTS` exist. `REL_CARD_PARTS.GroupHeader`
 *  IS `RelGroupHeader`: read it, do not mount it — `RelationCards` renders these itself. */
export const REL_CARD_PARTS = { GroupHeader: RelGroupHeader }

/* ONE RULE PER BOUNDARY, and it governs both row forms below (DS OB-195, owner 2026-09-16: "is it
   necessary to have the two dividers between each card… it looks a bit distracting"). Every card
   used to carry a hairline on BOTH edges, so two adjacent cards drew two lines 6px apart — a
   boundary stated twice, which reads as a gap between two framed objects rather than as one list
   being divided. `borderTop` alone: the rule belongs to the card BELOW it, the way a table's row
   rules do, so the last card in a group ends on space and the next group's heading is the next
   thing a reader meets. The 6px `marginBottom` stays — it is what keeps the single line off the
   previous card's last line of text. */

/* below `pillMin` the chip shape stops helping — a name character-wrapped in a fixed-width box is
   less readable than the same words as plain wrapping text — so under 2×pillMin of row width the
   card drops the pill chrome entirely rather than keep shrinking it. */
function RelRowPlain({ leftLabel, leftDomain, rightLabel, rightDomain, kindLabel, kindColor, heads, onSelectLeft, onSelectRight }: {
  leftLabel: string
  leftDomain?: string
  rightLabel: string
  rightDomain?: string
  kindLabel: string
  kindColor: string
  heads: 'out' | 'in' | 'both'
  onSelectLeft?: () => void
  onSelectRight?: () => void
}) {
  return (
    <div style={{
      fontSize: 11, lineHeight: 1.5, width: '100%', boxSizing: 'border-box',
      overflowWrap: 'break-word', wordBreak: 'break-word', padding: '7px 4px', marginBottom: 6,
      borderTop: '1px solid var(--border-hair)',
      background: 'var(--surface-raised)',
    }}>
      <span onClick={onSelectLeft} style={{ fontWeight: 'var(--fw-bold)', color: topicPaint(leftDomain).stroke, cursor: onSelectLeft ? 'pointer' : 'default' }}>{leftLabel}</span>
      <span style={{ color: 'var(--text-3)', fontSize: 10, margin: '0 5px' }}>{kindLabel}</span>
      <span style={{ color: kindColor, fontWeight: 700, marginRight: 5 }}>{heads === 'both' ? '↔' : (heads === 'in' ? '←' : '→')}</span>
      <span onClick={onSelectRight} style={{ color: topicPaint(rightDomain).stroke, cursor: onSelectRight ? 'pointer' : 'default' }}>{rightLabel}</span>
    </div>
  )
}

/** GROUPED BY SOURCE **AND** BY TARGET: the source is drawn ONCE against a bracketed stack of its
 *  relationships, and within that stack each TARGET is drawn once too — several arrows converging
 *  on a single pill when the pair is related more than one way. A group of five reads as one fact
 *  with five consequences instead of five near-identical cards, and a pair related three ways
 *  reads as one neighbour reached three ways instead of three neighbours. Direction and colour
 *  stay per-relationship, on the arrows; only the PILL is shared.
 *
 *  The bracket is a grouping cue, not a boundary: a half-opacity hairline, absent on a
 *  one-relationship group — it marks RELATIONSHIPS, so it appears whenever there are several,
 *  including several into one target.
 *
 *  HOVER SEMANTICS DIFFER BY SIZE, deliberately, and the size that decides is the number of
 *  TARGETS and not of relationships: a block is one hover target (`onHoverTarget` reports a NODE
 *  id, and two arrows to the same node report the same id). One target — however many arrows — is
 *  therefore ONE hover unit: source, arrows and target wash and light together, as the ungrouped
 *  row did, and nothing is lost because every hover in the group already means the same thing.
 *  MANY targets must NOT light the source from a relationship hover, or every hover lights the
 *  centre and the highlight stops meaning anything; there the source pill lights the centre only
 *  when hovered itself (`sourceIsCenter`). */
export interface RelSourceGroupProps {
  /** the source node's name — the pill on the left */
  sourceLabel: string
  /** the chain ABOVE the source, nearest last. The pill drops from the FAR end to fit */
  sourcePathParts?: string[]
  /** the source's topic hue */
  sourceDomain?: string
  /** the relationships out of this source, already resolved through `itemOf` */
  items: RelItem[]
  /** the source pill's solved width */
  leftWidth: number
  /** the target pills' solved width */
  rightWidth: number
  /** what the connector is left with once the two pills have taken theirs */
  arrowWidth: number
  /** this source IS the pane's centre node — so hovering it lights the graph's centre. False for
   *  a via-children card, whose source is a descendant and not the thing the graph is drawn about */
  sourceIsCenter?: boolean
  /** navigate to the source. Omit on the direct group, whose source is already where you are */
  onSelectSource?: () => void
  /** the pointer is on a target block, or has left every one of them */
  onHoverTarget?: (block: TargetBlock | null) => void
  /** the pointer is on the source, and this source is the centre */
  onHoverCenter?: (on: boolean) => void
}

export function RelSourceGroup({ sourceLabel, sourcePathParts, sourceDomain, items, leftWidth, rightWidth, arrowWidth, sourceIsCenter, onSelectSource, onHoverTarget, onHoverCenter }: RelSourceGroupProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [sourceHovered, setSourceHovered] = useState(false)
  const targets = groupItemsByTarget(items)
  const single = targets.length === 1
  const wholeRow = single && (sourceHovered || hoveredIdx === 0)
  const enterWhole = () => { setSourceHovered(true); setHoveredIdx(0); onHoverTarget?.(targets[0]); onHoverCenter?.(!!sourceIsCenter) }
  const leaveWhole = () => { setSourceHovered(false); setHoveredIdx(null); onHoverTarget?.(null); onHoverCenter?.(false) }
  const enterSource = () => { setSourceHovered(true); onHoverCenter?.(!!sourceIsCenter) }
  const leaveSource = () => { setSourceHovered(false); onHoverCenter?.(false) }
  return (
    <div
      onMouseEnter={single ? enterWhole : undefined} onMouseLeave={single ? leaveWhole : undefined}
      style={{
        boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', gap: M.rowGap,
        padding: '8px ' + M.rowPad + 'px', marginBottom: 6,
        borderTop: '1px solid var(--border-hair)',
        background: wholeRow ? 'var(--accent-primary-wash)' : 'var(--surface-raised)',
      }}
    >
      <div
        onClick={onSelectSource}
        onMouseEnter={single ? undefined : enterSource} onMouseLeave={single ? undefined : leaveSource}
        style={{
          display: 'flex', alignItems: 'center', flexShrink: 0, padding: 2, borderRadius: 14,
          background: (!single && sourceHovered) ? 'var(--accent-primary-wash)' : 'transparent',
          cursor: onSelectSource ? 'pointer' : 'default',
        }}
      >
        <NodeChip mark="border-2" title={sourceLabel} path={sourcePathParts} domain={sourceDomain} focus width={leftWidth} maxLines={Math.max(2, Math.min(4, items.length + 1))} />
      </div>
      {/* the bracket, and the empty 1px column that reserves its place on a one-relationship
          group — so a card with one relationship and a card with three line up */}
      {items.length > 1
        ? <div style={{ width: 1, background: 'var(--border-hair)', opacity: 0.45, flexShrink: 0, margin: '4px 1px' }} />
        : <div style={{ width: 1, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: M.blockGap }}>
        {targets.map((t, i) => (
          <div
            key={t.key}
            onMouseEnter={single ? undefined : () => { setHoveredIdx(i); onHoverTarget?.(t) }}
            onMouseLeave={single ? undefined : () => { setHoveredIdx(null); onHoverTarget?.(null) }}
            style={{
              display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: M.rowGap,
              borderRadius: 'var(--radius-sm)',
              background: (!single && hoveredIdx === i) ? 'var(--accent-primary-wash)' : 'transparent',
            }}
          >
            {/* ONE arrow keeps the original geometry exactly — it stays the flex child itself,
                unwrapped. SEVERAL are wrapped in a column that takes the flex slot in its place,
                because `flex: 1 0 arrowMin` on a column's child sizes it by HEIGHT.
                THE SPINE IS NOT DECORATION. The pill is vertically centred against the stack, so
                without it only the middle arrow of three points at anything and the outer two end
                in blank space — the picture says two of the three relationships miss. The spine
                gives every arrow the same thing to arrive at, and it is deliberately the SAME
                hairline the source side uses to hold its stack together: one cue, mirrored,
                rather than a second grouping vocabulary on the right. */}
            {t.rels.length > 1 ? (
              <Fragment>
                <div style={{ flex: '1 0 ' + M.arrowMin + 'px', minWidth: M.arrowMin, display: 'flex', flexDirection: 'column' }}>
                  {t.rels.map((r) => (
                    <NodeArrow key={r.key} fill label={r.kindLabel} color={r.kindColor} heads={r.heads} width={arrowWidth} stacked minHeight={M.arrowStacked} />
                  ))}
                </div>
                <div style={{ width: 1, background: 'var(--border-hair)', opacity: 0.45, flexShrink: 0, alignSelf: 'stretch', margin: '3px 1px' }} />
              </Fragment>
            ) : (
              <NodeArrow fill label={t.rels[0].kindLabel} color={t.rels[0].kindColor} heads={t.rels[0].heads} width={arrowWidth} />
            )}
            <div onClick={t.onSelect} style={{ cursor: t.onSelect ? 'pointer' : 'default', flexShrink: 0 }}>
              <NodeChip mark="border-2" title={t.targetTitle} domain={t.targetDomain} width={rightWidth} maxLines={Math.max(2, Math.min(4, t.rels.length + 1))} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function useMeasuredWidth(): [React.MutableRefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      /* re-read PER FIRE, never the first entry cached — a ResizeObserver that only ever reports
         its first measurement is the −131 rig fault from 2026-08-21h. */
      const cw = entries[entries.length - 1].contentRect.width
      if (cw > 0) setW(Math.round(cw))
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function itemOf(rel: Relation, onSelect: ((node: { id: string; title: string; domain?: string }) => void) | undefined, key: string): RelItem {
  const look = relationLook(rel)
  return {
    key, targetId: rel.targetId, targetTitle: rel.targetTitle, targetDomain: rel.targetDomain,
    kindLabel: look.label, kindColor: look.color, heads: look.heads,
    onSelect: onSelect ? () => onSelect({ id: rel.targetId, title: rel.targetTitle, domain: rel.targetDomain }) : undefined,
  }
}

/** THE RELATIONSHIP CARD LIST, grouped by source: a "direct" group (the selected node's own
 *  relations) and a "via children" group (a descendant's relations rolled up, one card per
 *  descendant), each header collapsible. Widths are solved BACKWARD from the container's own
 *  measured width so a row can never need to scroll to reveal its own edge; under 2×pillMin the
 *  rows drop pill chrome for plain wrapping text.
 *
 *  `filterTargetId` scopes both groups to one external node (null shows everything), and WHILE A
 *  FILTER IS ACTIVE THE LIST KEEPS ITS UNFILTERED HEIGHT — a list that shrinks under the pointer
 *  clamps its scroller, jumps the page, moves the hovered thing away and un-filters itself: the
 *  two states chase each other.
 *
 *  Typed port of the DS components/connections/RelationCards.jsx, OB-101 / #253. */
export interface RelationCardsProps {
  /** the node every "direct" relationship runs out of — the pane's own subject */
  source: { id: string; title: string; domain?: string }
  /** its own relationships, decomposed one per target and kind */
  direct?: Relation[]
  /** its descendants' relationships, each with the path down to the child that owns it */
  via?: ViaRelation[]
  /** scope both groups to one target node. Null shows everything */
  filterTargetId?: string | null
  /** navigate to a node named in a card. Omit and the cards are static */
  onSelect?: (node: { id: string; title: string; domain?: string }) => void
  /** a target block is hovered (its node id) or none is (null) — for the host's graph to mirror */
  onHighlightTarget?: (id: string | null) => void
  /** the CENTRE is hovered — a separate channel, so the graph's centre never lights merely
   *  because something is hovered */
  onHighlightCenter?: (on: boolean) => void
  /** what to say when there is nothing at all. The host knows why better than this list does */
  emptyLabel?: string
}

export function RelationCards({ source, direct = [], via = [], filterTargetId = null, onSelect, onHighlightTarget, onHighlightCenter, emptyLabel = 'No relationships to display' }: RelationCardsProps) {
  const [rowsRef, rowsW] = useMeasuredWidth()
  const [groupOpen, setGroupOpen] = useState({ direct: true, via: true })
  const toggleGroup = (g: 'direct' | 'via') => setGroupOpen((o) => ({ ...o, [g]: !o[g] }))
  const avail = rowsW ? rowsW - M.rowPad * 2 - M.rowGap * 2 - M.arrowMin - M.safety : 0
  const plainRows = rowsW > 0 && avail < M.pillMin * 2
  const pillWidth = rowsW ? Math.min(M.pillMax, Math.max(M.pillMin, Math.floor((avail - M.groupChrome) / 2))) : 70
  const rightWidth = rowsW ? Math.max(M.pillMin, Math.min(M.pillMax, avail - M.groupChrome - pillWidth)) : 70
  const arrowWidth = rowsW ? Math.max(M.arrowMin, rowsW - M.rowPad * 2 - M.rowGap * 2 - M.groupChrome - pillWidth - rightWidth) : M.arrowMin
  const showAll = filterTargetId == null
  const directRows = showAll ? direct : direct.filter((r) => r.targetId === filterTargetId)
  const viaRows = showAll ? via : via.filter((vc) => vc.rel.targetId === filterTargetId)
  /* ★ LOCAL — the unfiltered height is held in STATE where the DS holds it in a ref. Reading
     `.current` from a render body hard-errors under `react-hooks/refs`, and a hard error takes
     the whole component out of the lint pass. Behaviour is unchanged: the value is still written
     from a layout effect and still only while nothing is filtered, and the equality guard keeps
     it from re-rendering on every measurement. Reported on #74. */
  const [fullHeight, setFullHeight] = useState(0)
  /* NO DEPENDENCY LIST, as the DS's own effect has none: the height must be re-read whenever the
     CONTENT changes, and the content is not in any dependency this hook could name. The equality
     guard inside is what terminates it. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = rowsRef.current
    if (!showAll || !el) return
    const h = el.offsetHeight
    if (h > 0 && h !== fullHeight) setFullHeight(h)
  })
  if (!direct.length && !via.length) return <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '16px 2px' }}>{emptyLabel}</div>
  const hoverProps = {
    onHoverTarget: (it: TargetBlock | null) => onHighlightTarget?.(it ? it.targetId : null),
    onHoverCenter: (v: boolean) => onHighlightCenter?.(v),
  }
  return (
    <div
      ref={rowsRef}
      style={{ display: 'flex', flexDirection: 'column', maxWidth: M.cardMax, minHeight: showAll ? undefined : fullHeight || undefined }}
    >
      {directRows.length ? (
        <Fragment>
          <RelGroupHeader label="direct" count={directRows.length} open={groupOpen.direct} onClick={() => toggleGroup('direct')} />
          {groupOpen.direct ? (plainRows
            ? directRows.map((r) => {
                const it = itemOf(r, onSelect, r.id)
                return <RelRowPlain key={r.id} leftLabel={source.title} leftDomain={source.domain} rightLabel={r.targetTitle} rightDomain={r.targetDomain} kindLabel={it.kindLabel} kindColor={it.kindColor} heads={it.heads} onSelectRight={it.onSelect} />
              })
            : (
              <RelSourceGroup
                sourceLabel={source.title} sourceDomain={source.domain}
                leftWidth={pillWidth} rightWidth={rightWidth} arrowWidth={arrowWidth} sourceIsCenter
                items={directRows.map((r) => itemOf(r, onSelect, r.id))} {...hoverProps}
              />
            )) : null}
        </Fragment>
      ) : null}
      {viaRows.length ? (
        <Fragment>
          <RelGroupHeader label="via children" count={viaRows.length} open={groupOpen.via} onClick={() => toggleGroup('via')} />
          {groupOpen.via ? (plainRows
            ? viaRows.map((vc, i) => {
                const it = itemOf(vc.rel, onSelect, vc.rel.id + '-' + i)
                const src = vc.path[vc.path.length - 1]
                return (
                  <RelRowPlain
                    key={it.key} leftLabel={src.title} leftDomain={source.domain}
                    rightLabel={vc.rel.targetTitle} rightDomain={vc.rel.targetDomain}
                    kindLabel={it.kindLabel} kindColor={it.kindColor} heads={it.heads}
                    onSelectLeft={onSelect ? () => onSelect({ id: src.id, title: src.title, domain: source.domain }) : undefined}
                    onSelectRight={it.onSelect}
                  />
                )
              })
            : groupViaBySource(viaRows).map((g) => (
              <RelSourceGroup
                key={g.key} sourceLabel={g.node.title} sourcePathParts={g.pathParts} sourceDomain={source.domain}
                leftWidth={pillWidth} rightWidth={rightWidth} arrowWidth={arrowWidth}
                onSelectSource={onSelect ? () => onSelect({ id: g.node.id, title: g.node.title, domain: source.domain }) : undefined}
                items={g.items.map((vc, i) => itemOf(vc.rel, onSelect, vc.rel.id + '-' + i))} {...hoverProps}
              />
            ))) : null}
        </Fragment>
      ) : null}
    </div>
  )
}
