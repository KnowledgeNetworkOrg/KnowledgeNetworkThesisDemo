// Verification for the Compare tab (src/experiments/CompareView.tsx): the
// ⅔/⅓ two-pane layout mock with a togglable folder tree and three swappable
// instruments. Same pattern as the other spikes: createRequire ->
// playwright-core, msedge, headless, viewport 1750x950, collect
// pageerror/console errors, exit nonzero on any. The specific things worth
// provoking: (1) benched instruments must KEEP their state — grow an unfold
// tree, bench it behind Walk, bring it back, the circles must still be
// there; (2) picking the other pane's instrument must SWAP, not duplicate;
// (3) the tree sidebar must actually leave/return the layout when toggled.
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
await page.getByText('Compare —', { exact: false }).click()
await page.waitForTimeout(400)

const tree = page.locator('[aria-label="compare-tree"]')
const paneMap = page.locator('[aria-label="compare-pane-map"]')
const paneWalk = page.locator('[aria-label="compare-pane-walk"]')
const paneUnfold = page.locator('[aria-label="compare-pane-unfold"]')
const slotOf = (pane) => pane.getAttribute('data-slot')

// ── default arrangement ─────────────────────────────────────────────────
console.log('TREE visible =', await tree.isVisible(), '· header =', (await tree.locator('[aria-label="tree-panel"] .font-bold').first().textContent())?.trim())
console.log('SLOTS: map =', await slotOf(paneMap), '(expect A) · unfold =', await slotOf(paneUnfold), '(expect B) · walk mounted =', await paneWalk.count(), '(expect 0)')
await page.screenshot({ path: `${OUT}/compare-default.png` })
console.log('compare-default.png taken')

// ── grow unfold state so benching has something to preserve ─────────────
await paneUnfold.getByText('Trees & Heaps', { exact: true }).click()
await page.waitForTimeout(300)
const circlesBefore = await paneUnfold.locator('circle').count()
console.log('UNFOLD started: circles =', circlesBefore, '(expect >= 1)')

// ── bench unfold behind Walk (pick Walk in the unfold pane's header) ────
await paneUnfold.locator('header button', { hasText: 'Walk' }).click()
await page.waitForTimeout(300)
console.log('AFTER PICK WALK: walk =', await slotOf(paneWalk), '(expect B) · unfold =', await slotOf(paneUnfold), '(expect benched) · unfold hidden =', !(await paneUnfold.isVisible()))
await page.screenshot({ path: `${OUT}/compare-walkin.png` })
console.log('compare-walkin.png taken')

// ── swap the two visible panes via the ⇄ in the map header ──────────────
await page.locator('[aria-label="swap-map"]').click()
await page.waitForTimeout(300)
console.log('AFTER SWAP: map =', await slotOf(paneMap), '(expect B) · walk =', await slotOf(paneWalk), '(expect A)')

// ── start a real walk; the shared route should glow on the map pane ─────
await paneWalk.getByText('Trees & Heaps', { exact: true }).click()
await page.waitForTimeout(400)
console.log('WALK started — first stop rendered in pane =', await paneWalk.getByText('Trees & Heaps', { exact: true }).first().isVisible())
// extend one step so the shared route has an EDGE — that's what glows on the map
await paneWalk.getByText('Arrays & Lists', { exact: true }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/compare-walk-route.png` })
console.log('compare-walk-route.png taken (check map glow by eye)')

// ── bring unfold back (pick Unfold in the MAP pane's header) and confirm
//    its grown tree survived being benched ───────────────────────────────
await paneMap.locator('header button', { hasText: 'Unfold' }).click()
await page.waitForTimeout(300)
const circlesAfter = await paneUnfold.locator('circle').count()
console.log('UNFOLD back: slot =', await slotOf(paneUnfold), '(expect B) · circles =', circlesAfter, `(expect ${circlesBefore} — state preserved)`)
await page.screenshot({ path: `${OUT}/compare-unfold-back.png` })
console.log('compare-unfold-back.png taken')

// ── tree toggle: hide, then show again ──────────────────────────────────
await page.locator('[aria-label="toggle-tree"]').click()
await page.waitForTimeout(200)
console.log('TREE after toggle-off: count =', await tree.count(), '(expect 0)')
await page.screenshot({ path: `${OUT}/compare-notree.png` })
console.log('compare-notree.png taken')
await page.locator('[aria-label="toggle-tree"]').click()
await page.waitForTimeout(200)
console.log('TREE after toggle-on: visible =', await tree.isVisible())

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
