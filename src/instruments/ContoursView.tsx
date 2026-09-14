// Experiment F — soft group contours (Bubble Sets 2009 / KelpFusion 2013):
// the anti-tessellation. The layout is EXACTLY the one E uses and is never
// moved ("spatial rights" — the primary layout owns the plane); groups are
// drawn OVER it as translucent kelp shapes: a Euclidean spanning tree of the
// group's members rendered as thick rounded strokes plus a disc per member —
// KelpFusion's spanning-graph end of its hull↔line spectrum. Shapes may
// overlap and interleave; nothing is forced to claim territory it doesn't
// have, which is precisely where E's hard countries struggle (hubs).

import { useMemo, useState } from 'react'

import { PaneCanvas } from '@/ds'
import { byId, domainOf, domainIds, edges, topicsUnder } from '../corpus/graph'
import { colorOf } from '../model/color'
import {
  FLAT_W,
  FLAT_H,
  communities,
  communityColor,
  communityLabel,
  domainPurity,
  hubBridging,
  leafPos,
  spreadLabels,
  edgesTouching,
} from '../model/flat'
import { AllEdges, EdgeMarkers, HoverEdges, LeafDot } from './flatSvg'

interface Group {
  label: string
  color: string
  members: string[]
}

/** Euclidean minimum spanning tree of the group's members (Prim, tiny n). */
function emst(members: string[]): [string, string][] {
  if (members.length < 2) return []
  const inTree = new Set<string>([members[0]])
  const out: [string, string][] = []
  while (inTree.size < members.length) {
    let best: { a: string; b: string; d: number } | null = null
    for (const a of inTree) {
      for (const b of members) {
        if (inTree.has(b)) continue
        const d = Math.hypot(leafPos[a].x - leafPos[b].x, leafPos[a].y - leafPos[b].y)
        if (!best || d < best.d) best = { a, b, d }
      }
    }
    inTree.add(best!.b)
    out.push([best!.a, best!.b])
  }
  return out
}

const domainGroups: Group[] = domainIds.map((d) => ({
  label: byId.get(d)!.title,
  color: colorOf(d),
  members: topicsUnder(d),
}))
const communityGroups: Group[] = communities.map((members, ci) => ({
  label: communityLabel[ci],
  color: communityColor[ci],
  members,
}))

export default function ContoursView() {
  const [groupBy, setGroupBy] = useState<'communities' | 'domains'>('communities')
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [hairball, setHairball] = useState(false)
  const traced = hovered ?? pinned

  const groups = groupBy === 'domains' ? domainGroups : communityGroups
  const kelps = useMemo(() => groups.map((g) => ({ ...g, tree: emst(g.members) })), [groups])

  const tracedNeighbors = useMemo(() => {
    if (!traced) return null
    const s = new Set<string>([traced])
    for (const e of edgesTouching(traced)) {
      s.add(e.source)
      s.add(e.target)
    }
    return s
  }, [traced])

  const hubNote =
    traced && hubBridging.has(traced)
      ? `${byId.get(traced)!.title} bridges ${hubBridging.get(traced)} communities — here other groups' shapes simply flow past it instead of claiming it.`
      : null

  return (
    <PaneCanvas>
      <svg viewBox={`-40 -40 ${FLAT_W + 80} ${FLAT_H + 80}`} className="w-full h-full" onClick={() => setPinned(null)}>
        <EdgeMarkers />

        {/* kelp shapes: whole group painted inside ONE group opacity so
            overlapping strokes within a group don't double-darken */}
        {kelps.map((g) => (
          <g key={g.label} opacity={0.2} pointerEvents="none">
            {g.tree.map(([a, b]) => (
              <line
                key={`${a}|${b}`}
                x1={leafPos[a].x}
                y1={leafPos[a].y}
                x2={leafPos[b].x}
                y2={leafPos[b].y}
                stroke={g.color}
                strokeWidth={52}
                strokeLinecap="round"
              />
            ))}
            {g.members.map((id) => (
              <circle key={id} cx={leafPos[id].x} cy={leafPos[id].y} r={27} fill={g.color} />
            ))}
          </g>
        ))}

        {/* group labels at the member centroid, nudged apart if they collide */}
        <g pointerEvents="none">
          {spreadLabels(
            kelps.map((g) => ({
              label: g.label,
              color: g.color,
              x: g.members.reduce((s, id) => s + leafPos[id].x, 0) / g.members.length,
              y: g.members.reduce((s, id) => s + leafPos[id].y, 0) / g.members.length,
            })),
          ).map((g) => (
            <text key={g.label} x={g.x} y={g.y} textAnchor="middle" fontSize={26} fontWeight={800} fill={g.color} opacity={0.35} style={{ userSelect: 'none' }}>
              {g.label}
            </text>
          ))}
        </g>

        {hairball && <AllEdges />}
        <HoverEdges traced={traced} />

        <g>
          {Object.keys(leafPos).map((id) => (
            <LeafDot
              key={id}
              id={id}
              muted={!!tracedNeighbors && !tracedNeighbors.has(id)}
              hi={id === traced}
              onEnter={setHovered}
              onLeave={() => setHovered(null)}
              onClick={(n) => setPinned((prev) => (prev === n ? null : n))}
            />
          ))}
        </g>
      </svg>

      <div className="absolute top-3 left-3 z-10 rounded-lg bg-white/95 border border-slate-200 shadow-sm px-3 py-2 text-[11px] text-slate-600 max-w-[560px]">
        <div className="font-bold text-slate-800 text-[12px]">Bubble Sets '09 / KelpFusion '13 — soft contours over a fixed layout</div>
        <div className="mt-0.5">
          Same positions as E, but groups are overlays, not territory: shapes may interleave and overlap, the layout is never moved.
          Flip the group source to see detection vs authorship disagree ({(domainPurity * 100).toFixed(0)}% overlap).
        </div>
        {hubNote ? (
          <div className="mt-1 text-amber-700 font-medium">{hubNote}</div>
        ) : (
          <div className="mt-1 text-slate-400">hover a node for its real links · click to pin</div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg bg-white/95 border border-slate-200 shadow-sm px-3 py-1.5 text-[11px] text-slate-600">
        <span className="text-slate-400">group shapes from</span>
        <div className="flex rounded border border-slate-300 overflow-hidden">
          {(['communities', 'domains'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setGroupBy(m)}
              className={`px-2 py-0.5 ${groupBy === m ? 'bg-slate-700 text-white font-semibold' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {m === 'communities' ? 'detected communities' : 'authored domains'}
            </button>
          ))}
        </div>
        <span className="w-px h-4 bg-slate-200" />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={hairball} onChange={(ev) => setHairball(ev.target.checked)} />
          all {edges.length} edges
        </label>
        {traced && (
          <>
            <span className="w-px h-4 bg-slate-200" />
            <span className="font-semibold" style={{ color: colorOf(domainOf(traced)) }}>
              {byId.get(traced)!.title}
            </span>
            <span className="text-slate-400">{edgesTouching(traced).length} links</span>
          </>
        )}
      </div>
    </PaneCanvas>
  )
}
