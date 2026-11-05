// THE PRESENTER'S VIEW OF THE DESK BUS — read-only where the desk is concerned.
//
// The presenter plays its own walk and keeps its own shown stop; a presentation
// must leave the desk exactly as it was before ▶. The six writers playback and the
// wall map would otherwise reach — focus, the cursors, the walk and hover — are
// replaced with no-ops here, and the two cursor reads are pinned to the walk's
// start; every other member passes through unchanged.

import { routeLeafIds } from '../model/route'
import type { RouteStep } from '../model/route'
import type { PresenterScreenBus } from './PresenterScreen'

/* Module-level on purpose: the view is rebuilt every render, and a fresh writer
   per render would make every memo that binds one rebuild with it. */
const noSetFocus = () => {}
const noClearFocus = () => {}
const noActivateWalk = () => {}
const noSetDraftCursor = () => {}
const noSetHover = () => {}
const noEndHover = () => {}

/** the lecture's own stops, as the presenter sees them. Given, the view publishes
 *  THEIR route, so a lecture on another walk than the desk's still draws its own
 *  road on the wall. Omitted, the desk's route passes through untouched. */
export function presenterBus(deskBus: PresenterScreenBus, walkId: string | null | undefined, lectureSteps?: readonly { id: string; optional?: boolean }[]): PresenterScreenBus {
  const lectureRoute: RouteStep[] | null = lectureSteps
    ? lectureSteps.map((s) => (s.optional ? { node: s.id, optional: true } : { node: s.id }))
    : null
  return {
    ...deskBus,
    activeWalk: walkId ? { walkId, cursor: 0 } : null,
    draftCursor: 0,
    ...(lectureRoute ? { route: routeLeafIds(lectureRoute), routeSteps: lectureRoute } : {}),
    setFocus: noSetFocus,
    clearFocus: noClearFocus,
    activateWalk: noActivateWalk,
    setDraftCursor: noSetDraftCursor,
    setHover: noSetHover,
    endHover: noEndHover,
  }
}
