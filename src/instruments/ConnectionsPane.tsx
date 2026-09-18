// Connections — WHAT THIS NODE CONTAINS, beside WHAT IT IS RELATED TO.
//
// Rebuilt whole 2026-09-06 (#253, DS OB-101 + OB-113) on the design system's
// `ConnectionsSplitPane`, replacing the 1276-line pane that drew a containment
// WHEEL and a relations STAR as two modes of one canvas with a list under it.
// The redesign is the owner-approved "Combined B3" frame: a breadcrumb over a
// resizable, collapsible split — the CONTAINS column (a filter over a pill tree)
// beside the RELATIONS column (this app's real graph in a slot, a hover/pin hint
// line, then relationship cards grouped by source and by target).
//
// WHAT THIS FILE STILL OWNS, now that the pane component owns every layout rule:
//   1. the corpus adapters — the containment tree, the decomposed relations, the
//      one-line summary the hover preview reads;
//   2. navigation — which node the pane is aimed at, and what a click means on
//      the shared bus;
//   3. the GRAPH SLOT. The design system deliberately ships no graph: every graph
//      in that project is a stand-in, so what is ported here is the
//      `ConnectionsGraphApi` CONTRACT and the drawing is ours — the same typed
//      relation star this pane has always drawn, at true map bearings, in the same
//      pan/zoom canvas.
//
// WHAT THE REHAUL RETIRED, deliberately, and each one is a decision rather than an
// omission:
//   · the internal ⇄ external MODE TOGGLE. The containment reading is a column
//     now, not a mode, so both readings are on screen at once and there is nothing
//     to switch between. `model/panegraph.ts` (the wheel's layout) was DELETED with
//     it on 2026-09-07 (#290), where its design reasoning is preserved in full.
//   · the external SUMMARY grain for a region, which rolled a region's outside
//     links up to one arrow per other AREA — also now deleted from `model/star.ts`
//     itself (#290), so `regionStarFor` takes no grain at all. It
//     cannot compose with this pane: the whole mechanism here is that hovering a
//     card lights its node in the graph and the other way round, and those two
//     surfaces must therefore name the same ids. A summary node IS a region while
//     every card's target is a topic, so in that grain nothing would ever light
//     anything. A region draws its DETAILED star, whose nodes are topics.
//   · the pane-local ◀ ▶ HISTORY BUTTONS, moved out to the pane header's own
//     actions slot (`ConnectionsPaneActions`, mounted by `studio/instruments.tsx`)
//     — the split has no chrome row left to hold them, and nothing else in the app
//     offers back/forward over the focus.
//
// #22 IS NOT DECIDED HERE, and this file is where its decision was going to land.
// How Connections OPENS is still the safe state it has been since 9b0c585: you
// pick it from the sidebar or a preset, and nothing auto-reveals it. This rewrite
// adds no `bus.reveal` and removes none — the question that issue asks is exactly
// as open as it was.
//
// THE CLICK GRAMMAR, restated because the redesign changed one third of it:
//   hover  — lights, everywhere. A tree row, a card and a graph node all publish
//            the same id to the bus, so the map's territory lights with them.
//   click on a GRAPH node — PINS the card filter (spec, #253). It does not
//            navigate and it does not move the map's camera.
//   click on a CRUMB, a TREE ROW or a CARD's pill — re-roots the session there AND
//            flies the map to its territory. One gesture, which is what a crumb
//            click has always meant here; the old pane's separate look-only single
//            click has no surface left to live on, since a single click in the new
//            pane is the selection gesture.

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { CONNECTIONS_BODY_STYLE, ConnectionsSplitPane, IconButton, PaneCanvas } from '@/ds'
import type { ConnectionsGraphApi, ContainNode, OpenMap, Relation } from '@/ds'

import { byId, childrenOf, domainOf, EDGE_COLOR, EDGE_LABEL, edges, pathTo, ROOT_ID, topicHueOf } from '../corpus/graph'
import { DOC_BODY } from '../corpus/docs'
import { colorOf, fillOf } from '../model/color'
import { regionStarFor, starFor } from '../model/star'
import type { Bus } from '../studio/bus'

export { CONNECTIONS_BODY_STYLE }

// ── corpus adapters ─────────────────────────────────────────────────────────
// All three are MODULE SCOPE, and that is load-bearing rather than tidy: the pane
// memoises `relationsOf`'s answers on the function's identity, and a fresh closure
// per render would recompute the whole via-children roll-up — one call per
// descendant of the selection — on every keystroke in the filter box.

/** the whole corpus as the tree the CONTAINS column draws. Built once: the corpus is
 *  static, and rebuilding it per render would remount `ContainTree` (it keys on the
 *  root's id) and drop the open set with it. */
function buildContainTree(id: string): ContainNode {
  const kids = childrenOf.get(id) ?? []
  // EVERY NODE CARRIES ITS OWN TOPIC (DS OB-174 clause 6). Without this the column draws one
  // colour for the whole tree — the fault reported on the running app — because the component
  // can only fall back to the pane's single `domain`. It cannot invent a per-node topic, and
  // our corpus has had one all along: `domainOf` is what the map's territories already read.
  //
  // THE CORPUS ROOT IS THE ONE PILL THIS DRAWS GREY, and that is the wanted answer rather
  // than an accident to tidy up. `domainOf(ROOT_ID)` is the root's own id, which is not a
  // topic, so it takes the anchor fallback. The contract's alternative — leave the root
  // without a domain and let it inherit the PANE's — would paint "everything" in whichever
  // topic you happen to be standing in, so the top of the column would change colour as you
  // navigate. A root that means "all of it" has no one topic, and says so.
  const node: ContainNode = { id, title: byId.get(id)!.title, domain: topicHueOf(id), root: id === ROOT_ID }
  if (kids.length) node.children = kids.map((k) => buildContainTree(k.id))
  return node
}
const CORPUS_TREE = buildContainTree(ROOT_ID)

/** ONE ENTRY PER TARGET AND KIND, decomposed — the shape the cards and the graph both
 *  read. An authored edge is a fact about a PAIR, so it appears twice in this index,
 *  once from each end, with `direction` told from that end's point of view; nothing
 *  downstream then has to know which way round the corpus authored it. `see_also` is
 *  the one kind this corpus authors as symmetric, and it reads 'both' from either end.
 *  `kindLabel` is the corpus's OWN wording ("builds on"), not the palette's example. */
const RELATIONS: Map<string, Relation[]> = (() => {
  const m = new Map<string, Relation[]>()
  const push = (from: string, to: string, e: (typeof edges)[number], direction: Relation['direction']) => {
    const other = byId.get(to)!
    const list = m.get(from) ?? []
    list.push({
      id: e.id, targetId: to, targetTitle: other.title, targetDomain: topicHueOf(to),
      kind: e.type, kindLabel: EDGE_LABEL[e.type], direction,
    })
    m.set(from, list)
  }
  for (const e of edges) {
    const both = e.type === 'see_also'
    push(e.source, e.target, e, both ? 'both' : 'out')
    push(e.target, e.source, e, both ? 'both' : 'in')
  }
  return m
})()
const NO_RELATIONS: Relation[] = []
function relationsOfNode(id: string): Relation[] {
  return RELATIONS.get(id) ?? NO_RELATIONS
}

/** the hover preview's body — the FIRST SENTENCE of the node's own teaching article, never
 *  invented prose. A document body here opens with a definition ("Computer Science — the
 *  whole field this map describes, …"), which is exactly the register a one-line preview
 *  wants; the rest is the Document pane's job. A node with no article draws the card's
 *  skeleton instead, which is the honest fallback. */
function summaryOfNode(id: string): string | undefined {
  const body = DOC_BODY[id]
  if (!body) return undefined
  const stop = body.indexOf('. ')
  return stop > 40 ? body.slice(0, stop + 1) : body.slice(0, 180)
}

// ── the graph slot: this app's real relation star ───────────────────────────
// half viewBox — wider than tall, because English titles are wide: labels near the
// horizontal extremes also flip to hang below/above their node
const VBX = 272
const VBY = 178
const HORIZ = 105 // |x| beyond this = "horizontal extreme", label goes under
// Parallel edges (one counterpart, several typed links) separate by BOWING apart,
// not by sliding sideways: both ends stay anchored on the two nodes, so the
// arrowheads keep pointing AT them instead of drifting off their flanks, and the
// curves' MIDPOINTS — where the type words sit — pull far enough apart to be read.
const BOW = 38
// the star's viewBox is fitted into a column a few hundred px wide, so viewBox units
// land at roughly 0.7 CSS px. Sized just under the node labels' 12: subordinate to
// them, still legible.
const EDGE_FS = 11
const Z_MAX = 8
const MIN_LEGIBLE_PX = 8
const LABEL_FS = 12 // the canvas's base label size — the legibility anchor
/** the graph's own height inside the scrolling relations column. It used to fill the
 *  pane; it is now one block above the cards, so it has to say how tall it is. */
const GRAPH_H = 250

/** the canvas shell: drag pans, the wheel zooms about the cursor, double-click on water
 *  resets, and a chip reports the zoom whenever the view has moved. Zoom is GEOMETRIC —
 *  SVG scales the type with the picture — and the zoom-OUT floor is computed from what is
 *  actually rendering: the level where the 12-unit labels would drop under ~8 CSS px, the
 *  edge of legibility, receding once the picture has outgrown the frame so an opened ring
 *  past the viewBox edge is still reachable.
 *
 *  ITS ROOT IS A PaneCanvas (#143, OB-054), and only its root: this is the one region
 *  whose content must be CROPPED, since absolutely-positioned SVG content can pan past its
 *  edge. The cards below it are ordinary flow content in the column's own scroller, never
 *  inside this box — putting a scroller inside a rounded, clipped canvas is the exact fault
 *  Pane's own audit exists to catch. */
function PanZoomCanvas({ resetKey, svgProps, children }: {
  /** a new key is a new picture — the view snaps home */
  resetKey: string
  /** the canvas's data-* identity, spread onto the svg */
  svgProps?: Record<string, unknown>
  children: ReactNode
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, z: 1 })
  const [dragging, setDragging] = useState(false)
  const gesture = useRef({ p: null as { x: number; y: number } | null, dist: 0 })

  // render-time adjust, the "adjust state when a prop changes" pattern
  const [resetFor, setResetFor] = useState(resetKey)
  if (resetFor !== resetKey) {
    setResetFor(resetKey)
    setView({ x: 0, y: 0, z: 1 })
  }

  // the raw listener is non-passive on purpose — React's onWheel cannot preventDefault,
  // and a zooming canvas must not scroll the column behind it. Deps []: each canvas
  // mounts its own shell, so svg and listener share a life.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const rect = el.getBoundingClientRect()
      // meet-fit: rendered px per viewBox unit, and its inverse for pointer math
      const pxPerUnit = Math.min(rect.width / (2 * VBX), rect.height / (2 * VBY))
      const f = Math.max((2 * VBX) / rect.width, (2 * VBY) / rect.height)
      const legible = Math.min(1, MIN_LEGIBLE_PX / (pxPerUnit * LABEL_FS))
      let fitZ = Infinity
      const bb = (el.querySelector('[data-cvg]') as SVGGraphicsElement | null)?.getBBox()
      if (bb && (bb.width > 0 || bb.height > 0)) {
        const need = Math.max(
          Math.abs(bb.y) / VBY, Math.abs(bb.y + bb.height) / VBY,
          Math.abs(bb.x) / VBX, Math.abs(bb.x + bb.width) / VBX,
        )
        if (need > 0) fitZ = 1 / need
      }
      const zMin = Math.min(legible, fitZ)
      const u = {
        x: -VBX + (ev.clientX - rect.left - (rect.width - (2 * VBX) / f) / 2) * f,
        y: -VBY + (ev.clientY - rect.top - (rect.height - (2 * VBY) / f) / 2) * f,
      }
      setView((v) => {
        const z = Math.min(Z_MAX, Math.max(zMin, v.z * Math.exp(-ev.deltaY * 0.0016)))
        if (z === v.z) return v
        const k = z / v.z
        return { z, x: u.x - (u.x - v.x) * k, y: u.y - (u.y - v.y) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const moved = view.z !== 1 || view.x !== 0 || view.y !== 0
  return (
    <PaneCanvas style={{ flex: 'none', height: GRAPH_H, marginBottom: 6 }}>
      <svg
        ref={svgRef}
        {...svgProps}
        data-cvz={view.z.toFixed(2)}
        viewBox={`${-VBX} ${-VBY} ${2 * VBX} ${2 * VBY}`}
        className="w-full h-full"
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={(ev: ReactPointerEvent) => {
          gesture.current.p = { x: ev.clientX, y: ev.clientY }
          gesture.current.dist = 0
          setDragging(true)
          ;(ev.target as Element).setPointerCapture(ev.pointerId)
        }}
        onPointerMove={(ev: ReactPointerEvent) => {
          const g = gesture.current
          const el = svgRef.current
          if (!g.p || !el) return
          const rect = el.getBoundingClientRect()
          const f = Math.max((2 * VBX) / rect.width, (2 * VBY) / rect.height)
          const dx = (ev.clientX - g.p.x) * f
          const dy = (ev.clientY - g.p.y) * f
          g.p = { x: ev.clientX, y: ev.clientY }
          g.dist += Math.hypot(dx, dy)
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
        }}
        onPointerUp={() => { gesture.current.p = null; setDragging(false) }}
        // a pan's pointer-up must not fire the node click underneath — the capture phase
        // sees the click before any node does and swallows it. The distance survives until
        // the NEXT pointer-down, so a genuine click always passes.
        onClickCapture={(ev: ReactMouseEvent) => { if (gesture.current.dist > 4) ev.stopPropagation() }}
        onDoubleClick={(ev: ReactMouseEvent) => {
          // water only — a node's own double-click must win
          if (ev.target === svgRef.current) setView({ x: 0, y: 0, z: 1 })
        }}
      >
        {/* mid-pan the content goes pointer-inert, so sweeping across nodes can neither
            arm hover previews nor light the bus */}
        <g data-cvg transform={`translate(${view.x} ${view.y}) scale(${view.z})`} pointerEvents={dragging ? 'none' : undefined}>
          {children}
        </g>
      </svg>
      {moved && (
        <div className="absolute bottom-2 left-2 z-10 rounded border border-slate-200 bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-500 select-none pointer-events-none">
          ×{view.z.toFixed(2)} — double-click resets
        </div>
      )}
    </PaneCanvas>
  )
}

/** one drawn counterpart, whichever star it came from — the topic star's own nodes and the
 *  region star's detailed nodes differ only in what they call their strand list. */
interface Spoke {
  key: string
  type: keyof typeof EDGE_COLOR
  /** relative to the centre */
  dir: 'out' | 'in' | 'both'
}

/** THE PANE'S REAL GRAPH — the typed relation star, counterparts ringed at their TRUE map
 *  bearings with one line per typed edge and an arrowhead for direction. It is the app's
 *  own drawing, wired to the design system's `ConnectionsGraphApi`:
 *
 *  · `highlightId` and `centerHighlight` arrive as SEPARATE lights, and are drawn as two —
 *    hovering a target must not light the source, or the highlight only ever says "something
 *    is hovered".
 *  · `pinnedId` draws a held ring, so a pinned filter is visible on the graph that set it.
 *  · a node CLICK calls `onNodeSelect`, which pins; it deliberately neither re-roots nor
 *    moves the map.
 *  · a node hover calls `onPreviewEnter` with the real pointer event — the pane finds its own
 *    tip layer from the event's target.
 *
 *  AND IT IS WHERE CROSS-PANE HOVER IS PUBLISHED. `highlightId` is the one value that already
 *  unifies all three hover sources in this pane — the graph, the tree rows and the cards — so
 *  mirroring it onto the bus from here lights the map's territory for every one of them from
 *  a single place. An effect is the right shape for that: it is the sanctioned "update an
 *  external system with the latest state from React", and the bus is exactly that. */
function RelationStar({ api, bus }: { api: ConnectionsGraphApi; bus: Bus }) {
  const { highlightId } = api
  useEffect(() => {
    if (!highlightId) return
    bus.setHover(highlightId)
    return () => bus.endHover(highlightId)
  }, [highlightId, bus])

  const id = api.selected.id
  const topic = starFor(id)
  /* THE PANE REFUSES THE LIFT, and this test is the whole of it. `starFor` answers a node
     BELOW a topic with its OWNING topic's star — anchor, counterparts and all — which is a
     useful thing for the model to know and a lie to draw here: it made every deep selection
     look connected when it has no typed links of its own (2026-07-17). So the star is drawn
     only when the selection IS the anchor. A container ABOVE the topic tier gets its region's
     detailed star instead, and a node below one gets nothing, with the cards saying where its
     relations actually live. */
  const isAnchor = topic.anchor === id
  const region = isAnchor ? null : regionStarFor(id)
  const nodes: { id: string; x: number; y: number; spokes: Spoke[] }[] = isAnchor
    ? topic.nodes.map((sn) => ({
        id: sn.id, x: sn.x, y: sn.y,
        spokes: sn.edges.map((e) => ({ key: e.id, type: e.type, dir: (e.source === topic.anchor ? 'out' : 'in') as Spoke['dir'] })),
      }))
    : (region?.nodes ?? []).map((sn) => ({
        id: sn.id, x: sn.x, y: sn.y,
        spokes: sn.strands.map((s) => ({ key: s.key, type: s.type, dir: s.dir })),
      }))
  // relations live at the TOPIC grain: a node below one has none of its own, and this pane
  // refuses the lift (2026-07-17 — drawing its owning topic's star made every deep selection
  // look connected). Nothing to draw, so nothing is drawn; the cards say where they live.
  if (!nodes.length) return null

  const centre = isAnchor ? topic.anchor! : id
  const centreLit = api.centerHighlight
  return (
    <>
      {/* THE ROLLED-UP CASE HAS TO SAY SO. The column's head counts the SELECTED node's own
          relations, which for an area is nought — and the graph under it is then drawing the
          links of everything INSIDE the area, so the head reads "0 edges" over a picture with a
          dozen lines in it. That is a true head and a true picture contradicting each other,
          which a reader can only resolve by already knowing that relations live at the topic
          grain. One line, in the host's own slot, says it instead. */}
      {isAnchor ? null : (
        <div style={{ padding: '2px 2px 6px', fontSize: 10, lineHeight: 1.25, color: 'var(--text-2)' }}>
          <b style={{ fontWeight: 'var(--fw-bold)' }}>{byId.get(centre)!.title}</b> has no typed links of its own — relations live at the topic grain. Below: what everything inside it reaches.
        </div>
      )}
    <PanZoomCanvas resetKey={centre} svgProps={{ 'data-relstar': centre }}>
      {/* the spokes — colour is the relation's kind, the arrowhead its direction */}
      <g pointerEvents="none">
        {nodes.map((sn) => {
          const len = Math.hypot(sn.x, sn.y) || 1
          const ux = sn.x / len
          const uy = sn.y / len
          const lit = api.highlightId === sn.id
          const dim = !!api.highlightId && !lit
          const n = sn.spokes.length
          // both ends anchored: tail at the centre's rim, head at the counterpart's. Only the
          // middle moves. The ring is an ellipse, so the reach is this node's OWN distance.
          const ax = ux * 19
          const ay = uy * 19
          const bx = ux * (len - 13)
          const by = uy * (len - 13)
          return sn.spokes.map((s, i) => {
            const bow = n === 1 ? 0 : (i - (n - 1) / 2) * BOW
            const cx = (ax + bx) / 2 - uy * bow
            const cy = (ay + by) / 2 + ux * bow
            // the quadratic's own midpoint (t = 0.5) — where the type word goes, and the
            // reason the bow exists at all
            const mx = 0.25 * ax + 0.5 * cx + 0.25 * bx
            const my = 0.25 * ay + 0.5 * cy + 0.25 * by
            // 'out' heads at the counterpart, 'in' back at the centre, 'both' draws none —
            // a two-way relation with one head would lie
            const head = s.dir === 'both' ? null : s.dir === 'out' ? { x: bx, y: by } : { x: ax, y: ay }
            const deg = head ? (Math.atan2(head.y - cy, head.x - cx) * 180) / Math.PI : 0
            // the word reads along the spoke, flipped upright on the left half
            let rot = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
            if (rot > 90 || rot < -90) rot += 180
            return (
              <g key={s.key} data-staredge={s.key} opacity={dim ? 0.2 : 1} style={{ transition: 'opacity 120ms' }}>
                <path d={`M${ax},${ay} Q${cx},${cy} ${bx},${by}`} fill="none" stroke="#ffffff" strokeWidth={3.6} strokeOpacity={0.8} />
                <path d={`M${ax},${ay} Q${cx},${cy} ${bx},${by}`} fill="none" stroke={EDGE_COLOR[s.type]} strokeWidth={lit ? 2.8 : 1.8} strokeOpacity={0.92} />
                {head && <path d="M0,0 L-6,3 L-6,-3 Z" transform={`translate(${head.x} ${head.y}) rotate(${deg})`} fill={EDGE_COLOR[s.type]} />}
                <text
                  data-staredgelabel={s.key} x={mx} y={my} transform={`rotate(${rot} ${mx} ${my})`}
                  textAnchor="middle" fontSize={EDGE_FS} fontWeight={700} fill={EDGE_COLOR[s.type]}
                  stroke="#ffffff" strokeWidth={3} paintOrder="stroke" style={{ userSelect: 'none' }}
                >
                  {EDGE_LABEL[s.type]}
                </text>
              </g>
            )
          })
        })}
      </g>
      {/* the centre, on its OWN light. Clicking it RELEASES a pin — the pane reads
          `{ id: 'focus' }` and the selection's own id the same way. */}
      {centreLit && <circle cx={0} cy={0} r={21} fill={colorOf(centre)} fillOpacity={0.18} pointerEvents="none" />}
      <circle
        data-starcenter={centre} cx={0} cy={0} r={15} fill="#ffffff"
        stroke={colorOf(centre)} strokeWidth={centreLit ? 4 : 3} style={{ cursor: 'pointer' }}
        onClick={() => api.onNodeSelect({ id: 'focus' })}
        onMouseEnter={(e) => api.onPreviewEnter(e, { id: centre, title: byId.get(centre)!.title, domain: topicHueOf(centre) })}
        onMouseLeave={api.onPreviewLeave}
      >
        <title>{byId.get(centre)!.title} — click to release the card filter</title>
      </circle>
      <text x={0} y={-26} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="#1e293b" stroke="#ffffff" strokeWidth={3.4} paintOrder="stroke" style={{ userSelect: 'none' }}>
        {byId.get(centre)!.title}
      </text>
      {/* counterparts at their true map bearings. A lit node keeps full ink and grows a halo;
          the rest recede — the dim is what turns "one of these is hovered" into "THIS one is".
          A PINNED node keeps a ring of its own, so the filter is legible even after the
          pointer has moved off the node that set it. */}
      {nodes.map((sn) => {
        const horiz = Math.abs(sn.x) > HORIZ
        const lit = api.highlightId === sn.id
        const pinned = api.pinnedId === sn.id
        const dim = !!api.highlightId && !lit
        return (
          <g key={sn.id} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity 120ms' }}>
            {lit && <circle cx={sn.x} cy={sn.y} r={15} fill={colorOf(sn.id)} fillOpacity={0.18} pointerEvents="none" />}
            {pinned && <circle cx={sn.x} cy={sn.y} r={13} fill="none" stroke="var(--accent-primary)" strokeWidth={2} pointerEvents="none" />}
            <circle
              data-starnode={sn.id} data-pinned={pinned ? 1 : 0} cx={sn.x} cy={sn.y} r={9}
              fill={fillOf(sn.id)} stroke={colorOf(sn.id)} strokeWidth={lit ? 3.4 : 2}
              style={{ cursor: 'pointer' }}
              onClick={() => api.onNodeSelect({ id: sn.id, title: byId.get(sn.id)!.title, domain: topicHueOf(sn.id) })}
              onMouseEnter={(e) => api.onPreviewEnter(e, { id: sn.id, title: byId.get(sn.id)!.title, domain: topicHueOf(sn.id) })}
              onMouseLeave={api.onPreviewLeave}
            >
              <title>
                {byId.get(sn.id)!.title} — {sn.spokes.length} link{sn.spokes.length === 1 ? '' : 's'} · click to {pinned ? 'release' : 'pin'} the card filter
              </title>
            </circle>
            <text
              x={horiz ? sn.x : sn.x + (sn.x >= 0 ? 13 : -13)}
              y={horiz ? (sn.y >= 0 ? sn.y + 22 : sn.y - 16) : sn.y + 4}
              textAnchor={horiz ? 'middle' : sn.x >= 0 ? 'start' : 'end'}
              fontSize={12} fontWeight={lit ? 700 : 600} fill={lit ? colorOf(sn.id) : '#334155'}
              stroke="#ffffff" strokeWidth={3} paintOrder="stroke" pointerEvents="none" style={{ userSelect: 'none' }}
            >
              {byId.get(sn.id)!.title}
            </text>
          </g>
        )
      })}
    </PanZoomCanvas>
    </>
  )
}

// ── the pane ────────────────────────────────────────────────────────────────

/** the back/forward pair, mounted in the pane HEADER's actions slot rather than inside the
 *  body — the split has no chrome row of its own, and nothing else in the app walks the
 *  focus history. Exported for `studio/instruments.tsx`, which owns that slot. */
export function ConnectionsPaneActions({ bus }: { bus: Bus }) {
  return (
    <>
      <IconButton
        tone="chrome" size={18} glyphSize={11} glyph="◀" label="connections-nav-back"
        title="back — the previous focus" disabled={!bus.canBack} onClick={bus.back}
      />
      <IconButton
        tone="chrome" size={18} glyphSize={11} glyph="▶" label="connections-nav-forward"
        title="forward — the focus you stepped back from" disabled={!bus.canForward} onClick={bus.forward}
      />
    </>
  )
}

export default function ConnectionsPane({ bus }: { bus: Bus }) {
  // IS THE POINTER IN THIS PANE? The hover PREVIEW below must answer FOREIGN cursors only:
  // hovering one of our own rows must never re-target the very pane the cursor is standing in,
  // which would re-aim the split and remount the tree under the hand moving through it.
  //
  // This replaces the id mirror the old pane used ("which id did OUR cursor publish"), for two
  // reasons. It is more correct: the mirror could only recognise a row that had gone through
  // this file's own pointer handlers, and in the split the CARDS publish through the component,
  // so their hovers read as foreign and previewed. And it is expressible: the mirror needed the
  // bus's hover copied into state, which is only reachable from an effect, and setState from an
  // effect body is what `react-hooks/set-state-in-effect` refuses. Two ordinary pointer handlers
  // on our own root answer the same question with no synchronisation at all.
  const [pointerInside, setPointerInside] = useState(false)

  // A selection pins the pane. With NOTHING selected (before the first click, or after the
  // map's water-click/Esc) a foreign hover previews that node here, and snaps back to the
  // RESTING reading when the cursor moves off. That resting place is the node the nav cursor
  // still stands on (#6: de-selecting used to yank the pane to the whole-map root while you
  // were exploring). Root only before anything was ever selected.
  const restId = bus.history.cursor >= 0 ? bus.history.stack[bus.history.cursor] : ROOT_ID
  const focusId = bus.focus ?? (byId.has(restId) ? restId : ROOT_ID)
  const previewId = bus.focus == null && !pointerInside && bus.hover != null && byId.has(bus.hover) ? bus.hover : null
  const currentId = previewId ?? focusId
  const node = byId.get(currentId)!

  // THE CONTAINS COLUMN'S OPEN SET IS THE HOST'S, through the pane's `treeOpen` /
  // `onTreeOpenChange` pair — because the ANCESTORS OF THE SELECTION MUST BE OPEN or the
  // column shows a tree with nothing highlighted in it, which is the one state a "you are
  // here" column may not be in. The user's own toggles are kept underneath and win everywhere
  // else; only the path down to where you stand is forced, and it re-forces itself as the
  // selection moves.
  //
  // THIS UNION IS OURS AND STAYS OURS (DS OB-167): which ancestors count as "the path" is a
  // corpus question, and the design system said so explicitly when it adopted the pair.
  // `setUserOpen` is passed straight in because the callback now takes an UPDATER — React's
  // own setter is the intended value, and it is what makes two caret toggles inside one batch
  // both survive instead of only the last.
  //
  // AND NOTHING PERSISTS THIS SET. Handing the pane `treeOpen` stops it giving the tree a
  // storage key, deliberately: two writers for one piece of state is the worse failure. So the
  // open set is rebuilt each mount from the root plus the path to wherever you are — which is
  // the useful state to be in anyway. The divider width and the collapse still persist.
  const [userOpen, setUserOpen] = useState<OpenMap>({ [ROOT_ID]: 1 })
  const open: OpenMap = { ...userOpen }
  for (const id of pathTo(currentId)) open[id] = 1

  const onSelect = (n: { id: string }) => {
    if (!byId.has(n.id)) return
    // one gesture: re-root the session AND fly the map to the node's territory. A crumb click
    // has always meant both here, and the redesign makes every navigating click a crumb click.
    bus.setFocus(n.id, 'tree')
    bus.peekAt(n.id)
  }

  const domain = domainOf(currentId)
  const empty = node.topic
    ? `no typed links touch ${node.title}.`
    : childrenOf.has(currentId)
      ? `${node.title} links only within itself — nothing beneath it reaches out.`
      : `${node.title} has no typed links of its own — relations live at the topic grain.`

  return (
    <div
      aria-label="connections-pane" data-focus={bus.focus ?? undefined} data-current={currentId}
      onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => setPointerInside(false)}
      className="h-full flex flex-col"
    >
      {/* the pane says out loud when it is PREVIEWING rather than standing somewhere — a
          foreign cursor showing us around while nothing is selected. The slot is always
          there, so a preview arriving or leaving never reflows what is below it. */}
      <div className="h-4 shrink-0 flex items-center gap-1.5 text-[10px] select-none">
        {previewId && (
          <>
            <span data-childpreview={previewId} className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-bold uppercase tracking-wide">
              preview
            </span>
            <span className="text-slate-500 truncate">
              hovering <span className="font-semibold" style={{ color: colorOf(previewId) }}>{byId.get(previewId)!.title}</span> — click to select it
            </span>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ConnectionsSplitPane
          tree={CORPUS_TREE}
          domain={domain}
          selected={{ id: currentId, title: node.title, domain }}
          onSelect={onSelect}
          relationsOf={relationsOfNode}
          summaryOf={summaryOfNode}
          treeOpen={open}
          onTreeOpenChange={setUserOpen}
          renderGraph={(api) => <RelationStar api={api} bus={bus} />}
          persistKey="kn-connections"
          emptyLabel={empty}
          /* a docked desktop column is not a phone — the narrow single sliding view read as
             the pane LOSING a column (owner, 2026-08-28) */
          alwaysSplit
        />
      </div>
    </div>
  )
}

/* No `wrapTip` in this file, and that is correct rather than an omission: every tooltip here
   is either an SVG <title> ELEMENT (a child, not an attribute — the browser folds it) or an
   `IconButton title=` PROP, which the component folds internally. The rule binds a native
   `title=` attribute on a lowercase DOM tag, and there is none. */
