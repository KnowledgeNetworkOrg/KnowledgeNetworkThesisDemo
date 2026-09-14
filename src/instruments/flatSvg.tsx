// Shared SVG pieces for the flat paper views (GMap / Contours / ZMLT):
// arrowhead defs, the node dot + label, hover-traced REAL edges, and the
// all-edges hairball layer (kept available as a toggle on purpose —
// seeing it is the argument for hiding it, ComfyUI's "hide links" precedent).

import { edges, EDGE_COLOR, byId, domainOf } from '../corpus/graph'
import { colorOf } from '../model/color'
import { leafPos, HUB_IDS, edgesTouching } from '../model/flat'

export function EdgeMarkers() {
  return (
    <defs>
      {Object.entries(EDGE_COLOR).map(([t, c]) => (
        <marker key={t} id={`arr-${t}`} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,0.5 L7.5,4 L0,7.5 Z" fill={c} />
        </marker>
      ))}
    </defs>
  )
}

/** straight segment trimmed at both ends so arrowheads sit outside the dots */
function trimmed(a: { x: number; y: number }, b: { x: number; y: number }, pad: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.max(0.01, Math.hypot(dx, dy))
  const f = pad / d
  return { x1: a.x + dx * f, y1: a.y + dy * f, x2: b.x - dx * f, y2: b.y - dy * f }
}

/** The traced node's REAL edges — direction, type color, arrowheads. */
export function HoverEdges({ traced, visible, scale = 1 }: { traced: string | null; visible?: Set<string>; scale?: number }) {
  if (!traced) return null
  const own = edgesTouching(traced).filter(
    (e) => !visible || (visible.has(e.source) && visible.has(e.target)),
  )
  return (
    <g>
      {own.map((e) => {
        const seg = trimmed(leafPos[e.source], leafPos[e.target], 12 / scale)
        return (
          <line
            key={e.id}
            {...seg}
            stroke={EDGE_COLOR[e.type]}
            strokeWidth={1.8 / scale}
            markerEnd={`url(#arr-${e.type})`}
            opacity={0.95}
          />
        )
      })}
    </g>
  )
}

/** All raw edges, faint — the hairball the papers are trying to avoid. */
export function AllEdges({ visible }: { visible?: Set<string> }) {
  return (
    <g opacity={0.3}>
      {edges.map((e) => {
        if (visible && !(visible.has(e.source) && visible.has(e.target))) return null
        const seg = trimmed(leafPos[e.source], leafPos[e.target], 10)
        return <line key={e.id} {...seg} stroke={EDGE_COLOR[e.type]} strokeWidth={0.8} />
      })}
    </g>
  )
}

export interface DotProps {
  id: string
  r?: number
  fill?: string
  muted?: boolean
  hi?: boolean
  scale?: number
  labelSize?: number
  onEnter?: (id: string) => void
  onLeave?: () => void
  onClick?: (id: string) => void
}

/** One leaf: dot colored by domain (or override), label to the right, hub ring. */
export function LeafDot({ id, r = 7, fill, muted, hi, scale = 1, labelSize = 10, onEnter, onLeave, onClick }: DotProps) {
  const p = leafPos[id]
  const color = fill ?? colorOf(domainOf(id))
  const isHub = HUB_IDS.includes(id)
  return (
    <g
      opacity={muted ? 0.3 : 1}
      style={{ cursor: 'pointer', transition: 'opacity 160ms ease' }}
      onMouseEnter={() => onEnter?.(id)}
      onMouseLeave={() => onLeave?.()}
      onClick={(ev) => {
        ev.stopPropagation()
        onClick?.(id)
      }}
    >
      {isHub && <circle cx={p.x} cy={p.y} r={(r + 4.5) / scale} fill="none" stroke={color} strokeWidth={1.4 / scale} opacity={0.7} />}
      <circle
        cx={p.x}
        cy={p.y}
        r={r / scale}
        fill={color}
        stroke={hi ? '#f59e0b' : '#ffffff'}
        strokeWidth={(hi ? 2.4 : 1.2) / scale}
      />
      <text
        x={p.x + (r + 4) / scale}
        y={p.y + 3.2 / scale}
        fontSize={labelSize / scale}
        fontWeight={isHub || hi ? 700 : 500}
        fill="#334155"
        style={{ userSelect: 'none' }}
      >
        {byId.get(id)!.title}
      </text>
    </g>
  )
}
