// THE PRESENTER'S VIEW OF THE DESK BUS — read-only where the desk is concerned.
//
// The presenter plays its own walk and keeps its own shown stop; a presentation
// must leave the desk exactly as it was before ▶. The six writers playback and the
// wall map would otherwise reach — focus, the cursors, the walk and hover — are
// replaced with no-ops here, and the two cursor reads are pinned to the walk's
// start; every other member passes through unchanged.

import type { PresenterScreenBus } from './PresenterScreen'

/* Module-level on purpose: the view is rebuilt every render, and a fresh writer
   per render would make every memo that binds one rebuild with it. */
const noSetFocus = () => {}
const noClearFocus = () => {}
const noActivateWalk = () => {}
const noSetDraftCursor = () => {}
const noSetHover = () => {}
const noEndHover = () => {}

export function presenterBus(deskBus: PresenterScreenBus, walkId: string | null | undefined): PresenterScreenBus {
  return {
    ...deskBus,
    activeWalk: walkId ? { walkId, cursor: 0 } : null,
    draftCursor: 0,
    setFocus: noSetFocus,
    clearFocus: noClearFocus,
    activateWalk: noActivateWalk,
    setDraftCursor: noSetDraftCursor,
    setHover: noSetHover,
    endHover: noEndHover,
  }
}
