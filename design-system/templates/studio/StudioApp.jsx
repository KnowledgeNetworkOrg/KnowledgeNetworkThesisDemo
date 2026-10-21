// Studio template app — THE shell, and the only one (it was merged from the ui_kits/studio kit,
// whose copy was deleted 2026-09-20; CLAUDE.md: the shell exists once).
// Mounted by Studio.dc.html via <x-import from="./StudioApp.jsx">.

// The design-system bundle and data.js load asynchronously, and this module is
// evaluated as soon as it is fetched — so nothing here may read a global at
// module scope. Bindings are declared empty and filled by bindDeps() on the
// first render that finds both globals present.
let NS
let Pane, PaneScroller, IconButton
let DomainDot, NodeChip, EdgeLegend, EdgeEntry, NodeRail, TreeRow, TrailChip, StepDot, WalkCard, PaneHeader, PillButton, CountBadge, DocHeader, SectionLabel, PresetButton, InstrumentRow, InstrumentGroup, FamilyColumn, Toolbar, LeafMark, AppHeader, NewMapMark, PrintMark, SaveMark, LoadMark, CopyMark, PasteMark
let DOMAINS, byId, edges, WALKS, EDGE_LABEL, edgesTouching, pathTo, ROOT
let PresenterScreen, PresentStartCard, LoadDialog
/* EVERY TOOLTIP IS WIDTH-LIMITED, the shell's two included — see the Tooltips card. Identity
   until the bundle is bound, and identity on a bundle too old to carry `Clipped`, because a
   tooltip that is one line too wide is a far smaller fault than a shell that throws on render. */
let wrapTip = (t) => t
/* THE PALETTE'S MORPH, on the same terms as `wrapTip` above: bound from the namespace when
   the bundle carries it, and a working identity until then. The fallback calls the same hook
   in the same order, so swapping the binding between renders cannot break the hook rules; it
   simply hands back names nothing matches, and the palette cuts instead of morphing. */
let useMorph = (id, open) => React.useMemo(() => ({ trigger: 'none', panel: 'none', run: (fn) => fn() }), [id, open])
let bound = false
function bindDeps() {
  if (bound) return true
  const ns = window.KnowledgeNetworkDesignSystem_0ec749
  const kns = window.KNS
  if (!ns || !kns) return false
  /* the presenter screen is its own file (`PresenterScreen.jsx`), loaded beside this one by the
     template and published on `window` — wait for it the same way */
  if (!window.PresenterScreen) return false
  PresenterScreen = window.PresenterScreen
  /* Pane arrived 2026-08-17, and the compiled bundle is one turn behind the sources —
     so wait for it by NAME rather than for the namespace to merely exist. Binding a
     stale bundle gives `Pane === undefined` and the whole studio throws on render. */
  if (!ns.Pane || !ns.PaneScroller || !ns.NodeRail) return false
  NS = ns
  if (ns.Clipped && ns.Clipped.wrapTip) wrapTip = ns.Clipped.wrapTip
  if (ns.ViewMorph && ns.ViewMorph.useMorph) useMorph = ns.ViewMorph.useMorph
  /* the pane measurement is the RAILS' now — bound here rather than kept, so the shell is not a
     second copy of a hook whose contract it also has to obey.
     BOUND BY CAPABILITY, NOT BY PRESENCE, and that is the compiled-bundle lag made safe: this
     shell runs against a bundle one turn behind its own sources, so on the turn a fix lands in
     the published hook, binding it by name would bind the version WITHOUT the fix and undo the
     work in the same breath (measured 2026-09-20: the rail kept refusing at 444px because the
     bound hook was the previous build's). The test names the fix — the render-time re-read —
     the way a card's stale guard names the change it is asserting. */
  if (ns.RailMath && ns.RailMath.usePaneWidth && String(ns.RailMath.usePaneWidth).indexOf('useLayoutEffect') >= 0) usePaneWidth = ns.RailMath.usePaneWidth
  ;({ Pane, PaneScroller, IconButton } = ns)
  ;({ DomainDot, NodeChip, EdgeLegend, EdgeEntry, NodeRail, TreeRow, TrailChip, StepDot, WalkCard, PaneHeader, PillButton, CountBadge, DocHeader, SectionLabel, PresetButton, InstrumentRow, InstrumentGroup, FamilyColumn, Toolbar, LeafMark, AppHeader, NewMapMark, PrintMark, SaveMark, LoadMark, CopyMark, PasteMark } = ns)
  ;({ DOMAINS, byId, edges, WALKS, EDGE_LABEL, edgesTouching, pathTo, ROOT } = kns)
  /* optional, like the presenter's parts: on a bundle one turn behind, ▶ starts at once as before */
  PresentStartCard = ns.PresentStartCard
  /* optional too: on a bundle one turn behind, Load stays inert as before */
  LoadDialog = ns.LoadDialog
  bound = true
  return true
}

/* The frame, the body and the scroller's bottom inset are Pane's now — the three
   rules they encode were prose until 2026-08-17 and were missed twice in the app. */

/* HOW WIDE THE PANE ACTUALLY IS — THE PUBLISHED HOOK, bound from the namespace in `bindDeps`
   (`RailMath.usePaneWidth`). What follows is the lagging-build fallback and nothing else: same
   contract, same hooks in the same order, so swapping the binding between renders cannot break
   the hook rules — the `wrapTip` / `useMorph` pattern above.
   TWO MECHANISMS, AND BOTH ARE NEEDED. A callback ref rather than a `useRef` (the effect on a
   ref object runs once, on whatever node existed at mount, and these panes SWAP the node at
   that position when the preview layer mounts on the second render — the observer then sits on
   a detached node and the width freezes at a NONZERO reading, which is worse than zero because
   every guard believes it). AND a read on every render, because a ResizeObserver notification
   can arrive arbitrarily late: measured here 2026-09-20, closing the palette grew this pane
   333 to 443 and the notification was still undelivered 700ms later, with the relations rail
   refusing to open in a pane that had room. */
let usePaneWidth = function usePaneWidthFallback() {
  const [w, setW] = React.useState(0)
  const node = React.useRef(null)
  const obs = React.useRef(null)
  const setBox = React.useCallback((n) => {
    if (obs.current) { obs.current.disconnect(); obs.current = null }
    node.current = n
    if (!n || typeof ResizeObserver === 'undefined') return
    setW(Math.round(n.getBoundingClientRect().width))
    const ro = new ResizeObserver((entries) => { const cw = entries[entries.length - 1].contentRect.width; if (cw > 0) setW(Math.round(cw)) })
    ro.observe(n)
    obs.current = ro
  }, [])
  React.useLayoutEffect(() => {
    const n = node.current
    if (!n) return
    const now = Math.round(n.getBoundingClientRect().width)
    if (now > 0) setW((prev) => (prev === now ? prev : now))
  })
  return [w, setBox]
}
/* THE FLOORS THE TWO PANES DECLARE ARE THE RAILS' OWN, read from the published metrics. The
   fallback pair is stated once, for the turn a compile is behind, and it is a DERIVATION rather
   than a second authority: 140 + 190 and 186 + 210, the rail's narrowest useful width plus what
   the pane's own content must keep. The registry below is evaluated at module load, before the
   shell binds `NS`, so this reads the namespace off `window` at call time. */
const railFloor = (side) => {
  const M = (window.KnowledgeNetworkDesignSystem_0ec749 || {}).RailMath
  return M ? M.floor(side) : (side === 'left' ? 330 : 396)
}
/* ── THE DESK'S WIDTHS ARE THE PROFESSOR'S — `PaneDivider` wired into this shell 2026-09-20 on
      the owner's ask, which is OB-170's host side built here first. The handle and the clamp are
      the system's (`NS.PaneDivider`, `NS.DeskMath`); everything below is the FOUR HOST
      OBLIGATIONS the contract names and nothing else:
      1. THE WIDTHS LIVE HERE. The handle only ever reports travel; `pref` is this shell's store.
      2. THE DRAWN WIDTH IS DERIVED FROM THE MEASURED ROW EVERY RENDER — which is why `pref`
         holds FRACTIONS and never px: a width chosen on a wide desk cannot then push the handle
         past the edge of a narrow one, where the row's clip would eat the very handle you need.
      3. THE STORE IS WRITTEN ON `onDragEnd` ONLY, with what the professor dragged to. `fitRow`'s
         clamping is never written back, so a desk that has been narrow once still returns to
         the layout they set.
      4. EVERY PANE DECLARES A FIT, below.
      AND THIS REVERSES OB-046 (an edge splitter, declined 2026-08-21e — "the widths stay in the
      code"), superseded by the owner's 2026-09-09 ruling that the dividers should DRAG. What is
      still declined is `grabbable`/`resizable` ON a docked pane — see the row's own note. ── */
const treeW = () => {
  const v = typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tree-w')) : NaN
  return Number.isFinite(v) && v > 0 ? v : 240
}
/* A PANE'S TWO NUMBERS. `narrowBelow` is where it draws a LESSER READING and is the rail's own
   floor — below it the rail is not drawn and the pane is prose or atlas alone. `floor` is where
   it stops working, and for the two railed panes it is DERIVED: `keep`, the width the pane's own
   content must be left with once the rail is gone (190 left, 210 right, from the published
   metrics). Connections sets the two equal — a statement, not a gap: it has nothing to degrade
   to. The tree's 180 is CHOSEN: one column of pills, narrower than its 240 but still a column. */
const deskFit = (id) => {
  const M = (window.KnowledgeNetworkDesignSystem_0ec749 || {}).RailMath
  const keep = (side) => (M && M.metrics ? M.metrics[side].keep : (side === 'left' ? 190 : 210))
  if (id === 'nested') return { narrowBelow: railFloor('left'), floor: keep('left') }
  if (id === 'doc') return { narrowBelow: railFloor('right'), floor: keep('right') }
  if (id === 'children') return { narrowBelow: 360, floor: 360 }
  /* the walk editor's numbers are CHOSEN and stand in for the app's: this kit does not draw the
     editor, so there is nothing of its own to measure. 320 keeps the placeholder's two lines at
     their measure; the app's editor should declare its own fit (OB-252). */
  if (id === 'railroad') return { narrowBelow: 360, floor: 320 }
  return { narrowBelow: treeW(), floor: 180 }
}
/* the preset's own arrangement in px — the flex shares the desk had before it could be dragged,
   so an untouched desk and a reset desk both look exactly as they always did. */
const deskSeed = (active, avail) => {
  const inst = active.map((id) => INSTRUMENTS.find((x) => x.id === id) || { flex: 1 })
  const fixed = inst.map((x) => (x.flex ? 0 : treeW()))
  const room = Math.max(0, avail - fixed.reduce((a, b) => a + b, 0))
  const fsum = inst.reduce((a, x) => a + (x.flex || 0), 0) || 1
  return inst.map((x, i) => (x.flex ? room * x.flex / fsum : fixed[i]))
}
/* obligation 2's arithmetic: proportion into the row that was MEASURED, then honour the floors
   and take the surplus back from whoever has slack. */
const deskFitRow = (px, total, floors) => {
  const sum = px.reduce((a, b) => a + b, 0) || 1
  let out = px.map((v) => v * total / sum)
  for (let pass = 0; pass < 4; pass++) {
    out = out.map((v, i) => Math.max(v, floors[i]))
    const over = out.reduce((a, b) => a + b, 0) - total
    if (over <= 0.5) break
    const slack = out.map((v, i) => Math.max(0, v - floors[i]))
    const slackSum = slack.reduce((a, b) => a + b, 0)
    /* A DESK NARROWER THAN THE SUM OF ITS FLOORS is a real state (a small window, three panes),
       and the honest answer is to scale everything rather than let the last pane overflow the
       row — an overflowing pane takes the handle out of reach, which is the same fault
       obligation 2 exists to prevent, arriving from the other side. */
    if (slackSum <= 0.5) { const s = out.reduce((a, b) => a + b, 0) || 1; out = out.map((v) => v * total / s); break }
    out = out.map((v, i) => v - over * slack[i] / slackSum)
  }
  return out.map((v) => Math.round(v))
}
/* EVERY DIVIDER'S SETTING SURVIVES A RELOAD (owner, 2026-09-23). The store is the HOST's — the
   handle and the rails keep nothing — so the persistence is here, one key per boundary. It is
   written only when the state changes, and every divider changes its state on release only, so
   one drag is one write. What is stored is what the professor dragged to, never a clamped width:
   the clamp runs again on load against whatever row the window now has. A value that fails to
   parse is ignored rather than trusted; private mode keeps the setting for the session. */
const STORE_PREFIX = 'kn-studio:'
function useStoredState(key, fallback) {
  const [v, setV] = React.useState(() => {
    try { const raw = window.localStorage.getItem(STORE_PREFIX + key); if (raw != null) return JSON.parse(raw) } catch (e) { /* unreadable: use the fallback */ }
    return fallback
  })
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) { first.current = false; return }
    try { if (v == null) window.localStorage.removeItem(STORE_PREFIX + key); else window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(v)) } catch (e) { /* private mode */ }
  }, [key, v])
  return [v, setV]
}
window.KnStudioStore = { useStoredState }
function useDesk(active) {
  /* the row measures itself with the rails' published hook — the same read-every-render contract,
     not a second copy of it */
  const [rowW, setRowBox] = usePaneWidth()
  const [pref, setPref] = useStoredState('desk', {})   // fractions per composition, keyed by `active`
  const [live, setLive] = React.useState(null)   // px, only while a gesture is in flight
  const gesture = React.useRef(null)             // the widths AS THEY WERE when the drag began
  const key = active.join('|')
  React.useEffect(() => { setLive(null); gesture.current = null }, [key])
  const M = NS && NS.DeskMath
  const ready = !!(M && NS.PaneDivider && rowW > 0 && active.length > 1)
  const fits = active.map(deskFit)
  const hit = M ? M.METRICS.hit : 14
  const avail = Math.max(0, rowW - Math.max(0, active.length - 1) * hit)
  let sizes = null
  if (ready) {
    const saved = pref[key] && pref[key].length === active.length ? pref[key] : null
    const base = saved ? saved.map((f) => f * avail) : deskSeed(active, avail)
    sizes = (live && live.length === active.length) ? live : deskFitRow(base, avail, fits.map((f) => M.fit(f).floor))
  }
  /* obligation 3: the ONLY write, and it stores the gesture's own answer as fractions of the row
     it was made in. Clearing `live` in the same batch hands the next render back to the derived
     path, so nothing holds a px width across a resize. */
  const store = (next) => {
    const tot = next.reduce((a, b) => a + b, 0) || 1
    setLive(null)
    setPref((p) => Object.assign({}, p, { [key]: next.map((v) => v / tot) }))
  }
  return {
    ready, setRowBox,
    paneStyle: (i, inst) => (ready
      ? { flex: '0 0 ' + sizes[i] + 'px', minWidth: 0, display: 'flex' }
      : { flex: inst.flex ? inst.flex + ' 1 0%' : '0 0 var(--tree-w)', minWidth: 0, display: 'flex' }),
    divider: (i) => {
      if (!ready) return null
      const nameOf = (id) => ((INSTRUMENTS.find((x) => x.id === id) || {}).label || 'pane').toLowerCase()
      /* the delta is measured from the gesture's START, so it is applied to `gesture.current` and
         never to the live widths — applied to those, each move adds the whole travel again and
         the handle accelerates away from the pointer. And the end callback re-runs the clamp
         with the delta it is HANDED rather than reading `sizes`, which on a key nudge has not
         rendered yet. Both are the contract's own warnings. */
      const clamp = (base, d) => M.clamp({ sizes: base, index: i, delta: d, fits })
      return (
        <NS.PaneDivider key={'desk-' + i} label={'resize ' + nameOf(active[i]) + ' and ' + nameOf(active[i + 1])}
          onDrag={(d) => { if (!gesture.current) gesture.current = sizes.slice(); setLive(clamp(gesture.current, d)) }}
          onDragEnd={(d) => { const base = gesture.current || sizes; gesture.current = null; store(clamp(base, d)) }}
          onReset={() => { gesture.current = null; store(clamp(deskFitRow(deskSeed(active, avail), avail, fits.map((f) => M.fit(f).floor)), 0)) }}
          {...M.bounds({ sizes, index: i, fits })} />
      )
    },
  }
}

/* THE RAIL'S OWN NUMBERS ARE THE RAIL'S NOW. The widths, the floors, the shrink-then-go rule,
   the corner button and its muted no-room note all moved into `RailFrame` on 2026-09-20 (owner's
   ruling: the app mounts whole rails). What was here was ~45 lines of chrome living in a shell
   that nothing ports — which is exactly why four faults on these two rails reached the owner in
   one day. The floors are still what the two panes declare as their `min`, read from the
   published metrics rather than restated: see the instrument registry below. */

/* ── Map — the nested atlas, read as territory: a domain contains modules,
      a module contains topics. Containment is depth: a group is a WELL.
      IT CARRIES THE EXPLORER RAIL NOW (2026-09-20, OB-226/227/228). The connections split
      pane is retired: its contains column lives here, as the shipped `ContainTree`, and its
      relations column lives on the document pane. One selection drives both the rail and the
      map — clicking a pill focuses the node, focusing on the map lights the pill — and the
      rail answers a hover with the node's own preview, drawn on the pane's single
      `NodePreviewLayer`. Nothing here re-implements a tree, a card or a clamp. ── */
function corpusTree() {
  /* THE ROOT IS READ DEFENSIVELY, and that is not politeness: this kit's `data.js` gained a real
     corpus ROOT node in September, and a browser holding the previous file serves a `byId` with
     no `root` in it — which threw on `byId.root.title` and blanked the whole shell behind one
     boundary. A shell binds a corpus it does not own; it reads what is there and names what is
     missing. */
  const rootNode = byId.root || ROOT
  const territories = DOMAINS.map((d) => domainTreeOf(d.id)).filter(Boolean)
  /* AND WHEN THERE IS NO ROOT NODE, THE TERRITORIES ARE THE TOP LEVEL — the rail never invents
     a row (owner, 2026-09-20: the Explorer's top level should be the top-level NODE). It used
     to fall back to a synthetic row titled `Corpus`, which is a word this corpus does not use
     and a node nothing can select, focus or light: the rail's first row then belonged to no
     screen, and on a browser holding a data file from before the root landed that invented row
     was the only thing anyone saw. Read what is there, and where it is not, SAY SO in the row
     rather than filling the gap with a plausible word — an invented title is indistinguishable
     from a real one, which is how this went unreported. */
  if (!rootNode) return { id: 'root', title: 'root node missing from this corpus', children: territories }
  return { id: rootNode.id, title: rootNode.title, domain: rootNode.domain, children: territories }
}
/* THE PATH AS NODES, not as the slash-joined STRING `pathTo` returns — `Breadcrumb` reports the
   node it was clicked on, so it needs ids and domains, and the document header needs the string.
   Two shapes of one walk, and the walk is the corpus's own `parent` chain. */
function pathNodes(id) {
  const out = []
  let cur = byId[id]
  while (cur) { out.unshift({ id: cur.id, title: cur.title, domain: cur.domain }); cur = cur.parent ? byId[cur.parent] : null }
  return out
}
function MapPane({ focus, onFocus, onClose, lit }) {
  const Layer = NS.NodePreviewLayer
  const [railOpen, setRailOpen] = React.useState(true)
  /* THE SEAM DRAGS (owner, 2026-09-23): the rail draws the handle, this pane keeps the number —
     null until the professor drags, which means the rail's own fit. */
  const [railW, setRailW] = useStoredState('rail:explorer', null)
  /* THE RAIL IS THE USER'S TO CLOSE, and it closes ITSELF when there is no room — both halves
     are `RailFrame`'s now, including the floor the pane's own `min` is built from. The pane
     keeps only the intent. */
  const [paneW, setBox] = usePaneWidth()
  const tree = React.useMemo(corpusTree, [])
  /* THE USER'S OWN OPEN MAP, AND THE SELECTION'S PATH FOLDED INTO IT ONCE PER SELECTION — never
     spread over it per render (owner-reported 2026-09-20: "after I select a node I cannot
     collapse/expand the nodes in the tree for a while"). Per render, the forced path wins again
     on the very next frame, so every ancestor of the selected node springs back open the
     instant it is collapsed and the carets read as dead until something else is selected.
     Folded once, the path opens when you arrive and every caret works immediately afterwards.
     THE FOLD INCLUDES THE NODE ITSELF, which the per-render rule forbids for exactly the same
     reason it forbade the ancestors — owner-asked in the same breath: selecting a container
     opens it. Once is what makes that safe.
     The app's map shows a SUBSET of the corpus and should fold `OpenForVisible(tree, shown)` in
     the same way; this kit's map draws every topic, so that call would open the whole tree and
     demonstrate nothing.
     BOUND BY CAPABILITY, not by name: the bundle is a turn behind whenever this changes, so
     the fallback composes the same map from the older published pair. */
  const [userOpen, setUserOpen] = React.useState({ root: 1 })
  const open = userOpen
  React.useEffect(() => {
    if (!focus) return
    const add = NS.OpenOnSelect ? NS.OpenOnSelect(tree, focus)
      : Object.assign({}, NS.OpenAncestors ? NS.OpenAncestors(tree, focus) : null, { [focus]: 1 })
    setUserOpen((o) => {
      let changed = false
      for (const k in add) { if (!o[k]) { changed = true; break } }
      return changed ? Object.assign({}, o, add) : o
    })
  }, [focus, tree])
  /* NOTHING SELECTED IS A STATE THIS PANE CAN BE IN (owner, 2026-09-20: the tree could not
     unselect). The DOCUMENT still reads `focus` — a reader always has something open, and
     clearing the tree must not blank the prose — so what clears is the SELECTION the tree and
     the map share: the lit pill and the selected ring. Any new focus from anywhere re-selects,
     which is why the flag is keyed off `focus` rather than toggled by hand in three places. */
  const [cleared, setCleared] = React.useState(false)
  React.useEffect(() => { setCleared(false) }, [focus])
  /* AND RE-SELECTING THE SAME NODE HAS TO CLEAR IT TOO (owner-reported 2026-09-20: "after I
     unselect a node in the explorer I cannot reselect it"). The effect above watches the focus
     VALUE, and deselecting deliberately leaves focus where it is — the document goes on reading
     that node — so clicking the same row again set focus to the value it already had, the
     effect did not fire, and the flag stayed up. Every gesture that CHOOSES a node therefore
     lowers the flag itself, and the effect stays as the backstop for a focus change arriving
     from outside this pane (a walk, the presenter, a jump). The general shape of the bug: a
     flag reset by watching a value cannot be reset by an action that re-asserts that value. */
  const choose = (id, via) => { setCleared(false); onFocus(id, via) }
  const sel = cleared ? null : focus
  /* THE MAP'S HOVER WASHES THE TREE ROW FOR THE SAME NODE (owner, 2026-09-22). The tree takes
     `hoveredId` for exactly this — mirroring another surface's cursor — and a tree hover still
     wins, because the pointer can only be in one place and the preview layer already knows
     which. Cleared only by the chip that set it, so a fast move from one chip to the next
     cannot have the first chip's leave wipe the second's enter. */
  const [mapHover, setMapHover] = React.useState(null)
  /* THE TREE'S POINTER, tracked directly. NOT the preview layer's `hovered`: that is the CARD's
     state, raised after the open delay and held through the close grace, so a wash driven by it
     arrived ~1.5s late and outlived the pointer (verifier-measured, 2026-09-22). */
  const [treeHover, setTreeHover] = React.useState(null)
  /* AND THE OTHER WAY: a tree hover washes the same node's chip on the map. It is NodeChip's own
     `hovered` input — the same wash the chip draws under the pointer — not a ring, because the
     rings are taken (selected, linked) and a hover is not a commitment. */
  const atlas = (treeHover) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {DOMAINS.map((d) => (
            <div key={d.id} style={{ background: 'var(--surface-sunken)', boxShadow: 'var(--sink-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 'var(--space-2)' }}>
                <DomainDot domain={d.id} size={10} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>{d.title}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                {d.modules.map((m) => (
                  <div key={m.id} style={{ background: 'var(--surface-sunken-2)', boxShadow: 'var(--sink-1)', borderRadius: 'var(--radius-md)', padding: '8px 10px', minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', marginBottom: 7 }}>{m.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                      {m.topicIds.map((id) => (
                        /* THE DOCUMENT RAIL'S HOVER LIGHTS THE MAP (OB-230): `lit` is the id the
                           relationship card is pointing at, and it takes the LINKED ring rather
                           than the selected one — they are different states and must not wear
                           one mark. */
                        <span key={id} onMouseEnter={() => setMapHover(id)} onMouseLeave={() => setMapHover((h) => (h === id ? null : h))} style={{ maxWidth: '100%', display: 'flex', boxShadow: sel === id ? 'var(--ring-selected)' : (lit === id ? 'var(--ring-linked)' : 'none'), borderRadius: 'var(--radius-md)' }}>
                          <NodeChip title={byId[id].title} domain={d.id} wrap hovered={treeHover === id} onClick={() => choose(id, 'MAP')} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
  )
  const body = ({ show, hide, hovered }) => (
    <div ref={setBox} style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
      {/* THE RAIL IS ONE COMPONENT NOW (owner's ruling, 2026-09-20): the filter, the tree, the
          header, the handle, the closed corner button and the width floor are all
          `ExplorerRail`'s, and this pane hands it a corpus and a selection. What it used to be
          is 20 lines of chrome in a shell no port reads — which is how four separate faults on
          this rail reached the owner in one day. */}
      {typeof NS.ExplorerRail === 'function' ? (
        <NS.ExplorerRail root={tree} selectedId={sel} deselectable
          onSelect={(node) => (node ? choose(node.id, 'EXP') : setCleared(true))}
          open={open} onOpenUpdate={setUserOpen} paneW={paneW} width={railW} onWidthChange={setRailW}
          railOpen={railOpen} onRailOpenChange={setRailOpen} closedControl="host"
          hoveredId={treeHover || mapHover}
          onNodeEnter={(e, node) => { setTreeHover(node.id); show(e, { domain: node.domain, title: node.title, summary: summaryOfNode(node.id), contains: (node.children && node.children.length && NS.ContainMath) ? NS.ContainMath.summary(node) : undefined }, 'tree', node.id) }}
          onNodeLeave={(e) => { const id = e && e.currentTarget && e.currentTarget.getAttribute ? e.currentTarget.getAttribute('data-node-id') : null; setTreeHover((h) => (id == null || h === id ? null : h)); hide(e) }} />
      ) : <div style={{ flex: '0 0 160px', fontSize: 'var(--fs-micro)', color: 'var(--text-3)', padding: 8 }}>ExplorerRail is not in this compiled bundle yet — it recompiles one turn behind</div>}
      <div style={{ flex: '1 1 260px', minWidth: 200, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* THE MAP'S OWN UPPER ROW (the idea sheet's shape, owner 2026-09-20): where the
            selection SITS, as a path you can walk back up, with the closed rail's way back as
            the row's first item rather than floating over it. The map itself says what is
            selected by a ring; it cannot say what that node is UNDER without drawing the
            ancestry across the canvas. */}
        {/* ON THE PANE'S FIRST LINE (`FIRST_LINE`, 2026-09-22), level with the Explorer's head beside
            it: `FIRST_ROW_PAD`, the same pad the head takes. It was `FIRST_ROW_PAD` less 1, on the
            belief that a crumb's box sits 1px above its text; measured 2026-09-27 at dpr 1.5, that
            put the crumb's BASELINE 1px above the head's (34.67 against 35.67, both 11px Nunito, one
            pane). At 14 the two baselines are equal. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: (NS.FIRST_ROW_PAD ?? 14) + 'px var(--space-3) 5px', borderBottom: '1px solid var(--border-hair)', minWidth: 0 }}>
          {typeof NS.ExplorerRailCorner === 'function'
            ? <NS.ExplorerRailCorner paneW={paneW} open={railOpen} onOpenChange={setRailOpen} style={{ flex: '0 0 auto' }} />
            : null}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            {typeof NS.Breadcrumb === 'function'
              ? <NS.Breadcrumb dense path={pathNodes(focus)} onSelect={(node) => choose(node.id, 'CRUMB')} />
              : null}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 'var(--space-3)' }}>{atlas(treeHover)}</div>
      </div>
    </div>
  )
  /* THE MAP'S TALLY ON ITS OWN FRAME (OB-233 D1, owner 2026-09-27): the corpus's size, not the
     view's — how many nodes and relations the map is drawn from. */
  const tally = Object.keys(byId).length + ' nodes · ' + edges.length + ' relations'
  return (
    <Pane title="map" onClose={onClose} tally={tally} data-screen-label="map" scroll="none" bodyStyle={{ padding: 0, marginTop: 0, overflow: 'hidden' }}>
      {typeof Layer === 'function'
        ? <Layer>{body}</Layer>
        : body({ show: () => {}, hide: () => {}, hovered: null })}
    </Pane>
  )
}

/* ── Tree — the same corpus as a literal indented list ─────────────────── */
function TreePane({ focus, onFocus, onClose }) {
  const [open, setOpen] = React.useState(() => new Set(['root', 'net', 'stk']))
  const toggle = (id) => setOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <Pane title="tree" onClose={onClose} data-screen-label="tree"
      style={{ flex: '0 0 var(--tree-w)' }} bodyStyle={{ paddingBlock: 'var(--space-3) 6px' }}>
        {/* THE ROOT ROW, and the depths below it start at 1 (owner, 2026-09-15). This pane drew
           the six territories at depth 0 and the corpus root nowhere, which is one level short of
           the app's own tree — the fault the owner found by comparing the map against the
           Connections tree. The root is an ordinary `TreeRow` with `root`: colourless mark, and it
           discloses and selects like the rest. */}
        <TreeRow title={byId.root.title} root container expanded={open.has('root')} current={focus === 'root'}
          onToggle={() => toggle('root')} onSelect={() => onFocus('root', 'TREE')} />
        {open.has('root') && DOMAINS.map((d) => (
          <React.Fragment key={d.id}>
            <TreeRow title={d.title} domain={d.id} depth={1} container expanded={open.has(d.id)} current={focus === d.id}
              onToggle={() => toggle(d.id)} onSelect={() => onFocus(d.id, 'TREE')} />
            {open.has(d.id) && d.modules.map((m) => (
              <React.Fragment key={m.id}>
                <TreeRow title={m.title} domain={d.id} depth={2} container expanded={open.has(m.id)} current={focus === m.id}
                  onToggle={() => toggle(m.id)} onSelect={() => onFocus(m.id, 'TREE')} />
                {open.has(m.id) && m.topicIds.map((id) => (
                  <TreeRow key={id} title={byId[id].title} domain={d.id} depth={3} current={focus === id}
                    linkCount={edgesTouching(id).length} onSelect={() => onFocus(id, 'TREE')} />
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
    </Pane>
  )
}

/* ── Connections — the neighbourhood as a RAILROAD: the focus at the head of a
      rail, every neighbour hanging off it as a stop, and the rung carrying the
      one number that matters at rest — how many relationships run between the
      two. It scales in the only direction a pane can afford to grow: a hundred
      neighbours is a longer rail, not a denser one, and nothing overlaps at any
      count because nothing shares a row.
      Opening a stop lists its relationships in full, split into the ones
      authored on the focus itself and the ones it inherits through its
      children — "this depends on X" and "something inside this depends on X"
      are different claims. ──────────────────────────────────────────────── */
/* a relation the corpus authors as symmetric (its own comments mark see_also ⇄)
   points both ways, whichever way round the single authored edge runs —
   direction there is an artifact of authoring order, not a claim the data makes */
const SYMMETRIC = { see_also: true }

/* the focus's own subtree — itself, plus every node beneath it. A container holds
   no typed links of its own: the corpus authors links between topics, and a module
   is a container of topics. Rolling its children's links up is the only way a
   container has a neighbourhood at all, and it is a true reading of one — "something
   inside Protocol Stack builds on Public-Key Cryptography" is a claim about the
   module. Which child carries it is what the entry has to say, or the reader cannot
   tell why the link is filed there. */
function subtree(focus) {
  const mine = new Set([focus])
  for (const id of Object.keys(byId)) {
    for (let cur = byId[id]; cur && cur.parent; cur = byId[cur.parent]) { if (cur.parent === focus) { mine.add(id); break } }
  }
  return mine
}
/* an edge belongs to the rail when it crosses the subtree's boundary — exactly one
   end inside. Both ends inside is internal wiring, and drawing it would put the
   focus on both ends of its own entry. For a topic the subtree is just itself, so
   this is the same set as before. */
function roadsFor(mine) {
  return edges.filter((e) => mine.has(e.source) !== mine.has(e.target))
}

/* the ancestry from the focus down to — but not including — the node that holds the
   link. Two levels down it has to say both: a domain focus reading "Networking / TCP
   & UDP" silently drops the module the topic actually sits in. */
function pathFrom(focus, id) {
  const out = []
  for (let cur = byId[id]; cur && cur.id !== focus; cur = byId[cur.parent]) out.unshift(cur.title)
  out.unshift(byId[focus].title)
  out.pop()
  return out.join(' / ')
}

function neighbourhood(focus, roads, mine) {
  const m = {}
  for (const e of roads) {
    const out = mine.has(e.source)
    const id = out ? e.target : e.source
    const near = out ? e.source : e.target
    const s = (m[id] = m[id] || { id: id, direct: [], via: [] })
    const dir = SYMMETRIC[e.type] ? 'both' : (out ? 'out' : 'in')
    /* the id, not the title: the entry prints the full path from the focus down to
       this node, and only the id can be walked back up */
    const via = near === focus ? null : near
    ;(via ? s.via : s.direct).push({ type: e.type, dir: dir, via: via })
  }
  return Object.keys(m).map((k) => m[k])
    .map((s) => Object.assign(s, { n: s.direct.length + s.via.length }))
    .sort((a, b) => b.n - a.n || byId[a.id].title.localeCompare(byId[b.id].title))
}

function EntryGroup({ title, items, render }) {
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, paddingBottom: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)' }}>{items.length}</span>
      </div>
      {items.map(render)}
    </div>
  )
}

/* WHAT STAYS THE HOST'S: which relationships a stop is actually offering. Which edges
   exist, how they read, and whether one is authored here or inherited through a child are
   all corpus knowledge, so the well's CONTENTS are handed to the rail rather than found by
   it. The stroke colour comes from `type` — EdgeEntry resolves it through the palette —
   and the LABEL stays the corpus's own (`EDGE_LABEL`): a kind's wording is corpus data. */
function wellFor(s, focus, onFocus) {
  const node = byId[s.id]
  const entry = (l, i, from, fromDomain, within) => (
    <EdgeEntry key={i} from={from} fromDomain={fromDomain} fromAnchor fromWithin={within} to={node.title} toDomain={node.domain}
      relation={EDGE_LABEL[l.type]} type={l.type} direction={l.dir} onTo={() => onFocus(s.id, 'LNK', true)} />
  )
  return (
    <React.Fragment>
      <EntryGroup title="direct" items={s.direct} render={(l, i) => entry(l, 'd' + i, byId[focus].title, byId[focus].domain)} />
      <EntryGroup title="via children" items={s.via} render={(l, i) => entry(l, 'v' + i, byId[l.via].title, byId[l.via].domain, pathFrom(focus, l.via))} />
    </React.Fragment>
  )
}

function ConnectionsPane({ focus, onFocus, onClose }) {
  const n = byId[focus]
  const mine = React.useMemo(() => subtree(focus), [focus])
  const roads = React.useMemo(() => roadsFor(mine), [mine])
  const stops = React.useMemo(() => neighbourhood(focus, roads, mine), [focus])
  /* a SET, not a single id: comparing two neighbours means having both open at
     once, and a rail that closed one stop to open another made you hold the
     first in your head */
  const [open, setOpen] = React.useState({})
  const [railOpen, setRailOpen] = React.useState(true)
  React.useEffect(() => { setOpen({}) }, [focus])
  /* the rail takes a flat list. `stop` is not the component's prop — extra keys on a spec
     pass through untouched and arrive in renderBody, which is how a caller carries its own
     row object without the rail knowing anything about a corpus. */
  const railStops = React.useMemo(() => stops.map((s) => ({ id: s.id, title: byId[s.id].title, domain: byId[s.id].domain, count: s.n, stop: s })), [stops])
  const toggle = (id) => setOpen((o) => { const m = Object.assign({}, o); if (m[id]) delete m[id]; else m[id] = 1; return m })
  return (
    <Pane title="connections" onClose={onClose} data-screen-label="connections">
      {/* THE RAIL IS ONE COMPONENT — NodeRail owns the head, the leader stub, the spine,
          the acts and their reserved space (IconButton reveal + CaretStack), the chip, and
          the count/caret pair. The pane's job is three things: give it a scrolling body,
          decide which neighbours are on it, and hold the open set. The kit's pane converged
          on the component on 2026-08-20; this file kept a hand-drawn copy of all of it —
          including a caret NUDGE table still carrying the pre-CARET_INK 1px translate —
          until 2026-08-21. A template teaches by example, and it was teaching the version
          the component exists to retire. */}
      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
        <NodeRail title={n ? n.title : ''} domain={n && n.domain} stops={railStops} open={open}
          onToggleStop={toggle} railOpen={railOpen} onToggleRail={() => setRailOpen((v) => !v)}
          onExpandAll={() => setOpen(stops.reduce((m, s) => { m[s.id] = 1; return m }, {}))}
          onCollapseAll={() => setOpen({})}
          totals={stops.length + ' neighbours · ' + roads.length + ' edges'}
          emptyLabel={n && n.kind === 'container' ? 'nothing beneath this links outside it' : 'no typed links from this topic'}
          renderBody={(spec) => wellFor(spec.stop, focus, onFocus)} />
      </div>
    </Pane>
  )
}

/* ── THE CORPUS ADAPTERS THE TWO RAILS READ. They outlived the pane they were written for:
      `ConnectionsSplitPane` and its stand-in graph were deleted from this shell on 2026-09-20
      (OB-226 retires the pane), and the same three adapters now feed the Explorer rail on the
      map and the relations rail on the document. A shell binding a retired component is how a
      retirement quietly fails. ── */
const EDGE_HUE = { depends_on: 'var(--edge-depends-on)', uses: 'var(--edge-uses)', see_also: 'var(--edge-see-also)', implemented_with: 'var(--edge-implemented-with)' }
/* one Relation per (target, kind), decomposed — direction from the authored edge, symmetric
   kinds reading 'both' whichever way round the single authored edge runs */
function relationsOfNode(id) {
  return edges.flatMap((e, i) => {
    if (e.source !== id && e.target !== id) return []
    const out = e.source === id
    const otherId = out ? e.target : e.source
    const o = byId[otherId]
    return [{ id: 'e' + i, targetId: otherId, targetTitle: o.title, targetDomain: o.domain, kind: e.type, kindLabel: EDGE_LABEL[e.type], direction: SYMMETRIC[e.type] ? 'both' : (out ? 'out' : 'in') }]
  })
}
/* the hover preview's body — a walk's authored stop note when one passes through; prose is
   never invented, the skeleton is the honest fallback */
function summaryOfNode(id) {
  for (const w of WALKS) { const s = w.stops.find((x) => x.id === id); if (s) return s.note }
  return null
}
function domainTreeOf(domId, fallback) {
  const d = DOMAINS.find((x) => x.id === domId)
  if (!d) return fallback
  /* EVERY NODE CARRIES ITS OWN TOPIC (`domain`), which is what colours its pill — the corpus
     stores one per node and the tree has to pass it, or the whole column draws in one family
     (the fault the owner reported on the app, 2026-09-09). In this corpus a domain's whole
     subtree shares its topic, so the column reads as one family GRADED by the pill ladder;
     a tree spanning topics (the app's, whose root is a corpus node) draws each territory's
     own colour. */
  return { id: d.id, title: d.title, domain: d.id, children: d.modules.map((m) => ({ id: m.id, title: m.title, domain: byId[m.id].domain, children: m.topicIds.map((tid) => ({ id: tid, title: byId[tid].title, domain: byId[tid].domain })) })) }
}
/* ── THE RELATIONS RAIL'S CONTENTS, exactly as the idea sheet settled them: the ORBIT figure
      on top, and the relationship CARD as a hover rather than a standing list. The card was
      good and cost more room than a rail has; as a hover it costs nothing until it is asked
      for, and it opens over the PROSE — never over the figure being pointed at, which is how
      the old pane's card earned its complaint. ── */
function viaOf(focus) {
  const inside = subtree(focus)
  const out = []
  for (const id of inside) {
    if (id === focus) continue
    for (const r of relationsOfNode(id)) {
      if (inside.has(r.targetId)) continue /* both ends inside is internal wiring, not a neighbour */
      out.push({ path: [{ id: focus, title: byId[focus].title, domain: byId[focus].domain }, { id, title: byId[id].title, domain: byId[id].domain }], rel: r })
    }
  }
  return out
}
/* the card the orbit's hover opens — handed to `NodePreviewLayer` as its `card`, so the clamp,
   the layer and the placement are the shared ones and only the CONTENTS differ. */
function OrbitCard({ hotKey, focus, boxW }) {
  const n = byId[focus]
  if (!hotKey) return null
  if (hotKey === NS.ORBIT_SELF) return <NS.NodePreviewCard domain={n.domain} title={n.title} summary={summaryOfNode(focus)} contains={undefined} />
  const id = String(hotKey).split('|')[0]
  const kindOnly = String(hotKey).indexOf('|') > 0 ? String(hotKey).split('|')[1] : null
  const all = relationsOfNode(focus).filter((r) => r.targetId === id)
  const viaHit = viaOf(focus).filter((v) => v.rel.targetId === id)
  const rels = (all.length ? all : viaHit.map((v) => v.rel)).filter((r) => !kindOnly || String(r.kind) === kindOnly)
  if (!rels.length || typeof NS.RelSourceGroup !== 'function') return null
  const src = all.length ? { title: n.title, path: undefined, domain: n.domain } : { title: viaHit[0].path[1].title, path: [n.title], domain: viaHit[0].path[1].domain }
  const look = (r) => (NS.relationLook ? NS.relationLook(r) : { label: r.kindLabel || String(r.kind), color: 'var(--edge-mixed)', heads: r.direction || 'out' })
  const items = rels.map((r) => { const L = look(r); return { key: r.id, targetId: r.targetId, targetTitle: r.targetTitle, targetDomain: r.targetDomain, kindLabel: L.label, kindColor: L.color, heads: L.heads } })
  /* SIZED TO WHAT IT HOLDS (owner, 2026-09-30): the card measures its names and takes the width
     they need, 200..360px, on a layer that lets it leave the pane. The fixed-share fallback is
     the previous build's, kept one turn while the bundle catches up. */
  const fitFn = NS.REL_CARD_PARTS && NS.REL_CARD_PARTS.tipFit
  const inset = (NS.ConnectionsRails && NS.ConnectionsRails.METRICS && NS.ConnectionsRails.METRICS.inset) || 4
  const fit = fitFn ? fitFn({ sourceLabel: src.title, sourcePathParts: src.path, items }, window.innerWidth - inset * 2) : null
  const RM = NS.REL_CARD_METRICS || { rowPad: 2, rowGap: 3, groupChrome: 13, pillMin: 50, arrowMin: 38 }
  const W = fit ? fit.width : (boxW || 268), avail = W - 20 - RM.rowPad * 2 - RM.rowGap * 2
  const pillL = fit ? fit.leftWidth : Math.max(RM.pillMin, Math.min(88, Math.floor((avail - RM.groupChrome - RM.arrowMin) / 2)))
  const pillR = fit ? fit.rightWidth : pillL
  const arrowW = fit ? fit.arrowWidth : Math.max(RM.arrowMin, avail - RM.groupChrome - pillL - pillR)
  const padX = (NS.REL_TIP_METRICS && NS.REL_TIP_METRICS.padX) || 10
  return (
    <div style={{ width: W, boxSizing: 'border-box', background: 'var(--surface-raised)', border: '1px solid var(--border-rule)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: '4px ' + padX + 'px 6px' }}>
      {NS.REL_CARD_PARTS ? <NS.REL_CARD_PARTS.GroupHeader sentence label={all.length ? 'direct' : 'via children'} count={rels.length} /> : null}
      <NS.RelSourceGroup tip sourceLabel={src.title} sourcePathParts={src.path} sourceDomain={src.domain} sourceIsCenter={!!all.length}
        items={items}
        leftWidth={pillL} rightWidth={pillR} arrowWidth={arrowW} />
    </div>
  )
}

/* ── Document — reading happens here, and the RELATIONS RAIL sits beside it (2026-09-20,
      OB-226/229/230). The retired split pane's relations column moved here whole: the same
      `RelationCards`, grouped by source, reporting its two highlight channels outward. THE
      CENTRE IS ALWAYS THE DOCUMENT'S NODE — not a third piece of state the rail keeps — so
      the card, the prose and the map's selection can never disagree about what is being read. ── */
function DocPane({ focus, onFocus, onStartWalk, onClose, onLit, flag, onResolveFlag }) {
  const n = byId[focus]
  const [railOpen, setRailOpen] = React.useState(true)
  /* the seam's stored width, the same arrangement as the map's: the rail draws the handle */
  const [relW, setRelW] = useStoredState('rail:relations', null)
  const [paneW, setBox] = usePaneWidth()
  /* THE FIGURE'S OWN BOX, handed to the layer as what the card must not cover. The rail sits on
     the pane's right edge and the card is wider than the rail, so a pointer-anchored card is
     dragged across the figure by the clamp every single time — there is no pointer position in
     this rail that avoids it. `avoid` puts the card in the prose gutter instead. */
  const figRef = React.useRef(null)
  /* THE CARD IS SIZED TO THE GUTTER IT WILL SIT IN, not to a constant. Anchoring it beside the
     figure is only half the fix — a 268px card in a 219px prose gutter still overhangs the
     figure by 49px, and that looks exactly like no fix at all. The figure's box is the RAIL's
     own number, published for exactly this: a host sizing something beside the rail must read
     what the rail draws with, not a constant that agrees with it today. */
  const figW = NS.RelationsRailMath ? NS.RelationsRailMath.orbitBox(paneW, relW).width : 168
  const cardW = NS.ConnectionsRails && NS.ConnectionsRails.gutter ? NS.ConnectionsRails.gutter(paneW || 444, figW) : 268
  const direct = React.useMemo(() => relationsOfNode(focus), [focus])
  const via = React.useMemo(() => viaOf(focus), [focus])
  const through = WALKS.flatMap((w) => { const i = w.stops.findIndex((s) => s.id === focus); return i >= 0 ? [{ w, i }] : [] })
  const note = through.length ? through[0].w.stops[through[0].i].note : null
  const body = ({ show, hide, hovered }) => {
  const hotKey = hovered && hovered.source === 'orbit' ? hovered.id : null
  return (
      <div ref={setBox} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
        {/* THE DOCUMENT'S UPPER ROW SPANS THE PANE (the idea sheet's shape, owner 2026-09-20).
            It sat inside the prose column, so the relations rail started ABOVE the title of the
            thing it is about and scrolled away with the text — the rail then had nothing on
            screen naming its centre. Header first, both columns under it, and the rail's way
            back sits at this row's outer end, which is the corner it occupies when open. */}
        {/* THE CORNER GOES IN THE HEAD'S OWN `aside` (2026-09-30), so the head's rule runs under it
            with the rail closed. The row below is the previous build's shape, kept only until the
            bundle carries `aside` — it recompiles one turn behind. */}
        {String(DocHeader).indexOf('aside') >= 0 ? (
          <DocHeader kind={n.kind === 'topic' ? 'topic' : 'container'} title={n.title} domain={n.domain} ancestry={pathTo(focus)}
            titleMark={flag && typeof NS.StopFlag === 'function' ? <NS.StopFlag flag={flag} onResolve={() => onResolveFlag(flag.walkId, flag.stopId)} /> : null}
            aside={typeof NS.RelationsRailCorner === 'function'
              ? <NS.RelationsRailCorner paneW={paneW} open={railOpen} onOpenChange={setRailOpen} count={direct.length + via.length} />
              : null} />
        ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <DocHeader kind={n.kind === 'topic' ? 'topic' : 'container'} title={n.title} domain={n.domain} ancestry={pathTo(focus)} />
          </div>
          {typeof NS.RelationsRailCorner === 'function'
            ? <NS.RelationsRailCorner paneW={paneW} open={railOpen} onOpenChange={setRailOpen} count={direct.length + via.length} style={{ flex: '0 0 auto', margin: '14px var(--space-3) 0 0' }} />
            : null}
        </div>
        )}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
        <div style={{ flex: '1 1 260px', minWidth: 200, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-hair)' }}>
          {note ? (
            <p style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)' }}>{note}</p>
          ) : (
            <p style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-3)' }}>
              no document body in this kit — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)' }}>src/corpus/docs.ts</span> is not mirrored here, and prose is not invented. Nodes that a walk passes through show that walk's authored stop note instead.
            </p>
          )}
        </div>
        <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-5)' }}>
          <SectionLabel count={through.length}>walks through here</SectionLabel>
          {through.length === 0 ? (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>no authored walk stops here</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {through.map(({ w, i }) => (
                <WalkCard key={w.id} title={w.title} meta={'stop ' + (i + 1) + ' of ' + w.stops.length + ' \u2014 ' + w.stops[i].note} onClick={() => onStartWalk(w.id, i)} />
              ))}
            </div>
          )}
        </div>
        </div>
        {/* THE RAIL IS ONE COMPONENT NOW (owner's ruling, 2026-09-20). The figure, the reading
            under it, the two filters that join them, the header, the handle, the closed corner
            button and the width floor are all `RelationsRail`'s. What stays HERE is the one
            piece that cannot be the rail's: the CARD. It is wider than the rail and must open
            over the prose, never over the figure being pointed at, so it belongs to the pane's
            single `NodePreviewLayer` — which is also why `figureRef` goes down, so the clamp
            can avoid the drawing. The pane also owns what the hover LIGHTS on the map. */}
        {typeof NS.RelationsRail === 'function' ? (
          <NS.RelationsRail direct={direct} via={via} paneW={paneW} closedControl="host" width={relW} onWidthChange={setRelW}
            railOpen={railOpen} onRailOpenChange={setRailOpen} figureRef={figRef}
            hot={hotKey}
            onHot={(key, e) => { if (key) { show(e, { hotKey: key, focus, boxW: cardW }, 'orbit', key, { avoid: figRef.current }); onLit && onLit(key === NS.ORBIT_SELF ? focus : String(key).split('|')[0]) } else { hide(); onLit && onLit(null) } }} />
        ) : <div style={{ flex: '0 0 200px', fontSize: 'var(--fs-micro)', color: 'var(--text-3)', padding: 8 }}>RelationsRail is not in this compiled bundle yet — it recompiles one turn behind</div>}
        </div>
      </div>
  ) }
  /* ONE LAYER PER PANE (the contract's rule): it owns the hover state, clamps the card inside
     the pane and never flips it across the pointer. The CARD is swapped for the orbit's own —
     that is what `card` is for, and it is why the placement did not have to be rewritten for a
     relationship card that is nothing like a node preview. */
  return (
    <Pane title="document" onClose={onClose} data-screen-label="document" scroll="none" bodyStyle={{ padding: 0, marginTop: 0, overflow: 'hidden' }}>
      {typeof NS.NodePreviewLayer === 'function'
        ? <NS.NodePreviewLayer card={OrbitCard} bounds={NS.REL_CARD_PARTS && NS.REL_CARD_PARTS.tipFit ? 'window' : undefined} width={NS.REL_CARD_PARTS && NS.REL_CARD_PARTS.tipFit ? undefined : cardW}>{body}</NS.NodePreviewLayer>
        : body({ show: () => {}, hide: () => {}, hovered: null })}
    </Pane>
  )
}

/* ── Walk editor — the Plan mode's first pane, held as a PLACE. The app's editor is the road
      (`AuthorRoad.tsx`, transcribed in `tokens/spacing.css`'s `--road-*` block); this kit does not
      recreate it, and a fake editor would be read as a design. The placeholder names whose
      absence it is, which is `PanePlaceholder`'s first rule. ── */
function WalkEditorPane({ onClose, flagView, flags, onResolve, onLeaveFilter, onOpenStop }) {
  /* THE FLAGGED-ONLY VIEW (owner's option A, 2026-10-01; `ideas/walk-editor-flags.html`). The kit
     still does not draw the road, but this view IS the design: only the walk's flagged stops, this
     lecture's first, a vertical ellipsis between them and no arrows, each numbered by its place in
     the walk, on the canopy ground, read-only. The bar under the head names it and its ✕ leaves. A
     flag click resolves; a stop click leaves the filter and opens that stop. */
  const FM = NS.FlagMath
  const w = flagView && FM && typeof NS.FlagFilterBar === 'function' ? WALKS.find((x) => x.id === flagView.walkId) : null
  if (w) {
    const seen = new Set()
    const shown = typeof FM.stops === 'function' ? FM.stops(flags, w.id, flagView.lectureId) : FM.order(flags, w.id, flagView.lectureId).filter((f) => (seen.has(f.stopId) ? false : (seen.add(f.stopId), true)))
    return (
      <Pane title="walk editor" onClose={onClose} data-screen-label="walk editor" scroll="none"
        actionBar={<NS.FlagFilterBar shown={shown.length} total={w.stops.length} onClose={onLeaveFilter} />}>
        <PaneScroller style={{ flex: 1, background: 'var(--surface-canopy)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-4) 0' }}>
            {shown.map((f, i) => {
              const n = byId[f.stopId]
              const at = w.stops.findIndex((st) => st.id === f.stopId)
              return (
                <React.Fragment key={f.stopId}>
                  {i ? <NS.FilteredGap /> : null}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <NodeChip title={n ? n.title : f.stopId} index={(at + 1) + '.'} domain={n ? n.domain : ''} mark="border" wrap
                      note="open in the whole walk" onClick={() => onOpenStop(f.stopId)} />
                    <span style={{ position: 'absolute', left: '100%', marginLeft: NS.STOP_FLAG_METRICS ? NS.STOP_FLAG_METRICS.gutter : 7 }}>
                      <NS.StopFlag flag={f} onResolve={() => onResolve(w.id, f.stopId)} />
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </PaneScroller>
      </Pane>
    )
  }
  return (
    <Pane title="walk editor" onClose={onClose} data-screen-label="walk editor">
      {typeof NS.PanePlaceholder === 'function'
        ? <NS.PanePlaceholder state="The walk editor is not in this kit" note="The app's walk editor draws here. This shell holds its place in the Plan layout and its width on the desk." style={{ flex: 1 }} />
        : <div style={{ padding: 'var(--space-4)', fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>The walk editor is not in this kit.</div>}
    </Pane>
  )
}

/* ── Trail — temporal history, append-only — plus the walk controls ──── */
function TrailBar({ trail, onFocus, walk, cursor, onStartWalk, onAdvance, onStop, onJump, onReset, onClose }) {
  const scroller = React.useRef(null)
  React.useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, [trail.length])
  const w = walk ? WALKS.find((x) => x.id === walk) : null
  return (
    <Pane title="trail" onClose={onClose} data-screen-label="trail" scroll="none"
      style={{ flex: '0 0 116px', height: 116 }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* scroll="none": each column is a PaneScroller, which holds the bar clear of
             the pane's rounded corners at BOTH ends and keeps the number in one place */}
          <PaneScroller axis="x" forwardRef={scroller} style={{ padding: '6px var(--space-4) 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: '100%' }}>
              {trail.map((t, i) => <TrailChip key={i} title={byId[t.id].title} domain={byId[t.id].domain} via={t.via} jump={t.jump} onClick={() => onFocus(t.id, 'TRL')} />)}
            </div>
          </PaneScroller>
        </div>
        <div style={{ width: 1, background: 'var(--border-hair)', flexShrink: 0 }} />
        <PaneScroller style={{ flex: 'none', width: 430, padding: '6px var(--space-4) 8px' }}>
          <SectionLabel action={<PillButton size="sm" onClick={onReset}>reset session</PillButton>}>walks</SectionLabel>
          {!w ? (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {WALKS.map((x) => <PillButton key={x.id} tone="walk" size="sm" glyph={'\u25b6'} title={x.description} onClick={() => onStartWalk(x.id, 0)}>{x.title}</PillButton>)}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-walk)', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)', whiteSpace: 'nowrap' }}>stop {cursor + 1} of {w.stops.length}</span>
                <span style={{ flex: 1 }} />
                {cursor < w.stops.length - 1 ? <PillButton size="sm" tone="walk" onClick={onAdvance}>next {'\u25b6'}</PillButton> : null}
                <PillButton size="sm" tone="ghost" onClick={onStop}>{'\u2715'}</PillButton>
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                {w.stops.map((s, i) => <StepDot key={i} n={i + 1} title={s.note} state={i === cursor ? 'current' : i < cursor ? 'done' : 'ahead'} onClick={() => onJump(i)} />)}
              </div>
            </div>
          )}
        </PaneScroller>
      </div>
    </Pane>
  )
}



// The registry, mirrored from src/studio/instruments.tsx — the ids and labels
// are the real ones. Only the five instruments this kit recreates are listed;
// the rest are named in README.md rather than faked.
const INSTRUMENTS = [
  /* THE TWO PANES THAT NOW CARRY RAILS ASK FOR MORE WIDTH, and the numbers are arithmetic
     rather than taste (2026-09-20): a pane's `min` is its rail plus a readable column for the
     thing the pane is actually FOR, which is the same sum `RailMath.floor` publishes — they are kept
     equal deliberately, so a pane at its declared minimum still shows its rail rather than
     hiding it the moment it is honoured. The old 330 document gave its prose 94px.
     THE FLEX SHARES ARE LEVEL NOW. Map 1.9 against document 1.1 was set when the document was
     prose only; it now carries a 228px figure and a card list, so the old ratio handed the
     atlas room it did not need and took the rail the document does. Level, and the Explore
     preset shows both rails at once — which is the arrangement the whole dissolution is for. */
  { id: 'nested', label: 'Map', flex: 1, min: railFloor('left') },
  { id: 'tree', label: 'Tree', flex: 0 },
  { id: 'children', label: 'Connections', flex: 1.3, min: 360 },
  { id: 'doc', label: 'Document', flex: 1, min: railFloor('right') },
  /* THE WALK EDITOR, a PLACE rather than a recreation (owner, 2026-09-23: Plan is walk editor,
     map and document). The app's editor is the road (`AuthorRoad.tsx`); this kit does not
     recreate it, so the pane says so instead of faking one. */
  { id: 'railroad', label: 'Walk editor', flex: 1.2 },
]
// The palette shows the registry's real inventory, grouped into families. Only
// the four instruments this kit recreates are selectable; the rest are listed
// with `soon` so the grouping is honest about what exists upstream.
const FAMILIES = [
  { id: 'views', label: 'views', items: [
    { id: 'nested', label: 'Map' },
    { id: 'tree', label: 'Tree' },
    { id: 'children', label: 'Connections' },
    { id: 'doc', label: 'Document' },
    { id: 'contours', label: 'Contours', soon: true },
    { id: 'evoc', label: 'Clusters', soon: true },
  ] },
  { id: 'unfold', label: 'unfold', items: [
    { id: 'unfold', label: 'Unfold', soon: true },
    { id: 'unfold-graph', label: 'Unfold \u00b7 Graph', soon: true },
  ] },
  { id: 'walks', label: 'walks', items: [
    { id: 'walk', label: 'Walk', soon: true },
    { id: 'walk-palette', label: 'Walk \u00b7 Palette', soon: true },
    { id: 'walk-columns', label: 'Walk \u00b7 Columns', soon: true },
    { id: 'walk-stack', label: 'Walk \u00b7 Stack', soon: true },
    { id: 'railroad', label: 'Walk · Editor' },
  ] },
  { id: 'lenses', label: 'lenses', items: [
    { id: 'lens-depends', label: 'builds on', swatch: 'var(--edge-depends-on)', soon: true },
    { id: 'lens-uses', label: 'uses', swatch: 'var(--edge-uses)', soon: true },
    { id: 'lens-also', label: 'see also', swatch: 'var(--edge-see-also)', soon: true },
    { id: 'lens-impl', label: 'implemented with', swatch: 'var(--edge-implemented-with)', soon: true },
  ] },
]
const PRESETS = [
  /* PRESENT IS A MODE, NOT A COMPOSITION (2026-09-02): choosing it swaps the WHOLE shell — app
     header and toolbar included — for the presenter screen, whose own header bar is that mode's
     toolbar. Ending the lecture and closing returns to the preset that was active before.
     TWO ENTRIES, TWO THINGS (2026-09-03, owner): this palette button only LAYS THE PANES OUT as
     presenter mode does — nothing is projected, no clock runs, the header's ■ is faded. The ▶ at
     the end of the app toolbar is the only start of a lecture, and pressing it from the preview
     turns the preview into the lecture. */
  { id: 'teaching', label: 'Present', hint: 'lay the panes out as presenter mode does — nothing is projected and no clock runs; ▶ on the toolbar starts the lecture', mode: 'present' },
  /* EXPLORE IS THE DISSOLUTION (2026-09-20): two panes, not three. The connections split pane
     used to be the middle one; its contains column is now the map's Explorer rail and its
     relations column is the document's, so the preset that used to name it names nothing new. */
  { id: 'cockpit', label: 'Explore', hint: 'map with the Explorer rail + document with the relations rail — territory, tree and prose on one focus, no trail', active: ['nested', 'doc'], noTrail: true },
  /* PLAN IS THE APP'S THIRD MODE (owner, 2026-09-23), replacing Reading, which the app never had:
     the walk editor, the map and the document. NO WALK PALETTE PANE — the app's Plan carried one
     and the owner removed it (OB-252). No trail either, like Explore: the editor is where the walk
     is being made, and a trail of where you have looked is a second record of the same session. */
  { id: 'plan', label: 'Plan', hint: 'walk editor + map + document — author a walk against the territory and the prose it stops at', active: ['railroad', 'nested', 'doc'], noTrail: true },
]

// A palette-and-brush mark, drawn as a line glyph so it sits with the unicode
// glyphs beside it: same weight, same currentColor, no fill but the wells.
const PaletteGlyph = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <g transform="translate(0.3,0.4) scale(1.09)">
    <path d="M9.2 2.6c3.9 0 7 2.6 7 5.9 0 2-1.6 3-3.1 3h-1.3c-.9 0-1.6.7-1.6 1.6 0 .4.1.7.3 1 .2.3.3.6.3 1 0 .9-.7 1.5-1.6 1.5-3.9 0-7-3.1-7-7s3.1-7 7-7Z" />
    <circle cx="5.9" cy="6.6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9.4" cy="5.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="12.6" cy="7.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.9" cy="10.3" r="1" fill="currentColor" stroke="none" />
    </g>
    <path d="M18.7 1.8 12.7 7.8" strokeWidth="1.3" />
    <path d="M12.4 8.2 11.7 8.9" strokeWidth="2.2" />
    <path d="M11.2 9.5Q9.8 11.2 9 13.1 10.8 12.3 12 10.6Z" fill="currentColor" strokeWidth="0.9" />
  </svg>
)

function Studio(props) {
  const FAMILY_COL = FamilyColumn(FAMILIES.map((f) => f.label))
  const initial = PRESETS.find((p) => p.id === props.preset && !p.mode) || PRESETS[1]
  const [active, setActive] = React.useState(initial.active)
  const [presetId, setPresetId] = React.useState(initial.id)
  /* the presenter mode: `presenting` is null, or `{ from, kind }` — `from` the preset to return to,
     `kind` 'preview' (palette Present: the layout only, nothing projected, no clock; the chrome
     stays and the toolbar ▶ stays pressable — pressing it makes this the lecture) or 'lecture'
     (toolbar ▶: projecting; the lecture owns the screen and the chrome comes back the moment it
     is ENDED, so there is always a way home). Owner's flow, 2026-09-03. */
  const [presenting, setPresenting] = React.useState(props.preset === 'teaching' ? { from: initial.id, kind: 'preview' } : null)
  const [lectureEnded, setLectureEnded] = React.useState(false)
  /* resume is the toolbar's, not the presenter header's: bumping this token resumes an ended lecture */
  const [resumeToken, setResumeToken] = React.useState(0)
  const enter = (kind, lecture) => { setLectureEnded(false); setPresenting({ from: presetId || 'cockpit', kind, lecture: lecture || null, key: Date.now() }) }
  const leave = () => { setPresenting(null); setLectureEnded(false) }
  /* THE START CARD (OB-281–284, wired here 2026-10-01). The toolbar ▶ from idle or from the
     palette's preview OPENS `PresentStartCard`; resume does not. The sessions are this shell's
     store (OB-283): per course, each with the `last` place the presenter writes at the end.
     PRESENTING NEVER CHANGES THE DESK (OB-284): the card's walk and stop go to the presenter only
     — nothing here writes `focus`, `walk` or the trail while presenting, so leaving finds the
     desk exactly as it was before ▶. */
  const COURSE = 'Foundations of Computing'
  const [sessions, setSessions] = useStoredState('presenter:sessions', [])
  const [startOpen, setStartOpen] = React.useState(false)
  const [startSel, setStartSel] = React.useState(null)
  const openStart = () => { setStartSel(null); setStartOpen(true) }
  const patchSession = (id, f) => setSessions((l) => l.map((x) => (x.id === id ? { ...x, ...f(x) } : x)))
  const newSessionId = () => 'ses-' + Date.now().toString(36)
  const cardWalks = React.useMemo(() => WALKS.map((w) => ({ id: w.id, title: w.title, stops: w.stops.map((st) => ({ id: st.id, title: byId[st.id] ? byId[st.id].title : st.id })) })), [])
  const placeOf = (id) => { for (const w of WALKS) { const i = w.stops.findIndex((st) => st.id === id); if (i >= 0) return { w, i } } return null }
  const startFromCard = (c) => {
    let sessionId = c.sectionId
    if (c.newSession) { sessionId = newSessionId(); setSessions((l) => l.concat([{ id: sessionId, name: '', meets: [] }])) }
    const walkId = c.walkId != null ? c.walkId : ((openWalkOf() || {}).id || WALKS[0].id)
    setStartOpen(false)
    enter('lecture', { walkId, stop: c.stop != null ? c.stop : 0, sessionId })
  }
  /* THE FLAG LIST (2026-10-01): its own store, per walk and stop (`StopFlagRecord`), never on the
     session or in the walk. Only presenting adds to it; the walk editor's flagged view and the
     document's head clear from it. `flagView` is the editor's flagged-only view, set by the end
     screen's "open the flagged slides". */
  const [flags, setFlags] = useStoredState('presenter:flags', [])
  const [flagView, setFlagView] = React.useState(null)
  const FM = NS.FlagMath
  const flagChange = (r) => { if (!FM || !presenting) return; setFlags((l) => FM.toggle(l, { ...r, id: r.walkId + ':' + r.stopId + ':' + presenting.key, lectureId: presenting.key, sessionId: presenting.lecture ? presenting.lecture.sessionId : null })) }
  const resolveFlag = (walkId, stopId) => { if (FM) setFlags((l) => FM.resolve(l, walkId, stopId)) }
  /* the last flag resolved: the filter has nothing to show, so it goes */
  React.useEffect(() => { if (flagView && FM && !FM.order(flags, flagView.walkId).length) setFlagView(null) }, [flags, flagView])
  /* the presenter hands back the place it ended on; it becomes the session's `last` */
  const recordLast = (sessionId, last) => { if (sessionId) patchSession(sessionId, () => ({ last })) }
  /* read at render, in the card's mount: `focus` and `walk` are declared below this block */
  const readingOf = () => { const p = placeOf(focus); return p ? { walkId: p.w.id, walk: p.w.title, stop: p.i, stopTitle: byId[focus] ? byId[focus].title : undefined } : undefined }
  const openWalkOf = () => { const w = walk ? WALKS.find((x) => x.id === walk) : (placeOf(focus) || {}).w; return w ? { id: w.id, title: w.title } : undefined }
  const projecting = !!presenting && presenting.kind === 'lecture'
  const chromeHidden = projecting && !lectureEnded
  const [focus, setFocus] = React.useState('stk-tcp-udp')
  /* WHAT THE RELATIONS RAIL IS POINTING AT, held here because it crosses panes (OB-230): the
     document's card reports a target hover, the map lights that node. It is deliberately NOT
     the selection — a highlight and a selection are different states and wear different rings. */
  const [lit, setLit] = React.useState(null)
  const [trail, setTrail] = React.useState([{ id: 'stk-dns-naming', via: 'MAP' }, { id: 'stk-ip-routing', via: 'TREE' }, { id: 'stk-tcp-udp', via: 'TREE' }])
  const [walk, setWalk] = React.useState(null)
  /* THE TOOLBAR'S LOAD (LoadDialog). The shell has ONE map; the dialog still draws its row, unfolded.
     Select, then Load: a walk starts at its first stop; the map alone clears the walk. No `preview`: the shell
     has no read-only map view, so the frame shows the dialog's labelled stripe. */
  const [loadOpen, setLoadOpen] = React.useState(false)
  const [cursor, setCursor] = React.useState(0)
  const [visited, setVisited] = React.useState(() => new Set(['stk-dns-naming', 'stk-ip-routing', 'stk-tcp-udp']))

  const go = (id, via, jump) => {
    setFocus(id)
    setTrail((t) => t.concat([{ id, via: via || 'NAV', jump: !!jump }]))
    setVisited((v) => new Set(v).add(id))
  }
  const toggle = (id) => {
    setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat([id])))
    setPresetId(null)
  }
  const startWalk = (id, at) => {
    const w = WALKS.find((x) => x.id === id)
    setWalk(id); setCursor(at)
    go(w.stops[at].id, 'WLK', true)
  }
  const jumpTo = (i) => { const w = WALKS.find((x) => x.id === walk); setCursor(i); go(w.stops[i].id, 'WLK', true) }
  const advance = () => jumpTo(cursor + 1)

  const [showTrail, setShowTrail] = React.useState(props.showTrail !== false && !initial.noTrail)
  const [showPalette, setShowPalette] = React.useState(props.showPalette !== false)
  /* THE PALETTE GROWS OUT OF ITS TOOLBAR BUTTON, AND THE BROWSER DOES IT NOW.
     This was a hand-rolled FLIP: find the toggle in the DOM, measure both rects, compute a
     delta, drive scale-and-translate through a measuring/shrink/grow phase machine, unmount
     140ms later on a timer. It found the button by matching its TOOLTIP TEXT, which does not
     merely miss once the copy folds past `wrapTip`'s 44 characters — a CSS attribute selector
     may not hold a raw newline, so `querySelector` throws. `useMorph` hands the whole job to
     the platform: the button and the pane take turns holding one `view-transition-name` and
     the engine morphs the before-snapshot into the after one. Nothing is queried, measured or
     timed. `hook` stays on the item — a driver still needs to find that button; the animation
     no longer does. Owner's ruling 2026-08-31 on their `afe6202` receipt. */
  const paletteMorph = useMorph('palette', showPalette)
  const togglePalette = () => paletteMorph.run(() => setShowPalette((v) => !v))
  const closePalette = () => paletteMorph.run(() => setShowPalette(false))
  /* AT REST, ALWAYS. The browser animates a SNAPSHOT of this element; a transform or opacity
     transition on the real one would run underneath the snapshot and the two would fight. */
  const paletteStyle = { flex: 'none', width: 'var(--sidebar-w)', flexShrink: 0, viewTransitionName: paletteMorph.panel }
  const [custom, setCustom] = React.useState([])
  // a preset being named. It is named in place, at the foot of the presets list,
  // so you name it where it will live rather than in a dialog over the top.
  const [draft, setDraft] = React.useState(null)
  const nameRef = React.useRef(null)
  const draftRef = React.useRef(null)
  // depend on the draft's IDENTITY, not the object — the object changes on every
  // keystroke, and re-running select() there re-selects the text so the next
  // character replaces it (the classic "only one letter" bug).
  React.useEffect(() => { if (draft && nameRef.current) nameRef.current.select() }, [draft && draft.id])
  const commitDraft = () => {
    if (!draft) return
    const label = (draft.label || '').trim() || 'Custom preset'
    const p = { id: draft.id, label, hint: (draft.hint || '').trim(), active: draft.active }
    setCustom((c) => c.concat([p])); setPresetId(p.id); setDraft(null)
  }
  const [folded, setFolded] = React.useState(() => new Set(['unfold', 'walks', 'lenses']))
  const fold = (id) => setFolded((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n })
  const on = (id) => active.includes(id)
  /* the desk's widths, and the handles between the panes (OB-170, host side) */
  const desk = useDesk(active)
  const n = byId[focus]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-canopy)' }}>
      {/* AppHeader (status) and Toolbar (action) combined into one chrome block, sharing a
          single clip so the leaf motif can run down across BOTH bars rather than being
          confined to the toolbar strip alone — the two are one visual unit now, not two.
          The clip lives on its OWN absolutely-inset layer (not on this relative wrapper
          directly): a wrapper sized by auto content height clipped inconsistently when the
          motif's negative-margin trick pushed past it, so the clip box is pinned to an
          explicit `inset: 0` layer instead, matching the wrapper's box exactly. */}
      {/* The chrome block (header + toolbar + motif) hides only for a LIVE lecture — see
          `chromeHidden`. A preview keeps it; an ended lecture gets it back. */}
      {chromeHidden ? null : <div style={{ position: 'relative', flexShrink: 0 }}>
        <AppHeader product="Studio" corpusLine="one corpus — nested map, tree, connections and document panes, one shared focus" focus={{ title: n.title, domain: n.domain }}>
          <CountBadge value={visited.size} label="visited" />
        </AppHeader>
        <Toolbar
          groups={[
            { items: [
              { glyph: PaletteGlyph, title: showPalette ? 'hide the palette' : 'show the palette', hook: 'palette-toggle', morph: paletteMorph.trigger, on: showPalette, onClick: togglePalette },
            ] },
            { items: [{ glyph: <NewMapMark />, title: 'new map' }, { glyph: <LoadMark />, title: 'load', onClick: LoadDialog ? () => setLoadOpen(true) : undefined }, { glyph: <SaveMark />, title: 'save' }, { glyph: <PrintMark />, title: 'print' }] },
            { items: [{ glyph: '\u21b6', title: 'undo' }, { glyph: '\u21b7', title: 'redo', disabled: true }] },
            { items: [{ glyph: <CopyMark />, title: 'copy' }, { glyph: <PasteMark />, title: 'paste' }, { glyph: '\u2702', title: 'cut' }] },
            /* the lecture's ONLY start and ONLY resume — its own group, last, behind a divider; `hook` so a
               driver can find it. Idle or PREVIEWING: pressable, starts a lecture (from a preview, the same
               panes become the lecture and the clock starts from zero). Projecting: washed and unpressable
               ("presenting"). Ended: pressable again, and a press RESUMES — the presenter header's ■ only
               ever stops. One play button on screen, one meaning (owner, 2026-09-03). */
            { items: [{ glyph: '\u25B6', hook: 'present', disabled: projecting && !lectureEnded, on: projecting && !lectureEnded,
              title: !projecting ? 'present' : lectureEnded ? 'resume' : 'presenting',
              onClick: !projecting ? (PresentStartCard ? openStart : !presenting ? () => enter('lecture') : () => setPresenting((p) => ({ ...p, kind: 'lecture' }))) : lectureEnded ? () => { setResumeToken((t) => t + 1) } : undefined }] },
          ]}
        />
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', right: 0, bottom: 0, lineHeight: 0 }}>
            <LeafMark base="../.." size={160} opacity={0.2} tipOnRule />
          </span>
        </div>
      </div>}


      {/* ONE body row for both states, so the palette can open beside the presenter too. With the
          chrome showing (a preview, or an ended lecture) the row keeps its padding and the presenter
          is FRAMED like a pane, so its paper header bar reads as the pane's header beside the palette
          rather than a full-width bar with a hole cut for the palette. With the chrome hidden (a live
          lecture) the row has no padding and the presenter is full-bleed. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: chromeHidden ? 0 : 'var(--space-3)', padding: chromeHidden ? 0 : 'var(--space-3)' }}>
        {showPalette && !chromeHidden ? (
        <div style={paletteStyle}>
        <Pane as="aside" title="palette" onClose={closePalette} scroll="both" style={{ height: '100%' }}>
          {/* on the pane's first line: `FIRST_SCROLL_PAD`, because the scroller already starts 12 down */}
          <div style={{ padding: 'var(--space-3)', paddingTop: NS.FIRST_SCROLL_PAD ?? 2, borderBottom: '1px solid var(--border-hair)' }}>
            <SectionLabel>presets</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PRESETS.map((p) => (
                <PresetButton key={p.id} label={p.label} hint={p.hint} active={p.mode ? !!presenting : (!presenting && presetId === p.id)}
                  onClick={() => { if (p.mode) { if (!presenting) enter('preview'); else if (presenting.kind !== 'preview') { setPresenting((q) => ({ ...q, kind: 'preview' })); setLectureEnded(false) } if (showPalette) closePalette(); return } if (presenting) leave(); setActive(p.active); setPresetId(p.id); setShowTrail(!p.noTrail); if (showPalette) closePalette() }} />
              ))}
              {custom.map((p) => (
                <PresetButton key={p.id} label={p.label} hint={p.hint} active={presetId === p.id}
                  onClick={() => { if (presenting) leave(); setActive(p.active); setPresetId(p.id) }}
                  onDelete={() => { setCustom((c) => c.filter((x) => x.id !== p.id)); if (presetId === p.id) setPresetId(null) }} />
              ))}
              {draft ? (
                <div ref={draftRef} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--moss-300)', background: 'var(--accent-primary-wash)' }}
                  onBlur={(e) => { if (!draftRef.current || !draftRef.current.contains(e.relatedTarget)) commitDraft() }}>
                  <input ref={nameRef} value={draft.label} autoFocus placeholder="preset name"
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(); if (e.key === 'Escape') setDraft(null) }}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '2px 7px',
                      borderRadius: 'var(--radius-xs)', border: '1px solid var(--moss-300)',
                      background: 'var(--surface-raised)', color: 'var(--text-1)',
                      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)',
                      outline: 'none',
                    }} />
                  <input value={draft.hint} placeholder="what this composition is for"
                    onChange={(e) => setDraft((d) => ({ ...d, hint: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(); if (e.key === 'Escape') setDraft(null) }}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '2px 7px', marginTop: 4,
                      borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-rule)',
                      background: 'var(--surface-raised)', color: 'var(--text-2)',
                      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)',
                      outline: 'none',
                    }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                    <PillButton size="sm" tone="primary" onClick={commitDraft}>save</PillButton>
                    <PillButton size="sm" tone="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setDraft(null)}>cancel</PillButton>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ padding: 'var(--space-3)', flex: 1 }}>
            <SectionLabel action={
              <PillButton size="sm" disabled={!active.length} title="save the current composition"
                onClick={() => setDraft({
                  id: 'custom-' + Date.now(),
                  label: 'Custom preset' + (custom.length ? ' ' + (custom.length + 1) : ''),
                  hint: active.map((id) => INSTRUMENTS.find((x) => x.id === id).label.toLowerCase()).join(' + '),
                  active: active.slice(),
                })}>custom preset</PillButton>
            }>instruments</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {FAMILIES.map((f) => (
                <InstrumentGroup key={f.id} label={f.label} open={!folded.has(f.id)} onToggle={() => fold(f.id)} labelWidth={FAMILY_COL}
                  count={f.items.filter((i) => on(i.id)).length}>
                  {f.items.map((i) => (
                    <InstrumentRow key={i.id} label={i.label} on={on(i.id)} swatch={i.swatch}
                      disabled={i.soon} onClick={i.soon ? null : () => toggle(i.id)} />
                  ))}
                </InstrumentGroup>
              ))}
            </div>
          </div>
        </Pane>
        </div>
        ) : null}

        {presenting ? (
        <div style={chromeHidden
          ? { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }
          : { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-canopy)' }}>
          {/* KEYED PER START: each lecture from the card is a fresh presenter (its clock, record and
             notes from zero). No `onShown` — the presenter's stop never moves the desk (OB-284). */}
          <PresenterScreen key={presenting.key} course={COURSE} projecting={projecting}
            startAt={presenting.lecture ? presenting.lecture.stop : focus} walkId={presenting.lecture ? presenting.lecture.walkId : undefined}
            session={presenting.lecture ? sessions.find((x) => x.id === presenting.lecture.sessionId) : undefined}
            onRecord={presenting.lecture ? (last) => recordLast(presenting.lecture.sessionId, last) : undefined}
            onFlagChange={flagChange}
            onOpenFlagged={(walkId) => { const lectureId = presenting.key; leave(); setFlagView({ walkId, lectureId }); setActive((a) => (a.includes('railroad') ? a : a.concat(['railroad']))) }}
            onEnded={setLectureEnded} resumeToken={resumeToken} onClose={leave} />
        </div>
        ) : (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* THE 14px HANDLE IS THE GUTTER once the desk is draggable — the row's own
              `var(--space-3)` would sit either side of it and open a 38px trench between two
              panes. Without the handles (one pane, or a bundle a turn behind) the gap comes
              straight back. */}
          <div ref={desk.setRowBox} style={{ flex: 1, minHeight: 0, display: 'flex', gap: desk.ready ? 0 : 'var(--space-3)' }}>
            {active.length === 0 ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-body)' }}>no instruments in the composition — pick one on the left</div>
            ) : active.map((id, i) => {
              const inst = INSTRUMENTS.find((x) => x.id === id)
              const wrap = (el) => (
                <React.Fragment key={id}>
                  {i > 0 ? desk.divider(i - 1) : null}
                  <div style={desk.paneStyle(i, inst)}>{el}</div>
                </React.Fragment>
              )
              const paneProps = { onClose: () => toggle(id) }
              /* NO `grabbable` AND NO `resizable` ON A DOCKED PANE, and the blank is
                 deliberate (owner, 2026-08-21e). This row owns its children's height
                 (`flex: 1; min-height: 0`) and their widths (`--tree-w`, a flex share), so
                 neither pane gesture fits: there is nowhere for a docked pane to be dragged
                 TO, and the corner grip drags width AND height, one of which is not the
                 pane's to give. A mark advertising a gesture that does nothing is the
                 failure `Grip` exists to fix, wearing the other hat.
                 An edge splitter WAS declined once (OB-046, 2026-08-21e) and that ruling was
                 superseded on 2026-09-09: the boundaries now drag, through the system's
                 `PaneDivider` between the panes (see `useDesk` above). The pane's own two
                 gestures stay declined for the reason given — a docked pane has nowhere to be
                 dragged to, and the corner grip would drag a height this row owns. So: no
                 `grabbable`, no `resizable`, and still never a hand-drawn splitter.
                 The grabbable and resizable hosts are the app's FloatingPanel and the
                 chrome card's floating specimen, which is where both are verified. */
              if (id === 'nested') return wrap(<MapPane focus={focus} onFocus={go} lit={lit} {...paneProps} />)
              if (id === 'tree') return wrap(<TreePane focus={focus} onFocus={go} {...paneProps} />)
              if (id === 'children') return wrap(<ConnectionsPane focus={focus} onFocus={go} {...paneProps} />)
              if (id === 'railroad') return wrap(<WalkEditorPane {...paneProps} flagView={flagView} flags={flags} onResolve={resolveFlag}
                onLeaveFilter={() => setFlagView(null)} onOpenStop={(stopId) => { setFlagView(null); go(stopId, 'NAV') }} />)
              return wrap(<DocPane focus={focus} onFocus={go} onStartWalk={startWalk} onLit={setLit} {...paneProps}
                flag={FM ? FM.order(flags, walk || null).find((f) => f.stopId === focus) || null : null} onResolveFlag={resolveFlag} />)
            })}
          </div>
          {showTrail ? (
          <TrailBar trail={trail} onFocus={go} walk={walk} cursor={cursor}
            onStartWalk={startWalk} onAdvance={advance} onStop={() => setWalk(null)} onJump={jumpTo}
            onReset={() => { setTrail([{ id: focus, via: 'NAV' }]); setWalk(null) }}
            onClose={() => setShowTrail(false)} />
          ) : null}
        </div>
        )}
      </div>
      {loadOpen && LoadDialog ? (
        <LoadDialog maps={[{ id: 'open', title: COURSE, walks: cardWalks }]} openMapId="open" openWalkId={walk}
          onPick={(c) => { setLoadOpen(false); if (c.walkId != null) startWalk(c.walkId, 0); else setWalk(null) }}
          onClose={() => setLoadOpen(false)} />
      ) : null}
      {/* THE CARD IS A MODAL over the screen ▶ was pressed from (its .d.ts); a press on the scrim cancels */}
      {startOpen && PresentStartCard ? (
        <div onPointerDown={(e) => { if (e.target === e.currentTarget) setStartOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 'var(--space-5)', background: 'var(--scrim)' }}>
          <PresentStartCard course={COURSE} sections={sessions} selectedId={startSel} onSelectSection={setStartSel}
            onAddSection={(name) => setSessions((l) => l.concat([{ id: newSessionId(), name: name || '', meets: [] }]))}
            onRenameSection={(id, name) => patchSession(id, () => ({ name }))}
            onSetSectionMeets={(id, meets) => patchSession(id, () => ({ meets }))}
            onDeleteSection={(id) => { setSessions((l) => l.filter((x) => x.id !== id)); if (startSel === id) setStartSel(null) }}
            openWalk={openWalkOf()} reading={readingOf()} walks={cardWalks}
            onStart={startFromCard} onCancel={() => setStartOpen(false)} />
        </div>
      ) : null}
    </div>
  )
}

// Mount gate: hold the render until the bundle and the corpus have landed.
function StudioMount(props) {
  const [ok, setOk] = React.useState(bindDeps)
  React.useEffect(() => {
    if (ok) return
    const t = setInterval(() => { if (bindDeps()) { setOk(true); clearInterval(t) } }, 30)
    return () => clearInterval(t)
  }, [ok])
  return ok ? React.createElement(Studio, props) : null
}

module.exports = { Studio: StudioMount }
