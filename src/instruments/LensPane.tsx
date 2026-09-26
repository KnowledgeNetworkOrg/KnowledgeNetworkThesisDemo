// Lens — a stateless directed-cone reading of one relation TYPE, always
// centered on the shared bus focus: everything the focused leaf points AT
// through `type` on one side, everything that points AT it on the other.
// lens.ts does the graph work (BFS cones, title-sorted, frontier counts);
// this file only lays the two cones out as chips + arrows and turns a chip
// click back into a focus write. One copy of this component exists per
// relation type, so several can be picked at once to read the same focused
// leaf through several relations side by side.
//
// Layout differs by type because the RELATION shape differs: depends_on
// reads as build layers (prerequisites above, dependents below); uses
// reads as a pipeline (used-by left, uses right); see_also reads as a fan
// (no natural up/down or left/right, so it's a ring). A node that appears on
// BOTH sides (a cycle) gets two independent chips, one per side's own
// position map — drawing its two roles separately is the point: it visibly
// shows the cycle instead of hiding it behind a single dot.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { LEGEND_INSET } from '@/ds'

import { byId, domainOf, EDGE_COLOR, EDGE_LABEL } from '../corpus/graph'
import { colorOf } from '../model/color'
import type { EdgeType } from '../corpus/graph'
import { lensModel } from '../model/lens'
import type { ConeSide, LensModel } from '../model/lens'
import type { Bus } from '../state/bus'

/** the slice of the bus a lens reads and writes */
export type LensPaneBus = Pick<Bus, 'focus' | 'setFocus'>

export interface LensPaneProps {
  bus: LensPaneBus
  /** which relation this lens is about — CONFIG, not bus state. It is what makes
   * one component into four panes, and it is why the registry can generate a
   * lens per edge type instead of anyone hand-writing them. */
  type: EdgeType
}

type Orientation = 'vertical' | 'horizontal' | 'fan'
type Side = 'out' | 'in'
type Pt = { x: number; y: number }

interface LensConfig {
  orientation: Orientation
  outLabel: string
  inLabel: string
}

// depends_on: build layers (what it builds on above, what builds on it below)
// uses: pipeline (what uses it left, what it uses right)
// see_also / implemented_with: no natural axis — a fan
const LENS_CONFIG: Record<EdgeType, LensConfig> = {
  depends_on: { orientation: 'vertical', outLabel: 'builds on', inLabel: 'built on by' },
  uses: { orientation: 'horizontal', outLabel: 'uses', inLabel: 'used by' },
  see_also: { orientation: 'fan', outLabel: 'see also', inLabel: 'noted by' },
  implemented_with: { orientation: 'fan', outLabel: 'implemented with', inLabel: 'underpins' },
}

const DEFAULT_DEPTH: Record<EdgeType, 1 | 2> = { depends_on: 2, uses: 2, see_also: 1, implemented_with: 1 }

const CHIP_W = 150
const CHIP_H = 30
const HALF_W = CHIP_W / 2
const HALF_H = CHIP_H / 2
const PAD = 44
const V_PITCH_X = 170 // spread within a vertical-layout level
const V_PITCH_Y = 90 // spread between vertical-layout levels
const H_PITCH_Y = 46 // spread within a horizontal-layout level
const H_PITCH_X = 190 // spread between horizontal-layout levels
const FAN_MIN_R = 150
const FAN_RING_STEP = 100
// degrees, 0 = +x (right); out sits on the right arc, in on the left
const FAN_ARC: Record<Side, { start: number; end: number }> = { out: { start: -70, end: 70 }, in: { start: 110, end: 250 } }

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** Where a ray from a rectangle's center toward (dx,dy) exits the rectangle —
 * an exact box clip, so an arrowhead lands on the chip's edge, never inside
 * it (UnfoldGraphView.tsx's shortenToEdge does the same job for circles). */
function rectExit(cx: number, cy: number, dx: number, dy: number): Pt {
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = Math.min(dx !== 0 ? HALF_W / Math.abs(dx) : Infinity, dy !== 0 ? HALF_H / Math.abs(dy) : Infinity)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

function shortenToEdge(from: Pt, to: Pt) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const p1 = rectExit(from.x, from.y, dx, dy)
  const p2 = rectExit(to.x, to.y, -dx, -dy)
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
}

/** Local-space (focus at 0,0) chip positions for one side's cone levels. */
function placeSide(orientation: Orientation, side: Side, levels: string[][]): Map<string, Pt> {
  const pos = new Map<string, Pt>()
  if (orientation === 'vertical') {
    const dir = side === 'out' ? -1 : 1 // out stacks above focus, in below
    levels.forEach((level, li) => {
      const y = dir * (li + 1) * V_PITCH_Y
      level.forEach((id, i) => pos.set(id, { x: (i - (level.length - 1) / 2) * V_PITCH_X, y }))
    })
  } else if (orientation === 'horizontal') {
    const dir = side === 'out' ? 1 : -1 // out to the right, in to the left
    levels.forEach((level, li) => {
      const x = dir * (li + 1) * H_PITCH_X
      level.forEach((id, i) => pos.set(id, { x, y: (i - (level.length - 1) / 2) * H_PITCH_Y }))
    })
  } else {
    const arc = FAN_ARC[side]
    levels.forEach((level, li) => {
      const radius = Math.max(FAN_MIN_R + li * FAN_RING_STEP, level.length * 40)
      level.forEach((id, i) => {
        const t = level.length === 1 ? 0.5 : i / (level.length - 1)
        const angle = ((arc.start + t * (arc.end - arc.start)) * Math.PI) / 180
        pos.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
      })
    })
  }
  return pos
}

/** Frontier badge position: just beyond its chip, away from the focus. */
function frontierOffset(orientation: Orientation, side: Side, p: Pt): Pt {
  if (orientation === 'vertical') return { x: p.x, y: p.y + (side === 'out' ? -22 : 22) }
  if (orientation === 'horizontal') return { x: p.x + (side === 'out' ? 92 : -92), y: p.y }
  const len = Math.hypot(p.x, p.y) || 1
  return { x: p.x + (p.x / len) * 90, y: p.y + (p.y / len) * 90 }
}

interface FrontierBadge {
  id: string
  side: Side
  n: number
  at: Pt
}

interface Scene {
  outPos: Map<string, Pt>
  inPos: Map<string, Pt>
  frontier: FrontierBadge[]
  width: number
  height: number
  offsetX: number
  offsetY: number
}

function buildScene(model: LensModel, orientation: Orientation): Scene {
  const outPos = placeSide(orientation, 'out', model.out.levels)
  const inPos = placeSide(orientation, 'in', model.in.levels)
  outPos.set(model.focus, { x: 0, y: 0 })
  inPos.set(model.focus, { x: 0, y: 0 })

  const frontier: FrontierBadge[] = []
  const addFrontier = (side: Side, cone: ConeSide, posMap: Map<string, Pt>) => {
    const deepest = cone.levels[cone.levels.length - 1] ?? []
    for (const id of deepest) {
      const n = cone.frontier[id]
      if (n) frontier.push({ id, side, n, at: frontierOffset(orientation, side, posMap.get(id)!) })
    }
  }
  addFrontier('out', model.out, outPos)
  addFrontier('in', model.in, inPos)

  const pts = [...outPos.values(), ...inPos.values(), ...frontier.map((f) => f.at)]
  const minX = Math.min(0, ...pts.map((p) => p.x)) - HALF_W - PAD
  const maxX = Math.max(0, ...pts.map((p) => p.x)) + HALF_W + PAD
  const minY = Math.min(0, ...pts.map((p) => p.y)) - HALF_H - PAD
  const maxY = Math.max(0, ...pts.map((p) => p.y)) + HALF_H + PAD

  return { outPos, inPos, frontier, width: maxX - minX, height: maxY - minY, offsetX: -minX, offsetY: -minY }
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-[11px] text-[var(--text-2)] text-center px-6">{text}</div>
}

export default function LensPane({ bus, type }: LensPaneProps) {
  const focus = bus.focus
  // a lens click is a JUMP: it crosses a typed edge rather than walking the tree
  const onFocus = (id: string) => bus.setFocus(id, 'link', true)

  const [depth, setDepth] = useState<1 | 2>(DEFAULT_DEPTH[type])

  const model = useMemo(
    () => (focus && byId.get(focus)?.topic ? lensModel(focus, type, depth) : null),
    [focus, type, depth],
  )
  const config = LENS_CONFIG[type]
  // `config` is a stable reference from a module-level Record, so it only
  // changes identity when `type` does — safe as the sole extra dependency.
  const scene = useMemo(() => (model ? buildScene(model, config.orientation) : null), [model, config])

  // Center the FOCUS chip in the viewport: the pane opens at scroll (0,0),
  // which for wide models (e.g. uses' horizontal pipeline) leaves the
  // focus chip off-screen. Stateless lens, no scroll continuity to preserve,
  // so an instant jump on every recenter (new focus/type/depth) is correct.
  //
  // Studio benches instruments with an ANCESTOR display:none rather than
  // unmounting them, so a pane recentered while benched has clientWidth 0 —
  // scrollTo silently clamps to 0 and the centering is lost, not just
  // deferred. sceneRef keeps the latest scene readable from a plain
  // (non-reactive) callback, and a ResizeObserver re-centers the moment the
  // pane actually gets a layout box again (display:none -> flex on preset
  // switch), on top of the normal recenter when focus/type/depth changes
  // while already visible.
  const scrollRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(scene)
  useEffect(() => {
    sceneRef.current = scene
  })

  const centerOnFocus = useCallback(() => {
    const el = scrollRef.current
    const sc = sceneRef.current
    if (!el || !sc) return
    if (el.clientWidth === 0 && el.clientHeight === 0) return // still benched — nothing to center yet
    el.scrollTo({
      left: Math.max(0, sc.offsetX - el.clientWidth / 2),
      top: Math.max(0, sc.offsetY - el.clientHeight / 2),
      behavior: 'auto',
    })
  }, [])

  useEffect(() => {
    centerOnFocus()
  }, [scene, centerOnFocus])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => centerOnFocus())
    ro.observe(el)
    return () => ro.disconnect()
  }, [centerOnFocus])

  const markerId = `lens-arrow-${type}`
  const toSvg = (p: Pt): Pt => (scene ? { x: p.x + scene.offsetX, y: p.y + scene.offsetY } : p)

  const renderChip = (id: string, p: Pt, side: Side | 'focus') => {
    const isFocus = side === 'focus'
    const color = colorOf(domainOf(id))
    const sp = toSvg(p)
    return (
      <g key={`${side}-${id}`} data-lens-node={id} onClick={() => !isFocus && onFocus(id)} style={{ cursor: isFocus ? 'default' : 'pointer' }}>
        <rect
          x={sp.x - HALF_W}
          y={sp.y - HALF_H}
          width={CHIP_W}
          height={CHIP_H}
          rx={6}
          fill="#fff"
          stroke={isFocus ? '#f59e0b' : color}
          strokeWidth={isFocus ? 2.5 : 1.5}
        />
        <text x={sp.x} y={sp.y + 4} textAnchor="middle" fontSize={11} fontWeight={isFocus ? 800 : 600} fill={color}>
          {truncate(byId.get(id)!.title, 18)}
        </text>
      </g>
    )
  }

  // Edges are drawn per side with THAT side's own position map — a node on
  // both sides has two chips at two different points, and each side's edges
  // must land on its own chip, not the other side's (see module comment).
  const renderEdges = (side: Side, edges: { from: string; to: string }[], posMap: Map<string, Pt>) =>
    edges.map((e) => {
      const p1 = posMap.get(e.from)
      const p2 = posMap.get(e.to)
      if (!p1 || !p2) return null
      const { x1, y1, x2, y2 } = shortenToEdge(toSvg(p1), toSvg(p2))
      return (
        <line
          key={`${side}-${e.from}-${e.to}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={EDGE_COLOR[type]}
          strokeWidth={1.5}
          opacity={0.5}
          markerEnd={`url(#${markerId})`}
        />
      )
    })

  let body: ReactNode
  if (!focus) {
    body = <EmptyState text="click a node in the tree — every lens recenters on it" />
  } else if (!byId.get(focus)?.topic) {
    body = <EmptyState text="lenses read topics — typed links live at the topic level" />
  } else if (!model || !scene) {
    body = null // unreachable in practice: focus is a topic, so model/scene always compute
  } else if (model.out.levels.length === 0 && model.in.levels.length === 0) {
    body = <EmptyState text={`no ${EDGE_LABEL[type]} links touch this node`} />
  } else {
    body = (
      <svg width={scene.width} height={scene.height}>
        <defs>
          <marker id={markerId} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLOR[type]} />
          </marker>
        </defs>

        {renderEdges('out', model.out.edges, scene.outPos)}
        {renderEdges('in', model.in.edges, scene.inPos)}

        {[...scene.outPos].filter(([id]) => id !== model.focus).map(([id, p]) => renderChip(id, p, 'out'))}
        {[...scene.inPos].filter(([id]) => id !== model.focus).map(([id, p]) => renderChip(id, p, 'in'))}
        {renderChip(model.focus, { x: 0, y: 0 }, 'focus')}

        {scene.frontier.map((f) => {
          const p = toSvg(f.at)
          // INK, NOT FURNITURE, AND SET THROUGH CSS (DS OB-154). This was Tailwind's
          // slate-400, the one call site still holding the raw value the relation
          // table dropped at OB-123. MEASURED on the surface actually behind it (the
          // scroll body below, `bg-slate-50` = #f8fafc): 2.45:1 before, 8.65:1 now, against
          // the 4.5:1 body text needs. `--text-2` is the
          // token because a frontier label NAMES something on the canvas: the DS's rule
          // is that --text-3 is for furniture that repeats and anything carrying meaning
          // takes --text-2.
          //
          // The colour goes in `style`, not in a `fill=` attribute. The DS's stated reason
          // is that `var()` in an SVG PRESENTATION ATTRIBUTE is dropped and the glyph
          // renders black, silently — which is why EDGE_COLOR holds copies rather than
          // var() references. THAT DID NOT REPRODUCE HERE, and it was tried rather than
          // assumed: `fill="var(--text-2)"` on this element computes to rgb(78, 72, 62)
          // in Edge/Chromium, the same as the CSS property. The earlier finding was
          // `oklch()` in a `stroke` attribute on a map shape, which is not this case.
          // The CSS property is kept anyway — it is the form the item asked for and the
          // one that is unambiguously supported — and the divergence is reported back so
          // the rule in their contract says what is actually true.
          return (
            <text key={`f-${f.side}-${f.id}`} x={p.x} y={p.y} textAnchor="middle" fontSize={10} data-frontier={f.n} style={{ fill: 'var(--text-2)', pointerEvents: 'none' }}>
              ⤳ {f.n}
            </text>
          )
        })}
      </svg>
    )
  }

  return (
    <div data-lens={type} className="h-full flex flex-col">
      {/* OB-143, judged: this row starts with a SWATCH, not a letter, so the swatch's edge
          takes the legend's inset and the first letter lands one gap further in. Named on
          the receipt as the clause asks. Left only, by the constant. */}
      {/* THE LENS IS A PANE, SO IT TAKES A PANE'S SURFACE (DS OB-180, owner-ruled 2026-09-14):
          `--surface-paper` for the ground and the system's text tokens by rank, in place of the
          five Tailwind cool greys this file carried (slate-50 ground, slate-700/600/500/400/300
          inks, a white face, and the depth toggle's slate-700-on-white selected face). NOT
          `--surface-sunken`: a well is for something that CONTAINS other things, and the lens is
          a surface in its own right. The selected depth button wears the system's own selected
          face (`--accent-primary-wash` + `--accent-primary-ink`, what `MapFloatingButton` draws)
          rather than a flipped white-on-dark, because that is what a selected control looks like
          everywhere else on this desk. SCOPE HELD ON PURPOSE: the lens still paints its own
          background and does not mount inside a design-system `Pane` body, so `Pane`'s body audit
          cannot see it — accepted by the owner for now, not overlooked. Every text run's contrast
          against what is actually behind it is read off the live pane by the browser suite. */}
      <header className="shrink-0 flex items-center gap-2 pr-2 py-1 border-b border-[var(--border-hair)] bg-[var(--surface-paper)] text-[11px]" style={{ paddingLeft: LEGEND_INSET }}>
        <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: EDGE_COLOR[type] }} />
        <span className="font-bold text-[var(--text-1)]">{EDGE_LABEL[type]}</span>
        {/* the separator in `--text-2`, not `--text-3`: at 11px the third-rank ink measures 3.79:1 on
            paper, under the 4.5:1 every run in this pane must clear (the map readout's middot is the
            same rank for the same reason) */}
        <span className="text-[var(--text-2)]">·</span>
        <span className="font-medium text-[var(--text-2)] truncate max-w-[150px]">{focus ? (byId.get(focus)?.title ?? '—') : '—'}</span>
        <span className="flex-1" />
        <span className="text-[var(--text-2)] truncate">
          {config.outLabel} / {config.inLabel}
        </span>
        <div className="flex rounded border border-[var(--border-rule)] overflow-hidden shrink-0">
          {([1, 2] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={['px-1.5 py-0.5', depth === d ? 'bg-[var(--accent-primary-wash)] text-[var(--accent-primary-ink)] font-semibold' : 'bg-[var(--surface-paper)] text-[var(--text-2)] hover:bg-[var(--surface-hover-raised)]'].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-[var(--surface-paper)]">{body}</div>
    </div>
  )
}
