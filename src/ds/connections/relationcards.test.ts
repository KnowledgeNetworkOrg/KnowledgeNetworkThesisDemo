// #342 (OB-224, OB-242) — the two changes to the relationship card, pinned. Both are visible only
// at 1:1 and both fail QUIETLY: a header that reads "DIRECT 1" instead of a sentence, or a bracket
// that fences a source off from its only target, is a picture nobody is asserting.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { fitLines } from '../graph/NodeArrow'

import type { RelItem } from './RelationCards'
import { REL_CARD_METRICS, REL_CARD_PARTS, REL_TIP_METRICS, RelSourceGroup, relTipFit, relTipFitAcross } from './RelationCards'

const item = (targetId: string, key: string, kindLabel = 'uses'): RelItem => ({
  key, targetId, targetTitle: targetId.toUpperCase(), kindLabel, kindColor: 'var(--edge-uses)', heads: 'out',
})
const group = (items: RelItem[]) => renderToStaticMarkup(createElement(RelSourceGroup, {
  sourceLabel: 'Source', items, leftWidth: 80, rightWidth: 80, arrowWidth: 60, sourceIsCenter: true,
}))

describe('groupHeaderSentence — the plural and the word order are the component\'s (OB-242)', () => {
  const s = REL_CARD_PARTS.groupHeaderSentence

  it('reads "1 direct relationship" / "7 direct relationships"', () => {
    expect(s('direct', 1)).toBe('1 direct relationship')
    expect(s('direct', 7)).toBe('7 direct relationships')
  })

  it('"via children" is a PLACE, so it trails the noun', () => {
    expect(s('via children', 42)).toBe('42 relationships via children')
    expect(s('via children', 1)).toBe('1 relationship via children')
  })
})

describe('the group header — a sentence in a card, caps and count in a list', () => {
  const Header = REL_CARD_PARTS.GroupHeader

  it('with `sentence` it reads as one sentence, and carries it whole for a driver', () => {
    const html = renderToStaticMarkup(createElement(Header, { sentence: true, label: 'direct', count: 1 }))
    expect(html).toContain('data-rel-sentence="1 direct relationship"')
    expect(html).not.toContain('text-transform:uppercase')
  })

  it('without it the LIST header is unchanged: uppercase, tracked, the count beside it, no sentence', () => {
    const html = renderToStaticMarkup(createElement(Header, { label: 'direct', count: 3 }))
    expect(html).toContain('text-transform:uppercase')
    expect(html).not.toContain('data-rel-sentence')
  })
})

describe('relTipFit — the hover card is sized to its names (OB-272)', () => {
  const target = (title: string): RelItem => ({ ...item(title, title), targetTitle: title })

  it('the owner\'s via pair fits between the card\'s floor and its cap', () => {
    const f = relTipFit({ sourceLabel: 'Graph Theory', sourcePathParts: ['Discrete Mathematics'], items: [target('Graph Representations')] })
    expect(f.width).toBeGreaterThanOrEqual(REL_TIP_METRICS.minWidth)
    expect(f.width).toBeLessThanOrEqual(REL_TIP_METRICS.maxWidth)
  })

  it('the longest corpus pair stops exactly at the cap', () => {
    const f = relTipFit({ sourceLabel: 'Implication & Vacuous Truth', items: [target('Tautologies & Contradictions')] })
    expect(f.width).toBe(REL_TIP_METRICS.maxWidth)
  })

  it('is published beside the group header', () => {
    expect(REL_CARD_PARTS.tipFit).toBe(relTipFit)
  })

  it('widens the connector so a kind label is not cut', () => {
    const f = relTipFit({ sourceLabel: 'Trees & Heaps', items: [{ ...target('File Systems'), kindLabel: 'implemented with' }] })
    expect(f.arrowWidth).toBeGreaterThan(REL_TIP_METRICS.arrow)
    expect(fitLines('implemented with', f.arrowWidth, { fontPx: 9, pad: 0 }).join('').replace(/\s+/g, '')).toBe('implementedwith')
  })

  it('shares one width across groups and rescales the shared pills so no row overhangs it', () => {
    const a = { sourceLabel: 'Regular Expressions & Automata', items: [target('Set Theory & Functions')] }
    const b = { sourceLabel: 'AB', items: [target('Discrete Mathematics & Graphs')] }
    const fitA = relTipFit(a)
    const fitB = relTipFit(b)
    /* the field-by-field maxima alone are wider than the card: this is the case the rescale exists
       for, and the first assertion watches it stay a real case rather than a vacuous one */
    const chrome = 2 + REL_TIP_METRICS.padX * 2 + REL_CARD_METRICS.rowPad * 2 + 4 + REL_CARD_METRICS.rowGap * 2
    const maxLeft = Math.max(fitA.leftWidth, fitB.leftWidth)
    const maxRight = Math.max(fitA.rightWidth, fitB.rightWidth)
    const fit = relTipFitAcross([a, b])
    expect(maxLeft + maxRight + fit.arrowWidth + chrome).toBeGreaterThan(fit.width)
    expect(fit.leftWidth + fit.rightWidth + fit.arrowWidth + chrome).toBeLessThanOrEqual(fit.width)
  })
})

describe('RelSourceGroup — the left bracket follows the TARGET count, not the item count (OB-224)', () => {
  it('one target carrying two kinds draws NO bracket: the spine already holds those arrows', () => {
    const html = group([item('t1', 'a', 'uses'), item('t1', 'b', 'see also')])
    expect(html).not.toContain('data-rel-bracket')
    // …and the right-hand spine is unchanged: it is per target, and there is one stack to collect
    expect(html).toContain('width:1px;background')
  })

  it('two targets draw the bracket: it holds a stack of blocks against one source', () => {
    const html = group([item('t1', 'a'), item('t2', 'b')])
    expect(html).toContain('data-rel-bracket')
  })

  it('a stack of blocks each with several kinds still draws it once', () => {
    const html = group([item('t1', 'a'), item('t1', 'b'), item('t2', 'c')])
    expect((html.match(/data-rel-bracket/g) ?? []).length).toBe(1)
  })

  it('when it is not drawn it takes NO room — no zero-width spacer holds its place', () => {
    // one target, one kind: no bracket and no spine, so no 1px element of any kind may remain
    const html = group([item('t1', 'a')])
    expect(html).not.toContain('data-rel-bracket')
    expect(html).not.toContain('width:1px')
  })
})
