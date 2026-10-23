// #481 — the pure half of the editor's route publish. `usePublishPresentedRoute`
// cannot be tested here (vitest runs `environment: 'node'`, there is no renderer),
// but the decision it makes can: which road, if any, may go on the bus while a
// saved walk is active or when the editor has already sent this exact road.

import { describe, expect, it } from 'vitest'

import type { ActiveWalkState } from '../../model/nav'
import { resolveRoad, routeStepsOf } from './mockwalk'
import type { Stop } from './mockwalk'
import { publishableRoad } from './presented'

/** real corpus topics — a road of leaves resolves without inventing a node */
const A = 'stk-dns-naming'
const B = 'stk-ip-routing'
const C = 'stk-tcp-udp'

const leaf = (node: string): Stop => ({ node, variants: [] })
const road = (...nodes: string[]): Stop[] => resolveRoad(nodes.map(leaf), {}, true)

const savedWalk: ActiveWalkState = { walkId: 'a-saved-walk', cursor: 0 }

describe('publishableRoad — a saved walk owns the route', () => {
  it('publishes nothing for a new road', () => {
    expect(publishableRoad(road(A, B), savedWalk, null)).toBeNull()
  })

  it('publishes nothing for an edited road', () => {
    expect(publishableRoad(road(A, B, C), savedWalk, routeStepsOf(road(A, B)))).toBeNull()
  })
})

describe('publishableRoad — a road already published', () => {
  it('publishes nothing for the same road, even as a fresh array', () => {
    expect(publishableRoad(road(A, B), null, routeStepsOf(road(A, B)))).toBeNull()
  })
})

describe('publishableRoad — a road that has changed', () => {
  it('publishes the road on the first publish, when nothing has been sent yet', () => {
    const first = road(A, B)
    expect(publishableRoad(first, null, null)).toBe(first)
  })

  it('publishes the road when there is no saved walk and it differs from the last publish', () => {
    const changed = road(A, B, C)
    expect(publishableRoad(changed, null, routeStepsOf(road(A, B)))).toBe(changed)
  })
})
