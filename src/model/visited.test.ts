import { describe, expect, it } from 'vitest'

import { visitedIds } from './visited'

const nodes: Record<string, { topic?: boolean }> = {
  topic: { topic: true },
  area: {},
  deep: {},
}

const lookup = (id: string) => nodes[id]
const log = [{ id: 'topic' }, { id: 'area' }, { id: 'deep' }, { id: 'topic' }, { id: 'missing' }]

describe('visitedIds — the places a trail counts', () => {
  it('counts topics only on a topic corpus', () => {
    expect(visitedIds(log, 'teaching', lookup)).toEqual(['topic'])
  })

  it('counts every real place on cs2023, areas and deeper included', () => {
    expect(visitedIds(log, 'cs2023', lookup)).toEqual(['topic', 'area', 'deep'])
  })

  it('drops ids the corpus does not hold, and returns each place once', () => {
    expect(visitedIds([{ id: 'missing' }], 'cs2023', lookup)).toEqual([])
    expect(visitedIds([], 'teaching', lookup)).toEqual([])
  })
})
