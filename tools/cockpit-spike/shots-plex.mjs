// Follow-up verification for the plex (the radial relationship diagram that
// replaced the flat Jira-style Roads-from-here list). Same pattern as
// browsertest-studiodesk.mjs: createRequire -> playwright-core, msedge, headless, viewport
// 1750x950, collect pageerror/console errors, exit nonzero on any.
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
await page.getByText('Cockpit —', { exact: false }).click()
await page.waitForTimeout(500)

const plex = page.locator('[aria-label="plex-panel"]')

// ── container case: Computer Science (the default root) has no parent (it
// IS root) and no graph edges (edges are leaf-to-leaf only) — the plex
// should show only its 6 domain children plus the "containment only" note.
console.log('CONTAINER PLEX (Computer Science, the default root):')
console.log(`  circles: ${await plex.locator('circle').count()}`)
console.log(`  note text: "${((await plex.locator('div').last().textContent()) ?? '').trim()}"`)
await page.screenshot({ path: `${OUT}/plex-container.png` })
console.log('plex-container.png taken')

// ── leaf case: zoom into Computer Systems, select Binary & Data
// Representation — the same computed hub browsertest-studiodesk.mjs uses to demonstrate JUMP.
const sysLabel = page.locator('[aria-label="map-panel"] svg text', { hasText: 'Computer Systems' }).first()
const sysBox = await sysLabel.boundingBox()
if (!sysBox) throw new Error('could not find the Computer Systems label on the map')
await page.mouse.dblclick(sysBox.x + sysBox.width / 2, sysBox.y + sysBox.height / 2)
await page.waitForTimeout(400)
await page.getByText('Binary & Data Representation', { exact: true }).click()
await page.waitForTimeout(300)

console.log('LEAF PLEX (Binary & Data Representation, a computed hub):')
console.log(`  circles: ${await plex.locator('circle').count()} (center + parent + every road, split across up to 4 rings per side)`)
await page.screenshot({ path: `${OUT}/plex-hub.png` })
console.log('plex-hub.png taken')

// ── click a plex ring node directly (not the adjacent list) to prove the
// diagram itself is a real JUMP surface, not decoration. Modular Arithmetic
// is Binary & Data Representation's authored see-also neighbor — a
// deterministic cross-domain link into Mathematical Foundations.
const breadcrumbBefore = (await surfaceText('breadcrumb')).trim()
const target = plex.locator('circle').filter({ has: page.locator('title', { hasText: 'Modular Arithmetic' }) })
if ((await target.count()) === 0) throw new Error("Modular Arithmetic not found among Binary & Data Representation's plex neighbors — corpus assumption broke")
await target.first().click()
await page.waitForTimeout(400)
const breadcrumbAfter = (await surfaceText('breadcrumb')).trim()
const trailChips = await page.locator('[aria-label="trail-strip"] button[title*="·"]').allTextContents()
console.log('BREADCRUMB BEFORE PLEX CLICK:', breadcrumbBefore)
console.log('BREADCRUMB AFTER PLEX CLICK:', breadcrumbAfter)
console.log('LAST TRAIL CHIP:', JSON.stringify(trailChips.slice(-1)))
console.log(
  breadcrumbAfter !== breadcrumbBefore
    ? 'DIVERGENCE CONFIRMED: plex click JUMPed cross-domain'
    : 'DIVERGENCE NOT OBSERVED: investigate',
)
await page.screenshot({ path: `${OUT}/plex-jump.png` })
console.log('plex-jump.png taken')

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
