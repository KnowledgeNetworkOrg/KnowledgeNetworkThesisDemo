// Document — the current node's document (named KnowledgePanel.tsx until
// 2026-08-20). Reading happens here; the other instruments are for moving. The one
// navigation aid in the prose is "Walks through here" — walks-as-content, made visible
// instead of staying implicit history. The radial neighborhood diagram that used to sit
// above the lists is its own Studio instrument (NeighborhoodPanel).
//
// THE RELATIONS RAIL (#342 — DS OB-229, OB-230, OB-235, OB-242). Relationships are read
// WHILE reading, so the dissolved Connections pane's relations column moved here as a rail
// on the pane's right edge that hides and comes back. It is the DS's `RelationsRail`, whole:
// a figure (`RelationOrbit` — angle is the kind, radius is the hop) over a READING of the
// neighbourhood (`RelationStats` — two totals, the hop split, a bar per kind). It is NOT a
// list: the standing card list is what the rail replaced, and the card is now the hover,
// opened by this pane over the PROSE on its own `NodePreviewLayer`. The pane owns four
// things the rail's contract leaves to the host: the centre (always the node this pane is
// reading), the card, what a hover lights on the map, and the pane's measured width.
//
// NOTHING CHOSEN IS A PLACEHOLDER, NOT THE LAST NODE (DS OB-209, owner-ruled 2026-09-17).
// With nothing selected and nothing hovered no node is read: "just opened" and "just
// de-selected" are one state and look the same. The pane used to fall back to the corpus
// root here, which drew a document nobody chose. And a FOREIGN hover — a map cell, an
// Explorer pill — previews its node here while nothing is selected, under a `PreviewBanner`
// that is always mounted so a preview arriving or leaving never moves the prose.
//
// Walks only resolve for topics: a Walk's stops are always topic ids (see walks.ts) —
// nodes above the topic level (domains, modules) and below it (deep layers) just show the
// document, which is honest: that IS all they have.

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'

import {
  connectionsHighlight, DocHeader, LEGEND_INSET, NodePreviewLayer, ORBIT_SELF, orbitBox, PanePlaceholder, PaneScroller,
  previewGutter, PreviewBanner, railFits, REL_CARD_METRICS, REL_CARD_PARTS, relationLook, RelationsRail,
  RelationsRailCorner, RelSourceGroup, SectionLabel, StopCard, usePaneWidth, viaSourceDomain, WalkCard,
} from '@/ds'
import type { Relation, RelItem, ViaRelation } from '@/ds'

import { byId, pathTo, topicHueOf } from '../corpus/graph'
import { DOC_BODY } from '../corpus/docs'
import { stopPlacement } from '../state/walk/stoppreview'
import { listWalks, subscribeWalks } from '../state/walkstore'
import type { Bus } from '../state/bus'
import { relationsOfNode, viaRelationsOf } from './corpusrelations'

const NO_DIRECT: Relation[] = []
const NO_VIA: ViaRelation[] = []

/** the widest a relationship card's pills may draw — CHOSEN by the DS's reference shell for the
 *  orbit's card (`templates/studio/StudioApp.jsx`, `OrbitCard`), which is narrower than a list
 *  row's `pillMax`: the card holds one relationship in a gutter, not a column of them */
const CARD_PILL_MAX = 88

/** THE KEY THE FIGURE IS LIVE ON, for the card to check itself against. The layer keeps the
 *  card it was last shown until the next `show`/`hide`, and two things can end a hover without
 *  the figure ever reporting a leave: the pane moving to another node (a walk stepping on), and
 *  the rail closing or losing its room. A card that outlives its hover is the failure OB-230
 *  names, so the card draws only while this still says it is the one being pointed at. */
const LiveOrbitKey = createContext<string | null>(null)

/** what the card is raised with: the figure's key, the node it was raised FOR, and its box */
interface OrbitCardProps {
  hotKey: string
  centreId: string
  boxW: number
}

function relItems(rels: readonly Relation[]): RelItem[] {
  return rels.map((r, i) => {
    const L = relationLook(r)
    return { key: r.id + '-' + i, targetId: r.targetId, targetTitle: r.targetTitle, targetDomain: r.targetDomain, kindLabel: L.label, kindColor: L.color, heads: L.heads }
  })
}

/** via-children rows by the descendant that holds them — one source pill per child, the same
 *  grouping `RelationCards` draws its via list in */
function byHolder(rows: readonly ViaRelation[]) {
  const map = new Map<string, { key: string; node: ViaRelation['path'][number]; pathParts: string[]; rels: Relation[] }>()
  for (const v of rows) {
    const key = v.path.map((p) => p.id).join('/')
    let g = map.get(key)
    if (!g) {
      g = { key, node: v.path[v.path.length - 1], pathParts: v.path.slice(0, -1).map((p) => p.title), rels: [] }
      map.set(key, g)
    }
    g.rels.push(v.rel)
  }
  return [...map.values()]
}

/** THE CARD THE FIGURE'S HOVER OPENS — handed to the pane's `NodePreviewLayer` as its `card`, so
 *  the clamp and the placement are the shared ones and only the contents differ (OB-229 clause 2).
 *  A relationship (`<id>|<kind>`) opens the card for THAT relationship, a neighbour (`<id>`) for
 *  every relationship with it, and the hub (`ORBIT_SELF`) the centred node's own DOCUMENT card
 *  (`StopCard`, the one a walk stop previews with), not a relationship card.
 *  The relationship card is the DS's own: `RelSourceGroup` under `REL_CARD_PARTS.GroupHeader`,
 *  whose `sentence` form owns the wording and the plural (OB-242) — nothing here counts in words. */
function OrbitCard({ hotKey, centreId, boxW }: OrbitCardProps) {
  const live = useContext(LiveOrbitKey)
  const n = byId.get(centreId)
  if (live !== hotKey || !n) return null
  if (hotKey === ORBIT_SELF) {
    return <StopCard title={n.title} ancestry={stopPlacement(centreId) || undefined} body={DOC_BODY[centreId] || undefined} style={{ width: boxW }} />
  }
  const bar = hotKey.indexOf('|')
  const id = bar < 0 ? hotKey : hotKey.slice(0, bar)
  const kindOnly = bar < 0 ? null : hotKey.slice(bar + 1)
  const keep = (r: Relation) => r.targetId === id && (kindOnly == null || r.kind === kindOnly)
  const direct = relationsOfNode(centreId).filter(keep)
  const via = viaRelationsOf(centreId).filter((v) => keep(v.rel))
  if (!direct.length && !via.length) return null
  /* THE CARD'S OWN ROW BUDGET, solved backward from the box it is given — the shell's
     derivation, with the card's own border and padding (1 + 10 each side) taken off first */
  const RM = REL_CARD_METRICS
  const avail = boxW - 22 - RM.rowPad * 2 - RM.rowGap * 2
  const pill = Math.max(RM.pillMin, Math.min(CARD_PILL_MAX, Math.floor((avail - RM.groupChrome - RM.arrowMin) / 2)))
  const arrowW = Math.max(RM.arrowMin, avail - RM.groupChrome - pill * 2)
  const centreDomain = topicHueOf(centreId)
  const Header = REL_CARD_PARTS.GroupHeader
  return (
    <div data-orbit-card={hotKey} style={{
      width: boxW, boxSizing: 'border-box', background: 'var(--surface-raised)', border: '1px solid var(--border-rule)',
      borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: '4px 10px 8px',
    }}>
      {direct.length ? (
        <>
          <Header sentence label="direct" count={direct.length} />
          <RelSourceGroup
            sourceLabel={n.title} sourceDomain={centreDomain} sourceIsCenter items={relItems(direct)}
            leftWidth={pill} rightWidth={pill} arrowWidth={arrowW}
          />
        </>
      ) : null}
      {via.length ? (
        <>
          <Header sentence label="via children" count={via.length} />
          {byHolder(via).map((h) => (
            <RelSourceGroup
              key={h.key} sourceLabel={h.node.title} sourcePathParts={h.pathParts} sourceDomain={viaSourceDomain(h.node, centreDomain)}
              items={relItems(h.rels)} leftWidth={pill} rightWidth={pill} arrowWidth={arrowW}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

export default function DocumentPanel({ bus }: { bus: Bus }) {
  // the STABLE writers, by name — `bus` itself is a fresh object every render
  const { setHover, endHover, setHoverCenter } = bus
  const onActivateWalkAtStop = bus.activateWalk

  // IS THE POINTER IN THIS PANE? The preview below answers FOREIGN hovers only, and this pane
  // now publishes hovers of its own (the figure lights the map), so without this it would
  // re-aim itself at its own cursor. The same expression the Connections pane arrived at, which
  // is what OB-209 asked for the day this pane grew something hoverable.
  const [pointerInside, setPointerInside] = useState(false)

  // WHAT IS READ (OB-209 clauses 2 and 4). A selection pins the pane. With nothing selected, a
  // foreign hover previews its node and leaving it returns to NOTHING — no resting node, no
  // corpus-root fallback: "nothing chosen" is a state of its own, drawn as a placeholder.
  const focusId = bus.focus != null && byId.has(bus.focus) ? bus.focus : null
  const previewId = focusId == null && !pointerInside && bus.hover != null && byId.has(bus.hover) ? bus.hover : null
  const currentId = previewId ?? focusId

  // THE RAIL'S STATE IS THE PANE'S: open (the user's to close), the seam's stored drag width
  // (OB-253 — null until dragged, which is the rail's own fit; persisting it is OB-255, #368),
  // and the pane's measured width, through the published hook (OB-238 done-when 2).
  const [railOpen, setRailOpen] = useState(true)
  const [relW, setRelW] = useState<number | null>(null)
  const [paneW, paneBox] = usePaneWidth()
  // the figure's wrapper, so the card can be kept off the drawing — state rather than a ref:
  // the element is read inside the figure's hover handler, which the render hands down
  const [figEl, setFigEl] = useState<HTMLDivElement | null>(null)
  // what the figure's pointer is on, and the node it was on it FOR (see `LiveOrbitKey`)
  const [orbitHot, setOrbitHot] = useState<{ key: string; centre: string } | null>(null)

  // THE CENTRE IS THE DOCUMENT'S NODE, always (OB-229 clause 1) — not a third piece of state.
  // Both lists are stable per id, so the figure's and the chart's memos hold across renders.
  const direct = currentId ? relationsOfNode(currentId) : NO_DIRECT
  const via = currentId ? viaRelationsOf(currentId) : NO_VIA
  const railShown = currentId != null && railOpen && railFits('right', paneW)
  const hotKey = railShown && orbitHot && orbitHot.centre === currentId ? orbitHot.key : null

  // TWO CHANNELS OUT, NOT ONE (OB-230), resolved by the published arbitration rather than a
  // local expression. A relationship or a neighbour lights THAT node on the map — its cell and
  // the road to it — through the bus's hover; the hub lights the map's selection through the
  // bus's separate centre channel. Folding the hub into `hover` would light every road around
  // the selection at once. Each effect's cleanup is the leave: moving off, a node change, the
  // rail closing and the pane unmounting all drop the light, so none can outlive its hover.
  const lit = connectionsHighlight({
    aimId: currentId,
    graphHoverId: hotKey == null ? null : hotKey === ORBIT_SELF ? 'focus' : hotKey.split('|')[0],
  })
  const litId = lit.highlightId
  const litCentre = lit.centerHighlight
  useEffect(() => {
    if (!litId) return
    setHover(litId)
    return () => endHover(litId)
  }, [litId, setHover, endHover])
  useEffect(() => {
    if (!litCentre) return
    setHoverCenter(true)
    return () => setHoverCenter(false)
  }, [litCentre, setHoverCenter])

  // AND ONE CHANNEL IN: the map lights the figure. A foreign hover on one of this node's
  // NEIGHBOURS lights that neighbour's marks (all of them — both kinds of a twin pair), and a
  // hover on the node itself lights the hub. It lights and stops there: no card opens for a
  // hover that is somewhere else. Never while the pointer is in this pane — the bus's hover is
  // then this pane's own, echoing back.
  const foreign = !pointerInside && currentId && bus.hover ? bus.hover : null
  const foreignKey = foreign == null
    ? null
    : foreign === currentId
      ? ORBIT_SELF
      : direct.some((r) => r.targetId === foreign) || via.some((v) => v.rel.targetId === foreign) ? foreign : null
  const figureHot = hotKey ?? foreignKey

  // THE CARD IS SIZED TO THE GUTTER IT WILL SIT IN (OB-229 clause 3) — the figure's box is the
  // rail's own number at the SAME stored width, so the card is sized against the figure the rail
  // is actually drawing. Anchoring beside the figure alone still overhangs it.
  const cardW = previewGutter(paneW || 444, orbitBox(paneW, relW).width)

  const walks = useSyncExternalStore(subscribeWalks, listWalks)
  const n = currentId ? byId.get(currentId)! : null
  const ancestry = currentId
    ? pathTo(currentId)
        .map((id) => byId.get(id)!.title)
        .join(' / ')
    : ''
  // #16: authored walks count as walks through here too — that is the whole point of a desk
  // that can save one.
  const throughWalks = currentId
    ? walks.flatMap((w) => {
        const idx = w.stops.findIndex((s) => s.id === currentId)
        return idx >= 0 ? [{ walk: w, idx }] : []
      })
    : []

  return (
    <LiveOrbitKey.Provider value={hotKey}>
      <NodePreviewLayer<OrbitCardProps> card={OrbitCard} width={cardW}>
        {({ show, hide }) => (
          <div
            ref={paneBox} aria-label="document-panel" data-doc-current={currentId ?? ''}
            onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => setPointerInside(false)}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}
          >
            {/* THE PREVIEW ROW IS ALWAYS MOUNTED (OB-209 clause 1 / PreviewBanner rule 1): it
                reserves its own height, so a preview arriving or leaving under a cursor that is
                on the map never reflows the prose. Aligned under the legend's first letter. */}
            <PreviewBanner
              node={previewId ? { id: previewId, title: byId.get(previewId)!.title, domain: topicHueOf(previewId) } : null}
              style={{ padding: '0 var(--space-3) 0 ' + LEGEND_INSET + 'px' }}
            />
            {n == null || currentId == null ? (
              /* NOTHING CHOSEN (OB-209 clause 6): the placeholder INSTEAD OF the head, the body,
                 the walks and the rail — every one of them reads a node, and there is none. A
                 head with nothing under it reads as a load failure, and the rail's own empty
                 state ("No relationships") would say something false about a node nobody chose. */
              <div data-doc-empty="1" style={{ padding: '8px var(--space-3) 0 ' + LEGEND_INSET + 'px' }}>
                <PanePlaceholder state="Nothing chosen" gesture="Point at a cell on the map to read its document, or click to keep it here." />
              </div>
            ) : (
              <>
                {/* THE DOCUMENT'S UPPER ROW SPANS THE PANE: the rail starts UNDER the title of the
                    thing it is about, and the rail's way back sits at this row's outer end, the
                    corner the open rail occupies (`closedControl="host"`, OB-241). */}
                <div data-doc-head="1" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 'none' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <DocHeader kind={n.topic ? 'topic' : n.kind} title={n.title} domain={topicHueOf(currentId) ?? ''} ancestry={ancestry} />
                  </div>
                  <span data-relations-corner="1" style={{ display: 'contents' }}>
                    <RelationsRailCorner
                      paneW={paneW} open={railOpen} onOpenChange={setRailOpen} count={direct.length + via.length}
                      style={{ flex: '0 0 auto', margin: '14px var(--space-3) 0 0' }}
                    />
                  </span>
                </div>
                <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
                  {/* THE PROSE SCROLLS ON ITS OWN, beside the rail. No top inset: it starts under
                      the head row, not under the frame's rounded corner; the bottom keeps it. */}
                  <PaneScroller data-doc-prose="1" style={{ marginTop: 0, flex: '1 1 260px', minWidth: 0 }}>
                    {/* OB-143: the body's text starts under the legend's first letter — LEFT only,
                        by the constant. The right padding is the scrollbar's and stays. DocHeader
                        above pads its own --space-5 (20) and is not touched: it is a DS component,
                        and 20 against 21 is inside the clause's ±1px. */}
                    <div className="pr-4 py-3 text-[12px] leading-relaxed text-slate-700 border-b border-slate-100" style={{ paddingLeft: LEGEND_INSET }}>{DOC_BODY[currentId]}</div>

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
                  </PaneScroller>
                  {/* THE RAIL IS ONE COMPONENT (OB-238): the figure, the reading under it, the two
                      filters that join them, the header, the handle, the seam and the width floor
                      are all `RelationsRail`'s. What stays HERE is the card and what a hover
                      lights. `data-relations-rail` is a test hook, the Explorer rail's precedent. */}
                  <div data-relations-rail="1" style={{ display: 'flex', minHeight: 0, flex: '0 0 auto' }}>
                    <RelationsRail
                      direct={direct} via={via} paneW={paneW} closedControl="host"
                      railOpen={railOpen} onRailOpenChange={setRailOpen}
                      width={relW} onWidthChange={setRelW}
                      figureRef={setFigEl} hot={figureHot}
                      onHot={(key, e) => {
                        if (key) {
                          setOrbitHot({ key, centre: currentId })
                          show(e, { hotKey: key, centreId: currentId, boxW: cardW }, 'orbit', key, { avoid: figEl })
                        } else {
                          setOrbitHot(null)
                          hide()
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </NodePreviewLayer>
    </LiveOrbitKey.Provider>
  )
}
