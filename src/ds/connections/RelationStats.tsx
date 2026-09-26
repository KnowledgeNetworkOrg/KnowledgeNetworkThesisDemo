import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { PanePlaceholder } from '../chrome/PanePlaceholder'
import { wrapTip } from '../chrome/IconButton'
import { relationLook } from './RelationCards'
import type { Relation, ViaRelation } from './RelationCards'
import { orbitMarks } from './RelationOrbit'
import type { OrbitMark } from './RelationOrbit'

/** THE NUMBERS THAT GO UNDER THE FIGURE. Chosen, not derived.
 *  `trackShare` is the fraction of a row the LONGEST bar is allowed; the rest is the reserve
 *  every row's text is read in. At 52% a 192px rail gives the top bar ~92px and leaves ~85px
 *  for "11 Contradicts" at 11px. `barH`/`segH` are the two bar weights: a kind bar is a data
 *  mark, the hop bar is a control, and the control is the taller of the two because it is
 *  pointed at. */
export const RELATION_STATS_METRICS = { trackShare: 52, barH: 11, segH: 16 } as const
const M = RELATION_STATS_METRICS

/** the counted population — see `relationStats` */
export interface RelationStatsReading {
  /** the marks the figure draws, one per (target, kind) */
  marks: OrbitMark[]
  /** distinct target NODES */
  neighbours: number
  /** marks — a neighbour with two kinds is two relationships */
  relationships: number
  /** neighbours holding ANY direct relationship */
  ownNeighbours: number
  /** neighbours reached only through a child */
  viaNeighbours: number
}

/** THE POPULATION, COUNTED ONCE. Both readings come off `orbitMarks` — the same call the figure
 *  draws from — so the chart cannot count a population the figure does not draw.
 *
 *  TWO MEASURES, AND THEY DO NOT SUM TO THE SAME NUMBER: `neighbours` counts distinct target
 *  NODES, `relationships` counts marks.
 *
 *  A NEIGHBOUR IS DIRECT IF IT HOLDS ANY DIRECT RELATIONSHIP, otherwise it is indirect. The two
 *  halves then partition the neighbours and the hop bar sums to the headline. */
export function relationStats(direct?: readonly Relation[] | null, via?: readonly ViaRelation[] | null): RelationStatsReading {
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

/** one kind's row in the chart */
export interface StatKindRow {
  kind: string
  own: number
  via: number
  /** the kind's own wording, through `relationLook` — the chart and the cards name it one way */
  label: string
  /** the kind's stroke, through `relationLook` */
  color: string
}

/** THE KINDS, IN DESCENDING ORDER OF THE MEASURE BEING SHOWN — never held in total order. A
 *  staircase sorted by a total it is no longer showing is not a staircase. */
export function statKindRows(marks: readonly OrbitMark[], hopSel?: 'own' | 'via' | null): StatKindRow[] {
  const by = new Map<string, StatKindRow>()
  for (const m of marks) {
    const k = m.rel.kind
    const look = relationLook(m.rel)
    const row = by.get(k) || { kind: k, own: 0, via: 0, label: look.label, color: look.color }
    if (m.via) row.via += 1; else row.own += 1
    by.set(k, row)
  }
  const active = (r: StatKindRow) => (hopSel === 'own' ? r.own : hopSel === 'via' ? r.via : r.own + r.via)
  return [...by.values()].filter((r) => active(r) > 0).sort((a, b) => active(b) - active(a))
}

/** the capitalised way in. Same function objects: `StatsMath.of` IS `relationStats`,
 *  `StatsMath.rows` IS `statKindRows`. */
export const StatsMath = { of: relationStats, rows: statKindRows }

const metric = (n: number, label: string) => (
  /* EQUAL HALVES, so the divider between the two cells sits still whatever the two numbers are
     (owner, 2026-09-20, twice). */
  <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 'var(--fs-title)', fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 1 }}>{n}</span>
    {/* A UNIT, NOT A HEADING — lower case, because a word under a numeral is its unit. */}
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
 *  LEGEND as much as its dashboard: the kind rows are the only place the figure's hues are
 *  named, which is why the space under the graph is this and not a list of cards.
 *
 *  EVERY CONTROL HERE IS A HOVER, because every other filter in the rail is. Nothing here is
 *  clickable, so a pinned selection has no way to be cleared and none is offered.
 *
 *  A COUNT OF ZERO IS A READING, AND IT IS DRAWN AS THE SYSTEM'S PLACEHOLDER — "No
 *  relationships" over the `note` "Nothing connects to this node". The second line is a `note`,
 *  never a `gesture`: there is nothing to DO about a course that publishes no prerequisites.
 *  A host must not add a second empty state beside this one.
 *
 *  WHAT THE HOST AROUND IT MUST DO:
 *  1. MIRROR THE FILTERS ONTO THE FIGURE — pass the same `kind` and `hopSel` to `RelationOrbit`.
 *  2. FEED IT THE SAME `direct`/`via` THE FIGURE GETS, decomposed one per (target, kind).
 *  3. GIVE IT THE RAIL'S WIDTH and nothing else. Every track is a percentage.
 *
 *  Typed port of the DS components/connections/RelationStats.jsx (OB-235, with its 2026-09-22
 *  amendment; #342). */
export interface RelationStatsProps {
  /** the centred node's own relationships, one per (target, kind) */
  direct?: Relation[]
  /** relationships a DESCENDANT holds, with the containment path */
  via?: ViaRelation[]
  /** the kind whose row is lit and whose wedge the figure washes — the host's filter */
  kind?: string | null
  /** the pointer entered a kind row (its kind) or left it (null) */
  onKind?: (kind: string | null) => void
  /** which hop the pointer has selected; washes that ring in the figure and filters these bars */
  hopSel?: 'own' | 'via' | null
  /** the pointer entered a hop segment or left it (null) */
  onHopSel?: (hop: 'own' | 'via' | null) => void
}

export function RelationStats({ direct, via, kind, onKind, hopSel, onHopSel }: RelationStatsProps) {
  const s = useMemo(() => relationStats(direct, via), [direct, via])
  const rows = useMemo(() => statKindRows(s.marks, hopSel), [s.marks, hopSel])
  const max = Math.max(1, ...rows.map((r) => (hopSel === 'own' ? r.own : hopSel === 'via' ? r.via : r.own + r.via)))
  /* QUIET, AND SELECTED IN THE ACCENT RATHER THAN IN INK: two light ink tints inside a hairline
     show the PROPORTION (15% / 6%, dropped 2026-09-20 from 26% / 9%); the pond accent shows the
     CHOICE. No `data-kn-hover`: both segments name their own background inline, and the
     selection itself is what answers the pointer. */
  const hopSeg = (h: 'own' | 'via', label: string, n: number, frac: number) => (
    <span key={h} data-stats-hop={h} onPointerEnter={() => onHopSel && onHopSel(h)} onPointerLeave={() => onHopSel && onHopSel(null)}
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
  if (!s.relationships) return (
    <PanePlaceholder state="No relationships" note="Nothing connects to this node" minHeight={120} />
  )
  return (
    <div data-relation-stats="1" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* TWO NUMBERS, BECAUSE THERE ARE TWO THINGS, on one baseline so they read as a
          comparison rather than a list. */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {metric(s.neighbours, 'neighbours')}
        <div style={{ flex: '0 0 1px', background: 'var(--border-hair)', margin: '0 9px' }}></div>
        {metric(s.relationships, 'relationships')}
      </div>
      {rule}
      {/* WHICH NUMBER IS BEING BROKEN DOWN, SAID IN WORDS: the hop bar counts NEIGHBOURS, the
          kind bars count RELATIONSHIPS, and the two totals differ. */}
      {secHead('Neighbours', 'by hop')}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, border: '1px solid var(--border-hair)', borderRadius: 3, overflow: 'hidden' }}>
        {hopSeg('own', 'direct', s.ownNeighbours, s.ownNeighbours / Math.max(1, s.neighbours))}
        {hopSeg('via', 'indirect', s.viaNeighbours, s.viaNeighbours / Math.max(1, s.neighbours))}
      </div>
      {rule}
      {secHead('Relationships', 'by kind', hopSel ? <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-2)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>{hopSel === 'own' ? 'direct' : 'indirect'}</span> : null)}
      {/* THE BAR IS THE SWATCH — no key column in front of it, so every bar STARTS AT THE SAME
          LEFT EDGE and the count FOLLOWS THE BAR'S END. THE TRACK IS PROPORTIONAL, NOT
          PIXEL-SIZED: hard pixel widths gave this block an intrinsic width that overran the rail. */}
      {rows.map((r) => {
        const own = hopSel === 'via' ? 0 : r.own
        const viaN = hopSel === 'own' ? 0 : r.via
        const c = own + viaN
        return (
          <div key={r.kind} data-stats-kind={r.kind} onPointerEnter={() => onKind && onKind(r.kind)} onPointerLeave={() => onKind && onKind(null)}
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
