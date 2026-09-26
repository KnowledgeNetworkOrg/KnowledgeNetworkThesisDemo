// THE MAP'S LIVE CAMERA — where it stands, the level steps, the tween, the pan, the
// wheel. Split out of MapView.tsx by #324's camera seam. The frame it measures in and
// the arithmetic a flight is interpolated with are `camera.ts`, kept React-free so
// they can be tested in node; this is the half that needs React, because the box a
// gesture moves through is only measured after a render and the scene's transform is
// written between renders. Playback's off-screen look — the other thing that moves
// this camera — is `arrivallook.ts` next door.
//
// ── THE CAMERA IS NOT REACT'S (#238 fix 3) ───────────────────────────────────
// Moved here with the code it governs. The root <g> carries no `transform` prop;
// `paintCamera` below is its only writer. Two things follow, and both are the point:
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { WALK_DOCK_METRICS } from '@/ds'
import { flightTargetOf } from '../../model/atlas'
import type { XY } from '../../model/derive'
import type { Bus } from '../../state/bus'
import { L_MAX, LEVEL_S, U_CX, U_CY, VB_H, VB_W, userPointAt, viewBetween, viewCentredOn, viewKeepingPoint, worldRectOf } from './camera'
import type { View } from './camera'

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
const FLY_MS = 260
// a LOOK's flight (a Connections click) can cross the whole map AND change
// level in one move — at the wheel-step 260ms it read as a cut, not a flight.
// Slow enough for the eye to keep the territory; wheel steps stay snappy.
export const LOOK_FLY_MS = 750

/** THE MAP'S CAMERA, LIVE — `MapView` calls this once and reads everything it draws
 *  by. The camera's state is the level, the frame and the measured box; everything
 *  else below is one of the ways a gesture, a flight or the wheel moves them. */
export function useMapCamera({
  svgRef,
  playing,
  dockShown,
  peek,
  initialView,
  initialLevel,
}: {
  /** the pane's svg: the pan measures it, the wheel listens on it */
  svgRef: RefObject<SVGSVGElement | null>
  /** playback's clock (OB-179): a level step or a pan DURING playback is the room's own move */
  playing: boolean
  /** whether the walk dock is mounted — the look's flight insets for it (DS OB-130) */
  dockShown: boolean
  /** a Connections-pane LOOK; a fresh `seq` per click, so the object is the effect's dep */
  peek: Bus['peek']
  /** the frame to open at: the wall's own first frame on the wall, else the map's home */
  initialView: View
  initialLevel: number
}) {
  const [view, setView] = useState<View>(initialView)
  const [level, setLevel] = useState(initialLevel)
  const [clientBox, setClientBox] = useState<{ w: number; h: number } | null>(null)

  // refs mirror state so the raw listeners and the tween read the LIVE camera:
  // `viewRef` is kept current by the paint layout effect below (and by the pan);
  // `levelRef` is written EAGERLY by `showLevel`, because the raw wheel listener
  // (deps []) reads it synchronously between notches
  const viewRef = useRef(view)
  const levelRef = useRef(level)

  const sceneRef = useRef<SVGGElement | null>(null)
  const paintCamera = (v: View) => sceneRef.current?.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.s})`)
  useLayoutEffect(() => {
    viewRef.current = view
    paintCamera(view)
  }, [view])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver((entries) => {
      /* THE LAYOUT BOX, NEVER THE BOUNDING RECT (OB-163's receipt has the picture): the wall
         mounts inside `WallTransition`'s `scale(0.3)` and grows from there, and a bounding rect
         read at mount is a third of the truth — a transform changing fires no resize, so that
         number stuck for the whole lecture and every label and pin on the wall was drawn 3.3×
         too large (a 73px box for a 22px pin). `ProjectedMap` reads `offsetWidth` for the
         same reason; an observer's `contentRect` is the same untransformed box. */
      const c = entries[0]?.contentRect
      const r = c && c.width > 0 ? c : svg.getBoundingClientRect()
      // a BENCHED pane (display:none) measures 0×0 — that box carries no
      // layout information and would drive the zoom factor to Infinity, so
      // keep the last real one until the pane is shown again
      if (r.width > 0 && r.height > 0) setClientBox({ w: r.width, h: r.height })
    })
    ro.observe(svg)
    return () => ro.disconnect()
    // svgRef is a stable ref object, but the rule cannot see that across the hook boundary
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      setView(viewBetween(from, target, t))
      anim.current = t < 1 ? requestAnimationFrame(tick) : null
    }
    anim.current = requestAnimationFrame(tick)
  }

  /** THE ONE LEVEL SETTER. Every move that changes the stratum — a wheel step, a
   *  double-click, the level buttons, the wall's fit, the peek flight — comes through
   *  here. The ref is written EAGERLY, not from a render: the raw wheel listener reads
   *  it synchronously between notches, and a step measured from a stale level is a
   *  swallowed or doubled notch. Nothing else writes the level, so the render-time
   *  mirror this replaced could never have disagreed with it. */
  const showLevel = useCallback((l: number) => {
    levelRef.current = l
    setLevel(l)
  }, [])

  // OB-179: the room's OWN camera move during playback — a level step and the pan
  // commit below raise it, and the next arrival look (`arrivallook.ts`) lowers it
  // without looking once. A ref because the wheel listener and the pan read it
  // between renders.
  const pannedRef = useRef(false)

  /** step to a level: set the stratum, fly to its canonical scale, keeping
   * `about` (user coords) fixed under the cursor. Always a USER gesture (wheel
   * step, double-click, level button). */
  const flyToLevel = (l: number, about?: XY) => {
    if (playing) pannedRef.current = true // a user's own gesture — the walk's look stands aside once (OB-179)
    showLevel(l)
    // OB-193: level -1 (the root, one region) shares level 0's camera framing exactly — it is
    // the same six-territory extent, just drawn as one shape instead of six, not a further
    // zoom-out. LEVEL_S has no index for it, so the lookup floors at 0.
    const s = LEVEL_S[Math.max(l, 0)]
    const v = viewRef.current
    const a = about ?? { x: U_CX, y: U_CY }
    flyTween(viewKeepingPoint(v, s, a))
  }

  /** a whole-level step, bounded exactly as the wheel has always bounded it: the floor
   *  is 0 (level -1 is reachable only by the level picker, OB-193), the ceiling L_MAX.
   *  `dir` is +1 up / -1 down; `about` is the point kept fixed. */
  const stepLevel = (dir: number, about?: XY) => {
    const l = levelRef.current + dir
    if (l < 0 || l > L_MAX) return
    flyToLevel(l, about)
  }

  // ── LOOK (SelfNotes audit): a CLICK in the Connections pane flies the camera
  // — a hover never does, it only highlights. The pane stamps bus.peek with a
  // fresh seq per click, so re-looking at the same node after panning away is a
  // fresh command. The map answers by flying to the node's territory at its
  // tier's canonical scale (keeping it lit is MapView's spotlight). No fly-home:
  // a look is navigation, not a glance — the camera is simply the user's again
  // the moment they grab it (drag, wheel, level buttons).
  //
  // THE LOOK FLIGHT'S INSET (DS OB-130: "the host insets its auto-fit by
  // WALK_DOCK_METRICS.closed"). This map has no auto-fit — its camera is level-
  // driven, and the only move that centres a point is this LOOK — so the inset
  // lands here: while the dock is mounted the looked-at node is centred in the
  // map ABOVE the closed dock rather than in the whole pane, which is
  // `closed / 2` px higher, in the SVG's units (`f` = units per px, the same
  // formula `toUser` and the render-time `f` carry).
  const lookInset = dockShown && clientBox ? (WALK_DOCK_METRICS.closed / 2) * Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 0
  useEffect(() => {
    if (!peek) return
    const t = flightTargetOf(peek.id)
    if (!t) return
    showLevel(t.tier)
    const s = LEVEL_S[t.tier]
    flyTween(viewCentredOn(t.c, s, lookInset), LOOK_FLY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek])

  const toUser = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return userPointAt(clientX, clientY, rect)
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
        stepLevel(1, toUser(ev.clientX, ev.clientY))
      } else if (wheelAccum.current >= 50) {
        wheelAccum.current = 0
        stepLevel(-1, toUser(ev.clientX, ev.clientY))
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** THE PAN'S MOVE — called by MapView's pointermove after the #24 node-drag branch
   *  has declined the gesture. Client-space deltas in; the camera is written straight
   *  to the DOM (no render); drift is committed to state once it passes PAN_COMMIT;
   *  and the distance moved comes back in viewBox units for the caller's click guard.
   *
   *  THE COMMIT IS MEASURED AGAINST THIS RENDER'S `view` — the handler is rebuilt by
   *  the render that commits a drift, so `view` is the last committed camera. Reading
   *  `viewRef` here instead would lose the commit boundary (and the culling the commit
   *  exists for), so this is deliberately NOT a `useCallback`. */
  const panBy = (clientDx: number, clientDy: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const ff = Math.max(VB_W / rect.width, VB_H / rect.height)
    const dx = clientDx * ff
    const dy = clientDy * ff
    const next = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy }
    viewRef.current = next
    paintCamera(next)
    if (Math.hypot(next.tx - view.tx, next.ty - view.ty) / next.s >= PAN_COMMIT) { if (playing) pannedRef.current = true; setView(next) }
    return Math.hypot(dx, dy)
  }

  /** settle a pan: whatever drift never crossed PAN_COMMIT is committed now, so the
   *  map is culled for exactly where the pointer left it (a no-op when the last move
   *  already committed). */
  const settlePan = () => setView(viewRef.current)

  // viewport in world coords, for culling the deep tiers (and the look's question)
  const f = clientBox ? Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 1
  const worldRect = worldRectOf(view, clientBox)
  const onScreen = (p: XY, margin: number) =>
    p.x > worldRect.x - margin && p.x < worldRect.x + worldRect.w + margin && p.y > worldRect.y - margin && p.y < worldRect.y + worldRect.h + margin

  /** SCREEN pixels → world units at the current zoom AND pane size, so every
   * level renders the same authored style at its canonical scale.
   *
   * STABLE, on purpose: `f` and `view.s` are its only inputs, and the pins' memo
   * and `WalkArrows` both depend on it — a fresh reference every render would
   * recompute both for nothing. */
  const px = useCallback((v: number) => (v * f) / view.s, [f, view.s])

  /** OB-212: `labelFit`'s fitted font sizes are in ITS OWN world-unit space (`world()`,
   *  pinned to the level's canonical scale so line breaks don't reflow mid-flight) — this
   *  converts one back to the CURRENT live zoom's SVG units, same conversion `px` does, so a
   *  shrunk label's rendered size still tracks the live camera exactly as an unshrunk one
   *  does (`world(v) * LEVEL_S[level] / view.s === px(v)` when the camera is at rest, and
   *  tracks smoothly through a fly-to since only `view.s` moves). */
  const worldFsToPx = (worldFs: number) => (worldFs * LEVEL_S[level]) / view.s

  return {
    view,
    level,
    showLevel,
    showView: setView,
    flyToLevel,
    stepLevel,
    cancelFlight,
    sceneRef,
    clientBox,
    f,
    px,
    worldFsToPx,
    onScreen,
    toUser,
    panBy,
    settlePan,
    flyTween,
    viewRef,
    pannedRef,
  }
}

/** what `useMapCamera` returns — the type `arrivallook.ts` takes its camera as */
export type MapCamera = ReturnType<typeof useMapCamera>
