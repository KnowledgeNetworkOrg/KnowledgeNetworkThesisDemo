// browsertest-previewclamp.mjs — OB-191: the walk preview card clamps itself to the window's edges.
//
// A TEST. `WalkPreview` centres the card on its anchor with `translateX(-50%)`, so an anchor
// closer to the window's left or right edge than half the card's width put part of the card
// off-window — cut with no scrollbar and nothing to notice. The owner saw it on the dock's first
// stop: the card flush against the window's left edge, its border and the start of its text gone.
//
// THE CHECKABLE FORM HAS TWO ENDS, because a clamp that never fires passes a one-ended test: the
// card's `left` is >= PREVIEW_EDGE (8), AND the UNCLAMPED placement — the anchor's centre less
// half the card's rendered width, which is exactly what the same layout draws with the clamp
// removed — is NEGATIVE. The anchor that reaches the window's edge here is a walk PIN on the map
// (the Explore desk's first column), dragged to the pane's left edge; the dock's first stop is
// read too, as the owner's own case, with its unclamped number reported. The window's RIGHT edge
// is not reachable from any preview-bearing surface on this desk (the map is leftmost, the
// document pane holds the right); the invariant is asserted there anyway so a moved pane is caught.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-previewclamp.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5262

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
  return cond
}

/** `PREVIEW_EDGE`, retyped on purpose: a test that imported it would agree with any value */
const EDGE = 8

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const map = page.locator('[aria-label="map-view"]')
const dock = () => map.locator('[data-walk-dock]')
const preview = () => page.locator('[data-walk-preview]')
const box = (loc) => loc.boundingBox()

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(800)
  ok('the map is the Explore desk\'s first column, with the walk dock on it', (await map.count()) === 1 && (await dock().count()) === 1)
  const svg = await box(map.locator('svg').first())
  ok('and the map sits at the window\'s left edge — the layout the owner reported from', !!svg && svg.x < 40, `svg left ${svg && svg.x.toFixed(1)}`)

  // ── the owner's own case: the dock's first stop ─────────────────────────────────────
  await map.getByLabel('show every stop').click()
  await page.waitForTimeout(450)
  await dock().focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  const first = dock().locator('[data-walk-dock-stop="0"]')
  const fb = await box(first)
  await page.mouse.move(fb.x + fb.width / 2, fb.y + 12)
  await page.waitForTimeout(300)
  const c0 = await box(preview())
  const dotB = await box(first.locator('button').first())
  const anchor0 = dotB ? dotB.x + dotB.width / 2 : fb.x + fb.width / 2
  ok('OB-191 (2a): pointer on the dock\'s FIRST stop — the card is on screen, left >= 8', !!c0 && c0.x >= EDGE - 0.5, c0 ? `left ${c0.x.toFixed(1)}, width ${c0.width.toFixed(1)}, unclamped ${(anchor0 - c0.width / 2).toFixed(1)}` : 'no card')
  await page.mouse.move(4, 4)
  await page.waitForTimeout(200)
  await map.getByLabel('hide the stops').click()
  await page.waitForTimeout(450)

  // ── the anchor at the window's edge: a walk pin dragged to the pane's left edge ─────
  const pin = () => map.locator('[data-routestop]').first()
  const pb0 = await box(pin())
  const dx = (svg.x + 6) - (pb0.x + pb0.width / 2)
  await page.mouse.move(svg.x + svg.width * 0.5, svg.y + 40)
  await page.mouse.down()
  await page.mouse.move(svg.x + svg.width * 0.5 + dx, svg.y + 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const pb = await box(pin())
  const anchor = pb.x + pb.width / 2
  await page.mouse.move(anchor, pb.y + pb.height / 2)
  await page.waitForTimeout(300)
  const c1 = await box(preview())
  const unclamped = c1 ? anchor - c1.width / 2 : null
  ok('the pin now stands at the pane\'s left edge, within half a card of the window\'s', anchor < 40, `anchor ${anchor.toFixed(1)}`)
  ok('OB-191 (2): hovering it, the card is on screen — its left >= 8', !!c1 && c1.x >= EDGE - 0.5, c1 ? `left ${c1.x.toFixed(1)}, width ${c1.width.toFixed(1)}` : 'no card')
  ok('and the clamp was NEEDED: the unclamped placement (anchor − half card) is NEGATIVE on this layout', unclamped !== null && unclamped < 0, `${unclamped === null ? '-' : unclamped.toFixed(1)}`)
  ok('so the card is no longer centred on its anchor — shifted right by the clamp', !!c1 && (c1.x + c1.width / 2) - anchor > 4, c1 ? `centre ${(c1.x + c1.width / 2).toFixed(1)} vs anchor ${anchor.toFixed(1)}` : '')
  const innerW = await page.evaluate(() => window.innerWidth)
  ok('OB-191 (3): its right <= innerWidth − 8 (the window\'s right edge is not reachable from a preview surface on this desk; asserted so a moved pane is caught)', !!c1 && c1.x + c1.width <= innerW - EDGE)
  await page.mouse.move(4, 4)
  await page.waitForTimeout(200)
  ok('leaving the pin clears the card', (await preview().count()) === 0)
  ok('no page errors', errors.filter((e) => e.startsWith('pageerror')).length === 0)
} catch (e) {
  errors.push('exception: ' + (e && e.stack ? e.stack : String(e)))
}

await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => '  ' + e).join('\n'))
  process.exit(1)
}
console.log(`\nall ${checks.length} checks passed`)
