import { describe, expect, it } from 'vitest'
import { HUE_RING, TOPIC_WALK, nextTopicSlot, topicHue } from '@/ds/values'
import { byId, domainIds, topicHueOf, topicIds } from '../corpus/graph'
import { createTopic, deleteTopic, hueNamesOf, renameTopic, type TopicRecord } from './topichue'

/* OB-153 — a topic's colour is a POSITION, not an identity. These are the item's own clauses:
 * (2) creating a topic assigns the next free hue and stores it; (3) a rename keeps it, a delete
 * frees it; (7) two graphs with different topic NAMES but the same creation ORDER render the
 * same hues, in order — the assertion that cannot pass if a name→hue mapping survives anywhere;
 * (8) a graph reloaded (serialised and parsed) renders identical colours; (5) the demo corpus
 * ships with its slots saved on its topics. */

const build = (titles: string[]): TopicRecord[] => titles.reduce<TopicRecord[]>((g, t, i) => createTopic(g, 't' + i, t), [])

describe('OB-153 — a topic is handed a ring hue by creation order, and keeps it', () => {
  it('(2) creation assigns the next free hue along the walk and writes it onto the topic', () => {
    const g = build(['Alpha', 'Beta', 'Gamma'])
    expect(hueNamesOf(g)).toEqual([topicHue(0), topicHue(1), topicHue(2)])
    /* the walk, not the ring's reading order: the first three sit 80°+ apart, not three warm reds */
    expect(hueNamesOf(g)).toEqual([HUE_RING[TOPIC_WALK[0]], HUE_RING[TOPIC_WALK[1]], HUE_RING[TOPIC_WALK[2]]])
    expect(hueNamesOf(g)).not.toEqual(HUE_RING.slice(0, 3))
  })

  it('(7) two graphs with different NAMES and the same creation ORDER render the same hues, in order', () => {
    const cs = build(['Computer Systems', 'Mathematical Foundations', 'Core Computer Science', 'Networking', 'Security', 'Software Engineering'])
    const recipes = build(['Bread', 'Soups', 'Pastry', 'Preserves', 'Roasts', 'Salads'])
    expect(hueNamesOf(recipes)).toEqual(hueNamesOf(cs))
    /* and the ORDER is what decides: the same six names created in another order get other hues */
    const reordered = build(['Security', 'Computer Systems', 'Networking', 'Mathematical Foundations', 'Software Engineering', 'Core Computer Science'])
    expect(hueNamesOf(reordered)).toEqual(hueNamesOf(cs))
    expect(reordered.find((t) => t.title === 'Security')!.hue).not.toBe(cs.find((t) => t.title === 'Security')!.hue)
  })

  it('(3) a rename keeps the colour; a delete frees the hue for the next topic created', () => {
    let g = build(['Alpha', 'Beta', 'Gamma'])
    const beta = g[1].hue
    g = renameTopic(g, 't1', 'Bravo')
    expect(g[1]).toEqual({ id: 't1', title: 'Bravo', hue: beta })
    g = deleteTopic(g, 't1')
    expect(hueNamesOf(g)).not.toContain(beta)
    g = createTopic(g, 't3', 'Delta')
    /* the freed hue is reissued — the walk's first unused position, which is Beta's old one */
    expect(g[g.length - 1].hue).toBe(beta)
    expect(nextTopicSlot(hueNamesOf(g))).toEqual({ n: 3, hue: topicHue(3) })
  })

  it('(8) a graph serialised and parsed renders identical colours — the hue is data on the topic', () => {
    const g = build(['Alpha', 'Beta', 'Gamma', 'Delta'])
    const reloaded = JSON.parse(JSON.stringify(g)) as TopicRecord[]
    expect(hueNamesOf(reloaded)).toEqual(hueNamesOf(g))
    /* and creating on the reloaded graph continues the walk rather than restarting it */
    expect(createTopic(reloaded, 't4', 'Epsilon')[4].hue).toBe(topicHue(4))
  })

  it('past sixteen the walk wraps: the 17th topic takes the 1st topic\'s hue (a real answer, not a gap)', () => {
    const g = build(Array.from({ length: 17 }, (_, i) => 'T' + i))
    expect(g[16].hue).toBe(g[0].hue)
    expect(new Set(hueNamesOf(g)).size).toBe(16)
  })
})

describe('OB-153 (5) — the demo corpus ships with its slots saved on its topics', () => {
  it('each of the six domains carries a stored ring hue, chosen to sit near the old look', () => {
    const stored = domainIds.map((d) => byId.get(d)!.hue)
    expect(stored).toEqual(['leaf', 'violet', 'iris', 'river', 'amber', 'fern'])
    for (const h of stored) expect(HUE_RING).toContain(h)
  })

  it('every topic in the corpus resolves to its domain\'s stored hue — a field, not a lookup by name', () => {
    for (const id of topicIds) expect(HUE_RING, id).toContain(topicHueOf(id))
    const withoutHue = domainIds.filter((d) => !byId.get(d)!.hue)
    expect(withoutHue).toEqual([])
  })

  it('a node below the top level carries no hue of its own: it inherits its domain\'s', () => {
    for (const id of topicIds) expect(byId.get(id)!.hue).toBeUndefined()
  })
})
