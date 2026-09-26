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

// ── DS OB-223: a selected cell's name reads over its parent's ghost heading ──────
// Three clauses, each read off the running map rather than the source: every cell name wears the
// paper case (stroke UNDER the fill, 3.5px on screen); the ghost heading is ONE opaque tone, the
// same pixels over every child it spans, the selected one included; and the selected name's ink
// holds 4.5:1 against the WASHED fill actually under it.
/** decode a screenshot in the page (a canvas — no PNG library) and hand back a sampler */
const pixelsOf = async (clip) => {
  const b64 = (await page.screenshot({ clip })).toString('base64')
  return { b64, clip }
}
await page.mouse.move(4, 4)
await page.waitForTimeout(400)
const cand = await page.evaluate(() => {
  // a GHOST wears `ghostCase` (#ffffff); an active name wears the paper case
  const ghosts = [...document.querySelectorAll('[data-ghostlabel], [data-regionlabel]')].filter((g) => g.getAttribute('stroke') === '#ffffff' && Number(g.getAttribute('opacity')) > 0.5)
  const labels = [...document.querySelectorAll('[data-label]')]
  const hit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  for (const g of ghosts) {
    const gb = g.getBoundingClientRect()
    for (const l of labels) if (hit(gb, l.getBoundingClientRect())) return { cell: l.getAttribute('data-label'), ghost: g.getAttribute('data-ghostlabel') || g.getAttribute('data-regionlabel'), ghostSel: g.hasAttribute('data-ghostlabel') ? 'data-ghostlabel' : 'data-regionlabel' }
  }
  return null
})
ok('OB-223: a cell name that crosses its parent\'s ghost heading is on screen at L2', !!cand, cand ? `${cand.cell} under the "${cand.ghost}" heading` : 'none found')
/** a point inside a cell's fill that is not under any name, pin or ghost — for a click or a fill sample */
const clearPointIn = (id) => page.evaluate((id) => {
  const cell = document.querySelector(`[data-terr="${id}"], [data-region="${id}"]`)
  if (!cell) return null
  const inv = cell.getScreenCTM().inverse()
  const r = cell.getBoundingClientRect()
  const pane = document.querySelector('[aria-label="map-view"]').getBoundingClientRect()
  const avoid = [...document.querySelectorAll('[data-label], [data-regionlabel], [data-ghostlabel], [data-routestop], [data-seledge]')].map((e) => e.getBoundingClientRect())
  const pts = []
  for (let fy = 0.1; fy < 0.95; fy += 0.08) for (let fx = 0.1; fx < 0.95; fx += 0.08) {
    const x = r.x + r.width * fx, y = r.y + r.height * fy
    // on screen, and clear of the pane's floating chrome at its edges
    if (x < pane.x + 60 || x > pane.x + pane.width - 60 || y < pane.y + 60 || y > pane.y + pane.height - 60) continue
    if (avoid.some((b) => x > b.x - 8 && x < b.x + b.width + 8 && y > b.y - 8 && y < b.y + b.height + 8)) continue
    if (!cell.isPointInFill(new DOMPoint(x, y).matrixTransform(inv))) continue
    // and well inside: 12px from the boundary on every side
    if (![[12, 0], [-12, 0], [0, 12], [0, -12]].every(([dx, dy]) => cell.isPointInFill(new DOMPoint(x + dx, y + dy).matrixTransform(inv)))) continue
    pts.push({ x, y })
  }
  return pts
}, id)
if (cand) {
  const pts = await clearPointIn(cand.cell)
  ok('OB-223: the cell has clear ground to click', !!pts && pts.length > 0, `${pts ? pts.length : 0} points`)
  if (pts && pts.length) {
    await page.mouse.click(pts[0].x, pts[0].y)
    await page.waitForTimeout(500)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(450)
    ok('OB-223: it is selected — the overlay and the wash are drawn', (await page.locator('[data-seloverlay]').count()) === 1 && (await page.locator('[data-selwash]').count()) === 1)
    // (1) the paper case, on every name
    const cases = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.color = 'var(--surface-paper)'
      document.body.appendChild(probe)
      const paper = getComputedStyle(probe).color
      probe.remove()
      const names = [...document.querySelectorAll('[data-label]')]
      return { paper, names: names.map((t) => {
        const cs = getComputedStyle(t)
        return { id: t.getAttribute('data-label'), order: cs.paintOrder, stroke: cs.stroke, join: cs.strokeLinejoin, screenW: parseFloat(cs.strokeWidth) * t.getScreenCTM().a, weight: cs.fontWeight }
      }) }
    })
    const badCase = cases.names.filter((n) => !/^stroke/.test(n.order) || n.stroke !== cases.paper || n.join !== 'round' || Math.abs(n.screenW - 3.5) > 0.05)
    ok(
      'OB-223 (1): EVERY cell name — selected or not — wears the paper case: stroke first, paper, round, 3.5px on screen',
      cases.names.length > 1 && badCase.length === 0,
      `${cases.names.length} names${badCase.length ? ', off: ' + JSON.stringify(badCase.slice(0, 2)) : ', e.g. ' + JSON.stringify(cases.names[0])}`,
    )
    // (2) the ghost: one opaque tone, painted after the wash, the same pixels over every child
    const order = await page.evaluate((c) => {
      const wash = document.querySelector('[data-selwash]')
      const ghost = document.querySelector(`[${c.ghostSel}="${c.ghost}"]`)
      const label = document.querySelector(`[data-label="${c.cell}"]`)
      const cs = getComputedStyle(ghost)
      return {
        ghostAfterWash: (wash.compareDocumentPosition(ghost) & 4) !== 0,
        labelAfterGhost: (ghost.compareDocumentPosition(label) & 4) !== 0,
        opacity: ghost.getAttribute('opacity'), fillOpacity: cs.fillOpacity, fill: ghost.getAttribute('fill'),
        box: (() => { const b = ghost.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } })(),
      }
    }, cand)
    ok('OB-223 (2): the ghost paints AFTER the selection wash, and the cell name after the ghost', order.ghostAfterWash && order.labelAfterGhost, JSON.stringify({ ghostAfterWash: order.ghostAfterWash, labelAfterGhost: order.labelAfterGhost }))
    ok('OB-223 (2): and at rest it is fully opaque — one resolved tone, not an alpha\'d hue', Number(order.opacity) === 1 && order.fillOpacity === '1' && /^#[0-9a-f]{6}$/i.test(order.fill), `opacity ${order.opacity}, fill ${order.fill}`)
    const clip = { x: Math.max(0, Math.floor(order.box.x)), y: Math.max(0, Math.floor(order.box.y)), width: Math.ceil(order.box.width), height: Math.ceil(order.box.height) }
    const shot = await pixelsOf(clip)
    const ghostPx = await page.evaluate(async ({ b64, clip, fill, sel }) => {
      const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64 })
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
      const g = c.getContext('2d'); g.drawImage(im, 0, 0)
      const d = g.getImageData(0, 0, im.width, im.height).data
      const k = im.width / clip.width
      const want = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16))
      const cells = document.querySelectorAll('[data-terr], [data-region]')
      const byCell = {}
      for (let y = 0; y < im.height; y += 2) for (let x = 0; x < im.width; x += 2) {
        const i = (y * im.width + x) * 4
        if (Math.abs(d[i] - want[0]) > 1 || Math.abs(d[i + 1] - want[1]) > 1 || Math.abs(d[i + 2] - want[2]) > 1) continue
        const sx = clip.x + x / k, sy = clip.y + y / k
        let under = null
        for (const cell of cells) {
          if (getComputedStyle(cell).pointerEvents === 'none' && cell.getAttribute('fill-opacity') === '0') continue
          const fo = Number(cell.getAttribute('fill-opacity'))
          if (!(fo > 0)) continue
          if (cell.isPointInFill(new DOMPoint(sx, sy).matrixTransform(cell.getScreenCTM().inverse()))) { under = cell.getAttribute('data-terr') || cell.getAttribute('data-region') }
        }
        if (under) byCell[under] = (byCell[under] || 0) + 1
      }
      return { byCell, selIn: !!byCell[sel] }
    }, { b64: shot.b64, clip, fill: order.fill, sel: cand.cell })
    const cellsWithGhost = Object.entries(ghostPx.byCell).filter(([, n]) => n >= 5)
    ok(
      'OB-223 (2): the SAME ghost pixel value lands over two or more differently-filled children, the selected one included',
      cellsWithGhost.length >= 2 && ghostPx.selIn,
      JSON.stringify(ghostPx.byCell),
    )
    // (3) the selected name's ink against the colour actually under it
    const fillPts = await clearPointIn(cand.cell)
    const inkRead = await page.evaluate(async ({ id, pts }) => {
      const t = document.querySelector(`[data-label="${id}"]`)
      return { ink: t.getAttribute('fill'), pts: pts.slice(0, 12) }
    }, { id: cand.cell, pts: fillPts || [] })
    const washed = []
    for (const p of inkRead.pts) {
      const s = await pixelsOf({ x: Math.round(p.x), y: Math.round(p.y), width: 1, height: 1 })
      washed.push(await page.evaluate(async (b64) => {
        const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64 })
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
        const g = c.getContext('2d'); g.drawImage(im, 0, 0)
        const d = g.getImageData(0, 0, 1, 1).data
        return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
      }, s.b64))
    }
    const lin = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4))
    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255) }
    const cr = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const worst = washed.length ? Math.min(...washed.map((w) => cr(inkRead.ink, w))) : 0
    ok(
      'OB-223 (3): the selected name\'s ink holds 4.5:1 against its WASHED fill, read off the screen',
      washed.length > 0 && worst >= 4.5,
      `ink ${inkRead.ink} on ${[...new Set(washed)].slice(0, 3).join(' ')} — worst ${worst.toFixed(2)}:1`,
    )
    const lb = await page.locator(`[data-label="${cand.cell}"]`).boundingBox()
    await page.screenshot({ path: OUT + '/ob223-selected-name.png', clip: { x: Math.max(0, Math.min(lb.x, order.box.x) - 30), y: Math.max(0, Math.min(lb.y, order.box.y) - 30), width: Math.max(lb.x + lb.width, order.box.x + order.box.width) - Math.min(lb.x, order.box.x) + 60, height: Math.max(lb.y + lb.height, order.box.y + order.box.height) - Math.min(lb.y, order.box.y) + 60 } })
  }
}

// ── DS OB-221: a walk pin on a focused cell's boundary is painted OVER the focus border ──
// The pins' group is the LAST child of the scene now, after the selection overlay. Structural
// first — the item's own test — then the picture: find a pin whose box the overlay's white casing
// actually crosses, and screenshot it with and without the overlay. The pins fade to 0.6 while a
// node is selected (OB-122's recede, deliberately untouched), so a faint border would show through
// ANY 60%-opaque pin whatever the paint order; the fade is lifted for the two shots so that what
// is compared is paint order alone.
const pinsLast = await page.evaluate(() => {
  const g = document.querySelector('[data-routepins]')
  return g ? { last: [...g.parentNode.children].at(-1) === g, parent: g.parentNode.hasAttribute('data-scene') } : null
})
ok('OB-221 (d): [data-routepins] is the LAST child of the scene', !!pinsLast && pinsLast.last && pinsLast.parent, JSON.stringify(pinsLast))
ok('OB-221: and the walk\'s line and arrows did NOT move — still under the selection overlay',
  await page.evaluate(() => { const w = document.querySelector('[data-routepath]'); const o = document.querySelector('[data-seloverlay]'); return !!w && !!o && (w.compareDocumentPosition(o) & 4) !== 0 }))
const findCrossedPin = () => page.evaluate(() => {
  const outline = document.querySelector('[data-seloutline]')
  if (!outline) return null
  const casing = outline.previousElementSibling
  const inv = casing.getScreenCTM().inverse()
  const pane = document.querySelector('[aria-label="map-view"]').getBoundingClientRect()
  for (const pin of document.querySelectorAll('[data-routestop]')) {
    // only a pin drawn at full strength: the band fades pins away from the walk's position
    if (Number(pin.getAttribute('opacity')) < 0.9) continue
    const r = pin.getBoundingClientRect()
    // and one the reader can see: inside the map pane, clear of its floating chrome
    if (r.x < pane.x + 40 || r.x + r.width > pane.x + pane.width - 40 || r.y < pane.y + 40 || r.y + r.height > pane.y + pane.height - 40) continue
    let hits = 0
    for (let fy = 0.3; fy <= 0.71; fy += 0.1) for (let fx = 0.3; fx <= 0.71; fx += 0.1) {
      if (casing.isPointInStroke(new DOMPoint(r.x + r.width * fx, r.y + r.height * fy).matrixTransform(inv))) hits++
    }
    if (hits >= 2) return { pin: pin.getAttribute('data-pin'), step: pin.getAttribute('data-step'), cell: pin.getAttribute('data-routestop'), x: r.x, y: r.y, w: r.width, h: r.height, hits }
  }
  return null
})
let crossed = await findCrossedPin()
/** the cells a pin stands on or beside: its own, and whatever active cell lies just past its rim */
const cellsAroundPins = () => page.evaluate(() => {
  const cells = [...document.querySelectorAll('[data-terr], [data-region]')].filter((c) => Number(c.getAttribute('fill-opacity')) > 0)
  const out = []
  for (const pin of document.querySelectorAll('[data-routestop]')) {
    const r = pin.getBoundingClientRect()
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2, rad = r.width / 2 + 3
    const seen = new Set([pin.getAttribute('data-routestop')])
    for (let a = 0; a < 16; a++) {
      const x = cx + rad * Math.cos((a * Math.PI) / 8), y = cy + rad * Math.sin((a * Math.PI) / 8)
      for (const c of cells) if (c.isPointInFill(new DOMPoint(x, y).matrixTransform(c.getScreenCTM().inverse()))) seen.add(c.getAttribute('data-terr') || c.getAttribute('data-region'))
    }
    for (const id of seen) out.push(id)
  }
  return [...new Set(out)]
})
const searchHere = async () => {
  for (const id of await cellsAroundPins()) {
    const pts = await clearPointIn(id)
    if (!pts || !pts.length) continue
    await page.keyboard.press('Escape')
    await page.mouse.click(pts[0].x, pts[0].y)
    await page.waitForTimeout(400)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(200)
    const c = await findCrossedPin()
    if (c) return c
  }
  return null
}
const levelsTried = [await levelNow()]
if (!crossed) crossed = await searchHere()
// deeper, where a 22px pin is large against its cell and more often straddles a border
for (let i = 0; !crossed && i < 2; i++) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if (!(await diveOnAPin())) break
  levelsTried.push(await levelNow())
  crossed = await searchHere()
}
/* NO PIN OF THIS WALK HAPPENS TO STAND ON A FOCUSED BORDER at the levels tried — the pins sit at
   their stops' anchors, clear of the names. So the case is STAGED: one full-strength pin is moved
   onto the selected cell's own outline for the two shots and put back after. What is measured is
   unchanged — whether the border paints over a pin that stands on it — and the control below
   proves the comparison would see it if it did. */
let staged = false
if (!crossed) {
  // select a cell with ground on screen, and stand a full-strength pin on its outline where the
  // outline itself is on screen
  for (const id of await cellsAroundPins()) {
    const pts = await clearPointIn(id)
    if (!pts || !pts.length) continue
    await page.keyboard.press('Escape')
    await page.mouse.click(pts[0].x, pts[0].y)
    await page.waitForTimeout(400)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(200)
    crossed = await page.evaluate((id) => {
      const outline = document.querySelector('[data-seloutline]')
      const pin = [...document.querySelectorAll('[data-routestop]')].find((p) => Number(p.getAttribute('opacity')) >= 0.9)
      if (!outline || !pin) return null
      const pane = document.querySelector('[aria-label="map-view"]').getBoundingClientRect()
      const m = outline.getScreenCTM()
      const L = outline.getTotalLength()
      let pt = null
      for (let k = 0; k < 64 && !pt; k++) {
        const p = outline.getPointAtLength((L * k) / 64)
        const s = new DOMPoint(p.x, p.y).matrixTransform(m)
        if (s.x > pane.x + 80 && s.x < pane.x + pane.width - 80 && s.y > pane.y + 80 && s.y < pane.y + pane.height - 80) pt = p
      }
      if (!pt) return null
      pin.dataset.keepTransform = pin.getAttribute('transform')
      pin.setAttribute('transform', pin.getAttribute('transform').replace(/translate\([^)]*\)/, `translate(${pt.x} ${pt.y})`))
      const r = pin.getBoundingClientRect()
      return { pin: pin.getAttribute('data-pin'), step: pin.getAttribute('data-step'), cell: id, x: r.x, y: r.y, w: r.width, h: r.height, hits: null }
    }, id)
    if (crossed) break
  }
  staged = !!crossed
}
ok(
  'OB-221: a full-strength walk pin standing on a focused cell\'s boundary',
  !!crossed,
  crossed ? (staged ? `STAGED at L${await levelNow()}: stop ${crossed.step} moved onto the selected cell's outline (none of this walk's pins stands on one at L${levelsTried.join(', L')})` : `stop ${crossed.step} at L${await levelNow()}, the casing crosses ${crossed.hits} of 25 samples in its middle`) : 'no selection or no pin',
)
console.log('OB-221 pin under test: ' + JSON.stringify(crossed))
if (crossed) {
  const clip = { x: Math.floor(crossed.x) - 12, y: Math.floor(crossed.y) - 12, width: Math.ceil(crossed.w) + 24, height: Math.ceil(crossed.h) + 24 }
  await page.screenshot({ path: OUT + '/ob221-pin-on-border.png', clip: { x: clip.x - 30, y: clip.y - 30, width: clip.width + 60, height: clip.height + 60 } })
  await page.evaluate((k) => {
    const g = document.querySelector('[data-routepins]'); g.dataset.keep = g.getAttribute('opacity'); g.style.transition = 'none'; g.setAttribute('opacity', '1')
    const p = document.querySelector(`[data-routestop][data-pin="${k}"]`); p.dataset.keep = p.getAttribute('opacity'); p.setAttribute('opacity', '1')
  }, crossed.pin)
  await page.waitForTimeout(100)
  const withOverlay = (await page.screenshot({ clip })).toString('base64')
  await page.evaluate(() => { document.querySelector('[data-seloverlay]').style.display = 'none' })
  await page.waitForTimeout(100)
  const without = (await page.screenshot({ clip })).toString('base64')
  // CONTROL: the old paint order — the pins moved back UNDER the overlay — must show a difference
  await page.evaluate(() => {
    const o = document.querySelector('[data-seloverlay]'); o.style.display = ''
    const g = document.querySelector('[data-routepins]'); o.parentNode.insertBefore(g, o)
  })
  await page.waitForTimeout(100)
  const oldOrder = (await page.screenshot({ clip })).toString('base64')
  await page.evaluate((k) => {
    const g = document.querySelector('[data-routepins]'); g.parentNode.appendChild(g)
    g.setAttribute('opacity', g.dataset.keep); g.style.transition = 'opacity 120ms'
    const p = document.querySelector(`[data-routestop][data-pin="${k}"]`); p.setAttribute('opacity', p.dataset.keep)
  }, crossed.pin)
  const diff = await page.evaluate(async ({ a, b, inner }) => {
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + src })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    const w = ia.width, h = ia.height
    const data = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data }
    const da = data(ia), db = data(ib)
    let diff = 0, n = 0
    // the pin's middle only: its face, number and ring, away from its antialiased rim
    const x0 = Math.round(w * inner), x1 = Math.round(w * (1 - inner)), y0 = Math.round(h * inner), y1 = Math.round(h * (1 - inner))
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; n++; if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) diff++ }
    return { diff, n }
  }, { a: withOverlay, b: without, inner: 0.36 })
  ok('OB-221 (a): the pin\'s face is IDENTICAL with and without the focus border under it — no white or hue stroke crosses it', diff.n > 20 && diff.diff === 0, `${diff.diff} of ${diff.n} pixels differ`)
  const control = await page.evaluate(async ({ a, b, inner }) => {
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + src })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    const w = ia.width, h = ia.height
    const data = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data }
    const da = data(ia), db = data(ib)
    let diff = 0, n = 0
    const x0 = Math.round(w * inner), x1 = Math.round(w * (1 - inner)), y0 = Math.round(h * inner), y1 = Math.round(h * (1 - inner))
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; n++; if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) diff++ }
    return { diff, n }
  }, { a: oldOrder, b: without, inner: 0.36 })
  ok('OB-221 (a) control: with the pins put back UNDER the overlay, the same comparison DOES see the border cross the face', control.diff > 0, `${control.diff} of ${control.n} pixels differ in the old order`)
  await page.screenshot({ path: OUT + '/ob221-pin-on-border.png', clip: { x: clip.x - 30, y: clip.y - 30, width: clip.width + 60, height: clip.height + 60 } })
  // (c) the pin's own hover card, and the cell's tooltip, still open
  await page.mouse.move(crossed.x + crossed.w / 2 - 40, crossed.y + crossed.h / 2 - 40, { steps: 4 })
  await page.mouse.move(crossed.x + crossed.w / 2, crossed.y + crossed.h / 2, { steps: 6 })
  await page.waitForTimeout(500)
  ok('OB-221 (c): hovering the pin still opens its preview card', (await page.locator('[data-walk-preview]').count()) > 0)
  const cellPts = await clearPointIn(crossed.cell)
  if (cellPts && cellPts.length) {
    await page.mouse.move(cellPts[0].x, cellPts[0].y, { steps: 8 })
    await page.mouse.move(cellPts[0].x + 3, cellPts[0].y + 2, { steps: 3 })
    await page.waitForTimeout(500)
    ok('OB-221 (c): and hovering the cell still opens its tooltip', (await page.locator('[data-maptip]').count()) > 0)
  }
  if (staged) await page.evaluate((k) => { const p = document.querySelector(`[data-routestop][data-pin="${k}"]`); if (p && p.dataset.keepTransform) p.setAttribute('transform', p.dataset.keepTransform) }, crossed.pin)
}
await page.keyboard.press('Escape')

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shots at tools/studio-spike/shots/map-pins-{l2,l3}.png')
