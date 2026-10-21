// browsertest-deskdividers.mjs — OB-170 (#348).
//
// A TEST. It opens the real app in a real browser and asserts that the desk's pane
// boundaries DRAG, that each pane stops at the floor it declares, that a resting
// divider draws nothing, and that a double-click/keyboard reset returns the
// seam's two panes to their preset split and leaves the rest of the desk alone.
// It drives the launch composition (a drag on each
// seam, with the sidebar open), that the desk follows the row through a palette
// close instead of stepping once it lands, Explore (two panes, one seam) and Plan
// (three panes, two seams, no walk palette since #416), then a narrow window where
// the declared floors cannot all fit.
//
// The floor is read from the pane's own `data-pane-fit`, so the driver is checking
// the number the pane published rather than a number retyped here.
//
// Spawns vite ITSELF through devserver.mjs — backgrounded dev servers die on this
// machine, and a fresh OS-chosen port lets checkouts run at once.
// Run from anywhere:  node tools/studio-spike/browsertest-deskdividers.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const pane = (id) => page.locator(`[aria-label="studio-pane-${id}"]`)
const box = async (id) => {
  const b = await pane(id).boundingBox()
  return b ? { x: b.x, w: b.width, r: b.x + b.width } : null
}
const widths = async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, Math.round((await box(id))?.w ?? 0)])))
const floorOf = async (id) => Number(await pane(id).getAttribute('data-pane-fit'))
const dividers = () => page.locator('[data-desk-row] > [role="separator"]')
const park = async () => { await page.mouse.move(4, 4); await page.waitForTimeout(220) }
const pageOverflow = () => page.evaluate(() => ({
  scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  width: document.documentElement.clientWidth,
}))
const offscreen = async (ids) => {
  const vw = await page.evaluate(() => window.innerWidth)
  const bad = []
  for (const id of ids) {
    const b = await pane(id).boundingBox()
    if (!b || b.x < -1 || b.x + b.width > vw + 1) bad.push(`${id} ${JSON.stringify(b)}`)
  }
  const found = dividers()
  for (let i = 0; i < await found.count(); i++) {
    const b = await found.nth(i).boundingBox()
    if (!b || b.x < -1 || b.x + b.width > vw + 1) bad.push(`seam ${i} ${JSON.stringify(b)}`)
  }
  return { bad, vw }
}
const checkFits = async (label, ids) => {
  const o = await pageOverflow()
  ok(`${label}: the page does not scroll sideways`, o.scroll <= o.width + 1, JSON.stringify(o))
  const { bad, vw } = await offscreen(ids)
  ok(`${label}: every pane and handle is reachable`, bad.length === 0, `${bad.join('; ')} (viewport ${vw})`)
}

const drag = async (divider, dx) => {
  const b = await divider.boundingBox()
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 18 })
  await page.mouse.up()
  await page.waitForTimeout(320)
}
const lineOf = (divider) => divider.locator('div').first()
const linePaint = (divider) => lineOf(divider).evaluate((el) => {
  const s = getComputedStyle(el)
  return { bg: s.backgroundColor, w: parseFloat(s.width) || 0 }
})
const openPalette = async () => {
  const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
  if ((await toggle.getAttribute('title')) !== 'hide the palette') {
    await toggle.click()
    await page.waitForTimeout(600)
  }
}
// Watched by the flight's STATE, not the clock (#455): the first frame is taken
// before the press, every painted frame after it is sampled, and the trace ends on
// the first frame that no longer carries `data-palette-flying` after one that did.
// A slow machine draws fewer frames, never a shorter flight.
const closePaletteTraced = async () => {
  await page.waitForFunction(() => !document.querySelector('[data-palette-flying]'))
  const traced = page.evaluate(() => new Promise((resolve) => {
    const row = document.querySelector('[data-desk-row]')
    const trace = []
    let seenFlying = false
    const t0 = performance.now()
    const tick = () => {
      const r = row.getBoundingClientRect()
      const shown = [...row.querySelectorAll('[aria-label^="studio-pane-"]')]
        .filter((el) => getComputedStyle(el).display !== 'none')
      const last = shown[shown.length - 1]
      const flying = !!document.querySelector('[data-palette-flying]')
      if (last) trace.push({ gap: r.right - last.getBoundingClientRect().right, rowLeft: r.left, flying })
      if (flying) seenFlying = true
      if ((seenFlying && !flying) || performance.now() - t0 > 10000) resolve(trace)
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(() => { tick(); window.__deskTraceReady = true })
  }))
  await page.waitForFunction(() => window.__deskTraceReady === true)
  await page.locator('[data-toolbar-hook="palette-toggle"]').click()
  const trace = await traced
  await page.evaluate(() => { delete window.__deskTraceReady })
  return trace
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  await checkFits('the opening composition at 1280 with the sidebar open', ['map', 'unfoldgraph', 'document'])

  // ── Launch: a seam moves only its two panes ───────────────────────────────
  // The document opens below its floor here, so this is the case a fitted layout
  // used to rearrange on the first pixel of a drag.
  const launch = await widths(['map', 'unfoldgraph', 'document'])
  ok('the opening composition draws two dividers', (await dividers().count()) === 2, `${await dividers().count()}`)

  const launchSeam0 = dividers().nth(0)
  const now0 = Number(await launchSeam0.getAttribute('aria-valuenow'))
  ok('the map|unfoldgraph handle announces the width the map is drawn at', near(now0, launch.map, 1), `${now0} vs ${launch.map}`)
  await drag(launchSeam0, 2)
  const launchAfter0 = await widths(['map', 'unfoldgraph', 'document'])
  ok('a 2px drag there moves only the map and the unfold graph by the pointer\'s travel',
    near(launchAfter0.map, launch.map + 2, 1) && near(launchAfter0.unfoldgraph, launch.unfoldgraph - 2, 1) && near(launchAfter0.document, launch.document, 1),
    `${JSON.stringify(launch)} -> ${JSON.stringify(launchAfter0)}`)

  await launchSeam0.dblclick()
  await page.waitForTimeout(400)
  const launchReset = await widths(['map', 'unfoldgraph', 'document'])
  ok('resetting that seam returns the opening split',
    near(launchReset.map, launch.map, 2) && near(launchReset.unfoldgraph, launch.unfoldgraph, 2) && near(launchReset.document, launch.document, 1),
    `${JSON.stringify(launch)} -> ${JSON.stringify(launchReset)}`)

  const launchSeam1 = dividers().nth(1)
  const now1 = Number(await launchSeam1.getAttribute('aria-valuenow'))
  ok('the unfold graph|document handle announces the width the unfold graph is drawn at', near(now1, launch.unfoldgraph, 1), `${now1} vs ${launch.unfoldgraph}`)
  await drag(launchSeam1, -2)
  const launchAfter1 = await widths(['map', 'unfoldgraph', 'document'])
  ok('a 2px drag there moves only the unfold graph and the document by the pointer\'s travel',
    near(launchAfter1.map, launch.map, 1) && near(launchAfter1.unfoldgraph, launch.unfoldgraph - 2, 1) && near(launchAfter1.document, launch.document + 2, 1),
    `${JSON.stringify(launch)} -> ${JSON.stringify(launchAfter1)}`)

  // A reset belongs to its seam: the first seam's reset puts the map and the unfold
  // graph back to their opening share of what they hold, and the document keeps the
  // width the second seam's drag gave it.
  await drag(launchSeam0, 2)
  await launchSeam0.dblclick()
  await page.waitForTimeout(400)
  const seamReset = await widths(['map', 'unfoldgraph', 'document'])
  ok("resetting one seam leaves the other seam's drag in place",
    near(seamReset.document, launchAfter1.document, 1) && near(seamReset.map, launchAfter1.map, 2) && near(seamReset.unfoldgraph, launchAfter1.unfoldgraph, 2),
    `${JSON.stringify(launchAfter1)} -> ${JSON.stringify(seamReset)}`)

  // ── Launch: a seam that has stopped moves nothing else ────────────────────
  // The unfold graph is the seam's right pane and its floor is 80px away. Once
  // there, further nudges must leave the boundary, the map and the document alone.
  await launchSeam0.focus()
  const preKeys = await widths(['map', 'unfoldgraph', 'document'])
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(350)
  const stopped = await widths(['map', 'unfoldgraph', 'document'])
  const unfoldFloor = await floorOf('unfoldgraph')
  ok('keyboard nudges stop the unfold graph at its declared floor', near(stopped.unfoldgraph, unfoldFloor, 2), `${stopped.unfoldgraph}px, floor ${unfoldFloor}`)
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(350)
  const afterKeys = await widths(['map', 'unfoldgraph', 'document'])
  ok('nudging a stopped seam moves neither the boundary nor the third pane',
    near(afterKeys.map, stopped.map, 1) && near(afterKeys.unfoldgraph, stopped.unfoldgraph, 1) && near(afterKeys.document, preKeys.document, 1),
    `${JSON.stringify(preKeys)} -> ${JSON.stringify(stopped)} -> ${JSON.stringify(afterKeys)}`)

  // ── The palette's flight: the desk widens over time, not in one frame ─────
  // Closing the sidebar gives the row the sidebar's width. The last pane's right
  // edge must stay on the row's through the flight and on the frame it lands, so
  // the desk never steps once the palette is gone.
  const gapTrace = await closePaletteTraced()
  const gapWorst = gapTrace.length ? Math.max(...gapTrace.map((s) => Math.abs(s.gap))) : Infinity
  const rowFirst = gapTrace[0]?.rowLeft ?? 0
  const rowLast = gapTrace[gapTrace.length - 1]?.rowLeft ?? 0
  const rowMove = Math.abs(rowLast - rowFirst)
  const inFlight = gapTrace.filter((s) => s.flying).length
  ok('the palette-close trace saw the flight and its landing',
    inFlight >= 1 && gapTrace[0]?.flying === false && gapTrace[gapTrace.length - 1]?.flying === false,
    `${gapTrace.length} frames, ${inFlight} in flight`)
  ok('the last pane follows the row through the palette close and at its landing', gapWorst <= 2, `worst gap ${gapWorst.toFixed(1)}px across ${gapTrace.length} frames`)
  ok('the palette close widens the desk', rowMove > 50, `${rowMove.toFixed(1)}px`)
  await openPalette()

  // ── Explore: one seam, two panes ──────────────────────────────────────────
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(900)

  ok('Explore draws its two column panes', (await pane('map').count()) === 1 && (await pane('document').count()) === 1)
  ok('Explore draws one divider between them', (await dividers().count()) === 1, `${await dividers().count()}`)
  const start = await widths(['map', 'document'])
  const mapFloor = await floorOf('map')
  const docFloor = await floorOf('document')
  ok('the map declares the Explorer rail\'s floor', mapFloor === 330, `${mapFloor}`)
  ok('the document declares the Relations rail\'s floor', docFloor === 396, `${docFloor}`)
  ok('the document starts at or above its floor', start.document >= docFloor, JSON.stringify(start))

  const d0 = dividers().first()
  await park()
  const rest = await linePaint(d0)
  ok('at rest the divider draws no hairline', rest.bg === 'rgba(0, 0, 0, 0)' || rest.bg === 'transparent', JSON.stringify(rest))
  const db = await d0.boundingBox()
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
  await page.waitForTimeout(320)
  const hot = await linePaint(d0)
  ok('under the pointer the hairline appears and thickens', hot.bg !== 'rgba(0, 0, 0, 0)' && hot.bg !== 'transparent' && hot.w > rest.w, JSON.stringify(hot))
  await park()

  await drag(d0, -80)
  const afterLeft = await widths(['map', 'document'])
  ok('dragging the seam left grows the document and shrinks the map', afterLeft.document > start.document && afterLeft.map < start.map, `${JSON.stringify(start)} -> ${JSON.stringify(afterLeft)}`)
  ok('the drag preserves the two panes\' total width', near(afterLeft.map + afterLeft.document, start.map + start.document, 2), `${start.map + start.document} -> ${afterLeft.map + afterLeft.document}`)

  await drag(d0, 900)
  const atFloor = await widths(['map', 'document'])
  ok('dragging right stops the document at its declared floor', near(atFloor.document, docFloor, 2), `${atFloor.document}px, floor ${docFloor}`)
  ok('...and the map takes exactly what the document gave up', near(atFloor.map + atFloor.document, start.map + start.document, 2), `${atFloor.map + atFloor.document}`)

  await d0.dblclick()
  await page.waitForTimeout(400)
  const reset = await widths(['map', 'document'])
  ok('double-click restores the preset split', near(reset.map, start.map, 3) && near(reset.document, start.document, 3), `${JSON.stringify(start)} -> ${JSON.stringify(reset)}`)

  await d0.focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(350)
  const nudged = await widths(['map', 'document'])
  ok('a keyboard nudge moves the same boundary', nudged.document > reset.document, `${reset.document} -> ${nudged.document}`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const keyReset = await widths(['map', 'document'])
  ok('Enter resets it to the preset split too', near(keyReset.map, start.map, 3) && near(keyReset.document, start.document, 3), `${JSON.stringify(keyReset)}`)

  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await park()
  const restAgain = await linePaint(d0)
  ok('the hairline is gone again once the pointer leaves', restAgain.bg === 'rgba(0, 0, 0, 0)' || restAgain.bg === 'transparent', JSON.stringify(restAgain))

  // ── Plan: two seams, three panes, and no walk palette (#416) ──────────────
  await openPalette()
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(900)
  ok('#416: Plan is the walk editor, the map and the document', (await pane('walkeditor').count()) === 1 && (await pane('map').count()) === 1 && (await pane('document').count()) === 1)
  ok('#416: the walk palette is not part of Plan', (await pane('walkpalette').count()) === 0, `${await pane('walkpalette').count()} present`)
  ok('Plan draws two dividers', (await dividers().count()) === 2, `${await dividers().count()}`)

  const editorFloor = await floorOf('walkeditor')
  const planMapFloor = await floorOf('map')
  const planDocFloor = await floorOf('document')
  ok('each Plan pane publishes a floor', editorFloor > 0 && planMapFloor > 0 && planDocFloor > 0, `${editorFloor}/${planMapFloor}/${planDocFloor}`)

  const planStart = await widths(['walkeditor', 'map', 'document'])
  const seam0 = dividers().nth(0)
  const seam1 = dividers().nth(1)

  await drag(seam0, -600)
  const planLeft = await widths(['walkeditor', 'map', 'document'])
  ok('the walk editor|map seam drags and stops at the walk editor\'s floor', near(planLeft.walkeditor, editorFloor, 2), `${planLeft.walkeditor}px, floor ${editorFloor}`)
  ok('the Plan drag preserves the three panes\' total width', near(planLeft.walkeditor + planLeft.map + planLeft.document, planStart.walkeditor + planStart.map + planStart.document, 3), `${JSON.stringify(planStart)} -> ${JSON.stringify(planLeft)}`)

  await drag(seam1, 900)
  const planRight = await widths(['walkeditor', 'map', 'document'])
  ok('the map|document seam drags and stops at the document\'s floor', near(planRight.document, planDocFloor, 2), `${planRight.document}px, floor ${planDocFloor}`)
  ok('...while the walk editor keeps the floor it had reached', near(planRight.walkeditor, editorFloor, 2), `${planRight.walkeditor}px`)

  // ── Floors exceed the row: the panes shrink, the page does not scroll ─────
  await openPalette()
  await page.waitForTimeout(700)
  await checkFits('Plan at 1280 with the sidebar open', ['walkeditor', 'map', 'document'])

  await page.setViewportSize({ width: 1100, height: 800 })
  await page.waitForTimeout(700)
  await checkFits('Plan at 1100 with the sidebar open', ['walkeditor', 'map', 'document'])

  const narrow = await widths(['walkeditor', 'map', 'document'])
  const row = await page.locator('[data-desk-row]').boundingBox()
  ok('a narrow row shrinks the panes instead of widening the desk',
    row && narrow.walkeditor + narrow.map + narrow.document <= row.width + 1,
    `${JSON.stringify(narrow)} in ${row?.width}px`)
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
