// THE WALK'S ARRIVAL LOOK — whether playback's next arrival has to move the camera.
// Split out of MapView.tsx by #324's camera seam, the rule whole. It needs React
// because the question is asked on a COMMIT (the fractional position reaching a new
// stop), and it reads the live camera and the pins through a ref by then; the flight
// it makes is `camera.ts`'s arithmetic and `mapcamera.ts`'s tween.
//
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

import { useEffect, useRef } from 'react'

import { walkArrival, walkLook, WALK_DOCK_METRICS } from '@/ds'
import type { WalkPin } from '../../model/walkpins'
import { VB_H, VB_W, viewCentredOn, worldRectOf } from './camera'
import { LOOK_FLY_MS } from './mapcamera'
import type { MapCamera } from './mapcamera'

export function useArrivalLook(
  cam: MapCamera,
  {
    dockShown,
    onWall,
    playing,
    position,
    stepCount,
    pins,
    dockOpen,
  }: {
    /** whether the walk dock is on this pane at all — no dock, no played walk */
    dockShown: boolean
    /** the wall (#267) is a still picture: playback's look never runs there */
    onWall: boolean
    /** playback's clock: only an arrival the walk travelled to asks */
    playing: boolean
    /** the fractional stop the walk is at (`play.position`) */
    position: number
    /** how many stops the played walk has (`play.steps.length`) */
    stepCount: number
    /** the pins as laid out at the level the last render drew (`routeStops`) */
    pins: readonly WalkPin[]
    /** the dock's open state — its LIVE height comes off `WALK_DOCK_METRICS` */
    dockOpen: boolean
  },
): void {
  const arrival = dockShown && !onWall && playing ? walkArrival(position, stepCount) : null
  const lastArrivalRef = useRef<number | null>(null)
  const lookRef = useRef({ routeStops: pins, clientBox: cam.clientBox, dockOpen })
  useEffect(() => { lookRef.current = { routeStops: pins, clientBox: cam.clientBox, dockOpen } })
  useEffect(() => {
    const prev = lastArrivalRef.current
    lastArrivalRef.current = arrival
    if (arrival === null || prev === null) return // paused, or play just pressed: standing, not advancing
    if (cam.pannedRef.current) { cam.pannedRef.current = false; return }
    const { routeStops, clientBox: cb, dockOpen: open } = lookRef.current
    const pin = routeStops.find((p) => p.step <= arrival && arrival <= p.stepEnd)
    if (!pin) return
    const v = cam.viewRef.current
    const rect = worldRectOf(v, cb)
    const ff = cb ? Math.max(VB_W / cb.w, VB_H / cb.h) : 1
    const dockWorld = ((open ? WALK_DOCK_METRICS.open : WALK_DOCK_METRICS.closed) * ff) / v.s
    const look = walkLook({ point: pin.c, view: { x: rect.x, y: rect.y, width: rect.w, height: Math.max(1, rect.h - dockWorld) } })
    if (!look.move || !look.to) return
    cam.flyTween(viewCentredOn(look.to, v.s), LOOK_FLY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival])
}
