// probe-roadstopclip.mjs — DS OB-217's line-count pair, read off OUR build in Firefox and Chromium.
//
// A MEASUREMENT, not a test: it prints the two line columns the obligation asks the receipt to
// carry ("report the Firefox line columns in the receipt either way"), for the page in
// `roadstopclip/` — two road stops titled "Transistors & Logic Gates", required and optional, at
// the road's own bounds. It exits nonzero only if an engine DRAWS more lines than `chipSizeOf`
// predicted, or a box is more than 0.5px short of its own text: that is the crop OB-217 fixed.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/probe-roadstopclip.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium, firefox } = require('playwright-core')

const { vite, port: PORT } = await startVite()

let bad = 0
try {
  for (const engine of ['firefox', 'chromium']) {
    const browser = engine === 'firefox' ? await firefox.launch({ headless: true }) : await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 700, height: 500 } })
    page.on('pageerror', (e) => { bad++; console.log(`${engine} pageerror: ${e.message}`) })
    await page.goto(`http://localhost:${PORT}/tools/studio-spike/roadstopclip/index.html`)
    await page.waitForFunction(() => window.__roadStopRows, null, { timeout: 20000 })
    const { safety, rows } = await page.evaluate(() => window.__roadStopRows)
    const version = browser.version()
    console.log(`\n${engine} ${version} — WRAP_SAFETY_PX ${safety}`)
    console.log('  stop               predicted box    title column  titleLines  lines DRAWN  line-height  height needed  verdict')
    for (const r of rows) {
      const verdict = r.drawnLines > r.predLines ? 'UNDERCOUNT' : r.short > 0.5 ? `+${r.short} SHORT` : 'fits'
      if (verdict !== 'fits') bad++
      console.log(`  ${r.label.padEnd(18)} ${(r.width + ' x ' + r.predH).padEnd(16)} ${String(r.column).padEnd(13)} ${String(r.predLines).padEnd(11)} ${String(r.drawnLines).padEnd(12)} ${String(r.lineH).padEnd(12)} ${String(r.needed).padEnd(14)} ${verdict}`)
    }
    await browser.close()
  }
} finally {
  vite.kill()
}
process.exit(bad ? 1 : 0)
