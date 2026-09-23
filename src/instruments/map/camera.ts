// THE MAP'S FIXED FRAME AND ITS LEVELS — the numbers every part of the map measures
// its camera in. Split out of MapView.tsx (#324) so a part of the map that moves the
// camera from a file of its own (the wall's fit, first) reads the same frame and the
// same scales the map draws with, not a second copy of them.
//
// The camera's MOVING parts — the tween, the level steps, the pan, the look — are
// still in MapView.tsx. #324's camera seam is the step that brings them here.
//
// The wall's opening frame (`WALL_LEVEL`, `WALL_VIEW`) is measured in these numbers but
// is not kept here: it is the frame the wall draws once before its fit replaces it, so it
// lives with that fit in `wallfit.ts`, and the map's first camera reads it from there.

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
