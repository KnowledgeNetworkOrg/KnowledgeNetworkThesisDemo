// browsertest-studiodesk.mjs — the Studio desk itself: the palette, the presets,
// and what a pane keeps when the composition changes (#294).
//
// A TEST. It opens the real app in a real browser and asserts what a person sees.
//
// WHY IT IS A TEST TODAY AND WAS NOT YESTERDAY. This was `shots.mjs`, and the
// browser-test runner skips `shot-*` on purpose — instruments, not guards. But
// the desk contracts it had accumulated are checked nowhere else, and one of them
// is load-bearing: BENCHING. Switching preset only changes which panes are ON;
// the others stay mounted at `display:none` and must keep their own state, so a
// round trip may not cost you the graph you grew or the route you walked. That is
// the same class of bug as #214 (leaving the deck resets the map camera), and it
// had no automated check at all.
//
// WHAT IT DRIVES INSTEAD OF THE TREE. Five of its scenarios were built on the
// standalone Tree panel, retired on 2026-09-07 (#265). Every one of them wanted
// the tree for the same reason — something that writes `bus.focus` — so they now
// pick their node off the MAP, which draws every topic at L2 and everything below
// a topic at L3+. Nothing about what they assert changed.
//
// WHAT WAS DROPPED, and why it is not a loss:
//   - the ⤳ typed-link badge at the topic level and not below. Its renderer
//     (`TreeRow`) has had no screen since #265, and the MODEL half is guarded far
//     harder than a screenshot could: `corpus/graph.ts`'s `addEdge` throws at
//     module load on any edge endpoint that is not a topic, so a violation fails
//     every test in the repo, not this one.
//   - two sidebar CAPTIONS ("accumulating, authored order", "custom composition").
//     Both strings were deleted from StudioView; the palette says the same thing
//     with a per-family count of how many members are on screen. The "a manual
//     toggle de-highlights the active preset" rule survives in the app but has no
//     test hook — `PresetButton` expresses `active` only in styling.
//
// The map's level is chosen from a floating DS LevelPicker (`goLevel`), and
// applying a preset CLOSES the palette pane, so reaching an instrument toggle
// afterwards means re-opening it (`withPalette`). Both are helpers below.
//
// Verification for the Studio (src/studio/StudioView.tsx, instruments.tsx): every
// view is a pickable INSTRUMENT sharing one sync bus (focus / route / visited),
// and a PRESET is a curated instrument list + layout.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-studiodesk.mjs
// Frames land in tools/studio-spike/out/ (gitignored).
// Exits nonzero on any failed assertion or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5198
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

// Spawns vite ITSELF, same as browsertest-mapconnections.mjs beside this file: backgrounded
// dev servers die on this machine, so the script owns the server lifecycle
// (spawn, wait for readiness, drive, kill) instead of assuming one is up.
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

const LENS_TYPES = ['depends_on', 'see_also', 'uses']
// The Studio header's focus readout. Scoped to the header because the
// Connections pane now publishes data-focus too, which made a bare
// [data-focus] locator a strict-mode violation.
const focusReadout = page.locator('[aria-label="studio-header"] [data-focus]')

/** Step the map to a containment level. The old `nested-level-N` button row went
 *  with the map's bottom info bar (`1e530af`, OB-094/096); the level is chosen
 *  from a floating DS `LevelPicker` now. */
const goLevel = async (n) => {
  await page.locator('[aria-label="levels"]').click()
  await page.locator('[aria-label="levels"] ~ div button', { hasText: new RegExp(`^L${n}$`) }).click()
  await page.waitForTimeout(900)
}

/** Run `fn` with the palette pane open, and leave it as it was found. Applying a
 *  preset CLOSES the palette on purpose (OB-106: "you picked a composition; the
 *  chooser gets out of the way"), so anything reaching for a toggle after a preset
 *  click has to bring it back. The toolbar's handle is stable across the flip. */
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

/** Select a node by clicking its territory on the map. The synthetic click
 *  bypasses pointerEvents gating and the dragDist>4 guard, since there is no
 *  preceding pointerdown. Returns false when the map is not drawing that id at
 *  the current level. */
const clickCell = async (id) =>
  await page.evaluate((wanted) => {
    const cell = document.querySelector(`path[data-terr="${wanted}"]`)
    if (!cell) return false
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, id)

/** The corpus's richest builds-on cone — deep enough that the depth toggle in
 *  scenario 4 renders differently at 1 and 2. Scenarios 2, 3, 4 and 11 all stand
 *  here, as they did when a tree row was how you got here. */
const TLS = 'cry-tls-certificates'

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(600)

// ── 1. sidebar palette, default Present composition ────────────────────────
// No entry click any more: the app IS the Studio (App.tsx), so the sidebar is
// always mounted. This used to click a tab button in the old shell.
const sidebar = page.locator('[aria-label="studio-sidebar"]')
if (!(await sidebar.isVisible())) fail('sidebar not visible')

// 15 views + one generated lens per relation type (4) = 19 rows. A DELIBERATE
// tripwire, not a fact about the registry: registering or retiring an instrument
// is supposed to fail here once, so the change is acknowledged rather than
// absorbed. It last moved on 2026-09-07 when the Tree panel was retired (#265).
const instCount = await page.locator('[aria-label^="studio-inst-"]').count()
console.log('sidebar instruments =', instCount, '(expect 19)')
if (instCount !== 19) fail(`expected 19 instrument entries, got ${instCount}`)

const presetCount = await page.locator('[aria-label^="studio-preset-"]').count()
console.log('sidebar presets =', presetCount, '(expect 3 — teaching, cockpit, authoring)')
if (presetCount !== 3) fail(`expected 3 preset buttons, got ${presetCount}`)

let onPanes = await page.locator('[data-slot="on"]').count()
console.log('teaching preset default: panes on =', onPanes, '(expect 4 — map + unfold-graph + doc + walkviewer)')
if (onPanes !== 4) fail(`expected 4 panes on by default, got ${onPanes}`)

// The sidebar used to caption the load state "accumulating, authored order".
// That string is gone from StudioView; what it stands for — which preset the desk
// opened on — is asserted directly below by the pane list itself.
const defaultCaption = await sidebar.innerText()
if (!defaultCaption.includes('Present')) {
  fail(`sidebar does not list the presets on load: "${defaultCaption.replace(/\s+/g, ' ')}"`)
}

// A STRIP instrument renders along the bottom, not as a column. Walk·Viewer is
// the only one in the opening composition, and the opening composition is the
// only place to check it: this assertion used to live in scenario 6, under the
// Present preset, and PICKING Present stopped meaning "lay out these four panes"
// when #267 turned that button into the presenter preview.
const stripVisible = await page.locator('[aria-label="studio-pane-walkviewer"]').isVisible()
console.log('walkviewer strip visible at launch =', stripVisible)
if (!stripVisible) fail('the walk·viewer strip is not visible in the opening composition')

await page.screenshot({ path: `${OUT}/01-teaching-default.png` })
console.log('01-teaching-default.png taken')

// The lens workspace used to be a preset of its own (Coding), removed when the
// repo narrowed to the teaching domain. Its panes all still exist, so compose
// it by hand — which doubles as the proof that manual toggling de-highlights
// the active preset and drops the sidebar to "custom composition".
// The MAP stays on and is what the lenses are aimed with — it used to be the
// tree, which is gone (#265). Everything else in the opening composition comes
// off, so the desk is map + three lenses either way.
for (const off of ['unfoldgraph', 'document', 'walkviewer']) {
  await page.locator(`[aria-label="studio-inst-${off}"]`).click()
}
for (const on of ['lens-depends_on', 'lens-see_also', 'lens-uses']) {
  await page.locator(`[aria-label="studio-inst-${on}"]`).click()
}
await page.waitForTimeout(400)

onPanes = await page.locator('[data-slot="on"]').count()
console.log('hand-composed lens workspace: panes on =', onPanes, '(expect 4 — map + 3 lenses)')
if (onPanes !== 4) fail(`expected 4 panes on after hand-composing, got ${onPanes}`)

await page.screenshot({ path: `${OUT}/01b-lens-workspace-empty.png` })
console.log('01b-lens-workspace-empty.png taken')

// ── 2. pick TLS & Certificates off the map — the lenses must recenter on it ──
// This used to expand Cryptography in the Tree panel and click the leaf. The
// panel is gone (#265); the map draws every topic at L2, so the same node is one
// click away there and the contract under test — picking a node writes focus, and
// every lens reads it — is untouched.
await goLevel(2)
if (!(await clickCell(TLS))) fail(`the map is not drawing ${TLS} at L2`)
await page.waitForTimeout(600)

const focusVal = await focusReadout.getAttribute('data-focus')
console.log('focus after leaf click =', focusVal, '(expect cry-tls-certificates)')
if (focusVal !== 'cry-tls-certificates') fail(`expected focus cry-tls-certificates, got ${focusVal}`)

for (const t of LENS_TYPES) {
  const header = page.locator(`[data-lens="${t}"] header`)
  const text = await header.innerText()
  if (!text.includes('TLS & Certificates')) fail(`lens ${t} header does not show focus title: "${text.replace(/\s+/g, ' ')}"`)
  const nodeCount = await page.locator(`[data-lens="${t}"] [data-lens-node]`).count()
  console.log(`lens ${t}: header ok, data-lens-node count = ${nodeCount}`)
  if (t === 'depends_on' && nodeCount === 0) fail(`deps pane has zero data-lens-node chips`)
}

// ── 2b. the frontier label's INK RESOLVED (DS OB-154) ────────────────────────
// "⤳ 2" on a chip means two more of this relation that the cone does not show.
// It used to be drawn in Tailwind slate-400 — 2.45:1 on the surface behind it,
// well under the 4.5:1 body text needs — and now takes `--text-2`.
//
// THIS ASSERTION EXISTS BECAUSE THE FIX HAS A SILENT FAILURE MODE. A token in an
// SVG `fill=` PRESENTATION ATTRIBUTE computes to `none` and the glyph renders
// BLACK, with no error anywhere — measured in a real browser for the edge palette
// and the reason EDGE_COLOR holds copies rather than var() references. So the
// colour is set as a CSS property instead, and the only way to know that held is
// to read it back off a live page. Reading the literal out of the source would
// pass just as happily with the glyph rendering black.
const frontier = await page.evaluate(() =>
  [...document.querySelectorAll('[data-frontier]')].map((el) => getComputedStyle(el).fill),
)
console.log('frontier labels =', frontier.length, '· fills =', [...new Set(frontier)].join(', '))
if (frontier.length === 0) {
  // Not a skip. If the corpus ever stops producing a cone with onward links at
  // TLS, this check silently stops checking, which is the #294 failure exactly.
  fail('no [data-frontier] label rendered on the lens workspace — the OB-154 ink check asserted nothing')
}
const TEXT_2 = 'rgb(78, 72, 62)' // --text-2 -> --bark-700 -> #4e483e
for (const f of new Set(frontier)) {
  if (f === 'rgb(0, 0, 0)') fail(`frontier label is BLACK — a var() in a presentation attribute failed silently`)
  else if (f !== TEXT_2) fail(`frontier label ink is ${f}, expected --text-2 ${TEXT_2}`)
}

await page.screenshot({ path: `${OUT}/02-coding-focused.png` })
console.log('02-coding-focused.png taken')

// ── 3. click a chip in the depends_on lens → all three recenter ───────────
const depsChip = page.locator('[data-lens="depends_on"] [data-lens-node]').first()
const clickedId = await depsChip.getAttribute('data-lens-node')
await depsChip.click()
await page.waitForTimeout(300)

const focusVal2 = await focusReadout.getAttribute('data-focus')
console.log('clicked chip id =', clickedId, '· new focus =', focusVal2)
if (focusVal2 !== clickedId) fail(`expected focus to become clicked chip id ${clickedId}, got ${focusVal2}`)

const newTitle = (await focusReadout.innerText()).trim()
console.log('new focus title =', JSON.stringify(newTitle))
for (const t of LENS_TYPES) {
  const header = page.locator(`[data-lens="${t}"] header`)
  const text = await header.innerText()
  if (!text.includes(newTitle)) fail(`lens ${t} header does not show new focus title "${newTitle}": "${text.replace(/\s+/g, ' ')}"`)
}
const visitedAfterRecenter = parseInt(await page.locator('[aria-label="studio-visited"]').innerText(), 10)
console.log('studio-visited after recenter =', visitedAfterRecenter, '(expect >= 2)')
if (!(visitedAfterRecenter >= 2)) fail(`expected studio-visited >= 2, got ${visitedAfterRecenter}`)
await page.screenshot({ path: `${OUT}/03-coding-recentered.png` })
console.log('03-coding-recentered.png taken')

// ── 4. depth toggle in the deps pane: 1 then 2 → chip count changes ───────
// Re-focus TLS first: scenario 3 left focus on Cryptographic Hashing, whose
// builds-on cone is only ONE level deep (foundations are nearby in the
// authored corpus), so depth 1 and 2 would render identically there. Depth
// semantics need a deep cone — TLS's reaches 3 levels.
if (!(await clickCell(TLS))) fail(`the map is not drawing ${TLS} at L2`)
await page.waitForTimeout(600)
const depsPane = page.locator('[data-lens="depends_on"]')
const depthCountBefore = await depsPane.locator('[data-lens-node]').count()
await depsPane.getByRole('button', { name: '1', exact: true }).click()
await page.waitForTimeout(200)
const depthCount1 = await depsPane.locator('[data-lens-node]').count()
console.log('deps chip count: depth 2 (default) =', depthCountBefore, '· depth 1 =', depthCount1, '(expect different)')
if (depthCount1 === depthCountBefore) fail(`expected chip count to change between depth 2 and depth 1, both ${depthCount1}`)

await depsPane.getByRole('button', { name: '2', exact: true }).click()
await page.waitForTimeout(200)
const depthCount2 = await depsPane.locator('[data-lens-node]').count()
const frontierBadges = await depsPane.locator('text=/⤳ \\d+/').count()
console.log('deps chip count back at depth 2 =', depthCount2, '· frontier badges (⤳ n) =', frontierBadges, '(expect >= 1)')
if (frontierBadges === 0) fail('expected at least one frontier badge (⤳ n) at depth 2, found none')

// ── 5. side by side: adding an instrument grows the composition ────────────
// Was "toggle Map on, then Contours on". The map is now on from the start (it is
// what scenario 2 picks with), so the two additions are Contours and Clusters —
// the same contract, different panes.
await page.locator('[aria-label="studio-inst-contours"]').click()
await page.waitForTimeout(300)
onPanes = await page.locator('[data-slot="on"]').count()
console.log('after enabling contours: panes on =', onPanes, '(expect 5)')
if (onPanes !== 5) fail(`expected 5 panes on after enabling contours, got ${onPanes}`)

await page.locator('[aria-label="studio-inst-clusters"]').click()
await page.waitForTimeout(300)
onPanes = await page.locator('[data-slot="on"]').count()
console.log('after enabling clusters: panes on =', onPanes, '(expect 6)')
if (onPanes !== 6) fail(`expected 6 panes on after enabling clusters, got ${onPanes}`)
await page.screenshot({ path: `${OUT}/05-custom-compare.png` })
console.log('05-custom-compare.png taken')

// ── 6. apply a preset: it turns the named panes on and BENCHES the rest ────
// This used to apply Present. Present is no longer a desk composition you can
// switch to — #267 made it the presenter's PREVIEW, so picking it lays out the
// presenter screen and the desk's `studio-pane-*` panes all unmount. (The four
// instruments Present names are still what the desk OPENS on, which is what
// scenario 1 checks.) Explore is the plain desk preset, so the "a preset is a
// curated instrument list" contract is asserted there instead.
await page.locator('[aria-label="studio-preset-explore"]').click()
await page.waitForTimeout(600)

// Read every pane's slot in ONE pass. Asking for one pane by locator makes a
// missing pane a 30-second hang and then a timeout that names the selector but
// not the composition, which is the least useful way to learn that a preset did
// not apply. This way an unexpected composition prints itself.
const slots = async () =>
  await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[aria-label^="studio-pane-"]')].map((p) => [
        p.getAttribute('aria-label').replace('studio-pane-', ''),
        p.getAttribute('data-slot'),
      ]),
    ),
  )
const paneSlots = await slots()
const slotOf = (inst) => paneSlots[inst] === 'on'
const mapOn = slotOf('map')
const connOn = slotOf('connections')
const docOn = slotOf('document')
const contoursOn = slotOf('contours')
const depsOn = slotOf('lens-depends_on')
const refsOn = slotOf('lens-see_also')
const dataflowOn = slotOf('lens-uses')
console.log(
  'explore preset: map=', mapOn, 'connections=', connOn, 'doc=', docOn,
  '(all expect true) · off and benched: contours=', contoursOn, '· lenses=', depsOn, refsOn, dataflowOn,
)
if (!(mapOn && connOn && docOn)) fail('the explore preset did not activate map/connections/document')
if (depsOn || refsOn || dataflowOn || contoursOn) fail('the explore preset left a hand-added pane active (all should be benched)')
if (!(mapOn && connOn && docOn)) console.log('  panes seen:', JSON.stringify(paneSlots))

// BENCHED, NOT UNMOUNTED — the distinction scenario 9 depends on. A pane the
// preset does not name keeps its DOM (and so its state); it is only switched off.
if (paneSlots['lens-depends_on'] === undefined) fail('a benched pane was unmounted rather than switched off')

await page.screenshot({ path: `${OUT}/06-explore-empty.png` })
console.log('06-explore-empty.png taken')

// ── 7. unfold from the hub picker, grow 2 NAMED fresh nodes ────────────────
// Growth is deterministic on purpose: HTTP & REST → TCP & UDP → IP & Routing.
// Blind fresh.first() could land focus on a foundation topic whose builds-on
// cone is EMPTY (the corpus has roots now) — a named path avoids it
// regardless of what reads the result. (Originally this also fed scenario
// 8's curriculum; that scenario is gone, OB-065 — kept deterministic anyway,
// it costs nothing and the doc-pane check below still wants a real title.)
// Explore does not name the unfold graph, so bring it up by hand — which is also
// the gesture scenario 9's round trip undoes and redoes.
await withPalette(async () => {
  await page.locator('[aria-label="studio-inst-unfoldgraph"]').click()
})
await page.waitForTimeout(500)

const unfoldPane = page.locator('[aria-label="studio-pane-unfoldgraph"]')
const mapPane = page.locator('[aria-label="studio-pane-map"]')
const docPane = page.locator('[aria-label="studio-pane-document"]')

await unfoldPane.getByRole('button', { name: /HTTP & REST/ }).first().click()
await page.waitForTimeout(400)

for (const title of ['TCP & UDP', 'IP & Routing']) {
  const fresh = unfoldPane.locator('button[data-onmap="false"]', { hasText: title })
  if ((await fresh.count()) === 0) {
    fail(`unfold: fresh candidate "${title}" not offered — corpus assumption broke`)
    break
  }
  await fresh.first().click()
  await page.waitForTimeout(500)
}

// Three map assertions were dropped here, all testing behaviour the nested-
// atlas rewrite removed rather than renamed: the unfold open FLYING the map
// camera, a "start walk here" PIN button on the flown-to node, and flyHold
// keeping graph neighbours visible. None of those strings appear anywhere in
// src/ any more, and the bus now grants camera movement to the LOOK channel
// alone (see the note where scenario 10 used to be). What survives here — the
// unfold open driving FOCUS, the doc pane, and the visited count — is the part
// of the sync that is still real.
await page.waitForTimeout(700)

const lastOpenedTitle = (await focusReadout.innerText()).trim()
console.log('after growing 2 nodes: focus title =', JSON.stringify(lastOpenedTitle))

// Read the pane's TEXT, not a styled node. This used to select
// `.text-[15px].font-bold`, two Tailwind utilities that stopped being how the
// title is drawn when the header became the DS `DocHeader` — whose title div
// carries no hook of its own. What is actually under test is that the document
// pane follows the focus, and its text answers that without naming a class.
const docText = await docPane.innerText().catch(() => '')
console.log('doc pane names the focus =', docText.includes(lastOpenedTitle))
if (!docText.includes(lastOpenedTitle)) fail(`the document pane does not name the last-opened focus "${lastOpenedTitle}"`)

const visitedAfterGrow = parseInt(await page.locator('[aria-label="studio-visited"]').innerText(), 10)
console.log('studio-visited =', visitedAfterGrow, '(expect >= 3)')
if (!(visitedAfterGrow >= 3)) fail(`expected studio-visited >= 3, got ${visitedAfterGrow}`)

// (The map used to paint circle[data-visited] rings for every visited node.
// MapView no longer mentions `visited` at all — the bus still tracks
// it, but TrailStrip and the header counter above are its only consumers now,
// so the ring assertion that stood here tested a removed representation.)

const unfoldNodeCountAtScenario7 = await unfoldPane.locator('circle[data-node]').count()
console.log('unfold pane circle[data-node] count =', unfoldNodeCountAtScenario7, '(captured for roundtrip check in 9)')

await page.screenshot({ path: `${OUT}/07-teaching-unfold.png` })
console.log('07-teaching-unfold.png taken')

// ── 8. REMOVED — the button it drove no longer exists ──────────────────────
// This scenario clicked the header's "teach me this" PillButton, which
// OB-065 removed outright (not relocated — bus.teach() itself is untouched,
// there is simply no UI path to it any more). What it drove — lens.ts's
// curriculum(), a topological order over a depends_on prerequisite cone — is
// covered independently in src/model/lens.test.ts (order, cycles,
// determinism), so nothing here loses coverage; the click/route/walk-strip
// wiring this scenario exercised has no surviving surface to click.

const routeBadgeBeforeRoundtrip = await page.locator('[aria-label="studio-route"]').innerText()

// ── 9. roundtrip: BENCHED PANES KEEP THEIR STATE, and re-read current focus ─
// The load-bearing one. Was Teaching -> Coding -> Teaching; Coding is gone and
// Present is the presenter preview now (#267), so the round trip runs
// Explore -> Plan -> Explore. The point is unchanged and arguably sharper: these
// lens panes have been BENCHED (mounted, display:none)
// since scenario 6, so re-showing them proves a benched instrument re-reads
// current bus focus rather than replaying the focus it was benched with.
await withPalette(async () => {
  await page.locator('[aria-label="studio-preset-plan"]').click()
  await page.waitForTimeout(500)
})
await withPalette(async () => {
  await page.locator('[aria-label="studio-preset-explore"]').click()
  await page.waitForTimeout(500)
})
await withPalette(async () => {
  for (const t of LENS_TYPES) {
    await page.locator(`[aria-label="studio-inst-lens-${t}"]`).click()
  }
  await page.waitForTimeout(400)
})

const focusTitleRoundtrip = (await focusReadout.innerText()).trim()
console.log('roundtrip: focus =', JSON.stringify(focusTitleRoundtrip))
for (const t of LENS_TYPES) {
  const header = page.locator(`[data-lens="${t}"] header`)
  const text = await header.innerText()
  if (!text.includes(focusTitleRoundtrip)) fail(`lens ${t} header does not show current bus focus "${focusTitleRoundtrip}": "${text.replace(/\s+/g, ' ')}"`)
}

// and the unfold graph, benched for the whole round trip, comes back GROWN
await withPalette(async () => {
  await page.locator('[aria-label="studio-inst-unfoldgraph"]').click()
})
await page.waitForTimeout(500)

// THE LOAD-BEARING ONE. `StudioView` promises a benched pane "stays mounted at
// display:none so its internal state (an unfold canvas, a zoom level) survives
// being toggled off and back on". It did not, until #296: an on pane and a
// benched pane were rendered from two SEPARATE child lists, and React matches
// keys only within one list, so switching moved the component to the other list
// and remounted it from scratch. Both lists are now spread into one array. This
// check is what caught it and what keeps it caught.
const unfoldNodeCountAfterRoundtrip = await unfoldPane.locator('circle[data-node]').count()
console.log('unfold pane circle[data-node] after roundtrip =', unfoldNodeCountAfterRoundtrip, '(expect', unfoldNodeCountAtScenario7, '— unchanged)')
if (unfoldNodeCountAfterRoundtrip !== unfoldNodeCountAtScenario7)
  fail(`a benched pane lost its state across a preset round trip — grew ${unfoldNodeCountAtScenario7} nodes, came back with ${unfoldNodeCountAfterRoundtrip}`)

const routeBadgeAfterRoundtrip = await page.locator('[aria-label="studio-route"]').innerText()
console.log('route badge after roundtrip =', routeBadgeAfterRoundtrip, '(expect', routeBadgeBeforeRoundtrip, '— unchanged)')
if (routeBadgeAfterRoundtrip !== routeBadgeBeforeRoundtrip) fail(`expected route badge unchanged at "${routeBadgeBeforeRoundtrip}", got "${routeBadgeAfterRoundtrip}"`)

await page.screenshot({ path: `${OUT}/09-roundtrip.png` })
console.log('09-roundtrip.png taken')

// ── 10. REMOVED — the camera contract it tested no longer exists ───────────
// This scenario drove the map camera from the walk strip: a ⤢ "path on map"
// button in the walk header, and a step-card click panning at constant zoom.
// The bus has since narrowed which events may move a camera to exactly one
// (bus.ts: "A LOOK — the one channel that MAY move a camera", published by
// clicks in the Connections pane, explicitly never by hover). The ⤢ button
// no longer exists anywhere in src/, and neither an unfold open nor "teach me
// this" nor a walk step moves the camera any more — which is why the camera
// assertions in scenarios 7 and 8 came out with this one.
//
// The surviving camera contract IS covered: browsertest-mapconnections.mjs drives the
// Connections pane and asserts the look-flight and its hover non-interference.

// ── 11. below the topic grain: the lenses say so, and say it honestly ──────
// This used to expand the cs flagship spine in the Tree panel row by row to reach
// the level-8 node, then read two things off those rows: that a topic row carries
// a ⤳ typed-link count and a deep row does not, and that focusing the deep node
// left the lenses in their topic-only empty state.
//
// The panel is gone (#265) and so is the ⤳ half — `TreeRow` draws that badge and
// has had no screen since. Nothing is lost by dropping it: the rule it checked is
// a corpus invariant, and `corpus/graph.ts`'s `addEdge` throws AT MODULE LOAD on
// an edge endpoint that is not a topic, so breaking it fails every test in the
// repo rather than this one screenshot.
//
// What remains is the part with no other home: below the topic grain the lenses
// must show their empty state rather than borrowing the owning topic's links, and
// coming back up to a topic must restore the full picture. The map draws
// below-topic nodes at L3, so that is where the deep node is picked now.
await withPalette(async () => {
  for (const on of LENS_TYPES) {
    const pane = page.locator(`[aria-label="studio-pane-lens-${on}"]`)
    if ((await pane.getAttribute('data-slot')) !== 'on') await page.locator(`[aria-label="studio-inst-lens-${on}"]`).click()
  }
})
await page.waitForTimeout(400)

await goLevel(3)
const deepId = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('path[data-terr][data-tier="3"]')]
  let best = null
  for (const c of cells) {
    const b = c.getBBox()
    const area = b.width * b.height
    if (!best || area > best.area) best = { area, id: c.getAttribute('data-terr'), el: c }
  }
  if (!best) return null
  best.el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return best.id
})
if (!deepId) fail('the map drew no below-topic cells at L3')
await page.waitForTimeout(600)

const deepFocus = await focusReadout.getAttribute('data-focus')
console.log('focus after below-topic click =', deepFocus, '(expect', deepId, ')')
if (deepFocus !== deepId) fail(`expected focus ${deepId}, got ${deepFocus}`)

const lensEmptyState = await page
  .locator('[data-lens="depends_on"]')
  .getByText('lenses read topics — typed links live at the topic level')
  .isVisible()
console.log('deep focus: lens topic-only empty state =', lensEmptyState, '(expect true)')
if (!lensEmptyState) fail('deps lens did not show the topic-only empty state for a deep focus')

// back up to a topic and the full picture returns
await goLevel(2)
if (!(await clickCell(TLS))) fail(`the map is not drawing ${TLS} at L2`)
await page.waitForTimeout(600)
const lensHeaderBack = await page.locator('[data-lens="depends_on"] header').innerText()
if (!lensHeaderBack.includes('TLS & Certificates')) fail(`deps lens did not recenter on the topic: "${lensHeaderBack.replace(/\s+/g, ' ')}"`)
await page.screenshot({ path: `${OUT}/11-below-topic.png` })
console.log('11-below-topic.png taken')

// ── 12. leaving the presenter puts the map back where the session stands ───
// #214. The desk's panes are not mounted while the presenter is up — one instance
// of everything, the rule #195 set and #267 kept — so every pane is rebuilt on the
// way back. Before the fix the map came back at its default whole-world framing,
// pointing at nothing, after however long you had been presenting.
//
// The check is deliberately NOT "the camera has the same transform it had". The
// rule the app chose is THE SAME PLACE, NOT THE SAME PIXELS: on the way out it
// re-publishes a look at the current focus, exactly as entering does. So what must
// be true is that the map declares it is looking at where the session stands, and
// that it is not sitting at the whole-world default.
const camDefault = 'translate(0 0) scale(0.8)'
await withPalette(async () => {
  await page.getByLabel('studio-preset-present').click()
})
// long enough for the palette's own FLIGHT to land. Picking a preset closes the
// palette through an animated transition, and while that is in the air its
// absolutely-positioned wrapper sits over the presenter's chrome.
await page.waitForTimeout(1600)
const panesWhilePresenting = await page.locator('[aria-label^="studio-pane-"]').count()
console.log('desk panes while the presenter is up =', panesWhilePresenting, '(expect 0 — one instance of everything)')
if (panesWhilePresenting !== 0) fail(`the desk stayed mounted behind the presenter (${panesWhilePresenting} panes)`)

// LEAVE BY PICKING A COMPOSITION, which is how a person actually gets back to the
// desk, and which runs the same `setPresenter(null)` the presenter's own ✕ does —
// the effect that re-aims the map watches the presenter going away, not which
// gesture sent it away. (The ✕ is not used here because in this composition it
// ends up underneath the presenter's own body: a real thing to look at one day,
// and not what this scenario is about.)
await withPalette(async () => {
  await page.getByLabel('studio-preset-explore').click()
})
await page.waitForTimeout(1600) // the look flight is 750ms

const focusOnReturn = await focusReadout.getAttribute('data-focus')
const peekOnReturn = await page.locator('[data-nested]').getAttribute('data-peek')
const camOnReturn = await page.$eval('[data-nested] > g', (g) => g.getAttribute('transform'))
console.log('on return: focus =', JSON.stringify(focusOnReturn), '· map declares peek =', JSON.stringify(peekOnReturn))
console.log('on return: camera =', camOnReturn, `(must not be the default ${camDefault})`)
if (!focusOnReturn) fail('the session lost its focus across the presenter — that lives on the bus and must survive')
if (peekOnReturn !== focusOnReturn) fail(`leaving the presenter did not aim the map at the focus: map says ${peekOnReturn}, focus is ${focusOnReturn}`)
if (camOnReturn === camDefault) fail('the map came back at its whole-world default — the camera was thrown away')
await page.screenshot({ path: `${OUT}/12-return-from-presenter.png` })
console.log('12-return-from-presenter.png taken')

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE — all assertions passed')
