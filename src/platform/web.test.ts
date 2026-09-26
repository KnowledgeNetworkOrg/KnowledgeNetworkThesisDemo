import { afterEach, describe, expect, it, vi } from 'vitest'

import { webPlatform } from './web'

// ─────────────────────────────────────────────────────────────────────────────
// THE WEAK ANSWERS ARE THE POINT (#211). `screens()` is the seam's first
// capability-shaped method, and its whole contract is that a host which cannot
// answer says so with `[]` rather than throwing — three different failures (no
// API, permission denied, no window at all) collapsing into one value a caller
// handles once. That collapse is the thing worth testing; the happy path is a
// field copy.
//
// Runnable here at all because `screens()` reads `globalThis.window?.` rather
// than bare `window`, the same reason index.ts does — vitest runs
// `environment: 'node'`, so the no-window case is simply the default.
// ─────────────────────────────────────────────────────────────────────────────

const g = globalThis as unknown as { window?: unknown }

afterEach(() => {
  delete g.window
})

const screen = (over: Record<string, unknown> = {}) => ({
  left: 0,
  top: 0,
  width: 1920,
  height: 1080,
  label: 'Built-in',
  isPrimary: true,
  isInternal: true,
  ...over,
})

describe('webPlatform.name', () => {
  it('reports which implementation answered', () => {
    expect(webPlatform.name).toBe('web')
  })
})

describe('webPlatform.openWindow — the projector window (#267)', () => {
  it('answers false with no window at all, and does not throw', () => {
    expect(webPlatform.openWindow('?projector', 'kn-projector')).toBe(false)
  })

  it('answers false when the host refuses — a popup blocker returns null', () => {
    g.window = { open: () => null }
    expect(webPlatform.openWindow('?projector', 'kn-projector')).toBe(false)
  })

  it('answers true when a window came back, and passes the path and the name through', () => {
    const calls: unknown[][] = []
    g.window = { open: (...args: unknown[]) => { calls.push(args); return {} } }
    expect(webPlatform.openWindow('?projector', 'kn-projector')).toBe(true)
    expect(calls).toEqual([['?projector', 'kn-projector']])
  })
})

describe('webPlatform.screens', () => {
  it('answers [] with no window at all', async () => {
    expect(await webPlatform.screens()).toEqual([])
  })

  it('answers [] where the API is absent — Firefox and Safari', async () => {
    g.window = {}
    expect(await webPlatform.screens()).toEqual([])
  })

  it('answers [] when the permission is denied, not a rejection', async () => {
    g.window = {
      getScreenDetails: () => Promise.reject(new Error('NotAllowedError')),
    }
    // The assertion is that this RESOLVES: a denied prompt must degrade the
    // feature to "present where the window is", never break the caller.
    expect(await webPlatform.screens()).toEqual([])
  })

  it('maps the enumeration to the seam type, external displays included', async () => {
    g.window = {
      getScreenDetails: () =>
        Promise.resolve({
          screens: [
            screen(),
            screen({
              left: 1920,
              width: 3840,
              height: 2160,
              label: 'Projector',
              isPrimary: false,
              isInternal: false,
            }),
          ],
        }),
    }
    const got = await webPlatform.screens()

    expect(got).toHaveLength(2)
    expect(got[1]).toEqual({
      id: '1920,0,3840,2160',
      label: 'Projector',
      isInternal: false,
      isPrimary: false,
      left: 1920,
      top: 0,
      width: 3840,
      height: 2160,
    })
    // What #204 actually does with this, and the reason `isInternal` exists.
    expect(got.find((s) => !s.isInternal)?.label).toBe('Projector')
    // Distinct ids, so a later placement call can name one of them.
    expect(new Set(got.map((s) => s.id)).size).toBe(2)
  })

  it('treats an unnamed display as external rather than guessing internal', async () => {
    // A wrong `isInternal: true` sends the deck to the laptop lid, which is the
    // one failure the presenter cannot recover from mid-talk.
    g.window = {
      getScreenDetails: () =>
        Promise.resolve({ screens: [{ left: 0, top: 0, width: 1024, height: 768 }] }),
    }
    expect(await webPlatform.screens()).toEqual([
      {
        id: '0,0,1024,768',
        label: '',
        isInternal: false,
        isPrimary: false,
        left: 0,
        top: 0,
        width: 1024,
        height: 768,
      },
    ])
  })
})

describe('webPlatform.storage — small key-value storage that never throws (#338)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    // The throwing-lookup case defines the property directly (a getter) rather
    // than via vi.stubGlobal, so vitest has no record of it; drop it by hand.
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage
  })

  it('round-trips through the in-memory fallback when there is no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(webPlatform.storage.get('pkt.walkdesk.draft')).toBeNull()
    expect(webPlatform.storage.set('pkt.walkdesk.draft', '{"stops":[]}')).toBe(true)
    expect(webPlatform.storage.get('pkt.walkdesk.draft')).toBe('{"stops":[]}')
    expect(webPlatform.storage.keys('pkt.')).toEqual(['pkt.walkdesk.draft'])
  })

  it('answers false without throwing when the host refuses a write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => webPlatform.storage.set('pkt.x', 'y')).not.toThrow()
    expect(webPlatform.storage.set('pkt.x', 'y')).toBe(false)
  })

  it('lists only the keys under the asked prefix, sorted', () => {
    const map = new Map([
      ['pkt.a', '1'],
      ['other', '2'],
      ['pkt.b', '3'],
    ])
    vi.stubGlobal('localStorage', {
      get length() {
        return map.size
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
    })
    expect(webPlatform.storage.keys('pkt.')).toEqual(['pkt.a', 'pkt.b'])
  })

  it('answers null when a read throws, rather than letting the throw through', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(webPlatform.storage.get('pkt.x')).toBeNull()
  })

  it('treats a throwing LOOKUP as refused, not absent, and never throws', () => {
    // A denied-storage frame throws on the property READ itself, before any
    // getItem/setItem/removeItem can be called.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(webPlatform.storage.get('pkt.x')).toBeNull()
    expect(webPlatform.storage.set('pkt.x', 'y')).toBe(false)
    expect(webPlatform.storage.keys('pkt.')).toEqual([])
    expect(() => webPlatform.storage.remove('pkt.x')).not.toThrow()
  })
})
