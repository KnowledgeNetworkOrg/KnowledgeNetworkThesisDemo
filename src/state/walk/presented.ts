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
import type { ActiveWalkState } from '../../model/nav'
import type { RouteStep } from '../../model/route'
import type { Bus } from '../bus'

/** the draft currently open on the desk, resolved: every container down to one
 * variant, optionals in or out per the road's own toggle. Live — re-renders on
 * every edit, since useAuthorDraft/useRoad bind the draft's stores directly. */
export function usePresentedRoad(): Stop[] {
  const { stops } = useAuthorDraft()
  const { choices, withOptionals } = useRoad()
  return useMemo(() => resolveRoad(stops, choices, withOptionals), [stops, choices, withOptionals])
}

/** the slice of the bus the presented-route writer uses */
export type PublishedRouteBus = Pick<Bus, 'setRouteSteps' | 'activeWalk'>

/** What the editor should put on the bus: its road, or `null` when a saved walk
 * owns the route or this exact road is already published. The comparison is
 * serialized because `routeStepsOf` returns a fresh array every call. */
export function publishableRoad(
  road: Stop[],
  activeWalk: ActiveWalkState | null,
  lastPublished: RouteStep[] | null,
): Stop[] | null {
  if (activeWalk) return null
  return JSON.stringify(routeStepsOf(road)) === JSON.stringify(lastPublished) ? null : road
}

let lastPublished: RouteStep[] | null = null

/** Publishes the presented road onto the bus — WITH ITS GROUPS (#228, DS
 * OB-114): `bus.routeSteps` carries the tree, and `bus.route` is its flat
 * projection, so Map/Connections highlight it as before (#14, closed) and the
 * map's pins can number a group's nodes with the group's own step. Pass `null`
 * to opt out — the walk viewer does this while a saved walk is playing, since
 * activateWalk already owns the route in that state.
 *
 * A SAVED WALK ALSO SILENCES THE EDITOR, which opts into `dedup`. While
 * `activeWalk` is set the editor publishes nothing, so a remount on the way
 * back from the presenter, or a later draft edit, cannot overwrite the walk
 * loaded on the desk. Nor does it republish a road already sent: `lastPublished`
 * is the last one, so a remount changes neither the route nor the trail
 * (`setRouteSteps` marks the trail, and `mark` only dedups at the log's tip).
 * After the walk is cleared the route stays as the clear left it until the
 * draft's road actually changes.
 *
 * Without `dedup` the hook publishes whenever `road` is non-null and records
 * nothing, so the viewer can hand the draft back after "stop this walk".
 *
 * Deliberately has no cleanup that clears the route: the editor and the
 * viewer can both have this mounted at once (panes bench rather than truly
 * unmount), and an unmount-time clear from one would wipe what the other
 * still wants shown. The single-caller version this replaced cleaned up via
 * bus.clearRoute(), which also nulls activeWalk - that is why closing the
 * walk editor used to kill an active saved walk. Real clears now only come
 * from an explicit action: activateWalk, deactivateWalk, clearRoute. */
export function usePublishPresentedRoute(
  bus: PublishedRouteBus,
  road: Stop[] | null,
  { dedup = false }: { dedup?: boolean } = {},
): void {
  useEffect(() => {
    if (road === null) return
    if (!dedup) {
      bus.setRouteSteps(routeStepsOf(road))
      return
    }
    const publish = publishableRoad(road, bus.activeWalk, lastPublished)
    if (publish === null) return
    const steps = routeStepsOf(publish)
    lastPublished = steps
    bus.setRouteSteps(steps)
    // bus is recreated every render; key only on the data that should retrigger
    // a publish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [road, bus.activeWalk, dedup])
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
