// panevacancy.test.ts — the two rows a pane draws around an absence (#342, DS OB-209).
//
// `PreviewBanner`'s whole reason to be a component is its HEIGHT: the row is there, at the same
// height, whether or not anything is previewed, so a preview arriving never moves the pane under
// a cursor that is somewhere else. `PanePlaceholder`'s is its SECOND LINE: `gesture` for a way
// out, `note` for an absence with none, and `gesture` wins when both are given.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PanePlaceholder } from './PanePlaceholder'
import { PREVIEW_BANNER_METRICS, PreviewBanner } from './PreviewBanner'

const banner = (node: { id?: string; title: string; domain?: string } | null) => renderToStaticMarkup(createElement(PreviewBanner, { node }))

describe('PreviewBanner — the slot is always there', () => {
  it('draws the same fixed height with nothing previewed as with something', () => {
    const h = `height:${PREVIEW_BANNER_METRICS.height}px`
    expect(banner(null)).toContain(h)
    expect(banner({ id: 'n1', title: 'Algorithms' })).toContain(h)
  })

  it('empty, it says nothing; previewing, it names the node and the gesture that ends it', () => {
    // the hook is on the resting row too (OB-209's done-when looks for it there), empty-valued
    expect(banner(null)).toContain('data-preview-banner=""')
    expect(banner(null)).not.toContain('>preview<')
    const html = banner({ id: 'n1', title: 'Algorithms' })
    expect(html).toContain('data-preview-banner="n1"')
    expect(html).toContain('Algorithms')
    expect(html).toContain('click to select it')
  })
})

describe('PanePlaceholder — the state, then the right second line', () => {
  const draw = (props: { state: string; gesture?: string; note?: string }) => renderToStaticMarkup(createElement(PanePlaceholder, props))

  it('draws the state and its gesture', () => {
    const html = draw({ state: 'Nothing chosen', gesture: 'Point at a cell' })
    expect(html).toContain('data-pane-placeholder')
    expect(html).toContain('Nothing chosen')
    expect(html).toContain('Point at a cell')
  })

  it('a note stands in for the gesture when there is no way out', () => {
    expect(draw({ state: 'No relationships', note: 'Nothing connects to this node' })).toContain('Nothing connects to this node')
  })

  it('gesture wins if a caller passes both', () => {
    const html = draw({ state: 's', gesture: 'do this', note: 'a fact' })
    expect(html).toContain('do this')
    expect(html).not.toContain('a fact')
  })
})
