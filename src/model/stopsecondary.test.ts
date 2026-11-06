import { describe, expect, it } from 'vitest'

import { secondaryTagsAt } from './stopsecondary'

const tags = [{ id: 'x', label: 'Proof techniques', confidence: 'clear' as const }]
const walk = {
  stops: [
    { id: 'MSF-Discrete.T1' },
    { id: 'MSF-Discrete.T2' },
    { id: 'MSF-Discrete.T1', secondary: tags },
  ],
}

describe('secondaryTagsAt — a list belongs to a stop position, not a node', () => {
  it('shows the list at the stop that carries it', () => {
    expect(secondaryTagsAt(walk, 2, 'MSF-Discrete.T1')).toEqual(tags)
  })

  it('shows none at an earlier stop on the same node', () => {
    expect(secondaryTagsAt(walk, 0, 'MSF-Discrete.T1')).toBeUndefined()
  })

  it('shows none when the cursor is on another node', () => {
    expect(secondaryTagsAt(walk, 1, 'MSF-Discrete.T1')).toBeUndefined()
  })

  it('shows none without an active walk or cursor', () => {
    expect(secondaryTagsAt(null, 2, 'MSF-Discrete.T1')).toBeUndefined()
    expect(secondaryTagsAt(walk, undefined, 'MSF-Discrete.T1')).toBeUndefined()
  })
})
