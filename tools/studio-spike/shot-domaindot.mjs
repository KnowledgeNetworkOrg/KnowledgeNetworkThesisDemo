// #97 — the DomainDot swap, shot and asserted.
//
// The three inline dots (walk step cards, palette hits, the layer-stack planes)
// are now the DS DomainDot. The swap is not neutral: the DS component reads the
// MUTED --domain-* tokens through src/ds/graph/vocab.ts, while the inline copies
// read the SATURATED authored hex from src/corpus/graph.ts. So every one of
// these surfaces re-tints on purpose (#62) — intended, but visible, which is why
// this exists.
//
// The screenshots are the point, but the assertion is what will still be true in
// six months: every domain swatch must paint a muted token and NONE may paint a
// raw hex. That catches a regression a screenshot review would wave through.
//
//   node tools/studio-spike/shot-domaindot.mjs
// Frames land in tools/studio-spike/out/ (gitignored). Nonzero on any failure.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5206
const TAG = process.argv[2] || 'after' // `before` when shooting the pre-swap tree
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

// the two palettes, as rgb() — what getComputedStyle hands back
const MUTED = { sys: 'rgb(74, 138, 60)', math: 'rgb(107, 92, 168)', cs: 'rgb(63, 123, 176)', net: 'rgb(61, 145, 153)', sec: 'rgb(192, 138, 46)', se: 'rgb(74, 165, 131)' }
const RAW = { sys: 'rgb(0, 131, 0)', math: 'rgb(74, 58, 167)', cs: 'rgb(42, 120, 214)', net: 'rgb(8, 145, 178)', sec: 'rgb(237, 161, 0)', se: 'rgb(27, 175, 122)' }

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
const fail = (m) => { errors.push('ASSERT FAIL: ' + m); console.log('FAIL:', m) }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(700)

/** every small round swatch INSIDE one pane, with the colour it actually paints.
 *  Scoped deliberately: the rest of the app still reads the saturated hex from
 *  corpus/graph.ts and is not part of this swap (#69 tracks those), so a
 *  page-wide probe would assert a migration nobody has agreed to yet. */
const swatchesIn = (pane) => page.evaluate((sel) => {
  const root = document.querySelector(sel)
  if (!root) return []
  const out = []
  for (const el of root.querySelectorAll('span, button')) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.width > 16 || Math.abs(r.width - r.height) > 1) continue
    if (!cs.borderRadius.startsWith('999') && !cs.borderRadius.includes('%') && parseFloat(cs.borderRadius) < r.width / 2 - 0.5) continue
    const bg = cs.backgroundColor
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue
    out.push({ bg, w: Math.round(r.width), pane: sel })
  }
  return out
}, pane)

// ── 1 · the palette's hit rows ─────────────────────────────────────────────
await page.getByLabel('studio-preset-plan').click()
await page.waitForTimeout(500)
await page.locator('[data-pal-search]').fill('network')
await page.waitForTimeout(300)
if ((await page.locator('[data-pal]').count()) === 0) fail('palette: "network" matched nothing, so there are no dots to check')
await page.locator('[aria-label="studio-pane-walkpalette"]').screenshot({ path: `${OUT}/dot-${TAG}-01-palette.png` })
console.log(`dot-${TAG}-01-palette.png taken`)
const palDots = await swatchesIn('[aria-label="studio-pane-walkpalette"]')

// ── 2 · the layer stack's planes ───────────────────────────────────────────
await page.locator('[data-pal-search]').fill('')
await page.getByLabel('studio-inst-walkstack').click()
await page.waitForTimeout(600)
const stack = page.locator('[aria-label="studio-pane-walkstack"]')
let stackDots = []
if (await stack.count()) {
  await stack.screenshot({ path: `${OUT}/dot-${TAG}-02-walkstack.png` })
  console.log(`dot-${TAG}-02-walkstack.png taken`)
  stackDots = await swatchesIn('[aria-label="studio-pane-walkstack"]')
} else fail('walkstack: the pane did not mount when its sidebar row was clicked')

// ── 3 · the walk's step cards ──────────────────────────────────────────────
await page.getByLabel('studio-preset-present').click()
await page.waitForTimeout(700)
const walk = page.locator('[aria-label="studio-pane-walk"]')
let walkDots = []
if (await walk.count()) {
  await walk.screenshot({ path: `${OUT}/dot-${TAG}-03-walk.png` })
  console.log(`dot-${TAG}-03-walk.png taken`)
  walkDots = await swatchesIn('[aria-label="studio-pane-walk"]')
} else fail('walk: the pane did not mount under the Present preset')

// ── the assertion ──────────────────────────────────────────────────────────
const all = [...palDots, ...stackDots, ...walkDots]
const muted = Object.values(MUTED)
const raw = Object.values(RAW)
const painted = all.filter((s) => muted.includes(s.bg) || raw.includes(s.bg))
const stillRaw = painted.filter((s) => raw.includes(s.bg))
console.log(`domain swatches found = ${painted.length}, still painting raw hex = ${stillRaw.length}`)
if (TAG === 'after') {
  if (painted.length === 0) fail('found no domain swatches at all — the probe is not seeing them, so the check is vacuous')
  if (stillRaw.length) fail(`${stillRaw.length} swatch(es) in the swapped panes still paint the saturated raw hex: ${[...new Set(stillRaw.map((s) => s.pane + ' ' + s.bg))].join(', ')}`)
} else {
  console.log('(before-shot: recording only, no assertion)')
}

await browser.close()
vite.kill()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('DONE — all assertions passed')
