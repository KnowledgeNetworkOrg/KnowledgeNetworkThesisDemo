// WHAT THE HOST CAN DO — the one interface between this app and whatever is
// running it. Today that is a browser tab; the shipping host will be an Electron
// window (#201), and the browser build becomes a port target.
//
// The seam exists because those two hosts answer the same questions differently,
// NOT because one of them is "the real one". A common misreading is that wrapping
// the app in Electron gives the app Node: it does not. Electron's renderer is a
// Chromium page like any other and never has Node — Node lives in the MAIN
// process, reached over IPC through a preload script. So there is no version of
// this app that "uses Node directly". There is only: the app asks for a
// capability, and something answers.
//
// This interface is that question. `web.ts` answers it with browser APIs; a
// desktop preload would answer it with IPC calls. Callers see neither.
//
// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY-SHAPED, NEVER HOST-SHAPED (#211). The rule every method here obeys,
// and the reason the interface is worth having at all.
//
//   ASK WHAT CAN BE DONE HERE. NEVER ASK WHAT IS RUNNING THIS.
//
// A method is well shaped when EVERY host can answer it — some better than
// others. The weak answer is a real answer: an empty array, a `false`, a promise
// that resolves having done nothing. Never a throw, never `undefined`. A weak
// answer must degrade the feature, never break it: `screens()` returning `[]`
// means "present where the window already is", which is exactly what ships
// today.
//
// The alternative — a boolean per host, and callers branching on it — throws
// away capability in both directions. #204 was filed believing only a desktop
// host could put a deck on a chosen display; Chromium does it with
// `getScreenDetails()` + `requestFullscreen({ screen })`, so `if (name ===
// 'electron')` would have killed the feature in every browser AND until the
// wrapper shipped, for nothing. And in the other direction it is the one line
// that makes the later web port impossible.
//
// Operationally: WEB API FIRST, IPC ONLY WHERE CHROMIUM HAS NO ANSWER. A
// web-standard implementation runs in the desktop host (its renderer IS
// Chromium) and is the web port, already written.
//
// KEEP IT SMALL. Every method here is a promise to implement it twice. Fullscreen
// earns its place because presentation mode cannot work without it; `screens()`
// because placing a deck on the projector is the first capability whose absence
// callers must handle. The next method, when something actually needs it, is:
//
//   keepAwake(): Promise<() => void>    // navigator.wakeLock / powerSaveBlocker
//
// deliberately absent today — see #195 and #197. It is named here only so the
// next author knows the interface was left open on purpose rather than
// considered finished. `openWindow` earned its place with presenter mode (#267):
// a lecture's projector is a second window of this app, and which host opens a
// window — `window.open` on a gesture, or a `BrowserWindow` on a chosen display —
// is exactly the kind of question this seam exists to keep out of callers.
// ─────────────────────────────────────────────────────────────────────────────

/** ONE DISPLAY, as this app needs to talk about one — deliberately not the DOM's
 *  `ScreenDetailed`. A preload answering over IPC can only send values that
 *  survive structured cloning, so the seam's own type is plain data with no
 *  methods and no live binding: whatever produced it, both hosts can produce it.
 *
 *  A SNAPSHOT, not a handle. Displays are plugged in, unplugged and rearranged
 *  mid-talk; re-enumerate rather than holding one of these across time. */
export interface ScreenInfo {
  /** opaque handle back to this display, for a later placement call. Meaningful
   *  ONLY to the implementation that produced it and ONLY within the current
   *  enumeration — never parsed, stored, or compared across a `screens()` call. */
  readonly id: string
  /** the OS's name for it, or `''` where the host has none. Not unique. */
  readonly label: string
  /** the built-in panel, as far as the host can tell. `false` when unknowable —
   *  a wrong `true` would send the deck to the laptop lid. */
  readonly isInternal: boolean
  readonly isPrimary: boolean
  /** position and size in the host's virtual-desktop coordinates. `left`/`top`
   *  can be negative: a display to the left of the primary one starts there. */
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** SMALL KEY-VALUE STORAGE that outlives a reload. Synchronous, because every
 *  reader seeds a module-level store at import time and cannot await. The weak
 *  answer is a store that forgets on reload — in memory — and it is a real
 *  answer: a private-mode browser must open the desk on a seed, not on a stack
 *  trace. Never throws. Keys are the caller's; the `pkt.` prefix is a convention
 *  this seam does not know about. */
export interface KeyValueStore {
  /** the stored text, or null when there is none or the store cannot be read */
  get(key: string): string | null
  /** true when the value is now stored; false when the host refused (quota, unavailable) */
  set(key: string, value: string): boolean
  remove(key: string): void
  /** every stored key beginning with `prefix`, sorted */
  keys(prefix: string): string[]
}

export interface Platform {
  /** which implementation answered. A readout for humans and for drivers — never
   *  a thing to branch on: if a caller needs to know, the interface is wrong.
   *  Machine-enforced by the host-shape ban in `eslint.config.js` (#211). */
  readonly name: 'web' | 'electron'

  /** Take the host fullscreen. Resolves to whether it actually happened.
   *
   *  NO ELEMENT PARAMETER, on purpose. A DOM node is not in `contextBridge`'s
   *  value-passing set, so no preload could ever receive one — and "which
   *  Element" is not a question a window manager can answer: `setFullScreen(true)`
   *  fullscreens the window. `web.ts` supplies `document.documentElement` itself.
   *
   *  THE WEB IMPLEMENTATION REQUIRES A USER GESTURE, so this must be called
   *  synchronously from the click handler that started the presentation — never
   *  after an `await`, which ends the gesture's activation window.
   *
   *  A `false` is not an error and must not be treated as one. Fullscreen can be
   *  refused by policy, by an iframe's permissions, or by the user's settings;
   *  the honest response is a presentation that runs in the window it has. */
  enterFullscreen(): Promise<boolean>

  /** Leave fullscreen. Safe to call when not fullscreen — a no-op, not a throw. */
  exitFullscreen(): Promise<void>

  /** Is the host fullscreen RIGHT NOW. A query of the host, never state this
   *  module owns: the user can leave fullscreen by pressing F11 or Escape
   *  without telling us, so a cached copy would go stale within one keystroke. */
  isFullscreen(): boolean

  /** Fires whenever the host's fullscreen state changes for ANY reason — our own
   *  calls, F11, Escape, the OS, a request that was silently denied. Returns its
   *  own unsubscribe. This is the only trustworthy source of that bit. */
  onFullscreenChange(fn: () => void): () => void

  /** Every display the host will admit to, best effort.
   *
   *  `[]` IS A CORRECT ANSWER and the one callers must handle first: the API is
   *  missing, the permission was denied, or the host simply will not say. It
   *  means "you do not get to choose" — not "there are no displays" — and the
   *  right response is to present where the window already is.
   *
   *  Async because the browser's answer is: `getScreenDetails()` prompts for the
   *  `window-management` permission the first time. Asking therefore has a
   *  user-visible cost, so call it when the user is choosing a display, not on
   *  mount. */
  screens(): Promise<ScreenInfo[]>

  /** Open a SECOND window of this app at `path` (a path + query on our own origin,
   *  e.g. `?projector`), named `name` so a later call re-lands the same window
   *  rather than opening another. Resolves to whether a window was opened.
   *
   *  SYNCHRONOUS AND GESTURE-BOUND, like `enterFullscreen`: the web answer is
   *  `window.open`, which a popup blocker refuses outside a user activation — so
   *  call it straight from the click, never after an `await`. A `false` is not an
   *  error: the presenter still runs in the window it has, and the professor can
   *  open the projector by hand at the same address. A desktop host answers with
   *  a `BrowserWindow`, placed on a chosen display (#197's second row — the one
   *  thing Chromium cannot do). Where the window lands is never decided here. */
  openWindow(path: string, name: string): boolean

  /** Small key-value storage that outlives a reload — see KeyValueStore. Answered
   *  by the browser host's own implementation on every host today: the renderer
   *  is Chromium and already has `localStorage`. A real-file answer is #209's,
   *  not this seam's. */
  readonly storage: KeyValueStore
}
