import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppToolbar } from './AppToolbar'

const buttonFor = (html: string, title: string): string | undefined =>
  html.match(new RegExp('<button[^>]*title="' + title + '"[^>]*>'))?.[0]

describe('AppToolbar — the Load item needs a host to load with', () => {
  it('renders disabled without `load`', () => {
    const tag = buttonFor(renderToStaticMarkup(createElement(AppToolbar)), 'Load')
    expect(tag).toBeDefined()
    expect(tag).toContain('disabled')
  })

  it('is enabled when `load` is passed', () => {
    const tag = buttonFor(
      renderToStaticMarkup(createElement(AppToolbar, { load: { maps: [], onPick: () => {} } })),
      'Load',
    )
    expect(tag).toBeDefined()
    expect(tag).not.toContain('disabled')
  })
})
