// browsertest-cs2023lists.mjs — cs2023's sixty routes under the program's headings.
//
// A TEST. It opens the cs2023 build and reads both walk lists: the Trail's Walks
// column and the Walk Editor's picker. Every route must stay a button, under the
// three categories the map publishes, in the order the data first meets them,
// with 20 / 3 / 38 routes and CPS 109 first. Then it loads teaching, which
// publishes no category, and the two walks must stay a flat list.
//
// The route titles and category counts come from cs2023_map.json, not from
// strings typed here, so the driver measures the data rather than a copy of it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-cs2023lists.mjs
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
const routeTitle = (r) => `${r.course} ${r.title}`
const routeTitles = data.routes.map(routeTitle)
const byTitle = new Set(routeTitles)

/** the headings in first-meet order, and how many routes each holds */
const expectedHeadings = []
const expectedCount = new Map()
for (const r of data.routes) {
  if (!expectedCount.has(r.category)) {
    expectedCount.set(r.category, 0)
    expectedHeadings.push(r.category)
  }
  expectedCount.set(r.category, expectedCount.get(r.category) + 1)
}

/** a button's words back to the route it names: Trail writes "▶ Title", the
 *  picker writes "Title" and the stop count beside it. */
const titleOf = (text) => {
  const t = text.replace(/^\s*▶\s*/, '').trim()
  if (byTitle.has(t)) return t
  const found = routeTitles.find((title) => t.startsWith(title) && /^\s*\d+$/.test(t.slice(title.length)))
  return found ?? null
}

const TEACHING_WALKS = 2

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const errors = []
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ''}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

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

/** the groups inside one list; a flat list has no [data-walk-group] at all */
const readGroups = (selector) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => ({
      heading: el.querySelector('[data-walk-heading]')?.textContent?.trim() ?? null,
      headingIsButton: !!el.querySelector('[data-walk-heading] button'),
      buttons: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
    })),
  )

const checkCs2023Groups = (label, groups) => {
  const headings = groups.map((g) => g.heading)
  if (JSON.stringify(headings) !== JSON.stringify(expectedHeadings)) {
    fail(`${label}: headings are ${JSON.stringify(headings)}, expected ${JSON.stringify(expectedHeadings)}`)
  }
  if (groups.some((g) => g.headingIsButton)) fail(`${label}: a heading is a button`)
  let total = 0
  for (const g of groups) {
    total += g.buttons.length
    const expected = expectedCount.get(g.heading) ?? 0
    if (g.buttons.length !== expected) {
      fail(`${label}: "${g.heading}" holds ${g.buttons.length} routes, expected ${expected}`)
    }
  }
  if (total !== data.routes.length) fail(`${label}: ${total} routes in total, expected ${data.routes.length}`)

  const named = groups.flatMap((g) => g.buttons.map(titleOf))
  const unread = named.filter((t) => t === null)
  if (unread.length) fail(`${label}: ${unread.length} buttons do not name a route, first ${JSON.stringify(unread[0])}`)
  const missing = routeTitles.filter((t) => !named.includes(t))
  if (missing.length) fail(`${label}: missing ${missing.length} routes, first "${missing[0]}"`)
}

const openPicker = async () => {
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(1000)
  await page.locator('[aria-label="studio-pane-walkeditor"]').getByRole('button', { name: 'add a walk' }).click()
  await page.waitForTimeout(300)
}

let server = null
try {
  // ── cs2023: both lists grouped ────────────────────────────────────────────
  server = await startVite({ env: { VITE_CORPUS: 'cs2023' } })
  await load(server.port)

  const trail = await readGroups('[aria-label="trail-strip"] [data-walk-group]')
  checkCs2023Groups('Trail', trail)
  const cps109 = trail[0]?.buttons[0]
  if (cps109 !== `▶ ${routeTitles[0]}`) fail(`Trail: the first route is ${JSON.stringify(cps109)}, expected CPS 109`)
  await page.screenshot({ path: OUT + '/cs2023lists-trail.png' })

  await openPicker()
  const picker = await readGroups('[data-walk-picker] [data-walk-group]')
  checkCs2023Groups('picker', picker)
  if (titleOf(picker[0]?.buttons[0] ?? '') !== routeTitles[0]) fail('picker: the first route is not CPS 109')
  await page.locator('[aria-label="studio-pane-walkeditor"]').screenshot({ path: OUT + '/cs2023lists-picker.png' })

  await stopServer(server)
  server = null

  // ── teaching: no published category, so flat lists ────────────────────────
  server = await startVite({ env: { VITE_CORPUS: 'teaching' } })
  await load(server.port)

  const trailFlat = await page.locator('[aria-label="trail-strip"] button', { hasText: '▶' }).count()
  const trailHeadings = await page.locator('[aria-label="trail-strip"] [data-walk-heading]').count()
  const trailGroups = await readGroups('[aria-label="trail-strip"] [data-walk-group]')
  if (trailFlat !== TEACHING_WALKS) fail(`teaching Trail: ${trailFlat} walks, expected ${TEACHING_WALKS}`)
  if (trailHeadings !== 0 || trailGroups.length !== 0) fail('teaching Trail: the list is grouped, expected flat')

  await openPicker()
  const pickerFlat = await page.locator('[data-walk-picker] button').count()
  const pickerHeadings = await page.locator('[data-walk-picker] [data-walk-heading]').count()
  const pickerGroups = await readGroups('[data-walk-picker] [data-walk-group]')
  if (pickerFlat !== TEACHING_WALKS) fail(`teaching picker: ${pickerFlat} walks, expected ${TEACHING_WALKS}`)
  if (pickerHeadings !== 0 || pickerGroups.length !== 0) fail('teaching picker: the list is grouped, expected flat')
  await page.screenshot({ path: OUT + '/teachinglists.png' })

  console.log(`cs2023: ${expectedHeadings.map((h) => `${h} (${expectedCount.get(h)})`).join(', ')}`)
  console.log('shots in tools/studio-spike/out/cs2023lists-trail.png, cs2023lists-picker.png and teachinglists.png')
} finally {
  await stopServer(server)
  await browser.close()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — cs2023 shows every route under REQUIRED / REQUIRED GROUP 1 / Professionally-Related Table I, and teaching stays flat')
