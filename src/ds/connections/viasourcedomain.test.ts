import { describe, expect, it } from 'vitest'

import { viaSourceDomain } from './RelationCards'

/* OB-211's rule, pinned where it cannot be seen in a screenshot: the failure it fixes was a
   SILENT wrong colour (an unresolvable topic answers the anchor fallback by design, so the
   wrong field read as a deliberate grey). */
describe('viaSourceDomain — the pill picks a NODE, never a domain', () => {
  it('a descendant with its own topic draws its OWN colour', () => {
    expect(viaSourceDomain({ domain: 'leaf' }, 'violet')).toBe('leaf')
  })

  it("a descendant with no topic of its own falls back to the SELECTED node's", () => {
    expect(viaSourceDomain({}, 'violet')).toBe('violet')
    expect(viaSourceDomain({ domain: undefined }, 'violet')).toBe('violet')
  })

  it('a missing entry falls back rather than throwing', () => {
    expect(viaSourceDomain(undefined, 'violet')).toBe('violet')
  })
})
