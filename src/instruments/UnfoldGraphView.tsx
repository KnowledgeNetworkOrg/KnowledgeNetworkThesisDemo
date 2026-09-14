// Unfold·Graph — a trial that replaces the Neighborhood tab: the SAME unfold
// mechanic as UnfoldView.tsx (click a node to reveal its typed links, pick
// one to materialize it), but the thing that grows is a GRAPH, not a linear
// column-per-depth tree. Two rules make it a graph:
//
//   1. Every graph id appears on the canvas at most once. Layout keys ARE
//      graph ids here — dedup makes them unique — unlike UnfoldView's
//      tree-position keys, which must allow the same node twice.
//   2. Picking a link whose target is already on the map does NOT grow a
//      duplicate. It draws the traversed edge as a curved dashed cross-link
//      and SNAPS the camera back to the existing node (smooth scroll + a
//      pulse). Exploration fronts can collide, and the collision is felt:
//      "this new thing IS that thing you already saw."
//
// Positions are fixed at first materialization and never re-settle (the
// lab's stability rule): a radial probe walks outward-facing angles around
// the parent and the first collision-free spot wins — deterministic, no
// force simulation. What accumulates is a deduped neighborhood map drawn by
// the learner's own traversal.

import { useEffect, useMemo, useRef, useState } from 'react'

import { LEGEND_INSET, PaneScroller } from '@/ds'
import { byId, domainOf, EDGE_COLOR, EDGE_LABEL } from '../corpus/graph'
import { colorOf } from '../model/color'
import type { EdgeType } from '../corpus/graph'
import { edgesTouching } from '../model/flat'
import { UnfoldStartPicker } from './UnfoldView'
import type { Bus } from '../studio/bus'

const EDGE_TYPES = Object.keys(EDGE_LABEL) as EdgeType[]

interface GNode {
  id: string
  x: number
  y: number
  enterAngle: number // direction parent→this at placement; children probe outward from it
}
interface GEdge {
  key: string // `${source}>${target}:${type}` — one drawing per typed, directed link
  source: string
  target: string
  type: EdgeType
  revisit: boolean // true: both endpoints already existed — drawn as a curved cross-link
}

const W = 3200
const H = 2200
const CX = W / 2
const CY = H / 2
const R = 20
const MIN_DIST = 95 // node centers may not come closer than this at placement
const MARGIN = 90

// probe order around the outward direction: straight on, then fan out
const OFFSETS = [0, 35, -35, 70, -70, 105, -105, 140, -140, 180].map((d) => (d * Math.PI) / 180)
const RADII = [170, 250, 330]

function place(parent: GNode, taken: GNode[]): { x: number; y: number; enterAngle: number } {
  for (const radius of RADII) {
    for (const off of OFFSETS) {
      const a = parent.enterAngle + off
      const x = parent.x + radius * Math.cos(a)
      const y = parent.y + radius * Math.sin(a)
      if (x < MARGIN || x > W - MARGIN || y < MARGIN || y > H - MARGIN) continue
      if (taken.every((n) => Math.hypot(n.x - x, n.y - y) >= MIN_DIST)) return { x, y, enterAngle: a }
    }
  }
  // canvas region saturated — accept the overlap rather than re-settle anyone
  const a = parent.enterAngle
  return { x: parent.x + RADII[0] * Math.cos(a), y: parent.y + RADII[0] * Math.sin(a), enterAngle: a }
}

/** Line endpoints pulled in to each circle's boundary, so the arrowhead
 * marker lands outside the node instead of being covered by it. */
function shortenToEdge(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return { x1: from.x + ux * R, y1: from.y + uy * R, x2: to.x - ux * R, y2: to.y - uy * R }
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export interface UnfoldGraphViewProps {
  bus: Bus
  /** start unfolding at this leaf immediately. Nothing passes it today — the
   * map's "open neighborhood" pin action went with the flat MapView — but the
   * re-seed API is kept intact for whatever re-adds a framing command. */
  initialStart?: string | null
  /** counter-keyed external reseed — alternative to key-remounting */
  resetTo?: { id: string; n: number } | null
}

export default function UnfoldGraphView({ bus, initialStart = null, resetTo = null }: UnfoldGraphViewProps) {
  // PLACING a node on this canvas is a trail entry and nothing more — the rest
  // of the Studio does not get dragged along by someone drawing on their own
  // canvas. OPENING one is a real focus.
  const onVisit = (id: string) => bus.visit(id, 'graph')
  const onOpen = (id: string) => bus.setFocus(id, 'graph')

  const [nodes, setNodes] = useState<GNode[]>(() =>
    initialStart ? [{ id: initialStart, x: CX, y: CY, enterAngle: 0 }] : [],
  )
  const [gedges, setGedges] = useState<GEdge[]>([])
  const [openId, setOpenId] = useState<string | null>(initialStart)
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  // camera moves are decided during event handlers but must run after the
  // commit (a brand-new node has to exist before we can scroll to it)
  const pendingPan = useRef<{ x: number; y: number; smooth: boolean } | null>(
    initialStart ? { x: CX, y: CY, smooth: false } : null,
  )
  useEffect(() => {
    const p = pendingPan.current
    const el = scrollRef.current
    if (p && el) {
      el.scrollTo({ left: p.x - el.clientWidth / 2, top: p.y - el.clientHeight / 2, behavior: p.smooth ? 'smooth' : 'auto' })
      pendingPan.current = null
    }
  })

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 1600)
    return () => window.clearTimeout(t)
  }, [flash])

  // External reseed (the map's "open neighborhood"): Studio bumps `resetTo.n`
  // on every request, even to the same id, so the dependency is the counter,
  // not id equality. onVisit/onOpen are plain (unmemoized) callbacks from the
  // parent, so a ref keeps the latest ones without pulling them into the
  // effect's deps — refreshed every render (in its own effect, refs must not
  // be written during render) and read only inside the reset effect below,
  // which fires after this one in the same commit.
  const latestReset = useRef({ resetTo, onVisit, onOpen })
  useEffect(() => {
    latestReset.current = { resetTo, onVisit, onOpen }
  })
  useEffect(() => {
    const current = latestReset.current.resetTo
    if (!current) return
    const { id } = current
    setNodes([{ id, x: CX, y: CY, enterAngle: 0 }])
    setGedges([])
    setOpenId(id)
    setFlash(null)
    pendingPan.current = { x: CX, y: CY, smooth: false }
    latestReset.current.onVisit?.(id)
    latestReset.current.onOpen?.(id)
  }, [resetTo?.n])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const drawn = useMemo(() => new Set(gedges.map((e) => e.key)), [gedges])

  const start = (id: string) => {
    setNodes([{ id, x: CX, y: CY, enterAngle: 0 }])
    setGedges([])
    setOpenId(id)
    setFlash(null)
    pendingPan.current = { x: CX, y: CY, smooth: false }
    onVisit?.(id)
    onOpen?.(id)
  }

  const pickLink = (from: GNode, targetId: string, type: EdgeType, out: boolean) => {
    const source = out ? from.id : targetId
    const target = out ? targetId : from.id
    const key = `${source}>${target}:${type}`
    const existing = nodeById.get(targetId)
    if (existing) {
      // snap back: the edge lands between two nodes that are already there
      if (!drawn.has(key)) setGedges((prev) => [...prev, { key, source, target, type, revisit: true }])
      setOpenId(targetId)
      setFlash((f) => ({ id: targetId, n: (f?.n ?? 0) + 1 }))
      pendingPan.current = { x: existing.x, y: existing.y, smooth: true }
      onOpen?.(targetId)
    } else {
      const pos = place(from, nodes)
      setNodes((prev) => [...prev, { id: targetId, ...pos }])
      setGedges((prev) => [...prev, { key, source, target, type, revisit: false }])
      setOpenId(targetId)
      pendingPan.current = { x: pos.x, y: pos.y, smooth: true }
      onVisit?.(targetId)
      onOpen?.(targetId)
    }
  }

  if (nodes.length === 0) {
    return (
      <UnfoldStartPicker
        heading="Start unfolding a graph"
        sub="same unfold, different shape — every node appears ONCE; picking something already on the map draws the link and snaps back to it"
        onStart={start}
      />
    )
  }

  const openNode = openId ? (nodeById.get(openId) ?? null) : null
  const openRows = openNode
    ? edgesTouching(openNode.id)
        .filter((e) => !drawn.has(`${e.source}>${e.target}:${e.type}`))
        .map((e) => ({
          id: e.source === openNode.id ? e.target : e.source,
          out: e.source === openNode.id,
          type: e.type,
        }))
    : []
  const flashNode = flash ? (nodeById.get(flash.id) ?? null) : null
  const revisitCount = gedges.filter((e) => e.revisit).length

  return (
    <div className="relative h-full flex flex-col">
      {/* OB-143: the row's first letter sits under the legend's — left only, by the constant */}
      <div className="shrink-0 pr-4 pt-3 pb-2 flex items-center gap-3 text-[11px] text-slate-600 bg-white border-b border-slate-200" style={{ paddingLeft: LEGEND_INSET }}>
        <span className="font-bold text-slate-800 text-[12px]">Unfold·Graph — trial: same unfold, but a graph</span>
        <span className="text-slate-400">every node once · picking one already on the map snaps back to it (dashed cross-link)</span>
        <span className="flex-1" />
        <span className="text-amber-700 font-medium">
          {nodes.length} nodes · {gedges.length} links{revisitCount > 0 ? ` (${revisitCount} rediscovered)` : ''}
        </span>
        <button
          onClick={() => {
            setNodes([])
            setGedges([])
            setOpenId(null)
            setFlash(null)
          }}
          className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100"
        >
          ✕ start over
        </button>
      </div>

      <PaneScroller forwardRef={scrollRef} aria-label="unfoldg-canvas">
        <div className="relative" style={{ width: W, height: H }}>
          <svg width={W} height={H} className="absolute inset-0">
            <defs>
              {EDGE_TYPES.map((type) => (
                <marker key={type} id={`unfoldg-arrow-${type}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLOR[type]} />
                </marker>
              ))}
            </defs>

            {/* edges first, so node circles cover only the shortened stubs */}
            {gedges.map((e) => {
              const s = nodeById.get(e.source)!
              const t = nodeById.get(e.target)!
              const { x1, y1, x2, y2 } = shortenToEdge(s, t)
              const label = EDGE_LABEL[e.type]
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              // revisit cross-links bow sideways so they read as "found again",
              // not as part of the grown skeleton
              const len = Math.hypot(x2 - x1, y2 - y1) || 1
              const px = -(y2 - y1) / len
              const py = (x2 - x1) / len
              const bow = e.revisit ? 44 : 0
              const lx = mx + px * (bow / 2)
              const ly = my + py * (bow / 2)
              return (
                <g key={e.key}>
                  <path
                    d={e.revisit ? `M${x1},${y1} Q${mx + px * bow},${my + py * bow} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`}
                    fill="none"
                    stroke={EDGE_COLOR[e.type]}
                    strokeWidth={1.8}
                    strokeDasharray={e.revisit ? '6 4' : undefined}
                    opacity={0.8}
                    markerEnd={`url(#unfoldg-arrow-${e.type})`}
                    data-revisit={e.revisit ? 'true' : 'false'}
                  />
                  <rect x={lx - label.length * 3 - 4} y={ly - 8} width={label.length * 6 + 8} height={14} rx={3} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={EDGE_COLOR[e.type]}>
                    {label}
                  </text>
                </g>
              )
            })}

            {flashNode && (
              // keyed by pulse count so a second snap to the same node restarts the SMIL animation
              <g key={`flash-${flash!.n}`} style={{ pointerEvents: 'none' }}>
                <circle cx={flashNode.x} cy={flashNode.y} r={R} fill="none" stroke="#f59e0b" strokeWidth={3}>
                  <animate attributeName="r" from={String(R)} to="52" dur="0.75s" repeatCount="2" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="0.75s" repeatCount="2" />
                </circle>
              </g>
            )}

            {nodes.map((n) => {
              const isOpen = n.id === openId
              return (
                <g key={n.id}>
                  <circle
                    data-node={n.id}
                    cx={n.x}
                    cy={n.y}
                    r={R}
                    fill={colorOf(domainOf(n.id))}
                    stroke={isOpen ? '#f59e0b' : '#fff'}
                    strokeWidth={isOpen ? 3 : 2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (openId !== n.id) onOpen?.(n.id)
                      setOpenId((cur) => (cur === n.id ? null : n.id))
                    }}
                  />
                  <text x={n.x} y={n.y + R + 14} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#1e293b" style={{ pointerEvents: 'none' }}>
                    {truncate(byId.get(n.id)!.title, 20)}
                  </text>
                </g>
              )
            })}
          </svg>

          {openNode && (
            <div
              className="absolute z-20 bg-white border border-amber-300 shadow-lg rounded-lg p-2.5 w-[270px]"
              style={{ left: openNode.x + R + 14, top: Math.max(4, openNode.y - 90) }}
              aria-label="unfoldg-list"
            >
              <div className="text-[11px] font-bold text-slate-800 mb-1.5">{byId.get(openNode.id)!.title} — links</div>
              {(() => {
                const groups = EDGE_TYPES.map((type) => ({ type, rows: openRows.filter((r) => r.type === type) })).filter(
                  (g) => g.rows.length > 0,
                )
                if (edgesTouching(openNode.id).length === 0)
                  return <div className="text-[10.5px] text-slate-400">no typed links touch this node</div>
                if (groups.length === 0)
                  return <div className="text-[10.5px] text-slate-400">every link from here is already on the map</div>
                return (
                  <div className="flex flex-col gap-2 max-h-[260px] overflow-auto">
                    {groups.map(({ type, rows }) => (
                      <div key={type}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: EDGE_COLOR[type] }} />
                          <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">{EDGE_LABEL[type]}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {rows.map((r) => {
                            const onMap = nodeById.has(r.id)
                            return (
                              <button
                                key={`${r.out ? 'o' : 'i'}-${r.id}`}
                                data-onmap={onMap ? 'true' : 'false'}
                                onClick={() => pickLink(openNode, r.id, r.type, r.out)}
                                className="text-left px-1.5 py-1 rounded border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-[10.5px] flex items-center gap-1"
                              >
                                <span className="text-slate-400 shrink-0">{r.out ? '→' : '←'}</span>
                                <span className="truncate" style={{ color: colorOf(domainOf(r.id)) }}>
                                  {byId.get(r.id)!.title}
                                </span>
                                {onMap && <span className="ml-auto shrink-0 text-[9px] font-bold text-amber-600">↗ on map</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </PaneScroller>
    </div>
  )
}
