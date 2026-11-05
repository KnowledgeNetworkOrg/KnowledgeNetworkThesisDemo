// The presenter's bus view is a pure function for the same reason playback's
// arithmetic is: vitest here runs `environment: 'node'`, so a hook cannot be
// rendered. The view can be asked directly whether it leaves the desk alone.

import { describe, expect, it, vi } from 'vitest'

import { presenterBus } from './presenterbus'
import type { PresenterScreenBus } from './PresenterScreen'

const TOPIC = 'stk-dns-naming'
const OTHER = 'stk-ip-routing'

function deskBus() {
  const route = [TOPIC, OTHER]
  const trail = [{ id: TOPIC, via: 'map' as const, jump: false }]
  const writers = {
    setFocus: vi.fn(),
    clearFocus: vi.fn(),
    activateWalk: vi.fn(),
    setDraftCursor: vi.fn(),
    setHover: vi.fn(),
    endHover: vi.fn(),
  }
  const bus = {
    ...writers,
    focus: OTHER,
    hover: null,
    hoverStep: null,
    hoverCenter: false,
    peek: null,
    matches: new Set<string>(),
    route,
    routeSteps: [],
    history: { log: trail, stack: [TOPIC], cursor: 0 },
    trail,
    activeWalk: null,
    draftCursor: 3,
  } as unknown as PresenterScreenBus
  return { bus, writers, route, trail }
}

describe('presenterBus — the presenter reads the desk but never writes it', () => {
  it('calls none of the desk\'s writers from any of the view\'s six', () => {
    const { bus, writers } = deskBus()
    const view = presenterBus(bus, 'walk-a')
    view.setFocus(TOPIC, 'walk')
    view.clearFocus()
    view.activateWalk('walk-a', 2)
    view.setDraftCursor(4)
    view.setHover(TOPIC)
    view.endHover(TOPIC)
    for (const writer of Object.values(writers)) expect(writer).not.toHaveBeenCalled()
  })

  it('gives the presenter the walk it was handed, at the start; no walk means the draft road', () => {
    const { bus } = deskBus()
    expect(presenterBus(bus, 'walk-a').activeWalk).toEqual({ walkId: 'walk-a', cursor: 0 })
    expect(presenterBus(bus, null).activeWalk).toBeNull()
    expect(presenterBus(bus, undefined).activeWalk).toBeNull()
    expect(presenterBus(bus, 'walk-a').draftCursor).toBe(0)
  })

  it('passes the read members through untouched', () => {
    const { bus, route, trail } = deskBus()
    const view = presenterBus(bus, 'walk-a')
    expect(view.focus).toBe(bus.focus)
    expect(view.route).toBe(route)
    expect(view.trail).toBe(trail)
  })

  it('gives the view the lecture\'s own route when the lecture has its own walk', () => {
    const { bus } = deskBus()
    const view = presenterBus(bus, 'walk-a', [{ id: TOPIC }, { id: OTHER, optional: true }])
    expect(view.route).toEqual([TOPIC, OTHER])
    expect(view.routeSteps).toEqual([{ node: TOPIC }, { node: OTHER, optional: true }])
  })
})
