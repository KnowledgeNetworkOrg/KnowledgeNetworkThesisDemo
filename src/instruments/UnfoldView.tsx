// Unfold — a hand-built node-link tree instead of an auto-computed one.
// Every node (including the start) reveals its typed links on click as a
// pickable list; picking one MATERIALIZES it as a real node, connected by a
// labelled, directed edge, and it becomes clickable the same way. You choose
// which branch to grow, one click at a time — the opposite of the Neighborhood
// pane's fixed first-order ring (cockpit/PlexPanel.tsx), which shows everything at
// once but only one level deep.
//
// OverviewDetailView.tsx calls expand-in-place out BY NAME as its
// predecessor's failure mode: "obscures higher-level structure" (Han,
// Knauer, Rutter 2024). That finding is about expanding INSIDE a stable
// global overview; there's no such overview here to obscure — this tab IS
// the local view, same as the plex. The risk still exists in miniature (a
// deep, wide tree can crowd its own earlier nodes), just self-contained.
//
// Layout is a hand-rolled tidy tree, not force-directed: a childless node
// takes the next sequential row; a node with children sits at the average of
// their rows. Deterministic and collision-free by construction, consistent
// with every other view in this lab never re-settling positions on its own.
// Tree POSITIONS are keyed separately from graph ids throughout — the corpus
// is one strongly-connected component (see WalkView.tsx), so the same node
// can legitimately appear twice in the tree, and two occurrences must never
// collide as React keys or as layout/lookup keys.

import { useMemo, useState } from 'react'

import { LEGEND_INSET, PaneScroller } from '@/ds'
import { byId, domainIds, domainOf, EDGE_COLOR, EDGE_LABEL, topicsUnder } from '../corpus/graph'
import { colorOf } from '../model/color'
import type { EdgeType } from '../corpus/graph'
import { degreeOf, edgesTouching, HUB_IDS } from '../model/flat'

const EDGE_TYPES = Object.keys(EDGE_LABEL) as EdgeType[]

interface UNode {
  key: string // unique per TREE POSITION — distinct from `id` when a revisit
  id: string // the graph node this position represents; can repeat across positions
  parentKey: string | null
  edgeType: EdgeType | null
  edgeOut: boolean | null // true: parent is the edge's source; false: incoming: this node is the source
  isRevisit: boolean
  children: UNode[]
}

const ROOT_KEY = '#root'
const COL_W = 230
const ROW_H = 56
const PAD_X = 60
const PAD_Y = 34
const R = 20

function findByKey(node: UNode, key: string): UNode | null {
  if (node.key === key) return node
  for (const c of node.children) {
    const found = findByKey(c, key)
    if (found) return found
  }
  return null
}

function addChild(node: UNode, parentKey: string, child: UNode): UNode {
  if (node.key === parentKey) return { ...node, children: [...node.children, child] }
  return { ...node, children: node.children.map((c) => addChild(c, parentKey, child)) }
}

function collectIds(node: UNode, out: Set<string>) {
  out.add(node.id)
  for (const c of node.children) collectIds(c, out)
}

function flatten(node: UNode, out: UNode[]) {
  out.push(node)
  for (const c of node.children) flatten(c, out)
}

/** A childless node takes the next row; a parent sits at its children's average row. */
function computeLayout(root: UNode) {
  const pos = new Map<string, { x: number; y: number; depth: number }>()
  const counter = { n: 0 }
  const visit = (node: UNode, depth: number): number => {
    const slot = node.children.length === 0 ? counter.n++ : average(node.children.map((c) => visit(c, depth + 1)))
    pos.set(node.key, { x: PAD_X + depth * COL_W, y: PAD_Y + slot * ROW_H, depth })
    return slot
  }
  visit(root, 0)
  return { pos, rows: counter.n }
}
const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Line endpoints pulled in to each circle's boundary, so an arrowhead marker
 * lands outside the node instead of being covered by it. */
function shortenToEdge(from: { x: number; y: number }, to: { x: number; y: number }, rFrom: number, rTo: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return { x1: from.x + ux * rFrom, y1: from.y + uy * rFrom, x2: to.x - ux * rTo, y2: to.y - uy * rTo }
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** The "pick a starting node" screen — hubs first, then every leaf by domain.
 * Shared with UnfoldGraphView.tsx, which grows the same corpus a different shape. */
export function UnfoldStartPicker({ heading, sub, onStart }: { heading: string; sub: string; onStart: (id: string) => void }) {
  // OB-143: the heading's first letter sits under the legend's — left only, by the constant
  return (
    <PaneScroller style={{ padding: `24px 24px 24px ${LEGEND_INSET}px` }}>
      <div className="max-w-[900px] mx-auto">
        <div className="text-[13px] font-bold text-slate-800">{heading}</div>
        <div className="text-[11px] text-slate-500 mt-0.5 mb-4">{sub}</div>

        <div className="text-[11px] text-slate-400 font-semibold mb-1.5">the busiest topics (computed hubs — good starting points)</div>
        <div className="flex gap-2 flex-wrap mb-5">
          {HUB_IDS.map((id) => (
            <button
              key={id}
              onClick={() => onStart(id)}
              className="px-2.5 py-1 rounded-lg border-2 text-[12px] font-semibold bg-white hover:bg-amber-50"
              style={{ borderColor: colorOf(domainOf(id)), color: colorOf(domainOf(id)) }}
            >
              {byId.get(id)!.title}
              <span className="text-slate-400 font-normal ml-1.5">{degreeOf.get(id)} links</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-6 gap-4">
          {domainIds.map((d) => (
            <div key={d}>
              <div className="text-[11px] font-bold mb-1.5" style={{ color: colorOf(d) }}>
                {byId.get(d)!.title}
              </div>
              <div className="flex flex-col gap-1">
                {topicsUnder(d).map((id) => (
                  <button
                    key={id}
                    onClick={() => onStart(id)}
                    className="px-2 py-1 rounded border border-slate-200 bg-white text-left text-[11px] text-slate-600 hover:border-slate-400 hover:bg-slate-100"
                  >
                    {byId.get(id)!.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PaneScroller>
  )
}

export default function UnfoldView() {
  const [root, setRoot] = useState<UNode | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const materializedIds = useMemo(() => {
    const out = new Set<string>()
    if (root) collectIds(root, out)
    return out
  }, [root])

  const layout = useMemo(() => (root ? computeLayout(root) : null), [root])

  const start = (id: string) => {
    setRoot({ key: ROOT_KEY, id, parentKey: null, edgeType: null, edgeOut: null, isRevisit: false, children: [] })
    setOpenKey(ROOT_KEY)
  }

  const toggleOpen = (key: string) => setOpenKey((cur) => (cur === key ? null : key))

  const materialize = (parentKey: string, targetId: string, type: EdgeType, out: boolean) => {
    if (!root) return
    const key = `${parentKey}>${targetId}`
    const child: UNode = { key, id: targetId, parentKey, edgeType: type, edgeOut: out, isRevisit: materializedIds.has(targetId), children: [] }
    setRoot(addChild(root, parentKey, child))
    setOpenKey(key)
  }

  if (!root || !layout) {
    return (
      <UnfoldStartPicker
        heading="Start growing a tree"
        sub="pick a node — click it to reveal its typed links, click a link to grow it into a real node"
        onStart={start}
      />
    )
  }

  const flat: UNode[] = []
  flatten(root, flat)
  const maxDepth = Math.max(...[...layout.pos.values()].map((p) => p.depth))
  const W = Math.max(700, PAD_X * 2 + (maxDepth + 1) * COL_W)
  const H = PAD_Y * 2 + layout.rows * ROW_H

  const openNode = openKey ? findByKey(root, openKey) : null
  const openPos = openKey ? (layout.pos.get(openKey) ?? null) : null
  const openRoads = openNode ? edgesTouching(openNode.id) : []
  const openChildIds = new Set(openNode?.children.map((c) => c.id) ?? [])

  return (
    <div className="relative h-full flex flex-col">
      {/* OB-143: the row's first letter sits under the legend's — left only, by the constant */}
      <div className="shrink-0 pr-4 pt-3 pb-2 flex items-center gap-3 text-[11px] text-slate-600 bg-white border-b border-slate-200" style={{ paddingLeft: LEGEND_INSET }}>
        <span className="font-bold text-slate-800 text-[12px]">Unfold — click a node, then click a link to grow it</span>
        <span className="text-slate-400">↺ marks a node that already appears elsewhere in this tree</span>
        <span className="flex-1" />
        <span className="text-amber-700 font-medium">{flat.length} nodes</span>
        <button
          onClick={() => {
            setRoot(null)
            setOpenKey(null)
          }}
          className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100"
        >
          ✕ start over
        </button>
      </div>

      <PaneScroller aria-label="unfold-canvas">
        <div className="relative" style={{ width: W, height: H }}>
          <svg width={W} height={H} className="absolute inset-0">
            <defs>
              {EDGE_TYPES.map((type) => (
                <marker key={type} id={`unfold-arrow-${type}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLOR[type]} />
                </marker>
              ))}
            </defs>

            {/* edges first, so materialized-node circles drawn after cover
                only the shortened stub, never the arrowhead */}
            {flat.map((n) => {
              if (!n.parentKey) return null
              const pPos = layout.pos.get(n.parentKey)!
              const cPos = layout.pos.get(n.key)!
              const from = n.edgeOut ? pPos : cPos
              const to = n.edgeOut ? cPos : pPos
              const { x1, y1, x2, y2 } = shortenToEdge(from, to, R, R)
              const midX = (pPos.x + cPos.x) / 2
              const midY = (pPos.y + cPos.y) / 2
              const label = EDGE_LABEL[n.edgeType!]
              return (
                <g key={`edge-${n.key}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={EDGE_COLOR[n.edgeType!]}
                    strokeWidth={1.8}
                    opacity={0.8}
                    markerEnd={`url(#unfold-arrow-${n.edgeType})`}
                  />
                  <rect x={midX - label.length * 3 - 4} y={midY - 8} width={label.length * 6 + 8} height={14} rx={3} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={midX} y={midY + 3} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={EDGE_COLOR[n.edgeType!]}>
                    {label}
                  </text>
                </g>
              )
            })}

            {flat.map((n) => {
              const p = layout.pos.get(n.key)!
              const isOpen = n.key === openKey
              return (
                <g key={n.key}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={R}
                    fill={colorOf(domainOf(n.id))}
                    stroke={isOpen ? '#f59e0b' : '#fff'}
                    strokeWidth={isOpen ? 3 : 2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleOpen(n.key)}
                  />
                  {n.isRevisit && (
                    <text x={p.x + R - 3} y={p.y - R + 5} textAnchor="middle" fontSize={12} fill="#b45309" fontWeight={800} style={{ pointerEvents: 'none' }}>
                      ↺
                    </text>
                  )}
                  <text x={p.x} y={p.y + R + 14} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#1e293b" style={{ pointerEvents: 'none' }}>
                    {truncate(byId.get(n.id)!.title, 20)}
                  </text>
                </g>
              )
            })}
          </svg>

          {openNode && openPos && (
            <div
              className="absolute z-20 bg-white border border-amber-300 shadow-lg rounded-lg p-2.5 w-[260px]"
              style={{ left: openPos.x + R + 14, top: Math.max(4, openPos.y - 90) }}
              aria-label="unfold-list"
            >
              <div className="text-[11px] font-bold text-slate-800 mb-1.5">{byId.get(openNode.id)!.title} — links</div>
              {(() => {
                const groups = EDGE_TYPES.map((type) => ({
                  type,
                  rows: openRoads
                    .filter((e) => e.type === type)
                    .map((e) => ({ id: e.source === openNode.id ? e.target : e.source, out: e.source === openNode.id }))
                    .filter((r) => !openChildIds.has(r.id)),
                })).filter((g) => g.rows.length > 0)

                if (openRoads.length === 0) return <div className="text-[10.5px] text-slate-400">no typed links touch this node</div>
                if (groups.length === 0) return <div className="text-[10.5px] text-slate-400">every link from here is already grown</div>

                return (
                  <div className="flex flex-col gap-2 max-h-[260px] overflow-auto">
                    {groups.map(({ type, rows }) => (
                      <div key={type}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: EDGE_COLOR[type] }} />
                          <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">{EDGE_LABEL[type]}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {rows.map((r) => (
                            <button
                              key={`${r.out ? 'o' : 'i'}-${r.id}`}
                              onClick={() => materialize(openNode.key, r.id, type, r.out)}
                              className="text-left px-1.5 py-1 rounded border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-[10.5px] flex items-center gap-1"
                            >
                              <span className="text-slate-400 shrink-0">{r.out ? '→' : '←'}</span>
                              <span className="truncate" style={{ color: colorOf(domainOf(r.id)) }}>
                                {byId.get(r.id)!.title}
                              </span>
                            </button>
                          ))}
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
