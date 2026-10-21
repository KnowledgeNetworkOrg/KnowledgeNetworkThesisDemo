import { describe, expect, it } from 'vitest'

import { listWalks } from '../state/walkstore'
import { applyLoadChoice } from './loadpick'

function fakeTargets() {
  const calls: string[] = []
  return {
    calls,
    targets: {
      clearRoute: () => calls.push('clearRoute'),
      activateWalk: (id: string, at: number) => calls.push(`activateWalk:${id}:${at}`),
      setFocus: (id: string, via: 'walk') => calls.push(`setFocus:${id}:${via}`),
    },
  }
}

describe('applyLoadChoice — a map alone versus a walk on it', () => {
  it('a map-only pick clears the route and activates nothing', () => {
    const { calls, targets } = fakeTargets()
    applyLoadChoice(targets, { mapId: 'root' })
    expect(calls).toEqual(['clearRoute'])
  })

  it('a walk pick activates the walk at its first stop and focuses it', () => {
    const walk = listWalks()[0]
    const { calls, targets } = fakeTargets()
    applyLoadChoice(targets, { mapId: 'root', walkId: walk.id })
    expect(calls).toEqual([`activateWalk:${walk.id}:0`, `setFocus:${walk.stops[0].id}:walk`])
  })

  it('an id the registry does not know leaves everything alone', () => {
    const { calls, targets } = fakeTargets()
    applyLoadChoice(targets, { mapId: 'root', walkId: 'no-such-walk' })
    expect(calls).toEqual([])
  })
})
