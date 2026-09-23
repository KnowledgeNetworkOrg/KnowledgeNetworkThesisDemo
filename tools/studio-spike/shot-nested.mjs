// Verification for the Walk Editor nested-node / subgroup fixes (#72), on the
// walk editor under the Plan preset. The draft SEED already paints the states these
// bugs live in — a fork (seed-sec, 2 versions), a plain group (seed-net), an
// optional leaf (web-sockets-apis), and plain leaves — so no authoring is needed
// to reach them; the Plan preset mount is enough.
//
// Same server-owning idiom as browsertest-studiodesk.mjs beside this file. Most of #72 is visual
// (arrowhead size, button/counter proportion, jiggle, wrap, selection outline) —
// the screenshots carry those. Two are asserted here:
//   #5 arrowhead — the road marker shrank from 7 to 5.
//   #9 optional-active — selecting the optional leaf shows the moss-wash
//      "selected" state on WalkActionBar's Optional pill; a required leaf releases it.
//      (#189 moved this off the road's own hand-rolled Optional button, deleted as
//      a duplicate of this one; PillButton exposes no aria-pressed, so this checks
//      its rendered inline style for the selected-wash token instead.)
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5200
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
    if (viteOut.includes('localhost:')) {
      clearTimeout(t)
      res()
    }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(600)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(500)

if (!(await page.locator('[data-walk-editor]').isVisible())) fail('walk editor not visible under Plan')
await page.screenshot({ path: `${OUT}/nested-01-initial.png` })
console.log('nested-01-initial.png taken (fork + group + optional leaf)')

// ── #5 arrowhead shrank → re-pointed by #113 H4 ────────────────────────────
// This guarded a HAND-TUNED markerWidth (5, was 7) on the road's own <marker>.
// The road now draws with the DS NodeArrow, so there is no marker and no local
// number — the head's size comes from ARROW_METRICS. Re-pointed rather than
// deleted: the regression it caught was an arrowhead sized by hand, which is
// exactly what adopting the component prevents. across = 4.4 * 2 + 3.
const arrowCount = await page.locator('[data-rarrow]').count()
const arrowSvgW = await page.locator('[data-rarrow] svg').first().getAttribute('width')
console.log(`road arrows = ${arrowCount}, NodeArrow across = ${arrowSvgW} (expect 11.8)`)
if (arrowCount === 0) fail('no [data-rarrow] on the road — arrows did not render')
if (arrowSvgW !== '11.8') fail(`expected NodeArrow across 11.8, got ${arrowSvgW}`)

// ── #9 optional-active toggles with the selection ──────────────────────────
const optBtn = page.locator('[aria-label="studio-pane-walkeditor"]').getByRole('button', { name: 'Optional', exact: true })
const isPressed = async () => ((await optBtn.getAttribute('style')) ?? '').includes('--moss-400')

// the optional leaf (web-sockets-apis, optional in the seed). Click to select it.
await page.locator('[data-node="web-sockets-apis"]').first().click()
await page.waitForTimeout(200)
const pressedOnOptional = await isPressed()
console.log('Optional pill shows selected wash with optional leaf selected =', pressedOnOptional, '(expect true)')
if (!pressedOnOptional) fail('expected Optional pill selected-wash on an optional leaf, got none')
await page.screenshot({ path: `${OUT}/nested-02-optional-selected.png` })
console.log('nested-02-optional-selected.png taken (amber-active Optional + selection outline)')

// a required leaf (the closing app-authentication-authorization leaf) releases it.
await page.locator('[data-node="app-authentication-authorization"]').first().click()
await page.waitForTimeout(200)
const pressedOnRequired = await isPressed()
console.log('Optional pill shows selected wash with required leaf selected =', pressedOnRequired, '(expect false)')
if (pressedOnRequired) fail('expected Optional pill selected-wash released on a required leaf, still present')

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE — all assertions passed')
