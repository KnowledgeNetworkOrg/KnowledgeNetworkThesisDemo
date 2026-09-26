// browsertest-relationsrail.mjs — #342, the dissolution's step 3: the document pane's
// Relations rail, its hover card, the two-way light between the rail and the map, and the
// document pane's preview and nothing-chosen states.
//
// A TEST. It opens the real app in a real browser and asserts what a person sees, item by item
// (DS OB-209, OB-224, OB-229, OB-230, OB-235, OB-242). The unit suite pins the pure parts — the
// figure's placement, the chart's counts, the card's sentence and bracket, the via roll-up, the
// map's hover rule; this proves the wiring, which is the half a correct function cannot.
//
// TWO CORPORA, ONE PORT. The teaching corpus first; then vite is restarted on the SAME port with
// `VITE_CORPUS=courses`, because two of the done-whens can only be checked there: a course that
// states no prerequisite and that nothing depends on (the rail's placeholder), and a corpus whose
// only relation kind is `depends_on` (one kind takes half the circle). The hand-authored corpus
// guarantees neither shape, which is why neither had been on screen before.
//
// WHAT IT SELECTS BY. `[aria-label="document-panel"]` and its `data-doc-current`, `data-doc-head`,
// `data-doc-empty`, `data-relations-rail`, `data-relations-corner` (the pane's own hooks);
// `data-preview-banner`, `data-pane-placeholder`, `data-orbit`, `data-orbit-lit`,
// `data-orbit-wedge`, `data-orbit-card`, `data-rel-group-sentence`, `data-relation-stats`,
// `data-stats-kind`, `data-stop-card` (the components'); `svg[data-nested]`, `data-terr`,
// `data-spot`, `data-centre-lit`, `data-seledge`/`data-elit` (the map's).
//
// THE MOUSE HAS TO TRAVEL (see browsertest-maphover.mjs): `mouse.move(x, y)` teleports, and a
// hover card is placed from the move that raised it, so every approach steps.
//
// Spawns vite ITSELF on its own fixed port (--strictPort).
// Run from anywhere:  node tools/studio-spike/browsertest-relationsrail.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5264

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

/** start vite on PORT, retrying while the previous run's socket is still being released */
const startVite = async (env) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    let out = ''
    const up = await new Promise((res) => {
      const t = setTimeout(() => res(false), 30000)
      const watch = (d) => {
        out += String(d)
        if (out.includes('localhost:')) { clearTimeout(t); res(true) }
      }
      proc.stdout.on('data', watch)
      proc.stderr.on('data', watch)
      proc.on('exit', () => { clearTimeout(t); res(false) })
    })
    if (up) return proc
    proc.kill()
    await new Promise((r) => setTimeout(r, 1500))
    if (attempt === 4) throw new Error('vite did not become ready:\n' + out)
  }
}
const stopVite = (proc) => new Promise((res) => {
  if (proc.exitCode !== null) return res()
  proc.on('exit', () => res())
  proc.kill()
})

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' - ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
/** a FRESH context per corpus: the second vite serves the same URLs with a different corpus
 *  compiled in, and a shared HTTP cache is the one way the first run could leak into it */
const freshPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1750, height: 950 } })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  return p
}
let page = await freshPage()

const DOC = '[aria-label="document-panel"]'
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel)
/** park the pointer in the app's top-left chrome, off every pane under test */
const park = async () => { await page.mouse.move(5, 5, { steps: 6 }); await page.waitForTimeout(260) }
/** cross INTO a target rather than teleporting onto it — see the note at the top */
const glideTo = async (p) => { await page.mouse.move(p.x, p.y, { steps: 14 }); await page.waitForTimeout(320) }

const openExplore = async () => {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(500)
  }
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(800)
}
/** the map's level, by the INTERNAL tier (2 = topics / courses) — the same helper
 *  browsertest-mapconnections.mjs carries */
const goLevel = async (n) => {
  await page.locator('[aria-label="levels"]').click()
  await page.locator('[aria-label="levels"] ~ div button', { hasText: new RegExp(`^L${n + 1}$`) }).click()
  await page.waitForTimeout(700)
}

/** everything the document pane is showing, in one read */
const docState = () => page.evaluate((DOC) => {
  const root = document.querySelector(DOC)
  if (!root) return null
  const banner = root.querySelector('[data-preview-banner]')
  const next = banner && banner.nextElementSibling
  const empty = root.querySelector('[data-doc-empty] [data-pane-placeholder]')
  const head = root.querySelector('[data-doc-head]')
  const kindEl = head && head.querySelector(':scope > div:first-child > div > div:nth-child(1)')
  const titleEl = head && head.querySelector(':scope > div:first-child > div > div:nth-child(2)')
  const rail = root.querySelector('[data-relations-rail]')
  const railPh = rail && rail.querySelector('[data-pane-placeholder]')
  return {
    current: root.getAttribute('data-doc-current'),
    banner: banner ? banner.getAttribute('data-preview-banner') : null,
    bannerText: banner ? banner.textContent : null,
    firstTop: next ? next.getBoundingClientRect().top : null,
    placeholder: empty ? empty.textContent : null,
    placeholders: root.querySelectorAll('[data-pane-placeholder]').length,
    head: !!head,
    /* the DocHeader's eyebrow: "topic" for the edge-bearing level — a COURSE in the course
       corpus — and the node's own kind otherwise */
    kind: kindEl ? kindEl.textContent.trim().toLowerCase() : null,
    title: titleEl ? titleEl.textContent : null,
    railOpen: !!(rail && rail.firstElementChild),
    figure: !!(rail && rail.querySelector('svg [data-orbit]')),
    marks: rail ? rail.querySelectorAll('svg g[data-orbit]:not([data-orbit="@self"])').length : 0,
    neighbours: rail ? [...new Set([...rail.querySelectorAll('svg g[data-orbit]:not([data-orbit="@self"])')].map((g) => g.getAttribute('data-orbit')))] : [],
    stats: !!(rail && rail.querySelector('[data-relation-stats]')),
    statsRelationships: (() => {
      const s = rail && rail.querySelector('[data-relation-stats]')
      const n = s && s.firstElementChild && s.firstElementChild.lastElementChild && s.firstElementChild.lastElementChild.firstElementChild
      return n ? Number(n.textContent) : null
    })(),
    railPlaceholder: railPh ? railPh.textContent : null,
    hairline: !!(rail && [...rail.querySelectorAll('div')].some((d) => d.style.height === '1px' && d.style.margin === '6px 0px 8px')),
    listHeaders: rail ? rail.querySelectorAll('[data-rel-group-header]').length : 0,
  }
}, DOC)

/** every hit-testable map cell, one point each */
const mapCells = () => page.evaluate(() => {
  const svg = document.querySelector('svg[data-nested]')
  if (!svg) return []
  const b = svg.getBoundingClientRect()
  const seen = new Map()
  for (let y = b.y + 10; y < b.y + b.height - 10; y += 9) {
    for (let x = b.x + 10; x < b.x + b.width - 10; x += 9) {
      const el = document.elementFromPoint(x, y)
      const id = el && (el.getAttribute('data-terr') || el.getAttribute('data-region'))
      if (!id || seen.has(id)) continue
      if (getComputedStyle(el).pointerEvents === 'none') continue
      seen.set(id, { x, y, id })
    }
  }
  return [...seen.values()]
})
const selId = () => page.evaluate(() => document.querySelector('svg[data-nested]')?.getAttribute('data-sel') ?? null)

/** the figure's geometry: its box, its centre, and every dot's centre by target id */
const figure = () => page.evaluate(() => {
  /* found FROM ITS HUB, not as the rail's first svg: the rail's close chevron and its mark are
     svgs too, and they come first */
  const hubG = document.querySelector('[aria-label="document-panel"] [data-relations-rail] g[data-orbit="@self"]')
  const svg = hubG && hubG.ownerSVGElement
  if (!svg) return null
  const b = svg.getBoundingClientRect()
  const dots = [...svg.querySelectorAll('g[data-orbit]:not([data-orbit="@self"])')].map((g) => {
    const c = g.querySelectorAll('circle')[1].getBoundingClientRect()
    return { id: g.getAttribute('data-orbit'), x: c.x + c.width / 2, y: c.y + c.height / 2 }
  })
  const hub = svg.querySelector('g[data-orbit="@self"] circle:last-child').getBoundingClientRect()
  return { box: { x: b.x, y: b.y, w: b.width, h: b.height }, cx: b.x + b.width / 2, cy: b.y + b.height / 2, dots, hub: { x: hub.x + hub.width / 2, y: hub.y + hub.height / 2 } }
})
/** the open card's box and header words, or null. Looked for in the pane's TIP LAYER, not in
 *  the pane's content: the layer draws the card BESIDE the content it wraps, so a query scoped to
 *  `document-panel` never sees it — and every "no card" check would pass by not looking. */
const card = () => page.evaluate((DOC) => {
  const root = document.querySelector(DOC)
  const layer = root && root.closest('[data-tip-layer]')
  const c = layer && (layer.querySelector('[data-orbit-card]') || layer.querySelector('[data-stop-card]'))
  if (!c) return null
  const r = c.getBoundingClientRect()
  const sentence = c.querySelector('[data-rel-group-sentence]')
  /* the SOURCE pill is the first chip in the card; a pill too narrow for its name draws it cut
     and carries the whole citation in its tooltip instead (NodeChip's measured-mention rule) */
  const sourceTip = c.querySelector('span[title]')
  return {
    kind: c.hasAttribute('data-orbit-card') ? 'relation' : 'document',
    key: c.getAttribute('data-orbit-card'),
    box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
    header: sentence ? [...sentence.children].map((s) => s.textContent.trim()).join(' ') : null,
    text: c.textContent,
    source: sourceTip ? sourceTip.getAttribute('title').replace(/\s+/g, ' ') : null,
  }
}, DOC)
const mapLit = () => page.evaluate(() => {
  const svg = document.querySelector('svg[data-nested]')
  return {
    spot: svg?.querySelector('[data-spot]')?.getAttribute('data-spot') ?? null,
    centre: svg?.querySelector('[data-centre-lit]')?.getAttribute('data-centre-lit') ?? null,
    roads: svg ? svg.querySelectorAll('[data-seledge]').length : 0,
    roadsLit: svg ? svg.querySelectorAll('[data-seledge][data-elit="1"]').length : 0,
  }
})

// ═══ THE TEACHING CORPUS ═══════════════════════════════════════════════════════
/* a THROW anywhere below is reported as a failure and still closes the browser and the dev
   server — a crashed driver must not leave vite holding the port for the next run */
let vite = null
try {
vite = await startVite({})
await openExplore()
await park()

// ── 1. OB-209 clause 4: nothing chosen is a placeholder, on first load ──────────
const rest = await docState()
ok('the document pane is on the explore desk', !!rest)
ok('OB-209: with nothing chosen the pane draws the placeholder, "Nothing chosen"', !!rest?.placeholder && rest.placeholder.includes('Nothing chosen'), JSON.stringify(rest?.placeholder))
ok('OB-209: and no node title anywhere — no head, no rail', rest && !rest.head && !rest.railOpen)
ok('OB-209: the preview row is mounted at rest, empty', rest?.banner === '', JSON.stringify(rest?.banner))
ok('OB-209: the resting row says nothing', (rest?.bannerText ?? 'x') === '')

// ── 2. OB-209 clause 2: a foreign hover previews, and leaving returns to the placeholder ──
await goLevel(2)
let cells = await mapCells()
ok('the map at the topic level has cells to point at', cells.length >= 6, `${cells.length} cells`)
const first = cells[Math.floor(cells.length / 2)]
if (first) {
  await glideTo(first)
  const pv = await docState()
  ok('OB-209: hovering a map cell previews THAT node in the document pane', pv?.current === first.id, `${pv?.current} vs ${first.id}`)
  ok('OB-209: the head is drawn for the hovered node, and the placeholder is gone', pv?.head && !pv?.placeholder)
  ok('OB-209: the preview row names it', pv?.banner === first.id && /preview/i.test(pv?.bannerText ?? '') && /hovering/.test(pv?.bannerText ?? ''), JSON.stringify(pv?.bannerText))
  ok('OB-209: the first body element does not move between rest and preview (±0.5px)',
    rest?.firstTop != null && pv?.firstTop != null && Math.abs(pv.firstTop - rest.firstTop) <= 0.5, `${rest?.firstTop} vs ${pv?.firstTop}`)
  await park()
  const back = await docState()
  ok('OB-209: moving off the map returns to the placeholder, not to the node just hovered', !!back?.placeholder && back.current === '' && !back.head, JSON.stringify({ c: back?.current, ph: back?.placeholder }))
}

// ── 3. choose a topic with neighbours; a selection pins the pane ────────────────
let A = null
for (const c of cells) {
  await page.mouse.click(c.x, c.y)
  await page.waitForTimeout(320)
  const s = await docState()
  if (s?.current === c.id && s.marks >= 3) { A = { ...c, state: s }; break }
}
ok('a topic with three or more relationships was selected', !!A, A ? `${A.id}: ${A.state.marks} marks` : 'none found')
if (A) {
  ok('the map and the document agree on the selection', (await selId()) === A.id)
  const other = (await mapCells()).find((c) => c.id !== A.id)
  if (other) {
    await glideTo(other)
    const pinned = await docState()
    ok('OB-209: selecting pins the pane — a map hover changes nothing', pinned?.current === A.id && pinned?.banner === '', JSON.stringify({ c: pinned?.current, b: pinned?.banner }))
  }
  await park()

  // ── 4. OB-235 / OB-229: the figure over a READING, and no standing list ─────
  const s = await docState()
  ok('OB-229: the rail is open beside the prose, with the figure in it', s.railOpen && s.figure)
  ok('OB-235: the reading is under the figure', s.stats)
  ok('OB-235: the rail draws NO standing list of relationship cards', s.listHeaders === 0, `${s.listHeaders} list headers`)
  ok('OB-235: the chart\'s relationships total equals the marks the figure draws', s.statsRelationships === s.marks, `${s.statsRelationships} vs ${s.marks}`)
  ok('OB-229: the figure is centred on the document\'s node — none of its neighbours is the node itself', !s.neighbours.includes(A.id))

  const kindRow = page.locator(`${DOC} [data-stats-kind]`).first()
  if (await kindRow.count()) {
    const kb = await kindRow.boundingBox()
    await glideTo({ x: kb.x + 12, y: kb.y + kb.height / 2 })
    ok('OB-235: hovering a kind row washes that wedge in the figure', await has(`${DOC} [data-orbit-wedge]`))
    await park()
    ok('and leaving it takes the wash away', !(await has(`${DOC} [data-orbit-wedge]`)))
  }

  // ── 5. OB-229 / OB-242 / OB-230: a neighbour's card, and the map lighting with it ──
  let f = await figure()
  const N = f && f.dots.find((d) => d.id !== A.id)
  const title = s.title
  if (N) {
    await glideTo({ x: N.x, y: N.y })
    const c = await card()
    ok('OB-229: hovering a neighbour opens the relationship card for it', c?.kind === 'relation' && c.key === N.id, JSON.stringify(c && { k: c.kind, key: c.key }))
    ok('OB-242: the card\'s header is a sentence', !!c?.header && /^\d+ (direct relationships?|relationships? via children)$/.test(c.header), JSON.stringify(c?.header))
    ok('OB-242: and its plural agrees with its count', !!c?.header && (c.header.startsWith('1 ') ? !/relationships/.test(c.header) : /relationships/.test(c.header)), JSON.stringify(c?.header))
    ok('OB-229: the card\'s source is the document\'s node', !!title && !!c && (c.text.includes(title) || (c.source ?? '').includes(title)),
      `${title} · drawn "${c?.text.slice(0, 40)}" · tip "${c?.source}"`)
    const fb = f.box
    ok('OB-229: the card opens over the PROSE, never over the figure',
      !!c && (c.box.right <= fb.x + 0.5 || c.box.left >= fb.x + fb.w - 0.5), JSON.stringify({ card: c?.box, fig: fb }))
    const lit = await mapLit()
    ok('OB-230: the map lights THAT neighbour', lit.spot === N.id, JSON.stringify(lit))
    ok('OB-230: and the road to it, not every road', lit.roadsLit >= 1 && (lit.roads < 2 || lit.roadsLit < lit.roads), `${lit.roadsLit}/${lit.roads}`)
    ok('OB-230: the centre does NOT light on a neighbour\'s hover', lit.centre === null)

    // one relationship: the line's hit twin, three quarters of the way out from the hub
    f = await figure()
    const onLine = { x: f.hub.x + (N.x - f.hub.x) * 0.75, y: f.hub.y + (N.y - f.hub.y) * 0.75 }
    await glideTo(onLine)
    const one = await card()
    if (one?.key && one.key.includes('|')) {
      ok('OB-229: hovering a relationship opens the card for THAT relationship', one.key.startsWith(one.key.split('|')[0] + '|'), one.key)
      ok('OB-242: one relationship reads "1 direct relationship"', one.header === '1 direct relationship', JSON.stringify(one.header))
    } else {
      checks.push(`INFO  the line three-quarters out landed on ${JSON.stringify(one?.key)}, not a relationship's hit line — the per-relationship card is covered by the unit tests`)
    }

    // the hub: the node's own document card, and the centre's OWN channel on the map
    f = await figure()
    await glideTo(f.hub)
    const hubCard = await card()
    ok('OB-229: hovering the hub opens the node\'s document card, not a relationship card', hubCard?.kind === 'document', JSON.stringify(hubCard?.kind))
    const hubLit = await mapLit()
    ok('OB-230: the hub lights the map\'s selected cell on the centre channel', hubLit.centre === A.id, JSON.stringify(hubLit))
    ok('OB-230: and lights no road and no neighbour — the centre is not "something is hovered"', hubLit.roadsLit === 0 && hubLit.spot === null, JSON.stringify(hubLit))

    await park()
    const gone = await mapLit()
    ok('OB-230: leaving clears both channels — nothing outlives the hover', gone.centre === null && gone.spot === null && gone.roadsLit === 0, JSON.stringify(gone))
    ok('OB-230: and the card goes with it', (await card()) === null)

    // ── 6. OB-230 the other way: the map lights the figure ─────────────────────
    const nCell = (await mapCells()).find((c) => s.neighbours.includes(c.id))
    ok('a neighbour of the selection is a cell the map pointer can reach', !!nCell, nCell ? nCell.id : s.neighbours.join(','))
    if (nCell) {
      await glideTo(nCell)
      const litMarks = await count(`${DOC} [data-relations-rail] svg g[data-orbit="${nCell.id}"][data-orbit-lit="1"]`)
      const allMarks = await count(`${DOC} [data-relations-rail] svg g[data-orbit="${nCell.id}"]`)
      ok('OB-230: pointing at a neighbour on the map lights ITS marks in the figure', litMarks >= 1 && litMarks === allMarks, `${litMarks}/${allMarks}`)
      ok('OB-230: and it lights; it opens no card', (await card()) === null)
      await park()
      ok('and moving off the map clears it', (await count(`${DOC} [data-relations-rail] svg g[data-orbit-lit="1"]`)) === 0)
    }
  }

  // ── 7. OB-229 clause 4: the rail hides, and comes back from the pane's top-right ──
  const hideBtn = page.locator(`${DOC} [data-relations-rail]`).getByTitle('Hide Relations')
  ok('the rail carries its own close handle', (await hideBtn.count()) === 1)
  if (await hideBtn.count()) {
    await hideBtn.click()
    await page.waitForTimeout(350)
    const closed = await docState()
    const corner = page.locator(`${DOC} [data-relations-corner] button`)
    ok('OB-229: closed, the rail is gone and a labelled button sits in the pane\'s head row', !closed.railOpen && (await corner.count()) === 1)
    const docBox = await page.locator(DOC).boundingBox()
    const cb = (await corner.count()) ? await corner.boundingBox() : null
    ok('OB-229: at the TOP-RIGHT, mirroring the Explorer\'s top-left', !!cb && cb.x + cb.width > docBox.x + docBox.width * 0.6 && cb.y < docBox.y + 60, JSON.stringify({ cb, docBox }))
    if (cb) await corner.click()
    await page.waitForTimeout(350)
    ok('and the button brings the rail back', (await docState()).railOpen)
  }

  // ── 8. OB-253: the seam drags and the figure follows it live ─────────────────
  const sep = page.locator(`${DOC} [data-relations-rail] [role="separator"]`)
  ok('the rail\'s seam draws the divider', (await sep.count()) === 1)
  if (await sep.count()) {
    const w0 = (await figure()).box.w
    const sb = await sep.boundingBox()
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
    await page.mouse.down()
    await page.mouse.move(sb.x + sb.width / 2 + 24, sb.y + sb.height / 2, { steps: 8 })
    await page.waitForTimeout(150)
    const mid = (await figure()).box.w
    await page.mouse.up()
    await page.waitForTimeout(250)
    ok('dragging the seam narrows the figure WHILE the drag is in flight', mid < w0 - 10, `${w0} -> ${mid}`)
    await sep.dblclick()
    await page.waitForTimeout(250)
    ok('double-click fits the seam back', Math.abs((await figure()).box.w - w0) <= 1, `${(await figure()).box.w} vs ${w0}`)
  }

  // ── 9. OB-209: de-selecting is the SAME state as first load ──────────────────
  const a2 = (await mapCells()).find((c) => c.id === A.id) || A
  await page.mouse.click(a2.x, a2.y)
  await page.waitForTimeout(350)
  await park()
  const after = await docState()
  ok('OB-209: de-selecting draws the placeholder again — one state with first load',
    (await selId()) === null && after?.placeholder === rest?.placeholder && !after?.head && !after?.railOpen, JSON.stringify({ sel: await selId(), ph: after?.placeholder }))
}

await page.evaluate(() => localStorage.clear())
await page.context().close()
await stopVite(vite)

// ═══ THE COURSE CORPUS ═════════════════════════════════════════════════════════
vite = await startVite({ VITE_CORPUS: 'courses' })
page = await freshPage()
await openExplore()
await park()
/* FOUND THROUGH THE EXPLORER, NOT THE MAP. Three courses state no prerequisite and nothing
   depends on them (read off coursedata.ts 2026-09-26), and at the zoom where courses are cells
   all three sit OFF-SCREEN — a sweep of the visible map cannot reach them. The Explorer rail
   lists every node, so the sweep clicks through its rows (each click selects, and selecting a
   container opens it, revealing the next rows) and judges each node by what the RAIL draws —
   no course is named here.
   ONLY A COURSE COUNTS: a course's own sub-topics never carry a relationship in this corpus, so
   finding one with an empty rail proves nothing about "a course that states no prerequisite".
   The DocHeader's eyebrow says which it is ("topic" is this corpus's course level). */
await page.locator('[data-explorer-corner] button').click()
await page.waitForTimeout(450)
let unconnected = null
let oneKind = null
const visited = new Set()
for (let pass = 0; pass < 12 && !(unconnected && oneKind); pass++) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')].map((r) => r.getAttribute('data-node-id')))
  const fresh = ids.filter((id) => !visited.has(id))
  if (!fresh.length) break
  for (const id of fresh) {
    if (unconnected && oneKind) break
    visited.add(id)
    const row = page.locator(`[data-explorer-rail] [data-node-id="${id}"]`).first()
    if (!(await row.count())) continue
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await page.waitForTimeout(260)
    const s = await docState()
    if (s?.current !== id || !s.railOpen || s.kind !== 'topic') continue
    if (!unconnected && !s.figure && s.railPlaceholder) unconnected = { id, title: s.title, s }
    if (!oneKind && s.marks >= 2) {
      oneKind = { id, title: s.title, s }
      /* judged NOW, while it is the selection — the next click moves on */
      await park()
      const f = await figure()
      ok('OB-229 (6): one kind draws its marks in ONE half of the circle, not at every angle',
        !!f && f.dots.length >= 2 && f.dots.every((d) => d.x > f.cx), JSON.stringify(f && f.dots.map((d) => Math.round(d.x - f.cx))))
      const kindRow = page.locator(`${DOC} [data-stats-kind]`)
      ok('OB-235: the course corpus\'s chart has ONE kind row — every arrow is depends_on', (await kindRow.count()) === 1, `${await kindRow.count()} rows`)
      if (await kindRow.count()) {
        const rb = await kindRow.first().boundingBox()
        await glideTo({ x: rb.x + 12, y: rb.y + rb.height / 2 })
        const half = await page.evaluate(() => {
          const w = document.querySelector('[aria-label="document-panel"] [data-orbit-wedge]')
          if (!w) return null
          const n = w.getAttribute('d').match(/-?[\d.]+(?:e-?\d+)?/g).map(Number)
          return { cx: n[0], x0: n[2], x1: n[9] }
        })
        ok('OB-229 (6): and the kind wash covers that same half', !!half && Math.abs(half.x0 - half.cx) < 0.01 && Math.abs(half.x1 - half.cx) < 0.01, JSON.stringify(half))
        await park()
      }
    }
  }
}

ok('courses: a COURSE with no relationships at all was found', !!unconnected, unconnected ? `${unconnected.id} (${unconnected.title})` : `none among ${visited.size} rows`)
if (unconnected) {
  const s = unconnected.s
  ok('OB-235: it opens the rail on the reading\'s placeholder: "No relationships"', s.railPlaceholder.includes('No relationships'), JSON.stringify(s.railPlaceholder))
  ok('OB-235: the second line is the NOTE, "Nothing connects to this node"', s.railPlaceholder.includes('Nothing connects to this node'))
  ok('OB-229: no figure and no hairline under it', !s.figure && !s.hairline)
  ok('OB-235: and the host adds no second empty state of its own', s.placeholders === 1, `${s.placeholders} placeholders in the pane`)
}

ok('courses: a course with two or more relationships was found', !!oneKind, oneKind ? `${oneKind.id}: ${oneKind.s.marks} marks` : 'none')

await page.evaluate(() => localStorage.clear())
} catch (e) {
  errors.push('exception: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e)))
} finally {
  await browser.close()
  if (vite) await stopVite(vite)
}

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => ' - ' + e).join('\n'))
  process.exit(1)
}
console.log(`\n${checks.filter((c) => c.startsWith('PASS')).length} checks passed`)
