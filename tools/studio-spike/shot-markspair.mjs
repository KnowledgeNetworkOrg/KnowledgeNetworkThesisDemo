// #340 / OB-234 — the two rail marks, judged as a PAIR rather than one at a time.
//
// OB-234's own words: "an indented outline for a containment rail against a three-node
// cluster for a relations rail. Alone, neither shape is self-evident; the contrast is
// what makes both legible at 12px." So the thing to look at is not either mark — it is
// the two of them, at their shipped 12px, in the closed pill that will draw them.
//
// The screenshot carries the judgement; the assertions carry what must stay true:
//   - both draw in the same 16 viewBox at the same 1.4 stroke, so neither is a
//     different weight of ink than the other (the item's clause 4);
//   - both render a 12x12 box, in `currentColor` (clause 3);
//   - each sits in its pill WITH its word — a mark alone is a rebus (clause 2).
//
//   node tools/studio-spike/shot-markspair.mjs
// The frame lands in tools/studio-spike/out/ (gitignored). Nonzero on any failure.
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
const fail = (m) => { errors.push('ASSERT FAIL: ' + m); console.log('FAIL:', m) }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 720, height: 420 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://localhost:${PORT}/tools/studio-spike/markspair/`)
await page.waitForTimeout(400)

/** the geometry a mark actually drew, read off its SVG and the wrapper the specimen puts
 *  around it. The wrapper is found by its own hook: `[data-mark]` is on the ROW, whose first
 *  span is the row's 90px label — reading that as "the mark's box" was the wrong element
 *  every run and the log said 90. The row labels its mark wrapper `[data-mark-box]`. */
const markFacts = (sel) => page.evaluate((s) => {
  const svg = document.querySelector(s + ' svg')
  const box = document.querySelector(s + ' [data-mark-box]')
  if (!svg || !box) return null
  const r = svg.getBoundingClientRect()
  return {
    w: svg.getAttribute('width'),
    h: svg.getAttribute('height'),
    viewBox: svg.getAttribute('viewBox'),
    stroke: svg.getAttribute('stroke'),
    strokeWidth: svg.getAttribute('stroke-width'),
    paths: svg.querySelectorAll('path').length,
    circles: svg.querySelectorAll('circle').length,
    boxW: Math.round(r.width),
    boxH: Math.round(r.height),
    ink: getComputedStyle(svg).stroke,
    wrapperW: Math.round(box.getBoundingClientRect().width),
  }
}, sel)

const outline = await markFacts('[data-mark="outline"]')
const relations = await markFacts('[data-mark="relations"]')
console.log('outline  ', JSON.stringify(outline))
console.log('relations', JSON.stringify(relations))

for (const [name, m] of [['outline', outline], ['relations', relations]]) {
  if (!m) { fail(`${name}: the mark did not render`); continue }
  if (m.w !== '12' || m.h !== '12') fail(`${name}: rendered at ${m.w}x${m.h}, expected 12x12`)
  if (m.viewBox !== '0 0 16 16') fail(`${name}: viewBox ${m.viewBox}, expected 0 0 16 16`)
  if (m.strokeWidth !== '1.4') fail(`${name}: stroke-width ${m.strokeWidth}, expected 1.4`)
  if (m.stroke !== 'currentColor') fail(`${name}: stroke ${m.stroke}, expected currentColor`)
  if (m.boxW !== 12 || m.boxH !== 12) fail(`${name}: box ${m.boxW}x${m.boxH}, expected 12x12`)
  if (m.wrapperW !== 12) fail(`${name}: the mark's wrapper is ${m.wrapperW}px wide, expected 12`)
}
// the pair must be the SAME ink weight in the same box — that is the clause that makes
// them read as one set rather than two drawings that happen to sit together
if (outline && relations) {
  if (outline.strokeWidth !== relations.strokeWidth) fail('the two marks draw at different stroke widths')
  if (outline.viewBox !== relations.viewBox) fail('the two marks use different viewBoxes')
  if (outline.boxW !== relations.boxW || outline.boxH !== relations.boxH) fail('the two marks render different boxes')
  if (outline.paths !== 3) fail(`OutlineMark drew ${outline.paths} paths, expected 3 strokes`)
  if (relations.paths !== 3 || relations.circles !== 3) fail(`RelationsMark drew ${relations.paths} paths / ${relations.circles} circles, expected 3 / 3`)
}

// each mark sits in its pill WITH its word (OB-234 clause 2)
for (const [pill, word] of [['explorer', 'Explorer'], ['relations', 'Relations']]) {
  const text = await page.locator(`[data-pill="${pill}"]`).textContent()
  const hasSvg = await page.locator(`[data-pill="${pill}"] svg`).count()
  if (!text || !text.includes(word)) fail(`the ${pill} pill lost its word: "${text}"`)
  if (!hasSvg) fail(`the ${pill} pill has no mark`)
  console.log(`pill ${pill}: "${text}" with mark = ${hasSvg > 0}`)
}

await page.screenshot({ path: `${OUT}/marks-pair.png` })
console.log(`marks-pair.png taken (${OUT}/marks-pair.png)`)

await browser.close()
vite.kill()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('DONE — all assertions passed')
