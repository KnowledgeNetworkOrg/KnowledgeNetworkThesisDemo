// THE WALK ON THE WALL — how the map draws a lecture's walk when the professor holds
// the map up to the room (#267, DS OB-139 rule 4). A still picture: every stop a
// pin, the covered stops and the stop on the wall joined by the walk line, that stop
// lit, and NO recency band — the room is looking to see where it has been and where
// it is going, and a band with nothing moving would hide the past for no reason.
//
// Pure, so MapView's wall mode and the projector window read one rule. A map pin can
// stand for a RUN of stops at a coarse level (walkpins.ts: `step`..`stepEnd`, 1-based);
// the wall's facts are 0-based stop indices, the presenter's own.

/** what the wall knows: the stop the room is looking at, and the stops actually presented */
export interface WallView {
  /** the stop on the wall — the active stop, or the roam — 0-based */
  lit: number
  /** the stops the record has left behind, 0-based; a skip is a gap */
  covered: readonly number[]
  /** THE FRAME THE WALL HOLDS (DS OB-163): the world rect the map fitted to when it first went
   *  up. The HOST keeps it for the lecture and hands it back on every mount, so taking the map
   *  down and putting it back up returns the same frame, not a fresh fit. `null`/absent: not
   *  fitted yet — the map fits to the whole walk and reports the frame through `onFrame`. */
  frame?: WallFrame | null
  onFrame?: (frame: WallFrame) => void
}

// ── THE WALL'S CAMERA (DS OB-163, owner-ruled 2026-09-06) ─────────────────────────────
// The map on the wall fits ONCE, to the extent of the WHOLE walk — every stop, not the
// covered ones — at the moment it first goes up, and holds that frame for the rest of the
// lecture. Advancing, roaming, and taking the map down and putting it back up all leave
// the camera exactly where it is; only a change to the walk itself may re-fit. Why not
// frame the covered stops: that re-frames on every arrival and the room re-reads the whole
// picture each time. Why not the province tier the wall opened at before: early in a
// lecture the walk was a small mark in a large map, and the wall exists to show the class
// where it has been. Pure arithmetic in the map's own world units and the box's pixels;
// the host (MapView) turns it into its camera.

/** a rect in the map's world units — the extent the wall shows — and the LEVEL the wall draws
 *  it at. The level is part of the frame, not derived from it on each mount: the pins are laid
 *  out per level, so the extent is read at the level it will be drawn at, and a second mount
 *  that re-derived the level from the scale could land one tier off and draw different cells
 *  under the same camera. */
export interface WallFrame { x: number; y: number; w: number; h: number; level: number }

/** the bounding rect of the walk's pins, or null for a walk with none */
export function wallExtent(points: readonly { x: number; y: number }[], level: number): WallFrame | null {
  if (!points.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, level }
}

/** how much of the box the frame keeps clear on each side, as FRACTIONS of the box's own size
 *  (a fraction so the same picture comes out on the roll's live card, the projector and full
 *  screen, which differ in pixels but not in shape). CHOSEN: `top` clears `ProjectedMap`'s
 *  caption — its top inset 44 plus two lines, about 100 of the 630 reference — and `bottom`
 *  its 32px foot with a margin; the sides leave a pin its own width. */
export const WALL_FRAME_INSET = { top: 0.17, right: 0.07, bottom: 0.1, left: 0.07 }

export interface WallFit {
  /** pixels of box per world unit at which the frame fills the box's clear area on its tighter axis */
  pxPerUnit: number
  /** the frame's centre, in world units — what sits at `at` */
  focus: { x: number; y: number }
  /** the clear area's centre, in pixels from the box's top-left corner */
  at: { x: number; y: number }
}

/** the fit: the frame fills the box's clear area (the box less the insets) on whichever axis
 *  is tighter, centred in it. Deterministic — the same frame and box give the same fit, which is
 *  what lets two mounts (M down, M up) draw one picture. A frame with no extent (every stop on
 *  one cell) asks for an unbounded scale; the host clamps it to its own range. */
export function wallFit(frame: WallFrame, box: { w: number; h: number }, inset = WALL_FRAME_INSET): WallFit {
  const clearW = box.w * (1 - inset.left - inset.right)
  const clearH = box.h * (1 - inset.top - inset.bottom)
  const pxPerUnit = Math.min(clearW / Math.max(frame.w, 1e-9), clearH / Math.max(frame.h, 1e-9))
  return {
    pxPerUnit,
    focus: { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 },
    at: { x: box.w * inset.left + clearW / 2, y: box.h * inset.top + clearH / 2 },
  }
}

/** a pin's face on the wall: `current` when the lit stop is inside its run, `done` when
 *  every stop of its run was covered, `ahead` otherwise */
export function wallPinState(pin: { step: number; stepEnd: number }, wall: WallView): 'current' | 'done' | 'ahead' {
  const lit = wall.lit + 1
  if (lit >= pin.step && lit <= pin.stepEnd) return 'current'
  for (let s = pin.step; s <= pin.stepEnd; s++) if (!wall.covered.includes(s - 1)) return 'ahead'
  return 'done'
}

/** the walk line joins the covered stops and the lit one, in walk order: the arrow from
 *  one pin to the next is drawn only when BOTH pins are on that line */
export function wallArrowShown(from: { step: number; stepEnd: number }, to: { step: number; stepEnd: number }, wall: WallView): boolean {
  return wallPinState(from, wall) !== 'ahead' && wallPinState(to, wall) !== 'ahead'
}
