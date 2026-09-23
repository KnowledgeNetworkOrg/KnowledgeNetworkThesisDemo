// Verification for the Unfold·Graph trial (src/experiments/UnfoldGraphView.tsx),
// which replaced the Neighborhood tab. Same pattern as the other spikes:
// createRequire -> playwright-core, msedge, headless, viewport 1750x950,
// collect pageerror/console errors, exit nonzero on any. The behaviors worth
// provoking: (1) DEDUP — picking a link whose target is already on the map
// must NOT add a circle; (2) the revisit draws a dashed cross-link
// (path[data-revisit="true"]); (3) SNAP-BACK — the scroll position actually
// moves toward the existing node; (4) the map's "◳ open neighborhood" lands
// here with the pinned node already materialized.
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

// ── enter the trial tab, start at a hub ─────────────────────────────────
await page.getByRole('button', { name: /every node once, revisits snap back/ }).click()
await page.waitForTimeout(300)
console.log('PICKER visible =', await page.getByText('Start unfolding a graph').isVisible())
await page.getByRole('button', { name: /Trees & Heaps/ }).first().click()
await page.waitForTimeout(400)

const canvas = page.locator('[aria-label="unfoldg-canvas"]')
const nodesLoc = page.locator('circle[data-node]')
const panel = page.locator('[aria-label="unfoldg-list"]')
const scrollPos = () => canvas.evaluate((el) => ({ l: Math.round(el.scrollLeft), t: Math.round(el.scrollTop) }))

console.log('STARTED: nodes =', await nodesLoc.count(), '(expect 1) · panel open =', await panel.isVisible(), '· scroll =', await scrollPos(), '(expect near canvas center, not 0/0)')
await page.screenshot({ path: `${OUT}/unfoldg-start.png` })
console.log('unfoldg-start.png taken')

// ── grow a few fresh nodes first (exercises the radial placement), then
//    keep growing until a candidate row points at something already on the
//    map and click it — that's the revisit ─────────────────────────────────
for (let i = 0; i < 4; i++) {
  const fresh = panel.locator('button[data-onmap="false"]')
  if ((await fresh.count()) === 0) break
  await fresh.first().click()
  await page.waitForTimeout(500)
}
console.log('GROWN:', await nodesLoc.count(), 'nodes placed without collision-visible overlap (check png)')

let revisited = false
for (let i = 0; i < 12 && !revisited; i++) {
  const onmap = panel.locator('button[data-onmap="true"]')
  if ((await onmap.count()) > 0) {
    const before = await nodesLoc.count()
    const sBefore = await scrollPos()
    await page.screenshot({ path: `${OUT}/unfoldg-grown.png` })
    console.log(`unfoldg-grown.png taken (before revisit: ${before} nodes)`)
    await onmap.first().click()
    await page.waitForTimeout(1000) // let the smooth scroll travel
    const after = await nodesLoc.count()
    const sAfter = await scrollPos()
    const crossLinks = await page.locator('path[data-revisit="true"]').count()
    console.log('REVISIT: nodes', before, '→', after, '(expect equal) · dashed cross-links =', crossLinks, '(expect >= 1) · scroll moved =', sBefore.l !== sAfter.l || sBefore.t !== sAfter.t, `(${sBefore.l},${sBefore.t} → ${sAfter.l},${sAfter.t})`)
    revisited = true
  } else {
    await panel.locator('button[data-onmap]').first().click()
    await page.waitForTimeout(500)
  }
}
if (!revisited) {
  errors.push('never found an on-map candidate within 12 grow steps')
} else {
  await page.screenshot({ path: `${OUT}/unfoldg-snapback.png` })
  console.log('unfoldg-snapback.png taken (check flash pulse + dashed link by eye)')
}

// ── map glue: pin a capital on the Map tab, "◳ open neighborhood" must
//    land in the trial with that node as the start ───────────────────────
await page.getByRole('button', { name: /where is everything/ }).click()
await page.waitForTimeout(600)
const capital = page.locator('svg').getByText('Trees & Heaps', { exact: true }).first()
await capital.click()
await page.waitForTimeout(300)
let bar = page.getByText('◳ open neighborhood')
if (!(await bar.isVisible().catch(() => false))) {
  // label text may swallow pointer events — aim just above it, at the circle
  const bb = await capital.boundingBox()
  await page.mouse.click(bb.x + bb.width / 2, bb.y - 14)
  await page.waitForTimeout(300)
}
console.log('PINNED bar visible =', await bar.isVisible())
await bar.click()
await page.waitForTimeout(500)
console.log('GLUE: trial header =', await page.getByText('Unfold·Graph — trial: same unfold, but a graph').isVisible(), '· nodes =', await nodesLoc.count(), '(expect 1) · started at =', await page.locator('circle[data-node]').getAttribute('data-node'))
await page.screenshot({ path: `${OUT}/unfoldg-from-map.png` })
console.log('unfoldg-from-map.png taken')

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
