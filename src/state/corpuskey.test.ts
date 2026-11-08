import { describe, expect, it } from 'vitest'

import { corpusKey } from './corpuskey'

describe('corpusKey — saved work is kept per dataset', () => {
  it('leaves teaching on today\'s key, so work saved before the switch is still read', () => {
    expect(corpusKey('pkt.walks.saved', 'teaching')).toBe('pkt.walks.saved')
    expect(corpusKey('pkt.walkdesk.draft', 'teaching')).toBe('pkt.walkdesk.draft')
  })

  it('gives cs2023 a key of its own', () => {
    expect(corpusKey('pkt.walks.saved', 'cs2023')).toBe('pkt.walks.saved:cs2023')
    expect(corpusKey('pkt.walkdesk.draft', 'cs2023')).toBe('pkt.walkdesk.draft:cs2023')
    expect(corpusKey('pkt.walks.saved', 'cs2023')).not.toBe(corpusKey('pkt.walks.saved', 'teaching'))
  })

  it('asks the loaded corpus when none is given, which is teaching under plain node', () => {
    expect(corpusKey('pkt.walks.saved')).toBe('pkt.walks.saved')
  })
})
