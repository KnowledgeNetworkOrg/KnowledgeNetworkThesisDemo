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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { WalkMark } from '@/ds'
import { ARROW_METRICS, headForSet, walkArrival, walkLook, LevelPicker, MapFloatingButton, MapTooltip, NodeArrow, PaneCanvas, PIN_RING_WIDTH, previewAnchor, shaftTailOffset, StepDot, VisibilityMark, WALK_ARROW_DEFAULTS, WALK_DOCK_METRICS, walkBand, WalkDock, WalkPreview, ZoomControl } from '@/ds'
import { byId, domainIds, EDGE_COLOR, EDGE_LABEL, MIXED_EDGE_COLOR, pathTo, ROOT_ID } from '../corpus/graph'
import { DT } from './walkdesk/authordnd'
import { routeIsWalk, useWalkPlayback } from './walkdesk/playback'
import { renderStopPreview } from './walkdesk/stoppreview'
import { FLAT_H, FLAT_W, leafPos, provinceIds } from '../model/flat'
import type { XY } from '../model/derive'
import { colorOf, inkStrongOf, labelInkOf, territoryFillOf } from '../model/color'
import { countryPath, countryRings, maxTier, provincePath, provinceRings, territories } from '../model/nested'
import { countryLabels, endpointAtTier, flightTargetOf, outlineOf, provinceLabels, ringsCrossT, roadsFor } from '../model/atlas'
import { bowFor, bowSignAt, walkArrowBetween } from '../model/walkarrow'
import { hoverMarks } from '../model/maphover'
import { routeNumbers } from '../model/route'
import { wallArrowShown, wallPinState } from '../model/walkwall'
import type { WallView } from '../model/walkwall'
import { PIN_NO_POSITION, pinPosition, walkPins } from '../model/walkpins'
import { toggleWalkHidden, walkDrawn, walkKeyOf } from '../model/walkvisibility'
import type { Bundle } from '../model/atlas'
import { fitLabel, fitRegionLabel, labelBox } from '../model/labelfit'
import type { FitLine, LabelBox } from '../model/labelfit'
import { descendantCount, parentOf } from '../model/nav'
import type { Bus } from '../studio/bus'

const VB_X = -40
const VB_Y = -40
const VB_W = FLAT_W + 80
const VB_H = FLAT_H + 80
const U_CX = VB_X + VB_W / 2
const U_CY = VB_Y + VB_H / 2

/** the water behind every territory — exported so the shell can pass it as the
 *  Pane's own `face` (OB-066), rather than leaving it to the frame's default
 *  `--surface-paper` to show around the canvas's corners and its shorter-than-
 *  the-pane bottom edge. One value, read here and by the shell; a second typed
 *  copy is the staleness this item exists to close. */
export const MAP_WATER = '#eef4f8'

// Levels run L0..maxTier — the deepest stratum in the DATA decides how far
// the scale goes. Each level is a canonical scale; there is nothing between.
const L_MAX = maxTier
const BASE_S = [0.8, 1.6, 3.0, 5.5, 9.5, 14]
const LEVEL_S = Array.from({ length: L_MAX + 1 }, (_, i) => BASE_S[i] ?? BASE_S[BASE_S.length - 1] * Math.pow(1.5, i - (BASE_S.length - 1)))

/** THE WALL (#267, DS OB-139): the map held up to the room opens at the province level — one
 *  grain in from the atlas, where a walk's stops spread onto their own cells — with the camera
 *  about the atlas's centre, the same arithmetic `flyToLevel` uses from the home view. */
const WALL_LEVEL = 1
const WALL_VIEW: View = { s: LEVEL_S[WALL_LEVEL], tx: U_CX - (U_CX / LEVEL_S[0]) * LEVEL_S[WALL_LEVEL], ty: U_CY - (U_CY / LEVEL_S[0]) * LEVEL_S[WALL_LEVEL] }

/** How far the camera may drift, in WORLD units, before a pan has to re-render.
 *
 *  A pan changes nothing about the scene except one `transform` on the root <g>,
 *  so the transform is written straight to the DOM on every move and React is
 *  left out of it (#238 fix 3). The one thing that DOES depend on where the
 *  camera sits is `onScreen` culling — pan far enough and a cell that was off
 *  the edge has to mount — and culling only happens in a render. So the pan
 *  commits `view` to state whenever it has drifted this far since the last
 *  commit, and the DOM carries it the rest of the time.
 *
 *  The number is half the TIGHTEST cull margin any caller passes (60), so a
 *  cell can never be needed on screen before the render that mounts it: it has
 *  a full margin of warning and we act at half of it. Raising it past 60 would
 *  make things pop in at the edge; lowering it toward 0 just re-renders more. */
const PAN_COMMIT = 30
/** the LevelPicker's labels, "L0".."L{maxTier}" — OB-096 */
const LEVEL_LABELS = Array.from({ length: L_MAX + 1 }, (_, i) => `L${i}`)
const FLY_MS = 260

/** the viewport in WORLD coords for a camera and a measured client box — what culls the deep
 *  tiers, and what the walk's look asks its off-screen question of (OB-179). A function, not an
 *  inline object, so an effect can ask it off refs without re-deriving it. */
function worldRectOf(v: View, clientBox: { w: number; h: number } | null): { x: number; y: number; w: number; h: number } {
  const f = clientBox ? Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 1
  return {
    x: (VB_X - (clientBox ? (clientBox.w * f - VB_W) / 2 : 0) - v.tx) / v.s,
    y: (VB_Y - (clientBox ? (clientBox.h * f - VB_H) / 2 : 0) - v.ty) / v.s,
    w: (clientBox ? clientBox.w * f : VB_W) / v.s,
    h: (clientBox ? clientBox.h * f : VB_H) / v.s,
  }
}
// a LOOK's flight (a Connections click) can cross the whole map AND change
// level in one move — at the wheel-step 260ms it read as a cut, not a flight.
// Slow enough for the eye to keep the territory; wheel steps stay snappy.
const LOOK_FLY_MS = 750
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

// ── THE CONTEXT WINDOW ───────────────────────────────────────────────────────
// One formal rule for ALL receded line-work and ghost text, keyed on
// d = level − tier (how many grains above the active stratum an ancestor is).
// Relevance is LOCAL: the immediate parent (d = 1) is the only ancestor that
// renders — full border emphasis plus one big faint watermark ghost. Every
// grain above it disappears ENTIRELY (a sharp window, not a decay): global
// orientation is already carried by the tree COLORS of every fill, so
// far-ancestor line-work and text were redundant noise. d < 1 (the active
// level and the pre-mounted next tier) is the fill layers' job, not the
// line-work's. Borders and labels both read from here, so the window cannot
// drift apart per layer.
// The window has exactly ONE local exception, and it is a reading exception,
// not a structural one: the single ghost the CURSOR is standing inside fades
// almost away (see ancLabelOAt, item 10). The rule below still decides which
// grains exist; that one only decides whether the ghost you are reading through
// gets out of your way.
const PARENT_BORDER_W = 2.6
const PARENT_LABEL_PX = 26
const ancBorderO = (d: number) => (d === 1 ? 0.6 : 0)
const ancLabelO = (d: number) => (d === 1 ? 0.32 : 0)
/** THE PARENT LAYER'S NAME GETS A CASE OF ITS OWN, and it is that — not the
 *  opacity alone — that makes the ghost legible (owner, 2026-08-28: the parent
 *  headings are too faint, make them more visible).
 *
 *  The ghost is set in the region's OWN hue over that region's own fill, so it is
 *  tint on tint: at 0.15 it read as a stain rather than a word, and simply
 *  turning it up muddies into the fill instead of separating from it — more ink,
 *  still no edge. A white case gives the glyphs a boundary, and with one the same
 *  word carries at far less ink than it would need bare. So the opacity moves
 *  0.15 → 0.32 AND the case arrives; either half alone is the wrong fix.
 *
 *  DELIBERATELY THINNER AND SOFTER THAN THE ACTIVE GRAIN'S CASE (2.4 at 0.85):
 *  the ghost is context, not the stratum being read, and must not come forward
 *  far enough to compete with the names on the level you are actually on. The
 *  element's own `opacity` still multiplies fill and case together, so the hover
 *  fade to 0.03 keeps working untouched — the ghost you are standing inside
 *  still steps aside. */
const GHOST_CASE = { stroke: '#ffffff', strokeWidth: 3.2, strokeOpacity: 0.75 }

interface View {
  tx: number
  ty: number
  s: number
}

/** `wall` (#267, DS OB-139 rule 4): the map as the room sees it when the professor holds it up.
 *  A still picture — every stop of the lecture a pin, the covered stops and the lit stop joined
 *  by the walk line, that stop lit, NO recency band, no dock, no floating chrome, no pin hover.
 *  Everything else the map does (territories, labels, the camera) is unchanged. */
export default function MapView({ bus, wall }: { bus: Bus; wall?: WallView }) {
  const onFocus = (id: string) => bus.setFocus(id, 'map')

  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(() => (wall ? WALL_VIEW : { tx: 0, ty: 0, s: LEVEL_S[0] }))
  const [level, setLevel] = useState(wall ? WALL_LEVEL : 0)
  const [clientBox, setClientBox] = useState<{ w: number; h: number } | null>(null)
  /** selected region — its topics' typed edges stay drawn until click-off */
  const [sel, setSel] = useState<string | null>(null)

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
  const [pinHover, setPinHover] = useState<{ i: number; x: number; top: number; mark?: WalkMark } | null>(null)
  // THE LOOK FLIGHT'S INSET (DS OB-130: "the host insets its auto-fit by
  // WALK_DOCK_METRICS.closed"). This map has no auto-fit — its camera is level-
  // driven, and the only move that centres a point is the LOOK flight below — so
  // the inset lands there: while the dock is mounted the looked-at node is centred
  // in the map ABOVE the closed dock rather than in the whole pane, which is
  // `closed / 2` px higher, in the SVG's units (`f` = units per px, the same
  // formula `toUser` and the render-time `f` carry).
  const lookInset = dockShown && clientBox ? (WALK_DOCK_METRICS.closed / 2) * Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 0

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
  // refs mirror state for the raw wheel listener (deps []) — hoverRef feeds the
  // level-change clear below, which must read the CURRENT local hover without
  // re-running on every hover move
  const viewRef = useRef(view)
  const levelRef = useRef(level)
  const hoverRef = useRef(hover)
  useEffect(() => {
    levelRef.current = level
    hoverRef.current = hover
  })

  // ── THE CAMERA IS NOT REACT'S (#238 fix 3) ─────────────────────────────────
  // The root <g> carries no `transform` prop; this is its only writer. Two
  // things follow, and both are the point:
  //
  //   `viewRef.current` is the LIVE camera and always current, because the pan
  //   writes it on every move. Everything that needs to know where the camera
  //   actually is right now — flyTween, flyToLevel — already read it, and now
  //   get a straight answer mid-drag instead of the last committed one.
  //
  //   `view` state is a COMMITTED SNAPSHOT, and is deliberately allowed to lag
  //   during a pan. It exists to drive the things a render has to recompute:
  //   `worldRect`/`onScreen` culling and `px()`. See PAN_COMMIT for how far it
  //   is allowed to lag and why that is safe.
  //
  // Painting from a layout effect rather than from JSX means a render caused by
  // something else entirely (a hover, a selection) cannot snap the camera back
  // to the last committed position — React never holds an opinion about the
  // transform at all, so it has nothing to snap back TO.
  const sceneRef = useRef<SVGGElement | null>(null)
  const paintCamera = (v: View) => sceneRef.current?.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.s})`)
  useLayoutEffect(() => {
    viewRef.current = view
    paintCamera(view)
  }, [view])

  // a level change swaps which paths are hit targets mid-hover, so no
  // pointerleave ever fires on the old one — clear it explicitly, on the bus
  // too, or a spotlight stays lit on a cell the cursor already left. But end
  // only OUR OWN published id (endHover is guarded on it): a look flight also
  // changes level, and blanking the whole channel would kill the foreign hover
  // standing on the very row that asked for the flight.
  useEffect(() => {
    const h = hoverRef.current
    if (h) busEndHover(h)
    setHover(null)
  }, [level, busEndHover])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect()
      // a BENCHED pane (display:none) measures 0×0 — that box carries no
      // layout information and would drive the zoom factor to Infinity, so
      // keep the last real one until the pane is shown again
      if (r.width > 0 && r.height > 0) setClientBox({ w: r.width, h: r.height })
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])

  // ── camera: level is the single source of truth, the tween just follows ───
  const anim = useRef<number | null>(null)
  const cancelFlight = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current)
    anim.current = null
  }
  useEffect(() => cancelFlight, [])

  const flyTween = (target: View, ms = FLY_MS) => {
    cancelFlight()
    const from = viewRef.current
    const c0 = { x: (U_CX - from.tx) / from.s, y: (U_CY - from.ty) / from.s }
    const c1 = { x: (U_CX - target.tx) / target.s, y: (U_CY - target.ty) / target.s }
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      const sNow = from.s * Math.pow(target.s / from.s, e)
      const cx = c0.x + (c1.x - c0.x) * e
      const cy = c0.y + (c1.y - c0.y) * e
      setView({ s: sNow, tx: U_CX - cx * sNow, ty: U_CY - cy * sNow })
      anim.current = t < 1 ? requestAnimationFrame(tick) : null
    }
    anim.current = requestAnimationFrame(tick)
  }

  /** step to a level: set the stratum, fly to its canonical scale, keeping
   * `about` (user coords) fixed under the cursor. Always a USER gesture (wheel
   * step, double-click, level button). */
  const flyToLevel = (l: number, about?: XY) => {
    if (play.playing) pannedRef.current = true // a user's own gesture — the walk's look stands aside once (OB-179)
    setLevel(l)
    levelRef.current = l
    const s = LEVEL_S[l]
    const v = viewRef.current
    const a = about ?? { x: U_CX, y: U_CY }
    flyTween({ s, tx: a.x - ((a.x - v.tx) / v.s) * s, ty: a.y - ((a.y - v.ty) / v.s) * s })
  }

  // ── LOOK (SelfNotes audit): a CLICK in the Connections pane flies the camera
  // — a hover never does, it only highlights. The pane stamps bus.peek with a
  // fresh seq per click, so re-looking at the same node after panning away is a
  // fresh command. The map answers by flying to the node's territory at its
  // tier's canonical scale and KEEPING it lit (the spotlight below). No
  // fly-home: a look is navigation, not a glance — the camera is simply the
  // user's again the moment they grab it (drag, wheel, level buttons).
  const peek = bus.peek
  useEffect(() => {
    if (!peek) return
    const t = flightTargetOf(peek.id)
    if (!t) return
    setLevel(t.tier)
    levelRef.current = t.tier
    const s = LEVEL_S[t.tier]
    flyTween({ s, tx: U_CX - t.c.x * s, ty: U_CY - lookInset - t.c.y * s }, LOOK_FLY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek])

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
  useEffect(() => setSel(bus.focus), [bus.focus])

  const toUser = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const f = Math.max(VB_W / rect.width, VB_H / rect.height)
    return {
      x: VB_X + (clientX - rect.left - (rect.width - VB_W / f) / 2) * f,
      y: VB_Y + (clientY - rect.top - (rect.height - VB_H / f) / 2) * f,
    }
  }

  // wheel: whole-level steps, nothing else — no free zoom, no in-betweens
  const wheelAccum = useRef(0)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      if (anim.current != null) return // mid-flight: swallow, don't queue
      wheelAccum.current += ev.deltaY
      if (wheelAccum.current <= -50) {
        wheelAccum.current = 0
        if (levelRef.current < L_MAX) flyToLevel(levelRef.current + 1, toUser(ev.clientX, ev.clientY))
      } else if (wheelAccum.current >= 50) {
        wheelAccum.current = 0
        if (levelRef.current > 0) flyToLevel(levelRef.current - 1, toUser(ev.clientX, ev.clientY))
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // ── #24 — DRAG THE SELECTED CELL ONTO THE ROAD ────────────────────────────
  // A CUSTOM POINTER DRAG, not native HTML5 DnD, for two reasons the ticket's
  // "just add draggable" plan couldn't survive: Chromium ignores the draggable
  // attribute on SVG shapes, and a native drag image is a frozen snapshot — it
  // can't MORPH. So we drive the whole gesture by hand: a portal ghost follows
  // the cursor, showing the cell's own outline while over the map and crossfading
  // into a node pill once it leaves the map (the "shape becomes a node" ask). On
  // as it moves we feed the road a stream of synthetic HTML5 `dragover`/`dragleave`
  // events at the cursor, and a `drop` on release — so the road's OWN handlers do
  // both the live preview caret AND the precise insertion (gaps, stages, branches)
  // verbatim, no reimplementation and no road refactor. A container id rides the
  // same path and lands as a plain visit (everything is a node). Only the SELECTED
  // cell arms this (see the pointerdown gate), so pan is untouched everywhere else.
  type Box = { x: number; y: number; width: number; height: number }
  const nodeDown = useRef<{ id: string; x: number; y: number; bbox: Box } | null>(null)
  const ndActive = useRef(false)
  // the element the last synthetic dragover went to — so we can dragleave it the
  // moment the cursor moves to a new target (or off the road), which is what
  // clears its caret. Mirrors the enter/leave a native drag would produce.
  const lastOver = useRef<Element | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; outside: boolean; bbox: Box } | null>(null)

  /** a DnD event carrying the palette payload. Dispatched by hand, these fire the
   * road's real onDragOver / onDragLeave / onDrop exactly as a browser drag would
   * — no browser DnD state machine to satisfy, so a `drop` needs no prior
   * handshake, and dragover/leave drive the road's existing caret. */
  const dndEvent = (type: 'dragover' | 'dragleave' | 'drop', x: number, y: number, id: string) => {
    const dt = new DataTransfer()
    dt.setData(DT, 'pal:' + id)
    return new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt })
  }
  /** point the road's preview caret at the cursor: leave the old target, hover
   * the new one. Called on every move while a node drag is in flight. */
  const dragOverAt = (x: number, y: number, id: string) => {
    const el = document.elementFromPoint(x, y)
    if (el !== lastOver.current) {
      if (lastOver.current) lastOver.current.dispatchEvent(dndEvent('dragleave', x, y, id))
      lastOver.current = el
    }
    if (el) el.dispatchEvent(dndEvent('dragover', x, y, id))
  }

  // ── the selection overlay, whole: which topics the selection resolves to,
  // which of their edges survive the roll-up to this grain, and how those
  // collapse into one road per pair. All of it is model/atlas.ts's job now.
  const { tier: selTier, bundles } = useMemo(() => roadsFor(selDrawn), [selDrawn])
  // a changed (or cleared) selection unmounts the old roads outright — no
  // pointerleave ever fires on them — so a stale hoverEdge would otherwise
  // survive pointing at a bundle object from the previous selection
  useEffect(() => setHoverEdge(null), [sel])

  // viewport in world coords, for culling the deep tiers (and the look's question, below)
  const f = clientBox ? Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 1
  const worldRect = worldRectOf(view, clientBox)
  const onScreen = (p: XY, margin: number) =>
    p.x > worldRect.x - margin && p.x < worldRect.x + worldRect.w + margin && p.y > worldRect.y - margin && p.y < worldRect.y + worldRect.h + margin

  /** SCREEN pixels → world units at the current zoom AND pane size, so every
   * level renders the same authored style at its canonical scale */
  const px = (v: number) => (v * f) / view.s

  /** the parent layer's case, applied ONLY where a name is acting as a ghost.
   *  A domain name at L0 and a module name at L1 are the ACTIVE grain, not
   *  context — they are the level you are reading — and they keep exactly the
   *  treatment they shipped with. The same element draws both roles, so the
   *  distinction has to be made per render rather than per component. */
  const ghostCase = (on: boolean) =>
    on
      ? { stroke: GHOST_CASE.stroke, strokeWidth: px(GHOST_CASE.strokeWidth), strokeOpacity: GHOST_CASE.strokeOpacity, paintOrder: 'stroke' }
      : {}

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

  // wrapped labels, fitted at the level's CANONICAL scale — not the mid-flight
  // zoom — so a name's line breaks are decided once per level, not per frame
  const labelFit = useMemo(() => {
    const active = new Map<string, FitLine[]>()
    const ghost = new Map<string, FitLine[]>()
    // OB-108: every fitted label's own extent, so a walk pin can be kept off the
    // name it would otherwise delete. Built HERE rather than beside the pins
    // because this is the only place that knows each label's font size — the
    // three cases below each choose their own — and a box without its size is a
    // second guess at the same number.
    const box = new Map<string, LabelBox>()
    const noteBox = (id: string, lines: FitLine[] | null, fs: number) => {
      const bx = lines ? labelBox(lines, fs) : null
      if (bx) box.set(id, bx)
    }
    // REGION names (SelfNotes: "labels overlap / region text not wrapped"):
    // the L0/L1 names go through the same wrap-into-the-cell mechanic as the
    // deep tiers now, against the honest region chord — with fitRegionLabel's
    // shrink instead of a drop, because they are the only names their level
    // has. Computed one level past their visibility window so the 350ms
    // opacity fades keep an element to fade.
    const region = new Map<string, { lines: FitLine[]; fs: number }>()
    const world = (v: number) => (v * f) / LEVEL_S[level]
    if (level <= 2)
      for (const c of countryLabels) {
        const size = level === 0 ? 24 : PARENT_LABEL_PX
        const fit = fitRegionLabel(c.label, countryRings[c.key], c.x, c.y, world(size))
        region.set(c.key, { lines: fit.lines, fs: size * fit.shrink })
        noteBox(c.key, fit.lines, world(size * fit.shrink))
      }
    if (level <= 3)
      for (const m of provinceLabels) {
        const size = level <= 1 ? 15 : PARENT_LABEL_PX
        const fit = fitRegionLabel(m.label, provinceRings[m.key], m.x, m.y, world(size))
        region.set(m.key, { lines: fit.lines, fs: size * fit.shrink })
        noteBox(m.key, fit.lines, world(size * fit.shrink))
      }
    if (level < 2) return { active, ghost, region, box }
    for (const t of territories) {
      if (t.tier === level || (t.leaf && t.tier < level)) {
        const fs = world(t.tier === level ? 12.5 : 11.5)
        const fit = fitLabel(byId.get(t.id)!.title, t, fs, false)
        if (fit) active.set(t.id, fit)
        noteBox(t.id, fit, fs)
      } else if (level >= 3 && !t.leaf && t.tier === level - 1) {
        const fs = world(PARENT_LABEL_PX)
        const fit = fitLabel(byId.get(t.id)!.title, t, fs, true)!
        ghost.set(t.id, fit)
        // THE PARENT WATERMARK COUNTS AS A LABEL TOO (OB-108). It is the name of
        // the very cell a pin at this level belongs to, so a pin over it is the
        // same fault as one over an active name, only quieter. It is a WEAK case
        // on purpose: the ghost is set at the parent grain and can span most of
        // the region, so there is often nowhere inside the cell that clears it —
        // and `pinSpotClear` then leaves the pin where it was rather than
        // shoving it somewhere worse. Registering it costs one box and improves
        // the cases where a clear spot does exist.
        noteBox(t.id, fit, fs)
      }
    }
    return { active, ghost, region, box }
  }, [level, f])

  /** every name actually drawn at this level, as boxes — what a walk pin has to
   *  stay off (OB-108). Its own memo so `routeStops` re-runs when the labels
   *  move, not when anything else in `labelFit` does. */
  const labelBoxes = useMemo(() => [...labelFit.box.values()], [labelFit])

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
  // #228 (DS OB-114): the number a pin PRINTS is the top-level step, read off the
  // route's groups — a group's nodes all print the group's number. The stop index
  // (what the band and the clock count in) stays what it was.
  const stepNumbers = useMemo(() => routeNumbers(bus.routeSteps).map((n) => n.step), [bus.routeSteps])
  const routeStops = useMemo(
    () => walkPins({ route: bus.route, level, px, labelBoxes, stepNumbers }),
    // px closes over f/view.s, both already deps; a fresh px reference every
    // render would otherwise recompute this memo every render regardless
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bus.route, stepNumbers, level, f, view.s, labelBoxes],
  )
  // ── OB-132: WHERE THE WALK IS, IN PINS. The DS's band (`walkBand`) fades every
  // mark by its distance from the played position — full on the stop, five
  // stops of trail behind, two of lead ahead, nothing beyond — and pops the mark
  // the position is arriving at. It is read here in PIN units (`pinPosition`),
  // because a pin at a coarse level stands for a run of stops. A route that is
  // not the walk being played (a `bus.teach` curriculum) has no position and no
  // band: `null`, and every pin and arrow draws at rest.
  const pinPos = dockShown ? pinPosition(routeStops, play.position) : null

  // ── OB-179: PLAYBACK MOVES THE CAMERA ONLY WHEN THE STOP IS OFF-SCREEN ─────
  // The owner's call (2026-09-14), answering the gap OB-173's receipt reported: nothing
  // brought an off-screen stop into view, because the camera moves on the LOOK channel
  // and playback never published one. Four options were put; CHOSEN: fly only when the
  // stop is off-screen. Motion on every advance becomes scenery; motion that is rare
  // reads as "we have gone somewhere new", and that rarity IS the information (the same
  // reasoning as ProjectedMap rule 1). A smooth camera that keeps the stop centred is
  // NOT this and would be worse than nothing.
  //
  // THE GATE IS THE DS'S `walkLook`, never a comparison retyped here: it answers off the
  // stop's world point and the view's world rect, with `WALK_LOOK_DEFAULTS.edgeInset`
  // (0.12 of the smaller side, a FRACTION so it survives zoom). The three caller rules,
  // enforced here because the function cannot: ASK ON ADVANCE ONLY — an arrival the walk
  // TRAVELLED to while playing; pressing play asks nothing for the stop it is standing
  // on, a seek sets a position with no travel, a pause stands still; A USER'S OWN PAN
  // WINS — a pan or a level step DURING PLAYBACK raises `pannedRef`, and the next
  // arrival lowers it without looking (the pan is the more recent statement of where
  // the room wants to look; the arrival after that may look again — a pan while paused
  // is plain navigation and raises nothing); and THIS IS THE LOOK, NEVER THE FOCUS —
  // `playback.ts` writes the focus, this only moves the camera, at the CURRENT scale,
  // so the document, the connections pane and the crumb show the same node after the
  // move as before. The dock covers the pane's bottom at its LIVE height, so the rect
  // the question is asked of stops above it.
  const arrival = dockShown && !wall && play.playing ? walkArrival(play.position, play.steps.length) : null
  const pannedRef = useRef(false)
  const lastArrivalRef = useRef<number | null>(null)
  const lookRef = useRef({ routeStops, clientBox, dockOpen })
  useEffect(() => { lookRef.current = { routeStops, clientBox, dockOpen } })
  useEffect(() => {
    const prev = lastArrivalRef.current
    lastArrivalRef.current = arrival
    if (arrival === null || prev === null) return // paused, or play just pressed: standing, not advancing
    if (pannedRef.current) { pannedRef.current = false; return }
    const { routeStops: pins, clientBox: cb, dockOpen: open } = lookRef.current
    const pin = pins.find((p) => p.step - 1 <= arrival && arrival <= p.stepEnd - 1)
    if (!pin) return
    const v = viewRef.current
    const rect = worldRectOf(v, cb)
    const ff = cb ? Math.max(VB_W / cb.w, VB_H / cb.h) : 1
    const dockWorld = ((open ? WALK_DOCK_METRICS.open : WALK_DOCK_METRICS.closed) * ff) / v.s
    const look = walkLook({ point: pin.c, view: { x: rect.x, y: rect.y, width: rect.w, height: Math.max(1, rect.h - dockWorld) } })
    if (!look.move || !look.to) return
    flyTween({ s: v.s, tx: U_CX - look.to.x * v.s, ty: U_CY - look.to.y * v.s }, LOOK_FLY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival])


  // ── OB-126: ONE HEAD FOR THE WHOLE WALK, NOT ONE PER ARROW ──────────────
  // `headFor`'s length cap is written for a LONE line — it stops one long shaft
  // growing a spearhead. Applied per-arrow across a SET it makes head size a
  // function of length, which the line already draws, and a reader takes a bigger
  // head as EMPHASIS: hops under ~267px would take the published 8px head and hops
  // over ~427px the full 12.8px, 2.5× the triangle's area, on arrows that mean the
  // same thing. So every hop is measured first and the set is asked ONCE for the
  // smallest head all of them can carry.
  //
  // ONE PASS, AND IT IS EXACT WHEREVER IT MATTERS. A length is the pin-to-pin
  // distance minus the head, so the two depend on each other — but the cap only
  // lifts the head above 8 once the SHORTEST hop passes ~267px, and `headForSet`
  // takes the minimum. Any walk with one short hop in it resolves to exactly 8,
  // which is what this map already drew, with no circularity at all. The provisional
  // lengths below therefore use the published head, and differ from the final ones
  // only in the all-long case, by at most the few px the head grew.
  const walkArrowHead = useMemo(() => {
    const lengths: number[] = []
    for (let i = 1; i < routeStops.length; i++) {
      const from = routeStops[i - 1]
      const to = routeStops[i]
      const worldDist = Math.hypot(to.c.x - from.c.x, to.c.y - from.c.y) || 1
      const dist = (worldDist * view.s) / f
      if (dist < 1) continue
      lengths.push(Math.max(1, dist - (from.size / 2 + WALK_ARROW_DEFAULTS.clearTail) - (to.size / 2 + WALK_ARROW_DEFAULTS.clearHead) - ARROW_METRICS.head))
    }
    return headForSet({ joins: PIN_RING_WIDTH, lengths })
  }, [routeStops, view.s, f])

  // ── OB-107: WHICH WALK LINES BOW, AND WHICH WAY ────────────────────────────
  // OB-090 point 1 pulled the arrows' shared ANCHOR apart — every line now
  // leaves and meets a pin at its own edge rather than at one shared centre.
  // What survived it is two lines that still run near-parallel for most of
  // their LENGTH and read as one doubled shaft right up to the head. `bow`
  // curves a shaft away from its own axis; this decides who gets one.
  //
  // THE DS LEAVES BOTH CALLS TO US (its `done when` says so, the same split as
  // OB-090 point 2): which lines count as "close", and how far to bow them.
  //
  // WHICH: a walk is a PATH, so a stop has exactly two lines at it — the one
  // arriving and the one leaving. They run close when the walk DOUBLES BACK:
  // both the previous stop and the next lie in nearly the same direction from
  // this one, so the two shafts share a corridor. Under BOW_CLOSE_DEG apart,
  // measured outward from the shared pin, is that case. (Two lines can also run
  // close WITHOUT sharing a pin; the DS's checkable is the shared-pin case and
  // that is what this covers. Named here so the next reader knows it was a
  // scope decision, not an oversight.)
  //
  // WHICH WAY: the DS proposed alternating the sign between the pair. That is
  // right for two lines both POINTING AT a pin, and wrong here, because a
  // path's two lines travel in OPPOSITE directions through it — so ONE sign,
  // taken by both, sends them to opposite sides of the corridor. Which sign
  // that is depends on whether the next stop lies clockwise or anticlockwise of
  // the previous one from this pin; `bowSignAt` reads it off the geometry, and
  // getting it backwards curves the two TOWARD each other. Measured on the
  // drawn curves in `walkarrow.test.ts`, both arrangements, rather than argued.
  const routeBowSign = useMemo(() => {
    const signs = new Array<number>(Math.max(0, routeStops.length - 1)).fill(0)
    for (let p = 1; p < routeStops.length - 1; p++) {
      const sign = bowSignAt(routeStops[p].c, routeStops[p - 1].c, routeStops[p + 1].c)
      if (sign === 0) continue
      signs[p - 1] = sign
      signs[p] = sign
    }
    return signs
  }, [routeStops])

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

  const selOutline = selDrawn ? outlineOf(selDrawn) : undefined
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
  const { arrows: hoverArrows } = useMemo(() => roadsFor(cardNode), [cardNode])
  const hoverRelIn = cardNode ? hoverArrows.filter((a) => a.tgt === cardNode).reduce((s, a) => s + a.n, 0) : 0
  const hoverRelOut = cardNode ? hoverArrows.filter((a) => a.src === cardNode).reduce((s, a) => s + a.n, 0) : 0

  // item 3: a hovered counterpart lights the ROAD to it, not just its territory.
  // The bus hover arrives as a topic id (a Connections relationship row) or a map
  // cell; lift it to the road's grain (selTier) and the bundle whose end it
  // matches is the connection to the selected node. The rest dim, the same way
  // the star dims its other spokes one pane over.
  const litRoad = hoverId && bundles.length ? endpointAtTier(hoverId, selTier) : null
  const anyRoadLit = litRoad != null && bundles.some((b) => b.src === litRoad || b.tgt === litRoad)

  // ── item 10: "labels blocking when zoomed in" ────────────────────────────
  // The watermark never blocked a CLICK — every label layer is pointerEvents:
  // none. What it blocked was READING: 26px of parent name lying across the
  // small active names underneath. The cure is one rule, the same shape as the
  // context window itself — the ghost you are STANDING INSIDE steps aside,
  // because that is exactly the cell whose contents you are trying to read.
  // Move the cursor away and it returns; orientation costs nothing the moment
  // you stop needing the detail. Since the territories tile their parent
  // exactly, the ghost under the cursor is just the parent of the hovered cell
  // — true at every level, so countries, provinces and deep ghosts share it.
  const ghostUnderCursor = hover ? parentOf(hover) : null
  const ancLabelOAt = (d: number, id: string) => (id === ghostUnderCursor ? 0.03 : ancLabelO(d))

  return (
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
            // ARM a node drag on the selected cell (see the block above). Don't
            // capture yet — a pure click must still reach onClick to deselect;
            // capture happens in pointermove once movement confirms a drag. Grab
            // the cell's geometry NOW, while we hold its path element, so the
            // ghost can draw the outline (getBBox is in the same user space as
            // outlineOf's `d`).
            drag.current = null
            nodeDown.current = { id: sel, x: ev.clientX, y: ev.clientY, bbox: (t as SVGGraphicsElement).getBBox() }
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
            const dist = Math.hypot(ev.clientX - nd.x, ev.clientY - nd.y)
            if (!ndActive.current && dist > 5) {
              // confirmed a drag: capture so moves over the ROAD still reach us
              ndActive.current = true
              ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
            }
            if (ndActive.current) {
              const r = svgRef.current!.getBoundingClientRect()
              const outside = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom
              setGhost({ id: nd.id, x: ev.clientX, y: ev.clientY, outside, bbox: nd.bbox })
              // drive the road's live preview caret at the cursor
              dragOverAt(ev.clientX, ev.clientY, nd.id)
            }
            return
          }
          if (!drag.current) return
          const rect = svgRef.current!.getBoundingClientRect()
          const ff = Math.max(VB_W / rect.width, VB_H / rect.height)
          const dx = (ev.clientX - drag.current.x) * ff
          const dy = (ev.clientY - drag.current.y) * ff
          drag.current = { x: ev.clientX, y: ev.clientY }
          dragDist.current += Math.hypot(dx, dy)
          // The move itself: straight to the DOM, no render. `view` here is the
          // last COMMITTED camera (the handler is rebuilt by the render that
          // commits it), so measuring drift against it needs no extra ref.
          const next = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy }
          viewRef.current = next
          paintCamera(next)
          if (Math.hypot(next.tx - view.tx, next.ty - view.ty) / next.s >= PAN_COMMIT) { if (play.playing) pannedRef.current = true; setView(next) }
        }}
        onPointerUp={(ev) => {
          if (nodeDown.current) {
            if (ndActive.current) {
              const { clientX: x, clientY: y } = ev
              const id = nodeDown.current.id
              // clear whatever caret we're leaving, THEN drop on the target under
              // the cursor (handleDrop reads the pointer position, not the caret,
              // so the insertion is right either way). Swallow the click this
              // press would fire so a completed drag never also deselects the cell.
              if (lastOver.current) lastOver.current.dispatchEvent(dndEvent('dragleave', x, y, id))
              lastOver.current = null
              const el = document.elementFromPoint(x, y)
              if (el) el.dispatchEvent(dndEvent('drop', x, y, id))
              dragDist.current = 999
              try {
                ;(ev.currentTarget as Element).releasePointerCapture(ev.pointerId)
              } catch {
                /* capture may not have been taken (a click, no drag) */
              }
            }
            nodeDown.current = null
            ndActive.current = false
            setGhost(null)
            setDragging(false)
            return
          }
          // settle: whatever drift never crossed PAN_COMMIT is committed now, so
          // the map is culled for exactly where it ended up. A no-op when the
          // last move already committed.
          if (drag.current) setView(viewRef.current)
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
          const u = toUser(ev.clientX, ev.clientY)
          if (levelRef.current < L_MAX) flyToLevel(levelRef.current + 1, u)
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

          {/* ── labels: the active grain in full ink, ONE ghost above it.
              No capital dots (2026-07-13) — the fill, border and name already
              say "a node lives here"; the wrapped name IS the place marker. */}
          {/* PAINT ORDER IS THE POINT (2026-07-14, item 10): every ghost paints
              BEFORE the active names, never after. The deep ghost layer used to
              come last and so laid its 26px parent name ON TOP of the very
              labels the reader was zooming in to read. Ghosts are background;
              they go in the background. */}
          <g pointerEvents="none">
            {countryLabels.map((c) => {
              const fit = labelFit.region.get(c.key)
              if (!fit) return null
              return (
                <text
                  key={c.key}
                  data-regionlabel={c.key}
                  textAnchor="middle"
                  fontSize={px(fit.fs)}
                  fontWeight={800}
                  fill={colorOf(c.key)}
                  opacity={level === 0 ? 0.55 : ancLabelOAt(level, c.key)}
                  {...ghostCase(level !== 0)}
                  style={{ userSelect: 'none', transition: 'opacity 350ms' }}
                >
                  {fit.lines.map((ln, i) => (
                    <tspan key={i} x={ln.x} y={ln.y}>
                      {ln.text}
                    </tspan>
                  ))}
                </text>
              )
            })}
            {provinceLabels.map((m) => {
              const fit = labelFit.region.get(m.key)
              if (!fit) return null
              return (
                <text
                  key={m.key}
                  data-regionlabel={m.key}
                  textAnchor="middle"
                  fontSize={px(fit.fs)}
                  fontWeight={level === 1 ? 700 : 800}
                  fill={level === 1 ? labelInkOf(m.key) : colorOf(m.key)}
                  opacity={level === 1 ? 0.9 : ancLabelOAt(level - 1, m.key)}
                  {...ghostCase(level !== 1)}
                  style={{ userSelect: 'none', transition: 'opacity 350ms' }}
                >
                  {fit.lines.map((ln, i) => (
                    <tspan key={i} x={ln.x} y={ln.y}>
                      {ln.text}
                    </tspan>
                  ))}
                </text>
              )
            })}
            {level >= 3 &&
              mounted
                // the window admits ONE territory-grain ghost: the parent
                .filter((t) => !t.leaf && t.tier === level - 1 && onScreen({ x: t.cx, y: t.cy }, 60) && labelFit.ghost.has(t.id))
                .map((t) => (
                  <text
                    key={`ghost-${t.id}`}
                    data-ghostlabel={t.id}
                    textAnchor="middle"
                    fontSize={px(PARENT_LABEL_PX)}
                    fontWeight={800}
                    fill={colorOf(t.id)}
                    opacity={ancLabelOAt(1, t.id)}
                    {...ghostCase(true)}
                    style={{ userSelect: 'none', transition: 'opacity 200ms' }}
                  >
                    {labelFit.ghost.get(t.id)!.map((ln, i) => (
                      <tspan key={i} x={ln.x} y={ln.y}>
                        {ln.text}
                      </tspan>
                    ))}
                  </text>
                ))}
            {/* the active grain, LAST and white-cased: a name on the stratum you
                are reading punches cleanly through whatever ghost lies under it,
                instead of muddying into it */}
            {level >= 2 &&
              mounted
                .filter((t) => isActive(t) && onScreen({ x: t.cx, y: t.cy }, 60) && labelFit.active.has(t.id))
                .map((t) => {
                  // The selected cell's name is CALMED, not shouted (the glow
                  // and heavy border already mark the cell): a crisp near-black
                  // emphasis ink instead of the muddy dark tint, weight 700, and
                  // a THIN soft white case rather than a fat opaque one — clean
                  // type over an outlined-sticker look. Full opacity keeps it the
                  // clearest label even as the glow tints the body beneath it.
                  const isSel = t.id === sel
                  return (
                    <text
                      key={t.id}
                      textAnchor="middle"
                      fontSize={px(t.tier === level ? 12.5 : 11.5)}
                      fontWeight={isSel ? 700 : 600}
                      fill={isSel ? inkStrongOf(t.id) : labelInkOf(t.id)}
                      stroke="#ffffff"
                      strokeWidth={px(isSel ? 2.2 : 2.4)}
                      strokeOpacity={isSel ? 0.7 : 0.85}
                      paintOrder="stroke"
                      opacity={isSel ? 1 : isMuted(t) ? 0.7 : 0.92}
                      style={{ userSelect: 'none' }}
                    >
                      {labelFit.active.get(t.id)!.map((ln, i) => (
                        <tspan key={i} x={ln.x} y={ln.y}>
                          {ln.text}
                        </tspan>
                      ))}
                    </text>
                  )
                })}
          </g>

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

          {/* ── ROUTE PATH (#26): the walk's resolved order drawn over the territory,
              on the shared vocabulary instead of a hand-drawn circle+number+line
              (OB-069) — StepDot for "step N of the walk", NodeArrow for the line
              between two steps, the same two marks a chain or the road itself
              draws with. Deep stops still roll up to their visible ancestor
              (routeVis); routeStops turns that into what actually gets a pin — a
              contiguous run collapses into one range pin, a later return to an
              already-pinned territory offsets clear of it rather than drawing a
              second number into the same mark.

              Both StepDot and NodeArrow are built assuming 1 unit is 1 real
              screen px — true for the road's authoring board, false here, where
              `view.s` is a live pan/zoom the rest of this map counter-scales
              away per-element via `px()`. Neither component takes a pre-scaled
              prop for that, so the correction moves to the wrapping transform
              instead: `scale(f / view.s)` cancels the ambient `scale(view.s)`
              this whole layer sits inside (see the outer <g> a few hundred
              lines up), leaving raw numbers inside behave exactly like real
              CSS px — which is what both components already assume.

              pointer-events none on the group so a pin or an arrow never
              intercepts a click meant for the cell fill below it. ──────── */}
          {walkVisible && routeStops.length > 0 && (
            <g data-routepath data-step-count={bus.route.length} pointerEvents="none">
              {/* OB-117, WIDENED BY OB-122 — the whole walk recedes now, arrows
                  AND pins. OB-117 scoped it to the shaft and the head, because
                  that is what its `done when` named and the DS's side-by-side mock
                  (guidelines/map-walk-relations-declutter-options.html) drew lines
                  with no step marks at all. That left the pins as the loudest thing
                  on the map once the arrows dimmed — the owner's call, answering
                  receipts/3107899.md question (a).

                  One wrapper per layer rather than one around both: they recede
                  together but they are not one drawing, and `data-routearrows` is
                  already the handle the OB-117 driver reads. Tone alone leaves the
                  mark at full strength, which is why the arrows carry opacity too. */}
              <g data-routearrows data-receded={walkReceded ? 1 : 0} opacity={walkReceded ? 0.6 : 1} style={{ transition: 'opacity 120ms' }}>
              {routeStops.slice(1).map((to, i) => {
                const from = routeStops[i]
                const dx = to.c.x - from.c.x
                const dy = to.c.y - from.c.y
                const worldDist = Math.hypot(dx, dy) || 1
                const dist = (worldDist * view.s) / f // world units -> real px
                if (dist < 1) return null
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI
                // OB-132 — THE ARROW IS A READING OF THE BAND, not a description of
                // two pins: its opacity, the walked/quiet split, where its head sits
                // and BOTH its clearances come from the DS's `walkArrow` recipe (through
                // `walkArrowBetween`, which reads it at this map's two pin sizes),
                // against the SCALED pins. The tail used to clip at the RESTING edge
                // (OB-090); a pin popped to 1.36× as the walk arrives would swallow
                // it at the one moment the eye is there. `length` handed to the
                // recipe is centre to centre less the head, so `hidden` means the two
                // clearances have eaten the whole shaft (two crowded stops, or two
                // popped pins) and there is nothing to draw.
                const wa = walkArrowBetween(i, pinPos, from.size / 2, to.size / 2, dist - walkArrowHead.head)
                if (wa.hidden) return null
                // THE WALL'S LINE joins the covered stops and the lit one, and nothing else
                if (wall && !wallArrowShown(from, to, wall)) return null
                // OB-090 — the TAIL is anchored at the source pin's own edge (toward
                // the target), not its centre: a centred tail is the SAME point for
                // every arrow leaving a pin, however many attach there. The band's
                // `tailClear` is that edge plus its gap, at the pin's drawn scale.
                const tailOffset = px(wa.tailClear)
                const tailX = from.c.x + (dx / worldDist) * tailOffset
                const tailY = from.c.y + (dy / worldDist) * tailOffset
                const length = Math.max(1, dist - wa.tailClear - wa.headClear - walkArrowHead.head)
                // OB-107 — magnitude is proportional to the shaft, capped: a bow
                // is meant to open a gap between two lines, and a fixed px offset
                // that reads as a gentle curve on a long line is a semicircle on a
                // short one. Sign comes from the policy above, and 0 draws the
                // straight <line> exactly as before.
                const bow = bowFor(routeBowSign[i], length)
                // THE DRAWING'S ORIGIN IS NOT THE SHAFT'S TAIL. NodeArrow puts the
                // shaft at `across / 2` down its own box, and `casing`'s pad and
                // `bow`'s sign move it again — so placing the <svg> at the pin
                // leaves the LINE beside the two pins it joins. Cancelling the
                // offset here is what makes bowing +b and -b symmetric about the
                // real pin-to-pin line, which the alternating sign depends on.
                const tail = shaftTailOffset({ joins: PIN_RING_WIDTH, bow, casing: true, headSize: walkArrowHead })
                return (
                  <g key={`ra-${to.key}`} data-routearrow={i} data-bow={bow.toFixed(2)} opacity={wall ? 1 : wa.opacity} transform={`translate(${tailX} ${tailY}) rotate(${angle}) scale(${f / view.s})`}>
                    <g transform={`translate(${-tail.along} ${-tail.across})`}>
                      {/* OB-116 — `casing` on EVERY walk arrow, long and short,
                          quiet and current: a halo behind shaft and head so the
                          line reads over a territory fill instead of competing
                          with it. Not a bigger head — that does not scale to a map
                          with many arrows, which is the map this is. */}
                      <NodeArrow
                        direction="right"
                        length={length}
                        joins={PIN_RING_WIDTH}
                        headSize={walkArrowHead}
                        bow={bow}
                        casing
                        tone={walkReceded ? 'hint' : 'quiet'}
                        /* AN ARROW THE WALK HAS NOT ENTERED PASSES NO `walked` AT ALL (DS
                           OB-159). `walkArrow` returns `walked: 0` for every arrow ahead of the
                           walk AND at rest, but 0 does not mean "unwalked" to `NodeArrow`: it
                           means the walk is standing at this arrow's TAIL, so the head is drawn
                           down at the tail in acorn. Passing it straight through put an acorn
                           head on the tail of every arrow the walk had not reached yet.
                           `headAcorn` is the recipe's OWN published test for "has the walk
                           entered this arrow" (`walked > 0`), so it is the gate rather than a
                           comparison retyped here. */
                        walked={wall ? 1 : wa.headAcorn ? wa.walked : undefined}
                        walkedTone={walkReceded ? 'hint' : 'walk'}
                        aheadOpacity={wall ? 1 : wa.opacity > 0 ? wa.aheadOpacity / wa.opacity : 1}
                      />
                    </g>
                  </g>
                )
              })}
              </g>
              {/* OB-122 — the pins recede on the SAME condition and the same
                  120ms as the arrows above.

                  OPACITY IS THE WHOLE OF IT HERE, and that is a limit of the
                  component, not a shortcut. The item asks for "the same
                  --bark-300-equivalent tone AND ~0.6 opacity as the arrows", but
                  `NodeArrow` takes a `tone` prop and `StepDot` takes none — its
                  props are `{ n, state, variant, size, optional, onClick, title }`
                  and its colour comes from `state`, which is what tells current
                  from done from ahead. Painting every pin bark-300 would collapse
                  those three into one, so the tone half needs a receded treatment
                  the DS owns, not a filter forced on it from out here. Asked in
                  the receipt; opacity ships now because it is the half that is
                  ours to give. */}
              <g data-routepins data-receded={walkReceded ? 1 : 0} opacity={walkReceded ? 0.6 : 1} style={{ transition: 'opacity 120ms' }}>
              {routeStops.map((s, k) => {
                /* OB-132 — EVERY PIN IS A READING OF THE BAND: its opacity is
                   `pinOpacity`, its scale `pinScale` (the pop, 1.36× as the walk
                   arrives), and its FACE is direction plus arrival — `state` says
                   which side of the position it is on and `arrival` how far it is
                   into looking current, so fill, ring and number cross continuously
                   with no jump at the stop boundary. Never a rounded 'current': at
                   the stop `arrival` is 1 and both directions reach the identical
                   look, so the flip is invisible (StepDot's own docblock). A pin
                   outside the band draws nothing at all — the owner's ruling. */
                const b = pinPos === null ? PIN_NO_POSITION : walkBand(k, pinPos)
                if (b.pinOpacity <= 0) return null
                return (
                /* #246: A PIN'S OWN HOVER AND CLICK. The pins' wrapper is pointer-transparent so
                   the cells under the walk keep their hover; each pin opts back in. Hover shows
                   the same preview card the dock and the strip show, anchored on the pin's box
                   (DS OB-131's bare-`<g>` recipe: bind enter/leave on the `<g>` and render
                   `WalkPreview` from `previewAnchor(getBoundingClientRect())`), never during a
                   drag. Entering a pin leaves the cell under it, so the cell's MapTooltip goes
                   as this card comes — one card at a time. A click falls through to the cell
                   the pin stands on, so a pin is still a way to select its region. `s.step` is
                   1-based; `play.steps` is the walk `bus.route` is a prefix of. `data-pin` is
                   the pin's index in walk order — what an arrow's `data-routearrow` joins. */
                <g
                  key={s.key}
                  data-routestop={s.visId}
                  data-step={s.step}
                  data-step-end={s.stepEnd}
                  data-pin={k}
                  opacity={b.pinOpacity}
                  transform={`translate(${s.c.x} ${s.c.y}) scale(${(f / view.s) * b.pinScale})`}
                  pointerEvents={dockShown ? 'all' : 'none'}
                  style={dockShown ? { cursor: 'pointer' } : undefined}
                  onPointerEnter={(e) => {
                    if (dragging || !dockShown) return
                    /* THE MARK IS THE HOST'S TO BUILD (OB-184): a pin stands for stops
                       `step`..`stepEnd`, 1-based, under the SLOT label it prints; the card
                       names every one of them, by that label */
                    const mark: WalkMark = { from: s.step - 1, to: s.stepEnd - 1, label: String(s.label), steps: play.steps.slice(s.step - 1, s.stepEnd) }
                    setPinHover({ i: s.step - 1, mark, ...previewAnchor(e.currentTarget.getBoundingClientRect()) })
                  }}
                  onPointerLeave={() => setPinHover(null)}
                  onClick={() => regionClick(s.visId)}
                >
                  <foreignObject x={-s.size / 2} y={-s.size / 2} width={s.size} height={s.size} style={{ overflow: 'visible' }}>
                    <StepDot n={s.label} state={wall ? wallPinState(s, wall) : b.behind ? 'done' : 'ahead'} arrival={wall ? undefined : b.active} variant="pin" size={s.size} />
                  </foreignObject>
                </g>
                )
              })}
              </g>
            </g>
          )}

          {/* ── HOVER PRESELECTION: outline + light tint on the cell a click
              would pick — kills the "which region am I over?" guess ─────── */}
          {hoverOutline && (
            <g data-hover={hover} pointerEvents="none">
              <path d={hoverOutline} fill={colorOf(hover!)} fillOpacity={0.1} stroke="#ffffff" strokeWidth={px(3)} strokeOpacity={0.9} />
              <path d={hoverOutline} fill="none" stroke={colorOf(hover!)} strokeWidth={px(1.5)} strokeOpacity={0.9} strokeDasharray={`${px(5)} ${px(3)}`} />
            </g>
          )}

          {/* ── SPOTLIGHT: something hovered in ANOTHER pane lives here ──── */}
          {spotOutline && (
            <g data-spot={spotId} pointerEvents="none">
              <path d={spotOutline} fill={colorOf(spotId!)} fillOpacity={0.25} stroke="#ffffff" strokeWidth={px(4.5)} strokeOpacity={0.95} />
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
            <g data-seloverlay pointerEvents="none">
              {/* the selection's NEIGHBOURHOOD (2026-07-17): every cell a road
                  reaches gets a wash of its own color too — "what is this
                  connected to" reads from the fills, not just the arrows.
                  Deliberately quieter than the selected cell on every axis
                  (0.1 vs 0.2 fill, hairline vs 3px border), and painted FIRST
                  so the primary stays the loudest thing in the overlay. It
                  follows the roads' hover dim, so pointing at one counterpart
                  recedes the rest of the neighbourhood with its roads. */}
              {[...new Set(bundles.flatMap((bd) => [bd.src, bd.tgt]))]
                .filter((id) => id !== sel && id !== endpointAtTier(sel, selTier))
                .map((cp) => {
                  const o = outlineOf(cp)
                  if (!o) return null
                  const dim = anyRoadLit && litRoad !== cp
                  return (
                    <g key={cp} data-selconn={cp} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity 120ms' }}>
                      <path d={o} fill={colorOf(cp)} fillOpacity={0.1} stroke="#ffffff" strokeWidth={px(2.5)} strokeOpacity={0.9} />
                      <path d={o} fill="none" stroke={colorOf(cp)} strokeWidth={px(1.3)} strokeOpacity={0.6} />
                    </g>
                  )
                })}
              {/* The selected cell is the LOUDEST thing on the map (issue #8: a
                  hairline + faint tint was still easy to lose, especially once
                  the neighbourhood wash tinted its connections at 0.1). Three
                  layers, back to front: a real GAUSSIAN GLOW (feGaussianBlur)
                  in the cell's tree color that leaks light past the border, a
                  white separator that also tints the cell body, and a crisp
                  heavy border. The glow lives in the luminance channel the flat
                  fills never touch, so it reads as "lit" even next to a same-hue
                  sibling — a haloed cell among pale ones is selected at a glance. */}
              {selOutline && (
                <>
                  <path d={selOutline} fill={colorOf(sel)} fillOpacity={0.16} stroke={colorOf(sel)} strokeWidth={px(7)} strokeOpacity={0.5} strokeLinejoin="round" filter="url(#sel-glow)" />
                  <path d={selOutline} fill={colorOf(sel)} fillOpacity={0.22} stroke="#ffffff" strokeWidth={px(6)} strokeOpacity={0.98} strokeLinejoin="round" />
                  <path data-seloutline d={selOutline} fill="none" stroke={colorOf(sel)} strokeWidth={px(4)} strokeLinejoin="round" />
                </>
              )}
              {bundles.map((bd) => {
                const a = bd.a
                const b = bd.b
                const dx = b.x - a.x
                const dy = b.y - a.y
                const len = Math.hypot(dx, dy) || 1
                const nx = -dy / len
                const ny = dx / len
                // trim to the BORDERS of the SELECTED grain: the tail starts
                // just inside the source region, the head lands just over the
                // target's border — nothing converges on the capitals
                const dip = px(11) / len
                const exitT = ringsCrossT(a, b, bd.srcRings, 'min') ?? px(6) / len
                const entryT = ringsCrossT(a, b, bd.tgtRings, 'max') ?? 1 - px(9) / len
                const t0 = Math.max(0, exitT - dip)
                const t1 = Math.min(1, entryT + dip)
                // one line per pair now, so the bow no longer has to fan
                // parallels apart — it only keeps the road off the dead-straight
                // centroid axis. Sign is pair-deterministic, so it never flips.
                const bulge = (bd.src < bd.tgt ? 1 : -1) * px(14)
                const ax = a.x + dx * t0
                const ay = a.y + dy * t0
                const bx = a.x + dx * t1
                const by = a.y + dy * t1
                const cx = (ax + bx) / 2 + nx * bulge
                const cy = (ay + by) / 2 + ny * bulge
                const ang = (Math.atan2(by - cy, bx - cx) * 180) / Math.PI
                const d = `M${ax},${ay} Q${cx},${cy} ${bx},${by}`
                // the curve's midpoint (t = 0.5 on the quadratic) — where the
                // traffic count sits
                const mx = 0.25 * ax + 0.5 * cx + 0.25 * bx
                const my = 0.25 * ay + 0.5 * cy + 0.25 * by
                const col = bd.type ? EDGE_COLOR[bd.type] : MIXED_EDGE_COLOR
                // item 3: this road lights when the hovered counterpart is its end
                const lit = litRoad != null && (bd.src === litRoad || bd.tgt === litRoad)
                const dim = anyRoadLit && !lit
                return (
                  <g
                    key={bd.key}
                    data-seledge={`${bd.src}>${bd.tgt}`}
                    data-en={bd.n}
                    data-dir={bd.dir}
                    data-elit={lit ? 1 : 0}
                    opacity={dim ? 0.22 : 1}
                    // OB-096 — MapTooltip's relation shape, on hover. `stroke`
                    // rather than `auto`: only the drawn line (including its
                    // wider white halo, a real hit target) responds, not the
                    // curve's whole invisible fill-none bounding box.
                    pointerEvents="stroke"
                    onPointerEnter={() => {
                      setHoverEdge(bd)
                      placeTipAtCursor()
                    }}
                    onPointerLeave={() => setHoverEdge((h) => (h === bd ? null : h))}
                    style={{ transition: 'opacity 120ms' }}
                  >
                    {/* A RELATION IS THE FOCUS LAYER, so it must not draw lighter
                        than the walk it displaces. It did: the walk's head is
                        ARROW_METRICS 8 long by 8.8 wide on a 1.5px shaft, and these
                        were 5.5 by 5.6 on 1.8 — the RECEDED layer carrying the bigger
                        arrowheads. OB-117 tried to open that gap by dimming the walk
                        and could not, because the gap was the wrong way round to
                        begin with; owner still reported the relations hard to read
                        with the recede shipped and working. Sized a step ABOVE the
                        walk's head instead of a step below it.

                        The head takes the same white casing as its shaft, which is
                        OB-116's argument one layer up: a bare triangle over a
                        saturated territory fill is a smudge, and enlarging it only
                        makes a bigger smudge. */}
                    <path d={d} fill="none" stroke="#ffffff" strokeWidth={px(lit ? 6.2 : 4.8)} strokeOpacity={0.75} />
                    <path d={d} fill="none" stroke={col} strokeWidth={px(lit ? 4.4 : bd.n > 1 ? 3.4 : 2.6)} strokeOpacity={0.92} />
                    {bd.dir === 'fwd' && (
                      <g transform={`translate(${bx} ${by}) rotate(${ang})`}>
                        <path d={`M${px(1.4)},0 L${-px(10.4)},${px(6.2)} L${-px(10.4)},${-px(6.2)} Z`} fill="#ffffff" fillOpacity={0.75} />
                        <path data-selhead d={`M0,0 L${-px(9)},${px(5)} L${-px(9)},${-px(5)} Z`} fill={col} />
                      </g>
                    )}
                    {bd.n > 1 && (
                      <text
                        x={mx}
                        y={my - px(4)}
                        textAnchor="middle"
                        fontSize={px(10)}
                        fontWeight={700}
                        fill={col}
                        stroke="#ffffff"
                        strokeWidth={px(2.6)}
                        paintOrder="stroke"
                        style={{ userSelect: 'none' }}
                      >
                        ×{bd.n}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}
        </g>
      </svg>

      {/* ── #24 THE DRAG GHOST — the cell you are carrying to the road ────────
          A portal to <body> so it floats above every pane regardless of their
          overflow. Two layers crossfade on the `outside` flag: the cell's own
          OUTLINE (drawn from outlineOf in the same user space getBBox reports,
          so any size works) while the pointer is over the map, and a NODE PILL
          once it leaves — the "shape becomes a node" morph. pointer-events:none
          so it never blocks elementFromPoint at the drop. */}
      {ghost &&
        createPortal(
          <div
            data-dragghost={ghost.id}
            style={{
              position: 'fixed',
              left: ghost.x,
              top: ghost.y,
              zIndex: 9999,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) scale(${ghost.outside ? 0.55 : 1})`,
                opacity: ghost.outside ? 0 : 1,
                transition: 'opacity 180ms ease, transform 180ms ease',
              }}
            >
              <svg
                width={78}
                height={78}
                viewBox={`${ghost.bbox.x} ${ghost.bbox.y} ${ghost.bbox.width} ${ghost.bbox.height}`}
                style={{ overflow: 'visible', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }}
              >
                <path
                  d={outlineOf(ghost.id)}
                  fill={colorOf(ghost.id)}
                  fillOpacity={0.85}
                  stroke="#ffffff"
                  strokeWidth={Math.max(ghost.bbox.width, ghost.bbox.height) / 32}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) scale(${ghost.outside ? 1 : 0.55})`,
                opacity: ghost.outside ? 1 : 0,
                transition: 'opacity 180ms ease, transform 180ms ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                background: '#ffffff',
                border: `2px solid ${colorOf(ghost.id)}`,
                color: colorOf(ghost.id),
                fontSize: 10.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: colorOf(ghost.id), flexShrink: 0 }} />
              {byId.get(ghost.id)!.title}
            </div>
          </div>,
          document.body,
        )}

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
      <LevelPicker style={{ position: 'absolute', left: 12, bottom: chromeBottom, transition: chromeRide, zIndex: 10 }} levels={LEVEL_LABELS} level={`L${level}`} onSelect={(l) => flyToLevel(Number(l.slice(1)))} />
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
          style={{ zIndex: 11 }}
        />
      )}
      {pinHover && play.steps[pinHover.i] && (
        <WalkPreview x={pinHover.x} top={pinHover.top}>{renderStopPreview(play.steps[pinHover.i], pinHover.i, pinHover.mark)}</WalkPreview>
      )}
    </PaneCanvas>
  )
}
