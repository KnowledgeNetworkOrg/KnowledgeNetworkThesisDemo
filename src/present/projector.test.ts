import { describe, expect, it } from 'vitest'

import { isProjectorLocation, isProjectorMessage, NOTHING_PROJECTED, receiveProjection } from './projector'
import type { ProjectedState } from './projector'

/* #267 (DS OB-135 clauses 2/3, #197) — the projector protocol, the pure half. The hooks need a
 * BroadcastChannel and two windows; a browser test drives those. */

const live: ProjectedState = { live: true, slide: { id: 'x', title: 'X', territory: 'T', hue: 'amber', document: 'the node’s document', note: 'n', walk: 'w' }, stop: 3, count: 7, mapUp: false, ids: ['x'], optional: [true], covered: [0, 1] }

describe('receiveProjection — what the room holds after each message', () => {
  it('a state replaces whatever was there', () => {
    expect(receiveProjection(NOTHING_PROJECTED, { kind: 'state', state: live })).toBe(live)
  })
  it('close darkens the wall', () => {
    expect(receiveProjection(live, { kind: 'close' })).toBe(NOTHING_PROJECTED)
  })
  it('the handshake words carry nothing', () => {
    expect(receiveProjection(live, { kind: 'connect' })).toBe(live)
    expect(receiveProjection(live, { kind: 'connected' })).toBe(live)
  })
})

describe('isProjectorMessage — a stranger on the channel is not a slide', () => {
  it('accepts the four kinds and nothing else', () => {
    expect(isProjectorMessage({ kind: 'connect' })).toBe(true)
    expect(isProjectorMessage({ kind: 'state', state: live })).toBe(true)
    expect(isProjectorMessage({ kind: 'seek', to: 4 })).toBe(false)
    expect(isProjectorMessage('state')).toBe(false)
    expect(isProjectorMessage(null)).toBe(false)
  })
})

describe('isProjectorLocation — the one route this app has', () => {
  it('reads the flag off the query string', () => {
    expect(isProjectorLocation('?projector')).toBe(true)
    expect(isProjectorLocation('?projector=1&x=2')).toBe(true)
    expect(isProjectorLocation('')).toBe(false)
    expect(isProjectorLocation('?present')).toBe(false)
  })
})
