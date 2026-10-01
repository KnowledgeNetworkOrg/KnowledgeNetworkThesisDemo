// browsertest-deskwidths.mjs — the Explore desk's width, measured from the DOM (OB-169, #295;
// two panes since #339).
//
// A TEST. The Explore desk divides its width by a ratio typed into the preset. Until #339 that
// was map / connections / document, and this driver held the connections pane to the 380px its
// split published as the width it degrades under (#295: a 13" laptop never reached the split
// reading; the owner ruled on 2026-09-09 that the MAP gives up width and the document does not
// get smaller). #339 retired that pane — its tree is the map's Explorer rail now and its
// relations the Document pane's Relations rail — so the desk is map / document, and the floor
// that matters is the DOCUMENT pane's: the Relations rail's own 396. OB-170 (draggable
// dividers) is still the real answer to all of this; the ratio is what lands first.
//
// Every number is read from the DOM at a STATED viewport width (OB-169 clause 4 — a width
// measured off a screenshot carries the scale it was measured at): the two panes' boxes, and
// the map's labels at the level the desk opens on.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-deskwidths.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}

/** the Relations rail's floor, retyped here on purpose: a test that imported the number would
 *  agree with any value it took. browsertest-relationsrail.mjs holds the document to it too. */
const RELATIONS_FLOOR = 396
/** the DOCUMENT pane's box under the three-pane desk, read by this driver on 2026-09-15: 325 and
 *  386 (one px of slack for the box's rounding). Retiring a pane must not shrink the document. */
const DOCUMENT_BEFORE = { 1280: 324, 1512: 385 }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const pane = (id) => page.locator(`[aria-label="studio-pane-${id}"]`)
const widths = async () => {
  const box = async (id) => { const b = await pane(id).boundingBox(); return b ? Math.round(b.width) : null }
  // every label the map draws (domain names at the atlas level the desk opens on, topic names deeper)
  const labels = await page.locator('[aria-label="studio-pane-map"] svg text').evaluateAll((els) => {
    // ON-SCREEN size (the font-size attribute is in the map's own units): the drawn box's height
    const hs = els.map((e) => e.getBoundingClientRect().height).filter((n) => n > 0)
    return { count: hs.length, min: hs.length ? Math.min(...hs) : 0 }
  })
  return { map: await box('map'), document: await box('document'), connections: await pane('connections').count(), labels }
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
    ok(`at ${w} CSS px the map and the document are on the desk`, m.map !== null && m.document !== null, JSON.stringify(m))
    ok(`#339: at ${w} there is no connections pane on the desk`, m.connections === 0, `${m.connections} found`)
    ok(`at ${w} the document pane is at or above the Relations rail's ${RELATIONS_FLOOR}`, m.document !== null && m.document >= RELATIONS_FLOOR, `${m.document}px`)
    ok(`and the document pane is not smaller than it was beside the connections pane (${DOCUMENT_BEFORE[w]})`, m.document !== null && m.document >= DOCUMENT_BEFORE[w], `${m.document}px`)
    ok(`the map pane is the wider of the two`, m.map !== null && m.document !== null && m.map > m.document, `${m.map} vs ${m.document}`)
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
