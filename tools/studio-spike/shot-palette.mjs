// One-shot visual + behavioural check for the reshaped supply pane (#28): the
// palette is a ranked SEARCH over all 753 nodes whose empty state is recent
// searches, and putting a stop on the road is always an EXPLICIT gesture — a
// plain click never inserts; the row's + appends and clears; recents record the
// clean resolved TITLE, not the typed keystrokes. Same server-owns-its-lifecycle
// pattern as browsertest-mapconnections.mjs beside it (backgrounded dev servers die here).
//
// Also covers the map↔road sync it feeds (#23): typing lights the hit set on the
// territory, deep hits rolling up to a visible ancestor with a count (#25); and
// once a hit is selected on the map, that cell — and only it — becomes the road's
// drag handle without breaking the map's own pan/zoom gestures (#24).
//
//   node tools/studio-spike/shot-palette.mjs
// Frames land in tools/studio-spike/shots/ (gitignored). Nonzero on any failure.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5198
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
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto(`http://localhost:${PORT}/`)
await page.getByLabel('studio-preset-plan').click()
await page.waitForTimeout(500)

const search = page.locator('[data-pal-search]')
const road = page.locator('[data-walk-editor]')
if ((await search.count()) !== 1) errors.push('palette: the search input did not mount in the Plan preset')

// 0 — EMPTY STATE: nothing typed, no history yet → the cold prompt, zero result
// rows. The pane should also be SHORT now (it sizes to its content, handing the
// slack to the document below) — eyeball p0 against the old half-column void.
await page.screenshot({ path: OUT + '/p0-empty-cold.png' })
if ((await page.locator('[data-pal]').count()) !== 0) errors.push('empty state: result rows showing with an empty query')

// 1 — WIDENED REACH: a CONTAINER title ("Operating Systems", a module) was
// unreachable in the old topic-only chip cloud. It must now be a search hit —
// the 7% → 100% claim, asserted.
await search.fill('operating')
await page.waitForTimeout(200)
if ((await page.locator('[data-pal="os"]').count()) !== 1) errors.push('widened reach: the "Operating Systems" container is not a search hit')
if ((await page.locator('[data-pal]').count()) === 0) errors.push('search: "operating" matched nothing')
await page.screenshot({ path: OUT + '/p1-hits-operating.png' })

// 1b — MATCHES ON THE MAP (#25): the live hit set lights the territory. At the
// default level (domains) every deep hit under "Operating Systems" rolls up to
// its visible ancestor, so one domain pin carries a COUNT of the matches beneath
// it — the "deep matches surface on their visible ancestor" claim, asserted. The
// map subscribes to a set of ids, not the query, so this is pane-agnostic.
const matchCells = page.locator('[data-nested] [data-match]')
if ((await matchCells.count()) === 0) errors.push('matches-on-map: typing lit no cells on the territory')
const maxMn = Math.max(0, ...(await matchCells.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-mn')) || 0))))
if (maxMn < 2) errors.push('matches roll-up: no ancestor pin aggregated multiple deep hits (expected a count ≥ 2)')
await page.screenshot({ path: OUT + '/p1m-matches-on-map.png' })

// 2 — CLICK SELECTS ON THE MAP (and closes): a plain row click is no longer a
// no-op. It flies the map to the node's territory and lights it as the
// selection (bus focus + look), then collapses the list (box clears). It still
// must NOT drop a stop on the road — an inspect is never an insert.
const map = page.locator('[data-nested]')
if ((await road.getByText('Operating Systems').count()) !== 0) errors.push('precondition: "Operating Systems" already on the road before any insert')
await page.locator('[data-pal="os"]').click()
await page.waitForTimeout(400)
if ((await road.getByText('Operating Systems').count()) !== 0) errors.push('click-inserts: a plain row click added a stop (it must not)')
if ((await search.inputValue()) !== '') errors.push('click-select: a row click did not close the search (the box should clear)')
if ((await map.getAttribute('data-sel')) !== 'os') errors.push('click-select: the map did not select the clicked hit')
if ((await map.getAttribute('data-peek')) !== 'os') errors.push('click-select: the map did not fly (look) to the clicked hit')
await page.screenshot({ path: OUT + '/p1b-click-selects-map.png' })

// 2d — MATCHES CLEAR ON RESOLVE (#25) + DRAG THE SELECTED CELL ONTO THE ROAD (#24).
// The click resolved the search (box cleared), so the pins are gone. The look
// settled the map on the module's tier (L1) and CENTERED os in the pane — so the
// pane centre is over the os cell, which (being the selection) is the road's drag
// handle. Unlike native HTML5 DnD, this custom pointer drag IS drivable: press,
// move past the threshold (a ghost appears), drag onto the road, release — and a
// synthetic drop lands a real stop. os is a module, so it drops as a plain visit.
if ((await page.locator('[data-nested] [data-match]').count()) !== 0) errors.push('matches clear: resolving the search left pins on the map')
if ((await map.getAttribute('data-level')) !== '1') errors.push('map-drag: the look did not settle the map on the module tier (L1)')
await page.waitForTimeout(600) // let the look flight finish centering os
const mbox = await map.boundingBox()
// aim the drop at a specific road NODE (its onDragOver gives a before/after
// caret), not the road centre — that lands on empty board where no caret shows.
const target = await page.locator('[data-walk-editor] [data-rnode]').first().boundingBox()
const beforeStops = await page.locator('[data-walk-editor] [data-rnode]').count()
const cx = mbox.x + mbox.width / 2
const cy = mbox.y + mbox.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx + 12, cy + 12) // cross the 5px drag threshold
await page.waitForTimeout(80)
if ((await page.locator('[data-dragghost="os"]').count()) === 0) errors.push('map-drag: no ghost appeared when dragging the selected cell')
await page.screenshot({ path: OUT + '/p1c-drag-ghost-shape.png' }) // still over the map: the cell-SHAPE form
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
await page.waitForTimeout(60)
// the road shows a live PREVIEW CARET under the ghost — driven by the road's own
// onDragOver via synthetic events, no editor refactor. data-rmark is the caret
// (a node's before/after band or a between-node gap slot).
if ((await page.locator('[data-walk-editor] [data-rmark]').count()) === 0)
  errors.push('map-drag: no preview caret on the road while the ghost hovers it')
await page.screenshot({ path: OUT + '/p1d-drag-ghost.png' })
await page.mouse.up()
await page.waitForTimeout(180)
if ((await page.locator('[data-dragghost]').count()) !== 0) errors.push('map-drag: the ghost lingered after release')
if ((await page.locator('[data-walk-editor] [data-rmark]').count()) !== 0)
  errors.push('map-drag: the preview caret lingered on the road after release')
if (!((await page.locator('[data-walk-editor] [data-rnode]').count()) > beforeStops))
  errors.push('map-drag: dragging the selected cell onto the road added no stop')
if ((await page.locator('[data-walk-editor] [data-rnode][data-node="os"]').count()) === 0)
  errors.push('map-drag: the dropped stop is not the dragged node (os)')
// the map's own gestures survive: a double-click still dives a level — the
// pointerdown gate yields ONLY on the selected cell, the rest of the map pans
// and zooms untouched, so one grab handle never traps the map.
const beforeLevel = Number(await map.getAttribute('data-level'))
await page.mouse.dblclick(mbox.x + mbox.width * 0.2, mbox.y + mbox.height * 0.2)
await page.waitForTimeout(400)
if (!(Number(await map.getAttribute('data-level')) > beforeLevel))
  errors.push('gestures: double-click no longer dives a level after the drag rebuild')
await page.screenshot({ path: OUT + '/p1e-map-drag-landed.png' })

// 2b — KEYBOARD (google-maps): the top row starts highlighted, ↓ walks it down,
// Enter is a click on the highlighted row — it selects that node on the map and
// closes the list. Capture whichever row the arrows land on and assert THAT id
// is what the map selected, so the check holds no matter the hit count.
await search.fill('operating')
await page.waitForTimeout(200)
if ((await page.locator('[data-pal-active]').count()) !== 1) errors.push('keyboard: no row is highlighted with a live query')
await search.press('ArrowDown')
await search.press('ArrowDown')
const activeId = await page.locator('[data-pal-active]').getAttribute('data-pal')
if (!activeId) errors.push('keyboard: ArrowDown left no highlighted row')
await search.press('Enter')
await page.waitForTimeout(400)
if (activeId && (await map.getAttribute('data-sel')) !== activeId) errors.push('keyboard: Enter did not select the highlighted row on the map')
if ((await search.inputValue()) !== '') errors.push('keyboard: Enter did not close the search')
await page.screenshot({ path: OUT + '/p1c-keyboard-enter.png' })

// 2c — ESC CANCELS: a live query, Escape, and the box is empty again (the list
// collapses back to the recents view).
await search.fill('operating')
await page.waitForTimeout(150)
if ((await page.locator('[data-pal]').count()) === 0) errors.push('esc: precondition — no hits to cancel')
await search.press('Escape')
await page.waitForTimeout(150)
if ((await search.inputValue()) !== '') errors.push('esc: Escape did not cancel the query')
if ((await page.locator('[data-pal]').count()) !== 0) errors.push('esc: Escape did not collapse the hit list')

// 3 — + APPENDS AND CLEARS: re-search first (the click above closed the list),
// then the explicit add lands the stop on the road and collapses the list again.
await search.fill('operating')
await page.waitForTimeout(200)
await page.locator('[data-pal-add="os"]').click()
await page.waitForTimeout(200)
if ((await road.getByText('Operating Systems').count()) === 0) errors.push('+ append: the stop did not land on the road')
if ((await search.inputValue()) !== '') errors.push('+ append: the search box did not clear after appending')
if ((await page.locator('[data-pal]').count()) !== 0) errors.push('+ append: the result list did not collapse after appending')

// 4 — RECENTS RECORD THE RESOLVED TITLE, not the keystrokes. The append above
// resolved to "Operating Systems", so that clean title is the first recent chip.
if ((await page.locator('[data-pal-recent="Operating Systems"]').count()) === 0)
  errors.push('recents: the appended node\'s title did not appear as a recent chip')
// the recent chip is itself a drag source onto the road (resolves its title back
// to a node, feeds `pal:<id>`). Native HTML5 DnD is not reliably drivable here,
// so assert the wiring — the chip carries draggable — rather than the drop.
if ((await page.locator('[data-pal-recent="Operating Systems"]').getAttribute('draggable')) !== 'true')
  errors.push('recents drag: the recent chip is not a drag source')
await page.screenshot({ path: OUT + '/p2-recents-title.png' })

// 5 — ENTER RECORDS THE TOP HIT'S TITLE, even from a sloppy query. Type a typo'd
// fragment, note the resolved top hit, Enter, and assert THAT title is the chip
// (not the raw fragment), and that clicking it re-runs a search.
await search.fill('encrypt')
await page.waitForTimeout(200)
const topTitle = await page.locator('[data-pal]').first().evaluate((el) => el.querySelector('span:nth-child(2) > span')?.textContent || '')
await search.press('Enter')
await search.fill('')
await page.waitForTimeout(200)
if (!topTitle) errors.push('ranking: "encrypt" fragment matched nothing to resolve')
if (topTitle && (await page.locator(`[data-pal-recent="${topTitle}"]`).count()) === 0)
  errors.push(`recents: Enter did not record the resolved title "${topTitle}" (it saved the raw fragment instead)`)
if ((await page.locator('[data-pal-recent="encrypt"]').count()) !== 0)
  errors.push('recents: the raw typed fragment "encrypt" was saved as a recent (it must not be)')
await page.screenshot({ path: OUT + '/p3-recents-refined.png' })
await page.locator(`[data-pal-recent-run="${topTitle}"]`).first().click()
await page.waitForTimeout(200)
if (topTitle && (await search.inputValue()) !== topTitle) errors.push('recents: clicking a recent chip did not re-run its query')

// 6 — FORGET A RECENT: the chip's ✕ drops just that entry, leaving the others.
// Clear the box back to the recents view first, then delete "Operating Systems"
// and assert it is gone while the refined chip survives.
await search.fill('')
await page.waitForTimeout(150)
if ((await page.locator('[data-pal-recent="Operating Systems"]').count()) === 0)
  errors.push('forget: precondition — "Operating Systems" chip missing before delete')
await page
  .locator('[data-pal-recent="Operating Systems"]')
  .getByRole('button', { name: 'forget this search' })
  .click()
await page.waitForTimeout(150)
if ((await page.locator('[data-pal-recent="Operating Systems"]').count()) !== 0)
  errors.push('forget: the ✕ did not remove the "Operating Systems" recent')
if (topTitle && (await page.locator(`[data-pal-recent="${topTitle}"]`).count()) === 0)
  errors.push('forget: deleting one recent also dropped an unrelated chip')

if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
} else {
  console.log('palette OK — empty/short, widened reach, matches-on-map + deep roll-up (#25), click-selects-on-map, map→road pointer-drag with ghost + live preview caret + real drop (#24), keyboard ↓/Enter/Esc, recent-drag, +-append-and-clear, title recents, forget-recent all verified')
}
await browser.close()
vite.kill()
process.exit(errors.length ? 1 : 0)
