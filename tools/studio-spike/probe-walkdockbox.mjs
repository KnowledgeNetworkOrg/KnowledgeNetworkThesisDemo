// probe-walkdockbox.mjs — EVIDENCE TOOL for #365 (not a test).
//
// The question: section B of browsertest-walkdock.mjs read the map SVG's box 800ms after the
// reload, opened the dock, and required the box unchanged. On one run in nine it read the top
// edge 1px higher and the box 1px taller, the bottom edge where it was — and the box was still
// moved after the dock closed again. Two readings:
//   1. `before` was read before the page had settled: a webface (tokens/fonts.css, `font-display:
//      swap`) landed after it and redrew the text above the map, and the map moved on its own;
//   2. opening the dock really nudges the map by 1px on some runs.
//
// Three font conditions, each on a fresh browser context, so nothing is cached between them:
//   held    — every font response is fetched, then HELD until the driver's 800ms mark and let
//             through there: the late landing, forced, at the worst moment for the old sequence;
//   blocked — every font request fails, so the fallback face stays all run and nothing can
//             swap: whatever moves the map here, the dock did;
//   plain   — nothing touched: the driver's own conditions.
// Under each, two sequences, each on its own fresh load:
//   old — the driver before #365: 800ms, then before / open / 450ms / after / close / 450ms;
//   new — the driver after: the same, with its settle (every face in, the box still for 10
//         frames) between the 800ms mark and `before`. The settle is copied from the driver.
// and after either, five open/close cycles on a settled page — reading 2, asked directly.
//
// Throughout, IN THE PAGE and on the page's own clock: one line per change to the map's box,
// the height of what sits above the map in its pane, the pane's top, the font set's status and
// the dock's state; beside them every font event and every font file's request and response.
// Each box move is printed with its distance to the nearest font landing and the nearest dock
// change, so a move can be laid next to what caused it.
//
// Run from anywhere:  node tools/studio-spike/probe-walkdockbox.mjs [held] [blocked] [plain] [--repeat=N]
// No mode named runs all three; --repeat=N runs each chosen mode N times (the driver failed
// about one run in nine under plain conditions, so plain needs many to catch it).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = Number(process.env.PROBE_PORT || 5253)

const MODES = ['held', 'blocked', 'plain']
const args = process.argv.slice(2)
const unknown = args.filter((a) => !MODES.includes(a) && !a.startsWith('--repeat='))
if (unknown.length) {
  console.error(`unknown argument ${unknown.join(' ')} — the modes are ${MODES.join(', ')}, plus --repeat=N`)
  process.exit(1)
}
const modes = args.some((a) => MODES.includes(a)) ? MODES.filter((m) => args.includes(m)) : MODES
const repeatArg = args.find((a) => a.startsWith('--repeat='))
const repeat = repeatArg ? Math.max(1, Math.floor(Number(repeatArg.slice('--repeat='.length))) || 1) : 1

const FONTS = 'https://fonts.gstatic.com/**'
const CYCLES = 5

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

/** installed at document start on every page of a context: one entry per CHANGE, stamped in
 *  ms since this document's navigation began. Font files are collected by an observer, not
 *  read off the timeline buffer at the end — vite's dev server loads a few hundred modules,
 *  and the buffer's 250 entries are full before the fonts are asked for. */
const SAMPLER = () => {
  const p = (window.__probe = { frames: [], fontEvents: [], fontFiles: [], marks: [] })
  const now = () => Math.round(performance.now())
  for (const type of ['loading', 'loadingdone', 'loadingerror']) {
    document.fonts.addEventListener(type, (e) => p.fontEvents.push({ t: now(), type, faces: [...e.fontfaces].map((f) => f.family.replace(/["']/g, '')) }))
  }
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.name.includes('fonts.gstatic.com')) p.fontFiles.push({ file: e.name.split('/').pop(), start: Math.round(e.startTime), end: Math.round(e.responseEnd) })
    }
  }).observe({ type: 'resource', buffered: true })
  let last = ''
  const read = () => {
    const mapEl = document.querySelector('[aria-label="map-view"]')
    const svg = mapEl && mapEl.querySelector('svg')
    if (svg) {
      const r = svg.getBoundingClientRect()
      let above = 0
      for (let n = mapEl.previousElementSibling; n; n = n.previousElementSibling) above += n.getBoundingClientRect().height
      const frame = mapEl.closest('[data-pane-frame]')
      const dockEl = mapEl.querySelector('[data-walk-dock]')
      const s = { x: r.x, y: r.y, w: r.width, h: r.height, above, frameTop: frame ? frame.getBoundingClientRect().top : null, fonts: document.fonts.status, dock: dockEl ? dockEl.getAttribute('data-walk-dock') : null }
      const k = JSON.stringify(s)
      if (k !== last) { last = k; p.frames.push({ t: now(), ...s }) }
    }
    requestAnimationFrame(read)
  }
  requestAnimationFrame(read)
}

/** the driver's settle (#365), copied: every face in, then the map's box still for 10 frames */
const settle = (page) => page.evaluate(() => new Promise((res) => {
  const t0 = performance.now()
  let last = null
  let still = 0
  const f = () => {
    const svg = document.querySelector('[aria-label="map-view"] svg')
    const r = svg ? svg.getBoundingClientRect() : null
    const box = r ? `${r.x},${r.y},${r.width},${r.height}` : null
    const fontsIn = document.fonts.status === 'loaded'
    still = fontsIn && box !== null && box === last ? still + 1 : 0
    last = box
    const ms = Math.round(performance.now() - t0)
    if (still >= 10 || ms > 10000) res({ still, ms, fonts: document.fonts.status, box })
    else requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
}))

const sameBox = (a, b) => a && b && ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) < 0.5)

const browser = await chromium.launch({ channel: 'msedge', headless: true })

const run = async (mode, seq) => {
  const context = await browser.newContext({ viewport: { width: 1750, height: 950 } })
  await context.addInitScript(SAMPLER)
  let release
  const released = new Promise((r) => { release = r })
  if (mode === 'held') {
    await context.route(FONTS, async (route) => {
      // the bytes first, THEN the wait: letting a held font through is then instant, not a
      // network round trip that only starts at the release
      let response
      try { response = await route.fetch() } catch { return route.abort().catch(() => {}) }
      await released
      // a request from the page the reload replaced is gone by now; nothing to hand it
      await route.fulfill({ response }).catch(() => {})
    })
  } else if (mode === 'blocked') {
    await context.route(FONTS, (route) => route.abort())
  } else {
    release()
  }
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
  const map = page.locator('[aria-label="map-view"]')
  const svgBox = () => map.locator('svg').first().boundingBox()
  const mark = (name) => page.evaluate((name) => window.__probe.marks.push({ t: Math.round(performance.now()), name }), name)
  const openDock = async () => { await map.getByLabel('show every stop').click(); await page.waitForTimeout(450) }
  const closeDock = async () => { await map.getByLabel('hide the stops').click(); await page.waitForTimeout(450) }

  // the driver's opening, with one difference under `held`: a font still loading may hold the
  // page's load event, and the reload with it, so a held load waits for the map instead
  const waitUntil = mode === 'held' ? 'domcontentloaded' : 'load'
  await page.goto(`http://localhost:${PORT}/`, { waitUntil })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil })
  if (mode === 'held') await map.locator('svg').first().waitFor()
  await page.waitForTimeout(800)
  await mark('800ms')

  let before
  let settled = null
  if (seq === 'old') {
    before = await svgBox()
    await mark('before')
    release()
  } else {
    release()
    settled = await settle(page)
    before = await svgBox()
    await mark('before')
  }
  await mark('open')
  await openDock()
  const after = await svgBox()
  await mark('close')
  await closeDock()
  const afterClose = await svgBox()

  // READING 2, ASKED DIRECTLY: once the page has settled, does the dock move the map?
  const resettled = await settle(page)
  await mark('cycles')
  const cycles = []
  for (let i = 0; i < CYCLES; i++) {
    const b0 = await svgBox()
    await openDock()
    const b1 = await svgBox()
    await closeDock()
    const b2 = await svgBox()
    cycles.push({ open: sameBox(b0, b1), closed: sameBox(b0, b2), b0, b1, b2 })
  }

  const probe = await page.evaluate(() => window.__probe)
  await context.close()
  return { mode, seq, before, after, afterClose, settled, resettled, cycles, probe }
}

const n2 = (v) => (v === null || v === undefined ? '-' : v.toFixed(2))
const boxKey = (f) => `${f.x},${f.y},${f.w},${f.h}`
const nearest = (t, ts) => (ts.length ? Math.min(...ts.map((u) => Math.abs(u - t))) : null)

const report = (r) => {
  const { probe } = r
  console.log(`\n── ${r.mode} / ${r.seq} — ${r.seq === 'old' ? 'the driver before #365: 800ms, then measure' : 'the driver after: settle, then measure'} ──`)
  if (r.settled) console.log(`settle before measuring: ${JSON.stringify(r.settled)}`)
  console.log(`font files: ${probe.fontFiles.length ? probe.fontFiles.map((f) => `${f.file.slice(0, 14)}… ${f.start}→${f.end}ms`).join(' · ') : 'none recorded'}`)
  console.log(`font events: ${probe.fontEvents.map((e) => `${e.t}ms ${e.type} [${e.faces.join(', ')}]`).join(' · ') || 'none'}`)
  console.log(`marks: ${probe.marks.map((m) => `${m.name} ${m.t}ms`).join(' · ')}`)
  const landings = probe.fontEvents.filter((e) => e.type !== 'loading').map((e) => e.t)
  const dockChanges = probe.frames.filter((f, i) => i > 0 && f.dock !== probe.frames[i - 1].dock).map((f) => f.t)
  console.log('the map, one line per change (page clock):')
  for (const [i, f] of probe.frames.entries()) {
    const moved = i > 0 && boxKey(f) !== boxKey(probe.frames[i - 1])
    const why = moved ? `   ← BOX MOVED (nearest font landing ${nearest(f.t, landings) ?? 'none'}ms away, nearest dock change ${nearest(f.t, dockChanges) ?? 'none'}ms away)` : ''
    console.log(`  ${String(f.t).padStart(5)}ms  x ${n2(f.x)} y ${n2(f.y)} w ${n2(f.w)} h ${n2(f.h)}  above ${n2(f.above)}  paneTop ${n2(f.frameTop)}  fonts ${f.fonts}  dock ${f.dock}${why}`)
  }
  console.log(`THE MAP DID NOT MOVE: ${sameBox(r.before, r.after) ? 'PASS' : 'FAIL'}  ${JSON.stringify({ before: r.before, after: r.after })}`)
  console.log(`still without moving the map: ${sameBox(r.before, r.afterClose) ? 'PASS' : 'FAIL'}  ${JSON.stringify({ before: r.before, after: r.afterClose })}`)
  const bad = r.cycles.filter((c) => !c.open || !c.closed)
  console.log(`settled page (${JSON.stringify(r.resettled)}): ${bad.length} of ${r.cycles.length} open/close cycles moved the map${bad.length ? ' — ' + JSON.stringify(bad) : ''}`)
}

const results = []
for (const mode of modes) {
  for (let i = 0; i < repeat; i++) {
    for (const seq of ['old', 'new']) {
      const r = await run(mode, seq)
      report(r)
      results.push(r)
    }
  }
}

await browser.close()
vite.kill()

console.log('\n── summary ──')
console.log('mode     seq  did-not-move  still  settled cycles that moved the map')
for (const r of results) {
  const bad = r.cycles.filter((c) => !c.open || !c.closed).length
  console.log(`${r.mode.padEnd(8)} ${r.seq.padEnd(4)} ${(sameBox(r.before, r.after) ? 'PASS' : 'FAIL').padEnd(13)} ${(sameBox(r.before, r.afterClose) ? 'PASS' : 'FAIL').padEnd(6)} ${bad}/${r.cycles.length}`)
}
const cyclesRun = results.reduce((n, r) => n + r.cycles.length, 0)
const cyclesBad = results.reduce((n, r) => n + r.cycles.filter((c) => !c.open || !c.closed).length, 0)
console.log(`\non a settled page the dock moved the map in ${cyclesBad} of ${cyclesRun} open/close cycles${cyclesBad ? ' — READING 2 HAS EVIDENCE: the dock is not blameless' : ''}`)
const held = (seq) => results.filter((r) => r.mode === 'held' && r.seq === seq)
if (held('old').length) {
  const failsOld = held('old').filter((r) => !sameBox(r.before, r.after) || !sameBox(r.before, r.afterClose)).length
  const failsNew = held('new').filter((r) => !sameBox(r.before, r.after) || !sameBox(r.before, r.afterClose)).length
  console.log(`fonts landing just after the 800ms mark: the old sequence failed ${failsOld} of ${held('old').length} loads, the settled one ${failsNew} of ${held('new').length}`)
}
