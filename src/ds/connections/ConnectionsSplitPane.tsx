import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

import { CollapseChevron } from '../chrome/CollapseChevron'
import { wrapTip } from '../chrome/IconButton'
import { PaneColumnHeader } from '../chrome/PaneColumnHeader'
import { TextInput } from '../chrome/TextInput'
import { topicPaint } from '../graph/DomainDot'
import { Breadcrumb } from '../nav/Breadcrumb'
import { ContainTree, containsSummary, findTreePath, treeKeyNav } from './ContainTree'
import type { ContainNode, OpenMap } from './ContainTree'
import { RelationCards, groupRelationsByTarget } from './RelationCards'
import type { Relation, RelationGroup, ViaRelation } from './RelationCards'

/** THE PANE'S GEOMETRY, published. `narrowBelow`: under this MEASURED width the split becomes a
 *  single sliding view, one column visible at a time with the collapse toggle swapping them.
 *  `tipW`/`tipH`: the hover preview card's box, which the clamped placement has to know without
 *  measuring. `treeMin`/`treeMax` and their narrow twins: the divider's clamp — ONE clamp pair
 *  shared by the drag AND the double-click fit (they disagreed once, and a fit past the drag's
 *  cap snapped back on the first touch of the divider). Capping how far the TREE column can grow
 *  is what guarantees the relations column always keeps enough room for legible pills. */
export const CONNECTIONS_PANE_METRICS = {
  narrowBelow: 380, tipW: 262, tipH: 112,
  treeMin: 85, treeMinNarrow: 70, treeMax: 360, treeMaxNarrow: 170, divider: 14,
} as const
const PM = CONNECTIONS_PANE_METRICS

/** THE PANE BODY MUST NOT SCROLL — each column owns its own scroller, so the scrollbar sits flush
 *  at the pane's inner edge like every other pane's, instead of 12px inboard behind a reserved
 *  gutter. Pass this as the host `Pane`'s `bodyStyle` (or match it). */
export const CONNECTIONS_BODY_STYLE: CSSProperties = { padding: '0 0 10px 8px', marginTop: 0, overflow: 'hidden' }

/** THE HOVER PREVIEW CARD — a one-line stand-in for the node's actual document: topic dot and a
 *  bold title over a hairline, then the summary, or a two-bar skeleton when the corpus has no
 *  summary for it. Prose is never invented; the skeleton is the honest fallback. Same recipe as
 *  `WalkStrip`'s step preview, and distinct from `MapTooltip`, which answers "how does this
 *  connect" with count rows — this one answers "what does this say". */
export interface NodePreviewCardProps {
  /** the node's topic hue */
  domain?: string
  /** the node's name */
  title: string
  /** the corpus's own one-liner. Absent draws the skeleton */
  summary?: string
  /** THE NODE'S COUNT LINE, drawn last — `containsSummary(node)`. This is where the contains
   *  tree's "N nodes" lives since DS OB-174: on the pill it was furniture on every row at rest,
   *  and here it is an answer about the one node you are pointing at. A host that draws its OWN
   *  preview instead of this card has to carry the line, or the count has nowhere left to be
   *  read */
  contains?: string
}

export function NodePreviewCard({ domain, title, summary, contains }: NodePreviewCardProps) {
  const hue = topicPaint(domain).mark
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', top: -7, left: 16, width: 0, height: 0,
        borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
        borderBottom: '7px solid var(--surface-raised)',
      }} />
      <div style={{
        background: 'var(--surface-raised)', border: '1px solid var(--border-rule)',
        borderRadius: 'var(--radius-lg)', padding: '12px 15px', boxShadow: 'var(--lift-2)',
        minWidth: 200, maxWidth: PM.tipW - 2, fontFamily: 'var(--font-ui)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--fw-bold)', fontSize: 12,
          color: 'var(--text-1)', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border-hair)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: hue, flexShrink: 0 }} />
          {title}
        </div>
        {summary
          ? <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)' }}>{summary}</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', width: '92%' }} />
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', width: '68%' }} />
            </div>
          )}
        {contains ? (
          <div data-preview-contains style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-hair)', color: 'var(--text-3)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)' }}>{contains}</div>
        ) : null}
      </div>
    </div>
  )
}

/* the contains filter IS `TextInput` (chrome) since 2026-09-02 — the recipe used to live here,
   and a second hand-rolled copy is how a recipe drifts. OB-113 rides on it too: the pane's frame
   takes `user-select: none`, and the box opts back in (`TextInput` sets `user-select: text` on
   its own input), so a drag across the pane reads as the pane's gesture while the filter's text
   stays selectable. */
function FilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TextInput value={value} onChange={onChange} placeholder="Filter by name" style={{ marginBottom: 8 }} />
}

/* the cards below the graph FOLLOW THE POINTER, and nothing on screen said so — this line states
   the rule at rest and reports the filter (or the pin) while one is active, in the same place, so
   it reads as one control rather than a tip that appears and vanishes. */
function FilterHint({ activeTitle, pinned }: { activeTitle: string | null; pinned: boolean }) {
  const on = !!activeTitle
  return (
    <div style={{ padding: '3px 2px 0', marginTop: -2, fontSize: 10, lineHeight: 1.2, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
      {on
        ? <span>{pinned ? 'Pinned to ' : 'Filtered to '}<b style={{ fontWeight: 'var(--fw-bold)' }}>{activeTitle}</b>{pinned ? ' — click it again to release' : ''}</span>
        : 'Hover the graph to filter relations below · click a node to pin'}
    </div>
  )
}

function usePersisted<T>(key: string | null, fallback: T, parse: (s: string) => T, serialize: (v: T) => string): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (key) {
      try {
        const saved = localStorage.getItem(key)
        if (saved !== null) return parse(saved)
      } catch { /* unreadable storage is the same as an unset preference */ }
    }
    return fallback
  })
  useEffect(() => { if (key) localStorage.setItem(key, serialize(v)) }, [key, v, serialize])
  return [v, setV]
}
const numParse = (fb: number) => (s: string) => (Number(s) > 0 ? Number(s) : fb)
const boolParse = (s: string) => s === '1'
const boolSerialize = (v: boolean) => (v ? '1' : '0')

/** the shape the preview placement needs off a pointer event: where the pointer is, and what it
 *  is on — the second half is what finds the pane's own tip layer. Every React mouse or pointer
 *  event satisfies it, which is what a host should pass. */
export interface PreviewPointerEvent {
  clientX: number
  clientY: number
  target: EventTarget | null
}

/** what `renderGraph` is handed — everything the host's own graph must mirror. The design system
 *  deliberately ships NO graph: every graph drawn in its mocks is a stand-in for the app's real
 *  map, so this is the contract to port, never the mock's drawing. */
export interface ConnectionsGraphApi {
  /** the node the graph is drawn about, pinned at its centre */
  selected: { id: string; title: string; domain?: string }
  /** ONE ENTRY PER PAIR of nodes, not per relationship — the graph draws one line each. A pair
   *  with a single kind should be labelled with that kind's name in its colour; only a pair with
   *  two or more falls back to a ×N badge */
  groups: RelationGroup[]
  /** the node to light, from wherever the pointer is — the graph, the tree, or a card */
  highlightId: string | null
  /** THE CENTRE'S OWN LIGHT, a separate channel and never `!!highlightId` — hovering any target
   *  used to light the source too, and the highlight then said only "something is hovered" */
  centerHighlight: boolean
  /** the node whose cards are pinned, if any — draw it as held, not merely hovered */
  pinnedId: string | null
  /** a graph node was clicked. It PINS the card filter and does not navigate; `{ id: 'focus' }`
   *  or the selected node's own id releases the pin */
  onNodeSelect: (node: { id: string; title?: string; domain?: string } | null) => void
  /** the pointer entered a graph node — raises the hover preview card at the pointer. Hand it the
   *  REAL pointer event: the pane places the card against the tip layer it finds from the event's
   *  own target, so a bare `{ clientX, clientY }` draws nothing */
  onPreviewEnter: (e: PreviewPointerEvent, node: { id: string; title: string; domain?: string }) => void
  /** the pointer left a graph node */
  onPreviewLeave: () => void
}

/** THE CONNECTIONS PANE: a breadcrumb over a resizable, collapsible split — the CONTAINS column
 *  (filter plus `ContainTree`) beside the RELATIONS column (the host's graph in a slot, the
 *  hover/pin hint line, then `RelationCards`).
 *
 *  This component owns every layout rule the redesign settled: the ONE clamp pair shared by the
 *  drag and the double-click fit; a fit measured from natural text width (canvas) rather than
 *  `scrollWidth`; both columns always mounted, with width transitions doing the collapse;
 *  per-column scrollers so the pane body never scrolls; the hover preview drawn on a pane-wide
 *  tip layer and CLAMPED into it rather than flipped across the pointer; the highlight signals
 *  kept as two channels; and pinning — clicking a graph node pins the card filter instead of
 *  navigating the pane away, and clicking it again (or the centre) releases.
 *
 *  OB-113 rides here: the outer frame takes `user-select: none`, so a click-drag across the tree,
 *  the graph slot or the cards reads as the pane's own gesture instead of painting a browser text
 *  selection. The filter input opts back in (`TextInput` sets `user-select: text` itself). ANY
 *  OTHER TEXT-BEARING CONTROL ADDED HERE LATER NEEDS THE SAME EXPLICIT OPT-BACK-IN — an ancestor
 *  `none` reaches it too.
 *
 *  Typed port of the DS components/connections/ConnectionsSplitPane.jsx, OB-101 / OB-113 / #253. */
export interface ConnectionsSplitPaneProps {
  /** the containment tree the CONTAINS column draws, and the tree the breadcrumb's path is found
   *  in. It must contain `selected.id`; a selection outside it renders as a lone pill */
  tree?: ContainNode | null
  /** the topic hue for the whole pane — the tree's pills, the breadcrumb, the preview's dot */
  domain?: string
  /** the node the pane is aimed at: the relations column's subject and the tree's highlighted row */
  selected: { id: string; title: string; domain?: string }
  /** navigate. Every click that MOVES the pane comes through here — a crumb, a tree row, a card's
   *  pill — and a graph click deliberately does not. `domain` is `null` for the corpus root's
   *  own crumb (OB-193) rather than the path's shared hue, which the root does not carry */
  onSelect?: (node: { id: string; title: string; domain?: string | null }) => void
  /** a node's own relationships, DECOMPOSED: one entry per target and kind, `kindLabel` in the
   *  corpus's own wording. Called for the selection and for every descendant of it (the
   *  via-children roll-up), so it must be cheap or memoised by the host */
  relationsOf?: (id: string) => Relation[] | null | undefined
  /** the corpus's one-line summary for the hover preview. Absent draws the skeleton */
  summaryOf?: (id: string) => string | undefined
  /** THE GRAPH IS THE HOST'S. Given the api above, return the app's real graph — this system
   *  ships none. Omit it and the column is the hint line and the cards alone */
  renderGraph?: (api: ConnectionsGraphApi) => ReactNode
  /** opt the divider width, the collapse and the tree's open set into localStorage, under keys
   *  prefixed with this. Omit and every one of them resets on reload */
  persistKey?: string | null
  /** THE CONTAINS TREE'S OPEN SET, CONTROLLED — forwarded to `ContainTree`'s `open`, for a host
   *  whose own store already knows where the selection is. Named for WHAT it opens rather than
   *  `open`, which on a pane with two columns and a collapse of its own says nothing.
   *
   *  WHY A HOST NEEDS IT: neither `defaultOpen` nor `persistKey` can force the ancestors of a
   *  MOVING selection open, so selecting a topic from another pane leaves the contains column
   *  drawing closed domains with nothing highlighted anywhere in it — and a "you are here"
   *  column that cannot show where you are is the one state it may not be in. The host unions
   *  the user's own toggles with the path down to the selection each render.
   *
   *  PASSING THIS TURNS PERSISTENCE OFF for the tree's open set, so the host's store is the only
   *  claimant and remembering across reloads becomes the host's business. The divider width and
   *  the collapse are unaffected.
   *
   *  Was ★ LOCAL here (reported on #74, asked twice in receipts). ADOPTED UPSTREAM at DS OB-167
   *  in this spelling, so it is no longer a divergence — the local copy is deleted rather than
   *  reconciled, the same way `walked`/`walkedTone` went at OB-158. */
  treeOpen?: OpenMap
  /** the controlled setter for `treeOpen`. Receives an UPDATER, never a resolved map — React's
   *  own setter is a legal value and is the intended one. Not a style: a resolved map has to be
   *  computed against the render it came from, which drops every toggle but the last when
   *  several land in one batch. Our finding, taken upstream as a contract change */
  onTreeOpenChange?: (updater: (prev: OpenMap) => OpenMap) => void
  /** forwarded to `ContainTree`'s `counts`. Default: a container's node count is NOT drawn on its
   *  pill — the pane's own hover preview carries it, which is where it belongs (furniture on every
   *  row at rest, an answer on the node you are pointing at). `'pill'` restores the second line
   *  inside every border */
  treeCounts?: 'hover' | 'pill'
  /** what the cards say when there are none. The host knows why better than the list does */
  emptyLabel?: string
  /** HOLD THE TWO-COLUMN SPLIT AT EVERY WIDTH — for a host whose pane is a desktop flex column
   *  that can dip under `narrowBelow` during a drag without ever being a phone: the single
   *  sliding view there reads as the pane LOSING a column, not adapting (owner, 2026-08-28). The
   *  narrow clamp pair still applies below the breakpoint, so the tree cannot starve the
   *  relations column */
  alwaysSplit?: boolean
}

export function ConnectionsSplitPane({ tree, domain, selected, onSelect, relationsOf, summaryOf, renderGraph, persistKey, treeOpen, onTreeOpenChange, treeCounts, emptyLabel, alwaysSplit }: ConnectionsSplitPaneProps) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [paneWidth, setPaneWidth] = useState(380)
  useEffect(() => {
    if (!outerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const cw = entries[entries.length - 1].contentRect.width
      if (cw > 0) setPaneWidth(Math.round(cw))
    })
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])
  const narrow = !alwaysSplit && paneWidth < PM.narrowBelow
  const pk = (suffix: string) => (persistKey ? persistKey + suffix + (narrow ? '_narrow' : '') : null)
  const [leftWidth, setLeftWidth] = usePersisted(pk('_leftWidth'), narrow ? 90 : 120, numParse(narrow ? 90 : 120), String)
  const leftWidthRef = useRef(leftWidth)
  const [collapsed, setCollapsed] = usePersisted(pk('_collapsed'), narrow, boolParse, boolSerialize)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<{ id: string; x: number; y: number; source: 'graph' | 'tree'; info: NodePreviewCardProps } | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoveredCardTarget, setHoveredCardTarget] = useState<string | null>(null)
  const [centerFromCard, setCenterFromCard] = useState(false)
  const tight = paneWidth < PM.narrowBelow
  const minL = tight ? PM.treeMinNarrow : PM.treeMin
  const maxL = tight ? Math.min(PM.treeMaxNarrow, paneWidth - 130) : Math.min(PM.treeMax, paneWidth - PM.divider - 150)
  /* THE DRAWN WIDTH IS DERIVED FROM THE PANE, NEVER READ STRAIGHT OFF THE STORED ONE.
     `leftWidth` is a PREFERENCE — the clamp pair above only runs WHILE the divider is being
     dragged, so a pane that shrinks afterwards (or a width restored from localStorage into a
     smaller pane) leaves the tree wider than the pane and pushes the divider past the right edge,
     where the host body's `overflow: hidden` clips it: THE HANDLE YOU NEED IN ORDER TO FIX IT IS
     THE THING THAT HAS GONE MISSING. A horizontal scrollbar only makes an unreachable handle
     reachable by scrolling to it, and pays for that with a bar appearing on a hairline of
     overflow — the reason that bar was switched off in the first place. Clamping means the handle
     was never out of reach.
     The floor is `treeMinNarrow` and NOT `minL`: `minL` is the DRAG's floor, itself a preference,
     and a genuinely squeezed pane has to yield past it — the relations column absorbs the rest,
     being `minWidth: 0` and scrolling on its own.
     THE STORED VALUE IS DELIBERATELY LEFT ALONE, so widening the pane restores the width that was
     chosen rather than the width the smallest moment of the drag imposed. */
  const shownLeft = Math.min(leftWidth, Math.max(PM.treeMinNarrow, maxL))
  /* ★ LOCAL — synced in an EFFECT, where the DS assigns during render. `react-hooks/refs` forbids
     writing a ref from a render body, and it hard-errors, which takes the whole component out of
     the lint pass. An effect runs on COMMIT rather than on render, so the one case the DS's
     comment names — a drag beginning after a fit has set state but before that render commits —
     would read one value stale. It is not reachable here: a mousedown is a DISCRETE event, and
     React flushes a pending render before delivering the next one. Reported on #74. */
  useEffect(() => { leftWidthRef.current = shownLeft }, [shownLeft])

  const onDividerDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    /* the latest STATE value through a ref kept in sync every render — not a DOM measurement (the
       box carries padding, which is exactly the offset that crept in the last time this was
       "fixed" by reading getBoundingClientRect), and not the bare closed-over value either, in
       case a drag starts before a just-applied fit's render has committed. */
    const startX = e.clientX
    const startW = leftWidthRef.current
    setDragging(true)
    const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(minL, Math.min(maxL, startW + (ev.clientX - startX))))
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const leftRef = useRef<HTMLDivElement | null>(null)
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null)
  /* NATURAL text width via canvas, not `scrollWidth` — a stretching pill feeds `scrollWidth` back
     into itself and the fit overshoots a little more on every use. One measurement, no second
     corrective pass, no race with a fast drag. */
  const measureNeed = () => {
    const container = leftRef.current
    if (!container) return 0
    const cRect = container.getBoundingClientRect()
    if (!measureCtx.current) measureCtx.current = document.createElement('canvas').getContext('2d')
    const ctx = measureCtx.current
    if (!ctx) return 0
    let need = 0
    container.querySelectorAll<HTMLElement>('[data-pill-title]').forEach((el) => {
      const r = el.getBoundingClientRect()
      ctx.font = getComputedStyle(el).font
      need = Math.max(need, (r.left - cRect.left) + ctx.measureText(el.textContent || '').width + 22)
    })
    return need
  }
  const fitToContent = () => {
    const need = measureNeed()
    if (need > 0) setLeftWidth(Math.min(maxL, Math.max(minL, Math.round(need))))
  }

  /* the hover preview is drawn by the pane-wide tip layer and CLAMPED into it. Flipping it across
     the pointer put the card on the far side whenever the arithmetic said it would not fit, which
     in a 370px pane meant almost every graph node; sliding it left by the few pixels it overhangs
     keeps ONE placement everywhere. */
  /* ★ LOCAL — THE LAYER IS FOUND FROM THE EVENT, not held in a ref. The DS keeps a `layerRef` and
     reads `.current` here; `react-hooks/refs` refuses a ref that can be reached by a function
     handed out during render, and `showPreviewAt` is exactly that — it travels to the host inside
     `renderGraph`'s api. Every node that can raise a preview is a descendant of the layer, so
     `closest('[data-tip-layer]')` off the event's own target resolves the same element and stays
     scoped to THIS pane, where a document-wide query would not. Reported on #74. */
  const showPreviewAt = (e: PreviewPointerEvent, node: { id: string; title: string; domain?: string; children?: ContainNode[] }, source: 'graph' | 'tree') => {
    const from = e.target as Element | null
    const layer = from && typeof from.closest === 'function' ? from.closest('[data-tip-layer]') : null
    if (!layer) return
    const r = layer.getBoundingClientRect()
    const x = e.clientX - r.left + 14
    const y = e.clientY - r.top + 14
    setPreview({
      id: node.id,
      x: Math.max(4, Math.min(x, r.width - PM.tipW - 4)),
      y: Math.max(4, Math.min(y, r.height - PM.tipH - 4)),
      source,
      /* the count line rides on the TREE's hover only, and only for a container: a relation
         graph node is not being asked "what is inside you", and a leaf has no answer to give */
      info: {
        domain: node.domain || domain,
        title: node.title,
        summary: summaryOf ? summaryOf(node.id) : undefined,
        contains: source === 'tree' && node.children && node.children.length ? containsSummary(node as ContainNode) : undefined,
      },
    })
  }
  const hidePreview = () => setPreview(null)

  const direct = useMemo(() => (relationsOf ? relationsOf(selected.id) || [] : []), [relationsOf, selected.id])
  const groups = useMemo(() => groupRelationsByTarget(direct), [direct])
  const path = (tree && findTreePath(tree, selected.id)) || [{ id: selected.id, title: selected.title, domain: undefined, root: false }]
  const fullNode = path[path.length - 1]
  /* THE ROOT CRUMB REPORTS `domain: null`, EXPLICITLY (owner, 2026-09-15) — the corpus root's
     own `ContainNode.domain` is `undefined` (OB-174's grey pill, unresolved), and `undefined`
     is exactly what `Breadcrumb` reads as "fall back to the path's shared domain". Left alone,
     clicking the root crumb from inside, say, a Networking ancestry would report that
     territory's hue for a node that owns none. `null` defeats the fallback; every other crumb
     passes its own resolved topic through unchanged. */
  const crumbPath = path.map((n) => ({ id: n.id, title: n.title, domain: n.root ? null : n.domain }))
  const via = useMemo<ViaRelation[]>(() => {
    if (!relationsOf || !fullNode || !fullNode.children) return []
    const out: ViaRelation[] = []
    const walk = (n: ContainNode, trail: ContainNode[]) => {
      for (const c of n.children || []) {
        const childPath = trail.concat([c])
        for (const rel of relationsOf(c.id) || []) out.push({ path: childPath, rel })
        walk(c, childPath)
      }
    }
    walk(fullNode, [fullNode])
    return out
  }, [relationsOf, fullNode])

  /* A PIN IS RELEASED ON NAVIGATION — a pin scoped to the PREVIOUS selection is a filter to a node
     the new graph may not even show.
     ★ LOCAL — React's own "adjust state when a prop changes" pattern, where the DS clears the pin
     from an effect. `react-hooks/set-state-in-effect` refuses that, and it hard-errors. Adjusting
     during render is strictly better here anyway: the effect version painted one frame with the
     stale pin still filtering the new node's cards. Reported on #74. */
  const [pinnedFor, setPinnedFor] = useState(selected.id)
  if (pinnedFor !== selected.id) {
    setPinnedFor(selected.id)
    setPinnedId(null)
  }
  const hoveredGraphId = preview && preview.source === 'graph' ? preview.id : null
  const hoveredExternal = hoveredGraphId && hoveredGraphId !== 'focus' && hoveredGraphId !== selected.id ? hoveredGraphId : null
  const filterTargetId = hoveredExternal || pinnedId || null
  const hoveredTreeId = preview && preview.source === 'tree' ? preview.id : null
  const highlightId = hoveredExternal || hoveredTreeId || hoveredCardTarget || pinnedId
  /* the CENTRE lights on its OWN signal, never on `!!highlightId` — hovering any target used to
     light the source too, and the highlight then said only "something is hovered". */
  const centerHighlight = hoveredGraphId === 'focus' || hoveredGraphId === selected.id || hoveredTreeId === selected.id || centerFromCard
  const onNodeSelect = (node: { id: string; title?: string; domain?: string } | null) => {
    if (!node || node.id === 'focus' || node.id === selected.id) { setPinnedId(null); return }
    setPinnedId((p) => (p === node.id ? null : node.id))
  }
  const activeTitle = filterTargetId
    ? (groups.find((g) => g.targetId === filterTargetId)?.targetTitle
      || via.find((vc) => vc.rel.targetId === filterTargetId)?.rel.targetTitle
      || null)
    : null

  const scale = Math.min(1.6, Math.max(1, shownLeft / 150))
  const fullW = Math.max(160, paneWidth - 40)
  const leftBoxW = narrow ? fullW : shownLeft
  const edgeCount = direct.length
  const relContent = (
    <Fragment>
      <PaneColumnHeader
        title="Relationships"
        note={groups.length + ' node' + (groups.length === 1 ? '' : 's') + ' · ' + edgeCount + ' edge' + (edgeCount === 1 ? '' : 's')}
      />
      {/* keyed on the selection, so a re-aim remounts the graph rather than animating one node's
          picture into another's */}
      <div key={selected.id}>
        {renderGraph
          ? renderGraph({
              selected, groups, highlightId, centerHighlight, pinnedId, onNodeSelect,
              onPreviewEnter: (e, node) => showPreviewAt(e, node, 'graph'),
              onPreviewLeave: hidePreview,
            })
          : null}
        {renderGraph && (direct.length || via.length) ? <FilterHint activeTitle={activeTitle} pinned={!hoveredExternal && !!pinnedId} /> : null}
        <RelationCards
          source={selected} direct={direct} via={via} filterTargetId={filterTargetId} onSelect={onSelect}
          onHighlightTarget={setHoveredCardTarget} onHighlightCenter={setCenterFromCard} emptyLabel={emptyLabel}
        />
      </div>
    </Fragment>
  )

  return (
    <div ref={outerRef} data-connections-split={narrow ? 'narrow' : 'split'} style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100% - 2px)', minWidth: 0,
      /* OB-113 — the pane's own drags are gestures, not text selections */
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <Breadcrumb path={crumbPath} domain={domain} onSelect={onSelect} />
      <div data-tip-layer="1" style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {preview && preview.info ? (
          <div style={{ position: 'absolute', left: preview.x, top: preview.y, zIndex: 1000, pointerEvents: 'none' }}>
            <NodePreviewCard {...preview.info} />
          </div>
        ) : null}
        <div style={{ flex: '0 0 auto', width: collapsed ? 0 : leftBoxW, overflow: 'hidden', transition: dragging ? 'none' : 'width 220ms ease', height: '100%' }}>
          <div
            ref={leftRef} tabIndex={0} onKeyDown={(e) => treeKeyNav(e, leftRef.current)} data-selected-id={selected.id}
            style={{ width: leftBoxW, minWidth: 0, paddingRight: 4, height: '100%', overflowY: 'auto', outline: 'none', boxShadow: 'none', position: 'relative' }}
          >
            <div style={{ paddingRight: 16 }}>
              <PaneColumnHeader title="Contains" note={tree ? containsSummary(tree) : ''} minHeight={40} />
            </div>
            <CollapseChevron collapsed={false} onClick={() => setCollapsed(true)} title="Hide contains" style={{ position: 'absolute', top: 0, right: 0 }} />
            <FilterInput value={query} onChange={setQuery} />
            <ContainTree
              key={tree ? tree.id : 'none'} root={tree || { id: selected.id, title: selected.title }} domain={domain}
              compact scale={scale} selectedId={selected.id} hoveredId={hoveredTreeId} onSelect={onSelect} counts={treeCounts}
              /* `onOpenUpdate`, NOT the deprecated `onOpenChange`: the updater is handed
                 out unresolved so two caret toggles inside one React batch both survive */
              query={query} open={treeOpen} onOpenUpdate={onTreeOpenChange}
              /* a CONTROLLED tree keeps no state of its own, so storing one would write a set
                 nothing ever reads back */
              persistKey={treeOpen ? null : pk('_open')}
              onNodeEnter={(e, node) => showPreviewAt(e, node, 'tree')} onNodeLeave={hidePreview}
            />
          </div>
        </div>
        <div
          onMouseDown={(collapsed || narrow) ? undefined : onDividerDown}
          onDoubleClick={(collapsed || narrow) ? undefined : fitToContent}
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          title={wrapTip(collapsed ? 'show contains' : 'drag to resize · double-click to fit')}
          style={{ flex: 'none', width: PM.divider, cursor: (collapsed || narrow) ? 'pointer' : 'col-resize', position: 'relative' }}
        >
          {(collapsed || narrow) ? null : (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 6, width: 1, background: dragging ? 'var(--accent-primary)' : 'var(--border-hair)' }} />
          )}
          {collapsed ? (
            <div style={{ position: 'absolute', top: 2, left: 0, width: PM.divider, display: 'flex', justifyContent: 'center' }}>
              <CollapseChevron collapsed onClick={(e) => { e.stopPropagation(); setCollapsed(false) }} title="Show contains" />
            </div>
          ) : null}
        </div>
        {/* THE SLIDE: both columns stay mounted always; a wrapper's WIDTH transitions between 0
            and full size, with `overflow: hidden` clipping the inside, whose fixed width never
            reflows mid-transition. Wide: the graph column is `flex: 1` and reflows into the freed
            space for free. Narrow: the SAME technique runs on both columns at once. */}
        {narrow ? (
          <div style={{ flex: '0 0 auto', width: collapsed ? fullW : 0, overflow: 'hidden', transition: dragging ? 'none' : 'width 220ms ease', height: '100%' }}>
            <div style={{ width: fullW, paddingLeft: 4, height: '100%', scrollbarGutter: 'stable', overflowX: 'hidden', overflowY: 'auto' }}>{relContent}</div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, paddingLeft: collapsed ? 8 : 4, height: '100%', scrollbarGutter: 'stable', overflowX: 'hidden', overflowY: 'auto' }}>{relContent}</div>
        )}
      </div>
    </div>
  )
}
