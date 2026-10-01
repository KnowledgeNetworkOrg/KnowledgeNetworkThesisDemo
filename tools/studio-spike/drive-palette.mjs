// OB-104 / OB-105 / OB-106 — the palette pane's close, its way back, and the
// toolbar order around it.
//
// None of this is a unit test. The regression OB-104 reports is that the pane
// had no ✕ AND the toolbar had no toggle, which is only a bug in combination:
// either one alone is a design, the pair is a one-way door. So the check that
// matters is the ROUND TRIP — close it, then get it back — and that needs a real
// browser because the way back is measured off a live `getBoundingClientRect`.
//
// TWO SILENT FAILURES THIS EXISTS TO CATCH, neither of which throws or drops a
// frame:
//
//   1. StudioView measures the flight off the toolbar icon's box, so it has to
//      FIND that icon. It used to find it by tooltip, which is copy that changes
//      as the toggle flips and folds past `wrapTip`'s 44 characters — and a
//      folded title is not a CSS selector that misses, it is invalid CSS that
//      throws. The DS `Toolbar` now carries a `hook` (OB-124), so section 1
//      asserts the ATTRIBUTE and no lookup here reads a title.
//   2. the flight was one motion and the DESK was another: the panes beside the
//      palette held still for the whole transition and then jumped the full
//      column width in the single frame the unmount landed on. Section 4.
//
// OB-218 added section 5b: the toggle pressed twice inside the 400ms flight, and a burst of presses
// at 80ms. Everything above presses once and waits the flight out, which is why it passed with the
// double-press bug in place.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-present.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-palette.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

// the palette toggle's stable handle — `PALETTE_HOOK_SELECTOR` in
// src/studio/PaletteGlyph.tsx, restated here because a driver cannot import from
// src/. If these two ever disagree the first check in section 1 fails loudly.
const HOOK = '[data-toolbar-hook="palette-toggle"]'
const sidebars = () => page.$$eval('[aria-label="studio-sidebar"]', (els) => els.length)
// the toolbar is the div directly after the app header; read its buttons in DOM
// order, which IS the group order the obligation is about
const toolbarTitles = () =>
  page.$$eval('[aria-label="studio-header"] + div button', (els) => els.map((el) => (el.getAttribute('title') || '').replace(/\n/g, ' ')))
// settle past --dur-flight (400ms) plus the unmount, with room to spare
const settle = () => page.waitForTimeout(700)

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(600)

// ── 1. both controls exist (OB-104's actual report) ─────────────────────────
ok('the palette pane is on screen at rest', (await sidebars()) === 1)
const closeX = page.locator('[aria-label="studio-sidebar"]').getByRole('button', { name: 'close' })
ok('the palette pane has a ✕', (await closeX.count()) === 1)
const toggle = page.locator(HOOK)
ok('the toolbar has the palette toggle', (await toggle.count()) === 1)
ok('and it reads "hide" while the palette is open', (await toggle.getAttribute('title')) === 'hide the palette')

// HOW THE ANIMATION FINDS THE BUTTON (OB-124). `data-toolbar-hook`, the DS
// Toolbar's own prop, read with exactly the selector StudioView uses. Checked on
// the live DOM because the prop travelling from AppToolbar to an attribute is
// the half a unit test covers, and this is the other half: that the string the
// animation queries with resolves to one element on the real page.
ok(
  'the toggle is findable the way StudioView actually finds it — one element under the hook',
  (await page.evaluate((sel) => document.querySelectorAll(sel).length, HOOK)) === 1,
)

// AND THAT THE HANDLE HOLDS STILL. The tooltip is the thing that changes as the
// toggle flips — which is why matching on it was wrong, and why the check that
// matters is that the hook does NOT change with it. Section 3 closes the palette
// and comes back through this same locator to prove it.
ok(
  'no toolbar button is located by its title any more',
  await page.evaluate(() => document.querySelectorAll('[data-toolbar-hook]').length > 0),
)

// ── 2. OB-105: group order — palette, then new map / load / save / print ────
const titles = await toolbarTitles()
ok('the palette toggle is the toolbar\'s FIRST item', titles[0] === 'hide the palette', JSON.stringify(titles[0]))
const doc = titles.slice(1, 5)
ok(
  'the four document actions are grouped, in use order',
  doc[0] === 'New map' && doc[1] === 'Load' && doc[2] === 'Save (Ctrl+S)' && doc[3] === 'Print (Ctrl+P)',
  JSON.stringify(doc),
)
ok('undo/redo follow them, not precede them', titles[5] === 'Undo (Ctrl+Z)' && titles[6] === 'Redo (Ctrl+Y)', JSON.stringify(titles.slice(5, 7)))

// ── 3. the round trip: ✕ closes, the toolbar brings it back ─────────────────
// THE ✕ ARRIVES WITH THE POINTER — that is Pane's design, not an accident: at
// rest it is opacity 0 AND pointer-events none, so a click without a hover first
// lands on the header behind it and times out. Hovering the pane is what a user
// does; the driver has to do it too.
await page.locator('[aria-label="studio-sidebar"]').hover()
await page.waitForTimeout(200)
await closeX.click()
await settle()
ok('the ✕ closes the palette — unmounted, not hidden', (await sidebars()) === 0)
const reopen = page.locator(HOOK)
ok('and the same button — same hook across the flip — now reads "show"', (await reopen.getAttribute('title')) === 'show the palette')

await reopen.click()
await settle()
ok('the toggle brings the palette back — the door swings both ways', (await sidebars()) === 1)
ok('and the toggle reads "hide" again', (await page.locator(HOOK).getAttribute('title')) === 'hide the palette')

// ── 4. the close is ONE motion, not a flight and then a lurch ──────────────
// The pane's own flight was always smooth — measured at a steady 17ms/frame with
// nothing dropped, in both directions. The DESK was the stutter: the panes
// beside the palette held their exact position for the whole transition and
// then moved 220px, the column plus its gap, in the ONE frame the unmount
// landed on.
// Opening was the same two beats in the other order, the jump first.
//
// So this samples the NEIGHBOUR rather than the palette, every frame across a
// close, and asks whether it travels or teleports. The palette flying smoothly
// is not evidence about this and never was.
const reflow = await page.evaluate(async (sel) => {
  const wrap = document.querySelector('[aria-label="studio-sidebar"]').parentElement
  const neighbour = [...wrap.parentElement.children].find((c) => c !== wrap)
  const xs = []
  let on = true
  const step = () => {
    if (!on) return
    xs.push(Math.round(neighbour.getBoundingClientRect().left))
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  document.querySelector(sel).click()
  await new Promise((r) => setTimeout(r, 900))
  on = false
  let biggest = 0
  for (let i = 1; i < xs.length; i++) biggest = Math.max(biggest, Math.abs(xs[i] - xs[i - 1]))
  return { seen: new Set(xs).size, biggest, from: xs[0], to: xs[xs.length - 1], travelled: Math.abs(xs[xs.length - 1] - xs[0]) }
}, HOOK)
ok(
  'the palette closes at all — the neighbour ends up where the column was',
  reflow.travelled > 100,
  `${reflow.from}px → ${reflow.to}px`,
)
ok(
  'the panes beside it make room over many frames, not one',
  reflow.seen >= 6,
  `${reflow.seen} distinct positions across the close`,
)
// the old behaviour puts 100% of the move in a single frame, so this is the
// check that actually fails against it
ok(
  'and no single frame carries half the move',
  reflow.biggest < reflow.travelled / 2,
  `biggest step ${reflow.biggest}px of ${reflow.travelled}px`,
)

await page.locator(HOOK).click()
await settle()

// ── 5. OB-106: picking a named preset closes the palette ────────────────────
await page.getByLabel('studio-preset-explore').click()
await settle()
ok('picking Explore closes the palette', (await sidebars()) === 0)
ok('and it is reopenable afterwards', (await page.locator(HOOK).getAttribute('title')) === 'show the palette')

await page.locator(HOOK).click()
await settle()
await page.screenshot({ path: OUT + '/palette.png' })

// ── 5b. OB-218: a press is never dropped, and a timer never outlives its press ──
// Every check above presses ONCE and waits out the flight, so none of them can see any of this: the
// bug lived entirely in the 400ms between two presses, and the 14/14 the driver passed before this
// section existed passed with it in place. Three faults, one section:
//   1. the 400ms unmount timer was never cancelled, so close → re-open inside the flight still fired
//      the old `setShowPalette(false)` and the palette closed itself a moment after being asked open;
//   2. the toggle decided from `showPalette`, which stays true for the whole flight, so a second press
//      REPEATED the close — nothing changed, a second timer was queued, and the user waited it out;
//   3. a press that reverses a flight must cut, not start a second flight from a pane that is
//      already flying (whose measured box is the TRANSFORMED one).
//
// The presses go through the page's own clock, not Playwright's: a click through the harness costs
// tens of milliseconds of its own, and the intervals here are the thing under test.
const press = () => page.evaluate((sel) => document.querySelector(sel).click(), HOOK)
/** press once, then again after each gap (ms), all on the page's clock; resolves after the last press */
const pressSeries = (gaps) =>
  page.evaluate(async ({ sel, gaps: g }) => {
    document.querySelector(sel).click()
    for (const ms of g) {
      await new Promise((r) => setTimeout(r, ms))
      document.querySelector(sel).click()
    }
  }, { sel: HOOK, gaps })
/** the wrapper's computed flight state right now, or null when the pane is not mounted */
const flightNow = () =>
  page.evaluate(() => {
    const side = document.querySelector('[aria-label="studio-sidebar"]')
    if (!side) return null
    const cs = getComputedStyle(side.parentElement)
    return { transform: cs.transform, opacity: cs.opacity, marginRight: cs.marginRight }
  })
const atRestNow = (f) =>
  !!f && (f.transform === 'none' || f.transform === 'matrix(1, 0, 0, 1, 0, 0)') && f.opacity === '1' && parseFloat(f.marginRight) === 0
const toggleTitle = () => page.locator(HOOK).getAttribute('title')

// (a) close, wait 150ms, press again, wait 600ms — OPEN. Today it ends closed.
await pressSeries([150])
await page.waitForTimeout(600)
ok('close, then a second press 150ms in: the palette ends OPEN — the stale unmount timer no longer closes it', (await sidebars()) === 1)
ok('and the toggle reads "hide"', (await toggleTitle()) === 'hide the palette')

// the button's pressed state follows the press, not the deferred unmount (clause 2)
await press()
await page.waitForTimeout(120)
ok('mid-close the toggle already reads "show" — the pressed state does not lie during the flight', (await toggleTitle()) === 'show the palette')
await settle()
ok('and the close completes normally on its own', (await sidebars()) === 0)
await press()
await settle()
ok('the palette is back for what follows', (await sidebars()) === 1)

// (b) close, press again at 150ms, and the pane is AT REST with no transform, not flying. Sampled 60ms
// after the press: a CSS transition back from the flight would still be in the air there, and a
// second flight would still be in the air there — only a cut is home.
const cut = await page.evaluate(async (sel) => {
  const el = () => document.querySelector(sel)
  el().click()
  await new Promise((r) => setTimeout(r, 150))
  el().click()
  await new Promise((r) => setTimeout(r, 60))
  const side = document.querySelector('[aria-label="studio-sidebar"]')
  if (!side) return null
  const cs = getComputedStyle(side.parentElement)
  return { transform: cs.transform, opacity: cs.opacity, marginRight: cs.marginRight }
}, HOOK)
ok('a press that reverses the close cuts: the pane is mounted, at rest, with no transform left over', atRestNow(cut), JSON.stringify(cut))
await settle()
ok('and it stays open once the old flight would have ended', (await sidebars()) === 1 && atRestNow(await flightNow()))

// (c) N presses at 80ms: open for odd, closed for even — no press swallowed. Starts from CLOSED.
await press()
await settle()
ok('setup: the palette is closed before the burst', (await sidebars()) === 0)
for (let n = 1; n <= 6; n++) {
  await pressSeries(Array(n - 1).fill(80))
  await settle()
  const want = n % 2 === 1 ? 1 : 0
  ok(`${n} press${n === 1 ? '' : 'es'} at 80ms: the palette ends ${want ? 'open' : 'closed'}`, (await sidebars()) === want, `${await sidebars()} sidebar(s)`)
  ok(`   and it is at rest (${want ? 'not stuck mid-flight' : 'unmounted'})`, want ? atRestNow(await flightNow()) : (await flightNow()) === null)
  // back to closed for the next round
  if (want) {
    await press()
    await settle()
  }
}
// leave it open, as every later section expects
await press()
await settle()
ok('the palette is open again for what follows', (await sidebars()) === 1)

// ── 6. OB-125: the duration is the DS's rung now, and it still collapses ────
// The flight ran on an app-owned `--dur-palette` declared in src/index.css, with
// a hand-written `@media (prefers-reduced-motion: reduce) { --dur-palette: 1ms }`
// beside it. That line was LOAD-BEARING: a 220px slide is exactly what the
// setting exists for. OB-125 deletes both and moves the flight onto the DS's
// `--dur-flight`, which collapses inside tokens/motion.css.
//
// So the only step that could silently drop reduced motion is the deletion, and
// asserting it is not enough — read the duration the browser actually resolves,
// off the element that actually transitions. `paletteStyle` is on the sidebar's
// PARENT, the same box section 4 samples the neighbour against.
const durationOf = () =>
  page.evaluate(() => {
    const wrap = document.querySelector('[aria-label="studio-sidebar"]').parentElement
    return getComputedStyle(wrap).transitionDuration
  })
// every property in the list carries the same duration, so they all read alike
const allAre = (d, ms) => d.split(',').every((p) => p.trim() === ms)

const atRest = await durationOf()
ok('the flight runs at 400ms — the token, no longer a local --dur-palette', allAre(atRest, '0.4s'), atRest)
ok('and no --dur-palette survives to resolve it', await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur-palette').trim() === ''))

await page.emulateMedia({ reducedMotion: 'reduce' })
const reduced = await durationOf()
ok('prefers-reduced-motion still collapses it to 1ms, now from motion.css', allAre(reduced, '0.001s'), reduced)
await page.emulateMedia({ reducedMotion: 'no-preference' })

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/palette.png')
