// Part C verification: load the EVoC tab, switch color-by a few times,
// screenshot each, and pull the metrics table's ground truth via DOM text
// (not just pixels). Exits nonzero on any page/console error.
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto('http://localhost:3000')
await page.waitForTimeout(600)

await page.getByText('EVoC —', { exact: false }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/evoc-default.png` })
console.log('default coloring: coarsest EVoC layer — screenshot taken')

const metricsText = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('table')]
  const t = tables.find((tb) => tb.textContent?.includes('noise%'))
  return t ? t.textContent : null
})
console.log('METRICS TABLE TEXT:\n' + metricsText)

await page.getByRole('button', { name: /^graph \(\d+\)$/ }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/evoc-graph.png` })
console.log('colored by graph — screenshot taken')

await page.getByRole('button', { name: /^stage \(\d+\)$/ }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/evoc-stage.png` })
console.log('colored by stage — screenshot taken')

// hover a dot to confirm the tooltip renders with real data
const svg = page.locator('svg').first()
const box = await svg.boundingBox()
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/evoc-hover.png` })
  const tooltip = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')]
    const el = els.find((d) => d.textContent?.includes('cluster') && d.textContent?.includes('·'))
    return el ? el.textContent : null
  })
  console.log('TOOLTIP TEXT:', tooltip)
}

await browser.close()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE')
