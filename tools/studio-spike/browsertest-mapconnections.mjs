// browsertest-mapconnections.mjs — the map and the connections pane reading each
// other, and the map reading the corpus (#294).
//
// A TEST. It opens the real app in a real browser and asserts what a person sees.
//
// WHY IT IS A TEST TODAY AND WAS NOT YESTERDAY. This was `shot-visuals.mjs`, a
// "one-shot visual check" — and the browser-test runner skips `shot-*` on purpose,
// as instruments rather than guards. But it had quietly grown about twenty real
// assertions, most of them about parts of the app nothing else checks: that the
// selection overlay collapses every link between one pair of cells into ONE road,
// that region names wrap without colliding, that a below-topic selection borrows
// no arrows from the topic above it. None of that gated anything, and nobody ran
// it, which is exactly the failure `run-browsertests.mjs`'s own header describes.
// So it was repaired and renamed into the suite instead of being deleted.
//
// WHAT WAS CUT ON THE WAY IN, and why none of it is a loss:
//   - the containment WHEEL frames (`[data-panegraph]`, `connections-open-all`,
//     the ring-fit floor). The wheel stopped being drawn with #253 and its layout
//     module was deleted with #290.
//   - hover sync driven from `[data-relrow]`, the `[data-hoverchip]` readouts, the
//     region star and its grain toggle, the relationship list's height fraction.
//     The rehaul (#253) replaced the pane's whole external view, and the new one's
//     behaviour is covered in browsertest-connections.mjs.
//   - the old LOOK assertion, which said a click flies the camera and MUST NOT
//     change the selection. That rule INVERTED: `ConnectionsPane`'s `onSelect` now
//     publishes `setFocus` and `peekAt` together, deliberately — "every navigating
//     click is a crumb click". Section 4b asserts the new rule instead, including
//     the half no other test covers: that the camera actually moves.
//
// Two things it drives are not where they used to be, and both are wrapped in a
// helper rather than repeated: the map's level is chosen from a floating DS
// LevelPicker now (`goLevel`), and applying a preset CLOSES the palette pane, so
// reaching an instrument toggle afterwards means re-opening it (`withPalette`).
//
// Spawns vite ITSELF as a child process — backgrounded dev servers die on this
// machine, so the script owns the server lifecycle: spawn, wait for readiness,
// drive, kill. createRequire -> playwright-core, msedge, headless.
//
// Run from anywhere:  node tools/studio-spike/browsertest-mapconnections.mjs
// Frames land in tools/studio-spike/shots/ (gitignored) — they are a by-product
// for a person to look at, not the check.
// Exits nonzero on any failed assertion or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5252
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
    // the banner is ANSI-styled — 'Local:' is split by escape codes
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
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto(`http://localhost:${PORT}/`)
await page.getByLabel('studio-preset-explore').click()
await page.waitForTimeout(600)

/** the map camera's transform, for asserting flights happened / came home */
const getCam = () => page.$eval('[data-nested] > g', (g) => g.getAttribute('transform'))

/** Step the map to a containment level. The old `nested-level-N` button row was
 *  deleted with the map's bottom info bar (`1e530af`, OB-094/096); the level is
 *  chosen from a floating DS `LevelPicker` now — a "levels" button that opens
 *  L0..Lmax. Every level change below goes through here. */
const goLevel = async (n) => {
  await page.locator('[aria-label="levels"]').click()
  await page.locator('[aria-label="levels"] ~ div button', { hasText: new RegExp(`^L${n}$`) }).click()
}

/** Run `fn` with the palette pane open, and leave it as it was found. Applying a
 *  preset CLOSES the palette on purpose (`StudioView`: `if (showPalette)
 *  closePalette()`), so anything reaching for an instrument toggle after a preset
 *  click has to bring it back first. The toolbar's handle is stable across the
 *  flip — that is `PALETTE_HOOK_SELECTOR`'s whole job (OB-104). */
const withPalette = async (fn) => {
  const isOpen = async () => (await page.locator('[aria-label^="studio-inst-"]').count()) > 0
  const wasOpen = await isOpen()
  if (!wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
  await fn()
  // RESTORE BY STATE, NOT BY UNDOING THE CLICK. The wrapped action may have closed
  // the palette itself — picking a preset does, deliberately (OB-106) — and a blind
  // second toggle would then RE-OPEN it, leaving the palette's flight animation
  // sitting over whatever the next step tries to click.
  if ((await isOpen()) !== wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
}

// 0 — with NOTHING selected, hovering a map cell PREVIEWS its connections in the
// pane, and the preview clears when the cursor leaves. (This block also used to
// assert the pane header was HEIGHT-STABLE while previewing, by measuring the
// containment wheel below it. The wheel went with #290, so the measurement went
// with it — the preview chip it shared the block with is still drawn, and is
// still the only check that map hover reaches the pane at all.)
const dcell = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('path[data-region][data-rtier="0"]')]
  for (const c of cells) {
    const b = c.getBoundingClientRect()
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2
    if (document.elementFromPoint(x, y) === c) return { x, y, id: c.getAttribute('data-region') }
  }
  return null
})
if (!dcell) {
  errors.push('preview: no domain cell whose centre lands inside itself')
} else {
  await page.mouse.move(dcell.x, dcell.y)
  await page.waitForTimeout(300)
  const prev = await page.locator('[data-childpreview]').getAttribute('data-childpreview')
  if (prev !== dcell.id) errors.push(`preview: hovering ${dcell.id} previews ${prev}`)
  await page.screenshot({ path: OUT + '/0-hover-preview.png' })
  const mapBox = await page.locator('[data-nested]').boundingBox()
  await page.mouse.move(mapBox.x + 4, mapBox.y + 4) // map corner = water
  await page.waitForTimeout(300)
  if ((await page.locator('[data-childpreview]').count()) !== 0) errors.push('preview: chip did not clear when the cursor left')
}

// 1 — atlas at L2 (topics): wrapped labels, no capital dots
await goLevel(2)
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '/1-atlas-L2.png' })

// 2 — select the largest topic cell: the map draws its overlay arrows
// (synthetic click bypasses pointerEvents gating and the dragDist>4 guard,
// since there is no preceding pointerdown)
const picked = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('path[data-terr][data-tier="2"]')]
  let best = null
  for (const c of cells) {
    const b = c.getBBox()
    const area = b.width * b.height
    if (!best || area > best.area) best = { area, id: c.getAttribute('data-terr'), el: c }
  }
  best.el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return best.id
})
await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '/2-topic-selected.png' })

// item 7's invariant, structural and corpus-independent: the overlay collapses
// every link between one PAIR of cells into ONE road, so no unordered pair may
// be drawn twice. (A reciprocal pair regressing to two bowed arrows trips this.)
const pairs = await page.evaluate(() => {
  const seen = new Set()
  const dups = []
  for (const g of document.querySelectorAll('[data-seledge]')) {
    const [s, t] = g.getAttribute('data-seledge').split('>')
    const k = s < t ? `${s}|${t}` : `${t}|${s}`
    if (seen.has(k)) dups.push(k)
    seen.add(k)
  }
  return { n: seen.size, dups }
})
if (pairs.n === 0) errors.push('edge collapse: the selection drew no roads at all')
if (pairs.dups.length) errors.push('edge collapse: pair drawn more than once — ' + pairs.dups.join(', '))

// the selection's neighbourhood: every counterpart cell the roads reach gets a
// lighter tint of its own — one data-selconn per counterpart, none for the
// selected cell itself
const conn = await page.$$eval('[data-selconn]', (gs) => gs.map((g) => g.getAttribute('data-selconn')))
if (conn.length === 0) errors.push('neighbourhood: selection tinted no connected cells')
if (conn.includes(picked)) errors.push('neighbourhood: the selected cell tinted itself as a counterpart')
if (new Set(conn).size !== conn.length) errors.push('neighbourhood: a counterpart tinted twice')

// 4 — the relations star, shot CLOSE UP: its type labels are ~8px on a 1750px
// frame, far too small to judge from the full page — crop to the pane.
//
// This used to begin by clicking `connections-mode-relations`. The rehaul (#253)
// replaced the pane's MODES with two columns that are both always on screen, so
// there is no mode to switch into: the star is simply there. The block that
// followed measured the relationship list at ~24% of the pane height; that
// window is gone with the modes, and the two columns' own geometry is asserted
// in browsertest-connections.mjs instead.
await page.screenshot({ path: OUT + '/4-relations-star.png' })
await page.getByLabel('connections-pane').screenshot({ path: OUT + '/4a-star-closeup.png' })

// 4a2 — SelfNotes: the star canvas pans and zooms. Wheel-in grows type with the
// picture; wheel-out CLAMPS at the legibility floor (12-unit labels ≥ ~8 CSS px,
// and never past ×1); double-click on water resets.
{
  const star = page.locator('[data-relstar]')
  const sb = await star.boundingBox()
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.wheel(0, -600)
  await page.waitForTimeout(250)
  const zIn = parseFloat(await star.getAttribute('data-cvz'))
  if (!(zIn > 1)) errors.push(`canvas zoom: wheel-in left z at ${zIn}`)
  await page.getByLabel('connections-pane').screenshot({ path: OUT + '/4a2-star-zoomed.png' })
  await page.mouse.wheel(0, 8000)
  await page.waitForTimeout(250)
  const zf1 = parseFloat(await star.getAttribute('data-cvz'))
  await page.mouse.wheel(0, 3000)
  await page.waitForTimeout(250)
  const zf2 = parseFloat(await star.getAttribute('data-cvz'))
  if (Math.abs(zf1 - zf2) > 1e-6) errors.push(`canvas zoom floor: kept sliding (${zf1} → ${zf2})`)
  if (!(zf1 <= 1 && zf1 >= 0.3)) errors.push(`canvas zoom floor: ${zf1} is not a plausible legibility floor`)
  // pan: drag on water moves the picture
  const t0 = await star.evaluate((s) => s.querySelector('[data-cvg]').getAttribute('transform'))
  await page.mouse.move(sb.x + 30, sb.y + 30)
  await page.mouse.down()
  await page.mouse.move(sb.x + 110, sb.y + 80, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  const t1 = await star.evaluate((s) => s.querySelector('[data-cvg]').getAttribute('transform'))
  if (t0 === t1) errors.push('canvas pan: dragging the star moved nothing')
  // double-click on water = home
  await star.dblclick({ position: { x: 12, y: 12 } })
  await page.waitForTimeout(150)
  const zHome = await star.getAttribute('data-cvz')
  if (zHome !== '1.00') errors.push(`canvas reset: double-click left z at ${zHome}`)
}

// 4b — ONE GESTURE: a navigating click both moves the selection and flies the
// map to where that node lives. `ConnectionsPane`'s `onSelect` publishes
// `setFocus` and `peekAt` together — "every navigating click is a crumb click".
//
// WHAT THIS BLOCK USED TO SAY, AND WHY IT NO LONGER SAYS IT. It drove hover sync
// from `[data-relrow]` — hovering a relationship ROW lit the matching star node,
// spotlit that topic's territory, lit the road to it, and named it in a
// `[data-hoverchip]`. Then it asserted a LOOK: clicking that row flew the camera
// and MUST NOT change the selection. The rehaul (#253) deleted the rows, the
// chip and the region star, and — the part that matters — INVERTED the click
// rule: a navigating click now deliberately moves the selection as well as the
// camera. So this is not a re-pointing of the old assertions; the old ones
// describe a pane that was replaced. The new pane's own behaviour (hover a star
// node, the cards below it filter; clicking a star node PINS that filter and
// does not navigate) is covered in browsertest-connections.mjs. What was never
// covered there, and is asserted here, is the MAP half: that the click actually
// moves the camera.
{
  const panel = page.locator('[aria-label="connections-pane"]')
  const camBefore = await getCam()
  const focusBefore = await panel.getAttribute('data-focus')
  // A row the map can actually FLY to. `MapView`'s look effect resolves
  // `flightTargetOf(peek.id)` and returns early when there is none, so the root —
  // the contains column's first row — is a look that correctly moves nothing.
  // Take the DEEPEST row instead: furthest from wherever the camera is standing.
  const target = await page.evaluate((standing) => {
    const rows = [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')]
      .map((r) => r.getAttribute('data-node-id'))
      .filter((id) => id && id !== 'root' && id !== standing)
    return rows.length ? rows[rows.length - 1] : null
  }, focusBefore)
  if (!target) errors.push('one gesture: the contains column offered no other row to click')
  else {
    await page.locator(`[aria-label="connections-pane"] [data-node-id="${target}"]`).first().click()
    await page.waitForTimeout(1100) // the look flight is 750ms (LOOK_FLY_MS)
    if ((await panel.getAttribute('data-focus')) === focusBefore)
      errors.push('one gesture: the click did not move the selection')
    if ((await getCam()) === camBefore) errors.push('one gesture: the click did not fly the camera')
  }

  // ◀ walks back to where you stood, ▶ re-walks forward. data-focus is the
  // pane's own declaration of where it stands.
  await page.getByLabel('connections-nav-back').click()
  await page.waitForTimeout(300)
  if ((await panel.getAttribute('data-focus')) !== focusBefore) errors.push('nav: back did not return to the previous focus')
  await page.getByLabel('connections-nav-forward').click()
  await page.waitForTimeout(300)
  if ((await panel.getAttribute('data-focus')) === focusBefore) errors.push('nav: forward did not re-walk the hop')
  await page.getByLabel('connections-nav-back').click()
  await page.waitForTimeout(300)
}

// 4c — THE GENERATED LENS. `implements` is the corpus's fourth relation type
// and it never had a lens pane — not because LensPane couldn't render one (its
// config is Record<EdgeType, …>, so TS forced an `implements` entry years ago)
// but because a lens needed four hand-edits in four parallel structures inside
// StudioView, and nobody made them. The registry now generates one per edge
// type, so this pane exists for free. Toggle it on over the focused topic, check
// it renders, toggle it back off so the cockpit is intact for the frames below.
await withPalette(async () => {
  await page.getByLabel('studio-inst-lens-implemented_with').click()
  await page.waitForTimeout(600)
})
await page.screenshot({ path: OUT + '/4c-generated-lens.png' })
const lensPane = page.locator('[aria-label="studio-pane-lens-implemented_with"][data-slot="on"]')
if ((await lensPane.count()) !== 1) errors.push('generated lens: the lens-implemented_with pane did not mount')
else if (!(await lensPane.innerText()).trim()) errors.push('generated lens: the pane mounted but rendered nothing')
else {
  // ── OB-180: the lens takes the system's own surface — no slate class, every text run 4.5:1 ──
  // Contrast is read off the LIVE elements against whatever is actually behind each run (the
  // nearest ancestor painting an opaque background, semi-transparent ones composited over it),
  // never computed against an assumed ground.
  const lensContrast = await lensPane.evaluate((pane) => {
    const parse = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null }
    const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4) }
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const behind = (el) => {
      // composite every ancestor's background from the first opaque one down to `el`
      const layers = []
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor)
        if (c && c[3] > 0) { layers.unshift(c); if (c[3] >= 1) break }
      }
      let out = [255, 255, 255]
      for (const [r, g, b, a] of layers) out = [out[0] * (1 - a) + r * a, out[1] * (1 - a) + g * a, out[2] * (1 - a) + b * a]
      return out
    }
    const runs = []
    for (const el of pane.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!own) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.getBoundingClientRect().width === 0) continue
      const ink = parse(el instanceof SVGElement ? cs.fill : cs.color)
      if (!ink || ink[3] === 0) continue
      const bg = behind(el)
      runs.push({ text: el.textContent.trim().slice(0, 24), ratio: +ratio(ink, bg).toFixed(2), tag: el.tagName.toLowerCase() })
    }
    runs.sort((a, b) => a.ratio - b.ratio)
    return { slate: pane.querySelectorAll('[class*="slate-"]').length, runs: runs.length, lowest: runs.slice(0, 3) }
  })
  console.log(`OB-180 lens: ${lensContrast.runs} text runs, ${lensContrast.slate} slate- element(s), lowest contrast ${JSON.stringify(lensContrast.lowest)}`)
  if (lensContrast.slate !== 0) errors.push(`OB-180: ${lensContrast.slate} element(s) in the lens pane still wear a slate- class`)
  if (!(lensContrast.runs > 0 && lensContrast.lowest[0].ratio >= 4.5)) errors.push(`OB-180: a text run in the lens is under 4.5:1 against what is behind it — ${JSON.stringify(lensContrast.lowest)}`)
}
await withPalette(async () => {
  await page.getByLabel('studio-inst-lens-implemented_with').click()
  await page.waitForTimeout(300)
})

// 5 — atlas at L4 (concepts): deep-tier wrap + honest label drops
await goLevel(4)
await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '/5-atlas-L4.png' })

// 5a — item 10: the 26px parent watermark lying across the active names must
// step aside for the cell the cursor is in. Hover with a REAL mouse move so
// pointerenter fires (a synthetic click would not), aiming at a point verified
// to actually land on a tier-4 cell — a bbox centre can fall outside a convex
// polygon. Frame 5 above is the same view un-faded, so the two compare.
const cell = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('path[data-terr][data-tier="4"]')]
  cells.sort((a, b) => {
    const ba = a.getBoundingClientRect()
    const bb = b.getBoundingClientRect()
    return bb.width * bb.height - ba.width * ba.height
  })
  for (const c of cells) {
    const b = c.getBoundingClientRect()
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2
    const hit = document.elementFromPoint(x, y)
    if (hit && hit.getAttribute('data-tier') === '4') return { x, y, id: hit.getAttribute('data-terr') }
  }
  return null
})
if (!cell) {
  errors.push('item 10: no L4 cell whose centre actually lands inside itself')
} else {
  await page.mouse.move(cell.x, cell.y)
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + '/5a-watermark-fade.png' })
  const faded = await page.evaluate(
    () => [...document.querySelectorAll('[data-ghostlabel]')].map((e) => Number(e.getAttribute('opacity'))).filter((o) => o < 0.05).length,
  )
  if (faded !== 1) errors.push(`item 10: expected exactly 1 faded watermark under the cursor, got ${faded}`)

  // (This block also asserted a `[data-hoverchip]` naming the hovered cell. The
  // map's top-left hover chip was deleted with its bottom info bar — `1e530af`,
  // OB-095 — and what replaced it is the DS `MapTooltip`, whose own rule is
  // covered in browsertest-maphover.mjs.)
}

// 5b — a DOMAIN selection at L0. This is the ROLLED-UP grain: topic edges are
// lifted to region↔region roads, so it exercises the other half of the bundle
// code (mixed-type bundles draw slate, two-way bundles lose their arrowheads).
await goLevel(0)
await page.waitForTimeout(900)
const domain = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('path[data-region][data-rtier="0"]')]
  let best = null
  for (const c of cells) {
    const b = c.getBBox()
    const area = b.width * b.height
    if (!best || area > best.area) best = { area, id: c.getAttribute('data-region'), el: c }
  }
  best.el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return best.id
})
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '/5b-domain-rollup.png' })
const rollupDups = await page.evaluate(() => {
  const seen = new Set()
  const dups = []
  for (const g of document.querySelectorAll('[data-seledge]')) {
    const [s, t] = g.getAttribute('data-seledge').split('>')
    const k = s < t ? `${s}|${t}` : `${t}|${s}`
    if (seen.has(k)) dups.push(k)
    seen.add(k)
  }
  return dups
})
if (rollupDups.length) errors.push('rollup collapse: pair drawn more than once — ' + rollupDups.join(', '))

// SelfNotes: region names WRAP inside their territories now. At L0 the active
// domain names must not collide (they used to run two cells over and pile up),
// and the corpus's multi-word names mean at least one must have split lines.
{
  const boxes = await page.$$eval('[data-regionlabel]', (ts) =>
    ts
      .filter((t) => Number(t.getAttribute('opacity')) > 0.3) // active-level names only
      .map((t) => {
        const b = t.getBoundingClientRect()
        return { id: t.getAttribute('data-regionlabel'), x: b.x, y: b.y, w: b.width, h: b.height, lines: t.querySelectorAll('tspan').length }
      }),
  )
  if (boxes.length < 2) errors.push(`region labels: expected the L0 domain names, found ${boxes.length}`)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        errors.push(`region labels: ${a.id} and ${b.id} overlap at L0`)
    }
  if (!boxes.some((b) => b.lines > 1)) errors.push('region labels: nothing wrapped at L0 despite multi-word domain names')
}

// 5c/5d — REMOVED. A domain selection used to draw a REGION STAR in the pane:
// counterpart areas ringed at their map bearings, list rows to match, and a
// summary ⇄ detailed grain toggle. The rehaul (#253) replaced the pane's whole
// external view, and `data-regionstar`, `data-regionnode`, `data-regionrow` and
// the `ext-grain-*` buttons went with it. The map half of the same selection —
// that the rolled-up roads collapse one pair to one road — is asserted just
// above, and is the part that had no other home.

// 5e — SelfNotes: Esc DESELECTS for real now (focus cleared with the overlay),
// and ◀ back restores exactly the node you deselected.
{
  const panel = page.locator('[aria-label="connections-pane"]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  if ((await page.locator('[aria-label="connections-pane"][data-focus]').count()) !== 0)
    errors.push('deselect: Esc left the focus standing')
  await page.getByLabel('connections-nav-back').click()
  await page.waitForTimeout(300)
  if ((await panel.getAttribute('data-focus')) !== domain)
    errors.push('deselect: back did not restore the deselected domain')
}

// 5f — issue #6 (2026-07-17): a selection BELOW the topic grain draws NO roads
// (the map-side twin of the pane's retired "via" lift — borrowing the owning
// topic's arrows made every relation-less child look connected), and
// de-selecting RESTS the pane on the node you were exploring instead of
// yanking it to the whole-map root reading.
{
  await goLevel(3)
  await page.waitForTimeout(900)
  const deepId = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('path[data-terr][data-tier="3"]')]
    let best = null
    for (const c of cells) {
      const b = c.getBBox()
      const area = b.width * b.height
      if (!best || area > best.area) best = { area, id: c.getAttribute('data-terr'), el: c }
    }
    best.el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return best.id
  })
  await page.waitForTimeout(600)
  if ((await page.locator('[data-seledge]').count()) !== 0) errors.push('deep-sel: a below-topic selection drew borrowed roads')
  if ((await page.locator('[data-selconn]').count()) !== 0) errors.push('deep-sel: a below-topic selection tinted a neighbourhood')
  if ((await page.locator('[data-seloutline]').count()) !== 1) errors.push('deep-sel: the selected cell lost its own outline')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // PARK THE CURSOR ON WATER FIRST. With nothing selected the pane shows a
  // PREVIEW of whatever the cursor is over (`previewId` in ConnectionsPane), and
  // that preview is what the breadcrumb reads. Leaving the mouse wherever the
  // last frame put it therefore asks the pane a different question than this
  // block means to ask — "what are you pointing at" rather than "where do you
  // rest". The map's top-left corner is water: nothing to hover.
  const water = await page.locator('[data-nested]').boundingBox()
  await page.mouse.move(water.x + 4, water.y + 4)
  await page.waitForTimeout(300)
  // `data-current` is the pane's OWN declaration of the node it is reading —
  // `previewId ?? focusId`. This used to scrape the last breadcrumb chip, which
  // is a lossy proxy for the same thing.
  const tip = await page.locator('[aria-label="connections-pane"]').getAttribute('data-current')
  if (tip !== deepId) errors.push(`deselect: pane rested on ${tip}, expected ${deepId}`)
  await goLevel(2) // leave the map roughly where 5e did
  await page.waitForTimeout(600)
}

// 6 — Teaching preset: since the flat Map was deleted (2026-07-14) this preset
// inherits the nested atlas in its place — check it still lays out sanely
await withPalette(async () => {
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(900)
})
await page.screenshot({ path: OUT + '/6-teaching.png' })

console.log('picked topic:', picked)
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
} else {
  console.log('no page errors')
}
await browser.close()
vite.kill()
process.exit(errors.length ? 1 : 0)
