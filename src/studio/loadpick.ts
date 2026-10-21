import type { LoadChoice } from '@/ds'

import { walkById } from '../state/walkstore'

/** the bus calls a Load pick makes: no camera, focus or selection beyond the walk's own first stop */
export interface LoadPickTargets {
  clearRoute(): void
  activateWalk(walkId: string, stopIndex: number): void
  setFocus(id: string, via: 'walk'): void
}

/** a map-only pick clears the walk; a walk pick activates it at its first stop */
export function applyLoadChoice(targets: LoadPickTargets, choice: LoadChoice): void {
  if (choice.walkId == null) {
    targets.clearRoute()
    return
  }
  if (typeof choice.walkId !== 'string') return
  const w = walkById(choice.walkId)
  if (!w) return
  targets.activateWalk(w.id, 0)
  if (w.stops[0]) targets.setFocus(w.stops[0].id, 'walk')
}
