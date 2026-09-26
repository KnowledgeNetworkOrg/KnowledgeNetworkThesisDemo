// #345 (DS OB-199) — the hover card is the stop's DOCUMENT, not its name.
//
// The owner's report was a card reading `1.2 · Transistors & Logic Gates` and nothing
// else: the old host printed the walk's note under the name, and that stop had none. So
// the check that matters is OB-199 clause (3)'s own: a stop with NO walk note still gets a
// card that says more than its heading. That `data-stop-card` exists proves nothing — the
// broken card had a wrapper too.
//
// The stops are derived from the loaded corpus, never named by id, so this file does not
// pin a node that only one corpus has.

import { renderToStaticMarkup } from 'react-dom/server'
import { Fragment, createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { DOC_BODY } from '../../corpus/docs'
import { byId, nodes, pathTo, ROOT_ID } from '../../corpus/graph'
import { renderStopPreview, stopPlacement } from './stoppreview'

const draw = (...args: Parameters<typeof renderStopPreview>) => renderToStaticMarkup(createElement(Fragment, null, renderStopPreview(...args)))
const text = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
/** the heading's own text — the address and the name, nothing under them */
const head = (html: string) => text(/<div data-stop-card-head=""[^>]*>(.*?)<\/div>/.exec(html)![1])

/* a stop three containers deep — root › domain › module › the node — so its placement line
   has two parts to join and both ends to leave out */
const deep = nodes.find((n) => pathTo(n.id).length >= 4)!
const stepOf = (id: string) => ({ id, title: byId.get(id)!.title })

describe('renderStopPreview — the card carries the document, not just the name', () => {
  it('a stop with no walk note still says more than its heading (OB-199 clause 3)', () => {
    const html = draw(stepOf(deep.id), 1)
    expect(html).toContain('data-stop-card')
    expect(text(html).length).toBeGreaterThan(head(html).length + 20)
    expect(text(html)).toContain(text(DOC_BODY[deep.id]).slice(0, 20))
  })

  it('leads with the address the surface counts, and a grouped stop with its full path', () => {
    expect(head(draw(stepOf(deep.id), 1))).toBe(`2 · ${deep.title}`)
    expect(head(draw({ ...stepOf(deep.id), path: [1, 2] }, 5))).toBe(`1.2 · ${deep.title}`)
    // no index, no path: the name alone, never a made-up number
    expect(head(draw(stepOf(deep.id)))).toBe(deep.title)
  })

  it("carries the walk's note when there is one, and the document still follows it", () => {
    const html = text(draw({ ...stepOf(deep.id), note: 'why this walk comes here' }, 0))
    expect(html).toContain('why this walk comes here')
    expect(html).toContain(text(DOC_BODY[deep.id]).slice(0, 20))
  })

  it('a merged pin counts its other stops from the card itself, once', () => {
    const html = draw(stepOf(deep.id), 3, { from: 2, to: 4, label: '1.2–1.4', addresses: ['1.2', '1.3', '1.4'] })
    expect(html.match(/data-stop-card-more/g)).toHaveLength(1)
    expect(text(html)).toContain('1.2–1.4 · +2 more stops under this pin')
    // the lead stop reads the PIN's address for itself, not its flat position
    expect(head(html)).toBe(`1.3 · ${deep.title}`)
  })

  it('a one-stop card has no footer', () => {
    expect(draw(stepOf(deep.id), 0)).not.toContain('data-stop-card-more')
  })

  it('no 11px prose and no local 220px cap beside the published 264 (OB-199 clause 4)', () => {
    const html = draw({ ...stepOf(deep.id), note: 'a note' }, 0, { from: 0, to: 1, label: '1–2' })
    // the styles, not the prose: a document is free to mention "220"
    const styles = (html.match(/style="[^"]*"/g) ?? []).join(' ')
    expect(styles).not.toMatch(/font-size:11px/)
    expect(styles).not.toMatch(/width:220px/)
    expect(html).not.toMatch(/class="/) // no utility classes beside the card's own styles
    expect(styles).toContain('width:264px')
  })

  it('draws nothing for a step that is not there (a strip mid-edit)', () => {
    expect(renderStopPreview(undefined, 3)).toBeNull()
  })
})

describe('stopPlacement — the containment path with the root and the node left out', () => {
  it('joins the ancestors between the root and the node', () => {
    const middle = pathTo(deep.id).slice(1, -1).map((id) => byId.get(id)!.title)
    expect(middle.length).toBeGreaterThanOrEqual(2)
    expect(stopPlacement(deep.id)).toBe(middle.join(' › '))
  })

  it('never names the root or the node itself', () => {
    const place = stopPlacement(deep.id)
    expect(place.startsWith(byId.get(ROOT_ID)!.title)).toBe(false)
    expect(place.endsWith(deep.title)).toBe(false)
  })

  it('is empty for a domain, whose only ancestor is the root — and the card then draws no line for it', () => {
    const domain = nodes.find((n) => pathTo(n.id).length === 2)!
    expect(stopPlacement(domain.id)).toBe('')
  })
})
