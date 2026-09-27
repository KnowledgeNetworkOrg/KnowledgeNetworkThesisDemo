// THE MAP'S #24 DRAG GHOST (#399 cut 2) — the cell you are carrying to the road,
// moved out of MapView whole. A portal to <body> so it floats above every pane
// regardless of their overflow; the gesture that feeds it is `useNodeDrag`
// (nodedrag.ts).

import { createPortal } from 'react-dom'

import { byId } from '../../corpus/graph'
import { outlineOf } from '../../model/atlas'
import { colorOf } from '../../model/color'
import type { Ghost } from './nodedrag'

export interface DragGhostProps {
  ghost: Ghost
}

export function DragGhost({ ghost }: DragGhostProps) {
  return (
    <>
      {/* ── #24 THE DRAG GHOST — the cell you are carrying to the road ────────
          A portal to <body> so it floats above every pane regardless of their
          overflow. Two layers crossfade on the `outside` flag: the cell's own
          OUTLINE (drawn from outlineOf in the same user space getBBox reports,
          so any size works) while the pointer is over the map, and a NODE PILL
          once it leaves — the "shape becomes a node" morph. pointer-events:none
          so it never blocks elementFromPoint at the drop. */}
      {createPortal(
        <div
          data-dragghost={ghost.id}
          style={{
            position: 'fixed',
            left: ghost.x,
            top: ghost.y,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${ghost.outside ? 0.55 : 1})`,
              opacity: ghost.outside ? 0 : 1,
              transition: 'opacity 180ms ease, transform 180ms ease',
            }}
          >
            <svg
              width={78}
              height={78}
              viewBox={`${ghost.bbox.x} ${ghost.bbox.y} ${ghost.bbox.width} ${ghost.bbox.height}`}
              style={{ overflow: 'visible', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }}
            >
              <path
                d={outlineOf(ghost.id)}
                fill={colorOf(ghost.id)}
                fillOpacity={0.85}
                stroke="#ffffff"
                strokeWidth={Math.max(ghost.bbox.width, ghost.bbox.height) / 32}
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${ghost.outside ? 1 : 0.55})`,
              opacity: ghost.outside ? 1 : 0,
              transition: 'opacity 180ms ease, transform 180ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 9999,
              background: '#ffffff',
              border: `2px solid ${colorOf(ghost.id)}`,
              color: colorOf(ghost.id),
              fontSize: 10.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: colorOf(ghost.id), flexShrink: 0 }} />
            {byId.get(ghost.id)!.title}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
