// Part C verification for the Map-Tree-Walk cockpit spike (HANDOFF-COCKPIT-SPIKE.md
// §5). Follows the proven pattern from tools/evoc-spike/shots-evoc.mjs: createRequire
// -> playwright-core, msedge, headless, viewport 1750x950, collect pageerror/console
// errors, exit nonzero on any. Pulls DOM text (not just pixels) for the ground-truth
// claims: breadcrumb vs. trail divergence on JUMP, and the walk's remaining count.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const require = createRequire(join(REPO, 'package.json'))
const { chromium } = require('playwright-core')

const OUT = join(HERE, 'out')
const errors = []

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const surfaceText = async (label) => (await page.locator(`[aria-label="${label}"]`).textContent()) ?? ''

await page.goto('http://localhost:3000')
await page.waitForTimeout(600)

// ── open the Cockpit tab ────────────────────────────────────────────────────
await page.getByText('Cockpit —', { exact: false }).click()
await page.waitForTimeout(500)

// step 1: cockpit-initial — all five surfaces populated
console.log('SURFACE PRESENCE (chars of textContent):')
for (const label of ['breadcrumb', 'map-panel', 'tree-panel', 'knowledge-panel', 'trail-strip']) {
  const text = (await surfaceText(label)).trim()
  console.log(`  ${label}: ${text.length}${text.length === 0 ? '  <<< EMPTY' : ''}`)
}
await page.screenshot({ path: `${OUT}/cockpit-initial.png` })
console.log('cockpit-initial.png taken')

// step 2: cockpit-zoomed — double-click the Computer Systems region on the
// map. The label text itself is pointer-events:none (it's a caption on the
// rect beneath it), so click by coordinate rather than by locator, exactly
// like a real double-click on that spot would hit-test to the rect underneath.
const sysLabel = page.locator('[aria-label="map-panel"] svg text', { hasText: 'Computer Systems' }).first()
const sysBox = await sysLabel.boundingBox()
if (!sysBox) throw new Error('could not find the Computer Systems label on the map')
await page.mouse.dblclick(sysBox.x + sysBox.width / 2, sysBox.y + sysBox.height / 2)
await page.waitForTimeout(400)
const breadcrumbAfterZoom = (await surfaceText('breadcrumb')).trim()
console.log('BREADCRUMB AFTER ZOOM:', breadcrumbAfterZoom)
await page.screenshot({ path: `${OUT}/cockpit-zoomed.png` })
console.log('cockpit-zoomed.png taken')

// step 3: cockpit-jump — SELECT a leaf (now visible: zooming into Computer
// Systems re-roots the tree there, and its modules default-expand two levels
// deep), log the pre-jump breadcrumb + trail, then JUMP via a cross-domain link.
await page.getByText('Binary & Data Representation', { exact: true }).click()
await page.waitForTimeout(300)
const breadcrumbBeforeJump = (await surfaceText('breadcrumb')).trim()
const trailBeforeJump = (await surfaceText('trail-strip')).trim()
console.log('BREADCRUMB BEFORE JUMP:', breadcrumbBeforeJump)
console.log('TRAIL STRIP BEFORE JUMP (raw text):', trailBeforeJump)

// graph.ts's edges are authored in story order and edgesTouching() preserves
// it, so Binary & Data Representation's roads start with its intra-domain
// dependents (circuits, ISA) and END with its see-also to Modular Arithmetic
// — a deterministic cross-domain link into Mathematical Foundations.
// Picking last over first is deliberate: it forces the cross-domain JUMP.
const roads = page.locator('[aria-label="roads-from-here"] button')
const roadCount = await roads.count()
if (roadCount === 0) throw new Error('Binary & Data Representation (a computed hub) has no roads — corpus assumption broke')
console.log(`ROADS FROM HERE: ${roadCount} total, clicking the last (see comment above for why)`)
await roads.last().click()
await page.waitForTimeout(400)

const breadcrumbAfterJump = (await surfaceText('breadcrumb')).trim()
const trailChips = await page.locator('[aria-label="trail-strip"] button[title*="·"]').allTextContents()
const last4 = trailChips.slice(-4)
console.log('BREADCRUMB AFTER JUMP:', breadcrumbAfterJump)
console.log('LAST 4 TRAIL CHIPS AFTER JUMP:', JSON.stringify(last4))
console.log(
  breadcrumbAfterJump !== breadcrumbBeforeJump
    ? 'DIVERGENCE CONFIRMED: breadcrumb changed on jump'
    : 'DIVERGENCE NOT OBSERVED: breadcrumb unchanged — investigate',
)
await page.screenshot({ path: `${OUT}/cockpit-jump.png` })
console.log('cockpit-jump.png taken')

// step 4: cockpit-walk — activate Walk 1, advance to stop 5 of 12.
// Scoped to the trail strip specifically: if the current node is itself a
// walk stop, Knowledge panel's "Walks through here" renders a same-named
// button too — an unscoped locator would throw a strict-mode violation.
const trailStrip = page.locator('[aria-label="trail-strip"]')
await trailStrip.getByRole('button', { name: /From transistor to running program/ }).click()
await page.waitForTimeout(300)
for (let i = 0; i < 4; i++) {
  await trailStrip.getByRole('button', { name: 'next ▶' }).click()
  await page.waitForTimeout(200)
}
const walkAreaText = (await surfaceText('trail-strip')).trim()
const remainingMatch = walkAreaText.match(/stop \d+ of \d+[^0-9]*\d+ remaining/)
console.log('WALK STATUS:', remainingMatch ? remainingMatch[0] : '<<< pattern not found in: ' + walkAreaText)
await page.screenshot({ path: `${OUT}/cockpit-walk.png` })
console.log('cockpit-walk.png taken')

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
