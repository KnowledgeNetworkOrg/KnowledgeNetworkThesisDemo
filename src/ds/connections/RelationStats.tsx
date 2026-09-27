import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { PanePlaceholder } from '../chrome/PanePlaceholder'
import { wrapTip } from '../chrome/IconButton'
import { orbitMarks } from './RelationOrbit'
import type { OrbitMark } from './RelationOrbit'
import { relationLook } from './RelationCards'
import type { Relation, ViaRelation } from './RelationCards'

/** THE NUMBERS THAT GO UNDER THE FIGURE. Chosen, not derived.
 *  `trackShare` is the fraction of a row the LONGEST bar is allowed; the rest is the reserve every
 *  row's text is read in. At 52% a 192px rail gives the top bar ~92px and leaves ~85px for "11
 *  Contradicts" at 11px, with the name still able to ellipsize before the track gives up any
 *  width. `barH`/`segH` are the two bar weights: a kind bar is a data mark, the hop bar is a
 *  control, and the control is the taller of the two because it is pointed at. */
export const RELATION_STATS_METRICS = { trackShare: 52, barH: 11, segH: 16 }
const M = RELATION_STATS_METRICS

/** THE POPULATION, COUNTED ONCE. Both readings come off `orbitMarks` — the same call the figure
 *  draws from — so the chart cannot count a population the figure does not draw. That is the whole
 *  reason this is not a `filter` written twice.
 *
 *  TWO MEASURES, AND THEY DO NOT SUM TO THE SAME NUMBER, which is why each block names its own:
 *  `neighbours` counts distinct target NODES, `relationships` counts marks — a neighbour with two
 *  kinds is one neighbour and two relationships.
 *
 *  A NEIGHBOUR IS DIRECT IF IT HOLDS ANY DIRECT RELATIONSHIP, otherwise it is indirect. The two
 *  halves then partition the neighbours and the hop bar sums to the headline; counting a both-ways
 *  neighbour in both halves would make a bar that is longer than the thing it divides. The
 *  RELATIONSHIP counts have no such question — a mark is on one ring or the other. */
export function relationStats(direct?: readonly Relation[] | null, via?: readonly ViaRelation[] | null): {
  marks: OrbitMark[]
  neighbours: number
  relationships: number
  ownNeighbours: number
  viaNeighbours: number
} {
  const marks = orbitMarks(direct, via)
  const nodes = new Map<string, { id: string; own: boolean }>()
  for (const m of marks) {
    const id = m.rel.targetId
    const prev = nodes.get(id)
    if (!prev) nodes.set(id, { id, own: !m.via })
    else if (!m.via) prev.own = true
  }
  const all = [...nodes.values()]
  return {
    marks,
    neighbours: all.length,
    relationships: marks.length,
    ownNeighbours: all.filter((n) => n.own).length,
    viaNeighbours: all.filter((n) => !n.own).length,
  }
}

/** THE KINDS, IN DESCENDING ORDER OF THE MEASURE BEING SHOWN — never held in total order. A
 *  staircase sorted by a total it is no longer showing is not a staircase, and the descending
 *  order is what makes the lengths legible. The scale follows too (`max` is of the active
 *  measure), so a filtered chart still uses the whole track. Each row carries the kind's own
 *  wording and stroke, resolved through `relationLook`, so the chart and the cards name a kind the
 *  same way. */
export function statKindRows(marks: readonly OrbitMark[], hopSel?: 'own' | 'via' | null): { kind: string; own: number; via: number; label: string; color: string }[] {
  const by = new Map<string, { kind: string; own: number; via: number; label: string; color: string }>()
  for (const m of marks) {
    const k = m.rel.kind
    const look = relationLook(m.rel)
    const row = by.get(k) || { kind: k, own: 0, via: 0, label: look.label, color: look.color }
    if (m.via) row.via += 1; else row.own += 1
    by.set(k, row)
  }
  const active = (r: { own: number; via: number }) => (hopSel === 'own' ? r.own : hopSel === 'via' ? r.via : r.own + r.via)
  return [...by.values()].filter((r) => active(r) > 0).sort((a, b) => active(b) - active(a))
}

/** the capitalised way in to the two resolvers above, for a card or a raw page reading off
 *  `window.<Namespace>` (which carries no lower-case export). Same function objects: `StatsMath.of`
 *  IS `relationStats`, `StatsMath.rows` IS `statKindRows`. Application code imports the named
 *  functions instead. */
export const StatsMath = { of: relationStats, rows: statKindRows }

const metric = (n: number, label: string, hook: string) => (
  /* EQUAL HALVES, AND THE MEASUREMENT IS WHY (owner, 2026-09-20, twice — first the neighbours cell
     was too wide, then the relationships cell was). Both earlier versions sized a cell to its
     CONTENT, so the divider moved with whichever label and numeral happened to be longer, and a
     rule that wanders is read as a mistake. The original reason not to split evenly was that
     `relationships` would clip in a 192px rail — true when the label was uppercase and tracked, and
     no longer true since it became the numeral's lower-case unit: measured in Nunito at 11px it is
     63.4px against the 75.5px an even half of the NARROWEST rail gives it, with `neighbours` at
     55.2px. The reason expired and the fix outlived it. */
  <div data-stat={hook} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 'var(--fs-title)', fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 1 }}>{n}</span>
    {/* A UNIT, NOT A HEADING. Uppercase tracked micro is this system's SECTION-HEADING voice, and
        a word sitting under a numeral is the numeral's unit — set it in the heading voice and the
        panel says NEIGHBOURS twice in 5px, once as a unit and once as an actual title. Lower case
        is the whole fix, and it is also narrower, which the 13-character `relationships` column
        was short of at a 192px rail. */}
    <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-3)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
  </div>
)
const secHead = (measure: string, dim: string, right?: ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
    <span style={{ fontSize: 'var(--fs-micro)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{measure + ' ' + dim}</span>
    {right}
  </div>
)
const rule = <div style={{ height: 1, background: 'var(--border-hair)' }}></div>

/** THE READING OF THE WHOLE NEIGHBOURHOOD that sits under `RelationOrbit` in a relations rail —
 *  two totals, the hop split as a bar, and the kinds as a descending chart. It is the figure's
 *  LEGEND as much as its dashboard: the kind rows are the only place the figure's hues are named,
 *  which is why the space under the graph is this and not a list of cards (a standing list of
 *  relationship cards was what the rail held before, and it cost more room than a rail has; the
 *  card is a hover now).
 *
 *  EVERY CONTROL HERE IS A HOVER, because every other filter in the rail is — the kind wedges in
 *  the figure, the ring zones. One clicked control would need a second gesture to undo itself,
 *  which is what a ✕ chip on a pinned hop was, and it is gone.
 *
 *  WHAT THE HOST AROUND IT MUST DO:
 *  1. MIRROR THE FILTERS ONTO THE FIGURE. `kind` and `hopSel` are the host's state, reported by
 *     this block and by the figure alike; pass both back to `RelationOrbit` or the chart and the
 *     figure disagree about what is selected. (`RelationsRail` holds them for you.)
 *  2. FEED IT THE SAME `direct`/`via` THE FIGURE GETS, decomposed one per (target, kind). Both
 *     read `orbitMarks`, so identical input is what guarantees the chart counts the population the
 *     figure draws; pre-merged input loses a pair's second kind.
 *  3. GIVE IT THE RAIL'S WIDTH and nothing else. Every track is a percentage — the block has no
 *     intrinsic width to overrun its rail with — so it needs no minimum and must not be given a
 *     fixed one.
 *  4. Nothing here is clickable. Every filter in this rail is a hover, so a pinned selection has
 *     no way to be cleared and none is offered.
 *  5. DO NOT WRITE YOUR OWN EMPTY STATE. A count of zero is a reading and this block draws it, as
 *     the system's `PanePlaceholder` — `state="No relationships"`, `note="Nothing connects to this
 *     node"` (owner's ruling, 2026-09-22, at 1:1 off three built candidates). TWO THINGS A PORT
 *     MUST NOT "TIDY": the second line is a `note` and not a `gesture`, because nothing can be
 *     done about a course that publishes no prerequisites; and the state line names the NODE's
 *     absence, which is the only thing now telling this apart from a pane that has no subject at
 *     all. WHY there is nothing — unpublished, unrecorded, genuinely unconnected — is the corpus's
 *     knowledge and belongs in the host's own prose, not in a second empty state beside this one.
 *
 *  TWO MEASURES THAT DO NOT AGREE, DELIBERATELY: `neighbours` counts distinct target NODES,
 *  `relationships` counts marks — a neighbour with two kinds is one neighbour and two
 *  relationships. Each block names its own measure for that reason.
 *
 *  Typed port of the DS components/connections/RelationStats.jsx (contract: RelationStats.d.ts),
 *  OB-235 / #342. */
export interface RelationStatsProps {
  /** the centred node's own relationships, one per (target, kind) */
  direct?: Relation[]
  /** relationships a DESCENDANT holds, with the containment path */
  via?: ViaRelation[]
  /** the kind whose row is lit and whose wedge the figure washes — the host's filter */
  kind?: string | number | null
  /** the pointer entered a kind row (its kind) or left it (null) */
  onKind?: (kind: string | number | null) => void
  /** which hop the pointer has selected; washes that ring in the figure and filters these bars */
  hopSel?: 'own' | 'via' | null
  /** the pointer entered a hop segment (its hop) or left it (null) */
  onHopSel?: (hop: 'own' | 'via' | null) => void
}

export function RelationStats({ direct, via, kind, onKind, hopSel, onHopSel }: RelationStatsProps) {
  const s = useMemo(() => relationStats(direct, via), [direct, via])
  const rows = useMemo(() => statKindRows(s.marks, hopSel), [s.marks, hopSel])
  const max = Math.max(1, ...rows.map((r) => (hopSel === 'own' ? r.own : hopSel === 'via' ? r.via : r.own + r.via)))
  /* QUIET, AND SELECTED IN THE ACCENT RATHER THAN IN INK. A solid `--text-2` fill with reversed
     type made the summary the darkest mark in a panel of 11px coloured bars, which inverts the
     hierarchy — it is the least specific thing here. Two light ink tints inside a hairline show
     the PROPORTION; the pond accent the tree rows already use for it shows the CHOICE.
     THE TINTS DROPPED AGAIN 2026-09-20 (owner: the direct half "looks a bit too loud compared to
     other things"), 26% to 15% and 9% to 6%. The bar sits directly above kind bars carrying
     saturated hues at full strength, and at 26% this one was the heaviest mark in the block while
     being the least specific — the same inversion the solid fill was dropped for, one step
     smaller. What it may NOT lose is the difference between its halves: direct still reads as
     roughly twice the indirect tint, because that contrast is the proportion. */
  /* NO `data-kn-hover` ON EITHER OF THESE TWO, and that is not an omission: both name their own
     background inline (the tint IS the reading), and an inline style beats the utility's
     selector, so the attribute would be a claim the control does not honour. What answers the
     pointer here is the SELECTION itself: entering a segment or a row sets the filter, and the
     figure and the block both respond. */
  const hopSeg = (h: 'own' | 'via', label: string, n: number, frac: number) => (
    <span key={h} data-stat-hop={h} onPointerEnter={() => onHopSel && onHopSel(h)} onPointerLeave={() => onHopSel && onHopSel(null)}
      style={{
        width: (frac * 100) + '%', height: M.segH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        cursor: 'pointer', fontSize: 'var(--fs-micro)', whiteSpace: 'nowrap', overflow: 'hidden', color: 'var(--text-1)',
        opacity: hopSel && hopSel !== h ? 0.45 : 1,
        boxShadow: hopSel === h ? 'inset 0 0 0 1px var(--pond-400)' : 'none',
        background: hopSel === h ? 'var(--pond-100)' : (h === 'own'
          ? 'color-mix(in oklch, var(--text-1) 15%, var(--surface-paper))'
          : 'color-mix(in oklch, var(--text-1) 6%, var(--surface-paper))'),
      }}>
      <b>{n}</b>{label}</span>
  )
  /* A COUNT OF ZERO IS A READING, AND IT IS DRAWN AS THE SYSTEM'S PLACEHOLDER (owner's ruling,
     2026-09-22, at 1:1 off three built candidates — the two losers kept this state visually apart
     from a pane that has no subject, and this one deliberately does not). This returned `null`
     before, which put an empty figure above a hairline above nothing and left the rail looking
     unfinished — seen only once a corpus generated from real course outlines produced a course
     that states no prerequisite and that nothing depends on.
     THE SECOND LINE IS A `note`, NEVER A `gesture`, and that is the whole reason `note` was added
     to `PanePlaceholder`: there is nothing to DO about a course that publishes no prerequisites,
     and an instruction here sends the reader hunting for a control that does not exist.
     THE STATE LINE NAMES WHOSE ABSENCE IT IS. Since the ruling, the dashed shape no longer tells
     this state apart from "Nothing chosen", so the words carry it alone: "No relationships" is the
     NODE's absence. WHY there is nothing — unpublished, unrecorded, genuinely unconnected — stays
     the corpus's knowledge and belongs in the host's prose; a host must not add a second empty
     state beside this one. */
  if (!s.relationships) return (
    <PanePlaceholder state="No relationships" note="Nothing connects to this node" minHeight={120} />
  )
  return (
    <div data-relation-stats="1" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* TWO NUMBERS, BECAUSE THERE ARE TWO THINGS, and on one baseline so they read as a
          comparison rather than a list. The cells are EQUAL halves, so the hairline between them
          sits still whatever the two numbers are (see `metric`). */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {metric(s.neighbours, 'neighbours', 'neighbours')}
        <div style={{ flex: '0 0 1px', background: 'var(--border-hair)', margin: '0 9px' }}></div>
        {metric(s.relationships, 'relationships', 'relationships')}
      </div>
      {rule}
      {/* WHICH NUMBER IS BEING BROKEN DOWN, SAID IN WORDS. The hop bar counts NEIGHBOURS, the
          kind bars count RELATIONSHIPS, and the two totals differ — under one shared heading
          nothing said which was which, and that was a real ambiguity, not a labelling nicety. */}
      {secHead('Neighbours', 'by hop')}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, border: '1px solid var(--border-hair)', borderRadius: 3, overflow: 'hidden' }}>
        {hopSeg('own', 'direct', s.ownNeighbours, s.ownNeighbours / Math.max(1, s.neighbours))}
        {hopSeg('via', 'indirect', s.viaNeighbours, s.viaNeighbours / Math.max(1, s.neighbours))}
      </div>
      {rule}
      {secHead('Relationships', 'by kind', hopSel ? <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-2)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>{hopSel === 'own' ? 'direct' : 'indirect'}</span> : null)}
      {/* THE BAR IS THE SWATCH — no key column in front of it. The block was a swatch, a name
          column and a track: three columns to say one thing, and the swatch explained a colour
          the bar beside it was already drawing at full strength. Dropping them lets every bar
          START AT THE SAME LEFT EDGE, which is what makes lengths comparable, and the trailing
          group FOLLOWS THE BAR'S END rather than sitting in a right-hand column — the count has
          to touch the length it measures, so it leads the pair.
          THE TRACK IS PROPORTIONAL, NOT PIXEL-SIZED: hard pixel widths gave this block an
          intrinsic width of about 185px, which overran the narrow rail it is for. */}
      {rows.map((r) => {
        const own = hopSel === 'via' ? 0 : r.own
        const viaN = hopSel === 'own' ? 0 : r.via
        const c = own + viaN
        return (
          <div key={r.kind} data-stat-kind={r.kind} onPointerEnter={() => onKind && onKind(r.kind)} onPointerLeave={() => onKind && onKind(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', margin: '0 -4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: kind === r.kind ? 'var(--pond-50)' : 'transparent', opacity: kind && kind !== r.kind ? 0.45 : 1 }}>
            <span style={{ flex: '0 0 ' + (c / max * M.trackShare) + '%', display: 'flex', alignItems: 'center', gap: 1, minWidth: 10 }}>
              <span title={wrapTip(own + ' direct')} style={{ width: (c ? own / c * 100 : 0) + '%', height: M.barH, borderRadius: own && !viaN ? '3px' : '3px 0 0 3px', background: r.color }}></span>
              <span title={wrapTip(viaN + ' indirect')} style={{ width: (c ? viaN / c * 100 : 0) + '%', height: M.barH, borderRadius: viaN && !own ? '3px' : '0 3px 3px 0', background: 'color-mix(in oklch, ' + r.color + ' 45%, var(--surface-paper))' }}></span>
            </span>
            <span style={{ flex: '0 1 auto', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-1)', fontWeight: 'var(--fw-semibold)' }}>{c}</span>
              <span style={{ fontSize: 'var(--fs-micro)', color: kind === r.kind ? 'var(--text-1)' : 'var(--text-2)', fontWeight: kind === r.kind ? 'var(--fw-semibold)' : 'var(--fw-regular)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
