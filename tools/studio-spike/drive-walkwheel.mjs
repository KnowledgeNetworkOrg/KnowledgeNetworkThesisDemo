// OB-103 — WalkStrip's wheel-to-step handler, which the original port never took.
//
// A unit test cannot reach this. The handler reads `trackRef.scrollWidth` against
// `clientWidth` to decide whether there is anything to scroll at all, snaps to
// waypoints computed from that same live geometry, and is bound through React's
// own `onWheel` — which React attaches at the ROOT as a PASSIVE listener, so the
// `preventDefault()` inside it may be a no-op. Only a browser says whether the
// steps actually move.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-present.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-walkwheel.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
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
const notes = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
// DELIBERATELY NARROW. `scrollable` is false when the whole walk already fits,
// and the wheel handler then does nothing at all — correctly. At 1750px the demo's
// 12-node walk fits the strip outright and this driver proves nothing; 760 makes
// the track overflow, which is the only state the handler has anything to say in.
const page = await browser.newPage({ viewport: { width: 760, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  const text = m.text()
  // THE PASSIVE-LISTENER MESSAGE IS THE POINT OF THIS DRIVER, not a failure to
  // abort on — React binds onWheel passively at the root, so preventDefault may
  // be refused. Collected and PRINTED rather than thrown, because the handler
  // still works without it; the assertions below are what decide.
  if (/preventDefault/i.test(text)) {
    notes.push(m.type() + ': ' + text)
    return
  }
  if (m.type() === 'error') errors.push('console: ' + text)
})

const strip = () => page.locator('[aria-label="walk-viewer"]')
// the seek bar's own percentage readout — the strip's published view of `nearest`
const pct = async () => Number((await strip().locator('text=/^\\d+%$/').first().innerText()).replace('%', ''))

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

ok('Walk·Viewer is in the opening composition', (await strip().count()) === 1)

// ── give the strip a walk long enough to overflow its track ─────────────────
// `scrollable` is false on a walk that already fits, and the wheel handler
// deliberately does nothing then — so a driver that skips this proves nothing.
await page.getByLabel('studio-inst-trail').click()
await page.waitForTimeout(400)
const play = page.locator('[aria-label="trail-strip"]').getByRole('button').filter({ hasText: '▶' }).first()
if ((await play.count()) === 0) {
  console.error('no saved walk offered by the Trail — nothing to wheel over')
  await browser.close()
  vite.kill()
  process.exit(1)
}
await play.click()
await page.waitForTimeout(600)

const count = Number((await strip().innerText()).match(/(\d+)\s+nodes?/)[1])
const scrollable = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="walk-viewer"] [data-sb-off]')
  return !!el && el.scrollWidth - el.clientWidth > 1
})
ok('the walk overflows its track, so the handler is live at all', scrollable, `${count} nodes`)

// ── one notch = one waypoint ───────────────────────────────────────────────
const box = await strip().boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(150)

const step = Math.round(100 / (count - 1))
const before = await pct()
await page.mouse.wheel(0, 40) // exactly WHEEL_STEP_PX
await page.waitForTimeout(350)
const after = await pct()
ok('one 40px notch advances exactly one waypoint', after - before === step, `${before}% → ${after}% (one step = ${step}%)`)

// and the remainder is CARRIED, not dropped: two half-notches make one step
await page.mouse.wheel(0, 20)
await page.waitForTimeout(200)
const half = await pct()
ok('half a notch alone moves nothing', half === after, `${after}% → ${half}%`)
await page.mouse.wheel(0, 20)
await page.waitForTimeout(300)
const carried = await pct()
ok('the accumulated remainder commits the step', carried - after === step, `${after}% → ${carried}%`)

// ── and it goes back ───────────────────────────────────────────────────────
await page.mouse.wheel(0, -40)
await page.waitForTimeout(300)
ok('a backward notch steps back', (await pct()) === after, `back to ${after}%`)

await page.screenshot({ path: OUT + '/walkwheel.png' })
await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (notes.length) console.log('\nnotes (not failures):\n' + notes.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/walkwheel.png')
