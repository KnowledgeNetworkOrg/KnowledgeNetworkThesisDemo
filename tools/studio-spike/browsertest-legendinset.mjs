// browsertest-legendinset.mjs — OB-143 (#269).
//
// A TEST. It opens the real app in a real browser and measures what a person sees:
// on every pane whose body starts with text, the first letter of the pane's legend
// and the first letter of the body's first line share a left edge, within a pixel.
//
// WHAT IS MEASURED, AND WHY TWO NUMBERS. The clause is written about LETTERS, so the
// assertion is on the glyph box: a DOM Range over the first non-empty text node on each
// side, whose bounding rect starts at the first glyph's ink. Two different fonts sit on
// the two sides (the legend is the display face at 15px, a body is the UI face at
// 11–12px), and a glyph's left side bearing differs by face and size by well under a
// pixel — which is what the clause's ±1px is for. The content-box left of each text's
// parent is printed beside it: that is the number the code SETS (21 on both sides), and
// when the glyph delta ever drifts, the pair says whether it was the geometry or the font.
//
// WHICH PANES. The eight bodies that start with text are padded and asserted; a body that
// starts with a FRAMED object (the map's canvas, the palette's search box, the walk
// viewer's strip) is not padded and not asserted — the item's clause (5) says that case
// is judged by eye and named on the receipt, and this file names what it skipped so a
// reader can see the split was made rather than missed. A run that finds fewer padded
// panes than it expects FAILS: an empty sweep must not read as a clean one.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-legendinset.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5231
const TOLERANCE = 1

/** legend title → instrument id, for the panes this item pads. Titles are what the
 *  legend actually prints (lower case), so the report reads like the screen. */
const PADDED = {
  document: 'document',
  trail: 'trail',
  'walk·columns': 'walkcolumns',
  unfold: 'unfold',
  'unfold·graph': 'unfoldgraph',
  walk: 'walk',
}

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

// SELECT A NODE FIRST (#342). With nothing chosen the document pane draws a centred
// "Nothing chosen" placeholder (DS OB-209) — a body that starts with a FRAMED object, which
// this item's clause (5) leaves to the eye — so the pane's text only starts under the legend
// once a node is being read. The opening composition carries the map; click one of its cells.
const cell = await page.evaluate(() => {
  const svg = document.querySelector('svg[data-nested]')
  if (!svg) return null
  const b = svg.getBoundingClientRect()
  for (let y = b.y + b.height * 0.3; y < b.y + b.height * 0.7; y += 12) {
    for (let x = b.x + b.width * 0.3; x < b.x + b.width * 0.7; x += 12) {
      const el = document.elementFromPoint(x, y)
      const id = el && (el.getAttribute('data-terr') || el.getAttribute('data-region'))
      if (id && getComputedStyle(el).pointerEvents !== 'none') return { x, y, id }
    }
  }
  return null
})
ok('a map cell was found to select, so the document pane has a node to read', !!cell, JSON.stringify(cell))
if (cell) {
  await page.mouse.click(cell.x, cell.y)
  await page.waitForTimeout(400)
  await page.mouse.move(5, 5)
}

/** every pane on the desk: its legend text and where the first glyph of the legend and of
 *  the body's first line each begin. Measured in the page. */
const measure = () => page.evaluate(() => {
  const firstText = (root) => {
    if (!root) return null
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const el = n.parentElement
      if (!el || !el.offsetParent) continue // display:none / detached
      const r = document.createRange()
      r.selectNodeContents(n)
      const b = r.getBoundingClientRect()
      if (b.width === 0) continue
      const cs = getComputedStyle(el)
      const eb = el.getBoundingClientRect()
      return {
        text: n.textContent.trim().slice(0, 40),
        glyphLeft: b.left,
        contentLeft: eb.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth),
        tag: el.tagName.toLowerCase(),
      }
    }
    return null
  }
  return [...document.querySelectorAll('[data-pane-frame]')].map((frame) => {
    const header = frame.children[0]
    const body = frame.querySelector('[data-pane-body]')
    return {
      frameLeft: frame.getBoundingClientRect().left,
      legend: firstText(header),
      body: firstText(body),
    }
  })
})

const seen = new Map() // legend title -> measurement, first sighting wins
const collect = async (label) => {
  const panes = await measure()
  for (const p of panes) {
    const title = p.legend?.text?.toLowerCase()
    if (!title || seen.has(title)) continue
    seen.set(title, { ...p, where: label })
  }
}

/** OB-106: picking a preset CLOSES the palette pane the presets and instruments live in, so
 *  every click into it first makes sure it is open — read off the toggle's title rather
 *  than clicking blind, the same helper drive-tooltips.mjs carries. */
const openPalette = async () => {
  const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
  if ((await toggle.getAttribute('title')) !== 'hide the palette') {
    await toggle.click()
    await page.waitForTimeout(400)
  }
}

// ── the three presets, then the padded instruments that no preset shows ───────
for (const preset of ['present', 'explore', 'plan']) {
  await openPalette()
  await page.getByLabel(`studio-preset-${preset}`).click()
  await page.waitForTimeout(500)
  await collect(preset)
}
for (const inst of Object.values(PADDED)) {
  if ([...seen.values()].some((p) => PADDED[p.legend.text.toLowerCase()] === inst)) continue
  await openPalette()
  const toggle = page.getByLabel(`studio-inst-${inst}`, { exact: true })
  if (!(await toggle.count())) continue
  await toggle.click()
  await page.waitForTimeout(400)
  await collect('added ' + inst)
}

// ── the guard: the sweep found the panes it is about ─────────────────────────
const found = Object.keys(PADDED).filter((t) => seen.has(t))
ok('every padded pane was on screen at some point', found.length === Object.keys(PADDED).length,
  `${found.length}/${Object.keys(PADDED).length}: ${found.join(', ')}` +
  (found.length < Object.keys(PADDED).length ? ` — missing ${Object.keys(PADDED).filter((t) => !seen.has(t)).join(', ')}` : ''))

// ── the claim, per pane ─────────────────────────────────────────────────────
for (const title of found) {
  const p = seen.get(title)
  if (!p.body) { ok(`${title}: the body has a first line of text to measure`, false, 'none found'); continue }
  const glyph = p.body.glyphLeft - p.legend.glyphLeft
  const box = p.body.contentLeft - p.legend.contentLeft
  ok(`${title}: the body's first letter shares the legend's left edge (±${TOLERANCE}px)`,
    Math.abs(glyph) <= TOLERANCE,
    `glyph Δ ${glyph.toFixed(2)}px, content-box Δ ${box.toFixed(2)}px · legend "${p.legend.text}" vs body "${p.body.text}" (${p.where})`)
}

// ── named, not asserted: the bodies that start with something framed ────────
const skipped = [...seen.entries()].filter(([t]) => !(t in PADDED))
checks.push(`INFO  not padded, judged by eye per clause (5): ${skipped.map(([t, p]) => `${t} (body starts "${p.body?.text ?? '—'}")`).join('; ') || 'none on screen'}`)

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => ' - ' + e).join('\n'))
  process.exit(1)
}
console.log(`\n${checks.filter((c) => c.startsWith('PASS')).length} checks passed`)
