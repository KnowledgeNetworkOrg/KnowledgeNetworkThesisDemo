// browsertest-mapconnections.mjs — the map and the reading pane beside it reading each
// other, and the map reading the corpus (#294). The reading pane was the connections
// pane until #339 retired it (its tree is the map’s Explorer rail now, its relations the
// Document pane’s Relations rail); the Document pane is the one read here.
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
//     behaviour was covered in browsertest-connections.mjs, deleted with the pane (#339).
//   - the old LOOK assertion, which said a click flies the camera and MUST NOT
//     change the selection. That rule INVERTED with #253, and #339 moved the tree to
//     the map's Explorer rail: a row click moves the one selection. Section 4b says
//     what it asserts now, and what it only reports.
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
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

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

/** Step the map to a containment level, named by the INTERNAL tier every `data-tier`
 *  and `data-rtier` below reads. The old `nested-level-N` button row was deleted with
 *  the map's bottom info bar (`1e530af`, OB-094/096); the level is chosen from a
 *  floating DS `LevelPicker` now — a "levels" button that opens L0..Lmax.
 *
 *  THE PICKER'S DISPLAYED LABELS RUN ONE AHEAD OF THE TIER SINCE #336 (OB-193): the
 *  corpus root became displayed "L0" (internal level -1, one region), so the domains
 *  are displayed "L1" and a tier-N cell is reached by picking "L{N+1}". This helper
 *  takes the TIER, so every call below keeps the grain its own comment names. */
const goLevel = async (n) => {
  await page.locator('[aria-label="levels"]').click()
  await page.locator('[aria-label="levels"] ~ div button', { hasText: new RegExp(`^L${n + 1}$`) }).click()
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

// 0 — with NOTHING selected, hovering a map cell PREVIEWS it in the reading pane, and
// the preview clears when the cursor leaves. The reading pane was the connections pane
// (its `data-childpreview` chip) until #339 retired it; it is the Document pane now,
// which declares the node it previews as `data-preview`. (The Relations rail's own
// treatment of that preview is browsertest-relationsrail.mjs's to check.)
const DOC = '[aria-label="document-panel"]'
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
  const prev = await page.locator(DOC).getAttribute('data-preview')
  if (prev !== dcell.id) errors.push(`preview: hovering ${dcell.id} previews ${prev}`)
  await page.screenshot({ path: OUT + '/0-hover-preview.png' })
  const mapBox = await page.locator('[data-nested]').boundingBox()
  await page.mouse.move(mapBox.x + 4, mapBox.y + 4) // map corner = water
  await page.waitForTimeout(300)
  if ((await page.locator(`${DOC}[data-preview]`).count()) !== 0) errors.push('preview: the preview did not clear when the cursor left')
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

// 4 / 4a2 — REMOVED with the connections pane (#339). They shot the pane's relations
// STAR close up and drove its pan/zoom canvas (`data-relstar`, `data-cvz`, `data-cvg`);
// the star was the split pane's, and nothing has drawn it since the pane was unmounted.
// The Document pane's Relations rail is what shows a node's relations now, and
// browsertest-relationsrail.mjs checks it.

// 4b — A ROW CLICK MOVES THE ONE SELECTION. The tree lives in the map's Explorer rail
// since #339 (it was the connections pane's contains column), and OB-227 clause 1 has
// its clicks move the same focus the map's own cells move. Read off the map itself:
// `data-sel` is the map's own declaration of what is selected.
//
// WHAT THIS BLOCK NO LONGER SAYS. It drove ◀ / ▶ through the pane's history buttons;
// those buttons died with the pane and nothing else draws them — #404 asks whether they
// should come back. It also asserted the click FLEW THE CAMERA, which the pane did by
// publishing `peekAt` beside `setFocus`; the rail publishes only `setFocus`, so the
// camera half is now measured and REPORTED below rather than required (see #404).
{
  const selOf = () => page.evaluate(() => document.querySelector('svg[data-nested]')?.getAttribute('data-sel') ?? null)
  if (!(await page.locator('[data-explorer-rail] [data-node-id]').count())) {
    await page.locator('[data-explorer-corner] button').click()
    await page.waitForTimeout(400)
  }
  const camBefore = await getCam()
  const selBefore = await selOf()
  // the DEEPEST row that is not the selection — the root moves nothing, and clicking the
  // selected row would CLEAR it (the rail is mounted `deselectable`)
  const target = await page.evaluate((standing) => {
    const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
      .map((r) => r.getAttribute('data-node-id'))
      .filter((id) => id && id !== 'root' && id !== standing)
    return rows.length ? rows[rows.length - 1] : null
  }, selBefore)
  if (!target) errors.push('one selection: the Explorer rail offered no other row to click')
  else {
    await page.locator(`[data-explorer-rail] [data-node-id="${target}"]`).first().click()
    await page.waitForTimeout(1100)
    const selAfter = await selOf()
    if (selAfter !== target) errors.push(`one selection: clicking rail row ${target} left the map selecting ${selAfter}`)
    console.log(`4b: a rail row click ${(await getCam()) === camBefore ? 'did NOT move' : 'moved'} the map camera (#404)`)
  }
  // close the rail again so the frames below see the map as they always have
  if (await page.locator('[data-explorer-rail] [data-node-id]').count()) {
    await page.locator('[data-explorer-rail] button').first().click() // the open head's handle
    await page.waitForTimeout(300)
  }
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
// #336 (OB-193): these tier-4 cells are now displayed "L5"; `goLevel` takes the tier.
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
// #336 (OB-193): the domain names are now the picker's "L1" — its "L0" is the
// corpus root's own single region, which is the one label this block must not read.
//
// #369: the same read, twice — with the Explorer rail closed (the default: every domain must
// still be NAMED, the gate that drops a colliding name must not touch a screen that never had
// one) and with it open, which narrows the canvas by the rail's width (196px at its default
// fit), which is what put `sys` and `cs` 3.3 x 7.2px into each other at 1750x950. Open, a
// name may be missing — that is the fix, the later of two colliding names is left out — but
// no two drawn names may meet.
{
  /** the ids of every region at one internal tier, off the cells the map mounts */
  const regionIds = (tier) =>
    page.$$eval(`path[data-region][data-rtier="${tier}"]`, (ps) => [...new Set(ps.map((p) => p.getAttribute('data-region')))])
  /** the drawn names at one tier, as the boxes a person sees. Filtered to that tier's own
   *  regions AND to opacity > 0.3: at L1 the domain names are still in the DOM as the parent's
   *  faint watermark, and those are not the names being read. */
  const readNames = async (tier) =>
    page.$$eval(
      '[data-regionlabel]',
      (ts, ids) =>
        ts
          .filter((t) => ids.includes(t.getAttribute('data-regionlabel')) && Number(t.getAttribute('opacity')) > 0.3)
          .map((t) => {
            const b = t.getBoundingClientRect()
            return { id: t.getAttribute('data-regionlabel'), x: b.x, y: b.y, w: b.width, h: b.height, lines: t.querySelectorAll('tspan').length }
          }),
      await regionIds(tier),
    )
  /** every pair of boxes that meet, with how far (both in px) */
  const meetings = (boxes) => {
    const out = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
          out.push({ a: a.id, b: b.id, w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) })
      }
    return out
  }
  const openRail = async () => {
    await page.locator('[data-explorer-corner] button').click()
    await page.waitForTimeout(700) // the pane narrows, the map refits, the names re-fit with it
  }
  const closeRail = async () => {
    await page.locator('[data-explorer-rail] button').first().click() // the open head's handle
    await page.waitForTimeout(700)
  }

  const domainIds = await regionIds(0)
  const boxes = await readNames(0)
  if (boxes.length < 2) errors.push(`region labels: expected the L0 domain names, found ${boxes.length}`)
  for (const m of meetings(boxes)) errors.push(`region labels: ${m.a} and ${m.b} overlap at L0`)
  if (!boxes.some((b) => b.lines > 1)) errors.push('region labels: nothing wrapped at L0 despite multi-word domain names')
  if (boxes.length !== domainIds.length)
    errors.push(`region labels: the rail closed drew ${boxes.length} of ${domainIds.length} domain names — ${domainIds.filter((d) => !boxes.some((b) => b.id === d)).join(', ')} missing`)

  await openRail()
  await page.screenshot({ path: OUT + '/5b2-domain-names-rail-open.png' })
  const openBoxes = await readNames(0)
  if (openBoxes.length < 2) errors.push(`region labels: the rail open drew ${openBoxes.length} domain names`)
  for (const m of meetings(openBoxes)) errors.push(`region labels: ${m.a} and ${m.b} overlap at L0 with the rail open (${m.w.toFixed(1)} x ${m.h.toFixed(1)}px)`)
  console.log(`#369 domain names: ${boxes.length}/${domainIds.length} drawn rail closed, ${openBoxes.length}/${domainIds.length} rail open (left out: ${domainIds.filter((d) => !openBoxes.some((b) => b.id === d)).join(', ') || 'none'})`)

  // THE MODULE NAMES ARE NOT GATED — the fix above is the L0 domain names only, and this
  // grain is left as it was. Logged, not asserted, so a collision here is on record for a
  // card of its own rather than found again by accident.
  await goLevel(1)
  await page.waitForTimeout(900)
  const moduleIds = await regionIds(1)
  const moduleOpen = await readNames(1)
  await closeRail()
  const moduleClosed = await readNames(1)
  const describeMeetings = (bs) => meetings(bs).map((m) => `${m.a}/${m.b} ${m.w.toFixed(1)}x${m.h.toFixed(1)}px`).join('; ') || 'none'
  console.log(`#369 module names at L1: rail closed ${moduleClosed.length}/${moduleIds.length} drawn, overlaps ${describeMeetings(moduleClosed)}`)
  console.log(`#369 module names at L1: rail open ${moduleOpen.length}/${moduleIds.length} drawn, overlaps ${describeMeetings(moduleOpen)}`)
  await goLevel(0) // leave the map at L0 with the rail closed, as this block found it
  await page.waitForTimeout(900)
}

// 5c/5d — REMOVED. A domain selection used to draw a REGION STAR in the pane:
// counterpart areas ringed at their map bearings, list rows to match, and a
// summary ⇄ detailed grain toggle. The rehaul (#253) replaced the pane's whole
// external view, and `data-regionstar`, `data-regionnode`, `data-regionrow` and
// the `ext-grain-*` buttons went with it. The map half of the same selection —
// that the rolled-up roads collapse one pair to one road — is asserted just
// above, and is the part that had no other home.

// 5e — SelfNotes: Esc DESELECTS for real (focus cleared with the overlay). Read off the
// map's own `data-sel`. The second half — ◀ back restores exactly the node you
// deselected — went with the connections pane's history buttons (#339); #404 asks
// whether they come back, and this is where that assertion would return.
{
  // PRECONDITION: something must be selected, or the Esc below would pass on nothing.
  if ((await page.locator('svg[data-nested][data-sel]').count()) !== 1)
    errors.push('deselect: nothing was selected going into 5e, so its Esc would test nothing')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  if ((await page.locator('svg[data-nested][data-sel]').count()) !== 0)
    errors.push('deselect: Esc left the selection standing')
}

// 5f — issue #6 (2026-07-17): a selection BELOW the topic grain draws NO roads
// (the map-side twin of the pane's retired "via" lift — borrowing the owning
// topic's arrows made every relation-less child look connected), and
// de-selecting RESTS the map's breadcrumb on the node you were exploring instead of
// yanking it to the whole-map root reading.
//
// THE RESTING HALF MOVED SURFACES WITH #339. It was read off the connections pane's
// `data-current`, and that pane rested on the node. The Document pane does NOT — on a
// deselect it falls to its "Nothing chosen" placeholder (`bus.focus ?? previewId`, #342).
// That is a BUG against the design, not the design: OB-240 clause 2 says the document
// keeps the last node it was reading, and #386 is open for it. When #386 lands, the
// document's `data-current` should rest on `deepId` here again, and this block should
// assert it. #404 lists it with the other things the retired pane carried. What still
// rests is the map's own header path (OB-241/243: "the aim keeps its resting reading
// after a deselect while the LIT state goes out"), so that is what is read here: its
// last crumb, which names the node, before and after the deselect.
const crumbTail = () => page.evaluate(() => {
  const row = document.querySelector('[data-explorer-corner] + div')
  const leaves = [...(row?.querySelectorAll('span') ?? [])].filter((n) => !n.children.length && n.textContent.trim() && n.textContent.trim() !== '›')
  return leaves.length ? leaves[leaves.length - 1].textContent.trim() : null
})
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
  const crumbSelected = await crumbTail()
  // the crumb must NAME the deep node, not merely hold still: while it is selected the
  // document pane is on it, and its header carries the same corpus title the crumb does
  const docOnDeep = await page.locator('[aria-label="document-panel"]').getAttribute('data-current')
  const docText = await page.locator('[aria-label="document-panel"]').innerText()
  if (docOnDeep !== deepId) errors.push(`deep-sel: the document pane is on ${docOnDeep}, expected the selected ${deepId}`)
  else if (!crumbSelected || !docText.includes(crumbSelected)) errors.push(`deep-sel: the map's header path ends "${crumbSelected}", which is not ${deepId}'s title in the document`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // PARK THE CURSOR ON WATER FIRST, so no hover preview is standing in for the
  // resting reading this block means to ask about — "where do you rest", not "what
  // are you pointing at". The map's top-left corner is water: nothing to hover.
  const water = await page.locator('[data-nested]').boundingBox()
  await page.mouse.move(water.x + 4, water.y + 4)
  await page.waitForTimeout(300)
  if ((await page.locator('svg[data-nested][data-sel]').count()) !== 0) errors.push('deselect: Esc left the deep selection standing')
  const crumbResting = await crumbTail()
  if (!crumbSelected) errors.push(`deselect: the map's header path named nothing while ${deepId} was selected`)
  else if (crumbResting !== crumbSelected) errors.push(`deselect: the map's header path rested on "${crumbResting}", expected "${crumbSelected}" (${deepId})`)
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
