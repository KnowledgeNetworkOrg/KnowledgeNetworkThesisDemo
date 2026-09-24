import { useState } from 'react'
import type { ComponentType, CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

import { topicPaint } from '../graph/DomainDot'

/** THE PREVIEW LAYER'S GEOMETRY. `tipW`/`tipH` are the card's box, which the clamped placement
 *  has to know WITHOUT measuring — the card is placed before it renders, and a measure-then-move
 *  would place it wrong for one frame at the moment the pointer is watching it. `offsetX`/`offsetY`
 *  put its corner clear of the cursor; `inset` is the gap it keeps from the layer's own edges.
 *  All four are CHOSEN, not derived: they are a look, taken from the pane these rails replace, and
 *  carried over unchanged so a reader who knew that pane recognises this card. */
export const PREVIEW_LAYER_METRICS = { tipW: 262, tipH: 112, inset: 4, offsetX: 14, offsetY: 14 }
const LM = PREVIEW_LAYER_METRICS

/** THE HOVER PREVIEW CARD — a one-line stand-in for the node's actual document: topic dot and a
 *  bold title over a hairline, then the summary, or a two-bar skeleton when the corpus has no
 *  summary for it (never invented prose). `contains` is the node's own count line
 *  (`containsSummary(node)`) and is where the contains tree's "N nodes" LIVES since 2026-09-09:
 *  a count is furniture on every pill at rest and an answer on the one node you are pointing at.
 *  Same recipe as `WalkStrip`'s step preview; distinct from `MapTooltip`, which answers "how does
 *  this connect" with count rows — this one answers "what does this say". */
export interface NodePreviewCardProps {
  /** the node's own topic — a domain code or ring hue name; resolves through `topicPaint` */
  domain?: string
  /** the node's name */
  title: string
  /** the node's document opening. With none, the card draws a two-bar SKELETON and never invented
   *  prose: "no description" is a sentence about the corpus that this cannot know */
  summary?: string
  /** the node's count line, `containsSummary(node)`. THIS IS WHERE A CONTAINER'S "N nodes" LIVES
   *  when the tree is drawing a preview — the pill's native title is suppressed in that case, and
   *  a host that leaves both on has one hover raising two answers */
  contains?: string
}

export function NodePreviewCard({ domain, title, summary, contains }: NodePreviewCardProps) {
  const hue = topicPaint(domain).mark
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', top: -7, left: 16, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '7px solid var(--surface-raised)' }} />
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-rule)', borderRadius: 'var(--radius-lg)', padding: '12px 15px', boxShadow: 'var(--lift-2)', minWidth: 200, maxWidth: LM.tipW - 2, fontFamily: 'var(--font-ui)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--fw-bold)', fontSize: 12, color: 'var(--text-1)', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border-hair)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: hue, flexShrink: 0 }} />
          {title}
        </div>
        {summary
          ? <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)' }}>{summary}</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', width: '92%' }} />
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', width: '68%' }} />
            </div>}
        {contains ? <p data-preview-contains style={{ margin: '6px 0 0', color: 'var(--text-2)', fontSize: 10, lineHeight: 1.3 }}>{contains}</p> : null}
      </div>
    </div>
  )
}

/** WHERE A PREVIEW CARD GOES, GIVEN A POINTER AND A BOX TO STAY INSIDE — published because the
 *  rule is one clamp that three surfaces now need and every one of them would otherwise re-derive.
 *
 *  IT SLIDES, IT NEVER FLIPS. Placing the card on the far side of the pointer whenever the maths
 *  said it would not fit put it somewhere different almost every time in a narrow pane (at 370px,
 *  nearly every node), so the card had no settled place to look for. Sliding it back by the few
 *  pixels it overhangs keeps ONE placement everywhere, and the cost — the card sitting under the
 *  cursor's own column near an edge — is smaller than the cost of a card that moves.
 *
 *  `rect` is the layer's own bounding box; the result is in the layer's coordinates, so the card
 *  is positioned absolutely inside it. */
export function previewPlacement(clientX: number, clientY: number, rect: DOMRect, avoid?: DOMRect | null, boxW?: number): { x: number; y: number } {
  const W = boxW || LM.tipW
  const x = clientX - rect.left + LM.offsetX, y = clientY - rect.top + LM.offsetY
  const clampY = (v: number) => Math.max(LM.inset, Math.min(v, rect.height - LM.tipH - LM.inset))
  /* BESIDE A THING, NOT UNDER THE POINTER — the second placement, and it exists because the first
     cannot serve a figure (2026-09-20). A pointer-anchored card clamped to the pane is right for
     a LIST: the rows are the full width, so sliding the card back by its overhang lands it on
     empty pane. It is structurally wrong for a FIGURE in an edge rail: the rail is narrower than
     the card, so the clamp necessarily drags the card inward across the very drawing being
     pointed at — no pointer position in that rail can produce a card that misses it, which is why
     this is an anchor and not a nudge.
     Given `avoid` (the figure's box, in client coordinates) the card takes the LARGER gutter
     beside it and sits against that edge, following the pointer only vertically. THE CALLER MUST
     ALSO SIZE THE CARD TO THAT GUTTER — see `previewGutter`. Anchoring alone does not clear the
     figure: a 268px card in a 219px gutter still overhangs by 49, which is the arithmetic the
     first version of this fix missed. */
  if (avoid) {
    const leftRoom = (avoid.left - rect.left) - LM.inset * 2
    const rightRoom = (rect.right - avoid.right) - LM.inset * 2
    const onLeft = leftRoom >= rightRoom
    const raw = onLeft ? (avoid.left - rect.left) - W - LM.offsetX : (avoid.right - rect.left) + LM.offsetX
    return {
      x: Math.max(LM.inset, Math.min(raw, rect.width - W - LM.inset)),
      y: clampY(clientY - rect.top - LM.tipH / 2),
    }
  }
  return {
    x: Math.max(LM.inset, Math.min(x, rect.width - W - LM.inset)),
    y: clampY(y),
  }
}

/** HOW WIDE A CARD MAY BE IF IT IS TO CLEAR THE THING IT DESCRIBES — the other half of
 *  `avoid`, published because a host that anchors without resizing still covers the figure and
 *  the failure looks identical. Pass the pane's width and the figure's width; take the answer
 *  as the card's box. `min` keeps it from collapsing to nothing in a pane that cannot hold
 *  both, where the honest answer is that the rail should have closed. */
export function previewGutter(paneW: number, figureW: number, min?: number): number {
  return Math.max(min || 180, Math.min(LM.tipW, paneW - figureW - LM.offsetX - LM.inset * 2))
}

/** the controller `NodePreviewLayer` hands its children — the layer owns the hover state,
 *  because the host has nothing to do with it between `show` and `hide`. Generic over the card's
 *  props: node previews are the usual case, a surface that previews something else (the walk's
 *  own `StopCard`) swaps its own shape in */
export interface PreviewController<P = NodePreviewCardProps> {
  /** raise the card. `source` is the surface's own word for itself ('tree', 'graph', 'card'…),
   *  and `id` defaults to `info.id` — pass it when the card's props do not carry one.
   *  `opts.avoid` is the ELEMENT the card must not cover (a figure in an edge rail): the card
   *  then sits in the larger gutter beside it instead of following the pointer horizontally.
   *  An element rather than a rect, because the layer measures on every move anyway */
  show: (e: ReactMouseEvent, info: P, source?: string, id?: string, opts?: { avoid?: Element | null }) => void
  /** drop the card */
  hide: () => void
  /** `{ id, source }` or null — handed back because the host needs it for the one thing the
   *  layer cannot do: deciding what ELSE lights (`connectionsHighlight`) */
  hovered: { id: string; source?: string } | null
}

export interface NodePreviewLayerProps<P = NodePreviewCardProps> {
  /** a FUNCTION receiving the controller — the layer owns the hover state, because the host has
   *  nothing to do with it between `show` and `hide`. A plain node is accepted for a layer that
   *  only needs positioning */
  children: ((c: PreviewController<P>) => ReactNode) | ReactNode
  /** placement from the host — the layer is the pane-wide positioned box */
  style?: CSSProperties
  /** swap the card for a surface that previews something other than a node (the walk's own
   *  `StopCard`, say). The placement and the clamp are unchanged */
  card?: ComponentType<P>
  /** the mount's width — and the width the CLAMP uses, so an `avoid` placement lands where it
   *  is computed to. Set it from `previewGutter` whenever the card must clear a figure */
  width?: number
}

/* where a raised card currently is, in the layer's own coordinates */
interface PreviewState<P> { id: string; source?: string; x: number; y: number; info: P }

/** THE PANE-WIDE TIP LAYER, as a component the rails share (OB-232). A surface that answers a
 *  node hover with a preview needs three things — a positioned layer, the clamped placement, and
 *  the card — and before this they lived in `ConnectionsSplitPane`'s body, so the Explorer rail
 *  and the Document rail would each have grown their own copy of all three.
 *
 *  IT OWNS THE HOVER STATE, because the host has nothing to do with it between `show` and `hide`.
 *  The children are a FUNCTION receiving `{ show, hide, hovered }`.
 *
 *  `hovered` is `{ id, source }` or null, and it is handed back because the host needs it for
 *  something the layer cannot do: deciding what else lights (see `connectionsHighlight`). The
 *  SOURCE matters — a tree hover and a graph hover on the same node mean different things to the
 *  arbitration — and it is the caller's word, not a guess from the event.
 *
 *  The card is pointer-transparent: it must never take the hover that raised it. */
export function NodePreviewLayer<P = NodePreviewCardProps>({ children, style, card, width }: NodePreviewLayerProps<P>) {
  const [preview, setPreview] = useState<PreviewState<P> | null>(null)
  const Card = card ?? (NodePreviewCard as unknown as ComponentType<P>)
  /* `opts.avoid` is an ELEMENT, not a rect: the caller has a ref to its figure and should not
     be measuring it on every pointer move — the layer already measures itself here. */
  /* THE LAYER IS FOUND FROM THE EVENT, NOT HELD IN A REF — the same local adaptation
     `ConnectionsSplitPane.showPreviewAt` carries, for the same reason: `react-hooks/refs`
     refuses a ref reachable from a function handed out during render, and `show` is exactly
     that (it travels to the host inside the children function). Every node that can raise a
     preview is a descendant of the layer, so the query resolves the same element, scoped to
     this pane where a document-wide one would not. */
  const show: PreviewController<P>['show'] = (e, info, source, id, opts) => {
    const host = e.target as Element | null
    const el = host && typeof host.closest === 'function' ? host.closest('[data-tip-layer]') : null
    if (!el || !info) return
    const r = el.getBoundingClientRect()
    const avoidEl = opts && opts.avoid
    const at = previewPlacement(e.clientX, e.clientY, r, avoidEl && avoidEl.getBoundingClientRect ? avoidEl.getBoundingClientRect() : null, width)
    const key = id !== undefined ? id : ((info as { id?: string }).id ?? '')
    setPreview({ id: key, source, x: at.x, y: at.y, info })
  }
  const hide = () => setPreview(null)
  const hovered = preview ? { id: preview.id, source: preview.source } : null
  return (
    <div data-tip-layer="1" style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', ...style }}>
      {preview && preview.info ? (
        <div style={{ position: 'absolute', left: preview.x, top: preview.y, zIndex: 1000, pointerEvents: 'none', width: width || undefined }}>
          <Card {...preview.info} />
        </div>
      ) : null}
      {typeof children === 'function' ? children({ show, hide, hovered }) : children}
    </div>
  )
}

/** the four hover sources the highlight arbitration reads */
export interface HighlightInputs {
  /** the node the pane is aimed at — the document's node, and the map's selection */
  aimId?: string | null
  /** the graph's hovered node; `'focus'` is the centre's sentinel */
  graphHoverId?: string | null
  /** the tree's hovered node */
  treeHoverId?: string | null
  /** the relation card's `onHighlightTarget` */
  cardTargetId?: string | null
  /** the relation card's `onHighlightCenter` */
  cardCenter?: boolean
  /** the pinned node, which outlives a hover but loses to one */
  pinnedId?: string | null
}

/** WHAT IS LIT, FROM EVERY SURFACE THAT CAN SAY SO — one answer, published because two rails
 *  deriving it separately is two answers to "what is highlighted" (OB-232).
 *
 *  Four inputs, and the rules between them are the part a re-derivation gets wrong:
 *
 *  1. A HOVER ON THE AIMED NODE IS NOT AN EXTERNAL HIGHLIGHT. The graph's centre reports either
 *     the sentinel `'focus'` or the aimed node's own id, and neither is a neighbour — filtering
 *     the card list to the node the list is ABOUT empties it.
 *  2. THE CENTRE LIGHTS ON ITS OWN SIGNAL, never on `!!highlightId`. Lighting it whenever
 *     anything is highlighted makes the highlight mean only "something is hovered" — the fault
 *     this separation was introduced for.
 *  3. A PIN OUTLIVES A HOVER but loses to one. The pin is what the reader chose; a live hover is
 *     what they are doing now, so the hover wins while it lasts and the pin is what it falls
 *     back to.
 *  4. The FILTER (which relationships the card list shows) and the HIGHLIGHT (what is lit) are
 *     not the same set: a tree hover or a card hover lights something without filtering anything.
 *
 *  Returns `{ highlightId, centerHighlight, filterTargetId }` — pass the first two to the map and
 *  the third to `RelationCards`. */
export function connectionsHighlight(s: HighlightInputs): { highlightId: string | null; centerHighlight: boolean; filterTargetId: string | null } {
  const aimId = s.aimId || null
  const graph = s.graphHoverId || null
  const tree = s.treeHoverId || null
  const external = graph && graph !== 'focus' && graph !== aimId ? graph : null
  return {
    highlightId: external || tree || s.cardTargetId || s.pinnedId || null,
    centerHighlight: graph === 'focus' || (!!aimId && (graph === aimId || tree === aimId)) || !!s.cardCenter,
    filterTargetId: external || s.pinnedId || null,
  }
}

/** the capitalised way in to this file's lower-case helpers, for a card or a raw consuming page
 *  reading off `window.<Namespace>` (which carries no lower-case export). Same function objects:
 *  `Highlight.resolve` IS `connectionsHighlight`, `Highlight.place` IS `previewPlacement`.
 *  Application code imports the named functions instead.

   Typed port of the DS components/connections/ConnectionsRails.jsx (OB-232 + OB-228 / #341). */
export const ConnectionsRails = { resolve: connectionsHighlight, place: previewPlacement, gutter: previewGutter, METRICS: PREVIEW_LAYER_METRICS }
