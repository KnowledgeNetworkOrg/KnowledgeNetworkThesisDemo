// #202 — does the real app run in the real desktop host?
//
// Not a unit test, and not a screenshot. The things this proves cannot be proved
// anywhere else:
//
//   1. `app://` SERVED THE BUNDLE. `dist/index.html` asks for absolute
//      `/assets/…` paths; a host that could not answer those gives a blank
//      window and no error. So "#root has children" is a protocol assertion
//      wearing a DOM assertion's clothes. (Do NOT "fix" a blank window with
//      Vite's `base: './'` — the paths are correct; the host has to be.)
//   2. THE PRELOAD WON. `window.knPlatform.name` reads `electron` only if
//      `window.knPlatform` was published and `src/platform/index.ts` picked it
//      up. `web` here means the seam quietly fell back and the whole slice is
//      decorative. (The old readout was a `data-present-host` attribute on the
//      #195 deck; the presenter's #267 refactor took that attribute away, so the
//      seam is asked directly.)
//   3. THE ▶ OPENS THE PROJECTOR AND STARTS THE LECTURE (#330). The click calls
//      `platform.openWindow` BEFORE it sets presenter state, so a preload whose
//      answer omits it throws a TypeError and the lecture never begins. This
//      check failing on unfixed code, with that TypeError in the page errors, is
//      exactly what it exists to catch.
//   4. A SECOND WINDOW IS A SECOND APP, LIVE. The projector at `?projector`
//      connects to the presenter's broadcast channel and draws the live slide.
//   5. FULLSCREEN CROSSES THE PROCESS BOUNDARY. `setFullScreen` from main never
//      fires the DOM's `fullscreenchange`, so the preload's cache only moves if
//      main's push reaches it. The presenter draws no fullscreen readout since
//      #267 (`session.ts` went unreached), so this asks the seam directly — the
//      same divergence, on the value the app would have read.
//   6. STORAGE SURVIVES A RESTART. Two launches, one `pkt.` key. This is the
//      assertion `file://` fails — its origin is opaque and has no localStorage
//      at all — and it is the entire reason `app://` is registered.
//
// Plus one GATE on an open decision: `screens()` is answered by the web
// implementation on purpose (see preload.ts). If Electron will not grant
// `window-management`, the answer is `[]` and the desktop build would be worse
// at finding a projector than the browser build — the exact inversion #211
// exists to prevent. Better to fail here than to discover it in #204.
//
// Requires a built app: `npm run build` at the REPO ROOT first.
// Run:  npm run smoke        (from desktop/)
// Exits nonzero on any failed check or any page error.

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MAIN = join(HERE, 'out', 'main.cjs')
const DIST_INDEX = join(HERE, '..', 'dist', 'index.html')

const require = createRequire(import.meta.url)
const { _electron } = require('playwright-core')
// The `electron` package's main export is the path to the binary, which is what
// playwright wants. Resolving it explicitly rather than letting playwright guess
// keeps this working whatever directory it is invoked from.
const electronPath = require('electron')

if (!existsSync(MAIN)) {
  console.error('no out/main.cjs — run `npm run build` in desktop/ first')
  process.exit(1)
}
if (!existsSync(DIST_INDEX)) {
  console.error('no dist/index.html — run `npm run build` at the repo root first')
  process.exit(1)
}

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

// DESKTOP_LOAD=dist is the whole point: without it main.ts loads the dev server
// and this would prove that Vite works, which we already know.
const launch = () =>
  _electron.launch({
    executablePath: electronPath,
    args: [MAIN],
    cwd: HERE,
    env: { ...process.env, DESKTOP_LOAD: 'dist' },
  })

const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  })
}

const KEY = 'pkt.smoke.restart'
const STAMP = 'written-by-run-1'

// ── run 1 ────────────────────────────────────────────────────────────────────
{
  const app = await launch()
  const page = await app.firstWindow()
  watch(page)

  await page.waitForSelector('#root > *', { timeout: 20000 })
  ok('app:// served the bundle — #root has content', (await page.$$eval('#root > *', (e) => e.length)) > 0)

  const url = page.url()
  ok('and it is the app:// origin, not a file:// or a dev server', url.startsWith('app://local/'), url)

  // A leftover draft from a previous run would move the step count under every
  // assertion below. Cleared here, and NOT in run 2 — run 2's whole job is to
  // find something still there.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('#root > *')
  await page.waitForTimeout(600)

  // THE ONE THING THIS SLICE EXISTS TO SHOW.
  const host = await page.evaluate(() => window.knPlatform?.name)
  ok('the preload won — the seam reports the desktop host', host === 'electron', `window.knPlatform.name=${host}`)

  const present = page.locator('[data-toolbar-hook="present"]')
  ok('the toolbar offers Present', (await present.count()) === 1)

  // ── ▶ OPENS THE PROJECTOR (#330) ───────────────────────────────────────────
  // THE LISTENER IS ARMED BEFORE THE CLICK, and that is load-bearing: the window
  // is created inside the click's own turn (`openWindow` is synchronous on the
  // seam, `window.open` on the web), so a listener attached after the click
  // would race the event.
  const projectorOpened = app.waitForEvent('window', { timeout: 5000 }).catch(() => null)
  await present.first().click()

  // THE GATE on the screens() decision. Evaluated straight after a real click so
  // the transient user activation getScreenDetails() wants is still live — which
  // is also how a caller would really reach it (#204 asks while the user is
  // choosing a display).
  const screens = await page.evaluate(() => window.knPlatform.screens())
  ok(
    'screens() answers from the renderer, no IPC needed',
    Array.isArray(screens) && screens.length > 0,
    Array.isArray(screens)
      ? `${screens.length} display(s): ${screens.map((s) => s.label || '(unnamed)').join(', ')}`
      : String(screens),
  )
  if (Array.isArray(screens) && screens.length === 0) {
    checks.push(
      'NOTE  an empty screens() means this host denied window-management. The fix is one line in ' +
        'preload.ts — swap the delegation for ipcRenderer.invoke(\'screens\') over screen.getAllDisplays(). See #202.',
    )
  }

  const projector = await projectorOpened
  ok('pressing ▶ opens the projector window', projector !== null)

  // THE LECTURE STARTS: `setPresenter` runs AFTER `openWindow` returns, so the
  // presenter screen being here is proof the call did not throw on the way.
  const presenterLive = await page
    .locator('[data-presenter-screen="presenting"]')
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  ok('the lecture starts — the presenter screen is live', presenterLive)

  if (projector) {
    watch(projector)
    // THE SECOND WINDOW IS THE ROOM'S SCREEN: it says `connect`, the presenter
    // answers with the live state, and only then does it draw a slide.
    const projectorLive = await projector
      .locator('[data-projector="live"]')
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    ok('and the projector window shows the live lecture', projectorLive)
  }

  // THE DECK WORKS IN THE NEW HOST — → advances. The presenter prints its cursor
  // nowhere but the status chip, so that is what this reads. A missing chip
  // (no presenter at all) comes back NaN and fails rather than throwing, so one
  // failure does not take the rest of the run down with it.
  const chipStop = () =>
    page
      .locator('[data-presenter-chip]')
      .innerText({ timeout: 2000 })
      .then((t) => Number(/stop (\d+)/.exec(t)?.[1] ?? NaN))
      .catch(() => NaN)
  const step0 = await chipStop()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  ok('the deck works in the new host — → advances', (await chipStop()) === step0 + 1, `stop ${step0} → ${await chipStop()}`)

  // ── FULLSCREEN, THROUGH THE SEAM (the F11-class divergence) ────────────────
  // Nothing in the app draws the host's fullscreen bit any more (#267), so this
  // asks the seam directly. The divergence is all in the seam anyway: a window
  // put fullscreen by the main process fires no DOM event, so the preload's
  // cache only moves if main → push → cache holds.
  //
  // THREE TRANSITIONS, NOT ONE, AND THAT IS THE POINT. The first version of
  // main.ts pushed `win.isFullScreen()` from inside the transition handlers,
  // which on Windows answers with the state the window is LEAVING — so every
  // pushed value was inverted. A single enter-and-assert passes that bug: the
  // stale `false` on the way in is indistinguishable from a readout that has not
  // updated yet. Only going back and forth catches it.
  const fs = () => page.evaluate(() => window.knPlatform.isFullscreen())

  // Polled rather than slept on: the transition is animated and its length is
  // the OS's business, not ours.
  const fsBecomes = async (want, ms = 4000) => {
    const deadline = Date.now() + ms
    for (;;) {
      if ((await fs()) === want) return true
      if (Date.now() > deadline) return false
      await page.waitForTimeout(100)
    }
  }

  // TARGETED BY URL, not by index: the projector window is open now, and
  // `getAllWindows()[0]` is not a promise about which window that is.
  const setFs = (want) =>
    app.evaluate(({ BrowserWindow }, w) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('projector'))
      if (!main) return false
      main.setFullScreen(w)
      return true
    }, want)

  // The INVOKE direction first: the same IPC round trip the app's own
  // enterFullscreen() makes in this host.
  ok('the seam can take the host fullscreen', (await page.evaluate(() => window.knPlatform.enterFullscreen())) && (await fsBecomes(true)))

  // Then the EVENT direction — changes the app did not ask for, which is what
  // F11 and the OS look like.
  await setFs(false)
  ok('a fullscreen change made in MAIN reaches the app', await fsBecomes(false))
  await setFs(true)
  ok('and back up', await fsBecomes(true))
  await setFs(false)
  ok('and down again — the readout tracks state, not a count of events', await fsBecomes(false))

  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, STAMP])
  await app.close()
}

// ── run 2: a genuinely separate process ──────────────────────────────────────
{
  const app = await launch()
  const page = await app.firstWindow()
  watch(page)

  await page.waitForSelector('#root > *', { timeout: 20000 })
  const read = await page.evaluate((k) => localStorage.getItem(k), KEY)
  ok('localStorage survived the restart — this is why app:// and not file://', read === STAMP, `read back ${read}`)

  await page.evaluate((k) => localStorage.removeItem(k), KEY)
  await app.close()
}

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' problem(s):\n' + errors.map((e) => '  · ' + e).join('\n'))
  process.exit(1)
}
console.log('\nall ' + checks.filter((c) => c.startsWith('PASS')).length + ' checks passed')
