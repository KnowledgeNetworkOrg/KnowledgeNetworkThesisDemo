// browsertest-cs2023corpus.mjs — the app, loaded against the CS2023 corpus, with
// the TMU courses as routes over it.
//
// A TEST. It opens the real app in a real browser with `VITE_CORPUS=cs2023` and
// asserts what a unit test cannot: the module-level lookups that read the LOADED
// corpus (`playSteps`, the Walk Desk's `SEED` and the plan guard) and the map's
// drawing of a domain that holds no topics. Under vitest the loaded corpus is
// `teaching`, so those run here.
//
// What it drives:
//   1. the app mounts, Science is a drawn and selectable 18th area;
//   2. Trail lists 61 routes;
//   3. CPS 209 plays stop by stop to its last stop, in order, repeats kept;
//   4. CPS 40A/B, which has no stops, does nothing;
//   5. the Walk Desk opens on CPS 109's own stops, at any depth;
//   6. a stored draft keeps those stops across a reload;
//   7. no page error.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-cs2023corpus.mjs
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
const routeOf = (course) => data.routes.find((r) => r.course === course)
const routeTitle = (r) => `${r.course} ${r.title}`
const cps109 = routeOf('CPS 109')
const cps209 = routeOf('CPS 209')
const empty = routeOf('CPS 40A/B')

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite({ env: { VITE_CORPUS: 'cs2023' } })

const errors = []
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}
${e.stack ?? ''}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const focusReadout = page.locator('[aria-label="studio-header"] [data-focus]')
const focusId = async () => focusReadout.getAttribute('data-focus')

/** Run `fn` with the palette open, and leave it as it was found. Applying a preset
 *  closes the palette, so restoring by state rather than by a blind click. */
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

const walkButtons = () => page.locator('[aria-label="trail-strip"] button', { hasText: '▶' })

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
  // a leftover draft would make the desk's opening road something other than the seed
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)

  // 1. the app mounted at all — a module-load throw would deny this
  if ((await page.locator('svg').count()) === 0) fail('no svg on the page — the app did not render')

  const text = await page.locator('body').innerText()
  for (const other of ['Virtual Memory', 'Propositional Logic', 'Hash Tables']) {
    if (text.includes(other)) fail(`"${other}" belongs to the teaching corpus and should not be on screen`)
  }
  for (const area of ['Artificial Intelligence (AI)', 'Software Engineering (SE)']) {
    if (!text.includes(area)) fail(`area "${area}" is not on screen`)
  }

  // Science is the 18th area. It holds no topics, so the map must synthesize its
  // ground from its ring anchor: a path, a click, and a document.
  const science = page.locator('path[data-region="X-Science"]')
  if ((await science.count()) !== 1) fail('Science is not drawn as a region on the map')
  else {
    const d = await science.getAttribute('d')
    if (!d) fail('Science\'s region path is empty')
    await science.dispatchEvent('click')
    await page.waitForTimeout(500)
    const id = await focusId()
    if (id !== 'X-Science') fail(`clicking Science selected "${id}", not X-Science`)
    const docText = await page.locator('[aria-label="studio-pane-document"]').innerText()
    if (!docText.includes('Science')) fail('the document pane does not name Science after selecting it')
  }

  // 2. 61 routes in the Walks list
  await withPalette(async () => {
    if ((await page.locator('[aria-label="studio-pane-trail"]').count()) === 0) {
      await page.locator('[aria-label="studio-inst-trail"]').click()
    }
  })
  await page.waitForTimeout(500)
  const routeCount = await walkButtons().count()
  if (routeCount !== data.routes.length) fail(`Walks list shows ${routeCount} routes, expected ${data.routes.length}`)
  if (!(await page.locator('[aria-label="trail-strip"]').innerText()).includes(routeTitle(cps109))) {
    fail(`the Walks list does not name "${routeTitle(cps109)}"`)
  }

  // 3. CPS 209 — a route with repeat visits — plays to its last stop, in order
  await page.locator('[aria-label="trail-strip"] button', { hasText: routeTitle(cps209) }).click()
  await page.waitForTimeout(500)
  if ((await page.locator('[data-walk-dock]').count()) === 0) fail('the walk dock did not mount for CPS 209')
  else {
    await page.locator('[data-walk-dock]').focus()
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    const expected = cps209.stops.map((s) => s.node)
    if (new Set(expected).size === expected.length) fail('CPS 209 no longer has a repeat visit to test')
    const seen = []
    for (let i = 0; i < expected.length; i++) {
      seen.push(await focusId())
      if (i + 1 < expected.length) {
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(120)
      }
    }
    if (JSON.stringify(seen) !== JSON.stringify(expected)) {
      fail(`CPS 209 played out of order: saw ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`)
    }
    const dock = await page.locator('[data-walk-dock]').innerText()
    if (!dock.includes(`${expected.length} / ${expected.length}`)) {
      fail(`CPS 209 did not reach its last stop: dock reads "${dock.replace(/\s+/g, ' ')}"`)
    }
  }

  // 4. CPS 40A/B has no stops: clicking it must change nothing and throw nothing
  await page.getByRole('button', { name: 'stop this walk' }).click()
  await page.waitForTimeout(400)
  await page.locator('[aria-label="trail-strip"] button', { hasText: routeTitle(empty) }).click()
  await page.waitForTimeout(500)
  const afterEmpty = await walkButtons().count()
  if (afterEmpty !== data.routes.length) fail(`after clicking the empty route the Walks list has ${afterEmpty} routes, expected ${data.routes.length}`)
  if ((await page.locator('[aria-label="trail-strip"]').innerText()).includes('stop 1 of 0')) {
    fail('the empty route started a walk: the strip reads "stop 1 of 0"')
  }

  // 5. the Walk Desk opens on CPS 109's route, its stops as the data has them,
  //    deep and area stops included
  await page.locator('[aria-label="studio-preset-plan"]').click()
  await page.waitForTimeout(1000)
  const road = await page.evaluate(() =>
    [...document.querySelectorAll('[data-road-root] [data-rnode]')]
      .map((el) => el.getAttribute('data-node'))
      .filter((id) => id !== null && id !== ''),
  )
  const opening = cps109.stops.map((s) => s.node)
  if (JSON.stringify(road) !== JSON.stringify(opening)) {
    fail(`the Walk Desk opens on ${JSON.stringify(road)}, expected CPS 109's ${JSON.stringify(opening)}`)
  }

  // 6. the stored draft reader keeps a stop below a unit, or on an area, across
  //    a reload — the seed itself is not written until the draft changes
  await page.evaluate((stops) => {
    localStorage.setItem('pkt.walkdesk.draft:cs2023', JSON.stringify({
      v: 1,
      data: { stops, choices: {}, withOptionals: true },
    }))
  }, cps109.stops.map((s) => ({ node: s.node, note: s.label, variants: [] })))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  await page.locator('[aria-label="studio-preset-plan"]').click()
  await page.waitForTimeout(1000)
  const reloaded = await page.evaluate(() =>
    [...document.querySelectorAll('[data-road-root] [data-rnode]')]
      .map((el) => el.getAttribute('data-node'))
      .filter((id) => id !== null && id !== ''),
  )
  if (JSON.stringify(reloaded) !== JSON.stringify(opening)) {
    fail(`after a reload the Walk Desk holds ${JSON.stringify(reloaded)}, expected CPS 109's ${JSON.stringify(opening)}`)
  }
  await page.evaluate(() => localStorage.clear())

  await page.screenshot({ path: OUT + '/cs2023corpus-routes.png' })
  console.log('shot in tools/studio-spike/out/cs2023corpus-routes.png')
  console.log(`routes = ${routeCount}, CPS 109 opening stops = ${road.length}, CPS 209 stops = ${cps209.stops.length}`)
} finally {
  await browser.close()
  vite.kill()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — the app runs on the CS2023 corpus with its routes')
