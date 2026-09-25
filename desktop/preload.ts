// THE SEAM'S SECOND ANSWERER — and, until now, the reason `src/platform/` was
// written at all. `web.ts` says what a browser can do; this says what the
// desktop host can do, and `src/platform/index.ts` picks whichever one is here.
//
// This is the one file in the project outside `main.ts` where importing
// `electron` is legal, and it lives outside `src/` precisely so that stays true
// by CONSTRUCTION rather than by discipline. The dependency runs one way —
// `desktop/` reads `src/`, never the reverse.

import { contextBridge, ipcRenderer } from 'electron'

import { webPlatform } from '../src/platform/web'
import type { Platform } from '../src/platform/types'

// ─────────────────────────────────────────────────────────────────────────────
// A CACHED BIT, WHICH WOULD BE WRONG IN `src/` AND IS RIGHT HERE.
//
// `types.ts` says of `isFullscreen()`: "a query of the host, never state this
// module owns" — because in the browser the user can press F11 and the app would
// never hear about it. That reasoning is about `src/`. Down here we ARE the
// host's messenger: main pushes every change, for every cause, including F11 and
// the OS. So the cache is not a copy of the truth going stale, it is the truth
// arriving by a different road.
//
// It has to be a cache at all because the seam's `isFullscreen()` is
// synchronous and IPC is not. One `sendSync` seeds it (main answers on
// `event.returnValue`); every value after that is pushed.
// ─────────────────────────────────────────────────────────────────────────────
let fullscreen: boolean = ipcRenderer.sendSync('fullscreen:get') === true

const listeners = new Set<() => void>()

ipcRenderer.on('fullscreen:changed', (_event, now: boolean) => {
  fullscreen = now === true
  for (const notify of listeners) notify()
})

const electronPlatform: Platform = {
  name: 'electron',

  // ALL FOUR FULLSCREEN METHODS, AS A SET. Overriding some and inheriting the
  // rest would be the subtlest possible bug: `win.setFullScreen(true)` in main
  // fullscreens the WINDOW, which never fires the DOM's `fullscreenchange`, so
  // an inherited `onFullscreenChange` would sit silent forever while
  // `enterFullscreen` looked like it worked.
  enterFullscreen: () => ipcRenderer.invoke('fullscreen:enter'),

  exitFullscreen: () => ipcRenderer.invoke('fullscreen:exit'),

  isFullscreen: () => fullscreen,

  onFullscreenChange(fn) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },

  // ANSWERED BY THE WEB IMPLEMENTATION, DELIBERATELY — the decision this slice
  // had to make, written down where the next author will hit it.
  //
  // #211's operating rule is WEB API FIRST, IPC ONLY WHERE CHROMIUM HAS NO
  // ANSWER. Chromium has an answer here, and our renderer IS Chromium:
  // `getScreenDetails()` is already sitting in `web.ts`, already correct, and
  // already the shipping web port. Re-implementing it over
  // `screen.getAllDisplays()` would be a second implementation of a solved
  // problem, and two implementations drift.
  //
  // Written out method by method rather than spread from `webPlatform`, and that
  // is the load-bearing half: a spread would make every FUTURE seam method
  // silently inherit the web answer, and the four above are the standing proof
  // that silent inheritance is a bug. Missing a method should be a compile
  // error — which `: Platform` on this object gives us, and a spread throws away.
  //
  // If the `window-management` permission ever proves unavailable in this host,
  // the fix is this one line becoming `ipcRenderer.invoke('screens')` with main
  // mapping `screen.getAllDisplays()` to `ScreenInfo` — which is plain data for
  // exactly that reason. `smoke.mjs` asserts a non-empty answer so we would
  // find out rather than assume.
  screens: () => webPlatform.screens(),

  // ── openWindow: WHY THIS ONE IS IPC AND ITS NEIGHBOUR IS NOT (#330) ────────
  // #211's rule is WEB API FIRST, IPC ONLY WHERE CHROMIUM HAS NO ANSWER, and
  // this was tried that way first — the line here WAS
  // `(path, name) => webPlatform.openWindow(path, name)`, the same explicit
  // delegation `screens()` uses, and it did what it promises: the TypeError
  // went away and the lecture started. What it did not do is open a window.
  // The smoke run measured what neither file can see by reading the other:
  // this host denies every renderer-opened window by design
  // (`setWindowOpenHandler` in main.ts), so `window.open` answers null. The
  // web answer keeps shipping to the browser port; in THIS host Chromium's
  // answer is vetoed, and the smallest main-process answer takes the call.
  //
  // SYNCHRONOUS BECAUSE THE SEAM IS: `openWindow` returns a boolean, not a
  // promise, so main must answer in the same turn — one `sendSync`, the
  // app's second and last blocking channel after `fullscreen:get`.
  openWindow: (path, name) => ipcRenderer.sendSync('window:open', path, name) === true,
}

contextBridge.exposeInMainWorld('knPlatform', electronPlatform)
