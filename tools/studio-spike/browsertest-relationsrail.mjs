// browsertest-relationsrail.mjs — #342, the dissolution's step 3.
//
// A TEST. It opens the real app in a real browser and asserts what a person sees: the relations
// rail on the Document pane, the figure (the app's own relation star) with its SENTENCE reading
// under it, the shared preview card raised from a figure node (OB-229), the empty/no-follow rule
// for a foreign hover and nothing chosen (OB-209), and the two-way lighting between the figure
// and the map (OB-230). OB-242 and OB-224 are asserted through the connections pane's own cards,
// whose single source this file shares (RelationCards.tsx) — the list header keeps its caps form
// (OB-242) and the source bracket keys off the target count (OB-224).
//
// WHAT IT SELECTS BY, AND WHY NOT TITLES. Every surface it needs has a data-* hook:
// `[data-relations-rail]` / `[data-relations-figure]` / `[data-relations-node]` /
// `[data-relations-reading]` (this mount's own, attributes only), `[data-tip-layer]` (the preview
// layer), `svg[data-spot]` (the map's spotlight), `svg[data-nested][data-sel]` (the map's
// selection), and `[data-rel-group-header]` (the cards' sentence header). A driver that found
// these by their words would break on the next copy change.
//
// THE MOUSE HAS TO TRAVEL (see browsertest-maphover.mjs): `mouse.move(x, y)` teleports, and the
// preview card is placed from the previous move, so every approach steps.
//
// Spawns vite ITSELF on its own fixed port (--strictPort). Run from anywhere:
//   node tools/studio-spike/browsertest-relationsrail.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5264

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
})
let viteOut = ''
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not become ready:\n' + viteOut)), 30000)
  const watch = (d) => { viteOut += String(d); if (viteOut.includes('localhost:')) { clearTimeout(t); res() } }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' - ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
/* WIDE ON PURPOSE: the relations rail's floor is `railFloor('right')` = 396 (min 186 + keep 210),
   and the document pane only reaches that at a large window — the default present preset shares
   one of ~4.4 flex weights, so at 1750 the document is ~340px and the rail refuses with its
   "widen this pane" note instead of drawing. */
const page = await browser.newPage({ viewport: { width: 2400, height: 1100 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
const park = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(140) }
const glideTo = async (p) => { await page.mouse.move(p.x, p.y, { steps: 14 }); await page.waitForTimeout(300) }

// ── 0. OB-209 — with nothing chosen, the document's rail sits empty ─────────
ok('the document pane is on the desk', await has('[aria-label="document-panel"]'))
ok('with nothing chosen the relations rail draws no figure', await has('[data-relations-rail]') && !(await has('[data-relations-node]')))
ok('and no reading under it', !(await has('[data-relations-reading]')))

// ── select a TOPIC with links, so the figure has real counterpart nodes ─────
// The rail starts closed; open it, then expand the WHOLE tree so topic rows are on screen. A
// topic with typed links is the figure's natural subject — its star draws counterparts. A deep
// node (below the topic grain) has no star of its own and an isolated topic has none, so the
// selection loop tries leaves until one yields figure nodes.
await page.locator('[data-explorer-corner] button').click()
await page.waitForTimeout(450)
for (let i = 0; i < 40; i++) {
  const closed = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
    const c = rows.find((r) => r.querySelector('[data-caret]') && r.getAttribute('data-open') === '0')
    return c ? c.getAttribute('data-node-id') : null
  })
  if (!closed) break
  const caret = page.locator(`[data-explorer-rail] [data-node-id="${closed}"] [data-caret]`).first()
  if ((await caret.count()) === 0) break
  await caret.click()
  await page.waitForTimeout(200)
}
let topicId = null
const allRows = await page.evaluate(() => [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
  .map((r) => r.getAttribute('data-node-id')).filter((id) => id && id !== 'root'))
for (const id of allRows) {
  await page.locator(`[data-explorer-rail] [data-node-id="${id}"]`).first().click()
  await page.waitForTimeout(300)
  const state = await page.evaluate(() => ({
    nodes: document.querySelectorAll('[data-relations-node]').length,
    reading: document.querySelector('[data-relations-reading]')?.textContent ?? '',
  }))
  // a TOPIC with typed links is what "direct relationship" means, and its reading is the only
  // branch that says "links across" — a domain/region reads "links only within itself".
  if (state.nodes > 0 && / across /.test(state.reading)) { topicId = id; break }
}
ok('found a node whose figure draws counterpart nodes', !!topicId, String(topicId))
if (topicId) {
  // ── 1. OB-229 — the figure is centred on the document, and its nodes raise the card ──
  ok('selecting the topic shows the relations figure centred on it',
    await page.evaluate((id) => document.querySelector('[data-relations-figure]')?.getAttribute('data-relations-figure') === id, topicId))
  ok('the figure draws its counterpart nodes', await has('[data-relations-node]'))

  // ── 2. OB-235 — the space under the figure is a READING, not a list ───────
  const reading = await page.evaluate(() => document.querySelector('[data-relations-reading]')?.textContent?.trim() ?? '')
  ok('the figure has a sentence reading under it', /link|reach|No typed links/.test(reading), JSON.stringify(reading))
  ok('the reading is not a re-listed card group', !/DIRECT|via children/i.test(reading), JSON.stringify(reading))

  // ── 3. OB-229 — a figure node's hover raises the shared preview card ──────
  // The card wrapper is the tip layer's only direct child with `pointer-events: none` (the
  // preview is deliberately pointer-transparent); the pane box is the other child.
  const CARD = '[data-tip-layer] > div[style*="pointer-events: none"]'
  const nodeBox = await page.locator('[data-relations-node]').first().boundingBox()
  if (nodeBox) {
    const nodeId = await page.locator('[data-relations-node]').first().getAttribute('data-relations-node')
    await park()
    ok('no card is up before the hover', !(await has(CARD)))
    await glideTo({ x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 })
    await page.waitForTimeout(500)
    ok('hovering a figure node raises the preview card', await has(CARD))
    const cardText = await page.evaluate((sel) => (document.querySelector(sel)?.textContent ?? '').trim(), CARD)
    ok('the card carries the node\'s name', cardText.length > 0 && cardText.length < 200, JSON.stringify(cardText.slice(0, 60)))
    // ── 4. OB-230 (figure → map) — the same hover lights the map's cell ─────
    ok('the figure hover lights the map (the spotlight)',
      await page.evaluate((id) => !!document.querySelector(`svg[data-nested] [data-spot]`), nodeId))
    await park()
    await page.waitForTimeout(260)
    ok('leaving the figure puts the map light out', !(await has('svg[data-nested] [data-spot]')))
  }

  // ── 5. OB-230 (map → figure) — a map hover lights the figure's matching node ──
  const cellPoint = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-nested]')
    if (!svg) return null
    const b = svg.getBoundingClientRect()
    for (let y = b.y + 12; y < b.y + b.height - 12; y += 10) {
      for (let x = b.x + 10; x < b.x + b.width - 10; x += 8) {
        const el = document.elementFromPoint(x, y)
        const id = el && (el.getAttribute('data-terr') || el.getAttribute('data-region'))
        if (!id) continue
        if (getComputedStyle(el).pointerEvents === 'none') continue
        if (!document.querySelector(`[data-relations-node="${id}"]`)) continue
        return { x, y, id }
      }
    }
    return null
  })
  if (cellPoint) {
    await park()
    await glideTo(cellPoint)
    await page.waitForTimeout(250)
    ok('a map hover on a neighbour lights the figure\'s matching node',
      await page.evaluate((id) => { const n = document.querySelector(`[data-relations-node="${id}"]`); return n ? getComputedStyle(n).opacity === '1' : false }, cellPoint.id))
    await park()
    await page.waitForTimeout(200)
  }

  // ── 6. OB-209 — a foreign (map) hover never re-aims the document ──────────
  ok('the document keeps its figure after a foreign hover',
    await page.evaluate((id) => document.querySelector('[data-relations-figure]')?.getAttribute('data-relations-figure') === id, topicId))
}

// ── 7. OB-242 — the connections pane's card header is UNCHANGED: caps, count, caret ──
await page.getByLabel('studio-inst-connections').click()
await page.waitForTimeout(800)
const headerForm = await page.evaluate(() => {
  const h = document.querySelector('[data-rel-group-header="direct"]')
  if (!h) return null
  const spans = [...h.children].filter((c) => c.tagName === 'SPAN' && !c.querySelector('svg'))
  const words = spans.map((s) => s.textContent).map((t) => t.trim()).filter(Boolean)
  // a sentence header leads with the count ("1 direct relationship"); the unchanged header leads
  // with the label word ("direct") and carries the count in a trailing span
  return { words, hasCaret: !!h.querySelector('svg') }
})
ok('the "direct" group header is the unchanged caps form, not a sentence',
  !!headerForm && headerForm.words[0] === 'direct' && headerForm.hasCaret, JSON.stringify(headerForm))
const viaForm = await page.evaluate(() => {
  const h = document.querySelector('[data-rel-group-header="via children"]')
  if (!h) return null
  const spans = [...h.children].filter((c) => c.tagName === 'SPAN' && !c.querySelector('svg'))
  return spans.map((s) => s.textContent).map((t) => t.trim()).filter(Boolean)
})
if (viaForm !== null) {
  ok('the "via children" header is the unchanged form too', viaForm[0] === 'via children', JSON.stringify(viaForm))
}

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
