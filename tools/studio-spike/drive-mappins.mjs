// OB-109 / OB-108 (#226) — the walk's pins on the map, at every level.
//
// The RESOLVER is unit-tested (`walkAnchorAt`, `pinSpotClear` in
// model/atlas.test.ts) over the whole corpus at every level — that is where the
// arithmetic is proved, and it is a far stronger check than a browser can make.
// What only a browser can say is whether the map actually DRAWS what the
// resolver returns: the pins are rendered from a memo whose deps changed, inside
// an svg whose level gate is separate code, and OB-109's whole symptom was
// "correct data, nothing on screen".
//
// So this asserts one thing per level and takes a picture. It is the eyeball
// check for OB-108 too — geometry can prove a pin's centre clears a box while
// the result still reads badly.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-present.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-mappins.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5211
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
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

const pins = () => page.$$eval('[data-routestop]', (els) => els.length)
/** pins the user can ACTUALLY SEE — inside the map pane's own box. "The stops
 *  vanish at L3" is a statement about the screen, not about the DOM, and a count
 *  of detached nodes would have passed while the map looked exactly as broken. */
const pinsVisible = async () => {
  const pane = await page.locator('[aria-label="map-view"]').boundingBox()
  const boxes = await page.$$eval('[data-routestop]', (els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })))
  return boxes.filter((b) => b.x >= pane.x && b.x <= pane.x + pane.width && b.y >= pane.y && b.y <= pane.y + pane.height).length
}
const levelNow = () => page.$eval('[data-nested]', (el) => Number(el.getAttribute('data-level')))
/** dive one level THE WAY THE WALK IS FOLLOWED — a double-click on a pin's own
 *  cell, which is the map's own dive gesture. The zoom button dives at the pane
 *  CENTRE instead, so after two or three steps the camera has flown somewhere
 *  the walk never goes and every pin is legitimately off-screen: a picture of
 *  nothing, and a level sweep that says nothing about the walk. */
// on a pin that is IN THE PANE: the first pin in the DOM is wherever the camera left
// it, and a double-click on a box outside the pane dives nowhere
const diveOnAPin = async () => {
  const pane = await page.locator('[aria-label="map-view"]').boundingBox()
  const boxes = await page.locator('[data-routestop]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })))
  const b = boxes.find((r) => r.x >= pane.x && r.x + r.width <= pane.x + pane.width && r.y >= pane.y && r.y + r.height <= pane.y + pane.height)
  if (!b) return false
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(800)
  return true
}

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

ok('the map is on screen', (await page.locator('[aria-label="map-view"]').count()) === 1)

// GIVE THE MAP THE WHOLE DESK before measuring anything. The opening preset is
// four panes wide, which leaves the map a quarter of the window — most of its
// pins sit outside the viewport, so both the counts and the screenshots would be
// about the camera rather than about the fix. Toggling the other instruments off
// changes only the composition; the walk on `bus.route` is untouched.
for (const inst of ['unfoldgraph', 'document', 'walkviewer']) {
  await page.getByLabel(`studio-inst-${inst}`).click()
  await page.waitForTimeout(150)
}
await page.waitForTimeout(500)

// ── the subject: the walk already on the desk ───────────────────────────────
// NO SETUP NEEDED, and that is deliberate. The opening composition puts the walk
// desk's own draft on `bus.route` (presented.ts publishes it live), so the map
// starts with a real multi-stop walk drawn on it. The saved-walk route was the
// obvious thing to reach for and is the WEAKER subject: `activateWalk` publishes
// only the PLAYED PREFIX, so clicking ▶ gives a one-stop route, and a level
// sweep over one pin proves almost nothing.
// OB-132 — THE BAND DRAWS ONLY WHAT IS NEAR THE WALK'S POSITION: five stops behind it,
// two ahead, nothing beyond. At the opening cursor that is three pins at every level, and
// the merge invariant below ("deeper never loses a pin") would pass on three pins that
// never change. Seeking to the third-last stop puts every stop of the seven-stop draft
// inside the band, so the level sweep reads the whole walk again.
await page.locator('[aria-label="map-view"] [data-walk-dock]').focus()
await page.keyboard.press('End')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)

const atL0 = await pins()
ok('the desk draft is already drawn on the map', atL0 > 1, `${atL0} pins at L0`)

// ── OB-109: every level, not just L0–L2 ─────────────────────────────────────
const perLevel = [{ level: await levelNow(), n: atL0, seen: await pinsVisible() }]
for (let i = 0; i < 8; i++) {
  if ((await levelNow()) >= 6) break
  if (!(await diveOnAPin())) break
  perLevel.push({ level: await levelNow(), n: await pins(), seen: await pinsVisible() })
}

const fmt = perLevel.map((p) => `L${p.level}:${p.seen}/${p.n}`).join(' ')
for (const { level, n, seen } of perLevel) {
  ok(`L${level} draws the walk`, n > 0, `${n} pins`)
  ok(`L${level} shows the walk on screen`, seen > 0, `${seen} of ${n} in view`)
}
ok('the sweep reached L3 or deeper — the levels OB-109 was actually about', perLevel.some((p) => p.level >= 3), fmt)
// The invariant the fix creates, not just "more than zero": rolling UP merges
// stops that share an ancestor, and clamping never does. So a deeper level can
// only ever hold the same number of pins or more — never fewer, never none.
ok('going deeper never loses a pin', perLevel.every((p, i) => i === 0 || p.n >= perLevel[i - 1].n), fmt)

// ── the pictures ────────────────────────────────────────────────
// Taken on the way back UP, so the camera is still on the walk rather than
// wherever the last dive landed. L3 is the level OB-109 was reported at; L2 is
// where a territory's own name is drawn large enough for OB-108 to be judged.
const zoomOut = page.locator('[aria-label="map-view"]').getByRole('button', { name: /zoom out/i })
const backTo = async (target) => {
  while ((await levelNow()) > target && !(await zoomOut.isDisabled())) {
    await zoomOut.click()
    await page.waitForTimeout(700)
  }
  return levelNow()
}
ok('back at L4 for the deep shot', (await backTo(4)) === 4)
ok('and the walk is still in frame there', (await pinsVisible()) > 0, `${await pinsVisible()} in view`)
await page.screenshot({ path: OUT + '/map-pins-l4.png' })

ok('back at L3 for the deep shot', (await backTo(3)) === 3)
ok('and the walk is still in frame there', (await pinsVisible()) > 0, `${await pinsVisible()} in view`)
await page.screenshot({ path: OUT + '/map-pins-l3.png' })

ok('back at L2 for the label-clearance shot', (await backTo(2)) === 2)
await page.screenshot({ path: OUT + '/map-pins-l2.png' })

// ── OB-221: a walk pin on a focused cell is not buried by the focus border ──
// THE FAULT WAS PAINT ORDER, NOT A STYLE: inside an SVG the later sibling wins, and the pins group
// used to sit AHEAD of the hover pre-selection, the spotlight and the selection overlay, so every
// cell-state treatment painted over a pin — the selection's middle stroke (an opaque white casing
// under a 4px stroke in the cell's own hue, ten pixels of ink centred on the boundary) buried the
// only copy of a stop's address. `z-index` is not the lever, and none of those groups takes pointer
// events, so a hit test cannot see the fault either: the assertion is about the TREE.
// (a)+(d): the pins group is the LAST child of its parent, before and after a selection exists.
const pinsLast = () =>
  page.evaluate(() => {
    const g = document.querySelector('svg[data-nested] [data-routepins]')
    if (!g) return null
    return { last: [...g.parentNode.children].at(-1) === g, siblings: g.parentNode.children.length }
  })
const before = await pinsLast()
ok('data-routepins is the LAST child of its parent — painted after every cell-state treatment', !!before && before.last, JSON.stringify(before))

// select the cell a pin stands on: a click on a pin falls through to its region
const paneBox = await page.locator('[aria-label="map-view"]').boundingBox()
const pinBoxes = await page.locator('[data-routestop]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })))
const pinInPane = pinBoxes.find((r) => r.x >= paneBox.x && r.x + r.width <= paneBox.x + paneBox.width && r.y >= paneBox.y && r.y + r.height <= paneBox.y + paneBox.height)
ok('a pin is in the pane to stand on', !!pinInPane)
if (pinInPane) {
  await page.mouse.click(pinInPane.x + pinInPane.width / 2, pinInPane.y + pinInPane.height / 2)
  await page.waitForTimeout(600)
  const focused = await page.evaluate(() => document.querySelectorAll('svg[data-nested] [data-seloutline]').length)
  ok('the cell under the pin is focused: its focus border is drawn', focused === 1, `${focused} outline(s)`)
  const after = await page.evaluate(() => {
    const g = document.querySelector('svg[data-nested] [data-routepins]')
    const outline = document.querySelector('svg[data-nested] [data-seloutline]')
    const overlay = document.querySelector('svg[data-nested] [data-seloverlay]')
    // Node.DOCUMENT_POSITION_FOLLOWING === 4: the pins come AFTER the outline and the whole overlay
    return {
      afterOutline: !!g && !!outline && (outline.compareDocumentPosition(g) & 4) !== 0,
      afterOverlay: !!g && !!overlay && (overlay.compareDocumentPosition(g) & 4) !== 0,
      last: !!g && [...g.parentNode.children].at(-1) === g,
    }
  })
  ok('the pins are painted AFTER the focus border', after.afterOutline, JSON.stringify(after))
  ok('and after the whole selection overlay, its roads and its neighbourhood', after.afterOverlay, JSON.stringify(after))
  ok('and are still the last child of their parent with a selection on screen', after.last, JSON.stringify(after))
  // the arrows stay where they were (only the pin moved): they still paint BEFORE the overlay
  ok('the walk\'s ARROWS did not move — a line under a boundary reads as behind it, and loses nothing', await page.evaluate(() => {
    const walk = document.querySelector('svg[data-nested] [data-routepath]')
    const overlay = document.querySelector('svg[data-nested] [data-seloverlay]')
    return !!walk && !!overlay && (walk.compareDocumentPosition(overlay) & 4) !== 0
  }))
  // (c) no gesture changed: the pin still opens its preview card on hover
  const still = await page.locator('[data-routestop]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })))
  const hoverPin = still.find((r) => r.x >= paneBox.x && r.x + r.width <= paneBox.x + paneBox.width && r.y >= paneBox.y && r.y + r.height <= paneBox.y + paneBox.height)
  if (hoverPin) {
    await page.mouse.move(hoverPin.x + hoverPin.width / 2, hoverPin.y + hoverPin.height / 2)
    await page.waitForTimeout(500)
    ok('and the pin still opens its preview card on hover (no gesture moved)', (await page.locator('[data-walk-preview]').count()) >= 1)
  }
  await page.screenshot({ path: OUT + '/map-pins-focused.png' })
  await page.mouse.move(4, 4)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shots at tools/studio-spike/shots/map-pins-{l2,l3,focused}.png')
