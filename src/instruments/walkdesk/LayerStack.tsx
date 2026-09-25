// The isometric layer stack (round 5's "magical component"), restored in
// round 7b on the user's verdict. One rotated plane PER OPEN COLUMN, so the
// drill-path is visible as depth; picking a diamond here opens the same
// column the ⊞ box opens below — both sides render one controlled
// stops/path/pick triple (the round-5 inversion), so they cannot disagree.
// It reads the RESOLVED road like every presentation view: forks never
// reach it, skipped optionals are already gone.

import { byId } from '../../corpus/graph'
import { DomainDot, wrapTip } from '@/ds'
import { topicHueOf } from '../../corpus/graph'
import { columnsFor } from './columns'
import { isBox, isLeaf } from '../../state/walk/mockwalk'
import type { Stop } from '../../state/walk/mockwalk'
import type { HoverBinding } from '../../state/bus'

const PLANE_STEP = 92
const PLANE_TOP = 44
const PLANE_W = 250
const PLANE_H = 122
const TWIST = 42 // deg of rotateZ — how far the plane's corners swing sideways
const LABEL_GUTTER = 84 // the "tier n · k" chips live to the left of the planes

// A ROTATED box is wider than its CSS width: spin a PLANE_W × PLANE_H rect by
// TWIST and its horizontal reach becomes (w/2)·cos + (h/2)·sin about the centre
// — ~134px here, not 125. Placing the plane by its CSS left is what sheared the
// right corner off in review 4; every horizontal number below is derived from
// the real footprint instead, so the stack fits its window by construction.
const rad = (d: number) => (d * Math.PI) / 180
const HALF_SPAN = (PLANE_W / 2) * Math.cos(rad(TWIST)) + (PLANE_H / 2) * Math.sin(rad(TWIST))
const PLANE_LEFT = LABEL_GUTTER + HALF_SPAN - PLANE_W / 2
const STACK_W = PLANE_LEFT + PLANE_W / 2 + HALF_SPAN + 6
/** the stops' spread across a plane, leaving room for the last dot */
const DOT_SPAN = PLANE_W - 60

export default function LayerStack({
  stops,
  path,
  pick,
  sync,
}: {
  stops: Stop[]
  path: string[]
  pick(col: number, s: Stop): void
  sync: HoverBinding
}) {
  const cols = columnsFor(stops, path)
  const height = PLANE_TOP + cols.length * PLANE_STEP + 96

  return (
    // no background or bottom rule of its own — since review 4 the stack owns a
    // whole vertical window, and the planes just grow down into it as you drill.
    // It states its own WIDTH and does not clip: if the window is ever narrower
    // than STACK_W the pane scrolls, rather than shearing a plane's corner off.
    <div className="shrink-0 relative" style={{ height, width: STACK_W }}>
      <div className="absolute left-3 top-2 text-[10px] font-bold text-slate-500">
        layer stack — one plane per open column; pick on either side, both follow
      </div>
      {cols.map((line, t) => {
        const spacing = line.stops.length > 1 ? DOT_SPAN / (line.stops.length - 1) : 0
        return (
          <div key={`${t}-${line.source}`}>
            <div
              className="absolute left-3 text-left text-[10px] rounded px-1.5 py-0.5 border border-slate-200 bg-white text-slate-500"
              style={{ top: 74 + t * PLANE_STEP }}
              data-plane-label={t}
            >
              tier {t} · {line.stops.length}
            </div>
            <div
              data-plane={t}
              className="absolute rounded-lg border-2 border-slate-300 bg-white/70"
              style={{
                left: PLANE_LEFT,
                top: PLANE_TOP + t * PLANE_STEP,
                width: PLANE_W,
                height: PLANE_H,
                transform: `rotateX(56deg) rotateZ(-${TWIST}deg)`,
              }}
            >
              <div className="absolute left-[20px] right-[22px] top-[57px] h-0.5 bg-amber-300/70 rounded" />
              {line.stops.map((s, i) => {
                const left = 18 + i * spacing
                // presentation reads the RESOLVED road: every container is a
                // one-variant box (a diamond you can drill), the rest are leaves
                if (isBox(s)) {
                  const picked = path[t] === s.key
                  return (
                    <button
                      key={s.key}
                      data-pick-stack={s.key}
                      onClick={() => pick(t, s)}
                      title={wrapTip(s.title)}
                      className={['absolute w-3.5 h-3.5 border-2 rotate-45', picked ? 'bg-amber-400 border-amber-600 ring-2 ring-amber-300 scale-125' : 'bg-amber-200 border-amber-500 hover:scale-125'].join(' ')}
                      style={{ left, top: 50 }}
                    />
                  )
                }
                if (!isLeaf(s)) return null
                return (
                  <button
                    key={`${i}-${s.node}`}
                    {...sync.bind(s.node)}
                    onClick={() => pick(t, s)}
                    title={wrapTip(byId.get(s.node)!.title)}
                    className={['absolute grid place-items-center', sync.lit(s.node) ? 'ring-2 ring-sky-400 rounded-full scale-150' : ''].join(' ')}
                    style={{ left, top: 51 }}
                  >
                    {/* #97: was a 12px button whose own `border-2 border-white`
                        made the paper halo by eating 4px of the dot. DomainDot
                        draws that halo OUTSIDE as a box-shadow ring, so an 8px
                        dot + 2px ring comes to the same 12px — same footprint on
                        the plane, one less place that knows how a domain looks. */}
                    <DomainDot topic={topicHueOf(s.node)} size={8} ring />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
