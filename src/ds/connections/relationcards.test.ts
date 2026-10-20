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

  /* what `RelSourceGroup` spends beside the three boxes: border, padX, row pad, source pad and two
     gaps, plus 6 for the left bracket (2+ targets) and 6 for a right spine (a target with 2+ kinds) */
  const chromeOf = (bracket: boolean, spine: boolean) =>
    2 + REL_TIP_METRICS.padX * 2 + REL_CARD_METRICS.rowPad * 2 + 4 + REL_CARD_METRICS.rowGap * 2 + (bracket ? 6 : 0) + (spine ? 6 : 0)
  const fits = (f: { width: number; leftWidth: number; rightWidth: number; arrowWidth: number }, chrome: number) =>
    f.leftWidth + f.rightWidth + f.arrowWidth + chrome <= f.width && f.leftWidth >= REL_CARD_METRICS.pillMin && f.rightWidth >= REL_CARD_METRICS.pillMin

  it('the owner\'s via pair is sized by its names: wider than a short pair, within the cap', () => {
    const f = relTipFit({ sourceLabel: 'Graph Theory', sourcePathParts: ['Discrete Mathematics'], items: [target('Graph Representations')] })
    const short = relTipFit({ sourceLabel: 'AB', items: [target('CD')] })
    expect(short.width).toBe(REL_TIP_METRICS.minWidth)
    expect(f.width).toBeGreaterThan(short.width)
    expect(f.width).toBeLessThanOrEqual(REL_TIP_METRICS.maxWidth)
  })

  it('a group that draws BOTH the bracket and a spine budgets both, so no pill overhangs', () => {
    const f = relTipFit({ sourceLabel: 'Implication & Vacuous Truth', items: [
      { ...target('Tautologies & Contradictions'), key: 'a' },
      { ...target('Tautologies & Contradictions'), key: 'b', kindLabel: 'see also' },
      { ...target('Set Theory & Functions'), key: 'c' },
    ] })
    expect(f.width).toBe(REL_TIP_METRICS.maxWidth)
    expect(fits(f, chromeOf(true, true))).toBe(true)
  })

  it('a long source beside a short target keeps the floor without breaking the sum', () => {
    const f = relTipFit({ sourceLabel: 'Implication & Vacuous Truth, Tautologies & Contradictions', items: [target('Logic')] })
    expect(f.width).toBe(REL_TIP_METRICS.maxWidth)
    expect(f.rightWidth).toBe(REL_CARD_METRICS.pillMin)
    expect(fits(f, chromeOf(false, false))).toBe(true)
  })

  it('a kind label too long to draw whole leaves both pills their floor', () => {
    const f = relTipFit({ sourceLabel: 'Trees & Heaps', items: [{ ...target('File Systems'), kindLabel: 'implemented with a very long and unusual relation wording' }] })
    expect(f.arrowWidth).toBeLessThan(REL_TIP_METRICS.maxWidth)
    expect(fits(f, chromeOf(false, false))).toBe(true)
  })

  it('a narrow window gives the pills their floors before the connector', () => {
    const f = relTipFit({ sourceLabel: 'Trees & Heaps', items: [{ ...target('File Systems'), kindLabel: 'implemented with' }] }, 200)
    expect(f.width).toBe(REL_TIP_METRICS.minWidth)
    expect(fits(f, chromeOf(false, false))).toBe(true)
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
    const chrome = chromeOf(false, false)
    const maxLeft = Math.max(fitA.leftWidth, fitB.leftWidth)
    const maxRight = Math.max(fitA.rightWidth, fitB.rightWidth)
    const fit = relTipFitAcross([a, b])
    expect(maxLeft + maxRight + fit.arrowWidth + chrome).toBeGreaterThan(fit.width)
    expect(fits(fit, chrome)).toBe(true)
  })

  it('scales a long source ONCE: a short group with the same target changes nothing', () => {
    const a = { sourceLabel: 'Implication & Vacuous Truth', items: [target('Tautologies & Contradictions')] }
    const b = { sourceLabel: 'AB', items: [target('Tautologies & Contradictions')] }
    expect(relTipFitAcross([a, b])).toEqual(relTipFit(a))
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
