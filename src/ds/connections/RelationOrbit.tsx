import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { topicPaint } from '../graph/DomainDot'
import { relationPaint } from '../graph/EdgeLegend'
import type { Relation, ViaRelation } from './RelationCards'

/** THE FIGURE'S TWO CHANNELS AND THE NUMBERS THAT DRAW THEM. Both are CHOSEN, not derived.
 *  `inner` is the inner ring's radius as a FRACTION of the outer one, so the two rings keep their
 *  relationship at every rail width — it is the reading that made them look evenly spaced against
 *  the hub, not a value the geometry forces, and it was typed in eight places before it was a
 *  constant. `viaFade` is a MULTIPLIER, never an opacity: a via node rests at 1 × 0.55 and a via
 *  edge at 0.5 × 0.55, and a flat 0.55 would make the edge STRONGER than a direct one. `spread` is
 *  the share of its wedge a kind's marks fan across; `hit` is the invisible target around a 3.5px
 *  dot, and `hitLine` the transparent twin an unpointable 1px line carries. `minSectors` is
 *  CHOSEN, and it is the floor on how much of the circle ONE kind may own — see `orbitWedge`. */
export const ORBIT_METRICS = { inner: 0.52, viaFade: 0.55, spread: 0.66, hit: 11, hitLine: 8, dot: 3.5, dotHot: 5, hub: 6, minSectors: 2 }
const M = ORBIT_METRICS

/** THE WEDGE ONE KIND OWNS, IN DEGREES, AND THE FLOOR UNDER IT. A single kind may not own the
 *  whole circle: with `360 / 1` its marks fan across every angle, and in a figure whose one rule
 *  is ANGLE IS THE KIND that draws five relationships of one kind exactly as it draws five
 *  different kinds — the reader cannot tell the two pictures apart. Seen at 1:1 on a corpus
 *  generated from real course prerequisites, where three of the four relation kinds are
 *  permanently empty and every arrow is `depends_on`: five marks, one kind, five directions.
 *
 *  The floor is `minSectors` = 2, CHOSEN and not derived: two is the smallest number of sectors
 *  that still reads as a sector, so one kind takes half the circle and the empty half says the
 *  vocabulary has room this data does not fill. A component cannot derive the true figure — that
 *  would be the size of the corpus's relation vocabulary, which is the host's knowledge and is
 *  deliberately NOT a prop: a closed union of kinds here becomes a lint rule in a consumer.
 *
 *  It is a function because the arithmetic had been typed twice — the mark placement and the wedge
 *  wash — and a floor added to one of them only would light a half-circle wash under marks fanned
 *  across the whole one. */
export function orbitWedge(kindCount: number): number {
  return 360 / Math.max(M.minSectors, kindCount || 0)
}

/** THE HUB'S KEY. It is not one of the relationships, so it needs a name the hover state can
 *  carry; a sentinel is cheaper than a second piece of state meaning "the middle". */
export const ORBIT_SELF = '@self'

/** one mark of the figure: a RELATIONSHIP (never a neighbour), the ring it sits on, and — for an
 *  indirect one — the descendant that owns it */
export interface OrbitMark {
  /** `<targetId>|<kind>` — what the pointer reports and what the card is looked up by */
  key: string
  rel: Relation
  /** the descendant the relationship was found through, or null for a direct one */
  via: { id: string; title: string; domain?: string } | null
}

/** ONE MARK PER RELATIONSHIP, NEVER PER NEIGHBOUR — the decision the whole figure rests on.
 *  A dot used to be a NEIGHBOUR, placed in the wedge of its FIRST kind, while a kind filter lights
 *  every relationship that CARRIES the kind. A neighbour with two kinds therefore lit a dot parked
 *  in another kind's wedge, which is the one thing an angle-is-the-kind layout promises never to
 *  do; it also made the figure's count disagree with the legend's. One mark per relationship fixes
 *  both, and the twin marks share a target id, so hovering either lights both and the card is the
 *  same — the figure saying "one neighbour, twice related" instead of a badge annotating it. */
export function orbitMarks(direct?: readonly Relation[] | null, via?: readonly ViaRelation[] | null): OrbitMark[] {
  const out: OrbitMark[] = []
  for (const r of direct || []) out.push({ key: r.targetId + '|' + r.kind, rel: r, via: null })
  for (const v of via || []) out.push({ key: v.rel.targetId + '|' + v.rel.kind, rel: v.rel, via: v.path && v.path.length ? v.path[v.path.length - 1] : null })
  return out
}

/** THE KIND ORDER THE WEDGES ARE CUT IN — first appearance, so a corpus's own vocabulary keeps
 *  the order it authored rather than an alphabetical one nobody chose. Published because the
 *  legend beneath the figure must tile the circle the same way or the two disagree. */
export function orbitKinds(marks: readonly { rel: { kind: string } }[]): string[] {
  const seen: string[] = []
  for (const m of marks) if (seen.indexOf(m.rel.kind) < 0) seen.push(m.rel.kind)
  return seen
}

/** the capitalised way in to this file's resolvers, for a card or a raw page reading off
 *  `window.<Namespace>` (which carries no lower-case export). Same function objects, no second
 *  implementation: `OrbitMath.marks` IS `orbitMarks`, `OrbitMath.kinds` IS `orbitKinds`.
 *  Application code imports the named functions. */
export const OrbitMath = { marks: orbitMarks, kinds: orbitKinds, wedge: orbitWedge }

/** THE NEIGHBOURHOOD AS AN ORBIT, ORDERED BY KIND — the figure the dissolution puts in a rail
 *  (owner's pick, 2026-09-19, over a herringbone, a spine, a plain orbit and a kind × hop grid).
 *
 *  ANGLE IS THE KIND, RADIUS IS THE HOP. Two channels, both meaningful and independent: a kind
 *  owns one contiguous wedge, the inner ring is `direct` and the outer is `indirect`, so a kind's
 *  own marks stack radially and pointing at that kind lights a wedge rather than a scatter.
 *
 *  THE REGION THE READER IS POINTING AT WASHES, and rest stays neutral. Four permanent tints would
 *  spend colour saying what the edge colours already say, on a panel that is on screen all day. A
 *  kind washes in its OWN hue; a hop washes in the accent, because a hop is not one of the kinds.
 *  The wash is a GROUND — painted under everything and mixed with transparent — so the marks stay
 *  the strongest ink, and a wedge is the full share of the circle, not the arc the dots happen to
 *  span: tiling means every point belongs to exactly one kind, where a gap would draw a boundary
 *  that means nothing.
 *
 *  IT DRAWS NOTHING WHEN THERE ARE NO MARKS, and that is a behaviour rather than a guard: the two
 *  dashed rings are the hop BANDS, so around a lone hub they label two regions with no members and
 *  the figure reads as one still loading. The emptiness is stated once, in words, by
 *  `RelationStats` — a count of zero is a reading. A HOST MUST NOT ADD A THIRD EMPTY STATE.
 *
 *  ONE KIND DOES NOT OWN THE WHOLE CIRCLE — see `orbitWedge`.
 *
 *  WHAT THE HOST AROUND IT MUST DO:
 *  1. OWN THE CARD. The figure reports what is pointed at and draws nothing about it — the host
 *     opens the relationship card for a relationship or a neighbour, and the node's own preview
 *     for the hub. The card goes over the PROSE, never over the figure being pointed at.
 *  2. CENTRE IT ON THE DOCUMENT'S NODE. The hub is whatever the pane is reading; it is not a
 *     third piece of state the figure keeps.
 *  3. Feed `direct` and `via` DECOMPOSED, one entry per (target, kind). The figure draws one mark
 *     per RELATIONSHIP, so a pre-merged pair cannot be un-merged and its second kind is lost. And
 *     one entry per (target, kind) means ONE: two entries with the same key are one mark drawn
 *     twice on the same spot, under a duplicated React key.
 *  4. Mirror the filters if it draws its own legend. `kind` and `hopSel` are the host's state;
 *     the figure washes the region they name and reports the ring the pointer is in through
 *     `onHop`, so a bar under the figure and the figure itself stay one reading.
 *
 *  Typed port of the DS components/connections/RelationOrbit.jsx (contract: RelationOrbit.d.ts),
 *  OB-229 / #342. */
export interface RelationOrbitProps {
  /** the figure's width in px. Default 216 */
  width?: number
  /** the figure's height in px. Default 240 */
  height?: number
  /** the centred node's own relationships, one per (target, kind) */
  direct?: Relation[]
  /** relationships a DESCENDANT holds, with the containment path — drawn on the outer ring */
  via?: ViaRelation[]
  /** WHAT IS POINTED AT, as a key: `<targetId>|<kind>` is one relationship, `<targetId>` is the
   *  neighbour (both of a twin-kinded pair), `ORBIT_SELF` is the hub. One piece of state for
   *  three readings, split where it is read — a host wires one `onHot` and gets all three. */
  hot?: string | null
  /** the pointer moved onto a different mark (or off every one — null). The event is the pointer's
   *  own, and is absent on the leave that ends the hover */
  onHot?: (key: string | null, e?: ReactPointerEvent<Element>) => void
  /** the kind whose wedge is washed — the host's filter, mirrored here */
  kind?: string | number | null
  /** the ring zone the POINTER is in, reported back so a host can mirror it (`'own' | 'via'`) */
  hop?: 'own' | 'via' | null
  /** the ring zone the pointer entered or left */
  onHop?: (hop: 'own' | 'via' | null) => void
  /** the hop the host's own control has selected: washes that ring, dims the other, and LIFTS the
   *  through-a-child fade — the fade exists to push the further set back, and the moment that set
   *  is what you are reading, holding it back works against you. */
  hopSel?: 'own' | 'via' | null
  /** draw each mark's name beside it. Needs roughly 320px of rail: below that the names do not
   *  fit and the hover card is where they live. Default off */
  labels?: boolean
}

export function RelationOrbit({ width = 216, height = 240, direct, via, hot, onHot, kind, hop, onHop, hopSel, labels }: RelationOrbitProps) {
  const cx = width / 2, cy = height / 2
  const marks = useMemo(() => orbitMarks(direct, via), [direct, via])
  const kinds = useMemo(() => orbitKinds(marks), [marks])
  const byKey = useMemo(() => { const m: Record<string, OrbitMark> = {}; for (const x of marks) m[x.key] = x; return m }, [marks])
  /* WHAT IS POINTED AT IS A KEY, NOT AN ID: `t1|uses` is one relationship, `t1` is the neighbour
     (both of its lines), `@self` is the hub. One piece of state carries all three, split where it
     is read, so a host wires one `onHot` and gets three readings. */
  const hotNow = hot ?? null
  const hotId = hotNow && hotNow !== ORBIT_SELF ? String(hotNow).split('|')[0] : null
  const hotKind = hotNow && String(hotNow).indexOf('|') > 0 ? String(hotNow).split('|')[1] : null
  /* ROUND, NOT AN OVAL: one radius from the smaller of what the width and the height allow. Taking
     rx from the width and ry from the height drew whatever ellipse the rail produced, which
     mis-states the data — the same hop distance reads as longer sideways than vertically. */
  const R = Math.max(24, Math.min(width / 2 - 18, cy - 30))
  const rx = labels ? Math.min(52, width / 2 - 74) : R
  const ry = labels ? Math.max(24, Math.min(cy - 30, rx * 1.5)) : R
  const geo = useMemo(() => {
    const own = marks.filter((m) => !m.via), viaM = marks.filter((m) => !!m.via)
    const peers: Record<string, OrbitMark[]> = {}
    for (const ring of [['own', own], ['via', viaM]] as const) {
      for (const k of kinds) peers[ring[0] + '|' + k] = ring[1].filter((m) => m.rel.kind === k)
    }
    const pos: Record<string, { x: number; y: number }> = {}
    const wedge = orbitWedge(kinds.length)
    for (const m of marks) {
      const list = peers[(m.via ? 'via' : 'own') + '|' + m.rel.kind] || [m]
      const ki = kinds.indexOf(m.rel.kind)
      const j = list.indexOf(m)
      const span = wedge * M.spread
      const step = list.length > 1 ? span / (list.length - 1) : 0
      const a = (-90 + ki * wedge + wedge / 2 + (list.length > 1 ? -span / 2 + j * step : 0)) * Math.PI / 180
      const f = m.via ? 1 : M.inner
      pos[m.key] = { x: cx + Math.cos(a) * rx * f, y: cy + Math.sin(a) * ry * f }
    }
    return pos
  }, [marks, kinds, cx, cy, rx, ry])
  /* THE FADE LIFTS FOR WHICHEVER CONTROL SELECTED THE SET — the ring zone under the pointer (`hop`)
     or the host's own hop control (`hopSel`). The rule is about the set being READ, not about
     which control said so: washing the band while holding its nodes back at 0.55 has the region
     saying "read this" and the ink saying "not this". */
  const fade = (m: OrbitMark, on: boolean) => (m.via && !on && hop !== 'via' && hopSel !== 'via' ? M.viaFade : 1)
  const offHop = (m: OrbitMark) => hopSel && (hopSel === 'via') !== !!m.via
  const HOP_WASH = 'color-mix(in oklch, var(--accent-primary) 12%, transparent)'
  const rectRef = useRef<DOMRect | null>(null)
  useEffect(() => {
    const drop = () => { rectRef.current = null }
    window.addEventListener('scroll', drop, true); window.addEventListener('resize', drop)
    return () => { window.removeEventListener('scroll', drop, true); window.removeEventListener('resize', drop) }
  }, [])
  /* ONE POINTERMOVE OWNS BOTH READINGS, and that is a correctness fix rather than a saving. The
     ring zone used to be a transparent PATH sibling to the marks, so crossing onto a dot fired a
     leave on the path and an enter on the dot — the wash flickering off and back between them,
     twice per dot. Any element-based region has this defect, because the marks necessarily sit
     inside the region they belong to. Read from the pointer, leaving is a fact about the radius,
     and a mark is never ambiguous about its own ring — so when the pointer is over one, the answer
     comes from the MARK and the radius is not consulted. */
  const onMove = (ev: ReactPointerEvent<SVGSVGElement>) => {
    if (!rectRef.current) rectRef.current = ev.currentTarget.getBoundingClientRect()
    const b = rectRef.current
    const t = ev.target as Element | null
    const g = t && t.closest ? t.closest('[data-orbit]') : null
    const key = g ? g.getAttribute('data-orbit') : null
    if (key !== hotNow) onHot?.(key, ev)
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
    if (next !== (hop ?? null)) onHop(next)
  }
  /* NOTHING TO DRAW IS DRAWN AS NOTHING, and the two dashed rings are the reason this is not
     harmless. They are the HOP BANDS: drawn around a lone hub they label two regions that have no
     members, so the figure promises a neighbourhood and then shows an empty one — at 1:1 it reads
     as a figure still loading, not as a node with no relationships. A real corpus produces this (a
     published course that states no prerequisite and that nothing depends on); the hand-authored
     corpus guarantees it cannot, which is why it was never seen.
     THE EMPTINESS IS SAID ONCE, IN WORDS, BY `RelationStats` — the reading is the place a count of
     zero belongs. A lonely hub here plus that sentence would be two answers to one question.
     Every hook above this line runs unconditionally; the return is placed after the last one. */
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
    <svg data-relation-orbit="1" width={width} height={height} style={{ display: 'block' }} onPointerMove={onMove} onPointerLeave={() => { rectRef.current = null; onHot?.(null); onHop?.(null) }}>
      <g>
        {kind ? kinds.map((k, ki) => (k === kind ? wedgePath(k, ki) : null)) : null}
        {hopSel ? ringWash(hopSel) : (hop ? ringWash(hop) : null)}
        <ellipse cx={cx} cy={cy} rx={rx * M.inner} ry={ry * M.inner} fill="none" stroke="var(--border-hair)" strokeWidth="1" strokeDasharray="2 3" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={hop === 'via' ? 'var(--border-rule)' : 'var(--border-hair)'} strokeWidth="1" strokeDasharray="2 3" pointerEvents="none" />
        {/* THE RING NAMES ITSELF, FLAT AND INSIDE THE REGION IT NAMES. Floating above both rings
            left which word went with which radius an inference; a `textPath` attached them and
            visibly bent the letters, which reads as a defect before it reads as a label. Drawn as
            GROUND — uppercase, tracked, under the ink of the data, like a place name on a map —
            so a mark may pass over it and the word stays the name of the place. */}
        <text x={cx} y={cy - ry * M.inner * 0.52} textAnchor="middle" fontSize="9" letterSpacing="0.11em" pointerEvents="none" style={{ textTransform: 'uppercase' }}
          fill={(hopSel || hop) === 'own' ? 'var(--text-2)' : 'var(--text-3)'} opacity={(hopSel || hop) === 'own' ? 1 : 0.8}>direct</text>
        <text x={cx} y={cy - (ry * M.inner + ry) / 2} textAnchor="middle" fontSize="9" letterSpacing="0.11em" pointerEvents="none" style={{ textTransform: 'uppercase' }}
          fill={(hopSel || hop) === 'via' ? 'var(--text-2)' : 'var(--text-3)'} opacity={(hopSel || hop) === 'via' ? 1 : 0.8}>indirect</text>
      </g>
      {marks.map((m) => {
        const q = geo[m.key], on = hotId === m.rel.targetId
        const lineOn = on && (!hotKind || hotKind === m.rel.kind)
        const dim = (kind && m.rel.kind !== kind) || offHop(m)
        const op = (dim ? 0.08 : (hotId && !on ? 0.14 : (lineOn ? 1 : (on ? 0.75 : 0.5)))) * fade(m, on)
        return <line key={m.key} x1={cx} y1={cy} x2={q.x} y2={q.y} stroke={relationPaint(m.rel.kind).stroke} strokeWidth={lineOn ? 1.8 : 1} strokeOpacity={op} />
      })}
      {/* A LINE'S HIT TARGET IS NOT ITS INK, and it is cut to the band its own hop owns. A 1px
          stroke cannot be pointed at, so each relationship carries a transparent twin; but every
          line is drawn from the hub, so inside the inner ring the indirect twins cross the space
          the direct ones occupy and the topmost one won — in a figure whose whole claim is that
          radius IS the hop, the one answer it must never give. Direct twins are painted last so
          the shared boundary resolves inwards. */}
      {[...marks].sort((a, b) => (a.via ? 0 : 1) - (b.via ? 0 : 1)).map((m) => {
        const q = geo[m.key], s = m.via ? M.inner : 0
        return <line key={'hit' + m.key} data-orbit={m.key} x1={cx + (q.x - cx) * s} y1={cy + (q.y - cy) * s} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={M.hitLine} style={{ cursor: 'pointer' }} />
      })}
      {marks.map((m) => {
        const q = geo[m.key], on = hotId === m.rel.targetId
        const dim = (kind && m.rel.kind !== kind) || offHop(m)
        return (
          <g key={'n' + m.key} data-orbit={m.rel.targetId} data-orbit-lit={on ? 1 : 0} opacity={(dim ? 0.18 : (hotId && !on ? 0.3 : 1)) * fade(m, on)} style={{ cursor: 'pointer' }}>
            <circle cx={q.x} cy={q.y} r={M.hit} fill="transparent" />
            <circle cx={q.x} cy={q.y} r={on ? M.dotHot : M.dot} fill={topicPaint(m.rel.targetDomain).mark} />
            {labels ? <text x={q.x + 6} y={q.y + 3} fontSize="11" fill={on ? 'var(--text-1)' : 'var(--text-2)'} fontWeight={on ? 600 : 400}
              stroke="var(--surface-sunken)" strokeWidth="2.6" paintOrder="stroke">{m.rel.targetTitle}</text> : null}
          </g>
        )
      })}
      {/* THE HUB IS A MARK LIKE THE OTHERS: it is the topic the figure is about, so pointing at it
          previews that node rather than nothing. It belongs to no ring, so it clears the hop wash,
          and it dims nothing — whatever the host opens for it is about all of them. */}
      <g data-orbit={ORBIT_SELF} data-orbit-lit={hotNow === ORBIT_SELF ? 1 : 0} style={{ cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={13} fill="transparent" />
        <circle cx={cx} cy={cy} r={hotNow === ORBIT_SELF ? M.hub + 1 : M.hub} fill="var(--accent-primary)" />
      </g>
    </svg>
  )
}
