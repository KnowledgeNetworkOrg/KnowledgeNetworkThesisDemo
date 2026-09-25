// THE MAIN PROCESS — the only place in this repository where Node exists.
//
// A common misreading of "wrap it in Electron" is that the app now gets Node.
// It does not. Electron's renderer is a Chromium page like any other and never
// has Node; Node lives HERE, and the renderer reaches it only through the
// preload's `contextBridge`. So this file answers three questions and nothing
// else: where do the app's files come from, what window shows them, and what
// can the renderer ask us to do that Chromium cannot do for itself.
//
// Today that last list has two entries — window fullscreen (#202), and opening
// a second window of the app for a lecture's projector (#330). See #201 for the
// capabilities that will genuinely need this process later, and #202 for why
// this process does as little as it can get away with.

import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { once } from 'node:events'
import { extname, isAbsolute, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

// `app://` AND NOT `file://`, and this is a decision rather than a preference.
// Chromium treats a `file://` page as an opaque origin, and an opaque origin has
// NO localStorage — every `pkt.*` key the app has ever persisted would be
// unreachable in the desktop build, silently, with the app looking merely empty
// rather than broken. A registered standard+secure scheme gets a real origin
// (`app://local`), which gets real storage that survives a restart. The smoke
// test asserts exactly that, because it is the whole reason this line exists.
//
// MUST run before `app.whenReady()`. Afterwards it is a silent no-op — no throw,
// no warning, just a build whose storage quietly stops working.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// dist/ relative to the BUILT file, which lands at desktop/out/main.cjs — so two
// levels up is the repo root. Packaging moves this (slice 2, #203); until then
// the desktop build runs against the very same `npm run build` output the web
// build ships, which is the point: one bundle, two hosts.
const DIST = join(__dirname, '..', '..', 'dist')

// The dev server unless we are told otherwise. `DESKTOP_LOAD=dist` is what lets
// smoke.mjs exercise the REAL `app://` path without packaging anything — without
// it the smoke test would prove the dev server works, which we already know.
const USE_DIST = app.isPackaged || process.env.DESKTOP_LOAD === 'dist'
const START = USE_DIST ? 'app://local/index.html' : 'http://localhost:3000'

function serveFromDist(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url)
  // Decode BEFORE the guard below, never after: `%2e%2e%2f` is `../`, and a
  // guard that ran on the encoded form would wave it straight through.
  const decoded = decodeURIComponent(pathname)
  // Extensionless paths are the SPA shell. The app has no router today; this
  // costs one line and stops a future one from 404ing on a deep link.
  const wanted = extname(decoded) === '' ? '/index.html' : decoded
  const file = join(DIST, wanted)

  // TRAVERSAL GUARD. `join` normalises, so anything that climbs out of DIST
  // shows up here as a relative path starting with `..` — or, with a drive
  // letter in play on Windows, as an absolute one.
  const rel = relative(DIST, file)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return Promise.resolve(new Response('forbidden', { status: 403 }))
  }

  return net.fetch(pathToFileURL(file).toString())
}

// Same scheme and same host as the page we loaded. Compared field by field
// rather than by `origin` because a non-special scheme's `origin` is the string
// "null", which would make every `app://` host match every other one.
const ALLOWED = new URL(START)
function isAllowed(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === ALLOWED.protocol && u.host === ALLOWED.host
  } catch {
    return false
  }
}

function createWindow(url: string = START): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#0e1116',
    // Deferred so the window does not flash unpainted white before React has
    // anything on screen.
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // A SANDBOXED preload still gets `ipcRenderer`, `contextBridge` and the
      // DOM, which is the whole of what ours needs — so there is no reason to
      // give it a full Node process, and every reason not to.
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // The renderer never opens windows, and never navigates off its own origin.
  // Two doors that a page loading remote content would otherwise leave open.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowed(url)) event.preventDefault()
  })

  // The push half of the fullscreen contract. The renderer must learn about
  // fullscreen changes it did not cause — the user pressing F11, the OS, a
  // request that was quietly refused — and this is the only place that knows.
  //
  // THE EVENT NAME IS THE ANSWER; DO NOT RE-QUERY THE WINDOW. Measured on
  // Windows (Electron 44): both events fire BEFORE `isFullScreen()` flips, so a
  // `send('fullscreen:changed', win.isFullScreen())` here pushes the state the
  // window is LEAVING. It is invisible on the first transition — false pushed
  // while entering just looks like nothing happened — and then every subsequent
  // value is exactly inverted. Sending the literal removes the race rather than
  // waiting it out, and it is also simply what we know.
  win.on('enter-full-screen', () => win.webContents.send('fullscreen:changed', true))
  win.on('leave-full-screen', () => win.webContents.send('fullscreen:changed', false))

  void win.loadURL(url)
  return win
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW FULLSCREEN (#202) — the first capability this process answered
//
// `setFullScreen` fullscreens the WINDOW. That is a different thing from the
// DOM's Element fullscreen, and the difference is why the seam's four fullscreen
// methods have to be overridden in the preload as a SET rather than one at a
// time: a window put fullscreen from this process never fires the renderer's
// `fullscreenchange` event, so an inherited web `onFullscreenChange` would be
// quietly dead while `enterFullscreen` appeared to work.
// ─────────────────────────────────────────────────────────────────────────────
function wireFullscreenIpc(): void {
  const windowFor = (sender: Electron.WebContents) => BrowserWindow.fromWebContents(sender)

  // AWAITED, NOT POLLED — the same measurement as the push above. Reading
  // `isFullScreen()` straight after `setFullScreen()` answers with the state the
  // window is leaving, so the honest way to report "did it happen" is to wait
  // for the window to say so. The seam promises a boolean that means what it
  // says; this is what that costs on this host.
  //
  // The timeout is not a failure path so much as an answer of last resort: a
  // transition still in flight after two seconds is one the caller should stop
  // waiting on, and `types.ts` is explicit that a `false` here is not an error.
  async function settle(win: BrowserWindow, want: boolean): Promise<boolean> {
    if (win.isFullScreen() === want) return want
    win.setFullScreen(want)
    try {
      await once(win, want ? 'enter-full-screen' : 'leave-full-screen', {
        signal: AbortSignal.timeout(2000),
      })
      return want
    } catch {
      return win.isFullScreen()
    }
  }

  ipcMain.handle('fullscreen:enter', async (event) => {
    const win = windowFor(event.sender)
    return win ? await settle(win, true) : false
  })

  ipcMain.handle('fullscreen:exit', async (event) => {
    const win = windowFor(event.sender)
    if (win) await settle(win, false)
  })

  // SYNCHRONOUS, the first of the app's two synchronous channels — `window:open`
  // is the other. The preload needs
  // one seed value at load time — before any event could have been pushed — and
  // `isFullscreen()` is a plain `boolean` on the seam because the DOM's own
  // `document.fullscreenElement` is synchronous too. One blocking call at
  // startup is what buys the seam an honest signature.
  ipcMain.on('fullscreen:get', (event) => {
    event.returnValue = windowFor(event.sender)?.isFullScreen() ?? false
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SECOND WINDOW (#330)
//
// `platform.openWindow` is SYNCHRONOUS on the seam — a boolean, not a promise —
// because the browser's answer (`window.open`) is, and the caller is bound to
// the click's user gesture. So this is a `sendSync`, the app's second blocking
// channel: main creates the window in the same turn and answers with
// what it did. It has to be main: a BrowserWindow can only be made here, and
// the renderer is sandboxed with no Node.
//
// WHY IPC AT ALL, WHEN #211 SAYS WEB API FIRST. `window.open` WAS tried first,
// with `webPlatform.openWindow` delegated whole; the smoke run measured the
// host vetoing it. This process denies renderer-opened windows on purpose (the
// `setWindowOpenHandler` in createWindow — the renderer never opens windows),
// so `window.open` answers null and no retry changes that. A web answer the
// host refuses is not an answer, and the refusal is a deliberate door, not an
// accident to route around; main opens the window instead.
//
// NAMED, AND THE NAME IS THE DOOR: a live window under the same name is focused
// — not reloaded, and not doubled — what `window.open(path, name)` gives the web
// answer, and what the seam's contract promises callers (#267's re-land rule).
// Focused rather than reloaded on purpose: a re-press lands the professor on
// the screen that is already there, whatever it was showing, rather than
// tearing it down mid-talk. Placement is deliberately not decided here; #197
// owns that.
// ─────────────────────────────────────────────────────────────────────────────
const namedWindows = new Map<string, BrowserWindow>()

function openNamedWindow(path: string, name: string): boolean {
  const existing = namedWindows.get(name)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return true
  }
  // The path comes from our own renderer, but it is resolved and checked
  // against the same origin allow-list the navigation guard uses — a bug up
  // there must not be able to point a second window somewhere else.
  let url: URL
  try {
    url = new URL(path, START)
  } catch {
    return false
  }
  if (!isAllowed(url.toString())) return false

  const win = createWindow(url.toString())
  namedWindows.set(name, win)
  win.on('closed', () => {
    if (namedWindows.get(name) === win) namedWindows.delete(name)
  })
  return true
}

function wireWindowIpc(): void {
  ipcMain.on('window:open', (event, path: unknown, name: unknown) => {
    event.returnValue =
      typeof path === 'string' && typeof name === 'string' ? openNamedWindow(path, name) : false
  })
}

// Windows groups taskbar entries by this, and without it a dev run and a
// packaged run look like two different applications.
app.setAppUserModelId('com.knowledgenetwork.thesisdemo')

void app.whenReady().then(() => {
  if (USE_DIST) protocol.handle('app', serveFromDist)
  wireFullscreenIpc()
  wireWindowIpc()
  createWindow()

  // macOS keeps the process alive with no windows; clicking the dock icon is
  // expected to bring one back.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
