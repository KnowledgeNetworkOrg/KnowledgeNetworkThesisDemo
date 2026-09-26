// Document — the current node's document (named KnowledgePanel.tsx until
// 2026-08-20). Reading happens here;
// the other instruments are for moving. The one navigation aid left is "Walks
// through here" — walks-as-content, made visible instead of staying implicit
// history. The radial neighborhood diagram that used to sit above the lists is
// now its own Studio instrument (NeighborhoodPanel) — compose them side by side.
//
// NAVIGATION LISTS ARE NOT HERE (2026-07-14). "Roads from here" (typed
// relations) left first, then "Contained" (the child list) followed it; both
// duplicated the Connections pane row for row. Relationships AND containment now
// have exactly ONE home — Connections — where a graph reading (star / wheel) and
// a list reading sit together and hover binds them. The document pane reads; it
// does not also index the graph or the tree.
//
// THE RELATIONS RAIL (2026-09, OB-229/#342). Relationships are read while reading,
// so they moved next to the document: a `RelationsRail` on the pane's right edge,
// holding the app's own relation STAR as a figure and, under it, a SENTENCE that
// reads the neighbourhood (not the card list — that stays in Connections). The
// figure's own hover raises the shared `NodePreviewCard` anchored beside it; the
// card and the map light each other over `bus.hover`.
//
// OB-209 — the pane READS `bus.focus` ONLY. A foreign (map) hover does not re-aim
// the document, and with nothing chosen the pane sits empty (no ROOT_ID fallback,
// which is what used to keep it warm): a document has to be reading something, and
// "nothing" is honest only when there is nothing chosen.

import { useSyncExternalStore, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

import { DocHeader, LEGEND_INSET, NodePreviewLayer, PaneScroller, previewGutter, RelationsRail, relationsRailWidth, SectionLabel, usePaneWidth, WalkCard } from '@/ds'
import type { NodePreviewCardProps } from '@/ds'

import { byId, childrenOf, EDGE_COLOR, pathTo, topicHueOf } from '../corpus/graph'
import { DOC_BODY } from '../corpus/docs'
import { colorOf, fillOf } from '../model/color'
import { regionStarFor, starFor } from '../model/star'
import { listWalks, subscribeWalks } from '../model/walkstore'
import type { Bus } from '../state/bus'
import { relationsOfNode, summaryOfNode } from './corpustree'

/** a sentence ABOUT the neighbourhood, not a list of it (OB-235). It reads the node's own
 *  decomposed relations and says how many links reach how many neighbours, and which way they
 *  run — the same facts the figure shows, put into words rather than rows. A dismissal is a
 *  sentence too, in the corpus's own voice (the same register Connections uses for its empty
 *  label). */
function neighbourhoodReading(id: string): string {
  const title = byId.get(id)!.title
  const rels = relationsOfNode(id)
  if (!rels.length) {
    return byId.get(id)!.topic
      ? `No typed links touch ${title}.`
      : childrenOf.has(id)
        ? `${title} links only within itself — nothing beneath it reaches out.`
        : `${title} has no typed links of its own — relations live at the topic grain.`
  }
  const targets = new Set(rels.map((r) => r.targetId)).size
  const out = rels.filter((r) => (r.direction ?? 'out') !== 'in').length
  const inc = rels.filter((r) => (r.direction ?? 'out') !== 'out').length
  const s = rels.length === 1 ? '' : 's'
  return `${rels.length} link${s} across ${targets} neighbour${targets === 1 ? '' : 's'} — ${out} reach out, ${inc} come in.`
}

/** THE DOCUMENT'S RELATIONS FIGURE — the app's own relation star, centred on the current node,
 *  drawn at the rail's own scale with NO text (the tooltip is the text; OB-229). Hovering a
 *  counterpart raises the shared card anchored beside the figure (`avoid`), and the hover goes
 *  out and back on `bus.hover`, so the figure and the map light each other (OB-230): a figure
 *  hover lights the map's cell, a map hover lights the figure's node. */
function RelationsFigure({ currentId, bus, show, hide }: {
  currentId: string
  bus: Bus
  show: (e: ReactMouseEvent, info: NodePreviewCardProps, source?: string, id?: string, opts?: { avoid?: Element | null }) => void
  hide: () => void
}) {
  const figRef = useRef<HTMLDivElement | null>(null)
  const topic = starFor(currentId)
  const isAnchor = topic.anchor === currentId
  const region = isAnchor ? null : regionStarFor(currentId)
  const centre = isAnchor ? (topic.anchor!) : currentId
  const nodes = isAnchor
    ? topic.nodes.map((sn) => ({
        id: sn.id, x: sn.x, y: sn.y,
        spokes: sn.edges.map((e) => ({ key: e.id, type: e.type, dir: (e.source === centre ? 'out' : 'in') as 'out' | 'in' })),
      }))
    : (region?.nodes ?? []).map((sn) => ({
        id: sn.id, x: sn.x, y: sn.y,
        spokes: sn.strands.map((s) => ({ key: s.key, type: s.type, dir: s.dir })),
      }))
  if (!nodes.length) return null

  const hoverId = bus.hover
  const ids = new Set(nodes.map((n) => n.id))
  const enter = (e: ReactMouseEvent, id: string) => {
    const n = byId.get(id)!
    show(e, { domain: topicHueOf(id) ?? undefined, title: n.title, summary: summaryOfNode(id) }, 'figure', id, { avoid: figRef.current })
    bus.setHover(id)
  }
  const leave = (id: string) => { hide(); bus.endHover(id) }

  return (
    <div ref={figRef} data-relations-figure={centre} style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
      <svg viewBox="-210 -160 420 320" style={{ width: '100%', maxHeight: 264 }} role="img" aria-label="relationships">
        <g pointerEvents="none">
          {nodes.flatMap((sn) => {
            const len = Math.hypot(sn.x, sn.y) || 1
            const ux = sn.x / len, uy = sn.y / len
            const lit = hoverId === sn.id
            const dim = !!hoverId && hoverId !== sn.id && ids.has(hoverId)
            const ax = ux * 19, ay = uy * 19
            const bx = ux * (len - 13), by = uy * (len - 13)
            return sn.spokes.map((s, i) => {
              const bow = sn.spokes.length === 1 ? 0 : (i - (sn.spokes.length - 1) / 2) * 38
              const cx = (ax + bx) / 2 - uy * bow
              const cy = (ay + by) / 2 + ux * bow
              const head = s.dir === 'out' ? { x: bx, y: by } : s.dir === 'in' ? { x: ax, y: ay } : null
              const deg = head ? (Math.atan2(head.y - cy, head.x - cx) * 180) / Math.PI : 0
              return (
                <g key={s.key} data-relationspoke={s.key} opacity={dim ? 0.2 : 1} style={{ transition: 'opacity 120ms' }}>
                  <path d={`M${ax},${ay} Q${cx},${cy} ${bx},${by}`} fill="none" stroke="#ffffff" strokeWidth={3.6} strokeOpacity={0.8} />
                  <path d={`M${ax},${ay} Q${cx},${cy} ${bx},${by}`} fill="none" stroke={EDGE_COLOR[s.type]} strokeWidth={lit ? 2.4 : 1.6} strokeOpacity={0.9} />
                  {head && <path d="M0,0 L-5,2.6 L-5,-2.6 Z" transform={`translate(${head.x} ${head.y}) rotate(${deg})`} fill={EDGE_COLOR[s.type]} />}
                </g>
              )
            })
          })}
        </g>
        {hoverId === centre && <circle cx={0} cy={0} r={21} fill={colorOf(centre)} fillOpacity={0.18} pointerEvents="none" />}
        <circle data-relations-center={centre} cx={0} cy={0} r={15} fill="#ffffff" stroke={colorOf(centre)} strokeWidth={3} />
        {nodes.map((sn) => {
          const lit = hoverId === sn.id
          const dim = !!hoverId && hoverId !== sn.id && ids.has(hoverId)
          return (
            <circle
              key={sn.id} data-relations-node={sn.id} cx={sn.x} cy={sn.y} r={9} fill={fillOf(sn.id)} stroke={colorOf(sn.id)}
              strokeWidth={lit ? 3.4 : 2} opacity={dim ? 0.25 : 1} style={{ cursor: 'pointer', transition: 'opacity 120ms' }}
              onMouseEnter={(e) => enter(e, sn.id)} onMouseLeave={() => leave(sn.id)}
            />
          )
        })}
      </svg>
    </div>
  )
}

export default function DocumentPanel({ bus }: { bus: Bus }) {
  const currentId = bus.focus ?? null
  const onActivateWalkAtStop = bus.activateWalk

  const [paneW, paneBox] = usePaneWidth()
  const [railOpen, setRailOpen] = useState(true)
  const [railW, setRailW] = useState<number | null>(null)

  const node = currentId && byId.has(currentId) ? byId.get(currentId)! : null
  const drawnRail = relationsRailWidth(paneW, railW)
  const cardW = node ? previewGutter(paneW, drawnRail) : undefined

  // #16: authored walks count as walks through here too — that is the whole
  // point of a desk that can save one.
  const walks = useSyncExternalStore(subscribeWalks, listWalks)

  const throughWalks = node
    ? walks.flatMap((w) => {
        const idx = w.stops.findIndex((s) => s.id === currentId)
        return idx >= 0 ? [{ walk: w, idx }] : []
      })
    : []
  const ancestry = node ? pathTo(node.id).map((id) => byId.get(id)!.title).join(' / ') : ''

  return (
    <NodePreviewLayer width={cardW}>
      {({ show, hide }) => (
        <div ref={paneBox} aria-label="document-panel" style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
          <PaneScroller style={{ padding: '0 var(--space-3)' }}>
            {node ? (
              <>
                <DocHeader kind={node.topic ? 'topic' : node.kind} title={node.title} domain={topicHueOf(currentId!) ?? ''} ancestry={ancestry} />

                {/* OB-143: the body's text starts under the legend's first letter — LEFT only, by the
                    constant. The right padding is the scrollbar's and stays. DocHeader above pads its
                    own --space-5 (20) and is not touched: it is a DS component, and 20 against 21 is
                    inside the clause's ±1px. */}
                <div className="pr-4 py-3 text-[12px] leading-relaxed text-slate-700 border-b border-slate-100" style={{ paddingLeft: LEGEND_INSET }}>{DOC_BODY[currentId!]}</div>

                <div className="pr-4 py-3" style={{ paddingLeft: LEGEND_INSET }}>
                  <SectionLabel count={throughWalks.length}>walks through here</SectionLabel>
                  {throughWalks.length === 0 ? (
                    <div className="text-[11px] text-slate-400">no authored walk stops here</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {throughWalks.map(({ walk, idx }) => (
                        <WalkCard
                          key={walk.id}
                          title={walk.title}
                          meta={`stop ${idx + 1} of ${walk.stops.length} — ${walk.stops[idx].note}`}
                          onClick={() => onActivateWalkAtStop(walk.id, idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </PaneScroller>
          {/* `data-relations-rail` is a test hook (attributes only), the same precedent the Explorer
              rail's `data-explorer-rail` set. The rail carries the figure and its reading; nothing in it
              draws while the pane is unaimed (OB-209). */}
          <div data-relations-rail="1" style={{ display: 'flex', minHeight: 0, flex: '0 0 auto' }}>
            <RelationsRail open={railOpen} onOpenChange={setRailOpen} paneW={paneW} width={railW} onWidthChange={setRailW}>
              {() => (node ? (
                <>
                  <RelationsFigure currentId={currentId!} bus={bus} show={show} hide={hide} />
                  <div data-relations-reading="" style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-2)' }}>
                    {neighbourhoodReading(currentId!)}
                  </div>
                </>
              ) : null)}
            </RelationsRail>
          </div>
        </div>
      )}
    </NodePreviewLayer>
  )
}
