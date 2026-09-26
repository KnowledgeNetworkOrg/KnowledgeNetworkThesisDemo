import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { topicPaint } from '../graph/DomainDot'
import { relationPaint } from '../graph/EdgeLegend'
import type { Relation, ViaRelation } from './RelationCards'

/** THE FIGURE'S TWO CHANNELS AND THE NUMBERS THAT DRAW THEM. All CHOSEN, not derived.
 *  `inner` is the inner ring's radius as a FRACTION of the outer one, so the two rings keep
 *  their relationship at every rail width. `viaFade` is a MULTIPLIER, never an opacity: a via
 *  node rests at 1 × 0.55 and a via edge at 0.5 × 0.55, and a flat 0.55 would make the edge
 *  STRONGER than a direct one. `spread` is the share of its wedge a kind's marks fan across;
 *  `hit` is the invisible target around a 3.5px dot, and `hitLine` the transparent twin an
 *  unpointable 1px line carries. `minSectors` is the floor on how much of the circle ONE kind
 *  may own — see `orbitWedge`. */
export const ORBIT_METRICS = { inner: 0.52, viaFade: 0.55, spread: 0.66, hit: 11, hitLine: 8, dot: 3.5, dotHot: 5, hub: 6, minSectors: 2 } as const
const M = ORBIT_METRICS

/** THE WEDGE ONE KIND OWNS, IN DEGREES, AND THE FLOOR UNDER IT. A single kind may not own the
 *  whole circle: with `360 / 1` its marks fan across every angle, and in a figure whose one rule
 *  is ANGLE IS THE KIND that draws five relationships of one kind exactly as it draws five
 *  different kinds. Seen at 1:1 on the course corpus, where every arrow is `depends_on`.
 *
 *  The floor is `minSectors` = 2, CHOSEN: one kind takes half the circle and the empty half says
 *  the vocabulary has room this data does not fill. The true figure would be the corpus's
 *  relation vocabulary size, which is the HOST's knowledge and deliberately not a prop.
 *
 *  A FUNCTION BECAUSE THE ARITHMETIC IS NEEDED TWICE — mark placement and the wedge wash — and a
 *  floor applied to one of them alone washes half a circle under marks fanned across all of it. */
export function orbitWedge(kindCount: number): number {
  return 360 / Math.max(M.minSectors, kindCount || 0)
}

/** THE HUB'S KEY. It is not one of the relationships, so it needs a name the hover state can
 *  carry; a sentinel is cheaper than a second piece of state meaning "the middle". */
export const ORBIT_SELF = '@self'

/** one drawn mark: a relationship, and — on the outer ring — the descendant that holds it */
export interface OrbitMark {
  /** `<targetId>|<kind>` — one relationship */
  key: string
  rel: Relation
  /** the descendant holding a via-children relationship; null on the inner (direct) ring */
  via: { id: string; title: string; domain?: string } | null
}

/** ONE MARK PER RELATIONSHIP, NEVER PER NEIGHBOUR — the decision the whole figure rests on.
 *  A neighbour with two kinds is TWO marks sharing one target id: hovering either lights both,
 *  and the card is the same — the figure saying "one neighbour, twice related" instead of a
 *  badge annotating it. Published so a legend or a count beside the figure counts the same
 *  population it draws. */
export function orbitMarks(direct?: readonly Relation[] | null, via?: readonly ViaRelation[] | null): OrbitMark[] {
  const out: OrbitMark[] = []
  for (const r of direct || []) out.push({ key: r.targetId + '|' + r.kind, rel: r, via: null })
  for (const v of via || []) out.push({ key: v.rel.targetId + '|' + v.rel.kind, rel: v.rel, via: v.path && v.path.length ? v.path[v.path.length - 1] : null })
  return out
}

/** THE KIND ORDER THE WEDGES ARE CUT IN — first appearance, so a corpus's own vocabulary keeps
 *  the order it authored. Published because a legend beneath the figure must tile the circle
 *  the same way or the two disagree. */
export function orbitKinds(marks: readonly { rel: Relation }[]): string[] {
  const seen: string[] = []
  for (const m of marks) if (seen.indexOf(m.rel.kind) < 0) seen.push(m.rel.kind)
  return seen
}

/** the capitalised way in to this file's resolvers. Same function objects: `OrbitMath.marks` IS
 *  `orbitMarks`, `OrbitMath.kinds` IS `orbitKinds`, `OrbitMath.wedge` IS `orbitWedge`. */
export const OrbitMath = { marks: orbitMarks, kinds: orbitKinds, wedge: orbitWedge }

/**
 * THE NEIGHBOURHOOD AS AN ORBIT, ORDERED BY KIND — the figure the dissolved connections pane puts
 * in the Document pane's relations rail (owner's pick, 2026-09-19).
 *
 * ANGLE IS THE KIND, RADIUS IS THE HOP. A kind owns one contiguous wedge, the inner ring is
 * `direct` and the outer is `indirect`, so a kind's own marks stack radially and pointing at that
 * kind lights a wedge rather than a scatter.
 *
 * THE REGION THE READER IS POINTING AT WASHES, and rest stays neutral. A kind washes in its OWN
 * hue; a hop washes in the accent, because a hop is not one of the kinds. The wash is a GROUND —
 * painted under everything — so the marks stay the strongest ink.
 *
 * IT DRAWS NOTHING WHEN THERE ARE NO MARKS: the two dashed rings are the hop BANDS, and around a
 * lone hub they label two regions with no members. The emptiness is said once, in words, by
 * `RelationStats`.
 *
 * WHAT THE HOST AROUND IT MUST DO:
 * 1. OWN THE CARD. The figure reports what is pointed at (`onHot`) and draws nothing about it.
 * 2. CENTRE IT ON THE DOCUMENT'S NODE. The hub is not a third piece of state the figure keeps.
 * 3. Feed `direct` and `via` DECOMPOSED, one entry per (target, kind).
 * 4. Mirror the filters if it draws its own legend — `kind` and `hopSel` are the host's state.
 *
 * Typed port of the DS components/connections/RelationOrbit.jsx (OB-229, with its 2026-09-22
 * amendments (a) and (b); #342).
 */
export interface RelationOrbitProps {
  /** the drawing's box, px. The rail derives it from its own width (`orbitBox`) */
  width?: number
  /** the drawing's box, px — kept a little taller than wide so the rings stay round */
  height?: number
  /** the centred node's own relationships, one per (target, kind) */
  direct?: Relation[]
  /** relationships a DESCENDANT holds, with the containment path — drawn on the outer ring */
  via?: ViaRelation[]
  /** WHAT IS POINTED AT, as a key: `<targetId>|<kind>` is one relationship, `<targetId>` is the
   *  neighbour (both of a twin-kinded pair), `ORBIT_SELF` is the hub. One piece of state for
   *  three readings, split where it is read */
  hot?: string | null
  /** the pointer's key changed. Carries the pointer event, so the host can place its card */
  onHot?: (key: string | null, e: ReactPointerEvent<Element>) => void
  /** the kind whose wedge is washed — the host's filter, mirrored here */
  kind?: string | null
  /** the ring zone the POINTER is in, reported back so a host can mirror it */
  hop?: 'own' | 'via' | null
  /** the ring zone under the pointer changed */
  onHop?: (hop: 'own' | 'via' | null) => void
  /** the hop the host's own control has selected: washes that ring, dims the other, and LIFTS
   *  the through-a-child fade */
  hopSel?: 'own' | 'via' | null
  /** draw each mark's name beside it. Needs roughly 320px of rail */
  labels?: boolean
}

export function RelationOrbit({ width = 216, height = 240, direct, via, hot, onHot, kind, hop, onHop, hopSel, labels }: RelationOrbitProps) {
  const cx = width / 2, cy = height / 2
  const marks = useMemo(() => orbitMarks(direct, via), [direct, via])
  const kinds = useMemo(() => orbitKinds(marks), [marks])
  const byKey = useMemo(() => { const m: Record<string, OrbitMark> = {}; for (const x of marks) m[x.key] = x; return m }, [marks])
  /* WHAT IS POINTED AT IS A KEY, NOT AN ID: `t1|uses` is one relationship, `t1` is the
     neighbour (both of its lines), `@self` is the hub. */
  const hotId = hot && hot !== ORBIT_SELF ? String(hot).split('|')[0] : null
  const hotKind = hot && String(hot).indexOf('|') > 0 ? String(hot).split('|')[1] : null
  /* ROUND, NOT AN OVAL: one radius from the smaller of what the width and the height allow. */
  const R = Math.max(24, Math.min(width / 2 - 18, cy - 30))
  const rx = labels ? Math.min(52, width / 2 - 74) : R
  const ry = labels ? Math.max(24, Math.min(cy - 30, rx * 1.5)) : R
  /* ★ LOCAL: POSITIONS ARE HELD BY THE MARK'S PLACE IN THE LIST, NOT BY ITS `key`. Two children
     related the same way to the same outside node are two relationships with ONE key
     (`X|depends_on` twice in `via`) — a module whose two topics both build on one external topic
     is ordinary in this corpus. Keyed by `key`, the second position overwrote the first, so the
     figure drew two marks on one spot while the chart under it counted two, and React met two
     children with the same key. The hover key is unchanged: both marks still report `X|kind`,
     and hovering either lights both, which is what one neighbour reached twice should do. */
  const geo = useMemo(() => {
    const own = marks.filter((m) => !m.via), viaM = marks.filter((m) => !!m.via)
    const peers: Record<string, OrbitMark[]> = {}
    for (const [ring, list] of [['own', own], ['via', viaM]] as const) {
      for (const k of kinds) peers[ring + '|' + k] = list.filter((m) => m.rel.kind === k)
    }
    const pos: { x: number; y: number }[] = []
    const wedge = orbitWedge(kinds.length)
    for (const m of marks) {
      const list = peers[(m.via ? 'via' : 'own') + '|' + m.rel.kind] || [m]
      const ki = kinds.indexOf(m.rel.kind)
      const j = list.indexOf(m)
      const span = wedge * M.spread
      const step = list.length > 1 ? span / (list.length - 1) : 0
      const a = (-90 + ki * wedge + wedge / 2 + (list.length > 1 ? -span / 2 + j * step : 0)) * Math.PI / 180
      const f = m.via ? 1 : M.inner
      pos.push({ x: cx + Math.cos(a) * rx * f, y: cy + Math.sin(a) * ry * f })
    }
    return pos
  }, [marks, kinds, cx, cy, rx, ry])
  /* THE FADE LIFTS FOR WHICHEVER CONTROL SELECTED THE SET — the ring zone under the pointer
     (`hop`) or the host's own hop control (`hopSel`). */
  const fade = (m: OrbitMark, on: boolean) => (m.via && !on && hop !== 'via' && hopSel !== 'via' ? M.viaFade : 1)
  const offHop = (m: OrbitMark) => !!hopSel && (hopSel === 'via') !== !!m.via
  const HOP_WASH = 'color-mix(in oklch, var(--accent-primary) 12%, transparent)'
  const rectRef = useRef<DOMRect | null>(null)
  useEffect(() => {
    const drop = () => { rectRef.current = null }
    window.addEventListener('scroll', drop, true); window.addEventListener('resize', drop)
    return () => { window.removeEventListener('scroll', drop, true); window.removeEventListener('resize', drop) }
  }, [])
  /* ONE POINTERMOVE OWNS BOTH READINGS, and that is a correctness fix rather than a saving: an
     element-based ring zone flickers off and back as the pointer crosses onto a dot inside it.
     Read from the pointer, leaving is a fact about the radius, and a mark is never ambiguous
     about its own ring — so over a mark the answer comes from the MARK. */
  const onMove = (ev: ReactPointerEvent<SVGSVGElement>) => {
    if (!rectRef.current) rectRef.current = ev.currentTarget.getBoundingClientRect()
    const b = rectRef.current
    const target = ev.target as Element | null
    const g = target && typeof target.closest === 'function' ? target.closest('[data-orbit]') : null
    const key = g ? g.getAttribute('data-orbit') : null
    if (key !== hot && onHot) onHot(key, ev)
    if (!onHop) return
    let next: 'own' | 'via' | null
    if (key === ORBIT_SELF) next = null
    else if (key) {
      const m = byKey[key] || byKey[Object.keys(byKey).find((k) => k.split('|')[0] === key) || '']
      next = m ? (m.via ? 'via' : 'own') : null
    } else {
      const dx = (ev.clientX - b.left - cx) / rx, dy = (ev.clientY - b.top - cy) / ry
      const d = Math.sqrt(dx * dx + dy * dy)
      next = d <= M.inner ? 'own' : (d <= 1 ? 'via' : null)
    }
    if (next !== hop) onHop(next)
  }
  /* NOTHING TO DRAW IS DRAWN AS NOTHING (amendment (b)): around a lone hub the two dashed rings
     label two regions with no members, which reads as a figure still loading. Every hook above
     this line runs unconditionally; the return is placed after the last one. */
  if (!marks.length) return null
  const wedgePath = (k: string, ki: number) => {
    const w = orbitWedge(kinds.length)
    const a0 = (-90 + ki * w) * Math.PI / 180, a1 = (-90 + (ki + 1) * w) * Math.PI / 180
    const pt = (a: number) => (cx + Math.cos(a) * rx) + ' ' + (cy + Math.sin(a) * ry)
    return <path key={'w' + k} data-orbit-wedge={k} d={'M ' + cx + ' ' + cy + ' L ' + pt(a0) + ' A ' + rx + ' ' + ry + ' 0 0 1 ' + pt(a1) + ' Z'}
      fill={'color-mix(in oklch, ' + relationPaint(k).stroke + ' 12%, transparent)'} pointerEvents="none" />
  }
  const ringWash = (which: 'own' | 'via') => which === 'own'
    ? <ellipse cx={cx} cy={cy} rx={rx * M.inner} ry={ry * M.inner} fill={HOP_WASH} pointerEvents="none" />
    : <path fillRule="evenodd" fill={HOP_WASH} pointerEvents="none"
        d={'M ' + (cx - rx) + ' ' + cy + ' A ' + rx + ' ' + ry + ' 0 1 0 ' + (cx + rx) + ' ' + cy + ' A ' + rx + ' ' + ry + ' 0 1 0 ' + (cx - rx) + ' ' + cy + ' Z M ' + (cx - rx * M.inner) + ' ' + cy + ' A ' + (rx * M.inner) + ' ' + (ry * M.inner) + ' 0 1 0 ' + (cx + rx * M.inner) + ' ' + cy + ' A ' + (rx * M.inner) + ' ' + (ry * M.inner) + ' 0 1 0 ' + (cx - rx * M.inner) + ' ' + cy + ' Z'} />
  return (
    <svg width={width} height={height} style={{ display: 'block' }} onPointerMove={onMove}
      onPointerLeave={(ev) => { if (onHot) onHot(null, ev); if (onHop) onHop(null) }}>
      <g>
        {kind ? kinds.map((k, ki) => (k === kind ? wedgePath(k, ki) : null)) : null}
        {hopSel ? ringWash(hopSel) : (hop ? ringWash(hop) : null)}
        <ellipse cx={cx} cy={cy} rx={rx * M.inner} ry={ry * M.inner} fill="none" stroke="var(--border-hair)" strokeWidth="1" strokeDasharray="2 3" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={hop === 'via' ? 'var(--border-rule)' : 'var(--border-hair)'} strokeWidth="1" strokeDasharray="2 3" pointerEvents="none" />
        {/* THE RING NAMES ITSELF, FLAT AND INSIDE THE REGION IT NAMES — drawn as GROUND,
            uppercase and tracked, under the ink of the data, like a place name on a map. */}
        <text x={cx} y={cy - ry * M.inner * 0.52} textAnchor="middle" fontSize="9" letterSpacing="0.11em" pointerEvents="none" style={{ textTransform: 'uppercase' }}
          fill={(hopSel || hop) === 'own' ? 'var(--text-2)' : 'var(--text-3)'} opacity={(hopSel || hop) === 'own' ? 1 : 0.8}>direct</text>
        <text x={cx} y={cy - (ry * M.inner + ry) / 2} textAnchor="middle" fontSize="9" letterSpacing="0.11em" pointerEvents="none" style={{ textTransform: 'uppercase' }}
          fill={(hopSel || hop) === 'via' ? 'var(--text-2)' : 'var(--text-3)'} opacity={(hopSel || hop) === 'via' ? 1 : 0.8}>indirect</text>
      </g>
      {marks.map((m, i) => {
        const q = geo[i], on = hotId === m.rel.targetId
        const lineOn = on && (!hotKind || hotKind === m.rel.kind)
        const dim = (kind && m.rel.kind !== kind) || offHop(m)
        const op = (dim ? 0.08 : (hotId && !on ? 0.14 : (lineOn ? 1 : (on ? 0.75 : 0.5)))) * fade(m, on)
        return <line key={m.key + '#' + i} x1={cx} y1={cy} x2={q.x} y2={q.y} stroke={relationPaint(m.rel.kind).stroke} strokeWidth={lineOn ? 1.8 : 1} strokeOpacity={op} />
      })}
      {/* A LINE'S HIT TARGET IS NOT ITS INK, and it is cut to the band its own hop owns: every
          line is drawn from the hub, so inside the inner ring the indirect twins would cross the
          space the direct ones occupy. Direct twins are painted last so the shared boundary
          resolves inwards. */}
      {marks.map((m, i) => ({ m, i })).sort((a, b) => (a.m.via ? 0 : 1) - (b.m.via ? 0 : 1)).map(({ m, i }) => {
        const q = geo[i], s = m.via ? M.inner : 0
        return <line key={'hit' + m.key + '#' + i} data-orbit={m.key} x1={cx + (q.x - cx) * s} y1={cy + (q.y - cy) * s} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={M.hitLine} style={{ cursor: 'pointer' }} />
      })}
      {marks.map((m, i) => {
        const q = geo[i], on = hotId === m.rel.targetId
        const dim = (kind && m.rel.kind !== kind) || offHop(m)
        return (
          <g key={'n' + m.key + '#' + i} data-orbit={m.rel.targetId} data-orbit-lit={on ? 1 : 0} opacity={(dim ? 0.18 : (hotId && !on ? 0.3 : 1)) * fade(m, on)} style={{ cursor: 'pointer' }}>
            <circle cx={q.x} cy={q.y} r={M.hit} fill="transparent" />
            <circle cx={q.x} cy={q.y} r={on ? M.dotHot : M.dot} fill={topicPaint(m.rel.targetDomain).mark} />
            {labels ? <text x={q.x + 6} y={q.y + 3} fontSize="11" fill={on ? 'var(--text-1)' : 'var(--text-2)'} fontWeight={on ? 600 : 400}
              stroke="var(--surface-sunken)" strokeWidth="2.6" paintOrder="stroke">{m.rel.targetTitle}</text> : null}
          </g>
        )
      })}
      {/* THE HUB IS A MARK LIKE THE OTHERS: it is the topic the figure is about, so pointing at
          it previews that node rather than nothing. It belongs to no ring and dims nothing. */}
      <g data-orbit={ORBIT_SELF} data-orbit-lit={hot === ORBIT_SELF ? 1 : 0} style={{ cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={13} fill="transparent" />
        <circle cx={cx} cy={cy} r={hot === ORBIT_SELF ? M.hub + 1 : M.hub} fill="var(--accent-primary)" />
      </g>
    </svg>
  )
}
