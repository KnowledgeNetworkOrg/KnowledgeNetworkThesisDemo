// What the PRESENTATION instruments read: the walk currently open on the desk,
// resolved to one linear road (every container down to one variant, optionals
// in or out per the road's own toggle).
//
// Columns and the layer stack used to be two zones inside the Walk·Desk, fed by
// the desk's own draft. #20 split them out into instruments the Studio composes
// like any other, on the reasoning that they do a different job: they PRESENT a
// resolved road — they never see a fork, never edit, and take no drop. A preview
// belongs beside an editor, not inside it.
//
// usePresentedRoad() reads the SAME singleton draft the editor writes
// (authordraft.ts), through the same resolveRoad() the editor used to call
// locally — so what these views show is the plan actually being authored, not
// a frozen stand-in.

import { useEffect, useMemo, useState } from 'react'

import { isBox, resolveRoad, routeStepsOf } from './mockwalk'
import type { Stop } from './mockwalk'
import { useAuthorDraft, useRoad } from './authordraft'
import type { Bus } from '../bus'

/** the draft currently open on the desk, resolved: every container down to one
 * variant, optionals in or out per the road's own toggle. Live — re-renders on
 * every edit, since useAuthorDraft/useRoad bind the draft's stores directly. */
export function usePresentedRoad(): Stop[] {
  const { stops } = useAuthorDraft()
  const { choices, withOptionals } = useRoad()
  return useMemo(() => resolveRoad(stops, choices, withOptionals), [stops, choices, withOptionals])
}

/** Publishes the presented road onto the bus — WITH ITS GROUPS (#228, DS
 * OB-114): `bus.routeSteps` carries the tree, and `bus.route` is its flat
 * projection, so Map/Connections highlight it as before (#14, closed) and the
 * map's pins can number a group's nodes with the group's own step. Pass `null`
 * to opt out — the walk viewer does this while a saved walk is playing, since
 * activateWalk already owns the route in that state.
 *
 * Deliberately has no cleanup that clears the route: the editor and the
 * viewer can both have this mounted at once (panes bench rather than truly
 * unmount), and an unmount-time clear from one would wipe what the other
 * still wants shown. The single-caller version this replaced cleaned up via
 * bus.clearRoute(), which also nulls activeWalk — that is why closing the
 * walk editor used to kill an active saved walk. Real clears now only come
 * from an explicit action: activateWalk, deactivateWalk, clearRoute. */
export function usePublishPresentedRoute(bus: Bus, road: Stop[] | null): void {
  useEffect(() => {
    if (road === null) return
    bus.setRouteSteps(routeStepsOf(road))
    // bus is recreated every render; key only on the data that should retrigger
    // a publish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [road])
}

/** The drill path a presentation view owns for itself.
 *
 * Each instrument gets its OWN, so the columns and the stack can disagree about
 * which tier is open — they are independent read-only views over the same
 * road, not one shared controlled component. */
export function useDrill() {
  const [path, setPath] = useState<string[]>([])
  const pick = (col: number, s: Stop) =>
    setPath(isBox(s) ? [...path.slice(0, col), s.key] : path.slice(0, col))
  return { path, pick }
}
