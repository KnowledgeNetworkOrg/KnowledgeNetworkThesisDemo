// browsertest-cs2023marks.mjs — a stop's marks, a deep stop's secondary places
// and the cs2023 standing notice, on the real app.
//
// A TEST. It opens the cs2023 build, activates three routes from Trail (the Walk
// Desk's draft road carries no marks), and checks the hover card each stop draws:
// MTH 110 has split stops and a not-matched stop on the MSF area, and one
// secondary tag at stop 5 and none at stops 3 and 4; CPS 803 is filled
// throughout; BLG 143 is split and an exception on Science. The same screen must
// carry the standing placement notice. Teaching and courses must not.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-cs2023marks.mjs
// Frames land in tools/studio-spike/out/ (gitignored).
// Exits nonzero on any failed assertion or any page error.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
mkdirSync(OUT, { recursive: true })

const data = JSON.parse(readFileSync(join(REPO, 'tools/cs2023import/cs2023_map.json'), 'utf8'))
const routeOf = (course) => {
  const route = data.routes.find((r) => r.course === course)
  if (!route) throw new Error(`no route for ${course}`)
  return route
}
const routeTitle = (r) => `${r.course} ${r.title}`
const NOTICE = "Placements are AI-suggested and under the author's review."

/** the badges a stop should draw — the four notable values, source first */
const marksOf = (stop) => {
  const marks = []
  if (stop.source === 'split' || stop.source === 'filled') marks.push(stop.source)
  if (stop.confidence === 'not matched' || stop.confidence === 'exception') marks.push(stop.confidence)
  return marks
}
const secondaryOf = (stop) => (stop.secondary ?? []).map((s) => s.label)

const ROUTES = [
  { course: 'MTH 110' },
  { course: 'CPS 803' },
  { course: 'BLG 143' },
].map((r) => ({ ...r, route: routeOf(r.course) }))

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const errors = []
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ''}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const focusReadout = page.locator('[aria-label="studio-header"] [data-focus]')
const focusId = async () => focusReadout.getAttribute('data-focus')
const walkButtons = () => page.locator('[aria-label="trail-strip"] button', { hasText: '▶' })

/** Run `fn` with the palette open, and leave it as it was found. */
const withPalette = async (fn) => {
  const isOpen = async () => (await page.locator('[aria-label^="studio-inst-"]').count()) > 0
  const wasOpen = await isOpen()
  if (!wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
  await fn()
  if ((await isOpen()) !== wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
}

const stopServer = async (server) => {
  if (!server || server.vite.exitCode !== null) return
  await new Promise((res) => {
    server.vite.once('exit', res)
    server.vite.kill()
  })
}

const load = async (port) => {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  await withPalette(async () => {
    if ((await page.locator('[aria-label="studio-pane-trail"]').count()) === 0) {
      await page.locator('[aria-label="studio-inst-trail"]').click()
    }
  })
  await page.waitForTimeout(500)
}

const activate = async (title) => {
  const stop = page.getByRole('button', { name: 'stop this walk' })
  if ((await stop.count()) > 0) {
    await stop.click()
    await page.waitForTimeout(500)
  }
  await page.locator('[aria-label="trail-strip"] button', { hasText: title }).click()
  await page.waitForTimeout(600)
  if ((await page.locator('[data-walk-dock]').count()) === 0) {
    fail(`the walk dock did not mount for ${title}`)
    return false
  }
  const show = page.getByRole('button', { name: 'show every stop' })
  if ((await show.count()) > 0) {
    await show.click()
    await page.waitForTimeout(500)
  }
  return true
}

/** the hover card for stop `i`, after the dock's own cursor has been put on it */
const readStop = async (i) => {
  const dock = page.locator('[data-walk-dock]')
  await dock.focus()
  await page.keyboard.press(i === 0 ? 'Home' : 'ArrowRight')
  await page.waitForTimeout(180)
  const dot = page.locator(`[data-walk-dock-stop="${i}"]`)
  if ((await dot.count()) === 0) return { error: `no dock stop ${i}` }
  await dot.hover()
  await page.waitForTimeout(220)
  const preview = page.locator('[data-walk-preview]')
  if ((await preview.count()) !== 1) return { error: `no hover card for stop ${i + 1}` }
  const marks = await preview.locator('[data-stop-mark]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stop-mark')))
  const markTexts = await preview.locator('[data-stop-mark]').allTextContents()
  const secondary = await preview.locator('[data-stop-secondary-item]').allTextContents()
  const docSecondary = await page.locator('[aria-label="studio-pane-document"] [data-stop-secondary-item]').allTextContents()
  return { id: await focusId(), marks, markTexts, secondary, docSecondary }
}

let server = null
try {
  server = await startVite({ env: { VITE_CORPUS: 'cs2023' } })
  await load(server.port)

  const routeCount = await walkButtons().count()
  if (routeCount !== data.routes.length) fail(`Walks list shows ${routeCount} routes, expected ${data.routes.length}`)

  for (const { route, course } of ROUTES) {
    const title = routeTitle(route)
    console.log(`${course}: ${title}, ${route.stops.length} stops`)
    if (!(await activate(title))) continue

    const trailNotice = page.locator('[aria-label="trail-strip"] [data-standing-notice]')
    if ((await trailNotice.count()) !== 1) fail(`${course}: the trail strip carries ${await trailNotice.count()} standing notices, expected 1`)
    else if ((await trailNotice.innerText()).trim() !== NOTICE) fail(`${course}: the trail strip notice reads "${await trailNotice.innerText()}"`)

    const seen = []
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i]
      const read = await readStop(i)
      if (read.error) {
        fail(`${course} stop ${i + 1}: ${read.error}`)
        continue
      }
      if (i === 0) {
        const docNotice = page.locator('[aria-label="studio-pane-document"] [data-standing-notice]')
        if ((await docNotice.count()) !== 1) fail(`${course}: the document panel carries ${await docNotice.count()} standing notices, expected 1`)
        else if ((await docNotice.innerText()).trim() !== NOTICE) fail(`${course}: the document panel notice reads "${await docNotice.innerText()}"`)
      }
      if (read.id !== stop.node) fail(`${course} stop ${i + 1} focused "${read.id}", expected "${stop.node}"`)
      const wantMarks = marksOf(stop)
      if (!same(read.marks, wantMarks)) {
        fail(`${course} stop ${i + 1}: marks ${JSON.stringify(read.marks)}, expected ${JSON.stringify(wantMarks)}`)
      }
      if (!same(read.markTexts, wantMarks)) {
        fail(`${course} stop ${i + 1}: badge words ${JSON.stringify(read.markTexts)}, expected ${JSON.stringify(wantMarks)}`)
      }
      const wantSecondary = secondaryOf(stop)
      if (!same(read.secondary, wantSecondary)) {
        fail(`${course} stop ${i + 1}: hover-card secondary ${JSON.stringify(read.secondary)}, expected ${JSON.stringify(wantSecondary)}`)
      }
      if (!same(read.docSecondary, wantSecondary)) {
        fail(`${course} stop ${i + 1}: document secondary ${JSON.stringify(read.docSecondary)}, expected ${JSON.stringify(wantSecondary)}`)
      }
      seen.push(read.marks.join('+') || 'plain')
    }

    const all = seen.join(' | ')
    if (course === 'MTH 110') {
      // stop 2 is the area MSF: split and not matched
      if (!seen[1].includes('split') || !seen[1].includes('not matched')) fail(`MTH 110 stop 2 reads "${seen[1]}", expected split+not matched`)
      if (!seen.some((s) => s.includes('split'))) fail('MTH 110 shows no split mark')
    }
    if (course === 'CPS 803' && seen.some((s) => s !== 'filled')) {
      fail(`CPS 803 is not filled at every stop: ${all}`)
    }
    if (course === 'BLG 143' && seen.some((s) => s !== 'split+exception')) {
      fail(`BLG 143 is not split+exception at every stop: ${all}`)
    }
    console.log(`  marks: ${all}`)
  }

  // the secondary tag belongs to stop 5 only: stops 3 and 4 are the same node
  const mth = ROUTES.find((r) => r.course === 'MTH 110').route
  const mthStops = mth.stops
  if (!(mthStops[4].secondary ?? []).length) fail('MTH 110 stop 5 no longer carries a secondary tag to test')
  if ((mthStops[2].secondary ?? []).length || (mthStops[3].secondary ?? []).length) {
    fail('MTH 110 stops 3 or 4 gained a secondary tag; the stop-position check is no longer meaningful')
  }

  await page.screenshot({ path: OUT + '/cs2023marks.png' })
  console.log('shot in tools/studio-spike/out/cs2023marks.png')

  await stopServer(server)
  server = null

  for (const corpus of ['teaching', 'courses']) {
    server = await startVite({ env: { VITE_CORPUS: corpus } })
    await load(server.port)
    const first = walkButtons().first()
    if ((await first.count()) === 0) fail(`${corpus}: no route to open`)
    else {
      await first.click()
      await page.waitForTimeout(700)
      const stripText = await page.locator('[aria-label="trail-strip"]').innerText()
      if (!/stop \d+ of \d+/.test(stripText)) {
        fail(`${corpus}: the route did not become active, so the notice check proves nothing`)
      }
      const notices = await page.locator('[data-standing-notice]').count()
      if (notices !== 0) fail(`${corpus}: ${notices} standing notice(s) on a screen that should have none`)
    }
    await stopServer(server)
    server = null
  }
} finally {
  await stopServer(server)
  await browser.close()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — cs2023 shows stop marks, secondary places and the standing notice; the other corpora do not')
