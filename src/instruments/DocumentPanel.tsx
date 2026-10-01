// Document — the current node's document (named KnowledgePanel.tsx until
// 2026-08-20). Reading happens here; the other instruments are for moving.
//
// IT IS PROSE BESIDE A RELATIONS RAIL (#342, OB-229/230/235/242 — step three of the dissolution).
// What a node is RELATED to is read while reading, so it became a rail on this pane instead of a
// column of the Connections pane: a figure of the neighbourhood, and under it a READING of the
// neighbourhood — counts, kinds, direct against indirect — that says something about it rather
// than listing it. THERE IS NO STANDING LIST OF CARDS. The relationship card is a HOVER: pointing
// at a mark opens it over the PROSE (never over the figure being pointed at) on this pane's one
// `NodePreviewLayer`, and the same pointing lights the matching road on the map — and the map
// lights the figure back. The rail's whole contract is in the DS's `RelationsRail`; what stays
// HERE is the one piece it cannot own: the card, and what the hover lights.
//
// THE CENTRE IS ALWAYS THE DOCUMENT'S NODE. The figure, the prose and the map's selection read
// one id and cannot disagree about what is being read; the hub is not a third piece of state.
//
// CLEARING A SELECTION DOES NOT BLANK THE PAGE BEING READ (OB-240 clause 2, #386). The Explorer's
// de-select, a click on empty water and Esc on the map all turn the HIGHLIGHT off — the tree pill
// and the map's ring — and the pane keeps the last node that was selected, because a gesture about
// the highlight must not take the prose away. The pane remembers that node in its own state.
//
// A PANE THAT HAS NEVER HAD A SELECTION IS EMPTY, NOT THE CORPUS ROOT (OB-209 clause 4). With no
// node to remember it draws `PanePlaceholder` — the pane used to fall back to the root, which read
// as though the root had been chosen. A hover on a MAP CELL previews that node's document here
// while nothing is selected (`PreviewBanner`, mounted always so the pane never reflows under a
// cursor that is somewhere else) and the pane returns to the remembered node, or to the
// placeholder when there is none, when the cursor leaves. A selection pins the pane. The
// pointer-inside test exists because the pane now has hoverable content of its own, and must
// never re-aim itself at its own cursor.
//
// The one navigation aid besides the rail is "Walks through here" — walks-as-content, made visible
// instead of staying implicit history. The radial neighborhood diagram that used to sit above the
// lists is its own Studio instrument (NeighborhoodPanel); the CONTAINMENT list left with the
// Explorer rail on the map (#341).
//
// Walks only resolve for topics: a Walk's stops are always topic ids (see
// walks.ts) — nodes above the topic level (domains, modules) and below it
// (deep layers) just show the document, which is honest: that IS all they have.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import {
  DocHeader, groupViaBySource, LEGEND_INSET, NodePreviewCard, NodePreviewLayer, orbitBox, ORBIT_SELF,
  PaneScroller, PanePlaceholder, PreviewBanner, previewGutter, railFits, REL_CARD_PARTS, relationLook,
  RelationsRail, RelationsRailCorner, relationStats, RelSourceGroup, SectionLabel, usePaneWidth,
  viaSourceDomain, WalkCard,
} from '@/ds'
import type { PreviewController, Relation, RelItem } from '@/ds'

import { byId, pathTo, topicHueOf } from '../corpus/graph'
import { DOC_BODY } from '../corpus/docs'
import { listWalks, subscribeWalks } from '../state/walkstore'
import type { Bus } from '../state/bus'
import { summaryOfNode } from './corpustree'
import { cardRelationsOf, neighbourhoodOf, neighbourLitBy, ORBIT_CARD_PAD_X, orbitCardWidths, orbitKeyParts } from './relations'
import type { Neighbourhood } from './relations'

/** the slice of the bus the document reads and writes — the rail's figure publishes a target on the
 *  hover channel and the hub on the centre's own (OB-230), and a foreign hover previews a node here */
type DocumentPanelBus = Pick<Bus, 'focus' | 'hover' | 'activateWalk' | 'setHover' | 'endHover' | 'setHoverCenter'>

/** the pane's width when nothing has measured it yet — the same fallback the DS shell sizes its card
 *  with, so the first frame's card is the size a measured one usually is */
const UNMEASURED_PANE_W = 444

/** the sentence-form header the hover card wears (OB-242) — mounted through the DS's published
 *  parts, so the wording and the plural are the component's and no call site carries either */
const GroupHeader = REL_CARD_PARTS.GroupHeader

const NO_NEIGHBOURS: Neighbourhood = { direct: [], via: [] }

/** what the layer hands the relationship card: the figure's key, the node the pane is reading, and
 *  the width the pane sized the card to (its gutter) */
interface OrbitCardProps {
  hotKey: string
  focusId: string
  boxW: number
}

/** THE CARD THE FIGURE'S HOVER OPENS — handed to the pane's `NodePreviewLayer` as its `card`, so
 *  the clamp, the layer and the placement are the shared ones and only the CONTENTS differ. A mark
 *  opens the card for THAT relationship; a neighbour opens it for every relationship with that
 *  neighbour; the hub opens the node's own document preview instead — the hub is the node, not a
 *  relationship of it. The card takes no pointer (the layer makes it transparent), which is why
 *  what the hover lights on the map follows the FIGURE's key and not this card. */
function OrbitCard({ hotKey, focusId, boxW }: OrbitCardProps) {
  const n = byId.get(focusId)
  if (!n) return null
  const domain = topicHueOf(focusId)
  if (hotKey === ORBIT_SELF) {
    return <div data-orbit-card="hub"><NodePreviewCard domain={domain} title={n.title} summary={summaryOfNode(focusId)} /></div>
  }
  const { direct, via } = cardRelationsOf(focusId, hotKey)
  if (!direct.length && !via.length) return null
  const { pill, arrow } = orbitCardWidths(boxW)
  const itemOf = (rel: Relation, key: string): RelItem => {
    const look = relationLook(rel)
    return { key, targetId: rel.targetId, targetTitle: rel.targetTitle, targetDomain: rel.targetDomain, kindLabel: look.label, kindColor: look.color, heads: look.heads }
  }
  return (
    <div data-orbit-card="rel" style={{
      width: boxW, boxSizing: 'border-box', background: 'var(--surface-raised)', border: '1px solid var(--border-rule)',
      borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: '4px ' + ORBIT_CARD_PAD_X + 'px 8px',
    }}>
      {direct.length ? (
        <>
          <GroupHeader sentence label="direct" count={direct.length} />
          <RelSourceGroup sourceLabel={n.title} sourceDomain={domain} sourceIsCenter leftWidth={pill} rightWidth={pill} arrowWidth={arrow}
            items={direct.map((r) => itemOf(r, r.id))} />
        </>
      ) : null}
      {via.length ? (
        <>
          <GroupHeader sentence label="via children" count={via.length} />
          {groupViaBySource(via).map((g) => (
            <RelSourceGroup key={g.key} sourceLabel={g.node.title} sourcePathParts={g.pathParts} sourceDomain={viaSourceDomain(g.node, domain)}
              leftWidth={pill} rightWidth={pill} arrowWidth={arrow}
              items={g.items.map((v, i) => itemOf(v.rel, v.rel.id + '-' + i))} />
          ))}
        </>
      ) : null}
    </div>
  )
}

interface DocumentBodyProps {
  bus: DocumentPanelBus
  /** the node the pane is reading, or null with nothing chosen */
  currentId: string | null
  /** the node a foreign hover is previewing, or null — only while nothing is selected */
  previewId: string | null
  /** the pane's measured width */
  paneW: number
  railOpen: boolean
  onRailOpenChange: (open: boolean) => void
  /** the seam's stored drag width, or null for the rail's own fit */
  railW: number | null
  onRailWChange: (width: number | null) => void
  /** the width the hover card is sized to — the prose gutter beside the figure */
  cardW: number
  /** the pane's one preview layer */
  layer: PreviewController<OrbitCardProps>
}

/** EVERYTHING THAT READS THE NODE, in a component of its own so the layer above can key it on the
 *  node: a new node is a new document, and a hover card or a lit road left over from the LAST one
 *  would be lying about this one. It is the layer's child, because `show`/`hide`/`hovered` only
 *  exist inside it. */
function DocumentBody({ bus, currentId, previewId, paneW, railOpen, onRailOpenChange, railW, onRailWChange, cardW, layer }: DocumentBodyProps) {
  const { show, hide, hovered } = layer
  const { setHover, endHover, setHoverCenter } = bus
  const walks = useSyncExternalStore(subscribeWalks, listWalks)
  const figRef = useRef<HTMLDivElement | null>(null)
  /* the id THIS pane last put on the bus's hover channel, so it can take back exactly its own
     write — `endHover` is guarded by id, and a hover another pane has since published is not ours
     to clear */
  const litRef = useRef<string | null>(null)
  const node = currentId ? byId.get(currentId) : undefined
  const hood = useMemo(() => (currentId ? neighbourhoodOf(currentId) : NO_NEIGHBOURS), [currentId])
  const relCount = useMemo(() => relationStats(hood.direct, hood.via).relationships, [hood])

  /* THE FIGURE LIGHTS THE MAP (DS OB-230, two channels and not one). A relationship or a neighbour
     publishes the TARGET's id on the hover channel, which lights that one road and the target's
     cell and dims the rest; the hub publishes on the CENTRE's own channel and lights only the
     centre. Publishing the hub's id on the hover channel would light every road at once — the
     highlight would then say only "something is hovered". Leaving publishes nothing, and takes
     back only what this pane wrote. */
  const light = (key: string | null) => {
    const targetId = key ? orbitKeyParts(key).targetId : null
    setHoverCenter(key === ORBIT_SELF)
    const prev = litRef.current
    if (prev && prev !== targetId) endHover(prev)
    if (targetId) setHover(targetId)
    litRef.current = targetId
  }
  /* A HIGHLIGHT THAT OUTLIVES ITS HOVER IS THE FAILURE TO TEST FOR, and it is invisible in a still.
     The figure can be unmounted under the pointer (the node changes, the rail closes) and an
     unmounted element fires no leave — so whatever this pane lit is taken back here. */
  useEffect(() => () => {
    if (litRef.current) endHover(litRef.current)
    setHoverCenter(false)
  }, [endHover, setHoverCenter])
  /* ...and the rail closing does not unmount THIS component, only the figure inside it: the close
     button pressed from the keyboard, or the pane narrowed past the rail's floor with the pointer
     resting on a mark. `railFits` is the very call the frame makes to hide it. */
  const figureShown = railOpen && railFits('right', paneW)
  useEffect(() => {
    if (figureShown) return
    hide()
    if (litRef.current) endHover(litRef.current)
    litRef.current = null
    setHoverCenter(false)
  }, [figureShown, hide, endHover, setHoverCenter])

  const previewNode = previewId && byId.get(previewId)
    ? { id: previewId, title: byId.get(previewId)!.title, domain: topicHueOf(previewId) }
    : null

  if (!currentId || !node) {
    return (
      <>
        {/* the row is mounted always, so the pane's first element sits at the same height with
            nothing chosen as with a preview on screen */}
        <PreviewBanner node={null} style={{ padding: '0 var(--space-5)' }} />
        <PanePlaceholder
          state="Nothing chosen"
          gesture="Point at a cell on the map to read its document, or click to keep it here."
          style={{ flex: 1, margin: '0 var(--space-3) var(--space-3)' }}
        />
      </>
    )
  }

  const ancestry = pathTo(currentId)
    .map((id) => byId.get(id)!.title)
    .join(' / ')
  // #16: authored walks count as walks through here too — that is the whole
  // point of a desk that can save one.
  const throughWalks = walks.flatMap((w) => {
    const idx = w.stops.findIndex((s) => s.id === currentId)
    return idx >= 0 ? [{ walk: w, idx }] : []
  })

  /* WHAT IS POINTED AT, AS THE FIGURE'S KEY: its own pointer's, or — with the pointer elsewhere —
     the neighbour a cell on the MAP is on (the reverse of lighting the map). The map's hover lights
     a mark WITHOUT opening the card: the card belongs to the figure's own pointer. */
  const figureHot = hovered && hovered.source === 'orbit' ? hovered.id : null
  const hot = figureHot ?? neighbourLitBy(bus.hover, hood)

  return (
    <>
      {/* OB-209: mounted unconditionally, first in the pane, above the header */}
      <PreviewBanner node={previewNode} style={{ padding: '0 var(--space-5)' }} />
      {/* THE UPPER ROW SPANS THE PANE, and the rail sits UNDER it. With the header inside the prose
          column the rail started above the title of the thing it is about and scrolled away with
          the text, leaving the figure with nothing on screen naming its centre. The rail's way back
          sits at this row's outer end, which is the corner it occupies when open. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <DocHeader kind={node.topic ? 'topic' : node.kind} title={node.title} domain={topicHueOf(currentId) ?? ''} ancestry={ancestry} />
        </div>
        <RelationsRailCorner paneW={paneW} open={railOpen} onOpenChange={onRailOpenChange} count={relCount} style={{ flex: '0 0 auto', margin: '14px var(--space-3) 0 0' }} />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
        {/* the prose scrolls under the header: no top inset, because the scroller starts far from
            the pane's corner arc — the bottom inset stays, it is the scrollbar's */}
        <PaneScroller data-document-prose="1" style={{ flex: '1 1 260px', minWidth: 200, marginTop: 0 }}>
          {/* OB-143: the body's text starts under the legend's first letter — LEFT only, by the
              constant. The right padding is the scrollbar's and stays. DocHeader above pads its
              own --space-5 (20) and is not touched: it is a DS component, and 20 against 21 is
              inside the clause's ±1px. */}
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
                    onClick={() => bus.activateWalk(walk.id, idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </PaneScroller>
        <RelationsRail
          direct={hood.direct} via={hood.via} paneW={paneW} closedControl="host"
          railOpen={railOpen} onRailOpenChange={onRailOpenChange}
          width={railW} onWidthChange={onRailWChange}
          figureRef={figRef} hot={hot}
          onHot={(key, e) => {
            if (key && e) show(e, { hotKey: key, focusId: currentId, boxW: cardW }, 'orbit', key, { avoid: figRef.current })
            else hide()
            light(key)
          }}
        />
      </div>
    </>
  )
}

export default function DocumentPanel({ bus }: { bus: DocumentPanelBus }) {
  // IS THE POINTER IN THIS PANE? The preview below answers FOREIGN cursors only: this pane now has
  // hoverable content of its own, and it must never re-aim itself at the cursor standing in it.
  // Two ordinary pointer handlers on our own root answer the question with no synchronisation.
  const [pointerInside, setPointerInside] = useState(false)

  // THE LAST NODE SELECTED, which is what the pane rests on once the selection is cleared (OB-240
  // clause 2). It is kept in state and updated DURING RENDER, React's own pattern for state that
  // follows a prop: an effect would paint one frame of the placeholder between the clear and the
  // update, and `react-hooks/refs` forbids the ref that would avoid the effect. The guard makes it
  // a no-op on every render but the one where the selection moved.
  const [lastFocus, setLastFocus] = useState<string | null>(null)
  if (bus.focus != null && bus.focus !== lastFocus) setLastFocus(bus.focus)

  // A selection pins the pane. With NOTHING selected a foreign hover previews that node here, and
  // the pane goes back to the last node selected when the cursor moves off — or to the placeholder
  // when nothing has been, so `focus ?? preview ?? last` is the whole answer.
  const previewId = bus.focus == null && !pointerInside && bus.hover != null && byId.has(bus.hover) ? bus.hover : null
  const currentId = bus.focus ?? previewId ?? lastFocus

  // the rail starts OPEN. The Explorer starts closed only because opening it narrowed the map until
  // two labels met; nothing narrows here. The seam's width is a stored TARGET, null until dragged —
  // the rail clamps it every render and only what it reports is stored.
  const [railOpen, setRailOpen] = useState(true)
  const [railW, setRailW] = useState<number | null>(null)
  const [paneW, paneBox] = usePaneWidth()
  // THE CARD IS SIZED TO THE GUTTER IT SITS IN, not to a constant: anchoring it beside the figure
  // is only half of clearing the figure — a 268px card in a 219px gutter still overhangs it by 49.
  // The figure's box is the rail's own number, published for exactly this.
  const cardW = previewGutter(paneW || UNMEASURED_PANE_W, orbitBox(paneW, railW).width)

  return (
    <div
      ref={paneBox} aria-label="document-panel" data-current={currentId ?? undefined} data-preview={previewId ?? undefined}
      onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => setPointerInside(false)}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}
    >
      {/* ONE LAYER PER PANE. Keyed on the node so a card left up by the LAST node cannot outlive it. */}
      <NodePreviewLayer key={currentId ?? 'none'} card={OrbitCard} width={cardW} style={{ flexDirection: 'column', minWidth: 0 }}>
        {(layer: PreviewController<OrbitCardProps>) => (
          <DocumentBody
            bus={bus} currentId={currentId} previewId={previewId} paneW={paneW}
            railOpen={railOpen} onRailOpenChange={setRailOpen} railW={railW} onRailWChange={setRailW}
            cardW={cardW} layer={layer}
          />
        )}
      </NodePreviewLayer>
    </div>
  )
}
