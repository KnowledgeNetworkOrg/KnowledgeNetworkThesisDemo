import React from 'react'
import { ContainTree, containsSummary, findTreePath, treeKeyNav } from './ContainTree.jsx'
import { RelationCards, groupRelationsByTarget } from './RelationCards.jsx'
/* `topicPaint` was imported here for `NodePreviewCard` and went with it (2026-09-20). Removing
   the import is part of moving the function: harmless in this bundle, a compile error in the
   port under `noUnusedLocals` — a build break inherited from a file that is meant to be
   quietly retired. */
/* THE SHARED RAIL PARTS LIVE NEXT DOOR NOW (OB-232, 2026-09-20). This pane is retired by
   OB-226 — unmounted, kept for one release — and a piece two live rails depend on cannot sit
   in the file scheduled for deletion. `NodePreviewCard` is IMPORTED here and NOT re-exported:
   two files exporting one name collide on the window namespace and only one survives, so the
   import path moves with the component. Consumers take it from `ConnectionsRails`. */
import { NodePreviewCard, previewPlacement, connectionsHighlight, PREVIEW_LAYER_METRICS } from './ConnectionsRails.jsx'
import { CollapseChevron } from '../chrome/CollapseChevron.jsx'
import { PaneColumnHeader } from '../chrome/PaneColumnHeader.jsx'
import { TextInput } from '../chrome/TextInput.jsx'
import { Breadcrumb } from '../nav/Breadcrumb.jsx'
import { PanePlaceholder } from '../chrome/PanePlaceholder.jsx'
import { scrollerPadRight } from '../chrome/Pane.jsx'

/** THE PANE'S GEOMETRY, published. `narrowBelow`: under this measured width the split becomes
 *  a single sliding view (one column visible at a time, the collapse toggle swapping them).
 *  `tipW`/`tipH`: the hover preview card's box, which the clamped placement needs to know
 *  without measuring. `treeMin`/`treeMaxPad`: the divider's clamp — one clamp pair shared by
 *  the drag AND the double-click fit (they disagreed once, and a fit past the drag's cap
 *  snapped back on the first touch of the divider). Capping how far the TREE column can grow
 *  is what guarantees the relations column always keeps enough room for legible pills. */
export const CONNECTIONS_PANE_METRICS = { narrowBelow: 380, tipW: PREVIEW_LAYER_METRICS.tipW, tipH: PREVIEW_LAYER_METRICS.tipH, treeMin: 85, treeMinNarrow: 70, treeMax: 360, treeMaxNarrow: 170, divider: 14, graphClickSlop: 4 }
const PM = CONNECTIONS_PANE_METRICS

/** WHAT THIS PANE DECLARES ABOUT ITS OWN WIDTH, in the shape a DESK can read (`PaneFit`, from
 *  `chrome/PaneDivider.jsx`). Published 2026-09-16 for OB-170: the desk's dividers drag, and a
 *  drag needs clamps, so this number stops being interesting and becomes load-bearing.
 *
 *  `narrowBelow` is the number this file has always had and nothing outside it could read — under
 *  it the split becomes ONE sliding column, which is a lesser reading and still a working pane.
 *  `floor` is the new half of the statement, and it is DERIVED rather than chosen: the narrow
 *  mode's own clamp pair plus the strip between them — `treeMinNarrow` (70) + `divider` (14) + the
 *  130 the narrow `maxL` reserves for the relations column = 214. Below that the sliding view has
 *  no column wide enough to read, so the pane is not degrading any more, it is broken.
 *
 *  A DESK MAY NOT OVERRIDE EITHER NUMBER. Both are measurements of this pane's own content. */
export const CONNECTIONS_PANE_FIT = { narrowBelow: PM.narrowBelow, floor: PM.treeMinNarrow + PM.divider + 130 }

/** THE PANE BODY MUST NOT SCROLL — each column owns its scroller, so the scrollbar sits flush
 *  at the pane's inner edge like every other pane's instead of 12px inboard behind a reserved
 *  gutter. Pass this as the host `Pane`'s bodyStyle (or match it). */
export const CONNECTIONS_BODY_STYLE = { padding: '0 0 10px 8px', marginTop: 0, overflow: 'hidden' }

/** THE HOVER PREVIEW CARD moved to `ConnectionsRails.jsx` (2026-09-20, OB-232) and is
 *  re-exported at the top of this file. Both rails show it, and this pane is being retired. */

/* the contains filter IS `TextInput` (chrome) since 2026-09-02 — the recipe used to live here */
function FilterInput({ value, onChange }) {
  return <TextInput value={value} onChange={onChange} placeholder="Filter by name" style={{ marginBottom: 8 }} />
}

/* Breadcrumb (positional path) and the column head (title over a data note) are now shared
   pieces — `nav/Breadcrumb.jsx` and `chrome/PaneColumnHeader.jsx` — extracted 2026-08-28.
   Nothing about either was specific to this pane. */

/* the cards below the graph follow the pointer, and nothing on screen said so — this line
   states the rule at rest and reports the filter (or the pin) while one is active, in the
   same place, so it reads as one control rather than a tip that appears and vanishes. */
function FilterHint({ activeTitle, pinned }) {
  const on = !!activeTitle
  return (
    <div style={{ padding: '3px 2px 0', marginTop: -2, fontSize: 10, lineHeight: 1.2, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
      {on
        ? <span>{pinned ? 'Pinned to ' : 'Filtered to '}<b style={{ fontWeight: 'var(--fw-bold)' }}>{activeTitle}</b>{pinned ? ' \u2014 click it again, or the empty graph, to release' : ''}</span>
        : 'Hover the graph to filter relations below \u00b7 click a node to pin'}
    </div>
  )
}

function usePersisted(key, fallback, parse, serialize) {
  const [v, setV] = React.useState(() => {
    if (key) { try { const saved = localStorage.getItem(key); if (saved !== null) return parse(saved) } catch (e) { /* fall through */ } }
    return fallback
  })
  React.useEffect(() => { if (key) localStorage.setItem(key, serialize(v)) }, [key, v])
  return [v, setV]
}
const useNum = (key, fb) => usePersisted(key, fb, (s) => (Number(s) > 0 ? Number(s) : fb), String)
const useBool = (key, fb) => usePersisted(key, fb, (s) => s === '1', (v) => (v ? '1' : '0'))

/** THE CONNECTIONS PANE: breadcrumb over a resizable, collapsible split — the CONTAINS column
 *  (filter + `ContainTree`) beside the RELATIONS column (the host's graph in a slot, the
 *  hover/pin hint line, then `RelationCards`). This component owns every layout rule the
 *  redesign settled: the one clamp pair shared by drag and double-click fit; fit measured
 *  from natural text width (canvas), not scrollWidth; both columns always mounted with width
 *  transitions doing the collapse; per-column scrollers so the pane body never scrolls; the
 *  hover preview drawn on a pane-wide tip layer and CLAMPED to it (never flipped across the
 *  pointer); the highlight signals (target vs centre are separate channels); and pinning —
 *  clicking a graph node pins the card filter instead of navigating the pane away, clicking
 *  it again (or the centre) releases.
 *
 *  THE AIM AND THE SELECTION ARE TWO THINGS, and `selectedId` is the second one. `selected` is
 *  what the pane READS — the breadcrumb's path, the relations column, the graph slot. `selectedId`
 *  is what the pane
 *  LIGHTS: pass `null` and no pill in the contains tree draws as selected, while the pane goes on
 *  reading the node it is aimed at. Omit it and it follows `selected.id`, which is the old
 *  behaviour and the right default for a host whose aim IS its selection.
 *
 *  AND THE PANE CAN BE AIMED AT NOTHING: `selected={null}` (owner's ruling, 2026-09-17, OB-209
 *  clause 4, off three built candidates in `ideas/rest-state-*.html`). The relations column draws
 *  `PanePlaceholder` — the state, then the gesture — and the graph slot is not called at all,
 *  since a host's graph has no centre to draw. THE CONTAINS COLUMN STAYS LIVE, deliberately and
 *  by the owner's answer: it draws the corpus, which is true whether or not anything is chosen,
 *  and it is the navigation a reader needs in order to LEAVE the empty state. The breadcrumb row
 *  keeps its height by drawing itself invisibly rather than by a number, so nothing under it
 *  moves as a pointer sweeps in and out of the map. A host that would rather keep the last
 *  reading passes it as `selected` and gets the old behaviour — nothing about that path changed.
 *
 *  WHY THAT PAIR EXISTS: a host that keeps aiming at the last node after the user deselects (our
 *  app does, deliberately — dropping to the corpus root yanks the pane away mid-exploration) had
 *  no way to say so, so the tree went on lighting a pill nobody had selected. Owner-reported
 *  2026-09-16: clearing the selection on the map left the old pill lit in the column. The
 *  breadcrumb still draws its last crumb filled, and that is deliberate — that row is the AIM's
 *  readout ("where this pane is pointed"), not a selection.
 *  SUPERSEDED IN PART, 2026-09-17: the app kept the last aim on purpose, and the owner has now
 *  ruled the other way — nothing chosen means `selected={null}` and a placeholder, not the last
 *  node. The pair still does its job for a host that genuinely separates aim from selection; it
 *  is no longer the answer to "what does this pane show with nothing selected".
 *
 *  THE GRAPH IS THE HOST'S. `renderGraph(api)` receives everything it must mirror
 *  ({ selected, groups, highlightId, centerHighlight, pinnedId, onNodeSelect, onPreviewEnter,
 *  onPreviewLeave }) — the design system deliberately ships no graph: every graph drawn in
 *  this project's mocks is a stand-in for the app's real map. */
export function ConnectionsSplitPane({ tree, domain, selected, selectedId, onSelect, relationsOf, summaryOf, renderGraph, persistKey, emptyLabel, alwaysSplit, treeOpen, onTreeOpenChange, treeCounts, unchosenState = 'Nothing chosen', unchosenGesture = 'Point at a cell on the map, or pick a node from Contains, to read what it links to.' }) {
  const outerRef = React.useRef(null)
  /* THE AIM, WHICH MAY BE NOTHING. Every reading below goes through `aim` / `aimId` rather than
     `selected.id`, so a pane aimed at nothing cannot throw on a property of null — the failure
     this refactor exists to make impossible, since the empty state is reached by a stray click
     on a map's water and would take the whole desk with it. */
  const aim = selected || null
  const aimId = aim ? aim.id : null
  const [paneWidth, setPaneWidth] = React.useState(380)
  React.useEffect(() => {
    if (!outerRef.current) return
    const ro = new ResizeObserver((entries) => { const cw = entries[entries.length - 1].contentRect.width; if (cw > 0) setPaneWidth(Math.round(cw)) })
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])
  /* `alwaysSplit` holds the two-column split at every width — for a host whose pane is a
     desktop flex column that can dip under `narrowBelow` during a drag without ever being a
     phone: the single sliding view there reads as the pane losing a column, not adapting.
     The narrow clamp pair still applies below the breakpoint so the tree cannot starve the
     relations column. */
  const narrow = !alwaysSplit && paneWidth < PM.narrowBelow
  const pk = (suffix) => (persistKey ? persistKey + suffix + (narrow ? '_narrow' : '') : null)
  const [leftWidth, setLeftWidth] = useNum(pk('_leftWidth'), narrow ? 90 : 120)
  const leftWidthRef = React.useRef(leftWidth)
  const [collapsed, setCollapsed] = useBool(pk('_collapsed'), narrow)
  const [dragging, setDragging] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [preview, setPreview] = React.useState(null)
  const [pinnedId, setPinnedId] = React.useState(null)
  const [hoveredCardTarget, setHoveredCardTarget] = React.useState(null)
  const [centerFromCard, setCenterFromCard] = React.useState(false)
  /* the empty-graph release, all of its pieces: which gesture is in progress, which gesture a
     node last claimed, where this one went down and where it came up. Refs rather than state —
     none of them draws anything, and a re-render mid-gesture would be one per pointermove. */
  const gestureRef = React.useRef(0)
  const graphClaimRef = React.useRef(-1)
  const graphDownRef = React.useRef(null)
  const lastUpRef = React.useRef({ x: 0, y: 0 })
  /* WHICH PILL IS LIT — the selection, which is not the same question as what the pane is aimed
     at. `undefined` means the host does not distinguish the two (the aim IS the selection); an
     explicit `null` means nothing is selected, and then no pill draws lit while the pane keeps
     reading `selected`. Written as an `=== undefined` test on purpose: `selectedId={null}` has to
     survive, and `||`/`??` would both quietly fall back to the aim. */
  const litId = selectedId === undefined ? aimId : selectedId
  const tight = paneWidth < PM.narrowBelow
  const minL = tight ? PM.treeMinNarrow : PM.treeMin
  const maxL = tight ? Math.min(PM.treeMaxNarrow, paneWidth - 130) : Math.min(PM.treeMax, paneWidth - PM.divider - 150)
  /* THE DRAWN WIDTH IS DERIVED FROM THE PANE, NEVER READ STRAIGHT OFF THE STORED ONE.
     `leftWidth` is a PREFERENCE — the clamp pair above only runs while the divider is being
     dragged, so a pane that shrinks AFTERWARDS (or a width restored from localStorage into a
     smaller pane) leaves the tree wider than the pane, pushing the divider past the right
     edge where the host body's `overflow: hidden` clips it: the handle you need in order to
     fix it is the thing that has gone missing. A horizontal scrollbar only makes an
     unreachable handle reachable by scrolling to it, and it pays for that with a bar that
     appears on a hairline of overflow; clamping means the handle was never out of reach.
     The floor is `treeMinNarrow` and NOT `minL` — `minL` is the drag's floor, itself a
     preference, and a genuinely squeezed pane has to yield past it; the relations column
     absorbs the rest of the squeeze, being `minWidth: 0` and scrolling on its own. The stored
     value is deliberately left alone, so widening the pane restores the width that was
     chosen rather than the width the smallest moment of the drag imposed. */
  const shownLeft = Math.min(leftWidth, Math.max(PM.treeMinNarrow, maxL))
  leftWidthRef.current = shownLeft

  const onDividerDown = (e) => {
    e.preventDefault()
    /* the latest STATE value via a ref kept in sync every render — not a DOM measurement
       (the box carries padding, which is exactly the offset that crept in the last time this
       was "fixed" by reading getBoundingClientRect), and not the bare closed-over value, in
       case a drag starts before a just-applied fit's render has committed. */
    const startX = e.clientX, startW = leftWidthRef.current
    setDragging(true)
    const onMove = (ev) => { const w = Math.max(minL, Math.min(maxL, startW + (ev.clientX - startX))); setLeftWidth(w) }
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }
  const leftRef = React.useRef(null)
  /* NATURAL text width via canvas, not scrollWidth — a stretching pill feeds scrollWidth back
     into itself and the fit overshoots a little more on every use. One measurement, no second
     corrective pass, no race with a fast drag. */
  const measureNeed = () => {
    const container = leftRef.current
    if (!container) return 0
    const cRect = container.getBoundingClientRect()
    const ctx = measureNeed._ctx || (measureNeed._ctx = document.createElement('canvas').getContext('2d'))
    let need = 0
    container.querySelectorAll('[data-pill-title]').forEach((el) => {
      const r = el.getBoundingClientRect()
      ctx.font = getComputedStyle(el).font
      need = Math.max(need, (r.left - cRect.left) + ctx.measureText(el.textContent).width + 22)
    })
    return need
  }
  const fitToContent = () => { const need = measureNeed(); if (need > 0) setLeftWidth(Math.min(maxL, Math.max(minL, Math.round(need)))) }

  /* hover preview — drawn by the pane-wide tip layer and CLAMPED into it. Flipping across the
     pointer put the card on the far side whenever the maths said it would not fit, which in a
     370px pane meant almost every graph node. Sliding it left by the few pixels it overhangs
     keeps the one placement everywhere. */
  const layerRef = React.useRef(null)
  const showPreviewAt = (e, node, source) => {
    const layer = layerRef.current
    if (!layer) return
    const at = previewPlacement(e.clientX, e.clientY, layer.getBoundingClientRect())
    setPreview({ id: node.id, x: at.x, y: at.y, source, info: { domain: node.domain || domain, title: node.title, summary: summaryOf ? summaryOf(node.id) : undefined, contains: (node.children && node.children.length) ? containsSummary(node) : undefined } })
  }
  const hidePreview = () => setPreview(null)

  const direct = React.useMemo(() => (relationsOf && aimId ? relationsOf(aimId) || [] : []), [relationsOf, aimId])
  const groups = React.useMemo(() => groupRelationsByTarget(direct), [direct])
  const path = aim ? (tree && findTreePath(tree, aim.id)) || [{ id: aim.id, title: aim.title }] : []
  const fullNode = path[path.length - 1]
  const via = React.useMemo(() => {
    if (!relationsOf || !fullNode || !fullNode.children) return []
    const out = []
    const walk = (n, trail) => {
      for (const c of n.children || []) {
        const childPath = trail.concat([c])
        for (const rel of relationsOf(c.id) || []) out.push({ path: childPath, rel })
        walk(c, childPath)
      }
    }
    walk(fullNode, [fullNode])
    return out
  }, [relationsOf, fullNode])

  /* pin released on navigation — a pin scoped to the previous selection is a filter to a node
     the new graph may not even show. */
  React.useEffect(() => { setPinnedId(null) }, [aimId])
  const hoveredGraphId = preview && preview.source === 'graph' ? preview.id : null
  const hoveredTreeId = preview && preview.source === 'tree' ? preview.id : null
  /* THE ARBITRATION IS `connectionsHighlight` NOW (OB-232) — four hover sources to one lit id,
     with the centre on its own signal and the filter a different set from the highlight. It was
     nine lines here, and both rails of the dissolution need every one of them. */
  const lit = connectionsHighlight({ aimId, graphHoverId: hoveredGraphId, treeHoverId: hoveredTreeId, cardTargetId: hoveredCardTarget, cardCenter: centerFromCard, pinnedId })
  const filterTargetId = lit.filterTargetId
  const highlightId = lit.highlightId
  const centerHighlight = lit.centerHighlight
  const onNodeSelect = (node) => {
    /* THE CLAIM IS THE GESTURE'S NUMBER, NOT A TIMESTAMP. It was 350ms of "a node just took
       one", and driving the card's own specimen showed what that costs: click a node, then
       click the background a third of a second later, and the release is swallowed as part of
       the node's click — which is an ordinary speed to click at. A gesture id has no window to
       be wrong about. It also does not care WHEN the host calls this (a graph pinning on
       `pointerdown` and one pinning on `click` are the same gesture), only that it calls
       before the click is decided, which is what "synchronously, in the gesture" means. */
    graphClaimRef.current = gestureRef.current
    if (!node || node.id === 'focus' || node.id === aimId) { setPinnedId(null); return }
    setPinnedId((p) => (p === node.id ? null : node.id))
  }
  /* RELEASING ON EMPTY GRAPH (owner, 2026-09-16: "i also want to add unfocus if we click on
     empty parts of the graph"). The pin is the pane's state and the hit-testing is the host's,
     so this is settled WITHOUT asking the host for anything: the pane wraps the graph slot and
     reads a click that no node claimed.

     THREE THINGS IT HAS TO GET RIGHT, each of which is a way this pattern usually fails.
     1. A NODE CLICK MUST NOT PIN AND RELEASE IN ONE GESTURE. Every gesture that goes down in
        the slot takes a number (capture phase, so it is taken even when the graph swallows the
        event); `onNodeSelect` writes that number down; a click whose number a node claimed is
        the node's. A node that stops propagation never reaches us at all, which is the same
        answer by a different route.
     2. A PAN IS NOT A CLICK. The browser still fires `click` after a drag that begins and ends
        on the same element, so a graph panned by dragging the background would release the pin
        every time. A gesture that travelled further than `graphClickSlop` is a drag.
     3. NO DOWN, NO DECISION. A click arriving with no recorded pointerdown (synthetic, or the
        tail of a gesture that began outside the slot) is ignored rather than guessed at. */
  const onGraphPointerDownCapture = (e) => { gestureRef.current += 1; graphDownRef.current = { x: e.clientX, y: e.clientY } }
  const releasePinFromBackground = () => { graphDownRef.current = null; setPinnedId(null) }
  const onGraphClick = () => {
    const down = graphDownRef.current
    graphDownRef.current = null
    if (graphClaimRef.current === gestureRef.current) return
    if (!down) return
    if (Math.abs(lastUpRef.current.x - down.x) > PM.graphClickSlop || Math.abs(lastUpRef.current.y - down.y) > PM.graphClickSlop) return
    setPinnedId(null)
  }
  const activeTitle = filterTargetId
    ? ((groups.find((g) => g.targetId === filterTargetId) || {}).targetTitle
      || (via.find((vc) => vc.rel.targetId === filterTargetId) || { rel: {} }).rel.targetTitle || null)
    : null

  const scale = Math.min(1.6, Math.max(1, shownLeft / 150))
  const fullW = Math.max(160, paneWidth - 40)
  const leftBoxW = narrow ? fullW : shownLeft
  const edgeCount = direct.length
  /* AIMED AT NOTHING: the column keeps its HEAD (a head that vanishes with its subject moves
     everything under it, and this state is reached by a pointer sweeping a map) and its body is
     the placeholder — state, then gesture. The graph slot is not called: a host's graph has no
     centre to draw, and calling it with `selected: null` would push that guard into every host. */
  const relContent = !aim ? (
    <React.Fragment>
      <PaneColumnHeader title="Relationships" note="nothing chosen" />
      <PanePlaceholder state={unchosenState} gesture={unchosenGesture} />
    </React.Fragment>
  ) : (
    <React.Fragment>
      <PaneColumnHeader title="Relationships" note={groups.length + '\u00a0node' + (groups.length === 1 ? '' : 's') + ' \u00b7 ' + edgeCount + '\u00a0edge' + (edgeCount === 1 ? '' : 's')} />
      <div key={aim.id}>
        {renderGraph ? (
          <div onPointerDownCapture={onGraphPointerDownCapture} onPointerUpCapture={(e) => { lastUpRef.current = { x: e.clientX, y: e.clientY } }} onClick={onGraphClick}>
            {renderGraph({ selected: aim, groups, highlightId, centerHighlight, pinnedId, onNodeSelect, onPreviewEnter: (e, node) => showPreviewAt(e, node, 'graph'), onPreviewLeave: hidePreview, onBackgroundClick: releasePinFromBackground })}
          </div>
        ) : null}
        {renderGraph && (direct.length || via.length) ? <FilterHint activeTitle={activeTitle} pinned={lit.filterTargetId === pinnedId && !!pinnedId} /> : null}
        <RelationCards source={aim} direct={direct} via={via} filterTargetId={filterTargetId} onSelect={onSelect}
          onHighlightTarget={setHoveredCardTarget} onHighlightCenter={setCenterFromCard} emptyLabel={emptyLabel} />
      </div>
    </React.Fragment>
  )
  return (
    <div ref={outerRef} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 2px)', minWidth: 0, userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* THE BREADCRUMB ROW KEEPS ITS HEIGHT WITH NOTHING AIMED AT, and it does it by drawing
         the same component invisibly rather than by a number — so the reserved height cannot
         drift from the real one the day the crumb's type or padding changes. */}
      {aim ? <Breadcrumb path={path} domain={domain} onSelect={onSelect} /> : (
        <div aria-hidden="true" style={{ visibility: 'hidden' }}><Breadcrumb path={[{ id: '\u00a0', title: '\u00a0' }]} domain={domain} /></div>
      )}
      <div ref={layerRef} data-tip-layer="1" style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {preview && preview.info ? (
          <div style={{ position: 'absolute', left: preview.x, top: preview.y, zIndex: 1000, pointerEvents: 'none' }}>
            <NodePreviewCard {...preview.info} />
          </div>
        ) : null}
        <div style={{ flex: '0 0 auto', width: collapsed ? 0 : leftBoxW, overflow: 'hidden', transition: dragging ? 'none' : 'width 220ms ease', height: '100%' }}>
          {/* `data-selected-id` is the roving keyboard CURSOR, not the light: it stays on the
              aim even with nothing selected, so an arrow key resumes from where the pane is
              pointed rather than from the top of the tree. */}
          <div ref={leftRef} tabIndex={0} onKeyDown={(e) => treeKeyNav(e, leftRef.current)} data-selected-id={aimId || undefined}
            style={{ width: leftBoxW, minWidth: 0, paddingRight: 4 + scrollerPadRight(), height: '100%', overflowY: 'auto', outline: 'none', boxShadow: 'none', position: 'relative' }}>
            <div style={{ paddingRight: 16 }}><PaneColumnHeader title="Contains" note={tree ? containsSummary(tree) : ''} minHeight={40} /></div>
            <CollapseChevron collapsed={false} onClick={() => setCollapsed(true)} title="Hide contains" style={{ position: 'absolute', top: 0, right: 0 }} />
            <FilterInput value={query} onChange={setQuery} />
            <ContainTree key={tree ? tree.id : 'none'} root={tree || (aim ? { id: aim.id, title: aim.title } : { id: '', title: '' })} domain={domain} compact scale={scale} counts={treeCounts}
              selectedId={litId} hoveredId={hoveredTreeId} onSelect={onSelect} query={query} persistKey={treeOpen ? null : pk('_open')}
              open={treeOpen} onOpenUpdate={onTreeOpenChange}
              onNodeEnter={(e, node) => showPreviewAt(e, node, 'tree')} onNodeLeave={hidePreview} />
          </div>
        </div>
        <div onMouseDown={(collapsed || narrow) ? undefined : onDividerDown} onDoubleClick={(collapsed || narrow) ? undefined : fitToContent}
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          title={collapsed ? 'show contains' : 'drag to resize \u00b7 double-click to fit'}
          style={{ flex: 'none', width: PM.divider, cursor: (collapsed || narrow) ? 'pointer' : 'ew-resize', position: 'relative' }}>
          {(collapsed || narrow) ? null : <div style={{ position: 'absolute', top: 0, bottom: 0, left: 6, width: 1, background: dragging ? 'var(--accent-primary)' : 'var(--border-hair)' }} />}
          {collapsed ? <div style={{ position: 'absolute', top: 2, left: 0, width: PM.divider, display: 'flex', justifyContent: 'center' }}><CollapseChevron collapsed onClick={(e) => { e.stopPropagation(); setCollapsed(false) }} title="Show contains" /></div> : null}
        </div>
        {/* the SLIDE: both columns stay mounted always; a wrapper's WIDTH transitions between 0
            and full size with overflow:hidden clipping the inside, whose fixed width never
            reflows mid-transition. Wide: the graph column is flex:1 and reflows into freed
            space for free. Narrow: the SAME technique runs on both columns at once. */}
          {/* THE COLUMN'S OWN ROOM ON THE RIGHT, and FIREFOX IS WHERE THIS BITES (owner, the
             screenshot's engine, 2026-09-17). `scrollbarGutter: 'stable'` reserves the bar's
             width where the bar HAS one and nothing at all where it does not — and Firefox's
             `scrollbar-width: thin` bar takes no layout space, so the rows ran underneath it.
             `scrollerPadRight()` is the measured answer: 0 when the gutter is real, else
             `SCROLLBAR_ROOM`. */}
        {narrow ? (
          <div style={{ flex: '0 0 auto', width: collapsed ? fullW : 0, overflow: 'hidden', transition: dragging ? 'none' : 'width 220ms ease', height: '100%' }}>
            <div style={{ width: fullW, paddingLeft: 4, paddingRight: scrollerPadRight(), height: '100%', scrollbarGutter: 'stable', overflowX: 'hidden', overflowY: 'auto' }}>{relContent}</div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, paddingLeft: collapsed ? 8 : 4, paddingRight: scrollerPadRight(), height: '100%', scrollbarGutter: 'stable', overflowX: 'hidden', overflowY: 'auto' }}>{relContent}</div>
        )}
      </div>
    </div>
  )
}
