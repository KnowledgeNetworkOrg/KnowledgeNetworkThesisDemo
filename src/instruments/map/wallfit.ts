// THE WALL'S FIT — where the map held up to the room points, and why it never moves
// once it has been put there (#267, DS OB-139; DS OB-163). The arithmetic is
// `model/walkwall.ts`'s; this is the half that turns it into the map's camera, and it
// needs React only because the box it fits into is measured after a render.
//
// Split out of MapView.tsx by #324. The arithmetic is unchanged. The one difference is
// that the camera's two setters are now handed in, and so are named in the effect's
// dependencies (see `useWallFit`) — which changes nothing, since both are stable. The
// map calls this hook where the block used to sit, so its layout effect still runs in
// the same order among the map's own.

import { useLayoutEffect, useRef } from 'react'

import type { XY } from '../../model/derive'
import { WALL_FRAME_INSET, wallExtent, wallFit } from '../../model/walkwall'
import type { WallFrame, WallView } from '../../model/walkwall'
import { L_MAX, LEVEL_S, U_CX, U_CY, VB_H, VB_W } from './camera'
import type { View } from './camera'

/** THE WALL (#267, DS OB-139): the map held up to the room opens at the province level — one
 *  grain in from the atlas, where a walk's stops spread onto their own cells — with the camera
 *  about the atlas's centre, the same arithmetic `flyToLevel` uses from the home view. Since
 *  OB-163 this is only the frame the wall's FIRST render draws and the level its pins are laid
 *  out at for the fit; the fit below replaces it before the wall has finished growing. */
export const WALL_LEVEL = 1
export const WALL_VIEW: View = { s: LEVEL_S[WALL_LEVEL], tx: U_CX - (U_CX / LEVEL_S[0]) * LEVEL_S[WALL_LEVEL], ty: U_CY - (U_CY / LEVEL_S[0]) * LEVEL_S[WALL_LEVEL] }

// ── OB-163: THE WALL FITS THE WHOLE WALK ONCE, THEN NEVER MOVES ──────────────
// The owner's ruling (2026-09-06): the map on the wall fits to the extent of EVERY stop
// at the moment it first goes up and holds that frame for the lecture — advancing,
// roaming, M down and M up all leave the camera where it is; only a change to the walk
// re-fits. THE FRAME IS THE HOST'S: `wall.frame` comes back on every mount and the fit is
// recomputed from it (deterministic, so M down / M up is one picture), and a mount with
// no frame yet reads the pins' extent, laid out at `WALL_LEVEL`, and reports it through
// `onFrame`. The fit sets the scale AND the level — the level is what the map draws at,
// and a walk that fits at a topic scale wants topic cells under its pins, the same
// pairing `flyToLevel` keeps. TWO PASSES, because the pins are laid out PER LEVEL: the
// first reads their extent at `WALL_LEVEL` and only picks the level its scale asks for;
// the second reads the extent again at THAT level (topic pins spread wider than the
// province pin standing for them, and a first-pass frame left two of seven outside) and
// sets the camera, keeping the level — bounded, no third pass. The frame records the
// level, so a later mount draws the same cells under the same camera. `wallFit` and
// `wallExtent` are `model/walkwall.ts`'s.
//
// `showLevel` and `showView` are the map's own camera setters, and MUST BE STABLE across
// renders: they are in the effect's dependencies, so a fresh function every render would
// re-run the fit's checks on every render. The fit is a camera move, made from a box a
// render cannot know, which is why it is handed the setters rather than returning a view.
export function useWallFit({
  wall,
  clientBox,
  route,
  pins,
  level,
  showLevel,
  showView,
}: {
  /** absent off the wall: the hook does nothing */
  wall: WallView | undefined
  /** the map's measured box, null until the first measurement */
  clientBox: { w: number; h: number } | null
  /** the walk's route — a change to it is the one thing that re-fits */
  route: readonly string[]
  /** the walk's pins as laid out at `level` */
  pins: readonly { c: XY }[]
  level: number
  showLevel: (l: number) => void
  showView: (v: View) => void
}): void {
  const wallFrame = wall ? wall.frame ?? null : null
  const onWallFrame = wall ? wall.onFrame : undefined
  const fittedRef = useRef<{ route: readonly string[]; frame: WallFrame } | null>(null)
  const wallPassRef = useRef<{ route: readonly string[]; level: number } | null>(null)
  // (the camera and the level are set ONCE per frame, from a measured box a render cannot know;
  // a layout effect, so the fit lands in the same frame as the measurement)
  useLayoutEffect(() => {
    const applyWallFit = (frame: WallFrame, cb: { w: number; h: number }) => {
      const fit = wallFit(frame, cb, WALL_FRAME_INSET)
      const ff = Math.max(VB_W / cb.w, VB_H / cb.h)
      const s = Math.min(LEVEL_S[L_MAX], Math.max(LEVEL_S[0], fit.pxPerUnit * ff))
      // the clear area's centre in viewBox units: the viewBox is centred in the box (xMidYMid)
      const ux = U_CX + (fit.at.x - cb.w / 2) * ff
      const uy = U_CY + (fit.at.y - cb.h / 2) * ff
      showView({ s, tx: ux - fit.focus.x * s, ty: uy - fit.focus.y * s })
      showLevel(frame.level)
      return s
    }
    if (!wall || !clientBox) return
    const have = fittedRef.current
    if (have && have.route === route && (!wallFrame || have.frame === wallFrame)) return
    if (wallFrame) {
      fittedRef.current = { route, frame: wallFrame }
      applyWallFit(wallFrame, clientBox)
      return
    }
    const pass = wallPassRef.current
    if (!pass || pass.route !== route) {
      // pass 1: the extent at the level the pins are laid out at now decides the level only
      const first = wallExtent(pins.map((p) => p.c), level)
      if (!first) return
      const s = wallFit(first, clientBox, WALL_FRAME_INSET).pxPerUnit * Math.max(VB_W / clientBox.w, VB_H / clientBox.h)
      let l = 0
      while (l + 1 <= L_MAX && LEVEL_S[l + 1] <= s) l++
      wallPassRef.current = { route, level: l }
      if (l !== level) { showLevel(l); return } // the pins re-lay-out; pass 2 follows
    }
    // pass 2: the extent at the level the wall will draw at IS the frame
    const frame = wallExtent(pins.map((p) => p.c), wallPassRef.current!.level)
    if (!frame) return
    fittedRef.current = { route, frame }
    applyWallFit(frame, clientBox)
    if (onWallFrame) onWallFrame(frame)
  }, [wall, wallFrame, onWallFrame, clientBox, pins, route, level, showLevel, showView])
}
