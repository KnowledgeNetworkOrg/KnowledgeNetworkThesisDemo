// Map — the "territory at every level" instrument, and the Studio's only map.
// It ABSORBED the flat MapView in 25734fa ("one map"), which is why this file
// carries that name again: same geography as that one (same embedding, same
// countries and provinces), but EVERY node owns
// a convex territory that its children tile exactly (model/nested.ts), so
// zooming discloses region tiers in place.
//
// SNAP-ONLY + NODE-AS-COUNTRY (2026-07-12): free zooming is gone — the wheel
// steps whole levels, double-click dives one, so every frame the user sees is
// one of the L0..maxTier canonical scales and each level is an AUTHORED style,
// not an interpolated in-between (this is what removed the mid-transition
// artifacts and the unreadable type of the free-zoom era). At level k the
// level-k nodes ARE the countries: pale tree-color fill (model/color.ts),
// own label — wrapped to fit inside the cell, or dropped when even the best
// two-line split overflows (2026-07-13: capital dots removed with the same
// stroke — fill + border + name already said "a node lives here" three ways)
// — and the ONLY hit targets: clicking a cell selects that node, never its
// ancestor. Ancestors follow ONE formal rule — the
// CONTEXT WINDOW (below): only the immediate parent grain (d = level − tier
// = 1) renders at all, as a full-emphasis border plus one watermark ghost;
// every grain above it disappears entirely. Branches
// that bottom out early persist as leaf countries at
// every deeper level, slightly muted ("no more depth here") — jagged
// hierarchies never leave holes in the map.
//
// Relations stay a SELECTION overlay, drawn AT THE SELECTED LEVEL
// (2026-07-13): edges live at the topic grain, so a selection above it (a
// domain or module) ROLLS ITS EDGES UP — every underlying topic edge maps to
// the counterpart's region at the same tier, and edges internal to the
// selection drop. Children's relationships are never drawn raw across a
// coarser map, and a selection BELOW the topic grain draws no roads at all
// (2026-07-17): a deep cell has no edges of its own, and borrowing the owning
// topic's made every relation-less child look connected — the selection tint
// is all it gets. The overlay is pinned until a re-click of the same cell, a
// water-click or Esc. All text and hairlines are sized in SCREEN pixels
// (pane-fit compensated) — at canonical scales the same style table renders
// identically at every level.
//
// ONE ROAD PER PAIR (2026-07-14): whatever the grain, every arrow between the
// same two cells COLLAPSES into a single line carrying a ×n traffic count.
// Before, four links between two topics were four curves fanned apart by a
// bulge index, and a reciprocal pair was two arrows bowed past each other —
// geometrically honest, cartographically unreadable. A map answers "is there a
// road here, and how busy is it"; one road, one number. A bundle of mixed types
// is drawn slate (no type color would be true), and a bundle running BOTH ways
// gets no arrowhead at all — which links, of which type, in which direction is
// the Connections star's question, and it is one pane away.

// The DERIVATION lives in model/atlas.ts (2026-07-14) — which roads a selection
// draws, how they roll up to a coarser grain, how parallel links collapse into
// one road. It is a pure function of the corpus and one id, it is the piece a
// walk route would reuse, and it has its own tests. What is left here is what a
// component should be: a camera, a hover, and a paint order.

import { useEffect, useMemo, useRef, useState } from 'react'

import type { OpenMap } from '@/ds'
import { Breadcrumb, containsSummary, ExplorerRail, ExplorerRailCorner, findTreePath, FIRST_ROW_PAD, walkArrival, walkLeadStop, LevelPicker, MapFloatingButton, MapTooltip, NodePreviewLayer, OpenForVisible, OpenOnSelect, PaneCanvas, usePaneWidth, VisibilityMark, WALK_DOCK_METRICS, WalkDock, WalkPreview, ZoomControl } from '@/ds'
import { byId, domainIds, domainOf, EDGE_COLOR, EDGE_LABEL, MIXED_EDGE_COLOR, pathTo, ROOT_ID } from '../corpus/graph'
import { HOME_VIEW, L_MAX, VB_H, VB_W, VB_X, VB_Y } from './map/camera'
import { useArrivalLook } from './map/arrivallook'
import { useMapCamera } from './map/mapcamera'
import { ancBorderO, useMapLabelFit } from './map/maplabelfit'
import { MapLabels } from './map/MapLabels'
import { DragGhost } from './map/DragGhost'
import { MapSelection } from './map/MapSelection'
import { useMapSelection } from './map/mapselect'
import { useNodeDrag } from './map/nodedrag'
import { useWallFit, WALL_LEVEL, WALL_VIEW } from './map/wallfit'
import { WalkArrows } from './map/WalkArrows'
import { WalkPins } from './map/WalkPins'
import type { PinHover } from './map/WalkPins'
import { routeIsWalk, useWalkPlayback } from '../state/walk/playback'
import type { PlaybackBus } from '../state/walk/playback'
import { renderStopPreview } from '../state/walk/stoppreview'
import { leafPos, provinceIds } from '../model/flat'
import type { XY } from '../model/derive'
import { colorOf, SELECTION_WASH, territoryFillOf } from '../model/color'
import { countryPath, provincePath, rootPath, territories } from '../model/nested'
import { endpointAtTier, flightTargetOf, outlineOf, roadsFor } from '../model/atlas'
import { hoverMarks } from '../model/maphover'
import type { WallView } from '../model/walkwall'
import { pinPosition, walkPins } from '../model/walkpins'
import { routeOptionals } from '../model/route'
import { toggleWalkHidden, walkDrawn, walkKeyOf } from '../model/walkvisibility'
import type { Bundle } from '../model/atlas'
import { descendantCount, parentOf } from '../model/nav'
import type { Bus } from '../state/bus'
import { CORPUS_TREE, summaryOfNode } from './corpustree'

/** the water behind every territory — exported so the shell can pass it as the
 *  Pane's own `face` (OB-066), rather than leaving it to the frame's default
 *  `--surface-paper` to show around the canvas's corners and its shorter-than-
 *  the-pane bottom edge. One value, read here and by the shell; a second typed
 *  copy is the staleness this item exists to close. */
export const MAP_WATER = '#eef4f8'

/** the LevelPicker's labels, "L0".."L{maxTier+1}" — OB-096, extended by OB-193.
 *
 *  THE DISPLAY LABEL IS NOT THE INTERNAL `level` NUMBER, and that gap is deliberate rather
 *  than a mismatch to close. OB-193 gives the corpus root its own level — drawn as ONE region,
 *  the whole corpus, filling the same frame the six territories fill today — WITHOUT
 *  renumbering the tier machinery every other level already depends on (the wheel-zoom floor,
 *  the pin layout's level sync, the context-window ghost math: all of it keyed to `level`
 *  0..L_MAX exactly as before). So internally `level` gains one new value, -1, reachable only
 *  by picking the lowest LevelPicker entry — never by the wheel, which still floors at 0 — and
 *  `levelToLabel`/`labelToLevel` below are the ONLY place the +1 offset exists, so a click on
 *  "L0" reads as the root and "L1" as the domains, exactly as OB-193's vocabulary requires. */
const LEVEL_LABELS = Array.from({ length: L_MAX + 2 }, (_, i) => `L${i}`)
const levelToLabel = (l: number) => `L${l + 1}`
const labelToLevel = (s: string) => Number(s.slice(1)) - 1

// The level-change cross-fade: a cell's paint and its outline arrive and leave
// together, so a stratum swap reads as one movement instead of two.
//
// STROKE-WIDTH IS DELIBERATELY NOT IN THIS LIST (#238). It was, and it was wrong
// twice over. Every stroke on the map is `px(k)` = `k * f / view.s`, so its width
// is a CONSTANT at any given level and changes only while `view.s` is moving —
// which is to say, only during a zoom flight, where it is ALREADY interpolating
// smoothly on its own, once per animation frame.
//
//   the cost — a 350ms transition restarted ~16 times over a 260ms flight, on
//   every one of ~350 elements, on a property that (unlike transform and opacity)
//   is not compositor-only and so forces layout and paint on the main thread each
//   time. Measured by probe-maplag.mjs, medians of 5: a zoom round trip at L2
//   738ms -> 428ms, and layouts 82 -> 33.
//
//   the bug — a transition does not only cost, it LAGS, and this one lagged
//   enormously. Sampling the rendered width against the attribute React had just
//   written, frame by frame through one flight: the gap peaked at 98.8% — the
//   line-work drawing at 1.72 units where the map had asked for 0.86, i.e. TWICE
//   the intended weight — and was still more than 1% out 587ms in, well over
//   double the length of the flight it was supposedly smoothing. With the property
//   removed the same sampling reads 0% on every frame. So this is a correctness
//   fix that happens to also be faster: there is no level change at which a width
//   jumps, so the transition was never smoothing anything, only blurring it.
const FADE = 'fill-opacity 350ms, stroke-opacity 350ms'

/** the immediate parent grain's border weight. The window that decides WHEN a border
 *  or a ghost exists — `ancBorderO`/`ancLabelO`, one rule for both halves — is
 *  `./map/maplabelfit.ts`, so the line-work and the labels cannot drift apart. */
const PARENT_BORDER_W = 2.6
/** the slice of the bus the map reads and writes — its own members plus what playback needs,
 *  since `useWalkPlayback` writes the cursor and the focus. */
export type MapViewBus = Pick<Bus, 'focus' | 'hover' | 'hoverStep' | 'peek' | 'matches' | 'route' | 'routeSteps' | 'history' | 'trail' | 'clearFocus' | 'setHover' | 'endHover' | 'hoverCenter'> & PlaybackBus

/** `wall` (#267, DS OB-139 rule 4): the map as the room sees it when the professor holds it up.
 *  A still picture — every stop of the lecture a pin, the covered stops and the lit stop joined
 *  by the walk line, that stop lit, NO recency band, no dock, no floating chrome, no pin hover.
 *  Everything else the map does (territories, labels, the camera) is unchanged. */
export default function MapView({ bus, wall }: { bus: MapViewBus; wall?: WallView }) {
  const onFocus = (id: string) => bus.setFocus(id, 'map')

  const svgRef = useRef<SVGSVGElement>(null)
  /** selected region — its topics' typed edges stay drawn until click-off */
  const [sel, setSel] = useState<string | null>(null)

  // ── THE EXPLORER RAIL (OB-238, #341) ──────────────────────────────────────
  // The dissolved connections pane's contains column, mounted HERE because what contains what
  // is a fact about territory. The rail owns its filter, tree and chrome; this pane owns the
  // four things the DS's contract leaves to the host: the selection, the open set, the hover
  // pair, and the measured width.
  /* CLOSED AT FIRST, which began as a measured decision rather than a taste: opening the rail
     narrows the canvas, and at the explore preset's width the map's own L0 label boxes then
     met by ~3px (`sys`/`cs`, 1750x950) — a map-side fit gap that did not know about
     label-vs-label collisions, surfaced by the narrower pane. That gap is closed (#369:
     `labelFit` now drops the later of two colliding domain names), so the default is no longer
     forced by it; whether the rail should START open, as the idea sheet draws it, is a
     separate call (it is one boolean here, but browsertest-explorerrail.mjs asserts the
     closed start).
     THE UPPER ROW IS NOT THE RAIL'S FOOTPRINT — it is the approved drawing's (OB-241/243): the
     map pane's own row, where the selection sits and where the closed control lives. It draws
     open or closed, and it takes its ~44px of canvas either way; closing gives back the canvas
     WIDTH and nothing else. An earlier version of this comment said a closed rail left the map
     "exactly as it was", which described the pane before the row existed and was wrong. */
  const [railOpen, setRailOpen] = useState(false)
  /* THE SEAM'S STORED WIDTH (OB-253): null until the professor drags, which means the rail's
     own fit. The frame clamps it every render and only what `onWidthChange` reports is stored.
     Persisting it across reloads is OB-255 (#368). */
  const [railW, setRailW] = useState<number | null>(null)
  const [paneW, paneBox] = usePaneWidth()
  const [userOpen, setUserOpen] = useState<OpenMap>({ [ROOT_ID]: 1 })
  /* THE TREE'S POINTER, tracked directly — NOT the preview layer's `hovered`, which is the
     CARD's state raised after its open delay and held through its close grace. A wash driven
     by that arrived ~1.5s late and outlived the pointer (verifier-measured on the DS's shell,
     2026-09-22). `treeHotRef` exists only so a leave can end the bus hover it published. */
  const [treeHover, setTreeHover] = useState<string | null>(null)
  const treeHotRef = useRef<string | null>(null)

  // TWO HOVERS, and they are genuinely different questions.
  //   `hover` (local) — the cell MY cursor is on. Draws the dashed preselect.
  //   `bus.hover`     — the cell ANYONE's cursor is on, this pane included.
  // The bus channel deliberately carries no source tag, so the only way this
  // pane can tell "someone else is pointing at that" from "I am pointing at
  // that" is to remember what it published. Hence the local copy: the spotlight
  // below fires only when the two DISAGREE.
  //
  // The writers are pulled out by name because they are the STABLE part of the
  // bus (useCallback'd for exactly this) — `bus` itself is a fresh object every
  // render, so an effect depending on it would fire every render.
  const { setHover: busSetHover, endHover: busEndHover, clearFocus: busClearFocus } = bus
  const [hover, setHover] = useState<string | null>(null)
  const hoverId = bus.hover

  // OB-096 — the map's own floating chrome. `pointerPos` anchors MapTooltip
  // beside the cursor (screen-relative to the svg, not a fixed corner);
  // `hoverEdge` is which selection-overlay road, if any, the cursor is on
  // (a relation tooltip only ever has something to show while a selection's
  // roads are drawn).
  const [pointerPos, setPointerPos] = useState<XY | null>(null)
  const [hoverEdge, setHoverEdge] = useState<Bundle | null>(null)
  // THE VISIBILITY EYE hides THE WHOLE WALK DRAWING — pins AND arrows, one wrapper,
  // since OB-122 — and it hides it PER WALK (OB-134 clause 4, #252). This comment used
  // to say the flag gated "the walk-route pins", which had described half of what it
  // did for two of the DS's items, and is very likely the sentence their stale reading
  // (`1e530af`) was taken from. `hiddenWalks` is the set of walks the eye has hidden;
  // `walkVisible` is derived, so a change of walk shows the new walk with no click and
  // no effect — the rule itself is `src/model/walkvisibility.ts`.
  const [hiddenWalks, setHiddenWalks] = useState<ReadonlySet<string>>(() => new Set())
  const walkKey = walkKeyOf(bus.activeWalk)
  const walkVisible = !!wall || walkDrawn(hiddenWalks, walkKey)

  // ── #246: THE WALK DOCK — the walk's own transport, docked on the pane's bottom
  // edge (DS OB-130). It plays the SAME walk the pins draw, through the same
  // `useWalkPlayback` the viewer's strip and the presenter read, so its knob, the
  // strip's cursor and the pins' current stop are one cursor. It mounts only while
  // the route on the map IS the played walk (`routeIsWalk`): a `bus.teach`
  // curriculum draws pins but is no walk, and an empty route is nothing to dock
  // onto. `pinHover` is a pin's own hover — index into `play.steps` plus the
  // viewport anchor the DS's `WalkPreview` hangs the card from.
  const play = useWalkPlayback(bus)
  // the wall shows the whole walk still: no dock, no band (OB-139 rule 4)
  const dockShown = !wall && routeIsWalk(bus.route, play.steps)

  // ── THE CAMERA (#324 seam 3) — its live half is `map/mapcamera.ts` ─────────
  // Called here, right after `dockShown`, so `f`/`px` exist before the label and
  // pin memos below and so a level step or a pan knows whether playback is live
  // (OB-179). The frame it opens at is the wall's own on the wall, else the map's home.
  const cam = useMapCamera({
    svgRef,
    playing: play.playing,
    dockShown,
    peek: bus.peek,
    initialView: wall ? WALL_VIEW : HOME_VIEW,
    initialLevel: wall ? WALL_LEVEL : 0,
  })
  const {
    view, level, showLevel, showView, flyToLevel, stepLevel, cancelFlight, sceneRef,
    clientBox, f, px, worldFsToPx, onScreen, toUser, panBy, settlePan,
  } = cam
  // THE DOCK'S OPEN STATE IS HELD HERE (OB-156), because the floating chrome has to read it:
  // rule 2b of the DS's WalkDock contract lifts every floating control by the dock's LIVE
  // height — `closed` while closed, `open` while open — never by a measured DOM height.
  const [dockOpen, setDockOpen] = useState(false)
  // 12px from the pane's bottom edge; over the dock's live height while one is mounted
  const chromeBottom = 12 + (dockShown ? (dockOpen ? WALK_DOCK_METRICS.open : WALK_DOCK_METRICS.closed) : 0)
  // and it moves on the dock's OWN fold (`WALK_DOCK_METRICS.fold`, never a retyped 280), with
  // `--ease-soft`, so it arrives with the rail rather than after it
  const chromeRide = 'bottom ' + WALK_DOCK_METRICS.fold + 'ms var(--ease-soft)'

  // ── OB-173: A WALK STOP IS A HIGHLIGHT, NOT A SELECTION ────────────────────
  // Every seek and every tick of the clock writes the focus (playback.ts, via 'walk'), and a
  // focus is a SELECTION here: an outline, plus every relation the selected node has drawn
  // across the map. So playing a walk was flashing a different node's relationship diagram
  // over the walk on every stop — the one drawing the professor is watching, removed by the
  // act of watching it. The owner asked for the hover's treatment instead, and the hover's
  // treatment already exists: the spotlight another pane's hover lights a cell with.
  //
  // FOCUS ITSELF STAYS. It is the app's "where am I": the document pane reads the stop, the
  // connections pane re-aims, the breadcrumb follows. Taking it away to fix a drawing would
  // stop all of that. What changes is only what THIS pane draws for it — the item's own
  // instruction was to separate the legitimate half from the dimming rather than keep both.
  //
  // GATED ON THE WALK BEING ON THE MAP (`dockShown`), which is also what answers "no
  // highlight stuck on when playback ends": dismiss the walk and there is no walk stop, so
  // there is nothing to light. Pausing keeps it, deliberately — a paused walk is still
  // standing somewhere, and a seek is an advance too.
  const lastFocusEntry = bus.trail[bus.trail.length - 1]
  const walkDroveFocus =
    dockShown && sel !== null && lastFocusEntry !== undefined && lastFocusEntry.id === sel && lastFocusEntry.via === 'walk'
  /** the selection AS THIS PANE DRAWS IT — null while the walk is the one standing there, so
   *  the outline and the relations overlay both stand down. `sel` itself is untouched: the
   *  click behaviour, the dashed preselect and the deselect-on-second-click all still read it. */
  const selDrawn = walkDroveFocus ? null : sel
  /** a pin's own hover: the stop index, the card's anchor, and — for a MERGED pin — the mark it
   *  stands for (OB-184 clause 3), which `renderStopPreview` turns into a card naming every stop */
  const [pinHover, setPinHover] = useState<PinHover | null>(null)
  // #238 — the last cursor position seen over this pane, in CLIENT coords. A ref
  // and not state, deliberately: it is written on every single pointermove and
  // must never cause a render. It exists only so the tooltip can be placed at the
  // instant it MOUNTS, because `pointerPos` is no longer tracked while the tooltip
  // is down — see the gate in onPointerMove.
  const lastClient = useRef<XY | null>(null)

  /** put the card where the cursor already is. Called wherever a hover BEGINS,
   *  because the per-move gate is closed until that instant, so `pointerPos` is
   *  still holding wherever the PREVIOUS hover left it — without this the card
   *  appears for a frame at the last cell's coordinates and reads as a jump.
   *
   *  CALLED FROM THE HOVER HANDLERS, NOT FROM AN EFFECT. An effect keyed on "is
   *  anything hovered" looks equivalent and is not: crossing from one cell to the
   *  next drops that condition and re-raises it, so the effect fires on every
   *  boundary and forces a second render pass for the same gesture. Measured — it
   *  put the tooltip-up case UP from 433ms to 505ms, i.e. it cost more than the
   *  gate saved. Setting both states inside one handler batches them into the one
   *  render that was already happening. */
  const placeTipAtCursor = () => {
    const c = lastClient.current
    const svg = svgRef.current
    if (!c || !svg) return
    const b = svg.getBoundingClientRect()
    setPointerPos({ x: c.x - b.left, y: c.y - b.top })
  }

  const enterCell = (id: string) => {
    setHover(id)
    busSetHover(id)
    placeTipAtCursor()
  }
  const leaveCell = (id: string) => {
    setHover((h) => (h === id ? null : h))
    busEndHover(id)
  }
  // hoverRef mirrors state for the level-change clear below, which must read the
  // CURRENT local hover without re-running on every hover move
  const hoverRef = useRef(hover)
  useEffect(() => {
    hoverRef.current = hover
  })

  // a level change swaps which paths are hit targets mid-hover, so no
  // pointerleave ever fires on the old one — clear it explicitly, on the bus
  // too, or a spotlight stays lit on a cell the cursor already left. But end
  // only OUR OWN published id (endHover is guarded on it): a look flight also
  // changes level, and blanking the whole channel would kill the foreign hover
  // standing on the very row that asked for the flight.
  useEffect(() => {
    const h = hoverRef.current
    if (h) busEndHover(h)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate (see above): the stale hover must be cleared when a level change swaps the hit targets
    setHover(null)
  }, [level, busEndHover])

  // ── LOOK: the Connections pane's click-to-fly is the camera's now
  // (`map/mapcamera.ts`); what stays here is the CHANNEL — the spotlight below
  // keeps the looked-at node lit until the next look or a focus change.
  const peek = bus.peek

  // Esc clears the selection overlay without touching the camera. It also
  // clears the FOCUS — "nothing selected" has to be a real, reachable state
  // for the Connections pane's hover preview to have anywhere to live.
  const onWall = !!wall
  useEffect(() => {
    // the wall (#267) is a picture inside the presenter, whose own keys own the window
    if (onWall) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setSel(null)
        busClearFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busClearFocus, onWall])

  // A selection made ANYWHERE is the map's selection too. The map used to
  // reflect only a click that landed ON the map (local `sel`) and read bus.focus
  // for nothing — so a Connections-pane double-click set the focus to the child
  // but left the previously-selected PARENT outlined here (issue #7). Mirroring
  // focus is idempotent for the map's own clicks (they set focus to the same id)
  // and clears on Esc / water-click alike (focus goes null).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate (see above): the bus focus IS this pane's selection, mirrored idempotently
  useEffect(() => setSel(bus.focus), [bus.focus])

  // ── pan + the drag/click guard (same contract as the Map) ─────────────────
  const drag = useRef<{ x: number; y: number } | null>(null)
  const dragDist = useRef(0)
  const [dragging, setDragging] = useState(false)

  // Selecting a container used to OPEN the Connections pane — a 350ms-delayed
  // bus.reveal('connections'), delayed because a newly-mounting pane reflowed the
  // grid mid-gesture and the second click of a zoom double-click would land on
  // a map that had moved. Cut (#21): the map now only publishes focus, and what
  // is on screen stays the composition's business. A pane that appears under
  // your cursor because you clicked somewhere else is a surprise, and with the
  // authoring preset the map is one of several things that can move the focus —
  // so "who opens Connections" needs an answer that isn't "whoever moved last".
  // Cutting the reveal also retires the timer that only existed to survive it.
  const regionClick = (id: string) => {
    if (dragDist.current > 4) return
    // clicking the selected cell again DESELECTS it (2026-07-13) — and clears
    // the focus with it, so the Studio agrees nothing is selected
    if (sel === id) {
      setSel(null)
      busClearFocus()
      return
    }
    setSel(id)
    onFocus(id)
  }

  // ── #24 THE NODE DRAG (#399 cut 2) — the gesture is `map/nodedrag.ts` ──────
  // Called exactly where the drag state block sat, so the hook order is
  // unchanged. The pan/drag gates stay here and read `nodeDown.current`, which
  // the hook returns; `drag`/`dragDist`/`dragging` stay here because pan shares
  // them.
  const { ghost, nodeDown, down, move, release } = useNodeDrag({ svgRef, dragRef: drag, dragDistRef: dragDist, setDragging })

  // ── THE SELECTION OVERLAY (#399 cut 1) — the deciding half is `map/mapselect.ts` ─
  // Called exactly where the `roadsFor` memo and its clear effect sat, so that
  // effect keeps its place in the hook order.
  const { bundles, selOutline, centreLit, litRoad, anyRoadLit, clipRoad, roadFloor, neighbourhood } = useMapSelection({ sel, selDrawn, wall, px, hoverId, hoverCenter: bus.hoverCenter, setHoverEdge })

  // ── SEARCH MATCHES (#25) — the supply pane's live hit set, lit on the map ──
  // A match deep in a subtree owns no cell at this stratum, so it ROLLS UP to
  // its VISIBLE ANCESTOR: pathTo(m)[level+1] is the containment ancestor sitting
  // exactly on the current level (or m itself when its own tier is this level).
  // Tally per ancestor → a count, so "3 matches under Systems Programming" reads
  // as one badge on that domain instead of three invisible deep hits. Matches
  // shallower than the level (an ancestor of the whole stratum) have no single
  // cell here and are dropped. Cheap (≤ MAX_HITS) so it runs each render — it
  // must, since onScreen culling moves with the pan.
  const matchPins: { id: string; c: XY; n: number }[] = []
  if (bus.matches.size > 0) {
    const tally = new Map<string, number>()
    for (const m of bus.matches) {
      const anc = pathTo(m)[level + 1]
      if (anc) tally.set(anc, (tally.get(anc) ?? 0) + 1)
    }
    for (const [id, n] of tally) {
      const ft = flightTargetOf(id)
      if (ft && ft.tier === level && onScreen(ft.c, 60)) matchPins.push({ id, c: ft.c, n })
    }
  }

  // ── THE LABELS (#324 seam 4) — the fitting half is `map/maplabelfit.ts` ─────
  // Called exactly where `labelFontsReady` and its memos sat, so the font-ready
  // effect keeps its place in the hook order, and `labelBoxes` exists before
  // `routeStops` below reads it.
  const { labelFit, rootLabelFit, labelBoxes } = useMapLabelFit({ level, f })

  // ── THE WALK'S PINS (#26) — where each stop is drawn at this level ──────────
  // The whole decision moved to `model/walkpins.ts` (#249, OB-128). It used to
  // be two memos here — a resolve, then a collapse into what actually gets
  // drawn — and five obligations had rewritten them between them, each argued
  // from a screenshot because a memo closed over React state cannot be called
  // with a walk and a level and asked what it would draw. It is a pure function
  // of the walk, the level and the zoom now, tested against real coordinates in
  // walkpins.test.ts; and the two items still queued against it (OB-114,
  // OB-132) have a named thing to change rather than a memo to re-derive.
  //
  // THE CURSOR IS NOT AN INPUT ANY MORE (OB-132). Where the walk IS on these
  // pins is the band's question, read per frame from `play.position` below; the
  // pins themselves are rebuilt only when the walk, the level or the zoom
  // changes — never per frame, which is what lets a played walk redraw at the
  // frame rate without re-laying-out its pins every time.
  //
  // WHICH STOPS THE WALK MAY SKIP (DS OB-214 clauses 2-3) come from the same place `bus.route`
  // does — `bus.routeSteps`, whose leaves carry the flag — as a list indexed like the route. The
  // pins take it beside the route; only stage 2's merge reads it. A BYPASSED optional is not in
  // the route at all (the desk resolved it away before publishing), so there is no ghost pin.
  const routeOptional = useMemo(() => routeOptionals(bus.routeSteps), [bus.routeSteps])
  const routeStops = useMemo(
    () => walkPins({ route: bus.route, optional: routeOptional, level, px, labelBoxes }),
    // `px` is STABLE (mapcamera's useCallback on f/view.s, its old deps), so listing it
    // re-runs this memo exactly when either of those moves. The fresh-reference warning
    // this used to suppress is gone with the fresh reference.
    [bus.route, routeOptional, level, px, labelBoxes],
  )
  // ── OB-132: WHERE THE WALK IS, IN PINS. The DS's band (`walkBand`) fades every
  // mark by its distance from the played position — full on the stop, five
  // stops of trail behind, two of lead ahead, nothing beyond — and pops the mark
  // the position is arriving at. It is read here in PIN units (`pinPosition`),
  // because a pin at a coarse level stands for a run of stops. A route that is
  // not the walk being played (a `bus.teach` curriculum) has no position and no
  // band: `null`, and every pin and arrow draws at rest.
  const pinPos = dockShown ? pinPosition(routeStops, play.position) : null

  // ── OB-163: THE WALL FITS THE WHOLE WALK ONCE, THEN NEVER MOVES ──────────────
  // The fit, its two passes and the frame the host keeps are `map/wallfit.ts` (#324). The fit
  // IS a camera move, made from a box a render cannot know, so it is handed the camera's own
  // two setters — the level's ref kept in step, as the camera keeps it for every level change.
  useWallFit({ wall, clientBox, route: bus.route, pins: routeStops, level, showLevel, showView })

  // ── OB-179: PLAYBACK MOVES THE CAMERA ONLY WHEN THE STOP IS OFF-SCREEN ─────
  // The rule, its three caller clauses and the flight are `map/arrivallook.ts`
  // (#324 seam 3); this pane hands it the played walk and the pins it draws by.
  useArrivalLook(cam, { dockShown, onWall, playing: play.playing, position: play.position, stepCount: play.steps.length, pins: routeStops, dockOpen })


  // OB-117 — the walk recedes while a node's relationships are on screen. The
  // relation arrows are drawn by the `sel` overlay and by nothing else, so the
  // selection IS the condition; deselecting restores full weight on its own.
  //
  // UNLESS THE WALK MADE THE SELECTION ITSELF (OB-132, 2026-09-05). `sel` follows
  // `bus.focus`, and every seek and every tick of the clock writes the focus
  // (playback.ts, via 'walk'), so a walk being played was selecting each stop's
  // cell as it arrived and receding ITSELF — bark-300 at 0.6, the band's pop and
  // its acorn head drawn grey at the one moment they exist for. The trail log is
  // append-only and tagged, so its latest entry says who wrote the focus: a
  // selection the walk made does not recede the walk; a click on the map does.
  const walkReceded = !wall && selDrawn !== null


  // territories in play: everything up to one tier below the stratum (so the
  // next level fades IN instead of popping), viewport-culled by owning topic
  const mounted = territories.filter((t) => t.tier <= level + 1 && (t.tier === 2 || onScreen(leafPos[t.topic], 90)))
  /** the level-k countries: this tier's nodes plus every leaf that bottomed
   * out above — leaf persistence keeps jagged branches on the map */
  const isActive = (t: { tier: number; leaf: boolean }) => t.tier === level || (t.leaf && t.tier < level)
  const isMuted = (t: { tier: number; leaf: boolean }) => t.leaf && t.tier < level

  /* THE USER'S OWN OPEN MAP, WITH THE SELECTION'S PATH FOLDED INTO IT ONCE PER SELECTION
     (OB-244). Never spread over it per render: the forced path wins again on the very next
     frame, so every ancestor of the selected node springs back open the instant it is
     collapsed and the carets read as dead. Folded once, the path opens when you arrive and
     every caret works immediately afterwards; the fold INCLUDES the node itself, which is
     what makes selecting a container open it. */
  useEffect(() => {
    if (!bus.focus) return
    const add = OpenOnSelect(CORPUS_TREE, bus.focus)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate (see above): the fold is applied ONCE per selection, never spread per render
    setUserOpen((o) => {
      let changed = false
      for (const k in add) { if (!o[k]) { changed = true; break } }
      return changed ? { ...o, ...add } : o
    })
  }, [bus.focus])

  /* AND THE MAP'S VIEW OPENS WHAT IT SHOWS (OB-227 clause 4): every visible node's ancestors
     are open and nothing else is force-opened — the user's collapses elsewhere survive,
     because this merges and never closes. The visible set is the CURRENT LEVEL's cells, the
     same list the paint below walks. */
  const visibleKey = mounted.filter(isActive).map((t) => t.id).join('|')
  useEffect(() => {
    if (!visibleKey) return
    const add = OpenForVisible(CORPUS_TREE, visibleKey.split('|'))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate (see above): merges, never closes, so a user's collapses survive
    setUserOpen((o) => {
      let changed = false
      for (const k in add) { if (!o[k]) { changed = true; break } }
      return changed ? { ...o, ...add } : o
    })
  }, [visibleKey])

  /* THE HEADER ROW'S PATH (OB-241 + OB-243): the selection's ancestry, walkable back up. The
     aim keeps its resting reading after a deselect while the LIT state goes out — the same
     split the connections pane draws — because the breadcrumb is the readout for where the
     pane is AIMED, not for what is selected. */
  const restId = bus.history.cursor >= 0 ? bus.history.stack[bus.history.cursor] : ROOT_ID
  const aimId = bus.focus ?? (byId.has(restId) ? restId : ROOT_ID)
  const crumbPath = (findTreePath(CORPUS_TREE, aimId) ?? []).map((n) => ({ id: n.id, title: n.title, domain: n.root ? null : n.domain }))
  const hoverOutline = hover && hover !== sel && !dragging ? outlineOf(hover) : undefined

  // SPOTLIGHT — a hover published by ANOTHER instrument: "the thing your cursor
  // is on over there lives HERE". Suppressed when it is just our own preselected
  // cell echoing back (that already has the dashed outline). Any node can be
  // spotlit, at any level: a deep concept lights its own small cell inside its
  // topic, which is exactly the "where does this sit?" answer. Display only —
  // the camera never moves, so a hover can never steal the view.
  //
  // The spotlight also carries the LOOK: the last clicked Connections node
  // stays lit — lifted to its owning topic when it has no cell of its own —
  // until the look is superseded (next look, any focus change). "Highlight" is
  // half of what the click asked for; the flight above is the other half.
  const lookId = peek ? (outlineOf(peek.id) ? peek.id : endpointAtTier(peek.id, 2)) : null

  // item 2: WHICH HOVER GETS WHAT. The spotlight described above and the card
  // described below are one decision with two different answers, so they are
  // decided together, in `src/model/maphover.ts` rather than inline here — that
  // file's header carries the reasoning. The short version is OB-127 (#251): a
  // hover published by another pane lights a cell and stops there. It used to
  // also raise a card, at whatever point over this pane the cursor last occupied,
  // which was routinely nowhere near the cell being reported.
  const marks = hoverMarks({
    cursorCell: hover,
    selectedCell: sel,
    publishedCell: hoverId,
    lookedAtCell: lookId,
    walkStopCell: walkDroveFocus ? sel : null,
    onRelation: hoverEdge !== null,
    walkPinHovered: pinHover !== null,
  })
  const spotId = marks.spotlightId
  const spotOutline = spotId ? outlineOf(spotId) : undefined

  // THE CELL THE CARD IS ABOUT — our own cursor's, and now only ever our own. It
  // feeds MapTooltip's immediate title readout rather than the native <title>,
  // which lags ~half a second and is OS-styled; this reads the moment the pointer
  // lands. Called `hoverChip` until 2026-08-28 (#221) after the fixed top-left
  // chip it used to feed (OB-095 deleted that surface at 1e530af, OB-096 put the
  // cursor-anchored card in its place), then `hoverNode` until OB-127 took the
  // published hover out of it. Named for the card now, since the name has already
  // outlived two surfaces.
  const cardNode = marks.card?.kind === 'node' ? marks.card.id : null

  // ── #238: WHEN THE CURSOR'S POSITION IS WORTH KNOWING ─────────────────────
  // `pointerPos` is read for exactly one thing — placing MapTooltip beside the
  // cursor (OB-096) — and the tooltip only mounts when there is something to
  // report. So the position is only worth tracking while `tipLive` holds, and
  // this is the single expression that decides both, so the gate and the render
  // condition below cannot drift apart.
  //
  // Ungated it cost, per second of cursor movement over water at L2: 430ms of
  // scripting, a forced layout per move, and ZERO style recalculations — a full
  // re-render of ~500 SVG elements to move a card that was not on screen, against
  // a 4ms idle floor. Measured by tools/studio-spike/probe-maplag.mjs.
  //
  // What this does NOT fix, and #238 stays open for: while the tooltip IS up the
  // gate is open and the per-move re-render is back at full price (~420ms on the
  // same measure). Removing that too means not putting the position in state at
  // all — writing it to the card's own style through a ref. That was held back
  // pending the Design System's answer on whether MapTooltip anchors to the hovered
  // ELEMENT instead, which would have deleted this class of work rather than
  // optimised it. OB-127 answered: the cursor, unqualified. So the ref rewrite is
  // now all that is left of #238, and it waits on nobody.
  const tipLive = marks.card !== null

  // REMOVED at OB-127, recorded so it is not rebuilt: a `useLayoutEffect` keyed on
  // `spotId` that called `placeTipAtCursor()` whenever another pane published a
  // hover, placing the card before paint so it did not visibly jump. Careful work
  // on a problem that stopped existing — that case draws no card at all now.

  // OB-096 — the hovered node's OWN roads, for MapTooltip's relations row. A
  // fresh call rather than reusing the selection's `bundles`/`arrows` above:
  // the hovered node is rarely the selected one, and roadsFor is cheap
  // enough at this corpus's scale (memoised on the id, so cursor movement
  // that stays inside one cell recomputes nothing).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- the memo is deliberate: it keeps the two counts below from re-walking the roads on every pointer move inside one cell
  const { arrows: hoverArrows } = useMemo(() => roadsFor(cardNode), [cardNode])
  const hoverRelIn = cardNode ? hoverArrows.filter((a) => a.tgt === cardNode).reduce((s, a) => s + a.n, 0) : 0
  const hoverRelOut = cardNode ? hoverArrows.filter((a) => a.src === cardNode).reduce((s, a) => s + a.n, 0) : 0

  const canvas = (
    <PaneCanvas aria-label="map-view" face="none" style={{ background: MAP_WATER }}>
      <svg
        ref={svgRef}
        data-nested
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        className="w-full h-full"
        data-zoom={view.s.toFixed(2)}
        data-level={level}
        data-sel={sel ?? undefined}
        data-peek={peek?.id}
        data-match-cells={matchPins.length || undefined}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={(ev) => {
          cancelFlight()
          dragDist.current = 0
          // #24 — the SELECTED cell is the road's drag handle. A press on it must
          // let the native HTML5 drag own the gesture, so DON'T arm a pan and
          // DON'T capture the pointer (capture would suppress dragstart). A press
          // anywhere else — another cell, water — pans exactly as before. Because
          // selection is the gate, pan and drag never share a target and never
          // race for the same movement. A plain click on the selected cell still
          // deselects: drag.current stays null so no pan runs, dragDist is 0, and
          // regionClick fires on click-up.
          const t = ev.target as Element
          const downId = t.getAttribute('data-terr') ?? t.getAttribute('data-region')
          if (downId && downId === sel) {
            down(ev, t, sel)
            return
          }
          drag.current = { x: ev.clientX, y: ev.clientY }
          setDragging(true)
          t.setPointerCapture(ev.pointerId)
        }}
        onPointerMove={(ev) => {
          // OB-096 — MapTooltip is cursor-anchored, so while it is up every move
          // (not just drag moves) updates where it sits, relative to this svg's
          // own box. GATED on `tipLive` (#238): with nothing being reported there
          // is no card to place, and both the getBoundingClientRect and the state
          // update are pure waste. The ref write is unconditional and free — it is
          // what lets the card be placed correctly the moment the gate opens.
          lastClient.current = { x: ev.clientX, y: ev.clientY }
          if (tipLive) {
            const svgBox = svgRef.current!.getBoundingClientRect()
            setPointerPos({ x: ev.clientX - svgBox.left, y: ev.clientY - svgBox.top })
          }
          // ── node drag (arming or in flight) takes priority over pan ──────
          const nd = nodeDown.current
          if (nd) {
            move(ev, nd)
            return
          }
          if (!drag.current) return
          const dx = ev.clientX - drag.current.x
          const dy = ev.clientY - drag.current.y
          drag.current = { x: ev.clientX, y: ev.clientY }
          // the camera's half is `panBy` (straight to the DOM, no render, and its own
          // PAN_COMMIT rule); what the click guard needs back is how far the pointer went
          dragDist.current += panBy(dx, dy)
        }}
        onPointerUp={(ev) => {
          if (nodeDown.current) {
            release(ev)
            return
          }
          // settle: whatever drift never crossed PAN_COMMIT is committed now, so
          // the map is culled for exactly where it ended up. A no-op when the
          // last move already committed.
          if (drag.current) settlePan()
          drag.current = null
          setDragging(false)
        }}
        onClick={(ev) => {
          // click on water (the svg itself, no active cell under the cursor)
          // clears — selection AND focus, the map's "stand nowhere" gesture
          if (dragDist.current > 4) return
          if (ev.target === svgRef.current) {
            setSel(null)
            busClearFocus()
          }
        }}
        onDoubleClick={(ev) => {
          stepLevel(1, toUser(ev.clientX, ev.clientY))
        }}
      >
        <defs>
          {/* soft selection glow (#8): a real gaussian bloom, keyed to the
              selected cell's tree color and zoom-stable via px(). Lives in the
              luminance channel the flat tree-color fills never use, so the
              selection reads as "lit" even beside a same-hue sibling. The wide
              region keeps the blur from clipping at the filter's default box. */}
          <filter id="sel-glow" x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={px(7.5)} />
          </filter>
        </defs>
        {/* no `transform` prop — see paintCamera. The camera is written here
            imperatively so a pan costs one attribute write instead of a render
            of everything below this node. */}
        <g ref={sceneRef} data-scene="">
          {/* ── FILLS, painted shallow → deep. Only the active level carries
              paint (pale tree colors) and pointer events; everything else is
              mounted transparent so level changes FADE. ─────────────────── */}
          {/* OB-193: THE ROOT'S OWN LEVEL — one region, the whole corpus, drawn where the six
              domains sit today (same `rootRings`/`countryRings` extent, same camera). It takes
              `territoryFillOf`/`colorOf(ROOT_ID)`, which every map fill/anchor lookup already
              falls back to a neutral swatch for on an id with no hue family — the root has
              none, by design (owner, 2026-09-15), so it draws colourless without a second
              colour path to keep in step with the rest of the map. It has no sibling to
              separate from, so it carries no ancestor-border line-work of its own. */}
          <path
            d={rootPath}
            data-region={ROOT_ID}
            data-rtier={-1}
            fill={territoryFillOf(ROOT_ID)}
            fillOpacity={level === -1 ? 0.95 : 0}
            stroke="#ffffff"
            strokeOpacity={level === -1 ? 0.9 : 0}
            strokeWidth={px(1.2)}
            pointerEvents={level === -1 ? 'auto' : 'none'}
            style={{ cursor: sel === ROOT_ID ? 'grab' : 'pointer', transition: FADE }}
            onClick={() => regionClick(ROOT_ID)}
            onPointerEnter={() => enterCell(ROOT_ID)}
            onPointerLeave={() => leaveCell(ROOT_ID)}
          />
          <g>
            {domainIds.map((d) => (
              <path
                key={d}
                d={countryPath[d]}
                data-region={d}
                data-rtier={0}
                fill={territoryFillOf(d)}
                fillOpacity={level === 0 ? 0.95 : 0}
                stroke="#ffffff"
                strokeOpacity={level === 0 ? 0.9 : 0}
                strokeWidth={px(1.2)}
                pointerEvents={level === 0 ? 'auto' : 'none'}
                style={{ cursor: sel === d ? 'grab' : 'pointer', transition: FADE }}
                onClick={() => regionClick(d)}
                onPointerEnter={() => enterCell(d)}
                onPointerLeave={() => leaveCell(d)}
              />
            ))}
          </g>
          <g>
            {provinceIds.map((m) => (
              <path
                key={m}
                d={provincePath[m]}
                data-region={m}
                data-rtier={1}
                fill={territoryFillOf(m)}
                fillOpacity={level === 1 ? 0.95 : 0}
                stroke="#ffffff"
                strokeOpacity={level === 1 ? 0.95 : 0}
                strokeWidth={px(1.1)}
                pointerEvents={level === 1 ? 'auto' : 'none'}
                style={{ cursor: sel === m ? 'grab' : 'pointer', transition: FADE }}
                onClick={() => regionClick(m)}
                onPointerEnter={() => enterCell(m)}
                onPointerLeave={() => leaveCell(m)}
              />
            ))}
          </g>
          <g>
            {mounted.map((t) => (
              <path
                key={t.id}
                d={t.d}
                data-terr={t.id}
                data-tier={t.tier}
                fill={territoryFillOf(t.id)}
                fillOpacity={isActive(t) ? (isMuted(t) ? 0.6 : 0.95) : 0}
                stroke="#ffffff"
                strokeOpacity={isActive(t) ? 0.95 : 0}
                strokeWidth={px(1.05)}
                pointerEvents={isActive(t) ? 'auto' : 'none'}
                style={{ cursor: sel === t.id ? 'grab' : 'pointer', transition: FADE }}
                onClick={() => regionClick(t.id)}
                onPointerEnter={() => enterCell(t.id)}
                onPointerLeave={() => leaveCell(t.id)}
              />
            ))}
          </g>

          {/* ── LINE-WORK: under the context window at most ONE of these
              layers is visible at a time — the immediate parent grain. The
              active level owns the whole color budget. ──────────────────── */}
          <g pointerEvents="none">
            {domainIds.map((d) => (
              <path
                key={d}
                d={countryPath[d]}
                data-border={d}
                data-btier={0}
                fill="none"
                stroke={colorOf(d)}
                strokeOpacity={ancBorderO(level)}
                strokeWidth={px(PARENT_BORDER_W)}
                style={{ transition: FADE }}
              />
            ))}
            {provinceIds.map((m) => (
              <path
                key={m}
                d={provincePath[m]}
                data-border={m}
                data-btier={1}
                fill="none"
                stroke={colorOf(m)}
                strokeOpacity={ancBorderO(level - 1)}
                strokeWidth={px(PARENT_BORDER_W)}
                style={{ transition: FADE }}
              />
            ))}
            {[...mounted]
              .filter((t) => !t.leaf)
              .sort((a, b) => a.tier - b.tier)
              .map((t) => (
                <path
                  key={t.id}
                  d={t.d}
                  data-border={t.id}
                  data-btier={t.tier}
                  fill="none"
                  stroke={colorOf(t.id)}
                  strokeOpacity={ancBorderO(level - t.tier)}
                  strokeWidth={px(PARENT_BORDER_W)}
                  style={{ transition: FADE }}
                />
              ))}
          </g>

          {/* ── OB-223: THE TINTS OF HOVER, SPOTLIGHT AND SELECTION, UNDER THE LABELS.
              A ghost heading is now ONE opaque tone and has to be painted above every
              fill AND every wash — an alpha'd hue composited through a wash takes a
              different shade over the selected child than over its siblings, which is
              the fault. So each of those drawings is split in two along the line it
              always had: its TINT (a fill, pointer-transparent, no stroke) lives here,
              below the label layer; its OUTLINE (a stroke) stays where it was, above
              the labels, the walk and the roads, so nothing about how a boundary reads
              moves. Each half is the same shape from the same outline, so they cannot
              drift. Fill first, stroke second is the order the single path drew in;
              it is only the labels that now sit between them. ──────────────────── */}
          <g data-washes pointerEvents="none">
            {hoverOutline && <path d={hoverOutline} fill={colorOf(hover!)} fillOpacity={0.1} />}
            {spotOutline && <path d={spotOutline} fill={colorOf(spotId!)} fillOpacity={0.25} />}
            {neighbourhood.map((cp) => {
              const o = outlineOf(cp)
              if (!o) return null
              // follows the roads' hover dim, exactly as its outline does
              const dim = anyRoadLit && litRoad !== cp
              return <path key={cp} d={o} fill={colorOf(cp)} fillOpacity={0.1} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity 120ms' }} />
            })}
            {sel && !wall && selOutline && (
              <>
                {/* the glow's own blurred tint and the body wash, back to front, as they drew before; the
                    glow brightens while the Document pane's hub is pointed at (`centreLit`, OB-230) */}
                <path d={selOutline} fill={colorOf(sel)} fillOpacity={centreLit ? SELECTION_WASH.glowLit : SELECTION_WASH.glow} strokeLinejoin="round" filter="url(#sel-glow)" />
                <path d={selOutline} fill={colorOf(sel)} fillOpacity={SELECTION_WASH.body} />
              </>
            )}
          </g>

          {/* ── labels: their own layer now, `map/MapLabels.tsx` (#324 seam 4).
              Paint order is still the point — every ghost before every active
              name — and the rule for it lives with the layer. ─────────────── */}
          <MapLabels
            level={level}
            labelFit={labelFit}
            rootLabelFit={rootLabelFit}
            px={px}
            worldFsToPx={worldFsToPx}
            onScreen={onScreen}
            mounted={mounted}
            isActive={isActive}
            isMuted={isMuted}
            sel={sel}
            hover={hover}
          />

          {/* ── SEARCH MATCH PINS (#25): the live hit set, lit on the territory
              on a DIFFERENT visual axis than selection (glow) or hover (dashed)
              — an amber count pin, so three highlight states never fight over
              the ring. A deep hit rolls up to its visible ancestor and the pin
              carries how many landed there. pointer-events none: a pin never
              eats a click meant for the cell under it. ──────────────────── */}
          {matchPins.length > 0 && (
            <g data-matches pointerEvents="none">
              {matchPins.map((p) => (
                <g key={p.id} data-match={p.id} data-mn={p.n} transform={`translate(${p.c.x} ${p.c.y})`}>
                  <circle r={px(8.5)} fill="#f59e0b" stroke="#ffffff" strokeWidth={px(2)} />
                  <text
                    textAnchor="middle"
                    y={px(3.4)}
                    fontSize={px(10)}
                    fontWeight={800}
                    fill="#ffffff"
                    style={{ userSelect: 'none' }}
                  >
                    {p.n}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* ── THE WALK'S ARROWS (#26). The whole drawing — the shared head (OB-126),
              the bow signs (OB-107), every arrow's distance, angle, tail anchor and
              length, and the counter-scale that makes the DS's real-px numbers work
              under this camera — is `map/WalkArrows.tsx` over `model/walkdraw.ts` now
              (#324 seam 2). The PINS are the other half, painted LAST at the end of the
              scene (OB-221), which is why the walk is two groups and not one: a line
              may pass under a boundary, but a pin carries the only copy of its address.
              Both are gated by the same `walkVisible`, so the eye still hides the walk.
              ─────────────────────────────────────────────────────────────────────── */}
          <WalkArrows bus={bus} pins={routeStops} pinPos={pinPos} f={f} viewS={view.s} px={px} wall={wall} visible={walkVisible} receded={walkReceded} />

          {/* ── HOVER PRESELECTION: the cell a click would pick — kills the "which
              region am I over?" guess. Its OUTLINE is here, above the labels and the
              walk; its light TINT is the `data-washes` group below the label layer
              (OB-223), the same outline path. ────────────────────────────── */}
          {hoverOutline && (
            <g data-hover={hover} pointerEvents="none">
              <path d={hoverOutline} fill="none" stroke="#ffffff" strokeWidth={px(3)} strokeOpacity={0.9} />
              <path d={hoverOutline} fill="none" stroke={colorOf(hover!)} strokeWidth={px(1.5)} strokeOpacity={0.9} strokeDasharray={`${px(5)} ${px(3)}`} />
            </g>
          )}

          {/* ── SPOTLIGHT: something hovered in ANOTHER pane lives here. Outline
              here; its tint is in `data-washes` (OB-223). ─────────────────── */}
          {spotOutline && (
            <g data-spot={spotId} pointerEvents="none">
              <path d={spotOutline} fill="none" stroke="#ffffff" strokeWidth={px(4.5)} strokeOpacity={0.95} />
              <path d={spotOutline} fill="none" stroke={colorOf(spotId!)} strokeWidth={px(2.4)} strokeOpacity={0.95} />
            </g>
          )}

          {/* ── SELECTION OVERLAY: the selected region's typed edges, pinned
              until click-off. Edges live at the topic grain but run BORDER to
              BORDER along the capital-to-capital line: each end dips px(11)
              past its cell's border, so the arrows point INTO territories
              instead of converging on the city dots. White-cased for
              readability, arrowhead at the target. ─────────────────────── */}
          {sel && !wall && (
            <MapSelection
              sel={sel}
              selOutline={selOutline}
              centreLit={centreLit}
              neighbourhood={neighbourhood}
              anyRoadLit={anyRoadLit}
              litRoad={litRoad}
              bundles={bundles}
              clipRoad={clipRoad}
              roadFloor={roadFloor}
              px={px}
              setHoverEdge={setHoverEdge}
              placeTipAtCursor={placeTipAtCursor}
            />
          )}

          {/* ── THE WALK'S PINS — PAINTED LAST (OB-221). THE RULE IS "THE PINS ARE
              PAINTED LAST", NOT "THE PINS SIT AT LINE N": write any later insertion
              ABOVE this group, never after it.

              THE FAULT WAS PAINT ORDER, NOT A STYLE, and `z-index` is not the lever.
              Inside an SVG the later sibling wins, and this group used to sit inside
              `data-routepath`, ahead of the hover pre-selection, the spotlight and the
              selection overlay — so every cell-state treatment painted OVER the pins.
              What buried a pin standing on a focused cell was the selection's middle
              stroke: an opaque white casing, 6 screen px at 0.98 opacity, under a 4px
              stroke in the cell's own hue — ten pixels of ink centred on the boundary,
              five of it inside the cell, against a 22px pin whose own lift cannot raise
              it out. The pin carries the ONLY copy of its stop's address, so it read as a
              clipped "5" where the label was "1.5". Nothing errored and every prop was
              right.

              IT MOVED; IT WAS NOT REWRITTEN. `data-receded`, the opacity and its 120ms
              transition, the `foreignObject` per pin, `walkPins` and every coordinate are
              exactly as they were, and it is still inside the same camera transform (this
              scene group), so the pins land where they always landed. It is gated by the
              same `walkVisible` flag as the arrows, so the eye still hides the whole walk.

              THE PIN ONLY. `data-routepath` (the arrows) STAYS where it is: a pin carries
              content, while a line passing under a boundary reads as passing behind it,
              which is true and loses nothing. Moving all three would hide boundaries for
              nothing.

              NO GESTURE CHANGES. Every group the pins moved past is `pointerEvents=none`,
              and each pin sets its own below, so the pin's hover (the `WalkPreview` card)
              and the cell's tooltip behave exactly as before.

              OB-122 — the pins recede on the SAME condition and the same 120ms as the
              arrows.

              OPACITY IS THE WHOLE OF IT HERE, and that is a limit of the component, not a
              shortcut. The item asks for "the same --bark-300-equivalent tone AND ~0.6
              opacity as the arrows", but `NodeArrow` takes a `tone` prop and `StepDot`
              takes none — its props are `{ n, state, variant, size, optional, onClick,
              title }` and its colour comes from `state`, which is what tells current from
              done from ahead. Painting every pin bark-300 would collapse those three into
              one, so the tone half needs a receded treatment the DS owns, not a filter
              forced on it from out here. Asked in the receipt; opacity ships now because
              it is the half that is ours to give. ───────────────────────────── */}
          {/* the drawing itself — the marks memo, the band per pin, the DS dot and
              each pin's own gestures — is `map/WalkPins.tsx` over `model/walkdraw.ts`
              now (#324 seam 2). Its POSITION is the point: last child of the scene. */}
          <WalkPins
            pins={routeStops}
            pinPos={pinPos}
            play={play}
            f={f}
            viewS={view.s}
            wall={wall}
            visible={walkVisible}
            receded={walkReceded}
            dockShown={dockShown}
            dragging={dragging}
            onPinHover={setPinHover}
            onRegionClick={regionClick}
          />
        </g>
      </svg>

      {ghost && <DragGhost ghost={ghost} />}

      {/* ── OB-096: MapTooltip, cursor-anchored, replacing the old fixed
          top-left hover chip (OB-095) — a relation hover (an edge of the
          current selection) wins over a node hover, since the two can only
          coexist when the pointer sits exactly on the boundary between an
          edge's stroke and the territory under it. pointer-events-none so
          the card itself never steals the hover it is reporting on. ────── */}
      {pointerPos && tipLive && (
        <div data-maptip className="absolute z-10 pointer-events-none" style={{ left: pointerPos.x + 14, top: pointerPos.y + 14 }}>
          {hoverEdge ? (
            <MapTooltip
              kind="relation"
              hue={hoverEdge.type ? EDGE_COLOR[hoverEdge.type] : MIXED_EDGE_COLOR}
              title={hoverEdge.type ? EDGE_LABEL[hoverEdge.type] : 'mixed'}
              from={byId.get(hoverEdge.src)!.title}
              to={byId.get(hoverEdge.tgt)!.title}
            />
          ) : (
            <MapTooltip
              kind="node"
              hue={colorOf(cardNode!)}
              title={byId.get(cardNode!)!.title}
              typeLabel={byId.get(cardNode!)!.topic ? 'topic' : byId.get(cardNode!)!.kind}
              nodeCount={byId.get(cardNode!)!.kind === 'container' ? descendantCount(cardNode!) : undefined}
              relationsIn={hoverRelIn}
              relationsOut={hoverRelOut}
              parent={parentOf(cardNode!) !== ROOT_ID ? byId.get(parentOf(cardNode!))?.title : undefined}
            />
          )}
        </div>
      )}

      {/* ── OB-096/097: the map's own floating chrome, all built on
          MapFloatingButton. Levels bottom-left (changes WHAT you're looking
          at — depth into the corpus); zoom + visibility bottom-right
          (changes HOW you're looking — the viewport). Replaces the deleted
          bottom info bar (OB-094): levels move here, zoom % and the wheel/
          double-click hint aren't worth the space once real zoom buttons
          exist, and the selection summary folds into MapTooltip above. ── */}
      {/* #246: the floating chrome climbs over the dock while one is docked, so the level
          picker and the zoom buttons never sit under its rail — and BY THE DOCK'S LIVE HEIGHT
          (OB-156, ruled 2026-09-05): it used to climb by `closed` only, on the reading that the
          open row covering it was the same "open covers 50px of map" trade the auto-fit accepts.
          It is not the same trade. Rule 2 is about the MAP, where being covered costs a view of
          territory the user can pan back; a covered CONTROL costs the control — a level picker or
          a zoom button under the open row cannot be clicked, and zoom is this map's primary
          gesture. The owner met it live: the + cut in half by the dock's top edge, the eye gone.
          So the chrome climbs with the open state even though the map does not re-fit for it. */}
      {/* the wall (#267) has no chrome of its own: the room is looking at a picture */}
      {wall ? null : (<>
      <LevelPicker style={{ position: 'absolute', left: 12, bottom: chromeBottom, transition: chromeRide, zIndex: 10 }} levels={LEVEL_LABELS} level={levelToLabel(level)} onSelect={(l) => flyToLevel(labelToLevel(l))} />
      <div style={{ position: 'absolute', right: 12, bottom: chromeBottom, transition: chromeRide, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* names the DRAWING, not its nodes: the button moves pins and arrows together */}
        <MapFloatingButton size={36} title={walkVisible ? 'hide the walk' : 'show the walk'} onClick={() => setHiddenWalks((h) => toggleWalkHidden(h, walkKey))}>
          <VisibilityMark open={walkVisible} style={walkVisible ? undefined : { color: 'var(--bark-400)' }} />
        </MapFloatingButton>
        <ZoomControl onZoomIn={() => flyToLevel(level + 1)} onZoomOut={() => flyToLevel(level - 1)} zoomInDisabled={level >= L_MAX} zoomOutDisabled={level <= 0} />
      </div>
      </>)}

      {/* ── #246: THE WALK DOCK (DS OB-130), an overlay on the pane's bottom edge — the
          SVG never changes size when it opens, the pins under it show through. Same
          steps, cursor, clock and preview card as Walk·Viewer's strip. zIndex 11: over
          the pins' hover card and the tooltip, under nothing of this pane's own. */}
      {dockShown && (
        <WalkDock
          steps={play.steps}
          position={play.position}
          playing={play.playing}
          onPlayToggle={play.toggle}
          onSeek={play.seek}
          open={dockOpen}
          onOpenChange={setDockOpen}
          renderPreview={renderStopPreview}
          /* the walk editor's pointer, on the bus (OB-189): a halo on that stop, a pan if it is
             off the row, never a seek and never a card — the dock owns those rules */
          hoveredStep={bus.hoverStep}
          style={{ zIndex: 11 }}
        />
      )}
      {pinHover && play.steps[pinHover.i] && (
        /* WHICH STOP A MERGED PIN'S CARD NAMES is `walkLeadStop`'s (OB-186): the ARRIVAL cursor
           clamped into the run — never `mark.from`, which previews the stop the walk finished
           with long ago and looks correct; never the fractional position, which rounds to a
           stop not yet reached. */
        (() => {
          const lead = pinHover.mark ? walkLeadStop(pinHover.mark, walkArrival(play.position, play.steps.length)) : pinHover.i
          return <WalkPreview x={pinHover.x} top={pinHover.top}>{renderStopPreview(play.steps[lead], lead, pinHover.mark)}</WalkPreview>
        })()
      )}
    </PaneCanvas>
  )

  // THE WALL IS A STILL PICTURE (OB-139 rule 4): no rail, no header row, no preview layer —
  // it renders the canvas alone, exactly as it did before the rail landed. The one thing the
  // wall must add is the FLEX PARENT this canvas is built for: `PaneCanvas` sizes itself with
  // `flex: 1`, and `ProjectedMap` mounts the map in a plain `absolute; inset: 0` block, where
  // flex-grow never applies — `height` stays `auto`, the svg's `height: 100%` resolves against
  // it and loses to its own 1440:960 viewBox ratio (measured 686×457 in the roll's 686×365
  // slot), and the wall fit then fits the walk into 92px of box the card cannot show. Every
  // other mount of this canvas (the pane body, the map row below) is a flex column already.
  if (onWall) {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{canvas}</div>
  }

  // THE RAIL AND THE MAP ARE ONE PANE now (OB-226/238): the rail beside the canvas, the map's
  // own upper row above the canvas, and ONE `NodePreviewLayer` over both because a hover's
  // card belongs to the pane, not to the rail. `paneBox` measures the box the rail's width is
  // a fraction of; `closedControl="host"` puts the way back in the row rather than floating it.
  return (
    <NodePreviewLayer>
      {({ show, hide }) => (
        <div ref={paneBox} style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', position: 'relative', background: 'var(--surface-paper)' }}>
          {/* `data-explorer-rail` is a test hook (attributes only), the same precedent the map's
              own `data-nested`/`data-sel` set: a driver that had to find this column by a title
              or a class would break on the next copy change. */}
          <div data-explorer-rail="1" style={{ display: 'flex', minHeight: 0, flex: '0 0 auto' }}>
          <ExplorerRail
            root={CORPUS_TREE} selectedId={bus.focus} deselectable
            /* ONE SELECTION (OB-227 clause 1): the rail's clicks move the same focus the map's
               cells move, and clearing passes NULL so the pill and the map's ring both go out
               while the document keeps reading the node. */
            onSelect={(n) => { if (n) { if (byId.has(n.id)) bus.setFocus(n.id, 'tree') } else busClearFocus() }}
            open={userOpen} onOpenUpdate={setUserOpen} paneW={paneW}
            width={railW} onWidthChange={setRailW}
            railOpen={railOpen} onRailOpenChange={setRailOpen} closedControl="host"
            /* TREE HOVER WINS (the pointer is in one place), and the map's own cursor washes
               the row for the same node below (OB-248). The tree's hover goes back the other
               way on the BUS — the spotlight another pane's hover already lights a cell with —
               and is cleared only by the id that set it. */
            hoveredId={treeHover ?? hover ?? null}
            onNodeEnter={(e, n) => {
              setTreeHover(n.id)
              treeHotRef.current = n.id
              busSetHover(n.id)
              /* THE CARD ANSWERS FOR THE NODE, NOT FOR THE FILTERED COPY (reviewer-measured on
                 #372): `filterTree` prunes a container's children to the matches, or to none, so
                 `n.children` under a filter is not what the node holds — the count line
                 vanished on a container filtered down to itself. Find the real node in the
                 corpus tree by id and summarise THAT; `n` stays the source for what is on the
                 row (its title and topic are the same node's). */
              const path = findTreePath(CORPUS_TREE, n.id)
              const full = path ? path[path.length - 1] : n
              show(e, { domain: n.domain, title: n.title, summary: summaryOfNode(n.id), contains: full.children && full.children.length ? containsSummary(full) : undefined }, 'tree', n.id)
            }}
            onNodeLeave={() => {
              const id = treeHotRef.current
              treeHotRef.current = null
              setTreeHover(null)
              if (id) busEndHover(id)
              hide()
            }}
          />
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 200, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* THE MAP'S OWN UPPER ROW — where the selection SITS, as a path you can walk back
                up, with the closed rail's way back as the row's first item rather than floating
                over it. `FIRST_ROW_PAD` less 1 at the top: a crumb's own box sits 1px above its
                text, so the row reads level with the Explorer's head beside it. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: (FIRST_ROW_PAD - 1) + 'px var(--space-3) 5px', borderBottom: '1px solid var(--border-hair)', minWidth: 0 }}>
              <span data-explorer-corner="1" style={{ display: 'contents' }}>
                <ExplorerRailCorner paneW={paneW} open={railOpen} onOpenChange={setRailOpen} style={{ flex: '0 0 auto' }} />
              </span>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <Breadcrumb dense path={crumbPath} domain={domainOf(aimId)} onSelect={(n) => { if (n && byId.has(n.id)) bus.setFocus(n.id, 'tree') }} />
              </div>
            </div>
            {canvas}
          </div>
        </div>
      )}
    </NodePreviewLayer>
  )
}
