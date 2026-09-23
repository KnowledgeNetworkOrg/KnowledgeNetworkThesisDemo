// Verification for the Unfold tab (src/experiments/UnfoldView.tsx): a
// hand-grown node-link tree over the typed-edge graph, materialized one
// click at a time. Same pattern as the cockpit spike's scripts:
// createRequire -> playwright-core, msedge, headless, viewport 1750x950,
// collect pageerror/console errors, exit nonzero on any. The one thing
// worth specifically provoking here is a REVISIT — the list shows a node's
// edges in BOTH directions, so a materialized child's own list contains its
// tree-parent, and that's exactly the case where a naive keying scheme
// would collide. If React logs a duplicate-key warning, it shows up as a
// console error and fails this script.
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

await page.goto('http://localhost:3000')
await page.waitForTimeout(600)
await page.getByText('Unfold —', { exact: false }).click()
await page.waitForTimeout(400)

// ── picker screen ────────────────────────────────────────────────────────
console.log('PICKER: hub buttons visible =', await page.getByText('Trees & Heaps', { exact: true }).isVisible())
await page.screenshot({ path: `${OUT}/unfold-picker.png` })
console.log('unfold-picker.png taken')

// start at Trees & Heaps — a computed hub (six other topics are implemented
// with it), so results are comparable across spikes
await page.getByText('Trees & Heaps', { exact: true }).click()
await page.waitForTimeout(300)

const canvas = page.locator('[aria-label="unfold-canvas"]')
const list = page.locator('[aria-label="unfold-list"]')

console.log('ROOT: circles =', await canvas.locator('circle').count(), '(expect 1)')
console.log('ROOT: list auto-opened =', await list.isVisible())
await page.screenshot({ path: `${OUT}/unfold-root.png` })
console.log('unfold-root.png taken')

// materialize the first candidate row — whatever type it is
const firstRow = list.locator('button').first()
const firstRowText = (await firstRow.textContent())?.trim()
await firstRow.click()
await page.waitForTimeout(300)
console.log(`MATERIALIZED CHILD A: "${firstRowText}" — circles now =`, await canvas.locator('circle').count(), '(expect 2)')
console.log('EDGE LABEL rendered:', await canvas.locator('svg text').allTextContents())

// child A's own list just auto-opened (materialize() sets openKey to the
// new child) — its own edge back to the root is a real graph edge, so the
// root's title should appear as a candidate in child A's list too. Click it
// to force a deterministic revisit.
const rootTitle = (await page.locator('[aria-label="unfold-list"] .font-bold').first().textContent()) ?? ''
console.log('CHILD A LIST HEADER:', rootTitle)
const revisitRow = list.locator('button', { hasText: 'Trees & Heaps' })
const revisitCount = await revisitRow.count()
console.log('REVISIT CANDIDATE FOUND IN CHILD A LIST:', revisitCount > 0)
if (revisitCount > 0) {
  await revisitRow.first().click()
  await page.waitForTimeout(300)
  console.log('AFTER REVISIT CLICK: circles =', await canvas.locator('circle').count(), '(expect 3)')
  const revisitBadges = await canvas.locator('text', { hasText: '↺' }).count()
  console.log('REVISIT BADGES (↺) IN DOM:', revisitBadges, '(expect >= 1)')
}
await page.screenshot({ path: `${OUT}/unfold-revisit.png` })
console.log('unfold-revisit.png taken')

// one more level, from wherever openKey now points, to see a 3-deep tree
// with a branch that has more than one child (go back to the root's list —
// it may still have more candidates — and grow a second branch)
const rootCircle = canvas.locator('circle').first()
await rootCircle.click({ force: true })
await page.waitForTimeout(300)
const secondRow = list.locator('button').first()
if ((await secondRow.count()) > 0) {
  await secondRow.click()
  await page.waitForTimeout(300)
}
console.log('AFTER SECOND BRANCH: circles =', await canvas.locator('circle').count())
await page.screenshot({ path: `${OUT}/unfold-branches.png` })
console.log('unfold-branches.png taken')

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
