// THE BROWSER'S ANSWER to `Platform` — the only implementation that ships today.
//
// Every method degrades rather than throws. A presentation that opens in a window
// because fullscreen was refused is a working presentation; one that dies on an
// unhandled rejection is not, and the difference is a try/catch.

import type { Platform, ScreenInfo } from './types'

// The Window Management API is not in TypeScript's DOM lib, so the shape it
// returns is declared here — structurally, and only the fields `toScreenInfo`
// reads. A `declare global` augmentation was the alternative and is worse: it
// would tell every file in the app that `getScreenDetails` exists, when the
// point of this module is that only this file knows.
interface ScreenDetailedish {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly label?: string
  readonly isPrimary?: boolean
  readonly isInternal?: boolean
}
type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<{ screens: readonly ScreenDetailedish[] }>
}

// Geometry as the id: no display can sit at another's exact bounds, and it is
// the same handle on the next enumeration if nothing was unplugged. Deliberately
// not an index — a caller holding "screen 1" across a re-enumeration would be
// holding a different monitor.
function toScreenInfo(s: ScreenDetailedish): ScreenInfo {
  return {
    id: `${s.left},${s.top},${s.width},${s.height}`,
    label: s.label ?? '',
    // `?? false` rather than `?? true` for isInternal: an unknown display is
    // safer treated as external. Guessing "internal" would hide the projector.
    isInternal: s.isInternal ?? false,
    isPrimary: s.isPrimary ?? false,
    left: s.left,
    top: s.top,
    width: s.width,
    height: s.height,
  }
}

// ── storage (#338 step 5) ────────────────────────────────────────────────────
// The weak answer is a Map that forgets on reload. It is used when there is NO
// localStorage at all (undefined or null): `set` then returns true, because the
// value really is kept for this session. When localStorage EXISTS but a call
// throws, the weak answer is the honest one instead — `get` returns null, `set`
// returns false and keeps nothing, `remove` does nothing, `keys` returns [] —
// and the Map is NOT written, because a later `get` that succeeded would read
// localStorage and never see it. "Refused, so lost" is exactly today's behaviour.
// Reaching for `localStorage` at all can throw too — a sandboxed frame without
// `allow-same-origin`, or Chrome/Edge with site data blocked — and that is the
// same refusal: the weak answer, and no Map write.
//
// `globalThis.localStorage` is looked up on EVERY call, never cached at module
// load: the tests install and remove a fake per case with vi.stubGlobal after
// this module has already been imported, so a cached copy would keep the stale
// one.
const memoryStore = new Map<string, string>()

// The lookup lives in a guard of its own because the property READ itself is
// what throws in a denied-storage frame — `'blocked'` means refused, not absent,
// so it takes the weak answer rather than the in-memory one.
function browserStore(): Storage | 'absent' | 'blocked' {
  try {
    return (globalThis.localStorage as Storage | undefined) ?? 'absent'
  } catch {
    return 'blocked'
  }
}

export const webPlatform: Platform = {
  name: 'web',

  storage: {
    get(key) {
      const ls = browserStore()
      if (ls === 'absent') return memoryStore.get(key) ?? null
      if (ls === 'blocked') return null
      try {
        return ls.getItem(key)
      } catch {
        return null
      }
    },
    set(key, value) {
      const ls = browserStore()
      if (ls === 'absent') {
        memoryStore.set(key, value)
        return true
      }
      if (ls === 'blocked') return false
      try {
        ls.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      const ls = browserStore()
      if (ls === 'absent') {
        memoryStore.delete(key)
        return
      }
      if (ls === 'blocked') return
      try {
        ls.removeItem(key)
      } catch {
        // unavailable or blocked — the key stays
      }
    },
    keys(prefix) {
      const ls = browserStore()
      if (ls === 'absent') {
        const out: string[] = []
        for (const k of memoryStore.keys()) if (k.startsWith(prefix)) out.push(k)
        return out.sort()
      }
      if (ls === 'blocked') return []
      try {
        const out: string[] = []
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i)
          if (k !== null && k.startsWith(prefix)) out.push(k)
        }
        return out.sort()
      } catch {
        return []
      }
    },
  },

  async enterFullscreen() {
    // requestFullscreen REJECTS (rather than resolving false) when it is refused:
    // no user activation, a Permissions-Policy block, an OS that will not oblige.
    // All of those mean the same thing to a caller — you did not get it — so they
    // collapse into one `false` here.
    try {
      await document.documentElement.requestFullscreen()
      return document.fullscreenElement !== null
    } catch {
      return false
    }
  },

  async exitFullscreen() {
    // Guarded because exitFullscreen() rejects when nothing is fullscreen, and
    // "leave fullscreen" asked of a window that already left is a no-op, not a
    // failure. Callers exit on a keypress and on unmount; both can arrive after
    // the user already pressed F11.
    if (document.fullscreenElement === null) return
    try {
      await document.exitFullscreen()
    } catch {
      /* already gone, or the host refused to let go — either way we are done */
    }
  },

  isFullscreen() {
    return document.fullscreenElement !== null
  },

  onFullscreenChange(fn) {
    document.addEventListener('fullscreenchange', fn)
    return () => document.removeEventListener('fullscreenchange', fn)
  },

  openWindow(path, name) {
    const w = globalThis.window as Window | undefined
    if (!w || typeof w.open !== 'function') return false
    try {
      // `noopener` would sever the opener and let the popup blocker treat it as a
      // stranger; a named, same-origin window with an opener is the ordinary
      // "open the notes window" gesture every presenter app makes
      return w.open(path, name) !== null
    } catch {
      return false
    }
  },

  async screens() {
    // `globalThis.window?.` rather than bare `window`, matching index.ts: vitest
    // runs `environment: 'node'`, and this is the one method a node test calls.
    const w = globalThis.window as WindowWithScreenDetails | undefined
    // Chromium-only, and absent in Firefox and Safari — so this branch is the
    // shipping answer for two of the three engines, not an edge case.
    if (typeof w?.getScreenDetails !== 'function') return []
    try {
      const details = await w.getScreenDetails()
      return details.screens.map(toScreenInfo)
    } catch {
      // Rejects with NotAllowedError when the `window-management` permission is
      // denied or dismissed. Indistinguishable from having no API, and it should
      // be: both mean "you do not get to choose a display".
      return []
    }
  },
}
