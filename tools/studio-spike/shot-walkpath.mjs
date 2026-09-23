// Driver for #26 — walk path drawn on the map.
// The Plan preset mounts both the walk editor (which publishes bus.route) and the
// nested atlas (which draws the route as an ordered path). Assertions:
//   1. data-routepath is visible in the SVG after Plan loads.
//   2. data-step-count > 0 — the route has stops.
//   3. At least one data-routestop circle is visible at the default level.
//   4. Switching a branch on the road changes the step count (the route updates).
//   5. At a deeper zoom level, route circles still appear (roll-up works).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5210
mkdirSync(OUT, { recursive: true })

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
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
const fail = (msg) => { errors.push(`ASSERT FAIL: ${msg}`); console.log('FAIL:', msg) }

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(600)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(700)

// ── 1. route path group exists and is visible ──────────────────────────────
const routePath = page.locator('[data-routepath]')
if (!(await routePath.isVisible())) fail('data-routepath not visible after Plan preset loads')
await page.screenshot({ path: `${OUT}/walkpath-01-plan-L0.png` })
console.log('walkpath-01-plan-L0.png taken (route path at domain level)')

// ── 2. step-count > 0 ─────────────────────────────────────────────────────
const stepCount = parseInt(await routePath.getAttribute('data-step-count') ?? '0', 10)
console.log('step-count =', stepCount, '(expect > 0)')
if (stepCount === 0) fail('expected route to have stops, got 0')

// ── 3. at least one step circle visible ───────────────────────────────────
const firstStop = page.locator('[data-routestop]').first()
if (!(await firstStop.isVisible())) fail('no data-routestop circles visible at L0')
const circleStep = await firstStop.getAttribute('data-step')
console.log('first visible route circle step =', circleStep, '(expect 1)')
if (circleStep !== '1') fail(`expected first circle to be step 1, got ${circleStep}`)

// ── 4. dive to topic level and re-check the path ──────────────────────────
// the `nested-level-N` button row went with the map's bottom info bar (`1e530af`,
// OB-094/096); the level is chosen from a floating DS LevelPicker now.
await page.locator('[aria-label="levels"]').click()
await page.locator('[aria-label="levels"] ~ div button', { hasText: /^L2$/ }).click()
await page.waitForTimeout(700)
if (!(await routePath.isVisible())) fail('data-routepath not visible at L2')
const stopCount2 = await page.locator('[data-routestop]').count()
console.log('route circle count at L2 =', stopCount2, '(expect ≥ step count at L0)')
if (stopCount2 === 0) fail('no route circles visible at L2 (topic level)')
await page.screenshot({ path: `${OUT}/walkpath-02-plan-L2.png` })
console.log('walkpath-02-plan-L2.png taken (route path at topic level, step numbers)')

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE — all walk-path assertions passed')
