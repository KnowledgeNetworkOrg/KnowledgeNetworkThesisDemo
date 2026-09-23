// OB-032 / OB-034 — the two halves of the tooltip rule, in a real browser.
//
// Neither half can be answered by a unit test. wraptip.test.ts proves the FOLDING
// is right; `useClipped` measures `scrollWidth` against `clientWidth` on a
// laid-out element, and the whole point of the hook is that the answer depends on
// the pane, the sidebar, the window and the string. A jsdom stub returns 0 for
// both and would assert nothing but the stub.
//
// So this drives the running app and checks the two rules that matter:
//
//   1. A CLIPPED line carries the full string on hover, and a line that FITS
//      carries none. (The second half is the design: an unconditional title
//      repeats a line you can already read, on every row of every board.)
//   2. NO tooltip anywhere in the app draws as one screen-wide line — every
//      title in the DOM is folded to lines of at most 44 characters.
//
// Rule 2 is the one that catches a regression cheaply: it walks every element
// carrying a title rather than a list someone has to remember to update.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as browsertest-mapconnections.mjs beside it.
//
// Run from anywhere:  node tools/studio-spike/drive-tooltips.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5204
const MEASURE = 44

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
    if (viteOut.includes('localhost:')) { clearTimeout(t); res() }
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

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(600)

// #234: BOTH the presets and the instrument switches live inside the palette pane,
// and picking a preset now CLOSES that pane — OB-106, shipped at `6b4742a`, after
// this file was written. So every preset click here hid the thing the next line
// reached for. Anything that reaches into the palette opens it first, and asks
// whether it is open rather than clicking blind, since a blind click on an open
// palette closes it.
//
// The hook is the toolbar button's stable handle, the same one `drive-palette.mjs`
// uses; OB-124 exists precisely so it does not move when the button's title does.
const openPalette = async () => {
  const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
  if ((await toggle.getAttribute('title')) !== 'hide the palette') {
    await toggle.click()
    await page.waitForTimeout(400)
  }
}

// open a few instruments so there is plenty of text on screen to measure.
// THIS WAS THE TREE PANEL until #265 retired it; any pane with text does, and the
// connections pane is the one that replaced it.
await page.getByLabel('studio-preset-plan').click()
await page.waitForTimeout(500)
await openPalette()
await page.getByLabel('studio-inst-connections').click()
await page.waitForTimeout(500)

// ── 1. useClipped: a cut line is titled, the SAME line untitled when it fits ──
// The conditionality is the design, so it is tested as a difference on ONE element
// rather than as a survey: an unconditional title and a conditional one look
// identical on a page where everything happens to be cut.
//
// The width is forced rather than found. Whether a given label clips depends on the
// corpus, the sidebar and the window, so a test that waits for a naturally clipped
// row is a test that silently stops checking anything when a title is shortened.
const ROW = '[aria-label="studio-inst-connections"]'
const LABEL = ROW + ' span'

// Which span in the row is the clipping one, and what does it say
const which = await page.evaluate((sel) => {
  const row = document.querySelector(sel)
  if (!row) return { found: false }
  const spans = [...row.querySelectorAll('span')]
  const i = spans.findIndex((n) => getComputedStyle(n).textOverflow === 'ellipsis')
  return i < 0 ? { found: false } : { found: true, index: i, text: (spans[i].textContent || '').trim() }
}, ROW)
ok('found an instrument label to squeeze', which.found, JSON.stringify(which))

const label = page.locator(LABEL).nth(which.index || 0)
const titleNow = () => label.getAttribute('title')
// A REAL mouse, not a synthetic event. React synthesises enter/leave from
// pointerover/pointerout at the root, so `dispatchEvent(new PointerEvent('pointerenter'))`
// never reaches an onPointerEnter handler — measured: the hook stayed silent on a
// span that was genuinely cut, and the bug was in the test, not the port.
const park = () => page.mouse.move(5, 5)

await park()
await label.hover()
await page.waitForTimeout(250)
const whenFits = await titleNow()
ok('a line that FITS gains no tooltip', !whenFits, JSON.stringify(whenFits))

// Narrow it with a STYLESHEET RULE, not an inline style: React owns this span's
// `style` attribute and rewrites it on the very re-render the hook causes, so an
// inline maxWidth is gone before the title could appear (measured — the squeeze
// read back as `max-width: ""`). A rule in a <style> tag is outside React's reach.
await page.addStyleTag({ content: `${LABEL} { max-width: 12px !important; }` })
await park()
await label.hover()
await page.waitForTimeout(250)
const whenCut = await titleNow()
const cutNow = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1)

ok('squeezing it really does cut it', cutNow)
ok('the SAME line, once cut, gains the whole string', whenCut === which.text,
  `title=${JSON.stringify(whenCut)} text=${JSON.stringify(which.text)}`)

await page.reload()
await page.waitForTimeout(600)
await page.getByLabel('studio-preset-plan').click()
await page.waitForTimeout(500)

// ── 2. wrapTip: no tooltip anywhere draws as one screen-wide line ─────────
// This walks EVERY element carrying a title rather than a list someone has to
// remember to update, which is what makes it cheap to keep true. It is swept over
// every preset and every instrument, because a tooltip only exists in the DOM
// while its instrument is on screen — a single-screen sweep passes by not looking.
const overLong = (measure) => page.evaluate((m) => {
  const bad = []
  for (const el of document.querySelectorAll('[title]')) {
    const t = el.getAttribute('title')
    if (!t) continue
    for (const line of t.split('\n')) {
      if (line.length > m) { bad.push({ tag: el.tagName.toLowerCase(), len: line.length, line: line.slice(0, 60) }); break }
    }
  }
  return bad
}, measure)

const PRESETS = ['present', 'explore', 'plan']
const INSTRUMENTS = ['map', 'walk', 'walkpalette', 'walkeditor', 'walkcolumns', 'walkstack',
  'unfold', 'unfoldgraph', 'contours', 'clusters', 'connections', 'document',
  'neighborhood', 'trail']

let swept = 0
let tipCount = 0
const wide = []
for (const preset of PRESETS) {
  await openPalette()
  await page.getByLabel(`studio-preset-${preset}`).click()
  await page.waitForTimeout(400)
  wide.push(...(await overLong(MEASURE)))
  tipCount += await page.$$eval('[title]', (els) => els.length)
  swept++
}
// then every instrument on its own, so nothing is missed by never being composed
await openPalette()
const missing = []
for (const inst of INSTRUMENTS) {
  const row = page.getByLabel(`studio-inst-${inst}`, { exact: true })
  // a name that is not on screen used to `continue` in silence, which is how the
  // closed palette above hid itself: the sweep skipped all fifteen instruments and
  // still reported a pass. A skip is now a recorded failure, not a shrug.
  if (!(await row.count())) { missing.push(inst); continue }
  await row.click()
  await page.waitForTimeout(350)
  wide.push(...(await overLong(MEASURE)))
  tipCount += await page.$$eval('[title]', (els) => els.length)
  swept++
  await row.click()
  await page.waitForTimeout(150)
}

ok(`every tooltip folds at ${MEASURE}, across ${swept} screens`, wide.length === 0,
  wide.length ? JSON.stringify(wide.slice(0, 5)) : 'no over-long lines')

ok('there are tooltips on the page to have checked', tipCount > 0, `${tipCount} titled elements`)

ok('every instrument named above was actually found and swept', missing.length === 0,
  missing.length ? `never found: ${missing.join(', ')}` : `all ${INSTRUMENTS.length}`)

// ── 3. aria-label keeps the UNFOLDED string ─────────────────────────────────
const folded = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('[title][aria-label]')) {
    const t = el.getAttribute('title') || ''
    const a = el.getAttribute('aria-label') || ''
    if (t.includes('\n')) out.push({ aria: a, ariaHasBreak: a.includes('\n') })
  }
  return out
})
ok('a folded tooltip leaves its aria-label unfolded', folded.every((f) => !f.ariaHasBreak),
  `${folded.length} folded-and-labelled elements`)

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
console.log(`surveyed ${tipCount} tooltips in the DOM`)
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
