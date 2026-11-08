// WHICH CORPUS A PAGE OPENS ON — the address, then the build, then teaching.
// `CORPUS_NAME` itself is read once at import, so the rule lives in a pure
// function and this asks it directly.

import { describe, expect, it } from 'vitest'

import { CORPUS_NAME, CORPUS_NAMES, parseCorpusName } from './graph'

describe('parseCorpusName — the address wins, then the build, then teaching', () => {
  it('opens teaching when the address names nothing and the build says nothing', () => {
    expect(parseCorpusName('')).toBe('teaching')
    expect(parseCorpusName('?')).toBe('teaching')
    expect(parseCorpusName('?projector')).toBe('teaching')
  })

  it('takes a corpus the address names', () => {
    expect(parseCorpusName('?corpus=cs2023')).toBe('cs2023')
    expect(parseCorpusName('?corpus=teaching')).toBe('teaching')
  })

  it('finds the value among other query values', () => {
    expect(parseCorpusName('?projector&corpus=cs2023')).toBe('cs2023')
    expect(parseCorpusName('?a=1&corpus=cs2023&b=2')).toBe('cs2023')
  })

  it('lets an unknown value fall through to the build, then to teaching', () => {
    expect(parseCorpusName('?corpus=nonsense')).toBe('teaching')
    expect(parseCorpusName('?corpus=courses')).toBe('teaching')
    expect(parseCorpusName('?corpus=')).toBe('teaching')
    expect(parseCorpusName('?corpus=nonsense', 'cs2023')).toBe('cs2023')
    expect(parseCorpusName('?corpus=courses', 'cs2023')).toBe('cs2023')
  })

  it('matches the names exactly, in lower case', () => {
    expect(parseCorpusName('?corpus=CS2023')).toBe('teaching')
    expect(parseCorpusName('?corpus=Cs2023')).toBe('teaching')
    expect(parseCorpusName('?corpus=cs2023 ')).toBe('teaching')
  })

  it('uses the build default when the address names nothing', () => {
    expect(parseCorpusName('', 'cs2023')).toBe('cs2023')
    expect(parseCorpusName('?projector', 'cs2023')).toBe('cs2023')
    expect(parseCorpusName('', 'teaching')).toBe('teaching')
  })

  it('ignores a build default that is not a known corpus', () => {
    expect(parseCorpusName('', 'courses')).toBe('teaching')
    expect(parseCorpusName('', '')).toBe('teaching')
  })

  it('lets the address beat the build either way', () => {
    expect(parseCorpusName('?corpus=teaching', 'cs2023')).toBe('teaching')
    expect(parseCorpusName('?corpus=cs2023', 'teaching')).toBe('cs2023')
  })
})

describe('CORPUS_NAMES', () => {
  it('lists the two corpora the header switch draws, teaching first', () => {
    expect(CORPUS_NAMES).toEqual(['teaching', 'cs2023'])
  })

  it('loads as teaching under plain node, where there is no address', () => {
    expect(CORPUS_NAME).toBe('teaching')
  })
})
