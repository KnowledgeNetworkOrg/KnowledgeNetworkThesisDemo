// THE MAP'S FIXED FRAME AND ITS LEVELS — the numbers every part of the map measures
// its camera in. Split out of MapView.tsx (#324) so a part of the map that moves the
// camera from a file of its own (the wall's fit, first) reads the same frame and the
// same scales the map draws with, not a second copy of them.
//
// The camera's MOVING parts — the tween, the level steps, the pan, the look — live in
// the two files this one is next to: `mapcamera.ts` (the live camera: its state, the
// tween, the level steps, the pan, the wheel) and `arrivallook.ts` (playback's
// off-screen look). What stays HERE is what either of those can use without React —
// the frame, and the view arithmetic a flight is interpolated with — so that
// arithmetic can be tested in node.
//
// The wall's opening frame (`WALL_LEVEL`, `WALL_VIEW`) is measured in these numbers but
// is not kept here: it is the frame the wall draws once before its fit replaces it, so it
// lives with that fit in `wallfit.ts`, and the map's first camera reads it from there.

import type { XY } from '../../model/derive'
import { FLAT_H, FLAT_W } from '../../model/flat'
import { maxTier } from '../../model/nested'

// the SVG's viewBox: the whole atlas plus 40 units of water on every side, and its centre
export const VB_X = -40
export const VB_Y = -40
export const VB_W = FLAT_W + 80
export const VB_H = FLAT_H + 80
export const U_CX = VB_X + VB_W / 2
export const U_CY = VB_Y + VB_H / 2

// Levels run L0..maxTier — the deepest stratum in the DATA decides how far
// the scale goes. Each level is a canonical scale; there is nothing between.
export const L_MAX = maxTier
const BASE_S = [0.8, 1.6, 3.0, 5.5, 9.5, 14]
export const LEVEL_S = Array.from({ length: L_MAX + 1 }, (_, i) => BASE_S[i] ?? BASE_S[BASE_S.length - 1] * Math.pow(1.5, i - (BASE_S.length - 1)))

/** where the camera stands, in viewBox units: the scene is drawn at
 *  `translate(tx ty) scale(s)` */
export interface View {
  tx: number
  ty: number
  s: number
}

/** THE MAP'S HOME FRAME: the whole atlas at the first level, which is where the map
 *  opens before any fit. (The wall's own opening frame is `wallfit.ts`'s — it is the
 *  picture the wall draws once, not a home the map ever returns to.) */
export const HOME_VIEW: View = { tx: 0, ty: 0, s: LEVEL_S[0] }

/** THE FRAME A LEVEL STEP FLIES TO (`flyToLevel`): the level's canonical scale `s`,
 *  with `about` — a point in viewBox/user units — left exactly where it was on screen. */
export function viewKeepingPoint(from: View, s: number, about: XY): View {
  return { s, tx: about.x - ((about.x - from.tx) / from.s) * s, ty: about.y - ((about.y - from.ty) / from.s) * s }
}

/** ONE FRAME OF A FLIGHT at (raw) time `t`, 0..1 — what `flyTween` sets every animation
 *  frame. The ease lives HERE, not at the call site: the frame's centre interpolates
 *  linearly in viewBox units and its scale geometrically (so a flight between two
 *  scales reads as one motion rather than an acceleration), both through the same cubic
 *  ease. `t = 0` is `from`, `t = 1` is `target`. */
export function viewBetween(from: View, target: View, t: number): View {
  const e = 1 - Math.pow(1 - t, 3)
  const c0 = { x: (U_CX - from.tx) / from.s, y: (U_CY - from.ty) / from.s }
  const c1 = { x: (U_CX - target.tx) / target.s, y: (U_CY - target.ty) / target.s }
  const cx = c0.x + (c1.x - c0.x) * e
  const cy = c0.y + (c1.y - c0.y) * e
  const s = from.s * Math.pow(target.s / from.s, e)
  return { s, tx: U_CX - cx * s, ty: U_CY - cy * s }
}

/** the frame that puts `point` dead centre at scale `s` — `up` viewBox units above the
 *  centre where something (the walk dock, DS OB-130) is covering the pane's bottom edge.
 *  The peek's flight and playback's arrival look both land here. */
export function viewCentredOn(point: XY, s: number, up = 0): View {
  return { s, tx: U_CX - point.x * s, ty: U_CY - up - point.y * s }
}

/** the viewport in WORLD coords for a camera and a measured client box — what culls the deep
 *  tiers, and what the walk's look asks its off-screen question of (OB-179). A function, not an
 *  inline object, so an effect can ask it off refs without re-deriving it. */
export function worldRectOf(v: View, clientBox: { w: number; h: number } | null): { x: number; y: number; w: number; h: number } {
  const f = clientBox ? Math.max(VB_W / clientBox.w, VB_H / clientBox.h) : 1
  return {
    x: (VB_X - (clientBox ? (clientBox.w * f - VB_W) / 2 : 0) - v.tx) / v.s,
    y: (VB_Y - (clientBox ? (clientBox.h * f - VB_H) / 2 : 0) - v.ty) / v.s,
    w: (clientBox ? clientBox.w * f : VB_W) / v.s,
    h: (clientBox ? clientBox.h * f : VB_H) / v.s,
  }
}

/** a CLIENT (screen) point → a USER (viewBox) point, through a measured box — the
 *  arithmetic the camera's `toUser` runs, split out so it is testable without a DOM.
 *  The viewBox is centred in the box (SVG's xMidYMid), hence the letterbox halves. */
export function userPointAt(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): XY {
  const f = Math.max(VB_W / rect.width, VB_H / rect.height)
  return {
    x: VB_X + (clientX - rect.left - (rect.width - VB_W / f) / 2) * f,
    y: VB_Y + (clientY - rect.top - (rect.height - VB_H / f) / 2) * f,
  }
}
