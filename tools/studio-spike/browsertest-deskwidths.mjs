// browsertest-deskwidths.mjs — OB-169 (#295): the Explore desk's width, measured from the DOM.
//
// A TEST. The Explore desk divides its width by a ratio typed into the preset (map /
// connections / document). `ConnectionsSplitPane` publishes `narrowBelow = 380`: under that
// MEASURED width the pane degrades (the split's clamp pair tightens and relationship cards
// shred their names to four characters). On `4b3ef1c` the pane was handed 325px at 1280 and
// 386 at 1512 — a 13" laptop never reached the split reading at all (#295, table 1). The
// owner's ruling (2026-09-09, DS OB-169): the MAP gives up a little width; the document pane
// stays a tall column and does not get smaller. OB-170 (draggable dividers) is the real
// answer and supersedes this; this is the ratio change that lands first.
//
// Every number is read from the DOM at a STATED viewport width (clause 4 — a width measured
// off a screenshot carries the scale it was measured at): the three panes' boxes, the split
// pane's own measured content width (the box `ConnectionsSplitPane` observes, `data-
// connections-split`), and the map's labels at the level the desk opens on.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-deskwidths.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5261

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
  return cond
}

/** the connections pane's published floor — `CONNECTIONS_PANE_METRICS.narrowBelow`, retyped
 *  here on purpose: a test that imported the number would agree with any value it took */
const NARROW_BELOW = 380
/** the DOCUMENT pane's box on `main` before this change, at each viewport — the "not smaller
 *  than it is today" of clause (1)/(2), read by this same driver on 2026-09-15: 325 and 386
 *  (the preset was map 1.8 / connections 1 / document 1, so document = row / 3.8; the new
 *  ratio keeps the same sum, so the document's share is the same number). One px of slack
 *  for the box's rounding. What the same run read for connections: a pane BOX of 325 / 386
 *  whose measured content was 315 / 376 — ten px of the pane's own padding — so the 15"
 *  laptop #295 said "clears by six" was under the floor too. */
const DOCUMENT_TODAY = { 1280: 324, 1512: 385 }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const pane = (id) => page.locator(`[aria-label="studio-pane-${id}"]`)
const widths = async () => {
  const box = async (id) => { const b = await pane(id).boundingBox(); return b ? Math.round(b.width) : null }
  const split = await page.locator('[data-connections-split]').first().evaluate((el) => ({ w: el.offsetWidth, mode: el.getAttribute('data-connections-split') })).catch(() => null)
  // every label the map draws (domain names at the atlas level the desk opens on, topic names deeper)
  const labels = await page.locator('[aria-label="studio-pane-map"] svg text').evaluateAll((els) => {
    // ON-SCREEN size (the font-size attribute is in the map's own units): the drawn box's height
    const hs = els.map((e) => e.getBoundingClientRect().height).filter((n) => n > 0)
    return { count: hs.length, min: hs.length ? Math.min(...hs) : 0 }
  })
  return { map: await box('map'), connections: await box('connections'), document: await box('document'), split, labels }
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(800)

  for (const [w, h] of [[1280, 800], [1512, 900]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(600)
    const m = await widths()
    console.log(`   [desk widths at ${w}×${h}] ${JSON.stringify(m)}`)
    ok(`at ${w} CSS px the three panes are on the desk`, m.map !== null && m.connections !== null && m.document !== null && !!m.split, JSON.stringify(m))
    ok(`OB-169: at ${w} the connections pane's MEASURED content width is at or above its published ${NARROW_BELOW}`, !!m.split && m.split.w >= NARROW_BELOW, `${m.split && m.split.w}px (pane box ${m.connections})`)
    ok(`and the document pane is not smaller than it is today (${DOCUMENT_TODAY[w]})`, m.document !== null && m.document >= DOCUMENT_TODAY[w], `${m.document}px`)
    ok(`the map pane still draws its labels at the level the desk opens on, none under 9px tall on screen`, m.labels.count >= 6 && m.labels.min >= 9, `${m.labels.count} labels, smallest ${m.labels.min.toFixed(1)}px tall`)
  }
} catch (e) {
  errors.push('exception: ' + (e && e.stack ? e.stack : String(e)))
}

await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => '  ' + e).join('\n'))
  process.exit(1)
}
console.log(`\nall ${checks.length} checks passed`)
