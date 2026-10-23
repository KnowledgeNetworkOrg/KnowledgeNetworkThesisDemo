import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Draft from './authordraft'

type DraftModule = typeof Draft

function probe(mod: DraftModule): { draft: Draft.AuthorState; unsaved: string | undefined } {
  let seen: { draft: Draft.AuthorState; unsaved: string | undefined } | null = null
  const Probe = () => {
    seen = { draft: mod.useAuthorDraft(), unsaved: mod.useDraftUnsaved() }
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return seen!
}

function stubStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  })
}

describe('useDraftUnsaved — edits since the baseline', () => {
  beforeEach(() => {
    vi.resetModules()
    stubStore()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('an edit is dirty and undo back to the baseline is clean', async () => {
    const mod = await import('./authordraft')
    expect(probe(mod).unsaved).toBeUndefined()

    probe(mod).draft.insertNode('stk-dns-naming')
    expect(probe(mod).unsaved).toBe('The walk draft')

    mod.undoDraft()
    expect(probe(mod).unsaved).toBeUndefined()
  })

  it('saving the draft as a walk makes it clean again', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')
    expect(probe(mod).unsaved).toBe('The walk draft')

    expect(mod.saveDraftAsWalk('')).not.toBeNull()
    expect(probe(mod).unsaved).toBeUndefined()
  })

  it('loading without saving leaves the draft as it is and stops warning about it', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')
    const edited = probe(mod).draft.stops
    expect(probe(mod).unsaved).toBe('The walk draft')

    mod.forgetDraftUnsaved()
    expect(probe(mod).draft.stops).toBe(edited)
    expect(probe(mod).unsaved).toBeUndefined()
  })

  it('a draft with no stops left is not unsaved, since a save would keep nothing', async () => {
    vi.resetModules()
    stubStore({
      'pkt.walkdesk.draft': JSON.stringify({
        v: 1,
        data: { stops: [{ node: 'stk-dns-naming', variants: [] }], choices: {}, withOptionals: true },
      }),
    })

    const mod = await import('./authordraft')
    probe(mod).draft.deleteAt([0])
    expect(probe(mod).draft.stops).toHaveLength(0)
    expect(probe(mod).unsaved).toBeUndefined()
    expect(mod.saveDraftAsWalk('')).toBeNull()
  })

  it('a restored draft starts clean', async () => {
    vi.resetModules()
    stubStore({
      'pkt.walkdesk.draft': JSON.stringify({
        v: 1,
        data: { stops: [{ node: 'stk-dns-naming', variants: [] }], choices: {}, withOptionals: true },
      }),
    })

    const mod = await import('./authordraft')
    const first = probe(mod)
    expect(first.draft.stops).toHaveLength(1)
    expect(first.draft.stops[0].node).toBe('stk-dns-naming')
    expect(first.unsaved).toBeUndefined()
  })

  it('an edit made before a reload is still unsaved after it', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')
    expect(probe(mod).unsaved).toBe('The walk draft')

    vi.resetModules()
    const reloaded = await import('./authordraft')
    expect(probe(reloaded).draft.stops.length).toBeGreaterThan(1)
    expect(probe(reloaded).unsaved).toBe('The walk draft')
  })

  it('undo after a reload does not step back into a saved state', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')

    vi.resetModules()
    const reloaded = await import('./authordraft')
    probe(reloaded).draft.insertNode('stk-ip-routing')
    reloaded.undoDraft()
    expect(probe(reloaded).unsaved).toBe('The walk draft')
  })

  it('saving as a walk before a reload keeps the restored draft clean', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')
    expect(mod.saveDraftAsWalk('')).not.toBeNull()

    vi.resetModules()
    const reloaded = await import('./authordraft')
    expect(probe(reloaded).unsaved).toBeUndefined()
  })

  it('loading without saving before a reload keeps the restored draft clean', async () => {
    const mod = await import('./authordraft')
    probe(mod).draft.insertNode('stk-dns-naming')
    mod.forgetDraftUnsaved()

    vi.resetModules()
    const reloaded = await import('./authordraft')
    expect(probe(reloaded).unsaved).toBeUndefined()
  })

  it('a restored unsaved draft with every stop deleted is not unsaved', async () => {
    vi.resetModules()
    stubStore({
      'pkt.walkdesk.draft': JSON.stringify({
        v: 1,
        data: { stops: [{ node: 'stk-dns-naming', variants: [] }], choices: {}, withOptionals: true, unsaved: true },
      }),
    })

    const mod = await import('./authordraft')
    expect(probe(mod).unsaved).toBe('The walk draft')

    probe(mod).draft.deleteAt([0])
    expect(probe(mod).draft.stops).toHaveLength(0)
    expect(probe(mod).unsaved).toBeUndefined()
  })
})
