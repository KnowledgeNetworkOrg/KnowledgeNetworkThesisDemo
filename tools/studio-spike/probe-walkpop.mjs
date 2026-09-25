// probe-walkpop.mjs — EVIDENCE TOOL for #374 (not a test).
//
// The question: since #372 the walkdock driver's "reaches the full pop, 1.36× rest"
// check reads a peak of 1.25–1.33 instead of 1.36. Is the pop still drawn on screen
// (the check reads the wrong moment) or has it stopped reaching full (a regression)?
//
// Two readings of the SAME play-through, one after the other:
//   A. IN THE PAGE, one reading per animation frame, from the play click onward —
//      the pin's own `transform`, read on every frame the page draws.
//   B. the driver's own reading, reproduced verbatim: a one-second rAF fps count
//      first, then 1400ms of `pinInfo()`/`arrowInfo()` samples about 30ms apart.
//
// Run from anywhere:  node tools/studio-spike/probe-walkpop.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = Number(process.env.PROBE_PORT || 5251)

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteOut = ''
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not become ready:\n' + viteOut)), 30000)
  const watch = (d) => { viteOut += String(d); if (viteOut.includes('localhost:')) { clearTimeout(t); res() } }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(800)

const map = page.locator('[aria-label="map-view"]')
const dock = () => map.locator('[data-walk-dock]')

// to L2 the way the driver does: two dives on the first pin's own cell
for (let dive = 0; dive < 2; dive++) {
  const b = await map.locator('[data-routestop]').first().boundingBox()
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(800)
}
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
console.log('level:', await page.$eval('[data-nested]', (el) => el.getAttribute('data-level')))

/** the driver's own reading: every drawn pin, in walk order, with its drawn scale */
const pinInfo = () => map.locator('[data-routestop]').evaluateAll((els) => els.map((el) => ({
  k: Number(el.getAttribute('data-pin')),
  scale: Number((/scale\(([-\d.e]+)\)/.exec(el.getAttribute('transform') || '') || [])[1]),
})).sort((a, b) => a.k - b.k))

await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(300)
const rest = await pinInfo()
const baseScale = rest[2].scale
console.log('rest pins:', JSON.stringify(rest), '→ baseScale', baseScale)

// ── A. one reading per drawn frame, in the page, from the play click on ──────
const frames = await page.evaluate(() => new Promise((res) => {
  const mapEl = document.querySelector('[aria-label="map-view"]')
  mapEl.querySelector('[aria-label="play the walk"]').click()
  const cameraScale = (el) => { const m = /scale\(([-\d.e]+)\)/.exec(el.getAttribute('transform') || ''); return m ? Number(m[1]) : null }
  const out = []
  const t0 = performance.now()
  const read = (now) => {
    const t = Math.round(now - t0)
    const scene = document.querySelector('[aria-label="map-view"] svg > defs + g')
    const pins = [...mapEl.querySelectorAll('[data-routestop]')].map((el) => ({
      k: Number(el.getAttribute('data-pin')),
      s: Number((/scale\(([-\d.e]+)\)/.exec(el.getAttribute('transform') || '') || [])[1]),
    }))
    const dockEl = mapEl.querySelector('[data-walk-dock]')
    const readout = dockEl ? (dockEl.textContent.match(/\d+ \/ \d+/) || [null])[0] : null
    out.push({ t, cam: scene ? cameraScale(scene) : null, pins, readout })
    if (t < 3600) requestAnimationFrame(read)
    else res(out)
  }
  requestAnimationFrame(read)
}))
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(150)

const scaleAt = (fr, k) => fr.pins.find((p) => p.k === k)?.s
const ks = [...new Set(frames.flatMap((f) => f.pins.map((p) => p.k)))].sort((a, b) => a - b)
console.log('\n── A. in-page, one reading per frame ──')
for (const k of ks) {
  const pts = frames.filter((f) => scaleAt(f, k) !== undefined).map((f) => ({ t: f.t, s: scaleAt(f, k) }))
  const max = Math.max(...pts.map((p) => p.s))
  const plateau = pts.filter((p) => p.s >= max - 1e-9)
  console.log(`pin k=${k}: max ${max.toFixed(6)} (ratio ${(max / baseScale).toFixed(4)}) over ${pts.length} frames; at its max ${plateau[0].t}..${plateau[plateau.length - 1].t}ms (${plateau.length} frames, ${plateau[plateau.length - 1].t - plateau[0].t}ms)`)
}
const k1 = frames.filter((f) => scaleAt(f, 1) !== undefined).map((f) => ({ t: f.t, r: scaleAt(f, 1) / baseScale }))
console.log('\npin k=1 ratio per frame (t:ratio):')
console.log(k1.map((p) => `${p.t}:${p.r.toFixed(4)}`).join('  '))
console.log('\ncamera scales seen:', JSON.stringify([...new Set(frames.map((f) => f.cam))]))
console.log('readout timeline:', frames.filter((f, i) => i === 0 || f.readout !== frames[i - 1].readout).map((f) => `${f.t}ms ${f.readout}`).join(' · '))

// ── B. the driver's own reading, reproduced verbatim ────────────────────────
await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(200)
const base2 = (await pinInfo())[2].scale
await map.getByLabel('play the walk').click()
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0
  const t0 = performance.now()
  const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n) }
  requestAnimationFrame(f)
}))
const samples = []
const tStart = Date.now()
while (Date.now() - tStart < 1400) {
  samples.push(await pinInfo())
  await page.waitForTimeout(30)
}
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(150)
const seen1 = samples.map((s) => s.find((p) => p.k === 1)?.scale).filter((v) => v !== undefined)
console.log('\n── B. the driver\'s own reading, reproduced ──')
console.log(`fps ${fps}; samples ${samples.length}; pin k=1 seen in ${seen1.length}; max ${Math.max(...seen1).toFixed(6)} → ratio ${(Math.max(...seen1) / base2).toFixed(4)}`)

await browser.close()
vite.kill()
