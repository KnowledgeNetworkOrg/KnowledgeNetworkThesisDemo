// Neighborhood — the current node's local neighborhood as a small radial
// diagram (named PlexPanel.tsx until 2026-08-20; "Plex" named nothing),
// embedded in the Knowledge panel. Containment is vertical (parent above,
// children below — the tree's own axis, just point-sized here) and, for
// leaves, typed links fan out left/right: incoming on the left, outgoing on
// the right, each edge type on its own ring so same-type neighbors read as a
// group by radius AND color, not just by list order. DocumentPanel pairs
// this with a regrouped text list right below it — the diagram carries
// shape (how many, which type, in vs. out) at a glance; the list carries
// names. Neither replaces the other, matching what a flat Jira-style link
// list couldn't do on its own.

import { byId, childrenOf, domainOf, EDGE_COLOR, ROOT_ID } from '../corpus/graph'
import { colorOf } from '../model/color'
import { edgesTouching } from '../model/flat'
import { EDGE_TYPES } from '../model/nav'
import type { Bus } from '../state/bus'

const CX = 320
const CY = 150
const R_CENTER = 22
const R_PARENT = 14
const R_CHILD = 13
const R_NEIGHBOR = 9
const AXIS_DIST = 108
const RING_BASE = 66
const RING_GAP = 38
const ARC_HALF = 58 // degrees either side of due right (out) / due left (in)

/** Evenly spread `count` items across [base-ARC_HALF, base+ARC_HALF]; a lone
 * item sits at the arc's center. Zero items yields zero positions — callers
 * zip this 1:1 against their own id array, so a phantom position here would
 * read past the end of that array. */
function ringAngles(count: number, baseDeg: number): number[] {
  if (count === 0) return []
  if (count === 1) return [baseDeg]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(baseDeg - ARC_HALF + (2 * ARC_HALF * i) / (count - 1))
  return out
}

const toXY = (angleDeg: number, r: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r }
}

const childX = (i: number, count: number) => {
  if (count === 1) return CX
  const span = Math.min(420, count * 60)
  return CX - span / 2 + (span * i) / (count - 1)
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** the slice of the bus the neighborhood diagram reads and writes */
type NeighborhoodPanelBus = Pick<Bus, 'focus' | 'setFocus'>

export default function NeighborhoodPanel({ bus }: { bus: NeighborhoodPanelBus }) {
  const currentId = bus.focus ?? ROOT_ID
  // two writers, two vias: stepping into a child is tree movement; crossing a
  // typed road is a JUMP, and the trail chip says so
  const onSelect = (id: string) => bus.setFocus(id, 'tree')
  const onJump = (id: string) => bus.setFocus(id, 'link', true)

  const n = byId.get(currentId)!
  const parentId = n.parentId
  const kids = n.kind === 'container' ? (childrenOf.get(currentId) ?? []) : []
  const roads = n.topic ? edgesTouching(currentId) : []
  const outgoing = roads.filter((e) => e.source === currentId)
  const incoming = roads.filter((e) => e.target === currentId)

  return (
    <div aria-label="neighborhood-panel" className="px-2 py-1">
      <svg viewBox="0 0 640 300" className="w-full h-[260px]">
        <defs>
          {EDGE_TYPES.map((type) => (
            <marker key={type} id={`plex-arrow-${type}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLOR[type]} />
            </marker>
          ))}
        </defs>

        {/* containment axis: parent above, children below — dashed + neutral,
            deliberately not one of the four edge colors */}
        {parentId && (
          <line x1={CX} y1={CY - R_CENTER} x2={CX} y2={CY - AXIS_DIST + R_PARENT} stroke="#cbd5e1" strokeWidth={1.6} strokeDasharray="3 3" />
        )}
        {kids.map((k, i) => (
          <line
            key={`kl-${k.id}`}
            x1={CX}
            y1={CY + R_CENTER}
            x2={childX(i, kids.length)}
            y2={CY + AXIS_DIST - R_CHILD}
            stroke="#cbd5e1"
            strokeWidth={1.6}
            strokeDasharray="3 3"
          />
        ))}

        {/* typed links, one ring per type: outgoing right (arrow at the
            neighbor end), incoming left (arrow at the center end — the line
            is drawn FROM the neighbor TO center so marker-end lands there) */}
        {EDGE_TYPES.map((type, ti) => {
          const r = RING_BASE + ti * RING_GAP
          const outs = outgoing.filter((e) => e.type === type).map((e) => e.target)
          const ins = incoming.filter((e) => e.type === type).map((e) => e.source)
          return (
            <g key={`links-${type}`}>
              {ringAngles(outs.length, 0).map((ang, i) => {
                const p = toXY(ang, r)
                return (
                  <line
                    key={`o-${i}`}
                    x1={CX}
                    y1={CY}
                    x2={p.x}
                    y2={p.y}
                    stroke={EDGE_COLOR[type]}
                    strokeWidth={1.6}
                    opacity={0.75}
                    markerEnd={`url(#plex-arrow-${type})`}
                  />
                )
              })}
              {ringAngles(ins.length, 180).map((ang, i) => {
                const p = toXY(ang, r)
                return (
                  <line
                    key={`i-${i}`}
                    x1={p.x}
                    y1={p.y}
                    x2={CX}
                    y2={CY}
                    stroke={EDGE_COLOR[type]}
                    strokeWidth={1.6}
                    opacity={0.75}
                    markerEnd={`url(#plex-arrow-${type})`}
                  />
                )
              })}
            </g>
          )
        })}

        {/* neighbor nodes on top of their lines — domain-colored to match
            Map/Tree; hover reveals the name via native <title>, click JUMPs */}
        {EDGE_TYPES.map((type, ti) => {
          const r = RING_BASE + ti * RING_GAP
          const outs = outgoing.filter((e) => e.type === type).map((e) => e.target)
          const ins = incoming.filter((e) => e.type === type).map((e) => e.source)
          return (
            <g key={`nodes-${type}`}>
              {ringAngles(outs.length, 0).map((ang, i) => {
                const id = outs[i]
                const p = toXY(ang, r)
                return (
                  <circle
                    key={`no-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={R_NEIGHBOR}
                    fill={colorOf(domainOf(id))}
                    stroke="#fff"
                    strokeWidth={1.2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onJump(id)}
                  >
                    <title>{byId.get(id)!.title}</title>
                  </circle>
                )
              })}
              {ringAngles(ins.length, 180).map((ang, i) => {
                const id = ins[i]
                const p = toXY(ang, r)
                return (
                  <circle
                    key={`ni-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={R_NEIGHBOR}
                    fill={colorOf(domainOf(id))}
                    stroke="#fff"
                    strokeWidth={1.2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onJump(id)}
                  >
                    <title>{byId.get(id)!.title}</title>
                  </circle>
                )
              })}
            </g>
          )
        })}

        {/* parent + children — small counts (≤ 5 in this corpus), safe to
            label directly rather than relying on a title-only hover */}
        {parentId && (
          <g style={{ cursor: 'pointer' }} onClick={() => onSelect(parentId)}>
            <circle cx={CX} cy={CY - AXIS_DIST} r={R_PARENT} fill={colorOf(domainOf(parentId))} stroke="#fff" strokeWidth={1.4} />
            <text x={CX} y={CY - AXIS_DIST - R_PARENT - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#475569">
              {byId.get(parentId)!.title}
            </text>
          </g>
        )}
        {kids.map((k, i) => {
          const x = childX(i, kids.length)
          const y = CY + AXIS_DIST
          return (
            <g key={k.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(k.id)}>
              <circle cx={x} cy={y} r={R_CHILD} fill={colorOf(domainOf(k.id))} stroke="#fff" strokeWidth={1.4} />
              <text x={x} y={y + R_CHILD + 12} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#475569">
                {truncate(k.title, 14)}
              </text>
            </g>
          )
        })}

        {/* center — the current node. Label sits below like every other node
            in this diagram (not inside): an inside label wider than the
            circle would overflow onto the page in white-on-white, invisible
            past the fill's edge — caught by looking at the render, not just
            the types. */}
        <circle cx={CX} cy={CY} r={R_CENTER} fill={colorOf(domainOf(currentId))} stroke="#fff" strokeWidth={2} />
        <text x={CX} y={CY + R_CENTER + 14} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1e293b">
          {truncate(n.title, 16)}
        </text>
      </svg>

      {n.kind === 'container' && (
        <div className="text-center text-[10px] text-slate-400 italic -mt-1 mb-1">typed links connect topics only — this node shows containment</div>
      )}
    </div>
  )
}
