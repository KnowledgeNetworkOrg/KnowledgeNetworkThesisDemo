// relcardheader.test.ts — the relationship card's two #342 changes, rendered.
//
// OB-242: a hover card holds ONE group, so its header is a sentence, and the plural and the
// word order are the component's (`groupHeaderSentence`) — never a call site's.
// OB-224: the left bracket follows the TARGET count, and when it is not drawn it takes no room.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { REL_CARD_PARTS, RelSourceGroup } from './RelationCards'
import type { RelItem } from './RelationCards'

const header = (props: { label: string; count: number; sentence?: boolean; onClick?: () => void }) =>
  renderToStaticMarkup(createElement(REL_CARD_PARTS.GroupHeader, props))

/** the header's visible words, read back the way a reader meets them: one run per element */
const words = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean).join(' ')

describe('groupHeaderSentence — the wording rule, owned by the component (OB-242)', () => {
  const s = REL_CARD_PARTS.groupHeaderSentence
  it('reads the three sentences the item names', () => {
    expect(s('direct', 1)).toBe('1 direct relationship')
    expect(s('direct', 7)).toBe('7 direct relationships')
    expect(s('via children', 42)).toBe('42 relationships via children')
  })
  it('"via children" trails the noun at every count, singular included', () => {
    expect(s('via children', 1)).toBe('1 relationship via children')
  })
})

describe('GroupHeader — the sentence form and the list form', () => {
  it('sentence: the count, then the rest of the sentence', () => {
    expect(words(header({ label: 'direct', count: 1, sentence: true }))).toBe('1 direct relationship')
    expect(words(header({ label: 'via children', count: 42, sentence: true }))).toBe('42 relationships via children')
  })

  it('the LIST header is unchanged — caps, the label, then the count', () => {
    const html = header({ label: 'direct', count: 3, onClick: () => {} })
    expect(html).toContain('text-transform:uppercase')
    expect(words(html)).toBe('direct 3')
    expect(html).not.toContain('data-rel-group-sentence')
  })
})

const item = (targetId: string, kind: string): RelItem => ({
  key: targetId + kind, targetId, targetTitle: targetId, kindLabel: kind, kindColor: 'var(--edge-mixed)', heads: 'out',
})
const group = (items: RelItem[]) =>
  renderToStaticMarkup(createElement(RelSourceGroup, { sourceLabel: 'Centre', items, leftWidth: 70, rightWidth: 70, arrowWidth: 60 }))

describe('RelSourceGroup — the bracket follows the TARGET count (OB-224)', () => {
  it('one target carrying two kinds draws NO left bracket', () => {
    expect(group([item('x', 'uses'), item('x', 'depends_on')])).not.toContain('data-rel-bracket')
  })

  it('and reserves no spacer in its place — the row closes up', () => {
    expect(group([item('x', 'uses')])).not.toContain('width:1px;flex-shrink:0"></div>')
  })

  it('two targets draw the bracket', () => {
    expect(group([item('x', 'uses'), item('y', 'uses')])).toContain('data-rel-bracket')
  })

  it("the right-hand spine is unchanged: still drawn for a target reached two ways", () => {
    expect(group([item('x', 'uses'), item('x', 'depends_on')])).toContain('align-self:stretch;margin:3px 1px')
  })
})
