// browsertest-firstline.mjs — OB-249 (#358).
//
// A TEST. It opens the real app in a real browser with the palette, the map and the document
// docked side by side, and measures what a person sees: every pane's first line of text sits
// the same distance below its own frame's top edge, so the three read level.
//
// WHAT IS MEASURED. For each pane, the distance from the frame's top edge to the top of the first
// line's text, taken the way `browsertest-legendinset.mjs` takes its glyph edge: a DOM Range over
// the first non-empty text node, whose bounding rect starts at the glyph box. The frame has a 1px
// border, so BOTH readings are printed — from the outer edge (what the card's "frame's top edge"
// most plainly says, and what is asserted) and from the inside of the border.
//
//   the Explorer rail's head   — the "Explorer" eyebrow, in the map pane's left rail
//   the map's breadcrumb       — the first crumb, in the bar over the map canvas
//   the document's eyebrow     — the kind word ("topic" / "container" / "leaf") over its title
//   the palette's presets      — the "presets" section label
//
// THE FIRST THREE ARE ASSERTED AT 25 ±1. THE PALETTE IS REPORTED AND BOUNDED, NOT HELD TO ±1: its
// "presets" label is 12px where the others are smaller, so the label's own box sits about a pixel
// and a third low even with the pad exactly right. The owner saw that on 2026-09-22 and said to
// leave it; nudging it here to make the number round would undo that decision. It is bounded so a
// return of the old `pt-2` (+31) still fails.
//
// THE RELATIONS RAIL'S HEAD MUST NOT MOVE. It sits under a header row of its own, not at the
// pane's first line, and OB-249 leaves it at 6. It is not measured against 25; its scroller's top
// padding is asserted at 6px and the head's offset is printed beside it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-firstline.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5266
const FIRST_LINE = 25 // the chosen line, DS OB-249 — restated here on purpose: a test pins the number the design side gave
const TOLERANCE = 1
const PALETTE_SLACK = 3 // "presets" sits ~1.3 low by decision; the old pt-2 sat at ~+6, past this

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

/** picking a preset CLOSES the palette (OB-106), so open it by reading the toggle's title rather
 *  than clicking blind — the same helper browsertest-legendinset.mjs carries */
const openPalette = async () => {
  const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
  if ((await toggle.getAttribute('title')) !== 'hide the palette') {
    await toggle.click()
    await page.waitForTimeout(450)
  }
}
const park = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(250) }

// ── set the stage: Explore, the Explorer rail open, a node chosen, the palette docked ─────────
await openPalette()
await page.getByLabel('studio-preset-explore').click()
await page.waitForTimeout(600)
if (!(await page.evaluate(() => !!document.querySelector('[data-explorer-rail] [data-node-id]')))) {
  await page.locator('[data-explorer-corner] button').click()
  await page.waitForTimeout(450)
}
// the first row that is not the root: choosing a node is what gives the document its header
const chosen = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
  const r = rows.find((el) => el.getAttribute('data-node-id') !== 'root')
  return r ? r.getAttribute('data-node-id') : null
})
ok('the Explorer rail has a row to choose', !!chosen, String(chosen))
if (chosen) {
  await page.locator(`[data-explorer-rail] [data-node-id="${chosen}"]`).first().click()
  await page.waitForTimeout(800)
}
await openPalette()
await park()

// ── measure, in the page ────────────────────────────────────────────────────────────────────
const m = await page.evaluate(() => {
  /** the first visible, non-empty text node under `root`, as the Range rect over it */
  const firstText = (root) => {
    if (!root) return null
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const el = n.parentElement
      if (!el || !el.offsetParent) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      const b = r.getBoundingClientRect()
      if (b.width === 0) continue
      return { text: n.textContent.trim().slice(0, 40), top: b.top }
    }
    return null
  }
  const frameOf = (el) => (el ? el.closest('[data-pane-frame]') : null)
  const read = (frame, line) => {
    if (!frame || !line) return null
    const f = frame.getBoundingClientRect()
    const border = parseFloat(getComputedStyle(frame).borderTopWidth) || 0
    return { text: line.text, fromOuter: line.top - f.top, fromInner: line.top - f.top - border, frameTop: f.top, border }
  }

  const palette = document.querySelector('[aria-label="studio-sidebar"]')
  const rail = document.querySelector('[data-explorer-rail]')
  const crumbRow = document.querySelector('[data-explorer-corner] + div')
  const doc = document.querySelector('[aria-label="document-panel"]')
  const paletteBody = palette && palette.querySelector('[data-pane-body]')
  const figure = doc && doc.querySelector('[data-relations-figure]')
  const relScroller = figure && figure.parentElement
  const relHead = relScroller && relScroller.firstElementChild

  const relLine = firstText(relHead)
  const docFrame = frameOf(doc)
  return {
    palette: read(frameOf(palette), firstText(paletteBody)),
    explorer: read(frameOf(rail), firstText(rail)),
    crumb: read(frameOf(crumbRow), firstText(crumbRow)),
    eyebrow: read(docFrame, firstText(doc)),
    frames: [frameOf(palette), frameOf(rail), docFrame].map((f) => (f ? f.getBoundingClientRect().top : null)),
    relations: relScroller && relLine && docFrame ? {
      text: relLine.text,
      fromFrame: relLine.top - docFrame.getBoundingClientRect().top,
      fromScroller: relLine.top - relScroller.getBoundingClientRect().top,
      padTop: getComputedStyle(relScroller).paddingTop,
    } : null,
  }
})

const num = (v) => (v == null ? 'n/a' : v.toFixed(2))
const say = (r) => `${num(r.fromOuter)}px from the frame's outer top, ${num(r.fromInner)}px inside its ${r.border}px border · "${r.text}"`

// ── the guard: all four panes and the three frames were found, and docked level ─────────────
ok('the palette, the map and the document are all on screen', m.frames.every((t) => t != null), JSON.stringify(m.frames))
ok('the three frames start at the same top edge (±1px), so the readings compare',
  m.frames.every((t) => t != null) && Math.max(...m.frames) - Math.min(...m.frames) <= TOLERANCE, m.frames.map(num).join(' / '))

// ── the claim, per pane ─────────────────────────────────────────────────────────────────────
for (const [name, key] of [
  ['the Explorer rail\'s head', 'explorer'],
  ['the map\'s first crumb', 'crumb'],
  ['the document\'s eyebrow', 'eyebrow'],
]) {
  const r = m[key]
  if (!r) { ok(`${name} has a first line of text to measure`, false, 'none found'); continue }
  ok(`${name} sits ${FIRST_LINE}px below its frame's top (±${TOLERANCE})`, Math.abs(r.fromOuter - FIRST_LINE) <= TOLERANCE, say(r))
}

if (!m.palette) ok('the palette\'s presets line has text to measure', false, 'none found')
else {
  ok(`the palette's presets line sits at ${FIRST_LINE}px, give or take the label's own style (reported, bounded ±${PALETTE_SLACK})`,
    Math.abs(m.palette.fromOuter - FIRST_LINE) <= PALETTE_SLACK, say(m.palette))
}

// ── the relations rail's head is where it was ──────────────────────────────────────────────
if (!m.relations) ok('the Relations rail\'s head is on screen', false, 'none found')
else {
  ok('the Relations rail keeps its own 6px top padding — the head did not move', m.relations.padTop === '6px',
    `padding-top ${m.relations.padTop}; head "${m.relations.text}" sits ${num(m.relations.fromScroller)}px under its column's top and ${num(m.relations.fromFrame)}px under the document frame's`)
}

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => ' - ' + e).join('\n'))
  process.exit(1)
}
console.log(`\n${checks.filter((c) => c.startsWith('PASS')).length} checks passed`)
