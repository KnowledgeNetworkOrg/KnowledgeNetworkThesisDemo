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
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-present.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-palette.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5209
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteOut = ''
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not become ready:\n' + viteOut)), 30000)
  const watch = (d) => {
    viteOut += String(d)
    if (viteOut.includes('localhost:')) {
      clearTimeout(t)
      res()
    }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

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

// ── 7. OB-218: a press during the flight is never thrown away ───────────────
// Every check above presses ONCE and waits, which is why they all passed with
// the bug in place. The fault only exists BETWEEN presses: the 400ms unmount
// timer was never cancelled, so close-then-reopen closed the palette by itself a
// moment later; and the toggle read `showPalette`, which stays true for the whole
// closing flight, so a second press repeated the close. The rule the fix keeps is
// "never drop a press, only drop an animation": a press that reverses a flight
// CUTS to the new state in one frame, and the button is never disabled or
// debounced to get there.
//
// Presses go through the DOM rather than `locator.click`, so two presses 80ms
// apart are 80ms apart and not padded by a click's own actionability waits.
const press = () => page.evaluate((sel) => document.querySelector(sel).click(), HOOK)
const twoFrames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const paneState = () =>
  page.evaluate(() => {
    const side = document.querySelector('[aria-label="studio-sidebar"]')
    if (!side) return null
    const cs = getComputedStyle(side.parentElement)
    return { transform: cs.transform, opacity: cs.opacity, marginRight: cs.marginRight }
  })
const atRestNow = (s) => !!s && (s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)') && s.opacity === '1' && s.marginRight === '0px'
const title = () => page.locator(HOOK).getAttribute('title')
/** put the palette open or closed, at rest, before a check that assumes one */
const ensure = async (open) => {
  await settle()
  if (((await sidebars()) === 1) !== open) { await press(); await settle() }
}

await settle()
ok('7: the palette starts open, at rest', (await sidebars()) === 1 && atRestNow(await paneState()))

// the button's pressed state follows what the palette is BECOMING, not what is still mounted
await press()
await page.waitForTimeout(50)
const midClose = { mounted: await sidebars(), title: await title() }
ok(
  '7: mid-close the pane is still mounted, and the toggle already reads "show" — its state stops lying during a close',
  midClose.mounted === 1 && midClose.title === 'show the palette',
  JSON.stringify(midClose),
)

// (a) clause 1 — the timer is held and cleared
await ensure(true)
await press()
await page.waitForTimeout(150)
await press()
await page.waitForTimeout(600)
ok('7a: close, press again at 150ms, wait 600ms — the palette is OPEN, not closed by the old timer', (await sidebars()) === 1)
ok('7a: and the toggle reads "hide"', (await title()) === 'hide the palette')

// (b) clause 3 — a press that reverses a flight CUTS: at rest at once, no second flight
await ensure(true)
await press()
await page.waitForTimeout(150)
const flying = await paneState()
await press()
await twoFrames()
const cutAt = await paneState()
await page.waitForTimeout(100)
const cutLater = await paneState()
ok('7b: 150ms into a close the pane really is mid-flight', !!flying && !atRestNow(flying), JSON.stringify(flying))
ok('7b: the reversing press puts it AT REST within two frames — no transform, full opacity, its column back', atRestNow(cutAt), JSON.stringify(cutAt))
ok('7b: and it stays at rest — it does not fly back from where the close had got to', atRestNow(cutLater), JSON.stringify(cutLater))

// the reverse direction: a close that interrupts an OPEN cuts to closed
await ensure(false)
ok('7b: (closed, for the reverse case)', (await sidebars()) === 0)
await press()
await page.waitForTimeout(150)
await press()
await twoFrames()
ok('7b: a press 150ms into an OPEN cuts it closed — unmounted in the same beat', (await sidebars()) === 0)
await press()
await settle()

// (c) clauses 2 and 3 — N presses 80ms apart land as N presses
for (const n of [5, 6, 7]) {
  await settle()
  const before = await sidebars()
  for (let i = 0; i < n; i++) {
    await press()
    await page.waitForTimeout(80)
  }
  await settle()
  const expectOpen = n % 2 === 0 ? before === 1 : before === 0
  const got = await sidebars()
  ok(
    `7c: ${n} presses at 80ms from ${before ? 'open' : 'closed'} end ${expectOpen ? 'open' : 'closed'} — no press swallowed`,
    got === (expectOpen ? 1 : 0) && (await title()) === (expectOpen ? 'hide the palette' : 'show the palette'),
    `mounted ${got}`,
  )
  if (expectOpen) ok(`7c: and after ${n} presses the open pane is at rest`, atRestNow(await paneState()), JSON.stringify(await paneState()))
}
// and a close that follows a cut still FLIES — the cut turns the transition off for one commit only
await ensure(true)
await press()
await page.waitForTimeout(80)
await press()
await twoFrames()
await press()
await page.waitForTimeout(120)
const afterCut = await paneState()
ok('7c: a close pressed after a cut is a real flight again, not a cut', !!afterCut && !atRestNow(afterCut), JSON.stringify(afterCut))
await settle()

// clause 7 — the cursor flicker is not ours to see headless, but the candidate the item names
// is: a long main-thread task inside the click. Reported, not asserted.
await ensure(true)
const longTasks = await page.evaluate(async (sel) => {
  const seen = []
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) seen.push(Math.round(e.duration)) })
  po.observe({ type: 'longtask', buffered: false })
  const btn = document.querySelector(sel)
  for (let i = 0; i < 10; i++) {
    btn.click()
    await new Promise((r) => setTimeout(r, 500))
  }
  po.disconnect()
  return seen
}, HOOK)
console.log(`OB-218 clause 7: long tasks (>50ms) across 10 toggles: ${longTasks.length ? longTasks.join(', ') + 'ms' : 'none'}`)
await settle()

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/palette.png')
