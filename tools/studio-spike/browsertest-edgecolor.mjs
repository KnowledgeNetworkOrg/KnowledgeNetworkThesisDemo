// browsertest-edgecolor.mjs — no relation is drawn in the raw column (OB-123, #248).
//
// A TEST. `src/corpus/edgecolor.test.ts` proves the RULE with no browser: the five
// values in `EDGE_COLOR`/`MIXED_EDGE_COLOR` equal the `--edge-*` tokens they claim
// to mirror. This proves the values reach the SCREEN, which is a different claim and
// the one that can fail silently here.
//
// It can fail silently because of how these colours are delivered. They are handed
// to SVG `stroke` and `fill` PRESENTATION ATTRIBUTES, and a `var()` in that position
// does not resolve — measured: `stroke="var(--x)"` computes to `none`, not a parse
// error, so the shape just renders black and nothing reports it. `oklch()` in the
// same position DOES resolve. The unit test cannot tell those two cases apart; this
// reads what the browser actually computed.
//
// THE SWEEP IS OVER EVERY ELEMENT, not a list of selectors. Five relation colours are
// read by the map's arrows, the connections pane's curves and arrowheads, the lens
// pane's lines, the flat SVG, and every legend swatch in all of them — a list would
// go stale the first time one of those moved. So the page is asked the direct
// question instead: is any drawn colour, anywhere, one of the five raw hexes?
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-edgecolor.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5226

// What src/corpus/graph.ts held until 2026-09-03, as the browser reports them.
//
// `depends_on`'s old value, #94a3b8, IS DELIBERATELY NOT IN THIS LIST, and the
// omission is the interesting part. It is Tailwind's `slate-400` — the raw edge
// column was taken from Tailwind in the first place — so the app paints that exact
// rgb in places that have nothing to do with relations: `text-slate-400` on ordinary
// chrome, and three hardcoded literals found by the first run of this file
// (ConnectionsPane.tsx:958 and :1086, both neutral leader lines, and LensPane.tsx:311,
// a frontier label's ink). Forbidding the value outright would make this test claim
// "no relation is drawn raw" while actually asserting "nobody uses slate-400", which
// is a different and false claim.
//
// What covers `depends_on` instead: `src/corpus/edgecolor.test.ts` asserts its value
// equals `--edge-depends-on` and is NOT the raw twin, and the presence check below
// asserts the naturalised #ada291 really is painted. Between them, a revert is caught
// without this file pretending to a claim it cannot make.
const RAW = {
  'rgb(235, 104, 52)': 'uses #eb6834',
  'rgb(232, 123, 164)': 'see_also #e87ba4',
  'rgb(227, 73, 72)': 'implemented_with #e34948',
  'rgb(100, 116, 139)': 'mixed #64748b',
}
// what it holds now. `depends_on` is a hex and comes back as rgb(); the other four
// are oklch() and come back verbatim, which is itself worth asserting — an oklch
// that failed to parse would not appear here at all.
const NATURAL = [
  'rgb(173, 162, 145)',
  'oklch(0.6 0.14 42)',
  'oklch(0.6 0.14 322)',
  'oklch(0.6 0.14 20)',
  'oklch(0.52 0.035 255)',
]

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
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

/** every colour the page is actually painting, from the four properties these
 *  values are ever delivered through */
const paint = () =>
  page.evaluate(() => {
    const seen = new Map()
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      for (const prop of ['stroke', 'fill', 'backgroundColor', 'color']) {
        const v = cs[prop]
        if (!v || v === 'none' || v === 'rgba(0, 0, 0, 0)') continue
        seen.set(v, (seen.get(v) ?? 0) + 1)
      }
    }
    return [...seen].map(([v, n]) => ({ v, n }))
  })

const found = new Map()
let swept = 0

// three presets, because the relation colours live on different instruments: the
// map draws arrows, connections draws curves and swatches, explore composes both
for (const preset of ['plan', 'explore', 'present']) {
  await page.getByLabel(`studio-preset-${preset}`).click()
  await page.waitForTimeout(700)
  // a selection is what makes the map draw its typed relation overlay at all
  const cell = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-nested]')
    if (!svg) return null
    const b = svg.getBoundingClientRect()
    const y = b.y + b.height / 2
    for (let x = b.x + 10; x < b.x + b.width - 10; x += 6) {
      const el = document.elementFromPoint(x, y)
      if (el && (el.hasAttribute('data-terr') || el.hasAttribute('data-region'))) return { x, y }
    }
    return null
  })
  if (cell) {
    await page.mouse.click(cell.x, cell.y)
    await page.waitForTimeout(600)
  }
  for (const { v, n } of await paint()) found.set(v, (found.get(v) ?? 0) + n)
  swept++
  // a preset click closes the palette the next one is picked from (OB-106)
  const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
  if ((await toggle.getAttribute('title')) !== 'hide the palette') {
    await toggle.click()
    await page.waitForTimeout(400)
  }
}

ok('swept every preset', swept === 3, `${swept} of 3, ${found.size} distinct colours painted`)

// THE CHECK
const raws = [...found.keys()].filter((v) => RAW[v]).map((v) => `${RAW[v]} (${found.get(v)}×)`)
ok('no relation is drawn in the raw column any more', raws.length === 0, raws.join(', ') || 'none of the four')

// AND THE SWEEP FOUND THE NEW ONES, so a page that rendered nothing cannot pass the
// check above by painting no colours at all
const naturals = NATURAL.filter((v) => found.has(v))
ok('the naturalised relation colours ARE on screen', naturals.length > 0,
  `${naturals.length}/5 present: ${naturals.join(', ') || 'NONE — did anything render?'}`)

// an oklch() that failed to parse in a presentation attribute would compute to
// `none` and never reach the map above, so seeing one back is the delivery proof
ok('oklch() survived delivery through an SVG attribute',
  naturals.some((v) => v.startsWith('oklch(')), naturals.join(', '))

// the one the forbidden list above cannot speak for, asserted from the other side
ok('depends_on is painting its NATURALISED value, not the slate it shares with Tailwind',
  found.has('rgb(173, 162, 145)'), '#ada291 = --edge-depends-on')

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
